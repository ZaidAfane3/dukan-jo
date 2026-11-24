import { STORE_PREFIX } from "./siteAddress";
/* The words, links and pictures of Dukkan's own landing page (the page at "/"), its nav and its footer. Since 2026-11-16
   this file is the only source of the website's copy: to change the website, edit SITE_DEFAULTS below and ship the code.
   Diwan no longer has a Website page, and the old platform_settings row 'site_content' it saved is gone (server/schema.ts),
   so nothing in the database can change what the public site says.

   Plain TypeScript with no browser or server APIs, so the server and the browser draw the same page
   (components/useSiteContent.ts reads it for the landing page's sections). */

export type Bi = { en: string; ar: string };
/** A link: its words in both languages and where it goes. An empty `href` hides the link instead of a dead "#". */
export type SiteLink = { label: Bi; href: string };

/** A link's address that stands for Dukkan support's email as staff set it in Diwan (Platform settings > Support
    contact): the page puts in the address there is now (platformPublic.ts supportLinks), so a change in Diwan reaches
    these links too, and with no email set the link is left out like any link with no address */
export const SUPPORT_EMAIL = "support:email";
export const withSupport = (href: string, mailto: string) => (href === SUPPORT_EMAIL ? mailto : href);

/* The pictures each industry, feature and social link can have. They are drawn in code (components/Sections.tsx), and each
   item below picks one by name. */
export const INDUSTRY_ICONS = ["fashion", "perfume", "jewelry", "digital", "electronics", "beauty", "home", "store"] as const;
export type IndustryIcon = (typeof INDUSTRY_ICONS)[number];
export const FEATURE_KINDS = ["solutions", "design", "payments", "shipping", "marketing"] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];
export const SOCIAL_KINDS = ["tiktok", "x", "youtube", "instagram", "facebook", "linkedin"] as const;
export type SocialKind = (typeof SOCIAL_KINDS)[number];
export const SOCIAL_NAMES: Record<SocialKind, Bi> = {
  tiktok: { en: "TikTok", ar: "تيك توك" },
  x: { en: "X", ar: "إكس" },
  youtube: { en: "YouTube", ar: "يوتيوب" },
  instagram: { en: "Instagram", ar: "إنستغرام" },
  facebook: { en: "Facebook", ar: "فيسبوك" },
  linkedin: { en: "LinkedIn", ar: "لينكدإن" },
};

/* An industry can have a detail card: a title, a short text, a few points, and pictures of a store of that kind (each
   picture is a part of a long picture of the page: `y` is how far down it, in percent). `stores` are several stores of
   the industry in one window, taking turns (in place of the shots). */
export type IndustryDetail = {
  title: Bi;
  body: Bi;
  bullets: Bi[];
  shots: { src: string; y: number }[];
  stores: { src: string; address: string; view: string }[];
};
export type SiteIndustry = { icon: IndustryIcon; name: Bi; blurb: Bi; detail: IndustryDetail | null };
/** `kind` picks the feature's picture and icons; `anchor` is its place on the page (/#design), empty for none */
export type SiteFeature = { kind: FeatureKind; anchor: string; tag: Bi; title: Bi; body: Bi; points: Bi[] };
export type SiteQuote = { quote: Bi; name: Bi; role: Bi; avatar: string };
export type PaymentLogo = { name: string; src: string; height: number; invertInDark: boolean };

export type SiteContent = {
  nav: { links: SiteLink[]; resources: Bi; resourceLinks: SiteLink[]; login: SiteLink; start: SiteLink };
  hero: { before: Bi; highlight: Bi; after: Bi; sub: Bi; cta1: SiteLink; cta2: SiteLink; note: Bi };
  industries: { title: Bi; finale: Bi; items: SiteIndustry[] };
  experience: {
    title: Bi;
    captions: Bi[];
    login: { brand: Bi; title: Bi; label: Bi; button: Bi; link: Bi };
    pay: { title: Bi; options: Bi[]; button: Bi };
    track: { title: Bi; order: Bi; steps: Bi[] };
  };
  features: { title: Bi; items: SiteFeature[] };
  testimonials: { title: Bi; items: SiteQuote[] };
  finalCta: { title: Bi; body: Bi; button: SiteLink };
  footer: { tagline: Bi; columns: { title: Bi; links: SiteLink[] }[]; industriesTitle: Bi; availableIn: Bi; country: Bi; legal: Bi; payments: PaymentLogo[] };
  social: { kind: SocialKind; href: string }[];
  /* where Dukkan is. Its phone, WhatsApp and email are not here: staff set them in Diwan > Platform settings (the
     setting support_contact, components/platformPublic.ts), so the website and the suspended-store page show one live copy */
  contact: { place: Bi };
  legal: {
    number: string;
    url: string;
    verified: Bi;
    label: Bi;
    tag: Bi;
    title: Bi;
    sub: Bi;
    check: Bi;
    cards: { title: Bi; body: Bi }[];
  };
  seo: { title: Bi; description: Bi };
};

const bi = (en: string, ar: string): Bi => ({ en, ar });
const link = (en: string, ar: string, href: string): SiteLink => ({ label: bi(en, ar), href });

/** Today's landing page, word for word. Links that pointed nowhere ("#") have an empty address, so they stay hidden until
    an address is added here. */
export const SITE_DEFAULTS: SiteContent = {
  nav: {
    links: [link("Solutions", "الحلول", "#solutions"), link("Industries", "القطاعات", "#industries"), link("Themes", "الثيمات", "#design")],
    resources: bi("Resources", "الموارد"),
    resourceLinks: [link("Help center", "مركز المساعدة", ""), link("FAQ", "الأسئلة الشائعة", ""), link("Contact us", "تواصل معنا", SUPPORT_EMAIL)],
    login: link("Log in", "تسجيل دخول", "/signup?tab=login"),
    start: link("Start free", "ابدأ مجانًا", "/signup"),
  },
  hero: {
    before: bi("Commerce, made", "التِّجارة، بشكلٍ"),
    highlight: bi("simple", "بسيطٍ"),
    after: bi("and smart.", "وذكيٍّ."),
    sub: bi(
      "Build your store in minutes and connect payments, shipping, inventory and marketing in one place. Your success shouldn't need complexity.",
      "أنشئ متجرك الإلكتروني في دقائق، واربط المدفوعات والشحن والمخزون والتسويق في مكانٍ واحد. نجاحك لا يحتاج إلى تعقيد.",
    ),
    cta1: link("Create your store for free", "أنشئ متجرك مجانًا", "/signup"),
    cta2: link("Try the demo", "تجربة المنصة", "/demo"),
    note: bi("Built for merchants in Jordan.", "مُصمّم للتجّار في الأردن."),
  },
  industries: {
    title: bi("Launch in any industry", "انطلق بتجارتك مهما كان قطاعك"),
    finale: bi("Every industry, one platform.", "كل قطاع، ومنصة واحدة تجمعها."),
    items: [
      {
        icon: "fashion",
        name: bi("Fashion", "أزياء"),
        blurb: bi("Colors, sizes and new drops every week, handled.", "ألوان ومقاسات وموديلات جديدة كل أسبوع، كلها بسهولة."),
        detail: {
          title: bi("A clothing store that looks like you", "متجر ملابس يشبه ذوقك"),
          body: bi(
            "Hoodies, tees, caps or anything you can wear. Your store comes alive with bold colors, quick category buttons and a product page with sizes and reviews.",
            "هوديز وتيشيرتات وكابات وكل ما يُلبس. يصير متجرك مليان حياة بألوان جريئة، وأزرار تصنيفات سريعة، وصفحة منتج فيها مقاسات وتقييمات.",
          ),
          bullets: [
            bi("Colorful quick buttons for Men, Women and more", "أزرار ملوّنة سريعة لرجالي ونسائي وغيرها"),
            bi("Product pages with sizes, stars and customer opinions", "صفحات منتجات بمقاسات ونجوم وآراء العملاء"),
            bi("A page for every category, ready to fill", "صفحة جاهزة لكل تصنيف وتنتظر منتجاتك"),
          ],
          shots: [{ src: "/themes/lamma.webp", y: 0 }, { src: "/themes/lamma-product.webp", y: 0 }],
          stores: [
            { src: "/themes/mada.webp", address: `${STORE_PREFIX}your-store`, view: "/store?theme=mada" },
            { src: "/themes/lamma.webp", address: `${STORE_PREFIX}your-store`, view: "/store?theme=lamma" },
          ],
        },
      },
      {
        icon: "perfume",
        name: bi("Perfumes", "العطور"),
        blurb: bi("Collections, gift sets and samples, handled.", "مجموعات وأطقم هدايا وعيّنات، كلها بسهولة."),
        detail: {
          title: bi("Smart tools for selling your perfumes", "حلول ذكية لبيع عطورك"),
          body: bi(
            "Whether you sell fine fragrances, oud or gift sets, your store shows every scent with elegance and takes orders without any technical fuss.",
            "سواء كنت تبيع عطورًا فاخرة أو دهن عود أو أطقم هدايا، يعرض متجرك كل عطر بأناقة ويستقبل الطلبات بدون أي تعقيدات تقنية.",
          ),
          bullets: [
            bi("Show each perfume's notes and size on its card", "اعرض نوتات كل عطر وحجمه على بطاقته"),
            bi("A ready luxury design for your collections and banners", "تصميم فاخر جاهز لمجموعاتك وبنراتك"),
            bi("Choose which part of each bottle's picture shows", "اختر الجزء الظاهر من صورة كل زجاجة"),
          ],
          shots: [{ src: "/themes/atelier.webp", y: 0 }, { src: "/themes/atelier.webp", y: 34 }],
          stores: [],
        },
      },
      { icon: "jewelry", name: bi("Jewelry", "المجوهرات"), blurb: bi("Premium presentation with secure checkout.", "عرض فاخر مع دفع آمن."), detail: null },
      { icon: "digital", name: bi("Digital products", "المنتجات الرقمية"), blurb: bi("Instant delivery for downloads, courses and licenses.", "تسليم فوري للملفات والدورات والتراخيص."), detail: null },
      { icon: "electronics", name: bi("Electronics", "الإلكترونيات"), blurb: bi("Warranty, serial tracking and fast fulfilment.", "ضمان وتتبع للأرقام التسلسلية وتجهيز سريع للطلبات."), detail: null },
      { icon: "beauty", name: bi("Beauty", "العناية والتجميل"), blurb: bi("Routines, bundles and loyalty rewards.", "روتين وباقات ومكافآت ولاء لعملائك."), detail: null },
      { icon: "home", name: bi("Home", "مستلزمات المنزل"), blurb: bi("Large catalogs with flexible shipping.", "كتالوجات كبيرة مع خيارات شحن مرنة."), detail: null },
    ],
  },
  experience: {
    title: bi("Delight your customers with an easy buying experience", "أسعد عملاءك بتجربة شراء سهلة"),
    captions: [
      bi("Buy directly, with no account needed", "شراء مباشر دون تعقيد أو إنشاء حساب"),
      bi("Familiar payment methods your customers already trust", "طرق دفع مألوفة يثق بها عملاؤك"),
      bi("Track every order, step by step, to the doorstep", "تتبّع كل طلب خطوة بخطوة حتى باب البيت"),
    ],
    login: {
      brand: bi("Perfume Store", "متجر عطور"),
      title: bi("Log in", "تسجيل الدخول"),
      label: bi("Mobile number", "رقم الجوال"),
      button: bi("Continue", "متابعة"),
      link: bi("Log in with email instead", "تسجيل الدخول بالبريد الإلكتروني"),
    },
    pay: {
      title: bi("Choose a payment method", "اختر طريقة الدفع"),
      options: [bi("Visa", "فيزا"), bi("Apple Pay", "ابل باي"), bi("CliQ", "كليك"), bi("Cash on delivery (COD)", "الدفع عند الاستلام")],
      button: bi("Pay now", "ادفع الآن"),
    },
    track: {
      title: bi("Your order is on its way", "طلبك في الطريق"),
      order: bi("Order #10428", "طلب رقم 10428"),
      steps: [bi("Confirmed", "تم التأكيد"), bi("Preparing", "قيد التجهيز"), bi("Shipped", "تم الشحن"), bi("Delivered", "تم التسليم")],
    },
  },
  features: {
    title: bi("Dukkan supports every step of your journey", "يدعمك دكان في كل خطوة من رحلتك"),
    items: [
      {
        kind: "solutions",
        anchor: "solutions",
        tag: bi("Launch", "الانطلاق"),
        title: bi("Start easy, even if you're busy", "ابدأ بسهولة حتى مع انشغالك"),
        body: bi("No experience or full-time commitment needed to start selling.", "لا تحتاج إلى خبرة سابقة أو تفرّغ كامل لتبدأ البيع."),
        points: [
          bi("Guided setup that gets you live fast", "إعداد موجَّه يجعل متجرك جاهزًا بسرعة"),
          bi("Orders, products and reports in one dashboard", "الطلبات والمنتجات والتقارير في لوحة واحدة"),
          bi("Explore a ready demo store before you start", "جرّب متجرًا تجريبيًا جاهزًا قبل أن تبدأ"),
        ],
      },
      {
        kind: "design",
        anchor: "design",
        tag: bi("Design", "التصميم"),
        title: bi("A store that stands out at first glance", "متجر يلفت النظر من أول لمحة"),
        body: bi("Design your store yourself, with no coding.", "صمّم متجرك بنفسك، بدون أي خبرة برمجية."),
        points: [
          bi("Click any element and edit it live", "اضغط على أي عنصر وعدّله مباشرة"),
          bi("Hero and website background in picture, GIF or video", "غلاف وخلفية بصورة أو GIF أو فيديو"),
          bi("Arrange your sections your way", "رتّب أقسام متجرك كما تريد"),
        ],
      },
      {
        kind: "payments",
        anchor: "payments",
        tag: bi("Payments", "المدفوعات"),
        title: bi("Secure payments, lasting trust", "مدفوعات آمنة وثقة تدوم"),
        body: bi("Manage store and customer payments with one integrated system.", "أدر مدفوعات متجرك وعملائك عبر نظام متكامل واحد."),
        points: [
          bi("Cards, wallets and local payment methods", "بطاقات ومحافظ إلكترونية ووسائل دفع محلية"),
          bi("Activate payments within a day", "فعّل المدفوعات خلال يوم واحد"),
          bi("Payouts 24 hours after each order", "تحويل المبالغ بعد 24 ساعة من كل طلب"),
        ],
      },
      {
        kind: "shipping",
        anchor: "shipping",
        tag: bi("Shipping", "الشحن"),
        title: bi("A complete shipping fleet for your products", "أسطول شحن متكامل لخدمة منتجاتك"),
        body: bi("Connect your store to carriers without contracts or friction.", "اربط متجرك بشركات الشحن بلا عقود ولا تعقيد."),
        points: [
          bi("Dukkan Ship: our own delivery at a flat price per order", "شحن دكان: توصيلنا الخاص بسعر ثابت لكل طلب"),
          bi("Already have a courier? Add them and keep working together", "لديك شركة توصيل؟ أضفها وواصل العمل معها"),
          bi("Track every order from pickup to the doorstep", "تتبّع كل طلب من الاستلام حتى باب البيت"),
        ],
      },
      {
        kind: "marketing",
        anchor: "marketing",
        tag: bi("Marketing", "التسويق"),
        title: bi("Every marketing tool in one place", "كل أدوات التسويق في مكان واحد"),
        body: bi("Reach more customers with campaigns made for your store.", "صِل إلى عملاء أكثر بحملات مصممة لمتجرك."),
        points: [
          bi("Discount coupons that close the sale", "كوبونات خصم تساعد على إتمام الشراء"),
          bi("Full control of offers and promotions", "تحكم كامل في العروض والخصومات"),
          bi("Abandoned-cart recovery and ad management", "استرجاع السلات المتروكة وإدارة الإعلانات"),
        ],
      },
    ],
  },
  testimonials: {
    title: bi("Be the next success story", "كن صاحب قصة النجاح القادمة"),
    items: [
      { quote: bi("Setup took an afternoon. Our first order came in that same night.", "استغرق الإعداد عصر يوم واحد، وجاءنا أول طلب في الليلة نفسها."), name: bi("Omar K.", "عمر ك."), role: bi("Fashion store", "متجر أزياء"), avatar: "/avatars/omar.jpg" },
      { quote: bi("Shipping and payments finally live in one dashboard. That alone saves me hours.", "أخيرًا صار الشحن والمدفوعات في لوحة واحدة، وهذا وحده يوفّر عليّ ساعات."), name: bi("Layla A.", "ليلى أ."), role: bi("Home goods", "مستلزمات منزلية"), avatar: "/avatars/layla.jpg" },
      { quote: bi("We went from a side project to a real brand without changing platform.", "انتقلنا من مشروع جانبي إلى علامة تجارية حقيقية دون أن نغيّر المنصة."), name: bi("Sara M.", "سارة م."), role: bi("Beauty brand", "علامة تجميل"), avatar: "/avatars/sara.jpg" },
      { quote: bi("Customers pay by CliQ or cash on delivery, and every order shows up in one place.", "عملاؤنا يدفعون بكليك أو عند الاستلام، وكل الطلبات تصلني في مكان واحد."), name: bi("Yazan H.", "يزن ح."), role: bi("Gifts", "متجر هدايا"), avatar: "/avatars/yazan.jpg" },
      { quote: bi("The store designer let me change the look myself, without calling anyone.", "مصمم المتجر سمح لي بتغيير الشكل بنفسي دون أن أتصل بأحد."), name: bi("Ahmad S.", "أحمد س."), role: bi("Jewelry", "متجر مجوهرات"), avatar: "/avatars/ahmad.jpg" },
      { quote: bi("The reports show me which products get left in carts, so I know who to remind.", "التقارير تُريني المنتجات التي تُترك في السلات، فأعرف لمن أرسل التذكير."), name: bi("Noor S.", "نور س."), role: bi("Electronics", "متجر إلكترونيات"), avatar: "/avatars/noor.jpg" },
    ],
  },
  finalCta: {
    title: bi("Own a professional store on Dukkan", "امتلك متجرًا احترافيًا مع دكان"),
    body: bi("Create your store now with flexible tools and complete solutions to grow your sales.", "أنشئ متجرك الآن بأدوات مرنة وحلول متكاملة تساعدك على نمو مبيعاتك."),
    button: link("Create your store for free", "أنشئ متجرك مجانًا", "/signup"),
  },
  footer: {
    tagline: bi("Smart commerce for Jordan and beyond.", "تجارة ذكية للأردن وما بعده."),
    columns: [
      { title: bi("About Dukkan", "عن دكان"), links: [link("Join the Dukkan team", "انضم لفريق دكان", ""), link("Terms of use", "شروط الاستخدام", ""), link("Privacy policy", "سياسة الخصوصية", "")] },
      { title: bi("Resources", "الموارد"), links: [link("Help center", "مركز المساعدة", ""), link("FAQ", "الأسئلة الشائعة", ""), link("Contact us", "تواصل معنا", SUPPORT_EMAIL)] },
    ],
    industriesTitle: bi("Industries", "القطاعات"),
    availableIn: bi("Available in:", "متاح في:"),
    country: bi("Jordan", "الأردن"),
    legal: bi("© 2026 Dukkan. All rights reserved. Prototype, not a live service.", "© 2026 دكان. جميع الحقوق محفوظة. نموذج أولي وليس خدمة فعلية."),
    payments: [
      { name: "Visa", src: "/logos/visa.png", height: 16, invertInDark: false },
      { name: "Apple Pay", src: "/logos/applepay.png", height: 18, invertInDark: true },
      { name: "CliQ", src: "/logos/cliq-tight.png", height: 22, invertInDark: true },
    ],
  },
  social: [
    { kind: "tiktok", href: "" },
    { kind: "x", href: "" },
    { kind: "youtube", href: "" },
    { kind: "instagram", href: "" },
  ],
  contact: { place: bi("Amman, Jordan", "عمّان، الأردن") },
  legal: {
    number: "016703",
    url: "https://ccr.mit.gov.jo/mitq/faces/HomePage",
    verified: bi("Verified with a commercial registration", "موثق بسجل تجاري"),
    label: bi("Commercial registration number", "رقم السجل التجاري"),
    tag: bi("Reliability", "موثوقية"),
    title: bi("A registered company you can check", "شركة مسجّلة يمكنك التحقق منها"),
    sub: bi(
      "Dukkan is a registered Jordanian company. Our commercial registration is public, and you can look it up yourself.",
      "دكان شركة أردنية مسجّلة. سجلنا التجاري معلن، ويمكنك التحقق منه بنفسك.",
    ),
    check: bi("Check the registration", "تحقق من السجل"),
    cards: [
      {
        title: bi("Commercial registration", "سجل تجاري"),
        body: bi(
          "Registered with the Ministry of Industry and Trade. You can check our registration on the ministry's own register.",
          "مسجّلة لدى وزارة الصناعة والتجارة والتموين. يمكنك التحقق من تسجيلنا في سجل الوزارة نفسه.",
        ),
      },
      {
        title: bi("Based in Jordan", "مقرّنا في الأردن"),
        body: bi(
          "Our team and our office are in Amman, so you deal with a company that is close to you, in your own language.",
          "فريقنا ومكتبنا في عمّان، فتتعامل مع شركة قريبة منك وبلغتك.",
        ),
      },
      {
        title: bi("A real team to talk to", "فريق حقيقي تتحدث معه"),
        body: bi("Call or write to us at any time. Our contact details are on every page.", "اتصل بنا أو راسلنا في أي وقت. بيانات التواصل معنا في كل صفحة."),
      },
    ],
  },
  seo: {
    title: bi("Dukkan | Launch your online store in minutes", "دكان | أطلق متجرك الإلكتروني في دقائق"),
    description: bi(
      "Dukkan is the all-in-one e-commerce platform: store builder, payments, shipping, marketing and more.",
      "دكان منصة التجارة الإلكترونية المتكاملة: إنشاء المتجر والمدفوعات والشحن والتسويق والمزيد.",
    ),
  },
};

/* ---------------- links and pictures ---------------- */

/** Whether a link leaves Dukkan's site, so it opens in a new tab */
export const isOutside = (href: string) => /^https?:\/\//i.test(href);

/** The attributes of a link: one that leaves the site opens in a new tab, without giving that site a hold on this page */
export const linkAttrs = (href: string) => (isOutside(href) ? { href, target: "_blank", rel: "noreferrer" } : { href });

/** The headline is three parts (before, the highlighted words, after) with a space between two parts; a part that starts
    with a punctuation mark (a full stop, a comma, "!") sticks to the part before it. Gives the space to put between a and b. */
export function partGap(a: string, b: string): string {
  if (!a || !b) return "";
  return /^[.,!?؟،؛:;)»]/.test(b) ? "" : " ";
}

/* ---------------- one language ---------------- */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** The same shape with every { en, ar } pair turned into the text of one language */
export type Localized<T> = T extends Bi ? string : T extends (infer U)[] ? Localized<U>[] : T extends object ? { [K in keyof T]: Localized<T[K]> } : T;

const isBi = (v: unknown): v is Bi => isObj(v) && typeof v.en === "string" && typeof v.ar === "string" && Object.keys(v).length === 2;

export function localize<T>(v: T, lang: "en" | "ar"): Localized<T> {
  if (isBi(v)) return v[lang] as Localized<T>;
  if (Array.isArray(v)) return v.map((x) => localize(x, lang)) as Localized<T>;
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, localize(x, lang)])) as Localized<T>;
  return v as Localized<T>;
}
export type SiteView = Localized<SiteContent>;
