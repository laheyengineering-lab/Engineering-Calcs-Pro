function calculateMoment() {

    const force =
        Number(document.getElementById("force").value);

    const distance =
        Number(document.getElementById("distance").value);

    if (isNaN(force) || isNaN(distance)) {

        document.getElementById("result").innerHTML =
            "Please enter valid numbers.";

        return;

    }


    const forceUnit =
        document.getElementById("forceUnit").value;

    const distanceUnit =
        document.getElementById("distanceUnit").value;

    const outputUnit =
        document.getElementById("momentUnit").value;


    const forceN =
        convertForce(force, forceUnit);

    const distanceM =
        convertDistance(distance, distanceUnit);


    const momentNm =
        forceN * distanceM;


    const output =
        convertMoment(momentNm, outputUnit);


    document.getElementById("result").innerHTML = `

        <h3>Result</h3>

        <p>

            <strong>

            ${output.toLocaleString(undefined, {
                maximumFractionDigits: 3
            })}

            ${outputUnit}

            </strong>

        </p>

    `;

}