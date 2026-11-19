// Identité visuelle des pays pour les cartes QSL : drapeau simplifié (et palette qui en découle),
// biome du paysage, style d'architecture et monument célèbre éventuel.
// Les drapeaux sont des versions lisibles à 40 px, pas des reproductions exactes.

/**
 * Dispositions de drapeau :
 * - h / v : bandes horizontales / verticales (couleurs dans l'ordre)
 * - nordic : fond, croix [, croix intérieure]
 * - cross : fond, croix centrée (Suisse, Dominique…)
 * - disc : fond, disque [, moitié basse du disque]
 * - canton : canton, puis bandes horizontales ; l'emblème (étoile) se dessine dans le canton
 * - ensign : fond (le canton porte un petit Union Jack)
 * - union : Union Jack
 * - tri : triangle au mât, puis bandes horizontales
 * - hoist : bande verticale au mât, puis bandes horizontales
 * - diag : fond, bande diagonale [, second fond en bas à droite]
 * - saltire : haut/bas, gauche/droite, sautoir en emblème
 * - quart : 4 quartiers (haut-gauche, haut-droit, bas-gauche, bas-droit), croix en emblème
 * - rhombus : fond, losange, disque
 * - plain : fond (+ couleurs secondaires), emblème central
 * « ;couleur » à la fin : couleur de l'emblème (étoile, disque, croix, sautoir…).
 */
export type FlagLayout = 'h' | 'v' | 'nordic' | 'cross' | 'disc' | 'canton' | 'ensign' | 'union' | 'tri' | 'hoist' | 'diag' | 'saltire' | 'quart' | 'rhombus' | 'plain';
export const FLAG_LAYOUTS: readonly FlagLayout[] = ['h', 'v', 'nordic', 'cross', 'disc', 'canton', 'ensign', 'union', 'tri', 'hoist', 'diag', 'saltire', 'quart', 'rhombus', 'plain'];

export interface FlagSpec {
  layout: FlagLayout;
  colors: string[];
  emblem?: string;
}

const W = '#ffffff';
const K = '#000000';
const US_FLAG = `canton:#3c3b6e,#b22234,${W},#b22234,${W},#b22234,${W},#b22234;${W}`;
const FR_FLAG = `v:#0055a4,${W},#ef4135`;

const FLAGS: Record<string, string> = {
  AD: 'v:#10069f,#fedd00,#d50032;#c7a250',
  AE: `hoist:#ef3340,#00843d,${W},${K}`,
  AF: `v:${K},#d32011,#007a36`,
  AG: `plain:#ce1126,${K},#0072c6;#fcd116`,
  AI: 'ensign:#012169;#f9a825',
  AL: `plain:#e41e20;${K}`,
  AM: 'h:#d90012,#0033a0,#f2a800',
  AO: `h:#cc092f,${K};#ffcb00`,
  AQ: `plain:#3a7dce;${W}`,
  AR: `h:#74acdf,${W},#74acdf;#f6b40e`,
  AS: `plain:#002868,#bf0a30;${W}`,
  AT: `h:#ed2939,${W},#ed2939`,
  AU: `ensign:#012169;${W}`,
  AW: 'plain:#418fde;#fcd116',
  AZ: 'h:#00b5e2,#ef3340,#509e2f',
  BA: `plain:#002395;#fecb00`,
  BB: 'v:#00267f,#ffc726,#00267f',
  BD: 'disc:#006a4e,#f42a41',
  BE: `v:${K},#fdda24,#ef3340`,
  BF: 'h:#ef2b2d,#009e49;#fcd116',
  BG: `h:${W},#00966e,#d62612`,
  BH: `hoist:${W},#ce1126`,
  BI: `saltire:#ce1126,#1eb53a;${W}`,
  BJ: 'hoist:#008751,#fcd116,#e8112d',
  BM: 'ensign:#c8102e',
  BN: `plain:#f7e017,${K};#cf1126`,
  BO: 'h:#d52b1e,#f9e300,#007934',
  BQ: 'plain:#fcd116,#012a87;#e4002b',
  BR: 'rhombus:#009c3b,#ffdf00,#002776',
  BS: `tri:${K},#00778b,#ffc72c,#00778b`,
  BW: `h:#75aadb,${K},#75aadb`,
  BY: 'h:#c8313e,#c8313e,#4aa657',
  CA: `v:#d80621,${W},#d80621;#d80621`,
  CD: 'diag:#007fff,#ce1021;#f7d618',
  CF: `h:#003082,${W},#289728,#ffce00;#d21034`,
  CH: `cross:#da291c;${W}`,
  CI: `v:#f77f00,${W},#009e60`,
  CL: `canton:#0039a6,${W},#d52b1e;${W}`,
  CM: 'v:#007a5e,#ce1126,#fcd116;#fcd116',
  CN: 'canton:#de2910,#de2910;#ffde00',
  CO: 'h:#fcd116,#fcd116,#003893,#ce1126',
  CR: `h:#002b7f,${W},#ce1126,#ce1126,${W},#002b7f`,
  CU: `tri:#cf142b,#002a8f,${W},#002a8f,${W},#002a8f;${W}`,
  CV: `h:#003893,#003893,${W},#cf2027,${W},#003893,#003893;#f7d116`,
  CW: 'h:#002b7f,#002b7f,#f9e814,#002b7f',
  CY: `plain:${W};#d57800`,
  CZ: `tri:#11457e,${W},#d7141a`,
  DE: `h:${K},#dd0000,#ffce00`,
  DK: `nordic:#c8102e,${W}`,
  DM: 'cross:#006b3f;#fcd116',
  DO: `quart:#002d62,#ce1126,#ce1126,#002d62;${W}`,
  DZ: `v:#006233,${W};#d21034`,
  EC: 'h:#ffdd00,#ffdd00,#034ea2,#ed1c24',
  EE: `h:#0072ce,${K},${W}`,
  EG: `h:#ce1126,${W},${K};#c09300`,
  ER: 'tri:#ea0437,#12ad2b,#4189dd;#ffc726',
  ES: 'h:#aa151b,#f1bf00,#f1bf00,#aa151b',
  ET: 'h:#078930,#fcdd09,#da121a;#0f47af',
  FI: `nordic:${W},#002f6c`,
  FJ: `ensign:#68bfe5;${W}`,
  FK: 'ensign:#012169',
  FO: `nordic:${W},#005eb8,#ef303d`,
  FR: FR_FLAG,
  GB: 'union:#012169,#c8102e',
  GD: 'quart:#fcd116,#007a5e,#007a5e,#fcd116;#ce1126',
  GE: `quart:${W},${W},${W},${W};#ff0000`,
  GF: 'diag:#28b45e,#fde021;#e12423',
  GH: `h:#ce1126,#fcd116,#006b3f;${K}`,
  GI: `h:${W},${W},#da000c;#da000c`,
  GL: `h:${W},#d00c33;#d00c33`,
  GN: 'v:#ce1126,#fcd116,#009460',
  GP: FR_FLAG,
  GR: `canton:#0d5eaf,#0d5eaf,${W},#0d5eaf,${W},#0d5eaf,${W},#0d5eaf,${W},#0d5eaf;${W}`,
  GT: `v:#4997d0,${W},#4997d0;#6c9a3c`,
  GU: 'plain:#00297b;#c62139',
  GY: 'tri:#ce1126,#009e49;#fcd116',
  HK: `plain:#de2910;${W}`,
  HN: `h:#0073cf,${W},#0073cf;#0073cf`,
  HR: `h:#ff0000,${W},#171796;#ff0000`,
  HT: `h:#00209f,#d21034;${W}`,
  HU: `h:#ce2939,${W},#477050`,
  ID: `h:#ce1126,${W}`,
  IE: `v:#169b62,${W},#ff883e`,
  IL: `h:${W},#0038b8,${W},${W},${W},#0038b8,${W};#0038b8`,
  IM: `plain:#cf142b;${W}`,
  IN: `h:#ff9933,${W},#138808;#000080`,
  IQ: `h:#ce1126,${W},${K};#007a3d`,
  IR: `h:#239f40,${W},#da0000;#da0000`,
  IS: `nordic:#02529c,${W},#dc1e35`,
  IT: `v:#009246,${W},#ce2b37`,
  JM: `saltire:#009b3a,${K};#fed100`,
  JO: `tri:#ce1126,${K},${W},#007a3d`,
  JP: `disc:${W},#bc002d`,
  KE: `h:${K},#bb0000,#006600;#bb0000`,
  KG: 'plain:#e8112d;#ffef00',
  KH: `h:#032ea1,#e00025,#e00025,#032ea1;${W}`,
  KM: `tri:#3a9d23,#ffc61e,${W},#ce1126,#3a75c4`,
  KN: `diag:#009e49,${K},#ce1126;#fcd116`,
  KP: 'h:#024fa2,#ed1c27,#024fa2;#ed1c27',
  KR: `disc:${W},#cd2e3a,#0047a0`,
  KW: `tri:${K},#007a3d,${W},#ce1126`,
  KY: 'ensign:#012169;#c8102e',
  KZ: 'plain:#00afca;#fec50c',
  LA: `h:#ce1126,#002868,#002868,#ce1126;${W}`,
  LB: `h:#ed1c24,${W},${W},#ed1c24;#00a651`,
  LC: 'plain:#66ccff;#fcd116',
  LK: 'plain:#8d153a,#00534e;#ffb700',
  LT: 'h:#fdb913,#006a44,#c1272d',
  LU: `h:#ed2939,${W},#00a1de`,
  LV: `h:#9e3039,#9e3039,${W},#9e3039,#9e3039`,
  LY: `h:#e70013,${K},${K},#239e46;${W}`,
  MA: 'plain:#c1272d;#006233',
  MC: `h:#ce1126,${W}`,
  MD: 'v:#0046ae,#ffd200,#cc092f;#8c5a2b',
  ME: 'plain:#c40308;#d4af37',
  MG: `hoist:${W},#fc3d32,#007e3a`,
  MK: 'plain:#d20000;#ffe600',
  ML: 'v:#14b53a,#fcd116,#ce1126',
  MM: `h:#fecb00,#34b233,#ea2839;${W}`,
  MN: 'v:#c4272f,#015197,#c4272f;#f9cf02',
  MO: `plain:#00785e;${W}`,
  MQ: `tri:#e8112d,#00a650,${K}`,
  MT: `v:${W},#cf142b`,
  MU: 'h:#ea2839,#1a206d,#ffd500,#00a551',
  MV: 'plain:#d21034;#007e3a',
  MW: `h:${K},#ce1126,#339e35;#ce1126`,
  MX: `v:#006847,${W},#ce1126;#8c5f2c`,
  MY: `canton:#010066,#cc0001,${W},#cc0001,${W},#cc0001,${W};#ffcc00`,
  MZ: `tri:#d21034,#007168,${K},#fce100`,
  NA: 'diag:#003580,#d21034,#009543;#ffce00',
  NC: 'h:#0035ad,#ed4135,#009543;#fae600',
  NE: `h:#e05206,${W},#0db02b;#e05206`,
  NG: `v:#008751,${W},#008751`,
  NI: `h:#0067c6,${W},#0067c6;#c9a100`,
  NL: `h:#ae1c28,${W},#21468b`,
  NO: `nordic:#ba0c2f,${W},#00205b`,
  NP: 'plain:#dc143c;#003893',
  NZ: 'ensign:#00247d;#cc142b',
  OM: `hoist:#db161b,${W},#db161b,#008000`,
  PA: `quart:${W},#d21034,#005293,${W}`,
  PE: `v:#d91023,${W},#d91023`,
  PF: `h:#ce1126,${W},#ce1126;#ff9e1b`,
  PH: `tri:${W},#0038a8,#ce1126;#fcd116`,
  PK: `hoist:${W},#01411c;${W}`,
  PL: `h:${W},#dc143c`,
  PR: `tri:#0050f0,#ed0000,${W},#ed0000,${W},#ed0000;${W}`,
  PS: `tri:#ee2a35,${K},${W},#009736`,
  PT: 'v:#006600,#ff0000,#ff0000;#ffe900',
  PY: `h:#d52b1e,${W},#0038a8;#0038a8`,
  QA: `hoist:${W},#8d1b3d`,
  RE: 'plain:#0055a4,#ef4135;#ffde00',
  RO: 'v:#002b7f,#fcd116,#ce1126',
  RS: `h:#c6363c,#0c4076,${W};#c6363c`,
  RU: `h:${W},#0039a6,#d52b1e`,
  RW: 'h:#00a1de,#00a1de,#fad201,#20603d;#fad201',
  SA: `plain:#006c35;${W}`,
  SC: `h:#003f87,#fcd856,#d62828,${W},#007a3d`,
  SD: `tri:#007229,#d21034,${W},${K}`,
  SE: 'nordic:#006aa7,#fecc02',
  SG: `h:#ef3340,${W};${W}`,
  SI: `h:${W},#005da4,#ed1c24;#005da4`,
  SK: `h:${W},#0b4ea2,#ee1c25;#ee1c25`,
  SL: `h:#1eb53a,${W},#0072c6`,
  SM: `h:${W},#5eb6e4;#c7a250`,
  SN: 'v:#00853f,#fdef42,#e31b23;#00853f',
  SR: `h:#377e3f,${W},#b40a2d,#b40a2d,${W},#377e3f;#ecc81d`,
  SV: `h:#0047ab,${W},#0047ab;#0047ab`,
  SY: `h:#ce1126,${W},${K};#007a3d`,
  TG: `canton:#d21034,#006a4e,#ffce00,#006a4e,#ffce00,#006a4e;${W}`,
  TH: `h:#a51931,${W},#2d2a4a,#2d2a4a,${W},#a51931`,
  TM: 'hoist:#d22630,#00843d;#ffffff',
  TN: `disc:#e70013,${W}`,
  TO: `canton:${W},#c10000;#c10000`,
  TR: `plain:#e30a17;${W}`,
  TT: `diag:#ce1126,${K};${W}`,
  TW: `canton:#000095,#fe0000;${W}`,
  TZ: `diag:#1eb53a,${K},#00a3dd;#fcd116`,
  UA: 'h:#0057b7,#ffd700',
  UG: `h:${K},#fcdc04,#d90000,${K},#fcdc04,#d90000;${W}`,
  UM: US_FLAG,
  US: US_FLAG,
  UY: `canton:${W},${W},#0038a8,${W},#0038a8,${W},#0038a8,${W},#0038a8,${W};#fcd116`,
  UZ: `h:#0099b5,${W},#1eb53a`,
  VA: `v:#ffe000,${W};#c7a250`,
  VC: 'v:#002674,#fcd116,#fcd116,#009e60;#009e60',
  VE: `h:#ffcc00,#00247d,#cf142b;${W}`,
  VG: 'ensign:#012169;#2e8b57',
  VI: `plain:${W},#0f4d92;#f1c400`,
  VN: 'plain:#da251d;#ffff00',
  VU: `tri:${K},#d21034,#009543;#fdce12`,
  XK: 'plain:#244aa5;#d0a650',
  YE: `h:#ce1126,${W},${K}`,
  YT: FR_FLAG,
  ZA: 'tri:#007a4d,#de3831,#002395;#ffb612',
  ZM: 'plain:#198a00,#de2010;#ef7d00',
  ZW: `tri:${W},#319208,#ffd200,#de2010,${K},#de2010,#ffd200,#319208;#ffd200`,
};

export function flagOf(code: string): FlagSpec | null {
  const raw = FLAGS[code];
  if (!raw) return null;
  const [layout, rest = ''] = raw.split(':') as [FlagLayout, string];
  const [cols = '', emblem] = rest.split(';');
  return { layout, colors: cols.split(','), ...(emblem ? { emblem } : {}) };
}

// ── Palette ────────────────────────────────────────────────────────────────

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (c: [number, number, number]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const lum = ([r, g, b]: [number, number, number]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const sat = ([r, g, b]: [number, number, number]) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const PAPER_RGB: [number, number, number] = [0xed, 0xe3, 0xcf];

export interface Palette {
  /** Ciel : couleur du drapeau adoucie vers le papier. */
  sky: string;
  /** Accent vif : soleil, toits, fenêtres. */
  accent: string;
  /** Second accent (cartes rares et or). */
  accent2: string;
}

/** Palette tirée du drapeau : ni blanc ni noir ; `fallback` (couleur du continent) si le pays est inconnu. */
export function paletteOf(code: string, fallback: string): Palette {
  const flag = flagOf(code);
  const cols = [...new Set([...(flag?.colors ?? []), ...(flag?.emblem ? [flag.emblem] : [])])]
    .map(rgb)
    .filter((c) => lum(c) < 0.93 && lum(c) > 0.08); // ni blanc ni noir
  if (cols.length === 0) {
    const f = rgb(fallback);
    return { sky: toHex(mix(f, PAPER_RGB, 0.6)), accent: fallback, accent2: fallback };
  }
  const byVivid = [...cols].sort((a, b) => sat(b) - sat(a));
  const accent = byVivid[0]!;
  const accent2 = byVivid.find((c) => c !== accent) ?? accent;
  // Ciel : de préférence une teinte froide du drapeau (bleu, puis vert), sinon la plus claire ;
  // ramenée vers le papier pour rester douce (une couleur sombre est éclaircie davantage).
  const cool = (c: [number, number, number]) => c[2] - c[0] + (c[1] - c[0]) * 0.5;
  const cools = cols.filter((c) => cool(c) > 30).sort((a, b) => cool(b) - cool(a));
  const base = cools[0] ?? [...cols].sort((a, b) => lum(b) - lum(a))[0]!;
  const sky = mix(base, PAPER_RGB, lum(base) < 0.45 ? 0.62 : 0.45);
  return { sky: toHex(sky), accent: toHex(accent), accent2: toHex(accent2) };
}

// ── Décor ──────────────────────────────────────────────────────────────────

export type Biome = 'desert' | 'savanna' | 'tropical' | 'temperate' | 'mediterranean' | 'mountain' | 'snow' | 'steppe' | 'island';
export type Architecture =
  | 'european'
  | 'mediterranean'
  | 'islamic'
  | 'eastasian'
  | 'southasian'
  | 'orthodox'
  | 'latin'
  | 'african'
  | 'nordic'
  | 'caribbean'
  | 'modern';

const group = (codes: string) => codes.split(' ');

const ARCH_GROUPS: Record<Architecture, string[]> = {
  european: group('AD AT BE CH CZ DE FR GB IE IM LU LV LT NL PL SK SI HU GI MC SM VA EE GF'),
  nordic: group('DK FI FO GL IS NO SE AQ'),
  mediterranean: group('CY ES GR HR IT MT PT ME AL MK BA XK'),
  orthodox: group('BY BG MD RO RS RU UA GE AM'),
  islamic: group('AF AZ BH DZ EG IQ IR JO KW LB LY MA OM PK PS SA SD SY TN TR YE KZ KG TM UZ BD ML NE MV KM'),
  eastasian: group('CN HK JP KP KR MO MN TW'),
  southasian: group('IN NP LK MM TH LA KH VN ID MY BN PH'),
  latin: group('AR BO BR CL CO CR CU DO EC GT HN MX NI PA PE PY SV UY VE PR HT SR GY'),
  african: group('AO BF BI BJ BW CD CF CI CM ER ET GH GN KE MG MW MZ NA NG RW SL SN TG TZ UG ZA ZM ZW'),
  caribbean: group('AG AI AW BB BM BQ BS CV CW DM GD GP JM KN KY LC MQ MU RE SC TT VC VG VI YT FJ PF NC TO VU AS GU UM FK'),
  modern: group('US CA AU NZ SG AE QA IL'),
};

const BIOME_GROUPS: Record<Biome, string[]> = {
  desert: group('AE BH DZ EG JO KW LY NE ML OM QA SA SD YE IQ TM'),
  savanna: group('BF BJ CF CI GH GN KE MW MZ NA NG SN SL TG TZ UG ZA ZM ZW AO BW ER ET RW BI'),
  tropical: group('BR CD CM CO CR EC GT HN ID KH LA LK MM MY NI PA PH SG TH VN BN GY SR GF VE BD MG IN SV HT DO CU PR'),
  island: group('AG AI AW BB BM BQ BS CV CW DM GD GP JM KN KY LC MQ MU RE SC TT VC VG VI YT FJ PF NC TO VU AS GU UM MV KM MT CY FK'),
  mountain: group('AD AF AM AT BO CH GE KG NP PE ME XK AL BA MK'),
  snow: group('AQ FI FO GL IS NO SE RU CA'),
  mediterranean: group('ES GR HR IT PT MA TN LB IL SY TR MC SM VA GI PS'),
  steppe: group('KZ MN UZ AZ IR PK'),
  temperate: [],
};

function lookup<T extends string>(groups: Record<T, string[]>, code: string, fallback: T): T {
  for (const [k, list] of Object.entries(groups) as [T, string[]][]) if (list.includes(code)) return k;
  return fallback;
}

export function biomeOf(code: string): Biome {
  return lookup(BIOME_GROUPS, code, 'temperate');
}

export function architectureOf(code: string): Architecture {
  return lookup(ARCH_GROUPS, code, 'european');
}

// ── Monuments ──────────────────────────────────────────────────────────────

export type Landmark =
  | 'eiffel'
  | 'bigben'
  | 'liberty'
  | 'colosseum'
  | 'pyramids'
  | 'tajmahal'
  | 'fuji'
  | 'greatwall'
  | 'basil'
  | 'opera'
  | 'christ'
  | 'mayan'
  | 'machupicchu'
  | 'parthenon'
  | 'windmills'
  | 'dutchmill'
  | 'brandenburg'
  | 'mosque'
  | 'burj'
  | 'cntower'
  | 'angkor'
  | 'thaitemple'
  | 'giraffes'
  | 'matterhorn'
  | 'fjord'
  | 'volcano'
  | 'moai'
  | 'atomium'
  | 'koreanpalace'
  | 'obelisk'
  | 'koutoubia'
  | 'tram'
  | 'kilimanjaro';

export const LANDMARKS: Partial<Record<string, Landmark>> = {
  FR: 'eiffel',
  GB: 'bigben',
  US: 'liberty',
  IT: 'colosseum',
  EG: 'pyramids',
  IN: 'tajmahal',
  JP: 'fuji',
  CN: 'greatwall',
  RU: 'basil',
  AU: 'opera',
  BR: 'christ',
  MX: 'mayan',
  PE: 'machupicchu',
  GR: 'parthenon',
  ES: 'windmills',
  NL: 'dutchmill',
  DE: 'brandenburg',
  TR: 'mosque',
  AE: 'burj',
  CA: 'cntower',
  KH: 'angkor',
  TH: 'thaitemple',
  KE: 'giraffes',
  CH: 'matterhorn',
  NO: 'fjord',
  IS: 'volcano',
  CL: 'moai',
  BE: 'atomium',
  KR: 'koreanpalace',
  AR: 'obelisk',
  MA: 'koutoubia',
  PT: 'tram',
  TZ: 'kilimanjaro',
};

export function landmarkOf(code: string): Landmark | null {
  return LANDMARKS[code] ?? null;
}
