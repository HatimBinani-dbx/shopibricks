/** Read-only HTTP protocol smoke for dependency upgrades. No cloud calls or state changes. */
import assert from 'node:assert/strict';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import { commerceMcp } from './mcp.js';
const app=express();app.use(express.json());
app.post('/mcp',async(req,res,next)=>{
 const server=commerceMcp();const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
 res.on('close',()=>{void transport.close();void server.close();});
 try{await server.connect(transport);await transport.handleRequest(req,res,req.body);}catch(error){next(error);}
});
const listener=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});
try{
 const address=listener.address();assert.ok(address&&typeof address==='object');
 const rpc=async(method:string,params:unknown={})=>{const response=await fetch(`http://127.0.0.1:${address.port}/mcp`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:method,method,params})});assert.equal(response.status,200);const body=await response.json();assert.equal(body.error,undefined);return body.result;};
 const initialization=await rpc('initialize',{protocolVersion:LATEST_PROTOCOL_VERSION,capabilities:{},clientInfo:{name:'shopibricks-dependency-check',version:'1.0.0'}});
 assert.equal(initialization.serverInfo.name,'shopibricks-commerce');
 const discovery=await rpc('tools/list');
 assert.equal(discovery.tools.length,5);
 for(const tool of discovery.tools){assert.equal(tool.inputSchema.type,'object');assert.equal(tool.annotations.readOnlyHint,true);}
 const quote=discovery.tools.find((tool:{name:string})=>tool.name==='quote_cart');assert.equal(quote.inputSchema.properties.items.minItems,1);assert.equal(quote.inputSchema.properties.items.items.properties.quantity.minimum,1);
 console.log(JSON.stringify({passed:true,transport:'Streamable HTTP',protocol:initialization.protocolVersion,tools:discovery.tools.map((tool:{name:string})=>tool.name)}));
}finally{await new Promise<void>((resolve,reject)=>listener.close(error=>error?reject(error):resolve()));}
