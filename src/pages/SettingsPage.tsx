import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  ShieldCheck,
  DownloadCloud,
  Server,
  CheckCircle2,
  Globe,
  Database,
} from 'lucide-react';
import type { NetworkConnectionLog } from '../../shared/types.ts';
import { useRiftMind } from '../context/RiftMindContext.tsx';

interface SecurityStatusPayload {
  bindHost: string;
  localDataDir: string;
  sqliteDbPath: string;
  riotApiKeyConfiguredInBackendEnv: boolean;
  vanguardIsolationGuarantees: string[];
  networkLogs: NetworkConnectionLog[];
}

export function SettingsPage() {
  const { governance, preferences, triggerSync, savePrefs, refreshBootstrap } = useRiftMind();
  const [syncing, setSyncing] = useState(false);
  const [prefetching, setPrefetching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [clientPatchInput, setClientPatchInput] = useState(preferences.knownClientPatch || '');
  const [securityInfo, setSecurityInfo] = useState<SecurityStatusPayload | null>(null);

  const loadSecurityStatus = async () => {
    try {
      const res = await fetch('/api/security-status');
      if (res.ok) {
        setSecurityInfo(await res.json());
      }
    } catch {
      // Ignore offline
    }
  };

  useEffect(() => {
    loadSecurityStatus();
  }, []);

  const handleCheckRemotePatch = async () => {
    setSyncing(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/version-check');
      const data = await res.json();
      await refreshBootstrap();
      await loadSecurityStatus();
      setStatusMessage(
        data.offline
          ? 'Sem conexão com a internet no momento — operando normalmente com o banco SQLite offline.'
          : data.isOutdated
            ? `Nova versão detectada no Riot Data Dragon: ${data.latestRemoteVersion} (atual local: ${data.syncedVersion}).`
            : `Seu banco local já está na versão mais recente do Riot Data Dragon (${data.syncedVersion}).`,
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleSync = async (force: boolean) => {
    setSyncing(true);
    setStatusMessage(null);
    try {
      await triggerSync(force);
      await loadSecurityStatus();
      setStatusMessage(
        'Sincronização com Riot Data Dragon concluída com sucesso (preservando Minha Champion Pool e Histórico).',
      );
    } catch (err: any) {
      setStatusMessage(`Erro na sincronização: ${err?.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handlePrefetchOfflineIcons = async () => {
    setPrefetching(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/prefetch-icons', { method: 'POST' });
      const data = await res.json();
      await loadSecurityStatus();
      setStatusMessage(
        `Cache offline concluído: ${data.cachedCount} ícones oficiais salvos em disco para uso 100% sem internet.`,
      );
    } catch (err: any) {
      setStatusMessage(`Erro ao baixar cache de ícones: ${err?.message}`);
    } finally {
      setPrefetching(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="pb-5 border-b border-[#1f242d]">
        <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
          Configurações, Atualização de Dados e Segurança
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Gerencie a sincronização com o Riot Data Dragon, o cache offline e audite o isolamento local compatível com o
          Riot Vanguard.
        </p>
      </header>

      {statusMessage && (
        <div className="rm-panel rounded-md px-4 py-3 border-l-2 border-l-orange-500 text-xs text-zinc-100 font-medium">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Data Dragon Patch Controls */}
        <section className="rm-panel rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-zinc-100">
            <Database className="w-4 h-4 text-orange-400" /> Sincronização Oficial Riot Data Dragon (pt_BR)
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs tabular-nums">
            <div className="p-3.5 rounded-md bg-[#0f1217] border border-[#1e232d]">
              <div className="text-zinc-400">Versão instalada local</div>
              <div className="text-lg font-bold text-zinc-100 mt-1">
                {governance?.officialDdragon.activePatch}
              </div>
            </div>
            <div className="p-3.5 rounded-md bg-[#0f1217] border border-[#1e232d]">
              <div className="text-zinc-400">Última versão oficial Riot</div>
              <div className="text-lg font-bold text-sky-400 mt-1">
                {governance?.officialDdragon.latestRemotePatch || '—'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              disabled={syncing}
              onClick={handleCheckRemotePatch}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#171b22] hover:bg-[#1f242e] text-xs font-semibold text-zinc-200 border border-[#262c38] cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /> Verificar Novo Patch
            </button>

            <button
              disabled={syncing}
              onClick={() => handleSync(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-orange-500 hover:bg-orange-400 text-zinc-950 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /> Atualizar Dados do Data Dragon
            </button>

            <button
              disabled={prefetching}
              onClick={handlePrefetchOfflineIcons}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#171b22] hover:bg-[#1f242e] text-xs font-semibold text-sky-400 border border-[#262c38] cursor-pointer disabled:opacity-50"
            >
              <DownloadCloud className="w-3.5 h-3.5" /> Baixar Ícones p/ Uso Offline
            </button>
          </div>

          <div className="pt-3 border-t border-[#1f242d] space-y-2">
            <label className="text-xs font-medium text-zinc-300 block">
              Patch atual do cliente do jogo (opcional — para aviso quando o Data Dragon estiver atrasado):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={clientPatchInput}
                onChange={(e) => setClientPatchInput(e.target.value)}
                placeholder="Ex: 16.23"
                className="rm-input rounded-md px-3 py-1.5 text-xs w-44"
              />
              <button
                onClick={() => savePrefs({ knownClientPatch: clientPatchInput })}
                className="px-3 py-1.5 rounded-md bg-[#171b22] hover:bg-[#1f242e] text-xs font-semibold text-zinc-200 border border-[#262c38] cursor-pointer"
              >
                Salvar referência
              </button>
            </div>
          </div>
        </section>

        {/* Vanguard Isolation */}
        <section className="rm-panel rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-zinc-100">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Arquitetura Local Isolada & Riot Vanguard
          </div>

          {securityInfo && (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-md bg-[#0f1217] border border-[#1e232d] space-y-1">
                <div>
                  <span className="text-zinc-400">Host local: </span>
                  <code className="text-emerald-400 font-semibold">{securityInfo.bindHost}</code>
                </div>
                <div className="truncate">
                  <span className="text-zinc-400">Banco SQLite: </span>
                  <code className="text-zinc-200">{securityInfo.sqliteDbPath}</code>
                </div>
                <div>
                  <span className="text-zinc-400">Riot API Key no backend: </span>
                  <span className="text-zinc-300">
                    {securityInfo.riotApiKeyConfiguredInBackendEnv
                      ? 'Configurada via variável de ambiente no backend'
                      : 'Não exigida / não configurada'}
                  </span>
                </div>
              </div>

              <ul className="space-y-1.5">
                {securityInfo.vanguardIsolationGuarantees.map((g, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-zinc-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* 3-Layer Knowledge Separation */}
      {governance && (
        <section className="rm-panel rounded-lg p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Governança das 3 Camadas de Informação
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-md bg-[#0f1217] border border-[#1e232d] space-y-1">
              <div className="font-semibold text-orange-400">1. Dados Oficiais Riot Games</div>
              <p className="text-zinc-400 leading-relaxed">
                Riot Data Dragon Patch <strong className="text-zinc-200">{governance.officialDdragon.activePatch}</strong>{' '}
                em <code>pt_BR</code> ({governance.officialDdragon.championsLoaded} campeões e{' '}
                {governance.officialDdragon.srItemsLoaded} itens do Mapa 11).
              </p>
            </div>
            <div className="p-3.5 rounded-md bg-[#0f1217] border border-[#1e232d] space-y-1">
              <div className="font-semibold text-sky-400">2. Estatísticas Externas</div>
              <p className="text-zinc-400 leading-relaxed">{governance.externalStats.disclaimer}</p>
            </div>
            <div className="p-3.5 rounded-md bg-[#0f1217] border border-[#1e232d] space-y-1">
              <div className="font-semibold text-emerald-400">3. Motor Estratégico Contextual</div>
              <p className="text-zinc-400 leading-relaxed">{governance.strategicEngine.explanation}</p>
            </div>
          </div>
        </section>
      )}

      {/* Connections Monitor */}
      <section className="rm-panel rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-zinc-100">
            <Globe className="w-4 h-4 text-sky-400" /> Monitor de Conexões Externas Realizadas
          </div>
          <button
            onClick={loadSecurityStatus}
            className="text-xs text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Server className="w-3.5 h-3.5" /> Atualizar lista
          </button>
        </div>

        <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-md border border-[#1e232d]">
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="bg-[#0f1217] text-zinc-400 sticky top-0">
              <tr>
                <th className="p-2.5">Horário</th>
                <th className="p-2.5">Método</th>
                <th className="p-2.5">Domínio</th>
                <th className="p-2.5">Finalidade</th>
                <th className="p-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e232d] bg-[#101318]">
              {(securityInfo?.networkLogs || []).map((log) => (
                <tr key={log.id}>
                  <td className="p-2.5 text-zinc-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString('pt-BR')}
                  </td>
                  <td className="p-2.5 font-mono text-sky-400 whitespace-nowrap">{log.method}</td>
                  <td className="p-2.5 font-mono text-emerald-400">{log.domain}</td>
                  <td className="p-2.5 text-zinc-200">{log.purpose}</td>
                  <td className="p-2.5 font-semibold text-zinc-200">{log.status || 'OFFLINE'}</td>
                </tr>
              ))}
              {(!securityInfo || securityInfo.networkLogs.length === 0) && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-zinc-500">
                    Nenhuma conexão externa registrada nesta sessão (operando 100% do cache local).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
