// Carte Leaflet sans tuiles : pays Natural Earth dessinés à l'encre sur papier crème.

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { FeatureCollection } from 'geojson';
import { greatCircleSegments, type LatLon } from '../../shared/scoring';
import { t } from '../i18n/fr';

const INK = '#3a3632';
const LAND = '#efe6d2';
const POST_BLUE = '#2f5d8c';
const STAMP_RED = '#d9483b';

let countriesPromise: Promise<FeatureCollection> | null = null;
function loadCountries(): Promise<FeatureCollection> {
  countriesPromise ??= fetch('/data/countries.json').then((r) => {
    if (!r.ok) throw new Error(`countries.json: HTTP ${r.status}`);
    return r.json() as Promise<FeatureCollection>;
  });
  return countriesPromise;
}

const pinIcon = L.divIcon({
  className: 'ink-pin',
  html: `<svg viewBox="0 0 32 48" width="32" height="48" aria-hidden="true">
    <line x1="16" y1="20" x2="16" y2="46" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="16" cy="44" rx="5" ry="1.6" fill="${INK}" opacity="0.25"/>
    <circle cx="16" cy="13" r="10" fill="${STAMP_RED}" stroke="${INK}" stroke-width="1.5"/>
    <circle cx="12.5" cy="9.5" r="3" fill="#fff" opacity="0.45"/>
  </svg>`,
  iconSize: [32, 48],
  iconAnchor: [16, 46],
});

const stationIcon = L.divIcon({
  className: 'ink-station',
  html: `<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
    <path d="M20 14 L13 36 M20 14 L27 36 M15.5 28 H24.5 M14.5 32 H25.5" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="20" cy="11" r="3.5" fill="${POST_BLUE}" stroke="${INK}" stroke-width="1.5"/>
    <path d="M12 5 Q7 11 12 17 M28 5 Q33 11 28 17" stroke="${POST_BLUE}" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`,
  iconSize: [40, 40],
  iconAnchor: [20, 36],
});

function numberedPinIcon(n: number): L.DivIcon {
  return L.divIcon({
    className: 'ink-pin',
    html: `<svg viewBox="0 0 32 48" width="28" height="42" aria-hidden="true">
      <line x1="16" y1="20" x2="16" y2="46" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="16" cy="13" r="11" fill="${STAMP_RED}" stroke="${INK}" stroke-width="1.5"/>
      <text x="16" y="18" text-anchor="middle" font-family="Archivo Black, sans-serif" font-size="13" fill="#fff">${n}</text>
    </svg>`,
    iconSize: [28, 42],
    iconAnchor: [14, 40],
  });
}

export interface SummaryItem {
  station: LatLon;
  guess: LatLon | null;
}

export interface InkMapOptions {
  onPin?: (pos: LatLon) => void;
}

export class InkMap {
  readonly map: L.Map;
  private pin: L.Marker | null = null;
  private pinnable = false;
  private readonly overlay = L.layerGroup();
  private readonly onPin: ((pos: LatLon) => void) | undefined;

  constructor(container: HTMLElement, opts: InkMapOptions = {}) {
    this.onPin = opts.onPin;
    const renderer = L.canvas({ padding: 0.5 });
    this.map = L.map(container, {
      renderer,
      center: [25, 10],
      zoom: 2,
      minZoom: 0.5,
      maxZoom: 8,
      zoomSnap: 0.25,
      worldCopyJump: false,
      maxBounds: [
        [-75, -200],
        [85, 200],
      ],
      maxBoundsViscosity: 0.9,
      attributionControl: true,
    });
    this.map.attributionControl.setPrefix(false).addAttribution(t.map.attribution);
    this.map.fitBounds([[-55, -170], [75, 175]]);

    this.overlay.addTo(this.map);
    void loadCountries().then((data) => {
      // Ordre de dessin du canvas : pays, puis quadrillage, puis tracés de révélation.
      const graticule = this.drawGraticule(renderer);
      graticule.bringToBack();
      L.geoJSON(data, {
        interactive: false,
        style: { color: INK, weight: 0.7, opacity: 0.85, fillColor: LAND, fillOpacity: 1 },
      })
        .addTo(this.map)
        .bringToBack();
    });

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (!this.pinnable) return;
      this.placePin(e.latlng.wrap());
    });
  }

  /** Lignes de méridiens/parallèles tous les 15°, façon carte imprimée. */
  private drawGraticule(renderer: L.Renderer): L.FeatureGroup {
    const group = L.featureGroup();
    const style: L.PolylineOptions = { renderer, color: POST_BLUE, weight: 0.5, opacity: 0.3, dashArray: '2 4', interactive: false };
    for (let lon = -180; lon <= 180; lon += 15) L.polyline([[-85, lon], [85, lon]], style).addTo(group);
    for (let lat = -75; lat <= 75; lat += 15) {
      L.polyline([[lat, -180], [lat, 180]], { ...style, opacity: lat === 0 ? 0.55 : 0.3 }).addTo(group);
    }
    return group.addTo(this.map);
  }

  private placePin(latlng: L.LatLng): void {
    if (this.pin) {
      this.pin.setLatLng(latlng);
    } else {
      this.pin = L.marker(latlng, { icon: pinIcon, draggable: true, keyboard: false }).addTo(this.map);
      this.pin.on('dragend', () => {
        const p = this.pin!.getLatLng().wrap();
        this.pin!.setLatLng(p);
        this.onPin?.({ lat: p.lat, lon: p.lng });
      });
    }
    this.onPin?.({ lat: latlng.lat, lon: latlng.lng });
  }

  /** Autorise ou non la pose de la punaise (pendant l'écoute uniquement). */
  setPinnable(on: boolean): void {
    this.pinnable = on;
    this.pin?.dragging?.[on ? 'enable' : 'disable']();
    this.map.getContainer().classList.toggle('is-pinnable', on);
  }

  /** Affiche la vraie position de la station et l'arc qui la relie à la punaise. */
  reveal(station: LatLon, guess: LatLon | null): void {
    this.setPinnable(false);
    L.marker([station.lat, station.lon], { icon: stationIcon, interactive: false }).addTo(this.overlay);
    if (!guess) {
      this.map.flyTo([station.lat, station.lon], 4, { duration: 1 });
      return;
    }
    for (const seg of greatCircleSegments(guess, station)) {
      L.polyline(seg, { color: STAMP_RED, weight: 2.5, dashArray: '6 6', interactive: false }).addTo(this.overlay);
    }
    const bounds = L.latLngBounds([
      [guess.lat, guess.lon],
      [station.lat, station.lon],
    ]);
    this.map.flyToBounds(bounds.pad(0.35), { maxZoom: 6, duration: 1 });
  }

  /** Toutes les manches d'une partie sur une seule carte. */
  showSummary(items: readonly SummaryItem[]): void {
    this.setPinnable(false);
    this.overlay.clearLayers();
    const points: L.LatLngExpression[] = [];
    items.forEach((item, i) => {
      L.marker([item.station.lat, item.station.lon], { icon: stationIcon, interactive: false }).addTo(this.overlay);
      points.push([item.station.lat, item.station.lon]);
      if (!item.guess) return;
      points.push([item.guess.lat, item.guess.lon]);
      for (const seg of greatCircleSegments(item.guess, item.station)) {
        L.polyline(seg, { color: STAMP_RED, weight: 2, dashArray: '5 5', interactive: false }).addTo(this.overlay);
      }
      L.marker([item.guess.lat, item.guess.lon], { icon: numberedPinIcon(i + 1), interactive: false }).addTo(this.overlay);
    });
    if (points.length > 0) this.map.fitBounds(L.latLngBounds(points).pad(0.2), { maxZoom: 5 });
  }

  /** Remet la carte à zéro pour une nouvelle manche. */
  reset(): void {
    this.overlay.clearLayers();
    this.pin?.remove();
    this.pin = null;
    this.map.flyToBounds([[-55, -170], [75, 175]], { duration: 0.8 });
  }

  invalidateSize(): void {
    this.map.invalidateSize();
  }

  destroy(): void {
    this.map.remove();
  }
}
