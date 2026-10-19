"use client";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { api } from "./client-api";
import { type Book } from "./model";
export function useLibrarySync(paused:boolean,setBooks:Dispatch<SetStateAction<Book[]>>){
 const [state,setState]=useState<"checking"|"online"|"offline">("checking");
 const [refreshNumber,setRefreshNumber]=useState(0);
 useEffect(()=>{
  if(paused)return;
  let stopped=false,running=false;
  const refresh=async()=>{
   if(document.visibilityState!=="visible"||running||stopped)return;
   running=true;
   try{
    const rows:Book[]=await api("/api/books");
    if(!Array.isArray(rows))throw new Error("Invalid library");
    if(!stopped){setBooks(previous=>{
     const revisions=new Map(previous.map(b=>[b.id,b.revision]));
     return previous.length===rows.length&&rows.every(b=>revisions.get(b.id)===b.revision)?previous:rows;
    });setState("online")}
   }catch{if(!stopped)setState("offline")}
   finally{running=false}
  };
  const resume=()=>{void refresh()};
  window.addEventListener("focus",resume);
  window.addEventListener("online",resume);
  window.addEventListener("pageshow",resume);
  window.addEventListener("storage",resume);
  window.addEventListener("archive:changed",resume);
  document.addEventListener("visibilitychange",resume);
  const timer=setInterval(resume,15000);
  resume();
  return()=>{stopped=true;clearInterval(timer);window.removeEventListener("focus",resume);window.removeEventListener("online",resume);window.removeEventListener("pageshow",resume);window.removeEventListener("storage",resume);window.removeEventListener("archive:changed",resume);document.removeEventListener("visibilitychange",resume)};
 },[paused,refreshNumber,setBooks]);
 return {state,refresh:()=>setRefreshNumber(n=>n+1)};
}
