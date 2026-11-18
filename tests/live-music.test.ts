// Test réseau facultatif : LIVE=1 npm test
import { describe, expect, it } from 'vitest';
import { checkGuess, music, pickTrack } from '../api/_lib/music';

describe.skipIf(!process.env.LIVE)('Deezer (réseau)', () => {
  it('réservoir, extrait, recherche, vérification', async () => {
    const pool = await music().pool();
    expect(pool.length).toBeGreaterThan(200);
    const id = await pickTrack();
    const t = await music().track(id);
    expect(t?.preview).toMatch(/^https:\/\//);
    const found = await music().search('stromae alors on danse');
    expect(found.some((x) => /alors on danse/i.test(x.title) && x.artist === 'Stromae')).toBe(true);
    const radioEdit = found.find((x) => x.artist === 'Stromae')!;
    const other = found.find((x) => x.artist === 'Stromae' && x.id !== radioEdit.id);
    if (other) expect((await checkGuess(radioEdit.id, other.id, 5000)).verdict).toBe('song');
    console.log(`${pool.length} morceaux ; tiré : ${t?.title} — ${t?.artist}`);
  }, 60_000);
});
