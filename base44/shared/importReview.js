const str=x=>String(x??"").trim();
const rows=x=>Array.isArray(x)?x:x?.items||x?.data||x?.entities||[];
const norm=x=>str(x).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const metricId=x=>{
  const key=norm(x)+(str(x).includes("%")?" pct":"");
  return ["total clearances","clearances","despejes"].includes(key)?"clearances":key;
};
const empty=x=>x===undefined||x===null||x==="";
const slug=x=>norm(x).replace(/ /g,"-");
export function requiresNationalScope(competition,tournament=""){
  const name=norm(competition).replace(/ /g,"");
  if(name.includes("clubworldcup"))return false;
  return ["50","77","114","301","288","9806","9807","9808","10195","10607"].includes(str(tournament))||
    /^(?:uefau\d{2}championship|euro(?:u\d{2})?(?:qualification)?$)/.test(name)||
    /worldcup|nationsleague|copaamerica|africacupofnations|asiancup|goldcup|summerolympics|internationalfriendly/.test(name);
}
export function reviewedCurrentTeamLink(player,team,item){
  const club=x=>norm(x).replace(/^(?:fc |cf )|(?: fc| cf)$/g,"").trim();
  if(item.is_national_team!==false||!team?.id||player?.team_id!==team.id)return {};
  if(!club(item.team_name)||club(item.team_name)!==club(team.name))return {};
  if(!empty(team.fotmob_id)&&str(team.fotmob_id)!==str(item.fotmob_team_id))return {};
  return {team_id:team.id};
}
const competitionKey=x=>({"super lig":"super lig","super league turkey":"super lig","ligue 1 uber eats":"ligue 1","english premier league":"premier league"}[norm(x)]||norm(x));
async function allRows(entity,query) {
  const out=[];
  for(let skip=0;skip<10000;skip+=500){
    const page=rows(await retryRead(()=>entity.filter(query,"id",500,skip)));
    out.push(...page);
    if(page.length<500)return out;
  }
  throw Error("Demasiados registros para resolver la identidad con seguridad.");
}
async function retryRead(read){
  for(let attempt=0;attempt<4;attempt++){
    try{return await read();}catch(e){
      const status=e.status||e.response?.status,message=String(e.message||e);
      if(attempt===3||!(status===429||status>=500||/rate limit|retry after/i.test(message)))throw e;
      const seconds=Number(message.match(/retry after\s+(\d+)/i)?.[1]);
      await new Promise(resolve=>setTimeout(resolve,Math.max(seconds||0,2**attempt)*1000+100));
    }
  }
}
export async function retryMutation(write){
  for(let attempt=0;attempt<4;attempt++){
    try{return await write();}catch(e){
      const message=String(e.message||e),status=e.status||e.response?.status;
      // Only a rejected 429 is safe to retry; transport/5xx writes can have
      // committed and must be reconciled from persisted identity instead.
      if(attempt===3||!(status===429||/rate limit exceeded/i.test(message)))throw e;
      const seconds=Number(message.match(/retry after\s+(\d+)/i)?.[1]);
      await new Promise(resolve=>setTimeout(resolve,Math.max(seconds||0,2**attempt)*1000+100));
    }
  }
}
export function withEntityRetries(entities){
  const cache=new Map();
  return new Proxy(entities,{get(target,name){
    if(cache.has(name))return cache.get(name);
    const entity=target[name];
    if(!entity||typeof entity!=="object")return entity;
    const wrapped=new Proxy(entity,{get(resource,key){
      const method=resource[key];
      if(typeof method!=="function")return method;
      const retry=["filter","list","get","count","aggregate"].includes(key)?retryRead:
        ["create","bulkCreate","update","updateMany"].includes(key)?retryMutation:null;
      return (...args)=>retry?retry(()=>method.apply(resource,args)):method.apply(resource,args);
    }});
    cache.set(name,wrapped);return wrapped;
  }});
}
export function metricPlan(item,player,existing,teamLink={}) {
  if(item.is_national_team===false&&requiresNationalScope(item.competition,item.fotmob_tournament_id))throw Error("El torneo es de selecciones; no se atribuye a un club.");
  if(!/^\d{1,15}$/.test(str(item.fotmob_team_id))||!str(item.competition)||!str(item.metric_name))throw Error("Falta identidad de competición/equipo/métrica.");
  const signedMetric=["goals prevented","goles evitados"].includes(norm(item.metric_name));
  if(typeof item.value!=="number"||!Number.isFinite(item.value)||(item.value<0&&!signedMetric))throw Error("Valor no válido.");
  if(!["total","per90","percentage","per_match"].includes(item.metric_unit))throw Error("Unidad no admitida.");
  if(item.metric_unit==="percentage"&&item.value>100)throw Error("Porcentaje fuera de rango.");
  existing=existing.filter(r=>str(r.season)===str(item.season)&&(!r.player_id||str(r.player_id)===str(item.player_id)));
  const sameComp=r=>competitionKey(r.competition)===competitionKey(item.competition)
    ||(str(r.fotmob_tournament_id)&&str(r.fotmob_tournament_id)===str(item.fotmob_tournament_id));
  const matches=existing.filter(r=>sameComp(r)&&(str(r.fotmob_team_id)===str(item.fotmob_team_id)
    ||norm(r.team_name)===norm(item.team_name)||(!str(r.fotmob_team_id)&&!str(r.team_name))));
  if(matches.length>1)throw Error("Hay varias filas para la misma temporada, club y competición.");
  const target=matches[0];
  if(!target&&existing.some(r=>sameComp(r)&&!str(r.fotmob_team_id)))throw Error("Existe una fila de esta competición con equipo sin ID FotMob; concilia la identidad antes de crear otra.");
  if(target&&str(target.fotmob_team_id)&&str(target.fotmob_team_id)!==str(item.fotmob_team_id))throw Error("El nombre coincide pero el ID de equipo es distinto.");
  if(target&&str(target.fotmob_player_id)&&str(target.fotmob_player_id)!==str(item.fotmob_player_id))throw Error("La fila pertenece a otro ID FotMob.");
  if(target&&str(target.fotmob_tournament_id)&&str(item.fotmob_tournament_id)&&str(target.fotmob_tournament_id)!==str(item.fotmob_tournament_id))throw Error("Competiciones homónimas con distinto ID oficial.");
  if(target&&typeof target.is_national_team==="boolean"&&typeof item.is_national_team==="boolean"&&target.is_national_team!==item.is_national_team)throw Error("Club y selección incompatibles.");
  const metrics=Array.isArray(target?.metrics)?target.metrics.map(m=>({...m})):[];
  // Understat and FotMob may legitimately publish different minutes for the
  // same league season. Preserve both denominators without rewriting the
  // established season total, and do not let this block the other indicators.
  if(target&&item.source==="fotmob"&&norm(item.metric_name)==="minutes"&&
      item.metric_unit==="total"&&!empty(target.minutes)&&Number(target.minutes)!==item.value&&
      metrics.some(m=>metricId(m.name)==="understat minutes")){
    const match=metrics.filter(m=>metricId(m.name)==="fotmob minutes");
    if(match.length>1||match.length===1&&!empty(match[0].value)&&Number(match[0].value)!==item.value)
      throw Error("Minutos FotMob contradictorios; requiere revisión.");
    if(match.length===1&&!empty(match[0].value))return {operation:"unchanged",target_id:target.id,record:{}};
    const fotmobMinutes={name:"FotMob minutes",value:item.value,unit:"total",source:"fotmob",
      source_url:item.evidence_url,verification_status:item.verification_status||"unverified",
      ...(item.provenance?{provenance:item.provenance}:{})};
    if(match.length===1)Object.assign(match[0],fotmobMinutes);else metrics.push(fotmobMinutes);
    return {operation:"update",target_id:target.id,record:{metrics}};
  }
  const understatKey=x=>norm(x).replace(/(?: season)? 90$/,"").replace(/ /g,"");
  const family=understatKey(item.metric_name);
  if(["xgchain","xgbuildup"].includes(family)&&target){
    const manual=(target.manual_metric_history||[]).some(h=>[family,"understatminutes"].includes(understatKey(h.metric_name)))
      ||metrics.some(m=>understatKey(m.name)===family&&norm(m.source).includes("manual"));
    if(manual){
      const prior=metrics.find(m=>metricId(m.name)===metricId(item.metric_name));
      const slot=item.metric_unit==="per90"?"per90":item.metric_unit==="per_match"?"per_match":"value";
      if(!empty(prior?.[slot])&&Number(prior[slot])===item.value)return {operation:"unchanged",target_id:target.id,record:{}};
      throw Error("Existe una corrección manual de esta métrica o de sus minutos; se conserva para conciliación individual.");
    }
  }
  const indices=metrics.map((m,i)=>metricId(m.name)===metricId(item.metric_name)?i:-1).filter(i=>i>=0);
  if(indices.length>1)throw Error("La métrica tiene variantes existentes; requiere conciliación.");
  const idx=indices[0]??-1;
  const key=item.metric_unit==="per90"?"per90":item.metric_unit==="per_match"?"per_match":"value";
  const old=idx<0?{}:metrics[idx];
  if(key==="value"&&old.unit&&old.unit!==item.metric_unit)throw Error("La unidad existente es distinta.");
  if(!empty(old[key])&&Number(old[key])!==item.value)throw Error("Existe un valor distinto. No se sobrescribe.");
  const field=key==="value"?({"matches":"appearances","appearances":"appearances","minutes":"minutes","minutes played":"minutes","rating":"rating","fotmob rating":"rating"}[norm(item.metric_name)]):null;
  if(field&&target&&!empty(target[field])&&Number(target[field])!==item.value)throw Error("Existe un resumen distinto. No se sobrescribe.");
  const pctKey=key==="per90"?"percentile_per90":"percentile";
  const addPercentile=typeof item.percentile==="number"&&empty(old[pctKey]);
  const metricChanged=empty(old[key])||addPercentile;
  if(metricChanged) {
    const metric={...old,name:old.name||item.metric_name,[key]:item.value,
      source:old.source||item.source,verification_status:old.verification_status||"verified",
      ...(item.derivation&&!old.derivation?{derivation:item.derivation}:{}),
      ...(item.provenance&&!old.provenance?{provenance:item.provenance}:{}),
      ...(item.provenance?.provider_minutes&&!old.provider_minutes?{provider_minutes:item.provenance.provider_minutes}:{}),
      ...(item.evidence_url&&!old.source_url?{source_url:item.evidence_url}:{}),
      ...(typeof item.percentile==="number"&&empty(old[key==="per90"?"percentile_per90":"percentile"])?{[key==="per90"?"percentile_per90":"percentile"]:item.percentile}:{}),
      ...(key==="value"?{unit:item.metric_unit}:{})};
    if(idx<0)metrics.push(metric);else metrics[idx]=metric;
  }
  const summary=field&&empty(target?.[field])?{[field]:item.value}:{};
  if(target) {
    const patch={...summary,...Object.fromEntries(Object.entries(teamLink).filter(([key])=>empty(target[key]))),...(metricChanged?{metrics}:{})};
    return {operation:Object.keys(patch).length?"update":"unchanged",target_id:target.id,record:patch};
  }
  if(!str(item.fotmob_tournament_id)||typeof item.is_national_team!=="boolean")throw Error("La primera importación requiere ID de competición y ámbito club/selección.");
  return {operation:"create",record:{
    external_record_id:"fotmob:"+[item.fotmob_player_id,item.fotmob_team_id,slug(item.season),slug(item.competition)].join(":"),
    player_id:item.player_id,fotmob_player_id:item.fotmob_player_id,player_name:player.name,
    season:item.season,competition:item.competition,fotmob_team_id:item.fotmob_team_id,team_name:item.team_name,
    ...(item.fotmob_tournament_id?{fotmob_tournament_id:item.fotmob_tournament_id}:{}),
    ...(typeof item.is_national_team==="boolean"?{is_national_team:item.is_national_team}:{}),
    ...teamLink,...summary,metrics,source:item.source,verification_status:"manually_reviewed",review_status:"approved",import_batch:item.job_id
  }};
}
export function seasonPlan(items,player,existing,teamLink={}) {
  if(!items.length)throw Error("No hay métricas pendientes para esta temporada.");
  const identity=x=>[x.player_id,x.fotmob_player_id,x.season,x.competition,x.fotmob_team_id,x.fotmob_tournament_id,x.is_national_team].join("|");
  if(items.some(x=>identity(x)!==identity(items[0])))throw Error("El lote mezcla equipos o competiciones.");
  let virtual=existing.map(r=>({...r})),created=false,targetId,patch={};
  for(const item of items) {
    const plan=metricPlan(item,player,virtual,teamLink);
    if(plan.operation==="create") {
      created=true;targetId="__preview_new__";patch={...plan.record};
      virtual.push({...plan.record,id:targetId});
    } else {
      targetId=plan.target_id;
      Object.assign(patch,plan.record);
      virtual=virtual.map(r=>r.id===targetId?{...r,...plan.record}:r);
    }
  }
  return {operation:created?"create":Object.keys(patch).length?"update":"unchanged",
    ...(created?{}:{target_id:targetId}),record:patch,candidates:items.length};
}
export function valuationPlan(item,old=null){
  const overall=item.kind==="overall",field=overall?"fifa_fc_overall":"transfermarkt_value_eur";
  if(!["overall","market_value"].includes(item.kind)||!Number.isInteger(item.value)||item.value<0||(overall&&(item.value<1||item.value>99)))throw Error("Valoración inválida.");
  const match=/^(20\d{2})\/(20\d{2})$/.exec(item.season);
  if(!match||+match[2]!==+match[1]+1)throw Error("Temporada histórica inválida.");
  if(old&&!empty(old[field])&&Number(old[field])!==item.value)throw Error("Ya existe una valoración diferente; no se sobrescribe.");
  const p=item.provenance||{},desired={};
  if(overall){
    const game=+match[2]%100,expected=(game<=23?"fifa ":"fc ")+game;
    if(norm(item.fifa_edition).replace("ea sports ","")!==expected)throw Error("La edición FIFA/FC no corresponde a la temporada.");
    if(old?.fifa_edition&&norm(old.fifa_edition).replace("ea sports ","")!==expected)throw Error("La edición existente es distinta.");
    if(p.rating_kind&&p.rating_kind!=="launch_base"||p.mode&&p.mode!=="career")throw Error("Se requiere una valoración base de lanzamiento de Career Mode.");
    if(p.revision_date&&(!p.release_date||p.revision_date>p.release_date))throw Error("La revisión es posterior al lanzamiento; no se importa como carta base.");
    if(old?.fifa_fc_position&&item.fifa_fc_position&&old.fifa_fc_position!==item.fifa_fc_position)throw Error("Existe una posición FIFA diferente; se conserva para revisión.");
    Object.assign(desired,{fifa_fc_overall:item.value,fifa_edition:item.fifa_edition,fifa_source_url:item.evidence_url,
      ...(item.fifa_fc_position?{fifa_fc_position:item.fifa_fc_position}:{}),
      ...(p.player_id?{fifa_source_player_id:p.player_id}:{}),...(p.revision?{fifa_source_revision:p.revision}:{}),
      ...(p.revision_date?{fifa_source_date:p.revision_date}:{}),...(p.rating_kind?{fifa_rating_kind:p.rating_kind}:{})});
  }else{
    if(!withinSeason(item.season,str(item.as_of_date)))throw Error("La fecha no corresponde a la temporada.");
    if(p.value_kind&&p.value_kind!=="market_value")throw Error("La fuente no es un valor de mercado histórico.");
    if(old&&!empty(old[field])&&old.market_value_as_of&&old.market_value_as_of!==item.as_of_date)throw Error("La fecha existente es distinta; no se sobrescribe.");
    Object.assign(desired,{transfermarkt_value_eur:item.value,market_value_as_of:item.as_of_date,transfermarkt_source_url:item.evidence_url,
      ...(p.player_id?{market_source_player_id:p.player_id}:{}),...(p.selection_rule?{market_selection_rule:p.selection_rule}:{}),
      ...(typeof p.provisional==="boolean"?{market_value_status:p.provisional?"provisional":"definitivo"}:{})});
  }
  const patch=Object.fromEntries(Object.entries(desired).filter(([key,value])=>!empty(value)&&empty(old?.[key])));
  const source=overall?"fifa":"market";
  if(item.provenance&&!old?.source_provenance?.[source])patch.source_provenance={...(old?.source_provenance||{}),[source]:item.provenance};
  return {operation:old?(Object.keys(patch).length?"update":"unchanged"):"create",...(old?{target_id:old.id}:{}),record:patch};
}
function withinSeason(season,date) {
  if(!/^\d{4}(-\d{2}-\d{2})$/.test(date))return false;
  const match=/^(\d{4})(?:\/(\d{4}))?$/.exec(season);
  if(!match)return false;
  const start=match[2]?match[1]+"-07-01":match[1]+"-01-01";
  const end=match[2]?match[2]+"-06-30":match[1]+"-12-31";
  const parsed=new Date(date+"T00:00:00Z");
  return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===date&&date>=start&&date<=end;
}

export {allRows, competitionKey, metricId};

const scopeKey=c=>[c.season,str(c.fotmob_tournament_id)||competitionKey(c.competition),c.fotmob_team_id,c.is_national_team].join("|");
const slot=c=>c.metric_unit==="per90"?"per90":c.metric_unit==="per_match"?"per_match":"value";
// Plan independently against a virtual destination, then persist once. A bad
// value must not discard the other seventy fields in the same competition.
export function compatibleSeasonPlan(items,player,existing,teamLink={}){
  if(!items.length)throw Error("No hay métricas para conciliar.");
  const identity=c=>[c.player_id,c.fotmob_player_id,scopeKey(c)].join("|");
  if(items.some(c=>identity(c)!==identity(items[0])))throw Error("El lote mezcla identidades o ámbitos.");
  const conflicting=new Set(),values=new Map();
  for(const c of items){
    const key=[c.source,metricId(c.metric_name),c.metric_unit].join("|");
    if(values.has(key)&&values.get(key)!==c.value)conflicting.add(key);
    values.set(key,c.value);
  }
  let virtual=existing.map(r=>({...r})),created=false,targetId,patch={};
  const accepted=[],conflicts=[];let added=0,unchanged=0;
  for(const c of items){
    try{
      if(c.verification_status==="conflict"||conflicting.has([c.source,metricId(c.metric_name),c.metric_unit].join("|")))throw Error("La fuente aporta valores contradictorios para esta métrica.");
      const plan=metricPlan(c,player,virtual,teamLink);
      const before=virtual.find(r=>r.id===plan.target_id);
      const old=before?.metrics?.find(m=>metricId(m.name)===metricId(c.metric_name));
      if(empty(old?.[slot(c)]))added++;else unchanged++;
      if(plan.operation==="create"){
        created=true;targetId="__preview_new__";patch={...plan.record};virtual.push({...plan.record,id:targetId});
      }else{
        targetId=plan.target_id;Object.assign(patch,plan.record);
        virtual=virtual.map(r=>r.id===targetId?{...r,...plan.record}:r);
      }
      accepted.push(c.id);
    }catch(error){conflicts.push({candidate_id:c.id,metric:c.metric_name,unit:c.metric_unit,source:c.source,reason:String(error.message||error)});}
  }
  return {operation:created?"create":Object.keys(patch).length?"update":"unchanged",
    ...(created?{}:{target_id:targetId}),record:patch,candidates:accepted.length,candidate_ids:accepted,
    conflicts,added_values:added,unchanged_values:unchanged};
}

// Completion describes extraction AND persistence; receiving an empty block
// does not prove that the player's history has been recovered.
export function completionPatch(job,pending){
  const sources=Object.values(job.source_results||{});
  const incomplete=sources.some(s=>["partial","error","pending"].includes(s.status)||s.coverage?.complete===false);
  const complete=pending===0&&!incomplete;
  return {status:complete?"completed":"review",progress:100,
    phase:pending?pending+" candidatos pendientes de conciliación":incomplete?"Extracción incompleta; quedan consultas o conflictos de fuente":"Persistencia verificada; sin candidatos pendientes"};
}

const APPROVED=new Set(["verified","confirmed","manual","manual_confirmada","confirmada","automatic_exact_name_unique","automatic_existing_stats_unique"]);
export async function verifiedIdentity(db,job){
  const [player,links,back]=await Promise.all([db.Player.get(job.player_id),allRows(db.PlayerFotmobLink,{player_id:job.player_id}),allRows(db.PlayerFotmobLink,{fotmob_player_id:job.fotmob_player_id})]);
  if(!player||!links.length||links.some(l=>str(l.fotmob_player_id)!==str(job.fotmob_player_id))||!links.some(l=>APPROVED.has(str(l.verification).toLowerCase()))||back.some(l=>str(l.player_id)!==str(job.player_id)))throw Error("La vinculación FotMob no es única y verificada.");
  return player;
}
const includesPatch=(record,patch)=>Array.isArray(patch)?Array.isArray(record)&&record.length===patch.length&&patch.every((v,i)=>includesPatch(record[i],v))
  :patch&&typeof patch==="object"?!!record&&Object.entries(patch).every(([k,v])=>includesPatch(record[k],v)):record===patch;

export async function persistImportPlan(entity,plan,before){
  let id=plan.target_id;
  if(plan.operation==="create"){
    // Never replay a create after a lost response: the next invocation reads
    // destinations again, and reconciles the existing row before writing.
    const saved=await retryMutation(()=>entity.create(plan.record));id=saved?.id;
  }else if(plan.operation==="update"){
    if(!before?.updated_date)throw Error("Destino sin versión; no se escribe sin control de concurrencia.");
    await retryMutation(()=>entity.updateMany({id,updated_date:before.updated_date},{$set:plan.record}));
  }
  if(!id)throw Error("Persistencia no confirmada; volver a leer antes de repetir.");
  const saved=await entity.get(id);
  if(!saved||!includesPatch(saved,plan.record))throw Error("La escritura no coincide con la propuesta; candidatos conservados pendientes.");
  return saved;
}

const trustedArchive=c=>c.verification_status==="verified"&&str(c.evidence_url).startsWith("https://")&&str(c.provenance?.archive_url).startsWith("https://")&&!!str(c.provenance?.sha256);
const trustedFotmob=c=>c.source==="fotmob"&&str(c.evidence_url).match(new RegExp("^https://www\\.fotmob\\.com/players/"+str(c.fotmob_player_id)+"(?:$|[/?#])"))&&!!str(c.source_record_id);
// One engine for automatic imports, manual recovery and the global migration.
// dryRun performs all identity/metric checks and writes no sporting data.
export async function applyVerifiedHistoricals(db,job,{dryRun=false,maxScopes=Infinity}={}){
  const result={applied:0,pending:0,created_stats:0,created_valuations:0,added_values:0,unchanged_values:0,conflicts:[],errors:[],scopes:[],has_more:false,dry_run:dryRun};
  if(!["review","completed"].includes(job.status))return result;
  const records=await allRows(db.ImportCandidate,{job_id:job.id,review_status:"pending"});
  if(!records.length)return result;
  const player=await verifiedIdentity(db,job);
  const [stats,teams,valuations]=await Promise.all([allRows(db.PlayerSeasonStats,{player_id:job.player_id}),allRows(db.Team,{}),allRows(db.PlayerHistoricalValuation,{player_id:job.player_id})]);
  const pending=records.filter(c=>c.review_status==="pending");
  const mark=async ids=>{
    if(dryRun)return;
    for(let i=0;i<ids.length;i+=150)await retryMutation(()=>db.ImportCandidate.updateMany({id:{$in:ids.slice(i,i+150)},job_id:job.id,review_status:"pending"},{$set:{review_status:"applied",review_note:"Persistencia comprobada; campos existentes y conflictos conservados"}}));
  };
  const byScope=new Map();
  for(const c of pending){
    if(str(c.player_id)!==str(job.player_id)||str(c.fotmob_player_id)!==str(job.fotmob_player_id)||c.verification_status==="conflict")continue;
    const archive=trustedArchive(c);
    const eligible=c.kind==="metric"?(trustedFotmob(c)||c.source==="understat"&&archive&&c.provenance?.scope==="league_team_season"&&c.provenance?.player_id)
      :archive&&c.provenance?.player_id&&c.provenance?.identity_rule;
    if(!eligible)continue;
    const key=c.kind==="metric"?"stats|"+scopeKey(c):"valuation|"+c.season;
    if(!byScope.has(key))byScope.set(key,[]);byScope.get(key).push(c);
  }
  let processed=0;
  for(const [key,group] of byScope){
    if(processed>=maxScopes){result.has_more=true;break;}
    const first=group[0];
    try{
      if(first.kind==="metric"){
        if(!str(first.fotmob_tournament_id)||typeof first.is_national_team!=="boolean")throw Error("Ámbito o competición sin identificar.");
        // Youth teams and international identity require an explicit internal
        // national-team link; never attribute them to the current club.
        let teamLink={};
        if(first.is_national_team){
          const nations=await allRows(db.NationalTeam,{fotmob_id:Number(first.fotmob_team_id)});
          if(nations.length>1)throw Error("ID de selección duplicado en el catálogo.");
          if(nations.length===1)teamLink={national_team_id:nations[0].id,national_country_id:nations[0].country_id};
          // An absent internal national-team page cannot erase official data.
          // Preserve the exact external team ID and national scope, without
          // guessing a country ID or linking the player's current club.
        }else{
          if(str(first.fotmob_tournament_id)==="288"||/euro u21|european under.?21/.test(norm(first.competition)))throw Error("Identidad juvenil pendiente de conciliación.");
          const byId=teams.filter(t=>str(t.fotmob_id)===str(first.fotmob_team_id));
          if(byId.length>1)throw Error("ID de club duplicado.");
          const club=v=>norm(v).replace(/^(fc|cf) /,"").replace(/ (fc|cf)$/,"");
          const named=teams.filter(t=>club(t.name)===club(first.team_name)&&(!t.fotmob_id||str(t.fotmob_id)===str(first.fotmob_team_id)));
          if(byId.length===1){if(!named.some(t=>t.id===byId[0].id))throw Error("El ID del club está atribuido a otro nombre; conciliar alias.");teamLink={team_id:byId[0].id};}
          else if(named.length===1)teamLink={team_id:named[0].id};
          else if(named.length>1)throw Error("Club histórico ambiguo.");
        }
        const plan=compatibleSeasonPlan(group,player,stats.filter(r=>r.season===first.season),teamLink);
        result.conflicts.push(...plan.conflicts);
        result.scopes.push({key,season:first.season,competition:first.competition,team:first.team_name,operation:plan.operation,candidates:plan.candidates,added:plan.added_values,unchanged:plan.unchanged_values,conflicts:plan.conflicts.length});
        if(!plan.candidates)continue;
        processed++;
        const before=stats.find(r=>r.id===plan.target_id);
        if(!dryRun){
          const saved=await persistImportPlan(db.PlayerSeasonStats,plan,before);
          const at=stats.findIndex(r=>r.id===saved.id);if(at<0)stats.push(saved);else stats[at]=saved;
          await mark(plan.candidate_ids);
        }else{
          const virtual={...(before||{}),...plan.record,id:plan.target_id||"preview:"+key};
          const at=stats.findIndex(r=>r.id===virtual.id);if(at<0)stats.push(virtual);else stats[at]=virtual;
        }
        result.applied+=plan.candidates;result.added_values+=plan.added_values;result.unchanged_values+=plan.unchanged_values;
        if(plan.operation==="create")result.created_stats++;
      }else{
        processed++;
        for(const item of group){
          try{
            if(item.kind==="overall"&&(item.source!=="fifa"||item.provenance?.rating_kind!=="launch_base")||item.kind==="market_value"&&(item.source!=="market"||item.provenance?.value_kind!=="market_value"))continue;
            const matches=valuations.filter(r=>r.season===item.season);
            if(matches.length>1)throw Error("Valoraciones duplicadas.");
            const plan=valuationPlan(item,matches[0]||null);
            if(plan.operation==="create")plan.record={player_id:job.player_id,fotmob_player_id:job.fotmob_player_id,season:item.season,verification_status:"verified",...plan.record};
            let saved;
            if(!dryRun){saved=await persistImportPlan(db.PlayerHistoricalValuation,plan,matches[0]);await mark([item.id]);}
            else saved={...(matches[0]||{}),...plan.record,id:matches[0]?.id||"preview:"+item.season};
            const at=valuations.findIndex(r=>r.id===saved.id);if(at<0)valuations.push(saved);else valuations[at]=saved;
            result.applied++;if(plan.operation==="create")result.created_valuations++;
          }catch(e){result.conflicts.push({candidate_id:item.id,source:item.source,season:item.season,reason:e.message});}
        }
      }
    }catch(e){result.errors.push({scope:key,reason:String(e.message||e)});}
  }
  result.pending=Math.max(0,pending.length-result.applied);
  return result;
}
