import type { Continent } from './types';

// Pays (ISO alpha-2) par continent. Source : découpage usuel ONU / Natural Earth.
const BY_CONTINENT: Record<Continent, string> = {
  AF: 'DZ AO BJ BW BF BI CV CM CF TD KM CD CG CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW',
  AN: 'AQ TF BV HM GS',
  AS: 'AF AM AZ BH BD BT BN KH CN CY GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE IO',
  EU: 'AX AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG VA HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB',
  NA: 'AI AG AW BS BB BZ BM BQ VG CA KY CR CU CW DM DO SV GL GD GP GT HT HN JM MQ MX MS NI PA PR BL KN LC MF PM VC SX TT TC US VI UM',
  OC: 'AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF',
  SA: 'AR BO BR CL CO EC FK GF GY PY PE SR UY VE',
};

const CONTINENT_OF: Record<string, Continent> = {};
for (const [cont, list] of Object.entries(BY_CONTINENT) as [Continent, string][]) {
  for (const cc of list.split(' ')) CONTINENT_OF[cc] = cont;
}

export function continentOf(countryCode: string): Continent | undefined {
  return CONTINENT_OF[countryCode.toUpperCase()];
}

let regionNames: Intl.DisplayNames | null = null;

/** Nom français d'un pays (« Chili ») depuis son code ISO. */
export function countryNameFr(countryCode: string): string {
  regionNames ??= new Intl.DisplayNames(['fr'], { type: 'region', fallback: 'code' });
  try {
    return regionNames.of(countryCode.toUpperCase()) ?? countryCode;
  } catch {
    return countryCode;
  }
}
