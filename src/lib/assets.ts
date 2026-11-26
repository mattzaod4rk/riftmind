function isLocalHost(): boolean {
  if (typeof window === 'undefined') return true;
  const h = window.location.hostname;
  return h === '127.0.0.1' || h === 'localhost';
}

const DDRAGON_CDN = 'https://ddragon.leagueoflegends.com/cdn';

export function getChampionIconUrl(patch: string, imageFull: string): string {
  if (isLocalHost()) return `/api/assets/${patch}/img/champion/${imageFull}`;
  return `${DDRAGON_CDN}/${patch}/img/champion/${imageFull}`;
}

export function getItemIconUrl(patch: string, imageFull: string): string {
  if (isLocalHost()) return `/api/assets/${patch}/img/item/${imageFull}`;
  return `${DDRAGON_CDN}/${patch}/img/item/${imageFull}`;
}

export function getSpellIconUrl(patch: string, imageFull: string): string {
  if (isLocalHost()) return `/api/assets/${patch}/img/spell/${imageFull}`;
  return `${DDRAGON_CDN}/${patch}/img/spell/${imageFull}`;
}

export function getPassiveIconUrl(patch: string, imageFull: string): string {
  if (isLocalHost()) return `/api/assets/${patch}/img/passive/${imageFull}`;
  return `${DDRAGON_CDN}/${patch}/img/passive/${imageFull}`;
}

export function getRuneIconUrl(iconPath: string): string {
  const cleaned = iconPath.replace(/^\/+/, '');
  if (isLocalHost()) return `/api/assets/img/${cleaned}`;
  return `${DDRAGON_CDN}/img/${cleaned}`;
}
