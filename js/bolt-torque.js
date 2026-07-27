function calculateMoment() {

    const force = Number(document.getElementById("force").value);
    const distance = Number(document.getElementById("distance").value);

    const result = document.getElementById("result");

    if (isNaN(force) || isNaN(distance) || force === 0 || distance === 0) {

        result.innerHTML = `
            <h3>Invalid Input</h3>
            <p>Please enter both a force and a distance.</p>
        `;

        return;
    }

    const forceUnit = document.getElementById("forceUnit").value;
    const distanceUnit = document.getElementById("distanceUnit").value;
    const outputUnit = document.getElementById("momentUnit").value;

    const forceN = convertForce(force, forceUnit);
    const distanceM = convertDistance(distance, distanceUnit);

    const momentNm = forceN * distanceM;

    const output = convertMoment(momentNm, outputUnit);

    result.innerHTML = `
        <h3>Result</h3>

        <div class="result-value">
            ${output.toLocaleString(undefined, {
                maximumFractionDigits: 3
            })}
            ${outputUnit}
        </div>

        <hr>

        <p><strong>Calculation Summary</strong></p>

        <p>
            ${force} ${forceUnit} × ${distance} ${distanceUnit}
        </p>

        <p>
            =
            <strong>
                ${output.toLocaleString(undefined, {
                    maximumFractionDigits: 3
                })}
                ${outputUnit}
            </strong>
        </p>
    `;
}

function resetToSI(){

    document.getElementById("force").value="";

    document.getElementById("distance").value="";

    document.getElementById("forceUnit").value="N";

    document.getElementById("distanceUnit").value="m";

    document.getElementById("momentUnit").value="N·m";

    document.getElementById("result").innerHTML =
    "Ready to calculate.";

}
