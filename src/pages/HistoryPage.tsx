import React, { useState } from 'react';
import { History, Trash2, Search, Swords } from 'lucide-react';
import { ROLES, ROLE_LABELS } from '../../shared/types.ts';
import { useRiftMind } from '../context/RiftMindContext.tsx';
import { getChampionIconUrl } from '../lib/assets.ts';

export function HistoryPage() {
  const { draftHistory, championMap, patchVersion, loadHistoryEntry, deleteHistoryEntry, setActivePage } =
    useRiftMind();
  const [query, setQuery] = useState('');

  const filtered = draftHistory.filter((h) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      h.title.toLowerCase().includes(q) ||
      h.userChampionId.toLowerCase().includes(q) ||
      h.summaryVerdict.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#1f242d]">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Histórico de Análises</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Composições salvas manualmente por você no banco local (<code>data/riftmind.sqlite</code>).
          </p>
        </div>

        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar histórico por título ou campeão..."
            className="rm-input w-full pl-9 pr-3 py-1.5 rounded-md text-xs"
          />
        </div>
      </header>

      {filtered.length === 0 ? (
        <div className="rm-panel rounded-lg p-10 text-center space-y-3">
          <History className="w-6 h-6 text-zinc-500 mx-auto" />
          <p className="text-sm font-medium text-zinc-300">Nenhuma análise salva encontrada.</p>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Ao montar um draft 5x5 no Analisador de Draft, clique em "Salvar análise" para armazenar o estudo aqui.
          </p>
          <button
            onClick={() => setActivePage('draft')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-orange-500 text-zinc-950 font-semibold text-xs cursor-pointer"
          >
            <Swords className="w-3.5 h-3.5" /> Montar Draft 5x5
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const userChamp = championMap.get(entry.userChampionId);
            return (
              <div
                key={entry.id}
                className="rm-panel rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded bg-[#181c24] text-orange-400 font-semibold tabular-nums">
                      Patch {entry.patchVersion}
                    </span>
                    <h3 className="text-base font-bold text-zinc-100">{entry.title}</h3>
                    <span className="text-xs text-zinc-500 tabular-nums">
                      {new Date(entry.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{entry.summaryVerdict}</p>

                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-sky-400 mr-1">Aliados:</span>
                      {ROLES.map((r) => {
                        const cid = entry.allyTeam[r];
                        const c = cid ? championMap.get(cid) : null;
                        return c ? (
                          <img
                            key={r}
                            src={getChampionIconUrl(patchVersion, c.imageFull)}
                            alt={c.name}
                            title={`${ROLE_LABELS[r]}: ${c.name}`}
                            className={`w-8 h-8 rounded object-cover border ${
                              r === entry.userRole ? 'border-orange-500' : 'border-[#2c3240]'
                            }`}
                          />
                        ) : null;
                      })}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-rose-400 mr-1">Adversários:</span>
                      {ROLES.map((r) => {
                        const cid = entry.enemyTeam[r];
                        const c = cid ? championMap.get(cid) : null;
                        return c ? (
                          <img
                            key={r}
                            src={getChampionIconUrl(patchVersion, c.imageFull)}
                            alt={c.name}
                            title={`${ROLE_LABELS[r]}: ${c.name}`}
                            className="w-8 h-8 rounded object-cover border border-[#2c3240]"
                          />
                        ) : null;
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => loadHistoryEntry(entry)}
                    className="px-3.5 py-2 rounded-md bg-orange-500 hover:bg-orange-400 text-zinc-950 font-semibold text-xs cursor-pointer transition"
                  >
                    Restaurar análise ({userChamp?.name || entry.userChampionId})
                  </button>
                  <button
                    onClick={() => deleteHistoryEntry(entry.id)}
                    className="p-2 rounded-md bg-[#161a22] hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 border border-[#262c38] cursor-pointer"
                    title="Excluir do histórico"
                  >
                    <Trash2 className="w-4 h-4" />
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
