// Generate public/trophy-images.json by running: node scripts/sync-trophy-images.mjs
// The source directory may contain IDs or translated trophy names.
// The script never guesses among ambiguous names or changes the original files.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const dir=path.join(root,"public","assets","trophies");
const output=path.join(root,"public","trophy-images.json");
const normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\([^)]*id\s*\d+[^)]*\)/gi,"").replace(/\s+\(id\s*\d+\)/gi,"").replace(/[^a-z0-9]+/g," ").trim();
function list(dir,prefix=""){
 if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>{
  const relative=prefix?prefix+"/"+item.name:item.name;
  if(item.isDirectory())return list(path.join(dir,item.name),relative);
  return /\.(png|webp|jpe?g)$/i.test(item.name)?[relative]:[];
 });
}
const images=list(dir).sort((a,b)=>a.localeCompare(b,"es"));
const byId={},byName={},ambiguous={},files=[];
for(const file of images){
 const basename=path.basename(file).replace(/\.(png|webp|jpe?g)$/i,"");
 const idMatch=basename.match(/(?:^|\s*\()ID\s*(\d+)\)?$/i)||basename.match(/^(\d+)$/);
 const id=idMatch?.[1]||"";
 const friendly=normalize(basename);
 const url="/assets/trophies/"+file.split("/").map(encodeURIComponent).join("/");
 files.push({file,url,id,name:friendly});
 if(id){if(byId[id]&&byId[id]!==url){ambiguous["id:"+id]=[byId[id],url];delete byId[id];}else if(!ambiguous["id:"+id])byId[id]=url;}
 if(friendly){
  if(byName[friendly]&&byName[friendly]!==url){ambiguous["name:"+friendly]=[byName[friendly],url];delete byName[friendly];}
  else if(!ambiguous["name:"+friendly])byName[friendly]=url;
 }
}
const result={version:1,generated_at:new Date().toISOString(),count:images.length,byId,byName,ambiguous};
fs.writeFileSync(output,JSON.stringify(result,null,2)+"\n");
console.log("Trophy files:",images.length,"| ID matches:",Object.keys(byId).length,"| name matches:",Object.keys(byName).length,"| ambiguous:",Object.keys(ambiguous).length);
