// Détermination de la langue d'une station : code ISO de Radio Browser, sinon texte libre,
// sinon langue principale du pays.

/** Mots-clés (texte libre Radio Browser, souvent fantaisiste) → code ISO 639-1. */
const KEYWORDS: [RegExp, string][] = [
  [/engl|ingl|anglais|englisch/, 'en'],
  [/espa|span|castell|castil|spagn/, 'es'],
  [/portug|brasil|brazil/, 'pt'],
  [/deut|german|allemand|deutch|bairisch|schwäb|alemán/, 'de'],
  [/fran[cç]|french/, 'fr'],
  [/ital/, 'it'],
  [/rom[aâ]n|rumän|romania/, 'ro'],
  [/dutch|neder|néerl|holland|vlaams|flemish/, 'nl'],
  [/russ|рус/, 'ru'],
  [/ukrain|укр/, 'uk'],
  [/pol(ish|ski|onais)/, 'pl'],
  [/czech|češ|tchè/, 'cs'],
  [/slovak|sloven[cč]/, 'sk'],
  [/sloven(ian|ščina|e)/, 'sl'],
  [/hungar|magyar/, 'hu'],
  [/greek|ελλην|grec/, 'el'],
  [/turk|türk/, 'tr'],
  [/arab|عرب/, 'ar'],
  [/hebrew|עברית|hébreu/, 'he'],
  [/persian|farsi|فارسی/, 'fa'],
  [/hindi|हिन्दी/, 'hi'],
  [/urdu/, 'ur'],
  [/bengal|bangla/, 'bn'],
  [/tamil/, 'ta'],
  [/chin|mandarin|中文|普通话|cantonese|粤/, 'zh'],
  [/japan|日本/, 'ja'],
  [/korea|한국/, 'ko'],
  [/thai|ไทย/, 'th'],
  [/vietnam|tiếng việt/, 'vi'],
  [/indones|bahasa indonesia/, 'id'],
  [/malay|melayu/, 'ms'],
  [/tagalog|filipino/, 'tl'],
  [/swed|svensk/, 'sv'],
  [/norw|norsk/, 'no'],
  [/danish|dansk/, 'da'],
  [/finn|suomi/, 'fi'],
  [/icelan|íslensk/, 'is'],
  [/eston|eesti/, 'et'],
  [/latvi|latvieš/, 'lv'],
  [/lithuan|lietuv/, 'lt'],
  [/croat|hrvat/, 'hr'],
  [/serb|srpsk|српск/, 'sr'],
  [/bulgar|българ/, 'bg'],
  [/catal/, 'ca'],
  [/basque|euskar/, 'eu'],
  [/galic|galego/, 'gl'],
  [/breton|brezhoneg/, 'br'],
  [/welsh|cymraeg/, 'cy'],
  [/irish|gaeilge/, 'ga'],
  [/swahili|kiswahili/, 'sw'],
  [/afrikaans/, 'af'],
  [/amhar/, 'am'],
  [/hausa/, 'ha'],
  [/yoruba/, 'yo'],
  [/albanian|shqip/, 'sq'],
  [/armen/, 'hy'],
  [/georgian|ქართ/, 'ka'],
  [/kazakh|қазақ/, 'kk'],
  [/mongol/, 'mn'],
  [/nepal/, 'ne'],
  [/sinhal/, 'si'],
  [/quechua/, 'qu'],
  [/guaran/, 'gn'],
];

// Langue principale de diffusion par pays (ISO 3166 → ISO 639-1). Pays absents : pas de repli.
const COUNTRY_LANG_RAW = `
AD:ca AE:ar AF:fa AL:sq AM:hy AO:pt AR:es AT:de AU:en AW:nl AZ:az BA:bs BB:en BD:bn BE:nl BF:fr BG:bg BH:ar
BI:fr BJ:fr BO:es BR:pt BS:en BT:dz BW:en BY:ru BZ:en CA:en CD:fr CF:fr CG:fr CH:de CI:fr CL:es CM:fr CN:zh
CO:es CR:es CU:es CV:pt CY:el CZ:cs DE:de DJ:fr DK:da DM:en DO:es DZ:ar EC:es EE:et EG:ar ES:es ET:am FI:fi
FJ:en FO:fo FR:fr GA:fr GB:en GD:en GE:ka GF:fr GH:en GI:en GL:kl GM:en GN:fr GP:fr GQ:es GR:el GT:es GU:en
GY:en HK:zh HN:es HR:hr HT:fr HU:hu ID:id IE:en IL:he IN:hi IQ:ar IR:fa IS:is IT:it JM:en JO:ar JP:ja KE:sw
KG:ky KH:km KR:ko KW:ar KZ:kk LA:lo LB:ar LC:en LI:de LK:si LR:en LS:en LT:lt LU:lb LV:lv LY:ar MA:ar MC:fr
MD:ro ME:sr MG:mg MK:mk ML:fr MM:my MN:mn MO:zh MQ:fr MR:ar MT:mt MU:fr MV:dv MW:en MX:es MY:ms MZ:pt NA:en
NC:fr NE:fr NG:en NI:es NL:nl NO:no NP:ne NZ:en OM:ar PA:es PE:es PF:fr PG:en PH:tl PK:ur PL:pl PR:es PS:ar
PT:pt PY:es QA:ar RE:fr RO:ro RS:sr RU:ru RW:rw SA:ar SC:fr SD:ar SE:sv SG:en SI:sl SK:sk SL:en SM:it SN:fr
SO:so SR:nl SV:es SY:ar SZ:en TD:fr TG:fr TH:th TJ:tg TM:tk TN:ar TR:tr TT:en TW:zh TZ:sw UA:uk UG:en US:en
UY:es UZ:uz VA:it VC:en VE:es VN:vi XK:sq YE:ar ZA:en ZM:en ZW:en
`;
const COUNTRY_LANG: Record<string, string> = Object.fromEntries(
  COUNTRY_LANG_RAW.trim()
    .split(/\s+/)
    .map((pair) => pair.split(':') as [string, string]),
);

export function countryLanguage(countryCode: string): string | undefined {
  return COUNTRY_LANG[countryCode.toUpperCase()];
}

/** Code de langue depuis les champs Radio Browser (sans repli pays). */
export function parseLanguage(codes: string | null | undefined, text: string | null | undefined): string | undefined {
  const firstCode = codes?.split(',')[0]?.trim().toLowerCase();
  if (firstCode && /^[a-z]{2,3}$/.test(firstCode)) return firstCode;
  const t = text?.split(/[,;/]/)[0]?.toLowerCase().trim();
  if (!t) return undefined;
  for (const [re, code] of KEYWORDS) if (re.test(t)) return code;
  return undefined;
}

let displayNames: Intl.DisplayNames | null = null;

/** Nom français d'une langue, avec majuscule (« Espagnol »). */
export function languageNameFr(code: string): string {
  displayNames ??= new Intl.DisplayNames(['fr'], { type: 'language', fallback: 'code' });
  let name: string = code;
  try {
    name = displayNames.of(code) ?? code;
  } catch {
    // code invalide pour Intl
  }
  return name.charAt(0).toUpperCase() + name.slice(1);
}
