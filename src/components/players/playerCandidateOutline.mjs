/**
 * The subdued emerald outline identifies manually marked Manager Fit candidates
 * when multi-selection is active in ANY PLAYERS view (including the full list).
 * Multi-selection blue remains distinct from candidate-green.
 */
export function candidateOutlineClass(player,selected=false,selectionMode=false){
 const candidate=selectionMode===true&&player?.manager_fit_candidate===true;
 if(candidate&&selected)return "border-[#8FAF9C] ring-2 ring-blue-300 hover:border-[#789C87]";
 if(candidate)return "border-[#8FAF9C] ring-1 ring-[#DDEAE0] hover:border-[#789C87]";
 if(selected)return "border-blue-700 ring-2 ring-blue-300 hover:border-blue-700";
 return "border-slate-200 hover:border-slate-300";
}
