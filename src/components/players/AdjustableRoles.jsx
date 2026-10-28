import React from "react";
import RoleFieldConcept from "./RoleFieldConcept";

// Ubicación definitiva del módulo, seleccionada visualmente en PLAYERS.
const LAYOUT={left:-154,bottom:258,width:517};
export default function AdjustableRoles({ratings}){
 return <div className="pointer-events-none absolute hidden lg:block" style={LAYOUT}>
  <RoleFieldConcept ratings={ratings}/>
 </div>;
}
