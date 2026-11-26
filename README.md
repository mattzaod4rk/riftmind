# RiftMind — Analista Pessoal de Draft, Builds e Estratégia para League of Legends

Aplicação web local (`127.0.0.1`), 100% independente do cliente do League of Legends e compatível com o **Riot Vanguard**, construída para estudar e analisar composições completas **5x5**, recomendar builds justificadas, itens situacionais, páginas de runas, confrontos e estratégias por função com base nos dados estáticos oficiais do **Riot Data Dragon (`pt_BR`)**.

---

## Garantias de Arquitetura Isolada (Compatibilidade Total com Riot Vanguard)

- **Execução estritamente local:** `127.0.0.1` (localhost).
- **Zero integração com o jogo:** Não exige Riot Client nem League of Legends abertos, não usa LCU API, não usa Live Client Data API (`2999`), não lê memória, processos, registro do Windows ou pastas do jogo, não faz OCR e não cria overlays.
- **Banco de dados próprio offline:** SQLite nativo (`data/riftmind.sqlite`) + cache local de ícones oficiais em `data/assets/`. Após a sincronização inicial com o Riot Data Dragon, toda a análise funciona **100% offline**.
- **Transparência total:** A aba **Configurações & Dados** exibe um monitor auditável com todas as conexões HTTP externas efetuadas pelo aplicativo.

---

## Pré-requisitos

- **Node.js 22.5+ ou 24+** (testado em Node.js `v24.13.0`, utilizando `node:sqlite` nativo sem dependências C++ externas).

---

## Como Executar Localmente

Abra um terminal na pasta do projeto:

```powershell
cd C:\Users\mathe\.gemini\antigravity\scratch\riftmind
```

### 1. Instalar dependências (já instaladas)
```powershell
npm install
```

### 2. Sincronizar / atualizar dados oficiais do Riot Data Dragon (`pt_BR`)
```powershell
npm run sync
```

### 3. Executar em Modo de Desenvolvimento (API + Interface Vite com Hot Reload)
```powershell
npm run dev
```
Acesse no navegador: **http://127.0.0.1:5173**

### 4. Executar em Modo de Produção (Servidor Único Consolidado)
```powershell
npm run build
npm run start:prod
```
Acesse no navegador: **http://127.0.0.1:3847**

### 5. Executar a Suíte de Testes Automatizados
```powershell
npm test
```

---

## Estrutura Modular do Projeto

- `server/db.ts` — Camada SQLite local (`champions`, `items`, `runes`, `summoners`, `champion_pool`, `draft_history`, `external_stat_snapshots`, `network_logs`).
- `server/ddragonSync.ts` — Sincronização oficial com `ddragon.leagueoflegends.com` (`pt_BR`), download paralelo dos 173 arquivos individuais de campeões e cache local offline de ícones.
- `server/index.ts` — Servidor HTTP Express isolado em `127.0.0.1:3847`.
- `shared/ddragonParser.ts` — Parser de HTML/atributos do Data Dragon, validação estrita para Summoner's Rift (Mapa 11) e mapeamento de grupos de passivas únicas.
- `shared/engine/championProfiler.ts` — Perfilamento tático híbrido de todos os 173 campeões em 15 dimensões + afinidades de escalamento.
- `shared/engine/compositionEngine.ts` — Motor de análise de composição 5x5 em 20 indicadores comparativos, distribuição de dano (AD/AP/Verdadeiro) e condições de vitória.
- `shared/engine/buildEngine.ts` — Motor contextual de recomendação de builds (9 etapas, árvore de componentes, itens situacionais, exclusividade de passivas únicas e recálculo em tempo real por minuto/ouro).
- `shared/engine/runeEngine.ts` — Motor contextual de páginas de runas, fragmentos de atributos e feitiços de invocador com página alternativa comparativa.
- `shared/engine/matchupAndStrategyEngine.ts` — Análise dos 5 adversários com habilidades reais perigosas, sinergias aliadas e guia estratégico personalizado por posição.
- `src/` — Interface React 19 + TypeScript + Tailwind CSS em tema escuro com as 8 páginas completas em português brasileiro.
- `tests/riftmind.test.ts` — Suíte automatizada de testes Vitest.
