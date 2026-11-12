import { existsSync } from 'node:fs';
if(existsSync('.env'))process.loadEnvFile('.env');
const {gateway,stopGateway}=await import('./gateway.js');
const result=await gateway({model:process.env.SHOPIBRICKS_MODEL,input:[{role:'user',content:'Reply exactly: ShopiBricks gateway is ready.'}],max_output_tokens:128});
console.log(JSON.stringify({model:process.env.SHOPIBRICKS_MODEL,output:result.output,usage:result.usage},null,2));
stopGateway();
