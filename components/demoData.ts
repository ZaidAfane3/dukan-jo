import type { Lang } from "./content";
import { demoConfig, perfumeStore } from "./storefront/demoStores";

/* Everything the platform tour shows: a made-up perfume store with made-up products, orders,
   customers and coupons. Nothing here belongs to a real store, person or phone number. */

const DAY = 86_400_000;
const bi = (lang: Lang, en: string, ar: string) => (lang === "ar" ? ar : en);

/** The tour's data, written the way the dashboard pages save theirs. Names follow the language chosen. */
export function demoSeed(lang: Lang): { local: Record<string, string>; session: Record<string, string> } {
  const now = Date.now();
  const L = (en: string, ar: string) => bi(lang, en, ar);

  const setup = {
    name: L("Perfume Store", "متجر عطور"),
    description: L("Fine fragrances and body mists, made in small batches.", "عطور راقية ومعطّرات جسم، تُصنع بكميات صغيرة."),
    color: "#2b241d",
    phone: "70 000 0000",
    slug: "perfume-store",
    logo: perfumeStore.logo,
    done: [true, true, true, true, true, true],
    pickup: true,
    product: null,
    shipping: {
      mode: "seen",
      kind: 0,
      name: L("Dukkan Ship", "شحن دكان"),
      phone: "",
      city: L("Amman", "عمّان"),
      address: L("University Street, building 12", "شارع الجامعة، مبنى 12"),
    },
  };

  const brand = L("Perfume Store", "متجر عطور");
  const p = (
    id: number,
    name: [string, string],
    category: [string, string],
    price: number,
    cost: number,
    quantity: number,
    extra: { sale?: number; featured?: boolean; hidden?: boolean; lowAt?: number; description?: [string, string] } = {},
  ) => ({
    id,
    name: L(...name),
    price,
    sale: extra.sale ?? null,
    cost,
    category: L(...category),
    brand,
    description: extra.description ? L(...extra.description) : "",
    quantity,
    hidden: extra.hidden ?? false,
    featured: extra.featured ?? false,
    shipping: true,
    lowAt: extra.lowAt ?? 5,
    restockMin: 15,
    restockPct: 100,
    created: now - (30 - id) * DAY,
  });

  const perfumes: [string, string] = ["Perfumes", "عطور"];
  const cologne: [string, string] = ["Cologne", "كولونيا"];
  const oils: [string, string] = ["Oils", "دهون"];
  const mists: [string, string] = ["Body mists", "معطّرات جسم"];
  const gifts: [string, string] = ["Gifts", "هدايا"];

  const products = [
    p(1, ["Rose Garden 50ml", "حديقة الورد 50 مل"], perfumes, 48, 22, 24, { featured: true, description: ["A soft rose with a fresh green heart.", "ورد ناعم بقلب أخضر منعش."] }),
    p(2, ["Vanilla Cloud 30ml", "سحابة الفانيلا 30 مل"], perfumes, 29, 12, 40, { sale: 23 }),
    p(3, ["Midnight Jasmine 100ml", "ياسمين الليل 100 مل"], perfumes, 62, 28, 3, { featured: true, lowAt: 5 }),
    p(4, ["Sea Breeze 50ml", "نسيم البحر 50 مل"], perfumes, 44, 19, 18),
    p(5, ["Fresh Citrus Cologne", "كولونيا الحمضيات المنعشة"], cologne, 21, 8, 55, { featured: true }),
    p(6, ["Cedar Cologne", "كولونيا الأرز"], cologne, 24, 9, 31),
    p(7, ["Sandalwood Oil", "دهن الصندل"], oils, 26, 11, 14, { sale: 20 }),
    p(8, ["Rose Oil 12ml", "دهن الورد 12 مل"], oils, 18, 7, 0),
    p(9, ["Lavender Body Mist", "معطّر جسم باللافندر"], mists, 14, 5, 62, { featured: true }),
    p(10, ["Peach Body Mist", "معطّر جسم بالخوخ"], mists, 14, 5, 47),
    p(11, ["Gift set of three", "طقم هدية ثلاثي"], gifts, 58, 26, 12, { sale: 49, featured: true }),
    p(12, ["Travel atomizer", "بخاخ سفر"], gifts, 9, 3, 80, { hidden: true }),
  ];

  const names: [string, string][] = [
    ["Lina M.", "لينا م."], ["Hamza K.", "حمزة ك."], ["Rana T.", "رنا ط."], ["Omar S.", "عمر س."], ["Dina A.", "دينا أ."], ["Yazan H.", "يزن ح."],
    ["Sara L.", "سارة ل."], ["Majd O.", "مجد ع."], ["Hala B.", "هالة ب."], ["Tariq W.", "طارق و."], ["Noor S.", "نور س."], ["Fadi N.", "فادي ن."],
  ];
  const statuses = ["pending", "review", "processing", "shipping", "delivered", "delivered", "delivered", "cancelled", "delivered", "processing", "shipping", "refunded"] as const;
  const totals = [48, 29, 62, 35, 120, 21, 49, 58, 26, 73, 44, 14];
  const orders = names.map((n, i) => ({
    id: 1012 - i,
    customer: L(...n),
    /* Not real numbers: the prefix 070 is not used in Jordan */
    phone: `070 000 ${String(1000 + i).slice(1)}0`.slice(0, 12),
    total: totals[i],
    status: statuses[i],
    channel: (i % 4 === 3 ? 1 : 0) as 0 | 1,
    created: now - i * 0.9 * DAY - i * 3_600_000,
  }));

  const coupons = [
    { id: "c1", type: 0, name: L("Welcome offer", "عرض الترحيب"), code: "WELCOME10", kind: "percent", value: 10, minOrder: 0, start: "", end: "", limit: 0, validDays: 0, used: 18, active: true },
    { id: "c2", type: 1, name: L("Free delivery", "توصيل مجاني"), code: "FREESHIP", kind: "shipping", value: 0, minOrder: 25, start: "", end: "", limit: 100, validDays: 0, used: 41, active: true },
    { id: "c3", type: 2, name: L("Gift week", "أسبوع الهدايا"), code: "GIFT5", kind: "fixed", value: 5, minOrder: 40, start: "", end: "", limit: 50, validDays: 0, used: 9, active: false },
  ];

  const reminders = [
    { id: 1, name: L("First nudge", "التذكير الأول"), amount: 2, unit: 0, channel: 0, discount: 0, active: true },
    { id: 2, name: L("Last chance", "فرصة أخيرة"), amount: 1, unit: 1, channel: 1, discount: 10, active: true },
  ];
  const repurchase = [{ id: 1, name: L("Time for a refill", "حان وقت التجديد"), amount: 30, unit: 1, channel: 0, discount: 5, active: true }];

  /* The tour's notifications: what a running store would see (no "finish your setup" welcome) */
  const note = (id: string, kind: string, params: Record<string, string>, minutesAgo: number, read = false) => ({ id, kind, params, ts: now - minutesAgo * 60_000, read });
  const notifications = [
    note("n1", "reminderSent", { name: names[0][lang === "ar" ? 1 : 0] }, 14),
    note("n2", "couponCreated", { code: "WELCOME10" }, 95),
    note("n3", "reminderSent", { name: names[1][lang === "ar" ? 1 : 0] }, 260, true),
  ];

  return {
    local: {
      "seen-setup": JSON.stringify(setup),
      "seen-products": JSON.stringify(products),
      "seen-orders": JSON.stringify(orders),
      "seen-coupons": JSON.stringify(coupons),
      "seen-reminders": JSON.stringify(reminders),
      "seen-repurchase": JSON.stringify(repurchase),
      "seen-storefront": JSON.stringify(demoConfig(perfumeStore, lang)),
      "seen-freedelivery": JSON.stringify({ on: true, min: 25 }),
    },
    session: {
      "seen-welcomed": "1",
      "seen-notifications": JSON.stringify(notifications),
      "seen-account-profile": JSON.stringify({ name: L("Demo owner", "صاحب المتجر"), email: "demo@example.com", phone: "70 000 0000" }),
    },
  };
}
