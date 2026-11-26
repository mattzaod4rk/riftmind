import React, { useEffect, useMemo, useState } from 'react';
import { Search, Star, X, Trash2, Check, UserCheck } from 'lucide-react';
import { ROLES, ROLE_LABELS, type ChampionData, type ChampionPoolEntry, type Role } from '../../shared/types.ts';
import { inferChampionRoles } from '../../shared/engine/championProfiler.ts';
import { championMatchesRole, filterChampions } from '../../shared/championFilter.ts';
import type { DraftSide } from '../../shared/draftState.ts';
import { getChampionIconUrl } from '../lib/assets.ts';

export function ChampionPickerModal({
  open,
  team,
  teamLabel,
  targetRole,
  currentChampionId,
  isControlledSlot,
  championUsage,
  champions,
  championPool,
  patchVersion,
  onSelect,
  onClose,
}: {
  open: boolean;
  team: DraftSide;
  teamLabel: string;
  targetRole: Role;
  currentChampionId: string | null;
  isControlledSlot: boolean;
  championUsage: Map<string, { team: DraftSide; role: Role }>;
  champions: ChampionData[];
  championPool: ChampionPoolEntry[];
  patchVersion: string;
  onSelect: (championId: string | null, opts?: { controlled?: boolean }) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [onlyMyPool, setOnlyMyPool] = useState(false);
  const [markAsControlled, setMarkAsControlled] = useState(isControlledSlot);

  useEffect(() => {
    if (open) {
      setQuery('');
      setRoleFilter('ALL');
      setOnlyMyPool(false);
      setMarkAsControlled(isControlledSlot);
    }
  }, [open, targetRole, team, isControlledSlot]);

  const poolMap = useMemo(() => new Map(championPool.map((p) => [p.championId, p])), [championPool]);
  const poolIdSet = useMemo(() => new Set(championPool.map((p) => p.championId)), [championPool]);
  const roleOverrides = useMemo(
    () => new Map(championPool.map((p) => [p.championId, p.roles])),
    [championPool],
  );

  const filtered = useMemo(() => {
    return filterChampions(champions, {
      query,
      role: roleFilter,
      onlyIds: onlyMyPool ? poolIdSet : null,
      roleOverrides,
      queryOverridesRole: false,
    });
  }, [champions, query, roleFilter, onlyMyPool, poolIdSet, roleOverrides]);

  if (!open) return null;

  const currentChampion = currentChampionId
    ? champions.find((c) => c.id === currentChampionId) || null
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="rm-panel rounded-lg max-w-5xl w-full max-h-[88vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[#222731] bg-[#101217]">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                  team === 'ally'
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                }`}
              >
                {teamLabel} • {ROLE_LABELS[targetRole]}
              </span>
              {currentChampion && (
                <span className="text-xs text-zinc-400">
                  Atual: <strong className="text-zinc-200">{currentChampion.name}</strong>
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-zinc-100 mt-1">
              {currentChampion ? `Substituir campeão em ${ROLE_LABELS[targetRole]}` : `Escolher campeão para ${ROLE_LABELS[targetRole]}`}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {currentChampionId && (
              <button
                onClick={() => {
                  onSelect(null);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold cursor-pointer transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remover escolha
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Fechar seletor"
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#1c2029] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filters Toolbar */}
        <div className="px-5 py-3.5 border-b border-[#222731] bg-[#101318] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filtered.length > 0) {
                    onSelect(filtered[0].id, { controlled: team === 'ally' ? markAsControlled : undefined });
                    onClose();
                  }
                }}
                placeholder="Pesquisar qualquer campeão por nome (ex: Ahri, Ornn, Kai'Sa, Lee Sin)..."
                className="rm-input w-full pl-9 pr-8 py-2 rounded-md text-sm placeholder-zinc-500"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Limpar pesquisa"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {team === 'ally' && (
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-[#151922] border border-[#262c38] text-xs font-medium text-zinc-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={markAsControlled}
                  onChange={(e) => setMarkAsControlled(e.target.checked)}
                  className="accent-orange-500 rounded"
                />
                <UserCheck className="w-3.5 h-3.5 text-orange-400" />
                <span>Definir como meu campeão controlado</span>
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setRoleFilter('ALL')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                  roleFilter === 'ALL'
                    ? 'bg-orange-500 text-zinc-950'
                    : 'bg-[#171b22] text-zinc-300 hover:bg-[#1f242e] border border-[#262c38]'
                }`}
              >
                Todos ({champions.length})
              </button>
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                    roleFilter === r
                      ? 'bg-orange-500 text-zinc-950'
                      : r === targetRole
                        ? 'bg-[#171b22] text-orange-300 border border-orange-500/40 hover:bg-[#1f242e]'
                        : 'bg-[#171b22] text-zinc-300 hover:bg-[#1f242e] border border-[#262c38]'
                  }`}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}

              {championPool.length > 0 && (
                <button
                  onClick={() => setOnlyMyPool((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                    onlyMyPool
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50'
                      : 'bg-[#171b22] text-zinc-300 hover:bg-[#1f242e] border border-[#262c38]'
                  }`}
                >
                  <Star className="w-3.5 h-3.5" /> Minha Pool ({championPool.length})
                </button>
              )}
            </div>

            <div className="text-xs text-zinc-400 tabular-nums">
              Exibindo <strong className="text-zinc-200">{filtered.length}</strong> de {champions.length} campeões
              {roleFilter !== 'ALL' && (
                <button
                  onClick={() => setRoleFilter('ALL')}
                  className="ml-2 text-orange-400 hover:underline cursor-pointer"
                >
                  (Ver todos p/ escolha flexível)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Champion Grid */}
        <div className="p-4 overflow-y-auto grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
          {filtered.map((champ) => {
            const usage = championUsage.get(champ.id);
            const isCurrent = champ.id === currentChampionId;
            const inUseElsewhere = Boolean(usage && !isCurrent);
            const poolEntry = poolMap.get(champ.id);
            const matchesTargetRole = championMatchesRole(champ, targetRole, roleOverrides);
            const rolesList = inferChampionRoles(champ);

            return (
              <button
                key={champ.id}
                onClick={() => {
                  onSelect(champ.id, { controlled: team === 'ally' ? markAsControlled : undefined });
                  onClose();
                }}
                className={`group relative flex flex-col items-center p-2.5 rounded-md border text-center transition cursor-pointer ${
                  isCurrent
                    ? 'bg-orange-500/15 border-orange-500'
                    : inUseElsewhere
                      ? 'bg-[#101318] border-[#222731] opacity-65 hover:opacity-100 hover:border-zinc-500'
                      : 'bg-[#141820] border-[#222731] hover:border-orange-500/60 hover:bg-[#191e28]'
                }`}
              >
                <div className="relative">
                  <img
                    src={getChampionIconUrl(patchVersion, champ.imageFull)}
                    alt={champ.name}
                    loading="lazy"
                    className="w-13 h-13 rounded object-cover border border-[#2c3240]"
                  />
                  {poolEntry && (
                    <span
                      title="Na Minha Champion Pool"
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-zinc-950 flex items-center justify-center text-[10px] font-bold"
                    >
                      ★
                    </span>
                  )}
                  {isCurrent && (
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-zinc-950 flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>

                <span className="text-xs font-semibold text-zinc-100 mt-2 truncate w-full">{champ.name}</span>

                {inUseElsewhere && usage ? (
                  <span className="text-[11px] text-orange-400 font-medium truncate w-full">
                    Em uso ({usage.team === 'ally' ? 'Aliado' : 'Inimigo'} • {ROLE_LABELS[usage.role]})
                  </span>
                ) : (
                  <span
                    className={`text-[11px] truncate w-full ${
                      matchesTargetRole ? 'text-zinc-400' : 'text-zinc-500'
                    }`}
                  >
                    {rolesList.map((r) => ROLE_LABELS[r]).join(' / ')}
                  </span>
                )}
              </button>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center space-y-3">
              <p className="text-sm text-zinc-400">
                Nenhum campeão encontrado com o filtro atual.
              </p>
              <button
                onClick={() => {
                  setRoleFilter('ALL');
                  setOnlyMyPool(false);
                }}
                className="px-3.5 py-1.5 rounded-md bg-orange-500 text-zinc-950 text-xs font-semibold cursor-pointer"
              >
                Mostrar todos os {champions.length} campeões
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
