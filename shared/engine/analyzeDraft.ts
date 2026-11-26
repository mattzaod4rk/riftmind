import type {
  ChampionData,
  DataGovernanceReport,
  DraftState,
  FullDraftAnalysis,
  ItemData,
  RuneTree,
  StatShard,
  SummonerSpellData,
} from '../types.ts';
import { profileChampion } from './championProfiler.ts';
import {
  evaluateTeamMetrics,
  generateCompositionInsightsAndWinConditions,
  getTeamProfiles,
} from './compositionEngine.ts';
import { generateBuildRecommendation } from './buildEngine.ts';
import { generateRuneRecommendation } from './runeEngine.ts';
import { generateMatchupAndStrategy } from './matchupAndStrategyEngine.ts';
import { validateAndSanitizeAnalysis } from './textValidator.ts';

export interface StaticGameCatalog {
  champions: ChampionData[];
  items: ItemData[];
  runeTrees: RuneTree[];
  statShards: StatShard[];
  summoners: SummonerSpellData[];
  governance: DataGovernanceReport;
}

/**
 * Gera a análise completa e valida todos os textos produzidos antes de retorná-los.
 * Retorna `null` enquanto o usuário não tiver escolhido sua posição e o campeão controlado.
 */
export function analyzeFullDraft(draft: DraftState, catalog: StaticGameCatalog): FullDraftAnalysis | null {
  const userRole = draft.userRole;
  if (!userRole) return null;

  const champMap = new Map(catalog.champions.map((c) => [c.id, c]));
  const itemMap = new Map(catalog.items.map((i) => [i.id, i]));

  const effectiveUserChampId = draft.allyTeam[userRole] || draft.userChampionId;
  if (!effectiveUserChampId) return null;

  const userChampion = champMap.get(effectiveUserChampId);
  if (!userChampion) return null;

  const normalizedAllySlots = { ...draft.allyTeam, [userRole]: effectiveUserChampId };

  const userProfile = profileChampion(userChampion, userRole);
  const allyMembers = getTeamProfiles(normalizedAllySlots, champMap);
  const enemyMembers = getTeamProfiles(draft.enemyTeam, champMap);

  const allyMetrics = evaluateTeamMetrics(allyMembers);
  const enemyMetrics = evaluateTeamMetrics(enemyMembers);

  const { allyWinConditions, enemyWinConditions, insights } = generateCompositionInsightsAndWinConditions(
    allyMembers,
    enemyMembers,
    allyMetrics,
    enemyMetrics,
    userProfile,
    userRole,
  );

  const build = generateBuildRecommendation(catalog.items, {
    userProfile,
    userRole,
    allyMembers,
    enemyMembers,
    allyMetrics,
    enemyMetrics,
    liveSituation: draft.liveSituation,
    itemMap,
  });

  const runes = generateRuneRecommendation(catalog.runeTrees, catalog.statShards, catalog.summoners, {
    userProfile,
    userRole,
    allyMembers,
    enemyMembers,
    allyMetrics,
    enemyMetrics,
  });

  const { matchups, strategy } = generateMatchupAndStrategy({
    userProfile,
    userRole,
    allyMembers,
    enemyMembers,
    allyMetrics,
    enemyMetrics,
    recommendedItems: build.slots.map((s) => s.item),
    situationalItems: build.situationalItems.map((s) => s.item),
  });

  const rawAnalysis: FullDraftAnalysis = {
    generatedAt: new Date().toISOString(),
    userChampion,
    userRole,
    governance: catalog.governance,
    allyMetrics,
    enemyMetrics,
    allyWinConditions,
    enemyWinConditions,
    insights,
    build,
    runes,
    matchups,
    strategy,
  };

  return validateAndSanitizeAnalysis(rawAnalysis, allyMembers, enemyMembers, catalog.champions);
}
