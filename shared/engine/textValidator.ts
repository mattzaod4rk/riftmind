import type { ChampionData, FullDraftAnalysis } from '../types.ts';
import type { ProfiledTeamMember } from './compositionEngine.ts';

/**
 * Formata uma lista de nomes em português natural ("A", "A e B", "A, B e C"),
 * removendo duplicatas e excluindo nomes proibidos no contexto (ex.: o próprio campeão protetor).
 */
export function formatNameList(
  names: (string | null | undefined)[],
  conjunction: 'e' | 'ou' = 'e',
  exclude: (string | null | undefined)[] = [],
): string {
  const excludedSet = new Set(
    exclude.filter((x): x is string => Boolean(x && x.trim())).map((x) => x.trim().toLowerCase()),
  );
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const raw of names) {
    if (!raw) continue;
    const clean = raw.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (excludedSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    unique.push(clean);
  }

  if (unique.length === 0) return '';
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} ${conjunction} ${unique[1]}`;
  return `${unique.slice(0, -1).join(', ')} ${conjunction} ${unique[unique.length - 1]}`;
}

export interface DraftTextValidationContext {
  userChampionName: string;
  allyNames: string[];
  enemyNames: string[];
  allCatalogChampionNames: string[];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Corrige listas encadeadas com múltiplos " e " ("A e B e C" -> "A, B e C")
 * e elimina repetições do mesmo nome de campeão na mesma frase.
 */
export function sanitizeSentenceChampionMentions(
  sentence: string,
  draftChampionNames: string[],
): string {
  if (!sentence || draftChampionNames.length === 0) return sentence;

  // Sort longest names first (e.g. "Master Yi", "Tahm Kench", "Aurelion Sol" before shorter tokens)
  const sortedNames = [...draftChampionNames].sort((a, b) => b.length - a.length);
  const nameAlt = sortedNames.map(escapeRegex).join('|');

  let out = sentence;

  // 1. Replace chained "Champ1 e Champ2 e Champ3" with "Champ1, Champ2 e Champ3"
  const chain3Regex = new RegExp(`\\b(${nameAlt})\\s+e\\s+(${nameAlt})\\s+e\\s+(${nameAlt})\\b`, 'g');
  out = out.replace(chain3Regex, (_m, c1: string, c2: string, c3: string) =>
    formatNameList([c1, c2, c3], 'e'),
  );

  // 2. Replace immediate duplicate in a list: "Champ1 e Champ1" or "Champ1, Champ1"
  for (const name of sortedNames) {
    const esc = escapeRegex(name);
    out = out.replace(new RegExp(`\\b${esc}\\s*(?:,|e|ou)\\s*${esc}\\b`, 'gi'), name);
  }

  // 3. Replace self-protection redundancy: "protegendo ... e Champ com Champ" or "protegendo Champ com Champ"
  for (const name of sortedNames) {
    const esc = escapeRegex(name);
    // e.g. "protegendo Vladimir, Smolder e Milio com Milio" -> "protegendo Vladimir e Smolder enquanto Milio mantém a retaguarda segura"
    const listBeforeCom = new RegExp(
      `protegendo\\s+([^.;]+?)\\s+com\\s+${esc}\\b`,
      'gi',
    );
    out = out.replace(listBeforeCom, (_full, groupStr: string) => {
      const mentionedInGroup = sortedNames.filter((n) =>
        new RegExp(`\\b${escapeRegex(n)}\\b`, 'i').test(groupStr),
      );
      const filteredTargets = mentionedInGroup.filter((n) => n.toLowerCase() !== name.toLowerCase());
      if (filteredTargets.length > 0) {
        return `protegendo ${formatNameList(filteredTargets)} enquanto ${name} mantém a retaguarda segura`;
      }
      return `mantendo a retaguarda segura com ${name}`;
    });
  }

  // 4. If a single sentence still mentions the exact same champion name more than once, remove the duplicate from comma/conjunction lists
  for (const name of sortedNames) {
    const esc = escapeRegex(name);
    const matches = out.match(new RegExp(`\\b${esc}\\b`, 'g'));
    if (matches && matches.length > 1) {
      // Remove secondary occurrence when it appears inside a list like ", Name" or " e Name" before another clause mentioning Name
      let count = 0;
      out = out.replace(new RegExp(`(?:,\\s*|\\s+e\\s+)?\\b${esc}\\b`, 'g'), (match) => {
        count++;
        if (count === 1) return match;
        // Strip leading ", " or " e " along with the duplicate name if preceded by list separator
        if (/^(?:,\s*|\s+e\s+)/.test(match)) {
          return '';
        }
        return match;
      });
    }
  }

  // Clean up any leftover double spaces or awkward punctuation
  return out
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s*,/g, '(')
    .replace(/,\s*\)/g, ')')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

export function sanitizeGeneratedText(text: string, ctx: DraftTextValidationContext): string {
  if (!text) return text;
  const draftNames = Array.from(new Set([...ctx.allyNames, ...ctx.enemyNames]));

  // Split by sentence boundaries while keeping punctuation
  const parts = text.split(/(?<=[.!?])\s+/);
  const cleanedParts = parts.map((part) => sanitizeSentenceChampionMentions(part, draftNames));
  return cleanedParts.join(' ');
}

/**
 * Verifica se um texto menciona algum campeão do catálogo que NÃO faz parte do draft atual.
 * Retorna a lista de campeões intrusos encontrados (vazia se o texto for 100% fiel ao draft).
 */
export function findOutOfDraftChampionMentions(
  text: string,
  ctx: DraftTextValidationContext,
): string[] {
  if (!text) return [];
  const allowed = new Set([...ctx.allyNames, ...ctx.enemyNames].map((n) => n.toLowerCase()));

  // Common Portuguese words that coincide with champion names when lowercase ("vi" from ver, "mel", "aurora", "marca", "brand")
  // Check exact case-sensitive Proper Noun match for short ambiguous names
  const CASE_SENSITIVE_SHORT_NAMES = new Set(['Vi', 'Mel', 'Aurora', 'Brand', 'Jax', 'Lux', 'Vex', 'Zed', 'Sett', 'Shen', 'Sion', 'Zac', 'Zoe']);

  const intruders: string[] = [];
  for (const champName of ctx.allCatalogChampionNames) {
    if (allowed.has(champName.toLowerCase())) continue;
    const esc = escapeRegex(champName);
    const flags = CASE_SENSITIVE_SHORT_NAMES.has(champName) ? 'g' : 'gi';
    const regex = new RegExp(`\\b${esc}\\b`, flags);
    if (regex.test(text)) {
      intruders.push(champName);
    }
  }
  return intruders;
}

/**
 * Passagem final de validação e higienização sobre toda a análise gerada antes de exibi-la na interface.
 */
export function validateAndSanitizeAnalysis(
  analysis: FullDraftAnalysis,
  allyMembers: ProfiledTeamMember[],
  enemyMembers: ProfiledTeamMember[],
  allChampions: ChampionData[],
): FullDraftAnalysis {
  const ctx: DraftTextValidationContext = {
    userChampionName: analysis.userChampion.name,
    allyNames: allyMembers.map((m) => m.profile.champion.name),
    enemyNames: enemyMembers.map((m) => m.profile.champion.name),
    allCatalogChampionNames: allChampions.map((c) => c.name),
  };

  const clean = (s: string) => sanitizeGeneratedText(s, ctx);

  analysis.allyWinConditions = analysis.allyWinConditions.map(clean);
  analysis.enemyWinConditions = analysis.enemyWinConditions.map(clean);
  analysis.insights = analysis.insights.map((ins) => ({
    ...ins,
    title: clean(ins.title),
    description: clean(ins.description),
  }));

  analysis.build.buildIdentitySummary = clean(analysis.build.buildIdentitySummary);
  analysis.build.slots = analysis.build.slots.map((slot) => ({
    ...slot,
    reason: clean(slot.reason),
    benefit: clean(slot.benefit),
    whenToBuy: clean(slot.whenToBuy),
    alternative: slot.alternative
      ? {
          ...slot.alternative,
          whenToPrefer: clean(slot.alternative.whenToPrefer),
          pros: clean(slot.alternative.pros),
          cons: clean(slot.alternative.cons),
        }
      : undefined,
  }));
  analysis.build.situationalItems = analysis.build.situationalItems.map((sit) => ({
    ...sit,
    whenToBuy: clean(sit.whenToBuy),
    whyBuy: clean(sit.whyBuy),
    whenToAvoid: clean(sit.whenToAvoid),
  }));
  if (analysis.build.liveRecalculation) {
    analysis.build.liveRecalculation.bestImmediateBuyComponents.explanation = clean(
      analysis.build.liveRecalculation.bestImmediateBuyComponents.explanation,
    );
    analysis.build.liveRecalculation.tacticalAdjustments =
      analysis.build.liveRecalculation.tacticalAdjustments.map(clean);
  }

  analysis.runes.comparisonSummary = clean(analysis.runes.comparisonSummary);
  analysis.runes.recommended.overallReasoning = clean(analysis.runes.recommended.overallReasoning);
  analysis.runes.recommended.choiceExplanations = analysis.runes.recommended.choiceExplanations.map((c) => ({
    ...c,
    reason: clean(c.reason),
  }));
  analysis.runes.alternative.overallReasoning = clean(analysis.runes.alternative.overallReasoning);
  analysis.runes.alternative.choiceExplanations = analysis.runes.alternative.choiceExplanations.map((c) => ({
    ...c,
    reason: clean(c.reason),
  }));

  analysis.matchups.laneMatchupSummary.keyTradingRules =
    analysis.matchups.laneMatchupSummary.keyTradingRules.map(clean);
  analysis.matchups.enemyThreats = analysis.matchups.enemyThreats.map((t) => ({
    ...t,
    summary: clean(t.summary),
    interruptionDetail: t.interruptionDetail ? clean(t.interruptionDetail) : undefined,
    advantageDetail: t.advantageDetail ? clean(t.advantageDetail) : undefined,
  }));
  analysis.matchups.allySynergies = analysis.matchups.allySynergies.map((s) => ({
    ...s,
    comboExplanation: clean(s.comboExplanation),
  }));

  analysis.strategy.allyToPrioritize.reason = clean(analysis.strategy.allyToPrioritize.reason);
  analysis.strategy.biggestEnemyThreat.reason = clean(analysis.strategy.biggestEnemyThreat.reason);
  analysis.strategy.whoToProtectInTeamfights.reason = clean(analysis.strategy.whoToProtectInTeamfights.reason);
  analysis.strategy.teamWinCondition = clean(analysis.strategy.teamWinCondition);
  analysis.strategy.positioningGuide = clean(analysis.strategy.positioningGuide);
  analysis.strategy.whatToAvoid = analysis.strategy.whatToAvoid.map(clean);
  analysis.strategy.roleSpecificPlaybook.directives =
    analysis.strategy.roleSpecificPlaybook.directives.map((d) => ({
      ...d,
      guidance: clean(d.guidance),
    }));

  return analysis;
}
