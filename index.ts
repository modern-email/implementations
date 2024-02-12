const client = new api.Client()

const errmsg = (err: unknown) => ''+((err as any).message || '(no error message)')

let popupOpen = false
const popup = (...kids: ElemArg[]) => {
	const origFocus = document.activeElement
	const close = () => {
		if (!root.parentNode) {
			return
		}
		popupOpen = false
		root.remove()
		if (origFocus && origFocus instanceof HTMLElement && origFocus.parentNode) {
			origFocus.focus()
		}
	}
	let content: HTMLElement
	const root = dom.div(
		style({position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0, 0, 0, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1}),
		function keydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				e.stopPropagation()
				close()
			}
		},
		function click(e: MouseEvent) {
			e.stopPropagation()
			close()
		},
		content=dom.div(
			attr.tabindex('0'),
			style({backgroundColor: 'white', borderRadius: '.25em', padding: '1em', boxShadow: '0 0 20px rgba(0, 0, 0, 0.1)', border: '1px solid #ddd', maxWidth: '95vw', overflowX: 'auto', maxHeight: '95vh', overflowY: 'auto'}),
			function click(e: MouseEvent) {
				e.stopPropagation()
			},
			kids,
		)
	)
	popupOpen = true
	document.body.appendChild(root)
	content.focus()
	return close
}

const formatDate = (d: Date) => d.toLocaleDateString() + ' ' + d.toLocaleTimeString()

// localstorage that ignores errors (e.g. in private mode).
const localStorageGet = (k: string) => {
	try {
		return JSON.parse(window.localStorage.getItem(k) || '')
	} catch (err) {
		return ''
	}
}
const localStorageSet = (k: string, v: any) => {
	try {
		window.localStorage.setItem(k, JSON.stringify(v))
	} catch (err) {}
}

const featurePopup = async (f: api.Feature, state: api.State, render: () => void) => {
	let fieldset: HTMLFieldSetElement
	let id: HTMLInputElement
	let title: HTMLInputElement
	let url: HTMLInputElement
	let description: HTMLTextAreaElement
	let server: HTMLInputElement
	let service: HTMLInputElement
	let library: HTMLInputElement
	let xclient: HTMLInputElement
	let desktop: HTMLInputElement
	let mobile: HTMLInputElement
	let web: HTMLInputElement
	let terminal: HTMLInputElement

	const close = popup(
		style({maxWidth: '50em'}),
		f.ID ? dom.div(
			style({textAlign: 'right'}),
			dom.clickbutton('Remove', async function click(e: MouseEvent) {
				if (window.confirm('Are you sure?')) {
					(e.target! as HTMLButtonElement).disabled = true
					try {
						await client.FeatureRemove(f.ID)
						const i = (state.Features || []).indexOf(f) as number
						(state.Features || []).splice(i, 1)
						render()
						close()
					} catch (err) {
						window.alert('Error: ' + errmsg(err))
					} finally {
						(e.target! as HTMLButtonElement).disabled = false
					}
				}
			})
		) : [],
		dom.h1(f.ID ? 'Edit feature' : 'New feature'),
		dom.p('A feature is either a protocol/standard, or specific functionality thereof, or behaviour of an application. Making a proper ontology of features is hard. Try to stick to existing naming conventions. IDs are hierarchical, dot-separated, with more specific functionality more deeply nested.'),
		dom.form(
			async function submit(e: SubmitEvent) {
				e.preventDefault()
				e.stopPropagation()

				try {
					fieldset.disabled = true
					const nf: api.Feature = {
						ID: id.value,
						Created: f.Created,
						Updated: new Date(),
						Title: title.value,
						URL: url.value,
						Description: description.value,
						Server: server.checked,
						Service: service.checked,
						Library: library.checked,
						Client: xclient.checked,
						Desktop: desktop.checked,
						Mobile: mobile.checked,
						Web: web.checked,
						Terminal: terminal.checked,
					}
					if (f.ID) {
						await client.FeatureUpdate(nf)
						const i = (state.Features || []).indexOf(f) as number
						(state.Features || []).splice(i, 1, nf)
					} else {
						await client.FeatureCreate(nf)
						if (!state.Features) {
							state.Features = []
						}
						state.Features.push(nf)
					}
					render()
					close()
				} catch (err) {
					window.alert('Error: '+errmsg(err))
				} finally {
					fieldset.disabled = false
				}
			},
			fieldset=dom.fieldset(
				dom.label(
					dom.div('ID *'),
					id=dom.input(attr.required(''), f.ID ? attr.disabled('') : [], attr.value(f.ID)),
					dom.div(dom._class('explain'), 'Use camelCase identifiers (a-zA-Z0-9 only, for use in JS), dot-separated (by topic). Example: dkim.ed25519.sign'),
				),
				dom.label(dom.div('Title *'), title=dom.input(attr.required(''), attr.value(f.Title))),
				dom.label(dom.div('URL'), url=dom.input(attr.value(f.URL))),
				dom.label(dom.div('Description'), description=dom.textarea(f.Description)),
				dom.br(),
				dom.div(dom._class('explain'), 'Indicate for which kind of software this feature is applicable. Filtering by these fields applies to both features and software. It helps keep the displayed matrix understandable. ', dom.clickbutton('Check all', function click() {
					for (const e of [server, service, library, xclient, desktop, mobile, web, terminal]) {
						e.checked = true
					}
				})),
				dom.label(server=dom.input(attr.type('checkbox'), f.Server ? attr.checked('') : []), ' Server', attr.title('Software that you can run as server.')),
				dom.label(service=dom.input(attr.type('checkbox'), f.Service ? attr.checked('') : []), ' Service', attr.title('Software that is (only) available as an online service, not for running separately.')),
				dom.label(library=dom.input(attr.type('checkbox'), f.Library ? attr.checked('') : []), ' Library'),
				dom.label(xclient=dom.input(attr.type('checkbox'), f.Client ? attr.checked('') : []), ' Client'),
				dom.label(desktop=dom.input(attr.type('checkbox'), f.Desktop ? attr.checked('') : []), ' Desktop'),
				dom.label(mobile=dom.input(attr.type('checkbox'), f.Mobile ? attr.checked('') : []), ' Mobile'),
				dom.label(web=dom.input(attr.type('checkbox'), f.Web ? attr.checked('') : []), ' Web'),
				dom.label(terminal=dom.input(attr.type('checkbox'), f.Terminal ? attr.checked('') : []), ' Terminal'),
				dom.br(),
				dom.div(dom.submitbutton(f.ID ? 'Save feature' : 'Add feature')),
				dom.br(),
				dom.div(dom._class('explain'), 'Required fields are marked with "*".'),
				f.ID ? dom.div('Last updated: ' + formatDate(f.Updated)) : [],
			),
		)
	)
	id.focus()
}

const softwarePopup = async (s: api.Software, state: api.State, render: () => void) => {
	let fieldset: HTMLFieldSetElement
	let id: HTMLInputElement
	let name: HTMLInputElement
	let url: HTMLInputElement
	let description: HTMLTextAreaElement
	let openSource: HTMLInputElement
	let license: HTMLInputElement
	let progLang: HTMLInputElement
	let distribution: HTMLInputElement
	let server: HTMLInputElement
	let service: HTMLInputElement
	let library: HTMLInputElement
	let xclient: HTMLInputElement
	let desktop: HTMLInputElement
	let mobile: HTMLInputElement
	let web: HTMLInputElement
	let terminal: HTMLInputElement

	const close = popup(
		style({maxWidth: '50em'}),
		s.ID ? dom.div(
			style({textAlign: 'right'}),
			dom.clickbutton('Remove', async function click(e: MouseEvent) {
				if (window.confirm('Are you sure?')) {
					(e.target! as HTMLButtonElement).disabled = true
					try {
						await client.SoftwareRemove(s.ID)
						const i = (state.Software || []).indexOf(s) as number
						(state.Software || []).splice(i, 1)
						render()
						close()
					} catch (err) {
						window.alert('Error: ' + errmsg(err))
					} finally {
						(e.target! as HTMLButtonElement).disabled = false
					}
				}
			})
		) : [],
		dom.h1(s.ID ? 'Edit software' : 'New software'),
		dom.form(
			async function submit(e: SubmitEvent) {
				e.preventDefault()
				e.stopPropagation()

				try {
					fieldset.disabled = true
					const ns: api.Software = {
						ID: id.value,
						Created: s.Created,
						Updated: new Date(),
						Name: name.value,
						URL: url.value,
						Description: description.value,
						OpenSource: openSource.checked,
						License: license.value,
						ProgLang: progLang.value,
						Distribution: distribution.checked,
						Server: server.checked,
						Service: service.checked,
						Library: library.checked,
						Client: xclient.checked,
						Desktop: desktop.checked,
						Mobile: mobile.checked,
						Web: web.checked,
						Terminal: terminal.checked,
					}
					if (s.ID) {
						await client.SoftwareUpdate(ns)
						const i = (state.Software || []).indexOf(s) as number
						(state.Software || []).splice(i, 1, ns)
					} else {
						await client.SoftwareCreate(ns)
						if (!state.Software) {
							state.Software = []
						}
						state.Software.push(ns)
					}
					render()
					close()
				} catch (err) {
					window.alert('Error: '+errmsg(err))
				} finally {
					fieldset.disabled = false
				}
			},
			fieldset=dom.fieldset(
				dom.div(
					dom.label(
						dom.div('ID *'),
						id=dom.input(attr.required(''), attr.value(s.ID), s.ID ? attr.disabled('') : []),
						dom.div(dom._class('explain'), 'Use camelCase identifiers (a-zA-Z0-9 only, for use in JS).'),
					),
				),
				dom.label(dom.div('Name *'), name=dom.input(attr.required(''), attr.value(s.Name))),
				dom.label(dom.div('URL'), url=dom.input(attr.value(s.URL))),
				dom.label(dom.div('Description'), description=dom.textarea(s.Description)),
				dom.label(openSource=dom.input(attr.type('checkbox'), s.OpenSource ? attr.checked('') : []), ' Open Source'),
				dom.label(dom.div('License'), license=dom.input(attr.value(s.License))),
				dom.label(dom.div('Programming language(s)'), progLang=dom.input(attr.value(s.ProgLang))),
				dom.label(distribution=dom.input(attr.type('checkbox'), s.Distribution ? attr.checked('') : []), ' Distribution (of other software packages)'),
				dom.br(),
				dom.div(dom._class('explain'), 'Indicate for which kind of software this is. Filtering by these fields applies to both features and software. It helps keep the displayed matrix understandable.'),
				dom.label(server=dom.input(attr.type('checkbox'), s.Server ? attr.checked('') : []), ' Server', attr.title('Software that you can run as server.')),
				dom.label(service=dom.input(attr.type('checkbox'), s.Service ? attr.checked('') : []), ' Service', attr.title('Software that is (only) available as an online service, not for running separately.')),
				dom.label(library=dom.input(attr.type('checkbox'), s.Library ? attr.checked('') : []), ' Library'),
				dom.label(xclient=dom.input(attr.type('checkbox'), s.Client ? attr.checked('') : []), ' Client'),
				dom.label(desktop=dom.input(attr.type('checkbox'), s.Desktop ? attr.checked('') : []), ' Desktop'),
				dom.label(mobile=dom.input(attr.type('checkbox'), s.Mobile ? attr.checked('') : []), ' Mobile'),
				dom.label(web=dom.input(attr.type('checkbox'), s.Web ? attr.checked('') : []), ' Web'),
				dom.label(terminal=dom.input(attr.type('checkbox'), s.Terminal ? attr.checked('') : []), ' Terminal'),
				dom.br(),
				dom.div(dom.submitbutton(s.ID ? 'Save software' : 'Add software')),
				dom.br(),
				dom.div(dom._class('explain'), 'Required fields are marked with "*".'),
				s.ID ? dom.div('Last updated: ' + formatDate(s.Updated)) : [],
			),
		)
	)
	id.focus()
}

const implementationPopup = (s: api.Software, f: api.Feature, implementations: Map<string, api.Implementation>, render: () => void) => {
	const key = s.ID + ',' + f.ID
	const impl = implementations.get(key)

	let fieldset: HTMLFieldSetElement
	let bugs: HTMLInputElement
	let plugin: HTMLInputElement
	let url: HTMLInputElement
	let sinceVersion: HTMLInputElement
	let notes: HTMLTextAreaElement

	const save = async () => {
		try {
			fieldset.disabled = true
			let nimpl: api.Implementation = {
				ID: impl?.ID || 0,
				Updated: new Date(),
				SoftwareID: s.ID,
				FeatureID: f.ID,
				Status: (fieldset.querySelector('input[name="status"]:checked') as HTMLInputElement).value as api.Status,
				Bugs: bugs.checked,
				Plugin: plugin.checked,
				URL: url.value,
				SinceVersion: sinceVersion.value,
				Notes: notes.value,
			}
			nimpl = await client.ImplementationSet(nimpl)
			implementations.set(key, nimpl)
			render()
			close()
		} catch (err) {
			window.alert('Error: ' + errmsg(err))
		} finally {
			fieldset.disabled = false
		}
	}

	const close = popup(
		style({maxWidth: '50em'}),
		dom.h1('Implementation'),
		dom.div('Software ID: ' + s.ID),
		dom.div('Feature ID: ' + f.ID),
		dom.br(),
		dom.form(
			function submit(e: SubmitEvent) {
				e.preventDefault()
				e.stopPropagation()
				save()
			},
			fieldset=dom.fieldset(
				dom.b('Status'),
				dom.div(dom._class('explain'), 'Double click to immediately save and close the popup.'),
				dom.div(
					function dblclick() {
						save()
					},
					dom.label(dom.input(attr.type('radio'), attr.name('status'), attr.value(api.Status.Yes), impl?.Status === api.Status.Yes ? attr.checked('') : []), ' ', api.Status.Yes),
					dom.label(dom.input(attr.type('radio'), attr.name('status'), attr.value(api.Status.Partial), impl?.Status === api.Status.Partial ? attr.checked('') : []), ' ', api.Status.Partial),
					dom.label(dom.input(attr.type('radio'), attr.name('status'), attr.value(api.Status.Planned), impl?.Status === api.Status.Planned ? attr.checked('') : []), ' ', api.Status.Planned),
					dom.label(dom.input(attr.type('radio'), attr.name('status'), attr.value(api.Status.No), impl?.Status === api.Status.No ? attr.checked('') : []), ' ', api.Status.No),
					dom.label(dom.input(attr.type('radio'), attr.name('status'), attr.value(api.Status.Never), impl?.Status === api.Status.Never ? attr.checked('') : []), ' ', api.Status.Never),
					dom.label(dom.input(attr.type('radio'), attr.name('status'), attr.value(api.Status.NotApplicable), impl?.Status === api.Status.NotApplicable ? attr.checked('') : []), ' N/A'),
					dom.label(dom.input(attr.type('radio'), attr.name('status'), attr.value(api.Status.Unknown), impl?.Status === api.Status.Unknown ? attr.checked('') : []), ' ', 'Unknown'),
				),
				dom.br(),
				dom.label(bugs=dom.input(attr.type('checkbox'), impl?.Bugs ? attr.checked('') : []), ' Known bugs'),
				dom.label(plugin=dom.input(attr.type('checkbox'), impl?.Plugin ? attr.checked('') : []), ' Support through plugin'),
				dom.br(),
				dom.label(dom.div('URL'), url=dom.input(attr.value(impl?.URL || ''))),
				dom.label(dom.div('Since version'), sinceVersion=dom.input(attr.value(impl?.SinceVersion || ''))),
				dom.label(dom.div('Notes'), notes=dom.textarea(impl?.Notes || '')),
				dom.br(),
				dom.div(dom.submitbutton('Save')),
				dom.br(),
				impl?.ID ? dom.div('Last updated: ' + formatDate(impl.Updated)) : [],
			)
		)
	)
}

const isRelevant = (s: api.Software, f: api.Feature) => {
	const opts = [
		[s.Server, f.Server],
		[s.Service, f.Service],
		[s.Library, f.Library],
		[s.Client, f.Client],
		[s.Desktop, f.Desktop],
		[s.Web, f.Web],
		[s.Terminal, f.Terminal],
		[s.Mobile, f.Mobile],
	]
	for (const t of opts) {
		if (t[0] && t[1]) {
			return true
		}
	}
	return false
}

const init = async () => {
	const state = await client.State()
	const implementations = new Map<string, api.Implementation>()
	;(state.Implementations || []).forEach(impl => {
		implementations.set(impl.SoftwareID+','+impl.FeatureID, impl)
	})
	console.log(state)

	let table: HTMLElement

	let search: HTMLInputElement
	let featureMatch: HTMLInputElement
	let softwareIDs: HTMLInputElement
	let filterServer: HTMLInputElement
	let filterService: HTMLInputElement
	let filterLibrary: HTMLInputElement
	let filterClient: HTMLInputElement
	let filterDesktop: HTMLInputElement
	let filterMobile: HTMLInputElement
	let filterWeb: HTMLInputElement
	let filterTerminal: HTMLInputElement
	let detailsFeatures: HTMLInputElement
	let detailsSoftware: HTMLInputElement

	let featureIDs: HTMLInputElement
	let paint: HTMLSelectElement

	const makeStatus = (s: api.Software, f: api.Feature) => {
		const k = s.ID+','+f.ID
		const impl = implementations.get(k)
		const status = impl?.Status || api.Status.Unknown
		return dom.td(
			dom._class('status'),
			dom._class(status.replace('n/a', 'na').toLowerCase() || 'unknown'),
			impl?.Bugs ? style({borderColor: 'red'}) : [],
			impl?.Plugin ? style({borderStyle: 'dashed'}) : [],
			async function click() {
				if (statusPaint === undefined) {
					implementationPopup(s, f, implementations, render)
					return
				}
				const origStatus = impl?.Status
				let nimpl: api.Implementation = impl || {
					ID: 0,
					SoftwareID: s.ID,
					FeatureID: f.ID,
					Updated: new Date(),
					Status: statusPaint,
					Bugs: false,
					Plugin: false,
					URL: '',
					SinceVersion: '',
					Notes: '',
				}
				nimpl.Status = statusPaint
				try {
					nimpl = await client.ImplementationSet(nimpl)
				} catch (err) {
					window.alert('Error: ' + errmsg(err))
					if (origStatus !== undefined) {
						nimpl.Status = origStatus
					}
					return
				}
				if (!impl) {
					implementations.set(k, nimpl)
				}
				render()
				return
			},
			impl?.Notes ? attr.title('Notes: ' + impl?.Notes) : [],
			status === api.Status.Unknown && isRelevant(s, f) ? '?' : status,
		)
	}

	interface filterable {
		Server: boolean
		Service: boolean
		Library: boolean
		Client: boolean
		Desktop: boolean
		Mobile: boolean
		Web: boolean
		Terminal: boolean
	}
	const checkFilters = (e: filterable) => {
		return (!filterServer.checked || e.Server) &&
			(!filterService.checked || e.Service) &&
			(!filterLibrary.checked || e.Library) &&
			(!filterClient.checked || e.Client) &&
			(!filterDesktop.checked || e.Desktop) &&
			(!filterMobile.checked || e.Mobile) &&
			(!filterWeb.checked || e.Web) &&
			(!filterTerminal.checked || e.Terminal)
	}

	const updateHash = () => {
		const qs = new URLSearchParams()
		const input = (e: HTMLInputElement, k: string) => {
			if (e.value) {
				qs.set(k, e.value)
			}
		}
		const checkbox = (e: HTMLInputElement, k: string) => {
			if (e.checked) {
				qs.set(k, '')
			}
		}
		input(search, 'text')
		input(featureMatch, 'feats')
		input(softwareIDs, 'software')
		checkbox(filterServer, 'server')
		checkbox(filterService, 'service')
		checkbox(filterLibrary, 'library')
		checkbox(filterClient, 'client')
		checkbox(filterDesktop, 'desktop')
		checkbox(filterMobile, 'mobile')
		checkbox(filterWeb, 'web')
		checkbox(filterTerminal, 'terminal')
		checkbox(detailsFeatures, 'detailfeats')
		checkbox(detailsSoftware, 'detailsoftware')
		let s = qs.toString()
		if (!s) {
			s = '#'+s
		}
		window.location.hash = s

		localStorageSet('featureids', featureIDs.checked)
	}

	const loadFromHash = () => {
		const qs = new URLSearchParams(decodeURIComponent(window.location.hash.substring(1) || ''))
console.log('qs', qs)
		search.value = qs.get('text') || ''
		featureMatch.value = qs.get('feats') || ''
		softwareIDs.value = qs.get('software') || ''
		filterServer.checked = qs.has('server')
		filterService.checked = qs.has('service')
		filterLibrary.checked = qs.has('library')
		filterClient.checked = qs.has('client')
		filterDesktop.checked = qs.has('desktop')
		filterMobile.checked = qs.has('mobile')
		filterWeb.checked = qs.has('web')
		filterTerminal.checked = qs.has('terminal')
		detailsFeatures.checked = qs.has('detailfeats')
		detailsSoftware.checked = qs.has('detailsoftware')
	}

	const changed = () => {
		updateHash()
		render()
	}

	const render = () => {
		console.log('render', state)
		const textSearch = search.value.toLowerCase()
		const matchTextFeature = (f: api.Feature) => {
			if (!textSearch) {
				return true
			}
			const x = f as any
			for (const k in x) {
				if (typeof x[k] === 'string' && x[k].toLowerCase().includes(textSearch)) {
					return true
				}
			}
			for (const [_, impl] of implementations) {
				if (f.ID !== impl.FeatureID) {
					continue
				}
				const y = impl as any
				for (const k in y) {
					if (typeof y[k] === 'string' && y[k].toLowerCase().includes(textSearch)) {
						return true
					}
				}
			}
			return false
		}
		let softIDs: Set<string> | undefined
		if (softwareIDs.value) {
			softIDs = new Set<string>()
			for (const id of softwareIDs.value.split(',')) {
				softIDs.add(id)
			}
		}
		const software = (state.Software || []).filter(s => checkFilters(s) && (!softIDs || softIDs.has(s.ID)))
		const featregex = featureMatch.value ? new RegExp(featureMatch.value) : undefined
		const features = (state.Features || []).filter(f => checkFilters(f) && (!featregex || featregex.test(f.ID)) && matchTextFeature(f))
		software.sort((a: api.Software, b: api.Software) => a.ID < b.ID ? -1 : 1)
		features.sort((a: api.Feature, b: api.Feature) => a.ID < b.ID ? -1 : 1)
		const ntable = dom.table(
			dom.tr(
				dom.td(
					style({verticalAlign: 'bottom', textAlign: 'right', fontWeight: 'bold'}),
					'Features ', dom.clickbutton('+', attr.title('Add feature'), function click() {
						const nf: api.Feature = {
							ID: '',
							Created: new Date(),
							Updated: new Date(),
							Title: '',
							URL: '',
							Description: '',
							Server: false,
							Service: false,
							Library: false,
							Client: false,
							Desktop: false,
							Web: false,
							Terminal: false,
							Mobile: false,
						}
						featurePopup(nf, state, render)
					}),
					' \\ Software ', dom.clickbutton('+', attr.title('Add software'), function click() {
						const ns: api.Software = {
							ID: '',
							Created: new Date(),
							Updated: new Date(),
							Name: '',
							URL: '',
							Description: '',
							OpenSource: false,
							License: '',
							ProgLang: '',
							Distribution: false,
							Server: false,
							Service: false,
							Library: false,
							Client: false,
							Desktop: false,
							Web: false,
							Terminal: false,
							Mobile: false,
						}
						softwarePopup(ns, state, render)
					}),
				),
				detailsFeatures.checked ? dom.td() : [],
				software.map(s =>
					dom.td(
						dom._class('software'),
						dom._class('rotate'),
						function click() {
							softwarePopup(s, state, render)
						},
						dom.div(
							dom.span(s.Name, attr.title(s.ID + (s.Description ? ': ' + s.Description : ''))),
						)
					)
				),
			),
			detailsSoftware.checked ? dom.tr(
				dom.td(),
				detailsFeatures.checked ? dom.td() : [],
				software.map(s => dom.td(
					style({maxWidth: '20em', fontSize: '.8em'}),
					dom.div('ID: ' + s.ID),
					s.Description ? dom.div(s.Description) : [],
					s.URL ? dom.div(dom.a(attr.href(s.URL), attr.rel('noopener noreferrer'), s.URL)) : [],
					s.OpenSource ? dom.div('Open source') : [],
					s.License ? dom.div('License: ' + s.License) : [],
					s.ProgLang ? dom.div('Programming language(s): ' + s.ProgLang) : [],
					dom.div('Kind: ', Object.entries({Server: s.Server, Service: s.Service, Library: s.Library, Client: s.Client, Desktop: s.Desktop, Mobile: s.Mobile, Web: s.Web, Terminal: s.Terminal}).filter(t => t[1]).map(t => t[0]).join(', ')),
				)),
			) : [],
			features.map(f =>
				dom.tr(
					detailsFeatures.checked ? dom.td(
						style({maxWidth: '20em', fontSize: '.8em'}),
						featureIDs.checked ? dom.div(f.Title) : dom.div('ID: ' + f.ID),
						f.Description ? dom.div(f.Description) : [],
						f.URL ? dom.div(dom.a(attr.href(f.URL), attr.rel('noopener noreferrer'), f.URL)) : [],
					) : [],
					dom.td(
						dom._class('feature'),
						function click() {
							featurePopup(f, state, render)
						},
						dom.span(featureIDs.checked ? f.ID : f.Title, attr.title((featureIDs.checked ? f.Title : f.ID)+ (f.Description ? ': '+f.Description : ''))),
					),
					software.map(s =>
						makeStatus(s, f)
					),
				),
			),
		)
		table.replaceWith(ntable)
		table = ntable
	}

	dom._kids(document.body,
		dom.div(
			dom.div(
				style({padding: '.5em'}),
				search=dom.input(attr.placeholder('Free-form feature search...'), function change() { changed() }), ' ',
				dom.span('Filters: ', attr.title('Filter displayed features and software. Useful for making manageable views for certain type of software, or aspects of implementations (feature sets).')),
				dom.label(filterServer=dom.input(attr.type('checkbox'), function change() { changed() }), ' Server'), ' ',
				dom.label(filterService=dom.input(attr.type('checkbox'), function change() { changed() }), ' Service'), ' ',
				dom.label(filterLibrary=dom.input(attr.type('checkbox'), function change() { changed() }), ' Library'), ' ',
				dom.label(filterClient=dom.input(attr.type('checkbox'), function change() { changed() }), ' Client'), ' ',
				dom.label(filterDesktop=dom.input(attr.type('checkbox'), function change() { changed() }), ' Desktop'), ' ',
				dom.label(filterMobile=dom.input(attr.type('checkbox'), function change() { changed() }), ' Mobile'), ' ',
				dom.label(filterWeb=dom.input(attr.type('checkbox'), function change() { changed() }), ' Web'), ' ',
				dom.label(filterTerminal=dom.input(attr.type('checkbox'), function change() { changed() }), ' Terminal'), ' ',
				featureMatch=dom.input(attr.placeholder('Regexp on feature IDs...'), function change() { changed() }), ' ',
				softwareIDs=dom.input(attr.placeholder('Software IDs, comma-separate...'), function change() { changed() }), ' ',
				'Show details: ',
				dom.label(detailsFeatures=dom.input(attr.type('checkbox'), function change() { changed() }), ' Features', attr.title('Displays extra column with details about each feature.')), ' ',
				dom.label(detailsSoftware=dom.input(attr.type('checkbox'), function change() { changed() }), ' Software', attr.title('Displays extra row with details about each software package.')), ' ',
				dom.clickbutton('About', function click() {
					popup(
						style({maxWidth: '50em'}),
						dom.h1('Implementations'),
						dom.p("This page allows tracking software and their features. Features can be protocols and standards, or behaviours. Software exists in various forms: servers vs clients, libraries vs applications, desktop vs mobile vs web vs terminal."),
						dom.p("The goals is keep an overview of software that implements (or does not implement) certain protocols/standards. This is useful for developers when they want to test for interoperability. It may also proof useful in the future to coordinate moving the ecosystem forward."),
						dom.p("Use the filters to drill down to the relevant software and/or features. Hit return in a text field after changing it to apply the updated filters."),
						dom.p("Anyone can make changes. Please stick to the suggested naming schemes, or the database will become a mess. Information does not have to be complete, don't skip making changes because you don't have (time to gather more) complete information. Time will tell how this information is used and how complete it should be."),
						dom.p('Making a good ontology of "features" is a difficult task. Different users have different needs. It may be good to differentiate between standards/protocols and optional/required behaviours, and between behaviours that applications choose on their own.'),
						dom.p('Add/remove/edit features and software. Click on a cell in the matrix/table to change the implementation status of a feature for the software. Use the "paint status" function to quickly set many statuses. Keyboard keys 1 and onwards select a status. Escape cancels.'),
						dom.p('The data is licensed under ', dom.a(attr.href('https://creativecommons.org/publicdomain/zero/1.0/'), attr.rel('noopener norefererer'), 'CC0'), ', i.e. public domain. The ', dom.a(attr.href('https://github.com/mjl-/implementations'), attr.rel('noopener norefererer'), 'code'), ' is licensed under MIT license.'),
					)
				}), ' ',
				dom.label(featureIDs=dom.input(attr.type('checkbox'), localStorageGet('featureids') ? attr.checked('') : [], function change() { changed() }), ' Feature IDs, not titles', attr.title('Show IDs of features in the first column, instead of titles. Can be easier when editing and finding the correct IDs to use.')), ' ',
				paint=dom.select(
					style({position: 'fixed', right: '1em'}),
					attr.title('Select a status to switch to a mode where every click in the matrix saves the status. A quick way to make many changes. Use keyboard shortcuts from 1 onwards to enable a status, and Escape to disable.'),
					function change() { paintChanged() },
					dom.option('Paint status...', attr.value('')),
					dom.option('Yes'),
					dom.option('Partial'),
					dom.option('Planned'),
					dom.option('No'),
					dom.option('Never'),
					dom.option('N/A', attr.value('n/a')),
					dom.option('Unknown', attr.value('?')),
				),
			),
			table=dom.table(),
		)
	)

	window.addEventListener('hashchange', () => {
		loadFromHash()
		render()
	})

	loadFromHash()
	render()

	let styleElem: HTMLStyleElement = dom.style('td.status { cursor: crosshair !important; }')
	let statusPaint: api.Status | undefined
	const paintChanged = () => {
		if (paint.value) {
			if (!statusPaint) {
				document.head.appendChild(styleElem)
			}
			statusPaint = paint.value === '?' ? api.Status.Unknown : (paint.value as api.Status)
		} else {
			statusPaint = undefined
			styleElem.remove()
		}
	}
	const statusKeys: { [k: string]: api.Status } = {
		'1': api.Status.Yes,
		'2': api.Status.Partial,
		'3': api.Status.Planned,
		'4': api.Status.No,
		'5': api.Status.Never,
		'6': api.Status.NotApplicable,
		'7': api.Status.Unknown,
	}
	document.addEventListener('keyup', (e) => {
		if (e.key in statusKeys) {
			paint.value = statusKeys[e.key] || '?'
			paintChanged()
		} else if (statusPaint && e.code === 'Escape') {
			paint.value = ''
			paintChanged()
		}
	})
}

window.addEventListener('load', async () => {
	try {
		await init()
	} catch (err) {
		window.alert('Error: ' + errmsg(err))
	}
})
