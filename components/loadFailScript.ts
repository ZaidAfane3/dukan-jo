/* When a file of the site fails to arrive while a page is opened in full (typed in the address bar, refreshed, opened in
   a new tab), not by a click inside the site. A click inside the site is handled by the pages' error pages
   (components/LoadError.tsx): they only exist once the page's code is running, and here the missing file may be that
   very code, so the page would stay on its loading shapes for ever. This small script is written into every page's
   <head> (app/layout.tsx) and runs before any other: it watches for the site's own files (/_next/static: the code and the
   styles) failing to load and does what LoadError does, with the same memory in this tab so the two never loop each
   other: one reload by itself, and if the same page fails again within a minute, a plain Dukkan error page in the
   visitor's language and look with Reload and Back. That page is laid over the stuck one (and put back if React, coming
   up late, clears the page), not written in its place.

   Which failures are its own: any while the page is still loading (until the browser's load event), as those are the
   files written into the page itself, which nothing asks for again; the frame of the page (the Diwan menu, the
   dashboard's bar) may well be up by then while the page inside waits for ever. After the load, a failure is a click
   inside the site, left to the error pages (the Diwan one keeps its menu), unless the page's code never got going
   (UP, set by PrefsProvider, still unset 2 seconds later).

   Next writes the page's own files at the top of <head>, before this script, so one of them can fail before it is
   listening. Those are looked at once the page has loaded: a file that failed has an error status in the browser's
   list of what it fetched (Resource Timing), or no entry at all (a dropped connection; also a file the browser took
   from its memory), in which case it is asked for once more from the cache and only a failure of that counts. */

import { AGAIN_AFTER, RELOADED, UP } from "./loadFailKeys";

const words = {
  en: { title: "This page couldn't load", body: "Something went wrong while opening it. Reload to try again, or go back.", reload: "Reload", back: "Back", brand: "Dukkan" },
  ar: { title: "تعذّر تحميل هذه الصفحة", body: "حدث خطأ أثناء فتحها. أعد التحميل للمحاولة مرة أخرى، أو ارجع.", reload: "إعادة التحميل", back: "رجوع", brand: "دكان" },
};

/* the page's colours (app/globals.css), written out: the site's styles may be the file that failed */
const looks = {
  light: { page: "#f8f5ef", fg: "#141414", muted: "#606064", primary: "#b85c17", onPrimary: "#fff", line: "rgba(20,20,20,.15)" },
  dark: { page: "#1b120c", fg: "#f7ede3", muted: "#c0ac99", primary: "#f0964f", onPrimary: "#1b120c", line: "rgba(247,237,227,.15)" },
};

export const loadFailScript = `(function(){
var W=${JSON.stringify(words)},L=${JSON.stringify(looks)},KEY=${JSON.stringify(RELOADED)},AGAIN=${AGAIN_AFTER},UP=${JSON.stringify(UP)};
var BAD=/ChunkLoadError|Loading (CSS )?chunk|Failed to load chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;
var done=false,waiting=false;
function up(){return !!window[UP]}
function mine(u){try{return new URL(u,location.href).origin===location.origin&&/\\/_next\\/static\\//.test(new URL(u,location.href).pathname)}catch(e){return false}}
function prefs(){var l="ar",d=false;try{var s=localStorage.getItem("seen-lang");var c=document.cookie.match(/(?:^|; )seen-lang=(en|ar)/);l=s==="en"||s==="ar"?s:c?c[1]:document.documentElement.lang==="en"?"en":"ar";d=localStorage.getItem("seen-theme")==="dark"}catch(e){}return{lang:l,dark:d}}
function reloadOnce(){try{var here=location.pathname+location.search,last=JSON.parse(sessionStorage.getItem(KEY)||"null");if(last&&last.url===here&&Date.now()-(last.at||0)<AGAIN)return false;sessionStorage.setItem(KEY,JSON.stringify({url:here,at:Date.now()}))}catch(e){return false}location.reload();return true}
function el(t,css,txt){var e=document.createElement(t);e.setAttribute("style",css);if(txt)e.textContent=txt;return e}
function errorPage(){
if(!document.body){document.addEventListener("DOMContentLoaded",errorPage);return}
var p=prefs(),w=W[p.lang],c=p.dark?L.dark:L.light,h=document.documentElement;
h.lang=p.lang;h.dir=p.lang==="ar"?"rtl":"ltr";h.setAttribute("data-theme",p.dark?"dark":"light");delete h.dataset.boot;
document.title=w.title+" · "+w.brand;
var font="system-ui,-apple-system,'Segoe UI',Tahoma,Arial,sans-serif";
var st=document.createElement("style");
st.textContent="html,body{background:"+c.page+"!important}body{visibility:visible!important}body>:not(#dk-load-failed){display:none!important}";
var box=el("div","position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:64px 20px;box-sizing:border-box;overflow:auto;background:"+c.page+";color:"+c.fg+";font-family:"+font+";text-align:center");
box.id="dk-load-failed";box.setAttribute("role","alert");box.dir=h.dir;box.lang=p.lang;
var inner=el("div","width:100%;max-width:28rem");
inner.innerHTML='<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="'+c.primary+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;margin:0 auto"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>';
inner.appendChild(el("h1","margin:20px 0 0;font-size:28px;line-height:1.25;font-weight:800",w.title));
inner.appendChild(el("p","margin:12px auto 0;max-width:24rem;line-height:1.6;color:"+c.muted,w.body));
var row=el("div","margin-top:32px;display:flex;flex-wrap:wrap;gap:12px;justify-content:center");
var btn="min-height:44px;padding:0 24px;border-radius:9999px;font:700 14px "+font+";cursor:pointer;";
var r=el("button",btn+"border:0;background:"+c.primary+";color:"+c.onPrimary,w.reload);r.type="button";r.onclick=function(){location.reload()};
var k=el("button",btn+"background:transparent;color:"+c.fg+";border:1px solid "+c.line,w.back);k.type="button";k.onclick=function(){if(history.length>1)history.back();else location.href=/^\\/diwan(\\/|$)/.test(location.pathname)?"/diwan":"/"};
row.appendChild(r);row.appendChild(k);inner.appendChild(row);box.appendChild(inner);
function keep(){if(!st.isConnected)(document.head||h).appendChild(st);if(document.body&&box.parentNode!==document.body)document.body.appendChild(box)}
keep();
try{new MutationObserver(keep).observe(h,{childList:true,subtree:true})}catch(e){}
}
function act(){if(done)return;done=true;if(!reloadOnce())errorPage()}
function failed(){
if(done)return;
if(document.readyState!=="complete"){act();return}
if(up()||waiting)return;
waiting=true;
setTimeout(function(){waiting=false;if(!up())act()},2000);
}
function sheet(x){return x.tagName==="LINK"&&/(^|\\s)stylesheet(\\s|$)/i.test(x.rel)&&mine(x.href)}
function code(x){return x.tagName==="SCRIPT"&&!!x.src&&mine(x.src)}
addEventListener("error",function(e){var x=e.target;if(!x||!x.tagName)return;if(code(x)||sheet(x)){x.__dkSeen=1;failed()}},true);
addEventListener("load",function(e){var x=e.target;if(x&&x.tagName&&(code(x)||sheet(x)))x.__dkSeen=1},true);
addEventListener("unhandledrejection",function(e){var r=e.reason;if(r&&(r.name==="ChunkLoadError"||BAD.test(String(r.name)+": "+String(r.message))))failed()});
var early=[].slice.call(document.querySelectorAll("script[src],link[rel~=stylesheet]")).filter(function(x){return code(x)||sheet(x)});
addEventListener("load",function(){
if(done)return;
for(var i=0;i<early.length;i++){var x=early[i];if(x.__dkSeen)continue;
var u=x.src||x.href,t=performance.getEntriesByName?performance.getEntriesByName(u):[],last=t[t.length-1];
if(last&&last.responseStatus>=400){act();return}
if(!last)fetch(u,{cache:"force-cache"}).then(function(r){if(!r.ok)act()},act)}
});
})();`;
