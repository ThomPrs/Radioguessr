// Test réseau facultatif : LIVE=1 npm test
import { describe, expect, it } from 'vitest';
import { fetchCountries, fetchCountryStations, pickCountry } from '../shared/radio-browser';
import type { Continent } from '../shared/types';

describe.skipIf(!process.env.LIVE)('Radio Browser (réseau)', () => {
  it('récupère des pays et des stations jouables', async () => {
    const countries = await fetchCountries();
    expect(countries.length).toBeGreaterThan(100);
    const used: string[] = [];
    const counts: Partial<Record<Continent, number>> = {};
    const report: string[] = [];
    for (let i = 0; i < 10; i++) {
      const c = pickCountry(countries, { excludeCountries: used, continentCounts: counts })!;
      used.push(c.code);
      counts[c.continent] = (counts[c.continent] ?? 0) + 1;
      const stations = await fetchCountryStations(c.code);
      report.push(`${c.code} (${c.continent}) : ${stations.length} jouables / ${c.stationCount}`);
    }
    console.log(`${countries.length} pays\n` + report.join('\n'));
  }, 120_000);
});
