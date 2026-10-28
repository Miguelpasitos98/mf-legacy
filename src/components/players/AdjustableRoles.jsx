import React from "react";
import RoleFieldConcept from "./RoleFieldConcept";

// Coordenadas definitivas fijadas en código, compartidas entre todos los navegadores.
const LAYOUT={left:-117,bottom:355,width:527.0001220703125,zIndex:24};
export default function AdjustableRoles({ratings,playerId,position,foot}){
 return <div className="pointer-events-none absolute hidden lg:block" style={LAYOUT}>
  <RoleFieldConcept ratings={ratings} playerId={playerId} position={position} foot={foot}/>
 </div>;
}
