const container = document.querySelector(".card-container");
const searchInput = document.getElementById("searchInput");

// Cache static categories
const CATEGORIES = [...new Set(calculators.map(c => c.category))];

// Debounce timer for search
let searchDebounceTimer;

function buildHomepage(searchText = "") {
    container.innerHTML = "";

    CATEGORIES.forEach(category => {
        const categoryCalcs = calculators.filter(calc =>
            calc.category === category &&
            calc.name.toLowerCase().includes(searchText.toLowerCase())
        );

        if (categoryCalcs.length === 0)
            return;

        const card = document.createElement("div");
        card.className = "category-card";

        const categoryHeading = document.createElement("h2");
        categoryHeading.textContent = category;
        card.appendChild(categoryHeading);

        // Batch append with fragment for better performance
        const fragment = document.createDocumentFragment();
        categoryCalcs.forEach(calc => {
            const calcCard = document.createElement("a");
            calcCard.className = "calculator-card";
            calcCard.href = calc.link;

            const heading = document.createElement("h3");
            heading.textContent = calc.name;
            const desc = document.createElement("p");
            desc.textContent = calc.description;

            calcCard.appendChild(heading);
            calcCard.appendChild(desc);
            fragment.appendChild(calcCard);
        });
        card.appendChild(fragment);
        container.appendChild(card);
    });
}

buildHomepage();

// Debounce search input to reduce rebuilds
searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        buildHomepage(searchInput.value);
    }, 300);
});