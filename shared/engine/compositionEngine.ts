import {
  ROLES,
  type ChampionData,
  type CompositionInsight,
  type DraftTeamSlots,
  type Role,
  type TeamCompositionMetrics,
} from '../types.ts';
import { profileChampion, type ChampionTacticalProfile } from './championProfiler.ts';
import { formatNameList } from './textValidator.ts';

function toScore100(sum: number, maxExpected: number): number {
  if (maxExpected <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((sum / maxExpected) * 100)));
}

export interface ProfiledTeamMember {
  role: Role;
  profile: ChampionTacticalProfile;
}

export function getTeamProfiles(
  slots: DraftTeamSlots,
  champMap: Map<string, ChampionData>,
): ProfiledTeamMember[] {
  const members: ProfiledTeamMember[] = [];
  for (const role of ROLES) {
    const cid = slots[role];
    if (!cid) continue;
    const champ = champMap.get(cid);
    if (!champ) continue;
    members.push({
      role,
      profile: profileChampion(champ, role),
    });
  }
  return members;
}

export function evaluateTeamMetrics(members: ProfiledTeamMember[]): TeamCompositionMetrics {
  const n = members.length;
  if (n === 0) {
    return {
      championCount: 0,
      damageShare: { physical: 50, magic: 45, trueDamage: 5 },
      scores: {
        physicalDamage: 0,
        magicDamage: 0,
        trueDamage: 0,
        hardCC: 0,
        softCC: 0,
        engage: 0,
        disengage: 0,
        initiation: 0,
        peel: 0,
        poke: 0,
        burst: 0,
        sustain: 0,
        frontline: 0,
        mobility: 0,
        chase: 0,
        pickoff: 0,
        scaling: 0,
        siege: 0,
        antiTank: 0,
        assassinVulnerability: 0,
        diveResistance: 0,
      },
      archetypeSummary: [],
      keyContributors: {
        physicalDamage: [],
        magicDamage: [],
        trueDamage: [],
        hardCC: [],
        engage: [],
        peel: [],
        poke: [],
        burst: [],
        sustain: [],
        frontline: [],
        antiTank: [],
        vulnerableCarries: [],
      },
    };
  }

  let weightedPhys = 0;
  let weightedMagic = 0;
  let weightedTrue = 0;

  let sumHardCC = 0;
  let sumSoftCC = 0;
  let sumEngage = 0;
  let maxEngage = 0;
  let sumDisengage = 0;
  let sumPeel = 0;
  let sumPoke = 0;
  let sumBurst = 0;
  let sumSustain = 0;
  let sumTankiness = 0;
  let sumMobility = 0;
  let sumPickoff = 0;
  let sumScaling = 0;
  let maxSiege = 0;
  let sumSiege = 0;
  let sumAntiTank = 0;
  let immobileSquishies = 0;

  const contributors: Record<string, string[]> = {
    physicalDamage: [],
    magicDamage: [],
    trueDamage: [],
    hardCC: [],
    engage: [],
    peel: [],
    poke: [],
    burst: [],
    sustain: [],
    frontline: [],
    antiTank: [],
    vulnerableCarries: [],
  };

  for (const { role, profile } of members) {
    const r = profile.ratings;
    const isSupportiveArchetype = ['enchanter', 'warden', 'vanguard', 'catcher'].includes(profile.archetype);
    const dmgOutputWeight =
      role === 'SUPPORT' && isSupportiveArchetype
        ? 0.38
        : ['vanguard', 'warden'].includes(profile.archetype)
          ? 0.55
          : 1.15;

    const pOut = profile.damageMix.physical * dmgOutputWeight * (r.burst * 0.45 + r.sustainedDps * 0.55);
    const mOut = profile.damageMix.magic * dmgOutputWeight * (r.burst * 0.45 + r.sustainedDps * 0.55);
    const tOut = profile.damageMix.trueDamage * dmgOutputWeight * (r.burst * 0.35 + r.sustainedDps * 0.65);

    weightedPhys += pOut;
    weightedMagic += mOut;
    weightedTrue += tOut;

    if (profile.damageMix.physical >= 0.55 && dmgOutputWeight >= 0.8) {
      contributors.physicalDamage.push(profile.champion.name);
    }
    if (profile.damageMix.magic >= 0.55 && dmgOutputWeight >= 0.8) {
      contributors.magicDamage.push(profile.champion.name);
    }
    if (profile.damageMix.trueDamage >= 0.14) {
      contributors.trueDamage.push(profile.champion.name);
    }

    sumHardCC += r.hardCC;
    sumSoftCC += r.softCC;
    sumEngage += r.engage;
    if (r.engage > maxEngage) maxEngage = r.engage;
    sumDisengage += r.disengage;
    sumPeel += r.peel;
    sumPoke += r.poke;
    sumBurst += r.burst;
    sumSustain += r.sustainHealShield;
    sumTankiness += r.tankiness;
    sumMobility += r.mobility;
    sumPickoff += r.pickoff;
    sumScaling += r.scalingLate;
    sumSiege += r.siege;
    if (r.siege > maxSiege) maxSiege = r.siege;
    sumAntiTank += r.antiTank;

    if (r.hardCC >= 5.5) contributors.hardCC.push(profile.champion.name);
    if (r.engage >= 6.5) contributors.engage.push(profile.champion.name);
    if (r.peel >= 6.0) contributors.peel.push(profile.champion.name);
    if (r.poke >= 6.5) contributors.poke.push(profile.champion.name);
    if (r.burst >= 7.0) contributors.burst.push(profile.champion.name);
    if (r.sustainHealShield >= 6.0) contributors.sustain.push(profile.champion.name);
    if (r.tankiness >= 7.0) contributors.frontline.push(profile.champion.name);
    if (r.antiTank >= 7.0) contributors.antiTank.push(profile.champion.name);

    if (r.tankiness <= 4.5 && r.mobility <= 4.8) {
      immobileSquishies++;
      // Only classify offensive carries (not pure supports/enchanters/wardens/vanguards) as vulnerable carries to protect
      if (role !== 'SUPPORT' && !isSupportiveArchetype) {
        contributors.vulnerableCarries.push(profile.champion.name);
      }
    }
  }

  const totalDmg = Math.max(0.01, weightedPhys + weightedMagic + weightedTrue);
  const physPct = Math.round((weightedPhys / totalDmg) * 100);
  const truePct = Math.round((weightedTrue / totalDmg) * 100);
  const magicPct = Math.max(0, 100 - physPct - truePct);

  const scaleFactor = 5 / n;
  const frontlineScore = toScore100(sumTankiness * scaleFactor, 30);
  const peelScore = toScore100(sumPeel * scaleFactor, 22);
  const disengageScore = toScore100(sumDisengage * scaleFactor, 22);
  const hardCCScore = toScore100(sumHardCC * scaleFactor, 28);

  const diveResistance = Math.min(
    100,
    Math.round(peelScore * 0.42 + disengageScore * 0.28 + frontlineScore * 0.18 + hardCCScore * 0.12),
  );
  const assassinVulnerability = Math.max(
    5,
    Math.min(100, Math.round(immobileSquishies * 24 - peelScore * 0.35 - frontlineScore * 0.15 + 35)),
  );

  return {
    championCount: n,
    damageShare: {
      physical: physPct,
      magic: magicPct,
      trueDamage: truePct,
    },
    scores: {
      physicalDamage: toScore100(weightedPhys * scaleFactor, 26),
      magicDamage: toScore100(weightedMagic * scaleFactor, 26),
      trueDamage: toScore100(weightedTrue * scaleFactor, 8),
      hardCC: hardCCScore,
      softCC: toScore100(sumSoftCC * scaleFactor, 22),
      engage: toScore100((sumEngage * 0.65 + maxEngage * 1.4) * scaleFactor, 28),
      disengage: disengageScore,
      initiation: toScore100((maxEngage * 2.2 + sumPickoff * 0.45) * scaleFactor, 30),
      peel: peelScore,
      poke: toScore100(sumPoke * scaleFactor, 32),
      burst: toScore100(sumBurst * scaleFactor, 36),
      sustain: toScore100(sumSustain * scaleFactor, 25),
      frontline: frontlineScore,
      mobility: toScore100(sumMobility * scaleFactor, 30),
      chase: toScore100((sumMobility * 0.65 + sumSoftCC * 0.45) * scaleFactor, 28),
      pickoff: toScore100(sumPickoff * scaleFactor, 30),
      scaling: toScore100(sumScaling * scaleFactor, 38),
      siege: toScore100((sumSiege * 0.55 + maxSiege * 1.5) * scaleFactor, 30),
      antiTank: toScore100(sumAntiTank * scaleFactor, 30),
      assassinVulnerability,
      diveResistance,
    },
    archetypeSummary: members.map((m) => `${m.profile.champion.name} (${m.profile.archetypeLabel})`),
    keyContributors: contributors,
  };
}

export function generateCompositionInsightsAndWinConditions(
  allyMembers: ProfiledTeamMember[],
  enemyMembers: ProfiledTeamMember[],
  allyMetrics: TeamCompositionMetrics,
  enemyMetrics: TeamCompositionMetrics,
  userProfile?: ChampionTacticalProfile,
  userRole?: Role,
): {
  allyWinConditions: string[];
  enemyWinConditions: string[];
  insights: CompositionInsight[];
} {
  const insights: CompositionInsight[] = [];
  const allyWinConditions: string[] = [];
  const enemyWinConditions: string[] = [];

  const aS = allyMetrics.scores;
  const eS = enemyMetrics.scores;
  const aC = allyMetrics.keyContributors;
  const eC = enemyMetrics.keyContributors;

  // Identify ally protectors/peelers vs offensive carries cleanly so no champion appears in both groups
  const userIsProtector = Boolean(
    userProfile &&
      (userRole === 'SUPPORT' ||
        ['enchanter', 'warden', 'vanguard', 'catcher'].includes(userProfile.archetype) ||
        userProfile.ratings.peel >= 6.0),
  );

  const rawPeelers = Array.from(
    new Set([
      ...(userIsProtector && userProfile ? [userProfile.champion.name] : []),
      ...aC.peel,
    ]),
  );

  const offensiveCarryCandidates = allyMembers
    .filter(
      (m) =>
        m.role !== 'SUPPORT' &&
        !['enchanter', 'warden', 'vanguard', 'catcher'].includes(m.profile.archetype) &&
        (m.profile.ratings.sustainedDps >= 5.5 || m.profile.ratings.burst >= 6.5),
    )
    .map((m) => m.profile.champion.name);

  // Carries to protect must NEVER include the peelers/protectors
  let carriesToProtect = Array.from(
    new Set([...aC.vulnerableCarries, ...offensiveCarryCandidates]),
  ).filter((name) => !rawPeelers.includes(name));

  // If a team consists only of peelers/hybrids, ensure peelers and carries stay disjoint
  if (carriesToProtect.length === 0 && offensiveCarryCandidates.length > 0) {
    carriesToProtect = offensiveCarryCandidates.filter(
      (name) => !userIsProtector || name !== userProfile?.champion.name,
    );
  }
  const activePeelers = rawPeelers.filter((name) => !carriesToProtect.includes(name));

  // 1. Damage distribution insights
  if (allyMetrics.damageShare.physical >= 68) {
    const physList = formatNameList(aC.physicalDamage) || 'múltiplos campeões de dano físico';
    insights.push({
      type: 'warning',
      team: 'ally',
      title: 'Sobrecarga de Dano Físico na Minha Equipe',
      description: `Sua equipe concentra ${allyMetrics.damageShare.physical}% de dano físico (${physList}). Tanques adversários conseguirão empilhar Armadura com alta eficiência; penetração percentual será obrigatória.`,
      relatedChampionIds: allyMembers.filter((m) => m.profile.damageMix.physical >= 0.6).map((m) => m.profile.champion.id),
    });
  } else if (allyMetrics.damageShare.magic >= 68) {
    const magicList = formatNameList(aC.magicDamage) || 'múltiplos campeões de dano mágico';
    insights.push({
      type: 'warning',
      team: 'ally',
      title: 'Sobrecarga de Dano Mágico na Minha Equipe',
      description: `Sua composição concentra ${allyMetrics.damageShare.magic}% de dano mágico (${magicList}), facilitando a compra de Resistência Mágica pelo inimigo.`,
      relatedChampionIds: allyMembers.filter((m) => m.profile.damageMix.magic >= 0.6).map((m) => m.profile.champion.id),
    });
  } else if (allyMetrics.championCount >= 3) {
    const hybridContributors = formatNameList(
      [...aC.physicalDamage, ...aC.magicDamage, ...aC.trueDamage].slice(0, 5),
    );
    insights.push({
      type: 'strength',
      team: 'ally',
      title: 'Distribuição Híbrida de Dano Difícil de Itemizar',
      description: `Sua equipe equilibra ${allyMetrics.damageShare.physical}% físico, ${allyMetrics.damageShare.magic}% mágico e ${allyMetrics.damageShare.trueDamage}% verdadeiro${hybridContributors ? ` (${hybridContributors})` : ''}, impedindo itemização defensiva única do adversário.`,
      relatedChampionIds: allyMembers.map((m) => m.profile.champion.id),
    });
  }

  // 2. Enemy Assassin & Dive pressure vs Ally Backline
  const enemyAssassins = enemyMembers.filter((m) =>
    ['ad_assassin', 'ap_assassin', 'diver'].includes(m.profile.archetype),
  );
  if (enemyAssassins.length > 0 && (carriesToProtect.length > 0 || aC.vulnerableCarries.length > 0)) {
    const assassinList = enemyAssassins.map((m) => m.profile.champion.name);
    const assassinText = formatNameList(assassinList);
    const targetCarriesText = formatNameList(
      carriesToProtect.length > 0 ? carriesToProtect : aC.vulnerableCarries,
      'e',
      assassinList,
    );
    const verbBuscar = assassinList.length > 1 ? 'buscarão' : 'buscará';

    insights.push({
      type: 'threat',
      team: 'enemy',
      title: 'Ameaça Direta de Flanco e Dive na Retaguarda',
      description: `${assassinText} ${verbBuscar} eliminar ${targetCarriesText || 'sua retaguarda'} antes que o DPS sustentado da sua equipe entre em ação. Guardar controle de grupo instantâneo, Exaustão e escudos defensivos para o avanço inimigo é decisivo.`,
      relatedChampionIds: enemyAssassins.map((m) => m.profile.champion.id),
    });
  }

  // 3. Enemy Frontline & Tankiness vs Ally Anti-Tank
  if (eC.frontline.length > 0) {
    const tankNames = formatNameList(eC.frontline);
    if (aS.antiTank >= 62) {
      const shredders = formatNameList(aC.antiTank, 'e', eC.frontline) || 'seus carregadores';
      insights.push({
        type: 'strength',
        team: 'matchup',
        title: 'Capacidade Sólida para Derreter a Frontline Inimiga',
        description: `Embora o adversário conte com linha de frente resistente (${tankNames}), sua equipe dispõe de ótimo DPS contínuo e dano percentual com ${shredders} em lutas front-to-back.`,
        relatedChampionIds: allyMembers.filter((m) => m.profile.ratings.antiTank >= 6.5).map((m) => m.profile.champion.id),
      });
    } else {
      insights.push({
        type: 'warning',
        team: 'matchup',
        title: 'Frontline Adversária Resistente',
        description: `O time inimigo possui linha de frente durável (${tankNames}) e sua composição tem baixo dano percentual natural. Priorize itens de penetração e não gaste todo o burst no tanque.`,
        relatedChampionIds: enemyMembers.filter((m) => m.profile.ratings.tankiness >= 7).map((m) => m.profile.champion.id),
      });
    }
  }

  // 4. Enemy Poke / Range / Siege & Catch
  if (eS.poke >= 58 || eS.siege >= 65) {
    const pokerList = eC.poke;
    const pokers = pokerList.length > 0 ? formatNameList(pokerList) : 'Os conjuradores e atiradores inimigos';
    const verbPunir = pokerList.length === 1 ? 'pune' : 'punem';
    insights.push({
      type: 'threat',
      team: 'enemy',
      title: 'Forte Pressão de Alcance, Cerco e Poke',
      description: `${pokers} ${verbPunir} equipes paradas disputando visão em corredores estreitos ou defendendo torres sem vida cheia. Evite ficar no rio sem objetivos vivos sem antes garantir visão lateral ou sustentação.`,
      relatedChampionIds: enemyMembers.filter((m) => m.profile.ratings.poke >= 6 || m.profile.ratings.siege >= 7).map((m) => m.profile.champion.id),
    });
  }

  // 5. Enemy Peel / Enchanter protection
  if (eC.peel.length > 0 || eC.sustain.length > 0) {
    const protectorUnique = Array.from(new Set([...eC.peel, ...eC.sustain]));
    const protectors = formatNameList(protectorUnique);
    const verbOferecer = protectorUnique.length === 1 ? 'oferece' : 'oferecem';
    insights.push({
      type: 'threat',
      team: 'enemy',
      title: 'Proteção, Escudos e Sustentação Inimiga',
      description: `${protectors} ${verbOferecer} escudos, cura ou desengaje que podem frustrar abates rápidos. Considere Feridas Dolorosas ou quebra de escudos quando aplicável e force a troca de tempos de recarga antes do all-in.`,
      relatedChampionIds: enemyMembers.filter((m) => m.profile.ratings.peel >= 6 || m.profile.ratings.sustainHealShield >= 6).map((m) => m.profile.champion.id),
    });
  }

  // 6. Ally Initiation Deficit or Strength
  if (aS.engage < 45 && allyMetrics.championCount >= 4) {
    insights.push({
      type: 'warning',
      team: 'ally',
      title: 'Iniciação Primária Limitada — Jogue por Resposta e Pickoff',
      description: `Sua composição não possui múltiplos iniciadores pesados de vanguarda. Em vez de forçar dives cegos sob torres, controle a visão dos objetivos primeiro e puna o avanço inimigo com counter-engage e follow-up de controle de grupo.`,
      relatedChampionIds: [],
    });
  } else if (aC.engage.length > 0) {
    const engagers = formatNameList(aC.engage);
    const verbPermitir = aC.engage.length === 1 ? 'permite' : 'permitem';
    insights.push({
      type: 'strength',
      team: 'ally',
      title: 'Boa Capacidade de Iniciação Aliada',
      description: `${engagers} ${verbPermitir} ditar o gatilho das lutas quando houver vantagem numérica ou feitiços de invocador inimigos em recarga.`,
      relatedChampionIds: allyMembers.filter((m) => m.profile.ratings.engage >= 6.5).map((m) => m.profile.champion.id),
    });
  }

  // Win Conditions — Minha Equipe
  if (aS.antiTank >= 60 && aS.sustain >= 48) {
    const carriesText = formatNameList(carriesToProtect);
    const peelersText = formatNameList(activePeelers, 'e', carriesToProtect);

    if (carriesText && peelersText) {
      const peelClause =
        activePeelers.length > 1
          ? `${peelersText} mantêm a retaguarda segura e fortalecem seus carregadores`
          : `${peelersText} mantém a retaguarda segura e fortalece seus carregadores`;
      allyWinConditions.push(
        `Vencer lutas prolongadas no estilo front-to-back, protegendo ${carriesText} enquanto ${peelClause}.`,
      );
    } else if (carriesText) {
      allyWinConditions.push(
        `Vencer lutas prolongadas no estilo front-to-back, protegendo ${carriesText} com controle de zona enquanto sua linha de frente absorve o impacto inicial.`,
      );
    } else if (peelersText) {
      allyWinConditions.push(
        `Vencer lutas prolongadas no estilo front-to-back com a proteção e sustentação de ${peelersText} até desgastar a linha de frente inimiga.`,
      );
    }
  }

  const skirmishHyper = allyMembers.filter((m) =>
    ['skirmisher', 'battle_mage', 'crit_marksman', 'onhit_marksman'].includes(m.profile.archetype),
  );
  if (skirmishHyper.length > 0) {
    const hyperNames = formatNameList(skirmishHyper.map((m) => m.profile.champion.name));
    allyWinConditions.push(
      `Escalar ${hyperNames} para o pico de 2 a 3 itens, garantindo espaço e proteção depois que os principais controles de grupo inimigos forem gastos.`,
    );
  }
  if (aS.pickoff >= 55) {
    allyWinConditions.push(
      `Punir alvos sem mobilidade nas rotações de rio e selva encadeando controles de grupo à distância antes de Dragão e Barão.`,
    );
  }
  if (eS.poke >= 58 && aS.engage < eS.engage) {
    allyWinConditions.push(
      `Evitar ficar agrupado sofrendo poke gratuito antes do objetivo nascer; chegar primeiro ao rio, limpar sentinelas e forçar o time adversário a avançar no seu counter-engage.`,
    );
  }
  if (allyWinConditions.length === 0) {
    allyWinConditions.push(
      `Jogar em torno dos picos de poder dos itens principais e sincronizar controles de grupo sobre o alvo mais exposto.`,
    );
  }

  // Win Conditions — Equipe Adversária
  if (enemyAssassins.length > 0) {
    const enemyAssNames = formatNameList(enemyAssassins.map((m) => m.profile.champion.name));
    enemyWinConditions.push(
      `Encontrar flancos sem visão com ${enemyAssNames} para abater instantaneamente sua retaguarda antes que escudos e curas façam efeito.`,
    );
  }
  if (eS.poke >= 58 || eS.siege >= 65) {
    const enemyPokers = formatNameList(eC.poke) || 'a linha de alcance inimiga';
    enemyWinConditions.push(
      `Estabelecer cerco e desgaste à distância com ${enemyPokers} para deixar sua equipe com pouca vida antes da luta começar.`,
    );
  }
  if (eC.engage.length > 0) {
    const enemyEngagers = formatNameList(eC.engage);
    enemyWinConditions.push(
      `Forçar iniciações em área com ${enemyEngagers} sobre alvos agrupados, abrindo espaço para o dano explosivo dos carregadores adversários.`,
    );
  }
  if (eC.peel.length > 0) {
    const enemyPeelers = formatNameList(eC.peel);
    enemyWinConditions.push(
      `Usar a proteção e escudos de ${enemyPeelers} para manter os carregadores inimigos vivos e neutralizar avanços isolados.`,
    );
  }
  if (enemyWinConditions.length === 0) {
    enemyWinConditions.push(
      `Acumular vantagem nas rotas e converter abates isolados em controle de objetivos neutros.`,
    );
  }

  return {
    allyWinConditions,
    enemyWinConditions,
    insights,
  };
}
