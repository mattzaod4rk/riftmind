import type {
  ChampionData,
  ChampionSpell,
  ItemCategory,
  ItemData,
  ParsedItemFeatures,
  RuneTree,
  StatShard,
  SummonerSpellData,
} from './types.ts';

export function stripHtml(raw: string | undefined | null): string {
  if (!raw) return '';
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function parseChampionDetailJson(champRaw: any): ChampionData {
  const spellKeys: ('Q' | 'W' | 'E' | 'R')[] = ['Q', 'W', 'E', 'R'];
  const spells: ChampionSpell[] = (champRaw.spells || []).slice(0, 4).map((sp: any, idx: number) => {
    const combinedText = `${sp.description || ''} ${sp.tooltip || ''}`;
    const lower = combinedText.toLowerCase();

    const detectedCC: string[] = [];
    if (/atordo|stun/i.test(lower)) detectedCC.push('Atordoamento');
    if (/arremess|levanta|knockup|ao ar/i.test(lower)) detectedCC.push('Arremesso ao Ar');
    if (/suprim|suppress/i.test(lower)) detectedCC.push('Supressão');
    if (/enraíz|enraiz|prend|imobiliz/i.test(lower)) detectedCC.push('Enraizamento');
    if (/encant|charm/i.test(lower)) detectedCC.push('Encanto');
    if (/provoc|taunt/i.test(lower)) detectedCC.push('Provocação');
    if (/temor|amedront|fuga|fear/i.test(lower)) detectedCC.push('Temor');
    if (/silenc/i.test(lower)) detectedCC.push('Silêncio');
    if (/polimorf|polymorph/i.test(lower)) detectedCC.push('Polimorfia');
    if (/empurr|puxa|arrasta|ancora/i.test(lower)) detectedCC.push('Deslocamento');
    if (/lentidão|reduz a velocidade de movimento/i.test(lower)) detectedCC.push('Lentidão');
    if (/cegueira|cega|visão reduzida/i.test(lower)) detectedCC.push('Cegueira');

    const damageTypes: ('physical' | 'magic' | 'true')[] = [];
    if (/<physicaldamage>|dano físico/i.test(combinedText)) damageTypes.push('physical');
    if (/<magicdamage>|dano mágico/i.test(combinedText)) damageTypes.push('magic');
    if (/<truedamage>|dano verdadeiro/i.test(combinedText)) damageTypes.push('true');

    const hasHeal = /<healing>|restaura[^.]*vida|cura\b|curando/i.test(combinedText);
    const hasShield = /<shield>|concede[^.]*escudo|recebe[^.]*escudo|escudo que absorve/i.test(combinedText);
    const hasDash =
      /avança|salta|investe|teleporta|desliza|traslada|lampejo/i.test(lower);

    return {
      id: sp.id,
      keySlot: spellKeys[idx] || 'Q',
      name: sp.name,
      description: sp.description || '',
      cleanDescription: stripHtml(sp.description),
      tooltip: sp.tooltip || '',
      cooldownBurn: sp.cooldownBurn || '0',
      costBurn: sp.costBurn || '0',
      rangeBurn: sp.rangeBurn || '0',
      imageFull: sp.image?.full || '',
      detectedCC,
      hasHeal,
      hasShield,
      hasDash,
      damageTypes,
    };
  });

  return {
    id: champRaw.id,
    key: String(champRaw.key),
    name: champRaw.name,
    title: champRaw.title || '',
    blurb: champRaw.blurb || '',
    tags: champRaw.tags || [],
    partype: champRaw.partype || '',
    info: champRaw.info || { attack: 5, defense: 5, magic: 5, difficulty: 5 },
    stats: champRaw.stats,
    imageFull: champRaw.image?.full || `${champRaw.id}.png`,
    passive: {
      name: champRaw.passive?.name || 'Passiva',
      description: champRaw.passive?.description || '',
      cleanDescription: stripHtml(champRaw.passive?.description),
      imageFull: champRaw.passive?.image?.full || '',
    },
    spells,
    allytips: champRaw.allytips || [],
    enemytips: champRaw.enemytips || [],
  };
}

// Legacy duplicate IDs for Jungle companions where 1101/1102/1103 are the canonical Summoner's Rift pets
const EXCLUDED_DUPLICATE_ITEM_IDS = new Set([
  '1105',
  '1106',
  '1107',
  '3400', // Sua Parte (Pyke cut)
  '3599', // Kalista spear
  '3600', // Kalista spear
]);

const TIER_3_BOOTS_IDS = new Set(['3168', '3170', '3171', '3172', '3173', '3174', '3175']);
const TIER_2_BOOTS_IDS = new Set(['3006', '3008', '3009', '3020', '3047', '3111', '3158']);
const SUPPORT_FINAL_QUEST_IDS = new Set(['3869', '3870', '3871', '3876', '3877']);
const JUNGLE_PET_IDS = new Set(['1101', '1102', '1103']);
const LANE_STARTER_IDS = new Set(['1054', '1055', '1056', '1082', '1083', '1086', '1120', '3070', '3865']);

function extractStatFromHtml(statsHtml: string, pattern: RegExp): number {
  const m = statsHtml.match(pattern);
  if (!m) return 0;
  return parseFloat(m[1].replace(',', '.')) || 0;
}

export function parseItemFeatures(id: string, raw: any): ParsedItemFeatures {
  const desc: string = raw.description || '';
  const statsMatch = desc.match(/<stats>([\s\S]*?)<\/stats>/i);
  const statsBlock = statsMatch ? statsMatch[1] : '';
  const statLines = statsBlock
    .split(/<br\s*\/?>/i)
    .map((s) => stripHtml(s).trim())
    .filter(Boolean);

  const ap =
    raw.stats?.FlatMagicDamageMod ||
    extractStatFromHtml(statsBlock, /<attention>([\d.,]+)<\/attention>\s*de Poder de Habilidade/i);
  const ad =
    raw.stats?.FlatPhysicalDamageMod ||
    extractStatFromHtml(statsBlock, /<attention>([\d.,]+)<\/attention>\s*de Dano de Ataque/i);
  const attackSpeedPct =
    (raw.stats?.PercentAttackSpeedMod ? Math.round(raw.stats.PercentAttackSpeedMod * 100) : 0) ||
    extractStatFromHtml(statsBlock, /<attention>([\d.,]+)%<\/attention>\s*de Velocidade de Ataque/i);
  const critPct =
    (raw.stats?.FlatCritChanceMod ? Math.round(raw.stats.FlatCritChanceMod * 100) : 0) ||
    extractStatFromHtml(statsBlock, /<attention>([\d.,]+)%<\/attention>\s*de Chance de Acerto Crítico/i);
  const lethality = extractStatFromHtml(statsBlock, /<attention>([\d.,]+)<\/attention>\s*de Letalidade/i);
  const armorPenPct = extractStatFromHtml(
    statsBlock,
    /<attention>([\d.,]+)%<\/attention>\s*de Penetração de Armadura/i,
  );
  const magicPenFlat = extractStatFromHtml(statsBlock, /<attention>([\d.,]+)<\/attention>\s*de Penetração Mágica/i);
  const magicPenPct = extractStatFromHtml(statsBlock, /<attention>([\d.,]+)%<\/attention>\s*de Penetração Mágica/i);
  const health =
    raw.stats?.FlatHPPoolMod || extractStatFromHtml(statsBlock, /<attention>([\d.,]+)<\/attention>\s*de Vida\b/i);
  const armor =
    raw.stats?.FlatArmorMod || extractStatFromHtml(statsBlock, /<attention>([\d.,]+)<\/attention>\s*de Armadura/i);
  const magicResist =
    raw.stats?.FlatSpellBlockMod ||
    extractStatFromHtml(statsBlock, /<attention>([\d.,]+)<\/attention>\s*de Resistência Mágica/i);
  const abilityHaste = extractStatFromHtml(
    statsBlock,
    /<attention>([\d.,]+)<\/attention>\s*de Aceleração de Habilidade/i,
  );
  const mana =
    raw.stats?.FlatMPPoolMod || extractStatFromHtml(statsBlock, /<attention>([\d.,]+)<\/attention>\s*de Mana\b/i);
  const manaRegenPct = extractStatFromHtml(
    statsBlock,
    /<attention>([\d.,]+)%<\/attention>\s*de Regeneração de Mana/i,
  );
  const healthRegenPct = extractStatFromHtml(
    statsBlock,
    /<attention>([\d.,]+)%<\/attention>\s*de Regeneração de Vida/i,
  );
  const healShieldPowerPct = extractStatFromHtml(
    statsBlock,
    /<attention>([\d.,]+)%<\/attention>\s*de Cura e Resistência do Escudo/i,
  );
  const lifeStealPct =
    (raw.stats?.PercentLifeStealMod ? Math.round(raw.stats.PercentLifeStealMod * 100) : 0) ||
    extractStatFromHtml(statsBlock, /<attention>([\d.,]+)%<\/attention>\s*de Roubo de Vida/i);
  const omnivampPct = extractStatFromHtml(
    statsBlock,
    /<attention>([\d.,]+)%<\/attention>\s*de Vampirismo Universal/i,
  );
  const moveSpeedFlat =
    raw.stats?.FlatMovementSpeedMod ||
    extractStatFromHtml(statsBlock, /<attention>([\d.,]+)<\/attention>\s*de Velocidade de Movimento/i);
  const moveSpeedPct =
    (raw.stats?.PercentMovementSpeedMod ? Math.round(raw.stats.PercentMovementSpeedMod * 100) : 0) ||
    extractStatFromHtml(statsBlock, /<attention>([\d.,]+)%<\/attention>\s*de Velocidade de Movimento/i);
  const tenacityPct = extractStatFromHtml(statsBlock, /<attention>([\d.,]+)%<\/attention>\s*de Tenacidade/i);

  // Extract passive and active blocks
  const passiveBlocks: { name: string; text: string; isActive: boolean }[] = [];
  const restAfterStats = statsMatch ? desc.slice((statsMatch.index || 0) + statsMatch[0].length) : desc;
  const blockRegex = /<(passive|active)>([\s\S]*?)<\/\1>([\s\S]*?)(?=<(?:passive|active)>|<\/mainText>|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(restAfterStats)) !== null) {
    const isActive = match[1].toLowerCase() === 'active';
    const blockName = stripHtml(match[2]).replace(/:$/, '').trim();
    const blockBody = stripHtml(match[3]).trim();
    if (blockName || blockBody) {
      passiveBlocks.push({
        name: blockName || (isActive ? 'Ativo' : 'Passivo'),
        text: blockBody,
        isActive,
      });
    }
  }

  const lowerDesc = stripHtml(desc).toLowerCase();
  const tags: string[] = raw.tags || [];

  const grievousWounds = /feridas dolorosas/i.test(lowerDesc);
  const antiShield = /reduz os escudos|escudos que ele recebe/i.test(lowerDesc);
  const maxHpDamage = /vida máxima|vida atual do alvo/i.test(lowerDesc);
  const onHit = tags.includes('OnHit') || /ao contato/i.test(lowerDesc);
  const hasActive = tags.includes('Active') || passiveBlocks.some((b) => b.isActive);
  const hasShield = /<shield>|concede um escudo|recebe um escudo/i.test(desc);
  const hasHeal = /<healing>|restaura [^.]*vida|cura [^.]*vida/i.test(desc);
  const spellblade = /lâmina arcana/i.test(lowerDesc);
  const qssCleanse = /remove todos os desarmes|remove todos os efeitos de controle|mercúrio/i.test(lowerDesc) && hasActive;
  const stasis = /estase|invulnerável e inalvejável por 2[.,]5/i.test(lowerDesc);
  const spellshield = /escudo de feitiço/i.test(lowerDesc);
  const critAmplifier = id === '3031' || /dano de acerto crítico/i.test(lowerDesc);
  const allyBuffAP = id === '6616' || (/poder de habilidade/i.test(lowerDesc) && /curar ou conceder escudo/i.test(lowerDesc));
  const allyBuffAS = id === '3504' || (/velocidade de ataque/i.test(lowerDesc) && /curar ou conceder escudo/i.test(lowerDesc));
  const knightRedirect = id === '3109' || /digno/i.test(lowerDesc);
  const aoeShieldActive = id === '3190' || (/aliados próximos recebem um escudo/i.test(lowerDesc) && hasActive);
  const aoeHealActive = id === '3107' || (/intervenção/i.test(lowerDesc) && hasActive);
  const teamSpeedActive = id === '2065' || (/discurso inspirador/i.test(lowerDesc) && hasActive);
  const rangedOnly = /apenas ataque à distância|exclusivo para campeões de ataque à distância/i.test(lowerDesc) || id === '3085';
  const meleeOnly = /apenas corpo a corpo/i.test(lowerDesc);

  // Unique passive exclusivity groups so buildEngine never recommends conflicting items together
  const uniqueGroups: string[] = [];
  if (tags.includes('Boots') || id === '1001' || TIER_2_BOOTS_IDS.has(id) || TIER_3_BOOTS_IDS.has(id)) {
    uniqueGroups.push('BOOTS');
  }
  if (id === '3865' || SUPPORT_FINAL_QUEST_IDS.has(id)) {
    uniqueGroups.push('SUPPORT_QUEST');
  }
  if (JUNGLE_PET_IDS.has(id)) {
    uniqueGroups.push('JUNGLE_PET');
  }
  if (/salva-vidas/i.test(lowerDesc) || ['3053', '3156', '6673', '3003', '3040'].includes(id)) {
    uniqueGroups.push('LIFELINE');
  }
  if (spellblade || ['3078', '3100', '6662', '3057', '2510'].includes(id)) {
    uniqueGroups.push('SPELLBLADE');
  }
  if (armorPenPct > 0 || ['3036', '3033', '6694', '3071', '3302'].includes(id)) {
    if (['3036', '3033', '6694', '3035'].includes(id)) uniqueGroups.push('LAST_WHISPER');
  }
  if (magicPenPct > 0 || ['3135', '4628', '3137'].includes(id)) {
    uniqueGroups.push('VOID_PEN');
  }
  if (['3074', '3748', '6631', '3077'].includes(id)) {
    uniqueGroups.push('HYDRA');
  }
  if (['3070', '3003', '3004', '3119'].includes(id)) {
    uniqueGroups.push('TEAR_AWE');
  }
  if (['3068', '6664'].includes(id)) {
    uniqueGroups.push('IMMOLATE');
  }
  if (['3031', '3124', '6677'].includes(id)) {
    uniqueGroups.push('CRIT_MODIFIER');
  }
  if (grievousWounds) {
    uniqueGroups.push('GRIEVOUS_WOUNDS');
  }
  if (qssCleanse || ['3140', '3139', '6035'].includes(id)) {
    uniqueGroups.push('QUICKSILVER');
  }

  return {
    ap,
    ad,
    attackSpeedPct,
    critPct,
    lethality,
    armorPenPct,
    magicPenFlat,
    magicPenPct,
    health,
    armor,
    magicResist,
    abilityHaste,
    mana,
    manaRegenPct,
    healthRegenPct,
    healShieldPowerPct,
    lifeStealPct,
    omnivampPct,
    moveSpeedFlat,
    moveSpeedPct,
    tenacityPct,
    grievousWounds,
    antiShield,
    maxHpDamage,
    onHit,
    hasActive,
    hasShield,
    hasHeal,
    spellblade,
    qssCleanse,
    stasis,
    spellshield,
    critAmplifier,
    allyBuffAP,
    allyBuffAS,
    knightRedirect,
    aoeShieldActive,
    aoeHealActive,
    teamSpeedActive,
    rangedOnly,
    meleeOnly,
    uniqueGroups,
    statLines,
    passiveBlocks,
  };
}

export function parseItemEntry(id: string, raw: any): ItemData {
  // Strictly validate Summoner's Rift (Map 11) standard ranked items:
  // Exclude 6-digit mode overrides (32xxxx Swiftplay/Brawl, 66xxxx Arena Prismatic, 22xxxx Arena, 44xxxx)
  const isCanonicalIdLength = id.length === 4;
  const onMap11 = Boolean(raw.maps && raw.maps['11'] === true);
  const purchasable = Boolean(raw.gold && raw.gold.purchasable === true);
  const inStore = raw.inStore !== false;
  const noSpecialLock = !raw.requiredChampion && !raw.requiredAlly && !raw.specialRecipe;
  const notDuplicate = !EXCLUDED_DUPLICATE_ITEM_IDS.has(id);

  const srValid = isCanonicalIdLength && onMap11 && purchasable && inStore && noSpecialLock && notDuplicate;

  // Filter `into` and `from` to 4-digit canonical items so recipe trees never point to Arena/Brawl duplicates
  const from = (raw.from || []).filter((cid: string) => cid.length === 4);
  const into = (raw.into || []).filter((cid: string) => cid.length === 4);
  const tags: string[] = raw.tags || [];
  const goldTotal = raw.gold?.total ?? 0;

  let category: ItemCategory = 'other';
  if (tags.includes('Trinket')) {
    category = 'trinket';
  } else if (tags.includes('Consumable')) {
    category = 'consumable';
  } else if (JUNGLE_PET_IDS.has(id)) {
    category = 'jungle_pet';
  } else if (SUPPORT_FINAL_QUEST_IDS.has(id)) {
    category = 'support_quest';
  } else if (LANE_STARTER_IDS.has(id)) {
    category = 'starter';
  } else if (id === '1001') {
    category = 'boots_t1';
  } else if (TIER_2_BOOTS_IDS.has(id)) {
    category = 'boots_t2';
  } else if (TIER_3_BOOTS_IDS.has(id)) {
    category = 'boots_t3';
  } else if (into.length === 0 && goldTotal >= 1600) {
    category = 'completed';
  } else if (goldTotal > 0) {
    category = 'component';
  }

  return {
    id,
    name: raw.name || id,
    plaintext: raw.plaintext || '',
    description: raw.description || '',
    cleanDescription: stripHtml(raw.description),
    imageFull: raw.image?.full || `${id}.png`,
    goldTotal,
    goldBase: raw.gold?.base ?? 0,
    goldSell: raw.gold?.sell ?? 0,
    purchasable,
    from,
    into,
    tags,
    depth: raw.depth ?? 1,
    srValid,
    category,
    features: parseItemFeatures(id, raw),
  };
}

export function parseRunesJson(runesRaw: any[]): RuneTree[] {
  return (runesRaw || []).map((tree: any) => ({
    id: tree.id,
    key: tree.key,
    icon: tree.icon,
    name: tree.name,
    slots: (tree.slots || []).map((slot: any) => ({
      runes: (slot.runes || []).map((r: any) => ({
        id: r.id,
        key: r.key,
        icon: r.icon,
        name: r.name,
        shortDesc: r.shortDesc || '',
        longDesc: r.longDesc || '',
        cleanDesc: stripHtml(r.longDesc || r.shortDesc),
      })),
    })),
  }));
}

export function getOfficialStatShards(): StatShard[] {
  return [
    // Row 0: Offense
    {
      id: 'shard_off_adaptive',
      row: 0,
      name: 'Força Adaptativa (+9)',
      description: '+5,4 de Dano de Ataque ou +9 de Poder de Habilidade (Adaptativo)',
      iconUrl: 'perk-images/StatMods/StatModsAdaptiveForceIcon.png',
    },
    {
      id: 'shard_off_as',
      row: 0,
      name: 'Velocidade de Ataque (+10%)',
      description: '+10% de Velocidade de Ataque',
      iconUrl: 'perk-images/StatMods/StatModsAttackSpeedIcon.png',
    },
    {
      id: 'shard_off_haste',
      row: 0,
      name: 'Aceleração de Habilidade (+8)',
      description: '+8 de Aceleração de Habilidade',
      iconUrl: 'perk-images/StatMods/StatModsCDRScalingIcon.png',
    },
    // Row 1: Flex
    {
      id: 'shard_flex_adaptive',
      row: 1,
      name: 'Força Adaptativa (+9)',
      description: '+5,4 de Dano de Ataque ou +9 de Poder de Habilidade (Adaptativo)',
      iconUrl: 'perk-images/StatMods/StatModsAdaptiveForceIcon.png',
    },
    {
      id: 'shard_flex_ms',
      row: 1,
      name: 'Velocidade de Movimento (+2,5%)',
      description: '+2,5% de Velocidade de Movimento',
      iconUrl: 'perk-images/StatMods/StatModsMovementSpeedIcon.png',
    },
    {
      id: 'shard_flex_hp_scaling',
      row: 1,
      name: 'Vida Escalável (+10–180)',
      description: '+10 a 180 de Vida com base no nível',
      iconUrl: 'perk-images/StatMods/StatModsHealthScalingIcon.png',
    },
    // Row 2: Defense
    {
      id: 'shard_def_hp_flat',
      row: 2,
      name: 'Vida Base (+65)',
      description: '+65 de Vida fixa para trocas nos primeiros níveis',
      iconUrl: 'perk-images/StatMods/StatModsHealthPlusIcon.png',
    },
    {
      id: 'shard_def_tenacity',
      row: 2,
      name: 'Tenacidade e Resist. a Lentidão (+15%)',
      description: '+15% de Tenacidade e Resistência a Lentidão',
      iconUrl: 'perk-images/StatMods/StatModsTenacityIcon.png',
    },
    {
      id: 'shard_def_hp_scaling',
      row: 2,
      name: 'Vida Escalável (+10–180)',
      description: '+10 a 180 de Vida com base no nível',
      iconUrl: 'perk-images/StatMods/StatModsHealthScalingIcon.png',
    },
  ];
}

export function parseSummonersJson(summRaw: any): SummonerSpellData[] {
  const entries = Object.values(summRaw?.data || {}) as any[];
  return entries
    .filter((s) => Array.isArray(s.modes) && s.modes.includes('CLASSIC'))
    .map((s) => ({
      id: s.id,
      key: String(s.key),
      name: s.name,
      description: stripHtml(s.description),
      cooldownBurn: s.cooldownBurn || '0',
      imageFull: s.image?.full || `${s.id}.png`,
      modes: s.modes || [],
    }));
}
