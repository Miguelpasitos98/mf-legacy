"""Free published catalogues, not crawlers of protected football websites.

Only fixed public archive URLs are fetched. Files are bounded, checksummed and
reused; errors are never promoted to absence. No proxies, logins or challenges.
"""
from __future__ import annotations
from pathlib import Path
from datetime import date,datetime,timezone,timedelta
from contextlib import closing
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError
import csv,gzip,hashlib,io,json,os,re,sqlite3,tempfile,unicodedata,zipfile

UNDERSTAT_COMMIT='768b7ca0b977a5e6b4b429c7b0cf750e8269f2fc'
UNDERSTAT_ARCHIVE=f'https://raw.githubusercontent.com/vibedatascience/understat_players_aggregated/{UNDERSTAT_COMMIT}/understat_players_aggregated_2014_td.csv'
UNDERSTAT_ARCHIVES_BY_SHA={
 'b78fad5f01844a0fdab0d89474dafba9b86c586d2f0ce88f0ce2c9af70d2bc64':f'https://raw.githubusercontent.com/vibedatascience/understat_players_aggregated/{UNDERSTAT_COMMIT}/understat_players_aggregated_2014_2024.csv',
 'aa6b98bf396beef014c893d40e6352af0b03dc562aa0f82d56ff066acba09f0e':UNDERSTAT_ARCHIVE,
}
FIFA_ARCHIVE='https://www.kaggle.com/api/v1/datasets/download/stefanoleone992/ea-sports-fc-24-complete-player-dataset/male_players.csv?datasetVersionNumber=1'
TM_BASE='https://pub-e682421888d945d684bcae8890b0ec20.r2.dev/data/'
TM_SNAPSHOT='2026-07-06'
REGISTRY={
 'understat-2014-2025':(UNDERSTAT_ARCHIVE,'understat-history-2025.csv',10_000_000),
 'fifa-launch-15-24':(FIFA_ARCHIVE,'fifa-launch.zip',40_000_000),
 'tm-players-20260706':(TM_BASE+'players.csv.gz','tm-players.csv.gz',10_000_000),
 'tm-values-20260706':(TM_BASE+'player_valuations.csv.gz','tm-valuations.csv.gz',15_000_000),
}
# Actual release dates. Unknown editions stay pending rather than borrow data.
RELEASES={15:'2014-09-26',16:'2015-09-25',17:'2016-09-29',18:'2017-09-29',19:'2018-09-28',20:'2019-09-27',21:'2020-10-09',22:'2021-10-01',23:'2022-09-30',24:'2023-09-29'}
POSITIONS={'GK','CB','RB','LB','RWB','LWB','CDM','CM','CAM','RM','LM','RW','LW','CF','ST'}
def norm(value):
 value=unicodedata.normalize('NFKD',str(value or ''))
 return ' '.join(re.sub('[^a-z0-9]+',' ',''.join(c for c in value if not unicodedata.combining(c)).casefold()).split())
def now():return datetime.now(timezone.utc).isoformat()
def edition_for(season):
 m=re.fullmatch(r'(20\d{2})/(20\d{2})',str(season))
 if not m or int(m[2])!=int(m[1])+1:raise ValueError('Temporada sin edición inequívoca')
 year=int(m[2])%100
 return year,('FIFA ' if year<=23 else 'FC ')+str(year)
def number(v):
 if v is None or isinstance(v,bool) or str(v).strip()=='':return None
 try:
  f=float(v)
  return f if f==f and abs(f)!=float('inf') else None
 except (TypeError,ValueError):return None
def provider_birth(raw):
 v=raw.get('birthDate') or {}
 value=v.get('utcTime') if isinstance(v,dict) else v
 if not value:value=((raw.get('meta') or {}).get('personJSONLD') or {}).get('birthDate')
 try:return date.fromisoformat(str(value)[:10]).isoformat()
 except ValueError:return ''
def season_close_value(rows,season,today=None):
 """Latest dated valuation INSIDE Jul-Jun, never carry current value backwards."""
 year,_=edition_for(season);start=int(season[:4]);today=today or date.today()
 first=date(start,7,1);last=min(date(start+1,6,30),today)
 eligible=[]
 for row in rows:
  try:stamp=date.fromisoformat(str(row.get('date',''))[:10])
  except ValueError:continue
  value=number(row.get('market_value_in_eur'))
  if first<=stamp<=last and value is not None and value>=0 and value.is_integer():eligible.append((stamp,int(value),row))
 if not eligible:return None
 stamp=max(x[0] for x in eligible);latest=[x for x in eligible if x[0]==stamp]
 if len({x[1] for x in latest})!=1:raise ValueError('Valoraciones contradictorias en la misma fecha')
 return {'value':latest[0][1],'as_of_date':stamp.isoformat(),'provisional':today<date(start+1,6,30),'rule':'latest_dated_value_within_Jul01_Jun30'}

class Catalogs:
 def __init__(self,root,*,network=False,force=False,opener=urlopen):
  self.root=Path(root);self.base=self.root/'FUENTES/AUTOMATION';self.base.mkdir(parents=True,exist_ok=True)
  self.network=network;self.force=force;self.opener=opener;self.requests=0
  self.db=self.base/'catalogues.sqlite3'
  with self.connect() as c:c.executescript('''
   CREATE TABLE IF NOT EXISTS resources(key TEXT PRIMARY KEY,url TEXT,path TEXT,sha256 TEXT,checked_at TEXT,status TEXT,error TEXT,retry_at TEXT);
   CREATE TABLE IF NOT EXISTS identities(pid TEXT,source TEXT,provider_id TEXT,evidence TEXT,PRIMARY KEY(pid,source),UNIQUE(source,provider_id));
   CREATE TABLE IF NOT EXISTS results(pid TEXT,source TEXT,season TEXT,edition TEXT,snapshot TEXT,state TEXT,details TEXT,updated_at TEXT,PRIMARY KEY(pid,source,season,edition,snapshot));
   CREATE TABLE IF NOT EXISTS player_archives(pid TEXT,source TEXT,snapshot TEXT,payload TEXT,PRIMARY KEY(pid,source,snapshot));
   CREATE TABLE IF NOT EXISTS submissions(job_id TEXT PRIMARY KEY,pid TEXT,state TEXT);
  ''')
  with self.connect() as c:
   if 'checked_at' not in {r[1] for r in c.execute('PRAGMA table_info(submissions)')}:
    c.execute("ALTER TABLE submissions ADD COLUMN checked_at TEXT NOT NULL DEFAULT ''")
 def connect(self):
  c=sqlite3.connect(self.db,timeout=30);c.row_factory=sqlite3.Row;return closing_connection(c)
 def state(self,pid,source,season,state,details=None,edition='',snapshot=''):
  with self.connect() as c:c.execute('INSERT OR REPLACE INTO results VALUES(?,?,?,?,?,?,?,?)',(str(pid),source,season,edition,snapshot,state,json.dumps(details or {},ensure_ascii=False),now()))
 def saved(self,pid,source,season):
  with self.connect() as c:return bool(c.execute("SELECT 1 FROM results WHERE pid=? AND source=? AND season=? AND state='verificado_guardado' LIMIT 1",(str(pid),source,season)).fetchone())
 def track_job(self,job_id,pid):
  with self.connect() as c:c.execute("INSERT OR IGNORE INTO submissions(job_id,pid,state) VALUES(?,?,'pending')",(job_id,str(pid)))
 def pending_jobs(self):
  with self.connect() as c:return [dict(r) for r in c.execute("SELECT * FROM submissions WHERE state='pending' ORDER BY checked_at,job_id LIMIT 3")]
 def apply_review_status(self,job_id,pid,groups,finished=False):
  with self.connect() as c:
   c.execute('UPDATE submissions SET checked_at=? WHERE job_id=?',(now(),job_id))
   for group in groups:
    if group.get('pending')==0 and group.get('applied',0)>0 and group.get('rejected',0)==0:
     c.execute("UPDATE results SET state='verificado_guardado',updated_at=? WHERE pid=? AND source=? AND season=?",(now(),str(pid),group['source'],group['season']))
   if finished:c.execute("UPDATE submissions SET state='finished' WHERE job_id=?",(job_id,))
 def identity(self,pid,source,provider_id,evidence):
  with self.connect() as c:
   old=c.execute('SELECT * FROM identities WHERE pid=? AND source=?',(str(pid),source)).fetchone()
   if old and old['provider_id']!=str(provider_id):raise ValueError('Identidad distinta de la correspondencia ya guardada')
   other=c.execute('SELECT pid FROM identities WHERE source=? AND provider_id=?',(source,str(provider_id))).fetchone()
   if other and other['pid']!=str(pid):raise ValueError('El ID de fuente ya corresponde a otro jugador')
   c.execute('INSERT OR IGNORE INTO identities VALUES(?,?,?,?)',(str(pid),source,str(provider_id),json.dumps(evidence,ensure_ascii=False)))
 def asset(self,key):
  url,name,limit=REGISTRY[key];path=self.base/name
  with self.connect() as c:old=c.execute('SELECT * FROM resources WHERE key=?',(key,)).fetchone()
  if old and old['status']=='found' and path.is_file():
   if hashlib.sha256(path.read_bytes()).hexdigest()!=old['sha256']:raise ValueError('Caché modificada; no se utiliza el catálogo')
   return path,old['sha256']
  if not self.network:raise RuntimeError('Catálogo ausente en caché; modo sin red')
  if old and old['retry_at'] and not self.force and now()<old['retry_at']:raise RuntimeError('Error temporal anterior; reintento explícito o tras seis horas')
  self.requests+=1
  temp=None
  try:
   digest=hashlib.sha256();size=0
   fd,temp=tempfile.mkstemp(dir=self.base,suffix='.download')
   with os.fdopen(fd,'wb') as f,self.opener(Request(url,headers={'User-Agent':'MF-Legacy-Studio/3.0','Accept':'application/octet-stream,text/csv'}),timeout=30) as response:
    while True:
     chunk=response.read(65536)
     if not chunk:break
     size+=len(chunk)
     if size>limit:raise ValueError('Catálogo mayor que el límite permitido')
     digest.update(chunk);f.write(chunk)
   if not size:raise ValueError('Catálogo vacío')
   os.replace(temp,path);sha=digest.hexdigest()
   with self.connect() as c:c.execute('INSERT OR REPLACE INTO resources VALUES(?,?,?,?,?,?,?,?)',(key,url,str(path),sha,now(),'found','',None))
   return path,sha
  except Exception as e:
   with self.connect() as c:c.execute('INSERT OR REPLACE INTO resources VALUES(?,?,?,?,?,?,?,?)',(key,url,str(path),'',now(),'temporary_error',str(e)[:250],(datetime.now(timezone.utc)+timedelta(hours=6)).isoformat()))
   raise
  finally:
   if temp and Path(temp).exists():Path(temp).unlink()
 def player_payload(self,pid,source,snapshot,loader):
  with self.connect() as c:row=c.execute('SELECT payload FROM player_archives WHERE pid=? AND source=? AND snapshot=?',(str(pid),source,snapshot)).fetchone()
  if row:return json.loads(row[0])
  data=loader()
  with self.connect() as c:c.execute('INSERT INTO player_archives VALUES(?,?,?,?)',(str(pid),source,snapshot,json.dumps(data,ensure_ascii=False)))
  return data

 def understat(self,pid,bundle):
  from app import understat_dataset as dataset
  from app.understat_bridge import contextual_team_match
  path,sha=self.asset('understat-2014-2025')
  dataset.import_dataset(self.root,path)
  people=dataset.search(self.root,bundle['player']['name'])
  verified=[]
  for person in people:
   rows=dataset.records(self.root,person['understat_player_id']);matches=[]
   for row in rows:
    if norm(row['name'])!=norm(bundle['player']['name']):continue
    raw=row['canonical'];tid=dataset.LEAGUES.get(row['league'])
    career=[x for x in bundle['career'] if x.get('season')==row['season'] and str(x.get('fotmob_tournament_id'))==tid and contextual_team_match(row['team'],x.get('team_name'),tid,x.get('fotmob_team_id'))]
    if len({str(x.get('fotmob_team_id')) for x in career})==1 and career:matches.append({'season':row['season'],'team':row['team'],'fotmob_team_id':career[0]['fotmob_team_id']})
   if len({(m['season'],m['fotmob_team_id']) for m in matches})>=2:verified.append((person,matches))
  if len(verified)!=1:raise ValueError('Understat: nombre y trayectoria no resuelven una identidad única con dos temporadas')
  person,matches=verified[0];uid=person['understat_player_id']
  evidence={'rule':'unique_exact_name_and_two_club_seasons','matches':matches,'archive':UNDERSTAT_ARCHIVE,'sha256':sha}
  self.identity(pid,'understat',uid,evidence);dataset.confirm_link(self.root,pid,uid,evidence)
  return {'provider_id':uid,'archive_url':UNDERSTAT_ARCHIVE,'sha256':sha,'rows':len(dataset.records(self.root,uid))}

 def fifa(self,pid,bundle,raw_profile,seasons):
  path,sha=self.asset('fifa-launch-15-24');birth=provider_birth(raw_profile)
  if not birth:raise ValueError('No hay fecha FotMob verificable para resolver FIFA')
  def load():
   with zipfile.ZipFile(path) as z:
    member=z.getinfo('male_players.csv')
    if member.file_size>200_000_000 or member.is_dir():raise ValueError('Archivo FIFA descomprimido no admitido')
    with z.open(member) as f:
     return [r for r in csv.DictReader(io.TextIOWrapper(f,encoding='utf-8-sig')) if r.get('dob')==birth]
  rows=self.player_payload(pid,'fifa',sha,load)
  # Exact name, or all FotMob name tokens plus exact DOB and a career club.
  tokens=set(norm(bundle['player']['name']).split());career=bundle['career']
  from app.understat_bridge import same_team
  matched=[r for r in rows if (norm(r.get('long_name'))==norm(bundle['player']['name']) or tokens.issubset(set(norm(r.get('long_name')).split()))) and any(same_team(r.get('club_name'),c.get('team_name')) for c in career)]
  ids={r['player_id'] for r in matched}
  if len(ids)!=1:raise ValueError('FIFA: nombre, nacimiento y trayectoria no resuelven una identidad única')
  uid=next(iter(ids));self.identity(pid,'fifa',uid,{'dob':birth,'rule':'name_dob_career_club','archive':FIFA_ARCHIVE,'sha256':sha})
  out=[]
  for season in seasons:
   if self.saved(pid,'fifa',season):continue
   game,edition=edition_for(season);release=RELEASES.get(game)
   if not release:
    self.state(pid,'fifa',season,'consulta_pendiente',{'reason':'No hay archivo de lanzamiento verificable para esta edición'},edition,sha);continue
   candidates=[r for r in matched if r['player_id']==uid and str(r.get('fifa_version'))==str(game) and re.fullmatch(r'\d{4}-\d{2}-\d{2}',str(r.get('update_as_of') or r.get('fifa_update_date') or '')) and (r.get('update_as_of') or r.get('fifa_update_date'))<=release]
   if not candidates:
    self.state(pid,'fifa',season,'consulta_pendiente',{'reason':'Sin snapshot anterior/al lanzamiento; no se usa una revisión posterior'},edition,sha);continue
   stamp=max(r.get('update_as_of') or r.get('fifa_update_date') for r in candidates)
   versions=[r for r in candidates if (r.get('update_as_of') or r.get('fifa_update_date'))==stamp]
   variants={(r.get('overall'),r.get('player_positions'),r.get('fifa_update')) for r in versions}
   if len(variants)!=1:raise ValueError('Versiones FIFA contradictorias para la fecha base')
   r=versions[0];value=number(r.get('overall'));pos=str(r.get('player_positions','')).split(',')[0].strip()
   if value is None or not value.is_integer() or not 1<=value<=99 or pos not in POSITIONS:raise ValueError('Overall/posición de lanzamiento inválidos')
   url='https://sofifa.com'+r['player_url'] if r['player_url'].startswith('/player/') else r['player_url']
   provenance={'provider':'sofifa_archive','player_id':uid,'archive_url':FIFA_ARCHIVE,'sha256':sha,'revision':str(r.get('fifa_version'))+str(r.get('fifa_update')).zfill(4),'revision_date':stamp,'rating_kind':'launch_base','release_date':release,'mode':'career','identity_rule':'name_dob_career_club'}
   out.append({'source':'fifa','kind':'overall','season':season,'value':int(value),'fifa_edition':edition,'fifa_fc_position':pos,'evidence_url':url,'source_record_id':f'{uid}:{game}:{stamp}:launch','verification_status':'verified','provenance':provenance})
   self.state(pid,'fifa',season,'pendiente_verificacion',provenance,edition,sha)
  return out

 def market(self,pid,bundle,raw_profile,seasons):
  player_file,player_sha=self.asset('tm-players-20260706');value_file,value_sha=self.asset('tm-values-20260706')
  birth=provider_birth(raw_profile);tokens=set(norm(bundle['player']['name']).split())
  def load():
   with gzip.open(player_file,'rt',encoding='utf-8-sig',newline='') as f:
    people=[r for r in csv.DictReader(f) if r.get('date_of_birth','')[:10]==birth and tokens.issubset(set(norm(r.get('name')).split()))]
   if len(people)!=1:raise ValueError('Transfermarkt: nombre y fecha FotMob no resuelven una identidad única')
   person=people[0]
   with gzip.open(value_file,'rt',encoding='utf-8-sig',newline='') as f:values=[r for r in csv.DictReader(f) if r.get('player_id')==person['player_id']]
   return {'player':person,'values':values}
  data=self.player_payload(pid,'market',player_sha+value_sha,load);person=data['player'];uid=person['player_id']
  self.identity(pid,'market',uid,{'dob':birth,'name':person['name'],'archive':TM_BASE,'sha256':player_sha})
  out=[]
  for season in seasons:
   if self.saved(pid,'market',season):continue
   selected=season_close_value(data['values'],season)
   if not selected:
    self.state(pid,'market',season,'consulta_pendiente',{'reason':'No hay valoración fechada dentro de esta temporada en el archivo','archive_cutoff':TM_SNAPSHOT},snapshot=value_sha);continue
   provenance={'provider':'transfermarkt_archive','player_id':uid,'archive_url':TM_BASE+'player_valuations.csv.gz','sha256':value_sha,'archive_cutoff':TM_SNAPSHOT,'selection_rule':selected['rule'],'value_kind':'market_value','provisional':selected['provisional'],'identity_rule':'exact_name_and_dob'}
   url=person['url'].replace('/profil/','/marktwertverlauf/')
   out.append({'source':'market','kind':'market_value','season':season,'value':selected['value'],'as_of_date':selected['as_of_date'],'evidence_url':url,'source_record_id':f'{uid}:{selected["as_of_date"]}:EUR','verification_status':'verified','provenance':provenance})
   self.state(pid,'market',season,'pendiente_verificacion',provenance,snapshot=value_sha)
  return out

 def diagnostics(self,pid,source):
  with self.connect() as c:return [dict(r) for r in c.execute("SELECT season,state,details,edition FROM results WHERE pid=? AND source=? AND season<>'' ORDER BY season DESC",(str(pid),source))]

class closing_connection:
 def __init__(self,c):self.c=c
 def __enter__(self):return self.c
 def __exit__(self,typ,value,tb):
  try:self.c.commit() if typ is None else self.c.rollback()
  finally:self.c.close()
