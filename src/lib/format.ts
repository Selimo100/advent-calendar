import { decemberDate, formatGermanDate, parseIsoDate, zurichLocalDate } from './time.ts';

export const doorDateLabel = (year: number, day: number) => formatGermanDate(decemberDate(year, day));

export function isoToGerman(iso: string): string {
  const date = parseIsoDate(iso);
  return date ? formatGermanDate(date) : iso;
}

export function instantToGerman(iso: string): string {
  return formatGermanDate(zurichLocalDate(new Date(iso)));
}

export function dayLabel(day: number): string {
  return `${day}. Dezember`;
}

/** "3 Tage", "5 Std. 12 Min.", "42 Sek." */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days >= 2) return `${days} Tage${hours ? ` und ${hours} Std.` : ''}`;
  if (days === 1) return `1 Tag${hours ? ` und ${hours} Std.` : ''}`;
  if (hours >= 1) return `${hours} Std. ${minutes} Min.`;
  if (minutes >= 1) return `${minutes} Min.`;
  return `${total} Sek.`;
}
