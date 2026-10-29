// Local browser-only navigation memory for PLAYERS. No player or account
// data is cached here; only list display choices and scroll offset.
export const PLAYERS_VIEW_KEY = "mf-legacy:players-list-view:v1";
export const PLAYERS_VIEW_MODES = ["all","teams","countries","positions","age","description"];
export const PLAYERS_SORT_OPTIONS = ["","ca","cp","position","name_asc","name_desc","age_youngest","age_oldest"];
export const DEFAULT_PLAYERS_VIEW = Object.freeze({
 view:"all",teamFilterId:"",positionFilter:"",sortBy:"",search:"",searchOpen:false,scrollTop:0
});

export function sanitizePlayersViewState(value){
 const v=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
 const str=x=>typeof x==="string"?x.slice(0,200):"";
 const scroll=Number(v.scrollTop);
 return {
  view:PLAYERS_VIEW_MODES.includes(v.view)?v.view:"all",
  teamFilterId:str(v.teamFilterId),
  positionFilter:str(v.positionFilter),
  sortBy:PLAYERS_SORT_OPTIONS.includes(v.sortBy)?v.sortBy:"",
  search:str(v.search),
  searchOpen:Boolean(v.searchOpen||v.search),
  scrollTop:Number.isFinite(scroll)&&scroll>=0?Math.min(Math.round(scroll),10_000_000):0
 };
}
export function readPlayersViewState(storage=typeof window!=="undefined"?window.localStorage:null){
 try{
  const raw=storage?.getItem(PLAYERS_VIEW_KEY);
  return sanitizePlayersViewState(raw?JSON.parse(raw):DEFAULT_PLAYERS_VIEW);
 }catch{return {...DEFAULT_PLAYERS_VIEW};}
}
export function savePlayersViewState(value,storage=typeof window!=="undefined"?window.localStorage:null){
 try{
  if(!storage)return false;
  storage.setItem(PLAYERS_VIEW_KEY,JSON.stringify(sanitizePlayersViewState(value)));
  return true;
 }catch{return false;}
}
