"""Consultas individuales *solicitadas explícitamente por el usuario*.

No ejecuta rastreo masivo ni intenta superar restricciones de acceso.
Las interfaces de FotMob son internas/no garantizadas: pueden dejar de funcionar.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from .profile import profile_identity

API_ROOT='https://www.fotmob.com/api/data/'
DEFAULT_TIMEOUT=20


def _id(value):
    v=str(value)
    if not re.fullmatch(r'\d{1,15}',v):
        raise ValueError('El ID de FotMob debe ser numérico.')
    return v


def _fetch(resource, params, opener=urlopen):
    if resource not in ('playerData','playerStats'):
        raise ValueError('Recurso no admitido.')
    url=API_ROOT+resource+'?'+urlencode(params)
    req=Request(url,headers={'Accept':'application/json','User-Agent':'MF-Legacy-Stats-Studio/1.0'})
    with opener(req,timeout=DEFAULT_TIMEOUT) as response:
        raw=response.read(7_000_001)
    if len(raw)>7_000_000:
        raise ValueError('La respuesta excede el límite seguro de tamaño.')
    data=json.loads(raw.decode('utf-8-sig'))
    if not isinstance(data,dict):
        raise ValueError('FotMob devolvió un formato que no se reconoce.')
    return data


def fetch_profile(player_id,opener=urlopen):
    pid=_id(player_id)
    result=_fetch('playerData',{'id':pid},opener)
    remote=profile_identity(result)['fotmob_player_id']
    if remote!=pid:
        raise ValueError(f'El servidor devolvió otro jugador (ID {remote}).')
    return result


def fetch_stats(player_id, season_id, is_first=False,opener=urlopen):
    pid=_id(player_id)
    if not re.fullmatch(r'\d{1,5}-\d{1,5}',str(season_id)):
        raise ValueError('ID de temporada y competición no válido.')
    return _fetch('playerStats',{'playerId':pid,'seasonId':season_id,'isFirstSeason':str(bool(is_first)).lower()},opener)


def player_cache_path(root, pid):
    return Path(root)/'datos'/'perfiles_fotmob'/f'{_id(pid)}.json'


def stat_cache_path(root,pid,season_id):
    if not re.fullmatch(r'\d{1,5}-\d{1,5}',str(season_id)):
        raise ValueError('ID de temporada inválido.')
    return Path(root)/'datos'/'estadisticas_fotmob'/(_id(pid)+'_'+season_id+'.json')


def save_json(path, data):
    path=Path(path)
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix('.tmp')
    try:
        temp.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
        os.replace(temp,path)
    finally:
        if temp.exists():temp.unlink()
    return path
