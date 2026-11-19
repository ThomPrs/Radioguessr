// Carte Leaflet sans tuiles : pays Natural Earth dessinés à l'encre sur papier crème.

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { FeatureCollection } from 'geojson';
import { greatCircleSegments, type LatLon } from '../../shared/scoring';
import { t } from '../i18n/fr';
import { pinMarkerIcon } from '../pins/PinMarker';
import { STARTER_PIN } from '../../shared/pins';

const INK = '#3a3632';
const LAND = '#efe6d2';
const POST_BLUE = '#2f5d8c'; // quadrillage
const STAMP_RED = '#d9483b'; // arcs en solo

let countriesPromise: Promise<FeatureCollection> | null = null;
function loadCountries(): Promise<FeatureCollection> {
  countriesPromise ??= fetch('/data/countries.json').then((r) => {
    if (!r.ok) throw new Error(`countries.json: HTTP ${r.status}`);
    return r.json() as Promise<FeatureCollection>;
  });
  return countriesPromise;
}

export interface PlayerPin {
  pos: LatLon | null;
  color: string;
  label: string;
  /** Épingle du joueur (marqueur). */
  pinId: string;
}

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

export interface SummaryItem {
  station: LatLon;
  guess: LatLon | null;
}

export interface InkMapOptions {
  onPin?: (pos: LatLon) => void;
  /** Épingle plantée par le joueur (profil). */
  pinId?: string;
}

export class InkMap {
  readonly map: L.Map;
  private pin: L.Marker | null = null;
  private pinnable = false;
  private readonly overlay = L.layerGroup();
  private readonly onPin: ((pos: LatLon) => void) | undefined;
  private pinId: string;

  constructor(container: HTMLElement, opts: InkMapOptions = {}) {
    this.onPin = opts.onPin;
    this.pinId = opts.pinId ?? STARTER_PIN;
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
      this.pin = L.marker(latlng, { icon: pinMarkerIcon(this.pinId), draggable: true, keyboard: false }).addTo(this.map);
      this.pin.on('dragend', () => {
        const p = this.pin!.getLatLng().wrap();
        this.pin!.setLatLng(p);
        this.onPin?.({ lat: p.lat, lon: p.lng });
      });
    }
    this.onPin?.({ lat: latlng.lat, lon: latlng.lng });
  }

  /** Change l'épingle du joueur (profil modifié) ; la punaise déjà posée est redessinée. */
  setMarkerPin(pinId: string): void {
    this.pinId = pinId;
    this.pin?.setIcon(pinMarkerIcon(pinId));
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

  /** Pose la punaise sans clic (reconnexion en cours de manche). */
  setPin(pos: LatLon | null): void {
    if (!pos) {
      this.pin?.remove();
      this.pin = null;
      return;
    }
    if (this.pin) this.pin.setLatLng([pos.lat, pos.lon]);
    else this.pin = L.marker([pos.lat, pos.lon], { icon: pinMarkerIcon(this.pinId), draggable: this.pinnable, keyboard: false }).addTo(this.map);
  }

  /** Révélation multijoueur : la station, et pour chaque joueur sa punaise et son arc, dans sa couleur. */
  revealMulti(station: LatLon, pins: readonly PlayerPin[]): void {
    this.setPinnable(false);
    this.overlay.clearLayers();
    this.setPin(null); // la punaise « locale » est remplacée par celle, colorée, du joueur
    L.marker([station.lat, station.lon], { icon: stationIcon, interactive: false }).addTo(this.overlay);
    const points: L.LatLngExpression[] = [[station.lat, station.lon]];
    for (const { pos, color, label, pinId } of pins) {
      if (!pos) continue;
      points.push([pos.lat, pos.lon]);
      for (const seg of greatCircleSegments(pos, station)) {
        L.polyline(seg, { color, weight: 2.5, dashArray: '6 6', interactive: false }).addTo(this.overlay);
      }
      L.marker([pos.lat, pos.lon], { icon: pinMarkerIcon(pinId, { ring: color, label }), title: label, keyboard: false }).addTo(this.overlay);
    }
    if (points.length > 1) this.map.flyToBounds(L.latLngBounds(points).pad(0.3), { maxZoom: 6, duration: 1 });
    else this.map.flyTo([station.lat, station.lon], 4, { duration: 1 });
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
      L.marker([item.guess.lat, item.guess.lon], { icon: pinMarkerIcon(this.pinId, { number: i + 1 }), interactive: false }).addTo(this.overlay);
    });
    if (points.length > 0) this.map.fitBounds(L.latLngBounds(points).pad(0.2), { maxZoom: 5 });
  }

  /** Joker Radar : cercle (en km) dans lequel se trouve la station. */
  showRadar(center: LatLon, radiusKm: number): void {
    const circle = L.circle([center.lat, center.lon], {
      radius: radiusKm * 1000,
      color: POST_BLUE,
      weight: 2,
      dashArray: '8 6',
      fillColor: POST_BLUE,
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(this.overlay);
    this.map.flyToBounds(circle.getBounds().pad(0.15), { maxZoom: 5, duration: 0.8 });
  }

  /** Joker Espion : l'épingle validée d'un adversaire, dans sa couleur. */
  showSpy(pos: LatLon, color: string, label: string, pinId: string): void {
    L.marker([pos.lat, pos.lon], { icon: pinMarkerIcon(pinId, { ring: color, label }), interactive: false }).addTo(this.overlay);
  }

  /** Remet la carte à zéro pour une nouvelle manche. */
  reset(): void {
    this.overlay.clearLayers();
    this.pin?.remove();
    this.pin = null;
    // Sans animation : Leaflet ignore les clics pendant un vol de caméra, et le joueur
    // doit pouvoir planter sa punaise dès le début de la manche.
    this.map.stop();
    this.map.fitBounds([[-55, -170], [75, 175]], { animate: false });
  }

  invalidateSize(): void {
    this.map.invalidateSize();
  }

  destroy(): void {
    this.map.remove();
  }
}
