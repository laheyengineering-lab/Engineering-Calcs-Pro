for (const adapter of Object.values(expansionModels)) {
    window.FormulaFoundryStudies.registerAdapter({
        ...adapter,
        diagram: (inputs, outputs) => window.FormulaFoundryExpansionDiagram(adapter.id, inputs,
            Object.fromEntries(outputs.map((output) => [output.id, output.value])))
    });
}
