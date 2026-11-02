// base44/functions/manager-ai/entry.js
import { createClientFromRequest } from "npm:@base44/sdk";

// base44/functions/manager-ai/core.mjs
var string = (value) => String(value ?? "").trim();
var reply = (value, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
var validateManagerAIRequest = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw Error("Solicitud inv\xE1lida.");
  if (!["biography", "tactical"].includes(body.mode)) throw Error("Tipo de investigaci\xF3n no admitido.");
  const prompt = string(body.prompt), name = string(body.name);
  if (name.length < 2 || name.length > 160) throw Error("Nombre de entrenador inv\xE1lido.");
  if (prompt.length < 100 || prompt.length > 12500) throw Error("El prompt debe tener entre 100 y 12.500 caracteres.");
  if (!prompt.includes("MF LEGACY") || !prompt.includes(name)) throw Error("El prompt debe describir al entrenador seleccionado.");
  if (body.mode === "tactical" && !/^[a-f0-9]{24}$/i.test(string(body.manager_id)))
    throw Error("Selecciona un entrenador guardado.");
  return { prompt, name, mode: body.mode, manager_id: string(body.manager_id) };
};
function normalizeAIGenerationResult(result) {
  if (result == null) throw Error("El servicio de IA ha devuelto una respuesta vac\xEDa.");
  const value = result && typeof result === "object" ? result.response ?? result.result ?? result.text ?? result : result;
  if (typeof value === "string") {
    if (!value.trim()) throw Error("El servicio de IA no devolvi\xF3 contenido.");
    return value.trim();
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value;
  throw Error("Respuesta del servicio de IA no reconocida.");
}

// base44/functions/manager-ai/entry.js
async function entry_default(req) {
  if (req.method !== "POST") return reply({ ok: false, error: "Solo POST." }, 405);
  try {
    const sdk = createClientFromRequest(req);
    let me;
    try {
      me = await sdk.auth.me();
    } catch {
      return reply({ ok: false, error: "Es necesario iniciar sesi\xF3n para utilizar la investigaci\xF3n con IA." }, 401);
    }
    if (!me) return reply({ ok: false, error: "Es necesario iniciar sesi\xF3n para utilizar la investigaci\xF3n con IA." }, 401);
    if (me.role !== "admin") return reply({ ok: false, error: "Solo administradores pueden generar contenido con IA." }, 403);
    let body;
    try {
      body = await req.json();
    } catch {
      return reply({ ok: false, error: "JSON inv\xE1lido." }, 400);
    }
    if (body?.action === "health") return reply({ ok: true, service: "manager-ai", status: "ready", writes: false });
    let input;
    try {
      input = validateManagerAIRequest(body);
    } catch (e) {
      return reply({ ok: false, error: e.message }, 400);
    }
    if (input.mode === "tactical") {
      const manager = await sdk.asServiceRole.entities.Manager.get(input.manager_id);
      if (!manager?.id || manager.name !== input.name) return reply({ ok: false, error: "La investigaci\xF3n debe corresponder al entrenador guardado." }, 409);
    }
    const raw = await sdk.asServiceRole.integrations.Core.InvokeLLM({
      prompt: input.prompt,
      add_context_from_internet: input.mode === "biography" || body.manager_kind !== "fictional"
    });
    const response = normalizeAIGenerationResult(raw);
    return reply({ ok: true, mode: input.mode, response });
  } catch (error) {
    const message = String(error?.message || "");
    console.error("manager-ai generation failed:", message.slice(0, 360));
    if (/rate limit|too many requests/i.test(message)) return reply({ ok: false, error: "Se alcanz\xF3 el l\xEDmite de solicitudes. Int\xE9ntalo m\xE1s tarde." }, 429);
    if (/not enabled|not configured|integration credits|billing|quota/i.test(message)) return reply({ ok: false, error: "La generaci\xF3n de IA no est\xE1 disponible para esta aplicaci\xF3n. Revisa el acceso o los cr\xE9ditos de integraci\xF3n en Base44." }, 503);
    return reply({ ok: false, error: "El servicio de IA no pudo generar el borrador. Puedes usar la opci\xF3n Copiar prompt para ChatGPT." }, 502);
  }
}
export {
  entry_default as default
};
