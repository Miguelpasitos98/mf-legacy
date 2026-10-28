import React from "react";
import BestSeasonRadar from "./BestSeasonRadar";
import LayoutEditor from "./LayoutEditor";

// Posición definitiva elegida en el editor visual. No depende del almacenamiento local.
const IMAGE="https://media.base44.com/images/public/6a88359fd43f2af862874b12/57555fcd5_mf_legacy_right_modules_actual.png";
const FALLBACK_IMAGE="https://media.base44.com/images/public/6a88359fd43f2af862874b12/b4d97cd52_modulos_derecha_mf_legacy_recortados.png";
const LAYOUT={left:1009,bottom:378,width:500,zIndex:4};

export default function AdjustableRightModules({playerId, color}){
 return <LayoutEditor name="Módulos derecha" initial={LAYOUT} aspectRatio={1448/1086} zIndex={4}>
   <img src={IMAGE} alt="Módulos derechos: Last Game, Next Game y cuatro paneles de contenido" className="block h-auto w-full" onError={(event)=>{if(!event.currentTarget.dataset.fallback){event.currentTarget.dataset.fallback="true";event.currentTarget.src=FALLBACK_IMAGE;}}}/>
   <BestSeasonRadar playerId={playerId} color={color}/>
 </LayoutEditor>;
}
