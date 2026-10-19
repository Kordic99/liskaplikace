"use client";
import { useMemo, useState } from "react";
import { ShoppingBag, Plus, Search, Check, X, BookOpen, ArrowUpRight, Flag, ChevronDown } from "lucide-react";
import { type Book, priorityLabel } from "./model";
import { appHref } from "./local";

function ShoppingCover({book}:{book:Book}){
 const [failed,setFailed]=useState(false);
 return <span className="shopping-cover">{book.cover&&!failed?<img src={book.cover} alt={`Obálka: ${book.title}`} onError={()=>setFailed(true)} referrerPolicy="no-referrer"/>:<BookOpen size={23}/>}</span>;
}
export default function ShoppingList({books,busy,onAdd,onToggle}:{books:Book[];busy:boolean;onAdd:()=>void;onToggle:(book:Book,wanted:boolean)=>Promise<boolean>}){
 const [query,setQuery]=useState(""),[selected,setSelected]=useState(""),[sort,setSort]=useState("priority");
 const candidates=books.filter(b=>!b.wantToBuy).sort((a,b)=>a.title.localeCompare(b.title,"cs"));
 const wanted=books.filter(b=>b.wantToBuy);
 const priority={high:0,normal:1,low:2};
 const visible=useMemo(()=>wanted.filter(b=>`${b.title} ${b.author}`.toLocaleLowerCase("cs").includes(query.toLocaleLowerCase("cs"))).sort((a,b)=>sort==="title"?a.title.localeCompare(b.title,"cs"):priority[a.priority]-priority[b.priority]||b.addedAt.localeCompare(a.addedAt)),[books,query,sort]);
 return <>
 <div className="page-intro"><div><div className="eyebrow">MÍSTO PRO DALŠÍ KNIŽNÍ POKLADY</div><h1>Nákupní list<span className="gold">.</span></h1><p>Knihy, které si chceš pořídit. Ať ti v knihkupectví žádná neunikne.</p></div><button className="button gold-button" onClick={onAdd}><Plus size={16}/> Přidat knihu na list</button></div>
 <div className="shopping-summary"><span className="shopping-summary-icon"><ShoppingBag size={23}/></span><div><strong>{wanted.length.toString().padStart(2,"0")}</strong><span>{wanted.length===1?"kniha čeká na místo ve tvé knihovničce":wanted.length>=2&&wanted.length<=4?"knihy čekají na místo ve tvé knihovničce":"knih čeká na místo ve tvé knihovničce"}</span></div><span className="shopping-summary-note">Malé radosti na příště.</span></div>
 {!!candidates.length&&<form className="shopping-add-existing" onSubmit={async e=>{e.preventDefault();const book=candidates.find(b=>b.id===selected);if(book&&await onToggle(book,true))setSelected("")}}><label><span>Vybrat z mojí knihovny</span><span className="shopping-select-wrap"><select aria-label="Kniha z knihovny pro nákupní list" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Vyber knihu, kterou si chceš pořídit…</option>{candidates.map(b=><option value={b.id} key={b.id}>{b.title}{b.author?` · ${b.author}`:""}</option>)}</select><ChevronDown size={15}/></span></label><button className="button subtle" disabled={!selected||busy}><Plus size={15}/> Přidat na list</button></form>}
 {!!wanted.length&&<div className="library-toolbar"><label className="search-box"><Search size={17}/><input aria-label="Prohledat nákupní list" placeholder="Hledat název nebo autora…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button className="icon-button" aria-label="Vymazat hledání" onClick={()=>setQuery("")}><X size={14}/></button>}</label><label className="sort-select"><select aria-label="Řazení nákupního listu" value={sort} onChange={e=>setSort(e.target.value)}><option value="priority">Podle priority</option><option value="title">Podle názvu</option></select><ChevronDown size={14}/></label></div>}
 {visible.length?<div className="shopping-list">{visible.map(b=><article className="shopping-item" key={b.id}><a className="shopping-book-link" href={appHref(`/kniha/${b.id}`)}><ShoppingCover book={b}/><div><h2>{b.title}</h2><p>{b.author||"Autor neuveden"}</p><span className={`priority ${b.priority}`}><Flag size={11}/>{priorityLabel[b.priority]}</span></div><ArrowUpRight size={15}/></a><div className="shopping-item-actions"><button className="button subtle" disabled={busy} onClick={()=>onToggle(b,false)} aria-label={`Označit ${b.title} jako koupenou`}><Check size={15}/> Mám koupeno</button><button className="icon-button" disabled={busy} onClick={()=>onToggle(b,false)} aria-label={`Odebrat ${b.title} z nákupního listu`} title="Odebrat z nákupního listu"><X size={17}/></button></div></article>)}</div>:<div className="large-empty shopping-empty"><ShoppingBag/><h2>{query?"Tuhle knihu na listu nevidím.":"Další poklad si najde své místo."}</h2><p>{query?"Zkus jiný název nebo autora.":"Přidej novou knihu nebo vyber některou ze své knihovny."}</p>{!query&&<button className="button gold-button" onClick={onAdd}><Plus size={16}/> Přidat první přání</button>}</div>}
 <div className="shopping-footnote"><Check size={15}/><p>Po odškrtnutí kniha zmizí z nákupního listu. V knihovně i v TBR zůstane na své poličce.</p></div>
 </>;
}
