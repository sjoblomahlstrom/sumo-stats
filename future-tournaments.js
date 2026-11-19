"use strict";

const futureTournaments = [
    ["January", "Hatsu Basho", "Tokyo"],
    ["March", "Haru Basho", "Osaka"],
    ["May", "Natsu Basho", "Tokyo"],
    ["July", "Nagoya Basho", "Nagoya"],
    ["September", "Aki Basho", "Tokyo"],
    ["November", "Kyushu Basho", "Fukuoka"]
];

const futureMonths = {
    sv: ["Januari", "Mars", "Maj", "Juli", "September", "November"],
    en: ["January", "March", "May", "July", "September", "November"],
    ja: ["1月", "3月", "5月", "7月", "9月", "11月"]
};

function renderFutureTournaments() {
    const year = document.getElementById("future-year").value;
    const body = document.getElementById("future-body");
    const lang = typeof currentLanguage !== "undefined" ? currentLanguage : document.documentElement.lang;
    const language = futureMonths[lang] ? lang : "sv";

    const unknownDates = {
        sv: "Datum ej bekräftat",
        en: "Dates not confirmed",
        ja: "日程未確認"
    };

    body.replaceChildren();

    futureTournaments.forEach((tournament, index) => {
        const row = body.insertRow();

        [
            futureMonths[language][index],
            tournament[1],
            tournament[2],
            unknownDates[language]
        ].forEach(value => {
            row.insertCell().textContent = value;
        });
    });

    console.log("Future sumo tournaments loaded:", year);
}

document.getElementById("future-year")
    .addEventListener("change", renderFutureTournaments);

renderFutureTournaments();
