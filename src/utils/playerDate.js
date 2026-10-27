// The entity contract stores DD/MM/YYYY. Never let Date parse it as MM/DD.
export function parseBirthDate(value){
  const text=String(value||"").trim();
  const local=text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso=text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if(!local&&!iso)return null;
  const [year,month,day]=local?[+local[3],+local[2],+local[1]]:[+iso[1],+iso[2],+iso[3]];
  const date=new Date(year,month-1,day);
  return date.getFullYear()===year&&date.getMonth()===month-1&&date.getDate()===day?date:null;
}
export function formatBirthDate(value){
  const date=parseBirthDate(value);
  return date?new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"2-digit",year:"numeric"}).format(date):value||"—";
}
export function birthAge(value,today=new Date()){
  const date=parseBirthDate(value);
  if(!date)return null;
  let age=today.getFullYear()-date.getFullYear();
  if(today.getMonth()<date.getMonth()||(today.getMonth()===date.getMonth()&&today.getDate()<date.getDate()))age--;
  return age>=0&&age<120?age:null;
}
