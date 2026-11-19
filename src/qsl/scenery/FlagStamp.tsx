// Drapeau simplifié dessiné en SVG, et petit timbre dentelé qui le porte (avec oblitération ondulée).

import type { JSX } from 'preact';
import type { FlagSpec } from '../../../shared/country-look';
import { INK, PAPER } from './common';

/** Drapeau dans le rectangle (x, y, w, h). `uid` : identifiant unique pour le découpage. */
export function FlagArt({ flag, x, y, w, h, uid }: { flag: FlagSpec; x: number; y: number; w: number; h: number; uid: string }) {
  const c = flag.colors;
  const em = flag.emblem;
  const els: JSX.Element[] = [];
  const cx = x + w / 2;
  const cy = y + h / 2;
  const star = (sx: number, sy: number, rad: number, color: string, k: string) => {
    const pts = Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? rad * 0.45 : rad;
      return `${(sx + Math.cos(a) * rr).toFixed(1)},${(sy + Math.sin(a) * rr).toFixed(1)}`;
    });
    return <polygon key={k} points={pts.join(' ')} fill={color} />;
  };
  const stripes = (cols: string[], dir: 'h' | 'v', x0 = x, y0 = y, ww = w, hh = h) =>
    cols.map((col, i) =>
      dir === 'h' ? (
        <rect key={`s${i}`} x={x0} y={y0 + (i * hh) / cols.length} width={ww} height={hh / cols.length + 0.3} fill={col} />
      ) : (
        <rect key={`s${i}`} x={x0 + (i * ww) / cols.length} y={y0} width={ww / cols.length + 0.3} height={hh} fill={col} />
      ),
    );

  switch (flag.layout) {
    case 'h':
    case 'v':
      els.push(...stripes(c, flag.layout));
      if (em) els.push(<circle key="em" cx={cx} cy={cy} r={h * 0.16} fill={em} />);
      break;
    case 'nordic': {
      const t = h * 0.22;
      const vx = x + w * 0.36;
      els.push(<rect key="bg" x={x} y={y} width={w} height={h} fill={c[0]} />);
      els.push(<rect key="ch" x={x} y={cy - t / 2} width={w} height={t} fill={c[1]} />, <rect key="cv" x={vx - t / 2} y={y} width={t} height={h} fill={c[1]} />);
      if (c[2]) els.push(<rect key="ih" x={x} y={cy - t / 4} width={w} height={t / 2} fill={c[2]} />, <rect key="iv" x={vx - t / 4} y={y} width={t / 2} height={h} fill={c[2]} />);
      break;
    }
    case 'cross': {
      const t = h * 0.2;
      els.push(<rect key="bg" x={x} y={y} width={w} height={h} fill={c[0]} />);
      els.push(<rect key="ch" x={cx - h * 0.32} y={cy - t / 2} width={h * 0.64} height={t} fill={em ?? PAPER} />, <rect key="cv" x={cx - t / 2} y={cy - h * 0.32} width={t} height={h * 0.64} fill={em ?? PAPER} />);
      break;
    }
    case 'disc':
      els.push(<rect key="bg" x={x} y={y} width={w} height={h} fill={c[0]} />, <circle key="d" cx={x + w * (c[0] === '#006a4e' ? 0.45 : 0.5)} cy={cy} r={h * 0.3} fill={c[1]} />);
      if (c[2]) els.push(<path key="d2" d={`M${cx - h * 0.3} ${cy} A${h * 0.3} ${h * 0.3} 0 0 0 ${cx + h * 0.3} ${cy} Z`} fill={c[2]} />);
      break;
    case 'canton': {
      const body = c.slice(1);
      els.push(...stripes(body.length ? body : [c[0]!], 'h'));
      const cw = w * 0.42;
      const ch = h * (body.length > 3 ? 0.54 : 0.5);
      els.push(<rect key="ct" x={x} y={y} width={cw} height={ch} fill={c[0]} />);
      if (em) els.push(star(x + cw / 2, y + ch / 2, ch * 0.28, em, 'st'));
      break;
    }
    case 'ensign':
    case 'union': {
      const field = c[0]!;
      els.push(<rect key="bg" x={x} y={y} width={w} height={h} fill={field} />);
      const ux = x;
      const uy = y;
      const uw = flag.layout === 'union' ? w : w * 0.5;
      const uh = flag.layout === 'union' ? h : h * 0.5;
      els.push(
        <g key="uj">
          <rect x={ux} y={uy} width={uw} height={uh} fill="#012169" />
          <path d={`M${ux} ${uy} L${ux + uw} ${uy + uh} M${ux + uw} ${uy} L${ux} ${uy + uh}`} stroke={PAPER} stroke-width={uh * 0.2} />
          <path d={`M${ux} ${uy} L${ux + uw} ${uy + uh} M${ux + uw} ${uy} L${ux} ${uy + uh}`} stroke="#c8102e" stroke-width={uh * 0.07} />
          <rect x={ux} y={uy + uh * 0.38} width={uw} height={uh * 0.24} fill={PAPER} />
          <rect x={ux + uw * 0.42} y={uy} width={uw * 0.16} height={uh} fill={PAPER} />
          <rect x={ux} y={uy + uh * 0.43} width={uw} height={uh * 0.14} fill="#c8102e" />
          <rect x={ux + uw * 0.46} y={uy} width={uw * 0.08} height={uh} fill="#c8102e" />
        </g>,
      );
      if (flag.layout === 'ensign' && em) els.push(star(x + w * 0.75, y + h * 0.62, h * 0.16, em, 'st'));
      break;
    }
    case 'tri':
      els.push(...stripes(c.slice(1), 'h'));
      els.push(<path key="tr" d={`M${x} ${y} L${x + w * 0.42} ${cy} L${x} ${y + h} Z`} fill={c[0]} />);
      if (em) els.push(star(x + w * 0.13, cy, h * 0.13, em, 'st'));
      break;
    case 'hoist':
      els.push(...stripes(c.slice(1), 'h', x + w * 0.28, y, w * 0.72, h));
      els.push(<rect key="ho" x={x} y={y} width={w * 0.28} height={h} fill={c[0]} />);
      if (em) els.push(<circle key="em" cx={x + w * 0.62} cy={cy} r={h * 0.15} fill={em} />);
      break;
    case 'diag':
      els.push(<rect key="bg" x={x} y={y} width={w} height={h} fill={c[0]} />);
      if (c[2]) els.push(<path key="d2" d={`M${x + w} ${y} L${x + w} ${y + h} L${x} ${y + h} Z`} fill={c[2]} />);
      els.push(<path key="band" d={`M${x} ${y + h} L${x + w} ${y}`} stroke={c[1]} stroke-width={h * 0.28} />);
      if (em) els.push(star(x + w * 0.2, y + h * 0.28, h * 0.13, em, 'st'));
      break;
    case 'saltire':
      els.push(<rect key="tb" x={x} y={y} width={w} height={h} fill={c[0]} />);
      els.push(<path key="lr" d={`M${x} ${y} L${cx} ${cy} L${x} ${y + h} Z M${x + w} ${y} L${cx} ${cy} L${x + w} ${y + h} Z`} fill={c[1]} />);
      els.push(<path key="x" d={`M${x} ${y} L${x + w} ${y + h} M${x + w} ${y} L${x} ${y + h}`} stroke={em ?? PAPER} stroke-width={h * 0.16} />);
      break;
    case 'quart':
      els.push(
        <rect key="q1" x={x} y={y} width={w / 2} height={h / 2} fill={c[0]} />,
        <rect key="q2" x={cx} y={y} width={w / 2} height={h / 2} fill={c[1]} />,
        <rect key="q3" x={x} y={cy} width={w / 2} height={h / 2} fill={c[2]} />,
        <rect key="q4" x={cx} y={cy} width={w / 2} height={h / 2} fill={c[3]} />,
      );
      if (em) els.push(<rect key="ch" x={x} y={cy - h * 0.08} width={w} height={h * 0.16} fill={em} />, <rect key="cv" x={cx - h * 0.08} y={y} width={h * 0.16} height={h} fill={em} />);
      break;
    case 'rhombus':
      els.push(<rect key="bg" x={x} y={y} width={w} height={h} fill={c[0]} />);
      els.push(<path key="r" d={`M${x + w * 0.1} ${cy} L${cx} ${y + h * 0.1} L${x + w * 0.9} ${cy} L${cx} ${y + h * 0.9} Z`} fill={c[1]} />);
      els.push(<circle key="d" cx={cx} cy={cy} r={h * 0.22} fill={c[2]} />);
      break;
    case 'plain':
    default:
      els.push(<rect key="bg" x={x} y={y} width={w} height={h} fill={c[0]} />);
      if (c[1]) els.push(<rect key="b" x={x} y={y + h * 0.8} width={w} height={h * 0.2} fill={c[1]} />);
      if (em) els.push(star(cx, cy, h * 0.24, em, 'st'));
  }

  return (
    <g>
      <clipPath id={`fc-${uid}`}>
        <rect x={x} y={y} width={w} height={h} />
      </clipPath>
      <g clip-path={`url(#fc-${uid})`}>{els}</g>
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={INK} stroke-width="0.6" />
    </g>
  );
}

/** Petit timbre dentelé portant le drapeau, légèrement incliné, avec une oblitération ondulée. */
export function FlagStamp({ flag, x, y, uid }: { flag: FlagSpec; x: number; y: number; uid: string }) {
  const w = 40;
  const h = 30;
  return (
    <g transform={`translate(${x} ${y}) rotate(-6)`}>
      {/* Papier du timbre, bord perforé : des trous ronds découpés tout autour */}
      <mask id={`fm-${uid}`}>
        <rect x="-4" y="-4" width={w + 8} height={h + 8} fill="#fff" />
        {Array.from({ length: 12 }, (_, i) => (
          <g key={i} fill="#000">
            <circle cx={-4 + (i * (w + 8)) / 11} cy="-4" r="1.6" />
            <circle cx={-4 + (i * (w + 8)) / 11} cy={h + 4} r="1.6" />
          </g>
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <g key={`v${i}`} fill="#000">
            <circle cx="-4" cy={-4 + (i * (h + 8)) / 8} r="1.6" />
            <circle cx={w + 4} cy={-4 + (i * (h + 8)) / 8} r="1.6" />
          </g>
        ))}
      </mask>
      <rect x="-3" y="-2.5" width={w + 8} height={h + 8} fill={INK} opacity="0.25" mask={`url(#fm-${uid})`} />
      <rect x="-4" y="-4" width={w + 8} height={h + 8} fill={PAPER} mask={`url(#fm-${uid})`} />
      <FlagArt flag={flag} x={0} y={0} w={w} h={h} uid={uid} />
      {/* Oblitération */}
      <g stroke={INK} stroke-width="1" fill="none" opacity="0.55">
        <circle cx={w + 4} cy={h - 2} r="9" />
        <path d={`M${w - 8} ${h - 10} q4 -3 8 0 t8 0 t8 0 M${w - 8} ${h - 5} q4 -3 8 0 t8 0 t8 0`} />
      </g>
    </g>
  );
}
