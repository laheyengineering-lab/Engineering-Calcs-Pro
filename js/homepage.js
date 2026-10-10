const container = document.querySelector(".card-container");
const searchInput = document.getElementById("searchInput");
const searchStatus = document.getElementById("searchStatus");
const emptyState = document.getElementById("emptyState");

validateCalculatorData(calculators);

// Cache static categories
const CATEGORIES = [...new Set(calculators.map(c => c.category))];

// Debounce timer for search
let searchDebounceTimer;

function calculatorMatches(calc, query) {
    if (!query) return true;
    const fields = [
        calc.name,
        calc.shortDescription,
        calc.description,
        calc.category,
        calc.status === "coming-soon" ? "coming soon" : "",
        ...(Array.isArray(calc.keywords) ? calc.keywords : [])
    ];
    return fields.some(value => typeof value === "string" && value.toLowerCase().includes(query));
}

function buildHomepage(searchText = "") {
    container.innerHTML = "";
    const query = searchText.trim().toLowerCase();
    let total = 0;

    CATEGORIES.forEach(category => {
        const categoryCalcs = calculators.filter(calc =>
            calc.category === category && calculatorMatches(calc, query)
        );

        if (categoryCalcs.length === 0)
            return;
        total += categoryCalcs.length;

        const section = document.createElement("section");
        section.className = "category-card";

        const categoryHeading = document.createElement("h2");
        categoryHeading.textContent = category;
        section.appendChild(categoryHeading);

        const grid = document.createElement("div");
        grid.className = "calculator-grid";

        // Batch append with fragment for better performance
        const fragment = document.createDocumentFragment();
        categoryCalcs.forEach(calc => {
            const comingSoon = calc.status === "coming-soon";
            const calcCard = document.createElement(comingSoon ? "div" : "a");
            calcCard.className = "calculator-card";
            if (comingSoon) {
                calcCard.classList.add("is-coming-soon");
            } else {
                calcCard.href = calc.path;
            }

            const heading = document.createElement("h3");
            heading.textContent = calc.name;
            const desc = document.createElement("p");
            desc.textContent = calc.shortDescription;

            calcCard.appendChild(heading);
            calcCard.appendChild(desc);

            if (comingSoon) {
                const badge = document.createElement("span");
                badge.className = "badge-coming-soon";
                badge.textContent = "Coming soon";
                calcCard.appendChild(badge);
            }
            fragment.appendChild(calcCard);
        });
        grid.appendChild(fragment);
        section.appendChild(grid);
        container.appendChild(section);
    });

    if (total === 0) {
        emptyState.textContent = `No calculators match "${searchText.trim()}". Try a different name or keyword, such as torque, beam, or stress.`;
        emptyState.hidden = false;
        searchStatus.textContent = "No calculators found.";
    } else {
        emptyState.hidden = true;
        searchStatus.textContent = query
            ? `${total} calculator${total === 1 ? "" : "s"} found.`
            : "";
    }
}

buildHomepage();

// Debounce search input to reduce rebuilds
searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        buildHomepage(searchInput.value);
    }, 150);
});
