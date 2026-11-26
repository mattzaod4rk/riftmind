import React from 'react';
import {
  ShieldAlert,
  Users,
  Compass,
  Crosshair,
  AlertOctagon,
  CheckCircle2,
  Shield,
  Swords,
} from 'lucide-react';
import { ROLE_LABELS } from '../../shared/types.ts';
import { useRiftMind } from '../context/RiftMindContext.tsx';
import { getChampionIconUrl, getItemIconUrl, getSpellIconUrl } from '../lib/assets.ts';

export function MatchupsPage() {
  const { analysis, patchVersion, setActivePage, setInspectedChampion } = useRiftMind();

  if (!analysis) {
    return (
      <div className="rm-panel rounded-lg p-8 text-center space-y-3">
        <h2 className="text-base font-semibold text-zinc-100">Nenhum confronto ou estratégia em análise</h2>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Monte seu draft 5x5 e selecione o campeão controlado para visualizar a análise de confronto direto, ameaças
          dos 5 adversários e o guia tático de partida.
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

  const { matchups, strategy } = analysis;

  return (
    <div className="space-y-8">
      {/* Header & Lane Matchup */}
      <header className="rm-panel rounded-lg p-5 space-y-4">
        <div className="flex items-start justify-between flex-wrap gap-4 pb-4 border-b border-[#222731]">
          <div className="flex items-center gap-3.5">
            <img
              src={getChampionIconUrl(patchVersion, analysis.userChampion.imageFull)}
              alt={analysis.userChampion.name}
              className="w-13 h-13 rounded-md border border-orange-500 object-cover"
            />
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                Matchups e Estratégia Personalizada na Partida
              </span>
              <h1 className="text-xl font-bold text-zinc-100 tracking-tight mt-0.5">
                {matchups.laneMatchupSummary.title}
              </h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Postura recomendada na rota: <strong className="text-zinc-200">{matchups.laneMatchupSummary.lanePosture}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {matchups.laneMatchupSummary.directOpponents.map((opp) => (
              <img
                key={opp.id}
                src={getChampionIconUrl(patchVersion, opp.imageFull)}
                alt={opp.name}
                title={`Oponente direto de rota: ${opp.name}`}
                onClick={() => setInspectedChampion(opp)}
                className="w-11 h-11 rounded-md border border-[#2c3240] cursor-pointer object-cover"
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {matchups.laneMatchupSummary.keyTradingRules.map((rule, idx) => (
            <div key={idx} className="p-3.5 rounded-md bg-[#0f1217] border border-[#1e232d] text-zinc-300 leading-relaxed">
              <strong className="text-orange-400">Diretriz {idx + 1}: </strong>
              {rule}
            </div>
          ))}
        </div>
      </header>

      {/* Personalized Strategy During Match */}
      <section className="rm-panel rounded-lg p-5 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[#222731]">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-orange-400" />
            <h2 className="text-base font-bold text-zinc-100">Plano Estratégico Durante a Partida</h2>
          </div>
          <span className="px-2.5 py-1 rounded bg-orange-500/15 text-orange-300 border border-orange-500/30 text-xs font-semibold">
            Postura: {strategy.recommendedPosture.mode}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-md bg-[#0f1217] border border-[#1e232d] space-y-1.5">
            <div className="font-semibold uppercase text-sky-400">Qual aliado priorizar?</div>
            <div className="text-sm font-bold text-zinc-100">
              {strategy.allyToPrioritize.championName} ({ROLE_LABELS[strategy.allyToPrioritize.role]})
            </div>
            <p className="text-zinc-400 leading-relaxed">{strategy.allyToPrioritize.reason}</p>
          </div>

          <div className="p-4 rounded-md bg-[#0f1217] border border-[#1e232d] space-y-1.5">
            <div className="font-semibold uppercase text-rose-400">Quem representa a maior ameaça?</div>
            <div className="text-sm font-bold text-zinc-100">
              {strategy.biggestEnemyThreat.championName} ({ROLE_LABELS[strategy.biggestEnemyThreat.role]})
            </div>
            <p className="text-zinc-400 leading-relaxed">{strategy.biggestEnemyThreat.reason}</p>
          </div>

          <div className="p-4 rounded-md bg-[#0f1217] border border-[#1e232d] space-y-1.5">
            <div className="font-semibold uppercase text-orange-400">Quem proteger nas teamfights?</div>
            <div className="text-sm font-bold text-zinc-100">{strategy.whoToProtectInTeamfights.targetName}</div>
            <p className="text-zinc-400 leading-relaxed">{strategy.whoToProtectInTeamfights.reason}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Abilities to Watch */}
          <div className="p-4 rounded-md bg-[#0f1217] border border-[#1e232d] space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-rose-400" /> Habilidades inimigas para observar
            </div>
            <div className="space-y-2.5">
              {strategy.enemyAbilitiesToTrack.map((ab, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs">
                  <img
                    src={getSpellIconUrl(patchVersion, ab.imageFull)}
                    alt={ab.spellName}
                    className="w-8 h-8 rounded border border-[#2c3240] shrink-0 mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-zinc-100">
                      {ab.championName} • {ab.spellName} ({ab.spellKey}):{' '}
                    </span>
                    <span className="text-zinc-400">{ab.instruction}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Own Abilities to Hold */}
          <div className="p-4 rounded-md bg-[#0f1217] border border-[#1e232d] space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-sky-400" /> Quais habilidades suas guardar
            </div>
            <div className="space-y-2.5">
              {strategy.ownAbilitiesToHold.map((ab, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs">
                  <img
                    src={getSpellIconUrl(patchVersion, ab.imageFull)}
                    alt={ab.spellName}
                    className="w-8 h-8 rounded border border-[#2c3240] shrink-0 mt-0.5"
                  />
                  <div>
                    <span className="font-semibold text-zinc-100">
                      {ab.spellName} ({ab.spellKey}):{' '}
                    </span>
                    <span className="text-zinc-400">{ab.instruction}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-md bg-[#0f1217] border border-[#1e232d] space-y-2">
            <div className="font-semibold text-zinc-200 uppercase">Condição de Vitória & Posicionamento</div>
            <p className="text-zinc-300 leading-relaxed">
              <strong className="text-zinc-100">Condição de vitória:</strong> {strategy.teamWinCondition}
            </p>
            <p className="text-zinc-300 leading-relaxed">
              <strong className="text-zinc-100">Posicionamento:</strong> {strategy.positioningGuide}
            </p>
          </div>

          <div className="p-4 rounded-md bg-[#0f1217] border border-[#1e232d] space-y-2">
            <div className="font-semibold text-rose-400 uppercase flex items-center gap-1.5">
              <AlertOctagon className="w-3.5 h-3.5" /> O que evitar
            </div>
            <ul className="space-y-1.5 text-zinc-300 leading-relaxed">
              {strategy.whatToAvoid.map((item, idx) => (
                <li key={idx}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Role Specific Playbook */}
        <div className="pt-2 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-orange-400">
            {strategy.roleSpecificPlaybook.roleTitle}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {strategy.roleSpecificPlaybook.directives.map((d, idx) => (
              <div key={idx} className="p-3.5 rounded-md bg-[#0f1217] border border-[#1e232d] text-xs space-y-1">
                <div className="font-semibold text-zinc-100">{d.topic}</div>
                <p className="text-zinc-400 leading-relaxed">{d.guidance}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enemy Threats Breakdown */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <h2 className="text-base font-bold text-zinc-100">
            Análise Individual de Ameaças (Todos os Adversários do Draft)
          </h2>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {matchups.enemyThreats.map((threat) => (
            <div key={threat.champion.id} className="rm-panel rounded-lg p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <img
                    src={getChampionIconUrl(patchVersion, threat.champion.imageFull)}
                    alt={threat.champion.name}
                    onClick={() => setInspectedChampion(threat.champion)}
                    className="w-12 h-12 rounded-md border border-[#2c3240] cursor-pointer object-cover"
                  />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-zinc-100">{threat.champion.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded bg-[#181c24] text-zinc-300">
                        {ROLE_LABELS[threat.role]}
                      </span>
                      {threat.isDirectLaneOpponent && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-semibold">
                          Rota direta
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{threat.summary}</p>
                  </div>
                </div>

                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded shrink-0 ${
                    threat.threatLevel === 'CRÍTICO'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : threat.threatLevel === 'ALTO'
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                        : 'bg-[#1a1f28] text-zinc-300'
                  }`}
                >
                  Ameaça {threat.threatLevel}
                </span>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-zinc-400">Habilidades mais perigosas:</div>
                {threat.dangerousSpells.map((sp) => (
                  <div
                    key={sp.keySlot + sp.name}
                    className="flex items-start gap-2.5 p-2.5 rounded-md bg-[#0f1217] border border-[#1e232d] text-xs"
                  >
                    <img
                      src={getSpellIconUrl(patchVersion, sp.imageFull)}
                      alt={sp.name}
                      className="w-8 h-8 rounded border border-[#2c3240] shrink-0"
                    />
                    <div>
                      <div className="font-semibold text-zinc-100">
                        [{sp.keySlot}] {sp.name}{' '}
                        <span className="font-normal text-zinc-400 tabular-nums">(CD: {sp.cooldown})</span>
                      </div>
                      <p className="text-zinc-400 mt-0.5 leading-relaxed">{sp.whyDangerous}</p>
                    </div>
                  </div>
                ))}
              </div>

              {threat.interruptionDetail && (
                <div className="text-xs text-zinc-300 p-2.5 rounded-md bg-[#0f1217] border border-[#262c38]">
                  <strong className="text-orange-400">Interrupção de jogadas:</strong> {threat.interruptionDetail}
                </div>
              )}

              {threat.advantageDetail && (
                <div className="text-xs text-zinc-300 p-2.5 rounded-md bg-[#0f1217] border border-[#262c38] flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-emerald-400">Sua vantagem:</strong> {threat.advantageDetail}
                  </span>
                </div>
              )}

              {threat.counterItems.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-xs font-medium text-zinc-400">Itens recomendados contra {threat.champion.name}:</span>
                  {threat.counterItems.map((ci) => (
                    <div
                      key={ci.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0f1217] border border-[#262c38] text-xs text-zinc-200"
                    >
                      <img src={getItemIconUrl(patchVersion, ci.imageFull)} alt={ci.name} className="w-4 h-4 rounded-xs" />
                      <span>{ci.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Ally Synergies */}
      {matchups.allySynergies.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-sky-400" />
            <h2 className="text-base font-bold text-zinc-100">Sinergias com os Aliados</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matchups.allySynergies.map((syn) => (
              <div key={syn.champion.id} className="rm-panel rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={getChampionIconUrl(patchVersion, syn.champion.imageFull)}
                      alt={syn.champion.name}
                      className="w-10 h-10 rounded-md border border-[#2c3240] object-cover"
                    />
                    <div>
                      <div className="text-sm font-bold text-zinc-100">
                        {syn.champion.name} ({ROLE_LABELS[syn.role]})
                      </div>
                      <span className="text-[11px] font-semibold text-sky-400 tabular-nums">
                        Sinergia {syn.synergyLevel} ({syn.synergyScore}/100)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {syn.keyAllySpells.map((sp) => (
                      <img
                        key={sp.keySlot}
                        src={getSpellIconUrl(patchVersion, sp.imageFull)}
                        alt={sp.name}
                        title={`${sp.keySlot}: ${sp.name}`}
                        className="w-7 h-7 rounded border border-[#2c3240]"
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{syn.comboExplanation}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
