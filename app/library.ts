import type { Book } from "./model";

export const shelfStatus = {library:"read",reading:"reading",tbr:"tbr"} as const;
export type Shelf = keyof typeof shelfStatus;
export const shelfFor = (status:Book["status"]):Shelf => status === "read" ? "library" : status;
export function statusCounts(books:Book[]) {
 const counts={read:0,reading:0,tbr:0};
 for(const book of books)counts[book.status]++;
 return counts;
}
// Keep the calendar date that was entered, including dates in old ISO backups.
export function completionDate(value:string) {
 const date=value.slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return "";
 const parsed=new Date(date+"T12:00:00Z");
 return !Number.isNaN(parsed.valueOf())&&parsed.toISOString().slice(0,10)===date?date:"";
}
export function matchesCompletion(book:Book,year="all",month="all") {
 const date=completionDate(book.finishedAt);
 if(year==="missing")return !date;
 if((year!=="all"||month!=="all")&&!date)return false;
 return (year==="all"||date.slice(0,4)===year)&&(month==="all"||date.slice(5,7)===month);
}
export function todayLocalDate() {
 const date=new Date();
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
