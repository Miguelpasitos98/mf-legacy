import React, {useMemo} from "react";
import RoleFieldConcept from "./RoleFieldConcept";

// Keep the user's last saved placement and size, without editing controls.
const KEY="mf-legacy-roles-layout-v1";
const DEFAULT={left:-154,bottom:258,width:517};
const load=()=>{
 try {
  const stored=JSON.parse(window.localStorage.getItem(KEY)||"null");
  return stored&&["left","bottom","width"].every(k=>Number.isFinite(stored[k]))?stored:DEFAULT;
 } catch {return DEFAULT;}
};
export default function AdjustableRoles({ratings,playerId,position,foot}){
 const layout=useMemo(load,[]);
 return <div className="pointer-events-none absolute hidden lg:block" style={{...layout,zIndex:24}}>
  <RoleFieldConcept ratings={ratings} playerId={playerId} position={position} foot={foot}/>
 </div>;
}
