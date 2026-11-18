// Types partagés entre le front (src/) et les fonctions serverless (api/).

export type Continent = 'AF' | 'AN' | 'AS' | 'EU' | 'NA' | 'OC' | 'SA';

export type Codec = 'MP3' | 'AAC' | 'AAC+';

export interface Station {
  id: string; // stationuuid Radio Browser
  name: string; // jamais affiché avant la révélation
  streamUrl: string; // url_resolved, toujours https
  codec: Codec;
  lat: number;
  lon: number;
  countryCode: string; // ISO 3166-1 alpha-2, majuscules
  country: string;
  continent: Continent;
  state?: string;
  languageCode?: string; // ISO 639 (Radio Browser), sans repli pays
  frequency?: string;
}

export type HintKind = 'language' | 'continent' | 'timezone';

export interface Guess {
  lat: number;
  lon: number;
  at: number;
}

export interface Round {
  index: number;
  station: Station;
  hints: HintKind[];
  guess: Guess | null;
  distanceKm: number | null;
  rawScore: number;
  score: number;
  qsl: 'new' | 'upgraded' | 'kept' | null;
}

export interface Game {
  id: string;
  mode: 'world' | 'duel';
  startedAt: number;
  rounds: Round[];
  current: number;
  phase: 'loading' | 'listening' | 'revealed' | 'finished';
}
