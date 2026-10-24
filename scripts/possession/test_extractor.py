"""Offline tests against captured real responses; transport uses mocked HTTP only."""
import copy
import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from urllib.error import HTTPError, URLError
from unittest.mock import Mock, patch

from extract_fotmob import (Client, FileClient, SourceError, collect, compare_existing,
                            discover, extract, main, ROOT, STAT)

FIXTURES = ROOT / "fixtures"
CATALOG = ROOT / "catalog" / "league_snapshot_2026-10-22.json"
MAPPINGS = json.loads((ROOT / "catalog" / "fotmob_leagues.json").read_text(encoding="utf-8"))["leagues"]
LEAGUES = json.loads(CATALOG.read_text(encoding="utf-8"))


class ExtractorTest(unittest.TestCase):
    def setUp(self):
        self.client = FileClient(FIXTURES)
        self.payload, self.source = self.client.get(55, 27044)
        self.selected = {"id": "27044", "league_id": "55", "name": "2025/2026"}

    def rows(self, data=None):
        return extract(self.payload if data is None else data, self.selected, "Serie A", self.source)

    def test_six_real_reference_values(self):
        rows = self.rows()
        by_name = {r["team_name"]: r["team_possession_pct"] for r in rows}
        self.assertEqual(len(rows), 20)
        for name, value in {"Como": 61.6, "Inter": 59.7, "Napoli": 58.9, "Juventus": 57.5, "Roma": 56.3, "Milan": 51.9}.items():
            self.assertEqual(by_name[name], value)
        self.assertTrue(all("matches_covered" not in r for r in rows))
        self.assertTrue(all(r["verification_status"] == "pending" for r in rows))
        self.assertEqual(rows[1]["fotmob_team_id"], "8636")
        self.assertEqual(rows[1]["fotmob_league_id"], "55")

    def test_real_historical_and_calendar_seasons(self):
        for lid, sid, label, count, leader, value in [(55, 10692, "2016/2017", 20, "Napoli", 61.9), (130, 29580, "2026", 30, "San Diego FC", 60.2)]:
            payload, source = self.client.get(lid, sid)
            rows = extract(payload, {"id": str(sid), "league_id": str(lid), "name": label}, "Serie A" if lid == 55 else "MLS", source)
            self.assertEqual(len(rows), count)
            self.assertEqual((rows[0]["team_name"], rows[0]["team_possession_pct"]), (leader, value))
            seasons = discover(payload, lid)
            self.assertEqual(len(seasons), 11)
            self.assertTrue(all(s["name"][:4] != "2015" for s in seasons))

    def test_wrong_response_context_rejected(self):
        for key, value in [("currentSeasonId", "36072"), ("currentStatName", "goals_team_match"), ("type", "players"), ("leagueDetails", {"id": 47})]:
            with self.subTest(key=key):
                payload = copy.deepcopy(self.payload)
                payload[key] = value
                with self.assertRaises(SourceError):
                    self.rows(payload)

    def test_invalid_team_rows_reject_entire_season(self):
        changes = [("teamId", "fake"), ("id", 1), ("name", ""), ("type", "players"),
                   ("statValue", {"name": "goals_team_match", "value": 65, "format": "number"})]
        changes += [("statValue", {"name": STAT, "format": "percent", "value": value}) for value in [None, True, "61.6", 0, 100, -1, 101, float("nan"), float("inf")]]
        for key, value in changes:
            with self.subTest(key=key, value=value):
                payload = copy.deepcopy(self.payload)
                payload["statsData"][-1][key] = value
                with self.assertRaises(ValueError):
                    self.rows(payload)

    def test_duplicate_teams_and_seasons_rejected(self):
        payload = copy.deepcopy(self.payload)
        payload["statsData"].append(payload["statsData"][0])
        with self.assertRaises(SourceError):
            self.rows(payload)
        payload = copy.deepcopy(self.payload)
        payload["seasons"].append(payload["seasons"][0])
        with self.assertRaises(SourceError):
            discover(payload, 55)

    def test_all_18_names_accounted_for_without_merging(self):
        names = [n for m in MAPPINGS for n in m["mf_names"]]
        self.assertEqual(set(names), {r["name"] for r in LEAGUES})
        self.assertEqual(len(names), 18)
        rows, report = collect(self.client, MAPPINGS, LEAGUES, discover_only=True)
        self.assertEqual(rows, [])
        self.assertEqual(sum(x["status"] == "ambiguous_mapping" for x in report["issues"]), 2)
        rows, report = collect(self.client, MAPPINGS, LEAGUES, competitions=["Serie A"], seasons=["2025/2026"])
        self.assertEqual(len(rows), 20)
        self.assertEqual(report["issues"], [])
        with self.assertRaisesRegex(ValueError, "not in"):
            collect(self.client, MAPPINGS, LEAGUES, competitions=["Unknown"])

    def test_availability_is_separate_from_successful_extraction(self):
        rows, report = collect(self.client, MAPPINGS, LEAGUES, competitions=["Serie A"], from_year=2015, to_year=2017)
        statuses = {c.get("season", c.get("season_start_year")): c["status"] for c in report["coverage"]}
        self.assertEqual(statuses, {2015: "unavailable", "2016/2017": "extracted", "2017/2018": "error"})
        self.assertEqual(len(rows), 20)
        self.assertEqual(len(report["catalogs"][0]["seasons"]), 11)

    def test_empty_or_provisional_seasons(self):
        rows, report = collect(self.client, MAPPINGS, LEAGUES, competitions=["MLS"], seasons=["2026"])
        self.assertTrue(all(r["season_status"] == "provisional" for r in rows))
        data = copy.deepcopy(self.payload)
        data["statsData"] = []
        self.assertEqual(self.rows(data), [])

    def test_comparison_never_exports_existing_values(self):
        row = self.rows()[1]
        for kind, value in [("verified", 59.7), ("pending", 50), ("manual", 58)]:
            old = dict(row, verification_status=kind, team_possession_pct=value, source="Manual", id="internal-row")
            rows, comparisons = compare_existing([row], [old], [])
            self.assertEqual(rows, [])
            self.assertEqual(comparisons[0]["existing"][0], old)
        other = dict(row, competition="Premier League")
        self.assertEqual(len(compare_existing([row], [other], [])[0]), 1)
        self.assertEqual(compare_existing([row, row], [], [])[1][0]["status"], "duplicate_candidate")
        wrong_id = dict(row, fotmob_team_id="9999")
        self.assertEqual(compare_existing([row], [wrong_id], [])[1][0]["status"], "identity_conflict")

    def test_existing_alias_without_provider_id_is_held(self):
        rows, comparisons = compare_existing(self.rows(), [{"team_name": "Internazionale", "season": "2025/2026", "competition": "Serie A", "team_possession_pct": 59.7}], [])
        self.assertEqual(rows, [])
        self.assertTrue(all(c["status"] == "existing_review" for c in comparisons))

    def test_link_unique_existing_ids_only(self):
        row = self.rows()[1]
        team = {"id": "existing-team", "name": "Inter", "fotmob_id": "8636"}
        rows, comparisons = compare_existing([row], [], [team])
        self.assertEqual(rows[0]["team_id"], "existing-team")
        self.assertFalse(comparisons)
        self.assertEqual(compare_existing([row], [], [team, team])[1][0]["status"], "identity_conflict")

    def test_cli_real_sample_and_report(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "import.json"
            code = main(["--leagues", str(CATALOG), "--responses", str(FIXTURES), "--competition", "Serie A", "--season", "2025/2026", "--output", str(output)])
            self.assertEqual(code, 0)
            doc = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual(len(doc["records"]), 20)
            report = json.loads(output.with_suffix(".report.json").read_text(encoding="utf-8"))
            self.assertFalse(report["existing_checked"])
            self.assertEqual(report["pending"], 20)
            self.assertEqual(len(json.loads(Path(report["batches"][0]).read_text(encoding="utf-8"))["records"]), 20)

    def test_online_requires_permission_reference(self):
        with redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as result:
            main(["--leagues", str(CATALOG), "--online", "--output", "unused.json"])
        self.assertEqual(result.exception.code, 2)

    def test_import_batches_obey_1000_row_limit_and_reruns_do_not_reuse_old_chunks(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "import.json"
            args = ["--leagues", str(CATALOG), "--responses", str(FIXTURES), "--output", str(output)]
            rows = [dict(self.rows()[0], fotmob_team_id=str(i + 1)) for i in range(1001)]
            report = {"issues": [], "coverage": []}
            with patch("extract_fotmob.collect", return_value=(rows, dict(report))):
                self.assertEqual(main(args), 0)
            first = json.loads(output.with_suffix(".report.json").read_text(encoding="utf-8"))["batches"]
            self.assertEqual([len(json.loads(Path(p).read_text(encoding="utf-8"))["records"]) for p in first], [1000, 1])
            with patch("extract_fotmob.collect", return_value=(rows[:1], dict(report))):
                self.assertEqual(main(args), 0)
            second = json.loads(output.with_suffix(".report.json").read_text(encoding="utf-8"))["batches"]
            self.assertEqual(len(second), 1)
            self.assertNotEqual(Path(first[0]).parent, Path(second[0]).parent)


class Response(io.BytesIO):
    def __init__(self, data, content_type="application/json"):
        super().__init__(data)
        self.headers = {"Content-Type": content_type}


class TransportTest(unittest.TestCase):
    def test_cache_avoids_repeated_requests_and_replays_offline(self):
        with tempfile.TemporaryDirectory() as directory:
            opener = Mock(return_value=Response(b'{"type":"teams","seasons":[]}'))
            client = Client(directory, offline=False, opener=opener, delay=0)
            first, source = client.get(55)
            self.assertFalse(source["cached"])
            self.assertEqual(client.get(55)[0], first)
            self.assertEqual(opener.call_count, 1)
            offline = Client(directory, opener=Mock(side_effect=AssertionError("network forbidden")))
            self.assertEqual(offline.get(55)[0], first)
            with self.assertRaisesRegex(SourceError, "offline cache miss"):
                offline.get(130)

    def test_no_retry_or_bypass_for_401_403(self):
        for status in [401, 403]:
            with tempfile.TemporaryDirectory() as directory:
                opener = Mock(side_effect=HTTPError("url", status, "blocked", {}, None))
                with self.assertRaisesRegex(SourceError, str(status)):
                    Client(directory, offline=False, opener=opener).get(55)
                self.assertEqual(opener.call_count, 1)
                with self.assertRaisesRegex(SourceError, "further requests stopped"):
                    client = Client(directory, offline=False, opener=opener)
                    try:
                        client.get(55)
                    except SourceError:
                        pass
                    client.get(130)
                self.assertEqual(opener.call_count, 2)

    def test_retry_after_and_bounded_network_retries(self):
        with tempfile.TemporaryDirectory() as directory:
            opener = Mock(side_effect=[HTTPError("url", 429, "limit", {"Retry-After": "3"}, None), Response(b'{}')])
            sleep = Mock()
            Client(directory, offline=False, opener=opener, sleep=sleep, delay=0).get(55)
            sleep.assert_any_call(3)
            self.assertEqual(opener.call_count, 2)
        with tempfile.TemporaryDirectory() as directory:
            opener = Mock(side_effect=URLError("offline"))
            with self.assertRaises(SourceError):
                Client(directory, offline=False, opener=opener, sleep=Mock(), delay=0, retries=2).get(55)
            self.assertEqual(opener.call_count, 3)

    def test_html_and_invalid_json_not_cached(self):
        for raw, mime in [(b'<html>challenge</html>', "text/html"), (b'bad', "application/json")]:
            with tempfile.TemporaryDirectory() as directory:
                with self.assertRaises(SourceError):
                    Client(directory, offline=False, opener=Mock(return_value=Response(raw, mime))).get(55)
                self.assertEqual(list(Path(directory).iterdir()), [])


if __name__ == "__main__":
    unittest.main()
