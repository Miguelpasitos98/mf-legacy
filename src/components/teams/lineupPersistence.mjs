/**
 * Safe, incremental persistence of one tactical XI.
 * Reuses existing slot records instead of creating and deleting all 11
 * on every save (the old algorithm caused duplicate records and failures).
 * Operations are repeatable: retrying doesn't create duplicate slots.
 */
export const lineupRows=async(entity,filter)=>{
 const out=[],seen=new Set();
 for(let skip=0;skip<=100000;skip+=200){
  const response=await entity.filter(filter,undefined,200,skip);
  const rows=Array.isArray(response)?response:response?.items||response?.data||[];
  if(!Array.isArray(rows))throw Error("Respuesta incorrecta al cargar la alineación.");
  for(const row of rows){
   if(!row?.id||seen.has(String(row.id)))throw Error("Registros repetidos en la lectura de la alineación.");
   seen.add(String(row.id));out.push(row);
  }
  if(rows.length<200)return out;
 }
 throw Error("Se superó el límite seguro de registros de alineación.");
};

const equal=(a,b)=>String(a??"")===String(b??"");
const changed=(old,next,fields)=>fields.some(field=>!equal(old[field],next[field]));
const choose=rows=>rows.slice().sort((a,b)=>String(b.updated_date||b.created_date||"").localeCompare(String(a.updated_date||a.created_date||"")))[0];
export async function reconcileLineupChildren({slotEntity,benchEntity,lineupId,slots,bench}){
 const oldSlots=await lineupRows(slotEntity,{lineup_id:lineupId});
 const oldBench=await lineupRows(benchEntity,{lineup_id:lineupId});
 const creations=[];
 const rollback=[];
 const duplicateSlots=[],duplicateBench=[];
 const slotsByCode=new Map(),benchByPlayer=new Map();
 for(const row of oldSlots){
  const k=String(row.slot_code||"");
  if(!slotsByCode.has(k))slotsByCode.set(k,[]);
  slotsByCode.get(k).push(row);
 }
 for(const row of oldBench){
  const k=String(row.player_id||"");
  if(!benchByPlayer.has(k))benchByPlayer.set(k,[]);
  benchByPlayer.get(k).push(row);
 }
 const wantedSlots=new Set(slots.map(s=>s.slot_code));
 const wantedBench=new Set(bench.map(s=>String(s.player_id)));
 for(const [key,rows] of slotsByCode) {
  const keeper=choose(rows);
  if(!wantedSlots.has(key))duplicateSlots.push(...rows);
  else duplicateSlots.push(...rows.filter(x=>x.id!==keeper.id));
 }
 for(const [key,rows] of benchByPlayer){
  const keeper=choose(rows);
  if(!wantedBench.has(key))duplicateBench.push(...rows);
  else duplicateBench.push(...rows.filter(x=>x.id!==keeper.id));
 }
 try{
  // Existing rows updated in place; only genuinely new slots require CREATE.
  for(const row of slots){
   const previous=choose(slotsByCode.get(row.slot_code)||[]);
   if(previous){
    if(changed(previous,row,["player_id","x_position","y_position","display_order"])){
     // Snapshot BEFORE update: some SDK caches mutate the original object.
     const snapshot={
      player_id:previous.player_id,slot_code:previous.slot_code,
      x_position:previous.x_position,y_position:previous.y_position,
      display_order:previous.display_order
     };
     await slotEntity.update(previous.id,row);
     rollback.push({entity:slotEntity,id:previous.id,row:snapshot});
    }
   }else{
    const created=await slotEntity.create({lineup_id:lineupId,...row});
    if(!created?.id)throw Error("La base no confirmó el nuevo puesto "+row.slot_code);
    creations.push({entity:slotEntity,id:created.id});
   }
  }
  for(const row of bench){
   const previous=choose(benchByPlayer.get(String(row.player_id))||[]);
   if(previous){
    if(changed(previous,row,["bench_order"])){
     const oldOrder=previous.bench_order;
     await benchEntity.update(previous.id,{bench_order:row.bench_order});
     rollback.push({entity:benchEntity,id:previous.id,row:{bench_order:oldOrder}});
    }
   }else{
    const created=await benchEntity.create({lineup_id:lineupId,...row});
    if(!created?.id)throw Error("La base no confirmó el suplente.");
    creations.push({entity:benchEntity,id:created.id});
   }
  }
 }catch(error){
  const result=await Promise.allSettled([
   ...creations.map(c=>c.entity.delete(c.id)),
   ...rollback.reverse().map(r=>r.entity.update(r.id,r.row))
  ]);
  throw new Error((error.message||"Error al guardar los jugadores")+
   (result.some(r=>r.status==="rejected")?" No se pudo revertir todo: revisa los cambios antes de repetir.":" Se han revertido los cambios parciales."));
 }
 // Only delete genuinely removed slots once wanted state is stored.
 const removed=await Promise.allSettled([
  ...duplicateSlots.map(r=>slotEntity.delete(r.id)),
  ...duplicateBench.map(r=>benchEntity.delete(r.id))
 ]);
 if(removed.some(x=>x.status==="rejected"))throw Error(
  "Los jugadores nuevos se guardaron, pero algunos antiguos no pudieron eliminarse. Revisa el once y vuelve a guardarlo.");
 return {slots:slots.length,bench:bench.length,removed:duplicateSlots.length+duplicateBench.length};
}
