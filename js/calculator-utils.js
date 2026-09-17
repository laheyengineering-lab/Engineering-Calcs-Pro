function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function populateMaterialSelect(selectElement, options = {}) {
    if (!selectElement) {
        return;
    }

    const {
        placeholderText = "-- Select Material --",
        formatLabel = (material) => material.displayName
    } = options;

    selectElement.innerHTML = "";

    if (placeholderText !== null) {
        const placeholderOption = document.createElement("option");
        placeholderOption.value = "";
        placeholderOption.textContent = placeholderText;
        selectElement.appendChild(placeholderOption);
    }

    getMaterialList().forEach((materialKey) => {
        const material = getMaterial(materialKey);
        if (!material) {
            return;
        }

        const option = document.createElement("option");
        option.value = materialKey;
        option.textContent = formatLabel(material, materialKey);
        selectElement.appendChild(option);
    });
}
