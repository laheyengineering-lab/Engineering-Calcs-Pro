function calculateMoment() {

    let force = Number(document.getElementById("force").value);

    let distance = Number(document.getElementById("distance").value);

    let moment = force * distance;

    document.getElementById("result").innerHTML =
        "Moment = " + moment + " lb-in";
}