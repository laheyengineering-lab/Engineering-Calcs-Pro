// Shared display fields and SI conversion for standalone electrical calculators and Design Studies.
const electricalModels = (() => {
    const groups = {};
    function unitGroup(id, label, defaultUnit, factors) {
        groups[id] = {
            label, default: defaultUnit, options: Object.keys(factors), percentMeaningful: id !== "phase",
            toBase: (value, unit) => value * factors[unit],
            fromBase: (value, unit) => value / factors[unit]
        };
    }
    for (const [id, label, defaultUnit] of [
        ["voltage", "Voltage", "V"], ["current", "Current", "A"], ["resistance", "Resistance / impedance", "Ω"],
        ["capacitance", "Capacitance", "µF"], ["inductance", "Inductance", "mH"], ["frequency", "Frequency", "Hz"],
        ["time", "Time", "ms"], ["power", "Real power", "W"], ["energy", "Energy", "J"],
        ["phase", "Phase angle", "°"], ["charge", "Charge", "µC"]
    ]) unitGroup(id, label, defaultUnit, electricalUnits[id]);
    unitGroup("length", "Length", "m", distanceUnits);
    unitGroup("area", "Cross-sectional area", "mm²", areaUnits);
    groups.temperature = {
        label: "Temperature", default: "°C", options: ["°C", "°F", "K"], percentMeaningful: false,
        toBase: convertAbsoluteTemperature, fromBase: convertAbsoluteTemperatureToUnit
    };

    const field = (id, label, group, value, settings = {}) => ({ id, label, group, default: value, sweepable: true, ...settings });
    const choice = (id, label, options, optionLabels, settings = {}) => ({
        id, label, options, optionLabels, default: options[0], sweepable: false, ...settings
    });
    function output(id, label, group, settings = {}) {
        if (!group) {
            const unit = settings.unit || "";
            group = "fixed:" + unit;
            if (!groups[group]) unitGroup(group, unit, unit, { [unit]: 1 });
        }
        return { id, label, group, quantity: id, ...settings };
    }
    const optional = { optional: true };
    const countValues = (min, max) => Array.from({ length: max - min + 1 }, (_, index) => String(min + index));
    const indices = countValues(1, 12).map(Number);
    const fmt = (value, unit) => value == null ? "Indeterminate" : Number(value.toPrecision(6)) + (unit ? " " + unit : "");
    const modes = { series: "Series", parallel: "Parallel" };
    const topology = () => choice("mode", "Arrangement", ["series", "parallel"], modes);
    const source = (voltage = 12) => field("sourceVoltage", "DC source voltage", "voltage", voltage);
    const count = (minimum, label, settings) => choice("count", label, countValues(minimum, 12), null, settings);
    const ohmPairs = ["VR", "VI", "VP", "IR", "IP", "RP"];
    const ohmPairLabels = { VI: "Voltage and current", VR: "Voltage and resistance", VP: "Voltage and power",
        IR: "Current and resistance", IP: "Current and power", RP: "Resistance and power" };
    const activeOhm = (symbol) => ({ active: (inputs) => inputs.known.includes(symbol) });
    const sumRule = String.raw`R_{\rm series}=\sum_i R_i,\qquad R_{\rm parallel}=\left(\sum_i 1/R_i\right)^{-1}`;
    const ohmRule = String.raw`V=IR,\qquad P=VI=I^2R=V^2/R`;
    const kclRule = String.raw`\sum I_{\rm node}=0,\qquad \sum \Delta V_{\rm loop}=0`;
    const transientRule = String.raw`x(t)=x_{\infty}+(x_0-x_{\infty})e^{-t/\tau}`;
    const equilibrium = "For a constant step, the magnitude of the initial-to-final difference falls to 37% after one time constant.";
    const idealDC = "Ideal independent DC sources, ideal wires, and linear resistors. Reference voltages and currents are signed.";
    const rms = "Single-phase sinusoidal steady state. Voltage and current are RMS values.";
    const networkOutputs = [
        output("equivalentResistance", "Equivalent resistance", "resistance", optional),
        output("totalCurrent", "Total current", "current", optional), output("totalPower", "Total dissipated power", "power", optional)
    ];
    function componentFields(kind) {
        return indices.flatMap((component) => {
            const id = "r" + component;
            const speaker = kind === "speaker";
            const studio = kind === "studio";
            const label = (speaker ? "SP" : "R") + component;
            const active = (inputs) => component <= (kind === "divider" && ["voltage", "loaded"].includes(inputs.mode) ? 2 : Number(inputs.count));
            groups[id + kind] = { ...groups.resistance, label: label + " " + (speaker ? "impedance" : "resistance") };
            const resistance = field(id, label + (speaker ? " nominal impedance" : " resistance"), id + kind,
                speaker ? 8 : kind === "divider" ? 1000 * component : 100 * component,
                { component, section: "Components", active: (inputs) => active(inputs) && (!studio || inputs["open" + component] !== "open") });
            return studio ? [
                choice("open" + component, label + " state", ["resistor", "open"], { resistor: "Closed", open: "Open" },
                    { component, section: "Components", active }), resistance
            ] : [resistance];
        });
    }
    function valuesOf(inputs) {
        const count = ["voltage", "loaded"].includes(inputs.mode) ? 2 : Number(inputs.count);
        return indices.slice(0, count).map((index) => inputs["open" + index] === "open" ? null : inputs["r" + index]);
    }
    function componentRows(components, speaker = false) {
        return {
            caption: speaker ? "Estimated per-speaker quantities" : "Component quantities in their reference directions",
            headers: [speaker ? "Speaker" : "Resistor", speaker ? "Nominal impedance" : "Resistance", "Voltage", "Current", "Power"],
            rows: components.map((item) => [
                item.id, item.resistance === null ? "Open" : fmt(speaker ? item.impedance : item.resistance, "Ω"),
                fmt(item.voltage, "V"), fmt(item.current, "A"), fmt(item.power, "W")
            ])
        };
    }

    const models = {
        "ohms-law": {
            inputs: [choice("known", "Known quantities", ohmPairs, ohmPairLabels),
                field("voltage", "Voltage across the resistor", "voltage", 12, activeOhm("V")),
                field("current", "Current into the reference + terminal", "current", 0.1, activeOhm("I")),
                field("resistance", "Resistance", "resistance", 120, activeOhm("R")),
                field("power", "Power absorbed by the resistor", "power", 1.2, activeOhm("P")),
                choice("polarity", "Voltage and current reference sign", ["positive", "negative"], { positive: "Positive (+)", negative: "Negative (−)" },
                    { active: (v) => v.known === "RP" })],
            outputs: [output("voltage", "Resistor voltage", "voltage"), output("current", "Resistor current", "current"),
                output("resistance", "Resistance", "resistance"), output("power", "Power absorbed by resistor", "power"),
                output("sourcePower", "Source power (negative when delivering)", "power")],
            equations: [ohmRule], assumptions: [idealDC, "Passive sign convention. For a passive resistor, signed voltage and current have the same sign when nonzero."],
            method: "Use the selected pair to solve both relations, then apply the passive sign convention to power.",
            prepare: ({ polarity, ...v }) => ({ ...v, ...(polarity && { polarity: polarity === "positive" ? 1 : -1 }) }),
            engine: ElectricalDC.ohmsLaw,
            solutionSteps: (v, r) => [
                "Start with the selected known pair (" + ohmPairLabels[v.known].toLowerCase() + "). Solve V = IR and P = VI together.",
                "Substitute V = " + fmt(r.voltage, "V") + " and I = " + fmt(r.current, "A") + " into P = VI.",
                "The resistor absorbs " + fmt(r.power, "W") + ". The source has equal and opposite signed power."
            ]
        },
        "circuit-studio": {
            inputs: [topology(), source(), count(2, "Resistor count"), ...componentFields("studio")],
            outputs: [...networkOutputs, output("kclResidual", "KCL residual", "current", optional),
                output("kvlResidual", "KVL residual", "voltage", optional), output("powerResidual", "Power balance residual", "power", optional)],
            equations: [sumRule, ohmRule, kclRule], assumptions: [idealDC, "Each component belongs to one series loop or one parallel branch. A 0 Ω input represents an ideal short."],
            method: "Reduce the network, use the source voltage to find total current, then use Kirchhoff’s laws to recover and check each component quantity.",
            prepare: (v) => ({ mode: v.mode, sourceVoltage: v.sourceVoltage, resistances: valuesOf(v) }),
            engine: ElectricalDC.resistorNetwork,
            detailRows: (r) => componentRows(r.components),
            outputText: (field, result) => {
                if (field.id === "equivalentResistance" && result.equivalentResistance === null) return "Open circuit";
                if (field.id === "kvlResidual" && result.kvlResidual === null) return "Indeterminate across individual opens";
            },
            solutionSteps: (v, r) => [
                v.mode === "series"
                    ? "There is one loop and no branch junctions. Charge cannot accumulate at the intermediate nodes, so the same current flows through every component. Add the series resistances."
                    : "Every branch connects to the same two nodes, so each has the same node-to-node voltage. Add branch conductances to find the input resistance.",
                r.equivalentResistance === null
                    ? "The input is open. No source current flows. A floating intermediate node can make individual open-gap voltages indeterminate."
                    : "Use V = IR at the source terminals with an equivalent resistance of " + fmt(r.equivalentResistance, "Ω") + ".",
                "Use the component voltages and currents to find absorbed power. The KCL, KVL, and power balance residuals check the result where defined."
            ]
        },
        "kirchhoff-circuit": {
            inputs: [field("leftVoltage", "Left source potential Vₗ", "voltage", 12),
                field("rightVoltage", "Right source potential Vᵣ", "voltage", 6),
                field("leftResistance", "R1, left arm", "resistance", 100),
                field("centerResistance", "R2, center leg", "resistance", 100),
                field("rightResistance", "R3, right arm", "resistance", 100)],
            outputs: [output("left", "Left node potential", "voltage"), output("center", "Center node potential", "voltage"),
                output("right", "Right node potential", "voltage"), output("ground", "Ground potential", "voltage"),
                output("kclResidual", "Center-node KCL residual", "current"),
                output("leftKvlResidual", "Left-loop KVL residual", "voltage"), output("rightKvlResidual", "Right-loop KVL residual", "voltage"),
                output("totalPower", "Resistor power absorbed", "power"), output("leftSourcePower", "Left source power, passive sign", "power"),
                output("rightSourcePower", "Right source power, passive sign", "power"), output("sourcePower", "Net source power, passive sign", "power"),
                output("powerResidual", "Power balance residual", "power")],
            equations: [
                String.raw`I_2=I_1+I_3`,
                String.raw`(R_1+R_2)I_1+R_2I_3=V_l,\qquad R_2I_1+(R_2+R_3)I_3=V_r`,
                String.raw`V_l-V_{R1}-V_{R2}=0,\quad V_r-V_{R3}-V_{R2}=0`
            ],
            assumptions: [idealDC, "Both source voltages are measured from common ground. One ideal short can fix the center potential. Multiple ideal shorts can force conflicting potentials or leave currents undetermined."],
            method: "Use KCL to express the shared-leg current as I₁ + I₃. Solve the two linear mesh equations and substitute the signed drops into both loops.",
            engine: (v) => { const result = ElectricalDC.kirchhoff(v); return { ...result, ...result.nodes }; },
            detailRows: (r) => componentRows(r.branches),
            solutionSteps: (v, r) => [
                "Use the bottom rail as 0 V. The independent sources fix the left node at " + fmt(v.leftVoltage, "V") + " and the right node at " + fmt(v.rightVoltage, "V") + ". Each loop shares R2.",
                "Reference I₁ and I₃ toward the center node and I₂ down toward ground. A negative result means flow opposite the reference arrow.",
                "Write KCL as I₂ = I₁ + I₃. KVL gives R1 I₁ + R2 I₂ = Vₗ and R3 I₃ + R2 I₂ = Vᵣ.",
                "Substitute I₂ = I₁ + I₃ and solve the two-by-two system. I₁ = " + fmt(r.branches[0].current, "A") + ", I₃ = " + fmt(r.branches[2].current, "A") + ". The center potential is R2 I₂ = " + fmt(r.nodes.center, "V") + ".",
                "Substitute in I₁ + I₃ − I₂, Vₗ − V₁ − V₂ and Vᵣ − V₃ − V₂. The listed residuals are the numerical checks."
            ]
        },
        "electrical-divider": {
            inputs: [choice("mode", "Divider type", ["voltage", "series", "loaded", "current"],
                { voltage: "Two-resistor voltage", series: "Multi-resistor voltage tap", loaded: "Loaded voltage", current: "Parallel current" }),
                { ...source(), active: (v) => v.mode !== "current" },
                field("sourceCurrent", "Injected source current", "current", 0.1, { active: (v) => v.mode === "current" }),
                count(2, "Resistor count", { active: (v) => v.mode === "series" || v.mode === "current" }),
                choice("tap", "Tap after resistor number", countValues(1, 11), null, { active: (v) => v.mode === "series",
                    availableOptions: (v) => countValues(1, Number(v.count ?? 2) - 1) }),
                ...componentFields("divider"),
                field("loadResistance", "Load across R2", "resistance", 2000, { active: (v) => v.mode === "loaded" })],
            outputs: [...networkOutputs, output("outputVoltage", "Output voltage", "voltage"),
                output("unloadedVoltage", "Unloaded voltage", "voltage", optional),
                output("loadingError", "Loaded minus unloaded voltage", "voltage", optional),
                output("loadingErrorPercent", "Loading error", null, { unit: "%", ...optional }),
                output("loadCurrent", "Load current", "current", optional), output("loadPower", "Load power", "power", optional)],
            equations: [String.raw`V_{out}=V_s\frac{R_{\rm below}}{R_{\rm above}+R_{\rm below}}`,
                String.raw`R_{\rm below,loaded}=R_2\parallel R_L,\qquad I_i=I_s\frac{1/R_i}{\sum_k 1/R_k}`, ohmRule],
            assumptions: [idealDC, "The ideal unloaded voltage divider assumes no output current. In loaded mode the load is explicitly placed across R2.",
                "A series tap is measured relative to the return node and must have at least one resistor on each side."],
            method: "Reduce the two sides of a voltage tap, or share source current according to branch conductance when the resistors are in parallel.",
            prepare: (v) => ({ mode: v.mode, sourceVoltage: v.sourceVoltage, sourceCurrent: v.sourceCurrent,
                resistances: valuesOf(v), tap: Number(v.tap ?? 1), loadResistance: v.loadResistance }),
            engine: ElectricalDC.divider, detailRows: (r) => componentRows(r.components),
            solutionSteps: (v, r) => [
                v.mode === "current" ? "All branches share one voltage. Multiply the injected current by the parallel equivalent resistance, then use I = V/R for each branch. A single ideal short carries the entire injected current."
                    : v.mode === "loaded" ? "Replace R2 and the load with their parallel resistance. Divide the voltage across this combination and R1 in series."
                    : "Add the resistances above the tap and below the tap separately. The same current flows through both sums when the output is unloaded.",
                "The output node is " + fmt(r.outputVoltage, "V") + " relative to the return node. Use the signed drop and branch current to obtain each resistor’s power."
            ]
        },
        "dc-wire-voltage-drop": {
            inputs: [field("supplyVoltage", "Supply voltage", "voltage", 12), field("loadCurrent", "Load current", "current", 5),
                field("oneWayLength", "One-way conductor length", "length", 10),
                choice("material", "Conductor material", ["copper", "aluminum"], { copper: "Copper", aluminum: "Aluminum (EC-H19)" }),
                field("temperature", "Conductor temperature", "temperature", 20),
                choice("sizeMode", "Conductor size supplied as", ["area", "awg"], { awg: "Nominal AWG size", area: "Cross-sectional area" }),
                choice("gauge", "AWG gauge", ElectricalPractical.awgGauges, null,
                    { default: "14", active: (v) => v.sizeMode === "awg" }),
                field("area", "Conductor metal cross-sectional area", "area", 2, { active: (v) => v.sizeMode === "area" }),
                field("customResistivity", "Custom resistivity at operating temperature (optional)", null, null, { unit: "Ω·m", ...optional })],
            outputs: [output("oneWayResistance", "One-way resistance", "resistance"), output("loopResistance", "Round-trip resistance", "resistance"),
                output("voltageDrop", "Round-trip voltage drop", "voltage"), output("loadVoltage", "Load-terminal voltage", "voltage"),
                output("percentDrop", "Supply voltage drop", null, { unit: "%" }), output("powerLoss", "Loop power loss", "power"),
                output("area", "Conductor metal area", "area"), output("resistivity", "Operating-temperature resistivity", null, { unit: "Ω·m" })],
            equations: [String.raw`\rho(T)=\rho_{20}[1+\alpha_{20}(T-20^\circ\mathrm{C})]`,
                String.raw`R_{\rm one}=\rho L/A,\quad R_{\rm loop}=2R_{\rm one}`,
                String.raw`V_{\rm drop}=IR_{\rm loop},\quad V_{\rm load}=V_s-V_{\rm drop},\quad P_{\rm loss}=I^2R_{\rm loop}`],
            assumptions: ["Outgoing and return conductors have identical length, metal area, temperature, and resistivity. Contact resistance is excluded.",
                "The linear preset resistivity model covers 0–100 °C. A custom resistivity applies directly at the stated operating temperature.",
                "AWG uses nominal solid round metal dimensions. For a stranded or specified conductor, use its documented metal cross-sectional area."],
            warnings: ["Scope is low-voltage DC drop and loss. Ampacity, overcurrent protection and wiring-code compliance require separate analysis."],
            method: "Compute resistance of each identical conductor, add outgoing and return resistance, then apply the specified constant current.",
            engine: ElectricalPractical.wireVoltageDrop
        },
        "rc-transients": {
            inputs: [field("resistance", "Series resistance", "resistance", 1000), field("capacitance", "Capacitance", "capacitance", 100),
                field("initialVoltage", "Initial capacitor voltage", "voltage", 2), source(10), field("time", "Evaluate at elapsed time", "time", 100),
                field("endTime", "Plot end time (optional)", "time", null, optional)],
            outputs: [output("timeConstant", "RC time constant", "time"), output("capacitorVoltage", "Capacitor voltage", "voltage"),
                output("resistorVoltage", "Resistor voltage", "voltage"), output("current", "Series current", "current"),
                output("charge", "Capacitor charge", "charge"), output("energy", "Stored electric energy", "energy"),
                output("settlingTime2Percent", "Time to 2% of initial deviation", "time"),
                output("settlingTime1Percent", "Time to 1% of initial deviation", "time")],
            equations: [transientRule, String.raw`\tau=RC,\quad V_R=V_s-V_C,\quad I=V_R/R,\quad q=CV_C,\quad E=CV_C^2/2`],
            assumptions: ["Ideal series RC with a constant applied source for t ≥ 0. Capacitor voltage is continuous at the switching instant.",
                "Current points from source through the resistor into the referenced positive plate. Discharge toward zero uses a final source voltage of 0 V.", equilibrium],
            method: "Start from the entered capacitor voltage and exponentially approach the final source voltage. The resistor voltage and current follow from the series-loop equation.",
            engine: ElectricalTransientAC.rc,
            solutionSteps: (v, r) => [
                "Multiply R by C to get τ = " + fmt(r.timeConstant, "s") + ". At t = 0 the capacitor voltage is " + fmt(v.initialVoltage, "V") + ".",
                "At the selected time the initial voltage difference has been multiplied by exp(−t/τ). Add the remaining difference to the final source voltage to get " + fmt(r.capacitorVoltage, "V") + ".",
                "Subtract the capacitor voltage from the source to get the resistor drop. Divide by R to get current. Use the capacitor voltage for charge and energy."
            ]
        },
        "rl-transients": {
            inputs: [field("resistance", "Series resistance", "resistance", 10), field("inductance", "Inductance", "inductance", 100),
                field("initialCurrent", "Initial series current", "current", 0), source(10), field("time", "Evaluate at elapsed time", "time", 10),
                field("endTime", "Plot end time (optional)", "time", null, optional)],
            outputs: [output("timeConstant", "RL time constant", "time"), output("finalCurrent", "Final series current", "current"),
                output("current", "Series current", "current"),
                output("resistorVoltage", "Resistor voltage", "voltage"), output("inductorVoltage", "Inductor voltage", "voltage"),
                output("energy", "Stored magnetic energy", "energy"),
                output("settlingTime2Percent", "Time to 2% of initial deviation", "time"),
                output("settlingTime1Percent", "Time to 1% of initial deviation", "time")],
            equations: [transientRule, String.raw`\tau=L/R,\quad I_{\infty}=V_s/R,\quad V_R=IR,\quad V_L=V_s-V_R,\quad E=LI^2/2`],
            assumptions: ["Ideal series RL with a closed loop and constant applied source for t ≥ 0. Inductor current is continuous across the switching instant.",
                "A zero source models decay in a closed RL loop after the source is replaced by a short. Reference current enters the marked positive component terminals.", equilibrium],
            method: "Exponential current transitions from the entered initial current to Vₛ/R. Subtract the resistor voltage from the source to find inductor voltage.",
            engine: ElectricalTransientAC.rl,
            solutionSteps: (v, r) => [
                "Divide L by R to get τ = " + fmt(r.timeConstant, "s") + ". Divide the source voltage by R to get the final current of " + fmt(r.finalCurrent, "A") + ".",
                "Multiply the initial-to-final current difference by exp(−t/τ) and add it to the final current. The current at the selected time is " + fmt(r.current, "A") + ".",
                "Use IR for the resistor drop and subtract it from the source voltage to find the inductor voltage. Use the selected current for magnetic energy."
            ]
        },
        "rlc-impedance": {
            inputs: [field("resistance", "Series resistance", "resistance", 10), field("inductance", "Inductance", "inductance", 100),
                field("capacitance", "Capacitance", "capacitance", 100),
                field("frequency", "Source frequency", "frequency", 100), field("voltage", "Source RMS voltage", "voltage", 12)],
            outputs: [output("inductiveReactance", "Inductive reactance", "resistance"), output("capacitiveReactance", "Capacitive reactance magnitude", "resistance"),
                output("real", "Real impedance component", "resistance"), output("imaginary", "Imaginary impedance component", "resistance"),
                output("impedanceMagnitude", "Impedance magnitude", "resistance"), output("phase", "Voltage phase relative to current", "phase"),
                output("current", "RMS current", "current"), output("realPower", "Real power", "power"),
                output("resonantFrequency", "Resonant frequency", "frequency"), output("qualityFactor", "Series quality factor", null, optional)],
            equations: [String.raw`X_L=2\pi f L,\quad X_C=(2\pi f C)^{-1},\quad Z=R+j(X_L-X_C)`,
                String.raw`I_{\rm RMS}=V_{\rm RMS}/|Z|,\quad P=I_{\rm RMS}^2R`,
                String.raw`f_0=(2\pi\sqrt{LC})^{-1},\quad Q=2\pi f_0 L/R`],
            assumptions: [rms, "Series ideal R, L, and C. Positive impedance phase means voltage leads current. The ideal zero-resistance resonance has no finite driven RMS solution."],
            method: "Subtract capacitive reactance from inductive reactance, form rectangular impedance, and use its magnitude and angle to calculate RMS response.",
            engine: (v) => { const r = ElectricalTransientAC.rlc(v); return { ...r, ...r.impedance }; }
        },
        "ac-power-factor": {
            inputs: [field("voltage", "RMS voltage", "voltage", 120), field("current", "RMS current", "current", 2),
                choice("mode", "Phase supplied as", ["power-factor", "phase"], { "power-factor": "Power factor and direction", phase: "Signed phase angle" }),
                field("powerFactor", "Power factor magnitude", null, 0.8, { active: (v) => v.mode === "power-factor", min: 0, max: 1 }),
                choice("direction", "Current relative to voltage", ["lagging", "leading"], { lagging: "Lagging (inductive)", leading: "Leading (capacitive)" },
                    { active: (v) => v.mode === "power-factor" }),
                field("phase", "Signed voltage phase relative to current", "phase", 30, { active: (v) => v.mode === "phase" })],
            outputs: [output("realPower", "Real power", "power"), output("reactivePower", "Reactive power", null, { unit: "var" }),
                output("apparentPower", "Apparent power", null, { unit: "VA" }), output("phase", "Signed phase angle", "phase"),
                output("powerFactor", "Power factor", null)],
            equations: [String.raw`S=V_{\rm RMS} I_{\rm RMS},\quad P=S\cos\phi,\quad Q=S\sin\phi,\quad \mathrm{PF}=\cos\phi`],
            assumptions: [rms, "Passive-load angle lies between −90° and +90°. Lagging current gives positive reactive power. Leading current gives negative reactive power.",
                "Nonsinusoidal and three-phase power are outside this model."],
            method: "Use the RMS product for apparent power and resolve it into real and signed reactive components.",
            engine: ElectricalTransientAC.acPower
        },
        "speaker-impedance": {
            inputs: [topology(), count(1, "Speaker count", { default: "2" }), ...componentFields("speaker"),
                choice("sourceMode", "Amplifier output supplied as", ["voltage", "rated"], { voltage: "RMS output voltage", rated: "Rated power at reference load" }),
                field("rmsVoltage", "Amplifier RMS output voltage", "voltage", 10, { active: (v) => v.sourceMode === "voltage" }),
                field("ratedPower", "Rated power at reference load", "power", 50, { active: (v) => v.sourceMode === "rated" }),
                field("referenceLoad", "Reference load for rated output", "resistance", 8, { active: (v) => v.sourceMode === "rated" }),
                field("minimumLoad", "Manufacturer minimum nominal load (optional)", "resistance", null, optional)],
            outputs: [output("equivalentImpedance", "Estimated channel nominal load", "resistance"),
                output("rmsVoltage", "Assumed RMS output voltage", "voltage"), output("totalCurrent", "Estimated RMS current", "current"),
                output("totalPower", "Estimated channel power", "power"),
                output("minimumLoad", "Stated minimum nominal load", "resistance", optional),
                output("loadMargin", "Estimated load minus stated minimum", "resistance", optional)],
            equations: [sumRule, String.raw`V_{\rm RMS,ref}=\sqrt{P_{\rm ref}R_{\rm ref}},\quad I_{\rm RMS}=V_{\rm RMS}/R_{\rm eq},\quad P=V_{\rm RMS}I_{\rm RMS}`],
            assumptions: ["One channel with nominal impedance treated as a resistance for approximate power sharing. Real speaker impedance varies with frequency.",
                "Rated mode infers a reference-load voltage from the rating. Calculated power assumes that voltage can be sustained at the selected nominal load."],
            warnings: ["Nominal load comparison cannot guarantee compatibility, sustained output, or clipping-free performance. Amplifier output power and speaker power handling are separate specifications."],
            method: "Reduce nominal impedances in the selected wiring arrangement. Use the stated or inferred RMS voltage to estimate channel and per-speaker quantities.",
            prepare: (v) => ({ ...v, impedances: valuesOf(v) }),
            engine: ElectricalPractical.speakerLoad, detailRows: (r) => componentRows(r.components, true)
        }
    };

    return Object.fromEntries(Object.entries(models).map(([id, model]) => {
        const item = calculators.find((calculator) => calculator.id === id);
        const modelGroups = Object.fromEntries([...model.inputs, ...model.outputs]
            .filter((def) => def.group).map((def) => [def.group, groups[def.group]]));
        function activeInputs(values) {
            const selections = { ...values };
            for (const input of model.inputs) {
                if (input.options) selections[input.id] ??= input.default;
            }
            return model.inputs.filter((input) => !input.active || input.active(selections));
        }
        function toSI(values, units = {}) {
            const base = {};
            for (const field of activeInputs(values)) {
                const value = values[field.id];
                if (field.options) {
                    base[field.id] = value ?? field.default;
                    if (!field.options.includes(base[field.id])) throw new Error("Select a valid option for " + field.label + ".");
                } else if (value != null) {
                    const group = modelGroups[field.group];
                    const unit = units[field.group] ?? group?.default;
                    if (!Number.isFinite(value) || (group && !group.options.includes(unit))) {
                        throw new Error("Enter a valid value for " + field.label + ".");
                    }
                    base[field.id] = group ? group.toBase(value, unit) : value;
                    if (!Number.isFinite(base[field.id])) throw new Error("Enter a valid value for " + field.label + ".");
                } else if (!field.optional) {
                    throw new Error("Enter a value for " + field.label + ".");
                }
            }
            return model.prepare ? model.prepare(base) : base;
        }
        function calculate(values, units = {}) {
            const raw = model.engine(toSI(values, units));
            const display = {};
            for (const field of model.outputs) {
                const value = raw[field.id];
                if (value == null && field.optional) continue;
                if (!Number.isFinite(value)) throw new Error(field.label + " is outside the numerical range.");
                const group = modelGroups[field.group];
                const unit = units[field.group] ?? group.default;
                const number = group.fromBase(value, unit);
                if (!Number.isFinite(number)) throw new Error(field.label + " is outside the numerical range.");
                display[field.id] = number;
            }
            return { ...display, raw };
        }
        function diagram(values, units, result) {
            return window.FormulaFoundryElectricalDiagram(id, toSI(values, units), result?.raw);
        }
        return [id, { ...model, id, name: item.name, path: item.path, version: "1", groups: modelGroups,
            activeInputs, toSI, calculate, diagram, warningsFor: (_values, _units, result) => result.raw.warnings || [] }];
    }));
})();
