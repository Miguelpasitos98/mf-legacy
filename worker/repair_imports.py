"""Resumable global repair through the existing authenticated worker endpoint."""
import argparse
import json
from pathlib import Path
from mf_v3_worker import call


def main():
    parser=argparse.ArgumentParser(description="Simulación y reparación global de importaciones MF LEGACY")
    parser.add_argument("action",choices=["create","status","step","apply","pause","resume","recover"])
    parser.add_argument("--run-id")
    parser.add_argument("--player-ids",nargs="*")
    parser.add_argument("--steps",type=int,default=1)
    parser.add_argument("--output",type=Path)
    args=parser.parse_args()
    body={}
    if args.run_id:body["run_id"]=args.run_id
    if args.player_ids:body["player_ids"]=args.player_ids
    result=None
    for _ in range(max(1,args.steps) if args.action=="step" else 1):
        result=call("repair-"+args.action,**body)
        print(json.dumps({k:v for k,v in result.items() if k not in ("report","reports")},ensure_ascii=False),flush=True)
        if result.get("run",{}).get("status") in ("completed","paused"):break
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")


if __name__=="__main__":main()
