import React,{useEffect,useMemo,useState} from "react";
import {createPortal} from "react-dom";
import {X} from "lucide-react";
import {createOverviewManualChanges,MANUAL_CARD_TITLES} from "@/utils/overviewManualChanges";
import {metricName} from "@/utils/compositeEngine";

const number=(record,name,field=null)=>{
 const value=field?record?.[field]:(record?.metrics||[]).find(m=>metricName(m.name)===metricName(name))?.value;
 return value===null||value===undefined?"":String(value).replace(".",",");
};
const simpleNames={goals:"Goals",assists:"Assists",xg:"xG",xa:"xA",shots:"Shots",
 appearances:"appearances",minutes:"minutes",rating:"rating"};
export default function OverviewManualEditor({mode,records=[],onClose,onSave,defaultName="",per90=false}){
 // Las métricas por 90 se guardan como tasa con sufijo "/90": el motor las
 // convierte a total con los minutos y las vuelve a expresar por 90.
 const baseName=String(defaultName||"").trim().replace(/\s*\/\s*90$/i,"");
 const storedName=per90?baseName+" /90":baseName;
 const [recordId,setRecordId]=useState("");
 const [form,setForm]=useState({value:"",sourceMinutes:"",won:"",contested:"",name:"",unit:"per90",scope:"season"});
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const sorted=useMemo(()=>[...records].filter(r=>r.id).sort((a,b)=>String(b.season).localeCompare(String(a.season))||
  String(a.competition).localeCompare(String(b.competition))),[records]);
 const selected=sorted.find(r=>String(r.id)===recordId)||sorted[0]||null;
 const hasValue=(r,n)=>number(r,n)!=="";
 const status=r=>mode==="chain"?(hasValue(r,"xG Chain /90")||hasValue(r,"xG Chain season /90")||(hasValue(r,"xG Chain")&&hasValue(r,"Understat minutes"))?"Con datos":"Incompleto"):
 mode==="buildup"?(hasValue(r,"xG Buildup /90")||hasValue(r,"xG Buildup season /90")||(hasValue(r,"xG Buildup")&&hasValue(r,"Understat minutes"))?"Con datos":"Incompleto"):
 mode==="ground"?(hasValue(r,"Ground duels won")&&hasValue(r,"Ground duels contested")?"Con datos":"Incompleto"):
 mode==="other"?"":hasValue(r,simpleNames[mode]||"",["appearances","minutes","rating"].includes(mode)?mode:null)?"Con datos":"Sin datos";
 useEffect(()=>{setRecordId("");setError("");},[mode]);
 useEffect(()=>{
  if(!selected)return;
  setForm({
   value:mode==="chain"||mode==="buildup"?number(selected,(mode==="chain"?"xG Chain":"xG Buildup")+" season /90"):
    mode==="other"?number(selected,storedName):number(selected,simpleNames[mode]||"",["appearances","minutes","rating"].includes(mode)?mode:null),
   sourceMinutes:number(selected,"Understat minutes"),
   won:number(selected,"Ground duels won"),
   contested:number(selected,"Ground duels contested"),
   unit:"per90",scope:"season",name:mode==="other"?baseName:""
  });
  setError("");
 },[selected?.id,mode,storedName]);
 if(!mode)return null;
 const label=MANUAL_CARD_TITLES[mode]||"Estadística histórica";
 const set=(key,value)=>setForm(prev=>({...prev,[key]:value}));
 const submit=async(e)=>{
  e.preventDefault();
  if(!selected)return;
  setBusy(true);setError("");
  try{
   const payload=mode==="other"&&per90?{...form,name:String(form.name||"").trim().replace(/\s*\/\s*90$/i,"")+" /90"}:form;
   const changes=createOverviewManualChanges(selected,mode,payload,"");
   await onSave(selected,changes);
   onClose();
  }catch(err){setError(err?.message||"No se pudo guardar el dato.");}
  finally{setBusy(false);}
 };
 const valueInput=(title,key,placeholder="0,00",integer=false)=><label className="block text-xs font-semibold text-slate-700">{title}
   <input required inputMode={integer?"numeric":"decimal"} value={form[key]} onChange={e=>set(key,e.target.value)}
    placeholder={placeholder} className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-blue-500 focus:outline-none"/>
 </label>;
 return createPortal(<div className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label={"Añadir o corregir "+label}>
  <form onSubmit={submit} className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-5 shadow-2xl">
   <div className="flex items-start justify-between gap-2">
    <div><h3 className="text-base font-black text-[#123456]">Añadir o editar · {label}</h3>
     <p className="mt-1 text-xs text-slate-500">MF LEGACY · Registro manual con ámbito explícito</p>
    </div><button disabled={busy} onClick={onClose} type="button" aria-label="Cerrar" className="rounded p-2 hover:bg-slate-100"><X size={18}/></button>
   </div>
   {selected?<label className="block text-xs font-semibold text-slate-700">Temporada y registro de referencia
    <select value={selected.id} disabled={busy} onChange={e=>setRecordId(e.target.value)}
     className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm">
     {sorted.map((r,i)=><option key={r.id} value={r.id}>{r.season} · {r.competition} · {r.team_name||"Club no indicado"} · {status(r)}{sorted.some((x,j)=>j!==i&&x.season===r.season&&x.competition===r.competition)?" · "+String(r.external_record_id||r.id).slice(-9):""}</option>)}
    </select>
   </label>:<p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">No hay competiciones con registros guardados en estos filtros. Cambia la temporada o el ámbito para introducir datos.</p>}
   {selected&&<div className="space-y-3">
     {mode==="rating"&&<p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">Introduce la nota media de FotMob entre 0 y 10 para la competición elegida, no su percentil. El Composite calculará automáticamente el percentil histórico a partir de las notas de los jugadores comparables. La media de temporada se pondera con los partidos de cada competición.</p>}
     <p className="text-[11px] font-medium text-blue-800">Registro seleccionado: {status(selected)}. Los datos globales se identifican como temporada completa.</p>
     {(mode==="chain"||mode==="buildup")&&<>
       <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">Puedes introducir directamente el dato por 90 minutos. No se necesitan minutos para guardar una tasa ya calculada. El dato de temporada completa no se atribuye a Liga ni Champions.</p>
       <label className="block text-xs font-semibold text-slate-700">Ámbito del dato
        <select value={form.scope} onChange={e=>setForm(p=>({...p,scope:e.target.value,unit:e.target.value==="season"?"per90":p.unit,value:""}))} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm">
         <option value="season">Temporada completa (todas las competiciones)</option>
         <option value="competition">Solo la competición seleccionada</option>
        </select>
       </label>
       <label className="block text-xs font-semibold text-slate-700">Dato que tienes
        <select value={form.unit} onChange={e=>setForm(p=>({...p,unit:e.target.value,value:""}))} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm">
         <option value="per90">Valor por 90 minutos</option>
         {form.scope==="competition"&&<option value="total">Total de la competición</option>}
        </select>
       </label>
       {valueInput(form.unit==="per90"?"Valor /90":"Valor total","value","1,25")}
       {form.unit==="total"&&valueInput("Minutos Understat (misma fuente)","sourceMinutes","2700",true)}
     </>}
     {mode==="ground"&&<>
       <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">Para calcular un porcentaje fiable necesitamos los duelos terrestres ganados y disputados. No se puede completar a partir de un porcentaje aislado.</p>
       <div className="grid grid-cols-2 gap-3">
        {valueInput("Duelos terrestres ganados","won","35",true)}
        {valueInput("Duelos terrestres disputados","contested","70",true)}
       </div>
       {Number(form.contested.replace(",","."))>0&&<p className="text-xs font-bold text-blue-900">Porcentaje calculado: {(100*Number(form.won.replace(",","."))/Number(form.contested.replace(",","."))).toLocaleString("es-ES",{maximumFractionDigits:2})} %</p>}
     </>}
     {mode==="other"&&<>
       <p className="rounded-lg bg-blue-50 p-3 text-xs text-blue-900">{per90?"Introduce el valor por 90 minutos de esta competición, el mismo que aparece en «Tu valor (temporada)». Se guardará como estadística de origen y el Composite lo recalculará con los minutos disponibles.":"Estás editando el valor de origen de esta competición. Para métricas /90, introduce el TOTAL de la competición si el registro guarda un total; el Composite calculará automáticamente la cifra por 90 con los minutos disponibles."} Comprueba que la competición y los minutos sean correctos.</p>
       <label className="block text-xs font-semibold text-slate-700">Nombre de la métrica
        <input value={form.name} required maxLength={100} onChange={e=>set("name",e.target.value)} placeholder="Ej.: Big chances created" className="mt-1 w-full rounded-lg border border-slate-200 p-3 text-sm"/>
       </label>
       {valueInput(per90?"Valor por 90 minutos":"Valor","value")}
     </>}
     {["goals","assists","xg","xa","shots","appearances","minutes","rating"].includes(mode)&&valueInput(mode==="rating"?"Nota media FotMob (0–10)":"Nuevo valor para esta competición","value",mode==="rating"?"7,25":"0,00")}
     <p className="text-[11px] text-slate-500">Se guardarán únicamente las cifras modificadas, con registro del valor anterior y la fecha. No se alteran los demás datos del jugador.</p>
   </div>}
   {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-800">{error}</p>}
   <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
    <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold">Cancelar</button>
    <button type="submit" disabled={busy||!selected} className="rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{busy?"Guardando…":"Guardar estadística"}</button>
   </div>
  </form>
 </div>,document.body);
}