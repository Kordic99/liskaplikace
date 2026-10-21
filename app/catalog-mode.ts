import type {ComponentType,ReactNode} from "react";
import type {CatalogBook,CatalogResponse} from "./catalog";

export type BookCatalogProps={onPick:(book:CatalogBook,warning?:string)=>void;onManual:()=>void;renderCover:(book:CatalogBook)=>ReactNode};
let localCatalog:ComponentType<BookCatalogProps>|undefined;
let localSearch:((query:string)=>Promise<CatalogResponse>)|undefined;
// Registered exclusively by tools/test-entry.tsx; PROD retains its own search.
export const configureBookCatalog=(component:ComponentType<BookCatalogProps>,search:(query:string)=>Promise<CatalogResponse>)=>{localCatalog=component;localSearch=search};
export const ownCatalogComponent=()=>localCatalog;
export const ownCatalogSearch=(query:string)=>{if(!localSearch)throw new Error("Vlastní katalog TESTu není připravený.");return localSearch(query)};
