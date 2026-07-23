const relative = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' });
const absolute = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "3 saat önce" — listelerde tarih yerine bunu gösteriyoruz. */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'az önce';

  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return relative.format(-Math.round(diff / ms), unit);
  }
  return 'az önce';
}

export function formatDateTime(iso: string): string {
  return absolute.format(new Date(iso));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Ad soyadın baş harfleri — avatar yerine kullanılıyor. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('tr') ?? '')
    .join('');
}
