function calculateMoment() {

    const force = Number(document.getElementById("force").value);

    const distance = Number(document.getElementById("distance").value);

    const moment = force * distance;

    document.getElementById("result").innerHTML =
        `
        <strong>Moment</strong><br>
        ${moment.toLocaleString()} N·mm
        `;

}