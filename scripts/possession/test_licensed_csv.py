"""Basic offline tests for the licensed Big Five possession converter."""
import csv
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("import_licensed_csv.py")
FIELDS = ["competition","season","team_name","team_possession_pct","source","source_license","source_url","fotmob_team_id"]

class LicensedImportTest(unittest.TestCase):
    def run_case(self, row):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            input_path, output_path = folder/"source.csv", folder/"result.json"
            with input_path.open("w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=FIELDS)
                writer.writeheader()
                writer.writerow(row)
            result = subprocess.run([sys.executable, str(SCRIPT), "--input", str(input_path), "--output", str(output_path)], capture_output=True, text=True)
            output = json.loads(output_path.read_text(encoding="utf-8")) if output_path.exists() else None
            return result.returncode, output

    def test_good_row(self):
        code, content = self.run_case(dict(competition="Premier League",season="2017/2018",team_name="Example FC",team_possession_pct="55.2",source="Licensed dataset",source_license="CC BY 4.0",source_url="https://example.org/source",fotmob_team_id="123"))
        self.assertEqual(code, 0)
        self.assertEqual(content["records"][0]["team_possession_pct"], 55.2)
        self.assertEqual(content["records"][0]["verification_status"], "pending")

    def test_rejects_unlicensed(self):
        code, content = self.run_case(dict(competition="Premier League",season="2017/2018",team_name="Example FC",team_possession_pct="55.2",source="Unknown",source_license="",source_url="https://example.org/source"))
        self.assertNotEqual(code, 0)
        self.assertIsNone(content)

    def test_rejects_invalid_stat(self):
        code, content = self.run_case(dict(competition="Serie A",season="2017/2018",team_name="Example FC",team_possession_pct="155",source="Licensed",source_license="CC BY 4.0",source_url="https://example.org/source"))
        self.assertNotEqual(code, 0)
        self.assertIsNone(content)

if __name__ == "__main__":
    unittest.main()
