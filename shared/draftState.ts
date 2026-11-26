import { ROLES, type DraftState, type DraftTeamSlots, type LiveMatchSituation, type Role } from './types.ts';

export type DraftSide = 'ally' | 'enemy';

export function createEmptyTeam(): DraftTeamSlots {
  return { TOP: null, JUNGLE: null, MID: null, ADC: null, SUPPORT: null };
}

/** Situação de partida neutra: nada preenchido até o usuário informar. */
export function createDefaultLiveSituation(): LiveMatchSituation {
  return {
    enabled: false,
    minute: 15,
    availableGold: 0,
    purchasedItemIds: [],
    laneOutcome: 'even',
    gameState: 'even',
    fedEnemyId: null,
    carryingAllyId: null,
  };
}

/** Estado inicial do aplicativo: dez posições vazias e nenhum campeão controlado. */
export function createEmptyDraftState(): DraftState {
  return {
    allyTeam: createEmptyTeam(),
    enemyTeam: createEmptyTeam(),
    userRole: null,
    userChampionId: null,
    liveSituation: createDefaultLiveSituation(),
  };
}

export function countPicks(draft: DraftState): { ally: number; enemy: number; total: number } {
  const ally = ROLES.filter((r) => draft.allyTeam[r]).length;
  const enemy = ROLES.filter((r) => draft.enemyTeam[r]).length;
  return { ally, enemy, total: ally + enemy };
}

export function findChampionUsage(draft: DraftState): Map<string, { team: DraftSide; role: Role }> {
  const usage = new Map<string, { team: DraftSide; role: Role }>();
  for (const role of ROLES) {
    const a = draft.allyTeam[role];
    const e = draft.enemyTeam[role];
    if (a) usage.set(a, { team: 'ally', role });
    if (e) usage.set(e, { team: 'enemy', role });
  }
  return usage;
}

function sanitizeLive(live: LiveMatchSituation, ally: DraftTeamSlots, enemy: DraftTeamSlots): LiveMatchSituation {
  const allyIds = new Set(Object.values(ally).filter(Boolean));
  const enemyIds = new Set(Object.values(enemy).filter(Boolean));
  return {
    ...live,
    fedEnemyId: live.fedEnemyId && enemyIds.has(live.fedEnemyId) ? live.fedEnemyId : null,
    carryingAllyId: live.carryingAllyId && allyIds.has(live.carryingAllyId) ? live.carryingAllyId : null,
  };
}

/**
 * Coloca (ou remove, com `championId = null`) um campeão em uma posição.
 * Um campeão só pode ocupar uma posição entre as dez: se já estiver em outra, é movido.
 * `controlled: true` marca a posição aliada como a do usuário; `false` desmarca se era a dele.
 */
export function assignChampion(
  prev: DraftState,
  team: DraftSide,
  role: Role,
  championId: string | null,
  opts?: { controlled?: boolean },
): DraftState {
  const allyTeam = { ...prev.allyTeam };
  const enemyTeam = { ...prev.enemyTeam };

  if (championId) {
    for (const r of ROLES) {
      if (allyTeam[r] === championId) allyTeam[r] = null;
      if (enemyTeam[r] === championId) enemyTeam[r] = null;
    }
  }
  if (team === 'ally') allyTeam[role] = championId;
  else enemyTeam[role] = championId;

  let userRole = prev.userRole;
  if (team === 'ally' && opts?.controlled === true) userRole = role;
  if (team === 'ally' && opts?.controlled === false && userRole === role) userRole = null;

  return {
    ...prev,
    allyTeam,
    enemyTeam,
    userRole,
    userChampionId: userRole ? allyTeam[userRole] : null,
    liveSituation: sanitizeLive(prev.liveSituation, allyTeam, enemyTeam),
  };
}

/** Define explicitamente qual posição aliada o usuário controla (opcionalmente já com o campeão). */
export function setControlledRole(prev: DraftState, role: Role, championId?: string | null): DraftState {
  const base = championId !== undefined ? assignChampion(prev, 'ally', role, championId) : prev;
  return { ...base, userRole: role, userChampionId: base.allyTeam[role] };
}

/** Carrega uma composição completa (cenário de demonstração ou histórico) somente por ação do usuário. */
export function applyComposition(
  composition: { allyTeam: DraftTeamSlots; enemyTeam: DraftTeamSlots; userRole: Role | null; userChampionId: string | null },
): DraftState {
  const allyTeam = { ...composition.allyTeam };
  const enemyTeam = { ...composition.enemyTeam };
  const userRole = composition.userRole;
  return {
    allyTeam,
    enemyTeam,
    userRole,
    userChampionId: userRole ? allyTeam[userRole] ?? composition.userChampionId : null,
    liveSituation: createDefaultLiveSituation(),
  };
}
