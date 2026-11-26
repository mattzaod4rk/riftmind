import type { DraftTeamSlots, Role } from './types.ts';

/**
 * Composições de DEMONSTRAÇÃO. Nunca são usadas como estado inicial do aplicativo:
 * só são carregadas quando o usuário escolhe explicitamente "Carregar cenário".
 */
export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  allyTeam: DraftTeamSlots;
  enemyTeam: DraftTeamSlots;
  userRole: Role;
  userChampionId: string;
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'nami_classic',
    name: 'Suporte encantador contra dive e cerco',
    description: 'Nami precisa proteger uma retaguarda imóvel contra Zed, com Ornn na linha de frente e poke de Caitlyn e Lux.',
    allyTeam: { TOP: 'Garen', JUNGLE: 'MasterYi', MID: 'Cassiopeia', ADC: 'Jhin', SUPPORT: 'Nami' },
    enemyTeam: { TOP: 'Ornn', JUNGLE: 'Ivern', MID: 'Zed', ADC: 'Caitlyn', SUPPORT: 'Lux' },
    userRole: 'SUPPORT',
    userChampionId: 'Nami',
  },
  {
    id: 'jinx_protect',
    name: 'Hipercarregador contra duplo assassino',
    description: 'Jinx com proteção de Lulu e Shen contra Kha’Zix, Akali e o engage de Nautilus.',
    allyTeam: { TOP: 'Shen', JUNGLE: 'Sejuani', MID: 'Orianna', ADC: 'Jinx', SUPPORT: 'Lulu' },
    enemyTeam: { TOP: 'Renekton', JUNGLE: 'Khazix', MID: 'Akali', ADC: 'Lucian', SUPPORT: 'Nautilus' },
    userRole: 'ADC',
    userChampionId: 'Jinx',
  },
  {
    id: 'sustain_drain',
    name: 'Mago de controle contra muita cura',
    description: 'Viktor diante de Soraka, Vladimir, Aatrox e Briar: teste de Feridas Dolorosas e lutas prolongadas.',
    allyTeam: { TOP: 'Ornn', JUNGLE: 'JarvanIV', MID: 'Viktor', ADC: 'Ashe', SUPPORT: 'Braum' },
    enemyTeam: { TOP: 'Aatrox', JUNGLE: 'Briar', MID: 'Vladimir', ADC: 'Samira', SUPPORT: 'Soraka' },
    userRole: 'MID',
    userChampionId: 'Viktor',
  },
  {
    id: 'full_ad_trap',
    name: 'Equipe de dano físico contra tanques',
    description: 'Composição quase toda física contra Malphite, Rammus e Leona: alerta de distribuição de dano.',
    allyTeam: { TOP: 'Darius', JUNGLE: 'LeeSin', MID: 'Zed', ADC: 'Caitlyn', SUPPORT: 'Pyke' },
    enemyTeam: { TOP: 'Malphite', JUNGLE: 'Rammus', MID: 'Galio', ADC: 'Ezreal', SUPPORT: 'Leona' },
    userRole: 'ADC',
    userChampionId: 'Caitlyn',
  },
];
