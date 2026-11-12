import { existsSync } from 'node:fs';
if(existsSync('.env'))process.loadEnvFile('.env');
const { initialize,getPool }=await import('./db.js');
await initialize(); console.log('ShopiBricks Lakebase schema and product catalog are ready.');await getPool().end();
