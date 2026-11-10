import json
import urllib.request
from pathlib import Path

BASHO = "202611"

DIVISIONS = [
    "Makuuchi",
    "Juryo",
    "Makushita",
    "Sandanme",
    "Jonidan",
    "Jonokuchi"
]

BASE_URL = "https://www.sumo-api.com/api"

def fetch_matches(division, day):
    url = f"{BASE_URL}/basho/{BASHO}/torikumi/{division}/{day}"

    request = urllib.request.Request(
        url,
        headers={"User-Agent": "SumoStats/1.0"}
    )

    with urllib.request.urlopen(request, timeout=20) as response:
        data = json.load(response)

    return data.get("torikumi", [])

def calculate_results():
    results = {}
    counted_matches = set()

    for division in DIVISIONS:
        for day in range(1, 4):
            try:
                matches = fetch_matches(division, day)
            except Exception as error:
                print(f"Fel {division}, dag {day}: {error}")
                continue

            completed = 0

            for match in matches:
                match_id = match.get("id")
                east = match.get("eastId")
                west = match.get("westId")
                winner = match.get("winnerId")

                if not match_id or match_id in counted_matches:
                    continue

                if winner not in (east, west) or east == west:
                    continue

                loser = west if winner == east else east

                counted_matches.add(match_id)

                results.setdefault(winner, {"wins": 0, "losses": 0})
                results.setdefault(loser, {"wins": 0, "losses": 0})

                results[winner]["wins"] += 1
                results[loser]["losses"] += 1

                completed += 1

            print(f"{division} dag {day}: {completed} resultat")

    return results

if __name__ == "__main__":
    print("Hämtar resultat från Sumo API...")
    results = calculate_results()

    print("\nAntal brottare med resultat:", len(results))
    print("Antal registrerade vinster:",
          sum(r["wins"] for r in results.values()))
    print("Antal registrerade förluster:",
          sum(r["losses"] for r in results.values()))

    # Endast förhandsgranskning.
    # Ingen turneringsfil ändras.
