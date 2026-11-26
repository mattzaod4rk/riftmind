import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getAllChampionsFromDb,
  getAllItemsFromDb,
  getAllRunesFromDb,
  getAllSummonersFromDb,
} from '../server/db.ts';
import { syncDataDragon } from '../server/ddragonSync.ts';
import { buildGovernanceReport } from '../server/index.ts';
import { getOfficialStatShards } from '../shared/ddragonParser.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.resolve(__dirname, '..', 'public', 'data', 'bootstrap-static.json');

(async () => {
  let champions = getAllChampionsFromDb();
  if (champions.length < 160) {
    console.log('[RiftMind] Sincronizando Data Dragon para gerar snapshot estático...');
    await syncDataDragon({ force: false });
    champions = getAllChampionsFromDb();
  }

  const payload = {
    governance: buildGovernanceReport(),
    champions,
    items: getAllItemsFromDb(true),
    runeTrees: getAllRunesFromDb(),
    statShards: getOfficialStatShards(),
    summoners: getAllSummonersFromDb(),
    championPool: [],
    preferences: {
      preferredRoles: [],
      autoCheckPatch: true,
      knownClientPatch: '',
    },
    draftHistory: [],
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload));
  console.log(`[RiftMind] Snapshot estático exportado em ${OUT_FILE} (${champions.length} campeões).`);
})();
