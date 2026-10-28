#!/usr/bin/env python3
"""Prepare the MF Legacy trophy PNGs for GitHub without renaming IDs.

Usage:
 python scripts/prepare_trophy_assets.py --csv relacion_trofeos.csv --source "C:/Trofeos" --dry-run
 python scripts/prepare_trophy_assets.py --csv relacion_trofeos.csv --source "C:/Trofeos" --apply

Output (on --apply): public/assets/trophies/<original_id>.png
Never replaces a PNG unless --overwrite is explicitly supplied.
Only copies files whose source can actually be found; does not synthesize images.
"""
import argparse
import csv
import json
import shutil
from pathlib import Path

def valid_id(value: str) -> bool:
    return bool(value) and "/" not in value and "\\" not in value and value not in {".", ".."}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", required=True, type=Path, help="CSV generado al identificar los 2181 trofeos")
    parser.add_argument("--source", required=True, type=Path, help="Carpeta que contiene 'Trofeos identificados' y 'Pendientes de identificar'")
    parser.add_argument("--output", type=Path, default=Path("public/assets/trophies"))
    mode=parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", help="Simular (modo predeterminado)")
    mode.add_argument("--apply", action="store_true", help="Copiar los PNG al proyecto")
    parser.add_argument("--overwrite", action="store_true", help="Permitir sobrescribir un PNG ya existente")
    parser.add_argument("--report", type=Path, default=Path("trophy_assets_report.json"))
    opts=parser.parse_args()
    if not opts.csv.is_file(): parser.error("No se encuentra el CSV")
    if not opts.source.is_dir(): parser.error("No se encuentra la carpeta de imágenes")

    records=[]
    with opts.csv.open("r", encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file, delimiter=";"):
            asset_id=(row.get("ID original / archivo") or "").strip()
            source_path=(row.get("Ruta del archivo renombrado") or "").strip()
            if not valid_id(asset_id):
                records.append({"id":asset_id,"status":"invalid_id"});continue
            source_file=opts.source / Path(source_path)
            # Some original archives keep the PNG under its numeric ID.
            candidates=[source_file,opts.source / (asset_id + ".png"),opts.source / "Trophies" / (asset_id+".png")]
            src=next((candidate for candidate in candidates if candidate.is_file()),None)
            dest=opts.output / (asset_id+".png")
            if not src:
                records.append({"id":asset_id,"status":"missing","expected":source_path});continue
            if dest.is_file() and not opts.overwrite:
                records.append({"id":asset_id,"status":"already_exists","destination":str(dest)});continue
            if opts.apply:
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src,dest)
            records.append({"id":asset_id,"status":"copied" if opts.apply else "ready","source":str(src),"destination":str(dest)})

    summary={status:sum(x["status"]==status for x in records) for status in ("ready","copied","missing","already_exists","invalid_id")}
    opts.report.parent.mkdir(parents=True,exist_ok=True)
    opts.report.write_text(json.dumps({"summary":summary,"records":records},ensure_ascii=False,indent=2),encoding="utf-8")
    print("Preparación de imágenes:",summary,"| informe:",opts.report)
    if summary["missing"]: print("Hay archivos sin encontrar: revisar la carpeta origen y el informe antes de publicar.")

if __name__=="__main__":
    main()
