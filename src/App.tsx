import React from 'react';
import {
  LayoutDashboard,
  Users,
  Swords,
  ShoppingBag,
  Sparkles,
  Compass,
  History,
  Settings,
  ShieldCheck,
  Loader2,
  Plus,
} from 'lucide-react';
import { ROLE_LABELS } from '../shared/types.ts';
import { countPicks } from '../shared/draftState.ts';
import {
  RiftMindProvider,
  suggestRoleFor,
  useRiftMind,
  type PageKey,
} from './context/RiftMindContext.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { ChampionPoolPage } from './pages/ChampionPoolPage.tsx';
import { DraftAnalyzerPage } from './pages/DraftAnalyzerPage.tsx';
import { BuildsPage } from './pages/BuildsPage.tsx';
import { RunesPage } from './pages/RunesPage.tsx';
import { MatchupsPage } from './pages/MatchupsPage.tsx';
import { HistoryPage } from './pages/HistoryPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { ChampionInspectorModal } from './components/ChampionInspectorModal.tsx';
import { getChampionIconUrl } from './lib/assets.ts';

const NAV_ITEMS: {
  key: PageKey;
  label: string;
  requiresAnalysis?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'pool', label: 'Minha Champion Pool', icon: Users },
  { key: 'draft', label: 'Analisador de Draft', icon: Swords },
  { key: 'builds', label: 'Builds e Itens', requiresAnalysis: true, icon: ShoppingBag },
  { key: 'runes', label: 'Runas', requiresAnalysis: true, icon: Sparkles },
  { key: 'matchups', label: 'Matchups e Estratégia', requiresAnalysis: true, icon: Compass },
  { key: 'history', label: 'Histórico', icon: History },
  { key: 'settings', label: 'Configurações', icon: Settings },
];

function RiftMindShell() {
  const {
    loading,
    error,
    activePage,
    setActivePage,
    patchVersion,
    inspectedChampion,
    setInspectedChampion,
    setUserControl,
    draft,
    analysis,
    startNewAnalysis,
    refreshBootstrap,
  } = useRiftMind();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0c0e12] text-zinc-200 gap-3 p-6 text-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        <h2 className="text-base font-semibold text-zinc-100">Inicializando RiftMind</h2>
        <p className="text-sm text-zinc-400 max-w-md">
          Carregando banco local SQLite (campeões, habilidades, itens do Summoner’s Rift e runas em pt_BR).
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0c0e12] text-zinc-200 gap-4 p-6 text-center">
        <div className="rm-panel rounded-lg p-6 max-w-lg space-y-3">
          <h2 className="text-base font-semibold text-rose-400">Serviço local indisponível (127.0.0.1)</h2>
          <p className="text-sm text-zinc-400">{error}</p>
          <button
            onClick={refreshBootstrap}
            className="px-4 py-2 rounded-md bg-orange-500 hover:bg-orange-400 text-zinc-950 font-semibold text-sm cursor-pointer transition"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const pickCounts = countPicks(draft);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#0c0e12] text-zinc-100">
      {/* Sidebar */}
      <aside className="lg:w-60 lg:shrink-0 bg-[#101217] border-b lg:border-b-0 lg:border-r border-[#1f242d] flex flex-col justify-between lg:sticky lg:top-0 lg:h-screen">
        <div>
          {/* Brand Header */}
          <div className="px-5 py-4 border-b border-[#1f242d] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-orange-500 text-zinc-950 flex items-center justify-center font-extrabold text-sm tracking-tight">
                RM
              </div>
              <div>
                <div className="font-bold text-sm text-zinc-100 tracking-tight leading-none">RiftMind</div>
                <div className="text-xs text-zinc-400 mt-1 tabular-nums">
                  Patch <span className="text-zinc-200 font-medium">{patchVersion || '—'}</span>
                </div>
              </div>
            </div>

            <button
              onClick={startNewAnalysis}
              title="Iniciar Novo Draft 5x5"
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-500 text-zinc-950 font-semibold text-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Novo Draft
            </button>
          </div>

          {/* Primary Action */}
          <div className="hidden lg:block px-3 pt-3 pb-1">
            <button
              onClick={() => setActivePage('draft')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-orange-500 hover:bg-orange-400 text-zinc-950 font-semibold text-xs transition cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Swords className="w-3.5 h-3.5" />
                {pickCounts.total > 0 ? 'Continuar Draft 5x5' : 'Montar Draft 5x5'}
              </span>
              <span className="tabular-nums font-bold px-1.5 py-0.5 rounded bg-black/15 text-[11px]">
                {pickCounts.total}/10
              </span>
            </button>
          </div>

          {/* Navigation */}
          <nav className="p-2.5 flex flex-wrap lg:flex-col gap-0.5">
            {NAV_ITEMS.map(({ key, label, requiresAnalysis, icon: Icon }) => {
              const active = activePage === key;
              return (
                <button
                  key={key}
                  onClick={() => setActivePage(key)}
                  className={`relative flex items-center justify-between gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition cursor-pointer ${
                    active
                      ? 'bg-[#1a1e26] text-white font-semibold'
                      : 'text-zinc-400 hover:bg-[#151820] hover:text-zinc-200'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {active && (
                      <span className="hidden lg:block absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-orange-500 rounded-r" />
                    )}
                    <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-orange-400' : 'text-zinc-500'}`} />
                    <span>{label}</span>
                  </span>
                  {requiresAnalysis && analysis && (
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" title="Análise ativa" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Status: Active Controlled Champion + Vanguard Isolation */}
        <div className="hidden lg:flex flex-col gap-2.5 p-3 border-t border-[#1f242d]">
          {analysis ? (
            <button
              onClick={() => setActivePage('draft')}
              className="flex items-center gap-2.5 p-2.5 rounded-md bg-[#151922] hover:bg-[#1a1f2a] border border-[#252b37] text-left transition cursor-pointer"
            >
              <img
                src={getChampionIconUrl(patchVersion, analysis.userChampion.imageFull)}
                alt={analysis.userChampion.name}
                className="w-8 h-8 rounded object-cover border border-orange-500/60 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-orange-400 font-semibold uppercase tracking-wider leading-none">
                  Em análise • {ROLE_LABELS[analysis.userRole]}
                </div>
                <div className="text-xs font-semibold text-zinc-100 truncate mt-1">
                  {analysis.userChampion.name}
                </div>
              </div>
            </button>
          ) : (
            <div className="px-2.5 py-2 rounded-md bg-[#13161c] border border-[#1f242d] text-xs text-zinc-400">
              Nenhum draft ativo no momento.
            </div>
          )}

          <div className="px-2.5 py-2 flex items-center gap-2 text-[11px] text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Isolado em 127.0.0.1 • Vanguard Safe</span>
          </div>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 min-w-0 px-4 py-6 sm:px-8 lg:px-10 max-w-[1440px] mx-auto w-full">
        {activePage === 'dashboard' && <DashboardPage />}
        {activePage === 'pool' && <ChampionPoolPage />}
        {activePage === 'draft' && <DraftAnalyzerPage />}
        {activePage === 'builds' && <BuildsPage />}
        {activePage === 'runes' && <RunesPage />}
        {activePage === 'matchups' && <MatchupsPage />}
        {activePage === 'history' && <HistoryPage />}
        {activePage === 'settings' && <SettingsPage />}
      </main>

      <ChampionInspectorModal
        champion={inspectedChampion}
        patchVersion={patchVersion}
        onClose={() => setInspectedChampion(null)}
        onUseInDraft={(champ, role) => {
          const targetRole = role || suggestRoleFor(champ, draft);
          setUserControl(targetRole, champ.id);
          setActivePage('draft');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <RiftMindProvider>
      <RiftMindShell />
    </RiftMindProvider>
  );
}
