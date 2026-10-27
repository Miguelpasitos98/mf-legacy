import {createClientFromRequest} from "npm:@base44/sdk";
const str=x=>String(x??"").trim();
const rows=x=>Array.isArray(x)?x:x?.items||x?.data||x?.entities||[];
const reply=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
const bad=(error,status=400)=>reply({ok:false,error},status);
const norm=x=>str(x).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const metricId=x=>{
  const key=norm(x)+(str(x).includes("%")?" pct":"");
  return ["total clearances","clearances","despejes"].includes(key)?"clearances":key;
};
const empty=x=>x===undefined||x===null||x==="";
const slug=x=>norm(x).replace(/ /g,"-");
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
  for(let skip=0;skip<10000;skip+=100) {
    const page=rows(await entity.filter(query,"id",100,skip));out.push(...page);
    if(page.length<100)return out;
  }
  throw Error("Demasiados registros para resolver la identidad con seguridad.");
}
export function metricPlan(item,player,existing,teamLink={}) {
  if(!/^\d{1,15}$/.test(str(item.fotmob_team_id))||!str(item.competition)||!str(item.metric_name))throw Error("Falta identidad de competición/equipo/métrica.");
  const signedMetric=["goals prevented","goles evitados"].includes(norm(item.metric_name));
  if(typeof item.value!=="number"||!Number.isFinite(item.value)||(item.value<0&&!signedMetric))throw Error("Valor no válido.");
  if(!["total","per90","percentage","per_match"].includes(item.metric_unit))throw Error("Unidad no admitida.");
  if(item.metric_unit==="percentage"&&item.value>100)throw Error("Porcentaje fuera de rango.");
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
      ...(item.provenance&&item.evidence_url&&!old.source_url?{source_url:item.evidence_url}:{}),
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
// Utilizado al finalizar una extracción: solo aplica valores históricos contrastados.
export async function applyVerifiedHistoricals(db,job) {
  const result={applied:0,pending:0,created_stats:0,created_valuations:0,errors:[]};
  if(job.status!=="review")return result;
  const player=await db.Player.get(job.player_id);
  if(!player)return result;
  const links=await allRows(db.PlayerFotmobLink,{player_id:job.player_id});
  const backlinks=await allRows(db.PlayerFotmobLink,{fotmob_player_id:job.fotmob_player_id});
  const valid=new Set(["verified","confirmed","manual","manual_confirmada","confirmada","automatic_exact_name_unique"]);
  if(!links.length||links.some(l=>str(l.fotmob_player_id)!==str(job.fotmob_player_id))||!links.some(l=>valid.has(str(l.verification).toLowerCase()))||backlinks.some(l=>str(l.player_id)!==job.player_id))return result;
  const records=await allRows(db.ImportCandidate,{job_id:job.id});
  const trusted=c=>c.review_status==="pending"&&c.verification_status==="verified"&&str(c.evidence_url).startsWith("https://")&&str(c.provenance?.archive_url).startsWith("https://")&&!!str(c.provenance?.sha256)&&str(c.player_id)===str(job.player_id)&&str(c.fotmob_player_id)===str(job.fotmob_player_id);
  for(const item of records.filter(c=>trusted(c)&&["overall","market_value"].includes(c.kind))){
    const p=item.provenance;
    if(!p?.player_id||!p.identity_rule||(item.kind==="overall"&&(item.source!=="fifa"||p.rating_kind!=="launch_base"))||(item.kind==="market_value"&&(item.source!=="market"||p.value_kind!=="market_value")))continue;
    try{
      const existing=rows(await db.PlayerHistoricalValuation.filter({player_id:job.player_id,season:item.season},undefined,10));
      if(existing.length>1)continue;
      const plan=valuationPlan(item,existing[0]||null);
      if(plan.operation==="create") {await db.PlayerHistoricalValuation.create({player_id:job.player_id,fotmob_player_id:job.fotmob_player_id,season:item.season,verification_status:"verified",...plan.record});result.created_valuations++;}
      else if(plan.operation==="update")await db.PlayerHistoricalValuation.update(plan.target_id,plan.record);
      await db.ImportCandidate.update(item.id,{review_status:"applied",review_note:"Autoaplicado: archivo contrastado y sin sobrescribir datos"});
      result.applied++;
    }catch(e){if(result.errors.length<8)result.errors.push(item.source+" "+item.season+": "+e.message);}
  }
  // Understat solo para temporadas cerradas, procedencia contrastada y equipo interno único.
  const byScope=new Map();
  for(const c of records.filter(x=>x.source==="understat"&&x.kind==="metric")){
    const key=[c.season,c.competition,c.fotmob_team_id,c.team_name].join("|");
    if(!byScope.has(key))byScope.set(key,[]);
    byScope.get(key).push(c);
  }
  const teams=await allRows(db.Team,{});
  const club=v=>norm(v).replace(/^(fc|cf) /,"").replace(/ (fc|cf)$/,"");
  for(const group of byScope.values()){
    const first=group[0],prov=first.provenance||{};
    if(group.some(c=>!trusted(c)||c.is_national_team!==false||c.fotmob_tournament_id!==first.fotmob_tournament_id)||
      prov.scope!=="league_team_season"||!prov.player_id||!first.fotmob_tournament_id||
      Number(first.season.slice(0,4))>=2025)continue;
    const matching=teams.filter(t=>club(t.name)===club(first.team_name)&&
      (!t.fotmob_id||str(t.fotmob_id)===str(first.fotmob_team_id)));
    if(matching.length!==1)continue;
    try{
      const existing=await allRows(db.PlayerSeasonStats,{player_id:job.player_id,season:first.season});
      const plan=seasonPlan(group,player,existing,{team_id:matching[0].id});
      if(plan.operation==="create"){
        await db.PlayerSeasonStats.create({...plan.record,verification_status:"verified",review_status:"approved"});
        result.created_stats++;
      }else if(plan.operation==="update")await db.PlayerSeasonStats.update(plan.target_id,plan.record);
      await db.ImportCandidate.updateMany({id:{$in:group.map(c=>c.id)},job_id:job.id,review_status:"pending"},
        {$set:{review_status:"applied",review_note:"Autoaplicado: Understat contrastado, club único y temporada cerrada"}});
      result.applied+=group.length;
    }catch(e){if(result.errors.length<8)result.errors.push("understat "+first.season+": "+e.message);}
  }
  result.pending=records.length-result.applied;
  return result;
}
async function conclude(db,job) {
  const pending=rows(await db.ImportCandidate.filter({job_id:job.id,review_status:"pending"},undefined,1));
  if(!pending.length)await db.ImportJob.update(job.id,{status:"completed",phase:"Candidatos revisados",progress:100});
}
export default async function(req) {
  if(req.method!=="POST")return bad("Solo POST.",405);
  try {
    const sdk=createClientFromRequest(req);
    const user=await sdk.auth.me();
    if(!user || user.role!=="admin")return bad("Solo administradores.",403);
    const data=await req.json();
    const action=str(data.action),candidateId=str(data.candidate_id);
    if(!/^[a-f0-9]{24}$/i.test(candidateId))return bad("ID de candidato no válido.");
    const db=sdk.asServiceRole.entities;
    const item=await db.ImportCandidate.get(candidateId);
    if(!item)return bad("Candidato no encontrado.",404);
    const job=await db.ImportJob.get(item.job_id);
    if(!job||job.player_id!==item.player_id||job.fotmob_player_id!==item.fotmob_player_id)return bad("Identidad del candidato incompatible.",409);
    if(action==="auto-safe") {
      const result=await applyVerifiedHistoricals(db,job);
      const remaining=rows(await db.ImportCandidate.filter({job_id:job.id,review_status:"pending"},undefined,1));
      if(job.status==="review")await db.ImportJob.update(job.id,{status:remaining.length?"review":"completed",phase:"Automático: "+result.applied+" incorporados · "+(remaining.length?"revisión pendiente":"completado")});
      return reply({ok:true,...result,remaining_review:remaining.length>0});
    }
    if(item.review_status==="applied"||item.review_status==="rejected")return reply({ok:true,status:item.review_status,unchanged:true});
    if(item.review_status!=="pending"||job.status!=="review")return bad("Este candidato no está disponible para revisión.",409);
    if(action==="reject") {
      await db.ImportCandidate.update(item.id,{review_status:"rejected",review_note:str(data.note).slice(0,250)||"Descartado por administrador"});
      await conclude(db,job);
      return reply({ok:true,status:"rejected"});
    }
    if(action==="verify") {
      if(item.verification_status==="conflict")return bad("El candidato está en conflicto; requiere conciliación.",409);
      if(!str(item.evidence_url).startsWith("https://"))return bad("La observación no tiene una fuente consultable.",409);
      await db.ImportCandidate.update(item.id,{verification_status:"verified",review_note:"Verificada expresamente por un administrador tras revisar la evidencia"});
      return reply({ok:true,status:"verified"});
    }
    if(!["approve","preview","approve-season","preview-season","verify-season"].includes(action))return bad("Acción desconocida.");
    if(action==="approve"&&(item.verification_status!=="verified"||!str(item.evidence_url).startsWith("https://")))return bad("No se pueden aplicar valores sin evidencia verificada.",409);
    const player=await db.Player.get(item.player_id);
    if(!player)return bad("El jugador ya no existe.",409);
    const links=await allRows(db.PlayerFotmobLink,{player_id:item.player_id});
    const backlinks=await allRows(db.PlayerFotmobLink,{fotmob_player_id:item.fotmob_player_id});
    if(!links.length||!links.every(l=>str(l.fotmob_player_id)===str(item.fotmob_player_id))
      ||!links.some(l=>["manual","verified","confirmed","manual_confirmada","confirmada","automatic_exact_name_unique"].includes(str(l.verification)))
      ||backlinks.some(l=>str(l.player_id)!==item.player_id))return bad("La vinculación FotMob ya no es única y verificada.",409);
    if(item.kind==="metric") {
      const grouped=action.endsWith("-season");
      const group=grouped?(await allRows(db.ImportCandidate,{job_id:item.job_id,player_id:item.player_id,
        kind:"metric",season:item.season,competition:item.competition,fotmob_team_id:item.fotmob_team_id,
        source:item.source})): [item];
      if(grouped&&group.some(c=>!["pending","applied"].includes(c.review_status)))return bad("La temporada contiene observaciones descartadas; revisa individualmente.",409);
      if(group.some(c=>c.verification_status==="conflict"))return bad("Hay métricas en conflicto; requiere conciliación.",409);
      if(action==="verify-season") {
        if(group.some(c=>!str(c.evidence_url).startsWith("https://")))return bad("Hay métricas sin evidencia.",409);
        await db.ImportCandidate.updateMany({id:{$in:group.map(c=>c.id)},job_id:item.job_id,review_status:"pending"},
          {$set:{verification_status:"verified",review_note:"Temporada verificada expresamente por administrador"}});
        return reply({ok:true,status:"verified",candidates:group.length});
      }
      if(action==="approve-season"&&(data.confirm_source_reviewed!==true||group.some(c=>!str(c.evidence_url).startsWith("https://"))))return bad("Confirma que has revisado identidad, equipo, competición y evidencias de toda la temporada.",409);
      const existing=await allRows(db.PlayerSeasonStats,{player_id:item.player_id,season:item.season});
      const teamLink={};
      if(typeof item.is_national_team==="boolean") {
        const entity=item.is_national_team?db.NationalTeam:db.Team;
        const teams=await allRows(entity,{fotmob_id:Number(item.fotmob_team_id)});
        if(teams.length>1)return bad("ID FotMob del equipo duplicado.",409);
        if(teams[0])Object.assign(teamLink,item.is_national_team
          ?{national_team_id:teams[0].id,national_country_id:teams[0].country_id}:{team_id:teams[0].id});
        else if(item.is_national_team===false&&player.team_id){
          const current=await db.Team.get(player.team_id);
          Object.assign(teamLink,reviewedCurrentTeamLink(player,current,item));
        }
      }
      let plan;
      try {plan=grouped?seasonPlan(group,player,existing,teamLink):metricPlan(item,player,existing,teamLink);}catch(e){return bad(e.message,409);}
      if(action==="preview"||action==="preview-season")return reply({ok:true,plan,can_apply:group.every(c=>c.verification_status==="verified")});
      if(plan.operation==="create") {
        // A timeout may hide a successful create. Never replay an ambiguous write.
        try {const saved=await db.PlayerSeasonStats.create(plan.record);plan.target_id=saved?.id;}catch {
          return bad("Creación no confirmada; vuelve a consultar STATS antes de reintentar.",409);
        }
      } else if(plan.operation==="update")await db.PlayerSeasonStats.update(plan.target_id,plan.record);
      if(grouped) {
        const pending=group.filter(c=>c.review_status==="pending");
        if(pending.length)await db.ImportCandidate.updateMany({id:{$in:pending.map(c=>c.id)},job_id:item.job_id,review_status:"pending"},
          {$set:{review_status:"applied",verification_status:"verified",review_note:"Temporada aprobada; se completaron únicamente campos vacíos"}});
        await conclude(db,job);
        return reply({ok:true,status:"applied",operation:plan.operation,candidates:group.length,
          season_id:plan.target_id,created_season:plan.operation==="create",new_metrics:plan.operation==="unchanged"?0:pending.length});
      }
    } else if(item.kind==="overall"||item.kind==="market_value") {
      const existing=rows(await db.PlayerHistoricalValuation.filter({player_id:item.player_id,season:item.season},undefined,10));
      if(existing.length>1)return bad("Hay varias valoraciones para la misma temporada.",409);
      let plan;
      try{plan=valuationPlan(item,existing[0]||null);}catch(e){return bad(e.message,409);}
      if(action==="preview")return reply({ok:true,candidate:item,plan,can_apply:item.verification_status==="verified"});
      if(plan.operation==="create")await db.PlayerHistoricalValuation.create({player_id:item.player_id,fotmob_player_id:item.fotmob_player_id,season:item.season,verification_status:"verified",...plan.record});
      else if(plan.operation==="update")await db.PlayerHistoricalValuation.update(plan.target_id,plan.record);
    } else return bad("Tipo no admitido.",409);
    await db.ImportCandidate.update(item.id,{review_status:"applied",review_note:"Aprobado por administrador, sin sustituir valores existentes"});
    await conclude(db,job);
    return reply({ok:true,status:"applied"});
  } catch(e){console.error("import-review",e);return bad(e?.message||"Error interno.",500);}
}
