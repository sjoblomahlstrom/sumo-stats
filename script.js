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
    },
    ja: {
        welcome: "力士の番付や本場所の結果をご覧いただけます。",
        divisions: "相撲の階級",
        search: "力士を検索",
        searchPlaceholder: "力士名を入力（例：Onosato）",
        tournament: "本場所を選択",
        ranking: "番付",
        name: "力士",
        rank: "番付",
        wins: "勝",
        losses: "敗",
        loading: "力士データを読み込み中...",
        error: "相撲データを読み込めませんでした。",
        empty: "力士が見つかりませんでした。"
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

let careerStatistics = new Map();

async function loadCareerStatistics() {
    try {
        const response = await fetch("rikishi-career-stats.json");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        careerStatistics = new Map(
            Object.entries(data.wrestlers || {}).map(
                ([id, wrestler]) => [Number(id), wrestler]
            )
        );

        console.log(
            "Loaded career statistics:",
            careerStatistics.size
        );

    } catch (error) {
        console.error("Could not load career statistics:", error);
    }
}

loadCareerStatistics();

let wrestlerProfiles = new Map();

async function loadWrestlerProfiles() {
    try {
        const response = await fetch("rikishi-extended.json");

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

            // Reset comparison when opening a new wrestler
            document.getElementById("compare-section").hidden = true;
            document.getElementById("compare-select").value = "";
            document.getElementById("compare-results").replaceChildren();
            document.getElementById("compare-second-name").textContent = "—";


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

            // Career statistics
            const career = careerStatistics.get(wrestler.id) || {};

            const careerFields = {
                "career-wins": career.totalWins,
                "career-losses": career.totalLosses,
                "career-matches": career.totalMatches,
                "career-basho": career.basho,
                "career-yusho": career.yusho,
                "career-absence": career.totalAbsences
            };

            for (const [id, value] of Object.entries(careerFields)) {
                document.getElementById(id).textContent =
                    value ?? "—";
            }

            const sansho = career.sansho || {};
            const sanshoLabels = {
                "Gino-sho": "Gino-sho",
                "Kanto-sho": "Kanto-sho",
                "Shukun-sho": "Shukun-sho"
            };

            const sanshoText = Object.entries(sansho)
                .filter(([, count]) => count > 0)
                .map(([name, count]) =>
                    `${sanshoLabels[name] || name}: ${count}`
                )
                .join(" | ");

            document.getElementById("career-sansho").textContent =
                sanshoText || "—";

            // Extended wrestler information
            const birthDate = profile.birthDate
                ? new Date(profile.birthDate)
                : null;

            let age = "—";

            if (birthDate && !isNaN(birthDate.getTime())) {
                const today = new Date();
                age = today.getFullYear() - birthDate.getFullYear();

                if (
                    today.getMonth() < birthDate.getMonth() ||
                    (
                        today.getMonth() === birthDate.getMonth() &&
                        today.getDate() < birthDate.getDate()
                    )
                ) {
                    age--;
                }
            }

            document.getElementById("profile-birthdate").textContent =
                birthDate && !isNaN(birthDate.getTime())
                    ? birthDate.toLocaleDateString(
                        currentLanguage === "ja" ? "ja-JP" :
                        currentLanguage === "en" ? "en-GB" : "sv-SE"
                    )
                    : "—";

            document.getElementById("profile-age").textContent =
                age === "—" ? "—" :
                currentLanguage === "ja" ? age + "歳" :
                currentLanguage === "en" ? age + " years" :
                age + " år";

            document.getElementById("profile-birthplace").textContent =
                profile.birthplace || "—";

            document.getElementById("profile-debut").textContent =
                profile.debut
                    ? profile.debut.slice(0, 4) + "-" +
                      profile.debut.slice(4, 6)
                    : "—";


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
    const labelsByLanguage = {
        sv: {
            "profile-rank-label": "Ranking:",
            "profile-heya-label": "Stall:",
            "profile-height-label": "Längd:",
            "profile-weight-label": "Vikt:",
            "profile-birthdate-label": "Födelsedatum:",
            "profile-age-label": "Ålder:",
            "profile-birthplace-label": "Födelseort:",
            "profile-debut-label": "Professionell debut:",
            "profile-history-title": "Turneringshistorik",
            "history-tournament": "Turnering",
            "history-rank": "Ranking",
            "history-wins": "Vinster",
            "history-losses": "Förluster",
            close: "Stäng profil"
        },
        en: {
            "profile-rank-label": "Rank:",
            "profile-heya-label": "Stable:",
            "profile-height-label": "Height:",
            "profile-weight-label": "Weight:",
            "profile-birthdate-label": "Date of Birth:",
            "profile-age-label": "Age:",
            "profile-birthplace-label": "Birthplace:",
            "profile-debut-label": "Professional Debut:",
            "profile-history-title": "Tournament History",
            "history-tournament": "Tournament",
            "history-rank": "Rank",
            "history-wins": "Wins",
            "history-losses": "Losses",
            close: "Close profile"
        },
        ja: {
            "profile-rank-label": "番付:",
            "profile-heya-label": "部屋:",
            "profile-height-label": "身長:",
            "profile-weight-label": "体重:",
            "profile-birthdate-label": "生年月日:",
            "profile-age-label": "年齢:",
            "profile-birthplace-label": "出身地:",
            "profile-debut-label": "初土俵:",
            "profile-history-title": "本場所の成績",
            "history-tournament": "本場所",
            "history-rank": "番付",
            "history-wins": "勝",
            "history-losses": "敗",
            close: "プロフィールを閉じる"
        }
    };

    const labels = labelsByLanguage[currentLanguage] || labelsByLanguage.sv;

    for (const [id, value] of Object.entries(labels)) {
        if (id === "close") continue;
        document.getElementById(id).textContent = value;
    }

    document.getElementById("close-profile")
        .setAttribute("aria-label", labels.close);

    const dialog = document.getElementById("wrestler-profile");

    if (dialog.open && dialog.dataset.wrestlerId) {
        renderTournamentHistory(Number(dialog.dataset.wrestlerId));
    }
}


// Top 10 wrestlers by tournament wins
function renderTopWrestlers() {
    const tbody = document.getElementById("top-wrestlers-body");
    if (!tbody) return;

    const labels = {
        sv: {
            title: "🏆 Top 10 – Flest vinster",
            description: "De bästa brottarna i vald turnering och division.",
            position: "Placering"
        },
        en: {
            title: "🏆 Top 10 – Most wins",
            description: "Top wrestlers in the selected tournament and division.",
            position: "Position"
        },
        ja: {
            title: "🏆 トップ10 – 勝利数ランキング",
            description: "選択した本場所と階級の勝利数上位力士。",
            position: "順位"
        }
    };

    const t = translations[currentLanguage];
    const l = labels[currentLanguage];

    document.getElementById("top-wrestlers-title").textContent = l.title;
    document.getElementById("top-wrestlers-description").textContent =
        l.description;

    document.getElementById("top-th-position").textContent = l.position;
    document.getElementById("top-th-name").textContent = t.name;
    document.getElementById("top-th-wins").textContent = t.wins;
    document.getElementById("top-th-losses").textContent = t.losses;

    tbody.replaceChildren();

    const topWrestlers = wrestlers
        .filter(w => w.division === currentDivision ||
            getDivision(w) === currentDivision)
        .sort((a, b) =>
            (b.wins ?? 0) - (a.wins ?? 0) ||
            (a.losses ?? 0) - (b.losses ?? 0) ||
            (a.name || "").localeCompare(b.name || "")
        )
        .slice(0, 10);

    if (!topWrestlers.length) {
        const row = tbody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 4;
        cell.textContent = t.empty;
        return;
    }

    let previousRecord = null;
    let previousPosition = 0;

    topWrestlers.forEach((w, index) => {
        const record = `${w.wins ?? 0}-${w.losses ?? 0}`;

        if (record !== previousRecord) {
            previousPosition = index + 1;
            previousRecord = record;
        }

        const row = tbody.insertRow();

        row.insertCell().textContent = previousPosition;
        row.insertCell().textContent = w.name || "—";
        row.insertCell().textContent = w.wins ?? "—";
        row.insertCell().textContent = w.losses ?? "—";
    });
}


// Official sumo tournament calendar
let sumoCalendar = [];

const calendarTranslations = {
    sv: {
        title: "📅 Turneringskalender 2026",
        description: "Turneringar, datum och officiell biljettinformation.",
        month: "Turnering",
        dates: "Datum",
        location: "Plats",
        tickets: "Biljetter",
        link: "Officiell information"
    },
    en: {
        title: "📅 Tournament Calendar 2026",
        description: "Tournaments, dates and official ticket information.",
        month: "Tournament",
        dates: "Dates",
        location: "Location",
        tickets: "Tickets",
        link: "Official information"
    },
    ja: {
        title: "📅 大相撲本場所日程 2026",
        description: "本場所の日程、会場、公式チケット情報。",
        month: "本場所",
        dates: "日程",
        location: "会場",
        tickets: "チケット",
        link: "公式情報"
    }
};

function renderSumoCalendar() {
    const tbody = document.getElementById("calendar-body");
    if (!tbody) return;

    const t = calendarTranslations[currentLanguage];

    document.getElementById("calendar-title").textContent = t.title;
    document.getElementById("calendar-description").textContent =
        t.description;

    document.getElementById("calendar-th-month").textContent = t.month;
    document.getElementById("calendar-th-dates").textContent = t.dates;
    document.getElementById("calendar-th-location").textContent = t.location;
    document.getElementById("calendar-th-tickets").textContent = t.tickets;

    tbody.replaceChildren();

    const locale = {
        sv: "sv-SE",
        en: "en-GB",
        ja: "ja-JP"
    }[currentLanguage];

    for (const tournament of sumoCalendar) {
        const row = tbody.insertRow();

        row.insertCell().textContent = tournament.name;

        const start = new Date(tournament.start + "T12:00:00");
        const end = new Date(tournament.end + "T12:00:00");

        const formatter = new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "short",
            year: "numeric"
        });

        row.insertCell().textContent =
            `${formatter.format(start)} – ${formatter.format(end)}`;

        row.insertCell().textContent =
            `${tournament.city} – ${tournament.venue}`;

        const ticketCell = row.insertCell();
        const link = document.createElement("a");

        link.href = "https://www.sumo.or.jp/En/";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = t.link;

        ticketCell.appendChild(link);
    }
}

async function loadSumoCalendar() {
    try {
        const response = await fetch("sumo-calendar.json");

        if (!response.ok) {
            throw new Error(`Calendar HTTP ${response.status}`);
        }

        const data = await response.json();
        sumoCalendar = data.tournaments || [];

        renderSumoCalendar();

        console.log("Loaded tournaments:", sumoCalendar.length);
    } catch (error) {
        console.error("Calendar error:", error);

        const tbody = document.getElementById("calendar-body");
        if (tbody) {
            tbody.replaceChildren();
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 4;
            cell.textContent = translations[currentLanguage].error;
        }
    }
}

function updatePage() {
    const t = translations[currentLanguage];

    // Update tournament calendar language
    renderSumoCalendar();

    // Update Top 10 leaderboard
    renderTopWrestlers();

    updateProfileLanguage();
    updateCompareLanguage();

    document.documentElement.lang = currentLanguage;

    // Translate main website title
    const mainTitles = {
        sv: "Sumoranking och statistik",
        en: "Sumo Rankings & Statistics",
        ja: "大相撲ランキングと統計"
    };

    document.getElementById("main-title").textContent =
        mainTitles[currentLanguage] || mainTitles.sv;

    document.getElementById("welcome-text").textContent = t.welcome;

    const youtubeTranslations = {
        sv: {
            title: "Grand Sumo – Höjdpunkter",
            description: "Se dagliga sumohöjdpunkter från NHK WORLD-JAPAN under turneringarna.",
            button: "Besök YouTube-kanalen"
        },
        en: {
            title: "Grand Sumo – Highlights",
            description: "Watch daily sumo highlights from NHK WORLD-JAPAN during tournaments.",
            button: "Visit YouTube channel"
        },
        ja: {
            title: "大相撲 – ハイライト",
            description: "本場所期間中、NHK WORLD-JAPANの大相撲ハイライト動画をご覧ください。",
            button: "YouTubeチャンネルを見る"
        }
    };

    const yt = youtubeTranslations[currentLanguage];

    // Translate YouTube navigation link
    const youtubeNavTranslations = {
        sv: {
            text: "▶ NHK WORLD-JAPAN – Spellista ↗",
            title: "Öppna NHK WORLD-JAPANs sumospellista på YouTube"
        },
        en: {
            text: "▶ NHK WORLD-JAPAN – Playlist ↗",
            title: "Open NHK WORLD-JAPAN sumo playlist on YouTube"
        },
        ja: {
            text: "▶ NHK WORLD-JAPAN – 再生リスト ↗",
            title: "NHK WORLD-JAPANの相撲再生リストをYouTubeで開く"
        }
    };

    const navText = youtubeNavTranslations[currentLanguage];

    const youtubeNav = document.getElementById("youtube-nav-link");

    youtubeNav.textContent = navText.text;
    youtubeNav.title = navText.title;

    document.getElementById("youtube-title").textContent = yt.title;
    document.getElementById("youtube-description").textContent = yt.description;
    document.getElementById("youtube-button-text").textContent = yt.button;

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
    document.getElementById("ja-btn").classList.toggle(
        "active", currentLanguage === "ja"
    );

    document.querySelectorAll("[data-division]").forEach(button => {
        button.classList.toggle(
            "active", button.dataset.division === currentDivision
        );
    });

    renderWrestlers();

    if (typeof updateLiveLanguage === "function") {
        updateLiveLanguage();
    }

    if (typeof loadLiveResults === "function") {
        loadLiveResults();
    }
}

document.getElementById("sv-btn").addEventListener("click", () => {
    currentLanguage = "sv";
    updatePage();
});

document.getElementById("en-btn").addEventListener("click", () => {
    currentLanguage = "en";
    updatePage();
});

document.getElementById("ja-btn").addEventListener("click", () => {
    currentLanguage = "ja";
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

// Sumo Stats – Compare Wrestlers
document.getElementById("compare-wrestler-btn")
    .addEventListener("click", () => {
        const section = document.getElementById("compare-section");
        const select = document.getElementById("compare-select");
        const dialog = document.getElementById("wrestler-profile");

        const firstId = Number(dialog.dataset.wrestlerId);

        section.hidden = false;
        document.getElementById("compare-search").value = "";
        select.replaceChildren();

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = {
            sv: "Välj brottare",
            en: "Select wrestler",
            ja: "力士を選択"
        }[currentLanguage] || "Välj brottare";

        select.appendChild(placeholder);

        const available = Array.from(wrestlerProfiles.values())
            .filter(w => Number(w.id) !== firstId)
            .sort((a, b) =>
                (a.name || "").localeCompare(b.name || "")
            );

        for (const wrestler of available) {
            const option = document.createElement("option");
            option.value = wrestler.id;
            option.textContent = wrestler.name;
            select.appendChild(option);
        }

        document.getElementById("compare-first-name").textContent =
            document.getElementById("profile-name").textContent;

        document.getElementById("compare-second-name").textContent = "—";
        document.getElementById("compare-results").replaceChildren();
    });


// Filter wrestlers in comparison dropdown
document.getElementById("compare-search")
    .addEventListener("input", event => {
        const query = event.target.value.trim().toLocaleLowerCase();
        const select = document.getElementById("compare-select");
        const firstId = Number(
            document.getElementById("wrestler-profile").dataset.wrestlerId
        );

        const previousValue = select.value;

        const available = Array.from(wrestlerProfiles.values())
            .filter(w => Number(w.id) !== firstId)
            .filter(w => (w.name || "").toLocaleLowerCase().includes(query))
            .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        select.replaceChildren();

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = {
            sv: "Välj brottare",
            en: "Select wrestler",
            ja: "力士を選択"
        }[currentLanguage] || "Välj brottare";

        select.appendChild(placeholder);

        for (const wrestler of available) {
            const option = document.createElement("option");
            option.value = wrestler.id;
            option.textContent = wrestler.name;
            select.appendChild(option);
        }

        select.value = previousValue;

        if (select.selectedIndex === -1) {
            select.value = "";
            select.dispatchEvent(new Event("change"));
        }
    });

// Clickable wrestler search results
const compareSearch = document.getElementById("compare-search");
const compareResults = document.getElementById("compare-search-results");
const compareSelect = document.getElementById("compare-select");

function showCompareSearchResults() {
    const query = compareSearch.value.trim().toLocaleLowerCase();
    compareResults.replaceChildren();
    compareResults.hidden = true;

    if (!query) return;

    const firstId = Number(
        document.getElementById("wrestler-profile").dataset.wrestlerId
    );

    const matches = Array.from(wrestlerProfiles.values())
        .filter(w => Number(w.id) !== firstId)
        .filter(w => (w.name || "").toLocaleLowerCase().includes(query))
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        .slice(0, 30);

    for (const wrestler of matches) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "compare-search-item";
        button.textContent = wrestler.name;

        button.addEventListener("click", () => {
            // Restore selected wrestler if the dropdown was filtered
            if (!Array.from(compareSelect.options).some(
                option => option.value === String(wrestler.id)
            )) {
                const option = document.createElement("option");
                option.value = wrestler.id;
                option.textContent = wrestler.name;
                compareSelect.appendChild(option);
            }

            compareSelect.value = String(wrestler.id);
            compareSelect.dispatchEvent(new Event("change"));

            compareSearch.value = wrestler.name;
            compareResults.hidden = true;
        });

        compareResults.appendChild(button);
    }

    if (!matches.length) {
        const message = document.createElement("p");
        message.textContent = "Inga brottare hittades";
        compareResults.appendChild(message);
    }

    compareResults.hidden = false;
}

compareSearch.addEventListener("input", showCompareSearchResults);

// Compare Wrestlers – Extended Statistics
document.getElementById("compare-select")
    .addEventListener("change", event => {

        const firstId = Number(
            document.getElementById("wrestler-profile")
                .dataset.wrestlerId
        );

        const secondId = Number(event.target.value);
        const tbody = document.getElementById("compare-results");

        tbody.replaceChildren();

        if (!event.target.value) {
            document.getElementById("compare-second-name").textContent = "—";
            return;
        }

        const first = wrestlerProfiles.get(firstId) || {};
        const second = wrestlerProfiles.get(secondId) || {};

        const firstTournament = statistics.get(firstId) || {};
        const secondTournament = statistics.get(secondId) || {};

        // Career statistics
        const firstCareer = careerStatistics.get(firstId) || {};
        const secondCareer = careerStatistics.get(secondId) || {};


        const firstCurrent = wrestlers.find(w => w.id === firstId) || {};
        const secondCurrent = wrestlers.find(w => w.id === secondId) || {};

        document.getElementById("compare-first-name").textContent =
            first.name || firstCurrent.name || "—";

        document.getElementById("compare-second-name").textContent =
            second.name || secondCurrent.name || "—";

        function calculateAge(dateString) {
            if (!dateString) return null;

            const birth = new Date(dateString);
            if (isNaN(birth.getTime())) return null;

            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();

            if (
                today.getMonth() < birth.getMonth() ||
                (
                    today.getMonth() === birth.getMonth() &&
                    today.getDate() < birth.getDate()
                )
            ) {
                age--;
            }

            return age;
        }

        function formatBirthDate(dateString) {
            if (!dateString) return "—";

            const date = new Date(dateString);
            if (isNaN(date.getTime())) return "—";

            return date.toLocaleDateString(
                currentLanguage === "ja" ? "ja-JP" :
                currentLanguage === "en" ? "en-GB" : "sv-SE"
            );
        }

        function formatDebut(value) {
            if (!value || String(value).length !== 6) return "—";
            return String(value).slice(0, 4) + "-" +
                   String(value).slice(4, 6);
        }

        const labels = {
            sv: [
                "Ranking", "Vinster", "Förluster", "Längd",
                "Vikt", "Stall", "Födelsedatum", "Ålder",
                "Födelseort", "Professionell debut"
            ],
            en: [
                "Rank", "Wins", "Losses", "Height",
                "Weight", "Stable", "Date of Birth", "Age",
                "Birthplace", "Professional Debut"
            ],
            ja: [
                "番付", "勝", "敗", "身長",
                "体重", "部屋", "生年月日", "年齢",
                "出身地", "初土俵"
            ]
        }[currentLanguage] || [
            "Ranking", "Vinster", "Förluster", "Längd",
            "Vikt", "Stall", "Födelsedatum", "Ålder",
            "Födelseort", "Professionell debut"
        ];

        const age1 = calculateAge(first.birthDate);
        const age2 = calculateAge(second.birthDate);

        const rows = [
            [firstCurrent.rank || first.rank, secondCurrent.rank || second.rank],
            [firstTournament.wins, secondTournament.wins],
            [firstTournament.losses, secondTournament.losses],
            [
                first.height != null ? first.height + " cm" : null,
                second.height != null ? second.height + " cm" : null
            ],
            [
                first.weight != null ? first.weight + " kg" : null,
                second.weight != null ? second.weight + " kg" : null
            ],
            [first.heya, second.heya],
            [formatBirthDate(first.birthDate), formatBirthDate(second.birthDate)],
            [
                age1 == null ? null :
                    currentLanguage === "ja" ? age1 + "歳" :
                    currentLanguage === "en" ? age1 + " years" : age1 + " år",
                age2 == null ? null :
                    currentLanguage === "ja" ? age2 + "歳" :
                    currentLanguage === "en" ? age2 + " years" : age2 + " år"
            ],
            [first.birthplace, second.birthplace],
            [formatDebut(first.debut), formatDebut(second.debut)],

            [firstCareer.totalWins, secondCareer.totalWins],
            [firstCareer.totalLosses, secondCareer.totalLosses],
            [firstCareer.totalMatches, secondCareer.totalMatches],
            [firstCareer.basho, secondCareer.basho],
            [firstCareer.yusho, secondCareer.yusho],
            [firstCareer.totalAbsences, secondCareer.totalAbsences],

            [
                careerStatistics.has(firstId)
                    ? (firstCareer.sansho?.["Gino-sho"] ?? 0) : null,
                careerStatistics.has(secondId)
                    ? (secondCareer.sansho?.["Gino-sho"] ?? 0) : null
            ],
            [
                careerStatistics.has(firstId)
                    ? (firstCareer.sansho?.["Kanto-sho"] ?? 0) : null,
                careerStatistics.has(secondId)
                    ? (secondCareer.sansho?.["Kanto-sho"] ?? 0) : null
            ],
            [
                careerStatistics.has(firstId)
                    ? (firstCareer.sansho?.["Shukun-sho"] ?? 0) : null,
                careerStatistics.has(secondId)
                    ? (secondCareer.sansho?.["Shukun-sho"] ?? 0) : null
            ]
        ];

        const careerLabels = {
            sv: [
                "Karriärvinster", "Karriärförluster", "Karriärmatcher",
                "Turneringar", "Mästerskap (Yusho)", "Frånvaro",
                "Teknikpris (Gino-sho)", "Fighting Spirit (Kanto-sho)",
                "Prestationspris (Shukun-sho)"
            ],
            en: [
                "Career Wins", "Career Losses", "Career Matches",
                "Tournaments", "Championships (Yusho)", "Absences",
                "Technique Prize (Gino-sho)",
                "Fighting Spirit Prize (Kanto-sho)",
                "Outstanding Performance (Shukun-sho)"
            ],
            ja: [
                "通算勝利", "通算敗北", "通算取組数",
                "本場所数", "優勝回数", "休場回数",
                "技能賞", "敢闘賞", "殊勲賞"
            ]
        };

        const extraLabels =
            careerLabels[currentLanguage] || careerLabels.sv;

        labels.push(...extraLabels);

        rows.forEach((values, index) => {
            const row = tbody.insertRow();

            row.insertCell().textContent = labels[index];
            row.insertCell().textContent = values[0] ?? "—";
            row.insertCell().textContent = values[1] ?? "—";
        });
    });

// Close wrestler comparison
document.getElementById("close-compare-btn")
    .addEventListener("click", () => {
        const section = document.getElementById("compare-section");
        const select = document.getElementById("compare-select");

        section.hidden = true;
        select.value = "";

        document.getElementById("compare-results").replaceChildren();
        document.getElementById("compare-second-name").textContent = "—";
    });

// Sumo Stats – Comparison translations
function updateCompareLanguage() {
    const translations = {
        sv: {
            button: "⚔️ Jämför med annan brottare",
            title: "⚔️ Jämför brottare",
            selectLabel: "Välj en annan brottare:",
            placeholder: "Välj brottare",
            close: "Stäng jämförelsen",
            statistic: "Statistik"
        },
        en: {
            button: "⚔️ Compare with another wrestler",
            title: "⚔️ Compare Wrestlers",
            selectLabel: "Select another wrestler:",
            placeholder: "Select wrestler",
            close: "Close comparison",
            statistic: "Statistics"
        },
        ja: {
            button: "⚔️ 他の力士と比較",
            title: "⚔️ 力士を比較",
            selectLabel: "比較する力士を選択:",
            placeholder: "力士を選択",
            close: "比較を閉じる",
            statistic: "統計"
        }
    };

    const t = translations[currentLanguage] || translations.sv;

    document.getElementById("compare-wrestler-btn").textContent = t.button;
    document.getElementById("compare-title").textContent = t.title;
    document.getElementById("compare-select-label").textContent = t.selectLabel;
    document.getElementById("compare-stat-header").textContent = t.statistic;
    document.getElementById("close-compare-btn").setAttribute("aria-label", t.close);

    const select = document.getElementById("compare-select");
    const placeholder = select.querySelector('option[value=""]');

    if (placeholder) {
        placeholder.textContent = t.placeholder;
    }

    const dialog = document.getElementById("wrestler-profile");

    if (
        dialog.open &&
        !document.getElementById("compare-section").hidden &&
        select.value
    ) {
        select.dispatchEvent(new Event("change"));
    }
}


// Load tournament calendar
loadSumoCalendar();
