import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  DATA_DIR,
  DB_PATH,
  deleteChampionPoolEntry,
  deleteDraftHistoryEntry,
  getAllChampionsFromDb,
  getAllItemsFromDb,
  getAllRunesFromDb,
  getAllSummonersFromDb,
  getChampionPool,
  getDb,
  getDraftHistory,
  getMeta,
  getNetworkLogs,
  getUserPreferences,
  saveDraftHistoryEntry,
  saveUserPreferences,
  upsertChampionPoolEntry,
} from './db.ts';
import {
  checkLatestRemoteVersion,
  prefetchCoreIconsForOffline,
  resolveAndCacheAsset,
  syncDataDragon,
} from './ddragonSync.ts';
import { getOfficialStatShards } from '../shared/ddragonParser.ts';
import type { DataGovernanceReport } from '../shared/types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist');

export function buildGovernanceReport(): DataGovernanceReport {
  const db = getDb();
  const activePatch = getMeta('active_patch_version') || 'Não sincronizado';
  const latestRemotePatch = getMeta('latest_remote_version');
  const lastSyncedAt = getMeta('last_synced_at');
  const prefs = getUserPreferences();
  const champCount = (db.prepare('SELECT COUNT(*) as c FROM champions').get() as { c: number }).c;
  const srItemCount = (db.prepare('SELECT COUNT(*) as c FROM items WHERE sr_valid = 1').get() as { c: number }).c;
  const runeCount = (db.prepare('SELECT COUNT(*) as c FROM runes').get() as { c: number }).c;

  const extRow = db
    .prepare(
      'SELECT source_name, patch, region, elo, sample_size FROM external_stat_snapshots ORDER BY imported_at DESC LIMIT 1',
    )
    .get() as
    | { source_name: string; patch: string; region: string; elo: string; sample_size: number }
    | undefined;

  const isOutdatedVsRemote = Boolean(
    latestRemotePatch && activePatch !== 'Não sincronizado' && activePatch !== latestRemotePatch,
  );
  const configuredClientPatch = (prefs.knownClientPatch || '').trim();
  const isOutdatedVsClientPatch = Boolean(
    configuredClientPatch &&
      activePatch !== 'Não sincronizado' &&
      !activePatch.startsWith(configuredClientPatch),
  );

  return {
    officialDdragon: {
      activePatch,
      latestRemotePatch,
      isOutdatedVsRemote,
      isOutdatedVsClientPatch,
      configuredClientPatch,
      lastSyncedAt,
      championsLoaded: champCount,
      srItemsLoaded: srItemCount,
      runeTreesLoaded: runeCount,
    },
    externalStats: extRow
      ? {
          connected: true,
          sourceName: extRow.source_name,
          patch: extRow.patch,
          region: extRow.region,
          elo: extRow.elo,
          sampleSize: extRow.sample_size,
          disclaimer: `Fonte externa autorizada ativa (${extRow.source_name} • Patch ${extRow.patch} • ${extRow.region} • ${extRow.elo} • n=${extRow.sample_size}).`,
        }
      : {
          connected: false,
          sourceName: null,
          patch: null,
          region: null,
          elo: null,
          sampleSize: null,
          disclaimer:
            'Nenhuma fonte estatística externa conectada. O RiftMind não inventa taxas de vitória ou popularidade: todas as recomendações decorrem exclusivamente dos dados oficiais do patch (Riot Data Dragon) e do Motor Estratégico Contextual.',
        },
    strategicEngine: {
      engineVersion: 'RiftMind Contextual Engine v2.4 (Summoner’s Rift Map 11)',
      mode: 'Análise Determinística e Contextual 5x5',
      explanation:
        'Pontua sinergias, ameaças, escalamentos de habilidades, distribuição de dano, controle de grupo e economia da partida sem depender de listas fixas.',
    },
  };
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '5mb' }));

  // Ensure initial sync if database is empty
  let initialSyncPromise: Promise<any> | null = null;
  async function ensureSynced() {
    const db = getDb();
    const count = (db.prepare('SELECT COUNT(*) as c FROM champions').get() as { c: number }).c;
    if (count > 0) return;
    if (!initialSyncPromise) {
      initialSyncPromise = syncDataDragon().finally(() => {
        initialSyncPromise = null;
      });
    }
    await initialSyncPromise;
  }

  app.get('/api/bootstrap', async (_req, res) => {
    try {
      await ensureSynced();
      const prefs = getUserPreferences();
      if (prefs.autoCheckPatch) {
        // Non-blocking background remote version check
        checkLatestRemoteVersion().catch(() => {});
      }
      res.json({
        governance: buildGovernanceReport(),
        champions: getAllChampionsFromDb(),
        items: getAllItemsFromDb(true),
        runeTrees: getAllRunesFromDb(),
        statShards: getOfficialStatShards(),
        summoners: getAllSummonersFromDb(),
        championPool: getChampionPool(),
        preferences: prefs,
        draftHistory: getDraftHistory(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao carregar banco local do RiftMind.' });
    }
  });

  app.get('/api/version-check', async (_req, res) => {
    const status = await checkLatestRemoteVersion();
    res.json({
      ...status,
      governance: buildGovernanceReport(),
    });
  });

  app.post('/api/sync', async (req, res) => {
    try {
      const force = Boolean(req.body?.force);
      const report = await syncDataDragon({ force });
      res.json({
        report,
        governance: buildGovernanceReport(),
        champions: getAllChampionsFromDb(),
        items: getAllItemsFromDb(true),
        runeTrees: getAllRunesFromDb(),
        summoners: getAllSummonersFromDb(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Falha ao sincronizar com o Riot Data Dragon.' });
    }
  });

  app.post('/api/prefetch-icons', async (_req, res) => {
    try {
      const result = await prefetchCoreIconsForOffline();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Falha ao fazer cache offline dos ícones.' });
    }
  });

  // Local offline-capable Data Dragon asset cache endpoint
  app.get('/api/assets/{*assetPath}', async (req, res) => {
    const rawParam = (req.params as any).assetPath;
    const relPath = Array.isArray(rawParam) ? rawParam.join('/') : String(rawParam || '');
    const resolved = await resolveAndCacheAsset(relPath);
    if (!resolved) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', resolved.contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    fs.createReadStream(resolved.filePath).pipe(res);
  });

  // Champion Pool endpoints
  app.put('/api/pool/:championId', (req, res) => {
    const { championId } = req.params;
    upsertChampionPoolEntry({
      championId,
      roles: Array.isArray(req.body.roles) ? req.body.roles : ['MID'],
      isFavorite: Boolean(req.body.isFavorite),
      isMain: Boolean(req.body.isMain),
      familiarity: Math.min(5, Math.max(1, Number(req.body.familiarity) || 3)) as 1 | 2 | 3 | 4 | 5,
      notes: String(req.body.notes || ''),
      updatedAt: new Date().toISOString(),
    });
    res.json({ championPool: getChampionPool() });
  });

  app.delete('/api/pool/:championId', (req, res) => {
    deleteChampionPoolEntry(req.params.championId);
    res.json({ championPool: getChampionPool() });
  });

  // Preferences
  app.put('/api/preferences', (req, res) => {
    const current = getUserPreferences();
    const updated = {
      preferredRoles: Array.isArray(req.body.preferredRoles) ? req.body.preferredRoles : current.preferredRoles,
      autoCheckPatch: req.body.autoCheckPatch !== undefined ? Boolean(req.body.autoCheckPatch) : current.autoCheckPatch,
      knownClientPatch:
        req.body.knownClientPatch !== undefined ? String(req.body.knownClientPatch) : current.knownClientPatch,
    };
    saveUserPreferences(updated);
    res.json({ preferences: updated, governance: buildGovernanceReport() });
  });

  // Draft History
  app.post('/api/history', (req, res) => {
    const b = req.body;
    const entry = {
      id: b.id || `draft_${Date.now()}`,
      title: String(b.title || 'Análise de Draft 5x5'),
      notes: String(b.notes || ''),
      patchVersion: String(b.patchVersion || getMeta('active_patch_version') || ''),
      userRole: b.userRole || 'SUPPORT',
      userChampionId: String(b.userChampionId || ''),
      allyTeam: b.allyTeam,
      enemyTeam: b.enemyTeam,
      summaryVerdict: String(b.summaryVerdict || ''),
      createdAt: b.createdAt || new Date().toISOString(),
    };
    saveDraftHistoryEntry(entry);
    res.json({ draftHistory: getDraftHistory() });
  });

  app.delete('/api/history/:id', (req, res) => {
    deleteDraftHistoryEntry(req.params.id);
    res.json({ draftHistory: getDraftHistory() });
  });

  // External Authorized Stats Snapshot import/remove
  app.post('/api/external-stats', (req, res) => {
    const { sourceName, patch, region, elo, sampleSize, payload } = req.body || {};
    if (!sourceName || !patch || !region || !elo || !sampleSize) {
      res.status(400).json({
        error:
          'Fonte estatística externa exige identificação explícita de sourceName, patch, region, elo e sampleSize.',
      });
      return;
    }
    getDb()
      .prepare(
        `INSERT INTO external_stat_snapshots (id, source_name, patch, region, elo, sample_size, payload_json, imported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        `ext_${Date.now()}`,
        String(sourceName),
        String(patch),
        String(region),
        String(elo),
        Number(sampleSize),
        JSON.stringify(payload || {}),
        new Date().toISOString(),
      );
    res.json({ governance: buildGovernanceReport() });
  });

  app.delete('/api/external-stats', (_req, res) => {
    getDb().exec('DELETE FROM external_stat_snapshots');
    res.json({ governance: buildGovernanceReport() });
  });

  // Security, Isolation & Connection Audit Monitor
  app.get('/api/security-status', (_req, res) => {
    res.json({
      bindHost: '127.0.0.1',
      localDataDir: DATA_DIR,
      sqliteDbPath: DB_PATH,
      riotApiKeyConfiguredInBackendEnv: Boolean(process.env.RIOT_API_KEY),
      vanguardIsolationGuarantees: [
        'Execução estritamente local em 127.0.0.1 sem abertura para rede externa',
        'Zero conexão com LCU API, Live Client Data API (porta 2999) ou Riot Client WebSocket',
        'Zero leitura de memória, processos, registro do Windows ou pastas de instalação do League of Legends',
        'Zero overlays, hooks, DLLs, OCR de tela ou automação de cliques/runas/compras',
        'Único domínio remoto consultado sob demanda: ddragon.leagueoflegends.com (dados estáticos públicos)',
      ],
      networkLogs: getNetworkLogs(150),
    });
  });

  // Serve built frontend when in production or when dist exists and --prod is passed
  if (process.env.NODE_ENV === 'production' || process.argv.includes('--prod')) {
    if (fs.existsSync(DIST_DIR)) {
      app.use(express.static(DIST_DIR));
      app.get('/{*splat}', (_req, res) => {
        res.sendFile(path.join(DIST_DIR, 'index.html'));
      });
    }
  }

  return app;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  const PORT = Number(process.env.PORT) || 3847;
  const HOST = '127.0.0.1';
  const app = createApp();
  app.listen(PORT, HOST, async () => {
    console.log(`[RiftMind] Servidor isolado ativo em http://${HOST}:${PORT}`);
    try {
      const report = await syncDataDragon({ force: false });
      console.log(
        `[RiftMind] Banco oficial Data Dragon pronto — Patch ${report.version} (${report.championsSynced} campeões, ${report.srItemsSynced} itens SR Mapa 11).`,
      );
    } catch (err: any) {
      console.warn('[RiftMind] Operando em modo offline com cache SQLite existente:', err?.message);
    }
  });
}
