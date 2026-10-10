/* Calculator context (mobile information hierarchy).
   Builds a compact "calculation context" block after the page header from
   content already on the page: the header description is left in place, the
   governing equation is cloned from the theory column (only when the page has
   exactly one), and the primary inputs are read from the form labels.
   Presentation only: no calculation, input or result logic lives here.
   The block is hidden on desktop, where the theory column is already visible. */
(function() {
    const MAX_INPUTS = 6;

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
                const shown = names.slice(0, MAX_INPUTS);
                const p = document.createElement('p');
                p.className = 'context-inputs';
                const strong = document.createElement('strong');
                strong.textContent = 'Inputs: ';
                p.appendChild(strong);
                p.appendChild(document.createTextNode(
                    shown.join(', ') + (names.length > shown.length ? ', …' : '')
                ));
                context.appendChild(p);
            }
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
