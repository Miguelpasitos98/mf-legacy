import { createClientFromRequest } from "npm:@base44/sdk";

const SOURCE_SET = new Set(["fotmob", "understat", "fifa", "market"]);
const RUNNING = new Set(["queued", "running"]);
const str = (value) => String(value ?? "").trim();
const reply = (body, status = 200) => Response.json(body, {status, headers: {"Cache-Control": "no-store"}});
const bad = (message, code = 400) => reply({ok:false,error:message},code);
const rows = (value) => Array.isArray(value) ? value : value?.items || value?.data || value?.entities || [];
const normal = (v) => str(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

async function verifiedLink(db, playerId) {
  const related = rows(await db.PlayerFotmobLink.filter({player_id:playerId},undefined,30));
  const exact = related.filter(row => /^[0-9]{1,15}$/.test(str(row.fotmob_player_id)));
  const unique = [...new Set(exact.map(row=>str(row.fotmob_player_id)))];
  if (unique.length !== 1 || related.length !== exact.length) throw Error("La identidad FotMob no es única para este jugador.");
  const pid = unique[0];
  const backlinks = rows(await db.PlayerFotmobLink.filter({fotmob_player_id:pid},undefined,30));
  if (backlinks.some(row=>str(row.player_id)!==playerId)) throw Error("El ID FotMob está asociado a otro jugador.");
  const allowed = new Set(["verified","confirmed","manual","automatic_exact_name_unique"]);
  const approved = exact.some(r=>allowed.has(str(r.verification).toLowerCase()));
  if (!approved) throw Error("La vinculación FotMob necesita revisión.");
  return {pid, automatic:exact.every(r=>str(r.verification).toLowerCase()==="automatic_exact_name_unique")};
}

export default async function(req) {
  if (req.method !== "POST") return bad("Solo POST.",405);
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") return bad("Solo administradores.",403);
    const body = await req.json();
    const action = str(body.action || "start");
    const db = base44.asServiceRole.entities;
    if(action === "health")return reply({ok:true,coordinator:"ready",worker_credentials_configured:String(Deno.env.get("MF_V3_WORKER_TOKEN")||"").length>=32});
    if (action === "start" || action === "retry") {
      const playerId = str(body.player_id);
      if (!/^[a-f0-9]{24}$/i.test(playerId)) return bad("ID interno de jugador no válido.");
      const player = await db.Player.get(playerId);
      if (!player?.id) return bad("Jugador no encontrado.",404);
      const {pid,automatic} = await verifiedLink(db,playerId);
      const sources = action==="retry"
        ? [...new Set((await db.ImportJob.get(str(body.job_id)))?.sources||[])]
        : [...new Set(Array.isArray(body.sources)?body.sources:[])];
      if (sources.length===0 || sources.some(x=>!SOURCE_SET.has(x))) return bad("Fuentes solicitadas no válidas.");
      if (action==="retry") {
        const old=await db.ImportJob.get(str(body.job_id));
        if (!old || old.player_id!==playerId || !["failed","cancelled"].includes(old.status)) return bad("Solo se reintentan trabajos fallidos o cancelados.",409);
      }
      const active=rows(await db.ImportJob.filter({player_id:playerId},undefined,100));
      const running=active.find(j=>RUNNING.has(j.status));
      if (running) return bad("Ya existe una importación activa para este jugador.",409);
      const now = new Date().toISOString();
      const job = await db.ImportJob.create({
        job_key:"mfv3:"+playerId+":"+crypto.randomUUID(),
        player_id:playerId,player_name:player.name,
        fotmob_player_id:pid,sources,status:"queued",progress:0,
        requested_at:now,phase:"Pendiente de recoger por el trabajador Python",
        source_results:Object.fromEntries(sources.map(s=>[s,{status:"pending"}])),
        completed_sources:[],received_candidates:0,
        retry_count:action==="retry"?1:0,
        ...(automatic?{source_results:{...Object.fromEntries(sources.map(s=>[s,{status:"pending"}])),identity:{status:"automatic_exact_name_unique",needs_value_review:true}}}:{})
      });
      return reply({ok:true,job:{id:job.id,status:job.status,player_name:job.player_name,fotmob_player_id:pid}});
    }
    if (action==="release-stale") {
      const job=await db.ImportJob.get(str(body.job_id));
      if(!job)return bad("Trabajo no encontrado.",404);
      if(job.status!=="running"||!job.lease_expires_at||Date.now()<=new Date(job.lease_expires_at).getTime())return bad("El trabajo sigue activo o no tiene vencimiento confirmado.",409);
      await db.ImportJob.update(job.id,{status:"failed",phase:"Trabajador sin respuesta; reintento manual disponible",last_error:"La concesión de procesamiento caducó",finished_at:new Date().toISOString(),claim_id:"",lease_expires_at:""});
      return reply({ok:true,status:"failed"});
    }
    if (action==="cancel") {
      const job=await db.ImportJob.get(str(body.job_id));
      if (!job) return bad("Trabajo no encontrado.",404);
      if (!["queued","running"].includes(job.status)) return bad("No se puede cancelar este trabajo.",409);
      const next=await db.ImportJob.update(job.id,{status:"cancelled",phase:"Cancelado por administrador",finished_at:new Date().toISOString()});
      return reply({ok:true,id:next.id,status:"cancelled"});
    }
    return bad("Acción desconocida.");
  } catch(e) {console.error("import-control error",e);return bad(e?.message || "Error interno.",500);}
}
