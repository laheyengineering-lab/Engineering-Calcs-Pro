# Engineering Calcs Pro

**A growing collection of professional-grade, browser-based engineering calculators for mechanical engineers, designers, machinists, and students.**

**Live Demo:** [https://engineering-calcs-pro.vercel.app](https://engineering-calcs-pro.vercel.app)

---

## 📋 Project Purpose

Engineering Calcs Pro provides fast, reliable engineering calculation tools that run entirely in the browser—no installation, no backend, no dependencies. Each calculator is built to handle real engineering inputs across metric and imperial unit systems, and draws from a shared engineering core library for consistent unit conversions and material data.

The goal is to make fundamental mechanical engineering calculations accessible to anyone: a seasoned engineer who needs a quick sanity check, a student working through a problem set, or a designer validating a fastener choice on the floor.

---

## ✨ Key Features

| Feature | Details |
|---|---|
| **Zero Dependencies** | Pure vanilla HTML, CSS, and JavaScript—no npm, no build step, no frameworks |
| **Dual Unit Systems** | Full metric and imperial support across all calculators |
| **Shared Engineering Core** | Centralized unit conversion and material database (`js/engineering-units.js`) |
| **Responsive Design** | Mobile-friendly layouts with CSS grid and media queries |
| **Searchable Homepage** | Built-in search to quickly find any calculator |
| **Instant Results** | Calculations update in real time from form inputs |
| **Professional UI** | Clean, consistent styling with accessibility in mind |

---

## 🧮 Calculator Categories

### ⚙️ Mechanical

| Calculator | Description | Status |
|---|---|---|
| **Moment Calculator** | Torque from force and perpendicular distance | ✅ Live |
| **Beam Deflection** | Structural beam deflection under load | ✅ Live |
| **Shaft Torsion** | Shear stress and angle of twist for shafts | ✅ Live |

### 🔩 Fasteners

| Calculator | Description | Status |
|---|---|---|
| **Bolt Torque** | Tightening torque for threaded fasteners (metric and imperial) | ✅ Live |
| **Bolt Preload** | Fastener preload and clamping force analysis | 🔜 Coming Soon |

### 🧱 Materials

| Calculator | Description | Status |
|---|---|---|
| **Stress-Strain** | Stress and strain from load and geometry | ✅ Live |
| **Thermal Expansion** | Linear thermal expansion for common engineering materials | ✅ Live |
| **Bearing PV** | Bearing performance (pressure × velocity) | 🔜 Coming Soon |

### 🏭 Manufacturing

| Calculator | Description | Status |
|---|---|---|
| **Deep Drawing** | Sheet metal forming / draw ratio calculations | 🔜 Coming Soon |

---

## 🏗️ Repository Structure

```
Engineering-Calcs-Pro/
├── index.html                      # Homepage with searchable calculator directory
├── css/
│   └── style.css                   # Responsive styling and visual themes
├── js/
│   ├── engineering-units.js        # Shared engineering core: unit conversions + material database
│   ├── calculator-data.js          # Calculator catalog metadata (titles, categories, links)
│   ├── homepage.js                 # Homepage search and card rendering logic
│   ├── bolt-database.js            # Bolt size and thread pitch tables (metric + imperial)
│   ├── bolt-torque.js              # Bolt torque calculation logic
│   ├── moment.js                   # Moment/torque calculation logic
│   ├── stress-strain.js            # Stress and strain calculation logic
│   ├── shaft-torsion.js            # Shaft torsion calculation logic
│   ├── beam-deflection.js          # Beam deflection calculation logic
│   └── thermal-expansion.js        # Thermal expansion calculation logic
├── calculators/
│   ├── bolt-torque.html            # Bolt torque calculator page
│   ├── moment.html                 # Moment calculator page
│   ├── stress-strain.html          # Stress-strain calculator page
│   ├── shaft-torsion.html          # Shaft torsion calculator page
│   ├── beam-deflection.html        # Beam deflection calculator page
│   └── thermal-expansion.html      # Thermal expansion calculator page
├── docs/
│   └── engineering-units.md        # Detailed documentation for the shared engineering core
└── README.md                       # This file
```

---

## 🔧 How the App Is Organized

Each calculator is a self-contained HTML page inside `calculators/`. The page loads:

1. **`js/engineering-units.js`** — the shared engineering core (loaded first, available globally)
2. Any calculator-specific support files (e.g., `bolt-database.js`)
3. The calculator logic script (e.g., `bolt-torque.js`)

This layered loading ensures every calculator has access to consistent unit conversions and material property data without duplicating that logic.

### Shared Engineering Core

`js/engineering-units.js` is the foundation of the app. It provides:

- **Unit conversion tables** for force, length, moment, stress, area moment of inertia, distributed load, and temperature
- **Conversion helper functions** (`convertForce`, `convertDistance`, `convertMoment`, `convertStress`, etc.)
- **Material property database** with engineering data for carbon steel, stainless steel, aluminum, copper, brass, titanium, mild steel, high-strength steel, cast iron, and magnesium
- **Material utility functions** (`getMaterial`, `getMaterialProperty`, `getMaterialList`, `getMaterialListFormatted`)

> 📄 For full documentation on `engineering-units.js`, see [`docs/engineering-units.md`](docs/engineering-units.md).

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Styling:** Custom CSS with responsive grid layouts
- **Hosting:** [Vercel](https://vercel.com)
- **Source Control:** GitHub

No build pipeline, no package manager, no transpiler. Open a file and it works.

---

## 🚀 Getting Started

### Prerequisites

- Any modern web browser (Chrome, Firefox, Safari, Edge)
- No installation required

### Run Locally

**Using Python:**
```bash
git clone https://github.com/laheyengineering-lab/Engineering-Calcs-Pro.git
cd Engineering-Calcs-Pro
python -m http.server 8000
```

**Using Node.js:**
```bash
git clone https://github.com/laheyengineering-lab/Engineering-Calcs-Pro.git
cd Engineering-Calcs-Pro
npx http-server
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

> **Note:** A local server is required because the calculators load JavaScript files via relative paths. Opening `index.html` directly from the filesystem (using a `file://` URL) will block those script loads in most browsers.

---

## 📚 How to Use

1. **Open the homepage** — browse or search for a calculator
2. **Select a calculator** — click to open the dedicated page
3. **Choose your unit system** — metric or imperial, depending on your inputs
4. **Enter your values** — fill in the required fields
5. **Read the results** — output is shown instantly with unit labels
6. **Return to the homepage** to run another calculation

---

## 🔗 Links

- **Live Site:** [https://engineering-calcs-pro.vercel.app](https://engineering-calcs-pro.vercel.app)
- **Repository:** [https://github.com/laheyengineering-lab/Engineering-Calcs-Pro](https://github.com/laheyengineering-lab/Engineering-Calcs-Pro)
- **Engineering Core Docs:** [`docs/engineering-units.md`](docs/engineering-units.md)
- **Issues & Feature Requests:** [https://github.com/laheyengineering-lab/Engineering-Calcs-Pro/issues](https://github.com/laheyengineering-lab/Engineering-Calcs-Pro/issues)

---

## 📝 License

This project is currently unlicensed. For licensing inquiries, please contact the repository owner.

---

## 🤝 Contributing

Contributions are welcome. If you have ideas for new calculators, bug fixes, or improvements:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Open a Pull Request against `main`

When adding a new calculator, load `js/engineering-units.js` first in your HTML so the shared unit and material infrastructure is available to your calculator script.

---

**Built by [laheyengineering-lab](https://github.com/laheyengineering-lab)**

*Practical engineering tools, available anywhere.*
