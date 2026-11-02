// MF LEGACY V4 — explicit, conservative translation of saved role descriptions.
// The role names are coach instructions, NOT observations of player capability.
// Every metric below must be available from a real same-season player record;
// unmeasured speed, leadership, positioning and movement are never scored.
export const V4_ROLE_METRICS={
 GK:["preventing","passing","longPassing"],
 CB:["buildup","passing","longPassing","defense","defensiveActions","tackles","interceptions","recoveries","clearances","aerialsWon"],
 FB:["xa","buildup","chain","defense","defensiveActions","tackles","interceptions","recoveries","pressure","dribbles","passing","longPassing","chancesCreated"],
 DM:["buildup","passing","longPassing","defense","defensiveActions","recoveries","interceptions","tackles","pressure","chain"],
 AM:["xa","chain","creation","chancesCreated","buildup","passing","dribbles","recoveries","pressure","xg","shot"],
 WG:["xa","dribbles","chain","creation","chancesCreated","xg","shot","touchesBox","pressure","recoveries","tackles"],
 ST:["xg","shot","chain","xa","passing","chancesCreated","touchesBox","aerialsWon","pressure","recoveries"]
};
export const V4_METRIC_LABELS={
 preventing:"Goles evitados /90",passing:"Pases precisos /90",longPassing:"Pases largos precisos /90",
 buildup:"xG Buildup /90",chain:"xG Chain /90",xa:"xA /90",xg:"xG sin penaltis /90",
 defense:"Acciones defensivas ajustadas /90 (experimental)",defensiveActions:"Acciones defensivas /90 (sin ajustar)",
 tackles:"Entradas /90",interceptions:"Intercepciones /90",recoveries:"Recuperaciones /90",
 clearances:"Despejes /90",aerialsWon:"Duelos aéreos ganados /90 (volumen)",
 pressure:"Recuperaciones en último tercio /90",dribbles:"Regates /90",
 creation:"Ocasiones claras creadas /90",chancesCreated:"Ocasiones creadas /90",
 shot:"Tiros a puerta /90",touchesBox:"Toques en área rival /90"
};
export const TACTICAL_REQUIREMENT_RULES=[
 {id:"sweeper_keeper_distribution",label:"Distribución del portero-líbero (proxy parcial)",roles:["GK"],metrics:["passing","longPassing"],terms:["sweeper keeper","sweeper-keeper","portero libero","portero adelantado"]},
 {id:"goalkeeper_distribution",label:"Juego con los pies del portero (proxy)",roles:["GK"],metrics:["passing","longPassing"],terms:["distribucion","distribuidor","juego de pies","salida de balon"]},
 {id:"goalkeeper_stopping",label:"Paradas bajo palos (proxy parcial)",roles:["GK"],metrics:["preventing"],terms:["shot stopper","shot-stopper","seguridad bajo palos","portero fiable"]},
 {id:"ball_playing_defender",label:"Construcción desde la defensa",roles:["CB"],metrics:["passing","longPassing","buildup"],terms:["ball playing","ball-playing","central constructor","defensas con salida","con salida","salida de balon","sacar el balon","central con balon"]},
 {id:"defensive_stopper",label:"Acciones e intervención defensiva (proxy)",roles:["CB"],metrics:["defensiveActions","interceptions","tackles"],terms:["defensive stopper","stopper","aggressive","agresivo","agresivos","defensores agresivos","contundencia","defensas agresivos"]},
 {id:"defensive_cover",label:"Intervención y cobertura defensiva (proxy)",roles:["CB"],metrics:["interceptions","clearances","defensiveActions"],terms:["correctores","cobertura","solidez defensiva","bloque bajo solido"]},
 {id:"aerial_presence",label:"Presencia aérea defensiva (volumen, no eficacia)",roles:["CB"],metrics:["aerialsWon","clearances"],terms:["dominante por alto","juego aereo","dominantes en el aire"]},
 {id:"wing_attack",label:"Participación ofensiva de lateral/carrilero",roles:["FB"],metrics:["xa","dribbles","chancesCreated"],terms:["attacking wing back","attacking wing-back","carrileros ofensivos","laterales ofensivos","lateral profundo","profundidad","carril ofensivo","centros","incorporaciones","motor ofensivo","playmaker attacking"]},
 {id:"inverted_fullback",label:"Asociación del lateral invertido (proxy parcial)",roles:["FB"],metrics:["passing","buildup","chain"],terms:["inverted full back","inverted full-back","lateral invertido","invertidos","lateral interior","carrilero invertido","apoyo tecnico","playmaker"]},
 {id:"defensive_fullback",label:"Trabajo defensivo del lateral (acciones)",roles:["FB"],metrics:["defensiveActions","tackles","recoveries"],terms:["laterales defensivos","defensive","defensivos","repliegue"]},
 {id:"fullback_workrate",label:"Participación en ambas fases (proxy, no resistencia)",roles:["FB"],metrics:["recoveries","xa","chancesCreated"],terms:["high energy","high-energy","ida y vuelta","laterales con recorrido","carrileros de recorrido"]},
 {id:"regista",label:"Organización desde la base",roles:["DM","CB"],metrics:["buildup","passing","longPassing"],terms:["regista","deep lying playmaker","deep-lying playmaker","organizador retrasado","pivote organizador","pivote posicional"]},
 {id:"shield",label:"Protección del pivote (acciones defensivas)",roles:["DM"],metrics:["defense","defensiveActions","recoveries","interceptions","tackles"],terms:["holding midfielder","shield","ball winner","ball-winner","ball winning midfielder","pivote defensivo","ancla","recuperador","contencion","pivote recuperador"]},
 {id:"pivot_balanced",label:"Actividad equilibrada del pivote (proxy parcial)",roles:["DM"],metrics:["passing","recoveries"],terms:["pivot","pivote equilibrado","doble pivote equilibrado","equilibrio y distribucion","equilibrador"]},
 {id:"high_pressure",label:"Recuperación y presión (proxies de acciones)",roles:["ST","WG","AM","DM","FB","CB"],metrics:["pressure","recoveries"],terms:["presion alta","presion tras perdida","presionar","presionante","recuperacion alta","recuperar arriba","gegenpressing","high presser","high-presser","pressing forward","pressing-forward","high pressing","high-pressing"]},
 {id:"creative_playmaker",label:"Creación y último pase",roles:["AM","WG","DM","FB"],metrics:["xa","creation","chancesCreated","chain"],terms:["creative","creativo","creatividad","advanced playmaker","creative playmaker","playmaker","enganche creativo","creator","creador","ultimo pase","vision","asistencias","crear ocasiones","generador de juego"]},
 {id:"box_to_box",label:"Actividad de interior de ida y vuelta (proxy)",roles:["AM"],metrics:["recoveries","chancesCreated","xa"],terms:["box to box","box-to-box","interiores llegadores","interiores con llegada","interiores dinamicos","mediapunta llegador"]},
 {id:"wing_dribbling",label:"Desborde y creación por banda",roles:["WG","AM","FB"],metrics:["dribbles","xa","chancesCreated"],terms:["desborde","regate","uno contra uno","desequilibrio","desequilibrantes","wide winger","extremos abiertos","amplitud"]},
 {id:"inside_forward",label:"Llegada y remate desde banda (proxy)",roles:["WG"],metrics:["xg","shot","touchesBox"],terms:["inside forward","inside-forward","wide forward","wide-forward","extremos hacia adentro","extremo interior","diagonales","hacia adentro"]},
 {id:"wing_tracking",label:"Retorno defensivo del extremo (acciones)",roles:["WG"],metrics:["recoveries","pressure","tackles"],terms:["repliegue","extremos de sacrificio","defensa por banda"]},
 {id:"wing_direct",label:"Acciones verticales (no mide velocidad)",roles:["WG"],metrics:["dribbles","touchesBox"],terms:["direct","verticalidad"]},
 {id:"false_nine",label:"Participación creadora del falso nueve (proxy)",roles:["ST"],metrics:["xa","chancesCreated","chain"],terms:["false nine","false-nine","false 9","falso nueve","delantero de apoyo"]},
 {id:"target_man",label:"Presencia en área y juego aéreo (volumen)",roles:["ST"],metrics:["aerialsWon","touchesBox"],terms:["target man","target-man","referencia","delantero de referencia","delantero referencia","referencia solitaria"]},
 {id:"complete_forward",label:"Producción ofensiva del delantero completo (proxy)",roles:["ST"],metrics:["xg","shot","xa","chancesCreated"],terms:["complete forward","complete-forward","delantero completo"]},
 {id:"finishing",label:"Finalización y amenaza",roles:["ST","WG","AM"],metrics:["xg","shot","touchesBox"],terms:["rematador","finalizacion","goleador","atacar el area","desmarque","definicion","delantero de area","finalizador","finalizadores","movilidad y remate"]},
 {id:"progressive",label:"Progresión ofensiva (participación)",roles:["CB","FB","DM","AM","WG"],metrics:["chain","buildup","longPassing"],terms:["progresivo","progresion","superar lineas","romper lineas","pases verticales","control de ritmo"]},
 {id:"long_distribution",label:"Distribución larga",roles:["GK","CB","DM"],metrics:["longPassing","passing"],terms:["desplazamiento largo","pase largo","juego directo","cambio de orientacion"]},
 {id:"defensive",label:"Acciones defensivas generales",roles:["CB","FB","DM"],metrics:["defensiveActions","interceptions","recoveries","tackles"],terms:["solidez","anticipacion","recuperaciones","defender","marcaje","duelos defensivos","contencion"]},
 {id:"passing_possession",label:"Participación en pase y circulación",roles:["CB","FB","DM","AM"],metrics:["passing","buildup"],terms:["juego asociativo","construccion","circulacion","combinativo","iniciar juego","organizador","distribucion","distribuidor"]}
];
// Terms that signal a requested trait for which the historical dataset has no direct measurement.
// Never substitute FM26 attributes or generic activity as a measured historical capability.
export const UNMEASURED_ROLE_TRAITS=[
 {label:"Velocidad y aceleración sin medición histórica",terms:["rapido","rapidos","fast","velocidad","pacy","aceleracion"],roles:["CB","FB","WG","ST"]},
 {label:"Liderazgo y personalidad sin medición histórica",terms:["lider","lideres","valiente","inteligencia tactica"],roles:["GK","CB","FB","DM","AM","WG","ST"]},
 {label:"Movimientos y ocupación de espacios no observados",terms:["generador de espacios","movilidad","movimientos sin balon"],roles:["ST","WG","AM"]},
 {label:"Resistencia y esfuerzo físico no medidos directamente",terms:["resistencia","sacrificio","fisico","physical","high energy"],roles:["CB","FB","DM","AM","WG","ST"]}
];
