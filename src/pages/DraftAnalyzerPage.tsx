import React, { useMemo, useState } from 'react';
import {
  Save,
  RotateCcw,
  Swords,
  Eye,
  UserCheck,
  Plus,
  X,
  ArrowRightLeft,
  History,
  CheckCircle2,
  AlertTriangle,
  FlaskConical,
} from 'lucide-react';
import { ROLES, ROLE_LABELS, type Role } from '../../shared/types.ts';
import { profileChampion } from '../../shared/engine/championProfiler.ts';
import { countPicks, findChampionUsage, type DraftSide } from '../../shared/draftState.ts';
import { DEMO_SCENARIOS } from '../../shared/demoScenarios.ts';
import { useRiftMind } from '../context/RiftMindContext.tsx';
import { ChampionPickerModal } from '../components/ChampionPickerModal.tsx';
import { LiveSituationPanel } from '../components/LiveSituationPanel.tsx';
import { getChampionIconUrl, getItemIconUrl, getRuneIconUrl } from '../lib/assets.ts';

const METRIC_GROUPS: {
  groupTitle: string;
  items: {
    key: keyof NonNullable<ReturnType<typeof useRiftMind>['analysis']>['allyMetrics']['scores'];
    label: string;
  }[];
}[] = [
  {
    groupTitle: 'Poder Ofensivo & Pressão',
    items: [
      { key: 'physicalDamage', label: 'Dano Físico' },
      { key: 'magicDamage', label: 'Dano Mágico' },
      { key: 'trueDamage', label: 'Dano Verdadeiro' },
      { key: 'burst', label: 'Explosão (Burst)' },
      { key: 'poke', label: 'Poke e Alcance' },
      { key: 'siege', label: 'Cerco a Torres (Siege)' },
      { key: 'antiTank', label: 'Dano Contra Tanques' },
    ],
  },
  {
    groupTitle: 'Controle, Iniciação & Pickoff',
    items: [
      { key: 'hardCC', label: 'Controle de Grupo Forte' },
      { key: 'softCC', label: 'Controle Leve / Lentidão' },
      { key: 'engage', label: 'Capacidade de Engage' },
      { key: 'initiation', label: 'Gatilho de Iniciação' },
      { key: 'pickoff', label: 'Potencial de Pickoff' },
      { key: 'mobility', label: 'Mobilidade' },
      { key: 'chase', label: 'Capacidade de Perseguição' },
    ],
  },
  {
    groupTitle: 'Sobrevivência, Proteção & Escala',
    items: [
      { key: 'frontline', label: 'Frontline e Resistência' },
      { key: 'peel', label: 'Proteção de Carregadores (Peel)' },
      { key: 'disengage', label: 'Capacidade de Disengage' },
      { key: 'sustain', label: 'Sustentação, Cura e Escudo' },
      { key: 'diveResistance', label: 'Resistência contra Dive' },
      { key: 'assassinVulnerability', label: 'Vulnerabilidade a Assassinos' },
      { key: 'scaling', label: 'Escalonamento p/ Late Game' },
    ],
  },
];

export function DraftAnalyzerPage() {
  const {
    draft,
    analysis,
    champions,
    championMap,
    championPool,
    draftHistory,
    patchVersion,
    setTeamChampion,
    setUserControl,
    loadDemoScenario,
    clearDraftBoard,
    loadHistoryEntry,
    saveDraftToHistory,
    setInspectedChampion,
    setActivePage,
  } = useRiftMind();

  const [pickerTarget, setPickerTarget] = useState<{
    team: DraftSide;
    role: Role;
    forceControlled?: boolean;
  } | null>(null);
  const [analysisTab, setAnalysisTab] = useState<'OVERVIEW' | 'METRICS' | 'RECOMMENDATIONS'>('OVERVIEW');
  const [saveTitle, setSaveTitle] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);
  const [selectedDemoId, setSelectedDemoId] = useState('');

  const championUsage = useMemo(() => findChampionUsage(draft), [draft]);
  const pickCounts = useMemo(() => countPicks(draft), [draft]);

  const allyChampionsPicked = useMemo(
    () =>
      ROLES.map((r) => ({
        role: r,
        champ: draft.allyTeam[r] ? championMap.get(draft.allyTeam[r]!) || null : null,
      })).filter((x) => x.champ !== null),
    [draft.allyTeam, championMap],
  );

  const handleSaveHistory = async () => {
    if (!analysis) return;
    const defaultTitle =
      saveTitle.trim() || `${analysis.userChampion.name} (${ROLE_LABELS[analysis.userRole]}) — Patch ${patchVersion}`;
    const ok = await saveDraftToHistory(defaultTitle, '');
    if (ok) {
      setSaveTitle('');
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    }
  };

  const latestSavedDraft = draftHistory[0] || null;

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#1f242d]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Analisador de Draft 5x5</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-[#181c24] text-zinc-300 border border-[#272d3a] tabular-nums">
              {pickCounts.total}/10 posições preenchidas
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Clique em qualquer posição para escolher, substituir ou remover campeões e defina qual campeão você está controlando.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Explicit Demo Scenario Loader */}
          <div className="flex items-center gap-1.5">
            <FlaskConical className="w-3.5 h-3.5 text-zinc-400" />
            <select
              aria-label="Carregar Cenário Exemplo"
              value={selectedDemoId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedDemoId('');
                const found = DEMO_SCENARIOS.find((x) => x.id === val);
                if (found) loadDemoScenario(found);
              }}
              className="rm-input rounded-md px-3 py-1.5 text-xs font-medium text-zinc-200"
            >
              <option value="">Carregar Cenário Exemplo...</option>
              {DEMO_SCENARIOS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={clearDraftBoard}
            disabled={pickCounts.total === 0 && !draft.userRole}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#171b22] hover:bg-[#1f242e] disabled:opacity-40 text-xs font-medium text-zinc-200 border border-[#262c38] cursor-pointer transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Limpar Draft
          </button>

          {analysis && (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="Nome para salvar no histórico..."
                className="rm-input rounded-md px-2.5 py-1.5 text-xs w-48"
              />
              <button
                onClick={handleSaveHistory}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-500 hover:bg-orange-400 text-zinc-950 font-semibold text-xs cursor-pointer transition"
              >
                <Save className="w-3.5 h-3.5" /> {savedNotice ? 'Salvo no histórico!' : 'Salvar análise'}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Optional Manual Restore Banner when board is empty and a previous analysis exists */}
      {pickCounts.total === 0 && latestSavedDraft && (
        <div className="rm-panel-subtle rounded-md px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5 text-xs text-zinc-300">
            <History className="w-4 h-4 text-zinc-400 shrink-0" />
            <span>
              Existe uma análise salva anteriormente: <strong className="text-zinc-100">{latestSavedDraft.title}</strong>
            </span>
          </div>
          <button
            onClick={() => loadHistoryEntry(latestSavedDraft)}
            className="px-3 py-1 rounded bg-[#1b202a] hover:bg-[#232936] text-xs font-semibold text-orange-400 border border-[#2c3342] cursor-pointer transition"
          >
            Restaurar análise anterior
          </button>
        </div>
      )}

      {/* Controlled Champion Bar */}
      <div className="rm-panel rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-orange-500/15 border border-orange-500/40 flex items-center justify-center text-orange-400 shrink-0">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-orange-400">
              Campeão Controlado por Você
            </div>
            {analysis ? (
              <div className="text-sm font-semibold text-zinc-100 mt-0.5">
                {analysis.userChampion.name} — {ROLE_LABELS[analysis.userRole]}
              </div>
            ) : (
              <div className="text-xs text-zinc-400 mt-0.5">
                Selecione sua posição na Minha Equipe ou escolha diretamente em qual rota você vai jogar:
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {ROLES.map((r) => {
            const champId = draft.allyTeam[r];
            const champ = champId ? championMap.get(champId) : null;
            const isControlled = draft.userRole === r;

            return (
              <button
                key={r}
                onClick={() => {
                  if (champ) {
                    setUserControl(r);
                  } else {
                    setUserControl(r);
                    setPickerTarget({ team: 'ally', role: r, forceControlled: true });
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition cursor-pointer ${
                  isControlled
                    ? 'bg-orange-500 text-zinc-950 border-orange-500'
                    : 'bg-[#161a22] text-zinc-300 border-[#262c38] hover:border-orange-500/50'
                }`}
              >
                <span>{ROLE_LABELS[r]}</span>
                {champ && <span className="opacity-85">({champ.name})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5x5 Draft Board */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MINHA EQUIPE */}
        <section className="rm-panel rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#222731] bg-[#101319] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-100">Minha Equipe</h2>
            </div>
            <span className="text-xs text-zinc-400 tabular-nums">{pickCounts.ally}/5 selecionados</span>
          </div>

          <div className="divide-y divide-[#1e232d]">
            {ROLES.map((role) => {
              const cid = draft.allyTeam[role];
              const champ = cid ? championMap.get(cid) : null;
              const prof = champ ? profileChampion(champ, role) : null;
              const isUserSlot = draft.userRole === role;

              return (
                <div
                  key={role}
                  className={`flex items-center justify-between gap-3 px-4 py-3 transition ${
                    isUserSlot ? 'bg-orange-500/[0.07]' : 'hover:bg-[#161a22]'
                  }`}
                >
                  {/* Position + Champion Info (clickable to open selector) */}
                  <div
                    onClick={() => setPickerTarget({ team: 'ally', role })}
                    className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="w-16 shrink-0">
                      <span className="text-xs font-semibold uppercase tracking-wider text-sky-400 block">
                        {ROLE_LABELS[role]}
                      </span>
                      {isUserSlot && (
                        <span className="inline-block mt-0.5 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-orange-500 text-zinc-950">
                          Você
                        </span>
                      )}
                    </div>

                    {champ ? (
                      <img
                        src={getChampionIconUrl(patchVersion, champ.imageFull)}
                        alt={champ.name}
                        className={`w-12 h-12 rounded-md object-cover border shrink-0 ${
                          isUserSlot ? 'border-orange-500' : 'border-[#2c3240]'
                        }`}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-md border border-dashed border-[#2d3342] bg-[#0f1217] flex items-center justify-center text-zinc-500 shrink-0">
                        <Plus className="w-4 h-4" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      {champ ? (
                        <>
                          <div className="text-sm font-semibold text-zinc-100 truncate">{champ.name}</div>
                          <div className="text-xs text-zinc-400 truncate">{prof?.archetypeLabel}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-medium text-zinc-400">Posição vazia</div>
                          <div className="text-xs text-zinc-500">Clique para escolher um campeão</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Explicit Action Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setPickerTarget({ team: 'ally', role })}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#1a1f29] hover:bg-[#232936] text-xs font-medium text-zinc-200 border border-[#2a3140] cursor-pointer transition"
                    >
                      {champ ? (
                        <>
                          <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-400" /> Trocar
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 text-orange-400" /> Escolher
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        if (champ) {
                          setUserControl(role);
                        } else {
                          setUserControl(role);
                          setPickerTarget({ team: 'ally', role, forceControlled: true });
                        }
                      }}
                      title="Definir como meu campeão controlado"
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                        isUserSlot
                          ? 'bg-orange-500 text-zinc-950'
                          : 'bg-[#161a22] hover:bg-[#1f242f] text-zinc-300 border border-[#262c38]'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{isUserSlot ? 'Controlado' : 'Controlar'}</span>
                    </button>

                    {champ && (
                      <>
                        <button
                          onClick={() => setInspectedChampion(champ)}
                          title="Ver habilidades do campeão"
                          className="p-1.5 rounded-md bg-[#161a22] hover:bg-[#1f242f] text-zinc-400 hover:text-zinc-100 border border-[#262c38] cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setTeamChampion('ally', role, null)}
                          title="Remover campeão desta posição"
                          aria-label={`Remover ${champ.name}`}
                          className="p-1.5 rounded-md bg-[#161a22] hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 border border-[#262c38] cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* EQUIPE ADVERSÁRIA */}
        <section className="rm-panel rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#222731] bg-[#101319] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-100">Equipe Adversária</h2>
            </div>
            <span className="text-xs text-zinc-400 tabular-nums">{pickCounts.enemy}/5 selecionados</span>
          </div>

          <div className="divide-y divide-[#1e232d]">
            {ROLES.map((role) => {
              const cid = draft.enemyTeam[role];
              const champ = cid ? championMap.get(cid) : null;
              const prof = champ ? profileChampion(champ, role) : null;

              return (
                <div
                  key={role}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#161a22] transition"
                >
                  <div
                    onClick={() => setPickerTarget({ team: 'enemy', role })}
                    className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="w-16 shrink-0">
                      <span className="text-xs font-semibold uppercase tracking-wider text-rose-400 block">
                        {ROLE_LABELS[role]}
                      </span>
                    </div>

                    {champ ? (
                      <img
                        src={getChampionIconUrl(patchVersion, champ.imageFull)}
                        alt={champ.name}
                        className="w-12 h-12 rounded-md object-cover border border-[#2c3240] shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-md border border-dashed border-[#2d3342] bg-[#0f1217] flex items-center justify-center text-zinc-500 shrink-0">
                        <Plus className="w-4 h-4" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      {champ ? (
                        <>
                          <div className="text-sm font-semibold text-zinc-100 truncate">{champ.name}</div>
                          <div className="text-xs text-zinc-400 truncate">{prof?.archetypeLabel}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-medium text-zinc-400">Posição vazia</div>
                          <div className="text-xs text-zinc-500">Clique para escolher um adversário</div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setPickerTarget({ team: 'enemy', role })}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[#1a1f29] hover:bg-[#232936] text-xs font-medium text-zinc-200 border border-[#2a3140] cursor-pointer transition"
                    >
                      {champ ? (
                        <>
                          <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-400" /> Trocar
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 text-rose-400" /> Escolher
                        </>
                      )}
                    </button>

                    {champ && (
                      <>
                        <button
                          onClick={() => setInspectedChampion(champ)}
                          title="Ver habilidades do adversário"
                          className="p-1.5 rounded-md bg-[#161a22] hover:bg-[#1f242f] text-zinc-400 hover:text-zinc-100 border border-[#262c38] cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setTeamChampion('enemy', role, null)}
                          title="Remover adversário desta posição"
                          aria-label={`Remover ${champ.name}`}
                          className="p-1.5 rounded-md bg-[#161a22] hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 border border-[#262c38] cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Analysis Area */}
      {!analysis ? (
        <div className="rm-panel rounded-lg p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-md bg-[#181c24] border border-[#262c38] flex items-center justify-center mx-auto text-orange-400">
            <Swords className="w-5 h-5" />
          </div>
          {pickCounts.total === 0 ? (
            <>
              <h3 className="text-base font-semibold text-zinc-100">
                As dez posições do draft estão prontas para sua seleção
              </h3>
              <p className="text-xs text-zinc-400 max-w-lg mx-auto leading-relaxed">
                Clique em qualquer posição acima para abrir o catálogo com os {champions.length} campeões oficiais e
                marque qual campeão você está controlando para gerar a análise completa.
              </p>
            </>
          ) : allyChampionsPicked.length > 0 ? (
            <>
              <h3 className="text-base font-semibold text-zinc-100">
                Confirme qual campeão você está controlando
              </h3>
              <p className="text-xs text-zinc-400 max-w-lg mx-auto">
                Clique em um dos campeões aliados abaixo para gerar builds, runas, matchups e estratégia para ele:
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {allyChampionsPicked.map(({ role, champ }) => (
                  <button
                    key={role}
                    onClick={() => setUserControl(role)}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-orange-500 hover:bg-orange-400 text-zinc-950 font-semibold text-xs cursor-pointer transition"
                  >
                    <img
                      src={getChampionIconUrl(patchVersion, champ!.imageFull)}
                      alt={champ!.name}
                      className="w-5 h-5 rounded-xs"
                    />
                    <span>
                      Controlar {champ!.name} ({ROLE_LABELS[role]})
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold text-zinc-100">
                Escolha o seu campeão na Minha Equipe
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Adicione pelo menos o campeão que você vai controlar na Minha Equipe para destravar o motor de
                recomendações.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Organized Analysis Navigation Tabs */}
          <div className="rm-panel rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <img
                src={getChampionIconUrl(patchVersion, analysis.userChampion.imageFull)}
                alt={analysis.userChampion.name}
                className="w-11 h-11 rounded-md border border-orange-500 object-cover"
              />
              <div>
                <div className="text-sm font-bold text-zinc-100">
                  Análise Contextual: {analysis.userChampion.name} ({ROLE_LABELS[analysis.userRole]})
                </div>
                <div className="text-xs text-zinc-400">{analysis.build.buildIdentitySummary}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'OVERVIEW' as const, label: 'Visão Geral & Condições de Vitória' },
                { id: 'METRICS' as const, label: 'Comparativo Tático (20 Métricas)' },
                { id: 'RECOMMENDATIONS' as const, label: 'Resumo de Build & Runas' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setAnalysisTab(t.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition ${
                    analysisTab === t.id
                      ? 'bg-orange-500 text-zinc-950'
                      : 'bg-[#171b22] text-zinc-300 hover:bg-[#1f242e] border border-[#262c38]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {analysisTab === 'OVERVIEW' && (
            <div className="space-y-6">
              {/* Damage Share Split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { title: 'Distribuição de Dano — Minha Equipe', m: analysis.allyMetrics },
                  { title: 'Distribuição de Dano — Equipe Adversária', m: analysis.enemyMetrics },
                ].map((block) => (
                  <div key={block.title} className="rm-panel rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-200">{block.title}</span>
                      <span className="text-zinc-400 tabular-nums">
                        {block.m.damageShare.physical}% AD • {block.m.damageShare.magic}% AP •{' '}
                        {block.m.damageShare.trueDamage}% Real
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-sm overflow-hidden flex bg-[#0c0e12]">
                      <div
                        style={{ width: `${block.m.damageShare.physical}%` }}
                        className="bg-orange-500 h-full transition-all"
                      />
                      <div
                        style={{ width: `${block.m.damageShare.magic}%` }}
                        className="bg-sky-500 h-full transition-all"
                      />
                      <div
                        style={{ width: `${block.m.damageShare.trueDamage}%` }}
                        className="bg-zinc-200 h-full transition-all"
                      />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-400">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-xs bg-orange-500 inline-block" /> Físico
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-xs bg-sky-500 inline-block" /> Mágico
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-xs bg-zinc-200 inline-block" /> Verdadeiro
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Win Conditions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rm-panel rounded-lg p-5 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400">
                    Condições de Vitória — Minha Equipe
                  </h3>
                  <ul className="space-y-2 text-xs text-zinc-200 leading-relaxed">
                    {analysis.allyWinConditions.map((wc, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{wc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rm-panel rounded-lg p-5 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400">
                    Condições de Vitória — Equipe Adversária
                  </h3>
                  <ul className="space-y-2 text-xs text-zinc-200 leading-relaxed">
                    {analysis.enemyWinConditions.map((wc, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <span>{wc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Composition Insights List */}
              <div className="rm-panel rounded-lg divide-y divide-[#1f242d]">
                <div className="px-5 py-3 bg-[#101319] text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Diagnóstico Tático da Composição
                </div>
                {analysis.insights.map((ins, idx) => (
                  <div key={idx} className="p-4 flex items-start gap-3">
                    {ins.type === 'threat' || ins.type === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-zinc-100">{ins.title}</div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{ins.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysisTab === 'METRICS' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {METRIC_GROUPS.map((group) => (
                <div key={group.groupTitle} className="rm-panel rounded-lg p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#222731] pb-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-200">{group.groupTitle}</h3>
                    <div className="text-[11px] text-zinc-400">
                      <span className="text-sky-400 font-semibold">Aliado</span> vs{' '}
                      <span className="text-rose-400 font-semibold">Inimigo</span>
                    </div>
                  </div>

                  <div className="space-y-3 tabular-nums">
                    {group.items.map(({ key, label }) => {
                      const allyVal = analysis.allyMetrics.scores[key];
                      const enemyVal = analysis.enemyMetrics.scores[key];
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-sky-400">{allyVal}</span>
                            <span className="text-zinc-300">{label}</span>
                            <span className="font-semibold text-rose-400">{enemyVal}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 h-2">
                            <div className="bg-[#0c0e12] rounded-l-xs overflow-hidden flex justify-end">
                              <div style={{ width: `${allyVal}%` }} className="bg-sky-500 h-full" />
                            </div>
                            <div className="bg-[#0c0e12] rounded-r-xs overflow-hidden">
                              <div style={{ width: `${enemyVal}%` }} className="bg-rose-500 h-full" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {analysisTab === 'RECOMMENDATIONS' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Core Build Summary */}
                <div className="rm-panel rounded-lg p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-orange-400">
                      Progressão de Itens
                    </span>
                    <button
                      onClick={() => setActivePage('builds')}
                      className="text-xs font-semibold text-orange-400 hover:underline cursor-pointer"
                    >
                      Ver receitas e justificativas →
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysis.build.slots.map((slot) => (
                      <div key={slot.slotKey} className="flex items-center gap-2 p-2 rounded bg-[#101318] border border-[#1f242d]">
                        <img
                          src={getItemIconUrl(patchVersion, slot.item.imageFull)}
                          alt={slot.item.name}
                          className="w-8 h-8 rounded"
                        />
                        <div>
                          <div className="text-xs font-semibold text-zinc-100">{slot.item.name}</div>
                          <div className="text-[11px] text-zinc-400 tabular-nums">{slot.item.goldTotal}g</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Runes Summary */}
                <div className="rm-panel rounded-lg p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-400">Runas Recomendadas</span>
                    <button
                      onClick={() => setActivePage('runes')}
                      className="text-xs font-semibold text-sky-400 hover:underline cursor-pointer"
                    >
                      Abrir árvores completas →
                    </button>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded bg-[#101318] border border-[#1f242d]">
                    <img
                      src={getRuneIconUrl(analysis.runes.recommended.keystone.icon)}
                      alt={analysis.runes.recommended.keystone.name}
                      className="w-11 h-11"
                    />
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">
                        {analysis.runes.recommended.keystone.name}
                      </div>
                      <div className="text-xs text-zinc-400">
                        {analysis.runes.recommended.primaryTree.name} + {analysis.runes.recommended.secondaryTree.name}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{analysis.runes.comparisonSummary}</p>
                </div>

                {/* Strategy Summary */}
                <div className="rm-panel rounded-lg p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                      Matchups & Estratégia
                    </span>
                    <button
                      onClick={() => setActivePage('matchups')}
                      className="text-xs font-semibold text-orange-400 hover:underline cursor-pointer"
                    >
                      Ver plano de partida →
                    </button>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-zinc-400">Postura recomendada: </span>
                      <strong className="text-orange-400">{analysis.strategy.recommendedPosture.mode}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-400">Maior ameaça: </span>
                      <strong className="text-zinc-100">{analysis.strategy.biggestEnemyThreat.championName}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-400">Aliado prioritário: </span>
                      <strong className="text-zinc-100">{analysis.strategy.allyToPrioritize.championName}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-400">Proteger nas lutas: </span>
                      <strong className="text-zinc-100">{analysis.strategy.whoToProtectInTeamfights.targetName}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <LiveSituationPanel recalculation={analysis.build.liveRecalculation} />
            </div>
          )}
        </div>
      )}

      {/* Champion Picker Modal */}
      {pickerTarget && (
        <ChampionPickerModal
          open={Boolean(pickerTarget)}
          team={pickerTarget.team}
          teamLabel={pickerTarget.team === 'ally' ? 'Minha Equipe' : 'Equipe Adversária'}
          targetRole={pickerTarget.role}
          currentChampionId={
            pickerTarget.team === 'ally'
              ? draft.allyTeam[pickerTarget.role]
              : draft.enemyTeam[pickerTarget.role]
          }
          isControlledSlot={
            pickerTarget.team === 'ally' &&
            (Boolean(pickerTarget.forceControlled) ||
              draft.userRole === pickerTarget.role ||
              draft.userRole === null)
          }
          championUsage={championUsage}
          champions={champions}
          championPool={championPool}
          patchVersion={patchVersion}
          onSelect={(champId, opts) => setTeamChampion(pickerTarget.team, pickerTarget.role, champId, opts)}
          onClose={() => setPickerTarget(null)}
        />
      )}
    </div>
  );
}
