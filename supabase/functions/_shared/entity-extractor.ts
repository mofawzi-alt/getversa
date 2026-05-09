// Shared entity extractor for Versa.
// Extracts canonical lowercase entity tags from any text (poll fields OR a user query).
// Designed to bridge English ↔ Arabic spellings so Ask Versa can match Sahel↔الساحل↔north coast.
//
// Usage:
//   import { extractEntities } from "../_shared/entity-extractor.ts";
//   const entities = extractEntities(`${poll.question} ${poll.option_a} ${poll.option_b} ${poll.subtitle ?? ""}`);
//
// Each entry maps a canonical key → list of substring aliases (lowercased, both EN and AR variants).
// Match logic: if any alias is a substring of the normalized text, the canonical key is added.

export const ENTITY_ALIASES: Record<string, string[]> = {
  // ---- Telecom ----
  vodafone: ["vodafone", "فودافون", "ڤودافون"],
  orange: ["orange eg", "orange egypt", "اورنج", "أورنج"],
  etisalat: ["etisalat", "اتصالات", "إتصالات"],
  we: ["we telecom", "we mobile", "وي تليكوم"],

  // ---- Tech / phones ----
  iphone: ["iphone", "ايفون", "آيفون"],
  samsung: ["samsung", "galaxy", "سامسونج", "سامسونغ"],
  apple: ["apple", "آبل", "ابل"],
  android: ["android", "اندرويد", "أندرويد"],
  huawei: ["huawei", "هواوي"],
  xiaomi: ["xiaomi", "شاومي"],

  // ---- FMCG / drinks ----
  coke: ["coca cola", "coca-cola", "coca", " coke ", "كوكاكولا", "كوكا كولا", "كوكا"],
  pepsi: ["pepsi", "بيبسي"],
  fanta: ["fanta", "فانتا"],
  sprite: ["sprite", "سبرايت"],
  schweppes: ["schweppes", "شويبس"],

  // ---- Coffee / cafes ----
  starbucks: ["starbucks", "ستاربكس"],
  costa: ["costa", "كوستا"],
  cilantro: ["cilantro", "سيلانترو"],
  beanos: ["beanos", "بينوز"],
  tseppas: ["tseppas", "تسيباس"],

  // ---- Food / dining ----
  mcdonalds: ["mcdonalds", "mcdonald", "ماكدونالدز", "ماك"],
  kfc: ["kfc", "كنتاكي", "كي اف سي"],
  hardees: ["hardees", "هارديز"],
  buffalo: ["buffalo burger", "بافلو"],
  shawarma: ["shawarma", "شاورما"],
  koshary: ["koshary", "koshari", "كشري"],
  fuul: ["fuul", "ful", "فول"],
  talabat: ["talabat", "طلبات"],
  elmenus: ["elmenus", "المنيوز"],
  breadfast: ["breadfast", "بريدفاست"],

  // ---- Retail / e-commerce ----
  carrefour: ["carrefour", "كارفور"],
  spinneys: ["spinneys", "سبينس"],
  metro: ["metro market", "مترو ماركت"],
  noon: ["noon.com", " noon ", "نون"],
  amazon: ["amazon", "أمازون", "امازون"],
  jumia: ["jumia", "جوميا"],
  ikea: ["ikea", "ايكيا", "إيكيا"],
  zara: ["zara", "زارا"],
  hm: ["h&m", " h m ", "اتش اند ام"],
  nike: ["nike", "نايك"],
  adidas: ["adidas", "أديداس", "اديداس"],

  // ---- Ride-hailing ----
  uber: ["uber", "اوبر", "أوبر"],
  careem: ["careem", "كريم"],
  swvl: ["swvl", "سويفل"],

  // ---- Universities ----
  auc: [" auc ", "american university in cairo", "الجامعة الامريكية"],
  guc: [" guc ", "german university in cairo", "الجامعة الالمانية"],
  bue: [" bue ", "british university in egypt"],
  msa: [" msa ", "modern sciences and arts"],
  giu: [" giu ", "german international university"],
  fue: [" fue ", "future university"],
  cairo_uni: ["cairo university", "جامعة القاهرة"],
  ain_shams: ["ain shams", "عين شمس"],
  alex_uni: ["alexandria university", "جامعة الاسكندرية"],

  // ---- Sports ----
  ahly: [" ahly", "al ahly", "الأهلي", "الاهلي"],
  zamalek: ["zamalek", "الزمالك"],
  realmadrid: ["real madrid", "ريال مدريد"],
  barcelona: ["barcelona", "barca", "برشلونة"],
  liverpool: ["liverpool", "ليفربول"],

  // ---- Places / cities / neighborhoods (the Sahel-class fix) ----
  sahel: ["sahel", "north coast", "الساحل", "الساحل الشمالي", "north-coast"],
  gouna: ["el gouna", "gouna", "الجونة"],
  marina: ["marina", "مارينا"],
  hacienda: ["hacienda", "هاسيندا"],
  ainsokhna: ["ain sokhna", "sokhna", "العين السخنة", "السخنة"],
  hurghada: ["hurghada", "الغردقة"],
  sharmelsheikh: ["sharm el sheikh", "sharm", "شرم الشيخ", "شرم"],
  dahab: ["dahab", "دهب"],
  siwa: ["siwa", "سيوة"],
  cairo: ["cairo", "القاهرة"],
  alex: ["alexandria", "alex ", "الاسكندرية", "الإسكندرية"],
  giza: [" giza", "الجيزة"],
  zamalek_area: ["zamalek district", "حي الزمالك"],
  maadi: ["maadi", "المعادي"],
  newcairo: ["new cairo", "القاهرة الجديدة"],
  zayed: ["sheikh zayed", "el sheikh zayed", "الشيخ زايد"],
  october: ["6th of october", "6 october", "6 اكتوبر", "أكتوبر"],
  rehab: ["el rehab", "الرحاب"],
  madinaty: ["madinaty", "مدينتي"],

  // ---- Banks / fintech ----
  cib: [" cib ", "commercial international bank", "سي اي بي"],
  qnb: [" qnb ", "qatar national bank"],
  nbe: [" nbe ", "national bank of egypt", "البنك الأهلي المصري"],
  banquemisr: ["banque misr", "بنك مصر"],
  instapay: ["instapay", "انستاباي"],
  fawry: ["fawry", "فوري"],
  vodafonecash: ["vodafone cash", "فودافون كاش"],
};

export const CANONICAL_KEYS = Object.keys(ENTITY_ALIASES);

const NORMALIZE_RE = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g; // strip Arabic diacritics
const ALEF_RE = /[إأآا]/g;
const YEH_RE = /[ىي]/g;

export function normalizeText(input: string): string {
  if (!input) return "";
  // Pad with spaces so word-boundary aliases like " auc " can match at start/end.
  let t = ` ${input.toLowerCase()} `;
  t = t.replace(NORMALIZE_RE, "");
  t = t.replace(ALEF_RE, "ا").replace(YEH_RE, "ي");
  // Collapse common punctuation to spaces but keep & and -.
  t = t.replace(/[^\p{L}\p{N}\s&\-]/gu, " ");
  t = t.replace(/\s+/g, " ");
  return t;
}

/** Extract canonical entity keys from any text (poll fields, user query, etc.). */
export function extractEntities(text: string): string[] {
  const haystack = normalizeText(text);
  if (!haystack.trim()) return [];
  const found = new Set<string>();
  for (const [key, aliases] of Object.entries(ENTITY_ALIASES)) {
    for (const alias of aliases) {
      const a = normalizeText(alias).trim();
      if (a && haystack.includes(a)) {
        found.add(key);
        break;
      }
    }
  }
  return Array.from(found);
}
