import {createClientFromRequest} from "npm:@base44/sdk";
import {reply,validateManagerAIRequest,normalizeAIGenerationResult} from "./core.mjs";

export default async function(req){
 if(req.method!=="POST")return reply({ok:false,error:"Solo POST."},405);
 try{
   const sdk=createClientFromRequest(req);
   const me=await sdk.auth.me();
   if(!me || me.role!=="admin")return reply({ok:false,error:"Solo administradores pueden generar contenido con IA."},403);
   let body;
   try {body=await req.json();}catch{return reply({ok:false,error:"JSON inválido."},400);}
   let input;
   try {input=validateManagerAIRequest(body);}catch(e){return reply({ok:false,error:e.message},400);}
   if(input.mode==="tactical"){
     const manager=await sdk.asServiceRole.entities.Manager.get(input.manager_id);
     if(!manager?.id || manager.name!==input.name)return reply({ok:false,error:"La investigación debe corresponder al entrenador guardado."},409);
   }
   // InvokeLLM is blocked in the browser. It must be invoked using the
   // platform service-role API in a server-side Base44 function.
   const raw=await sdk.asServiceRole.integrations.Core.InvokeLLM({
     prompt:input.prompt,
     add_context_from_internet:input.mode==="biography" || body.manager_kind!=="fictional"
   });
   const response=normalizeAIGenerationResult(raw);
   // Return draft content only: this function NEVER saves Manager or profiles.
   return reply({ok:true,mode:input.mode,response});
 }catch(error){
   const message=String(error?.message||"");
   console.error("manager-ai generation failed:",message.slice(0,360));
   if(/rate limit|too many requests/i.test(message))return reply({ok:false,error:"Se alcanzó el límite de solicitudes. Inténtalo más tarde."},429);
   if(/not enabled|not configured|integration credits|billing|quota/i.test(message))return reply({ok:false,error:"La generación de IA no está disponible para esta aplicación. Revisa el acceso o los créditos de integración en Base44."},503);
   return reply({ok:false,error:"El servicio de IA no pudo generar el borrador. Puedes usar la opción Copiar prompt para ChatGPT."},502);
 }
}
