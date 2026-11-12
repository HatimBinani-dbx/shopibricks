import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
export type GatewayOutput = { output?: Array<Record<string, unknown>>; output_text?: string; usage?: Record<string, unknown>; [key: string]: unknown };
type Request = { body:Record<string,unknown>; signal?:AbortSignal; delta?:(text:string)=>void; resolve:(v:GatewayOutput)=>void; reject:(e:Error)=>void; timeout?:NodeJS.Timeout; abort?:()=>void };
type Worker = {child:ChildProcessWithoutNullStreams;request?:Request;stderr:string;dead:boolean};
const workers:Worker[]=[];const waiting:Request[]=[];
function finish(worker:Worker,result?:GatewayOutput,error?:Error){const request=worker.request;worker.request=undefined;if(request){clearTimeout(request.timeout);if(request.abort)request.signal?.removeEventListener('abort',request.abort);if(error)request.reject(error);else request.resolve(result!);}queueMicrotask(dispatch);}
function createWorker():Worker{
 const python=process.env.SHOPIBRICKS_PYTHON||(existsSync('.venv/bin/python')?path.resolve('.venv/bin/python'):'python3');
 const child=spawn(python,['server/gateway_worker.py'],{stdio:['pipe','pipe','pipe'],env:process.env});const worker:Worker={child,stderr:'',dead:false};workers.push(worker);
 child.stderr.on('data',chunk=>{worker.stderr=(worker.stderr+String(chunk)).slice(-1000);});
 readline.createInterface({input:child.stdout}).on('line',line=>{try{const message=JSON.parse(line);if(message.type==='delta')worker.request?.delta?.(message.delta);else if(message.type==='completed')finish(worker,message.response);else if(message.type==='error')finish(worker,undefined,new Error(message.error?.message||JSON.stringify(message.error)));else if(message.type==='diagnostic'&&message.source==='mlflow'){const safe=Object.fromEntries(['status','trace_id','exception_class','http_status','host','path','port'].filter(key=>message[key]!==undefined).map(key=>[key,message[key]]));console.warn('MLflow trace diagnostic',JSON.stringify(safe));}}catch{/* Ignore nonprotocol SDK diagnostics. */}});
 child.on('error',error=>{worker.dead=true;finish(worker,undefined,error);});
 child.on('close',()=>{worker.dead=true;if(worker.request)finish(worker,undefined,new Error(worker.stderr.includes('ModuleNotFoundError')?'Gateway Python dependencies are missing.':'Gateway worker stopped.'));});
 return worker;
}
function dispatch(){
 while(waiting.length){let worker=workers.find(w=>!w.dead&&!w.request);if(!worker){if(workers.filter(w=>!w.dead).length>=4)return;worker=createWorker();}
 const request=waiting.shift()!;if(request.signal?.aborted){request.reject(new Error('Run canceled'));continue;}
 worker.request=request;const selected=worker;
 request.abort=()=>{selected.dead=true;selected.child.kill('SIGTERM');finish(selected,undefined,new Error('Run canceled'));};
 request.signal?.addEventListener('abort',request.abort,{once:true});
 request.timeout=setTimeout(()=>{selected.dead=true;selected.child.kill('SIGTERM');finish(selected,undefined,new Error('Gateway request timed out'));},100000);
 selected.child.stdin.write(JSON.stringify(request.body)+'\n');
 }
}
export function gateway(body:Record<string,unknown>,signal?:AbortSignal,delta?:(text:string)=>void):Promise<GatewayOutput>{return new Promise((resolve,reject)=>{waiting.push({body,signal,delta,resolve,reject});dispatch();});}
export function stopGateway(){for(const worker of workers)worker.child.kill('SIGTERM');}
process.on('exit',stopGateway);
