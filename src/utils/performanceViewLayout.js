// Visual layout policy for individual-player Performance tabs only.
// The source data and configurable metrics remain untouched.
export const PERFORMANCE_TABS=["Resumen","Ataque","Creación","Defensa","Portería","Físico"];
export const GENERAL_PERFORMANCE_COLUMNS=["appearances","minutes","team_matches","rating"];
export const showPerformanceGeneral=category=>category==="Resumen"||category==="Portería";
export const showPerformanceOverviewCards=category=>category==="Resumen";
// Advanced statistics are grouped by football function. Resumen keeps its
// existing overview until the user chooses a final set of summary indicators.
export const performanceAdvancedKeys=category=>
 category==="Resumen"?["chain","buildup","ground"]:
 category==="Creación"?["chain","buildup"]:
 category==="Defensa"?["ground"]:[];
export const visiblePerformanceMetricColumns=(columns,category)=>
 showPerformanceGeneral(category)?(columns||[]):
 (columns||[]).filter(id=>!GENERAL_PERFORMANCE_COLUMNS.includes(id));
