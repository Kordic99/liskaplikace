import { isLocal, localApi } from "./local";
export type LibraryTransport=(path:string,method:string,body?:unknown)=>Promise<any>;
let transport:LibraryTransport|undefined;
export const configureLibraryTransport=(value:LibraryTransport|undefined)=>{transport=value};
export class LibraryApiError extends Error {
 constructor(message:string,public status:number){super(message);this.name="LibraryApiError"}
}
export async function api(path:string,method="GET",body?:unknown):Promise<any>{
 if(transport)return transport(path,method,body);
 if(isLocal())return localApi(path,method,body);
 let response:Response;
 try{response=await fetch(path,{method,cache:"no-store",credentials:"same-origin",headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined})}
 catch{throw new LibraryApiError("Chybí spojení. Zkontroluj internet a zkus uložit znovu; rozepsaný text tu zůstává.",0)}
 let data:any;
 try{data=await response.json()}catch{throw new LibraryApiError("Spojení se přerušilo. Zkus to prosím znovu.",response.status)}
 if(!response.ok)throw new LibraryApiError(data.error||"Změnu se nepodařilo uložit.",response.status);
 return data;
}
