import assets from "./assets.json";

/* Every picture of the prototype is packed into the file. Code and pages ask for "/demo/lamma/hoodie.jpg"; here such an address is
   turned into the packed picture: when a picture's address is set (src, setAttribute), and in inline styles (masks, backgrounds). */
const A = assets as Record<string, string>;

export function packed(u: string | null | undefined): string | null {
  if (!u || !u.startsWith("/") || u.startsWith("//")) return null;
  const clean = decodeURI(u.split("?")[0].split("#")[0]);
  return A[clean] ?? null;
}

const fixStyle = (s: string) => s.replace(/url\((["']?)(\/[^)"']+)\1\)/g, (m, q, p) => {
  const d = packed(p);
  return d ? `url("${d}")` : m;
});

// src = "..." on pictures, videos and sources
for (const proto of [HTMLImageElement.prototype, HTMLMediaElement.prototype, HTMLSourceElement.prototype]) {
  const desc = Object.getOwnPropertyDescriptor(proto, "src");
  if (!desc?.set || !desc.get) continue;
  Object.defineProperty(proto, "src", {
    configurable: true,
    enumerable: desc.enumerable,
    get() {
      return desc.get!.call(this);
    },
    set(v: string) {
      desc.set!.call(this, packed(v) ?? v);
    },
  });
}

// setAttribute("src" | "poster" | "href" | "style", ...)
const setAttr = Element.prototype.setAttribute;
Element.prototype.setAttribute = function (name: string, value: string) {
  const n = name.toLowerCase();
  if ((n === "src" || n === "poster" || (n === "href" && this instanceof SVGElement)) && typeof value === "string") return setAttr.call(this, name, packed(value) ?? value);
  if (n === "style" && typeof value === "string" && value.includes("url(")) return setAttr.call(this, name, fixStyle(value));
  return setAttr.call(this, name, value);
};

// inline styles set through element.style (masks and backgrounds): fixed when they change
const fixEl = (el: Element) => {
  const st = el.getAttribute("style");
  if (st && st.includes("url(/")) {
    const next = fixStyle(st);
    if (next !== st) setAttr.call(el, "style", next);
  }
};
export function watchStyles() {
  const all = (root: ParentNode) => root.querySelectorAll?.("[style]").forEach(fixEl);
  all(document);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "attributes" && m.target instanceof Element) fixEl(m.target);
      else m.addedNodes.forEach((n) => {
        if (n instanceof Element) {
          fixEl(n);
          all(n);
        }
      });
    }
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
}

/* fetch("/demo/...") (turning a picture into a saved logo) reads the packed picture */
const realFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const u = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
  const d = typeof input === "string" ? packed(u) : null;
  return realFetch(d ?? input, init);
};
