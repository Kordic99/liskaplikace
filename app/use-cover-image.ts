import {useEffect,useState} from "react";
import {api} from "./client-api";
export function useCoverImage(book:{cover:string;customCover?:string}){
 const [loaded,setLoaded]=useState<{path:string;url:string}|null>(null);
 const path=book.customCover??"";
 useEffect(()=>{if(!path)return;let stopped=false,objectUrl="";
  void api("/api/covers?path="+encodeURIComponent(path)).then((blob:Blob)=>{if(stopped)return;objectUrl=URL.createObjectURL(blob);setLoaded({path,url:objectUrl})}).catch(()=>{if(!stopped)setLoaded(null)});
  return()=>{stopped=true;if(objectUrl)URL.revokeObjectURL(objectUrl)};
 },[path]);
 return path&&loaded?.path===path?loaded.url:book.cover;
}
