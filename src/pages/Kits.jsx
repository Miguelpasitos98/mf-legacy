import React,{useMemo,useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {Shirt,Search,Save,ImageOff,ChevronDown,ExternalLink} from "lucide-react";
import {useTeamsQuery} from "@/hooks/useSharedData";
import {base44} from "@/api/base44Client";
import {normalizeImageUrl} from "@/components/teams/teamUtils";

const KIT_FIELDS=[["kit1_photo_url","Primera equipación"],["kit2_photo_url","Segunda equipación"],["kit3_photo_url","Tercera equipación"]];
function KitPicture({url,label,club}){
  const [bad,setBad]=useState(false);
  const src=normalizeImageUrl(url);
  return <div className="flex h-44 items-center justify-center bg-gradient-to-b from-white to-slate-50 p-4 sm:h-52">
    {src&&!bad?<img src={src} alt={label+" de "+club} className="h-full w-full object-contain drop-shadow-sm" loading="lazy" onError={()=>setBad(true)}/>:
      <div className="flex flex-col items-center gap-2 text-slate-400"><ImageOff size={25}/><span className="text-xs">Sin imagen</span></div>}
  </div>;
}
function ClubGallery({team,editing,setEditing,onSaved}){
  const [saving,setSaving]=useState(false),[error,setError]=useState("");
  const fields=KIT_FIELDS.map(([key,label])=>({key,label,url:editing?.id===team.id?(editing.values[key]||""):(team[key]||"")}));
  const editMode=editing?.id===team.id;
  const startEdit=()=>setEditing({id:team.id,values:Object.fromEntries(KIT_FIELDS.map(([key])=>[key,team[key]||""]))});
  const save=async()=>{
    setSaving(true);setError("");
    try{
      const values=Object.fromEntries(KIT_FIELDS.map(([key])=>[key,String(editing.values[key]||"").trim()]));
      for(const value of Object.values(values)){if(value&&!/^(https?:\/\/|\/\/)/i.test(value))throw Error("Las imágenes necesitan una URL http(s) válida.");}
      await base44.entities.Team.update(team.id,values);
      await onSaved();setEditing(null);
    }catch(e){setError(e?.response?.data?.message||e.message||"No se pudieron guardar las camisetas.");}
    finally{setSaving(false);}
  };
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 p-1">
          {team.logo?<img src={normalizeImageUrl(team.logo)} alt="" className="h-full w-full object-contain"/>:<Shirt className="text-slate-300"/>}
        </div>
        <div className="min-w-0"><h2 className="truncate text-base font-extrabold text-slate-900">{team.name}</h2><p className="text-xs text-slate-500">{team.short_name||""} · Club creado por mí</p></div>
      </div>
      <button type="button" onClick={editMode?()=>setEditing(null):startEdit} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#003399] hover:bg-slate-50">{editMode?"Cancelar":"Editar camisetas"}</button>
    </header>
    <div className="grid gap-3 p-4 md:grid-cols-3">
      {fields.map(field=><div key={field.key} className="min-w-0 overflow-hidden rounded-xl border border-slate-200">
        <KitPicture key={field.url} url={field.url} club={team.name} label={field.label}/>
        <div className="border-t border-slate-100 bg-white px-3 py-3"><p className="text-center text-xs font-bold text-slate-700">{field.label}</p>
          {editMode&&<label className="mt-3 block text-xs text-slate-600">URL de imagen
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs" placeholder="https://..." value={field.url} onChange={e=>setEditing(current=>({...current,values:{...current.values,[field.key]:e.target.value}}))}/></label>}
        </div>
      </div>)}
    </div>
    {editMode&&<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
      <p className="text-xs text-slate-500">Actualiza únicamente las camisetas; el escudo y el resto de la ficha permanecen intactos.</p>
      <button type="button" disabled={saving} onClick={save} className="flex items-center gap-2 rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Save size={14}/>{saving?"Guardando…":"Guardar equipaciones"}</button>
    </div>}
    {error&&<p role="alert" className="mx-4 mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
  </article>;
}
export default function Kits(){
  const query=useTeamsQuery(),qc=useQueryClient();
  const [search,setSearch]=useState(""),[editing,setEditing]=useState(null),[sort,setSort]=useState("name");
  const teams=useMemo(()=>{const rows=Array.isArray(query.data)?query.data:(query.data?.items||query.data?.data||query.data?.entities||[]);
    return rows.filter(t=>t.is_custom_club===true).filter(t=>String(t.name||"").toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es")))
      .sort((a,b)=>sort==="name"?String(a.name).localeCompare(String(b.name),"es"):String(b.created_date||"").localeCompare(String(a.created_date||"")));},[query.data,search,sort]);
  const onSaved=async()=>{await qc.invalidateQueries({queryKey:["mf-legacy","Team"]});};
  return <main className="min-h-full bg-[#F6F7F9] p-4 md:p-8">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-2 text-[#003399]"><Shirt size={19}/><span className="text-xs font-black uppercase tracking-widest">MF Legacy · Club design</span></div><h1 className="text-2xl font-extrabold text-slate-900">Galería de equipaciones</h1><p className="mt-1 text-sm text-slate-500">Las camisetas de tus clubes personalizados. Gestiona sus diseños sin salir de esta página.</p></div>
      <div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><Search size={16} className="text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar club..." className="h-10 w-44 bg-transparent text-sm outline-none"/></label><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><ChevronDown size={14}/><select value={sort} onChange={e=>setSort(e.target.value)} className="h-10 bg-transparent text-xs outline-none"><option value="name">Alfabético</option><option value="recent">Más recientes</option></select></label></div>
    </div>
    {query.isLoading&&!query.data?<p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">Cargando clubes...</p>:query.error&&!query.data?<p className="rounded-xl bg-red-50 p-6 text-sm text-red-700">No se pudieron cargar los clubes. No se ha borrado ningún dato.</p>:teams.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><Shirt className="mx-auto mb-3 text-slate-300" size={34}/><h2 className="font-semibold text-slate-800">{search?"No hay coincidencias":"Todavía no hay clubes personalizados"}</h2><p className="mt-2 text-sm text-slate-500">En TEAMS, edita un club y marca «Es un club ficticio o creado por mí».</p><a href="/teams" className="mt-4 inline-block rounded-lg bg-[#003399] px-4 py-2 text-sm font-semibold text-white">Ir a TEAMS</a></div>:
      <div className="space-y-5">{teams.map(team=><ClubGallery key={team.id} team={team} editing={editing} setEditing={setEditing} onSaved={onSaved}/>)}</div>}
  </main>;
}

