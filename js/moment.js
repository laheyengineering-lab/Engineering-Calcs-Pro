function calculateMoment() {


    const force = Number(document.getElementById("force").value);

    const distance = Number(document.getElementById("distance").value);


    const result = document.getElementById("result");


    if (!force || !distance) {

        result.innerHTML =
            "Please enter both force and distance.";

        return;

    }


    const moment = force * distance;


    result.innerHTML = `

        <h3>Result</h3>

        <p>

        Moment =

        <strong>
        ${moment.toLocaleString()} N·mm
        </strong>

        </p>

    `;

}