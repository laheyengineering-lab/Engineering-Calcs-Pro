# Formula Foundry

**Calculate it. Explore it. Compare it. Explain it.**

Formula Foundry is a browser-based engineering workspace for engineers, designers, machinists, students, technicians, and makers. Calculate results, explore changes with live diagrams, compare options in Design Studies, and document decisions in Project Reports.

**Live site:** [engineering-calcs-pro.vercel.app](https://engineering-calcs-pro.vercel.app)

> **Actively developed.** Formula Foundry is evolving. Coverage, depth, and consistency vary between calculators, and results are aids to engineering judgment, not a substitute for it. Check assumptions and limits on each calculator page.

## What you can do today

- **Engineering calculators** cover mechanical, materials, fasteners, manufacturing, fluid mechanics, fluid power, thermal/HVAC, practical engineering, and electrical engineering. The searchable homepage includes 36 active calculators and three Coming Soon placeholders. [Calculator registry](js/calculator-data.js)
- **Electrical Engineering** includes ten introductory tools for DC circuits, voltage drop, RC and RL transients, AC impedance and power, and nominal speaker loads. Edit 2–12 resistors in Circuit Studio and explore a live schematic with branch measurements, conservation checks, and optional solution steps. [Electrical models and references](docs/electrical-calculators.md)
- **Engineering diagrams** show calculator systems and Design Study scenarios. Interactive graphics include keyboard-accessible geometry, load, and circuit controls.
- **Design Studies** supports all 36 active calculators. Save scenarios, compare results against a baseline, and sample continuous inputs within a chosen configuration.
- **Engineering Workflows** connect multiple calculations. Fluid System Designer solves series-pipe losses and pump duty, compares configurations, and sweeps flow rate. [Fluid System Designer guide](docs/fluid-system-workflow.md)
- **Project reports:** Collect calculator, study and workflow snapshots, annotate and reorder entries, export and import portable Project Report JSON, and print or save through the browser's print dialog. Formula Foundry does not generate PDF files itself.
- **Connected fluid calculations:** Explicitly send validated values from Pipe Flow to Pipe Pressure Drop and then Pump Hydraulic Power. Downstream values remain editable and reports retain transfer context.
- **Shared engineering utilities:** Centralized unit conversions and material data, common calculator helpers, shared SVG diagram utilities, and KaTeX equation rendering.
- **Static site:** Plain HTML, CSS, and JavaScript with no application framework or production build step.

## Development priorities

These are directions for continuing work, not commitments or release dates.

- Expand practical engineering calculator coverage.
- Improve consistency and engineering validation across calculators.
- Extend Design Studies to more calculators.
- Develop explanatory, interactive engineering diagrams.
- Improve comparison, documentation, and reporting workflows.

Anything not listed under "What you can do today" should be treated as planned or exploratory. See the [architecture guide](docs/calculator-architecture.md#architectural-philosophy-and-direction) for how the pieces are meant to fit together.

## Data and privacy

Calculations run in the browser; the project has no application backend or account-based storage. Design Studies and project reports are saved in this browser's `localStorage` (`formulaFoundry.designStudies` and `formulaFoundry.projectReport`). If browser storage is unavailable, they fall back to page-local memory, which is lost on reload or navigation; without working storage, report entries cannot be carried to the separate report page. Calculator form values are not persisted on their own. Design Study input edits are saved when changed, while study and calculator results are copied into project reports only when explicitly added. Fluid System Designer saves one workflow project with its named configurations under its own local storage key and supports portable workflow project JSON. Data is not synchronized between browsers.

The site loads KaTeX from a CDN to render equations. Hosting is static; no server-side calculation service is required.

## Run locally

The app is static. From the repository root, start a local HTTP server:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000). A local server is needed because the app loads scripts and catalog pages with relative URLs; opening `index.html` via `file://` can block them.

## Test

Node.js and npm are needed only for the test suite. Install the locked development dependencies and run Vitest:

```bash
npm ci
npm test
```

For watch mode, run `npm run test:watch`. There is no build command. See [`docs/testing.md`](docs/testing.md) for test organization and examples.

## Repository map

```text
index.html, about.html, references.html, methodology.html  Static site pages
calculators/                                               Calculator pages
workflows/fluid-system.html                                Fluid System Designer workspace
css/style.css                                              Shared site and calculator styles
css/studies.css, css/study-chart.css, css/report.css       Study, chart, and report styles
css/electrical.css                                         Electrical calculator layouts
js/                                                        Shared utilities and calculator scripts
design-studies.html, report.html                          Study and report workspaces
docs/                                                      Architecture and usage guides
tests/                                                     Vitest + jsdom tests
```

## Architecture and contribution guides

- [Calculator architecture](docs/calculator-architecture.md) — current application structure and integration points.
- [Calculator development guide](docs/calculator-development-guide.md) — adding calculators.
- [Interactive diagrams](docs/interactive-diagrams.md) — shared SVG framework and diagram patterns.
- [Design Studies](docs/design-studies.md) — adapters, scenario comparison, sweeps, persistence, and report integration.
- [Fluid System Designer](docs/fluid-system-workflow.md) — linked series piping analysis, sensitivity and report snapshots.
- [Project reporting](docs/reporting.md) — report snapshots and print workflow.
- [Fluid, thermal and practical calculators](docs/fluid-thermal-practical-calculators.md) — catalog, models, worked cases and transfer workflow.
- [Electrical engineering calculators](docs/electrical-calculators.md) — circuit topologies, worked cases, applicability, and sources.
- [Engineering units](docs/engineering-units.md) — shared conversion and material utilities.
- [Branding](docs/branding.md) — asset layout and usage.

Register new calculators in `js/calculator-data.js` and use `js/engineering-units.js` for shared units and materials. Design Studies adapters call DOM-free calculation engines and can share input and output definitions with calculator pages. [Calculator development guide](docs/calculator-development-guide.md)

## License

This project is currently unlicensed. Contact the repository owner for licensing inquiries.
