import { requireChatGPTUser } from "./chatgpt-auth";
import Archive from "./Archive";
export const dynamic="force-dynamic";
export default async function Page(){await requireChatGPTUser("/");return <Archive/>}
