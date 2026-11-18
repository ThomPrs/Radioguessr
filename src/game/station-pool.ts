// Fournit des stations jouables pour une partie, en garantissant la diversité géographique
// et en basculant silencieusement sur une autre station si un flux ne démarre pas.

import { fetchCountries, fetchCountryStations, pickCountry, type CountryInfo } from '../../shared/radio-browser';
import type { Continent, Station } from '../../shared/types';
import type { RadioPlayer } from '../audio/radio';

const COUNTRIES_CACHE_KEY = 'qsl:rb-countries:v1';
const COUNTRIES_CACHE_TTL_MS = 24 * 3600 * 1000;
const MAX_STREAMS_PER_COUNTRY = 3;
const MAX_TOTAL_ATTEMPTS = 15;

function canPlay(station: Station): boolean {
  const probe = document.createElement('audio');
  if (station.codec === 'MP3') return probe.canPlayType('audio/mpeg') !== '';
  return probe.canPlayType('audio/aac') !== '' || probe.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '';
}

async function loadCountries(): Promise<CountryInfo[]> {
  try {
    const cached = sessionStorage.getItem(COUNTRIES_CACHE_KEY);
    if (cached) {
      const { at, data } = JSON.parse(cached) as { at: number; data: CountryInfo[] };
      if (Date.now() - at < COUNTRIES_CACHE_TTL_MS && data.length > 0) return data;
    }
  } catch {
    // stockage indisponible : on recharge
  }
  const data = await fetchCountries();
  try {
    sessionStorage.setItem(COUNTRIES_CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // sans importance
  }
  return data;
}

export interface TuneProgress {
  attempts: number;
}

export class StationPool {
  private countries: CountryInfo[] | null = null;
  private readonly usedCountries = new Set<string>();
  private readonly deadCountries = new Set<string>();
  private readonly triedStreams = new Set<string>();
  private readonly continentCounts: Partial<Record<Continent, number>> = {};

  /**
   * Trouve et lance une station qui joue vraiment. Le joueur ne voit qu'un grésillement
   * pendant que les flux morts sont écartés.
   */
  async tuneNext(player: RadioPlayer, onProgress?: (p: TuneProgress) => void): Promise<Station> {
    this.countries ??= await loadCountries();
    let attempts = 0;

    while (attempts < MAX_TOTAL_ATTEMPTS) {
      const country = pickCountry(this.countries, {
        excludeCountries: [...this.usedCountries, ...this.deadCountries],
        continentCounts: this.continentCounts,
      });
      if (!country) break;

      let candidates: Station[] = [];
      try {
        candidates = (await fetchCountryStations(country.code)).filter(
          (s) => !this.triedStreams.has(s.streamUrl) && canPlay(s),
        );
      } catch {
        // miroir en panne pour cette requête : on change de pays
      }

      for (const station of candidates.slice(0, MAX_STREAMS_PER_COUNTRY)) {
        attempts++;
        onProgress?.({ attempts });
        this.triedStreams.add(station.streamUrl);
        const result = await player.tune(station.streamUrl);
        if (result === 'cancelled') throw new DOMException('Syntonisation annulée', 'AbortError');
        if (result === 'playing') {
          this.usedCountries.add(station.countryCode);
          this.continentCounts[station.continent] = (this.continentCounts[station.continent] ?? 0) + 1;
          return station;
        }
        if (attempts >= MAX_TOTAL_ATTEMPTS) break;
      }
      this.deadCountries.add(country.code);
    }
    throw new Error('no-station');
  }
}
