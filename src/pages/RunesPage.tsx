import React, { useState } from 'react';
import { Sparkles, CheckCircle2, Swords } from 'lucide-react';
import { ROLE_LABELS, type RunePageConfig } from '../../shared/types.ts';
import { useRiftMind } from '../context/RiftMindContext.tsx';
import { getChampionIconUrl, getRuneIconUrl, getSpellIconUrl } from '../lib/assets.ts';

function RunePageBoard({
  config,
  patchVersion,
  isPrimaryRecommended,
}: {
  config: RunePageConfig;
  patchVersion: string;
  isPrimaryRecommended?: boolean;
}) {
  const selectedIds = new Set<number>([
    config.keystone.id,
    ...config.primaryRunes.map((r) => r.id),
    ...config.secondaryRunes.map((r) => r.id),
  ]);

  return (
    <section
      className={`rounded-lg p-5 space-y-5 border ${
        isPrimaryRecommended
          ? 'bg-[#141820] border-orange-500/50'
          : 'bg-[#13161c] border-[#222731]'
      }`}
    >
      <div className="flex items-start justify-between flex-wrap gap-2 pb-3 border-b border-[#1f242d]">
        <div>
          <span
            className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
              isPrimaryRecommended
                ? 'bg-orange-500 text-zinc-950 font-bold'
                : 'bg-[#1c212b] text-zinc-300'
            }`}
          >
            {config.postureLabel}
          </span>
          <h2 className="text-base font-bold text-zinc-100 mt-1.5">{config.title}</h2>
          <p className="text-xs text-zinc-400 mt-0.5">{config.overallReasoning}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Primary Tree */}
        <div className="p-4 rounded-md bg-[#0f1217] border border-[#1e232d] space-y-4">
          <div className="flex items-center gap-2.5">
            <img
              src={getRuneIconUrl(config.primaryTree.icon)}
              alt={config.primaryTree.name}
              className="w-7 h-7"
            />
            <div>
              <div className="text-[11px] font-semibold uppercase text-orange-400">Árvore Primária</div>
              <div className="text-sm font-bold text-zinc-100">{config.primaryTree.name}</div>
            </div>
          </div>

          <div className="space-y-3">
            {config.primaryTree.slots.map((slot, sIdx) => (
              <div key={sIdx} className="flex items-center justify-around gap-2">
                {slot.runes.map((r) => {
                  const active = selectedIds.has(r.id);
                  return (
                    <div
                      key={r.id}
                      title={`${r.name}: ${r.cleanDesc}`}
                      className={`flex flex-col items-center text-center transition ${
                        active ? 'opacity-100' : 'opacity-25 grayscale'
                      }`}
                    >
                      <div
                        className={`rounded-full p-1 border ${
                          active
                            ? sIdx === 0
                              ? 'border-orange-500 bg-orange-500/15'
                              : 'border-sky-400 bg-sky-500/15'
                            : 'border-[#222731]'
                        }`}
                      >
                        <img
                          src={getRuneIconUrl(r.icon)}
                          alt={r.name}
                          className={sIdx === 0 ? 'w-11 h-11' : 'w-8 h-8'}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-zinc-200 mt-1 max-w-[88px] truncate">
                        {r.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Secondary Tree + Shards + Summoner Spells */}
        <div className="space-y-4">
          <div className="p-4 rounded-md bg-[#0f1217] border border-[#1e232d] space-y-3">
            <div className="flex items-center gap-2.5">
              <img
                src={getRuneIconUrl(config.secondaryTree.icon)}
                alt={config.secondaryTree.name}
                className="w-6 h-6"
              />
              <div>
                <div className="text-[11px] font-semibold uppercase text-sky-400">Árvore Secundária</div>
                <div className="text-sm font-bold text-zinc-100">{config.secondaryTree.name}</div>
              </div>
            </div>

            <div className="space-y-2.5">
              {config.secondaryTree.slots.slice(1).map((slot, sIdx) => (
                <div key={sIdx} className="flex items-center justify-around gap-2">
                  {slot.runes.map((r) => {
                    const active = selectedIds.has(r.id);
                    return (
                      <div
                        key={r.id}
                        title={`${r.name}: ${r.cleanDesc}`}
                        className={`flex flex-col items-center text-center ${
                          active ? 'opacity-100' : 'opacity-25 grayscale'
                        }`}
                      >
                        <div
                          className={`rounded-full p-1 border ${
                            active ? 'border-sky-400 bg-sky-500/15' : 'border-[#222731]'
                          }`}
                        >
                          <img src={getRuneIconUrl(r.icon)} alt={r.name} className="w-7 h-7" />
                        </div>
                        <span className="text-[11px] text-zinc-200 mt-0.5 max-w-[84px] truncate">{r.name}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Stat Shards */}
            <div className="p-3.5 rounded-md bg-[#0f1217] border border-[#1e232d] space-y-2">
              <div className="text-[11px] font-semibold uppercase text-zinc-400">Fragmentos de Atributo</div>
              <div className="space-y-1.5">
                {config.statShards.map((sh) => (
                  <div key={sh.id} className="flex items-center gap-2 text-xs">
                    <img
                      src={getRuneIconUrl(sh.iconUrl)}
                      alt={sh.name}
                      className="w-5 h-5 rounded-full bg-[#161a22] border border-[#2c3240] p-0.5"
                    />
                    <span className="font-medium text-zinc-200 truncate">{sh.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summoner Spells */}
            <div className="p-3.5 rounded-md bg-[#0f1217] border border-[#1e232d] space-y-2">
              <div className="text-[11px] font-semibold uppercase text-zinc-400">Feitiços de Invocador</div>
              <div className="space-y-2">
                {config.summonerSpells.map((sp) => (
                  <div key={sp.id} className="flex items-center gap-2.5">
                    <img
                      src={getSpellIconUrl(patchVersion, sp.imageFull)}
                      alt={sp.name}
                      className="w-8 h-8 rounded border border-[#2c3240]"
                    />
                    <div>
                      <div className="text-xs font-semibold text-zinc-100">{sp.name}</div>
                      <div className="text-[11px] text-zinc-400 tabular-nums">Recarga: {sp.cooldownBurn}s</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Justifications */}
      <div className="space-y-2 pt-3 border-t border-[#1f242d]">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Por que esta combinação funciona contra o draft inimigo
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {config.choiceExplanations.map((ex, i) => (
            <div key={i} className="p-3 rounded-md bg-[#0f1217] border border-[#1e232d] text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-zinc-100">
                <CheckCircle2 className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span>
                  {ex.label}: {ex.name}
                </span>
              </div>
              <p className="text-zinc-400 leading-relaxed">{ex.reason}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RunesPage() {
  const { analysis, runeTrees, patchVersion, setActivePage } = useRiftMind();
  const [inspectTreeIdx, setInspectTreeIdx] = useState<number | null>(null);

  if (!analysis) {
    return (
      <div className="rm-panel rounded-lg p-8 text-center space-y-3">
        <h2 className="text-base font-semibold text-zinc-100">Nenhuma página de runas em análise</h2>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Monte seu draft 5x5 e escolha o campeão controlado para gerar a configuração principal e alternativa de runas
          e feitiços de invocador.
        </p>
        <button
          onClick={() => setActivePage('draft')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-orange-500 text-zinc-950 font-semibold text-xs cursor-pointer"
        >
          <Swords className="w-3.5 h-3.5" /> Abrir Analisador de Draft
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3.5 pb-5 border-b border-[#1f242d]">
        <img
          src={getChampionIconUrl(patchVersion, analysis.userChampion.imageFull)}
          alt={analysis.userChampion.name}
          className="w-12 h-12 rounded-md border border-orange-500 object-cover"
        />
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
            Runas e Feitiços — {analysis.userChampion.name} ({ROLE_LABELS[analysis.userRole]})
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-4xl">{analysis.runes.comparisonSummary}</p>
        </div>
      </header>

      <RunePageBoard config={analysis.runes.recommended} patchVersion={patchVersion} isPrimaryRecommended />
      <RunePageBoard config={analysis.runes.alternative} patchVersion={patchVersion} />

      {/* Rune Encyclopedia */}
      <section className="rm-panel rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-400" /> Catálogo Oficial das 5 Árvores de Runas (Patch{' '}
            {patchVersion})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {runeTrees.map((t, idx) => (
              <button
                key={t.id}
                onClick={() => setInspectTreeIdx(inspectTreeIdx === idx ? null : idx)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border cursor-pointer ${
                  inspectTreeIdx === idx
                    ? 'bg-orange-500 text-zinc-950 border-orange-500'
                    : 'bg-[#161a22] text-zinc-300 border-[#262c38]'
                }`}
              >
                <img src={getRuneIconUrl(t.icon)} alt={t.name} className="w-4 h-4" />
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {inspectTreeIdx !== null && runeTrees[inspectTreeIdx] && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-[#1f242d]">
            {runeTrees[inspectTreeIdx].slots.flatMap((sl, sIdx) =>
              sl.runes.map((r) => (
                <div key={r.id} className="flex gap-3 p-3 rounded-md bg-[#0f1217] border border-[#1e232d]">
                  <img src={getRuneIconUrl(r.icon)} alt={r.name} className="w-9 h-9 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-zinc-100">
                      {sIdx === 0 ? '[Runa Principal] ' : ''}
                      {r.name}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{r.cleanDesc}</p>
                  </div>
                </div>
              )),
            )}
          </div>
        )}
      </section>
    </div>
  );
}
