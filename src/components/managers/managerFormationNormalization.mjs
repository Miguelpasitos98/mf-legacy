/**
 * Formation notation shared by AI review, manual Manager DNA and the
 * formation planner. The accepted outfield shape is structural, not a
 * curated whitelist of football systems.
 *
 * The editor/planner stores one canonical numeric shape; human variants
 * remain in profile_notes so "4-4-2 (rombo)" is never silently confused with
 * a flat 4-4-2. No unverified tactical claim is inferred from an unknown tag.
 */
const isString=v=>typeof v==="string"&&v.trim().length>0;
export function normalizeFormationDescription(raw){
 if(!isString(raw))throw Error("Formación ausente o no textual: "+JSON.stringify(raw));
 const original=raw.trim();
 const normalized=original.normalize("NFKC")
  .replace(/[‐‑‒–—−]/g,"-")
  .replace(/^\s*(?:formaci[oó]n|sistema|esquema(?:\s+t[aá]ctico)?)\s*[:：-]?\s*/i,"")
  .trim();
 // The numeric prefix may have human qualifiers: (rombo), diamond, plano,
 // falso nueve, etc. The qualifiers are documented, never discarded.
 const match=normalized.match(/^(\d(?:\s*[-_.\/\s]\s*\d){1,6})(.*)$/);
 if(!match)throw Error("La formación no es válida: "+JSON.stringify(raw)+
  ". Escribe una distribución numérica de diez jugadores, por ejemplo 4-1-2-1-2 (rombo).");
 const numeric=match[1].replace(/[\s_./]+/g,"-").replace(/-+/g,"-").replace(/^-+|-+$/g,"");
 const remainder=match[2].trim();
 const qualifier=remainder.replace(/^[,;:·\s-]+/,"").replace(/^[([]\s*/,"").replace(/[)\]]\s*$/,"").trim();
 const parts=numeric.split("-").map(Number);
 const invalid=parts.length<2||parts.length>7||parts.some((n,i)=>
  !Number.isInteger(n)||n<0||n>6||(i!==parts.length-1&&n===0))||
  parts[0]<2||parts[0]>5||parts.reduce((sum,n)=>sum+n,0)!==10;
 if(invalid)throw Error("La formación no es válida: "+JSON.stringify(raw)+
  ". Se requieren diez futbolistas de campo (sin portero), con una línea defensiva de 2–5 jugadores y sin líneas intermedias vacías.");
 let formation=parts.join("-");
 const tag=qualifier.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const diamond=/\b(rombo|diamante|diamond)\b/.test(tag);
 // 4-4-2 in a midfield diamond is represented as 4-1-2-1-2. We do not
 // treat other 4-4-2 subtypes or 4-3-3 variants as equivalent.
 if(formation==="4-4-2"&&diamond)formation="4-1-2-1-2";
 const changed=formation!==numeric;
 const warning=qualifier||changed?{
  field:"formation",original,fallback:formation,
  reason:changed?"La estructura de 4-4-2 en rombo se representa como 4-1-2-1-2; se conserva la denominación histórica original.":
   "La formación numérica se conserva; la variante descriptiva queda en las notas, porque no está representada en el esquema de posiciones."
 }:null;
 return {formation,original,variant:qualifier,warning};
}
export const normalizeManagerFormation=raw=>normalizeFormationDescription(raw).formation;
