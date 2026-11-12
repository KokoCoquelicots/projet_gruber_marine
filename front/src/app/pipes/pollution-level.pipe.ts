import { Pipe, PipeTransform } from '@angular/core';
import { Pollution, PollutionDeclaration, PollutionType } from '../models/pollution-declaration';

export type PollutionLevel = 'Faible' | 'Modérée' | 'Élevée' | 'Dangereuse';

const STORAGE_KEY = 'vigie.pollutionDangerIndices';

const BASE_DANGER_BY_TYPE: Record<PollutionType, number> = {
  Autre: 15,
  Plastique: 34,
  Air: 44,
  Eau: 68,
  'Dépôt sauvage': 76,
  Chimique: 115
};

/**
 * Transforme un indice de dangerosité numérique en niveau de pollution :
 * - 0–20   → Faible
 * - 21–50  → Modérée
 * - 51–100 → Élevée
 * - 101+   → Dangereuse
 */
export function resolvePollutionLevel(value: number | string | null | undefined): PollutionLevel {
  const numeric = Number(value);
  const index = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;

  if (index <= 20) {
    return 'Faible';
  }
  if (index <= 50) {
    return 'Modérée';
  }
  if (index <= 100) {
    return 'Élevée';
  }
  return 'Dangereuse';
}

export function saveCustomDangerIndex(pollutionId: string, dangerIndex: number): void {
  if (!pollutionId || typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[pollutionId] = Math.max(0, Math.round(dangerIndex));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors in restricted environments
  }
}

export function getSavedDangerIndex(pollutionId: string | undefined): number | null {
  if (!pollutionId || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, number>;
    const value = map[pollutionId];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Calcule ou récupère l'indice de dangerosité numérique d'un signalement.
 */
export function getPollutionDangerIndex(
  pollution: (Partial<Pollution> & Partial<PollutionDeclaration> & { dangerLevel?: number | null }) | null | undefined
): number {
  if (!pollution) return 0;

  if (pollution.dangerLevel !== undefined && pollution.dangerLevel !== null && Number.isFinite(Number(pollution.dangerLevel))) {
    return Math.max(0, Math.round(Number(pollution.dangerLevel)));
  }

  const saved = getSavedDangerIndex(pollution.id);
  if (saved !== null) {
    return saved;
  }

  const base = pollution.type && pollution.type in BASE_DANGER_BY_TYPE
    ? BASE_DANGER_BY_TYPE[pollution.type as PollutionType]
    : 18;

  const text = `${pollution.title ?? ''} ${pollution.description ?? ''}`.toLocaleLowerCase('fr');
  let modifier = 0;

  if (/(toxique|chimique|hydrocarbure|acide|fuite|grave|urgence|massif|contamin)/.test(text)) {
    modifier += 32;
  } else if (/(important|nombreux|accumulation|déversement|encombrant)/.test(text)) {
    modifier += 12;
  }

  if (/(léger|faible|isolé|petit|quelques)/.test(text)) {
    modifier -= 16;
  }

  return Math.max(4, Math.round(base + modifier));
}

@Pipe({
  name: 'pollutionLevel'
})
export class PollutionLevelPipe implements PipeTransform {
  transform(value: number | string | null | undefined): PollutionLevel {
    return resolvePollutionLevel(value);
  }
}
