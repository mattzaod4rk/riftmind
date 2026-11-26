import React, { useMemo, useState } from 'react';
import { Search, Star, Crown, Plus, Trash2, Eye, Swords, X, Check } from 'lucide-react';
import { ROLES, ROLE_LABELS, type ChampionData, type Role } from '../../shared/types.ts';
import { inferChampionRoles, profileChampion } from '../../shared/engine/championProfiler.ts';
import { filterChampions } from '../../shared/championFilter.ts';
import { useRiftMind } from '../context/RiftMindContext.tsx';
import { getChampionIconUrl } from '../lib/assets.ts';

const FAMILIARITY_LABELS: Record<number, string> = {
  1: 'Nível 1 • Estudando',
  2: 'Nível 2 • Em prática',
  3: 'Nível 3 • Confortável',
  4: 'Nível 4 • Experiente',
  5: 'Nível 5 • Dominado (Main)',
};

export function ChampionPoolPage() {
  const {
    champions,
    championPool,
    preferences,
    patchVersion,
    upsertPoolEntry,
    removePoolEntry,
    savePrefs,
    setInspectedChampion,
    setUserControl,
    setActivePage,
  } = useRiftMind();

  const [collectionFilter, setCollectionFilter] = useState<'ALL' | 'MY_POOL' | 'FAVORITES' | 'MAINS'>('ALL');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [query, setQuery] = useState('');

  const poolMap = useMemo(() => new Map(championPool.map((p) => [p.championId, p])), [championPool]);
  const roleOverrides = useMemo(
    () => new Map(championPool.map((p) => [p.championId, p.roles])),
    [championPool],
  );

  const togglePreferredRole = (r: Role) => {
    const exists = preferences.preferredRoles.includes(r);
    const next = exists
      ? preferences.preferredRoles.filter((x) => x !== r)
      : [...preferences.preferredRoles, r];
    savePrefs({ preferredRoles: next });
  };

  const quickAddChampion = async (champ: ChampionData, opts?: { favorite?: boolean; main?: boolean }) => {
    const defaultRoles = inferChampionRoles(champ);
    await upsertPoolEntry({
      championId: champ.id,
      roles: roleFilter !== 'ALL' && !defaultRoles.includes(roleFilter) ? [roleFilter, ...defaultRoles] : defaultRoles,
      isFavorite: Boolean(opts?.favorite),
      isMain: Boolean(opts?.main),
      familiarity: opts?.main ? 5 : 3,
      notes: '',
    });
  };

  const toggleChampionRoleInPool = async (championId: string, role: Role) => {
    const existing = poolMap.get(championId);
    if (!existing) return;
    const hasRole = existing.roles.includes(role);
    const nextRoles = hasRole ? existing.roles.filter((r) => r !== role) : [...existing.roles, role];
    if (nextRoles.length === 0) return;
    await upsertPoolEntry({ ...existing, roles: nextRoles });
  };

  const filteredChampions = useMemo(() => {
    let subsetIds: Set<string> | null = null;
    if (collectionFilter === 'MY_POOL') {
      subsetIds = new Set(championPool.map((p) => p.championId));
    } else if (collectionFilter === 'FAVORITES') {
      subsetIds = new Set(championPool.filter((p) => p.isFavorite).map((p) => p.championId));
    } else if (collectionFilter === 'MAINS') {
      subsetIds = new Set(championPool.filter((p) => p.isMain).map((p) => p.championId));
    }

    const list = filterChampions(champions, {
      query,
      role: roleFilter,
      onlyIds: subsetIds,
      roleOverrides,
      queryOverridesRole: false,
    });

    // Sort personal pool entries (Mains -> Favorites -> Pool) first when browsing ALL without search
    if (collectionFilter === 'ALL' && !query.trim()) {
      return [...list].sort((a, b) => {
        const pa = poolMap.get(a.id);
        const pb = poolMap.get(b.id);
        const scoreA = pa ? (pa.isMain ? 3 : pa.isFavorite ? 2 : 1) : 0;
        const scoreB = pb ? (pb.isMain ? 3 : pb.isFavorite ? 2 : 1) : 0;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.name.localeCompare(b.name, 'pt-BR');
      });
    }
    return list;
  }, [champions, championPool, collectionFilter, roleFilter, query, roleOverrides, poolMap]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#1f242d]">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Minha Champion Pool & Catálogo de Campeões</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Gerencie seus campeões por posição, marque favoritos e principais ou explore todos os {champions.length}{' '}
            campeões do jogo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-400 mr-1">Minhas posições preferidas:</span>
          {ROLES.map((r) => {
            const active = preferences.preferredRoles.includes(r);
            return (
              <button
                key={r}
                onClick={() => togglePreferredRole(r)}
                className={`px-2.5 py-1 rounded text-xs font-semibold border transition cursor-pointer ${
                  active
                    ? 'bg-orange-500/20 text-orange-300 border-orange-500/50'
                    : 'bg-[#141820] text-zinc-400 border-[#222731] hover:text-zinc-200'
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            );
          })}
        </div>
      </header>

      {/* Filter Bar */}
      <div className="rm-panel rounded-lg p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Collection Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL' as const, label: `Todos os Campeões (${champions.length})` },
              { id: 'MY_POOL' as const, label: `Na Minha Pool (${championPool.length})` },
              {
                id: 'FAVORITES' as const,
                label: `Favoritos (${championPool.filter((p) => p.isFavorite).length})`,
              },
              { id: 'MAINS' as const, label: `Principais (${championPool.filter((p) => p.isMain).length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCollectionFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                  collectionFilter === tab.id
                    ? 'bg-orange-500 text-zinc-950'
                    : 'bg-[#171b22] text-zinc-300 hover:bg-[#1f242e] border border-[#262c38]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Instant Search */}
          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar campeão por nome..."
              className="rm-input w-full pl-9 pr-8 py-1.5 rounded-md text-xs"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Role Filter */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[#1f242d]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-zinc-400 mr-1">Filtrar por posição:</span>
            <button
              onClick={() => setRoleFilter('ALL')}
              className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                roleFilter === 'ALL'
                  ? 'bg-[#222834] text-zinc-100 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Todas
            </button>
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer ${
                  roleFilter === r
                    ? 'bg-[#222834] text-orange-400 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>

          <span className="text-xs text-zinc-400 tabular-nums">
            Exibindo <strong className="text-zinc-200">{filteredChampions.length}</strong> campeões
          </span>
        </div>
      </div>

      {/* Unified Elegant Grid */}
      {filteredChampions.length === 0 ? (
        <div className="rm-panel rounded-lg p-10 text-center space-y-3">
          <p className="text-sm text-zinc-300">
            Nenhum campeão encontrado para este filtro.
          </p>
          <button
            onClick={() => {
              setCollectionFilter('ALL');
              setRoleFilter('ALL');
              setQuery('');
            }}
            className="px-4 py-2 rounded-md bg-orange-500 text-zinc-950 font-semibold text-xs cursor-pointer"
          >
            Mostrar todos os {champions.length} campeões
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredChampions.map((champ) => {
            const entry = poolMap.get(champ.id);
            const prof = profileChampion(champ, entry?.roles[0]);
            const defaultRoles = inferChampionRoles(champ);
            const activeRoles = entry ? entry.roles : defaultRoles;

            return (
              <div
                key={champ.id}
                className={`rounded-lg p-4 flex flex-col justify-between gap-3.5 border transition ${
                  entry
                    ? entry.isMain
                      ? 'bg-[#151821] border-orange-500/60'
                      : 'bg-[#141820] border-sky-500/40'
                    : 'bg-[#12151b] border-[#1f242d] hover:border-[#2d3442]'
                }`}
              >
                <div className="space-y-3">
                  {/* Top Row: Portrait + Identity + Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={getChampionIconUrl(patchVersion, champ.imageFull)}
                        alt={champ.name}
                        loading="lazy"
                        onClick={() => setInspectedChampion(champ)}
                        className="w-12 h-12 rounded-md object-cover border border-[#2c3240] cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-sm font-bold text-zinc-100 truncate">{champ.name}</h3>
                          {entry?.isMain && (
                            <span className="px-1.5 py-0.5 rounded bg-orange-500 text-zinc-950 text-[10px] font-bold">
                              MAIN
                            </span>
                          )}
                          {entry && !entry.isMain && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-semibold">
                              NA POOL
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">{prof.archetypeLabel}</p>
                      </div>
                    </div>

                    {/* Quick Favorite / Main Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          if (entry) {
                            upsertPoolEntry({ ...entry, isFavorite: !entry.isFavorite });
                          } else {
                            quickAddChampion(champ, { favorite: true });
                          }
                        }}
                        title={entry?.isFavorite ? 'Remover dos favoritos' : 'Favoritar campeão'}
                        className={`p-1.5 rounded border cursor-pointer transition ${
                          entry?.isFavorite
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                            : 'bg-[#0f1217] border-[#222731] text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          if (entry) {
                            upsertPoolEntry({ ...entry, isMain: !entry.isMain });
                          } else {
                            quickAddChampion(champ, { main: true });
                          }
                        }}
                        title={entry?.isMain ? 'Desmarcar como principal' : 'Definir como campeão principal (Main)'}
                        className={`p-1.5 rounded border cursor-pointer transition ${
                          entry?.isMain
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                            : 'bg-[#0f1217] border-[#222731] text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <Crown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Role Pills (Interactive if in Pool, informational otherwise) */}
                  <div className="flex flex-wrap gap-1">
                    {ROLES.map((r) => {
                      const hasRole = activeRoles.includes(r);
                      if (!entry && !hasRole) return null;
                      return (
                        <button
                          key={r}
                          disabled={!entry}
                          onClick={() => entry && toggleChampionRoleInPool(champ.id, r)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium border transition ${
                            entry ? 'cursor-pointer' : 'cursor-default'
                          } ${
                            hasRole
                              ? 'bg-[#1b212c] text-zinc-200 border-[#2e3646]'
                              : 'bg-[#0f1217] text-zinc-500 border-[#1d222b] hover:text-zinc-300'
                          }`}
                        >
                          {ROLE_LABELS[r]}
                        </button>
                      );
                    })}
                  </div>

                  {/* Familiarity selector when in personal pool */}
                  {entry && (
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <select
                        value={entry.familiarity}
                        onChange={(e) =>
                          upsertPoolEntry({
                            ...entry,
                            familiarity: Number(e.target.value) as 1 | 2 | 3 | 4 | 5,
                          })
                        }
                        className="rm-input flex-1 rounded px-2 py-1 text-xs"
                      >
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {FAMILIARITY_LABELS[lvl]}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => removePoolEntry(champ.id)}
                        title="Remover da Minha Champion Pool"
                        className="p-1.5 rounded bg-[#0f1217] hover:bg-rose-500/20 text-zinc-500 hover:text-rose-300 border border-[#222731] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="flex items-center gap-1.5 pt-2.5 border-t border-[#1e232d]">
                  <button
                    onClick={() => setInspectedChampion(champ)}
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded bg-[#181c24] hover:bg-[#212733] text-xs font-medium text-zinc-300 cursor-pointer transition"
                  >
                    <Eye className="w-3.5 h-3.5" /> Kit
                  </button>

                  {!entry ? (
                    <button
                      onClick={() => quickAddChampion(champ)}
                      className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded bg-[#181c24] hover:bg-[#222834] text-xs font-semibold text-zinc-200 border border-[#29303e] cursor-pointer transition"
                    >
                      <Plus className="w-3.5 h-3.5 text-orange-400" /> Adicionar à Pool
                    </button>
                  ) : (
                    <span className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 text-xs text-emerald-400 font-medium">
                      <Check className="w-3.5 h-3.5" /> Na Minha Pool
                    </span>
                  )}

                  <button
                    onClick={() => {
                      setUserControl(activeRoles[0] || 'MID', champ.id);
                      setActivePage('draft');
                    }}
                    title="Usar como meu campeão no Draft 5x5"
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded bg-orange-500/15 hover:bg-orange-500/25 text-orange-300 border border-orange-500/30 text-xs font-semibold cursor-pointer transition"
                  >
                    <Swords className="w-3.5 h-3.5" /> Draft
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
