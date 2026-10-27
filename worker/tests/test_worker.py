import json
import os
from pathlib import Path
from urllib.error import HTTPError
import tempfile
import unittest
from unittest.mock import patch, MagicMock

from worker.mf_v3_worker import number, valid_pid, historical_dataset, collect, call, studio_fotmob, fotmob_coverage


class WorkerContractTests(unittest.TestCase):
    def test_coverage_deduplicates_competitions_and_reports_unavailable(self):
        details=[
            {"season":"2024/2025","competition":"LaLiga","tournament_id":"87","status":"pending_review"},
            {"season":"2024/2025","competition":"LaLiga","tournament_id":"87","status":"duplicate_option"},
            {"season":"2024/2025","competition":"Cup","tournament_id":"138","status":"no_statistics"},
            {"season":"2023/2024","competition":"LaLiga","tournament_id":"87","status":"cache_absent"},
        ]
        c=fotmob_coverage(details)
        self.assertEqual(c["total"],3)
        self.assertEqual(c["received"],1)
        self.assertEqual(c["unavailable"],1)
        self.assertEqual(c["pending"],1)
        self.assertFalse(c["complete"])

    def test_mismatched_cache_is_refetched_and_original_preserved(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            profile_path=root/"profile.json"
            profile_path.write_text('{"id":1598982}',encoding="utf-8")
            file=root/"stats.json"
            file.write_text(json.dumps({"_mf_legacy_meta":{
                "player_id":"1598982","season":"2023/2024","competition":"LaLiga","season_id":"0-0"},
                "payload":{"statsSection":{}}}),encoding="utf-8")
            profile,client,resolver=MagicMock(),MagicMock(),MagicMock()
            client.player_cache_path.return_value=profile_path
            client.stat_cache_path.return_value=file
            def save(path,data):
                path.parent.mkdir(parents=True,exist_ok=True)
                path.write_text(json.dumps(data),encoding="utf-8")
            client.save_json.side_effect=save
            profile.read_json.side_effect=lambda path:json.loads(path.read_text(encoding="utf-8"))
            profile.load_profile_bundle.return_value={
                "player":{"fotmob_player_id":"1598982"},
                "season_options":[{"season":"2024/2025","competition":"LaLiga",
                    "season_id":"0-0","tournament_id":"87"}],
                "career":[]}
            profile.extract_stat_details.return_value={"conflicts":[],"metrics":[{"name":"Tackles","value":22}]}
            client.fetch_stats.return_value={"statsSection":{"items":[{"x":1}]}}
            resolver.load_assignments.return_value={}
            resolver.resolve_stats_team.return_value=("8634","Barcelona","career_tournament_id",[])
            with patch("worker.mf_v3_worker.studio_import",return_value=(profile,client,resolver)):
                found,state=studio_fotmob(root,"1598982",allow_network=True,request_limit=1)
            self.assertEqual(len(found),1)
            self.assertEqual(found[0]["metric_name"],"Tackles")
            self.assertEqual(state["coverage"]["received"],1)
            self.assertEqual(state["successful_requests"],1)
            self.assertTrue((root/"stats.json.old").exists())
            self.assertEqual(json.loads(file.read_text())["_mf_legacy_meta"]["season"],"2024/2025")
            self.assertTrue((root/"datos"/"cobertura_fotmob"/"1598982.json").is_file())

    def test_provider_rate_limit_stops_remaining_competitions(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            profile_path=root/"profile.json"
            profile_path.write_text('{"id":1598982}',encoding="utf-8")
            profile,client,resolver=MagicMock(),MagicMock(),MagicMock()
            client.player_cache_path.return_value=profile_path
            client.stat_cache_path.side_effect=lambda root,pid,sid:root/(sid+".json")
            profile.read_json.side_effect=lambda path:json.loads(path.read_text(encoding="utf-8"))
            profile.load_profile_bundle.return_value={
                "player":{"fotmob_player_id":"1598982"},
                "season_options":[
                    {"season":"2024/2025","competition":"LaLiga","season_id":"0-0","tournament_id":"87"},
                    {"season":"2023/2024","competition":"LaLiga","season_id":"1-0","tournament_id":"87"}],
                "career":[]}
            client.fetch_stats.side_effect=HTTPError("https://www.fotmob.com",429,"Too many requests",None,None)
            client.save_json.side_effect=lambda path,data:path.parent.mkdir(parents=True,exist_ok=True) or path.write_text(json.dumps(data))
            resolver.load_assignments.return_value={}
            with patch("worker.mf_v3_worker.studio_import",return_value=(profile,client,resolver)):
                found,state=studio_fotmob(root,"1598982",allow_network=True,request_limit=8)
            self.assertFalse(found)
            self.assertEqual(client.fetch_stats.call_count,1)
            self.assertEqual(state["coverage"]["rate_limited"],1)
            self.assertEqual(state["coverage"]["total"],2)
            self.assertFalse(state["coverage"]["complete"])
            self.assertEqual(state["coverage"]["pending"],1)

    def test_null_not_converted_to_zero(self):
        self.assertIsNone(number(None))
        self.assertIsNone(number(""))
        self.assertEqual(number(0),0.0)
        self.assertIsNone(number("not a number"))

    def test_fotmob_id_is_exact_numeric(self):
        self.assertTrue(valid_pid("276738"))
        self.assertFalse(valid_pid("276738;another"))
        self.assertFalse(valid_pid(""))

    def test_fifa_exact_identity_and_valid_edition(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/"fifa.json"
            path.write_text(json.dumps([
                {"fotmob_player_id":"276738","season":"2021/2022","fifa_edition":"FIFA 22",
                 "fifa_fc_overall":83,"fifa_fc_position":"CB","source_url":"https://example.org/verified","verified":True},
                {"fotmob_player_id":"999999","season":"2021/2022","fifa_edition":"FIFA 22",
                 "fifa_fc_overall":95,"source_url":"https://example.org/other"},
                {"fotmob_player_id":"276738","season":"2020/2021","fifa_edition":"FIFA 21",
                 "fifa_fc_overall":101,"source_url":"https://example.org/bad"}
            ]),encoding="utf-8")
            candidates,state=historical_dataset(str(path),"276738","fifa")
            self.assertEqual(len(candidates),1)
            self.assertEqual(candidates[0]["fifa_fc_overall"] if "fifa_fc_overall" in candidates[0] else candidates[0]["value"],83)
            self.assertEqual(candidates[0]["verification_status"],"verified")
            self.assertEqual(state["status"],"complete")

    def test_market_preserves_explicit_zero_and_date(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/"market.json"
            path.write_text(json.dumps([{"fotmob_player_id":"276738","season":"2021/2022",
                "transfermarkt_value_eur":0,"market_value_as_of":"2022-06-01",
                "source_url":"https://example.org/market","verified":False}]),encoding="utf-8")
            candidates,_=historical_dataset(str(path),"276738","market")
            self.assertEqual(candidates[0]["value"],0)
            self.assertEqual(candidates[0]["as_of_date"],"2022-06-01")
            self.assertEqual(candidates[0]["verification_status"],"unverified")

    def test_missing_studio_is_reported_without_inventing_values(self):
        with tempfile.TemporaryDirectory() as directory:
            candidates,states=collect(Path(directory),"276738",["fotmob","understat","fifa","market"])
            self.assertEqual(candidates,[])
            self.assertEqual(states["fotmob"]["status"],"error")
            self.assertEqual(states["fifa"]["status"],"unavailable")
            self.assertEqual(states["market"]["status"],"unavailable")

    def test_no_network_without_auth_configuration(self):
        with patch.dict(os.environ,{"MF_V3_WORKER_URL":"","MF_V3_WORKER_TOKEN":""}):
            with self.assertRaises(EnvironmentError):
                call("claim")

    def test_new_player_creates_profile_and_stats_cache_when_explicitly_allowed(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            root.joinpath("app").mkdir()
            profile=MagicMock()
            client=MagicMock()
            resolver=MagicMock()
            client.player_cache_path.side_effect=lambda r,p: r/"datos"/"perfiles_fotmob"/(p+".json")
            client.stat_cache_path.side_effect=lambda r,p,s: r/"datos"/"estadisticas_fotmob"/(p+"_"+s+".json")
            def write_file(path,data):
                path.parent.mkdir(parents=True,exist_ok=True)
                path.write_text(json.dumps(data),encoding="utf-8")
            client.save_json.side_effect=write_file
            profile.read_json.side_effect=lambda path: json.loads(path.read_text(encoding="utf-8"))
            client.fetch_profile.return_value={"id":795179}
            client.fetch_stats.return_value={"statsSection": {"items":[]}}
            profile.load_profile_bundle.return_value={
                "player":{"fotmob_player_id":"795179"},
                "season_options":[{"season":"2024/2025","competition":"Premier League",
                    "season_id":"2-0","tournament_id":"47","is_first":False}],
                "career":[{"season":"2024/2025","fotmob_team_id":"9825","team_name":"Arsenal"}],
            }
            resolver.load_assignments.return_value={}
            resolver.resolve_stats_team.return_value=("9825","Arsenal","unico_club",[])
            profile.extract_stat_details.return_value={"conflicts":[],"metrics":[{"name":"Clearances","value":111,"per90":3.2}]}
            with patch("worker.mf_v3_worker.studio_import",return_value=(profile,client,resolver)):
                result,status=studio_fotmob(root,"795179",allow_network=True,request_limit=2)
            self.assertEqual(client.fetch_profile.call_count,1)
            self.assertEqual(client.fetch_stats.call_count,1)
            self.assertTrue((root/"datos"/"perfiles_fotmob"/"795179.json").exists())
            self.assertTrue((root/"datos"/"estadisticas_fotmob"/"795179_2-0.json").exists())
            self.assertEqual(len(result),2)
            self.assertEqual(result[0]["metric_name"],"Clearances")
            self.assertEqual(result[0]["value"],111)
            self.assertEqual(result[0]["verification_status"],"unverified")
            self.assertEqual(status["status"],"complete")

    def test_single_club_fallback_without_unsafe_multiclub_guess(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            root.joinpath("app").mkdir()
            profile,client,resolver=MagicMock(),MagicMock(),MagicMock()
            client.player_cache_path.side_effect=lambda r,p:r/"profile.json"
            client.stat_cache_path.side_effect=lambda r,p,s:r/(s+".json")
            profile.load_profile_bundle.return_value={
                "player":{"fotmob_player_id":"309328"},
                "season_options":[
                    {"season":"2024/2025","competition":"Süper Lig","season_id":"club","tournament_id":"71"},
                    {"season":"2023/2024","competition":"Nations League","season_id":"national","tournament_id":"9806"}],
                "career":[{"season":"2024/2025","fotmob_team_id":"100","team_name":"Club A"},
                          {"season":"2023/2024","fotmob_team_id":"100","team_name":"Club A"}]}
            resolver.resolve_stats_team.side_effect=lambda d,b,p,a: ("100","Club A","unico_club",[]) if d["competition"]=="Süper Lig" else ("","","team_unresolved",[])
            profile.read_json.side_effect=lambda path: json.loads(path.read_text(encoding="utf-8"))
            client.fetch_profile.return_value={"id":309328}
            client.fetch_stats.return_value={"statsSection":{"items":[]}}
            client.save_json.side_effect=lambda p,d:p.write_text(json.dumps(d))
            profile.extract_stat_details.return_value={"conflicts":[],"metrics":[{"name":"Clearances","value":5}]}
            with patch("worker.mf_v3_worker.studio_import",return_value=(profile,client,resolver)):
                found,state=studio_fotmob(root,"309328",allow_network=True,request_limit=3)
            self.assertEqual(len(found),1)
            self.assertEqual(found[0]["fotmob_team_id"],"100")
            self.assertEqual(state["counts"]["team_unidentified"],1)
            self.assertEqual(profile.extract_stat_details.call_count,2)

    def test_new_player_does_not_fetch_if_network_disabled(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            profile=MagicMock()
            client=MagicMock()
            resolver=MagicMock()
            client.player_cache_path.side_effect=lambda r,p: r/"datos"/"perfiles_fotmob"/(p+".json")
            with patch("worker.mf_v3_worker.studio_import",return_value=(profile,client,resolver)):
                records,status=studio_fotmob(root,"795179",allow_network=False,request_limit=2)
            self.assertEqual(records,[])
            self.assertEqual(status["status"],"unavailable")
            client.fetch_profile.assert_not_called()


if __name__=="__main__":
    unittest.main()
