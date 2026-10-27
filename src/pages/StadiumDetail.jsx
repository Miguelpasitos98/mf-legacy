import React,{useEffect,useMemo,useState} from "react";
import {useLocation,useNavigate,useParams} from "react-router-dom";
import {useQueryClient} from "@tanstack/react-query";
import {ArrowLeft,Building2,MapPin,Users,CalendarDays,Ruler,Pencil,Save,X,ImageOff,BookOpen,Info} from "lucide-react";
import {useTeamsQuery,useCountriesQuery,useLeaguesQuery} from "@/hooks/useSharedData";
import {base44} from "@/api/base44Client";
import {RECORD_KEYS} from "@/api/recordQueries";
import {normalizeImageUrl} from "@/components/teams/teamUtils";
import {rows,toStadiums,digits} from "@/components/stadiums/stadiumData";

const editFields=stadium=>({
  name:stadium.name||"",
  capacity:digits(stadium.capacity),
  built:digits(stadium.built),
  renovated:digits(stadium.renovated),
  pitch:stadium.pitch||"",
  interior:stadium.interior||"",
  exterior:stadium.exterior||"",
  description:stadium.description||"",
});
function PhotoPanel({url,label,name,preview=false}){
  const [broken,setBroken]=useState(false);
  const src=normalizeImageUrl(url);
  useEffect(()=>setBroken(false),[src]);
  return <div className="min-w-0">
    <div className={"flex items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 "+(preview?"aspect-[16/10]":"aspect-[16/10]")}>
      {src&&!broken?<img key={src} src={src} onError={()=>setBroken(true)} alt={label+" del estadio "+name} className="h-full w-full object-contain"/>:
        <div className="flex flex-col items-center gap-2 p-5 text-center text-slate-400">
          <ImageOff size={29} strokeWidth={1.4}/>
          <span className="text-xs">{src?"No se pudo cargar la imagen":"Sin fotografía "+label.toLowerCase()}</span>
        </div>}
    </div>
    <p className="mt-2 text-center text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">{label}</p>
  </div>;
}
function Field({label,children}){
  return <label className="block min-w-0 text-xs font-bold text-slate-600">{label}{children}</label>;
}
function DetailStat({icon:Icon,label,value}){
  return <div className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/75 p-3">
    <div className="rounded-lg bg-white p-2 text-[#003399]"><Icon size={16}/></div>
    <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-extrabold text-slate-800">{value||"Sin datos"}</p></div>
  </div>;
}

export default function StadiumDetail(){
  const {stadiumKey}=useParams(),navigate=useNavigate(),location=useLocation(),qc=useQueryClient();
  const teamsQuery=useTeamsQuery(),countriesQuery=useCountriesQuery(),leaguesQuery=useLeaguesQuery();
  const stadiums=useMemo(()=>toStadiums(rows(teamsQuery.data),rows(countriesQuery.data),rows(leaguesQuery.data)),
    [teamsQuery.data,countriesQuery.data,leaguesQuery.data]);
  const stadium=stadiums.find(item=>item.id===stadiumKey);
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState(null),[saving,setSaving]=useState(false),[error,setError]=useState("");
  useEffect(()=>{
    setEditing(false);setDraft(null);setError("");
    // El contenedor de MF LEGACY tiene scroll propio: abrir siempre la ficha desde arriba.
    const scrollArea=document.querySelector("main.overflow-y-auto");
    if(scrollArea)scrollArea.scrollTop=0;
  },[stadiumKey]);
  const goBack=()=>navigate("/schedule",{state:location.state});
  const beginEdit=()=>{if(!stadium)return;setDraft(editFields(stadium));setEditing(true);setError("");};
  const update=(key,value)=>setDraft(prev=>({...prev,[key]:value}));
  const save=async(event)=>{
    event.preventDefault();
    if(!stadium||!draft||saving)return;
    if(!draft.name.trim()){setError("Introduce un nombre para el estadio.");return;}
    for(const field of ["capacity","built","renovated"]){
      if(draft[field]!==""&&(!Number.isInteger(Number(draft[field]))||Number(draft[field])<0)){
        setError("Aforo y años deben ser números enteros positivos.");return;
      }
    }
    if(["interior","exterior"].some(key=>draft[key].trim()&&!/^https?:\/\//i.test(draft[key].trim()))){
      setError("Las fotografías necesitan enlaces http(s) válidos.");return;
    }
    const updates={
      stadium:draft.name.trim(),
      stadium_capacity:draft.capacity===""?null:Number(draft.capacity),
      stadium_built_year:draft.built===""?null:Number(draft.built),
      stadium_renovation:draft.renovated===""?null:Number(draft.renovated),
      pitch_dimensions:draft.pitch.trim(),
      stadium_interior_url:draft.interior.trim(),
      stadium_exterior_url:draft.exterior.trim(),
      stadium_description:draft.description.trim(),
    };
    setSaving(true);setError("");
    try{
      // Keep the single shared venue's records consistent without touching club details.
      await Promise.all(stadium.teams.map(team=>base44.entities.Team.update(team.id,updates)));
      const patched=current=>{
        if(Array.isArray(current))return current.map(team=>stadium.teams.some(linked=>linked.id===team.id)?{...team,...updates}:team);
        if(Array.isArray(current?.items))return {...current,items:patched(current.items)};
        if(Array.isArray(current?.data))return {...current,data:patched(current.data)};
        if(Array.isArray(current?.entities))return {...current,entities:patched(current.entities)};
        return current;
      };
      const cached=qc.setQueryData(RECORD_KEYS.Team,patched);
      const newStadium=toStadiums(rows(cached),rows(countriesQuery.data),rows(leaguesQuery.data))
        .find(item=>item.teams.some(team=>stadium.teams.some(linked=>linked.id===team.id)));
      setDraft(null);setEditing(false);
      if(newStadium&&newStadium.id!==stadiumKey)navigate("/schedule/stadium/"+encodeURIComponent(newStadium.id),{replace:true,state:location.state});
      await qc.invalidateQueries({queryKey:RECORD_KEYS.Team,exact:true});
    }catch(e){
      setError(e?.response?.data?.message||e?.message||"No se pudieron guardar los datos. Inténtalo de nuevo.");
    }finally{setSaving(false);}
  };

  if(teamsQuery.isLoading&&!teamsQuery.data)return <main className="min-h-full bg-[#F6F7F9] p-8 text-sm text-slate-500">Cargando ficha del estadio…</main>;
  if(teamsQuery.error&&!teamsQuery.data)return <main className="min-h-full bg-[#F6F7F9] p-8 text-sm text-rose-600">No se pudieron cargar los equipos.</main>;
  if(!stadium)return <main className="min-h-full bg-[#F6F7F9] p-8">
    <button type="button" onClick={goBack} className="inline-flex items-center gap-2 text-sm font-bold text-[#003399]"><ArrowLeft size={16}/>Volver a estadios</button>
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">El estadio no está disponible en los registros actuales.</div>
  </main>;
  const name=editing?draft?.name||stadium.name:stadium.name;
  return <main className="min-h-full bg-[#F6F7F9] px-4 pb-14 pt-5 sm:px-7">
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <button type="button" onClick={goBack} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><ArrowLeft size={15}/>Todos los estadios</button>
        {!editing?<button type="button" onClick={beginEdit} className="inline-flex items-center gap-2 rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white hover:bg-[#002477]"><Pencil size={14}/>Editar estadio</button>:
          <button type="button" disabled={saving} onClick={()=>{setEditing(false);setDraft(null);setError("");}} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700"><X size={14}/>Cancelar edición</button>}
      </div>
      <header className="mb-7 text-center">
        <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#003399]">MF Legacy · Stadiums</p>
        <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-slate-950 sm:text-5xl">{name}</h1>
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-500"><MapPin size={14}/>{[stadium.city,stadium.country].filter(Boolean).join(", ")||"Ubicación no registrada"}</p>
      </header>
      {editing?<form onSubmit={save} className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="mb-5 text-base font-black text-slate-900">Información del estadio</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Nombre"><input required value={draft.name} onChange={e=>update("name",e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"/></Field></div>
            {[["capacity","Capacidad"],["built","Año de construcción"],["renovated","Última reforma"]].map(([key,label])=><Field key={key} label={label}><input type="number" min="0" step="1" value={draft[key]} onChange={e=>update(key,e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"/></Field>)}
            <Field label="Dimensiones del campo"><input value={draft.pitch} onChange={e=>update("pitch",e.target.value)} placeholder="105 × 68 m" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"/></Field>
          </div>
          <p className="mt-4 text-xs text-slate-500"><Info size={13} className="mr-1 inline"/>La ciudad, el país y la liga se obtienen del equipo asociado en TEAMS.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="mb-4 text-base font-black text-slate-900">Fotografías</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[["interior","Interior"],["exterior","Exterior"]].map(([key,label])=><div key={key} className="min-w-0">
              <Field label={"URL fotografía "+label.toLowerCase()}><input type="url" value={draft[key]} onChange={e=>update(key,e.target.value)} placeholder="https://..." className="mb-3 mt-1 h-10 w-full min-w-0 rounded-lg border border-slate-200 px-3 text-xs"/></Field>
              <PhotoPanel url={draft[key]} label={label} name={name} preview/>
            </div>)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="mb-3 flex items-center gap-2 text-base font-black"><BookOpen size={18}/>Historia y descripción</h2>
          <textarea value={draft.description} onChange={e=>update("description",e.target.value)} rows={9} placeholder="Escribe la historia, construcción, arquitectura, reformas, ambiente y curiosidades del estadio…" className="w-full resize-y rounded-lg border border-slate-200 px-4 py-3 text-sm leading-7 outline-none focus:border-[#003399]"/>
        </div>
        {error&&<p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button type="button" disabled={saving} onClick={()=>{setEditing(false);setDraft(null);setError("");}} className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold">Cancelar</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#003399] px-5 py-2.5 text-xs font-black text-white disabled:opacity-60"><Save size={15}/>{saving?"Guardando…":"Guardar estadio"}</button>
        </div>
      </form>:<div className="space-y-7">
        <div className="grid gap-4 md:grid-cols-2">
          <PhotoPanel url={stadium.interior} label="Interior" name={name}/>
          <PhotoPanel url={stadium.exterior} label="Exterior" name={name}/>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 text-xs font-black uppercase tracking-wider text-slate-700">Datos del estadio</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailStat icon={Users} label="Capacidad" value={stadium.capacity?Number(stadium.capacity).toLocaleString("es-ES"):""}/>
            <DetailStat icon={MapPin} label="Ciudad" value={stadium.city}/>
            <DetailStat icon={MapPin} label="País" value={stadium.country}/>
            <DetailStat icon={CalendarDays} label="Construido" value={stadium.built}/>
            <DetailStat icon={CalendarDays} label="Última reforma" value={stadium.renovated}/>
            <DetailStat icon={Ruler} label="Dimensiones" value={stadium.pitch}/>
            <DetailStat icon={Building2} label="Competición" value={stadium.competition}/>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900"><Users size={16}/>Clubes asociados</h2>
          <div className="flex flex-wrap gap-3">
            {stadium.teams.map(team=><div key={team.id} className="flex min-w-32 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 p-4">
              {team.logo||team.logo_url?<img src={normalizeImageUrl(team.logo||team.logo_url)} alt="" className="h-14 w-14 object-contain"/>:<Building2 size={33} className="text-slate-300"/>}
              <span className="text-center text-xs font-bold text-slate-800">{team.name}</span>
            </div>)}
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900"><BookOpen size={16}/>Historia y descripción</h2>
          {stadium.description?<p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{stadium.description}</p>:
            <div className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500">Todavía no hay descripción de este estadio. <button type="button" onClick={beginEdit} className="font-bold text-[#003399]">Añadir descripción</button></div>}
        </section>
      </div>}
    </div>
  </main>;
}
