export type Role = 'TOP' | 'JUNGLE' | 'MID' | 'ADC' | 'SUPPORT';

export const ROLES: Role[] = ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'];

export const ROLE_LABELS: Record<Role, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MID: 'Mid',
  ADC: 'ADC',
  SUPPORT: 'Suporte',
};

export interface ChampionSpell {
  id: string;
  keySlot: 'Q' | 'W' | 'E' | 'R';
  name: string;
  description: string;
  cleanDescription: string;
  tooltip: string;
  cooldownBurn: string;
  costBurn: string;
  rangeBurn: string;
  imageFull: string;
  detectedCC: string[];
  hasHeal: boolean;
  hasShield: boolean;
  hasDash: boolean;
  damageTypes: ('physical' | 'magic' | 'true')[];
}

export interface ChampionPassive {
  name: string;
  description: string;
  cleanDescription: string;
  imageFull: string;
}

export interface ChampionStats {
  hp: number;
  hpperlevel: number;
  mp: number;
  mpperlevel: number;
  movespeed: number;
  armor: number;
  armorperlevel: number;
  spellblock: number;
  spellblockperlevel: number;
  attackrange: number;
  attackdamage: number;
  attackdamageperlevel: number;
  attackspeed: number;
  attackspeedperlevel: number;
}

export interface ChampionData {
  id: string; // e.g., "Nami", "MasterYi", "MonkeyKing"
  key: string; // numeric string e.g. "267"
  name: string; // pt_BR name e.g. "Nami", "Master Yi", "Wukong"
  title: string;
  blurb: string;
  tags: string[]; // Fighter, Tank, Mage, Assassin, Marksman, Support
  partype: string; // Mana, Energia, Nenhum, Fúria, etc.
  info: {
    attack: number;
    defense: number;
    magic: number;
    difficulty: number;
  };
  stats: ChampionStats;
  imageFull: string;
  passive: ChampionPassive;
  spells: ChampionSpell[];
  allytips: string[];
  enemytips: string[];
}

export type ItemCategory =
  | 'starter'
  | 'support_quest'
  | 'jungle_pet'
  | 'boots_t1'
  | 'boots_t2'
  | 'boots_t3'
  | 'completed'
  | 'component'
  | 'consumable'
  | 'trinket'
  | 'other';

export interface ParsedItemFeatures {
  ap: number;
  ad: number;
  attackSpeedPct: number;
  critPct: number;
  lethality: number;
  armorPenPct: number;
  magicPenFlat: number;
  magicPenPct: number;
  health: number;
  armor: number;
  magicResist: number;
  abilityHaste: number;
  mana: number;
  manaRegenPct: number;
  healthRegenPct: number;
  healShieldPowerPct: number;
  lifeStealPct: number;
  omnivampPct: number;
  moveSpeedFlat: number;
  moveSpeedPct: number;
  tenacityPct: number;
  grievousWounds: boolean;
  antiShield: boolean;
  maxHpDamage: boolean;
  onHit: boolean;
  hasActive: boolean;
  hasShield: boolean;
  hasHeal: boolean;
  spellblade: boolean;
  qssCleanse: boolean;
  stasis: boolean;
  spellshield: boolean;
  critAmplifier: boolean;
  allyBuffAP: boolean;
  allyBuffAS: boolean;
  knightRedirect: boolean;
  aoeShieldActive: boolean;
  aoeHealActive: boolean;
  teamSpeedActive: boolean;
  rangedOnly: boolean;
  meleeOnly: boolean;
  uniqueGroups: string[];
  statLines: string[];
  passiveBlocks: { name: string; text: string; isActive: boolean }[];
}

export interface ItemData {
  id: string;
  name: string;
  plaintext: string;
  description: string;
  cleanDescription: string;
  imageFull: string;
  goldTotal: number;
  goldBase: number;
  goldSell: number;
  purchasable: boolean;
  from: string[];
  into: string[];
  tags: string[];
  depth: number;
  srValid: boolean;
  category: ItemCategory;
  features: ParsedItemFeatures;
}

export interface RuneEntry {
  id: number;
  key: string;
  icon: string;
  name: string;
  shortDesc: string;
  longDesc: string;
  cleanDesc: string;
}

export interface RuneTree {
  id: number;
  key: string;
  icon: string;
  name: string;
  slots: { runes: RuneEntry[] }[];
}

export interface StatShard {
  id: string;
  row: 0 | 1 | 2;
  name: string;
  description: string;
  iconUrl: string;
}

export interface SummonerSpellData {
  id: string;
  key: string;
  name: string;
  description: string;
  cooldownBurn: string;
  imageFull: string;
  modes: string[];
}

export interface ChampionPoolEntry {
  championId: string;
  roles: Role[];
  isFavorite: boolean;
  isMain: boolean;
  familiarity: 1 | 2 | 3 | 4 | 5;
  notes: string;
  updatedAt: string;
}

export interface UserPreferences {
  preferredRoles: Role[];
  autoCheckPatch: boolean;
  knownClientPatch: string;
}

export type DraftTeamSlots = Record<Role, string | null>;

export interface LiveMatchSituation {
  enabled: boolean;
  minute: number;
  availableGold: number;
  purchasedItemIds: string[];
  laneOutcome: 'winning' | 'even' | 'losing';
  gameState: 'ahead' | 'even' | 'behind';
  fedEnemyId: string | null;
  carryingAllyId: string | null;
}

export interface DraftState {
  allyTeam: DraftTeamSlots;
  enemyTeam: DraftTeamSlots;
  /** Posição controlada pelo usuário. `null` até o usuário escolher explicitamente. */
  userRole: Role | null;
  userChampionId: string | null;
  liveSituation: LiveMatchSituation;
}

export interface TeamCompositionMetrics {
  championCount: number;
  damageShare: {
    physical: number; // 0-100%
    magic: number; // 0-100%
    trueDamage: number; // 0-100%
  };
  scores: {
    physicalDamage: number;
    magicDamage: number;
    trueDamage: number;
    hardCC: number;
    softCC: number;
    engage: number;
    disengage: number;
    initiation: number;
    peel: number;
    poke: number;
    burst: number;
    sustain: number;
    frontline: number;
    mobility: number;
    chase: number;
    pickoff: number;
    scaling: number;
    siege: number;
    antiTank: number;
    assassinVulnerability: number;
    diveResistance: number;
  };
  archetypeSummary: string[];
  keyContributors: Record<string, string[]>;
}

export interface CompositionInsight {
  type: 'strength' | 'warning' | 'threat' | 'win_condition' | 'synergy';
  team: 'ally' | 'enemy' | 'matchup';
  title: string;
  description: string;
  relatedChampionIds: string[];
}

export interface ItemComponentNode {
  id: string;
  name: string;
  goldTotal: number;
  goldBase: number;
  imageFull: string;
  owned?: boolean;
  children: ItemComponentNode[];
}

export interface RecommendedBuildSlot {
  slotKey:
    | 'starter'
    | 'support_item'
    | 'boots'
    | 'item1'
    | 'item2'
    | 'item3'
    | 'item4'
    | 'item5'
    | 'item6';
  slotLabel: string;
  orderIndex: number;
  item: ItemData;
  componentTree: ItemComponentNode;
  score: number;
  reason: string; // MOTIVO
  benefit: string; // BENEFÍCIO
  whenToBuy: string; // QUANDO COMPRAR
  alternative?: {
    item: ItemData;
    whenToPrefer: string;
    pros: string;
    cons: string;
  };
  tier3BootUpgrade?: ItemData;
}

export interface SituationalItemRecommendation {
  conditionCategory: string;
  relevanceScore: number; // higher if active in current draft
  isTriggeredByCurrentDraft: boolean;
  item: ItemData;
  whenToBuy: string;
  whyBuy: string;
  whenToAvoid: string;
  uniqueGroupConflict?: string;
}

export interface LiveSituationRecalculation {
  bestNextCompletedItem: ItemData | null;
  remainingCostForNextItem: number;
  bestImmediateBuyComponents: {
    items: ItemData[];
    totalSpend: number;
    goldLeft: number;
    explanation: string;
  };
  alternativeImmediateBuys: {
    item: ItemData;
    cost: number;
    reason: string;
  }[];
  postponedItems: {
    item: ItemData;
    reason: string;
  }[];
  tacticalAdjustments: string[];
}

export interface BuildRecommendationResult {
  slots: RecommendedBuildSlot[];
  situationalItems: SituationalItemRecommendation[];
  uniquePassiveNotes: string[];
  buildIdentitySummary: string;
  liveRecalculation?: LiveSituationRecalculation;
}

export interface RunePageConfig {
  title: string;
  postureLabel: string;
  primaryTree: RuneTree;
  keystone: RuneEntry;
  primaryRunes: [RuneEntry, RuneEntry, RuneEntry];
  secondaryTree: RuneTree;
  secondaryRunes: [RuneEntry, RuneEntry];
  statShards: [StatShard, StatShard, StatShard];
  summonerSpells: [SummonerSpellData, SummonerSpellData];
  overallReasoning: string;
  choiceExplanations: {
    label: string;
    name: string;
    icon: string;
    reason: string;
  }[];
}

export interface RuneRecommendationResult {
  recommended: RunePageConfig;
  alternative: RunePageConfig;
  comparisonSummary: string;
}

export interface EnemyThreatDetail {
  champion: ChampionData;
  role: Role;
  threatLevel: 'CRÍTICO' | 'ALTO' | 'MODERADO' | 'CONTROLÁVEL';
  threatScore: number;
  isDirectLaneOpponent: boolean;
  summary: string;
  dangerousSpells: {
    keySlot: 'P' | 'Q' | 'W' | 'E' | 'R';
    name: string;
    imageFull: string;
    isPassive?: boolean;
    cooldown: string;
    whyDangerous: string;
  }[];
  canInterruptYou: boolean;
  interruptionDetail?: string;
  youHaveAdvantage: boolean;
  advantageDetail?: string;
  counterItems: ItemData[];
}

export interface AllySynergyDetail {
  champion: ChampionData;
  role: Role;
  synergyScore: number;
  synergyLevel: 'FORTE' | 'BOA' | 'PADRÃO';
  comboExplanation: string;
  keyAllySpells: {
    keySlot: 'Q' | 'W' | 'E' | 'R';
    name: string;
    imageFull: string;
  }[];
}

export interface MatchupAnalysisResult {
  laneMatchupSummary: {
    title: string;
    lanePosture: string;
    directOpponents: ChampionData[];
    keyTradingRules: string[];
    levelPowerSpikes: string;
  };
  enemyThreats: EnemyThreatDetail[];
  interrupters: { championName: string; detail: string }[];
  favorableTargets: { championName: string; detail: string }[];
  allySynergies: AllySynergyDetail[];
}

export interface StrategyGuideResult {
  allyToPrioritize: { championName: string; role: Role; reason: string };
  biggestEnemyThreat: { championName: string; role: Role; reason: string };
  whoToProtectInTeamfights: { targetName: string; reason: string };
  enemyAbilitiesToTrack: { championName: string; spellKey: string; spellName: string; imageFull: string; instruction: string }[];
  ownAbilitiesToHold: { spellKey: string; spellName: string; imageFull: string; instruction: string }[];
  recommendedPosture: { mode: 'AGRESSIVA' | 'CONTROLADA / TRANSIÇÃO' | 'DEFENSIVA / ANTI-DIVE' | 'POKE E CERCO'; explanation: string };
  teamWinCondition: string;
  positioningGuide: string;
  whatToAvoid: string[];
  roleSpecificPlaybook: {
    roleTitle: string;
    directives: { topic: string; guidance: string }[];
  };
}

export interface DataGovernanceReport {
  officialDdragon: {
    activePatch: string;
    latestRemotePatch: string | null;
    isOutdatedVsRemote: boolean;
    isOutdatedVsClientPatch: boolean;
    configuredClientPatch: string;
    lastSyncedAt: string | null;
    championsLoaded: number;
    srItemsLoaded: number;
    runeTreesLoaded: number;
  };
  externalStats: {
    connected: boolean;
    sourceName: string | null;
    patch: string | null;
    region: string | null;
    elo: string | null;
    sampleSize: number | null;
    disclaimer: string;
  };
  strategicEngine: {
    engineVersion: string;
    mode: string;
    explanation: string;
  };
}

export interface FullDraftAnalysis {
  generatedAt: string;
  userChampion: ChampionData;
  userRole: Role;
  governance: DataGovernanceReport;
  allyMetrics: TeamCompositionMetrics;
  enemyMetrics: TeamCompositionMetrics;
  allyWinConditions: string[];
  enemyWinConditions: string[];
  insights: CompositionInsight[];
  build: BuildRecommendationResult;
  runes: RuneRecommendationResult;
  matchups: MatchupAnalysisResult;
  strategy: StrategyGuideResult;
}

export interface SavedDraftHistoryEntry {
  id: string;
  title: string;
  notes: string;
  patchVersion: string;
  userRole: Role;
  userChampionId: string;
  allyTeam: DraftTeamSlots;
  enemyTeam: DraftTeamSlots;
  summaryVerdict: string;
  createdAt: string;
}

export interface NetworkConnectionLog {
  id: number;
  timestamp: string;
  method: string;
  url: string;
  domain: string;
  purpose: string;
  status: number;
  durationMs: number;
}
