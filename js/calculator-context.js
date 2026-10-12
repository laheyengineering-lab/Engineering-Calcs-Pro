/* Calculator context (mobile information hierarchy).
   Builds a compact "calculation context" block after the page header: the
   header description is left in place, followed by the calculator's governing
   equation(s) and main inputs, then a link to the full theory.
   Equations and inputs come from the SUMMARIES registry below, keyed by page
   slug. Each entry mirrors the calculator's own theory column and calculation
   script; it is never computed. Pages without an entry fall back to the single
   theory equation (if exactly one) and the form labels.
   Presentation only: no calculation, input or result logic lives here.
   Equations are written as \[ \] LaTeX and rendered by js/katex-loader.js.
   The block is hidden on desktop, where the theory column is already visible. */
(function() {
    // eq: [{ tex, text }] (text is the plain-text fallback / accessible name)
    // inputs: [[symbolTeX, description, units]]
    const SUMMARIES = {
        'moment': {
            eq: [{ tex: 'M = F d', text: 'M = F d' }],
            inputs: [['F', 'force', 'N, kN, lbf'], ['d', 'perpendicular distance to pivot', 'mm, cm, m, in, ft']]
        },
        'bolt-torque': {
            eq: [{ tex: 'T = K D F', text: 'T = K D F' }],
            inputs: [['K', 'nut factor', ''], ['D', 'nominal bolt diameter (from bolt size)', ''], ['F', 'desired clamp load', 'N, kN, lbf']]
        },
        'stress-strain': {
            eq: [{ tex: '\\sigma = \\frac{F}{A} \\quad \\varepsilon = \\frac{\\Delta L}{L_0} \\quad \\sigma = E\\varepsilon', text: 'sigma = F / A; epsilon = delta L / L0; sigma = E epsilon' }],
            inputs: [['F', 'axial force', 'N, kN, lbf'], ['A', 'cross-section area', 'mm², cm², m², in²'], ['L_0', 'original length', 'mm, cm, m, in, ft'], ['\\Delta L', 'change in length (strain / E modes)', 'mm, cm, m, in'], ['E', 'Young\'s modulus (E / deformation modes)', 'Pa, MPa, GPa, psi, ksi']]
        },
        'shaft-torsion': {
            eq: [{ tex: '\\tau = \\frac{T r}{J} \\qquad \\theta = \\frac{T L}{G J}', text: 'tau = T r / J; theta = T L / (G J)' }],
            inputs: [['T', 'applied torque', 'N·mm, N·m, kN·m, lbf·in, lbf·ft'], ['D_o, D_i', 'outer / inner diameter (J from shaft type)', 'mm, cm, m, in'], ['L', 'shaft length', 'mm, cm, m, in, ft'], ['G', 'shear modulus', 'Pa, MPa, GPa, psi, ksi']]
        },
        'thermal-expansion': {
            eq: [{ tex: '\\Delta L = \\alpha L_0 \\Delta T \\qquad \\sigma_{\\text{thermal}} = E \\alpha \\Delta T', text: 'delta L = alpha L0 delta T; sigma thermal = E alpha delta T' }],
            inputs: [['\\alpha', 'thermal expansion coefficient', '1/°C, 1/K'], ['L_0', 'original length', 'mm, cm, m, in, ft'], ['\\Delta T', 'temperature change', '°C, K, °F'], ['E', 'Young\'s modulus (restrained stress)', 'Pa, MPa, GPa, psi, ksi']]
        },
        'beam-bending-stress': {
            eq: [{ tex: '\\sigma = \\frac{M c}{I}', text: 'sigma = M c / I' }],
            inputs: [['M', 'bending moment', 'N·mm, N·m, kN·m, lbf·in, lbf·ft'], ['b, h', 'rectangle width, height (c = h/2)', 'mm, cm, m, in, ft'], ['d, D, d_i', 'solid / hollow round diameters', 'mm, cm, m, in, ft']]
        },
        'beam-deflection': {
            eq: [{ tex: '\\delta_{\\max} = \\frac{P L^3}{48 E I}', text: 'delta max = P L^3 / (48 E I) (default: simply supported, center point load)' }],
            inputs: [['P \\text{ or } w', 'point load / distributed load', 'N, kN, lbf; N/m, kN/m, lbf/ft'], ['L', 'beam length', 'mm, cm, m, in, ft'], ['E', 'Young\'s modulus', 'Pa, MPa, GPa, psi, ksi'], ['I', 'area moment of inertia', 'mm⁴, cm⁴, m⁴, in⁴']],
            note: 'Equation shown is for the default case; the other three loading cases are in the theory below.'
        },
        'column-buckling': {
            eq: [{ tex: 'P_{\\text{cr}} = \\frac{\\pi^2 E I}{(K L)^2}', text: 'P cr = pi^2 E I / (K L)^2' }],
            inputs: [['E', 'Young\'s modulus (material)', 'Pa, MPa, GPa, psi, ksi'], ['I', 'from D, d (solid / hollow round)', 'mm⁴, cm⁴, m⁴, in⁴'], ['L', 'unsupported length', 'mm, cm, m, in, ft'], ['K', 'end-condition factor (boundary condition)', '']]
        },
        'factor-of-safety': {
            eq: [{ tex: '\\text{FoS} = \\frac{\\text{Strength}}{\\text{Applied Stress}} \\qquad \\text{FoS} = \\frac{\\text{Failure Load}}{\\text{Applied Load}}', text: 'FoS = Strength / Applied Stress; FoS = Failure Load / Applied Load' }],
            inputs: [['\\text{Strength}', 'material or entered strength', 'Pa, MPa, GPa, psi, ksi'], ['\\text{Applied Stress}', 'applied stress', 'Pa, MPa, GPa, psi, ksi'], ['\\text{Failure / Applied Load}', 'load-based mode', 'N, kN, lbf']]
        },
        'bearing-life': {
            eq: [{ tex: 'L_{10} = \\left(\\frac{C}{P}\\right)^p \\qquad L_{10h} = \\frac{L_{10} \\times 10^6}{60n}', text: 'L10 = (C / P)^p; L10h = L10 x 10^6 / (60 n)' }],
            inputs: [['C', 'dynamic load rating', 'N, kN, lbf'], ['P', 'equivalent dynamic load', 'N, kN, lbf'], ['p', 'exponent (3 ball, 10/3 roller)', ''], ['n', 'rotational speed', 'rpm, rps']]
        },
        'fillet-weld': {
            eq: [
                { tex: 'R_n = F_{nw}A_{we}, \\quad A_{we} = 0.707\\,w\\,L', text: 'Rn = Fnw Awe; Awe = 0.707 w L' },
                { tex: 'F_{nw} = 0.60\\,F_{EXX}\\left(1 + 0.50\\sin^{1.5}\\theta\\right)', text: 'Fnw = 0.60 FEXX (1 + 0.50 sin^1.5 theta)' }
            ],
            inputs: [['w', 'weld leg size', 'mm, cm, in'], ['L', 'total effective weld length', 'mm, cm, in'], ['F_{EXX}', 'electrode strength', ''], ['\\theta', 'load direction (0° or 90°)', ''], ['P', 'applied load (optional)', 'N, kN, lbf']]
        },
        'press-fit': {
            eq: [
                { tex: 'p = \\frac{\\delta_r}{c\\left[\\frac{1}{E_h}\\left(\\frac{b^2+c^2}{b^2-c^2}+\\nu_h\\right)+\\frac{1}{E_s}\\left(\\frac{c^2+a^2}{c^2-a^2}-\\nu_s\\right)\\right]}', text: 'p = delta r / (c [ (1/Eh)((b^2+c^2)/(b^2-c^2)+nu h) + (1/Es)((c^2+a^2)/(c^2-a^2) - nu s) ])' },
                { tex: 'F_{press} = \\mu p \\pi d L \\qquad T_{capacity} = \\frac{\\mu p \\pi d^2 L}{2}', text: 'F press = mu p pi d L; T capacity = mu p pi d^2 L / 2' }
            ],
            inputs: [['\\Delta d', 'diametral interference', 'mm, µm, in'], ['d \\,(=2c)', 'interface diameter', 'mm, cm, m, in, ft'], ['D \\,(=2b),\\ d_i \\,(=2a)', 'hub OD, shaft bore (0 = solid)', 'mm, cm, m, in, ft'], ['L', 'engagement length', 'mm, cm, m, in, ft'], ['E, \\nu', 'hub and shaft materials', ''], ['\\mu', 'friction coefficient', '']]
        },
        'spring-calculations': {
            eq: [
                { tex: 'k = \\frac{Gd^4}{8D^3N_a}, \\qquad \\delta = \\frac{F}{k}', text: 'k = G d^4 / (8 D^3 Na); delta = F / k' },
                { tex: '\\tau_{\\max} = K_w\\frac{8FD}{\\pi d^3}', text: 'tau max = Kw 8 F D / (pi d^3)' }
            ],
            inputs: [['d', 'wire diameter', 'mm, cm, m, in, ft'], ['D', 'mean coil diameter', 'mm, cm, m, in, ft'], ['N_a', 'active coils', ''], ['F', 'applied axial force', 'N, kN, lbf'], ['G', 'shear modulus', 'GPa, MPa, psi, ksi']]
        },
        'thread-strength': {
            eq: [
                { tex: 'P_{bolt} = A_r S_{bolt}, \\qquad \\sigma_{applied} = \\frac{F}{A_r}', text: 'P bolt = Ar S bolt; sigma applied = F / Ar' },
                { tex: 'P_{strip,int} \\approx \\pi D L_e f_d\\,(0.577\\,S_{int})', text: 'P strip,int ~ pi D Le fd (0.577 S int)' }
            ],
            inputs: [['D', 'nominal major diameter', 'mm, cm, m, in, ft'], ['A_r', 'tensile stress area', 'mm², cm², m², in²'], ['L_e', 'thread engagement length', 'mm, cm, m, in, ft'], ['F', 'applied tensile load', 'N, kN, lbf'], ['S_{bolt}, S_{int}', 'fastener / internal-thread strength', 'MPa, GPa, psi, ksi']]
        }
    };

    function currentSlug() {
        const match = (window.location.pathname || '').match(/([^/]+?)(?:\.html)?$/);
        return match ? match[1] : '';
    }

    function buildRegistryContent(context, summary) {
        const eqWrap = document.createElement('div');
        eqWrap.className = 'context-equation';
        eqWrap.setAttribute('role', 'group');
        eqWrap.setAttribute('aria-label', 'Governing equation: ' + summary.eq.map((e) => e.text).join('; '));
        summary.eq.forEach((e) => {
            const line = document.createElement('div');
            line.className = 'context-equation-line';
            line.textContent = '\\[ ' + e.tex + ' \\]';
            eqWrap.appendChild(line);
        });
        context.appendChild(eqWrap);

        const list = document.createElement('ul');
        list.className = 'context-inputs';
        list.setAttribute('aria-label', 'Main inputs');
        summary.inputs.forEach(([symbol, description, units]) => {
            const li = document.createElement('li');
            const sym = document.createElement('span');
            sym.className = 'context-symbol';
            sym.textContent = '\\( ' + symbol + ' \\)';
            li.appendChild(sym);
            li.appendChild(document.createTextNode(' ' + description));
            if (units) {
                const u = document.createElement('span');
                u.className = 'context-units';
                u.textContent = ' (' + units + ')';
                li.appendChild(u);
            }
            list.appendChild(li);
        });
        context.appendChild(list);

        if (summary.note) {
            const note = document.createElement('p');
            note.className = 'context-note';
            note.textContent = summary.note;
            context.appendChild(note);
        }
    }

    function buildFallbackContent(context, theory, calc) {
        const equations = theory.querySelectorAll('.formula-box');
        if (equations.length === 1) {
            const eq = document.createElement('div');
            eq.className = 'context-equation';
            eq.textContent = equations[0].textContent.trim();
            context.appendChild(eq);
        }

        if (calc) {
            const names = [];
            calc.querySelectorAll('label').forEach((label) => {
                const text = label.textContent.replace(/\s*\([^)]*\)\s*/g, ' ')
                    .replace(/[:*]/g, '').replace(/\s+/g, ' ').trim();
                if (text && !names.includes(text)) {
                    names.push(text);
                }
            });

            if (names.length) {
                const p = document.createElement('p');
                p.className = 'context-inputs';
                const strong = document.createElement('strong');
                strong.textContent = 'Inputs: ';
                p.appendChild(strong);
                p.appendChild(document.createTextNode(names.join(', ')));
                context.appendChild(p);
            }
        }
    }

    function buildContext() {
        const header = document.querySelector('.calculator-header');
        const theory = document.querySelector('.theory-column');
        const calc = document.querySelector('.calculator-column');

        if (!header || !theory || document.querySelector('.calculator-context')) {
            return;
        }

        if (!theory.id) {
            theory.id = 'theory';
        }

        const context = document.createElement('aside');
        context.className = 'calculator-context';
        context.setAttribute('aria-label', 'Calculation context');

        const summary = SUMMARIES[currentSlug()];
        if (summary) {
            buildRegistryContent(context, summary);
        } else {
            buildFallbackContent(context, theory, calc);
        }

        const link = document.createElement('a');
        link.className = 'context-link';
        link.href = '#' + theory.id;
        link.textContent = 'Full theory, assumptions and limitations ↓';
        context.appendChild(link);

        header.insertAdjacentElement('afterend', context);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildContext);
    } else {
        buildContext();
    }
})();
