import React from "react";

// Posición definitiva elegida en el editor visual. No depende del almacenamiento local.
const IMAGE="https://media.base44.com/images/public/6a88359fd43f2af862874b12/b4d97cd52_modulos_derecha_mf_legacy_recortados.png";
const LAYOUT={left:1009,bottom:378,width:654,zIndex:4};

export default function AdjustableRightModules(){
 return <div className="pointer-events-none absolute hidden lg:block" style={LAYOUT}>
   <img src={IMAGE} alt="Módulos derechos: Last Game, Next Game y cuatro paneles de contenido" className="block h-auto w-full"/>
 </div>;
}
