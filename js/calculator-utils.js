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

    // Materials are grouped by family; options keep their original database order within a group.
    getMaterialListGrouped().forEach((group) => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = group.family;

        group.materials.forEach(({ key }) => {
            const material = getMaterial(key);
            if (!material) {
                return;
            }

            const option = document.createElement("option");
            option.value = key;
            option.textContent = formatLabel(material, key);
            const metadata = material.metadata;
            if (metadata && metadata.condition) {
                option.title = metadata.condition;
            }
            optgroup.appendChild(option);
        });

        selectElement.appendChild(optgroup);
    });

    addMaterialDataNote(selectElement);
}

// Adds one concise reference-data notice after a material selector.
function addMaterialDataNote(selectElement) {
    const parent = selectElement.parentNode;
    if (!parent || parent.querySelector(".material-data-note")) {
        return;
    }
    const prefix = /\/calculators\//.test(window.location.pathname) ? "../" : "";
    const note = document.createElement("small");
    note.className = "material-data-note";
    note.innerHTML = 'Built-in values are reference properties, not certified design allowables. '
        + '<a href="' + prefix + 'references.html#material-data">Sources</a>';
    selectElement.insertAdjacentElement("afterend", note);
}

// Reads a numeric input; a blank field is NaN (not 0) so missing values can be rejected.
function readNumberInput(id) {
    const element = document.getElementById(id);
    if (!element) {
        return NaN;
    }
    const raw = String(element.value).trim();
    return raw === "" ? NaN : Number(raw);
}
