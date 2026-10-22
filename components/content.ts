/* Page content in both languages. Short UI strings (nav, hero headline,
   buttons) live in Prefs.tsx, the rest of the page lives here. */

export type Lang = "en" | "ar";

/**
 * Locale for every date and time on the site. Always the Gregorian calendar
 * (never Hijri) with Latin digits. "ar-EG" gives the month names يناير ... ديسمبر
 * (أكتوبر, نوفمبر), not the Levantine ones such as تشرين الأول.
 */
export const dateLocale = (lang: Lang) => (lang === "ar" ? "ar-EG-u-ca-gregory-nu-latn" : "en-GB-u-ca-gregory");

/** The brand is "Dukkan" in English and "دكان" in Arabic. */
export const brandName = (lang: Lang) => (lang === "ar" ? "دكان" : "Dukkan");

/** One card on a report page. The kind decides how it is drawn. */
export type ReportWidget = {
  id: string;
  kind: "stat" | "rate" | "list" | "breakdown" | "ratelist";
  unit?: "count" | "money" | "decimal";
  title: string;
  desc: string;
  formula?: string[];
  items?: string[];
  tone?: "primary" | "good" | "bad";
  badge?: boolean;
  /** For "rate" cards: the range sample data should fall in (percent). */
  rateRange?: [number, number];
};

type Feature = { id: string; tag: string; title: string; body: string; points: string[] };

export type Content = {
  dashboard: {
    revenueLabel: string;
    revenue: string;
    storeLabel: string;
    orders: { name: string; total: string; status: string }[];
    products: { name: string; price: string }[];
  };
  experience: {
    title: string;
    captions: string[];
    login: { brand: string; title: string; label: string; code: string; placeholder: string; button: string; link: string };
    pay: { title: string; options: string[]; button: string };
    track: { title: string; order: string; steps: string[] };
  };
  signup: {
    tabs: { login: string; create: string };
    fullName: string;
    fullNamePh: string;
    email: string;
    emailPh: string;
    phone: string;
    phonePh: string;
    password: string;
    passwordPh: string;
    showPassword: string;
    hidePassword: string;
    register: string;
    loginBtn: string;
    loginId: string;
    loginIdPh: string;
    forgot: string;
    or: string;
    guest: string;
    terms: { before: string; terms: string; and: string; privacy: string };
    side: { kicker: string; heading: string; panelTitle: string; steps: string[]; caption: string };
  };
  onboarding: {
    nav: string[];
    summary: string;
    title: string;
    tasks: { title: string; action: string }[];
    edit: string;
    back: string;
    comingSoon: string;
    step: string;
    previewHint: string;
    defaultName: string;
    fromLogo: string;
    pickColor: string;
    hexLabel: string;
    hexHint: string;
    hexInvalid: string;
    nameLabel: string;
    nameHint: string;
    namePh: string;
    descLabel: string;
    descHint: string;
    descPh: string;
    optional: string;
    logoLabel: string;
    logoHint: string;
    logoUpload: string;
    logoRemove: string;
    colorLabel: string;
    colorHint: string;
    save: string;
    product: {
      typeQuestion: string;
      types: { title: string; desc: string }[];
      dataTitle: string;
      imageAdd: string;
      imageBrowse: string;
      imageHint: string;
      imageTooBig: string;
      imageRemove: string;
      nameLabel: string;
      namePh: string;
      priceLabel: string;
      pricePh: string;
      currency: string;
      shippingLabel: string;
      needsShipping: string;
      noShipping: string;
      weightLabel: string;
      weightPh: string;
      kg: string;
      quantityLabel: string;
      quantityPh: string;
      unlimited: string;
      limited: string;
      previewEmpty: string;
      previewMobile: string;
      previewDesktop: string;
      productDefault: string;
      addToCart: string;
      buyNow: string;
      add: string;
    };
    shipping: {
      label: string;
      hint: string;
      whoLabel: string;
      kinds: string[];
      nameLabels: string[];
      namePhs: string[];
      phoneLabel: string;
      phoneHint: string;
      phoneInvalid: string;
      proofLabel: string;
      proofHint: string;
      proofAdd: string;
      proofLimit: string;
      proofTooBig: string;
      proofType: string;
      proofMax: string;
      localNote: string;
      remove: string;
      previewHint: string;
      previewName: string;
      proofAttached: string;
      noProof: string;
      modeTitle: string;
      pickupLabel: string;
      pickupHint: string;
      modes: { title: string; desc: string }[];
      seenName: string;
      price: string;
      perOrder: string;
      priceNote: string;
      change: string;
      cityLabel: string;
      cityPh: string;
      cities: string[];
      addressLabel: string;
      addressPh: string;
      features: string[];
      previewSeen: string;
      errCity: string;
    };
    service: { label: string; hint: string; phoneLabel: string; phonePh: string; invalid: string; previewHint: string; contact: string; useSame: string; registered: string; otherLabel: string };
    domain: {
      label: string;
      hint: string;
      prefix: string;
      ph: string;
      examples: string;
      invalid: string;
      previewHint: string;
      suggest: string;
      fallback: string;
    };
  };
  reports: {
    menu: string[];
    createReport: string;
    sidebarTitle: string;
    sections: string[];
    manage: string;
    ranges: string[];
    cards: string[];
    recommended: string;
    refresh: string;
    updated: string;
    summary: string;
    rows: string[];
    sampleToggle: string;
    sampleNote: string;
    soon: string;
    currency: string;
    abandoned: { cards: string[]; rows: string[]; empty: string };
    noData: string;
    widgets: Record<"orders" | "customers" | "visits" | "payments" | "inventory", ReportWidget[]>;
    help: Record<"totalSales" | "netSales" | "netProfit" | "totalCosts" | "discounts" | "cogs" | "shipping" | "taxes" | "fees" | "abandoned" | "lostRevenue" | "recovery" | "topProducts", { title: string; desc: string; formula?: string[] }>;
  };
  home: {
    pageTitle: string;
    summaryTab: string;
    welcome: string;
    welcomeNoName: string;
    welcomeSub: string;
    setupTitle: string;
    setupDone: string;
    setupProgress: string;
    setupCta: string;
    summaryTitle: string;
    daily: string;
    monthly: string;
    visits: string;
    netSales: string;
    orders: string;
    totalOrders: string;
    chartLabel: string;
    viewReports: string;
    goalTitle: string;
    goalHint: string;
    goalBtn: string;
    goalLabel: string;
    goalSave: string;
    goalChange: string;
    lastHourTitle: string;
    empty: string;
    emptyVisits: string;
    latestTitle: string;
    emptyOrders: string;
    latestSample: { name: string; total: string; status: string }[];
    cartsTitle: string;
    cartsCount: string;
    cartsLost: string;
    cartsLink: string;
  };
  marketing: {
    menu: string[];
    tabs: string[];
    title: string;
    sub: string;
    cards: string[];
    viewFull: string;
    search: string;
    status: string[];
    export: string;
    columns: string;
    cols: string[];
    created: string;
    ago: string;
    items: string;
    sent: string;
    notSent: string;
    remind: string;
    notice: string;
    empty: string;
    emptyHint: string;
    noMatch: string;
    names: string[];
  };
  coupons: {
    tabs: string[];
    newCoupon: string;
    types: { title: string; desc: string }[];
    title: string;
    search: string;
    export: string;
    statuses: string[];
    cols: string[];
    noEnd: string;
    startsNow: string;
    freeShipping: string;
    used: string;
    copy: string;
    copied: string;
    edit: string;
    del: string;
    confirmDel: string;
    empty: string;
    emptyHint: string;
    loadSample: string;
    noMatch: string;
    sampleNames: string[];
    form: {
      createTitle: string;
      editTitle: string;
      name: string;
      namePh: string;
      code: string;
      prefix: string;
      generate: string;
      kind: string;
      percent: string;
      fixed: string;
      value: string;
      min: string;
      minHint: string;
      start: string;
      end: string;
      limit: string;
      limitHint: string;
      validDays: string;
      nextNote: string;
      shipNote: string;
      save: string;
      cancel: string;
      saved: string;
      errName: string;
      errCode: string;
      errValue: string;
      errPercent: string;
      errDates: string;
      errDays: string;
    };
  };
  sidebar: {
    collapse: string;
    expand: string;
    open: string;
    close: string;
    soon: string;
    main: string;
  };
  notifications: {
    title: string;
    markAll: string;
    tabs: string[];
    empty: string;
    viewAll: string;
    templates: Record<"welcome" | "taskDone" | "couponCreated" | "reminderSent" | "ticketCreated", string>;
  };
  support: {
    title: string;
    newTicket: string;
    cols: string[];
    categories: string[];
    statuses: string[];
    subject: string;
    subjectPh: string;
    category: string;
    message: string;
    messagePh: string;
    send: string;
    cancel: string;
    close: string;
    reopen: string;
    empty: string;
    emptyHint: string;
    note: string;
    errSubject: string;
    errMessage: string;
  };
  settings: {
    tab: string;
    group: string;
    entries: string[];
    back: string;
    save: string;
    saved: string;
    account: {
      title: string;
      name: string;
      phone: string;
      email: string;
      dob: string;
      gender: string;
      male: string;
      female: string;
      country: string;
      countries: string[];
      city: string;
      cityPh: string;
    };
    password: {
      title: string;
      current: string;
      next: string;
      confirm: string;
      ph: string;
      note: string;
    };
    errors: {
      name: string;
      email: string;
      phone: string;
      dob: string;
      current: string;
      short: string;
      mismatch: string;
    };
  };
  featuresTitle: string;
  features: Feature[];
  testimonialsTitle: string;
  quotes: { q: string; n: string; s: string }[];
  finalCta: { title: string; body: string };
  footer: {
    tagline: string;
    cols: { title: string; links: string[] }[];
    industriesTitle: string;
    availableIn: string;
    country: string;
    contact: { phone: string; place: string; email: string };
    social: string[];
    legal: string;
  };
};

export const content: Record<Lang, Content> = {
  en: {
    dashboard: {
      revenueLabel: "Revenue this month",
      revenue: "JOD 48,339",
      storeLabel: "Your store",
      orders: [
        { name: "Layla A.", total: "JOD 128", status: "Paid" },
        { name: "Omar K.", total: "JOD 245", status: "Pending" },
        { name: "Noor S.", total: "JOD 96", status: "Shipped" },
      ],
      products: [
        { name: "Daily Backpack", price: "JOD 34" },
        { name: "Steel Bottle", price: "JOD 11" },
        { name: "Utility Jacket", price: "JOD 62" },
        { name: "Canvas Cap", price: "JOD 14" },
      ],
    },
    experience: {
      title: "Delight your customers with an easy buying experience",
      captions: [
        "Buy directly, with no account needed",
        "Familiar payment methods your customers already trust",
        "Track every order, step by step, to the doorstep",
      ],
      login: {
        brand: "Perfume Store",
        title: "Log in",
        label: "Mobile number",
        code: "+962",
        placeholder: "7 7123 4567",
        button: "Continue",
        link: "Log in with email instead",
      },
      pay: {
        title: "Choose a payment method",
        options: ["Visa", "Apple Pay", "CliQ", "Cash on delivery (COD)"],
        button: "Pay now",
      },
      track: {
        title: "Your order is on its way",
        order: "Order #10428",
        steps: ["Confirmed", "Preparing", "Shipped", "Delivered"],
      },
    },
    signup: {
      tabs: { login: "Log in", create: "Create account" },
      fullName: "Full name",
      fullNamePh: "Enter your full name",
      email: "Email",
      emailPh: "Enter your email address",
      phone: "Phone number",
      phonePh: "7X XXX XXXX",
      password: "Password",
      passwordPh: "Enter your password",
      showPassword: "Show password",
      hidePassword: "Hide password",
      register: "Register",
      loginBtn: "Log in",
      loginId: "Email / phone number",
      loginIdPh: "Enter your email or phone number",
      forgot: "Forgot your password?",
      or: "or",
      guest: "Continue without an account",
      terms: {
        before: "By creating an account, you agree to Dukkan's ",
        terms: "Terms of Service",
        and: " and ",
        privacy: "Privacy Policy",
      },
      side: {
        kicker: "Getting started is the easy part",
        heading: "We'll guide you from signup to your first sale",
        panelTitle: "Your launch path",
        steps: ["Create your store", "Add your products", "Turn on payments", "Set up shipping", "Share your store link"],
        caption: "Set up in minutes, not days.",
      },
    },
    onboarding: {
      nav: ["All", "Home", "Orders", "Products", "Marketing", "Sales channels", "Reports"],
      summary: "Store summary",
      title: "Continue your first steps to launch your store",
      tasks: [
        { title: "Store identity", action: "Add" },
        { title: "Customer service number", action: "Add" },
        { title: "Store domain", action: "Customize" },
        { title: "Add your first product", action: "Add" },
        { title: "Shipping method", action: "Set" },
        { title: "Store design", action: "Design" },
      ],
      edit: "Edit",
      back: "Back to tasks",
      comingSoon: "This step is coming soon in this prototype.",
      step: "Store identity",
      previewHint: "Your store identity appears in the header and footer of your store",
      defaultName: "Your store",
      fromLogo: "Picked from your logo",
      pickColor: "Open color picker",
      hexLabel: "Hex color code",
      hexHint: "Type any hex code, like #004956 or 0af, or pick a color.",
      hexInvalid: "That isn't a valid hex code. Use 3 or 6 characters, like #004956.",
      nameLabel: "Store name",
      nameHint: "Choose a distinctive name for your brand.",
      namePh: "For example: Olive & Co",
      descLabel: "Store description",
      descHint: "Add a short, attractive description for your visitors.",
      descPh: "Tell customers what you sell",
      optional: "Optional",
      logoLabel: "Store logo",
      logoHint: "Add a logo that clearly expresses your store identity. Best size: 512 × 512 px, square (PNG with a transparent background looks best).",
      logoUpload: "Upload your logo",
      logoRemove: "Remove",
      colorLabel: "Store color",
      colorHint: "Choose the main color for your storefront.",
      save: "Save",
      product: {
        typeQuestion: "What type of product do you want to add?",
        types: [
          { title: "Ready product", desc: "Physical items you ship to customers" },
          { title: "Digital product", desc: "E-books, files and recorded courses" },
          { title: "Digital card", desc: "Gift cards and prepaid codes to resell" },
          { title: "Food", desc: "Meals and drinks that need special shipping" },
        ],
        dataTitle: "Add product details",
        imageAdd: "Add a new image",
        imageBrowse: "Or browse from your device",
        imageHint: "Maximum file size is 2 MB. The image should be at least 250 × 100 px.",
        imageTooBig: "This file is larger than 2 MB.",
        imageRemove: "Remove image",
        nameLabel: "Product name",
        namePh: "Enter the product name",
        priceLabel: "Price",
        pricePh: "Enter the product price",
        currency: "JOD",
        shippingLabel: "Shipping",
        needsShipping: "Requires shipping",
        noShipping: "No shipping needed",
        weightLabel: "Product weight",
        weightPh: "Enter the product weight",
        kg: "kg",
        quantityLabel: "Quantity",
        quantityPh: "Set the quantity available for sale",
        unlimited: "Unlimited quantity",
        limited: "Limited quantity",
        previewEmpty: "Enter product data to see it here",
        previewMobile: "Mobile",
        previewDesktop: "Desktop",
        productDefault: "Product name",
        addToCart: "Add to cart",
        buyNow: "Buy now",
        add: "Add product",
      },
      shipping: {
        label: "Shipping method",
        hint: "Tell us how your orders reach customers, and who you work with.",
        whoLabel: "Who delivers your orders?",
        kinds: ["Shipping company", "An individual"],
        nameLabels: ["Shipping company name", "Name of the person you work with"],
        namePhs: ["Enter the company name", "Enter the person's name"],
        phoneLabel: "Their phone number",
        phoneHint: "The number we can reach them on.",
        phoneInvalid: "Enter a valid phone number, at least 8 digits.",
        proofLabel: "Proof for this partner",
        proofHint: "Add any documents that show who they are, such as a commercial registration, ID, a contract or delivery receipts.",
        proofAdd: "Upload your documents",
        proofLimit: "Up to 5 files, 5 MB each. Images or PDF.",
        proofTooBig: "That file is larger than 5 MB.",
        proofType: "Only images or PDF files are allowed.",
        proofMax: "You can add up to 5 files.",
        localNote: "In this prototype your files stay on your device and are not uploaded.",
        remove: "Remove",
        previewHint: "This is how your shipping partner will look in your account",
        previewName: "Partner name",
        proofAttached: "Proof attached",
        noProof: "No proof yet",
        modeTitle: "How will your orders be delivered?",
        pickupLabel: "Let customers pick up their order from my store",
        pickupHint: "Customers who choose pickup pay no shipping fee. You can turn this off at any time.",
        modes: [
          { title: "I have my own shipping", desc: "A courier or shipping company I already work with." },
          { title: "Use Dukkan Ship", desc: "Our own delivery service. One flat price for every order." },
        ],
        seenName: "Dukkan Ship",
        price: "JOD 3",
        perOrder: "per order",
        priceNote: "Billed per order. No monthly fee and no contract.",
        change: "Change delivery option",
        cityLabel: "Pickup city",
        cityPh: "Choose a city",
        cities: ["Amman", "Irbid", "Zarqa", "Balqa", "Madaba", "Karak", "Tafilah", "Ma'an", "Aqaba", "Jerash", "Ajloun", "Mafraq"],
        addressLabel: "Pickup address",
        addressPh: "Street, building number, landmark",
        features: ["Pickup from your address", "Tracking for every order", "Flat price, no contracts"],
        previewSeen: "This is how Dukkan Ship will appear in your account",
        errCity: "Choose a pickup city.",
      },
      service: {
        label: "Customer service number",
        hint: "Add the number you want to receive your customers' inquiries on.",
        phoneLabel: "Phone number",
        phonePh: "7X XXX XXXX",
        invalid: "Enter a valid phone number, at least 8 digits.",
        previewHint: "Your number appears in your store footer",
        contact: "Contact us",
        useSame: "Use the same number registered in your account",
        registered: "Registered number",
        otherLabel: "Customer service phone number",
      },
      domain: {
        label: "Store domain",
        hint: "This is the link your customers use to visit your store.",
        prefix: "dukkan.store/",
        ph: "domain",
        examples: "Examples: dukkan.store/brandname or dukkan.store/brand-name",
        invalid: "Use 3 to 30 letters (a to z), numbers or hyphens. It can't start or end with a hyphen.",
        previewHint: "Your domain appears in the browser tab and when your store is shared",
        suggest: "Use",
        fallback: "your-store",
      },
    },
    reports: {
      menu: ["Store performance", "Reports"],
      createReport: "Create report",
      sidebarTitle: "Performance summary",
      sections: ["Sales", "Orders", "Customers", "Visits", "Abandoned carts", "Payments", "Inventory"],
      manage: "Manage reports",
      ranges: ["Last 7 days", "Last 30 days", "This month"],
      cards: ["Net sales", "Total sales", "Net profit", "Total costs"],
      recommended: "Recommended",
      refresh: "Refresh",
      updated: "Updated at",
      summary: "Summary",
      rows: ["Total sales", "Discounts", "Net sales", "Cost of goods sold", "Shipping costs", "Taxes", "Payment fees", "Total costs", "Net profit"],
      sampleToggle: "Preview with sample data",
      sampleNote: "Sample data, not real sales",
      soon: "This report is coming soon in this prototype.",
      currency: "JOD",
      abandoned: {
        cards: ["Abandoned carts", "Potential lost revenue", "Recovery rate after reminders", "Most products added to abandoned carts"],
        rows: ["Carts recovered", "Reminders sent"],
        empty: "No abandoned carts yet",
      },
      noData: "No data yet",
      widgets: {
        orders: [
          { id: "o-avg", kind: "stat", unit: "decimal", title: "Average orders per customer", desc: "The average number of orders each customer placed in the selected period.", formula: ["Average orders per customer", "=", "Total orders", "÷", "Number of customers"] },
          { id: "o-noship", kind: "stat", unit: "count", tone: "bad", badge: true, title: "Orders without a shipment number", desc: "Orders that were shipped but don't have a tracking number added yet." },
          { id: "o-cancel", kind: "rate", tone: "bad", title: "Cancellation rate", desc: "The share of orders that were cancelled out of all the orders placed in the period.", formula: ["Cancellation rate", "=", "Cancelled orders", "÷", "Total orders", "×", "100"], items: ["Cancelled orders", "Total orders"] },
          { id: "o-channel", kind: "breakdown", title: "Orders by sales channel", desc: "How your orders are split across the channels customers bought through.", items: ["Online store", "Mobile app", "Social media", "Marketplace"] },
          { id: "o-type", kind: "breakdown", title: "Orders by order type", desc: "How your orders are split by the way they are fulfilled.", items: ["Shipped to customer", "Store pickup", "Digital delivery"] },
          { id: "o-progress", kind: "breakdown", title: "Orders in progress", desc: "Orders that aren't finished yet, grouped by their current status.", items: ["Pending payment", "Being prepared", "Ready to ship", "Shipped"] },
        ],
        customers: [
          { id: "c-cart", kind: "stat", unit: "count", badge: true, title: "Customers who added products to cart", desc: "The number of customers who added products to their cart in the selected period." },
          { id: "c-new", kind: "stat", unit: "count", tone: "good", title: "New customers", desc: "Customers who placed their first order in the selected period." },
          { id: "c-return", kind: "rate", tone: "good", title: "Returning customer rate", desc: "The share of customers who ordered from you more than once.", formula: ["Returning rate", "=", "Returning customers", "÷", "All customers", "×", "100"], items: ["Returning customers", "All customers"] },
          { id: "c-top", kind: "list", title: "Customers with the most orders", desc: "Your most loyal customers in the selected period, ranked by number of orders.", items: ["Layla A.", "Omar K.", "Noor S.", "Hala M."] },
        ],
        visits: [
          { id: "v-total", kind: "stat", unit: "count", title: "Total visits", desc: "The number of times your store was visited in the selected period." },
          { id: "v-browser", kind: "breakdown", title: "Browsers", desc: "Which browsers your visitors used to open your store.", items: ["Chrome", "Safari", "Edge", "Samsung Internet", "Other"] },
          { id: "v-cities", kind: "list", title: "Most visits by city", desc: "The cities most of your visitors came from.", items: ["Amman", "Zarqa", "Irbid", "Aqaba"] },
          { id: "v-sources", kind: "breakdown", title: "Visit sources", desc: "Where your visitors came from before reaching your store.", items: ["Direct", "Search engines", "Social media", "Messaging apps", "Referral links", "Other"] },
          { id: "v-keywords", kind: "list", title: "Search words that bring the most visits", desc: "The words people searched for before finding your store.", items: ["backpack", "steel bottle", "jacket"] },
          { id: "v-pages", kind: "list", title: "Most visited pages", desc: "The pages in your store that visitors opened most often.", items: ["Home page", "All products", "Daily Backpack"] },
        ],
        payments: [
          { id: "p-methods", kind: "breakdown", title: "Payment methods used", desc: "Shows how your payments are split by payment method in the selected period.", items: ["Card", "CliQ", "Cash on delivery", "PayPal"] },
          { id: "p-online", kind: "rate", tone: "good", rateRange: [55, 92], title: "Share of electronic payments", desc: "The share of electronic payments out of all payment methods in the selected period.", items: ["Electronic payments", "All payments"] },
        ],
        inventory: [
          { id: "i-sold", kind: "stat", unit: "count", badge: true, title: "Quantity sold from inventory", desc: "The total number of units sold from your available stock during the selected period." },
          { id: "i-notify", kind: "stat", unit: "count", tone: "bad", title: "Products with “Notify me” requests", desc: "Products that ran out of stock and that customers asked to be told about when they are back." },
          { id: "i-wish", kind: "list", title: "Most added to wish lists", desc: "The products your customers added to their wish lists most often in the selected period.", items: ["Daily Backpack", "Steel Bottle", "Utility Jacket", "Canvas Cap"] },
          { id: "i-req", kind: "list", title: "Most requested through “Notify me”", desc: "Products customers asked to be notified about when they return to stock.", items: ["Daily Backpack", "Steel Bottle", "Utility Jacket", "Canvas Cap"] },
          { id: "i-stock", kind: "breakdown", title: "Stock availability by product", desc: "The state of your stock across all products, based on available quantities.", items: ["In stock", "Low stock", "Out of stock"] },
        ],
      },
      help: {
        totalSales: {
          title: "Total sales",
          desc: "The value of all orders before discounts are applied. It includes products, shipping and taxes, and does not include refunds.",
          formula: ["Total sales", "=", "(Product prices before discount", "×", "Quantity sold)", "+", "Shipping fees", "+", "Taxes", "−", "Refunds"],
        },
        netSales: { title: "Net sales", desc: "Total sales after subtracting discounts.", formula: ["Net sales", "=", "Total sales", "−", "Discounts"] },
        netProfit: { title: "Net profit", desc: "Your profit after deducting total costs from net sales.", formula: ["Net profit", "=", "Net sales", "−", "Total costs"] },
        totalCosts: { title: "Total costs", desc: "Everything it costs to make these sales: the cost of your products (as recorded in each product's details), shipping, taxes, payment fees, and any extra fees such as a cash-on-delivery charge." },
        discounts: { title: "Discounts", desc: "The value of coupons and offers applied to orders." },
        cogs: { title: "Cost of goods sold", desc: "What the products you sold cost you." },
        shipping: { title: "Shipping costs", desc: "What you paid carriers to deliver orders." },
        taxes: { title: "Taxes", desc: "Taxes collected or owed on these sales." },
        fees: { title: "Payment fees", desc: "Fees charged by payment providers on each order." },
        abandoned: { title: "Abandoned carts", desc: "Carts where a customer added products but left without completing the order, in the selected period." },
        lostRevenue: { title: "Potential lost revenue", desc: "The total value of the items left in abandoned carts. These are sales you can still win back." },
        recovery: {
          title: "Recovery rate after reminders",
          desc: "The share of abandoned carts that turned into orders after a reminder was sent.",
          formula: ["Recovery rate", "=", "Recovered carts", "÷", "Abandoned carts", "×", "100"],
        },
        topProducts: { title: "Most added to abandoned carts", desc: "The products that most often sit in abandoned carts. Start with these when you send reminders or offers." },
      },
    },
    home: {
      pageTitle: "Store summary",
      summaryTab: "Store summary",
      welcome: "Welcome back, {name}",
      welcomeNoName: "Welcome back",
      welcomeSub: "Here is how your store is doing today.",
      setupTitle: "Finish setting up your store",
      setupDone: "Your store is ready to launch",
      setupProgress: "{done} of {total} tasks done",
      setupCta: "Continue setup",
      summaryTitle: "{month} summary",
      daily: "Daily",
      monthly: "Monthly",
      visits: "Visits",
      netSales: "Net sales",
      orders: "Orders",
      totalOrders: "Total orders",
      chartLabel: "Sales chart",
      viewReports: "View all reports",
      goalTitle: "Add a goal that motivates you",
      goalHint: "Clear goals help you focus and follow your store's growth more easily.",
      goalBtn: "Add monthly goal",
      goalLabel: "Monthly sales goal",
      goalSave: "Save goal",
      goalChange: "Change goal",
      lastHourTitle: "Visits in the last hour",
      empty: "No data yet",
      emptyVisits: "You'll see more data here as your store grows.",
      latestTitle: "Latest orders",
      emptyOrders: "Data will appear here once it's available.",
      latestSample: [
        { name: "Layla A.", total: "128", status: "Paid" },
        { name: "Omar K.", total: "245", status: "Pending" },
        { name: "Noor S.", total: "96", status: "Shipped" },
      ],
      cartsTitle: "Abandoned carts",
      cartsCount: "Abandoned carts",
      cartsLost: "Potential lost revenue",
      cartsLink: "View the full report",
    },
    marketing: {
      menu: ["Abandoned carts", "Coupons", "Repurchase reminders", "Free delivery"],
      tabs: ["Abandoned carts", "Automatic reminders"],
      title: "Abandoned carts at a glance",
      sub: "Follow the key abandoned-cart numbers and how many you win back over the selected period.",
      cards: ["Total abandoned carts", "Recovered carts", "Average cart value"],
      viewFull: "View the full report",
      search: "Search by customer or product",
      status: ["All carts", "Reminder sent", "Not reminded"],
      export: "Export carts",
      columns: "Customize columns",
      cols: ["Customer", "Products", "Total", "Last update", "Cart status", "Actions"],
      created: "Created {n} days ago",
      ago: "{n} days ago",
      items: "{n} items",
      sent: "Reminder sent",
      notSent: "Not reminded",
      remind: "Send reminder",
      notice: "Prototype: no message was sent.",
      empty: "No abandoned carts yet",
      emptyHint: "Carts that customers leave behind will show up here.",
      noMatch: "No carts match your search.",
      names: ["Layla A.", "Omar K.", "Noor S.", "Hala M.", "Sami R.", "Rania T.", "Yazan B.", "Dina K."],
    },
    coupons: {
      tabs: ["Coupons"],
      newCoupon: "New coupon",
      types: [
        { title: "Discount coupon", desc: "A code customers enter at checkout to get a discount." },
        { title: "Free shipping coupon", desc: "A code that removes the shipping fee at checkout." },
        { title: "Custom coupon", desc: "Design your own coupon to match your store's goals." },
        { title: "Next-order coupon", desc: "Encourage customers to buy again with a discount on their next order." },
      ],
      title: "Discount coupons",
      search: "Search by coupon name or code",
      export: "Export coupons",
      statuses: ["All", "Active", "Disabled", "Expired", "Used up"],
      cols: ["Coupon", "Discount", "Start date", "End date", "Status", "Actions"],
      noEnd: "No end date",
      startsNow: "Starts immediately",
      freeShipping: "Free shipping",
      used: "{n} used",
      copy: "Copy code",
      copied: "Code copied",
      edit: "Edit",
      del: "Delete",
      confirmDel: "Confirm delete",
      empty: "No coupons yet",
      emptyHint: "Create a coupon to encourage customers to complete their purchase.",
      loadSample: "Load sample coupons",
      noMatch: "No coupons match your search.",
      sampleNames: ["Welcome offer", "Free delivery weekend", "Summer sale", "Come back for more"],
      form: {
        createTitle: "Create: {type}",
        editTitle: "Edit coupon",
        name: "Coupon name",
        namePh: "For example: Summer sale",
        code: "Coupon code",
        prefix: "Code prefix",
        generate: "Generate",
        kind: "Discount type",
        percent: "Percentage",
        fixed: "Fixed amount",
        value: "Discount value",
        min: "Minimum order amount",
        minHint: "Optional. The coupon only works when the cart is at least this much.",
        start: "Start date",
        end: "End date",
        limit: "Usage limit",
        limitHint: "Optional. Leave empty for unlimited use.",
        validDays: "Valid for (days after the order)",
        nextNote: "After each order, a unique code for the customer's next order is created from this prefix.",
        shipNote: "This coupon removes the shipping fee. No discount value is needed.",
        save: "Save coupon",
        cancel: "Cancel",
        saved: "Coupon saved",
        errName: "Enter a coupon name.",
        errCode: "Use 3 to 16 letters or numbers for the code.",
        errValue: "Enter a valid discount value.",
        errPercent: "A percentage must be between 1 and 100.",
        errDates: "The end date must be after the start date.",
        errDays: "Enter a number of days between 1 and 365.",
      },
    },
    sidebar: {
      collapse: "Collapse menu",
      expand: "Expand menu",
      open: "Open menu",
      close: "Close menu",
      soon: "Coming soon",
      main: "Main menu",
    },
    notifications: {
      title: "Notifications",
      markAll: "Mark all as read",
      tabs: ["All", "Important", "Orders", "Abandoned carts", "Payments", "Store activity"],
      empty: "No notifications here",
      viewAll: "View all",
      templates: {
        welcome: "Welcome to {brand}! Finish setting up your store to start selling.",
        taskDone: "You completed: {task}",
        couponCreated: "Coupon {code} was created",
        reminderSent: "A reminder was sent to {name}",
        ticketCreated: "Support ticket {id} was created",
      },
    },
    support: {
      title: "Support tickets",
      newTicket: "New ticket",
      cols: ["Ticket", "Category", "Status", "Created", "Actions"],
      categories: ["Orders", "Payments", "Technical issue", "Other"],
      statuses: ["Open", "Closed"],
      subject: "Subject",
      subjectPh: "What do you need help with?",
      category: "Category",
      message: "Message",
      messagePh: "Describe the problem with as much detail as you can.",
      send: "Create ticket",
      cancel: "Cancel",
      close: "Close ticket",
      reopen: "Reopen",
      empty: "No tickets yet",
      emptyHint: "Open a ticket if you need help with your store.",
      note: "Prototype: tickets stay on this device and are not sent to anyone.",
      errSubject: "Enter a subject.",
      errMessage: "Describe your problem in at least 10 characters.",
    },
    settings: {
      tab: "Account settings",
      group: "General",
      entries: ["Account settings", "Notifications"],
      back: "Back to home",
      save: "Save",
      saved: "Settings saved on this device. Prototype: nothing was sent.",
      account: {
        title: "Account details",
        name: "Name",
        phone: "Phone number",
        email: "Email",
        dob: "Date of birth",
        gender: "Gender",
        male: "Male",
        female: "Female",
        country: "Country",
        countries: ["Jordan"],
        city: "City",
        cityPh: "Choose a city",
      },
      password: {
        title: "Password",
        current: "Enter your current password",
        next: "Enter your new password",
        confirm: "Confirm your new password",
        ph: "Enter your password",
        note: "Prototype: passwords are only checked here and are never stored.",
      },
      errors: {
        name: "Enter your name.",
        email: "Enter a valid email address.",
        phone: "Enter a valid phone number, at least 8 digits.",
        dob: "The date of birth can't be in the future.",
        current: "Enter your current password to change it.",
        short: "The new password must be at least 8 characters.",
        mismatch: "The two passwords don't match.",
      },
    },
    featuresTitle: "Dukkan supports every step of your journey",
    features: [
      {
        id: "solutions",
        tag: "Launch",
        title: "Start easy, even if you're busy",
        body: "No experience or full-time commitment needed to start selling.",
        points: ["Guided setup that gets you live fast", "Orders, products and reports in one dashboard", "Explore a ready demo store before you start"],
      },
      {
        id: "design",
        tag: "Design",
        title: "A store that stands out at first glance",
        body: "Design your store yourself, with no coding.",
        points: ["Click any element and edit it live", "Hero and website background in picture, GIF or video", "Arrange your sections your way"],
      },
      {
        id: "payments",
        tag: "Payments",
        title: "Secure payments, lasting trust",
        body: "Manage store and customer payments with one integrated system.",
        points: ["Cards, wallets and local payment methods", "Activate payments within a day", "Payouts 24 hours after each order"],
      },
      {
        id: "shipping",
        tag: "Shipping",
        title: "A complete shipping fleet for your products",
        body: "Connect your store to carriers without contracts or friction.",
        points: ["Dukkan Ship: our own delivery at a flat price per order", "Already have a courier? Add them and keep working together", "Track every order from pickup to the doorstep"],
      },
      {
        id: "marketing",
        tag: "Marketing",
        title: "Every marketing tool in one place",
        body: "Reach more customers with campaigns made for your store.",
        points: ["Discount coupons that close the sale", "Full control of offers and promotions", "Abandoned-cart recovery and ad management"],
      },
    ],
    testimonialsTitle: "Be the next success story",
    quotes: [
      { q: "Setup took an afternoon. Our first order came in that same night.", n: "Sample Merchant", s: "Fashion store" },
      { q: "Shipping and payments finally live in one dashboard. That alone saves me hours.", n: "Sample Merchant", s: "Home goods" },
      { q: "We went from a side project to a real brand without changing platform.", n: "Sample Merchant", s: "Beauty brand" },
      { q: "Customers pay by CliQ or cash on delivery, and every order shows up in one place.", n: "Sample Merchant", s: "Gifts" },
      { q: "The store designer let me change the look myself, without calling anyone.", n: "Sample Merchant", s: "Jewelry" },
      { q: "The reports show me which products get left in carts, so I know who to remind.", n: "Sample Merchant", s: "Electronics" },
    ],
    finalCta: {
      title: "Own a professional store on Dukkan",
      body: "Create your store now with flexible tools and complete solutions to grow your sales.",
    },
    footer: {
      tagline: "Smart commerce for Jordan and beyond.",
      cols: [
        { title: "About Dukkan", links: ["Join the Dukkan team", "Terms of use", "Privacy policy"] },
        { title: "Resources", links: ["Help center", "FAQ", "Contact us"] },
      ],
      industriesTitle: "Industries",
      availableIn: "Available in:",
      country: "Jordan",
      contact: { phone: "+962 6 000 0000", place: "Amman, Jordan", email: "hello@dukkan.store" },
      social: ["TikTok", "X", "YouTube", "Instagram"],
      legal: "© 2026 Dukkan. All rights reserved. Prototype, not a live service.",
    },
  },

  ar: {
    dashboard: {
      revenueLabel: "إيرادات هذا الشهر",
      revenue: "48,339 د.أ",
      storeLabel: "متجرك",
      orders: [
        { name: "ليلى أ.", total: "128 د.أ", status: "مدفوع" },
        { name: "عمر ك.", total: "245 د.أ", status: "قيد الانتظار" },
        { name: "نور س.", total: "96 د.أ", status: "تم الشحن" },
      ],
      products: [
        { name: "حقيبة يومية", price: "34 د.أ" },
        { name: "قارورة معدنية", price: "11 د.أ" },
        { name: "جاكيت عملي", price: "62 د.أ" },
        { name: "كاب قماشي", price: "14 د.أ" },
      ],
    },
    experience: {
      title: "أسعد عملاءك بتجربة شراء سهلة",
      captions: [
        "شراء مباشر دون تعقيد أو إنشاء حساب",
        "طرق دفع مألوفة يثق بها عملاؤك",
        "تتبّع كل طلب خطوة بخطوة حتى باب البيت",
      ],
      login: {
        brand: "متجر عطور",
        title: "تسجيل الدخول",
        label: "رقم الجوال",
        code: "+962",
        placeholder: "7 7123 4567",
        button: "متابعة",
        link: "تسجيل الدخول بالبريد الإلكتروني",
      },
      pay: {
        title: "اختر طريقة الدفع",
        options: ["فيزا", "ابل باي", "كليك", "الدفع عند الاستلام"],
        button: "ادفع الآن",
      },
      track: {
        title: "طلبك في الطريق",
        order: "طلب رقم 10428",
        steps: ["تم التأكيد", "قيد التجهيز", "تم الشحن", "تم التسليم"],
      },
    },
    signup: {
      tabs: { login: "تسجيل الدخول", create: "إنشاء حساب" },
      fullName: "الاسم الكامل",
      fullNamePh: "أدخل اسمك الكامل",
      email: "البريد الإلكتروني",
      emailPh: "أدخل بريدك الإلكتروني",
      phone: "رقم الجوال",
      phonePh: "7X XXX XXXX",
      password: "كلمة المرور",
      passwordPh: "أدخل كلمة المرور",
      showPassword: "إظهار كلمة المرور",
      hidePassword: "إخفاء كلمة المرور",
      register: "إنشاء الحساب",
      loginBtn: "تسجيل الدخول",
      loginId: "البريد الإلكتروني / رقم الجوال",
      loginIdPh: "أدخل بريدك الإلكتروني أو رقم جوالك",
      forgot: "نسيت كلمة المرور؟",
      or: "أو",
      guest: "المتابعة بدون حساب",
      terms: {
        before: "بإنشائك حسابًا، فإنك توافق على ",
        terms: "شروط الاستخدام",
        and: " و",
        privacy: "سياسة الخصوصية",
      },
      side: {
        kicker: "البداية أسهل مما تتخيل",
        heading: "نرافقك من التسجيل حتى أول عملية بيع",
        panelTitle: "رحلة إطلاق متجرك",
        steps: ["أنشئ متجرك", "أضف منتجاتك", "فعّل المدفوعات", "اضبط الشحن", "شارك رابط متجرك"],
        caption: "جاهز خلال دقائق لا أيام.",
      },
    },
    onboarding: {
      nav: ["الكل", "الرئيسية", "الطلبات", "المنتجات", "التسويق", "قنوات البيع", "التقارير"],
      summary: "ملخص المتجر",
      title: "أكمل خطواتك الأولى لإطلاق متجرك",
      tasks: [
        { title: "هوية المتجر", action: "إضافة" },
        { title: "رقم خدمة العملاء", action: "إضافة" },
        { title: "دومين المتجر", action: "تخصيص" },
        { title: "إضافة أول منتج", action: "إضافة" },
        { title: "طريقة الشحن", action: "تحديد" },
        { title: "تصميم المتجر", action: "تصميم" },
      ],
      edit: "تعديل",
      back: "العودة إلى المهام",
      comingSoon: "هذه الخطوة قادمة قريبًا في هذا النموذج الأولي.",
      step: "هوية المتجر",
      previewHint: "ستظهر هوية متجرك في رأس المتجر وتذييله",
      defaultName: "متجرك",
      fromLogo: "لون مأخوذ من شعارك",
      pickColor: "افتح منتقي الألوان",
      hexLabel: "رمز اللون (Hex)",
      hexHint: "اكتب أي رمز لون مثل #004956 أو 0af، أو اختر لونًا.",
      hexInvalid: "هذا ليس رمز لون صحيحًا. استخدم 3 أو 6 خانات مثل #004956.",
      nameLabel: "اسم المتجر",
      nameHint: "اختر اسمًا مميزًا لعلامتك التجارية.",
      namePh: "مثال: زيتون وشركاه",
      descLabel: "وصف المتجر",
      descHint: "أضف وصفًا موجزًا وجذابًا يظهر لزوّار متجرك.",
      descPh: "عرّف عملاءك بما تبيعه",
      optional: "اختياري",
      logoLabel: "شعار المتجر",
      logoHint: "أضف شعارًا يعبّر عن هوية متجرك بوضوح. المقاس المناسب: 512 × 512 بكسل، مربّع (الأفضل PNG بخلفية شفافة).",
      logoUpload: "ارفع شعارك",
      logoRemove: "إزالة",
      colorLabel: "لون المتجر",
      colorHint: "اختر اللون الرئيسي لواجهة متجرك.",
      save: "حفظ",
      product: {
        typeQuestion: "ما نوع المنتج الذي تود إضافته؟",
        types: [
          { title: "منتج جاهز", desc: "منتجات ملموسة وقابلة للشحن" },
          { title: "منتج رقمي", desc: "كتب وملفات إلكترونية ودورات مسجّلة" },
          { title: "بطاقة رقمية", desc: "بطاقات هدايا وأكواد مسبقة الدفع لإعادة بيعها" },
          { title: "أكل", desc: "مأكولات ومشروبات تتطلب شحنًا خاصًا" },
        ],
        dataTitle: "أضف بيانات المنتج",
        imageAdd: "أضف صورة جديدة",
        imageBrowse: "أو تصفّح من جهازك",
        imageHint: "الحد الأقصى لحجم الملف 2 ميغابايت، ويفضّل ألا يقل مقاس الصورة عن 250 × 100 بكسل.",
        imageTooBig: "حجم هذا الملف أكبر من 2 ميغابايت.",
        imageRemove: "إزالة الصورة",
        nameLabel: "اسم المنتج",
        namePh: "أدخل اسم المنتج",
        priceLabel: "السعر",
        pricePh: "أدخل سعر المنتج",
        currency: "د.أ",
        shippingLabel: "الشحن",
        needsShipping: "يتطلب شحن",
        noShipping: "لا يتطلب شحن",
        weightLabel: "وزن المنتج",
        weightPh: "أدخل وزن المنتج",
        kg: "كيلوغرام",
        quantityLabel: "الكمية",
        quantityPh: "حدّد الكمية المتوفرة للبيع",
        unlimited: "كمية لا محدودة",
        limited: "كمية محدودة",
        previewEmpty: "أدخل بيانات المنتج لمعاينة ظهوره هنا",
        previewMobile: "جوال",
        previewDesktop: "كمبيوتر",
        productDefault: "اسم المنتج",
        addToCart: "أضف للسلة",
        buyNow: "اشترِ الآن",
        add: "إضافة المنتج",
      },
      shipping: {
        label: "طريقة الشحن",
        hint: "عرّفنا كيف تصل طلباتك إلى عملائك، ومع من تتعامل.",
        whoLabel: "من يوصّل طلباتك؟",
        kinds: ["شركة شحن", "شخص"],
        nameLabels: ["اسم شركة الشحن", "اسم الشخص الذي تتعامل معه"],
        namePhs: ["أدخل اسم الشركة", "أدخل اسم الشخص"],
        phoneLabel: "رقم هاتفه",
        phoneHint: "الرقم الذي يمكننا التواصل معه عليه.",
        phoneInvalid: "أدخل رقم هاتف صحيحًا من 8 أرقام على الأقل.",
        proofLabel: "إثباتات هذه الجهة",
        proofHint: "أضف أي مستندات تثبت هويتهم، مثل السجل التجاري أو الهوية أو عقد التعاون أو إيصالات التسليم.",
        proofAdd: "ارفع مستنداتك",
        proofLimit: "حتى 5 ملفات، 5 ميغابايت لكل ملف، صور أو PDF.",
        proofTooBig: "حجم الملف أكبر من 5 ميغابايت.",
        proofType: "يُسمح بالصور وملفات PDF فقط.",
        proofMax: "يمكنك إضافة 5 ملفات كحد أقصى.",
        localNote: "في هذا النموذج الأولي تبقى ملفاتك على جهازك ولا تُرفع.",
        remove: "إزالة",
        previewHint: "هكذا سيظهر شريك الشحن في حسابك",
        previewName: "اسم الشريك",
        proofAttached: "تم إرفاق إثباتات",
        noProof: "لا توجد إثباتات بعد",
        modeTitle: "كيف ستُوصَّل طلباتك؟",
        pickupLabel: "السماح للعملاء باستلام الطلب بأنفسهم من متجري",
        pickupHint: "العميل الذي يختار الاستلام من المتجر لا يدفع رسوم شحن. يمكنك إيقاف هذا الخيار في أي وقت.",
        modes: [
          { title: "لدي طريقة شحن خاصة", desc: "شركة توصيل أو شخص أتعامل معه بالفعل." },
          { title: "استخدم شحن دكان", desc: "خدمة التوصيل الخاصة بنا، بسعر ثابت لكل طلب." },
        ],
        seenName: "شحن دكان",
        price: "3 د.أ",
        perOrder: "لكل طلب",
        priceNote: "تُحتسب لكل طلب. بلا اشتراك شهري ولا عقود.",
        change: "تغيير خيار التوصيل",
        cityLabel: "مدينة الاستلام",
        cityPh: "اختر المدينة",
        cities: ["عمّان", "إربد", "الزرقاء", "البلقاء", "مأدبا", "الكرك", "الطفيلة", "معان", "العقبة", "جرش", "عجلون", "المفرق"],
        addressLabel: "عنوان الاستلام",
        addressPh: "الشارع، رقم المبنى، أقرب معلم",
        features: ["استلام من عنوانك", "تتبّع لكل طلب", "سعر ثابت بلا عقود"],
        previewSeen: "هكذا سيظهر شحن دكان في حسابك",
        errCity: "اختر مدينة الاستلام.",
      },
      service: {
        label: "رقم خدمة العملاء",
        hint: "أضف الرقم الذي تود استخدامه لتلقّي استفسارات عملائك.",
        phoneLabel: "رقم الجوال",
        phonePh: "7X XXX XXXX",
        invalid: "أدخل رقم جوال صحيحًا من 8 أرقام على الأقل.",
        previewHint: "سيظهر رقمك في تذييل متجرك",
        contact: "تواصل معنا",
        useSame: "استخدام نفس الرقم المسجَّل في حسابك",
        registered: "الرقم المسجّل",
        otherLabel: "رقم جوال خدمة العملاء",
      },
      domain: {
        label: "دومين المتجر",
        hint: "هذا هو الرابط الذي يستخدمه العملاء لزيارة متجرك.",
        prefix: "dukkan.store/",
        ph: "domain",
        examples: "أمثلة: dukkan.store/brandname أو dukkan.store/brand-name",
        invalid: "استخدم من 3 إلى 30 حرفًا لاتينيًا (a-z) أو أرقامًا أو شرطات، ولا يبدأ أو ينتهي بشرطة.",
        previewHint: "يظهر دومين متجرك في تبويب المتصفح وعند مشاركة المتجر",
        suggest: "استخدم",
        fallback: "your-store",
      },
    },
    reports: {
      menu: ["أداء المتجر", "التقارير"],
      createReport: "إنشاء تقرير",
      sidebarTitle: "ملخص الأداء",
      sections: ["المبيعات", "الطلبات", "العملاء", "الزيارات", "السلات المتروكة", "المدفوعات", "المخزون"],
      manage: "إدارة التقارير",
      ranges: ["آخر 7 أيام", "آخر 30 يومًا", "هذا الشهر"],
      cards: ["صافي المبيعات", "إجمالي المبيعات", "صافي الأرباح", "إجمالي التكاليف"],
      recommended: "توصية",
      refresh: "تحديث",
      updated: "آخر تحديث",
      summary: "الملخص",
      rows: ["إجمالي المبيعات", "الخصومات", "صافي المبيعات", "تكلفة المنتجات المباعة", "تكاليف الشحن", "الضرائب", "رسوم الدفع الإلكتروني", "إجمالي التكاليف", "صافي الأرباح"],
      sampleToggle: "معاينة ببيانات تجريبية",
      sampleNote: "بيانات تجريبية وليست مبيعات حقيقية",
      soon: "هذا التقرير قادم قريبًا في هذا النموذج الأولي.",
      currency: "د.أ",
      abandoned: {
        cards: ["عدد السلات المتروكة", "الدخل المحتمل فقدانه من السلات المتروكة", "نسبة السلات المستردة بعد التذكير", "أكثر المنتجات إضافة للسلات المتروكة"],
        rows: ["سلات تم استردادها", "تذكيرات تم إرسالها"],
        empty: "لا توجد سلات متروكة بعد",
      },
      noData: "لا توجد بيانات بعد",
      widgets: {
        orders: [
          { id: "o-avg", kind: "stat", unit: "decimal", title: "متوسط الطلبات لكل عميل", desc: "متوسط عدد الطلبات التي أجراها كل عميل خلال الفترة المحددة.", formula: ["متوسط الطلبات لكل عميل", "=", "إجمالي الطلبات", "÷", "عدد العملاء"] },
          { id: "o-noship", kind: "stat", unit: "count", tone: "bad", badge: true, title: "الطلبات بدون رقم شحنة", desc: "طلبات تم شحنها لكن لم يُضَف لها رقم تتبع بعد." },
          { id: "o-cancel", kind: "rate", tone: "bad", title: "معدل الإلغاء", desc: "نسبة الطلبات الملغاة من إجمالي الطلبات خلال الفترة المحددة.", formula: ["معدل الإلغاء", "=", "الطلبات الملغاة", "÷", "إجمالي الطلبات", "×", "100"], items: ["الطلبات الملغاة", "إجمالي الطلبات"] },
          { id: "o-channel", kind: "breakdown", title: "الطلبات حسب قناة البيع", desc: "كيف تتوزع طلباتك على القنوات التي اشترى منها العملاء.", items: ["المتجر الإلكتروني", "تطبيق الجوال", "وسائل التواصل", "الأسواق الإلكترونية"] },
          { id: "o-type", kind: "breakdown", title: "الطلبات حسب نوع الطلب", desc: "كيف تتوزع طلباتك حسب طريقة التنفيذ.", items: ["شحن للعميل", "استلام من المتجر", "تسليم رقمي"] },
          { id: "o-progress", kind: "breakdown", title: "الطلبات قيد التنفيذ", desc: "الطلبات التي لم تكتمل بعد، مجمّعة حسب حالتها الحالية.", items: ["بانتظار الدفع", "قيد التجهيز", "جاهز للشحن", "تم الشحن"] },
        ],
        customers: [
          { id: "c-cart", kind: "stat", unit: "count", badge: true, title: "العملاء الذين أضافوا منتجات للسلة", desc: "عدد العملاء الذين أضافوا منتجات إلى سلتهم خلال الفترة الزمنية المحددة." },
          { id: "c-new", kind: "stat", unit: "count", tone: "good", title: "عملاء جدد", desc: "العملاء الذين أجروا أول طلب لهم خلال الفترة المحددة." },
          { id: "c-return", kind: "rate", tone: "good", title: "نسبة العملاء العائدين", desc: "نسبة العملاء الذين طلبوا منك أكثر من مرة.", formula: ["نسبة العائدين", "=", "العملاء العائدون", "÷", "كل العملاء", "×", "100"], items: ["العملاء العائدون", "كل العملاء"] },
          { id: "c-top", kind: "list", title: "العملاء الأكثر طلبًا", desc: "أكثر عملائك ولاءً خلال الفترة المحددة، مرتّبين حسب عدد الطلبات.", items: ["ليلى أ.", "عمر ك.", "نور س.", "هالة م."] },
        ],
        visits: [
          { id: "v-total", kind: "stat", unit: "count", title: "إجمالي الزيارات", desc: "عدد المرات التي زار فيها العملاء متجرك خلال الفترة المحددة." },
          { id: "v-browser", kind: "breakdown", title: "المتصفح", desc: "المتصفحات التي استخدمها زوارك لفتح متجرك.", items: ["كروم", "سفاري", "إيدج", "سامسونج", "أخرى"] },
          { id: "v-cities", kind: "list", title: "أكثر المدن زيارة", desc: "المدن التي جاء منها أغلب زوار متجرك.", items: ["عمّان", "الزرقاء", "إربد", "العقبة"] },
          { id: "v-sources", kind: "breakdown", title: "مصادر الزيارات", desc: "من أين جاء الزوار قبل وصولهم إلى متجرك.", items: ["مباشر", "محركات البحث", "وسائل التواصل", "تطبيقات المراسلة", "روابط خارجية", "أخرى"] },
          { id: "v-keywords", kind: "list", title: "كلمات البحث الأكثر جلبًا للزيارات", desc: "الكلمات التي بحث عنها الناس قبل أن يجدوا متجرك.", items: ["حقيبة", "قارورة", "جاكيت"] },
          { id: "v-pages", kind: "list", title: "أكثر الصفحات زيارة", desc: "الصفحات في متجرك التي فتحها الزوار أكثر من غيرها.", items: ["الصفحة الرئيسية", "كل المنتجات", "حقيبة يومية"] },
        ],
        payments: [
          { id: "p-methods", kind: "breakdown", title: "طرق الدفع المستخدمة", desc: "يوضّح توزيع المدفوعات حسب طريقة الدفع في الفترة الزمنية المحددة.", items: ["بطاقة", "كليك", "الدفع عند الاستلام", "باي بال"] },
          { id: "p-online", kind: "rate", tone: "good", rateRange: [55, 92], title: "نسبة المدفوعات الإلكترونية", desc: "نسبة المدفوعات الإلكترونية من إجمالي طرق الدفع خلال الفترة الزمنية المحددة.", items: ["المدفوعات الإلكترونية", "إجمالي المدفوعات"] },
        ],
        inventory: [
          { id: "i-sold", kind: "stat", unit: "count", badge: true, title: "الكمية المباعة من المخزون", desc: "إجمالي عدد الوحدات المباعة من المنتجات المتوفرة في المخزون خلال الفترة الزمنية المحددة." },
          { id: "i-notify", kind: "stat", unit: "count", tone: "bad", title: "منتجات عليها طلب 'أعلمني عند التوفر'", desc: "عدد المنتجات التي نفذت من المخزون وطلب العملاء إشعارًا عند توفرها مجددًا." },
          { id: "i-wish", kind: "list", title: "أكثر المنتجات إضافة لقوائم الأمنيات", desc: "قائمة بالمنتجات الأكثر إضافة إلى قوائم أمنيات عملاء متجرك خلال الفترة الزمنية المحددة.", items: ["حقيبة يومية", "قارورة معدنية", "جاكيت عملي", "كاب قماشي"] },
          { id: "i-req", kind: "list", title: "أكثر المنتجات طلبًا عبر 'أعلمني عند التوفر'", desc: "قائمة بالمنتجات التي طلب العملاء إشعارًا عند توفرها من جديد خلال الفترة الزمنية المحددة.", items: ["حقيبة يومية", "قارورة معدنية", "جاكيت عملي", "كاب قماشي"] },
          { id: "i-stock", kind: "breakdown", title: "نسب توفّر مخزون المنتجات", desc: "يعرض حالة المخزون لجميع المنتجات حسب الكميات المتوفرة خلال الفترة الزمنية المحددة.", items: ["متوفر", "مخزون منخفض", "نفذ من المخزون"] },
        ],
      },
      help: {
        totalSales: {
          title: "إجمالي المبيعات",
          desc: "إجمالي قيمة المبيعات قبل تطبيق الخصومات، ويشمل المنتجات والشحن والضرائب، ولا يشمل المسترجعات.",
          formula: ["إجمالي المبيعات", "=", "(أسعار المنتجات قبل الخصم", "×", "الكمية المباعة)", "+", "رسوم الشحن", "+", "الضرائب", "−", "المسترجعات"],
        },
        netSales: { title: "صافي المبيعات", desc: "إجمالي المبيعات بعد خصم الخصومات.", formula: ["صافي المبيعات", "=", "إجمالي المبيعات", "−", "الخصومات"] },
        netProfit: { title: "صافي الأرباح", desc: "إجمالي الأرباح بعد خصم إجمالي التكاليف من صافي المبيعات.", formula: ["صافي الأرباح", "=", "صافي المبيعات", "−", "إجمالي التكاليف"] },
        totalCosts: { title: "إجمالي التكاليف", desc: "كل ما تكلّفه هذه المبيعات: تكلفة المنتجات (حسب التكلفة المسجّلة في بيانات كل منتج)، والشحن، والضرائب، ورسوم الدفع الإلكتروني، وأي رسوم إضافية مثل رسوم الدفع عند الاستلام." },
        discounts: { title: "الخصومات", desc: "قيمة الكوبونات والعروض المطبّقة على الطلبات." },
        cogs: { title: "تكلفة المنتجات المباعة", desc: "ما كلّفتك المنتجات التي بعتها." },
        shipping: { title: "تكاليف الشحن", desc: "ما دفعته لشركات الشحن لتوصيل الطلبات." },
        taxes: { title: "الضرائب", desc: "الضرائب المحصّلة أو المستحقة على هذه المبيعات." },
        fees: { title: "رسوم الدفع الإلكتروني", desc: "الرسوم التي تفرضها جهات الدفع على كل طلب." },
        abandoned: { title: "عدد السلات المتروكة", desc: "السلات التي أضاف فيها العميل منتجات ثم غادر دون إتمام الطلب، خلال الفترة المحددة." },
        lostRevenue: { title: "الدخل المحتمل فقدانه", desc: "القيمة الإجمالية للمنتجات المتروكة في السلات. هذه مبيعات ما زال بإمكانك استعادتها." },
        recovery: {
          title: "نسبة السلات المستردة بعد التذكير",
          desc: "نسبة السلات المتروكة التي تحولت إلى طلبات بعد إرسال تذكير.",
          formula: ["نسبة الاسترداد", "=", "السلات المستردة", "÷", "السلات المتروكة", "×", "100"],
        },
        topProducts: { title: "أكثر المنتجات إضافة للسلات المتروكة", desc: "المنتجات التي تبقى في السلات المتروكة أكثر من غيرها. ابدأ بها عند إرسال التذكيرات أو العروض." },
      },
    },
    home: {
      pageTitle: "ملخص المتجر",
      summaryTab: "ملخص المتجر",
      welcome: "حيّاك الله، {name}",
      welcomeNoName: "حيّاك الله",
      welcomeSub: "هذا ملخص أداء متجرك اليوم.",
      setupTitle: "أكمل إعداد متجرك",
      setupDone: "متجرك جاهز للإطلاق",
      setupProgress: "{done} من {total} مهام مكتملة",
      setupCta: "متابعة الإعداد",
      summaryTitle: "ملخص {month}",
      daily: "يومي",
      monthly: "شهري",
      visits: "الزيارات",
      netSales: "صافي المبيعات",
      orders: "الطلبات",
      totalOrders: "إجمالي الطلبات",
      chartLabel: "مخطط المبيعات",
      viewReports: "استعرض كل التقارير",
      goalTitle: "أضف هدفًا يحفّزك",
      goalHint: "الأهداف الواضحة تساعدك على التركيز وتتبّع نمو متجرك بسهولة.",
      goalBtn: "أضف هدف الشهر",
      goalLabel: "هدف المبيعات الشهري",
      goalSave: "حفظ الهدف",
      goalChange: "تغيير الهدف",
      lastHourTitle: "الزيارات في آخر ساعة",
      empty: "لا توجد بيانات بعد",
      emptyVisits: "سترى مزيدًا من البيانات هنا مع نمو متجرك.",
      latestTitle: "أحدث الطلبات",
      emptyOrders: "ستظهر البيانات هنا عند توفّرها.",
      latestSample: [
        { name: "ليلى أ.", total: "128", status: "مدفوع" },
        { name: "عمر ك.", total: "245", status: "قيد الانتظار" },
        { name: "نور س.", total: "96", status: "تم الشحن" },
      ],
      cartsTitle: "السلات المتروكة",
      cartsCount: "عدد السلات المتروكة",
      cartsLost: "الدخل المحتمل فقدانه",
      cartsLink: "عرض التقرير الكامل",
    },
    marketing: {
      menu: ["السلات المتروكة", "الكوبونات", "تذكيرات إعادة الشراء", "التوصيل المجاني"],
      tabs: ["السلات المتروكة", "التذكيرات التلقائية"],
      title: "نظرة سريعة على أداء السلات المتروكة",
      sub: "تتبّع أهم مؤشرات السلات المتروكة ومعدل استعادتها خلال الفترة المحددة.",
      cards: ["إجمالي السلات المتروكة", "السلات المستردة", "متوسط قيمة السلة"],
      viewFull: "عرض التقرير كاملًا",
      search: "ابحث بالعميل أو المنتج",
      status: ["كل السلات", "تم إرسال تذكير", "لم يُرسل تذكير"],
      export: "تصدير السلات",
      columns: "تخصيص الأعمدة",
      cols: ["العميل", "المنتجات", "الإجمالي", "آخر تحديث", "حالة السلة", "إجراءات"],
      created: "أُنشئت منذ {n} يوم",
      ago: "منذ {n} يوم",
      items: "{n} منتج",
      sent: "تم إرسال تذكير",
      notSent: "لم يُرسل تذكير",
      remind: "إرسال تذكير",
      notice: "هذا نموذج أولي، لم تُرسل أي رسالة.",
      empty: "لا توجد سلات متروكة بعد",
      emptyHint: "ستظهر هنا السلات التي يتركها العملاء.",
      noMatch: "لا توجد سلات مطابقة لبحثك.",
      names: ["ليلى أ.", "عمر ك.", "نور س.", "هالة م.", "سامي ر.", "رانيا ط.", "يزن ب.", "دينا ك."],
    },
    coupons: {
      tabs: ["الكوبونات"],
      newCoupon: "كوبون جديد",
      types: [
        { title: "كوبون خصم", desc: "رمز يُدخله العميل عند الدفع للحصول على خصم." },
        { title: "كوبون شحن مجاني", desc: "رمز يُلغي رسوم الشحن عند الدفع." },
        { title: "كوبون مخصص", desc: "صمّم كوبونك وخصّصه وفقًا لأهداف متجرك." },
        { title: "كوبون الطلب القادم", desc: "حفّز العميل على تكرار الشراء بخصم على طلبه التالي." },
      ],
      title: "كوبونات الخصم",
      search: "ابحث باسم أو رمز الكوبون",
      export: "تصدير الكوبونات",
      statuses: ["الكل", "مفعّل", "معطّل", "منتهي الصلاحية", "مكتمل الاستخدام"],
      cols: ["الكوبون", "الخصم", "تاريخ البداية", "تاريخ الانتهاء", "حالة الكوبون", "إجراءات"],
      noEnd: "بدون تاريخ انتهاء",
      startsNow: "يبدأ فورًا",
      freeShipping: "شحن مجاني",
      used: "استُخدم {n} مرة",
      copy: "نسخ الرمز",
      copied: "تم نسخ الرمز",
      edit: "تعديل",
      del: "حذف",
      confirmDel: "تأكيد الحذف",
      empty: "لا توجد كوبونات بعد",
      emptyHint: "أنشئ كوبونًا لتشجيع العملاء على إتمام عملية الشراء.",
      loadSample: "تحميل كوبونات تجريبية",
      noMatch: "لا توجد كوبونات مطابقة لبحثك.",
      sampleNames: ["عرض الترحيب", "عطلة التوصيل المجاني", "تخفيضات الصيف", "عُد لتحصل على المزيد"],
      form: {
        createTitle: "إنشاء: {type}",
        editTitle: "تعديل الكوبون",
        name: "اسم الكوبون",
        namePh: "مثال: تخفيضات الصيف",
        code: "رمز الكوبون",
        prefix: "بادئة الرمز",
        generate: "توليد",
        kind: "نوع الخصم",
        percent: "نسبة مئوية",
        fixed: "مبلغ ثابت",
        value: "قيمة الخصم",
        min: "الحد الأدنى للطلب",
        minHint: "اختياري. لا يعمل الكوبون إلا إذا بلغت السلة هذا المبلغ على الأقل.",
        start: "تاريخ البداية",
        end: "تاريخ الانتهاء",
        limit: "حد الاستخدام",
        limitHint: "اختياري. اتركه فارغًا للاستخدام غير المحدود.",
        validDays: "صالح لمدة (أيام بعد الطلب)",
        nextNote: "بعد كل طلب، يُنشأ رمز فريد للعميل لطلبه القادم انطلاقًا من هذه البادئة.",
        shipNote: "هذا الكوبون يلغي رسوم الشحن، ولا يحتاج إلى قيمة خصم.",
        save: "حفظ الكوبون",
        cancel: "إلغاء",
        saved: "تم حفظ الكوبون",
        errName: "أدخل اسم الكوبون.",
        errCode: "استخدم من 3 إلى 16 حرفًا أو رقمًا للرمز.",
        errValue: "أدخل قيمة خصم صحيحة.",
        errPercent: "يجب أن تكون النسبة بين 1 و100.",
        errDates: "يجب أن يكون تاريخ الانتهاء بعد تاريخ البداية.",
        errDays: "أدخل عدد أيام بين 1 و365.",
      },
    },
    sidebar: {
      collapse: "طي القائمة",
      expand: "توسيع القائمة",
      open: "فتح القائمة",
      close: "إغلاق القائمة",
      soon: "قريبًا",
      main: "القائمة الرئيسية",
    },
    notifications: {
      title: "الإشعارات",
      markAll: "تحديد الكل مقروءًا",
      tabs: ["الكل", "مهم", "الطلبات", "السلات المتروكة", "المدفوعات", "نشاط المتجر"],
      empty: "لا توجد إشعارات هنا",
      viewAll: "عرض الكل",
      templates: {
        welcome: "أهلًا بك في {brand}! أكمل إعداد متجرك لتبدأ البيع.",
        taskDone: "أكملت مهمة: {task}",
        couponCreated: "تم إنشاء الكوبون {code}",
        reminderSent: "أُرسل تذكير إلى {name}",
        ticketCreated: "تم إنشاء تذكرة الدعم {id}",
      },
    },
    support: {
      title: "تذاكر الدعم",
      newTicket: "تذكرة جديدة",
      cols: ["التذكرة", "التصنيف", "الحالة", "تاريخ الإنشاء", "إجراءات"],
      categories: ["الطلبات", "المدفوعات", "مشكلة تقنية", "أخرى"],
      statuses: ["مفتوحة", "مغلقة"],
      subject: "الموضوع",
      subjectPh: "بماذا تحتاج المساعدة؟",
      category: "التصنيف",
      message: "الرسالة",
      messagePh: "اشرح المشكلة بأكبر قدر ممكن من التفاصيل.",
      send: "إنشاء التذكرة",
      cancel: "إلغاء",
      close: "إغلاق التذكرة",
      reopen: "إعادة فتح",
      empty: "لا توجد تذاكر بعد",
      emptyHint: "افتح تذكرة إذا احتجت مساعدة في متجرك.",
      note: "هذا نموذج أولي: تبقى التذاكر على جهازك ولا تُرسل إلى أحد.",
      errSubject: "أدخل موضوع التذكرة.",
      errMessage: "اشرح مشكلتك في 10 أحرف على الأقل.",
    },
    settings: {
      tab: "إعدادات الحساب",
      group: "عام",
      entries: ["إعدادات الحساب", "الإشعارات"],
      back: "العودة إلى الرئيسية",
      save: "حفظ",
      saved: "تم حفظ الإعدادات على هذا الجهاز. هذا نموذج أولي، ولم يُرسل شيء.",
      account: {
        title: "بيانات الحساب",
        name: "الاسم",
        phone: "رقم جوالك",
        email: "البريد الإلكتروني",
        dob: "تاريخ ميلادك",
        gender: "الجنس",
        male: "ذكر",
        female: "أنثى",
        country: "الدولة",
        countries: ["الأردن"],
        city: "المدينة",
        cityPh: "اختر المدينة",
      },
      password: {
        title: "كلمة المرور",
        current: "أدخل كلمة المرور الحالية",
        next: "أدخل كلمة المرور الجديدة",
        confirm: "تأكيد كلمة المرور الجديدة",
        ph: "أدخل كلمة مرورك",
        note: "هذا نموذج أولي: تُفحص كلمات المرور هنا فقط ولا تُخزَّن أبدًا.",
      },
      errors: {
        name: "أدخل اسمك.",
        email: "أدخل بريدًا إلكترونيًا صحيحًا.",
        phone: "أدخل رقم جوال صحيحًا من 8 أرقام على الأقل.",
        dob: "لا يمكن أن يكون تاريخ الميلاد في المستقبل.",
        current: "أدخل كلمة المرور الحالية لتغييرها.",
        short: "يجب ألا تقل كلمة المرور الجديدة عن 8 أحرف.",
        mismatch: "كلمتا المرور غير متطابقتين.",
      },
    },
    featuresTitle: "يدعمك دكان في كل خطوة من رحلتك",
    features: [
      {
        id: "solutions",
        tag: "الانطلاق",
        title: "ابدأ بسهولة حتى مع انشغالك",
        body: "لا تحتاج إلى خبرة سابقة أو تفرّغ كامل لتبدأ البيع.",
        points: ["إعداد موجَّه يجعل متجرك جاهزًا بسرعة", "الطلبات والمنتجات والتقارير في لوحة واحدة", "جرّب متجرًا تجريبيًا جاهزًا قبل أن تبدأ"],
      },
      {
        id: "design",
        tag: "التصميم",
        title: "متجر يلفت النظر من أول لمحة",
        body: "صمّم متجرك بنفسك، بدون أي خبرة برمجية.",
        points: ["اضغط على أي عنصر وعدّله مباشرة", "غلاف وخلفية بصورة أو GIF أو فيديو", "رتّب أقسام متجرك كما تريد"],
      },
      {
        id: "payments",
        tag: "المدفوعات",
        title: "مدفوعات آمنة وثقة تدوم",
        body: "أدر مدفوعات متجرك وعملائك عبر نظام متكامل واحد.",
        points: ["بطاقات ومحافظ إلكترونية ووسائل دفع محلية", "فعّل المدفوعات خلال يوم واحد", "تحويل المبالغ بعد 24 ساعة من كل طلب"],
      },
      {
        id: "shipping",
        tag: "الشحن",
        title: "أسطول شحن متكامل لخدمة منتجاتك",
        body: "اربط متجرك بشركات الشحن بلا عقود ولا تعقيد.",
        points: ["شحن دكان: توصيلنا الخاص بسعر ثابت لكل طلب", "لديك شركة توصيل؟ أضفها وواصل العمل معها", "تتبّع كل طلب من الاستلام حتى باب البيت"],
      },
      {
        id: "marketing",
        tag: "التسويق",
        title: "كل أدوات التسويق في مكان واحد",
        body: "صِل إلى عملاء أكثر بحملات مصممة لمتجرك.",
        points: ["كوبونات خصم تساعد على إتمام الشراء", "تحكم كامل في العروض والخصومات", "استرجاع السلات المتروكة وإدارة الإعلانات"],
      },
    ],
    testimonialsTitle: "كن صاحب قصة النجاح القادمة",
    quotes: [
      { q: "استغرق الإعداد عصر يوم واحد، وجاءنا أول طلب في الليلة نفسها.", n: "تاجر تجريبي", s: "متجر أزياء" },
      { q: "أخيرًا صار الشحن والمدفوعات في لوحة واحدة، وهذا وحده يوفّر عليّ ساعات.", n: "تاجر تجريبي", s: "مستلزمات منزلية" },
      { q: "انتقلنا من مشروع جانبي إلى علامة تجارية حقيقية دون أن نغيّر المنصة.", n: "تاجر تجريبي", s: "علامة تجميل" },
      { q: "عملاؤنا يدفعون بكليك أو عند الاستلام، وكل الطلبات تصلني في مكان واحد.", n: "تاجر تجريبي", s: "متجر هدايا" },
      { q: "مصمم المتجر سمح لي بتغيير الشكل بنفسي دون أن أتصل بأحد.", n: "تاجر تجريبي", s: "متجر مجوهرات" },
      { q: "التقارير تُريني المنتجات التي تُترك في السلات، فأعرف لمن أرسل التذكير.", n: "تاجر تجريبي", s: "متجر إلكترونيات" },
    ],
    finalCta: {
      title: "امتلك متجرًا احترافيًا مع دكان",
      body: "أنشئ متجرك الآن بأدوات مرنة وحلول متكاملة تساعدك على نمو مبيعاتك.",
    },
    footer: {
      tagline: "تجارة ذكية للأردن وما بعده.",
      cols: [
        { title: "عن دكان", links: ["انضم لفريق دكان", "شروط الاستخدام", "سياسة الخصوصية"] },
        { title: "الموارد", links: ["مركز المساعدة", "الأسئلة الشائعة", "تواصل معنا"] },
      ],
      industriesTitle: "القطاعات",
      availableIn: "متاح في:",
      country: "الأردن",
      contact: { phone: "+962 6 000 0000", place: "عمّان، الأردن", email: "hello@dukkan.store" },
      social: ["تيك توك", "إكس", "يوتيوب", "إنستغرام"],
      legal: "© 2026 دكان. جميع الحقوق محفوظة. نموذج أولي وليس خدمة فعلية.",
    },
  },
};
