import { cleanEmail, cleanLine } from "./safe";

/* The words, links and pictures of Dukkan's own landing page (the page at "/"), which the team edits in Diwan
   (Diwan > Website) without a code change. They are kept in one platform_settings row, 'site_content', as JSON.

   Plain TypeScript with no browser or server APIs: the Diwan route cleans what staff send with cleanSiteContent, the
   public route cleans what it reads with the same function (so an old or broken row can never put bad links on the
   page), and the page itself starts from SITE_DEFAULTS. SITE_DEFAULTS are the texts the page had before it could be
   edited, so the page looks the same until someone saves something. */

export type Bi = { en: string; ar: string };
/** A link: its words in both languages and where it goes. An empty `href` hides the link instead of a dead "#". */
export type SiteLink = { label: Bi; href: string };

/* The pictures each industry, feature and social link can have. They are drawn in code (components/Sections.tsx), so staff
   pick one by name rather than upload a drawing. */
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
  /* whatsapp: Dukkan support's WhatsApp number, shown where a merchant needs help (the suspended-store page); empty hides it */
  contact: { phone: string; place: Bi; email: string; whatsapp: string };
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
export type SiteSection = keyof SiteContent;
export const SITE_SECTIONS = ["nav", "hero", "industries", "experience", "features", "testimonials", "finalCta", "footer", "social", "contact", "legal", "seo"] as const satisfies readonly SiteSection[];

export const SITE_LIMITS = {
  line: 120,
  title: 160,
  text: 400,
  href: 300,
  navLinks: 6,
  resourceLinks: 8,
  industries: 12,
  bullets: 5,
  shots: 2,
  stores: 4,
  features: 8,
  points: 6,
  testimonials: 12,
  columns: 3,
  columnLinks: 10,
  payments: 8,
  social: SOCIAL_KINDS.length,
  seoTitle: 120,
  seoDescription: 300,
  phone: 20,
  number: 30,
};

const bi = (en: string, ar: string): Bi => ({ en, ar });
const link = (en: string, ar: string, href: string): SiteLink => ({ label: bi(en, ar), href });

/** Today's landing page, word for word. Links that pointed nowhere ("#") have an empty address, so they stay hidden until
    someone gives them one in Diwan. */
export const SITE_DEFAULTS: SiteContent = {
  nav: {
    links: [link("Solutions", "الحلول", "#solutions"), link("Industries", "القطاعات", "#industries"), link("Themes", "الثيمات", "#design")],
    resources: bi("Resources", "الموارد"),
    resourceLinks: [link("Help center", "مركز المساعدة", ""), link("FAQ", "الأسئلة الشائعة", ""), link("Contact us", "تواصل معنا", "mailto:hello@dukkan.store")],
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
          shots: [{ src: "/themes/lamma.jpg?v=3", y: 0 }, { src: "/themes/lamma-product.jpg", y: 0 }],
          stores: [
            { src: "/themes/mada.jpg?v=4", address: "dukkan.store/your-store", view: "/store?theme=mada" },
            { src: "/themes/lamma.jpg?v=3", address: "dukkan.store/your-store", view: "/store?theme=lamma" },
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
          shots: [{ src: "/themes/atelier.jpg?v=2x", y: 0 }, { src: "/themes/atelier.jpg?v=2x", y: 34 }],
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
      { title: bi("Resources", "الموارد"), links: [link("Help center", "مركز المساعدة", ""), link("FAQ", "الأسئلة الشائعة", ""), link("Contact us", "تواصل معنا", "mailto:hello@dukkan.store")] },
    ],
    industriesTitle: bi("Industries", "القطاعات"),
    availableIn: bi("Available in:", "متاح في:"),
    country: bi("Jordan", "الأردن"),
    legal: bi("© 2026 Dukkan. All rights reserved. Prototype, not a live service.", "© 2026 دكان. جميع الحقوق محفوظة. نموذج أولي وليس خدمة فعلية."),
    payments: [
      { name: "Visa", src: "/logos/visa.png", height: 16, invertInDark: false },
      { name: "Apple Pay", src: "/logos/applepay.png", height: 18, invertInDark: true },
      { name: "CliQ", src: "/logos/cliq-tight.png", height: 22, invertInDark: true },
      { name: "PayPal", src: "/logos/paypal.png", height: 14, invertInDark: false },
    ],
  },
  social: [
    { kind: "tiktok", href: "" },
    { kind: "x", href: "" },
    { kind: "youtube", href: "" },
    { kind: "instagram", href: "" },
  ],
  contact: { phone: "+962 6 000 0000", place: bi("Amman, Jordan", "عمّان، الأردن"), email: "hello@dukkan.store", whatsapp: "" },
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

/* A path on Dukkan's own site: starts with one "/" (never "//", which would be another site), no backslashes, no spaces
   and no quotes or angle brackets. */
const SAME_SITE = /^\/(?![/\\])[^\s<>"'`\\]*$/;
const ANCHOR = /^#[A-Za-z][\w-]{0,40}$/;

/** Where a link may go: a page of this site ("/signup", "#industries"), a web address (http or https), an email
    (mailto:) or a phone number (tel:). Gives "" for an empty value and null for anything else (javascript:, data:,
    "//other.site", a bare "#"...). */
export function cleanHref(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return "";
  // eslint-disable-next-line no-control-regex
  if (s.length > SITE_LIMITS.href || /[\u0000-\u001f\u007f]/.test(s)) return null;
  if (SAME_SITE.test(s) || ANCHOR.test(s)) return s;
  if (/^mailto:/i.test(s)) return /^mailto:[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`?]{2,}(\?[^\s<>"'`]*)?$/i.test(s) ? s : null;
  if (/^tel:/i.test(s)) return /^tel:\+?[\d-]{3,20}$/i.test(s.replace(/[\s()]/g, "")) ? `tel:${s.slice(4).replace(/[\s()]/g, "")}` : null;
  if (!/^https?:\/\//i.test(s)) return null;
  try {
    const u = new URL(s);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || u.username || u.password || !u.hostname.includes(".")) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** A picture: a file of this site ("/logos/visa.png") or an https address. "" for empty, null for anything else. */
export function cleanSrc(v: unknown): string | null {
  const h = cleanHref(v);
  if (h === null || h === "") return h;
  if (SAME_SITE.test(h)) return h;
  return h.startsWith("https://") ? h : null;
}

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

/* ---------------- cleaning ---------------- */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/* Cleans one value against the default it replaces. Every part is checked on its own: a part that is missing or of the
   wrong kind keeps its default, so one bad field never blanks a whole section. `bad` collects the paths of the parts that
   were sent but could not be used, so Diwan can say which field to fix (a read from the database ignores it). */
class Cleaner {
  bad: string[] = [];

  note(path: string) {
    if (this.bad.length < 50) this.bad.push(path);
  }

  /** A line of text. `required` texts may not be empty (a title with no words would leave a hole in the page). */
  text(v: unknown, def: string, path: string, max: number = SITE_LIMITS.line, required = true): string {
    if (v === undefined) return def;
    if (typeof v !== "string") return this.note(path), def;
    const s = cleanLine(v, max);
    if (!s && required) return this.note(path), def;
    return s;
  }

  bi(v: unknown, def: Bi, path: string, max: number = SITE_LIMITS.line, required = true): Bi {
    if (v === undefined) return def;
    if (!isObj(v)) return this.note(path), def;
    return { en: this.text(v.en, def.en, `${path}.en`, max, required), ar: this.text(v.ar, def.ar, `${path}.ar`, max, required) };
  }

  href(v: unknown, def: string, path: string): string {
    if (v === undefined) return def;
    const h = cleanHref(v);
    if (h === null) return this.note(path), def;
    return h;
  }

  src(v: unknown, def: string, path: string, required = false): string {
    if (v === undefined) return def;
    const h = cleanSrc(v);
    if (h === null || (required && !h)) return this.note(path), def;
    return h;
  }

  link(v: unknown, def: SiteLink, path: string): SiteLink {
    if (v === undefined) return def;
    if (!isObj(v)) return this.note(path), def;
    return { label: this.bi(v.label, def.label, `${path}.label`), href: this.href(v.href, def.href, `${path}.href`) };
  }

  oneOf<T extends string>(v: unknown, list: readonly T[], def: T, path: string): T {
    if (v === undefined) return def;
    if (typeof v === "string" && (list as readonly string[]).includes(v)) return v as T;
    return this.note(path), def;
  }

  num(v: unknown, def: number, min: number, max: number, path: string): number {
    if (v === undefined) return def;
    if (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max) return Math.round(v);
    return this.note(path), def;
  }

  /** A list staff can grow and shrink. Items past `max` are dropped; an item that is not an object is dropped too. New
      items have no default of their own, so each one is cleaned against `blank`, the shape of an empty item. */
  list<T>(v: unknown, def: T[], max: number, path: string, item: (x: Obj, i: number, base: T) => T | null, blank: (i: number) => T): T[] {
    if (v === undefined) return def;
    if (!Array.isArray(v)) return this.note(path), def;
    if (v.length > max) this.note(path);
    const out: T[] = [];
    v.slice(0, max).forEach((x, i) => {
      if (!isObj(x)) return this.note(`${path}.${i}`);
      const r = item(x, i, blank(i));
      if (r !== null) out.push(r);
    });
    return out;
  }

  /** A list whose length is fixed by the page's drawing (three captions under three pictures, four payment rows...):
      each place is cleaned against the default in that place. */
  fixed(v: unknown, def: Bi[], path: string): Bi[] {
    if (v === undefined) return def;
    if (!Array.isArray(v)) return this.note(path), def;
    return def.map((d, i) => this.bi(v[i], d, `${path}.${i}`));
  }
}

const B = (): Bi => ({ en: "", ar: "" });
const L = (): SiteLink => ({ label: B(), href: "" });

/** Checks site content from Diwan or the database. Always gives a whole, safe SiteContent: each part that is missing or
    can't be used is today's text. `bad` lists the parts that were sent but could not be used. */
export function cleanSiteContent(input: unknown): { content: SiteContent; bad: string[] } {
  const c = new Cleaner();
  const v: Obj = isObj(input) ? input : {};
  if (input !== undefined && input !== null && !isObj(input)) c.note("content");
  const D = SITE_DEFAULTS;
  const sec = (k: SiteSection): Obj | undefined => {
    const x = v[k];
    if (x === undefined) return undefined;
    if (!isObj(x)) return c.note(k), undefined;
    return x;
  };
  const M = SITE_LIMITS;
  /* a link in a list: one with neither words nor an address is an empty row left in the form, and is dropped */
  const listLink = (path: string) => (x: Obj, i: number, base: SiteLink) => {
    const l = c.link(x, base, `${path}.${i}`);
    return !l.label.en && !l.label.ar && !l.href ? null : l;
  };

  const nav = sec("nav") ?? {};
  const hero = sec("hero") ?? {};
  const ind = sec("industries") ?? {};
  const exp = sec("experience") ?? {};
  const feat = sec("features") ?? {};
  const test = sec("testimonials") ?? {};
  const fin = sec("finalCta") ?? {};
  const foot = sec("footer") ?? {};
  const contact = sec("contact") ?? {};
  const legal = sec("legal") ?? {};
  const seo = sec("seo") ?? {};
  const sub = (o: Obj, k: string, path: string): Obj => {
    const x = o[k];
    if (x === undefined) return {};
    if (!isObj(x)) return c.note(path), {};
    return x;
  };

  const anchors = new Set<string>();
  const content: SiteContent = {
    nav: {
      links: c.list(nav.links, D.nav.links, M.navLinks, "nav.links", listLink("nav.links"), L),
      resources: c.bi(nav.resources, D.nav.resources, "nav.resources"),
      resourceLinks: c.list(nav.resourceLinks, D.nav.resourceLinks, M.resourceLinks, "nav.resourceLinks", listLink("nav.resourceLinks"), L),
      login: c.link(nav.login, D.nav.login, "nav.login"),
      start: c.link(nav.start, D.nav.start, "nav.start"),
    },
    hero: {
      before: c.bi(hero.before, D.hero.before, "hero.before", M.line, false),
      highlight: c.bi(hero.highlight, D.hero.highlight, "hero.highlight", M.line, false),
      after: c.bi(hero.after, D.hero.after, "hero.after", M.line, false),
      sub: c.bi(hero.sub, D.hero.sub, "hero.sub", M.text, false),
      cta1: c.link(hero.cta1, D.hero.cta1, "hero.cta1"),
      cta2: c.link(hero.cta2, D.hero.cta2, "hero.cta2"),
      note: c.bi(hero.note, D.hero.note, "hero.note", M.line, false),
    },
    industries: {
      title: c.bi(ind.title, D.industries.title, "industries.title", M.title),
      finale: c.bi(ind.finale, D.industries.finale, "industries.finale", M.title),
      items: c.list(
        ind.items,
        D.industries.items,
        M.industries,
        "industries.items",
        (x, i, base) => {
          const p = `industries.items.${i}`;
          const d = x.detail;
          let detail: IndustryDetail | null = null;
          if (isObj(d)) {
            const dd: IndustryDetail = { title: B(), body: B(), bullets: [], shots: [], stores: [] };
            detail = {
              title: c.bi(d.title, dd.title, `${p}.detail.title`, M.title),
              body: c.bi(d.body, dd.body, `${p}.detail.body`, M.text),
              bullets: c.list(d.bullets, [], M.bullets, `${p}.detail.bullets`, (b, j) => c.bi(b, B(), `${p}.detail.bullets.${j}`), B),
              shots: c.list(d.shots, [], M.shots, `${p}.detail.shots`, (s, j) => ({ src: c.src(s.src, "", `${p}.detail.shots.${j}.src`, true), y: c.num(s.y, 0, 0, 100, `${p}.detail.shots.${j}.y`) }), () => ({ src: "", y: 0 })),
              stores: c.list(
                d.stores,
                [],
                M.stores,
                `${p}.detail.stores`,
                (s, j) => ({
                  src: c.src(s.src, "", `${p}.detail.stores.${j}.src`, true),
                  address: c.text(s.address, "dukkan.store/your-store", `${p}.detail.stores.${j}.address`, 60),
                  view: c.href(s.view, "", `${p}.detail.stores.${j}.view`),
                }),
                () => ({ src: "", address: "", view: "" }),
              ),
            };
            /* a picture that failed its check is dropped rather than shown broken */
            detail.shots = detail.shots.filter((s) => s.src);
            detail.stores = detail.stores.filter((s) => s.src);
          } else if (d !== undefined && d !== null) c.note(`${p}.detail`);
          return {
            icon: c.oneOf(x.icon, INDUSTRY_ICONS, base.icon, `${p}.icon`),
            name: c.bi(x.name, base.name, `${p}.name`, 40),
            blurb: c.bi(x.blurb, base.blurb, `${p}.blurb`, M.title),
            detail,
          };
        },
        () => ({ icon: "store", name: B(), blurb: B(), detail: null }),
      ),
    },
    experience: (() => {
      const login = sub(exp, "login", "experience.login");
      const pay = sub(exp, "pay", "experience.pay");
      const track = sub(exp, "track", "experience.track");
      const E = D.experience;
      return {
        title: c.bi(exp.title, E.title, "experience.title", M.title),
        captions: c.fixed(exp.captions, E.captions, "experience.captions"),
        login: {
          brand: c.bi(login.brand, E.login.brand, "experience.login.brand", 40),
          title: c.bi(login.title, E.login.title, "experience.login.title", 40),
          label: c.bi(login.label, E.login.label, "experience.login.label", 40),
          button: c.bi(login.button, E.login.button, "experience.login.button", 40),
          link: c.bi(login.link, E.login.link, "experience.login.link", 60),
        },
        pay: {
          title: c.bi(pay.title, E.pay.title, "experience.pay.title", 60),
          options: c.fixed(pay.options, E.pay.options, "experience.pay.options"),
          button: c.bi(pay.button, E.pay.button, "experience.pay.button", 40),
        },
        track: {
          title: c.bi(track.title, E.track.title, "experience.track.title", 60),
          order: c.bi(track.order, E.track.order, "experience.track.order", 40),
          steps: c.fixed(track.steps, E.track.steps, "experience.track.steps"),
        },
      };
    })(),
    features: {
      title: c.bi(feat.title, D.features.title, "features.title", M.title),
      items: c.list(
        feat.items,
        D.features.items,
        M.features,
        "features.items",
        (x, i, base) => {
          const p = `features.items.${i}`;
          let anchor = typeof x.anchor === "string" ? x.anchor.trim().toLowerCase() : base.anchor;
          if (anchor && !/^[a-z][a-z0-9-]{0,30}$/.test(anchor)) {
            c.note(`${p}.anchor`);
            anchor = "";
          }
          /* two features can't share a place on the page; the second simply has none */
          if (anchor && anchors.has(anchor)) anchor = "";
          if (anchor) anchors.add(anchor);
          return {
            kind: c.oneOf(x.kind, FEATURE_KINDS, base.kind, `${p}.kind`),
            anchor,
            tag: c.bi(x.tag, base.tag, `${p}.tag`, 40),
            title: c.bi(x.title, base.title, `${p}.title`, M.title),
            body: c.bi(x.body, base.body, `${p}.body`, M.text),
            points: c.list(x.points, base.points, M.points, `${p}.points`, (b, j) => c.bi(b, B(), `${p}.points.${j}`), B),
          };
        },
        () => ({ kind: "solutions", anchor: "", tag: B(), title: B(), body: B(), points: [] }),
      ),
    },
    testimonials: {
      title: c.bi(test.title, D.testimonials.title, "testimonials.title", M.title),
      items: c.list(
        test.items,
        D.testimonials.items,
        M.testimonials,
        "testimonials.items",
        (x, i, base) => {
          const p = `testimonials.items.${i}`;
          return {
            quote: c.bi(x.quote, base.quote, `${p}.quote`, M.text),
            name: c.bi(x.name, base.name, `${p}.name`, 60),
            role: c.bi(x.role, base.role, `${p}.role`, 60, false),
            avatar: c.src(x.avatar, base.avatar, `${p}.avatar`),
          };
        },
        () => ({ quote: B(), name: B(), role: B(), avatar: "" }),
      ),
    },
    finalCta: {
      title: c.bi(fin.title, D.finalCta.title, "finalCta.title", M.title),
      body: c.bi(fin.body, D.finalCta.body, "finalCta.body", M.text, false),
      button: c.link(fin.button, D.finalCta.button, "finalCta.button"),
    },
    footer: {
      tagline: c.bi(foot.tagline, D.footer.tagline, "footer.tagline", M.title, false),
      columns: c.list(
        foot.columns,
        D.footer.columns,
        M.columns,
        "footer.columns",
        (x, i, base) => ({
          title: c.bi(x.title, base.title, `footer.columns.${i}.title`, 60),
          links: c.list(x.links, base.links, M.columnLinks, `footer.columns.${i}.links`, listLink(`footer.columns.${i}.links`), L),
        }),
        () => ({ title: B(), links: [] }),
      ),
      industriesTitle: c.bi(foot.industriesTitle, D.footer.industriesTitle, "footer.industriesTitle", 60),
      availableIn: c.bi(foot.availableIn, D.footer.availableIn, "footer.availableIn", 60, false),
      country: c.bi(foot.country, D.footer.country, "footer.country", 60, false),
      legal: c.bi(foot.legal, D.footer.legal, "footer.legal", M.title, false),
      payments: c.list(
        foot.payments,
        D.footer.payments,
        M.payments,
        "footer.payments",
        (x, i, base) => {
          const p = `footer.payments.${i}`;
          const r = { name: c.text(x.name, base.name, `${p}.name`, 40), src: c.src(x.src, base.src, `${p}.src`, true), height: c.num(x.height, base.height, 10, 32, `${p}.height`), invertInDark: typeof x.invertInDark === "boolean" ? x.invertInDark : base.invertInDark };
          return r.src ? r : null;
        },
        () => ({ name: "", src: "", height: 18, invertInDark: false }),
      ),
    },
    social: (() => {
      const seen = new Set<SocialKind>();
      return c.list(
        v.social,
        D.social,
        M.social,
        "social",
        (x, i) => {
          const kind = c.oneOf(x.kind, SOCIAL_KINDS, "tiktok", `social.${i}.kind`);
          /* one link per network */
          if (seen.has(kind)) return c.note(`social.${i}.kind`), null;
          seen.add(kind);
          return { kind, href: c.href(x.href, "", `social.${i}.href`) };
        },
        () => ({ kind: "tiktok" as SocialKind, href: "" }),
      );
    })(),
    contact: {
      phone: (() => {
        if (contact.phone === undefined) return D.contact.phone;
        const s = cleanLine(contact.phone, M.phone);
        if (s && !/^\+?[\d ]{6,20}$/.test(s)) return c.note("contact.phone"), D.contact.phone;
        return s;
      })(),
      place: c.bi(contact.place, D.contact.place, "contact.place", 80, false),
      /* a phone number like the one above (it becomes a wa.me link), nothing by default */
      whatsapp: (() => {
        if (contact.whatsapp === undefined) return D.contact.whatsapp;
        const s = cleanLine(contact.whatsapp, M.phone);
        if (s && !/^\+?[\d ]{6,20}$/.test(s)) return c.note("contact.whatsapp"), D.contact.whatsapp;
        return s;
      })(),
      email: (() => {
        if (contact.email === undefined) return D.contact.email;
        if (typeof contact.email === "string" && !contact.email.trim()) return "";
        const e = cleanEmail(contact.email);
        return e || (c.note("contact.email"), D.contact.email);
      })(),
    },
    legal: (() => {
      const L0 = D.legal;
      const number = (() => {
        if (legal.number === undefined) return L0.number;
        const s = cleanLine(legal.number, M.number);
        if (s && !/^[\w\-/ ]{1,30}$/.test(s)) return c.note("legal.number"), L0.number;
        return s;
      })();
      return {
        number,
        url: c.href(legal.url, L0.url, "legal.url"),
        verified: c.bi(legal.verified, L0.verified, "legal.verified", 80),
        label: c.bi(legal.label, L0.label, "legal.label", 80),
        tag: c.bi(legal.tag, L0.tag, "legal.tag", 40),
        title: c.bi(legal.title, L0.title, "legal.title", M.title),
        sub: c.bi(legal.sub, L0.sub, "legal.sub", M.text, false),
        check: c.bi(legal.check, L0.check, "legal.check", 60),
        cards: L0.cards.map((d, i) => {
          const x = Array.isArray(legal.cards) ? legal.cards[i] : undefined;
          if (legal.cards !== undefined && !Array.isArray(legal.cards)) c.note("legal.cards");
          const o = isObj(x) ? x : {};
          return { title: c.bi(o.title, d.title, `legal.cards.${i}.title`, 80), body: c.bi(o.body, d.body, `legal.cards.${i}.body`, M.text) };
        }),
      };
    })(),
    seo: {
      title: c.bi(seo.title, D.seo.title, "seo.title", M.seoTitle),
      description: c.bi(seo.description, D.seo.description, "seo.description", M.seoDescription),
    },
  };
  return { content, bad: c.bad };
}

/** The parts that differ between two versions, as paths ("hero.highlight", "footer.columns"), for the activity log: it
    keeps which parts changed, not the words themselves. */
export function changedParts(a: SiteContent, b: SiteContent): string[] {
  const out: string[] = [];
  for (const k of SITE_SECTIONS) {
    const x = a[k] as unknown;
    const y = b[k] as unknown;
    if (JSON.stringify(x) === JSON.stringify(y)) continue;
    if (isObj(x) && isObj(y)) {
      for (const f of Object.keys({ ...x, ...y })) if (JSON.stringify(x[f]) !== JSON.stringify(y[f])) out.push(`${k}.${f}`);
    } else out.push(k);
  }
  return out;
}

/* ---------------- one language ---------------- */

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
