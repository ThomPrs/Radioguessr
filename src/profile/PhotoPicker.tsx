// Profil · photo du joueur : prise avec la caméra ou choisie dans l'appareil, recadrée dans un cercle
// (zoom + glisser), réduite en JPEG 96 × 96. Effet « photo de presse » au choix.

import { useEffect, useRef, useState } from 'preact/hooks';
import { MAX_PHOTO_LENGTH } from '../../shared/avatars';
import { clickSound, stampSound } from '../audio/sfx';
import { t } from '../i18n/fr';
import { save, updateProfile } from '../state/save';
import { AvatarView } from './Avatar';

const OUT = 96; // taille de la photo enregistrée
const VIEW = 220; // taille de l'aperçu de recadrage

type Source = HTMLCanvasElement | HTMLImageElement;
const dims = (s: Source) => (s instanceof HTMLImageElement ? { w: s.naturalWidth, h: s.naturalHeight } : { w: s.width, h: s.height });

/** Carré de la source à garder : centré sur (cx, cy), côté = petit côté / zoom, sans sortir de l'image. */
function cropBox(src: Source, zoom: number, ox: number, oy: number) {
  const { w, h } = dims(src);
  const side = Math.min(w, h) / zoom;
  const cx = Math.min(w - side / 2, Math.max(side / 2, w / 2 + ox));
  const cy = Math.min(h - side / 2, Math.max(side / 2, h / 2 + oy));
  return { x: cx - side / 2, y: cy - side / 2, side, ox: cx - w / 2, oy: cy - h / 2 };
}

/** JPEG 96 × 96 sous la taille maximale (la qualité baisse si besoin). */
function exportPhoto(src: Source, zoom: number, ox: number, oy: number): string | null {
  const c = document.createElement('canvas');
  c.width = c.height = OUT;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const b = cropBox(src, zoom, ox, oy);
  ctx.drawImage(src, b.x, b.y, b.side, b.side, 0, 0, OUT, OUT);
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    const url = c.toDataURL('image/jpeg', q);
    if (url.length <= MAX_PHOTO_LENGTH) return url;
  }
  return null;
}

export function PhotoPicker() {
  const avatar = save.value.profile.avatar;
  const [camera, setCamera] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const setAvatar = (patch: Partial<typeof avatar>) => updateProfile({ avatar: { ...save.peek().profile.avatar, ...patch } });

  function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = '';
    if (!file) return;
    setError(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSource(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      setError(t.photo.badFile);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  return (
    <section class="photo-picker">
      <div class="photo-row">
        {avatar.photo && (
          <button
            class={`avatar-choice${avatar.usePhoto ? ' is-selected' : ''}`}
            aria-pressed={!!avatar.usePhoto}
            title={t.photo.useIt}
            onClick={() => {
              clickSound();
              setAvatar({ usePhoto: true });
            }}
          >
            <AvatarView avatar={{ ...avatar, usePhoto: true }} size={64} />
          </button>
        )}
        <div class="photo-actions">
          <button
            class="small-button"
            onClick={() => {
              clickSound();
              setError(null);
              setCamera(true);
            }}
          >
            {t.photo.take}
          </button>
          <button
            class="small-button"
            onClick={() => {
              clickSound();
              fileInput.current?.click();
            }}
          >
            {t.photo.choose}
          </button>
          <input ref={fileInput} type="file" accept="image/*" class="visually-hidden" onChange={onFile} aria-label={t.photo.choose} />
          {avatar.photo && (
            <button
              class="link-button"
              onClick={() => {
                clickSound();
                setAvatar({ photo: undefined, usePhoto: undefined });
              }}
            >
              {t.photo.remove}
            </button>
          )}
        </div>
      </div>
      {avatar.photo && (
        <label class="news-option photo-press">
          <input
            type="checkbox"
            role="switch"
            checked={!!avatar.press}
            onChange={(e) => {
              clickSound();
              setAvatar({ press: e.currentTarget.checked });
            }}
          />
          <span class="news-option-text">
            <strong class="news-option-title">{t.photo.press}</strong>
            <small>{t.photo.pressDesc}</small>
          </span>
        </label>
      )}
      {error && <p class="form-error">{error}</p>}
      <p class="board-help">{t.photo.privacy}</p>

      {camera && (
        <CameraModal
          onCancel={() => setCamera(false)}
          onError={(msg) => {
            setCamera(false);
            setError(msg);
          }}
          onShot={(c) => {
            setCamera(false);
            setSource(c);
          }}
        />
      )}
      {source && (
        <CropModal
          source={source}
          bg={avatar.bg}
          onCancel={() => setSource(null)}
          onDone={(url) => {
            setSource(null);
            stampSound();
            setAvatar({ photo: url, usePhoto: true });
          }}
        />
      )}
    </section>
  );
}

// ── Caméra ─────────────────────────────────────────────────────────────────

function CameraModal({ onCancel, onShot, onError }: { onCancel: () => void; onShot: (c: HTMLCanvasElement) => void; onError: (msg: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      onError(t.photo.noCamera);
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }, audio: false })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((tr) => tr.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().then(() => setReady(true));
        }
      })
      .catch((err: unknown) => onError(err instanceof DOMException && err.name === 'NotAllowedError' ? t.photo.denied : t.photo.noCamera));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      stream.current?.getTracks().forEach((tr) => tr.stop()); // la caméra s'éteint dès la fermeture
    };
  }, []);

  function shoot() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d')!;
    // Même sens que l'aperçu (miroir, comme dans une glace).
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0);
    stampSound();
    onShot(c);
  }

  return (
    <div class="modal" role="dialog" aria-modal="true" aria-label={t.photo.take} onClick={onCancel}>
      <div class="sheet photo-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t.photo.take}</h2>
        <div class="photo-frame">
          <video ref={video} class="photo-video" playsInline muted />
          {!ready && <p class="photo-wait">{t.photo.starting}</p>}
        </div>
        <div class="photo-modal-actions">
          <button class="link-button" onClick={onCancel}>
            {t.photo.cancel}
          </button>
          <button class="shutter" onClick={shoot} disabled={!ready} aria-label={t.photo.shoot}>
            <span />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Recadrage ──────────────────────────────────────────────────────────────

function CropModal({ source, bg, onCancel, onDone }: { source: Source; bg: number; onCancel: () => void; onDone: (url: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [failed, setFailed] = useState(false);

  // Aperçu : le carré gardé, dessiné dans le cercle.
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const b = cropBox(source, zoom, off.x, off.y);
    ctx.clearRect(0, 0, VIEW, VIEW);
    ctx.drawImage(source, b.x, b.y, b.side, b.side, 0, 0, VIEW, VIEW);
  }, [source, zoom, off]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const move = (e: PointerEvent) => {
    if (!drag.current) return;
    const b = cropBox(source, zoom, off.x, off.y);
    const k = b.side / VIEW; // pixels source par pixel d'écran
    const nx = off.x - (e.clientX - drag.current.x) * k;
    const ny = off.y - (e.clientY - drag.current.y) * k;
    drag.current = { x: e.clientX, y: e.clientY };
    const c = cropBox(source, zoom, nx, ny);
    setOff({ x: c.ox, y: c.oy });
  };

  return (
    <div class="modal" role="dialog" aria-modal="true" aria-label={t.photo.crop} onClick={onCancel}>
      <div class="sheet photo-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t.photo.crop}</h2>
        <p class="board-help">{t.photo.cropHelp}</p>
        <div class="photo-frame" data-bg={bg}>
          <canvas
            ref={canvas}
            class="photo-crop"
            width={VIEW}
            height={VIEW}
            onPointerDown={(e) => {
              drag.current = { x: e.clientX, y: e.clientY };
              (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={move}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          />
        </div>
        <label class="photo-zoom">
          <span>{t.photo.zoom}</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onInput={(e) => {
              const z = Number(e.currentTarget.value);
              const c = cropBox(source, z, off.x, off.y);
              setZoom(z);
              setOff({ x: c.ox, y: c.oy });
            }}
          />
        </label>
        {failed && <p class="form-error">{t.photo.tooBig}</p>}
        <div class="photo-modal-actions">
          <button class="link-button" onClick={onCancel}>
            {t.photo.cancel}
          </button>
          <button
            class="primary-action"
            onClick={() => {
              const url = exportPhoto(source, zoom, off.x, off.y);
              if (url) onDone(url);
              else setFailed(true);
            }}
          >
            {t.photo.use}
          </button>
        </div>
      </div>
    </div>
  );
}
