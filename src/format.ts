// Mise en forme des nombres et distances, en français.

const intFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export const formatInt = (n: number): string => intFmt.format(n);

export function formatKm(km: number): string {
  if (km < 10) return `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
  return `${intFmt.format(km)} km`;
}
