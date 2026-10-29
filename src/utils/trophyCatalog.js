// Catalog imported from the user's original 2,181-row semicolon CSV.
// Identity is always source_id, never translated names or image filenames.
export const TROPHY_CSV_URL="https://media.base44.com/files/public/6a88359fd43f2af862874b12/7f131ea8b_relacion_trofeos.csv";
export const TROPHY_TYPES=["Team Trophy","Individual Trophy"];
export const TROPHY_CATEGORIES=["League","Cup","Supercup","International","Individual Award","Other"];
const safe=v=>String(v??"").trim();
export const normaliseSearch=v=>safe(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
export const trophyImagePath=id=>"/assets/trophies/"+encodeURIComponent(safe(id))+".png";
const TROPHY_IMAGE_REPO="https://raw.githubusercontent.com/Miguelpasitos98/My-Legacy/main/";
export const trophySourceImageUrl=sourcePath=>{
 const path=safe(sourcePath).replace(/\\\\/g,"/");
 if(!path.startsWith("Trofeos identificados/")||! /\.(png|webp|jpe?g)$/i.test(path))return "";
 return TROPHY_IMAGE_REPO+path.split("/").map(encodeURIComponent).join("/");
};
export const trophyImageUrl=(trophy,manifest)=>{
 const custom=safe(trophy?.image_url);if(custom)return custom;
 const id=safe(trophy?.source_id);
 const direct=trophySourceImageUrl(trophy?.source_path);
 if(direct)return direct;
 if(manifest?.byId?.[id])return manifest.byId[id];
 const names=[trophy?.source_name,trophy?.name, String(trophy?.source_path||"").split("/").pop()?.replace(/\.(png|webp|jpe?g)$/i,"")];
 for(const label of names){
  const key=normaliseSearch(label).replace(/\s*\(id\s*\d+\)\s*/ig," ").replace(/[^a-z0-9]+/g," ").trim();
  if(key&&manifest?.byName?.[key])return manifest.byName[key];
 }
 return trophyImagePath(id);
};
export const trophyStatus=trophy=>trophy?.identification_status||"Pending";

function parseDelimited(text,delimiter=";"){
 const data=[],row=[];let value="",quoted=false;
 const src=String(text||"").replace(/^\uFEFF/,"");
 for(let i=0;i<src.length;i++){
  const c=src[i];
  if(c==='"'){if(quoted&&src[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(c===delimiter&&!quoted){row.push(value);value="";}
  else if((c==="\n"||c==="\r")&&!quoted){
   if(c==="\r"&&src[i+1]==="\n")i++;
   row.push(value);if(row.some(Boolean))data.push([...row]);row.length=0;value="";
  }else value+=c;
 }
 if(value||row.length){row.push(value);data.push(row);}
 return data;
}
export function parseTrophyCatalog(csv){
 const rows=parseDelimited(csv);
 if(!rows.length)throw Error("El archivo de trofeos está vacío.");
 const labels=rows.shift().map(normaliseSearch);
 const idCol=labels.findIndex(x=>x.includes("id original"));
 const nameCol=labels.findIndex(x=>x.includes("nombre del trofeo"));
 const pathCol=labels.findIndex(x=>x.includes("ruta del archivo"));
 const statusCol=labels.findIndex(x=>x==="estado");
 if([idCol,nameCol,pathCol,statusCol].some(x=>x<0))throw Error("Cabeceras de trofeos desconocidas.");
 const found=new Set(),result=[];
 for(const line of rows){
  const source_id=safe(line[idCol]);if(!source_id||found.has(source_id))continue;
  found.add(source_id);
  const name=safe(line[nameCol]);
  const importedStatus=safe(line[statusCol]);
  result.push({
    source_id,name:name||"Trofeo sin identificar · "+source_id,
    source_name:name,source_path:safe(line[pathCol]),
    identification_status:importedStatus==="Pendiente de verificar"?"Pending":"Verified",
    trophy_type:"",image_url:"",country:"",organizer:"",category:"",description:"",
    is_imported:true
  });
 }
 return result;
}
export const mergeTrophyCatalog=(catalog,customRows)=>{
 const records=new Map((catalog||[]).map(x=>[String(x.source_id),x]));
 for(const db of customRows||[]){
  const id=safe(db.source_id);if(!id)continue;
  records.set(id,{...(records.get(id)||{}),...db,source_id:id,is_imported:Boolean(records.get(id))});
 }
 return [...records.values()];
};
