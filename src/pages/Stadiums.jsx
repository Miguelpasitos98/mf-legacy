import React,{useMemo,useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {Building2,Search,MapPin,Users,Save,X} from "lucide-react";
import {useTeamsQuery} from "@/hooks/useSharedData";
import {base44} from "@/api/base44Client";
import {normalizeImageUrl} from "@/components/teams/teamUtils";
import {RECORD_KEYS} from "@/api/recordQueries";

const rows=data=>Array.isArray(data)?data:(data?.items||data?.data||data?.entities||[]);
const safe=(v)=>String(v||"").trim();
const digits=(v)=>v===null||v===undefined||v===""?"":String(v);
function toStadiums(teams){
  const map=new Map();
  for(const team of teams){
    const name=safe(team.stadium);
    if(!name)continue;
    const key=safe(team.stadium_id)?("id:"+team.stadium_id):("name:"+name.toLocaleLowerCase("es")+"|"+safe(team.country_id||team.country).toLocaleLowerCase("es"));
    if(!map.has(key))map.set(key,{id:key,name,teams:[],team,city:safe(team.city),country:safe(team.country),competition:safe(team.competition),capacity:team.stadium_capacity,built:team.stadium_built_year,renovated:team.stadium_renovation,pitch:safe(team.pitch_dimensions),interior:safe(team.stadium_interior_url),exterior:safe(team.stadium_exterior_url)});
    const venue=map.get(key);
    venue.teams.push(team);
    if(!venue.interior)venue.interior=safe(team.stadium_interior_url);
    if(!venue.exterior)venue.exterior=safe(team.stadium_exterior_url);
    if(!venue.capacity)venue.capacity=team.stadium_capacity;
  }
  return [...map.values()];
}
const formFor=(stadium)=>({name:stadium?.name||"",capacity:digits(stadium?.capacity),built:digits(stadium?.built),renovated:digits(stadium?.renovated),pitch:stadium?.pitch||"",interior:stadium?.interior||"",exterior:stadium?.exterior||""});
export default function Stadiums(){
  const query=useTeamsQuery(),qc=useQueryClient();
  const [search,setSearch]=useState(""),[city,setCity]=useState(""),[country,setCountry]=useState(""),[capacity,setCapacity]=useState(""),[mode,setMode]=useState("leagues");
  const [selected,setSelected]=useState(null),[form,setForm]=useState(null),[saving,setSaving]=useState(false),[error,setError]=useState("");
  const stadiums=useMemo(()=>toStadiums(rows(query.data)),[query.data]);
  const filtered=useMemo(()=>stadiums.filter(s=>
    (!search||[s.name,...s.teams.map(t=>t.name)].some(v=>v.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))))&&
    (!city||s.city.toLocaleLowerCase("es").includes(city.toLocaleLowerCase("es")))&&
    (!country||s.country.toLocaleLowerCase("es").includes(country.toLocaleLowerCase("es")))&&
    (!capacity||(Number(s.capacity)||0)>=Number(capacity))
  ),[stadiums,search,city,country,capacity]);
  const grouped=useMemo(()=>Object.entries(filtered.reduce((acc,stadium)=>{
    const key=mode==="leagues"?(stadium.competition||"Sin competición"):(stadium.country||"Sin país");
    (acc[key] ||= []).push(stadium);return acc;
  },{})).sort(([a],[b])=>a.localeCompare(b,"es")),[filtered,mode]);
  const open=(stadium)=>{setSelected(stadium);setForm(formFor(stadium));setError("");};
  const save=async(event)=>{
    event.preventDefault();if(!selected||!form||saving)return;
    if(!form.name.trim()){setError("Introduce el nombre del estadio.");return;}
    for(const key of ["capacity","built","renovated"]){
      if(form[key]!==""&&(!Number.isInteger(Number(form[key]))||Number(form[key])<0)){setError("Revisa los valores numéricos.");return;}
    }
    if([form.interior,form.exterior].some(v=>v.trim()&&!/^https?:\/\//i.test(v.trim()))){setError("Las imágenes deben ser URLs http(s).");return;}
    const updates={stadium:form.name.trim(),stadium_capacity:form.capacity===""?null:Number(form.capacity),stadium_built_year:form.built===""?null:Number(form.built),stadium_renovation:form.renovated===""?null:Number(form.renovated),pitch_dimensions:form.pitch.trim(),stadium_interior_url:form.interior.trim(),stadium_exterior_url:form.exterior.trim()};
    setSaving(true);setError("");
    try{
      // Stadium fields belong to the Team entity; update all teams sharing this venue.
      await Promise.all(selected.teams.map(t=>base44.entities.Team.update(t.id,updates)));
      qc.setQueryData(RECORD_KEYS.Team,prev=>{
        if(Array.isArray(prev))return prev.map(t=>selected.teams.some(linked=>linked.id===t.id)?{...t,...updates}:t);
        return prev;
      });
      await qc.invalidateQueries({queryKey:RECORD_KEYS.Team,exact:true});
      setSelected(null);setForm(null);
    }catch(e){setError(e?.message||"No se pudo guardar el estadio. Revisa los equipos vinculados.");}
    finally{setSaving(false);}
  };
  return <main className="min-h-full bg-[#F6F7F9] p-4 md:p-8">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#003399]"><Building2 size={17}/> MF Legacy · Stadiums</div><h1 className="mt-1 text-2xl font-extrabold text-slate-900">Estadios</h1><p className="mt-1 text-sm text-slate-500">Estadios vinculados a los equipos de MF Legacy · {stadiums.length} recintos registrados</p></div>
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1"><button onClick={()=>setMode("countries")} className={"rounded-lg px-4 py-2 text-xs font-bold "+(mode==="countries"?"bg-[#003399] text-white":"text-slate-600")}>Países</button><button onClick={()=>setMode("leagues")} className={"rounded-lg px-4 py-2 text-xs font-bold "+(mode==="leagues"?"bg-[#003399] text-white":"text-slate-600")}>Ligas</button></div>
    </div>
    <div className="mb-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><Search size={15} className="text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Estadio o club" className="h-10 min-w-0 w-full bg-transparent text-xs outline-none"/></label>
      <input value={city} onChange={e=>setCity(e.target.value)} placeholder="Ciudad" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs"/>
      <input value={country} onChange={e=>setCountry(e.target.value)} placeholder="País" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs"/>
      <input type="number" min="0" value={capacity} onChange={e=>setCapacity(e.target.value)} placeholder="Capacidad mínima" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs"/>
    </div>
    {query.isLoading&&!query.data?<p className="p-8 text-center text-slate-500">Cargando estadios…</p>:query.error&&!query.data?<p className="p-8 text-center text-red-700">No se pudieron cargar los equipos.</p>:grouped.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No hay estadios con estos filtros. Puedes registrar un estadio en la ficha de su equipo desde TEAMS.</div>:<div className="space-y-6">{grouped.map(([title,venues])=><section key={title}>
      <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2"><h2 className="text-sm font-extrabold uppercase text-slate-800">{title}</h2><span className="text-xs text-slate-400">{venues.length}</span></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{venues.map(stadium=><button key={stadium.id} type="button" onClick={()=>open(stadium)} className="group relative flex h-56 overflow-hidden rounded-xl border border-slate-200 bg-slate-200 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
        {stadium.interior||stadium.exterior?<img src={normalizeImageUrl(stadium.interior||stadium.exterior)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"/>:<div className="absolute inset-0 flex items-center justify-center bg-slate-100"><Building2 size={54} className="text-slate-300"/></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent"/>
        <div className="relative mt-auto w-full p-4 text-white"><h3 className="text-lg font-extrabold">{stadium.name}</h3><div className="mt-1 flex flex-wrap items-center gap-3 text-[11px]"><span className="inline-flex items-center gap-1"><MapPin size={12}/>{[stadium.city,stadium.country].filter(Boolean).join(", ")||"Sin ubicación"}</span>{stadium.capacity&&<span className="inline-flex items-center gap-1"><Users size={12}/>{Number(stadium.capacity).toLocaleString("es-ES")}</span>}</div><div className="mt-2 flex flex-wrap gap-1">{stadium.teams.map(t=><span key={t.id} className="rounded bg-white/20 px-2 py-1 text-[10px] font-semibold">{t.name}</span>)}</div></div>
      </button>)}</div>
    </section>)}</div>}
    {selected&&form&&<div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-slate-950/65 p-3 sm:p-6" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setSelected(null);}}>
      <section role="dialog" aria-modal="true" aria-labelledby="stadium-editor-heading" className="my-auto w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-2"><div><h2 id="stadium-editor-heading" className="text-lg font-extrabold">Editar estadio</h2><p className="text-xs text-slate-500">Vinculado a: {selected.teams.map(t=>t.name).join(", ")}</p></div><button type="button" disabled={saving} onClick={()=>setSelected(null)} aria-label="Cerrar"><X size={20}/></button></div>
        <form onSubmit={save} className="space-y-3">
          <label className="block text-xs font-semibold">Nombre<input required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"/></label>
          <div className="grid grid-cols-2 gap-3">{[["capacity","Aforo"],["built","Año de construcción"],["renovated","Última reforma"]].map(([key,label])=><label key={key} className="block text-xs font-semibold">{label}<input type="number" min="0" value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"/></label>)}
            <label className="block text-xs font-semibold">Dimensiones del campo<input value={form.pitch} onChange={e=>setForm(f=>({...f,pitch:e.target.value}))} placeholder="105 x 68 m" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"/></label>
          </div>
          {[["interior","URL imagen interior"],["exterior","URL imagen exterior"]].map(([key,label])=><label key={key} className="block text-xs font-semibold">{label}<input value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder="https://..." className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"/></label>)}
          {form.interior&&<img src={normalizeImageUrl(form.interior)} alt="Vista previa del estadio" className="h-32 w-full rounded-lg bg-slate-100 object-cover"/>}
          {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-[11px] text-slate-500">Los cambios se reflejan en los equipos vinculados.</p><button type="submit" disabled={saving} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Save size={14}/>{saving?"Guardando…":"Guardar estadio"}</button></div>
        </form>
      </section>
    </div>}
  </main>;
}
