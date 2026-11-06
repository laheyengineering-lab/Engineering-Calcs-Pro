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

function applyMaterialPropertyToInput(selectElement, inputElement, propertyName, options = {}) {
    if (!selectElement || !inputElement) return null;
    const materialKey = selectElement.value;
    const material = getMaterial(materialKey);
    const value = getMaterialProperty(materialKey, propertyName);
    const previousKey = inputElement.dataset.materialDatabaseKey;
    const previousProperty = inputElement.dataset.materialDatabaseProperty;
    const previousBaseValue = getMaterialProperty(previousKey, previousProperty);
    const previousValue = Number.isFinite(previousBaseValue)
        ? String(options.formatValue ? options.formatValue(previousBaseValue) : previousBaseValue)
        : undefined;
    const inputValue = inputElement.value.trim();
    const isPreviousMaterialValue = previousValue !== undefined && inputValue === previousValue;
    const firstMaterialApply = inputElement.dataset.materialInputTracking !== "true";

    if (!inputElement.dataset.materialInputTracking) {
        inputElement.addEventListener("input", () => {
            if (inputElement.dataset.materialDatabaseKey !== undefined) {
                delete inputElement.dataset.materialDatabaseKey;
                delete inputElement.dataset.materialDatabaseProperty;
                inputElement.title = "Manual override; this value is not being supplied by the selected material.";
            }
        });
        inputElement.dataset.materialInputTracking = "true";
    }

    if (!material || !Number.isFinite(value)) {
        if (isPreviousMaterialValue) {
            inputElement.value = "";
            delete inputElement.dataset.materialDatabaseKey;
            delete inputElement.dataset.materialDatabaseProperty;
            inputElement.title = material
                ? "No database value for " + propertyName + " is available for " + material.displayName + "; enter a value manually."
                : "";
        }
        return null;
    }

    if (options.overwriteManual || (options.overwriteInitial && firstMaterialApply) ||
        inputValue === "" || isPreviousMaterialValue) {
        inputElement.value = String(options.formatValue ? options.formatValue(value) : value);
        inputElement.dataset.materialDatabaseKey = materialKey;
        inputElement.dataset.materialDatabaseProperty = propertyName;
        inputElement.title = material.displayName + ": "
            + (MATERIAL_PROPERTY_BASES[getMaterialPropertyBasis(materialKey, propertyName)] || "reference property")
            + ". Edit to use a manual override.";
        if (options.unitElement && options.unit !== undefined) {
            options.unitElement.value = options.unit;
        }
        return "material";
    }

    delete inputElement.dataset.materialDatabaseKey;
    delete inputElement.dataset.materialDatabaseProperty;
    inputElement.title = "Manual override; this value is not being supplied by the selected material.";
    return "manual";
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
