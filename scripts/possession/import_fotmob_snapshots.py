#!/usr/bin/env python3
"""Convert authorised FotMob team-possession JSON exports to MF Legacy imports.

No remote requests, authentication, bypass, or writes to a live application.
Input snapshots must contain the competition, season, and explicit possession
percentages. Unknown or ambiguous identities are reported, never invented.
"""
import argparse
import json
import re
from pathlib import Path

POSS_KEYS = ("team_possession_pct", "possession_percentage_team", "possession_pct", "possession")
TEAM_KEYS = ("team_name", "teamName", "name")
ID_KEYS = ("fotmob_team_id", "teamId", "team_id", "id")


def items(obj):
    if isinstance(obj, list):
        return obj
    if isinstance(obj, dict):
        for key in ("records", "rows", "teams", "data", "items", "results"):
            x = obj.get(key)
            if isinstance(x, list):
                return x
            if isinstance(x, dict):
                y = items(x)
                if y:
                    return y
    return []


def first(record, keys):
    for k in keys:
        v = record.get(k)
        if v is not None and v != "":
            return v
    return None


def percent(value):
    if isinstance(value, dict):
        value = first(value, ("value", "stat", "percentage"))
    if value is None:
        raise ValueError("missing possession")
    v = float(str(value).replace("%", "").replace(",", ".").strip())
    if not 0 < v < 100:
        raise ValueError("possession not between 0 and 100")
    return v


def season(value):
    value = str(value or "").strip()
    if re.fullmatch(r"\d{4}/\d{4}", value):
        a, b = map(int, value.split("/"))
        if b == a + 1:
            return value
    if re.fullmatch(r"\d{4}", value):
        return value
    raise ValueError("invalid season")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--leagues", required=True, type=Path, help="JSON export of existing MF Legacy League records")
    ap.add_argument("--snapshots", required=True, type=Path, help="Folder with authorised FotMob JSON snapshots")
    ap.add_argument("--output", required=True, type=Path, help="MF Legacy JSON output")
    args = ap.parse_args()
    if not args.snapshots.is_dir() or not list(args.snapshots.glob("*.json")):
        ap.error("Snapshots directory is missing or contains no JSON files")
    leagues = items(json.loads(args.leagues.read_text(encoding="utf-8")))
    allowed = {str(x["name"]).casefold(): x["name"] for x in leagues if isinstance(x, dict) and x.get("name")}
    if not allowed:
        ap.error("League catalog is empty: provide your existing MF Legacy leagues")
    results, issues, seen = [], [], set()
    for file in sorted(args.snapshots.glob("*.json")):
        try:
            doc = json.loads(file.read_text(encoding="utf-8"))
            if not isinstance(doc, dict):
                raise ValueError("snapshot must be an object with competition and season")
            competition = str(doc.get("competition") or doc.get("league") or "").strip()
            actual = allowed.get(competition.casefold())
            if actual is None:
                raise ValueError("competition not in existing MF Legacy catalog: " + competition)
            yr = season(doc.get("season"))
            source_url = str(doc.get("source_url") or "")
            if source_url and not source_url.startswith(("https://", "http://")):
                raise ValueError("invalid source URL")
            raw = items(doc)
            if not raw:
                raise ValueError("no team records recognised")
            for n, record in enumerate(raw, 1):
                try:
                    if not isinstance(record, dict):
                        raise ValueError("invalid team row")
                    name = first(record, TEAM_KEYS)
                    if isinstance(name, dict):
                        name = first(name, TEAM_KEYS)
                    name = str(name or "").strip()
                    if not name:
                        raise ValueError("missing team name")
                    fid = first(record, ID_KEYS)
                    if isinstance(fid, dict):
                        fid = first(fid, ID_KEYS)
                    if fid is not None and not re.fullmatch(r"[1-9]\d*", str(fid)):
                        raise ValueError("FotMob team ID must be a positive integer")
                    value = percent(first(record, POSS_KEYS))
                    key = (actual.casefold(), yr, str(fid) if fid is not None else name.casefold())
                    if key in seen:
                        raise ValueError("duplicate identity within the batch")
                    row = dict(team_name=name, season=yr, competition=actual,
                               team_possession_pct=value, source="FotMob",
                               verification_status="pending")
                    if fid is not None:
                        row["fotmob_team_id"] = str(fid)
                    if source_url:
                        row["source_url"] = source_url
                    matches = record.get("matches_covered")
                    if matches is not None:
                        if not str(matches).isdigit() or not 1 <= int(matches) <= 200:
                            raise ValueError("invalid matches_covered")
                        row["matches_covered"] = int(matches)
                    seen.add(key)
                    results.append(row)
                except (ValueError, TypeError) as e:
                    issues.append(f"{file.name}: team row {n}: {e}")
        except (ValueError, OSError, json.JSONDecodeError) as e:
            issues.append(f"{file.name}: {e}")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"records": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    report = args.output.with_suffix(".report.json")
    report.write_text(json.dumps({"importable": len(results), "issues": issues}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(results)} validated rows; {len(issues)} issues. Output: {args.output}; report: {report}")
    if issues:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
