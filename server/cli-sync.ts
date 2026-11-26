import { syncDataDragon } from './ddragonSync.ts';

(async () => {
  console.log('[RiftMind] Iniciando sincronização oficial com Riot Data Dragon (pt_BR)...');
  const report = await syncDataDragon({ force: process.argv.includes('--force') });
  console.log('[RiftMind] Sincronização concluída:', report);
})();
