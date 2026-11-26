import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type {
  ChampionData,
  ChampionPoolEntry,
  DataGovernanceReport,
  DraftState,
  FullDraftAnalysis,
  ItemData,
  LiveMatchSituation,
  Role,
  RuneTree,
  SavedDraftHistoryEntry,
  StatShard,
  SummonerSpellData,
  UserPreferences,
} from '../../shared/types.ts';
import { analyzeFullDraft } from '../../shared/engine/analyzeDraft.ts';
import { inferChampionRoles } from '../../shared/engine/championProfiler.ts';
import {
  applyComposition,
  assignChampion,
  countPicks,
  createEmptyDraftState,
  setControlledRole,
  type DraftSide,
} from '../../shared/draftState.ts';
import type { DemoScenario } from '../../shared/demoScenarios.ts';

export type PageKey =
  | 'dashboard'
  | 'pool'
  | 'draft'
  | 'builds'
  | 'runes'
  | 'matchups'
  | 'history'
  | 'settings';

const LS_POOL_KEY = 'riftmind_pool_v1';
const LS_PREFS_KEY = 'riftmind_prefs_v1';
const LS_HISTORY_KEY = 'riftmind_history_v1';

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

interface RiftMindContextValue {
  loading: boolean;
  error: string | null;
  activePage: PageKey;
  setActivePage: (p: PageKey) => void;
  patchVersion: string;
  governance: DataGovernanceReport | null;
  champions: ChampionData[];
  championMap: Map<string, ChampionData>;
  items: ItemData[];
  itemMap: Map<string, ItemData>;
  runeTrees: RuneTree[];
  statShards: StatShard[];
  summoners: SummonerSpellData[];
  championPool: ChampionPoolEntry[];
  preferences: UserPreferences;
  draftHistory: SavedDraftHistoryEntry[];
  draft: DraftState;
  analysis: FullDraftAnalysis | null;
  inspectedChampion: ChampionData | null;
  setInspectedChampion: (c: ChampionData | null) => void;
  setTeamChampion: (team: DraftSide, role: Role, championId: string | null, opts?: { controlled?: boolean }) => void;
  setUserControl: (role: Role, championId?: string | null) => void;
  loadDemoScenario: (scenario: DemoScenario) => void;
  clearDraftBoard: () => void;
  startNewAnalysis: () => void;
  updateLiveSituation: (patch: Partial<LiveMatchSituation>) => void;
  upsertPoolEntry: (entry: Omit<ChampionPoolEntry, 'updatedAt'>) => Promise<void>;
  removePoolEntry: (championId: string) => Promise<void>;
  saveDraftToHistory: (title: string, notes: string) => Promise<boolean>;
  loadHistoryEntry: (entry: SavedDraftHistoryEntry) => void;
  deleteHistoryEntry: (id: string) => Promise<void>;
  triggerSync: (force?: boolean) => Promise<void>;
  savePrefs: (next: Partial<UserPreferences>) => Promise<void>;
  refreshBootstrap: () => Promise<void>;
}

const RiftMindContext = createContext<RiftMindContextValue | null>(null);

export function RiftMindProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [staticFallbackMode, setStaticFallbackMode] = useState(false);

  const [governance, setGovernance] = useState<DataGovernanceReport | null>(null);
  const [champions, setChampions] = useState<ChampionData[]>([]);
  const [items, setItems] = useState<ItemData[]>([]);
  const [runeTrees, setRuneTrees] = useState<RuneTree[]>([]);
  const [statShards, setStatShards] = useState<StatShard[]>([]);
  const [summoners, setSummoners] = useState<SummonerSpellData[]>([]);
  const [championPool, setChampionPool] = useState<ChampionPoolEntry[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>({
    preferredRoles: [],
    autoCheckPatch: true,
    knownClientPatch: '',
  });
  const [draftHistory, setDraftHistory] = useState<SavedDraftHistoryEntry[]>([]);
  const [inspectedChampion, setInspectedChampion] = useState<ChampionData | null>(null);

  // O draft sempre começa vazio. Cenários de demonstração e análises salvas
  // só são carregados por ação explícita do usuário.
  const [draft, setDraft] = useState<DraftState>(() => createEmptyDraftState());

  const refreshBootstrap = async () => {
    try {
      if (champions.length === 0) setLoading(true);
      setError(null);

      let data: any = null;
      let usingStatic = false;

      try {
        const res = await fetch('/api/bootstrap');
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          data = await res.json();
        }
      } catch {
        // Fallback to static snapshot when running on static hosting (e.g. Vercel)
      }

      if (!data) {
        const staticRes = await fetch('/data/bootstrap-static.json');
        if (!staticRes.ok) {
          throw new Error(`Falha ao carregar catálogo do RiftMind (HTTP ${staticRes.status})`);
        }
        data = await staticRes.json();
        usingStatic = true;
      }

      setStaticFallbackMode(usingStatic);
      setGovernance(data.governance);
      setChampions(data.champions || []);
      setItems(data.items || []);
      setRuneTrees(data.runeTrees || []);
      setStatShards(data.statShards || []);
      setSummoners(data.summoners || []);

      if (usingStatic) {
        setChampionPool(readLocalJson<ChampionPoolEntry[]>(LS_POOL_KEY, []));
        setPreferences(
          readLocalJson<UserPreferences>(LS_PREFS_KEY, {
            preferredRoles: [],
            autoCheckPatch: true,
            knownClientPatch: '',
          }),
        );
        setDraftHistory(readLocalJson<SavedDraftHistoryEntry[]>(LS_HISTORY_KEY, []));
      } else {
        setChampionPool(data.championPool || []);
        if (data.preferences) setPreferences(data.preferences);
        setDraftHistory(data.draftHistory || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao inicializar catálogo do RiftMind.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshBootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const championMap = useMemo(() => new Map(champions.map((c) => [c.id, c])), [champions]);
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const analysis = useMemo(() => {
    if (!governance || champions.length === 0 || items.length === 0 || runeTrees.length === 0) return null;
    return analyzeFullDraft(draft, { champions, items, runeTrees, statShards, summoners, governance });
  }, [draft, champions, items, runeTrees, statShards, summoners, governance]);

  const setTeamChampion: RiftMindContextValue['setTeamChampion'] = (team, role, championId, opts) => {
    setDraft((prev) => assignChampion(prev, team, role, championId, opts));
  };

  const setUserControl = (role: Role, championId?: string | null) => {
    setDraft((prev) => setControlledRole(prev, role, championId));
  };

  const loadDemoScenario = (scenario: DemoScenario) => {
    setDraft(applyComposition(scenario));
  };

  const clearDraftBoard = () => setDraft(createEmptyDraftState());

  const startNewAnalysis = () => {
    if (countPicks(draft).total > 0) {
      const ok = window.confirm('Descartar o draft atual e começar uma nova análise com as dez posições vazias?');
      if (!ok) return;
    }
    setDraft(createEmptyDraftState());
    setActivePage('draft');
  };

  const updateLiveSituation = (patch: Partial<LiveMatchSituation>) => {
    setDraft((prev) => ({ ...prev, liveSituation: { ...prev.liveSituation, ...patch } }));
  };

  const upsertPoolEntry = async (entry: Omit<ChampionPoolEntry, 'updatedAt'>) => {
    if (!staticFallbackMode) {
      try {
        const res = await fetch(`/api/pool/${entry.championId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
        if (res.ok) {
          setChampionPool((await res.json()).championPool);
          return;
        }
      } catch {
        // Fallback to localStorage
      }
    }
    const nextEntry: ChampionPoolEntry = { ...entry, updatedAt: new Date().toISOString() };
    setChampionPool((prev) => {
      const filtered = prev.filter((p) => p.championId !== entry.championId);
      const updated = [nextEntry, ...filtered];
      writeLocalJson(LS_POOL_KEY, updated);
      return updated;
    });
  };

  const removePoolEntry = async (championId: string) => {
    if (!staticFallbackMode) {
      try {
        const res = await fetch(`/api/pool/${championId}`, { method: 'DELETE' });
        if (res.ok) {
          setChampionPool((await res.json()).championPool);
          return;
        }
      } catch {
        // Fallback to localStorage
      }
    }
    setChampionPool((prev) => {
      const updated = prev.filter((p) => p.championId !== championId);
      writeLocalJson(LS_POOL_KEY, updated);
      return updated;
    });
  };

  const saveDraftToHistory = async (title: string, notes: string): Promise<boolean> => {
    if (!analysis) return false;
    const verdict = analysis.allyWinConditions[0] || analysis.build.buildIdentitySummary;
    const payload: SavedDraftHistoryEntry = {
      id: `draft_${Date.now()}`,
      title,
      notes,
      patchVersion: governance?.officialDdragon.activePatch || '',
      userRole: analysis.userRole,
      userChampionId: analysis.userChampion.id,
      allyTeam: draft.allyTeam,
      enemyTeam: draft.enemyTeam,
      summaryVerdict: verdict,
      createdAt: new Date().toISOString(),
    };

    if (!staticFallbackMode) {
      try {
        const res = await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setDraftHistory((await res.json()).draftHistory);
          return true;
        }
      } catch {
        // Fallback to localStorage
      }
    }

    setDraftHistory((prev) => {
      const updated = [payload, ...prev];
      writeLocalJson(LS_HISTORY_KEY, updated);
      return updated;
    });
    return true;
  };

  const loadHistoryEntry = (entry: SavedDraftHistoryEntry) => {
    setDraft(applyComposition(entry));
    setActivePage('draft');
  };

  const deleteHistoryEntry = async (id: string) => {
    if (!staticFallbackMode) {
      try {
        const res = await fetch(`/api/history/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setDraftHistory((await res.json()).draftHistory);
          return;
        }
      } catch {
        // Fallback to localStorage
      }
    }
    setDraftHistory((prev) => {
      const updated = prev.filter((h) => h.id !== id);
      writeLocalJson(LS_HISTORY_KEY, updated);
      return updated;
    });
  };

  const triggerSync = async (force = false) => {
    if (staticFallbackMode) {
      await refreshBootstrap();
      return;
    }
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao sincronizar Data Dragon.');
    }
    const data = await res.json();
    setGovernance(data.governance);
    setChampions(data.champions);
    setItems(data.items);
    setRuneTrees(data.runeTrees);
    setSummoners(data.summoners);
  };

  const savePrefs = async (next: Partial<UserPreferences>) => {
    if (!staticFallbackMode) {
      try {
        const res = await fetch('/api/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        });
        if (res.ok) {
          const data = await res.json();
          setPreferences(data.preferences);
          setGovernance(data.governance);
          return;
        }
      } catch {
        // Fallback to localStorage
      }
    }
    setPreferences((prev) => {
      const updated = { ...prev, ...next };
      writeLocalJson(LS_PREFS_KEY, updated);
      return updated;
    });
  };

  const patchVersion = governance?.officialDdragon.activePatch || '';

  return (
    <RiftMindContext.Provider
      value={{
        loading,
        error,
        activePage,
        setActivePage,
        patchVersion,
        governance,
        champions,
        championMap,
        items,
        itemMap,
        runeTrees,
        statShards,
        summoners,
        championPool,
        preferences,
        draftHistory,
        draft,
        analysis,
        inspectedChampion,
        setInspectedChampion,
        setTeamChampion,
        setUserControl,
        loadDemoScenario,
        clearDraftBoard,
        startNewAnalysis,
        updateLiveSituation,
        upsertPoolEntry,
        removePoolEntry,
        saveDraftToHistory,
        loadHistoryEntry,
        deleteHistoryEntry,
        triggerSync,
        savePrefs,
        refreshBootstrap,
      }}
    >
      {children}
    </RiftMindContext.Provider>
  );
}

export function useRiftMind(): RiftMindContextValue {
  const ctx = useContext(RiftMindContext);
  if (!ctx) throw new Error('useRiftMind deve ser utilizado dentro de RiftMindProvider');
  return ctx;
}

/** Posição sugerida ao usar um campeão como "meu campeão" a partir de outra tela. */
export function suggestRoleFor(champ: ChampionData, draft: DraftState): Role {
  if (draft.userRole) return draft.userRole;
  const roles = inferChampionRoles(champ);
  return roles.find((r) => !draft.allyTeam[r]) || roles[0] || 'MID';
}
