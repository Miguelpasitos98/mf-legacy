import React,{useMemo} from "react";
import {BookOpen,Shield} from "lucide-react";

export function trophyPalmaresClubRows(entries=[]){
 const groups=new Map();
 for(const row of entries){
  if(!["auto_linked","manual_linked"].includes(row?.match_status)||!row.team_id)continue;
  const year=Number(row.calendar_year);
  if(!Number.isInteger(year)||year<1800||year>2100)continue;
  const key=String(row.team_id);
  if(!groups.has(key))groups.set(key,{team_id:key,team_name:row.team_name||"",winner:new Set(),runner_up:new Set(),third:new Set()});
  if(["winner","runner_up","third"].includes(row.rank))groups.get(key)[row.rank].add(year);
 }
 return [...groups.values()].map(group=>({
  team_id:group.team_id,team_name:group.team_name,
  winner:[...group.winner].sort((a,b)=>b-a),runner_up:[...group.runner_up].sort((a,b)=>b-a),third:[...group.third].sort((a,b)=>b-a)
 })).sort((a,b)=>b.winner.length-a.winner.length||b.runner_up.length-a.runner_up.length||a.team_name.localeCompare(b.team_name,"es"));
}

export default function TrophyPalmaresByClub({entries=[],teams=[],loading=false,error=false,variant="full"}){
 const groups=useMemo(()=>trophyPalmaresClubRows(entries),[entries]);
 const teamMap=useMemo(()=>new Map(teams.map(t=>[String(t.id),t])),[teams]);
 if(loading)return <p className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">Cargando palmarés provisional FM24…</p>;
 if(error)return <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700">No se pudo consultar el archivo de palmarés FM24.</p>;
 if(!groups.length)return null;
 const condensed=variant==="compact";
 return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" aria-label="Resultados históricos FM24 por equipo">
  <div className="flex flex-wrap items-center justify-between gap-2">
   <div><h3 className="text-sm font-black text-slate-900">Resultados del archivo FM24 por equipo</h3><p className="mt-0.5 text-[11px] text-slate-500">Años de la captura original; campeones, subcampeones y terceros. Sin contrastar oficialmente.</p></div>
   <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700"><BookOpen size={13}/>{groups.length} clubes vinculados</span>
  </div>
  <div className="space-y-3">
   {(condensed?groups.slice(0,5):groups).map(group=>{
    const team=teamMap.get(group.team_id);
    return <div key={group.team_id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
     <div className="mb-2 flex items-center gap-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">{team?.logo?<img src={team.logo} alt="" loading="lazy" className="h-7 w-7 object-contain"/>:<Shield size={18} className="text-slate-300"/>}</span>
      <strong className="min-w-0 flex-1 truncate text-xs text-slate-800">{team?.name||group.team_name}</strong>
     </div>
     <div className="grid gap-2 md:grid-cols-3">
      {[["winner","Ganador"],["runner_up","Subcampeón"],["third","Tercer puesto"]].map(([key,title])=><div key={key} className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
       <div className="flex justify-between gap-2"><span className="text-[10px] font-bold text-slate-500">{title}</span><span className="text-[11px] font-black tabular-nums text-[#003399]">{group[key].length}</span></div>
       <p className="mt-1 text-[10px] leading-4 text-slate-600">{group[key].length?group[key].join(", "):"—"}</p>
      </div>)}
     </div>
    </div>;
   })}
  </div>
  <p className="text-[10px] text-slate-400">Estos puestos son provisionales y no crean TrophyHonour ni añaden logros oficiales a Players.</p>
 </section>;
}
