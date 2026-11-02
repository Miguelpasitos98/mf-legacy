/**
 * PLAYERS card identity is independent of multi-selection state.
 * Candidate eligibility is the user-controlled boolean saved on Player.
 */
export function candidateOutlineClass(player,selected=false){
 const candidate=player?.manager_fit_candidate===true;
 if(candidate&&selected)return "border-emerald-600 ring-2 ring-blue-400 hover:border-emerald-700";
 if(candidate)return "border-emerald-600 ring-2 ring-emerald-300 hover:border-emerald-700";
 if(selected)return "border-blue-700 ring-2 ring-blue-300 hover:border-blue-700";
 return "border-slate-200 hover:border-slate-300";
}
