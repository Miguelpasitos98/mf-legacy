import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from worker.mf_v3_worker import number, valid_pid, historical_dataset, collect, call


class WorkerContractTests(unittest.TestCase):
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


if __name__=="__main__":
    unittest.main()
