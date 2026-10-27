import React,{useMemo,useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {Building2,MapPin,Users,Save,X,Pencil,ArrowLeft,LayoutGrid,Image as ImageIcon} from "lucide-react";
import {useTeamsQuery,useCountriesQuery,useLeaguesQuery} from "@/hooks/useSharedData";
import {base44} from "@/api/base44Client";
import {normalizeImageUrl} from "@/components/teams/teamUtils";
import {RECORD_KEYS} from "@/api/recordQueries";

const rows=data=>Array.isArray(data)?data:(data?.items||data?.data||data?.entities||[]);
const safe=(v)=>String(v||"").trim();
const digits=(v)=>v===null||v===undefined||v===""?"":String(v);
const COLOR_GROUPS=["Azul","Rojo","Blanco","Negro","Verde","Amarillo","Naranja","Morado","Gris","Multicolor"];
const COLOR_HEX={Azul:"#1a3a6e",Rojo:"#a50044",Blanco:"#e8e8e8",Negro:"#1a1a1a",Verde:"#1e7a3a",Amarillo:"#c9a227",Naranja:"#cc5500",Morado:"#5b2c87",Gris:"#555555",Multicolor:"#2c3e50"};
function stadiumColor(team){
  const hex=safe(team.primary_color||team.primaryColor);
  if(!/^#[a-f\d]{6}$/i.test(hex))return "Multicolor";
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
  const max=Math.max(r,g,b),min=Math.min(r,g,b),range=max-min;
  if(max<52)return "Negro";
  if(min>215&&range<35)return "Blanco";
  if(range<36)return "Gris";
  if(r>155&&g<r*.69&&b<r*.75)return "Rojo";
  if(r>165&&g>95&&g<195&&b<90)return "Naranja";
  if(r>155&&g>140&&b<125)return "Amarillo";
  if(g>r*1.18&&g>b*1.05)return "Verde";
  if(b>r*1.15&&b>g*1.08)return "Azul";
  if(r>95&&b>r*.6&&g<r*.8)return "Morado";
  return "Multicolor";
}
function StadiumCard({stadium,view,onClick}){
  const photo=normalizeImageUrl(stadium.interior||stadium.exterior);
  return <button type="button" onClick={onClick} className={"group relative block w-full overflow-hidden rounded-xl bg-slate-900 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg "+(view==="gallery"?"aspect-[4/3]":"aspect-[16/9]")}>
    {photo?<img src={photo} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover"/>:<div className="absolute inset-0 flex items-center justify-center bg-slate-200"><Building2 size={42} className="text-slate-400"/></div>}
    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/15 to-transparent"/>
    <div className={"absolute inset-x-0 bottom-0 text-white "+(view==="gallery"?"p-2.5":"p-3.5")}>
      <h3 className={"font-black leading-tight drop-shadow-sm "+(view==="gallery"?"truncate text-xs":"text-base")}>{stadium.name}</h3>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-[10px]"><span className="inline-flex items-center gap-1"><MapPin size={11}/>{[stadium.city,stadium.country].filter(Boolean).join(", ")||"Sin ubicación"}</span>{stadium.capacity&&<span className="inline-flex items-center gap-1"><Users size={11}/>{Number(stadium.capacity).toLocaleString("es-ES")}</span>}</p>
      <div className="mt-1.5 flex flex-wrap gap-1">{stadium.teams.map(t=><span key={t.id} className="inline-flex max-w-full items-center gap-1 rounded bg-white/20 px-2 py-0.5 text-[10px] font-bold leading-[14px]">{(t.logo||t.logo_url)&&<img src={normalizeImageUrl(t.logo||t.logo_url)} alt="" loading="lazy" className="h-[12px] w-[12px] shrink-0 object-contain"/>}<span className="min-w-0 truncate">{t.name}</span></span>)}</div>
    </div>
  </button>;
}

function toStadiums(teams,countries,leagues){
  const countryMap=new Map(countries.map(c=>[String(c.id),c]));
  const leagueMap=new Map(leagues.map(l=>[String(l.id),l]));
  const map=new Map();
  for(const team of teams){
    const name=safe(team.stadium);
    if(!name)continue;
    const key=safe(team.stadium_id)?("id:"+team.stadium_id):("name:"+name.toLocaleLowerCase("es")+"|"+safe(team.country_id||team.country).toLocaleLowerCase("es"));
    const league=leagueMap.get(String(team.league_id||team.leagueId||""));
    const country=countryMap.get(String(team.country_id||team.countryId||league?.country_id||""));
    const countryName=safe(team.country||team.country_name||team.countryName||country?.name);
    const competitionName=safe(league?.name||team.competition);
    if(!map.has(key))map.set(key,{id:key,name,teams:[],team,city:safe(team.city),country:countryName,competition:competitionName,capacity:team.stadium_capacity,built:team.stadium_built_year,renovated:team.stadium_renovation,pitch:safe(team.pitch_dimensions),interior:safe(team.stadium_interior_url),exterior:safe(team.stadium_exterior_url),description:safe(team.stadium_description)});
    const venue=map.get(key);
    venue.teams.push(team);
    if(!venue.country&&countryName)venue.country=countryName;
    if(!venue.competition&&competitionName)venue.competition=competitionName;
    if(!venue.description)venue.description=safe(team.stadium_description);
    if(!venue.interior)venue.interior=safe(team.stadium_interior_url);
    if(!venue.exterior)venue.exterior=safe(team.stadium_exterior_url);
    if(!venue.capacity)venue.capacity=team.stadium_capacity;
  }
  return [...map.values()];
}
const formFor=(stadium)=>({name:stadium?.name||"",capacity:digits(stadium?.capacity),built:digits(stadium?.built),renovated:digits(stadium?.renovated),pitch:stadium?.pitch||"",interior:stadium?.interior||"",exterior:stadium?.exterior||"",description:stadium?.description||""});
export default function Stadiums(){
  const query=useTeamsQuery(),countriesQuery=useCountriesQuery(),leaguesQuery=useLeaguesQuery(),qc=useQueryClient();
  const [search,setSearch]=useState(""),[city,setCity]=useState(""),[country,setCountry]=useState(""),[capacity,setCapacity]=useState(""),[mode,setMode]=useState("leagues");
  const [view,setView]=useState("immersive"),[year,setYear]=useState(""),[color,setColor]=useState("");
  const [detailEdit,setDetailEdit]=useState(false);
  const [selected,setSelected]=useState(null),[form,setForm]=useState(null),[saving,setSaving]=useState(false),[error,setError]=useState("");
  const stadiums=useMemo(()=>toStadiums(rows(query.data),rows(countriesQuery.data),rows(leaguesQuery.data)),[query.data,countriesQuery.data,leaguesQuery.data]);
  const filtered=useMemo(()=>stadiums.filter(s=>
    (mode!=="custom" || s.teams.some(t=>t.is_custom_club===true||t.isCustomClub===true))&&
    (!search||[s.name,...s.teams.map(t=>t.name)].some(v=>v.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))))&&
    (!city||s.city.toLocaleLowerCase("es").includes(city.toLocaleLowerCase("es")))&&
    (!country||s.country.toLocaleLowerCase("es").includes(country.toLocaleLowerCase("es")))&&
    (!capacity||(Number(s.capacity)||0)>=Number(capacity))&&
    (!year||(Number(s.built)||0)>=Number(year))&&
    (!color||s.teams.some(t=>stadiumColor(t)===color))
  ),[stadiums,search,city,country,capacity,year,color,mode]);
  const grouped=useMemo(()=>Object.entries(filtered.reduce((acc,stadium)=>{
    const key=mode==="colors"?(stadium.teams.length?stadiumColor(stadium.teams[0]):"Multicolor"):mode==="leagues"?(stadium.competition||"Sin competición"):(stadium.country||"Sin país");
    (acc[key] ||= []).push(stadium);return acc;
  },{})).sort(([a],[b])=>a.localeCompare(b,"es")),[filtered,mode]);
  const open=(stadium)=>{setSelected(stadium);setForm(formFor(stadium));setDetailEdit(false);setError("");};
  const save=async(event)=>{
    event.preventDefault();if(!selected||!form||saving)return;
    if(!form.name.trim()){setError("Introduce el nombre del estadio.");return;}
    for(const key of ["capacity","built","renovated"]){
      if(form[key]!==""&&(!Number.isInteger(Number(form[key]))||Number(form[key])<0)){setError("Revisa los valores numéricos.");return;}
    }
    if([form.interior,form.exterior].some(v=>v.trim()&&!/^https?:\/\//i.test(v.trim()))){setError("Las imágenes deben ser URLs http(s).");return;}
    const updates={stadium:form.name.trim(),stadium_capacity:form.capacity===""?null:Number(form.capacity),stadium_built_year:form.built===""?null:Number(form.built),stadium_renovation:form.renovated===""?null:Number(form.renovated),pitch_dimensions:form.pitch.trim(),stadium_interior_url:form.interior.trim(),stadium_exterior_url:form.exterior.trim(),stadium_description:form.description.trim()};
    setSaving(true);setError("");
    try{
      // Stadium fields belong to the Team entity; update all teams sharing this venue.
      await Promise.all(selected.teams.map(t=>base44.entities.Team.update(t.id,updates)));
      qc.setQueryData(RECORD_KEYS.Team,prev=>{
        if(Array.isArray(prev))return prev.map(t=>selected.teams.some(linked=>linked.id===t.id)?{...t,...updates}:t);
        return prev;
      });
      await qc.invalidateQueries({queryKey:RECORD_KEYS.Team,exact:true});
      setSelected(null);setForm(null);setDetailEdit(false);
    }catch(e){setError(e?.message||"No se pudo guardar el estadio. Revisa los equipos vinculados.");}
    finally{setSaving(false);}
  };
  return <main className="min-h-full bg-[#F6F7F9] p-4 md:p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-lg font-black uppercase text-slate-900">ESTADIOS</h1>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">{[["colors","Colores"],["leagues","Ligas"],["countries","Países"],["custom","Mis clubes"]].map(([id,label])=><button key={id} type="button" onClick={()=>setMode(id)} className={"px-3 py-2 text-xs font-bold transition "+(mode===id?"bg-[#003399] text-white":"text-slate-600 hover:bg-slate-50")}>{label}</button>)}</div>
        <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white"><button type="button" onClick={()=>setView("gallery")} className={"inline-flex items-center gap-1 px-3 py-2 text-xs font-bold "+(view==="gallery"?"bg-[#003399] text-white":"text-slate-600")}><LayoutGrid size={13}/>Galería</button><button type="button" onClick={()=>setView("immersive")} className={"inline-flex items-center gap-1 px-3 py-2 text-xs font-bold "+(view==="immersive"?"bg-[#003399] text-white":"text-slate-600")}><ImageIcon size={13}/>Inmersiva</button></div>
      </div>
    </div>
    <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nombre o club" className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs"/>
      <input value={city} onChange={e=>setCity(e.target.value)} placeholder="Ciudad" className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs"/>
      <input value={country} onChange={e=>setCountry(e.target.value)} placeholder="País" className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs"/>
      <select value={color} onChange={e=>setColor(e.target.value)} className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="">Todos los colores</option>{COLOR_GROUPS.map(c=><option key={c} value={c}>{c}</option>)}</select>
      <input type="number" min="0" value={capacity} onChange={e=>setCapacity(e.target.value)} placeholder="Cap. mín." className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs"/>
      <input type="number" min="0" value={year} onChange={e=>setYear(e.target.value)} placeholder="Año desde" className="h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs"/>
    </div>
    {query.isLoading&&!query.data?<p className="p-8 text-center text-slate-500">Cargando estadios…</p>:query.error&&!query.data?<p className="p-8 text-center text-red-700">No se pudieron cargar los equipos.</p>:grouped.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No hay estadios con estos filtros. Puedes registrar un estadio en la ficha de su equipo desde TEAMS.</div>:<div className="space-y-7">{grouped.map(([title,venues])=><section key={title}>
      <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2" style={mode==="colors"?{background:COLOR_HEX[title]||"#64748b",color: ["Blanco","Amarillo"].includes(title)?"#111827":"#FFFFFF"}:{background:"#FFFFFF",color:"#1e293b"}}>
        <h2 className="text-xs font-black uppercase tracking-wide">{title}</h2><span className="text-xs opacity-65">{venues.length}</span>
      </div>
      <div className={view==="gallery"?"grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5":"grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"}>{venues.map(stadium=><StadiumCard key={stadium.id} stadium={stadium} view={view} onClick={()=>open(stadium)}/>)}</div>
    </section>)}</div>}
    {selected&&form&&<div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/70 p-3 sm:p-6" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setSelected(null);}}>
      <section role="dialog" aria-modal="true" aria-labelledby="stadium-detail-title" className="relative mx-auto my-2 w-full max-w-5xl rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-3 backdrop-blur-sm sm:px-8">
          <button type="button" onClick={()=>detailEdit?setDetailEdit(false):setSelected(null)} disabled={saving} className="inline-flex items-center gap-2 text-xs font-bold text-slate-600"><ArrowLeft size={15}/>{detailEdit?"Volver a la ficha":"Todos los estadios"}</button>
          <div className="flex items-center gap-2"><button type="button" onClick={()=>{setDetailEdit(v=>!v);setError("");}} className="inline-flex items-center gap-1.5 rounded-lg bg-[#003399] px-3 py-2 text-xs font-bold text-white"><Pencil size={13}/>{detailEdit?"Ver ficha":"Editar estadio"}</button><button type="button" disabled={saving} onClick={()=>setSelected(null)} aria-label="Cerrar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={19}/></button></div>
        </div>
        {!detailEdit?<div className="px-5 pb-10 pt-7 sm:px-10">
          <header className="mb-8 text-center"><p className="text-[11px] font-black uppercase tracking-[.24em] text-[#003399]">MF Legacy · Stadiums</p><h2 id="stadium-detail-title" className="mt-2 text-3xl font-black uppercase tracking-tight text-slate-950 sm:text-5xl">{selected.name}</h2><p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-500"><MapPin size={15}/>{[selected.city,selected.country].filter(Boolean).join(", ")||"Ubicación no registrada"}</p></header>
          <div className="grid gap-4 md:grid-cols-2">{[["interior","Interior"],["exterior","Exterior"]].map(([key,title])=><div key={key} className="min-w-0"><div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-xl bg-slate-50 p-2">{selected[key]?<img src={normalizeImageUrl(selected[key])} alt={title+" de "+selected.name} className="max-h-full max-w-full object-contain"/>:<div className="flex flex-col items-center gap-2 text-slate-400"><Building2 size={33}/><span className="text-xs">Sin fotografía {title.toLowerCase()}</span></div>}</div><p className="mt-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</p></div>)}</div>
          <div className="mt-7 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-4">{[["Capacidad",selected.capacity?Number(selected.capacity).toLocaleString("es-ES"):"Sin datos"],["Ciudad",selected.city||"Sin datos"],["País",selected.country||"Sin datos"],["Construido",selected.built||"Sin datos"],["Última reforma",selected.renovated||"Sin datos"],["Dimensiones",selected.pitch||"Sin datos"],["Competición",selected.competition||"Sin datos"]].map(([label,value])=><div key={label}><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-800">{value}</p></div>)}</div>
          <section className="mt-8"><h3 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900"><Users size={15}/>Clubes asociados</h3><div className="flex flex-wrap gap-3">{selected.teams.map(t=><div key={t.id} className="flex min-w-[130px] flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-4 text-center">{t.logo||t.logo_url?<img src={normalizeImageUrl(t.logo||t.logo_url)} alt="" className="h-12 w-12 object-contain"/>:<Building2 size={36} className="text-slate-300"/>}<span className="text-xs font-bold text-slate-800">{t.name}</span></div>)}</div></section>
          <section className="mt-8 border-t border-slate-100 pt-7"><h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-900">Historia y descripción</h3>{selected.description?<p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{selected.description}</p>:<div className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">Todavía no hay descripción de este estadio. <button type="button" onClick={()=>setDetailEdit(true)} className="font-bold text-[#003399]">Añadir descripción</button></div>}</section>
        </div>:<form onSubmit={save} className="mx-auto max-w-2xl space-y-4 px-5 py-7 sm:px-8"><h2 id="stadium-detail-title" className="text-xl font-black">Editar estadio</h2><p className="text-xs text-slate-500">Vinculado a: {selected.teams.map(t=>t.name).join(", ")}</p>
          <label className="block text-xs font-semibold">Nombre<input required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"/></label>
          <div className="grid grid-cols-2 gap-3">{[["capacity","Aforo"],["built","Año de construcción"],["renovated","Última reforma"]].map(([key,label])=><label key={key} className="block text-xs font-semibold">{label}<input type="number" min="0" value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"/></label>)}<label className="block text-xs font-semibold">Dimensiones del campo<input value={form.pitch} onChange={e=>setForm(f=>({...f,pitch:e.target.value}))} placeholder="105 x 68 m" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"/></label></div>
          {[["interior","URL imagen interior"],["exterior","URL imagen exterior"]].map(([key,label])=><label key={key} className="block text-xs font-semibold">{label}<input value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} placeholder="https://..." className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3"/></label>)}
          <label className="block text-xs font-semibold">Historia y descripción<textarea rows={6} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Historia, arquitectura, curiosidades y características del estadio…" className="mt-1 w-full resize-y rounded-lg border border-slate-200 p-3 text-sm leading-relaxed"/></label>
          {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}<div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" disabled={saving} onClick={()=>setDetailEdit(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold">Cancelar</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Save size={14}/>{saving?"Guardando…":"Guardar estadio"}</button></div>
        </form>}
      </section>
    </div>}
  </main>;
}
