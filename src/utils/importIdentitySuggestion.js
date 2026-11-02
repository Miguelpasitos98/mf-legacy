const PROPOSAL_STATES=new Set(['probable','alta_confianza','identidad_confirmada']);
const id=value=>typeof value==='string'&&/^\d{1,15}$/.test(value);
const date=value=>{const text=String(value||'').trim(),match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);return match?`${match[3]}-${match[2]}-${match[1]}`:text.slice(0,10);};
export function importIdentitySuggestion(view){
 if(!view?.player?.fm26_uid||view.link||view.status==='conflicto')return null;
 const match=view.candidate,fid=match?.proposed_fotmob_id||match?.confirmed_fotmob_id||'';
 if(!match||String(match.fm26_uid)!==String(view.player.fm26_uid)||!PROPOSAL_STATES.has(match.status)||!id(fid)||view.source?.fotmob_id!==fid)return null;
 const candidates=match.candidates||[],best=candidates.find(c=>c.fotmob_id===fid);
 if(!best||best.catalogue_conflict||!(best.similarity>=.94)||!(match.confidence>=.6&&match.confidence<=1))return null;
 if(candidates.some(c=>c!==best&&Math.abs(Number(best.score)-Number(c.score))<.04))return null;
 const dates=[view.player.date_of_birth,match.fm26_birth_date,view.source.birth_date,best.birth_date].filter(Boolean).map(date);
 if(new Set(dates).size>1)return null;
 return {fotmob_id:fid,name:view.source.player_name||best.name||'',confidence:match.confidence,candidate_id:match.id};
}

