const cleanText = s => String(s||"").trim();
const slug = s => cleanText(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase();
const COUNTRY_ALIASES = {
  DEU:["alemania","germany","deutschland","german"],
  ESP:["espana","spain","spanish","espanol"],
  FRA:["francia","france","french"],
  ITA:["italia","italy","italian"],
  PRT:["portugal","portuguese"],
  ENG:["inglaterra","england","english"],
  GBR:["reino unido","united kingdom","british"],
  NLD:["paises bajos","netherlands","holland","holandes"],
  BRA:["brasil","brazil","brazilian"],
  ARG:["argentina","argentine"],
  USA:["estados unidos","united states","american"]
};
export const resolveManagerCountry = (draft,countries=[]) => {
  const current=countries.find(c=>String(c.id)===String(draft.country_id||""));
  if(current)return current;
  const value=slug(draft.nationality);
  if(!value)return null;
  return countries.find(c=>{
    const name=slug(c.name),code=String(c.code||"").toUpperCase();
    return name===value || slug(code)===value || (COUNTRY_ALIASES[code]||[]).includes(value);
  })||null;
};
export const buildManagerBiographyPrompt = (name, selectedCountry="") => {
  const n=cleanText(name);
  if(n.length<2)throw Error("Escribe el nombre del entrenador antes de generar su biografía.");
  return `Eres un investigador de historia del fútbol para la base de datos MF LEGACY.
Investiga al entrenador: "${n}"${selectedCountry?", nacionalidad indicada: "+selectedCountry:""}.
Redacta EN ESPAÑOL un único párrafo biográfico de entre 100 y 160 palabras, en tercera persona, preciso, con tono de enciclopedia deportiva y apto para el campo "Trayectoria y descripción".
Incluye las etapas como entrenador en orden cronológico, clubes y años verificables, principales hitos y títulos, y termina, si está contrastada, con su responsabilidad profesional más reciente.
Comprueba la información en fuentes oficiales de clubes, federaciones y competiciones cuando sea posible. NO inventes temporadas, títulos ni cargos; NO confundas su trayectoria como entrenador con la de jugador. Distingue expresamente cargos ejecutivos de cargos de entrenador. Si una fecha o cargo no está contrastado, omítelo.
NO atribuyas al nombre una identidad si hay homónimos; en caso de duda responde con una advertencia breve y pide un dato distintivo.
Devuelve únicamente el párrafo en español, sin Markdown, sin enlaces inventados, ni listas.`;
};
export const parseBiographyResponse = result => {
  const raw=typeof result==="string"?result:typeof result?.response==="string"?result.response:
    typeof result?.text==="string"?result.text:typeof result?.biography==="string"?result.biography:"";
  const content=raw.trim();
  if(!content || content.length<30)throw Error("La IA no devolvió una biografía útil. Usa «Copiar prompt» para investigarla en ChatGPT.");
  return content.slice(0,3000);
};
