"""Bounded public Crafted player pages; season facts only, never model blends."""
from __future__ import annotations
import hashlib,json,re,os,tempfile
from datetime import datetime,timezone,timedelta
from urllib.request import Request
try:from .historical_sources import norm,number,provider_birth,now
except ImportError:from historical_sources import norm,number,provider_birth,now

LEAGUES={'ESP-LaLiga':'87','ENG-PremierLeague':'47','FRA-Ligue1':'53','GER-Bundesliga':'54','ITA-SerieA':'55'}

def decode_profile(html):
    match=re.search(r'<script\b[^>]*\bid=["\']__NUXT_DATA__["\'][^>]*>(.*?)</script>',html,re.S)
    if not match:raise ValueError('Perfil sin datos SSR públicos')
    flat=json.loads(match[1])
    if not isinstance(flat,list) or len(flat)>100000:raise ValueError('Formato SSR incompatible')
    memo={};active=set()
    def ref(i,depth=0):
        if depth>80:raise ValueError('SSR demasiado profundo')
        if type(i) is not int:raise ValueError('Referencia SSR inválida')
        if i<0:return None
        if i>=len(flat) or i in active:raise ValueError('Referencia SSR inválida')
        if i in memo:return memo[i]
        active.add(i);v=flat[i]
        if isinstance(v,dict):out={k:ref(x,depth+1) for k,x in v.items()}
        elif isinstance(v,list):
            if v and isinstance(v[0],str):
                if v[0] in ('Reactive','ShallowReactive','Ref','ShallowRef') and len(v)==2:out=ref(v[1],depth+1)
                elif v[0]=='Set':out=[ref(x,depth+1) for x in v[1:]]
                else:out=None
            else:out=[ref(x,depth+1) for x in v]
        else:out=v
        active.remove(i);memo[i]=out;return out
    root=ref(0)
    profiles=[v for v in (root.get('data') or {}).values() if isinstance(v,dict) and isinstance(v.get('season_rows'),list)]
    if len(profiles)!=1:raise ValueError('Perfil público ambiguo')
    return profiles[0]

def profile_asset(catalog,pid,name):
    if not re.fullmatch(r'[0-9]+',str(pid)):raise ValueError('ID inválido')
    slug=norm(name).replace(' ','-')
    if not slug:raise ValueError('Nombre ausente')
    url='https://craftedfc.com/player-ratings/'+slug
    key='crafted-profile-'+str(pid);path=catalog.base/(key+'.html')
    with catalog.connect() as db:old=db.execute('SELECT * FROM resources WHERE key=?',(key,)).fetchone()
    if old and old['status']=='found' and path.is_file():
        raw=path.read_bytes()
        if hashlib.sha256(raw).hexdigest()!=old['sha256']:raise ValueError('Caché Crafted modificada')
        if not catalog.network or now()<(datetime.fromisoformat(old['checked_at'])+timedelta(hours=24)).isoformat():return raw,dict(old)
    if not catalog.network:raise RuntimeError('Perfil Crafted ausente o sin red autorizada')
    if old and old['retry_at'] and now()<old['retry_at'] and not catalog.force:raise RuntimeError('Crafted: reintento tras seis horas')
    try:
        catalog.requests+=1
        with catalog.opener(Request(url,headers={'User-Agent':'MF-Legacy-Studio/3.0 (user-requested reference)','Accept':'text/html'}),timeout=30) as response:raw=response.read(4_000_001)
        if len(raw)>4_000_000:raise ValueError('Perfil demasiado grande')
        decode_profile(raw.decode('utf-8'))
        sha=hashlib.sha256(raw).hexdigest();stamp=now()
        fd,temp=tempfile.mkstemp(dir=catalog.base,suffix='.pending')
        try:
            with os.fdopen(fd,'wb') as f:f.write(raw)
            os.replace(temp,path)
        finally:
            if os.path.exists(temp):os.unlink(temp)
        with catalog.connect() as db:db.execute('INSERT OR REPLACE INTO resources VALUES(?,?,?,?,?,?,?,?)',(key,url,str(path),sha,stamp,'found','',None))
        return raw,{'url':url,'sha256':sha,'checked_at':stamp}
    except Exception as error:
        with catalog.connect() as db:db.execute('INSERT OR REPLACE INTO resources VALUES(?,?,?,?,?,?,?,?)',(key,url,str(path),'',now(),'temporary_error',str(error)[:250],(datetime.now(timezone.utc)+timedelta(hours=6)).isoformat()))
        raise

def season_candidates(profile,pid,bundle,raw,primary,metadata,existing_scopes=None,seasons=None):
    meta=profile.get('metadata') or {}
    if str(profile.get('player_id'))!=str(pid) or str(meta.get('player_id'))!=str(pid):raise ValueError('Crafted corresponde a otro ID FotMob')
    if not provider_birth(raw) or meta.get('date_of_birth')!=provider_birth(raw) or norm(meta.get('player_name'))!=norm(bundle['player']['name']):raise ValueError('Identidad Crafted no conciliada')
    rows=profile['season_rows'];career=bundle['career']
    def scope(r):return (r.get('season'),LEAGUES.get(r.get('comp_code')),str(r.get('team_id')))
    known={}
    for c in primary:
        if c.get('verification_status')=='verified':known.setdefault((c['season'],str(c['fotmob_tournament_id']),str(c['fotmob_team_id'])),{})[(c['metric_name'],c['metric_unit'])]=c['value']
    corroborated=False
    for r in rows:
        k=known.get(scope(r),{})
        if all(number(r.get(field)) is not None and (label,'total') in k and abs(r[field]-k[(label,'total')])<=0.0051 for field,label in [('us_xGChain','xG Chain'),('us_xGBuildup','xG Buildup')]):corroborated=True
    out=[];seen=set()
    for r in rows:
        season,tid,team=scope(r)
        if not tid or not re.fullmatch(r'20\d{2}/20\d{2}',str(season)) or int(season[5:])!=int(season[:4])+1:continue
        if seasons is not None and season not in seasons:continue
        if str(r.get('player_id'))!=str(pid) or r.get('us_matched') is not True:continue
        matches=[c for c in career if c.get('season')==season and str(c.get('fotmob_tournament_id'))==tid and str(c.get('fotmob_team_id'))==team]
        if not matches:continue
        chain=number(r.get('us_xGChain90'));build=number(r.get('us_xGBuildup90'))
        if chain is None or build is None or not 0<=build<=chain:continue
        key=(season,tid,team)
        if key in seen:raise ValueError('Crafted contiene dos filas para el mismo contexto')
        seen.add(key)
        # Complete original archives retain their precision; the 2025 snapshot
        # is partial for 2025/26 and must not displace the newer published season.
        if key in known and int(season[:4])<2025:continue
        competition=next((o['competition'] for o in bundle['season_options'] if o['season']==season and str(o.get('tournament_id'))==tid),None)
        if not competition:continue
        p={'provider':'craftedfc_understat','player_id':str(pid),'archive_url':metadata['url'],'sha256':metadata['sha256'],'retrieved_at':metadata['checked_at'],'scope':'league_team_season','rate_kind':'published_per90','identity_rule':'FotMob ID + name + DOB + career; historical totals corroborated' if corroborated else 'FotMob ID + name + DOB + career; upstream corroboration pending'}
        common={'source':'understat','kind':'metric','season':season,'competition':competition,'fotmob_team_id':team,'team_name':matches[0]['team_name'],'fotmob_tournament_id':tid,'is_national_team':False,'evidence_url':metadata['url'],'verification_status':'verified' if corroborated else 'unverified','provenance':p}
        for label,value in [('xG Chain /90',chain),('xG Buildup /90',build)]:out.append({**common,'metric_name':label,'metric_unit':'per90','value':value,'source_record_id':f'crafted:{pid}:{season}:{tid}:{team}:{label}'})
        exists=existing_scopes is None or any(c.get('season')==season and str(c.get('fotmob_tournament_id'))==tid and str(c.get('fotmob_team_id'))==team for c in existing_scopes)
        if not exists:
            for field,label in [('minutes','Minutes'),('matches_played','Matches')]:
                value=number(r.get(field))
                if value is not None and value>0 and value.is_integer():out.append({**common,'metric_name':label,'metric_unit':'total','value':value,'provenance':{**p,'provider':'craftedfc_match_context','rate_kind':'FotMob_summary'},'source_record_id':f'crafted:{pid}:{season}:{tid}:{team}:{field}'})
    return out
