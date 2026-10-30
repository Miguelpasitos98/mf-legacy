import React,{useMemo,useState} from "react";
import {Building2,MapPin,Users,LayoutGrid,Image as ImageIcon} from "lucide-react";
import {useTeamsQuery,useCountriesQuery,useLeaguesQuery} from "@/hooks/useSharedData";
import {normalizeImageUrl} from "@/components/teams/teamUtils";
import {useLocation,useNavigate} from "react-router-dom";
import {rows,safe,toStadiums} from "@/components/stadiums/stadiumData";

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

export default function Stadiums(){
  const query=useTeamsQuery(),countriesQuery=useCountriesQuery(),leaguesQuery=useLeaguesQuery(),navigate=useNavigate(),location=useLocation();
  const returnState=location.state?.stadiumsReturn||{};
  const [search,setSearch]=useState(returnState.search||""),[city,setCity]=useState(returnState.city||""),[country,setCountry]=useState(returnState.country||""),[capacity,setCapacity]=useState(returnState.capacity||""),[mode,setMode]=useState(returnState.mode||"leagues");
  const [view,setView]=useState(returnState.view||"immersive"),[year,setYear]=useState(returnState.year||""),[color,setColor]=useState(returnState.color||"");
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
  const open=(stadium)=>navigate("/schedule/stadium/"+encodeURIComponent(stadium.id),{state:{stadiumsReturn:{search,city,country,capacity,mode,view,year,color}}});
  return <main className="mf-catalog-section min-h-full bg-[#F6F7F9] p-4 md:p-6">
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
  </main>;
}
