import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ChampionData,
  ChampionPoolEntry,
  ItemData,
  NetworkConnectionLog,
  RuneTree,
  SavedDraftHistoryEntry,
  SummonerSpellData,
  UserPreferences,
} from '../shared/types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname, '..', 'data');
export const ASSETS_DIR = path.join(DATA_DIR, 'assets');
export const DB_PATH = path.join(DATA_DIR, 'riftmind.sqlite');

fs.mkdirSync(ASSETS_DIR, { recursive: true });

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;
  dbInstance = new DatabaseSync(DB_PATH);
  dbInstance.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS champions (
      id TEXT PRIMARY KEY,
      numeric_key TEXT NOT NULL,
      name TEXT NOT NULL,
      patch_version TEXT NOT NULL,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sr_valid INTEGER NOT NULL,
      category TEXT NOT NULL,
      patch_version TEXT NOT NULL,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runes (
      id INTEGER PRIMARY KEY,
      key TEXT NOT NULL,
      name TEXT NOT NULL,
      patch_version TEXT NOT NULL,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS summoners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      patch_version TEXT NOT NULL,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS champion_pool (
      champion_id TEXT PRIMARY KEY,
      roles_json TEXT NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      is_main INTEGER NOT NULL DEFAULT 0,
      familiarity INTEGER NOT NULL DEFAULT 3,
      notes TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS draft_history (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT NOT NULL,
      patch_version TEXT NOT NULL,
      user_role TEXT NOT NULL,
      user_champion_id TEXT NOT NULL,
      ally_team_json TEXT NOT NULL,
      enemy_team_json TEXT NOT NULL,
      summary_verdict TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS external_stat_snapshots (
      id TEXT PRIMARY KEY,
      source_name TEXT NOT NULL,
      patch TEXT NOT NULL,
      region TEXT NOT NULL,
      elo TEXT NOT NULL,
      sample_size INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      imported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS network_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      method TEXT NOT NULL,
      url TEXT NOT NULL,
      domain TEXT NOT NULL,
      purpose TEXT NOT NULL,
      status INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL
    );
  `);
  return dbInstance;
}

export function getMeta(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM metadata WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setMeta(key: string, value: string): void {
  getDb()
    .prepare('INSERT INTO metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

export function logNetworkConnection(entry: Omit<NetworkConnectionLog, 'id'>): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO network_logs (timestamp, method, url, domain, purpose, status, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(entry.timestamp, entry.method, entry.url, entry.domain, entry.purpose, entry.status, entry.durationMs);

  // Keep last 500 entries so DB stays nimble
  db.exec(`DELETE FROM network_logs WHERE id NOT IN (SELECT id FROM network_logs ORDER BY id DESC LIMIT 500);`);
}

export function getNetworkLogs(limit = 120): NetworkConnectionLog[] {
  const rows = getDb()
    .prepare(
      `SELECT id, timestamp, method, url, domain, purpose, status, duration_ms as durationMs
       FROM network_logs ORDER BY id DESC LIMIT ?`,
    )
    .all(limit) as unknown as NetworkConnectionLog[];
  return rows;
}

export function getAllChampionsFromDb(): ChampionData[] {
  const rows = getDb().prepare('SELECT data_json FROM champions ORDER BY name COLLATE NOCASE ASC').all() as {
    data_json: string;
  }[];
  return rows.map((r) => JSON.parse(r.data_json) as ChampionData);
}

export function getAllItemsFromDb(onlySrValid = false): ItemData[] {
  const sql = onlySrValid
    ? 'SELECT data_json FROM items WHERE sr_valid = 1 ORDER BY name COLLATE NOCASE ASC'
    : 'SELECT data_json FROM items ORDER BY name COLLATE NOCASE ASC';
  const rows = getDb().prepare(sql).all() as { data_json: string }[];
  return rows.map((r) => JSON.parse(r.data_json) as ItemData);
}

export function getAllRunesFromDb(): RuneTree[] {
  const rows = getDb().prepare('SELECT data_json FROM runes ORDER BY id ASC').all() as { data_json: string }[];
  return rows.map((r) => JSON.parse(r.data_json) as RuneTree);
}

export function getAllSummonersFromDb(): SummonerSpellData[] {
  const rows = getDb().prepare('SELECT data_json FROM summoners ORDER BY name ASC').all() as { data_json: string }[];
  return rows.map((r) => JSON.parse(r.data_json) as SummonerSpellData);
}

export function getChampionPool(): ChampionPoolEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT champion_id, roles_json, is_favorite, is_main, familiarity, notes, updated_at
       FROM champion_pool ORDER BY is_main DESC, is_favorite DESC, familiarity DESC`,
    )
    .all() as any[];
  return rows.map((r) => ({
    championId: r.champion_id,
    roles: JSON.parse(r.roles_json),
    isFavorite: Boolean(r.is_favorite),
    isMain: Boolean(r.is_main),
    familiarity: r.familiarity,
    notes: r.notes,
    updatedAt: r.updated_at,
  }));
}

export function upsertChampionPoolEntry(entry: ChampionPoolEntry): void {
  getDb()
    .prepare(
      `INSERT INTO champion_pool (champion_id, roles_json, is_favorite, is_main, familiarity, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(champion_id) DO UPDATE SET
         roles_json = excluded.roles_json,
         is_favorite = excluded.is_favorite,
         is_main = excluded.is_main,
         familiarity = excluded.familiarity,
         notes = excluded.notes,
         updated_at = excluded.updated_at`,
    )
    .run(
      entry.championId,
      JSON.stringify(entry.roles),
      entry.isFavorite ? 1 : 0,
      entry.isMain ? 1 : 0,
      entry.familiarity,
      entry.notes || '',
      new Date().toISOString(),
    );
}

export function deleteChampionPoolEntry(championId: string): void {
  getDb().prepare('DELETE FROM champion_pool WHERE champion_id = ?').run(championId);
}

export function getUserPreferences(): UserPreferences {
  const raw = getMeta('user_preferences');
  if (!raw) {
    return {
      preferredRoles: ['SUPPORT', 'MID'],
      autoCheckPatch: true,
      knownClientPatch: '',
    };
  }
  return JSON.parse(raw) as UserPreferences;
}

export function saveUserPreferences(prefs: UserPreferences): void {
  setMeta('user_preferences', JSON.stringify(prefs));
}

export function getDraftHistory(): SavedDraftHistoryEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT id, title, notes, patch_version, user_role, user_champion_id, ally_team_json, enemy_team_json, summary_verdict, created_at
       FROM draft_history ORDER BY created_at DESC LIMIT 200`,
    )
    .all() as any[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    notes: r.notes,
    patchVersion: r.patch_version,
    userRole: r.user_role,
    userChampionId: r.user_champion_id,
    allyTeam: JSON.parse(r.ally_team_json),
    enemyTeam: JSON.parse(r.enemy_team_json),
    summaryVerdict: r.summary_verdict,
    createdAt: r.created_at,
  }));
}

export function saveDraftHistoryEntry(entry: SavedDraftHistoryEntry): void {
  getDb()
    .prepare(
      `INSERT INTO draft_history (id, title, notes, patch_version, user_role, user_champion_id, ally_team_json, enemy_team_json, summary_verdict, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         notes = excluded.notes,
         summary_verdict = excluded.summary_verdict`,
    )
    .run(
      entry.id,
      entry.title,
      entry.notes,
      entry.patchVersion,
      entry.userRole,
      entry.userChampionId,
      JSON.stringify(entry.allyTeam),
      JSON.stringify(entry.enemyTeam),
      entry.summaryVerdict,
      entry.createdAt,
    );
}

export function deleteDraftHistoryEntry(id: string): void {
  getDb().prepare('DELETE FROM draft_history WHERE id = ?').run(id);
}
