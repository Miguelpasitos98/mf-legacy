import React,{useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {base44} from "@/api/base44Client";
import {UserRoundCog,ArrowUpRight} from "lucide-react";
import ManagerPortrait from "./ManagerPortrait";

export default function SquadManagerBadge({teamId,season}){
 const [data,setData]=useState(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{
  let active=true;setData(null);setError("");setLoading(true);
  (async()=>{
   try{
    const result=await base44.entities.TeamManagerAssignment.filter({team_type:"club",team_id:String(teamId),season},undefined,100,0);
    const rows=Array.isArray(result)?result:result?.data||[];
    const assignment=rows.find(a=>a.is_primary!==false);
    if(!assignment){if(active)setData(null);return;}
    const [manager,profile]=await Promise.all([
      base44.entities.Manager.get(assignment.manager_id),
      assignment.tactical_profile_id?base44.entities.ManagerTacticalProfile.get(assignment.tactical_profile_id):Promise.resolve(null)
    ]);
    if(active)setData({assignment,manager,profile});
   }catch(e){if(active)setError(String(e.message||e))}
   finally{if(active)setLoading(false)}
  })();
  return()=>{active=false;};
 },[teamId,season]);
 if(loading)return null;
 if(error)return <div className="text-xs text-amber-800 bg-amber-50 px-3 py-2 mb-2 rounded-lg">No se pudo consultar el entrenador asignado. <Link className="underline" to="/managers">Abrir MANAGERS</Link></div>;
 if(!data)return <Link to="/managers" className="flex items-center gap-2 mb-2 bg-slate-50 border border-dashed rounded-xl px-3 py-2 text-sm text-slate-600 hover:text-[#003399]"><UserRoundCog size={17}/> Sin entrenador asignado para {season}. <strong>Elegir en MANAGERS</strong><ArrowUpRight size={14}/></Link>;
 const {manager,profile}=data;
 return <div className="mb-2 rounded-xl border border-blue-100 bg-blue-50/60 flex flex-wrap items-center gap-3 p-2">
  <ManagerPortrait manager={manager}/>
  <div className="min-w-0 flex-1">
   <p className="text-[10px] text-blue-700 uppercase tracking-wide font-extrabold">Entrenador · {season}</p>
   <p className="font-bold text-sm">{manager?.display_name||manager?.name||"Entrenador no disponible"}</p>
   <p className="text-xs text-slate-500">{profile?profile.name+" · "+profile.formation:"Sin ADN táctico asignado"}</p>
  </div>
  <Link className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-bold text-[#003399]" to={`/managers?manager=${encodeURIComponent(manager?.id||data.assignment.manager_id)}`}>Editar ADN <ArrowUpRight size={14}/></Link>
 </div>;
}
