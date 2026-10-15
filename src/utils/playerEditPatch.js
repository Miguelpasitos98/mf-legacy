// Build minimal, non-destructive Base44 Player patches from actual user edits.
// A photo URL is a string reference: we never fetch or upload it before saving.
// No unedited FM26 fields (stats, CA, positions, salary...) go to the server.
const FIELD_MAP={
  name:["name"],
  dateOfBirth:["date_of_birth"],
  teamId:["team_id","last_team_id"],
  careerStatus:["team_id","career_status","last_team_id","retirement_year"],
  lastTeamId:["last_team_id"],
  retirementYear:["retirement_year"],
  countryId:["country_id"],
  secondaryCountryId:["secondary_country_id","fm26_second_country_ids"],
  fmPosition:["fm_position"],
  bestPositions:["best_positions"],
  roleUsedToFillEmptyAttributes:["role_used_to_fill_empty_attributes"],
  preferredCentralPosition:["preferred_central_position"],
  style:["style"],
  height:["height"],
  rightFoot:["right_foot"],
  leftFoot:["left_foot"],
  shirtNumber:["shirt_number"],
  salary:["salary"],
  photoUrl:["photo_url"],
  cardPhotoUrl:["card_photo_url"],
  nationalCardPhotoUrl:["national_card_photo_url"],
  ca:["ca"],
  cp:["cp"],
  positionRatings:["position_ratings"],
  stats:["stats"],
  description:["description"]
};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

export function changedPlayerFields(form,initialForm,fullPayload){
  const changed=new Set();
  for(const [formKey,payloadKeys] of Object.entries(FIELD_MAP)){
    if(same(form?.[formKey],initialForm?.[formKey]))continue;
    for(const key of payloadKeys)changed.add(key);
  }
  const patch={};
  for(const key of changed){
    if(Object.prototype.hasOwnProperty.call(fullPayload,key))patch[key]=fullPayload[key];
  }
  return patch;
}
export const playerEditHasChanges=(patch)=>Object.keys(patch||{}).length>0;

// Keep known camelCase presentation fields aligned with Base44's snake_case
// fields. Apply this only after the server has confirmed an update.
const CAMEL={
  photo_url:"photoUrl",
  card_photo_url:"cardPhotoUrl",
  national_card_photo_url:"nationalCardPhotoUrl",
  date_of_birth:"dateOfBirth",
  team_id:"teamId",
  country_id:"countryId",
  secondary_country_id:"secondaryCountryId",
  position_ratings:"positionRatings"
};
export function applyPlayerEditPatch(player,patch){
  const updated={...player,...patch};
  for(const [key,camel] of Object.entries(CAMEL)){
    if(Object.prototype.hasOwnProperty.call(patch,key))updated[camel]=patch[key];
  }
  return updated;
}
export function updatePlayerCacheRows(rows,playerId,patch){
  if(!Array.isArray(rows)||!playerId)return rows;
  let changed=false;
  const result=rows.map(player=>{
    if(String(player.id)!==String(playerId))return player;
    changed=true;
    return applyPlayerEditPatch(player,patch);
  });
  return changed?result:rows;
}
