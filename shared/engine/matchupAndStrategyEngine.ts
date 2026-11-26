import {
  ROLE_LABELS,
  type AllySynergyDetail,
  type ChampionData,
  type EnemyThreatDetail,
  type ItemData,
  type MatchupAnalysisResult,
  type Role,
  type StrategyGuideResult,
  type TeamCompositionMetrics,
} from '../types.ts';
import type { ChampionTacticalProfile } from './championProfiler.ts';
import type { ProfiledTeamMember } from './compositionEngine.ts';
import { formatNameList } from './textValidator.ts';

export function generateMatchupAndStrategy(params: {
  userProfile: ChampionTacticalProfile;
  userRole: Role;
  allyMembers: ProfiledTeamMember[];
  enemyMembers: ProfiledTeamMember[];
  allyMetrics: TeamCompositionMetrics;
  enemyMetrics: TeamCompositionMetrics;
  recommendedItems: ItemData[];
  situationalItems: ItemData[];
}): {
  matchups: MatchupAnalysisResult;
  strategy: StrategyGuideResult;
} {
  const {
    userProfile,
    userRole,
    allyMembers,
    enemyMembers,
    allyMetrics,
    enemyMetrics,
    recommendedItems,
    situationalItems,
  } = params;
  const candidateCounterPool = Array.from(
    new Map([...recommendedItems, ...situationalItems].map((i) => [i.id, i])).values(),
  );

  // Identify direct lane opponents (for ADC/SUPPORT consider both Bot lane enemies!)
  const directRoles: Role[] =
    userRole === 'ADC' || userRole === 'SUPPORT' ? ['ADC', 'SUPPORT'] : [userRole];
  const directOpponents = enemyMembers
    .filter((m) => directRoles.includes(m.role))
    .map((m) => m.profile.champion);

  // Build detailed threat breakdown for ALL enemy champions in the draft (not only same lane!)
  const enemyThreats: EnemyThreatDetail[] = enemyMembers
    .map((em) => {
      const ep = em.profile;
      const isDirect = directRoles.includes(em.role);

      // Threat score to user & user's team
      let threatScore = 40;
      if (['ad_assassin', 'ap_assassin', 'diver'].includes(ep.archetype) && userProfile.ratings.tankiness <= 5) {
        threatScore += 32;
      }
      if (ep.ratings.hardCC >= 6.5) threatScore += 14;
      if (ep.ratings.poke >= 7.0 && userProfile.ratings.sustainHealShield < 6) threatScore += 12;
      if (ep.ratings.burst >= 7.5) threatScore += 14;
      if (ep.ratings.tankiness >= 8.0) threatScore += 10;
      if (isDirect) threatScore += 8;
      threatScore = Math.min(99, threatScore);

      const threatLevel: EnemyThreatDetail['threatLevel'] =
        threatScore >= 78
          ? 'CRÍTICO'
          : threatScore >= 62
            ? 'ALTO'
            : threatScore >= 48
              ? 'MODERADO'
              : 'CONTROLÁVEL';

      // Extract dangerous spells directly from the enemy champion's real Data Dragon spells!
      const dangerousSpells = ep.champion.spells
        .map((sp) => {
          let priority = sp.keySlot === 'R' ? 10 : 0;
          if (sp.detectedCC.length > 0) priority += 6;
          if (sp.hasDash) priority += 3;
          if (sp.hasShield || sp.hasHeal) priority += 3;

          let whyDangerous = '';
          if (sp.keySlot === 'R') {
            whyDangerous = `Ultimate de alto impacto (${sp.detectedCC.join(', ') || 'execução/iniciação'}): define o momento de engajar ou usar suas ferramentas defensivas.`;
          } else if (sp.detectedCC.length > 0) {
            whyDangerous = `Aplica ${sp.detectedCC.join(' / ')} — ser atingido abre espaço para cadeia de burst da equipe inimiga.`;
          } else if (sp.hasDash) {
            whyDangerous = `Ferramenta de mobilidade/reposicionamento: aguarde ele gastar ${sp.name} antes de lançar skillshots lentas.`;
          } else if (sp.hasShield || sp.hasHeal) {
            whyDangerous = `Proteção/sustentação ativa que pode anular tentativas de abate rápido.`;
          } else {
            whyDangerous = sp.cleanDescription.slice(0, 110);
          }

          return {
            priority,
            entry: {
              keySlot: sp.keySlot,
              name: sp.name,
              imageFull: sp.imageFull,
              cooldown: `${sp.cooldownBurn}s`,
              whyDangerous,
            },
          };
        })
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 2)
        .map((x) => x.entry);

      const hardSpells = ep.champion.spells.filter((s) =>
        s.detectedCC.some((c) => c !== 'Lentidão' && c !== 'Cegueira'),
      );
      const canInterruptYou = hardSpells.length > 0 || ['ad_assassin', 'ap_assassin'].includes(ep.archetype);
      const interruptionDetail =
        hardSpells.length > 0
          ? `${ep.champion.name} pode interromper seu posicionamento ou canalizações com ${formatNameList(hardSpells.map((s) => `${s.name} (${s.keySlot})`))}.`
          : canInterruptYou
            ? `${ep.champion.name} força você a gastar suas habilidades defensivamente com ameaça letal de flanco.`
            : undefined;

      // Check where user has tactical advantage against this enemy
      const youHaveAdvantage =
        (userProfile.ratings.disengage >= 6.5 && ['vanguard', 'juggernaut', 'diver'].includes(ep.archetype)) ||
        (userProfile.ratings.antiTank >= 7 && ep.ratings.tankiness >= 7) ||
        (userProfile.ratings.poke >= 7 && !ep.isRanged && ep.ratings.mobility <= 4) ||
        (userProfile.ratings.sustainHealShield >= 7 && ep.ratings.poke >= 6 && ep.ratings.burst <= 6);

      const advantageDetail = youHaveAdvantage
        ? userProfile.ratings.disengage >= 6.5
          ? `Seu kit de desengaje e controle (${userProfile.champion.spells.filter((s) => s.detectedCC.length > 0).map((s) => s.keySlot).join('/')}) pune a entrada telegrafada de ${ep.champion.name}.`
          : userProfile.ratings.antiTank >= 7
            ? `${userProfile.champion.name} derrete a Vida e resistências de ${ep.champion.name} em lutas front-to-back.`
            : `Você consegue controlar a distância e recuperar o desgaste contra ${ep.champion.name}.`
        : undefined;

      // Pick 1–2 relevant counter items from the candidate pool
      const counterItems = candidateCounterPool
        .filter((it) => {
          const f = it.features;
          if (['ad_assassin', 'ap_assassin'].includes(ep.archetype) || ep.ratings.burst >= 7.5) {
            return f.aoeShieldActive || f.stasis || f.uniqueGroups.includes('LIFELINE') || it.id === '3869' || it.id === '3109';
          }
          if (ep.ratings.hardCC >= 6.5) {
            return it.id === '3222' || f.qssCleanse || f.tenacityPct > 0 || f.spellshield;
          }
          if (ep.ratings.tankiness >= 7.5) {
            return f.armorPenPct > 0 || f.magicPenPct > 0 || f.maxHpDamage || it.id === '4005' || it.id === '3107';
          }
          if (ep.ratings.sustainHealShield >= 6.5) {
            return f.grievousWounds || it.id === '4005';
          }
          if (ep.ratings.poke >= 6.5) {
            return f.aoeHealActive || it.id === '2065' || f.lifeStealPct > 0;
          }
          return false;
        })
        .slice(0, 2);

      // Personalized contextual role summary
      let summary = '';
      if (['ad_assassin', 'ap_assassin'].includes(ep.archetype)) {
        summary = `${ep.champion.name} (${ROLE_LABELS[em.role]}) é uma ameaça letal à sua retaguarda: buscará flancos sem visão para eliminar você ou seu ADC antes da luta começar.`;
      } else if (['vanguard', 'warden'].includes(ep.archetype)) {
        summary = `${ep.champion.name} (${ROLE_LABELS[em.role]}) atua como linha de frente resistente e iniciador à distância; evite agrupar em corredores estreitos contra seu controle de área.`;
      } else if (ep.archetype === 'enchanter') {
        summary = `${ep.champion.name} (${ROLE_LABELS[em.role]}) fornece escudos, proteção e utilidade que sustentam os carregadores adversários em trocas médias.`;
      } else if (ep.archetype === 'artillery_mage' || ep.ratings.poke >= 7) {
        summary = `${ep.champion.name} (${ROLE_LABELS[em.role]}) impõe forte pressão de alcance, armadilhas/poke e potencial de pickoff à distância.`;
      } else if (ep.archetype.includes('marksman')) {
        summary = `${ep.champion.name} (${ROLE_LABELS[em.role]}) controla zonas de cerco e causa alto dano contínuo se não for pressionado ou desengajado.`;
      } else {
        summary = `${ep.champion.name} (${ROLE_LABELS[em.role]}) pressiona lutas de meio de jogo como ${ep.archetypeLabel}.`;
      }

      return {
        champion: ep.champion,
        role: em.role,
        threatLevel,
        threatScore,
        isDirectLaneOpponent: isDirect,
        summary,
        dangerousSpells,
        canInterruptYou,
        interruptionDetail,
        youHaveAdvantage,
        advantageDetail,
        counterItems,
      };
    })
    .sort((a, b) => b.threatScore - a.threatScore);

  const interrupters = enemyThreats
    .filter((t) => t.canInterruptYou && t.interruptionDetail)
    .map((t) => ({ championName: t.champion.name, detail: t.interruptionDetail! }));

  const favorableTargets = enemyThreats
    .filter((t) => t.youHaveAdvantage && t.advantageDetail)
    .map((t) => ({ championName: t.champion.name, detail: t.advantageDetail! }));

  // Ally Synergies
  const allySynergies: AllySynergyDetail[] = allyMembers
    .filter((am) => am.profile.champion.id !== userProfile.champion.id)
    .map((am) => {
      const ap = am.profile;
      let synergyScore = 60;
      const reasons: string[] = [];

      if (userProfile.archetype === 'enchanter' && ['skirmisher', 'crit_marksman', 'onhit_marksman', 'caster_marksman', 'battle_mage'].includes(ap.archetype)) {
        synergyScore += 28;
        reasons.push(
          `Suas curas, Velocidade de Movimento e fortalecimentos permitem que ${ap.champion.name} cause DPS máximo com segurança e alcance seus alvos.`,
        );
      }
      if (userProfile.ratings.hardCC >= 5 && ap.ratings.hardCC >= 4) {
        synergyScore += 14;
        reasons.push(
          `Excelente encadeamento de controle de grupo (CC chain): quando um imobilizar o alvo, o outro confirma sua habilidade sem margem de esquiva.`,
        );
      }
      if (ap.ratings.tankiness >= 7 && userProfile.ratings.tankiness <= 4.5) {
        synergyScore += 12;
        reasons.push(
          `${ap.champion.name} absorve a pressão frontal para que ${userProfile.champion.name} opere com espaço na retaguarda.`,
        );
      }
      if (reasons.length === 0) {
        reasons.push(
          `Sincronize tempos de recarga de ultimate com ${ap.champion.name} durante disputas de rio e cerco.`,
        );
      }

      synergyScore = Math.min(98, synergyScore);
      const synergyLevel: AllySynergyDetail['synergyLevel'] =
        synergyScore >= 82 ? 'FORTE' : synergyScore >= 68 ? 'BOA' : 'PADRÃO';

      return {
        champion: ap.champion,
        role: am.role,
        synergyScore,
        synergyLevel,
        comboExplanation: reasons[0],
        keyAllySpells: ap.champion.spells.slice(0, 2).map((s) => ({
          keySlot: s.keySlot,
          name: s.name,
          imageFull: s.imageFull,
        })),
      };
    })
    .sort((a, b) => b.synergyScore - a.synergyScore);

  // Lane matchup summary
  const oppNames = directOpponents.map((c) => c.name).join(' + ') || 'Adversário de Rota';
  const oppPokeHigh = enemyMembers
    .filter((m) => directRoles.includes(m.role))
    .some((m) => m.profile.ratings.poke >= 6.8 || (m.profile.champion.stats?.attackrange ?? 0) >= 620);

  const laneTradingRules: string[] = [];
  if (oppPokeHigh) {
    laneTradingRules.push(
      `Contra o alto alcance de ${oppNames}, evite disputar empurrão cego no nível 1 se isso custar metade da sua Vida; troque apenas quando uma habilidade chave de controle/armadilha inimiga estiver em recarga.`,
    );
    laneTradingRules.push(
      `Use os arbustos laterais e sentinelas para quebrar a linha de visão e punir passos avançados com trocas curtas sustentadas.`,
    );
  } else {
    laneTradingRules.push(
      `Busque vantagem de nível 2 (primeira onda + 3 tropas corpo a corpo na rota inferior, ou 1ª onda + 1 tropa nas rotas solo) para ditar o ritmo das trocas contra ${oppNames}.`,
    );
    laneTradingRules.push(
      `Mantenha controle de visão no rio aos 02:50–03:15 para evitar que o caçador inimigo puna sua pressão.`,
    );
  }
  const enemyInitiationNames = formatNameList(
    enemyMembers.map((m) => m.profile.champion.name).slice(0, 3),
  );
  laneTradingRules.push(
    `No nível 6, respeite o alcance de iniciação de ${enemyInitiationNames || 'seus oponentes'}, sincronizando sua ultimate com o seu caçador ou parceiro de rota.`,
  );

  const matchups: MatchupAnalysisResult = {
    laneMatchupSummary: {
      title: `${userProfile.champion.name} (${ROLE_LABELS[userRole]}) vs ${oppNames}`,
      lanePosture: oppPokeHigh
        ? 'Trocas Curtas Calculadas e Respeito ao Alcance'
        : 'Pressão Controlada por Janelas de Recarga',
      directOpponents,
      keyTradingRules: laneTradingRules,
      levelPowerSpikes:
        userRole === 'SUPPORT' || userRole === 'ADC'
          ? 'Níveis 2, 3 e 6 na rota inferior: nunca force all-in se o adversário pegar nível 2 ou 6 primeiro.'
          : 'Níveis 3 e 6 + primeiro retorno à base com componente épico.',
    },
    enemyThreats,
    interrupters,
    favorableTargets,
    allySynergies,
  };

  // Strategy Guide (Requirement #8) — Never include the controlled champion in the list of allies they must protect!
  const topSynergyAlly = allySynergies[0];
  const biggestThreat = enemyThreats[0];

  const otherAllies = allyMembers.filter((m) => m.profile.champion.id !== userProfile.champion.id);
  const otherAllyCarries = otherAllies
    .filter(
      (m) =>
        m.role !== 'SUPPORT' &&
        !['enchanter', 'warden', 'vanguard', 'catcher'].includes(m.profile.archetype) &&
        (m.profile.ratings.sustainedDps >= 5.5 || m.profile.ratings.burst >= 6.5),
    )
    .sort((a, b) => {
      const aIsAdc = a.role === 'ADC' ? 1 : 0;
      const bIsAdc = b.role === 'ADC' ? 1 : 0;
      if (aIsAdc !== bIsAdc) return bIsAdc - aIsAdc;
      return b.profile.ratings.sustainedDps - a.profile.ratings.sustainedDps;
    });

  const userIsPrimaryCarry =
    userRole === 'ADC' ||
    (['MID', 'JUNGLE', 'TOP'].includes(userRole) &&
      ['crit_marksman', 'onhit_marksman', 'caster_marksman', 'battle_mage', 'artillery_mage', 'burst_mage'].includes(
        userProfile.archetype,
      ) &&
      userProfile.ratings.tankiness <= 4.5);

  const allyCarryNamesToProtect = formatNameList(
    otherAllyCarries.slice(0, 2).map((m) => m.profile.champion.name),
    'e',
    [userProfile.champion.name],
  );

  const fallbackOtherAllyName = otherAllies[0]?.profile.champion.name || 'seus carregadores aliados';
  const protectTarget = allyCarryNamesToProtect || fallbackOtherAllyName;

  const whoToProtectInTeamfights =
    userIsPrimaryCarry && !allyCarryNamesToProtect
      ? {
          targetName: 'Seu próprio posicionamento na retaguarda',
          reason: `Como principal fonte de dano da composição com ${userProfile.champion.name}, sua prioridade máxima é manter-se vivo próximo à cobertura dos seus aliados até que as ameaças de avanço inimigo sejam contidas.`,
        }
      : {
          targetName: protectTarget,
          reason: `Manter ${protectTarget} seguro garante o dano sustentado necessário para atravessar a linha de frente adversária e vencer as lutas de equipe.`,
        };

  const enemyAbilitiesToTrack = enemyThreats.slice(0, 4).flatMap((t) =>
    t.dangerousSpells.slice(0, 1).map((sp) => ({
      championName: t.champion.name,
      spellKey: sp.keySlot,
      spellName: sp.name,
      imageFull: sp.imageFull,
      instruction: sp.whyDangerous,
    })),
  );

  const ownAbilitiesToHold = userProfile.champion.spells
    .filter((sp) => sp.detectedCC.length > 0 || sp.hasHeal || sp.hasShield || sp.keySlot === 'R')
    .slice(0, 3)
    .map((sp) => ({
      spellKey: sp.keySlot,
      spellName: sp.name,
      imageFull: sp.imageFull,
      instruction:
        sp.keySlot === 'R'
          ? `Guarde ${sp.name} (${sp.keySlot}) para parar o dive inimigo ou confirmar follow-up quando múltiplos alvos estiverem alinhados — não gaste à distância máxima sem garantia.`
          : sp.detectedCC.length > 0
            ? `Não desperdice ${sp.name} (${sp.keySlot}) tentando poke incerto se ${biggestThreat?.champion.name || 'um assassino inimigo'} estiver fora de visão pronto para pular na sua retaguarda.`
            : `Use ${sp.name} (${sp.keySlot}) no momento exato das trocas e para potencializar seu carregador ativo.`,
    }));

  const postureMode: StrategyGuideResult['recommendedPosture']['mode'] =
    enemyMetrics.scores.burst >= 64 && allyMetrics.scores.engage < enemyMetrics.scores.engage
      ? 'DEFENSIVA / ANTI-DIVE'
      : allyMetrics.scores.poke >= 65
        ? 'POKE E CERCO'
        : allyMetrics.scores.engage >= 65
          ? 'AGRESSIVA'
          : 'CONTROLADA / TRANSIÇÃO';

  const roleDirectives = buildRoleSpecificPlaybook(
    userRole,
    userProfile,
    biggestThreat?.champion.name || 'a ameaça principal inimiga',
    protectTarget,
    allyMembers,
    enemyMembers,
  );

  const missingThreatNames = formatNameList(
    enemyThreats.slice(0, 2).map((t) => t.champion.name),
    'ou',
  );

  const strategy: StrategyGuideResult = {
    allyToPrioritize: topSynergyAlly
      ? {
          championName: topSynergyAlly.champion.name,
          role: topSynergyAlly.role,
          reason: topSynergyAlly.comboExplanation,
        }
      : {
          championName: userProfile.champion.name,
          role: userRole,
          reason: 'Concentre recursos no seu próprio pico de 2 itens para ditar as lutas.',
        },
    biggestEnemyThreat: biggestThreat
      ? {
          championName: biggestThreat.champion.name,
          role: biggestThreat.role,
          reason: biggestThreat.summary,
        }
      : {
          championName: 'Carregador Adversário',
          role: 'MID',
          reason: 'Acompanhe na tabela de placar quem acumular mais ouro aos 14 minutos.',
        },
    whoToProtectInTeamfights,
    enemyAbilitiesToTrack,
    ownAbilitiesToHold,
    recommendedPosture: {
      mode: postureMode,
      explanation:
        postureMode === 'DEFENSIVA / ANTI-DIVE'
          ? `O adversário depende de encontrar flancos explosivos ou iniciações longas; jogar disciplinado em formação front-to-back anula o plano inimigo e favorece o DPS da sua equipe.`
          : postureMode === 'POKE E CERCO'
            ? `Desgaste o inimigo à distância antes do nascimento do objetivo e só comprometa recursos após forçar recuos.`
            : postureMode === 'AGRESSIVA'
              ? `Sua composição possui melhores ferramentas de iniciação; force lutas quando tiver visão superior e vantagem numérica.`
              : `Jogue pelas janelas de recarga e punição de posicionamento (counter-engage e pickoff) em vez de forçar mergulhos cegos.`,
    },
    teamWinCondition:
      allyMetrics.scores.antiTank >= 60
        ? `Controlar a visão do objetivo primeiro, sobreviver aos primeiros 3 segundos de explosão/iniciação inimiga com peel coordenado e deixar seus carregadores vencerem a luta prolongada.`
        : `Criar abates isolados nas rotações laterais antes de disputar Dragão e Barão.`,
    positioningGuide: userProfile.isRanged
      ? `Posicione-se em diagonal atrás da sua linha de frente, mantendo sentinelas nos flancos laterais para enxergar ${biggestThreat?.champion.name || 'avanços inimigos'} com antecedência e nunca fique alinhado na mesma reta de controles de grupo em área.`
      : `Atue na linha de contenção/vanguarda da sua equipe, controlando o espaço de entrada dos carregadores inimigos sem se isolar além do alcance de suporte dos seus aliados.`,
    whatToAvoid: [
      `Entrar sozinho na selva ou rio sem visão (facecheck) quando ${missingThreatNames || 'os inimigos'} estiverem desaparecidos do minimapa.`,
      `Gastar seu principal controle de grupo como tentativa especulativa de longa distância imediatamente antes de ${biggestThreat?.champion.name || 'o assassino inimigo'} saltar no seu carregador.`,
      `Ficar agrupado parado sob alcance de poke/armadilhas adversárias aguardando o objetivo nascer sem sustentação.`,
    ],
    roleSpecificPlaybook: roleDirectives,
  };

  return { matchups, strategy };
}

function buildRoleSpecificPlaybook(
  role: Role,
  userProfile: ChampionTacticalProfile,
  biggestThreatName: string,
  protectTarget: string,
  allyMembers: ProfiledTeamMember[],
  enemyMembers: ProfiledTeamMember[],
): StrategyGuideResult['roleSpecificPlaybook'] {
  switch (role) {
    case 'SUPPORT':
      return {
        roleTitle: `Plano Tático de Suporte — ${userProfile.champion.name}`,
        directives: [
          {
            topic: 'Peel e Proteção da Retaguarda',
            guidance: `Fique a 400–550 unidades de ${protectTarget} nas lutas. Assim que ${biggestThreatName} iniciar o mergulho, aplique Exaustão/escudo imediatamente e posicione seu controle de grupo no ponto exato de aterrissagem dele.`,
          },
          {
            topic: 'Iniciação vs Counter-Engage',
            guidance: `Prefira usar sua ultimate como counter-engage (quebrando a entrada inimiga no meio do caminho) ou como follow-up garantido sobre um alvo já desacelerado/enraizado por um aliado.`,
          },
          {
            topic: 'Gerenciamento de Habilidades e Mana',
            guidance: `Evite esgotar sua Mana curando pequenos arranhões fora de combate; chegue aos objetivos com pelo menos 60% de Mana e todas as ativas de itens (Redenção/Solari/Mikael) prontas.`,
          },
          {
            topic: 'Controle de Visão Seguro',
            guidance: `Ilumine os flancos laterais (paredes da selva) por onde assassinos e tanques buscam ângulos, sempre acompanhado do seu caçador ou mid laner.`,
          },
        ],
      };
    case 'ADC':
      return {
        roleTitle: `Plano Tático de Atirador (ADC) — ${userProfile.champion.name}`,
        directives: [
          {
            topic: 'Espaçamento e Regra dos 3 Segundos',
            guidance: `Aguarde as principais habilidades de iniciação/assassino (${biggestThreatName}) aparecerem no mapa antes de avançar para dar ataques básicos livres.`,
          },
          {
            topic: 'Seleção de Alvos (Front-to-Back)',
            guidance: `Ataque o alvo mais próximo que esteja ao seu alcance com segurança — nunca atravesse a linha de frente inimiga para perseguir a retaguarda adversária.`,
          },
          {
            topic: 'Sincronia com a Proteção Aliada',
            guidance: `Não recue para longe do seu suporte quando sofrer dive; caminhe na direção dele para receber escudos, curas e cobertura de controle de grupo.`,
          },
        ],
      };
    case 'JUNGLE':
      return {
        roleTitle: `Plano Tático de Caçador (Jungle) — ${userProfile.champion.name}`,
        directives: [
          {
            topic: 'Condições de Gank por Rota',
            guidance: `Priorize ganks em rotas aliadas que possuam controle de grupo confiável (${allyMembers.filter((m) => m.role !== 'JUNGLE' && m.profile.ratings.hardCC >= 5).map((m) => m.profile.champion.name).join(', ') || 'suas rotas fortes'}) e evite forçar dives cedo contra tanques imóveis com ultimate disponível.`,
          },
          {
            topic: 'Controle de Objetivos Neutros',
            guidance: `Converta prioridade do Mid e Bot em Dragões; contra composições de alto poke inimigo, inicie o objetivo somente após limpar sentinelas do covil e varrer os acessos laterais.`,
          },
          {
            topic: 'Entrada nas Teamfights',
            guidance:
              userProfile.archetype === 'skirmisher' || userProfile.archetype.includes('assassin')
                ? `NÃO seja o primeiro a entrar: aguarde 2–3 segundos até os controles de grupo inimigos serem gastos e entre para limpar a luta e obter resets.`
                : `Lidere a zona do rio e proteja seu Golpear contra tentativas de roubo à distância.`,
          },
        ],
      };
    case 'MID':
      return {
        roleTitle: `Plano Tático de Rota do Meio (Mid) — ${userProfile.champion.name}`,
        directives: [
          {
            topic: 'Prioridade de Onda e Rotações',
            guidance: `Empurre a onda antes de rotacionar para o rio; contra assassinos (${biggestThreatName}), comunique desaparecimentos imediatamente e puna o roaming dele empurrando barricadas ou seguindo por rota segura com visão.`,
          },
          {
            topic: 'Rota Lateral no Meio de Jogo',
            guidance: `Após a queda da primeira torre da bot lane, assuma a rota lateral segura correspondente ao próximo objetivo (com Teleporte ou visão no rio) sem avançar além do meio sem cobertura.`,
          },
          {
            topic: 'Papel nas Lutas 5v5',
            guidance: `Controle os corredores estreitos da selva/rio com suas habilidades de zona, punindo tanques que avançarem desconectados da retaguarda inimiga.`,
          },
        ],
      };
    case 'TOP':
    default:
      return {
        roleTitle: `Plano Tático de Rota Superior (Top) — ${userProfile.champion.name}`,
        directives: [
          {
            topic: 'Gestão de Matchup e Ondas',
            guidance: `Contra tanques de escala (${enemyMembers.find((m) => m.role === 'TOP')?.profile.champion.name || 'o Top adversário'}), congele ondas próximas à sua torre ou empurre ondas grandes para invadir/rotacionar nas Vastilarvas.`,
          },
          {
            topic: 'Pressão Lateral vs Agrupamento',
            guidance: `Pressione a rota oposta ao objetivo principal 45s antes do nascimento para forçar resposta inimiga e conecte à luta por Teleporte ou flanco.`,
          },
          {
            topic: 'Função na Teamfight',
            guidance: `Absorva espaço na linha de frente ou ameace o flanco dos carregadores imóveis adversários sem abandonar completamente seus próprios carregadores caso precisem de peel.`,
          },
        ],
      };
  }
}
