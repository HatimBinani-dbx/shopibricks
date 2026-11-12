export function TechBrands({compact=false}:{compact?:boolean}){
 return <div className={`tech-brands ${compact?'compact':''}`} aria-label="Built with Databricks and OpenAI"><img src="/brand/databricks.svg" alt="Databricks"/><span className="brand-cross" aria-hidden="true">×</span><img src="/brand/openai-wordmark.svg" alt="OpenAI"/></div>;
}
export function OpenAIMark({white=false}:{white?:boolean}){
 return <img className="openai-mark" src={`/brand/openai-blossom${white?'-white':''}.svg`} alt="OpenAI"/>;
}
