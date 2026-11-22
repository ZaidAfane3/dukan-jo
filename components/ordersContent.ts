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
  size: string;
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
  deleteReason: string;
  deleteReasonPh: string;
  deleteReasonHint: string;
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
  /* an order a customer placed on the public store: no payment is taken yet */
  testOrder: string;
  testOrderHint: string;
  /* how a store order is paid, worked out from its way to pay and its status (Orders.tsx payLine): cash is paid on
     delivery (or at pickup) and is "Paid (cash)" once delivered; card and CliQ take nothing yet */
  cashPickup: string;
  paidCash: string;
  cashHint: string;
  cashPickupHint: string;
  testCard: string;
  testCliq: string;
  /* a card or CliQ store order: nothing is charged online, so he marks it paid once the customer paid him ("Payment
     received", POST /api/orders/<id>/paid: its stock is taken then); paid, it says so, also once cancelled */
  payDueHint: string;
  paidCard: string;
  paidCliq: string;
  cancelledPaid: string;
  payReceived: string;
  payReceivedAsk: string;
  payReceivedYes: string;
  payReceivedNo: string;
  paySaving: string;
  payFailed: string;
  /* such an order moved on (Processing, Out for delivery, Delivered) before its payment was marked received */
  payNotYet: string;
  /* reaching the customer from the order: a call, WhatsApp with a first message ({n}: order number, {store}: store name) */
  call: string;
  whatsapp: string;
  waText: string;
  waTextNoStore: string;
  /* an order Dukkan Ship delivers: where its delivery is (Dukkan's staff mark it) */
  shipTitle: string;
  shipStates: { waiting: string; delivered: string; failed: string };
  shipWhy: string;
  /* a status change of such an order did not reach the server */
  statusFailed: string;
  /* the order changed meanwhile (another tab or device): it was loaded again */
  statusChanged: string;
  /* confirming an order (it takes its stock then), or bringing it back out of cancelled or refunded: a product no longer
     has enough stock for it ({items}) */
  noStock: string;
  /* a cancel gave the stock back, but some pieces had no size left to go back to ({items}) */
  notBack: string;
  /* "+ New order" waits for the store's orders, so its number follows theirs */
  newOrderWait: string;
  /* the orders from his public store come a page at a time */
  storeShown: string;
  loadMore: string;
  loadingMore: string;
  moreFailed: string;
  /* the first list of his store orders did not come (server error or offline), and the button that asks again */
  loadFailed: string;
  retry: string;
  note: string;
  payNames: { cliq: string; cash: string; card: string };
  cancelledPay: string;
  refundedPay: string;
  changeStatus: string;
  statusAsk: string;
  statusYes: string;
  statusNo: string;
  phoneHint: string;
  fulfil: string;
  fulfilDelivery: string;
  fulfilPickup: string;
  city: string;
  cityPh: string;
  address: string;
  addressPh: string;
  errCity: string;
  errAddress: string;
  pickedUp: string;
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
      pending: "New",
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
    size: "Size",
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
    deleteReason: "Why are you deleting this order?",
    deleteReasonPh: "This reason will be sent to Dukkan in case anything goes wrong.",
    deleteReasonHint: "Write at least {min} characters.",
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
    testOrder: "Test order, not paid",
    testOrderHint: "Placed on your store's page while payment is not open yet. Nothing was charged.",
    cashPickup: "Cash on pickup",
    paidCash: "Paid (cash)",
    cashHint: "The customer pays when the order arrives. Mark it Delivered once you have the cash.",
    cashPickupHint: "The customer pays at your store when collecting the order. Mark it Delivered once you have the cash.",
    testCard: "Card (test, nothing charged)",
    testCliq: "CliQ (test, nothing charged)",
    payDueHint: "Nothing was charged on your store's page. Once the customer has paid you, press “Payment received”.",
    paidCard: "Paid (card)",
    paidCliq: "Paid (CliQ)",
    cancelledPaid: "Cancelled after it was paid",
    payReceived: "Payment received",
    payReceivedAsk: "Mark this order as paid? This takes the pieces from your stock.",
    payReceivedYes: "Yes, it's paid",
    payReceivedNo: "Not yet",
    paySaving: "Saving…",
    payFailed: "The payment couldn't be saved. Check your connection and try again.",
    payNotYet: "Payment not received yet. The pieces stay in your stock until you press “Payment received”.",
    call: "Call",
    whatsapp: "WhatsApp",
    waText: "Hello, about your order #{n} from {store}",
    waTextNoStore: "Hello, about your order #{n}",
    shipTitle: "Dukkan Ship delivery",
    shipStates: { waiting: "Waiting for Dukkan Ship to deliver it", delivered: "Delivered by Dukkan Ship", failed: "Dukkan Ship couldn't deliver it" },
    shipWhy: "Why",
    statusFailed: "The status couldn't be saved. Check your connection and try again.",
    statusChanged: "This order was changed elsewhere in the meantime. It now shows its latest status: change it again if you need to.",
    noStock: "Not enough stock left for this order: {items}. Add stock on the Products page, then try again.",
    notBack: "The order is cancelled, but some pieces could not go back to stock because their size no longer exists: {items}. Update the stock on the Products page.",
    newOrderWait: "Wait until your store's orders have loaded.",
    storeShown: "Showing {n} of {total} orders from your store page",
    loadMore: "Load more",
    loadingMore: "Loading…",
    moreFailed: "Couldn't load more. Try again.",
    loadFailed: "Your orders couldn't be loaded. Check your connection and try again.",
    retry: "Try again",
    note: "Customer note",
    payNames: { cliq: "CliQ", cash: "Cash on delivery", card: "Card" },
    cancelledPay: "Cancelled, not paid",
    refundedPay: "Refunded to the customer",
    changeStatus: "Change order status",
    statusAsk: "Change this order to \"{status}\"?",
    statusYes: "Yes, change it",
    statusNo: "No, keep it",
    phoneHint: "Optional",
    fulfil: "Delivery",
    fulfilDelivery: "Deliver to the customer",
    fulfilPickup: "Customer picks it up",
    city: "City",
    cityPh: "Choose a city",
    address: "Area, street and building",
    addressPh: "Khalda, Wasfi Al-Tal St, building 12",
    errCity: "Choose the delivery city",
    errAddress: "Write where to deliver",
    pickedUp: "Picked up from the store",
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
      pending: "جديد",
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
    size: "المقاس",
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
    deleteReason: "لماذا تحذف هذا الطلب؟",
    deleteReasonPh: "سيتم إرسال هذا السبب إلى دكّان في حال حدوث أي مشكلة.",
    deleteReasonHint: "اكتب {min} أحرف على الأقل.",
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
    testOrder: "طلب تجريبي، غير مدفوع",
    testOrderHint: "وصل من صفحة متجرك قبل تفعيل الدفع. لم يُخصم أي مبلغ.",
    cashPickup: "الدفع نقدًا عند الاستلام من المتجر",
    paidCash: "مدفوع (نقدًا)",
    cashHint: "يدفع العميل عند وصول الطلب. غيّر الحالة إلى «تم التوصيل» بعد استلام المبلغ.",
    cashPickupHint: "يدفع العميل في متجرك عند استلام الطلب. غيّر الحالة إلى «تم التوصيل» بعد استلام المبلغ.",
    testCard: "بطاقة (تجريبي، لم يُخصم شيء)",
    testCliq: "كليك (تجريبي، لم يُخصم شيء)",
    payDueHint: "لم يُخصم أي مبلغ عبر صفحة متجرك. بعد أن يدفع لك العميل، اضغط «تم استلام الدفع».",
    paidCard: "مدفوع (بطاقة)",
    paidCliq: "مدفوع (كليك)",
    cancelledPaid: "أُلغي بعد أن دُفع",
    payReceived: "تم استلام الدفع",
    payReceivedAsk: "هل تريد تسجيل هذا الطلب كمدفوع؟ سيتم خصم القطع من مخزونك.",
    payReceivedYes: "نعم، تم الدفع",
    payReceivedNo: "ليس بعد",
    paySaving: "جارٍ الحفظ…",
    payFailed: "تعذّر حفظ الدفع. تأكد من اتصالك وحاول مرة أخرى.",
    payNotYet: "لم يُستلم الدفع بعد. تبقى القطع في مخزونك حتى تضغط «تم استلام الدفع».",
    call: "اتصال",
    whatsapp: "واتساب",
    waText: "مرحبًا، بخصوص طلبك رقم {n} من {store}",
    waTextNoStore: "مرحبًا، بخصوص طلبك رقم {n}",
    shipTitle: "التوصيل عبر شحن دكّان",
    shipStates: { waiting: "بانتظار أن يوصله شحن دكّان", delivered: "سلّمه شحن دكّان", failed: "تعذّر على شحن دكّان تسليمه" },
    shipWhy: "السبب",
    statusFailed: "تعذّر حفظ الحالة. تأكد من اتصالك وحاول مرة أخرى.",
    statusChanged: "تغيّر هذا الطلب من مكان آخر في هذه الأثناء. تظهر الآن آخر حالة له: غيّرها مرة أخرى إن احتجت.",
    noStock: "لا يكفي المخزون المتبقي لهذا الطلب: {items}. أضف مخزونًا من صفحة المنتجات ثم حاول مرة أخرى.",
    notBack: "أُلغي الطلب، لكن بعض القطع لم تعد إلى المخزون لأن مقاسها لم يعد موجودًا: {items}. عدّل المخزون من صفحة المنتجات.",
    newOrderWait: "انتظر حتى يكتمل تحميل طلبات متجرك.",
    storeShown: "يظهر {n} من {total} طلبًا من صفحة متجرك",
    loadMore: "عرض المزيد",
    loadingMore: "جارٍ التحميل…",
    moreFailed: "تعذّر تحميل المزيد. حاول مجددًا.",
    loadFailed: "تعذّر تحميل طلباتك. تحقق من الاتصال وحاول مرة أخرى.",
    retry: "حاول مرة أخرى",
    note: "ملاحظة العميل",
    payNames: { cliq: "كليك CliQ", cash: "الدفع عند الاستلام", card: "بطاقة" },
    cancelledPay: "ملغي — لم يُدفع",
    refundedPay: "أُعيد المبلغ للعميل",
    changeStatus: "تغيير حالة الطلب",
    statusAsk: "هل تريد تغيير حالة هذا الطلب إلى «{status}»؟",
    statusYes: "نعم، غيّر الحالة",
    statusNo: "لا، أبقِها كما هي",
    phoneHint: "اختياري",
    fulfil: "التوصيل",
    fulfilDelivery: "توصيل للعميل",
    fulfilPickup: "يستلمه العميل من المتجر",
    city: "المدينة",
    cityPh: "اختر المدينة",
    address: "المنطقة والشارع والبناية",
    addressPh: "خلدا، شارع وصفي التل، بناية 12",
    errCity: "اختر مدينة التوصيل",
    errAddress: "اكتب عنوان التوصيل",
    pickedUp: "استلام من المتجر",
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
  taxNumber: string;
  taxNumberHint: string;
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
  /* the seller's sales tax number, for stores registered for sales tax (digits only, may be empty) */
  taxNumber: string;
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
  taxNumber: "",
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
    taxNumber: "Sales tax number (Optional)",
    taxNumberHint: "If your store is registered for sales tax, your tax number must show on every invoice.",
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
    dropHint: "PNG, JPG or WebP, up to 3 MB. The image is only used for this preview: it is not uploaded or saved.",
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
    taxNumber: "الرقم الضريبي (اختياري)",
    taxNumberHint: "إذا كان متجرك مسجّلًا في ضريبة المبيعات، يجب أن يظهر رقمك الضريبي على كل فاتورة.",
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
    dropHint: "PNG أو JPG أو WebP حتى 3 ميغابايت. تُستخدم الصورة للمعاينة فقط: لا تُرفع ولا تُحفظ.",
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
    taxNo: "Tax no.",
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
    taxNo: "الرقم الضريبي",
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
    kg: "كجم",
    cur: "د.أ",
  },
};
