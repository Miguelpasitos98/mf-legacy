/**
 * Manual project decisions, intentionally independent of statistical scores,
 * real clubs, FM attributes and TeamManagerAssignment.
 */
export const ACTIVE_ASSIGNMENT_STATUSES=new Set(["linked","preselected"]);
const str=value=>String(value??"");
export const activeAssignment=row=>Boolean(row&&ACTIVE_ASSIGNMENT_STATUSES.has(row.status));
export function indexManagerPlayerAssignments(rows=[]){
 const byPlayer=new Map(),conflicts=new Set();
 for(const row of rows){
  const id=str(row?.player_id);
  if(!id)continue;
  if(!byPlayer.has(id))byPlayer.set(id,[]);
  byPlayer.get(id).push(row);
 }
 const current=new Map();
 for(const [id,items] of byPlayer){
  const active=items.filter(activeAssignment);
  if(active.length>1){conflicts.add(id);continue}
  // An inactive record is retained to carry the decision history.
  if(items.length>1){conflicts.add(id);continue}
  if(items.length)current.set(id,items[0]);
 }
 return {byPlayer:current,conflicts};
}
export function filterManagerPlayerAssignments(rows,assignmentIndex,managerId,filter="available"){
 const chosen=str(managerId);
 return rows.filter(item=>{
  const pid=str(item?.player?.id);
  const assignment=assignmentIndex.byPlayer.get(pid);
  if(filter==="all")return true;
  if(assignmentIndex.conflicts.has(pid))return filter==="all";
  if(filter==="available")return !activeAssignment(assignment);
  if(filter==="linked")return assignment?.status==="linked"&&str(assignment.manager_id)===chosen;
  if(filter==="preselected")return assignment?.status==="preselected"&&str(assignment.manager_id)===chosen;
  return true;
 });
}
export function countManagerPlayerAssignments(index,managerId){
 let linked=0,preselected=0,occupied=0;
 for(const item of index.byPlayer.values()){
  if(!activeAssignment(item))continue;
  occupied++;
  if(str(item.manager_id)===str(managerId)){
   if(item.status==="linked")linked++;
   if(item.status==="preselected")preselected++;
  }
 }
 return {linked,preselected,occupied,conflicts:index.conflicts.size};
}
const asRows=value=>Array.isArray(value)?value:value?.data||value?.items||[];
export async function saveManagerPlayerDecision(entity,options){
 const {playerId,managerId,profileId="",role,action,confirmReassign=false}=options||{};
 if(!playerId||!managerId||!["GK","CB","FB","DM","AM","WG","ST"].includes(role))
  throw Error("La decisión necesita jugador, entrenador y rol válido.");
 if(!["link","preselect","release"].includes(action))throw Error("Acción de adjudicación desconocida.");
 const existing=asRows(await entity.filter({player_id:str(playerId)},undefined,20,0));
 if(existing.length>1)throw Error("Existen registros duplicados de adjudicación: revisa este jugador antes de continuar.");
 const current=existing[0]||null;
 if(action==="release"&&(!activeAssignment(current)||str(current.manager_id)!==str(managerId)))
  throw Error("Solo puedes liberar una vinculación activa del entrenador seleccionado.");
 const other=activeAssignment(current)&&str(current.manager_id)!==str(managerId);
 if(other&&!confirmReassign)throw Error("El jugador ya pertenece a otro entrenador. Confirma expresamente la reasignación.");
 const nextStatus=action==="link"?"linked":action==="preselect"?"preselected":"released";
 const now=new Date().toISOString();
 const event={at:now,action,from_manager_id:str(current?.manager_id),
  to_manager_id:str(managerId),from_status:str(current?.status),to_status:nextStatus,
  tactical_profile_id:str(profileId),role};
 if(current&&current.status===nextStatus&&str(current.manager_id)===str(managerId)&&
  str(current.tactical_profile_id||"")===str(profileId)&&str(current.role||"")===role)return current;
 const payload={player_id:str(playerId),manager_id:str(managerId),
  tactical_profile_id:str(profileId),role,status:nextStatus,decision_at:now,
  history:[...(Array.isArray(current?.history)?current.history:[]),event]};
 let saved;
 if(current) saved=await entity.update(current.id,payload);
 else saved=await entity.create(payload);
 if(!(saved?.id||saved?.data?.id))throw Error("Base44 no confirmó la adjudicación.");
 // Server state, not button state, is the source of truth.
 const verified=asRows(await entity.filter({player_id:str(playerId)},undefined,20,0));
 if(verified.length!==1||str(verified[0].id)!==str(saved.id||saved.data?.id)||
    verified[0].status!==nextStatus||str(verified[0].manager_id)!==str(managerId))
  throw Error("No se pudo verificar la adjudicación. Actualiza la lista antes de repetir.");
 return verified[0];
}
