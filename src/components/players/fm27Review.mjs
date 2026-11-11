// FM27 manual review tracking. FM26 CA/CP remain untouched.
export const isFm27Reviewed=player=>player?.fm27_reviewed===true;
export const hasFm27Value=player=>player?.fm27_ca!==null&&player?.fm27_ca!==undefined&&player?.fm27_ca!==""||
 player?.fm27_cp!==null&&player?.fm27_cp!==undefined&&player?.fm27_cp!=="";
export const fm27ReviewSummary=players=>{
 const reviewed=players.filter(isFm27Reviewed).length;
 return {reviewed,total:players.length,pending:players.length-reviewed};
};
export function fm27FilterPlayer(player,filter){
 if(filter==="reviewed")return isFm27Reviewed(player);
 if(filter==="pending")return !isFm27Reviewed(player);
 return true;
}
export function fm27Value(value){
 if(value===""||value===null||value===undefined)return null;
 const n=Number(value);
 return Number.isInteger(n)&&n>=0&&n<=200?n:null;
}
export function fm27Delta(previous,current){
 const a=fm27Value(previous),b=fm27Value(current);
 return a===null||b===null?null:b-a;
}
export function fm27Payload(form,original,now=new Date()){
 const ca=fm27Value(form.fm27Ca),cp=fm27Value(form.fm27Cp);
 if(form.fm27Ca!==""&&ca===null)throw Error("El CA de FM27 debe ser un entero entre 0 y 200.");
 if(form.fm27Cp!==""&&cp===null)throw Error("El CP de FM27 debe ser un entero entre 0 y 200.");
 const reviewed=Boolean(form.fm27Reviewed);
 return {
  fm27_ca:ca,
  fm27_cp:cp,
  fm27_reviewed:reviewed,
  fm27_reviewed_at:reviewed?(original?.fm27_reviewed&&original?.fm27_reviewed_at?original.fm27_reviewed_at:now.toISOString().slice(0,10)):"",
  fm27_review_notes:String(form.fm27ReviewNotes||"").trim()
 };
}
