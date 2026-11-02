/**
 * The subdued emerald outline is shown ONLY inside the dedicated candidate
 * view, not the ordinary catalogue or league/team/position groupings.
 * Multi-selection always retains its own blue visual state.
 */
export function candidateOutlineClass(player,selected=false,candidateView=false){
 const candidate=candidateView===true&&player?.manager_fit_candidate===true;
 if(candidate&&selected)return "border-[#8FAF9C] ring-2 ring-blue-300 hover:border-[#789C87]";
 if(candidate)return "border-[#8FAF9C] ring-1 ring-[#DDEAE0] hover:border-[#789C87]";
 if(selected)return "border-blue-700 ring-2 ring-blue-300 hover:border-blue-700";
 return "border-slate-200 hover:border-slate-300";
}
