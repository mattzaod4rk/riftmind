import React, { useMemo, useState } from 'react';
import { Search, ShieldCheck, GitBranch, AlertCircle, CheckCircle2, Swords } from 'lucide-react';
import { ROLE_LABELS, type ItemComponentNode, type ItemData } from '../../shared/types.ts';
import { useRiftMind } from '../context/RiftMindContext.tsx';
import { LiveSituationPanel } from '../components/LiveSituationPanel.tsx';
import { getChampionIconUrl, getItemIconUrl } from '../lib/assets.ts';

function ComponentTreeView({ node, patchVersion }: { node: ItemComponentNode; patchVersion: string }) {
  if (node.children.length === 0) return null;
  return (
    <div className="pt-3 border-t border-[#1e232d]">
      <div className="text-xs text-zinc-400 flex items-center gap-1.5 mb-2 tabular-nums">
        <GitBranch className="w-3.5 h-3.5 text-zinc-500" />
        <span>
          Receita de componentes (custo de combinação: <strong className="text-zinc-200">{node.goldBase}g</strong>)
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {node.children.map((ch, idx) => (
          <div
            key={`${ch.id}_${idx}`}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-[#0f1217] border border-[#1f242d]"
          >
            <img src={getItemIconUrl(patchVersion, ch.imageFull)} alt={ch.name} className="w-6 h-6 rounded-xs" />
            <div>
              <div className="text-xs font-medium text-zinc-200">{ch.name}</div>
              <div className="text-[11px] text-zinc-400 tabular-nums">{ch.goldTotal}g</div>
            </div>
            {ch.children.length > 0 && (
              <div className="flex items-center gap-1 pl-1.5 border-l border-[#222731]">
                {ch.children.map((leaf, lIdx) => (
                  <img
                    key={`${leaf.id}_${lIdx}`}
                    src={getItemIconUrl(patchVersion, leaf.imageFull)}
                    alt={`${leaf.name} (${leaf.goldTotal}g)`}
                    title={`${leaf.name} (${leaf.goldTotal}g)`}
                    className="w-4 h-4 rounded-xs opacity-80"
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BuildsPage() {
  const { analysis, items, patchVersion, setActivePage } = useRiftMind();
  const [viewMode, setViewMode] = useState<'RECOMMENDED' | 'CATALOG'>('RECOMMENDED');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<ItemData | null>(null);

  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    return items.filter((it) => {
      if (categoryFilter !== 'ALL' && it.category !== categoryFilter) return false;
      if (q && !it.name.toLowerCase().includes(q) && !it.cleanDescription.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, catalogQuery, categoryFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#1f242d]">
        <div className="flex items-center gap-3.5">
          {analysis && (
            <img
              src={getChampionIconUrl(patchVersion, analysis.userChampion.imageFull)}
              alt={analysis.userChampion.name}
              className="w-12 h-12 rounded-md border border-orange-500 object-cover"
            />
          )}
          <div>
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
              {analysis
                ? `Builds e Itens — ${analysis.userChampion.name} (${ROLE_LABELS[analysis.userRole]})`
                : 'Builds e Catálogo de Itens do Summoner’s Rift'}
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              {analysis
                ? analysis.build.buildIdentitySummary
                : 'Monte uma composição no Analisador de Draft para gerar uma build contextualizada ou explore o catálogo oficial.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('RECOMMENDED')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
              viewMode === 'RECOMMENDED'
                ? 'bg-orange-500 text-zinc-950'
                : 'bg-[#171b22] text-zinc-300 hover:bg-[#1f242e] border border-[#262c38]'
            }`}
          >
            Build Contextualizada
          </button>
          <button
            onClick={() => setViewMode('CATALOG')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
              viewMode === 'CATALOG'
                ? 'bg-orange-500 text-zinc-950'
                : 'bg-[#171b22] text-zinc-300 hover:bg-[#1f242e] border border-[#262c38]'
            }`}
          >
            Catálogo Mapa 11 ({items.length})
          </button>
        </div>
      </header>

      {viewMode === 'RECOMMENDED' ? (
        !analysis ? (
          <div className="rm-panel rounded-lg p-8 text-center space-y-3">
            <h2 className="text-base font-semibold text-zinc-100">
              Nenhuma composição em análise no momento
            </h2>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Selecione seu campeão controlado e os integrantes da partida no Analisador de Draft 5x5 para receber a
              ordem de compra completa e itens situacionais.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => setActivePage('draft')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-orange-500 hover:bg-orange-400 text-zinc-950 font-semibold text-xs cursor-pointer"
              >
                <Swords className="w-3.5 h-3.5" /> Abrir Analisador de Draft
              </button>
              <button
                onClick={() => setViewMode('CATALOG')}
                className="px-4 py-2 rounded-md bg-[#171b22] hover:bg-[#1f242e] text-xs font-medium text-zinc-200 border border-[#262c38] cursor-pointer"
              >
                Explorar Catálogo de Itens
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Visual Buy Order Timeline Bar */}
            <section className="rm-panel rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-orange-400">
                  Resumo da Ordem de Compra Recomendada
                </h2>
                <span className="text-xs text-zinc-400">
                  Adaptada às ameaças e sinergias do draft atual
                </span>
              </div>

              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                {analysis.build.slots.map((slot, idx) => (
                  <div
                    key={slot.slotKey}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-md bg-[#0f1217] border border-[#1f242d] shrink-0"
                  >
                    <span className="w-5 h-5 rounded bg-orange-500 text-zinc-950 font-bold text-xs flex items-center justify-center tabular-nums">
                      {idx + 1}
                    </span>
                    <img
                      src={getItemIconUrl(patchVersion, slot.item.imageFull)}
                      alt={slot.item.name}
                      className="w-11 h-11 rounded border border-[#2c3240]"
                    />
                    <div>
                      <div className="text-xs font-semibold text-zinc-100">{slot.item.name}</div>
                      <div className="text-xs text-orange-400 font-medium tabular-nums">{slot.item.goldTotal}g</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Live Match Situation Recalculator */}
            <LiveSituationPanel recalculation={analysis.build.liveRecalculation} />

            {/* Unique Passive Exclusivity Notes */}
            {analysis.build.uniquePassiveNotes.length > 0 && (
              <div className="rm-panel-subtle rounded-md p-4 space-y-1.5">
                <div className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Regras de Exclusividade de Passivas Únicas Aplicadas
                </div>
                {analysis.build.uniquePassiveNotes.map((note, idx) => (
                  <p key={idx} className="text-xs text-zinc-300">
                    • {note}
                  </p>
                ))}
              </div>
            )}

            {/* Essential Items Detailed Progression */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-zinc-100">
                  1. Itens Essenciais e Progressão Completa
                </h2>
                <span className="text-xs text-zinc-400">
                  Atributos oficiais, árvore de componentes e justificativa por etapa
                </span>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {analysis.build.slots.map((slot, idx) => (
                  <div
                    key={slot.slotKey}
                    className="rm-panel rounded-lg p-5 space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      {/* Item Header with Larger Image */}
                      <div className="flex items-start gap-4">
                        <div className="relative shrink-0">
                          <img
                            src={getItemIconUrl(patchVersion, slot.item.imageFull)}
                            alt={slot.item.name}
                            className="w-14 h-14 rounded-md border border-[#2d3340]"
                          />
                          <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded bg-orange-500 text-zinc-950 font-bold text-xs flex items-center justify-center tabular-nums">
                            {idx + 1}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                              {slot.slotLabel}
                            </span>
                            <span className="text-xs font-bold text-zinc-100 tabular-nums">
                              {slot.item.goldTotal} de ouro
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-zinc-100 mt-0.5">{slot.item.name}</h3>
                          {slot.item.features.statLines.length > 0 && (
                            <p className="text-xs text-zinc-400 mt-1">
                              {slot.item.features.statLines.join(' • ')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Clean Justification Table */}
                      <div className="space-y-2 text-xs border-t border-[#1e232d] pt-3">
                        <div className="grid grid-cols-[110px_1fr] gap-2">
                          <span className="font-semibold text-zinc-400">Motivo:</span>
                          <span className="text-zinc-200 leading-relaxed">{slot.reason}</span>
                        </div>
                        <div className="grid grid-cols-[110px_1fr] gap-2">
                          <span className="font-semibold text-zinc-400">Benefício:</span>
                          <span className="text-zinc-300 leading-relaxed">{slot.benefit}</span>
                        </div>
                        <div className="grid grid-cols-[110px_1fr] gap-2">
                          <span className="font-semibold text-zinc-400">Quando comprar:</span>
                          <span className="text-zinc-300 leading-relaxed">{slot.whenToBuy}</span>
                        </div>
                      </div>

                      {/* Official Passives & Actives */}
                      {slot.item.features.passiveBlocks.length > 0 && (
                        <div className="space-y-1.5 p-3 rounded bg-[#0f1217] border border-[#1e232d] text-xs">
                          {slot.item.features.passiveBlocks.map((pb, pIdx) => (
                            <div key={pIdx} className="leading-relaxed">
                              <strong className={pb.isActive ? 'text-orange-400' : 'text-sky-400'}>
                                {pb.isActive ? 'Ativa' : 'Passiva'} ({pb.name}):{' '}
                              </strong>
                              <span className="text-zinc-300">{pb.text}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <ComponentTreeView node={slot.componentTree} patchVersion={patchVersion} />
                    </div>

                    {/* Alternative & Tier 3 Boot Upgrade */}
                    {(slot.tier3BootUpgrade || slot.alternative) && (
                      <div className="space-y-2 pt-3 border-t border-[#1e232d] text-xs">
                        {slot.tier3BootUpgrade && (
                          <div className="flex items-center gap-2.5 text-zinc-300">
                            <img
                              src={getItemIconUrl(patchVersion, slot.tier3BootUpgrade.imageFull)}
                              alt={slot.tier3BootUpgrade.name}
                              className="w-7 h-7 rounded shrink-0"
                            />
                            <div>
                              <span className="font-semibold text-sky-400">
                                Evolução Tier 3 ({slot.tier3BootUpgrade.name}):
                              </span>{' '}
                              <span className="text-zinc-400">
                                Desbloqueada após 2 itens lendários com Proezas de Força.
                              </span>
                            </div>
                          </div>
                        )}

                        {slot.alternative && (
                          <div className="flex items-start gap-2.5 text-zinc-300">
                            <img
                              src={getItemIconUrl(patchVersion, slot.alternative.item.imageFull)}
                              alt={slot.alternative.item.name}
                              className="w-7 h-7 rounded shrink-0 mt-0.5"
                            />
                            <div>
                              <span className="font-semibold text-zinc-200">
                                Alternativa: {slot.alternative.item.name} ({slot.alternative.item.goldTotal}g)
                              </span>{' '}
                              — <span className="text-zinc-400">{slot.alternative.whenToPrefer}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Situational Items Section */}
            <section className="space-y-4 pt-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-bold text-zinc-100">2. Itens Situacionais Condicionais</h2>
                  <p className="text-xs text-zinc-400">
                    Respostas específicas para ameaças da composição inimiga: quando comprar, por que comprar e quando
                    evitar.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.build.situationalItems.map((sit, idx) => (
                  <div
                    key={`${sit.item.id}_${idx}`}
                    className={`rounded-lg p-5 space-y-3 border ${
                      sit.isTriggeredByCurrentDraft
                        ? 'bg-[#151821] border-orange-500/50'
                        : 'bg-[#13161c] border-[#222731]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                        {sit.conditionCategory}
                      </span>
                      {sit.isTriggeredByCurrentDraft ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[11px] font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> Recomendado neste draft
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-500">Condicional</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3.5">
                      <img
                        src={getItemIconUrl(patchVersion, sit.item.imageFull)}
                        alt={sit.item.name}
                        className="w-12 h-12 rounded-md border border-[#2c3240]"
                      />
                      <div>
                        <div className="text-sm font-bold text-zinc-100">{sit.item.name}</div>
                        <div className="text-xs text-orange-400 font-medium tabular-nums">{sit.item.goldTotal}g</div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs pt-2 border-t border-[#1e232d]">
                      <p className="leading-relaxed">
                        <strong className="text-zinc-200">Quando comprar:</strong>{' '}
                        <span className="text-zinc-300">{sit.whenToBuy}</span>
                      </p>
                      <p className="leading-relaxed">
                        <strong className="text-zinc-200">Por que comprar:</strong>{' '}
                        <span className="text-zinc-300">{sit.whyBuy}</span>
                      </p>
                      <p className="leading-relaxed">
                        <strong className="text-zinc-400">Quando evitar:</strong>{' '}
                        <span className="text-zinc-400">{sit.whenToAvoid}</span>
                      </p>
                      {sit.uniqueGroupConflict && (
                        <p className="text-xs text-orange-300 flex items-center gap-1 pt-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Passiva única ({sit.uniqueGroupConflict}): substitua o item equivalente em vez de acumular.
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )
      ) : (
        /* Map 11 Catalog */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="rm-panel rounded-lg p-3.5 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  placeholder="Pesquisar item oficial em pt_BR..."
                  className="rm-input w-full pl-9 pr-3 py-1.5 rounded-md text-xs"
                />
              </div>
              {[
                { k: 'ALL', label: 'Todos SR' },
                { k: 'completed', label: 'Finais' },
                { k: 'boots_t2', label: 'Botas' },
                { k: 'support_quest', label: 'Suporte' },
                { k: 'starter', label: 'Iniciais' },
                { k: 'component', label: 'Componentes' },
              ].map((cat) => (
                <button
                  key={cat.k}
                  onClick={() => setCategoryFilter(cat.k)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                    categoryFilter === cat.k
                      ? 'bg-orange-500 text-zinc-950'
                      : 'bg-[#171b22] text-zinc-300 border border-[#262c38]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[68vh] overflow-y-auto pr-1">
              {filteredCatalog.map((it) => (
                <button
                  key={it.id}
                  onClick={() => setSelectedCatalogItem(it)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-md border text-left transition cursor-pointer ${
                    selectedCatalogItem?.id === it.id
                      ? 'bg-orange-500/15 border-orange-500'
                      : 'bg-[#13161c] border-[#222731] hover:border-[#323948]'
                  }`}
                >
                  <img
                    src={getItemIconUrl(patchVersion, it.imageFull)}
                    alt={it.name}
                    loading="lazy"
                    className="w-10 h-10 rounded shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-100 truncate">{it.name}</div>
                    <div className="text-xs text-orange-400 tabular-nums">{it.goldTotal}g</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rm-panel rounded-lg p-5 h-fit sticky top-4">
            {selectedCatalogItem ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3.5">
                  <img
                    src={getItemIconUrl(patchVersion, selectedCatalogItem.imageFull)}
                    alt={selectedCatalogItem.name}
                    className="w-14 h-14 rounded-md border border-[#2d3340]"
                  />
                  <div>
                    <h3 className="text-base font-bold text-zinc-100">{selectedCatalogItem.name}</h3>
                    <div className="text-xs text-orange-400 font-semibold tabular-nums">
                      Custo: {selectedCatalogItem.goldTotal}g (Venda: {selectedCatalogItem.goldSell}g)
                    </div>
                    <div className="text-xs text-zinc-500 tabular-nums">ID Data Dragon: {selectedCatalogItem.id}</div>
                  </div>
                </div>
                <p className="text-xs text-zinc-300 whitespace-pre-line leading-relaxed pt-2 border-t border-[#1e232d]">
                  {selectedCatalogItem.cleanDescription}
                </p>
              </div>
            ) : (
              <p className="text-xs text-zinc-400 leading-relaxed">
                Selecione qualquer item ao lado para inspecionar seus atributos oficiais, descrição completa em
                português e custo no Patch {patchVersion}.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
