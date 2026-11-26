import fs from 'node:fs';
import path from 'node:path';
import {
  ASSETS_DIR,
  getDb,
  getMeta,
  logNetworkConnection,
  setMeta,
} from './db.ts';
import {
  parseChampionDetailJson,
  parseItemEntry,
  parseRunesJson,
  parseSummonersJson,
} from '../shared/ddragonParser.ts';

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com';

async function auditedFetch(url: string, purpose: string): Promise<Response> {
  const started = Date.now();
  const parsedUrl = new URL(url);
  try {
    const res = await fetch(url);
    logNetworkConnection({
      timestamp: new Date().toISOString(),
      method: 'GET',
      url,
      domain: parsedUrl.hostname,
      purpose,
      status: res.status,
      durationMs: Date.now() - started,
    });
    return res;
  } catch (err) {
    logNetworkConnection({
      timestamp: new Date().toISOString(),
      method: 'GET',
      url,
      domain: parsedUrl.hostname,
      purpose: `${purpose} (FALHA/OFFLINE)`,
      status: 0,
      durationMs: Date.now() - started,
    });
    throw err;
  }
}

export async function checkLatestRemoteVersion(): Promise<{
  latestRemoteVersion: string | null;
  syncedVersion: string | null;
  isOutdated: boolean;
  offline: boolean;
}> {
  const syncedVersion = getMeta('active_patch_version');
  try {
    const res = await auditedFetch(
      `${DDRAGON_BASE}/api/versions.json`,
      'Verificação de versão do patch (Riot Data Dragon)',
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const versions = (await res.json()) as string[];
    const latestRemoteVersion = versions[0] || null;
    if (latestRemoteVersion) {
      setMeta('latest_remote_version', latestRemoteVersion);
      setMeta('last_version_check_at', new Date().toISOString());
    }
    return {
      latestRemoteVersion,
      syncedVersion,
      isOutdated: Boolean(syncedVersion && latestRemoteVersion && syncedVersion !== latestRemoteVersion),
      offline: false,
    };
  } catch {
    return {
      latestRemoteVersion: getMeta('latest_remote_version'),
      syncedVersion,
      isOutdated: false,
      offline: true,
    };
  }
}

async function mapPool<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function next(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}

export interface SyncProgressReport {
  version: string;
  championsSynced: number;
  itemsSynced: number;
  srItemsSynced: number;
  runeTreesSynced: number;
  summonersSynced: number;
  syncedAt: string;
  skippedUpToDate: boolean;
}

export async function syncDataDragon(options?: { force?: boolean; targetVersion?: string }): Promise<SyncProgressReport> {
  const versionsRes = await auditedFetch(
    `${DDRAGON_BASE}/api/versions.json`,
    'Consulta oficial de versões do Data Dragon',
  );
  if (!versionsRes.ok) {
    throw new Error(`Falha ao consultar versions.json: HTTP ${versionsRes.status}`);
  }
  const versions = (await versionsRes.json()) as string[];
  const version = options?.targetVersion || versions[0];
  setMeta('latest_remote_version', versions[0]);
  setMeta('available_versions_top10', JSON.stringify(versions.slice(0, 10)));

  const currentSynced = getMeta('active_patch_version');
  const db = getDb();
  const champCount = (db.prepare('SELECT COUNT(*) as c FROM champions').get() as { c: number }).c;

  if (!options?.force && currentSynced === version && champCount >= 160) {
    const itemCount = (db.prepare('SELECT COUNT(*) as c FROM items').get() as { c: number }).c;
    const srItemCount = (db.prepare('SELECT COUNT(*) as c FROM items WHERE sr_valid = 1').get() as { c: number }).c;
    const runeCount = (db.prepare('SELECT COUNT(*) as c FROM runes').get() as { c: number }).c;
    const summCount = (db.prepare('SELECT COUNT(*) as c FROM summoners').get() as { c: number }).c;
    return {
      version,
      championsSynced: champCount,
      itemsSynced: itemCount,
      srItemsSynced: srItemCount,
      runeTreesSynced: runeCount,
      summonersSynced: summCount,
      syncedAt: getMeta('last_synced_at') || new Date().toISOString(),
      skippedUpToDate: true,
    };
  }

  const [champListRes, itemsRes, runesRes, summonersRes] = await Promise.all([
    auditedFetch(`${DDRAGON_BASE}/cdn/${version}/data/pt_BR/champion.json`, `Catálogo de campeões (${version})`),
    auditedFetch(`${DDRAGON_BASE}/cdn/${version}/data/pt_BR/item.json`, `Catálogo de itens (${version})`),
    auditedFetch(`${DDRAGON_BASE}/cdn/${version}/data/pt_BR/runesReforged.json`, `Árvores de runas (${version})`),
    auditedFetch(`${DDRAGON_BASE}/cdn/${version}/data/pt_BR/summoner.json`, `Feitiços de invocador (${version})`),
  ]);

  const [champListJson, itemsJson, runesJson, summonersJson] = await Promise.all([
    champListRes.json() as Promise<any>,
    itemsRes.json() as Promise<any>,
    runesRes.json() as Promise<any[]>,
    summonersRes.json() as Promise<any>,
  ]);

  const championIds = Object.keys(champListJson.data || {});

  // Fetch all individual champion files concurrently to capture full passive, Q/W/E/R descriptions, cooldowns & scalings
  const detailedChampions = await mapPool(championIds, 24, async (champId) => {
    const url = `${DDRAGON_BASE}/cdn/${version}/data/pt_BR/champion/${champId}.json`;
    const started = Date.now();
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Falha ao baixar detalhes do campeão ${champId}: HTTP ${res.status}`);
    }
    const detailJson = (await res.json()) as any;
    const rawChamp = detailJson.data?.[champId] || champListJson.data[champId];
    return {
      parsed: parseChampionDetailJson(rawChamp),
      durationMs: Date.now() - started,
    };
  });

  // Record a consolidated audit log entry for the batch of individual champion files so the log stays clean and transparent
  logNetworkConnection({
    timestamp: new Date().toISOString(),
    method: 'GET (BATCH)',
    url: `${DDRAGON_BASE}/cdn/${version}/data/pt_BR/champion/{${championIds.length}_campeoes}.json`,
    domain: 'ddragon.leagueoflegends.com',
    purpose: `Download detalhado de habilidades e passivas de todos os ${championIds.length} campeões (${version})`,
    status: 200,
    durationMs: detailedChampions.reduce((acc, x) => acc + x.durationMs, 0),
  });

  const parsedItems = Object.entries(itemsJson.data || {}).map(([id, raw]) => parseItemEntry(id, raw));
  const parsedRunes = parseRunesJson(runesJson);
  const parsedSummoners = parseSummonersJson(summonersJson);

  // Incremental atomic upsert transaction without manually dropping user tables (champion_pool, draft_history, etc.)
  db.exec('BEGIN TRANSACTION');
  try {
    const upsertChamp = db.prepare(
      `INSERT INTO champions (id, numeric_key, name, patch_version, data_json)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         numeric_key = excluded.numeric_key,
         name = excluded.name,
         patch_version = excluded.patch_version,
         data_json = excluded.data_json`,
    );
    for (const { parsed } of detailedChampions) {
      upsertChamp.run(parsed.id, parsed.key, parsed.name, version, JSON.stringify(parsed));
    }

    // Remove obsolete items from older patches while updating current items in place
    db.prepare('DELETE FROM items WHERE patch_version != ?').run(version);
    const upsertItem = db.prepare(
      `INSERT INTO items (id, name, sr_valid, category, patch_version, data_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         sr_valid = excluded.sr_valid,
         category = excluded.category,
         patch_version = excluded.patch_version,
         data_json = excluded.data_json`,
    );
    for (const item of parsedItems) {
      upsertItem.run(item.id, item.name, item.srValid ? 1 : 0, item.category, version, JSON.stringify(item));
    }

    db.exec('DELETE FROM runes');
    const insertRune = db.prepare(
      `INSERT INTO runes (id, key, name, patch_version, data_json) VALUES (?, ?, ?, ?, ?)`,
    );
    for (const tree of parsedRunes) {
      insertRune.run(tree.id, tree.key, tree.name, version, JSON.stringify(tree));
    }

    db.exec('DELETE FROM summoners');
    const insertSumm = db.prepare(
      `INSERT INTO summoners (id, name, patch_version, data_json) VALUES (?, ?, ?, ?)`,
    );
    for (const summ of parsedSummoners) {
      insertSumm.run(summ.id, summ.name, version, JSON.stringify(summ));
    }

    const syncedAt = new Date().toISOString();
    setMeta('active_patch_version', version);
    setMeta('last_synced_at', syncedAt);
    db.exec('COMMIT');

    const srItemsSynced = parsedItems.filter((i) => i.srValid).length;
    return {
      version,
      championsSynced: detailedChampions.length,
      itemsSynced: parsedItems.length,
      srItemsSynced,
      runeTreesSynced: parsedRunes.length,
      summonersSynced: parsedSummoners.length,
      syncedAt,
      skippedUpToDate: false,
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Resolves and caches official Data Dragon icons locally on disk (`data/assets/...`)
 * so RiftMind operates completely offline once icons have been viewed or prefetched.
 */
export async function resolveAndCacheAsset(relativeAssetPath: string): Promise<{ filePath: string; contentType: string } | null> {
  // Prevent path traversal
  const sanitized = relativeAssetPath.replace(/\.\./g, '').replace(/^\/+/, '');
  const localFile = path.join(ASSETS_DIR, sanitized);

  if (fs.existsSync(localFile)) {
    return {
      filePath: localFile,
      contentType: localFile.endsWith('.webp') ? 'image/webp' : 'image/png',
    };
  }

  const remoteUrl = `${DDRAGON_BASE}/cdn/${sanitized}`;
  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(localFile), { recursive: true });
    fs.writeFileSync(localFile, buffer);
    return {
      filePath: localFile,
      contentType: res.headers.get('content-type') || 'image/png',
    };
  } catch {
    return null;
  }
}

export async function prefetchCoreIconsForOffline(): Promise<{ cachedCount: number }> {
  const version = getMeta('active_patch_version');
  if (!version) return { cachedCount: 0 };
  const db = getDb();
  const champs = db.prepare('SELECT data_json FROM champions').all() as { data_json: string }[];
  const items = db.prepare('SELECT data_json FROM items WHERE sr_valid = 1').all() as { data_json: string }[];
  const runes = db.prepare('SELECT data_json FROM runes').all() as { data_json: string }[];
  const summs = db.prepare('SELECT data_json FROM summoners').all() as { data_json: string }[];

  const pathsToCache: string[] = [];
  for (const row of champs) {
    const c = JSON.parse(row.data_json);
    pathsToCache.push(`${version}/img/champion/${c.imageFull}`);
  }
  for (const row of items) {
    const it = JSON.parse(row.data_json);
    pathsToCache.push(`${version}/img/item/${it.imageFull}`);
  }
  for (const row of runes) {
    const tr = JSON.parse(row.data_json);
    pathsToCache.push(`img/${tr.icon}`);
    for (const sl of tr.slots) {
      for (const r of sl.runes) {
        pathsToCache.push(`img/${r.icon}`);
      }
    }
  }
  for (const row of summs) {
    const s = JSON.parse(row.data_json);
    pathsToCache.push(`${version}/img/spell/${s.imageFull}`);
  }

  let cachedCount = 0;
  await mapPool(pathsToCache, 25, async (rel) => {
    const got = await resolveAndCacheAsset(rel);
    if (got) cachedCount++;
  });

  logNetworkConnection({
    timestamp: new Date().toISOString(),
    method: 'GET (PREFETCH)',
    url: `${DDRAGON_BASE}/cdn/{${cachedCount}_icones_oficiais}`,
    domain: 'ddragon.leagueoflegends.com',
    purpose: `Cache local offline de ícones de campeões, itens, runas e feitiços (${version})`,
    status: 200,
    durationMs: 0,
  });

  return { cachedCount };
}
