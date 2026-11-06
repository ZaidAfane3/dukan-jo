"use client";

import { createContext, Fragment, useContext, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { latin } from "../digits";
import type { Lang } from "../content";
import { cartStyles, defaultConfig, productPageStyles, type ProductPageStyle, footerColumns, fontChoices, fontFamily, storeFonts, type CartStyle, heroTitleFamily, newBanners, newChips, newCollection, newNewsletter, newRibbon, newSlides, newTextSection, newTiles, shopTarget, HERO_TITLE_MAX, HERO_TITLE_MIN, FOOTER_SIZES, ANNOUNCE_MESSAGES_MAX, ANNOUNCE_TEXT_MAX, TAGLINE_MAX, type Banner, type DisplayFont, type HeroBg, type FooterColumn, type PatternKey, type HeroFont, type ThemeFont, type Tile, type Slide, type MarkKey, type Perk, type Review, type PerkIcon, type SectionConfig, type SectionType, type TextStyle, type StorefrontConfig, type TitleLook } from "../storefront/config";
import { copy as storeCopy, drawerHeading, fillColors, flowingOf, gradientOf, icons as storeIcons, isFlowing, isGradient, LogoMark, markKeys, onColor, resolveLogo, sampleMarks } from "../storefront/parts";
import { editLocked } from "../demoSandbox";
import { findTheme, loadThemeState, ownsLook, type ThemeInfo } from "../themes";
import { isOwnCopy } from "../demoSandbox";
import { loadSetup } from "../setup";
import { patterns } from "../storefront/patterns";
import { FocusPicker, type Focus as PicFocus } from "../FocusPicker";
import { pickedNote, pickPicture, readPicture, type PicNote } from "./image";
import { ImageCropper, type CropShape } from "../ImageCropper";
import { checkImage, cleanFileName, hasStoreContact, imageRules, PICTURE_ACCEPT, safeUrl, smallPictureNote, uploadProblemFor, visibleLength } from "../safe";
import { RudeNote } from "../RudeNote";
import { digitsOnlyError, isJordanNumber, numberError, typedAnyPhone, typedPhone } from "../phone";
import { PicNoteLine } from "./PicNoteLine";
import { countDiscounted, readProducts, storeCategories } from "../storefront/useStoreData";
import { deleteMedia, putMedia, setLiveMedia, useMediaUrl } from "../storefront/mediaStore";
import { showSlide } from "../storefront/slideSignal";
import { useSpotWhile, type Spot } from "../storefront/spotSignal";
import { Blocked, ColorPicker, Field, input, SecondsPicker, Toggle } from "./controls";

/* the reason a setting is greyed out (see Blocked), in his language */
const why = (lang: Lang, ar: string, en: string) => (lang === "ar" ? ar : en);
import { DeleteAsk } from "./DeleteAsk";
import { dc, sampleTexts } from "./copy";
import { LinkPicker, LinkTargets, PictureMover, useStorePages } from "./PageLink";
import { readSubscribers } from "../storefront/sections";
import { load as loadInfoPages } from "../InfoPages";
import { bannerSurface, dimOn, footerColors, footerNameSize, inkOn, legibleOn, readsOn } from "../storefront/footerColors";

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
  swap: <svg {...icon}><path d="M4 9h13l-3-3M20 15H7l3 3" /></svg>,
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
    kinds: { drawer: ["Side panel", "Soft cards, two steps"], editorial: ["Dukkan Founders", "Sharp, small capitals"], luxe: ["Misk", "Full page, summary beside items"], pop: ["Lamma", "Bold lines, hard shadow"] },
  },
  ar: {
    title: "تصميم السلة",
    hint: "شكل السلة وإتمام الطلب عندما يفتحها العميل. تستخدم ألوانك وخطوطك.",
    kinds: { drawer: ["لوحة جانبية", "بطاقات ناعمة وخطوتان"], editorial: ["مؤسسو دكان", "حادة وبأحرف صغيرة"], luxe: ["مِسك", "صفحة كاملة، الملخص بجانب المنتجات"], pop: ["لَمّة", "خطوط عريضة وظل صلب"] },
  },
};

/* The looks of the product page (see ProductPage in sections.tsx): a name and a short line for each */
const productPageT: Record<"en" | "ar", { title: string; hint: string; kinds: Record<ProductPageStyle, [string, string]> }> = {
  en: {
    title: "Product page design",
    hint: "How a product's own page looks when a customer opens it. It uses your colors and fonts.",
    kinds: { classic: ["Classic", "Soft panels, clean and modern"], editorial: ["Dukkan Founders", "Tall photo, small capitals"], luxe: ["Misk", "Framed photo, centered, airy"], pop: ["Lamma", "Bold lines, hard shadow"] },
  },
  ar: {
    title: "تصميم صفحة المنتج",
    hint: "شكل صفحة المنتج عندما يفتحها العميل. تستخدم ألوانك وخطوطك.",
    kinds: { classic: ["كلاسيكي", "لوحات ناعمة، نظيف وعصري"], editorial: ["مؤسسو دكان", "صورة طويلة وخطوط رفيعة"], luxe: ["مِسك", "صورة بإطار، في المنتصف، واسع"], pop: ["لَمّة", "خطوط عريضة وظل صلب"] },
  },
};

/* The words of the playful ("pop") features: the hero layout, colored chips, the newsletter, round "+" cards, the pill header */
const popT = {
  en: {
    layoutPop: "Lamma",
    chip: "Small chip above the title",
    accentWord: "Colored word of the title",
    accentWordHint: "A word of the title that is shown in a color of its own",
    sticker: "Round sticker",
    photo1: "Main photo (arch)",
    photo2: "Second photo (tilted)",
    colorAccent: "Highlight color",
    colorBlob: "Shape behind the photos",
    colorSticker: "Sticker color",
    chipsHint: "Small colored buttons, a little tilted. Under each button, choose from the list where it goes: a part of this page, another page of your store, or a web address.",
    chipLabel: "Button text",
    chipColor: "Button color",
    chipLink: "Link (Optional)",
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
    slideWords: "Words for this one (Optional)",
    slideWordsHint: "Leave a box empty to use the cover's main words.",
    slideTitle: "Title",
    slideText: "Subtitle",
    slideButton: "Button text",
    slideLeads: "Where its button leads",
    cardsPick: "Products on the cards",
    cardsHint: "Pick up to 3, in the order they show. Until you pick, your first products show.",
    cardsPicked: "picked",
    cardsNone: "None picked: the cards are hidden. Pick a product to show them again.",
    cardsAuto: "Use my first products",
    partMore: "Size and color",
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
    nameSize: "Size of the store name",
    showName: "Show the store name beside the logo",
    nameFontSame: "Like the titles",
    namePlace: "Logo and name position",
    placeRight: "Right",
    placeCenter: "Center",
    placeLeft: "Left",
    namePlaceOther: "In the Arabic store it shows on the other side, because Arabic reads from right to left.",
    tagline: "Small line under the name",
    taglineWords: "Words of the line",
    taglinePh: "For example: Fresh coffee since 2010",
    taglineHint: "Shows under the store name in the header. Leave it empty to show no line.",
    taglineFont: "Font of the line",
    taglineColor: "Color of the line",
    taglineFontDefault: "Thin and slanted (default)",
    pricesTitle: "Language of the prices",
    pricesAuto: "Like the page",
    pricesAr: "Arabic (٢٤ د.أ)",
    pricesEn: "English (24 JOD)",
    nAfterPop: "Show a pop-up",
    popTitle: "Pop-up title",
    popText: "Subtitle",
    popButton: "Pop-up button",
    popBg: "Pop-up color",
    popAccent: "Pop-up button color",
    popPic: "Pop-up picture (Optional)",
    popHint: "Press the subscribe button in the preview to see the pop-up while you adjust it.",
    nAfter: "After someone subscribes",
    nAfterMsg: "Show the thank-you message",
    nAfterLink: "Show it, then go to...",
    nSubs: "Subscribers",
    nSubsCount: "emails saved in this browser",
    nCsv: "Download the list (CSV)",
    nClear: "Clear the list",
    nSubsHint: "The emails are saved in this browser only. Download the list to keep a copy.",
    colHidden: "This column is hidden, so customers don't see what you fill in here. Show it with its switch in Footer columns.",
    colHiddenOpen: "Open Footer columns",
    sizesTitle: "Footer text sizes",
    szTitles: "Column titles",
    szText: "Texts and links",
    szName: "Store name",
    morePics: "More pictures (a small collage)",
    morePicsHint: "Add up to 3 more pictures. They sit beside the first one, a little overlapping and tilted.",
    addPic: "Add a picture",
    removePic: "Remove this picture",
    colsTitle: "Footer columns",
    colsHint: "Show or hide each column with its switch here. Drag a column by its handle to change the order (or open it and use Move up / Move down), or add a column of your own with its own title and links.",
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
    dCustom: "Sidebar-only links: you add them below",
    dOpen: "Rename it and choose what it shows",
    dName: "Heading in the sidebar",
    dIncludes: { categories: "Categories it shows", pages: "Pages it shows", links: "Header links it shows", custom: "Links it shows" },
    dEmpty: "Nothing here yet.",
    dEmptyLinks: "No header links yet. Add them in Navigation links.",
    menuLinkAdd: "Add a sidebar link",
    menuLinksTitle: "Sidebar-only links",
    menuLinksHint: "Choose what else the sidebar has and where each link goes: a page of the store or a part of the page. Each one has its own switch.",
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
    pagesHint: "To show an info page here (like your return policy), open it in Info pages in your dashboard and turn on \"Show the page link in the store footer\".",
    licensesEmpty: "Nothing shows yet. Add a license number, logo or name under Store licenses.",
    licensesOpen: "Open Store licenses",
    logoNameHint: "Hides or shows the logo and the store name together.",
    logoMarkHint: "Only the name shows: the logo mark is turned off in Identity.",
    aboutColOff: "This column is off, so the about text does not show.",
    autoColor: "Automatic",
    autoColorNow: "Automatic: the color the theme picks",
    pickColor: "Choose a color",
    lowContrast: "Hard to read on this background. The store will use automatic text.",
    lowContrastText: "Your text color is hard to read on this background. The store will use automatic text.",
    lowContrastIn: (places: string) => `Hard to read in these places: ${places}. The store will use automatic text there.`,
    placeHeader: "the page header",
    placeFooter: "the page footer",
    socialBad: "Paste the full link of your page, or write @name.",
    emailBad: "This email does not look right. Example: name@store.com",
    contactNeeded: "Add a valid phone or WhatsApp number. Customers need one of them to reach you, and the store can't be saved without it.",
    socialPh: "Link or @name",
    eyebrowSize: "Size of the small line",
    cardOpens: "Pressing a product opens its page",
    drawerTitle: "What the sidebar shows",
    drawerHint: "Turn each group on or off, and drag a group up or down to change its order.",
    dCategories: "Product categories: from your products",
    dPages: "Store pages: from Pages",
    dLinks: "The header's links: set in Navigation links",
    buttonLeads: "Where this button leads",
    button2Leads: "Where the second button leads",
    titleFont: "Title font",
    productsCard: "Products card",
    titleFontTheme: "The theme's font", fontArOnly: "Writes Arabic only: English text shows in Readex", subFont: "Subtitle font", fromTheme: "Comes with the {t} theme you bought",
    addButton: "Add another button",
    secondButton: "Second button",
    removeButton: "Remove this button",
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
    nText: "Subtitle",
    nButton: "Button",
    nPlaceholder: "Email field text",
    nThanks: "Thank-you message",
    nHint: "The visitor writes an email and presses the button. The emails appear in the Subscribers list at the bottom of this panel.",
    perks: "Perks", perkNew: "New perk", perkIcon: "Icon", perkTitlePh: "For example: Fast delivery", perkSubPh: "For example: Across Jordan in 2 days", perksLook: "How the boxes look", perksBg: "Box background", perksBorder: "Border", borderNone: "None", borderThin: "Thin", borderThick: "Thick", borderColor: "Border color",
    nBg: "Block color",
    nAccentColor: "Colored word color",
    nButtonColor: "Button color",
    stylePop: "Lamma",
    cardAdd: "Add to basket button",
    addWide: "Wide button",
    addPlus: "Round +",
    priceColor: "Price color",
    addColor: "Round + button color",
    titlePop: "Lamma",
    navPill: "Lamma",
    navBarHint: "Your links show in a bar under the header, above the first section (like Men, Women, Kids). Each one takes the visitor to a page of your store or a part of this page.",
    navSidebarOff: "The sidebar is hidden, so customers see no way to move around. Show it in Sidebar settings, or add links below.",
    navNoLinks: "No link is ready yet, so customers see none in the header. Add a link below, write its name and choose where it leads.",
    navActive: "Chosen link color",
    navCart: "Basket button color",
    footerStyle: "Footer style",
    footerFull: "Full (tinted, in columns)",
    footerSimple: "Simple (no tint, in a row)",
    bannerVariant: "Banner look",
    variantPhoto: "Photo",
    variantCard: "Lamma",
    cardColor: "Card color",
    shape: "Picture shape",
    shapeArch: "Arch",
    shapeTilt: "Tilted",
    btnColor: "Button color",
    linkAsk: "Delete this link?",
    colorAuto: "Auto",
    colorReset: "Reset",
    /* the sale color, the color of one menu link, the banner cover's text place and height, the promo banner in the middle */
    saleColor: "Discount color",
    saleColorHint: "Paints the discount badges, the prices after a discount and the number on the basket, as in the sample under the colors.",
    saleSample: "Sample",
    saleColorAuto: "Reset (back to the store color)",
    linkColor: "Link color",
    heroTextPos: "Text position",
    textPosCenter: "Side",
    textPosBottomStart: "Bottom side",
    textPosBottomCenter: "Bottom center",
    textPosHint: "Bottom center hides the product pictures.",
    heroHeight: "Cover height",
    heightNormal: "Normal",
    heightTall: "Tall",
    heroSize: "Cover size",
    sizeW: "Width",
    sizeH: "Height",
    sizeLinked: "Linked: width and height change together",
    sizeUnlinked: "Separate: each one changes on its own",
    sizeAuto: "Back to the automatic size",
    heroFullWidth: "Full page width",
    bannerCenter: "In the middle",
    sampleMarks: { shop: "Shop sign", bag: "Shopping bag", star: "Star", heart: "Heart", leaf: "Leaf", bolt: "Lightning" },
  },
  ar: {
    layoutPop: "لَمّة",
    chip: "الشارة الصغيرة فوق العنوان",
    accentWord: "الكلمة الملوّنة من العنوان",
    accentWordHint: "كلمة من العنوان تظهر بلون مميز",
    sticker: "الملصق الدائري",
    photo1: "الصورة الرئيسية (قوس)",
    photo2: "الصورة الثانية (مائلة)",
    colorAccent: "اللون المميز",
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
    slideText: "العنوان الفرعي",
    slideButton: "نص الزر",
    slideLeads: "إلى أين يذهب زرها",
    cardsPick: "المنتجات في البطاقات",
    cardsHint: "اختر حتى 3 منتجات بالترتيب الذي تظهر به. إلى أن تختار تظهر أول منتجاتك.",
    cardsPicked: "مختار",
    cardsNone: "لم تختر أي منتج: البطاقات مخفية. اختر منتجًا لتظهر من جديد.",
    cardsAuto: "استخدم أول منتجاتي",
    partMore: "الحجم واللون",
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
    nameSize: "حجم اسم المتجر",
    showName: "إظهار اسم المتجر بجانب الشعار",
    nameFontSame: "مثل العناوين",
    namePlace: "موضع الشعار والاسم",
    placeRight: "يمين",
    placeCenter: "الوسط",
    placeLeft: "يسار",
    namePlaceOther: "في المتجر الإنجليزي يظهر في الجهة المقابلة، لأن الإنجليزية تُقرأ من اليسار إلى اليمين.",
    tagline: "سطر صغير تحت الاسم",
    taglineWords: "نص السطر",
    taglinePh: "مثال: قهوة طازجة منذ 2010",
    taglineHint: "يظهر تحت اسم المتجر في رأس الصفحة. اتركه فارغًا ليختفي السطر.",
    taglineFont: "خط السطر",
    taglineColor: "لون السطر",
    taglineFontDefault: "رفيع وأنيق (الافتراضي)",
    pricesTitle: "لغة الأسعار",
    pricesAuto: "مثل لغة الصفحة",
    pricesAr: "عربي (٢٤ د.أ)",
    pricesEn: "إنجليزي (24 JOD)",
    nAfterPop: "إظهار نافذة منبثقة",
    popTitle: "عنوان النافذة",
    popText: "العنوان الفرعي",
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
    nSubsHint: "تُحفظ الإيميلات في هذا المتصفح فقط. نزّل القائمة لتحتفظ بنسخة منها.",
    colHidden: "هذا العمود مخفي، فلا يرى العملاء ما تكتبه هنا. أظهره من مفتاحه في «أعمدة التذييل».",
    colHiddenOpen: "فتح أعمدة التذييل",
    sizesTitle: "أحجام نصوص التذييل",
    szTitles: "عناوين الأعمدة",
    szText: "النصوص والروابط",
    szName: "اسم المتجر",
    morePics: "صور أخرى (كولاج صغير)",
    morePicsHint: "أضف حتى 3 صور أخرى. تظهر بجانب الأولى، متداخلة قليلًا ومائلة.",
    addPic: "إضافة صورة",
    removePic: "إزالة هذه الصورة",
    colsTitle: "أعمدة التذييل",
    colsHint: "أظهر كل عمود أو أخفه من مفتاحه هنا. اسحب العمود من مقبضه لتغيير ترتيبه (أو افتحه واستخدم زرّي التحريك)، أو أضف عمودًا خاصًا بك بعنوانه وروابطه.",
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
    dCustom: "روابط القائمة الجانبية فقط: تضيفها في الأسفل",
    dOpen: "إعادة التسمية واختيار ما يظهر",
    dName: "العنوان في القائمة الجانبية",
    dIncludes: { categories: "التصنيفات التي تظهر فيها", pages: "الصفحات التي تظهر فيها", links: "روابط الهيدر التي تظهر فيها", custom: "الروابط التي تظهر فيها" },
    dEmpty: "لا يوجد شيء بعد.",
    dEmptyLinks: "لا روابط في الهيدر بعد. أضفها من «روابط التنقل».",
    menuLinkAdd: "إضافة رابط في القائمة الجانبية",
    menuLinksTitle: "روابط القائمة الجانبية فقط",
    menuLinksHint: "اختر ماذا تضم القائمة الجانبية أيضًا وإلى أين يذهب كل رابط: صفحة من المتجر أو جزء من الصفحة. لكل واحد مفتاحه الخاص.",
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
    pagesHint: "لإظهار صفحة تعريفية هنا (مثل سياسة الاسترجاع)، افتحها من «الصفحات التعريفية» في لوحة التحكم وفعّل «عرض رابط الصفحة في تذييل الموقع».",
    licensesEmpty: "لا يظهر شيء بعد. أضف رقم الرخصة أو شعارها أو اسمها من «رُخَص المتجر».",
    licensesOpen: "فتح رُخَص المتجر",
    logoNameHint: "يُظهر شعار المتجر واسمه معًا أو يخفيهما.",
    logoMarkHint: "يظهر الاسم فقط: علامة الشعار مُطفأة في «الهوية».",
    aboutColOff: "هذا العمود مُطفأ، لذلك لا يظهر النص التعريفي.",
    autoColor: "تلقائي",
    autoColorNow: "تلقائي: اللون الذي يختاره الثيم",
    pickColor: "اختيار لون",
    lowContrast: "يصعب قراءته على هذه الخلفية. سيستخدم المتجر لون نص تلقائيًا.",
    lowContrastText: "يصعب قراءة لون النص على هذه الخلفية. سيستخدم المتجر لون نص تلقائيًا.",
    lowContrastIn: (places: string) => `يصعب قراءته في الأماكن التالية: ${places}. سيستخدم المتجر هناك لون نص تلقائيًا.`,
    placeHeader: "رأس الصفحة",
    placeFooter: "تذييل الصفحة",
    socialBad: "الصق رابط صفحتك كاملًا، أو اكتب @الاسم.",
    emailBad: "يبدو أن البريد غير صحيح. مثال: name@store.com",
    contactNeeded: "أضف رقم هاتف أو واتساب صحيحًا. يحتاج العملاء أحدهما للتواصل معك، ولا يُحفظ المتجر بدونه.",
    socialPh: "الرابط أو @الاسم",
    eyebrowSize: "حجم السطر الصغير",
    cardOpens: "الضغط على المنتج يفتح صفحته",
    drawerTitle: "ماذا تعرض القائمة الجانبية",
    drawerHint: "فعّل أو ألغِ كل مجموعة، واسحب المجموعة لأعلى أو أسفل لتغير ترتيبها.",
    dCategories: "أقسام المنتجات: من منتجاتك",
    dPages: "صفحات المتجر: من «الصفحات»",
    dLinks: "روابط الهيدر: تُضبط في «روابط التنقل»",
    buttonLeads: "إلى أين يذهب هذا الزر",
    button2Leads: "إلى أين يذهب الزر الثاني",
    titleFont: "خط العنوان",
    productsCard: "بطاقات المنتجات",
    titleFontTheme: "خط الثيم", fontArOnly: "يكتب العربية فقط: يظهر النص الإنجليزي بخط ريديكس", subFont: "خط العنوان الفرعي", fromTheme: "من ثيم {t} الذي اشتريته",
    addButton: "إضافة زر آخر",
    secondButton: "الزر الثاني",
    removeButton: "إزالة هذا الزر",
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
    nText: "العنوان الفرعي",
    nButton: "الزر",
    nPlaceholder: "نص حقل الإيميل",
    nThanks: "رسالة الشكر",
    nHint: "يكتب الزائر إيميله ويضغط الزر، فيظهر الإيميل في قائمة المشتركين أسفل هذه اللوحة.",
    perks: "المزايا", perkNew: "ميزة جديدة", perkIcon: "الأيقونة", perkTitlePh: "مثال: توصيل سريع", perkSubPh: "مثال: لكل مناطق الأردن خلال يومين", perksLook: "شكل المربعات", perksBg: "خلفية المربع", perksBorder: "الإطار", borderNone: "بدون", borderThin: "رفيع", borderThick: "عريض", borderColor: "لون الإطار",
    nBg: "لون الكتلة",
    nAccentColor: "لون الكلمة الملوّنة",
    nButtonColor: "لون الزر",
    stylePop: "لَمّة",
    cardAdd: "زر الإضافة للسلة",
    addWide: "زر عريض",
    addPlus: "+ دائري",
    priceColor: "لون السعر",
    addColor: "لون زر + الدائري",
    titlePop: "لَمّة",
    navPill: "لَمّة",
    navBarHint: "تظهر روابطك في شريط تحت رأس الصفحة وفوق أول قسم (مثل: رجالي، نسائي، أطفال). كل رابط ينقل الزائر إلى صفحة في متجرك أو إلى جزء من هذه الصفحة.",
    navSidebarOff: "القائمة الجانبية مخفية، فلا يجد العملاء طريقة للتنقل. أظهرها من إعدادات القائمة الجانبية، أو أضف روابط في الأسفل.",
    navNoLinks: "لا رابط جاهزًا بعد، فلا يرى العملاء أي رابط في رأس الصفحة. أضف رابطًا في الأسفل، واكتب اسمه واختر وجهته.",
    navActive: "لون الرابط المختار",
    navCart: "لون زر السلة",
    footerStyle: "شكل التذييل",
    footerFull: "كامل (بخلفية ملوّنة وأعمدة)",
    footerSimple: "بسيط (بلا تلوين، في صف)",
    bannerVariant: "شكل البنر",
    variantPhoto: "صورة",
    variantCard: "لَمّة",
    cardColor: "لون البطاقة",
    shape: "شكل الصورة",
    shapeArch: "قوس",
    shapeTilt: "مائلة",
    btnColor: "لون الزر",
    linkAsk: "هل تريد حذف هذا الرابط؟",
    colorAuto: "تلقائي",
    colorReset: "إعادة ضبط",
    saleColor: "لون الخصم",
    saleColorHint: "يلوّن شارات الخصم والسعر بعد الخصم والرقم على السلة، كما في المثال تحت الألوان.",
    saleSample: "مثال",
    saleColorAuto: "إعادة ضبط (لون المتجر)",
    linkColor: "لون الرابط",
    heroTextPos: "مكان النص",
    textPosCenter: "على الجانب",
    textPosBottomStart: "أسفل الجانب",
    textPosBottomCenter: "أسفل الوسط",
    textPosHint: "«أسفل الوسط» يخفي صور المنتجات.",
    heroHeight: "ارتفاع الغلاف",
    heightNormal: "عادي",
    heightTall: "طويل",
    heroSize: "مقاس الغلاف",
    sizeW: "العرض",
    sizeH: "الارتفاع",
    sizeLinked: "مرتبطان: يتغير العرض والارتفاع معًا",
    sizeUnlinked: "منفصلان: يتغير كل واحد وحده",
    sizeAuto: "الرجوع إلى المقاس التلقائي",
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
/* Looks that come with a theme of the theme store: offered only once that theme is bought (the store keeps only those, see
   withoutUnboughtLooks in themes.ts). Trying a theme from the theme store shows them in the preview. */
const lockedBy = (themeId: string | undefined): ThemeInfo | null => (themeId && !ownsLook(themeId) ? findTheme(themeId) : null);

/* The fields that are there because of a theme he bought (its layout's own words, pictures and colors): every Part, color and
   choice inside gets the theme's yellow mark */
const FromTheme = createContext<string | undefined>(undefined);
/** A gold * beside an option or a field that comes with a theme he bought from the theme store (free themes have none):
    the same gold as the Theme store button at the top of the designer */
function ThemeMark({ lang, theme, on = false }: { lang?: Lang; theme?: string; on?: boolean }) {
  const t = theme && loadThemeState().owned.some((o) => o.id === theme) ? findTheme(theme) : null;
  if (!t) return null;
  const tip = lang ? popT[lang].fromTheme.replace("{t}", t.name[lang]) : undefined;
  return <span title={tip} aria-label={tip} className={`ms-1 inline-block shrink-0 text-sm font-extrabold leading-none ${on ? "text-[#ffe680]" : "text-[#e6a817] dark:text-[#f8c841]"}`}>*</span>;
}

/* the theme the page uses (or is built over), from the designer: a theme's own options are offered only while it is used */
export const UsingTheme = createContext("");

/** A row of choices. An option with a `theme` is a look of that theme: offered only while the page uses that theme and he owns it. */
function Seg<T extends string>({ value, options: all, onChange, cols = 2, lang }: { value: T; options: { key: T; label: string; theme?: string }[]; onChange: (v: T) => void; cols?: number; lang?: Lang }) {
  /* a look of a theme he does not own is never shown (no lock, no note: nothing about a theme he has not bought). One he owns is
     offered while the page uses that theme, and still shows when his design already uses it. */
  const using = useContext(UsingTheme);
  const options = all.filter((o) => !o.theme || isOwnCopy() || (!lockedBy(o.theme) && (o.theme === using || o.key === value)));
  return (
    <div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(cols, Math.max(1, options.length))}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button key={o.key} type="button" onClick={() => onChange(o.key)} aria-pressed={value === o.key} className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${value === o.key ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
            {o.label}
            <ThemeMark lang={lang} theme={o.theme} on={value === o.key} />
          </button>
        ))}
      </div>
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
/* the store color, for the colors that follow it until he picks one (a perk box's border) */
export const StoreColorNow = createContext("#004956");
/** The page's background and the store color the cover falls back to, so a color box can say when its color vanishes there */
export const PageLookNow = createContext({ bg: "#ffffff", primary: "#004956" });

/** The color of one text: a swatch that opens the color picker and shows the color it has now.
    `auto` is the color the preview draws when nothing is chosen (white on a banner); without it, the store's text color.
    `on` is what the text sits on (one background, or each of the cover's): a chosen color that vanishes there is warned about,
    and the store draws the automatic one instead. */
function ColorChip({ lang, label, value, auto, onChange, onReset, on }: { lang?: Lang; label: string; value: string | undefined; auto?: string; onChange: (v: string) => void; onReset?: () => void; on?: string | string[] }) {
  const now = useContext(TextColorNow);
  const shown = value || auto || now;
  const w = popT[lang ?? "ar"];
  const fromTheme = useContext(FromTheme);
  const vanishes = !!value && on !== undefined && !(Array.isArray(on) ? on : [on]).every((bg) => readsOn(value, bg));
  return (
    <div>
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-semibold text-fg/80">{label}<ThemeMark lang={lang} theme={fromTheme} /></span>
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
    <Bad show={vanishes} text={w.lowContrast} />
    </div>
  );
}

/** A text size with a - and a + (2 px at a time), a box to type any size, and a way back to the theme's own size. */
/** The cover's width and height in px, each with a slider and a box to type in. Linked at first: moving one moves the other
    so the cover keeps its shape; the chain between them separates them. */
type CoverBox = { width?: number; height?: number; unlinked?: boolean };
const COVER = { w: [320, 1600], h: [160, 900] } as const;
function CoverSize({ lang, box, tall, full, onChange }: { lang: Lang; box?: CoverBox; tall: boolean; full: boolean; onChange: (b: CoverBox | undefined) => void }) {
  const pp = popT[lang];
  /* before he changes anything: about the size the cover has on its own */
  const w = box?.width ?? 1200;
  const h = box?.height ?? (tall ? 720 : 300);
  const linked = !box?.unlinked;
  const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.round(Math.min(hi, Math.max(lo, v)));
  const setW = (v: number) => onChange({ ...box, width: clamp(v, COVER.w), height: linked ? clamp((h * v) / w, COVER.h) : h });
  const setH = (v: number) => onChange({ ...box, height: clamp(v, COVER.h), width: linked ? clamp((w * v) / h, COVER.w) : w });
  const row = (label: string, value: number, range: readonly [number, number], set: (v: number) => void, off = false) => (
    <div className={off ? "opacity-50" : ""}>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm font-semibold">
        <span>{label}</span>
        <span dir="ltr" className="flex items-center gap-1 text-xs text-muted">
          <input type="number" min={range[0]} max={range[1]} value={value} disabled={off} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= range[0]) set(v); }} aria-label={label} className="h-8 w-20 rounded-lg border border-fg/15 bg-transparent px-2 text-end text-sm text-fg outline-none focus:border-primary" />
          px
        </span>
      </div>
      <input type="range" min={range[0]} max={range[1]} step={10} value={value} disabled={off} onChange={(e) => set(Number(e.target.value))} aria-label={label} className="h-1.5 w-full cursor-pointer accent-[rgb(var(--primary))]" />
    </div>
  );
  return (
    <div className="space-y-2">
      {/* edge to edge, the cover is as wide as the page */}
      {row(pp.sizeW, w, COVER.w, setW, full)}
      <div className="flex items-center gap-2">
        <span className="h-px flex-1 bg-fg/10" />
        <button type="button" onClick={() => onChange({ ...box, unlinked: linked })} aria-pressed={linked} title={linked ? pp.sizeLinked : pp.sizeUnlinked} aria-label={linked ? pp.sizeLinked : pp.sizeUnlinked} className={`grid h-8 w-8 place-items-center rounded-full border transition ${linked ? "border-primary bg-primary text-white" : "border-fg/15 text-muted hover:text-fg"}`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {linked ? <><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5" /></> : <><path d="M15 7h2a5 5 0 0 1 0 10h-2M9 17H7A5 5 0 0 1 7 7h2" /></>}
          </svg>
        </button>
        <span className="h-px flex-1 bg-fg/10" />
      </div>
      {row(pp.sizeH, h, COVER.h, setH)}
      <p className="text-xs text-muted">{linked ? pp.sizeLinked : pp.sizeUnlinked}</p>
      {box && (box.width || box.height) && (
        <button type="button" onClick={() => onChange(undefined)} className="text-xs font-semibold text-primary hover:underline">{pp.sizeAuto}</button>
      )}
    </div>
  );
}

/** A subtitle's own font (empty: the theme's) */
function SubFontField({ lang, value, onChange }: { lang: Lang; value?: HeroFont; onChange: (v: HeroFont | undefined) => void }) {
  const pp = popT[lang];
  return (
    <Part lang={lang} label={pp.subFont}>
      <FontGrid lang={lang} value={value} onChange={(k) => onChange(k || undefined)} first={pp.titleFontTheme} />
    </Part>
  );
}

/** A section title's own size, color and font (each empty: the theme's) */
function TitleLookFields({ lang, value, onChange }: { lang: Lang; value?: TitleLook; onChange: (v: TitleLook | undefined) => void }) {
  const t = dc[lang];
  const pp = popT[lang];
  const page = useContext(PageLookNow);
  const set = (patch: Partial<TitleLook>) => {
    const next = { ...value, ...patch };
    onChange(Object.values(next).some((x) => x !== undefined) ? next : undefined);
  };
  return (
    <div className="space-y-3">
      <Stepper lang={lang} label={t.luxe.textSize} value={value?.size ?? 24} auto={value?.size === undefined} onChange={(size) => set({ size })} onReset={() => set({ size: undefined })} min={12} max={120} />
      <ColorChip lang={lang} label={t.luxe.textColor} value={value?.color} onChange={(color) => set({ color })} onReset={() => set({ color: undefined })} on={page.bg} />
      <Part lang={lang} label={pp.titleFont}>
        <FontGrid lang={lang} value={value?.font} onChange={(font) => set({ font })} first={pp.titleFontTheme} />
      </Part>
    </div>
  );
}

function Stepper({ lang, label, value, auto, onChange, onReset, min = 10, max = 160 }: { lang: Lang; label: string; value: number; auto: boolean; onChange: (v: number) => void; onReset: () => void; min?: number; max?: number }) {
  const lx = dc[lang].luxe;
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  /* the size right now, so holding − or + keeps counting from the last step */
  const now = useRef(value);
  now.current = value;
  /* the usual size (the theme's): coming back to it by hand is the usual size again, so the change is undone, not a new one */
  const usual = useRef<number | null>(null);
  if (auto) usual.current = value;
  const put = (n: number) => (n === usual.current ? onReset() : onChange(n));
  const go = (d: number) => {
    const next = clamp(now.current + d);
    if (next === now.current) return false;
    now.current = next;
    put(next);
    return true;
  };
  /* press and hold: one step at once, then on and on until let go (or the end of the range) */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  const hold = (d: number) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    stop();
    if (!go(d)) return;
    const again = () => { timer.current = go(d) ? setTimeout(again, 70) : null; };
    timer.current = setTimeout(again, 400);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  };
  /* the keyboard (Enter or Space) still steps once */
  const key = (d: number) => (e: React.MouseEvent) => { if (e.detail === 0) go(d); };
  /* what he is typing; the size changes when he leaves the box or presses Enter, and an empty box goes back to the usual size */
  const [typed, setTyped] = useState<string | null>(null);
  const done = () => {
    if (typed !== null && typed.trim() === "") onReset();
    else if (typed !== null && !Number.isNaN(Number(typed))) put(clamp(Number(typed)));
    setTyped(null);
  };
  const btn = "grid h-9 touch-manipulation select-none place-items-center rounded-lg border border-fg/15 text-base font-bold transition hover:bg-soft disabled:opacity-30 disabled:hover:bg-transparent";
  /* two rows, so every size control lines up the same: its name (and the reset link) above, then − size + across the whole width */
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-fg/80">{label}</span>
        {!auto && <button type="button" onClick={onReset} className="shrink-0 whitespace-nowrap text-xs font-semibold text-primary hover:underline">{lx.sizeReset}</button>}
      </div>
      <div className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center gap-1.5" dir="ltr">
        <button type="button" className={btn} disabled={value <= min} onPointerDown={hold(-1)} onPointerLeave={stop} onClick={key(-1)} onContextMenu={(e) => e.preventDefault()} aria-label={lx.sizeSmaller} title={lx.sizeSmaller}>−</button>
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
        <button type="button" className={btn} disabled={value >= max} onPointerDown={hold(1)} onPointerLeave={stop} onClick={key(1)} onContextMenu={(e) => e.preventDefault()} aria-label={lx.sizeBigger} title={lx.sizeBigger}>+</button>
      </div>
    </div>
  );
}

/** Asks once before a link is deleted: the same red question as deleting an element, under that link. */
function LinkAsk({ lang, onYes, onNo, text }: { lang: Lang; onYes: () => void; onNo: () => void; /* another question than "Delete this link?" */ text?: string }) {
  const t = dc[lang];
  return (
    /* the question on its line, and the two answers side by side under it, the same size */
    <div className="rounded-lg bg-rose-500/10 p-3">
      <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">{text ?? popT[lang].linkAsk}</p>
      <div className="mt-2.5 flex gap-2">
        <button type="button" onClick={onYes} className="inline-flex h-8 flex-1 items-center justify-center rounded-md bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700">{t.deleteYes}</button>
        <button type="button" onClick={onNo} className="inline-flex h-8 flex-1 items-center justify-center rounded-md border border-fg/20 bg-card px-3 text-xs font-semibold transition hover:bg-soft">{t.cancel}</button>
      </div>
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
/** A second button beside the first: "Add another button" until he adds it, then its text and where it leads, with a way to
    remove it again. It opens by itself when he clicks that button in the preview. */
/** Under a hero button's words while they are empty in this language: the store does not show that button (see btnText in sections.tsx) */
function ButtonHiddenNote({ lang }: { lang: Lang }) {
  return <p className="mt-1.5 text-xs font-medium text-muted">{lang === "ar" ? "الزر مخفي ما دام بلا نص" : "The button is hidden while it has no text"}</p>;
}

function MoreButton({ lang, value, onChange, onRemove, children }: { lang: Lang; value: { en: string; ar: string }; onChange: (v: { en: string; ar: string }) => void; onRemove: () => void; children: React.ReactNode }) {
  const pp = popT[lang];
  const focus = useContext(PartFocus);
  const has = !!(value.en.trim() || value.ar.trim());
  const [open, setOpen] = useState(has);
  useEffect(() => {
    if (focus.field === "button2") setOpen(true);
  }, [focus.field, focus.n]);
  if (!open && !has)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 text-sm font-bold text-primary transition hover:bg-primary/10">
        {ic.plus}
        {pp.addButton}
      </button>
    );
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-fg/10 p-3">
      <span className="block text-xs font-semibold text-fg/80">{pp.secondButton}</span>
      <input data-field="button2" value={value[lang]} onChange={(e) => onChange({ ...value, [lang]: e.target.value })} maxLength={60} aria-label={pp.secondButton} autoFocus={!has} className={`${input} h-11`} />
      <CharCount value={value[lang] ?? ""} max={60} />
      <RudeNote lang={lang} text={value[lang]} />
      {!value[lang]?.trim() && <ButtonHiddenNote lang={lang} />}
      {children}
      <button type="button" onClick={() => { onRemove(); setOpen(false); }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:underline">{ic.trash}{pp.removeButton}</button>
    </div>
  );
}

/** Where the store's products are (its products part, see shopTarget): a hero button he never set leads there */
const ShopNow = createContext("");

/** Where a button leads. A button set to nowhere gets a warning (`warn` false: a picture, where nowhere is normal). */
function Leads({ lang, label, value, onChange, warn = true }: { lang: Lang; label: string; value: string; onChange: (v: string) => void; warn?: boolean }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-semibold text-fg/80">{label}</p>
      <LinkPicker lang={lang} value={value} onChange={onChange} label={label} />
      {warn && !value.trim() && (
        <p role="status" className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold leading-relaxed text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
          <span aria-hidden>⚠</span>
          {lang === "ar" ? "هذا الزر لا يأخذ العميل إلى أي مكان. اختر وجهة له." : "This button takes customers nowhere. Choose where it leads."}
        </p>
      )}
    </div>
  );
}

/* The part of the store that was clicked in the preview: the part of the form that holds it opens by itself */
const PartFocus = createContext<{ field?: string; n: number }>({ n: 0 });
/* true: the Parts here are shown open with their names above, not folded (a panel with only a couple of things in it) */
const PartFlat = createContext(false);
/* What part of the store the settings here change (see spotSignal): a Part's field is looked for inside it ("sec:<id>" for a
   block of the page, "footer" for the footer), so opening the Part outlines that text in the preview */
const SpotScope = createContext<string | null>(null);

/** One part of an element (the title, the text, a button...): closed at first, only its name and a ▾. A press opens it:
    its box, and under it the options of that part only (its size, color, font). */
/* Only one block is open at a time on each level: opening one closes the others beside it, so the panel never turns into a long
   tangle. The blocks of a panel share one group; the blocks inside a block have their own group, so opening one of them keeps
   the block around it open. A block with a mistake in it stays open. */
type PartGroupValue = { open: string | null; set: (id: string | null) => void };
const PartGroup = createContext<PartGroupValue | null>(null);
let rootOpen: string | null = null;
const rootListeners = new Set<() => void>();
const setRootOpen = (id: string | null) => {
  rootOpen = id;
  rootListeners.forEach((l) => l());
};
const subscribeRoot = (l: () => void) => {
  rootListeners.add(l);
  return () => void rootListeners.delete(l);
};

function Part({ lang, label, hint, more, field, also, force = false, error, icon, preview, before, after, spot, onOpen, onClose, children }: { lang?: Lang; label: string; /* told when he opens or closes it himself (the cart design shows the cart while open) */ onOpen?: () => void; onClose?: () => void; /* a small picture before the name (a banner's color) */ icon?: React.ReactNode; /* in the name's row, outside the button that folds it */ before?: React.ReactNode; after?: React.ReactNode; hint?: string; more?: React.ReactNode; field?: string; /* other fields that sit inside it and open it too */ also?: string[]; /* opened from outside: the tour points at it */ force?: boolean; error?: string; /* while closed, a short grey look at what is written in it */ preview?: string; /* the part of the store it changes, when it is not its field (see SpotScope) */ spot?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  /* opened by him (its name pressed, or its text clicked in the preview), not by a mistake or the tour: the preview shows where it is */
  const [aimed, setAimed] = useState(false);
  const scope = useContext(SpotScope);
  const spotKey = spot ?? (field ? (scope ? `${scope}:${field}` : field) : undefined);
  useSpotWhile(open && aimed && spotKey ? { key: spotKey, label: label.replace(/ \*$/, "") } : null);
  /* what is inside is made the first time it opens, and then stays so it can slide closed again */
  const [made, setMade] = useState(false);
  const focus = useContext(PartFocus);
  const id = useId();
  const parent = useContext(PartGroup);
  const root = useSyncExternalStore(subscribeRoot, () => rootOpen, () => null);
  const group: PartGroupValue = parent ?? { open: root, set: setRootOpen };
  /* the group of the blocks inside this one */
  const [inner, setInner] = useState<string | null>(null);
  /* the first time, what is inside is made closed and it opens on the next frame, so it slides open like every other time */
  const show = () => {
    setMade(true);
    group.set(id);
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
  };
  const hide = () => {
    setOpen(false);
    if (group.open === id) group.set(null);
  };
  /* another block of the same group opened: this one closes */
  useEffect(() => {
    if (open && group.open !== id && !error) {
      setOpen(false);
      onClose?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.open]);
  useEffect(() => {
    if ((field && focus.field === field) || (focus.field && also?.includes(focus.field))) {
      setAimed(true);
      show();
    }
  }, [field, focus.field, focus.n]);
  /* a part with a mistake in it, or one the tour points at, opens by itself */
  useEffect(() => {
    if (force || error) show();
  }, [force, error]);
  /* while closed nothing inside can be reached with the keyboard */
  const box = useRef<HTMLDivElement>(null);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (open) setMade(true);
    else {
      setSettled(false);
      setAimed(false);
    }
    box.current?.toggleAttribute("inert", !open);
  }, [open]);
  /* a name that ends with * must be filled: the star is red */
  const must = label.endsWith(" *");
  const fromTheme = useContext(FromTheme);
  const flat = useContext(PartFlat);
  if (flat)
    return (
      <div data-part-flat>
        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-fg/80">
          {icon}
          <span className="truncate">{must ? label.slice(0, -2) : label}</span>
          {must && <span className="ms-1 text-rose-600">*</span>}
          <ThemeMark lang={lang} theme={fromTheme} />
        </p>
        <div className="pt-3">
          {/* what is inside folds as usual */}
          <PartFlat.Provider value={false}>
            <PartGroup.Provider value={{ open: inner, set: setInner }}>
              {children}
              {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
              {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
              {more && <div className="mt-3 space-y-3 rounded-xl bg-soft/70 p-3">{more}</div>}
            </PartGroup.Provider>
          </PartFlat.Provider>
        </div>
      </div>
    );
  const head = (
    <button type="button" onClick={() => { if (open) { hide(); onClose?.(); return; } setAimed(true); show(); onOpen?.(); }} aria-expanded={open} className={`flex items-center justify-between gap-2 text-start ${before || after ? "min-w-0 flex-1" : "w-full"}`}>
      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-fg/80">
        {icon}
        <span className="truncate">{must ? label.slice(0, -2) : label}</span>
        {must && <span className="ms-1 text-rose-600">*</span>}
        <ThemeMark lang={lang} theme={fromTheme} />
      </span>
      {preview && !open && <span dir="auto" className="ms-auto min-w-0 max-w-[45%] truncate text-xs font-normal text-muted">{preview}</span>}
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition duration-300 ${open ? "rotate-180 text-primary" : "text-muted"}`}>{ic.chevron}</span>
    </button>
  );
  return (
    <div>
      {/* things beside the name that are not part of the fold (a drag grip, an on/off switch): in the name's row only, so what
          opens below has the whole width */}
      {before || after ? <div className="flex items-center gap-1.5">{before}{head}{after}</div> : head}
      {error && !open && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
      {/* it slides open and fades in, and slides closed again */}
      <div ref={box} onTransitionEnd={(e) => { if (e.target === e.currentTarget && open) setSettled(true); }} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        {/* cut only while it slides: once open, nothing inside is cut (an error under a field, a focus ring) */}
        {/* min-w-0: never wider than the panel, whatever is inside (a cropper's controls pushed it out before) */}
        <div className={`min-h-0 min-w-0 ${open && settled ? "" : "overflow-hidden"}`}>
          {made && (
            <div className="pt-3">
              <PartGroup.Provider value={{ open: inner, set: setInner }}>
                {children}
                {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
                {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
                {more && <div className="mt-3 space-y-3 rounded-xl bg-soft/70 p-3">{more}</div>}
              </PartGroup.Provider>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  A list of things of the same kind (perks, messages, banners, links...): the same rules everywhere                    */
/* ------------------------------------------------------------------ */

/** The list: clear room between its cards, so one ends where the next starts */
function ItemList({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3.5">{children}</div>;
}

/** Under a field with a length limit: how much of it is used ("42/90"), amber near the end, so the text never stops without a word.
    It shows once the text gets past 60% of the limit (`always`: from the first letter). */
function CharCount({ value, max, always }: { value: string; max: number; always?: boolean }) {
  if (!always && value.length < max * 0.6) return null;
  const near = value.length >= max - Math.max(3, Math.round(max * 0.1));
  return <p dir="ltr" aria-live="polite" className={`mt-1 text-end text-[11px] tabular-nums ${near ? "font-semibold text-amber-600 dark:text-amber-300" : "text-muted"}`}>{value.length}/{max}</p>;
}

/** What a list with a limit is called: "Links" beside its count, and the sentence said when it is full (see limitWords) */
type LimitText = { counted: string; full: (n: number) => string };

/** Under a list with a limit: how many it has ("Links: 3/8") and, once it is full, why nothing more can be added. `note`: another
    reason said before it is full (the cover's pictures run out before its colors do) */
function LimitLine({ count, max, words, note }: { count: number; max: number; words: LimitText; note?: string }) {
  const done = count >= max;
  return (
    <p className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted">
      <span className={done || note ? "font-semibold text-amber-700 dark:text-amber-300" : ""}>{done ? words.full(max) : note ?? ""}</span>
      <span className="shrink-0 tabular-nums">{words.counted}: <span dir="ltr">{count}/{max}</span></span>
    </p>
  );
}

/** The add button of a list that can only hold so many: the count beside it ("3/5"), and at the limit the button stays, switched
    off, with the reason under it (instead of disappearing without a word). `onPick`: it chooses picture files instead (the big
    round upload look of the slides and the pictures rows); `compact`: a list inside a card. */
function AddLimited({ count, max, label, words, onAdd, onPick, multiple, compact }: { count: number; max: number; label: string; words: LimitText; onAdd?: () => void; onPick?: (el: HTMLInputElement) => void; multiple?: boolean; compact?: boolean }) {
  const done = count >= max;
  const tone = done ? "cursor-not-allowed border-fg/20 text-muted" : "border-primary/50 bg-primary/5 text-primary hover:bg-primary/10";
  const look = onPick ? `flex w-full items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-start ${tone}` : `flex ${compact ? "h-10" : "h-11"} w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed ${tone}`;
  const inside = onPick ? (
    <>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-white shadow-sm ${done ? "bg-fg/30" : "bg-primary"}`}>{upIcon}</span>
      <span className="text-sm font-bold">{label}</span>
    </>
  ) : (
    <>
      {ic.plus}
      {label}
    </>
  );
  return (
    <div>
      {onPick && !done ? (
        <label className={`${look} cursor-pointer transition focus-within:ring-2 focus-within:ring-primary/40`}>
          <input type="file" multiple={multiple} accept={PICTURE_ACCEPT} className="sr-only" onChange={(e) => onPick(e.currentTarget)} />
          {inside}
        </label>
      ) : (
        <button type="button" disabled={done} onClick={onAdd} className={`${look} text-sm font-bold transition`}>
          {inside}
        </button>
      )}
      <LimitLine count={count} max={max} words={words} />
    </div>
  );
}

/** One thing of a list. Its frame is thicker than the boxes inside it (teal while open), and it folds: closed, it shows its
    own name (what he wrote as its title, or "New …" while empty) and a small picture of it. Inside, each field has its name
    above it and an example in it (see Field), and the remove button comes last. */
function ItemCard({ lang, name, empty, icon, force, extra, end, onRemove, removeLabel, children }: { lang: Lang; /* what he wrote as its title (or link text, message...) */ name?: string; /* shown while that is empty: "New perk" */ empty: string; icon?: React.ReactNode; /* opened from outside (just added) */ force?: boolean; /* beside the name, outside the fold (a drag handle, a show/hide switch) */ extra?: React.ReactNode; /* at the other end of the name row, outside the fold (an on/off switch) */ end?: React.ReactNode; onRemove?: () => void; removeLabel?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-fg/15 bg-card px-3 py-2.5 shadow-sm transition has-[>div>button[aria-expanded=true]]:border-primary/45 has-[>div>div>button[aria-expanded=true]]:border-primary/45">
      {/* the grip and the switch sit in the name's row; what opens below has the whole width of the card */}
      <Part lang={lang} label={name?.trim() || empty} icon={icon} force={force} before={extra} after={end}>
        <div className="space-y-4">
          {children}
          {onRemove && (
            <button type="button" onClick={onRemove} className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-500/40 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10">
              {ic.trash}
              {removeLabel ?? dc[lang].form.removeItem}
            </button>
          )}
        </div>
      </Part>
    </div>
  );
}

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

/* a new tile's or chip's own name (see itemKey in safeDesign.ts) */
const newKey = () => `k${Math.random().toString(36).slice(2, 10)}`;
const newId = (type: string) => `${type}-${Date.now().toString(36)}${Math.floor(Math.random() * 100)}`;
/* A picture just chosen for a list is cropped in its own card: `i` is its place, `before` what Cancel puts back (null: it
   was just added, so Cancel takes it away). A GIF (kept as it is, not redrawn as a JPEG) is not cropped, or it stops moving. */
type Cropping = { i: number; src: string; before: Pick<HeroBg, "image" | "pos"> | null };
const cuttable = (url: string) => url.startsWith("data:image/jpeg");

/** A block's name in the designer's lists: its kind, numbered when the page has more than one of that kind ("Promo banners 2") */
function blockName(s: SectionConfig, all: SectionConfig[], lang: Lang): string {
  const same = all.filter((x) => x.type === s.type);
  return same.length > 1 ? `${dc[lang].elements[s.type]} ${same.indexOf(s) + 1}` : dc[lang].elements[s.type];
}
/** The block's own words that tell it apart: its title, or its first picture's title (empty when it has none) */
function blockTitle(s: SectionConfig, lang: Lang): string {
  const other = lang === "ar" ? "en" : "ar";
  type Words = { en: string; ar: string };
  const st = s.settings as { title?: Words; items?: { title?: Words; label?: Words }[] };
  const bi = st.title && typeof st.title === "object" ? st.title : st.items?.[0]?.title ?? st.items?.[0]?.label;
  const own = (bi?.[lang]?.trim() || bi?.[other]?.trim() || "").replace(/\s+/g, " ");
  /* a title that only repeats the kind's name ("Customer reviews") tells nothing more */
  return own.toLowerCase() === dc[lang].elements[s.type].toLowerCase() ? "" : own;
}

/* `shop`: the store's products part (see shopTarget), where a new block's buttons lead at first */
function defaultSection(type: SectionType, lang: Lang, shop = ""): SectionConfig {
  if (type === "text") return newTextSection(newId("text"));
  if (type === "collection") return newCollection(newId("collection"));
  if (type === "slides") return newSlides(newId("slides"));
  if (type === "tiles") return newTiles(newId("tiles"));
  if (type === "banners") return newBanners(newId("banners"));
  if (type === "ribbon") return newRibbon(newId("ribbon"));
  if (type === "chips") return newChips(newId("chips"), shop);
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

export function PagesPanel({ lang, draft, update, editing, setEditing, focus, onlyElements = false, onSub }: { lang: Lang; draft: Draft; update: Update; editing: string | null; setEditing: (id: string | null) => void; focus: Focus; /* a page of the store has only elements: no header and no footer */ onlyElements?: boolean; /* which screen of the header or footer is open (the designer shows the sidebar open while its settings are) */ onSub?: (sub: string | null) => void }) {
  const t = dc[lang];
  const [open, setOpen] = useState({ header: false, elements: true, footer: false });
  const [picker, setPicker] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [sub, setSub] = useState<SubKey | null>(null);
  useEffect(() => {
    onSub?.(sub);
    return () => onSub?.(null);
  }, [sub, onSub]);
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
    if (s) return <LinkTargets.Provider value={cfg.sections.filter((x) => x.id !== s.id).map((x) => ({ id: x.id, name: blockName(x, cfg.sections, lang) }))}><ShopNow.Provider value={shopTarget(cfg)}><ElementForm lang={lang} section={s} focusField={focus?.id === s.id ? focus.field : undefined} nonce={focus?.n ?? 0} onBack={() => setEditing(null)} onChange={(next) => setSections((all) => all.map((x) => (x.id === s.id ? next : x)))} onDelete={() => { setSections((all) => all.filter((x) => x.id !== s.id)); setEditing(null); }} /></ShopNow.Provider></LinkTargets.Provider>;
  }

  if (sub) {
    return (
      <SubShell lang={lang} title={t.rows[sub]} spot={subSpot[sub]} tag={sub !== "searchCart"} onBack={() => { setSub(null); setFootAsk(null); }}>
        <PartFocus.Provider value={{ field: focus?.id === "footer" ? focus.field : undefined, n: focus?.n ?? 0 }}>
        {sub === "nameLogo" && <NameLogoForm lang={lang} cfg={cfg} setCfg={setCfg} draft={draft} update={update} />}
        {sub === "sidebarSettings" && <SidebarSettingsForm lang={lang} cfg={cfg} setCfg={setCfg} />}
        {sub === "navigation" && <LinkTargets.Provider value={[...cfg.sections.map((x) => ({ id: x.id, name: blockName(x, cfg.sections, lang) })), { id: "footer", name: t.luxe.navFooter }]}><NavigationForm lang={lang} cfg={cfg} setCfg={setCfg} /></LinkTargets.Provider>}
        {sub === "searchCart" && <SearchCartForm lang={lang} cfg={cfg} setCfg={setCfg} />}
        {sub === "announcement" && <LinkTargets.Provider value={cfg.sections.map((x) => ({ id: x.id, name: blockName(x, cfg.sections, lang) }))}><AnnouncementForm lang={lang} cfg={cfg} setCfg={setCfg} /></LinkTargets.Provider>}
        {sub === "footerSettings" && <LinkTargets.Provider value={cfg.sections.map((x) => ({ id: x.id, name: blockName(x, cfg.sections, lang) }))}><FooterForm lang={lang} draft={draft} update={update} ask={footAsk} /></LinkTargets.Provider>}
        </PartFocus.Provider>
      </SubShell>
    );
  }

  return (
    <div>
      {!onlyElements && (
      <Accordion title={t.sectionsTitle.header} info={t.sectionsInfo.header} open={open.header} onToggle={() => setOpen((o) => ({ ...o, header: !o.header }))}>
        <ul>
          {/* Store identity lives in the design options (OptionsPanel) */}
          <RowLink icon={sidebarIcon} label={t.rows.sidebarSettings} onClick={() => setSub("sidebarSettings")} />
          <RowLink icon={navIcon} label={t.rows.navigation} onClick={() => setSub("navigation")} />
          <RowLink icon={searchCartIcon} label={t.rows.searchCart} onClick={() => setSub("searchCart")} />
          <RowLink icon={ic.megaphone} label={t.rows.announcement} onClick={() => setSub("announcement")} />
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
                  {/* names wrap onto a second line instead of being cut ("Featured prod…") */}
                  <span className="flex min-w-0 flex-col gap-0.5 py-0.5 leading-tight">
                    <span className="line-clamp-2 break-words" title={blockName(s, cfg.sections, lang)}>{blockName(s, cfg.sections, lang)}</span>
                    {blockTitle(s, lang) && <span className="line-clamp-2 break-words text-[11px] font-medium text-muted" title={blockTitle(s, lang)}>{blockTitle(s, lang)}</span>}
                  </span>
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
                <DeleteAsk lang={lang} inRow name={blockName(s, cfg.sections, lang)} onYes={() => { setSections((all) => all.filter((x) => x.id !== s.id)); setConfirm(null); }} onNo={() => setConfirm(null)} />
              )}
            </li>
          ))}
        </ul>
        {/* a page with no blocks: say so, and make adding the first one the obvious next step */}
        {cfg.sections.length === 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200">
            <p className="text-sm font-bold">{lang === "ar" ? "هذه الصفحة فارغة" : "This page is empty"}</p>
            <p className="mt-1">{lang === "ar" ? "لا يرى عملاؤك فيها إلا رأس الصفحة وتذييلها. أضف أول عنصر لتبدأ، مثل الغلاف الرئيسي أو شبكة المنتجات." : "Your customers see only the header and the footer. Add your first block to start, like a main cover or a product grid."}</p>
          </div>
        )}
        <button type="button" onClick={() => setPicker(true)} className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition ${cfg.sections.length === 0 ? "bg-primary text-white shadow-sm hover:brightness-110" : "border border-dashed border-primary/60 text-primary hover:bg-primary/5"}`}>
          {ic.plus}
          {cfg.sections.length === 0 ? (lang === "ar" ? "أضف أول عنصر" : "Add your first block") : t.actions.add}
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
            const s = defaultSection(type, lang, shopTarget(cfg));
            setSections((all) => [...all, s]);
            setPicker(false);
            setEditing(s.id);
          }}
        />
      )}
    </div>
  );
}

/* What each kind of block is, in a line, and the other words a merchant may search for it with (both languages are searched,
   whatever the designer's language). Kept with the picker: a new kind of block gets its line, words and sketch here. */
const blockInfo: Record<SectionType, { en: string; ar: string; words: string }> = {
  hero: { en: "The big first block: title, words, buttons and a picture", ar: "أول عنصر كبير: عنوان وكلام وأزرار وصورة", words: "hero banner cover header top intro welcome بانر بنر غلاف هيرو واجهة ترحيب" },
  perks: { en: "Small boxes with icons: fast delivery, safe payment…", ar: "مربعات صغيرة بأيقونات: توصيل سريع، دفع آمن…", words: "features benefits icons trust delivery shipping مزايا ميزات أيقونات توصيل شحن ضمان ثقة" },
  featured: { en: "The products you marked as featured", ar: "المنتجات التي ميّزتها", words: "featured best picks highlight products مميزة مختارة أفضل منتجات" },
  discounts: { en: "Products on sale, with their old price", ar: "المنتجات المخفّضة مع سعرها القديم", words: "sale discount offers deals promo تخفيضات خصم عروض تنزيلات" },
  products: { en: "All your products in a grid, with filters", ar: "كل منتجاتك في شبكة مع فلاتر", words: "catalog shop all products grid list collection كتالوج كل المنتجات شبكة قائمة متجر" },
  text: { en: "A title and a paragraph: about you, a welcome…", ar: "عنوان وفقرة: من أنتم، رسالة ترحيب…", words: "about paragraph story text words content نص فقرة من نحن قصة كلام محتوى" },
  reviews: { en: "What your customers say about you", ar: "ما يقوله عملاؤك عنك", words: "testimonials reviews ratings stars feedback quotes آراء تقييمات نجوم شهادات مراجعات" },
  collection: { en: "A few products you pick by hand", ar: "منتجات قليلة تختارها بنفسك", words: "pinned picked selection collection handpicked مثبتة مختارة مجموعة تشكيلة" },
  slides: { en: "Pictures that slide one after another", ar: "صور تتحرك واحدة بعد الأخرى", words: "slider slideshow carousel gallery animated rotating سلايدر عرض شرائح شرائح كاروسيل متحركة صور" },
  tiles: { en: "A row of pictures, each with a name and a link", ar: "صف صور، لكل صورة اسم ورابط", words: "gallery images categories photos grid tiles معرض صور أقسام فئات" },
  banners: { en: "Big promo pictures with a title and a button", ar: "صور ترويجية كبيرة بعنوان وزر", words: "promo banner ad advertisement campaign بنر بانر إعلان ترويج حملة" },
  ribbon: { en: "A dark strip of short words that scroll", ar: "شريط داكن بكلمات قصيرة متحركة", words: "marquee ticker strip band words scrolling شريط كلمات متحرك نوتات" },
  chips: { en: "Colored quick buttons for your categories", ar: "أزرار سريعة ملوّنة لأقسامك", words: "buttons tags pills categories quick links أزرار وسوم أقسام روابط سريعة" },
  newsletter: { en: "An email box so customers can subscribe", ar: "خانة بريد ليشترك العملاء", words: "newsletter subscribe email signup mailing list نشرة اشتراك بريد إيميل قائمة بريدية" },
};

/** Lower case, without Arabic marks and with one form of alef, ya and ta marbuta, so "سلايدر" and "slider" find the same block */
const searchable = (s: string) =>
  s.toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");

/** A small sketch of how each block looks, in the site's colors: currentColor is the teal, the faint parts follow the text color */
function BlockSketch({ type }: { type: SectionType }) {
  const soft = "fill-fg/10";
  const mid = "fill-fg/25";
  const teal = "fill-current";
  const shapes: Record<SectionType, React.ReactNode> = {
    hero: <><rect x="4" y="4" width="72" height="40" rx="5" className="fill-current opacity-20" /><rect x="10" y="12" width="30" height="5" rx="2" className={teal} /><rect x="10" y="21" width="24" height="3" rx="1.5" className={mid} /><rect x="10" y="31" width="14" height="6" rx="3" className={teal} /><rect x="50" y="10" width="20" height="28" rx="3" className={mid} /></>,
    perks: <>{[4, 30, 56].map((x) => <g key={x}><rect x={x} y="14" width="22" height="20" rx="3" className={soft} /><circle cx={x + 6} cy="24" r="3.5" className={teal} /><rect x={x + 11} y="21" width="8" height="2.5" rx="1" className={mid} /><rect x={x + 11} y="26" width="6" height="2" rx="1" className={soft} /></g>)}</>,
    featured: <>{[4, 30, 56].map((x) => <g key={x}><rect x={x} y="8" width="20" height="22" rx="3" className={mid} /><path d={`M${x + 16} 11l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2-1.5-1.4 2-.3z`} className={teal} /><rect x={x} y="33" width="14" height="3" rx="1.5" className={soft} /><rect x={x} y="38" width="9" height="3" rx="1.5" className={teal} /></g>)}</>,
    discounts: <>{[4, 30, 56].map((x) => <g key={x}><rect x={x} y="8" width="20" height="22" rx="3" className={mid} /><rect x={x + 2} y="10" width="9" height="5" rx="2" className="fill-rose-500" /><rect x={x} y="33" width="9" height="3" rx="1.5" className={teal} /><rect x={x + 11} y="33" width="7" height="3" rx="1.5" className={soft} /></g>)}</>,
    products: <>{[4, 23, 42, 61].flatMap((x) => [6, 27].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="15" height="16" rx="2.5" className={y === 6 ? mid : soft} />))}</>,
    text: <><rect x="20" y="8" width="40" height="5" rx="2" className={teal} /><rect x="12" y="19" width="56" height="3" rx="1.5" className={mid} /><rect x="12" y="25" width="56" height="3" rx="1.5" className={mid} /><rect x="18" y="31" width="44" height="3" rx="1.5" className={mid} /><rect x="26" y="37" width="28" height="3" rx="1.5" className={soft} /></>,
    reviews: <>{[4, 42].map((x) => <g key={x}><rect x={x} y="8" width="34" height="32" rx="4" className={soft} /><path d={`M${x + 5} 15h4v4l-2 3h-2l1.5-3H${x + 5}z`} className={teal} /><rect x={x + 5} y="25" width="24" height="2.5" rx="1" className={mid} /><rect x={x + 5} y="30" width="18" height="2.5" rx="1" className={mid} /></g>)}</>,
    collection: <><rect x="4" y="6" width="22" height="4" rx="2" className={teal} />{[4, 30, 56].map((x) => <g key={x}><rect x={x} y="14" width="20" height="20" rx="3" className={mid} /><circle cx={x + 17} cy="17" r="2" className={teal} /><rect x={x} y="37" width="13" height="3" rx="1.5" className={soft} /></g>)}</>,
    slides: <><rect x="12" y="6" width="56" height="30" rx="4" className={mid} /><rect x="4" y="12" width="6" height="18" rx="2" className={soft} /><rect x="70" y="12" width="6" height="18" rx="2" className={soft} /><circle cx="34" cy="42" r="2" className={teal} /><circle cx="40" cy="42" r="2" className={soft} /><circle cx="46" cy="42" r="2" className={soft} /></>,
    tiles: <>{[4, 23, 42, 61].map((x) => <g key={x}><rect x={x} y="8" width="15" height="24" rx="3" className={mid} /><rect x={x + 2} y="26" width="11" height="4" rx="2" className={teal} /></g>)}</>,
    banners: <><rect x="4" y="8" width="35" height="32" rx="4" className={mid} /><rect x="41" y="8" width="35" height="32" rx="4" className="fill-current opacity-25" /><rect x="8" y="26" width="18" height="3" rx="1.5" className={teal} /><rect x="8" y="32" width="11" height="4" rx="2" className={teal} /><rect x="45" y="26" width="18" height="3" rx="1.5" className={teal} /><rect x="45" y="32" width="11" height="4" rx="2" className={teal} /></>,
    ribbon: <><rect x="0" y="16" width="80" height="16" className="fill-fg/80" />{[6, 30, 54].map((x) => <rect key={x} x={x} y="22" width="16" height="4" rx="2" className="fill-amber-300" />)}{[25, 49].map((x) => <circle key={x} cx={x} cy="24" r="1.5" className="fill-amber-300 opacity-70" />)}</>,
    chips: <>{[[4, 14, "fill-pink-300"], [26, 18, "fill-violet-300"], [48, 12, "fill-amber-300"], [16, 16, "fill-emerald-300"], [38, 20, "fill-sky-300"]].map(([x, w, c], i) => <rect key={i} x={x as number} y={i < 3 ? 12 : 27} width={(w as number) + 6} height="10" rx="5" className={c as string} />)}</>,
    newsletter: <><rect x="4" y="6" width="72" height="36" rx="5" className="fill-current opacity-20" /><rect x="22" y="12" width="36" height="4" rx="2" className={teal} /><rect x="14" y="24" width="36" height="9" rx="4.5" className="fill-card" /><rect x="52" y="24" width="14" height="9" rx="4.5" className={teal} /></>,
  };
  return <svg viewBox="0 0 80 48" className="h-full w-full rtl:-scale-x-100" aria-hidden>{shapes[type]}</svg>;
}

function Picker({ lang, onClose, onPick }: { lang: Lang; onClose: () => void; onPick: (t: SectionType) => void }) {
  const t = dc[lang];
  const [q, setQ] = useState("");
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  /* every word he types must be found in the block's names (both languages), its line or its other words */
  const words = searchable(q).split(/\s+/).filter(Boolean);
  const types = (Object.keys(t.elements) as SectionType[]).filter((k) => {
    const hay = searchable([dc.en.elements[k], dc.ar.elements[k], blockInfo[k].en, blockInfo[k].ar, blockInfo[k].words].join(" "));
    return words.every((w) => hay.includes(w));
  });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-3 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={t.picker.title} className="dash flex max-h-[min(44rem,92vh)] w-full max-w-2xl flex-col rounded-3xl bg-card p-4 text-fg shadow-2xl ring-1 ring-fg/10 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t.picker.title}</h2>
          <button type="button" onClick={onClose} aria-label={t.picker.close} className={roundBtn}>{ic.close}</button>
        </div>
        <label className="relative mt-4 block shrink-0">
          <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted">{ic.search}</span>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.picker.search} aria-label={t.picker.search} className={`${input} h-11 ps-11`} />
        </label>
        {types.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm font-semibold">{t.picker.none}</p>
            <p className="mt-1 text-xs text-muted">{lang === "ar" ? "جرّب كلمة أخرى، مثل: صور، منتجات، نص، آراء." : "Try another word, like: pictures, products, text, reviews."}</p>
            <button type="button" onClick={() => setQ("")} className="mt-3 text-sm font-bold text-primary hover:underline">{lang === "ar" ? "عرض كل العناصر" : "Show all elements"}</button>
          </div>
        ) : (
          <ul className="-mx-1 mt-4 grid min-h-0 grid-cols-2 gap-2.5 overflow-y-auto px-1 pb-1 sm:grid-cols-3 sm:gap-3">
            {types.map((k) => (
              <li key={k}>
                <button type="button" onClick={() => onPick(k)} className="group flex h-full w-full flex-col gap-2 rounded-2xl border border-fg/15 p-2.5 text-start transition hover:border-primary hover:bg-primary/5 sm:p-3">
                  <span className="block aspect-[5/3] w-full rounded-xl bg-soft p-1.5 text-primary transition group-hover:bg-primary/10">
                    <BlockSketch type={k} />
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-bold leading-tight">
                    <span className="shrink-0 text-primary [&_svg]:h-4 [&_svg]:w-4">{ic.types[k]}</span>
                    {t.elements[k]}
                  </span>
                  <span className="text-[11px] leading-snug text-muted">{blockInfo[k][lang]}</span>
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
  /* the preview brings this block into view (it is already outlined as the selected one); its parts point at their own texts */
  useSpotWhile({ key: `sec:${s.id}`, label: t.elements[s.type], ring: false });

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
      <CharCount value={v[lang] ?? ""} max={area ? 600 : 60} />
      <RudeNote lang={lang} text={v[lang]} />
      {extra}
    </Part>
  );

  /* the title's own size, color and font, for the sections whose title is the usual section heading */
  const titleLook = <TitleLookFields lang={lang} value={s.titleLook} onChange={(titleLook) => onChange({ ...s, titleLook })} />;
  const perksStoreColor = useContext(StoreColorNow);
  const shopNow = useContext(ShopNow);
  const page = useContext(PageLookNow);
  const pageText = useContext(TextColorNow);
  const subFont = <SubFontField lang={lang} value={s.subFont} onChange={(subFont) => onChange({ ...s, subFont })} />;
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
      <Stepper lang={lang} label={t.luxe.textSize} value={s.settings.sizes?.[key] ?? defaults[key]} auto={s.settings.sizes?.[key] === undefined} onChange={(v) => setSize(key, v)} onReset={() => setSize(key, undefined)} min={key === "title" ? HERO_TITLE_MIN : undefined} max={key === "title" ? HERO_TITLE_MAX : undefined} />
    );
    const setColor = (key: HeroKey, v: string | undefined) => onChange({ ...s, settings: { ...s.settings, colors: { ...(s.settings.colors ?? {}), [key]: v } } });
    /* the color the preview draws when none is chosen: on the banner the words sit on the first picture or color (white on a dark one), and the button is dark on white */
    const first = s.settings.backgrounds?.[0];
    const onBanner = first?.kind === "image" && first.image ? "#ffffff" : first?.color ? onColor(first.color) : "#ffffff";
    const autoColor = (key: HeroKey) => (split || pop || orbit ? undefined : key === "button" ? "#12262b" : onBanner);
    /* what each text sits on (as the store draws it), so a chosen color that vanishes there is warned about: the page in the pop
       and orbit layouts, the text panel in the split one, every colored picture of the cover (a photo has its own dark fade) */
    const bgsNow = s.settings.backgrounds?.length ? s.settings.backgrounds : [{ kind: "color" as const, color: "", image: "" }];
    const slideBgs = bgsNow.filter((b) => !(b.kind === "image" && b.image)).map((b) => b.color || page.primary);
    const panelBg = s.settings.panelColor || (bgsNow[0].kind === "color" ? bgsNow[0].color || page.primary : page.primary);
    const second = !!s.settings.button2?.[lang]?.trim();
    const sitsOn = (key: HeroKey): string[] =>
      pop ? [key === "eyebrow" ? s.settings.popColors?.sticker || "#ffe36e" : key === "button" ? pageText : page.bg]
      : orbit ? [key === "button" ? s.settings.popColors?.accent || page.primary : page.bg]
      : split ? (key === "button" ? [onColor(panelBg) !== "#ffffff" ? page.primary : "#ffffff", ...(second ? [panelBg] : [])] : [panelBg])
      : key === "button" ? ["#ffffff", ...(second ? slideBgs : [])] : slideBgs;
    const colorChip = (key: HeroKey) => (
      <ColorChip lang={lang} label={t.luxe.textColor} value={s.settings.colors?.[key]} auto={autoColor(key)} onChange={(v) => setColor(key, v)} onReset={() => setColor(key, undefined)} on={sitsOn(key)} />
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
        <FontGrid lang={lang} value={s.settings.titleFont} onChange={(k) => onChange({ ...s, settings: { ...s.settings, titleFont: k ?? "" } })} first={t.luxe.fontDefault} />
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
        {text(s.settings.subtitle, (subtitle) => set({ subtitle }), t.form.subtitle, true, "subtitle", <>{more("subtitle")}{subFont}</>)}
        <Part lang={lang} label={t.form.button} more={more("button")} field="button" also={["button2"]} preview={s.settings.button[lang]?.trim() || undefined}>
          <input data-field="button" value={s.settings.button[lang]} onChange={(e) => set({ button: { ...s.settings.button, [lang]: e.target.value } })} maxLength={60} className={`${input} h-11`} />
          <CharCount value={s.settings.button[lang] ?? ""} max={60} />
          <RudeNote lang={lang} text={s.settings.button[lang]} />
          {!s.settings.button[lang]?.trim() && <ButtonHiddenNote lang={lang} />}
          <Leads lang={lang} label={popT[lang].buttonLeads} value={s.settings.link ?? shopNow} onChange={(link) => set({ link })} />
          <MoreButton lang={lang} value={s.settings.button2 ?? noText} onChange={(button2) => set({ button2 })} onRemove={() => set({ button2: undefined, link2: undefined })}>{link2}</MoreButton>
        </Part>
        {/* the round-photo layout came with a theme that was removed: it is offered only to a design that already uses it */}
        <Part lang={lang} label={t.form.heroLayout} hint={t.form.coverMove}>
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
          </>
        )}
        {pop && (
          <FromTheme.Provider value="lamma">
            {text(s.settings.eyebrow ?? noText, (eyebrow) => set({ eyebrow }), pp.chip, false, "eyebrow", colorChip("eyebrow"))}
            <Part lang={lang} label={pp.accentWord} hint={pp.accentWordHint} more={<ColorChip lang={lang} label={pp.colorAccent} value={s.settings.popColors?.accent} onChange={(accent) => setPop({ accent })} onReset={() => setPop({ accent: undefined })} on={page.bg} />}>
              <input data-field="accentWord" value={(s.settings.accentWord ?? noText)[lang]} onChange={(e) => set({ accentWord: { ...(s.settings.accentWord ?? noText), [lang]: e.target.value } })} maxLength={30} className={`${input} h-11`} />
              <CharCount value={(s.settings.accentWord ?? noText)[lang] ?? ""} max={30} />
            </Part>
            <Part lang={lang} label={pp.sticker} more={<ColorChip lang={lang} label={pp.colorSticker} value={s.settings.popColors?.sticker} onChange={(sticker) => setPop({ sticker })} onReset={() => setPop({ sticker: undefined })} />}>
              <textarea data-field="sticker" value={(s.settings.sticker ?? noText)[lang]} onChange={(e) => set({ sticker: { ...(s.settings.sticker ?? noText), [lang]: e.target.value } })} rows={2} maxLength={30} className={`${input} resize-none py-2.5`} />
              <CharCount value={(s.settings.sticker ?? noText)[lang] ?? ""} max={30} />
              <RudeNote lang={lang} text={(s.settings.sticker ?? noText)[lang]} />
            </Part>
            {photoField(pp.photo1, "3 / 4", "999px 999px 26px 26px", 1200)}
            <Part lang={lang} label={pp.photo2}>
              <div data-field="photo2" className="space-y-3"><PhotoPicker lang={lang} value={s.settings.photo2 ?? ""} onChange={(photo2) => set({ photo2, photo2Pos: undefined })} max={1200} /><PictureMover lang={lang} image={s.settings.photo2 ?? ""} value={s.settings.photo2Pos} onChange={(photo2Pos) => set({ photo2Pos })} ratio="3 / 4" radius="22px" /></div>
            </Part>
            <ColorChip lang={lang} label={pp.colorBlob} value={s.settings.popColors?.blob} onChange={(blob) => setPop({ blob })} onReset={() => setPop({ blob: undefined })} />
          </FromTheme.Provider>
        )}
        {orbit && (
          <>
            {text(s.settings.eyebrow ?? noText, (eyebrow) => set({ eyebrow }), pp.kickerLatin, false, "eyebrow", more("eyebrow"))}
            <Part lang={lang} label={pp.accentWord} hint={pp.accentWordHint} more={<ColorChip lang={lang} label={pp.colorGold} value={s.settings.popColors?.accent} onChange={(accent) => setPop({ accent })} onReset={() => setPop({ accent: undefined })} on={page.bg} />}>
              <input data-field="accentWord" value={(s.settings.accentWord ?? noText)[lang]} onChange={(e) => set({ accentWord: { ...(s.settings.accentWord ?? noText), [lang]: e.target.value } })} maxLength={40} className={`${input} h-11`} />
              <CharCount value={(s.settings.accentWord ?? noText)[lang] ?? ""} max={40} />
            </Part>
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
            <HeroBackgrounds lang={lang} id={s.id} settings={s.settings} onChange={(settings) => onChange({ ...s, settings })} />
          </Part>
        )}
        {/* the plain banner: where the words sit, how big it is and edge to edge. With another layout they stay, greyed out, saying why */}
        {(() => {
          const notBanner = split || pop || orbit;
          const onlyBanner = why(lang, `غير متاح لأن «${t.form.heroLayout}» ليس «${t.form.layoutBanner}».`, `Not available because “${t.form.heroLayout}” isn't “${t.form.layoutBanner}”.`);
          const bottomMid = s.settings.textPos === "bottom-center";
          const cardsWhy = notBanner ? onlyBanner : bottomMid ? why(lang, `غير متاح لأن «${pp.heroTextPos}» هو «${pp.textPosBottomCenter}».`, `Not available because “${pp.heroTextPos}” is “${pp.textPosBottomCenter}”.`) : "";
          return (
            <>
              <Blocked when={notBanner} why={onlyBanner}>
                <Part lang={lang} label={pp.heroTextPos} hint={pp.textPosHint}>
                  <Seg value={s.settings.textPos ?? "center"} cols={3} onChange={(textPos) => set({ textPos })} options={[{ key: "center", label: pp.textPosCenter }, { key: "bottom-start", label: pp.textPosBottomStart }, { key: "bottom-center", label: pp.textPosBottomCenter }]} />
                </Part>
              </Blocked>
              <Blocked when={notBanner} why={onlyBanner}>
                <Part lang={lang} label={pp.heroSize}>
                  <CoverSize lang={lang} box={s.settings.box} tall={s.settings.height === "tall"} full={!!s.settings.fullWidth} onChange={(box) => set({ box })} />
                </Part>
              </Blocked>
              <Blocked when={pop || orbit} why={why(lang, `غير متاح لأن «${t.form.heroLayout}» هو «${pop ? pp.layoutPop : pp.layoutOrbit}».`, `Not available because “${t.form.heroLayout}” is “${pop ? pp.layoutPop : pp.layoutOrbit}”.`)}>
                <Toggle on={full} onChange={(fullWidth) => set({ fullWidth })} label={pp.heroFullWidth} />
              </Blocked>
              {/* the product cards show only on the plain banner with its words at the side (the same test as the storefront's Hero) */}
              <Blocked when={notBanner || bottomMid} why={cardsWhy}>
                <Toggle on={s.settings.showCards ?? true} onChange={(showCards) => set({ showCards })} label={t.form.showCards} />
              </Blocked>
            </>
          );
        })()}
        {/* the cards' own settings: under their switch (greyed out with it when it can't apply), greyed out while the switch is off */}
        {!split && !pop && !orbit && s.settings.textPos !== "bottom-center" && (
          <Blocked when={!(s.settings.showCards ?? true)} why={why(lang, `غير متاح لأن «${t.form.showCards}» مُطفأ.`, `Not available because “${t.form.showCards}” is off.`)}>
            {/* everything about the product cards beside the words, in one place (how they sit and their frame were taken
                out: he moves the cards himself in the preview) */}
            <Part lang={lang} label={pp.productsCard} field="cards">
              <div className="space-y-4">
                <p className="text-xs leading-relaxed text-muted">{lang === "ar" ? "تظهر البطاقات على الشاشات العريضة، لا على الهاتف." : "The cards show on wide screens, not on phones."}</p>
                <HeroCards lang={lang} ids={s.settings.cardIds} onChange={(cardIds) => set({ cardIds })} />
                <Part lang={lang} label={t.form.cardsShape}>
                  <Seg value={s.settings.cardLook?.shape ?? "portrait"} cols={3} onChange={(shape) => set({ cardLook: { ...s.settings.cardLook, shape } })} options={[{ key: "portrait", label: t.form.shapePortrait }, { key: "square", label: t.form.shapeSquare }, { key: "round", label: t.form.shapeRound }]} />
                </Part>
                <Toggle on={s.settings.cardLook?.showName ?? true} onChange={(showName) => set({ cardLook: { ...s.settings.cardLook, showName } })} label={t.form.cardsName} />
              </div>
            </Part>
          </Blocked>
        )}
      </>
    );
  } else if (s.type === "featured" || s.type === "discounts") {
    /* the title and how many, both shown open; Featured products also has its products to pick */
    body = (
      <PartFlat.Provider value={true}>
        <ProductsPageNote lang={lang} kind={s.type} />
        {s.type === "featured" && (
          <ProductChecklist lang={lang} ids={s.settings.productIds ?? []} onChange={(productIds) => onChange({ ...s, settings: { ...s.settings, productIds } })} hint={t.form.featuredHint} empty={t.form.featuredEmpty} />
        )}
        {text(s.settings.title, (title) => onChange({ ...s, settings: { ...s.settings, title } } as SectionConfig), t.form.title, false, "title", titleLook)}
        <Part lang={lang} label={t.form.count}>
          <div className="flex gap-2">
            {[2, 3, 4, 6, 8].map((n) => (
              <button key={n} type="button" onClick={() => onChange({ ...s, settings: { ...s.settings, count: n } } as SectionConfig)} aria-pressed={s.settings.count === n} className={`h-10 flex-1 rounded-xl border text-sm font-semibold transition ${s.settings.count === n ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
                {n}
              </button>
            ))}
          </div>
        </Part>
      </PartFlat.Provider>
    );
  } else if (s.type === "products") {
    body = (
      <>
        {text(s.settings.title, (title) => onChange({ ...s, settings: { ...s.settings, title } }), t.form.title, false, "title", titleLook)}
        <GridProducts lang={lang} s={s} onChange={onChange} />
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
        {text(s.settings.title, (title) => onChange({ ...s, settings: { ...s.settings, title } }), t.form.title, false, "title", titleLook)}
        <p className="rounded-xl bg-soft px-4 py-3 text-xs leading-relaxed text-muted">{t.form.reviewsHint}</p>
        {/* each review folds up under the customer's name, with its stars beside it */}
        <ItemList>
          {items.map((r, i) => (
            <ItemCard
              key={i}
              lang={lang}
              name={r.name}
              empty={itemWords[lang].newReview}
              icon={<span aria-hidden className="flex h-7 shrink-0 items-center gap-0.5 rounded-lg bg-amber-400/15 px-1.5 text-xs font-bold text-amber-600">★{r.stars}</span>}
              onRemove={() => onChange({ ...s, settings: { ...s.settings, items: items.filter((_, j) => j !== i) } })}
              removeLabel={t.form.removeReview}
            >
              <Field label={t.form.reviewName}>
                <input value={r.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder={itemWords[lang].reviewNamePh} aria-label={t.form.reviewName} maxLength={40} className={`${input} h-10`} />
                <CharCount value={r.name} max={40} />
                <RudeNote lang={lang} text={r.name} />
              </Field>
              <Field label={t.form.reviewText}>
                <textarea value={r.text} onChange={(e) => setItem(i, { text: e.target.value })} placeholder={itemWords[lang].reviewTextPh} aria-label={t.form.reviewText} rows={3} maxLength={240} className={`${input} resize-none py-2.5`} />
                <CharCount value={r.text} max={240} />
                <RudeNote lang={lang} text={r.text} />
              </Field>
              <Field label={t.form.reviewStars}>
                <div className="flex items-center gap-1" role="group" aria-label={t.form.reviewStars}>
                  {([1, 2, 3, 4, 5] as const).map((n) => (
                    <button key={n} type="button" onClick={() => setItem(i, { stars: n })} aria-label={`${n}`} aria-pressed={r.stars === n} className="p-0.5">
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill={n <= r.stars ? "#f5b301" : "#d1d5db"} aria-hidden>
                        <path d="m12 3 2.600 5.400 5.900.8-4.300 4.100 1 5.800L12 16.300 6.800 19.100l1-5.800L3.500 9.200l5.900-.8L12 3Z" />
                      </svg>
                    </button>
                  ))}
                </div>
              </Field>
            </ItemCard>
          ))}
        </ItemList>
        <AddLimited count={items.length} max={12} label={t.form.addReview} words={limitWords[lang].reviews} onAdd={() => onChange({ ...s, settings: { ...s.settings, items: [...items, { name: "", text: "", stars: 5 }] } })} />
      </>
    );
  } else if (s.type === "text") {
    const set = (patch: Partial<typeof s.settings>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
    const statement = s.settings.style === "statement";
    type TextKey = "title" | "body" | "eyebrow" | "button";
    const defaults: Record<TextKey, number> = { title: statement ? 56 : 24, body: statement ? 18 : 15, eyebrow: 22, button: 15 };
    /* one alignment per text: a block saved with the old block-wide "center" shows it on the texts that have none of their own, and the
       first change writes it into each text, so pressing a button again really goes back to the usual start */
    const oldCenter = !statement && s.settings.align === "center";
    const shownStyle = (k: Exclude<TextKey, "button">) => (oldCenter && (k === "title" || k === "body") ? { ...s.settings.styles?.[k], align: s.settings.styles?.[k]?.align ?? ("center" as const) } : s.settings.styles?.[k]);
    const setStyle = (k: Exclude<TextKey, "button">, v: TextStyle) => {
      const styles = { ...(s.settings.styles ?? {}) };
      if (oldCenter) for (const f of ["title", "body"] as const) styles[f] = { ...styles[f], align: styles[f]?.align ?? "center" };
      set({ styles: { ...styles, [k]: v }, ...(oldCenter ? { align: "start" as const } : {}) });
    };
    const more = (k: TextKey) => (
      <>
        {k !== "button" && <StyleBar lang={lang} value={shownStyle(k)} onChange={(v) => setStyle(k as Exclude<TextKey, "button">, v)} boldNow={k === "title"} />}
        <Stepper lang={lang} label={t.luxe.textSize} value={s.settings.sizes?.[k] ?? defaults[k]} auto={s.settings.sizes?.[k] === undefined} onChange={(v) => set({ sizes: { ...(s.settings.sizes ?? {}), [k]: v } })} onReset={() => set({ sizes: { ...(s.settings.sizes ?? {}), [k]: undefined } })} />
        <ColorChip lang={lang} label={t.luxe.textColor} value={s.settings.colors?.[k]} onChange={(v) => set({ colors: { ...(s.settings.colors ?? {}), [k]: v } })} onReset={() => set({ colors: { ...(s.settings.colors ?? {}), [k]: undefined } })} />
      </>
    );
    body = (
      <>
        {text(s.settings.title, (title) => set({ title }), t.form.title, false, "title", more("title"))}
        {text(s.settings.body, (b) => set({ body: b }), t.form.body, true, "body", <>{more("body")}{subFont}</>)}
        {/* The centered statement came with a theme that was removed: a design that already uses it keeps it, and can go back to the plain one */}
        {s.settings.style === "statement" && <Part lang={lang} label={popT[lang].textStyle}>
          <Seg lang={lang} value={s.settings.style ?? "plain"} onChange={(style) => set({ style })} options={[{ key: "plain", label: popT[lang].textPlain }, { key: "statement", label: popT[lang].textStatement }]} />
        </Part>}
        {s.settings.style === "statement" && (
          <>
            {text(s.settings.eyebrow ?? noText, (eyebrow) => set({ eyebrow }), popT[lang].textEyebrow, false, "eyebrow", more("eyebrow"))}
            {text(s.settings.button ?? noText, (button) => set({ button }), popT[lang].textButton, false, "button", more("button"), <Leads lang={lang} label={popT[lang].textLeads} value={s.settings.link ?? ""} onChange={(link) => set({ link })} />)}
            <Part lang={lang} label={popT[lang].trustTitle}>
              <div data-field="trust" className="space-y-3.5">
                <ItemList>
                  {(s.settings.trust ?? []).map((x, i) => (
                    <ItemCard
                      key={i}
                      lang={lang}
                      name={x[lang]?.trim() || x[lang === "ar" ? "en" : "ar"]}
                      empty={itemWords[lang].newPromise}
                      onRemove={() => set({ trust: (s.settings.trust ?? []).filter((_, j) => j !== i) })}
                      removeLabel={popT[lang].trustRemove}
                    >
                      <Field label={itemWords[lang].promise}>
                        <input value={x[lang] ?? ""} onChange={(e) => set({ trust: (s.settings.trust ?? []).map((y, j) => (j === i ? { ...y, [lang]: e.target.value } : y)) })} placeholder={itemWords[lang].promisePh} maxLength={40} aria-label={popT[lang].trustTitle} className={`${input} h-10`} />
                        <CharCount value={x[lang] ?? ""} max={40} />
                        <RudeNote lang={lang} text={x[lang]} />
                      </Field>
                    </ItemCard>
                  ))}
                </ItemList>
                <AddLimited compact count={(s.settings.trust ?? []).length} max={5} label={popT[lang].trustAdd} words={limitWords[lang].promises} onAdd={() => set({ trust: [...(s.settings.trust ?? []), { en: "", ar: "" }] })} />
              </div>
            </Part>
          </>
        )}
        <Blocked when={s.settings.style === "statement"} why={why(lang, `غير متاح لأن «${popT[lang].textStyle}» هو «${popT[lang].textStatement}».`, `Not available because “${popT[lang].textStyle}” is “${popT[lang].textStatement}”.`)}>
          <Toggle on={s.settings.tint} onChange={(tint) => set({ tint })} label={t.form.tint} />
        </Blocked>
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
    const storeColor = perksStoreColor;
    const setItem = (i: number, patch: Partial<Perk>) => onChange({ ...s, settings: { ...s.settings, items: items.map((p, j) => (j === i ? { ...p, ...patch } : p)) } });
    const icons: PerkIcon[] = ["truck", "shield", "returns", "gift", "clock", "chat"];
    body = (
      <>
        <p className="text-sm font-bold text-black dark:text-white">{popT[lang].perks}</p>
        {/* each perk folds up on its own: its icon and name in the row, everything else inside */}
        <ItemList>
          {items.map((p, i) => (
            <ItemCard
              key={i}
              lang={lang}
              name={p.title[lang]?.trim() || p.title[lang === "ar" ? "en" : "ar"]}
              empty={popT[lang].perkNew}
              icon={<span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary/10 text-primary [&_svg]:h-4 [&_svg]:w-4">{p.icon === "image" && p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : storeIcons[p.icon as PerkIcon]}</span>}
              onRemove={() => onChange({ ...s, settings: { ...s.settings, items: items.filter((_, j) => j !== i) } })}
            >
              {/* the words first, each with its name and an example; the icon under them */}
              <Field label={t.form.title}>
                <input value={p.title[lang]} onChange={(e) => setItem(i, { title: { ...p.title, [lang]: e.target.value } })} placeholder={popT[lang].perkTitlePh} aria-label={t.form.itemTitle} maxLength={40} className={`${input} h-10`} />
                <CharCount value={p.title[lang] ?? ""} max={40} />
                <RudeNote lang={lang} text={p.title[lang]} />
              </Field>
              <Field label={t.form.subtitle}>
                <input value={p.desc[lang]} onChange={(e) => setItem(i, { desc: { ...p.desc, [lang]: e.target.value } })} placeholder={popT[lang].perkSubPh} aria-label={t.form.subtitle} maxLength={60} className={`${input} h-10`} />
                <CharCount value={p.desc[lang] ?? ""} max={60} />
                <RudeNote lang={lang} text={p.desc[lang]} />
              </Field>
              <Field label={popT[lang].perkIcon}>
                <IconChoice lang={lang} value={p.icon} image={p.image} onPick={(icon) => setItem(i, { icon })} onImage={(image) => setItem(i, { icon: "image", image })} />
              </Field>
            </ItemCard>
          ))}
        </ItemList>
        <AddLimited count={items.length} max={4} label={t.form.addItem} words={limitWords[lang].items} onAdd={() => onChange({ ...s, settings: { ...s.settings, items: [...items, { icon: "gift", title: { en: "", ar: "" }, desc: { en: "", ar: "" } }] } })} />
        <Part lang={lang} label={popT[lang].perksLook}>
          <div className="space-y-4">
            <Field label={t.form.align}>
              {/* left, middle or right as he sees them (in Arabic the row reads from the right, so Right comes first); an older "start" is the side the words begin on */}
              <Seg
                cols={3}
                value={s.settings.align === "center" || s.settings.align === "left" || s.settings.align === "right" ? s.settings.align : lang === "ar" ? "right" : "left"}
                onChange={(align) => onChange({ ...s, settings: { ...s.settings, align } })}
                options={(lang === "ar" ? (["right", "center", "left"] as const) : (["left", "center", "right"] as const)).map((k) => ({ key: k, label: { left: lang === "ar" ? "يسار" : "Left", center: lang === "ar" ? "وسط" : "Center", right: lang === "ar" ? "يمين" : "Right" }[k] }))}
              />
            </Field>
            <Field label={popT[lang].perksBg}>
              <FillPicker lang={lang} value={s.settings.cardBg ?? ""} fallback="#ffffff" onChange={(cardBg) => onChange({ ...s, settings: { ...s.settings, cardBg: cardBg || undefined } })} label={popT[lang].perksBg} list={["#ffffff", "#f6f3ee", "#e6f4f1", "#12262b", storeColor]} />
            </Field>
            <Field label={popT[lang].perksBorder}>
              <Seg value={s.settings.border ?? "thin"} cols={3} onChange={(border) => onChange({ ...s, settings: { ...s.settings, border } })} options={[{ key: "none", label: popT[lang].borderNone }, { key: "thin", label: popT[lang].borderThin }, { key: "thick", label: popT[lang].borderThick }]} />
            </Field>
            <Blocked when={s.settings.border === "none"} why={why(lang, `غير متاح لأن «${popT[lang].perksBorder}» هو «${popT[lang].borderNone}».`, `Not available because “${popT[lang].perksBorder}” is “${popT[lang].borderNone}”.`)}><ColorChip lang={lang} label={popT[lang].borderColor} value={s.settings.borderColor} auto={storeColor} onChange={(borderColor) => onChange({ ...s, settings: { ...s.settings, borderColor } })} onReset={() => onChange({ ...s, settings: { ...s.settings, borderColor: undefined } })} /></Blocked>
          </div>
        </Part>
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
        <SpotScope.Provider value={`sec:${s.id}`}>
          <div className="divide-y divide-fg/10 px-4 [&>*]:py-5">{body}</div>
        </SpotScope.Provider>
      </PartFocus.Provider>

      {/* Deleting the element: the last thing in its form */}
      <div className="border-t border-fg/10 p-4">
        {asking ? (
          <DeleteAsk lang={lang} boxRef={askBox} name={t.elements[s.type]} onYes={onDelete} onNo={() => setAsking(false)} />
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

/* ------------------------------------------------------------------ */
/*  Design options                                                     */
/* ------------------------------------------------------------------ */

/** The website background: none, a picture or GIF, or a looping video. */
function PageBackground({ lang, draft, update }: { lang: Lang; draft: Draft; update: Update }) {
  const t = dc[lang].pageBg;
  const bg = draft.config.pageBackground;
  const url = useMediaUrl(bg.kind === "none" ? "" : bg.media);
  const [problem, setProblem] = useState("");
  /* a picture that was taken but is very small: a warning, not a refusal */
  const [small, setSmall] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof bg>) => update((d) => ({ ...d, config: { ...d.config, pageBackground: { ...d.config.pageBackground, ...patch } } }));
  /* a still picture is cropped right after it is chosen: the page shows the cut as he moves it, "Done" keeps it, Cancel puts
     back the background that was there before */
  const [pending, setPending] = useState<{ id: string; src: string } | null>(null);
  const before = useRef(bg);
  const saving = useRef<ReturnType<typeof setTimeout>>();
  const store = (id: string, url: string) =>
    fetch(url)
      .then((r) => r.blob())
      .then(async (blob) => ((await putMedia(id, blob)) ? blob.size : 0));
  useEffect(
    () => () => {
      /* leaving the panel while cropping keeps the last cut, which is already being saved */
      clearTimeout(saving.current);
      if (pending) setLiveMedia(pending.id, null);
    },
    [pending],
  );

  const take = async (file: File | undefined) => {
    if (!file || editLocked()) return;
    /* what the file really is, from its bytes */
    const check = await checkImage(file, imageRules.background);
    if ("problem" in check) return setProblem(uploadProblemFor(check.problem, imageRules.background, lang));
    const isVideo = check.kind === "mp4" || check.kind === "webm";
    setSmall(smallPictureNote(check.w, check.h, imageRules.background, lang));
    setBusy(true);
    /* a still picture is redrawn: right way up, without its hidden data (EXIF, GPS) */
    let media: Blob = file;
    if (!isVideo && !check.animated) {
      const picked = await pickPicture(file, imageRules.background, 2400, "image/jpeg", 0.85);
      if ("problem" in picked) {
        setBusy(false);
        return setProblem(uploadProblemFor(picked.problem, imageRules.background, lang));
      }
      media = await (await fetch(picked.url)).blob();
      const id = `bg-${Date.now().toString(36)}`;
      const ok = await putMedia(id, media);
      setBusy(false);
      if (!ok) return setProblem(t.failed);
      setProblem("");
      before.current = bg;
      setLiveMedia(id, picked.url);
      set({ kind: "image", media: id, name: cleanFileName(file.name), size: media.size, pos: undefined });
      setPending({ id, src: picked.url });
      return;
    }
    const id = `bg-${Date.now().toString(36)}`;
    const ok = await putMedia(id, media);
    setBusy(false);
    if (!ok) return setProblem(t.failed);
    setProblem("");
    if (bg.media) void deleteMedia(bg.media);
    set({ kind: isVideo ? "video" : "image", media: id, name: cleanFileName(file.name), size: media.size, pos: undefined });
  };

  if (pending) {
    const { id } = pending;
    const old = before.current;
    return (
      <ImageCropper
        lang={lang}
        src={pending.src}
        shapes={["original", "wide"]}
        out={2400}
        type="image/jpeg"
        onLive={(url) => {
          setLiveMedia(id, url);
          clearTimeout(saving.current);
          saving.current = setTimeout(() => void store(id, url).then((size) => size && set({ size })), 600);
        }}
        onCancel={() => {
          clearTimeout(saving.current);
          setPending(null);
          setLiveMedia(id, null);
          void deleteMedia(id);
          set({ ...old });
        }}
        onDone={async (url) => {
          clearTimeout(saving.current);
          const size = await store(id, url);
          setPending(null);
          setLiveMedia(id, null);
          if (old.media && old.media !== id) void deleteMedia(old.media);
          if (size) set({ size });
        }}
      />
    );
  }

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
          <input type="file" accept={`${PICTURE_ACCEPT},video/mp4,video/webm`} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void take(f); }} />
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
            <input type="file" accept={`${PICTURE_ACCEPT},video/mp4,video/webm`} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void take(f); }} />
            {busy ? "…" : t.replace}
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
      <PicNoteLine note={problem ? { tone: "error", text: problem } : small ? { tone: "warn", text: small } : null} />
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

/** The preview with sample products, from the designer (null: not offered, the store has products of its own) */
export const SampleProducts = createContext<{ on: boolean; set: (on: boolean) => void } | null>(null);

/** The switch that fills the preview with sample products, so the cards and the product page can be seen and styled */
function SampleSwitch({ lang }: { lang: Lang }) {
  const s = useContext(SampleProducts);
  if (!s) return null;
  return (
    <div className="mb-3 rounded-xl bg-primary/[0.07] p-3">
      <Toggle on={s.on} onChange={s.set} label={lang === "ar" ? "معاينة بمنتجات تجريبية" : "Preview with sample products"} />
      <p className="mt-1 text-[11px] leading-relaxed text-muted">{lang === "ar" ? "متجرك بلا منتجات بعد. اعرض منتجات تجريبية لترى البطاقات وصفحة المنتج، في هذه المعاينة فقط ولا تُحفظ." : "Your store has no products yet. Show sample products to see the cards and the product page. Only in this preview, never saved."}</p>
    </div>
  );
}

/* What the discount color paints, drawn small under its colors: a discount badge, a price after a discount (with the old price
   beside it, which keeps the text color) and the number on the basket. No color of his own: the store color, and the price
   stays in the text color, like the store does. */
function DiscountSample({ lang, color, store, text }: { lang: Lang; color?: string; store: string; text?: string }) {
  const fill = color || store || "#004956";
  const ink = legibleOn(text || "#1c1a17", "#ffffff");
  const ar = lang === "ar";
  return (
    <div aria-hidden className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2.5 text-[#1c1a17]">
      <span className="text-[11px] font-semibold text-muted">{popT[lang].saleSample}</span>
      <span className="flex items-center gap-3">
        <span className="rounded-full px-2 py-0.5 text-[11px] font-extrabold" style={{ background: fill, color: onColor(fill) }} dir="ltr">-20%</span>
        <span dir="ltr" className="flex items-baseline gap-1.5">
          <span className="text-sm font-extrabold" style={{ color: color ? inkOn(color, "#ffffff", ink) : ink }}>{ar ? "١٥ د.أ" : "15 JOD"}</span>
          <s className="text-[13px] font-medium" style={{ color: dimOn(ink, "#ffffff", 70), textDecorationThickness: 1.5 }}>{ar ? "١٩ د.أ" : "19 JOD"}</s>
        </span>
        <span className="relative grid h-8 w-8 place-items-center rounded-full border border-line text-[#1c1a17]">
          {storeIcons.bag}
          <span className="absolute -end-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-extrabold" style={{ background: fill, color: onColor(fill) }}>{ar ? "٢" : "2"}</span>
        </span>
      </span>
    </div>
  );
}

export function OptionsPanel({ lang, draft, update, attn, ask, cart, product }: { lang: Lang; draft: Draft; update: Update; attn?: string | null; /* the preview shows the cart open (on), and a way to open or close it there */ cart?: { on: boolean; show: (on: boolean) => void }; /* the same for the product page */ product?: (on: boolean) => void; /* a screen something asked for: Store identity (a click on the logo or name in the preview, a save problem) or Product card (a click on a card) */ ask?: OptionsScreen | null }) {
  const t = dc[lang].options;
  const th = draft.config.theme;
  const lx = dc[lang].luxe;
  const set = (patch: Partial<StorefrontConfig["theme"]>) => update((d) => ({ ...d, config: { ...d.config, theme: { ...d.config.theme, ...patch } } }));
  const setCfg: SetCfg = (fn) => update((d) => ({ ...d, config: fn(d.config) }));
  /* Store identity (name, logo, store color...) is the first screen of the design options */
  const [screen, setScreen] = useState<OptionsScreen | "sections" | null>(ask ?? null);
  useEffect(() => {
    if (ask) setScreen(ask);
  }, [ask]);
  if (screen === "identity") {
    return (
      <SubShell lang={lang} title={dc[lang].rows.nameLogo} spot={subSpot.nameLogo} onBack={() => setScreen(null)}>
        <NameLogoForm lang={lang} cfg={draft.config} setCfg={setCfg} draft={draft} update={update} />
      </SubShell>
    );
  }
  /* Product card: everything about how a product shows in a list, in one screen */
  if (screen === "cards") {
    return (
      <SubShell lang={lang} title={cardWord[lang]} onBack={() => setScreen(null)}>
      <div>
        <SampleSwitch lang={lang} />
        <p className="mb-2 text-sm font-semibold">{t.cards}</p>
        {(["showName", "showCategory", "showPrice", "showOldPrice", "showBadge", "showStock", "showAdd"] as const).map((k) => (
          <Toggle key={k} on={draft.config.cards[k]} onChange={(v) => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, [k]: v } } }))} label={t[k]} />
        ))}
        <Toggle on={draft.config.cards.showNotes} onChange={(v) => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, showNotes: v } } }))} label={lx.showNotes} />
      </div>
      <Part lang={lang} label={lx.cardInfo}>
        <Seg value={draft.config.cards.info ?? "stack"} onChange={(info) => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, info } } }))} cols={3} options={[{ key: "stack", label: lx.infoStack }, { key: "row", label: lx.infoRow }, { key: "center", label: popT[lang].infoCenter }]} />
      </Part>
      <Blocked when={!(draft.config.cards.showAdd ?? true)} why={why(lang, `غير متاح لأن «${t.showAdd}» مُطفأ.`, `Not available because “${t.showAdd}” is off.`)}>
        <Part lang={lang} label={popT[lang].cardAdd}>
          <Seg value={draft.config.cards.add ?? "wide"} onChange={(add) => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, add } } }))} options={[{ key: "wide", label: popT[lang].addWide }, { key: "plus", label: popT[lang].addPlus }]} />
        </Part>
      </Blocked>
      <Part lang={lang} label={popT[lang].saleColor} hint={popT[lang].saleColorHint}>
        <ColorPicker value={th.saleColor || (th.primary || draft.identity.color)} onChange={(saleColor) => set({ saleColor })} label={popT[lang].saleColor} bad={dc[lang].identity.hexBad} list={["#d9534f", "#e11d48", "#c0392b", "#e08a1e", "#161616", "#004956"]} />
        <DiscountSample lang={lang} color={th.saleColor} store={th.primary || draft.identity.color} text={th.text} />
        {th.saleColor && (
          <button type="button" onClick={() => set({ saleColor: "" })} className="mt-3 text-sm font-semibold text-primary hover:underline">
            {popT[lang].saleColorAuto}
          </button>
        )}
      </Part>
      <ColorChip lang={lang} label={popT[lang].priceColor} value={draft.config.cards.priceColor || undefined} onChange={(priceColor) => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, priceColor } } }))} onReset={() => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, priceColor: "" } } }))} />
      <Blocked when={!(draft.config.cards.showAdd ?? true) || draft.config.cards.add !== "plus"} why={!(draft.config.cards.showAdd ?? true) ? why(lang, `غير متاح لأن «${t.showAdd}» مُطفأ.`, `Not available because “${t.showAdd}” is off.`) : why(lang, `غير متاح لأن «${popT[lang].cardAdd}» ليس «${popT[lang].addPlus}».`, `Not available because “${popT[lang].cardAdd}” isn't “${popT[lang].addPlus}”.`)}><ColorChip lang={lang} label={popT[lang].addColor} value={draft.config.cards.addColor} auto="#b9f3d0" onChange={(addColor) => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, addColor } } }))} onReset={() => update((d) => ({ ...d, config: { ...d.config, cards: { ...d.config.cards, addColor: undefined } } }))} /></Blocked>
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
      </SubShell>
    );
  }
  /* Sections: everything that changes the sections' titles, in one screen */
  if (screen === "sections") {
    return (
      <SubShell lang={lang} title={sectionsWord[lang]} onBack={() => setScreen(null)}>
      <Part lang={lang} label={lx.headingFont}>
        <FontGrid lang={lang} value={th.headingFont} onChange={(k) => set({ headingFont: k ?? "" })} first={lx.sameAsFont} firstFamily={fontFamily[th.font] ?? fontFamily.readex} />
      </Part>
      {/* the ornament titles came with a theme that was removed: offered only to a design that already uses them */}
      <Part lang={lang} label={lx.titleStyle}>
        <Seg lang={lang} value={th.titleStyle ?? "bold"} onChange={(titleStyle) => set({ titleStyle })} cols={2} options={[{ key: "bold", label: lx.titleBold }, { key: "light", label: lx.titleLight }, { key: "pop", label: popT[lang].titlePop, theme: "lamma" }, ...(th.titleStyle === "ornament" ? [{ key: "ornament" as const, label: popT[lang].titleOrnament }] : [])]} />
      </Part>
      {/* the ornament look always centers its titles */}
      <Blocked when={th.titleStyle === "ornament"} why={why(lang, `غير متاح لأن «${lx.titleStyle}» هو «${popT[lang].titleOrnament}».`, `Not available because “${lx.titleStyle}” is “${popT[lang].titleOrnament}”.`)}>
        <Part lang={lang} label={lx.titleAlign}>
          <Seg value={th.titleAlign ?? "start"} onChange={(titleAlign) => set({ titleAlign })} options={[{ key: "start", label: lx.alignStart }, { key: "center", label: lx.alignCenter }]} />
        </Part>
      </Blocked>
      <div>
      <Part lang={lang} label={t.titles}>
        <ColorPicker value={th.titleColor || th.text} onChange={(titleColor) => set({ titleColor })} label={t.titles} bad={dc[lang].identity.hexBad} list={["#004956", "#348d9c", "#1f7a4d", "#2f6fde", "#d9534f", "#e08a1e", "#7a3ea1", "#161616"]} />
        {th.titleColor && (
          <button type="button" onClick={() => set({ titleColor: "" })} className="mt-3 text-sm font-semibold text-primary hover:underline">
            {t.sameAsText}
          </button>
        )}
      </Part>
      <Bad show={!!th.titleColor && !readsOn(th.titleColor, th.background)} text={popT[lang].lowContrast} />
      </div>
      <Part lang={lang} label={lx.sectionTitleSize}>
        <Stepper lang={lang} label={lx.textSize} value={th.sectionTitleSize ?? (th.titleStyle === "light" ? 34 : th.titleStyle === "pop" || th.titleStyle === "ornament" ? 44 : 24)} auto={th.sectionTitleSize === undefined} min={14} max={80} onChange={(sectionTitleSize) => set({ sectionTitleSize })} onReset={() => set({ sectionTitleSize: undefined })} />
      </Part>
      </SubShell>
    );
  }
  return (
    <div className="divide-y divide-fg/10 px-4 [&>*]:py-5">
      <h2 className="font-bold text-black dark:text-white">{t.title}</h2>
      <ul className="!py-2">
        <RowLink icon={nameLogoIcon} label={dc[lang].rows.nameLogo} onClick={() => setScreen("identity")} />
        <RowLink icon={sectionsIcon} label={sectionsWord[lang]} onClick={() => setScreen("sections")} />
        <RowLink icon={cardIcon} label={cardWord[lang]} onClick={() => setScreen("cards")} />
      </ul>
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
      {/* outside the boxes, so it shows while he changes the background too */}
      <Bad show={!readsOn(th.text, th.background)} text={popT[lang].lowContrastText} />
      </div>
      <Part lang={lang} label={t.font}>
        <FontGrid lang={lang} value={th.font ?? "readex"} onChange={(k) => k && set({ font: k as ThemeFont })} text />
      </Part>
      <Toggle on={!!th.hairlines} onChange={(hairlines) => set({ hairlines })} label={popT[lang].hairlines} />
      <Part lang={lang} label={lx.spacing}>
        <Seg value={th.spacing ?? "normal"} onChange={(spacing) => set({ spacing })} options={[{ key: "normal", label: lx.spaceNormal }, { key: "airy", label: lx.spaceAiry }]} />
      </Part>
      {/* opening the cart design opens the cart in the preview, so he sees what he changes; and it opens by itself when the preview shows the cart */}
      <Part lang={lang} label={cartT[lang].title} hint={cartT[lang].hint} force={!!cart?.on} onOpen={() => cart?.show(true)} onClose={() => cart?.show(false)}>
        <div className="grid grid-cols-2 gap-2">
          {cartStyles.map((r) => (
            <button key={r} type="button" onClick={() => update((d) => ({ ...d, config: { ...d.config, cart: { style: r } } }))} aria-pressed={(draft.config.cart?.style ?? "drawer") === r} className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-start text-xs font-semibold transition ${(draft.config.cart?.style ?? "drawer") === r ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
              {cartT[lang].kinds[r][0]}
              <span className="text-[11px] font-normal text-muted">{cartT[lang].kinds[r][1]}</span>
            </button>
          ))}
        </div>
      </Part>
      <div data-section="productPage">
      {/* opens by itself when the page menu shows the product page */}
      <Part lang={lang} force={attn === "productPage"} label={productPageT[lang].title} hint={productPageT[lang].hint} onOpen={() => product?.(true)} onClose={() => product?.(false)}>
        <div className="grid grid-cols-2 gap-2">
          {productPageStyles.map((r) => (
            <button key={r} type="button" onClick={() => update((d) => ({ ...d, config: { ...d.config, productPage: { style: r } } }))} aria-pressed={(draft.config.productPage?.style ?? "classic") === r} className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-start text-xs font-semibold transition ${(draft.config.productPage?.style ?? "classic") === r ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
              {productPageT[lang].kinds[r][0]}
              <span className="text-[11px] font-normal text-muted">{productPageT[lang].kinds[r][1]}</span>
            </button>
          ))}
        </div>
      </Part>
      </div>
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

/* Where each wording shows in the store (the "no products" words show to customers only, in an empty store: no place to point at) */
const wordingSpot: Partial<Record<keyof StorefrontConfig["texts"], string>> = { search: "search", viewAll: "viewall" };

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
      {/* An empty field shows the store's own wording faintly, so he sees what customers read. ("allFilter" is kept in saved designs but not offered: the store no longer has an "All" filter row.) */}
      {(["search", "viewAll", "noProducts"] as const).map((k) => (
        <Part lang={lang} key={k} label={t[k]} preview={tx[k][lang] || storeCopy[lang][k]} spot={wordingSpot[k]}>
          <input value={tx[k][lang]} onChange={(e) => set(k, e.target.value)} placeholder={storeCopy[lang][k]} maxLength={60} className={`${input} h-11`} />
          <CharCount value={tx[k][lang] ?? ""} max={60} />
          <RudeNote lang={lang} text={tx[k][lang]} />
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
  const [problem, setProblem] = useState<PicNote>(null);
  const [over, setOver] = useState(false);
  /* the chosen picture, waiting to be cropped */
  const [pending, setPending] = useState("");
  /* the picture there was before he started cropping (the preview shows the cut one meanwhile) */
  const before = useRef<string | undefined>(undefined);

  const take = async (f: File | undefined) => {
    if (!f) return;
    /* kept bigger than the result, so cropping closer stays sharp */
    const picked = await pickPicture(f, imageRules.picture, Math.max(1024, size), "image/png");
    setProblem(pickedNote(picked, imageRules.picture, lang));
    /* a moving GIF or WebP is kept as it is: cropping would redraw it and stop it */
    if ("url" in picked && !picked.url.startsWith("data:image/png")) return onImage(picked.url);
    if ("url" in picked) {
      before.current = current;
      setPending(picked.url);
    }
  };

  /* While he crops, the store preview already shows the cut picture; Cancel puts back what was there (or nothing) */
  const canGoBack = before.current !== undefined || !!onRemove;
  const goBack = () => (before.current !== undefined ? onImage(before.current) : onRemove?.());
  if (pending) return <div className="space-y-2"><PicNoteLine note={problem} /><ImageCropper lang={lang} src={pending} shapes={shapes} out={size} onLive={onImage} onCancel={() => { setPending(""); if (canGoBack) goBack(); }} onDone={(url) => { setPending(""); onImage(url); }} /></div>;

  return (
    <div>
      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]); }}
        className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition focus-within:ring-2 focus-within:ring-primary/40 ${over ? "border-primary bg-primary/15" : "border-primary/50 bg-primary/5 hover:bg-primary/10"}`}
      >
        <input type="file" accept={PICTURE_ACCEPT} aria-label={words[0]} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void take(f); }} />
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
      {problem && <div className="mt-2"><PicNoteLine note={problem} /></div>}
    </div>
  );
}

/** Icons for the perks: sample icons with their names, or his own picture. */
function IconChoice({ lang, value, image, onPick, onImage }: { lang: Lang; value: PerkIcon | "image"; image?: string; onPick: (i: PerkIcon) => void; onImage: (url: string) => void }) {
  const own = value === "image" && !!image;
  /* the ready icon it had before his picture: Cancel or Remove puts it back */
  const lastIcon = useRef<PerkIcon>(value === "image" ? "truck" : value);
  if (value !== "image") lastIcon.current = value;
  const t = dc[lang].form;
  const list: PerkIcon[] = ["truck", "shield", "returns", "gift", "clock", "chat"];
  return (
    <div className="min-w-0 flex-1 space-y-3">
      {!own && <div className="grid grid-cols-3 gap-2">
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
      </div>}
      <UploadBox lang={lang} current={own ? image : undefined} onImage={onImage} onRemove={() => onPick(lastIcon.current)} size={256} spec={t.sizes.perk} words={t.ups.icon} />
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
  /* the marks in the store's color, with white or dark on them (whichever reads), as the store shows them: white on a
     light color would barely show */
  const color = HEXISH.test(draft.identity.color) ? draft.identity.color : "#004956";
  return (
    <div className="space-y-3" style={{ ["--sf-primary" as string]: color, ["--sf-on" as string]: onColor(color) }}>
      {/* with his own picture as the logo, the ready-made marks are hidden (removing the picture brings them back) */}
      {logo.kind !== "image" && <div className="flex flex-wrap items-center gap-2">
        {/* "my logo from setup" only when setup has one: without it, it is the first letter, the same as the next tile */}
        {setupLogo && (
          <button type="button" onClick={() => set({ kind: "auto" })} aria-pressed={logo.kind === "auto"} title={t.identity.logoAuto} aria-label={t.identity.logoAuto} className={pick(logo.kind === "auto")}>
            <LogoMark logo={resolveLogo({ ...logo, kind: "auto" }, setupLogo)} name={name} className="h-8 w-8 rounded-lg text-sm ring-1 ring-black/15" />
          </button>
        )}
        <button type="button" onClick={() => set({ kind: "letter" })} aria-pressed={logo.kind === "letter" || (logo.kind === "auto" && !setupLogo)} title={t.identity.logoLetter} aria-label={t.identity.logoLetter} className={pick(logo.kind === "letter" || (logo.kind === "auto" && !setupLogo))}>
          <LogoMark logo={{ ...logo, kind: "letter" }} name={name} className="h-8 w-8 rounded-lg text-sm ring-1 ring-black/15" />
        </button>
        {markKeys.map((k: MarkKey) => (
          <button key={k} type="button" onClick={() => set({ kind: "sample", sample: k })} aria-pressed={logo.kind === "sample" && logo.sample === k} aria-label={popT[lang].sampleMarks[k]} title={popT[lang].sampleMarks[k]} className={pick(logo.kind === "sample" && logo.sample === k)}>
            <span className="grid h-8 w-8 place-items-center rounded-lg ring-1 ring-black/15" style={{ background: "var(--sf-primary)", color: "var(--sf-on)" }}>
              <svg {...icon} className="h-4 w-4">{sampleMarks[k]}</svg>
            </span>
          </button>
        ))}
      </div>}
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
  /* how the tab looks comes first, so it stays in sight while the picture is cut below it (the cutter shows each move in it) */
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs text-muted">{t.identity.tabPreview}</p>
        <div className="flex w-56 max-w-full items-center gap-2 rounded-t-xl bg-soft px-3 py-2 text-xs">
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} alt="" className="h-4 w-4 shrink-0 object-contain" />
          ) : (
            <span className="h-4 w-4 shrink-0 rounded-sm bg-fg/20" />
          )}
          <span className="truncate font-medium">{draft.identity.name || "…"}</span>
        </div>
      </div>
      <UploadBox lang={lang} current={icon || undefined} onImage={set} onRemove={() => set("")} size={64} spec={t.form.sizes.favicon} words={t.form.ups.favicon} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero banner backgrounds: add, order, and set how they change       */
/* ------------------------------------------------------------------ */

type HeroSettings = Extract<SectionConfig, { type: "hero" }>["settings"];

/** Which products stand on the cards beside the cover's text (up to 3, in his order) */
/* `ids` undefined: never picked, so the cards show the first products. Picked and then all taken off: no cards. */
function HeroCards({ lang, ids, onChange }: { lang: Lang; ids?: number[]; onChange: (ids: number[] | undefined) => void }) {
  const w = popT[lang];
  const [products, setProducts] = useState<{ id: number; name: string; category: string }[]>([]);
  useEffect(() => setProducts(readProducts()), []);
  const on = (ids ?? []).filter((id) => products.some((p) => p.id === id));
  const toggle = (id: number) => onChange(on.includes(id) ? on.filter((x) => x !== id) : on.length >= 3 ? on : [...on, id]);
  return (
    <Part lang={lang} label={w.cardsPick} hint={w.cardsHint} field="cards">
      {products.length === 0 ? (
        <div className="rounded-xl bg-soft px-4 py-4 text-sm text-muted">
          <p>{dc[lang].form.collectionNone}</p>
          <a href="/products" target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-primary hover:underline">{dc[lang].form.addProducts}</a>
        </div>
      ) : (
        <>
          <p className="mb-2 text-xs font-semibold text-primary">{on.length} / 3 {w.cardsPicked}</p>
          {ids && on.length === 0 && (
            <div className="mb-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs text-muted">
              <p>{w.cardsNone}</p>
              <button type="button" onClick={() => onChange(undefined)} className="mt-1 font-semibold text-primary hover:underline">{w.cardsAuto}</button>
            </div>
          )}
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

/* The words of the lists that fold item by item (reviews, promises, cover backgrounds, header links, bar messages, animated
   pictures): the name of a new one, and an example in each field */
const itemWords = {
  en: {
    newReview: "New review", reviewNamePh: "For example: Lina from Amman", reviewTextPh: "For example: Fast delivery and the quality is great",
    newPromise: "New promise", promise: "Promise", promisePh: "For example: Free returns",
    order: "Order", like: "For example:",
    newLink: "New link", linkTextPh: "For example: New arrivals",
    newMessage: "New message", messagePh: "For example: Free delivery on orders over 30 JOD",
    newSlide: "New picture", picture: "Picture", to: "To:", place: "Where it sits in the frame",
  },
  ar: {
    newReview: "رأي جديد", reviewNamePh: "مثال: لينا من عمّان", reviewTextPh: "مثال: توصيل سريع والجودة ممتازة",
    newPromise: "ميزة جديدة", promise: "الميزة", promisePh: "مثال: إرجاع مجاني",
    order: "الترتيب", like: "مثال:",
    newLink: "رابط جديد", linkTextPh: "مثال: وصلنا حديثًا",
    newMessage: "رسالة جديدة", messagePh: "مثال: توصيل مجاني للطلبات فوق 30 دينار",
    newSlide: "صورة جديدة", picture: "صورة", to: "إلى:", place: "مكانها في الإطار",
  },
};

/* The lists with a limit: their name beside the count and what is said when one is full (see LimitLine). In Arabic the noun after
   the number is plural from 3 to 10 ("8 روابط") and singular from 11 ("12 رأيًا"). */
const arCount = (n: number, plural: string, one: string) => `${n} ${n >= 3 && n <= 10 ? plural : one}`;
const enLimit = (counted: string, things: string): LimitText => ({ counted, full: (n) => `You can add up to ${n} ${things}` });
const arLimit = (counted: string, plural: string, one: string): LimitText => ({ counted, full: (n) => `يمكنك إضافة ${arCount(n, plural, one)} كحد أقصى` });
const limitWords: Record<Lang, Record<"messages" | "reviews" | "promises" | "items" | "links" | "pictures" | "backgrounds" | "banners" | "words" | "buttons" | "columns", LimitText>> = {
  en: {
    messages: enLimit("Messages", "messages"), reviews: enLimit("Reviews", "reviews"), promises: enLimit("Promises", "promises"), items: enLimit("Items", "items"),
    links: enLimit("Links", "links"), pictures: enLimit("Pictures", "pictures"), backgrounds: enLimit("Backgrounds", "backgrounds"), banners: enLimit("Banners", "banners"),
    words: enLimit("Words", "words"), buttons: enLimit("Buttons", "buttons"), columns: enLimit("Your columns", "columns of your own"),
  },
  ar: {
    messages: arLimit("الرسائل", "رسائل", "رسالةً"), reviews: arLimit("الآراء", "آراء", "رأيًا"), promises: arLimit("الوعود", "وعود", "وعدًا"), items: arLimit("العناصر", "عناصر", "عنصرًا"),
    links: arLimit("الروابط", "روابط", "رابطًا"), pictures: arLimit("الصور", "صور", "صورةً"), backgrounds: arLimit("الخلفيات", "خلفيات", "خلفيةً"), banners: arLimit("البنرات", "بنرات", "بنرًا"),
    words: arLimit("الكلمات", "كلمات", "كلمةً"), buttons: arLimit("الأزرار", "أزرار", "زرًّا"), columns: arLimit("أعمدتك", "أعمدة خاصة بك", "عمودًا خاصًا بك"),
  },
};
/* the cover's pictures run out before its backgrounds do: colors can still be added */
const coverPicsFull = { en: (n: number) => `You can use up to ${n} pictures. You can still add colors.`, ar: (n: number) => `يمكنك استخدام ${arCount(n, "صور", "صورةً")} كحد أقصى، ويمكنك إضافة ألوان.` };
/* moving one up or down its list, inside its card */
const orderBtn = "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-fg/15 text-xs font-semibold transition hover:bg-soft disabled:opacity-30 disabled:hover:bg-transparent";

function HeroBackgrounds({ lang, id, settings, onChange }: { lang: Lang; id: string; settings: HeroSettings; onChange: (s: HeroSettings) => void }) {
  const t = dc[lang].form;
  const list: HeroBg[] = settings.backgrounds?.length ? settings.backgrounds : [{ kind: "color", color: "", image: "" }];
  const [bad, setBad] = useState<PicNote>(null);
  const set = (backgrounds: HeroBg[]) => onChange({ ...settings, backgrounds });
  /* the slide he changes is the one the preview shows */
  const edit = (i: number, patch: Partial<HeroBg>) => {
    set(list.map((b, j) => (j === i ? { ...b, ...patch } : b)));
    showSlide(id, i);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const n = [...list];
    [n[i], n[j]] = [n[j], n[i]];
    set(n);
  };
  const photos = list.filter((b) => b.kind === "image").length;
  /* the picture just chosen is cropped in its own card; the cover shows each cut as he moves it */
  const [crop, setCrop] = useState<Cropping | null>(null);

  const pickPhoto = async (file: File | undefined, i: number) => {
    if (!file) return;
    const { url, note } = await readPicture(file, lang);
    setBad(note);
    if (!url) return;
    const old = list[i];
    if (old) edit(i, { image: url, pos: undefined });
    else {
      set([...list, { kind: "image", color: "", image: url }]);
      showSlide(id, i);
    }
    if (cuttable(url)) setCrop({ i, src: url, before: old ? { image: old.image, pos: old.pos } : null });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">{t.backgroundsHint}</p>

      {/* each background folds up under its own title (or what it is: a picture, a color, the store color), with a look at it */}
      <ItemList>
        {list.map((b, i) => (
          /* touching a slide's card shows that slide in the preview */
          <div key={i} onClickCapture={() => showSlide(id, i)} onFocusCapture={() => showSlide(id, i)}>
          <ItemCard
            lang={lang}
            name={b.title?.[lang]?.trim() || (b.kind === "image" ? t.bgPicture : b.color ? t.bgColor : t.bgStoreColor)}
            empty={t.bgPicture}
            icon={
              <span
                aria-hidden
                className="h-7 w-11 shrink-0 rounded-md ring-1 ring-black/10"
                style={{ background: b.kind === "image" && b.image ? `center / cover url(${b.image})` : b.color || `linear-gradient(120deg, ${draftColor}, color-mix(in srgb, ${draftColor} 62%, #6fe3cf))` }}
              />
            }
            force={crop?.i === i}
            onRemove={list.length > 1 ? () => set(list.filter((_, j) => j !== i)) : undefined}
            removeLabel={t.removeBg}
          >
            {list.length > 1 && (
              <Field label={itemWords[lang].order}>
                <div className="flex gap-2">
                  <button type="button" className={orderBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={dc[lang].actions.up} title={dc[lang].actions.up}>{ic.up}{dc[lang].actions.up}</button>
                  <button type="button" className={orderBtn} disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={dc[lang].actions.down} title={dc[lang].actions.down}>{ic.down}{dc[lang].actions.down}</button>
                </div>
              </Field>
            )}
            {b.kind === "color" ? (
              <Field label={t.bgColor}>
                <div className="space-y-2">
                  <FillPicker lang={lang} value={b.color} fallback={draftColor} onChange={(color) => edit(i, { color })} label={t.bgColor} list={bgSwatches} />
                  {b.color && (
                    <button type="button" onClick={() => edit(i, { color: "" })} className="text-sm font-semibold text-primary hover:underline">
                      {t.useStoreColor}
                    </button>
                  )}
                </div>
              </Field>
            ) : (
              <Field label={t.bgPicture}>
                {crop?.i === i ? (
                  <ImageCropper
                    lang={lang}
                    src={crop.src}
                    shapes={["wide", "original"]}
                    out={1600}
                    type="image/jpeg"
                    onLive={(image) => edit(i, { image })}
                    onCancel={() => {
                      setCrop(null);
                      if (crop.before) edit(i, crop.before);
                      else set(list.filter((_, j) => j !== i));
                    }}
                    onDone={(image) => {
                      setCrop(null);
                      edit(i, { image });
                    }}
                  />
                ) : (
                  <div className="space-y-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-primary/60 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/5 focus-within:ring-2 focus-within:ring-primary/40">
                      <input type="file" accept={PICTURE_ACCEPT} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pickPhoto(f, i); }} />
                      {b.image ? ic.swap : ic.plus}
                      {t.ups.cover[b.image ? 1 : 0]}
                      {!b.image && <span className="text-xs font-normal text-muted">({t.sizes.banner.split(" (")[0]})</span>}
                    </label>
                    {b.image && <PictureMover lang={lang} image={b.image} value={b.pos} onChange={(pos) => edit(i, { pos })} fill ratio="16 / 7" radius="12px" />}
                  </div>
                )}
              </Field>
            )}
            {list.length > 1 && (
              <Part lang={lang} label={popT[lang].slideWords} hint={popT[lang].slideWordsHint}>
                <div className="space-y-3">
                  {(["title", "subtitle", "button"] as const).map((k) => {
                    const name = k === "title" ? popT[lang].slideTitle : k === "subtitle" ? popT[lang].slideText : popT[lang].slideButton;
                    return (
                      <Field key={k} label={name}>
                        {/* empty: the cover's main words show, so they are the example */}
                        <input value={b[k]?.[lang] ?? ""} onChange={(e) => edit(i, { [k]: { ...(b[k] ?? { en: "", ar: "" }), [lang]: e.target.value } })} placeholder={settings[k][lang] ? `${itemWords[lang].like} ${settings[k][lang]}` : undefined} aria-label={name} maxLength={k === "subtitle" ? 140 : 60} className={`${input} h-10`} />
                        <CharCount value={b[k]?.[lang] ?? ""} max={k === "subtitle" ? 140 : 60} />
                        <RudeNote lang={lang} text={b[k]?.[lang]} />
                      </Field>
                    );
                  })}
                  <Leads lang={lang} label={popT[lang].slideLeads} value={b.link ?? ""} onChange={(link) => edit(i, { link })} warn={false} />
                </div>
              </Part>
            )}
          </ItemCard>
          </div>
        ))}
      </ItemList>

      {/* up to 6 backgrounds, of which 4 pictures: a button that can't add more stays, switched off, and the line under says why */}
      <div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={list.length >= 6} onClick={() => { set([...list, { kind: "color", color: nextColor(list), image: "" }]); showSlide(id, list.length); }} className="flex items-center gap-2 rounded-xl border border-dashed border-primary/60 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:border-fg/20 disabled:text-muted disabled:hover:bg-transparent">
            {ic.plus}
            {t.addColor}
          </button>
          {list.length < 6 && photos < 4 ? (
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-primary/60 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5 focus-within:ring-2 focus-within:ring-primary/40">
              <input type="file" accept={PICTURE_ACCEPT} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pickPhoto(f, list.length); }} />
              {ic.plus}
              {t.addPicture}
            </label>
          ) : (
            <button type="button" disabled className="flex cursor-not-allowed items-center gap-2 rounded-xl border border-dashed border-fg/20 px-4 py-2.5 text-sm font-semibold text-muted">
              {ic.plus}
              {t.addPicture}
            </button>
          )}
        </div>
        <LimitLine count={list.length} max={6} words={limitWords[lang].backgrounds} note={photos >= 4 ? coverPicsFull[lang](4) : undefined} />
      </div>
      <PicNoteLine note={bad} />
      <p className="flex items-start gap-1.5 text-xs text-muted">
        <svg viewBox="0 0 24 24" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 4v16" /></svg>
        <span><b className="font-semibold text-fg">{t.sizeLabel}:</b> {t.sizes.banner}</span>
      </p>
      <p className="text-xs text-muted">{t.picturesNote}</p>

      {list.length > 1 && (
        <div className="space-y-3 rounded-xl bg-soft/70 p-3">
          <Toggle on={settings.autoplay ?? true} onChange={(autoplay) => onChange({ ...settings, autoplay })} label={t.autoplay} />
          <Blocked when={!(settings.autoplay ?? true)} why={why(lang, `غير متاح لأن «${t.autoplay}» مُطفأ.`, `Not available because “${t.autoplay}” is off.`)}>
            <Field label={t.every}>
              <SecondsPicker value={settings.seconds || 5} onChange={(n) => onChange({ ...settings, seconds: n })} unit={t.seconds} />
            </Field>
          </Blocked>
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

/** Which products the Product grid shows: all of them, the ones in categories he ticks, or the ones he picks (in his order) */
function GridProducts({ lang, s, onChange }: { lang: Lang; s: Extract<SectionConfig, { type: "products" }>; onChange: (s: SectionConfig) => void }) {
  const t = dc[lang].form;
  const set = (patch: Partial<typeof s.settings>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
  const source = s.settings.source ?? "all";
  const chosen = (s.settings.categories ?? []).filter((c) => c.trim());
  const ids = s.settings.productIds ?? [];
  const [cats, setCats] = useState<string[] | null>(null);
  const [live, setLive] = useState(0);
  const idsKey = ids.join(",");
  useEffect(() => {
    const products = readProducts();
    setCats(storeCategories(products, lang));
    setLive(ids.filter((id) => products.some((p) => p.id === id)).length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, idsKey]);
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  /* a ticked category that no product has any more stays listed, so it can be unticked */
  const offered = [...(cats ?? []), ...chosen.filter((c) => !(cats ?? []).some((x) => same(x, c)))];
  const tick = (c: string) => set({ categories: chosen.some((x) => same(x, c)) ? chosen.filter((x) => !same(x, c)) : [...chosen, c] });
  const limit = s.settings.limit ?? 0;
  return (
    <Part lang={lang} label={t.gridSource}>
      <div className="space-y-3">
        <Seg value={source} cols={3} onChange={(v) => set({ source: v as "all" | "categories" | "picked" })} options={[{ key: "all", label: t.gridAll }, { key: "categories", label: t.gridCategories }, { key: "picked", label: t.gridPicked }]} />
        {source === "all" && <p className="text-xs text-muted">{t.gridAllHint}</p>}
        {source === "categories" && (
          <div>
            <p className="text-sm font-bold text-black dark:text-white">{t.gridCats}</p>
            <p className="mt-0.5 text-xs text-muted">{t.gridCatsHint}</p>
            {cats && offered.length === 0 ? (
              <div className="mt-3 rounded-xl bg-soft px-4 py-4 text-sm text-muted">
                <p>{t.gridCatsNone}</p>
                <a href="/products" target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-primary hover:underline">{t.addProducts}</a>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {offered.map((c) => {
                  const on = chosen.some((x) => same(x, c));
                  const gone = !(cats ?? []).some((x) => same(x, c));
                  return (
                    <button key={c} type="button" aria-pressed={on} onClick={() => tick(c)} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${on ? "border-primary bg-primary text-white" : "border-fg/15 hover:bg-soft"} ${gone ? "line-through opacity-70" : ""}`}>
                      <bdi>{c}</bdi>
                    </button>
                  );
                })}
              </div>
            )}
            {cats && offered.length > 0 && chosen.length === 0 && <p className="mt-2 text-xs text-muted">{t.gridCatsEmpty}</p>}
          </div>
        )}
        {source === "picked" && (
          <>
            <ProductChecklist lang={lang} ids={ids} onChange={(productIds) => set({ productIds })} hint={t.gridPickedHint} empty={t.gridPickedEmpty} title={t.gridPickTitle} />
            {limit > 0 && live > limit && <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{t.gridLimitNote(limit, live)}</p>}
          </>
        )}
      </div>
    </Part>
  );
}

/** The products of a section, picked from his own: a search box and a list to tick, numbered in the order he picks them.
    Used by Pinned products, Featured products and the Product grid. `hint`/`empty` replace the usual words under the title and when none is picked.
    The picked ones come first, in his order, with buttons to move them; a picked product that was deleted is named with a way to remove it. */
/* Where the products of Deals / Featured products come from, with a link to the Products page (a new tab, so the design he
   has not saved stays open here; the preview reloads the products when he comes back). Deals also says plainly when none of
   his products has a discount, since customers then don't see the block. */
const productsNote = {
  en: {
    discounts: "This block shows your products that have a discount. To add a discount, open the",
    featured: "To mark products as featured, open the",
    page: "Products page",
    none: "None of your products has a discount yet, so customers don't see this block.",
  },
  ar: {
    discounts: "يعرض هذا القسم منتجاتك التي عليها خصم. لإضافة خصم، افتح",
    featured: "لتعليم منتجات كمميزة، افتح",
    page: "صفحة المنتجات",
    none: "لا توجد منتجات عليها خصم بعد، فلن يظهر هذا القسم للعملاء.",
  },
};
function ProductsPageNote({ lang, kind }: { lang: Lang; kind: "discounts" | "featured" }) {
  const w = productsNote[lang];
  const [onSale, setOnSale] = useState<number | null>(null);
  useEffect(() => {
    if (kind !== "discounts") return;
    const read = () => setOnSale(countDiscounted());
    read();
    window.addEventListener("storage", read);
    window.addEventListener("focus", read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener("focus", read);
    };
  }, [kind]);
  return (
    <div className="mb-4 space-y-2">
      <p className="text-xs leading-relaxed text-muted">
        {w[kind]}{" "}
        <a href="/products" target="_blank" rel="noopener" className="font-semibold text-primary underline underline-offset-2 hover:no-underline">{w.page}</a>.
      </p>
      {kind === "discounts" && onSale === 0 && (
        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{w.none}</p>
      )}
    </div>
  );
}

function ProductChecklist({ lang, ids, onChange, hint, empty, title }: { lang: Lang; ids: number[]; onChange: (ids: number[]) => void; hint?: string; empty?: string; title?: string }) {
  const t = dc[lang].form;
  const a = dc[lang].actions;
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<{ id: number; name: string; category: string }[] | null>(null);
  useEffect(() => setProducts(readProducts()), []);
  const list = products ?? [];
  const toggle = (id: number) => onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const live = ids.filter((id) => list.some((p) => p.id === id));
  const move = (id: number, d: -1 | 1) => {
    const i = live.indexOf(id), j = i + d;
    if (i < 0 || j < 0 || j >= live.length) return;
    const next = [...live];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  /* only once his products are read, so a slow first read never calls them deleted */
  const gone = products ? ids.length - live.length : 0;
  const match = (p: { name: string; category: string }) => !q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase()) || p.category.toLowerCase().includes(q.trim().toLowerCase());
  const shown = [...live.map((id) => list.find((p) => p.id === id)!), ...list.filter((p) => !ids.includes(p.id))].filter(match);
  const orderBtnXs = "grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-fg/15 text-muted transition hover:bg-soft hover:text-fg disabled:opacity-30 [&_svg]:h-3.5 [&_svg]:w-3.5";
  return (
      <div>
        <p className="text-sm font-bold text-black dark:text-white">{title ?? t.collection}</p>
        <p className="mt-0.5 text-xs text-muted">{hint ?? t.collectionHint}</p>
        {gone > 0 && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <span>{t.pickedGone(gone)}</span>
            <button type="button" onClick={() => onChange(live)} className="shrink-0 underline underline-offset-2 hover:no-underline">{t.pickedGoneRemove}</button>
          </div>
        )}
        {!products ? null : list.length === 0 ? (
          <div className="mt-3 rounded-xl bg-soft px-4 py-4 text-sm text-muted">
            <p>{t.collectionNone}</p>
            <a href="/products" target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-primary hover:underline">{t.addProducts}</a>
          </div>
        ) : (
          <>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.collectionSearch} aria-label={t.collectionSearch} className={`${input} mt-3 h-10`} />
            <p className="mt-2 text-xs font-semibold text-primary">
              {live.length} {t.collectionPicked}
            </p>
            <ul className="mt-2 max-h-64 divide-y divide-fg/10 overflow-y-auto rounded-xl border border-fg/10">
              {shown.map((p) => {
                const order = live.indexOf(p.id);
                return (
                  <li key={p.id} className="flex items-center gap-1 pe-2">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-2.5 text-sm transition hover:bg-fg/[0.04]">
                      <input type="checkbox" checked={order >= 0} onChange={() => toggle(p.id)} className="peer sr-only" />
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-fg/25 bg-card text-xs font-bold text-transparent transition peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40">
                        {order >= 0 ? order + 1 : ""}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{p.name}</span>
                        {p.category && <span className="block truncate text-xs text-muted">{p.category}</span>}
                      </span>
                    </label>
                    {order >= 0 && live.length > 1 && (
                      <>
                        <button type="button" className={orderBtnXs} disabled={order === 0} onClick={() => move(p.id, -1)} aria-label={`${a.up}: ${p.name}`} title={a.up}>{ic.up}</button>
                        <button type="button" className={orderBtnXs} disabled={order === live.length - 1} onClick={() => move(p.id, 1)} aria-label={`${a.down}: ${p.name}`} title={a.down}>{ic.down}</button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            {ids.length === 0 && <p className="mt-2 text-xs text-muted">{empty ?? t.collectionEmpty}</p>}
          </>
        )}
      </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Pinned products: pick which products show, name it, set the count  */
/* ------------------------------------------------------------------ */

type CollectionEl = Extract<SectionConfig, { type: "collection" }>;

function CollectionForm({ lang, s, onChange, text }: { lang: Lang; s: CollectionEl; onChange: (s: SectionConfig) => void; text: (v: { en: string; ar: string }, set: (b: { en: string; ar: string }) => void, label: string, area?: boolean, field?: string, more?: React.ReactNode) => React.ReactNode }) {
  const t = dc[lang].form;
  const ids = s.settings.productIds ?? [];
  const set = (patch: Partial<CollectionEl["settings"]>) => onChange({ ...s, settings: { ...s.settings, ...patch } });

  return (
    <>
      {text(s.settings.title, (title) => set({ title }), dc[lang].form.title, false, "title", <TitleLookFields lang={lang} value={s.titleLook} onChange={(titleLook) => onChange({ ...s, titleLook })} />)}
      <Part lang={lang} label={popT[lang].viewAllLeads}>
        <LinkPicker lang={lang} value={s.settings.link ?? ""} onChange={(link) => set({ link })} label={popT[lang].viewAllLeads} />
      </Part>
      <Toggle on={!!s.settings.background} onChange={(on) => set(on ? { background: "#f2eee6", color: "#0f2a22" } : { background: "", color: "" })} label={popT[lang].bandOn} />
      <Blocked when={!s.settings.background} why={why(lang, `غير متاح لأن «${popT[lang].bandOn}» مُطفأ.`, `Not available because “${popT[lang].bandOn}” is off.`)}>
        <div className="space-y-2">
          <FillPicker lang={lang} label={popT[lang].bandBg} value={s.settings.background ?? ""} fallback="#f2eee6" onChange={(background) => set({ background })} />
          <ColorChip lang={lang} label={popT[lang].bandText} value={s.settings.color || undefined} onChange={(color) => set({ color })} />
        </div>
      </Blocked>
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

      <ProductChecklist lang={lang} ids={ids} onChange={(productIds) => set({ productIds })} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Header and footer: rows that open their own small forms            */
/* ------------------------------------------------------------------ */

type SubKey = "nameLogo" | "sidebarSettings" | "navigation" | "searchCart" | "announcement" | "footerSettings";
/* The parts of the footer's screen */
type FootBlock = "layout" | "links" | "contact" | "social" | "licenses" | "look";
type SetCfg = (fn: (c: StorefrontConfig) => StorefrontConfig) => void;
/* The part of the store each screen changes, outlined in the preview while it is open (see spotSignal) */
const subSpot: Record<SubKey, string> = { nameLogo: "identity", sidebarSettings: "sidebar", navigation: "nav", searchCart: "search", announcement: "announcement", footerSettings: "footer" };
/* the footer's column each part of its screen fills (its layout and colors are the whole footer) */
const footSpot: Partial<Record<FootBlock, string>> = { links: "footer:pages", contact: "footer:contact", social: "footer:social", licenses: "footer:licenses" };
/** Points the preview at a part of the store while it is given (for places that are not a Part or a screen) */
function PointAt({ spot }: { spot: Spot | null }) {
  useSpotWhile(spot);
  return null;
}

/** A row that opens a form. The "‹" says it can be pressed. */
function RowLink({ icon: ico, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-start text-sm font-medium transition hover:bg-fg/[0.04]">
        <span className="text-muted">{ico}</span>
        <span className="flex-1">{label}</span>
        <span className="text-muted rtl:rotate-180">
          <svg {...icon} className="h-4 w-4"><path d="m9 6 6 6-6 6" /></svg>
        </span>
      </button>
    </li>
  );
}

function SubShell({ lang, title, spot, tag = true, onBack, children }: { lang: Lang; title: string; /* the part of the store it changes (see subSpot) */ spot?: string; /* the screen's name on the outline in the preview (off: the outline alone) */ tag?: boolean; onBack: () => void; children: React.ReactNode }) {
  const t = dc[lang];
  useSpotWhile(spot ? { key: spot, label: tag ? title : "" } : null);
  return (
    <div>
      <div className="flex items-center gap-3 border-b border-fg/10 px-4 py-3">
        <button type="button" onClick={onBack} aria-label={t.form.back} className={roundBtn}>{ic.back}</button>
        <div>
          <p className="text-xs text-muted">{t.sub.now}</p>
          <p className="text-sm font-bold text-black dark:text-white">{title}</p>
        </div>
      </div>
      {/* a thin line between every option, so the screen reads as a list; its parts point at their own places inside it */}
      <SpotScope.Provider value={spot ?? null}>
        <div className="divide-y divide-fg/10 px-4 py-2 [&>*]:py-4">{children}</div>
      </SpotScope.Provider>
    </div>
  );
}

const nameLogoIcon = <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="7.500" cy="12" r="3.500" /><path d="M14 10h7M14 14h5" /></svg>;
const navIcon = <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="5" rx="1.500" /><path d="M6.500 6.500h2M11 6.500h2M15.500 6.500h2M4 14h16M4 18h10" /></svg>;
const sectionsIcon = <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 5h10M4 10h16M4 14h16M4 19h10" /></svg>;
/* the design options' screen for the sections' titles (font, style, place, color, size) */
const sectionsWord = { ar: "الأقسام", en: "Sections" } as const;
const cardIcon = <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M5 13h14M8 16.500h5M8 19h3" /></svg>;
/* the design options' screen for the product card (what it shows, its look, its colors) */
const cardWord = { ar: "بطاقة المنتج", en: "Product card" } as const;
/** The screens of the design options that something outside can ask for */
export type OptionsScreen = "identity" | "cards";
const searchCartIcon = <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="8" cy="8" r="4.500" /><path d="M11.300 11.300 14 14M13 15h8l-1 6h-6zM15 15v-1a2 2 0 0 1 4 0v1" /></svg>;
const sidebarIcon = <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M5.500 8h1.500M5.500 11h1.500M5.500 14h1.500" /></svg>;

/** The sidebar (the button at the top that opens the store's side list): whether it shows, what it lists and his own links in it */
function SidebarSettingsForm({ lang, cfg, setCfg }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg }) {
  const t = dc[lang];
  return (
    <>
      <div>
        <Toggle on={cfg.header.showMenu} onChange={(v) => setCfg((c) => ({ ...c, header: { ...c.header, showMenu: v } }))} label={t.header.showMenu} />
        {!cfg.header.showMenu && <Tip text={t.header.tipMenu} />}
      </div>
      <Blocked when={!cfg.header.showMenu} why={why(lang, `غير متاح لأن «${t.header.showMenu}» مُطفأ.`, `Not available because “${t.header.showMenu}” is off.`)}>
        <DrawerItemsForm lang={lang} cfg={cfg} setCfg={setCfg} />
      </Blocked>
    </>
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

/** The store's identity, all in one screen: its name and how it shows at the top of the store (logo, font, color, size, the
    small line under it), the tab icon, the description the footer shows, and the store color. Always a screen of its own. */
function NameLogoForm({ lang, cfg, setCfg, draft, update }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg; draft: Draft; update: Update }) {
  const t = dc[lang];
  const pt = popT[lang];
  const id = cfg.identity;
  const setId = (patch: Partial<StorefrontConfig["identity"]>) => setCfg((c) => ({ ...c, identity: { ...c.identity, ...patch } }));
  /* the store's own details (its name, description and color, kept with the store, not the design) */
  const setStore = (patch: Partial<Draft["identity"]>) => update((d) => ({ ...d, identity: { ...d.identity, ...patch } }));
  /* where the name sits: the header (the page's background), or in the pill style a pill of the text color; and the footer */
  const textNow = useContext(TextColorNow);
  const storeColor = useContext(StoreColorNow);
  const nameOn = cfg.nav.style === "pill" ? (cfg.nav.links.length ? [textNow] : [cfg.theme.background, textNow]) : [cfg.theme.background];
  const nameLostInFooter = !!id.nameColor && !footerColors(cfg, storeColor).name;
  const nameHardIn = [
    ...(id.nameColor && !nameOn.every((bg) => readsOn(id.nameColor!, bg)) ? [pt.placeHeader] : []),
    ...(nameLostInFooter ? [pt.placeFooter] : []),
  ];
  return (
    <>
      <label data-attn="name" className="block">
        <span className="mb-1.5 block text-sm font-semibold">{t.identity.name}</span>
        <input value={draft.identity.name} onChange={(e) => setStore({ name: e.target.value })} maxLength={40} className={`${input} h-11`} />
        <CharCount value={draft.identity.name} max={40} />
        <RudeNote lang={lang} text={draft.identity.name} />
        {visibleLength(draft.identity.name) < 2 && <span className="mt-1 block text-xs font-semibold text-rose-600">{t.identity.errName}</span>}
      </label>
      <Toggle on={id.showLogo} onChange={(v) => setId({ showLogo: v })} label={t.header.showLogo} />
      <Blocked when={!id.showLogo} why={why(lang, `غير متاح لأن «${t.header.showLogo}» مُطفأ.`, `Not available because “${t.header.showLogo}” is off.`)}>
        <Toggle on={id.showName !== false} onChange={(v) => setId({ showName: v })} label={pt.showName} />
      </Blocked>
      <Blocked when={!id.showLogo} why={why(lang, `غير متاح لأن «${t.header.showLogo}» مُطفأ.`, `Not available because “${t.header.showLogo}” is off.`)}>
        <Part lang={lang} label={t.identity.logo}>
          <LogoChoice lang={lang} draft={draft} update={update} />
        </Part>
      </Blocked>
      {/* where the logo and name sit in the header, named by the side he sees (in Arabic the start is the right); the theme's
          own place until he picks one, and the header's buttons move to the free side */}
      <Part lang={lang} label={pt.namePlace}>
        <Seg value={id.align} onChange={(align) => setId({ align })} cols={3} options={[{ key: "start", label: lang === "ar" ? pt.placeRight : pt.placeLeft }, { key: "center", label: pt.placeCenter }, { key: "end", label: lang === "ar" ? pt.placeLeft : pt.placeRight }]} />
        {id.align !== "center" && <p className="mt-2 text-[11px] leading-relaxed text-muted">{pt.namePlaceOther}</p>}
      </Part>
      <Part lang={lang} label={pt.nameFont}>
        <FontGrid lang={lang} value={id.nameFont} onChange={(nameFont) => setId({ nameFont })} first={pt.nameFontSame} />
      </Part>
      <div>
        <ColorChip lang={lang} label={pt.nameColor} value={id.nameColor} onChange={(nameColor) => setId({ nameColor })} onReset={() => setId({ nameColor: undefined })} />
        {/* one warning that names every place the color is hard to read (the header, the footer, or both) */}
        <Bad show={nameHardIn.length > 0} text={pt.lowContrastIn(nameHardIn.join(lang === "ar" ? "، " : ", "))} />
      </div>
      <Stepper lang={lang} label={pt.nameSize} value={id.nameSize ?? (id.nameFont ? 40 : 20)} auto={id.nameSize === undefined} min={12} max={72} onChange={(nameSize) => setId({ nameSize })} onReset={() => setId({ nameSize: undefined })} />
      <Part lang={lang} label={pt.tagline} preview={id.tagline?.[lang]} spot="identity:tagline">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold">
              {pt.taglineWords}
              <input value={id.tagline?.[lang] ?? ""} onChange={(e) => setId({ tagline: { ...(id.tagline ?? { en: "", ar: "" }), [lang]: e.target.value } })} maxLength={TAGLINE_MAX} placeholder={pt.taglinePh} className={`${input} mt-1.5 h-11 font-normal`} />
            </label>
            <CharCount value={id.tagline?.[lang] ?? ""} max={TAGLINE_MAX} always />
            <RudeNote lang={lang} text={id.tagline?.[lang]} />
            <p className="mt-1 text-[11px] leading-relaxed text-muted">{pt.taglineHint}</p>
          </div>
          <Part lang={lang} label={pt.taglineFont}>
            <FontGrid lang={lang} value={id.taglineFont} onChange={(taglineFont) => setId({ taglineFont })} first={pt.taglineFontDefault} firstFamily={TAGLINE_DEFAULT_FONT} />
          </Part>
          <ColorChip lang={lang} label={pt.taglineColor} value={id.taglineColor} auto={cfg.theme.accent || cfg.theme.primary} onChange={(taglineColor) => setId({ taglineColor })} onReset={() => setId({ taglineColor: undefined })} on={cfg.theme.background} />
        </div>
      </Part>
      <Part lang={lang} label={t.identity.description} preview={draft.identity.description} spot="footer:about">
        <textarea value={draft.identity.description} onChange={(e) => setStore({ description: e.target.value })} placeholder={t.identity.descriptionPh} rows={4} maxLength={200} className={`${input} resize-none py-3`} />
        <CharCount value={draft.identity.description} max={200} />
        <RudeNote lang={lang} text={draft.identity.description} />
      </Part>
      <Part lang={lang} label={t.identity.favicon} hint={t.identity.faviconHint}>
        <FaviconChoice lang={lang} draft={draft} update={update} />
      </Part>
      <div data-attn="color">
        <Part lang={lang} label={t.identity.color}>
          <ColorPicker value={draft.identity.color} onChange={(color) => setStore({ color })} label={t.identity.hex} bad={t.identity.hexBad} />
        </Part>
      </div>
    </>
  );
}

/* The look of the small line under the store name when he has not picked a font for it */
const TAGLINE_DEFAULT_FONT = "var(--font-elegant-latin), Georgia, serif";

/** A choice of fonts, each shown writing the same sample: every font picker shows the store's one list of fonts
    (fontChoices: in English only the fonts that write English letters). The first choice ("", when `first` names it) is the
    usual one. text: a picker for the store's body text, so no title-only fonts. */
function FontGrid({ lang, value, onChange, first, firstFamily, text }: { lang: Lang; value?: HeroFont; onChange: (k: HeroFont | undefined) => void; first?: string; firstFamily?: string; text?: boolean }) {
  const t = dc[lang];
  const pp = popT[lang];
  const choices: { key: HeroFont; name: string; arOnly?: boolean }[] = [
    ...(first !== undefined ? [{ key: "" as HeroFont, name: first }] : []),
    ...fontChoices(lang, value, text).map((f) => ({ key: f.key, name: f.name[lang], arOnly: lang === "en" && !f.latin })),
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {choices.map(({ key: k, name, arOnly }) => {
        const on = (value ?? "") === k;
        return (
          <button key={k || "same"} type="button" onClick={() => onChange(k || undefined)} aria-pressed={on} className={`rounded-xl border px-3 py-2.5 text-start transition ${on ? "border-primary bg-primary text-white [&_.text-muted]:!text-white/80" : "border-fg/15 hover:bg-soft"}`}>
            <span className="block text-base font-bold leading-snug [overflow-wrap:anywhere]" style={{ fontFamily: k === "" && firstFamily ? firstFamily : heroTitleFamily(k) }}>{t.options.fontSample}</span>
            <span className="mt-1 block text-[11px] font-semibold text-muted">{name}</span>
            {/* picked before (in Arabic): English text falls back to the usual font, so say it */}
            {arOnly && <span className="mt-0.5 block text-[11px] text-muted">{pp.fontArOnly}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* The words of the Search and cart screen */
const scT = {
  ar: {
    search: "البحث",
    cart: "السلة",
    searchLook: "البحث مفتوح دائمًا",
    barOn: "خانة البحث ظاهرة دائمًا في رأس الصفحة.",
    barOff: "تظهر أيقونة بحث، وتفتح الخانة عند الضغط عليها.",
    bar: "ظاهر دائمًا",
    icon: "أيقونة تفتح عند الضغط",
    size: "عرض خانة البحث",
    sizeIcon: "عرض الخانة عندما تُفتح بالضغط على الأيقونة.",
    small: "صغير",
    medium: "متوسط",
    large: "كبير",
    place: "مكان شريط البحث",
    middle: "في الوسط",
    byMenu: "بجانب زر القائمة",
    byCart: "بجانب السلة",
    words: "نص خانة البحث",
    phone: "على الجوال يظهر البحث كأيقونة دائمًا لضيق المساحة.",
    cartLook: "شكل السلة",
    saved: "زر المفضلة",
    withTotal: "أيقونة ومبلغ السلة",
    iconAlone: "أيقونة فقط",
    pillCart: "زر دائري (شكل «لَمّة»)",
  },
  en: {
    search: "Search",
    cart: "Cart",
    searchLook: "Search always open",
    barOn: "The search box always shows in the header.",
    barOff: "A search icon shows, and the box opens when it is pressed.",
    bar: "Always open",
    icon: "Icon that opens when pressed",
    size: "Search width",
    sizeIcon: "How wide the field is when it opens from the icon.",
    small: "Small",
    medium: "Medium",
    large: "Large",
    place: "Search bar place",
    middle: "In the middle",
    byMenu: "Beside the menu button",
    byCart: "Beside the cart",
    words: "Search field text",
    phone: "On phones the search is always an icon, as there is little room.",
    cartLook: "Cart look",
    saved: "Favourites button",
    withTotal: "Icon and cart total",
    iconAlone: "Icon only",
    pillCart: "Round button (Lamma style)",
  },
} as const;

/** Search and cart: how the header's search and cart look, their size and where they sit, in one screen */
function SearchCartForm({ lang, cfg, setCfg }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg }) {
  const w = scT[lang];
  const nav = cfg.nav;
  const setNav = (patch: Partial<StorefrontConfig["nav"]>) => setCfg((c) => ({ ...c, nav: { ...c.nav, ...patch } }));
  const centered = cfg.identity.align === "center";
  /* the search box open all the time, or an icon (with none chosen: open beside a name at the side in the sidebar-button header) */
  const bar = (nav.searchLook ?? (nav.style === "button" && !centered ? "bar" : "icon")) === "bar";
  const words = cfg.texts.search[lang] ?? "";
  const heading = "text-xs font-bold uppercase tracking-wide text-muted";
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h3 className={heading}>{w.search}</h3>
        {(
          /* on: the search box is open all the time; off: an icon that opens it when pressed */
          <div>
            <Toggle on={bar} onChange={(on) => setNav({ searchLook: on ? "bar" : "icon" })} label={w.searchLook} />
            <p className="mt-1 text-[11px] leading-relaxed text-muted">{bar ? w.barOn : w.barOff}</p>
          </div>
        )}
        {/* the width of the always-open bar, or of the field the icon opens */}
        {(
          <Part lang={lang} label={w.size} hint={bar ? undefined : w.sizeIcon}>
            <Seg value={nav.searchSize ?? "medium"} onChange={(searchSize) => setNav({ searchSize })} cols={3} options={[{ key: "small", label: w.small }, { key: "medium", label: w.medium }, { key: "large", label: w.large }]} />
          </Part>
        )}
        {/* the place is a choice only in the sidebar-button header (in the others it sits with the buttons) */}
        {(
          <Blocked when={!bar || nav.style !== "button"} why={!bar ? why(lang, `غير متاح لأن «${w.searchLook}» مُطفأ.`, `Not available because “${w.searchLook}” is off.`) : why(lang, `غير متاح لأن رأس الصفحة فيه روابط من «${dc[lang].rows.navigation}»، فتبقى خانة البحث بجانب السلة.`, `Not available because your header has links from “${dc[lang].rows.navigation}”, so the search box stays beside the cart.`)}>
          <Part lang={lang} label={w.place}>
            <Seg value={nav.searchPlace ?? "middle"} onChange={(searchPlace) => setNav({ searchPlace })} options={[{ key: "middle", label: centered ? w.byMenu : w.middle }, { key: "cart", label: w.byCart }]} />
          </Part>
          </Blocked>
        )}
        <Part lang={lang} label={w.words} preview={words || storeCopy[lang].search}>
          <input value={words} onChange={(e) => { const v = e.target.value; setCfg((c) => ({ ...c, texts: { ...c.texts, search: { ...c.texts.search, [lang]: v } } })); }} placeholder={storeCopy[lang].search} maxLength={60} className={`${input} h-11`} />
          <CharCount value={words} max={60} />
          <RudeNote lang={lang} text={words} />
        </Part>
        <p className="text-[11px] leading-relaxed text-muted">{w.phone}</p>
      </div>
      <div className="space-y-3 border-t border-fg/10 pt-4">
        <h3 className={heading}>{w.cart}</h3>
        <Part lang={lang} label={w.cartLook}>
          {nav.style === "button" && <Seg value={nav.cartTotal === false ? "icon" : "total"} onChange={(v) => setNav({ cartTotal: v === "total" })} options={[{ key: "total", label: w.withTotal }, { key: "icon", label: w.iconAlone }]} />}
          {nav.style === "links" && <Seg value={nav.cartLook ?? "icon"} onChange={(cartLook) => setNav({ cartLook })} options={[{ key: "icon", label: popT[lang].cartIcon }, { key: "text", label: popT[lang].cartText }]} />}
          {nav.style === "pill" && <p className="text-xs text-muted">{w.pillCart}</p>}
        </Part>
        {/* the heart (or the word "Saved") beside the basket: only the links header has one */}
        <Blocked when={nav.style !== "links"} why={why(lang, `غير متاح لأن «${dc[lang].luxe.navStyle}» ليس «${dc[lang].luxe.navLinks}».`, `Not available because “${dc[lang].luxe.navStyle}” isn't “${dc[lang].luxe.navLinks}”.`)}>
          <Toggle on={nav.showSaved !== false} onChange={(showSaved) => setNav({ showSaved })} label={w.saved} />
        </Blocked>
      </div>
    </div>
  );
}

/** Navigation design: how visitors move around the store from the top of the page (a sidebar button, links in the header or
    pill buttons), the header links themselves and their colors */
/* what a header link still needs before customers see it */
const navMissing = {
  en: { both: "Write the link's name and choose where it leads: customers don't see it until then.", name: "Write the link's name: customers don't see it until then.", to: "This link takes customers nowhere, so they don't see it. Choose where it leads." },
  ar: { both: "اكتب اسم الرابط واختر وجهته، فلن يراه العملاء قبل ذلك.", name: "اكتب اسم الرابط، فلن يراه العملاء قبل ذلك.", to: "هذا الرابط لا يأخذ العميل إلى أي مكان، لذلك لا يراه العملاء. اختر وجهة له." },
};

function NavigationForm({ lang, cfg, setCfg }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg }) {
  const lx = dc[lang].luxe;
  /* the header link whose trash was pressed: it asks before it goes */
  const [asking, setAsking] = useState<number | null>(null);
  /* a link just added opens by itself, the others stay closed under their names */
  const [added, setAdded] = useState<number | null>(null);
  /* a link just added: once its card has slid open, the cursor waits in its name */
  useEffect(() => {
    if (added === null) return;
    const t = setTimeout(() => (document.querySelector(`[data-nav-name="${added}"]`) as HTMLInputElement | null)?.focus(), 260);
    return () => clearTimeout(t);
  }, [added]);
  return (
    <>
      <Part lang={lang} label={lx.navStyle}>
        <Seg value={cfg.nav.style} onChange={(style) => setCfg((c) => ({ ...c, nav: { ...c.nav, style } }))} cols={3} options={[{ key: "button", label: lx.navButton }, { key: "links", label: lx.navLinks }, { key: "pill", label: popT[lang].navPill }]} />
      </Part>
      {/* a style that would show nothing says why, instead of seeming to do nothing (outside the fold, so it shows while closed) */}
      {cfg.nav.style === "button" && !cfg.header.showMenu && !cfg.nav.links.some((l) => (l.en.trim() || l.ar.trim()) && l.to?.trim()) && <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold leading-relaxed text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">{popT[lang].navSidebarOff}</p>}
      {cfg.nav.style !== "button" && !cfg.nav.links.some((l) => (l.en.trim() || l.ar.trim()) && l.to?.trim()) && <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold leading-relaxed text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">{popT[lang].navNoLinks}</p>}
      <Blocked when={cfg.nav.style !== "links" || cfg.identity.align !== "center"} why={cfg.nav.style !== "links" ? why(lang, `غير متاح لأن «${lx.navStyle}» ليس «${lx.navLinks}».`, `Not available because “${lx.navStyle}” isn't “${lx.navLinks}”.`) : why(lang, `غير متاح لأن «${popT[lang].namePlace}» ليس «${popT[lang].placeCenter}».`, `Not available because “${popT[lang].namePlace}” isn't “${popT[lang].placeCenter}”.`)}>
        <Part lang={lang} label={popT[lang].navPlace}>
          <Seg value={cfg.nav.place ?? "below"} onChange={(place) => setCfg((c) => ({ ...c, nav: { ...c.nav, place } }))} options={[{ key: "below", label: popT[lang].navBelow }, { key: "start", label: popT[lang].navStart }]} />
        </Part>
      </Blocked>
      <Blocked when={cfg.nav.style !== "pill"} why={why(lang, `غير متاح لأن «${lx.navStyle}» ليس «${popT[lang].navPill}».`, `Not available because “${lx.navStyle}” isn't “${popT[lang].navPill}”.`)}>
        <div className="space-y-3">
          <ColorChip lang={lang} label={popT[lang].navActive} value={cfg.nav.activeColor} onChange={(activeColor) => setCfg((c) => ({ ...c, nav: { ...c.nav, activeColor } }))} onReset={() => setCfg((c) => ({ ...c, nav: { ...c.nav, activeColor: undefined } }))} />
        </div>
      </Blocked>
      <div className="space-y-3.5">
          <p className="text-xs text-muted">{cfg.nav.style === "button" ? popT[lang].navBarHint : lx.navHint}</p>
          {/* each link folds up under its own words, in its own color */}
          <ItemList>
            {cfg.nav.links.map((l, i) => (
              <ItemCard
                key={i}
                lang={lang}
                name={l[lang]?.trim() || l[lang === "ar" ? "en" : "ar"]}
                empty={itemWords[lang].newLink}
                icon={<span aria-hidden className="h-4 w-4 shrink-0 rounded-full ring-1 ring-fg/15" style={{ background: l.color || cfg.theme.text }} />}
                force={added === i}
                /* it asks before it goes: while asking, the question takes the button's place */
                onRemove={asking === i ? undefined : () => setAsking(i)}
                removeLabel={lx.navRemove}
              >
                <Field label={lx.navLink}>
                  <input data-nav-name={i} value={l[lang] ?? ""} onChange={(e) => setCfg((c) => ({ ...c, nav: { ...c.nav, links: c.nav.links.map((x, j) => (j === i ? { ...x, [lang]: e.target.value } : x)) } }))} placeholder={itemWords[lang].linkTextPh} aria-label={lx.navLink} maxLength={20} className={`${input} h-10`} />
                  <CharCount value={l[lang] ?? ""} max={20} />
                  <RudeNote lang={lang} text={l[lang]} />
                </Field>
                <Part lang={lang} label={lx.navTarget} force={added === i}>
                  <LinkPicker lang={lang} value={l.to ?? ""} onChange={(to) => setCfg((c) => ({ ...c, nav: { ...c.nav, links: c.nav.links.map((x, j) => (j === i ? { ...x, to: to || undefined } : x)) } }))} label={lx.navTarget} />
                </Part>
                {/* customers only see a link with a name and somewhere to go: the card says what is missing (the preview keeps it) */}
                {(!(l.en.trim() || l.ar.trim()) || !l.to?.trim()) && (
                  <p role="status" className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold leading-relaxed text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">
                    <span aria-hidden>⚠</span>
                    {navMissing[lang][!(l.en.trim() || l.ar.trim()) ? (l.to?.trim() ? "name" : "both") : "to"]}
                  </p>
                )}
                {/* a link can stand out in a color of its own, like a red "Sale" */}
                <ColorChip lang={lang} label={popT[lang].linkColor} value={l.color} auto={cfg.theme.text} onChange={(color) => setCfg((c) => ({ ...c, nav: { ...c.nav, links: c.nav.links.map((x, j) => (j === i ? { ...x, color } : x)) } }))} onReset={() => setCfg((c) => ({ ...c, nav: { ...c.nav, links: c.nav.links.map((x, j) => (j === i ? { ...x, color: undefined } : x)) } }))} on={[cfg.nav.style === "pill" ? "#ffffff" : cfg.theme.background, ...(cfg.header.showMenu ? [cfg.theme.titleStyle === "pop" ? "#ffffff" : cfg.theme.background] : [])]} />
                {asking === i && <LinkAsk lang={lang} onYes={() => { setCfg((c) => ({ ...c, nav: { ...c.nav, links: c.nav.links.filter((_, j) => j !== i) } })); setAsking(null); }} onNo={() => setAsking(null)} />}
              </ItemCard>
            ))}
          </ItemList>
          <AddLimited compact count={cfg.nav.links.length} max={8} label={lx.navAdd} words={limitWords[lang].links} onAdd={() => { setAdded(cfg.nav.links.length); setCfg((c) => ({ ...c, nav: { ...c.nav, links: [...c.nav.links, { en: "", ar: "" }] } })); }} />
      </div>
    </>
  );
}

function AnnouncementForm({ lang, cfg, setCfg }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg }) {
  const t = dc[lang].sub.announcement;
  const a = cfg.announcement;
  const set = (patch: Partial<StorefrontConfig["announcement"]>) => setCfg((c) => ({ ...c, announcement: { ...c.announcement, ...patch } }));
  const edit = (i: number, patch: Partial<StorefrontConfig["announcement"]["messages"][number]>) => set({ messages: a.messages.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const last = a.messages[a.messages.length - 1];
  /* a message he has just added opens by itself */
  const [added, setAdded] = useState<number | null>(null);
  const seg = (on: boolean) => `h-10 flex-1 rounded-lg text-sm font-semibold transition ${on ? "bg-ink text-onink" : "text-muted hover:bg-fg/5"}`;
  type Msg = StorefrontConfig["announcement"]["messages"][number];
  /* the bar color and the text color: of one message (fading), or of the whole bar (scrolling) */
  const msgColors = (m: Msg, put: (patch: Partial<Msg>) => void) => (
    <>
      <Field label={t.color}>
        <FillPicker lang={lang} value={m.color} fallback="#004956" onChange={(color) => put({ color })} label={t.color} />
      </Field>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-fg/80">{t.textColor}</p>
          {m.textColor && <button type="button" onClick={() => put({ textColor: "" })} className="text-xs font-semibold text-primary hover:underline">{t.auto}</button>}
        </div>
        <ColorPicker value={m.textColor || onColor(m.color)} onChange={(textColor) => put({ textColor })} label={t.textColor} bad={dc[lang].identity.hexBad} list={["#ffffff", "#12262b", "#ffd166", "#96edd9", "#ffb4b4"]} />
        <Bad show={!!m.textColor && !readsOn(m.textColor, m.color)} text={popT[lang].lowContrast} />
      </div>
    </>
  );
  return (
    <>
      <Toggle on={a.show} onChange={(show) => set({ show })} label={t.show} />
      <Blocked when={!a.show} why={why(lang, `غير متاح لأن «${t.show}» مُطفأ.`, `Not available because “${t.show}” is off.`)}>
      <div className="space-y-4">

      <Part lang={lang} label={t.motion}>
        <div className="flex gap-1 rounded-xl border border-fg/15 bg-card p-1">
          <button type="button" aria-pressed={a.motion === "fade"} onClick={() => set({ motion: "fade" })} className={seg(a.motion === "fade")}>{t.fade}</button>
          <button type="button" aria-pressed={a.motion === "ticker"} onClick={() => set({ motion: "ticker", messages: a.messages.map((m) => ({ ...m, color: a.messages[0].color, textColor: a.messages[0].textColor })) })} className={seg(a.motion === "ticker")}>{t.ticker}</button>
        </div>
        <p className="mt-1.5 text-xs text-muted">{a.motion === "ticker" ? t.tickerHint : t.fadeHint}</p>
      </Part>

      <Blocked when={a.motion !== "fade" || a.messages.length < 2} why={a.motion !== "fade" ? why(lang, `غير متاح لأن «${t.motion}» ليس «${t.fade}».`, `Not available because “${t.motion}” isn't “${t.fade}”.`) : why(lang, "غير متاح لأن عندك رسالة واحدة فقط.", "Not available because you have only one message.")}>
        <Part lang={lang} label={t.every}>
          <SecondsPicker value={a.seconds} onChange={(seconds) => set({ seconds })} unit={t.sec} presets={[3, 4, 6, 8]} />
        </Part>
      </Blocked>

      {/* a scrolling bar: its speed, and one pair of colors for the whole bar (kept on every message, so fading keeps them too) */}
      <Blocked when={a.motion !== "ticker"} why={why(lang, `غير متاح لأن «${t.motion}» ليس «${t.ticker}».`, `Not available because “${t.motion}” isn't “${t.ticker}”.`)}>
        <div className="space-y-4">
          <Part lang={lang} label={t.speed}>
            <Seg lang={lang} value={a.speed ?? "normal"} onChange={(speed) => set({ speed })} cols={3} options={[{ key: "slow", label: t.slow }, { key: "normal", label: t.normal }, { key: "fast", label: t.fast }]} />
          </Part>
          <Part lang={lang} label={t.barColors}>
            <p className="mb-3 text-xs text-muted">{t.barColorsHint}</p>
            {msgColors(a.messages[0], (patch) => set({ messages: a.messages.map((m) => ({ ...m, ...patch })) }))}
          </Part>
        </div>
      </Blocked>

      {/* each message folds up under its own words, with its color beside them */}
      <ItemList>
        {a.messages.map((m, i) => (
          <ItemCard
            key={i}
            lang={lang}
            name={m.text[lang]?.trim() || m.text[lang === "ar" ? "en" : "ar"]}
            empty={itemWords[lang].newMessage}
            icon={<span aria-hidden className="h-4 w-4 shrink-0 rounded-full ring-1 ring-fg/15" style={{ background: m.color }} />}
            force={added === i}
            onRemove={a.messages.length > 1 ? () => set({ messages: a.messages.filter((_, j) => j !== i) }) : undefined}
            removeLabel={t.remove}
          >
            <Field label={t.textLabel}>
              <input value={m.text[lang]} onChange={(e) => edit(i, { text: { ...m.text, [lang]: e.target.value } })} aria-label={t.textLabel} placeholder={itemWords[lang].messagePh} maxLength={ANNOUNCE_TEXT_MAX} className={`${input} h-11`} />
              <CharCount value={m.text[lang]} max={ANNOUNCE_TEXT_MAX} always />
              <RudeNote lang={lang} text={m.text[lang]} />
            </Field>
            <Field label={t.linkLabel} hint={t.linkHint}>
              <LinkPicker lang={lang} value={m.link} onChange={(link) => edit(i, { link })} label={t.linkLabel} web={false} />
            </Field>
            <Blocked when={a.motion === "ticker"} why={why(lang, `غير متاح لأن «${t.motion}» هو «${t.ticker}».`, `Not available because “${t.motion}” is “${t.ticker}”.`)}>
              <div className="space-y-3">{msgColors(m, (patch) => edit(i, patch))}</div>
            </Blocked>
          </ItemCard>
        ))}
      </ItemList>

      <AddLimited
        count={a.messages.length}
        max={ANNOUNCE_MESSAGES_MAX}
        label={t.add}
        words={limitWords[lang].messages}
        onAdd={() => { setAdded(a.messages.length); set({ messages: [...a.messages, { text: { en: "", ar: "" }, link: "", color: last.color, textColor: last.textColor }] }); }}
      />
      </div>
      </Blocked>
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
/* A web address: a name with a dot and an ending of two letters or more, with or without http(s)://. */
const WEB = /^(https?:\/\/)?[^\s/?#.]+(\.[^\s/?#.]+)*\.[a-z؀-ۿ]{2,}(:\d+)?([/?#]\S*)?$/i;
/** The one check for every web address he types (the footer's links, the license link, the social pages): it must look like one and
    open as http or https, so javascript:, data: and the like are always wrong (safeUrl gives "" for them). */
export const okWeb = (v: string) => !v.trim() || (WEB.test(v.trim()) && !!safeUrl(v.trim()));
const okSocial = (v: string) => !v.trim() || /^@[\w.-]{1,60}$/.test(v.trim()) || okWeb(v);
export const okEmail = (v: string) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
/** A phone or WhatsApp number of the store: empty, or a Jordan mobile or landline (see jordanNumber) */
export const okPhone = (v: string) => !v.trim() || isJordanNumber(v);
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
      <CharCount value={cfg.footer.labels?.[key]?.[lang] ?? ""} max={30} />
      <RudeNote lang={lang} text={cfg.footer.labels?.[key]?.[lang]} />
      <p className="mt-1.5 text-xs text-muted">{pp.wordsHint}</p>
    </div>
  );
}

/** At the top of the form that fills a built-in column, while that column is hidden. A column is shown or hidden in one place
    only, its switch in the list of columns, so this says so and opens that list. */
function ColOff({ lang, cfg, kind, go }: { lang: Lang; cfg: StorefrontConfig; kind: FooterColumn["kind"]; go: (b: FootBlock) => void }) {
  if (colOn(cfg.footer, colOf(cfg.footer, kind))) return null;
  const pp = popT[lang];
  return (
    <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
      <p>{pp.colHidden}</p>
      <button type="button" onClick={() => go("layout")} className="mt-1 font-semibold underline">{pp.colHiddenOpen}</button>
    </div>
  );
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
  /* an open part points the preview at its column (the newest one opened shows) */
  const block = (b: FootBlock, title: string, ico: React.ReactNode, preview: string | undefined, body: React.ReactNode) => (
    <Fragment key={b}>
      <PointAt spot={opened.includes(b) && footSpot[b] ? { key: footSpot[b]!, label: title } : null} />
      <Block id={`foot-${b}`} title={title} icon={ico} preview={preview} open={opened.includes(b)} onToggle={() => toggle(b)}>{body}</Block>
    </Fragment>
  );
  const other = lang === "ar" ? "en" : "ar";
  const off = (kind: FooterColumn["kind"]) => !colOn(f, colOf(f, kind));
  /* the links column lists the store pages shown in the footer, then his own links: the count says the same */
  const ownLinks = (loadInfoPages() as { published: boolean; footer: boolean }[]).filter((p) => p.published && p.footer).length + (f.tabs ?? []).filter((x) => x.visible && (x.label[lang]?.trim() || x.label[other]?.trim())).length;
  const socials = Object.values(f.social).filter((v) => v?.trim()).length;
  const contact = [draft.identity.phone && `+962 ${draft.identity.phone}`, f.whatsapp, f.email].find((v) => v?.trim()) || undefined;
  return (
    <>
      <p className="text-xs leading-relaxed text-muted">{fb.hint}</p>
      <div className="space-y-2.5">
        {block("layout", fb.layout, ic.columns, (f.style ?? "full") === "simple" ? popT[lang].footerSimple : popT[lang].footerFull, <FooterLayoutForm lang={lang} cfg={cfg} setCfg={setCfg} go={go} />)}
        {block("links", fb.links, ic.link, off("pages") ? fb.off : fb.count.replace("{n}", String(ownLinks)), <FooterLinksForm lang={lang} cfg={cfg} setCfg={setCfg} go={go} />)}
        {block("contact", t.rows.service, ic.headset, off("contact") ? fb.off : contact, <ServiceForm lang={lang} draft={draft} update={update} go={go} />)}
        {block("social", t.rows.social, ic.share, off("social") ? fb.off : fb.accounts.replace("{n}", String(socials)), <SocialForm lang={lang} cfg={cfg} setCfg={setCfg} go={go} />)}
        {block("licenses", t.rows.certificate, ic.badge, off("licenses") ? fb.off : f.certificate.number.trim() || undefined, <CertificateForm lang={lang} cfg={cfg} setCfg={setCfg} go={go} />)}
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

/** The links column: its title, where its links come from, and his own links */
function FooterLinksForm({ lang, cfg, setCfg, go }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg; go: (b: FootBlock) => void }) {
  const pp = popT[lang];
  return (
    <>
      <ColOff lang={lang} cfg={cfg} kind="pages" go={go} />
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
        {([["title", pp.szTitles, 14, ...FOOTER_SIZES.title], ["text", pp.szText, 14, ...FOOTER_SIZES.text], ["name", pp.szName, footerNameSize({ ...cfg, footer: { ...f, sizes: { ...(f.sizes ?? {}), name: undefined } } }, style), ...FOOTER_SIZES.name]] as const).map(([k, label, def, min, max]) => (
          <Stepper key={k} lang={lang} label={label} value={f.sizes?.[k] ?? def} auto={f.sizes?.[k] === undefined} min={min} max={max} onChange={(v) => setCfg((c) => ({ ...c, footer: { ...c.footer, sizes: { ...(c.footer.sizes ?? {}), [k]: v } } }))} onReset={() => setCfg((c) => ({ ...c, footer: { ...c.footer, sizes: { ...(c.footer.sizes ?? {}), [k]: undefined } } }))} />
        ))}
      </div>
    </>
  );
}

function ServiceForm({ lang, draft, update, go }: { lang: Lang; draft: Draft; update: Update; go: (b: FootBlock) => void }) {
  const t = dc[lang];
  const pp = popT[lang];
  const f = draft.config.footer;
  const setCfg: SetCfg = (fn) => update((d) => ({ ...d, config: fn(d.config) }));
  const set = (patch: Partial<StorefrontConfig["footer"]>) => setCfg((c) => ({ ...c, footer: { ...c.footer, ...patch } }));
  /* A number is said to be wrong once he has left its field (or it was already there when the form opened), not while he types it.
     A letter or symbol typed in it is not kept, and that is said right away. */
  const [left, setLeft] = useState(() => ({ phone: !!draft.identity.phone.trim(), whatsapp: !!f.whatsapp.trim() }));
  const [dropped, setDropped] = useState<"phone" | "whatsapp" | null>(null);
  const typed = (k: "phone" | "whatsapp", raw: string) => setDropped(/[^\d\s+\-().]/.test(latin(raw)) ? k : dropped === k ? null : dropped);
  const numberBad = (k: "phone" | "whatsapp", v: string) => (dropped === k ? digitsOnlyError[lang] : left[k] && !okPhone(v) ? numberError[lang] : "");
  const phoneBad = numberBad("phone", draft.identity.phone);
  const whatsappBad = numberBad("whatsapp", f.whatsapp);
  return (
    <>
      <ColOff lang={lang} cfg={draft.config} kind="contact" go={go} />
      <ColTitle lang={lang} cfg={draft.config} setCfg={setCfg} kind="contact" />
      <p className="text-xs text-muted">{t.sub.service.hint}</p>
      {!hasStoreContact(draft.identity.phone, f.whatsapp) && <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400">{pp.contactNeeded}</p>}
      <Part lang={lang} label={t.footerFields.servicePhone} hint={t.footerFields.servicePhoneHint} field="phone" preview={draft.identity.phone ? `+962 ${draft.identity.phone}` : ""}>
        <span dir="ltr" className="flex h-11 items-center overflow-hidden rounded-xl border border-fg/15 bg-card text-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25">
          <span className="flex h-full items-center border-e border-fg/15 bg-soft/60 px-3 font-semibold">+962</span>
          <input
            data-field="phone"
            value={draft.identity.phone}
            onChange={(e) => {
              const raw = e.target.value;
              typed("phone", raw);
              update((d) => ({ ...d, identity: { ...d.identity, phone: typedPhone(raw) } }));
            }}
            onBlur={() => setLeft((x) => ({ ...x, phone: true }))}
            inputMode="tel"
            maxLength={16}
            aria-label={t.footerFields.servicePhone}
            aria-invalid={!!phoneBad}
            className="h-full flex-1 bg-transparent px-3 outline-none"
          />
        </span>
        <Bad show={!!phoneBad} text={phoneBad} />
      </Part>
      <Part lang={lang} label={t.sub.service.whatsapp} field="whatsapp" preview={f.whatsapp}>
        <span className="relative block">
          <span className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[#1fa855]">{storeIcons.whatsapp}</span>
          {/* digits only, with a + at the start if he likes */}
          <input data-field="whatsapp" dir="ltr" value={f.whatsapp} onChange={(e) => { const raw = e.target.value; typed("whatsapp", raw); set({ whatsapp: typedAnyPhone(raw) }); }} onBlur={() => setLeft((x) => ({ ...x, whatsapp: true }))} inputMode="tel" maxLength={20} placeholder="+962 7X XXX XXXX" aria-label={t.sub.service.whatsapp} aria-invalid={!!whatsappBad} className={`${input} h-11 text-start ps-10`} />
        </span>
        <Bad show={!!whatsappBad} text={whatsappBad} />
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
        <CharCount value={f.address[lang] ?? ""} max={100} />
        <RudeNote lang={lang} text={f.address[lang]} />
      </Part>
    </>
  );
}

function CertificateForm({ lang, cfg, setCfg, go }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg; go: (b: FootBlock) => void }) {
  const t = dc[lang].sub.certificate;
  const c = cfg.footer.certificate;
  const set = (patch: Partial<typeof c>) => setCfg((x) => ({ ...x, footer: { ...x.footer, certificate: { ...x.footer.certificate, ...patch } } }));
  return (
    <>
      <ColOff lang={lang} cfg={cfg} kind="licenses" go={go} />
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
          <CharCount value={c.label ?? ""} max={40} />
          <RudeNote lang={lang} text={c.label} />
        </Part>
      )}
      <Part lang={lang} label={t.number} field="licenseNumber" preview={c.number}>
        <input data-field="licenseNumber" dir="ltr" value={c.number} onChange={(e) => set({ number: latin(e.target.value).slice(0, 30) })} maxLength={30} className={`${input} h-11 text-start`} />
      </Part>
      <Part lang={lang} label={t.logo}>
        <UploadBox lang={lang} current={c.logo || undefined} onImage={(logo) => set({ logo })} onRemove={() => set({ logo: "" })} size={256} shapes={["original", "square", "wide"]} spec={t.logoSpec} words={dc[lang].form.ups.license} />
      </Part>
      <Part lang={lang} label={t.url} preview={c.url}>
        <input dir="ltr" value={c.url} onChange={(e) => set({ url: e.target.value })} maxLength={160} placeholder="https://" aria-invalid={!okWeb(c.url)} className={`${input} h-11 text-start`} />
        <Bad show={!okWeb(c.url)} text={dc[lang].ownLinks.webBad} />
      </Part>
    </>
  );
}

function SocialForm({ lang, cfg, setCfg, go }: { lang: Lang; cfg: StorefrontConfig; setCfg: SetCfg; go: (b: FootBlock) => void }) {
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
      <ColOff lang={lang} cfg={cfg} kind="social" go={go} />
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
  const [bad, setBad] = useState<PicNote>(null);
  const set = (patch: Partial<SlidesEl["settings"]>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
  const edit = (i: number, patch: Partial<Slide>) => set({ slides: slides.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    const n = [...slides];
    [n[i], n[j]] = [n[j], n[i]];
    set({ slides: n });
  };
  /* the picture just added is cropped in its own card; the slider shows each cut as he moves it */
  const [crop, setCrop] = useState<Cropping | null>(null);
  const add = async (file: File | undefined) => {
    if (!file) return;
    const { url, note } = await readPicture(file, lang);
    setBad(note);
    if (!url) return;
    set({ slides: [...slides, { image: url, link: "" }] });
    if (cuttable(url)) setCrop({ i: slides.length, src: url, before: null });
  };
  /* a picture has no words of its own: it is named by where it leads (a part of the page, a page, a web address) */
  const sections = useContext(LinkTargets);
  const pages = useStorePages(lang);
  const leadsTo = (link: string) => {
    if (!link) return "";
    const page = /^page:(\d+)$/.exec(link);
    const name = page ? pages.find((p) => p.id === Number(page[1]))?.title : sections.find((x) => x.id === link)?.name ?? link.replace(/^https?:\/\//, "");
    return name ? `${itemWords[lang].to} ${name}` : "";
  };

  return (
    <>
      <p className="text-xs leading-relaxed text-muted">{t.slidesHint}</p>

      {slides.length > 0 && (
        <ItemList>
          {slides.map((x, i) => (
            <ItemCard
              key={i}
              lang={lang}
              name={leadsTo(x.link) || `${itemWords[lang].picture} ${i + 1}`}
              empty={itemWords[lang].newSlide}
              /* eslint-disable-next-line @next/next/no-img-element */
              icon={<img src={x.image} alt="" className="h-7 w-11 shrink-0 rounded-md object-cover ring-1 ring-black/10" />}
              force={crop?.i === i}
              onRemove={() => set({ slides: slides.filter((_, j) => j !== i) })}
              removeLabel={t.removeSlide}
            >
              {crop?.i === i && (
                <ImageCropper
                  lang={lang}
                  src={crop.src}
                  shapes={["wide", "original"]}
                  out={1600}
                  type="image/jpeg"
                  onLive={(image) => edit(i, { image })}
                  onCancel={() => {
                    setCrop(null);
                    if (crop.before) edit(i, crop.before);
                    else set({ slides: slides.filter((_, j) => j !== i) });
                  }}
                  onDone={(image) => {
                    setCrop(null);
                    edit(i, { image });
                  }}
                />
              )}
              {slides.length > 1 && (
                <Field label={itemWords[lang].order}>
                  <div className="flex gap-2">
                    <button type="button" className={orderBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={dc[lang].actions.up} title={dc[lang].actions.up}>{ic.up}{dc[lang].actions.up}</button>
                    <button type="button" className={orderBtn} disabled={i === slides.length - 1} onClick={() => move(i, 1)} aria-label={dc[lang].actions.down} title={dc[lang].actions.down}>{ic.down}{dc[lang].actions.down}</button>
                  </div>
                </Field>
              )}
              <Field label={t.slideLink}>
                <LinkPicker lang={lang} value={x.link} onChange={(link) => edit(i, { link })} label={t.slideLink} />
              </Field>
              {crop?.i !== i && (
                <Field label={itemWords[lang].place}>
                  <PictureMover lang={lang} image={x.image} value={x.pos} onChange={(pos) => edit(i, { pos })} fill ratio={s.settings.ratio === "standard" ? "2 / 1" : "3 / 1"} radius="10px" />
                </Field>
              )}
            </ItemCard>
          ))}
        </ItemList>
      )}

      <AddLimited count={slides.length} max={8} label={t.addSlide} words={limitWords[lang].pictures} onPick={(el) => { const f = el.files?.[0]; el.value = ""; void add(f); }} />
      <PicNoteLine note={bad} />
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
          <Blocked when={!(s.settings.autoplay ?? true)} why={why(lang, `غير متاح لأن «${t.autoplay}» مُطفأ.`, `Not available because “${t.autoplay}” is off.`)}>
            <Part lang={lang} label={t.every}>
              <SecondsPicker value={s.settings.seconds || 5} onChange={(n) => set({ seconds: n })} unit={t.seconds} />
            </Part>
          </Blocked>
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
  const [bad, setBad] = useState<PicNote>(null);
  /* the chosen photo, waiting to be cut; what there was before, for Cancel */
  const [pending, setPending] = useState("");
  const before = useRef("");
  const pick = async (file: File | undefined) => {
    if (!file) return;
    const { url, note } = await readPicture(file, lang, { max });
    setBad(note);
    if (url) {
      before.current = value;
      setPending(url);
    }
  };
  if (pending) return <div className="space-y-2"><PicNoteLine note={bad} /><ImageCropper lang={lang} src={pending} shapes={["original", "square", "tall", "wide"]} out={max} type="image/jpeg" onLive={onChange} onCancel={() => { setPending(""); onChange(before.current); }} onDone={(url) => { setPending(""); onChange(url); }} /></div>;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-16 w-14 shrink-0 rounded-lg object-cover ring-1 ring-black/10" />
        )}
        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 px-3 py-2.5 transition hover:bg-primary/10 focus-within:ring-2 focus-within:ring-primary/40">
          <input type="file" accept={PICTURE_ACCEPT} className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void pick(f); }} />
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-white shadow-sm">{upIcon}</span>
          <span className="truncate text-sm font-bold text-primary">{value ? t.picChange : t.pic}</span>
        </label>
        {value && (
          <button type="button" onClick={() => onChange("")} className={`${roundBtn} hover:!text-rose-600`} aria-label={t.picRemove} title={t.picRemove}>{ic.trash}</button>
        )}
      </div>
      <PicNoteLine note={bad} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Picture tiles: a row of pictures with names and links              */
/* ------------------------------------------------------------------ */

type TilesEl = Extract<SectionConfig, { type: "tiles" }>;
type BannersEl = Extract<SectionConfig, { type: "banners" }>;

/* Words of the lists below (tiles, banners, chips, menu items, own links, footer columns): the name a thing has while he has
   not written one, each field's name, and an example in it */
const listB = {
  en: {
    newTile: "New picture", tileName: "Name on the picture (Optional)", tileNamePh: "For example: Dresses", tilePic: "What shows in the frame",
    newBanner: "New banner", bannerPic: "Banner picture", bannerEyebrowPh: "For example: SUMMER 2026", bannerTitlePh: "For example: New collection", bannerTextPh: "For example: Discover what is new in our store", bannerButtonPh: "For example: Shop now",
    newChip: "New button", chipPh: "For example: Summer sale",
    newLink: "New link", linkPh: "For example: Contact us", colPh: "For example: Help",
    examplePrefix: "For example:",
  },
  ar: {
    newTile: "صورة جديدة", tileName: "الاسم على الصورة (اختياري)", tileNamePh: "مثال: فساتين", tilePic: "ما يظهر في الإطار",
    newBanner: "بنر جديد", bannerPic: "صورة البنر", bannerEyebrowPh: "مثال: صيف 2026", bannerTitlePh: "مثال: تشكيلة جديدة", bannerTextPh: "مثال: اكتشف الجديد في متجرنا", bannerButtonPh: "مثال: تسوّق الآن",
    newChip: "زر جديد", chipPh: "مثال: تخفيضات الصيف",
    newLink: "رابط جديد", linkPh: "مثال: تواصل معنا", colPh: "مثال: المساعدة",
    examplePrefix: "مثال:",
  },
};

/** A switch alone (its name is the card's name beside it), for a list card's on/off */
function OnOff({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="relative flex cursor-pointer items-center" title={label}>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} aria-label={label} className="peer sr-only" />
      <span aria-hidden dir="ltr" className="relative h-5 w-9 shrink-0 rounded-full bg-fg/20 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-checked:[&>span]:left-[18px]">
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all" />
      </span>
    </label>
  );
}

/** Inside an open card of a list that is also dragged by its grip: move it one place up or down without dragging */
function MoveRow({ lang, first, last, onMove }: { lang: Lang; first: boolean; last: boolean; onMove: (d: -1 | 1) => void }) {
  const a = dc[lang].actions;
  const btn = "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-fg/15 text-xs font-semibold text-fg/80 transition hover:bg-soft disabled:opacity-35 disabled:hover:bg-transparent [&_svg]:h-3.5 [&_svg]:w-3.5";
  return (
    <div className="flex gap-2">
      <button type="button" className={btn} disabled={first} onClick={() => onMove(-1)}>{ic.up}{a.up}</button>
      <button type="button" className={btn} disabled={last} onClick={() => onMove(1)}>{ic.down}{a.down}</button>
    </div>
  );
}

/** Two small arrows, one over the other, beside a list card's name: move it up or down the list */
function StackArrows({ lang, first, last, onMove }: { lang: Lang; first: boolean; last: boolean; onMove: (d: -1 | 1) => void }) {
  const a = dc[lang].actions;
  const btn = "grid h-[18px] w-6 place-items-center rounded text-muted transition hover:bg-fg/10 hover:text-fg disabled:opacity-25 disabled:hover:bg-transparent [&_svg]:h-3.5 [&_svg]:w-3.5";
  return (
    <div className="-ms-1 flex shrink-0 flex-col pt-0.5">
      <button type="button" className={btn} disabled={first} onClick={() => onMove(-1)} aria-label={a.up} title={a.up}>{ic.up}</button>
      <button type="button" className={btn} disabled={last} onClick={() => onMove(1)} aria-label={a.down} title={a.down}>{ic.down}</button>
    </div>
  );
}

function TilesForm({ lang, s, onChange, text }: { lang: Lang; s: TilesEl; onChange: (s: SectionConfig) => void; text: (v: { en: string; ar: string }, set: (b: { en: string; ar: string }) => void, label: string, area?: boolean, field?: string, more?: React.ReactNode) => React.ReactNode }) {
  const t = dc[lang].form;
  const lx = dc[lang].luxe;
  const items = s.settings.items ?? [];
  const [bad, setBad] = useState<PicNote>(null);
  const set = (patch: Partial<TilesEl["settings"]>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
  const edit = (i: number, patch: Partial<Tile>) => set({ items: items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    set({ items: n });
  };
  /* the pictures just added are cropped one after another, each in its own card; the tiles show each cut as he moves it */
  const [queue, setQueue] = useState<{ key: string; src: string }[]>([]);
  const cropping = queue[0];
  const add = async (files: FileList | null) => {
    if (!files) return;
    const read = await Promise.all(Array.from(files).map((f) => readPicture(f, lang, { max: 900 })));
    const ok = read.map((r) => r.url).filter((u): u is string => !!u);
    /* the first refusal, else the first warning */
    setBad(read.find((r) => r.note?.tone === "error")?.note ?? read.find((r) => r.note)?.note ?? null);
    const added = ok.map((image) => ({ key: newKey(), image, label: { en: "", ar: "" }, link: "" })).slice(0, Math.max(0, 10 - items.length));
    set({ items: [...items, ...added] });
    setQueue((q) => [...q, ...added.filter((x) => cuttable(x.image)).map((x) => ({ key: x.key, src: x.image }))]);
  };

  return (
    <>
      {text(s.settings.title, (title) => set({ title }), t.title, false, "title", <TitleLookFields lang={lang} value={s.titleLook} onChange={(titleLook) => onChange({ ...s, titleLook })} />)}
      <p className="text-xs leading-relaxed text-muted">{t.tilesHint}</p>

      {items.length > 0 && (
        <ItemList>
          {items.map((x, i) => (
            <ItemCard
              key={x.key ?? i}
              lang={lang}
              name={x.label?.[lang]?.trim() || x.label?.[lang === "ar" ? "en" : "ar"]}
              empty={listB[lang].newTile}
              /* eslint-disable-next-line @next/next/no-img-element */
              icon={<img src={x.image} alt="" className="h-8 w-7 shrink-0 rounded-md object-cover ring-1 ring-black/10" />}
              extra={<StackArrows lang={lang} first={i === 0} last={i === items.length - 1} onMove={(d) => move(i, d)} />}
              force={!!cropping && cropping.key === x.key}
              onRemove={() => {
                setQueue((q) => q.filter((c) => c.key !== x.key));
                set({ items: items.filter((_, j) => j !== i) });
              }}
              removeLabel={t.removeTile}
            >
              {cropping && cropping.key === x.key && (
                <ImageCropper
                  lang={lang}
                  src={cropping.src}
                  shapes={s.settings.style === "circles" ? ["square", "tall", "original"] : ["tall", "square", "original"]}
                  out={900}
                  type="image/jpeg"
                  onLive={(image) => edit(i, { image })}
                  onCancel={() => {
                    setQueue((q) => q.slice(1));
                    set({ items: items.filter((_, j) => j !== i) });
                  }}
                  onDone={(image) => {
                    setQueue((q) => q.slice(1));
                    edit(i, { image });
                  }}
                />
              )}
              <Field label={listB[lang].tileName}>
                <input value={x.label?.[lang] ?? ""} onChange={(e) => edit(i, { label: { ...(x.label ?? { en: "", ar: "" }), [lang]: e.target.value } })} placeholder={listB[lang].tileNamePh} aria-label={t.tileLabel} maxLength={40} className={`${input} h-10`} />
                <CharCount value={x.label?.[lang] ?? ""} max={40} />
                <RudeNote lang={lang} text={x.label?.[lang]} />
              </Field>
              <LinkPicker lang={lang} value={x.link} onChange={(link) => edit(i, { link })} label={t.tileLink} />
              {/* drag the picture to choose which part shows in its frame (the circle, or the tall card) */}
              {cropping?.key !== x.key && (
                <Field label={listB[lang].tilePic}>
                  <PictureMover lang={lang} image={x.image} value={x.pos} onChange={(pos) => edit(i, { pos })} fill ratio={s.settings.style === "circles" ? "1 / 1" : s.settings.style === "editorial" ? "4 / 3" : "4 / 5"} radius={s.settings.style === "circles" ? "999px" : "12px"} />
                </Field>
              )}
              <Blocked when={s.settings.style !== "editorial"} why={why(lang, `غير متاح لأن «${lx.tilesStyle}» ليس «${lx.tilesEditorial}».`, `Not available because “${lx.tilesStyle}” isn't “${lx.tilesEditorial}”.`)}>
                <Field label={lx.tileChip}>
                  <Seg value={x.chip ?? "light"} onChange={(chip) => edit(i, { chip })} options={[{ key: "light", label: lx.chipLight }, { key: "dark", label: lx.chipDark }]} />
                </Field>
              </Blocked>
            </ItemCard>
          ))}
        </ItemList>
      )}

      <AddLimited count={items.length} max={10} label={t.addTile} words={limitWords[lang].pictures} multiple onPick={(el) => void add(el.files).then(() => { el.value = ""; })} />
      <PicNoteLine note={bad} />
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
  /* what each banner's words sit on, as the store draws it, so a color that vanishes there is warned about */
  const page = useContext(PageLookNow);
  const storeColor = useContext(StoreColorNow);
  const t = dc[lang].form;
  const lx = dc[lang].luxe;
  const items = s.settings.items ?? [];
  const set = (next: Banner[]) => onChange({ ...s, settings: { ...s.settings, items: next } });
  /* the banner's display fonts, named as in the store's one font list */
  const fontName = (k: DisplayFont) => storeFonts.find((f) => f.key === k)?.name[lang] ?? k;
  const fonts: { key: DisplayFont; label: string }[] = [{ key: "default", label: lx.fontDefault }, { key: "ruqaa", label: fontName("ruqaa") }, { key: "lemonada", label: fontName("lemonada") }, { key: "amiri", label: fontName("amiri") }];
  const edit = (i: number, patch: Partial<Banner>) => set(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  /* The "color card" look has no frosted panel, outline button or fixed height: those fields belong to the photo look only */
  const anyPhoto = items.some((x) => x.variant !== "card");
  const bi = (i: number, k: "title" | "text" | "button" | "eyebrow", v: string) => edit(i, { [k]: { ...(items[i][k] ?? { en: "", ar: "" }), [lang]: v } } as Partial<Banner>);

  return (
    <>
      <p className="text-xs leading-relaxed text-muted">{t.bannersHint}</p>
      <Blocked when={!anyPhoto} why={why(lang, `غير متاح لأن لا يوجد بنر «${popT[lang].bannerVariant}» فيه «${popT[lang].variantPhoto}».`, `Not available because no banner has “${popT[lang].bannerVariant}” set to “${popT[lang].variantPhoto}”.`)}>
      <Part lang={lang} label={lx.bannerHeight}>
        <Seg value={s.settings.height ?? "normal"} onChange={(height) => onChange({ ...s, settings: { ...s.settings, height } })} options={[{ key: "normal", label: lx.heightNormal }, { key: "tall", label: lx.heightTall }]} />
      </Part>
      </Blocked>
      <ItemList>
      {items.map((x, i) => (
        <ItemCard
          key={i}
          lang={lang}
          name={x.title?.[lang]?.trim() || x.title?.[lang === "ar" ? "en" : "ar"]}
          empty={listB[lang].newBanner}
          icon={<span aria-hidden className="h-6 w-6 shrink-0 rounded-md ring-1 ring-black/10" style={{ background: x.variant === "card" ? x.bg || "#b9f3d0" : x.image ? `center / cover url(${x.image})` : "linear-gradient(135deg, #7a3ea1, #2f6fde)" }} />}
          onRemove={() => set(items.filter((_, j) => j !== i))}
          removeLabel={t.removeBanner}
        >
          <Part lang={lang} label={popT[lang].bannerVariant}>
            <Seg lang={lang} value={x.variant ?? "photo"} onChange={(variant) => edit(i, { variant })} options={[{ key: "photo", label: popT[lang].variantPhoto }, { key: "card", label: popT[lang].variantCard, theme: "lamma" }]} />
          </Part>
          {x.variant === "card" && (
            <FromTheme.Provider value="lamma">
              <Part lang={lang} label={popT[lang].cardColor}>
                <FillPicker lang={lang} value={x.bg ?? ""} fallback="#b9f3d0" onChange={(bg) => edit(i, { bg })} label={popT[lang].cardColor} list={popPastels} />
              </Part>
              <div className="space-y-3">
                <p className="flex items-center gap-1 text-sm font-semibold">{popT[lang].morePics}<ThemeMark lang={lang} theme="lamma" /></p>
                <p className="text-xs leading-relaxed text-muted">{popT[lang].morePicsHint}</p>
                {(x.images ?? []).map((img, k) => (
                  <div key={k} className="space-y-2 rounded-xl border border-fg/10 p-2.5">
                    <PhotoPicker lang={lang} value={img} onChange={(v) => edit(i, { images: (x.images ?? []).map((y, j) => (j === k ? v : y)), imagesPos: (x.imagesPos ?? []).map((y, j) => (j === k ? undefined : y)) })} max={1200} />
                    <PictureMover lang={lang} image={img} value={x.imagesPos?.[k]} onChange={(pos) => edit(i, { imagesPos: Array.from({ length: Math.max(k + 1, (x.imagesPos ?? []).length) }, (_, j) => (j === k ? pos : x.imagesPos?.[j])) })} fill ratio="3 / 4" radius="14px" />
                    <button type="button" onClick={() => edit(i, { images: (x.images ?? []).filter((_, j) => j !== k), imagesPos: (x.imagesPos ?? []).filter((_, j) => j !== k) })} className="text-xs font-semibold text-rose-600 hover:underline">{popT[lang].removePic}</button>
                  </div>
                ))}
                <AddLimited compact count={(x.images ?? []).length} max={3} label={popT[lang].addPic} words={limitWords[lang].pictures} onAdd={() => edit(i, { images: [...(x.images ?? []), ""] })} />
              </div>
                      <Part lang={lang} label={popT[lang].shape}>
                <Seg value={x.shape ?? "arch"} onChange={(shape) => edit(i, { shape })} options={[{ key: "arch", label: popT[lang].shapeArch }, { key: "tilt", label: popT[lang].shapeTilt }]} />
              </Part>
            </FromTheme.Provider>
          )}
          <Field label={listB[lang].bannerPic}>
            <div className="space-y-3">
              <PhotoPicker lang={lang} value={x.image} onChange={(image) => edit(i, { image, pos: undefined })} max={1600} />
              <PictureMover lang={lang} image={x.image} value={x.pos} onChange={(pos) => edit(i, { pos })} ratio={x.variant === "card" ? "3 / 4" : "16 / 9"} radius={x.variant === "card" ? (x.shape === "tilt" ? "20px" : "999px 999px 20px 20px") : "12px"} />
            </div>
          </Field>
          {/* every part of the banner on its own: its box, and its own options behind the ▾ */}
          <div className="divide-y divide-fg/10 [&>*]:py-4">
            <Part lang={lang} label={t.bannerTitle} more={
              <>
                <StyleBar lang={lang} value={x.styles?.title} onChange={(v) => edit(i, { styles: { ...(x.styles ?? {}), title: v } })} boldNow />
                <Field label={lx.bannerFont}>
                  <Seg value={x.font ?? "default"} onChange={(font) => edit(i, { font })} options={fonts} />
                </Field>
                <Stepper lang={lang} label={lx.titleSize} value={x.titleSize ?? (x.variant === "card" ? 64 : 84)} auto={x.titleSize === undefined} min={20} max={200} onChange={(titleSize) => edit(i, { titleSize })} onReset={() => edit(i, { titleSize: undefined })} />
                <ColorChip lang={lang} label={lx.bannerTitleColor} value={x.titleColor} auto={x.variant === "card" ? textNow : x.panel === "light" ? "#5a3a34" : x.panel === "dark" ? "#e9dfcf" : "#ffffff"} onChange={(titleColor) => edit(i, { titleColor })} onReset={() => edit(i, { titleColor: undefined })} on={bannerSurface(x, page.primary, storeColor)} />
              </>
            }>
              <input value={x.title?.[lang] ?? ""} onChange={(e) => bi(i, "title", e.target.value)} placeholder={listB[lang].bannerTitlePh} aria-label={t.bannerTitle} maxLength={60} className={`${input} h-10`} />
              <CharCount value={x.title?.[lang] ?? ""} max={60} />
              <RudeNote lang={lang} text={x.title?.[lang]} />
            </Part>
            <Part lang={lang} label={t.bannerText} more={
              <>
                <StyleBar lang={lang} value={x.styles?.text} onChange={(v) => edit(i, { styles: { ...(x.styles ?? {}), text: v } })} boldNow={false} />
                <Field label={lx.bannerTextFont}>
                  <Seg value={x.textFont ?? "default"} onChange={(textFont) => edit(i, { textFont })} options={fonts} />
                </Field>
                <Stepper lang={lang} label={lx.textSize} value={x.textSize ?? (x.textFont && x.textFont !== "default" ? 20 : 15)} auto={x.textSize === undefined} min={10} max={60} onChange={(textSize) => edit(i, { textSize })} onReset={() => edit(i, { textSize: undefined })} />
                <ColorChip lang={lang} label={lx.bannerTextColor} value={x.textColor} onChange={(textColor) => edit(i, { textColor })} onReset={() => edit(i, { textColor: undefined })} on={bannerSurface(x, page.primary, storeColor)} />
              </>
            }>
              <textarea value={x.text?.[lang] ?? ""} onChange={(e) => bi(i, "text", e.target.value)} placeholder={listB[lang].bannerTextPh} aria-label={t.bannerText} rows={2} maxLength={140} className={`${input} resize-none py-2.5`} />
              <CharCount value={x.text?.[lang] ?? ""} max={140} />
              <RudeNote lang={lang} text={x.text?.[lang]} />
            </Part>
            <Part lang={lang} label={lx.bannerEyebrow} more={
              <>
                <StyleBar lang={lang} value={x.styles?.eyebrow} onChange={(v) => edit(i, { styles: { ...(x.styles ?? {}), eyebrow: v } })} boldNow />
                {x.variant === "card" && <Stepper lang={lang} label={popT[lang].eyebrowSize} value={x.eyebrowSize ?? 24} auto={x.eyebrowSize === undefined} min={12} max={60} onChange={(eyebrowSize) => edit(i, { eyebrowSize })} onReset={() => edit(i, { eyebrowSize: undefined })} />}
                <ColorChip lang={lang} label={lx.bannerEyebrowColor} value={x.eyebrowColor} onChange={(eyebrowColor) => edit(i, { eyebrowColor })} onReset={() => edit(i, { eyebrowColor: undefined })} on={bannerSurface(x, page.primary, storeColor)} />
              </>
            }>
              <input value={x.eyebrow?.[lang] ?? ""} onChange={(e) => bi(i, "eyebrow", e.target.value)} placeholder={listB[lang].bannerEyebrowPh} aria-label={lx.bannerEyebrow} maxLength={40} className={`${input} h-10`} />
              <CharCount value={x.eyebrow?.[lang] ?? ""} max={40} />
              <RudeNote lang={lang} text={x.eyebrow?.[lang]} />
            </Part>
            <Part lang={lang} label={t.bannerButton} more={
              <>
                <Blocked when={x.variant === "card"} why={why(lang, `غير متاح لأن «${popT[lang].bannerVariant}» ليس «${popT[lang].variantPhoto}».`, `Not available because “${popT[lang].bannerVariant}” isn't “${popT[lang].variantPhoto}”.`)}>
                  <Field label={lx.bannerButtonStyle}>
                    <Seg value={x.buttonStyle ?? "filled"} onChange={(buttonStyle) => edit(i, { buttonStyle })} options={[{ key: "filled", label: lx.btnFilled }, { key: "outline", label: lx.btnOutline }]} />
                  </Field>
                </Blocked>
                <ColorChip lang={lang} label={lx.bannerButtonColor} value={x.accent} onChange={(accent) => edit(i, { accent })} onReset={() => edit(i, { accent: undefined })} on={x.variant !== "card" && x.buttonStyle === "outline" ? bannerSurface(x, page.primary, storeColor) : undefined} />
              </>
            }>
              <input value={x.button?.[lang] ?? ""} onChange={(e) => bi(i, "button", e.target.value)} placeholder={listB[lang].bannerButtonPh} aria-label={t.bannerButton} maxLength={30} className={`${input} h-10`} />
              <CharCount value={x.button?.[lang] ?? ""} max={30} />
              <RudeNote lang={lang} text={x.button?.[lang]} />
              <Leads lang={lang} label={t.bannerLink} value={x.link} onChange={(link) => edit(i, { link })} />
            </Part>
            <Blocked when={x.variant === "card"} why={why(lang, `غير متاح لأن «${popT[lang].bannerVariant}» ليس «${popT[lang].variantPhoto}».`, `Not available because “${popT[lang].bannerVariant}” isn't “${popT[lang].variantPhoto}”.`)}>
              <div className="space-y-3">
                <Part lang={lang} label={lx.bannerPanel}>
                  <Seg value={x.panel ?? "none"} cols={3} onChange={(panel) => edit(i, { panel })} options={[{ key: "none", label: lx.panelNone }, { key: "light", label: lx.panelLight }, { key: "dark", label: lx.panelDark }]} />
                </Part>
                <Blocked when={!(x.panel === "light" || x.panel === "dark")} why={why(lang, `غير متاح لأن «${lx.bannerPanel}» هو «${lx.panelNone}».`, `Not available because “${lx.bannerPanel}” is “${lx.panelNone}”.`)}>
                  <div className="space-y-3">
                    <Part lang={lang} label={lx.bannerPanelColor}>
                      <ColorPicker value={x.panelColor || (x.panel === "dark" ? "#12100d" : "#fff5f8")} onChange={(panelColor) => edit(i, { panelColor })} label={lx.bannerPanelColor} bad={dc[lang].identity.hexBad} list={["#fff5f8", "#ffffff", "#f4efe6", "#12100d", "#16120f", "#004956", "#b03a5b"]} />
                      {x.panelColor && (
                        <button type="button" onClick={() => edit(i, { panelColor: "" })} className="mt-2 text-sm font-semibold text-primary hover:underline">{lx.bannerPanelAuto}</button>
                      )}
                    </Part>
                    <Part lang={lang} label={lx.bannerPosition}>
                      <Seg value={x.position ?? "top-start"} onChange={(position) => edit(i, { position })} options={[{ key: "top-start", label: lx.posTopStart }, { key: "top-end", label: lx.posTopEnd }, { key: "bottom-start", label: lx.posBottomStart }, { key: "bottom-end", label: lx.posBottomEnd }, { key: "center", label: popT[lang].bannerCenter }]} />
                    </Part>
                  </div>
                </Blocked>
                {/* with no panel the words sit at the bottom of the picture, or in the middle */}
                <Blocked when={(x.panel ?? "none") !== "none"} why={why(lang, `غير متاح لأن «${lx.bannerPanel}» ليس «${lx.panelNone}».`, `Not available because “${lx.bannerPanel}” isn't “${lx.panelNone}”.`)}>
                  <Part lang={lang} label={popT[lang].heroTextPos}>
                    <Seg value={x.position === "center" ? "center" : "bottom-start"} onChange={(position) => edit(i, { position })} options={[{ key: "bottom-start", label: lx.posBottomStart }, { key: "center", label: popT[lang].bannerCenter }]} />
                  </Part>
                </Blocked>
              </div>
            </Blocked>
          </div>
        </ItemCard>
      ))}
      </ItemList>

      {/* up to 12 (what a saved design keeps); three sit in a row and the rest go on the next rows */}
      <AddLimited count={items.length} max={12} label={t.addBanner} words={limitWords[lang].banners} onAdd={() => set([...items, { image: "", title: { en: "", ar: "" }, text: { en: "", ar: "" }, button: { en: "", ar: "" }, link: "", variant: items[items.length - 1]?.variant }])} />
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
          <li key={i} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <input value={w[lang] ?? ""} onChange={(e) => set({ items: items.map((x, j) => (j === i ? { ...x, [lang]: e.target.value } : x)) })} placeholder={lx.ribbonWord} aria-label={lx.ribbonWord} maxLength={24} className={`${input} h-10`} />
              <CharCount value={w[lang] ?? ""} max={24} />
              <RudeNote lang={lang} text={w[lang]} />
            </div>
            <button type="button" className={`${roundBtnSm} mt-1.5 hover:!text-rose-600`} onClick={() => set({ items: items.filter((_, j) => j !== i) })} aria-label={lx.ribbonRemove} title={lx.ribbonRemove}>{ic.trash}</button>
          </li>
        ))}
      </ol>
      <AddLimited count={items.length} max={12} label={lx.ribbonAdd} words={limitWords[lang].words} onAdd={() => set({ items: [...items, { en: "", ar: "" }] })} />
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
      <ItemList>
      {items.map((x, i) => (
        <div
          key={x.key ?? i}
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
          className={`rounded-2xl transition ${overAt === i && dragAt !== null && dragAt !== i ? "ring-2 ring-primary/50" : ""} ${dragAt === i ? "opacity-40" : ""}`}
        >
          <ItemCard
            lang={lang}
            name={x.label[lang]?.trim() || x.label[lang === "ar" ? "en" : "ar"]}
            empty={listB[lang].newChip}
            icon={<span aria-hidden className="h-5 w-5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: x.color }} />}
            extra={
              <span aria-hidden title={t.actions.drag} onMouseDown={() => setHandle(i)} onMouseUp={() => setHandle(null)} className="-ms-1 grid h-7 w-6 shrink-0 cursor-grab place-items-center text-muted/70 active:cursor-grabbing">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><circle cx="9" cy="6" r="1.500" /><circle cx="15" cy="6" r="1.500" /><circle cx="9" cy="12" r="1.500" /><circle cx="15" cy="12" r="1.500" /><circle cx="9" cy="18" r="1.500" /><circle cx="15" cy="18" r="1.500" /></svg>
              </span>
            }
            onRemove={() => set(items.filter((_, j) => j !== i))}
            removeLabel={pp.chipRemove}
          >
            <Field label={pp.chipLabel}>
              <input value={x.label[lang] ?? ""} onChange={(e) => edit(i, { label: { ...x.label, [lang]: e.target.value } })} placeholder={listB[lang].chipPh} aria-label={pp.chipLabel} maxLength={24} className={`${input} h-10`} />
              <CharCount value={x.label[lang] ?? ""} max={24} />
              <RudeNote lang={lang} text={x.label[lang]} />
            </Field>
            <Part lang={lang} label={pp.chipColor}>
              <ColorPicker value={x.color} onChange={(color) => edit(i, { color })} label={pp.chipColor} bad={dc[lang].identity.hexBad} list={popPastels} />
            </Part>
            <Part lang={lang} label={pp.chipLink}>
              <LinkPicker lang={lang} value={x.link} onChange={(link) => edit(i, { link })} label={pp.chipLink} />
            </Part>
          </ItemCard>
        </div>
      ))}
      </ItemList>
      <AddLimited count={items.length} max={8} label={pp.chipAdd} words={limitWords[lang].buttons} onAdd={() => set([...items, { key: newKey(), label: { en: "", ar: "" }, color: "#ff8fb1", link: "" }])} />

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

function NewsletterForm({ lang, s, onChange, text }: { lang: Lang; s: NewsEl; onChange: (s: SectionConfig) => void; text: (v: { en: string; ar: string }, set: (b: { en: string; ar: string }) => void, label: string, area?: boolean, field?: string, more?: React.ReactNode) => React.ReactNode }) {
  const pp = popT[lang];
  const set = (patch: Partial<NewsEl["settings"]>) => onChange({ ...s, settings: { ...s.settings, ...patch } });
  const st = s.settings;
  return (
    <>
      <p className="text-xs leading-relaxed text-muted">{pp.nHint}</p>
      {text(st.title, (title) => set({ title }), pp.nTitle, false, "title")}
      {text(st.accentWord, (accentWord) => set({ accentWord }), pp.nAccent)}
      {text(st.text, (t) => set({ text: t }), pp.nText, false, "text", <SubFontField lang={lang} value={s.subFont} onChange={(subFont) => onChange({ ...s, subFont })} />)}
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
            {text(pop.title, (title) => setPop({ title }), pp.popTitle, false, "popup")}
            {text(pop.text, (t) => setPop({ text: t }), pp.popText, true, "popup", <SubFontField lang={lang} value={pop.textFont} onChange={(textFont) => setPop({ textFont })} />)}
            {text(pop.button, (button) => setPop({ button }), pp.popButton, false, "popup")}
            <Part lang={lang} label={pp.popBg} field="popup">
              <FillPicker lang={lang} value={pop.background} fallback="#ffffff" onChange={(background) => setPop({ background })} label={pp.popBg} list={["#ffffff", "#fff6ea", "#b9f3d0", "#ffe36e", "#2b1b47"]} />
            </Part>
            <Part lang={lang} label={pp.popAccent} field="popup">
              <ColorPicker value={pop.accent} onChange={(accent) => setPop({ accent })} label={pp.popAccent} bad={dc[lang].identity.hexBad} list={["#ffe36e", "#ff8fb1", "#b9f3d0", "#c9b6ff", "#ffffff"]} />
            </Part>
            <Part lang={lang} label={pp.popPic} field="popup">
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
  const storePages = useStorePages(lang);
  const [cats, setCats] = useState<string[]>([]);
  useEffect(() => setCats(storeCategories(readProducts(), lang)), [lang]);
  /* what each group would list in the store, with the key the store uses for it */
  const groupRows = (kind: (typeof items)[number]["kind"]): { key: string; title: string; on?: boolean }[] => {
    if (kind === "categories") return cats.map((c) => ({ key: c, title: c }));
    if (kind === "pages") return storePages.map((p) => ({ key: String(p.id), title: p.title }));
    if (kind === "links") return cfg.nav.links.map((l, i) => ({ key: String(i), title: l[lang]?.trim() || l[lang === "ar" ? "en" : "ar"]?.trim() || `#${i + 1}` }));
    return (cfg.drawer.custom ?? []).map((x) => ({ key: x.id, title: x.label[lang]?.trim() || x.label[lang === "ar" ? "en" : "ar"]?.trim() || "…", on: x.visible }));
  };
  /* his own links have their own switch, so ticking one here is that switch; the other groups keep a list of what is left out */
  const include = (i: number, kind: (typeof items)[number]["kind"], key: string, on: boolean) => {
    if (kind === "custom") return setCfg((c) => ({ ...c, drawer: { ...c.drawer, custom: (c.drawer.custom ?? []).map((x) => (x.id === key ? { ...x, visible: on } : x)) } }));
    set(items.map((x, j) => (j === i ? { ...x, hidden: on ? (x.hidden ?? []).filter((k) => k !== key) : [...(x.hidden ?? []), key] } : x)));
  };
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
      <ItemList>
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
          className={`rounded-2xl transition ${overAt === i && dragAt !== null && dragAt !== i ? "ring-2 ring-primary/50" : ""} ${dragAt === i ? "opacity-40" : ""}`}
        >
          <ItemCard
            lang={lang}
            name={names[it.kind].split(": ")[0]}
            empty={drawerHeading(it.kind, lang)}
            extra={
              <span aria-hidden title={t.actions.drag} onMouseDown={() => setHandle(i)} onMouseUp={() => setHandle(null)} className="-ms-1 grid h-7 w-6 shrink-0 cursor-grab place-items-center text-muted/70 active:cursor-grabbing">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><circle cx="9" cy="6" r="1.500" /><circle cx="15" cy="6" r="1.500" /><circle cx="9" cy="12" r="1.500" /><circle cx="15" cy="12" r="1.500" /><circle cx="9" cy="18" r="1.500" /><circle cx="15" cy="18" r="1.500" /></svg>
              </span>
            }
            end={<OnOff on={it.visible} onChange={(visible) => set(items.map((x, j) => (j === i ? { ...x, visible } : x)))} label={it.title?.[lang]?.trim() || drawerHeading(it.kind, lang)} />}
          >
              <Field label={pp.dName}>
                <input value={it.title?.[lang] ?? ""} onChange={(e) => set(items.map((x, j) => (j === i ? { ...x, title: { ...(x.title ?? { en: "", ar: "" }), [lang]: e.target.value } } : x)))} placeholder={`${listB[lang].examplePrefix} ${drawerHeading(it.kind, lang)}`} maxLength={40} className={`${input} h-10`} />
                <CharCount value={it.title?.[lang] ?? ""} max={40} />
                <RudeNote lang={lang} text={it.title?.[lang]} />
                <span className="mt-1 block text-[11px] text-muted">{names[it.kind].split(": ")[1]}</span>
              </Field>
              <div>
                <p className="mb-1.5 text-xs font-semibold text-fg/80">{pp.dIncludes[it.kind]}</p>
                {groupRows(it.kind).length === 0 ? (
                  <p className="text-xs text-muted">{it.kind === "links" ? pp.dEmptyLinks : pp.dEmpty}</p>
                ) : (
                  <ul className="divide-y divide-fg/10 rounded-lg border border-fg/10">
                    {groupRows(it.kind).map((r) => {
                      const on = it.kind === "custom" ? r.on : !(it.hidden ?? []).includes(r.key);
                      return (
                        <li key={r.key}>
                          <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm">
                            <input type="checkbox" checked={on} onChange={(e) => include(i, it.kind, r.key, e.target.checked)} className="h-4 w-4 accent-[rgb(var(--primary))]" />
                            <span className={`min-w-0 truncate ${on ? "" : "text-muted line-through"}`}>{r.title}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
          </ItemCard>
        </div>
      ))}
      </ItemList>
      <div className="pt-3">
        <OwnLinksForm lang={lang} tabs={cfg.drawer.custom ?? []} update={(fn) => setCfg((c) => ({ ...c, drawer: { ...c.drawer, custom: fn(c.drawer.custom ?? []) } }))} title={pp.menuLinksTitle} hint={pp.menuLinksHint} add={pp.menuLinkAdd} others={otherLinks(cfg, lang, "menu")} web={false} />
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
  /* a web address, by the same check as every other link of the footer */
  return okWeb(l) ? null : "web";
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
function OwnLinksForm({ lang, tabs, update, title, hint, add, others = [], web = true }: { lang: Lang; tabs: Tabs; update: (fn: (prev: Tabs) => Tabs) => void; title: string; hint: string; add: string; others?: { key: string; from: string; links: Tabs }[]; /* false: the links lead only inside the store (no web address), like the sidebar's */ web?: boolean }) {
  const pp = popT[lang];
  const ol = dc[lang].ownLinks;
  const other = lang === "ar" ? "en" : "ar";
  const [dragAt, setDragAt] = useState<number | null>(null);
  const [overAt, setOverAt] = useState<number | null>(null);
  const [handle, setHandle] = useGrip();
  /* the link whose trash was pressed: it asks before it goes */
  const [asking, setAsking] = useState<string | null>(null);
  /* the link just added: it opens so he can fill it */
  const [added, setAdded] = useState<string | null>(null);
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
      <ItemList>
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
            className={`rounded-2xl transition [&:has(button[aria-expanded=true])>p]:hidden ${overAt === i && dragAt !== null && dragAt !== i ? "ring-2 ring-primary/50" : ""} ${dragAt === i ? "opacity-40" : ""} ${x.visible ? "" : "opacity-70"}`}
          >
            <ItemCard
              lang={lang}
              name={x.label?.[lang]?.trim() || x.label?.[other]}
              empty={listB[lang].newLink}
              force={added === x.id}
              extra={<Grip lang={lang} onDown={() => setHandle(i)} />}
              end={<OnOff on={x.visible} onChange={(visible) => edit(x.id, { visible })} label={pp.tabShow} />}
              onRemove={() => setAsking(x.id)}
              removeLabel={pp.tabRemove}
            >
              <Field label={pp.tabLabel}>
                <input value={x.label?.[lang] ?? ""} onChange={(e) => { const v = linkWords(e.target.value); update((all) => all.map((y) => (y.id === x.id ? { ...y, label: { ...y.label, [lang]: v } } : y))); }} placeholder={x.label?.[other]?.trim() || listB[lang].linkPh} aria-label={pp.tabLabel} aria-invalid={noWords} maxLength={30} className={`${input} h-10`} />
                <CharCount value={x.label?.[lang] ?? ""} max={30} />
                <RudeNote lang={lang} text={x.label?.[lang]} />
                {noWords && <p className="mt-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">{ol.labelEmpty}</p>}
              </Field>
              <LinkPicker lang={lang} value={x.link} onChange={(link) => edit(x.id, { link })} label={pp.tabLabel} web={web} />
              {problem === "target" && <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{pp.linkPickTarget}</p>}
              {problem === "web" && <p role="alert" className="text-xs font-semibold text-rose-600">{ol.webBad}</p>}
              {problem === "page" && <p role="alert" className="text-xs font-semibold text-rose-600">{ol.pageGone}</p>}
              {tabs.length > 1 && <MoveRow lang={lang} first={i === 0} last={i === tabs.length - 1} onMove={(d) => move(i, i + d)} />}
              {asking === x.id && <LinkAsk lang={lang} onYes={() => { update((all) => all.filter((y) => y.id !== x.id)); setAsking(null); }} onNo={() => setAsking(null)} />}
            </ItemCard>
            {/* a problem shows under the card while it is folded (open, it shows by its field) */}
            {(noWords || problem) && <p className="mt-1 px-3 text-[11px] font-semibold text-amber-700 dark:text-amber-400">{noWords ? ol.labelEmpty : problem === "target" ? pp.linkPickTarget : problem === "web" ? ol.webBad : ol.pageGone}</p>}
          </div>
        );
      })}
      </ItemList>
      <AddLimited count={tabs.length} max={8} label={add} words={limitWords[lang].links} onAdd={() => { const n = newTab(); setAdded(n.id); update((all) => [...all, n]); }} />
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
      <ItemList>
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
            className={`rounded-2xl transition ${overAt === i && dragAt !== null && dragAt !== i ? "ring-2 ring-primary/50" : ""} ${dragAt === i ? "opacity-40" : ""}`}
          >
            <ItemCard
              lang={lang}
              name={name}
              empty={pp.colUntitled}
              force={open === col.id}
              extra={<Grip lang={lang} onDown={() => setHandle(i)} />}
              end={<OnOff on={on} onChange={(v) => setCfg((c) => ({ ...c, footer: colTurn(c.footer, col.id, v) }))} label={name || pp.colUntitled} />}
              onRemove={col.kind === "custom" ? () => setAsking(col.id) : undefined}
              removeLabel={pp.colRemove}
            >
            {/* links, contact, social and licenses: their words are filled in their own part of the screen (its title is at the top there) */}
            {sub && (
              <button type="button" onClick={() => go(sub)} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 text-sm font-semibold text-primary transition hover:bg-primary/10">
                {ic.edit}
                {pp.colContent}
              </button>
            )}
            {/* the name and about column: the logo-and-name switch and the about text sit right under it */}
            {col.kind === "about" && (
              <div className="space-y-2">
                {!on && <p className="text-xs text-muted">{pp.aboutColOff}</p>}
                <Toggle on={f.showLogo} onChange={(showLogo) => setCfg((c) => ({ ...c, footer: { ...c.footer, showLogo } }))} label={t.footer.showLogo} />
                <p className="text-xs text-muted">{f.showLogo && cfg.identity.showLogo === false ? pp.logoMarkHint : pp.logoNameHint}</p>
                <Part lang={lang} label={t.footerFields.about} hint={t.footerFields.aboutHint} field="about" preview={f.about[lang] || f.about[other]}>
                  <textarea data-field="about" value={f.about[lang]} onChange={(e) => { const v = e.target.value; setCfg((c) => ({ ...c, footer: { ...c.footer, about: { ...c.footer.about, [lang]: v } } })); }} rows={3} maxLength={200} aria-label={t.footerFields.about} className={`${input} resize-none py-3`} />
                  <CharCount value={f.about[lang] ?? ""} max={200} />
                  <RudeNote lang={lang} text={f.about[lang]} />
                </Part>
              </div>
            )}
            {/* the links column: where its links come from, and a quick way to add one */}
            {col.kind === "pages" && (
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="text-xs text-muted">{pp.pagesFrom.replace("{p}", String(pagesIn)).replace("{o}", String(ownTabs))}</span>
                {(f.tabs ?? []).length < 8 ? (
                  <button type="button" onClick={() => { setTabs((all) => [...all, newTab()]); go("links"); }} className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    {ic.plus}
                    {pp.tabAdd}
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">{limitWords[lang].links.full(8)}</span>
                )}
              </div>
            )}
            {col.kind === "custom" && (
              <div className="space-y-4">
                <Field label={pp.colTitle}>
                  <input value={col.title?.[lang] ?? ""} onChange={(e) => { const v = e.target.value; setCols((all) => all.map((x) => (x.id === col.id ? { ...x, title: { en: x.title?.en ?? "", ar: x.title?.ar ?? "", [lang]: v } } : x))); }} placeholder={col.title?.[other] || listB[lang].colPh} aria-label={pp.colTitle} maxLength={30} className={`${input} h-11`} />
                  <CharCount value={col.title?.[lang] ?? ""} max={30} />
                  <RudeNote lang={lang} text={col.title?.[lang]} />
                </Field>
                <OwnLinksForm lang={lang} tabs={col.links ?? []} update={(fn) => setCols((all) => all.map((x) => (x.id === col.id ? { ...x, links: fn(x.links ?? []) } : x)))} title={pp.colLinksTitle} hint={pp.colLinksHint} add={pp.tabAdd} others={otherLinks(cfg, lang, col.id)} />
              </div>
            )}
            <MoveRow lang={lang} first={i === 0} last={i === cols.length - 1} onMove={(d) => move(i, i + d)} />
            {asking === col.id && <LinkAsk lang={lang} text={pp.colAsk} onYes={() => { setCols((all) => all.filter((x) => x.id !== col.id)); setAsking(null); }} onNo={() => setAsking(null)} />}
            </ItemCard>
            {/* the licenses column is on but has nothing to show: said under it, folded or not */}
            {col.kind === "licenses" && on && !hasLicense(f) && (
              <div className="mt-1 px-3">
                <p className="text-xs text-amber-700 dark:text-amber-400">{pp.licensesEmpty}</p>
                <button type="button" onClick={() => go("licenses")} className="mt-1 text-xs font-semibold text-primary hover:underline">{pp.licensesOpen}</button>
              </div>
            )}
          </div>
        );
      })}
      </ItemList>
      <AddLimited
        count={cols.filter((x) => x.kind === "custom").length}
        max={4}
        label={pp.colAdd}
        words={limitWords[lang].columns}
        onAdd={() => {
          const id = newId("col");
          setCols((all) => [...all, { id, kind: "custom", visible: true, title: { en: popT.en.colDefault, ar: popT.ar.colDefault }, links: [] }]);
          setOpen(id);
        }}
      />
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
