import type { ChampionData, Role } from './types.ts';
import { inferChampionRoles } from './engine/championProfiler.ts';

/** Remove acentos, apóstrofos e espaços: "Kai'Sa" → "kaisa", "Nunu & Willump" → "nunuwillump". */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

export interface ChampionFilterOptions {
  query?: string;
  role?: Role | 'ALL';
  /** Restringe a um conjunto de IDs (ex.: Minha Champion Pool). */
  onlyIds?: Set<string> | null;
  /** Posições cadastradas pelo usuário, somadas às posições habituais. */
  roleOverrides?: Map<string, Role[]>;
  /**
   * Quando há pesquisa, o filtro de posição é ignorado (padrão: true).
   * Assim a posição funciona como orientação e qualquer campeão continua selecionável.
   */
  queryOverridesRole?: boolean;
}

export function championMatchesRole(champ: ChampionData, role: Role, roleOverrides?: Map<string, Role[]>): boolean {
  if (inferChampionRoles(champ).includes(role)) return true;
  return Boolean(roleOverrides?.get(champ.id)?.includes(role));
}

export function filterChampions(champions: ChampionData[], opts: ChampionFilterOptions = {}): ChampionData[] {
  const q = normalizeSearch(opts.query || '');
  const queryOverridesRole = opts.queryOverridesRole ?? true;

  return champions
    .filter((c) => {
      if (opts.onlyIds && !opts.onlyIds.has(c.id)) return false;
      if (q && !normalizeSearch(c.name).includes(q) && !normalizeSearch(c.id).includes(q)) return false;
      if (opts.role && opts.role !== 'ALL' && !(q && queryOverridesRole)) {
        if (!championMatchesRole(c, opts.role, opts.roleOverrides)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (q) {
        // Resultados que começam com o termo aparecem primeiro
        const aStarts = normalizeSearch(a.name).startsWith(q) ? 0 : 1;
        const bStarts = normalizeSearch(b.name).startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
      }
      return a.name.localeCompare(b.name, 'pt-BR');
    });
}
