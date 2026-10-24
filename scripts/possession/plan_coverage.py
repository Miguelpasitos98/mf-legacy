#!/usr/bin/env python3
"""Plan historical possession coverage from the existing MF Legacy league catalog.

Offline planning only. This never contacts FotMob or modifies your app.
"""
import argparse
import csv
import json
from pathlib import Path

CALENDAR_LEAGUES = {"MLS", "Eliteserien", "Liga Profesional", "Campeonato Brasileiro Série A", "Série A"}
ALIASES_REVIEW = [
    ["EFL Championship", "Sky Bet Championship"],
    ["Campeonato Brasileiro Série A", "Série A"],
]


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--leagues", type=Path, required=True)
    p.add_argument("--existing", type=Path, help="Optional current TeamSeasonPossession JSON export")
    p.add_argument("--from-year", type=int, default=2015)
    p.add_argument("--to-year", type=int, default=2026)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    if args.to_year < args.from_year or args.to_year > 2100 or args.from_year < 1900:
        p.error("Invalid year range")
    source = json.loads(args.leagues.read_text(encoding="utf-8"))
    leagues = source if isinstance(source, list) else source.get("records", [])
    names = sorted({str(r["name"]).strip() for r in leagues if isinstance(r, dict) and r.get("name")})
    existing = []
    if args.existing:
        obj = json.loads(args.existing.read_text(encoding="utf-8"))
        existing = obj if isinstance(obj, list) else obj.get("records", [])
    counts = {}
    for row in existing:
        key = (str(row.get("competition", "")).casefold(), str(row.get("season", "")))
        counts[key] = counts.get(key, 0) + 1
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["competition", "season", "existing_records", "status"])
        writer.writeheader()
        for name in names:
            for year in range(args.from_year, args.to_year + 1):
                season = str(year) if name in CALENDAR_LEAGUES else f"{year}/{year+1}"
                n = counts.get((name.casefold(), season), 0)
                writer.writerow(dict(competition=name, season=season,
                                     existing_records=n, status="partial_or_review" if n else "missing"))
    aliases = [group for group in ALIASES_REVIEW if set(group).issubset(names)]
    print(f"Planned {len(names)} leagues × {args.to_year-args.from_year+1} years = {len(names)*(args.to_year-args.from_year+1)} slots")
    if aliases:
        print("Potential overlapping competition entries (not merged): " + repr(aliases))
    print("Calendar-year classification is provisional; review historical seasons before importing.")
    print("A record count >0 does not prove a season is complete; check the actual number of clubs.")


if __name__ == "__main__":
    main()
