import {normalizeTrophyName,trophyResearchAnchor} from "./trophyResearch.js";

export const PALMARES_FORMAT="mf_legacy_fm24_team_palmares_v1";
export const PALMARES_RANKS=["winner","runner_up","third"];
const canonical={
 "laliga ea sports":"laliga",
 "uefa super cup":"supercopa de europa",
 "uefa europa league":"europa league",
 "mundialito de clubes":"mundial de clubes fifa",
 "copa de la liga espanola":"copa de la liga de espana",
 "trofeo festa d elx":"festa d elx",
 "trofeo ciudad de zaragoza":"trofeo ciudad de zaragoza",
 "trofeo conde de fenosa":"trofeo conde de fenosa",
 "eusebio cup":"eusebio cup",
 "taca iberica":"taca iberica",
 "uefa youth league":"uefa youth league"
};
const norm=normalizeTrophyName;
const baseName=name=>norm(name).replace(/\s+\d{4}\s+\d{4}$/,"").replace(/\s+(?:trophy|trofeo)$/,"").trim();
const slashName=name=>norm(name).replace(/\bde\b/g,"").replace(/\bthe\b/g,"").trim();
const yearKey=(teamId,name,rank,year)=>[String(teamId),norm(name),rank,String(year)].join("|");
export const palmaresBatchId=batch=>"fm24_"+String(batch.team?.id||"unknown")+"_"+(batch.source_type||"screenshot");
export function validatePalmaresBatch(data){
 if(data?.format!==PALMARES_FORMAT)throw Error("Formato incorrecto: se esperaba "+PALMARES_FORMAT);
 if(!data.team?.name||!Array.isArray(data.competitions)||!data.competitions.length)throw Error("Faltan el nombre del equipo o las competiciones.");
 const issues=[],seen=new Set();let rows=0;
 for(const [i,c] of data.competitions.entries()){
  if(!String(c.raw_name||"").trim()||!Array.isArray(c.placements)||!c.placements.length)throw Error("Competición "+(i+1)+" sin nombre o sin resultados.");
  for(const p of c.placements){
   if(!PALMARES_RANKS.includes(p.rank)||!Array.isArray(p.years))throw Error("Puesto o años inválidos en "+c.raw_name);
   for(const year of p.years){
    if(!Number.isInteger(year)||year<1800||year>2100)throw Error("Año inválido en "+c.raw_name+": "+year);
    const key=yearKey(data.team.id,c.raw_name,p.rank,year);
    if(seen.has(key))issues.push("Resultado repetido en el archivo: "+c.raw_name+" "+p.rank+" "+year);
    seen.add(key);rows++;
   }
  }
 }
 if(issues.length)throw Error(issues.slice(0,6).join("; "));
 return {competitions:data.competitions.length,entries:rows};
}
function catalogMatchIndex(catalog){
 const index=new Map();
 for(const t of catalog){
  if(!t.source_id||!t.name)continue;
  const names=[norm(t.name),baseName(t.name)];
  for(const value of names){const key=value;if(!index.has(key))index.set(key,new Map());index.get(key).set(String(t.source_id),t);}
 }
 return index;
}
const only=map=>map&&map.size===1?[...map.values()][0]:null;
const historicBounds=name=>{const x=String(name||"").match(/\((\d{4})\s*[-–]\s*(\d{4})\)/);return x?[Number(x[1]),Number(x[2])]:null;};
const historicalRangeCheck=(name,trophy,years=[])=>{const bounds=historicBounds(trophy?.name);if(bounds&&years.some(y=>y<bounds[0]||y>bounds[1]))return "Años del archivo fuera del rango de la ficha histórica ("+bounds.join("–")+"): comprobar si se trata de otra edición o variante.";return "";};
export function matchPalmaresTrophy(name,catalog=[],years=[]){
 const key=norm(name),idx=catalogMatchIndex(catalog);
 const direct=idx.get(key);
 if(direct?.size===1){const trophy=only(direct),conflict=historicalRangeCheck(name,trophy,years);return {trophy,status:conflict?"needs_review":"auto_linked",confidence:conflict?70:100,reason:conflict||"Nombre exacto y único",suggestions:[...direct.values()]};}
 if(direct?.size>1)return {trophy:null,status:"needs_review",confidence:0,reason:"Nombre compartido por varias fichas",suggestions:[...direct.values()]};
 const translated=canonical[key];
 if(translated){
  const records=idx.get(translated);
  if(records?.size===1){
   // A historical trophy that was renamed can be linked only to the same competition identity.
   const trophy=only(records),conflict=historicalRangeCheck(name,trophy,years);const needsReview=key==="mundialito de clubes"||Boolean(conflict);return {trophy,status:needsReview?"needs_review":"auto_linked",confidence:needsReview?70:99,reason:conflict||(needsReview?"Alias con variantes históricas; selección manual necesaria":"Alias de nombre único"),suggestions:[...records.values()]};
  }
 }
 // Unique canonical names with explicit year ranges may be good candidates, but
 // do not assign if competing versions of the same trophy exist.
 const cut=baseName(name);
 const candidates=catalog.filter(t=>baseName(t.name)===cut||slashName(t.name)===slashName(name));
 if(candidates.length===1){const trophy=candidates[0],conflict=historicalRangeCheck(name,trophy,years);return {trophy,status:conflict?"needs_review":"auto_linked",confidence:conflict?70:96,reason:conflict||"Nombre histórico coincidente con una sola ficha",suggestions:candidates};}
 if(candidates.length>1)return {trophy:null,status:"needs_review",confidence:0,reason:"Hay varias versiones históricas",suggestions:candidates.slice(0,8)};
 const parts=new Set(key.split(" ").filter(x=>x.length>3));
 const options=catalog.map(t=>{
  const target=norm(t.name),tokens=new Set(target.split(" ").filter(x=>x.length>3));
  const overlap=[...parts].filter(x=>tokens.has(x)).length;
  const ratio=parts.size?overlap/parts.size:0;
  const prefix=target.startsWith(key)||key.startsWith(target);
  return {t,score:ratio+(prefix?.2:0)};
 }).filter(x=>x.score>=.55).sort((a,b)=>b.score-a.score).slice(0,6).map(x=>x.t);
 return {trophy:null,status:options.length?"needs_review":"unmatched",confidence:0,reason:options.length?"Coincidencia aproximada: requiere selección manual":"Sin correspondencia inequívoca en Trophy",suggestions:options};
}
export function previewPalmaresBatch(batch,catalog=[],teamRecords=[]){
 const {competitions,entries}=validatePalmaresBatch(batch);
 const team=teamRecords.find(t=>String(t.id)===String(batch.team.id));
 if(!team)throw Error("Debes seleccionar el equipo correcto de Teams antes de vincular resultados.");
 const groups=batch.competitions.map((c,i)=>({
  index:i,raw_name:c.raw_name,source_note:c.source_note||"",count:c.placements.reduce((n,p)=>n+p.years.length,0),
  ...matchPalmaresTrophy(c.raw_name,catalog,c.placements.flatMap(p=>p.years))
 }));
 return {team,competitions,entries,groups,auto:groups.filter(g=>g.status==="auto_linked").length,pending:groups.filter(g=>g.status!=="auto_linked").length};
}
export function materializePalmaresEntries(batch,groups){
 validatePalmaresBatch(batch);
 const byIndex=new Map(groups.map(g=>[g.index,g]));
 const id=palmaresBatchId(batch);
 return batch.competitions.flatMap((comp,index)=>{
  const decision=byIndex.get(index);
  const trophy=decision?.trophy??null;
  const status=trophy?(decision?.status==="manual_linked"?"manual_linked":decision?.status==="auto_linked"?"auto_linked":"needs_review"):decision?.status==="ignored"?"ignored":"needs_review";
  return comp.placements.flatMap(part=>part.years.map(year=>({
   entry_key:yearKey(batch.team.id,comp.raw_name,part.rank,year),
   batch_id:id,team_id:String(batch.team.id),team_name:String(batch.team.name),
   trophy_source_id:["auto_linked","manual_linked"].includes(status)?String(trophy?.source_id||""):"",
   trophy_id:["auto_linked","manual_linked"].includes(status)?String(trophy?.id||""):"",
   trophy_name_raw:comp.raw_name,trophy_name_matched:["auto_linked","manual_linked"].includes(status)?String(trophy?.name||""):"",
   source_order:index+1,source_segment:Number(comp.capture_index||0),
   rank:part.rank,calendar_year:year,edition_label:String(year),original_year_text:String(year)+(comp.year_annotations?.[part.rank+":"+year]?" ("+comp.year_annotations[part.rank+":"+year]+")":""),
   source_type:batch.source_type,source_files:(batch.source_files||[]).join(" | "),
   source_note:String(comp.source_note||""),
   match_status:status,match_confidence:Number(decision?.confidence||0),review_reason:String(decision?.reason||""),
   manually_reviewed:status==="manual_linked",officially_verified:false,official_source_url:"",
   is_friendly:Boolean(trophy&&trophyResearchAnchor(trophy)?.friendly||/\b(?:trofeo|friendly|emirates cup|audi cup|challenge|trophy)\b/i.test(comp.raw_name)),
   created_from_import:true
  })));
 });
}
export function palmaresImportPlan(entries,existing=[]){
 const old=new Set(existing.map(e=>e.entry_key));
 const seen=new Set();const pending=[];
 for(const entry of entries){
  if(seen.has(entry.entry_key))throw Error("Duplicado en la importación: "+entry.entry_key);
  seen.add(entry.entry_key);
  if(!old.has(entry.entry_key))pending.push(entry);
 }
 return {pending,skipped:entries.length-pending.length,total:entries.length};
}
