import React, { useState } from 'react';
import { SlidersHorizontal, Plus, X, ArrowRight, AlertTriangle } from 'lucide-react';
import { ROLES, type LiveSituationRecalculation } from '../../shared/types.ts';
import { useRiftMind } from '../context/RiftMindContext.tsx';
import { getItemIconUrl } from '../lib/assets.ts';

export function LiveSituationPanel({ recalculation }: { recalculation?: LiveSituationRecalculation }) {
  const { draft, updateLiveSituation, championMap, items, itemMap, patchVersion } = useRiftMind();
  const live = draft.liveSituation;
  const [itemSearch, setItemSearch] = useState('');

  const allyChampIds = ROLES.map((r) => draft.allyTeam[r]).filter(Boolean) as string[];
  const enemyChampIds = ROLES.map((r) => draft.enemyTeam[r]).filter(Boolean) as string[];

  const quickBuyableItems = items
    .filter(
      (i) =>
        i.srValid &&
        i.goldTotal > 0 &&
        (!itemSearch.trim() || i.name.toLowerCase().includes(itemSearch.trim().toLowerCase())),
    )
    .slice(0, 12);

  const removeOwnedAt = (index: number) => {
    const next = [...live.purchasedItemIds];
    next.splice(index, 1);
    updateLiveSituation({ purchasedItemIds: next });
  };

  return (
    <section className="rm-panel rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-4 h-4 text-orange-400 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Atualizar Situação da Partida</h3>
            <p className="text-xs text-zinc-400">
              Ajuste minuto, ouro em mãos, itens já comprados e estado do jogo para recalcular a melhor compra imediata.
            </p>
          </div>
        </div>

        <button
          onClick={() => updateLiveSituation({ enabled: !live.enabled })}
          className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
            live.enabled
              ? 'bg-orange-500 text-zinc-950'
              : 'bg-[#1a1f28] text-zinc-200 hover:bg-[#222834] border border-[#2c3342]'
          }`}
        >
          {live.enabled ? 'Recálculo em tempo real ativo' : 'Ativar recálculo da partida'}
        </button>
      </div>

      {live.enabled && (
        <div className="space-y-4 pt-3 border-t border-[#222731]">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">Minuto atual</label>
              <input
                type="number"
                min={1}
                max={60}
                value={live.minute}
                onChange={(e) => updateLiveSituation({ minute: Math.max(1, Number(e.target.value) || 1) })}
                className="rm-input w-full rounded-md px-2.5 py-1.5 text-sm font-semibold tabular-nums"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">Ouro disponível</label>
              <input
                type="number"
                step={50}
                min={0}
                max={15000}
                value={live.availableGold}
                onChange={(e) => updateLiveSituation({ availableGold: Math.max(0, Number(e.target.value) || 0) })}
                className="rm-input w-full rounded-md px-2.5 py-1.5 text-sm font-semibold text-orange-400 tabular-nums"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">Resultado da rota</label>
              <select
                value={live.laneOutcome}
                onChange={(e) => updateLiveSituation({ laneOutcome: e.target.value as any })}
                className="rm-input w-full rounded-md px-2.5 py-1.5 text-xs font-medium"
              >
                <option value="winning">Vencendo a rota</option>
                <option value="even">Rota equilibrada</option>
                <option value="losing">Perdendo / pressionado</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">Estado geral</label>
              <select
                value={live.gameState}
                onChange={(e) => updateLiveSituation({ gameState: e.target.value as any })}
                className="rm-input w-full rounded-md px-2.5 py-1.5 text-xs font-medium"
              >
                <option value="ahead">Na frente</option>
                <option value="even">Partida parelha</option>
                <option value="behind">Atrás</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">Inimigo mais forte</label>
              <select
                value={live.fedEnemyId || ''}
                onChange={(e) => updateLiveSituation({ fedEnemyId: e.target.value || null })}
                className="rm-input w-full rounded-md px-2.5 py-1.5 text-xs font-medium"
              >
                <option value="">Nenhum</option>
                {enemyChampIds.map((id) => (
                  <option key={id} value={id}>
                    {championMap.get(id)?.name || id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-zinc-400 block mb-1">Aliado carregando</label>
              <select
                value={live.carryingAllyId || ''}
                onChange={(e) => updateLiveSituation({ carryingAllyId: e.target.value || null })}
                className="rm-input w-full rounded-md px-2.5 py-1.5 text-xs font-medium"
              >
                <option value="">Nenhum</option>
                {allyChampIds.map((id) => (
                  <option key={id} value={id}>
                    {championMap.get(id)?.name || id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Inventory */}
          <div className="p-3.5 rounded-md bg-[#0f1217] border border-[#1e232d] space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-medium text-zinc-300">
                Itens já comprados ({live.purchasedItemIds.length})
              </span>
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Adicionar item ao inventário..."
                className="rm-input rounded-md px-2.5 py-1 text-xs w-64"
              />
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              {live.purchasedItemIds.map((id, idx) => {
                const it = itemMap.get(id);
                if (!it) return null;
                return (
                  <button
                    key={`${id}_${idx}`}
                    onClick={() => removeOwnedAt(idx)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#181c24] border border-[#2a303d] text-xs text-zinc-200 hover:border-rose-500/50 cursor-pointer"
                    title="Remover item"
                  >
                    <img src={getItemIconUrl(patchVersion, it.imageFull)} alt={it.name} className="w-4 h-4 rounded-xs" />
                    <span>{it.name}</span>
                    <X className="w-3 h-3 text-zinc-500" />
                  </button>
                );
              })}
              {live.purchasedItemIds.length === 0 && (
                <span className="text-xs text-zinc-500">Nenhum item adicionado ao inventário atual.</span>
              )}
            </div>

            {itemSearch.trim() && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#1e232d]">
                {quickBuyableItems.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => {
                      updateLiveSituation({ purchasedItemIds: [...live.purchasedItemIds, it.id] });
                      setItemSearch('');
                    }}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#161a22] hover:bg-[#1e2430] border border-[#262c38] text-xs text-zinc-200 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-orange-400" />
                    <img src={getItemIconUrl(patchVersion, it.imageFull)} alt={it.name} className="w-4 h-4 rounded-xs" />
                    <span>{it.name}</span>
                    <span className="text-zinc-400 tabular-nums">{it.goldTotal}g</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {recalculation && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
              <div className="p-4 rounded-md bg-[#0f1217] border border-[#242a35] space-y-2.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                  Melhor compra agora ({live.availableGold}g)
                </div>
                {recalculation.bestImmediateBuyComponents.items.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {recalculation.bestImmediateBuyComponents.items.map((it, idx) => (
                      <div
                        key={`${it.id}_${idx}`}
                        className="flex items-center gap-2.5 p-2 rounded bg-[#161a22] border border-[#262c38]"
                      >
                        <img src={getItemIconUrl(patchVersion, it.imageFull)} alt={it.name} className="w-8 h-8 rounded" />
                        <div>
                          <div className="text-xs font-semibold text-zinc-100">{it.name}</div>
                          <div className="text-xs text-orange-400 tabular-nums">{it.goldTotal}g</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-400">Guarde ouro para o próximo componente.</div>
                )}
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {recalculation.bestImmediateBuyComponents.explanation}
                </p>
                {recalculation.bestNextCompletedItem && (
                  <div className="flex items-center gap-1.5 text-xs text-sky-400 pt-1 tabular-nums">
                    <ArrowRight className="w-3.5 h-3.5" />
                    Próximo item fechado: <strong>{recalculation.bestNextCompletedItem.name}</strong> (restam{' '}
                    {recalculation.remainingCostForNextItem}g)
                  </div>
                )}
              </div>

              <div className="p-4 rounded-md bg-[#0f1217] border border-[#242a35] space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-sky-400">
                  Alternativas & Itens adiados
                </div>
                {recalculation.alternativeImmediateBuys.map((alt) => (
                  <div key={alt.item.id} className="flex items-start gap-2 text-xs">
                    <img
                      src={getItemIconUrl(patchVersion, alt.item.imageFull)}
                      alt={alt.item.name}
                      className="w-5 h-5 rounded mt-0.5 shrink-0"
                    />
                    <div>
                      <span className="font-semibold text-zinc-100">{alt.item.name}</span>{' '}
                      <span className="text-zinc-400 tabular-nums">({alt.cost}g)</span>:{' '}
                      <span className="text-zinc-400">{alt.reason}</span>
                    </div>
                  </div>
                ))}
                {recalculation.postponedItems.map((post) => (
                  <div key={post.item.id} className="flex items-start gap-1.5 text-xs text-zinc-300 pt-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                    <span>{post.reason}</span>
                  </div>
                ))}
                {recalculation.alternativeImmediateBuys.length === 0 &&
                  recalculation.postponedItems.length === 0 && (
                    <p className="text-xs text-zinc-500">Sem desvios necessários na receita principal.</p>
                  )}
              </div>

              <div className="p-4 rounded-md bg-[#0f1217] border border-[#242a35] space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  Ajustes táticos na partida
                </div>
                <ul className="space-y-1.5 text-xs text-zinc-300">
                  {recalculation.tacticalAdjustments.map((adj, i) => (
                    <li key={i} className="leading-relaxed">
                      • {adj}
                    </li>
                  ))}
                  {recalculation.tacticalAdjustments.length === 0 && (
                    <li className="text-zinc-500">Mantenha o plano padrão da composição.</li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
