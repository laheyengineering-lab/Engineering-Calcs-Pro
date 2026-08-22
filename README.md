# Engineering Calcs Pro

**Practical engineering calculators and design tools for mechanical engineers, designers, machinists, and students.**

**Live Demo:** https://engineering-calcs-pro.vercel.app

---

## 📋 Purpose

Engineering Calcs Pro provides a collection of web-based calculators designed to streamline common engineering calculations. Whether you're working on fastener torque specifications, moment calculations, or other mechanical design tasks, this platform offers quick, reliable tools accessible directly from your browser.

---

## ✨ Available Calculators

### Currently Live
- **Moment Calculator** - Calculate torque from force and perpendicular distance
- **Bolt Torque Calculator** - Calculate tightening torque for threaded fasteners

### Coming Soon
- **Beam Deflection** - Structural analysis tool
- **Bearing PV** - Bearing performance calculations
- **Bolt Preload** - Fastener preload analysis
- **Stress Analysis** - Materials and stress calculations
- **Deep Drawing** - Manufacturing process simulations

---

## 🏗️ Project Layout

```
Engineering-Calcs-Pro/
├── index.html                    # Homepage with calculator directory
├── css/
│   └── style.css                # Responsive styling and themes
├── js/
│   ├── calculator-data.js        # Calculator metadata and catalog
│   ├── engineering-units.js      # Shared unit conversions + material data
│   ├── homepage.js               # Homepage search and display logic
│   ├── bolt-database.js          # Bolt sizes and thread data
│   ├── bolt-torque.js            # Bolt torque calculations
│   ├── moment.js                 # Moment/torque calculations
│   ├── stress-strain.js          # Stress/strain calculations
│   ├── shaft-torsion.js          # Shaft torsion calculations
│   ├── beam-deflection.js        # Beam deflection calculations
│   └── thermal-expansion.js      # Thermal expansion calculations
├── calculators/
│   ├── bolt-torque.html          # Bolt torque calculator page
│   ├── moment.html               # Moment calculator page
│   ├── stress-strain.html        # Stress/strain calculator page
│   ├── shaft-torsion.html        # Shaft torsion calculator page
│   ├── beam-deflection.html      # Beam deflection calculator page
│   └── thermal-expansion.html    # Thermal expansion calculator page
└── README.md                     # This file
```

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript (no frameworks)
- **Styling:** Custom CSS with responsive grid layouts
- **Hosting:** Vercel
- **Repository:** GitHub

### Key Features
- **Zero Dependencies:** Pure vanilla JavaScript—no npm packages or build tools required
- **Responsive Design:** Mobile-friendly layouts with CSS media queries
- **Search Functionality:** Built-in calculator search on homepage
- **Unit Conversion:** Support for multiple unit systems (metric, imperial)
- **Professional Styling:** Clean, modern UI with accessibility considerations

---

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- No installation or build process required

### Running Locally

**Option 1: Using Python**
```bash
# Clone the repository
git clone https://github.com/laheyengineering-lab/Engineering-Calcs-Pro.git
cd Engineering-Calcs-Pro

# Start a local server
python -m http.server 8000
```

**Option 2: Using Node.js**
```bash
# Clone the repository
git clone https://github.com/laheyengineering-lab/Engineering-Calcs-Pro.git
cd Engineering-Calcs-Pro

# Start a local server
npx http-server
```

Then open `http://localhost:8000` in your browser.

---

## 📚 How to Use

1. **Browse calculators** on the homepage—organized by category (Mechanical, Fasteners, Materials, Manufacturing)
2. **Search** for specific calculators using the search box
3. **Select a calculator** and enter your input parameters
4. **View results** with support for multiple output units
5. **Return** to the homepage to try another tool

---

## 🔗 Links

- **Live Site:** https://engineering-calcs-pro.vercel.app
- **Repository:** https://github.com/laheyengineering-lab/Engineering-Calcs-Pro
- **Issues & Requests:** https://github.com/laheyengineering-lab/Engineering-Calcs-Pro/issues

---

## 📝 License

This project is currently unlicensed. For licensing inquiries, please contact the repository owner.

---

## 🤝 Contributing

Contributions are welcome! If you have ideas for new calculators, bug fixes, or improvements:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

**Built with ❤️ by laheyengineering-lab**

*Empowering engineers with practical, accessible calculation tools.*
