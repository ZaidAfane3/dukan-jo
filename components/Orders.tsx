"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { brandName, dateLocale } from "./content";
import { DashboardBar } from "./DashboardBar";
import { STATUS_DOT, STATUS_KEYS, ordersCopy, type StatusKey } from "./ordersContent";
import { usePrefs } from "./Prefs";
import { latin } from "./digits";
import { isJordanMobile, jordanMobile, jordanNumber, phoneError, savedMobile, typedAnyPhone } from "./phone";
import { ORDER_MAX, cleanOrder, money, parseList, typedMoney, type Order } from "./records";
import { cleanLine, visibleLength } from "./safe";
import { KNOWN_CITIES, ORDER_LIMITS, deliveryCities, inLang, isCity, type Fulfil } from "./safeOrder";
import { shipCityLists, usePublicSettings } from "./platformPublic";
import { loadSetup } from "./setup";
import { loadFreeDelivery } from "./freeDeliveryStore";
import { hasErrors, RequiredMark, RequiredNote, requiredNote } from "./Required";
import { DELETE_REASON, cleanDeleteReason, deleteReasonOk, logDeletion, unlogDeletion } from "./orderDeletions";
import { serverMode } from "./notifications";
import { onlineRev, pullOnlineKeys } from "./serverSync";
import { dropUndos, listUndo, offerUndo } from "./undo";
import { serverRows, type StoreOrderRow } from "./useStoreOrders";
import type { Lang } from "./content";
import { usePageTitle } from "./pageTitle";
import { Skeleton } from "./Skeleton";
import { noPhotoHue, ProductPhoto } from "./storefront/NoPhoto";


/* Kept in this browser so orders are still there when he comes back. */
const KEY = "seen-orders";
const card = "rounded-2xl bg-card shadow-sm ring-1 ring-fg/10";
const field =
  "w-full rounded-xl border border-fg/15 bg-card px-4 text-sm outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/25";
/* a field with a mistake in it */
const bad = "!border-rose-500 focus:!ring-rose-500/25";
/* the undo note at the bottom (UndoToast.tsx); {status} is the status's name as the page shows it */
const undoWords: Record<Lang, { added: (n: number) => string; deleted: (n: number) => string; status: (n: number, st: string) => string }> = {
  en: {
    added: (n) => `Order #${n} added`,
    deleted: (n) => `Order #${n} deleted`,
    status: (n, st) => `Order #${n} marked “${st}”`,
  },
  ar: {
    added: (n) => `أُضيف الطلب #${n}`,
    deleted: (n) => `حُذف الطلب #${n}`,
    status: (n, st) => `صارت حالة الطلب #${n}: «${st}»`,
  },
};
/* Changing to these statuses is asked first */
const ASK_FIRST: StatusKey[] = ["cancelled", "refunded"];

/* An order on the list: one kept in this browser (added by hand, or from his own store preview), or one a customer
   placed on his public store, kept on the server (serverId: its id there; payment "test": no payment is taken yet).
   Both look the same; a store order says how it is paid (payLine below) and the server's status changes go there.
   The server's answer is checked like the orders read from storage (serverRows, shared with the home page and Reports). */
type Row = StoreOrderRow;
const keyOf = (x: Row) => (x.serverId ? `s:${x.serverId}` : `l:${x.id}`);

type Copy = (typeof ordersCopy)[Lang];
/* a store order (from his public store or his own preview of it) is paid the way the customer chose at checkout */
const fromStore = (x: Row) => !!x.pay && (x.channel === 1 || x.payment === "test");

/** How a store order is paid, worked out from its way to pay and its status (nothing is kept for it in the browser):
    cash is "Cash on delivery" (or on pickup) until it is delivered, then "Paid (cash)", the same rule the home page and
    Reports count a sale by (storeNumbers.ts saleState); card and CliQ take no money yet, so they say nothing was charged.
    Null for an order he added himself. */
function payLine(x: Row, o: Copy): { text: string; hint?: string; tone: "paid" | "due" | "test" | "off" } | null {
  if (!fromStore(x)) return null;
  if (x.pay === "card" || x.pay === "cliq") return { text: x.pay === "card" ? o.testCard : o.testCliq, hint: o.testOrderHint, tone: "test" };
  if (x.status === "delivered") return { text: o.paidCash, tone: "paid" };
  if (x.status === "cancelled") return { text: o.cancelledPay, tone: "off" };
  if (x.status === "refunded") return { text: o.refundedPay, tone: "off" };
  const pickup = x.fulfil === "pickup";
  return { text: pickup ? o.cashPickup : o.payNames.cash, hint: pickup ? o.cashPickupHint : o.cashHint, tone: "due" };
}

/** A status as the page names it for this order: a new cash order says how it is paid ("Cash on delivery"), not just "New" */
const statusName = (x: Pick<Row, "status" | "pay" | "channel" | "payment" | "fulfil">, k: StatusKey, o: Copy) =>
  k === "pending" && x.pay === "cash" && (x.channel === 1 || x.payment === "test") ? (x.fulfil === "pickup" ? o.cashPickup : o.payNames.cash) : o.statuses[k];

/* the customer's phone as links: a call (any Jordan number, or an international one) and WhatsApp (a mobile, as
   international digits: 9627XXXXXXXX). Null when it is not a number that can be dialled. */
function dialOf(phone: string): { tel: string; wa: string } | null {
  const mobile = jordanMobile(phone);
  if (mobile) return { tel: `+962${mobile}`, wa: `962${mobile}` };
  const jo = jordanNumber(phone);
  if (jo) return { tel: `+962${jo}`, wa: "" };
  const d = latin(phone).replace(/[^\d+]/g, "");
  const intl = d.startsWith("+") ? d.slice(1) : d.startsWith("00") ? d.slice(2) : "";
  if (/^[1-9]\d{7,14}$/.test(intl)) return { tel: `+${intl}`, wa: intl };
  return /^\d{6,15}$/.test(d) ? { tel: d, wa: "" } : null;
}
const EMAIL_LINK = /^[^\s@?&#<>"]+@[^\s@?&#<>"]+\.[^\s@?&#<>"]+$/;
const contactBtn =
  "inline-flex items-center rounded-lg border border-fg/20 px-3 py-1 text-xs font-semibold text-fg transition hover:bg-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

/* The server's rows added to those already loaded: a row loaded again replaces its older copy, and none is ever dropped
   (the newest page moves on as new orders come in, and the older pages loaded stay) */
const upsert = (list: Row[], rows: Row[]): Row[] => {
  const fresh = new Map(rows.map((r) => [r.serverId, r]));
  return [...list.map((x) => fresh.get(x.serverId) ?? x), ...rows.filter((r) => !list.some((x) => x.serverId === r.serverId))];
};

/* What is saved is checked again when it is read: storage can hold old, broken or hand-changed orders */
function loadOrders(): Order[] {
  try {
    return parseList(localStorage.getItem(KEY), cleanOrder);
  } catch {
    return [];
  }
}

export function Orders() {
  const { lang } = usePrefs();
  const o = ordersCopy[lang];
  const locale = dateLocale(lang);

  const [orders, setOrders] = useState<Order[]>([]);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<StatusKey | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  /* the orders customers placed on his public store (never in the tour), and whether a status change of one failed */
  const [serverOrders, setServerOrders] = useState<Row[]>([]);
  /* the first list from the server: on its way, in (even an empty one), or it did not come (shown with "Try again").
     Once a list is in, a later check that fails keeps it ("ready"). */
  const [serverState, setServerState] = useState<"loading" | "ready" | "failed">("loading");
  const serverReady = serverState !== "loading";
  /* "Try again" after the first list did not come: set by the effect that loads the store orders */
  const retryServer = useRef<() => void>(() => {});
  /* the "Load more" request on its way (one at a time, aborted when the page closes or the list starts again) */
  const moreReq = useRef<AbortController | null>(null);
  /* a page at a time: how many store orders there are, where the next older page starts (null: none), and the
     "Load more" button's state */
  const [serverTotal, setServerTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [statusErr, setStatusErr] = useState(false);
  const all = useMemo<Row[]>(() => [...orders, ...serverOrders], [orders, serverOrders]);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /* why the order is deleted: required, and sent to Dukkan with the deletion */
  const [reason, setReason] = useState("");
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  /* one deletion per dialog, even on a double click */
  const deleting = useRef(false);
  const [askStatus, setAskStatus] = useState<StatusKey | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [total, setTotal] = useState("");
  const [status, setStatus] = useState<StatusKey>("pending");
  const [source, setSource] = useState(0);
  const [fulfil, setFulfil] = useState<Fulfil>("delivery");
  const [city, setCity] = useState("");
  /* the cities this store delivers to, the same list its checkout and the server take (safeOrder deliveryCities):
     Dukkan Ship's from Diwan, or the ones he chose for his own courier. No delivery choice yet: every city (he types
     his own order, so nothing stops him). Read when the form opens */
  const platform = usePublicSettings();
  const cityList = useMemo(() => {
    const ship = creating ? loadSetup()?.shipping : null;
    return ship ? deliveryCities(ship.mode, shipCityLists(platform), ship.cities) : KNOWN_CITIES;
  }, [creating, platform]);
  const [address, setAddress] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string; city?: string; address?: string; total?: string }>({});
  const nameRef = useRef<HTMLInputElement>(null);

  usePageTitle(`${brandName(lang)} | ${o.title}`);

  /* the orders kept in this browser as they are now, for an undo (it checks nothing changed since) */
  const ordersNow = useRef<Order[]>([]);
  useEffect(() => {
    ordersNow.current = orders;
  }, [orders]);
  /* the store orders as they are now: an undo of a status sends the old one back only while the order still has the new one */
  const serverNow = useRef<Row[]>([]);
  useEffect(() => {
    serverNow.current = serverOrders;
  }, [serverOrders]);
  /* only this page can put its orders back: its undos go when it closes */
  useEffect(() => () => dropUndos("orders"), []);
  /** A change to the orders kept in this browser, saved like any edit (below), with an Undo at the bottom that puts back
      exactly the orders it changed, unless one of them changed again since */
  /* `afterUndo`: runs after an undo was tried, whether or not it put the orders back (a deletion takes its record back) */
  const change = (next: Order[], label: (l: Lang) => string, afterUndo?: () => void) => {
    const before = ordersNow.current;
    ordersNow.current = next;
    setOrders(next);
    const back = listUndo({
      before,
      after: next,
      key: (x: Order) => x.id,
      now: () => ordersNow.current,
      put: (list: Order[]) => {
        ordersNow.current = list;
        setOrders(list);
      },
    });
    offerUndo({
      scope: "orders",
      label,
      undo: () => {
        const ok = back();
        afterUndo?.();
        return ok;
      },
    });
  };

  /* the list as read from storage: not saved back (only a change he makes is), so opening the page on a device with an
     older copy never sends that copy over a newer one */
  const loadedList = useRef<Order[] | null>(null);
  useEffect(() => {
    const read = () => {
      const list = loadOrders();
      loadedList.current = list;
      setOrders(list);
    };
    read();
    setReady(true);
    /* A new order from the store, or a change in another tab: take that list, so this tab never writes back an old one */
    const onStorage = (e: StorageEvent) => e.key === KEY && read();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* The orders from his public store: fetched when the page opens, every minute while it is in view and when he comes
     back to it. Signed in only, never in the tour (serverMode). */
  useEffect(() => {
    if (!serverMode()) {
      setServerState("ready");
      return;
    }
    let stop = false;
    /* the store orders this page already holds: a check finds where the new ones meet them. "loaded" is set once the
       first list came in, even an empty one: from then on every check goes back as far as it must */
    const known = new Set<string>();
    let loaded = false;
    /* the check on its way, with its own AbortController: one at a time (the minute timer and coming back to the tab
       never pile requests up behind a slow server), aborted when the page closes or "Try again" starts a new one. An
       answer that is no longer the current check's is dropped, and only the current check ends the loading. */
    let live: AbortController | null = null;
    const load = async (fresh = false) => {
      if (live && !fresh) return;
      live?.abort();
      const req = new AbortController();
      live = req;
      const current = () => !stop && live === req;
      let ok = false;
      try {
        let url = "/api/orders";
        let j: { orders?: unknown; rev?: unknown; next?: unknown; total?: unknown } = {};
        /* the newest page, then older pages until they reach the orders already here, so no order between them is
           missed even when more than a page arrived while the tab was hidden. After 20 pages (2,000 new orders) the
           list starts again from what was just read, and "Load more" goes on from there, so it never has a hole */
        const fetched: Row[] = [];
        for (let page = 0; ; page++) {
          const r = await fetch(url, { credentials: "same-origin", cache: "no-store", signal: req.signal });
          if (!r.ok || !current()) return;
          const got = (await r.json()) as typeof j;
          if (!current()) return;
          if (page === 0) j = got;
          const rows = serverRows(got.orders);
          const first = !loaded;
          const meets = rows.some((x) => !!x.serverId && known.has(x.serverId));
          rows.forEach((x) => x.serverId && known.add(x.serverId));
          fetched.push(...rows);
          if (!first && !meets && typeof got.next === "string" && page === 19) {
            known.clear();
            fetched.forEach((x) => x.serverId && known.add(x.serverId));
            /* a "Load more" on its way belongs to the list being replaced: it is stopped, its button ends loading */
            moreReq.current?.abort();
            moreReq.current = null;
            setMoreLoading(false);
            setServerOrders(fetched.slice());
            setCursor(got.next);
            break;
          }
          setServerOrders((list) => upsert(list, rows));
          /* where the older pages start: taken from the first answer only (the pages loaded after go on from their own) */
          if (first) setCursor((c) => (c === undefined ? (typeof got.next === "string" ? got.next : null) : c));
          loaded = true;
          if (first || meets || typeof got.next !== "string") break;
          url = `/api/orders?before=${encodeURIComponent(got.next)}`;
        }
        ok = true;
        if (typeof j.total === "number") setServerTotal(j.total);
        /* those orders took stock on the server: this browser's copy of the products is brought up to date */
        const mine = onlineRev();
        if (typeof j.rev === "number" && (mine === null || j.rev > mine)) void pullOnlineKeys();
      } catch {
        /* offline or aborted: the list keeps what it has */
      } finally {
        const still = current();
        if (live === req) live = null;
        /* the loading always ends with the current check's answer: the list (or its empty state), or, when no list
           came in yet, the error with "Try again" */
        if (still) setServerState((s) => (ok || loaded ? "ready" : s === "ready" ? s : "failed"));
      }
    };
    retryServer.current = () => {
      setServerState("loading");
      void load(true);
    };
    void load();
    const inView = () => document.visibilityState === "visible" && void load();
    const timer = setInterval(inView, 60_000);
    document.addEventListener("visibilitychange", inView);
    return () => {
      stop = true;
      live?.abort();
      live = null;
      retryServer.current = () => {};
      clearInterval(timer);
      document.removeEventListener("visibilitychange", inView);
    };
  }, []);

  /* the page closes: a "Load more" on its way is stopped */
  useEffect(
    () => () => {
      moreReq.current?.abort();
      moreReq.current = null;
    },
    [],
  );

  /* A search result or a notification links here with ?open=ID (once both lists are in) */
  const opened = useRef(false);
  useEffect(() => {
    if (!ready || !serverReady || opened.current) return;
    opened.current = true;
    const id = Number(new URLSearchParams(window.location.search).get("open"));
    const hit = id ? serverOrders.find((x) => x.id === id) ?? orders.find((x) => x.id === id) : undefined;
    if (hit) setSelected(keyOf(hit));
    /* a store order older than the pages loaded: asked for by its number */
    else if (id && serverMode())
      fetch(`/api/orders?number=${id}`, { credentials: "same-origin", cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { orders?: unknown } | null) => {
          const rows = serverRows(j?.orders);
          if (!rows.length) return;
          setServerOrders((list) => upsert(list, rows));
          setSelected(keyOf(rows[0]));
        })
        .catch(() => {
          /* offline: the order is not opened */
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, serverReady]);

  useEffect(() => {
    if (!ready || orders === loadedList.current) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(orders));
    } catch {
      /* storage unavailable */
    }
  }, [orders, ready]);

  useEffect(() => {
    if (!creating) return;
    nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setCreating(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [creating]);

  useEffect(() => {
    setConfirmDelete(false);
    setAskStatus(null);
    setStatusErr(false);
  }, [selected]);

  useEffect(() => {
    setReason("");
    deleting.current = false;
    if (!confirmDelete) return;
    reasonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setConfirmDelete(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDelete]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0])) as Record<StatusKey, number>;
    all.forEach((x) => (c[x.status] += 1));
    return c;
  }, [all]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^#/, "");
    /* a phone is found however it is typed: 079…, 79… or +962 79… */
    const digitsOf = (v: string) => latin(v).replace(/\D/g, "").replace(/^(00962|962|0)/, "");
    const qd = digitsOf(q);
    return all
      .filter((x) => (filter === "all" ? true : x.status === filter))
      .filter((x) => !q || String(x.id).includes(q) || x.customer.toLowerCase().includes(q) || x.phone.includes(q) || !!x.email?.includes(q) || (qd.length >= 3 && digitsOf(x.phone).includes(qd)))
      .sort((a, b) => b.created - a.created);
  }, [all, filter, query]);

  const current = all.find((x) => keyOf(x) === selected) ?? null;

  /* "Load more": the next older page of his store orders, added below */
  const loadMore = () => {
    if (!cursor || moreReq.current) return;
    /* its own AbortController: an answer for a list that was replaced meanwhile (or after the page closed) is dropped */
    const req = new AbortController();
    moreReq.current = req;
    const current = () => moreReq.current === req;
    setMoreLoading(true);
    setMoreFailed(false);
    fetch(`/api/orders?before=${encodeURIComponent(cursor)}`, { credentials: "same-origin", cache: "no-store", signal: req.signal })
      .then(async (r) => {
        const j = (r.ok ? await r.json() : null) as { orders?: unknown; next?: unknown; total?: unknown } | null;
        if (!current()) return;
        if (!j || !Array.isArray(j.orders)) return setMoreFailed(true);
        setServerOrders((list) => upsert(list, serverRows(j.orders)));
        if (typeof j.total === "number") setServerTotal(j.total);
        setCursor(typeof j.next === "string" ? j.next : null);
      })
      .catch(() => current() && setMoreFailed(true))
      .finally(() => {
        if (!current()) return;
        moreReq.current = null;
        setMoreLoading(false);
      });
  };
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dateOf = (t: number, time = false) => {
    const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(t));
    if (!time) return day;
    /* Date and time side by side, without the word "at" that some languages add between them */
    return `${day} ${new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(new Date(t))}`;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    const amount = money(total) ?? NaN;
    if (visibleLength(cleanLine(name, ORDER_MAX.customer)) < 2) next.name = o.errName;
    /* In Jordan the mobile is how an order is confirmed, delivered and paid in cash, so it is required */
    if (!isJordanMobile(phone)) next.phone = phoneError[lang];
    /* where to deliver, unless the customer collects it */
    if (fulfil === "delivery" && !isCity(city, cityList)) next.city = o.errCity;
    if (fulfil === "delivery" && visibleLength(address) < 3) next.address = o.errAddress;
    if (!(amount > 0)) next.total = o.errTotal;
    setErrors(next);
    /* the cursor goes to the first field with a mistake */
    const first = (["name", "phone", "city", "address", "total"] as const).find((k) => next[k]);
    if (first) {
      document.getElementById(`n-${first}`)?.focus();
      return;
    }

    /* after every number in use, his store's orders too */
    const id = 1001 + all.reduce((m, x) => Math.max(m, x.id - 1000), 0);
    change([{ id, customer: cleanLine(name, ORDER_MAX.customer), phone: savedMobile(phone), total: amount, status, channel: 0, source, fulfil, ...(fulfil === "delivery" ? { city, address: cleanLine(address, ORDER_LIMITS.address) } : {}), created: Date.now() }, ...ordersNow.current], (l) => undoWords[l].added(id));
    setSelected(`l:${id}`);
    setName("");
    setPhone("");
    setTotal("");
    setFulfil("delivery");
    setCity("");
    setAddress("");
    setStatus("pending");
    setSource(0);
    setCreating(false);
  };

  const statusLabel = (n: number, st: StatusKey) => (l: Lang) => undoWords[l].status(n, ordersCopy[l].statuses[st]);
  const setOrderStatus = (row: Row, s: StatusKey) => {
    if (row.status === s) return;
    const serverId = row.serverId;
    if (!serverId) return change(ordersNow.current.map((x) => (x.id === row.id ? { ...x, status: s } : x)), statusLabel(row.id, s));
    /* an order from his public store: shown at once, saved on the server, and put back if the server did not take it */
    const was = row.status;
    const put = (st: StatusKey) => {
      serverNow.current = serverNow.current.map((x) => (x.serverId === serverId ? { ...x, status: st } : x));
      setServerOrders((list) => list.map((x) => (x.serverId === serverId ? { ...x, status: st } : x)));
    };
    /* `from`: the server changes it only while the order still has that status (an undo never overwrites a newer change) */
    const send = (st: StatusKey, from?: StatusKey) =>
      fetch(`/api/orders/${serverId}`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(from ? { status: st, from } : { status: st }) }).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
      });
    put(s);
    setStatusErr(false);
    send(s)
      .then(() =>
        /* a status change sends the customer nothing, so it can be undone: the old status goes back the same way */
        offerUndo({
          scope: "orders",
          label: statusLabel(row.id, s),
          undo: async () => {
            if (serverNow.current.find((x) => x.serverId === serverId)?.status !== s) return false;
            try {
              await send(was, s);
            } catch {
              return false;
            }
            put(was);
            return true;
          },
        }),
      )
      .catch(() => {
        put(was);
        setStatusErr(true);
      });
  };
  /* Cancelling or refunding is asked first, other statuses change right away */
  const pickStatus = (row: Row, s: StatusKey) => {
    if (ASK_FIRST.includes(s)) setAskStatus(s);
    else {
      setAskStatus(null);
      setOrderStatus(row, s);
    }
  };
  /* Deleting needs a reason; the reason is kept with the deletion (orderDeletions.ts) */
  const remove = (id: number) => {
    if (deleting.current || !deleteReasonOk(reason)) return;
    deleting.current = true;
    logDeletion(id, cleanDeleteReason(reason));
    /* an Undo puts the order back and takes the deletion's record back with it. The record also goes when the undo had
       nothing to do because the order is in the list again anyway (another device's copy brought it back). */
    change(ordersNow.current.filter((x) => x.id !== id), (l) => undoWords[l].deleted(id), () => {
      if (ordersNow.current.some((x) => x.id === id)) unlogDeletion(id);
    });
    setSelected(null);
    setConfirmDelete(false);
  };
  const reasonOk = deleteReasonOk(reason);

  const statusList: { key: StatusKey | "all"; label: string; count: number; dot?: string }[] = [
    { key: "all", label: o.all, count: all.length },
    ...STATUS_KEYS.map((k) => ({ key: k, label: o.statuses[k], count: counts[k], dot: STATUS_DOT[k] })),
  ];

  return (
    <div className="dash min-h-screen bg-page">
      <DashboardBar
        active="orders"
        subtabs={o.tabs}
        subHrefs={["/orders", "/orders/invoices"]}
        activeSub={0}
      />

      <main data-lang-fade className="mx-auto max-w-[1720px] space-y-5 px-5 py-8 md:px-10">
        <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={o.searchPh} aria-label={o.searchPh} className={`${field} h-12 ps-12`} />
        </div>
          <button type="button" onClick={() => setCreating(true)} className="h-12 shrink-0 rounded-xl bg-ink px-6 text-sm font-semibold text-onink transition hover:bg-deep"> + {o.newOrder} </button>
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,22rem)_minmax(0,1fr)]">
          {/* Statuses */}
          <section className={`${card} overflow-hidden`}>
            <ul className="max-lg:flex max-lg:overflow-x-auto">
              {statusList.map((s) => (
                <li key={s.key} className="max-lg:shrink-0">
                  <button
                    type="button"
                    onClick={() => setFilter(s.key)}
                    aria-pressed={filter === s.key}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-sm transition-colors max-lg:whitespace-nowrap ${filter === s.key ? "bg-black/[0.07] font-bold dark:bg-white/[0.1]" : "text-muted hover:bg-fg/[0.05] hover:text-fg"}`}
                  >
                    {s.dot ? <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} /> : <span className="h-2 w-2 shrink-0" />}
                    <span className="flex-1 text-start">{s.label}</span>
                    {/* the counts wait for the store's orders: never a count of the hand-added ones alone */}
                    {serverState === "loading" ? <Skeleton className="h-3 w-5 !rounded" /> : <span dir="ltr" className="text-xs">{s.count}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Orders */}
          <section className={`${card} overflow-hidden`}>
            {/* the first list of his store orders did not come: said, with "Try again" (above the orders kept in this
                browser when there are some, in place of "No orders yet" when there are none) */}
            {serverState === "failed" && (
              <p role="alert" className={`px-5 text-center text-sm text-rose-600 ${all.length === 0 ? "py-14" : "border-b border-fg/10 py-4"}`}>
                {o.loadFailed}{" "}
                <button type="button" onClick={() => retryServer.current()} className="font-semibold underline">{o.retry}</button>
              </p>
            )}
            {all.length === 0 && serverState === "failed" ? null : serverState === "loading" ? (
              /* the store's orders are still on their way: the loading look, never "No orders yet" nor only the orders
                 kept in this browser before the server answered */
              <div role="status" aria-label={o.loadingMore} className="divide-y divide-fg/10">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                ))}
              </div>
            ) : shown.length === 0 ? (
              <div className="px-5 py-14 text-center">
                <p className="font-bold">{all.length === 0 ? o.listEmpty : o.noMatch}</p>
                {all.length === 0 && <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{o.listEmptyHint}</p>}
                {all.length === 0 && (
                  <button type="button" onClick={() => setCreating(true)} className="mt-5 rounded-xl border border-primary/60 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">
                    {o.newOrder}
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-fg/10">
                {shown.map((x) => (
                  <li key={keyOf(x)}>
                    <button
                      type="button"
                      onClick={() => setSelected(keyOf(x))}
                      aria-current={selected === keyOf(x)}
                      className={`w-full px-5 py-4 text-start transition-colors ${selected === keyOf(x) ? "bg-black/[0.07] dark:bg-white/[0.1]" : "hover:bg-fg/[0.05]"}`}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span dir="auto" className="truncate font-semibold ltr:text-left rtl:text-right">{x.customer}</span>
                        <span dir="ltr" className="shrink-0 text-xs text-muted">#{x.id}</span>
                      </span>
                      <span className="mt-1.5 flex items-center justify-between gap-3 text-xs text-muted">
                        <span className="inline-flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[x.status]}`} />
                          {statusName(x, x.status, o)}
                        </span>
                        <span>{dateOf(x.created)}</span>
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-3">
                        <span dir="ltr" className="text-sm font-bold">
                          {fmt(x.total)} <small className="font-semibold opacity-70">{o.currency}</small>
                        </span>
                        {/* how a store order is paid; a new cash order already says it in its status, a cancelled one needs none */}
                        {(() => {
                          const p = payLine(x, o);
                          if (!p) return x.payment === "test" ? <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">{o.testOrder}</span> : null;
                          if (p.tone === "off" || (p.tone === "due" && x.status === "pending")) return null;
                          const tone = p.tone === "paid" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : p.tone === "test" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-fg/10 text-fg";
                          return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}>{p.text}</span>;
                        })()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {/* the orders from his store page come a page at a time: how many are loaded, and the older ones on request */}
            {serverTotal > 0 && (serverOrders.length < serverTotal || !!cursor) && (
              <div className="flex flex-col items-center gap-2 border-t border-fg/10 px-5 py-4 text-sm">
                <p className="text-xs text-muted">{o.storeShown.replace("{n}", String(serverOrders.length)).replace("{total}", String(serverTotal))}</p>
                {cursor && (
                  <button type="button" onClick={loadMore} disabled={moreLoading} className="rounded-xl border border-fg/20 px-5 py-2 text-sm font-semibold transition hover:bg-soft disabled:opacity-60">
                    {moreLoading ? o.loadingMore : o.loadMore}
                  </button>
                )}
                {moreFailed && <p role="alert" className="text-xs text-rose-600">{o.moreFailed}</p>}
              </div>
            )}
          </section>

          {/* Details */}
          <section className={`${card} min-h-[20rem] p-5 sm:p-7`}>
            {!current ? (
              <p className="grid min-h-[16rem] place-items-center text-center text-sm text-muted">{o.pickOne}</p>
            ) : (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold">{o.details}</h2>
                    <p className="mt-1 text-2xl font-extrabold">{current.customer}</p>
                    {/* reaching the customer: a call or WhatsApp (with a first message about this order), or an email */}
                    {current.phone && (() => {
                      const dial = dialOf(current.phone);
                      const store = loadSetup()?.name?.trim() ?? "";
                      const text = (store ? o.waText.replace("{store}", store) : o.waTextNoStore).replace("{n}", String(current.id));
                      return (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                          <bdi dir="ltr">{current.phone}</bdi>
                          {dial && <a href={`tel:${dial.tel}`} className={contactBtn}>{o.call}</a>}
                          {dial?.wa && <a href={`https://wa.me/${dial.wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className={contactBtn}>{o.whatsapp}</a>}
                        </div>
                      );
                    })()}
                    {current.email && (
                      <p className="mt-1 text-start text-sm text-muted">
                        {EMAIL_LINK.test(current.email) ? (
                          <a href={`mailto:${current.email}`} className="rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"><bdi dir="ltr">{current.email}</bdi></a>
                        ) : (
                          <bdi dir="ltr">{current.email}</bdi>
                        )}
                      </p>
                    )}
                    {current.fulfil === "pickup" ? <p className="mt-1 text-sm text-muted">{o.pickedUp}</p> : (current.city || current.address) && <p dir="auto" className="mt-1 text-sm text-muted">{[current.city && inLang(current.city, KNOWN_CITIES, lang), current.address].filter(Boolean).join(" · ")}</p>}
                  </div>
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${current.status === "pending" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-fg/10 text-fg"}`}>
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT[current.status]}`} />
                    {statusName(current, current.status, o)}
                  </span>
                </div>

                <dl className="mt-6 grid gap-5 border-t border-fg/10 pt-6 sm:grid-cols-3">
                  {[
                    [o.orderNo, <span key="n" dir="ltr">#{current.id}</span>],
                    [o.date, dateOf(current.created, true)],
                    [o.channel, current.source !== undefined && current.channel === 0 ? `${o.channels[0]} · ${o.sources[current.source]}` : o.channels[current.channel]],
                  ].map(([k, v], idx) => (
                    <div key={idx}>
                      <dt className="text-xs text-muted">{k}</dt>
                      <dd className="mt-1 text-sm font-semibold">{v}</dd>
                    </div>
                  ))}
                </dl>

                {/* what the customer wrote for the store at checkout */}
                {current.note && (
                  <div className="mt-6 rounded-xl bg-soft/70 px-4 py-3">
                    <p className="text-xs text-muted">{o.note}</p>
                    <p dir="auto" className="mt-1 whitespace-pre-line text-sm">{current.note}</p>
                  </div>
                )}

                {current.items && current.items.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-bold">{o.items}</h3>
                    <ul className="mt-3 divide-y divide-fg/10 rounded-xl ring-1 ring-fg/10">
                      {current.items.map((it, n) => (
                        <li key={n} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                          <span className="flex min-w-0 items-center gap-3 font-semibold">
                            {/* the store's own placeholder when the product has no photo */}
                            <ProductPhoto src={it.image} hue={noPhotoHue(it.id)} className="h-12 w-12 shrink-0 rounded-lg ring-1 ring-black/10" />
                            <span className="min-w-0">
                              {it.name} <span dir="ltr" className="whitespace-nowrap font-bold text-muted">×{it.qty}</span>
                              {/* the size the customer chose (clothing and shoes) */}
                              {it.size && <span className="mt-0.5 block text-xs font-semibold text-muted">{o.size}: <bdi>{it.size}</bdi></span>}
                            </span>
                          </span>
                          <span dir="ltr" className="shrink-0 font-bold">
                            {fmt(it.price * it.qty)} <small className="text-xs opacity-70">{o.currency}</small>
                          </span>
                        </li>
                      ))}
                      {/* the subtotal before the coupon and the delivery, as on the customer's receipt, so the lines add up
                          to the total */}
                      {(current.coupon || (current.delivery !== undefined && current.fulfil !== "pickup")) && (
                        <li className="flex items-center justify-between gap-4 px-4 py-3 text-sm font-semibold">
                          <span>{lang === "ar" ? "المجموع" : "Subtotal"}</span>
                          <span dir="ltr" className="shrink-0 font-bold">{fmt(current.items.reduce((n, it) => n + it.qty * it.price, 0))} <small className="text-xs opacity-70">{o.currency}</small></span>
                        </li>
                      )}
                      {/* the coupon the customer used at checkout (the total is already after it) */}
                      {current.coupon && (
                        <li className="flex items-center justify-between gap-4 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          <span>{lang === "ar" ? "كود الخصم" : "Coupon"} <span dir="ltr" className="font-bold">{current.coupon.code}</span></span>
                          <span dir="ltr" className="shrink-0 font-bold">−{fmt(current.coupon.discount)} <small className="text-xs opacity-70">{o.currency}</small></span>
                        </li>
                      )}
                      {/* an order from his store: the delivery it was charged (in the total), so the lines add up to it.
                          Nothing charged: "Free", or, delivered by his own courier with no fee set (not free by his offer
                          or a free delivery coupon), the store confirms the fee, as the customer was told */}
                      {current.delivery !== undefined && current.fulfil !== "pickup" && (() => {
                        const ship = current.delivery === 0 ? loadSetup()?.shipping : null;
                        const fd = ship ? loadFreeDelivery() : null;
                        const sub = (current.items ?? []).reduce((n, it) => n + it.qty * it.price, 0);
                        const open = !!ship && ship.mode === "own" && ship.fee === undefined && !(current.coupon && current.coupon.discount === 0) && !(fd?.on && sub >= fd.min);
                        return (
                          <li className="flex items-center justify-between gap-4 px-4 py-3 text-sm font-semibold">
                            <span>{lang === "ar" ? "التوصيل" : "Delivery"}</span>
                            <span dir={current.delivery > 0 ? "ltr" : "auto"} className="shrink-0 font-bold">
                              {current.delivery > 0 ? <>{fmt(current.delivery)} <small className="text-xs opacity-70">{o.currency}</small></> : open ? (lang === "ar" ? "يؤكدها المتجر" : "Confirmed by the store") : lang === "ar" ? "مجاني" : "Free"}
                            </span>
                          </li>
                        );
                      })()}
                    </ul>
                  </div>
                )}

                <div className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-soft/70 px-4 py-4">
                  <div>
                    {/* A cancelled order was never paid, a refunded one was paid back */}
                    {/* an order from his store: how the customer pays (payLine): cash on delivery or pickup, "Paid (cash)" once
                        delivered; card and CliQ take nothing yet */}
                    {(() => {
                      const p = payLine(current, o);
                      if (p) return (
                        <>
                          <p className={`text-sm font-bold ${p.tone === "paid" ? "text-emerald-700 dark:text-emerald-400" : ""}`}>{p.text}</p>
                          {p.hint && <p className="mt-0.5 text-xs text-muted">{p.hint}</p>}
                        </>
                      );
                      return (
                        <>
                          <p className="text-sm font-bold">{current.payment === "test" ? o.testOrder : current.status === "pending" ? o.unpaid : current.status === "cancelled" ? o.cancelledPay : current.status === "refunded" ? o.refundedPay : o.paid}</p>
                          {current.payment === "test" ? <p className="mt-0.5 text-xs text-muted">{o.testOrderHint}</p> : current.status === "pending" && <p className="mt-0.5 text-xs text-muted">{o.paymentHint}</p>}
                        </>
                      );
                    })()}
                  </div>
                  <p dir="ltr" className="text-xl font-extrabold">
                    {fmt(current.total)} <small className="text-xs font-bold opacity-70">{o.currency}</small>
                  </p>
                </div>

                <div className="mt-6 max-w-xs">
                  <label htmlFor="o-status" className="mb-2 block text-sm font-semibold">{o.changeStatus}</label>
                  <select id="o-status" value={askStatus ?? current.status} onChange={(e) => pickStatus(current, e.target.value as StatusKey)} className={`${field} h-11`}>
                    {STATUS_KEYS.map((k) => <option key={k} value={k}>{statusName(current, k, o)}</option>)}
                  </select>
                </div>
                {askStatus && (
                  <div role="alert" className="mt-3 flex flex-wrap items-center gap-3">
                    <p className="text-sm text-rose-600">{o.statusAsk.replace("{status}", o.statuses[askStatus])}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setOrderStatus(current, askStatus);
                        setAskStatus(null);
                      }}
                      className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
                    >
                      {o.statusYes}
                    </button>
                    <button type="button" onClick={() => setAskStatus(null)} className="rounded-lg border border-fg/20 px-4 py-2 text-sm font-semibold transition hover:bg-soft">{o.statusNo}</button>
                  </div>
                )}

                {statusErr && <p role="alert" className="mt-3 text-sm text-rose-600">{o.statusFailed}</p>}

                {/* an order from his public store stays on the server: it is cancelled, not deleted */}
                {!current.serverId && (
                  <div className="mt-8 border-t border-fg/10 pt-5">
                    <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg border border-rose-500/50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">{o.delete}</button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {confirmDelete && current && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && setConfirmDelete(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              remove(current.id);
            }}
            noValidate
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="d-title"
            aria-describedby="d-ask"
            className="dash my-8 w-full max-w-lg rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10"
          >
            <h2 id="d-title" className="text-lg font-bold">{o.delete} <span dir="ltr">#{current.id}</span></h2>
            <p id="d-ask" className="mt-2 text-sm text-rose-600">{o.deleteAsk}</p>
            <label htmlFor="d-reason" className="mb-2 mt-5 block text-sm font-semibold">{o.deleteReason}<RequiredMark /></label>
            <textarea
              id="d-reason"
              ref={reasonRef}
              rows={4}
              dir="auto"
              aria-required
              aria-describedby="d-hint"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={o.deleteReasonPh}
              maxLength={DELETE_REASON.max}
              className={`${field} block resize-y py-3 leading-relaxed`}
            />
            <p id="d-hint" className="mt-1.5 flex justify-between gap-3 text-xs text-muted">
              <span>{o.deleteReasonHint.replace("{min}", String(DELETE_REASON.min))}</span>
              <span dir="ltr">{reason.length}/{DELETE_REASON.max}</span>
            </p>
            <div className="mt-6 flex gap-3">
              <button type="submit" disabled={!reasonOk} className="h-12 flex-1 rounded-xl bg-rose-600 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-rose-600">{o.deleteYes}</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-12 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{o.cancel}</button>
            </div>
          </form>
        </div>
      )}

      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && setCreating(false)}>
          <form onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-label={o.formTitle} className="dash my-8 w-full max-w-lg rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10">
            <h2 className="text-lg font-bold">{o.formTitle}</h2>
            {hasErrors(errors) && <div className="mt-2"><RequiredNote text={requiredNote[lang]} show /></div>}
            <div className="mt-5 space-y-5">
              <div>
                <label htmlFor="n-name" className="mb-2 block text-sm font-semibold">{o.customer}<RequiredMark /></label>
                <input id="n-name" ref={nameRef} aria-required aria-invalid={!!errors.name} value={name} onChange={(e) => setName(e.target.value)} placeholder={o.namePh} maxLength={60} className={`${field} h-11 ${errors.name ? bad : ""}`} />
                {errors.name && <p className="mt-1.5 text-xs text-rose-600">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="n-phone" className="mb-2 block text-sm font-semibold">{o.phone}<RequiredMark /></label>
                <input id="n-phone" dir="ltr" inputMode="tel" aria-required aria-invalid={!!errors.phone} value={phone} onChange={(e) => setPhone(typedAnyPhone(e.target.value))} placeholder="07X XXX XXXX" maxLength={20} className={`${field} h-11 text-start ${errors.phone ? bad : ""}`} />
                {errors.phone && <p className="mt-1.5 text-xs text-rose-600">{errors.phone}</p>}
              </div>
              <div role="radiogroup" aria-label={o.fulfil}>
                <p className="mb-2 text-sm font-semibold">{o.fulfil}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["delivery", "pickup"] as const).map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={fulfil === k} onClick={() => { setFulfil(k); setErrors((x) => ({ ...x, city: undefined, address: undefined })); }} className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition ${fulfil === k ? "border-primary bg-primary/10 text-primary" : "border-fg/15 hover:bg-soft"}`}>
                      {k === "delivery" ? o.fulfilDelivery : o.fulfilPickup}
                    </button>
                  ))}
                </div>
              </div>
              {fulfil === "delivery" && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="n-city" className="mb-2 block text-sm font-semibold">{o.city}<RequiredMark /></label>
                    <select id="n-city" aria-required aria-invalid={!!errors.city} value={city} onChange={(e) => { setCity(e.target.value); setErrors((x) => ({ ...x, city: undefined })); }} className={`${field} h-11 ${errors.city ? bad : ""}`}>
                      <option value="">{o.cityPh}</option>
                      {cityList[lang].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {errors.city && <p className="mt-1.5 text-xs text-rose-600">{errors.city}</p>}
                  </div>
                  <div>
                    <label htmlFor="n-address" className="mb-2 block text-sm font-semibold">{o.address}<RequiredMark /></label>
                    <input id="n-address" aria-required aria-invalid={!!errors.address} value={address} onChange={(e) => { setAddress(e.target.value); setErrors((x) => ({ ...x, address: undefined })); }} placeholder={o.addressPh} maxLength={ORDER_LIMITS.address} className={`${field} h-11 ${errors.address ? bad : ""}`} />
                    {errors.address && <p className="mt-1.5 text-xs text-rose-600">{errors.address}</p>}
                  </div>
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="n-total" className="mb-2 block text-sm font-semibold">{o.total} ({o.currency})<RequiredMark /></label>
                  <input id="n-total" dir="ltr" inputMode="decimal" aria-required aria-invalid={!!errors.total} value={total} onChange={(e) => setTotal(typedMoney(e.target.value, 3))} placeholder="0.00" maxLength={10} className={`${field} h-11 text-start ${errors.total ? bad : ""}`} />
                  {errors.total && <p className="mt-1.5 text-xs text-rose-600">{errors.total}</p>}
                </div>
                <div>
                  <label htmlFor="n-status" className="mb-2 block text-sm font-semibold">{o.status}</label>
                  <select id="n-status" value={status} onChange={(e) => setStatus(e.target.value as StatusKey)} className={`${field} h-11`}>
                    {STATUS_KEYS.map((k) => <option key={k} value={k}>{o.statuses[k]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="n-source" className="mb-2 block text-sm font-semibold">{o.sourceLabel}</label>
                <select id="n-source" value={source} onChange={(e) => setSource(Number(e.target.value))} className={`${field} h-11`}>
                  {o.sources.map((s, i) => <option key={s} value={i}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="submit" className="h-12 flex-1 rounded-xl bg-ink text-sm font-semibold text-onink transition hover:-translate-y-0.5 hover:bg-deep">{o.create}</button>
              <button type="button" onClick={() => setCreating(false)} className="h-12 rounded-xl border border-fg/20 px-6 text-sm font-semibold transition hover:bg-soft">{o.cancel}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
