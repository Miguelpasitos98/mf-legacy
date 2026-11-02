/**
 * Bulk selection for an existing visible group (league or club).
 * Preserve selections in other groups and toggle the entire group atomically.
 * Never changes Player entities, and never selects filtered-out players.
 */
export function groupPlayerIds(players = []){
 return [...new Set(players.map(p => String(p?.id ?? "").trim()).filter(Boolean))];
}
export function selectedGroupCount(selectedIds = [], players = []){
 const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds.map(String));
 return groupPlayerIds(players).filter(id=>selected.has(id)).length;
}
export function toggleGroupSelection(selectedIds = [], players = []){
 const ids = groupPlayerIds(players);
 const selected = new Set(selectedIds.map(String));
 if(!ids.length)return [...selected];
 const allSelected = ids.every(id=>selected.has(id));
 for(const id of ids){
  if(allSelected)selected.delete(id);
  else selected.add(id);
 }
 return [...selected];
}
