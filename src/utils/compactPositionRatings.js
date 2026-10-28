// The visual MC lane is a preference presentation, not a stored FM rating.
// Original position scores remain untouched in the editor.
export function compactPositionValue(ratings={},key){
 const num=k=>{const v=Number(ratings[k]);return Number.isFinite(v)?Math.min(20,Math.max(0,v)):0;};
 if(key==="carrilero_izquierdo")return Math.max(num(key),num("defensa_izquierdo"));
 if(key==="carrilero_derecho")return Math.max(num(key),num("defensa_derecho"));
 if(key==="mc_left"||key==="mc_right"){
  const left=num("centrocampista_izquierdo"),right=num("centrocampista_derecho");
  const preferred=left>right?"mc_left":right>left?"mc_right":null;
  return preferred===key?20:num("centrocampista");
 }
 return num(key);
}
