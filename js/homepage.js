const container = document.querySelector(".card-container");
const searchInput = document.getElementById("searchInput");
const searchStatus = document.getElementById("searchStatus");
const categoryFilter = document.getElementById("categoryFilter");
const emptyState = document.getElementById("emptyState");

validateCalculatorData(calculators);

// Cache static categories
const CATEGORIES = [...new Set(calculators.map(c => c.category))];

for (const category of CATEGORIES) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
}

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

    const selectedCategory = categoryFilter.value;
    CATEGORIES.forEach(category => {
        if (selectedCategory && selectedCategory !== category) return;
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
        emptyState.textContent = selectedCategory
            ? "No calculators in this category match the search."
            : 'No calculators match "' + searchText.trim() + '". Try another name or keyword.';
        emptyState.hidden = false;
        searchStatus.textContent = "No calculators found.";
    } else {
        emptyState.hidden = true;
        searchStatus.textContent = query || selectedCategory
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

categoryFilter.addEventListener("change", () => {
    clearTimeout(searchDebounceTimer);
    buildHomepage(searchInput.value);
});
