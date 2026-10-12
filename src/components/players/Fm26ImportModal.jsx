import React from "react";
import { X } from "lucide-react";
import Fm26ClubPlayers from "./Fm26ClubPlayers";

/**
 * Fm26ImportModal — interfaz del importador FM26 JSON.
 *
 * Componente puramente presentacional. Toda la lógica de lectura,
 * validación, detección de duplicados, equivalencias, creación de
 * entidades y progreso permanece en Players.jsx. Este componente se
 * limita a renderizar la UI e invocar los callbacks recibidos.
 *
 * Props agrupadas por responsabilidad:
 *  - Control del modal
 *  - Archivo y mensajes
 *  - Clubes detectados y selección
 *  - Gestor de equivalencias de países
 *  - Previsualización e importación
 *  - Barra de progreso
 *  - Datos compartidos (teams, countries)
 *  - Funciones helper de normalización
 */

export default function Fm26ImportModal({
  // Control del modal
  fm26ImportOpen,
  setFm26ImportOpen,
  fm26Busy,
  // Archivo y mensajes
  fm26FileName,
  fm26Message,
  fm26Error,
  setFm26Error,
  fm26Import,
  // Clubes detectados y selección
  fm26Clubs,
  fm26ClubChoices,
  setFm26ClubChoices,
  fm26ClubSearch,
  setFm26ClubSearch,
  fm26CreatingClub,
  setFm26CreatingClub,
  fm26NewClubName,
  setFm26NewClubName,
  fm26NewClubCountry,
  setFm26NewClubCountry,
  fm26NewClubLeague,
  setFm26NewClubLeague,
  fm26Leagues,
  handleCreateFm26Club,
  // Gestor de equivalencias de países
  fm26Nations,
  fm26NationMapping,
  setFm26NationMapping,
  fm26NationSearch,
  setFm26NationSearch,
  fm26CreatingNation,
  setFm26CreatingNation,
  fm26NewNation,
  setFm26NewNation,
  fm26CreateNationBusy,
  fm26NationSaveBusy,
  fm26NationSaveMessage,
  setFm26NationSaveMessage,
  fm26NationOnlyPending,
  setFm26NationOnlyPending,
  fm26NationJustSaved,
  saveFm26NationEquivalences,
  handleCreateFm26Nation,
  // Previsualización e importación
  fm26Preview,
  fm26CreateMissing,
  setFm26CreateMissing,
  handleFm26File,
  handleFm26Import,
  // Barra de progreso
  fm26ProgressCurrent,
  fm26ProgressTotal,
  fm26ProgressLabel,
  // Datos compartidos
  teams,
  countries,
  // Funciones helper de normalización
  fm26ClubKey,
  fm26CountryKey,
  FM26_NATION_ISO3,
}) {
  if (!fm26ImportOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={e => { if (e.target === e.currentTarget && !fm26Busy) setFm26ImportOpen(false); }}>
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-extrabold">Importar FM26 JSON</h2><button type="button" disabled={fm26Busy} onClick={() => setFm26ImportOpen(false)}><X size={20}/></button></div>
        <p className="mb-4 text-sm text-slate-600">Carga un JSON de fmsave (players). Detectamos y agrupamos sus clubes, sugerimos coincidencias y te pedimos confirmar el equipo de destino de cada grupo. No modifica fotografías ni salarios anuales.</p>
        <input type="file" accept=".json,application/json" onChange={handleFm26File} disabled={fm26Busy} className="mb-4 w-full text-sm" />
        {fm26FileName && <p className="mb-3 text-xs text-slate-500">Archivo: {fm26FileName}</p>}
        {fm26Import && <div className="mb-4 space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div><p className="text-sm font-extrabold">Equipos detectados en FM26: {fm26Clubs.length}</p><p className="text-xs text-slate-600">Los jugadores están agrupados por ID de club de Football Manager. Elige su equivalente en MF LEGACY o crea uno nuevo. Las sugerencias no se aplican solas.</p></div>
          {fm26Clubs.map(group=>{
            const picked=teams.find(t=>String(t.id)===String(fm26ClubChoices[group.key]));
            const search=fm26ClubSearch[group.key]||"";
            const matches=search.trim()?teams.filter(t=>fm26ClubKey(t.name).includes(fm26ClubKey(search))||fm26ClubKey(t.shortName).includes(fm26ClubKey(search))).slice(0,12):[];
            return <div key={group.key} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold">FM26: {group.name}</p><p className="text-xs text-slate-500">ID {String(group.uid??"desconocido")} · {group.count} jugadores</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${picked?"bg-green-100 text-green-800":"bg-amber-100 text-amber-800"}`}>{picked?`Asignado a ${picked.name}`:"Pendiente de asignar"}</span></div>
              <p className="mt-3 text-xs font-semibold text-slate-600">¿Es alguno de estos equipos?</p>
              <div className="mt-1 flex flex-wrap gap-2">{group.suggestions.length?group.suggestions.map(t=><button key={t.id} type="button" disabled={fm26Busy} onClick={()=>{setFm26ClubChoices(old=>({...old,[group.key]:String(t.id)}));setFm26CreatingClub("");}} className={`rounded-lg border px-3 py-1.5 text-xs ${String(picked?.id)===String(t.id)?"border-green-500 bg-green-50 font-bold":"border-slate-200 hover:bg-blue-50"}`}>{t.name} · {t.score}%</button>):<span className="text-xs text-slate-500">Sin coincidencias cercanas</span>}</div>
              <label className="mt-3 block text-xs font-semibold text-slate-600">Buscar otro equipo</label>
              <input disabled={fm26Busy} value={search} onChange={e=>setFm26ClubSearch(old=>({...old,[group.key]:e.target.value}))} placeholder="Buscar por nombre..." className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" />
              {!!search.trim()&&<div className="mt-1 max-h-32 overflow-y-auto rounded-lg border">{matches.map(t=><button key={t.id} type="button" onClick={()=>{setFm26ClubChoices(old=>({...old,[group.key]:String(t.id)}));setFm26ClubSearch(old=>({...old,[group.key]:""}));setFm26CreatingClub("");}} className="block w-full border-b px-3 py-2 text-left text-xs hover:bg-blue-50">{t.name}</button>)}{!matches.length&&<p className="p-2 text-xs text-slate-500">No hay coincidencias</p>}</div>}
              <div className="mt-2 flex flex-wrap gap-3"><button type="button" className="text-xs font-semibold text-blue-700 underline" onClick={()=>{setFm26CreatingClub(group.key);setFm26NewClubName(group.name);setFm26NewClubCountry("");setFm26NewClubLeague("");}}>Ninguno: crear equipo</button>{picked&&<button type="button" className="text-xs text-slate-500 underline" onClick={()=>setFm26ClubChoices(old=>{const next={...old};delete next[group.key];return next;})}>Quitar asociación</button>}</div>
              {fm26CreatingClub===group.key&&<div className="mt-3 space-y-2 rounded-lg border bg-slate-50 p-3"><p className="text-xs font-bold">Crear equipo en MF LEGACY</p><input value={fm26NewClubName} onChange={e=>setFm26NewClubName(e.target.value)} placeholder="Nombre del equipo" className="w-full rounded border p-2 text-sm"/><select className="w-full rounded border p-2 text-sm" value={fm26NewClubCountry} onChange={e=>setFm26NewClubCountry(e.target.value)}><option value="">Selecciona país</option>{countries.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select className="w-full rounded border p-2 text-sm" value={fm26NewClubLeague} onChange={e=>setFm26NewClubLeague(e.target.value)}><option value="">Selecciona liga</option>{fm26Leagues.map(l=><option key={l.id||l._id} value={l.id||l._id}>{l.name}</option>)}</select><div className="flex gap-2"><button type="button" disabled={fm26Busy} onClick={()=>handleCreateFm26Club(group)} className="rounded bg-[#003399] px-3 py-2 text-xs font-bold text-white">Crear y asociar</button><button type="button" disabled={fm26Busy} onClick={()=>setFm26CreatingClub("")} className="rounded border px-3 py-2 text-xs">Cancelar</button></div></div>}
            <Fm26ClubPlayers group={group} />
            </div>;
          })}
        </div>}
        {fm26Preview && <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-bold">Vista previa de {fm26Preview.rows.length} jugadores</p>
          <p>{fm26Preview.update} para actualizar · {fm26Preview.create} nuevos · {fm26Preview.skipped} omitidos ({fm26Preview.unmapped} sin asociación de club)</p>
          <p className="mt-2 text-xs text-slate-500">Solo se importarán jugadores con grupo asociado. Las coincidencias ambiguas no se modifican. No se borra información que falte en el JSON.</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3">
              <div>
                <p className="text-sm font-extrabold text-slate-900">Gestor de equivalencias · FM26 ↔ MF LEGACY</p>
                <p className="mt-0.5 text-xs text-slate-500">{fm26Nations.filter(item=>item.status==="saved").length} guardadas · {fm26Nations.filter(item=>item.status==="manual").length} por guardar · {fm26Nations.filter(item=>item.status==="unlinked"||item.status==="suggested"||item.status==="conflict").length} pendientes de identificar de {fm26Nations.length}. Guarda para persistir en Country.fm_nation_id.</p>
              </div>
              <button type="button" disabled={fm26NationSaveBusy || fm26CreateNationBusy || fm26Busy} onClick={saveFm26NationEquivalences} className="rounded-lg bg-[#003399] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{fm26NationSaveBusy?"Guardando...":"Guardar equivalencias"}</button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-50 px-4 py-2">
              <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={fm26NationOnlyPending} onChange={e=>setFm26NationOnlyPending(e.target.checked)}/> Solo pendientes de identificar</label>
              <span className="text-xs text-slate-500">Un mismo país no puede recibir dos IDs distintos</span>
            </div>
            {(() => {
              const manualItems = fm26Nations.filter(item => item.status === "manual");
              const savedRecent = fm26Nations.filter(item => item.status === "saved" && fm26NationJustSaved?.has?.(item.id));
              if (!manualItems.length && !savedRecent.length) return null;
              return (
                <div className="border-b bg-blue-50/50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-800">Seleccionados — pendientes de guardar ({manualItems.length})</p>
                    <button type="button" disabled={fm26NationSaveBusy || fm26CreateNationBusy || fm26Busy || !manualItems.length} onClick={saveFm26NationEquivalences} className="rounded-lg bg-[#003399] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">{fm26NationSaveBusy ? "Guardando..." : "Guardar equivalencias"}</button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {manualItems.map(item => (
                      <span key={`m-${item.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {item.country?.name || "—"} · FM {item.id}
                        <button type="button" disabled={fm26Busy || fm26NationSaveBusy} onClick={() => setFm26NationMapping(old => { const n = { ...old }; delete n[item.id]; return n; })} className="text-slate-400 hover:text-red-600" aria-label={`Deshacer ${item.country?.name || ""}`}>×</button>
                      </span>
                    ))}
                    {savedRecent.map(item => (
                      <span key={`s-${item.id}`} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {item.country?.name || "—"} · FM {item.id} · Guardada
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div className="max-h-80 space-y-2 overflow-y-auto p-3">
              {fm26Nations.filter(item=>!fm26NationOnlyPending || item.status==="unlinked" || item.status==="suggested" || item.status==="conflict").map(({id,main,secondary,examples,country,status,conflictDetail})=>{
                const mapped=country;
                const suggestion=FM26_NATION_ISO3[id] || "Sin referencia";
                const query=fm26NationSearch[id]||"";
                const choices=query.trim()?countries.filter(c=>fm26CountryKey(c.name).includes(fm26CountryKey(query))||String(c.code||"").toLowerCase().includes(query.trim().toLowerCase())).slice(0,10):[];
                const selected=fm26NationMapping[id] || "";
                const badgeClass=status==="saved"?"bg-emerald-50 text-emerald-800":status==="suggested"?"bg-blue-50 text-blue-800":status==="manual"?"bg-amber-50 text-amber-800":status==="conflict"?"bg-red-50 text-red-800":"bg-slate-100 text-slate-600";
                const statusLabel=status==="saved"?"Equivalencia guardada en Country.fm_nation_id":status==="suggested"?"Coincidencia probable (sin guardar)":status==="manual"?"Selección manual sin persistir":status==="conflict"?(conflictDetail||"Conflicto de asociación"):"Sin equivalencia confirmada";
                return <div key={id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <strong className="text-sm">FM ID {id}</strong>
                      <p className="text-[11px] text-slate-500">{main} principales · {secondary} secundarias · Referencia: {suggestion}</p>
                      <p className="text-[11px] text-slate-400">{statusLabel}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${badgeClass}`}>{mapped?mapped.name:"Sin vincular"}</span>
                  </div>
                  {!!examples.length && (
                    <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="mb-2 text-[11px] font-bold text-slate-600">Jugadores del JSON con este ID (pistas, no confirmación)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {examples.map((player,index)=>(
                          <span key={`${player.name}-${index}`} title={player.club || ""} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
                            {player.name} <span className="text-slate-400">{player.kind === "main" ? "Principal" : `Secundaria ${Number(player.secondaryIndex) + 1}`}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <input type="text" disabled={fm26Busy||fm26NationSaveBusy||fm26CreateNationBusy} value={query} onChange={e=>setFm26NationSearch(old=>({...old,[id]:e.target.value}))} placeholder="Buscar país por nombre o código (BRA, España...)" className="mt-2 w-full rounded-lg border px-3 py-2 text-xs" />
                  {!!query.trim()&&<div className="mt-1 max-h-40 overflow-y-auto rounded-lg border">{choices.length ? choices.map(country=><button key={country.id} type="button" disabled={fm26Busy||fm26NationSaveBusy||fm26CreateNationBusy} onClick={()=>{setFm26NationMapping(old=>({...old,[id]:String(country.id)}));setFm26NationSearch(old=>({...old,[id]:""}));setFm26NationSaveMessage("");}} className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-xs hover:bg-blue-50"><span>{country.name}</span><span className="text-slate-400">{country.code}</span></button>):<p className="p-2 text-xs text-slate-500">No existe un país coincidente en MF LEGACY.</p>}</div>}
                  {!!query.trim()&&!choices.length&&!mapped&&fm26CreatingNation!==id&&(
                    <button type="button" disabled={fm26Busy||fm26NationSaveBusy||fm26CreateNationBusy}
                      onClick={()=>{setFm26CreatingNation(id);setFm26NewNation({name:query.trim(),code:"",continent:"",flag:""});setFm26Error("");}}
                      className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-40">
                      + Crear país y vincular con FM ID {id}
                    </button>
                  )}
                  {fm26CreatingNation===id&&(
                    <div className="mt-3 space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                      <p className="text-xs font-bold text-blue-900">Crear país nuevo · FM ID {id}</p>
                      <p className="text-[11px] text-slate-600">Comprueba los datos antes de crear. El país y la equivalencia se guardarán juntos; no se modifican otras banderas.</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="text-[11px] font-semibold text-slate-700">Nombre del país
                          <input value={fm26NewNation.name} onChange={e=>setFm26NewNation(old=>({...old,name:e.target.value}))} placeholder="Ej. Camerún" className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-xs" />
                        </label>
                        <label className="text-[11px] font-semibold text-slate-700">Código de 3 letras (ISO)
                          <input maxLength={3} value={fm26NewNation.code} onChange={e=>setFm26NewNation(old=>({...old,code:e.target.value.toUpperCase()}))} placeholder="Ej. CMR" className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-xs uppercase" />
                        </label>
                      </div>
                      <label className="block text-[11px] font-semibold text-slate-700">Continente
                        <select value={fm26NewNation.continent} onChange={e=>setFm26NewNation(old=>({...old,continent:e.target.value}))} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-xs">
                          <option value="">Seleccionar continente</option>
                          {["Europe","South America","North America","Asia","Africa","Oceania"].map(item=><option key={item} value={item}>{item}</option>)}
                        </select>
                      </label>
                      <label className="block text-[11px] font-semibold text-slate-700">URL de bandera (opcional)
                        <input type="url" value={fm26NewNation.flag} onChange={e=>setFm26NewNation(old=>({...old,flag:e.target.value}))} placeholder="https://..." className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-xs" />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" disabled={fm26Busy||fm26NationSaveBusy||fm26CreateNationBusy} onClick={()=>handleCreateFm26Nation(id)} className="rounded-lg bg-[#003399] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">{fm26CreateNationBusy?"Creando...":"Confirmar: crear y vincular"}</button>
                        <button type="button" disabled={fm26CreateNationBusy} onClick={()=>{setFm26CreatingNation("");setFm26Error("");}} className="rounded-lg border bg-white px-3 py-2 text-xs font-medium">Cancelar</button>
                      </div>
                    </div>
                  )}
                  {status==="suggested"&&mapped&&<button type="button" disabled={fm26Busy||fm26NationSaveBusy} onClick={()=>{setFm26NationMapping(old=>({...old,[id]:String(mapped.id)}));setFm26NationSaveMessage("");}} className="mt-2 mr-3 text-xs font-semibold text-blue-700 underline">Confirmar sugerencia: {mapped.name}</button>}
                  {selected&&<button type="button" onClick={()=>setFm26NationMapping(old=>{const next={...old};delete next[id];return next;})} className="mt-2 text-xs text-blue-700 underline">Deshacer selección manual</button>}
                </div>;
              })}
              {fm26NationOnlyPending && fm26Nations.every(item=>item.status==="saved"||item.status==="manual")&&<p className="p-4 text-center text-xs font-semibold text-emerald-700">Todos los países están identificados.{fm26Nations.some(i=>i.status==="manual")?" Revisa las selecciones pendientes de guardar.":""}</p>}
            </div>
            {fm26NationSaveMessage&&<p className="border-t bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">{fm26NationSaveMessage}</p>}
            {fm26Error&&<p className="border-t bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">{fm26Error}</p>}
            <p className="border-t px-4 py-2 text-[11px] text-slate-500">Puedes importar sin identificar los países pendientes: no se asignarán por aproximación. Los nombres de jugadores son pistas para ayudarte, no pruebas del país. Revisa los casos dudosos antes de guardar equivalencias.</p>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={fm26CreateMissing} onChange={e=>setFm26CreateMissing(e.target.checked)}/> Crear jugadores que aún no existan</label>
        </div>}
        {fm26Error && <p className="mb-3 text-sm text-red-700">{fm26Error}</p>}
        {fm26Message && <p className="mb-3 text-sm text-slate-700">{fm26Message}</p>}
        {(fm26Busy || fm26ProgressTotal > 0) && (
          <div className="sticky bottom-0 z-10 -mx-2 mb-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_-10px_28px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-slate-700">
              <span>{fm26ProgressLabel || (fm26Busy ? "Importando jugadores..." : "Importación finalizada")}</span>
              <span>{Math.min(fm26ProgressCurrent, fm26ProgressTotal)}/{fm26ProgressTotal || 0}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#003399] via-[#1d4ed8] to-[#60a5fa] transition-all duration-300"
                style={{ width: `${fm26ProgressTotal ? (Math.min(fm26ProgressCurrent, fm26ProgressTotal) / fm26ProgressTotal) * 100 : 0}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>Progreso de importación jugador a jugador</span>
              <span>{fm26ProgressTotal ? `${Math.round((Math.min(fm26ProgressCurrent, fm26ProgressTotal) / fm26ProgressTotal) * 100)}%` : "0%"}</span>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2"><button type="button" disabled={fm26Busy} onClick={() => setFm26ImportOpen(false)} className="rounded-lg border px-4 py-2">Cerrar</button><button type="button" disabled={!fm26Preview || fm26Preview.unmapped > 0 || fm26Busy || fm26NationSaveBusy || fm26CreateNationBusy} onClick={handleFm26Import} className="rounded-lg bg-[#003399] px-4 py-2 font-semibold text-white disabled:opacity-40">{fm26Busy ? "Importando..." : "Confirmar importación"}</button></div>
      </div>
    </div>
  );
}