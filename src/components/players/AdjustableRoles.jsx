import React from "react";
import RoleFieldConcept from "./RoleFieldConcept";
import LayoutEditor from "./LayoutEditor";

// Sustituir estos valores por las coordenadas copiadas tras ajustar visualmente.
const DEFAULT={left:-154,bottom:258,width:517};
export default function AdjustableRoles({ratings,playerId,position,foot}){
 return <LayoutEditor name="Roles" initial={DEFAULT} legacyKey="mf-legacy-roles-layout-v1" aspectRatio={3/2} zIndex={24}>
  <RoleFieldConcept ratings={ratings} playerId={playerId} position={position} foot={foot}/>
 </LayoutEditor>;
}
