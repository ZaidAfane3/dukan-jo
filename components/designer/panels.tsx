"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { latin } from "../digits";
import type { Lang } from "../content";
import { cartStyles, defaultConfig, productPageStyles, type ProductPageStyle, footerColumns, fontFamily, type CartStyle, heroTitleFamily, newBanners, newChips, newCollection, newNewsletter, newRibbon, newSlides, newTextSection, newTiles, type Banner, type DisplayFont, type HeroBg, type FooterColumn, type PatternKey, type HeroFont, type ThemeFont, type Tile, type Slide, type MarkKey, type Perk, type Review, type PerkIcon, type SectionConfig, type SectionType, type TextStyle, type StorefrontConfig } from "../storefront/config";
import { copy as storeCopy, fillColors, flowingOf, gradientOf, icons as storeIcons, isFlowing, isGradient, LogoMark, markKeys, onColor, resolveLogo, sampleMarks } from "../storefront/parts";
import { editLocked } from "../demoSandbox";
import { findTheme, ownsLook, type ThemeInfo } from "../themes";
import { loadSetup } from "../setup";
import { patterns } from "../storefront/patterns";
import { FocusPicker, type Focus as PicFocus } from "../FocusPicker";
import { pickPicture, readPhoto } from "./image";
import { ImageCropper, type CropShape } from "../ImageCropper";
import { checkImage, cleanFileName, hasStoreContact, imageRules, uploadProblemText, visibleLength, type UploadProblem } from "../safe";
import { readProducts } from "../storefront/useStoreData";
import { deleteMedia, putMedia, useMediaUrl } from "../storefront/mediaStore";
import { ColorPicker, Field, input, SecondsPicker, Toggle } from "./controls";
import { dc, sampleTexts } from "./copy";
import { LinkPicker, LinkTargets, PictureMover, useStorePages } from "./PageLink";
import { readSubscribers } from "../storefront/sections";
import { load as loadInfoPages } from "../InfoPages";
import { footerColors, footerNameSize } from "../storefront/footerColors";

export type Identity = { name: string; description: string; color: string; phone: string };
export type Draft = { config: StorefrontConfig; identity: Identity };
export type Update = (fn: (d: Draft) => Draft) => void;
export type Focus = { id: string; field?: string; n: number } | null;

const icon = { viewBox: "0 0 24 24", className: "h-[18px] w-[18px]", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

const ic = {
  edit: <svg {...icon}><path d="M4 20h4L19 9a2.800 2.800 0 0 0-4-4L4 16v4ZM14 6l4 4" /></svg>,
  eye: <svg {...icon}><path d="M2 12s3.500-6 10-6 10 6 10 6-3.500 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.500" /></svg>,
  eyeOff: <svg {...icon}><path d="M3 3l18 18M10.600 6.100A10 10 0 0 1 12 6c6.500 0 10 6 10 6a17 17 0 0 1-3.200 3.800M6.300 7.800A16 16 0 0 0 2 12s3.500 6 10 6c1.300 0 2.500-.3 3.600-.7" /></svg>,
  up: <svg {...icon}><path d="m6 15 6-6 6 6" /></svg>,
  down: <svg {...icon}><path d="m6 9 6 6 6-6" /></svg>,
  copy: <svg {...icon}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>,
  trash: <svg {...icon}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  plus: <svg {...icon}><path d="M12 5v14M5 12h14" /></svg>,
  back: <svg {...icon} className="h-5 w-5 rtl:rotate-180"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>,
  more: <svg {...icon}><circle cx="5" cy="12" r="1.200" /><circle cx="12" cy="12" r="1.200" /><circle cx="19" cy="12" r="1.200" /></svg>,
  gear: <svg {...icon}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.2 3H9.800l-.4 2.700a7 7 0 0 0-2 1.200l-2.300-1-2 3.400 2 1.500a7 7 0 0 0 0 2.400l-2 1.500 2 3.400 2.300-1a7 7 0 0 0 2 1.200l.4 2.700h4.400l.4-2.700a7 7 0 0 0 2-1.200l2.300 1 2-3.400-2-1.500c.1-.4.1-.8.1-1.200Z" /></svg>,
  megaphone: <svg {...icon}><path d="M4 10v4h3l7 4V6l-7 4H4ZM17 9a4 4 0 0 1 0 6" /></svg>,
  headset: <svg {...icon}><path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1ZM20 14h-3v5h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1Z" /></svg>,
  badge: <svg {...icon}><path d="M12 3 5 6v5c0 4.500 3 8 7 10 4-2 7-5.500 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>,
  share: <svg {...icon}><circle cx="6" cy="12" r="2.500" /><circle cx="18" cy="6" r="2.500" /><circle cx="18" cy="18" r="2.500" /><path d="m8.200 10.800 7.600-3.600M8.200 13.200l7.600 3.600" /></svg>,
  chevron: <svg {...icon} className="h-4 w-4"><path d="m6 9 6 6 6-6" /></svg>,
  columns: <svg {...icon}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16" /></svg>,
  link: <svg {...icon}><path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1" /></svg>,
  palette: <svg {...icon}><path d="M12 3a9 9 0 1 0 0 18c1 0 1.500-.8 1.500-1.500 0-1-.8-1.300-.8-2.200 0-.8.7-1.300 1.500-1.300H16a5 5 0 0 0 5-5c0-4.400-4-8-9-8Z" /><circle cx="7.500" cy="11" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="15" cy="7.500" r="1" /></svg>,
  close: <svg {...icon}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  search: <svg {...icon}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.500-3.500" /></svg>,
  types: {
    hero: <svg {...icon}><rect x="3" y="5" width="18" height="11" rx="3" /><path d="M7 20h10" /></svg>,
    perks: <svg {...icon}><rect x="3" y="6" width="5" height="12" rx="1.500" /><rect x="10" y="6" width="5" height="12" rx="1.500" /><rect x="17" y="6" width="4" height="12" rx="1.500" /></svg>,
    featured: <svg {...icon}><path d="m12 3 2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.300 6.800 19.100l1-5.800L3.500 9.200l5.900-.8L12 3Z" /></svg>,
    discounts: <svg {...icon}><path d="M4 12 12 4h8v8l-8 8-8-8Z" /><circle cx="15.500" cy="8.500" r="1" /></svg>,
    text: <svg {...icon}><path d="M5 6h14M5 11h14M5 16h9" /></svg>,
    reviews: <svg {...icon}><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10l-5 4v-4a2 2 0 0 1-1-2V6Z" /><path d="m9 10 1.500 1.500L14 8" /></svg>,
    slides: <svg {...icon}><rect x="3" y="6" width="18" height="12" rx="2.500" /><path d="m3 15 5-4 4 3 3-2 6 4M8.500 9.500h.01" /></svg>,
    tiles: <svg {...icon}><rect x="3" y="4" width="5" height="16" rx="1.500" /><rect x="9.500" y="4" width="5" height="16" rx="1.500" /><rect x="16" y="4" width="5" height="16" rx="1.500" /></svg>,
    banners: <svg {...icon}><rect x="3" y="4" width="18" height="16" rx="2.500" /><path d="M7 14h6M7 10h9" /></svg>,
    chips: <svg {...icon}><rect x="3" y="6" width="8" height="5" rx="2.500" /><rect x="13" y="6" width="8" height="5" rx="2.500" /><rect x="7" y="13" width="10" height="5" rx="2.500" /></svg>,
    newsletter: <svg {...icon}><rect x="3" y="5" width="18" height="14" rx="2.500" /><path d="m3.500 7 8.500 6 8.500-6" /></svg>,
    ribbon: <svg {...icon}><rect x="2.500" y="8" width="19" height="8" rx="1.500" /><path d="M7 12h.01M12 12h.01M17 12h.01" /></svg>,
    collection: <svg {...icon}><path d="M12 17v5M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z" /></svg>,
    products: <svg {...icon}><rect x="4" y="4" width="7" height="7" rx="1.500" /><rect x="13" y="4" width="7" height="7" rx="1.500" /><rect x="4" y="13" width="7" height="7" rx="1.500" /><rect x="13" y="13" width="7" height="7" rx="1.500" /></svg>,
  } satisfies Record<SectionType, React.ReactNode>,
};

const noText = { en: "", ar: "" };

/* The looks of the basket (see Cart.tsx): a name and a short line for each */
const cartT: Record<"en" | "ar", { title: string; hint: string; kinds: Record<CartStyle, [string, string]> }> = {
  en: {
    title: "Cart design",
    hint: "How the cart and checkout look when a customer opens them. It uses your colors and fonts.",
    kinds: { drawer: ["Side panel", "Soft cards, two steps"], editorial: ["Fashion bag", "Sharp, small capitals"], luxe: ["Full page", "Summary beside items"], pop: ["Playful card", "Bold lines, hard shadow"] },
  },
  ar: {
    title: "تصميم السلة",
    hint: "شكل السلة وإتمام الطلب عندما يفتحها العميل. تستخدم ألوانك وخطوطك.",
    kinds: { drawer: ["لوحة جانبية", "بطاقات ناعمة وخطوتان"], editorial: ["حقيبة أزياء", "حادة وبأحرف صغيرة"], luxe: ["صفحة كاملة", "الملخص بجانب المنتجات"], pop: ["بطاقة مرحة", "خطوط عريضة وظل صلب"] },
  },
};

/* The looks of the product page (see ProductPage in sections.tsx): a name and a short line for each */
const productPageT: Record<"en" | "ar", { title: string; hint: string; kinds: Record<ProductPageStyle, [string, string]> }> = {
  en: {
    title: "Product page design",
    hint: "How a product's own page looks when a customer opens it. It uses your colors and fonts.",
    kinds: { classic: ["Classic", "Soft panels, clean and modern"], editorial: ["Fashion", "Tall photo, small capitals"], luxe: ["Luxury", "Framed photo, centered, airy"], pop: ["Playful", "Bold lines, hard shadow"] },
  },
  ar: {
    title: "تصميم صفحة المنتج",
    hint: "شكل صفحة المنتج عندما يفتحها العميل. تستخدم ألوانك وخطوطك.",
    kinds: { classic: ["كلاسيكي", "لوحات ناعمة، نظيف وعصري"], editorial: ["أزياء", "صورة طويلة وخطوط رفيعة"], luxe: ["فاخر", "صورة بإطار، في المنتصف، واسع"], pop: ["مرح", "خطوط عريضة وظل صلب"] },
  },
};

/* The words of the playful ("pop") features: the hero layout, colored chips, the newsletter, round "+" cards, the pill header */
const popT = {
  en: {
    layoutPop: "Playful",
    chip: "Small chip above the title",
    accentWord: "Colored word of the title",
    accentWordHint: "A word of the title that is shown in the pop color",
    sticker: "Round sticker",
    photo1: "Main photo (arch)",
    photo2: "Second photo (tilted)",
    colorAccent: "Pop color",
    colorBlob: "Shape behind the photos",
    colorSticker: "Sticker color",
    chipsHint: "Small colored buttons, a little tilted. Under each button, choose from the list where it goes: a part of this page, another page of your store, or a web address.",
    chipLabel: "Button text",
    chipColor: "Button color",
    chipLink: "Link (optional)",
    chipRemove: "Remove this button",
    chipAdd: "Add a button",
    layoutOrbit: "Round photo",
    pageBgTitle: "Page background",
    bgColorOpt: "Page background color",
    bgFileOpt: "Attach a background",
    patArea: "Where the pattern shows",
    patAll: "Whole page",
    patBelow: "Under the cover",
    patTop: "Top of the page",
    patStrength: "How visible",
    patLight: "Light",
    patMedium: "Medium",
    patStrong: "Strong",
    patFade: "Fades out toward the bottom",
    fillSolid: "One color",
    fillGradient: "Gradient",
    fillFrom: "First color",
    fillTo: "Second color",
    fillFlow: "Moving gradient",
    textLook: "Alignment and style",
    alignRight: "Align right",
    alignCenter: "Center",
    alignLeft: "Align left",
    bold: "Bold",
    italic: "Italic",
    bannerNth: "Banner",
    slideWords: "Words for this one (optional)",
    slideWordsHint: "Leave a box empty to use the cover's main words.",
    slideTitle: "Title",
    slideText: "Text",
    slideButton: "Button text",
    slideLeads: "Where its button leads",
    cardsPick: "Products on the cards",
    cardsHint: "Pick up to 3, in the order they show. With none picked, your first products show.",
    cardsPicked: "picked",
    partMore: "Size and color",
    lockedNote: "This look comes with the {t} theme. You can try it here; it is kept in your store once you buy the theme.",
    lockedSee: "Save and see it in the theme store",
    lockedTag: "Theme",
    kickerLatin: "Small line above the title",
    tagLabel: "Price tag: the piece's name",
    tagPrice: "Price tag: the price",
    colorGold: "Accent color (marked words, buttons)",
    colorTag: "Price tag color",
    tilesCircles: "Circles",
    viewAllLeads: "Where \"view all\" leads",
    bandOn: "A band of its own color across the page",
    bandBg: "Band color",
    bandText: "Band text color",
    infoCenter: "Centered",
    textStyle: "Look",
    textPlain: "Plain",
    textStatement: "Centered statement",
    textEyebrow: "Small line above the title",
    textButton: "Button text (empty hides it)",
    textLeads: "Where the button leads",
    trustTitle: "Short promises under the button",
    trustAdd: "Add a promise",
    trustRemove: "Remove this promise",
    titleOrnament: "Ornament",
    hairlines: "Thin lines under the header and over the footer",
    navPlace: "Where the links sit (name in the middle)",
    navBelow: "Under the name",
    navStart: "At the start of the row",
    cartLook: "Saved and cart buttons",
    cartIcon: "Icons",
    cartText: "Words: Saved · Cart (0)",
    nameFont: "Font of the store name",
    nameColor: "Color of the store name",
    nameFontSame: "Like the titles",
    tagline: "Small line under the name",
    pricesTitle: "Language of the prices",
    pricesAuto: "Like the page",
    pricesAr: "Arabic (٢٤ د.أ)",
    pricesEn: "English (24 JOD)",
    nAfterPop: "Show a pop-up",
    popTitle: "Pop-up title",
    popText: "Pop-up text",
    popButton: "Pop-up button",
    popBg: "Pop-up color",
    popAccent: "Pop-up button color",
    popPic: "Pop-up picture (optional)",
    popHint: "Press the subscribe button in the preview to see the pop-up while you adjust it.",
    nAfter: "After someone subscribes",
    nAfterMsg: "Show the thank-you message",
    nAfterLink: "Show it, then go to...",
    nSubs: "Subscribers",
    nSubsCount: "emails saved in this browser",
    nCsv: "Download the list (CSV)",
    nClear: "Clear the list",
    nSubsHint: "In this prototype the emails are kept in this browser, until there is a mail service.",
    showSocialHere: "Show social media in the footer",
    showContactHere: "Show the contact column in the footer",
    showLicensesHere: "Show the licenses column in the footer",
    sizesTitle: "Footer text sizes",
    szTitles: "Column titles",
    szText: "Texts and links",
    szName: "Store name",
    morePics: "More pictures (a small collage)",
    morePicsHint: "Add up to 3 more pictures. They sit beside the first one, a little overlapping and tilted.",
    addPic: "Add a picture",
    removePic: "Remove this picture",
    colsTitle: "Footer columns",
    colsHint: "Turn each column on or off, change the order with the arrows (or drag it by its handle), or add a column of your own with its own title and links.",
    cAbout: "Name and about text",
    cPages: "Important links",
    cContact: "Contact us",
    cSocial: "Follow us",
    cLicenses: "Store licenses",
    colAdd: "Add a column",
    colTitle: "Column title",
    colRemove: "Remove this column",
    colDefault: "My column",
    wordsTitle: "Footer words",
    wordsHint: "Leave it empty to use the usual name.",
    wPages: "Title of the links column",
    wContact: "Title of the contact column",
    wFollow: "Title of the social media column",
    wLicenses: "Title of the licenses column",
    dCustom: "Your own links",
    menuLinkAdd: "Add a menu link",
    menuLinksTitle: "Your own links in the menu",
    menuLinksHint: "Choose what else the menu has and where each link goes: a page of the store, a part of the page or a web address. Each one has its own switch.",
    tabsTitle: "Your own footer links",
    tabsHint: "Add links like Contact us or Shipping. Each one leads where you choose and has its own switch. Use the arrows (or drag by the handle) to change its place.",
    tabLabel: "Link text",
    tabAdd: "Add a footer link",
    tabRemove: "Remove this link",
    tabDefault: "Contact us",
    tabShow: "Show this link",
    colUntitled: "Untitled column",
    colLinksTitle: "Links in this column",
    colLinksHint: "Each link has its text and the place it leads to.",
    colAsk: "Remove this column and its links?",
    colContent: "Edit what this column shows",
    colRename: "Rename this column",
    linkPickTarget: "Choose where this link goes",
    pagesFrom: "Store pages: {p} · Your own links: {o}",
    pagesHint: "To show a store page here, open it under Pages and turn on \"Show the page link in the store footer\".",
    licensesEmpty: "Nothing shows yet. Add a license number, logo or name under Store licenses.",
    licensesOpen: "Open Store licenses",
    logoNameHint: "Hides or shows the logo and the store name together.",
    logoMarkHint: "Only the name shows: the logo mark is turned off in Identity.",
    aboutColOff: "This column is off, so the about text does not show.",
    autoColor: "Automatic",
    autoColorNow: "Automatic: the color the theme picks",
    pickColor: "Choose a color",
    lowContrast: "Hard to read on this background. The store will use automatic text.",
    socialBad: "Paste the full link of your page, or write @name.",
    emailBad: "This email does not look right. Example: name@store.com",
    phoneBad: "Write the number with digits only, with + at the start if you like.",
    contactNeeded: "Add a phone or WhatsApp number. Customers need one of them to reach you, and the store can't be saved without it.",
    socialPh: "Link or @name",
    eyebrowSize: "Size of the small line",
    cardOpens: "Pressing a product opens its page",
    drawerTitle: "What the menu shows",
    drawerHint: "Turn each group on or off, and drag a group up or down to change its order.",
    dCategories: "Categories",
    dPages: "Pages of the store",
    dLinks: "Header links",
    buttonLeads: "Where this button leads",
    button2Leads: "Where the second button leads",
    storePages: "Pages of the store",
    chipMove: "Pull a button with the mouse to a new place, right on the page or in this list. The first one comes first in the row.",
    chipRules: "How the row sits",
    chipAlign: "Where the buttons gather",
    alStart: "Start",
    alCenter: "Center",
    alEnd: "End",
    chipTilt: "Tilt the buttons a little",
    chipSize: "Button size",
    szS: "Small",
    szM: "Medium",
    szL: "Large",
    nTitle: "Title",
    nAccent: "Colored word of the title",
    nText: "Small text",
    nButton: "Button",
    nPlaceholder: "Email field text",
    nThanks: "Thank-you message",
    nHint: "The visitor writes an email and presses the button. In this prototype nothing is sent.",
    nBg: "Block color",
    nAccentColor: "Colored word color",
    nButtonColor: "Button color",
    stylePop: "Playful",
    cardAdd: "Add to basket button",
    addWide: "Wide button",
    addPlus: "Round +",
    priceColor: "Price color",
    addColor: "Round + button color",
    titlePop: "Playful",
    navPill: "Pill",
    navActive: "Chosen link color",
    navCart: "Basket button color",
    footerStyle: "Footer style",
    footerFull: "Full (tinted, in columns)",
    footerSimple: "Simple (no tint, in a row)",
    bannerVariant: "Banner look",
    variantPhoto: "Photo",
    variantCard: "Color card",
    cardColor: "Card color",
    shape: "Picture shape",
    shapeArch: "Arch",
    shapeTilt: "Tilted",
    btnColor: "Button color",
    linkAsk: "Delete this link?",
    colorAuto: "Auto",
    colorReset: "Reset",
    /* the sale color, the color of one menu link, the banner cover's text place and height, the promo banner in the middle */
    saleColor: "Sale color",
    saleColorHint: "Colors the discount badges, the sale prices and the number on the basket.",
    saleColorAuto: "Reset (back to the store color)",
    linkColor: "Link color",
    heroTextPos: "Text position",
    textPosCenter: "Center",
    textPosBottomStart: "Bottom start",
    textPosBottomCenter: "Bottom center",
    heroHeight: "Cover height",
    heightNormal: "Normal",
    heightTall: "Tall",
    heroFullWidth: "Full page width",
    bannerCenter: "In the middle",
    sampleMarks: { shop: "Shop sign", bag: "Shopping bag", star: "Star", heart: "Heart", leaf: "Leaf", bolt: "Lightning" },
  },
  ar: {
    layoutPop: "مرح",
    chip: "الشارة الصغيرة فوق العنوان",
    accentWord: "الكلمة الملوّنة من العنوان",
    accentWordHint: "كلمة من العنوان تظهر بلون المرح",
    sticker: "الملصق الدائري",
    photo1: "الصورة الرئيسية (قوس)",
    photo2: "الصورة الثانية (مائلة)",
    colorAccent: "لون المرح",
    colorBlob: "الشكل خلف الصور",
    colorSticker: "لون الملصق",
    chipsHint: "أزرار صغيرة ملوّنة ومائلة قليلًا. تحت كل زر اختر من القائمة إلى أين يذهب: جزء من هذه الصفحة، أو صفحة أخرى من متجرك، أو عنوان موقع.",
    chipLabel: "نص الزر",
    chipColor: "لون الزر",
    chipLink: "الرابط (اختياري)",
    chipRemove: "إزالة هذا الزر",
    chipAdd: "إضافة زر",
    layoutOrbit: "صورة دائرية",
    pageBgTitle: "خلفية الصفحة",
    bgColorOpt: "لون خلفية الصفحة",
    bgFileOpt: "إرفاق خلفية",
    patArea: "مكان النقش",
    patAll: "كل الصفحة",
    patBelow: "تحت الغلاف",
    patTop: "أعلى الصفحة",
    patStrength: "وضوح النقش",
    patLight: "خفيف",
    patMedium: "متوسط",
    patStrong: "واضح",
    patFade: "يتلاشى نحو الأسفل",
    fillSolid: "لون واحد",
    fillGradient: "تدرّج",
    fillFrom: "اللون الأول",
    fillTo: "اللون الثاني",
    fillFlow: "تدرّج متحرك",
    textLook: "المحاذاة والشكل",
    alignRight: "محاذاة لليمين",
    alignCenter: "في الوسط",
    alignLeft: "محاذاة لليسار",
    bold: "عريض",
    italic: "مائل",
    bannerNth: "بنر",
    slideWords: "كلمات خاصة بها (اختياري)",
    slideWordsHint: "اترك أي خانة فارغة لتظهر كلمات الغلاف الأساسية.",
    slideTitle: "العنوان",
    slideText: "النص",
    slideButton: "نص الزر",
    slideLeads: "إلى أين يذهب زرها",
    cardsPick: "المنتجات في البطاقات",
    cardsHint: "اختر حتى 3 منتجات بالترتيب الذي تظهر به. بدون اختيار تظهر أول منتجاتك.",
    cardsPicked: "مختار",
    partMore: "الحجم واللون",
    lockedNote: "هذا الشكل يأتي مع ثيم {t}. جرّبه هنا كما تحب، ويُحفظ في متجرك بعد شراء الثيم.",
    lockedSee: "احفظ وشاهده في متجر الثيمات",
    lockedTag: "ثيم",
    kickerLatin: "سطر صغير فوق العنوان",
    tagLabel: "بطاقة السعر: اسم القطعة",
    tagPrice: "بطاقة السعر: السعر",
    colorGold: "لون التمييز (الكلمات المميّزة والأزرار)",
    colorTag: "لون بطاقة السعر",
    tilesCircles: "دوائر",
    viewAllLeads: "إلى أين يذهب «عرض الكل»",
    bandOn: "شريط بلون خاص على عرض الصفحة",
    bandBg: "لون الشريط",
    bandText: "لون النص في الشريط",
    infoCenter: "في المنتصف",
    textStyle: "الشكل",
    textPlain: "عادي",
    textStatement: "كتلة في المنتصف",
    textEyebrow: "سطر صغير فوق العنوان",
    textButton: "نص الزر (فارغ: بدون زر)",
    textLeads: "إلى أين يذهب الزر",
    trustTitle: "وعود قصيرة تحت الزر",
    trustAdd: "إضافة وعد",
    trustRemove: "إزالة هذا الوعد",
    titleOrnament: "زخرفة",
    hairlines: "خطوط رفيعة تحت الرأس وفوق التذييل",
    navPlace: "مكان الروابط (الاسم في المنتصف)",
    navBelow: "تحت الاسم",
    navStart: "في بداية السطر",
    cartLook: "زرا المفضلة والسلة",
    cartIcon: "أيقونات",
    cartText: "كلمات: المفضلة · السلة (٠)",
    nameFont: "خط اسم المتجر",
    nameColor: "لون اسم المتجر",
    nameFontSame: "مثل العناوين",
    tagline: "سطر صغير تحت الاسم",
    pricesTitle: "لغة الأسعار",
    pricesAuto: "مثل لغة الصفحة",
    pricesAr: "عربي (٢٤ د.أ)",
    pricesEn: "إنجليزي (24 JOD)",
    nAfterPop: "إظهار نافذة منبثقة",
    popTitle: "عنوان النافذة",
    popText: "نص النافذة",
    popButton: "زر النافذة",
    popBg: "لون النافذة",
    popAccent: "لون زر النافذة",
    popPic: "صورة النافذة (اختيارية)",
    popHint: "اضغط زر الاشتراك في المعاينة لترى النافذة أثناء تعديلها.",
    nAfter: "بعد الاشتراك",
    nAfterMsg: "إظهار رسالة الشكر",
    nAfterLink: "إظهارها ثم الذهاب إلى...",
    nSubs: "المشتركون",
    nSubsCount: "إيميل محفوظ في هذا المتصفح",
    nCsv: "تنزيل القائمة (CSV)",
    nClear: "مسح القائمة",
    nSubsHint: "في هذه النسخة التجريبية تُحفظ الإيميلات في هذا المتصفح حتى توجد خدمة بريد.",
    showSocialHere: "إظهار التواصل الاجتماعي في التذييل",
    showContactHere: "إظهار عمود التواصل في التذييل",
    showLicensesHere: "إظهار عمود التراخيص في التذييل",
    sizesTitle: "أحجام نصوص التذييل",
    szTitles: "عناوين الأعمدة",
    szText: "النصوص والروابط",
    szName: "اسم المتجر",
    morePics: "صور أخرى (كولاج صغير)",
    morePicsHint: "أضف حتى 3 صور أخرى. تظهر بجانب الأولى، متداخلة قليلًا ومائلة.",
    addPic: "إضافة صورة",
    removePic: "إزالة هذه الصورة",
    colsTitle: "أعمدة التذييل",
    colsHint: "فعّل أو ألغِ كل عمود، وغيّر الترتيب بالأسهم (أو اسحبه من مقبضه)، أو أضف عمودًا خاصًا بك بعنوانه وروابطه.",
    cAbout: "الاسم والنص التعريفي",
    cPages: "روابط مهمة",
    cContact: "تواصل معنا",
    cSocial: "تابعنا",
    cLicenses: "رُخَص المتجر",
    colAdd: "إضافة عمود",
    colTitle: "عنوان العمود",
    colRemove: "إزالة هذا العمود",
    colDefault: "عمودي",
    wordsTitle: "كلمات التذييل",
    wordsHint: "اتركه فارغًا ليظهر الاسم المعتاد.",
    wPages: "عنوان عمود الروابط",
    wContact: "عنوان عمود التواصل",
    wFollow: "عنوان عمود التواصل الاجتماعي",
    wLicenses: "عنوان عمود التراخيص",
    dCustom: "روابطك الخاصة",
    menuLinkAdd: "إضافة رابط في القائمة",
    menuLinksTitle: "روابطك الخاصة في القائمة",
    menuLinksHint: "اختر ماذا تضم القائمة أيضًا وإلى أين يذهب كل رابط: صفحة من المتجر أو جزء من الصفحة أو عنوان موقع. لكل واحد مفتاحه الخاص.",
    tabsTitle: "روابطك الخاصة في التذييل",
    tabsHint: "أضف روابط مثل تواصل معنا أو الشحن. كل رابط يذهب إلى ما تختاره وله مفتاحه الخاص. غيّر مكانه بالأسهم (أو اسحبه من مقبضه).",
    tabLabel: "نص الرابط",
    tabAdd: "إضافة رابط في التذييل",
    tabRemove: "إزالة هذا الرابط",
    tabDefault: "تواصل معنا",
    tabShow: "إظهار هذا الرابط",
    colUntitled: "عمود بلا عنوان",
    colLinksTitle: "روابط هذا العمود",
    colLinksHint: "لكل رابط نصّه والمكان الذي يذهب إليه.",
    colAsk: "هل تريد إزالة هذا العمود وروابطه؟",
    colContent: "تعديل ما يعرضه هذا العمود",
    colRename: "تغيير اسم هذا العمود",
    linkPickTarget: "اختر إلى أين يذهب هذا الرابط",
    pagesFrom: "صفحات المتجر: {p} · روابطك الخاصة: {o}",
    pagesHint: "لإظهار صفحة من صفحات المتجر هنا، افتحها من «الصفحات» وفعّل «عرض رابط الصفحة في تذييل الموقع».",
    licensesEmpty: "لا يظهر شيء بعد. أضف رقم الرخصة أو شعارها أو اسمها من «رُخَص المتجر».",
    licensesOpen: "فتح رُخَص المتجر",
    logoNameHint: "يُظهر شعار المتجر واسمه معًا أو يخفيهما.",
    logoMarkHint: "يظهر الاسم فقط: علامة الشعار مُطفأة في «الهوية».",
    aboutColOff: "هذا العمود مُطفأ، لذلك لا يظهر النص التعريفي.",
    autoColor: "تلقائي",
    autoColorNow: "تلقائي: اللون الذي يختاره الثيم",
    pickColor: "اختيار لون",
    lowContrast: "يصعب قراءته على هذه الخلفية. سيستخدم المتجر لون نص تلقائيًا.",
    socialBad: "الصق رابط صفحتك كاملًا، أو اكتب @الاسم.",
    emailBad: "يبدو أن البريد غير صحيح. مثال: name@store.com",
    phoneBad: "اكتب الرقم بالأرقام فقط، ويمكن أن يبدأ بـ +.",
    contactNeeded: "أضف رقم هاتف أو واتساب. يحتاج العملاء أحدهما للتواصل معك، ولا يُحفظ المتجر بدونه.",
    socialPh: "الرابط أو @الاسم",
    eyebrowSize: "حجم السطر الصغير",
    cardOpens: "الضغط على المنتج يفتح صفحته",
    drawerTitle: "ماذا تعرض القائمة",
    drawerHint: "فعّل أو ألغِ كل مجموعة، واسحب المجموعة لأعلى أو أسفل لتغير ترتيبها.",
    dCategories: "الأقسام",
    dPages: "صفحات المتجر",
    dLinks: "روابط الهيدر",
    buttonLeads: "إلى أين يذهب هذا الزر",
    button2Leads: "إلى أين يذهب الزر الثاني",
    storePages: "صفحات المتجر",
    chipMove: "اسحب الزر بالماوس إلى مكان جديد، مباشرة على الصفحة أو في هذه القائمة. الأول يظهر أولًا في الصف.",
    chipRules: "كيف ينتظم الصف",
    chipAlign: "أين تتجمع الأزرار",
    alStart: "البداية",
    alCenter: "المنتصف",
    alEnd: "النهاية",
    chipTilt: "إمالة الأزرار قليلًا",
    chipSize: "حجم الأزرار",
    szS: "صغير",
    szM: "متوسط",
    szL: "كبير",
    nTitle: "العنوان",
    nAccent: "الكلمة الملوّنة من العنوان",
    nText: "النص الصغير",
    nButton: "الزر",
    nPlaceholder: "نص حقل الإيميل",
    nThanks: "رسالة الشكر",
    nHint: "يكتب الزائر إيميله ويضغط الزر. في هذه النسخة التجريبية لا يُرسل شيء.",
    nBg: "لون الكتلة",
    nAccentColor: "لون الكلمة الملوّنة",
    nButtonColor: "لون الزر",
    stylePop: "مرح",
    cardAdd: "زر الإضافة للسلة",
    addWide: "زر عريض",
    addPlus: "+ دائري",
    priceColor: "لون السعر",
    addColor: "لون زر + الدائري",
    titlePop: "مرح",
    navPill: "كبسولة",
    navActive: "لون الرابط المختار",
    navCart: "لون زر السلة",
    footerStyle: "شكل التذييل",
    footerFull: "كامل (بخلفية ملوّنة وأعمدة)",
    footerSimple: "بسيط (بلا تلوين، في صف)",
    bannerVariant: "شكل البنر",
    variantPhoto: "صورة",
    variantCard: "بطاقة ملوّنة",
    cardColor: "لون البطاقة",
    shape: "شكل الصورة",
    shapeArch: "قوس",
    shapeTilt: "مائلة",
    btnColor: "لون الزر",
    linkAsk: "هل تريد حذف هذا الرابط؟",
    colorAuto: "تلقائي",
    colorReset: "إعادة ضبط",
    saleColor: "لون التخفيضات",
    saleColorHint: "يلوّن شارات الخصم والأسعار المخفّضة والرقم على السلة.",
    saleColorAuto: "إعادة ضبط (لون المتجر)",
    linkColor: "لون الرابط",
    heroTextPos: "مكان النص",
    textPosCenter: "وسط",
    textPosBottomStart: "أسفل البداية",
    textPosBottomCenter: "أسفل الوسط",
    heroHeight: "ارتفاع الغلاف",
    heightNormal: "عادي",
    heightTall: "طويل",
    heroFullWidth: "بعرض الصفحة كاملًا",
    bannerCenter: "في الوسط",
    sampleMarks: { shop: "واجهة متجر", bag: "حقيبة تسوّق", star: "نجمة", heart: "قلب", leaf: "ورقة شجر", bolt: "برق" },
  },
};
const popPastels = ["#ff8fb1", "#c9b6ff", "#ffe36e", "#b9f3d0", "#ffb787", "#ffffff"];

/** How many texts of the store are written in `from` but have nothing in the other language yet. */
function missingTexts(cfg: StorefrontConfig, from: Lang): number {
  const other = from === "ar" ? "en" : "ar";
  let n = 0;
  const walk = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      const keys = Object.keys(o);
      if (keys.length === 2 && typeof o.en === "string" && typeof o.ar === "string") {
        if (String(o[from]).trim() && !String(o[other]).trim()) n++;
        return;
      }
      keys.forEach((k) => walk(o[k]));
    }
  };
  walk({ sections: cfg.sections, announcement: cfg.announcement, nav: cfg.nav, texture: cfg.texture, footer: cfg.footer });
  return n;
}

/** A row of choices: one is on. */
/* Looks that come with a theme of the theme store: anyone can try one in the preview, with a note saying which theme it comes
   with. It is kept in the store only once that theme is bought (see withoutUnboughtLooks in themes.ts). */
const lockedBy = (themeId: string | undefined): ThemeInfo | null => (themeId && !ownsLook(themeId) ? findTheme(themeId) : null);

const lockIcon = <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;

/** Shown while a look of a theme he has not bought is picked: which theme it comes with. The link saves his design first,
    then opens that theme in the theme store (the designer does both, see "dk-save-go" in Designer.tsx). */
function LockedNote({ lang, theme }: { lang: Lang; theme: ThemeInfo }) {
  return (
    <div className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
      <p className="flex items-start gap-1.5">
        <span className="mt-0.5">{lockIcon}</span>
        <span>{popT[lang].lockedNote.replace("{t}", theme.name[lang])}</span>
      </p>
      <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("dk-save-go", { detail: `/themes?theme=${theme.id}` }))} className="mt-1.5 font-bold underline">
        {popT[lang].lockedSee}
      </button>
    </div>
  );
}

/** A row of choices. An option with a `theme` is a look of that theme (see lockedBy): it can be tried, with the note under the row. */
function Seg<T extends string>({ value, options, onChange, cols = 2, lang }: { value: T; options: { key: T; label: string; theme?: string }[]; onChange: (v: T) => void; cols?: number; lang?: Lang }) {
  const picked = lockedBy(options.find((o) => o.key === value)?.theme);
  return (
    <div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const lock = lockedBy(o.theme);
          return (
            <button key={o.key} type="button" onClick={() => onChange(o.key)} aria-pressed={value === o.key} title={lock && lang ? `${popT[lang].lockedTag} ${lock.name[lang]}` : undefined} className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${value === o.key ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : lock ? "border-dashed border-fg/25 text-muted hover:bg-soft" : "border-fg/15 hover:bg-soft"}`}>
              {lock && lockIcon}
              {o.label}
            </button>
          );
        })}
      </div>
      {picked && lang && <LockedNote lang={lang} theme={picked} />}
    </div>
  );
}

/** A background: one color, or a gradient from one color to another. Every background color of the store uses it. */
function FillPicker({ lang, value, fallback, onChange, label, list }: { lang: Lang; value: string; fallback: string; onChange: (v: string) => void; label: string; list?: string[] }) {
  const w = popT[lang];
  const bad = dc[lang].identity.hexBad;
  const grad = isGradient(value);
  const [a, b] = grad ? [fillColors(value)[0] ?? fallback, fillColors(value)[1] ?? "#6fe3cf"] : [value || fallback, ""];
  /* a moving gradient stays moving when its colors change */
  const flow = isFlowing(value);
  const make = (x: string, y: string) => (flow ? flowingOf(x, y) : gradientOf(x, y));
  return (
    <div className="space-y-3">
      <Seg value={grad ? "gradient" : "solid"} onChange={(k) => onChange(k === "gradient" ? gradientOf(a, "#6fe3cf") : a)} options={[{ key: "solid", label: w.fillSolid }, { key: "gradient", label: w.fillGradient }]} />
      {grad ? (
        <>
          {/* how the gradient looks */}
          <span aria-hidden className="block h-8 rounded-lg ring-1 ring-black/10" style={{ background: value }} />
          <Toggle on={flow} onChange={(on) => onChange(on ? flowingOf(a, b) : gradientOf(a, b))} label={w.fillFlow} />
          <p className="text-xs font-semibold text-fg/80">{w.fillFrom}</p>
          <ColorPicker value={a} onChange={(c) => onChange(make(c, b))} label={`${label}: ${w.fillFrom}`} bad={bad} list={list} />
          <p className="text-xs font-semibold text-fg/80">{w.fillTo}</p>
          <ColorPicker value={b} onChange={(c) => onChange(make(a, c))} label={`${label}: ${w.fillTo}`} bad={bad} list={list} />
        </>
      ) : (
        <ColorPicker value={a} onChange={onChange} label={label} bad={bad} list={list} />
      )}
    </div>
  );
}

/** The color the texts of the store have now (the theme's text color): shown in a color box that has not been changed yet */
export const TextColorNow = createContext("#1c1a17");

/** The color of one text: a swatch that opens the color picker and shows the color it has now.
    `auto` is the color the preview draws when nothing is chosen (white on a banner); without it, the store's text color. */
function ColorChip({ lang, label, value, auto, onChange, onReset }: { lang?: Lang; label: string; value: string | undefined; auto?: string; onChange: (v: string) => void; onReset?: () => void }) {
  const now = useContext(TextColorNow);
  const shown = value || auto || now;
  const w = popT[lang ?? "ar"];
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-semibold text-fg/80">{label}</span>
      <div className="flex items-center gap-2" dir="ltr">
        {/* a chosen color can go back to the automatic one */}
        {value && onReset && <button type="button" onClick={onReset} className="me-1 text-xs font-semibold text-primary hover:underline">{w.colorReset}</button>}
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-fg/15 px-2 py-1 transition hover:bg-soft">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(shown) ? shown : "#1c1a17"} onChange={(e) => onChange(e.target.value)} aria-label={label} className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0" />
          <span className="min-w-[4.5rem] text-xs font-bold uppercase tabular-nums">{shown}</span>
          {/* nothing chosen yet: the color comes by itself */}
          {!value && <span className="text-[10px] font-semibold text-muted">{w.colorAuto}</span>}
        </label>
      </div>
    </div>
  );
}

/** A text size with a - and a + (2 px at a time), a box to type any size, and a way back to the theme's own size. */
function Stepper({ lang, label, value, auto, onChange, onReset, min = 10, max = 160 }: { lang: Lang; label: string; value: number; auto: boolean; onChange: (v: number) => void; onReset: () => void; min?: number; max?: number }) {
  const lx = dc[lang].luxe;
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const go = (d: number) => onChange(clamp(value + d));
  /* what he is typing; the size changes when he leaves the box or presses Enter */
  const [typed, setTyped] = useState<string | null>(null);
  const done = () => {
    if (typed !== null && typed.trim() !== "" && !Number.isNaN(Number(typed))) onChange(clamp(Number(typed)));
    setTyped(null);
  };
  const btn = "grid h-9 place-items-center rounded-lg border border-fg/15 text-base font-bold transition hover:bg-soft disabled:opacity-30 disabled:hover:bg-transparent";
  /* two rows, so every size control lines up the same: its name (and the reset link) above, then − size + across the whole width */
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-fg/80">{label}</span>
        {!auto && <button type="button" onClick={onReset} className="shrink-0 whitespace-nowrap text-xs font-semibold text-primary hover:underline">{lx.sizeReset}</button>}
      </div>
      <div className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center gap-1.5" dir="ltr">
        <button type="button" className={btn} disabled={value <= min} onClick={() => go(-2)} aria-label={lx.sizeSmaller} title={lx.sizeSmaller}>−</button>
        <label className="flex h-9 items-center rounded-lg border border-fg/15 px-2 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={typed ?? value}
            onChange={(e) => setTyped(e.target.value)}
            onBlur={done}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setTyped(null);
            }}
            aria-label={label}
            className="w-full min-w-0 bg-transparent text-center text-sm font-bold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-xs text-muted">px</span>
        </label>
        <button type="button" className={btn} disabled={value >= max} onClick={() => go(2)} aria-label={lx.sizeBigger} title={lx.sizeBigger}>+</button>
      </div>
    </div>
  );
}

/** Asks once before a link is deleted: the same red question as deleting an element, under that link. */
function LinkAsk({ lang, onYes, onNo, text }: { lang: Lang; onYes: () => void; onNo: () => void; /* another question than "Delete this link?" */ text?: string }) {
  const t = dc[lang];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-rose-500/10 px-3 py-2">
      <span className="text-xs text-rose-700 dark:text-rose-400">{text ?? popT[lang].linkAsk}</span>
      <button type="button" onClick={onYes} className="rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white">{t.deleteYes}</button>
      <button type="button" onClick={onNo} className="rounded-md border border-fg/20 px-3 py-1 text-xs font-semibold">{t.cancel}</button>
    </div>
  );
}

const roundBtnSm = "grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition hover:bg-fg/10 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent";
const menuBtn = "flex items-center gap-1.5 rounded-md border border-fg/15 px-2.5 py-1 text-xs font-semibold text-muted transition hover:bg-soft hover:text-fg";
const roundBtn = "grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-fg/10 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent";

/** The small editor of one text: right, center or left, bold and italic. Pressing the chosen alignment again goes back to the theme's. */
function StyleBar({ lang, value, onChange, boldNow }: { lang: Lang; value?: TextStyle; onChange: (v: TextStyle) => void; /* whether the text is bold in the theme */ boldNow: boolean }) {
  const w = popT[lang];
  const v = value ?? {};
  const bold = v.bold ?? boldNow;
  const btn = (on: boolean) => `grid h-9 w-9 place-items-center rounded-lg border text-sm transition ${on ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`;
  const lines = (a: "left" | "center" | "right") => (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d={a === "left" ? "M4 6h16M4 10h10M4 14h16M4 18h10" : a === "center" ? "M4 6h16M7 10h10M4 14h16M7 18h10" : "M4 6h16M10 10h10M4 14h16M10 18h10"} />
    </svg>
  );
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-fg/80">{w.textLook}</p>
      {/* dir="ltr" so the left button is on the left and the right one on the right, in both languages */}
      <div dir="ltr" className="flex flex-wrap items-center gap-1.5">
        {(["left", "center", "right"] as const).map((a) => (
          <button key={a} type="button" onClick={() => onChange({ ...v, align: v.align === a ? undefined : a })} aria-pressed={v.align === a} aria-label={a === "left" ? w.alignLeft : a === "center" ? w.alignCenter : w.alignRight} title={a === "left" ? w.alignLeft : a === "center" ? w.alignCenter : w.alignRight} className={btn(v.align === a)}>
            {lines(a)}
          </button>
        ))}
        <span aria-hidden className="mx-1 h-6 w-px bg-fg/15" />
        <button type="button" onClick={() => onChange({ ...v, bold: !bold })} aria-pressed={bold} aria-label={w.bold} title={w.bold} className={`${btn(bold)} font-extrabold`}>B</button>
        <button type="button" onClick={() => onChange({ ...v, italic: !v.italic })} aria-pressed={!!v.italic} aria-label={w.italic} title={w.italic} className={`${btn(!!v.italic)} font-serif italic`}>I</button>
      </div>
    </div>
  );
}

/** Where a button leads, shown inside that button's block under its text */
function Leads({ lang, label, value, onChange }: { lang: Lang; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-semibold text-fg/80">{label}</p>
      <LinkPicker lang={lang} value={value} onChange={onChange} label={label} />
    </div>
  );
}

/* The part of the store that was clicked in the preview: the part of the form that holds it opens by itself */
const PartFocus = createContext<{ field?: string; n: number }>({ n: 0 });

/** One part of an element (the title, the text, a button...): closed at first, only its name and a ▾. A press opens it:
    its box, and under it the options of that part only (its size, color, font). */
function Part({ label, hint, more, field, force = false, error, icon, preview, children }: { lang?: Lang; label: string; /* a small picture before the name (a banner's color) */ icon?: React.ReactNode; hint?: string; more?: React.ReactNode; field?: string; /* opened from outside: the tour points at it */ force?: boolean; error?: string; /* while closed, a short grey look at what is written in it */ preview?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  /* what is inside is made the first time it opens, and then stays so it can slide closed again */
  const [made, setMade] = useState(false);
  const focus = useContext(PartFocus);
  /* the first time, what is inside is made closed and it opens on the next frame, so it slides open like every other time */
  const show = () => {
    setMade(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
  };
  useEffect(() => {
    if (field && focus.field === field) show();
  }, [field, focus.field, focus.n]);
  /* a part with a mistake in it, or one the tour points at, opens by itself */
  useEffect(() => {
    if (force || error) show();
  }, [force, error]);
  /* while closed nothing inside can be reached with the keyboard */
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) setMade(true);
    box.current?.toggleAttribute("inert", !open);
  }, [open]);
  /* a name that ends with * must be filled: the star is red */
  const must = label.endsWith(" *");
  return (
    <div>
      <button type="button" onClick={() => (open ? setOpen(false) : show())} aria-expanded={open} className="flex w-full items-center justify-between gap-2 text-start">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-fg/80">
          {icon}
          <span className="truncate">{must ? label.slice(0, -2) : label}</span>
          {must && <span className="ms-1 text-rose-600">*</span>}
        </span>
        {preview && !open && <span dir="auto" className="ms-auto min-w-0 max-w-[45%] truncate text-xs font-normal text-muted">{preview}</span>}
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition duration-300 ${open ? "rotate-180 text-primary" : "text-muted"}`}>{ic.chevron}</span>
      </button>
      {error && !open && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
      {/* it slides open and fades in, and slides closed again */}
      <div ref={box} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">
          {made && (
            <div className="pt-3">
              {children}
              {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
              {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
              {more && <div className="mt-3 space-y-3 rounded-xl bg-soft/70 p-3">{more}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Accordion({ title, info, open, onToggle, children }: { title: string; info: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <section className="border-b border-fg/10">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start">
        <span className="text-sm font-bold text-black dark:text-white">{title}</span>
        <span className={`grid h-6 w-6 place-items-center rounded-full border border-fg/15 text-muted transition-transform ${open ? "rotate-180" : ""}`}>{ic.chevron}</span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <p className="mb-3 text-xs leading-relaxed text-muted">{info}</p>
          {children}
        </div>
      )}
    </section>
  );
}

const newId = (type: string) => `${type}-${Date.now().toString(36)}${Math.floor(Math.random() * 100)}`;

function defaultSection(type: SectionType, lang: Lang): SectionConfig {
  if (type === "text") return newTextSection(newId("text"));
  if (type === "collection") return newCollection(newId("collection"));
  if (type === "slides") return newSlides(newId("slides"));
  if (type === "tiles") return newTiles(newId("tiles"));
  if (type === "banners") return newBanners(newId("banners"));
  if (type === "ribbon") return newRibbon(newId("ribbon"));
  if (type === "chips") return newChips(newId("chips"));
  if (type === "newsletter") return newNewsletter(newId("newsletter"));
  const base = defaultConfig.sections.find((s) => s.type === type);
  const copy = base ? (JSON.parse(JSON.stringify(base)) as SectionConfig) : (null as never);
  copy.id = newId(type);
  copy.visible = true;
  void lang;
  return copy;
}

/* ------------------------------------------------------------------ */
/*  Store pages: header, page elements, footer                         */
/* ------------------------------------------------------------------ */

/* Which part of the footer's screen owns a text clicked in the preview */
const footerBlockOf = (field: string): FootBlock =>
  ["phone", "whatsapp", "telegram", "email", "address"].includes(field) || field === "title-contact" ? "contact" : field.startsWith("social") || field === "title-social" ? "social" : field === "licenses" || field === "licenseNumber" || field === "title-licenses" ? "licenses" : field === "title-pages" ? "links" : "layout";

/** Puts the cursor in a field of the side panel once it can take it (its part may still be sliding open) */
function focusField(field: string) {
  let tries = 0;
  const tick = () => {
    const el = document.querySelector(`[data-field="${field}"]`) as HTMLElement | null;
    if (el && !el.closest("[inert]")) {
      el.focus();
      if (document.activeElement === el) return el.scrollIntoView({ block: "nearest" });
    }
    if (++tries < 25) setTimeout(tick, 60);
  };
  setTimeout(tick, 60);
}

export function PagesPanel({ lang, draft, update, editing, setEditing, focus, onlyElements = false }: { lang: Lang; draft: Draft; update: Update; editing: string | null; setEditing: (id: string | null) => void; focus: Focus; /* a page of the store has only elements: no header and no footer */ onlyElements?: boolean }) {
  const t = dc[lang];
  const [open, setOpen] = useState({ header: false, elements: true, footer: false });
  const [picker, setPicker] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [sub, setSub] = useState<SubKey | null>(null);
  /* the part of the footer's screen to open (asked again with a new n, so the same part can be asked twice) */
  const [footAsk, setFootAsk] = useState<{ block: FootBlock; n: number } | null>(null);
  const cfg = draft.config;

  /* Clicking the header or footer in the preview opens that group here. */
  useEffect(() => {
    if (focus?.id === "header") {
      setOpen({ header: true, elements: false, footer: false });
      setSub(null);
    }
    if (focus?.id === "announcement") {
      setOpen({ header: true, elements: false, footer: false });
      setSub("announcement");
    }
    if (focus?.id === "footer") {
      setOpen({ header: false, elements: false, footer: true });
      /* A text of the footer was clicked: the footer's screen opens on the part that owns it, its field's part opens (PartFocus)
         and the cursor goes in its field */
      if (focus.field) {
        setSub("footerSettings");
        setFootAsk({ block: footerBlockOf(focus.field), n: focus.n });
        focusField(focus.field);
      } else setSub(null);
    }
  }, [focus]);

  const setCfg = (fn: (c: StorefrontConfig) => StorefrontConfig) => update((d) => ({ ...d, config: fn(d.config) }));
  const setSections = (fn: (s: SectionConfig[]) => SectionConfig[]) => setCfg((c) => ({ ...c, sections: fn(c.sections) }));

  const move = (i: number, dir: -1 | 1) =>
    setSections((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const n = [...s];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const dropOn = (targetId: string) => {
    if (dragId && dragId !== targetId) {
      setSections((all) => {
        const from = all.findIndex((x) => x.id === dragId);
        const to = all.findIndex((x) => x.id === targetId);
        if (from < 0 || to < 0) return all;
        const n = [...all];
        const [item] = n.splice(from, 1);
        n.splice(to, 0, item);
        return n;
      });
    }
    setDragId(null);
    setOverId(null);
  };

  if (editing) {
    const s = cfg.sections.find((x) => x.id === editing);
    if (s) return <LinkTargets.Provider value={cfg.sections.filter((x) => x.id !== s.id).map((x) => ({ id: x.id, name: t.elements[x.type] }))}><ElementForm lang={lang} section={s} focusField={focus?.id === s.id ? focus.field : undefined} nonce={focus?.n ?? 0} onBack={() => setEditing(null)} onChange={(next) => setSections((all) => all.map((x) => (x.id === s.id ? next : x)))} onDelete={() => { setSections((all) => all.filter((x) => x.id !== s.id)); setEditing(null); }} /></LinkTargets.Provider>;
  }

  if (sub) {
    return (
      <SubShell lang={lang} title={t.rows[sub]} onBack={() => { setSub(null); setFootAsk(null); }}>
        <PartFocus.Provider value={{ field: focus?.id === "footer" ? focus.field : undefined, n: focus?.n ?? 0 }}>
        {sub === "headerSettings" && <LinkTargets.Provider value={[...cfg.sections.map((x) => ({ id: x.id, name: t.elements[x.type] })), { id: "footer", name: t.luxe.navFooter }]}><HeaderSettingsForm lang={lang} cfg={cfg} setCfg={setCfg} /></LinkTargets.Provider>}
        {sub === "announcement" && <LinkTargets.Provider value={cfg.sections.map((x) => ({ id: x.id, name: t.elements[x.type] }))}><AnnouncementForm lang={lang} cfg={cfg} setCfg={setCfg} /></LinkTargets.Provider>}
        {sub === "footerSettings" && <LinkTargets.Provider value={cfg.sections.map((x) => ({ id: x.id, name: t.elements[x.type] }))}><FooterForm lang={lang} draft={draft} update={update} ask={footAsk} /></LinkTargets.Provider>}
        </PartFocus.Provider>
      </SubShell>
    );
  }

  return (
    <div>
      {!onlyElements && (
      <Accordion title={t.sectionsTitle.header} info={t.sectionsInfo.header} open={open.header} onToggle={() => setOpen((o) => ({ ...o, header: !o.header }))}>
        <ul>
          <RowLink icon={ic.gear} label={t.rows.headerSettings} onClick={() => setSub("headerSettings")} />
          <RowLink icon={ic.megaphone} label={t.rows.announcement} onClick={() => setSub("announcement")} badge={cfg.announcement.show} />
        </ul>
      </Accordion>
      )}

      <Accordion title={t.sectionsTitle.elements} info={t.sectionsInfo.elements} open={open.elements} onToggle={() => setOpen((o) => ({ ...o, elements: !o.elements }))}>
        <ul className="space-y-1.5">
          {cfg.sections.map((s, i) => (
            <li
              key={s.id}
              draggable
              onDragStart={(e) => {
                setDragId(s.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOverId(s.id);
              }}
              onDrop={(e) => {
                e.preventDefault();
                dropOn(s.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              className={`relative rounded-lg border bg-card transition ${overId === s.id && dragId && dragId !== s.id ? "border-primary shadow-[0_0_0_2px_rgb(var(--primary)/0.25)]" : "border-fg/10"} ${dragId === s.id ? "opacity-40" : s.visible ? "" : "opacity-55"}`}
            >
              <div className="flex items-center gap-1 px-1.5 py-1">
                <span aria-hidden title={t.actions.drag} className="grid h-7 w-5 shrink-0 cursor-grab place-items-center text-muted/70 active:cursor-grabbing">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><circle cx="9" cy="6" r="1.500" /><circle cx="15" cy="6" r="1.500" /><circle cx="9" cy="12" r="1.500" /><circle cx="15" cy="12" r="1.500" /><circle cx="9" cy="18" r="1.500" /><circle cx="15" cy="18" r="1.500" /></svg>
                </span>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-soft text-primary">{ic.types[s.type]}</span>
                <button type="button" onClick={() => setEditing(s.id)} className="flex min-w-0 flex-1 items-center gap-1.5 px-1 text-start text-sm font-semibold">
                  <span className="truncate">{t.elements[s.type]}</span>
                  {!s.visible && <span className="shrink-0 text-muted">{ic.eyeOff}</span>}
                </button>
                <button type="button" className={roundBtnSm} disabled={i === 0} onClick={() => move(i, -1)} aria-label={t.actions.up} title={t.actions.up}>{ic.up}</button>
                <button type="button" className={roundBtnSm} disabled={i === cfg.sections.length - 1} onClick={() => move(i, 1)} aria-label={t.actions.down} title={t.actions.down}>{ic.down}</button>
                <button type="button" className={roundBtnSm} onClick={() => setMenuId(menuId === s.id ? null : s.id)} aria-expanded={menuId === s.id} aria-label={t.more} title={t.more}>{ic.more}</button>
              </div>

              {menuId === s.id && (
                <div className="flex flex-wrap gap-1 border-t border-fg/10 px-2 py-1.5">
                  <button type="button" onClick={() => { setEditing(s.id); setMenuId(null); }} className={menuBtn}>{ic.edit}{t.actions.edit}</button>
                  <button type="button" onClick={() => { setSections((all) => all.map((x) => (x.id === s.id ? ({ ...x, visible: !x.visible } as SectionConfig) : x))); setMenuId(null); }} className={menuBtn}>{s.visible ? ic.eyeOff : ic.eye}{s.visible ? t.actions.hide : t.actions.show}</button>
                  <button type="button" onClick={() => { setSections((all) => { const n = [...all]; n.splice(i + 1, 0, { ...(JSON.parse(JSON.stringify(s)) as SectionConfig), id: newId(s.type) }); return n; }); setMenuId(null); }} className={menuBtn}>{ic.copy}{t.actions.duplicate}</button>
                  <button type="button" onClick={() => { setConfirm(s.id); setMenuId(null); }} className={`${menuBtn} hover:!text-rose-600`}>{ic.trash}{t.actions.delete}</button>
                </div>
              )}

              {confirm === s.id && (
                <div className="flex flex-wrap items-center gap-2 rounded-b-lg bg-rose-500/10 px-3 py-2">
                  <span className="text-xs text-rose-700 dark:text-rose-400">{t.deleteAsk}</span>
                  <button type="button" onClick={() => { setSections((all) => all.filter((x) => x.id !== s.id)); setConfirm(null); }} className="rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white">{t.deleteYes}</button>
                  <button type="button" onClick={() => setConfirm(null)} className="rounded-md border border-fg/20 px-3 py-1 text-xs font-semibold">{t.cancel}</button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setPicker(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/60 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5">
          {ic.plus}
          {t.actions.add}
        </button>
      </Accordion>

      {!onlyElements && (
      <Accordion title={t.sectionsTitle.footer} info={t.sectionsInfo.footer} open={open.footer} onToggle={() => setOpen((o) => ({ ...o, footer: !o.footer }))}>
        <ul>
          {/* the whole footer is edited on one screen, in parts that open and close */}
          <RowLink icon={ic.gear} label={t.rows.footerSettings} onClick={() => { setFootAsk(null); setSub("footerSettings"); }} />
        </ul>
      </Accordion>
      )}

      {picker && (
        <Picker
          lang={lang}
          onClose={() => setPicker(false)}
          onPick={(type) => {
            const s = defaultSection(type, lang);
            setSections((all) => [...all, s]);
            setPicker(false);
            setEditing(s.id);
          }}
        />
      )}
    </div>
  );
}

function Picker({ lang, onClose, onPick }: { lang: Lang; onClose: () => void; onPick: (t: SectionType) => void }) {
  const t = dc[lang];
  const [q, setQ] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const types = (Object.keys(t.elements) as SectionType[]).filter((k) => t.elements[k].toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={t.picker.title} className="dash w-full max-w-lg rounded-3xl bg-card p-6 text-fg shadow-2xl ring-1 ring-fg/10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t.picker.title}</h2>
          <button type="button" onClick={onClose} aria-label={t.picker.close} className={roundBtn}>{ic.close}</button>
        </div>
        <label className="relative mt-4 block">
          <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted">{ic.search}</span>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.picker.search} aria-label={t.picker.search} className={`${input} h-11 ps-11`} />
        </label>
        {types.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{t.picker.none}</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {types.map((k) => (
              <li key={k}>
                <button type="button" onClick={() => onPick(k)} className="flex h-full w-full flex-col items-center gap-3 rounded-2xl border border-fg/15 p-4 text-center text-sm font-semibold transition hover:border-primary hover:bg-primary/5">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-soft text-primary">{ic.types[k]}</span>
                  {t.elements[k]}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ElementForm({ lang, section, focusField, nonce, onBack, onChange, onDelete }: { lang: Lang; section: SectionConfig; focusField?: string; nonce: number; onBack: () => void; onChange: (s: SectionConfig) => void; onDelete: () => void }) {
  const t = dc[lang];
  /* The delete button at the bottom of the form asks once before it deletes */
  const [asking, setAsking] = useState(false);
  const askBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    /* The question opens at the very bottom: bring it into view so he does not have to look for it */
    if (asking) askBox.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [asking]);
  const s = section;

  /* Opened by clicking a part of the store: put the cursor in that part's field. */
  useEffect(() => {
    if (!focusField) return;
    const id = setTimeout(() => (document.querySelector(`[data-field="${focusField}"]`) as HTMLElement | null)?.focus(), 60);
    return () => clearTimeout(id);
  }, [focusField, nonce, section.id]);
  const text = (v: { en: string; ar: string }, set: (b: { en: string; ar: string }) => void, label: string, area = false, field?: string, more?: React.ReactNode, extra?: React.ReactNode) => (
    <Part lang={lang} label={label} more={more} field={field} preview={v[lang]?.trim() ? (v[lang].trim().length > 24 ? `${v[lang].trim().slice(0, 24)}…` : v[lang].trim()) : undefined}>
      {area ? (
        <textarea data-field={field} value={v[lang]} onChange={(e) => set({ ...v, [lang]: e.target.value })} rows={area ? 6 : 3} maxLength={600} className={`${input} resize-y py-3`} />
      ) : (
        <input data-field={field} value={v[lang]} onChange={(e) => set({ ...v, [lang]: e.target.value })} maxLength={60} className={`${input} h-11`} />
      )}
      {extra}
    </Part>
  );

  let body: React.ReactNode;
  if (s.type === "hero") {
    const split = s.settings.layout === "split";
    const full = !!s.settings.fullWidth;
    const pop = s.settings.layout === "pop";
    const orbit = s.settings.layout === "orbit";
    const pp = popT[lang];
    const tall = s.settings.height === "tall";
    const defaults = { title: orbit ? 80 : pop ? 80 : split ? (full ? 100 : 48) : tall ? 56 : 36, subtitle: pop ? 20 : split ? (full ? 24 : 15) : tall ? 17 : 15, eyebrow: 34, price: 26, detail: 13, button: pop ? 16 : split ? 15 : 14 };
    const setPop = (patch: Partial<NonNullable<typeof s.settings.popColors>>) => onChange({ ...s, settings: { ...s.settings, popColors: { ...(s.settings.popColors ?? {}), ...patch } } });
    type HeroKey = keyof typeof defaults;
    const setSize = (key: HeroKey, v: number | undefined) => onChange({ ...s, settings: { ...s.settings, sizes: { ...(s.settings.sizes ?? {}), [key]: v } } });
    const stepper = (key: HeroKey) => (
      <Stepper lang={lang} label={t.luxe.textSize} value={s.settings.sizes?.[key] ?? defaults[key]} auto={s.settings.sizes?.[key] === undefined} onChange={(v) => setSize(key, v)} onReset={() => setSize(key, undefined)} />
    );
    const setColor = (key: HeroKey, v: string | undefined) => onChange({ ...s, settings: { ...s.settings, colors: { ...(s.settings.colors ?? {}), [key]: v } } });
    /* the color the preview draws when none is chosen: on the banner the words sit on the first picture or color (white on a dark one), and the button is dark on white */
    const first = s.settings.backgrounds?.[0];
    const onBanner = first?.kind === "image" && first.image ? "#ffffff" : first?.color ? onColor(first.color) : "#ffffff";
    const autoColor = (key: HeroKey) => (split || pop || orbit ? undefined : key === "button" ? "#12262b" : onBanner);
    const colorChip = (key: HeroKey) => (
      <ColorChip lang={lang} label={t.luxe.textColor} value={s.settings.colors?.[key]} auto={autoColor(key)} onChange={(v) => setColor(key, v)} onReset={() => setColor(key, undefined)} />
    );
    /* the size and color of one part, opened with the ▾ beside its name */
    const setStyle = (key: "title" | "subtitle" | "eyebrow", v: TextStyle) => onChange({ ...s, settings: { ...s.settings, styles: { ...(s.settings.styles ?? {}), [key]: v } } });
    const more = (key: HeroKey) => (
      <>
        {(key === "title" || key === "subtitle" || key === "eyebrow") && <StyleBar lang={lang} value={s.settings.styles?.[key]} onChange={(v) => setStyle(key, v)} boldNow={key !== "subtitle"} />}
        {stepper(key)}
        {colorChip(key)}
      </>
    );
    const fontGrid = (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-fg/80">{t.luxe.titleFont}</p>
        <div className="grid grid-cols-2 gap-2">
          {(["", "readex", "plex", "baloo", "elegant", "cairo", "tajawal", "messiri", "almarai", "kufi", "ruqaa", "lemonada", "amiri"] as HeroFont[]).map((k) => {
            const on = (s.settings.titleFont ?? "") === k;
            const name = k === "" ? t.luxe.fontDefault : k === "ruqaa" ? t.luxe.fontRuqaa : k === "lemonada" ? t.luxe.fontLemonada : k === "amiri" ? t.luxe.fontAmiri : t.options.fonts[k];
            return (
              <button key={k || "same"} type="button" onClick={() => onChange({ ...s, settings: { ...s.settings, titleFont: k } })} aria-pressed={on} className={`rounded-xl border px-3 py-2.5 text-start transition ${on ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
                <span className="block text-base font-bold leading-snug [overflow-wrap:anywhere]" style={{ fontFamily: heroTitleFamily(k) }}>{t.options.fontSample}</span>
                <span className="mt-1 block text-[11px] font-semibold text-muted">{name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
    const set = (patch: Partial<typeof s.settings>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
    const link2 = <Leads lang={lang} label={popT[lang].button2Leads} value={s.settings.link2 ?? ""} onChange={(link2) => set({ link2 })} />;
    const photoField = (label: string, ratio: string, radius: string, max: number, fill = false, hint?: string) => (
      <Part lang={lang} label={label} hint={hint}>
        <div data-field="photo" className="space-y-3">
          <PhotoPicker lang={lang} value={s.settings.photo ?? ""} onChange={(photo) => set({ photo, photoPos: undefined })} max={max} />
          <PictureMover lang={lang} image={s.settings.photo ?? ""} value={s.settings.photoPos} onChange={(photoPos) => set({ photoPos })} ratio={ratio} radius={radius} fill={fill} />
        </div>
      </Part>
    );
    body = (
      <>
        {text(s.settings.title, (title) => set({ title }), t.form.title, false, "title", <>{more("title")}{fontGrid}</>)}
        {text(s.settings.subtitle, (subtitle) => set({ subtitle }), t.form.subtitle, true, "subtitle", more("subtitle"))}
        {text(s.settings.button, (button) => set({ button }), t.form.button, false, "button", more("button"), <Leads lang={lang} label={popT[lang].buttonLeads} value={s.settings.link ?? ""} onChange={(link) => set({ link })} />)}
        {/* the round-photo layout came with a theme that was removed: it is offered only to a design that already uses it */}
        <Part lang={lang} label={t.form.heroLayout}>
          <Seg lang={lang} value={s.settings.layout ?? "banner"} onChange={(layout) => set({ layout })} options={[{ key: "banner", label: t.form.layoutBanner }, { key: "split", label: t.form.layoutSplit }, { key: "pop", label: pp.layoutPop, theme: "lamma" }, ...(orbit ? [{ key: "orbit" as const, label: pp.layoutOrbit }] : [])]} />
        </Part>
        {split && (
          <>
            {photoField(t.form.heroPhoto, "4 / 5", "12px", 1600, true, t.form.heroPhotoHint)}
            <Part lang={lang} label={t.form.heroPhotoSide}>
              <Seg value={s.settings.photoSide ?? "start"} onChange={(photoSide) => set({ photoSide })} options={[{ key: "start", label: t.form.sideStart }, { key: "end", label: t.form.sideEnd }]} />
            </Part>
            {text(s.settings.eyebrow ?? noText, (eyebrow) => set({ eyebrow }), t.luxe.heroEyebrow, false, "eyebrow", more("eyebrow"))}
            <Part lang={lang} label={t.luxe.heroPrice} more={more("price")}>
              <input data-field="price" value={s.settings.price ?? ""} onChange={(e) => set({ price: e.target.value })} maxLength={60} className={`${input} h-11`} />
            </Part>
            {text(s.settings.size ?? noText, (size) => set({ size }), t.luxe.heroSize, false, "size", more("detail"))}
            {text(s.settings.button2 ?? noText, (button2) => set({ button2 }), t.luxe.heroButton2, false, "button2", more("button"), link2)}
          </>
        )}
        {pop && (
          <>
            {text(s.settings.eyebrow ?? noText, (eyebrow) => set({ eyebrow }), pp.chip, false, "eyebrow", colorChip("eyebrow"))}
            <Part lang={lang} label={pp.accentWord} hint={pp.accentWordHint} more={<ColorChip lang={lang} label={pp.colorAccent} value={s.settings.popColors?.accent} onChange={(accent) => setPop({ accent })} onReset={() => setPop({ accent: undefined })} />}>
              <input data-field="accentWord" value={(s.settings.accentWord ?? noText)[lang]} onChange={(e) => set({ accentWord: { ...(s.settings.accentWord ?? noText), [lang]: e.target.value } })} maxLength={30} className={`${input} h-11`} />
            </Part>
            {text(s.settings.button2 ?? noText, (button2) => set({ button2 }), t.luxe.heroButton2, false, "button2", more("button"), link2)}
            <Part lang={lang} label={pp.sticker} more={<ColorChip lang={lang} label={pp.colorSticker} value={s.settings.popColors?.sticker} onChange={(sticker) => setPop({ sticker })} onReset={() => setPop({ sticker: undefined })} />}>
              <textarea data-field="sticker" value={(s.settings.sticker ?? noText)[lang]} onChange={(e) => set({ sticker: { ...(s.settings.sticker ?? noText), [lang]: e.target.value } })} rows={2} maxLength={30} className={`${input} resize-none py-2.5`} />
            </Part>
            {photoField(pp.photo1, "3 / 4", "999px 999px 26px 26px", 1200)}
            <Part lang={lang} label={pp.photo2}>
              <div data-field="photo2" className="space-y-3"><PhotoPicker lang={lang} value={s.settings.photo2 ?? ""} onChange={(photo2) => set({ photo2, photo2Pos: undefined })} max={1200} /><PictureMover lang={lang} image={s.settings.photo2 ?? ""} value={s.settings.photo2Pos} onChange={(photo2Pos) => set({ photo2Pos })} ratio="3 / 4" radius="22px" /></div>
            </Part>
            <ColorChip lang={lang} label={pp.colorBlob} value={s.settings.popColors?.blob} onChange={(blob) => setPop({ blob })} onReset={() => setPop({ blob: undefined })} />
          </>
        )}
        {orbit && (
          <>
            {text(s.settings.eyebrow ?? noText, (eyebrow) => set({ eyebrow }), pp.kickerLatin, false, "eyebrow", more("eyebrow"))}
            <Part lang={lang} label={pp.accentWord} hint={pp.accentWordHint} more={<ColorChip lang={lang} label={pp.colorGold} value={s.settings.popColors?.accent} onChange={(accent) => setPop({ accent })} onReset={() => setPop({ accent: undefined })} />}>
              <input data-field="accentWord" value={(s.settings.accentWord ?? noText)[lang]} onChange={(e) => set({ accentWord: { ...(s.settings.accentWord ?? noText), [lang]: e.target.value } })} maxLength={40} className={`${input} h-11`} />
            </Part>
            {text(s.settings.button2 ?? noText, (button2) => set({ button2 }), t.luxe.heroButton2, false, "button2", more("button"), link2)}
            {photoField(pp.photo1, "1 / 1", "999px", 1400, true)}
            {text(s.settings.size ?? noText, (size) => set({ size }), pp.tagLabel, false, "size", <ColorChip lang={lang} label={pp.colorTag} value={s.settings.popColors?.sticker || "#f2eee6"} onChange={(sticker) => setPop({ sticker })} onReset={() => setPop({ sticker: undefined })} />)}
            <Part lang={lang} label={pp.tagPrice}>
              <input data-field="price" value={s.settings.price ?? ""} onChange={(e) => set({ price: e.target.value })} maxLength={30} className={`${input} h-11`} />
            </Part>
          </>
        )}
        {/* The backgrounds and the product cards belong to the plain banner. In the photo-beside-text layout the panel color above is the color. */}
        {!split && !pop && !orbit && (
          <Part lang={lang} label={t.form.backgrounds}>
            <HeroBackgrounds lang={lang} settings={s.settings} onChange={(settings) => onChange({ ...s, settings })} />
          </Part>
        )}
        {/* the plain banner: where the words sit, how tall it is, edge to edge, and a second button */}
        {!split && !pop && !orbit && (
          <>
            <Part lang={lang} label={pp.heroTextPos}>
              <Seg value={s.settings.textPos ?? "center"} cols={3} onChange={(textPos) => set({ textPos })} options={[{ key: "center", label: pp.textPosCenter }, { key: "bottom-start", label: pp.textPosBottomStart }, { key: "bottom-center", label: pp.textPosBottomCenter }]} />
            </Part>
            <Part lang={lang} label={pp.heroHeight}>
              <Seg value={s.settings.height ?? "normal"} onChange={(height) => set({ height })} options={[{ key: "normal", label: pp.heightNormal }, { key: "tall", label: pp.heightTall }]} />
            </Part>
            {text(s.settings.button2 ?? noText, (button2) => set({ button2 }), t.luxe.heroButton2, false, "button2", more("button"), link2)}
          </>
        )}
        {!pop && !orbit && <Toggle on={full} onChange={(fullWidth) => set({ fullWidth })} label={pp.heroFullWidth} />}
        {!split && !pop && !orbit && <Toggle on={s.settings.showCards ?? true} onChange={(showCards) => set({ showCards })} label={t.form.showCards} />}
        {!split && !pop && !orbit && (s.settings.showCards ?? true) && (
          <>
            <HeroCards lang={lang} ids={s.settings.cardIds ?? []} onChange={(cardIds) => set({ cardIds })} />
            <Part lang={lang} label={t.form.cardsArrange}>
              <Seg value={s.settings.cardLook?.arrange ?? "fan"} cols={3} onChange={(arrange) => set({ cardLook: { ...s.settings.cardLook, arrange } })} options={[{ key: "fan", label: t.form.arrangeFan }, { key: "row", label: t.form.arrangeRow }, { key: "single", label: t.form.arrangeSingle }]} />
            </Part>
            <Part lang={lang} label={t.form.cardsFrame}>
              <Seg value={s.settings.cardLook?.frame ?? "card"} onChange={(frame) => set({ cardLook: { ...s.settings.cardLook, frame } })} options={[{ key: "card", label: t.form.frameCard }, { key: "bare", label: t.form.frameBare }]} />
            </Part>
            <Part lang={lang} label={t.form.cardsShape}>
              <Seg value={s.settings.cardLook?.shape ?? "portrait"} cols={3} onChange={(shape) => set({ cardLook: { ...s.settings.cardLook, shape } })} options={[{ key: "portrait", label: t.form.shapePortrait }, { key: "square", label: t.form.shapeSquare }, { key: "round", label: t.form.shapeRound }]} />
            </Part>
            <Toggle on={s.settings.cardLook?.showName ?? true} onChange={(showName) => set({ cardLook: { ...s.settings.cardLook, showName } })} label={t.form.cardsName} />
          </>
        )}
      </>
    );
  } else if (s.type === "featured" || s.type === "discounts") {
    body = (
      <>
        {text(s.settings.title, (title) => onChange({ ...s, settings: { ...s.settings, title } } as SectionConfig), t.form.title)}
        <Part lang={lang} label={t.form.count}>
          <div className="flex gap-2">
            {[2, 3, 4, 6, 8].map((n) => (
              <button key={n} type="button" onClick={() => onChange({ ...s, settings: { ...s.settings, count: n } } as SectionConfig)} aria-pressed={s.settings.count === n} className={`h-10 flex-1 rounded-xl border text-sm font-semibold transition ${s.settings.count === n ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
                {n}
              </button>
            ))}
          </div>
        </Part>
      </>
    );
  } else if (s.type === "products") {
    body = (
      <>
        {text(s.settings.title, (title) => onChange({ ...s, settings: { ...s.settings, title } }), t.form.title)}
        <Part lang={lang} label={t.form.columns}>
          <div className="flex gap-2">
            {([2, 3, 4] as const).map((n) => (
              <button key={n} type="button" onClick={() => onChange({ ...s, settings: { ...s.settings, columns: n } })} aria-pressed={s.settings.columns === n} className={`h-10 flex-1 rounded-xl border text-sm font-semibold transition ${s.settings.columns === n ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
                {n}
              </button>
            ))}
          </div>
        </Part>
        <Part lang={lang} label={t.luxe.limit}>
          <Seg value={String(s.settings.limit ?? 0)} cols={4} onChange={(v) => onChange({ ...s, settings: { ...s.settings, limit: Number(v) } })} options={[0, 4, 8, 12].map((n) => ({ key: String(n), label: n === 0 ? t.luxe.limitAll : String(n) }))} />
        </Part>
        <Toggle on={s.settings.showFilters} onChange={(showFilters) => onChange({ ...s, settings: { ...s.settings, showFilters } })} label={t.form.filters} />
      </>
    );
  } else if (s.type === "slides") {
    body = <SlidesForm lang={lang} s={s} onChange={onChange} />;
  } else if (s.type === "tiles") {
    body = <TilesForm lang={lang} s={s} onChange={onChange} text={text} />;
  } else if (s.type === "banners") {
    body = <BannersForm lang={lang} s={s} onChange={onChange} />;
  } else if (s.type === "ribbon") {
    body = <RibbonForm lang={lang} s={s} onChange={onChange} />;
  } else if (s.type === "chips") {
    body = <ChipsForm lang={lang} s={s} onChange={onChange} />;
  } else if (s.type === "newsletter") {
    body = <NewsletterForm lang={lang} s={s} onChange={onChange} text={text} />;
  } else if (s.type === "collection") {
    body = <CollectionForm lang={lang} s={s} onChange={onChange} text={text} />;
  } else if (s.type === "reviews") {
    const items = s.settings.items ?? [];
    const setItem = (i: number, patch: Partial<Review>) => onChange({ ...s, settings: { ...s.settings, items: items.map((r, j) => (j === i ? { ...r, ...patch } : r)) } });
    body = (
      <>
        {text(s.settings.title, (title) => onChange({ ...s, settings: { ...s.settings, title } }), t.form.title, false, "title")}
        <p className="rounded-xl bg-soft px-4 py-3 text-xs leading-relaxed text-muted">{t.form.reviewsHint}</p>
        {items.map((r, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-fg/10 p-3">
            <div className="flex items-center gap-2">
              <input value={r.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder={t.form.reviewName} aria-label={t.form.reviewName} maxLength={40} className={`${input} h-10 flex-1`} />
              <button type="button" onClick={() => onChange({ ...s, settings: { ...s.settings, items: items.filter((_, j) => j !== i) } })} aria-label={t.form.removeReview} title={t.form.removeReview} className={`${roundBtn} hover:!text-rose-600`}>{ic.trash}</button>
            </div>
            <textarea value={r.text} onChange={(e) => setItem(i, { text: e.target.value })} placeholder={t.form.reviewText} aria-label={t.form.reviewText} rows={3} maxLength={240} className={`${input} resize-none py-2.5`} />
            <div className="flex items-center gap-1" role="group" aria-label={t.form.reviewStars}>
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <button key={n} type="button" onClick={() => setItem(i, { stars: n })} aria-label={`${n}`} aria-pressed={r.stars === n} className="p-0.5">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill={n <= r.stars ? "#f5b301" : "#d1d5db"} aria-hidden>
                    <path d="m12 3 2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.300 6.800 19.100l1-5.800L3.500 9.200l5.900-.8L12 3Z" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        ))}
        {items.length < 12 && (
          <button type="button" onClick={() => onChange({ ...s, settings: { ...s.settings, items: [...items, { name: "", text: "", stars: 5 }] } })} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/60 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5">
            {ic.plus}
            {t.form.addReview}
          </button>
        )}
      </>
    );
  } else if (s.type === "text") {
    const set = (patch: Partial<typeof s.settings>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
    const statement = s.settings.style === "statement";
    type TextKey = "title" | "body" | "eyebrow" | "button";
    const defaults: Record<TextKey, number> = { title: statement ? 56 : 24, body: statement ? 18 : 15, eyebrow: 22, button: 15 };
    const more = (k: TextKey) => (
      <>
        {k !== "button" && <StyleBar lang={lang} value={s.settings.styles?.[k]} onChange={(v) => set({ styles: { ...(s.settings.styles ?? {}), [k]: v } })} boldNow={k === "title"} />}
        <Stepper lang={lang} label={t.luxe.textSize} value={s.settings.sizes?.[k] ?? defaults[k]} auto={s.settings.sizes?.[k] === undefined} onChange={(v) => set({ sizes: { ...(s.settings.sizes ?? {}), [k]: v } })} onReset={() => set({ sizes: { ...(s.settings.sizes ?? {}), [k]: undefined } })} />
        <ColorChip lang={lang} label={t.luxe.textColor} value={s.settings.colors?.[k]} onChange={(v) => set({ colors: { ...(s.settings.colors ?? {}), [k]: v } })} onReset={() => set({ colors: { ...(s.settings.colors ?? {}), [k]: undefined } })} />
      </>
    );
    body = (
      <>
        {text(s.settings.title, (title) => set({ title }), t.form.title, false, "title", more("title"))}
        {text(s.settings.body, (b) => set({ body: b }), t.form.body, true, "body", more("body"))}
        {s.settings.style !== "statement" && <Part lang={lang} label={t.form.align}>
          <div className="flex gap-2">
            {(["start", "center"] as const).map((a) => (
              <button key={a} type="button" onClick={() => set({ align: a })} aria-pressed={s.settings.align === a} className={`h-10 flex-1 rounded-xl border text-sm font-semibold transition ${s.settings.align === a ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
                {a === "start" ? t.form.alignStart : t.form.alignCenter}
              </button>
            ))}
          </div>
        </Part>}
        {/* The centered statement came with a theme that was removed: a design that already uses it keeps it, and can go back to the plain one */}
        {s.settings.style === "statement" && <Part lang={lang} label={popT[lang].textStyle}>
          <Seg lang={lang} value={s.settings.style ?? "plain"} onChange={(style) => set({ style })} options={[{ key: "plain", label: popT[lang].textPlain }, { key: "statement", label: popT[lang].textStatement }]} />
        </Part>}
        {s.settings.style === "statement" && (
          <>
            {text(s.settings.eyebrow ?? noText, (eyebrow) => set({ eyebrow }), popT[lang].textEyebrow, false, "eyebrow", more("eyebrow"))}
            {text(s.settings.button ?? noText, (button) => set({ button }), popT[lang].textButton, false, "button", more("button"), <Leads lang={lang} label={popT[lang].textLeads} value={s.settings.link ?? ""} onChange={(link) => set({ link })} />)}
            <Part lang={lang} label={popT[lang].trustTitle}>
              <div data-field="trust" className="space-y-2">
                {(s.settings.trust ?? []).map((x, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={x[lang] ?? ""} onChange={(e) => set({ trust: (s.settings.trust ?? []).map((y, j) => (j === i ? { ...y, [lang]: e.target.value } : y)) })} maxLength={40} aria-label={popT[lang].trustTitle} className={`${input} h-10 flex-1`} />
                    <button type="button" className={`${roundBtnSm} hover:!text-rose-600`} onClick={() => set({ trust: (s.settings.trust ?? []).filter((_, j) => j !== i) })} aria-label={popT[lang].trustRemove} title={popT[lang].trustRemove}>{ic.trash}</button>
                  </div>
                ))}
                {(s.settings.trust ?? []).length < 5 && (
                  <button type="button" onClick={() => set({ trust: [...(s.settings.trust ?? []), { en: "", ar: "" }] })} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 text-sm font-bold text-primary transition hover:bg-primary/10">
                    {ic.plus}
                    {popT[lang].trustAdd}
                  </button>
                )}
              </div>
            </Part>
          </>
        )}
        {s.settings.style !== "statement" && <Toggle on={s.settings.tint} onChange={(tint) => set({ tint })} label={t.form.tint} />}
        <Part lang={lang} label={t.form.samples} hint={t.form.samplesHint}>
          <ul className="space-y-2">
            {sampleTexts.map((x) => (
              <li key={x.name.en}>
                <button type="button" onClick={() => set({ title: x.title, body: x.body })} className="w-full rounded-xl border border-fg/15 px-4 py-2.5 text-start text-sm font-semibold transition hover:border-primary hover:bg-primary/5">
                  {x.name[lang]}
                </button>
              </li>
            ))}
          </ul>
        </Part>
      </>
    );
  } else if (s.type === "perks") {
    const items = s.settings.items ?? [];
    const setItem = (i: number, patch: Partial<Perk>) => onChange({ ...s, settings: { ...s.settings, items: items.map((p, j) => (j === i ? { ...p, ...patch } : p)) } });
    const icons: PerkIcon[] = ["truck", "shield", "returns", "gift", "clock", "chat"];
    body = (
      <>
        <p className="text-sm font-bold text-black dark:text-white">{t.form.items}</p>
        {items.map((p, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-fg/10 p-3">
            <div className="flex items-start gap-2">
              <IconChoice lang={lang} value={p.icon} image={p.image} onPick={(icon) => setItem(i, { icon })} onImage={(image) => setItem(i, { icon: "image", image })} />
              <button type="button" onClick={() => onChange({ ...s, settings: { ...s.settings, items: items.filter((_, j) => j !== i) } })} aria-label={t.form.removeItem} title={t.form.removeItem} className={`${roundBtn} hover:!text-rose-600`}>{ic.trash}</button>
            </div>
            <input value={p.title[lang]} onChange={(e) => setItem(i, { title: { ...p.title, [lang]: e.target.value } })} placeholder={t.form.itemTitle} aria-label={t.form.itemTitle} maxLength={40} className={`${input} h-10`} />
            <input value={p.desc[lang]} onChange={(e) => setItem(i, { desc: { ...p.desc, [lang]: e.target.value } })} placeholder={t.form.itemDesc} aria-label={t.form.itemDesc} maxLength={60} className={`${input} h-10`} />
          </div>
        ))}
        {items.length < 4 && (
          <button type="button" onClick={() => onChange({ ...s, settings: { ...s.settings, items: [...items, { icon: "gift", title: { en: "", ar: "" }, desc: { en: "", ar: "" } }] } })} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/60 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5">
            {ic.plus}
            {t.form.addItem}
          </button>
        )}
      </>
    );
  } else {
    body = <p className="text-sm text-muted">{t.form.noSettings}</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-fg/10 px-4 py-3">
        <button type="button" onClick={onBack} aria-label={t.form.back} className={roundBtn}>{ic.back}</button>
        <div>
          <p className="text-xs text-muted">{t.form.now}</p>
          <p className="font-bold text-black dark:text-white">{t.elements[s.type]}</p>
        </div>
      </div>
      {/* every part of the element on its own, with a thin line between them */}
      <PartFocus.Provider value={{ field: focusField, n: nonce }}>
        <div className="divide-y divide-fg/10 px-4 [&>*]:py-5">{body}</div>
      </PartFocus.Provider>

      {/* Deleting the element: the last thing in its form */}
      <div className="border-t border-fg/10 p-4">
        {asking ? (
          <div ref={askBox} className="rounded-xl bg-rose-500/10 p-3">
            <p className="text-sm text-rose-700 dark:text-rose-400">{t.deleteAsk}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={onDelete} className="h-10 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-700">{t.deleteYes}</button>
              <button type="button" onClick={() => setAsking(false)} className="h-10 rounded-xl border border-fg/20 px-5 text-sm font-semibold transition hover:bg-soft">{t.cancel}</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAsking(true)} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-500/50 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10">
            {ic.trash}
            {t.actions.delete}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Store identity                                                     */
/* ------------------------------------------------------------------ */

export function IdentityPanel({ lang, draft, update, showErrors, attn }: { lang: Lang; draft: Draft; update: Update; showErrors: boolean; attn?: string | null }) {
  const t = dc[lang].identity;
  const id = draft.identity;
  const set = (patch: Partial<Identity>) => update((d) => ({ ...d, identity: { ...d.identity, ...patch } }));
  return (
    <div className="divide-y divide-fg/10 px-4 [&>*]:py-5">
      <h2 className="font-bold text-black dark:text-white">{t.title}</h2>
      <div data-attn="name" className={attn === "name" ? "attention" : ""}>
      <Part lang={lang} force={attn === "name"} label={`${t.name} *`} hint={t.nameHint} error={showErrors && visibleLength(id.name) < 2 ? t.errName : undefined}>
        <input value={id.name} onChange={(e) => set({ name: e.target.value })} maxLength={40} className={`${input} h-11`} />
      </Part>
      </div>
      <Part lang={lang} label={t.logo} hint={t.logoHint}>
        <LogoChoice lang={lang} draft={draft} update={update} />
      </Part>
      <Part lang={lang} label={t.favicon} hint={t.faviconHint}>
        <FaviconChoice lang={lang} draft={draft} update={update} />
      </Part>
      <Part lang={lang} label={t.description}>
        <textarea value={id.description} onChange={(e) => set({ description: e.target.value })} placeholder={t.descriptionPh} rows={4} maxLength={200} className={`${input} resize-none py-3`} />
      </Part>
      <div data-attn="color" className={attn === "color" ? "attention" : ""}>
      <Part lang={lang} force={attn === "color"} label={t.color}>
        <ColorPicker value={id.color} onChange={(color) => set({ color })} label={t.hex} bad={t.hexBad} />
      </Part>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Design options                                                     */
/* ------------------------------------------------------------------ */

/** The website background: none, a picture or GIF, or a looping video. */
function PageBackground({ lang, draft, update }: { lang: Lang; draft: Draft; update: Update }) {
  const t = dc[lang].pageBg;
  const bg = draft.config.pageBackground;
  const url = useMediaUrl(bg.kind === "none" ? "" : bg.media);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof bg>) => update((d) => ({ ...d, config: { ...d.config, pageBackground: { ...d.config.pageBackground, ...patch } } }));

  const take = async (file: File | undefined) => {
    if (!file || editLocked()) return;
    /* what the file really is, from its bytes */
    const check = await checkImage(file, imageRules.background);
    if ("problem" in check) return setProblem(check.problem === "type" || check.problem === "size" ? t.bad : uploadProblemText[check.problem][lang]);
    const isVideo = check.kind === "mp4" || check.kind === "webm";
    setBusy(true);
    /* a still picture is redrawn: right way up, without its hidden data (EXIF, GPS) */
    let media: Blob = file;
    if (!isVideo && !check.animated) {
      const picked = await pickPicture(file, imageRules.background, 2400, "image/jpeg", 0.85);
      if ("problem" in picked) {
        setBusy(false);
        return setProblem(uploadProblemText[picked.problem][lang]);
      }
      media = await (await fetch(picked.url)).blob();
    }
    const id = `bg-${Date.now().toString(36)}`;
    const ok = await putMedia(id, media);
    setBusy(false);
    if (!ok) return setProblem(t.failed);
    setProblem("");
    if (bg.media) void deleteMedia(bg.media);
    set({ kind: isVideo ? "video" : "image", media: id, name: cleanFileName(file.name), size: media.size, pos: undefined });
  };

  const remove = () => {
    if (editLocked()) return;
    if (bg.media) void deleteMedia(bg.media);
    set({ kind: "none", media: "", name: "", size: 0 });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">{t.hint}</p>

      {bg.kind === "none" ? (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-4 py-3 transition hover:bg-primary/10 focus-within:ring-2 focus-within:ring-primary/40">
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void take(f); }} />
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm">{upIcon}</span>
          <span className="text-sm font-bold text-primary">{busy ? "…" : t.upload}</span>
        </label>
      ) : (
        <div className="space-y-3 rounded-xl border border-fg/10 p-3">
          <div className="flex items-center gap-3">
            <span className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-soft ring-1 ring-black/10">
              {url && bg.kind === "video" ? (
                <video src={url} muted loop playsInline autoPlay className="h-full w-full object-cover" />
              ) : url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="h-full w-full object-cover" />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-primary">{bg.kind === "video" ? t.video : t.image}</span>
              <span className="block truncate text-xs text-muted" dir="ltr">{bg.name}</span>
              <span className="block text-xs text-muted" dir="ltr">{(bg.size / 1_000_000).toFixed(1)} {t.sizeMb}</span>
            </span>
            <button type="button" onClick={remove} aria-label={t.remove} title={t.remove} className={`${roundBtn} hover:!text-rose-600`}>{ic.trash}</button>
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-primary/50 py-2 text-xs font-semibold text-primary transition hover:bg-primary/5 focus-within:ring-2 focus-within:ring-primary/40">
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void take(f); }} />
            {busy ? "…" : t.upload}
          </label>
          <div>
            <p className="mb-1.5 flex items-center justify-between text-sm font-semibold">
              <span>{t.veil}</span>
              <span dir="ltr" className="text-xs text-muted">{bg.veil}%</span>
            </p>
            <input type="range" min={0} max={90} value={bg.veil} onChange={(e) => set({ veil: Number(e.target.value) })} aria-label={t.veil} className="h-1.5 w-full cursor-pointer accent-[rgb(var(--primary))]" />
            <p className="mt-1 text-xs text-muted">{t.veilHint}</p>
          </div>
          {/* the part of the picture that stays in view on wide and narrow screens */}
          {url && <PictureMover lang={lang} image={url} video={bg.kind === "video"} value={bg.pos} onChange={(pos) => set({ pos })} fill ratio="16 / 9" radius="10px" />}
        </div>
      )}
      {problem && <p className="text-xs text-rose-600">{problem}</p>}
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 4v16" /></svg>
        <span><b className="font-semibold text-fg">{dc[lang].form.sizeLabel}:</b> {t.spec}</span>
      </p>
    </div>
  );
}

/** The page background: «لون خلفية الصفحة» or «إرفاق خلفية». Going back to the color keeps the attached file, so choosing it again brings it back. */
function PageBgChoice({ lang, draft, update, color }: { lang: Lang; draft: Draft; update: Update; color: React.ReactNode }) {
  const w = popT[lang];
  const bg = draft.config.pageBackground;
  const [mode, setMode] = useState<"color" | "file">(bg.kind === "none" ? "color" : "file");
  const pick = (m: "color" | "file") => {
    setMode(m);
    const kind = m === "color" ? "none" : bg.media ? (/\.(mp4|webm)$/i.test(bg.name) ? "video" : "image") : "none";
    if (kind !== bg.kind) update((d) => ({ ...d, config: { ...d.config, pageBackground: { ...d.config.pageBackground, kind } } }));
  };
  return (
    <div className="space-y-3">
      <Seg value={mode} onChange={pick} options={[{ key: "color", label: w.bgColorOpt }, { key: "file", label: w.bgFileOpt }]} />
      {mode === "color" ? color : <PageBackground lang={lang} draft={draft} update={update} />}
    </div>
  );
}

export function OptionsPanel({ lang, draft, update, attn }: { lang: Lang; draft: Draft; update: Update; attn?: string | null }) {
  const t = dc[lang].options;
  const th = draft.config.theme;
  const lx = dc[lang].luxe;
  const set = (patch: Partial<StorefrontConfig["theme"]>) => update((d) => ({ ...d, config: { ...d.config, theme: { ...d.config.theme, ...patch } } }));
  return (
    <div className="divide-y divide-fg/10 px-4 [&>*]:py-5">
      <h2 className="font-bold text-black dark:text-white">{t.title}</h2>
      {/* The page background: a color, or a picture / GIF / video he attaches (the color still shows through its veil) */}
      <div data-attn="background" className={attn === "background" ? "attention" : ""}>
      <Part lang={lang} force={attn === "background"} label={popT[lang].pageBgTitle}>
        <PageBgChoice lang={lang} draft={draft} update={update} color={<ColorPicker value={th.background} onChange={(background) => set({ background })} label={t.background} bad={dc[lang].identity.hexBad} list={["#ffffff", "#f4f1ea", "#ead7b8", "#b9e3d4", "#b6d3f4", "#f6bfca", "#d3d6dc"]} />} />
      </Part>
      </div>
      <div data-attn="text" className={attn === "text" ? "attention" : ""}>
      <Part lang={lang} force={attn === "text"} label={t.text}>
        <ColorPicker value={th.text} onChange={(text) => set({ text })} label={t.text} bad={dc[lang].identity.hexBad} list={["#12262b", "#1f2937", "#111111", "#2b2118", "#1b2a41", "#3b1f2b"]} />
      </Part>
      </div>
      <Part lang={lang} label={t.titles}>
        <ColorPicker value={th.titleColor || th.text} onChange={(titleColor) => set({ titleColor })} label={t.titles} bad={dc[lang].identity.hexBad} list={["#004956", "#348d9c", "#1f7a4d", "#2f6fde", "#d9534f", "#e08a1e", "#7a3ea1", "#161616"]} />
        {th.titleColor && (
          <button type="button" onClick={() => set({ titleColor: "" })} className="mt-3 text-sm font-semibold text-primary hover:underline">
            {t.sameAsText}
          </button>
        )}
      </Part>
      <Part lang={lang} label={t.font}>
        <div className="grid grid-cols-2 gap-2">
          {(["readex", "plex", "baloo", "elegant", "cairo", "tajawal", "messiri", "almarai", "kufi"] as const).map((k) => (
            <button key={k} type="button" onClick={() => set({ font: k })} aria-pressed={(th.font ?? "readex") === k} className={`rounded-xl border px-3 py-3 text-start transition ${(th.font ?? "readex") === k ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
              <span className="block text-base font-bold leading-snug" style={{ fontFamily: fontFamily[k] || undefined }}>{t.fontSample}</span>
              <span className="mt-1 block text-[11px] font-semibold text-muted">{t.fonts[k]}</span>
            </button>
          ))}
        </div>
      </Part>
      <Part lang={lang} label={lx.headingFont}>
        <div className="grid grid-cols-2 gap-2">
          {(["", "readex", "plex", "baloo", "elegant", "cairo", "tajawal", "messiri", "almarai", "kufi"] as const).map((k) => {
            const on = (th.headingFont ?? "") === k;
            return (
              <button key={k || "same"} type="button" onClick={() => set({ headingFont: k })} aria-pressed={on} className={`rounded-xl border px-3 py-3 text-start transition ${on ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
                {k ? (
                  <>
                    <span className="block text-base font-bold leading-snug" style={{ fontFamily: fontFamily[k as ThemeFont] }}>{t.fontSample}</span>
                    <span className="mt-1 block text-[11px] font-semibold text-muted">{t.fonts[k as ThemeFont]}</span>
                  </>
                ) : (
                  <span className="block text-sm font-semibold">{lx.sameAsFont}</span>
                )}
              </button>
            );
          })}
        </div>
      </Part>
      {/* the ornament titles came with a theme that was removed: offered only to a design that already uses them */}
      <Part lang={lang} label={lx.titleStyle}>
        <Seg lang={lang} value={th.titleStyle ?? "bold"} onChange={(titleStyle) => set({ titleStyle })} cols={2} options={[{ key: "bold", label: lx.titleBold }, { key: "light", label: lx.titleLight }, { key: "pop", label: popT[lang].titlePop, theme: "lamma" }, ...(th.titleStyle === "ornament" ? [{ key: "ornament" as const, label: popT[lang].titleOrnament }] : [])]} />
      </Part>
      {/* the ornament look always centers its titles */}
      {th.titleStyle !== "ornament" && (
        <Part lang={lang} label={lx.titleAlign}>
          <Seg value={th.titleAlign ?? "start"} onChange={(titleAlign) => set({ titleAlign })} options={[{ key: "start", label: lx.alignStart }, { key: "center", label: lx.alignCenter }]} />
        </Part>
      )}
      <Toggle on={!!th.hairlines} onChange={(hairlines) => set({ hairlines })} label={popT[lang].hairlines} />
      <Part lang={lang} label={lx.sectionTitleSize}>
        <Stepper lang={lang} label={lx.textSize} value={th.sectionTitleSize ?? (th.titleStyle === "light" ? 34 : th.titleStyle === "pop" || th.titleStyle === "ornament" ? 44 : 24)} auto={th.sectionTitleSize === undefined} min={14} max={80} onChange={(sectionTitleSize) => set({ sectionTitleSize })} onReset={() => set({ sectionTitleSize: undefined })} />
      </Part>
      <Part lang={lang} label={lx.spacing}>
        <Seg value={th.spacing ?? "normal"} onChange={(spacing) => set({ spacing })} options={[{ key: "normal", label: lx.spaceNormal }, { key: "airy", label: lx.spaceAiry }]} />
      </Part>
      <div data-section="cards">
        <p className="mb-2 text-sm font-semibold">{t.cards}</p>
        {(["showName", "showCategory", "showPrice", "showOldPrice", "showBadge", "showStock", "showAdd"] as const).map((k) => (
          <Toggle key={k} on={draft.config.cards[k]} onChange={(v) => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, [k]: v } } }))} label={t[k]} />
        ))}
        <Toggle on={draft.config.cards.showNotes} onChange={(v) => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, showNotes: v } } }))} label={lx.showNotes} />
      </div>
      <Part lang={lang} label={lx.cardInfo}>
        <Seg value={draft.config.cards.info ?? "stack"} onChange={(info) => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, info } } }))} cols={3} options={[{ key: "stack", label: lx.infoStack }, { key: "row", label: lx.infoRow }, { key: "center", label: popT[lang].infoCenter }]} />
      </Part>
      {(draft.config.cards.showAdd ?? true) && <Part lang={lang} label={popT[lang].cardAdd}>
        <Seg value={draft.config.cards.add ?? "wide"} onChange={(add) => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, add } } }))} options={[{ key: "wide", label: popT[lang].addWide }, { key: "plus", label: popT[lang].addPlus }]} />
      </Part>}
      <Part lang={lang} label={popT[lang].saleColor} hint={popT[lang].saleColorHint}>
        <ColorPicker value={th.saleColor || (th.primary || draft.identity.color)} onChange={(saleColor) => set({ saleColor })} label={popT[lang].saleColor} bad={dc[lang].identity.hexBad} list={["#d9534f", "#e11d48", "#c0392b", "#e08a1e", "#161616", "#004956"]} />
        {th.saleColor && (
          <button type="button" onClick={() => set({ saleColor: "" })} className="mt-3 text-sm font-semibold text-primary hover:underline">
            {popT[lang].saleColorAuto}
          </button>
        )}
      </Part>
      <ColorChip lang={lang} label={popT[lang].priceColor} value={draft.config.cards.priceColor || undefined} onChange={(priceColor) => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, priceColor } } }))} onReset={() => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, priceColor: "" } } }))} />
      {(draft.config.cards.showAdd ?? true) && draft.config.cards.add === "plus" && <ColorChip lang={lang} label={popT[lang].addColor} value={draft.config.cards.addColor} auto="#b9f3d0" onChange={(addColor) => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, addColor } } }))} onReset={() => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, addColor: undefined } } }))} />}
      <Part lang={lang} label={t.cardImage}>
        <div className="grid grid-cols-3 gap-2">
          {(["portrait", "square", "wide"] as const).map((r) => (
            <button key={r} type="button" onClick={() => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, image: r } } }))} aria-pressed={draft.config.cards.image === r} className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold transition ${draft.config.cards.image === r ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
              <span className="border-2 border-current" style={{ width: r === "wide" ? 40 : r === "square" ? 30 : 26, height: r === "wide" ? 30 : r === "square" ? 30 : 34, borderRadius: 6 }} />
              {t.imageKinds[r]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">{lx.cropNote}</p>
      </Part>
      <Part lang={lang} label={t.cardStyle}>
        <div className="grid grid-cols-2 gap-2">
          {(["shadow", "outline", "flat", "pop"] as const).map((r) => (
            <button key={r} type="button" onClick={() => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, style: r } } }))} aria-pressed={draft.config.cards.style === r} className={`rounded-xl border px-3 py-3 text-xs font-semibold transition ${draft.config.cards.style === r ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
              {r === "pop" ? popT[lang].stylePop : t.styleKinds[r]}
            </button>
          ))}
        </div>
      </Part>
      <Part lang={lang} label={cartT[lang].title} hint={cartT[lang].hint}>
        <div className="grid grid-cols-2 gap-2">
          {cartStyles.map((r) => (
            <button key={r} type="button" onClick={() => update((d) => ({ ...d, config: { ...d.config, cart: { style: r } } }))} aria-pressed={(draft.config.cart?.style ?? "drawer") === r} className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-start text-xs font-semibold transition ${(draft.config.cart?.style ?? "drawer") === r ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
              {cartT[lang].kinds[r][0]}
              <span className="text-[11px] font-normal text-muted">{cartT[lang].kinds[r][1]}</span>
            </button>
          ))}
        </div>
      </Part>
      <Part lang={lang} label={productPageT[lang].title} hint={productPageT[lang].hint}>
        <div className="grid grid-cols-2 gap-2">
          {productPageStyles.map((r) => (
            <button key={r} type="button" onClick={() => update((d) => ({ ...d, config: { ...d.config, productPage: { style: r } } }))} aria-pressed={(draft.config.productPage?.style ?? "classic") === r} className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-start text-xs font-semibold transition ${(draft.config.productPage?.style ?? "classic") === r ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
              {productPageT[lang].kinds[r][0]}
              <span className="text-[11px] font-normal text-muted">{productPageT[lang].kinds[r][1]}</span>
            </button>
          ))}
        </div>
      </Part>
      <Part lang={lang} label={popT[lang].pricesTitle}>
        <Seg value={th.prices ?? "auto"} cols={1} onChange={(prices) => set({ prices })} options={[{ key: "auto", label: popT[lang].pricesAuto }, { key: "ar", label: popT[lang].pricesAr }, { key: "en", label: popT[lang].pricesEn }]} />
      </Part>
      <Part lang={lang} label={t.corners}>
        <div className="grid grid-cols-3 gap-2">
          {(["none", "md", "xl"] as const).map((r) => (
            <button key={r} type="button" onClick={() => set({ radius: r })} aria-pressed={th.radius === r} className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold transition ${th.radius === r ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
              <span className="h-8 w-12 border-2 border-current" style={{ borderRadius: r === "none" ? 0 : r === "md" ? 8 : 16 }} />
              {t.corner[r]}
            </button>
          ))}
        </div>
      </Part>
      <div className="space-y-3">
        <p className="text-sm font-semibold">{lx.texture}</p>
        <Part lang={lang} label={lx.patternTitle}>
          <div className="grid grid-cols-3 gap-2">
            {(["none", "stars", "dots", "lines", "diamonds", "waves"] as PatternKey[]).map((k) => {
              const on = draft.config.texture.pattern === k;
              const name = { none: lx.patNone, stars: lx.patStars, dots: lx.patDots, lines: lx.patLines, diamonds: lx.patDiamonds, waves: lx.patWaves }[k];
              return (
                <button key={k} type="button" onClick={() => update((d) => ({ ...d, config: { ...d.config, texture: { ...d.config.texture, pattern: k } } }))} aria-pressed={on} className={`rounded-xl border p-2 text-center transition ${on ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
                  <span aria-hidden className="relative mb-1.5 block h-10 overflow-hidden rounded-lg bg-card ring-1 ring-fg/10">
                    {k !== "none" && <span className="absolute inset-0 opacity-70" style={{ background: "rgb(var(--fg))", WebkitMaskImage: `url("${patterns[k].url}")`, maskImage: `url("${patterns[k].url}")`, WebkitMaskSize: `${patterns[k].w}px ${patterns[k].h}px`, maskSize: `${patterns[k].w}px ${patterns[k].h}px` }} />}
                  </span>
                  <span className="text-xs font-semibold">{name}</span>
                </button>
              );
            })}
          </div>
        </Part>
        {draft.config.texture.pattern !== "none" && (() => {
          const tx = draft.config.texture;
          const setTx = (patch: Partial<typeof tx>) => update((d) => ({ ...d, config: { ...d.config, texture: { ...d.config.texture, ...patch } } }));
          return (
            <>
              <Part lang={lang} label={popT[lang].patArea}>
                <Seg value={tx.area ?? "below"} cols={3} onChange={(area) => setTx({ area })} options={[{ key: "all", label: popT[lang].patAll }, { key: "below", label: popT[lang].patBelow }, { key: "top", label: popT[lang].patTop }]} />
              </Part>
              <Part lang={lang} label={popT[lang].patStrength}>
                <Seg value={tx.strength ?? "light"} cols={3} onChange={(strength) => setTx({ strength })} options={[{ key: "light", label: popT[lang].patLight }, { key: "medium", label: popT[lang].patMedium }, { key: "strong", label: popT[lang].patStrong }]} />
              </Part>
              <Toggle on={tx.fade ?? true} onChange={(fade) => setTx({ fade })} label={popT[lang].patFade} />
            </>
          );
        })()}
      </div>
    </div>
  );
}

export function TextsPanel({ lang, draft, update }: { lang: Lang; draft: Draft; update: Update }) {
  const t = dc[lang].texts;
  const tx = draft.config.texts;
  const set = (k: keyof StorefrontConfig["texts"], v: string) => update((d) => ({ ...d, config: { ...d.config, texts: { ...d.config.texts, [k]: { ...d.config.texts[k], [lang]: v } } } }));
  return (
    <div className="space-y-5 p-4">
      <div>
        <h2 className="font-bold text-black dark:text-white">{t.title}</h2>
        <p className="mt-1 text-xs text-muted">{t.hint}</p>
      </div>
      {(["search", "viewAll", "allFilter", "noProducts"] as const).map((k) => (
        <Part lang={lang} key={k} label={t[k]}>
          <input value={tx[k][lang]} onChange={(e) => set(k, e.target.value)} maxLength={60} className={`${input} h-11`} />
        </Part>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Picking a sample icon or uploading a picture                       */
/* ------------------------------------------------------------------ */

const tile = "grid h-11 w-11 place-items-center rounded-xl border transition";

const upIcon = <svg {...icon} className="h-5 w-5"><path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M12 15V4M8 8l4-4 4 4" /></svg>;

/**
 * "Upload your own picture". It is a big, clearly labelled box (also a drop target), so nobody misses it.
 * With a picture already chosen it shows that picture with Change and Remove.
 */
function UploadBox({ lang, current, onImage, onRemove, size = 256, spec, words, shapes = ["square"] }: { lang: Lang; current?: string; onImage: (url: string) => void; onRemove?: () => void; size?: number; spec: string; words: string[]; /* the crop frames offered after a picture is chosen */ shapes?: CropShape[] }) {
  const t = dc[lang].form;
  const [problem, setProblem] = useState<UploadProblem | null>(null);
  const [over, setOver] = useState(false);
  /* the chosen picture, waiting to be cropped */
  const [pending, setPending] = useState("");

  const take = async (f: File | undefined) => {
    if (!f) return;
    /* kept bigger than the result, so cropping closer stays sharp */
    const picked = await pickPicture(f, imageRules.logo, Math.max(1024, size), "image/png");
    setProblem("problem" in picked ? picked.problem : null);
    if ("url" in picked) setPending(picked.url);
  };

  if (pending) return <ImageCropper lang={lang} src={pending} shapes={shapes} out={size} onCancel={() => setPending("")} onDone={(url) => { setPending(""); onImage(url); }} />;

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]); }}
        className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition focus-within:ring-2 focus-within:ring-primary/40 ${over ? "border-primary bg-primary/15" : "border-primary/50 bg-primary/5 hover:bg-primary/10"}`}
      >
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" aria-label={words[0]} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void take(f); }} />
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain p-1 ring-1 ring-black/10" />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm">{upIcon}</span>
        )}
        <span className="min-w-0">
          <span className="block text-sm font-bold text-primary">{current ? words[1] : words[0]}</span>
          <span className="block text-xs text-muted">{t.uploadHint}</span>
        </span>
      </label>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 4v16" /></svg>
        <span><b className="font-semibold text-fg">{t.sizeLabel}:</b> {spec}</span>
      </p>
      {current && (
        <button type="button" onClick={() => setPending(current)} className="me-4 mt-2 text-xs font-semibold text-primary hover:underline">
          {lang === "ar" ? "قصّ الصورة" : "Crop the picture"}
        </button>
      )}
      {current && onRemove && (
        <button type="button" onClick={onRemove} className="mt-2 text-xs font-semibold text-rose-600 hover:underline">
          {t.removeImage}
        </button>
      )}
      {problem && <p role="alert" className="mt-2 text-xs text-rose-600">{problem === "type" ? t.uploadBad : uploadProblemText[problem][lang]}</p>}
    </div>
  );
}

/** Icons for the perks: sample icons with their names, or his own picture. */
function IconChoice({ lang, value, image, onPick, onImage }: { lang: Lang; value: PerkIcon | "image"; image?: string; onPick: (i: PerkIcon) => void; onImage: (url: string) => void }) {
  const t = dc[lang].form;
  const list: PerkIcon[] = ["truck", "shield", "returns", "gift", "clock", "chat"];
  return (
    <div className="min-w-0 flex-1 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {list.map((k) => {
          const on = value === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onPick(k)}
              aria-pressed={on}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[11px] font-semibold transition ${on ? "border-primary bg-primary text-white shadow-sm" : "border-fg/15 text-fg hover:border-primary/60 hover:bg-primary/5"}`}
            >
              {storeIcons[k]}
              {t.icons[k]}
            </button>
          );
        })}
      </div>
      <UploadBox lang={lang} current={value === "image" ? image : undefined} onImage={onImage} size={256} spec={t.sizes.perk} words={t.ups.icon} />
    </div>
  );
}

/** The store logo: the logo from setup, the first letter, sample marks, or his own picture. */
function LogoChoice({ lang, draft, update }: { lang: Lang; draft: Draft; update: Update }) {
  const t = dc[lang];
  const logo = draft.config.identity.logo;
  const set = (patch: Partial<typeof logo>) => update((d) => ({ ...d, config: { ...d.config, identity: { ...d.config.identity, logo: { ...d.config.identity.logo, ...patch } } } }));
  /* no name yet: the same word the store shows in its place */
  const name = draft.identity.name.trim() || (lang === "ar" ? "متجرك" : "Your store");
  const setupLogo = loadSetup()?.logo ?? "";
  const pick = (on: boolean) => `${tile} ${on ? "border-primary bg-primary/10 ring-2 ring-primary/40" : "border-fg/15 hover:bg-soft"}`;
  return (
    <div className="space-y-3" style={{ ["--sf-primary" as string]: HEXISH.test(draft.identity.color) ? draft.identity.color : "#004956", ["--sf-on" as string]: "#fff" }}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => set({ kind: "auto" })} aria-pressed={logo.kind === "auto"} title={t.identity.logoAuto} aria-label={t.identity.logoAuto} className={pick(logo.kind === "auto")}>
          <LogoMark logo={resolveLogo({ ...logo, kind: "auto" }, setupLogo)} name={name} className="h-8 w-8 rounded-lg text-sm" />
        </button>
        <button type="button" onClick={() => set({ kind: "letter" })} aria-pressed={logo.kind === "letter"} title={t.identity.logoLetter} aria-label={t.identity.logoLetter} className={pick(logo.kind === "letter")}>
          <LogoMark logo={{ ...logo, kind: "letter" }} name={name} className="h-8 w-8 rounded-lg text-sm" />
        </button>
        {markKeys.map((k: MarkKey) => (
          <button key={k} type="button" onClick={() => set({ kind: "sample", sample: k })} aria-pressed={logo.kind === "sample" && logo.sample === k} aria-label={popT[lang].sampleMarks[k]} title={popT[lang].sampleMarks[k]} className={pick(logo.kind === "sample" && logo.sample === k)}>
            <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "var(--sf-primary)", color: "#fff" }}>
              <svg {...icon} className="h-4 w-4">{sampleMarks[k]}</svg>
            </span>
          </button>
        ))}
      </div>
      <UploadBox lang={lang} current={logo.kind === "image" ? logo.image : undefined} onImage={(image) => set({ kind: "image", image })} onRemove={() => set({ kind: "auto", image: "" })} size={512} shapes={["square", "wide", "original"]} spec={t.form.sizes.logo} words={t.form.ups.logo} />
    </div>
  );
}

const HEXISH = /^#[0-9a-f]{6}$/i;

/** The tab icon: upload a picture and see how the browser tab will look. */
function FaviconChoice({ lang, draft, update }: { lang: Lang; draft: Draft; update: Update }) {
  const t = dc[lang];
  const icon = draft.config.identity.favicon;
  const set = (favicon: string) => update((d) => ({ ...d, config: { ...d.config, identity: { ...d.config.identity, favicon } } }));
  return (
    <div className="space-y-3">
      <UploadBox lang={lang} current={icon || undefined} onImage={set} onRemove={() => set("")} size={64} spec={t.form.sizes.favicon} words={t.form.ups.favicon} />
      <div>
        <p className="mb-1.5 text-xs text-muted">{t.identity.tabPreview}</p>
        <div className="flex w-56 items-center gap-2 rounded-t-xl bg-soft px-3 py-2 text-xs">
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} alt="" className="h-4 w-4 shrink-0 object-contain" />
          ) : (
            <span className="h-4 w-4 shrink-0 rounded-sm bg-fg/20" />
          )}
          <span className="truncate font-medium">{draft.identity.name || "…"}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero banner backgrounds: add, order, and set how they change       */
/* ------------------------------------------------------------------ */

type HeroSettings = Extract<SectionConfig, { type: "hero" }>["settings"];

/** Which products stand on the cards beside the cover's text (up to 3, in his order) */
function HeroCards({ lang, ids, onChange }: { lang: Lang; ids: number[]; onChange: (ids: number[]) => void }) {
  const w = popT[lang];
  const [products, setProducts] = useState<{ id: number; name: string; category: string }[]>([]);
  useEffect(() => setProducts(readProducts()), []);
  const on = ids.filter((id) => products.some((p) => p.id === id));
  const toggle = (id: number) => onChange(on.includes(id) ? on.filter((x) => x !== id) : on.length >= 3 ? on : [...on, id]);
  return (
    <Part lang={lang} label={w.cardsPick} hint={w.cardsHint}>
      {products.length === 0 ? (
        <div className="rounded-xl bg-soft px-4 py-4 text-sm text-muted">
          <p>{dc[lang].form.collectionNone}</p>
          <a href="/products" target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-primary hover:underline">{dc[lang].form.addProducts}</a>
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs font-semibold text-primary">{on.length} / 3 {w.cardsPicked}</p>
          <ul className="max-h-64 divide-y divide-fg/10 overflow-y-auto rounded-xl border border-fg/10">
            {products.map((p) => {
              const order = on.indexOf(p.id);
              const full = order < 0 && on.length >= 3;
              return (
                <li key={p.id}>
                  <label className={`flex items-center gap-3 px-3 py-2.5 text-sm transition ${full ? "cursor-not-allowed opacity-45" : "cursor-pointer hover:bg-fg/[0.04]"}`}>
                    <input type="checkbox" checked={order >= 0} disabled={full} onChange={() => toggle(p.id)} className="peer sr-only" />
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-fg/25 bg-card text-xs font-bold text-transparent transition peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">{order >= 0 ? order + 1 : ""}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p.name}</span>
                      {p.category && <span className="block truncate text-xs text-muted">{p.category}</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Part>
  );
}

function HeroBackgrounds({ lang, settings, onChange }: { lang: Lang; settings: HeroSettings; onChange: (s: HeroSettings) => void }) {
  const t = dc[lang].form;
  const list: HeroBg[] = settings.backgrounds?.length ? settings.backgrounds : [{ kind: "color", color: "", image: "" }];
  const [bad, setBad] = useState(false);
  const set = (backgrounds: HeroBg[]) => onChange({ ...settings, backgrounds });
  const edit = (i: number, patch: Partial<HeroBg>) => set(list.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const n = [...list];
    [n[i], n[j]] = [n[j], n[i]];
    set(n);
  };
  const photos = list.filter((b) => b.kind === "image").length;

  const pickPhoto = async (file: File | undefined, apply: (url: string) => void) => {
    if (!file) return;
    const url = await readPhoto(file);
    setBad(!url);
    if (url) apply(url);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">{t.backgroundsHint}</p>

      <ol className="space-y-3">
        {list.map((b, i) => (
          <li key={i} className="space-y-3 rounded-xl border border-fg/10 p-3">
            <div className="flex items-center gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-soft text-xs font-bold">{i + 1}</span>
              <span
                className="h-10 w-16 shrink-0 rounded-lg ring-1 ring-black/10"
                style={{ background: b.kind === "image" && b.image ? `center / cover url(${b.image})` : b.color || `linear-gradient(120deg, ${draftColor}, color-mix(in srgb, ${draftColor} 62%, #6fe3cf))` }}
              />
              <span className="flex-1 truncate text-sm font-semibold">{b.kind === "image" ? t.bgPicture : b.color ? t.bgColor : t.bgStoreColor}</span>
              <button type="button" className={roundBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={dc[lang].actions.up} title={dc[lang].actions.up}>{ic.up}</button>
              <button type="button" className={roundBtn} disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={dc[lang].actions.down} title={dc[lang].actions.down}>{ic.down}</button>
              <button type="button" className={`${roundBtn} hover:!text-rose-600`} disabled={list.length === 1} onClick={() => set(list.filter((_, j) => j !== i))} aria-label={t.removeBg} title={t.removeBg}>{ic.trash}</button>
            </div>

            {b.kind === "color" ? (
              <>
                <FillPicker lang={lang} value={b.color} fallback={draftColor} onChange={(color) => edit(i, { color })} label={t.bgColor} list={bgSwatches} />
                {b.color && (
                  <button type="button" onClick={() => edit(i, { color: "" })} className="text-sm font-semibold text-primary hover:underline">
                    {t.useStoreColor}
                  </button>
                )}
              </>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/5 focus-within:ring-2 focus-within:ring-primary/40">
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pickPhoto(f, (image) => edit(i, { image, pos: undefined })); }} />
                {ic.plus}
                {t.ups.cover[0]}
                <span className="text-xs font-normal text-muted">({t.sizes.banner.split(" (")[0]})</span>
              </label>
            )}
            {b.kind === "image" && b.image && <PictureMover lang={lang} image={b.image} value={b.pos} onChange={(pos) => edit(i, { pos })} fill ratio="16 / 7" radius="12px" />}
            {list.length > 1 && (
              <Part lang={lang} label={popT[lang].slideWords} hint={popT[lang].slideWordsHint}>
                <div className="space-y-2">
                  {(["title", "subtitle", "button"] as const).map((k) => (
                    <input key={k} value={b[k]?.[lang] ?? ""} onChange={(e) => edit(i, { [k]: { ...(b[k] ?? { en: "", ar: "" }), [lang]: e.target.value } })} placeholder={`${k === "title" ? popT[lang].slideTitle : k === "subtitle" ? popT[lang].slideText : popT[lang].slideButton}: ${settings[k][lang]}`} aria-label={k === "title" ? popT[lang].slideTitle : k === "subtitle" ? popT[lang].slideText : popT[lang].slideButton} maxLength={k === "subtitle" ? 140 : 60} className={`${input} h-10`} />
                  ))}
                  <Leads lang={lang} label={popT[lang].slideLeads} value={b.link ?? ""} onChange={(link) => edit(i, { link })} />
                </div>
              </Part>
            )}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        {list.length < 6 && (
          <button type="button" onClick={() => set([...list, { kind: "color", color: nextColor(list), image: "" }])} className="flex items-center gap-2 rounded-xl border border-dashed border-primary/60 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5">
            {ic.plus}
            {t.addColor}
          </button>
        )}
        {list.length < 6 && photos < 4 && (
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-primary/60 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5 focus-within:ring-2 focus-within:ring-primary/40">
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pickPhoto(f, (image) => set([...list, { kind: "image", color: "", image }])); }} />
            {ic.plus}
            {t.addPicture}
          </label>
        )}
      </div>
      {bad && <p className="text-xs text-rose-600">{dc[lang].form.photoBad}</p>}
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 4v16" /></svg>
        <span><b className="font-semibold text-fg">{t.sizeLabel}:</b> {t.sizes.banner}</span>
      </p>
      <p className="text-xs text-muted">{t.picturesNote}</p>

      {list.length > 1 && (
        <div className="space-y-3 rounded-xl bg-soft/70 p-3">
          <Toggle on={settings.autoplay ?? true} onChange={(autoplay) => onChange({ ...settings, autoplay })} label={t.autoplay} />
          {(settings.autoplay ?? true) && (
            <Field label={t.every}>
              <SecondsPicker value={settings.seconds || 5} onChange={(n) => onChange({ ...settings, seconds: n })} unit={t.seconds} />
            </Field>
          )}
        </div>
      )}
    </div>
  );
}

const draftColor = "#004956";
const bgSwatches = ["#004956", "#348d9c", "#1f7a4d", "#2f6fde", "#d9534f", "#e08a1e", "#7a3ea1", "#161616"];
/* a new color slide takes the first color of the list that no other slide has yet (an empty color is the store color) */
const nextColor = (list: HeroBg[]) => {
  const used = list.filter((b) => b.kind === "color").map((b) => (b.color || draftColor).toLowerCase());
  return bgSwatches.find((c) => !used.includes(c)) ?? bgSwatches[list.length % bgSwatches.length];
};

/* ------------------------------------------------------------------ */
/*  Pinned products: pick which products show, name it, set the count  */
/* ------------------------------------------------------------------ */

type CollectionEl = Extract<SectionConfig, { type: "collection" }>;

function CollectionForm({ lang, s, onChange, text }: { lang: Lang; s: CollectionEl; onChange: (s: SectionConfig) => void; text: (v: { en: string; ar: string }, set: (b: { en: string; ar: string }) => void, label: string, area?: boolean, field?: string) => React.ReactNode }) {
  const t = dc[lang].form;
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<{ id: number; name: string; category: string }[]>([]);
  useEffect(() => setProducts(readProducts()), []);
  const ids = s.settings.productIds ?? [];
  const set = (patch: Partial<CollectionEl["settings"]>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
  const toggle = (id: number) => set({ productIds: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] });
  const shown = products.filter((p) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()) || p.category.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      {text(s.settings.title, (title) => set({ title }), dc[lang].form.title, false, "title")}
      <Part lang={lang} label={popT[lang].viewAllLeads}>
        <LinkPicker lang={lang} value={s.settings.link ?? ""} onChange={(link) => set({ link })} label={popT[lang].viewAllLeads} />
      </Part>
      <Toggle on={!!s.settings.background} onChange={(on) => set(on ? { background: "#f2eee6", color: "#0f2a22" } : { background: "", color: "" })} label={popT[lang].bandOn} />
      {!!s.settings.background && (
        <div className="space-y-2">
          <FillPicker lang={lang} label={popT[lang].bandBg} value={s.settings.background ?? ""} fallback="#f2eee6" onChange={(background) => set({ background })} />
          <ColorChip lang={lang} label={popT[lang].bandText} value={s.settings.color || undefined} onChange={(color) => set({ color })} />
        </div>
      )}
      <Part lang={lang} label={t.collectionLimit}>
        <div className="flex gap-2">
          {[2, 3, 4, 6, 8, 12].map((n) => (
            <button key={n} type="button" onClick={() => set({ count: n })} aria-pressed={s.settings.count === n} className={`h-10 flex-1 rounded-xl border text-sm font-semibold transition ${s.settings.count === n ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
              {n}
            </button>
          ))}
        </div>
      </Part>
      <Part lang={lang} label={t.columns}>
        <div className="flex gap-2">
          {([2, 3, 4] as const).map((n) => (
            <button key={n} type="button" onClick={() => set({ columns: n })} aria-pressed={s.settings.columns === n} className={`h-10 flex-1 rounded-xl border text-sm font-semibold transition ${s.settings.columns === n ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
              {n}
            </button>
          ))}
        </div>
      </Part>

      <div>
        <p className="text-sm font-bold text-black dark:text-white">{t.collection}</p>
        <p className="mt-0.5 text-xs text-muted">{t.collectionHint}</p>
        {products.length === 0 ? (
          <div className="mt-3 rounded-xl bg-soft px-4 py-4 text-sm text-muted">
            <p>{t.collectionNone}</p>
            <a href="/products" target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-primary hover:underline">{t.addProducts}</a>
          </div>
        ) : (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.collectionSearch} aria-label={t.collectionSearch} className={`${input} mt-3 h-10`} />
            <p className="mt-2 text-xs font-semibold text-primary">
              {ids.filter((id) => products.some((p) => p.id === id)).length} {t.collectionPicked}
            </p>
            <ul className="mt-2 max-h-64 divide-y divide-fg/10 overflow-y-auto rounded-xl border border-fg/10">
              {shown.map((p) => {
                const order = ids.indexOf(p.id);
                return (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition hover:bg-fg/[0.04]">
                      <input type="checkbox" checked={order >= 0} onChange={() => toggle(p.id)} className="peer sr-only" />
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-fg/25 bg-card text-xs font-bold text-transparent transition peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
                        {order >= 0 ? order + 1 : ""}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{p.name}</span>
                        {p.category && <span className="block truncate text-xs text-muted">{p.category}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {ids.length === 0 && <p className="mt-2 text-xs text-muted">{t.collectionEmpty}</p>}
          </>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Header and footer: rows that open their own small forms            */
/* ------------------------------------------------------------------ */

type SubKey = "headerSettings" | "announcement" | "footerSettings";
/* The parts of the footer's screen */
type FootBlock = "layout" | "links" | "contact" | "social" | "licenses" | "look";
type SetCfg = (fn: (c: StorefrontConfig) => StorefrontConfig) => void;

/** A row that opens a form. The "‹" says it can be pressed. */
function RowLink({ icon: ico, label, onClick, badge }: { icon: React.ReactNode; label: string; onClick: () => void; badge?: boolean }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-start text-sm font-medium transition hover:bg-fg/[0.04]">
        <span className="text-muted">{ico}</span>
        <span className="flex-1">{label}</span>
        {badge && <span aria-hidden className="h-2 w-2 rounded-full bg-primary" />}
        <span className="text-muted rtl:rotate-180">
          <svg {...icon} className="h-4 w-4"><path d="m9 6 6 6-6 6" /></svg>
        </span>
      </button>
    </li>
  );
}

function SubShell({ lang, title, onBack, children }: { lang: Lang; title: string; onBack: () => void; children: React.ReactNode }) {
  const t = dc[lang];
  return (
    <div>
      <div className="flex items-center gap-3 border-b border-fg/10 px-4 py-3">
        <button type="button" onClick={onBack} aria-label={t.form.back} className={roundBtn}>{ic.back}</button>
        <div>
          <p className="text-xs text-muted">{t.sub.now}</p>
          <p className="text-sm font-bold text-black dark:text-white">{title}</p>
        </div>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </div>
  );
}

/** Clicking a product's picture in the preview opens this: choose the part of the picture that stays visible. */
export function ProductPicturePanel({ lang, name, image, value, onChange, onBack, blocked, onBlocked }: { lang: Lang; name: string; image: string; value: PicFocus; onChange: (f: PicFocus) => void; onBack: () => void; blocked: boolean; onBlocked: () => void }) {
  const t = dc[lang];
  return (
    <SubShell lang={lang} title={name} onBack={onBack}>
      <p className="text-xs leading-relaxed text-muted">{t.luxe.picNote}</p>
      <FocusPicker image={image} value={value} onChange={onChange} disabled={blocked} onBlocked={onBlocked} labels={{ tall: t.options.imageKinds.portrait, square: t.options.imageKinds.square, wide: t.options.imageKinds.wide, center: t.luxe.picCenter , zoom: lang === "ar" ? "تكبير (قصّ أقرب)" : "Zoom (crop closer)" }} />
    </SubShell>
  );
}

function HeaderSettingsForm({ lang, cfg, setCfg }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg }) {
  const storePages = useStorePages(lang);
  const t = dc[lang];
  /* the menu link whose trash was pressed: it asks before it goes */
  const [asking, setAsking] = useState<number | null>(null);
  const lx = t.luxe;
  const tog = (key: keyof StorefrontConfig["header"], label: string) => (
    <Toggle key={key} on={cfg.header[key]} onChange={(v) => setCfg((c) => ({ ...c, header: { ...c.header, [key]: v } }))} label={label} />
  );
  return (
    <>
      <div className="space-y-1">
        {tog("showMenu", t.header.showMenu)}
        {!cfg.header.showMenu && <Tip text={t.header.tipMenu} />}
        {tog("showSearch", t.header.showSearch)}
        {tog("showCart", t.header.showCart)}
        {!cfg.header.showCart && <Tip text={t.header.tipCart} />}
        {tog("sticky", t.header.sticky)}
        <Toggle on={cfg.identity.showLogo} onChange={(v) => setCfg((c) => ({ ...c, identity: { ...c.identity, showLogo: v } }))} label={t.header.showLogo} />
      </div>
      {cfg.header.showMenu && <DrawerItemsForm lang={lang} cfg={cfg} setCfg={setCfg} />}
      <Part lang={lang} label={t.header.align}>
        <div className="flex gap-2">
          {(["start", "center"] as const).map((a) => (
            <button key={a} type="button" onClick={() => setCfg((c) => ({ ...c, identity: { ...c.identity, align: a } }))} aria-pressed={cfg.identity.align === a} className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${cfg.identity.align === a ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
              {t.header[a]}
            </button>
          ))}
        </div>
      </Part>
      <Part lang={lang} label={lx.navStyle}>
        <Seg value={cfg.nav.style} onChange={(style) => setCfg((c) => ({ ...c, nav: { ...c.nav, style } }))} cols={3} options={[{ key: "button", label: lx.navButton }, { key: "links", label: lx.navLinks }, { key: "pill", label: popT[lang].navPill }]} />
      </Part>
      {cfg.nav.style === "links" && cfg.identity.align === "center" && (
        <Part lang={lang} label={popT[lang].navPlace}>
          <Seg value={cfg.nav.place ?? "below"} onChange={(place) => setCfg((c) => ({ ...c, nav: { ...c.nav, place } }))} options={[{ key: "below", label: popT[lang].navBelow }, { key: "start", label: popT[lang].navStart }]} />
        </Part>
      )}
      {cfg.nav.style === "links" && (
        <Part lang={lang} label={popT[lang].cartLook}>
          <Seg value={cfg.nav.cartLook ?? "icon"} onChange={(cartLook) => setCfg((c) => ({ ...c, nav: { ...c.nav, cartLook } }))} options={[{ key: "icon", label: popT[lang].cartIcon }, { key: "text", label: popT[lang].cartText }]} />
        </Part>
      )}
      <Part lang={lang} label={popT[lang].nameFont}>
        <div className="grid grid-cols-2 gap-2">
          {(["", "messiri", "elegant", "ruqaa", "lemonada", "amiri", "baloo", "almarai", "kufi"] as HeroFont[]).map((k) => {
            const on = (cfg.identity.nameFont ?? "") === k;
            const name = k === "" ? popT[lang].nameFontSame : k === "ruqaa" ? lx.fontRuqaa : k === "lemonada" ? lx.fontLemonada : k === "amiri" ? lx.fontAmiri : t.options.fonts[k];
            return (
              <button key={k || "same"} type="button" onClick={() => setCfg((c) => ({ ...c, identity: { ...c.identity, nameFont: k || undefined } }))} aria-pressed={on} className={`rounded-xl border px-3 py-2.5 text-start transition ${on ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
                <span className="block text-base font-bold leading-snug [overflow-wrap:anywhere]" style={{ fontFamily: heroTitleFamily(k) }}>{t.options.fontSample}</span>
                <span className="mt-1 block text-[11px] font-semibold text-muted">{name}</span>
              </button>
            );
          })}
        </div>
      </Part>
      <ColorChip lang={lang} label={popT[lang].nameColor} value={cfg.identity.nameColor} onChange={(nameColor) => setCfg((c) => ({ ...c, identity: { ...c.identity, nameColor } }))} />
      <Part lang={lang} label={popT[lang].tagline}>
        <input value={cfg.identity.tagline?.[lang] ?? ""} onChange={(e) => setCfg((c) => ({ ...c, identity: { ...c.identity, tagline: { ...(c.identity.tagline ?? { en: "", ar: "" }), [lang]: e.target.value } } }))} maxLength={40} className={`${input} h-11`} />
      </Part>
      {cfg.nav.style === "pill" && (
        <div className="space-y-3">
          <ColorChip lang={lang} label={popT[lang].navActive} value={cfg.nav.activeColor} onChange={(activeColor) => setCfg((c) => ({ ...c, nav: { ...c.nav, activeColor } }))} onReset={() => setCfg((c) => ({ ...c, nav: { ...c.nav, activeColor: undefined } }))} />
          <ColorChip lang={lang} label={popT[lang].navCart} value={cfg.nav.cartColor} onChange={(cartColor) => setCfg((c) => ({ ...c, nav: { ...c.nav, cartColor } }))} onReset={() => setCfg((c) => ({ ...c, nav: { ...c.nav, cartColor: undefined } }))} />
        </div>
      )}
      {cfg.nav.style !== "button" && (
        <div className="space-y-2">
          <p className="text-xs text-muted">{lx.navHint}</p>
          {cfg.nav.links.map((l, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-fg/10 p-2.5">
              <div className="flex items-center gap-2">
                <input value={l[lang] ?? ""} onChange={(e) => setCfg((c) => ({ ...c, nav: { ...c.nav, links: c.nav.links.map((x, j) => (j === i ? { ...x, [lang]: e.target.value } : x)) } }))} placeholder={lx.navLink} aria-label={lx.navLink} maxLength={20} className={`${input} h-10 flex-1`} />
                <button type="button" className={`${roundBtnSm} hover:!text-rose-600`} onClick={() => setAsking(i)} aria-label={lx.navRemove} title={lx.navRemove}>{ic.trash}</button>
              </div>
              {asking === i && <LinkAsk lang={lang} onYes={() => { setCfg((c) => ({ ...c, nav: { ...c.nav, links: c.nav.links.filter((_, j) => j !== i) } })); setAsking(null); }} onNo={() => setAsking(null)} />}
              <Part lang={lang} label={lx.navTarget}>
                <LinkPicker lang={lang} value={l.to ?? ""} onChange={(to) => setCfg((c) => ({ ...c, nav: { ...c.nav, links: c.nav.links.map((x, j) => (j === i ? { ...x, to: to || undefined } : x)) } }))} label={lx.navTarget} />
              </Part>
              {/* a link can stand out in a color of its own, like a red "Sale" */}
              <ColorChip lang={lang} label={popT[lang].linkColor} value={l.color} auto={cfg.theme.text} onChange={(color) => setCfg((c) => ({ ...c, nav: { ...c.nav, links: c.nav.links.map((x, j) => (j === i ? { ...x, color } : x)) } }))} onReset={() => setCfg((c) => ({ ...c, nav: { ...c.nav, links: c.nav.links.map((x, j) => (j === i ? { ...x, color: undefined } : x)) } }))} />
            </div>
          ))}
          {cfg.nav.links.length < 8 && (
            <button type="button" onClick={() => setCfg((c) => ({ ...c, nav: { ...c.nav, links: [...c.nav.links, { en: "", ar: "" }] } }))} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 text-sm font-bold text-primary transition hover:bg-primary/10">
              {ic.plus}
              {lx.navAdd}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function AnnouncementForm({ lang, cfg, setCfg }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg }) {
  const t = dc[lang].sub.announcement;
  const a = cfg.announcement;
  const set = (patch: Partial<StorefrontConfig["announcement"]>) => setCfg((c) => ({ ...c, announcement: { ...c.announcement, ...patch } }));
  const edit = (i: number, patch: Partial<StorefrontConfig["announcement"]["messages"][number]>) => set({ messages: a.messages.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const last = a.messages[a.messages.length - 1];
  const seg = (on: boolean) => `h-10 flex-1 rounded-lg text-sm font-semibold transition ${on ? "bg-ink text-onink" : "text-muted hover:bg-fg/5"}`;
  return (
    <>
      <Toggle on={a.show} onChange={(show) => set({ show })} label={t.show} />
      {a.show && (
      <>

      <Part lang={lang} label={t.motion}>
        <div className="flex gap-1 rounded-xl border border-fg/15 bg-card p-1">
          <button type="button" aria-pressed={a.motion === "fade"} onClick={() => set({ motion: "fade" })} className={seg(a.motion === "fade")}>{t.fade}</button>
          <button type="button" aria-pressed={a.motion === "ticker"} onClick={() => set({ motion: "ticker" })} className={seg(a.motion === "ticker")}>{t.ticker}</button>
        </div>
        <p className="mt-1.5 text-xs text-muted">{a.motion === "ticker" ? t.tickerHint : t.fadeHint}</p>
      </Part>

      {a.motion === "fade" && a.messages.length > 1 && (
        <Part lang={lang} label={t.every}>
          <SecondsPicker value={a.seconds} onChange={(seconds) => set({ seconds })} unit={t.sec} presets={[3, 4, 6, 8]} />
        </Part>
      )}

      <ol className="space-y-4">
        {a.messages.map((m, i) => (
          <li key={i} className="space-y-3 rounded-2xl border border-fg/10 bg-fg/[0.02] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-black dark:text-white">{t.message} {i + 1}</p>
              {a.messages.length > 1 && (
                <button type="button" onClick={() => set({ messages: a.messages.filter((_, j) => j !== i) })} aria-label={t.remove} title={t.remove} className={`${roundBtnSm} hover:!text-rose-600`}>{ic.trash}</button>
              )}
            </div>
            <input value={m.text[lang]} onChange={(e) => edit(i, { text: { ...m.text, [lang]: e.target.value } })} aria-label={t.text} placeholder={t.text} maxLength={90} className={`${input} h-11`} />
            <LinkPicker lang={lang} value={m.link} onChange={(link) => edit(i, { link })} label={t.link} />
            <div>
              <p className="mb-2 text-xs font-semibold text-fg/80">{a.motion === "ticker" && i > 0 ? t.colorFirst : t.color}</p>
              <FillPicker lang={lang} value={m.color} fallback="#004956" onChange={(color) => edit(i, { color })} label={t.color} />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-fg/80">{t.textColor}</p>
                {m.textColor && <button type="button" onClick={() => edit(i, { textColor: "" })} className="text-xs font-semibold text-primary hover:underline">{t.auto}</button>}
              </div>
              <ColorPicker value={m.textColor || onColor(m.color)} onChange={(textColor) => edit(i, { textColor })} label={t.textColor} bad={dc[lang].identity.hexBad} list={["#ffffff", "#12262b", "#ffd166", "#96edd9", "#ffb4b4"]} />
            </div>
          </li>
        ))}
      </ol>

      {a.messages.length < 5 && (
        <button
          type="button"
          onClick={() => set({ messages: [...a.messages, { text: { en: "", ar: "" }, link: "", color: last.color, textColor: last.textColor }] })}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 text-sm font-bold text-primary transition hover:bg-primary/10"
        >
          {ic.plus}
          {t.add}
        </button>
      )}
      </>
      )}
    </>
  );
}

/* The footer's columns are drawn only when their own switch (columns[].visible) is on and, for the links, contact and social ones,
   the footer's older switch too. Every switch here shows that real state, and turning one on turns both on. */
type FooterCfg = StorefrontConfig["footer"];
type Tabs = NonNullable<FooterCfg["tabs"]>;
const colFlag = { pages: "showLinks", contact: "showContact", social: "showSocial" } as const;
const hasFlag = (k: FooterColumn["kind"]): k is keyof typeof colFlag => k in colFlag;
function colOn(f: FooterCfg, col: FooterColumn) {
  if (col.visible === false) return false;
  return hasFlag(col.kind) ? f[colFlag[col.kind]] : true;
}
function colTurn(f: FooterCfg, id: string, v: boolean): FooterCfg {
  const columns = footerColumns(f).map((x) => (x.id === id ? { ...x, visible: v } : x));
  const kind = columns.find((x) => x.id === id)?.kind;
  return kind && hasFlag(kind) ? { ...f, columns, [colFlag[kind]]: v } : { ...f, columns };
}
const colOf = (f: FooterCfg, kind: FooterColumn["kind"]) => footerColumns(f).find((x) => x.kind === kind) as FooterColumn;
const hasLicense = (f: FooterCfg) => !!(f.certificate.number.trim() || f.certificate.logo || (f.certificate.kind === "other" && f.certificate.label.trim()));
const reorder = <T,>(list: T[], from: number, to: number) => {
  if (from === to || to < 0 || to >= list.length) return list;
  const n = [...list];
  const [x] = n.splice(from, 1);
  n.splice(to, 0, x);
  return n;
};
/* The built-in columns keep their title in the footer's own words (empty: the store's usual word) */
const wordKey = { pages: "pages", contact: "contact", social: "follow", licenses: "licenses" } as const;
type WordKind = keyof typeof wordKey;
const isWord = (k: FooterColumn["kind"]): k is WordKind => k in wordKey;
/** The name a column has in the store, as the storefront picks it: this language, then the other one, then the usual word ("" for an untitled column of his own) */
function colName(f: FooterCfg, col: FooterColumn, lang: Lang) {
  const other = lang === "ar" ? "en" : "ar";
  if (col.kind === "custom") return col.title?.[lang]?.trim() || col.title?.[other]?.trim() || "";
  if (isWord(col.kind)) {
    const k = wordKey[col.kind];
    return f.labels?.[k]?.[lang]?.trim() || f.labels?.[k]?.[other]?.trim() || storeCopy[lang][k];
  }
  return popT[lang].cAbout;
}
const hexOr = (v: string, d: string) => {
  const c = fillColors(v)[0] ?? "";
  return /^#[0-9a-f]{6}$/i.test(c) ? c : d;
};
/* gentle checks: they never stop him typing, only say what looks wrong */
const okSocial = (v: string) => !v.trim() || /^@[\w.]{1,40}$/.test(v.trim()) || (!/\s/.test(v.trim()) && v.includes("."));
export const okEmail = (v: string) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export const okPhone = (v: string) => !v.trim() || /^\+?\d{7,15}$/.test(v.replace(/\s/g, ""));
const Bad = ({ show, text }: { show: boolean; text: string }) => (show ? <p role="alert" className="mt-1.5 text-xs text-rose-600">{text}</p> : null);

/** The title of a built-in column, at the top of the form that edits what it shows */
function ColTitle({ lang, cfg, setCfg, kind }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg; kind: WordKind }) {
  const pp = popT[lang];
  const key = wordKey[kind];
  const other = lang === "ar" ? "en" : "ar";
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-fg/80">{pp.colTitle}</p>
      <input
        data-field={`title-${kind}`}
        value={cfg.footer.labels?.[key]?.[lang] ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          setCfg((c) => ({ ...c, footer: { ...c.footer, labels: { pages: noText, contact: noText, follow: noText, licenses: noText, ...(c.footer.labels ?? {}), [key]: { ...(c.footer.labels?.[key] ?? noText), [lang]: v } } } }));
        }}
        placeholder={cfg.footer.labels?.[key]?.[other]?.trim() || storeCopy[lang][key]}
        aria-label={pp.colTitle}
        maxLength={30}
        className={`${input} h-11`}
      />
      <p className="mt-1.5 text-xs text-muted">{pp.wordsHint}</p>
    </div>
  );
}

/** The switch of one built-in column, at the top of the form that edits what it shows */
function ColSwitch({ lang, cfg, setCfg, kind, label }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg; kind: FooterColumn["kind"]; label: string }) {
  void lang;
  const col = colOf(cfg.footer, kind);
  return <Toggle on={colOn(cfg.footer, col)} onChange={(v) => setCfg((c) => ({ ...c, footer: colTurn(c.footer, colOf(c.footer, kind).id, v) }))} label={label} />;
}

/** One part of a long screen (the footer's): its icon and name, a short look at what is in it while closed, and a ▾.
    Several can be open at once. It slides open like a Part, and while closed nothing inside can be reached with the keyboard. */
function Block({ id, title, icon: ico, preview, open, onToggle, children }: { id: string; title: string; icon: React.ReactNode; preview?: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  /* what is inside is made the first time it opens, and then stays so it can slide closed again */
  const [made, setMade] = useState(open);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) setMade(true);
    box.current?.toggleAttribute("inert", !open);
  }, [open]);
  return (
    <section data-block={id} className={`scroll-mt-3 rounded-xl border transition ${open ? "border-fg/15 bg-card" : "border-fg/10"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-2.5 text-start">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-soft text-primary">{ico}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-black dark:text-white">{title}</span>
          {preview && !open && <span dir="auto" className="block truncate text-xs text-muted">{preview}</span>}
        </span>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition duration-300 ${open ? "rotate-180 text-primary" : "text-muted"}`}>{ic.chevron}</span>
      </button>
      <div ref={box} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">{made && <div className="space-y-4 border-t border-fg/10 px-3 pb-4 pt-3">{children}</div>}</div>
      </div>
    </section>
  );
}

/** The whole footer on one screen, in parts: its columns and style, its links, the contact details, the social media accounts,
    the licenses, and its colors and text sizes. The columns part is open at first (it is the map of the footer: each column's
    pencil opens the part that fills it). `ask` opens a part from outside (a text clicked in the preview). */
function FooterForm({ lang, draft, update, ask }: { lang: Lang; draft: Draft; update: Update; ask: { block: FootBlock; n: number } | null }) {
  const t = dc[lang];
  const fb = t.footBlocks;
  const cfg = draft.config;
  const f = cfg.footer;
  const setCfg: SetCfg = (fn) => update((d) => ({ ...d, config: fn(d.config) }));
  const [opened, setOpened] = useState<FootBlock[]>(() => [ask?.block ?? "layout"]);
  /* opens a part (the others stay as they are) and brings it into view */
  const go = (b: FootBlock) => {
    setOpened((o) => (o.includes(b) ? o : [...o, b]));
    setTimeout(() => document.querySelector(`[data-block="foot-${b}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" }), 60);
  };
  useEffect(() => {
    if (ask) go(ask.block);
  }, [ask?.block, ask?.n]);
  const toggle = (b: FootBlock) => setOpened((o) => (o.includes(b) ? o.filter((x) => x !== b) : [...o, b]));
  const block = (b: FootBlock, title: string, ico: React.ReactNode, preview: string | undefined, body: React.ReactNode) => (
    <Block id={`foot-${b}`} title={title} icon={ico} preview={preview} open={opened.includes(b)} onToggle={() => toggle(b)}>{body}</Block>
  );
  const other = lang === "ar" ? "en" : "ar";
  const off = (kind: FooterColumn["kind"]) => !colOn(f, colOf(f, kind));
  const ownLinks = (f.tabs ?? []).filter((x) => x.visible && (x.label[lang]?.trim() || x.label[other]?.trim())).length;
  const socials = Object.values(f.social).filter((v) => v?.trim()).length;
  const contact = [draft.identity.phone && `+962 ${draft.identity.phone}`, f.whatsapp, f.email].find((v) => v?.trim()) || undefined;
  return (
    <>
      <p className="text-xs leading-relaxed text-muted">{fb.hint}</p>
      <div className="space-y-2.5">
        {block("layout", fb.layout, ic.columns, (f.style ?? "full") === "simple" ? popT[lang].footerSimple : popT[lang].footerFull, <FooterLayoutForm lang={lang} cfg={cfg} setCfg={setCfg} go={go} />)}
        {block("links", fb.links, ic.link, off("pages") ? fb.off : fb.count.replace("{n}", String(ownLinks)), <FooterLinksForm lang={lang} cfg={cfg} setCfg={setCfg} />)}
        {block("contact", t.rows.service, ic.headset, off("contact") ? fb.off : contact, <ServiceForm lang={lang} draft={draft} update={update} />)}
        {block("social", t.rows.social, ic.share, off("social") ? fb.off : fb.accounts.replace("{n}", String(socials)), <SocialForm lang={lang} cfg={cfg} setCfg={setCfg} />)}
        {block("licenses", t.rows.certificate, ic.badge, off("licenses") ? fb.off : f.certificate.number.trim() || undefined, <CertificateForm lang={lang} cfg={cfg} setCfg={setCfg} />)}
        {block("look", fb.look, ic.palette, undefined, <FooterLookForm lang={lang} cfg={cfg} setCfg={setCfg} storeColor={draft.identity.color} />)}
      </div>
    </>
  );
}

/** The footer's style and its columns (which ones, in which order) */
function FooterLayoutForm({ lang, cfg, setCfg, go }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg; /* opens another part of the footer's screen */ go: (b: FootBlock) => void }) {
  const pp = popT[lang];
  const style = cfg.footer.style ?? "full";
  return (
    <>
      <Part lang={lang} label={pp.footerStyle} preview={style === "simple" ? pp.footerSimple : pp.footerFull}>
        <Seg value={style} onChange={(st) => setCfg((c) => ({ ...c, footer: { ...c.footer, style: st } }))} options={[{ key: "full", label: pp.footerFull }, { key: "simple", label: pp.footerSimple }]} />
      </Part>
      <FooterColumnsForm lang={lang} cfg={cfg} setCfg={setCfg} go={go} />
    </>
  );
}

/** The links column: its switch, its title, where its links come from, and his own links */
function FooterLinksForm({ lang, cfg, setCfg }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg }) {
  const pp = popT[lang];
  return (
    <>
      <ColSwitch lang={lang} cfg={cfg} setCfg={setCfg} kind="pages" label={dc[lang].footBlocks.showLinks} />
      <ColTitle lang={lang} cfg={cfg} setCfg={setCfg} kind="pages" />
      <p className="text-xs leading-relaxed text-muted">{pp.pagesHint}</p>
      <OwnLinksForm lang={lang} tabs={cfg.footer.tabs ?? []} update={(fn) => setCfg((c) => ({ ...c, footer: { ...c.footer, tabs: fn(c.footer.tabs ?? []) } }))} title={pp.tabsTitle} hint={pp.tabsHint} add={pp.tabAdd} others={otherLinks(cfg, lang, "footer")} />
    </>
  );
}

/** The footer's colors and the size of its texts */
function FooterLookForm({ lang, cfg, setCfg, storeColor }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg; storeColor?: string }) {
  const t = dc[lang];
  const pp = popT[lang];
  const f = cfg.footer;
  const set = (patch: Partial<StorefrontConfig["footer"]>) => setCfg((c) => ({ ...c, footer: { ...c.footer, ...patch } }));
  /* the colors the footer really draws now, and the ones it draws with nothing chosen */
  const drawn = footerColors(cfg, storeColor);
  const auto = footerColors({ ...cfg, footer: { ...f, background: "", text: "" } }, storeColor);
  const autoText = footerColors({ ...cfg, footer: { ...f, text: "" } }, storeColor).text;
  const bgHex = hexOr(drawn.bg, "#f4f1ea");
  const style = f.style ?? "full";
  const colorPreview = (v: string) => (!v ? pp.autoColor : isGradient(v) ? pp.fillGradient : v);
  const autoRow = (color: string) => (
    <span className="flex items-center gap-2 rounded-lg border border-fg/15 px-2.5 py-2 text-xs text-muted">
      <span aria-hidden className="h-6 w-6 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: color }} />
      {pp.autoColorNow}
    </span>
  );
  return (
    <>
      <div className="space-y-3">
        <p className="text-sm font-semibold">{t.luxe.footerColors}</p>
        <Part lang={lang} label={t.luxe.footerBg} preview={colorPreview(f.background)} icon={<span aria-hidden className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/15" style={{ background: drawn.bg }} />}>
          <div className="space-y-3">
            <Seg value={f.background ? "own" : "auto"} onChange={(k) => set({ background: k === "auto" ? "" : bgHex })} options={[{ key: "auto", label: pp.autoColor }, { key: "own", label: pp.pickColor }]} />
            {f.background ? <FillPicker lang={lang} value={f.background} fallback={bgHex} onChange={(v) => set({ background: v })} label={t.luxe.footerBg} list={["#16120f", "#1c1a17", "#2b2118", "#004956", "#f4f1ea", "#ffffff"]} /> : autoRow(auto.bg)}
          </div>
        </Part>
        <Part lang={lang} label={t.luxe.footerText} preview={colorPreview(f.text)} icon={<span aria-hidden className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/15" style={{ background: drawn.text }} />}>
          <div className="space-y-3">
            <Seg value={f.text ? "own" : "auto"} onChange={(k) => set({ text: k === "auto" ? "" : hexOr(drawn.text, autoText) })} options={[{ key: "auto", label: pp.autoColor }, { key: "own", label: pp.pickColor }]} />
            {f.text ? <ColorPicker value={f.text} onChange={(v) => set({ text: v })} label={t.luxe.footerText} bad={t.identity.hexBad} list={["#e9e1d3", "#ffffff", "#c9a46a", "#1c1a17", "#12262b"]} /> : autoRow(autoText)}
          </div>
          <Bad show={!!f.text && drawn.autoText} text={pp.lowContrast} />
        </Part>
      </div>
      <div className="space-y-3">
        <p className="text-sm font-semibold">{pp.sizesTitle}</p>
        {([["title", pp.szTitles, 14, 10, 40], ["text", pp.szText, 14, 10, 32], ["name", pp.szName, footerNameSize({ ...cfg, footer: { ...f, sizes: { ...(f.sizes ?? {}), name: undefined } } }, style), 12, 48]] as const).map(([k, label, def, min, max]) => (
          <Stepper key={k} lang={lang} label={label} value={f.sizes?.[k] ?? def} auto={f.sizes?.[k] === undefined} min={min} max={max} onChange={(v) => setCfg((c) => ({ ...c, footer: { ...c.footer, sizes: { ...(c.footer.sizes ?? {}), [k]: v } } }))} onReset={() => setCfg((c) => ({ ...c, footer: { ...c.footer, sizes: { ...(c.footer.sizes ?? {}), [k]: undefined } } }))} />
        ))}
      </div>
    </>
  );
}

function ServiceForm({ lang, draft, update }: { lang: Lang; draft: Draft; update: Update }) {
  const t = dc[lang];
  const pp = popT[lang];
  const f = draft.config.footer;
  const setCfg: SetCfg = (fn) => update((d) => ({ ...d, config: fn(d.config) }));
  const set = (patch: Partial<StorefrontConfig["footer"]>) => setCfg((c) => ({ ...c, footer: { ...c.footer, ...patch } }));
  return (
    <>
      <ColSwitch lang={lang} cfg={draft.config} setCfg={setCfg} kind="contact" label={pp.showContactHere} />
      <ColTitle lang={lang} cfg={draft.config} setCfg={setCfg} kind="contact" />
      <p className="text-xs text-muted">{t.sub.service.hint}</p>
      {!hasStoreContact(draft.identity.phone, f.whatsapp) && <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400">{pp.contactNeeded}</p>}
      <Part lang={lang} label={t.footerFields.servicePhone} hint={t.footerFields.servicePhoneHint} field="phone" preview={draft.identity.phone ? `+962 ${draft.identity.phone}` : ""}>
        <span dir="ltr" className="flex h-11 items-center overflow-hidden rounded-xl border border-fg/15 bg-card text-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
          <span className="flex h-full items-center border-e border-fg/15 bg-soft/60 px-3 font-semibold">+962</span>
          <input
            data-field="phone"
            value={draft.identity.phone}
            onChange={(e) => update((d) => ({ ...d, identity: { ...d.identity, phone: latin(e.target.value).replace(/[^\d\s]/g, "").replace(/^[\s0]+/, "") } }))}
            inputMode="tel"
            aria-label={t.footerFields.servicePhone}
            className="h-full flex-1 bg-transparent px-3 outline-none"
          />
        </span>
      </Part>
      <Part lang={lang} label={t.sub.service.whatsapp} field="whatsapp" preview={f.whatsapp}>
        <span className="relative block">
          <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[#1fa855]">{storeIcons.whatsapp}</span>
          {/* digits only, with a + at the start if he likes */}
          <input data-field="whatsapp" dir="ltr" value={f.whatsapp} onChange={(e) => set({ whatsapp: latin(e.target.value).replace(/[^\d+\s]/g, "").replace(/(?!^)\+/g, "") })} inputMode="tel" maxLength={20} placeholder="+962 7X XXX XXXX" aria-label={t.sub.service.whatsapp} aria-invalid={!okPhone(f.whatsapp)} className={`${input} h-11 text-start ps-10`} />
        </span>
        <Bad show={!okPhone(f.whatsapp)} text={pp.phoneBad} />
      </Part>
      <Part lang={lang} label={t.sub.service.telegram} field="telegram" preview={f.telegram}>
        <span className="relative block">
          <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[#229ed9]">{storeIcons.telegram}</span>
          <input data-field="telegram" dir="ltr" value={f.telegram} onChange={(e) => set({ telegram: e.target.value })} maxLength={40} placeholder="@name" aria-label={t.sub.service.telegram} className={`${input} h-11 text-start ps-10`} />
        </span>
      </Part>
      <Part lang={lang} label={t.footerFields.email} field="email" preview={f.email}>
        <input data-field="email" dir="ltr" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} maxLength={80} aria-label={t.footerFields.email} aria-invalid={!okEmail(f.email)} className={`${input} h-11 text-start`} />
        <Bad show={!okEmail(f.email)} text={pp.emailBad} />
      </Part>
      <Part lang={lang} label={t.footerFields.address} field="address" preview={f.address[lang]}>
        <input data-field="address" value={f.address[lang]} onChange={(e) => { const v = e.target.value; setCfg((c) => ({ ...c, footer: { ...c.footer, address: { ...c.footer.address, [lang]: v } } })); }} maxLength={100} aria-label={t.footerFields.address} className={`${input} h-11`} />
      </Part>
    </>
  );
}

function CertificateForm({ lang, cfg, setCfg }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg }) {
  const t = dc[lang].sub.certificate;
  const c = cfg.footer.certificate;
  const set = (patch: Partial<typeof c>) => setCfg((x) => ({ ...x, footer: { ...x.footer, certificate: { ...x.footer.certificate, ...patch } } }));
  return (
    <>
      <ColSwitch lang={lang} cfg={cfg} setCfg={setCfg} kind="licenses" label={popT[lang].showLicensesHere} />
      <ColTitle lang={lang} cfg={cfg} setCfg={setCfg} kind="licenses" />
      <p className="rounded-xl bg-soft px-4 py-3 text-xs leading-relaxed text-muted">{t.hint}</p>
      <Part lang={lang} label={t.kind} preview={c.kind === "other" ? c.label || t.other : t[c.kind]}>
        <div className="grid grid-cols-3 gap-2">
          {(["commercial", "license", "other"] as const).map((k) => (
            <button key={k} type="button" onClick={() => set({ kind: k })} aria-pressed={c.kind === k} className={`rounded-xl border px-2 py-2.5 text-xs font-semibold transition ${c.kind === k ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
              {t[k]}
            </button>
          ))}
        </div>
      </Part>
      {/* "Other" opens a field where he writes what it is */}
      {c.kind === "other" && (
        <Part lang={lang} label={t.otherName} preview={c.label}>
          <input autoFocus value={c.label ?? ""} onChange={(e) => set({ label: e.target.value })} placeholder={t.otherNamePh} maxLength={40} className={`${input} h-11`} />
        </Part>
      )}
      <Part lang={lang} label={t.number} field="licenseNumber" preview={c.number}>
        <input data-field="licenseNumber" dir="ltr" value={c.number} onChange={(e) => set({ number: latin(e.target.value).slice(0, 30) })} maxLength={30} className={`${input} h-11 text-start`} />
      </Part>
      <Part lang={lang} label={t.logo}>
        <UploadBox lang={lang} current={c.logo || undefined} onImage={(logo) => set({ logo })} onRemove={() => set({ logo: "" })} size={256} shapes={["original", "square", "wide"]} spec={t.logoSpec} words={dc[lang].form.ups.license} />
      </Part>
      <Part lang={lang} label={t.url} preview={c.url}>
        <input dir="ltr" value={c.url} onChange={(e) => set({ url: e.target.value })} maxLength={160} placeholder="https://" className={`${input} h-11 text-start`} />
      </Part>
    </>
  );
}

function SocialForm({ lang, cfg, setCfg }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg }) {
  const t = dc[lang];
  const pp = popT[lang];
  const f = cfg.footer;
  const names: { k: keyof StorefrontConfig["footer"]["social"]; label: string }[] = [
    { k: "instagram", label: t.footerFields.instagram },
    { k: "facebook", label: t.footerFields.facebook },
    { k: "x", label: t.footerFields.x },
    { k: "youtube", label: t.footerFields.youtube },
    { k: "snapchat", label: t.sub.social.snapchat },
    { k: "tiktok", label: t.sub.social.tiktok },
  ];
  return (
    <>
      <ColSwitch lang={lang} cfg={cfg} setCfg={setCfg} kind="social" label={pp.showSocialHere} />
      <ColTitle lang={lang} cfg={cfg} setCfg={setCfg} kind="social" />
      <p className="text-xs text-muted">{t.footerFields.socialHint}</p>
      <div className="space-y-3">
        {names.map((n) => (
          <label key={n.k} className="block">
            <span className="mb-1.5 block text-xs font-semibold text-fg/80">{n.label}</span>
            <input data-field={`social-${n.k}`} dir="ltr" value={f.social[n.k]} onChange={(e) => { const v = e.target.value; setCfg((c) => ({ ...c, footer: { ...c.footer, social: { ...c.footer.social, [n.k]: v } } })); }} placeholder={pp.socialPh} aria-invalid={!okSocial(f.social[n.k])} maxLength={120} className={`${input} h-11 text-start`} />
            <Bad show={!okSocial(f.social[n.k])} text={pp.socialBad} />
          </label>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated pictures: his pictures and GIFs                           */
/* ------------------------------------------------------------------ */

type SlidesEl = Extract<SectionConfig, { type: "slides" }>;

function SlidesForm({ lang, s, onChange }: { lang: Lang; s: SlidesEl; onChange: (s: SectionConfig) => void }) {
  const t = dc[lang].form;
  const slides = s.settings.slides ?? [];
  const [bad, setBad] = useState(false);
  const set = (patch: Partial<SlidesEl["settings"]>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
  const edit = (i: number, patch: Partial<Slide>) => set({ slides: slides.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const n = [...slides];
    [n[i], n[j]] = [n[j], n[i]];
    set({ slides: n });
  };
  const add = async (file: File | undefined) => {
    if (!file) return;
    const url = await readPhoto(file);
    setBad(!url);
    if (url) set({ slides: [...slides, { image: url, link: "" }] });
  };

  return (
    <>
      <p className="text-xs leading-relaxed text-muted">{t.slidesHint}</p>

      {slides.length > 0 && (
        <ol className="space-y-3">
          {slides.map((x, i) => (
            <li key={i} className="space-y-2.5 rounded-xl border border-fg/10 p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-soft text-xs font-bold">{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.image} alt="" className="h-10 w-16 shrink-0 rounded-lg object-cover ring-1 ring-black/10" />
                <span className="flex-1" />
                <button type="button" className={roundBtnSm} disabled={i === 0} onClick={() => move(i, -1)} aria-label={dc[lang].actions.up} title={dc[lang].actions.up}>{ic.up}</button>
                <button type="button" className={roundBtnSm} disabled={i === slides.length - 1} onClick={() => move(i, 1)} aria-label={dc[lang].actions.down} title={dc[lang].actions.down}>{ic.down}</button>
                <button type="button" className={`${roundBtnSm} hover:!text-rose-600`} onClick={() => set({ slides: slides.filter((_, j) => j !== i) })} aria-label={t.removeSlide} title={t.removeSlide}>{ic.trash}</button>
              </div>
              <LinkPicker lang={lang} value={x.link} onChange={(link) => edit(i, { link })} label={t.slideLink} />
              <PictureMover lang={lang} image={x.image} value={x.pos} onChange={(pos) => edit(i, { pos })} fill ratio={s.settings.ratio === "standard" ? "2 / 1" : "3 / 1"} radius="10px" />
            </li>
          ))}
        </ol>
      )}

      {slides.length < 8 && (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-4 py-3 transition hover:bg-primary/10 focus-within:ring-2 focus-within:ring-primary/40">
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void add(f); }} />
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm">{upIcon}</span>
          <span className="text-sm font-bold text-primary">{t.addSlide}</span>
        </label>
      )}
      {bad && <p className="text-xs text-rose-600">{t.photoBad}</p>}
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 4v16" /></svg>
        <span><b className="font-semibold text-fg">{t.sizeLabel}:</b> {t.slidesSpec}</span>
      </p>

      <Part lang={lang} label={t.shapeLabel}>
        <div className="grid grid-cols-2 gap-2">
          {(["wide", "standard"] as const).map((r) => (
            <button key={r} type="button" onClick={() => set({ ratio: r })} aria-pressed={s.settings.ratio === r} className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${s.settings.ratio === r ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
              {r === "wide" ? t.shapeWide : t.shapeStandard}
            </button>
          ))}
        </div>
      </Part>

      {slides.length > 1 && (
        <div className="space-y-3 rounded-xl bg-soft/70 p-3">
          <Toggle on={s.settings.autoplay ?? true} onChange={(autoplay) => set({ autoplay })} label={t.autoplay} />
          {(s.settings.autoplay ?? true) && (
            <Part lang={lang} label={t.every}>
              <SecondsPicker value={s.settings.seconds || 5} onChange={(n) => set({ seconds: n })} unit={t.seconds} />
            </Part>
          )}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  One picture the merchant uploads (shrunk, kept with the store)     */
/* ------------------------------------------------------------------ */

function PhotoPicker({ lang, value, onChange, max = 1200 }: { lang: Lang; value: string; onChange: (v: string) => void; max?: number }) {
  const t = dc[lang].form;
  const [bad, setBad] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    const url = await readPhoto(file, max);
    setBad(!url);
    if (url) onChange(url);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-16 w-14 shrink-0 rounded-lg object-cover ring-1 ring-black/10" />
        )}
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-3 py-2.5 transition hover:bg-primary/10 focus-within:ring-2 focus-within:ring-primary/40">
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pick(f); }} />
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm">{upIcon}</span>
          <span className="truncate text-sm font-bold text-primary">{value ? t.picChange : t.pic}</span>
        </label>
        {value && (
          <button type="button" onClick={() => onChange("")} className={`${roundBtn} hover:!text-rose-600`} aria-label={t.picRemove} title={t.picRemove}>{ic.trash}</button>
        )}
      </div>
      {bad && <p className="text-xs text-rose-600">{t.picBad}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Picture tiles: a row of pictures with names and links              */
/* ------------------------------------------------------------------ */

type TilesEl = Extract<SectionConfig, { type: "tiles" }>;
type BannersEl = Extract<SectionConfig, { type: "banners" }>;

function TilesForm({ lang, s, onChange, text }: { lang: Lang; s: TilesEl; onChange: (s: SectionConfig) => void; text: (v: { en: string; ar: string }, set: (b: { en: string; ar: string }) => void, label: string, area?: boolean, field?: string) => React.ReactNode }) {
  const t = dc[lang].form;
  const lx = dc[lang].luxe;
  const items = s.settings.items ?? [];
  const [bad, setBad] = useState(false);
  const set = (patch: Partial<TilesEl["settings"]>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
  const edit = (i: number, patch: Partial<Tile>) => set({ items: items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    set({ items: n });
  };
  const add = async (files: FileList | null) => {
    if (!files) return;
    const made = await Promise.all(Array.from(files).map((f) => readPhoto(f, 900)));
    const ok = made.filter((u): u is string => !!u);
    setBad(ok.length < files.length);
    set({ items: [...items, ...ok.map((image) => ({ image, label: { en: "", ar: "" }, link: "" }))].slice(0, 10) });
  };

  return (
    <>
      {text(s.settings.title, (title) => set({ title }), t.title, false, "title")}
      <p className="text-xs leading-relaxed text-muted">{t.tilesHint}</p>

      {items.length > 0 && (
        <ol className="space-y-3">
          {items.map((x, i) => (
            <li key={i} className="space-y-2.5 rounded-xl border border-fg/10 p-3">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-soft text-xs font-bold">{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.image} alt="" className="h-12 w-10 shrink-0 rounded-lg object-cover ring-1 ring-black/10" />
                <span className="flex-1" />
                <button type="button" className={roundBtnSm} disabled={i === 0} onClick={() => move(i, -1)} aria-label={dc[lang].actions.up} title={dc[lang].actions.up}>{ic.up}</button>
                <button type="button" className={roundBtnSm} disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={dc[lang].actions.down} title={dc[lang].actions.down}>{ic.down}</button>
                <button type="button" className={`${roundBtnSm} hover:!text-rose-600`} onClick={() => set({ items: items.filter((_, j) => j !== i) })} aria-label={t.removeTile} title={t.removeTile}>{ic.trash}</button>
              </div>
              <input value={x.label?.[lang] ?? ""} onChange={(e) => edit(i, { label: { ...(x.label ?? { en: "", ar: "" }), [lang]: e.target.value } })} placeholder={t.tileLabel} aria-label={t.tileLabel} maxLength={40} className={`${input} h-10`} />
              <LinkPicker lang={lang} value={x.link} onChange={(link) => edit(i, { link })} label={t.tileLink} />
              {/* drag the picture to choose which part shows in its frame (the circle, or the tall card) */}
              <PictureMover lang={lang} image={x.image} value={x.pos} onChange={(pos) => edit(i, { pos })} fill ratio={s.settings.style === "circles" ? "1 / 1" : s.settings.style === "editorial" ? "4 / 3" : "4 / 5"} radius={s.settings.style === "circles" ? "999px" : "12px"} />
              {s.settings.style === "editorial" && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-fg/80">{lx.tileChip}</p>
                  <Seg value={x.chip ?? "light"} onChange={(chip) => edit(i, { chip })} options={[{ key: "light", label: lx.chipLight }, { key: "dark", label: lx.chipDark }]} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {items.length < 10 && (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-4 py-3 transition hover:bg-primary/10 focus-within:ring-2 focus-within:ring-primary/40">
          <input type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const el = e.currentTarget; void add(el.files).then(() => { el.value = ""; }); }} />
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm">{upIcon}</span>
          <span className="text-sm font-bold text-primary">{t.addTile}</span>
        </label>
      )}
      {bad && <p className="text-xs text-rose-600">{t.picBad}</p>}
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 4v16" /></svg>
        <span><b className="font-semibold text-fg">{t.sizeLabel}:</b> {t.tilesSpec}</span>
      </p>

      <Part lang={lang} label={lx.tilesStyle}>
        <Seg lang={lang} value={s.settings.style ?? "classic"} onChange={(style) => set({ style })} options={[{ key: "classic", label: lx.tilesClassic }, { key: "editorial", label: lx.tilesEditorial }, { key: "circles", label: popT[lang].tilesCircles }]} cols={3} />
      </Part>

      <Part lang={lang} label={t.tilesPerRow}>
        <div className="flex gap-2">
          {/* 6 and 8 suit small circles; on a phone the row keeps 2 to 4 */}
          {([3, 4, 5, 6, 8] as const).map((n) => (
            <button key={n} type="button" onClick={() => set({ columns: n })} aria-pressed={s.settings.columns === n} className={`h-10 flex-1 rounded-xl border text-sm font-semibold transition ${s.settings.columns === n ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
              {n}
            </button>
          ))}
        </div>
      </Part>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Promo banners: a picture with a title, text and button on top      */
/* ------------------------------------------------------------------ */

function BannersForm({ lang, s, onChange }: { lang: Lang; s: BannersEl; onChange: (s: SectionConfig) => void }) {
  const textNow = useContext(TextColorNow);
  const t = dc[lang].form;
  const lx = dc[lang].luxe;
  const items = s.settings.items ?? [];
  const set = (next: Banner[]) => onChange({ ...s, settings: { ...s.settings, items: next } });
  const fonts: { key: DisplayFont; label: string }[] = [{ key: "default", label: lx.fontDefault }, { key: "ruqaa", label: lx.fontRuqaa }, { key: "lemonada", label: lx.fontLemonada }, { key: "amiri", label: lx.fontAmiri }];
  const edit = (i: number, patch: Partial<Banner>) => set(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  /* The "color card" look has no frosted panel, outline button or fixed height: those fields belong to the photo look only */
  const anyPhoto = items.some((x) => x.variant !== "card");
  const bi = (i: number, k: "title" | "text" | "button" | "eyebrow", v: string) => edit(i, { [k]: { ...(items[i][k] ?? { en: "", ar: "" }), [lang]: v } } as Partial<Banner>);

  return (
    <>
      <p className="text-xs leading-relaxed text-muted">{t.bannersHint}</p>
{anyPhoto && (
      <Part lang={lang} label={lx.bannerHeight}>
        <Seg value={s.settings.height ?? "normal"} onChange={(height) => onChange({ ...s, settings: { ...s.settings, height } })} options={[{ key: "normal", label: lx.heightNormal }, { key: "tall", label: lx.heightTall }]} />
      </Part>
)}
      {items.map((x, i) => (
        <div key={i} className="rounded-xl border border-fg/10 p-3">
          <Part
            lang={lang}
            label={`${popT[lang].bannerNth} ${i + 1}${x.title?.[lang]?.trim() ? ` · ${x.title[lang].trim()}` : ""}`}
            icon={<span aria-hidden className="h-6 w-6 shrink-0 rounded-md ring-1 ring-black/10" style={{ background: x.variant === "card" ? x.bg || "#b9f3d0" : x.image ? `center / cover url(${x.image})` : "linear-gradient(135deg, #7a3ea1, #2f6fde)" }} />}
          >
          <div className="space-y-3">
          <Part lang={lang} label={popT[lang].bannerVariant}>
            <Seg lang={lang} value={x.variant ?? "photo"} onChange={(variant) => edit(i, { variant })} options={[{ key: "photo", label: popT[lang].variantPhoto }, { key: "card", label: popT[lang].variantCard, theme: "lamma" }]} />
          </Part>
          {x.variant === "card" && (
            <>
              <Part lang={lang} label={popT[lang].cardColor}>
                <FillPicker lang={lang} value={x.bg ?? ""} fallback="#b9f3d0" onChange={(bg) => edit(i, { bg })} label={popT[lang].cardColor} list={popPastels} />
              </Part>
              <div className="space-y-3">
                <p className="text-sm font-semibold">{popT[lang].morePics}</p>
                <p className="text-xs leading-relaxed text-muted">{popT[lang].morePicsHint}</p>
                {(x.images ?? []).map((img, k) => (
                  <div key={k} className="space-y-2 rounded-xl border border-fg/10 p-2.5">
                    <PhotoPicker lang={lang} value={img} onChange={(v) => edit(i, { images: (x.images ?? []).map((y, j) => (j === k ? v : y)), imagesPos: (x.imagesPos ?? []).map((y, j) => (j === k ? undefined : y)) })} max={1200} />
                    <PictureMover lang={lang} image={img} value={x.imagesPos?.[k]} onChange={(pos) => edit(i, { imagesPos: Array.from({ length: Math.max(k + 1, (x.imagesPos ?? []).length) }, (_, j) => (j === k ? pos : x.imagesPos?.[j])) })} fill ratio="3 / 4" radius="14px" />
                    <button type="button" onClick={() => edit(i, { images: (x.images ?? []).filter((_, j) => j !== k), imagesPos: (x.imagesPos ?? []).filter((_, j) => j !== k) })} className="text-xs font-semibold text-rose-600 hover:underline">{popT[lang].removePic}</button>
                  </div>
                ))}
                {(x.images ?? []).length < 3 && (
                  <button type="button" onClick={() => edit(i, { images: [...(x.images ?? []), ""] })} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/60 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5">
                    {ic.plus}
                    {popT[lang].addPic}
                  </button>
                )}
              </div>
                      <Part lang={lang} label={popT[lang].shape}>
                <Seg value={x.shape ?? "arch"} onChange={(shape) => edit(i, { shape })} options={[{ key: "arch", label: popT[lang].shapeArch }, { key: "tilt", label: popT[lang].shapeTilt }]} />
              </Part>
            </>
          )}
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-soft text-xs font-bold">{i + 1}</span>
            <span className="flex-1" />
            <button type="button" className={`${roundBtnSm} hover:!text-rose-600`} onClick={() => set(items.filter((_, j) => j !== i))} aria-label={t.removeBanner} title={t.removeBanner}>{ic.trash}</button>
          </div>
          <PhotoPicker lang={lang} value={x.image} onChange={(image) => edit(i, { image, pos: undefined })} max={1600} />
          <PictureMover lang={lang} image={x.image} value={x.pos} onChange={(pos) => edit(i, { pos })} ratio={x.variant === "card" ? "3 / 4" : "16 / 9"} radius={x.variant === "card" ? (x.shape === "tilt" ? "20px" : "999px 999px 20px 20px") : "12px"} />
          {/* every part of the banner on its own: its box, and its own options behind the ▾ */}
          <div className="divide-y divide-fg/10 [&>*]:py-4">
            <Part lang={lang} label={t.bannerTitle} more={
              <>
                <StyleBar lang={lang} value={x.styles?.title} onChange={(v) => edit(i, { styles: { ...(x.styles ?? {}), title: v } })} boldNow />
                <Field label={lx.bannerFont}>
                  <Seg value={x.font ?? "default"} onChange={(font) => edit(i, { font })} options={fonts} />
                </Field>
                <Stepper lang={lang} label={lx.titleSize} value={x.titleSize ?? (x.variant === "card" ? 64 : 84)} auto={x.titleSize === undefined} min={20} max={200} onChange={(titleSize) => edit(i, { titleSize })} onReset={() => edit(i, { titleSize: undefined })} />
                <ColorChip lang={lang} label={lx.bannerTitleColor} value={x.titleColor || (x.variant === "card" ? textNow : x.panel === "light" ? "#5a3a34" : x.panel === "dark" ? "#e9dfcf" : "#ffffff")} onChange={(titleColor) => edit(i, { titleColor })} onReset={() => edit(i, { titleColor: undefined })} />
              </>
            }>
              <input value={x.title?.[lang] ?? ""} onChange={(e) => bi(i, "title", e.target.value)} aria-label={t.bannerTitle} maxLength={60} className={`${input} h-10`} />
            </Part>
            <Part lang={lang} label={t.bannerText} more={
              <>
                <StyleBar lang={lang} value={x.styles?.text} onChange={(v) => edit(i, { styles: { ...(x.styles ?? {}), text: v } })} boldNow={false} />
                <Field label={lx.bannerTextFont}>
                  <Seg value={x.textFont ?? "default"} onChange={(textFont) => edit(i, { textFont })} options={fonts} />
                </Field>
                <Stepper lang={lang} label={lx.textSize} value={x.textSize ?? (x.textFont && x.textFont !== "default" ? 20 : 15)} auto={x.textSize === undefined} min={10} max={60} onChange={(textSize) => edit(i, { textSize })} onReset={() => edit(i, { textSize: undefined })} />
                <ColorChip lang={lang} label={lx.bannerTextColor} value={x.textColor} onChange={(textColor) => edit(i, { textColor })} onReset={() => edit(i, { textColor: undefined })} />
              </>
            }>
              <textarea value={x.text?.[lang] ?? ""} onChange={(e) => bi(i, "text", e.target.value)} aria-label={t.bannerText} rows={2} maxLength={140} className={`${input} resize-none py-2.5`} />
            </Part>
            <Part lang={lang} label={lx.bannerEyebrow} more={
              <>
                <StyleBar lang={lang} value={x.styles?.eyebrow} onChange={(v) => edit(i, { styles: { ...(x.styles ?? {}), eyebrow: v } })} boldNow />
                {x.variant === "card" && <Stepper lang={lang} label={popT[lang].eyebrowSize} value={x.eyebrowSize ?? 24} auto={x.eyebrowSize === undefined} min={12} max={60} onChange={(eyebrowSize) => edit(i, { eyebrowSize })} onReset={() => edit(i, { eyebrowSize: undefined })} />}
                <ColorChip lang={lang} label={lx.bannerEyebrowColor} value={x.eyebrowColor} onChange={(eyebrowColor) => edit(i, { eyebrowColor })} onReset={() => edit(i, { eyebrowColor: undefined })} />
              </>
            }>
              <input value={x.eyebrow?.[lang] ?? ""} onChange={(e) => bi(i, "eyebrow", e.target.value)} aria-label={lx.bannerEyebrow} maxLength={40} className={`${input} h-10`} />
            </Part>
            <Part lang={lang} label={t.bannerButton} more={
              <>
                {x.variant !== "card" && (
                  <Field label={lx.bannerButtonStyle}>
                    <Seg value={x.buttonStyle ?? "filled"} onChange={(buttonStyle) => edit(i, { buttonStyle })} options={[{ key: "filled", label: lx.btnFilled }, { key: "outline", label: lx.btnOutline }]} />
                  </Field>
                )}
                <ColorChip lang={lang} label={lx.bannerButtonColor} value={x.accent} onChange={(accent) => edit(i, { accent })} onReset={() => edit(i, { accent: undefined })} />
              </>
            }>
              <input value={x.button?.[lang] ?? ""} onChange={(e) => bi(i, "button", e.target.value)} aria-label={t.bannerButton} maxLength={30} className={`${input} h-10`} />
              <Leads lang={lang} label={t.bannerLink} value={x.link} onChange={(link) => edit(i, { link })} />
            </Part>
            {x.variant !== "card" && (
              <div className="space-y-3">
                <Part lang={lang} label={lx.bannerPanel}>
                  <Seg value={x.panel ?? "none"} cols={3} onChange={(panel) => edit(i, { panel })} options={[{ key: "none", label: lx.panelNone }, { key: "light", label: lx.panelLight }, { key: "dark", label: lx.panelDark }]} />
                </Part>
                {(x.panel === "light" || x.panel === "dark") && (
                  <>
                    <Part lang={lang} label={lx.bannerPanelColor}>
                      <ColorPicker value={x.panelColor || (x.panel === "dark" ? "#12100d" : "#fff5f8")} onChange={(panelColor) => edit(i, { panelColor })} label={lx.bannerPanelColor} bad={dc[lang].identity.hexBad} list={["#fff5f8", "#ffffff", "#f4efe6", "#12100d", "#16120f", "#004956", "#b03a5b"]} />
                      {x.panelColor && (
                        <button type="button" onClick={() => edit(i, { panelColor: "" })} className="mt-2 text-sm font-semibold text-primary hover:underline">{lx.bannerPanelAuto}</button>
                      )}
                    </Part>
                    <Part lang={lang} label={lx.bannerPosition}>
                      <Seg value={x.position ?? "top-start"} onChange={(position) => edit(i, { position })} options={[{ key: "top-start", label: lx.posTopStart }, { key: "top-end", label: lx.posTopEnd }, { key: "bottom-start", label: lx.posBottomStart }, { key: "bottom-end", label: lx.posBottomEnd }, { key: "center", label: popT[lang].bannerCenter }]} />
                    </Part>
                  </>
                )}
                {/* with no panel the words sit at the bottom of the picture, or in the middle */}
                {(x.panel ?? "none") === "none" && (
                  <Part lang={lang} label={popT[lang].heroTextPos}>
                    <Seg value={x.position === "center" ? "center" : "bottom-start"} onChange={(position) => edit(i, { position })} options={[{ key: "bottom-start", label: lx.posBottomStart }, { key: "center", label: popT[lang].bannerCenter }]} />
                  </Part>
                )}
              </div>
            )}
          </div>
          </div>
          </Part>
        </div>
      ))}

      {items.length < 3 && (
        <button type="button" onClick={() => set([...items, { image: "", title: { en: "", ar: "" }, text: { en: "", ar: "" }, button: { en: "", ar: "" }, link: "", variant: items[items.length - 1]?.variant }])} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-4 py-3 text-sm font-bold text-primary transition hover:bg-primary/10">
          {ic.plus}
          {t.addBanner}
        </button>
      )}
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 4v16" /></svg>
        <span><b className="font-semibold text-fg">{t.sizeLabel}:</b> {t.bannersSpec}</span>
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Notes ribbon: a dark strip of short words                          */
/* ------------------------------------------------------------------ */

type RibbonEl = Extract<SectionConfig, { type: "ribbon" }>;

function RibbonForm({ lang, s, onChange }: { lang: Lang; s: RibbonEl; onChange: (s: SectionConfig) => void }) {
  const lx = dc[lang].luxe;
  const items = s.settings.items ?? [];
  const set = (patch: Partial<RibbonEl["settings"]>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
  return (
    <>
      <p className="text-xs leading-relaxed text-muted">{lx.ribbonHint}</p>
      <ol className="space-y-2">
        {items.map((w, i) => (
          <li key={i} className="flex items-center gap-2">
            <input value={w[lang] ?? ""} onChange={(e) => set({ items: items.map((x, j) => (j === i ? { ...x, [lang]: e.target.value } : x)) })} placeholder={lx.ribbonWord} aria-label={lx.ribbonWord} maxLength={24} className={`${input} h-10 flex-1`} />
            <button type="button" className={`${roundBtnSm} hover:!text-rose-600`} onClick={() => set({ items: items.filter((_, j) => j !== i) })} aria-label={lx.ribbonRemove} title={lx.ribbonRemove}>{ic.trash}</button>
          </li>
        ))}
      </ol>
      {items.length < 12 && (
        <button type="button" onClick={() => set({ items: [...items, { en: "", ar: "" }] })} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 text-sm font-bold text-primary transition hover:bg-primary/10">
          {ic.plus}
          {lx.ribbonAdd}
        </button>
      )}
      <Part lang={lang} label={lx.ribbonBg}>
        <FillPicker lang={lang} value={s.settings.background} fallback="#16120f" onChange={(background) => set({ background })} label={lx.ribbonBg} list={["#16120f", "#1c1a17", "#2b2118", "#004956", "#ffffff"]} />
      </Part>
      <Part lang={lang} label={lx.ribbonText}>
        <ColorPicker value={s.settings.color} onChange={(color) => set({ color })} label={lx.ribbonText} bad={dc[lang].identity.hexBad} list={["#c9a46a", "#d9b776", "#e9e1d3", "#ffffff", "#1c1a17"]} />
      </Part>
    </>
  );
}

/** A small amber note that appears when a choice may make the store harder to use. */
function Tip({ text }: { text: string }) {
  return (
    <p role="note" className="flex items-start gap-2 rounded-xl bg-amber-500/12 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 3 2.500 20h19L12 3ZM12 10v4.500M12 17.500v.01" />
      </svg>
      {text}
    </p>
  );
}


/* ------------------------------------------------------------------ */
/*  Colored chips                                                      */
/* ------------------------------------------------------------------ */

type ChipsEl = Extract<SectionConfig, { type: "chips" }>;

function ChipsForm({ lang, s, onChange }: { lang: Lang; s: ChipsEl; onChange: (s: SectionConfig) => void }) {
  const pp = popT[lang];
  const t = dc[lang];
  const items = s.settings.items ?? [];
  const [dragAt, setDragAt] = useState<number | null>(null);
  const [overAt, setOverAt] = useState<number | null>(null);
  /* a card is only pulled by its handle, so the text fields and the color keep working with the mouse */
  const [handle, setHandle] = useState<number | null>(null);
  const set = (next: ChipsEl["settings"]["items"]) => onChange({ ...s, settings: { ...s.settings, items: next } });
  const setRule = (patch: Partial<ChipsEl["settings"]>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
  const edit = (i: number, patch: Partial<ChipsEl["settings"]["items"][number]>) => set(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  /* Moves the button at `from` to the place `to` */
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    set(next);
  };
  return (
    <>
      <p className="text-xs leading-relaxed text-muted">{pp.chipsHint}</p>
      <p className="text-xs leading-relaxed text-muted">{pp.chipMove}</p>
      {items.map((x, i) => (
        <div
          key={i}
          draggable={handle === i}
          onDragStart={(e) => {
            setDragAt(i);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOverAt(i);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragAt !== null) move(dragAt, i);
            setDragAt(null);
            setOverAt(null);
          }}
          onDragEnd={() => {
            setDragAt(null);
            setOverAt(null);
            setHandle(null);
          }}
          className={`space-y-3 rounded-xl border p-3 transition ${overAt === i && dragAt !== null && dragAt !== i ? "border-primary shadow-[0_0_0_2px_rgb(var(--primary)/0.25)]" : "border-fg/10"} ${dragAt === i ? "opacity-40" : ""}`}
        >
          <div className="flex items-center gap-1.5">
            <span aria-hidden title={t.actions.drag} onMouseDown={() => setHandle(i)} onMouseUp={() => setHandle(null)} className="grid h-7 w-6 shrink-0 cursor-grab place-items-center text-muted/70 active:cursor-grabbing">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><circle cx="9" cy="6" r="1.500" /><circle cx="15" cy="6" r="1.500" /><circle cx="9" cy="12" r="1.500" /><circle cx="15" cy="12" r="1.500" /><circle cx="9" cy="18" r="1.500" /><circle cx="15" cy="18" r="1.500" /></svg>
            </span>
            <input value={x.label[lang] ?? ""} onChange={(e) => edit(i, { label: { ...x.label, [lang]: e.target.value } })} placeholder={pp.chipLabel} aria-label={pp.chipLabel} maxLength={24} className={`${input} h-10 min-w-0 flex-1`} />
            <button type="button" className={`${roundBtnSm} hover:!text-rose-600`} onClick={() => set(items.filter((_, j) => j !== i))} aria-label={pp.chipRemove} title={pp.chipRemove}>{ic.trash}</button>
          </div>
          <Part lang={lang} label={pp.chipColor}>
            <ColorPicker value={x.color} onChange={(color) => edit(i, { color })} label={pp.chipColor} bad={dc[lang].identity.hexBad} list={popPastels} />
          </Part>
          <Part lang={lang} label={pp.chipLink}>
            <LinkPicker lang={lang} value={x.link} onChange={(link) => edit(i, { link })} label={pp.chipLink} />
          </Part>
        </div>
      ))}
      {items.length < 8 && (
        <button type="button" onClick={() => set([...items, { label: { en: "", ar: "" }, color: "#ff8fb1", link: "" }])} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/60 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5">
          {ic.plus}
          {pp.chipAdd}
        </button>
      )}

      <div className="space-y-3 rounded-xl bg-soft/70 p-3">
        <p className="text-sm font-semibold">{pp.chipRules}</p>
        <Part lang={lang} label={pp.chipAlign}>
          <Seg value={s.settings.align ?? "center"} cols={3} onChange={(align) => setRule({ align })} options={[{ key: "start", label: pp.alStart }, { key: "center", label: pp.alCenter }, { key: "end", label: pp.alEnd }]} />
        </Part>
        <Part lang={lang} label={pp.chipSize}>
          <Seg value={s.settings.size ?? "md"} cols={3} onChange={(size) => setRule({ size })} options={[{ key: "sm", label: pp.szS }, { key: "md", label: pp.szM }, { key: "lg", label: pp.szL }]} />
        </Part>
        <Toggle on={s.settings.tilt !== false} onChange={(tilt) => setRule({ tilt })} label={pp.chipTilt} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Newsletter                                                         */
/* ------------------------------------------------------------------ */

type NewsEl = Extract<SectionConfig, { type: "newsletter" }>;

function NewsletterForm({ lang, s, onChange, text }: { lang: Lang; s: NewsEl; onChange: (s: SectionConfig) => void; text: (v: { en: string; ar: string }, set: (b: { en: string; ar: string }) => void, label: string, area?: boolean, field?: string) => React.ReactNode }) {
  const pp = popT[lang];
  const set = (patch: Partial<NewsEl["settings"]>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
  const st = s.settings;
  return (
    <>
      <p className="text-xs leading-relaxed text-muted">{pp.nHint}</p>
      {text(st.title, (title) => set({ title }), pp.nTitle, false, "title")}
      {text(st.accentWord, (accentWord) => set({ accentWord }), pp.nAccent)}
      {text(st.text, (t) => set({ text: t }), pp.nText, false, "text")}
      {text(st.button, (button) => set({ button }), pp.nButton)}
      {text(st.placeholder, (placeholder) => set({ placeholder }), pp.nPlaceholder)}
      {text(st.thanks, (thanks) => set({ thanks }), pp.nThanks)}
      <Part lang={lang} label={pp.nBg}>
        <FillPicker lang={lang} value={st.background} fallback="#2b1b47" onChange={(background) => set({ background })} label={pp.nBg} list={["#2b1b47", "#16120f", "#004956", "#1c1a17", "#ffffff"]} />
      </Part>
      <Part lang={lang} label={pp.nAccentColor}>
        <ColorPicker value={st.accent} onChange={(accent) => set({ accent })} label={pp.nAccentColor} bad={dc[lang].identity.hexBad} list={["#ffe36e", "#ff8fb1", "#b9f3d0", "#c9b6ff", "#ffffff"]} />
      </Part>
      <Part lang={lang} label={pp.nAfter}>
        <Seg value={st.after ?? "message"} onChange={(after) => set({ after })} options={[{ key: "message", label: pp.nAfterMsg }, { key: "link", label: pp.nAfterLink }, { key: "popup", label: pp.nAfterPop }]} cols={1} />
      </Part>
      {st.after === "link" && <LinkPicker lang={lang} value={st.link ?? ""} onChange={(link) => set({ link })} label={pp.nAfter} />}
      {st.after === "popup" && (() => {
        const pop = st.popup ?? { title: { en: "You are in!", ar: "شكرًا لانضمامك!" }, text: st.thanks, button: { en: "Great", ar: "تمام" }, background: "#ffffff", accent: st.buttonColor };
        const setPop = (patch: Partial<typeof pop>) => set({ popup: { ...pop, ...patch } });
        return (
          <div className="space-y-4 rounded-xl bg-soft/70 p-3">
            <p className="text-xs leading-relaxed text-muted">{pp.popHint}</p>
            {text(pop.title, (title) => setPop({ title }), pp.popTitle)}
            {text(pop.text, (t) => setPop({ text: t }), pp.popText, true)}
            {text(pop.button, (button) => setPop({ button }), pp.popButton)}
            <Part lang={lang} label={pp.popBg}>
              <FillPicker lang={lang} value={pop.background} fallback="#ffffff" onChange={(background) => setPop({ background })} label={pp.popBg} list={["#ffffff", "#fff6ea", "#b9f3d0", "#ffe36e", "#2b1b47"]} />
            </Part>
            <Part lang={lang} label={pp.popAccent}>
              <ColorPicker value={pop.accent} onChange={(accent) => setPop({ accent })} label={pp.popAccent} bad={dc[lang].identity.hexBad} list={["#ffe36e", "#ff8fb1", "#b9f3d0", "#c9b6ff", "#ffffff"]} />
            </Part>
            <Part lang={lang} label={pp.popPic}>
              <PhotoPicker lang={lang} value={pop.image ?? ""} onChange={(image) => setPop({ image, imagePos: undefined })} max={1000} />
              <PictureMover lang={lang} image={pop.image ?? ""} value={pop.imagePos} onChange={(imagePos) => setPop({ imagePos })} fill ratio="12 / 5" radius="12px" />
            </Part>
          </div>
        );
      })()}
      <SubscribersBox lang={lang} />
      <Part lang={lang} label={pp.nButtonColor}>
        <ColorPicker value={st.buttonColor} onChange={(buttonColor) => set({ buttonColor })} label={pp.nButtonColor} bad={dc[lang].identity.hexBad} list={["#ffe36e", "#ff8fb1", "#b9f3d0", "#c9b6ff", "#ffffff"]} />
      </Part>
    </>
  );
}


/* ------------------------------------------------------------------ */
/*  The store menu (the burger button): what it shows, and in which order */
/* ------------------------------------------------------------------ */

function DrawerItemsForm({ lang, cfg, setCfg }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg }) {
  const pp = popT[lang];
  const t = dc[lang];
  const items = cfg.drawer.items;
  const [dragAt, setDragAt] = useState<number | null>(null);
  const [overAt, setOverAt] = useState<number | null>(null);
  const [handle, setHandle] = useState<number | null>(null);
  const names = { categories: pp.dCategories, pages: pp.dPages, links: pp.dLinks, custom: pp.dCustom };
  const set = (next: typeof items) => setCfg((c) => ({ ...c, drawer: { ...c.drawer, items: next } }));
  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    set(next);
  };
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{pp.drawerTitle}</p>
      <p className="text-xs leading-relaxed text-muted">{pp.drawerHint}</p>
      {items.map((it, i) => (
        <div
          key={it.kind}
          draggable={handle === i}
          onDragStart={(e) => {
            setDragAt(i);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOverAt(i);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragAt !== null) move(dragAt, i);
            setDragAt(null);
            setOverAt(null);
          }}
          onDragEnd={() => {
            setDragAt(null);
            setOverAt(null);
            setHandle(null);
          }}
          className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 transition ${overAt === i && dragAt !== null && dragAt !== i ? "border-primary shadow-[0_0_0_2px_rgb(var(--primary)/0.25)]" : "border-fg/10"} ${dragAt === i ? "opacity-40" : ""}`}
        >
          <span aria-hidden title={t.actions.drag} onMouseDown={() => setHandle(i)} onMouseUp={() => setHandle(null)} className="grid h-7 w-6 shrink-0 cursor-grab place-items-center text-muted/70 active:cursor-grabbing">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><circle cx="9" cy="6" r="1.500" /><circle cx="15" cy="6" r="1.500" /><circle cx="9" cy="12" r="1.500" /><circle cx="15" cy="12" r="1.500" /><circle cx="9" cy="18" r="1.500" /><circle cx="15" cy="18" r="1.500" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <Toggle on={it.visible} onChange={(visible) => set(items.map((x, j) => (j === i ? { ...x, visible } : x)))} label={names[it.kind]} />
          </div>
        </div>
      ))}
      <div className="pt-3">
        <OwnLinksForm lang={lang} tabs={cfg.drawer.custom ?? []} update={(fn) => setCfg((c) => ({ ...c, drawer: { ...c.drawer, custom: fn(c.drawer.custom ?? []) } }))} title={pp.menuLinksTitle} hint={pp.menuLinksHint} add={pp.menuLinkAdd} others={otherLinks(cfg, lang, "menu")} />
      </div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  The footer's own links ("Contact us"): words, a destination, a switch */
/* ------------------------------------------------------------------ */

/** A grip to drag a row by (mouse and touch). It only arms the row; letting go anywhere disarms it. */
function useGrip() {
  const [handle, setHandle] = useState<number | null>(null);
  useEffect(() => {
    const off = () => setHandle(null);
    window.addEventListener("pointerup", off);
    window.addEventListener("pointercancel", off);
    return () => {
      window.removeEventListener("pointerup", off);
      window.removeEventListener("pointercancel", off);
    };
  }, []);
  return [handle, setHandle] as const;
}

function Grip({ lang, onDown }: { lang: Lang; onDown: () => void }) {
  return (
    <span aria-hidden title={dc[lang].actions.drag} onPointerDown={onDown} className="grid h-7 w-6 shrink-0 cursor-grab touch-none place-items-center text-muted/70 active:cursor-grabbing">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><circle cx="9" cy="6" r="1.500" /><circle cx="15" cy="6" r="1.500" /><circle cx="9" cy="12" r="1.500" /><circle cx="15" cy="12" r="1.500" /><circle cx="9" cy="18" r="1.500" /><circle cx="15" cy="18" r="1.500" /></svg>
    </span>
  );
}

/** Move up / move down: the way to reorder with the keyboard or a finger */
function UpDown({ lang, i, n, move }: { lang: Lang; i: number; n: number; move: (from: number, to: number) => void }) {
  const a = dc[lang].actions;
  return (
    <>
      <button type="button" className={roundBtnSm} disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={a.up} title={a.up}>{ic.up}</button>
      <button type="button" className={roundBtnSm} disabled={i === n - 1} onClick={() => move(i, i + 1)} aria-label={a.down} title={a.down}>{ic.down}</button>
    </>
  );
}

/* ---------------- His own links: one editor for the menu, the footer links and his own footer columns ----------------
   The three lists stay apart in the design (each is drawn in its own place), but they are edited with the same rows, the same
   destination picker and the same checks, and a link made in one can be copied into another. */

type OwnLink = Tabs[number];
type LinkProblem = "target" | "web" | "page" | null;

/** What is wrong with where a link leads, by the rules the store follows when it draws it (see resolveLink in the storefront).
    `pages`: the published pages of the store (null while they are still being read). `sections`: the parts it can scroll to. */
export function ownLinkProblem(raw: string, pages: number[] | null, sections: string[]): LinkProblem {
  const l = (raw ?? "").trim();
  if (!l) return "target";
  const pg = /^page:(\d+)$/.exec(l);
  if (pg) return pages && !pages.includes(Number(pg[1])) ? "page" : null;
  if (sections.includes(l)) return null;
  if (/^(javascript|data|vbscript|file):/i.test(l)) return "web";
  if (/^(mailto|tel|sms|whatsapp):\S+$/i.test(l)) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l)) return null;
  if (/^\+?[\d\s\-().]+$/.test(l) && l.replace(/\D/g, "").length >= 7) return null;
  /* a web address: a name with a dot and an ending of two letters or more, with or without https:// */
  return /^(https?:\/\/)?[^\s/?#.]+(\.[^\s/?#.]+)*\.[a-z\u0600-\u06ff]{2,}(:\d+)?([/?#]\S*)?$/i.test(l) ? null : "web";
}

/** A text of a link: only spaces count as nothing (the store would draw an empty link) */
const linkWords = (v: string) => (v.trim() ? v : "");

/** The other lists of his own links in this design, to copy a link from. `self`: the list being edited ("menu", "footer" or a column's id). */
function otherLinks(cfg: StorefrontConfig, lang: Lang, self: string): { key: string; from: string; links: Tabs }[] {
  const ol = dc[lang].ownLinks;
  const other = lang === "ar" ? "en" : "ar";
  const all = [
    { key: "menu", from: ol.fromMenu, links: cfg.drawer.custom ?? [] },
    { key: "footer", from: ol.fromFooter, links: cfg.footer.tabs ?? [] },
    ...footerColumns(cfg.footer).filter((c) => c.kind === "custom").map((c) => ({ key: c.id, from: `${ol.fromColumn}: ${c.title?.[lang]?.trim() || c.title?.[other]?.trim() || popT[lang].colUntitled}`, links: c.links ?? [] })),
  ];
  return all.filter((g) => g.key !== self).map((g) => ({ ...g, links: g.links.filter((x) => x && (x.label?.[lang]?.trim() || x.label?.[other]?.trim()) && x.link?.trim()) })).filter((g) => g.links.length);
}

/** A list of his own links. `update` gets the list as it is at that moment (never a stale copy). `others`: the other lists, to copy a link from. */
function OwnLinksForm({ lang, tabs, update, title, hint, add, others = [] }: { lang: Lang; tabs: Tabs; update: (fn: (prev: Tabs) => Tabs) => void; title: string; hint: string; add: string; others?: { key: string; from: string; links: Tabs }[] }) {
  const pp = popT[lang];
  const ol = dc[lang].ownLinks;
  const other = lang === "ar" ? "en" : "ar";
  const [dragAt, setDragAt] = useState<number | null>(null);
  const [overAt, setOverAt] = useState<number | null>(null);
  const [handle, setHandle] = useGrip();
  /* the link whose trash was pressed: it asks before it goes */
  const [asking, setAsking] = useState<string | null>(null);
  /* the published pages, read again when a link changes (a page can be made from the picker) */
  const [pages, setPages] = useState<number[] | null>(null);
  const sections = useContext(LinkTargets).map((x) => x.id);
  const links = tabs.map((x) => x.link).join("|");
  useEffect(() => setPages(loadInfoPages().filter((p) => p.published).map((p) => p.id)), [links]);
  const edit = (id: string, patch: Partial<OwnLink>) => update((all) => all.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const move = (from: number, to: number) => update((all) => reorder(all, from, to));
  const copyable = others.map((g) => ({ ...g, links: g.links.filter((x) => !tabs.some((y) => y.link.trim() === x.link.trim() && (y.label[lang] ?? "").trim() === (x.label[lang] ?? "").trim())) })).filter((g) => g.links.length);
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs leading-relaxed text-muted">{hint}</p>
      {tabs.map((x, i) => {
        const problem = ownLinkProblem(x.link, pages, sections);
        const noWords = !(x.label?.[lang] ?? "").trim() && !(x.label?.[other] ?? "").trim();
        return (
          <div
            key={x.id}
            data-own-link={x.id}
            draggable={handle === i}
            onDragStart={(e) => {
              setDragAt(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverAt(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragAt !== null) move(dragAt, i);
              setDragAt(null);
              setOverAt(null);
            }}
            onDragEnd={() => {
              setDragAt(null);
              setOverAt(null);
              setHandle(null);
            }}
            className={`space-y-3 rounded-xl border p-3 transition ${overAt === i && dragAt !== null && dragAt !== i ? "border-primary shadow-[0_0_0_2px_rgb(var(--primary)/0.25)]" : "border-fg/10"} ${dragAt === i ? "opacity-40" : ""} ${x.visible ? "" : "opacity-70"}`}
          >
            <div className="flex items-center gap-1">
              <Grip lang={lang} onDown={() => setHandle(i)} />
              <input value={x.label?.[lang] ?? ""} onChange={(e) => { const v = linkWords(e.target.value); update((all) => all.map((y) => (y.id === x.id ? { ...y, label: { ...y.label, [lang]: v } } : y))); }} placeholder={x.label?.[other]?.trim() || pp.tabLabel} aria-label={pp.tabLabel} aria-invalid={noWords} maxLength={30} className={`${input} h-10 min-w-0 flex-1`} />
              <UpDown lang={lang} i={i} n={tabs.length} move={move} />
              <button type="button" className={`${roundBtnSm} hover:!text-rose-600`} onClick={() => setAsking(x.id)} aria-label={pp.tabRemove} title={pp.tabRemove}>{ic.trash}</button>
            </div>
            {noWords && <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{ol.labelEmpty}</p>}
            {asking === x.id && <LinkAsk lang={lang} onYes={() => { update((all) => all.filter((y) => y.id !== x.id)); setAsking(null); }} onNo={() => setAsking(null)} />}
            <LinkPicker lang={lang} value={x.link} onChange={(link) => edit(x.id, { link })} label={pp.tabLabel} />
            {problem === "target" && <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{pp.linkPickTarget}</p>}
            {problem === "web" && <p role="alert" className="text-xs font-semibold text-rose-600">{ol.webBad}</p>}
            {problem === "page" && <p role="alert" className="text-xs font-semibold text-rose-600">{ol.pageGone}</p>}
            <Toggle on={x.visible} onChange={(visible) => edit(x.id, { visible })} label={pp.tabShow} />
          </div>
        );
      })}
      {tabs.length < 8 && (
        <button type="button" onClick={() => update((all) => [...all, newTab()])} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/60 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5">
          {ic.plus}
          {add}
        </button>
      )}
      {/* a link he already made in another list (the menu, the footer links, a column) comes over with its words and its destination */}
      {tabs.length < 8 && copyable.length > 0 && (
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-fg/80">{ol.reuse}</span>
          <select
            value=""
            aria-label={ol.reuse}
            onChange={(e) => {
              const [gi, li] = e.target.value.split(":").map(Number);
              const from = copyable[gi]?.links[li];
              if (from) update((all) => (all.length < 8 ? [...all, { id: newId("tab"), label: { en: from.label.en ?? "", ar: from.label.ar ?? "" }, link: from.link, visible: true }] : all));
            }}
            className={`${input} h-10`}
          >
            <option value="">{ol.reusePick}</option>
            {copyable.map((g, gi) => (
              <optgroup key={g.key} label={g.from}>
                {g.links.map((x, li) => (
                  <option key={x.id} value={`${gi}:${li}`}>{x.label[lang]?.trim() || x.label[other]?.trim()}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

/* A new link starts with no words and nowhere to go: the row asks for both */
const newTab = (): OwnLink => ({ id: newId("tab"), label: { en: "", ar: "" }, link: "", visible: true });


/* ------------------------------------------------------------------ */
/*  The footer's columns: which ones, in which order, and his own       */
/* ------------------------------------------------------------------ */

function FooterColumnsForm({ lang, cfg, setCfg, go }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg; go: (b: FootBlock) => void }) {
  const pp = popT[lang];
  const t = dc[lang];
  const f = cfg.footer;
  const other = lang === "ar" ? "en" : "ar";
  const cols = footerColumns(f);
  const [dragAt, setDragAt] = useState<number | null>(null);
  const [overAt, setOverAt] = useState<number | null>(null);
  const [handle, setHandle] = useGrip();
  const [open, setOpen] = useState<string | null>(null);
  /* the custom column whose trash was pressed: it asks before it goes */
  const [asking, setAsking] = useState<string | null>(null);
  /* how many store pages asked to be in the footer */
  const [pagesIn, setPagesIn] = useState(0);
  useEffect(() => setPagesIn(loadInfoPages().filter((p) => p.published && p.footer).length), []);
  /* every change is made on the columns as they are at that moment */
  const setCols = (fn: (all: FooterColumn[]) => FooterColumn[]) => setCfg((c) => ({ ...c, footer: { ...c.footer, columns: fn(footerColumns(c.footer)) } }));
  const edit = (id: string, patch: Partial<FooterColumn>) => setCols((all) => all.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const move = (from: number, to: number) => setCols((all) => reorder(all, from, to));
  const setTabs = (fn: (prev: Tabs) => Tabs) => setCfg((c) => ({ ...c, footer: { ...c.footer, tabs: fn(c.footer.tabs ?? []) } }));
  /* the part of the footer's screen where the content of each built-in column is edited */
  const contentOf: Partial<Record<FooterColumn["kind"], FootBlock>> = { pages: "links", contact: "contact", social: "social", licenses: "licenses" };
  const ownTabs = (f.tabs ?? []).filter((x) => x.visible).length;
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{pp.colsTitle}</p>
      <p className="text-xs leading-relaxed text-muted">{pp.colsHint}</p>
      {cols.map((col, i) => {
        const name = colName(f, col, lang);
        const on = colOn(f, col);
        const sub = contentOf[col.kind];
        return (
          <div
            key={col.id}
            draggable={handle === i}
            onDragStart={(e) => {
              setDragAt(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverAt(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragAt !== null) move(dragAt, i);
              setDragAt(null);
              setOverAt(null);
            }}
            onDragEnd={() => {
              setDragAt(null);
              setOverAt(null);
              setHandle(null);
            }}
            className={`rounded-xl border px-2 py-1.5 transition ${overAt === i && dragAt !== null && dragAt !== i ? "border-primary shadow-[0_0_0_2px_rgb(var(--primary)/0.25)]" : "border-fg/10"} ${dragAt === i ? "opacity-40" : ""}`}
          >
            <div className="flex items-center gap-1">
              <Grip lang={lang} onDown={() => setHandle(i)} />
              {/* an untitled column of his own shows a dimmed placeholder name */}
              <div className={`min-w-0 flex-1 ${name ? "" : "[&_span.text-sm]:italic [&_span.text-sm]:text-muted"}`}>
                <Toggle on={on} onChange={(v) => setCfg((c) => ({ ...c, footer: colTurn(c.footer, col.id, v) }))} label={name || pp.colUntitled} />
              </div>
              <UpDown lang={lang} i={i} n={cols.length} move={move} />
              {/* links, contact, social and licenses: the pencil opens the part of the screen that fills the column (its title is at
                  the top there); his own columns open here */}
              {sub ? (
                <button type="button" onClick={() => go(sub)} aria-label={`${pp.colContent}: ${name}`} title={pp.colContent} className={roundBtnSm}>{ic.edit}</button>
              ) : col.kind !== "about" ? (
                <button type="button" onClick={() => setOpen(open === col.id ? null : col.id)} aria-expanded={open === col.id} aria-label={`${pp.colContent}: ${name || pp.colUntitled}`} title={pp.colContent} className={roundBtnSm}>{ic.edit}</button>
              ) : null}
              {col.kind === "custom" && <button type="button" className={`${roundBtnSm} hover:!text-rose-600`} onClick={() => setAsking(col.id)} aria-label={pp.colRemove} title={pp.colRemove}>{ic.trash}</button>}
            </div>
            {asking === col.id && (
              <div className="pb-1.5">
                <LinkAsk lang={lang} text={pp.colAsk} onYes={() => { setCols((all) => all.filter((x) => x.id !== col.id)); setAsking(null); }} onNo={() => setAsking(null)} />
              </div>
            )}
            {/* the name and about column: the logo-and-name switch and the about text sit right under it */}
            {col.kind === "about" && (
              <div className="space-y-2 border-t border-fg/10 px-1 pb-2 pt-3">
                {!on && <p className="text-xs text-muted">{pp.aboutColOff}</p>}
                <Toggle on={f.showLogo} onChange={(showLogo) => setCfg((c) => ({ ...c, footer: { ...c.footer, showLogo } }))} label={t.footer.showLogo} />
                <p className="text-xs text-muted">{f.showLogo && cfg.identity.showLogo === false ? pp.logoMarkHint : pp.logoNameHint}</p>
                <Part lang={lang} label={t.footerFields.about} hint={t.footerFields.aboutHint} field="about" preview={f.about[lang] || f.about[other]}>
                  <textarea data-field="about" value={f.about[lang]} onChange={(e) => { const v = e.target.value; setCfg((c) => ({ ...c, footer: { ...c.footer, about: { ...c.footer.about, [lang]: v } } })); }} rows={3} maxLength={200} aria-label={t.footerFields.about} className={`${input} resize-none py-3`} />
                </Part>
              </div>
            )}
            {/* the links column: where its links come from, and a quick way to add one */}
            {col.kind === "pages" && (
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 pb-1.5">
                <span className="text-xs text-muted">{pp.pagesFrom.replace("{p}", String(pagesIn)).replace("{o}", String(ownTabs))}</span>
                {(f.tabs ?? []).length < 8 && (
                  <button type="button" onClick={() => { setTabs((all) => [...all, newTab()]); go("links"); }} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    {ic.plus}
                    {pp.tabAdd}
                  </button>
                )}
              </div>
            )}
            {col.kind === "licenses" && on && !hasLicense(f) && (
              <div className="px-1 pb-1.5">
                <p className="text-xs text-amber-700 dark:text-amber-400">{pp.licensesEmpty}</p>
                <button type="button" onClick={() => go("licenses")} className="mt-1 text-xs font-semibold text-primary hover:underline">{pp.licensesOpen}</button>
              </div>
            )}
            {col.kind === "custom" && open === col.id && (
              <div className="space-y-3 border-t border-fg/10 px-1 pb-2 pt-3">
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-fg/80">{pp.colTitle}</p>
                  <input value={col.title?.[lang] ?? ""} onChange={(e) => { const v = e.target.value; setCols((all) => all.map((x) => (x.id === col.id ? { ...x, title: { en: x.title?.en ?? "", ar: x.title?.ar ?? "", [lang]: v } } : x))); }} placeholder={col.title?.[other] || pp.colUntitled} aria-label={pp.colTitle} maxLength={30} className={`${input} h-11`} />
                </div>
                <OwnLinksForm lang={lang} tabs={col.links ?? []} update={(fn) => setCols((all) => all.map((x) => (x.id === col.id ? { ...x, links: fn(x.links ?? []) } : x)))} title={pp.colLinksTitle} hint={pp.colLinksHint} add={pp.tabAdd} others={otherLinks(cfg, lang, col.id)} />
              </div>
            )}
          </div>
        );
      })}
      {cols.filter((x) => x.kind === "custom").length < 4 && (
        <button
          type="button"
          onClick={() => {
            const id = newId("col");
            setCols((all) => [...all, { id, kind: "custom", visible: true, title: { en: popT.en.colDefault, ar: popT.ar.colDefault }, links: [] }]);
            setOpen(id);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/60 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5"
        >
          {ic.plus}
          {pp.colAdd}
        </button>
      )}
    </div>
  );
}

/* The emails left in the newsletter block: how many, a file to download, and a way to clear them */
function SubscribersBox({ lang }: { lang: Lang }) {
  const pp = popT[lang];
  const [list, setList] = useState<{ email: string; at: number }[]>([]);
  useEffect(() => {
    const read = () => setList(readSubscribers());
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);
  const download = () => {
    const rows = ["email,date", ...list.map((x) => `${x.email},${new Date(x.at).toISOString().slice(0, 10)}`)].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
    a.download = "subscribers.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div className="space-y-2 rounded-xl bg-soft/70 p-3">
      <p className="text-sm font-semibold">{pp.nSubs}: <span dir="ltr" className="tabular-nums">{list.length}</span> {pp.nSubsCount}</p>
      <p className="text-xs leading-relaxed text-muted">{pp.nSubsHint}</p>
      {list.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={download} className="text-sm font-semibold text-primary hover:underline">{pp.nCsv}</button>
          <button type="button" onClick={() => { try { localStorage.removeItem("seen-subscribers"); } catch { /* storage unavailable */ } setList([]); }} className="text-sm font-semibold text-rose-600 hover:underline">{pp.nClear}</button>
        </div>
      )}
    </div>
  );
}
