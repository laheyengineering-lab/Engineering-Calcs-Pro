// Input data for the published shaft and bearing example, in SI units and rpm.
(function (root) {
    "use strict";

    function create(projects) {
        const project = projects.newProject();
        const baseline = project.configurations[0];
        project.title = "Packaging conveyor drive shaft";
        project.description = "A gear applies steady transverse force to a shaft driven through two separate torque stations.";
        project.notes = "Provided gear forces and bearing ratings are illustrative. Shaft self-weight is excluded.";
        baseline.name = "40 mm baseline";
        baseline.inputs = projects.applyMaterial({
            ...baseline.inputs,
            span: 0.60,
            section: "solid",
            outerDiameter: 0.04,
            innerDiameter: null,
            speed: 900,
            torque: { value: 110, start: 0.10, end: 0.52 },
            loads: [{
                ...projects.newLoad(),
                name: "Drive gear",
                position: 0.24,
                fy: -1600,
                fz: 1200,
                notes: "Specified steady force components in the stationary shaft axes."
            }],
            bearings: {
                a: { type: "ball", dynamicRating: 8400, staticRating: 6000, targetHours: 10000 },
                b: { type: "roller", dynamicRating: 6400, staticRating: 9600, targetHours: 10000 }
            }
        }, "steel-1018-cold-drawn");
        return project;
    }

    root.FormulaFoundryShaftExample = { create };
})(typeof window === "undefined" ? globalThis : window);
