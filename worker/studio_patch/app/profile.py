"""Lectura sin red de archivos JSON individuales previamente obtenidos por el usuario.

Basado en los parsers de FotMobExtractor_LIMPIOV2.py. Las trayectorias son
TEMPORADAS deportivas, no fechas de contrato ni transferencias confirmadas.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import unicodedata

PROFILE_SCHEMA = "mf_legacy_fotmob_career_review_v1"
DETAIL_SCHEMA = "mf_legacy_fotmob_player_stats_review_v1"


def slug(s):
    s = ''.join(x for x in unicodedata.normalize('NFKD', str(s or '')) if not unicodedata.combining(x))
    return re.sub(r'[^a-z0-9]+', '-', s.casefold()).strip('-')


def asnum(value):
    if isinstance(value, dict):
        value = next((value[k] for k in ('rating','value','statValue') if k in value), None)
    if value is None or isinstance(value, (bool, list, dict)) or str(value).strip() == '':
        return None
    try:
        # Los JSON antiguos pueden contener unidades: km, km/h, %.
        raw=str(value).strip().replace(',','.')
        raw=re.sub(r'\s*(?:km/h|km|%)\s*$', '', raw, flags=re.IGNORECASE)
        n=float(raw)
        return n if n == n and abs(n) != float('inf') else None
    except (ValueError,TypeError,OverflowError):
        return None


def read_json(path):
    with open(path,encoding='utf-8-sig') as f:
        data=json.load(f)
    if not isinstance(data,dict):
        raise ValueError('Se esperaba un objeto JSON de perfil o estadísticas.')
    return data


def first(d,*keys):
    if not isinstance(d,dict): return None
    for k in keys:
        if k in d and d[k] not in (None,'',[],{}): return d[k]
    return None


def find_block(data,name):
    if not isinstance(data, (dict,list)): return None
    if isinstance(data,dict):
        if name in data and data[name] not in (None,[],{}): return data[name]
        for v in data.values():
            found=find_block(v,name)
            if found is not None:return found
    else:
        for v in data:
            found=find_block(v,name)
            if found is not None:return found
    return None


def team_parts(v):
    if isinstance(v,dict):
        return str(first(v,'name','teamName','clubName') or ''), str(first(v,'id','teamId') or '')
    if isinstance(v,str):return v,''
    return '',''


def season_span(season):
    years=[int(y) for y in re.findall(r'(?<!\d)(?:19|20)\d{2}(?!\d)',str(season or ''))]
    if len(years)>1:return min(years),max(years)
    if len(years)==1:
        # FotMob puede representar temporadas de año natural, no inventar segundo año.
        return years[0], years[0]
    return None,None


def profile_identity(payload, fallback_id=''):
    p=payload.get('playerData',payload)
    if not isinstance(p,dict):p=payload
    primary=p.get('primaryTeam') or {}
    pos=p.get('positionDescription') or {}
    team,tid=team_parts(primary)
    return {
        'fotmob_player_id':str(first(p,'id','playerId') or fallback_id),
        'name':str(first(p,'name','playerName','fullName') or ''),
        'full_name':str(first(p,'fullName') or ''),
        'primary_team':team,
        'primary_team_id':tid,
        'position_raw':pos,
    }


def _walk_career(node, ctx=None):
    """Las filas heredan club solo dentro de su propia rama JSON."""
    ctx=dict(ctx or {})
    if isinstance(node,list):
        for x in node:yield from _walk_career(x,ctx)
        return
    if not isinstance(node,dict):return
    name,tid=team_parts(first(node,'team','teamName','clubName'))
    if name:ctx['team_name']=name
    if tid:ctx['team_id']=tid
    local_id=first(node,'teamId','clubId')
    if local_id is not None:ctx['team_id']=str(local_id)
    season=first(node,'seasonName','season')
    if season is not None:
        ctx['season']=str(season)
    competition=first(node,'competitionName','tournamentName')
    if competition:
        ctx['competition']=str(competition)
    else:
        # Si hay seasonName y no aparece competición, no heredar competición
        # de una rama superior que puede incluir varias ligas.
        if season is not None:ctx.pop('competition',None)
    # leagueId is stable; careerHistory.tournamentId identifies an edition.
    if season is not None:ctx.pop('tournament_id',None)
    if node.get('leagueId') is not None:
        ctx['tournament_id']=str(node['leagueId'])
        ctx['competition']=str(first(node,'leagueName','competitionName','tournamentName') or '')
    has_metrics=any(first(node,k) is not None for k in ('appearances','matches','gamesPlayed','apps','goals','assists','rating','averageRating','avgRating'))
    if has_metrics and ctx.get('season') and ctx.get('team_name'):
        yield ctx,node
    for k,v in node.items():
        if isinstance(v,(dict,list)):
            child=dict(ctx)
            if k in ('national team','nationalTeam','national'):
                child['is_national_team']=True
            elif k in ('senior','youth'):
                child['is_national_team']=False
            yield from _walk_career(v,child)


def extract_career(payload,fallback_id=''):
    ident=profile_identity(payload,fallback_id)
    career=find_block(payload,'careerHistory')
    if career is None:return []
    rows={}
    for context,d in _walk_career(career):
        team=context['team_name'].strip()
        tid=str(context.get('team_id',''))
        season=context['season'].strip()
        competition=str(context.get('competition','')).strip()
        start,end=season_span(season)
        # Nunca sustituir un equipo por similitud textual; conservar id.
        rec={
            'fotmob_player_id':ident['fotmob_player_id'],
            'player_name':ident['name'],
            'fotmob_team_id':tid,
            'team_name':team,
            'season':season,
            'competition':competition,
            'fotmob_tournament_id':context.get('tournament_id',''),
            'is_national_team':bool(context.get('is_national_team')),
            'start_year':start,
            'end_year':end,
            'appearances':asnum(first(d,'appearances','matches','gamesPlayed','apps')),
            'goals':asnum(first(d,'goals')),
            'assists':asnum(first(d,'assists')),
            'rating':asnum(first(d,'rating','averageRating','avgRating')),
            'source':'FotMob · archivo local',
            'review_status':'pending',
        }
        rec['external_record_id']='fotmob-career:'+':'.join((ident['fotmob_player_id'],tid or slug(team),slug(season),slug(competition),context.get('tournament_id','')))
        key=rec['external_record_id']
        if key in rows:
            old=rows[key]
            fields=('appearances','goals','assists','rating')
            conflicting=any(old[k] is not None and rec[k] is not None and old[k]!=rec[k] for k in fields)
            if conflicting:
                old['conflict_note']='Variantes de la misma etapa con métricas diferentes; revisar fichero fuente.'
            # Mantener el registro con más campos presentes; nunca sumar duplicados.
            if sum(rec[k] is not None for k in fields)>sum(old[k] is not None for k in fields):
                if conflicting:rec['conflict_note']=old['conflict_note']
                rows[key]=rec
        else:rows[key]=rec
    return sorted(rows.values(),key=lambda r:(r['start_year'] or -1,r['season'],r['team_name'],r['competition']),reverse=True)


def _stat_items(payload):
    """Extraer solo métricas explícitas; nunca tratar cualquier nombre/valor como stat."""
    seen=set()
    def walk(node,in_stat_list=False):
        if isinstance(node,list):
            for v in node:yield from walk(v,in_stat_list)
            return
        if not isinstance(node,dict):return
        explicit=('title' in node or 'statValue' in node or in_stat_list or 'localizedTitleId' in node)
        title=first(node,'title','name','label','localizedTitleId')
        raw=first(node,'statValue','value')
        if explicit and title is not None and raw is not None and asnum(raw) is not None:
            name=str(title).strip()
            if len(name)<=100 and not name.isdigit():
                rate=asnum(first(node,'per90'))
                pct=asnum(first(node,'percentileRank','percentile'))
                sig=(slug(name),asnum(raw),rate,pct)
                if sig not in seen:
                    seen.add(sig)
                    yield {'name':name,'value':asnum(raw),'per90':rate,'percentile':pct,
                           'percentile_per90':asnum(node.get('percentileRankPer90')),
                           'stat_format':str(node.get('statFormat') or ''),
                           'localized_title_id':str(node.get('localizedTitleId') or '')}
        for k,v in node.items():
            if isinstance(v,(dict,list)):
                yield from walk(v,in_stat_list or k in ('stats','items','statItems'))
    yield from walk(payload)


def extract_stat_details(payload, *, player_id, season, competition, team_id='', team_name='', tournament_id='', profile_season_id=''):
    if not player_id or not season or not competition:
        raise ValueError('Indica ID FotMob, temporada y competición para evitar confundir registros.')
    from .stats_catalog import key as stat_key
    stats={}
    conflicts=[]
    for item in _stat_items(payload):
        key=stat_key(item['name'])
        if key in stats:
            old=stats[key]
            if old['value']!=item['value']:
                conflicts.append(item['name'])
            elif old['per90'] is None and item['per90'] is not None:
                stats[key]=item
        else:stats[key]=item
    from .advanced_metrics import enrich_ground_duels
    enhanced_metrics, ground_note = enrich_ground_duels(list(stats.values()))
    explicit_keys={stat_key(m['name']) for m in stats.values()}
    for metric in enhanced_metrics:
        if stat_key(metric['name']) not in explicit_keys:
            metric['derivation']='Duelos terrestres derivados de 4 entradas FotMob con denominadores enteros únicos; no es un valor directo del proveedor.'
    ground_ok = any(m.get('name') == 'Ground duels won %' for m in enhanced_metrics)
    # MF_LEGACY_ADVANCED_METRICS_V1
    return {
        'external_record_id':'fotmob-stats:' +':'.join((str(player_id),str(team_id or slug(team_name) or ('competition-'+str(tournament_id) if tournament_id else 'team-unknown')),slug(season),slug(competition))),
        'fotmob_tournament_id':str(tournament_id or ''),'profile_season_id':str(profile_season_id or ''),
        'fotmob_player_id':str(player_id),'fotmob_team_id':str(team_id or ''),'team_name':str(team_name or ''),
        'season':str(season),'competition':str(competition),
        'metrics':enhanced_metrics,
        'advanced_metrics_sources':({'Ground duels won %':'FotMob derived (4 inputs, unique denominators)'} if ground_ok else {}),
        'ground_duels_reconstruction_note':ground_note,
        'conflicts':sorted(set(conflicts)),
        'source':'FotMob · archivo JSON local', 'review_status':'pending',
    }


def load_profile_bundle(path):
    payload=read_json(path)
    ident=profile_identity(payload)
    career=extract_career(payload)
    seasons=find_block(payload,'statSeasons')
    options=[]
    if isinstance(seasons,list):
        for a,season in enumerate(seasons):
            if not isinstance(season,dict):continue
            season_name=str(first(season,'seasonName','season') or '')
            for b,tour in enumerate(season.get('tournaments') or []):
                if not isinstance(tour,dict):continue
                options.append({'season':season_name,'competition':str(first(tour,'name','tournamentName') or ''),
                                'season_id':str(tour.get('entryId') or f'{a}-{b}'),'advanced':bool(tour.get('hasDeepStats')),
                                'is_first': a==0,
                                'tournament_id':str(first(tour,'tournamentId') or '')})
    return {'player':ident,'career':career,'season_options':options,'source_file':str(path)}


def export_profile_bundle(bundle, outpath):
    dst=Path(outpath);dst.parent.mkdir(parents=True,exist_ok=True)
    obj={'schema':PROFILE_SCHEMA,'generated_utc':datetime.now(timezone.utc).isoformat(),
         'validated_for_direct_import':False,
         'license_note':'Revisar derechos de reutilización; no importar automáticamente a Base44.',
         'note':'Historial por temporada deportiva. No representa fechas contractuales ni préstamos confirmados.',
         **bundle}
    dst.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
    return dst


def export_stats_record(record,outpath):
    dst=Path(outpath);dst.parent.mkdir(parents=True,exist_ok=True)
    obj={'schema':DETAIL_SCHEMA,'generated_utc':datetime.now(timezone.utc).isoformat(),
         'validated_for_direct_import':False,
         'license_note':'Revisar derechos de reutilización; no importar automáticamente a Base44.',
         'record':record}
    dst.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
    return dst

# Solo métricas que suman sin mezclar porcentajes/ratings. Si no está aquí,
# se conserva POR COMPETICIÓN; jamás se agrega una tasa como acumulativo.
ADDITIVE_STATS={
    'matches','appearances','started','minutes','minutes-played',
    'goals','assists','shots','shots-on-target','xg','xg-excl-penalty',
    'xgot','xa','chances-created','big-chances-created',
    'accurate-passes','passes','successful-crosses','accurate-long-balls',
    'touches','touches-in-opposition-box','dribbles','tackles',
    'interceptions','clearances','recoveries','duels-won','aerials-won',
    'yellow-cards','red-cards','clean-sheets','fouls-won','fouls-committed',
    'penalty-goals','saves','blocked-shots',
}


def aggregate_stats_seasons(records):
    """Totales de temporada solo para métricas inequívocamente aditivas.

    Nunca agregar porcentajes, notas ni percentiles. Retener detalle original.
    Duplicados (mismo jugador/club/temporada/competición) se sustituyen, no suman.
    """
    unique={}
    for rec in records:
        rid=rec['external_record_id']
        if rid in unique and unique[rid]!=rec:
            raise ValueError(f'Estadísticas contradictorias para la misma competición: {rid}')
        unique[rid]=rec
    groups=defaultdict(list)
    for rec in unique.values():
        groups[(rec['fotmob_player_id'],rec['season'])].append(rec)
    out=[]
    for (pid,season),items in sorted(groups.items()):
        collected=defaultdict(list)
        titles={}
        from .stats_catalog import metric_id, ADD_IDS, CAT_ORDER
        for r in items:
            seen_metrics=set()
            for metric in r['metrics']:
                mid=metric_id(metric['name'])
                slugged=slug(metric['name'])
                if mid in ADD_IDS and mid not in seen_metrics:
                    seen_metrics.add(mid)
                    collected[mid].append(metric['value'])
                    titles[mid]=metric['name']
                elif mid is None and slugged in ADDITIVE_STATS and '%' not in metric['name'] and slugged not in seen_metrics:
                    seen_metrics.add(slugged)
                    collected[slugged].append(metric['value'])
                    titles[slugged]=metric['name']
        totals=[{'name':titles[k],'value':round(sum(v),4),'competitions_with_metric':len(v)}
                for k,v in sorted(collected.items())]
        out.append({'fotmob_player_id':pid,'season':season,
                    'competitions_included':sorted({r['competition'] for r in items}),
                    'total_type':'subtotal_de_competiciones_aportadas_no_verificado_completo',
                    'totals':totals,'excluded_non_additive':'Porcentajes, ratings, percentiles y métricas desconocidas no agregados.'})
    return out


def export_stats_bundle(records,outpath):
    dst=Path(outpath);dst.parent.mkdir(parents=True,exist_ok=True)
    obj={'schema':'mf_legacy_fotmob_player_stats_batch_review_v1',
         'generated_utc':datetime.now(timezone.utc).isoformat(),
         'validated_for_direct_import':False,
         'license_note':'Comprobar autorización para reutilización/publicación antes de subir a Base44.',
         'records':records,'season_subtotals':aggregate_stats_seasons(records)}
    dst.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
    return dst


def export_stats_csv(records,outpath):
    """Exportación larga: una fila por estadística, sin pérdida de categorías."""
    import csv
    from .stats_catalog import metric_id, CAT_ORDER
    dst=Path(outpath);dst.parent.mkdir(parents=True,exist_ok=True)
    cols=['external_record_id','fotmob_player_id','fotmob_team_id','team_name','season',
          'competition','statistic_id','statistic','value','per90','percentile','source','review_status']
    def safe(value):
        if value is None:return ''
        if isinstance(value,str) and value.lstrip().startswith(('=','+','-','@')):
            return "'"+value
        return value
    with dst.open('w',encoding='utf-8-sig',newline='') as handle:
        writer=csv.DictWriter(handle,fieldnames=cols,delimiter=';')
        writer.writeheader()
        for record in records:
            for item in record['metrics']:
                mid=metric_id(item['name'])
                writer.writerow({k:safe(v) for k,v in {
                    'external_record_id':record['external_record_id'],
                    'fotmob_player_id':record['fotmob_player_id'],
                    'fotmob_team_id':record.get('fotmob_team_id',''),
                    'team_name':record.get('team_name',''),
                    'season':record['season'],'competition':record['competition'],
                    'statistic_id':mid or '',
                    'statistic':CAT_ORDER[mid][1] if mid else item['name'],
                    'value':item['value'],'per90':item.get('per90'),
                    'percentile':item.get('percentile'),
                    'source':record.get('source',''),'review_status':record.get('review_status',''),
                }.items()})
    return dst
