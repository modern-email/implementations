package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	_ "embed"

	"github.com/mjl-/bstore"
	"github.com/mjl-/sherpa"
	"github.com/mjl-/sherpadoc"
)

type Software struct {
	ID           string    // e.g. "mox" or "someSoftware", keep them valid identifiers for working in js easily.
	Created      time.Time `bstore:"default now"`
	Updated      time.Time `bstore:"default now"`
	Name         string    `bstore:"nonzero,unique"`
	URL          string
	Description  string
	OpenSource   bool
	License      string
	ProgLang     string
	Distribution bool // Collection of other software packages.
	// Corresponds to same fields in Feature.
	Server   bool
	Service  bool // Hosted service, software not necessarily available.
	Library  bool
	Client   bool
	Desktop  bool
	Mobile   bool
	Web      bool
	Terminal bool
}

// Feature is something software implements. Like a standard (RFC), a small part of
// a standard, or just some behaviour the software has.
type Feature struct {
	ID          string
	Created     time.Time `bstore:"default now"`
	Updated     time.Time `bstore:"default now"`
	Title       string    `bstore:"nonzero,unique"`
	URL         string
	Description string
	// Corresponds to same fields in Software, whether they are applicable.
	Server   bool
	Service  bool // Hosted service, software not necessarily available.
	Library  bool
	Client   bool
	Desktop  bool
	Mobile   bool
	Web      bool
	Terminal bool
}

// Implementation status of a feature for software.
type Status string

const (
	Unknown       Status = ""
	NotApplicable Status = "n/a"
	Never         Status = "Never"
	No            Status = "No"
	Planned       Status = "Planned"
	Partial       Status = "Partial"
	Yes           Status = "Yes"
)

// Implementation status of a feature by an implementation.
type Implementation struct {
	ID           int64
	Created      time.Time `bstore:"default now" json:"-"` // Not in JSON to reduce noise.
	Updated      time.Time `bstore:"default now"`
	SoftwareID   string    `bstore:"ref Software,unique SoftwareID+FeatureID"`
	FeatureID    string    `bstore:"ref Feature"`
	Status       Status
	Bugs         bool // Has known bugs
	Plugin       bool // If functionality is delivered by plugin.
	URL          string
	SinceVersion string
	Notes        string
}

// State is available in JS.
type State struct {
	Software        []Software
	Features        []Feature
	Implementations []Implementation
}

var database *bstore.DB

//go:embed api.json
var apiJSON []byte

//go:embed index.html
var indexHTML []byte

//go:embed index.js
var indexJS []byte

func mustParseAPI(api string, buf []byte) (doc sherpadoc.Section) {
	err := json.Unmarshal(buf, &doc)
	if err != nil {
		log.Fatalf("parsing api docs: %s", err)
	}
	return doc
}

func xcheckf(err error, format string, args ...any) {
	if err != nil {
		log.Fatalf("%s: %s", fmt.Sprintf(format, args...), err)
	}
}

func main() {
	log.SetFlags(0)
	var listenAddr string
	flag.StringVar(&listenAddr, "listenaddr", "localhost:8019", "address to listen on")
	flag.Usage = func() {
		log.Println("usage: implementations [flags]")
		flag.PrintDefaults()
		os.Exit(2)
	}
	flag.Parse()
	args := flag.Args()
	if len(args) != 0 {
		flag.Usage()
	}

	var err error
	database, err = bstore.Open(context.Background(), "implementations.db", nil, Software{}, Feature{}, Implementation{})
	xcheckf(err, "open database")

	http.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		html, err := os.ReadFile("index.html")
		if err != nil {
			html = indexHTML
		}
		js, err := os.ReadFile("index.js")
		if err != nil {
			js = indexJS
		}
		out := string(html)
		out = strings.ReplaceAll(out, "/* placeholder */", string(js))
		h := w.Header()
		h.Set("Content-Type", "text/html; charset=utf-8")
		h.Set("Cache-Control", "no-cache, max-age=0")
		w.Write([]byte(out))
	})

	apiDoc := mustParseAPI("api", apiJSON)
	version := "dev"                                              // xxx
	sherpaOpts := sherpa.HandlerOpts{AdjustFunctionNames: "none"} // todo: collector?
	apiHandler, err := sherpa.NewHandler("/api/", version, API{}, &apiDoc, &sherpaOpts)
	xcheckf(err, "making api handler")
	http.Handle("/api/", apiHandler)

	http.HandleFunc("/implementations.json", func(w http.ResponseWriter, r *http.Request) {
		state, err := API{}.State(r.Context())
		if err != nil {
			log.Printf("state: %v", err)
			http.Error(w, "500 - internal server error - "+err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		if err := json.NewEncoder(w).Encode(state); err != nil {
			log.Printf("writing json: %v", err)
		}
	})

	http.HandleFunc("/implementations.db", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/octet-stream")
		err := database.Read(r.Context(), func(tx *bstore.Tx) error {
			_, err := tx.WriteTo(w)
			return err
		})
		if err != nil {
			log.Printf("writing db: %v", err)
		}
	})

	log.Printf("listening on %s", listenAddr)
	log.Fatalln(http.ListenAndServe(listenAddr, nil))
}

type API struct{}

func (API) ImplementationSet(ctx context.Context, impl Implementation) (rimpl Implementation, rerr error) {
	impl.Updated = time.Now()
	if impl.ID == 0 {
		impl.Created = time.Time{}
		impl.Updated = time.Time{}
		err := database.Insert(ctx, &impl)
		return impl, err
	}

	err := database.Write(ctx, func(tx *bstore.Tx) error {
		o := Implementation{ID: impl.ID}
		if err := tx.Get(&o); err != nil {
			return fmt.Errorf("get implementation: %v", err)
		}
		impl.Created = o.Created
		impl.Updated = time.Now()
		err := tx.Update(&impl)
		rimpl = impl
		return err
	})
	return rimpl, err
}

func (API) ImplementationRemove(ctx context.Context, id int64) error {
	return database.Delete(ctx, &Implementation{ID: id})
}

func (API) SoftwareCreate(ctx context.Context, s Software) error {
	s.Created = time.Time{}
	s.Updated = time.Time{}
	for i, c := range s.ID {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || (i > 0 && c >= '0' && c <= '9')) {
			return fmt.Errorf("invalid id %q", s.ID)
		}
	}
	return database.Insert(ctx, &s)
}

func (API) SoftwareUpdate(ctx context.Context, s Software) error {
	return database.Write(ctx, func(tx *bstore.Tx) error {
		os := Software{ID: s.ID}
		if err := tx.Get(&os); err != nil {
			return fmt.Errorf("unknown software id %s", s.ID)
		}
		s.Created = os.Created
		s.Updated = time.Now()
		return tx.Update(&s)
	})
}

func (API) SoftwareRemove(ctx context.Context, id string) error {
	return database.Write(ctx, func(tx *bstore.Tx) error {
		_, err := bstore.QueryTx[Implementation](tx).FilterNonzero(Implementation{SoftwareID: id}).Delete()
		if err != nil {
			return fmt.Errorf("removing implementation details for software: %v", err)
		}
		return tx.Delete(&Software{ID: id})
	})
}

func (API) FeatureCreate(ctx context.Context, f Feature) error {
	begin := true
	for _, c := range f.ID {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || (!begin && c >= '0' && c <= '9') || (!begin && c == '.')) {
			return fmt.Errorf("invalid id %q", f.ID)
		}
		begin = c == '.'
	}
	f.Created = time.Time{}
	f.Updated = time.Time{}
	return database.Insert(ctx, &f)
}

func (API) FeatureUpdate(ctx context.Context, f Feature) error {
	return database.Write(ctx, func(tx *bstore.Tx) error {
		of := Feature{ID: f.ID}
		if err := tx.Get(&of); err != nil {
			return fmt.Errorf("unknown feature id %s", f.ID)
		}
		f.Created = of.Created
		f.Updated = time.Now()
		return tx.Update(&f)
	})
}

func (API) FeatureRemove(ctx context.Context, id string) error {
	return database.Write(ctx, func(tx *bstore.Tx) error {
		_, err := bstore.QueryTx[Implementation](tx).FilterNonzero(Implementation{FeatureID: id}).Delete()
		if err != nil {
			return fmt.Errorf("removing implementation details for feature: %v", err)
		}
		return tx.Delete(&Feature{ID: id})
	})
}

func (API) State(ctx context.Context) (State, error) {
	var state State
	err := database.Read(ctx, func(tx *bstore.Tx) error {
		var err error
		state.Software, err = bstore.QueryTx[Software](tx).List()
		if err != nil {
			return fmt.Errorf("reading software from database: %v", err)
		}
		state.Features, err = bstore.QueryTx[Feature](tx).List()
		if err != nil {
			return fmt.Errorf("reading features from database: %v", err)
		}
		state.Implementations, err = bstore.QueryTx[Implementation](tx).List()
		if err != nil {
			return fmt.Errorf("reading implementations from database: %v", err)
		}
		return nil
	})
	return state, err
}
