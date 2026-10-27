import {nationalCompetition} from "./statsViews.js";
const text=v=>String(v??"").trim();
const key=v=>text(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
export function nationalCategoryForCompetition(name){
 const x=key(name);
 if(/(?:u17|under17|sub17)/.test(x))return "u17";
 if(/(?:u20|under20|sub20)/.test(x))return "u20";
 if(/(?:u21|under21|sub21)/.test(x))return "u21";
 if(/(?:u23|under23|sub23|olympic|olimpic|juegosolimpicos)/.test(x))return "u23";
 return "senior";
}
export function nationalLinkPlan({player,records=[],nationalTeams=[]}={}){
 const country=text(player?.country_id);
 if(!country)return [];
 return records.filter(r=>r?.id&&nationalCompetition(r.competition)&&
  !text(r.national_team_id)&&!text(r.national_country_id)&&
  text(r.player_id)===text(player.id)).flatMap(r=>{
   const category=nationalCategoryForCompetition(r.competition);
   const candidates=nationalTeams.filter(t=>text(t.country_id)===country&&key(t.category||"senior")===category);
   if(candidates.length!==1)return [];
   const nt=candidates[0];
   return [{id:r.id,player_id:r.player_id,season:r.season,competition:r.competition,
    patch:{national_team_id:text(nt.id),national_country_id:country,team_id:"",team_name:text(nt.name)}}];
  });
}
