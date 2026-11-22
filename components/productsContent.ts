import type { Lang } from "./content";
import { arCount } from "./undo";
import type { ProductKind } from "./safeOrder";

export type FilterKey =
  | "all"
  | "unpriced"
  | "featured"
  | "hidden"
  | "discounted"
  | "soldOut"
  | "forSale"
  | "uncategorized"
  | "shipping"
  | "nearSoldOut"
  | "noDescription"
  | "deleted";

export const FILTER_KEYS: FilterKey[] = [
  "all",
  "unpriced",
  "featured",
  "hidden",
  "discounted",
  "soldOut",
  "forSale",
  "uncategorized",
  "shipping",
  "nearSoldOut",
  "noDescription",
  "deleted",
];

type Copy = {
  title: string;
  tabs: string[];
  newProduct: string;
  searchPh: string;
  filters: Record<FilterKey, string>;
  currency: string;
  empty: string;
  emptyHint: string;
  noMatch: string;
  /* a list with nothing in it and nothing searched: Deleted products, or another filter */
  binEmpty: string;
  noneHere: string;
  pickOne: string;
  sort: string;
  sorts: string[];
  selectAll: string;
  refresh: string;
  deleteSelected: string;
  basic: string;
  name: string;
  namePh: string;
  images: string;
  imagesHint: string;
  imagesBad: string;
  /* more photos were picked than fit (6 in all) */
  imagesMax: string;
  focusTitle: string;
  focusNote: string;
  focusCenter: string;
  shapeTall: string;
  shapeSquare: string;
  shapeWide: string;
  addImage: string;
  primary: string;
  removeImage: string;
  price: string;
  sale: string;
  saleHint: string;
  cost: string;
  costHint: string;
  category: string;
  categoryPh: string;
  catHint: string;
  costAbove: string;
  catNewPh: string;
  catAdd: string;
  catNone: string;
  catRemove: string;
  catEmpty: string;
  brand: string;
  brandPh: string;
  description: string;
  descriptionPh: string;
  notes: string;
  notesPh: string;
  notesHint: string;
  badge: string;
  badgePh: string;
  badgeHint: string;
  visibility: string;
  hidden: string;
  hiddenHint: string;
  featured: string;
  featuredHint: string;
  shipping: string;
  shippingHint: string;
  stock: string;
  quantity: string;
  quantityHint: string;
  /* "1 piece", "5 pieces" (Arabic: قطعة واحدة، قطعتان، 5 قطع، 11 قطعة) */
  pieces: (n: number) => string;
  alerts: string;
  lowAt: string;
  sendBy: string;
  sendByCustomers: string;
  byWhatsapp: string;
  byEmail: string;
  byBoth: string;
  lowAtHint: string;
  restockMin: string;
  restockMinHint: string;
  save: string;
  cancel: string;
  delete: string;
  errName: string;
  errPrice: string;
  priceZero: string;
  saleZero: string;
  discardAsk: string;
  discardKeep: string;
  discardYes: string;
  errSale: string;
  errImages: string;
  imagesUploading: string;
  imageBroken: string;
  errQuantity: string;
  errStockAsk: string;
  unlimited: string;
  unlimitedHint: string;
  unlimitedShort: string;
  /* in the list, for a product with none left */
  soldOutShort: string;
  otherCategory: string;
  requiredNote: string;
  untitled: string;
  inStock: string;
  noPrice: string;
  edit: string;
  restore: string;
  deletedNote: string;
  deleteForever: string;
  foreverAsk: string;
  foreverYes: string;
  moveToTrash: string;
  unsavedPhoto: string;
  /* the undo note at the bottom (UndoToast.tsx): what was just done; "Deleted products" is where deleted ones go */
  undoBin: (n: number, name: string) => string;
  undoRestored: (n: number, name: string) => string;
  undoAdded: (name: string) => string;
  undoEdited: (name: string) => string;
  undoForever: (name: string) => string;
  undoCat: (category: string) => string;
};

export const productsCopy: Record<Lang, Copy> = {
  en: {
    title: "Products",
    tabs: ["Manage products"],
    newProduct: "New product",
    searchPh: "Search products",
    filters: {
      all: "All products",
      unpriced: "Products without a price",
      featured: "Featured products",
      hidden: "Hidden products",
      discounted: "Discounted products",
      soldOut: "Sold-out products",
      forSale: "Products for sale",
      uncategorized: "Products without a category (shown under Other)",
      shipping: "Products that need shipping",
      nearSoldOut: "Products almost sold out",
      noDescription: "Products without a description",
      deleted: "Deleted products",
    },
    currency: "JOD",
    empty: "No products yet",
    emptyHint: "Add your first product and it will show up in your store.",
    noMatch: "No products match your search",
    binEmpty: "No deleted products. Products you delete wait here, so you can bring them back.",
    noneHere: "No products here",
    pickOne: "Select a product to edit it, or add a new one",
    sort: "Sort",
    sorts: ["Newest first", "Name", "Price: low to high", "Price: high to low"],
    selectAll: "Select all",
    refresh: "Refresh",
    deleteSelected: "Delete selected",
    basic: "Basic information",
    name: "Product name",
    namePh: "For example: Cotton shirt",
    images: "Product images",
    imagesHint: "PNG, JPG or WebP, up to 8 MB each. They are shrunk and saved with the product, and your store shows the first one.",
    imagesBad: "Some files could not be added. Use PNG, JPG or WebP pictures up to 8 MB.",
    imagesMax: "A product has up to 6 photos: only the first ones that fit were added.",
    focusTitle: "What stays visible",
    focusNote: "Your store crops the picture to fit its shape (tall, square or wide). Tap the part of the main picture that must always show, like the cap or the label. The three small pictures show how it will look.",
    focusCenter: "Back to the center",
    shapeTall: "Tall",
    shapeSquare: "Square",
    shapeWide: "Wide",
    addImage: "Upload a product photo",
    primary: "Main",
    removeImage: "Remove image",
    price: "Price",
    sale: "Discounted price",
    saleHint: "Leave empty if the product has no discount.",
    cost: "Cost price",
    costHint: "Only you see this. It is used to work out your profit.",
    category: "Category",
    categoryPh: "For example: Clothing",
    catHint: "Optional. Pick one or more of your categories, or make a new one. Your store uses them in its menu and filters, and shows products without one under Other. A category a product uses can't be deleted.",
    costAbove: "The cost is higher than the price: you lose money on every sale",
    catNewPh: "e.g. Men, Women, Boys, Girls",
    catAdd: "Add",
    catNone: "No categories yet. Add your first one below.",
    catRemove: "Remove this category",
    catEmpty: "No category (Other)",
    brand: "Brand",
    brandPh: "Brand name",
    description: "Product description",
    descriptionPh: "Write the details your customers need",
    notes: "Description",
    notesPh: "e.g. cotton · soft · light",
    notesHint: "A short description. It shows on the product page only, not on the product card.",
    badge: "Label on the picture",
    badgePh: "e.g. New",
    badgeHint: "A small label on the card, like New or Best seller.",
    visibility: "Visibility and options",
    hidden: "Hide product from the store",
    hiddenHint: "Customers cannot see or buy a hidden product.",
    featured: "Feature this product",
    featuredHint: "Featured products are highlighted on your store.",
    shipping: "Needs shipping",
    shippingHint: "Turn off for digital products and services.",
    stock: "Quantity",
    quantity: "Available quantity",
    quantityHint: "The number of pieces you have in stock. It goes down by itself with every order from your store.",
    pieces: (n) => (n === 1 ? "1 piece" : `${n.toLocaleString("en")} pieces`),
    alerts: "Alerts",
    lowAt: "Warn me when the quantity reaches",
    sendBy: "How the warning reaches you",
    sendByCustomers: "How customers are told",
    byWhatsapp: "WhatsApp",
    byEmail: "Email",
    byBoth: "Both",
    lowAtHint: "At this number or below, the product shows under low stock in Reports.",
    restockMin: "Notify subscribed customers when quantity is above",
    restockMinHint: "Avoids sending alerts when only a few pieces come back. Default 15.",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete product",
    errName: "Enter the product name",
    errPrice: "Enter a valid price",
    priceZero: "The price is zero. Is this product free?",
    saleZero: "A sale price of 0 makes this product free. Leave it empty for no sale.",
    discardAsk: "You have changes that are not saved. Leave without saving?",
    discardKeep: "Keep editing",
    discardYes: "Leave without saving",
    errSale: "The discounted price must be lower than the price",
    errImages: "Add at least one product photo. Customers need to see what they are buying.",
    imagesUploading: "Wait for the photo to finish uploading, then save.",
    imageBroken: "This photo could not be loaded. Remove it and upload it again.",
    errQuantity: "Enter how many you have, or choose Unlimited quantity.",
    errStockAsk: "Confirm this big quantity, or make it unlimited.",
    unlimited: "Unlimited quantity",
    unlimitedHint: "For products you can always make or order again. They never sell out in your store.",
    unlimitedShort: "Unlimited",
    soldOutShort: "Sold out",
    otherCategory: "Other",
    requiredNote: "Fields with * must be filled",
    untitled: "Untitled product",
    inStock: "in stock",
    noPrice: "No price",
    edit: "Edit product",
    restore: "Restore product",
    deletedNote: "This product is deleted. Restore it to bring it back with all its details.",
    deleteForever: "Delete permanently",
    foreverAsk: "Delete this product for good? It cannot be restored.",
    foreverYes: "Yes, delete for good",
    moveToTrash: "Delete product",
    unsavedPhoto: "Photos are not saved with the product in this prototype",
    undoBin: (n, name) => (n === 1 ? `“${name}” moved to Deleted products` : `${n} products moved to Deleted products`),
    undoRestored: (n, name) => (n === 1 ? `“${name}” restored` : `${n} products restored`),
    undoAdded: (name) => `“${name}” added`,
    undoEdited: (name) => `Changes to “${name}” saved`,
    undoForever: (name) => `“${name}” deleted permanently`,
    undoCat: (c) => `Category “${c}” removed`,
  },
  ar: {
    title: "المنتجات",
    tabs: ["إدارة المنتجات"],
    newProduct: "منتج جديد",
    searchPh: "ابحث في المنتجات",
    filters: {
      all: "كل المنتجات",
      unpriced: "منتجات غير مسعرة",
      featured: "منتجات مثبتة",
      hidden: "منتجات مخفية",
      discounted: "منتجات مخفضة",
      soldOut: "منتجات نفدت",
      forSale: "منتجات للبيع",
      uncategorized: "منتجات بلا تصنيف (تظهر تحت أخرى)",
      shipping: "منتجات تتطلب شحن",
      nearSoldOut: "منتجات قاربت على النفاد",
      noDescription: "منتجات بدون وصف",
      deleted: "منتجات محذوفة",
    },
    currency: "د.أ",
    empty: "لا توجد منتجات بعد",
    emptyHint: "أضف أول منتج لك وسيظهر في متجرك.",
    noMatch: "لا توجد منتجات مطابقة لبحثك",
    binEmpty: "لا توجد منتجات محذوفة. المنتجات التي تحذفها تبقى هنا لتتمكن من استرجاعها.",
    noneHere: "لا توجد منتجات هنا",
    pickOne: "اختر منتجًا لتعديله، أو أضف منتجًا جديدًا",
    sort: "ترتيب",
    sorts: ["الأحدث أولًا", "الاسم", "السعر: من الأقل", "السعر: من الأعلى"],
    selectAll: "تحديد الكل",
    refresh: "تحديث",
    deleteSelected: "حذف المحدد",
    basic: "المعلومات الأساسية",
    name: "اسم المنتج",
    namePh: "مثال: قميص قطني",
    images: "صور المنتج",
    imagesHint: "PNG أو JPG أو WebP، حتى 8 ميغابايت للصورة. تُصغَّر وتُحفظ مع المنتج، ويعرض متجرك الصورة الأولى.",
    imagesBad: "تعذّرت إضافة بعض الملفات. استخدم صور PNG أو JPG أو WebP حتى 8 ميغابايت.",
    imagesMax: "للمنتج 6 صور على الأكثر: أُضيفت الصور الأولى التي تتسع فقط.",
    focusTitle: "الجزء الظاهر من الصورة",
    focusNote: "يقصّ متجرك الصورة لتناسب شكلها (طولية أو مربعة أو عريضة). اضغط على الجزء الذي يجب أن يظهر دائمًا من الصورة الرئيسية، مثل الغطاء أو الملصق. تظهر الصور الصغيرة الثلاث شكلها النهائي.",
    focusCenter: "العودة إلى المنتصف",
    shapeTall: "طولية",
    shapeSquare: "مربعة",
    shapeWide: "عريضة",
    addImage: "ارفع صورة المنتج",
    primary: "الأساسية",
    removeImage: "إزالة الصورة",
    price: "السعر",
    sale: "السعر بعد الخصم",
    saleHint: "اتركه فارغًا إن لم يكن للمنتج خصم.",
    cost: "سعر التكلفة",
    costHint: "يظهر لك وحدك، ويُستخدم لحساب أرباحك.",
    category: "التصنيف",
    categoryPh: "مثال: ملابس",
    catHint: "اختياري. اختر تصنيفًا أو أكثر من تصنيفاتك، أو أنشئ تصنيفًا جديدًا. يستخدمها متجرك في القائمة والفلاتر، ويعرض المنتجات التي بلا تصنيف تحت «أخرى». لا يمكن حذف تصنيف يستخدمه منتج.",
    costAbove: "سعر التكلفة أعلى من سعر البيع، ستخسر في كل بيعة",
    catNewPh: "مثال: رجالي، نسائي، أولاد، بنات",
    catAdd: "إضافة",
    catNone: "لا توجد تصنيفات بعد. أضف أول تصنيف بالأسفل.",
    catRemove: "حذف هذا التصنيف",
    catEmpty: "بلا تصنيف (أخرى)",
    brand: "العلامة التجارية",
    brandPh: "اسم العلامة التجارية",
    description: "وصف المنتج",
    descriptionPh: "اكتب التفاصيل التي يحتاجها عملاؤك",
    notes: "الوصف",
    notesPh: "مثال: قطن · ناعم · خفيف",
    notesHint: "وصف قصير يظهر في صفحة المنتج فقط، لا على بطاقة المنتج.",
    badge: "شارة على الصورة",
    badgePh: "مثال: جديد",
    badgeHint: "شارة صغيرة على البطاقة، مثل جديد أو الأكثر مبيعًا.",
    visibility: "الظهور والخيارات",
    hidden: "إخفاء المنتج من المتجر",
    hiddenHint: "لا يستطيع العملاء رؤية المنتج المخفي أو شراءه.",
    featured: "تثبيت المنتج",
    featuredHint: "تُبرز المنتجات المثبتة في متجرك.",
    shipping: "يتطلب شحنًا",
    shippingHint: "أوقفه للمنتجات الرقمية والخدمات.",
    stock: "الكميات",
    quantity: "الكمية المتوفرة",
    quantityHint: "عدد القطع الموجودة لديك في المخزون. تنقص تلقائيًا مع كل طلب من متجرك.",
    pieces: (n) => arCount(n, { one: "قطعة واحدة", two: "قطعتان", few: "قطع", many: "قطعة" }),
    alerts: "الإشعارات",
    lowAt: "نبهني عند وصول كمية المنتج إلى",
    sendBy: "كيف يصلك التنبيه",
    sendByCustomers: "كيف يصل الإشعار للعملاء",
    byWhatsapp: "واتساب",
    byEmail: "البريد الإلكتروني",
    byBoth: "الاثنان",
    lowAtHint: "عند هذا الرقم أو أقل يظهر المنتج ضمن المنتجات قليلة الكمية في التقارير.",
    restockMin: "إشعار العملاء المشتركين عند توفر كمية أكبر من",
    restockMinHint: "لتجنب إرسال الإشعارات عند توفر كمية محدودة من المنتج. القيمة الافتراضية 15.",
    save: "حفظ",
    cancel: "إلغاء",
    delete: "حذف المنتج",
    errName: "أدخل اسم المنتج",
    errPrice: "أدخل سعرًا صحيحًا",
    priceZero: "السعر صفر، هل المنتج مجاني؟",
    saleZero: "سعر التخفيض 0 يجعل المنتج مجانيًا. اتركه فارغًا إن لم يكن هناك تخفيض.",
    discardAsk: "لديك تعديلات لم تُحفظ. هل تريد الخروج دون حفظ؟",
    discardKeep: "متابعة التعديل",
    discardYes: "الخروج دون حفظ",
    errSale: "يجب أن يكون السعر بعد الخصم أقل من السعر",
    errImages: "أضف صورة واحدة للمنتج على الأقل، ليرى العملاء ما يشترونه.",
    imagesUploading: "انتظر حتى ينتهي رفع الصورة، ثم احفظ.",
    imageBroken: "تعذّر تحميل هذه الصورة. احذفها وارفعها من جديد.",
    errQuantity: "أدخل الكمية المتوفرة لديك، أو اختر «كمية غير محدودة».",
    errStockAsk: "أكّد هذه الكمية الكبيرة، أو اجعلها غير محدودة.",
    unlimited: "كمية غير محدودة",
    unlimitedHint: "للمنتجات التي يمكنك دائمًا صنعها أو طلبها من جديد. لا تنفد أبدًا في متجرك.",
    unlimitedShort: "غير محدود",
    soldOutShort: "نفدت الكمية",
    otherCategory: "أخرى",
    requiredNote: "الحقول التي عليها * مطلوبة",
    untitled: "منتج بدون اسم",
    inStock: "متوفر",
    noPrice: "بدون سعر",
    edit: "تعديل المنتج",
    restore: "استعادة المنتج",
    deletedNote: "هذا المنتج محذوف. استعده ليعود بكل تفاصيله.",
    deleteForever: "حذف نهائي",
    foreverAsk: "هل تريد حذف المنتج نهائيًا؟ لا يمكن استعادته بعد ذلك.",
    foreverYes: "نعم، احذف نهائيًا",
    moveToTrash: "حذف المنتج",
    unsavedPhoto: "لا تُحفظ الصور مع المنتج في هذه النسخة التجريبية",
    undoBin: (n, name) =>
      n === 1 ? `نُقل «${name}» إلى المنتجات المحذوفة` : n % 100 >= 3 && n % 100 <= 10 ? `نُقلت ${n} منتجات إلى المنتجات المحذوفة` : `نُقل ${arCount(n, { one: "منتج", two: "منتجان", few: "منتجات", many: "منتجًا" })} إلى المنتجات المحذوفة`,
    undoRestored: (n, name) => (n === 1 ? `تمت استعادة «${name}»` : `تمت استعادة ${arCount(n, { one: "منتج", two: "منتجين", few: "منتجات", many: "منتجًا" })}`),
    undoAdded: (name) => `أُضيف «${name}»`,
    undoEdited: (name) => `حُفظت تعديلات «${name}»`,
    undoForever: (name) => `حُذف «${name}» نهائيًا`,
    undoCat: (c) => `حُذف التصنيف «${c}»`,
  },
};

/* What kind of product it is, and the sizes of clothing and shoes: the product form (Products.tsx) and the setup's
   first product (Onboarding.tsx) both read these, so the two always offer the same kinds with the same words */
export const kindWords: Record<Lang, { kind: string; kindHint: string; names: Record<ProductKind, string>; about: Record<ProductKind, string>; chart: string; optional: string; chartHint: string; chartUpload: string; chartBusy: string; chartChange: string; chartRemove: string; chartBad: string; sizes: string; sizesHint: string; quick: string; addSize: string; sizeName: string; sizeQty: string; removeSize: string; total: string; errSizes: string; errSizesTwice: (name: string) => string; shipOff: (k: string) => string }> = {
  ar: {
    kind: "نوع المنتج",
    kindHint: "يحدد ما يحتاجه المنتج: المقاسات والشحن والكمية.",
    names: { standard: "منتج عادي", clothing: "ملابس", shoes: "أحذية", digital: "منتج رقمي", service: "خدمة" },
    about: {
      standard: "كمية واحدة للمنتج، مثل العطور والإكسسوارات والأجهزة.",
      clothing: "مقاسات مثل S وM وL، ولكل مقاس كميته.",
      shoes: "مقاسات بالأرقام مثل 40 و41، ولكل مقاس كميته.",
      digital: "أكواد وبطاقات هدايا واشتراكات، تصل للعميل بلا شحن.",
      service: "حجوزات وتصميم وتعليم وغيرها، بلا شحن ولا مقاسات.",
    },
    chart: "جدول المقاسات",
    optional: "(اختياري)",
    chartHint: "صورة لجدول مقاساتك، يفتحها العميل من صفحة المنتج بجانب المقاسات.",
    chartUpload: "ارفع صورة الجدول",
    chartBusy: "جارٍ الرفع…",
    chartChange: "تغيير",
    chartRemove: "حذف",
    chartBad: "هذا الملف ليس صورة أو أكبر من 8 ميغابايت. استخدم PNG أو JPG أو WebP.",
    sizes: "المقاسات",
    sizesHint: "أضف المقاسات المتوفرة وكمية كل مقاس. المقاس الذي كميته صفر يظهر للعميل «نفد».",
    quick: "إضافة سريعة:",
    addSize: "+ مقاس آخر",
    sizeName: "المقاس",
    sizeQty: "الكمية",
    removeSize: "حذف المقاس",
    total: "مجموع الكمية",
    errSizes: "أضف مقاسًا واحدًا على الأقل واكتب اسمه.",
    errSizesTwice: (name) => `المقاس "${name}" مكتوب مرتين (الأحرف الكبيرة والمسافات لا تجعله مقاسًا آخر). اكتب لكل مقاس اسمًا مختلفًا، أو اجمع قطعهما في مقاس واحد.`,
    shipOff: (k) => `غير متاح لأن نوع المنتج «${k}» لا يُشحن.`,
  },
  en: {
    kind: "Product type",
    kindHint: "Decides what the product needs: sizes, shipping and quantity.",
    names: { standard: "Regular product", clothing: "Clothing", shoes: "Shoes", digital: "Digital product", service: "Service" },
    about: {
      standard: "One quantity for the product, like perfumes, accessories and devices.",
      clothing: "Sizes like S, M and L, each with its own quantity.",
      shoes: "Number sizes like 40 and 41, each with its own quantity.",
      digital: "Codes, gift cards and subscriptions, delivered without shipping.",
      service: "Bookings, design, lessons and more, with no shipping or sizes.",
    },
    chart: "Size chart",
    optional: "(optional)",
    chartHint: "A picture of your size chart. Customers open it from the product page, beside the sizes.",
    chartUpload: "Upload the chart picture",
    chartBusy: "Uploading…",
    chartChange: "Change",
    chartRemove: "Remove",
    chartBad: "This file is not a picture, or it is bigger than 8 MB. Use PNG, JPG or WebP.",
    sizes: "Sizes",
    sizesHint: "Add the sizes you have and how many of each. A size with 0 shows to customers as sold out.",
    quick: "Quick add:",
    addSize: "+ Another size",
    sizeName: "Size",
    sizeQty: "Quantity",
    removeSize: "Remove size",
    total: "Total quantity",
    errSizes: "Add at least one size and write its name.",
    errSizesTwice: (name) => `The size "${name}" is there twice (capitals and spaces don't make it another size). Give each size its own name, or put their pieces in one size.`,
    shipOff: (k) => `Not available because a “${k}” is not shipped.`,
  },
};
/* the usual sizes, one press each */
export const sizePresets: Partial<Record<ProductKind, string[]>> = {
  clothing: ["XS", "S", "M", "L", "XL", "XXL", "3XL"],
  shoes: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"],
};
