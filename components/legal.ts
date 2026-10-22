/* Dukkan's own commercial registration, shown on the main page to build trust.
   The number on the page is a link to `url`, the Ministry of Industry and Trade companies register. */
export const commercialRegistration = {
  number: "016703",
  url: "https://ccr.mit.gov.jo/mitq/faces/HomePage",
};

export const registrationWords = {
  en: { verified: "Verified with a commercial registration", label: "Commercial registration number" },
  ar: { verified: "موثق بسجل تجاري", label: "رقم السجل التجاري" },
};

/* The trust section of the main page. It says only what the site already says elsewhere: the company is
   registered, where it is, and how to reach it. */
export const trustWords = {
  en: {
    tag: "Reliability",
    title: "A registered company you can check",
    sub: "Dukkan is a registered Jordanian company. Our commercial registration is public, and you can look it up yourself.",
    registered: "Registered with the Ministry of Industry and Trade",
    cards: [
      { title: "Commercial registration", body: "Registered with the Ministry of Industry and Trade. You can check our registration on the ministry's own register." },
      { title: "Based in Jordan", body: "Our team and our office are in Amman, so you deal with a company that is close to you, in your own language." },
      { title: "A real team to talk to", body: "Call or write to us at any time. Our contact details are on every page." },
    ],
    check: "Check the registration",
  },
  ar: {
    tag: "موثوقية",
    title: "شركة مسجّلة يمكنك التحقق منها",
    sub: "دكان شركة أردنية مسجّلة. سجلنا التجاري معلن، ويمكنك التحقق منه بنفسك.",
    registered: "مسجّلة لدى وزارة الصناعة والتجارة والتموين",
    cards: [
      { title: "سجل تجاري", body: "مسجّلة لدى وزارة الصناعة والتجارة والتموين. يمكنك التحقق من تسجيلنا في سجل الوزارة نفسه." },
      { title: "مقرّنا في الأردن", body: "فريقنا ومكتبنا في عمّان، فتتعامل مع شركة قريبة منك وبلغتك." },
      { title: "فريق حقيقي تتحدث معه", body: "اتصل بنا أو راسلنا في أي وقت. بيانات التواصل معنا في كل صفحة." },
    ],
    check: "تحقق من السجل",
  },
};
