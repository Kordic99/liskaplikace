import {getChatGPTUser} from "../../chatgpt-auth";
import {searchCatalog} from "../../catalog";
export async function GET(request:Request){
 if(!await getChatGPTUser())return Response.json({error:"Nejsi přihlášen/a."},{status:401});
 const query=new URL(request.url).searchParams.get("q")?.trim()??"";
 if(query.length<2||query.length>200)return Response.json({error:"Zadej 2–200 znaků."},{status:400});
 try{return Response.json(await searchCatalog(query,{googleBooksKey:process.env.VITE_GOOGLE_BOOKS_API_KEY??"",allLanguages:new URL(request.url).searchParams.get("languages")==="all"}))}
 catch(error){return Response.json({error:(error as Error).message},{status:502})}
}
