import {base44} from "@/api/base44Client";

// Detailed Transfermarkt points are stored as millions of euros, with real dates.
// Never overwrite remote dates with an incomplete browser-only snapshot.
export async function persistMarketHistory(playerId, rows){
 if(!playerId)throw new Error("Falta el identificador del jugador.");
 const latest=await base44.entities.Player.get(playerId);
 if(!latest||String(latest.id)!==String(playerId))throw new Error("No se pudo verificar el jugador en Base44.");
 const normalize=items=>(Array.isArray(items)?items:[]).filter(r=>r&&/^\d{4}-\d{2}-\d{2}$/.test(String(r.date||""))&&Number.isFinite(Number(r.value))&&Number(r.value)>=0)
  .map(r=>({...r,date:String(r.date),value:Number(r.value)}));
 const remote=normalize(latest.market_value_history);
 const incoming=normalize(rows);
 const merged=[...new Map([...remote,...incoming].map(r=>[r.date,r])).values()].sort((a,b)=>a.date.localeCompare(b.date));
 await base44.entities.Player.update(playerId,{market_value_history:merged});
 const check=await base44.entities.Player.get(playerId);
 const saved=normalize(check?.market_value_history);
 if(saved.length!==merged.length||merged.some((r,i)=>saved[i]?.date!==r.date||saved[i]?.value!==r.value))
  throw new Error("Base44 no confirmó el historial completo. Conservamos la copia local para evitar pérdidas.");
 window.localStorage.setItem(`mf-legacy-market-history-preview-v1:${playerId}`,JSON.stringify(saved));
 window.dispatchEvent(new CustomEvent("mf-legacy-market-preview-updated",{detail:{playerId}}));
 return saved;
}
