import React,{useMemo,useState} from "react";
import {useQueryClient} from "@tanstack/react-query";
import {Shirt,Search,Save,ChevronDown,ArrowLeft,LayoutGrid,Focus,Pipette} from "lucide-react";
import {useTeamsQuery} from "@/hooks/useSharedData";
import {base44} from "@/api/base44Client";
import {normalizeImageUrl} from "@/components/teams/teamUtils";
import {RECORD_KEYS} from "@/api/recordQueries";
import NormalizedKitImage from "@/components/teams/NormalizedKitImage";

const KIT_FIELDS=[["kit3_photo_url","Tercera equipación"],["kit1_photo_url","Primera equipación"],["kit2_photo_url","Segunda equipación"]];
const validKitHex = (value) => /^#[0-9a-f]{6}$/i.test(String(value || ""));
function kitTagStyle(team,key){
  const index=key.match(/^kit([123])_/)?.[1] || "1";
  const providedBg=team["kit"+index+"_badge_bg"];
  const providedText=team["kit"+index+"_badge_text"];
  const bg=validKitHex(providedBg)?providedBg:(validKitHex(team.primary_color)?team.primary_color:"#133572");
  const rgb=[1,3,5].map(i=>parseInt(bg.slice(i,i+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  const luminance=rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
  const fallback=luminance>0.28?"#111827":"#FFFFFF";
  const textColor=validKitHex(providedText)?providedText:validKitHex(team.secondary_color)?team.secondary_color:fallback;
  return {backgroundColor:bg,color:textColor,borderColor:bg,boxShadow:"0 2px 8px "+bg+"22"};
}
function KitTag({team,kitKey,label,small=false}){
  return <span className={small?"inline-flex max-w-full items-center justify-center rounded-md border px-2 py-1 text-center text-[9px] font-extrabold uppercase leading-tight tracking-wide":"inline-flex max-w-full items-center justify-center rounded-lg border px-3 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-wider sm:text-xs"} style={kitTagStyle(team,kitKey)}>{label}</span>;
}
function ColorEditor({label,value,onChange,onPick}){
  const hex=validKitHex(value)?value:"#FFFFFF";
  return <div className="min-w-0">
    <span className="mb-1 block text-[11px] font-semibold text-slate-600">{label}</span>
    <div className="flex items-center gap-1.5">
      <input aria-label={"Selector de "+label} type="color" value={hex} onChange={event=>onChange(event.target.value.toUpperCase())} className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"/>
      <input aria-label={"Código HEX de "+label} type="text" maxLength={7} value={value} placeholder="#FFFFFF" onChange={event=>onChange(event.target.value.toUpperCase())} className="h-9 w-full min-w-0 rounded-lg border border-slate-200 px-2 text-xs"/>
      <button type="button" title={"Cuentagotas: "+label} aria-label={"Tomar "+label+" de pantalla"} onClick={onPick} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"><Pipette size={15}/></button>
    </div>
  </div>;
}
function KitPicture({url,label,club}){
  const src=normalizeImageUrl(url);
  return <div className="flex h-52 items-center justify-center bg-gradient-to-b from-white to-slate-50 p-4 sm:h-64">
    <NormalizedKitImage url={src} alt={label+" de "+club} className="drop-shadow-sm"/>
  </div>;
}
function EditorialClub({team,onOpen}){
  const primary=/^#[0-9a-f]{6}$/i.test(team.primary_color||"")?team.primary_color:"#15294a";
  const images=KIT_FIELDS.map(([key,label])=>({key,label,src:normalizeImageUrl(team[key])}));
  return <button type="button" onClick={()=>onOpen(team.id)} className="group relative w-full overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-slate-300 hover:shadow-xl">
    <div className="relative isolate overflow-hidden px-4 pb-6 pt-5 sm:px-8" style={{background:`linear-gradient(150deg, ${primary}17, #ffffff 55%, ${primary}20)`}}>
      <div className="absolute -right-16 -top-28 h-80 w-80 rounded-full border-[65px] opacity-10" style={{borderColor:primary}} aria-hidden="true"/>
      <div className="relative mb-4 flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/90 p-2 shadow-sm">{team.logo?<img src={normalizeImageUrl(team.logo)} alt="" className="h-full w-full object-contain"/>:<Shirt className="text-slate-300"/>}</div>
        <div className="min-w-0 flex-1"><h2 className="truncate text-lg font-black text-slate-900">{team.name}</h2><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Colección de equipaciones</p></div>
        <span className="hidden rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 sm:block">Ver colección</span>
      </div>
      <div className="relative grid grid-cols-3 items-end gap-1 sm:gap-4">
        {images.map(({key,label,src})=><div key={key} className={`flex min-w-0 flex-col items-center ${key==="kit1_photo_url"?"relative z-10":"opacity-90"}`}>
          <div className={`flex w-full items-center justify-center ${key==="kit1_photo_url"?"h-64 sm:h-80":"h-52 sm:h-64"}`}>
            <NormalizedKitImage url={src} alt={label+" de "+team.name} className="drop-shadow-xl transition-transform duration-300 group-hover:scale-[1.03]"/>
          </div>
          <div className="mt-3 flex w-full justify-center"><KitTag team={team} kitKey={key} label={label}/></div>
        </div>)}
      </div>
    </div>
  </button>;
}
function ClubGallery({team,editing,setEditing,onSaved,onBack}){
  const [saving,setSaving]=useState(false),[error,setError]=useState("");
  const fields=KIT_FIELDS.map(([key,label])=>({key,label,url:editing?.id===team.id?(editing.values[key]||""):(team[key]||"")}));
  const editValues=editing?.id===team.id?editing.values:null;
  const updateField=(key,value)=>setEditing(current=>current?.id===team.id?{...current,values:{...current.values,[key]:value}}:current);
  const pickColor=async(key)=>{
    if(typeof window.EyeDropper!=="function"){setError("El cuentagotas de pantalla necesita un navegador compatible (Chrome o Edge). Puedes usar el selector de color.");return;}
    try{const picked=await new window.EyeDropper().open();if(picked?.sRGBHex)updateField(key,picked.sRGBHex.toUpperCase());}
    catch(err){if(err?.name!=="AbortError")setError("No se pudo capturar el color. Usa el selector de color.");}
  };
  const editMode=editing?.id===team.id;
  const startEdit=()=>setEditing({id:team.id,values:Object.fromEntries(KIT_FIELDS.flatMap(([key])=>{
    const n=key.match(/^kit([123])_/)[1];
    const bg="kit"+n+"_badge_bg",text="kit"+n+"_badge_text";
    return [[key,team[key]||""],[bg,team[bg]||team.primary_color||"#133572"],[text,team[text]||team.secondary_color||"#FFFFFF"]];
  }))});
  const save=async()=>{
    setSaving(true);setError("");
    try{
      const keys=KIT_FIELDS.flatMap(([key])=>{const n=key.match(/^kit([123])_/)[1];return [key,"kit"+n+"_badge_bg","kit"+n+"_badge_text"];});
      const values=Object.fromEntries(keys.map(key=>[key,String(editing.values[key]||"").trim()]));
      for(const [key,value] of Object.entries(values)){
        if(key.endsWith("_photo_url")&&value&&!/^(https?:\/\/|\/\/)/i.test(value))throw Error("Las imágenes necesitan una URL http(s) válida.");
        if(key.includes("_badge_")&&!validKitHex(value))throw Error("Introduce colores HEX válidos (#RRGGBB) para cada camiseta.");
      }
      await base44.entities.Team.update(team.id,values);
      const persisted=await base44.entities.Team.filter({id:team.id},undefined,1);
      const stored=Array.isArray(persisted)?persisted[0]:(persisted?.items||persisted?.data||persisted?.entities||[])[0];
      if(!stored||Object.keys(values).some(key=>String(stored[key]||"").trim().toUpperCase()!==values[key].toUpperCase())){
        throw Error("Base44 no confirmó que los enlaces se hayan guardado. Mantengo el editor abierto para evitar perderlos.");
      }
      await onSaved(stored);setEditing(null);
    }catch(e){setError(e?.response?.data?.message||e.message||"No se pudieron guardar las camisetas.");}
    finally{setSaving(false);}
  };
  return <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><ArrowLeft size={14}/>Todos los clubes</button>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 p-1">
          {team.logo?<img src={normalizeImageUrl(team.logo)} alt="" className="h-full w-full object-contain"/>:<Shirt className="text-slate-300"/>}
        </div>
        <div className="min-w-0"><h2 className="truncate text-base font-extrabold text-slate-900">{team.name}</h2><p className="text-xs text-slate-500">{team.short_name||""} · Club creado por mí</p></div>
      </div>
      <button type="button" onClick={editMode?()=>setEditing(null):startEdit} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#003399] hover:bg-slate-50">{editMode?"Cancelar":"Editar camisetas"}</button>
    </header>
    <div className="grid items-center gap-3 p-4 md:grid-cols-3">
      {fields.map(field=><div key={field.key} className={`min-w-0 overflow-hidden rounded-xl border ${field.key==="kit1_photo_url"?"border-[#003399]/40 bg-blue-50/50 shadow-md md:z-10":"border-slate-200"}`}>
        <KitPicture key={field.url} url={field.url} club={team.name} label={field.label}/>
        <div className="border-t border-slate-100 bg-white px-3 py-3"><div className="flex justify-center"><KitTag team={editValues?{...team,...editValues}:team} kitKey={field.key} label={field.label}/></div>
          {editMode&&<label className="mt-3 block text-xs text-slate-600">URL de imagen
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2 text-xs" placeholder="https://..." value={field.url} onChange={e=>setEditing(current=>({...current,values:{...current.values,[field.key]:e.target.value}}))}/></label>}
          {editMode&&(()=>{
            const n=field.key.match(/^kit([123])_/)[1];
            const bg="kit"+n+"_badge_bg",text="kit"+n+"_badge_text";
            return <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
              <ColorEditor label="Principal · recuadro" value={editValues?.[bg]||""} onChange={value=>updateField(bg,value)} onPick={()=>pickColor(bg)}/>
              <ColorEditor label="Secundario · texto" value={editValues?.[text]||""} onChange={value=>updateField(text,value)} onPick={()=>pickColor(text)}/>
            </div>;
          })()}
        </div>
      </div>)}
    </div>
    {editMode&&<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
      <p className="text-xs text-slate-500">Actualiza las imágenes y los dos colores de cada camiseta; el resto de la ficha permanece intacto.</p>
      <button type="button" disabled={saving} onClick={save} className="flex items-center gap-2 rounded-lg bg-[#003399] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Save size={14}/>{saving?"Guardando…":"Guardar equipaciones"}</button>
    </div>}
    {error&&<p role="alert" className="mx-4 mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{error}</p>}
  </article>;
}
export default function Kits(){
  const query=useTeamsQuery(),qc=useQueryClient();
  const [search,setSearch]=useState(""),[editing,setEditing]=useState(null),[sort,setSort]=useState("name"),[selectedId,setSelectedId]=useState(null),[view,setView]=useState(()=>{try{return window.localStorage.getItem("mf-legacy-kits-view")==="compact"?"compact":"editorial";}catch{return "editorial";}});
  const teams=useMemo(()=>{const rows=Array.isArray(query.data)?query.data:(query.data?.items||query.data?.data||query.data?.entities||[]);
    return rows.filter(t=>t.is_custom_club===true).filter(t=>String(t.name||"").toLocaleLowerCase("es").includes(search.trim().toLocaleLowerCase("es")))
      .sort((a,b)=>sort==="name"?String(a.name).localeCompare(String(b.name),"es"):String(b.created_date||"").localeCompare(String(a.created_date||"")));},[query.data,search,sort]);
  const selectedTeam=teams.find(team=>team.id===selectedId);
  const changeView=(next)=>{setView(next);setSelectedId(null);setEditing(null);try{window.localStorage.setItem("mf-legacy-kits-view",next);}catch{/* storage opcional */}};
  const onSaved=async(stored)=>{
    qc.setQueryData(RECORD_KEYS.Team,(previous)=>{
      if(Array.isArray(previous))return previous.map(t=>t.id===stored.id?{...t,...stored}:t);
      if(previous&&Array.isArray(previous.items))return {...previous,items:previous.items.map(t=>t.id===stored.id?{...t,...stored}:t)};
      return previous;
    });
    await qc.invalidateQueries({queryKey:RECORD_KEYS.Team,exact:true});
  };
  return <main className="min-h-full bg-[#F6F7F9] p-4 md:p-8">
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-2 text-[#003399]"><Shirt size={19}/><span className="text-xs font-black uppercase tracking-widest">MF Legacy · Club design</span></div><h1 className="text-2xl font-extrabold text-slate-900">Galería de equipaciones</h1><p className="mt-1 text-sm text-slate-500">Las camisetas de tus clubes personalizados. Gestiona sus diseños sin salir de esta página.</p></div>
      <div className="flex flex-wrap gap-2"><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><Search size={16} className="text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar club..." className="h-10 w-44 bg-transparent text-sm outline-none"/></label><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><ChevronDown size={14}/><select value={sort} onChange={e=>setSort(e.target.value)} className="h-10 bg-transparent text-xs outline-none"><option value="name">Alfabético</option><option value="recent">Más recientes</option></select></label></div>
    </div>
    <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Vista de camisetas">
      <button type="button" onClick={()=>changeView("editorial")} aria-pressed={view==="editorial"} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold ${view==="editorial"?"border-[#003399] bg-[#003399] text-white":"border-slate-200 bg-white text-slate-600"}`}><Focus size={16}/>Escaparate</button>
      <button type="button" onClick={()=>changeView("compact")} aria-pressed={view==="compact"} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold ${view==="compact"?"border-[#003399] bg-[#003399] text-white":"border-slate-200 bg-white text-slate-600"}`}><LayoutGrid size={16}/>Vista catálogo</button>
    </div>
    {query.isLoading&&!query.data?<p className="rounded-xl bg-white p-8 text-center text-sm text-slate-500">Cargando clubes...</p>:query.error&&!query.data?<p className="rounded-xl bg-red-50 p-6 text-sm text-red-700">No se pudieron cargar los clubes. No se ha borrado ningún dato.</p>:teams.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><Shirt className="mx-auto mb-3 text-slate-300" size={34}/><h2 className="font-semibold text-slate-800">{search?"No hay coincidencias":"Todavía no hay clubes personalizados"}</h2><p className="mt-2 text-sm text-slate-500">En TEAMS, edita un club y marca «Es un club ficticio o creado por mí».</p><a href="/teams" className="mt-4 inline-block rounded-lg bg-[#003399] px-4 py-2 text-sm font-semibold text-white">Ir a TEAMS</a></div>:
      view==="editorial" && !selectedTeam ? <div className="space-y-6">{teams.map(team=><EditorialClub key={team.id} team={team} onOpen={setSelectedId}/>)}</div> :
      selectedTeam?<ClubGallery key={selectedTeam.id} team={selectedTeam} editing={editing} setEditing={setEditing} onSaved={onSaved} onBack={()=>{setEditing(null);setSelectedId(null);}}/>:
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {teams.map(team=><button key={team.id} type="button" onClick={()=>{setEditing(null);setSelectedId(team.id);}} className="group min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg">
          <div className="flex items-center gap-3 border-b border-slate-100 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-50 p-1">{team.logo?<img src={normalizeImageUrl(team.logo)} alt="" className="h-full w-full object-contain"/>:<Shirt size={22} className="text-slate-300"/>}</div>
            <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-extrabold text-slate-900">{team.name}</h2><p className="text-xs text-slate-500">Ver colección completa</p></div>
            <ChevronDown size={17} className="-rotate-90 text-slate-400"/>
          </div>
          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-2">
            {KIT_FIELDS.map(([key,label])=><div key={key} className="min-w-0 bg-white">
              <div className="flex h-28 items-center justify-center p-1 sm:h-32"><NormalizedKitImage url={team[key]} alt={label}/></div>
              <div className="flex justify-center px-1 pb-2"><KitTag team={team} kitKey={key} label={label.split(" ")[0]} small/></div>
            </div>)}
          </div>
        </button>)}
      </div>}
  </main>;
}

