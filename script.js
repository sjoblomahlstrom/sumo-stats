let currentLanguage = "sv";
let currentDivision = "Makuuchi";
let wrestlers = [];
let statistics = new Map();

const translations = {
    sv: {
        welcome: "Upptäck sumobrottare, ranking och turneringsresultat.",
        divisions: "Sumodivisioner",
        search: "Sök efter sumobrottare",
        searchPlaceholder: "Skriv ett namn, t.ex. Onosato",
        tournament: "Välj sumoturnering",
        ranking: "Ranking",
        name: "Sumobrottare",
        rank: "Ranking",
        wins: "Vinster",
        losses: "Förluster",
        loading: "Laddar sumobrottare...",
        error: "Kunde inte ladda sumodata.",
        empty: "Inga brottare hittades."
    },
    en: {
        welcome: "Discover sumo wrestlers, rankings and tournament results.",
        divisions: "Sumo Divisions",
        search: "Search for a sumo wrestler",
        searchPlaceholder: "Enter a name, e.g. Onosato",
        tournament: "Select sumo tournament",
        ranking: "Rankings",
        name: "Wrestler",
        rank: "Rank",
        wins: "Wins",
        losses: "Losses",
        loading: "Loading wrestlers...",
        error: "Could not load sumo data.",
        empty: "No wrestlers found."
    }
};

const divisionRanks = {
    Makuuchi: ["Yokozuna", "Ozeki", "Sekiwake", "Komusubi", "Maegashira"],
    Juryo: ["Juryo"],
    Makushita: ["Makushita"],
    Sandanme: ["Sandanme"],
    Jonidan: ["Jonidan"],
    Jonokuchi: ["Jonokuchi"]
};

function getDivision(wrestler) {
    const rank = (wrestler.rank || "").toLowerCase();

    for (const [division, ranks] of Object.entries(divisionRanks)) {
        if (ranks.some(r => rank.startsWith(r.toLowerCase()))) {
            return division;
        }
    }

    return null;
}

function rankSort(a, b) {
    const rankOrder = [
        "Yokozuna", "Ozeki", "Sekiwake", "Komusubi",
        "Maegashira", "Juryo", "Makushita",
        "Sandanme", "Jonidan", "Jonokuchi"
    ];

    function rankKey(wrestler) {
        const rank = wrestler.rank || "";
        const type = rankOrder.findIndex(r =>
            rank.toLowerCase().startsWith(r.toLowerCase())
        );
        const number = parseInt(rank.match(/\d+/)?.[0] || "0", 10);
        const side = /East/i.test(rank) ? 0 : 1;
        return [type, number, side];
    }

    const x = rankKey(a);
    const y = rankKey(b);

    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

let wrestlerProfiles = new Map();

async function loadWrestlerProfiles() {
    try {
        const response = await fetch("rikishi.json");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        wrestlerProfiles = new Map(
            (data.wrestlers || []).map(w => [w.id, w])
        );

        console.log("Loaded wrestler profiles:", wrestlerProfiles.size);

    } catch (error) {
        console.error("Could not load wrestler profiles:", error);
    }
}

loadWrestlerProfiles();

const tournamentHistory = new Map();

const tournamentIds = [
    "202601", "202603", "202605",
    "202607", "202609", "202611"
];

async function loadTournamentHistory() {
    const results = await Promise.allSettled(
        tournamentIds.map(async basho => {
            const response = await fetch(`tournaments/${basho}.json`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${basho}`);
            }

            const data = await response.json();
            return { basho, wrestlers: data.wrestlers || [] };
        })
    );

    results.forEach((result, index) => {
        if (result.status === "fulfilled") {
            tournamentHistory.set(
                result.value.basho,
                new Map(result.value.wrestlers.map(w => [w.id, w]))
            );
        } else {
            console.error(
                "Could not load tournament:",
                tournamentIds[index],
                result.reason
            );
        }
    });

    console.log("Tournament history loaded:", tournamentHistory.size);

    const dialog = document.getElementById("wrestler-profile");

    if (dialog.open && dialog.dataset.wrestlerId) {
        renderTournamentHistory(Number(dialog.dataset.wrestlerId));
    }
}

loadTournamentHistory();

function renderTournamentHistory(wrestlerId) {
    const tbody = document.getElementById("profile-history-body");
    tbody.replaceChildren();

    const months = {
        "01": ["Januari", "January"],
        "03": ["Mars", "March"],
        "05": ["Maj", "May"],
        "07": ["Juli", "July"],
        "09": ["September", "September"],
        "11": ["November", "November"]
    };

    for (const basho of tournamentIds) {
        const wrestler = tournamentHistory.get(basho)?.get(wrestlerId);
        const row = tbody.insertRow();

        const month = months[basho.slice(4)];
        const monthName = currentLanguage === "sv" ? month[0] : month[1];

        row.insertCell().textContent =
            `${monthName} ${basho.slice(0, 4)}`;

        row.insertCell().textContent = wrestler?.rank || "—";
        row.insertCell().textContent = wrestler?.wins ?? "—";
        row.insertCell().textContent = wrestler?.losses ?? "—";
    }
}

function renderWrestlers() {
    const tbody = document.getElementById("ranking-body");
    const t = translations[currentLanguage];

    tbody.replaceChildren();

    const searchInput = document.getElementById("wrestler-search");
    const query = searchInput.value.trim().toLowerCase();

    const filtered = wrestlers
        .filter(w => {
            if (query) {
                return (w.name || "").toLowerCase().includes(query);
            }
            return getDivision(w) === currentDivision;
        })
        .sort(rankSort);

    if (!filtered.length) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 4;
        cell.textContent = t.empty;
        return;
    }

    for (const wrestler of filtered) {
        const row = tbody.insertRow();

        const name = row.insertCell();

        const profileButton = document.createElement("button");
        profileButton.type = "button";
        profileButton.className = "wrestler-name-button";
        profileButton.textContent = wrestler.name || "Unknown";

        profileButton.addEventListener("click", () => {
            const profile = wrestlerProfiles.get(wrestler.id) || {};
            const dialog = document.getElementById("wrestler-profile");

            document.getElementById("profile-name").textContent =
                wrestler.name || "Unknown";

            document.getElementById("profile-japanese-name").textContent =
                profile.japaneseName || "";

            document.getElementById("profile-rank").textContent =
                wrestler.rank || "—";

            document.getElementById("profile-heya").textContent =
                profile.heya || "—";

            document.getElementById("profile-height").textContent =
                profile.height != null ? profile.height + " cm" : "—";

            document.getElementById("profile-weight").textContent =
                profile.weight != null ? profile.weight + " kg" : "—";

            const profileImage = document.getElementById("profile-image");

            profileImage.hidden = true;
            profileImage.removeAttribute("src");
            profileImage.alt = wrestler.name;

            const imagePath = `images/wrestlers/${wrestler.id}.jpg`;

            profileImage.onload = () => {
                profileImage.hidden = false;
            };

            profileImage.dataset.fallback = "false";

            profileImage.onerror = () => {
                if (profileImage.dataset.fallback === "true") {
                    profileImage.hidden = true;
                    return;
                }

                profileImage.dataset.fallback = "true";
                profileImage.src = "images/wrestlers/default.svg";
            };

            dialog.dataset.wrestlerId = wrestler.id;
            profileImage.hidden = false;
            profileImage.src = imagePath;

            renderTournamentHistory(wrestler.id);
            dialog.showModal();
        });

        name.appendChild(profileButton);

        const rank = row.insertCell();
        rank.textContent = wrestler.rank || "—";

        const wins = row.insertCell();
        wins.textContent = statistics.get(wrestler.id)?.wins ?? "—";

        const losses = row.insertCell();
        losses.textContent = statistics.get(wrestler.id)?.losses ?? "—";
    }
}

document.getElementById("close-profile")
    .addEventListener("click", () => {
        document.getElementById("wrestler-profile").close();
    });

function updateProfileLanguage() {
    const sv = currentLanguage === "sv";

    const labels = {
        "profile-rank-label": sv ? "Ranking:" : "Rank:",
        "profile-heya-label": sv ? "Stall:" : "Stable:",
        "profile-height-label": sv ? "Längd:" : "Height:",
        "profile-weight-label": sv ? "Vikt:" : "Weight:",
        "profile-history-title": sv
            ? "Turneringshistorik"
            : "Tournament History",
        "history-tournament": sv ? "Turnering" : "Tournament",
        "history-rank": sv ? "Ranking" : "Rank",
        "history-wins": sv ? "Vinster" : "Wins",
        "history-losses": sv ? "Förluster" : "Losses"
    };

    for (const [id, value] of Object.entries(labels)) {
        document.getElementById(id).textContent = value;
    }

    document.getElementById("close-profile").setAttribute(
        "aria-label",
        sv ? "Stäng profil" : "Close profile"
    );

    const dialog = document.getElementById("wrestler-profile");

    if (dialog.open && dialog.dataset.wrestlerId) {
        renderTournamentHistory(Number(dialog.dataset.wrestlerId));
    }
}

function updatePage() {
    const t = translations[currentLanguage];

    updateProfileLanguage();

    document.documentElement.lang = currentLanguage;

    document.getElementById("welcome-text").textContent = t.welcome;

    document.getElementById("youtube-title").textContent =
        currentLanguage === "sv"
        ? "Grand Sumo – Höjdpunkter"
        : "Grand Sumo – Highlights";

    document.getElementById("youtube-description").textContent =
        currentLanguage === "sv"
        ? "Se dagliga sumohöjdpunkter från NHK WORLD-JAPAN under turneringarna."
        : "Watch daily sumo highlights from NHK WORLD-JAPAN during tournaments.";

    document.getElementById("youtube-button-text").textContent =
        currentLanguage === "sv"
        ? "Besök YouTube-kanalen"
        : "Visit YouTube channel";
    document.getElementById("search-label").textContent = t.search;
    document.getElementById("wrestler-search").placeholder =
        t.searchPlaceholder;
    document.getElementById("division-title").textContent = t.divisions;
    document.getElementById("tournament-label").textContent = t.tournament;
    document.getElementById("ranking-title").textContent =
        `${t.ranking} – ${currentDivision}`;

    document.getElementById("th-name").textContent = t.name;
    document.getElementById("th-rank").textContent = t.rank;
    document.getElementById("th-wins").textContent = t.wins;
    document.getElementById("th-losses").textContent = t.losses;

    document.getElementById("sv-btn").classList.toggle(
        "active", currentLanguage === "sv"
    );
    document.getElementById("en-btn").classList.toggle(
        "active", currentLanguage === "en"
    );

    document.querySelectorAll("[data-division]").forEach(button => {
        button.classList.toggle(
            "active", button.dataset.division === currentDivision
        );
    });

    renderWrestlers();
}

document.getElementById("sv-btn").addEventListener("click", () => {
    currentLanguage = "sv";
    updatePage();
});

document.getElementById("en-btn").addEventListener("click", () => {
    currentLanguage = "en";
    updatePage();
});

document.querySelectorAll("[data-division]").forEach(button => {
    button.addEventListener("click", () => {
        currentDivision = button.dataset.division;
        updatePage();
    });
});

document.getElementById("wrestler-search")
    .addEventListener("input", () => {
        renderWrestlers();
    });

async function loadTournament(basho) {
    const tbody = document.getElementById("ranking-body");

    try {
        const response = await fetch(`tournaments/${basho}.json`);

        if (!response.ok) {
            throw new Error(`Tournament HTTP ${response.status}`);
        }

        const data = await response.json();

        wrestlers = data.wrestlers || [];

        statistics = new Map(
            wrestlers.map(w => [w.id, w])
        );

        updatePage();

        console.log("Loaded tournament:", basho);
        console.log("Wrestlers:", wrestlers.length);

    } catch (error) {
        console.error(error);

        tbody.replaceChildren();

        const row = tbody.insertRow();
        const cell = row.insertCell();

        cell.colSpan = 4;
        cell.textContent = translations[currentLanguage].error;
    }
}

document.getElementById("tournament-select")
    .addEventListener("change", event => {
        loadTournament(event.target.value);
    });

async function loadWrestlers() {
    const tbody = document.getElementById("ranking-body");
    tbody.rows[0].cells[0].textContent =
        translations[currentLanguage].loading;

    try {
        const response = await fetch("rikishi.json");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        wrestlers = data.wrestlers || [];

        const statsResponse = await fetch("sumo-all-statistics.json");

        if (!statsResponse.ok) {
            throw new Error(`Statistics HTTP ${statsResponse.status}`);
        }

        const statsData = await statsResponse.json();

        statistics = new Map(
            (statsData.wrestlers || []).map(w => [w.id, w])
        );

        updatePage();
        console.log("Loaded wrestlers:", wrestlers.length);
    } catch (error) {
        console.error(error);
        tbody.rows[0].cells[0].textContent =
            translations[currentLanguage].error;
    }
}

loadTournament(
    document.getElementById("tournament-select").value
);
