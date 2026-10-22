"""Offline smoke tests for the possession import pipeline."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
IMPORTER = ROOT / "import_fotmob_snapshots.py"
PLANNER = ROOT / "plan_coverage.py"
CATALOG = ROOT / "catalog" / "league_snapshot_2026-10-22.json"


class PossessionPipelineTest(unittest.TestCase):
    def test_catalog_and_coverage(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "coverage.csv"
            result = subprocess.run([sys.executable, str(PLANNER), "--leagues", str(CATALOG),
                                     "--from-year", "2025", "--to-year", "2026",
                                     "--output", str(out)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(len(out.read_text(encoding="utf-8").splitlines()), 37)
            self.assertIn("36 slots", result.stdout)

    def test_importer_validates_and_does_not_write_live_data(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            snapshots = root / "snapshots"
            snapshots.mkdir()
            (snapshots / "italy.json").write_text(json.dumps({
                "competition": "Serie A", "season": "2025/2026",
                "records": [{"team_name": "Inter", "team_possession_pct": "59,7",
                             "fotmob_team_id": "8636"}]
            }), encoding="utf-8")
            out = root / "import.json"
            result = subprocess.run([sys.executable, str(IMPORTER), "--leagues", str(CATALOG),
                                     "--snapshots", str(snapshots), "--output", str(out)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            data = json.loads(out.read_text(encoding="utf-8"))
            self.assertEqual(data["records"][0]["team_possession_pct"], 59.7)
            self.assertEqual(data["records"][0]["competition"], "Serie A")
            self.assertEqual(data["records"][0]["verification_status"], "pending")

    def test_rejects_unknown_competition_and_invalid_values(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            snapshots = root / "snapshots"
            snapshots.mkdir()
            (snapshots / "bad.json").write_text(json.dumps({
                "competition": "Not Existing", "season": "2025/2026",
                "records": [{"team_name": "Example", "team_possession_pct": 150}]
            }), encoding="utf-8")
            out = root / "out.json"
            result = subprocess.run([sys.executable, str(IMPORTER), "--leagues", str(CATALOG),
                                     "--snapshots", str(snapshots), "--output", str(out)],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertEqual(json.loads(out.read_text(encoding="utf-8"))["records"], [])
            self.assertIn("not in existing", out.with_suffix(".report.json").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
