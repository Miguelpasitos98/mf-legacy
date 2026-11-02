import {normaliseSearch} from "./trophyCatalog.js";

// Only explicit federation / competition signals; ambiguous historical names remain unclassified.
/** @type {Array<[string, RegExp]>} */
const CONTINENTAL=[
 ["UEFA",/\b(uefa|champions league|liga de campeones de europa|europa league|conference league|eurocopa|european championship|supercopa de europa|supercopa europea|nations league de europa|recopa de europa|copa intertoto)\b/],
 ["CONMEBOL",/\b(conmebol|libertadores|sudamericana|recopa sudamericana|copa america|copa mercosur|copa merconorte)\b/],
 ["CONCACAF",/\b(concacaf|copa oro|gold cup|leagues cup|copa centroamericana|copa del caribe)\b/],
 ["CAF",/\b(caf|african champions league|liga de campeones de la caf|copa africana|africa cup of nations|recopa africana)\b/],
 ["AFC",/\b(afc|asian cup|copa asiatica|liga de campeones de asia|afc champions league)\b/],
 ["OFC",/\b(ofc|oceania champions league|liga de campeones de oceania|copa de naciones de oceania)\b/]
];
const WORLD=/\b(fifa|copa mundial|mundial de clubes|mundial sub.?\d+|copa del mundo|world cup|club world cup|intercontinental cup|copa intercontinental|confederations cup|copa confederaciones)\b/;
// Only explicit national names or adjectives. Unclear countries stay unclassified.
/** @type {Array<[string, RegExp]>} */
const EXPLICIT_COUNTRIES=[
 ["España",/\b(espana|spain|spanish)\b/],
 ["Inglaterra",/\b(inglaterra|england|english)\b/],
 ["Alemania",/\b(alemania|germany|german)\b/],
 ["Francia",/\b(francia|france|french(?!\s+guiana))\b/],
 ["Italia",/\b(italia|italy|italian)\b/],
 ["Portugal",/\b(portugal|portuguese)\b/],
 ["Brasil",/\b(brasil|brazil|brazilian|brasileiro|brasileira)\b/],
 ["Argentina",/\b(argentina|argentine|argentino)\b/],
 ["México",/\b(mexico|mexican|mexicana|mexicano)\b/],
 ["Estados Unidos",/\b(estados unidos|united states|usa|usl)\b/],
 ["Turquía",/\b(turquia|turkey|turkish)\b/],
 ["Grecia",/\b(grecia|greece|greek)\b/],
 ["Croacia",/\b(croacia|croatia|croatian)\b/],
 ["Austria",/\b(austria|austrian)\b/],
 ["Suiza",/\b(suiza|switzerland|swiss)\b/],
 ["Países Bajos",/\b(paises bajos|netherlands|dutch)\b/],
 ["Bélgica",/\b(belgica|belgium|belgian)\b/],
 ["Dinamarca",/\b(dinamarca|denmark|danish)\b/],
 ["Noruega",/\b(noruega|norway|norwegian)\b/],
 ["Suecia",/\b(suecia|sweden|swedish)\b/],
 ["Finlandia",/\b(finlandia|finland|finnish)\b/],
 ["Polonia",/\b(polonia|poland|polish)\b/],
 ["República Checa",/\b(republica checa|czechia|czech)\b/],
 ["Rumanía",/\b(rumania|romania|romanian)\b/],
 ["Escocia",/\b(escocia|scotland|scottish)\b/],
 ["Gales",/\b(gales|wales|welsh)\b/],
 ["Ecuador",/\b(ecuador|ecuadorian|ecuatoriana|ecuatoriano)\b/],
 ["Fiyi",/\b(fiyi|fiji|fijian)\b/],
 ["Singapur",/\b(singapur|singapore|singaporean)\b/],
 ["Tailandia",/\b(tailandia|thailand|thai)\b/],
 ["Argelia",/\b(argelia|algeria|algerian)\b/],
 ["Benín",/\b(benin|beninese)\b/],
 ["Malí",/\b(mali|malian)\b/],
 ["Irlanda",/\b(irlanda|ireland|irish)\b/],
 ["Japón",/\b(japon|japan|japanese)\b/],
 ["Corea del Sur",/\b(corea del sur|south korea|south korean)\b/],
 ["China",/\b(china|chinese)\b/],
 ["Egipto",/\b(egipto|egypt|egyptian)\b/],
 ["Marruecos",/\b(marruecos|morocco|moroccan)\b/],
 ["Sudáfrica",/\b(sudafrica|south africa|south african)\b/],
 ["Chile",/\b(chile|chilean|chileno|chilena)\b/],
 ["Colombia",/\b(colombia|colombian|colombiano)\b/],
 ["Uruguay",/\b(uruguay|uruguayan|uruguayo)\b/],
 ["Perú",/\b(peru|peruvian|peruano)\b/]
];
/** @type {Array<[string, RegExp]>} */
const COUNTRY_RULES=[
 ["Inglaterra",/\b(premier league de inglaterra|efl |carabao cup|national league de inglaterra)\b|^fa cup(?: femenina)?$|^community shield$/],
 ["España",/\b(laliga|copa del rey|supercopa de espana|primera federacion|segunda federacion|primera division de espana|segunda division de espana)\b|^la liga$/],
 ["Alemania",/\b(bundesliga|dfb.pokal|supercopa de alemania|oberliga)\b|^3\. liga$|^regionalliga (?:nord|sud|west|sudwest|bayern|nordost)(?:-|$)/],
 ["Italia",/\b(coppa italia|copa de italia|supercoppa italiana)\b|^serie (?:a|b|c(?:\/[abc])?)$/],
 ["Francia",/\b(copa de francia|coupe de france|trofeo de campeones de francia)\b|^ligue 1(?: mcdonalds?)?$|^ligue 2$/],
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
 // A named country outranks generic words like "liga", "serie" or "bundesliga".
 if(!country){
   const m=EXPLICIT_COUNTRIES.find(([,re])=>re.test(name));
   if(m)country=countries.find(c=>normaliseSearch(c.name)===normaliseSearch(m[0]))?.name||m[0];
 }
 if(!country){
   const m=COUNTRY_RULES.find(([,re])=>re.test(name));if(m)country=m[0];
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
