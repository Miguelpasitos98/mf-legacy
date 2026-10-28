# MF LEGACY — Trophies V1

## What is live
- `/trophies` in the top bar.
- Searchable catalog based on the user's original **2,181-row** identification CSV: 1,008 named and 1,173 pending.
- Source IDs and original renamed paths are preserved. Records without a verified identity are never assigned an invented name.
- Lightweight 48-card progressive gallery; filtering by identification status, Trophy Type and category.
- Trophy detail/editor backed by the Base44 `Trophy` entity (one record per `source_id`).
- Honour/edition records backed by `TrophyHonour`, referencing actual Team or Player IDs and recording provenance/verification; no simulated winners.
- The imported CSV is read-only. Editing a trophy creates an override in Base44 and retains its original ID.

## Image workflow: GitHub
The application looks for `/assets/trophies/<ID>.png`, where `<ID>` is the source ID in `relacion_trofeos.csv`.
For example:
- `public/assets/trophies/11.png`
- `public/assets/trophies/22.png`
- `public/assets/trophies/2016 Copa Bicentenario.png`

Upload these PNGs to **the existing mf-legacy GitHub repository** and deploy. The app will then load them without touching the database. Missing files show a neutral trophy icon.

To prepare an existing collection with the CSV's translated filenames, in the project folder run:

```powershell
python scripts/prepare_trophy_assets.py --csv "C:\\Trofeos\\relacion_trofeos.csv" --source "C:\\Trofeos" --dry-run
python scripts/prepare_trophy_assets.py --csv "C:\\Trofeos\\relacion_trofeos.csv" --source "C:\\Trofeos" --apply
```

The script writes `trophy_assets_report.json` including missing files and only copies available files. It never deletes originals and does not overwrite existing PNGs without `--overwrite`.

**Caution**: GitHub enforces repository/file limits. Use multiple small commits for the 2,181 files. No bulk PNGs have been uploaded as part of V1, because the actual image archive is not available in this chat. The CSV itself is hosted as a read-only Base44 asset for immediate catalog loading.

## Data contracts
- `Trophy.source_id`: stable original ID, unique by convention. Never use the translated trophy name for identity.
- `Trophy.trophy_type`: **exactly** `Team Trophy` or `Individual Trophy`; required to save a curated trophy. Uncurated imported rows may be unclassified.
- `TrophyHonour.trophy_id`: Base44 Trophy row ID.
- `TrophyHonour.trophy_source_id`: original trophy ID, for reconciliation.
- `TrophyHonour.season`: stored season or edition string; no inferred dates.
- `TrophyHonour.recipient_type`: `Team` or `Player`; `recipient_id` is an actual Base44 entity ID.
- `verified` and `source_url` distinguish sourced results from unverified claims.
- Rankings and goals are optional for individual awards.

## Next implementation phases
1. Import all PNGs and verify visual mappings and duplicates.
2. Curate Trophy Types, categories and country associations at scale without inventing classifications.
3. TeamDetail and PlayerDetail Hall of Fame: separate Team Trophies and Individual Trophies with **independent horizontal scrolling and no thumbnail size shrink**.
4. Build historical edition browser and evidence-based roster eligibility before attributing team titles to individual players.
5. Optional mapping of national-team records and award-specific ranking metadata.

Do not infer player trophies from membership in a club alone without a defined eligibility policy.
