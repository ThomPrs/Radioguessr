// Résout la liste des mégatubes (scripts/hits-list.ts) en morceaux Deezer, version originale,
// et écrit shared/hits-data.ts. À lancer quand on modifie la liste : npm run build:hits

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeArtist, normalizeTitle } from '../shared/blindtest.ts';
import { HITS_LIST } from './hits-list.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const API = 'https://api.deezer.com';

interface DzTrack {
  id: number;
  title: string;
  title_short: string;
  title_version?: string;
  rank: number;
  preview: string;
  readable?: boolean;
  artist: { name: string };
  album: { title: string };
}

/** Versions écartées : live, remix, version longue, karaoké, reprise… */
const BAD = /\b(live|remix|mix|extended|karaok|instrumental|acoustic|acoustique|unplugged|cover|tribute|re-?record(ed|ing)?|version|edit|demo|piano|orchestr|symphon|medley|mashup|sped up|slowed)\b/i;
const BAD_ALBUM = /\b(karaok|tribute|hommage|cover|instrumental|lullab|berceuse|8-bit|piano)\b/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function search(q: string): Promise<DzTrack[]> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}&limit=40`, { headers: { 'User-Agent': 'Radioguessr-build/1.0' } });
    const data = (await res.json()) as { data?: DzTrack[]; error?: { code: number } };
    if (data.error?.code === 4) {
      await sleep(2000); // quota dépassé : on patiente
      continue;
    }
    return data.data ?? [];
  }
  return [];
}

function pick(list: DzTrack[], artist: string, title: string): DzTrack | null {
  const a = normalizeArtist(artist);
  const t = normalizeTitle(title);
  const ok = list.filter((x) => {
    if (!x.preview || x.readable === false) return false;
    const xa = normalizeArtist(x.artist.name);
    if (!(xa === a || xa.includes(a) || a.includes(xa))) return false;
    if (normalizeTitle(x.title_short) !== t && normalizeTitle(x.title) !== t) return false;
    // Mentions de versions d'origine acceptables : Radio Edit, Remastered / Remasterisé,
    // 7" Mix (single d'origine), Original Version.
    const extra = `${x.title_version ?? ''} ${x.title.replace(x.title_short, '')}`.replace(
      /radio edit|remaster(ed)?( \d{4})?|\d{4} remaster|remasteris[ée]+( en \d{4})?|7\s*["”″] mix|original( version)?( \d{4})?/gi,
      '',
    );
    if (BAD.test(extra)) return false;
    if (BAD_ALBUM.test(x.album.title)) return false;
    return true;
  });
  ok.sort((p, q) => q.rank - p.rank);
  return ok[0] ?? null;
}

const out: { id: number; artist: string; title: string; fr: boolean }[] = [];
const missing: string[] = [];
const seen = new Set<number>();

for (const [artist, title, fr] of HITS_LIST) {
  let found = pick(await search(`artist:"${artist}" track:"${title}"`), artist, title);
  if (!found) {
    await sleep(150);
    found = pick(await search(`${artist} ${title}`), artist, title);
  }
  if (found && !seen.has(found.id)) {
    seen.add(found.id);
    out.push({ id: found.id, artist: found.artist.name, title: found.title_short, fr });
    console.log(`✓ ${found.artist.name} — ${found.title}  (rang ${found.rank})`);
  } else {
    missing.push(`${artist} — ${title}`);
    console.log(`✗ ${artist} — ${title}`);
  }
  await sleep(150); // ≈ 6 requêtes / s : sous la limite de Deezer (50 / 5 s)
}

const header = `// Généré par scripts/build-hits.ts — ne pas modifier (modifier scripts/hits-list.ts).\n`;
const body = `export interface Hit {\n  id: number;\n  artist: string;\n  title: string;\n  fr: boolean;\n}\n\nexport const HITS: Hit[] = ${JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n  {').replace(/^\[\{/, '[\n  {').replace(/\}\]$/, '},\n]')};\n`;
await writeFile(join(ROOT, 'shared', 'hits-data.ts'), header + '\n' + body);
console.log(`\n${out.length} titres résolus (${out.filter((h) => h.fr).length} français), ${missing.length} introuvables :`);
for (const m of missing) console.log(`  - ${m}`);
