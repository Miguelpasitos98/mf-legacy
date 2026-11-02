/**
 * The subdued emerald outline is shown ONLY inside the dedicated candidate
 * view, not the ordinary catalogue or league/team/position groupings.
 * Multi-selection always retains its own blue visual state.
 */
export function candidateOutlineClass(player,selected=false,candidateView=false){
 const candidate=candidateView===true&&player?.manager_fit_candidate===true;
 if(candidate&&selected)return "border-emerald-500/70 ring-2 ring-blue-300 hover:border-emerald-600";
 if(candidate)return "border-emerald-500/70 ring-1 ring-emerald-200 hover:border-emerald-600";
 if(selected)return "border-blue-700 ring-2 ring-blue-300 hover:border-blue-700";
 return "border-slate-200 hover:border-slate-300";
}
