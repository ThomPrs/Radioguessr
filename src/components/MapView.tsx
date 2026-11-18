// Enveloppe Preact autour de la carte Leaflet (impérative).

import { useEffect, useRef } from 'preact/hooks';
import type { LatLon } from '../../shared/scoring';
import { InkMap } from '../map/ink-map';
import { save } from '../state/save';

interface Props {
  onReady: (map: InkMap) => void;
  onPin?: (pos: LatLon) => void;
}

export function MapView({ onReady, onPin }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const onPinRef = useRef(onPin);
  onPinRef.current = onPin;

  useEffect(() => {
    // L'épingle choisie dans le profil est celle que le joueur plante sur la carte.
    const map = new InkMap(el.current!, { onPin: (p) => onPinRef.current?.(p), pinId: save.peek().profile.pin });
    onReady(map);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el.current!);
    return () => {
      ro.disconnect();
      map.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={el} class="ink-map" />;
}
