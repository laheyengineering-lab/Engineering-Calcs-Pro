const container = document.querySelector(".card-container");

if (container) {

    const categories = [
        "Mechanical",
        "Fasteners",
        "Materials",
        "Manufacturing"
    ];

    categories.forEach(category => {

        const card = document.createElement("div");

        card.className = "card";

        const heading = document.createElement("h3");
        heading.textContent = category;

        card.appendChild(heading);

        const list = document.createElement("ul");

        calculators
            .filter(calc => calc.category === category)
            .forEach(calc => {

                const item = document.createElement("li");

                const link = document.createElement("a");

                link.textContent = calc.name;

                link.href = calc.link;

                item.appendChild(link);

                list.appendChild(item);

            });

        card.appendChild(list);

        container.appendChild(card);

    });

}