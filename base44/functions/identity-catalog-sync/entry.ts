import {createClientFromRequest} from 'npm:@base44/sdk';
import {secrets} from 'base44:runtime';
import {upsertBatch,applyApprovedLinks,identitySnapshot} from './core.js';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function hash(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function same(a,b){const x=String(a||''),y=String(b||'');let diff=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x.charCodeAt(i)||0)^(y.charCodeAt(i)||0);return diff===0;}
export default async function(req){
  if(req.method!=='POST')return reply({ok:false,error:'Solo POST.'},405);
  const configured=String(secrets.get('MF_V3_WORKER_TOKEN')||'');
  if(configured.length<32||!same(req.headers.get('X-MF-Worker-Token'),configured))return reply({ok:false,error:'Credencial del trabajador no válida.'},401);
  try{
    const text=await req.text();if(text.length>220000)return reply({ok:false,error:'Lote demasiado grande.'},413);
    let body;try{body=JSON.parse(text);}catch{return reply({ok:false,error:'JSON inválido.'},400);}
    if(body.action==='health')return reply({ok:true,scope:'identity_catalog_only',player_mutations:false});
    if(body.action==='snapshot'){
      const client=createClientFromRequest(req);
      return reply({ok:true,snapshot:await identitySnapshot(client.asServiceRole.entities)});
    }
    if(body.action==='link-approved'){
      const client=createClientFromRequest(req);
      return reply({ok:true,...await applyApprovedLinks(client.asServiceRole.entities,body.rows)});
    }
    if(body.action!=='upsert')return reply({ok:false,error:'Acción no admitida.'},400);
    if(!['fotmob','fm26'].includes(body.kind))return reply({ok:false,error:'Catálogo no admitido.'},400);
    const client=createClientFromRequest(req);
    const entity=body.kind==='fotmob'?client.asServiceRole.entities.FotmobCatalogPlayer:client.asServiceRole.entities.Fm26IdentityCandidate;
    return reply({ok:true,...await upsertBatch(entity,body.kind,body.rows,hash)});
  }catch(error){
    const message=String(error?.message||error);console.error('identity-catalog-sync:',message);
    if(/rate limit|too many requests/i.test(message))return Response.json({ok:false,error:message},{status:429,headers:{'Retry-After':String(Number(message.match(/Retry after (\d+)s/i)?.[1]||10)),'Cache-Control':'no-store'}});
    return reply({ok:false,error:message},400);
  }
}

