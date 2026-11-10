import React,{useMemo,useState} from "react";
import {X,UserRound,Shield,SlidersHorizontal,Image as ImageIcon,ChevronDown,CheckCircle2} from "lucide-react";
import {inputClassName,POSITION_RATING_GROUPS,PLAYER_DESCRIPTIONS,NEW_TEAM_VALUE,NEW_COUNTRY_VALUE,careerStatusLogo,normalizeImageUrl,SearchableEntitySelect} from "@/components/players/playerFormShared";
import {PLAYER_ATTRIBUTE_GROUPS} from "@/components/players/playerAttributeGroups.mjs";

const POSITIONS=[
 ["GK","Portero","portero"],["DFC","Central","defensa_central"],
 ["LI","Lateral izquierdo","defensa_izquierdo"],["LD","Lateral derecho","defensa_derecho"],
 ["CRI","Carrilero izquierdo","carrilero_izquierdo"],["CRD","Carrilero derecho","carrilero_derecho"],
 ["CDM","Pivote","mediocentro"],["CM","Centrocampista","centrocampista"],
 ["CAM","Mediapunta","mediapunta_central"],["EI","Extremo izquierdo","mediapunta_por_la_izquierda"],
 ["ED","Extremo derecho","mediapunta_por_la_derecha"],["DC","Delantero","delantero"]
];
const section="rounded-xl border border-slate-200 bg-white shadow-sm";
const labelClass="mb-1.5 block text-[11px] font-semibold text-slate-600";
const number=(value)=>value===""||value===null||value===undefined?null:Number(value);

function Section({title,subtitle,icon:Icon,children,initial=false,count}){
 return <details open={initial?true:undefined} className={section}>
  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
   <span className="flex items-center gap-2 text-sm font-bold text-slate-900"><Icon size={16} className="text-[#003399]"/>{title}{count>0&&<span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] text-[#003399]">{count}</span>}</span>
   <span className="flex items-center gap-2 text-[10px] text-slate-400">{subtitle}<ChevronDown size={15}/></span>
  </summary><div className="border-t border-slate-100 px-4 py-4">{children}</div>
 </details>;
}
function Numeric({label,value,onChange,min=0,max=200,placeholder="Opcional",step=1}){
 return <label className="block min-w-0"><span className={labelClass}>{label}</span><input className={inputClassName} type="number" min={min} max={max} step={step} placeholder={placeholder} value={value??""} onChange={e=>onChange(e.target.value)}/></label>;
}
function RolesSelect({value,onChange,placeholder="Sin rol"}){
 return <select className={inputClassName} value={value||""} onChange={e=>onChange(e.target.value)}>
  <option value="">{placeholder}</option>{PLAYER_DESCRIPTIONS.map(group=><optgroup key={group.group} label={group.group}>{group.options.map(v=><option key={v} value={v}>{v}</option>)}</optgroup>)}
 </select>;
}
export default function PlayerFormModal({form,setForm,isSaving,onClose,onSubmit,countries=[],teams=[]}){
 const [sectionHint,setSectionHint]=useState("");
 const update=(key,value)=>setForm(old=>({...old,[key]:value}));
 const setRole=(i,key,value)=>setForm(old=>{
  const roles=[...(old.tacticalRoles||[{name:"",description:""},{name:"",description:""}])];
  roles[i]={...(roles[i]||{name:"",description:""}),[key]:value};
  return {...old,tacticalRoles:roles,description:i===0&&key==="name"?value:old.description};
 });
 const setAttribute=(group,key,value)=>setForm(old=>({...old,stats:{...old.stats,[group]:{...(old.stats?.[group]||{}),[key]:value}}}));
 const setPosition=(key,value)=>setForm(old=>({...old,[key]:value,positionRatings:key==="primaryPosition"&&value?{
  ...old.positionRatings,[POSITIONS.find(p=>p[0]===value)?.[2]]:old.positionRatings?.[POSITIONS.find(p=>p[0]===value)?.[2]]==="0"?"20":old.positionRatings?.[POSITIONS.find(p=>p[0]===value)?.[2]]
 }:old.positionRatings}));
 const attributesCount=useMemo(()=>Object.values(form.stats||{}).reduce((n,g)=>n+Object.values(g||{}).filter(v=>v!==""&&v!==null&&v!==undefined).length,0),[form.stats]);
 const hasDate=Boolean(form.dateOfBirth?.trim());
 const formValid=Boolean(form.name?.trim()&&form.primaryPosition&&
  (form.teamId!==NEW_TEAM_VALUE||form.newTeamName?.trim())&&
  (form.countryId!==NEW_COUNTRY_VALUE||form.newCountryName?.trim()));
 return <div className="mf-modal-overlay fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/45 p-2 backdrop-blur-[2px] sm:p-5"
  onMouseDown={event=>{if(event.target===event.currentTarget&&!isSaving)onClose()}}>
  <div role="dialog" aria-modal="true" aria-labelledby="add-player-title" className="mf-modal-panel flex max-h-[calc(100dvh_-_20px)] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#f8fafc] shadow-2xl sm:max-h-[calc(100dvh_-_40px)]">
   <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
    <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#003399]"><UserRound size={20}/></div>
     <div><h2 id="add-player-title" className="text-base font-extrabold text-slate-900">Añadir jugador a MF Legacy</h2>
      <p className="text-[11px] text-slate-500">Alta manual · Identidad, posiciones, atributos y perfil táctico</p></div></div>
    <button type="button" onClick={onClose} disabled={isSaving} aria-label="Cerrar" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50"><X size={18}/></button>
   </header>
   <form id="create-player-form" onSubmit={onSubmit} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-5">
    <Section title="Identidad y equipo" subtitle="Datos esenciales" icon={UserRound} initial>
     <div className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2"><span className={labelClass}>Nombre completo *</span><input required autoFocus className={inputClassName} value={form.name} placeholder="Ej. Toni Kroos" onChange={e=>update("name",e.target.value)}/></label>
      <label><span className={labelClass}>Fecha de nacimiento</span><input className={inputClassName} type="text" inputMode="numeric" maxLength={10} value={form.dateOfBirth||""} placeholder="DD/MM/AAAA" onChange={e=>update("dateOfBirth",e.target.value)}/><span className="text-[10px] text-slate-400">Admite D/M/AAAA o DD/MM/AAAA</span></label>
      <Numeric label="Altura (cm)" min={110} max={230} value={form.height} onChange={v=>update("height",v)}/>
      <label><span className={labelClass}>Nacionalidad principal</span><SearchableEntitySelect value={form.countryId} onChange={v=>setForm(x=>({...x,countryId:v,newCountryName:""}))} options={countries} kind="country" placeholder="Seleccionar país" searchPlaceholder="Buscar país..." emptyOption={{value:"",label:"Sin país"}} specialOption={{value:NEW_COUNTRY_VALUE,label:"+ Nuevo país"}}/></label>
      <label><span className={labelClass}>Segunda nacionalidad</span><SearchableEntitySelect value={form.secondaryCountryId||""} onChange={v=>update("secondaryCountryId",v)} options={countries.filter(c=>String(c.id)!==String(form.countryId))} kind="country" placeholder="Sin segunda nacionalidad" searchPlaceholder="Buscar país..." emptyOption={{value:"",label:"Sin segunda nacionalidad"}}/></label>
      {form.countryId===NEW_COUNTRY_VALUE&&<div className="sm:col-span-2 grid gap-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3 sm:grid-cols-2"><label><span className={labelClass}>Nombre del nuevo país *</span><input className={inputClassName} value={form.newCountryName} onChange={e=>update("newCountryName",e.target.value)} placeholder="Ej. España"/></label><label><span className={labelClass}>Continente</span><select className={inputClassName} value={form.newCountryContinent||"Europe"} onChange={e=>update("newCountryContinent",e.target.value)}>{["Europe","South America","North America","Africa","Asia","Oceania"].map(c=><option key={c}>{c}</option>)}</select></label></div>}
      <label className="sm:col-span-2"><span className={labelClass}>Club o situación profesional</span>
       <SearchableEntitySelect value={form.teamId} onChange={v=>setForm(x=>({...x,teamId:v,newTeamName:"",lastTeamId:v.startsWith("__")?x.lastTeamId:""}))} options={[{id:"__free_agent__",name:"Agente libre",logo:careerStatusLogo("free_agent"),short_name:"LIB"},{id:"__retired__",name:"Retirado",logo:careerStatusLogo("retired"),short_name:"RET"},...teams]} kind="team" placeholder="Seleccionar club o estado" searchPlaceholder="Buscar club..." emptyOption={{value:"",label:"Sin club"}} specialOption={{value:NEW_TEAM_VALUE,label:"+ Nuevo club"}}/>
      </label>
      {form.teamId===NEW_TEAM_VALUE&&<label className="sm:col-span-2"><span className={labelClass}>Nuevo club *</span><input className={inputClassName} value={form.newTeamName} placeholder="Nombre del club" onChange={e=>update("newTeamName",e.target.value)}/></label>}
      {["__free_agent__","__retired__"].includes(form.teamId)&&<><label><span className={labelClass}>Último club</span><select value={form.lastTeamId||""} onChange={e=>update("lastTeamId",e.target.value)} className={inputClassName}><option value="">Sin último club</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>{form.teamId==="__retired__"&&<Numeric label="Año de retirada" min={1900} max={2100} value={form.retirementYear} onChange={v=>update("retirementYear",v)}/>}</>}
      <Numeric label="Dorsal" min={0} max={99} value={form.shirtNumber} onChange={v=>update("shirtNumber",v)}/>
      <label><span className={labelClass}>Fuente de esta ficha</span><div className="flex h-10 items-center rounded-xl border border-blue-100 bg-blue-50 px-3 text-xs font-semibold text-blue-800">Creación manual · No es exportación FM26</div></label>
     </div>
    </Section>
    <Section title="Posiciones y valoraciones" subtitle="Puestos y CA / CP" icon={Shield} initial>
     <div className="grid gap-3 sm:grid-cols-2">
      <label><span className={labelClass}>Posición principal *</span><select required className={inputClassName} value={form.primaryPosition||""} onChange={e=>setPosition("primaryPosition",e.target.value)}><option value="">Selecciona una posición</option>{POSITIONS.map(([v,l])=><option key={v} value={v}>{v} · {l}</option>)}</select></label>
      <label><span className={labelClass}>Posición secundaria</span><select className={inputClassName} value={form.secondaryPosition||""} onChange={e=>setPosition("secondaryPosition",e.target.value)}><option value="">Sin secundaria</option>{POSITIONS.filter(([v])=>v!==form.primaryPosition).map(([v,l])=><option key={v} value={v}>{v} · {l}</option>)}</select></label>
      <Numeric label="CA · Habilidad actual (0–200)" value={form.ca} onChange={v=>update("ca",v)}/>
      <Numeric label="CP · Potencial (0–200)" value={form.cp} onChange={v=>update("cp",v)}/>
      <Numeric label="Pie derecho (1–20)" min={1} max={20} value={form.rightFoot} onChange={v=>update("rightFoot",v)}/>
      <Numeric label="Pie izquierdo (1–20)" min={1} max={20} value={form.leftFoot} onChange={v=>update("leftFoot",v)}/>
     </div>
     <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer text-xs font-bold text-slate-700">Ajustar las 14 valoraciones posicionales (0–20)</summary>
      <div className="mt-3 space-y-3">{POSITION_RATING_GROUPS.map(group=><div key={group.title}><h4 className="mb-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">{group.title}</h4><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{group.positions.map(([key,name])=><Numeric key={key} label={name} min={0} max={20} placeholder="0" value={form.positionRatings?.[key]??"0"} onChange={v=>setForm(old=>({...old,positionRatings:{...old.positionRatings,[key]:v}}))}/>)}</div></div>)}</div>
     </details>
     <p className="mt-2 text-[11px] text-slate-500">Al seleccionar el puesto principal se propone 20/20; puedes ajustar cada valoración. CA, CP y demás atributos desconocidos pueden quedar en blanco.</p>
    </Section>
    <Section title="Roles tácticos y scouting" subtitle="Dos perfiles independientes" icon={SlidersHorizontal}>
     <div className="grid gap-3 sm:grid-cols-2">{[0,1].map(index=><div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><label className={labelClass}>Rol {index+1}{index===0?" · principal":""}</label><RolesSelect value={form.tacticalRoles?.[index]?.name||""} onChange={v=>setRole(index,"name",v)}/><label className="mt-3 block"><span className={labelClass}>Descripción del rol</span><textarea className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-xs" value={form.tacticalRoles?.[index]?.description||""} onChange={e=>setRole(index,"description",e.target.value)} placeholder="Cómo juega, puntos fuertes, estilo..."/></label></div>)}</div>
     <p className="mt-2 text-[11px] text-slate-500">Los roles se conservarán en la ficha y podrán utilizarse en las comparaciones y herramientas de scouting.</p>
    </Section>
    <Section title="Atributos FM · 1–20" subtitle={attributesCount+" registrados"} icon={SlidersHorizontal} count={attributesCount}>
     <p className="mb-3 text-xs text-slate-500">Introduce solo atributos conocidos. Los vacíos se mantendrán sin dato; nunca se convierten en cero. Son valoraciones del videojuego, no estadísticas reales de FotMob.</p>
     {Object.entries(PLAYER_ATTRIBUTE_GROUPS).map(([group,attributes])=><details key={group} className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-3" open={group==="goalkeeping"&&form.primaryPosition==="GK"?true:undefined}>
       <summary className="cursor-pointer text-xs font-bold text-slate-700">{({mental:"Mentales",physical:"Físicos",technical:"Técnicos",goalkeeping:"Portero"})[group]} · {attributes.filter(([key])=>form.stats?.[group]?.[key]!==""&&form.stats?.[group]?.[key]!==undefined).length} valores</summary>
       <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{attributes.filter(([key])=>!key.includes("recomendado_altura")).map(([key,name])=><Numeric key={key} label={name} min={0} max={20} value={form.stats?.[group]?.[key]??""} placeholder="—" onChange={v=>setAttribute(group,key,v)}/>)}</div>
      </details>)}
    </Section>
    <Section title="Fotografías y medios" subtitle="Perfil, club y selección" icon={ImageIcon}>
     <div className="grid gap-3 sm:grid-cols-3">{[["photoUrl","Foto de perfil"],["cardPhotoUrl","Foto de tarjeta"],["nationalCardPhotoUrl","Foto con selección"]].map(([key,name])=><div key={key}><label className={labelClass}>{name}</label><input type="url" className={inputClassName} value={form[key]||""} onChange={e=>update(key,e.target.value)} placeholder="https://..."/>{form[key]&&<img src={normalizeImageUrl(form[key])} alt={name} className="mt-2 h-28 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain" onError={e=>e.currentTarget.style.visibility="hidden"}/>}</div>)}</div>
    </Section>
   </form>
   <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
    <div className="hidden items-center gap-1.5 text-[11px] text-slate-500 sm:flex"><CheckCircle2 size={14} className="text-blue-700"/>Los datos se guardan en la ficha Player</div>
    <div className="ml-auto flex gap-2"><button type="button" disabled={isSaving} onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700">Cancelar</button><button form="create-player-form" type="submit" disabled={isSaving||!formValid} className="rounded-xl bg-[#003399] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-40">{isSaving?"Guardando…":"Crear jugador"}</button></div>
   </footer>
  </div>
 </div>;
}
