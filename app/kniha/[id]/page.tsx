import { requireChatGPTUser } from "../../chatgpt-auth";
import Archive from "../../Archive";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;await requireChatGPTUser(`/kniha/${encodeURIComponent(id)}`);return <Archive bookId={id}/>}
