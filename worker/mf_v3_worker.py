#!/usr/bin/env python3
"""MF Legacy V3 worker. Uses existing Studio caches; no provider scraping by default.

Environment:
 MF_V3_WORKER_URL: exact deployed Base44 import-worker endpoint
 MF_V3_WORKER_TOKEN: secret also set in Base44 backend
 MF_STUDIO_ROOT: root of existing MF_Legacy_Studio_Unificado (read-only caches)
 MF_V3_FIFA_JSON: optional verified historical FIFA/FC records
 MF_V3_MARKET_JSON: optional verified dated market records
 MF_V3_ALLOW_FOTMOB_NETWORK=1: opt-in, bounded individual requests
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import re
import sys
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from typing import Any

SCOPED_FIELDS = {"goals", "assists", "shots", "key_passes", "xG", "xA",
                 "npxG", "xGChain", "xGBuildup", "npxG_per90", "xG_per90", "xA_per90"}


def text(value: Any) -> str:
    return str(value or "").strip()


def valid_pid(pid: str) -> bool:
    return bool(re.fullmatch(r"\d{1,15}", text(pid)))


def number(value: Any):
    if isinstance(value, bool) or value in (None, ""):
        return None
    try:
        result = float(value)
        return result if result == result and abs(result) != float("inf") else None
    except (ValueError, TypeError, OverflowError):
        return None


def norm(value: Any) -> str:
    import unicodedata
    value = "".join(c for c in unicodedata.normalize("NFKD", text(value)) if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()


def report(status: str, note: str = "") -> dict:
    return {"status": status, "note": note[:300]}


def studio_import(root: Path):
    path = root / "app" / "profile.py"
    if not path.exists():
        raise FileNotFoundError("Falta el paquete 'app' original de MF Legacy Studio.")
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    from app import profile, fotmob_client, team_resolution  # noqa: F401
    return profile, fotmob_client, team_resolution


def studio_fotmob(root: Path, pid: str, allow_network=False, request_limit=0,
                  max_candidates=300):
    profile, client, resolver = studio_import(root)
    cache = client.player_cache_path(root, pid)
    network_count = 0
    if not cache.exists():
        if not allow_network or request_limit < 1:
            return [], report("unavailable", "Sin perfil local; consulta externa desactivada.")
        data = client.fetch_profile(pid)
        client.save_json(cache, data)
        network_count += 1
    bundle = profile.load_profile_bundle(cache)
    if bundle["player"]["fotmob_player_id"] != pid:
        raise ValueError("El perfil de FotMob pertenece a otro jugador.")
    assignments = resolver.load_assignments(root)
    out, errors, skipped = [], 0, 0
    for option in bundle["season_options"]:
        if len(out) >= max_candidates:
            break
        sid = option["season_id"]
        file = client.stat_cache_path(root, pid, sid)
        raw = None
        if file.exists():
            data = profile.read_json(file)
            meta = data.get("_mf_legacy_meta") if isinstance(data, dict) else None
            if meta and (text(meta.get("player_id")) != pid
                         or text(meta.get("season")) != option["season"]
                         or text(meta.get("competition")) != option["competition"]
                         or text(meta.get("season_id")) != sid):
                errors += 1
                continue
            raw = data.get("payload") if meta else data
        elif allow_network and network_count < request_limit:
            if network_count:
                time.sleep(2.0)
            try:
                raw = client.fetch_stats(pid, sid, option.get("is_first", False))
                network_count += 1
                client.save_json(file, {"_mf_legacy_meta": {
                    "player_id":pid, "season":option["season"],
                    "competition":option["competition"],"season_id":sid}, "payload":raw})
            except Exception:
                errors += 1
                continue
        if not isinstance(raw, dict):
            skipped += 1
            continue
        detail = {"fotmob_player_id":pid,"season":option["season"],
                  "competition":option["competition"],
                  "fotmob_tournament_id":option.get("tournament_id", ""),
                  "profile_season_id":sid}
        tid, tname, _, _ = resolver.resolve_career_team(detail, bundle, [], assignments)
        # No team = no safe staging: never merge league/national or two clubs.
        if not tid:
            skipped += 1
            continue
        parsed = profile.extract_stat_details(raw, player_id=pid,
                        season=option["season"],competition=option["competition"],
                        team_id=tid,team_name=tname,
                        tournament_id=option.get("tournament_id",""),profile_season_id=sid)
        conflicts = {norm(c) for c in parsed.get("conflicts") or []}
        for m in parsed.get("metrics") or []:
            name = text(m.get("name"))
            if not name or norm(name) in conflicts:
                continue
            for key,unit in (("value","total"),("per90","per90")):
                val = number(m.get(key))
                if val is None or val < 0:
                    continue
                # Preserve published percentages as percentages, not counts.
                real_unit = "percentage" if key=="value" and "%" in name else unit
                if real_unit=="percentage" and val>100:
                    continue
                out.append({"source":"fotmob","kind":"metric","season":option["season"],
                    "competition":option["competition"],"fotmob_team_id":tid,"team_name":tname,
                    "metric_name":name,"metric_unit":real_unit,"value":val,
                    "evidence_url":"https://www.fotmob.com/players/"+pid,
                    "source_record_id":sid+":"+norm(name)+":"+real_unit,
                    "verification_status":"unverified"})
                if len(out)>=max_candidates:
                    break
            if len(out)>=max_candidates:
                break
    return out,report("complete" if out else "unavailable",
        "Candidatos: "+str(len(out))+"; cachés/competiciones omitidas: "+str(skipped)+
        "; errores: "+str(errors)+"; peticiones FotMob: "+str(network_count)+
        ". Valores sujetos a revisión.")


def studio_understat(root: Path, pid: str, max_candidates=300):
    studio_import(root)
    from app.understat_observations import export_extension
    from app.profile import load_profile_bundle
    from app.fotmob_client import player_cache_path
    cache = player_cache_path(root, pid)
    if not cache.exists():
        return [], report("unavailable", "No existe un perfil FotMob para conciliar clubes.")
    bundle = load_profile_bundle(cache)
    extension = export_extension(root, pid)
    observations = extension.get("source_observations", [])
    out = []
    skipped = 0
    for observation in observations:
        if len(out)>=max_candidates:
            break
        if text(observation.get("player",{}).get("fotmob_player_id")) != pid:
            skipped += 1
            continue
        team = observation.get("team") or {}
        if team.get("multi_team"):
            skipped += 1
            continue
        season = text(observation.get("season"))
        comp_meta = observation.get("competition") or {}
        tournament_id=text(comp_meta.get("fotmob_tournament_id"))
        options=[x for x in bundle["season_options"] if
                 x["season"]==season and x.get("tournament_id")==tournament_id]
        if len(options)!=1:
            skipped += 1
            continue
        comp=options[0]["competition"]
        team_names={norm(n) for n in team.get("names",[]) if n}
        possible={(text(c.get("fotmob_team_id")), text(c.get("team_name")))
                for c in bundle["career"] if c.get("season")==season
                and norm(c.get("team_name")) in team_names and c.get("fotmob_team_id")}
        if team.get("fotmob_team_id"):
            possible={p for p in possible if p[0]==text(team["fotmob_team_id"])}
        if len(possible)!=1:
            skipped += 1
            continue
        tid,tname=next(iter(possible))
        stats=(observation.get("statistics") or {})
        fields=stats.get("fields") or {}
        for name,d in fields.items():
            if name not in SCOPED_FIELDS:
                continue
            val = number(d.get("normalized_value",d.get("value")))
            if val is None or val<0:
                continue
            out.append({"source":"understat","kind":"metric",
                "season":season,"competition":comp,"fotmob_team_id":tid,"team_name":tname,
                "metric_name":name,"metric_unit":"total","value":val,
                "evidence_url":"https://understat.com/",
                "source_record_id":text(observation.get("observation_id"))+":"+name+":total",
                "verification_status":"unverified"})
            per90=(stats.get("per90") or {}).get(name) or {}
            rate=number(per90.get("value"))
            if rate is not None and rate>=0 and len(out)<max_candidates:
                out.append({"source":"understat","kind":"metric",
                    "season":season,"competition":comp,"fotmob_team_id":tid,"team_name":tname,
                    "metric_name":name,"metric_unit":"per90","value":rate,
                    "evidence_url":"https://understat.com/",
                    "source_record_id":text(observation.get("observation_id"))+":"+name+":per90",
                    "verification_status":"unverified"})
            if len(out)>=max_candidates:
                break
    return out,report("complete" if out else "unavailable",
        "Candidatos Understat: "+str(len(out))+"; observaciones sin coincidencia exacta: "+str(skipped))


def historical_dataset(path_value: str, pid: str, source: str, max_candidates=300):
    if not path_value:
        return [],report("unavailable","No hay catálogo histórico autorizado configurado.")
    path=Path(path_value)
    if not path.exists():
        return [],report("error","Archivo histórico no encontrado.")
    data=json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data,list):
        raise ValueError("Los históricos verificados deben ser una lista JSON.")
    out=[]
    for row in data:
        if text(row.get("fotmob_player_id"))!=pid or len(out)>=max_candidates:
            continue
        season=text(row.get("season"))
        if not re.fullmatch(r"\d{4}(?:/\d{4})?",season):
            continue
        url=text(row.get("source_url"))
        if not url.startswith("https://"):
            continue
        verified=bool(row.get("verified") is True)
        if source=="fifa":
            value=number(row.get("fifa_fc_overall"))
            edition=text(row.get("fifa_edition"))
            if not edition or value is None or value<1 or value>99 or not value.is_integer():
                continue
            out.append({"source":"fifa","kind":"overall","season":season,"value":int(value),
                "fifa_edition":edition,"fifa_fc_position":text(row.get("fifa_fc_position")),
                "evidence_url":url,"source_record_id":text(row.get("record_id")),
                "verification_status":"verified" if verified else "unverified"})
        elif source=="market":
            value=number(row.get("transfermarkt_value_eur"))
            date=text(row.get("market_value_as_of"))
            if value is None or value<0 or not value.is_integer() or not re.fullmatch(r"\d{4}-\d{2}-\d{2}",date):
                continue
            out.append({"source":"market","kind":"market_value","season":season,"value":int(value),
                "as_of_date":date,"evidence_url":url,"source_record_id":text(row.get("record_id")),
                "verification_status":"verified" if verified else "unverified"})
    return out,report("complete" if out else "unavailable",str(len(out))+" valores históricos encontrados.")


def collect(root: Path, pid: str, sources: list[str], max_candidates=300):
    if not valid_pid(pid):
        raise ValueError("ID FotMob inválido.")
    if not root.is_dir():
        raise FileNotFoundError("No existe MF_STUDIO_ROOT.")
    out,states=[],{}
    for source in sources:
        try:
            if source=="fotmob":
                candidates,state=studio_fotmob(root,pid,
                    allow_network=os.getenv("MF_V3_ALLOW_FOTMOB_NETWORK")=="1",
                    request_limit=max(0,min(15,int(os.getenv("MF_V3_MAX_FOTMOB_REQUESTS","0")))),
                    max_candidates=max_candidates)
            elif source=="understat":
                candidates,state=studio_understat(root,pid,max_candidates=max_candidates)
            elif source=="fifa":
                candidates,state=historical_dataset(os.getenv("MF_V3_FIFA_JSON",""),pid,"fifa",max_candidates)
            elif source=="market":
                candidates,state=historical_dataset(os.getenv("MF_V3_MARKET_JSON",""),pid,"market",max_candidates)
            else:
                candidates,state=[],report("skipped","Fuente desconocida.")
            out.extend(candidates)
            states[source]=state
        except Exception as exc:
            states[source]=report("error",type(exc).__name__+": "+str(exc)[:160])
    return out,states


def call(action: str, **kwargs):
    url=os.getenv("MF_V3_WORKER_URL","").strip()
    token=os.getenv("MF_V3_WORKER_TOKEN","").strip()
    if not url.startswith("https://") or len(token)<32:
        raise EnvironmentError("Configure MF_V3_WORKER_URL HTTPS y MF_V3_WORKER_TOKEN (mínimo 32 caracteres).")
    content=json.dumps({"action":action,**kwargs},ensure_ascii=False,allow_nan=False).encode("utf-8")
    if len(content)>230000:
        raise ValueError("El lote excede el tamaño máximo del puente.")
    request=Request(url,data=content,method="POST",headers={
        "Content-Type":"application/json","Accept":"application/json",
        "X-MF-Worker-Token":token,"User-Agent":"MF-Legacy-V3-Worker/0.2"})
    try:
        with urlopen(request,timeout=50) as response:
            result=json.load(response)
    except HTTPError as exc:
        detail=exc.read(1000).decode("utf-8","replace")
        raise RuntimeError("Base44 rechazó la operación: HTTP "+str(exc.code)+": "+detail) from exc
    if not result.get("ok"):
        raise RuntimeError(text(result.get("error","Respuesta inesperada.")))
    return result


def run_once(root: Path, max_candidates=300) -> bool:
    assigned=call("claim",worker_id=os.getenv("HOSTNAME","mf-v3-python"))["job"]
    if not assigned:
        return False
    jid,claim=assigned["id"],assigned["claim_id"]
    try:
        candidates,states=collect(root,assigned["fotmob_player_id"],assigned["sources"],max_candidates)
        total=len(candidates)
        for i in range(0,total,15):
            call("heartbeat",job_id=jid,claim_id=claim,
                 progress=min(95,5+int(85*i/max(1,total))),phase="Normalización y envío seguro")
            call("submit",job_id=jid,claim_id=claim,candidates=candidates[i:i+15])
            time.sleep(0.5)
        call("finish",job_id=jid,claim_id=claim,source_results=states)
        return True
    except Exception as exc:
        try:
            call("fail",job_id=jid,claim_id=claim,error=type(exc).__name__+": "+str(exc)[:300])
        except Exception:
            pass
        raise


def main():
    parser=argparse.ArgumentParser(description="MF Legacy V3 worker para Base44")
    parser.add_argument("--once",action="store_true",help="Procesar como máximo un trabajo y salir")
    parser.add_argument("--dry-run",metavar="FOTMOB_ID",help="Leer fuentes locales sin tocar Base44")
    parser.add_argument("--max-candidates",type=int,default=300)
    args=parser.parse_args()
    root=Path(os.getenv("MF_STUDIO_ROOT","")).expanduser().resolve()
    limit=max(1,min(1500,args.max_candidates))
    if args.dry_run:
        records,states=collect(root,args.dry_run,["fotmob","understat","fifa","market"],limit)
        print(json.dumps({"fotmob_player_id":args.dry_run,"total_candidates":len(records),
              "sources":states,"sample":records[:4]},indent=2,ensure_ascii=False))
        return
    if args.once:
        run_once(root,limit)
        return
    while True:
        try:
            found=run_once(root,limit)
            if not found:time.sleep(30)
        except KeyboardInterrupt:
            break
        except Exception as error:
            print("Worker error: "+str(error),file=sys.stderr)
            time.sleep(60)


if __name__=="__main__":
    main()
