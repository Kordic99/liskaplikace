import {useEffect,useState} from "react";
import AppLogo from "./AppLogo";
import {useCoverImage} from "./use-cover-image";

type CoverBook={cover:string;title:string;author:string;customCover?:string};

export default function BookCover({book,small=false,className=""}:{book:CoverBook;small?:boolean;className?:string}){
 const src=useCoverImage(book),[failed,setFailed]=useState(false);
 useEffect(()=>setFailed(false),[src]);
 const generated=!src||failed;
 return <div className={`cover ${small?"small":""} ${generated?"generated-cover":""} ${className}`}>
  {generated?<div className="cover-fallback fox-cover">
   <AppLogo/>
   <strong className="fox-cover-title">{book.title||"Tvůj další příběh"}</strong>
   <span className="fox-cover-author">{book.author||"Autor neuveden"}</span>
  </div>:<img src={src} alt={`Obálka: ${book.title}`} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>}
 </div>;
}
