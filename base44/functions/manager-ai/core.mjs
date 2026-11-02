const string = value => String(value ?? "").trim();
export const reply = (value,status=200) => Response.json(value,{status,headers:{"Cache-Control":"private, no-store"}});
export const validateManagerAIRequest = body => {
 if(!body || typeof body!=="object" || Array.isArray(body))throw Error("Solicitud inválida.");
 if(!["biography","tactical"].includes(body.mode))throw Error("Tipo de investigación no admitido.");
 const prompt=string(body.prompt),name=string(body.name);
 if(name.length<2||name.length>160)throw Error("Nombre de entrenador inválido.");
 if(prompt.length<100||prompt.length>12500)throw Error("El prompt debe tener entre 100 y 12.500 caracteres.");
 if(!prompt.includes("MF LEGACY") || !prompt.includes(name))throw Error("El prompt debe describir al entrenador seleccionado.");
 if(body.mode==="tactical" && !/^[a-f0-9]{24}$/i.test(string(body.manager_id)))
   throw Error("Selecciona un entrenador guardado.");
 return {prompt,name,mode:body.mode,manager_id:string(body.manager_id)};
};
export function normalizeAIGenerationResult(result){
 if(result==null)throw Error("El servicio de IA ha devuelto una respuesta vacía.");
 const value=result && typeof result==="object" ? result.response ?? result.result ?? result.text ?? result : result;
 if(typeof value==="string"){
   if(!value.trim())throw Error("El servicio de IA no devolvió contenido.");
   return value.trim();
 }
 if(typeof value==="object" && value!==null && !Array.isArray(value))return value;
 throw Error("Respuesta del servicio de IA no reconocida.");
}
