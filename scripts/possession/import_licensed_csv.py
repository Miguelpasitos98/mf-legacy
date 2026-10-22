#!/usr/bin/env python3
"""Import explicitly licensed team-season possession CSV exports into MF Legacy.

This tool makes no network calls. It accepts one row per team, competition and
season, requiring traceable provenance. It never writes into the live app.
"""
import argparse
import csv
import json
from pathlib import Path

LEAGUES = {
    "LaLiga EA Sports", "Premier League", "Serie A", "Bundesliga", "Ligue 1"
}

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--input", required=True, type=Path, help="Licensed CSV with a team-season percentage per row")
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    records, errors, seen = [], [], set()
    with args.input.open(encoding="utf-8-sig", newline="") as f:
        for i, row in enumerate(csv.DictReader(f), 2):
            try:
                comp = str(row.get("competition") or "").strip()
                team = str(row.get("team_name") or "").strip()
                season = str(row.get("season") or "").strip()
                url = str(row.get("source_url") or "").strip()
                license_name = str(row.get("source_license") or "").strip()
                source = str(row.get("source") or "").strip()
                if comp not in LEAGUES:
                    raise ValueError("competition outside the big five")
                if not team or not source or not license_name or not url.startswith("https://"):
                    raise ValueError("team, source, source_license and HTTPS source_url required")
                if len(season) != 9 or season[4] != "/" or not season[:4].isdigit() or not season[5:].isdigit() or int(season[5:]) != int(season[:4]) + 1 or not 2016 <= int(season[:4]) <= 2025:
                    raise ValueError("season outside 2016/2017–2025/2026")
                value = float(str(row.get("team_possession_pct") or "").replace(",", "."))
                if not 0 < value < 100:
                    raise ValueError("invalid percentage")
                external_id = str(row.get("fotmob_team_id") or "").strip()
                key = (comp, season, external_id or team.casefold())
                if key in seen:
                    raise ValueError("duplicate team-season")
                seen.add(key)
                item = {
                    "team_name":team, "competition":comp, "season":season,
                    "team_possession_pct":value, "source":source,
                    "source_url":url, "verification_status":"pending",
                    "notes":f"Origen declarado: {source}; licencia declarada: {license_name}. Pendiente de contrastar."
                }
                if external_id:
                    if not external_id.isdecimal():
                        raise ValueError("invalid FotMob team ID")
                    item["fotmob_team_id"] = external_id
                records.append(item)
            except (ValueError, TypeError) as e:
                errors.append(f"CSV line {i}: {e}")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if errors:
        args.output.with_suffix(".errors.json").write_text(json.dumps(errors, indent=2, ensure_ascii=False), encoding="utf-8")
        raise SystemExit(f"Rejected {len(errors)} rows; no JSON was generated")
    args.output.write_text(json.dumps({"records":records}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Prepared {len(records)} candidate records for REVIEW (not imported)")

if __name__ == "__main__":
    main()
