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
                 "npxG", "xGChain", "xGBuildup"}


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


def metric_values(metric):
    """Provider totals, percentages and rates; never synthesize one from another."""
    name = text(metric.get("name"))
    raw_name = name.casefold()
    value = number(metric.get("value"))
    fmt = text(metric.get("stat_format")).casefold()
    per90_label = bool(re.search(r"(?:/\s*90|per\s*90|por\s*90)", raw_name))
    per_match = bool(re.search(r"(?:per\s*(?:match|game)|por\s*partido|/\s*match)", raw_name))
    percentage = fmt in {"percent", "percentage"} or "%" in name
    signed = norm(name) in {"goals prevented", "goles evitados"}
    unit = "percentage" if percentage else "per90" if per90_label else "per_match" if per_match else "total"
    if value is not None and (value >= 0 or signed) and (not percentage or 0 <= value <= 100):
        yield unit, value
    rate = number(metric.get("per90"))
    # FotMob repeats ratings, appearances, starts and minutes in its per90 slot.
    non_rates = {"rating", "fotmob rating", "matches", "appearances", "started", "minutes", "minutes played"}
    if not percentage and not per90_label and not per_match and norm(name) not in non_rates and rate is not None and (rate >= 0 or signed):
        yield "per90", rate


def studio_fotmob(root: Path, pid: str, allow_network=False, request_limit=0,
                  max_candidates=6000):
    profile, client, resolver = studio_import(root)
    if not callable(getattr(resolver,'resolve_stats_team',None)):
        raise RuntimeError('Falta la reparación de Studio: ejecuta worker/apply_studio_patch.py con su ruta.')
    cache = client.player_cache_path(root, pid)
    network_count = 0
    if not cache.exists():
        if not allow_network or request_limit < 1:
            return [], report("unavailable", "Caché de perfil ausente; consulta externa desactivada.")
        network_count += 1
        data = client.fetch_profile(pid)
        client.save_json(cache, data)
    bundle = profile.load_profile_bundle(cache)
    if text(bundle["player"]["fotmob_player_id"]) != pid:
        raise ValueError("El perfil de FotMob pertenece a otro jugador.")
    assignments = resolver.load_assignments(root)
    out, diagnostics = [], []
    options = sorted(bundle["season_options"], key=lambda o: (text(o.get("season")), text(o.get("season_id"))), reverse=True)
    seen = set()
    for option in options:
        sid = option["season_id"]
        diag = {"season": option["season"], "competition": option["competition"],
                "season_id": sid, "tournament_id": text(option.get("tournament_id"))}
        diagnostics.append(diag)
        if not option["competition"] or not text(option.get("tournament_id")):
            diag.update(status="competition_unidentified", reason="El perfil no identifica la competición con ID oficial.")
            continue
        identity=(option["season"], text(option.get("tournament_id")))
        if identity in seen:
            diag.update(status="duplicate_option", reason="Misma temporada e ID oficial ya procesados.")
            continue
        seen.add(identity)
        file = client.stat_cache_path(root, pid, sid)
        raw = None
        try:
            if file.exists():
                data = profile.read_json(file)
                meta = data.get("_mf_legacy_meta")
                if not isinstance(meta,dict) or not meta:
                    diag.update(status="incompatible_response", reason="Caché antigua sin metadatos de identidad: no se atribuyen estadísticas por posición de archivo.")
                    continue
                if meta and (text(meta.get("player_id")) != pid
                             or text(meta.get("season")) != option["season"]
                             or text(meta.get("competition")) != option["competition"]
                             or text(meta.get("season_id")) != sid
                             or (meta.get("tournament_id") and text(meta["tournament_id"]) != text(option.get("tournament_id")))):
                    diag.update(status="incompatible_response", reason="Identidad de caché incompatible con el perfil actual.")
                    continue
                raw = data.get("payload") if meta else data
            elif sid == next((o["season_id"] for o in bundle["season_options"]), None):
                # The profile can embed the first tournament; no new request needed.
                data=profile.read_json(cache)
                raw=data.get("firstSeasonStats")
            if raw is None and not file.exists() and allow_network and network_count < request_limit:
                if network_count:
                    time.sleep(2.0)
                network_count += 1  # Failed requests also consume the budget.
                raw = client.fetch_stats(pid, sid, option.get("is_first", False))
                client.save_json(file, {"_mf_legacy_meta": {
                    "player_id":pid, "season":option["season"], "competition":option["competition"],
                    "season_id":sid,"tournament_id":text(option.get("tournament_id"))}, "payload":raw})
            if raw is None and not file.exists():
                diag.update(status="cache_absent", reason="Caché ausente; no se dispone de playerStats local.")
                continue
            if not isinstance(raw, dict) or not any(k in raw for k in ("statsSection", "topStatCard")):
                diag.update(status="incompatible_response", reason="Respuesta sin bloques playerStats reconocibles.")
                continue
            if (raw.get('playerId') is not None and text(raw['playerId'])!=pid
                    or raw.get('seasonId') is not None and text(raw['seasonId'])!=sid):
                diag.update(status="incompatible_response", reason="El payload declara otra identidad de jugador o de entrada estadística.")
                continue
            parsed = profile.extract_stat_details(raw, player_id=pid, season=option["season"],
                competition=option["competition"], tournament_id=option.get("tournament_id",""), profile_season_id=sid)
            conflict_key=lambda value: norm(value)+( " pct" if "%" in value else "")
            conflicts = {conflict_key(c) for c in parsed.get("conflicts") or []}
            metrics = [m for m in parsed.get("metrics") or [] if text(m.get("name")) and conflict_key(m["name"]) not in conflicts]
            diag["recovered_metrics"] = len(metrics)
            if not metrics:
                diag.update(status="no_statistics", reason="El proveedor no ofrece estadísticas numéricas utilizables.")
                continue
            detail = {"fotmob_player_id":pid,"season":option["season"],"competition":option["competition"],
                      "fotmob_tournament_id":option.get("tournament_id", ""),"profile_season_id":sid}
            tid,tname,evidence,possible = resolver.resolve_stats_team(detail,bundle,raw,assignments)
            diag.update(fotmob_team_id=tid, team_name=tname, team_evidence=evidence,
                        possible_teams=possible, conflicts=sorted(conflicts))
            if not tid:
                diag.update(status="team_unidentified", reason=evidence or "Sin evidencia de un único equipo; pendiente de conciliación.")
                continue
            by_name={norm(m['name']):m.get('value') for m in metrics}
            if (number(by_name.get('started')) is not None and number(by_name.get('matches')) is not None
                    and by_name['started']>by_name['matches']):
                diag.update(status="pending_reconciliation", reason="Titularidades superiores a partidos: el payload es contradictorio; no se proponen valores.")
                continue
            national_leagues={'9806','9807','9808'}
            career_leagues={text(c.get('fotmob_tournament_id')) for c in bundle.get('career',[])
                            if c.get('is_national_team') and c.get('season')==option['season']}
            if text(option.get('tournament_id')) in national_leagues and career_leagues & national_leagues and text(option.get('tournament_id')) not in career_leagues:
                diag.update(status="pending_reconciliation", reason="La división de Nations League difiere entre statSeasons y careerHistory; no se cambia ni se asume competición.")
                continue
            batch=[]
            for m in metrics:
                name=text(m["name"])
                for unit,val in metric_values(m):
                    batch.append({"source":"fotmob","kind":"metric","season":option["season"],
                        "competition":option["competition"],"fotmob_team_id":tid,"team_name":tname,
                        "fotmob_tournament_id":text(option.get("tournament_id")),
                        "is_national_team":bool(next((c.get("is_national_team") for c in bundle.get("career",[]) if text(c.get("fotmob_team_id"))==tid),False)),
                        "metric_name":name,"metric_unit":unit,"value":val,
                        **({"derivation":text(m['derivation'])} if m.get('derivation') else {}),
                        **({"percentile":m['percentile_per90' if unit=='per90' else 'percentile']}
                           if number(m.get('percentile_per90' if unit=='per90' else 'percentile')) is not None
                           and 0 <= m['percentile_per90' if unit=='per90' else 'percentile'] <= 100 else {}),
                        "evidence_url":"https://www.fotmob.com/players/"+pid,
                        "source_record_id":option["season"]+":"+text(option.get("tournament_id"))+":"+tid+":"+norm(name)+":"+unit,
                        "verification_status":"unverified"})
            # Do not cut a season in half when the bounded result is full.
            if len(out)+len(batch)>max_candidates:
                diag.update(status="candidate_limit", reason="Límite alcanzado; temporada completa conservada para otro lote.")
                continue
            out.extend(batch)
            diag.update(status="pending_review", candidates=len(batch), reason="Estadísticas recuperadas; requieren verificación y aprobación.")
        except (ValueError, KeyError, TypeError, OSError) as exc:
            diag.update(status="incompatible_response", reason=type(exc).__name__+": "+str(exc)[:160])
    from collections import Counter
    counts=dict(Counter(d["status"] for d in diagnostics))
    state=report("complete" if out else "unavailable",
        f"Candidatos: {len(out)}; recuperadas: {counts.get('pending_review',0)}; caché ausente: {counts.get('cache_absent',0)}; "
        f"equipo pendiente: {counts.get('team_unidentified',0)}; incompatibles: {counts.get('incompatible_response',0)}; "
        f"peticiones FotMob: {network_count}. Pendientes de revisión.")
    state.update(counts=counts,diagnostics=diagnostics,network_requests=network_count)
    return out,state


def studio_understat(root: Path, pid: str, max_candidates=300, existing_scopes=None):
    studio_import(root)
    from app.understat_observations import export_extension
    from app.profile import load_profile_bundle
    from app.fotmob_client import player_cache_path
    from app.understat_bridge import contextual_team_match
    cache=player_cache_path(root,pid)
    if not cache.exists():return [],report("unavailable","No existe perfil FotMob para conciliar identidad y trayectoria.")
    bundle=load_profile_bundle(cache)
    observations=export_extension(root,pid).get("source_observations",[])
    # Prefer the published dataset revision; older originals remain archived.
    observations.sort(key=lambda o:bool(o.get("dataset_import")),reverse=True)
    out=[];seen=set();diagnostics=[]
    for observation in observations:
        team=observation.get("team") or {};season=text(observation.get("season"))
        tid=text((observation.get("competition") or {}).get("fotmob_tournament_id"))
        if text(observation.get("player",{}).get("fotmob_player_id"))!=pid or team.get("multi_team"):continue
        names=team.get("names",[])
        possible={(text(c.get("fotmob_team_id")),text(c.get("team_name")),text(c.get("competition"))) for c in bundle["career"]
          if c.get("season")==season and text(c.get("fotmob_tournament_id"))==tid and c.get("fotmob_team_id")
          and any(contextual_team_match(n,c.get("team_name"),tid,c.get("fotmob_team_id")) for n in names)}
        teams={(x[0],x[1]) for x in possible}
        if len(teams)!=1:continue
        team_id,team_name=next(iter(teams));scope=(season,tid,team_id)
        if scope in seen:continue
        seen.add(scope)
        options=[o for o in bundle['season_options'] if o['season']==season and text(o.get('tournament_id'))==tid]
        comp=options[0]['competition'] if len(options)==1 else {'47':'Premier League','87':'LaLiga','54':'Bundesliga','55':'Serie A','53':'Ligue 1','63':'Russian Premier League'}.get(tid)
        if not comp:continue
        stats=observation.get('statistics') or {};fields=stats.get('fields') or {}
        minutes=number((fields.get('time') or {}).get('normalized_value',(fields.get('time') or {}).get('value')))
        if minutes is None or minutes<=0:continue
        dataset=observation.get('dataset_source') or {};uid=text(observation.get('player',{}).get('understat_player_id'))
        batch=[]
        for original,label in [('xGChain','xG Chain'),('xGBuildup','xG Buildup')]:
            d=fields.get(original) or {};total=number(d.get('normalized_value',d.get('value')))
            if total is None or total<0:continue
            chain=fields.get('xGChain') or {};chain_value=number(chain.get('normalized_value',chain.get('value')))
            if original=='xGBuildup' and chain_value is not None and total>chain_value:continue
            provenance={'provider':'understat_local_export' if observation.get('manual_import') else 'understat_archive','player_id':uid,'provider_minutes':minutes,
                'scope':'league_team_season',
                'sha256':text(dataset.get('sha256') or (d.get('provenance') or {}).get('file_sha256') or (d.get('provenance') or {}).get('content_sha256') or (d.get('provenance') or {}).get('raw_sha256'))}
            archive_urls=__import__('worker.historical_sources' if __package__ else 'historical_sources',fromlist=['UNDERSTAT_ARCHIVES_BY_SHA']).UNDERSTAT_ARCHIVES_BY_SHA
            if provenance['sha256'] in archive_urls:provenance['archive_url']=archive_urls[provenance['sha256']]
            verified=bool(uid and provenance.get('archive_url') and not observation.get('manual_import'))
            for unit,value in [('total',total),('per90',total*90/minutes)]:
                batch.append({'source':'understat','kind':'metric','season':season,'competition':comp,
                    'fotmob_team_id':team_id,'team_name':team_name,'fotmob_tournament_id':tid,'is_national_team':False,
                    'metric_name':label,'metric_unit':unit,'value':value,'evidence_url':'https://understat.com/player/'+uid,
                    'source_record_id':text(observation['observation_id'])+':'+original+':'+unit,
                    'verification_status':'verified' if verified else 'unverified','provenance':provenance,
                    **({'derivation':original+' * 90 / Understat minutes ('+str(minutes)+')'} if unit=='per90' else {})})
        if batch:
            batch.append({**batch[0],'metric_name':'Understat minutes','metric_unit':'total','value':minutes,
                'source_record_id':text(observation['observation_id'])+':minutes:total'})
            exists=existing_scopes is None or any(r.get('season')==season and text(r.get('fotmob_tournament_id'))==tid and text(r.get('fotmob_team_id'))==team_id for r in existing_scopes)
            if not exists:
                # A new Understat league row may use its OWN verified summaries.
                # Never compare/replace existing FotMob minutes with this clock.
                batch.append({**batch[0],'metric_name':'Minutes','metric_unit':'total','value':minutes,'source_record_id':text(observation['observation_id'])+':summary-minutes'})
                games=number((fields.get('games') or {}).get('normalized_value',(fields.get('games') or {}).get('value')))
                if games is not None and games.is_integer() and games>0:batch.append({**batch[0],'metric_name':'Matches','metric_unit':'total','value':games,'source_record_id':text(observation['observation_id'])+':summary-matches'})
        if len(out)+len(batch)>max_candidates:break
        out.extend(batch);diagnostics.append({'season':season,'competition':comp,'team_name':team_name,
            'fotmob_team_id':team_id,'status':'pendiente_verificacion','candidates':len(batch),
            'reason':'Liga/club/temporada exactos; tasas calculadas con minutos Understat, sin atribuirlas a copas o selección.'})
    state=report('complete' if out else 'unavailable','Candidatos Understat: '+str(len(out))+'. Revisión requerida; cobertura de liga solamente.')
    state['diagnostics']=diagnostics
    return out,state


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


def collect(root: Path, pid: str, sources: list[str], max_candidates=6000, offline=False, force_pending=False, existing_scopes=None):
    if not valid_pid(pid):
        raise ValueError("ID FotMob inválido.")
    if not root.is_dir():
        raise FileNotFoundError("No existe MF_STUDIO_ROOT.")
    out,states=[],{}
    import importlib
    automation=importlib.import_module('worker.historical_sources' if __package__ else 'historical_sources')
    catalogs=None
    def catalog():
        nonlocal catalogs
        if catalogs is None:catalogs=automation.Catalogs(root,network=not offline and os.getenv('MF_V3_ALLOW_PUBLIC_ARCHIVES')=='1',force=force_pending)
        return catalogs
    def context():
        profile,client,_=studio_import(root)
        raw=profile.read_json(client.player_cache_path(root,pid));bundle=profile.load_profile_bundle(client.player_cache_path(root,pid))
        if text(bundle['player']['fotmob_player_id'])!=pid:raise ValueError('Perfil de otro jugador')
        seasons=sorted({o['season'] for o in bundle['season_options'] if re.fullmatch(r'20\d{2}/20\d{2}',o['season']) and int(o['season'][5:])==int(o['season'][:4])+1},reverse=True)
        return bundle,raw,seasons
    for source in sources:
        try:
            if source=="fotmob":
                candidates,state=studio_fotmob(root,pid,
                    allow_network=not offline and os.getenv("MF_V3_ALLOW_FOTMOB_NETWORK")=="1",
                    request_limit=max(0,min(15,int(os.getenv("MF_V3_MAX_FOTMOB_REQUESTS","0")))),
                    max_candidates=max_candidates)
            elif source=="understat":
                bundle,raw,seasons=context()
                try:catalog().understat(pid,bundle)
                except Exception as prepare_error:
                    # Existing verified Studio caches remain usable if refresh fails.
                    candidates,state=studio_understat(root,pid,max_candidates=max_candidates,existing_scopes=existing_scopes)
                    state['note']+=' Preparación: '+str(prepare_error)[:160]
                    if not candidates:raise
                else:candidates,state=studio_understat(root,pid,max_candidates=max_candidates,existing_scopes=existing_scopes)
                candidates=[c for c in candidates if not catalog().saved(pid,source,c['season'])]
                for d in state.get('diagnostics',[]):
                    if catalog().saved(pid,source,d['season']):d['status']='verificado_guardado'
                    else:catalog().state(pid,source,d['season'],'pendiente_verificacion',d)
                supported={'47','87','54','55','53','63'}
                for o in bundle['season_options']:
                    if text(o.get('tournament_id')) not in supported:
                        state.setdefault('diagnostics',[]).append({'season':o['season'],'competition':o['competition'],'status':'fuera_cobertura','reason':'Understat cubre ligas domésticas compatibles; no esta competición.'})
            elif source=="fifa":
                if os.getenv('MF_V3_FIFA_JSON'):candidates,state=historical_dataset(os.environ['MF_V3_FIFA_JSON'],pid,'fifa',max_candidates)
                else:
                    bundle,raw,seasons=context();candidates=catalog().fifa(pid,bundle,raw,seasons)[:max_candidates]
                    state=report('partial' if len(candidates)<len(seasons) else 'complete',str(len(candidates))+' Overall de lanzamiento recuperados; no se usan actualizaciones posteriores.')
            elif source=="market":
                if os.getenv('MF_V3_MARKET_JSON'):candidates,state=historical_dataset(os.environ['MF_V3_MARKET_JSON'],pid,'market',max_candidates)
                else:
                    bundle,raw,seasons=context();candidates=catalog().market(pid,bundle,raw,seasons)[:max_candidates]
                    state=report('partial' if len(candidates)<len(seasons) else 'complete',str(len(candidates))+' valoraciones históricas fechadas; regla último valor dentro de julio–junio.')
            else:
                candidates,state=[],report("skipped","Fuente desconocida.")
            if source in ('fifa','market') and catalogs:
                catalogs.state(pid,source,'','dato_encontrado',{'candidates':len(candidates)})
                state['diagnostics']=[{'season':d['season'],'status':d['state'],'reason':json.loads(d['details']).get('reason','Dato encontrado; revisar antes de guardar.'),'competition':d['edition']} for d in catalogs.diagnostics(pid,source)]
            out.extend(candidates)
            states[source]=state
        except Exception as exc:
            states[source]=report("unavailable" if source != "fotmob" and isinstance(exc,FileNotFoundError) else "error",type(exc).__name__+": "+str(exc)[:160])
            failure='pendiente_verificacion' if isinstance(exc,ValueError) else 'consulta_pendiente' if 'modo sin red' in str(exc) else 'error_temporal'
            states[source]['diagnostics']=[{'status':failure,'reason':str(exc)[:240]}]
            if catalogs:catalogs.state(pid,source,'',failure,{'reason':str(exc)[:250]})
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
    for attempt in range(4):
        try:
            with urlopen(request,timeout=50) as response:
                result=json.load(response)
            break
        except HTTPError as exc:
            if exc.code==429 and attempt<3:
                # A rejected rate-limited request has not committed. Candidate
                # keys also make submit retries idempotent; never replay timeouts.
                wait=number(exc.headers.get("Retry-After")) or 10
                time.sleep(max(1,min(60,wait))+0.25)
                continue
            detail=exc.read(1000).decode("utf-8","replace")
            raise RuntimeError("Base44 rechazó la operación: HTTP "+str(exc.code)+": "+detail) from exc
    if not result.get("ok"):
        raise RuntimeError(text(result.get("error","Respuesta inesperada.")))
    return result


def sync_reviews(root):
    import importlib
    Catalogs=importlib.import_module('worker.historical_sources' if __package__ else 'historical_sources').Catalogs
    cache=Catalogs(root)
    for job in cache.pending_jobs():
        state=call('review-status',job_id=job['job_id'])
        cache.apply_review_status(job['job_id'],job['pid'],state.get('groups',[]),state.get('finished',False))

def run_once(root: Path, max_candidates=6000, job_id=None) -> bool:
    assigned=call("claim",worker_id=os.getenv("HOSTNAME","mf-v3-python"),**({"job_id":job_id} if job_id else {}))["job"]
    if not assigned:
        return False
    jid,claim=assigned["id"],assigned["claim_id"]
    try:
        try:sync_reviews(root)
        except Exception as review_error:print('Conciliación de revisión pendiente: '+str(review_error)[:150],file=sys.stderr)
        candidates,states=collect(root,assigned["fotmob_player_id"],assigned["sources"],max_candidates,force_pending=assigned.get('retry_pending',False),existing_scopes=assigned.get('existing_stats'))
        total=len(candidates)
        for i in range(0,total,15):
            call("heartbeat",job_id=jid,claim_id=claim,
                 progress=min(95,5+int(85*i/max(1,total))),phase="Normalización y envío seguro")
            call("submit",job_id=jid,claim_id=claim,candidates=candidates[i:i+15])
            time.sleep(0.5)
        call("finish",job_id=jid,claim_id=claim,source_results=states)
        import importlib
        importlib.import_module('worker.historical_sources' if __package__ else 'historical_sources').Catalogs(root).track_job(jid,assigned['fotmob_player_id'])
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
    parser.add_argument("--max-candidates",type=int,default=6000)
    parser.add_argument("--job-id",help="Procesar solo el trabajo indicado, sin reclamar otros jugadores")
    parser.add_argument("--output",type=Path,help="Guardar diagnóstico completo y candidatos locales para revisión")
    parser.add_argument("--check-config",action="store_true",help="Comprobar la configuración sin descargar datos ni reclamar trabajos")
    parser.add_argument("--sync-reviews",action="store_true",help="Conciliar revisiones aplicadas con el catálogo local, sin consultar proveedores")
    args=parser.parse_args()
    root=Path(os.getenv("MF_STUDIO_ROOT","")).expanduser().resolve()
    limit=max(1,min(6000,args.max_candidates))
    if args.job_id and not re.fullmatch(r'[a-f0-9]{24}',args.job_id,re.I):
        parser.error('ID de trabajo inválido.')
    if args.check_config:
        required={
            "studio_instalado":(root/"app"/"profile.py").exists() and (root/"app"/"fotmob_client.py").exists(),
            "endpoint_https":os.getenv("MF_V3_WORKER_URL","").startswith("https://"),
            "secreto_local_configurado":len(os.getenv("MF_V3_WORKER_TOKEN",""))>=32,
            "python_compatible":sys.version_info>=(3,10),
        }
        try:
            required['studio_parser_compatible']=callable(getattr(studio_import(root)[2],'resolve_stats_team',None))
        except (ImportError,FileNotFoundError):
            required['studio_parser_compatible']=False
        print(json.dumps({"ready":all(required.values()),"comprobaciones":required,
            "consultas_nuevas_limitadas":os.getenv("MF_V3_ALLOW_FOTMOB_NETWORK")=="1",
            "peticiones_maximas_por_trabajo":os.getenv("MF_V3_MAX_FOTMOB_REQUESTS","0"),
            "nota":"No se realizaron solicitudes a proveedores ni se modificaron datos."},indent=2,ensure_ascii=False))
        if not all(required.values()):sys.exit(2)
        return
    if args.dry_run:
        records,states=collect(root,args.dry_run,["fotmob","understat","fifa","market"],limit,offline=True)
        if args.output:
            args.output.parent.mkdir(parents=True,exist_ok=True)
            args.output.write_text(json.dumps({"fotmob_player_id":args.dry_run,
                "sources":states,"candidates":records},ensure_ascii=False,indent=2),encoding="utf-8")
        print(json.dumps({"fotmob_player_id":args.dry_run,"total_candidates":len(records),
              "sources":states,"sample":records[:4]},indent=2,ensure_ascii=False))
        return
    if args.sync_reviews:
        sync_reviews(root)
        print(json.dumps({'reviews_synced':True,'provider_requests':0}))
        return
    if args.once:
        run_once(root,limit,args.job_id)
        return
    while True:
        try:
            found=run_once(root,limit,args.job_id)
            if not found:time.sleep(30)
        except KeyboardInterrupt:
            break
        except Exception as error:
            print("Worker error: "+str(error),file=sys.stderr)
            time.sleep(60)


if __name__=="__main__":
    main()
