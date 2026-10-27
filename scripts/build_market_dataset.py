#!/usr/bin/env python3
"""Genera un índice estático local de Transfermarkt para la UI de MF Legacy.
Fuente: dcaribou/transfermarkt-datasets, instantánea pública; no realiza scraping.
Ejecutar en GitHub Actions. No modifica datos de Base44.
"""
import csv, gzip, io, json, urllib.request
from collections import defaultdict
from pathlib import Path

BASE = "https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/"
OUT = Path("public/data/market")
BUCKETS = 128

def rows(filename):
    with urllib.request.urlopen(BASE + filename, timeout=180) as response:
        # gzip.open streams without buffering the complete original CSV
        with gzip.GzipFile(fileobj=response) as compressed:
            reader = csv.DictReader(io.TextIOWrapper(compressed, encoding="utf-8-sig", newline=""))
            for row in reader:
                yield row

def ident(row):
    value = str(row.get("player_id", "")).strip()
    return value if value.isdigit() else None

def shard(pid):
    return str(int(pid) % BUCKETS).zfill(3)

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    players = []
    player_ids = set()
    for r in rows("players.csv.gz"):
        pid = ident(r)
        if not pid:
            continue
        player_ids.add(pid)
        players.append({
            "id": pid,
            "name": (r.get("name") or "").strip(),
            "dob": (r.get("date_of_birth") or "").strip()[:10],
            "club": (r.get("current_club_name") or "").strip(),
        })
    valuations = defaultdict(lambda: defaultdict(list))
    total = 0
    for r in rows("player_valuations.csv.gz"):
        pid = ident(r)
        if not pid or pid not in player_ids:
            continue
        date = (r.get("date") or "").strip()[:10]
        value = r.get("market_value_in_eur")
        if not date or not value:
            continue
        try:
            amount = int(float(value))
        except (ValueError, OverflowError):
            continue
        if amount < 0:
            continue
        valuations[shard(pid)][pid].append([
            date, amount, (r.get("current_club_name") or "").strip(),
        ])
        total += 1

    for bucket in range(BUCKETS):
        name = str(bucket).zfill(3)
        entries = valuations.get(name, {})
        for pid, history in entries.items():
            # Repeat dates collapse deterministically.
            by_date = {r[0]: r for r in history}
            entries[pid] = sorted(by_date.values(), key=lambda x: x[0])
        (OUT / f"valuations-{name}.json").write_text(
            json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
    (OUT / "players-index.json").write_text(
        json.dumps(players, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    (OUT / "manifest.json").write_text(
        json.dumps({"source":"dcaribou/transfermarkt-datasets","snapshot_max":"2026-06-12",
                    "players":len(players),"valuations":total,"buckets":BUCKETS},
                   ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Generated {len(players)} players and {total} valuations in {BUCKETS} shards")

if __name__ == "__main__":
    main()
