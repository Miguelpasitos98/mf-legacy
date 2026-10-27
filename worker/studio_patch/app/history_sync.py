"""Sincronización **local** de historiales individuales FotMob.

La caché de rankings nunca se modifica. Un perfil FotMob solo acredita que
una competición aparece en statSeasons; no acredita PJ, MIN ni rating. Si
falta información se conserva None, no cero. Tampoco se infieren clubes para
una temporada con varios destinos posibles.
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
import json
import os
import re

from .profile import load_profile_bundle, read_json, extract_stat_details, slug, asnum
from .fotmob_client import player_cache_path, stat_cache_path

SCHEMA = 'mf_legacy_historial_perfiles_v1'
FILENAME = 'fotmob_historial_individual_complementario.json'


def normalized_season(s):
    v = str(s or '').strip()
    m = re.fullmatch(r'(\d{4})[/-](\d{2}|\d{4})', v)
    if m:
        return f'{m[1]}/{m[1][:2]+m[2] if len(m[2]) == 2 else m[2]}'
    return v


def identity(record):
    return (str(record.get('fotmob_player_id') or ''),
            normalized_season(record.get('season')),
            slug(record.get('league') or record.get('competition')))


def read_overlay(root):
    path = Path(root) / 'datos' / FILENAME
    if not path.exists():
        return []
    doc = json.loads(path.read_text(encoding='utf-8-sig'))
    if not isinstance(doc, dict) or doc.get('schema') != SCHEMA or not isinstance(doc.get('records'), list):
        raise ValueError('Caché complementaria no válida. No se han perdido archivos; revisa ' + str(path))
    return doc['records']


def save_overlay(root, records):
    path = Path(root) / 'datos' / FILENAME
    path.parent.mkdir(parents=True, exist_ok=True)
    seen = set()
    for row in records:
        key = str(row.get('external_record_id') or '')
        if not key or key in seen:
            raise ValueError('El historial complementario contiene IDs repetidos o vacíos.')
        seen.add(key)
    content = {'schema': SCHEMA, 'updated_utc':datetime.now(timezone.utc).isoformat(),
               'note':'Solo datos locales individuales. No sustituye la caché de rankings ni los datos manuales.',
               'records': records}
    dest = path.with_suffix('.tmp')
    try:
        dest.write_text(json.dumps(content, ensure_ascii=False, indent=2),encoding='utf-8')
        os.replace(dest,path)
    finally:
        if dest.exists(): dest.unlink()
    return path


def _career_matches(bundle, option):
    season, comp = normalized_season(option['season']), slug(option['competition'])
    return [r for r in bundle['career'] if normalized_season(r.get('season')) == season and
            slug(r.get('competition')) == comp]


def _resolve_club(bundle, option):
    """Solo identificaciones inequívocas del propio perfil individual."""
    season = normalized_season(option['season'])
    exact = _career_matches(bundle, option)
    if exact:
        variants = {(str(r.get('fotmob_team_id') or ''), str(r.get('team_name') or '')) for r in exact}
        if len(variants) == 1:
            return next(iter(variants)), exact[0]
        return ('', ''), None
    seasonal = [r for r in bundle['career'] if normalized_season(r.get('season')) == season]
    teams = {(str(r.get('fotmob_team_id') or ''), str(r.get('team_name') or ''))
             for r in seasonal if r.get('team_name')}
    if len(teams) == 1:
        return next(iter(teams)), None   # Equipo, no cifras de toda la temporada.
    return ('', ''), None


def _top_stat_summary(payload):
    """Explicit matches/minutes/rating from FotMob playerStats topStatCard.

    Those values belong only to the requested player/season/tournament. Per90
    and percentiles are not totals. Missing statValue must remain None.
    """
    payload = payload.get('payload', payload)
    top = payload.get('topStatCard') if isinstance(payload,dict) else {}
    items = top.get('items',[]) if isinstance(top,dict) else []
    keys={'matches_uppercase':'appearances','minutes_played':'minutes','rating':'rating'}
    found={key:None for key in keys.values()}
    for item in items:
        if not isinstance(item,dict):continue
        field=keys.get(str(item.get('localizedTitleId') or ''))
        if field and item.get('statValue') not in (None,''):
            number=asnum(item['statValue'])
            if number is not None and number >= 0 and (field=='rating' or number.is_integer()):
                found[field] = int(number) if field!='rating' else float(number)
    return found


def _evidenced_team(bundle, payload, option):
    """Identify club or national team only by a player shot's exact FotMob ID.

    A season-long career total cannot assign a club to a specific tournament;
    that mistake previously attributed Norway international games to Man City.
    """
    base=payload.get('payload',payload)
    shotmap=(base.get('shotmap') or []) if isinstance(base,dict) else []
    known={str(r.get('fotmob_team_id')):str(r.get('team_name'))
           for r in bundle.get('career',[]) if r.get('fotmob_team_id') and r.get('team_name')}
    player=bundle.get('player') or {}
    if player.get('primary_team_id') and player.get('primary_team'):
        known[str(player['primary_team_id'])]=str(player['primary_team'])
    ids={str(s.get('teamId')) for s in shotmap if isinstance(s,dict)
         and str(s.get('playerId') or '')==str(player.get('fotmob_player_id'))
         and s.get('teamId') is not None}
    if len(ids)==1:
        candidate=next(iter(ids))
        if candidate in known:return candidate,known[candidate]
    return '', ''


def _national_competition(option):
    tournament=str(option.get('tournament_id') or '')
    name=slug(option.get('competition',''))
    # El Mundial de Clubes no es una competición de selecciones.
    if tournament == '78' or 'club-world-cup' in name:
        return False
    return tournament in {'50','77','114','9806','9807','9808','10195','10607'} or name=='euro' or any(x in name for x in
        ('world-cup-uefa-qualification','uefa-nations-league','euro-qualification',
         'world-cup-u20','uefa-u19-championship','euro-qualifying',
         'world-cup','euro-championship','international-friendly'))


def _detail(root, pid, option, bundle):
    p=stat_cache_path(root,pid,option['season_id'])
    if not p.is_file():
        return [], 'no_descargado', {'appearances':None,'minutes':None,'rating':None}, ('','')
    raw=read_json(p)
    meta=raw.get('_mf_legacy_meta') or {}
    if meta and (str(meta.get('player_id')) != pid or
                 str(meta.get('season_id')) != str(option['season_id']) or
                 normalized_season(meta.get('season')) != normalized_season(option['season']) or
                 slug(meta.get('competition')) != slug(option['competition'])):
        return [], 'identidad_incompatible', {'appearances':None,'minutes':None,'rating':None}, ('','')
    payload=raw.get('payload',raw)
    parsed=extract_stat_details(payload, player_id=pid,
                                season=option['season'],competition=option['competition'])
    summary=_top_stat_summary(payload)
    team=_evidenced_team(bundle,payload,option)
    if parsed['conflicts']:
        return parsed['metrics'], 'metricas_con_conflictos', summary,team
    return parsed['metrics'], 'detalle_disponible' if parsed['metrics'] else 'sin_metricas',summary,team


def sync_player(root, pid, ranking_rows):
    """Reconcile all FotMob season options using exact cached playerStats.

    Never requires a rating.json ranking, never invents zero or club, and never
    promotes a global CraftedFC rating to a historical FotMob match rating.
    """
    root,pid=Path(root),str(pid)
    profile_path=player_cache_path(root,pid)
    if not profile_path.is_file():
        raise FileNotFoundError('Falta el perfil local. Pulsa «Consultar temporadas FotMob» primero.')
    bundle=load_profile_bundle(profile_path)
    if bundle['player']['fotmob_player_id'] not in ('',pid):
        raise ValueError('El perfil pertenece a otro ID FotMob.')
    options=[o for o in bundle['season_options'] if o.get('season') and o.get('competition') and o.get('season_id')]
    if not options:raise ValueError('El perfil no contiene temporadas con competiciones.')
    originals=[r for r in ranking_rows if str(r.get('fotmob_player_id'))==pid]
    grouped={}
    for row in originals:grouped.setdefault(identity(row),[]).append(row)
    repeated=Counter((normalized_season(o['season']),slug(o['competition'])) for o in options)
    report={'fotmob_player_id':pid,'options':len(options),'already_in_rankings':0,
            'new_partial_rows':0,'completed_from_playerstats':0,
            'ranking_metrics_enriched':0,'with_cached_metrics':0,'no_cached_metrics':0,
            'needs_detail_download':[], 'ambiguous':[], 'conflicts':[], 'errors':[]}
    added=[]
    seen=set()
    for option in options:
        season,comp=normalized_season(option['season']),option['competition'].strip()
        simple=(season,slug(comp))
        tournament_id=str(option.get('tournament_id') or '')
        option_key=(season,simple[1],tournament_id or ('season-'+str(option['season_id'])))
        if option_key in seen:continue
        seen.add(option_key)
        candidates=grouped.get((pid,*simple),[])
        matching=[r for r in candidates if tournament_id and
                  str(r.get('fotmob_tournament_id') or '')==tournament_id]
        if not matching and len(candidates)==1 and repeated[simple]==1:
            matching=candidates
        if len(matching)>1:
            report['ambiguous'].append({'season':season,'competition':comp,'reason':'Varios rankings sin identificación única.'})
            continue
        if not matching and candidates:
            ids={str(r.get('fotmob_tournament_id') or '') for r in candidates}
            if not tournament_id or '' in ids or tournament_id in ids:
                report['ambiguous'].append({'season':season,'competition':comp,'tournament_id':tournament_id,
                                            'reason':'Dos competiciones homónimas sin vínculo seguro.'})
                continue
        try:
            metrics,status,summary,shot_team=_detail(root,pid,option,bundle)
        except (ValueError,KeyError,OSError) as exc:
            metrics,status,summary,shot_team=[], 'error_caché', {'appearances':None,'minutes':None,'rating':None}, ('','')
            report['errors'].append({'season':season,'competition':comp,'reason':str(exc)[:180]})
        if status=='identidad_incompatible':
            report['errors'].append({'season':season,'competition':comp,'reason':'Identificadores de caché diferentes.'})
            continue
        if status=='no_descargado':
            report['needs_detail_download'].append({'season':season,'competition':comp,'season_id':option['season_id']})
        if metrics:report['with_cached_metrics']+=1
        else:report['no_cached_metrics']+=1
        if matching:
            original=matching[0]
            report['already_in_rankings']+=1
            if not metrics:continue
            conflicts={}
            for key in ('appearances','minutes','rating'):
                old,new=original.get(key),summary.get(key)
                if old is not None and new is not None and abs(float(old)-float(new))> (0.011 if key=='rating' else 0):
                    conflicts[key]={'ranking':old,'profile':new}
            if conflicts:report['conflicts'].append({'season':season,'competition':comp,'values':conflicts})
            # Enrichment is a separate overlay; the ranking remains authoritative
            # for its own PJ, minutes and rating even when cached stats differ.
            row=dict(original)
            row.update({'profile_season_id':str(option['season_id']),
                        'fotmob_tournament_id':tournament_id or original.get('fotmob_tournament_id',''),
                        'metrics':metrics,'detail_status':status,
                        'verification_status':'perfil_enriquecimiento_ranking',
                        'source':'FotMob · estadísticas detalladas complementarias',
                        'coverage_conflicts':conflicts})
            added.append(row)
            report['ranking_metrics_enriched']+=1
            continue
        # If the user did not play in the tournament, playerStats sometimes has
        # empty cards. Keep it as partial but never synthesize PJ or minutes.
        club_id,club_name=shot_team
        if not club_id and not _national_competition(option):
            (career_id,career_name),career=_resolve_club(bundle,option)
            if career_id and career_name and (career is None or len({str(r.get('fotmob_team_id')) for r in
                bundle['career'] if normalized_season(r.get('season'))==season and r.get('fotmob_team_id')})==1):
                club_id,club_name=career_id,career_name
        # International fixtures cannot inherit the club of the same season.
        # Use only a direct player shot or an independently identified nation.
        unique_ref=tournament_id or 'season-'+str(option['season_id'])
        row={'external_record_id':f'fotmob-profile:{pid}:{slug(season)}:{slug(comp)}:{slug(unique_ref)}',
             'base44_player_id':'','fm26_uid':'',
             'fotmob_player_id':pid, 'player_name':bundle['player'].get('name') or
                (originals[0]['player_name'] if originals else ''),
             'fotmob_team_id':club_id,'team_name':club_name,
             'fotmob_tournament_id':tournament_id,'profile_season_id':str(option['season_id']),
             'league':comp,'season':season,
             'appearances':summary['appearances'],'minutes':summary['minutes'],'team_matches':None,
             'rating':summary['rating'],'market_value':None,'market_date':None,
             'metrics':metrics,'source':'FotMob · perfil individual y playerStats',
             'verification_status':'perfil_individual_verificado' if summary['appearances'] is not None and
                summary['minutes'] is not None else 'perfil_individual_parcial',
             'detail_status':status}
        added.append(row)
        if row['verification_status']=='perfil_individual_parcial':report['new_partial_rows']+=1
        else:report['completed_from_playerstats']+=1
    return added,report


def merged_records(ranking_rows,overlay_rows):
    """One row per verified tournament, with metrics from the profile overlay.

    Existing ranking fields are never overwritten. Same-label competitions are
    distinguished by tournament ID when possible and kept separate otherwise.
    """
    result=[dict(r) for r in ranking_rows]
    bykey={str(r.get('external_record_id') or ''):i for i,r in enumerate(result)}
    ranking_by_identity={}
    for r in ranking_rows:
        ranking_by_identity.setdefault(identity(r),[]).append(r)
    used={x for x in bykey if x}
    for row in overlay_rows:
        key=str(row.get('external_record_id') or '')
        if not key:continue
        if row.get('verification_status')=='perfil_enriquecimiento_ranking':
            i=bykey.get(key)
            if i is not None:
                base=result[i]
                base['metrics']=row.get('metrics') or base.get('metrics') or []
                base['detail_status']=row.get('detail_status')
                base['profile_season_id']=row.get('profile_season_id')
                base['coverage_conflicts']=row.get('coverage_conflicts') or {}
            continue
        if key in used:continue
        matches=ranking_by_identity.get(identity(row),[])
        if matches and (not row.get('fotmob_tournament_id') or any(
                not r.get('fotmob_tournament_id') or
                str(r.get('fotmob_tournament_id'))==str(row.get('fotmob_tournament_id'))
                for r in matches)):
            continue
        result.append(dict(row)); used.add(key)
    return result
