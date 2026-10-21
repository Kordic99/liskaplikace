import {createRoot} from "react-dom/client";
import Archive from "../app/Archive";
import {enableLocal,enableStaticRouting} from "../app/local";
declare const __BASE_PATH__:string;
declare const __BUILD_COMMIT__:string;
enableStaticRouting(__BASE_PATH__);enableLocal("test");
document.body.classList.add("test-environment");
const bookId=new URLSearchParams(location.search).get("book")??undefined;
createRoot(document.getElementById("root")!).render(<><div className="environment-banner" role="status"><strong>TEST</strong><span>Zkušební data pouze v tomto prohlížeči.</span><small>{__BUILD_COMMIT__.slice(0,7)}</small><a href="/liskaplikace/">Otevřít PROD ↗</a></div><Archive bookId={bookId}/></>);
