"""Asignación conservadora de equipos para estadísticas FotMob.

No supone un club por temporada si pudo haber varios; las atribuciones
manuales solo utilizan IDs que constan en la trayectoria FotMob del jugador.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path
from .fotmob_client import player_cache_path
from .history_sync import normalized_season, _national_competition
from .profile import load_profile_bundle, slug

FILENAME='base44_clubes_confirmados.json'


def resolve_stats_team(detail, bundle, payload, assignments):
    """Tournament-specific evidence, preserving club/nation and multi-team scope.

    Shots alone cannot split statistics aggregated over two clubs. If the
    career contains two teams for this tournament, keep the record pending.
    """
    season=normalized_season(detail.get('season'))
    tournament=str(detail.get('fotmob_tournament_id') or '')
    career=bundle.get('career') or []
    national=_national_competition({'competition':detail.get('competition'),
                                    'tournament_id':tournament})
    eligible=[r for r in career if bool(r.get('is_national_team'))==national
              and r.get('fotmob_team_id') and r.get('team_name')]
    exact=[r for r in eligible if normalized_season(r.get('season'))==season
           and tournament and str(r.get('fotmob_tournament_id') or '')==tournament]
    teams={str(r['fotmob_team_id']):r['team_name'] for r in exact}
    assigned=assignments.get(season_key(detail)) or {}
    assigned_id=str(assigned.get('fotmob_team_id') or '')
    valid_assignment=(assigned.get('season')==season
                      and assigned.get('competition')==detail.get('competition')
                      and str(assigned.get('fotmob_tournament_id') or '')==tournament)
    if valid_assignment and teams and assigned_id not in teams:
        return '', '', 'manual_assignment_career_conflict', sorted(set(teams)|{assigned_id})
    if len(teams)>1:
        return '', '', 'multiple_teams_in_tournament', list(teams)
    pid=str(bundle.get('player',{}).get('fotmob_player_id') or '')
    shots=payload.get('shotmap') or []
    shot_ids={str(s['teamId']) for s in shots if isinstance(s,dict)
              and str(s.get('playerId'))==pid and s.get('teamId') is not None}
    if len(shot_ids)>1:
        return '', '', 'multiple_teams_in_payload', sorted(shot_ids)
    if valid_assignment and shot_ids and shot_ids!={assigned_id}:
        return '', '', 'manual_assignment_payload_conflict',sorted(shot_ids|{assigned_id})
    if teams:
        tid=next(iter(teams))
        if shot_ids and shot_ids!={tid}:
            return '', '', 'career_payload_team_conflict', sorted(shot_ids|{tid})
        return tid,teams[tid],'career_tournament_id',list(teams)
    # A shot must belong to a known team of the correct scope in the profile.
    known={str(r['fotmob_team_id']):r['team_name'] for r in eligible}
    seasonal={str(r['fotmob_team_id']):r['team_name'] for r in eligible
              if normalized_season(r.get('season'))==season}
    if shot_ids:
        tid=next(iter(shot_ids))
        if not national and len(seasonal)>1:
            return '', '', 'multiple_clubs_without_tournament_scope', sorted(seasonal)
        if tid in known and (national or tid in seasonal):
            return tid,known[tid],'player_shot_team_id',sorted(seasonal)
        return '', '', 'payload_team_not_in_career_scope', sorted(shot_ids)
    assigned=assignments.get(season_key(detail)) or {}
    tid=str(assigned.get('fotmob_team_id') or '')
    if (tid in seasonal and assigned.get('season')==season
            and assigned.get('competition')==detail.get('competition')
            and str(assigned.get('fotmob_tournament_id') or '')==tournament):
        return tid,seasonal[tid],'usuario_confirmado',sorted(seasonal)
    # No national-team guessing from a club; no multi-club fallback.
    if not national and len(seasonal)==1:
        tid=next(iter(seasonal))
        return tid,seasonal[tid],'unico_club_en_trayectoria_temporada',list(seasonal)
    return '', '', 'team_unresolved',sorted(seasonal)


def season_key(detail):
    # No usar solo temporada/competición: dos Bundesligas comparten etiqueta.
    sid=str(detail.get('profile_season_id') or '')
    if not sid:
        raise ValueError('El registro carece del ID de competición del perfil FotMob')
    return f"{detail['fotmob_player_id']}:{sid}"


def load_assignments(root):
    path=Path(root)/'datos'/FILENAME
    if not path.is_file():return {}
    obj=json.loads(path.read_text(encoding='utf-8-sig'))
    if obj.get('schema')!='mf_legacy_team_assignments_v1' or not isinstance(obj.get('assignments'),dict):
        raise ValueError('Asignaciones de equipo no reconocidas; revisa '+str(path))
    return obj['assignments']


def save_assignments(root, assignments):
    path=Path(root)/'datos'/FILENAME
    path.parent.mkdir(parents=True,exist_ok=True)
    doc={'schema':'mf_legacy_team_assignments_v1',
         'note':'Asignaciones confirmadas expresamente por el usuario para cada ID de competición FotMob.',
         'assignments':assignments}
    tmp=path.with_suffix('.json.tmp')
    try:
        with tmp.open('w',encoding='utf-8') as f:
            json.dump(doc,f,ensure_ascii=False,indent=2)
            f.flush();os.fsync(f.fileno())
        os.replace(tmp,path)
    finally:
        if tmp.exists():tmp.unlink()
    return path


def career_candidates(bundle, season):
    """Devuelve solo IDs reales del careerHistory (incluye juveniles anuales)."""
    years={normalized_season(season)}
    if '/' in season:
        # Para selecciones juveniles, FotMob suele guardar '2019' donde
        # statSeasons dice '2019/2020'. No se asigna automáticamente.
        years.add(season.split('/')[0])
    seen={}
    for row in bundle.get('career') or []:
        if normalized_season(row.get('season')) not in years:continue
        tid=str(row.get('fotmob_team_id') or '')
        name=str(row.get('team_name') or '').strip()
        if tid and name:seen[tid]=name
    return [{'fotmob_team_id':k,'team_name':v} for k,v in sorted(seen.items(),key=lambda kv:kv[1])]


def load_bundle_if_available(root,pid):
    path=player_cache_path(root,pid)
    if not path.is_file():return None
    bundle=load_profile_bundle(path)
    if bundle['player']['fotmob_player_id'] not in ('',str(pid)):
        raise ValueError('Perfil de otro futbolista en '+str(path))
    return bundle


def multiple_clubs_in_international_cup(detail, bundle, basics):
    """Impide atribuir a un club un total potencialmente multinstitucional."""
    if not bundle:return False
    tournament=str(detail.get('fotmob_tournament_id') or '')
    if tournament not in {'42','73','10613'}:return False
    season=normalized_season(detail.get('season'))
    known_nations={str(r.get('fotmob_team_id')) for r in basics
                   if r.get('fotmob_team_id') and _national_competition({
                       'competition':r.get('league',''),
                       'tournament_id':r.get('fotmob_tournament_id','')})}
    clubs={str(r.get('fotmob_team_id')) for r in bundle.get('career',[])
           if normalized_season(r.get('season'))==season
           and r.get('fotmob_team_id')
           and str(r.get('fotmob_team_id')) not in known_nations
           and not re.search(r'\bu(?:17|18|19|20|21|23)\b',str(r.get('team_name') or ''),re.I)}
    return len(clubs)>1


def resolve_career_team(detail,bundle,basics,assignments):
    """Devuelve (id,nombre,fuente,candidatos), sin inferencias inseguras.

    Primero una confirmación manual guardada con ID de perfil; luego evidencia
    exacta en el historial. Para ligas nacionales, conserva asociaciones
    anteriores del mismo jugador al mismo ID de torneo y a clubes actuales en
    careerHistory. Nunca asigna Champions/Europa a un solo club cuando hay dos.
    """
    if not bundle:return '', '', '', []
    season=normalized_season(detail.get('season'))
    option={'season':season,'competition':detail.get('competition',''),
            'tournament_id':detail.get('fotmob_tournament_id') or ''}
    direct=career_candidates(bundle,season)
    key=season_key(detail)
    assigned=assignments.get(key)
    if assigned and not multiple_clubs_in_international_cup(detail,bundle,basics):
        tid=str(assigned.get('fotmob_team_id') or '')
        selected=next((v for v in direct if v['fotmob_team_id']==tid),None)
        if selected:
            # Stale IDs/season names are rejected and cannot promote a different team.
            if assigned.get('season')==season and assigned.get('competition')==detail.get('competition'):
                return tid,selected['team_name'],'usuario_confirmado',direct
    national=_national_competition(option)
    name=str(detail.get('competition') or '').lower()
    age=re.search(r'\bu(?:17|18|19|20|21|23)\b',name)
    if national and age:
        matches=[t for t in direct if re.search(r'\b'+re.escape(age.group())+r'\b',t['team_name'],re.I)]
        if len(matches)==1:
            v=matches[0];return v['fotmob_team_id'],v['team_name'],'perfil_categoria_seleccion',direct
    # Solo identificar selecciones absolutas si ya constan como tales en otros
    # registros internacionales con identificador fiable.
    national_ids={str(r.get('fotmob_team_id')) for r in basics
                  if r.get('fotmob_team_id') and _national_competition({
                      'competition':r.get('league',''), 'tournament_id':r.get('fotmob_tournament_id','')})
                  and not re.search(r'\bu(?:17|18|19|20|21|23)\b',str(r.get('team_name') or ''),re.I)}
    national_ids.update(str(r.get('fotmob_team_id')) for r in bundle.get('career',[])
                        if r.get('is_national_team') and r.get('fotmob_team_id'))
    if national and not age:
        eligible=[v for v in direct if v['fotmob_team_id'] in national_ids]
        if len(eligible)==1 and len({v['fotmob_team_id'] for v in eligible})==1:
            v=eligible[0];return v['fotmob_team_id'],v['team_name'],'perfil_seleccion_identificada',direct
        return '', '', '', direct
    if national:return '', '', '', direct

    # Nombres con categoría juvenil del propio país no representan clubes.
    youth_ids={v['fotmob_team_id'] for v in direct
               if re.search(r'\bu(?:17|18|19|20|21|23)\b',v['team_name'],re.I)}
    national_ids.update(str(r.get('fotmob_team_id')) for r in bundle.get('career',[])
                        if r.get('is_national_team') and r.get('fotmob_team_id'))
    clubs=[v for v in direct if v['fotmob_team_id'] not in youth_ids
           and v['fotmob_team_id'] not in national_ids]
    # Un único club senior en ESA temporada y competición de clubes.
    # Exigir temporada exacta: no usar la aparición de la selección anual.
    exact_ids={str(r.get('fotmob_team_id')) for r in bundle['career']
               if normalized_season(r.get('season'))==season and r.get('fotmob_team_id')}
    clubs=[v for v in clubs if v['fotmob_team_id'] in exact_ids]
    if len(clubs)==1:
        v=clubs[0];return v['fotmob_team_id'],v['team_name'],'unico_club_en_trayectoria_temporada',direct

    # Misma liga *nacional* exacta en otra temporada con ID de equipo conocido.
    # Solo si ese equipo figura en el careerHistory de la temporada solicitada.
    tid=str(detail.get('fotmob_tournament_id') or '')
    if tid and tid not in {'42','73','74','78','77','10613'} and len(clubs)>1:
        # Confirmaciones anteriores del usuario para la misma liga FotMob:
        # solo si también figura en la trayectoria de la temporada actual.
        manual={str(v.get('fotmob_team_id') or '') for k,v in assignments.items()
                if k.startswith(str(detail.get('fotmob_player_id'))+':')
                and str(v.get('fotmob_tournament_id') or '')==tid
                and str(v.get('fotmob_team_id') or '') in {c['fotmob_team_id'] for c in clubs}}
        if len(manual)==1:
            team=next(v for v in clubs if v['fotmob_team_id'] in manual)
            return team['fotmob_team_id'],team['team_name'],'misma_liga_confirmada_previamente',direct
        # Recuperar IDs del torneo mediante el perfil de otras temporadas:
        # en rankings históricos algunas filas no tienen tournament_id.
        from_profile={}
        for o in bundle.get('season_options',[]):
            a=(normalized_season(o.get('season')),slug(o.get('competition')))
            from_profile.setdefault(a,set()).add(str(o.get('tournament_id') or ''))
        allowed={v['fotmob_team_id'] for v in clubs}
        matches=set()
        for r in basics:
            team_id=str(r.get('fotmob_team_id') or '')
            if team_id not in allowed:continue
            rid=str(r.get('fotmob_tournament_id') or '')
            if rid==tid:
                matches.add(team_id)
            elif not rid and from_profile.get((normalized_season(r.get('season')),slug(r.get('league'))))=={tid}:
                matches.add(team_id)
        if len(matches)==1:
            team=next(v for v in clubs if v['fotmob_team_id'] in matches)
            return team['fotmob_team_id'],team['team_name'],'mismo_torneo_fotmob_y_club_trayectoria',direct
    return '', '', '', direct
