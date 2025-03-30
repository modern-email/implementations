default: build
	./implementations

build: build0 index.js
	# rebuild after new api.json
	CGO_ENABLED=0 go build

build0:
	CGO_ENABLED=0 go build
	CGO_ENABLED=0 go vet
	CGO_ENABLED=0 go run vendor/github.com/mjl-/sherpadoc/cmd/sherpadoc/*.go -adjust-function-names none API >api.json
	./gents.sh api.json api.ts

check:
	GOARCH=386 CGO_ENABLED=0 go vet
	staticcheck

check-shadow:
	go vet -vettool=$$(which shadow) ./... 2>&1 | grep -v '"err"'

index.js: node_modules/.bin/tsc api.ts lib.ts index.ts
	./tsc.sh $@ api.ts lib.ts index.ts

jswatch:
	bash -c 'while true; do inotifywait -q -e close_write *.ts; make index.js; done'

node_modules/.bin/tsc:
	-mkdir -p node_modules/.bin
	npm ci --ignore-scripts

jsinstall: node_modules/.bin/tsc

jsinstall0:
	-mkdir -p node_modules/.bin
	npm install --ignore-scripts --save-dev --save-exact typescript@5.1.6

fmt:
	go fmt ./...
	gofmt -w -s *.go
