import {normaliseSearch} from "./trophyCatalog";

// Only explicit federation / competition signals; ambiguous historical names remain unclassified.
const CONTINENTAL=[
 ["UEFA",/\b(uefa|champions league|liga de campeones de europa|europa league|conference league|eurocopa|european championship|supercopa de europa|supercopa europea|nations league de europa|recopa de europa|copa intertoto)\b/],
 ["CONMEBOL",/\b(conmebol|libertadores|sudamericana|recopa sudamericana|copa america|copa mercosur|copa merconorte)\b/],
 ["CONCACAF",/\b(concacaf|copa oro|gold cup|leagues cup|copa centroamericana|copa del caribe)\b/],
 ["CAF",/\b(caf|african champions league|liga de campeones de la caf|copa africana|africa cup of nations|recopa africana)\b/],
 ["AFC",/\b(afc|asian cup|copa asiatica|liga de campeones de asia|afc champions league)\b/],
 ["OFC",/\b(ofc|oceania champions league|liga de campeones de oceania|copa de naciones de oceania)\b/]
];
const WORLD=/\b(fifa|copa mundial|mundial de clubes|mundial sub.?\d+|copa del mundo|world cup|club world cup|intercontinental cup|copa intercontinental|confederations cup|copa confederaciones)\b/;
const COUNTRY_RULES=[
 ["Inglaterra",/\b(premier league de inglaterra|efl |fa cup|carabao cup|community shield|national league de inglaterra)\b/],
 ["España",/\b(laliga|la liga|copa del rey|supercopa de espana|primera federacion|segunda federacion|primera division de espana|segunda division de espana)\b/],
 ["Alemania",/\b(bundesliga|dfb.pokal|supercopa de alemania|regionalliga|oberliga|3\. liga)\b/],
 ["Italia",/\b(serie a|serie b|serie c|coppa italia|copa de italia|supercoppa italiana)\b/],
 ["Francia",/\b(ligue 1|ligue 2|copa de francia|coupe de france|trofeo de campeones de francia|championnat national)\b/],
 ["Portugal",/\b(primeira liga|liga portugal|taca de portugal|supertaca de portugal|liga portugal 2)\b/],
 ["Países Bajos",/\b(eredivisie|eerste divisie|knvb|copa de los paises bajos)\b/],
 ["Brasil",/\b(brasileirao|copa de brasil|campeonato carioca|campeonato paulista|serie a de brasil|serie b de brasil)\b/],
 ["Argentina",/\b(liga profesional de argentina|primera nacional|copa argentina|copa de la liga argentina|federal a)\b/],
 ["Estados Unidos",/\b(mls|major league soccer|us open cup|usl championship|usl league one|usl2 )\b/],
 ["México",/\b(liga mx|liga ascenso de mexico|copa mx|interliga|fase pre.libertadores)\b/],
 ["Japón",/\b(j1 league|j2 league|j3 league|copa del emperador de japon|copa de la liga de japon|nippon soccer league)\b/],
 ["Suiza",/\b(superliga de suiza|challenge league|copa de suiza)\b/],
 ["Austria",/\b(bundesliga de austria|segunda liga de austria|copa de austria)\b/]
];
export const classifyTrophy=(trophy,leagues=[],countries=[])=>{
 const name=normaliseSearch(trophy.name||trophy.source_name);
 const organization=normaliseSearch(trophy.organizer);
 const key=name+" "+organization;
 if(WORLD.test(key))return {key:"fifa",title:"FIFA · Mundial",kind:"world",rank:0};
 for(let i=0;i<CONTINENTAL.length;i++){
  const [label,re]=CONTINENTAL[i];
  if(re.test(key))return {key:"confed:"+label,title:label,kind:"confederation",rank:i+1};
 }
 const countryById=new Map(countries.map(c=>[String(c.id),c.name]));
 const cleanCountry=normaliseSearch(trophy.country);
 let country=countries.find(c=>normaliseSearch(c.name)===cleanCountry)?.name||(trophy.country||"").trim();
 const league=leagues.find(l=>String(l.id)===String(trophy.competition_id||""))||
   leagues.find(l=>normaliseSearch(l.name)===name && name.length>3);
 if(!country&&league)country=countryById.get(String(league.country_id))||"";
 if(!country){
   const m=COUNTRY_RULES.find(([,re])=>re.test(key));if(m)country=m[0];
 }
 if(country)return {key:"country:"+normaliseSearch(country),title:country,kind:"country",rank:100};
 return {key:"unclassified",title:"Sin federación o país confirmado",kind:"unclassified",rank:999};
};
export const groupTrophies=(items,leagues=[],countries=[])=>{
 const groups=new Map(),scores=new Map();
 const namesById=new Map(countries.map(c=>[String(c.id),normaliseSearch(c.name)]));
 // A country's reputation is the highest registered top-division reputation, not an invented FIFA ranking.
 for(const league of leagues){
  const country=namesById.get(String(league.country_id));const score=Number(league.reputation);
  if(country&&Number.isFinite(score)&&score>=0&&(Number(league.level)===1||!league.level))
   scores.set(country,Math.max(scores.get(country)||0,score));
 }
 for(const trophy of items){
  const section=classifyTrophy(trophy,leagues,countries);
  if(!groups.has(section.key))groups.set(section.key,{...section,items:[]});
  groups.get(section.key).items.push(trophy);
 }
 return [...groups.values()].sort((a,b)=>{
  if(a.rank!==b.rank)return a.rank-b.rank;
  if(a.kind==="country"&&b.kind==="country"){
   const aScore=scores.get(normaliseSearch(a.title))||0,bScore=scores.get(normaliseSearch(b.title))||0;
   if(aScore!==bScore)return bScore-aScore;
  }
  return a.title.localeCompare(b.title,"es");
 }).map(g=>({...g,items:g.items.sort((a,b)=>a.name.localeCompare(b.name,"es",{numeric:true})),reputation:g.kind==="country"?(scores.get(normaliseSearch(g.title))||null):null}));
};
