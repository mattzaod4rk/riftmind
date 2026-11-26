import React, { useState } from 'react';
import { X, Swords } from 'lucide-react';
import { ROLES, ROLE_LABELS, type ChampionData, type Role } from '../../shared/types.ts';
import { inferChampionRoles, profileChampion } from '../../shared/engine/championProfiler.ts';
import { getChampionIconUrl, getPassiveIconUrl, getSpellIconUrl } from '../lib/assets.ts';

export function ChampionInspectorModal({
  champion,
  patchVersion,
  onClose,
  onUseInDraft,
}: {
  champion: ChampionData | null;
  patchVersion: string;
  onClose: () => void;
  onUseInDraft?: (champion: ChampionData, role: Role) => void;
}) {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  if (!champion) return null;
  const profile = profileChampion(champion);
  const effectiveRole = selectedRole || profile.primaryRoles[0] || 'MID';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="rm-panel rounded-lg max-w-3xl w-full max-h-[88vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-[#222731] bg-[#101217] sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <img
              src={getChampionIconUrl(patchVersion, champion.imageFull)}
              alt={champion.name}
              className="w-14 h-14 rounded-md border border-[#2d3340] object-cover"
            />
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-zinc-100">{champion.name}</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-[#1b202a] text-zinc-300 border border-[#2a303d]">
                  {profile.archetypeLabel}
                </span>
              </div>
              <p className="text-xs text-zinc-400 capitalize mt-0.5">{champion.title}</p>
              <div className="flex flex-wrap gap-2 mt-2 text-xs text-zinc-400">
                <span>
                  Rotas habituais:{' '}
                  <strong className="text-zinc-200">
                    {profile.primaryRoles.map((r) => ROLE_LABELS[r]).join(', ')}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Recurso: <strong className="text-zinc-200">{champion.partype || 'Nenhum'}</strong>
                </span>
                <span>•</span>
                <span className="tabular-nums">
                  Alcance: <strong className="text-zinc-200">{champion.stats.attackrange}</strong>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-[#1c2029] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Quick Action: Use in Draft */}
          {onUseInDraft && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-md bg-[#101318] border border-[#1f242d]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-zinc-400">Controlar no draft como:</span>
                {ROLES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setSelectedRole(r)}
                    className={`px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition ${
                      effectiveRole === r
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                        : 'bg-[#171b22] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  onUseInDraft(champion, effectiveRole);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-orange-500 hover:bg-orange-400 text-zinc-950 font-semibold text-xs cursor-pointer transition"
              >
                <Swords className="w-3.5 h-3.5" /> Jogar de {champion.name} ({ROLE_LABELS[effectiveRole]})
              </button>
            </div>
          )}

          {/* Base Attributes Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
            <div className="p-3 rounded-md bg-[#101318] border border-[#1e232d]">
              <div className="text-xs text-zinc-400">Vida / Armadura / RM</div>
              <div className="text-sm font-semibold text-zinc-100 mt-1">
                {champion.stats.hp} / {champion.stats.armor} / {champion.stats.spellblock}
              </div>
            </div>
            <div className="p-3 rounded-md bg-[#101318] border border-[#1e232d]">
              <div className="text-xs text-zinc-400">Dano Base / Vel. Mov.</div>
              <div className="text-sm font-semibold text-zinc-100 mt-1">
                {champion.stats.attackdamage} AD • {champion.stats.movespeed} MS
              </div>
            </div>
            <div className="p-3 rounded-md bg-[#101318] border border-[#1e232d]">
              <div className="text-xs text-zinc-400">Perfil de Dano</div>
              <div className="text-sm font-semibold text-zinc-100 mt-1">
                {Math.round(profile.damageMix.physical * 100)}% AD •{' '}
                {Math.round(profile.damageMix.magic * 100)}% AP
              </div>
            </div>
            <div className="p-3 rounded-md bg-[#101318] border border-[#1e232d]">
              <div className="text-xs text-zinc-400">Índices de Kit</div>
              <div className="text-sm font-semibold text-zinc-100 mt-1">
                CC {profile.ratings.hardCC}/10 • Peel {profile.ratings.peel}/10
              </div>
            </div>
          </div>

          {/* Abilities List */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Passiva e Habilidades Oficiais (Patch {patchVersion})
            </h3>

            <div className="divide-y divide-[#1f242d] border border-[#1f242d] rounded-md bg-[#101318]">
              {/* Passive */}
              <div className="flex gap-3.5 p-4">
                <img
                  src={getPassiveIconUrl(patchVersion, champion.passive.imageFull)}
                  alt={champion.passive.name}
                  className="w-11 h-11 rounded border border-[#2c3240] shrink-0"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#1d222c] text-orange-400">
                      Passiva
                    </span>
                    <span className="font-semibold text-zinc-100 text-sm">{champion.passive.name}</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                    {champion.passive.cleanDescription}
                  </p>
                </div>
              </div>

              {/* Q W E R */}
              {champion.spells.map((sp) => (
                <div key={sp.id} className="flex gap-3.5 p-4">
                  <img
                    src={getSpellIconUrl(patchVersion, sp.imageFull)}
                    alt={sp.name}
                    className="w-11 h-11 rounded border border-[#2c3240] shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#1d222c] text-sky-400">
                          {sp.keySlot}
                        </span>
                        <span className="font-semibold text-zinc-100 text-sm">{sp.name}</span>
                      </div>
                      <div className="text-xs text-zinc-400 tabular-nums">
                        CD: <span className="text-zinc-200">{sp.cooldownBurn}s</span> • Custo:{' '}
                        <span className="text-zinc-200">{sp.costBurn}</span> • Alcance:{' '}
                        <span className="text-zinc-200">{sp.rangeBurn}</span>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                      {sp.cleanDescription}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
