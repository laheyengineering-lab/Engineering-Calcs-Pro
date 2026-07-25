const container = document.querySelector(".card-container");

if (container) {

    calculators.forEach(calculator => {

        const card = document.createElement("div");

        card.className = "card";

        card.innerHTML = `
            <h3>${calculator.name}</h3>

            <p>${calculator.description}</p>

            <a href="${calculator.link}">
                Open Calculator
            </a>
        `;

        container.appendChild(card);

    });

}