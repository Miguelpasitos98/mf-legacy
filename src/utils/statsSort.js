import {columnValue} from "./statsColumns.js";
import {norm} from "./statsViews.js";
export const defaultSortDirection=key=>["player","club","season","competition"].includes(key)?"asc":"desc";
export const nextSorting=(currentKey,currentDirection,clickedKey)=>({
 key:clickedKey,
 direction:clickedKey===currentKey?(currentDirection==="desc"?"asc":"desc"):defaultSortDirection(clickedKey)
});
export function sortStatsItems(items,mode,key,direction,config){
 const getItemValue=item=>{
  const row=mode==="season"?item.summary:item.record;
  const player=item.player;
  if(key==="player")return player?.name||row?.player_name||"";
  if(key==="season")return row?.season||"";
  if(key==="competition")return row?.competition||"";
  if(key==="club")return mode==="season"?row?.mainClub?.name||"":row?.team_name||"";
  return columnValue(row,mode,key,config);
 };
 const dir=direction==="asc"?1:-1;
 return items.map((item,index)=>({item,index,value:getItemValue(item)})).sort((a,b)=>{
  const empty=v=>v===null||v===undefined||v===""||typeof v==="number"&&!Number.isFinite(v);
  if(empty(a.value)||empty(b.value)){
   if(empty(a.value)!==empty(b.value))return empty(a.value)?1:-1;
   return a.index-b.index;
  }
  const cmp=typeof a.value==="number"&&typeof b.value==="number"?a.value-b.value:String(a.value).localeCompare(String(b.value),"es",{numeric:true,sensitivity:"base"});
  return cmp*dir||a.index-b.index;
 }).map(entry=>entry.item);
}
