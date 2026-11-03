/**
 * The Manager entity stores a birth date as ISO YYYY-MM-DD.
 * Accept a Spanish pasted date (DD/MM/YYYY), existing ISO values,
 * and clearly separated DD-MM-YYYY or DD.MM.YYYY strings.
 */
export function normalizeManagerBirthDate(value){
 const raw=String(value??"").trim();
 if(!raw)return "";
 let year,month,day;
 const iso=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
 const spanish=raw.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/)||
   raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
 if(iso){year=Number(iso[1]);month=Number(iso[2]);day=Number(iso[3]);}
 else if(spanish){day=Number(spanish[1]);month=Number(spanish[2]);year=Number(spanish[3]);}
 else throw Error("Fecha de nacimiento no válida. Pega DD/MM/AAAA (por ejemplo, 02/02/1970).");
 if(year<1850||year>new Date().getUTCFullYear()||month<1||month>12||day<1||day>31)
  throw Error("La fecha de nacimiento no es válida. Comprueba el día, mes y año.");
 const date=new Date(Date.UTC(year,month-1,day));
 if(date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day)
  throw Error("La fecha de nacimiento no existe en el calendario.");
 if(date.getTime()>Date.now())throw Error("La fecha de nacimiento no puede ser futura.");
 return [String(year).padStart(4,"0"),String(month).padStart(2,"0"),String(day).padStart(2,"0")].join("-");
}
export function displayManagerBirthDate(value){
 const raw=String(value??"").trim();
 const iso=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
 return iso?iso[3]+"/"+iso[2]+"/"+iso[1]:raw;
}
