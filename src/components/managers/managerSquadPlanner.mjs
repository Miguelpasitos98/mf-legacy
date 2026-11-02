import {managerFitAttributes} from "./managerFitAttributes.mjs";
import {isCustomTeam} from "./managerModel.mjs";
export const PLANNER_ROLES=["GK","CB","FB","DM","AM","WG","ST"];
const map={GK:"GK",DFC:"CB",CB:"CB",LD:"FB",LI:"FB",CRD:"FB",CRI:"FB",CDM:"DM",CM:"DM",CAM:"AM",EI:"WG",ED:"WG",DC:"ST",ST:"ST",CF:"ST"};
export const squadPlannerRole=position=>map[String(position||"").trim().toUpperCase()]||null;
export function planSquad({team,season,players=[],memberships=[],assignments=[],managers=[],profiles=[],previewManagerId="",previewProfileId=""}){
 if(!team||!isCustomTeam(team))return {valid:false,reason:"Solo se admiten clubes personalizados."};
 const rows=memberships.filter(m=>String(m.team_id)===String(team.id)&&m.team_type==="club"&&m.season===season);
 const available=assignments.filter(a=>String(a.team_id)===String(team.id)&&a.team_type==="club"&&a.season===season&&a.is_primary!==false);
 const assignment=available[0]||null;
 // A temporary scouting selection is independent of the club's official
 // manager assignment. Never persist it from the planner.
 const managerId=previewManagerId||assignment?.manager_id||"";
 const manager=managers.find(m=>String(m.id)===String(managerId))||null;
 const availableProfiles=manager?profiles.filter(p=>String(p.manager_id)===String(manager.id)):[];
 const requestedProfileId=previewManagerId?previewProfileId:
   previewProfileId||assignment?.tactical_profile_id;
 const profile=availableProfiles.find(p=>String(p.id)===String(requestedProfileId))||
   availableProfiles.find(p=>p.is_default)||availableProfiles[0]||null;
 const index=new Map(players.map(p=>[String(p.id),p]));
 const byRole=Object.fromEntries(PLANNER_ROLES.map(role=>[role,[]]));
 const unknown=[];
 for(const m of rows){
  const player=index.get(String(m.player_id));
  if(!player)continue;
  const role=squadPlannerRole(m.primary_position||player.position);
  if(!role){unknown.push(player);continue;}
  const rating=profile?managerFitAttributes(player,role,profile):null;
  byRole[role].push({player,membership:m,role,score:rating?.score??null,coverage:rating?.coverage??0,confidence:rating?.confidence||"insufficient"});
 }
 const roleSummary=PLANNER_ROLES.map(role=>{
  const roster=byRole[role];
  const scored=roster.filter(x=>x.score!==null).sort((a,b)=>b.score-a.score);
  const best=scored[0]||null;
  const needsReview=!roster.length?"empty":!scored.length?"missing_data":best.score<60?"low_fit":"covered";
  return {role,count:roster.length,evaluated:scored.length,best,needsReview,roster};
 });
 return {valid:true,team,season,assignment,manager,profile,temporaryManager:Boolean(previewManagerId),
  roleSummary,unknown,rosterCount:rows.length,linkedCount:roleSummary.reduce((n,r)=>n+r.count,0)};
}
