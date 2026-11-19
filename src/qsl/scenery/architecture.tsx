// Silhouettes d'architecture par région, à l'encre, posées sur l'horizon entre x0 et x1.

import type { JSX } from 'preact';
import type { Architecture } from '../../../shared/country-look';
import { INK, PAPER, f, r, type Ink } from './common';

type El = JSX.Element;

/** Fenêtres éclairées (cartes rares) sur un bâtiment. */
function windows(ink: Ink, key: string, x: number, top: number, w: number, bottom: number, out: El[]) {
  if (!ink.rich) return;
  for (let wy = top + 5; wy < bottom - 5; wy += 7) {
    for (let wx = x + 3; wx < x + w - 4; wx += 6) {
      if (ink.rng() < 0.45) out.push(<rect key={`${key}w${f(wx)}-${f(wy)}`} x={f(wx)} y={f(wy)} width="2.5" height="3" fill={ink.fill} />);
    }
  }
}

/** Boucle de remplissage : place des bâtiments de largeur variable de x0 à x1. */
function row(ink: Ink, x0: number, x1: number, minW: number, maxW: number, gap: number, draw: (x: number, w: number, i: number, out: El[]) => void): El[] {
  const out: El[] = [];
  let x = x0;
  let i = 0;
  while (x < x1 - minW * 0.6) {
    const w = Math.min(r(ink.rng, minW, maxW), x1 - x);
    draw(x, w, i, out);
    x += w + r(ink.rng, 0, gap);
    i++;
  }
  return out;
}

export function Skyline({ arch, ink, x0, x1 }: { arch: Architecture; ink: Ink; x0: number; x1: number }) {
  if (x1 - x0 < 14) return null;
  const { rng, horizon: hz, fill, mono } = ink;
  const accent = mono ? INK : fill;
  let els: El[] = [];

  switch (arch) {
    case 'european':
      els = row(ink, x0, x1, 12, 22, 2, (x, w, i, out) => {
        const h = r(rng, 16, 34);
        const top = hz - h;
        out.push(<rect key={`b${i}`} x={f(x)} y={f(top)} width={f(w)} height={f(h + 1)} fill={INK} />);
        // Pignon pointu, parfois un clocher
        out.push(<path key={`r${i}`} d={`M${f(x - 1)} ${f(top)} L${f(x + w / 2)} ${f(top - w * 0.6)} L${f(x + w + 1)} ${f(top)} Z`} fill={INK} />);
        if (rng() < 0.18) {
          out.push(<rect key={`t${i}`} x={f(x + w / 2 - 3)} y={f(top - w * 0.6 - 18)} width="6" height="20" fill={INK} />);
          out.push(<path key={`s${i}`} d={`M${f(x + w / 2 - 4)} ${f(top - w * 0.6 - 18)} L${f(x + w / 2)} ${f(top - w * 0.6 - 34)} L${f(x + w / 2 + 4)} ${f(top - w * 0.6 - 18)} Z`} fill={INK} />);
        }
        windows(ink, `e${i}`, x, top, w, hz, out);
      });
      break;
    case 'nordic':
      els = row(ink, x0, x1, 14, 22, 4, (x, w, i, out) => {
        const h = r(rng, 10, 18);
        const top = hz - h;
        out.push(<rect key={`b${i}`} x={f(x)} y={f(top)} width={f(w)} height={f(h + 1)} fill={rng() < 0.5 ? accent : INK} stroke={INK} stroke-width="1" />);
        out.push(<path key={`r${i}`} d={`M${f(x - 2)} ${f(top)} L${f(x + w / 2)} ${f(top - w * 0.75)} L${f(x + w + 2)} ${f(top)} Z`} fill={INK} />);
        out.push(<rect key={`d${i}`} x={f(x + w / 2 - 2)} y={f(hz - 6)} width="4" height="6" fill={PAPER} />);
      });
      break;
    case 'mediterranean':
      els = row(ink, x0, x1, 12, 20, 0, (x, w, i, out) => {
        const h = r(rng, 12, 28);
        const top = hz - h;
        out.push(<rect key={`b${i}`} x={f(x)} y={f(top)} width={f(w)} height={f(h + 1)} fill={PAPER} stroke={INK} stroke-width="1.2" />);
        out.push(<rect key={`w${i}`} x={f(x + w / 2 - 2)} y={f(top + 4)} width="4" height="5" fill={INK} />);
        if (rng() < 0.25) out.push(<path key={`d${i}`} d={`M${f(x + 1)} ${f(top)} A${f(w / 2 - 1)} ${f(w / 2 - 1)} 0 0 1 ${f(x + w - 1)} ${f(top)} Z`} fill={accent} stroke={INK} stroke-width="1.2" />);
      });
      break;
    case 'orthodox':
      els = row(ink, x0, x1, 14, 24, 3, (x, w, i, out) => {
        const h = r(rng, 18, 36);
        const top = hz - h;
        const cx = x + w / 2;
        out.push(<rect key={`b${i}`} x={f(x)} y={f(top)} width={f(w)} height={f(h + 1)} fill={INK} />);
        if (rng() < 0.55) {
          // Bulbe sur un tambour, croix
          const bw = w * 0.42;
          out.push(<rect key={`t${i}`} x={f(cx - bw * 0.55)} y={f(top - 8)} width={f(bw * 1.1)} height="9" fill={INK} />);
          out.push(<path key={`o${i}`} d={`M${f(cx - bw)} ${f(top - 8)} Q${f(cx - bw * 1.1)} ${f(top - 8 - bw * 1.2)} ${f(cx)} ${f(top - 8 - bw * 2)} Q${f(cx + bw * 1.1)} ${f(top - 8 - bw * 1.2)} ${f(cx + bw)} ${f(top - 8)} Z`} fill={rng() < 0.5 ? accent : INK} stroke={INK} stroke-width="1" />);
          out.push(<path key={`c${i}`} d={`M${f(cx)} ${f(top - 8 - bw * 2)} v-7 M${f(cx - 3)} ${f(top - 13 - bw * 2)} h6`} stroke={INK} stroke-width="1.3" />);
        }
        windows(ink, `o${i}`, x, top, w, hz, out);
      });
      break;
    case 'islamic':
      els = row(ink, x0, x1, 16, 30, 3, (x, w, i, out) => {
        const h = r(rng, 12, 24);
        const top = hz - h;
        const cx = x + w / 2;
        out.push(<rect key={`b${i}`} x={f(x)} y={f(top)} width={f(w)} height={f(h + 1)} fill={INK} />);
        const k = rng();
        if (k < 0.35) out.push(<path key={`d${i}`} d={`M${f(x + 2)} ${f(top)} Q${f(x + 2)} ${f(top - w * 0.55)} ${f(cx)} ${f(top - w * 0.62)} Q${f(x + w - 2)} ${f(top - w * 0.55)} ${f(x + w - 2)} ${f(top)} Z`} fill={rng() < 0.5 ? accent : INK} stroke={INK} stroke-width="1" />);
        else if (k < 0.6) {
          // Minaret avec balcon et flèche
          const mx = x + w - 4;
          const mh = h + r(rng, 24, 38);
          out.push(<rect key={`m${i}`} x={f(mx - 2.5)} y={f(hz - mh)} width="5" height={f(mh)} fill={INK} />);
          out.push(<rect key={`mb${i}`} x={f(mx - 4)} y={f(hz - mh * 0.75)} width="8" height="2.5" fill={INK} />);
          out.push(<path key={`mt${i}`} d={`M${f(mx - 3)} ${f(hz - mh)} L${f(mx)} ${f(hz - mh - 8)} L${f(mx + 3)} ${f(hz - mh)} Z`} fill={accent} />);
        }
        // Fenêtres en arc
        if (ink.rich) out.push(<path key={`a${i}`} d={`M${f(cx - 2)} ${f(hz - 2)} v-5 a2 2 0 0 1 4 0 v5 Z`} fill={fill} />);
      });
      break;
    case 'eastasian':
      els = row(ink, x0, x1, 18, 30, 4, (x, w, i, out) => {
        const cx = x + w / 2;
        const tiers = rng() < 0.4 ? 3 : 1;
        let base = hz;
        for (let t = 0; t < tiers; t++) {
          const tw = w * (1 - t * 0.22);
          const th = t === 0 ? r(rng, 10, 16) : 8;
          out.push(<rect key={`b${i}-${t}`} x={f(cx - tw * 0.38)} y={f(base - th)} width={f(tw * 0.76)} height={f(th + 1)} fill={INK} />);
          // Toit recourbé
          const ry = base - th;
          out.push(<path key={`r${i}-${t}`} d={`M${f(cx - tw * 0.62)} ${f(ry + 1)} Q${f(cx - tw * 0.4)} ${f(ry - 2)} ${f(cx - tw * 0.3)} ${f(ry - 6)} L${f(cx + tw * 0.3)} ${f(ry - 6)} Q${f(cx + tw * 0.4)} ${f(ry - 2)} ${f(cx + tw * 0.62)} ${f(ry + 1)} Z`} fill={t === tiers - 1 && !mono ? accent : INK} stroke={INK} stroke-width="1" />);
          base = ry - 6;
        }
      });
      break;
    case 'southasian':
      els = row(ink, x0, x1, 16, 26, 5, (x, w, i, out) => {
        const cx = x + w / 2;
        if (rng() < 0.5) {
          // Stupa : cloche et flèche
          const b = w * 0.45;
          out.push(<path key={`s${i}`} d={`M${f(cx - b)} ${f(hz + 1)} Q${f(cx - b)} ${f(hz - b * 1.4)} ${f(cx)} ${f(hz - b * 1.5)} Q${f(cx + b)} ${f(hz - b * 1.4)} ${f(cx + b)} ${f(hz + 1)} Z`} fill={rng() < 0.5 && !mono ? accent : INK} stroke={INK} stroke-width="1" />);
          out.push(<path key={`p${i}`} d={`M${f(cx - 2.5)} ${f(hz - b * 1.5)} L${f(cx)} ${f(hz - b * 1.5 - 18)} L${f(cx + 2.5)} ${f(hz - b * 1.5)} Z`} fill={INK} />);
        } else {
          // Temple à étages
          let top = hz;
          for (let t = 0; t < 4; t++) {
            const tw = w * (1 - t * 0.2);
            out.push(<rect key={`t${i}-${t}`} x={f(cx - tw / 2)} y={f(top - 7)} width={f(tw)} height="8" fill={INK} />);
            top -= 7;
          }
          out.push(<path key={`tp${i}`} d={`M${f(cx - 3)} ${f(top)} L${f(cx)} ${f(top - 10)} L${f(cx + 3)} ${f(top)} Z`} fill={accent} />);
        }
      });
      break;
    case 'latin':
      els = row(ink, x0, x1, 12, 22, 1, (x, w, i, out) => {
        if (rng() < 0.2 && w > 16) {
          // Église coloniale à deux tours
          const h = 26;
          out.push(<rect key={`c${i}`} x={f(x)} y={f(hz - h)} width={f(w)} height={f(h + 1)} fill={INK} />);
          for (const tx of [x, x + w - 5]) {
            out.push(<rect key={`t${i}${f(tx)}`} x={f(tx)} y={f(hz - h - 12)} width="5" height="13" fill={INK} />);
            out.push(<path key={`d${i}${f(tx)}`} d={`M${f(tx)} ${f(hz - h - 12)} a2.5 2.5 0 0 1 5 0 Z`} fill={accent} />);
          }
          out.push(<path key={`p${i}`} d={`M${f(x + w / 2 - 4)} ${f(hz)} v-8 a4 4 0 0 1 8 0 v8 Z`} fill={PAPER} />);
        } else {
          const h = r(rng, 10, 18);
          out.push(<rect key={`h${i}`} x={f(x)} y={f(hz - h)} width={f(w)} height={f(h + 1)} fill={rng() < 0.45 ? accent : INK} stroke={INK} stroke-width="1" />);
          out.push(<rect key={`r${i}`} x={f(x - 1)} y={f(hz - h - 2)} width={f(w + 2)} height="2.5" fill={INK} />);
        }
      });
      break;
    case 'african':
      els = row(ink, x0, x1, 12, 18, 8, (x, w, i, out) => {
        const cx = x + w / 2;
        if (rng() < 0.65) {
          // Case ronde au toit de chaume
          out.push(<rect key={`h${i}`} x={f(x + 1)} y={f(hz - 9)} width={f(w - 2)} height="10" fill={INK} />);
          out.push(<path key={`t${i}`} d={`M${f(x - 2)} ${f(hz - 8)} L${f(cx)} ${f(hz - 8 - w * 0.75)} L${f(x + w + 2)} ${f(hz - 8)} Z`} fill={rng() < 0.4 && !mono ? accent : INK} stroke={INK} stroke-width="1" />);
          out.push(<rect key={`d${i}`} x={f(cx - 1.5)} y={f(hz - 5)} width="3" height="5" fill={PAPER} />);
        } else {
          out.push(<rect key={`m${i}`} x={f(x)} y={f(hz - 13)} width={f(w)} height="14" rx="2" fill={INK} />);
        }
      });
      break;
    case 'caribbean':
      els = row(ink, x0, x1, 12, 18, 3, (x, w, i, out) => {
        const h = r(rng, 10, 16);
        const top = hz - h;
        out.push(<rect key={`h${i}`} x={f(x)} y={f(top)} width={f(w)} height={f(h + 1)} fill={rng() < 0.6 ? accent : PAPER} stroke={INK} stroke-width="1.1" />);
        out.push(<path key={`r${i}`} d={`M${f(x - 2)} ${f(top)} L${f(x + w / 2)} ${f(top - 7)} L${f(x + w + 2)} ${f(top)} Z`} fill={INK} />);
        out.push(<rect key={`s${i}`} x={f(x + 3)} y={f(top + 3)} width="3" height="4" fill={INK} />);
      });
      break;
    case 'modern':
      els = row(ink, x0, x1, 10, 22, 2, (x, w, i, out) => {
        const h = r(rng, 26, 70);
        const top = hz - h;
        out.push(<rect key={`b${i}`} x={f(x)} y={f(top)} width={f(w)} height={f(h + 1)} fill={INK} />);
        if (rng() < 0.2) out.push(<line key={`a${i}`} x1={f(x + w / 2)} y1={f(top)} x2={f(x + w / 2)} y2={f(top - 12)} stroke={INK} stroke-width="1.5" />);
        windows(ink, `m${i}`, x, top, w, hz, out);
      });
      break;
  }
  return <g>{els}</g>;
}
