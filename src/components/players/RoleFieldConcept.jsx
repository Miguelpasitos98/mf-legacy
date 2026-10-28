import React, {useEffect,useState} from "react";
import {createPortal} from "react-dom";
import {compactPositionValue} from "@/utils/compactPositionRatings";
import {PLAYER_DESCRIPTIONS} from "@/components/players/playerFormShared";

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
export default function RoleFieldConcept({ratings={},playerId,position}){
 const key="mf-legacy-tactical-role-settings-v1:"+String(playerId||"preview");
 const [roles,setRoles]=useState(EMPTY);
 const [editing,setEditing]=useState(null);
 const [draft,setDraft]=useState({name:"",description:""});
 useEffect(()=>{
  try{
   const stored=JSON.parse(window.localStorage.getItem(key)||"null");
   setRoles(Array.isArray(stored)&&stored.length===2?stored.map(x=>({name:canonicalRole(x?.name),description:String(x?.description||"")})):EMPTY);
  }catch{setRoles(EMPTY);}
  setEditing(null);
 },[key]);
 const openEditor=i=>{setDraft({...roles[i]});setEditing(i);};
 const save=()=>{
  const next=roles.map((r,i)=>i===editing?{name:draft.name.trim(),description:draft.description.trim()}:r);
  setRoles(next);
  try{window.localStorage.setItem(key,JSON.stringify(next));}catch{}
  setEditing(null);
 };
 return <div className="relative w-full" style={{aspectRatio:"3 / 2"}} aria-label="Roles y posiciones">
  <img className="pointer-events-none absolute inset-0 h-full w-full object-contain" src={IMAGE} alt="Roles y campo de fútbol en perspectiva"/>
  {/* A single full-width hit target per white slot: both the title and the original green + open the same editor. */}
  {roles.map((role,i)=><button
    key={i}
    type="button"
    onClick={()=>openEditor(i)}
    aria-label={role.name?`Editar rol ${i+1}: ${role.name}`:`Añadir rol ${i+1}`}
    title={role.name?"Editar rol y descripción":"Seleccionar rol y escribir descripción"}
    className="pointer-events-auto absolute z-30 flex cursor-pointer items-center rounded-md bg-transparent text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
    style={{left:"16.4%",top:i===0?"13.4%":"calc(23.9% + 1px)",width:"56.7%",height:"8.8%",pointerEvents:"auto"}}
  >
    {role.name&&<span
      className="pointer-events-none flex h-full min-w-0 flex-1 items-center overflow-hidden text-ellipsis whitespace-nowrap pl-5 pr-10 font-bold text-slate-900"
      style={{fontSize:role.name.length>30?"13px":role.name.length>25?"14px":"16px",lineHeight:"1.2",paddingTop:"11px"}}
    >{role.name}</span>}
  </button>)}
  {NUMBERS.map(([key,label,x,y],i)=>{
    const n=compactPositionValue(ratings,key);
    const tone=roleColor(n);
    return <div key={i} className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{left:`${x}%`,top:`${y}%`}}>
      <span className="flex items-center justify-center rounded-[5px] px-2 font-black leading-tight text-white shadow-sm" style={{background:tone,fontSize:"clamp(9px,1.1vw,14px)",minWidth:"clamp(21px,2.3vw,30px)",height:"clamp(15px,1.6vw,20px)"}}>{n||"–"}</span>
      <span className="rounded-b-md bg-white px-1.5 text-center font-black leading-tight text-slate-900 shadow-sm" style={{fontSize:"clamp(7px,.73vw,10px)"}}>{label}</span>
    </div>;
  })}
  {editing!==null&&typeof document!=="undefined"&&createPortal(
   <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setEditing(null);}}>
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
     <div className="mt-4 flex justify-end gap-2">
      <button type="button" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100" onClick={()=>setEditing(null)}>Cancelar</button>
      <button type="button" className="rounded-lg bg-[#003399] px-4 py-2 text-sm font-bold text-white" onClick={save}>Guardar rol</button>
     </div>
    </div>
   </div>,document.body)}

 </div>;
}
