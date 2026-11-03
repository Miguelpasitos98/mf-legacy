// Safe image resolution and metadata for trophy image overrides.
// "wrong" and "missing" intentionally suppress old automatic artwork.
const text=value=>String(value??"").trim();
export const TROPHY_IMAGE_STATUSES=["auto","provisional","verified","wrong","missing"];
export const statusOf=trophy=>TROPHY_IMAGE_STATUSES.includes(trophy?.image_status)?trophy.image_status:"auto";
export const isImageUrl=value=>{
 const url=text(value);
 if(!url)return false;
 if(url.startsWith("/")&&!url.startsWith("//"))return !/[\s<>]/.test(url);
 try{const parsed=new URL(url);return parsed.protocol==="https:"&&Boolean(parsed.hostname);}catch{return false;}
};
export const overrideFor=trophy=>{
 const src=text(trophy?.image_override_url);
 return isImageUrl(src)?src:"";
};
export const trophyImageShouldHide=trophy=>["wrong","missing"].includes(statusOf(trophy))&&!overrideFor(trophy);
export const trophyImageSummary=trophy=>({
 status:statusOf(trophy),override:overrideFor(trophy),
 source:overrideFor(trophy)?"manual":text(trophy?.image_url)?"legacy":"catalog",
 needsReview:["wrong","missing","provisional"].includes(statusOf(trophy))
});
export const prepareTrophyImageUpdate=(draft,{timestamp=new Date().toISOString()}={})=>{
 const status=statusOf(draft),image_override_url=text(draft?.image_override_url);
 if(image_override_url&&!isImageUrl(image_override_url))throw Error("Introduce una URL de imagen HTTPS válida o una ruta interna de la aplicación.");
 if(status==="verified"&&!image_override_url)throw Error("Para verificar una sustitución, sube primero una imagen o introduce su URL.");
 if(["wrong","missing"].includes(status)&&image_override_url)throw Error("Para marcar una imagen como incorrecta o ausente, retira primero la sustitución.");
 return {
  image_override_url,
  image_status:status,
  image_source_type:image_override_url?(draft?.image_source_type||"url"):(draft?.image_source_type||"catalog"),
  image_source_reference:text(draft?.image_source_reference),
  image_notes:text(draft?.image_notes),
  image_last_reviewed_at:timestamp
 };
};
export const legacyTrophyImageStatus=trophy=>statusOf(trophy);
