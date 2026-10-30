import React from "react";
import BestSeasonRadar from "./BestSeasonRadar";

// Anclaje del conjunto: cada capa se ajusta independientemente.
const IMAGE="https://media.base44.com/images/public/6a88359fd43f2af862874b12/57555fcd5_mf_legacy_right_modules_actual.png";
const FALLBACK_IMAGE="https://media.base44.com/images/public/6a88359fd43f2af862874b12/b4d97cd52_modulos_derecha_mf_legacy_recortados.png";
const ANCHOR={left:1009,bottom:378,width:500,height:1,zIndex:4};
const BACKGROUND={left:3,top:-598,width:640,height:480,zIndex:4};

export default function AdjustableRightModules({playerId,color,adaptive=false}){
 return <div className={adaptive ? "mf-player-right-modules" : "pointer-events-none absolute hidden lg:block"} style={adaptive ? undefined : ANCHOR}>
   <div className={adaptive ? "mf-player-match-art" : "pointer-events-none absolute"} style={adaptive ? undefined : BACKGROUND}>
     <img src={IMAGE} alt="Módulos derechos: Last Game, Next Game y cuatro paneles de contenido" className="block h-auto w-full" onError={event=>{if(!event.currentTarget.dataset.fallback){event.currentTarget.dataset.fallback="true";event.currentTarget.src=FALLBACK_IMAGE;}}}/>
   </div>
   <BestSeasonRadar adaptive={adaptive} playerId={playerId} color={color}/>
 </div>;
}
