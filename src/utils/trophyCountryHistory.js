/**
 * MF LEGACY — conservatively curated geographic hints for historical trophies.
 * This maps the home/organising country when the name or a well-established
 * historical reference makes it clear. It DOES NOT verify the original FM ID,
 * competition officiality or a championship result.
 * Unknown, disputed and transnational competitions remain unresolved.
 */
const n=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
// Match whole normalized titles or strongly distinctive parts; names in FM24
// are historical presentation labels, not authoritative official names.
const RULES = [
 ['España', /\b(?:trofeo (?:villa de bilbao|villa de madrid|ciudad de (?:la linea|palma|santander|zaragoza|sevilla|albacete)|concepcion arenal|memorial quinocho|cidade de vigo|antonio puerta|euskadi asergace)|memorial jesus gil|festa d elx|supercopa de catalunya|ciutat de barcelona|campionat de catalunya|lliga catalana|lliga mediterrania|copa barcelona|copa presidente fef|campeonato regional (?:de |del )?(?:navarra|oeste|norte|baleares|aragon|canarias|galicia|leones|levante|sur|valencia|asturias|centro)|gipuzkoako herrialde|bizkaiko eskualdeko|copa de la espana libre|campeonato regional centro|trofeo ciudad de valladolid|conde de fenosa|copa de galicia)\b/],
 ['Brasil', /\b(?:taca ariano suassuna|copa centenario de belo horizonte|torneio do povo|torneio quinela de ouro|copa bandeirantes|torneio internacional de verao do rio de janeiro|copa cidade de sao paulo|torneio heleno nunes|trofeu osmar santos|trofeu joao saldanha|taca guanabara|taca dos campeoes estaduais rio|campeonato roraimense|campeonato amapaense|campeonato acreano|campeonato amazonense)\b/],
 ['Argentina', /\b(?:copa centenario de la afa|copa (?:adrian c escobar|estimulo|dr carlos ibarguren|de competencia la nacion|de competencia jockey club|de competencia britanica george vi|de honor municipalidad de buenos aires)|torneo internacional nocturno|copa rivadavia|copa campeonato)\b/],
 ['Uruguay', /\b(?:montevideo cup|campeonato estadio centenario|copa premier honor uruguayo|liguilla pre libertadores de uruguay)\b/],
 ['Chile', /\b(?:torneo vina del mar|copa de chile|chilean super cup)\b/],
 ['México', /\b(?:primera fmfliga mayor|feria de hidalgo|copa mx|liga mx)\b/],
 ['Italia', /\b(?:coppa del 150|trofeo tim|coppa renato dall ara|trofeo luigi berlusconi|memorial pier cesare baretti|trofeo birra moretti|medaglia doro umberto i|torneo fgni|copa primavera sub 20 de italia|serie c de italia)\b/],
 ['Suiza', /\b(?:philips trophy bern|coppa chiasso|coupe des nations 1930|uhrencup|uhren cup)\b/],
 ['Portugal', /\b(?:taca imperio|taca de honra|ribeiro dos reis|trofeu tap|trofeu cidade de guimaraes|trofeu cinco violinos|eusebio cup|algarve cup)\b/],
 ['Inglaterra', /\b(?:screensport super cup|watney mann invitation cup|mercantile credit|football league war cup|sheriff of london charity shield|manchester fa senior cup|corinthian bowl|bass charity vase|fa amateur cup|fa sunday cup)\b/],
 ['Escocia', /\b(?:stirlingshire cup|renfrewshire cup|forfarshire cup|tennent caledonian cup|ayrshire cup|saint mungo cup|glasgow international exhibition cup|queen s park shield|empire exhibition trophy|glasgow merchants charity cup|rosebery charity cup|ibrox international challenge|centenary of rangers|drybrough cup)\b/],
 ['Alemania', /\b(?:westkreis liga|sudkreis liga|nordkreis liga|kreisliga|norddeutsche fu.ballmeisterschaft|markischer fu.ball bund|westdeutsche meisterschaft|mitteldeutsche meisterschaft|brandenburgische meisterschaft|suddeutsche meisterschaft|dfv supercup|fuwo pokal|ddr liga|deutschland cup|telekom cup|franz beckenbauer cup|uli hoene.s cup|westkreis|sudkreis|sudwest|kreis(?:liga|pokal)|verbandspokal niederrhein|mecklenburg pomerania|thuringia league|saxony league)\b/],
 ['Francia', /\b(?:tournoi de paris|international exhibition paris|division d honneur lmfa)\b/],
 ['Países Bajos', /\b(?:amsterdam tournament|eerste klasse zondag|eerste klasse zaterdag)\b/],
 ['Ucrania', /\b(?:torneo de kiev|chempionat ukrayiny z futbolu|kubok ukrayiny z futbolu|victor bannikov memorial tournament|ukrainian (?:second|reg|amateur))\b/],
 ['Azerbaiyán', /\b(?:azerbaijani ssr|azerbaycan yuks.k liqasi|azerbaijan|az.rbaycan)\b/],
 ['Bielorrusia', /\b(?:bssr|belarus|belarusian|bielorrusia|copa de bielorrusia)\b/],
 ['Japón', /\b(?:kirin cup|jsl super cup|jsl cup|jaa league|tohoku football league|kanto university league)\b/],
 ['India', /\b(?:nehru cup|indian (?:kerala|bangalore|calcutta)|copa durand|durand cup|supercopa de india)\b/],
 ['Estados Unidos', /\b(?:chicago trophy|nike u s cup|florida cup|marlboro cup|copa los angeles das nacoes|us open cup|hudson river derby)\b/],
 ['Canadá', /\b(?:league1 ontario|canadian|ontario cup)\b/],
 ['Australia', /\b(?:australian (?:cup|league|premier)|a league women|a league men)\b/],
 ['Nueva Zelanda', /\b(?:new zealand (?:charity|national)|new zealand cup)\b/],
 ['Egipto', /\b(?:canal league|alexandria league|cairo league|sultan hussein cup|president el sisi)\b/],
 ['Marruecos', /\b(?:mohammed v trophy|mohammed v cup)\b/],
 ['Baréin', /\b(?:bahrain|barein|supercopa de barein)\b/],
 ['Kuwait', /\b(?:kuwait|kuwaiti)\b/],
 ['Omán', /\b(?:oman|omani|sultan qaboos)\b/],
 ['Irak', /\b(?:iraq|iraqi|copa de irak)\b/],
 ['Irán', /\b(?:iran|iranian|azadegan league)\b/],
 ['Brunéi', /\b(?:brunei|brunei)\b/],
 ['Emiratos Árabes Unidos', /\b(?:mohammed bin rashid|dubai champions cup|united arab emirates|uae)\b/],
 ['Tailandia', /\b(?:thai league|thai fa cup|thai league cup|thailand)\b/],
 ['China', /\b(?:jiaa league|chinese super league|superliga china|china cup|china)\b/],
 ['Pakistán', /\b(?:pakistan|pakistani)\b/],
 ['Nepal', /\b(?:nepali|nepal|budha subba)\b/],
 ['Singapur', /\b(?:singapore|singaporean)\b/],
 ['Sudáfrica', /\b(?:south african|diski (?:shield|challenge)|bayhill premier cup)\b/],
 ['Zimbabue', /\b(?:zimbabwean|zimbabwe)\b/],
 ['Zambia', /\b(?:zambia|zambian)\b/],
 ['Uganda', /\b(?:uganda|ugandan)\b/],
 ['Burkina Faso', /\b(?:burkinabe|burkina faso)\b/],
 ['Madagascar', /\b(?:malagasy|madagascar)\b/],
 ['Níger', /\b(?:nigerien|niger cup)\b/],
 ['Jordania', /\b(?:jordania|jordanian|jordan cup|copa de jordania)\b/],
 ['San Marino', /\b(?:san marino)\b/],
 ['Andorra', /\b(?:andorran|andorra)\b/],
 ['Bermudas', /\b(?:bermuda|bermudas)\b/],
 ['Fiyi', /\b(?:fijian|fiji)\b/],
 ['Nueva Caledonia', /\b(?:new caledonian|caledonie|caledonia)\b/],
 ['Turkmenistán', /\b(?:turkmenistan|turkmenistani)\b/],
 ['Moldavia', /\b(?:moldovan|moldova)\b/],
 ['Bulgaria', /\b(?:bulgarian|bulgaria)\b/],
 ['Hong Kong', /\b(?:hong kong)\b/],
 ['Gibraltar', /\b(?:gibraltar)\b/],
 ['Catar', /\b(?:qatar|qatari)\b/],
 ['Kirguistán', /\b(?:kyrgyz|kirguist)\b/],
];
// Never infer a single national affiliation from these international labels,
// even when a city or language also appears in the name.
const INTERNATIONAL = /\b(?:wafu|afc|uefa|caf|concacaf|conmebol|ofc|copa (?:ricardo aldao|iberoamericana|newton|lipton)|copa de (?:confraternidad rioplatense|competencia chevallier boutell|honor cousenier|ferias)|fairs cup|texaco cup|panamerican championship|north american|central american|caribbean|oceania|european (?:u ?17|railways)|atlantic cup|european railways cup|meridian cup|mercosur|balkan|peace cup|copa del atlantico de clubes sudamericanos|copa do atlantico de clubes sul americanos|pequena copa del mundo|north african|world soccer|intercontinental|mundialito|world challenge|international champions cup)\b/;

export function historicGeography(name) {
 const label = n(name);
 if (!label)return null;
 if(INTERNATIONAL.test(label))return {type:'international',basis:'Torneo transnacional o intercontinental por su denominación histórica.'};
 const found=RULES.filter(([,regex])=>regex.test(label));
 const names=[...new Set(found.map(([country])=>country))];
 if(names.length!==1)return null;
 return {type:'country',name:names[0],basis:'Referencia histórica o geográfica reconocible en la denominación; requiere verificación individual.'};
}
