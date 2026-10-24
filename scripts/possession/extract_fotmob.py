#!/usr/bin/env python3
"""Fetch historical FotMob team possession into MF Legacy JSON import batches."""
import argparse
import hashlib
import json
import math
import re
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, urlopen

from import_fotmob_snapshots import items, percent, season

ROOT = Path(__file__).resolve().parent
ENDPOINT = "https://www.fotmob.com/api/data/leagueseasondeepstats"
STAT = "possession_percentage_team"
MAX_BYTES = 8 * 1024 * 1024


class SourceError(ValueError):
    """A response could not safely be used as possession data."""


def positive_id(value):
    if isinstance(value, bool) or not re.fullmatch(r"[1-9]\d*", str(value)):
        raise SourceError("expected a positive numeric FotMob ID")
    return str(value)


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


class Client:
    """Sequential requests, bounded retries and explicit, replayable disk cache."""

    def __init__(self, cache, *, offline=True, refresh=False, delay=1.0,
                 retries=2, timeout=30, opener=urlopen, sleep=time.sleep):
        self.cache, self.offline, self.refresh = Path(cache), offline, refresh
        self.delay, self.retries, self.timeout = delay, retries, timeout
        self.opener, self.sleep = opener, sleep
        self.last_request = None
        self.blocked = None

    def get(self, league_id, season_id=None):
        params = {"id": positive_id(league_id), "type": "teams"}
        if season_id is not None:
            params.update(season=positive_id(season_id), stat=STAT)
        url = ENDPOINT + "?" + urlencode(params)
        path = self.cache / (hashlib.sha256(url.encode()).hexdigest() + ".json")
        if path.exists() and not self.refresh:
            try:
                saved = json.loads(path.read_text(encoding="utf-8"))
                if saved["url"] != url or not isinstance(saved["payload"], dict) or not saved["fetched_at"]:
                    raise ValueError("invalid cache envelope")
            except (KeyError, ValueError, TypeError) as exc:
                raise SourceError(f"invalid cache {path}; use --refresh") from exc
            return saved["payload"], {"url": url, "fetched_at": saved["fetched_at"], "cached": True}
        if self.offline:
            raise SourceError(f"offline cache miss: {url}")
        if self.blocked:
            raise SourceError(self.blocked)
        for attempt in range(self.retries + 1):
            if self.last_request is not None:
                self.sleep(max(0, self.delay - (time.monotonic() - self.last_request)))
            self.last_request = time.monotonic()
            try:
                req = Request(url, headers={"Accept": "application/json", "User-Agent": "MF-Legacy-Possession/1.0"})
                with self.opener(req, timeout=self.timeout) as response:
                    if "application/json" not in response.headers.get("Content-Type", "").lower():
                        raise SourceError("FotMob returned non-JSON content; no data extracted")
                    raw = response.read(MAX_BYTES + 1)
                    if len(raw) > MAX_BYTES:
                        raise SourceError("response exceeds size limit")
                payload = json.loads(raw)
                if not isinstance(payload, dict):
                    raise SourceError("expected a JSON object")
                fetched = timestamp()
                write_json(path, {"url": url, "fetched_at": fetched, "payload": payload})
                return payload, {"url": url, "fetched_at": fetched, "cached": False}
            except HTTPError as exc:
                if exc.code not in (429, 500, 502, 503, 504) or attempt == self.retries:
                    if exc.code in (401, 403, 429):
                        self.blocked = f"further requests stopped after FotMob HTTP {exc.code}; rerun only when access is available"
                    raise SourceError(f"FotMob HTTP {exc.code}: {url}") from exc
                retry_after = exc.headers.get("Retry-After", "") if exc.headers else ""
                # Never retry earlier than a server's numeric Retry-After.
                if retry_after and (not retry_after.isdigit() or int(retry_after) > 60):
                    self.blocked = "further requests stopped by FotMob Retry-After; rerun later"
                    raise SourceError("FotMob requested a later retry; rerun later") from exc
                self.sleep(max(2 ** attempt, int(retry_after or 0)))
            except (URLError, TimeoutError, OSError) as exc:
                if attempt == self.retries:
                    raise SourceError(f"network error: {exc}") from exc
                self.sleep(2 ** attempt)
            except (UnicodeError, json.JSONDecodeError) as exc:
                raise SourceError("invalid JSON from FotMob") from exc


class FileClient:
    """Replay complete native JSON responses, with source and retrieval metadata."""

    def __init__(self, directory):
        self.responses = []
        directory = Path(directory).resolve()
        manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8-sig"))
        for entry in manifest["responses"]:
            file = (directory / entry["file"]).resolve()
            if not file.is_relative_to(directory):
                raise SourceError("sample file escapes response directory")
            url = urlsplit(entry["source_url"])
            if url.scheme != "https" or url.netloc != "www.fotmob.com" or url.path != "/api/data/leagueseasondeepstats":
                raise SourceError("unexpected sample source URL")
            query = parse_qs(url.query)
            if query.get("type") != ["teams"] or query.get("stat") != [STAT] or not entry.get("fetched_at"):
                raise SourceError("missing source metadata")
            lid, sid = positive_id(query["id"][0]), positive_id(query["season"][0])
            if any((lid, sid) == r[:2] for r in self.responses):
                raise SourceError("duplicate response in manifest")
            data = json.loads(file.read_text(encoding="utf-8-sig"))
            self.responses.append((lid, sid, data, {"url": entry["source_url"], "fetched_at": entry["fetched_at"], "cached": True}))

    def get(self, league_id, season_id=None):
        for lid, sid, payload, provenance in self.responses:
            if lid == str(league_id) and (season_id is None or sid == str(season_id)):
                return payload, provenance
        raise SourceError(f"no saved response for league={league_id}, season={season_id}")


def discover(payload, league_id):
    if payload.get("type") != "teams" or not isinstance(payload.get("seasons"), list):
        raise SourceError("invalid team-season catalog")
    result, seen = [], set()
    for entry in payload["seasons"]:
        if not isinstance(entry, dict):
            raise SourceError("invalid season entry")
        sid = positive_id(entry.get("id"))
        lid = positive_id(entry.get("leagueId", league_id))
        label = season(entry.get("name"))
        if (lid, sid) in seen or any(s["name"] == label for s in result):
            raise SourceError("ambiguous or duplicated season catalog")
        seen.add((lid, sid))
        result.append({"id": sid, "league_id": lid, "name": label})
    return result


def extract(payload, selected, competition, provenance):
    """Validate the entire season before emitting any rows (no partial seasons)."""
    if (payload.get("type") != "teams" or payload.get("currentStatName") != STAT
            or str(payload.get("currentSeasonId")) != selected["id"]):
        raise SourceError("response does not match requested season/type/stat")
    details = payload.get("leagueDetails")
    if not isinstance(details, dict) or str(details.get("id")) != selected["league_id"]:
        raise SourceError("response does not match requested league")
    observed = discover(payload, selected["league_id"])
    if selected not in observed:
        raise SourceError("season ID/name mapping differs from discovery")
    raw = payload.get("statsData")
    if not isinstance(raw, list):
        raise SourceError("missing statsData array")
    result, seen = [], set()
    for row in raw:
        if not isinstance(row, dict) or row.get("type") != "teams":
            raise SourceError("expected a team stat row")
        fid = positive_id(row.get("teamId"))
        if positive_id(row.get("id")) != fid or fid in seen:
            raise SourceError("conflicting or duplicated team ID")
        name = row.get("name")
        stat = row.get("statValue")
        if not isinstance(name, str) or not name.strip():
            raise SourceError("missing team name")
        if not isinstance(stat, dict) or stat.get("name") != STAT or stat.get("format") != "percent":
            raise SourceError("row does not contain the requested possession percentage")
        value = stat.get("value")
        if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value):
            raise SourceError("invalid possession value")
        seen.add(fid)
        result.append({"team_name": name.strip(), "fotmob_team_id": fid,
                       "fotmob_league_id": selected["league_id"], "fotmob_season_id": selected["id"],
                       "season": selected["name"], "competition": competition,
                       "team_possession_pct": percent(value), "source": "FotMob",
                       "source_url": provenance["url"], "verification_status": "pending",
                       "notes": f"FotMob league={selected['league_id']}; season={selected['id']}; retrieved={provenance['fetched_at']}"})
    return result


def compare_existing(records, existing, teams):
    """Export new identities only; existing values are comparison-only, always."""
    def normalized(value):
        return " ".join(re.sub(r"[^a-z0-9]+", " ", unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode().casefold()).split())

    results, comparisons, seen = [], [], set()
    for row in records:
        row = dict(row)
        links = [t for t in teams if str(t.get("fotmob_id", "")) == row["fotmob_team_id"]]
        if len(links) > 1 or (links and (not links[0].get("id") or not links[0].get("name"))):
            comparisons.append({"status": "identity_conflict", "candidate": row})
            continue
        if links:
            row["team_id"] = str(links[0]["id"])
            row["team_name"] = links[0]["name"]
        key = (row["fotmob_team_id"], row["fotmob_league_id"], row["fotmob_season_id"])
        if key in seen:
            comparisons.append({"status": "duplicate_candidate", "candidate": row})
            continue
        seen.add(key)
        scope = [e for e in existing if str(e.get("season")) == row["season"] and normalized(e.get("competition")) == normalized(row["competition"])]
        matches = [e for e in scope if str(e.get("fotmob_team_id", "")) == row["fotmob_team_id"]
                   or (row.get("team_id") and str(e.get("team_id", "")) == row["team_id"])
                   or normalized(e.get("team_name")) == normalized(row["team_name"])]
        # Without a provider ID an unmatched old alias might still be this team.
        # Hold it for review instead of risking a second record under a new name.
        unresolved = [e for e in scope if not e.get("fotmob_team_id") and e not in matches]
        if matches or unresolved:
            status = "existing_review"
            id_conflict = any(
                (e.get("fotmob_team_id") and str(e["fotmob_team_id"]) != row["fotmob_team_id"])
                or (e.get("team_id") and row.get("team_id") and str(e["team_id"]) != row["team_id"])
                for e in matches)
            if id_conflict:
                status = "identity_conflict"
            elif len(matches) == 1:
                try:
                    status = "unchanged_value" if percent(matches[0].get("team_possession_pct")) == row["team_possession_pct"] else "value_conflict"
                except (ValueError, TypeError):
                    pass
            comparisons.append({"status": status, "candidate": row, "existing": matches or unresolved})
        else:
            results.append(row)
    return results, comparisons


def collect(client, mappings, catalog, *, competitions=None, seasons=None, from_year=2015, to_year=2026, discover_only=False):
    allowed = {r["name"] for r in items(catalog) if isinstance(r, dict) and isinstance(r.get("name"), str)}
    if not allowed:
        raise ValueError("empty MF Legacy league catalog")
    requested = set(competitions or [])
    if requested - allowed:
        raise ValueError("competition not in MF Legacy catalog: " + ", ".join(sorted(requested - allowed)))
    records, coverage, problems, handled, catalogs = [], [], [], set(), []
    for mapping in mappings:
        names = set(mapping["mf_names"]) & allowed
        selected_names = names & requested if requested else names
        if not selected_names:
            continue
        handled.update(selected_names)
        if len(selected_names) != 1:
            problems.append({"competitions": sorted(selected_names), "status": "ambiguous_mapping",
                             "error": "select exactly one MF name with --competition"})
            continue
        competition = next(iter(selected_names))
        lid = positive_id(mapping["fotmob_id"])
        try:
            payload, source = client.get(lid)
            available = discover(payload, lid)
            catalogs.append({"competition": competition, "fotmob_league_id": lid, "seasons": available, "source": source})
        except (ValueError, OSError) as exc:
            problems.append({"competition": competition, "status": "discovery_error", "error": str(exc)})
            continue
        wanted = [s for s in available if (s["name"] in seasons if seasons else from_year <= int(s["name"][:4]) <= to_year)]
        missing = set(seasons or []) - {s["name"] for s in available}
        for name in sorted(missing):
            coverage.append({"competition": competition, "season": name, "status": "unavailable", "rows": 0})
        if not seasons:
            available_years = {int(s["name"][:4]) for s in available}
            for year in range(from_year, to_year + 1):
                if year not in available_years:
                    coverage.append({"competition": competition, "season_start_year": year, "status": "unavailable", "rows": 0})
        if not wanted and not missing:
            coverage.append({"competition": competition, "status": "no_available_seasons", "rows": 0})
        for selected in sorted(wanted, key=lambda s: s["name"]):
            entry = {"competition": competition, "season": selected["name"], "fotmob_league_id": selected["league_id"],
                     "fotmob_season_id": selected["id"], "rows": 0}
            if discover_only:
                entry["status"] = "available_unfetched"
                coverage.append(entry)
                continue
            try:
                payload, provenance = client.get(selected["league_id"], selected["id"])
                rows = extract(payload, selected, competition, provenance)
                latest = max((s["name"] for s in available), default="")
                provisional = selected["name"] == latest or int(selected["name"][:4]) >= datetime.now(timezone.utc).year
                season_status = "provisional" if provisional else "historical_unconfirmed"
                for row in rows:
                    row["season_status"] = season_status
                    row["notes"] += "; season_status=" + season_status
                records.extend(rows)
                entry.update(status="extracted" if rows else "empty", rows=len(rows), season_status=season_status, **provenance)
            except (ValueError, OSError) as exc:
                entry.update(status="error", error=str(exc))
            coverage.append(entry)
    for name in sorted((requested or allowed) - handled):
        problems.append({"competition": name, "status": "unmapped", "error": "no verified FotMob mapping"})
    return records, {"generated_at": timestamp(), "importable": len(records), "catalogs": catalogs, "coverage": coverage, "issues": problems}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--leagues", type=Path, required=True, help="Existing MF Legacy League JSON export")
    p.add_argument("--mapping", type=Path, default=ROOT / "catalog" / "fotmob_leagues.json")
    p.add_argument("--competition", action="append", help="Exact MF name; repeat to select leagues")
    p.add_argument("--season", action="append", help="Exact label, e.g. 2025/2026 or 2025; repeatable")
    p.add_argument("--discover-only", action="store_true", help="Report season availability without fetching stat tables")
    p.add_argument("--from-year", type=int, default=2015, help="First season START year")
    p.add_argument("--to-year", type=int, default=2026, help="Last season START year")
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--existing", type=Path, help="Existing TeamSeasonPossession export; matches are excluded, never overwritten")
    p.add_argument("--teams", type=Path, help="Existing Team export; link only unique FotMob IDs")
    p.add_argument("--cache-dir", type=Path, default=ROOT / ".cache")
    p.add_argument("--responses", type=Path, help="Replay native responses listed in manifest.json, with no network")
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--offline", action="store_true", help="Replay saved responses only")
    mode.add_argument("--online", action="store_true", help="Requires actual provider permission for automated access")
    p.add_argument("--permission-reference", help="Reference to an existing provider permission/agreement, not a grant of permission")
    p.add_argument("--refresh", action="store_true", help="Replace cached responses; requires --online")
    p.add_argument("--delay", type=float, default=1.0)
    p.add_argument("--timeout", type=float, default=30)
    p.add_argument("--retries", type=int, default=2)
    args = p.parse_args(argv)
    if args.online and not str(args.permission_reference or "").strip():
        p.error("online access requires actual provider permission and --permission-reference; HTTP 200 is not permission")
    if args.refresh and not args.online:
        p.error("--refresh requires --online")
    if args.responses and args.online:
        p.error("--responses cannot be used with --online")
    if not (1900 <= args.from_year <= args.to_year <= 2100):
        p.error("invalid year range")
    if not math.isfinite(args.delay) or args.delay < 0 or not math.isfinite(args.timeout) or args.timeout <= 0 or not 0 <= args.retries <= 5:
        p.error("delay must be nonnegative, timeout positive, retries between 0 and 5")
    try:
        if args.season:
            args.season = [season(s) for s in args.season]
        catalog = json.loads(args.leagues.read_text(encoding="utf-8-sig"))
        mappings = json.loads(args.mapping.read_text(encoding="utf-8-sig"))["leagues"]
        names = [name for m in mappings for name in m["mf_names"]]
        if len(names) != len(set(names)):
            raise ValueError("duplicate MF name in mapping")
        client = FileClient(args.responses) if args.responses else Client(
            args.cache_dir, offline=not args.online, refresh=args.refresh,
            delay=args.delay, timeout=args.timeout, retries=args.retries)
        records, report = collect(client, mappings, catalog, competitions=args.competition,
                                  seasons=args.season, from_year=args.from_year, to_year=args.to_year, discover_only=args.discover_only)
        existing = items(json.loads(args.existing.read_text(encoding="utf-8-sig"))) if args.existing else []
        teams = items(json.loads(args.teams.read_text(encoding="utf-8-sig"))) if args.teams else []
        if any(not isinstance(r, dict) for r in existing + teams):
            raise ValueError("existing records and teams must be JSON objects")
        for file, rows in [(args.existing, existing), (args.teams, teams)]:
            if file and not rows:
                obj = json.loads(file.read_text(encoding="utf-8-sig"))
                if obj not in ([], {"records": []}):
                    raise ValueError("unrecognised or empty-structure export: " + str(file))
        records, comparisons = compare_existing(records, existing, teams)
        report.update(importable=len(records), comparisons=comparisons,
                      existing_checked=bool(args.existing), permission_reference=args.permission_reference if args.online else None,
                      linked=sum(bool(r.get("team_id")) for r in records),
                      pending=sum(not r.get("team_id") for r in records))
        report["summary"] = {
            "source_validated": sum(c["rows"] for c in report["coverage"]),
            "exportable": len(records), "linked": report["linked"],
            "pending_link": report["pending"], "pending_verification": len(records),
            "provisional": sum(r.get("season_status") == "provisional" for r in records),
            "held_comparisons": len(comparisons),
            "errors": len(report["issues"]) + sum(c["status"] == "error" for c in report["coverage"]),
            "unavailable": sum(c["status"] == "unavailable" for c in report["coverage"])}
    except (ValueError, OSError, KeyError, TypeError) as exc:
        p.error(str(exc))
    # The app accepts at most 1,000 rows per paste. Each run gets a unique batch
    # directory, so a shorter rerun cannot leave stale chunks in the active set.
    batch_dir = args.output.parent / (args.output.stem + "_batches") / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    report["batches"] = []
    for start in range(0, len(records), 1000):
        batch = batch_dir / f"{start // 1000 + 1:03}.json"
        write_json(batch, {"records": records[start:start + 1000]})
        report["batches"].append(str(batch))
    write_json(args.output, {"records": records})
    write_json(args.output.with_suffix(".report.json"), report)
    failed = bool(report["issues"]) or any(c["status"] not in ("extracted", "available_unfetched") for c in report["coverage"])
    failed = failed or any(c["status"] != "unchanged_value" for c in comparisons)
    print(f"{len(records)} exportable rows; {report['linked']} linked; {report['pending']} pending; {len(comparisons)} held comparisons; {len(report['batches'])} import batches; report: {args.output.with_suffix('.report.json')}")
    return 2 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
