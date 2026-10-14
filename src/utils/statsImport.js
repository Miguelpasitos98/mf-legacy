// Contrato local de FotMob Legacy Studio: formatos de caché y estadística detallada.
// No mezcla atributos FM26 con rendimiento real.
export const DATA_SOURCES = ["mf_legacy_fotmob_stats_review_v1","mf_legacy_fotmob_player_stats_batch_review_v1","mf_legacy_fotmob_player_stats_review_v1"];
const asText = (v) => String(v ?? "").trim();
const asNum = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const value = typeof v === "string" ? v.trim().replace(/%|km\/h|km/g, "").replace(",", ".") : v;
  if (value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
export const normalizeLabel = (v) => asText(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const normalizedSeason = (v) => {
  const text = asText(v);
  const match = text.match(/^(\d{4})[\/-](\d{2}|\d{4})$/);
  if (!match) return text;
  return match[1] + "/" + (match[2].length === 2 ? match[1].slice(0, 2) + match[2] : match[2]);
};
const slug = (v) => asText(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const recordKey = (r) => {
  const pid = asText(r.fotmob_player_id);
  const tid = asText(r.fotmob_team_id) || slug(r.team_name) || "team-unknown";
  return "fotmob:" + pid + ":" + tid + ":" + slug(r.season) + ":" + slug(r.competition);
};
const metricAliases = {
  "goals":"goals","goles":"goals","assists":"assists","asistencias":"assists",
  "expectedgoals":"xg","xg":"xg","expectedassists":"xa","xa":"xa",
  "xgot":"xgot","shots":"shots","tiros":"shots","shotsontarget":"shots_on_target",
  "tackles":"tackles","entradas":"tackles","interceptions":"interceptions",
  "recoveries":"recoveries","yellowcards":"yellow_cards","redcards":"red_cards",
  "minutes":"minutes","minutesplayed":"minutes","matches":"appearances","appearances":"appearances",
  "rating":"rating","fotmobrating":"rating"
};
const metricValue = (metrics, label) => {
  const wanted = normalizeLabel(label);
  const entry = (metrics || []).find((m) => normalizeLabel(m.name) === wanted);
  return entry ? entry.value : null;
};
const cleanMetrics = (metrics) => {
  if (!Array.isArray(metrics)) return [];
  const out = [];
  const seen = new Map();
  for (const m of metrics) {
    if (!m || typeof m !== "object") continue;
    const name = asText(m.name || m.title || m.statistic);
    const value = asNum(m.value ?? m.statValue);
    if (!name || value === null) continue;
    const key = normalizeLabel(name);
    const same = seen.get(key) || [];
    if (same.some(existing => existing.value === value)) continue;
    // FotMob puede usar una misma etiqueta en categorías o desgloses distintos.
    // Conservar ambos valores sin atribuir al segundo un significado inventado.
    const uniqueName = same.length ? name + " (variante " + (same.length + 1) + ")" : name;
    const item = {name:uniqueName, value, per90:asNum(m.per90), percentile:asNum(m.percentile)};
    out.push(item);
    seen.set(key, [...same,item]);
  }
  return out;
};
export function normalizeRecord(item) {
  if (!item || typeof item !== "object") throw Error("Registro no válido.");
  const p = asText(item.fotmob_player_id || item.player_id_fotmob);
  const season = normalizedSeason(item.season);
  const competition = asText(item.competition || item.league);
  if (!p || !season || !competition) throw Error("Falta ID FotMob, temporada o competición.");
  const metrics = cleanMetrics(item.metrics);
  // team_matches es el total disputado por EL EQUIPO, no las apariciones del jugador.
  const rawTeamMatches=item.team_matches;
  const teamMatches=asNum(rawTeamMatches);
  if(rawTeamMatches!==null&&rawTeamMatches!==undefined&&rawTeamMatches!==""&&(!Number.isInteger(teamMatches)||teamMatches<1||teamMatches>200))throw Error("team_matches debe ser un entero entre 1 y 200.");
  const value = (field) => asNum(item[field]) ?? metricValue(metrics, field);
  const rec = {
    external_record_id: recordKey({...item, fotmob_player_id:p, season, competition}),
    player_id: asText(item.base44_player_id || item.player_id_base44),
    fm26_uid: asText(item.fm26_uid),
    fotmob_player_id:p,
    player_name:asText(item.player_name || item.name),
    team_id:asText(item.base44_team_id || item.team_id_base44),
    fotmob_team_id:asText(item.fotmob_team_id),
    team_name:asText(item.team_name),
    season, competition,
    appearances:value("appearances") ?? metricValue(metrics,"Matches"),
    minutes:value("minutes") ?? metricValue(metrics,"Minutes played"),
    rating:value("rating") ?? metricValue(metrics,"FotMob Rating"),
    team_matches:teamMatches,
    market_value:value("market_value"),
    market_date:asText(item.market_date),
    metrics,
    source:asText(item.source) || "FotMob · archivo importado",
    verification_status:asText(item.verification_status) || "pendiente_revision",
    review_status:"pending",
  };
  return rec;
}
const parseCSVRows = (text) => {
  const source = String(text || "").replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/,1)[0] || "";
  const delimiter = (firstLine.match(/;/g)||[]).length >= (firstLine.match(/,/g)||[]).length ? ";" : ",";
  const rows=[];let row=[],field="",quoted=false;
  for (let i=0;i<source.length;i++){
    const ch=source[i];
    if(ch==='"'){
      if(quoted && source[i+1]==='"'){field+='"';i++;}else quoted=!quoted;
    }else if(!quoted && ch===delimiter){row.push(field);field="";}
    else if(!quoted && (ch==='\r'||ch==='\n')){
      if(ch==='\r'&&source[i+1]==='\n')i++;
      row.push(field);if(row.some((x)=>x.trim()))rows.push(row);row=[];field="";
    }else field+=ch;
  }
  if(quoted)throw Error("CSV con comillas sin cerrar.");
  row.push(field);if(row.some((x)=>x.trim()))rows.push(row);
  if(rows.length<2)throw Error("CSV vacío o sin registros.");
  const headers=rows.shift().map((x)=>x.trim().replace(/^\uFEFF/,""));
  return rows.map((values)=>Object.fromEntries(headers.map((h,i)=>[h,values[i] ?? ""])));
};
const cleanJSONC = (text) => {
  const input=String(text||"").replace(/^\uFEFF/,"");
  let out="",quoted=false,escaped=false,comment="";
  for(let i=0;i<input.length;i++){
    const c=input[i],next=input[i+1];
    if(comment==="line"){if(c==="\n"){comment="";out+="\n";}continue;}
    if(comment==="block"){if(c==="*"&&next==="/"){comment="";i++;}else if(c==="\n")out+="\n";continue;}
    if(quoted){out+=c;if(escaped)escaped=false;else if(c==="\\")escaped=true;else if(c==='"')quoted=false;continue;}
    if(c==='"'){quoted=true;out+=c;continue;}
    if(c==="/"&&next==="/"){comment="line";i++;continue;}
    if(c==="/"&&next==="*"){comment="block";i++;continue;}
    if(c===","){let j=i+1;while(/\s/.test(input[j]||"")&&j<input.length)j++;if(input[j]==="}"||input[j]==="]")continue;}
    out+=c;
  }
  if(quoted||comment==="block")throw Error("JSONC incompleto: cadena o comentario sin cerrar.");
  return out;
};
export function parseStatsText(text, filename="archivo.json") {
  const csv=/\.csv$/i.test(filename);
  let rows, schema="";
  if(csv){
    rows=parseCSVRows(text);
    if(rows[0] && ("statistic" in rows[0] || "statistic_id" in rows[0])){
      const byId=new Map();
      for(const row of rows){
        const key=asText(row.external_record_id)||[row.fotmob_player_id,row.fotmob_team_id,row.season,row.competition].join("|");
        if(!byId.has(key))byId.set(key,{...row,metrics:[]});
        const item=byId.get(key);
        if(row.statistic && row.value !== ""){
          item.metrics.push({name:row.statistic,value:row.value,per90:row.per90,percentile:row.percentile});
        }
      }
      rows=[...byId.values()];
    }
  }else{
    const raw=JSON.parse(cleanJSONC(text));
    if(Array.isArray(raw)) rows=raw;
    else if(raw && typeof raw==="object"){
      schema=asText(raw.schema);
      // A unified FotMob + CraftedFC batch is NOT a flat STATS-only export.
      // Its season fields live in records[].data and its player snapshot must
      // be imported together through FUENTES, never silently discarded here.
      if(schema==="mf_legacy_external_batch_v1") {
        throw Error("Este JSON combina FotMob + CraftedFC. Usa Importar FotMob + CraftedFC dentro de STATS (no Solo FotMob). Se conserva el snapshot y se revisan los clubes pendientes.");
      }
      rows=Array.isArray(raw.records)?raw.records:raw.record?[raw.record]:[];
    }
    if(!Array.isArray(rows))throw Error("El JSON debe contener un array records.");
  }
  if(!rows?.length)throw Error("Este archivo no contiene estadísticas importables.");
  if(rows.length>30000)throw Error("Lote demasiado grande. Divide el archivo en lotes de hasta 30.000.");
  const byKey=new Map();const errors=[];
  rows.forEach((r,i)=>{
    try {
      const rec=normalizeRecord(r);
      const key=rec.external_record_id;
      if(byKey.has(key)){
        const old=byKey.get(key);
        if(JSON.stringify(old.metrics)!==JSON.stringify(rec.metrics)||old.appearances!==rec.appearances||old.minutes!==rec.minutes||(old.team_matches!=null&&rec.team_matches!=null&&old.team_matches!==rec.team_matches)){
          // No sobrescribir silenciosamente bloques con cifras distintas.
          throw Error("Clave duplicada con datos distintos: "+key);
        }
      }else byKey.set(key,rec);
    }catch(err){errors.push("Fila "+(i+2)+": "+(err.message||err));}
  });
  if(errors.length)throw Error(errors.slice(0,7).join("\n")+(errors.length>7?"\n... ("+errors.length+" errores)": ""));
  return {records:[...byKey.values()],schema,originalCount:rows.length};
}
export const metricGroups = [
  ["Resumen",["goals","assists","xg","xa","shots","shots_on_target"]],
  ["Ataque",["goals","assists","xg","xa","xgot","shots","shots_on_target","bigchancescreated"]],
  ["Creación",["accuratepasses","passaccuracy","chancescreated","keypasses","xa","crossaccuracy"]],
  ["Defensa",["tackles","interceptions","clearances","recoveries","duelswon","cleansheets"]],
  ["Portería",["saves","savepercentage","cleansheets","goalsconceded"]],
  ["Físico",["topspeed","totaldistancecovered","numberofsprints"]],
];
export const metricLabel = (name) => {
  const key=normalizeLabel(name);
  const labels={
    goals:"Goles",goles:"Goles",assists:"Asistencias",asistencias:"Asistencias",xg:"Goles esperados (xG)",
    xa:"Asistencias esperadas (xA)",xgot:"xG a puerta",npxg:"xG sin penaltis",
    shots:"Tiros",shotsontarget:"Tiros a puerta",headedshots:"Tiros de cabeza",
    topspeed:"Velocidad máxima",totaldistancecovered:"Distancia recorrida",running:"Carrera",
    sprinting:"Sprint",numberofsprints:"Número de sprints",
    accuratepasses:"Pases completados",passaccuracy:"Precisión de pases (%)",
    accuratelongballs:"Pases largos precisos",longballaccuracy:"Precisión de pases largos (%)",
    linebreakingpasses:"Pases que rompen líneas",chancescreated:"Oportunidades creadas",
    bigchancescreated:"Ocasiones claras creadas",successfulcrosses:"Centros completados",
    crossaccuracy:"Precisión de centros (%)",dribbles:"Regates exitosos",
    dribblessuccessrate:"Éxito en regates (%)",duelswon:"Duelos ganados",
    duelswon:"Duelos ganados",aerialswon:"Duelos aéreos ganados",
    touches:"Toques",touchesinoppositionbox:"Toques en área rival",
    dispossessed:"Pérdidas de balón",foulswon:"Faltas recibidas",defensiveactions:"Acciones defensivas",
    tackles:"Entradas",interceptions:"Intercepciones",blockedscoringattempt:"Tiros bloqueados",
    foulscommitted:"Faltas",recoveries:"Recuperaciones",possessionwonfinal3rd:"Recuperaciones en campo rival",
    dribbledpast:"Regateado",clearances:"Despejes",cleansheets:"Porterías a cero",
    goalsconcededwhileonpitch:"Goles encajados en el campo",xgagainstwhileonpitch:"xG encajado en el campo",
    yellowcards:"Tarjetas amarillas",redcards:"Tarjetas rojas",
    saves:"Paradas",savepercentage:"Porcentaje de paradas",
    minutes:"Minutos",appearances:"Partidos",rating:"Nota FotMob",
  };
  return labels[key]||name;
};

