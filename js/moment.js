function calculateMoment() {

    const force = Number(document.getElementById("force").value);

    const distance = Number(document.getElementById("distance").value);

    const result = document.getElementById("result");


    if (isNaN(force) || isNaN(distance)) {

        result.innerHTML = `

        <h3>Result</h3>

        <div class="result-value">

        ${output.toLocaleString(undefined,{
        maximumFractionDigits:3
        })}

        ${outputUnit}

        </div>

        <hr>

        <p>

        <strong>Calculation Summary</strong>

        </p>

        <p>

        ${force} ${forceUnit}

        ×

        ${distance} ${distanceUnit}

        </p>

        <p>

        =

        <strong>

        ${output.toLocaleString(undefined,{
        maximumFractionDigits:3
        })}

        ${outputUnit}

        </strong>

        </p>

        `;

}



function resetToSI() {

    document.getElementById("forceUnit").value="N";

    document.getElementById("distanceUnit").value="m";

    document.getElementById("momentUnit").value="N·m";

}