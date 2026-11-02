import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Search, Plus, Trash2, Users } from "lucide-react";
import TacticalBuilder from "@/components/teams/TacticalBuilder";

const SEASON = "2026/2027";
const loadAll = async (entity, filter = {}) => {
  let results = [];
  for (let skip = 0; skip <= 10000; skip += 200) {
    const page = await entity.filter(filter, undefined, 200, skip);
    const records = Array.isArray(page) ? page : page?.data ?? [];
    results = results.concat(records);
    if (records.length < 200) break;
  }
  return results;
};
const playerImage = p => p?.card_photo_url || p?.photo_url || "";
export default function Squads() {
  const [params, setParams] = useSearchParams();
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [members, setMembers] = useState([]);
  const [teamQuery, setTeamQuery] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [season, setSeason] = useState(SEASON);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const teamId = params.get("team") || "";
  const team = teams.find(t => String(t.id) === teamId);
  useEffect(() => {
    let alive = true;
    Promise.all([loadAll(base44.entities.Team), loadAll(base44.entities.Player)]).then(([t,p]) => {
      if (!alive) return;
      setTeams(t); setPlayers(p);
    }).catch(e => alive && setError(e.message || "No se pudieron cargar los equipos y jugadores"))
    .finally(() => alive && setLoading(false));
    return () => { alive = false };
  }, []);
  useEffect(() => {
    if (!teamId || !season.trim()) { setMembers([]); return; }
    let alive = true;
    setError(""); setLoading(true);
    loadAll(base44.entities.TeamSquadMembership, { team_type: "club", team_id: teamId, season: season.trim() })
      .then(rows => alive && setMembers(rows))
      .catch(e => alive && setError(e.message || "Error al cargar la plantilla"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [teamId, season]);
  const roster = useMemo(() => members.map(m => ({ ...m, player: players.find(p => String(p.id) === String(m.player_id)) })).sort((a,b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)), [members,players]);
  const candidates = useMemo(() => {
    const q = playerQuery.trim().toLocaleLowerCase();
    if (q.length < 2) return [];
    const assigned = new Set(members.map(m => String(m.player_id)));
    return players.filter(p => !assigned.has(String(p.id)) && p.name?.toLocaleLowerCase().includes(q)).slice(0, 40);
  }, [players, members, playerQuery]);
  const chooseTeam = id => setParams(id ? {team: String(id)} : {});
  const reload = async () => setMembers(await loadAll(base44.entities.TeamSquadMembership, {team_type:"club", team_id:teamId, season:season.trim()}));
  const act = async (fn, ok) => {
    setBusy(true); setError(""); setMessage("");
    try { await fn(); await reload(); setMessage(ok); }
    catch(e) { setError(e.message || "Error al guardar. No se han confirmado los cambios."); }
    finally { setBusy(false); }
  };
  const add = p => act(async () => {
    if (members.some(m => String(m.player_id) === String(p.id))) return;
    await base44.entities.TeamSquadMembership.create({
      team_type:"club", team_id:teamId, player_id:String(p.id),season:season.trim(),
      shirt_number:Number.isInteger(p.shirt_number) ? p.shirt_number : undefined,
      primary_position:p.position || "",secondary_positions:p.secondary_position ? [p.secondary_position] : [],
      squad_role:"rotation",status:"active",sort_order:members.length
    });
    setPlayerQuery("");
  }, "Jugador añadido a la plantilla.");
  const update = (m, patch) => act(async () => { await base44.entities.TeamSquadMembership.update(m.id, patch); }, "Jugador actualizado.");
  const remove = m => {
    if (!window.confirm("¿Quitar a este jugador de esta plantilla? Sus fichas y estadísticas permanecerán intactas.")) return;
    act(() => base44.entities.TeamSquadMembership.delete(m.id), "Jugador retirado de la plantilla.");
  };
  return <div className="mx-auto max-w-[1450px] px-4 py-7 md:px-8 text-slate-900">
    <div className="mb-7"><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">MF LEGACY</p><h1 className="text-3xl md:text-4xl font-black">Plantillas y Onces</h1><p className="text-slate-500 mt-1">Gestiona las plantillas de los clubes creados. Gestiona tus equipos y construye alineaciones tácticas interactivas.</p></div>
    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 lg:self-start"><h2 className="font-bold mb-3">Equipos</h2><div className="relative mb-3"><Search className="absolute left-3 top-3 text-slate-400" size={17}/><input aria-label="Buscar equipo" value={teamQuery} onChange={e=>setTeamQuery(e.target.value)} placeholder="Buscar equipo..." className="w-full rounded-lg border border-slate-200 p-2.5 pl-9"/></div>
        <div className="max-h-[650px] overflow-auto space-y-1">{teams.filter(t=>t.name?.toLowerCase().includes(teamQuery.toLowerCase())).map(t=><button type="button" key={t.id} onClick={()=>chooseTeam(t.id)} className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-100 ${teamId === String(t.id)?"bg-blue-50 ring-1 ring-blue-300":""}`}>{t.logo?<img src={t.logo} className="w-8 h-8 object-contain" alt=""/>:<Users size={23}/>}<span className="text-sm font-semibold">{t.name}</span></button>)}</div>
      </aside>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-6 min-h-[430px]">
        {!team ? <div className="flex items-center justify-center h-64 text-slate-500">Selecciona un equipo para gestionar su plantilla.</div> : <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5"><div className="flex gap-3 items-center">{team.logo&&<img src={team.logo} alt="" className="w-12 h-12 object-contain"/>}<div><h2 className="text-2xl font-extrabold">{team.name}</h2><p className="text-sm text-slate-500">{roster.length} jugadores asignados</p></div></div><label className="text-sm font-medium">Temporada <input aria-label="Temporada" value={season} onChange={e=>setSeason(e.target.value)} className="block mt-1 w-36 rounded-lg border px-3 py-2"/></label></div>
          {error&&<p role="alert" className="p-3 mb-3 rounded-lg bg-red-50 text-red-700">{error}</p>}{message&&<p role="status" className="p-3 mb-3 rounded-lg bg-green-50 text-green-700">{message}</p>}
          <div className="mb-6 rounded-xl border bg-slate-50 p-4"><label className="font-semibold text-sm block mb-2">Añadir jugador de MF LEGACY</label><div className="relative"><Search size={18} className="absolute left-3 top-3 text-slate-400"/><input value={playerQuery} onChange={e=>setPlayerQuery(e.target.value)} placeholder="Escribe al menos 2 letras del nombre..." aria-label="Buscar jugadores" className="w-full rounded-lg border bg-white p-2.5 pl-10"/></div>{playerQuery.trim().length>=2&&<div className="max-h-64 overflow-auto mt-2 rounded-lg border bg-white">{candidates.length===0?<p className="p-3 text-sm text-slate-500">Sin resultados disponibles.</p>:candidates.map(p=><div className="flex items-center gap-3 p-2 border-b last:border-0" key={p.id}>{playerImage(p)?<img src={playerImage(p)} alt="" className="w-9 h-9 rounded-full object-cover"/>:<div className="w-9 h-9 rounded-full bg-slate-200"/>}<span className="flex-1 text-sm font-medium">{p.name} <span className="text-slate-400">{p.position||""}</span></span><button disabled={busy} title="Añadir jugador" onClick={()=>add(p)} className="rounded-lg bg-blue-700 text-white p-2 disabled:opacity-50"><Plus size={16}/></button></div>)}</div>}</div>
          {!loading && <TacticalBuilder team={team} season={season} roster={roster} />}
          <h3 className="font-bold mt-7 mb-3">Plantilla</h3>{loading?<p className="text-slate-500">Cargando...</p>:roster.length===0?<p className="rounded-xl border border-dashed p-8 text-center text-slate-500">Todavía no has asignado jugadores.</p>:<div className="space-y-2">{roster.map(m=><div key={m.id} className="flex flex-col sm:flex-row sm:items-center gap-3 border rounded-xl p-3">
            {playerImage(m.player)?<img src={playerImage(m.player)} alt="" className="w-12 h-12 rounded-full object-cover bg-slate-100"/>:<div className="w-12 h-12 bg-slate-100 rounded-full"/>}
            <div className="flex-1 min-w-0"><p className="font-bold truncate">{m.player?.name||"Jugador no encontrado"}</p><p className="text-xs text-slate-400">{m.player?.position||"Sin posición"}</p></div>
            <label className="text-xs text-slate-500">Dorsal<input type="number" min="0" max="99" key={m.id+"number"+m.shirt_number} defaultValue={m.shirt_number??""} disabled={busy} onBlur={e=>{const n=e.target.value===""?null:Number(e.target.value);if(n!==m.shirt_number&& (n===null||(Number.isInteger(n)&&n>=0&&n<=99)))update(m,{shirt_number:n})}} className="block w-20 border rounded-md p-2 text-sm"/></label>
            <label className="text-xs text-slate-500">Posición<input key={m.id+"position"+m.primary_position} defaultValue={m.primary_position||""} disabled={busy} onBlur={e=>{if(e.target.value!==m.primary_position)update(m,{primary_position:e.target.value})}} className="block w-20 border rounded-md p-2 text-sm"/></label>
            <label className="text-xs text-slate-500">Rol<select value={m.squad_role||"rotation"} disabled={busy} onChange={e=>update(m,{squad_role:e.target.value})} className="block border rounded-md p-2 text-sm"><option value="starter">Titular</option><option value="rotation">Rotación</option><option value="bench">Suplente</option><option value="reserve">Reserva</option><option value="loan">Cedido</option></select></label>
            <button disabled={busy} onClick={()=>remove(m)} title="Quitar de plantilla" aria-label={`Quitar a ${m.player?.name||"jugador"}`} className="self-end sm:self-center p-2 rounded-lg text-red-600 hover:bg-red-50"><Trash2 size={18}/></button>
          </div>)}</div>}
        </>}
      </section>
    </div>
  </div>;
}
