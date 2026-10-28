import type { Lang } from "./content";

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
  pctMax: string;
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
  piece: string;
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
  restockPct: string;
  restockPctHint: string;
  save: string;
  saved: string;
  cancel: string;
  delete: string;
  deleteAsk: string;
  deleteYes: string;
  errName: string;
  errPrice: string;
  priceZero: string;
  discardAsk: string;
  errSale: string;
  errImages: string;
  imagesUploading: string;
  imageBroken: string;
  errQuantity: string;
  unlimited: string;
  unlimitedHint: string;
  unlimitedShort: string;
  otherCategory: string;
  requiredNote: string;
  untitled: string;
  inStock: string;
  noPrice: string;
  edit: string;
  restore: string;
  restored: string;
  deletedNote: string;
  deleteForever: string;
  foreverAsk: string;
  foreverYes: string;
  moveToTrash: string;
  unsavedPhoto: string;
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
    catHint: "Optional. Pick one of your categories, or make a new one. Your store uses them in its menu and filters, and shows products without one under Other.",
    pctMax: "The share can't go above 100%",
    costAbove: "The cost is higher than the price: you lose money on every sale",
    catNewPh: "New category, e.g. Jeans",
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
    notesHint: "A short description. It shows under the name on the product card and on the product page.",
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
    piece: "pcs",
    alerts: "Alerts",
    lowAt: "Warn me when the quantity reaches",
    sendBy: "How the warning reaches you",
    sendByCustomers: "How customers are told",
    byWhatsapp: "WhatsApp",
    byEmail: "Email",
    byBoth: "Both",
    lowAtHint: "You get a notification before the product runs out.",
    restockMin: "Notify subscribed customers when quantity is above",
    restockMinHint: "Avoids sending alerts when only a few pieces come back. Default 15.",
    restockPct: "Share of subscribed customers to notify",
    restockPctHint: "Dukkan notifies this share of customers who asked to be told when the product is back.",
    save: "Save",
    saved: "Saved",
    cancel: "Cancel",
    delete: "Delete product",
    deleteAsk: "Delete this product? You can restore it from Deleted products.",
    deleteYes: "Yes, delete",
    errName: "Enter the product name",
    errPrice: "Enter a valid price",
    priceZero: "The price is zero. Is this product free?",
    discardAsk: "You have changes that are not saved. Leave without saving?",
    errSale: "The discounted price must be lower than the price",
    errImages: "Add at least one product photo. Customers need to see what they are buying.",
    imagesUploading: "Wait for the photo to finish uploading, then save.",
    imageBroken: "This photo could not be loaded. Remove it and upload it again.",
    errQuantity: "Enter how many you have, or choose Unlimited quantity.",
    unlimited: "Unlimited quantity",
    unlimitedHint: "For products you can always make or order again. They never sell out in your store.",
    unlimitedShort: "Unlimited",
    otherCategory: "Other",
    requiredNote: "Fields with * must be filled",
    untitled: "Untitled product",
    inStock: "in stock",
    noPrice: "No price",
    edit: "Edit product",
    restore: "Restore product",
    restored: "Product restored",
    deletedNote: "This product is deleted. Restore it to bring it back with all its details.",
    deleteForever: "Delete permanently",
    foreverAsk: "Delete this product for good? It cannot be restored.",
    foreverYes: "Yes, delete for good",
    moveToTrash: "Delete product",
    unsavedPhoto: "Photos are not saved with the product in this prototype",
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
      soldOut: "منتجات نفذت",
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
    imagesHint: "PNG أو JPG أو WebP، حتى 8 ميجابايت للصورة. تُصغَّر وتُحفظ مع المنتج، ويعرض متجرك الصورة الأولى.",
    imagesBad: "تعذّرت إضافة بعض الملفات. استخدم صور PNG أو JPG أو WebP حتى 8 ميجابايت.",
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
    catHint: "اختياري. اختر أحد تصنيفاتك أو أنشئ تصنيفًا جديدًا. يستخدمها متجرك في القائمة والفلاتر، ويعرض المنتجات التي بلا تصنيف تحت «أخرى».",
    pctMax: "النسبة لا تتجاوز 100٪",
    costAbove: "سعر التكلفة أعلى من سعر البيع، ستخسر في كل بيعة",
    catNewPh: "تصنيف جديد، مثال: جينز",
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
    notesHint: "وصف قصير يظهر تحت الاسم في بطاقة المنتج وفي صفحة المنتج.",
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
    piece: "قطعة",
    alerts: "الإشعارات",
    lowAt: "نبهني عند وصول كمية المنتج إلى",
    sendBy: "كيف يصلك التنبيه",
    sendByCustomers: "كيف يصل الإشعار للعملاء",
    byWhatsapp: "واتساب",
    byEmail: "البريد الإلكتروني",
    byBoth: "الاثنان",
    lowAtHint: "سيصلك إشعار قبل نفاد كمية المنتج.",
    restockMin: "إشعار العملاء المشتركين عند توفر كمية أكبر من",
    restockMinHint: "لتجنب إرسال الإشعارات عند توفر كمية محدودة من المنتج. القيمة الافتراضية 15.",
    restockPct: "نسبة العملاء المراد إشعارهم",
    restockPctHint: "ستُرسل دكان إشعار توفر المنتج إلى هذه النسبة من العملاء الذين طلبوا إعلامهم عند توفره.",
    save: "حفظ",
    saved: "تم الحفظ",
    cancel: "إلغاء",
    delete: "حذف المنتج",
    deleteAsk: "هل تريد حذف هذا المنتج؟ يمكنك استعادته من المنتجات المحذوفة.",
    deleteYes: "نعم، احذف",
    errName: "أدخل اسم المنتج",
    errPrice: "أدخل سعرًا صحيحًا",
    priceZero: "السعر صفر، هل المنتج مجاني؟",
    discardAsk: "لديك تعديلات لم تُحفظ. هل تريد الخروج دون حفظ؟",
    errSale: "يجب أن يكون السعر بعد الخصم أقل من السعر",
    errImages: "أضف صورة واحدة للمنتج على الأقل، ليرى العملاء ما يشترونه.",
    imagesUploading: "انتظر حتى ينتهي رفع الصورة، ثم احفظ.",
    imageBroken: "تعذّر تحميل هذه الصورة. احذفها وارفعها من جديد.",
    errQuantity: "أدخل الكمية المتوفرة لديك، أو اختر «كمية غير محدودة».",
    unlimited: "كمية غير محدودة",
    unlimitedHint: "للمنتجات التي يمكنك دائمًا صنعها أو طلبها من جديد. لا تنفد أبدًا في متجرك.",
    unlimitedShort: "غير محدود",
    otherCategory: "أخرى",
    requiredNote: "الحقول التي عليها * مطلوبة",
    untitled: "منتج بدون اسم",
    inStock: "متوفر",
    noPrice: "بدون سعر",
    edit: "تعديل المنتج",
    restore: "استعادة المنتج",
    restored: "تمت استعادة المنتج",
    deletedNote: "هذا المنتج محذوف. استعده ليعود بكل تفاصيله.",
    deleteForever: "حذف نهائي",
    foreverAsk: "هل تريد حذف المنتج نهائيًا؟ لا يمكن استعادته بعد ذلك.",
    foreverYes: "نعم، احذف نهائيًا",
    moveToTrash: "حذف المنتج",
    unsavedPhoto: "لا تُحفظ الصور مع المنتج في هذه النسخة التجريبية",
  },
};
