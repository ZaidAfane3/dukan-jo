import type { Lang } from "./content";

/* Copy for the Orders and Invoice customization pages. */

export const STATUS_KEYS = ["pending", "review", "processing", "shipping", "delivered", "cancelled", "refunded"] as const;
export type StatusKey = (typeof STATUS_KEYS)[number];

export const STATUS_DOT: Record<StatusKey, string> = {
  pending: "bg-amber-500",
  review: "bg-zinc-400",
  processing: "bg-sky-500",
  shipping: "bg-sky-500",
  delivered: "bg-emerald-500",
  cancelled: "bg-rose-500",
  refunded: "bg-rose-500",
};

type OrdersCopy = {
  menu: string[];
  sourceLabel: string;
  sources: string[];
  tabs: string[];
  newOrder: string;
  searchPh: string;
  all: string;
  statuses: Record<StatusKey, string>;
  currency: string;
  listEmpty: string;
  listEmptyHint: string;
  noMatch: string;
  pickOne: string;
  details: string;
  items: string;
  orderNo: string;
  date: string;
  channel: string;
  channels: string[];
  customer: string;
  phone: string;
  total: string;
  status: string;
  delete: string;
  deleteAsk: string;
  deleteYes: string;
  cancel: string;
  create: string;
  formTitle: string;
  namePh: string;
  errName: string;
  errTotal: string;
  paid: string;
  unpaid: string;
  paymentHint: string;
  ago: string;
  title: string;
};

export const ordersCopy: Record<Lang, OrdersCopy> = {
  en: {
    menu: ["Manage orders", "Invoice customization"],
    sourceLabel: "Where did the order come from?",
    sources: ["WhatsApp", "Instagram", "Phone call", "In person", "Other"],
    tabs: ["Manage orders", "Invoice customization"],
    newOrder: "New order",
    searchPh: "Search by order number, customer name or phone",
    all: "All orders",
    statuses: {
      pending: "Awaiting payment",
      review: "Awaiting review",
      processing: "Processing",
      shipping: "Out for delivery",
      delivered: "Delivered",
      cancelled: "Cancelled",
      refunded: "Refunded",
    },
    currency: "JOD",
    listEmpty: "No orders yet",
    listEmptyHint: "Orders from your store show up here. You can also add an order yourself.",
    noMatch: "No orders match your search",
    pickOne: "Select an order to see its details",
    details: "Order details",
    items: "What was ordered",
    orderNo: "Order number",
    date: "Order date",
    channel: "Order source",
    channels: ["Manual order", "Online store"],
    customer: "Customer",
    phone: "Phone",
    total: "Total",
    status: "Order status",
    delete: "Delete order",
    deleteAsk: "Delete this order? This cannot be undone.",
    deleteYes: "Yes, delete",
    cancel: "Cancel",
    create: "Create order",
    formTitle: "New order",
    namePh: "Customer name",
    errName: "Enter the customer name",
    errTotal: "Enter an amount above zero",
    paid: "Paid",
    unpaid: "Unpaid",
    paymentHint: "You can send the customer a payment link to complete the order.",
    ago: "ago",
    title: "Orders",
  },
  ar: {
    menu: ["إدارة الطلبات", "تخصيص الفواتير"],
    sourceLabel: "من أين جاء الطلب؟",
    sources: ["واتساب", "إنستغرام", "اتصال هاتفي", "حضوري", "أخرى"],
    tabs: ["إدارة الطلبات", "تخصيص الفواتير"],
    newOrder: "طلب جديد",
    searchPh: "ابحث برقم الطلب، اسم العميل، أو رقم الجوال",
    all: "كل الطلبات",
    statuses: {
      pending: "بانتظار الدفع",
      review: "بانتظار المراجعة",
      processing: "قيد التنفيذ",
      shipping: "جاري التوصيل",
      delivered: "تم التوصيل",
      cancelled: "ملغي",
      refunded: "مسترجع",
    },
    currency: "د.أ",
    listEmpty: "لا توجد طلبات بعد",
    listEmptyHint: "ستظهر هنا طلبات متجرك، ويمكنك أيضًا إضافة طلب بنفسك.",
    noMatch: "لا توجد طلبات مطابقة لبحثك",
    pickOne: "اختر طلبًا لعرض تفاصيله",
    details: "تفاصيل الطلب",
    items: "المنتجات المطلوبة",
    orderNo: "رقم الطلب",
    date: "تاريخ الطلب",
    channel: "مصدر الطلب",
    channels: ["طلب يدوي", "المتجر الإلكتروني"],
    customer: "العميل",
    phone: "الجوال",
    total: "الإجمالي",
    status: "حالة الطلب",
    delete: "حذف الطلب",
    deleteAsk: "هل تريد حذف هذا الطلب؟ لا يمكن التراجع عن ذلك.",
    deleteYes: "نعم، احذف",
    cancel: "إلغاء",
    create: "إنشاء الطلب",
    formTitle: "طلب جديد",
    namePh: "اسم العميل",
    errName: "أدخل اسم العميل",
    errTotal: "أدخل مبلغًا أكبر من صفر",
    paid: "مدفوع",
    unpaid: "غير مدفوع",
    paymentHint: "يمكنك إرسال رابط الدفع للعميل لإكمال الطلب.",
    ago: "منذ",
    title: "الطلبات",
  },
};

type Row = { key: keyof InvoiceSettings; label: string; hint?: string };

type InvoiceCopy = {
  title: string;
  reset: string;
  sampleNote: string;
  groups: { title: string; rows: Row[] }[];
  issueTitle: string;
  invoiceTitle: string;
  invoiceTitleHint: string;
  language: string;
  langs: [string, string];
  storeName: string;
  storeNameHint: string;
  storeNamePh: string;
  saved: string;
  titleDefault: string;
  titleCustom: string;
  customPh: string;
  sendWhen: string;
  sendWhenHint: string;
  pickStatuses: string;
  search: string;
  design: string;
  logoSize: string;
  logoPos: string;
  positions: Record<Pos, string>;
  primaryFont: string;
  secondaryFont: string;
  bold: string;
  regular: string;
  colorLabel: string;
  watermark: string;
  stamp: string;
  chooseWatermark: string;
  chooseStamp: string;
  opacity: string;
  stampPos: string;
  drop: string;
  dropHint: string;
  choose: string;
  remove: string;
  save: string;
  unsaved: string;
};

export type InvoiceSettings = {
  titleMode: "default" | "custom";
  customTitle: string;
  invoiceLang: Lang;
  storeName: string;
  image: boolean;
  description: boolean;
  weight: boolean;
  barcode: boolean;
  orderBarcode: boolean;
  zeroTax: boolean;
  summary: boolean;
  notes: boolean;
  policy: boolean;
  receiver: boolean;
  qr: boolean;
  address: boolean;
  contact: boolean;
  sendStatuses: StatusKey[];
  logoSize: number;
  logoPos: Pos;
  primaryBold: boolean;
  primaryColor: string;
  secondaryBold: boolean;
  secondaryColor: string;
  watermarkOpacity: number;
  stampOpacity: number;
  stampPos: Pos;
};

export type Pos = "right" | "center" | "left";

export const defaultInvoice: InvoiceSettings = {
  titleMode: "default",
  customTitle: "",
  invoiceLang: "ar",
  storeName: "",
  image: true,
  description: true,
  weight: false,
  barcode: true,
  orderBarcode: false,
  zeroTax: false,
  summary: true,
  notes: true,
  policy: true,
  receiver: false,
  qr: true,
  address: false,
  contact: true,
  sendStatuses: ["delivered"],
  logoSize: 30,
  logoPos: "center",
  primaryBold: true,
  primaryColor: "#000000",
  secondaryBold: false,
  secondaryColor: "#000000",
  watermarkOpacity: 69,
  stampOpacity: 30,
  stampPos: "left",
};

export const invoiceCopy: Record<Lang, InvoiceCopy> = {
  en: {
    title: "Invoice customization",
    reset: "Restore defaults",
    sampleNote: "This is a sample invoice for preview only, not a real document.",
    issueTitle: "How the invoice is issued",
    invoiceTitle: "Invoice title",
    invoiceTitleHint: "The title your customer sees on the invoice.",
    language: "Invoice language",
    langs: ["العربية", "English"],
    storeName: "Store name",
    storeNameHint: "Customize the text shown before your store name in the \"Issued by\" section.",
    storeNamePh: "Store name",
    saved: "Saved",
    titleDefault: "Dukkan default",
    titleCustom: "Custom",
    customPh: "Invoice",
    sendWhen: "When is the invoice sent",
    sendWhenHint: "Pick the order statuses at which the invoice is sent automatically.",
    pickStatuses: "Choose statuses",
    search: "Search",
    design: "Design and branding",
    logoSize: "Logo size",
    logoPos: "Logo position",
    positions: { right: "Right", center: "Center", left: "Left" },
    primaryFont: "Primary text",
    secondaryFont: "Secondary text",
    bold: "Bold",
    regular: "Regular",
    colorLabel: "Color",
    watermark: "Add a watermark",
    stamp: "Add the invoice stamp",
    chooseWatermark: "Upload your watermark",
    chooseStamp: "Upload your stamp",
    opacity: "Opacity",
    stampPos: "Stamp position",
    drop: "Drag the image here and drop it",
    dropHint: "PNG or JPG. The image is only used for this preview and is not uploaded.",
    choose: "Choose image",
    remove: "Remove",
    save: "Save",
    unsaved: "You have unsaved changes",
    groups: [
      {
        title: "Product information",
        rows: [
          { key: "image", label: "Show product image" },
          { key: "description", label: "Show product description" },
          { key: "weight", label: "Show product weight" },
          { key: "barcode", label: "Show product barcode" },
        ],
      },
      {
        title: "Order and invoice information",
        rows: [
          { key: "orderBarcode", label: "Show invoice barcode" },
          { key: "zeroTax", label: "Show tax fields when the value is zero", hint: "Applies to real invoices when the tax value is zero." },
          { key: "summary", label: "Show the order summary on the invoice" },
          { key: "notes", label: "Show order notes" },
          { key: "policy", label: "Show return and exchange policy" },
          { key: "receiver", label: "Show the receiver details when someone else collects the order", hint: "Applies when a receiver is named on the order." },
          { key: "qr", label: "Show QR codes for the invoice and the return policy" },
        ],
      },
      {
        title: "Store and contact information",
        rows: [
          { key: "address", label: "Show store address" },
          { key: "contact", label: "Show contact details" },
        ],
      },
    ],
  },
  ar: {
    title: "تخصيص الفواتير",
    reset: "استعادة الإعدادات الافتراضية",
    sampleNote: "هذه الفاتورة عينة مخصصة لغرض المعاينة فقط، وليست مستندًا حقيقيًا.",
    issueTitle: "طريقة إصدار الفاتورة",
    invoiceTitle: "عنوان الفاتورة",
    invoiceTitleHint: "العنوان الذي يظهر للعميل في الفاتورة.",
    language: "لغة الفاتورة",
    langs: ["العربية", "English"],
    storeName: "اسم المتجر",
    storeNameHint: "خصّص النص الظاهر قبل اسم المتجر في قسم «صادرة من».",
    storeNamePh: "اسم المتجر",
    saved: "تم الحفظ",
    titleDefault: "الافتراضي من دكان",
    titleCustom: "مخصص",
    customPh: "فاتورة",
    sendWhen: "متى تُرسل الفاتورة",
    sendWhenHint: "اختر حالات الطلب التي تُرسل فيها الفاتورة تلقائيًا.",
    pickStatuses: "اختر الحالات",
    search: "ابحث",
    design: "التصميم والعلامة التجارية",
    logoSize: "حجم الشعار",
    logoPos: "موضع الشعار",
    positions: { right: "يمين", center: "وسط", left: "يسار" },
    primaryFont: "الخط الأساسي",
    secondaryFont: "الخط الفرعي",
    bold: "عريض",
    regular: "عادي",
    colorLabel: "اللون",
    watermark: "أضف علامة مائية",
    stamp: "أضف ختم الفاتورة",
    chooseWatermark: "ارفع علامتك المائية",
    chooseStamp: "ارفع ختمك",
    opacity: "الشفافية",
    stampPos: "موضع الختم",
    drop: "اسحب الصورة وأفلتها هنا",
    dropHint: "PNG أو JPG. تُستخدم الصورة للمعاينة فقط ولا يتم رفعها.",
    choose: "اختيار صورة",
    remove: "إزالة",
    save: "حفظ",
    unsaved: "لديك تغييرات غير محفوظة",
    groups: [
      {
        title: "معلومات المنتج",
        rows: [
          { key: "image", label: "إظهار صورة المنتج" },
          { key: "description", label: "إظهار وصف المنتجات" },
          { key: "weight", label: "إظهار وزن المنتج" },
          { key: "barcode", label: "إظهار باركود المنتج" },
        ],
      },
      {
        title: "معلومات الطلب والفاتورة",
        rows: [
          { key: "orderBarcode", label: "إظهار باركود الفاتورة" },
          { key: "zeroTax", label: "إظهار حقول الضريبة عند كون قيمتها صفرًا", hint: "ينطبق هذا الإعداد على الفواتير الفعلية عند كون قيمة الضريبة صفرًا." },
          { key: "summary", label: "إظهار ملخص الطلب في الفاتورة" },
          { key: "notes", label: "إظهار ملاحظة الطلب" },
          { key: "policy", label: "إظهار سياسة الاستبدال والاسترجاع" },
          { key: "receiver", label: "إظهار بيانات المستلم عند استلام الطلب شخص آخر", hint: "ينطبق هذا الإعداد عند وجود مستلم مذكور في الطلب." },
          { key: "qr", label: "إظهار رموز QR للفاتورة وسياسة الاسترجاع" },
        ],
      },
      {
        title: "معلومات المتجر والتواصل",
        rows: [
          { key: "address", label: "إظهار عنوان المتجر" },
          { key: "contact", label: "إظهار بيانات التواصل" },
        ],
      },
    ],
  },
};

/* Words printed on the sample invoice itself, in the invoice's own language. */
export const invoiceWords: Record<Lang, Record<string, string>> = {
  en: {
    title: "Invoice",
    no: "Invoice no.",
    orderNo: "Order no.",
    date: "Date",
    from: "Issued by",
    to: "Issued to",
    payment: "Payment details",
    shipping: "Shipping details",
    method: "Payment method",
    amount: "Amount",
    carrier: "Shipped with",
    weight: "Total weight",
    eta: "Expected delivery",
    etaVal: "2 working days",
    product: "Product",
    qty: "Qty",
    price: "Price",
    sum: "Total",
    sub: "Subtotal",
    ship: "Shipping fees",
    tax: "Sales tax (16%)",
    grand: "Grand total",
    notes: "Order notes",
    contact: "Contact details",
    returns: "Return and exchange policy",
    returnsText: "Items can be exchanged or returned within 7 days of delivery in their original condition.",
    receiver: "Receiver",
    receiverName: "Sample Receiver",
    orderNote: "Please wrap as a gift",
    customer: "Sample Customer",
    address: "Abdali Boulevard, Amman, Jordan",
    product1: "Sample product",
    desc: "Soft cotton, medium size",
    method1: "Card",
    carrier1: "Dukkan Ship",
    wt: "Weight",
    storeAddress: "Store address",
    qrTitle: "View the invoice",
    qrReturns: "View the return policy",
    kg: "kg",
    cur: "JOD",
  },
  ar: {
    title: "فاتورة",
    no: "رقم الفاتورة",
    orderNo: "رقم الطلب",
    date: "التاريخ",
    from: "صادرة من",
    to: "صادرة إلى",
    payment: "تفاصيل الدفع",
    shipping: "تفاصيل الشحن",
    method: "طريقة الدفع",
    amount: "المبلغ",
    carrier: "الشحن عبر",
    weight: "إجمالي الوزن",
    eta: "المدة المتوقعة للتسليم",
    etaVal: "يومان عمل",
    product: "المنتج",
    qty: "الكمية",
    price: "السعر",
    sum: "المجموع",
    sub: "الإجمالي الفرعي",
    ship: "رسوم الشحن",
    tax: "ضريبة المبيعات (16%)",
    grand: "إجمالي الطلب",
    notes: "ملاحظات على الطلب",
    contact: "بيانات التواصل",
    returns: "سياسة الاستبدال والاسترجاع",
    returnsText: "يمكن استبدال المنتجات أو إرجاعها خلال 7 أيام من التسليم بحالتها الأصلية.",
    receiver: "المستلم",
    receiverName: "مستلم تجريبي",
    orderNote: "يرجى التغليف كهدية",
    customer: "عميل تجريبي",
    address: "بوليفارد العبدلي، عمّان، الأردن",
    product1: "منتج تجريبي",
    desc: "قطن ناعم، مقاس وسط",
    method1: "بطاقة",
    carrier1: "شحن دكان",
    wt: "الوزن",
    storeAddress: "عنوان المتجر",
    qrTitle: "عرض الفاتورة",
    qrReturns: "عرض سياسة الاسترجاع",
    kg: "كجم",
    cur: "د.أ",
  },
};
