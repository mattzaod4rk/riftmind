import type {
  Role,
  RuneEntry,
  RunePageConfig,
  RuneRecommendationResult,
  RuneTree,
  StatShard,
  SummonerSpellData,
  TeamCompositionMetrics,
} from '../types.ts';
import type { ChampionTacticalProfile } from './championProfiler.ts';
import type { ProfiledTeamMember } from './compositionEngine.ts';
import { formatNameList } from './textValidator.ts';

function findTree(trees: RuneTree[], key: string): RuneTree {
  return trees.find((t) => t.key.toLowerCase() === key.toLowerCase()) || trees[0];
}

function findRuneInSlot(tree: RuneTree, slotIdx: number, preferredKeySubstr: string): RuneEntry {
  const slot = tree.slots[slotIdx];
  if (!slot || slot.runes.length === 0) {
    return tree.slots[0].runes[0];
  }
  return (
    slot.runes.find((r) => r.key.toLowerCase().includes(preferredKeySubstr.toLowerCase())) ||
    slot.runes[0]
  );
}

function findShard(shards: StatShard[], id: string, rowFallback: 0 | 1 | 2): StatShard {
  return shards.find((s) => s.id === id) || shards.filter((s) => s.row === rowFallback)[0];
}

function findSummoner(summs: SummonerSpellData[], id: string): SummonerSpellData {
  return summs.find((s) => s.id === id) || summs[0];
}

export function generateRuneRecommendation(
  runeTrees: RuneTree[],
  statShards: StatShard[],
  summoners: SummonerSpellData[],
  params: {
    userProfile: ChampionTacticalProfile;
    userRole: Role;
    allyMembers: ProfiledTeamMember[];
    enemyMembers: ProfiledTeamMember[];
    allyMetrics: TeamCompositionMetrics;
    enemyMetrics: TeamCompositionMetrics;
  },
): RuneRecommendationResult {
  const { userProfile, userRole, enemyMembers, enemyMetrics } = params;
  const eS = enemyMetrics.scores;

  const enemyAssassins = enemyMembers.filter((m) =>
    ['ad_assassin', 'ap_assassin', 'diver'].includes(m.profile.archetype),
  );
  const lethalEarlyAssassins = enemyAssassins.filter(
    (m) => m.profile.ratings.burst >= 8.0 && m.profile.ratings.pickoff >= 6.5,
  );
  const highBurstThreat = enemyAssassins.length >= 2 || lethalEarlyAssassins.length >= 1 || eS.burst >= 64;
  const highCCThreat = eS.hardCC >= 56;
  const highPokeThreat = eS.poke >= 66;

  // Select Summoner Spells contextually
  const flash = findSummoner(summoners, 'SummonerFlash');
  const ghost = findSummoner(summoners, 'SummonerHaste');
  let spell1 = ['Olaf', 'Hecarim', 'Darius', 'Singed', 'Gwen'].includes(userProfile.champion.id) && userRole !== 'JUNGLE'
    ? ghost
    : flash;
  let spell2 = findSummoner(summoners, 'SummonerTeleport');
  let altSpell2 = findSummoner(summoners, 'SummonerDot');
  let spell2Reason = '';

  if (userRole === 'JUNGLE') {
    spell2 = findSummoner(summoners, 'SummonerSmite');
    altSpell2 = spell2;
    if (['MasterYi', 'Hecarim', 'Udyr', 'Darius'].includes(userProfile.champion.id)) {
      spell1 = ghost;
    }
    spell2Reason = 'Golpear é obrigatório na Selva para evoluir o companheiro e disputar objetivos neutros.';
  } else if (userRole === 'SUPPORT') {
    if (highBurstThreat) {
      const assNames = formatNameList(enemyAssassins.map((m) => m.profile.champion.name)) || 'o burst inimigo';
      spell2 = findSummoner(summoners, 'SummonerExhaust');
      altSpell2 = findSummoner(summoners, 'SummonerHeal');
      spell2Reason = `Exaustão corta 35% do dano explosivo e desacelera o mergulho de ${assNames} na sua retaguarda.`;
    } else if (enemyMetrics.scores.sustain >= 62) {
      spell2 = findSummoner(summoners, 'SummonerDot');
      altSpell2 = findSummoner(summoners, 'SummonerHeal');
      spell2Reason = 'Incendiar garante pressão de abate 2v2 e aplica Feridas Dolorosas contra a sustentação inimiga.';
    } else {
      spell2 = findSummoner(summoners, 'SummonerHeal');
      altSpell2 = findSummoner(summoners, 'SummonerExhaust');
      spell2Reason = 'Curar oferece Velocidade de Movimento e Vida imediata para você e seu ADC escaparem de skillshots e ganks.';
    }
  } else if (userRole === 'ADC') {
    if (highCCThreat) {
      spell2 = findSummoner(summoners, 'SummonerBoost'); // Purificar
      altSpell2 = findSummoner(summoners, 'SummonerBarrier');
      spell2Reason = 'Purificar é vital contra ligações/atordoamentos inimigos que resultariam em abate garantido.';
    } else if (highBurstThreat) {
      spell2 = findSummoner(summoners, 'SummonerBarrier');
      altSpell2 = findSummoner(summoners, 'SummonerExhaust');
      spell2Reason = 'Barreira absorve o pico de burst de assassinos e magos de longo alcance (não é reduzida por Feridas Dolorosas).';
    } else {
      spell2 = ghost;
      altSpell2 = findSummoner(summoners, 'SummonerBarrier');
      spell2Reason = 'Fantasma potencializa seu kiting e reposicionamento contínuo em lutas prolongadas.';
    }
  } else if (userRole === 'MID') {
    if (['ad_assassin', 'ap_assassin'].includes(userProfile.archetype) && !highPokeThreat) {
      spell2 = findSummoner(summoners, 'SummonerDot');
      altSpell2 = findSummoner(summoners, 'SummonerTeleport');
      spell2Reason = 'Incendiar destrava pressão letal de abate solo no nível 6.';
    } else {
      spell2 = findSummoner(summoners, 'SummonerTeleport');
      altSpell2 = highBurstThreat ? findSummoner(summoners, 'SummonerBarrier') : findSummoner(summoners, 'SummonerDot');
      spell2Reason = 'Teleporte assegura tempo de volta à base contra poke e presença nas rotações laterais no meio de jogo.';
    }
  } else {
    // TOP
    spell2 = ['Garen', 'Darius', 'Sett', 'Tryndamere'].includes(userProfile.champion.id) && !highPokeThreat
      ? findSummoner(summoners, 'SummonerDot')
      : findSummoner(summoners, 'SummonerTeleport');
    altSpell2 = spell2.id === 'SummonerDot' ? findSummoner(summoners, 'SummonerTeleport') : findSummoner(summoners, 'SummonerDot');
    spell2Reason =
      spell2.id === 'SummonerDot'
        ? 'Incendiar maximiza o potencial de abate solo na rota superior e reduz curas em duelos.'
        : 'Teleporte garante controle de ondas laterais e entrada em lutas de objetivos.';
  }

  // Build Primary & Secondary Trees dynamically by archetype + draft matchup!
  const sorcery = findTree(runeTrees, 'Sorcery');
  const resolve = findTree(runeTrees, 'Resolve');
  const precision = findTree(runeTrees, 'Precision');
  const domination = findTree(runeTrees, 'Domination');
  const inspiration = findTree(runeTrees, 'Inspiration');

  let primaryTree = sorcery;
  let keystoneKey = 'SummonAery';
  let p1Key = 'ManaflowBand';
  let p2Key = 'Transcendence';
  let p3Key = 'Scorch';

  let secondaryTree = resolve;
  let s1Key = 'BonePlating';
  let s2Key = 'Revitalize';

  let altPrimaryTree = resolve;
  let altKeystoneKey = 'Guardian';
  let altSecTree = sorcery;
  let altS1Key = 'ManaflowBand';
  let altS2Key = 'Transcendence';

  if (userProfile.archetype === 'enchanter') {
    primaryTree = sorcery;
    keystoneKey = 'SummonAery';
    p1Key = userProfile.usesMana ? 'ManaflowBand' : 'NimbusCloak';
    p2Key = userProfile.champion.id === 'Janna' || userProfile.champion.id === 'Nami' ? 'Transcendence' : 'Celerity';
    p3Key = highBurstThreat || enemyMetrics.scores.frontline >= 60 ? 'GatheringStorm' : 'Scorch';

    if (highBurstThreat || highPokeThreat) {
      secondaryTree = resolve;
      s1Key = highPokeThreat && !enemyAssassins.length ? 'SecondWind' : 'BonePlating';
      s2Key = 'Revitalize';
    } else {
      secondaryTree = inspiration;
      s1Key = 'MagicalFootwear';
      s2Key = 'BiscuitDelivery';
    }

    altPrimaryTree = resolve;
    altKeystoneKey = 'Guardian';
    altSecTree = sorcery;
    altS1Key = 'ManaflowBand';
    altS2Key = 'Transcendence';
  } else if (['vanguard', 'warden', 'catcher'].includes(userProfile.archetype)) {
    primaryTree = resolve;
    keystoneKey = userProfile.archetype === 'warden' && userRole === 'SUPPORT' ? 'Guardian' : userRole === 'TOP' && userProfile.ratings.hardCC < 6 ? 'GraspOfTheUndying' : 'Aftershock';
    p1Key = userRole === 'TOP' ? 'Demolish' : 'FontOfLife';
    p2Key = highPokeThreat ? 'SecondWind' : 'BonePlating';
    p3Key = highCCThreat ? 'Unflinching' : 'Overgrowth';

    secondaryTree = inspiration;
    s1Key = 'BiscuitDelivery';
    s2Key = 'CosmicInsight';

    altPrimaryTree = resolve;
    altKeystoneKey = keystoneKey === 'Aftershock' ? 'Guardian' : 'Aftershock';
    altSecTree = precision;
    altS1Key = 'Triumph';
    altS2Key = 'LegendHaste';
  } else if (['onhit_marksman', 'skirmisher'].includes(userProfile.archetype)) {
    primaryTree = precision;
    keystoneKey = ['Yasuo', 'Yone', 'MasterYi', 'KogMaw', 'Vayne', 'Ashe', 'Jinx'].includes(userProfile.champion.id)
      ? 'LethalTempo'
      : 'Conqueror';
    p1Key = 'Triumph';
    p2Key = 'LegendAlacrity';
    p3Key = enemyMetrics.scores.frontline >= 60 ? 'CutDown' : 'LastStand';

    secondaryTree = highBurstThreat ? resolve : domination;
    s1Key = highBurstThreat ? 'BonePlating' : 'SuddenImpact';
    s2Key = highBurstThreat ? 'Overgrowth' : 'TreasureHunter';

    altPrimaryTree = precision;
    altKeystoneKey = keystoneKey === 'LethalTempo' ? 'FleetFootwork' : 'LethalTempo';
    altSecTree = secondaryTree.key === 'Resolve' ? domination : resolve;
    altS1Key = altSecTree.key === 'Resolve' ? 'SecondWind' : 'TasteOfBlood';
    altS2Key = altSecTree.key === 'Resolve' ? 'Unflinching' : 'RelentlessHunter';
  } else if (['crit_marksman', 'caster_marksman'].includes(userProfile.archetype)) {
    primaryTree = precision;
    keystoneKey = highPokeThreat || userProfile.champion.id === 'Jhin' || userProfile.champion.id === 'Caitlyn'
      ? 'FleetFootwork'
      : 'PressTheAttack';
    p1Key = userProfile.usesMana ? 'PresenceOfMind' : 'Triumph';
    p2Key = userProfile.champion.id === 'Jhin' ? 'LegendBloodline' : 'LegendAlacrity';
    p3Key = enemyMetrics.scores.frontline >= 58 ? 'CutDown' : 'CoupDeGrace';

    secondaryTree = highBurstThreat ? resolve : sorcery;
    s1Key = highBurstThreat ? 'BonePlating' : 'Celerity';
    s2Key = highBurstThreat ? 'Overgrowth' : 'GatheringStorm';

    altPrimaryTree = userProfile.champion.id === 'Ezreal' ? precision : domination;
    altKeystoneKey = userProfile.champion.id === 'Ezreal' ? 'Conqueror' : 'HailOfBlades';
    altSecTree = inspiration;
    altS1Key = 'BiscuitDelivery';
    altS2Key = 'CosmicInsight';
  } else if (['juggernaut', 'diver'].includes(userProfile.archetype)) {
    primaryTree = userProfile.champion.id === 'Garen' && eS.poke >= 55 ? sorcery : precision;
    if (primaryTree.key === 'Sorcery') {
      keystoneKey = 'PhaseRush';
      p1Key = 'NimbusCloak';
      p2Key = 'Celerity';
      p3Key = 'GatheringStorm';
    } else {
      keystoneKey = 'Conqueror';
      p1Key = 'Triumph';
      p2Key = highCCThreat ? 'LegendHaste' : 'LegendAlacrity';
      p3Key = 'LastStand';
    }
    secondaryTree = resolve;
    s1Key = highPokeThreat ? 'SecondWind' : 'BonePlating';
    s2Key = highCCThreat ? 'Unflinching' : 'Overgrowth';

    altPrimaryTree = resolve;
    altKeystoneKey = 'GraspOfTheUndying';
    altSecTree = precision;
    altS1Key = 'Triumph';
    altS2Key = 'LastStand';
  } else if (['ad_assassin', 'ap_assassin'].includes(userProfile.archetype)) {
    primaryTree = domination;
    keystoneKey = 'Electrocute';
    p1Key = 'SuddenImpact';
    p2Key = 'GrislyMementos';
    p3Key = 'UltimateHunter';

    secondaryTree = highPokeThreat ? resolve : sorcery;
    s1Key = highPokeThreat ? 'SecondWind' : 'Transcendence';
    s2Key = highPokeThreat ? 'Overgrowth' : 'Scorch';

    altPrimaryTree = precision;
    altKeystoneKey = 'Conqueror';
    altSecTree = domination;
    altS1Key = 'SuddenImpact';
    altS2Key = 'UltimateHunter';
  } else {
    // Burst / Battle / Artillery Mages
    const isBattle = userProfile.archetype === 'battle_mage';
    primaryTree = isBattle && ['Cassiopeia', 'Swain'].includes(userProfile.champion.id) ? precision : sorcery;
    if (primaryTree.key === 'Precision') {
      keystoneKey = 'Conqueror';
      p1Key = 'PresenceOfMind';
      p2Key = 'LegendHaste';
      p3Key = 'LastStand';
      secondaryTree = sorcery;
      s1Key = 'ManaflowBand';
      s2Key = 'Transcendence';
    } else {
      keystoneKey = isBattle ? 'PhaseRush' : 'ArcaneComet';
      p1Key = 'ManaflowBand';
      p2Key = 'Transcendence';
      p3Key = highBurstThreat ? 'GatheringStorm' : 'Scorch';
      secondaryTree = highBurstThreat ? resolve : inspiration;
      s1Key = highBurstThreat ? 'BonePlating' : 'BiscuitDelivery';
      s2Key = highBurstThreat ? 'Overgrowth' : 'CosmicInsight';
    }

    altPrimaryTree = sorcery;
    altKeystoneKey = keystoneKey === 'ArcaneComet' ? 'FirstStrike' : 'ArcaneComet';
    if (altKeystoneKey === 'FirstStrike') altPrimaryTree = inspiration;
    altSecTree = domination;
    altS1Key = 'TasteOfBlood';
    altS2Key = 'UltimateHunter';
  }

  // Stat Shards
  const offShard =
    userProfile.affinities.attackSpeed >= 2.2
      ? findShard(statShards, 'shard_off_as', 0)
      : userRole === 'SUPPORT'
        ? findShard(statShards, 'shard_off_haste', 0)
        : findShard(statShards, 'shard_off_adaptive', 0);

  const flexShard =
    userRole === 'SUPPORT' || userProfile.champion.id === 'Jhin' || highPokeThreat
      ? findShard(statShards, 'shard_flex_ms', 1)
      : findShard(statShards, 'shard_flex_adaptive', 1);

  const defShard = highCCThreat
    ? findShard(statShards, 'shard_def_tenacity', 2)
    : highBurstThreat || highPokeThreat
      ? findShard(statShards, 'shard_def_hp_flat', 2)
      : findShard(statShards, 'shard_def_hp_scaling', 2);

  // Resolve actual RuneEntry objects
  const keystone = findRuneInSlot(primaryTree, 0, keystoneKey);
  const p1 = findRuneInSlot(primaryTree, 1, p1Key);
  const p2 = findRuneInSlot(primaryTree, 2, p2Key);
  const p3 = findRuneInSlot(primaryTree, 3, p3Key);

  // Pick 2 secondary runes from distinct slots (1..3)
  let secSlotA = 2;
  let secSlotB = 3;
  const matchS1Slot = secondaryTree.slots.findIndex((sl, idx) => idx > 0 && sl.runes.some((r) => r.key.toLowerCase().includes(s1Key.toLowerCase())));
  const matchS2Slot = secondaryTree.slots.findIndex((sl, idx) => idx > 0 && sl.runes.some((r) => r.key.toLowerCase().includes(s2Key.toLowerCase())));
  if (matchS1Slot > 0) secSlotA = matchS1Slot;
  if (matchS2Slot > 0 && matchS2Slot !== secSlotA) secSlotB = matchS2Slot;
  if (secSlotA === secSlotB) secSlotB = secSlotA === 3 ? 1 : 3;

  const s1 = findRuneInSlot(secondaryTree, secSlotA, s1Key);
  const s2 = findRuneInSlot(secondaryTree, secSlotB, s2Key);

  // Alternative page
  const altKeystone = findRuneInSlot(altPrimaryTree, 0, altKeystoneKey);
  const ap1 = altPrimaryTree.slots[1].runes[0];
  const ap2 = altPrimaryTree.slots[2].runes[0];
  const ap3 = altPrimaryTree.slots[3].runes[0];
  const as1 = findRuneInSlot(altSecTree, 1, altS1Key);
  const as2 = findRuneInSlot(altSecTree, 2, altS2Key);

  const postureLabel = highBurstThreat
    ? 'Equilibrada com Proteção Anti-Burst'
    : highPokeThreat
      ? 'Sustentação e Resiliência contra Poke'
      : 'Pressão Proativa e Escalamento';

  const recommended: RunePageConfig = {
    title: `Página Contextual Principal — ${keystone.name} + ${secondaryTree.name}`,
    postureLabel,
    primaryTree,
    keystone,
    primaryRunes: [p1, p2, p3],
    secondaryTree,
    secondaryRunes: [s1, s2],
    statShards: [offShard, flexShard, defShard],
    summonerSpells: [spell1, spell2],
    overallReasoning: `Selecionada para ${userProfile.champion.name} (${userRole}) considerando índice de explosão inimiga (${eS.burst}/100), controle de grupo (${eS.hardCC}/100) e pressão de alcance (${eS.poke}/100).`,
    choiceExplanations: [
      {
        label: 'Runa Principal (Keystone)',
        name: keystone.name,
        icon: keystone.icon,
        reason: `Maximiza o valor constante de ${userProfile.champion.name} nas trocas de rota e nas lutas de equipe sem exigir exposição excessiva.`,
      },
      {
        label: `Árvore Secundária (${secondaryTree.name})`,
        name: `${s1.name} + ${s2.name}`,
        icon: s1.icon,
        reason:
          secondaryTree.key === 'Resolve'
            ? `Escolhida especificamente para absorver o burst/poke adversário e amplificar sua resistência nas janelas de all-in.`
            : `Acelera seus picos econômicos e utilitários pois a pressão de abate instantâneo inimiga permite uma árvore secundária mais proativa.`,
      },
      {
        label: 'Fragmento Defensivo',
        name: defShard.name,
        icon: defShard.iconUrl,
        reason: highCCThreat
          ? 'Os 15% de Tenacidade e Resistência a Lentidão ajudam a escapar de cadeias de imobilização inimigas.'
          : highBurstThreat
            ? '+65 de Vida fixa impedem abates nos primeiros níveis e all-ins no nível 6.'
            : 'Vida escalável supera a Vida fixa a partir do nível 7 para lutas de meio/fim de jogo.',
      },
      {
        label: 'Feitiços de Invocador',
        name: `${spell1.name} + ${spell2.name}`,
        icon: spell2.imageFull,
        reason: spell2Reason,
      },
    ],
  };

  const alternative: RunePageConfig = {
    title: `Alternativa Tática — ${altKeystone.name} + ${altSecTree.name}`,
    postureLabel: altPrimaryTree.key === 'Resolve' ? 'Ultra-Defensiva / Anti-Dive Máximo' : 'Ofensiva / Ritmo Alternativo',
    primaryTree: altPrimaryTree,
    keystone: altKeystone,
    primaryRunes: [ap1, ap2, ap3],
    secondaryTree: altSecTree,
    secondaryRunes: [as1, as2],
    statShards: [
      offShard,
      findShard(statShards, 'shard_flex_adaptive', 1),
      findShard(statShards, 'shard_def_hp_scaling', 2),
    ],
    summonerSpells: [spell1, altSpell2],
    overallReasoning:
      altPrimaryTree.key === 'Resolve'
        ? `Opção de máxima sobrevivência caso você prefira absorver qualquer tentativa de dive logo no primeiro impacto com ${altKeystone.name}.`
        : `Opção voltada para maximizar dano/ritmo caso sinta conforto mecânico na rota e queira acelerar vantagens cedo.`,
    choiceExplanations: [
      {
        label: 'Quando Preferir Esta Alternativa',
        name: altKeystone.name,
        icon: altKeystone.icon,
        reason:
          altPrimaryTree.key === 'Resolve'
            ? 'Quando jogar contra duplas de all-in extremo ou múltiplos assassinos e quiser escudo/resistência garantidos sem depender de trocas curtas.'
            : 'Quando a rota for tranquila e sua equipe precisar de pressão ofensiva desde os primeiros minutos.',
      },
    ],
  };

  const comparisonSummary = highBurstThreat
    ? `Como a equipe adversária apresenta alta ameaça de explosão (${eS.burst}/100), a página recomendada combina o valor consistente de ${keystone.name} com proteção secundária em ${secondaryTree.name} (${s1.name}) e ${spell2.name}. Caso deseje ainda mais blindagem contra all-in, a alternativa com ${altKeystone.name} sacrifica pressão de rota por segurança máxima.`
    : `Diante de uma composição com menor risco de abate instantâneo no nível 1–3, ${keystone.name} entrega maior impacto contínuo ao longo da partida do que uma página puramente passiva.`;

  return {
    recommended,
    alternative,
    comparisonSummary,
  };
}
