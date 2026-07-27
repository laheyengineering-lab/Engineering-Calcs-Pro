// ======================================================
// Engineering Calcs Pro
// Bolt Database & Specifications
// ======================================================

const boltDatabase = {

    metric: [
        { size: "M2", diameter: 2.0, pitch: 0.4 },
        { size: "M2.5", diameter: 2.5, pitch: 0.45 },
        { size: "M3", diameter: 3.0, pitch: 0.5 },
        { size: "M3.5", diameter: 3.5, pitch: 0.6 },
        { size: "M4", diameter: 4.0, pitch: 0.7 },
        { size: "M5", diameter: 5.0, pitch: 0.8 },
        { size: "M6", diameter: 6.0, pitch: 1.0 },
        { size: "M7", diameter: 7.0, pitch: 1.0 },
        { size: "M8", diameter: 8.0, pitch: 1.25 },
        { size: "M9", diameter: 9.0, pitch: 1.25 },
        { size: "M10", diameter: 10.0, pitch: 1.5 },
        { size: "M11", diameter: 11.0, pitch: 1.5 },
        { size: "M12", diameter: 12.0, pitch: 1.75 },
        { size: "M14", diameter: 14.0, pitch: 2.0 },
        { size: "M16", diameter: 16.0, pitch: 2.0 },
        { size: "M18", diameter: 18.0, pitch: 2.5 },
        { size: "M20", diameter: 20.0, pitch: 2.5 },
        { size: "M22", diameter: 22.0, pitch: 2.5 },
        { size: "M24", diameter: 24.0, pitch: 3.0 },
        { size: "M27", diameter: 27.0, pitch: 3.0 },
        { size: "M30", diameter: 30.0, pitch: 3.5 },
        { size: "M36", diameter: 36.0, pitch: 4.0 }
    ],

    imperial: [
        { size: '#0-80', diameter: 0.060, pitch: 80 },
        { size: '#1-64', diameter: 0.073, pitch: 64 },
        { size: '#1-72', diameter: 0.073, pitch: 72 },
        { size: '#2-56', diameter: 0.086, pitch: 56 },
        { size: '#2-64', diameter: 0.086, pitch: 64 },
        { size: '#3-48', diameter: 0.099, pitch: 48 },
        { size: '#3-56', diameter: 0.099, pitch: 56 },
        { size: '#4-40', diameter: 0.112, pitch: 40 },
        { size: '#4-48', diameter: 0.112, pitch: 48 },
        { size: '#5-40', diameter: 0.125, pitch: 40 },
        { size: '#5-44', diameter: 0.125, pitch: 44 },
        { size: '#6-32', diameter: 0.138, pitch: 32 },
        { size: '#6-40', diameter: 0.138, pitch: 40 },
        { size: '#8-32', diameter: 0.164, pitch: 32 },
        { size: '#8-36', diameter: 0.164, pitch: 36 },
        { size: '#10-24', diameter: 0.190, pitch: 24 },
        { size: '#10-32', diameter: 0.190, pitch: 32 },
        { size: '1/4"-20', diameter: 0.250, pitch: 20 },
        { size: '1/4"-28', diameter: 0.250, pitch: 28 },
        { size: '5/16"-18', diameter: 0.3125, pitch: 18 },
        { size: '5/16"-24', diameter: 0.3125, pitch: 24 },
        { size: '3/8"-16', diameter: 0.375, pitch: 16 },
        { size: '3/8"-24', diameter: 0.375, pitch: 24 },
        { size: '7/16"-14', diameter: 0.4375, pitch: 14 },
        { size: '7/16"-20', diameter: 0.4375, pitch: 20 },
        { size: '1/2"-13', diameter: 0.500, pitch: 13 },
        { size: '1/2"-20', diameter: 0.500, pitch: 20 },
        { size: '9/16"-12', diameter: 0.5625, pitch: 12 },
        { size: '9/16"-18', diameter: 0.5625, pitch: 18 },
        { size: '5/8"-11', diameter: 0.625, pitch: 11 },
        { size: '5/8"-18', diameter: 0.625, pitch: 18 },
        { size: '3/4"-10', diameter: 0.750, pitch: 10 },
        { size: '3/4"-16', diameter: 0.750, pitch: 16 },
        { size: '7/8"-9', diameter: 0.875, pitch: 9 },
        { size: '7/8"-14', diameter: 0.875, pitch: 14 },
        { size: '1"-8', diameter: 1.000, pitch: 8 },
        { size: '1"-12', diameter: 1.000, pitch: 12 },
        { size: '1-1/8"-7', diameter: 1.125, pitch: 7 },
        { size: '1-1/8"-12', diameter: 1.125, pitch: 12 },
        { size: '1-1/4"-7', diameter: 1.250, pitch: 7 },
        { size: '1-1/4"-12', diameter: 1.250, pitch: 12 },
        { size: '1-3/8"-6', diameter: 1.375, pitch: 6 },
        { size: '1-1/2"-6', diameter: 1.500, pitch: 6 }
    ]

};

function populateBoltSizes() {

    const unitSystem = document.getElementById("unitSystem").value;
    const boltSizeSelect = document.getElementById("boltSize");
    
    // Clear existing options
    boltSizeSelect.innerHTML = '<option value="">-- Select Bolt Size --</option>';
    
    // Get the appropriate database
    const bolts = boltDatabase[unitSystem];
    
    // Populate dropdown
    bolts.forEach(bolt => {
        const option = document.createElement("option");
        option.value = bolt.diameter;
        option.textContent = bolt.size + " (∅ " + (unitSystem === 'metric' ? bolt.diameter + "mm" : bolt.diameter + '"') + ")";
        boltSizeSelect.appendChild(option);
    });

    // Update diameter unit display
    if(unitSystem === "metric"){
        document.getElementById("diameterUnitDisplay").textContent = "mm";
    } else {
        document.getElementById("diameterUnitDisplay").textContent = "in";
    }

}

function updateBoltCalculator(){

    const unitSystem = document.getElementById("unitSystem").value;
    
    // Populate bolt sizes for selected unit system
    populateBoltSizes();
    
    // Update force and torque units
    if(unitSystem === "metric"){
        document.getElementById("loadUnit").value = "N";
        document.getElementById("torqueUnit").value = "N·m";
    } else {
        document.getElementById("loadUnit").value = "lbf";
        document.getElementById("torqueUnit").value = "lbf·in";
    }

}

function getBoltDiameterFromSelection() {

    const boltSizeSelect = document.getElementById("boltSize");
    return Number(boltSizeSelect.value);

}
