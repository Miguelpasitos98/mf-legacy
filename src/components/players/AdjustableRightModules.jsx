import React from "react";
import BestSeasonRadar from "./BestSeasonRadar";
import LayoutEditor from "./LayoutEditor";

// Anclaje del conjunto: cada capa se ajusta independientemente.
const IMAGE="https://media.base44.com/images/public/6a88359fd43f2af862874b12/57555fcd5_mf_legacy_right_modules_actual.png";
const FALLBACK_IMAGE="https://media.base44.com/images/public/6a88359fd43f2af862874b12/b4d97cd52_modulos_derecha_mf_legacy_recortados.png";
const ANCHOR={left:1009,bottom:378,width:500,height:1,zIndex:4};
const BACKGROUND={left:0,top:0,width:500};

export default function AdjustableRightModules({playerId,color}){
 return <div className="pointer-events-none absolute hidden lg:block" style={ANCHOR}>
   <LayoutEditor name="Módulos derecha" initial={BACKGROUND} aspectRatio={1448/1086} zIndex={4}>
     <img src={IMAGE} alt="Módulos derechos: Last Game, Next Game y cuatro paneles de contenido" className="block h-auto w-full" onError={event=>{if(!event.currentTarget.dataset.fallback){event.currentTarget.dataset.fallback="true";event.currentTarget.src=FALLBACK_IMAGE;}}}/>
   </LayoutEditor>
   <BestSeasonRadar playerId={playerId} color={color}/>
 </div>;
}
