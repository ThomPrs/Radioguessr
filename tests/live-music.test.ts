// Test réseau facultatif : LIVE=1 npm test
import { describe, expect, it } from 'vitest';
import { checkGuess, music, pickTrack } from '../api/_lib/music';
import { HITS } from '../shared/hits-data';

describe.skipIf(!process.env.LIVE)('Deezer (réseau)', () => {
  it('mégatubes jouables, recherche, vérification', async () => {
    // 20 titres au hasard : presque tous doivent avoir un extrait
    const sample = [...HITS].sort(() => Math.random() - 0.5).slice(0, 20);
    let ok = 0;
    for (const h of sample) if ((await music().track(h.id))?.preview?.startsWith('https://')) ok++;
    expect(ok).toBeGreaterThanOrEqual(18);
    const id = await pickTrack();
    expect((await music().track(id))?.preview).toMatch(/^https:\/\//);
    const found = await music().search('stromae alors on danse');
    expect(found.some((x) => /alors on danse/i.test(x.title) && x.artist === 'Stromae')).toBe(true);
    const radioEdit = found.find((x) => x.artist === 'Stromae')!;
    const other = found.find((x) => x.artist === 'Stromae' && x.id !== radioEdit.id);
    if (other) expect((await checkGuess(radioEdit.id, other.id, 5000)).verdict).toBe('song');
    console.log(`${ok}/20 extraits disponibles`);
  }, 90_000);
});
