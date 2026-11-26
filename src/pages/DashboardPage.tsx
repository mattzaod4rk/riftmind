import React from 'react';
import {
  Swords,
  Users,
  ArrowRight,
  AlertCircle,
  Plus,
  History,
  FlaskConical,
  ShieldCheck,
} from 'lucide-react';
import { ROLE_LABELS, ROLES } from '../../shared/types.ts';
import { DEMO_SCENARIOS } from '../../shared/demoScenarios.ts';
import { useRiftMind } from '../context/RiftMindContext.tsx';
import { getChampionIconUrl, getItemIconUrl } from '../lib/assets.ts';

export function DashboardPage() {
  const {
    governance,
    patchVersion,
    champions,
    items,
    championPool,
    draftHistory,
    draft,
    analysis,
    championMap,
    setActivePage,
    loadDemoScenario,
    loadHistoryEntry,
  } = useRiftMind();

  const dd = governance?.officialDdragon;

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#1f242d]">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Execução Local Isolada (127.0.0.1) • Compatível com Riot Vanguard</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
            RiftMind — Inteligência Tática de Draft, Builds e Estratégia
          </h1>
          <p className="text-sm text-zinc-400 max-w-3xl">
            Plataforma local de análise competitiva baseada nos dados oficiais do Riot Data Dragon (Patch{' '}
            <strong className="text-zinc-200">{patchVersion}</strong> • pt_BR).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => setActivePage('draft')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-orange-500 hover:bg-orange-400 text-zinc-950 font-semibold text-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Criar Nova Análise
          </button>
          <button
            onClick={() => setActivePage('pool')}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-[#161a22] hover:bg-[#1e232e] text-zinc-200 border border-[#262c38] font-medium text-xs transition cursor-pointer"
          >
            <Users className="w-4 h-4 text-zinc-400" /> Minha Champion Pool
          </button>
        </div>
      </header>

      {(dd?.isOutdatedVsRemote || dd?.isOutdatedVsClientPatch) && (
        <div className="rm-panel rounded-md px-4 py-3 border-l-2 border-l-orange-500 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs text-zinc-200">
            <AlertCircle className="w-4 h-4 text-orange-400 shrink-0" />
            <span>
              O banco local está no patch <strong>{dd.activePatch}</strong>
              {dd.isOutdatedVsRemote ? `, mas a versão ${dd.latestRemotePatch} já está disponível no Data Dragon.` : '.'}
              {dd.isOutdatedVsClientPatch
                ? ` O patch de referência configurado (${dd.configuredClientPatch}) difere da base instalada.`
                : ''}
            </span>
          </div>
          <button
            onClick={() => setActivePage('settings')}
            className="text-xs font-semibold text-orange-400 hover:underline cursor-pointer"
          >
            Atualizar dados →
          </button>
        </div>
      )}

      {/* Real Database Metrics Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="rm-panel rounded-lg p-4">
          <div className="text-xs text-zinc-400">Patch Instalado (Data Dragon)</div>
          <div className="text-2xl font-bold text-zinc-100 mt-1">{patchVersion}</div>
          <div className="text-xs text-emerald-400 mt-1">Banco SQLite sincronizado p/ uso offline</div>
        </div>

        <div className="rm-panel rounded-lg p-4">
          <div className="text-xs text-zinc-400">Catálogo Oficial Disponível</div>
          <div className="text-2xl font-bold text-zinc-100 mt-1">{champions.length} campeões</div>
          <div className="text-xs text-zinc-400 mt-1">{items.length} itens válidos no Summoner’s Rift (Mapa 11)</div>
        </div>

        <div className="rm-panel rounded-lg p-4">
          <div className="text-xs text-zinc-400">Minha Champion Pool</div>
          <div className="text-2xl font-bold text-zinc-100 mt-1">{championPool.length} cadastrados</div>
          <div className="text-xs text-zinc-400 mt-1">
            {championPool.filter((p) => p.isMain).length} principais •{' '}
            {championPool.filter((p) => p.isFavorite).length} favoritos
          </div>
        </div>

        <div className="rm-panel rounded-lg p-4">
          <div className="text-xs text-zinc-400">Histórico Local de Análises</div>
          <div className="text-2xl font-bold text-zinc-100 mt-1">{draftHistory.length} salvas</div>
          <div className="text-xs text-zinc-400 mt-1">Armazenadas em data/riftmind.sqlite</div>
        </div>
      </section>

      {/* Active Analysis OR Empty Inviting State (PARTE 3) */}
      {!analysis ? (
        <section className="rm-panel rounded-lg p-8 flex flex-col items-center text-center space-y-4">
          <div className="w-11 h-11 rounded-md bg-[#181c24] border border-[#272d3a] flex items-center justify-center text-orange-400">
            <Swords className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 max-w-xl">
            <h2 className="text-lg font-bold text-zinc-100">Ainda não existe uma composição em análise.</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Monte seu draft 5x5 para descobrir sinergias, ameaças, condições de vitória, builds e runas recomendadas.
            </p>
          </div>
          <button
            onClick={() => setActivePage('draft')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-orange-500 hover:bg-orange-400 text-zinc-950 font-semibold text-xs transition cursor-pointer"
          >
            <Swords className="w-4 h-4" /> Criar Nova Análise
          </button>
        </section>
      ) : (
        <section className="rm-panel rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[#222731]">
            <div className="flex items-center gap-3">
              <img
                src={getChampionIconUrl(patchVersion, analysis.userChampion.imageFull)}
                alt={analysis.userChampion.name}
                className="w-11 h-11 rounded-md border border-orange-500 object-cover"
              />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                  Composição Ativa em Análise
                </div>
                <h2 className="text-base font-bold text-zinc-100">
                  {analysis.userChampion.name} — {ROLE_LABELS[analysis.userRole]}
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActivePage('draft')}
                className="px-3 py-1.5 rounded-md bg-orange-500 text-zinc-950 font-semibold text-xs cursor-pointer"
              >
                Editar Draft 5x5
              </button>
              <button
                onClick={() => setActivePage('builds')}
                className="px-3 py-1.5 rounded-md bg-[#171b22] hover:bg-[#1f242e] text-xs font-medium text-zinc-200 border border-[#262c38] cursor-pointer"
              >
                Builds e Itens
              </button>
              <button
                onClick={() => setActivePage('runes')}
                className="px-3 py-1.5 rounded-md bg-[#171b22] hover:bg-[#1f242e] text-xs font-medium text-zinc-200 border border-[#262c38] cursor-pointer"
              >
                Runas ({analysis.runes.recommended.keystone.name})
              </button>
              <button
                onClick={() => setActivePage('matchups')}
                className="px-3 py-1.5 rounded-md bg-[#171b22] hover:bg-[#1f242e] text-xs font-medium text-zinc-200 border border-[#262c38] cursor-pointer"
              >
                Matchups e Estratégia
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="p-3.5 rounded-md bg-[#0f1217] border border-[#1e232d]">
              <div className="text-xs font-semibold text-sky-400 mb-2">Minha Equipe</div>
              <div className="flex items-center gap-2.5 flex-wrap">
                {ROLES.map((r) => {
                  const cid = draft.allyTeam[r];
                  const ch = cid ? championMap.get(cid) : null;
                  return (
                    <div key={r} className="flex flex-col items-center">
                      {ch ? (
                        <img
                          src={getChampionIconUrl(patchVersion, ch.imageFull)}
                          alt={ch.name}
                          className={`w-10 h-10 rounded object-cover border ${
                            r === analysis.userRole ? 'border-orange-500' : 'border-[#2c3240]'
                          }`}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded border border-dashed border-[#262c38] bg-[#13161c]" />
                      )}
                      <span className="text-[11px] text-zinc-400 mt-1">{ch?.name || ROLE_LABELS[r]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3.5 rounded-md bg-[#0f1217] border border-[#1e232d]">
              <div className="text-xs font-semibold text-orange-400 mb-2">
                Progressão Principal ({analysis.userChampion.name})
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {analysis.build.slots.slice(0, 6).map((slot) => (
                  <img
                    key={slot.slotKey}
                    src={getItemIconUrl(patchVersion, slot.item.imageFull)}
                    alt={slot.item.name}
                    title={`${slot.slotLabel}: ${slot.item.name}`}
                    className="w-10 h-10 rounded border border-[#2c3240]"
                  />
                ))}
              </div>
              <p className="text-xs text-zinc-400 mt-2 line-clamp-2">{analysis.allyWinConditions[0]}</p>
            </div>

            <div className="p-3.5 rounded-md bg-[#0f1217] border border-[#1e232d]">
              <div className="text-xs font-semibold text-rose-400 mb-2">Equipe Adversária</div>
              <div className="flex items-center gap-2.5 flex-wrap">
                {ROLES.map((r) => {
                  const cid = draft.enemyTeam[r];
                  const ch = cid ? championMap.get(cid) : null;
                  return (
                    <div key={r} className="flex flex-col items-center">
                      {ch ? (
                        <img
                          src={getChampionIconUrl(patchVersion, ch.imageFull)}
                          alt={ch.name}
                          className="w-10 h-10 rounded object-cover border border-[#2c3240]"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded border border-dashed border-[#262c38] bg-[#13161c]" />
                      )}
                      <span className="text-[11px] text-zinc-400 mt-1">{ch?.name || ROLE_LABELS[r]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Two-Column Summary: Minha Champion Pool & Últimas Análises Salvas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Champion Pool Summary */}
        <section className="rm-panel rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-100">Minha Champion Pool</h3>
            <button
              onClick={() => setActivePage('pool')}
              className="text-xs font-semibold text-orange-400 hover:underline cursor-pointer"
            >
              Gerenciar coleção →
            </button>
          </div>

          {championPool.length === 0 ? (
            <div className="p-6 rounded-md bg-[#0f1217] border border-[#1e232d] text-center space-y-2">
              <p className="text-xs text-zinc-400">
                Você ainda não cadastrou campeões na sua Champion Pool pessoal.
              </p>
              <button
                onClick={() => setActivePage('pool')}
                className="px-3 py-1.5 rounded-md bg-[#1a1f29] hover:bg-[#232936] text-xs font-semibold text-zinc-200 border border-[#2a3140] cursor-pointer"
              >
                Escolher campeões no catálogo
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {championPool.slice(0, 10).map((entry) => {
                const champ = championMap.get(entry.championId);
                if (!champ) return null;
                return (
                  <div
                    key={entry.championId}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md bg-[#0f1217] border border-[#1e232d]"
                  >
                    <img
                      src={getChampionIconUrl(patchVersion, champ.imageFull)}
                      alt={champ.name}
                      className="w-8 h-8 rounded object-cover"
                    />
                    <div>
                      <div className="text-xs font-semibold text-zinc-100">{champ.name}</div>
                      <div className="text-[11px] text-zinc-400">
                        {entry.roles.map((r) => ROLE_LABELS[r]).join(' / ')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Saved Analyses History */}
        <section className="rm-panel rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-100">Últimas Análises Salvas</h3>
            {draftHistory.length > 0 && (
              <button
                onClick={() => setActivePage('history')}
                className="text-xs font-semibold text-orange-400 hover:underline cursor-pointer"
              >
                Ver histórico completo →
              </button>
            )}
          </div>

          {draftHistory.length === 0 ? (
            <div className="p-6 rounded-md bg-[#0f1217] border border-[#1e232d] text-center space-y-2">
              <p className="text-xs text-zinc-400">
                Nenhuma análise salva no banco local ainda. Quando montar um draft 5x5, clique em "Salvar análise" para
                registrá-lo aqui.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#1e232d] border border-[#1e232d] rounded-md bg-[#0f1217]">
              {draftHistory.slice(0, 3).map((item) => (
                <div key={item.id} className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-100 truncate">{item.title}</div>
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">{item.summaryVerdict}</div>
                  </div>
                  <button
                    onClick={() => loadHistoryEntry(item)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#181c24] hover:bg-[#222834] text-xs font-semibold text-orange-400 border border-[#2a3140] shrink-0 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5" /> Restaurar
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Separate Section: Cenários para Experimentar (Never auto-loaded!) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
              Cenários para Experimentar (Demonstração Opcional)
            </h2>
          </div>
          <span className="text-xs text-zinc-500">
            Carregados somente quando você clicar em um cenário abaixo
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {DEMO_SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => {
                loadDemoScenario(scenario);
                setActivePage('draft');
              }}
              className="rm-panel rounded-lg p-4 flex items-center justify-between gap-4 text-left hover:border-orange-500/50 transition group cursor-pointer"
            >
              <div className="space-y-1">
                <div className="text-sm font-semibold text-zinc-100 group-hover:text-orange-400 transition">
                  {scenario.name}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{scenario.description}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-orange-400 shrink-0" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
