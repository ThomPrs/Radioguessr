// Génération des cartes QSL (pure, partagée front / serveur).

import { countryNameFr } from './countries.js';
import { countryLanguage } from './language.js';
import { hashString, mulberry32 } from './rng.js';
import { rarityFor, type Rarity } from './scoring.js';
import type { Continent, Station } from './types.js';

export interface QslCard {
  countryCode: string; // clé de l'album : une carte par pays
  stationId: string;
  stationName: string;
  callsign: string; // « CE · 3 »
  city: string;
  country: string; // nom français
  continent: Continent;
  lat: number;
  lon: number;
  frequency?: string;
  capturedAt: string; // ISO 8601
  distanceKm: number;
  sinpo: string; // « 55555 »
  rarity: Rarity;
  message: { lang: string; text: string };
  artSeed: number;
  source: 'world' | 'duel';
}

// Préfixes d'indicatifs radioamateurs UIT (simplifiés). Pays absent : code ISO.
const ITU_PREFIX_RAW = `
US:W CA:VE MX:XE GT:TG HN:HR SV:YS NI:YN CR:TI PA:HP CU:CO DO:HI HT:HH JM:6Y PR:KP4 BS:C6 BB:8P TT:9Y
CO:HK VE:YV EC:HC PE:OA BO:CP CL:CE AR:LU UY:CX PY:ZP BR:PY GY:8R SR:PZ GF:FY
GB:G IE:EI FR:F BE:ON NL:PA LU:LX DE:DL CH:HB AT:OE IT:I ES:EA PT:CT AD:C3 MC:3A DK:OZ NO:LA SE:SM FI:OH
IS:TF EE:ES LV:YL LT:LY PL:SP CZ:OK SK:OM HU:HA SI:S5 HR:9A BA:E7 RS:YU ME:4O MK:Z3 AL:ZA GR:SV BG:LZ
RO:YO MD:ER UA:UR BY:EW RU:R CY:5B MT:9H TR:TA GE:4L AM:EK AZ:4K XK:Z6 SM:T7 VA:HV LI:HB0 FO:OY GL:OX GI:ZB
EG:SU LY:5A TN:3V DZ:7X MA:CN SN:6W ML:TZ CI:TU GH:9G NG:5N CM:TJ KE:5Z TZ:5H UG:5X ET:ET ZA:ZS NA:V5
BW:A2 ZW:Z2 ZM:9J MZ:C9 AO:D2 CD:9Q MG:5R MU:3B RE:FR RW:9X SD:ST SO:6O BF:XT BJ:TY TG:5V NE:5U GN:3X CV:D4
CN:BY JP:JA KR:HL KP:P5 TW:BV HK:VR MO:XX9 MN:JT IN:VU PK:AP BD:S2 LK:4S NP:9N TH:HS VN:XV KH:XU LA:XW MM:XZ
MY:9M SG:9V ID:YB PH:DU IL:4X PS:E4 JO:JY LB:OD SY:YK IQ:YI IR:EP SA:HZ AE:A6 QA:A7 KW:9K BH:A9 OM:A4 YE:7O
AF:YA KZ:UN UZ:UK KG:EX TJ:EY TM:EZ AU:VK NZ:ZL FJ:3D2 PG:P2 NC:FK PF:FO GU:KH2 WS:5W TO:A3
`;
const ITU_PREFIX: Record<string, string> = Object.fromEntries(
  ITU_PREFIX_RAW.trim()
    .split(/\s+/)
    .map((pair) => pair.split(':') as [string, string]),
);

/** « Merci pour votre rapport d'écoute ! » dans la langue de la station. */
const THANKS: Record<string, string> = {
  en: 'Thank you for your reception report!',
  fr: 'Merci pour votre rapport d’écoute !',
  es: '¡Gracias por su informe de recepción!',
  pt: 'Obrigado pelo seu relatório de recepção!',
  de: 'Vielen Dank für Ihren Empfangsbericht!',
  it: 'Grazie per il vostro rapporto d’ascolto!',
  nl: 'Bedankt voor uw ontvangstrapport!',
  ca: 'Gràcies pel vostre informe d’escolta!',
  ro: 'Vă mulțumim pentru raportul de recepție!',
  pl: 'Dziękujemy za raport odbioru!',
  cs: 'Děkujeme za vaši zprávu o příjmu!',
  sk: 'Ďakujeme za vašu správu o príjme!',
  hu: 'Köszönjük a vételi jelentését!',
  sv: 'Tack för din mottagningsrapport!',
  no: 'Takk for mottaksrapporten din!',
  da: 'Tak for din modtagerrapport!',
  fi: 'Kiitos kuunteluraportistasi!',
  ru: 'Спасибо за ваш рапорт о приёме!',
  uk: 'Дякуємо за ваш звіт про прийом!',
  bg: 'Благодарим ви за доклада за приемане!',
  sr: 'Хвала на извештају о пријему!',
  hr: 'Hvala na izvješću o prijemu!',
  el: 'Ευχαριστούμε για την αναφορά λήψης σας!',
  tr: 'Dinleme raporunuz için teşekkürler!',
  ar: 'شكراً على تقرير الاستماع!',
  he: 'תודה על דוח הקליטה שלך!',
  fa: 'از گزارش دریافت شما سپاسگزاریم!',
  hi: 'आपकी श्रवण रिपोर्ट के लिए धन्यवाद!',
  zh: '感谢您的收听报告！',
  ja: '受信報告ありがとうございます！',
  ko: '수신 보고서를 보내 주셔서 감사합니다!',
  th: 'ขอบคุณสำหรับรายงานการรับฟัง!',
  vi: 'Cảm ơn bạn đã gửi báo cáo thu sóng!',
  id: 'Terima kasih atas laporan penerimaan Anda!',
  ms: 'Terima kasih atas laporan penerimaan anda!',
  tl: 'Salamat sa iyong ulat ng pagtanggap!',
  sw: 'Asante kwa ripoti yako ya usikilizaji!',
  af: 'Dankie vir u ontvangsverslag!',
};

export function thanksMessage(station: Station): { lang: string; text: string } {
  for (const code of [station.languageCode, countryLanguage(station.countryCode)]) {
    if (code && THANKS[code]) return { lang: code, text: THANKS[code] };
  }
  return { lang: 'en', text: THANKS.en! };
}

export function callsignFor(station: Station): string {
  const prefix = ITU_PREFIX[station.countryCode] ?? station.countryCode;
  const digit = hashString(station.id) % 10;
  return `${prefix} · ${digit}`;
}

/** Code SINPO : 5 chiffres, plus élevés quand le rapport est précis. */
export function sinpoFor(rarity: Rarity, seed: number): string {
  if (rarity === 'gold') return '55555';
  const [lo, hi] = rarity === 'high' ? [4, 5] : rarity === 'medium' ? [3, 4] : [2, 3];
  const rng = mulberry32(seed);
  return Array.from({ length: 5 }, () => (rng() < 0.5 ? lo : hi)).join('');
}

/** Raccourcit les noms à rallonge (« EXA FM Honduras: Tegucigalpa 100.5 FM / San Pedro… »). */
export function shortStationName(name: string, max = 34): string {
  let n = name.replace(/\s+/g, ' ').trim();
  if (n.length <= max) return n;
  const cut = n.split(/\s*(?:[:|/•]| - | – | — |\()\s*/)[0]?.trim();
  if (cut && cut.length >= 3) n = cut;
  return n.length <= max ? n : `${n.slice(0, max - 1).trimEnd()}…`;
}

export interface QslInput {
  station: Station;
  distanceKm: number;
  city: string | null;
  capturedAt?: Date;
  source?: 'world' | 'duel';
}

/** Carte QSL obtenue pour ce rapport, ou null si la distance dépasse 1 500 km. */
export function createQslCard({ station, distanceKm, city, capturedAt = new Date(), source = 'world' }: QslInput): QslCard | null {
  const rarity = rarityFor(distanceKm);
  if (!rarity) return null;
  const seed = hashString(station.id);
  const card: QslCard = {
    countryCode: station.countryCode,
    stationId: station.id,
    stationName: shortStationName(station.name),
    callsign: callsignFor(station),
    city: city ?? station.state ?? countryNameFr(station.countryCode),
    country: countryNameFr(station.countryCode),
    continent: station.continent,
    lat: station.lat,
    lon: station.lon,
    capturedAt: capturedAt.toISOString(),
    distanceKm: Math.round(distanceKm * 10) / 10,
    sinpo: sinpoFor(rarity, seed),
    rarity,
    message: thanksMessage(station),
    artSeed: seed,
    source,
  };
  if (station.frequency) card.frequency = station.frequency;
  return card;
}

export type CollectOutcome = 'new' | 'upgraded' | 'kept';

/** Range une carte dans l'album : la meilleure (plus courte distance) gagne. */
export function collect(
  album: Readonly<Record<string, QslCard>>,
  card: QslCard,
): { album: Record<string, QslCard>; outcome: CollectOutcome } {
  const existing = album[card.countryCode];
  if (!existing) return { album: { ...album, [card.countryCode]: card }, outcome: 'new' };
  if (card.distanceKm < existing.distanceKm) return { album: { ...album, [card.countryCode]: card }, outcome: 'upgraded' };
  return { album: { ...album }, outcome: 'kept' };
}
