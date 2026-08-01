export type LibraryModuleAddress={plugin:string;model:string;key:string;url:string};

const entityMap:Record<string,string>={amp:"&",quot:'"',apos:"'",lt:"<",gt:">",nbsp:" "};
const decode=(value:string)=>value.replace(/&(#x?[0-9a-f]+|\w+);/gi,(_,entity:string)=>entity[0]==="#"?String.fromCodePoint(Number.parseInt(entity.slice(entity[1]?.toLowerCase()==="x"?2:1),entity[1]?.toLowerCase()==="x"?16:10)):entityMap[entity]??`&${entity};`);
const meta=(html:string,name:string)=>decode(html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`,"i"))?.[1]??"");

export function parseLibraryModuleUrl(requested:string):LibraryModuleAddress{
  const url=new URL(requested);
  if(url.protocol!=="https:"||url.hostname!=="library.vcvrack.com"||url.username||url.password||url.port||url.search||url.hash)throw new Error("Only exact official VCV Library HTTPS module URLs are accepted");
  const parts=url.pathname.split("/").filter(Boolean);
  if(parts.length!==2||parts.some(part=>!/^[A-Za-z0-9_-]+$/.test(part)))throw new Error("Expected a module URL like /Plugin/Model");
  const [plugin,model]=parts;
  return {plugin,model,key:`${plugin}/${model}`,url:`https://library.vcvrack.com/${plugin}/${model}`};
}

function safeHttpsLink(value:string|undefined){if(!value)return undefined;try{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password?url.href:undefined}catch{return undefined}}

export function parseLibraryModuleHtml(html:string,plugin:string,model:string,fallbackVersion?:string){
  const links=[...html.matchAll(/<a[^>]+href=["'](https:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(match=>({url:safeHttpsLink(decode(match[1])),text:decode(match[2].replace(/<[^>]*>/g,"").trim())})).filter((link):link is {url:string;text:string}=>Boolean(link.url));
  const source=links.find(link=>/source code/i.test(link.text))?.url??links.find(link=>/github\.com/i.test(link.url))?.url;
  const license=decode(html.match(/License:\s*<a[^>]*>([^<]+)</i)?.[1]?.trim()??"")||undefined;
  const version=html.match(/title=["']Current version distributed[^"']*["'][^>]*>([0-9]+\.[0-9]+\.[0-9]+)<\/span>/i)?.[1]??fallbackVersion;
  return {title:meta(html,"og:title")||`${plugin} ${model}`,description:meta(html,"description"),screenshotUrl:safeHttpsLink(meta(html,"og:image"))??"",sourceUrl:source,license,version};
}
