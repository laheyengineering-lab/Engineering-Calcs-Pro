for (const model of Object.values(electricalModels)) {
    const defaultInputs = Object.fromEntries(model.inputs.map((input) => [input.id, input.default]));
    const scenarioValues = (scenario) => {
        const recorded = scenario?.status === "calculated" && scenario.result?.inputs;
        const inputs = recorded ? Object.fromEntries(recorded.map((field) => [field.id, field.value]))
            : scenario?.inputs ?? defaultInputs;
        const units = recorded ? { ...scenario.units } : scenario?.units;
        if (recorded) {
            for (const input of model.inputs) {
                const saved = recorded.find((field) => field.id === input.id);
                if (input.group && saved) units[input.group] = saved.unit;
            }
        }
        return { inputs, units, result: model.calculate(inputs, units) };
    };
    window.FormulaFoundryStudies.registerAdapter({
        ...model,
        activeUnitsOnly: true,
        defaultInputs,
        warningsFor: (inputs, result) => model.warningsFor(inputs, null, result),
        scenarioDiagram(scenario) {
            const { inputs, units, result } = scenarioValues(scenario);
            return model.diagram(inputs, units, result);
        },
        reportDetails(scenario) {
            const { inputs, units, result } = scenarioValues(scenario);
            const detail = model.detailRows?.(result.raw);
            return {
                diagram: model.diagram(inputs, units, result),
                ...(detail && { tables: [{ caption: detail.caption, columns: detail.headers, rows: detail.rows }] })
            };
        }
    });
}
