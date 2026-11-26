import type {
  BuildRecommendationResult,
  ItemComponentNode,
  ItemData,
  LiveMatchSituation,
  LiveSituationRecalculation,
  RecommendedBuildSlot,
  Role,
  SituationalItemRecommendation,
  TeamCompositionMetrics,
} from '../types.ts';
import type { ChampionTacticalProfile } from './championProfiler.ts';
import type { ProfiledTeamMember } from './compositionEngine.ts';
import { formatNameList } from './textValidator.ts';

const BOOTS_T2_TO_T3: Record<string, string> = {
  '3006': '3172',
  '3008': '3168',
  '3009': '3170',
  '3020': '3175',
  '3047': '3174',
  '3111': '3173',
  '3158': '3171',
};

export function buildComponentTree(
  item: ItemData,
  itemMap: Map<string, ItemData>,
  ownedPool: string[] = [],
  depth = 0,
): ItemComponentNode {
  if (depth > 4) {
    return {
      id: item.id,
      name: item.name,
      goldTotal: item.goldTotal,
      goldBase: item.goldBase,
      imageFull: item.imageFull,
      children: [],
    };
  }
  const ownedIdx = ownedPool.indexOf(item.id);
  let owned = false;
  if (ownedIdx !== -1) {
    owned = true;
    ownedPool.splice(ownedIdx, 1);
  }
  const children: ItemComponentNode[] = [];
  if (!owned) {
    for (const childId of item.from) {
      const child = itemMap.get(childId);
      if (child) {
        children.push(buildComponentTree(child, itemMap, ownedPool, depth + 1));
      }
    }
  }
  return {
    id: item.id,
    name: item.name,
    goldTotal: item.goldTotal,
    goldBase: item.goldBase,
    imageFull: item.imageFull,
    owned,
    children,
  };
}

interface DraftBuildContext {
  userProfile: ChampionTacticalProfile;
  userRole: Role;
  allyMembers: ProfiledTeamMember[];
  enemyMembers: ProfiledTeamMember[];
  allyMetrics: TeamCompositionMetrics;
  enemyMetrics: TeamCompositionMetrics;
  liveSituation: LiveMatchSituation;
  itemMap: Map<string, ItemData>;
}

function isItemCompatibleWithChampion(item: ItemData, ctx: DraftBuildContext): boolean {
  const { userProfile, userRole } = ctx;
  const f = item.features;

  if (!item.srValid) return false;
  if (f.rangedOnly && !userProfile.isRanged) return false;
  if (f.meleeOnly && userProfile.isRanged) return false;

  // Support quest items exclusively for SUPPORT
  if (item.category === 'support_quest' || item.id === '3865') {
    return userRole === 'SUPPORT';
  }
  // Jungle pets exclusively for JUNGLE
  if (item.category === 'jungle_pet') {
    return userRole === 'JUNGLE';
  }
  // Cassiopeia cannot buy boots
  if (userProfile.champion.id === 'Cassiopeia' && f.uniqueGroups.includes('BOOTS')) {
    return false;
  }
  if (userProfile.champion.id === 'Cassiopeia' && item.tags.includes('Boots')) {
    return false;
  }

  // Manaless champions should never buy Tear or heavy Mana-regen/Mana-scaling items
  if (!userProfile.usesMana) {
    if (f.uniqueGroups.includes('TEAR_AWE') || f.mana >= 300 || f.manaRegenPct >= 75) {
      return false;
    }
  }

  // Enchanter heal/shield items only make sense on champions with heal/shield/enchanter kit or support utility
  const isPureEnchanterItem =
    f.healShieldPowerPct > 0 || ['3504', '6616', '6617', '6620', '6621', '3222'].includes(item.id);
  const canUseEnchanterItems =
    userProfile.archetype === 'enchanter' ||
    (userRole === 'SUPPORT' &&
      (userProfile.champion.spells.some((s) => s.hasHeal || s.hasShield) ||
        ['warden', 'catcher'].includes(userProfile.archetype)));
  if (isPureEnchanterItem && !canUseEnchanterItems) {
    return false;
  }

  // Pure AP items on 0-AP physical champions (like Zed, Garen, Darius, Jhin, Caitlyn, Talon)
  if (f.ap >= 45 && f.ad === 0 && f.armor === 0 && f.magicResist === 0 && userProfile.affinities.ap <= 0.3) {
    return false;
  }

  // Pure AD/Crit/Lethality items on pure Mages/Enchanters/AP Tanks
  if (
    (f.ad >= 25 || f.lethality > 0 || f.critPct > 0) &&
    f.ap === 0 &&
    userProfile.affinities.ad <= 0.3 &&
    userProfile.affinities.attackSpeed <= 0.3
  ) {
    return false;
  }

  return true;
}

interface ScoredItemCandidate {
  item: ItemData;
  score: number;
  reasons: string[];
  benefits: string[];
}

function scoreCompletedItem(item: ItemData, ctx: DraftBuildContext): ScoredItemCandidate {
  const { userProfile, userRole, allyMembers, enemyMembers, allyMetrics, enemyMetrics, liveSituation } = ctx;
  const f = item.features;
  const aff = userProfile.affinities;
  const eS = enemyMetrics.scores;

  let score = 0;
  const reasons: string[] = [];
  const benefits: string[] = [];

  // 1. Base stat scaling match with champion affinities
  score += (f.ap / 80) * aff.ap * 18;
  score += (f.ad / 55) * aff.ad * 18;
  score += (f.critPct / 25) * aff.crit * 20;
  score += (f.attackSpeedPct / 35) * aff.attackSpeed * 16;
  score += (f.lethality / 18) * aff.lethality * 20;
  score += (f.armorPenPct / 30) * aff.armorPen * 16;
  score += ((f.magicPenFlat / 15) * 0.7 + (f.magicPenPct / 35) * 1.1) * aff.magicPen * 16;
  score += (f.healShieldPowerPct / 10) * aff.healShield * 22;
  score += (f.abilityHaste / 20) * aff.abilityHaste * 12;
  score += (f.health / 400) * aff.health * 14;
  score += (f.armor / 55) * aff.armor * 14;
  score += (f.magicResist / 50) * aff.magicResist * 14;
  score += ((f.lifeStealPct + f.omnivampPct) / 10) * aff.lifeStealOmnivamp * 14;

  if (f.onHit && aff.onHit > 0) {
    score += aff.onHit * 18;
    benefits.push('Amplifica cada ataque básico com efeitos ao contato');
  }
  if (f.mana > 0 && aff.mana > 0) {
    score += Math.min(18, (f.mana / 500) * aff.mana * 10);
  }
  if (f.manaRegenPct > 0 && aff.healShield > 1.5) {
    score += Math.min(20, (f.manaRegenPct / 100) * 14);
  }
  if (f.uniqueGroups.includes('TEAR_AWE')) {
    if (aff.tearUser) {
      score += 36;
      reasons.push(`${userProfile.champion.name} consome Mana continuamente e escala fortemente com o acúmulo da Lágrima`);
      benefits.push('Reserva ampla de Mana + escudo/escalamento de fim de jogo');
    } else {
      score -= 28;
    }
  }
  if (f.spellblade) {
    if (aff.spellbladeUser) {
      score += 32;
      reasons.push(`Intercala habilidades e ataques básicos com alta frequência de Lâmina Arcana`);
    } else if (aff.healShield > 1.5 || ['artillery_mage', 'burst_mage', 'crit_marksman'].includes(userProfile.archetype)) {
      score -= 22;
    }
  }

  // Economy / Support budget awareness
  if (userRole === 'SUPPORT') {
    if (item.goldTotal <= 2400) score += 26;
    else if (item.goldTotal >= 2900) score -= 24;
  }

  // 2. Ally composition synergies
  const apCarries = allyMembers.filter(
    (m) =>
      m.profile.champion.id !== userProfile.champion.id &&
      m.profile.damageMix.magic >= 0.65 &&
      m.role !== 'SUPPORT',
  );
  const asCarries = allyMembers.filter(
    (m) =>
      m.profile.champion.id !== userProfile.champion.id &&
      (m.profile.affinities.attackSpeed >= 2.0 || m.profile.archetype === 'skirmisher' || m.profile.archetype === 'crit_marksman' || m.profile.archetype === 'onhit_marksman'),
  );
  const pokeOrCCFollowAllies = allyMembers.filter(
    (m) => m.profile.champion.id !== userProfile.champion.id && (m.profile.ratings.poke >= 6 || m.profile.ratings.pickoff >= 6),
  );

  // Imperial Mandate (4005) — huge synergy for CC/slow enchanters like Nami, Janna, Karma, Maokai
  if (item.id === '4005' && userRole === 'SUPPORT' && (userProfile.ratings.softCC >= 2 || userProfile.ratings.hardCC >= 4)) {
    score += 38;
    const followNames = formatNameList(
      allyMembers
        .filter((m) => m.profile.champion.id !== userProfile.champion.id)
        .slice(0, 2)
        .map((m) => m.profile.champion.name),
      'e',
      [userProfile.champion.name],
    );
    reasons.push(
      `Suas lentidões e controles marcam os alvos para detonação imediata de ${followNames || 'seus aliados'} com dano baseado na Vida atual`,
    );
    benefits.push('Pico de pressão explosiva em trocas 2v2 e escaramuças contra alvos de alta Vida');
  }

  // Moonstone Renewer (6617) & Echoes of Helia (6620) & Dawncore (6621)
  if (item.id === '6617' && userProfile.archetype === 'enchanter') {
    score += 36;
    reasons.push('Multiplica curas e escudos encadeados durante lutas prolongadas da sua composição');
    benefits.push('Propagação contínua de cura/escudo para o aliado próximo mais ferido');
  }
  if (item.id === '6620' && userProfile.archetype === 'enchanter' && userProfile.ratings.poke >= 5) {
    score += 24;
    reasons.push(`Converte trocas ofensivas de ${userProfile.champion.name} em cura adicional e dano nos confrontos de rota`);
  }

  // Staff of Flowing Water (6616) when Ally has strong AP carry (e.g., Cassiopeia!)
  if (f.allyBuffAP && apCarries.length > 0 && aff.healShield >= 2) {
    const names = formatNameList(
      apCarries.map((m) => m.profile.champion.name),
      'e',
      [userProfile.champion.name],
    );
    score += 26 + apCarries.length * 8;
    reasons.push(`Potencializa diretamente o Poder de Habilidade de ${names} sempre que você curar ou proteger`);
    benefits.push('Concede Poder de Habilidade adicional para você e para os carregadores AP aliados');
  }

  // Ardent Censer (3504) when Ally has Attack Speed / On-Hit carries (e.g., Master Yi, Jinx, Vayne!)
  if (f.allyBuffAS && asCarries.length > 0 && aff.healShield >= 2) {
    const names = formatNameList(
      asCarries.map((m) => m.profile.champion.name),
      'e',
      [userProfile.champion.name],
    );
    score += 24 + asCarries.length * 8;
    reasons.push(`Acelera os ataques básicos e o dano ao contato de ${names}`);
    benefits.push('Velocidade de Ataque e dano mágico ao contato em cada cura/escudo');
  }

  // Shurelya's Battlesong (2065) when Ally lacks hard initiation or has immobile juggernauts/skirmishers (e.g., Garen, Master Yi, Cassiopeia, Jhin!)
  if (f.teamSpeedActive && userRole === 'SUPPORT') {
    const needsEngageSpeed = allyMetrics.scores.engage < 55 || pokeOrCCFollowAllies.length > 0;
    if (needsEngageSpeed) {
      score += 28;
      reasons.push(
        'Sua equipe se beneficia enormemente de explosão coletiva de Velocidade de Movimento para iniciar, reposicionar ou escapar de poke',
      );
      benefits.push('Ativo de aceleração em área para engajar ou recuar da pressão inimiga');
    }
  }

  // 3. Enemy threats & counter-itemization
  const enemyAssassins = enemyMembers.filter((m) =>
    ['ad_assassin', 'ap_assassin', 'diver'].includes(m.profile.archetype),
  );
  const enemyTanks = enemyMembers.filter((m) => m.profile.ratings.tankiness >= 7.0);
  const enemyHealers = enemyMembers.filter((m) => m.profile.ratings.sustainHealShield >= 6.5);
  const enemyHardCCChamps = enemyMembers.filter((m) => m.profile.ratings.hardCC >= 6.0);

  // Locket of the Iron Solari (3190) against Assassins / Burst (e.g., Zed + Lux!)
  if (f.aoeShieldActive && userRole === 'SUPPORT') {
    if (enemyAssassins.length > 0 || eS.burst >= 62) {
      const burstNames = formatNameList(
        enemyMembers
          .filter((m) => m.profile.ratings.burst >= 6.5)
          .map((m) => m.profile.champion.name),
      );
      score += 36;
      reasons.push(
        `O adversário possui alto potencial de explosão (${burstNames || 'burst inimigo'}) contra sua retaguarda vulnerável`,
      );
      benefits.push('Escudo instantâneo em área + Armadura e Resistência Mágica para sobreviver ao all-in');
    }
  }

  // Redemption (3107) against Poke/Siege & Teamfight AoE (e.g., Caitlyn + Lux + Ornn!)
  if (f.aoeHealActive && userRole === 'SUPPORT') {
    score += 30 + (eS.poke >= 55 || enemyTanks.length > 0 ? 12 : 0);
    reasons.push(
      'Neutraliza desgaste de alcance/poke antes de objetivos e vira lutas de equipe mesmo à distância, além de causar 10% da Vida máxima em Dano Verdadeiro na frontline inimiga',
    );
    benefits.push('Cura coletiva em grande área + dano verdadeiro percentual em tanques');
  }

  // Mikael's Blessing (3222) against pickoff roots/stuns (e.g., Lux Q, Ivern Q, Ornn CC, Caitlyn W!)
  if (item.id === '3222' && userRole === 'SUPPORT' && (eS.hardCC >= 52 || enemyHardCCChamps.length > 0)) {
    const ccNames = formatNameList(enemyHardCCChamps.map((m) => m.profile.champion.name));
    score += 35;
    reasons.push(
      `Remove instantaneamente enraizamentos e atordoamentos fatais (${ccNames || 'CC inimigo'}) que prenderiam seu ADC ou hipercarregador`,
    );
    benefits.push('Purificação ativa imediata + cura no aliado focado');
  }

  // Knight's Vow (3109) / Zeke's (3050) for Tank/Warden supports or peeling fed carry
  if (f.knightRedirect && userRole === 'SUPPORT') {
    if (['vanguard', 'warden', 'catcher'].includes(userProfile.archetype) || enemyAssassins.some((a) => a.profile.damageMix.physical >= 0.7)) {
      score += userProfile.archetype === 'enchanter' ? 16 : 34;
      reasons.push('Redireciona parte do dano recebido pelo seu carregador principal e aumenta sua Armadura contra assassinos físicos');
      benefits.push('Mitigação direta de dano sobre o aliado vinculado');
    }
  }

  // Anti-Burst for Carries / Mages / Fighters (Zhonya 3157, GA 3026, Shieldbow 6673, Sterak 3053, Death's Dance 6333, Edge of Night 3814, Banshee 3102)
  if (f.stasis && aff.ap >= 1.5 && (enemyAssassins.length > 0 || eS.burst >= 60)) {
    const assNames = formatNameList(enemyAssassins.map((m) => m.profile.champion.name));
    score += 32;
    reasons.push(`A Estase anula completamente a janela de execução de ${assNames || 'assassinos e burst inimigo'}`);
    benefits.push('2,5s de invulnerabilidade + Armadura e alto Poder de Habilidade');
  }
  if (item.id === '3026' && aff.ad >= 2.0 && enemyAssassins.some((m) => m.profile.damageMix.physical >= 0.6)) {
    score += 24;
    reasons.push('Impede que um mergulho explosivo de assassino AD encerre sua participação na luta');
    benefits.push('Ressurreição tática + Armadura e Dano de Ataque');
  }
  if (f.uniqueGroups.includes('LIFELINE') && (eS.burst >= 60 || enemyAssassins.length > 0)) {
    if ((f.critPct > 0 && aff.crit >= 2) || (f.health > 0 && aff.health >= 1.5) || (f.magicResist > 0 && enemyMetrics.damageShare.magic >= 55 && aff.ad >= 2)) {
      score += 24;
      reasons.push('Escudo Salva-Vidas absorve o pico de dano explosivo inimigo antes da execução');
      benefits.push('Sobrevivência automática sob foco crítico');
    }
  }
  if (f.spellshield && (eS.pickoff >= 55 || eS.hardCC >= 58)) {
    if ((f.ap > 0 && aff.ap >= 2) || (f.lethality > 0 && aff.lethality >= 2)) {
      score += 24;
      reasons.push('Escudo de Feitiço bloqueia a primeira habilidade de iniciação ou pickoff à distância');
      benefits.push('Proteção contra armadilhas, ganchos e enraizamentos');
    }
  }

  // Anti-Tank (% Pen & Max HP damage) when enemy has frontline tanks like Ornn!
  if (enemyTanks.length > 0 || eS.frontline >= 58) {
    const tankNames = formatNameList(enemyTanks.map((m) => m.profile.champion.name)) || 'a linha de frente inimiga';
    if (f.armorPenPct > 0 && aff.ad >= 1.8) {
      score += 32 + enemyTanks.length * 6;
      reasons.push(`Penetração de Armadura percentual indispensável para atravessar as resistências de ${tankNames}`);
      benefits.push(`${f.armorPenPct}% de Penetração de Armadura escalável no meio/fim de jogo`);
    }
    if (f.magicPenPct > 0 && aff.ap >= 2.0) {
      score += 30 + enemyTanks.length * 6;
      reasons.push(`Ignora a Resistência Mágica acumulada por ${tankNames}`);
      benefits.push(`${f.magicPenPct}% de Penetração Mágica contra alvos resistentes`);
    }
    if (f.maxHpDamage && (aff.onHit >= 1.8 || aff.ap >= 2.0) && !f.aoeHealActive) {
      score += 26;
      reasons.push(`Dano percentual baseado na Vida pune diretamente a reserva de HP de ${tankNames}`);
      benefits.push('Dano contínuo proporcional à Vida do alvo');
    }
  }

  // Anti-Heal (Grievous Wounds) when enemy has strong sustain/healers
  if (f.grievousWounds) {
    if (enemyHealers.length > 0 || eS.sustain >= 62) {
      const healNames = formatNameList(enemyHealers.map((m) => m.profile.champion.name)) || 'a sustentação inimiga';
      score += 24;
      reasons.push(`Aplica Feridas Dolorosas para cortar a regeneração e curas de ${healNames}`);
      benefits.push('Redução de cura em alvos atingidos');
    } else {
      score -= 18; // Do not waste gold on anti-heal when enemy has low healing!
    }
  }

  // Heavy Physical vs Heavy Magic defensive weighting for Tanks/Fighters
  if (aff.armor >= 1.0 && f.armor >= 40) {
    if (enemyMetrics.damageShare.physical >= 62) {
      score += 24;
      reasons.push(`Alta eficiência de Armadura contra ${enemyMetrics.damageShare.physical}% de dano físico adversário`);
    } else if (enemyMetrics.damageShare.magic >= 70 && f.magicResist === 0) {
      score -= 14;
    }
  }
  if (aff.magicResist >= 1.0 && f.magicResist >= 40) {
    if (enemyMetrics.damageShare.magic >= 58) {
      score += 24;
      reasons.push(`Mitiga os ${enemyMetrics.damageShare.magic}% de dano mágico da composição inimiga`);
    } else if (enemyMetrics.damageShare.physical >= 72 && f.armor === 0) {
      score -= 14;
    }
  }

  // Live Match Situation dynamic adjustments!
  if (liveSituation.enabled) {
    if (liveSituation.fedEnemyId) {
      const fedEnemy = enemyMembers.find((m) => m.profile.champion.id === liveSituation.fedEnemyId);
      if (fedEnemy) {
        if (fedEnemy.profile.damageMix.physical >= 0.65 && (f.armor >= 35 || f.aoeShieldActive || f.stasis || f.knightRedirect)) {
          score += 28;
          reasons.push(`Prioridade emergencial para conter ${fedEnemy.profile.champion.name} (adversário mais forte na partida)`);
        }
        if (fedEnemy.profile.damageMix.magic >= 0.65 && (f.magicResist >= 35 || f.aoeShieldActive || f.spellshield || item.id === '3222')) {
          score += 28;
          reasons.push(`Prioridade emergencial para mitigar a pressão mágica de ${fedEnemy.profile.champion.name} (fed)`);
        }
      }
    }
    if (liveSituation.carryingAllyId && userRole === 'SUPPORT') {
      const carryAlly = allyMembers.find((m) => m.profile.champion.id === liveSituation.carryingAllyId);
      if (carryAlly) {
        if (carryAlly.profile.damageMix.magic >= 0.6 && f.allyBuffAP) {
          score += 26;
          reasons.push(`Potencializa diretamente ${carryAlly.profile.champion.name}, que está carregando sua equipe`);
        }
        if ((carryAlly.profile.affinities.attackSpeed >= 1.8 || carryAlly.profile.damageMix.physical >= 0.65) && (f.allyBuffAS || f.knightRedirect || item.id === '3222')) {
          score += 24;
          reasons.push(`Protege e amplifica ${carryAlly.profile.champion.name}, condição de vitória ativa no momento`);
        }
      }
    }
    if (liveSituation.gameState === 'behind' && item.goldTotal >= 3200 && userRole !== 'ADC') {
      score -= 12; // Prefer cheaper defensive/utility spikes when behind
    }
  }

  // Ensure default reason & benefit derived from real item features if none triggered yet
  if (reasons.length === 0) {
    reasons.push(
      `Combina os atributos centrais de ${userProfile.champion.name} (${f.statLines.slice(0, 2).join(', ') || item.plaintext || 'escalamento primário'}) para sustentar seu papel de ${userProfile.archetypeLabel}`,
    );
  }
  if (benefits.length === 0) {
    const firstPassive = f.passiveBlocks[0];
    benefits.push(
      firstPassive
        ? `${firstPassive.name}: ${firstPassive.text.slice(0, 120)}${firstPassive.text.length > 120 ? '...' : ''}`
        : f.statLines.join(' • ') || item.plaintext || 'Pico consistente de atributos para o meio de jogo',
    );
  }

  return { item, score, reasons, benefits };
}

function selectStarterItem(items: ItemData[], ctx: DraftBuildContext): RecommendedBuildSlot | null {
  const { userProfile, userRole, enemyMetrics, itemMap } = ctx;

  let chosenId = '1056';
  let altId = '1054';
  let reason = '';
  let benefit = '';

  if (userRole === 'SUPPORT') {
    chosenId = '3865'; // Atlas Mundial
    reason = 'Item inicial obrigatório de Suporte no Summoner’s Rift para geração de ouro, sentinelas e evolução gratuita da missão.';
    benefit = 'Vida, regeneração, cargas de ouro compartilhado/cutucar e evolução para o item de suporte lendário.';
    altId = '';
  } else if (userRole === 'JUNGLE') {
    if (userProfile.ratings.mobility < 5.5 || userProfile.archetype === 'enchanter') {
      chosenId = '1102'; // Cria de Andabrisas
      altId = '1103';
      reason = 'Concede Velocidade de Movimento adicional nos arbustos e após abater monstros para acelerar ganks e rotações no rio.';
      benefit = 'Mobilidade superior de mapa após concluir a evolução do companheiro.';
    } else if (userProfile.ratings.tankiness >= 6 || enemyMetrics.scores.burst >= 65) {
      chosenId = '1103'; // Broto de Esmagamusgo
      altId = '1101';
      reason = 'Oferece escudo recorrente que protege contra invasões e explosão inimiga durante escaramuças.';
      benefit = 'Escudo persistente fora de combate e ao abater monstros grandes.';
    } else {
      chosenId = '1101'; // Filhote de Garrabrasa
      altId = '1103';
      reason = 'Maximiza seu potencial de duelo e perseguição com queimadura e lentidão adicional ao atingir campeões.';
      benefit = 'Dano verdadeiro/queimadura adicional e lentidão em ganks.';
    }
  } else {
    // TOP / MID / ADC
    const heavyPokeLane = enemyMetrics.scores.poke >= 62 && !userProfile.isRanged;
    if (heavyPokeLane) {
      chosenId = '1054'; // Escudo de Doran
      altId = userProfile.affinities.ap >= 1.8 ? '1056' : '1055';
      reason = 'O adversário possui alto alcance e poke; o Escudo de Doran regenera Vida continuamente após sofrer desgaste na rota.';
      benefit = 'Sustentação defensiva para farmar sem ser forçado a voltar à base cedo.';
    } else if (userProfile.affinities.ap >= 1.8 && userProfile.usesMana) {
      chosenId = userProfile.affinities.tearUser && enemyMetrics.scores.burst < 60 ? '3070' : '1056';
      altId = chosenId === '3070' ? '1056' : '3070';
      reason =
        chosenId === '3070'
          ? `${userProfile.champion.name} precisa empilhar Mana desde a primeira onda para acelerar o pico do Cajado do Arcanjo.`
          : 'Fornece Poder de Habilidade, Vida para trocas iniciais e restauração de Mana ao abater tropas.';
      benefit = chosenId === '3070' ? 'Acúmulo imediato de Mana máxima.' : 'Pressão de rota equilibrada com Vida + Mana.';
    } else if (userProfile.affinities.ad >= 1.8 || userProfile.affinities.attackSpeed >= 1.8) {
      chosenId = '1055'; // Lâmina de Doran
      altId = '1054';
      reason = 'Oferece Dano de Ataque, Vida e Roubo de Vida para vencer trocas curtas e controlar a onda desde o nível 1.';
      benefit = 'Força imediata de combate nos níveis 1 a 5.';
    } else {
      chosenId = '1054';
      altId = '1082';
      reason = 'Garante segurança e regeneração estável na fase de rotas.';
      benefit = 'Vida base + regeneração após sofrer dano de campeões.';
    }
  }

  const item = itemMap.get(chosenId) || items.find((i) => i.category === 'starter');
  if (!item) return null;
  const altItem = altId ? itemMap.get(altId) : undefined;

  return {
    slotKey: 'starter',
    slotLabel: '1. Item Inicial',
    orderIndex: 1,
    item,
    componentTree: buildComponentTree(item, itemMap),
    score: 98,
    reason,
    benefit,
    whenToBuy: 'Na saída da base aos 00:00 junto com Poções de Vida e Sentinela.',
    alternative: altItem
      ? {
          item: altItem,
          whenToPrefer:
            altItem.id === '1054'
              ? 'Prefira se esperar pressão extrema de poke nos níveis 1–4.'
              : 'Prefira em rotas pacíficas onde você pode escalar ou trocar ofensivamente.',
          pros: altItem.features.statLines.join(', ') || altItem.plaintext || 'Alternativa tática sólida de nível 1',
          cons: 'Exige adaptar a postura nos primeiros 3 níveis da rota.',
        }
      : undefined,
  };
}

function selectSupportQuestUpgrade(ctx: DraftBuildContext): RecommendedBuildSlot | null {
  const { userProfile, userRole, enemyMembers, enemyMetrics, itemMap } = ctx;
  if (userRole !== 'SUPPORT') return null;

  const enemyAssassins = enemyMembers.filter((m) =>
    ['ad_assassin', 'ap_assassin', 'diver'].includes(m.profile.archetype),
  );
  const lethalAssassins = enemyAssassins.filter(
    (m) => m.profile.ratings.burst >= 8.0 && m.profile.ratings.pickoff >= 6.5,
  );

  let chosenId = '3870'; // Criassonhos
  let altId = '3869'; // Oposição Celestial
  let reason = '';
  let benefit = '';

  if (enemyAssassins.length >= 2 || lethalAssassins.length >= 1 || enemyMetrics.scores.burst >= 65) {
    const burstNames = formatNameList(enemyAssassins.map((m) => m.profile.champion.name)) || 'o burst inimigo';
    chosenId = '3869'; // Oposição Celestial
    altId = userProfile.archetype === 'enchanter' ? '3870' : '3876';
    reason = `Contra a ameaça explosiva de ${burstNames}, a bênção reduz drasticamente o dano sofrido nos primeiros 2s quando tentarem te abater ou mergulhar na sua retaguarda.`;
    benefit = 'Redução massiva de dano explosivo + onda de lentidão em quem saltar em você.';
  } else if (userProfile.archetype === 'enchanter') {
    chosenId = '3870'; // Criassonhos
    altId = '3876'; // Trenó do Solstício
    reason = `Sinergia natural com as curas e escudos de ${userProfile.champion.name}, concedendo redução de dano e dano mágico bônus ao aliado protegido.`;
    benefit = 'Bolhas dos Sonhos automáticas que reduzem dano recebido e amplificam o próximo golpe do seu carry.';
  } else if (['vanguard', 'warden', 'catcher'].includes(userProfile.archetype)) {
    chosenId = '3876'; // Trenó do Solstício
    altId = '3869';
    reason = 'Ao imobilizar ou desacelerar um inimigo, cura e acelera você e o aliado mais ferido para acompanhar a jogada.';
    benefit = 'Vida bônus e Velocidade de Movimento compartilhada em cada controle de grupo aplicado.';
  } else {
    chosenId = '3871'; // Invadomínio de Zaz'Zak
    altId = '3869';
    reason = 'Amplifica o desgaste de habilidades à distância com explosões percentuais baseadas na Vida máxima do alvo.';
    benefit = 'Pressão extra de poke e dano contra alvos resistentes.';
  }

  const item = itemMap.get(chosenId);
  if (!item) return null;
  const altItem = itemMap.get(altId);

  return {
    slotKey: 'support_item',
    slotLabel: '2. Evolução do Item de Suporte',
    orderIndex: 2,
    item,
    componentTree: buildComponentTree(item, itemMap),
    score: 96,
    reason,
    benefit,
    whenToBuy: 'Evolução gratuita ao completar 800 de ouro na missão do Atlas Mundial (~minuto 11–14).',
    alternative: altItem
      ? {
          item: altItem,
          whenToPrefer:
            altItem.id === '3870'
              ? 'Prefira Criassonhos se o assassino inimigo ficar atrás e você quiser maximizar o DPS/peel do seu ADC.'
              : altItem.id === '3876'
                ? 'Prefira Trenó do Solstício quando sua equipe precisar de mobilidade extra ao acertar controles de grupo.'
                : 'Prefira Oposição Celestial caso você passe a ser o alvo primário de burst inimigo.',
          pros: 'Evolução sem custo adicional de ouro com alto impacto utilitário.',
          cons: 'Substitui a passiva defensiva/ofensiva da outra evolução.',
        }
      : undefined,
  };
}

function selectBootsSlot(ctx: DraftBuildContext): RecommendedBuildSlot | null {
  const { userProfile, userRole, enemyMetrics, enemyMembers, itemMap } = ctx;
  if (userProfile.champion.id === 'Cassiopeia') return null;

  let chosenId = '3158';
  let altId = '3111';
  let reason = '';
  let benefit = '';

  const autoAttackers = enemyMembers.filter(
    (m) => m.profile.affinities.attackSpeed >= 2.0 || m.profile.archetype.includes('marksman') || m.profile.archetype === 'skirmisher',
  );

  if (userRole === 'SUPPORT' && userProfile.archetype === 'enchanter') {
    if (enemyMetrics.scores.hardCC >= 68 && enemyMetrics.damageShare.magic >= 55) {
      chosenId = '3111'; // Passos de Mercúrio
      altId = '3158';
      reason = 'Alto volume de controle de grupo e dano mágico inimigo exige Tenacidade para que você não morra preso antes de usar suas curas e ultimate.';
      benefit = 'Resistência Mágica + 30% de Tenacidade.';
    } else if (enemyMetrics.scores.poke >= 65) {
      chosenId = '3158'; // Botas Ionianas da Lucidez
      altId = '3009'; // Botas da Rapidez
      reason = `Reduz os tempos de recarga das habilidades de cura/controle de ${userProfile.champion.name} e também dos seus Feitiços de Invocador (Flash/Exaustão) contra mergulhos na retaguarda.`;
      benefit = 'Aceleração de Habilidade + Aceleração de Feitiços de Invocador por ótimo custo-benefício (900g).';
    } else {
      chosenId = '3158';
      altId = '3047';
      reason = `Maximiza a frequência de habilidades e reduz a recarga de Flash/Exaustão para proteger sua equipe em todas as lutas.`;
      benefit = 'Custo econômico (900g) + Aceleração de Habilidade e de Feitiços.';
    }
  } else if (userProfile.affinities.attackSpeed >= 2.2 && ['crit_marksman', 'onhit_marksman', 'skirmisher'].includes(userProfile.archetype)) {
    if (enemyMetrics.damageShare.physical >= 72 && autoAttackers.length >= 2 && userProfile.archetype === 'skirmisher') {
      chosenId = '3047';
      altId = '3006';
      reason = `Contra ${enemyMetrics.damageShare.physical}% de dano físico e múltiplos atacantes básicos, Botas Galvanizadas vencem qualquer duelo lateral.`;
      benefit = 'Armadura + redução percentual do dano de ataques básicos.';
    } else {
      chosenId = '3006'; // Grevas do Berserker
      altId = userProfile.champion.id === 'Jhin' ? '3009' : '3047';
      reason = 'Pico imediato de Velocidade de Ataque para destravar kiting, limpeza de ondas e DPS sustentado.';
      benefit = '+Velocidade de Ataque e Velocidade de Movimento.';
    }
  } else if (userProfile.champion.id === 'Jhin') {
    chosenId = '3009'; // Botas da Rapidez
    altId = '3047';
    reason = 'Jhin tem cadência fixa de disparo e depende de alta Velocidade de Movimento e resistência a lentidão para reposicionar entre o 4º tiro e habilidades inimigas.';
    benefit = 'Maior Velocidade de Movimento base entre as botas + redução de efeitos de lentidão.';
  } else if (['burst_mage', 'artillery_mage', 'ap_assassin', 'battle_mage'].includes(userProfile.archetype)) {
    chosenId = '3020'; // Sapatos do Feiticeiro
    altId = enemyMetrics.scores.hardCC >= 62 ? '3111' : '3158';
    reason = 'Penetração Mágica fixa multiplica o dano contra alvos frágeis da retaguarda inimiga.';
    benefit = 'Penetração Mágica direta + Velocidade de Movimento.';
  } else {
    // Tanks, Juggernauts, Divers, AD Assassins
    if (enemyMetrics.scores.hardCC >= 56 || enemyMetrics.damageShare.magic >= 55) {
      chosenId = '3111'; // Passos de Mercúrio
      altId = '3047';
      reason = 'Tenacidade evita que você fique imobilizado na linha de frente durante o foco inimigo.';
      benefit = 'Resistência Mágica + Tenacidade contra enraizamentos e atordoamentos.';
    } else if (enemyMetrics.damageShare.physical >= 58 || autoAttackers.length >= 2) {
      chosenId = '3047'; // Botas Galvanizadas de Aço
      altId = '3111';
      reason = `Mitiga os ataques básicos e os ${enemyMetrics.damageShare.physical}% de dano físico da equipe adversária.`;
      benefit = 'Armadura + mitigação direta de ataques básicos.';
    } else {
      chosenId = '3158';
      altId = '3111';
      reason = 'Acelera rotações e reduz o tempo de recarga das suas habilidades principais.';
      benefit = 'Aceleração de Habilidade e de Feitiços de Invocador.';
    }
  }

  const item = itemMap.get(chosenId);
  if (!item) return null;
  const altItem = itemMap.get(altId);
  const t3Id = BOOTS_T2_TO_T3[chosenId];
  const tier3BootUpgrade = t3Id ? itemMap.get(t3Id) : undefined;

  return {
    slotKey: 'boots',
    slotLabel: '3. Botas',
    orderIndex: 3,
    item,
    componentTree: buildComponentTree(item, itemMap),
    score: 94,
    reason,
    benefit,
    whenToBuy: 'Entre os minutos 6 e 11 (ou logo após o primeiro componente épico).',
    tier3BootUpgrade,
    alternative: altItem
      ? {
          item: altItem,
          whenToPrefer:
            altItem.id === '3009'
              ? 'Prefira Botas da Rapidez para desviar de skillshots de longo alcance e reduzir lentidões.'
              : altItem.id === '3111'
                ? 'Prefira Passos de Mercúrio caso esteja sendo alvo direto de cadeias de controle de grupo.'
                : altItem.id === '3047'
                  ? 'Prefira Botas Galvanizadas se o assassino/atirador AD inimigo abrir vantagem cedo.'
                  : 'Prefira quando quiser priorizar menor tempo de recarga.',
          pros: altItem.features.statLines.join(' • ') || altItem.name,
          cons: 'Abre mão do atributo especializado da bota principal.',
        }
      : undefined,
  };
}

export function generateBuildRecommendation(
  allSrItems: ItemData[],
  ctx: DraftBuildContext,
): BuildRecommendationResult {
  const { userProfile, userRole, enemyMetrics, liveSituation, itemMap } = ctx;

  const completedCandidates = allSrItems
    .filter((it) => it.category === 'completed' && isItemCompatibleWithChampion(it, ctx))
    .map((it) => scoreCompletedItem(it, ctx))
    .sort((a, b) => b.score - a.score);

  const slots: RecommendedBuildSlot[] = [];
  const usedIds = new Set<string>();
  const usedUniqueGroups = new Set<string>();
  const uniquePassiveNotes: string[] = [];

  const starterSlot = selectStarterItem(allSrItems, ctx);
  if (starterSlot) {
    slots.push(starterSlot);
    usedIds.add(starterSlot.item.id);
  }

  const suppSlot = selectSupportQuestUpgrade(ctx);
  if (suppSlot) {
    slots.push(suppSlot);
    usedIds.add(suppSlot.item.id);
    usedUniqueGroups.add('SUPPORT_QUEST');
  }

  const bootsSlot = selectBootsSlot(ctx);
  if (bootsSlot) {
    slots.push(bootsSlot);
    usedIds.add(bootsSlot.item.id);
    usedUniqueGroups.add('BOOTS');
  } else if (userProfile.champion.id === 'Cassiopeia') {
    uniquePassiveNotes.push(
      'Passiva Graça Serpenteante (Cassiopeia): Cassiopeia não pode comprar Botas, ganhando Velocidade de Movimento por nível e liberando 1 espaço adicional para um 6º item lendário completo.',
    );
  }

  // Pick 6 contextual completed items (for Supports, items 1-4 complete the 6-slot inventory alongside Support Quest + Boots, and 5-6 are ultra-late luxury options!)
  const slotDefs: { key: RecommendedBuildSlot['slotKey']; label: string; timing: string }[] = [
    {
      key: 'item1',
      label: '4. Primeiro Item Fechado',
      timing: 'Primeiro grande pico de poder (~11–14 min). Prioridade máxima para ditar escaramuças de Dragão/Vastilarvas.',
    },
    {
      key: 'item2',
      label: '5. Segundo Item',
      timing: 'Meio de jogo (~17–21 min). Consolida sinergia com sua equipe ou resposta direta à maior ameaça inimiga.',
    },
    {
      key: 'item3',
      label: '6. Terceiro Item',
      timing: 'Lutas decisivas por Barão/Alma (~23–27 min). Essencial ter penetração ou proteção coletiva ativa aqui.',
    },
    {
      key: 'item4',
      label: '7. Quarto Item',
      timing:
        userRole === 'SUPPORT'
          ? 'Fecha o 6º espaço do inventário de Suporte (Item de Suporte + Botas + 4 Itens Lendários, ~28–33 min).'
          : 'Transição para o late game (~28–32 min), punindo resistências ou garantindo sobrevivência.',
    },
    {
      key: 'item5',
      label: userRole === 'SUPPORT' ? '8. Quinto Item (Substituição Tática / Ultra-Late)' : '8. Quinto Item',
      timing:
        userRole === 'SUPPORT'
          ? 'Opção contextual para substituir um item anterior ou caso a partida ultrapasse 38+ minutos.'
          : 'Fechamento de inventário completo (~33–36 min, substituindo o item inicial).',
    },
    {
      key: 'item6',
      label: userRole === 'SUPPORT' ? '9. Sexto Item (Opção Situacional de Fim de Jogo)' : '9. Sexto Item (Inventário Máximo)',
      timing:
        userRole === 'SUPPORT'
          ? 'Reserva estratégica de luxo caso precise adaptar resistências na última luta da partida.'
          : 'Último slot de fim de jogo (ou substituição de Botas em cenários extremos de 40+ min).',
    },
  ];

  let critCount = 0;

  for (let i = 0; i < slotDefs.length; i++) {
    const def = slotDefs[i];

    // Find highest-scoring compatible item that doesn't violate unique passive exclusivity or >100% crit waste
    let chosenIdx = -1;
    for (let cIdx = 0; cIdx < completedCandidates.length; cIdx++) {
      const cand = completedCandidates[cIdx];
      if (usedIds.has(cand.item.id)) continue;
      const groupConflict = cand.item.features.uniqueGroups.find((g) => usedUniqueGroups.has(g));
      if (groupConflict) {
        if (uniquePassiveNotes.length < 4) {
          uniquePassiveNotes.push(
            `Exclusividade respeitada (${groupConflict}): ${cand.item.name} não foi acumulado com outro item do mesmo grupo único para evitar perda de passiva.`,
          );
        }
        continue;
      }
      if (cand.item.features.critPct > 0 && critCount >= 4) continue;

      // Don't pick pure % pen as 1st item (enemies don't have stacked resists at minute 11)
      if (
        i === 0 &&
        (cand.item.features.uniqueGroups.includes('LAST_WHISPER') ||
          cand.item.features.uniqueGroups.includes('VOID_PEN'))
      ) {
        continue;
      }

      chosenIdx = cIdx;
      break;
    }

    if (chosenIdx === -1) break;
    const chosen = completedCandidates[chosenIdx];
    usedIds.add(chosen.item.id);
    for (const g of chosen.item.features.uniqueGroups) usedUniqueGroups.add(g);
    if (chosen.item.features.critPct > 0) critCount++;

    // Find a valid non-conflicting alternative for this slot
    const altCand = completedCandidates.find(
      (c, idx) =>
        idx !== chosenIdx &&
        !usedIds.has(c.item.id) &&
        !c.item.features.uniqueGroups.some((g) => g !== chosen.item.features.uniqueGroups[0] && usedUniqueGroups.has(g)),
    );

    slots.push({
      slotKey: def.key,
      slotLabel: def.label,
      orderIndex: slots.length + 1,
      item: chosen.item,
      componentTree: buildComponentTree(chosen.item, itemMap, [...(liveSituation.purchasedItemIds || [])]),
      score: Math.round(chosen.score),
      reason: chosen.reasons[0],
      benefit: chosen.benefits[0],
      whenToBuy: def.timing,
      alternative: altCand
        ? {
            item: altCand.item,
            whenToPrefer: altCand.reasons[0],
            pros: altCand.benefits[0],
            cons:
              altCand.item.goldTotal > chosen.item.goldTotal
                ? `Custa +${altCand.item.goldTotal - chosen.item.goldTotal} de ouro em relação a ${chosen.item.name}.`
                : `Oferece perfil diferente de atributos em relação a ${chosen.item.name}.`,
          }
        : undefined,
    });
  }

  const situationalItems = generateSituationalRecommendations(allSrItems, ctx, usedUniqueGroups);
  const liveRecalculation = liveSituation.enabled
    ? computeLiveRecalculation(slots, completedCandidates, allSrItems, ctx)
    : undefined;

  const buildIdentitySummary = `Build contextualizada para ${userProfile.champion.name} (${userProfile.archetypeLabel}) contra uma composição adversária com ${enemyMetrics.damageShare.physical}% dano físico / ${enemyMetrics.damageShare.magic}% mágico, índice de burst ${enemyMetrics.scores.burst}/100 e controle de grupo ${enemyMetrics.scores.hardCC}/100.`;

  return {
    slots,
    situationalItems,
    uniquePassiveNotes,
    buildIdentitySummary,
    liveRecalculation,
  };
}

function generateSituationalRecommendations(
  allSrItems: ItemData[],
  ctx: DraftBuildContext,
  usedGroupsInCore: Set<string>,
): SituationalItemRecommendation[] {
  const { userProfile, userRole, allyMembers, enemyMembers, enemyMetrics } = ctx;
  const completed = allSrItems.filter((i) => i.category === 'completed' && isItemCompatibleWithChampion(i, ctx));

  const pickBest = (predicate: (i: ItemData) => boolean): ItemData | undefined => {
    const matches = completed.filter(predicate);
    if (matches.length === 0) return undefined;
    return matches
      .map((m) => ({ item: m, s: scoreCompletedItem(m, ctx).score }))
      .sort((a, b) => b.s - a.s)[0]?.item;
  };

  const recs: SituationalItemRecommendation[] = [];

  // 1. Contra Assassinos e Burst
  const antiBurstItem = pickBest(
    (i) => i.features.aoeShieldActive || i.features.stasis || i.features.uniqueGroups.includes('LIFELINE') || i.id === '3026',
  );
  if (antiBurstItem) {
    const active = enemyMetrics.scores.burst >= 58;
    recs.push({
      conditionCategory: 'Contra Assassinos e Explosão (Burst)',
      relevanceScore: enemyMetrics.scores.burst,
      isTriggeredByCurrentDraft: active,
      item: antiBurstItem,
      whenToBuy: 'Antecipe como 2º ou 3º item sempre que um assassino ou mago de burst inimigo conseguir abates cedo.',
      whyBuy: `Oferece ferramenta direta de sobrevivência (${antiBurstItem.name}) para negar resets e execuções na retaguarda.`,
      whenToAvoid: 'Evite antecipar caso os assassinos adversários estejam muito atrás em ouro/nível e sem pressão lateral.',
      uniqueGroupConflict: antiBurstItem.features.uniqueGroups.find((g) => usedGroupsInCore.has(g)),
    });
  }

  // 2. Contra Muito Controle de Grupo
  const antiCCItem = pickBest((i) => i.id === '3222' || i.features.qssCleanse || i.features.spellshield || i.features.tenacityPct > 0);
  if (antiCCItem) {
    const active = enemyMetrics.scores.hardCC >= 52;
    recs.push({
      conditionCategory: 'Contra Muito Controle de Grupo / Pickoff',
      relevanceScore: enemyMetrics.scores.hardCC,
      isTriggeredByCurrentDraft: active,
      item: antiCCItem,
      whenToBuy: 'Priorize antes das lutas de 5v5 no rio quando ligações, atordoamentos ou supressões estiverem decidindo abates.',
      whyBuy: `${antiCCItem.name} neutraliza ou bloqueia imobilizações críticas que impediriam seu carregador de jogar.`,
      whenToAvoid: 'Evite contra composições cujo controle seja majoritariamente arremesso ao ar puro (knockup), que não é purificável.',
    });
  }

  // 3. Contra Muita Cura (Feridas Dolorosas)
  const gwItem = pickBest((i) => i.features.grievousWounds);
  if (gwItem) {
    const active = enemyMetrics.scores.sustain >= 58;
    recs.push({
      conditionCategory: 'Contra Muita Cura e Sustentação (Feridas Dolorosas)',
      relevanceScore: enemyMetrics.scores.sustain,
      isTriggeredByCurrentDraft: active,
      item: gwItem,
      whenToBuy: 'Compre o componente épico de 800g cedo na rota contra curandeiros/lutadores de roubo de vida e feche o item apenas no meio/fim de jogo.',
      whyBuy: `${gwItem.name} aplica Feridas Dolorosas, reduzindo drasticamente curas e regeneração durante o foco.`,
      whenToAvoid: 'Evite fechar caso um aliado já aplique Feridas Dolorosas em área facilmente ou se o inimigo quase não tiver cura.',
    });
  }

  // 4. Contra Tanques e Frontline Pesada
  const antiTankItem = pickBest(
    (i) => i.features.armorPenPct > 0 || i.features.magicPenPct > 0 || i.features.maxHpDamage,
  );
  if (antiTankItem) {
    const active = enemyMetrics.scores.frontline >= 56;
    recs.push({
      conditionCategory: 'Contra Tanques e Frontline Resistente',
      relevanceScore: enemyMetrics.scores.frontline,
      isTriggeredByCurrentDraft: active,
      item: antiTankItem,
      whenToBuy: 'Como 3º item assim que tanques adversários fecharem 2+ itens de Armadura/Resistência Mágica e Vida.',
      whyBuy: `${antiTankItem.name} garante dano percentual ou penetração escalável para vencer lutas front-to-back.`,
      whenToAvoid: 'Não compre como 1º item nem contra 5 campeões frágeis que não compraram resistências.',
      uniqueGroupConflict: antiTankItem.features.uniqueGroups.find((g) => usedGroupsInCore.has(g)),
    });
  }

  // 5. Contra Muito Dano Físico
  const antiADItem = pickBest((i) => i.features.armor >= 40 || (userRole === 'SUPPORT' && i.id === '3109'));
  if (antiADItem) {
    const active = enemyMetrics.damageShare.physical >= 60;
    recs.push({
      conditionCategory: 'Contra Muito Dano Físico',
      relevanceScore: enemyMetrics.damageShare.physical,
      isTriggeredByCurrentDraft: active,
      item: antiADItem,
      whenToBuy: 'Quando 3 ou mais adversários causarem dano físico ou o atirador/assassino AD inimigo estiver forte.',
      whyBuy: `${antiADItem.name} eleva sua mitigação física efetiva e reduz o impacto de combos e ataques básicos.`,
      whenToAvoid: 'Evite contra composições predominantemente mágicas (AP).',
    });
  }

  // 6. Contra Muito Dano Mágico
  const antiAPItem = pickBest((i) => i.features.magicResist >= 40 || (userRole === 'SUPPORT' && i.id === '3190'));
  if (antiAPItem && antiAPItem.id !== antiBurstItem?.id) {
    const active = enemyMetrics.damageShare.magic >= 55;
    recs.push({
      conditionCategory: 'Contra Muito Dano Mágico',
      relevanceScore: enemyMetrics.damageShare.magic,
      isTriggeredByCurrentDraft: active,
      item: antiAPItem,
      whenToBuy: 'Contra magos de artilharia/burst alimentados ou composições com 2+ fontes fortes de AP.',
      whyBuy: `${antiAPItem.name} absorve rajadas mágicas e impede abates à distância.`,
      whenToAvoid: 'Evite quando a única fonte AP inimiga for um suporte utilitário sem dano.',
    });
  }

  // 7. Contra Poke & Cerco (Sustentação)
  const antiPokeItem = pickBest((i) => i.features.aoeHealActive || i.features.lifeStealPct >= 10 || i.features.healthRegenPct >= 100 || i.id === '3083');
  if (antiPokeItem) {
    const active = enemyMetrics.scores.poke >= 56;
    recs.push({
      conditionCategory: 'Contra Muito Poke e Pressão de Alcance',
      relevanceScore: enemyMetrics.scores.poke,
      isTriggeredByCurrentDraft: active,
      item: antiPokeItem,
      whenToBuy: 'Antes de disputas prolongadas por torres do meio, Dragão e Barão contra magos de artilharia/atiradores de longo alcance.',
      whyBuy: `${antiPokeItem.name} restaura Vida para manter sua equipe apta a lutar mesmo após sofrer desgaste prévio.`,
      whenToAvoid: 'Menos prioritário contra composições puras de all-in explosivo de 1 segundo.',
    });
  }

  // 8. Sinergias de Suporte para proteger ADC / amplificar AP ou Velocidade de Ataque
  if (userRole === 'SUPPORT') {
    const apBuff = completed.find((i) => i.features.allyBuffAP);
    if (apBuff) {
      const hasAP = allyMembers.some((m) => m.role !== 'SUPPORT' && m.profile.damageMix.magic >= 0.6);
      recs.push({
        conditionCategory: 'Para Fortalecer Carregador Aliado de Poder de Habilidade (AP)',
        relevanceScore: hasAP ? 82 : 30,
        isTriggeredByCurrentDraft: hasAP,
        item: apBuff,
        whenToBuy: 'Quando seu Mid/Jungle/Bot AP estiver forte e participando ativamente das lutas com você.',
        whyBuy: `${apBuff.name} concede Poder de Habilidade extra sempre que você curar ou conceder escudo ao aliado.`,
        whenToAvoid: 'Evite se sua equipe inteira for de Dano Físico sem escalamentos relevantes de AP.',
      });
    }
    const asBuff = completed.find((i) => i.features.allyBuffAS);
    if (asBuff) {
      const hasAS = allyMembers.some(
        (m) => m.role !== 'SUPPORT' && m.profile.affinities.attackSpeed >= 2.0 && m.profile.champion.id !== 'Jhin',
      );
      recs.push({
        conditionCategory: 'Para Fortalecer Aliado de Velocidade de Ataque / Ao Contato',
        relevanceScore: hasAS ? 84 : 35,
        isTriggeredByCurrentDraft: hasAS,
        item: asBuff,
        whenToBuy: 'Quando um hipercarregador de ataques básicos for sua condição de vitória.',
        whyBuy: `${asBuff.name} concede Velocidade de Ataque e dano mágico ao contato em todas as suas curas e escudos.`,
        whenToAvoid: 'Evite quando seus carregadores aliados não escalarem com Velocidade de Ataque ou dependerem apenas de habilidades.',
      });
    }
  }

  return recs.sort((a, b) => Number(b.isTriggeredByCurrentDraft) - Number(a.isTriggeredByCurrentDraft) || b.relevanceScore - a.relevanceScore);
}

function computeLiveRecalculation(
  slots: RecommendedBuildSlot[],
  completedCandidates: ScoredItemCandidate[],
  allSrItems: ItemData[],
  ctx: DraftBuildContext,
): LiveSituationRecalculation {
  const { liveSituation, itemMap, enemyMembers, allyMembers, userRole } = ctx;
  const ownedSet = new Set(liveSituation.purchasedItemIds);
  const gold = Math.max(0, liveSituation.availableGold);

  // Determine the next unowned completed item from recalculated priorities
  const nextSlot = slots.find(
    (s) =>
      s.slotKey.startsWith('item') &&
      !ownedSet.has(s.item.id),
  );
  const targetCompleted = nextSlot?.item || completedCandidates.find((c) => !ownedSet.has(c.item.id))?.item || null;

  // Calculate remaining cost & affordable sub-components
  const ownedPool = [...liveSituation.purchasedItemIds];
  let remainingCost = 0;
  const missingComponents: ItemData[] = [];

  function collectMissingComponents(item: ItemData) {
    const idx = ownedPool.indexOf(item.id);
    if (idx !== -1) {
      ownedPool.splice(idx, 1);
      return;
    }
    if (item.from.length === 0) {
      missingComponents.push(item);
      remainingCost += item.goldTotal;
      return;
    }
    // Check if an epic component itself is missing; prefer epic component if affordable, else recurse
    let childrenMissingCost = 0;
    const subMissing: ItemData[] = [];
    for (const cid of item.from) {
      const ch = itemMap.get(cid);
      if (!ch) continue;
      const cIdx = ownedPool.indexOf(ch.id);
      if (cIdx !== -1) {
        ownedPool.splice(cIdx, 1);
      } else {
        subMissing.push(ch);
        childrenMissingCost += ch.goldTotal;
      }
    }
    remainingCost += item.goldBase + childrenMissingCost;
    for (const sm of subMissing) {
      missingComponents.push(sm);
      if (sm.from.length > 0) {
        for (const leafId of sm.from) {
          const leaf = itemMap.get(leafId);
          if (leaf) missingComponents.push(leaf);
        }
      }
    }
  }

  if (targetCompleted) {
    collectMissingComponents(targetCompleted);
  }

  const chosenImmediate: ItemData[] = [];
  let budget = gold;
  let immediateExplanation = '';

  if (targetCompleted && budget >= remainingCost && remainingCost > 0) {
    chosenImmediate.push(targetCompleted);
    budget -= remainingCost;
    immediateExplanation = `Você já possui ouro suficiente (${gold}g >= ${remainingCost}g restantes) para fechar ${targetCompleted.name} imediatamente nesta volta à base!`;
  } else {
    // Greedily pick highest-value missing components that fit current gold
    const uniqueMissing = Array.from(new Map(missingComponents.map((m) => [m.id, m])).values()).sort(
      (a, b) => b.goldTotal - a.goldTotal,
    );
    for (const comp of uniqueMissing) {
      if (comp.goldTotal <= budget) {
        chosenImmediate.push(comp);
        budget -= comp.goldTotal;
        break; // Show primary best component + optional control ward / secondary leaf
      }
    }
    // Add a second basic component or Control Ward (2055) if gold remains
    const controlWard = itemMap.get('2055');
    if (budget >= 75 && controlWard && (userRole === 'SUPPORT' || userRole === 'JUNGLE' || budget < 300)) {
      chosenImmediate.push(controlWard);
      budget -= 75;
    }
    immediateExplanation =
      chosenImmediate.length > 0
        ? `Melhor compra imediata com ${gold}g rumo a ${targetCompleted?.name || 'seu próximo pico'}: fortalece seus atributos agora sem atrasar a receita.`
        : `Com ${gold}g atuais, guarde o ouro ou compre consumíveis/visão até atingir 350–400g para o próximo componente base.`;
  }

  // Alternative immediate buys (e.g. defensive component or boots)
  const alternativeImmediateBuys: { item: ItemData; cost: number; reason: string }[] = [];
  const t2BootsSlot = slots.find((s) => s.slotKey === 'boots');
  if (t2BootsSlot && !ownedSet.has(t2BootsSlot.item.id) && t2BootsSlot.item.goldTotal <= gold) {
    alternativeImmediateBuys.push({
      item: t2BootsSlot.item,
      cost: t2BootsSlot.item.goldTotal,
      reason: 'Fechar Botas Tier 2 agora aumenta imediatamente sua capacidade de rotação e esquiva.',
    });
  }
  const oblivion = itemMap.get('3916'); // Orbe do Oblívio
  const execCalling = itemMap.get('3123'); // Chamado do Carrasco
  const clothArmor = itemMap.get('1029');
  const nullMagic = itemMap.get('1033');
  if (oblivion && gold >= 800 && ctx.enemyMetrics.scores.sustain >= 58 && ctx.userProfile.affinities.ap >= 1) {
    alternativeImmediateBuys.push({
      item: oblivion,
      cost: oblivion.goldTotal,
      reason: 'Componente rápido de Feridas Dolorosas caso as curas inimigas estejam saindo do controle.',
    });
  } else if (execCalling && gold >= 800 && ctx.enemyMetrics.scores.sustain >= 58 && ctx.userProfile.affinities.ad >= 1.5) {
    alternativeImmediateBuys.push({
      item: execCalling,
      cost: execCalling.goldTotal,
      reason: 'Aplica Feridas Dolorosas cedo sem precisar concluir o item lendário imediatamente.',
    });
  }
  if (clothArmor && gold >= 300 && liveSituation.laneOutcome === 'losing' && ctx.enemyMetrics.damageShare.physical >= 55) {
    alternativeImmediateBuys.push({
      item: clothArmor,
      cost: clothArmor.goldTotal,
      reason: 'Compra emergencial de Armadura para estancar perdas em rota difícil contra dano físico.',
    });
  } else if (nullMagic && gold >= 400 && liveSituation.laneOutcome === 'losing' && ctx.enemyMetrics.damageShare.magic >= 55) {
    alternativeImmediateBuys.push({
      item: nullMagic,
      cost: nullMagic.goldTotal,
      reason: 'Compra emergencial de Resistência Mágica para sobreviver a poke/burst na rota.',
    });
  }

  // Postponed items
  const postponedItems: { item: ItemData; reason: string }[] = [];
  const luxuryItems = allSrItems.filter((i) => ['3089', '6621', '3031'].includes(i.id) && isItemCompatibleWithChampion(i, ctx));
  if (liveSituation.gameState === 'behind' || liveSituation.laneOutcome === 'losing') {
    for (const lux of luxuryItems.slice(0, 2)) {
      postponedItems.push({
        item: lux,
        reason: `Adie ${lux.name} (${lux.goldTotal}g): jogando atrás, receitas caras com componentes grandes deixam você vulnerável por minutos demais.`,
      });
    }
  }
  if (liveSituation.minute < 18) {
    const penItem = slots.find((s) => s.item.features.armorPenPct > 0 || s.item.features.magicPenPct > 0)?.item;
    if (penItem && penItem.id !== targetCompleted?.id) {
      postponedItems.push({
        item: penItem,
        reason: `Aos ${liveSituation.minute} min, aguarde a linha de frente inimiga empilhar mais resistências antes de fechar penetração percentual.`,
      });
    }
  }

  // Tactical adjustments based on live state
  const tacticalAdjustments: string[] = [];
  if (liveSituation.gameState === 'behind' || liveSituation.laneOutcome === 'losing') {
    tacticalAdjustments.push(
      'Postura de Recuperação: Evite lutas 5v5 em campo aberto sem vantagem numérica; defenda ondas próximas às torres T2 e busque abates de recompensa (shutdown) punindo excesso de confiança inimigo.',
    );
  } else if (liveSituation.gameState === 'ahead') {
    tacticalAdjustments.push(
      'Conversão de Vantagem: Use seu pico de ouro atual para avançar a linha de visão na selva adversária 45s antes do próximo objetivo neutro.',
    );
  }
  if (liveSituation.fedEnemyId) {
    const fed = enemyMembers.find((m) => m.profile.champion.id === liveSituation.fedEnemyId);
    if (fed) {
      tacticalAdjustments.push(
        `Contenção de Shutdown (${fed.profile.champion.name}): Não gaste controles de grupo em tanques secundários — reserve seu CC principal e Exaustão exclusivamente para parar ${fed.profile.champion.name}.`,
      );
    }
  }
  if (liveSituation.carryingAllyId) {
    const carry = allyMembers.find((m) => m.profile.champion.id === liveSituation.carryingAllyId);
    if (carry) {
      tacticalAdjustments.push(
        `Jogue em Torno da Condição de Vitória (${carry.profile.champion.name}): Acompanhe as rotações de ${carry.profile.champion.name}, proteja sua posição e garanta visão nas laterais dele.`,
      );
    }
  }

  const totalSpend = chosenImmediate.reduce((acc, i) => acc + i.goldTotal, 0);
  return {
    bestNextCompletedItem: targetCompleted,
    remainingCostForNextItem: remainingCost,
    bestImmediateBuyComponents: {
      items: chosenImmediate,
      totalSpend: Math.min(gold, totalSpend),
      goldLeft: Math.max(0, gold - Math.min(gold, totalSpend)),
      explanation: immediateExplanation,
    },
    alternativeImmediateBuys: alternativeImmediateBuys.slice(0, 3),
    postponedItems: postponedItems.slice(0, 3),
    tacticalAdjustments,
  };
}
