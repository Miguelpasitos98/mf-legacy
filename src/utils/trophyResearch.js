/**
 * MF LEGACY: editorial fame estimates and conservative geographical suggestions.
 * A reputation estimate is NOT an official Football Manager attribute.
 * Neither a geographic suggestion nor a title name verifies the FM image ID.
 */
import {historicGeography} from './trophyCountryHistory.js';
export const REPUTATION_METHOD = 'mf_legacy_reputation_editorial_v1_2026_11';
export const normalizeTrophyName = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const norm = normalizeTrophyName;

// Audited anchors. Match exact names or source IDs, never broad substrings.
const ANCHORS = [
 {id:'2000289984',names:['Superliga Africana','African Football League'],score:132,scope:'international',basis:'Competición continental oficial de clubes CAF/FIFA; gran relevancia africana, historia reciente y menor difusión mundial que las grandes copas continentales.',url:'https://www.cafonline.com/en/news/caf-president-dr-motsepe-launches-the-african-football-league-trophy/'},
 {id:'2000335360',names:['Corinthian Bowl (1906-1913)'],score:66,country:'Suecia',basis:'Copa sueca histórica celebrada entre 1906 y 1913, de gran valor patrimonial pero escasa notoriedad fuera del país.',url:'https://globalsportsarchive.com/en/soccer/competition/corinthian-bowl-1906/10099'},
 {id:'2000335356',names:['Bass Charity Vase'],score:74,country:'Inglaterra',friendly:true,basis:'Trofeo benéfico amistoso inglés disputado desde 1890; gran tradición local y notoriedad internacional limitada.',url:'https://www.lcfc.com/media-article/The-Bass-Charity-Vase-A-History'},
 {names:['Youdan Football Cup','Youdan Cup'],score:105,country:'Inglaterra',region:'Sheffield',basis:'Primer torneo documentado por un trofeo de fútbol (1867); notable importancia patrimonial, difusión histórica limitada.',url:'https://www.guinnessworldrecords.com/world-records/75075-oldest-competition-for-a-trophy-in-football-soccer'},
 {names:['FA Amateur Cup'],score:110,country:'Inglaterra',basis:'Copa inglesa amateur de larga tradición (1893–1974), con finales muy concurridas.',url:'https://www.fchd.info/cups/amcupsummary.htm'},
 {names:['Drybrough Cup (1971-80)','Drybrough Cup'],score:85,country:'Escocia',basis:'Copa escocesa histórica de corta duración, recordada en el fútbol de clubes nacional.',url:'https://www.scottishfootballmuseum.org.uk/news/the-drybrough-cup/'},
 {names:['Uhrencup (1962-2019)','Uhrencup'],score:77,country:'Suiza',friendly:true,basis:'Torneo amistoso internacional veraniego organizado históricamente en Suiza.',url:'https://www.rsssf.org/tablesu/uhren.html'},
 {names:['Trofeo Ciudad de Valladolid (1972-2021)'],score:60,country:'España',region:'Valladolid',friendly:true,basis:'Torneo de verano local de larga tradición y limitada notoriedad fuera de España.'},
 {id:'1301385',names:['FIFA World Cup','Copa Mundial de la FIFA'],score:200,scope:'international',basis:'Máxima notoriedad mundial del fútbol de selecciones.',url:'https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/trophy-design-history-jules-rimet'},
 {id:'1301394',names:['UEFA Champions League','Copa de Europa'],score:195,scope:'international',basis:'Principal competición anual de clubes europeos.',url:'https://www.uefa.com/uefachampionsleague/thetrophy/'},
 {id:'1301388',names:['Eurocopa','UEFA European Championship'],score:190,scope:'international',basis:'Campeonato continental de selecciones de máxima proyección.'},
 {id:'1301389',names:['Copa América','Copa America'],score:184,scope:'international',basis:'Campeonato de selecciones histórico de alcance internacional.'},
 {id:'102415',names:['Copa Libertadores','CONMEBOL Libertadores'],score:184,scope:'international',basis:'Principal copa continental sudamericana de clubes.'},
 {id:'67',names:['LaLiga','LaLiga EA Sports'],score:183,country:'España',basis:'Primera división española, liga de máxima difusión internacional.'},
 {id:'1301422',names:['Copa del Rey'],score:169,country:'España',basis:'Copa nacional española de mayor tradición.',url:'https://rfef.es/es/noticias/los-nombres-de-la-copa'},
 {id:'1301423',names:['Supercopa de España'],score:139,country:'España',basis:'Supercopa nacional disputada por clubes principales.'},
 {id:'121092',names:['Mundial de Clubes FIFA'],score:180,scope:'international',basis:'Campeonato FIFA mundial de clubes.'},
 {id:'1301395',names:['Recopa de Europa'],score:168,scope:'international',basis:'Importante competición europea histórica de clubes.'},
 {id:'317567',names:['Copa Sudamericana'],score:158,scope:'international',basis:'Competición continental sudamericana de clubes.'},
 {id:'31051584',names:['UEFA Conference League'],score:151,scope:'international',basis:'Competición oficial europea de clubes.'},
 {id:'1301410',names:['Copa de Alemania'],score:163,country:'Alemania',basis:'Copa nacional de la primera potencia futbolística alemana.'},
 {id:'68',names:['LaLiga HyperMotion'],score:137,country:'España',basis:'Segunda división española de fútbol profesional.'},
 {id:'2000335178',names:['Trofeo Ramón de Carranza'],score:100,country:'España',region:'Cádiz',friendly:true,basis:'Torneo veraniego de gran tradición histórica española; de carácter amistoso.',url:'https://www.cadizcf.com/trofeo-carranza'},
 {id:'2000335177',names:['Trofeo Teresa Herrera'],score:98,country:'España',region:'A Coruña',friendly:true,basis:'Torneo veraniego histórico con amplio reconocimiento en España.'},
 {id:'2000335169',names:['Trofeo Joan Gamper','Trofeu Joan Gamper'],score:112,country:'España',region:'Barcelona',friendly:true,basis:'Histórico torneo amistoso internacional del FC Barcelona.',url:'https://www.fcbarcelona.es/es/ficha/1452570/trofeo-joan-gamper'},
 {id:'2000335179',names:['Trofeo Colombino'],score:77,country:'España',region:'Huelva',friendly:true,basis:'Torneo amistoso tradicional con repercusión principalmente regional.'},
 {id:'2000335173',names:['Trofeo Costa del Sol'],score:84,country:'España',region:'Málaga',friendly:true,basis:'Torneo de verano con tradición y proyección principalmente española.'},
 {id:'2000335163',names:['Trofeo Santiago Bernabéu'],score:96,country:'España',region:'Madrid',friendly:true,basis:'Torneo amistoso histórico organizado por el Real Madrid.'},
 {names:['Copa de los Campeones de España','Copa de Campeones (España)'],score:94,country:'España',friendly:true,basis:'Encuentro amistoso de 1940 entre campeones de Liga y Copa; antecedente, no edición de la Supercopa actual.',url:'https://rfef.es/es/crees-que-lo-sabes-todo-nuestros23'},
 {names:['Copa Eva Duarte','Copa Eva Duarte de Perón','Copa Eva Duarte y Perón'],score:114,country:'España',basis:'Precedente oficial histórico de la Supercopa española, independiente como torneo.',url:'https://rfef.es/es/noticias/historia-de-la-supercopa-de-espana-sabias-que-durante-unos-anos-se-llamo-copa-eva-de'},
 {names:['Copa Macaya'],score:102,country:'España',region:'Cataluña',basis:'Primer campeonato reglado del fútbol español, muy relevante históricamente aunque limitado en alcance.',url:'https://www.museuolimpicbcn.cat/es/coleccion-permanente/copa-macaya/'},
 {names:['Copa Latina','Latin Cup'],score:143,scope:'international',basis:'Competición europea histórica entre campeones de cuatro países (1949–1957).',url:'https://www.rsssf.org/tablesl/latin.html'},
 {names:['Trofeo Naranja'],score:86,country:'España',friendly:true,basis:'Torneo amistoso de verano con notoriedad española.'},
 {names:['Emirates Cup'],score:98,country:'Inglaterra',friendly:true,basis:'Torneo amistoso veraniego asociado al Arsenal.'},
 {names:['Audi Cup'],score:94,country:'Alemania',friendly:true,basis:'Torneo amistoso de pretemporada internacional celebrado en Alemania.'},
 {names:['International Champions Cup'],score:109,scope:'international',friendly:true,basis:'Serie de amistosos internacionales entre clubes de gran notoriedad.'},
 {names:['Copa Intercontinental','Intercontinental Cup'],score:176,scope:'international',basis:'Histórica competición mundial/intercontinental de clubes; no fusionar con FIFA moderna.'},
 {names:['FA Cup'],score:176,country:'Inglaterra',basis:'Copa nacional inglesa de amplísima historia y notoriedad.'},
 {names:['Premier League'],score:190,country:'Inglaterra',basis:'Primera división inglesa con enorme difusión global.'},
 {names:['Bundesliga'],score:178,country:'Alemania',basis:'Primera división alemana.'},
 {names:['Serie A'],score:176,country:'Italia',basis:'Primera división italiana.'},
 {names:['Ligue 1'],score:164,country:'Francia',basis:'Primera división francesa.'},
 {names:['UEFA Europa League'],score:167,scope:'international',basis:'Segunda competición europea principal de clubes.'},
 {names:['UEFA Super Cup'],score:155,scope:'international',basis:'Supercopa europea oficial.'},
 {names:["FIFA Women's World Cup"],score:185,scope:'international',basis:'Principal campeonato mundial femenino de selecciones.'}
];
const byId = new Map(ANCHORS.filter(a=>a.id).map(a=>[String(a.id),a]));
const byName = new Map(ANCHORS.flatMap(a=>(a.names||[]).map(name=>[norm(name),a])));
export const trophyResearchAnchor = trophy => byId.get(String(trophy?.source_id||'')) || byName.get(norm(trophy?.name||trophy?.source_name));

const REGIONAL=/(?:\b(?:county|district|regional|amateur|provincial|distrital|municipal|bezirksliga|kreis(?:liga|pokal)|oberliga|gauliga|verbandsliga|landesliga|eccellenza|promozione|torneo(?:\s+provincial)?|comarcal|tercera|third division|fourth division|5th|fifth|4th|sixth|u ?1[5789]|u ?2[013]|sub ?1[5789]|sub ?2[013])\b)/;
const WOMEN=/(?:\b(?:women|woman|femenin[ao]|frauen|womens|woman's|femme|ladies|nws[l]|wsl)\b)/;
const FRIENDLY=/(?:\b(?:amistoso|friendly|invitation(?:al)?|memorial|preseason|pre season|summer|trofeo|trofeu|emirates cup|audi cup|teresa herrera|carranza|gamper)\b)/;
const LEAGUE=/(?:\b(?:liga|league|ligue|division|divisie|divisao|bundesliga|serie [abcd]|laliga|superliga|campeonato|championat|championnat|promozione|eccellenza|verbandsliga|oberliga|bezirksliga|landesliga|second category|segunda categoria|ascenso nacional|primera|premier|premiership|championship|meisterschaft|ligan|ligue 1|k[1-9] league)\b)/;
const CUP=/(?:\b(?:copa|cup|pokal|verbandspokal|coppa|coupe|taca|taça|trophy|trofeo|challenge|shield)\b)/;
const SUPERCUP=/(?:\b(?:supercopa|supercup|super cup|supercoppa|supertaca|supertaça|community shield|charity shield)\b)/;
const AGE=/(?:\b(?:u ?1[5789]|u ?2[013]|sub ?1[5789]|sub ?2[013]|under ?1[5789]|under ?2[013]|youth|juvenil|academy|reserves|reserve|primavera)\b)/;
const WORLD=/(?:\b(?:fifa|world cup|copa del mundo|copa mundial|mundial de clubes|club world cup|intercontinental|confederations cup)\b)/;
const CONFED=/(?:\b(?:uefa|conmebol|concacaf|caf|afc |ofc |libertadores|sudamericana|eurocopa|copa america|copa oro|champions league|europa league|conference league|asian cup|african cup|copa latina|latin cup|copa de ferias|coppa delle alpi|central american cup|caribbean cup|caribbean club shield|african super league|superliga africana|north american nations league|copa interamericana|copa de europa|recopa de europa)\b)/;
const ELITE_COUNTRIES=['inglaterra','espana','alemania','italia','francia','brasil','argentina'];

export function estimateTrophyReputation(trophy={}) {
 const stored=Number(trophy.reputation);
 if(trophy.reputation!==undefined&&trophy.reputation!==null&&trophy.reputation!==''&&Number.isInteger(stored)&&stored>=0&&stored<=200)
  return {score:stored,basis:trophy.reputation_basis||'Valor editorial guardado en MF LEGACY.',method:trophy.reputation_method||'manual',estimated:trophy.reputation_method!=='manual_editorial'};
 const anchor=trophyResearchAnchor(trophy);
 if(anchor)return {score:anchor.score,basis:anchor.basis,method:REPUTATION_METHOD,estimated:true,source:anchor.url||''};
 const n=norm(trophy.name||trophy.source_name);
 if(!n)return {score:0,basis:'Nombre no identificado: no se puede valorar.',method:REPUTATION_METHOD,estimated:true};
 let score=49,reason='Estimación por el alcance y tipo de competición expresado en el nombre.';
 const cat=norm(trophy.category);
 if(SUPERCUP.test(n)) {score=76;reason='Supercopa, valoración inicial por su difusión normalmente inferior a la liga o copa principal.';}
 else if(FRIENDLY.test(n)){score=55;reason='Torneo amistoso o de exhibición: estima notoriedad histórica, no oficialidad.';}
 else if(CUP.test(n)||cat==='cup'){score=76;reason='Copa: estimación de reconocimiento general a falta de investigación individual.';}
 else if(LEAGUE.test(n)||cat==='league'){score=88;reason='Liga: estimación por nivel y alcance, sujeta a investigación de la competición.';}
 else if(cat==='individual award'){score=80;reason='Premio individual: estimación preliminar de reconocimiento.';}
 if(WORLD.test(n)){score=Math.max(score,162);reason='Alcance mundial sugerido por denominación; identidad pendiente de comprobación.';}
 else if(CONFED.test(n)){score=Math.max(score,136);reason='Alcance continental o interconfederativo aparente; identidad pendiente de comprobación.';}
 const isElite=ELITE_COUNTRIES.some(c=>n.includes(c))||/\b(?:english|spanish|german|italian|french|brazilian|argentine|laliga|bundesliga|premier league|serie a|fa cup|dfb|coppa italia)\b/.test(n);
 if(isElite&&!WORLD.test(n)&&!CONFED.test(n))score+=13;
 if(REGIONAL.test(n)){score=Math.min(score,59);reason='Ámbito regional, divisional inferior o juvenil indicado por el nombre; notoriedad estimada.';}
 if(AGE.test(n)){score=Math.min(score,73);reason='Competición juvenil o de reserva: notoriedad estimada, no juzga su calidad deportiva.';}
 if(WOMEN.test(n)&&/(?:world cup|champions league|wsl|liga f|frauen bundesliga|nws[l])/.test(n))
  score=Math.max(score, n.includes('world cup')?180: n.includes('champions league')?165:138);
 if(/\b(?:first division|primera division|premier league|serie a|bundesliga)\b/.test(n)&&!AGE.test(n)&&!REGIONAL.test(n))score=Math.max(score,137);
 if(/\b(?:third|fourth|fifth|3rd|4th|5th|segunda|second|tier 2|liga 2|serie b|primera b|league one|league two)\b/.test(n))score=Math.min(score,90);
 if(/\b(?:historical|extinct|former)\b/.test(n))score=Math.min(score,98);
 if(trophy.trophy_type==='Individual Trophy')score=Math.max(score,61);
 score=Math.min(200,Math.max(15,Math.round(score)));
 return {score,basis:reason,method:REPUTATION_METHOD,estimated:true};
}

// Conservative explicit aliases; no national association is inferred from a winner club.
const COUNTRY_PATTERNS = [
 ['España',/\b(?:espana|spanish|spain|laliga|copa del rey|supercopa de espana|copa macaya|copa eva duarte|copa de los campeones de espana|copa de la espana libre|trofeo (?:ramon de carranza|teresa herrera|colombino|costa del sol|joan gamper|santiago bernabeu|naranja)|trofeu joan gamper|copa catalunya|campeonato de cataluna|copa cataluna|primera federacion|ciudad de valladolid|conde de fenosa|copa de galicia|campeonato de cataluna|copa de cataluna)\b/],
 ['Inglaterra',/\b(?:england|english|premier league|fa cup|efl |carabao|emirates cup|community shield|championship english|county fa|fa county|oxfordshire|cambridgeshire|cumberland|cornwall|cheshire|berks bucks|bedfordshire|birmingham fa|football alliance|fa amateur cup|fa sunday cup|youdan football cup|youdan cup)\b/],
 ['Alemania',/\b(?:germany|german|deutsch|bundesliga|dfb|bezirksliga|verbandsliga|gauliga|oberliga|landesliga|audi cup|sudbayern|nordbayern|rheinland|thuringia|saxony)\b/],
 ['Italia',/\b(?:italy|italian|italia|coppa italia|serie a|serie b|serie c|serie d|supercoppa italiana|eccellenza|promozione|primavera)\b/],
 ['Francia',/\b(?:france|french|francais|francia|coupe de france|ligue 1|ligue 2|championnat national|trophee des champions)\b/],
 ['Portugal',/\b(?:portugal|portuguese|portuguesa|portugues|primeira liga|taca de portugal|taca da liga|supertaca|liga portugal)\b/],
 ['Brasil',/\b(?:brasil|brazil|brazilian|brasileiro|brasileira|brasileirao|copa do brasil|paulista|carioca|amazonense|bahia state|gaucho|pernambuco|rondoniense|paranaense|mineiro|cearense|mato grossense|potiguar|sergipe|goias|copa rio)\b/],
 ['Argentina',/\b(?:argentina|argentine|argentino|argentinean|copa argentina|superliga argentina|primera nacional argentina|metropolitana b|federal a|copa de la liga argentina)\b/],
 ['México',/\b(?:mexico|mexican|liga mx|copa mx|interliga|liga expansion)\b/],
 ['Estados Unidos',/\b(?:united states|estadounidens|usa|us open cup|major league soccer|\bmls\b|usl |nws[l]|hudson river derby)\b/],
 ['Canadá',/\b(?:canada|canadian|ontario|quebec|canada cup|league1 ontario)\b/],
 ['Escocia',/\b(?:scottish|scotland|escocia|spfl|premiership escocia|drybrough cup)\b/],
 ['Gales',/\b(?:welsh|wales|walis|gales|cymru|gymru)\b/],
 ['Irlanda',/\b(?:ireland|irish|irlanda|fai cup)\b/],
 ['Irlanda del Norte',/\b(?:northern ireland|northern irish|irlanda del norte)\b/],
 ['Países Bajos',/\b(?:netherlands|dutch|nederland|eredivisie|knvb|eerste divisie|tweede divisie)\b/],
 ['Bélgica',/\b(?:belgium|belgian|belgica|jupiler pro league)\b/],
 ['Austria',/\b(?:austria|austrian|osterreich|österreich)\b/],
 ['Suiza',/\b(?:swiss|switzerland|suiza|schweizer|uhrencup|uhren cup)\b/],
 ['Dinamarca',/\b(?:denmark|danish|dinamarca|dansk)\b/],
 ['Suecia',/\b(?:sweden|swedish|suecia|allsvenskan|svenska|rosenska|wicanderska|kamratmasterskapen|fotbollserien)\b/],
 ['Noruega',/\b(?:norway|norwegian|noruega|eliteserien)\b/],
 ['Finlandia',/\b(?:finland|finnish|finlandia|veikkausliiga)\b/],
 ['Polonia',/\b(?:poland|polish|polonia|ekstraklasa)\b/],
 ['Chequia',/\b(?:czech|czechia|chequia|checa)\b/],
 ['Croacia',/\b(?:croatia|croatian|croacia|hnl)\b/],
 ['Turquía',/\b(?:turkey|turkish|turkiye|turquia|super lig)\b/],
 ['Grecia',/\b(?:greece|greek|grecia|ellada)\b/],
 ['Rumanía',/\b(?:romania|romanian|rumania|liga i)\b/],
 ['Ucrania',/\b(?:ukraine|ukrainian|ucrania|ukrainska)\b/],
 ['Rusia',/\b(?:russia|russian|rusia)\b/],
 ['Georgia',/\b(?:georgia|georgian|georgian cup)\b/],
 ['Albania',/\b(?:albania|albanian|albanes)\b/],
 ['Armenia',/\b(?:armenia|armenian)\b/],
 ['Uzbekistán',/\b(?:uzbekistan|uzbek)\b/],
 ['Arabia Saudí',/\b(?:saudi|arabia saudi|arabia saudita|saudi arabia)\b/],
 ['Marruecos',/\b(?:morocco|moroccan|marruecos)\b/],
 ['Egipto',/\b(?:egypt|egyptian|egipto)\b/],
 ['Nigeria',/\b(?:nigeria|nigerian)\b/],
 ['Ghana',/\b(?:ghana|ghanaian)\b/],
 ['Tanzania',/\b(?:tanzania|tanzanian)\b/],
 ['Kenia',/\b(?:kenya|kenyan|kenia)\b/],
 ['Zambia',/\b(?:zambia|zambian)\b/],
 ['Argelia',/\b(?:algeria|algerian|argelia)\b/],
 ['Benín',/\b(?:benin|beninese)\b/],
 ['Angola',/\b(?:angola|angolan)\b/],
 ['Chile',/\b(?:chile|chilean|chileno)\b/],
 ['Colombia',/\b(?:colombia|colombian)\b/],
 ['Perú',/\b(?:peru|peruvian|peruano)\b/],
 ['Uruguay',/\b(?:uruguay|uruguayan)\b/],
 ['Paraguay',/\b(?:paraguay|paraguayan)\b/],
 ['Venezuela',/\b(?:venezuela|venezuelan)\b/],
 ['Bolivia',/\b(?:bolivia|bolivian)\b/],
 ['Ecuador',/\b(?:ecuador|ecuadorian|ecuatorian)\b/],
 ['Costa Rica',/\b(?:costa rica|costa rican)\b/],
 ['Honduras',/\b(?:honduras|honduran)\b/],
 ['Panamá',/\b(?:panama|panamanian)\b/],
 ['Jamaica',/\b(?:jamaica|jamaican)\b/],
 ['Japón',/\b(?:japan|japanese|japon|j league|j1 league|j2 league|j3 league)\b/],
 ['Corea del Sur',/\b(?:south korea|south korean|korean k[1-9]|korean cup|k league|corea del sur)\b/],
 ['China',/\b(?:china|chinese|chino|superliga china)\b/],
 ['Tailandia',/\b(?:thailand|thai|tailandia)\b/],
 ['Indonesia',/\b(?:indonesia|indonesian)\b/],
 ['India',/\b(?:india|indian|durand cup|i league)\b/],
 ['Australia',/\b(?:australia|australian|a league)\b/],
 ['Nueva Zelanda',/\b(?:new zealand|zealand|nueva zelanda|all whites)\b/],
 ['Filipinas',/\b(?:philippine|philippines|filipinas)\b/],
 ['Singapur',/\b(?:singapore|singaporean|singapur)\b/],
];
// Deliberately conservative: do not assign one country to UEFA/FIFA/CONMEBOL etc.
const MULTINATIONAL=/(?:\b(?:fifa|uefa|conmebol|concacaf|\bcaf\b|afc champions|\bofc\b|copa america|copa mundial|world cup|mundial de clubes|club world cup|europa league|champions league|conference league|copa libertadores|copa sudamericana|copa latina|latin cup|copa intercontinental|intercontinental cup|world championship|olympic games|juegos olimpicos|champions cup europa|africa cup of nations|copa africa|asian cup)\b)/;
export function inferTrophyCountry(trophy={}, countries=[]) {
 const originalId=String(trophy.country_id||'');
 const existing=countries.find(c=>String(c.id)===originalId);
 if(existing)return {country_id:existing.id,country:existing.name,resolution:trophy.country_resolution||'manual',basis:'Country.id ya guardado.'};
 const saved=norm(trophy.country);
 if(saved){const found=countries.find(c=>norm(c.name)===saved);if(found)return {country_id:found.id,country:found.name,resolution:'inferred',basis:'Nombre de país anterior, coincidencia exacta con Country.'};}
 const anchor=trophyResearchAnchor(trophy);
 if(anchor?.scope==='international')return {country_id:'',country:'',resolution:'international',basis:'Ámbito internacional acreditado por competición reconocible.'};
 const target=anchor?.country;
 if(target){const found=countries.find(c=>norm(c.name)===norm(target));if(found)return{country_id:found.id,country:found.name,region:anchor.region||'',resolution:'inferred',basis:'Competiciones históricas identificadas mediante nombre y fuente institucional.'};}
 const n=norm(trophy.name||trophy.source_name);
 const historical=historicGeography(trophy.name||trophy.source_name);
 if(historical?.type==='international')return {country_id:'',country:'',resolution:'international',basis:historical.basis};
 if(historical?.type==='country'){
   const actual=countries.find(c=>norm(c.name)===norm(historical.name));
   if(actual)return {country_id:actual.id,country:actual.name,resolution:'inferred',basis:historical.basis};
 }
 if(MULTINATIONAL.test(n))return {country_id:'',country:'',resolution:'international',basis:'Ámbito multinacional expreso en la denominación; sin Country único.'};
 // Longer/unique country terms take priority; multiple-country matches are refused.
 const hits=COUNTRY_PATTERNS.filter(([,pattern])=>pattern.test(n));
 if(hits.length!==1)return {country_id:'',country:'',resolution:'pending',basis:hits.length?'Denominación geográfica ambigua: revisar manualmente.':'Sin evidencia suficiente de un único país.'};
 const found=countries.find(c=>norm(c.name)===norm(hits[0][0]));
 if(!found)return {country_id:'',country:'',resolution:'pending',basis:`Se sugiere ${hits[0][0]}, pero no hay una entidad Country con nombre equivalente.`};
 return {country_id:found.id,country:found.name,resolution:'inferred',basis:'Referencia geográfica explícita en el nombre; pendiente de comprobación externa.'};
}
export function recommendedTrophyCategory(trophy={}) {
 const n=norm(trophy.name||trophy.source_name);
 const anchor=trophyResearchAnchor(trophy);
 if(anchor?.friendly)return 'Other';
 if(n==='copa campeonato')return 'League';
 if(n==='superliga africana'||n==='african football league')return 'International';
 if(trophy.trophy_type==='Individual Trophy')return 'Individual Award';
 if(SUPERCUP.test(n))return 'Supercup';
 if(WORLD.test(n)||CONFED.test(n))return 'International';
 if(CUP.test(n))return 'Cup';
 if(LEAGUE.test(n))return 'League';
 return trophy.category||'Other';
}
