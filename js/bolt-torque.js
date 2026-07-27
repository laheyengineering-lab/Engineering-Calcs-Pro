function calculateBoltTorque() {

    const boltDiameter = Number(document.getElementById("boltDiameter").value);
    const clampLoad = Number(document.getElementById("clampLoad").value);
    const nutFactor = Number(document.getElementById("nutFactor").value);

    const result = document.getElementById("result");

    if (isNaN(boltDiameter) || isNaN(clampLoad) || isNaN(nutFactor) || 
        boltDiameter === 0 || clampLoad === 0 || nutFactor === 0) {

        result.innerHTML = `
            <h3>Invalid Input</h3>
            <p>Please enter valid values for bolt diameter, clamp load, and nut factor.</p>
        `;

        return;
    }

    const diameterUnit = document.getElementById("diameterUnit").value;
    const loadUnit = document.getElementById("loadUnit").value;
    const outputUnit = document.getElementById("torqueUnit").value;

    // Convert to base units (meters and Newtons)
    const diameterM = convertDistance(boltDiameter, diameterUnit);
    const loadN = convertForce(clampLoad, loadUnit);

    // Calculate torque in N·m
    // T = K × D × F
    const torqueNm = nutFactor * diameterM * loadN;

    // Convert to output unit
    const output = convertMoment(torqueNm, outputUnit);

    result.innerHTML = `
        <h3>Result</h3>

        <div class="result-value">
            ${output.toLocaleString(undefined, {
                maximumFractionDigits: 2
            })}
            ${outputUnit}
        </div>

        <hr>

        <p><strong>Calculation Summary</strong></p>

        <p>
            T = K × D × F
        </p>

        <p>
            T = ${nutFactor} × ${boltDiameter} ${diameterUnit} × ${clampLoad} ${loadUnit}
        </p>

        <p>
            T = ${nutFactor} × ${diameterM.toFixed(4)} m × ${loadN.toLocaleString()} N
        </p>

        <p>
            = <strong>${torqueNm.toLocaleString(undefined, {
                maximumFractionDigits: 2
            })} N·m</strong>
        </p>

        <p>
            = <strong>${output.toLocaleString(undefined, {
                maximumFractionDigits: 2
            })} ${outputUnit}</strong>
        </p>
    `;
}

function resetTorqueCalculator(){

    document.getElementById("boltDiameter").value="";

    document.getElementById("clampLoad").value="";

    document.getElementById("nutFactor").value="0.20";

    document.getElementById("diameterUnit").value="mm";

    document.getElementById("loadUnit").value="N";

    document.getElementById("torqueUnit").value="N·m";

    document.getElementById("unitSystem").value="metric";

    document.getElementById("result").innerHTML =
    "Ready to calculate.";

}

function updateBoltSizes(){

    const unitSystem = document.getElementById("unitSystem").value;
    
    if(unitSystem === "metric"){
        document.getElementById("diameterUnit").value = "mm";
        document.getElementById("loadUnit").value = "N";
    } else {
        document.getElementById("diameterUnit").value = "in";
        document.getElementById("loadUnit").value = "lbf";
    }
}
