for (const adapter of Object.values(expansionModels)) {
    function scenarioDiagram(scenario) {
        const result = scenario?.status === "calculated" ? scenario.result : null;
        const inputs = result ? Object.fromEntries(result.inputs.map(({ id, value }) => [id, value])) : scenario?.inputs ?? {};
        const outputs = result ? Object.fromEntries(result.outputs.map(({ id, value }) => [id, value])) : {};
        return window.FormulaFoundryExpansionDiagram(adapter.id, inputs, outputs, scenario?.units, scenario?.status);
    }
    window.FormulaFoundryStudies.registerAdapter({
        ...adapter,
        scenarioDiagram,
        reportDetails: (scenario) => ({ diagram: scenarioDiagram(scenario) })
    });
}
