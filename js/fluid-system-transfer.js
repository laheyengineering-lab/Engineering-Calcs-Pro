// A single tab-local handoff for two fixed, explicitly selected routes.
// Each payload contains SI quantities, and the destination selects display units.
const FluidSystemTransfer = (() => {
    const key = "formulaFoundry.fluidSystemTransfer.v1";
    const routes = {
        "pipe-flow": {
            to: "pipe-pressure-drop",
            label: "Send flow and fluid properties to Pipe Pressure Drop",
            fields: ["diameter", "density", "flow", "dynamicViscosity", "kinematicViscosity"],
            context: "Enter pipe length, absolute roughness and any fitting K values."
        },
        "pipe-pressure-drop": {
            to: "pump-hydraulic-power",
            label: "Use segment loss as pump pressure rise",
            fields: ["flow", "density", "pressure"],
            context: "Pressure rise represents this segment’s friction only. Enter the full system requirement if applicable, plus pump efficiency."
        }
    };
    function send(source, quantities, reynolds) {
        const { to, fields } = routes[source];
        const values = Object.fromEntries(fields.filter((id) => Number.isFinite(quantities[id])).map((id) => [id, quantities[id]]));
        sessionStorage.setItem(key, JSON.stringify({ source, to, values, reynolds }));
    }
    function receive(target) {
        try {
            const packet = JSON.parse(sessionStorage.getItem(key));
            if (!packet || packet.to !== target) return null;
            sessionStorage.removeItem(key);
            const route = Object.hasOwn(routes, packet.source) && routes[packet.source];
            if (!route || route.to !== target || !packet.values || !Number.isFinite(packet.reynolds)) return null;
            const values = {};
            for (const id of route.fields) {
                const value = packet.values[id];
                const viscosity = id === "dynamicViscosity" || id === "kinematicViscosity";
                if (viscosity && value === undefined) continue;
                if (!Number.isFinite(value) || value < 0) return null;
                values[id] = value;
            }
            if (target === "pipe-pressure-drop" && !(values.dynamicViscosity > 0 || values.kinematicViscosity > 0)) return null;
            return { source: packet.source, values, reynolds: packet.reynolds, context: route.context };
        } catch {
            return null;
        }
    }
    return { routes, send, receive };
})();
