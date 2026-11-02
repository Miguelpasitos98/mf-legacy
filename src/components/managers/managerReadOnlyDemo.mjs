import {planSquad} from "./managerSquadPlanner.mjs";

// References verified against the user's own Base44 catalogue on 2026-11-02.
// The demonstration combines FM26 players with a historical tactical philosophy.
// It is NOT a historical reconstruction and creates zero Base44 records.
export const DEMO_REFERENCES={
 teamId:"6abfeda529b1286f3da213a0",
 managerId:"6ae8c7469539f8ddd25d0cf7",
 profileId:"6ae8dbfc2f32772e47305b34"
};
export const DEMO_TEAM_ID="__mf_legacy_readonly_demo_dortmund__";
export function makeManagerReadOnlyDemo({teams=[],players=[],managers=[],profiles=[],season="2026/2027"}={}){
 const team=teams.find(x=>String(x.id)===DEMO_REFERENCES.teamId);
 const manager=managers.find(x=>String(x.id)===DEMO_REFERENCES.managerId);
 const profile=profiles.find(x=>String(x.id)===DEMO_REFERENCES.profileId&&String(x.manager_id)===String(manager?.id));
 const squad=players.filter(x=>String(x.team_id)===DEMO_REFERENCES.teamId);
 if(!team||!manager||!profile||!squad.length)return {
  valid:false,reason:"No están disponibles todos los registros del Borussia Dortmund, Klopp y su ADN táctico para esta demostración."};
 const virtualTeam={...team,id:DEMO_TEAM_ID,name:`${team.name} · prueba FM26`,is_custom_club:true};
 const memberships=squad.map(player=>({
  team_type:"club",team_id:DEMO_TEAM_ID,player_id:String(player.id),season,
  primary_position:player.position
  // Availability and role are intentionally UNKNOWN, never marked as verified.
 }));
 const assignments=[{
  team_type:"club",team_id:DEMO_TEAM_ID,manager_id:manager.id,
  tactical_profile_id:profile.id,season,is_primary:true
 }];
 return {...planSquad({team:virtualTeam,season,players:squad,memberships,assignments,managers:[manager],profiles:[profile]}),
  isReadOnlyDemo:true,sourceClubName:team.name,sourcePlayerCount:squad.length,
  demoWarning:"Combinación simulada: jugadores asociados al Dortmund en FM26 y ADN histórico de Klopp. No se afirma que fueran su plantilla real ni se conoce la disponibilidad física o contractual de estos jugadores."};
}
