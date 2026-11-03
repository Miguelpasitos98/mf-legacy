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

export function parseTrophyImageCsv(csv){
 const source=String(csv||"").replace(/^\uFEFF/,"");
 const first=source.split(/\r?\n/,1)[0]||"";
 const delimiter=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?";":",";
 const table=[],row=[];let cell="",quoted=false;
 for(let i=0;i<source.length;i++){
  const char=source[i];
  if(char==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(char===delimiter&&!quoted){row.push(cell);cell="";}
  else if((char==="\r"||char==="\n")&&!quoted){if(char==="\r"&&source[i+1]==="\n")i++;row.push(cell);if(row.some(v=>text(v)))table.push([...row]);row.length=0;cell="";}
  else cell+=char;
 }
 if(quoted)throw Error("CSV con comillas sin cerrar.");
 if(cell||row.length){row.push(cell);table.push(row);}
 if(table.length<2)throw Error("El CSV debe contener cabeceras y al menos un trofeo.");
 const columns=table.shift().map(h=>text(h).toLowerCase());
 const idColumn=columns.indexOf("source_id");
 const urlColumn=columns.indexOf("image_override_url");
 const statusColumn=columns.indexOf("image_status");
 if([idColumn,urlColumn,statusColumn].some(n=>n<0))throw Error("Columnas requeridas: source_id, image_override_url, image_status.");
 const col=(r,k)=>{const i=columns.indexOf(k);return i>=0?text(r[i]):"";};
 const seen=new Set(),records=[];
 for(const row of table){
  const source_id=text(row[idColumn]);
  if(!source_id)throw Error("Una fila no tiene source_id.");
  if(seen.has(source_id))throw Error("ID duplicado en el CSV: "+source_id);
  seen.add(source_id);
  const fields={image_override_url:text(row[urlColumn]),image_status:text(row[statusColumn])||"auto",
   image_source_type:col(row,"image_source_type")||"url",
   image_source_reference:col(row,"image_source_reference"),
   image_notes:col(row,"image_notes")};
  if(!TROPHY_IMAGE_STATUSES.includes(fields.image_status))throw Error("Estado de imagen inválido en "+source_id);
  records.push({source_id,...prepareTrophyImageUpdate(fields)});
 }
 if(records.length>100)throw Error("Por seguridad, importa hasta 100 imágenes por lote.");
 return records;
}

