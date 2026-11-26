import type { ChampionData, Role } from '../types.ts';

export type CombatArchetype =
  | 'enchanter'
  | 'catcher'
  | 'vanguard'
  | 'warden'
  | 'juggernaut'
  | 'diver'
  | 'skirmisher'
  | 'ad_assassin'
  | 'ap_assassin'
  | 'burst_mage'
  | 'battle_mage'
  | 'artillery_mage'
  | 'crit_marksman'
  | 'onhit_marksman'
  | 'caster_marksman'
  | 'specialist';

export interface ChampionScalingAffinities {
  ap: number;
  ad: number;
  crit: number;
  attackSpeed: number;
  onHit: number;
  lethality: number;
  magicPen: number;
  armorPen: number;
  healShield: number;
  abilityHaste: number;
  mana: number;
  tearUser: boolean;
  spellbladeUser: boolean;
  health: number;
  armor: number;
  magicResist: number;
  lifeStealOmnivamp: number;
}

export interface ChampionTacticalProfile {
  champion: ChampionData;
  primaryRoles: Role[];
  archetype: CombatArchetype;
  archetypeLabel: string;
  isRanged: boolean;
  usesMana: boolean;
  damageMix: {
    physical: number; // 0..1
    magic: number; // 0..1
    trueDamage: number; // 0..1
  };
  ratings: {
    hardCC: number; // 0..10
    softCC: number;
    engage: number;
    disengage: number;
    peel: number;
    poke: number;
    burst: number;
    sustainedDps: number;
    sustainHealShield: number;
    tankiness: number;
    mobility: number;
    pickoff: number;
    scalingLate: number;
    siege: number;
    antiTank: number;
  };
  affinities: ChampionScalingAffinities;
}

export const ARCHETYPE_LABELS: Record<CombatArchetype, string> = {
  enchanter: 'Encantador (Cura, Escudo e Utilidade)',
  catcher: 'Controlador de Pickoff / Armadilhas',
  vanguard: 'Tanque de Iniciação (Vanguarda)',
  warden: 'Tanque Protetor (Guardião / Peel)',
  juggernaut: 'Colosso (Lutador Pesado)',
  diver: 'Lutador de Dive / Avanço',
  skirmisher: 'Duelista / Hipercarregador Corpo a Corpo',
  ad_assassin: 'Assassino de Dano Físico',
  ap_assassin: 'Assassino de Dano Mágico',
  burst_mage: 'Mago de Explosão (Burst)',
  battle_mage: 'Mago de Batalha (DPS Mágico Sustentado)',
  artillery_mage: 'Mago de Artilharia / Poke',
  crit_marksman: 'Atirador de Crítico',
  onhit_marksman: 'Atirador de Velocidade / Ao Contato',
  caster_marksman: 'Atirador Conjurador / Alcance',
  specialist: 'Especialista Tático',
};

// Role membership sets by canonical Data Dragon ID so position filters cover the entire roster accurately
const ROLE_ROSTER: Record<Role, Set<string>> = {
  TOP: new Set([
    'Aatrox', 'Akali', 'Ambessa', 'Aurora', 'Camille', 'Chogath', 'Darius', 'DrMundo', 'Fiora', 'Gangplank',
    'Garen', 'Gnar', 'Gragas', 'Gwen', 'Heimerdinger', 'Illaoi', 'Irelia', 'Jax', 'Jayce', 'KSante',
    'Kayle', 'Kennen', 'Kled', 'Malphite', 'Mordekaiser', 'Nasus', 'Olaf', 'Ornn', 'Pantheon', 'Poppy',
    'Quinn', 'Renekton', 'Riven', 'Rumble', 'Sett', 'Shen', 'Singed', 'Sion', 'TahmKench', 'Teemo',
    'Trundle', 'Tryndamere', 'Urgot', 'Vayne', 'Vladimir', 'Volibear', 'Warwick', 'MonkeyKing', 'Yasuo',
    'Yone', 'Yorick', 'Zac', 'Zaahen',
  ]),
  JUNGLE: new Set([
    'Amumu', 'Belveth', 'Brand', 'Briar', 'Diana', 'Ekko', 'Elise', 'Evelynn', 'Fiddlesticks', 'Gragas',
    'Graves', 'Gwen', 'Hecarim', 'Ivern', 'JarvanIV', 'Jax', 'Karthus', 'Kayn', 'Khazix', 'Kindred',
    'LeeSin', 'Lillia', 'Maokai', 'MasterYi', 'Nidalee', 'Nocturne', 'Nunu', 'Olaf', 'Pantheon', 'Poppy',
    'Rammus', 'RekSai', 'Rengar', 'Sejuani', 'Shaco', 'Shyvana', 'Skarner', 'Taliyah', 'Talon', 'Trundle',
    'Udyr', 'Vi', 'Viego', 'Volibear', 'Warwick', 'MonkeyKing', 'XinZhao', 'Zac', 'Zed', 'Zyra',
  ]),
  MID: new Set([
    'Ahri', 'Akali', 'Akshan', 'Anivia', 'Annie', 'AurelionSol', 'Aurora', 'Azir', 'Brand', 'Cassiopeia',
    'Corki', 'Diana', 'Ekko', 'Fizz', 'Galio', 'Hwei', 'Irelia', 'Jayce', 'Kassadin', 'Katarina',
    'Leblanc', 'Lissandra', 'Lux', 'Malzahar', 'Mel', 'Naafiri', 'Neeko', 'Orianna', 'Pantheon', 'Qiyana',
    'Ryze', 'Smolder', 'Swain', 'Sylas', 'Syndra', 'Taliyah', 'Talon', 'Tristana', 'TwistedFate', 'Veigar',
    'Velkoz', 'Vex', 'Viktor', 'Vladimir', 'Xerath', 'Yasuo', 'Yone', 'Zed', 'Ziggs', 'Zoe',
  ]),
  ADC: new Set([
    'Aphelios', 'Ashe', 'Caitlyn', 'Corki', 'Draven', 'Ezreal', 'Jhin', 'Jinx', 'Kaisa', 'Kalista',
    'KogMaw', 'Lucian', 'MissFortune', 'Nilah', 'Samira', 'Senna', 'Sivir', 'Smolder', 'Tristana',
    'Twitch', 'Varus', 'Vayne', 'Xayah', 'Yunara', 'Zeri', 'Ziggs',
  ]),
  SUPPORT: new Set([
    'Alistar', 'Amumu', 'Annie', 'Bard', 'Blitzcrank', 'Brand', 'Braum', 'Elise', 'Hwei', 'Janna',
    'Karma', 'Leblanc', 'Leona', 'Lulu', 'Lux', 'Maokai', 'Mel', 'Milio', 'Morgana', 'Nami',
    'Nautilus', 'Neeko', 'Pantheon', 'Poppy', 'Pyke', 'Rakan', 'Rell', 'Renata', 'Senna', 'Seraphine',
    'Shaco', 'Shen', 'Sona', 'Soraka', 'Swain', 'TahmKench', 'Taric', 'Thresh', 'Velkoz', 'Xerath',
    'Yuumi', 'Zilean', 'Zyra',
  ]),
};

interface ExplicitChampionOverride {
  archetype?: CombatArchetype;
  trueDmgShare?: number;
  magicShare?: number;
  tearUser?: boolean;
  spellbladeUser?: boolean;
  antiTankBonus?: number;
  engageBonus?: number;
  disengageBonus?: number;
  peelBonus?: number;
  pokeBonus?: number;
  burstBonus?: number;
  scalingLateBonus?: number;
  pickoffBonus?: number;
}

const CHAMPION_OVERRIDES: Record<string, ExplicitChampionOverride> = {
  // Enchanters & Catchers
  Nami: { archetype: 'enchanter', peelBonus: 3, disengageBonus: 3, engageBonus: 2, pokeBonus: 2 },
  Lulu: { archetype: 'enchanter', peelBonus: 4, disengageBonus: 4 },
  Janna: { archetype: 'enchanter', peelBonus: 5, disengageBonus: 5 },
  Milio: { archetype: 'enchanter', peelBonus: 4, disengageBonus: 4 },
  Soraka: { archetype: 'enchanter', peelBonus: 3, scalingLateBonus: 2 },
  Sona: { archetype: 'enchanter', tearUser: true, scalingLateBonus: 3, peelBonus: 2 },
  Yuumi: { archetype: 'enchanter', peelBonus: 3, scalingLateBonus: 2 },
  Karma: { archetype: 'enchanter', pokeBonus: 3, peelBonus: 2 },
  Seraphine: { archetype: 'enchanter', tearUser: true, engageBonus: 2, peelBonus: 2 },
  Renata: { archetype: 'enchanter', disengageBonus: 4, peelBonus: 3 },
  Ivern: { archetype: 'enchanter', peelBonus: 4, disengageBonus: 2, pickoffBonus: 2 },
  Zilean: { archetype: 'enchanter', tearUser: true, peelBonus: 4, disengageBonus: 3 },
  Thresh: { archetype: 'catcher', pickoffBonus: 4, peelBonus: 3, engageBonus: 2 },
  Blitzcrank: { archetype: 'catcher', pickoffBonus: 5, engageBonus: 2 },
  Pyke: { archetype: 'ad_assassin', pickoffBonus: 4, trueDmgShare: 0.22 },
  Morgana: { archetype: 'catcher', peelBonus: 3, pickoffBonus: 3 },
  Bard: { archetype: 'catcher', pickoffBonus: 3, engageBonus: 2 },
  Rakan: { archetype: 'vanguard', engageBonus: 4, peelBonus: 3 },
  // Tanks (Vanguards & Wardens)
  Ornn: { archetype: 'vanguard', engageBonus: 4, scalingLateBonus: 3, peelBonus: 2 },
  Malphite: { archetype: 'vanguard', engageBonus: 5 },
  Leona: { archetype: 'vanguard', engageBonus: 4, pickoffBonus: 3 },
  Nautilus: { archetype: 'vanguard', engageBonus: 4, pickoffBonus: 4 },
  Alistar: { archetype: 'vanguard', engageBonus: 3, peelBonus: 3, disengageBonus: 2 },
  Rell: { archetype: 'vanguard', engageBonus: 5 },
  Sejuani: { archetype: 'vanguard', engageBonus: 4, pickoffBonus: 2 },
  Amumu: { archetype: 'vanguard', engageBonus: 4 },
  Zac: { archetype: 'vanguard', engageBonus: 4 },
  Sion: { archetype: 'vanguard', engageBonus: 3, scalingLateBonus: 2 },
  Maokai: { archetype: 'vanguard', engageBonus: 3, peelBonus: 2, pokeBonus: 1 },
  Braum: { archetype: 'warden', peelBonus: 5, disengageBonus: 4 },
  TahmKench: { archetype: 'warden', peelBonus: 4 },
  Taric: { archetype: 'warden', peelBonus: 5, disengageBonus: 4, tearUser: true },
  Shen: { archetype: 'warden', peelBonus: 4 },
  Poppy: { archetype: 'warden', peelBonus: 4, disengageBonus: 5 },
  Galio: { archetype: 'warden', peelBonus: 3, engageBonus: 2 },
  KSante: { archetype: 'warden', peelBonus: 2, trueDmgShare: 0.18, spellbladeUser: true },
  Rammus: { archetype: 'vanguard', engageBonus: 3, magicShare: 0.65 },
  Chogath: { archetype: 'vanguard', trueDmgShare: 0.25, scalingLateBonus: 2 },
  // Juggernauts, Divers & Skirmishers
  Garen: { archetype: 'juggernaut', trueDmgShare: 0.24, burstBonus: 2 },
  Darius: { archetype: 'juggernaut', trueDmgShare: 0.25, antiTankBonus: 2 },
  Sett: { archetype: 'juggernaut', trueDmgShare: 0.2, engageBonus: 2 },
  Mordekaiser: { archetype: 'juggernaut', magicShare: 0.85, antiTankBonus: 2 },
  Illaoi: { archetype: 'juggernaut', antiTankBonus: 2 },
  Nasus: { archetype: 'juggernaut', spellbladeUser: true, scalingLateBonus: 2 },
  Yorick: { archetype: 'juggernaut', spellbladeUser: true },
  Urgot: { archetype: 'juggernaut', antiTankBonus: 2 },
  DrMundo: { archetype: 'juggernaut', magicShare: 0.45, pokeBonus: 2 },
  Aatrox: { archetype: 'juggernaut', engageBonus: 1 },
  Trundle: { archetype: 'juggernaut', spellbladeUser: true, antiTankBonus: 4 },
  Olaf: { archetype: 'diver', trueDmgShare: 0.22 },
  Camille: { archetype: 'diver', spellbladeUser: true, trueDmgShare: 0.35, pickoffBonus: 3, engageBonus: 2 },
  Jax: { archetype: 'skirmisher', spellbladeUser: true, magicShare: 0.28, scalingLateBonus: 3 },
  Irelia: { archetype: 'diver', magicShare: 0.2 },
  Vi: { archetype: 'diver', engageBonus: 3, pickoffBonus: 4, antiTankBonus: 2 },
  JarvanIV: { archetype: 'diver', engageBonus: 4 },
  Hecarim: { archetype: 'diver', spellbladeUser: true, engageBonus: 3 },
  LeeSin: { archetype: 'diver', pickoffBonus: 3 },
  XinZhao: { archetype: 'diver', engageBonus: 2, disengageBonus: 2 },
  MonkeyKing: { archetype: 'diver', engageBonus: 4, spellbladeUser: true },
  Renekton: { archetype: 'diver', burstBonus: 2 },
  Pantheon: { archetype: 'diver', pickoffBonus: 3, burstBonus: 2 },
  Briar: { archetype: 'diver', engageBonus: 2, pickoffBonus: 3 },
  Ambessa: { archetype: 'diver', engageBonus: 3, antiTankBonus: 2 },
  MasterYi: { archetype: 'skirmisher', trueDmgShare: 0.32, antiTankBonus: 4, scalingLateBonus: 3 },
  Fiora: { archetype: 'skirmisher', trueDmgShare: 0.4, antiTankBonus: 5, scalingLateBonus: 3 },
  Gwen: { archetype: 'skirmisher', magicShare: 0.72, trueDmgShare: 0.22, antiTankBonus: 5, scalingLateBonus: 3 },
  Viego: { archetype: 'skirmisher', antiTankBonus: 2 },
  Belveth: { archetype: 'skirmisher', trueDmgShare: 0.25, antiTankBonus: 3, scalingLateBonus: 3 },
  Yasuo: { archetype: 'skirmisher', antiTankBonus: 2, scalingLateBonus: 2 },
  Yone: { archetype: 'skirmisher', magicShare: 0.28, trueDmgShare: 0.12, engageBonus: 3, scalingLateBonus: 3 },
  Tryndamere: { archetype: 'skirmisher', scalingLateBonus: 2 },
  Riven: { archetype: 'skirmisher', burstBonus: 2 },
  Lillia: { archetype: 'skirmisher', magicShare: 0.82, trueDmgShare: 0.15, antiTankBonus: 4, engageBonus: 2 },
  // Assassins
  Zed: { archetype: 'ad_assassin', burstBonus: 4, pickoffBonus: 4, pokeBonus: 2 },
  Talon: { archetype: 'ad_assassin', burstBonus: 4, pickoffBonus: 3 },
  Qiyana: { archetype: 'ad_assassin', burstBonus: 4, engageBonus: 3 },
  Khazix: { archetype: 'ad_assassin', burstBonus: 4, pickoffBonus: 4 },
  Rengar: { archetype: 'ad_assassin', burstBonus: 5, pickoffBonus: 4 },
  Naafiri: { archetype: 'ad_assassin', burstBonus: 3, pickoffBonus: 3 },
  Nocturne: { archetype: 'diver', pickoffBonus: 4, engageBonus: 3 },
  Kayn: { archetype: 'ad_assassin', burstBonus: 3, antiTankBonus: 2 },
  Akali: { archetype: 'ap_assassin', magicShare: 0.9, burstBonus: 4 },
  Fizz: { archetype: 'ap_assassin', magicShare: 0.9, spellbladeUser: true, burstBonus: 4, pickoffBonus: 3 },
  Ekko: { archetype: 'ap_assassin', magicShare: 0.9, spellbladeUser: true, burstBonus: 3 },
  Evelynn: { archetype: 'ap_assassin', magicShare: 0.92, burstBonus: 5, pickoffBonus: 5 },
  Katarina: { archetype: 'ap_assassin', magicShare: 0.82, burstBonus: 4 },
  Kassadin: { archetype: 'ap_assassin', magicShare: 0.95, tearUser: true, scalingLateBonus: 4, burstBonus: 1, pickoffBonus: -2.5 },
  Leblanc: { archetype: 'ap_assassin', magicShare: 0.92, burstBonus: 4, pickoffBonus: 4 },
  Diana: { archetype: 'ap_assassin', magicShare: 0.9, engageBonus: 3, burstBonus: 3 },
  Sylas: { archetype: 'ap_assassin', magicShare: 0.9, engageBonus: 2 },
  // Mages
  Cassiopeia: { archetype: 'battle_mage', magicShare: 0.95, tearUser: true, antiTankBonus: 4, scalingLateBonus: 4, disengageBonus: 3 },
  Ryze: { archetype: 'battle_mage', magicShare: 0.95, tearUser: true, scalingLateBonus: 3 },
  Anivia: { archetype: 'battle_mage', magicShare: 0.95, tearUser: true, disengageBonus: 4, antiTankBonus: 2 },
  AurelionSol: { archetype: 'battle_mage', magicShare: 0.95, antiTankBonus: 4, scalingLateBonus: 5 },
  Vladimir: { archetype: 'battle_mage', magicShare: 0.95, scalingLateBonus: 4, burstBonus: 3 },
  Swain: { archetype: 'battle_mage', magicShare: 0.92 },
  Malzahar: { archetype: 'battle_mage', magicShare: 0.95, antiTankBonus: 2, pickoffBonus: 4 },
  Viktor: { archetype: 'battle_mage', magicShare: 0.95, scalingLateBonus: 3, pokeBonus: 2 },
  Azir: { archetype: 'battle_mage', magicShare: 0.95, antiTankBonus: 4, scalingLateBonus: 4, disengageBonus: 3, engageBonus: 3 },
  Taliyah: { archetype: 'battle_mage', magicShare: 0.95, disengageBonus: 3, pickoffBonus: 2 },
  Brand: { archetype: 'battle_mage', magicShare: 0.95, antiTankBonus: 5 },
  Lux: { archetype: 'artillery_mage', magicShare: 0.94, pokeBonus: 4, burstBonus: 4, pickoffBonus: 3 },
  Xerath: { archetype: 'artillery_mage', magicShare: 0.96, pokeBonus: 5 },
  Velkoz: { archetype: 'artillery_mage', magicShare: 0.72, trueDmgShare: 0.26, pokeBonus: 5, antiTankBonus: 4 },
  Ziggs: { archetype: 'artillery_mage', magicShare: 0.95, pokeBonus: 5 },
  Zoe: { archetype: 'artillery_mage', magicShare: 0.88, trueDmgShare: 0.1, pokeBonus: 5, pickoffBonus: 4 },
  Hwei: { archetype: 'artillery_mage', magicShare: 0.95, pokeBonus: 4, disengageBonus: 2 },
  Jayce: { archetype: 'caster_marksman', pokeBonus: 4, tearUser: true, burstBonus: 3 },
  Syndra: { archetype: 'burst_mage', magicShare: 0.92, burstBonus: 4, pickoffBonus: 3 },
  Orianna: { archetype: 'burst_mage', magicShare: 0.95, engageBonus: 2, peelBonus: 2, scalingLateBonus: 3 },
  Ahri: { archetype: 'burst_mage', magicShare: 0.82, trueDmgShare: 0.15, pickoffBonus: 4 },
  Veigar: { archetype: 'burst_mage', magicShare: 0.96, scalingLateBonus: 5, burstBonus: 5, pickoffBonus: 3 },
  Annie: { archetype: 'burst_mage', magicShare: 0.95, engageBonus: 3, burstBonus: 4 },
  Lissandra: { archetype: 'burst_mage', magicShare: 0.95, engageBonus: 4, pickoffBonus: 4 },
  Vex: { archetype: 'burst_mage', magicShare: 0.95, engageBonus: 3, burstBonus: 3 },
  Neeko: { archetype: 'burst_mage', magicShare: 0.95, engageBonus: 4, burstBonus: 3 },
  Aurora: { archetype: 'burst_mage', magicShare: 0.92, burstBonus: 3, engageBonus: 2 },
  Mel: { archetype: 'artillery_mage', magicShare: 0.94, pokeBonus: 4, burstBonus: 3 },
  // Marksmen
  Jhin: { archetype: 'caster_marksman', pickoffBonus: 4, burstBonus: 3, pokeBonus: 2 },
  Caitlyn: { archetype: 'crit_marksman', pokeBonus: 4, scalingLateBonus: 3, pickoffBonus: 2 },
  Jinx: { archetype: 'crit_marksman', scalingLateBonus: 4, antiTankBonus: 2 },
  Aphelios: { archetype: 'crit_marksman', scalingLateBonus: 4, antiTankBonus: 3 },
  Tristana: { archetype: 'crit_marksman', scalingLateBonus: 3, burstBonus: 2 },
  Sivir: { archetype: 'crit_marksman', scalingLateBonus: 3 },
  Xayah: { archetype: 'crit_marksman', disengageBonus: 3, antiTankBonus: 2 },
  Draven: { archetype: 'crit_marksman', burstBonus: 4 },
  Lucian: { archetype: 'caster_marksman', burstBonus: 3 },
  Samira: { archetype: 'crit_marksman', burstBonus: 4 },
  Nilah: { archetype: 'crit_marksman', engageBonus: 2, antiTankBonus: 3 },
  MissFortune: { archetype: 'caster_marksman', burstBonus: 3, pokeBonus: 2 },
  Ezreal: { archetype: 'caster_marksman', magicShare: 0.3, pokeBonus: 5, tearUser: true, spellbladeUser: true },
  Smolder: { archetype: 'caster_marksman', magicShare: 0.22, trueDmgShare: 0.16, scalingLateBonus: 5, spellbladeUser: true },
  Corki: { archetype: 'caster_marksman', magicShare: 0.18, trueDmgShare: 0.18, spellbladeUser: true, pokeBonus: 3 },
  Senna: { archetype: 'caster_marksman', scalingLateBonus: 3, peelBonus: 2, pokeBonus: 3 },
  Ashe: { archetype: 'onhit_marksman', engageBonus: 4, pickoffBonus: 4 },
  Vayne: { archetype: 'onhit_marksman', trueDmgShare: 0.38, antiTankBonus: 5, scalingLateBonus: 4 },
  KogMaw: { archetype: 'onhit_marksman', magicShare: 0.48, trueDmgShare: 0.06, antiTankBonus: 5, scalingLateBonus: 4 },
  Kaisa: { archetype: 'onhit_marksman', magicShare: 0.38, antiTankBonus: 3, burstBonus: 3, scalingLateBonus: 3 },
  Varus: { archetype: 'onhit_marksman', magicShare: 0.32, pokeBonus: 4, pickoffBonus: 3, antiTankBonus: 3 },
  Kalista: { archetype: 'onhit_marksman', engageBonus: 2 },
  Twitch: { archetype: 'crit_marksman', trueDmgShare: 0.12, burstBonus: 3, scalingLateBonus: 4, pickoffBonus: 3 },
  Zeri: { archetype: 'crit_marksman', magicShare: 0.22, scalingLateBonus: 4 },
  Kindred: { archetype: 'crit_marksman', antiTankBonus: 3, scalingLateBonus: 3 },
  Graves: { archetype: 'crit_marksman', burstBonus: 3 },
  Akshan: { archetype: 'crit_marksman', pickoffBonus: 4, burstBonus: 3 },
};

function clamp10(v: number): number {
  return Math.max(0, Math.min(10, Math.round(v * 10) / 10));
}

export function inferChampionRoles(champ: ChampionData): Role[] {
  const roles: Role[] = [];
  for (const r of ['TOP', 'JUNGLE', 'MID', 'ADC', 'SUPPORT'] as Role[]) {
    if (ROLE_ROSTER[r].has(champ.id)) roles.push(r);
  }
  if (roles.length > 0) return roles;

  // Dynamic fallback for brand-new patch champions not yet in explicit roster
  const tags = champ.tags;
  if (tags.includes('Marksman')) roles.push('ADC');
  if (tags.includes('Support')) roles.push('SUPPORT');
  if (tags.includes('Mage') || tags.includes('Assassin')) roles.push('MID');
  if (tags.includes('Fighter') || tags.includes('Tank')) {
    roles.push('TOP');
    roles.push('JUNGLE');
  }
  return roles.length > 0 ? roles : ['MID'];
}

export function profileChampion(champ: ChampionData, assignedRole?: Role): ChampionTacticalProfile {
  const override = CHAMPION_OVERRIDES[champ.id] || {};
  const primaryRoles = inferChampionRoles(champ);
  const effectiveRole = assignedRole || primaryRoles[0] || 'MID';
  const tags = champ.tags || [];
  const isRanged = (champ.stats?.attackrange ?? 150) >= 350;
  const usesMana = /mana/i.test(champ.partype || '');

  // Determine Combat Archetype dynamically + override refinement
  let archetype: CombatArchetype = override.archetype || 'specialist';
  if (!override.archetype) {
    const anySpellHealShield = champ.spells.some((s) => s.hasHeal || s.hasShield);
    if (tags.includes('Support') && anySpellHealShield && isRanged) archetype = 'enchanter';
    else if (tags.includes('Support') && !isRanged) archetype = 'vanguard';
    else if (tags.includes('Tank') && tags.includes('Support')) archetype = 'warden';
    else if (tags.includes('Tank')) archetype = 'vanguard';
    else if (tags.includes('Marksman')) archetype = 'crit_marksman';
    else if (tags.includes('Assassin') && champ.info.magic >= 6) archetype = 'ap_assassin';
    else if (tags.includes('Assassin')) archetype = 'ad_assassin';
    else if (tags.includes('Mage') && isRanged) archetype = 'burst_mage';
    else if (tags.includes('Fighter') && tags.includes('Assassin')) archetype = 'skirmisher';
    else if (tags.includes('Fighter') && champ.stats.movespeed >= 345) archetype = 'diver';
    else if (tags.includes('Fighter')) archetype = 'juggernaut';
  }

  // Inspect actual spells for CC, dashes, heals, shields, and damage types
  let hardSpellCount = 0;
  let softSpellCount = 0;
  let dashSpellCount = 0;
  let healShieldCount = 0;
  let magicSpellCount = 0;
  let physSpellCount = 0;
  let trueSpellCount = 0;
  let maxSpellRange = champ.stats?.attackrange || 150;

  for (const sp of champ.spells) {
    const hard = sp.detectedCC.filter((c) => c !== 'Lentidão' && c !== 'Cegueira');
    if (hard.length > 0) hardSpellCount += sp.keySlot === 'R' ? 1.6 : 1.1;
    if (sp.detectedCC.includes('Lentidão') || sp.detectedCC.includes('Cegueira')) softSpellCount += 1;
    if (sp.hasDash) dashSpellCount += 1;
    if (sp.hasHeal || sp.hasShield) healShieldCount += 1;
    if (sp.damageTypes.includes('magic')) magicSpellCount++;
    if (sp.damageTypes.includes('physical')) physSpellCount++;
    if (sp.damageTypes.includes('true')) trueSpellCount++;
    if (sp.keySlot !== 'R') {
      const parsedRange = parseInt(sp.rangeBurn.split('/')[0] || '0', 10);
      if (!Number.isNaN(parsedRange) && parsedRange <= 1800 && parsedRange > maxSpellRange) {
        maxSpellRange = parsedRange;
      }
    }
  }

  // Compute damage distribution (physical / magic / true)
  let trueShare = override.trueDmgShare ?? (trueSpellCount > 0 ? 0.14 : 0.02);
  let magicShare: number;
  if (override.magicShare !== undefined) {
    magicShare = override.magicShare * (1 - trueShare);
  } else if (
    ['enchanter', 'ap_assassin', 'burst_mage', 'battle_mage', 'artillery_mage'].includes(archetype)
  ) {
    magicShare = 0.9 * (1 - trueShare);
  } else if (['vanguard', 'warden', 'catcher'].includes(archetype)) {
    magicShare = (magicSpellCount >= physSpellCount ? 0.72 : 0.35) * (1 - trueShare);
  } else if (['crit_marksman', 'caster_marksman', 'ad_assassin'].includes(archetype)) {
    magicShare = 0.08 * (1 - trueShare);
  } else if (archetype === 'onhit_marksman') {
    magicShare = 0.24 * (1 - trueShare);
  } else {
    // Fighter/Diver/Juggernaut/Skirmisher
    magicShare = (champ.info.magic >= 7 && magicSpellCount >= 2 ? 0.75 : 0.14) * (1 - trueShare);
  }
  const physicalShare = Math.max(0, 1 - magicShare - trueShare);

  // Base tactical ratings by archetype + actual spell telemetry + explicit overrides
  const hardCC = clamp10(
    hardSpellCount * 2.4 + (['vanguard', 'warden', 'catcher'].includes(archetype) ? 2.5 : 0),
  );
  const softCC = clamp10(softSpellCount * 2.2 + (hardSpellCount > 0 ? 1.5 : 0));

  const baseEngage =
    archetype === 'vanguard'
      ? 7.5
      : archetype === 'diver'
        ? 5.5
        : archetype === 'catcher'
          ? 5.0
          : 2.0;
  const engage = clamp10(baseEngage + (dashSpellCount > 0 && hardSpellCount > 0 ? 1.5 : 0) + (override.engageBonus || 0));

  const baseDisengage =
    archetype === 'enchanter' || archetype === 'warden'
      ? 6.0
      : archetype === 'battle_mage' || archetype === 'catcher'
        ? 4.5
        : 2.0;
  const disengage = clamp10(baseDisengage + (hardSpellCount >= 2 ? 1.2 : 0) + (override.disengageBonus || 0));

  const basePeel =
    archetype === 'enchanter' || archetype === 'warden'
      ? 6.8
      : archetype === 'catcher' || archetype === 'vanguard'
        ? 5.0
        : 1.5;
  const peel = clamp10(basePeel + healShieldCount * 1.1 + (override.peelBonus || 0));

  const basePoke =
    archetype === 'artillery_mage'
      ? 8.5
      : archetype === 'caster_marksman'
        ? 5.0
        : archetype === 'enchanter'
          ? 3.2
          : isRanged
            ? 3.8
            : 1.5;
  const poke = clamp10(basePoke + (maxSpellRange >= 1000 ? 1.5 : 0) + (override.pokeBonus || 0));

  const baseBurst =
    archetype === 'ad_assassin' || archetype === 'ap_assassin' || archetype === 'burst_mage'
      ? 8.2
      : archetype === 'artillery_mage' || archetype === 'caster_marksman' || archetype === 'diver'
        ? 5.8
        : ['enchanter', 'vanguard', 'warden'].includes(archetype)
          ? 2.0
          : 3.2;
  const burst = clamp10(baseBurst + (override.burstBonus || 0));

  const sustainedDps = clamp10(
    ['crit_marksman', 'onhit_marksman', 'skirmisher', 'battle_mage'].includes(archetype)
      ? 8.8
      : ['juggernaut', 'caster_marksman', 'diver'].includes(archetype)
        ? 6.2
        : 2.8,
  );

  const sustainHealShield = clamp10(
    archetype === 'enchanter'
      ? 8.5
      : healShieldCount * 2.5 + (['juggernaut', 'diver', 'warden'].includes(archetype) ? 2.5 : 0.5),
  );

  const tankiness = clamp10(
    ['vanguard', 'warden'].includes(archetype)
      ? 8.8
      : archetype === 'juggernaut'
        ? 7.5
        : archetype === 'diver'
          ? 5.8
          : champ.info.defense * 0.65,
  );

  const mobility = clamp10(
    dashSpellCount * 2.6 +
      (['ad_assassin', 'ap_assassin', 'skirmisher', 'diver'].includes(archetype) ? 3.2 : 1.0),
  );

  const pickoff = clamp10(
    (['catcher', 'ad_assassin', 'ap_assassin'].includes(archetype) ? 6.8 : 3.0) +
      hardSpellCount * 0.9 +
      (override.pickoffBonus || 0),
  );

  const scalingLate = clamp10(
    (['crit_marksman', 'onhit_marksman', 'battle_mage', 'skirmisher'].includes(archetype)
      ? 7.5
      : ['enchanter', 'vanguard', 'burst_mage'].includes(archetype)
        ? 6.2
        : 5.0) + (override.scalingLateBonus || 0),
  );

  const siege = clamp10(
    (champ.stats?.attackrange >= 600 ? 8.5 : isRanged ? 5.8 : 2.0) +
      (archetype === 'artillery_mage' ? 2.5 : 0),
  );

  const antiTank = clamp10(
    (['onhit_marksman', 'battle_mage', 'skirmisher'].includes(archetype)
      ? 7.2
      : archetype === 'crit_marksman' || archetype === 'juggernaut'
        ? 6.0
        : 2.5) +
      trueShare * 10 +
      (override.antiTankBonus || 0),
  );

  // Build scaling affinities based on archetype + role + resource
  const affinities = computeAffinities(champ, archetype, effectiveRole, usesMana, magicShare, override);

  return {
    champion: champ,
    primaryRoles,
    archetype,
    archetypeLabel: ARCHETYPE_LABELS[archetype],
    isRanged,
    usesMana,
    damageMix: {
      physical: Math.round(physicalShare * 100) / 100,
      magic: Math.round(magicShare * 100) / 100,
      trueDamage: Math.round(trueShare * 100) / 100,
    },
    ratings: {
      hardCC,
      softCC,
      engage,
      disengage,
      peel,
      poke,
      burst,
      sustainedDps,
      sustainHealShield,
      tankiness,
      mobility,
      pickoff,
      scalingLate,
      siege,
      antiTank,
    },
    affinities,
  };
}

function computeAffinities(
  champ: ChampionData,
  archetype: CombatArchetype,
  role: Role,
  usesMana: boolean,
  magicShare: number,
  override: ExplicitChampionOverride,
): ChampionScalingAffinities {
  const base: ChampionScalingAffinities = {
    ap: 0,
    ad: 0,
    crit: 0,
    attackSpeed: 0,
    onHit: 0,
    lethality: 0,
    magicPen: 0,
    armorPen: 0,
    healShield: 0,
    abilityHaste: 0.8,
    mana: usesMana ? 0.5 : -10,
    tearUser: Boolean(override.tearUser),
    spellbladeUser: Boolean(override.spellbladeUser),
    health: 0.4,
    armor: 0.3,
    magicResist: 0.3,
    lifeStealOmnivamp: 0.2,
  };

  if (role === 'SUPPORT' && (archetype === 'enchanter' || champ.spells.some((s) => s.hasHeal || s.hasShield))) {
    base.healShield = 3.4;
    base.abilityHaste = 2.4;
    base.mana = usesMana ? 2.2 : -10;
    base.ap = 1.1;
    base.health = 0.9;
    return base;
  }

  if (role === 'SUPPORT' && ['vanguard', 'warden', 'catcher'].includes(archetype)) {
    base.health = 2.5;
    base.armor = 2.4;
    base.magicResist = 2.2;
    base.abilityHaste = 2.0;
    base.healShield = 0.8;
    return base;
  }

  switch (archetype) {
    case 'enchanter':
      base.healShield = 3.2;
      base.abilityHaste = 2.4;
      base.ap = 1.3;
      base.mana = usesMana ? 2.0 : -10;
      break;
    case 'vanguard':
    case 'warden':
      base.health = 2.8;
      base.armor = 2.6;
      base.magicResist = 2.5;
      base.abilityHaste = 1.6;
      break;
    case 'juggernaut':
    case 'diver':
      if (magicShare >= 0.65) {
        base.ap = 2.4;
        base.health = 2.2;
        base.abilityHaste = 1.8;
      } else {
        base.ad = 2.5;
        base.health = 2.2;
        base.abilityHaste = 1.8;
        base.armor = 1.1;
        base.magicResist = 1.0;
        base.armorPen = 1.0;
        if (champ.id === 'Garen') {
          base.attackSpeed = 1.8;
          base.crit = 0.9;
        }
      }
      break;
    case 'skirmisher':
      if (magicShare >= 0.65) {
        base.ap = 2.8;
        base.attackSpeed = champ.id === 'Gwen' ? 1.6 : 0.4;
        base.health = 1.4;
        base.abilityHaste = 1.6;
      } else if (['Yasuo', 'Yone', 'Tryndamere'].includes(champ.id)) {
        base.ad = 2.5;
        base.crit = 3.2;
        base.attackSpeed = 2.4;
        base.lifeStealOmnivamp = 1.8;
      } else {
        base.ad = 2.4;
        base.attackSpeed = 2.6;
        base.onHit = 2.8;
        base.lifeStealOmnivamp = 1.6;
        base.armorPen = 1.2;
      }
      break;
    case 'ad_assassin':
      base.ad = 2.8;
      base.lethality = 3.2;
      base.armorPen = 2.4;
      base.abilityHaste = 2.0;
      break;
    case 'ap_assassin':
      base.ap = 3.1;
      base.magicPen = 2.8;
      base.abilityHaste = 1.8;
      base.health = 0.8;
      break;
    case 'burst_mage':
    case 'artillery_mage':
      base.ap = 3.2;
      base.magicPen = 2.7;
      base.abilityHaste = 2.0;
      base.mana = usesMana ? 1.8 : -10;
      break;
    case 'battle_mage':
      base.ap = 3.0;
      base.abilityHaste = 2.3;
      base.health = 1.5;
      base.mana = usesMana ? 2.2 : -10;
      base.magicPen = 1.9;
      break;
    case 'crit_marksman':
      base.ad = 2.8;
      base.crit = 3.2;
      base.attackSpeed = 2.3;
      base.armorPen = 1.8;
      base.lifeStealOmnivamp = 1.4;
      break;
    case 'onhit_marksman':
      base.attackSpeed = 3.0;
      base.onHit = 3.1;
      base.ad = 2.2;
      base.ap = magicShare >= 0.35 ? 1.2 : 0;
      base.lifeStealOmnivamp = 1.4;
      break;
    case 'caster_marksman':
      base.ad = 3.0;
      base.crit = ['Ezreal', 'Jayce', 'Senna'].includes(champ.id) ? 0.5 : 2.5;
      base.abilityHaste = 2.0;
      base.lethality = ['Jhin', 'MissFortune', 'Varus', 'Jayce', 'Senna'].includes(champ.id) ? 1.8 : 0.4;
      base.armorPen = 1.9;
      break;
    default:
      if (magicShare >= 0.55) {
        base.ap = 2.6;
        base.abilityHaste = 1.8;
      } else {
        base.ad = 2.5;
        base.abilityHaste = 1.8;
      }
      break;
  }

  return base;
}
