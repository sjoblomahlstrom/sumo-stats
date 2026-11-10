const liveTournament = document.getElementById("live-tournament");
const liveDivision = document.getElementById("live-division");
const liveDay = document.getElementById("live-day");
const liveBody = document.getElementById("live-results-body");
const liveStatus = document.getElementById("live-status");

async function loadLiveResults() {
    const basho = liveTournament.value;
    const division = liveDivision.value;
    const day = liveDay.value;

    liveStatus.textContent = "Hämtar matcher...";
    liveBody.replaceChildren();

    try {
        const url = `https://www.sumo-api.com/api/basho/${basho}/torikumi/${division}/${day}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const matches = data.torikumi;

        if (!Array.isArray(matches) || matches.length === 0) {
            liveStatus.textContent = "Inga matcher tillgängliga.";
            return;
        }

        for (const match of matches) {
            const winner = match.winnerId
                ? (match.winnerEn ||
                   (match.winnerId === match.eastId
                       ? match.eastShikona
                       : match.westShikona))
                : "Ej avgjord";

            const cells = [
                match.matchNo,
                match.eastShikona,
                match.westShikona,
                winner,
                match.kimarite || "–"
            ];

            const row = document.createElement("tr");

            for (const value of cells) {
                const cell = document.createElement("td");
                cell.textContent = value ?? "–";
                row.appendChild(cell);
            }

            liveBody.appendChild(row);
        }

        liveStatus.textContent =
            `${division} – Dag ${day}: ${matches.length} matcher`;

    } catch (error) {
        liveStatus.textContent =
            "Kunde inte hämta matcherna. Kontrollera API-anslutningen.";
        console.error("Sumo API:", error);
    }
}

[liveTournament, liveDivision, liveDay].forEach(select => {
    select.addEventListener("change", loadLiveResults);
});

loadLiveResults();
