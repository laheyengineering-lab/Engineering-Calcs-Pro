# Formula Foundry

Formula Foundry is a browser-based engineering calculator platform for mechanical engineers, designers, machinists, and students. It combines standalone calculators with interactive diagrams, Design Studies, and print-ready project reports.

**Live site:** [engineering-calcs-pro.vercel.app](https://engineering-calcs-pro.vercel.app)

## Features

- **Engineering calculators:** 18 active calculators covering mechanical, materials, fastener, and manufacturing topics. The searchable homepage catalog also marks three planned calculators as Coming Soon; see [`js/calculator-data.js`](js/calculator-data.js) for the current catalog.
- **Interactive diagrams:** Beam Deflection diagrams show supported beam/load cases and let users explore span and, where applicable, load through accessible controls. Beam Bending Stress diagrams show section geometry and axes. Diagram shapes are explanatory, not additional calculation models.
- **Design Studies:** Save calculator scenarios, compare calculated scenarios against a baseline, and sweep supported continuous inputs to explore model results. Adapters currently support seven calculators. Sweeps are calculations at sampled values, not physical tests.
- **Project reports:** Collect calculator and study snapshots, annotate and reorder entries, and print or save through the browser's print dialog. Formula Foundry does not generate PDF files itself.
- **Shared engineering utilities:** Centralized unit conversions and material data, common calculator helpers, shared SVG diagram utilities, and KaTeX equation rendering.
- **Responsive static site:** Plain HTML, CSS, and JavaScript with no application framework or production build step.

## Data and privacy

Calculations run in the browser; the project has no application backend or account-based storage. Design Studies and project reports are saved in this browser's `localStorage` (`formulaFoundry.designStudies` and `formulaFoundry.projectReport`); if browser storage is unavailable, those features fall back to memory for the current session. Calculator form values are not persisted on their own; studies and report entries are saved as snapshots when users add them. Data is not synchronized between browsers.

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
css/style.css                                              Shared site and calculator styles
css/studies.css, css/study-chart.css, css/report.css       Study, chart, and report styles
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
- [Project reporting](docs/reporting.md) — report snapshots and print workflow.
- [Engineering units](docs/engineering-units.md) — shared conversion and material utilities.
- [Branding](docs/branding.md) — asset layout and usage.

New calculators should be registered in `js/calculator-data.js` and use `js/engineering-units.js` for shared engineering units and materials. To make a calculator available in Design Studies, provide a DOM-free calculation entry point and integrate it through `js/design-study-adapters.js`; see the linked guides for details.

## License

This project is currently unlicensed. Contact the repository owner for licensing inquiries.

## Suggested GitHub repository description

> Browser-based engineering calculators with interactive diagrams, Design Studies for scenario comparisons and parametric sweeps, and print-ready project reports. Static HTML, CSS, and JavaScript; calculations and saved studies stay in your browser.
