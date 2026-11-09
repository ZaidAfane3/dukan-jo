/* Page content in both languages. The landing page's own words (hero, industries, features, testimonials, footer...)
   are edited in Diwan and live in components/siteContent.ts; what is here is the rest of the site. */

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

export type Content = {
  dashboard: {
    revenueLabel: string;
    revenue: string;
    storeLabel: string;
    orders: { name: string; total: string; status: string }[];
    products: { name: string; price: string }[];
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
    passwordHint: string;
    errName: string;
    errEmail: string;
    errPassword: string;
    showPassword: string;
    hidePassword: string;
    register: string;
    loginBtn: string;
    loginId: string;
    loginIdPh: string;
    forgot: string;
    or: string;
    guest: string;
    errTaken: string;
    errPhoneTaken: string;
    errServer: string;
    errNoAccount: string;
    errWrongPassword: string;
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
    requiredNote: string;
    errName: string;
    product: {
      typeQuestion: string;
      types: { title: string; desc: string }[];
      dataTitle: string;
      imageAdd: string;
      imageBrowse: string;
      errImage: string;
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
      errQuantity: string;
      unlimited: string;
      limited: string;
      previewEmpty: string;
      previewMobile: string;
      previewDesktop: string;
      productDefault: string;
      addToCart: string;
      buyNow: string;
      add: string;
      errName: string;
      errPrice: string;
      errWeight: string;
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
      /* Dukkan Ship's price, its line under the price, pickup cities and points are platform settings (Diwan, dukkan_ship):
         components/platformPublic.ts shipWords gives them in the page's language */
      perOrder: string;
      change: string;
      cityLabel: string;
      cityPh: string;
      /* every governorate a city may have been saved as before */
      allCities: string[];
      addressLabel: string;
      addressPh: string;
      previewSeen: string;
      errCity: string;
      errName: string;
      errAddress: string;
    };
    service: { label: string; hint: string; phoneLabel: string; phonePh: string; invalid: string; previewHint: string; contact: string; useSame: string; registered: string; otherLabel: string; oneNeeded: string; waLabel: string; waHint: string; waOther: string; waEmpty: string; waInvalid: string; callLabel: string; callHint: string; callSame: string; callOther: string; callEmpty: string };
    domain: {
      label: string;
      hint: string;
      prefix: string;
      ph: string;
      examples: string;
      invalid: string;
      errEmpty: string;
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
      nameHint: string;
      description: string;
      descriptionPh: string;
      descriptionHint: string;
      errCode: string;
      errValue: string;
      errPercent: string;
      errDates: string;
      errDays: string;
      errDup: string;
      errPast: string;
      errOverMin: string;
      example: string;
    };
    turnOn: string;
    turnOff: string;
    expiredOff: string;
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
    templates: Record<"welcome" | "taskDone" | "couponCreated" | "reminderSent" | "ticketCreated" | "orderCreated", string>;
    /* what Dukkan's side sends to the bell (server/notify.ts); {name} parts come from the notification, {note} and
       {reason} already start with `sep` when there is one */
    server: {
      ticketReplied: string; ticketSolved: string; ticketClosed: string;
      domainActive: string; domainFailed: string; domainOther: string;
      documentApproved: string; documentRejected: string; documentOther: string;
      shopSuspended: string; shopReactivated: string;
      planChanged: string; until: string;
      paymentReceived: string; methods: { bank: string; cliq: string; cash: string; card: string };
      supportViewed: string;
      statusWords: Record<string, string>;
      sep: string;
      announcement: string;
      dismiss: string;
    };
  };
  support: {
    title: string;
    newTicket: string;
    cols: string[];
    categories: string[];
    statuses: string[];
    /* bug or idea: the badge on a ticket and the filter above the list */
    kinds: { bug: string; idea: string };
    filters: { all: string; bug: string; idea: string };
    filterLabel: string;
    noneOfKind: string;
    subject: string;
    subjectPh: string;
    category: string;
    message: string;
    messagePh: string;
    pictures: string;
    optional: string;
    picturesHint: string;
    addPicture: string;
    removePicture: string;
    picturesFull: string;
    picturesCount: string;
    send: string;
    cancel: string;
    close: string;
    reopen: string;
    empty: string;
    emptyHint: string;
    note: string;
    errSubject: string;
    errMessage: string;
    /* signed in: tickets go to Dukkan and are answered in a conversation */
    server: {
      note: string;
      cols: string[];
      statuses: { open: string; reply: string; solved: string; closed: string };
      newReply: string;
      view: string;
      loading: string;
      loadFailed: string;
      sendFailed: string;
      tooMany: string;
      picturesBad: string;
      you: string;
      dukkan: string;
      where: string;
      replyLabel: string;
      replyPh: string;
      sendReply: string;
      sending: string;
      back: string;
      closedNote: string;
      enlarge: string;
      retry: string;
      notFound: string;
      system: { closedByYou: string; reopenedByYou: string; solved: string; closed: string };
    };
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
      dob: string;
      current: string;
      short: string;
      mismatch: string;
    };
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
      passwordHint: "8 characters at least",
      errName: "Enter your full name.",
      errEmail: "Enter a valid email address, e.g. name@example.com",
      errPassword: "The password must be at least 8 characters.",
      showPassword: "Show password",
      hidePassword: "Hide password",
      register: "Register",
      loginBtn: "Log in",
      loginId: "Email / phone number",
      loginIdPh: "Enter your email or phone number",
      forgot: "Forgot your password?",
      or: "or",
      guest: "Continue without an account",
      errTaken: "This email already has an account. Log in instead.",
      errPhoneTaken: "This mobile number already has an account. Log in instead.",
      errServer: "We couldn't reach Dukkan right now. Check your connection and try again.",
      errNoAccount: "No account with this email or number. Create one first.",
      errWrongPassword: "The password is not right. Try again.",
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
      requiredNote: "Fields with * must be filled",
      errName: "Enter a store name, at least 2 letters.",
      product: {
        typeQuestion: "What type of product do you want to add?",
        types: [
          { title: "A product you ship", desc: "Clothes, perfumes, devices… needs delivery" },
          { title: "A file to download", desc: "E-books, courses, designs… delivered instantly" },
          { title: "A card or code", desc: "Gift cards, subscriptions, activation codes" },
        ],
        dataTitle: "Add product details",
        imageAdd: "Add a new image",
        imageBrowse: "Or browse from your device",
        errImage: "Add a photo of the product. Every product needs one.",
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
        errQuantity: "Enter how many you have, or choose unlimited.",
        unlimited: "Unlimited quantity",
        limited: "Limited quantity",
        previewEmpty: "Enter product data to see it here",
        previewMobile: "Mobile",
        previewDesktop: "Desktop",
        productDefault: "Product name",
        addToCart: "Add to cart",
        buyNow: "Buy now",
        add: "Add product",
        errName: "Enter a product name, at least 2 letters.",
        errPrice: "Enter a price above 0.",
        errWeight: "Enter the product weight in kg.",
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
        phoneInvalid: "Enter a valid Jordan mobile number, e.g. 0791234567",
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
        /* Dukkan Ship's price, the line under it, its pickup cities and its points are platform settings Dukkan's staff
           change in Diwan (dukkan_ship): components/platformPublic.ts shipWords */
        perOrder: "per order",
        change: "Change delivery option",
        cityLabel: "Pickup city",
        cityPh: "Choose a city",
        allCities: ["Amman", "Irbid", "Zarqa", "Balqa", "Madaba", "Karak", "Tafilah", "Ma'an", "Aqaba", "Jerash", "Ajloun", "Mafraq", "Salt"],
        addressLabel: "Pickup address",
        addressPh: "Street, building number, landmark",
        previewSeen: "This is how Dukkan Ship will appear in your account",
        errCity: "Choose a pickup city.",
        errName: "Enter their name, at least 2 letters.",
        errAddress: "Enter the pickup address: area, street and building.",
      },
      service: {
        label: "Customer service number",
        hint: "Add the number you want to receive your customers' inquiries on.",
        phoneLabel: "Phone number",
        phonePh: "7X XXX XXXX",
        invalid: "Enter a valid Jordan mobile number, e.g. 0791234567",
        previewHint: "Your number appears in your store footer",
        contact: "Contact us",
        useSame: "Use the same number registered in your account",
        registered: "Registered number",
        otherLabel: "Customer service phone number",
        oneNeeded: "Add at least one: a WhatsApp number, a phone number for calls, or both.",
        waLabel: "WhatsApp number",
        waEmpty: "Leave it empty if you don't use WhatsApp, and add a phone number for calls.",
        waHint: "Customers message you on it from the WhatsApp button in your store footer and on product pages.",
        waOther: "WhatsApp number",
        waInvalid: "Enter a valid Jordan mobile number for WhatsApp, e.g. 0791234567",
        callLabel: "Phone number for calls",
        callHint: "If you want customers to call you. It shows beside WhatsApp in your store footer.",
        callSame: "Same number as WhatsApp",
        callOther: "Phone number for calls",
        callEmpty: "Leave it empty if you don't take calls.",
      },
      domain: {
        label: "Store domain",
        hint: "This is the link your customers use to visit your store.",
        prefix: "dukkan.store/",
        ph: "domain",
        examples: "Examples: dukkan.store/brandname or dukkan.store/brand-name",
        invalid: "Use 3 to 30 letters (a to z), numbers or hyphens. It can't start or end with a hyphen.",
        errEmpty: "Choose your store domain.",
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
        nameHint: "Optional. Leave empty to use the code.",
        description: "Description",
        descriptionPh: "For example: 10% off everything for our summer customers",
        descriptionHint: "Optional. A note about the coupon, up to 300 characters.",
        errCode: "Use 3 to 16 letters or numbers for the code.",
        errValue: "Enter a valid discount value.",
        errPercent: "A percentage must be between 1 and 100.",
        errDates: "The end date must be after the start date.",
        errDays: "Enter a number of days between 1 and 365.",
        errDup: "You already have a coupon with this code.",
        errPast: "The end date has already passed. Pick today or a later date.",
        errOverMin: "The discount can't be more than the minimum order amount.",
        example: "e.g.",
      },
      turnOn: "Turn on coupon {code}",
      turnOff: "Turn off coupon {code}",
      expiredOff: "This coupon has expired. Change its end date to turn it on again.",
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
        orderCreated: "New order #{id} from {name}: {total}",
        reminderSent: "A reminder was sent to {name}",
        ticketCreated: "Support ticket {id} was created",
      },
      server: {
        ticketReplied: "Dukkan replied to your ticket #{number}: {subject}",
        ticketSolved: "Your ticket #{number} was marked as solved: {subject}",
        ticketClosed: "Your ticket #{number} was closed: {subject}",
        domainActive: "Your domain {domain} is connected and working",
        domainFailed: "Your domain {domain} could not be connected{note}",
        domainOther: "Your domain {domain}: {status}{note}",
        documentApproved: "Your document “{name}” was approved",
        documentRejected: "Your document “{name}” was not accepted{note}",
        documentOther: "Your document “{name}”: {status}{note}",
        shopSuspended: "Your store was suspended{reason}",
        shopReactivated: "Your store is open again",
        planChanged: "Your plan is now {plan}{ends}",
        until: ", until {date}",
        paymentReceived: "Dukkan received your payment of {amount} JOD by {method}",
        methods: { bank: "bank transfer", cliq: "CliQ", cash: "cash", card: "card" },
        supportViewed: "Dukkan support opened your store to help you",
        statusWords: { active: "connected", failed: "failed", awaiting: "waiting", checking: "being checked", removed: "removed", approved: "approved", rejected: "not accepted", waiting: "waiting" },
        sep: ": ",
        announcement: "From Dukkan",
        dismiss: "Dismiss",
      },
    },
    support: {
      title: "Support tickets",
      newTicket: "New ticket",
      cols: ["Ticket", "Category", "Status", "Created", "Actions"],
      categories: ["Orders", "Payments", "Technical issue", "Store design", "Suggestions", "Other"],
      statuses: ["Open", "Closed"],
      kinds: { bug: "Bug", idea: "Idea" },
      filters: { all: "All", bug: "Bugs", idea: "Ideas" },
      filterLabel: "Show",
      noneOfKind: "No tickets of this kind yet.",
      subject: "Subject",
      subjectPh: "What do you need help with?",
      category: "Category",
      message: "Message",
      messagePh: "Describe the problem with as much detail as you can.",
      pictures: "Pictures",
      optional: "Optional",
      picturesHint: "Screenshots help us see the problem. Up to 5 pictures.",
      addPicture: "Add a picture",
      removePicture: "Remove this picture",
      picturesFull: "You can add up to 5 pictures.",
      picturesCount: "pictures",
      send: "Create ticket",
      cancel: "Cancel",
      close: "Close ticket",
      reopen: "Reopen",
      empty: "No tickets yet",
      emptyHint: "Open a ticket if you need help with your store.",
      note: "Prototype: tickets stay on this device and are not sent to anyone.",
      errSubject: "Enter a subject.",
      errMessage: "Describe your problem in at least 10 characters.",
      server: {
        note: "Dukkan's support team reads every ticket and answers you here.",
        cols: ["Ticket", "Category", "Status", "Last activity", "Actions"],
        statuses: { open: "Open", reply: "Waiting for your reply", solved: "Solved", closed: "Closed" },
        newReply: "New reply",
        view: "Open",
        loading: "Loading your tickets…",
        loadFailed: "Your tickets could not be loaded. Check your connection and try again.",
        sendFailed: "It could not be sent. Check your connection and try again.",
        tooMany: "You have sent a lot in a short time. Please try again in a little while.",
        picturesBad: "One of the pictures could not be sent. Remove it and try again.",
        you: "You",
        dukkan: "Dukkan support",
        where: "Where",
        replyLabel: "Your reply",
        replyPh: "Write your reply…",
        sendReply: "Send reply",
        sending: "Sending…",
        back: "Back to tickets",
        closedNote: "This ticket is closed. Sending a reply opens it again.",
        enlarge: "Open the picture",
        retry: "Try again",
        notFound: "This ticket could not be found.",
        system: { closedByYou: "You closed this ticket", reopenedByYou: "You reopened this ticket", solved: "Dukkan marked this ticket as solved", closed: "Dukkan closed this ticket" },
      },
    },
    settings: {
      tab: "Account settings",
      group: "General",
      entries: ["Account settings", "Customize notifications"],
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
        dob: "The date of birth can't be in the future.",
        current: "Enter your current password to change it.",
        short: "The new password must be at least 8 characters.",
        mismatch: "The two passwords don't match.",
      },
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
      passwordHint: "8 أحرف على الأقل",
      errName: "أدخل اسمك الكامل.",
      errEmail: "أدخل بريدًا إلكترونيًا صحيحًا، مثل name@example.com",
      errPassword: "يجب ألا تقل كلمة المرور عن 8 أحرف.",
      showPassword: "إظهار كلمة المرور",
      hidePassword: "إخفاء كلمة المرور",
      register: "إنشاء الحساب",
      loginBtn: "تسجيل الدخول",
      loginId: "البريد الإلكتروني / رقم الجوال",
      loginIdPh: "أدخل بريدك الإلكتروني أو رقم جوالك",
      forgot: "نسيت كلمة المرور؟",
      or: "أو",
      guest: "المتابعة بدون حساب",
      errTaken: "يوجد حساب بهذا البريد. سجّل الدخول بدلًا من ذلك.",
      errPhoneTaken: "يوجد حساب بهذا الرقم. سجّل الدخول بدلًا من ذلك.",
      errServer: "تعذّر الاتصال بدكان الآن. تحقّق من اتصالك وحاول مرة أخرى.",
      errNoAccount: "لا يوجد حساب بهذا البريد أو الرقم. أنشئ حسابًا أولًا.",
      errWrongPassword: "كلمة المرور غير صحيحة. حاول مرة أخرى.",
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
      requiredNote: "الحقول التي عليها * مطلوبة",
      errName: "أدخل اسم المتجر، حرفان على الأقل.",
      product: {
        typeQuestion: "ما نوع المنتج الذي تود إضافته؟",
        types: [
          { title: "منتج يُشحن", desc: "ملابس، عطور، أجهزة… يحتاج توصيلًا" },
          { title: "ملف للتحميل", desc: "كتب إلكترونية، دورات، تصاميم… يصل للعميل فورًا" },
          { title: "بطاقة أو رمز", desc: "بطاقات هدايا، اشتراكات، أكواد تفعيل" },
        ],
        dataTitle: "أضف بيانات المنتج",
        imageAdd: "أضف صورة جديدة",
        imageBrowse: "أو تصفّح من جهازك",
        errImage: "أضف صورة للمنتج، فكل منتج يحتاج صورة.",
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
        errQuantity: "أدخل الكمية المتوفرة، أو اختر غير محدودة.",
        unlimited: "كمية لا محدودة",
        limited: "كمية محدودة",
        previewEmpty: "أدخل بيانات المنتج لمعاينة ظهوره هنا",
        previewMobile: "جوال",
        previewDesktop: "كمبيوتر",
        productDefault: "اسم المنتج",
        addToCart: "أضف للسلة",
        buyNow: "اشترِ الآن",
        add: "إضافة المنتج",
        errName: "أدخل اسم المنتج، حرفان على الأقل.",
        errPrice: "أدخل سعرًا أكبر من 0.",
        errWeight: "أدخل وزن المنتج بالكيلوغرام.",
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
        phoneInvalid: "أدخل رقم موبايل أردني صحيح، مثل 0791234567",
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
        perOrder: "لكل طلب",
        change: "تغيير خيار التوصيل",
        cityLabel: "مدينة الاستلام",
        cityPh: "اختر المدينة",
        allCities: ["عمّان", "إربد", "الزرقاء", "البلقاء", "مأدبا", "الكرك", "الطفيلة", "معان", "العقبة", "جرش", "عجلون", "المفرق", "السلط"],
        addressLabel: "عنوان الاستلام",
        addressPh: "الشارع، رقم المبنى، أقرب معلم",
        previewSeen: "هكذا سيظهر شحن دكان في حسابك",
        errCity: "اختر مدينة الاستلام.",
        errName: "أدخل الاسم، حرفان على الأقل.",
        errAddress: "أدخل عنوان الاستلام: المنطقة والشارع والمبنى.",
      },
      service: {
        label: "رقم خدمة العملاء",
        hint: "أضف الرقم الذي تود استخدامه لتلقّي استفسارات عملائك.",
        phoneLabel: "رقم الجوال",
        phonePh: "7X XXX XXXX",
        invalid: "أدخل رقم موبايل أردني صحيح، مثل 0791234567",
        previewHint: "سيظهر رقمك في تذييل متجرك",
        contact: "تواصل معنا",
        useSame: "استخدام نفس الرقم المسجَّل في حسابك",
        registered: "الرقم المسجّل",
        otherLabel: "رقم جوال خدمة العملاء",
        oneNeeded: "أضف رقمًا واحدًا على الأقل: واتساب، أو رقمًا للاتصال، أو الاثنين.",
        waLabel: "رقم واتساب",
        waEmpty: "اتركه فارغًا إن كنت لا تستخدم واتساب، وأضف رقمًا للاتصال.",
        waHint: "يراسلك العملاء عليه من زر واتساب في تذييل متجرك وصفحات المنتجات.",
        waOther: "رقم واتساب",
        waInvalid: "أدخل رقم موبايل أردني صحيح لواتساب، مثل 0791234567",
        callLabel: "رقم للاتصال",
        callHint: "إن أردت أن يتصل بك العملاء هاتفيًا. يظهر بجانب واتساب في تذييل متجرك.",
        callSame: "نفس رقم واتساب",
        callOther: "رقم للاتصال",
        callEmpty: "اتركه فارغًا إن كنت لا تستقبل اتصالات.",
      },
      domain: {
        label: "دومين المتجر",
        hint: "هذا هو الرابط الذي يستخدمه العملاء لزيارة متجرك.",
        prefix: "dukkan.store/",
        ph: "domain",
        examples: "أمثلة: dukkan.store/brandname أو dukkan.store/brand-name",
        invalid: "استخدم من 3 إلى 30 حرفًا لاتينيًا (a-z) أو أرقامًا أو شرطات، ولا يبدأ أو ينتهي بشرطة.",
        errEmpty: "اختر دومين متجرك.",
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
          { id: "i-notify", kind: "stat", unit: "count", tone: "bad", title: "منتجات عليها طلب 'أعلمني عند التوفر'", desc: "عدد المنتجات التي نفدت من المخزون وطلب العملاء إشعارًا عند توفرها مجددًا." },
          { id: "i-wish", kind: "list", title: "أكثر المنتجات إضافة لقوائم الأمنيات", desc: "قائمة بالمنتجات الأكثر إضافة إلى قوائم أمنيات عملاء متجرك خلال الفترة الزمنية المحددة.", items: ["حقيبة يومية", "قارورة معدنية", "جاكيت عملي", "كاب قماشي"] },
          { id: "i-req", kind: "list", title: "أكثر المنتجات طلبًا عبر 'أعلمني عند التوفر'", desc: "قائمة بالمنتجات التي طلب العملاء إشعارًا عند توفرها من جديد خلال الفترة الزمنية المحددة.", items: ["حقيبة يومية", "قارورة معدنية", "جاكيت عملي", "كاب قماشي"] },
          { id: "i-stock", kind: "breakdown", title: "نسب توفّر مخزون المنتجات", desc: "يعرض حالة المخزون لجميع المنتجات حسب الكميات المتوفرة خلال الفترة الزمنية المحددة.", items: ["متوفر", "مخزون منخفض", "نفد من المخزون"] },
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
        nameHint: "اختياري. اتركه فارغًا لاستخدام الرمز.",
        description: "الوصف",
        descriptionPh: "مثال: خصم 10% على كل المنتجات لعملائنا في الصيف",
        descriptionHint: "اختياري. ملاحظة عن الكوبون، حتى 300 حرف.",
        errCode: "استخدم من 3 إلى 16 حرفًا أو رقمًا للرمز.",
        errValue: "أدخل قيمة خصم صحيحة.",
        errPercent: "يجب أن تكون النسبة بين 1 و100.",
        errDates: "يجب أن يكون تاريخ الانتهاء بعد تاريخ البداية.",
        errDays: "أدخل عدد أيام بين 1 و365.",
        errDup: "لديك كوبون آخر بنفس الرمز.",
        errPast: "تاريخ الانتهاء مضى. اختر اليوم أو تاريخًا لاحقًا.",
        errOverMin: "لا يمكن أن يكون الخصم أكبر من الحد الأدنى للطلب.",
        example: "مثال:",
      },
      turnOn: "تفعيل الكوبون {code}",
      turnOff: "إيقاف الكوبون {code}",
      expiredOff: "انتهت صلاحية هذا الكوبون. غيّر تاريخ الانتهاء لتفعيله من جديد.",
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
        orderCreated: "طلب جديد رقم {id} من {name}: {total}",
        reminderSent: "أُرسل تذكير إلى {name}",
        ticketCreated: "تم إنشاء تذكرة الدعم {id}",
      },
      server: {
        ticketReplied: "ردّ دكّان على تذكرتك رقم {number}: {subject}",
        ticketSolved: "تم حل تذكرتك رقم {number}: {subject}",
        ticketClosed: "أُغلقت تذكرتك رقم {number}: {subject}",
        domainActive: "نطاقك {domain} متصل ويعمل",
        domainFailed: "تعذّر ربط نطاقك {domain}{note}",
        domainOther: "نطاقك {domain}: {status}{note}",
        documentApproved: "تمت الموافقة على مستندك «{name}»",
        documentRejected: "لم يُقبل مستندك «{name}»{note}",
        documentOther: "مستندك «{name}»: {status}{note}",
        shopSuspended: "تم إيقاف متجرك{reason}",
        shopReactivated: "عاد متجرك للعمل",
        planChanged: "باقتك الآن {plan}{ends}",
        until: "، حتى {date}",
        paymentReceived: "استلم دكّان دفعتك بقيمة {amount} د.أ عبر {method}",
        methods: { bank: "تحويل بنكي", cliq: "كليك", cash: "نقدًا", card: "بطاقة" },
        supportViewed: "فتح فريق دعم دكّان متجرك لمساعدتك",
        statusWords: { active: "متصل", failed: "تعذّر", awaiting: "بالانتظار", checking: "قيد التحقق", removed: "محذوف", approved: "مقبول", rejected: "غير مقبول", waiting: "بالانتظار" },
        sep: ": ",
        announcement: "من دكّان",
        dismiss: "إخفاء",
      },
    },
    support: {
      title: "تذاكر الدعم",
      newTicket: "تذكرة جديدة",
      cols: ["التذكرة", "التصنيف", "الحالة", "تاريخ الإنشاء", "إجراءات"],
      categories: ["الطلبات", "المدفوعات", "مشكلة تقنية", "تصميم المتجر", "اقتراحات", "أخرى"],
      statuses: ["مفتوحة", "مغلقة"],
      kinds: { bug: "خطأ", idea: "اقتراح" },
      filters: { all: "الكل", bug: "الأخطاء", idea: "الاقتراحات" },
      filterLabel: "عرض",
      noneOfKind: "لا توجد تذاكر من هذا النوع بعد.",
      subject: "الموضوع",
      subjectPh: "بماذا تحتاج المساعدة؟",
      category: "التصنيف",
      message: "الرسالة",
      messagePh: "اشرح المشكلة بأكبر قدر ممكن من التفاصيل.",
      pictures: "الصور",
      optional: "اختياري",
      picturesHint: "لقطات الشاشة تساعدنا على فهم المشكلة. حتى 5 صور.",
      addPicture: "أضف صورة",
      removePicture: "احذف هذه الصورة",
      picturesFull: "يمكنك إضافة 5 صور كحد أقصى.",
      picturesCount: "صور",
      send: "إنشاء التذكرة",
      cancel: "إلغاء",
      close: "إغلاق التذكرة",
      reopen: "إعادة فتح",
      empty: "لا توجد تذاكر بعد",
      emptyHint: "افتح تذكرة إذا احتجت مساعدة في متجرك.",
      note: "هذا نموذج أولي: تبقى التذاكر على جهازك ولا تُرسل إلى أحد.",
      errSubject: "أدخل موضوع التذكرة.",
      errMessage: "اشرح مشكلتك في 10 أحرف على الأقل.",
      server: {
        note: "يقرأ فريق دعم دكّان كل تذكرة ويرد عليك هنا.",
        cols: ["التذكرة", "التصنيف", "الحالة", "آخر نشاط", "إجراءات"],
        statuses: { open: "مفتوحة", reply: "بانتظار ردّك", solved: "تم الحل", closed: "مغلقة" },
        newReply: "رد جديد",
        view: "فتح",
        loading: "جارٍ تحميل تذاكرك…",
        loadFailed: "تعذّر تحميل تذاكرك. تحقق من الاتصال وحاول مرة أخرى.",
        sendFailed: "تعذّر الإرسال. تحقق من الاتصال وحاول مرة أخرى.",
        tooMany: "أرسلت كثيرًا في وقت قصير. حاول مرة أخرى بعد قليل.",
        picturesBad: "تعذّر إرسال إحدى الصور. احذفها وحاول مرة أخرى.",
        you: "أنت",
        dukkan: "دعم دكّان",
        where: "المكان",
        replyLabel: "ردّك",
        replyPh: "اكتب ردّك…",
        sendReply: "إرسال الرد",
        sending: "جارٍ الإرسال…",
        back: "العودة إلى التذاكر",
        closedNote: "هذه التذكرة مغلقة. إرسال رد يعيد فتحها.",
        enlarge: "فتح الصورة",
        retry: "حاول مرة أخرى",
        notFound: "لم نجد هذه التذكرة.",
        system: { closedByYou: "أغلقت هذه التذكرة", reopenedByYou: "أعدت فتح هذه التذكرة", solved: "حدّد دكّان هذه التذكرة كمحلولة", closed: "أغلق دكّان هذه التذكرة" },
      },
    },
    settings: {
      tab: "إعدادات الحساب",
      group: "عام",
      entries: ["إعدادات الحساب", "تخصيص الإشعارات"],
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
        dob: "لا يمكن أن يكون تاريخ الميلاد في المستقبل.",
        current: "أدخل كلمة المرور الحالية لتغييرها.",
        short: "يجب ألا تقل كلمة المرور الجديدة عن 8 أحرف.",
        mismatch: "كلمتا المرور غير متطابقتين.",
      },
    },
  },
};
