import {z} from "zod";
import seedJson from "../data/cnb-seed.json";
import {normalizeIsbn,type CatalogBook} from "./catalog";

const bounded=z.string().trim().max(300);
export const editionFieldsSchema=z.object({
 title:bounded.min(1,"Vyplň název knihy."),author:bounded,
 isbns:z.array(z.string().refine(value=>!!normalizeIsbn(value),"Zkontroluj ISBN; může také zůstat prázdné.")).max(10),
 year:z.number().int().min(1400).max(2200).nullable(),language:z.string().trim().max(20),publisher:bounded,
 edition:z.string().trim().max(200),pages:z.number().int().min(0).max(100000),series:z.string().trim().max(200),
 publicationStatus:z.enum(["published","announced","unknown"]),
}).strict();
export type EditionFields=z.infer<typeof editionFieldsSchema>;
const idSchema=z.string().regex(/^(?:cnb:cnb\d{6,12}|manual:[0-9a-f-]{36})$/);
const originSchema=z.object({kind:z.literal("cnb"),recordId:z.string(),license:z.literal("CC0-1.0"),url:z.string().startsWith("https://aleph.nkp.cz/"),updatedAt:z.string()}).strict();
export const seedSchema=z.object({format:z.literal("liskaplikace-cnb-seed-v1"),version:z.string(),importedAt:z.string(),source:z.object({name:z.string(),license:z.literal("CC0-1.0"),licenseUrl:z.string(),documentationUrl:z.string(),fromDate:z.string(),scope:z.string(),receipts:z.array(z.object({url:z.string(),sha256:z.string()}))}),editions:z.array(editionFieldsSchema.extend({id:idSchema,origin:originSchema}))});
export type SeedEdition=z.infer<typeof seedSchema>["editions"][number];
export type OwnEdition=EditionFields & {id:string;origin?:SeedEdition["origin"];revision:number;edited:boolean};
export const changeSchema=z.object({id:idSchema,revision:z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),fields:editionFieldsSchema.partial()}).strict();
export type CatalogChange=z.infer<typeof changeSchema>;
export const catalogBackupSchema=z.object({format:z.literal("liskaplikace-own-catalog-v1"),seedVersion:z.string(),changes:z.array(changeSchema).max(2000)}).strict();
let validatedSeed:ReturnType<typeof seedSchema.parse>|undefined;
export const catalogSeed=()=>validatedSeed??=seedSchema.parse(seedJson);
export const blankEdition=():EditionFields=>({title:"",author:"",isbns:[],year:null,language:"cs",publisher:"",edition:"",pages:0,series:"",publicationStatus:"unknown"});
export const editionFields=(edition:EditionFields):EditionFields=>editionFieldsSchema.parse(Object.fromEntries(Object.keys(blankEdition()).map(key=>[key,edition[key as keyof EditionFields]])));
export function applyChange(base:SeedEdition|undefined,change:CatalogChange|undefined):OwnEdition {
 const values={...base,...change?.fields};
 const fields=editionFieldsSchema.parse(Object.fromEntries(Object.keys(blankEdition()).map(key=>[key,values[key as keyof EditionFields]])));
 return {...fields,id:base?.id??change!.id,origin:base?.origin,revision:change?.revision??0,edited:!!change&&Object.keys(change.fields).length>0};
}
export function buildChange(id:string,fields:EditionFields,base:SeedEdition|undefined,revision:number):CatalogChange {
 idSchema.parse(id);const parsed=editionFields(fields),patch:Partial<EditionFields>={};
 for(const key of Object.keys(parsed) as (keyof EditionFields)[])if(!base||JSON.stringify(parsed[key])!==JSON.stringify(base[key]))Object.assign(patch,{[key]:parsed[key]});
 return changeSchema.parse({id,revision:revision+1,fields:patch});
}
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("cs").replace(/[^\p{L}\p{N}]+/gu," ").trim();
export function findOwnEditions(editions:OwnEdition[],query:string){
 const needle=normalize(query),tokens=needle.split(/\s+/).filter(Boolean),isbnQuery=query.replace(/^(?:ISBN(?:-1[03])?:?)\s*/i,"").replace(/[\s-]/g,"").toUpperCase();
 return editions.map(book=>{
  const title=normalize(book.title),author=normalize(book.author),all=normalize([book.title,book.author,book.series,book.publisher,book.year??"",...book.isbns].join(" "));
  const isbnMatch=/^[\dX]{3,13}$/.test(isbnQuery)&&book.isbns.some(id=>id.includes(isbnQuery)||normalizeIsbn(id)===normalizeIsbn(isbnQuery)&&!!normalizeIsbn(isbnQuery));
  const matches=!needle||tokens.every(token=>all.includes(token))||isbnMatch;
  return {book,matches,score:(isbnMatch?1000:0)+(title===needle?500:0)+(title.startsWith(needle)?100:0)+(author.includes(needle)?50:0)};
 }).filter(item=>item.matches).sort((a,b)=>b.score-a.score||(b.book.year??0)-(a.book.year??0)||a.book.title.localeCompare(b.book.title,"cs")||a.book.id.localeCompare(b.book.id)).map(item=>item.book);
}
export const asCatalogBook=(book:OwnEdition):CatalogBook=>({key:book.id,title:book.title,author:book.author,cover:"",pages:book.pages,isbn:book.isbns[0]??"",isbns:book.isbns,year:book.year,language:book.language,publisher:book.publisher,description:"",sources:[],editionId:book.id});
