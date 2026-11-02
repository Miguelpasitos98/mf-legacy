import React,{useEffect,useMemo,useRef,useState} from "react";
import {Link,useSearchParams} from "react-router-dom";
import {base44} from "@/api/base44Client";
import {Search,Plus,Save,Sparkles,Copy,UserRoundCog,SlidersHorizontal,ShieldCheck,ArrowUpRight,BookOpen} from "lucide-react";
import ManagerPortrait from "@/components/managers/ManagerPortrait";
import {resolveManagerCountry,buildManagerBiographyPrompt,parseBiographyResponse} from "@/components/managers/managerBiography.mjs";
import {buildManagerTacticalPrompt,parseManagerTacticalResponse,previewManagerTacticalDraft} from "@/components/managers/managerTacticalAI.mjs";
import {DNA_AXES,ROLES,MANAGER_BLANK,PROFILE_BLANK,PROFILE_SCOPES,profileScope,profileScopeLabel,cleanManager,cleanProfile,decodeRoleText,validSeason,chooseAssignment,isCustomTeam} from "@/components/managers/managerModel.mjs";

const getRows = async (entity,query={})=>{
 const all=[];
 for(let skip=0;skip<=100000;skip+=200){
  const raw=await entity.filter(query,undefined,200,skip);
  const rows=Array.isArray(raw)?raw:raw?.data||raw?.items||[];
  all.push(...rows);
  if(rows.length<200)return all;
 }
 throw Error("El catálogo supera el límite de carga seguro. No se han modificado datos.");
};
const input="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-[#003399] focus:ring-2 focus:ring-blue-100";
const label="block mb-1 text-[11px] font-bold tracking-wider uppercase text-slate-500";
const primary="inline-flex items-center justify-center gap-2 rounded-lg bg-[#003399] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50";
const normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

export default function Managers(){
 const [params,setParams]=useSearchParams();
 const managerParam=params.get("manager")||"";
 const [managers,setManagers]=useState([]);
 const [profiles,setProfiles]=useState([]);
 const [assignments,setAssignments]=useState([]);
 const [teams,setTeams]=useState([]);
 const [countries,setCountries]=useState([]);
 const [isAdmin,setIsAdmin]=useState(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [search,setSearch]=useState("");
 const [countrySearch,setCountrySearch]=useState("");
 const [generatingBiography,setGeneratingBiography]=useState(false);
 const [showBiographyPrompt,setShowBiographyPrompt]=useState(false);
 const [generatingDNA,setGeneratingDNA]=useState(false);
 const [dnaContext,setDnaContext]=useState("");
 const [showDNAPrompt,setShowDNAPrompt]=useState(false);
 const [dnaJsonInput,setDnaJsonInput]=useState("");
 const [dnaDraftReady,setDnaDraftReady]=useState(false);
 const [scopeSuggestion,setScopeSuggestion]=useState(null);
 const dnaIdentityRef=useRef("");
 const [tab,setTab]=useState("identity");
 const [managerDraft,setManagerDraft]=useState({...MANAGER_BLANK});
 const [profileId,setProfileId]=useState("");
 const [profileDraft,setProfileDraft]=useState({...PROFILE_BLANK});
 const [roleText,setRoleText]=useState({});
 const [assignTeamId,setAssignTeamId]=useState("");
 const [assignSeason,setAssignSeason]=useState("2026/2027");
 const [assignProfile,setAssignProfile]=useState("");
 const newManagerTabRef=useRef("");

 const selected=managers.find(m=>String(m.id)===managerParam)||null;
 const chosenCountry=useMemo(()=>resolveManagerCountry(managerDraft,countries),[managerDraft.country_id,managerDraft.nationality,countries]);
 const sortedCountries=useMemo(()=>countries.filter(c=>c?.id&&c?.name).sort((a,b)=>String(a.name).localeCompare(String(b.name),"es")),[countries]);
 const filteredCountries=useMemo(()=>sortedCountries.filter(c=>!countrySearch||normalize(c.name+" "+(c.code||"")).includes(normalize(countrySearch))||String(c.id)===String(chosenCountry?.id)),[sortedCountries,countrySearch,chosenCountry?.id]);
 const customTeams=useMemo(()=>teams.filter(isCustomTeam).sort((a,b)=>String(a.name).localeCompare(String(b.name))),[teams]);
 const managerProfiles=useMemo(()=>profiles.filter(p=>String(p.manager_id)===String(selected?.id||"")).sort((a,b)=>Number(Boolean(b.is_default))-Number(Boolean(a.is_default))||String(b.season||b.period_start||"").localeCompare(String(a.season||a.period_start||""))),[profiles,selected?.id]);
 const managerAssignments=assignments.filter(a=>String(a.manager_id)===String(selected?.id)&&a.team_type==="club"&&customTeams.some(t=>String(t.id)===String(a.team_id)));
 const visible=useMemo(()=>managers.filter(m=>normalize([m.name,m.display_name,m.nationality,m.manager_kind].join(" ")).includes(normalize(search))).sort((a,b)=>Number(Boolean(b.is_active))-Number(Boolean(a.is_active))||String(a.name).localeCompare(String(b.name))),[managers,search]);

 const refresh=async()=>{
  const [m,p,a,t,c]=await Promise.all([
   getRows(base44.entities.Manager),getRows(base44.entities.ManagerTacticalProfile),
   getRows(base44.entities.TeamManagerAssignment),getRows(base44.entities.Team),getRows(base44.entities.Country)
  ]);
  setManagers(m);setProfiles(p);setAssignments(a);setTeams(t);setCountries(c);
  return {managers:m,profiles:p,assignments:a,teams:t,countries:c};
 };
 useEffect(()=>{
  let live=true;
  Promise.all([
   base44.auth.me().catch(()=>null),
   getRows(base44.entities.Manager),
   getRows(base44.entities.ManagerTacticalProfile),
   getRows(base44.entities.TeamManagerAssignment),
   getRows(base44.entities.Team),getRows(base44.entities.Country)
  ]).then(([me,m,p,a,t,c])=>{
   if(!live)return;
   setIsAdmin(me?.role==="admin");setManagers(m);setProfiles(p);setAssignments(a);setTeams(t);setCountries(c);
   if(!managerParam&&m.length)setParams({manager:String(m[0].id)},{replace:true});
  }).catch(e=>{if(live)setError("Error al cargar Manager DNA: "+String(e.message||e))})
  .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
  // Only run initial load. Selection and edits must not reload the catalog.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 useEffect(()=>{
  setManagerDraft(selected?{...MANAGER_BLANK,...selected}:{...MANAGER_BLANK});
  setProfileId("");setTab(newManagerTabRef.current===String(selected?.id)?"dna":"identity");
  newManagerTabRef.current="";setDnaDraftReady(false);setScopeSuggestion(null);setShowDNAPrompt(false);setDnaJsonInput("");setDnaContext("");setNotice("");setError("");
 },[selected?.id]);
 useEffect(()=>{
  const profilesOfSelected=profiles.filter(p=>String(p.manager_id)===String(selected?.id||""));
  if(profileId==="__new__")return;
  const found=profilesOfSelected.find(p=>String(p.id)===profileId);
  if(found){setProfileDraft({...PROFILE_BLANK,...found});setRoleText(decodeRoleText(found.player_role_priorities));return;}
  const first=profilesOfSelected.find(p=>p.is_default)||profilesOfSelected[0];
  if(first){setProfileId(String(first.id));setProfileDraft({...PROFILE_BLANK,...first});setRoleText(decodeRoleText(first.player_role_priorities));}
  else{setProfileId("");setProfileDraft({...PROFILE_BLANK});setRoleText({});}
 },[selected?.id,profiles,profileId]);
 useEffect(()=>{
  if(!customTeams.some(t=>String(t.id)===assignTeamId))setAssignTeamId(customTeams[0]?.id||"");
 },[customTeams,assignTeamId]);
 useEffect(()=>{
  const linked=chooseAssignment(assignments,assignTeamId,assignSeason);
  if(linked&&String(linked.manager_id)===String(selected?.id)){
   setAssignProfile(linked.tactical_profile_id||"");
  }else setAssignProfile(managerProfiles.find(p=>p.is_default)?.id||managerProfiles[0]?.id||"");
 },[selected?.id,assignTeamId,assignSeason,assignments,profiles]);

 const openNew=()=>{
  setParams({},{replace:false});setTab("identity");setManagerDraft({...MANAGER_BLANK});setProfileId("");setProfileDraft({...PROFILE_BLANK});setRoleText({});
  setNotice("");setError("");
 };
 const openManager=id=>{setParams({manager:String(id)});setError("");setNotice("");};
 const updateManager=(key,value)=>setManagerDraft(prev=>({...prev,[key]:value}));
 const updateProfile=(key,value)=>setProfileDraft(prev=>({...prev,[key]:value}));
 const tacticalPrompt=useMemo(()=>{
   if(!selected)return "";
   try{return buildManagerTacticalPrompt(selected,profileDraft,dnaContext);}
   catch{return "";}
 },[selected,profileDraft.season,profileDraft.profile_scope,profileDraft.period_start,profileDraft.period_end,profileDraft.reference_club,profileDraft.profile_notes,dnaContext]);
 useEffect(()=>{
   dnaIdentityRef.current=String(selected?.id||"")+":"+String(profileId);
 },[selected?.id,profileId]);
 const applyTacticalProposal = (raw,identity)=>{
   const parsed=parseManagerTacticalResponse(raw);
   if(dnaIdentityRef.current!==identity)throw Error("Has cambiado de entrenador o perfil durante el análisis; la propuesta anterior no se aplicó.");
   if((profileId&&profileId!=="__new__")||dnaDraftReady){
     if(!window.confirm("La propuesta reemplazará los parámetros y los perfiles por posición del borrador abierto. El registro guardado no se modificará hasta pulsar Guardar ADN táctico. ¿Continuar?"))return false;
   }
   setProfileDraft(prev=>previewManagerTacticalDraft(prev,parsed));
   setScopeSuggestion(parsed.context);
   setRoleText(parsed.roleText);
   setDnaDraftReady(true);
   const label=parsed.context?.scope==="period"?"Etapa "+parsed.context.period_start+"–"+parsed.context.period_end:
     parsed.context?.scope==="season"?"Temporada "+parsed.context.season:"Filosofía general";
   setNotice("ADN táctico propuesto (confianza "+parsed.confidence+"). Alcance detectado: "+label+". Revisa fechas, nombre y fuentes; NO se ha guardado en Base44.");
   setError("");
   return true;
 };
 const copyTacticalPrompt=async()=>{
   setError("");setNotice("");
   if(!tacticalPrompt){setError("Selecciona un entrenador antes de generar el prompt.");return;}
   try{
     if(!navigator.clipboard?.writeText)throw Error("Copia automática no permitida por el navegador.");
     await navigator.clipboard.writeText(tacticalPrompt);
     setNotice("Prompt de ADN táctico copiado. Puedes enviarlo a ChatGPT y pegar aquí el JSON obtenido.");
   }catch(e){
     setShowDNAPrompt(true);
     setError((e.message||"No se pudo copiar.")+" Selecciona el texto en el cuadro inferior.");
   }
 };
 const generateTacticalDNA=async()=>{
   if(generatingDNA||busy||!canWrite||!selected)return;
   setError("");setNotice("");
   const identity=String(selected.id)+":"+String(profileId);
   if((profileId&&profileId!=="__new__")||dnaDraftReady){
     if(!window.confirm("Se va a preparar un nuevo ADN táctico; al aplicar los resultados reemplazará los controles del borrador actual. ¿Investigar este perfil?"))return;
   }
   setGeneratingDNA(true);
   try{
     const result=await base44.functions.invoke("manager-ai",{
       mode:"tactical",manager_id:String(selected.id),name:selected.name,
       manager_kind:selected.manager_kind,prompt:tacticalPrompt
     });
     if(!result.data?.ok)throw Error(result.data?.error||"El servidor no devolvió un resultado.");
     applyTacticalProposal(result.data.response,identity);
   }catch(e){
     if(dnaIdentityRef.current===identity){
       setShowDNAPrompt(true);
       setError("No se pudo completar la investigación táctica: "+(e.response?.data?.error||e.message||"error de la integración")+". Puedes copiar el prompt y pegar aquí el JSON de ChatGPT.");
     }
   }finally{setGeneratingDNA(false)}
 };
 const applyPastedDNA=()=>{
   if(busy||generatingDNA||!canWrite||!selected)return;
   setError("");setNotice("");
   try{
     const identity=String(selected.id)+":"+String(profileId);
     if(applyTacticalProposal(dnaJsonInput,identity))setDnaJsonInput("");
   }catch(e){setError("El JSON de ADN táctico no es válido: "+(e.message||"Error desconocido"));}
 };
 const biographyPrompt=useMemo(()=>{
   try{return buildManagerBiographyPrompt(managerDraft.name,chosenCountry?.name||managerDraft.nationality);}
   catch{return "";}
 },[managerDraft.name,managerDraft.nationality,chosenCountry?.name]);
 const copyBiographyPrompt=async()=>{
   setError("");setNotice("");
   try{
     if(!biographyPrompt)throw Error("Primero escribe el nombre del entrenador.");
     if(!navigator.clipboard?.writeText)throw Error("El navegador no permite copiar automáticamente.");
     await navigator.clipboard.writeText(biographyPrompt);
     setNotice("Prompt copiado. Puedes pegarlo en ChatGPT y revisar la biografía antes de guardarla.");
   }catch(e){setShowBiographyPrompt(true);setError((e.message||"No se pudo copiar el prompt.")+" Puedes seleccionar el texto en el recuadro inferior.");}
 };
 const generateBiography=async()=>{
   if(generatingBiography||busy||!canWrite)return;
   setError("");setNotice("");
   if(!biographyPrompt){setError("Escribe primero el nombre completo del entrenador.");return;}
   if(managerDraft.biography.trim()&&!window.confirm("Ya existe una descripción. ¿Sustituirla por el nuevo borrador de IA?"))return;
   setGeneratingBiography(true);
   try{
     const result=await base44.functions.invoke("manager-ai",{
       mode:"biography",name:managerDraft.name,manager_kind:managerDraft.manager_kind,
       prompt:biographyPrompt
     });
     if(!result.data?.ok)throw Error(result.data?.error||"El servidor no devolvió un resultado.");
     const generated=parseBiographyResponse(result.data.response);
     setManagerDraft(prev=>({...prev,biography:generated,source_status:prev.source_status==="verified"?"pending":prev.source_status}));
     setNotice("Borrador generado desde el nombre. Revisa hechos, fechas y fuentes antes de pulsar Guardar ficha. Nada se ha guardado automáticamente.");
   }catch(e){
     setShowBiographyPrompt(true);
     setError("No se pudo generar la biografía dentro de Base44: "+(e.response?.data?.error||e.message||"integración no disponible")+". Puedes copiar el prompt y solicitarla en ChatGPT.");
   }finally{setGeneratingBiography(false)}
 };
 const changeCountry = id=>{
   const country=countries.find(c=>String(c.id)===String(id));
   setManagerDraft(prev=>({...prev,country_id:country?.id||"",nationality:country?.name||""}));
 };
 const canWrite=isAdmin===true;
 const saveManager=async event=>{
  event.preventDefault();if(busy||isAdmin!==true)return;
  setBusy(true);setError("");setNotice("");
  try{
   if(managerDraft.nationality&&!chosenCountry)throw Error("Selecciona la nacionalidad desde Countries. El texto antiguo no está vinculado a ningún país.");
   const payload=cleanManager({...managerDraft,country_id:chosenCountry?.id||"",nationality:chosenCountry?.name||managerDraft.nationality});
   if(selected){
    await base44.entities.Manager.update(selected.id,payload);
    await refresh();setNotice("Ficha de entrenador actualizada.");
   }else{
    const match=managers.find(m=>normalize(m.name)===normalize(payload.name)&&m.manager_kind===payload.manager_kind);
    if(match)throw Error("Ya existe un entrenador con ese nombre y tipo en el catálogo.");
    const saved=await base44.entities.Manager.create(payload);
    const result=await refresh();
    if(!result.managers.some(m=>String(m.id)===String(saved.id)))setManagers(prev=>[...prev,saved]);
    newManagerTabRef.current=String(saved.id);
    setParams({manager:String(saved.id)});setNotice("Entrenador creado. Ya puedes configurar su ADN táctico.");
   }
  }catch(e){setError(e.message||"No se pudo guardar el entrenador.")}
  finally{setBusy(false)}
 };
 const archiveManager=async()=>{
  if(!selected||isAdmin!==true||busy)return;
  if(!window.confirm(selected.is_active===false?"¿Reactivar este entrenador?":"¿Archivar este entrenador? Sus perfiles y asignaciones permanecerán intactos."))return;
  setBusy(true);setError("");
  try{
   await base44.entities.Manager.update(selected.id,{is_active:selected.is_active===false});
   await refresh();setNotice(selected.is_active===false?"Entrenador reactivado.":"Entrenador archivado sin borrar su historial.");
  }catch(e){setError(e.message||"No se pudo cambiar el estado.")}
  finally{setBusy(false)}
 };
 const chooseProfile=id=>{
  const found=managerProfiles.find(p=>String(p.id)===String(id));
  setProfileId(found?.id||"__new__");setProfileDraft(found?{...PROFILE_BLANK,...found}:{...PROFILE_BLANK});
  setRoleText(found?decodeRoleText(found.player_role_priorities):{});
  setDnaDraftReady(false);setScopeSuggestion(null);setError("");setNotice("");
 };
 const saveProfile=async event=>{
  event.preventDefault();if(!selected||isAdmin!==true||busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const payload=cleanProfile(profileDraft,selected.id,roleText);
   let savedId=profileId;
   if(profileId && profileId!=="__new__"){
    const existing=managerProfiles.find(p=>String(p.id)===String(profileId));
    if(!existing)throw Error("El perfil no pertenece a este entrenador.");
    await base44.entities.ManagerTacticalProfile.update(profileId,payload);
   }else{
    const created=await base44.entities.ManagerTacticalProfile.create(payload);
    savedId=String(created.id);
   }
   if(payload.is_default){
    const others=managerProfiles.filter(p=>String(p.id)!==String(savedId)&&p.is_default);
    const outcomes=await Promise.allSettled(others.map(p=>base44.entities.ManagerTacticalProfile.update(p.id,{is_default:false})));
    if(outcomes.some(x=>x.status==="rejected"))throw Error("El perfil se guardó, pero no se pudo retirar la marca 'principal' de otro perfil. Revisa la selección antes de continuar.");
   }
   const refreshed=await refresh();
   const current=refreshed.profiles.find(p=>String(p.id)===String(savedId));
   setProfileId(String(savedId));if(current){setProfileDraft({...PROFILE_BLANK,...current});setRoleText(decodeRoleText(current.player_role_priorities));}
   setDnaDraftReady(false);setScopeSuggestion(null);setNotice("ADN táctico guardado. No se han recalculado ni modificado jugadores.");
  }catch(e){setError(e.message||"No se pudo guardar el perfil táctico.")}
  finally{setBusy(false)}
 };
 const saveAssignment=async event=>{
  event.preventDefault();if(!selected||isAdmin!==true||busy)return;
  const team=customTeams.find(t=>String(t.id)===String(assignTeamId));
  if(!team){setError("Selecciona un club personalizado válido.");return;}
  if(!validSeason(assignSeason)){setError("La temporada debe tener formato 2026/2027.");return;}
  if(assignProfile&&!managerProfiles.some(p=>String(p.id)===String(assignProfile))){setError("Ese perfil táctico no pertenece al entrenador.");return;}
  const existing=chooseAssignment(assignments,team.id,assignSeason);
  if(existing&&String(existing.manager_id)===String(selected.id)&&String(existing.tactical_profile_id||"")===String(assignProfile||"")){
   setNotice("La asignación ya está guardada.");return;
  }
  if(existing&&!window.confirm("Este club ya tiene un entrenador principal en esta temporada. ¿Sustituirlo conservando el registro anterior como histórico?"))return;
  setBusy(true);setError("");setNotice("");
  let deactivated=false;
  try{
   if(existing){await base44.entities.TeamManagerAssignment.update(existing.id,{is_primary:false});deactivated=true;}
   try{
    await base44.entities.TeamManagerAssignment.create({
      team_type:"club",team_id:String(team.id),manager_id:String(selected.id),season:assignSeason,
      tactical_profile_id:String(assignProfile||""),assignment_name:"Entrenador principal",is_primary:true
    });
   }catch(e){
    if(deactivated){try{await base44.entities.TeamManagerAssignment.update(existing.id,{is_primary:true});}catch{throw Error("No se creó la nueva asignación y no se pudo restaurar el indicador de entrenador principal. Revisa el historial.");}}
    throw e;
   }
   await refresh();setNotice("Entrenador asignado a "+team.name+" ("+assignSeason+").");
  }catch(e){setError(e.message||"No se pudo vincular el club.")}
  finally{setBusy(false)}
 };

 return <main className="mx-auto max-w-[1650px] px-3 py-4 md:px-6 text-slate-900">
  <div className="rounded-2xl bg-[#091e1b] text-white px-5 py-5 mb-4 flex flex-wrap justify-between items-center gap-3">
   <div><p className="text-xs font-bold uppercase tracking-[.2em] text-lime-300">MF LEGACY · MANAGER DNA</p><h1 className="text-2xl sm:text-3xl font-black mt-1">Base de datos de entrenadores</h1><p className="text-sm text-slate-300 mt-1">Identidad, filosofía y proyectos deportivos de tus clubes personalizados.</p></div>
   <div className="flex gap-3 items-center"><div className="text-center"><strong className="block text-2xl tabular-nums">{managers.length}</strong><span className="text-xs text-slate-300">Entrenadores</span></div><div className="text-center"><strong className="block text-2xl tabular-nums">{profiles.length}</strong><span className="text-xs text-slate-300">ADN tácticos</span></div></div>
  </div>
  {error&&<div role="alert" className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">{error}</div>}
  {notice&&<div role="status" className="mb-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
  {isAdmin===false&&<p className="rounded-lg border p-3 mb-3 text-sm">La base de entrenadores es visible en modo consulta. Las ediciones están reservadas a administradores.</p>}
  <div className="grid grid-cols-1 lg:grid-cols-[270px_minmax(0,1fr)] gap-4 min-w-0">
   <aside className="border rounded-2xl bg-white p-3 lg:self-start min-w-0">
    <div className="flex items-center justify-between mb-3"><h2 className="font-extrabold">Entrenadores</h2><button type="button" onClick={openNew} disabled={!canWrite||busy} className="rounded-lg bg-lime-400 p-2 text-slate-900 disabled:opacity-50" aria-label="Crear entrenador"><Plus size={18}/></button></div>
    <div className="relative"><Search size={17} className="absolute top-2.5 left-3 text-slate-400"/><input className={input+" pl-9"} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar entrenador..." aria-label="Buscar entrenadores"/></div>
    <div className="mt-3 max-h-[min(70vh,740px)] overflow-y-auto space-y-1">
     {loading?<p className="text-sm text-slate-500 p-3">Cargando catálogo…</p>:visible.length===0?<p className="text-sm text-slate-500 p-3">No hay entrenadores. Crea el primero desde el botón +.</p>:visible.map(m=><button key={m.id} type="button" onClick={()=>openManager(m.id)} className={`w-full flex items-center gap-3 text-left p-2 rounded-xl hover:bg-slate-100 ${selected?.id===m.id?"bg-blue-50 ring-1 ring-blue-200":""}`}>
      <ManagerPortrait manager={m}/>
      <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{m.display_name||m.name}</strong><span className="block truncate text-xs text-slate-500">{m.nationality||"Sin nacionalidad"} · {m.manager_kind==="fictional"?"Ficticio":"Real"}</span></span>
      {m.is_active===false&&<span className="text-[10px] bg-slate-200 rounded px-1">Archivado</span>}
     </button>)}
    </div>
   </aside>
   <section className="min-w-0 border rounded-2xl bg-white p-3 md:p-5">
    <div className="flex flex-wrap items-start gap-3 justify-between mb-4">
     <div className="flex items-center gap-3">
      {selected?<ManagerPortrait manager={selected} size="lg"/>:<div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center"><UserRoundCog size={25}/></div>}
      <div><p className="text-xs text-blue-700 font-bold uppercase tracking-wide">{selected?"Ficha del entrenador":"Nuevo entrenador"}</p><h2 className="text-xl md:text-2xl font-black">{selected?.display_name||selected?.name||"Crear ficha"}</h2><p className="text-xs text-slate-500">{selected?.manager_kind==="fictional"?"Entrenador ficticio":selected?"Entrenador real":"Primero crea la ficha; después podrás configurar su ADN."}</p></div>
     </div>
     {selected&&<button onClick={archiveManager} disabled={!canWrite||busy} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50">{selected.is_active===false?"Reactivar":"Archivar"}</button>}
    </div>
    <div role="tablist" aria-label="Secciones del entrenador" className="flex gap-1 border-b pb-2 mb-4 overflow-x-auto">
     {[{id:"identity",name:"Ficha",icon:UserRoundCog},{id:"dna",name:"ADN táctico",icon:SlidersHorizontal},{id:"club",name:"Clubes y temporadas",icon:ShieldCheck}].map(t=><button role="tab" aria-selected={tab===t.id} key={t.id} type="button" onClick={()=>setTab(t.id)} className={`whitespace-nowrap inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${tab===t.id?"bg-[#003399] text-white":"text-slate-600 hover:bg-slate-100"}`}><t.icon size={16}/>{t.name}</button>)}
    </div>
    {tab==="identity"&&<form onSubmit={saveManager} className="space-y-4">
     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><label className={label} htmlFor="manager-name">Nombre completo *</label><input id="manager-name" required maxLength={160} className={input} value={managerDraft.name} onChange={e=>updateManager("name",e.target.value)} placeholder="Nombre del entrenador" disabled={!canWrite}/></div>
      <div><label className={label}>Nombre de presentación</label><input className={input} maxLength={100} value={managerDraft.display_name} onChange={e=>updateManager("display_name",e.target.value)} placeholder="Nombre abreviado" disabled={!canWrite}/></div>
      <div><label className={label}>Nacionalidad · Countries</label>
       <div className="flex gap-2 items-center">
        {chosenCountry?.flag&&<img src={chosenCountry.flag} alt="" className="h-7 w-10 rounded object-contain shrink-0" onError={e=>{e.currentTarget.style.display="none"}}/>}
        <select aria-label="País de nacionalidad" className={input} value={chosenCountry?.id||""} onChange={e=>changeCountry(e.target.value)} disabled={!canWrite}>
          <option value="">Seleccionar país de Countries…</option>
          {filteredCountries.map(country=><option key={country.id} value={country.id}>{country.name}{country.code?" · "+country.code:""}</option>)}
        </select>
       </div>
       <input aria-label="Buscar países de Countries" className={input+" mt-2"} value={countrySearch} onChange={e=>setCountrySearch(e.target.value)} placeholder="Filtrar países por nombre o código…" disabled={!canWrite}/>
       {!chosenCountry&&managerDraft.nationality&&<p className="text-xs text-amber-700 mt-1">Nombre anterior: {managerDraft.nationality}. Selecciona su ficha de Countries para vincularlo.</p>}
       <p className="text-[11px] text-slate-500 mt-1">Se guardará el ID de Country; no se creará ningún país nuevo.</p>
      </div>
      <div><label className={label}>Nacimiento</label><input type="date" className={input} value={managerDraft.date_of_birth||""} onChange={e=>updateManager("date_of_birth",e.target.value)} disabled={!canWrite}/></div>
      <div><label className={label}>Tipo de entrenador</label><select className={input} value={managerDraft.manager_kind} onChange={e=>updateManager("manager_kind",e.target.value)} disabled={!canWrite}><option value="real">Real</option><option value="fictional">Ficticio / creado por mí</option></select></div>
      <div><label className={label}>Estado de la información</label><select className={input} value={managerDraft.source_status} onChange={e=>updateManager("source_status",e.target.value)} disabled={!canWrite}><option value="manual">Manual / sin verificar</option><option value="pending">Pendiente de verificar</option><option value="verified">Verificado con fuente</option></select></div>
      <div><label className={label}>URL de fotografía</label><input className={input} type="url" value={managerDraft.photo_url} onChange={e=>updateManager("photo_url",e.target.value)} placeholder="https://..." disabled={!canWrite}/></div>
      <div><label className={label}>Fuente de información</label><input className={input} type="url" value={managerDraft.source_url} onChange={e=>updateManager("source_url",e.target.value)} placeholder="https://..." disabled={!canWrite}/></div>
     </div>
     <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
       <label className={label+" mb-0"} htmlFor="manager-biography">Trayectoria y descripción</label>
       <div className="flex gap-2 flex-wrap">
        <button type="button" disabled={!canWrite||generatingBiography||!managerDraft.name.trim()} onClick={generateBiography} className="inline-flex gap-1 items-center rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"><Sparkles size={14}/>{generatingBiography?"Investigando…":"Redactar con IA desde el nombre"}</button>
        <button type="button" disabled={!biographyPrompt} onClick={copyBiographyPrompt} className="inline-flex gap-1 items-center rounded-lg border px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-40"><Copy size={14}/> Copiar prompt para ChatGPT</button>
       </div>
      </div>
      <textarea id="manager-biography" className={input} rows={5} value={managerDraft.biography} onChange={e=>updateManager("biography",e.target.value)} placeholder="Escribe el nombre arriba y pulsa Redactar con IA para preparar una biografía editable…" disabled={!canWrite}/>
      <p className="mt-1 text-[11px] text-slate-500">El prompt usa el nombre y el país elegido, pide trayectoria contrastada, logros y fuentes. El borrador no se guarda hasta que pulses Guardar ficha. La generación puede consumir créditos de integración de Base44.</p>
      {showBiographyPrompt&&<details open className="mt-2 rounded-xl border p-3 bg-slate-50"><summary className="font-semibold text-xs cursor-pointer">Prompt preparado desde el nombre</summary><textarea aria-label="Prompt para ChatGPT" value={biographyPrompt} readOnly className={input+" mt-2 font-mono"} rows={8} onFocus={e=>e.target.select()}/></details>}
     </div>
     <div><label className={label}>Observaciones privadas del proyecto</label><textarea className={input} rows={2} value={managerDraft.notes} onChange={e=>updateManager("notes",e.target.value)} disabled={!canWrite}/></div>
     <button className={primary} disabled={!canWrite||busy} type="submit"><Save size={16}/>{busy?"Guardando...":selected?"Guardar ficha":"Crear entrenador"}</button>
    </form>}
    {tab==="dna"&&(!selected?<div className="rounded-xl border border-dashed p-8 text-center text-slate-600">Primero guarda una ficha de entrenador para crear su ADN táctico.</div>:<form onSubmit={saveProfile} className="space-y-4">
     <div className="flex flex-wrap items-end gap-2 justify-between"><div><h3 className="font-extrabold">Modelos de juego</h3><p className="text-xs text-slate-500">Un entrenador puede tener varios perfiles según temporada o proyecto.</p></div><div className="flex items-center gap-2"><select className={input+" max-w-[200px]"} aria-label="Seleccionar perfil táctico" value={profileId||"__new__"} onChange={e=>chooseProfile(e.target.value)}><option value="__new__">Nuevo perfil</option>{managerProfiles.map(p=><option key={p.id} value={p.id}>{p.name} · {profileScopeLabel(p)} {p.is_default?"★":""}</option>)}</select><button type="button" className="border rounded-lg px-2 py-2" onClick={()=>chooseProfile("")} disabled={!canWrite} title="Crear otro perfil"><Plus size={18}/></button></div></div>
     <div className="border rounded-xl bg-blue-50/60 border-blue-100 p-3 space-y-3" aria-label="Asistente de ADN táctico">
       <div className="flex flex-wrap gap-2 justify-between items-center">
         <div><h4 className="font-extrabold text-sm flex items-center gap-2"><Sparkles size={17} className="text-[#003399]"/> ADN táctico con IA</h4><p className="text-xs text-slate-600">Genera un borrador específico para {selected.name}, separado de su biografía.</p></div>
         <div className="flex gap-2 flex-wrap">
           <button type="button" disabled={!canWrite||busy||generatingDNA} onClick={generateTacticalDNA} className="inline-flex items-center gap-2 bg-[#003399] text-white rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-40"><Sparkles size={14}/>{generatingDNA?"Investigando modelo…":"Investigar y completar ADN"}</button>
           <button type="button" disabled={!tacticalPrompt} onClick={copyTacticalPrompt} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-white border text-xs font-bold"><Copy size={14}/> Copiar prompt para ChatGPT</button>
         </div>
       </div>
       <label className="block text-xs font-semibold">Club / etapa de referencia (opcional)
         <input aria-label="Club o etapa táctica" value={dnaContext} onChange={e=>setDnaContext(e.target.value)} maxLength={160} className={input+" mt-1"} placeholder="Ej.: Liverpool 2018–2024, Borussia Dortmund 2011–2013"/>
       </label>
       <p className="text-[11px] text-slate-600">La IA estimará los seis valores, formación, fases del juego y siete perfiles de jugador. Los números son criterios analíticos, no estadísticas oficiales. Ningún cambio se guardará hasta pulsar «Guardar ADN táctico». La generación puede consumir créditos de Base44.</p>
       <details open={showDNAPrompt} onToggle={e=>setShowDNAPrompt(e.currentTarget.open)} className="border rounded-lg bg-white p-2">
         <summary className="text-xs cursor-pointer font-semibold">Ver prompt y pegar respuesta JSON de ChatGPT</summary>
         <textarea aria-label="Prompt táctico para ChatGPT" className={input+" mt-2 font-mono"} value={tacticalPrompt} readOnly rows={5} onFocus={e=>e.target.select()}/>
         <label className="block mt-3 text-xs font-semibold">Pegar JSON táctico generado por ChatGPT</label>
         <textarea aria-label="Respuesta JSON para ADN táctico" className={input+" mt-1 font-mono"} rows={5} value={dnaJsonInput} onChange={e=>setDnaJsonInput(e.target.value)} placeholder='{"identifiable":true,"confidence":"medium", ...}' disabled={!canWrite}/>
         <button type="button" onClick={applyPastedDNA} disabled={!canWrite||busy||generatingDNA||!dnaJsonInput.trim()} className="mt-2 rounded-lg bg-slate-900 text-white text-xs font-bold px-3 py-2 disabled:opacity-40">Aplicar JSON al borrador</button>
       </details>
       {dnaDraftReady&&<div role="status" className="rounded-lg bg-emerald-50 p-3 border border-emerald-200 text-sm">
         <p className="font-bold text-emerald-800">Periodo interpretado: {profileScopeLabel(profileDraft)}</p>
         {scopeSuggestion?.origin==="explicit_notes"&&<p className="mt-1 text-xs text-emerald-700">Identificado a partir del apartado «ETAPA REPRESENTADA» del JSON anterior. Confirma el club y las fechas antes de guardar.</p>}
         {scopeSuggestion?.origin==="not_specified"&&<p className="mt-1 text-xs text-amber-700">El JSON no identifica una etapa concreta. Se ha propuesto «Filosofía general»; revisa el análisis antes de aceptarlo.</p>}
         <p className="text-xs text-emerald-700 mt-1">Nombre propuesto: <strong>{profileDraft.name}</strong>. Todos los campos son editables; todavía no se ha guardado.</p>
       </div>}
     </div>
     {managerProfiles.length===0&&<p className="text-xs rounded-lg p-3 bg-amber-50 text-amber-900"><BookOpen size={14} className="inline mr-1"/>Los seis parámetros empiezan en 50 como plantilla neutra. No representan hechos tácticos contrastados hasta que los edites.</p>}
     <div className="rounded-xl border border-blue-100 p-3 bg-slate-50/60 space-y-3" aria-label="Identificación histórica del perfil">
      <div className="flex flex-wrap items-center justify-between gap-2">
       <div><h4 className="font-extrabold text-sm">Identificación del modelo táctico</h4><p className="text-xs text-slate-500">Selecciona si representa toda su filosofía, una etapa o una campaña. «ADN principal» se marca por separado.</p></div>
       <span className="rounded-full bg-white border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">{profileScopeLabel(profileDraft)}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{PROFILE_SCOPES.map(scope=><button key={scope.key} type="button" onClick={()=>updateProfile("profile_scope",scope.key)} aria-pressed={profileScope(profileDraft)===scope.key} disabled={!canWrite} className={`text-left rounded-lg border p-3 disabled:opacity-60 ${profileScope(profileDraft)===scope.key?"border-blue-700 bg-blue-50 ring-1 ring-blue-600":"bg-white border-slate-200 hover:border-blue-300"}`}>
       <strong className="block text-sm">{scope.title}</strong><span className="block mt-1 text-[11px] text-slate-500">{scope.description}</span>
      </button>)}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
       <div><label className={label}>Nombre del perfil *</label><input required value={profileDraft.name} onChange={e=>updateProfile("name",e.target.value)} className={input} disabled={!canWrite} placeholder="Ej.: Liverpool 2018–2020"/></div>
       <div><label className={label}>Formación preferida</label><select className={input} value={profileDraft.formation} onChange={e=>updateProfile("formation",e.target.value)} disabled={!canWrite}>{["4-3-3","4-2-3-1","4-4-2","3-5-2","3-4-3","4-3-1-2","5-3-2","4-1-4-1"].map(v=><option key={v}>{v}</option>)}</select></div>
      </div>
      {profileScope(profileDraft)==="general"&&<p className="text-xs rounded-lg bg-white p-3 border text-slate-600">Representa los principios generales del entrenador. No se guarda ninguna fecha, aunque las observaciones pueden mencionar etapas de referencia.</p>}
      {profileScope(profileDraft)==="period"&&<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
       <div><label className={label}>Club / proyecto de referencia</label><input value={profileDraft.reference_club||""} onChange={e=>updateProfile("reference_club",e.target.value)} className={input} disabled={!canWrite} placeholder="Ej.: Liverpool"/></div>
       <div><label className={label}>Desde temporada *</label><input required value={profileDraft.period_start||""} onChange={e=>updateProfile("period_start",e.target.value)} className={input} disabled={!canWrite} placeholder="2018/2019" aria-label="Temporada inicial del periodo"/></div>
       <div><label className={label}>Hasta temporada *</label><input required value={profileDraft.period_end||""} onChange={e=>updateProfile("period_end",e.target.value)} className={input} disabled={!canWrite} placeholder="2019/2020" aria-label="Temporada final del periodo"/></div>
      </div>}
      {profileScope(profileDraft)==="season"&&<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
       <div><label className={label}>Club / proyecto de referencia</label><input value={profileDraft.reference_club||""} onChange={e=>updateProfile("reference_club",e.target.value)} className={input} disabled={!canWrite} placeholder="Ej.: Liverpool"/></div>
       <div><label className={label}>Temporada específica *</label><input required value={profileDraft.season||""} onChange={e=>updateProfile("season",e.target.value)} className={input} disabled={!canWrite} placeholder="2019/2020" aria-label="Temporada del modelo"/></div>
      </div>}
     </div>
     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{DNA_AXES.map(axis=><div key={axis.key} className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2"><span className="text-sm font-semibold">{axis.label}</span><strong className="tabular-nums">{profileDraft[axis.key]??50}<span className="text-xs text-slate-500">/100</span></strong></div>
      <input aria-label={axis.label} className="w-full accent-[#003399]" type="range" min="0" max="100" step="1" value={profileDraft[axis.key]??50} onChange={e=>updateProfile(axis.key,Number(e.target.value))} disabled={!canWrite}/>
      <div className="flex justify-between text-[11px] text-slate-500"><span>{axis.low}</span><span>{axis.high}</span></div>
     </div>)}</div>
     <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div><label className={label}>Salida de balón</label><select value={profileDraft.build_up||"mixed"} onChange={e=>updateProfile("build_up",e.target.value)} className={input} disabled={!canWrite}><option value="short">Elaboración corta</option><option value="mixed">Mixta</option><option value="direct">Directa</option></select></div>
      <div><label className={label}>Tras pérdida</label><select value={profileDraft.transition||"balanced"} onChange={e=>updateProfile("transition",e.target.value)} className={input} disabled={!canWrite}><option value="counter_press">Presión tras pérdida</option><option value="balanced">Equilibrada</option><option value="regroup">Reorganizarse</option></select></div>
      <div><label className={label}>Bloque defensivo</label><select value={profileDraft.defensive_block||"medium"} onChange={e=>updateProfile("defensive_block",e.target.value)} className={input} disabled={!canWrite}><option value="low">Bajo</option><option value="medium">Medio</option><option value="high">Alto</option></select></div>
     </div>
     <details className="border rounded-xl p-3"><summary className="text-sm font-semibold cursor-pointer">Perfiles deseados por posición (7 roles)</summary><p className="mt-2 text-xs text-slate-500">Describe las características que busca este entrenador. Son preferencias manuales, no conclusiones automáticas.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">{ROLES.map(r=><label key={r.key} className="block"><span className={label}>{r.label}</span><textarea disabled={!canWrite} className={input} rows={2} value={roleText[r.key]||""} onChange={e=>setRoleText(prev=>({...prev,[r.key]:e.target.value}))} placeholder="Ej.: velocidad, juego interior, pase progresivo..."/></label>)}</div></details>
     <div><label className={label}>Observaciones sobre el modelo</label><textarea rows={3} className={input} value={profileDraft.profile_notes||""} onChange={e=>updateProfile("profile_notes",e.target.value)} disabled={!canWrite}/></div>
     <div><label className={label}>Fuente del análisis táctico (si es real)</label><input type="url" className={input} value={profileDraft.source_url||""} onChange={e=>updateProfile("source_url",e.target.value)} disabled={!canWrite}/></div>
     <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={Boolean(profileDraft.is_default)} onChange={e=>updateProfile("is_default",e.target.checked)} disabled={!canWrite}/> Usar como ADN principal (independiente del periodo)</label>
     <button type="submit" className={primary} disabled={!canWrite||busy}><Save size={16}/> Guardar ADN táctico</button>
    </form>)}
    {tab==="club"&&(!selected?<div className="rounded-xl border border-dashed p-8 text-center text-slate-600">Crea un entrenador antes de asignarlo a un equipo.</div>:<div className="space-y-5">
     <div><h3 className="font-extrabold">Asignación a clubes personalizados</h3><p className="text-sm text-slate-500">Solo clubes con la opción «Club personalizado» activada. No se altera el entrenador de las fichas de clubes reales.</p></div>
     <form onSubmit={saveAssignment} className="rounded-xl bg-slate-50 border p-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
      <label><span className={label}>Club personalizado</span><select className={input} value={assignTeamId} onChange={e=>setAssignTeamId(e.target.value)} disabled={!canWrite}>{customTeams.length===0&&<option value="">No hay clubes personalizados</option>}{customTeams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label><span className={label}>Temporada</span><input className={input} value={assignSeason} onChange={e=>setAssignSeason(e.target.value)} placeholder="2026/2027" disabled={!canWrite}/></label>
      <label><span className={label}>ADN táctico asignado</span><select className={input} value={assignProfile} onChange={e=>setAssignProfile(e.target.value)} disabled={!canWrite}><option value="">Sin perfil específico</option>{managerProfiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <button type="submit" className={primary+" md:col-span-3"} disabled={!canWrite||busy||!customTeams.length}><ShieldCheck size={16}/> Asignar entrenador al club</button>
     </form>
     <div><h4 className="font-extrabold mb-2">Historial de proyectos deportivos</h4>{managerAssignments.length===0?<p className="text-sm text-slate-500 border border-dashed rounded-xl p-5">Todavía no hay clubes asignados a este entrenador.</p>:<div className="space-y-2">{managerAssignments.sort((a,b)=>String(b.season).localeCompare(a.season)).map(a=>{const t=customTeams.find(t=>String(t.id)===String(a.team_id));return <div key={a.id} className="border rounded-lg p-3 flex flex-wrap gap-2 justify-between items-center"><div><strong>{t?.name||"Club no disponible"}</strong><div className="text-xs text-slate-500">{a.season} · {a.is_primary!==false?"Principal":"Asignación anterior"}</div></div><Link to={`/squads?team=${encodeURIComponent(a.team_id)}`} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">Plantillas <ArrowUpRight size={14}/></Link></div>})}</div>}</div>
    </div>)}
   </section>
  </div>
 </main>;
}
