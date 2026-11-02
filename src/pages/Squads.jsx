import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Search, Plus, Trash2, Users, Copy, CalendarDays } from "lucide-react";
import TacticalBuilder from "@/components/teams/TacticalBuilder";
import { referenceTeams, analyzeLineup } from "@/components/teams/lineupAnalysis.mjs";

const SEASON = "2026/2027";
const validSeason = value => /^20\d{2}\/20\d{2}$/.test(value) && Number(value.slice(5)) === Number(value.slice(0,4)) + 1;
const sortSeasons = values => [...new Set(values.filter(validSeason))].sort((a,b)=>b.localeCompare(a));
const loadAll = async (entity, filter = {}) => {
  let results = [];
  for (let skip = 0; skip <= 100000; skip += 200) {
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
  const [seasonOptions, setSeasonOptions] = useState([SEASON]);
  const [copyFrom, setCopyFrom] = useState("");
  const [seasonRevision, setSeasonRevision] = useState(0);
  const [lineupDirty, setLineupDirty] = useState(false);
  const [comparison,setComparison]=useState([]);
  const [balanceComparison,setBalanceComparison]=useState([]);
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
    if(!teamId){setSeasonOptions([SEASON]);setCopyFrom("");return;}
    let live=true;
    Promise.all([
      loadAll(base44.entities.TeamSquadMembership,{team_type:"club",team_id:teamId}),
      loadAll(base44.entities.TeamLineup,{team_type:"club",team_id:teamId})
    ]).then(([memberships,lineups])=>{
      if(!live)return;
      const options=sortSeasons([SEASON,...memberships.map(m=>m.season),...lineups.map(l=>l.season)]);
      setSeasonOptions(options);setCopyFrom(previous=>options.includes(previous)?previous:(options.find(s=>s!==season)||""));
    }).catch(e=>{if(live)setError(e.message||"No se pudieron recuperar las temporadas históricas")});
    return ()=>{live=false};
  },[teamId,seasonRevision]);
  useEffect(() => {
    if (!teamId || !season.trim()) { setMembers([]); return; }
    let alive = true;
    setError(""); setLoading(true);
    loadAll(base44.entities.TeamSquadMembership, { team_type: "club", team_id: teamId, season: season.trim() })
      .then(rows => alive && setMembers(rows))
      .catch(e => alive && setError(e.message || "Error al cargar la plantilla"))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [teamId, season, seasonRevision]);
  const roster = useMemo(() => members.map(m => ({ ...m, player: players.find(p => String(p.id) === String(m.player_id)) })).sort((a,b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)), [members,players]);
  const candidates = useMemo(() => {
    const q = playerQuery.trim().toLocaleLowerCase();
    if (q.length < 2) return [];
    const assigned = new Set(members.map(m => String(m.player_id)));
    return players.filter(p => !assigned.has(String(p.id)) && p.name?.toLocaleLowerCase().includes(q)).slice(0, 40);
  }, [players, members, playerQuery]);
  useEffect(()=>{
    if(!teamId || !players.length){setComparison([]);setBalanceComparison([]);return;}
    let active=true;
    const gather=async()=>{
      try{
        const [membershipRows,lineupRows]=await Promise.all([
          loadAll(base44.entities.TeamSquadMembership,{team_type:"club",season}),
          loadAll(base44.entities.TeamLineup,{team_type:"club",season})
        ]);
        if(!active)return;
        setComparison(referenceTeams(membershipRows,players,teamId));
        const distinct=new Set();
        const otherLineups=lineupRows.filter(l=>{
          const id=String(l.team_id);
          if(id===String(teamId)||distinct.has(id))return false;
          distinct.add(id);return true;
        }).slice(0,12);
        const byPlayer=new Map(players.map(p=>[String(p.id),p]));
        const results=await Promise.allSettled(otherLineups.map(async l=>{
          const records=await loadAll(base44.entities.TeamLineupSlot,{lineup_id:l.id});
          const placed=records.filter(r=>byPlayer.has(String(r.player_id))&&Number.isFinite(Number(r.x_position))&&Number.isFinite(Number(r.y_position)))
            .map(r=>({player_id:String(r.player_id),x:Number(r.x_position),y:Number(r.y_position)}));
          if(placed.length<8)return null;
          const thosePlayers=placed.map(r=>({player_id:r.player_id,player:byPlayer.get(r.player_id)}));
          return analyzeLineup(placed,thosePlayers).balance;
        }));
        if(active)setBalanceComparison(results.filter(r=>r.status==="fulfilled" && typeof r.value==="number").map(r=>r.value));
      }catch{if(active){setComparison([]);setBalanceComparison([])}}
    };
    gather();
    return ()=>{active=false};
  },[teamId,season,players,seasonRevision]);
  const ensurePlayerForSquad = async player => {
    if(!teamId||!player?.id)throw new Error("Jugador o equipo no válido.");
    if(members.some(m=>String(m.player_id)===String(player.id)))return;
    if(busy)throw new Error("Hay otra operación en curso.");
    setBusy(true);setError("");
    try {
      const rows=await loadAll(base44.entities.TeamSquadMembership,{
        team_type:"club",team_id:teamId,season,player_id:String(player.id)
      });
      if(!rows.length)await base44.entities.TeamSquadMembership.create({
        team_type:"club",team_id:teamId,player_id:String(player.id),season,
        primary_position:player.position||"",secondary_positions:player.secondary_position?[player.secondary_position]:[],
        squad_role:"rotation",status:"active",sort_order:members.length
      });
      await reload();
    }catch(e){setError(e.message||"No se pudo vincular el jugador");throw e}
    finally{setBusy(false)}
  };
  const chooseTeam = id => { if(lineupDirty&&!window.confirm("El once tiene cambios sin guardar. ¿Cambiar de equipo y descartarlos?"))return;setLineupDirty(false);setSeason(SEASON);setParams(id ? {team: String(id)} : {}); };
  const navigateSeason = next => {
    if(!validSeason(next)){setError("Temporada no válida. Usa el formato 2020/2021.");return;}
    if(lineupDirty&&!window.confirm("El once tiene cambios sin guardar. ¿Cambiar de temporada y descartarlos?"))return;
    setLineupDirty(false);setError("");setMessage("");setSeason(next);
  };
  const copyRoster = async () => {
    if(busy)return;
    if(!teamId||!validSeason(season)||!validSeason(copyFrom)||copyFrom===season){
      setError("Selecciona dos temporadas distintas y válidas.");return;
    }
    setBusy(true);setError("");setMessage("");
    const created=[];
    try {
      const [source,destination]=await Promise.all([
        loadAll(base44.entities.TeamSquadMembership,{team_type:"club",team_id:teamId,season:copyFrom}),
        loadAll(base44.entities.TeamSquadMembership,{team_type:"club",team_id:teamId,season})
      ]);
      if(!source.length)throw new Error("La temporada de origen no tiene jugadores.");
      const existing=new Set(destination.map(m=>String(m.player_id)));
      const seen=new Set(existing);
      const missing=source.filter(m=>{const id=String(m.player_id);if(seen.has(id))return false;seen.add(id);return Boolean(m.player_id);});
      if(!missing.length){setMessage("La temporada de destino ya contiene todos los jugadores de origen.");return;}
      if(!window.confirm(`Copiar ${missing.length} jugadores de ${copyFrom} a ${season}? No se modificarán los registros existentes ni los onces.`))return;
      try{
        for(const m of missing){
          const row=await base44.entities.TeamSquadMembership.create({
            team_type:"club",team_id:teamId,player_id:String(m.player_id),season,
            ...(m.shirt_number!=null?{shirt_number:m.shirt_number}:{}),
            primary_position:m.primary_position||"",secondary_positions:m.secondary_positions||[],
            squad_role:m.squad_role||"rotation",status:m.status||"active",sort_order:m.sort_order??0,
            notes:m.notes||""
          });
          created.push(row);
        }
      }catch(e){
        const rollback=await Promise.allSettled(created.map(row=>base44.entities.TeamSquadMembership.delete(row.id)));
        throw new Error((e.message||"Error al copiar")+"; "+(rollback.some(x=>x.status==="rejected")?"revisa registros parcialmente creados.":"se han revertido los registros de esta operación."));
      }
      setMessage(`${created.length} jugadores copiados a ${season}. Los onces y estadísticas no se han modificado.`);
      setSeasonRevision(v=>v+1);
    }catch(e){setError(e.message||"No se pudo copiar la plantilla.")}
    finally{setBusy(false)}
  };
  const reload = async () => setMembers(await loadAll(base44.entities.TeamSquadMembership, {team_type:"club", team_id:teamId, season:season.trim()}));
  const act = async (fn, ok) => {
    setBusy(true); setError(""); setMessage("");
    try { await fn(); await reload(); setSeasonRevision(v=>v+1); setMessage(ok); }
    catch(e) { setError(e.message || "Error al guardar. No se han confirmado los cambios."); }
    finally { setBusy(false); }
  };
  const add = p => { if(busy || !p?.id || !teamId)return; return act(async () => {
    if (members.some(m => String(m.player_id) === String(p.id))) return;
    await base44.entities.TeamSquadMembership.create({
      team_type:"club", team_id:teamId, player_id:String(p.id),season:season.trim(),
      shirt_number:Number.isInteger(p.shirt_number) ? p.shirt_number : undefined,
      primary_position:p.position || "",secondary_positions:p.secondary_position ? [p.secondary_position] : [],
      squad_role:"rotation",status:"active",sort_order:members.length
    });
    setPlayerQuery("");
  }, "Jugador añadido a la plantilla."); };
  const update = (m, patch) => !busy && m?.id && act(async () => { await base44.entities.TeamSquadMembership.update(m.id, patch); }, "Jugador actualizado.");
  const remove = m => {
    if (busy || !m?.id) return;
    if (!window.confirm("¿Quitar a este jugador de esta plantilla? Sus fichas y estadísticas permanecerán intactas.")) return;
    act(() => base44.entities.TeamSquadMembership.delete(m.id), "Jugador retirado de la plantilla.");
  };
  return <div className="mx-auto max-w-[1650px] px-3 py-3 md:px-5 text-slate-900">
    <div className="mb-3"><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">MF LEGACY</p><h1 className="text-3xl md:text-4xl font-black">Plantillas y Onces</h1><p className="text-slate-500 mt-1">Gestiona las plantillas de los clubes creados. Gestiona tus equipos y construye alineaciones tácticas interactivas.</p></div>
    <div className="grid grid-cols-1 lg:grid-cols-[205px_minmax(0,1fr)] gap-3">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 lg:self-start"><h2 className="font-bold mb-3">Equipos</h2><div className="relative mb-3"><Search className="absolute left-3 top-3 text-slate-400" size={17}/><input aria-label="Buscar equipo" value={teamQuery} onChange={e=>setTeamQuery(e.target.value)} placeholder="Buscar equipo..." className="w-full rounded-lg border border-slate-200 p-2.5 pl-9"/></div>
        <div className="max-h-[650px] overflow-auto space-y-1">{teams.filter(t=>t.name?.toLowerCase().includes(teamQuery.toLowerCase())).map(t=><button type="button" key={t.id} onClick={()=>chooseTeam(t.id)} className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-100 ${teamId === String(t.id)?"bg-blue-50 ring-1 ring-blue-300":""}`}>{t.logo?<img src={t.logo} className="w-8 h-8 object-contain" alt=""/>:<Users size={23}/>}<span className="text-sm font-semibold">{t.name}</span></button>)}</div>
      </aside>
      <section className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 min-h-[430px] min-w-0">
        {!team ? <div className="flex items-center justify-center h-64 text-slate-500">Selecciona un equipo para gestionar su plantilla.</div> : <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3"><div className="flex gap-3 items-center">{team.logo&&<img src={team.logo} alt="" className="w-12 h-12 object-contain"/>}<div><h2 className="text-2xl font-extrabold">{team.name}</h2><p className="text-sm text-slate-500">{roster.length} jugadores asignados</p></div></div><label className="text-sm font-medium">Temporada <select aria-label="Temporada histórica" value={season} onChange={e=>navigateSeason(e.target.value)} className="block mt-1 w-40 rounded-lg border px-3 py-2">{sortSeasons([...seasonOptions,season]).map(s=><option key={s} value={s}>{s}</option>)}</select></label></div>
          <TacticalBuilder key={`${teamId}:${season}`} team={team} season={season} roster={roster} allPlayers={players} comparison={comparison} balanceComparison={balanceComparison} onEnsurePlayer={ensurePlayerForSquad} onDirtyChange={setLineupDirty} />
          <details className="mb-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3"><summary className="cursor-pointer font-semibold text-sm">Temporadas históricas · Crear campaña o copiar plantilla</summary><div className="mt-3">
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <div><h3 className="font-bold flex items-center gap-2"><CalendarDays size={17}/> Archivo de temporadas</h3><p className="text-xs text-slate-600">Cambia de campaña sin alterar otras plantillas. Puedes copiar jugadores de una temporada existente.</p></div>
              <label className="text-xs font-semibold">Abrir nueva campaña
                <select aria-label="Abrir temporada histórica" value="" onChange={e=>{if(e.target.value)navigateSeason(e.target.value)}} className="block w-36 mt-1 rounded-lg border p-2 bg-white">
                  <option value="">Seleccionar…</option>
                  {Array.from({length:20},(_,i)=>{const y=2026-i;return `${y}/${y+1}`}).filter(s=>s!==season).map(s=><option value={s} key={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-end gap-2 mt-3">
              <label className="text-xs font-semibold">Copiar plantilla desde
                <select aria-label="Temporada origen" value={copyFrom} onChange={e=>setCopyFrom(e.target.value)} className="block w-40 mt-1 rounded-lg border bg-white p-2">
                  <option value="">Seleccionar…</option>
                  {seasonOptions.filter(s=>s!==season).map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <button type="button" disabled={busy||loading||!copyFrom||copyFrom===season} onClick={copyRoster} className="inline-flex items-center gap-2 rounded-lg bg-[#003399] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Copy size={15}/> Copiar sin sobrescribir</button>
            </div>
            </div>
          </details>
          {error&&<p role="alert" className="p-3 mb-3 rounded-lg bg-red-50 text-red-700">{error}</p>}{message&&<p role="status" className="p-3 mb-3 rounded-lg bg-green-50 text-green-700">{message}</p>}
          <details className="mb-4 rounded-xl border bg-slate-50 p-3"><summary className="cursor-pointer font-semibold text-sm">Añadir jugadores a esta plantilla</summary><div className="mt-3"><div className="relative"><Search size={18} className="absolute left-3 top-3 text-slate-400"/><input value={playerQuery} onChange={e=>setPlayerQuery(e.target.value)} placeholder="Escribe al menos 2 letras del nombre..." aria-label="Buscar jugadores" className="w-full rounded-lg border bg-white p-2.5 pl-10"/></div>{playerQuery.trim().length>=2&&<div className="max-h-64 overflow-auto mt-2 rounded-lg border bg-white">{candidates.length===0?<p className="p-3 text-sm text-slate-500">Sin resultados disponibles.</p>:candidates.map(p=><div className="flex items-center gap-3 p-2 border-b last:border-0" key={p.id}>{playerImage(p)?<img src={playerImage(p)} alt="" className="w-9 h-9 rounded-full object-cover"/>:<div className="w-9 h-9 rounded-full bg-slate-200"/>}<span className="flex-1 text-sm font-medium">{p.name} <span className="text-slate-400">{p.position||""}</span></span><button disabled={busy} title="Añadir jugador" onClick={()=>add(p)} className="rounded-lg bg-blue-700 text-white p-2 disabled:opacity-50"><Plus size={16}/></button></div>)}</div>}</div>

          </details>
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
