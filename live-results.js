const liveTournament = document.getElementById("live-tournament");
const liveDivision = document.getElementById("live-division");
const liveDay = document.getElementById("live-day");
const liveBody = document.getElementById("live-results-body");
const liveStatus = document.getElementById("live-status");

const liveTranslations = {
    sv: {
        loading: "Hämtar matcher...",
        empty: "Inga matcher tillgängliga.",
        undecided: "Ej avgjord",
        day: "Dag",
        matches: "matcher",
        error: "Kunde inte hämta matcherna. Kontrollera API-anslutningen."
    },
    en: {
        loading: "Loading matches...",
        empty: "No matches available.",
        undecided: "Not decided",
        day: "Day",
        matches: "matches",
        error: "Could not load matches. Check the API connection."
    },
    ja: {
        loading: "取組を読み込み中...",
        empty: "取組がありません。",
        undecided: "未決着",
        day: "日目",
        matches: "取組",
        error: "取組を取得できませんでした。API接続を確認してください。"
    }
};

async function loadLiveResults() {
    const t = liveTranslations[currentLanguage] || liveTranslations.sv;
    const basho = liveTournament.value;
    const division = liveDivision.value;
    const day = liveDay.value;

    liveStatus.textContent = t.loading;
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
            liveStatus.textContent = t.empty;
            return;
        }

        for (const match of matches) {
            const winner = match.winnerId
                ? (match.winnerEn ||
                   (match.winnerId === match.eastId
                       ? match.eastShikona
                       : match.westShikona))
                : t.undecided;

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
            currentLanguage === "ja"
                ? `${division} – ${day}${t.day}: ${matches.length}${t.matches}`
                : `${division} – ${t.day} ${day}: ${matches.length} ${t.matches}`;

    } catch (error) {
        liveStatus.textContent =
            t.error;
        console.error("Sumo API:", error);
    }
}

[liveTournament, liveDivision, liveDay].forEach(select => {
    select.addEventListener("change", loadLiveResults);
});

loadLiveResults();


const livePageTranslations = {
    sv: {
        title: "🥋 Liveresultat",
        description: "Se dagens matcher, vinnare och vinnargrepp.",
        tournament: "Turnering",
        division: "Division",
        day: "Turneringsdag",
        match: "Match",
        east: "Öst",
        west: "Väst",
        winner: "Vinnare",
        kimarite: "Vinnargrepp (kimarite)",
        dayPrefix: "Dag"
    },
    en: {
        title: "🥋 Live Results",
        description: "See today's matches, winners and winning techniques.",
        tournament: "Tournament",
        division: "Division",
        day: "Tournament Day",
        match: "Match",
        east: "East",
        west: "West",
        winner: "Winner",
        kimarite: "Winning Technique (kimarite)",
        dayPrefix: "Day"
    },
    ja: {
        title: "🥋 取組結果",
        description: "取組、勝者、決まり手をご覧いただけます。",
        tournament: "本場所",
        division: "階級",
        day: "取組日",
        match: "取組",
        east: "東",
        west: "西",
        winner: "勝者",
        kimarite: "決まり手",
        dayPrefix: "日目"
    }
};

function updateLiveLanguage() {
    const t = livePageTranslations[currentLanguage] || livePageTranslations.sv;

    const fields = {
        "live-title": t.title,
        "live-description": t.description,
        "live-tournament-label": t.tournament,
        "live-division-label": t.division,
        "live-day-label": t.day,
        "live-th-match": t.match,
        "live-th-east": t.east,
        "live-th-west": t.west,
        "live-th-winner": t.winner,
        "live-th-kimarite": t.kimarite
    };

    for (const [id, value] of Object.entries(fields)) {
        document.getElementById(id).textContent = value;
    }

    document.querySelectorAll("#live-day option").forEach(option => {
        option.textContent = currentLanguage === "ja"
            ? option.value + t.dayPrefix
            : t.dayPrefix + " " + option.value;
    });

    document.getElementById("live-nav-link").textContent = t.title;
}

