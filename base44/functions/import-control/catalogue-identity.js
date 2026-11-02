const rows=value=>Array.isArray(value)?value:value?.items||value?.data||[];
const date=value=>{const text=String(value||'').trim(),m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);return m?`${m[3]}-${m[2]}-${m[1]}`:text.slice(0,10);};
export async function validateCatalogueImport(db,player,candidateId,fotmobId){
 if(!player.fm26_uid||typeof candidateId!=='string')throw Error('El jugador no tiene una correspondencia FM26 válida.');
 const found=rows(await db.Fm26IdentityCandidate.filter({fm26_uid:String(player.fm26_uid)},undefined,3));
 if(found.length!==1||found[0].id!==candidateId)throw Error('La propuesta del catálogo cambió o no es única. Vuelve a seleccionar el jugador.');
 const match=found[0],proposed=match.proposed_fotmob_id||match.confirmed_fotmob_id;
 if(proposed!==fotmobId||!['probable','alta_confianza','identidad_confirmada'].includes(match.status)||!(match.confidence>=.6))throw Error('El ID ya no coincide con una propuesta válida del catálogo.');
 const candidates=match.candidates||[],best=candidates.find(c=>c.fotmob_id===fotmobId);
 if(!best||best.catalogue_conflict||!(best.similarity>=.94)||candidates.some(c=>c!==best&&Math.abs(Number(best.score)-Number(c.score))<.04))throw Error('La correspondencia del catálogo es ambigua o insuficiente.');
 const sources=rows(await db.FotmobCatalogPlayer.filter({fotmob_id:fotmobId},undefined,3));
 if(sources.length!==1)throw Error('Falta una ficha FotMob única en el catálogo.');
 const dates=[player.date_of_birth,match.fm26_birth_date,sources[0].birth_date,best.birth_date].filter(Boolean).map(date);
 if(new Set(dates).size>1)throw Error('Las fechas de nacimiento de la correspondencia son incompatibles.');
 return {candidate_id:match.id,fm26_uid:String(player.fm26_uid)};
}

