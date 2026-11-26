import { describe, expect, it, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  deleteChampionPoolEntry,
  deleteDraftHistoryEntry,
  getAllChampionsFromDb,
  getAllItemsFromDb,
  getAllRunesFromDb,
  getAllSummonersFromDb,
  getChampionPool,
  getDraftHistory,
  getNetworkLogs,
  getUserPreferences,
  saveDraftHistoryEntry,
  saveUserPreferences,
  upsertChampionPoolEntry,
} from '../server/db.ts';
import { checkLatestRemoteVersion, syncDataDragon } from '../server/ddragonSync.ts';
import { buildGovernanceReport } from '../server/index.ts';
import { getOfficialStatShards } from '../shared/ddragonParser.ts';
import { analyzeFullDraft, type StaticGameCatalog } from '../shared/engine/analyzeDraft.ts';
import {
  applyComposition,
  assignChampion,
  countPicks,
  createEmptyDraftState,
  findChampionUsage,
  setControlledRole,
} from '../shared/draftState.ts';
import { DEMO_SCENARIOS } from '../shared/demoScenarios.ts';
import { filterChampions } from '../shared/championFilter.ts';
import {
  findOutOfDraftChampionMentions,
  formatNameList,
  sanitizeSentenceChampionMentions,
} from '../shared/engine/textValidator.ts';
import { ROLES, type DraftState } from '../shared/types.ts';

let catalog: StaticGameCatalog;

const BASE_LIVE = {
  enabled: false,
  minute: 12,
  availableGold: 1000,
  purchasedItemIds: [],
  laneOutcome: 'even' as const,
  gameState: 'even' as const,
  fedEnemyId: null,
  carryingAllyId: null,
};

beforeAll(() => {
  catalog = {
    champions: getAllChampionsFromDb(),
    items: getAllItemsFromDb(true),
    runeTrees: getAllRunesFromDb(),
    statShards: getOfficialStatShards(),
    summoners: getAllSummonersFromDb(),
    governance: buildGovernanceReport(),
  };
});

describe('1. Integridade dos Dados Oficiais Riot Data Dragon & Filtragem Mapa 11', () => {
  it('carrega todos os campeões, árvores de runas, feitiços e itens válidos do Summoner’s Rift em pt_BR', () => {
    expect(catalog.champions.length).toBeGreaterThanOrEqual(170);
    expect(catalog.runeTrees.length).toBe(5);
    expect(catalog.summoners.length).toBeGreaterThanOrEqual(8);
    expect(catalog.items.length).toBeGreaterThanOrEqual(190);

    const nami = catalog.champions.find((c) => c.id === 'Nami');
    expect(nami).toBeDefined();
    expect(nami!.spells.length).toBe(4);
    expect(nami!.spells[0].name).toContain('Prisão Aquática');
  });

  it('rejeita itens de modos alternativos (IDs de 6 dígitos Arena/Brawl), itens não compráveis e valida receitas', () => {
    const itemMap = new Map(catalog.items.map((i) => [i.id, i]));
    for (const item of catalog.items) {
      expect(item.id.length).toBe(4);
      expect(item.srValid).toBe(true);
      expect(item.purchasable).toBe(true);
      for (const compId of item.from) {
        expect(compId.length).toBe(4);
      }
    }
    // Redenção real (3107) deve existir e a cópia 323107 não deve estar no catálogo SR
    expect(itemMap.has('3107')).toBe(true);
    expect(itemMap.has('323107')).toBe(false);
    expect(itemMap.has('663146')).toBe(false);
  });
});

describe('2. Cenário Obrigatório: Garen, Master Yi, Cassiopeia, Jhin e Nami vs Ornn, Ivern, Zed, Caitlyn e Lux (Nami Support)', () => {
  it('reconhece distribuição de dano, ameaças de Zed/Lux, frontline de Ornn, proteção de Ivern e necessidades contextuais da Nami', () => {
    const draft: DraftState = {
      allyTeam: {
        TOP: 'Garen',
        JUNGLE: 'MasterYi',
        MID: 'Cassiopeia',
        ADC: 'Jhin',
        SUPPORT: 'Nami',
      },
      enemyTeam: {
        TOP: 'Ornn',
        JUNGLE: 'Ivern',
        MID: 'Zed',
        ADC: 'Caitlyn',
        SUPPORT: 'Lux',
      },
      userRole: 'SUPPORT',
      userChampionId: 'Nami',
      liveSituation: BASE_LIVE,
    };

    const result = analyzeFullDraft(draft, catalog);
    expect(result).not.toBeNull();
    const res = result!;

    // Distribuição híbrida de dano da equipe aliada (AD de Jhin/Yi/Garen + AP de Cassiopeia + Real de Yi/Garen)
    expect(res.allyMetrics.damageShare.physical).toBeGreaterThan(30);
    expect(res.allyMetrics.damageShare.magic).toBeGreaterThan(20);
    expect(res.allyMetrics.damageShare.trueDamage).toBeGreaterThanOrEqual(8);

    // Reconhecimento das características inimigas: Ornn frontline, Ivern peel/sustain, Zed assassino, Caitlyn/Lux poke & CC
    expect(res.enemyMetrics.keyContributors.frontline).toContain('Ornn');
    expect(res.enemyMetrics.keyContributors.peel).toContain('Ivern');
    expect(res.enemyMetrics.keyContributors.burst).toContain('Zed');
    expect(res.enemyMetrics.keyContributors.poke).toEqual(expect.arrayContaining(['Lux', 'Caitlyn']));

    // Matchups devem analisar TODOS os 5 adversários (não apenas Lux!)
    expect(res.matchups.enemyThreats.length).toBe(5);
    const zedThreat = res.matchups.enemyThreats.find((t) => t.champion.id === 'Zed');
    const ornnThreat = res.matchups.enemyThreats.find((t) => t.champion.id === 'Ornn');
    const ivernThreat = res.matchups.enemyThreats.find((t) => t.champion.id === 'Ivern');
    expect(zedThreat).toBeDefined();
    expect(['CRÍTICO', 'ALTO']).toContain(zedThreat!.threatLevel);
    expect(ornnThreat!.summary).toContain('linha de frente');
    expect(ivernThreat!.summary).toContain('escudos');

    // Build da Nami: Atlas Mundial (3865) + Oposição Celestial (3869) anti-burst contra Zed + itens reais de suporte/utilidade
    const slotIds = res.build.slots.map((s) => s.item.id);
    expect(slotIds[0]).toBe('3865'); // Atlas Mundial
    expect(slotIds[1]).toBe('3869'); // Oposição Celestial contra assassino/burst

    // Deve conter proteção/purificação/amplificação coerente (ex: Mandato Imperial, Solari, Mikael, Redenção ou Aquafluxo)
    const coreUtilityMatches = slotIds.filter((id) =>
      ['4005', '3190', '3222', '3107', '6617', '6616'].includes(id),
    );
    expect(coreUtilityMatches.length).toBeGreaterThanOrEqual(4);

    // Runas da Nami contra assassino (Zed) + poke (Lux/Caitlyn): Exaustão e Determinação secundária
    const summIds = res.runes.recommended.summonerSpells.map((s) => s.id);
    expect(summIds).toContain('SummonerExhaust');
    expect(res.runes.recommended.secondaryTree.key).toBe('Resolve');
  });
});

describe('3. Diferentes Composições, Restrições de Campeões e Sensibilidade Contextual', () => {
  it('detecta sobrecarga de dano físico (Full AD) e prioriza Penetração de Armadura contra tanques', () => {
    const draft: DraftState = {
      allyTeam: {
        TOP: 'Darius',
        JUNGLE: 'LeeSin',
        MID: 'Zed',
        ADC: 'Caitlyn',
        SUPPORT: 'Pyke',
      },
      enemyTeam: {
        TOP: 'Malphite',
        JUNGLE: 'Rammus',
        MID: 'Galio',
        ADC: 'Ezreal',
        SUPPORT: 'Leona',
      },
      userRole: 'ADC',
      userChampionId: 'Caitlyn',
      liveSituation: BASE_LIVE,
    };

    const res = analyzeFullDraft(draft, catalog)!;
    expect(res.allyMetrics.damageShare.physical).toBeGreaterThanOrEqual(70);
    expect(res.insights.some((i) => i.title.includes('Sobrecarga de Dano Físico'))).toBe(true);

    // Caitlyn deve receber item com % Penetração de Armadura (Lorde Dominik 3036 ou Lembrete Mortal 3033) e Purificar contra Leona/Rammus/Malphite/Galio
    const hasArmorPenPct = res.build.slots.some((s) => s.item.features.armorPenPct > 0);
    expect(hasArmorPenPct).toBe(true);
    expect(res.runes.recommended.summonerSpells.map((s) => s.id)).toContain('SummonerBoost');
  });

  it('detecta sobrecarga de dano mágico (Full AP) e recomenda Penetração Mágica percentual contra tanques', () => {
    const draft: DraftState = {
      allyTeam: {
        TOP: 'Mordekaiser',
        JUNGLE: 'Lillia',
        MID: 'Syndra',
        ADC: 'Ziggs',
        SUPPORT: 'Lux',
      },
      enemyTeam: {
        TOP: 'Ornn',
        JUNGLE: 'Sejuani',
        MID: 'Galio',
        ADC: 'Jhin',
        SUPPORT: 'TahmKench',
      },
      userRole: 'MID',
      userChampionId: 'Syndra',
      liveSituation: BASE_LIVE,
    };

    const res = analyzeFullDraft(draft, catalog)!;
    expect(res.allyMetrics.damageShare.magic).toBeGreaterThanOrEqual(75);
    expect(res.insights.some((i) => i.title.includes('Sobrecarga de Dano Mágico'))).toBe(true);
    expect(res.build.slots.some((s) => s.item.features.magicPenPct > 0)).toBe(true);
  });

  it('ativa Feridas Dolorosas contra composição de alta cura e sustentação (Soraka + Aatrox + Vladimir + Briar)', () => {
    const draft: DraftState = {
      allyTeam: {
        TOP: 'Ornn',
        JUNGLE: 'JarvanIV',
        MID: 'Viktor',
        ADC: 'Ashe',
        SUPPORT: 'Braum',
      },
      enemyTeam: {
        TOP: 'Aatrox',
        JUNGLE: 'Briar',
        MID: 'Vladimir',
        ADC: 'Samira',
        SUPPORT: 'Soraka',
      },
      userRole: 'MID',
      userChampionId: 'Viktor',
      liveSituation: BASE_LIVE,
    };

    const res = analyzeFullDraft(draft, catalog)!;
    expect(res.enemyMetrics.scores.sustain).toBeGreaterThanOrEqual(60);
    const gwSituational = res.build.situationalItems.find((s) => s.item.features.grievousWounds);
    expect(gwSituational).toBeDefined();
    expect(gwSituational!.isTriggeredByCurrentDraft).toBe(true);
  });

  it('respeita restrições mecânicas: Cassiopeia nunca compra Botas, Garen/Zed nunca compram Mana, Master Yi Jungle recebe Golpear e Pet', () => {
    // Cassiopeia
    const cassRes = analyzeFullDraft(
      {
        allyTeam: { TOP: 'Garen', JUNGLE: 'MasterYi', MID: 'Cassiopeia', ADC: 'Jhin', SUPPORT: 'Nami' },
        enemyTeam: { TOP: 'Ornn', JUNGLE: 'Ivern', MID: 'Zed', ADC: 'Caitlyn', SUPPORT: 'Lux' },
        userRole: 'MID',
        userChampionId: 'Cassiopeia',
        liveSituation: BASE_LIVE,
      },
      catalog,
    )!;
    expect(cassRes.build.slots.some((s) => s.slotKey === 'boots')).toBe(false);
    expect(cassRes.build.slots.some((s) => s.item.tags.includes('Boots'))).toBe(false);
    expect(cassRes.build.uniquePassiveNotes.some((n) => n.includes('Cassiopeia'))).toBe(true);

    // Zed (Energia, sem Mana)
    const zedRes = analyzeFullDraft(
      {
        allyTeam: { TOP: 'Ornn', JUNGLE: 'Ivern', MID: 'Zed', ADC: 'Caitlyn', SUPPORT: 'Lux' },
        enemyTeam: { TOP: 'Garen', JUNGLE: 'MasterYi', MID: 'Cassiopeia', ADC: 'Jhin', SUPPORT: 'Nami' },
        userRole: 'MID',
        userChampionId: 'Zed',
        liveSituation: BASE_LIVE,
      },
      catalog,
    )!;
    for (const s of zedRes.build.slots) {
      expect(s.item.features.mana).toBeLessThan(300);
      expect(s.item.features.uniqueGroups).not.toContain('TEAR_AWE');
    }

    // Master Yi Jungle
    const yiRes = analyzeFullDraft(
      {
        allyTeam: { TOP: 'Garen', JUNGLE: 'MasterYi', MID: 'Cassiopeia', ADC: 'Jhin', SUPPORT: 'Nami' },
        enemyTeam: { TOP: 'Ornn', JUNGLE: 'Ivern', MID: 'Zed', ADC: 'Caitlyn', SUPPORT: 'Lux' },
        userRole: 'JUNGLE',
        userChampionId: 'MasterYi',
        liveSituation: BASE_LIVE,
      },
      catalog,
    )!;
    expect(yiRes.build.slots[0].item.category).toBe('jungle_pet');
    expect(yiRes.runes.recommended.summonerSpells.map((s) => s.id)).toContain('SummonerSmite');
    expect(yiRes.build.slots.some((s) => s.item.id === '3085')).toBe(false); // Runaan's ranged only
  });

  it('muda runas e feitiços para o mesmo campeão quando a composição adversária muda (sem páginas estáticas fixas)', () => {
    const namiVsAssassins = analyzeFullDraft(
      {
        allyTeam: { TOP: 'Shen', JUNGLE: 'JarvanIV', MID: 'Orianna', ADC: 'Jinx', SUPPORT: 'Nami' },
        enemyTeam: { TOP: 'Camille', JUNGLE: 'Rengar', MID: 'Zed', ADC: 'Draven', SUPPORT: 'Pyke' },
        userRole: 'SUPPORT',
        userChampionId: 'Nami',
        liveSituation: BASE_LIVE,
      },
      catalog,
    )!;

    const namiVsPassiveScaling = analyzeFullDraft(
      {
        allyTeam: { TOP: 'Shen', JUNGLE: 'JarvanIV', MID: 'Orianna', ADC: 'Jinx', SUPPORT: 'Nami' },
        enemyTeam: { TOP: 'Nasus', JUNGLE: 'Ivern', MID: 'Kassadin', ADC: 'Smolder', SUPPORT: 'Sona' },
        userRole: 'SUPPORT',
        userChampionId: 'Nami',
        liveSituation: BASE_LIVE,
      },
      catalog,
    )!;

    // Contra 4 assassinos/divers usa Determinação + Exaustão + Oposição Celestial; contra composição passiva de cura usa Inspiração e evolução/feitiço diferente
    expect(namiVsAssassins.runes.recommended.secondaryTree.key).not.toBe(
      namiVsPassiveScaling.runes.recommended.secondaryTree.key,
    );
    expect(namiVsAssassins.build.slots[1].item.id).not.toBe(namiVsPassiveScaling.build.slots[1].item.id);
  });
});

describe('4. Modo Adaptável "Atualizar Situação da Partida" e Auditoria de Isolamento Vanguard', () => {
  it('recalcula o próximo componente comprável respeitando o ouro disponível e os itens já comprados', () => {
    const res = analyzeFullDraft(
      {
        allyTeam: { TOP: 'Garen', JUNGLE: 'MasterYi', MID: 'Cassiopeia', ADC: 'Jhin', SUPPORT: 'Nami' },
        enemyTeam: { TOP: 'Ornn', JUNGLE: 'Ivern', MID: 'Zed', ADC: 'Caitlyn', SUPPORT: 'Lux' },
        userRole: 'SUPPORT',
        userChampionId: 'Nami',
        liveSituation: {
          enabled: true,
          minute: 15,
          availableGold: 1050,
          purchasedItemIds: ['3865', '3158', '3114'], // Atlas + Botas Ionianas + Ídolo Proibido
          laneOutcome: 'losing',
          gameState: 'behind',
          fedEnemyId: 'Zed',
          carryingAllyId: 'Cassiopeia',
        },
      },
      catalog,
    )!;

    const live = res.build.liveRecalculation!;
    expect(live).toBeDefined();
    expect(live.bestNextCompletedItem).not.toBeNull();
    expect(live.bestImmediateBuyComponents.totalSpend).toBeLessThanOrEqual(1050);
    expect(live.tacticalAdjustments.some((t) => t.includes('Zed'))).toBe(true);
    expect(live.tacticalAdjustments.some((t) => t.includes('Cassiopeia'))).toBe(true);
  });

  it('garante isolamento absoluto do League of Legends / Riot Vanguard em todo o código-fonte', () => {
    const dirsToAudit = ['server', 'shared', 'src'];
    const forbiddenPatterns = [
      /127\.0\.0\.1:2999/, // Live Client Data API
      /liveclientdata/i,
      /lol-champ-select/i, // LCU endpoint
      /lockfile/i, // Riot Client lockfile
      /ReadProcessMemory/i,
      /OpenProcess/i,
      /tasklist/i,
      /HKEY_LOCAL_MACHINE/i,
    ];

    function walkFiles(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const out: string[] = [];
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...walkFiles(full));
        else if (/\.(ts|tsx|js)$/.test(e.name)) out.push(full);
      }
      return out;
    }

    const root = path.resolve(__dirname, '..');
    for (const sub of dirsToAudit) {
      const files = walkFiles(path.join(root, sub));
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        for (const pat of forbiddenPatterns) {
          expect(pat.test(content), `Padrão proibido ${pat} encontrado em ${file}`).toBe(false);
        }
      }
    }
  });
});

describe('5. Sincronização Data Dragon, Persistência SQLite (Champion Pool, Histórico, Preferências) e Governança', () => {
  it('verifica versão remota do Data Dragon e sincroniza de forma idempotente sem recriar banco manualmente', async () => {
    const versionCheck = await checkLatestRemoteVersion();
    expect(versionCheck.syncedVersion).toBeTruthy();
    if (!versionCheck.offline) {
      expect(versionCheck.latestRemoteVersion).toBe(versionCheck.syncedVersion);
      expect(versionCheck.isOutdated).toBe(false);
    }

    const syncReport = await syncDataDragon({ force: false });
    expect(syncReport.championsSynced).toBeGreaterThanOrEqual(170);
    expect(syncReport.srItemsSynced).toBeGreaterThanOrEqual(190);
    expect(syncReport.skippedUpToDate).toBe(true);
  });

  it('persiste e remove registros na Minha Champion Pool, Histórico de Análises e Alerta de Patch do Cliente sem poluir o banco inicial', () => {
    const hadNamiBefore = getChampionPool().some((p) => p.championId === 'Nami');
    upsertChampionPoolEntry({
      championId: 'Nami',
      roles: ['SUPPORT'],
      isFavorite: true,
      isMain: true,
      familiarity: 5,
      notes: 'Teste temporário SQLite',
      updatedAt: new Date().toISOString(),
    });

    const poolAfterAdd = getChampionPool();
    const namiEntry = poolAfterAdd.find((p) => p.championId === 'Nami');
    expect(namiEntry).toBeDefined();
    expect(namiEntry!.isMain).toBe(true);
    expect(namiEntry!.familiarity).toBe(5);

    const testHistoryId = 'test_draft_verification_1';
    saveDraftHistoryEntry({
      id: testHistoryId,
      title: 'Teste Automatizado Nami 5x5',
      notes: 'Verificação SQLite',
      patchVersion: catalog.governance.officialDdragon.activePatch,
      userRole: 'SUPPORT',
      userChampionId: 'Nami',
      allyTeam: { TOP: 'Garen', JUNGLE: 'MasterYi', MID: 'Cassiopeia', ADC: 'Jhin', SUPPORT: 'Nami' },
      enemyTeam: { TOP: 'Ornn', JUNGLE: 'Ivern', MID: 'Zed', ADC: 'Caitlyn', SUPPORT: 'Lux' },
      summaryVerdict: 'Jogar front-to-back protegendo Jhin e Cassiopeia contra Zed.',
      createdAt: new Date().toISOString(),
    });

    expect(getDraftHistory().some((h) => h.id === testHistoryId)).toBe(true);
    deleteDraftHistoryEntry(testHistoryId);
    expect(getDraftHistory().some((h) => h.id === testHistoryId)).toBe(false);

    // Simular patch do cliente mais novo para validar aviso de defasagem
    const prevPrefs = getUserPreferences();
    saveUserPreferences({ ...prevPrefs, knownClientPatch: '99.1' });
    const govWarning = buildGovernanceReport();
    expect(govWarning.officialDdragon.isOutdatedVsClientPatch).toBe(true);
    saveUserPreferences(prevPrefs);

    // Logs de conexões auditáveis devem apontar exclusivamente para ddragon.leagueoflegends.com
    const logs = getNetworkLogs(50);
    expect(logs.length).toBeGreaterThan(0);
    for (const log of logs) {
      expect(log.domain).toBe('ddragon.leagueoflegends.com');
    }

    // Limpar registro de teste para não deixar dados de teste no banco do usuário
    if (!hadNamiBefore) {
      deleteChampionPoolEntry('Nami');
    }
  });
});

describe('6. Estado Inicial Vazio do Draft, Seletor dos 173 Campeões e Recálculo Imediato', () => {
  it('inicia com os 10 espaços vazios, sem campeão controlado e sem análise fictícia ativa', () => {
    const initial = createEmptyDraftState();
    expect(initial.userRole).toBeNull();
    expect(initial.userChampionId).toBeNull();
    expect(countPicks(initial)).toEqual({ ally: 0, enemy: 0, total: 0 });
    for (const role of ROLES) {
      expect(initial.allyTeam[role]).toBeNull();
      expect(initial.enemyTeam[role]).toBeNull();
    }
    expect(analyzeFullDraft(initial, catalog)).toBeNull();
  });

  it('permite escolher, substituir, mover e remover qualquer campeão e definir explicitamente o campeão controlado', () => {
    let state = createEmptyDraftState();

    // Escolher Ahri no Mid aliado e definir como controlada
    state = assignChampion(state, 'ally', 'MID', 'Ahri', { controlled: true });
    expect(state.allyTeam.MID).toBe('Ahri');
    expect(state.userRole).toBe('MID');
    expect(state.userChampionId).toBe('Ahri');
    expect(countPicks(state).total).toBe(1);

    const firstAnalysis = analyzeFullDraft(state, catalog);
    expect(firstAnalysis).not.toBeNull();
    expect(firstAnalysis!.userChampion.id).toBe('Ahri');

    // Substituir Ahri por Viktor no Mid aliado -> análise recalcula imediatamente para Viktor
    state = assignChampion(state, 'ally', 'MID', 'Viktor');
    expect(state.allyTeam.MID).toBe('Viktor');
    expect(state.userChampionId).toBe('Viktor');
    const secondAnalysis = analyzeFullDraft(state, catalog);
    expect(secondAnalysis!.userChampion.id).toBe('Viktor');

    // Escolher Zed no Mid adversário e depois trocá-lo para Jungle adversário (move sem duplicar)
    state = assignChampion(state, 'enemy', 'MID', 'Zed');
    expect(findChampionUsage(state).get('Zed')).toEqual({ team: 'enemy', role: 'MID' });
    state = assignChampion(state, 'enemy', 'JUNGLE', 'Zed');
    expect(state.enemyTeam.MID).toBeNull();
    expect(state.enemyTeam.JUNGLE).toBe('Zed');

    // Trocar campeão controlado para outra posição aliada (Top: Ornn)
    state = setControlledRole(state, 'TOP', 'Ornn');
    expect(state.userRole).toBe('TOP');
    expect(state.userChampionId).toBe('Ornn');
    expect(analyzeFullDraft(state, catalog)!.userChampion.id).toBe('Ornn');

    // Remover escolha do Top -> sem campeão controlado, análise volta a ser null
    state = assignChampion(state, 'ally', 'TOP', null);
    expect(state.allyTeam.TOP).toBeNull();
    expect(state.userChampionId).toBeNull();
    expect(analyzeFullDraft(state, catalog)).toBeNull();
  });

  it('exibe todos os 173 campeões no seletor, filtra por todas as 5 posições e pesquisa instantaneamente com suporte a escolhas flexíveis', () => {
    const all = filterChampions(catalog.champions, { role: 'ALL' });
    expect(all.length).toBe(173);

    for (const role of ROLES) {
      const byRole = filterChampions(catalog.champions, { role });
      expect(byRole.length).toBeGreaterThan(20);
      expect(byRole.length).toBeLessThan(173);
    }

    // Pesquisa ignora acentos/apóstrofos e encontra qualquer campeão mesmo fora da posição padrão (escolha flexível)
    const kaisaSearch = filterChampions(catalog.champions, { query: 'kaisa', role: 'TOP', queryOverridesRole: true });
    expect(kaisaSearch.some((c) => c.id === 'Kaisa')).toBe(true);

    // Cenários de demonstração só são aplicados quando chamados explicitamente via applyComposition
    const loadedScenario = applyComposition(DEMO_SCENARIOS[0]);
    expect(countPicks(loadedScenario).total).toBe(10);
    expect(loadedScenario.userChampionId).toBe('Nami');
  });
});

describe('7. Validação Textual, Eliminação de Redundâncias e Fidelidade Gramatical ao Draft', () => {
  it('formata listas em português natural e corrige redundâncias de autoproteção ("Vladimir, Smolder e Milio com Milio")', () => {
    expect(formatNameList(['Vladimir'])).toBe('Vladimir');
    expect(formatNameList(['Vladimir', 'Smolder'])).toBe('Vladimir e Smolder');
    expect(formatNameList(['Vladimir', 'Smolder', 'Milio'])).toBe('Vladimir, Smolder e Milio');
    expect(formatNameList(['Vladimir', 'Smolder', 'Milio'], 'e', ['Milio'])).toBe('Vladimir e Smolder');

    const brokenSentence =
      'Vencer lutas prolongadas protegendo Vladimir e Smolder e Milio com Milio.';
    const repaired = sanitizeSentenceChampionMentions(brokenSentence, ['Vladimir', 'Smolder', 'Milio']);
    expect(repaired).not.toContain('e Smolder e Milio');
    expect(repaired).not.toContain('Milio com Milio');
    expect(repaired).toContain('protegendo Vladimir e Smolder enquanto Milio mantém a retaguarda segura');
  });

  it('gera a frase front-to-back natural para Vladimir, Smolder e Milio sem incluir Milio como alvo de sua própria proteção', () => {
    const draft: DraftState = {
      allyTeam: {
        TOP: 'Vladimir',
        JUNGLE: 'Sejuani',
        MID: 'Orianna',
        ADC: 'Smolder',
        SUPPORT: 'Milio',
      },
      enemyTeam: {
        TOP: 'Ornn',
        JUNGLE: 'JarvanIV',
        MID: 'Zed',
        ADC: 'Caitlyn',
        SUPPORT: 'Lux',
      },
      userRole: 'SUPPORT',
      userChampionId: 'Milio',
      liveSituation: BASE_LIVE,
    };

    const res = analyzeFullDraft(draft, catalog)!;
    expect(res).not.toBeNull();

    // Milio jamais deve aparecer como alvo que ele próprio precisa proteger
    expect(res.strategy.whoToProtectInTeamfights.targetName).not.toContain('Milio');
    expect(res.strategy.whoToProtectInTeamfights.targetName).toContain('Smolder');

    // A condição de vitória front-to-back deve citar os carregadores protegidos separados do suporte protetor
    const frontToBackWc = res.allyWinConditions.find((wc) => wc.includes('front-to-back'));
    expect(frontToBackWc).toBeDefined();
    expect(frontToBackWc).not.toMatch(/Milio.*Milio/);
    expect(frontToBackWc).toBe(
      'Vencer lutas prolongadas no estilo front-to-back, protegendo Vladimir, Orianna e Smolder enquanto Milio mantém a retaguarda segura e fortalece seus carregadores.',
    );

    // E no caso exato reportado pelo usuário (Vladimir, Smolder e Milio na equipe aliada):
    const trioDraft: DraftState = {
      allyTeam: {
        TOP: 'Vladimir',
        JUNGLE: null,
        MID: null,
        ADC: 'Smolder',
        SUPPORT: 'Milio',
      },
      enemyTeam: {
        TOP: 'Ornn',
        JUNGLE: 'Viego',
        MID: 'Zed',
        ADC: 'Caitlyn',
        SUPPORT: 'Lux',
      },
      userRole: 'SUPPORT',
      userChampionId: 'Milio',
      liveSituation: BASE_LIVE,
    };
    const trioRes = analyzeFullDraft(trioDraft, catalog)!;
    expect(trioRes.allyWinConditions[0]).toBe(
      'Vencer lutas prolongadas no estilo front-to-back, protegendo Vladimir e Smolder enquanto Milio mantém a retaguarda segura e fortalece seus carregadores.',
    );
  });

  it('valida todas as recomendações (condições de vitória, insights, builds, runas, matchups e estratégia) sem mencionar campeões fora do draft nem repetir nomes na mesma frase', () => {
    for (const scenario of DEMO_SCENARIOS) {
      const draft = applyComposition(scenario);
      const res = analyzeFullDraft(draft, catalog)!;
      expect(res).not.toBeNull();

      const allyNames = Object.values(draft.allyTeam)
        .filter(Boolean)
        .map((id) => catalog.champions.find((c) => c.id === id)!.name);
      const enemyNames = Object.values(draft.enemyTeam)
        .filter(Boolean)
        .map((id) => catalog.champions.find((c) => c.id === id)!.name);
      const draftNames = [...allyNames, ...enemyNames];

      const allGeneratedTexts: string[] = [
        ...res.allyWinConditions,
        ...res.enemyWinConditions,
        ...res.insights.map((i) => `${i.title}. ${i.description}`),
        res.build.buildIdentitySummary,
        ...res.build.slots.map((s) => `${s.reason}. ${s.benefit}. ${s.whenToBuy}`),
        ...res.build.situationalItems.map((s) => `${s.whenToBuy}. ${s.whyBuy}. ${s.whenToAvoid}`),
        res.runes.comparisonSummary,
        res.runes.recommended.overallReasoning,
        ...res.runes.recommended.choiceExplanations.map((c) => c.reason),
        ...res.matchups.laneMatchupSummary.keyTradingRules,
        ...res.matchups.enemyThreats.map((t) => t.summary),
        ...res.matchups.allySynergies.map((s) => s.comboExplanation),
        res.strategy.allyToPrioritize.reason,
        res.strategy.biggestEnemyThreat.reason,
        res.strategy.whoToProtectInTeamfights.reason,
        res.strategy.teamWinCondition,
        res.strategy.positioningGuide,
        ...res.strategy.whatToAvoid,
        ...res.strategy.roleSpecificPlaybook.directives.map((d) => d.guidance),
      ];

      const ctx = {
        userChampionName: res.userChampion.name,
        allyNames,
        enemyNames,
        allCatalogChampionNames: catalog.champions.map((c) => c.name),
      };

      for (const text of allGeneratedTexts) {
        // 1. Nenhum campeão fora do draft pode ser mencionado
        const intruders = findOutOfDraftChampionMentions(text, ctx);
        expect(intruders, `Campeão fora do draft mencionado em: "${text}"`).toEqual([]);

        // 2. Nenhum encadeamento "ChampA e ChampB e ChampC"
        for (const n1 of draftNames) {
          for (const n2 of draftNames) {
            expect(text).not.toContain(`${n1} e ${n2} e `);
          }
          // 3. Nenhuma repetição imediata "Champ e Champ" ou "protegendo ... Champ com Champ"
          expect(text).not.toContain(`${n1} e ${n1}`);
          expect(text).not.toContain(`${n1} com ${n1}`);
        }
      }
    }
  });
});



