import React, {useEffect,useId,useState} from "react";
import {createPortal} from "react-dom";
import {base44} from "@/api/base44Client";
import {compactPositionValue} from "@/utils/compactPositionRatings";
import {PLAYER_DESCRIPTIONS} from "@/components/players/playerFormShared";
import {tacticalZoneForRole} from "@/utils/roleTacticalZones";

// Prototipo de disposición usando la imagen facilitada por el usuario.
// Solo los números son dinámicos; la ilustración original permanece intacta.
const IMAGE="https://media.base44.com/images/public/6a88359fd43f2af862874b12/6d8135465_ChatGPT_Image_21_ago_2026__12_30_18_4_.png";
// Posiciones del campo anterior: únicamente cambia la capa de indicadores.
const NUMBERS=[
 ["delantero","DL(C)",50,47.5],
 ["mediapunta_por_la_izquierda","EI",24,57.5],
 ["mediapunta_central","MP(C)",50,57.5],
 ["mediapunta_por_la_derecha","ED",76,57.5],
 ["mc_left","MC",39,66.1],
 ["mc_right","MC",61,66.1],
 ["carrilero_izquierdo","CR(I)",18,75.4],
 ["mediocentro","MCD",50,75.4],
 ["carrilero_derecho","CR(D)",82,75.4],
 ["defensa_central","DFC(I)",39,82.2],
 ["defensa_central","DFC(D)",61,82.2],
 ["portero","POR",50,89.1],
];
const ROLE_RANGES=[
 {min:17,max:20,label:"Élite",color:"#08A66C"},
 {min:13,max:16,label:"Muy buena",color:"#7BC74B"},
 {min:9,max:12,label:"Media",color:"#E9C64A"},
 {min:5,max:8,label:"Baja",color:"#F28A38"},
 {min:1,max:4,label:"Muy baja",color:"#DF4554"},
];
const roleColor=(value)=>ROLE_RANGES.find(({min,max})=>value>=min&&value<=max)?.color||"#94A3B8";


// Reutilizar exactamente el catálogo del editor del jugador, incluidos sus emojis.
const ALL_ROLES=PLAYER_DESCRIPTIONS.flatMap(group=>group.options);
const comparableRole=value=>String(value||"").replace(/^[^\p{L}\p{N}]+/u,"").trim().toLocaleLowerCase("es");
const canonicalRole=value=>ALL_ROLES.find(option=>option===value||comparableRole(option)===comparableRole(value))||String(value||"");
const EMPTY=[{name:"",description:""},{name:"",description:""}];
export default function RoleFieldConcept({ratings={},playerId,position,foot,storedRoles,onSaved,adaptive=false}){
 const key="mf-legacy-tactical-role-settings-v1:"+String(playerId||"preview");
 const [roles,setRoles]=useState(EMPTY);
 const [editing,setEditing]=useState(null);
 const [activeRole,setActiveRole]=useState(null);
 const [saving,setSaving]=useState(false);
 const [saveError,setSaveError]=useState("");
 const svgId=useId().replace(/:/g,"");
 const [draft,setDraft]=useState({name:"",description:""});
 const normalizedRoles=value=>Array.isArray(value)&&value.length===2?
  value.map(x=>({name:canonicalRole(x?.name),description:String(x?.description||"")})):null;
 useEffect(()=>{
  // Canonical Base44 data wins over the old browser-only draft.
  const persisted=normalizedRoles(storedRoles);
  if(persisted){setRoles(persisted);}
  else{
   try{const legacy=JSON.parse(window.localStorage.getItem(key)||"null");setRoles(normalizedRoles(legacy)||EMPTY);}
   catch{setRoles(EMPTY);}
  }
  setEditing(null);setActiveRole(null);setSaveError("");
 },[key,storedRoles]);
 const openEditor=i=>{setDraft({...roles[i]});setEditing(i);setSaveError("");};
 const toggleRole=i=>{if(!roles[i].name){openEditor(i);return;}setActiveRole(value=>value===i?null:i);};
 const save=async()=>{
  if(saving||!playerId)return;
  const next=roles.map((r,i)=>i===editing?{name:draft.name.trim(),description:draft.description.trim()}:r);
  setSaving(true);setSaveError("");
  try{
   await base44.entities.Player.update(playerId,{tactical_roles:next,description:next[0]?.name||""});
   setRoles(next);
   setActiveRole(next[editing]?.name?editing:null);
   onSaved?.({tactical_roles:next,description:next[0]?.name||""});
   // Stop using local browser state after a successful server save.
   try{window.localStorage.removeItem(key);}catch{}
   setEditing(null);
  }catch(error){
   setSaveError(error?.message||"No se pudo guardar el rol en Base44.");
  }finally{setSaving(false);}
 };
 const zone=activeRole!==null?tacticalZoneForRole(roles[activeRole]?.name,position,foot):null;
 return <div className={adaptive ? "mf-role-concept" : "relative w-full"} style={adaptive ? undefined : {aspectRatio:"3 / 2"}} aria-label="Roles y posiciones">
  {adaptive && <div className="mf-role-controls">
    <h2 className="text-base font-extrabold text-slate-900">Roles</h2>
    {roles.map((role,i)=><div key={i} className="mf-role-row">
      <button type="button" onClick={()=>toggleRole(i)} aria-pressed={activeRole===i} aria-label={role.name?`Mostrar zona de ${role.name}`:`Añadir rol ${i+1}`} className={activeRole===i?"text-emerald-700":"text-slate-900"}>{role.name || `Añadir rol ${i+1}`}</button>
      <button type="button" onClick={()=>openEditor(i)} aria-label={`Editar rol ${i+1}`} className="text-xl font-black text-emerald-500">+</button>
    </div>)}
    {activeRole!==null&&roles[activeRole]?.description&&<p className="text-xs leading-relaxed text-slate-600">{roles[activeRole].description}</p>}
  </div>}
  <div className={adaptive ? "mf-role-field-pitch" : undefined}><div className={adaptive ? "mf-role-field-art" : undefined}>
  <img className="pointer-events-none absolute inset-0 h-full w-full object-contain" src={IMAGE} alt="Roles y campo de fútbol en perspectiva"/>
  {zone&&<svg className="pointer-events-none absolute inset-0 z-[2] h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`Zona táctica orientativa: ${zone.roleName}`} role="img">
    <defs>
      <radialGradient id={svgId+"-field"}>
        <stop offset="0%" stopColor="#059669" stopOpacity=".65"/>
        <stop offset="58%" stopColor="#10B981" stopOpacity=".38"/>
        <stop offset="100%" stopColor="#10B981" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <ellipse cx={zone.cx} cy={zone.cy} rx={zone.rx} ry={zone.ry} transform={`rotate(${zone.rotation||0} ${zone.cx} ${zone.cy})`} fill={`url(#${svgId}-field)`}/>
    <ellipse cx={zone.cx} cy={zone.cy} rx={zone.rx*.55} ry={zone.ry*.62} transform={`rotate(${zone.rotation||0} ${zone.cx} ${zone.cy})`} fill="#047857" fillOpacity=".13"/>
  </svg>}
  {/* Click the name to preview the zone. The existing green + independently edits the role. */}
  {!adaptive&&roles.map((role,i)=><div key={i}
    className="pointer-events-none absolute z-30"
    style={{left:"16.4%",top:i===0?"13.4%":"calc(23.9% + 2px)",width:"56.7%",height:"8.8%"}}
  >
    <button type="button" onClick={()=>toggleRole(i)} aria-pressed={activeRole===i}
      aria-label={role.name?`Mostrar zona de ${role.name}`:`Añadir rol ${i+1}`}
      title={role.description||(role.name?"Mostrar u ocultar zona táctica":"Seleccionar rol")}
      className="pointer-events-auto absolute inset-y-0 left-0 flex w-[82%] items-center rounded-md bg-transparent text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
      {role.name&&<span
        className="pointer-events-none flex h-full min-w-0 flex-1 items-center overflow-hidden text-ellipsis whitespace-nowrap pl-5 pr-1 font-bold"
        style={{fontSize:role.name.length>30?"13px":role.name.length>25?"14px":"16px",lineHeight:"1.2",paddingTop:"11px",color:activeRole===i?"#057A49":"#0F172A"}}
      >{role.name}</span>}
    </button>
    <button type="button" onClick={()=>openEditor(i)}
      aria-label={`Editar rol ${i+1}`} title="Elegir rol y editar tu descripción"
      className="pointer-events-auto absolute inset-y-0 right-0 w-[18%] cursor-pointer rounded-md bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"/>
  </div>)}
  {NUMBERS.map(([key,label,x,y],i)=>{
    const n=compactPositionValue(ratings,key);
    const tone=roleColor(n);
    return <div key={i} className="mf-role-field-marker pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{left:`${x}%`,top:`${y}%`}}>
      <span className="flex items-center justify-center rounded-[5px] px-2 font-black leading-tight text-white shadow-sm" style={{background:tone,fontSize:"clamp(9px,1.1vw,14px)",minWidth:"clamp(21px,2.3vw,30px)",height:"clamp(15px,1.6vw,20px)"}}>{n||"–"}</span>
      <span className="rounded-b-md bg-white px-1.5 text-center font-black leading-tight text-slate-900 shadow-sm" style={{fontSize:"clamp(7px,.73vw,10px)"}}>{label}</span>
    </div>;
  })}
  </div></div>
  {editing!==null&&typeof document!=="undefined"&&createPortal(
   <div className="mf-modal-overlay fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null);}}>
    <div role="dialog" aria-modal="true" aria-label={`Editar rol ${editing+1}`} className="pointer-events-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
     <div className="mb-4 flex items-center justify-between">
      <h3 className="text-base font-extrabold text-slate-900">Rol {editing+1}</h3>
      <button type="button" onClick={()=>setEditing(null)} aria-label="Cerrar" className="rounded-md p-1 text-slate-500 hover:bg-slate-100">✕</button>
     </div>
     <label htmlFor="role-choice" className="mb-1 block text-xs font-bold text-slate-600">Seleccionar rol</label>
     <select id="role-choice" value={draft.name} onChange={e=>setDraft(v=>({...v,name:e.target.value}))} className="mb-4 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900">
      <option value="">Sin rol asignado</option>
      {draft.name&&!ALL_ROLES.includes(draft.name)&&<option value={draft.name}>{draft.name} (anterior)</option>}
      {PLAYER_DESCRIPTIONS.map(group=><optgroup key={group.group} label={group.group}>
       {group.options.map(name=><option key={name} value={name}>{name}</option>)}
      </optgroup>)}
     </select>
     <label htmlFor="role-description" className="mb-1 block text-xs font-bold text-slate-600">Tu descripción (opcional)</label>
     <textarea id="role-description" value={draft.description} onChange={e=>setDraft(v=>({...v,description:e.target.value}))} placeholder="Escribe aquí tu propia descripción del rol…" rows={4} className="w-full resize-y rounded-lg border border-slate-300 p-3 text-sm text-slate-900"/>
     {saveError&&<p role="alert" className="mt-2 text-xs font-medium text-red-600">{saveError}</p>}
     <div className="mt-4 flex justify-end gap-2">
      <button type="button" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100" onClick={()=>setEditing(null)}>Cancelar</button>
      <button type="button" className="rounded-lg bg-[#003399] px-4 py-2 text-sm font-bold text-white" onClick={save} disabled={saving||!playerId}>{saving?"Guardando…":"Guardar rol"}</button>
     </div>
    </div>
   </div>,document.body)}

 </div>;
}
