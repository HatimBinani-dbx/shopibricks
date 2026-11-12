import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const out=new URL('./artifacts/lemrock-research/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
try{
 await page.goto('https://www.lemrock.com/',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(1500);
 for(let y=0;y<await page.evaluate(()=>document.body.scrollHeight);y+=800){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(180);}
 await page.screenshot({path:new URL('homepage.png',out).pathname,fullPage:true});
 const data=await page.evaluate(()=>({text:document.body.innerText,images:[...document.images].filter(i=>!i.src.startsWith('data:')).map(i=>({src:i.src,alt:i.alt})),videos:[...document.querySelectorAll('video')].map(v=>({src:v.currentSrc,poster:v.poster})),links:[...document.links].map(a=>({text:a.textContent,url:a.href})),canvases:document.querySelectorAll('canvas').length}));
 await writeFile(new URL('page.json',out),JSON.stringify(data,null,2));
 console.log(JSON.stringify({text:data.text.slice(0,18000),videos:data.videos,canvases:data.canvases,images:[...new Set(data.images.map(i=>i.src))].slice(-18)}));
 const science=page.getByText('Millions of real agentic conversations',{exact:true}).first();
 if(await science.count()){await science.scrollIntoViewIfNeeded();await page.waitForTimeout(500);await page.screenshot({path:new URL('clustering-section.png',out).pathname});}
}finally{await browser.close();}
