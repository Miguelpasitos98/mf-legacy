import {createClientFromRequest} from "npm:@base44/sdk";

// Únicamente comunica si el jugador tiene al menos un registro REAL en
// PlayerSeasonStats; no se consideran valoraciones FIFA/Transfermarkt ni candidatos.
const rows=value=>Array.isArray(value)?value:value?.items||value?.data||value?.entities||[];
const response=(body,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function collectStatsPlayerIds(db,{pageSize=250,maxRows=30000,now=new Date()}={}){
  const unique=new Set();
  // La temporada en curso está oculta en STATS: el distintivo debe reflejar
  // solo los jugadores que tienen al menos una temporada visible.
  const activeSeasonStart=now.getUTCMonth()>=6?now.getUTCFullYear():now.getUTCFullYear()-1;
  for(let skip=0;skip<maxRows;skip+=pageSize){
    const page=rows(await db.PlayerSeasonStats.filter({},"id",pageSize,skip));
    for(const record of page){
      const playerId=String(record?.player_id||"").trim();
      const seasonStart=Number(String(record?.season||"").slice(0,4));
      if(playerId&&seasonStart!==activeSeasonStart)unique.add(playerId);
    }
    if(page.length<pageSize)return [...unique];
  }
  // Nunca devolver un subconjunto como si fuera una comprobación completa.
  throw Error("La colección supera el límite de consulta del distintivo.");
}
export default async function(req){
  if(req.method!=="POST")return response({ok:false,error:"Solo POST"},405);
  try{
    const sdk=createClientFromRequest(req);
    const user=await sdk.auth.me();
    if(!user||user.role!=="admin")return response({ok:false,error:"Sin permiso"},403);
    const player_ids=await collectStatsPlayerIds(sdk.asServiceRole.entities);
    return response({ok:true,player_ids});
  }catch(error){
    console.error("player-stats-presence",error);
    return response({ok:false,error:"No se pudo comprobar la presencia en STATS"},503);
  }
}
