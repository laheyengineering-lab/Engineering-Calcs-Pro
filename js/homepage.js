const container = document.querySelector(".card-container");
const searchInput = document.getElementById("searchInput");

function buildHomepage(searchText = "") {

    container.innerHTML = "";

    const categories = [...new Set(calculators.map(c => c.category))];

    categories.forEach(category => {

        const categoryCalcs = calculators.filter(calc =>
            calc.category === category &&
            calc.name.toLowerCase().includes(searchText.toLowerCase())
        );

        if (categoryCalcs.length === 0)
            return;

        const card = document.createElement("div");
        card.className = "category-card";

        card.innerHTML = `<h2>${category}</h2>`;

        categoryCalcs.forEach(calc => {

            const calcCard = document.createElement("a");

            calcCard.className = "calculator-card";

            calcCard.href = calc.link;

            calcCard.innerHTML = `

                <h3>${calc.name}</h3>

                <p>${calc.description}</p>

            `;

            card.appendChild(calcCard);

        });

        container.appendChild(card);

    });

}

buildHomepage();

searchInput.addEventListener("input", () => {

    buildHomepage(searchInput.value);

});