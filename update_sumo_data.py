import argparse
import json
import os
import shutil
import tempfile
import urllib.request
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument(
    "--apply",
    action="store_true",
    help="Spara verifierade resultat"
)
args = parser.parse_args()

# Välj aktuell turneringsmånad automatiskt.
today_japan = datetime.now(ZoneInfo("Asia/Tokyo")).date()

tournament_months = (1, 3, 5, 7, 9, 11)

if today_japan.month not in tournament_months:
    raise SystemExit(
        "Ingen ordinarie sumoturnering denna månad."
    )

BASHO = f"{today_japan.year}{today_japan.month:02d}"

DIVISIONS = [
    "Makuuchi", "Juryo", "Makushita",
    "Sandanme", "Jonidan", "Jonokuchi"
]

tournament_url = f"https://www.sumo-api.com/api/basho/{BASHO}"
tournament_req = urllib.request.Request(
    tournament_url,
    headers={"User-Agent": "SumoStats/1.0"}
)

with urllib.request.urlopen(tournament_req, timeout=30) as response:
    tournament_info = json.load(response)

if not tournament_info.get("startDate") or not tournament_info.get("endDate"):
    raise SystemExit("STOPP: Turneringsdatum saknas i Sumo API.")

start_date = datetime.fromisoformat(
    tournament_info["startDate"].replace("Z", "+00:00")
).date()

end_date = datetime.fromisoformat(
    tournament_info["endDate"].replace("Z", "+00:00")
).date()

if not start_date <= today_japan <= end_date:
    raise SystemExit(
        f"Ingen pågående turnering. Datum: {start_date} till {end_date}"
    )

path = Path(f"tournaments/{BASHO}.json")

with path.open(encoding="utf-8") as f:
    data = json.load(f)

wrestlers = {w["id"]: w for w in data["wrestlers"]}
results = {}
seen = set()
completed = 0
errors = []
unknown = set()

for day in range(1, 16):
    for division in DIVISIONS:
        url = (
            "https://www.sumo-api.com/api/basho/"
            f"{BASHO}/torikumi/{division}/{day}"
        )

        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "SumoStats/1.0"}
            )

            with urllib.request.urlopen(req, timeout=30) as r:
                matches = json.load(r).get("torikumi", [])

            # Kontrollera att matchnumren är sammanhängande.
            if matches:
                numbers = [m.get("matchNo") for m in matches]

                if (
                    not all(type(n) is int and n > 0 for n in numbers)
                    or sorted(numbers) != list(range(1, len(matches) + 1))
                ):
                    errors.append(
                        f"Felaktiga matchnummer: {division}, dag {day}"
                    )

            # Stoppa om en tidigare tävlingsdag saknar matchlista.
            tournament_start = datetime.fromisoformat(
                tournament_info["startDate"].replace("Z", "+00:00")
            )

            match_date = tournament_start + timedelta(days=day - 1)
            today = datetime.now(ZoneInfo("Asia/Tokyo")).date()

            if match_date.date() < today:
                if not matches:
                    errors.append(
                        f"Saknade matcher: {division}, dag {day}"
                    )
                elif any(not m.get("winnerId") for m in matches):
                    errors.append(
                        f"Ofärdiga matcher: {division}, dag {day}"
                    )

            # Kontrollera att dagens matcher är avgjorda
            # i samtliga sex divisioner.
            if match_date.date() == today:
                if not matches:
                    errors.append(
                        f"Dag {day}: Matchlista saknas för {division}."
                    )
                elif any(not m.get("winnerId") for m in matches):
                    errors.append(
                        f"Dag {day}: Alla matcher är inte avgjorda "
                        f"i {division}."
                    )

            for match in matches:
                match_id = match.get("id")

                if not match_id or match_id in seen:
                    continue

                seen.add(match_id)

                winner = match.get("winnerId")
                if not winner:
                    if match_date.date() <= today:
                        errors.append(
                            f"Match saknar vinnare: {division}, "
                            f"dag {day}, match {match_id}"
                        )
                    continue

                east = match.get("eastId")
                west = match.get("westId")

                if winner not in (east, west):
                    errors.append(f"Ogiltig vinnare: {match_id}")
                    continue

                loser = west if winner == east else east

                if winner not in wrestlers or loser not in wrestlers:
                    unknown.update(
                        x for x in (winner, loser)
                        if x not in wrestlers
                    )
                    continue

                results.setdefault(
                    winner, {"wins": 0, "losses": 0}
                )["wins"] += 1

                results.setdefault(
                    loser, {"wins": 0, "losses": 0}
                )["losses"] += 1

                completed += 1

        except Exception as error:
            errors.append(f"{division}, dag {day}: {error}")

    print(f"Dag {day} kontrollerad")

# Säkerhetskontroll: tidigare resultat får inte minska.
regressions = []

for wrestler_id in wrestlers:
    result = results.get(wrestler_id, {"wins": 0, "losses": 0})
    wrestler = wrestlers[wrestler_id]

    if (
        result["wins"] < wrestler["wins"]
        or result["losses"] < wrestler["losses"]
    ):
        regressions.append(
            f'{wrestler["name"]}: '
            f'{wrestler["wins"]}-{wrestler["losses"]} -> '
            f'{result["wins"]}-{result["losses"]}'
        )

if regressions:
    errors.append(
        f"{len(regressions)} brottare har färre resultat än tidigare."
    )
    for item in regressions[:10]:
        errors.append(item)

changes = []

for wrestler_id in wrestlers:
    result = results.get(wrestler_id, {"wins": 0, "losses": 0})
    wrestler = wrestlers[wrestler_id]

    if (
        wrestler["wins"] != result["wins"]
        or wrestler["losses"] != result["losses"]
    ):
        changes.append((
            wrestler["name"],
            wrestler["wins"],
            wrestler["losses"],
            result["wins"],
            result["losses"]
        ))

print("\n========== FÖRHANDSGRANSKNING ==========")
print("Turnering:", BASHO)
print("Färdiga matcher:", completed)
print("Okända ID:", len(unknown))
print("API-/datafel:", len(errors))
print("Brottare med ändrade resultat:", len(changes))

for name, old_w, old_l, new_w, new_l in changes[:20]:
    print(f"{name}: {old_w}-{old_l} -> {new_w}-{new_l}")

if errors or unknown:
    print("\nVARNING: Uppdatering får inte genomföras ännu.")
    for error in errors[:10]:
        print(error)
else:
    print("\nKontrollen genomförd utan rapporterade fel.")

if args.apply:
    if errors or unknown:
        raise SystemExit("STOPP – uppdateringen är inte säker.")

    if not changes:
        print("\\nInga nya resultat att spara.")
    else:
        for wrestler in data["wrestlers"]:
            result = results.get(
                wrestler["id"],
                {"wins": 0, "losses": 0}
            )
            wrestler["wins"] = result["wins"]
            wrestler["losses"] = result["losses"]

        backup_dir = Path("backups")
        backup_dir.mkdir(exist_ok=True)

        timestamp = datetime.now(timezone.utc).strftime(
            "%Y%m%d-%H%M%S-%f"
        )

        backup = backup_dir / f"{BASHO}-{timestamp}.json"
        shutil.copy2(path, backup)

        temp_name = None

        try:
            with tempfile.NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=path.parent,
                prefix=".sumo-",
                suffix=".json",
                delete=False
            ) as temp:
                temp_name = temp.name
                json.dump(
                    data,
                    temp,
                    ensure_ascii=False,
                    indent=2
                )
                temp.write("\n")

            os.replace(temp_name, path)

        finally:
            if temp_name and os.path.exists(temp_name):
                os.unlink(temp_name)

        print("\\nUPPDATERING KLAR")
        print("Säkerhetskopia:", backup)
        print("Uppdaterad fil:", path)
else:
    print("\\nDRY RUN – INGA FILER HAR ÄNDRATS.")
