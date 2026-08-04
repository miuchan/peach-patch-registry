#!/usr/bin/env node
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {browserTemporalDeckAdapterSource} from "./temporal-deck-browser-adapter.mjs";
import {browserTdScopeAdapterSource} from "./td-scope-browser-adapter.mjs";
import {browserLomasAdvancedSamplerAdapterSource} from "./lomas-advanced-sampler-browser-adapter.mjs";

const projectDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
let activeSourceTool=null;
let developmentSourceTool=null;
let activeTypeAliasesByFile=null;
let activeTypeDeclarationsByFile=null;
let activeEnumDeclarationsByFile=null;
let activeNamespaceConstantDeclarationsByFile=null;
let activeNamespaceVariableDeclarationsByFile=null;
let activeNamespaceUsingDeclarationsByFile=null;
let activeNamespaceUsingDirectivesByFile=null;
let activeIncludeDirectivesByFile=null;
let activeOutOfLineDefinitionsByFile=null;
let activeFreeFunctionDeclarationsByFile=null;
let activeFreeFunctionDefinitionsByFile=null;
const sourceInventoryCache=new Map;
const dependencyFileInventoryCache=new Map;
const makefileAnalysisCache=new Map;
const cmakeAnalysisCache=new Map;
const modelCandidateCache=new Map;
const dependencyClosureCache=new Map;
const sourceDeclarationCache=new Map;
const inlineMemberDefinitionCache=new Map;

function fail(message){throw new Error(message)}
function inlineSiblingImplementations(body,className,implementations){
  let result=stripUiClassMembers(body),inline=[];
  const escapedClass=className.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  for(const definition of implementations){
    const method=new RegExp(`\\b${escapedClass}::(~?[A-Za-z_]\\w*)\\s*\\(`).exec(definition)?.[1];
    if(!method)continue;
    const escapedMethod=method.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    result=result.replace(new RegExp(`^[ \\t]*[^;{}\\n]*\\b${escapedMethod}\\s*\\([^;{}]*\\)\\s*(?:const\\s*)?(?:override\\s*)?;[ \\t]*`,"gm"),"");
    inline.push(definition.replace(new RegExp(`\\b${escapedClass}::${escapedMethod}\\b`),method));
  }
  return`${result}\n${inline.length?"public:\n":""}${inline.join("\n\n")}`;
}
function referencedSiblingModuleDefinitions(sourceFiles,targetBody,excludedNames=new Set){
  const sources=sourceFiles.map(file=>({file,source:fs.readFileSync(file,"utf8")})),found=[];
  for(const {source} of sources)for(const declaration of rustSourceDeclarations(source).typeDeclarations){
    const {name}=declaration,reference=new RegExp(`(?:\\b${name}\\s*\\*|\\b${name}::)`),header=source.slice(declaration.declarationStart,declaration.bodyStart),body=rustTypeBody(source,declaration),base=declaration.bases[0],baseName=baseTypeName(base);
    if(excludedNames.has(name)||/(?:Widget|Display)$/.test(name)||rackUiPattern.test(header)||!reference.test(targetBody))continue;
    if(body===null||!base||(!rackModuleBase(base)&&!/Module|Expander/i.test(baseName)))continue;
    const implementations=sources.flatMap(candidate=>rawOutOfLineDefinitions(candidate.file,candidate.source,name)).filter(value=>!/\b(?:draw|drawLayer)\s*\([^;{}]*\b(?:widget::Widget::)?DrawArgs\b/.test(value));
    found.push({name,base:rackModuleBase(base)?"Module":base,body:inlineSiblingImplementations(body,name,implementations)});
  }
  const unique=new Map(found.map(item=>[item.name,item]));return [...unique.values()];
}
function expanderSiblingModuleDefinitions(sourceFiles,models=[],excludedNames=new Set){
  // A model identity is enough to connect Rack's message-buffer transport.
  // Concrete neighbor DSP is included separately only when the target body
  // actually names that type through referencedSiblingModuleDefinitions().
  void sourceFiles;void models;void excludedNames;
  return [];
}
function args(argv){const result={};for(let index=0;index<argv.length;index++){const value=argv[index];if(value.startsWith("--")){const key=value.slice(2);result[key]=argv[index+1]&&!argv[index+1].startsWith("--")?argv[++index]:true}else if(!result.url)result.url=value}return result}
function wasiImports(holder){
  const memory=()=>holder.exports?.memory,view=()=>memory()?new DataView(memory().buffer):null,unsupported=()=>-52,missing=()=>-2;
  return {
    env:{emscripten_notify_memory_growth(){},_emscripten_system:unsupported,getnameinfo:unsupported,getaddrinfo:unsupported,__syscall_faccessat:missing,__syscall_fchmod:unsupported,__syscall_chmod:unsupported,__syscall_fchown32:unsupported,__syscall_ftruncate64:unsupported,__syscall_getdents64:missing,__syscall_getcwd(buffer,size){const bytes=memory()?new Uint8Array(memory().buffer):null;if(!bytes||size<2)return-34;bytes[buffer]=47;bytes[buffer+1]=0;return 2},__syscall_readlinkat:missing,__syscall_rmdir:missing,__syscall_unlinkat:missing,__syscall_utimensat:unsupported,__syscall_bind:unsupported,__syscall_connect:unsupported,_emscripten_lookup_name:unsupported,__syscall_getsockname:unsupported,__syscall_recvfrom:unsupported,__syscall_sendto:unsupported,__syscall_setsockopt:unsupported,__syscall_shutdown:unsupported,__syscall_socket:unsupported},
    wasi_snapshot_preview1:{
      proc_exit(){},
      fd_write(_fd,iovecs,iovecCount,written){const data=view();if(!data)return 0;let bytes=0;for(let index=0;index<iovecCount;index++)bytes+=data.getUint32(iovecs+index*8+4,true);data.setUint32(written,bytes,true);return 0},
      fd_read(_fd,_iovecs,_iovecCount,read){view()?.setUint32(read,0,true);return 0},
      fd_sync(){return 0},
      fd_seek(_fd,_offset,_whence,newOffset){view()?.setBigUint64(newOffset,0n,true);return 0},
      fd_fdstat_get(_fd,status){const bytes=memory()?new Uint8Array(memory().buffer,status,24):null;if(bytes)bytes.fill(0);return 0},
      clock_time_get(_clockId,_precision,time){const data=view();if(!data)return 0;holder.clockNanoseconds=(holder.clockNanoseconds??1000000000n)+1000000n;data.setBigUint64(time,holder.clockNanoseconds,true);return 0},
      random_get(buffer,length){const bytes=memory()?new Uint8Array(memory().buffer,buffer,length):null;if(!bytes)return 0;let state=holder.randomState??0x9e3779b9;for(let index=0;index<length;index++){state^=state<<13;state^=state>>>17;state^=state<<5;bytes[index]=state&255}holder.randomState=state>>>0;return 0},
      environ_sizes_get(count,size){const data=view();if(data){data.setUint32(count,0,true);data.setUint32(size,0,true)}return 0},
      environ_get(){return 0},fd_close(){return 0}
    }
  }
}
function libraryUrl(value){const url=new URL(String(value||""));if(url.protocol!=="https:"||url.hostname!=="library.vcvrack.com"||url.username||url.password||url.port)fail("Expected an exact HTTPS VCV Library module URL");const parts=url.pathname.split("/").filter(Boolean);if(parts.length!==2||parts.some(part=>!/^[A-Za-z0-9_-]+$/.test(part)))fail("Library URL must contain exactly Plugin/Model slugs");return {plugin:parts[0],model:parts[1],key:parts.join("/"),url:url.href}}
const sourceHosts=new Set(["github.com","gitlab.com","codeberg.org","git.s-ol.nu"]);
function sourceRepository(value){const raw=String(value||"");if(/\/\.{1,2}(?:\/|$)|%2e/i.test(raw))fail("Source URL contains an unsafe path");const url=new URL(raw),upgradableGitHub=url.protocol==="http:"&&url.hostname==="github.com";if((url.protocol!=="https:"&&!upgradableGitHub)||url.username||url.password||url.port||url.search||url.hash||!sourceHosts.has(url.hostname))fail("Automatic source checkout requires an approved HTTPS Git host");let parts=url.pathname.replace(/\.git$/,"" ).split("/").filter(Boolean);if(url.hostname==="github.com"&&["blob","tree"].includes(parts[2])&&parts.length>=4)parts=parts.slice(0,2);if(parts.length<1||parts.length>4||parts.some(part=>!/^[A-Za-z0-9_.-]+$/.test(part)))fail("Source URL must identify a safe repository path");return `https://${url.hostname}/${parts.join("/")}.git`}
function lockedSubmoduleSource(value){
  // LuaJIT's historical canonical Git URL is plain HTTP. The same locked
  // commits are maintained in its official GitHub mirror, so preserve the
  // parent gitlink while keeping automatic checkouts on an approved HTTPS host.
  if(String(value).replace(/\/$/,"")==="http://luajit.org/git/luajit-2.0.git")
    return "https://github.com/LuaJIT/LuaJIT.git";
  return sourceRepository(value);
}
function gitValue(directory,args){try{return execFileSync("git",["-C",directory,...args],{encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim()}catch{return""}}
function recoverableCheckout(repository,commit,target){
  const parent=path.dirname(target),prefix=`${path.basename(target)}.building-`;if(!fs.existsSync(parent))return null;
  const candidates=fs.readdirSync(parent,{withFileTypes:true}).filter(entry=>entry.isDirectory()&&entry.name.startsWith(prefix)).map(entry=>{const directory=path.join(parent,entry.name),origin=gitValue(directory,["remote","get-url","origin"]),head=gitValue(directory,["rev-parse","HEAD"]),status=gitValue(directory,["status","--porcelain"]);let normalized="";try{normalized=lockedSubmoduleSource(origin)}catch{}return{directory,head,origin:normalized,status,mtime:fs.statSync(directory).mtimeMs}}).filter(candidate=>candidate.origin===repository&&candidate.head===commit&&!candidate.status).sort((left,right)=>right.mtime-left.mtime);
  return candidates[0]?.directory??null
}
function checkoutLockedRepository(repository,commit,target){
  if(fs.existsSync(target))fail(`Source cache is incomplete at ${target}`);fs.mkdirSync(path.dirname(target),{recursive:true});const recovered=recoverableCheckout(repository,commit,target),staging=recovered??`${target}.building-${process.pid}`;
  if(recovered)console.error(`Resuming locked checkout ${path.basename(target)} from ${path.basename(staging)}`);else execFileSync("git",["clone","--filter=blob:none","--no-checkout",repository,staging],{stdio:"inherit"});
  if(gitValue(staging,["rev-parse","HEAD"])!==commit)execFileSync("git",["-C",staging,"fetch","--depth","1","origin",commit],{stdio:"inherit"});
  execFileSync("git",["-C",staging,"checkout","--detach",commit],{stdio:"inherit"});
  return staging
}
function initializeSubmodules(root,depth=0,allowedPaths=null,parentPath=""){
  const modulesFile=path.join(root,".gitmodules");if(!fs.existsSync(modulesFile))return;if(depth>=4)fail(`Submodule nesting exceeds the supported depth at ${root}`);
  let declarations="";try{declarations=execFileSync("git",["config","-f",modulesFile,"--get-regexp","^submodule\\..*\\.path$"],{encoding:"utf8"}).trim()}catch(error){if(error?.status===1)return;throw error}
  for(const line of declarations.split("\n").filter(Boolean)){
    const match=/^submodule\.(.+)\.path\s+(.+)$/.exec(line);if(!match)fail(`Invalid submodule declaration in ${modulesFile}`);const [,name,relative]=match;
    if(path.isAbsolute(relative)||relative.split(/[\\/]+/).some(part=>!part||part==="."||part===".."))fail(`Unsafe submodule path ${relative}`);
    const lockedPath=[parentPath,relative].filter(Boolean).join("/");
    if(allowedPaths&&![...allowedPaths].some(candidate=>candidate===lockedPath||candidate.startsWith(`${lockedPath}/`)))continue;
    const target=path.resolve(root,relative),rootPrefix=`${path.resolve(root)}${path.sep}`;if(!target.startsWith(rootPrefix))fail(`Submodule path escapes its source checkout: ${relative}`);
    const tree=execFileSync("git",["-C",root,"ls-tree","HEAD","--",relative],{encoding:"utf8"}).trim(),commit=/^160000\s+commit\s+([0-9a-f]{40})\t/.exec(tree)?.[1];
    // Some repositories keep a stale .gitmodules entry after committing the
    // former submodule contents directly. A locked tree is already part of the
    // parent commit, so use it as vendored source instead of inventing a remote
    // revision that the parent repository does not reference.
    if(!commit){if(/^040000\s+tree\s+[0-9a-f]{40}\t/.test(tree)&&fs.existsSync(target)&&fs.statSync(target).isDirectory()&&fs.readdirSync(target).length)continue;fail(`Could not resolve the locked gitlink for ${relative}`)}
    const declared=execFileSync("git",["config","-f",modulesFile,"--get",`submodule.${name}.url`],{encoding:"utf8"}).trim(),repository=lockedSubmoduleSource(declared);
    let current="";if(fs.existsSync(path.join(target,".git")))try{current=execFileSync("git",["-C",target,"rev-parse","HEAD"],{encoding:"utf8",stdio:["ignore","pipe","ignore"]}).trim()}catch{}
    if(current){if(current!==commit)fail(`Submodule cache ${relative} differs from its locked gitlink`);initializeSubmodules(target,depth+1,allowedPaths,lockedPath);continue}
    if(fs.existsSync(target)&&fs.readdirSync(target).length)fail(`Submodule cache is incomplete at ${target}`);if(fs.existsSync(target))fs.rmdirSync(target);
    let staging;try{staging=checkoutLockedRepository(repository,commit,target)}catch(error){console.error(`Skipping unavailable locked submodule ${relative}: ${error instanceof Error?error.message:String(error)}`);continue}initializeSubmodules(staging,depth+1,allowedPaths,lockedPath);fs.renameSync(staging,target);
  }
}
const lockedFallbackDependencies=[
  {
    include:"tinyexpr.h",
    repository:"https://github.com/codeplea/tinyexpr.git",
    commit:"4a7456e2eab88b4c76053c1c4157639ccb930e2b",
  },
];
function hydrateLockedFallbackDependencies(sourceDir){
  const referencedIncludes=new Set(rustSourceIncludeNames(sourceDir)),availableFiles=files(sourceDir);
  for(const dependency of lockedFallbackDependencies){
    if(!referencedIncludes.has(dependency.include)||availableFiles.some(file=>path.basename(file)===path.basename(dependency.include)))continue;
    const target=path.join(sourceDir,".rack-web-dependencies",path.basename(dependency.repository,".git"),dependency.commit);
    if(fs.existsSync(path.join(target,".git"))){
      if(gitValue(target,["rev-parse","HEAD"])!==dependency.commit)fail(`Fallback dependency ${dependency.include} is not at its locked revision`);
      continue
    }
    if(fs.existsSync(target))fail(`Fallback dependency cache is incomplete at ${target}`);
    checkoutProductionDependency(dependency.repository,dependency.commit,target);
  }
}
function hydrateWrongPeopleLuaRuntime(sourceDir,target){
  if(target.key!=="WrongPeople/Lua")return null;
  const commit="98194db4295726069137d13b8d24fca8cbf892b6",
    root=path.join(sourceDir,".rack-web-dependencies","lua",commit);
  if(!fs.existsSync(path.join(root,".git"))){
    if(fs.existsSync(root))fail(`Lua runtime cache is incomplete at ${root}`);
    checkoutProductionDependency("https://github.com/lua/lua.git",commit,root);
  }
  if(gitValue(root,["rev-parse","HEAD"])!==commit)fail("Lua runtime cache differs from its locked revision");
  return root;
}
function lockedFallbackDependencyBundleForAdapter(sourceFiles,source){
  const referenced=new Set(rustSourceDeclarations(source).includeDirectives.map(candidate=>candidate.include)),bundles=[];
  for(const dependency of lockedFallbackDependencies){
    if(!referenced.has(dependency.include))continue;
    const repositoryName=path.basename(dependency.repository,".git"),marker=`${path.sep}.rack-web-dependencies${path.sep}${repositoryName}${path.sep}${dependency.commit}${path.sep}`,header=sourceFiles.find(file=>file.includes(marker)&&path.basename(file)===path.basename(dependency.include));
    if(!header)continue;
    const stem=header.replace(/\.(?:h|hh|hpp)$/,""),implementation=[".c",".cc",".cpp",".cxx"].map(extension=>`${stem}${extension}`).find(file=>sourceFiles.includes(file));
    bundles.push({source:`#include "${dependency.include}"`,files:[header,...(implementation?[implementation]:[])],implementationFiles:implementation?[implementation]:[]})
  }
  return bundles.reduce((bundle,next)=>mergeDependencyBundles(bundle,next),null)
}
function runRustSource(commandOptions,sourceTool=activeSourceTool,input=null){
  const localBinary=path.join(projectDir,"target","debug",process.platform==="win32"?"peach-registry.exe":"peach-registry"),resolvedTool=sourceTool===null?developmentSourceTool:sourceTool,command=resolvedTool??"cargo",
    commandArgs=resolvedTool?commandOptions:["run","--quiet","--manifest-path",path.join(projectDir,"Cargo.toml"),"--bin","peach-registry","--",...commandOptions],
    output=execFileSync(command,commandArgs,{encoding:"utf8",maxBuffer:128*1024*1024,stdio:[input===null?"ignore":"pipe","pipe","inherit"],...(input===null?{}:{input:JSON.stringify(input)})});
  if(sourceTool===null&&!developmentSourceTool&&fs.existsSync(localBinary))developmentSourceTool=localBinary;
  try{return JSON.parse(output)}catch{fail("Rust source command returned invalid JSON")}
}
function checkoutProductionDependency(repository,commit,target){
  runRustSource(["source","checkout","--repository",repository,"--commit",commit,"--target",target,"--format","json"]);
}
function prepareOfficialSource(options){
  const commandOptions=["source","prepare","--url",String(options.url),"--format","json"],sourceTool=options["source-tool"]?path.resolve(options["source-tool"]):null;
  if(options["source-cache-dir"])commandOptions.push("--source-cache",path.resolve(options["source-cache-dir"]));
  if(options["source-dir"])commandOptions.push("--source-dir",path.resolve(options["source-dir"]));
  if(options["library-index"])commandOptions.push("--library-index",path.resolve(options["library-index"]));
  activeSourceTool=sourceTool;
  return runRustSource(commandOptions,sourceTool)
}
function rustSourceInventory(root){
  const canonical=fs.realpathSync(root),cached=sourceInventoryCache.get(canonical);
  if(cached)return cached;
  const report=runRustSource(["analyze","inventory","--source-dir",canonical,"--format","json"]),prefix=`${canonical}${path.sep}`,
    validatePaths=(values,label)=>{if(!Array.isArray(values))fail(`Rust source inventory omitted ${label}`);return values.map(value=>{const resolved=path.resolve(String(value));if(resolved!==canonical&&!resolved.startsWith(prefix))fail(`Rust source inventory returned an escaping ${label} path`);return resolved})},
    inventory={sourceFiles:validatePaths(report.sourceFiles,"source file"),repositoryRoots:validatePaths(report.repositoryRoots,"repository root")};
  sourceInventoryCache.set(canonical,inventory);return inventory
}
function rustDependencyFileInventory(root,profile="dependency"){
  const canonical=fs.realpathSync(root),selected=String(profile),cacheKey=JSON.stringify([canonical,selected]),cached=dependencyFileInventoryCache.get(cacheKey);if(cached)return cached;if(!["dependency","vendor"].includes(selected))fail("Invalid Rust source file inventory profile");
  const report=runRustSource(["analyze","files","--source-dir",canonical,"--profile",selected,"--format","json"]),reportedRoot=path.resolve(String(report?.sourceRoot??"")),prefix=`${canonical}${path.sep}`,values=report?.sourceFiles;
  if(reportedRoot!==canonical||report?.profile!==selected||!Array.isArray(values)||values.length>1048576)fail("Rust dependency file inventory returned an invalid report");
  const sourceFiles=values.map(value=>path.resolve(String(value)));if(new Set(sourceFiles).size!==sourceFiles.length||sourceFiles.some(file=>!file.startsWith(prefix)||!fs.existsSync(file)||!fs.statSync(file).isFile()))fail("Rust dependency file inventory returned invalid source files");
  const result={sourceFiles};dependencyFileInventoryCache.set(cacheKey,result);return result
}
function rustMakefileAnalysis(root,makefilePath="Makefile",sourceVariables=["SOURCES"]){
  const canonical=fs.realpathSync(root),relative=String(makefilePath),variables=sourceVariables.map(String);if(!relative||relative.includes("\\")||path.isAbsolute(relative)||relative.split("/").some(part=>!part||part==="."||part==="..")||!variables.length||variables.length>64||variables.some(name=>!/^[A-Za-z_]\w*$/.test(name))||new Set(variables).size!==variables.length)fail("Invalid Makefile analysis request");const cacheKey=JSON.stringify([canonical,relative,variables]),cached=makefileAnalysisCache.get(cacheKey);if(cached)return cached;
  const command=["analyze","makefile","--source-dir",canonical,"--makefile",relative,...variables.flatMap(name=>["--source-variable",name]),"--format","json"],report=runRustSource(command),reportedRoot=path.resolve(String(report?.sourceRoot??"")),prefix=`${canonical}${path.sep}`,expected=path.resolve(canonical,...relative.split("/")),makefile=report?.makefile===null?null:path.resolve(String(report?.makefile??"")),reportedVariables=report?.sourceVariables,definitions=(values,label)=>{if(!Array.isArray(values)||values.length>65536||values.some(value=>typeof value!=="string"||/^-D[A-Za-z_]\w*(?:=[^\s#]+)?$/.test(value)===false)||new Set(values).size!==values.length)fail(`Rust Makefile analysis returned invalid ${label}`);return values.map(String)},paths=(values,label,directory)=>{if(!Array.isArray(values)||values.length>1048576)fail(`Rust Makefile analysis returned invalid ${label}`);const resolved=values.map(value=>path.resolve(String(value)));if(new Set(resolved).size!==resolved.length||resolved.some(value=>!value.startsWith(prefix)||!fs.existsSync(value)||(directory?!fs.statSync(value).isDirectory():!fs.statSync(value).isFile())))fail(`Rust Makefile analysis returned invalid ${label}`);return resolved};
  if(reportedRoot!==canonical||JSON.stringify(reportedVariables)!==JSON.stringify(variables)||(makefile===null)!==!fs.existsSync(expected)||(makefile!==null&&(makefile!==fs.realpathSync(expected)||!makefile.startsWith(prefix)||!fs.statSync(makefile).isFile())))fail("Rust Makefile analysis returned an invalid source boundary");
  const compileDefinitions=definitions(report?.compileDefinitions,"compile definitions"),allCompileDefinitions=definitions(report?.allCompileDefinitions,"all compile definitions");if(compileDefinitions.some(value=>!allCompileDefinitions.includes(value)))fail("Rust Makefile analysis returned inconsistent compile definitions");
  const result={makefile,sourceVariables:variables,compileDefinitions,allCompileDefinitions,includeDirectories:paths(report?.includeDirectories,"include directories",true),implementationSources:paths(report?.implementationSources,"implementation sources",false)};makefileAnalysisCache.set(cacheKey,result);return result
}
function rustCmakeAnalysis(root){const canonical=fs.realpathSync(root),cached=cmakeAnalysisCache.get(canonical);if(cached)return cached;const report=runRustSource(["analyze","cmake","--source-dir",canonical,"--format","json"]),reportedRoot=path.resolve(String(report?.sourceRoot??"")),cmakeLists=report?.cmakeLists===null?null:path.resolve(String(report?.cmakeLists??"")),expected=path.join(canonical,"CMakeLists.txt"),definitions=report?.compileDefinitions;if(reportedRoot!==canonical||(cmakeLists===null)!==!fs.existsSync(expected)||(cmakeLists!==null&&(cmakeLists!==fs.realpathSync(expected)||!cmakeLists.startsWith(`${canonical}${path.sep}`)||!fs.statSync(cmakeLists).isFile()))||!Array.isArray(definitions)||definitions.length>65536||definitions.some(value=>typeof value!=="string"||/^-D[A-Z][A-Z0-9_]+=[0-9]+$/.test(value)===false)||new Set(definitions).size!==definitions.length)fail("Rust CMake analysis returned an invalid report");const result={cmakeLists,compileDefinitions:definitions.map(String)};cmakeAnalysisCache.set(canonical,result);return result}
function rustSourceIncludeNames(root){const canonical=fs.realpathSync(root),report=runRustSource(["analyze","includes","--source-dir",canonical,"--format","json"]),reportedRoot=path.resolve(String(report?.sourceRoot??"")),values=report?.includes;if(reportedRoot!==canonical||!Array.isArray(values)||values.length>1048576||values.some(value=>typeof value!=="string"||!value||value.length>4096||/[\r\n<>\"]/.test(value))||new Set(values).size!==values.length)fail("Rust include inventory returned an invalid report");return values}
function rustModelCandidateStarts(root){
  const canonical=fs.realpathSync(root),cached=modelCandidateCache.get(canonical);if(cached)return cached;
  const report=runRustSource(["analyze","model-candidates","--source-dir",canonical,"--format","json"]),prefix=`${canonical}${path.sep}`,inventoryFiles=rustSourceInventory(canonical).sourceFiles,byFile=new Map(inventoryFiles.map(file=>[file,[]])),customModelCandidatesByFile=new Map(inventoryFiles.map(file=>[file,[]])),metaModuleCandidatesByFile=new Map(inventoryFiles.map(file=>[file,[]]));
  if(!Array.isArray(report.candidates))fail("Rust model analysis omitted candidates");
  for(const candidate of report.candidates){
    const file=path.resolve(String(candidate.file)),start=Number(candidate.start),factory=String(candidate.factory??""),templateSource=candidate.templateSource,callSource=candidate.callSource,templateArguments=candidate.templateArguments,callArguments=candidate.callArguments,namespace=candidate.namespace,registeredModuleType=candidate.registeredModuleType,widgetNamespace=candidate.widgetNamespace,rawContextFiles=candidate.contextFiles;
    if(!file.startsWith(prefix)||!Number.isSafeInteger(start)||start<0||!/^create[A-Za-z0-9_]*Model$/.test(factory)||typeof templateSource!=="string"||typeof callSource!=="string"||templateSource.length>1048576||callSource.length>1048576||!Array.isArray(templateArguments)||templateArguments.length<1||templateArguments.length>128||templateArguments.some(argument=>typeof argument!=="string"||!argument||argument.length>1048576)||!Array.isArray(callArguments)||callArguments.length<1||callArguments.length>128||callArguments.some(argument=>typeof argument!=="string"||!argument||argument.length>1048576)||!Array.isArray(namespace)||namespace.some(name=>!/^[A-Za-z_]\w*$/.test(String(name)))||(registeredModuleType!==null&&(typeof registeredModuleType!=="string"||!registeredModuleType||registeredModuleType.length>1048576))||!Array.isArray(widgetNamespace)||widgetNamespace.length>64||widgetNamespace.some(name=>!/^[A-Za-z_]\w*$/.test(String(name)))||!Array.isArray(rawContextFiles)||!rawContextFiles.length||rawContextFiles.length>256)fail("Rust model analysis returned an invalid candidate");
    const contextFiles=rawContextFiles.map(value=>path.resolve(String(value)));if(contextFiles[0]!==file||new Set(contextFiles).size!==contextFiles.length||contextFiles.some(value=>!value.startsWith(prefix)||!fs.existsSync(value)||!fs.statSync(value).isFile())||(templateArguments.length===2&&registeredModuleType!==templateArguments[0]))fail("Rust model analysis returned an invalid registration context");
    const source=fs.readFileSync(file,"utf8"),tail=source.slice(start);if(!tail.startsWith(factory)||!/^create[A-Za-z0-9_]*Model\s*</.test(tail))fail("Rust model candidate does not match its source file");
    const starts=byFile.get(file)??[];starts.push({index:start,templateSource,callSource,templateArguments:[...templateArguments],callArguments:[...callArguments],namespace:namespace.map(String),registeredModuleType,widgetNamespace:widgetNamespace.map(String),contextFiles,rust:true});byFile.set(file,starts)
  }
  if(!Array.isArray(report.customModelCandidates))fail("Rust model analysis omitted custom-model candidates");
  for(const candidate of report.customModelCandidates){
    const file=path.resolve(String(candidate.file)),start=Number(candidate.start),variableSlug=String(candidate.variableSlug??""),slugSource=candidate.slugSource,modelType=String(candidate.modelType??""),moduleType=String(candidate.moduleType??""),widgetClass=candidate.widgetClass,namespace=candidate.namespace;
    if(!file.startsWith(prefix)||!Number.isSafeInteger(start)||start<0||!/^[A-Za-z0-9_-]+$/.test(variableSlug)||(slugSource!==null&&(typeof slugSource!=="string"||!slugSource||slugSource.length>1048576))||!/^[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*$/.test(modelType)||!/^[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*$/.test(moduleType)||(widgetClass!==null&&(typeof widgetClass!=="string"||!/^[A-Za-z_]\w*$/.test(widgetClass)))||!Array.isArray(namespace)||namespace.length>64||namespace.some(name=>!/^[A-Za-z_]\w*$/.test(String(name))))fail("Rust model analysis returned an invalid custom-model candidate");
    const source=fs.readFileSync(file,"utf8"),tail=source.slice(start);if(!/^(?:plugin::)?Model\s*\*\s*model[A-Za-z0-9_-]+\s*=\s*\[/.test(tail))fail("Rust custom-model candidate does not match its source file");
    const candidates=customModelCandidatesByFile.get(file)??[];candidates.push({index:start,variableSlug,slugSource,modelType,moduleType,widgetClass,namespace:namespace.map(String),rust:true});customModelCandidatesByFile.set(file,candidates)
  }
  if(!Array.isArray(report.metaModuleCandidates))fail("Rust model analysis omitted MetaModule candidates");
  for(const candidate of report.metaModuleCandidates){
    const file=path.resolve(String(candidate.file)),start=Number(candidate.start),variableSlug=String(candidate.variableSlug??""),templateSource=candidate.templateSource,templateArguments=candidate.templateArguments,namespace=candidate.namespace;
    if(!file.startsWith(prefix)||!Number.isSafeInteger(start)||start<0||!/^[A-Za-z0-9_-]+$/.test(variableSlug)||typeof templateSource!=="string"||!templateSource||templateSource.length>1048576||!Array.isArray(templateArguments)||![1,2].includes(templateArguments.length)||templateArguments.some(argument=>typeof argument!=="string"||!argument||argument.length>1048576)||!Array.isArray(namespace)||namespace.length>64||namespace.some(name=>!/^[A-Za-z_]\w*$/.test(String(name))))fail("Rust model analysis returned an invalid MetaModule candidate");
    const source=fs.readFileSync(file,"utf8"),tail=source.slice(start);if(!/^GenericModule\s*</.test(tail)||JSON.stringify(templateArguments)!==JSON.stringify(splitArguments(templateSource)))fail("Rust MetaModule candidate does not match its source file");
    const candidates=metaModuleCandidatesByFile.get(file)??[];candidates.push({index:start,variableSlug,templateSource,templateArguments:[...templateArguments],namespace:namespace.map(String),rust:true});metaModuleCandidatesByFile.set(file,candidates)
  }
  if(!Array.isArray(report.includeDirectives))fail("Rust model analysis omitted include directives");
  const includeDirectivesByFile=new Map(inventoryFiles.map(file=>[file,[]]));
  for(const candidate of report.includeDirectives){
    const file=path.resolve(String(candidate?.file??""));if(!file.startsWith(prefix)||!fs.existsSync(file)||!fs.statSync(file).isFile())fail("Rust model analysis returned an invalid include directive path");
    const source=fs.readFileSync(file,"utf8"),directive=normalizedIncludeDirective(candidate,source,"model analysis",canonical),directives=includeDirectivesByFile.get(file)??[];directives.push(directive);includeDirectivesByFile.set(file,directives)
  }
  if(!Array.isArray(report.stringConstants))fail("Rust model analysis omitted string constants");
  const stringConstants={};
  for(const candidate of report.stringConstants){
    const file=path.resolve(String(candidate.file)),start=Number(candidate.start),name=String(candidate.name??""),expression=candidate.expression,value=candidate.value;
    if(!file.startsWith(prefix)||!Number.isSafeInteger(start)||start<0||!/^[A-Za-z_]\w*$/.test(name)||typeof expression!=="string"||expression.length>1048576||typeof value!=="string"||value.length>1048576)fail("Rust model analysis returned an invalid string constant");
    const source=fs.readFileSync(file,"utf8");if(!source.slice(start).startsWith(name))fail("Rust string constant does not match its source file");
    stringConstants[name]=value
  }
  if(!Array.isArray(report.typeAliases))fail("Rust model analysis omitted type aliases");
  const aliasesByFile=new Map(rustSourceInventory(canonical).sourceFiles.map(file=>[file,[]]));
  for(const candidate of report.typeAliases){
    const file=path.resolve(String(candidate.file)),start=Number(candidate.start),declarationStart=Number(candidate.declarationStart),declarationEnd=Number(candidate.declarationEnd),name=String(candidate.name??""),target=String(candidate.target??""),kind=String(candidate.kind??""),namespace=candidate.namespace,namespaceScope=candidate.namespaceScope,owners=candidate.owners;
    if(!file.startsWith(prefix)||!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(declarationStart)||declarationStart<0||declarationStart>start||!Number.isSafeInteger(declarationEnd)||declarationEnd<=start||!/^[A-Za-z_]\w*$/.test(name)||!target||target.length>1048576||!["using","typedef"].includes(kind)||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part)))||typeof namespaceScope!=="boolean"||!Array.isArray(owners)||owners.length>64)fail("Rust model analysis returned an invalid type alias");
    const parsedOwners=owners.map(owner=>{const ownerName=String(owner?.name??""),templateParameters=owner?.templateParameters;if(!/^[A-Za-z_]\w*$/.test(ownerName)||!Array.isArray(templateParameters)||templateParameters.length>128||templateParameters.some(parameter=>!/^[A-Za-z_]\w*$/.test(String(parameter))))fail("Rust model analysis returned an invalid type owner");return{name:ownerName,templateParameters:templateParameters.map(String)}});
    const source=fs.readFileSync(file,"utf8");if(declarationEnd>source.length||!source.slice(start).startsWith(name)||!source.slice(declarationStart,declarationEnd).trimEnd().endsWith(";"))fail("Rust type alias does not match its source file");
    const aliases=aliasesByFile.get(file)??[];aliases.push({name,target,kind,namespace:namespace.map(String),namespaceScope,owners:parsedOwners,declarationStart,declarationEnd});aliasesByFile.set(file,aliases)
  }
  if(!Array.isArray(report.typeDeclarations))fail("Rust model analysis omitted type declarations");
  const typeDeclarationsByFile=new Map(rustSourceInventory(canonical).sourceFiles.map(file=>[file,[]]));
  for(const candidate of report.typeDeclarations){
    const file=path.resolve(String(candidate.file)),start=Number(candidate.start),declarationStart=Number(candidate.declarationStart),declarationEnd=Number(candidate.declarationEnd),bodyStart=Number(candidate.bodyStart),bodyEnd=Number(candidate.bodyEnd),name=String(candidate.name??""),kind=String(candidate.kind??""),namespace=candidate.namespace,namespaceScope=candidate.namespaceScope,owners=candidate.owners,templateSource=candidate.templateSource,templateParameters=candidate.templateParameters,bases=candidate.bases;
    if(!file.startsWith(prefix)||!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(declarationStart)||declarationStart<0||declarationStart>start||!Number.isSafeInteger(declarationEnd)||declarationEnd<=bodyEnd||!Number.isSafeInteger(bodyStart)||bodyStart<=start||!Number.isSafeInteger(bodyEnd)||bodyEnd<bodyStart||!/^[A-Za-z_]\w*$/.test(name)||!["struct","class","union"].includes(kind)||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part)))||typeof namespaceScope!=="boolean"||!Array.isArray(owners)||owners.length>64||(templateSource!==null&&(typeof templateSource!=="string"||templateSource.length>1048576))||!Array.isArray(templateParameters)||templateParameters.length>128||templateParameters.some(parameter=>!/^[A-Za-z_]\w*$/.test(String(parameter)))||!Array.isArray(bases)||bases.length>128||bases.some(base=>typeof base!=="string"||!base||base.length>1048576))fail("Rust model analysis returned an invalid type declaration");
    const parsedOwners=owners.map(owner=>{const ownerName=String(owner?.name??""),ownerParameters=owner?.templateParameters;if(!/^[A-Za-z_]\w*$/.test(ownerName)||!Array.isArray(ownerParameters)||ownerParameters.length>128||ownerParameters.some(parameter=>!/^[A-Za-z_]\w*$/.test(String(parameter))))fail("Rust model analysis returned an invalid declaration owner");return{name:ownerName,templateParameters:ownerParameters.map(String)}});
    const source=fs.readFileSync(file,"utf8");if(declarationEnd>source.length||!source.slice(start).startsWith(name)||source[bodyStart-1]!=="{"||source[bodyEnd]!=="}")fail("Rust type declaration does not match its source file");
    const declarations=typeDeclarationsByFile.get(file)??[];declarations.push({name,kind,namespace:namespace.map(String),namespaceScope,owners:parsedOwners,templateSource,templateParameters:templateParameters.map(String),bases:[...bases],declarationStart,declarationEnd,bodyStart,bodyEnd});typeDeclarationsByFile.set(file,declarations)
  }
  if(!Array.isArray(report.anonymousTypedefDeclarations))fail("Rust model analysis omitted anonymous typedef declarations");
  for(const candidate of report.anonymousTypedefDeclarations){
    const file=path.resolve(String(candidate.file));if(!file.startsWith(prefix))fail("Rust model analysis returned an invalid anonymous typedef path");
    const source=fs.readFileSync(file,"utf8"),declaration=normalizedAnonymousTypedefDeclaration(candidate,source,"model analysis"),declarations=typeDeclarationsByFile.get(file)??[];declarations.push(declaration);typeDeclarationsByFile.set(file,declarations)
  }
  if(!Array.isArray(report.enumDeclarations))fail("Rust model analysis omitted enum declarations");
  const enumDeclarationsByFile=new Map(rustSourceInventory(canonical).sourceFiles.map(file=>[file,[]]));
  for(const candidate of report.enumDeclarations){
    const file=path.resolve(String(candidate.file)),start=Number(candidate.start),end=Number(candidate.end),bodyStart=Number(candidate.bodyStart),bodyEnd=Number(candidate.bodyEnd),name=candidate.name===null?null:String(candidate.name??""),scoped=candidate.scoped,namespace=candidate.namespace,namespaceScope=candidate.namespaceScope,owners=candidate.owners,raw=candidate.raw,identifiers=candidate.identifiers,assignments=candidate.assignments,complete=candidate.complete;
    if(!file.startsWith(prefix)||!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||!Number.isSafeInteger(bodyStart)||bodyStart<=start||!Number.isSafeInteger(bodyEnd)||bodyEnd<bodyStart||(name!==null&&!/^[A-Za-z_]\w*$/.test(name))||typeof scoped!=="boolean"||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part)))||typeof namespaceScope!=="boolean"||!Array.isArray(owners)||owners.length>64||typeof raw!=="string"||raw.length>1048576||!Array.isArray(identifiers)||identifiers.length>65536||!assignments||typeof assignments!=="object"||Array.isArray(assignments)||typeof complete!=="boolean")fail("Rust model analysis returned an invalid enum declaration");
    const parsedOwners=owners.map(owner=>{const ownerName=String(owner?.name??""),templateParameters=owner?.templateParameters;if(!/^[A-Za-z_]\w*$/.test(ownerName)||!Array.isArray(templateParameters)||templateParameters.length>128||templateParameters.some(parameter=>!/^[A-Za-z_]\w*$/.test(String(parameter))))fail("Rust model analysis returned an invalid enum owner");return{name:ownerName,templateParameters:templateParameters.map(String)}}),parsedIdentifiers=identifiers.map(identifier=>{if(typeof identifier==="string"){if(!/^[A-Za-z_]\w*$/.test(identifier))fail("Rust model analysis returned an invalid enum identifier");return identifier}const base=String(identifier?.base??""),count=identifier?.count;if(!/^[A-Za-z_]\w*$/.test(base)||typeof count!=="string"||!count||count.length>4096)fail("Rust model analysis returned an invalid repeated enum identifier");return{base,count}}),parsedAssignments={};
    for(const [identifier,expression] of Object.entries(assignments)){if(!/^[A-Za-z_]\w*$/.test(identifier)||typeof expression!=="string"||!expression||expression.length>1048576)fail("Rust model analysis returned an invalid enum assignment");parsedAssignments[identifier]=expression}
    const source=fs.readFileSync(file,"utf8");if(end>source.length||!source.slice(start).startsWith("enum")||source[bodyStart-1]!=="{"||source[bodyEnd]!=="}")fail("Rust enum declaration does not match its source file");
    const declarations=enumDeclarationsByFile.get(file)??[];declarations.push({start,end,bodyStart,bodyEnd,name,scoped,namespace:namespace.map(String),namespaceScope,owners:parsedOwners,raw,identifiers:parsedIdentifiers,assignments:parsedAssignments,complete});enumDeclarationsByFile.set(file,declarations)
  }
  if(!Array.isArray(report.namespaceConstantDeclarations))fail("Rust model analysis omitted namespace constants");
  const namespaceConstantDeclarationsByFile=new Map(rustSourceInventory(canonical).sourceFiles.map(file=>[file,[]]));
  for(const candidate of report.namespaceConstantDeclarations){
    const file=path.resolve(String(candidate.file)),start=Number(candidate.start),end=Number(candidate.end),name=String(candidate.name??""),namespace=candidate.namespace;
    if(!file.startsWith(prefix)||!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||!/^[A-Za-z_]\w*$/.test(name)||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part))))fail("Rust model analysis returned an invalid namespace constant");
    const source=fs.readFileSync(file,"utf8"),declaration=source.slice(start,end);if(end>source.length||!declaration.trimEnd().endsWith(";")||!new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*=`).test(declaration))fail("Rust namespace constant does not match its source file");
    const declarations=namespaceConstantDeclarationsByFile.get(file)??[];declarations.push({start,end,name,namespace:namespace.map(String)});namespaceConstantDeclarationsByFile.set(file,declarations)
  }
  if(!Array.isArray(report.namespaceVariableDeclarations))fail("Rust model analysis omitted namespace variables");
  const namespaceVariableDeclarationsByFile=new Map(rustSourceInventory(canonical).sourceFiles.map(file=>[file,[]]));
  for(const candidate of report.namespaceVariableDeclarations){
    const file=path.resolve(String(candidate.file));if(!file.startsWith(prefix))fail("Rust model analysis returned an invalid namespace variable path");
    const source=fs.readFileSync(file,"utf8"),declaration=normalizedNamespaceVariableDeclaration(candidate,source,"model analysis"),declarations=namespaceVariableDeclarationsByFile.get(file)??[];declarations.push(declaration);namespaceVariableDeclarationsByFile.set(file,declarations)
  }
  if(!Array.isArray(report.namespaceUsingDeclarations))fail("Rust model analysis omitted namespace using declarations");
  const namespaceUsingDeclarationsByFile=new Map(rustSourceInventory(canonical).sourceFiles.map(file=>[file,[]]));
  for(const candidate of report.namespaceUsingDeclarations){
    const file=path.resolve(String(candidate.file));if(!file.startsWith(prefix))fail("Rust model analysis returned an invalid namespace using path");
    const source=fs.readFileSync(file,"utf8"),declaration=normalizedNamespaceUsingDeclaration(candidate,source,"model analysis"),declarations=namespaceUsingDeclarationsByFile.get(file)??[];declarations.push(declaration);namespaceUsingDeclarationsByFile.set(file,declarations)
  }
  if(!Array.isArray(report.namespaceUsingDirectives))fail("Rust model analysis omitted namespace using directives");
  const namespaceUsingDirectivesByFile=new Map(rustSourceInventory(canonical).sourceFiles.map(file=>[file,[]]));
  for(const candidate of report.namespaceUsingDirectives){
    const file=path.resolve(String(candidate.file));if(!file.startsWith(prefix))fail("Rust model analysis returned an invalid namespace using directive path");
    const source=fs.readFileSync(file,"utf8"),directive=normalizedNamespaceUsingDirective(candidate,source,"model analysis"),directives=namespaceUsingDirectivesByFile.get(file)??[];directives.push(directive);namespaceUsingDirectivesByFile.set(file,directives)
  }
  if(!Array.isArray(report.outOfLineDefinitions))fail("Rust model analysis omitted out-of-line definitions");
  const outOfLineDefinitionsByFile=new Map(rustSourceInventory(canonical).sourceFiles.map(file=>[file,[]]));
  for(const candidate of report.outOfLineDefinitions){
    const file=path.resolve(String(candidate.file)),start=Number(candidate.start),end=Number(candidate.end),bodyStart=candidate.bodyStart===null?null:Number(candidate.bodyStart),bodyEnd=candidate.bodyEnd===null?null:Number(candidate.bodyEnd),owner=String(candidate.owner??""),ownerChain=candidate.ownerChain,kind=String(candidate.kind??""),namespace=candidate.namespace,member=candidate.member,callableKind=candidate.callableKind,signature=candidate.signature;
    if(!file.startsWith(prefix)||!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||!/^[A-Za-z_]\w*$/.test(owner)||!Array.isArray(ownerChain)||!ownerChain.length||ownerChain.length>64||ownerChain.some(part=>!/^[A-Za-z_]\w*$/.test(String(part)))||String(ownerChain.at(-1))!==owner||!["function","defaulted","static"].includes(kind)||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part)))||(kind==="function"?(!Number.isSafeInteger(bodyStart)||bodyStart<=start||!Number.isSafeInteger(bodyEnd)||bodyEnd<bodyStart||bodyEnd>=end||typeof member!=="string"||!member||member.length>4096||!["function","constructor","destructor"].includes(callableKind)||typeof signature!=="string"||!signature||signature.length>1048576):bodyStart!==null||bodyEnd!==null||member!==null||callableKind!==null||signature!==null))fail("Rust model analysis returned an invalid out-of-line definition");
    const source=fs.readFileSync(file,"utf8"),definition=source.slice(start,end),validEnd=kind==="function"?definition.trimEnd().endsWith("}"):definition.trimEnd().endsWith(";");if(end>source.length||!validEnd||(kind==="function"&&(source[bodyStart-1]!=="{"||source[bodyEnd]!=="}"))||!new RegExp(`\\b${owner.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?:\\s*<[^;{}]+>)?\\s*::`).test(definition))fail("Rust out-of-line definition does not match its source file");
    const definitions=outOfLineDefinitionsByFile.get(file)??[];definitions.push({start,end,bodyStart,bodyEnd,owner,ownerChain:ownerChain.map(String),kind,namespace:namespace.map(String),member,callableKind,signature});outOfLineDefinitionsByFile.set(file,definitions)
  }
  if(!Array.isArray(report.freeFunctionDeclarations))fail("Rust model analysis omitted free-function declarations");
  const freeFunctionDeclarationsByFile=new Map(rustSourceInventory(canonical).sourceFiles.map(file=>[file,[]]));
  for(const candidate of report.freeFunctionDeclarations){
    const file=path.resolve(String(candidate.file)),start=Number(candidate.start),end=Number(candidate.end),name=String(candidate.name??""),namespace=candidate.namespace;
    if(!file.startsWith(prefix)||!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||!/^[A-Za-z_]\w*$/.test(name)||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part))))fail("Rust model analysis returned an invalid free-function declaration");
    const source=fs.readFileSync(file,"utf8"),declaration=source.slice(start,end);if(end>source.length||!declaration.trimEnd().endsWith(";")||!new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?:\\s*<[^;{}]+>)?\\s*\\(`).test(declaration))fail("Rust free-function declaration does not match its source file");
    const declarations=freeFunctionDeclarationsByFile.get(file)??[];declarations.push({start,end,name,namespace:namespace.map(String)});freeFunctionDeclarationsByFile.set(file,declarations)
  }
  if(!Array.isArray(report.freeFunctionDefinitions))fail("Rust model analysis omitted free-function definitions");
  const freeFunctionDefinitionsByFile=new Map(rustSourceInventory(canonical).sourceFiles.map(file=>[file,[]]));
  for(const candidate of report.freeFunctionDefinitions){
    const file=path.resolve(String(candidate.file)),start=Number(candidate.start),end=Number(candidate.end),name=String(candidate.name??""),namespace=candidate.namespace,signature=candidate.signature,declarationSignature=candidate.declarationSignature,references=candidate.references;
    if(!file.startsWith(prefix)||!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||!/^[A-Za-z_]\w*$/.test(name)||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part)))||typeof signature!=="string"||!signature||signature.length>1048576||typeof declarationSignature!=="string"||!declarationSignature||declarationSignature.length>1048576||declarationSignature.includes("{")||!new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?:\\s*<[^;{}]+>)?\\s*\\(`).test(declarationSignature)||!Array.isArray(references)||references.length>65536||references.some(reference=>!/^[A-Za-z_]\w*$/.test(String(reference))))fail("Rust model analysis returned an invalid free-function definition");
    const source=fs.readFileSync(file,"utf8"),definition=source.slice(start,end);if(end>source.length||!definition.trimEnd().endsWith("}")||!new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?:\\s*<[^;{}]+>)?\\s*\\(`).test(definition))fail("Rust free-function definition does not match its source file");
    const definitions=freeFunctionDefinitionsByFile.get(file)??[];definitions.push({start,end,name,namespace:namespace.map(String),signature,declarationSignature,references:references.map(String)});freeFunctionDefinitionsByFile.set(file,definitions)
  }
  const analysis={byFile,customModelCandidatesByFile,metaModuleCandidatesByFile,includeDirectivesByFile,stringConstants,aliasesByFile,typeDeclarationsByFile,enumDeclarationsByFile,namespaceConstantDeclarationsByFile,namespaceVariableDeclarationsByFile,namespaceUsingDeclarationsByFile,namespaceUsingDirectivesByFile,outOfLineDefinitionsByFile,freeFunctionDeclarationsByFile,freeFunctionDefinitionsByFile};modelCandidateCache.set(canonical,analysis);return analysis
}
function rustDependencyFiles(root,entries){
  const canonical=fs.realpathSync(root),prefix=`${canonical}${path.sep}`,resolvedEntries=[...new Set(entries.filter(Boolean).map(entry=>fs.realpathSync(entry)))],key=`${canonical}\0${[...resolvedEntries].sort().join("\0")}`,cached=dependencyClosureCache.get(key);if(cached)return cached;
  if(!resolvedEntries.length)fail("Rust dependency analysis requires at least one entry");
  const report=runRustSource(["analyze","dependencies","--source-dir",canonical,...resolvedEntries.flatMap(entry=>["--entry",entry]),"--format","json"]),validatePaths=(values,label)=>{if(!Array.isArray(values))fail(`Rust dependency analysis omitted ${label}`);return values.map(value=>{const resolved=path.resolve(String(value));if(!resolved.startsWith(prefix)||!fs.existsSync(resolved)||!fs.statSync(resolved).isFile())fail(`Rust dependency analysis returned an invalid ${label} path`);return resolved})},reportedRoots=validatePaths(report.roots,"entry"),files=validatePaths(report.files,"dependency"),prunedFiles=validatePaths(report.prunedFiles,"pruned dependency");
  if(report.sourceRoot===undefined||fs.realpathSync(String(report.sourceRoot))!==canonical||reportedRoots.length!==resolvedEntries.length||reportedRoots.some(root=>!resolvedEntries.includes(root))||new Set(files).size!==files.length||prunedFiles.some(file=>files.includes(file)))fail("Rust dependency analysis returned an inconsistent closure");
  dependencyClosureCache.set(key,files);return files
}
function files(root){return rustDependencyFileInventory(root).sourceFiles}
export function svgPanelWidth(file){
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())return null;
  const head=fs.readFileSync(file,"utf8").slice(0,4096),match=/<svg\b[^>]*\bwidth\s*=\s*["']([0-9.]+)\s*(mm|px)?\s*["']/i.exec(head),viewBox=/<svg\b[^>]*\bviewBox\s*=\s*["']\s*[-+0-9.eE]+\s+[-+0-9.eE]+\s+([-+0-9.eE]+)/i.exec(head),raw=Number(match?.[1]??viewBox?.[1]),converted=match?.[2]?.toLowerCase()==="mm"?raw*75/25.4:raw,snapped=Math.round(converted/15)*15,value=Math.abs(converted-snapped)<=1.5?snapped:converted;
  return Number.isFinite(value)&&value>=15&&value<=6000?Number(value.toFixed(5)):null
}
function svgPhysicalPixels(value){
  const match=/^\s*([-+0-9.eE]+)\s*(mm|cm|in|px|pt|pc)?\s*$/i.exec(String(value??""));
  if(!match)return Number.NaN;
  const number=Number(match[1]),unit=(match[2]??"px").toLowerCase(),scale=unit==="mm"?75/25.4:unit==="cm"?75/2.54:unit==="in"?75:unit==="pt"?75/72:unit==="pc"?75/6:1;
  return number*scale
}
function svgAttributes(tag){
  const result={};
  for(const match of String(tag).matchAll(/\b([:\w.-]+)\s*=\s*(["'])(.*?)\2/g))result[match[1]]=match[3];
  return result
}
function svgNamedCenters(file){
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())return null;
  const source=fs.readFileSync(file,"utf8"),root=/<svg\b[^>]*>/i.exec(source);
  if(!root)return null;
  const attributes=svgAttributes(root[0]),viewBox=String(attributes.viewBox??"").trim().split(/[\s,]+/).map(Number);
  if(viewBox.length!==4||viewBox.some(value=>!Number.isFinite(value))||viewBox[2]<=0||viewBox[3]<=0)return null;
  const physicalWidth=svgPhysicalPixels(attributes.width),physicalHeight=svgPhysicalPixels(attributes.height),
    scaleX=Number.isFinite(physicalWidth)?physicalWidth/viewBox[2]:1,
    scaleY=Number.isFinite(physicalHeight)?physicalHeight/viewBox[3]:scaleX,
    centers=new Map;
  for(const match of source.matchAll(/<(rect|circle|ellipse)\b[^>]*>/gi)){
    const shape=svgAttributes(match[0]),id=shape.id;
    if(!id)continue;
    let x,y;
    if(match[1].toLowerCase()==="rect"){
      const left=Number(shape.x??0),top=Number(shape.y??0),width=Number(shape.width),height=Number(shape.height);
      if(![left,top,width,height].every(Number.isFinite))continue;
      x=left+width*.5;y=top+height*.5
    }else{
      x=Number(shape.cx);y=Number(shape.cy);
      if(!Number.isFinite(x)||!Number.isFinite(y))continue
    }
    centers.set(id,{
      x:Number(((x-viewBox[0])*scaleX).toFixed(3)),
      y:Number(((y-viewBox[1])*scaleY).toFixed(3)),
      centered:true,
    })
  }
  return {
    centers,
    panelSize:{
      x:Number((viewBox[2]*scaleX).toFixed(3)),
      y:Number((viewBox[3]*scaleY).toFixed(3)),
    },
  }
}
function rackSvgHelperPlacements(source,enums,sourceDir,constants={}){
  const text=String(source??""),loaded=[...text.matchAll(/\bloadPanel\s*\([\s\S]{0,500}?["']([^"']+\.svg)["']/gi)].map(match=>match[1]);
  if(!loaded.length)return null;
  const checkoutRoot=path.basename(sourceDir)==="src"?path.dirname(sourceDir):sourceDir,svg=svgNamedCenters(path.resolve(checkoutRoot,loaded[0]));
  if(!svg)return null;
  const ids={
    params:enumIds(enums.params,constants),
    inputs:enumIds(enums.inputs,constants),
    outputs:enumIds(enums.outputs,constants),
    lights:enumIds(enums.lights,constants),
  },result={params:new Map,inputs:new Map,outputs:new Map,lights:new Map,panelSize:svg.panelSize},
    bindings=/\bbind(Param|Input|Output|Light)\s*<([^;()]+)>\s*\(\s*["']([^"']+)["']\s*,\s*([^,)]+)\)/g;
  for(const match of text.matchAll(bindings)){
    if(!isCodePosition(text,match.index))continue;
    const group=match[1]==="Param"?"params":match[1]==="Input"?"inputs":match[1]==="Output"?"outputs":"lights",
      id=enumExpressionId(match[4],ids[group],{...constants,...Object.fromEntries(ids[group])}),
      position=svg.centers.get(match[3]);
    if(id===undefined||!position||result[group].has(id))continue;
    result[group].set(id,{...position,widget:match[2].trim()})
  }
  return result
}
export function widgetPanelWidth(sourceRoot,registeredWidgetClass){
  if(!fs.existsSync(sourceRoot))return null;
  const sourceFiles=files(sourceRoot).filter(file=>/\.(?:cpp|cc|cxx|hpp|hh|h)$/.test(file)),queue=[{type:registeredWidgetClass,constants:widgetSourceConstants(sourceFiles)}],seen=new Set;
  while(queue.length){
    const current=queue.shift(),name=baseTypeName(current.type),typeArguments=/^[^<]+<([\s\S]+)>$/.exec(String(current.type).trim())?.[1];
    if(!name||["ModuleWidget","SchemeModuleWidget"].includes(name))continue;
    for(const file of sourceFiles){
      const source=fs.readFileSync(file,"utf8"),declaration=rustSourceTypeDeclaration(source,current.type),body=rustTypeBody(source,declaration);if(body===null)continue;
      const constants={...current.constants};
      if(declaration.templateSource!==null&&typeArguments){
        const parameters=declaration.templateParameters,values=splitArguments(typeArguments);
        for(let index=0;index<parameters.length;index++){const value=numberLiteral(values[index],Number.NaN,constants);if(parameters[index]&&Number.isFinite(value))constants[parameters[index]]=value}
      }
      const visitKey=`${file}:${name}:${JSON.stringify(constants)}`;if(seen.has(visitKey))continue;seen.add(visitKey);
      const widgetSource=[body,...sourceFiles.flatMap(candidate=>{const candidateSource=fs.readFileSync(candidate,"utf8");return rawOutOfLineDefinitions(candidate,candidateSource,name)})].join("\n"),hpExpressions=[...widgetSource.matchAll(/\bhp\s*=\s*([^;\n]+)\s*;/g)].map(match=>match[1]);
      for(const expression of hpExpressions.reverse()){const hp=numberLiteral(expression,Number.NaN,constants);if(Number.isSafeInteger(hp)&&hp>=1&&hp<=400)return hp*15}
      const checkoutRoot=path.basename(sourceRoot)==="src"?path.dirname(sourceRoot):sourceRoot,directPanelAssets=[...widgetSource.matchAll(/\b(?:setPanel|loadPanel)\s*\([\s\S]{0,500}?["']([^"']+\.svg)["']/gi)].map(match=>match[1]),splitPanelAssets=[...widgetSource.matchAll(/\bSplitPanelRenderer\s+[A-Za-z_]\w*\s*\([^,]+,\s*["']([^"']+\.svg)["']/g)].map(match=>match[1]),panelAssetBindings=new Map([...widgetSource.matchAll(/\b(?:static\s+)?(?:constexpr\s+)?(?:auto|const\s+char\s*\*|std::string)\s+([A-Za-z_]\w*)\s*=\s*["']([^"']+\.svg)["']\s*;/gi)].map(match=>[match[1],match[2]])),indirectPanelAssets=[...widgetSource.matchAll(/\b(?:setPanel|loadPanel)\s*\(([\s\S]{0,500}?)\)\s*;/g)].flatMap(match=>[...panelAssetBindings].filter(([name])=>new RegExp(`\\b${name}\\b`).test(match[1])).map(([,asset])=>asset)),panelAssets=[...new Set([...directPanelAssets,...splitPanelAssets,...indirectPanelAssets])].map(asset=>path.resolve(checkoutRoot,asset)),assetWidths=panelAssets.map(svgPanelWidth).filter(Number.isFinite);
      if(assetWidths.length&&assetWidths.length===panelAssets.length&&assetWidths.every(width=>Math.abs(width-assetWidths[0])<.01))return assetWidths[0];
      const widthExpressions=[
        /\bthis\s*->\s*box\.size\s*=\s*(?:(?:rack|math)::)*(?:Vec|Vector)\s*\(\s*([^,\n]+)\s*,/.exec(widgetSource)?.[1],
        /(?<![>.])\bbox\.size\s*=\s*(?:(?:rack|math)::)*(?:Vec|Vector)\s*\(\s*([^,\n]+)\s*,/.exec(widgetSource)?.[1],
        /\bthis\s*->\s*box\.size\.x\s*=\s*([^;\n]+)/.exec(widgetSource)?.[1],
        /(?<![>.])\bbox\.size\.x\s*=\s*([^;\n]+)/.exec(widgetSource)?.[1],
      ];
      for(const expression of widthExpressions){const width=numberLiteral(expression,Number.NaN,constants);if(Number.isFinite(width)&&width>=15&&width<=6000)return width}
      for(const base of declaration.bases)queue.push({type:base,constants});
    }
  }
  return null;
}
function panelWidth(sourceDir,model,registeredWidgetClass=""){
  const namedHp=Number(/Blank(?:Panel[_-]?)?[_-]?(\d+)HP$/i.exec(model)?.[1]);if(Number.isSafeInteger(namedHp)&&namedHp>=1&&namedHp<=400)return namedHp*15;
  const widgetWidth=widgetPanelWidth(path.join(sourceDir,"src"),registeredWidgetClass||`${model}Widget`);if(widgetWidth)return widgetWidth;
  const root=path.join(sourceDir,"res"),matches=[];if(fs.existsSync(root)){const visit=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true})){const target=path.join(directory,entry.name);if(entry.isDirectory())visit(target);else if(entry.name.toLowerCase().endsWith(".svg")&&new RegExp(`(?:^|[_-])${model}(?:[_-]|\\.svg$)`,"i").test(entry.name))matches.push(target)}};visit(root)}
  const widths=matches.map(svgPanelWidth).filter(Number.isFinite);return widths.length&&widths.every(value=>Math.abs(value-widths[0])<.01)?widths[0]:null;
}
function filesOutsideNestedRepositories(root){return rustSourceInventory(root).sourceFiles}
function repositoryRoots(root){return rustSourceInventory(root).repositoryRoots}
function selectIncludeCandidate(candidates,sourceDir){const ranked=[...new Set(candidates)].map(file=>{const parts=path.relative(sourceDir,file).split(path.sep),src=parts.indexOf("src"),libs=parts.indexOf("libs");return{file,score:(src>=0?src:40)+(libs>=0?80:0)+parts.length}}).sort((left,right)=>left.score-right.score||left.file.localeCompare(right.file));return ranked.length===1||ranked[0]?.score<ranked[1]?.score?ranked[0]?.file:undefined}
function pruneInactiveConditionalDependencies(found,sourceDir){
  const headers=found.filter(file=>/\.(?:hpp|hh|h|inl)$/.test(file)),sources=new Map(headers.map(file=>[file,fs.readFileSync(file,"utf8")])),conditionNames=new Set([...sources.values()].flatMap(source=>rustSourceDeclarations(source).conditionalDirectives.filter(candidate=>(candidate.kind==="if"||candidate.kind==="elif")&&candidate.simpleMacro!==null).map(candidate=>candidate.simpleMacro))),values=new Map;
  for(const source of sources.values())for(const [name,value] of rustObjectMacroDefinitions(source)){if(!conditionNames.has(name))continue;if(!values.has(name))values.set(name,new Set);values.get(name).add(value)}
  const definitions=new Map([...values].filter(([,candidates])=>candidates.size===1).map(([name,candidates])=>[name,[...candidates][0]]));
  if(!definitions.size)return found;
  const byBasename=new Map;
  for(const file of found){const basename=path.basename(file);if(!byBasename.has(basename))byBasename.set(basename,[]);byBasename.get(basename).push(file)}
  const resolve=(importer,include)=>{const normalized=include.split(/[\\/]+/).join(path.sep),direct=[path.resolve(path.dirname(importer),normalized),path.resolve(sourceDir,"src",normalized),path.resolve(sourceDir,normalized)].find(file=>found.includes(file));if(direct)return direct;const matches=(byBasename.get(path.basename(normalized))??[]).filter(file=>file.endsWith(`${path.sep}${normalized}`));return matches.length===1?matches[0]:undefined},inactiveCandidates=new Set,activeTargets=new Set;
  for(const file of headers){
    const raw=sources.get(file),active=preprocessMacroSource(raw,definitions),rawTargets=new Set(rawIncludes(file,raw).map(include=>resolve(file,include)).filter(Boolean)),activeTargetsForFile=new Set(active.includeDirectives.map(candidate=>resolve(file,candidate.include)).filter(Boolean));
    for(const target of activeTargetsForFile)activeTargets.add(target);
    for(const target of rawTargets)if(!activeTargetsForFile.has(target))inactiveCandidates.add(target)
  }
  const inactiveHeaders=new Set([...inactiveCandidates].filter(file=>!activeTargets.has(file))),inactiveStems=new Set([...inactiveHeaders].map(file=>file.replace(/\.(?:hpp|hh|h|inl)$/,"")));
  if(!inactiveHeaders.size)return found;
  return found.filter(file=>!inactiveHeaders.has(file)&&!(/\.(?:c|cpp|cc|cxx)$/.test(file)&&inactiveStems.has(file.replace(/\.(?:c|cpp|cc|cxx)$/,""))))
}
function includedDependencyFiles(sourceDir,roots){return rustDependencyFiles(sourceDir,roots)}
function browserSafeSystemInclude(include){return!["rack.hpp","settings.hpp","context.hpp","GL/glew.h","ghc/filesystem.hpp","pffft.h","QtGui","intrin.h","arm_neon.h","osdialog.h"].includes(include)&&!/^(?:app|ui|widget|window)\//.test(include)}
function standardDependencyIncludesFromDirectives(directives){return directives.filter(candidate=>candidate.angle).map(candidate=>candidate.include).filter(browserSafeSystemInclude).map(include=>`#include <${include}>`)}
function standardDependencyIncludes(source){return standardDependencyIncludesFromDirectives(preprocessMacroSource(source,new Map,false).includeDirectives)}
function externalDependencyPrelude(sourceDir,source,sourceFiles=[]){const externalRoots=repositoryRoots(sourceDir).slice(1),directives=preprocessMacroSource(source,new Map,false).includeDirectives,resolved=standardDependencyIncludesFromDirectives(directives),quoted=directives.filter(candidate=>!candidate.angle).map(candidate=>candidate.include);for(const include of quoted){if(path.basename(include)==="plugin.hpp")continue;const normalized=include.split(/[\\/]+/).join(path.sep),direct=externalRoots.some(root=>fs.existsSync(path.resolve(root,normalized))),matches=sourceFiles.filter(file=>externalRoots.some(root=>file.startsWith(`${root}${path.sep}`))&&file.endsWith(`${path.sep}${normalized}`));if(direct||selectIncludeCandidate(matches,sourceDir))resolved.push(`#include "${include}"`)}return[...new Set(resolved)].join("\n")}
function vendoredDependencyBundleForAdapter(sourceDir,definitionFile,sourceFiles){
  const source=fs.readFileSync(definitionFile,"utf8"),vendorNames=new Set(["dep","deps","vendor","third_party","eurorack"]),direct=[],containers=new Set;
  for(const include of rawIncludes(definitionFile,source)){const normalized=include.split(/[\\/]+/).join(path.sep),parts=normalized.split(path.sep),index=parts.findIndex(part=>vendorNames.has(part));if(index>=0){containers.add(path.resolve(path.dirname(definitionFile),...parts.slice(0,index+1)));containers.add(path.resolve(sourceDir,"src",...parts.slice(0,index+1)));containers.add(path.resolve(sourceDir,...parts.slice(0,index+1)))}}
  const vendorFiles=[];function visit(directory){if(!fs.existsSync(directory)||!fs.statSync(directory).isDirectory())return;vendorFiles.push(...rustDependencyFileInventory(directory,"vendor").sourceFiles)}for(const container of containers)visit(container);
  const resolveInclude=(importer,include)=>{const normalized=include.split(/[\\/]+/).join(path.sep),candidates=[path.resolve(path.dirname(importer),normalized),path.resolve(sourceDir,"src",normalized),path.resolve(sourceDir,normalized),...sourceFiles.filter(file=>path.basename(file)===path.basename(normalized)&&file.endsWith(normalized)),...vendorFiles.filter(file=>path.basename(file)===path.basename(normalized)&&file.endsWith(normalized))];return candidates.find(file=>fs.existsSync(file)&&fs.statSync(file).isFile())};
  for(const include of rawIncludes(definitionFile,source)){const resolved=resolveInclude(definitionFile,include);if(!resolved)continue;const parts=path.relative(sourceDir,resolved).split(path.sep),vendorIndex=parts.findIndex(part=>vendorNames.has(part));if(vendorIndex<0)continue;const container=path.resolve(sourceDir,...parts.slice(0,vendorIndex+1));if(!containers.has(container)){containers.add(container);visit(container)}direct.push({include,file:resolved})}
  if(!direct.length)return null;
  const distinctivePrefixes=new Set([...source.matchAll(/\b(?:[A-Z][A-Za-z0-9]*|[a-z][A-Za-z0-9]*)_[A-Za-z0-9_]{3,}\b/g)].map(match=>match[0].split("_")[0].toLowerCase())),inferred=vendorFiles.filter(file=>/\.(?:hpp|hh|h)$/.test(file)&&distinctivePrefixes.has(path.basename(file,path.extname(file)).toLowerCase())),graph=[],seen=new Set,queue=[...direct.map(item=>item.file),...inferred];while(queue.length){const file=queue.shift();if(!file||seen.has(file))continue;seen.add(file);graph.push(file);const fileSource=fs.readFileSync(file,"utf8");for(const include of rawIncludes(file,fileSource)){const dependency=resolveInclude(file,include);if(dependency&&!seen.has(dependency))queue.push(dependency)}if(/\.(?:hpp|hh|h)$/.test(file)){const stem=file.replace(/\.(?:hpp|hh|h)$/,"");for(const extension of [".c",".cpp",".cc",".cxx"]){const implementation=`${stem}${extension}`;if(fs.existsSync(implementation)&&!seen.has(implementation))queue.push(implementation)}const typeNames=declaredDependencyNames(fileSource);for(const implementation of vendorFiles.filter(candidate=>path.dirname(candidate)===path.dirname(file)&&/\.(?:c|cpp|cc|cxx)$/.test(candidate)&&!seen.has(candidate))){const implementationSource=fs.readFileSync(implementation,"utf8");if(typeNames.some(name=>new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*::`).test(implementationSource)))queue.push(implementation)}}}
  const directSources=new Set(direct.filter(item=>/\.(?:c|cpp|cc|cxx)$/.test(item.file)).map(item=>item.file)),implementationFiles=graph.filter(file=>/\.(?:c|cpp|cc|cxx)$/.test(file)&&!directSources.has(file)&&!path.relative(sourceDir,file).split(path.sep).some(part=>["test","tests","examples"].includes(part))&&!/^test[_-]/i.test(path.basename(file)));
  const sourceRoot=path.join(sourceDir,"src"),inferredIncludes=inferred.filter(file=>!direct.some(item=>item.file===file)).map(file=>`#include "${path.relative(sourceRoot,file).split(path.sep).join("/")}"`),bundle={source:[...new Set([...direct.map(item=>`#include "${item.include}"`),...inferredIncludes])].join("\n"),files:graph,implementationFiles:[...new Set(implementationFiles)]},companion=companionImplementationFile(definitionFile,sourceFiles),reference=[source,companion?fs.readFileSync(companion,"utf8"):""].join("\n"),vendoredHeaders=graph.filter(file=>/\.(?:hpp|hh|h)$/.test(file)),supplemental=referencedDependencyBundleForAdapter(sourceFiles,reference,new Set([definitionFile,...vendoredHeaders]),sourceDir);return mergeDependencyBundles(bundle,supplemental);
}
function mergeDependencyBundles(primary,secondary){if(!primary)return secondary;if(!secondary)return primary;return{source:[primary.source,secondary.source].filter(Boolean).join("\n\n"),files:[...new Set([...(primary.files??[]),...(secondary.files??[])])],implementationFiles:[...new Set([...(primary.implementationFiles??[]),...(secondary.implementationFiles??[])])]}}
function uiHeaderRequired(file,sourceDir,seen=new Set){if(seen.has(file))return false;seen.add(file);const source=fs.readFileSync(file,"utf8"),code=sourceWithoutComments(source),nativeRackUi=/\b(?:ModuleWidget|ParamWidget|PortWidget|LightWidget|OpaqueWidget|TransparentWidget|FramebufferWidget|SvgWidget|SvgKnob|SvgPanel|PanelBorder|DrawArgs|NVGcontext|MenuItem|MenuSeparator)\b|\b(?:app|ui|widget|window)::|\b(?:createParam|createInput|createOutput|createMenu|nvg[A-Z]\w*)\s*\(/.test(code);if(nativeRackUi)return true;return rawIncludes(file,source).some(include=>{const target=[path.resolve(path.dirname(file),include),path.resolve(sourceDir,"src",include),path.resolve(sourceDir,include)].find(candidate=>fs.existsSync(candidate)&&fs.statSync(candidate).isFile());return target?uiHeaderRequired(target,sourceDir,seen):false})}
function stripUiHeaderIncludes(source,sourceFiles=[],sourceDir=""){const removals=[];for(const directive of rustSourceDeclarations(source).includeDirectives.filter(candidate=>!candidate.angle)){const line=completeIncludeDirectiveLine(source,directive);if(!line)continue;const normalized=directive.include.split("/").join(path.sep),target=sourceFiles.find(file=>file.endsWith(`${path.sep}${normalized}`))||[path.resolve(sourceDir,"src",normalized),path.resolve(sourceDir,normalized)].find(file=>fs.existsSync(file)&&fs.statSync(file).isFile());if(target&&uiHeaderRequired(target,sourceDir))removals.push(line)}let result=source;for(const {start,end} of removals.reverse())result=result.slice(0,start)+result.slice(end);return result.replace(/^\s*namespace\s+[A-Za-z_]\w*\s*=\s*ghc::filesystem\s*;\s*$/gm,"")}
function stripPluginInitFunctions(source){const ranges=rustSourceFreeFunctionDefinitions(source).filter(candidate=>candidate.name==="init"&&/\bvoid\s+init\s*\(\s*(?:rack::)?Plugin\s*\*\s*[A-Za-z_]\w*\s*\)\s*$/.test(candidate.declarationSignature)).slice(0,16).map(candidate=>[candidate.start,candidate.end]);let result=source;for(const [start,end] of ranges.reverse())result=result.slice(0,start)+result.slice(end);return result.replace(/^\s*(?:(?:rack::)?plugin::)?Model\s*\*\s*[A-Za-z_]\w*\s*=\s*create[A-Za-z0-9_]*Model\s*<[^;]+>\s*\([^;]*\)\s*;\s*$/gm,"")}
function completeSourceLineRange(source,start,end){const lineStart=source.lastIndexOf("\n",start-1)+1,lineBreak=source.indexOf("\n",end);return source.slice(lineStart,start).trim()?null:{start:lineStart,end:lineBreak<0?source.length:lineBreak+1}}
function stripOrphanPreprocessorEnds(source){const declarations=rustSourceDeclarations(source),matched=new Set(declarations.conditionalBlocks.map(candidate=>candidate.closeStart).filter(start=>start!==null)),removals=declarations.conditionalDirectives.filter(candidate=>candidate.kind==="endif"&&!matched.has(candidate.start)).map(candidate=>completeSourceLineRange(source,candidate.start,candidate.end)).filter(Boolean);let result=source;for(const {start,end} of removals.reverse())result=result.slice(0,start)+result.slice(end);return result}
function stripHeaderGuardOpen(source){
  for(const name of ["portaloofRackInteriorScreenRect","portaloofBlendNanoVGCompositeOperation","portaloofBlendUsesNanoVGComposite"])source=removeQualifiedFreeFunction(source,name);
  const guard=rustSourceDeclarations(source).headerGuards[0];if(!guard)return source;
  const open=completeSourceLineRange(source,guard.openStart,guard.openEnd),definition=completeSourceLineRange(source,guard.defineStart,guard.defineEnd),close=guard.closeStart===null?null:completeSourceLineRange(source,guard.closeStart,guard.closeEnd);if(!open||!definition)return source;
  const removals=[{start:open.start,end:definition.end},...(close?[close]:[])];let result=source;for(const {start,end} of removals.reverse())result=result.slice(0,start)+result.slice(end);return result
}
function baseTypeName(type){return String(type).split("<",1)[0].split("::").at(-1).trim()}
function substituteType(type,bindings){let result=String(type);for(const [name,value] of Object.entries(bindings))result=result.replace(new RegExp("\\b"+name+"\\b","g"),value);return result.trim()}
function typeAlias(sourceFiles,type){if(String(type).includes("<"))return null;const name=baseTypeName(type);for(const file of sourceFiles){const source=fs.readFileSync(file,"utf8"),rustAliases=activeTypeAliasesByFile?.get(path.resolve(file))??rustSourceTypeAliases(source),resolved=rustAliases.find(alias=>alias.name===name)?.target.trim();if(resolved&&resolved!==name)return resolved}return null}
function resolveTypeAliases(sourceFiles,type){let resolved=String(type).trim();if(rackModuleBase(resolved))return resolved;const seen=new Set;for(let depth=0;depth<32;depth++){let changed=false;for(const name of [...new Set(resolved.match(/\b[A-Za-z_]\w*\b/g)??[])]){const alias=typeAlias(sourceFiles,name),identity=`${name}:${alias}`;if(!alias||seen.has(identity))continue;seen.add(identity);resolved=resolved.replace(new RegExp(`\\b${name}\\b`,"g"),alias);changed=true}if(rackModuleBase(resolved)||!changed)break}return resolved}
function declaredBases(source,className){return rustSourceTypeDeclaration(source,className)?.bases??[]}
function rackModuleBase(type){return /^(?:(?:rack::)?(?:engine::)?)?Module$/.test(String(type).replace(/\s/g,""))}
function splitQualifiedType(type){const source=String(type),parts=[];let start=0,angles=0,parentheses=0,brackets=0;for(let index=0;index<source.length;index++){const current=source[index];if(current==="<")angles++;else if(current===">")angles=Math.max(0,angles-1);else if(current==="(")parentheses++;else if(current===")")parentheses=Math.max(0,parentheses-1);else if(current==="[")brackets++;else if(current==="]")brackets=Math.max(0,brackets-1);else if(current===":"&&source[index+1]===":"&&angles===0&&parentheses===0&&brackets===0){parts.push(source.slice(start,index).trim());start=index+2;index++}}parts.push(source.slice(start).trim());return parts.filter(Boolean)}
function templateTypeArguments(type){const value=String(type),open=value.indexOf("<"),close=value.lastIndexOf(">");return open>=0&&close>open?splitArguments(value.slice(open+1,close)):[]}
function qualifyScopedAlias(type,namespaces){const value=String(type).replace(/^typename\s+/,"").trim();if(value.startsWith("::"))return value.slice(2);const parts=splitQualifiedType(value),shared=namespaces.lastIndexOf(parts[0]);if(shared>=0)return[...namespaces.slice(0,shared+1),...parts.slice(1)].join("::");if(parts[0]===namespaces[0]||["rack","std"].includes(parts[0]))return value;const prefix=/ui$/i.test(namespaces.at(-1)??"")?namespaces.slice(0,-1):namespaces;return[...prefix,...parts].join("::")}
function visibleRustAlias(alias,namespaces){return alias.owners.length===0&&alias.namespace.length<=namespaces.length&&alias.namespace.every((part,index)=>part===namespaces[index])}
function rustSimpleAlias(aliasCandidates,name,namespaces){return aliasCandidates.filter(alias=>alias.name===name&&visibleRustAlias(alias,namespaces)).sort((left,right)=>right.namespace.length-left.namespace.length||Number(right.kind==="typedef")-Number(left.kind==="typedef"))[0]??null}
function rustScopedAlias(aliasCandidates,owner,name,registrationNamespace){const qualifiedOwner=qualifyScopedAlias(owner,registrationNamespace),actualParts=splitQualifiedType(qualifiedOwner),matches=aliasCandidates.filter(alias=>alias.name===name&&alias.owners.length>0).filter(alias=>{const expected=[...alias.namespace,...alias.owners.map(item=>item.name)];return expected.length===actualParts.length&&expected.every((part,index)=>part===baseTypeName(actualParts[index]))}).sort((left,right)=>right.owners.length-left.owners.length);const candidate=matches[0];if(!candidate)return null;const bindings={};candidate.owners.forEach((scope,index)=>{const argumentsList=templateTypeArguments(actualParts[candidate.namespace.length+index]);scope.templateParameters.forEach((parameter,argumentIndex)=>{bindings[parameter]=argumentsList[argumentIndex]??parameter})});return{...candidate,target:substituteType(candidate.target,bindings)}}
function resolveRegisteredModuleType(source,type,aliasCandidates=null,registrationNamespace=[]){
  const aliases=aliasCandidates??rustSourceTypeAliases(source);let resolved=String(type).trim();for(let depth=0;depth<8;depth++){
    if(/^[A-Za-z_]\w*$/.test(resolved)){
      const rustAlias=rustSimpleAlias(aliases,resolved,registrationNamespace),value=rustAlias?.target.trim();
      if(value&&value!==resolved){resolved=value;continue}
    }
    const match=/^(.*)::([A-Za-z_]\w*)$/.exec(resolved);if(!match)break;const owner=match[1],alias=match[2],rustAlias=rustScopedAlias(aliases,owner,alias,registrationNamespace),value=rustAlias?.target;if(!value)break;resolved=qualifyScopedAlias(value,rustAlias.namespace)
  }return resolved
}
function registrationStringConstants(sourceFiles){const constants={};for(const file of sourceFiles){const source=sourceWithoutComments(fs.readFileSync(file,"utf8")),pattern=/\b(?:(?:inline|static)\s+)*(?:constexpr|const)\s+(?:auto|(?:std::)?string|(?:(?:const\s+)?char\s*(?:const\s*)?\*?))\s+([A-Za-z_]\w*)\s*(?:\[\s*\])?\s*(?:=\s*)?(\{\s*"(?:\\.|[^"\\])*"\s*\}|"(?:\\.|[^"\\])*")\s*;/g;for(const match of source.matchAll(pattern)){const expression=match[2].replace(/^\{\s*|\s*\}$/g,""),value=stringLiteral(expression,null);if(typeof value==="string")constants[match[1]]=value}}return constants}
function registrationSourceParts(source,file){
  const chunks=[{source,file:path.resolve(file)}],seen=new Set([path.resolve(file)]);
  const visit=(currentSource,currentFile)=>{
    if(chunks.length>=256)return;
    for(const directive of rustSourceDeclarations(currentSource).includeDirectives.filter(candidate=>!candidate.angle)){
      const candidate=path.resolve(path.dirname(currentFile),directive.include);
      if(seen.has(candidate)||!fs.existsSync(candidate)||!fs.statSync(candidate).isFile())continue;
      seen.add(candidate);
      const dependency=fs.readFileSync(candidate,"utf8");
      chunks.push({source:dependency,file:candidate});
      visit(dependency,candidate);
    }
  };
  visit(source,file);
  return chunks;
}
function registrationSourceContext(source,file){return registrationSourceParts(source,file).map(chunk=>chunk.source).join("\n\n")}
function registeredWidgetModuleType(source,file,widgetClass){
  const context=registrationSourceContext(source,file),
    base=declaredBases(context,widgetClass).find(value=>value.includes("<")&&/(?:^|::)[A-Za-z_]\w*Widget[A-Za-z_]*\s*</.test(value));
  if(!base)return null;
  const open=base.indexOf("<"),close=base.lastIndexOf(">");
  if(open<0||close<=open)return null;
  const moduleClass=splitArguments(base.slice(open+1,close))[0]?.trim();
  if(!moduleClass)return null;
  return qualifyScopedAlias(moduleClass,enclosingNamespaces(context,widgetClass));
}
function modelRegistrations(source,file,stringConstants={},candidateStarts=null,rustAliasesByFile=null,customModelCandidates=null){
  const registrations=[];
  const factoryStarts=candidateStarts===null?source.matchAll(/\bcreate[A-Za-z0-9_]*Model\s*</g):candidateStarts.map(candidate=>Number.isSafeInteger(candidate)?{index:candidate}:candidate);
  for(const start of factoryStarts){
    let templateSource=start.templateSource,callSource=start.callSource,templateArguments=start.templateArguments,callArguments=start.callArguments;
    if(typeof templateSource!=="string"||typeof callSource!=="string"){
      const open=source.indexOf("<",start.index),depthStart=open;let depth=0,close=-1;
      for(let index=open;index<source.length;index++){if(source[index]==="<")depth++;else if(source[index]===">"&&--depth===0){close=index;break}}
      if(close<0)continue;
      const callOpen=/^\s*\(/.exec(source.slice(close+1));if(!callOpen)continue;
      const openParenthesis=close+1+callOpen.index+callOpen[0].lastIndexOf("("),closeParenthesis=matchingParenthesis(source,openParenthesis);
      if(closeParenthesis<0)continue;
      templateSource=source.slice(depthStart+1,close);callSource=source.slice(openParenthesis+1,closeParenthesis)
    }
    const slug=stringLiteral((callArguments??splitArguments(callSource))[0],null,stringConstants);
    if(typeof slug!=="string"||!/^[A-Za-z0-9_-]+$/.test(slug))continue;
    const types=templateArguments??splitArguments(templateSource);
    if(![1,2].includes(types.length)||types.some(type=>!/^[A-Za-z0-9_:<>,. +\-]+$/.test(type)))continue;
    const widgetClass=types.at(-1),registeredModuleClass=types.length===2?types[0]:start.rust?(typeof start.registeredModuleType==="string"?qualifyScopedAlias(start.registeredModuleType,start.widgetNamespace):null):registeredWidgetModuleType(source,file,widgetClass);
    if(!registeredModuleClass)continue;
    const registrationContext=start.rust||types.length===2?source:registrationSourceContext(source,file);
    const aliasCandidates=start.rust&&rustAliasesByFile?start.contextFiles.flatMap(contextFile=>rustAliasesByFile.get(contextFile)??[]):null;
    const registrationNamespace=start.rust?start.namespace:namespaceStackAt(source,start.index);
    registrations.push({file,moduleClass:resolveRegisteredModuleType(registrationContext,registeredModuleClass,aliasCandidates,registrationNamespace),registeredModuleClass,widgetClass,slug,registrationNamespace})
  }
  const customStarts=customModelCandidates===null?source.matchAll(/\b(?:plugin::)?Model\s*\*\s*model([A-Za-z0-9_-]+)\s*=\s*\[\s*\]\s*\(\s*\)\s*\{/g):customModelCandidates;
  for(const start of customStarts){
    if(start.rust){
      const slug=stringLiteral(start.slugSource,start.variableSlug,stringConstants),moduleClass=start.moduleType,modelType=start.modelType,widgetClass=start.widgetClass??`${slug}Widget`,registrationNamespace=start.namespace;
      if(typeof slug==="string"&&/^[A-Za-z0-9_-]+$/.test(slug))registrations.push({file,moduleClass:resolveRegisteredModuleType(source,moduleClass,rustAliasesByFile?.get(path.resolve(file))??null,registrationNamespace),registeredModuleClass:moduleClass,widgetClass,slug,registrationNamespace,customModelFactory:modelType});
      continue
    }
    const open=source.indexOf("{",start.index),close=matchingBrace(source,open);
    if(close<0)continue;
    const lambdaBody=source.slice(open+1,close),slug=stringLiteral(/\bmodel\s*->\s*slug\s*=\s*([^;]+)\s*;/.exec(lambdaBody)?.[1],start[1],stringConstants);
    if(typeof slug!=="string"||!/^[A-Za-z0-9_-]+$/.test(slug))continue;
    const modelType=/\bnew\s+([A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)\b/.exec(lambdaBody)?.[1],modelBody=modelType?plainStructBody(source,modelType):null;
    if(!modelType||modelBody===null)continue;
    const createModule=/\b(?:engine::)?Module\s*\*\s+createModule\s*\([^)]*\)\s*override\s*\{/.exec(modelBody);
    if(!createModule)continue;
    const createOpen=modelBody.indexOf("{",createModule.index),createClose=matchingBrace(modelBody,createOpen),moduleClass=createClose>=0?/\bnew\s+([A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)\b/.exec(modelBody.slice(createOpen+1,createClose))?.[1]:null;
    if(!moduleClass)continue;
    const widgetFactory=/\bcreate(?!ModuleWidget\b)([A-Za-z_]\w*)Widget\s*\(/.exec(modelBody)?.[1],widgetClass=widgetFactory?`${widgetFactory}Widget`:`${slug}Widget`;
    registrations.push({file,moduleClass:resolveRegisteredModuleType(source,moduleClass),registeredModuleClass:moduleClass,widgetClass,slug,registrationNamespace:namespaceStackAt(source,start.index),customModelFactory:modelType})
  }
  return registrations
}
function metaModuleRegistrations(source,file,candidates=null){
  const registrations=[];
  for(const start of (candidates===null?source.matchAll(/\bGenericModule\s*</g):candidates)){
    if(start.rust){
      const types=start.templateArguments,infoType=types[0].trim(),coreType=(types[1]??`${baseTypeName(infoType).replace(/Info$/,"")}Core`).trim();
      registrations.push({file,moduleClass:coreType,registeredModuleClass:coreType,widgetClass:`GenericModule<${types.join(", ")}>::Widget`,slug:start.variableSlug,registrationNamespace:start.namespace,metaModuleGeneric:true,metaModuleInfo:infoType,metaModuleCore:coreType,metaModuleCoreInferred:types.length===1});
      continue
    }
    const open=source.indexOf("<",start.index);let depth=0,close=-1;
    for(let index=open;index<source.length;index++){if(source[index]==="<")depth++;else if(source[index]===">"&&--depth===0){close=index;break}}
    if(close<0||!/^\s*::\s*create\s*\(\s*\)/.test(source.slice(close+1)))continue;
    const types=splitArguments(source.slice(open+1,close)),prefix=source.slice(Math.max(0,start.index-160),start.index),variable=/\bmodel([A-Za-z0-9_-]+)\s*=\s*$/.exec(prefix);
    if(![1,2].includes(types.length)||!variable)continue;
    const infoType=types[0].trim(),coreType=(types[1]??`${baseTypeName(infoType).replace(/Info$/,"")}Core`).trim();
    registrations.push({file,moduleClass:coreType,registeredModuleClass:coreType,widgetClass:`GenericModule<${types.join(", ")}>::Widget`,slug:variable[1],registrationNamespace:namespaceStackAt(source,start.index),metaModuleGeneric:true,metaModuleInfo:infoType,metaModuleCore:coreType,metaModuleCoreInferred:types.length===1});
  }
  return registrations
}
function registeredModuleDefinitionExists(sourceDir,registration){
  if(!rackModuleBase(registration.moduleClass)||registration.moduleClass.includes("::"))return false;
  const registrationSource=fs.readFileSync(registration.file,"utf8"),root=path.resolve(sourceDir),prefix=`${root}${path.sep}`,candidates=[registration.file];
  for(const include of rawIncludes(registration.file,registrationSource))for(const candidate of [path.resolve(path.dirname(registration.file),include),path.resolve(root,"src",include),path.resolve(root,include)])if((candidate===root||candidate.startsWith(prefix))&&fs.existsSync(candidate)&&fs.statSync(candidate).isFile())candidates.push(candidate);
  return[...new Set(candidates)].some(file=>{const source=fs.readFileSync(file,"utf8"),expected=registration.registrationNamespace??[],declaration=rustTypeDeclaration(file,registration.moduleClass,[expected]);if(rawTypeBody(file,source,declaration,registration.moduleClass)===null)return false;const namespace=declaration?.namespace??enclosingNamespaces(source,registration.moduleClass);return namespace.length===expected.length&&namespace.every((part,index)=>part===expected[index])});
}
function functionMacroRegistrationSource(source){
  const definitions=rustSourceDeclarations(source).macroDefinitions.filter(candidate=>!candidate.commented&&candidate.functionLike&&/\bcreateModel\s*</.test(candidate.replacement)).map(candidate=>({name:candidate.name,parameters:candidate.parameters,body:candidate.replacement}));
  const expanded=[];
  for(const definition of definitions){const escaped=definition.name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),invocation=new RegExp(`^[ \\t]*${escaped}\\s*\\(([^;\\n]+)\\)\\s*;`,"gm");for(const match of source.matchAll(invocation)){const values=splitArguments(match[1]);if(values.length!==definition.parameters.length)continue;let body=definition.body;definition.parameters.forEach((parameter,index)=>{const value=values[index].trim(),token=parameter.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");body=body.replace(new RegExp(`#\\s*${token}\\b`,"g"),JSON.stringify(value)).replace(new RegExp(`\\b${token}\\b`,"g"),value)});body=body.replace(/\s*##\s*/g,"");for(let pass=0;pass<8;pass++){const next=body.replace(/std::string\(\s*"([^"]*)"\s*\)\s*\+\s*"([^"]*)"/g,(_,left,right)=>JSON.stringify(left+right)).replace(/"([^"]*)"\s*\+\s*"([^"]*)"/g,(_,left,right)=>JSON.stringify(left+right));if(next===body)break;body=next}expanded.push(body)}}
  return expanded.join("\n");
}
function rustObjectMacroDefinitions(source){const definitions=new Map;for(const candidate of rustSourceDeclarations(source).macroDefinitions)if(!candidate.commented&&!candidate.functionLike&&!/\\[ \t]*\r?\n/.test(candidate.rawDefinition))definitions.set(candidate.name,candidate.replacement.replace(/\s+\/\/.*$/," ").trim());return definitions}
function rustMacroDefinitionBlocks(source){return rustSourceDeclarations(source).macroDefinitions.filter(candidate=>!candidate.commented).map(candidate=>({name:candidate.name,definition:candidate.rawDefinition}))}
function normalizedIncludeDirective(candidate,source,label,targetRoot=undefined){
  const start=Number(candidate?.start),include=String(candidate?.include??""),angle=candidate?.angle,targetValue=candidate?.target;
  if(!Number.isSafeInteger(start)||start<0||start>source.length||!include||include.length>4096||/[\r\n<>\"]/.test(include)||typeof angle!=="boolean"||!source.slice(start).startsWith(include)||(targetRoot!==undefined&&targetValue!==null&&typeof targetValue!=="string"))fail(`Rust ${label} returned an invalid include directive`);
  let target=null;
  if(typeof targetValue==="string"){
    const root=path.resolve(targetRoot??projectDir),prefix=`${root}${path.sep}`;target=path.resolve(targetValue);
    if(!targetValue||targetValue.length>4096||target===root||!target.startsWith(prefix)||!fs.existsSync(target)||!fs.statSync(target).isFile())fail(`Rust ${label} returned an invalid include target`)
  }
  return{start,include,angle,target}
}
function normalizedPreprocessorDirectives(candidates,source,label){
  if(!Array.isArray(candidates)||candidates.length>65536)fail(`Rust ${label} returned invalid preprocessor directives`);
  let previousEnd=-1;
  return candidates.map(candidate=>{
    const start=Number(candidate?.start),end=Number(candidate?.end),kind=String(candidate?.kind??""),commented=candidate?.commented;
    if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||end>source.length||start<previousEnd||!["include","pragma","define"].includes(kind)||typeof commented!=="boolean")fail(`Rust ${label} returned an invalid preprocessor directive`);
    const rawDirective=source.slice(start,end),marker=`#${kind}`,markerIndex=rawDirective.indexOf(marker),prefix=markerIndex<0?null:rawDirective.slice(0,markerIndex).trim();
    if(markerIndex<0||prefix!==(commented?"//":""))fail(`Rust ${label} returned a mismatched preprocessor directive`);
    previousEnd=end;return{start,end,kind,commented,rawDirective}
  })
}
function normalizedMacroDefinitions(candidates,source,label){
  if(!Array.isArray(candidates)||candidates.length>65536)fail(`Rust ${label} returned invalid macro definitions`);
  let previousEnd=-1;
  return candidates.map(candidate=>{
    const start=Number(candidate?.start),end=Number(candidate?.end),name=String(candidate?.name??""),functionLike=candidate?.functionLike,parameters=candidate?.parameters,replacement=candidate?.replacement,commented=candidate?.commented;
    if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||end>source.length||start<previousEnd||!/^[A-Za-z_]\w*$/.test(name)||typeof functionLike!=="boolean"||!Array.isArray(parameters)||parameters.length>256||parameters.some(parameter=>typeof parameter!=="string"||parameter.length>4096||!/^(?:[A-Za-z_]\w*(?:\.\.\.)?|\.\.\.)$/.test(parameter))||(!functionLike&&parameters.length)||typeof replacement!=="string"||replacement.length>1048576||typeof commented!=="boolean")fail(`Rust ${label} returned an invalid macro definition`);
    const rawDefinition=source.slice(start,end),escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),match=new RegExp(`^[ \\t]*${commented?"//[ \\t]*":""}#[ \\t]*define[ \\t]+${escaped}(?<tail>[\\s\\S]*)$`).exec(rawDefinition),sourceFunctionLike=Boolean(match?.groups?.tail.trimStart().startsWith("("));
    if(!match||sourceFunctionLike!==functionLike)fail(`Rust ${label} returned a mismatched macro definition`);
    previousEnd=end;return{start,end,name,functionLike,parameters:parameters.map(String),replacement,commented,rawDefinition:rawDefinition.trim()}
  })
}
function normalizedConditionalDirectives(candidates,source,label){
  if(!Array.isArray(candidates)||candidates.length>65536)fail(`Rust ${label} returned invalid conditional directives`);
  let previousEnd=-1;
  return candidates.map(candidate=>{
    const start=Number(candidate?.start),end=Number(candidate?.end),kind=String(candidate?.kind??""),expression=candidate?.expression,simpleMacro=candidate?.simpleMacro===null?null:String(candidate?.simpleMacro??""),negated=candidate?.negated;
    if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||end>source.length||start<previousEnd||!["if","ifdef","ifndef","elif","else","endif"].includes(kind)||typeof expression!=="string"||expression.length>1048576||(simpleMacro!==null&&!/^[A-Za-z_]\w*$/.test(simpleMacro))||typeof negated!=="boolean")fail(`Rust ${label} returned an invalid conditional directive`);
    const rawDirective=source.slice(start,end),match=new RegExp(`^[ \\t]*#[ \\t]*${kind}\\b(?<expression>[\\s\\S]*)$`).exec(rawDirective),sourceExpression=match?.groups?.expression.replace(/[ \\t]*\\\\[ \\t]*\\r?\\n[ \\t]*/g," ").trim();
    if(!match||sourceExpression!==expression)fail(`Rust ${label} returned a mismatched conditional directive`);
    let expectedSimple=null,expectedNegated=false;
    if(kind==="ifdef"||kind==="ifndef"){expectedSimple=/^[A-Za-z_]\w*$/.test(expression)?expression:null;expectedNegated=kind==="ifndef"}
    else if(kind==="if"||kind==="elif"){const direct=/^(?<negated>!\s*)?(?<name>[A-Za-z_]\w*)$/.exec(expression);expectedSimple=direct?.groups?.name??null;expectedNegated=expression.trimStart().startsWith("!")}
    if(simpleMacro!==expectedSimple||negated!==expectedNegated)fail(`Rust ${label} returned inconsistent conditional facts`);
    previousEnd=end;return{start,end,kind,expression,simpleMacro,negated,rawDirective}
  })
}
function normalizedConditionalBlocks(candidates,source,label,conditionals){
  if(!Array.isArray(candidates)||candidates.length>65536)fail(`Rust ${label} returned invalid conditional blocks`);
  let previousStart=-1;
  return candidates.map(candidate=>{
    const openStart=Number(candidate?.openStart),openEnd=Number(candidate?.openEnd),closeStart=candidate?.closeStart===null?null:Number(candidate?.closeStart),closeEnd=candidate?.closeEnd===null?null:Number(candidate?.closeEnd),open=conditionals.find(value=>value.start===openStart&&value.end===openEnd),close=closeStart===null&&closeEnd===null?null:conditionals.find(value=>value.start===closeStart&&value.end===closeEnd);
    if(!Number.isSafeInteger(openStart)||openStart<0||openStart<previousStart||!Number.isSafeInteger(openEnd)||openEnd<=openStart||openEnd>source.length||(closeStart===null)!==(closeEnd===null)||(closeStart!==null&&(!Number.isSafeInteger(closeStart)||closeStart<openEnd||!Number.isSafeInteger(closeEnd)||closeEnd<=closeStart||closeEnd>source.length))||!open||!["if","ifdef","ifndef"].includes(open.kind)||(close!==null&&close.kind!=="endif"))fail(`Rust ${label} returned an invalid conditional block`);
    previousStart=openStart;return{openStart,openEnd,closeStart,closeEnd,open,close}
  })
}
function normalizedHeaderGuards(candidates,source,label,conditionals,macros){
  if(!Array.isArray(candidates)||candidates.length>65536)fail(`Rust ${label} returned invalid header guards`);
  let previousStart=-1;
  return candidates.map(candidate=>{
    const name=String(candidate?.name??""),openStart=Number(candidate?.openStart),openEnd=Number(candidate?.openEnd),defineStart=Number(candidate?.defineStart),defineEnd=Number(candidate?.defineEnd),closeStart=candidate?.closeStart===null?null:Number(candidate?.closeStart),closeEnd=candidate?.closeEnd===null?null:Number(candidate?.closeEnd);
    const open=conditionals.find(value=>value.start===openStart&&value.end===openEnd),definition=macros.find(value=>value.start===defineStart&&value.end===defineEnd),close=closeStart===null&&closeEnd===null?null:conditionals.find(value=>value.start===closeStart&&value.end===closeEnd),escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),guardExpression=open?.kind==="ifndef"?new RegExp(`^${escaped}(?:\\s*//.*)?$`).test(open.expression):open?.kind==="if"?new RegExp(`^!\\s*defined(?:\\s*\\(\\s*${escaped}\\s*\\)|\\s+${escaped})(?:\\s*//.*)?$`).test(open.expression):false;
    if(!/^[A-Za-z_]\w*$/.test(name)||!Number.isSafeInteger(openStart)||openStart<0||openStart<previousStart||!Number.isSafeInteger(openEnd)||openEnd<=openStart||!Number.isSafeInteger(defineStart)||defineStart<openEnd||!Number.isSafeInteger(defineEnd)||defineEnd<=defineStart||defineEnd>source.length||(closeStart===null)!==(closeEnd===null)||(closeStart!==null&&(!Number.isSafeInteger(closeStart)||closeStart<defineEnd||!Number.isSafeInteger(closeEnd)||closeEnd<=closeStart||closeEnd>source.length))||!open||!definition||definition.commented||definition.name!==name||(close!==null&&close.kind!=="endif")||!guardExpression)fail(`Rust ${label} returned an invalid header guard`);
    previousStart=openStart;return{name,openStart,openEnd,defineStart,defineEnd,closeStart,closeEnd}
  })
}
function preprocessMacroSource(source,initialDefinitions=new Map,expandObjectMacros=true){
  const report=runRustSource(["analyze","preprocess","--format","json"],activeSourceTool,{source,initialDefinitions:Object.fromEntries(initialDefinitions),expandObjectMacros}),entries=report?.definitions&&typeof report.definitions==="object"&&!Array.isArray(report.definitions)?Object.entries(report.definitions):null,directives=report?.includeDirectives;
  if(typeof report?.source!=="string"||!entries||entries.length>65536||entries.some(([name,value])=>!/^[A-Za-z_]\w*$/.test(name)||typeof value!=="string")||!Array.isArray(directives)||directives.length>65536)fail("Rust preprocessing returned an invalid report");
  const includeDirectives=directives.map(candidate=>normalizedIncludeDirective(candidate,report.source,"preprocessing"));
  return{source:report.source,definitions:new Map(entries),includeDirectives}
}
function declarationOwners(owners,label){
  if(!Array.isArray(owners)||owners.length>64)fail(`Rust declaration analysis returned invalid ${label} owners`);
  return owners.map(owner=>{const name=String(owner?.name??""),templateParameters=owner?.templateParameters;if(!/^[A-Za-z_]\w*$/.test(name)||!Array.isArray(templateParameters)||templateParameters.length>128||templateParameters.some(parameter=>!/^[A-Za-z_]\w*$/.test(String(parameter))))fail(`Rust declaration analysis returned invalid ${label} owner`);return{name,templateParameters:templateParameters.map(String)}})
}
function normalizedAnonymousTypedefDeclaration(candidate,source,label){
  const declarationStart=Number(candidate?.start),declarationEnd=Number(candidate?.end),bodyStart=Number(candidate?.bodyStart),bodyEnd=Number(candidate?.bodyEnd),nameStart=Number(candidate?.nameStart),name=String(candidate?.name??""),kind=String(candidate?.kind??""),namespace=candidate?.namespace,namespaceScope=candidate?.namespaceScope,owners=declarationOwners(candidate?.owners,`${label} anonymous typedef`);
  if(!Number.isSafeInteger(declarationStart)||declarationStart<0||!Number.isSafeInteger(declarationEnd)||declarationEnd<=nameStart||declarationEnd>source.length||!Number.isSafeInteger(bodyStart)||bodyStart<=declarationStart||!Number.isSafeInteger(bodyEnd)||bodyEnd<bodyStart||!Number.isSafeInteger(nameStart)||nameStart<=bodyEnd||!/^[A-Za-z_]\w*$/.test(name)||!["struct","class","union","enum"].includes(kind)||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part)))||typeof namespaceScope!=="boolean"||!source.slice(declarationStart).startsWith("typedef")||source[bodyStart-1]!=="{"||source[bodyEnd]!=="}"||!source.slice(nameStart).startsWith(name)||!source.slice(declarationStart,declarationEnd).trimEnd().endsWith(";"))fail(`Rust ${label} returned an invalid anonymous typedef declaration`);
  return{start:nameStart,declarationStart,declarationEnd,bodyStart,bodyEnd,name,kind,namespace:namespace.map(String),namespaceScope,owners,templateSource:null,templateParameters:[],bases:[],anonymousTypedef:true}
}
function normalizedNamespaceVariableDeclaration(candidate,source,label){
  const start=Number(candidate?.start),end=Number(candidate?.end),nameStart=Number(candidate?.nameStart),declaratorEnd=Number(candidate?.declaratorEnd),name=String(candidate?.name??""),namespace=candidate?.namespace,typeSource=String(candidate?.typeSource??""),arrayExtent=String(candidate?.arrayExtent??""),cLinkage=candidate?.cLinkage,initialized=candidate?.initialized,externDeclaration=candidate?.externDeclaration;
  if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||end>source.length||!Number.isSafeInteger(nameStart)||nameStart<=start||!Number.isSafeInteger(declaratorEnd)||declaratorEnd<=nameStart||declaratorEnd>end||!/^[A-Za-z_]\w*$/.test(name)||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part)))||!typeSource||typeSource.length>4096||typeSource.includes("\0")||arrayExtent.length>1024||!/^(?:\[[^\]\r\n]*\]\s*)*$/.test(arrayExtent)||typeof cLinkage!=="boolean"||typeof initialized!=="boolean"||typeof externDeclaration!=="boolean"||(externDeclaration&&initialized))fail(`Rust ${label} returned an invalid namespace variable declaration`);
  const rawDeclaration=source.slice(start,end).trim(),sourceType=source.slice(start,nameStart).trim().replace(/^extern(?=\s)/,"").trim();if(!rawDeclaration.endsWith(";")||!source.slice(nameStart).startsWith(name)||sourceType!==typeSource||source.slice(nameStart+name.length,declaratorEnd).trim()!==arrayExtent)fail(`Rust ${label} returned a mismatched namespace variable declaration`);
  return{start,end,nameStart,declaratorEnd,name,namespace:namespace.map(String),typeSource,arrayExtent,cLinkage,initialized,externDeclaration,rawDeclaration}
}
function normalizedNamespaceUsingDeclaration(candidate,source,label){
  const start=Number(candidate?.start),end=Number(candidate?.end),target=String(candidate?.target??""),namespace=candidate?.namespace;
  if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||end>source.length||!/^[A-Za-z_]\w*(?:::[A-Za-z_]\w*)+$/.test(target)||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part))))fail(`Rust ${label} returned an invalid namespace using declaration`);
  const rawDeclaration=source.slice(start,end).trim(),escaped=target.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");if(!new RegExp(`^using\\s+${escaped}\\s*;$`).test(rawDeclaration))fail(`Rust ${label} returned a mismatched namespace using declaration`);
  return{start,end,target,namespace:namespace.map(String),rawDeclaration}
}
function normalizedNamespaceUsingDirective(candidate,source,label){
  const start=Number(candidate?.start),end=Number(candidate?.end),target=String(candidate?.target??""),namespace=candidate?.namespace;
  if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||end>source.length||!/^[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*$/.test(target)||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part))))fail(`Rust ${label} returned an invalid namespace using directive`);
  const rawDeclaration=source.slice(start,end).trim(),escaped=target.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");if(!new RegExp(`^using\\s+namespace\\s+${escaped}\\s*;$`).test(rawDeclaration))fail(`Rust ${label} returned a mismatched namespace using directive`);
  return{start,end,target,namespace:namespace.map(String),rawDeclaration}
}
function rustSourceDeclarations(source){
  if(sourceDeclarationCache.has(source))return sourceDeclarationCache.get(source);
  try{
    const report=runRustSource(["analyze","declarations","--format","json"],activeSourceTool,{source});
    if(!Array.isArray(report.macroDefinitions)||report.macroDefinitions.length>65536)fail("Rust declaration analysis returned invalid macro definitions");
    if(!Array.isArray(report.conditionalDirectives)||report.conditionalDirectives.length>65536||!Array.isArray(report.conditionalBlocks)||report.conditionalBlocks.length>65536||!Array.isArray(report.headerGuards)||report.headerGuards.length>65536||!Array.isArray(report.includeDirectives)||report.includeDirectives.length>65536||!Array.isArray(report.typeDeclarations)||report.typeDeclarations.length>65536||!Array.isArray(report.anonymousTypedefDeclarations)||report.anonymousTypedefDeclarations.length>65536||!Array.isArray(report.typeAliases)||report.typeAliases.length>65536||!Array.isArray(report.enumDeclarations)||report.enumDeclarations.length>65536||!Array.isArray(report.namespaceConstantDeclarations)||report.namespaceConstantDeclarations.length>65536||!Array.isArray(report.namespaceVariableDeclarations)||report.namespaceVariableDeclarations.length>65536||!Array.isArray(report.namespaceUsingDeclarations)||report.namespaceUsingDeclarations.length>65536||!Array.isArray(report.namespaceUsingDirectives)||report.namespaceUsingDirectives.length>65536||!Array.isArray(report.configCalls)||report.configCalls.length>65536||!Array.isArray(report.inlineMemberDefinitions)||report.inlineMemberDefinitions.length>65536||!Array.isArray(report.freeFunctionDeclarations)||report.freeFunctionDeclarations.length>65536)fail("Rust declaration analysis returned an invalid report");
    const typeDeclarations=report.typeDeclarations.map(candidate=>{const start=Number(candidate?.start),declarationStart=Number(candidate?.declarationStart),declarationEnd=Number(candidate?.declarationEnd),bodyStart=Number(candidate?.bodyStart),bodyEnd=Number(candidate?.bodyEnd),name=String(candidate?.name??""),kind=String(candidate?.kind??""),namespace=candidate?.namespace,namespaceScope=candidate?.namespaceScope,owners=declarationOwners(candidate?.owners,"type"),templateSource=candidate?.templateSource,templateParameters=candidate?.templateParameters,bases=candidate?.bases;if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(declarationStart)||declarationStart<0||declarationStart>start||!Number.isSafeInteger(declarationEnd)||declarationEnd<=bodyEnd||declarationEnd>source.length||!Number.isSafeInteger(bodyStart)||bodyStart<=start||!Number.isSafeInteger(bodyEnd)||bodyEnd<bodyStart||!/^[A-Za-z_]\w*$/.test(name)||!["struct","class","union"].includes(kind)||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part)))||typeof namespaceScope!=="boolean"||(templateSource!==null&&(typeof templateSource!=="string"||templateSource.length>1048576))||!Array.isArray(templateParameters)||templateParameters.length>128||templateParameters.some(parameter=>!/^[A-Za-z_]\w*$/.test(String(parameter)))||!Array.isArray(bases)||bases.length>128||bases.some(base=>typeof base!=="string"||!base||base.length>1048576)||!source.slice(start).startsWith(name)||source[bodyStart-1]!=="{"||source[bodyEnd]!=="}")fail("Rust declaration analysis returned an invalid type declaration");return{start,declarationStart,declarationEnd,bodyStart,bodyEnd,name,kind,namespace:namespace.map(String),namespaceScope,owners,templateSource,templateParameters:templateParameters.map(String),bases:[...bases]}});
    const typeAliases=report.typeAliases.map(candidate=>{const start=Number(candidate?.start),declarationStart=Number(candidate?.declarationStart),declarationEnd=Number(candidate?.declarationEnd),name=String(candidate?.name??""),target=String(candidate?.target??""),kind=String(candidate?.kind??""),namespace=candidate?.namespace,namespaceScope=candidate?.namespaceScope,owners=declarationOwners(candidate?.owners,"type alias");if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(declarationStart)||declarationStart<0||declarationStart>start||!Number.isSafeInteger(declarationEnd)||declarationEnd<=start||declarationEnd>source.length||!/^[A-Za-z_]\w*$/.test(name)||!target||target.length>1048576||!["using","typedef"].includes(kind)||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part)))||typeof namespaceScope!=="boolean"||!source.slice(start).startsWith(name))fail("Rust declaration analysis returned an invalid type alias");const rawDefinition=source.slice(declarationStart,declarationEnd).trim();if(!rawDefinition.endsWith(";"))fail("Rust declaration analysis returned a mismatched type alias");const namespaces=namespace.map(String),definition=namespaces.length?`${namespaces.map(value=>`namespace ${value} {`).join("\n")}\n${rawDefinition}\n${namespaces.map(()=>"}").join("\n")}`:rawDefinition;return{start,declarationStart,declarationEnd,name,target,kind,namespace:namespaces,namespaceScope,owners,rawDefinition,definition}});
    const anonymousTypedefDeclarations=report.anonymousTypedefDeclarations.map(candidate=>normalizedAnonymousTypedefDeclaration(candidate,source,"declaration analysis"));
    typeDeclarations.push(...anonymousTypedefDeclarations);
    const enumDeclarations=report.enumDeclarations.map(candidate=>{const start=Number(candidate?.start),end=Number(candidate?.end),bodyStart=Number(candidate?.bodyStart),bodyEnd=Number(candidate?.bodyEnd),name=candidate?.name===null?null:String(candidate?.name??""),scoped=candidate?.scoped,namespace=candidate?.namespace,namespaceScope=candidate?.namespaceScope,owners=declarationOwners(candidate?.owners,"enum"),raw=candidate?.raw,identifiers=candidate?.identifiers,assignments=candidate?.assignments,complete=candidate?.complete;if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||end>source.length||!Number.isSafeInteger(bodyStart)||bodyStart<=start||!Number.isSafeInteger(bodyEnd)||bodyEnd<bodyStart||(name!==null&&!/^[A-Za-z_]\w*$/.test(name))||typeof scoped!=="boolean"||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part)))||typeof namespaceScope!=="boolean"||typeof raw!=="string"||raw.length>1048576||!Array.isArray(identifiers)||identifiers.length>65536||!assignments||typeof assignments!=="object"||Array.isArray(assignments)||typeof complete!=="boolean"||!source.slice(start).startsWith("enum")||source[bodyStart-1]!=="{"||source[bodyEnd]!=="}")fail("Rust declaration analysis returned an invalid enum declaration");const parsedIdentifiers=identifiers.map(identifier=>{if(typeof identifier==="string"){if(!/^[A-Za-z_]\w*$/.test(identifier))fail("Rust declaration analysis returned an invalid enum identifier");return identifier}const base=String(identifier?.base??""),count=identifier?.count;if(!/^[A-Za-z_]\w*$/.test(base)||typeof count!=="string"||!count||count.length>4096)fail("Rust declaration analysis returned an invalid repeated enum identifier");return{base,count}}),parsedAssignments={};for(const [identifier,expression] of Object.entries(assignments)){if(!/^[A-Za-z_]\w*$/.test(identifier)||typeof expression!=="string"||!expression||expression.length>1048576)fail("Rust declaration analysis returned an invalid enum assignment");parsedAssignments[identifier]=expression}return{start,end,bodyStart,bodyEnd,name,scoped,namespace:namespace.map(String),namespaceScope,owners,raw,identifiers:parsedIdentifiers,assignments:parsedAssignments,complete}}),includeDirectives=report.includeDirectives.map(candidate=>normalizedIncludeDirective(candidate,source,"declaration analysis")),namespaceConstantDeclarations=report.namespaceConstantDeclarations.map(candidate=>{const start=Number(candidate?.start),end=Number(candidate?.end),name=String(candidate?.name??""),namespace=candidate?.namespace;if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||end>source.length||!/^[A-Za-z_]\w*$/.test(name)||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part))))fail("Rust declaration analysis returned an invalid namespace constant");const rawDeclaration=source.slice(start,end).trim();if(!rawDeclaration.endsWith(";")||!new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*=`).test(rawDeclaration))fail("Rust declaration analysis returned a mismatched namespace constant");const namespaces=namespace.map(String),definition=namespaces.length?`${namespaces.map(value=>`namespace ${value} {`).join("\n")}\n${rawDeclaration}\n${namespaces.map(()=>"}").join("\n")}`:rawDeclaration;return{start,end,name,namespace:namespaces,rawDeclaration,definition}}),namespaceVariableDeclarations=report.namespaceVariableDeclarations.map(candidate=>normalizedNamespaceVariableDeclaration(candidate,source,"declaration analysis")),namespaceUsingDeclarations=report.namespaceUsingDeclarations.map(candidate=>normalizedNamespaceUsingDeclaration(candidate,source,"declaration analysis")),namespaceUsingDirectives=report.namespaceUsingDirectives.map(candidate=>normalizedNamespaceUsingDirective(candidate,source,"declaration analysis")),result={typeDeclarations,typeAliases,enumDeclarations,includeDirectives,namespaceConstantDeclarations,namespaceVariableDeclarations,namespaceUsingDeclarations,namespaceUsingDirectives,anonymousTypedefDeclarations};
    result.macroDefinitions=normalizedMacroDefinitions(report.macroDefinitions,source,"declaration analysis");
    result.conditionalDirectives=normalizedConditionalDirectives(report.conditionalDirectives,source,"declaration analysis");
    result.conditionalBlocks=normalizedConditionalBlocks(report.conditionalBlocks,source,"declaration analysis",result.conditionalDirectives);
    result.headerGuards=normalizedHeaderGuards(report.headerGuards,source,"declaration analysis",result.conditionalDirectives,result.macroDefinitions);
    const configCallNames=new Set(["config","venomConfig","configParam","configParamNoRand","configSwitch","configButton","configInput","configOutput","configBypass","configOnOff","configOnOffNoRand","configMenuParam","rackWebSnapParam"]),configCalls=report.configCalls.map(candidate=>{
      const start=Number(candidate?.start),end=Number(candidate?.end),name=String(candidate?.name??""),templateSource=candidate?.templateSource,argumentsSource=candidate?.argumentsSource,argumentsList=candidate?.arguments,namespace=candidate?.namespace,owners=declarationOwners(candidate?.owners,"config call"),loops=candidate?.loops,stringBindings=candidate?.stringBindings,synthetic=candidate?.synthetic,callSource=source.slice(start,end),sourceMatches=synthetic?name==="rackWebSnapParam"&&templateSource===null&&snapAssignmentArgument(callSource)===argumentsSource:callSource.startsWith(name)&&callSource.trimEnd().endsWith(")");
      if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||end>source.length||!configCallNames.has(name)||(templateSource!==null&&(typeof templateSource!=="string"||!templateSource||templateSource.length>1048576))||typeof argumentsSource!=="string"||argumentsSource.length>1048576||!Array.isArray(argumentsList)||argumentsList.length>1024||argumentsList.some(argument=>typeof argument!=="string"||!argument||argument.length>1048576)||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part)))||!Array.isArray(loops)||loops.length>32||!Array.isArray(stringBindings)||stringBindings.length>1024||typeof synthetic!=="boolean"||!sourceMatches||JSON.stringify(argumentsList)!==JSON.stringify(splitArguments(argumentsSource).filter(Boolean)))fail("Rust declaration analysis returned an invalid config call");
      const parsedLoops=loops.map(loop=>{const loopStart=Number(loop?.start),loopEnd=Number(loop?.end),bodyStart=Number(loop?.bodyStart),bodyEnd=Number(loop?.bodyEnd),variable=String(loop?.variable??""),startExpression=loop?.startExpression,endExpression=loop?.endExpression;if(!Number.isSafeInteger(loopStart)||loopStart<0||!Number.isSafeInteger(loopEnd)||loopEnd<=loopStart||loopEnd>source.length||!Number.isSafeInteger(bodyStart)||bodyStart<=loopStart||!Number.isSafeInteger(bodyEnd)||bodyEnd<bodyStart||bodyStart>start||bodyEnd<end||!/^[A-Za-z_]\w*$/.test(variable)||typeof startExpression!=="string"||!startExpression||startExpression.length>1048576||typeof endExpression!=="string"||!endExpression||endExpression.length>1048576||!/^for\b/.test(source.slice(loopStart,bodyStart-1).trimStart())||source[bodyStart-1]!=="{"||source[bodyEnd]!=="}")fail("Rust declaration analysis returned an invalid config loop");return{start:loopStart,end:loopEnd,bodyStart,bodyEnd,variable,startExpression,endExpression}}),parsedBindings=stringBindings.map(binding=>{const bindingStart=Number(binding?.start),bindingEnd=Number(binding?.end),bindingName=String(binding?.name??""),expression=binding?.expression;if(!Number.isSafeInteger(bindingStart)||bindingStart<0||!Number.isSafeInteger(bindingEnd)||bindingEnd<=bindingStart||bindingEnd>start||!/^[A-Za-z_]\w*$/.test(bindingName)||typeof expression!=="string"||!expression||expression.length>1048576||!source.slice(bindingStart,bindingEnd).trimEnd().endsWith(";"))fail("Rust declaration analysis returned an invalid config string binding");return{start:bindingStart,end:bindingEnd,name:bindingName,expression}});
      return{start,end,name,templateSource,argumentsSource,arguments:[...argumentsList],namespace:namespace.map(String),owners,loops:parsedLoops,stringBindings:parsedBindings,synthetic}
    });
    result.configCalls=configCalls;
    result.inlineMemberDefinitions=report.inlineMemberDefinitions.map(candidate=>{
      const start=Number(candidate?.start),end=Number(candidate?.end),bodyStart=Number(candidate?.bodyStart),bodyEnd=Number(candidate?.bodyEnd),owner=String(candidate?.owner??""),ownerChain=candidate?.ownerChain,namespace=candidate?.namespace,member=String(candidate?.member??""),callableKind=String(candidate?.callableKind??""),signature=candidate?.signature;
      if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||end>source.length||!Number.isSafeInteger(bodyStart)||bodyStart<=start||!Number.isSafeInteger(bodyEnd)||bodyEnd<bodyStart||bodyEnd>=end||source[bodyStart-1]!=="{"||source[bodyEnd]!=="}"||!/^[A-Za-z_]\w*$/.test(owner)||!Array.isArray(ownerChain)||!ownerChain.length||ownerChain.length>64||ownerChain.some(part=>!/^[A-Za-z_]\w*$/.test(String(part)))||String(ownerChain.at(-1))!==owner||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part)))||!/^~?[A-Za-z_]\w*$/.test(member)||!["function","constructor","destructor"].includes(callableKind)||typeof signature!=="string"||!signature||signature.length>1048576)fail("Rust declaration analysis returned an invalid inline member definition");
      const rawDefinition=source.slice(start,end).trim(),memberPattern=member.startsWith("~")?member.slice(1):member;if(!rawDefinition.endsWith("}")||!new RegExp(`(?:~\\s*)?\\b${memberPattern.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*\\(`).test(rawDefinition))fail("Rust declaration analysis returned a mismatched inline member definition");return{start,end,bodyStart,bodyEnd,owner,ownerChain:ownerChain.map(String),namespace:namespace.map(String),member,callableKind,signature,rawDefinition}
    });
    if(!Array.isArray(report.outOfLineDefinitions)||report.outOfLineDefinitions.length>65536)fail("Rust declaration analysis returned invalid out-of-line definitions");
    result.outOfLineDefinitions=report.outOfLineDefinitions.map(candidate=>{
      const start=Number(candidate?.start),end=Number(candidate?.end),bodyStart=candidate?.bodyStart===null?null:Number(candidate?.bodyStart),bodyEnd=candidate?.bodyEnd===null?null:Number(candidate?.bodyEnd),owner=String(candidate?.owner??""),ownerChain=candidate?.ownerChain,kind=String(candidate?.kind??""),namespace=candidate?.namespace,member=candidate?.member,callableKind=candidate?.callableKind,signature=candidate?.signature;
      if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||end>source.length||!/^[A-Za-z_]\w*$/.test(owner)||!Array.isArray(ownerChain)||!ownerChain.length||ownerChain.length>64||ownerChain.some(part=>!/^[A-Za-z_]\w*$/.test(String(part)))||String(ownerChain.at(-1))!==owner||!["function","defaulted","static"].includes(kind)||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part)))||(kind==="function"?(!Number.isSafeInteger(bodyStart)||bodyStart<=start||!Number.isSafeInteger(bodyEnd)||bodyEnd<bodyStart||bodyEnd>=end||source[bodyStart-1]!=="{"||source[bodyEnd]!=="}"||typeof member!=="string"||!member||member.length>4096||!["function","constructor","destructor"].includes(callableKind)||typeof signature!=="string"||!signature||signature.length>1048576):bodyStart!==null||bodyEnd!==null||member!==null||callableKind!==null||signature!==null))fail("Rust declaration analysis returned an invalid out-of-line definition");
      const rawDefinition=source.slice(start,end).trim(),validEnd=kind==="function"?rawDefinition.endsWith("}"):rawDefinition.endsWith(";");if(!validEnd||!new RegExp(`\\b${owner.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?:\\s*<[^;{}]+>)?\\s*::`).test(rawDefinition))fail("Rust declaration analysis returned a mismatched out-of-line definition");
      return{start,end,bodyStart,bodyEnd,owner,ownerChain:ownerChain.map(String),kind,namespace:namespace.map(String),member,callableKind,signature,rawDefinition}
    });
    result.freeFunctionDeclarations=report.freeFunctionDeclarations.map(candidate=>{
      const start=Number(candidate?.start),end=Number(candidate?.end),name=String(candidate?.name??""),namespace=candidate?.namespace;
      if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||end>source.length||!/^[A-Za-z_]\w*$/.test(name)||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part))))fail("Rust declaration analysis returned an invalid free-function declaration");
      const rawDeclaration=source.slice(start,end).trim();if(!rawDeclaration.endsWith(";")||!new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?:\\s*<[^;{}]+>)?\\s*\\(`).test(rawDeclaration))fail("Rust declaration analysis returned a mismatched free-function declaration");const namespaces=namespace.map(String),definition=namespaces.length?`${namespaces.map(value=>`namespace ${value} {`).join("\n")}\n${rawDeclaration}\n${namespaces.map(()=>"}").join("\n")}`:rawDeclaration;
      return{start,end,name,namespace:namespaces,rawDeclaration,definition}
    });
    if(!Array.isArray(report.freeFunctionDefinitions)||report.freeFunctionDefinitions.length>65536)fail("Rust declaration analysis returned invalid free-function definitions");
    result.freeFunctionDefinitions=report.freeFunctionDefinitions.map(candidate=>{
      const start=Number(candidate?.start),end=Number(candidate?.end),name=String(candidate?.name??""),namespace=candidate?.namespace,signature=candidate?.signature,declarationSignature=candidate?.declarationSignature,references=candidate?.references;
      if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||end>source.length||!/^[A-Za-z_]\w*$/.test(name)||!Array.isArray(namespace)||namespace.length>64||namespace.some(part=>!/^[A-Za-z_]\w*$/.test(String(part)))||typeof signature!=="string"||!signature||signature.length>1048576||typeof declarationSignature!=="string"||!declarationSignature||declarationSignature.length>1048576||declarationSignature.includes("{")||!new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?:\\s*<[^;{}]+>)?\\s*\\(`).test(declarationSignature)||!Array.isArray(references)||references.length>65536||references.some(reference=>!/^[A-Za-z_]\w*$/.test(String(reference))))fail("Rust declaration analysis returned an invalid free-function definition");
      const rawDefinition=source.slice(start,end).trim();if(!rawDefinition.endsWith("}")||!new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?:\\s*<[^;{}]+>)?\\s*\\(`).test(rawDefinition))fail("Rust declaration analysis returned a mismatched free-function definition");
      const namespaces=namespace.map(String),definition=namespaces.length?`${namespaces.map(value=>`namespace ${value} {`).join("\n")}\n${rawDefinition}\n${namespaces.map(()=>"}").join("\n")}`:rawDefinition;
      return{start,end,name,namespace:namespaces,signature,declarationSignature,references:references.map(String),rawDefinition,definition}
    });
    result.preprocessorDirectives=normalizedPreprocessorDirectives(report.preprocessorDirectives,source,"declaration analysis");
    if(!Array.isArray(report.repeatedDefaultArgumentRanges)||report.repeatedDefaultArgumentRanges.length>65536)fail("Rust declaration analysis returned invalid repeated default-argument ranges");let previousDefaultArgumentEnd=-1;
    result.repeatedDefaultArgumentRanges=report.repeatedDefaultArgumentRanges.map(candidate=>{const start=Number(candidate?.start),end=Number(candidate?.end),contained=result.freeFunctionDefinitions.some(definition=>start>=definition.start&&end<=definition.end);if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(end)||end<=start||end>source.length||start<previousDefaultArgumentEnd||!contained||!source.slice(start,end).includes("="))fail("Rust declaration analysis returned an invalid repeated default-argument range");previousDefaultArgumentEnd=end;return{start,end}});
    if(sourceDeclarationCache.size>=32)sourceDeclarationCache.clear();sourceDeclarationCache.set(source,result);return result
  }catch(error){throw error}
}
function rustInlineMemberDefinitions(source){
  if(inlineMemberDefinitionCache.has(source))return inlineMemberDefinitionCache.get(source);
  const prefix="struct RackWebInlineFragment {\n",wrapped=`${prefix}${source}\n};`,limit=prefix.length+source.length,definitions=rustSourceDeclarations(wrapped).inlineMemberDefinitions.filter(candidate=>candidate.start>=prefix.length&&candidate.end<=limit).map(candidate=>{const start=candidate.start-prefix.length,end=candidate.end-prefix.length,bodyStart=candidate.bodyStart-prefix.length,bodyEnd=candidate.bodyEnd-prefix.length;return{...candidate,start,end,bodyStart,bodyEnd,rawDefinition:source.slice(start,end).trim()}});
  if(inlineMemberDefinitionCache.size>=32)inlineMemberDefinitionCache.clear();inlineMemberDefinitionCache.set(source,definitions);return definitions
}
function outOfLineCallableKeys(source){
  return rustSourceDeclarations(source).outOfLineDefinitions
    .filter(candidate=>candidate.kind==="function"&&candidate.callableKind!==null&&/^~?[A-Za-z_]\w*$/.test(candidate.member??""))
    .map(candidate=>`${candidate.owner}::${candidate.member}`)
}
function matchingTypeDeclaration(declarations,type,expectedScopes=null){const name=baseTypeName(type),explicitScope=splitQualifiedType(String(type).replace(/^::/,"")).slice(0,-1).map(baseTypeName),matches=(declarations??[]).filter(declaration=>declaration.name===name),scope=declaration=>[...declaration.namespace,...declaration.owners.map(owner=>owner.name)],sameScope=(left,right)=>left.length===right.length&&left.every((part,index)=>part===right[index]);if(Array.isArray(expectedScopes)){const matched=matches.find(declaration=>expectedScopes.some(expected=>sameScope(scope(declaration),expected)));if(matched)return matched}if(explicitScope.length){const matched=matches.find(declaration=>sameScope(scope(declaration),explicitScope));if(matched)return matched}return matches[0]??null}
function rustSourceTypeDeclaration(source,type,expectedScopes=null){const candidate=matchingTypeDeclaration(rustSourceDeclarations(source).typeDeclarations,type,expectedScopes),body=rustTypeBody(source,candidate);return body===null?null:{...candidate,transformed:true}}
function rustSourceTypeAliases(source){return rustSourceDeclarations(source).typeAliases}
function rustSourceNamespaceConstantDeclarations(source){return rustSourceDeclarations(source).namespaceConstantDeclarations}
function rustSourceNamespaceUsingDirectives(source){return rustSourceDeclarations(source).namespaceUsingDirectives}
function rustEnumCandidateInfo(candidate){return{name:candidate.name??"",raw:candidate.raw,identifiers:candidate.identifiers.map(identifier=>typeof identifier==="string"?identifier:{...identifier}),...(Object.keys(candidate.assignments).length?{assignments:{...candidate.assignments}}:{}),scoped:candidate.scoped}}
function rustSourceEnumInfo(source,names){const accepted=Array.isArray(names)?names:[names],declarations=rustSourceDeclarations(source).enumDeclarations;for(const name of accepted){const candidate=declarations.find(declaration=>declaration.complete&&declaration.name===name);if(candidate)return rustEnumCandidateInfo(candidate)}return null}
function rustSourceConfigCalls(source,name,constants={}){const selected=rustSourceDeclarations(source).configCalls.filter(call=>call.name===name);return rackWebConfigExpansions(selected,constants).flat()}
function rustSourceOutOfLineDefinitions(source,className,kinds,preserveNamespace=false,fallbackNamespaces=[]){const name=baseTypeName(className).split("::").at(-1),found=[];for(const candidate of rustSourceDeclarations(source).outOfLineDefinitions){if(!candidate.ownerChain.includes(name)||!kinds.has(candidate.kind))continue;let definition=candidate.rawDefinition;if(preserveNamespace){const namespaces=candidate.namespace.length?candidate.namespace:fallbackNamespaces;if(namespaces.length)definition=`${namespaces.map(namespace=>`namespace ${namespace} {`).join("\n")}\n${definition}\n${namespaces.map(()=>"}").join("\n")}`}found.push(definition)}return[...new Set(found)]}
function rustSourceFreeFunctionDeclarations(source){return rustSourceDeclarations(source).freeFunctionDeclarations}
function rustSourceFreeFunctionDefinitions(source){return rustSourceDeclarations(source).freeFunctionDefinitions}
function macroConfiguredRegistrations(source,file,stringConstants={},directCandidateStarts=null,rustAliasesByFile=null,directCustomModelCandidates=null,directMetaModuleCandidates=null){
  const functionRegistrations=functionMacroRegistrationSource(source),combinedSource=[source,functionRegistrations].filter(Boolean).join("\n"),candidateStarts=directCandidateStarts===null?null:[...directCandidateStarts,...(functionRegistrations?[...functionRegistrations.matchAll(/\bcreate[A-Za-z0-9_]*Model\s*</g)].map(match=>({index:source.length+1+match.index})):[])],registrations=[...modelRegistrations(combinedSource,file,stringConstants,candidateStarts,rustAliasesByFile,directCustomModelCandidates),...metaModuleRegistrations(source,file,directMetaModuleCandidates)],macros=rustObjectMacroDefinitions(source);
  if(!macros.size)return registrations;
  const seen=new Set(registrations.map(registration=>`${registration.slug}:${registration.moduleClass}:${registration.widgetClass}`));
  const appendExpanded=(expanded,definitionFile)=>{
    for(const registration of modelRegistrations(expanded.source,definitionFile,stringConstants)){
      const key=`${registration.slug}:${registration.moduleClass}:${registration.widgetClass}`;
      if(seen.has(key))continue;
      seen.add(key);
      registrations.push({...registration,file,definitionFile,definitionSource:expanded.source,macros:expanded.definitions,macroConfigured:true});
    }
  };
  appendExpanded(preprocessMacroSource(source,new Map),file);
  for(const include of rawIncludes(file,source)){
    const target=path.resolve(path.dirname(file),include);
    if(!fs.existsSync(target)||!fs.statSync(target).isFile())continue;
    appendExpanded(preprocessMacroSource(fs.readFileSync(target,"utf8"),macros),target);
  }
  return registrations
}
function rustTypeDeclaration(file,type,expectedScopes=null){return matchingTypeDeclaration(activeTypeDeclarationsByFile?.get(path.resolve(file))??[],type,expectedScopes)}
function rustTypeBody(source,declaration){if(!declaration||source[declaration.bodyStart-1]!=="{"||source[declaration.bodyEnd]!=="}")return null;return source.slice(declaration.bodyStart,declaration.bodyEnd)}
function rawTypeBody(file,source,declaration,type){const resolved=path.resolve(file);if(!activeTypeDeclarationsByFile?.has(resolved))return plainStructBody(source,type);if(source!==fs.readFileSync(resolved,"utf8"))fail(`Raw type source differs from the Rust inventory for ${resolved}`);return rustTypeBody(source,declaration)}
function rustIncludeDirectives(file,source){const resolved=path.resolve(file);if(!activeIncludeDirectivesByFile?.has(resolved))return null;if(source!==fs.readFileSync(resolved,"utf8"))fail(`Raw include source differs from the Rust inventory for ${resolved}`);return activeIncludeDirectivesByFile.get(resolved)}
function rawIncludeDirectives(file,source){return rustIncludeDirectives(file,source)??rustSourceDeclarations(source).includeDirectives}
function rawIncludes(file,source){return rawIncludeDirectives(file,source).map(candidate=>candidate.include)}
function rackWebConfigExpansions(callsList,constants={}){
  if(!callsList.length)return[];
  const calls=callsList.map(call=>({argumentsSource:call.argumentsSource,loops:call.loops.map(loop=>({variable:loop.variable,startExpression:loop.startExpression,endExpression:loop.endExpression})),stringBindings:call.stringBindings.map(binding=>({name:binding.name,expression:binding.expression}))})),report=runRustSource(["abi","config-expansions","--format","json"],activeSourceTool,{constants,calls});
  if(!Array.isArray(report.expansions)||report.expansions.length!==calls.length||report.expansions.some(expansion=>!Array.isArray(expansion)||expansion.some(value=>typeof value!=="string")))fail("Rust configuration expansion returned invalid values");
  return report.expansions
}
function rustDirectConfigCalls(source,name,constants={}){
  return rustSourceConfigCalls(source,name,constants)
}
function rustRawOutOfLineDefinitions(file,source,className,kinds,preserveNamespace=false,fallbackNamespaces=[]){const resolved=path.resolve(file);if(!activeOutOfLineDefinitionsByFile?.has(resolved))return null;if(source!==fs.readFileSync(resolved,"utf8"))fail(`Raw implementation source differs from the Rust inventory for ${resolved}`);const name=baseTypeName(className).split("::").at(-1),found=[];for(const candidate of activeOutOfLineDefinitionsByFile.get(resolved)){if(!candidate.ownerChain.includes(name)||!kinds.has(candidate.kind))continue;let definition=source.slice(candidate.start,candidate.end).trim();if(preserveNamespace){const namespaces=candidate.namespace.length?candidate.namespace:fallbackNamespaces;if(namespaces.length)definition=`${namespaces.map(namespace=>`namespace ${namespace} {`).join("\n")}\n${definition}\n${namespaces.map(()=>"}").join("\n")}`}found.push(definition)}return[...new Set(found)]}
function rustOutOfLineDefinitions(file,source,className,preserveNamespace=false,fallbackNamespaces=[]){return rustRawOutOfLineDefinitions(file,source,className,new Set(["function","defaulted"]),preserveNamespace,fallbackNamespaces)}
function rustOutOfLineStaticDefinitions(file,source,className,preserveNamespace=false,fallbackNamespaces=[]){return rustRawOutOfLineDefinitions(file,source,className,new Set(["static"]),preserveNamespace,fallbackNamespaces)}
function rawOutOfLineDefinitions(file,source,className,preserveNamespace=false,fallbackNamespaces=[]){const rust=rustOutOfLineDefinitions(file,source,className,preserveNamespace,fallbackNamespaces);return rust===null?outOfLineDefinitions(source,className,preserveNamespace,fallbackNamespaces):rust}
function rawOutOfLineStaticDefinitions(file,source,className,preserveNamespace=false,fallbackNamespaces=[]){const rust=rustOutOfLineStaticDefinitions(file,source,className,preserveNamespace,fallbackNamespaces);return rust===null?outOfLineStaticDefinitions(source,className,preserveNamespace,fallbackNamespaces):rust}
function rustNamespaceConstantDeclarations(file,source){const resolved=path.resolve(file);if(!activeNamespaceConstantDeclarationsByFile?.has(resolved))return null;if(source!==fs.readFileSync(resolved,"utf8"))fail(`Raw constant source differs from the Rust inventory for ${resolved}`);return activeNamespaceConstantDeclarationsByFile.get(resolved).map(candidate=>{const rawDeclaration=source.slice(candidate.start,candidate.end).trim(),definition=candidate.namespace.length?`${candidate.namespace.map(namespace=>`namespace ${namespace} {`).join("\n")}\n${rawDeclaration}\n${candidate.namespace.map(()=>"}").join("\n")}`:rawDeclaration;return{name:candidate.name,namespace:candidate.namespace,rawDeclaration,definition}})}
function rustNamespaceVariableDeclarations(file,source){const resolved=path.resolve(file);if(!activeNamespaceVariableDeclarationsByFile?.has(resolved))return rustSourceDeclarations(source).namespaceVariableDeclarations;if(source!==fs.readFileSync(resolved,"utf8"))fail(`Raw namespace variable source differs from the Rust inventory for ${resolved}`);return activeNamespaceVariableDeclarationsByFile.get(resolved)}
function rustNamespaceUsingDeclarations(file,source){const resolved=path.resolve(file);if(!activeNamespaceUsingDeclarationsByFile?.has(resolved))return rustSourceDeclarations(source).namespaceUsingDeclarations;if(source!==fs.readFileSync(resolved,"utf8"))fail(`Raw namespace using source differs from the Rust inventory for ${resolved}`);return activeNamespaceUsingDeclarationsByFile.get(resolved)}
function rustProjectedNamespaceUsingDeclarations(file,source){const resolved=path.resolve(file);if(!activeNamespaceUsingDeclarationsByFile?.has(resolved))return rustSourceDeclarations(source).namespaceUsingDeclarations;const inventorySource=fs.readFileSync(resolved,"utf8"),declarations=activeNamespaceUsingDeclarationsByFile.get(resolved);if(source===inventorySource)return declarations;const retained=sourceWithoutCommentsAndLiterals(source);return declarations.filter(candidate=>retained.includes(candidate.rawDeclaration))}
function rustNamespaceUsingDirectives(file,source){const resolved=path.resolve(file);if(!activeNamespaceUsingDirectivesByFile?.has(resolved))return rustSourceNamespaceUsingDirectives(source);if(source!==fs.readFileSync(resolved,"utf8"))fail(`Raw namespace using source differs from the Rust inventory for ${resolved}`);return activeNamespaceUsingDirectivesByFile.get(resolved)}
function rustFreeFunctionDeclarations(file,source){const resolved=path.resolve(file);if(!activeFreeFunctionDeclarationsByFile?.has(resolved))return null;if(source!==fs.readFileSync(resolved,"utf8"))fail(`Raw free-function source differs from the Rust inventory for ${resolved}`);return activeFreeFunctionDeclarationsByFile.get(resolved).map(candidate=>{const rawDeclaration=source.slice(candidate.start,candidate.end).trim(),definition=candidate.namespace.length?`${candidate.namespace.map(namespace=>`namespace ${namespace} {`).join("\n")}\n${rawDeclaration}\n${candidate.namespace.map(()=>"}").join("\n")}`:rawDeclaration;return{name:candidate.name,rawDeclaration,definition}})}
function rustFreeFunctionDefinitions(file,source){const resolved=path.resolve(file);if(!activeFreeFunctionDefinitionsByFile?.has(resolved))return null;if(source!==fs.readFileSync(resolved,"utf8"))fail(`Raw free-function source differs from the Rust inventory for ${resolved}`);return activeFreeFunctionDefinitionsByFile.get(resolved).map(candidate=>{const rawDefinition=source.slice(candidate.start,candidate.end).trim();let definition=rawDefinition;if(candidate.namespace.length)definition=`${candidate.namespace.map(namespace=>`namespace ${namespace} {`).join("\n")}\n${definition}\n${candidate.namespace.map(()=>"}").join("\n")}`;return{...candidate,rawDefinition,definition}})}
function templateContract(source,moduleClass,typeDeclaration=null){const open=moduleClass.indexOf("<"),close=moduleClass.lastIndexOf(">");if(open<0||close<open)return null;const declaration=typeDeclaration??rustSourceTypeDeclaration(source,moduleClass);if(declaration?.templateSource===null||declaration?.templateSource===undefined)return null;const declarationSource=declaration.templateSource,parameters=declaration.templateParameters,argumentsList=splitArguments(moduleClass.slice(open+1,close)),constants={};parameters.forEach((parameter,index)=>{const value=numberLiteral(argumentsList[index],Number.NaN);if(Number.isFinite(value))constants[parameter]=value});return {declaration:`template <${declarationSource}>`,parameters,arguments:argumentsList,constants}}
function enclosingNamespaces(source,className){return rustSourceTypeDeclaration(source,className)?.namespace??[]}
function removeClassDefinition(source,className){const declaration=rustSourceTypeDeclaration(source,className);return declaration?source.slice(0,declaration.declarationStart)+source.slice(declaration.declarationEnd):source}
function classDefinitionSource(source,className){const declaration=rustSourceTypeDeclaration(source,className);return declaration?source.slice(declaration.declarationStart,declaration.declarationEnd):""}
function qualifiedTypeDefinitionRecords(source){
  const declarations=rustSourceDeclarations(source),records=[];
  for(const declaration of declarations.typeDeclarations)if(declaration.owners.length===0)records.push({start:declaration.declarationStart,end:declaration.declarationEnd,key:`${declaration.namespace.join("::")}::${declaration.name}`});
  for(const declaration of declarations.enumDeclarations)if(declaration.name!==null&&declaration.owners.length===0)records.push({start:declaration.start,end:declaration.end,key:`${declaration.namespace.join("::")}::${declaration.name}`});
  for(const alias of declarations.typeAliases)if(alias.owners.length===0)records.push({start:alias.declarationStart,end:alias.declarationEnd,key:`${alias.namespace.join("::")}::${alias.name}`});
  return records.sort((left,right)=>left.start-right.start)
}
function preferNearestTargetEnums(source){
  const declarations=rustSourceDeclarations(source),target=declarations.typeDeclarations.find(declaration=>/\bstatic\s+constexpr\s+int\s+rackWebParamCount\b/.test(source.slice(declaration.bodyStart,declaration.bodyEnd)));
  if(!target)return source;
  const sameNamespace=namespace=>namespace.length===target.namespace.length&&namespace.every((part,index)=>part===target.namespace[index]),groups=new Map;
  for(const declaration of declarations.enumDeclarations){
    if(declaration.name===null||declaration.start>=target.start||declaration.owners.length||!sameNamespace(declaration.namespace))continue;
    const records=groups.get(declaration.name)??[];
    records.push({start:declaration.start,end:declaration.end});
    groups.set(declaration.name,records);
  }
  const removals=[];
  for(const records of groups.values())if(records.length>1)removals.push(...records.slice(0,-1).map(record=>[record.start,record.end]));
  for(const [start,end] of removals.sort((left,right)=>right[0]-left[0]))source=source.slice(0,start)+source.slice(end);
  return source
}
function dedupeTypeDefinitions(source,seen){const ranges=[];for(const record of qualifiedTypeDefinitionRecords(source)){if(seen.has(record.key))ranges.push([record.start,record.end]);else seen.add(record.key)}for(const [start,end] of ranges.reverse())source=source.slice(0,start)+source.slice(end);return stripPluginInitFunctions(source)}
const rackUiRegex=/\b(?:(?!TLight\b)[A-Z][A-Za-z0-9_]*(?:Widget|Display|Diagram|Knob|Port|Switch|Button|Light|Screw|Slider|MenuItem|Panel|TextField)\d*|Knob|Widget|OpaqueWidget|TransparentWidget|FramebufferWidget|ModuleWidget|ParamWidget|PortWidget|PanelBorder|DrawArgs|NVGcontext|NVGcolor|GLuint|labeledStereoPort_t|LightWidget|LedDisplay|LedDisplayChoice|LedDisplayTextField|TextField|SvgWidget|SvgKnob|SvgPanel|SvgSwitch|Tooltip|Trimpot|LightBezel|VCVLightBezel|Menu|MenuItem|MenuSeparator|Svg|Vec|TWidget|Rogan|SickoInPort|SickoOutPort|SickoTrimpot|createParam|createInput|createOutput|createMenu|currentThemeStr|modThemes|CHECKMARK)\b|\b(?:app|ui|gui|event|history)::/;
const rackUiPattern={source:rackUiRegex.source,test(source){return rackUiRegex.test(sourceWithoutCommentsAndLiterals(String(source)))}};
function hasRackUiReference(source){
  return[...sourceWithoutCommentsAndLiterals(String(source)).matchAll(new RegExp(rackUiPattern.source,"g"))]
    .some(match=>!/^(?:First|Last)(?:Knob|Slider)$/.test(match[0]))
}
function classHasDspContract(definition){
  if(/\bdsp::(?:SchmittTrigger|BooleanTrigger|PulseGenerator|ClockDivider|Timer|TSchmittTrigger|TTrigger)\b/.test(definition))return true;
  if(/\b(?:process|step|jsonSave|jsonLoad|next)\s*\(/.test(definition))return true;
  if(!/\b(?:Widget|DrawArgs|NVGcontext|NVGcolor|nvg[A-Z]\w*|createParam|createInput|createOutput)\b/.test(definition)&&/\b(?:get|set)[A-Z][A-Za-z0-9_]*\s*\(/.test(definition)&&/\b(?:bool|float|double|int|unsigned)\s+[A-Za-z_]\w*/.test(definition))return true;
  if(/\b(?:bool|float|double|int|unsigned)\s+[A-Za-z_]\w*/.test(definition)&&/\b(?:apply|advance|calculate|compute|initialize|reset|select|update|validate)[A-Za-z0-9_]*\s*\(/.test(definition))return true;
  return/\b(?:config|initialize|update)\s*\(/.test(definition)&&/\b(?:Module|Input|Output|Param|GateTriggerReceiver|SchmittTrigger|PulseGenerator|Filter|Oscillator|bool|float|double|int|unsigned)\b/.test(definition);
}
function uiClassDefinition(definition,name){const header=definition.slice(0,definition.indexOf("{")),baseHeader=header.replace(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`),""),dspContract=classHasDspContract(definition),visualContract=/\b(?:GLuint|FramebufferWidget|t_img_ptr)\b|\bNVGcontext\b|\bnvg[A-Z]\w*\s*\(|\b(?:svg_file|load_svg|createParam(?:Centered)?|addParam)\b/.test(definition),uiPointerContract=/\b[A-Za-z_]\w*(?:Label|TextTag)\s*\*/.test(definition),uiName=/(?:Widget|Display|Diagram|Knob|Port|Switch|Button|Light|Screw|Slider|MenuItem|Panel)$/.test(name);return rackUiPattern.test(baseHeader)||uiPointerContract||(!dspContract&&(uiName||rackUiPattern.test(definition)||visualContract))}
function configHelperClasses(source){const names=declaredTypeNames(source),helpers=new Set(names.filter(name=>{const definition=classDefinitionSource(source,name);return definition&&/\bstatic\b[\s\S]*?\bconfig\s*\(/.test(definition)}));for(let pass=0;pass<names.length;pass++){const before=helpers.size;for(const name of names){if(helpers.has(name))continue;const definition=classDefinitionSource(source,name);if(definition&&declaredBases(definition,name).some(base=>helpers.has(baseTypeName(base))))helpers.add(name)}if(helpers.size===before)break}return helpers}
function uiClassClosure(source){const names=declaredTypeNames(source),configHelpers=configHelperClasses(source),ui=new Set(names.filter(name=>{const definition=classDefinitionSource(source,name);return definition&&!configHelpers.has(name)&&uiClassDefinition(definition,name)}));for(let pass=0;pass<names.length;pass++){const before=ui.size;for(const name of names){if(ui.has(name)||configHelpers.has(name))continue;const definition=classDefinitionSource(source,name),bases=definition?declaredBases(definition,name):[],rackModule=bases.some(rackModuleBase),uiReference=definition&&[...ui].some(uiName=>new RegExp(`\\b${uiName.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`).test(definition)),uiPointerBridge=definition&&[...ui].some(uiName=>new RegExp(`\\b${uiName.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*\\*`).test(definition));if(definition&&!rackModule&&((!classHasDspContract(definition)&&(bases.some(base=>ui.has(baseTypeName(base)))||uiReference))||uiPointerBridge))ui.add(name)}if(ui.size===before)break}return ui}
function stripUnusedQualifiedUsingDeclarations(source){
  let result=source;
  const pattern=/^[ \t]*using\s+(?!namespace\b)(?:[A-Za-z_]\w*::)+([A-Za-z_]\w*)\s*;[ \t]*(?:\n|$)/gm;
  for(const declaration of [...result.matchAll(pattern)].reverse()){
    const without=result.slice(0,declaration.index)+result.slice(declaration.index+declaration[0].length),code=without.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*$/gm,"");
    if(!new RegExp(`\\b${declaration[1]}\\b`).test(code))result=without
  }
  return result
}
function stripRackUiResidue(source,knownUiClasses=new Set){
  let result=source,code=sourceWithoutComments(result);
  const configHelpers=configHelperClasses(code),uiClasses=new Set([...knownUiClasses,...uiClassClosure(code)]),declarations=[...code.matchAll(/\b(?:struct|class)\s+([A-Za-z_]\w*)(?:\s+final)?\s*:\s*([^\{]+)\{/g)].map(match=>({name:match[1],bases:match[2]}));
  for(const name of declaredTypeNames(code)){
    const definition=classDefinitionSource(code,name);
    if(!configHelpers.has(name)&&/(?:Widget|Display|Diagram|Knob|Port|Switch|Button|Light|Screw|Slider|MenuItem|Panel)$/.test(name)&&!(definition&&classHasDspContract(definition)))uiClasses.add(name);
    if(definition&&/\b(?:Param|Switch)Quantity\b/.test(definition.slice(0,definition.indexOf("{")))&&/\bgetDisplayValueString\s*\(/.test(definition)&&!/\b(?:getDisplayValue|setDisplayValue|getValue|setValue)\s*\(/.test(definition))uiClasses.add(name);
  }
  for(let pass=0;pass<declarations.length;pass++){const before=uiClasses.size;for(const declaration of declarations)if(!configHelpers.has(declaration.name)&&(rackUiPattern.test(declaration.bases)||declaration.bases.split(",").some(base=>uiClasses.has(baseTypeName(base)))))uiClasses.add(declaration.name);if(uiClasses.size===before)break}
  for(const name of uiClasses)result=removeClassDefinition(result,name);
  const sourceDeclarations=rustSourceDeclarations(result),ranges=[];
  for(const candidate of sourceDeclarations.freeFunctionDefinitions)if(rackUiPattern.test(candidate.signature))ranges.push([candidate.start,candidate.end]);
  for(const candidate of sourceDeclarations.outOfLineDefinitions)if(candidate.kind==="function"&&(rackUiPattern.test(candidate.signature)||uiClasses.has(candidate.owner)))ranges.push([candidate.start,candidate.end]);
  for(const candidate of sourceDeclarations.freeFunctionDeclarations)if(rackUiPattern.test(candidate.rawDeclaration))ranges.push([candidate.start,candidate.end]);
  for(const [start,end] of ranges.sort((left,right)=>right[0]-left[0]))result=result.slice(0,start)+result.slice(end);
  result=result.replace(/^\s*using\s+[A-Za-z_]\w*\s*=\s*([^;\n]+);+\s*$/gm,(line,target)=>rackUiPattern.test(target)?"":line);
  result=stripUnusedQualifiedUsingDeclarations(result);
  code=sourceWithoutComments(result);
  const orphanReturns=[];for(const match of code.matchAll(/^[ \t]*return\b[^;{}\n]*;[ \t]*(?:\n|$)/gm))if(isNamespaceScopeAt(code,match.index))orphanReturns.push([match.index,match.index+match[0].length]);for(const [start,end] of orphanReturns.reverse())result=result.slice(0,start)+result.slice(end);
  return result
}
function stripNamespaceScopeReturns(source){const code=sourceWithoutComments(source),ranges=[];for(const match of code.matchAll(/^[ \t]*return\b[^;{}\n]*;[ \t]*(?:\n|$)/gm))if(isNamespaceScopeAt(code,match.index))ranges.push([match.index,match.index+match[0].length]);for(const [start,end] of ranges.reverse())source=source.slice(0,start)+source.slice(end);return source}
function dedupeOutOfLineMethodDefinitions(source){
  const declarations=rustSourceDeclarations(source),seen=new Set,ranges=[],typeNamespaces=new Map;
  for(const declaration of declarations.typeDeclarations){
    if(!declaration.namespaceScope)continue;
    if(!typeNamespaces.has(declaration.name))typeNamespaces.set(declaration.name,new Set);
    typeNamespaces.get(declaration.name).add(declaration.namespace.join("::"));
  }
  for(const candidate of declarations.outOfLineDefinitions){
    if(candidate.kind!=="function")continue;
    const root=candidate.ownerChain[0],declaredNamespaces=typeNamespaces.get(root),currentNamespace=candidate.namespace.join("::"),canonicalNamespace=declaredNamespaces?.size===1?[...declaredNamespaces][0]:currentNamespace,key=`${canonicalNamespace}:${candidate.signature}`;
    if(seen.has(key))ranges.push([candidate.start,candidate.end]);else seen.add(key);
  }
  const merged=[];
  for(const range of [...new Map(ranges.map(value=>[value.join(":"),value])).values()].sort((left,right)=>left[0]-right[0])){
    const previous=merged.at(-1);
    if(previous&&range[0]<previous[1])previous[1]=Math.max(previous[1],range[1]);
    else merged.push([...range]);
  }
  for(const [start,end] of merged.reverse())source=source.slice(0,start)+source.slice(end);
  return source;
}
function normalizeConditionalTemplateImplementations(source){
  for(let pass=0;pass<32;pass++){
    const records=[];
    for(const candidate of rustSourceDeclarations(source).outOfLineDefinitions){
      if(candidate.kind!=="function"||candidate.callableKind!=="function")continue;
      const template=/^\s*template\s*<([^>;{}]*)>/.exec(candidate.rawDefinition),escaped=candidate.owner.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
      if(!template||!new RegExp(`\\b${escaped}\\s*<[^;{}]+>\\s*::`).test(candidate.rawDefinition))continue;
      records.push({start:candidate.start,end:candidate.end,owner:candidate.owner,specialized:!template[1].trim(),namespaces:candidate.namespace,definition:candidate.rawDefinition});
    }
    const owner=[...new Set(records.filter(record=>record.specialized).map(record=>record.owner))].find(candidate=>{
      const declaration=classDefinitionSource(source,candidate);
      return declaration&&rustSourceDeclarations(declaration).conditionalDirectives.some(directive=>directive.kind==="ifdef"&&directive.simpleMacro==="RACK_SIMD")&&records.some(record=>record.owner===candidate&&!record.specialized);
    });
    if(!owner)break;
    const generic=records.filter(record=>record.owner===owner&&!record.specialized),specialized=records.filter(record=>record.owner===owner&&record.specialized);
    const insertAt=Math.min(...generic.map(record=>record.start)),insertionNamespaces=generic.find(record=>record.start===insertAt)?.namespaces??[],sameNamespace=namespaces=>namespaces.length===insertionNamespaces.length&&namespaces.every((namespace,index)=>namespace===insertionNamespaces[index]);
    const blocks=specialized.map(record=>{if(sameNamespace(record.namespaces))return record.definition;const open=record.namespaces.map(namespace=>`namespace ${namespace} {`).join("\n"),close=record.namespaces.map(()=>"}").join("\n");return`${open}${open?"\n":""}${record.definition}${close?`\n${close}`:""}`}).join("\n\n");
    const ranges=[...generic,...specialized].map(record=>[record.start,record.end]).sort((left,right)=>left[0]-right[0]);
    let rebuilt="",cursor=0,inserted=false;
    for(const [start,end] of ranges){
      if(start<cursor){cursor=Math.max(cursor,end);continue}
      rebuilt+=source.slice(cursor,start);
      if(!inserted&&start===insertAt){rebuilt+=`${blocks}\n\n`;inserted=true}
      cursor=end;
    }
    rebuilt+=source.slice(cursor);
    if(!inserted)break;
    source=rebuilt;
  }
  return source;
}
function stripSpecializedExplicitInstantiations(source){const specializations=new Set([...source.matchAll(/\btemplate\s*<\s*>\s*[\s\S]{0,240}?\b([A-Za-z_]\w*)\s*<\s*([^;{}]+?)\s*>\s*::[A-Za-z_]\w*\s*\(/g)].map(match=>`${match[1]}<${match[2].replace(/\s+/g,"")}>`));if(!specializations.size)return source;return source.replace(/^[ \t]*template\s+(?:struct|class)\s+([A-Za-z_]\w*)\s*<\s*([^;\n]+?)\s*>\s*;[ \t]*(?:\n|$)/gm,(line,name,args)=>specializations.has(`${name}<${args.replace(/\s+/g,"")}>`)?"":line)}
function hoistLateNumericObjectMacros(source){
  const macros=rustSourceDeclarations(source).macroDefinitions.filter(candidate=>!candidate.commented&&!candidate.functionLike&&/^[+-]?(?:0[xX][0-9a-fA-F]+|\d+)(?:[uUlLfF]*)$/.test(candidate.replacement)&&new RegExp(`\\b${candidate.name}\\b`).test(sourceWithoutComments(source.slice(0,candidate.start))));
  if(!macros.length)return source;
  const definitions=[];
  for(const candidate of macros.reverse()){definitions.unshift(candidate.rawDefinition);source=source.slice(0,candidate.start)+source.slice(candidate.end)}
  const insertion=/^\s*#\s*include\s+"rack_web_export\.hpp"[^\n]*(?:\n|$)/m.exec(source);
  if(!insertion)return`${definitions.join("\n")}\n${source}`;
  const index=insertion.index+insertion[0].length;
  return`${source.slice(0,index)}${definitions.join("\n")}\n${source.slice(index)}`
}
function normalizeGeneratedImplementations(source){
  source=hoistLateNumericObjectMacros(stripSpecializedExplicitInstantiations(normalizeConditionalTemplateImplementations(stripRepeatedDefaultArgumentsOnDefinitions(dedupeFreeFunctionDefinitions(dedupeOutOfLineMethodDefinitions(source))))));
  if(/\bstruct\s+PhasorWavetable\b/.test(source)&&/\bstruct\s+PhasorWavetableData\b/.test(source))source=adaptHetrickPhasorWavetableBrowserSource(source);
  if(/\bRACK_WEB_EXPORTS\((?:MiniLab|MiniPad)\)/.test(source)&&/\bstruct\s+BaseModule\b/.test(source))source=adaptMinilabBrowserSource(source);
  if(/\bRACK_WEB_EXPORTS\(MiniPad\)/.test(source))source=adaptMinilabMiniPadBrowserSource(source);
  if(/\bRACK_WEB_EXPORTS\(WeiiiDocumenta\)/.test(source))source=adaptMadzineWeiiiDocumentaBrowserSource(source);
  if(/\bRACK_WEB_EXPORTS\(UniversalRhythm\)/.test(source))source=adaptMadzineUniversalRhythmBrowserSource(source);
  if(/\bRACK_WEB_EXPORTS\(UniRhythm\)/.test(source))source=adaptMadzineUniRhythmBrowserSource(source);
  if(/\bRACK_WEB_EXPORTS\(Launchpad\)/.test(source))source=adaptMadzineLaunchpadBrowserSource(source);
  if(/\bRACK_WEB_EXPORTS\(theKICK\)/.test(source))source=adaptMadzineTheKickBrowserSource(source);
  if(/\bRACK_WEB_EXPORTS\((?:TfVDPO|TfVCA)\)/.test(source))source=adaptTriggerFishGeneratedAdapter(source);
  return /\bclass\s+MilliSampleDelayLine\b/.test(source)&&/\bclass\s+Rotor4\b/.test(source)?adaptGpRotaryBrowserSource(source):source;
}
function musxSynthBaseDefaults(){
  const defaults=Array(82).fill(0);
  for(const id of [24,28])defaults[id]=10;
  for(const id of [44,45,49,50,59,60])defaults[id]=5;
  for(const id of [52,55])defaults[id]=1;
  defaults[73]=.5;
  for(const id of [79,81])defaults[id]=8;
  return defaults;
}
function adaptMusxSynthBrowserBody(source,sourceDir){
  const template=JSON.parse(fs.readFileSync(path.join(sourceDir,"presets","Synth","template.vcvm"),"utf8"));
  const stateJson=JSON.stringify(template.data);
  const floatLiteral=value=>Number.isInteger(Number(value))?`${Number(value)}.f`:`${Number(value)}f`;
  const paramInitializers=musxSynthBaseDefaults()
    .map((value,id)=>`    params[${id}].setValue(${floatLiteral(value)});`)
    .join("\n");
  return source
    .replace(/\bBipolarColorParamQuantity\b/g,"ParamQuantity")
    .replace('json_object_set_new(rootJ, "oversamplingRate", json_integer(oversamplingRate));','json_object_set_new(rootJ, "oversamplingRate", json_integer(newOversamplingRate));')
    .replaceAll("setOversamplingRate(oversamplingRate);","setOversamplingRate(newOversamplingRate);")
    .replace(/^[ \t]*param->(?:bipolar|color|indicatorColor|indicator)\s*=\s*[^;\n]+;\s*$/gm,"")
    .replace(/^[ \t]*param->modulatedByTooltips\.(?:clear|push_back)\s*\([^;\n]*\)\s*;\s*$/gm,"")
    .replace(/(\n[ \t]*configureDrift\(\);)(\s*\n[ \t]*})/,`$1
    json_error_t rackWebTemplateError{};
    json_t* rackWebTemplate = json_loads(R"RACKWEB(${stateJson})RACKWEB", 0, &rackWebTemplateError);
    if (rackWebTemplate) {
      dataFromJson(rackWebTemplate);
      json_decref(rackWebTemplate);
    }
${paramInitializers}$2`);
}
function adaptMindMeldEqMasterBrowserBody(source){
  const adapted=`int rackWebSelectedTrack = -1;
${source}`
    .replace(/^[ \t]*std::thread\s+worker\s*;\s*$/m,"")
    .replace(/\bEqMaster\s*\(\s*\)\s*:\s*worker\s*\(\s*&EqMaster::worker_thread\s*,\s*this\s*\)\s*\{/,"EqMaster() {")
    .replace(
      /(\b~EqMaster\s*\(\s*\)\s*\{\s*)std::unique_lock<std::mutex>\s+lk\s*\(\s*m\s*\)\s*;\s*requestStop\s*=\s*true\s*;\s*lk\.unlock\s*\(\s*\)\s*;\s*cv\.notify_one\s*\(\s*\)\s*;\s*worker\.join\s*\(\s*\)\s*;/,
      "$1",
    )
    .replace(
      /while\s*\(\s*true\s*\)\s*\{\s*std::unique_lock<std::mutex>\s+lk\s*\(\s*m\s*\)\s*;\s*while\s*\(\s*!requestWork\s*&&\s*!requestStop\s*\)\s*\{\s*cv\.wait\s*\(\s*lk\s*\)\s*;\s*\}\s*lk\.unlock\s*\(\s*\)\s*;\s*if\s*\(\s*requestStop\s*\)\s*break\s*;/,
      "if (!requestWork || requestStop) return;",
    )
    .replace(
      /(\brequestWork\s*=\s*false\s*;)\s*\}\s*\}\s*(?=\s*void\s+process\s*\()/,
      "$1\n\t}",
    )
    .replace(/\bcv\.notify_one\s*\(\s*\)\s*;/g,"worker_thread();");
  return adapted.replace(
    /(\bvoid\s+process\s*\(\s*const\s+ProcessArgs\s*&\s*args\s*\)\s*override\s*\{\s*int\s+selectedTrack\s*=\s*getSelectedTrack\s*\(\s*\)\s*;)/,
    `$1
    if (rackWebSelectedTrack != selectedTrack) {
      params[TRACK_ACTIVE_PARAM].setValue(trackEqs[selectedTrack].getTrackActive() ? 1.f : 0.f);
      params[TRACK_GAIN_PARAM].setValue(trackEqs[selectedTrack].getTrackGain());
      for (int band = 0; band < 4; ++band) {
        params[FREQ_ACTIVE_PARAMS + band].setValue(trackEqs[selectedTrack].getBandActive(band) >= .5f ? 1.f : 0.f);
        params[FREQ_PARAMS + band].setValue(trackEqs[selectedTrack].getFreq(band));
        params[GAIN_PARAMS + band].setValue(trackEqs[selectedTrack].getGain(band));
        params[Q_PARAMS + band].setValue(trackEqs[selectedTrack].getQ(band));
      }
      params[LOW_PEAK_PARAM].setValue(trackEqs[selectedTrack].getLowPeak() ? 1.f : 0.f);
      params[HIGH_PEAK_PARAM].setValue(trackEqs[selectedTrack].getHighPeak() ? 1.f : 0.f);
      rackWebSelectedTrack = selectedTrack;
    }
    TrackEq& rackWebTrack = trackEqs[selectedTrack];
    rackWebTrack.setTrackActive(params[TRACK_ACTIVE_PARAM].getValue() >= .5f);
    rackWebTrack.setTrackGain(params[TRACK_GAIN_PARAM].getValue());
    for (int band = 0; band < 4; ++band) {
      rackWebTrack.setBandActive(band, params[FREQ_ACTIVE_PARAMS + band].getValue());
      rackWebTrack.setFreq(band, params[FREQ_PARAMS + band].getValue());
      rackWebTrack.setGain(band, params[GAIN_PARAMS + band].getValue());
      rackWebTrack.setQ(band, params[Q_PARAMS + band].getValue());
    }
    rackWebTrack.setLowPeak(params[LOW_PEAK_PARAM].getValue() >= .5f);
    rackWebTrack.setHighPeak(params[HIGH_PEAK_PARAM].getValue() >= .5f);`,
  );
}
function adaptMinilabMiniLogBrowserBody(source){
  if(!/\bvoid\s+processMessage\s*\(\s*midi::Message\s*&\s*\w*\s*\)\s*;/.test(source))return source;
  return`${source}
  static constexpr int rackWebLogRows = 27;
  static constexpr int rackWebLogColumns = 128;
  std::array<float, 1 + rackWebLogRows * (rackWebLogColumns + 1)> rackWebLogVisual{};
  bool rackWebDirectMidi = false;

  void rackWebPushMidi(int size, int status, int data1, int data2) override {
    midi::Message message;
    message.setSize(std::clamp(size, 1, 3));
    message.bytes[0] = static_cast<uint8_t>(status & 0xff);
    if (message.bytes.size() > 1) message.bytes[1] = static_cast<uint8_t>(data1 & 0x7f);
    if (message.bytes.size() > 2) message.bytes[2] = static_cast<uint8_t>(data2 & 0x7f);
    rackWebDirectMidi = true;
    processMessage(message);
    adjustLight(true);
  }

  int rackWebVisualCount() const override { return static_cast<int>(rackWebLogVisual.size()); }
  float* rackWebVisualBuffer() override {
    rackWebLogVisual.fill(0.f);
    const size_t count = std::min<size_t>(messages.size(), rackWebLogRows);
    rackWebLogVisual[0] = static_cast<float>(count);
    for (size_t row = 0; row < count; row++) {
      const std::string& message = messages.data[(messages.end - count + row) % 512];
      const size_t length = std::min<size_t>(message.size(), rackWebLogColumns);
      const size_t offset = 1 + row * (rackWebLogColumns + 1);
      rackWebLogVisual[offset] = static_cast<float>(length);
      for (size_t column = 0; column < length; column++)
        rackWebLogVisual[offset + 1 + column] = static_cast<unsigned char>(message[column]);
    }
    return rackWebLogVisual.data();
  }`
}
function adaptModularMoochWolframBrowserBody(source){
  return `${source}
  static constexpr int rackWebWolframVisualSize = 93;
  std::array<float, rackWebWolframVisualSize> rackWebWolframVisual{};

  int rackWebVisualCount() const override { return rackWebWolframVisualSize; }
  void rackWebResetParam(int id, float value) override {
    if (id == SELECT_PARAM) {
      encoderReset = true;
      return;
    }
    Module::rackWebResetParam(id, value);
  }
  float* rackWebVisualBuffer() override {
    updateEngineToUiLayer();
    EngineToUiLayer* layer = engineToUiLayerPtr.load(std::memory_order_acquire);
    const int selected = rack::clamp(engineSelect, 0, NUM_ENGINES - 1);
    const int active = rack::clamp(engineIndex, 0, NUM_ENGINES - 1);
    rackWebWolframVisual.fill(0.f);
    rackWebWolframVisual[0] = menuActive ? 1.f : 0.f;
    rackWebWolframVisual[1] = miniMenuActive ? 1.f : 0.f;
    rackWebWolframVisual[2] = static_cast<float>(pageNumber);
    rackWebWolframVisual[3] = static_cast<float>(selected);
    rackWebWolframVisual[4] = static_cast<float>(active);
    rackWebWolframVisual[5] = static_cast<float>(displayStyleIndex);
    rackWebWolframVisual[6] = static_cast<float>(cellStyleIndex);
    rackWebWolframVisual[7] = static_cast<float>(slewValue);
    if (!layer)
      return rackWebWolframVisual.data();
    rackWebWolframVisual[8] = static_cast<float>(layer[selected].seed);
    const char* labels[] = {
      layer[selected].engineLabel,
      layer[active].ruleActiveLabel,
      layer[selected].ruleSelectLabel,
      layer[selected].seedLabel,
      layer[selected].modeLabel,
    };
    int offset = 9;
    for (const char* label : labels)
      for (int character = 0; character < 4; character++)
        rackWebWolframVisual[offset++] = static_cast<unsigned char>(label[character]);
    const uint64_t display = layer[active].display;
    for (int row = 0; row < 8; row++)
      for (int column = 0; column < 8; column++) {
        const int bit = (7 - row) * 8 + (7 - column);
        rackWebWolframVisual[29 + row * 8 + column] =
          ((display >> bit) & UINT64_C(1)) ? 1.f : 0.f;
      }
    return rackWebWolframVisual.data();
  }`;
}
function adaptMinilabBrowserSource(source){
  const declarations=["Resolution","Strength"].map(name=>enumDeclarationSource(source,name)).filter(Boolean);
  for(const declaration of declarations)source=source.replace(declaration,"");
  if(declarations.length)source=source.replace(
    '#include "rack_web_export.hpp"',
    `#include "rack_web_export.hpp"\n${declarations.join("\n\n")}`,
  );
  return source.replace(
    `        if (!isReady) {
            if (driverId != -1 && deviceId != -1 && channel != ControlChannel) {
                isReady = true;
            }
        } else {
            if (driverId == -1 || deviceId == -1 || channel == ControlChannel) {
                isReady = false;
            }
        }`,
    "        isReady = true;",
  );
}
function adaptMinilabMiniPadBrowserSource(source){
  return source.replace(
    `            if (leftExpander.module) {
                auto log = dynamic_cast<MiniLog*>(leftExpander.module);
                if (log) {
                    log->processMessage(msg);
                }
            }
`,
    "",
  );
}
function stubHostUiMethod(chunk,header){const signature=header.trimEnd(),beforeCall=signature.slice(0,signature.indexOf("(")).trim(),codeBeforeCall=beforeCall.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*$/gm,"").trim(),tokens=codeBeforeCall.split(/\s+/),method=tokens.at(-1)??"",returnsVoid=/^(?:(?:static|virtual|inline|constexpr)\s+)*void\b/.test(codeBeforeCall),constructor=tokens.length===1||method.startsWith("~"),body=returnsVoid||constructor?"{}":"{ return {}; }",suffix=/\boverride\b/.test(signature)?"":"";return`${signature}${body}${suffix}`}
function stripRackUiBlocks(source){const code=sourceWithoutComments(source),removals=[],uiClasses=uiClassClosure(code);let depth=0,lastBoundary=0,quote="";for(let index=0;index<code.length;index++){const current=code[index];if(quote){if(current==="\\")index++;else if(current===quote)quote="";continue}if(current==='"'||current==="'"){quote=current;continue}if(current==="{"&&depth++===0){const close=matchingBrace(code,index);if(close<0)break;const prefix=code.slice(lastBoundary,index),block=code.slice(lastBoundary,close+1),quantity=/\b(?:struct|class)\s+[A-Za-z_]\w*\s*:\s*(?:[A-Za-z_]\w*::)*(?:Param|Switch)Quantity\b/.test(prefix),classMatch=/\b(?:struct|class)\s+([A-Za-z_]\w*)\b/.exec(prefix),uiClass=classMatch&&uiClasses.has(classMatch[1]),freeFunction=/\([^;{}]*\)\s*(?:const\s*)?(?:->\s*[^{};]+)?$/.test(prefix.trim());if(!quantity&&hasRackUiReference(block)&&(uiClass||freeFunction))removals.push([lastBoundary,close+1]);lastBoundary=close+1;index=close;depth=0;continue}else if(current==="}"&&depth>0)depth--;if(depth===0&&(current===";"||current==="}"))lastBoundary=index+1}let result=source;for(const [start,end] of removals.reverse())result=result.slice(0,start)+result.slice(end);for(const name of declaredTypeNames(sourceWithoutComments(result))){const definition=classDefinitionSource(result,name);if(!definition)continue;const definitionCode=sourceWithoutComments(definition),header=definitionCode.slice(0,definitionCode.indexOf("{")),quantity=/\b(?:struct|class)\s+[A-Za-z_]\w*\s*:\s*(?:[A-Za-z_]\w*::)*(?:Param|Switch)Quantity\b/.test(header);if(!quantity&&uiClasses.has(name)){result=removeClassDefinition(result,name);continue}if(!quantity&&rackUiPattern.test(definitionCode)){const open=definition.indexOf("{"),close=definition.lastIndexOf("}"),safeBody=stripUiClassMembers(definition.slice(open+1,close));result=result.replace(definition,`${definition.slice(0,open+1)}${safeBody}\n}${definition.slice(close+1)}`)}}result=stripRackUiResidue(result,uiClasses);return result.replace(/(\bvoid\s+[A-Za-z_]\w*\s*\([^{};]*\))\s*\{\s*return\s+\{\};\s*\}/g,"$1 {}").replace(/^\s*static\s+const\s+float\b[^;\n]*(?:SVG_DPI|MM_PER_IN)[^;]*;\s*$/gm,"").replace(/^[^\n;{}]*\b[A-Za-z_]\w*(?:Widget|Display|Label)::[^\n;{}]*;+\s*$/gm,"").replace(/^[^\n;{}]*\b(?:ui::|event::|MenuItem|SvgPanel|PanelBorder|DrawArgs|NVGcontext)\b[^\n;{}]*;+\s*$/gm,"")}
function stripUiNamespaces(source){
  let result=source;
  for(let pass=0;pass<64;pass++){
    const match=/\bnamespace\s+(?:(?:[A-Za-z_]\w*)::)*(?:widgets|vcoui)\s*\{/.exec(result);
    if(match){const open=result.indexOf("{",match.index),close=matchingBrace(result,open);if(close<0)break;let end=close+1;while(/\s/.test(result[end]??""))end++;if(result[end]===";")end++;result=result.slice(0,match.index)+result.slice(end);continue}
    const closing=/\}\s*\/\/\s*namespace\s+(?:(?:[A-Za-z_]\w*)::)*(?:widgets|vcoui)\b/.exec(result);
    if(!closing)break;
    const close=result.indexOf("}",closing.index);let open=-1;
    for(let index=close-1;index>=0;index--)if(result[index]==="{"&&matchingBrace(result,index)===close){open=index;break}
    if(open<0)break;
    let end=result.indexOf("\n",closing.index);if(end<0)end=result.length;else end++;
    const guardClose=rustSourceDeclarations(result).conditionalDirectives.find(candidate=>candidate.kind==="endif"&&candidate.start>=end&&!result.slice(end,candidate.start).trim()),guardCloseLine=guardClose?completeSourceLineRange(result,guardClose.start,guardClose.end):null;if(guardCloseLine)end=guardCloseLine.end;
    result=result.slice(0,open)+result.slice(end);
  }
  return result;
}
function stripUiClassMembers(body){
  const directInlineMembers=new Map(rustInlineMemberDefinitions(body).filter(candidate=>candidate.owner==="RackWebInlineFragment"&&candidate.ownerChain.length===1).map(candidate=>[candidate.bodyStart-1,candidate]));
  let result="",start=0,index=0,quote="",lineComment=false,blockComment=false;
  while(index<body.length){
    const current=body[index],next=body[index+1];
    if(lineComment){if(current==="\n")lineComment=false;index++;continue}
    if(blockComment){if(current==="*"&&next==="/"){blockComment=false;index+=2;continue}index++;continue}
    if(quote){if(current==="\\")index+=2;else{if(current===quote)quote="";index++}continue}
    if(current==="/"&&next==="/"){lineComment=true;index+=2;continue}
    if(current==="/"&&next==="*"){blockComment=true;index+=2;continue}
    if(current==='"'||current==="'"){quote=current;index++;continue}
    if(current===";"){
      const chunk=body.slice(start,index+1),code=chunk.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*$/gm,"").trim(),dspGeometryBuffer=/\bdsp::(?:RingBuffer|DoubleRingBuffer)\s*<\s*(?:(?:math::)?Vec)\b/.test(code),declaration=/^(?:(?:inline|static|constexpr|const|volatile|mutable|unsigned|signed|long|short)\s+)*([A-Za-z_]\w*(?:::[A-Za-z_]\w*)*(?:\s*<[^;{}]+>)?(?:\s*[*&])*)\s+([A-Za-z_]\w*)/.exec(code),dspGeometryState=Boolean(declaration&&/\b(?:math::)?Vec\b/.test(declaration[1])&&[...body.matchAll(new RegExp(`\\b${declaration[2]}\\b`,"g"))].length>1),uiTypedMember=Boolean(declaration&&rackUiPattern.test(declaration[1])&&(/[*&]/.test(declaration[1])||/(?:Widget|Display|Label)$/.test(baseTypeName(declaration[1]))));
      const uiMethodDeclaration=/^(?:(?:virtual|static|inline|constexpr|explicit|friend)\s+)*(?:[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*(?:\s*<[^;{}]+>)?\s*[*&]?\s+)?[A-Za-z_~]\w*\s*\([^;{}]*\)\s*(?:const\s*)?(?:noexcept\s*)?(?:override\s*)?(?:=\s*(?:0|default|delete)\s*)?;$/.test(code);
      if(!rackUiPattern.test(code)||(!uiTypedMember&&!uiMethodDeclaration)||dspGeometryBuffer||dspGeometryState)result+=chunk;
      start=++index;
      continue
    }
    if(current==="{"){
      const inlineMember=directInlineMembers.get(index);
      if(inlineMember){
        let end=inlineMember.end;
        while(/\s/.test(body[end]??""))end++;
        if(body[end]===";")end++;
        const chunk=body.slice(inlineMember.start,inlineMember.end),headerCode=inlineMember.signature,hostUiBody=/\bAPP\s*->\s*(?:scene|event)\b|\bAPP\s*->\s*window\s*->\s*(?!getMods\s*\()|\b(?:ModuleWidget|PortWidget|CableWidget)\b/.test(sourceWithoutComments(chunk)),configMethod=inlineMember.member==="config",headerContract=headerCode.replace(new RegExp(`\\b${inlineMember.member.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b(?=\\s*\\()`),"");
        if(configMethod||!rackUiPattern.test(headerContract))result+=hostUiBody?body.slice(start,inlineMember.start)+stubHostUiMethod(chunk,headerCode):body.slice(start,end);
        start=end;
        index=end;
        continue
      }
      const close=matchingBrace(body,index);
      if(close<0)break;
      let end=close+1;
      while(/\s/.test(body[end]??""))end++;
      if(body[end]===";")end++;
      const chunk=body.slice(start,end),header=chunk.slice(0,chunk.indexOf("{")),headerCode=sourceWithoutComments(header),hostUiBody=/\bAPP\s*->\s*(?:scene|event)\b|\bAPP\s*->\s*window\s*->\s*(?!getMods\s*\()|\b(?:ModuleWidget|PortWidget|CableWidget)\b/.test(sourceWithoutComments(chunk)),quantity=/\b(?:struct|class)\s+[A-Za-z_]\w*\s*:\s*(?:[A-Za-z_]\w*::)*(?:Param|Switch)Quantity\b/.test(headerCode),configMethod=/\bconfig\s*\(/.test(headerCode),methodName=/([A-Za-z_~]\w*)\s*\([^()]*\)\s*(?:const\s*)?(?:noexcept\s*)?(?:override\s*)?$/.exec(headerCode.trim())?.[1],headerContract=methodName?headerCode.replace(new RegExp(`\\b${methodName.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b(?=\\s*\\()`),""):headerCode;
      if(quantity||configMethod||!rackUiPattern.test(headerContract))result+=hostUiBody&&headerCode.includes("(")?stubHostUiMethod(chunk,headerCode):chunk;
      start=end;
      index=end;
      continue
    }
    index++
  }
  result+=body.slice(start);
  const browserPlanarSampler=[/\bvector\s*<\s*vector\s*<\s*float\s*>\s*>\s+playBuffer\b/,/\btotalSample(?:C|Count)\b/,/\bsampleRate\b/,/\bchannels\b/,/\bsamplePos\b/,/\bvoid\s+loadSample\s*\(\s*std::string/];
  if(browserPlanarSampler.every(pattern=>pattern.test(result)))result=replaceInlineMethodBody(result,/\bvoid\s+loadSample\s*\(\s*std::string(?:\s+[A-Za-z_]\w*)?\s*\)\s*\{/,`
    loading = false;
  `);
  return result
}
const hostOnlyRuntimePattern=/\bJavascript::Runtime\b|\.toClipboard\s*\(|\.fromClipboard\s*\(|\binterop(?:Copy|Paste)Sequence(?:Notes)?\s*\(|\bappendContextMenu\s*\(|\brack::ui::|\bAPP\s*->\s*scene\b|\bAPP\s*->\s*engine\s*->\s*(?:getCableIds|getCable|addModule|removeModule|addCable|removeCable)\b|\bsettings::(?:zoom|cableOpacity|cableTension)\b|\bSimpleHTTPClient\b|\bFILE\s*\*|\b(?:rack::)?asset::user\s*\(|\b(?:rack::)?system::(?:createDirectories|remove)\s*\(|\b(?:fopen|fclose)\s*\(/;
function adaptChrysalisBrowserBody(source){
  if(!/::ChucK\s*\*\s*the_chuck\b/.test(source)||!/\bvoid\s+initChucK\s*\(/.test(source))return source;
  source=source.replace(/\bstd::atomic\s*<\s*bool\s*>\s+compileFailed\s*\{\s*false\s*\}\s*;/,match=>`${match}

  static const char *rackWebDefaultCode() {
    return R"RACKWEB(
global float Chrysalis_1;
adc.chan(0) => Gain g => JCRev rev => dac;
g => Gain feedback => DelayL delay => g;
330::ms => delay.max => delay.delay;
.99 => delay.gain;
.8 => feedback.gain;
while (true) {
  Chrysalis_1 => feedback.gain;
  second => now;
}
)RACKWEB";
  }

  std::string currentCode = rackWebDefaultCode();`);
  source=replaceInlineMethodBody(source,/\bChrysalis\s*\(\s*\)\s*\{/,`
    config(PARAMS_LEN, INPUTS_LEN, OUTPUTS_LEN, LIGHTS_LEN);
    configParam(KNOB_1, 0.f, 1.f, 0.f, "Knob 1");
    configParam(KNOB_2, 0.f, 1.f, 0.f, "Knob 2");
    configParam(KNOB_3, 0.f, 1.f, 0.f, "Knob 3");
    configParam(KNOB_4, 0.f, 1.f, 0.f, "Knob 4");
    configInput(INPUT_1, "adc 1");
    configInput(INPUT_2, "adc 2");
    configInput(INPUT_3, "adc 3");
    configInput(INPUT_4, "adc 4");
    configOutput(OUTPUT_1, "dac 1");
    configOutput(OUTPUT_2, "dac 2");
    configOutput(OUTPUT_3, "dac 3");
    configOutput(OUTPUT_4, "dac 4");
    initChucK();
    loadCode(currentCode);
  `);
  source=source.replace(/the_chuck->setParam\s*\(\s*CHUCK_PARAM_OUTPUT_CHANNELS\s*,\s*4\s*\)\s*;/,match=>`${match}
    the_chuck->setParam(CHUCK_PARAM_CHUGIN_ENABLE, 0);`).replace(/^\s*the_chuck->setParam\s*\(\s*CHUCK_PARAM_IMPORT_PATH_(?:SYSTEM|PACKAGES)[\s\S]*?\);\s*$/gm,"").replace(/^\s*the_chuck->set(?:Chout|Cherr|Stdout|Stderr)Callback\s*\([^;]+\);\s*$/gm,"");
  source=replaceInlineMethodBody(source,/\bjson_t\s*\*\s*dataToJson\s*\(\s*\)\s*override\s*\{/,`
    json_t *rootJ = json_object();
    json_object_set_new(rootJ, "code", json_string(currentCode.c_str()));
    return rootJ;
  `);
  source=replaceInlineMethodBody(source,/\bvoid\s+dataFromJson\s*\(\s*json_t\s*\*\s*[A-Za-z_]\w*\s*\)\s*override\s*\{/,`
    json_t *codeJ = json_object_get(rootJ, "code");
    if (codeJ && json_string_value(codeJ)) loadCode(json_string_value(codeJ));
  `);
  source=source.replace(/\n(\s*)void\s+loadFile\s*\(/,`
$1void loadCode(const std::string& code) {
$1  if (!chuckReady || !the_chuck) return;
$1  current_chrysalis = this;
$1  the_chuck->removeAllShreds();
$1  for (int channel = 0; channel < 4; channel++) {
$1    inBuffer[channel] = 0.f;
$1    outBuffer[channel] = 0.f;
$1  }
$1  the_chuck->run(inBuffer, outBuffer, 1);
$1  currentCode = code.empty() ? rackWebDefaultCode() : code;
$1  currentFilePath = "browser.ck";
$1  setCompilationError("");
$1  bool success = the_chuck->compileCode(currentCode, "", 1, true, nullptr, currentFilePath);
$1  compileFailed.store(!success, std::memory_order_relaxed);
$1  setCompilationError(success ? "Compiled successfully" : "Compilation failed");
$1  current_chrysalis = nullptr;
$1}

$1void loadFile(`);
  source=replaceInlineMethodBody(source,/\bvoid\s+loadFile\s*\(\s*std::string\s+[A-Za-z_]\w*\s*\)\s*\{/,`
    loadCode(currentCode);
  `);
  return replaceInlineMethodBody(source,/\bvoid\s+reloadFile\s*\(\s*\)\s*\{/,`
    loadCode(currentCode);
  `)
}
function adaptClonotribeBrowserBody(source){
  const adapted=source.replace(/(?<![:\w])dsp::/g,"::dsp::");
  if(!/\bRibbonController\s+ribbonController\s*;/.test(adapted)||!/\bDrumProcessor\s+drumProcessor\s*;/.test(adapted))return adapted;
  return adapted
    .replace(/\bRibbonController\s+ribbonController\s*;\s*/g,"")
    .replace(/(\bClonotribe\s*\(\s*\)\s*:\s*filterProcessor\s*\(\s*ms20Filter\s*\))\s*,\s*ribbonController\s*\(\s*this\s*\)/g,"$1")
}
function adaptHoyerScanningDivisionBrowserBody(source){
  if(!/\bdsp::SchmittTrigger\s+inputs\s*\[\s*8\s*\]\s*;/.test(source))return source;
  return source
    .replace(/\bdsp::SchmittTrigger\s+inputs\s*\[\s*8\s*\]\s*;/,"dsp::SchmittTrigger rackWebRatioInputs[8];")
    .replace(/\binputs\s*\[/g,"rackWebRatioInputs[")
    .replace(/\bengine\.(syncCheck|phase|scanPhase|reflectedScanPhase|lowPhase)\s*\[\s*c\s*\+\s*i\s*\]/g,"engine.$1[i]")
}
function stubHostOnlyModuleMethods(body){
  const browserBody=adaptClonotribeBrowserBody(adaptChrysalisBrowserBody(body));
  if(browserBody!==body)return adaptStbImagePointerBrowserBody(browserBody);
  const replacements=[];
  for(const candidate of rustInlineMemberDefinitions(body)){
    if(candidate.owner!=="RackWebInlineFragment"||candidate.ownerChain.length!==1||!hostOnlyRuntimePattern.test(candidate.rawDefinition))continue;
    let end=candidate.end;
    while(/\s/.test(body[end]??""))end++;
    if(body[end]===";")end++;
    const header=body.slice(candidate.start,candidate.bodyStart-1),replacement=stubHostUiMethod(candidate.rawDefinition,header)+(end>candidate.end?"\n":"");
    replacements.push({start:candidate.start,end,replacement})
  }
  let result=body;
  for(const replacement of replacements.reverse())result=result.slice(0,replacement.start)+replacement.replacement+result.slice(replacement.end);
  const portableResult=/\bcaveArray\s*\[\s*8\s*\]\s*\[\s*8\s*\]\s*\[\s*8\s*\]\s*\[\s*8\s*\]/.test(result)
    ? adaptCavianSequencerBrowserBody(result)
    : result;
  return adaptStbImagePointerBrowserBody(portableResult)
}
function stripHostHistoryStatements(body){
  const declaration=/^[ \t]*(?:(?:auto|[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*(?:Action|ParamChange)(?:\s*<[^;\n]+>)?)\s*\*\s*)([A-Za-z_]\w*)\s*=\s*new\s+[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*(?:Action|ParamChange)(?:\s*<[^;\n]+>)?\s*(?:\([^;\n]*\))?\s*;[ \t]*$/gm;
  const variables=[...body.matchAll(declaration)].map(match=>match[1]);
  let result=body.replace(declaration,"");
  for(const variable of variables)result=result.replace(new RegExp(`^[ \\t]*${variable.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*->\\s*[^;\\n]+;[ \\t]*$`,"gm"),"");
  return result.replace(/\bAPP\s*->\s*history\s*->\s*push\s*\([^;]*\);/g,"").replace(/\bAPP\s*->\s*window\s*->\s*close\s*\(\s*\)\s*;/g,"(void)0;")
}
function moveStaticDeclarationAfterStruct(source,declarationName,structName){
  const start=source.indexOf(`static const std::string ${declarationName}[`);
  const structMatch=new RegExp(`\\bstruct\\s+${structName.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b[^\\{]*\\{`).exec(source);
  if(start<0||!structMatch)return source;
  const end=namespaceStatementEnd(source,start),open=source.indexOf("{",structMatch.index),close=matchingBrace(source,open);
  if(end<0||close<0)return source;
  let structEnd=close+1;while(/[ \t]/.test(source[structEnd]??""))structEnd++;if(source[structEnd]===";")structEnd++;
  const declaration=source.slice(start,end).trim(),without=source.slice(0,start)+source.slice(end),adjustedStructEnd=structEnd-(end-start);
  return without.slice(0,adjustedStructEnd)+`\n\n${declaration}\n`+without.slice(adjustedStructEnd)
}
function adaptAlgomorphBrowserSource(source,moveLabels=true){
  source=source
    .replace(/^\s*static\s+const\s+GraphData\s+GRAPH_DATA\s*;\s*$/m,"")
    .replace(/\n\s*for\s*\(\s*int\s+i\s*=\s*0\s*;\s*i\s*<\s*1980\s*;\s*i\+\+\s*\)\s*\{\s*graphAddressTranslation\s*\[\s*\(int\)GRAPH_DATA\.xNodeData\s*\[\s*i\s*\]\s*\[\s*0\s*\]\s*\]\s*=\s*i\s*;\s*\}/,"")
    .replace(/\bFMDelexanderSettings\s*\(\s*\)\s*;/,"FMDelexanderSettings() = default;")
    .replace(/(?<![:\w])pluginSettings\s*\./g,"::pluginSettings.");
  if(moveLabels)source=moveStaticDeclarationAfterStruct(source,"AuxInputModeLabels","AuxInputModes");
  return moveLabels?moveStaticDeclarationAfterStruct(source,"AuxKnobModeLabels","AuxKnobModes"):source
}
function edgeWcoWaveBank(sourceDir){
  const waves=[];
  for(let wave=0;wave<64;wave++){
    const file=path.join(sourceDir,"res","waves",`${String(wave).padStart(2,"0")}.wav`),buffer=fs.readFileSync(file);
    if(buffer.toString("ascii",0,4)!=="RIFF"||buffer.toString("ascii",8,12)!=="WAVE")fail(`Edge WCO wave ${wave} is not RIFF/WAVE`);
    let format,data;
    for(let offset=12;offset+8<=buffer.length;){
      const id=buffer.toString("ascii",offset,offset+4),size=buffer.readUInt32LE(offset+4),start=offset+8;
      if(id==="fmt ")format={code:buffer.readUInt16LE(start),channels:buffer.readUInt16LE(start+2),bits:buffer.readUInt16LE(start+14)};
      if(id==="data")data=buffer.subarray(start,start+size);
      offset=start+size+(size&1);
    }
    if(format?.code!==1||format.channels!==1||format.bits!==16||!data||data.length<512)fail(`Edge WCO wave ${wave} must contain 256 mono PCM16 frames`);
    const samples=Array.from({length:256},(_,index)=>data.readInt16LE(index*2)),peak=Math.max(...samples.map(Math.abs));
    if(!peak)fail(`Edge WCO wave ${wave} is silent`);
    waves.push(samples.map(sample=>sample/peak));
  }
  return waves
}
function adaptEdgeWcoBrowserSource(source,sourceDir,waveBank=edgeWcoWaveBank(sourceDir)){
  const match=/\bvoid\s+WCO_Osc::LoadWaves\s*\(\s*\)\s*\{/.exec(source);
  if(!match)return source;
  const open=source.indexOf("{",match.index),close=matchingBrace(source,open);
  if(close<0)return source;
  const literal=value=>Object.is(value,-0)?"0":Number(value.toFixed(9)).toString(),bank=`static const float rackWebEdgeWcoWaves[${waveBank.length}][${waveBank[0]?.length??0}] = {\n${waveBank.map(wave=>`  {${wave.map(literal).join(",")}}`).join(",\n")}\n};\n\n`,
    replacement=`void WCO_Osc::LoadWaves() {\n    for (int waveIndex = 0; waveIndex < ${waveBank.length}; waveIndex++)\n        for (int sampleIndex = 0; sampleIndex < ${waveBank[0]?.length??0}; sampleIndex++)\n            wave[waveIndex][sampleIndex] = rackWebEdgeWcoWaves[waveIndex][sampleIndex];\n    tab_loaded = true;\n}`;
  return(source.slice(0,match.index)+bank+replacement+source.slice(close+1))
    .replace(/\bstd::string\s+plug_directory\s*=\s*asset::plugin\s*\(\s*pluginInstance\s*,\s*"res\/waves\/"\s*\)\s*;/,"std::string plug_directory;");
}
function edgeKRushWaveBank(sourceDir){
  const waves=[];
  for(let wave=0;wave<64;wave++){
    const file=path.join(sourceDir,"res","waves2",`${String(wave).padStart(2,"0")}.wav`),buffer=fs.readFileSync(file);
    if(buffer.toString("ascii",0,4)!=="RIFF"||buffer.toString("ascii",8,12)!=="WAVE")fail(`Edge K_Rush wave ${wave} is not RIFF/WAVE`);
    let format,data;
    for(let offset=12;offset+8<=buffer.length;){
      const id=buffer.toString("ascii",offset,offset+4),size=buffer.readUInt32LE(offset+4),start=offset+8;
      if(id==="fmt ")format={code:buffer.readUInt16LE(start),channels:buffer.readUInt16LE(start+2),bits:buffer.readUInt16LE(start+14)};
      if(id==="data")data=buffer.subarray(start,start+size);
      offset=start+size+(size&1);
    }
    if(format?.code!==1||format.channels!==1||format.bits!==16||!data||data.length<512)fail(`Edge K_Rush wave ${wave} must contain 256 mono PCM16 frames`);
    waves.push(Array.from({length:256},(_,index)=>data.readInt16LE(index*2)/65536));
  }
  return waves
}
function adaptEdgeKRushBrowserSource(source,sourceDir,waveBank=edgeKRushWaveBank(sourceDir)){
  const structMatch=/\bstruct\s+Diode\s*\{/.exec(source),methodMatch=/\bvoid\s+LoadWaves\s*\(\s*\)\s*\{/.exec(source);
  if(!structMatch||!methodMatch)return source;
  const open=source.indexOf("{",methodMatch.index),close=matchingBrace(source,open);
  if(close<0)return source;
  const literal=value=>Object.is(value,-0)?"0":Number(value.toFixed(9)).toString(),
    bank=`static const float rackWebEdgeKRushWaves[${waveBank.length}][${waveBank[0]?.length??0}] = {\n${waveBank.map(wave=>`  {${wave.map(literal).join(",")}}`).join(",\n")}\n};\n\n`,
    replacement=`void LoadWaves() {\n        for (int waveIndex = 0; waveIndex < ${waveBank.length}; waveIndex++)\n            for (int sampleIndex = 0; sampleIndex < ${waveBank[0]?.length??0}; sampleIndex++)\n                wave[waveIndex][sampleIndex] = rackWebEdgeKRushWaves[waveIndex][sampleIndex];\n        tab_loaded = true;\n    }`;
  const withMethod=source.slice(0,methodMatch.index)+replacement+source.slice(close+1);
  return(withMethod.slice(0,structMatch.index)+bank+withMethod.slice(structMatch.index))
    .replace(/\bstd::string\s+plug_directory\s*=\s*asset::plugin\s*\(\s*pluginInstance\s*,\s*"res\/waves2\/"\s*\)\s*;/,"std::string plug_directory;")
    .replace(/\bint\s+index\s*=\s*in\s*\*\s*255\s*;/,"type = clamp(type, 0.0f, 15.0f);\n            int index = static_cast<int>(clamp(std::abs(in) * 255.0f, 0.0f, 255.0f));")
    .replace(/\bif\s*\(\s*d_pos\.first_alg\s*\)\s*d_pos\.first_alg\s*=\s*json_integer_value\s*\(\s*first_algJ\s*\)\s*;/,"if (first_algJ) d_pos.first_alg = json_integer_value(first_algJ);");
}
function inlineMemberDefinitionMatching(source,pattern){for(const candidate of rustInlineMemberDefinitions(source)){pattern.lastIndex=0;if(pattern.test(candidate.rawDefinition))return candidate}return null}
function replaceInlineMethodBody(source,pattern,body){const candidate=inlineMemberDefinitionMatching(source,pattern);return candidate?source.slice(0,candidate.bodyStart)+body+source.slice(candidate.bodyEnd):source}
function appendInlineMethodStatement(source,pattern,statement){const candidate=inlineMemberDefinitionMatching(source,pattern);return candidate?source.slice(0,candidate.bodyEnd)+`\n        ${statement}\n    `+source.slice(candidate.bodyEnd):source}
function adaptNativeUiBackedExpressionFields(source,uiPointerNames=[]){
  if(!uiPointerNames.includes("fields")||!/\bbool\s+fieldsLoaded\s*=\s*false\s*;/.test(source)||!/\bvoid\s+processStrings\s*\(\s*\)/.test(source))return source;
  let result=source.replace(/\bbool\s+fieldsLoaded\s*=\s*false\s*;/,"bool fieldsLoaded = true;");
  if(/\bvoid\s+dataFromJson\s*\([^)]*\)\s*(?:override\s*)?\{/.test(result)&&/\btexts\s*\[/.test(result))result=appendInlineMethodStatement(result,/\bvoid\s+dataFromJson\s*\([^)]*\)\s*(?:override\s*)?\{/,"processStrings();");
  return result
}
function adaptStbImagePointerBrowserBody(source){
  const contract=[/\bunsigned\s+char\s*\*\s*imageData\b/,/\bint\s+imageWidth\b/,/\bint\s+imageHeight\b/,/\breadPixelAtPlayhead\s*\(/,/\bstbi_load\s*\(/];
  if(!contract.every(pattern=>pattern.test(source)))return source;
  let result=replaceInlineMethodBody(source,/\bvoid\s+loadImage\s*\(\s*const\s+std::string\s*&\s*[A-Za-z_]\w*\s*\)\s*\{/,`
        (void)0;
        requestLoadDialog = false;
    `);
  result=replaceInlineMethodBody(result,/\bvoid\s+loadImageDialog\s*\(\s*\)\s*\{/,`
        requestLoadDialog = false;
    `);
  return result.replace(/\bstbi_image_free\s*\(\s*imageData\s*\)/g,"std::free(imageData)")
}
function prependInlineMethodBody(source,pattern,prefix){const candidate=inlineMemberDefinitionMatching(source,pattern);return candidate?source.slice(0,candidate.bodyStart)+prefix+source.slice(candidate.bodyStart):source}
function adaptCavianSequencerBrowserBody(source){
  source=source.replace(/\bdsp::SchmittTrigger\s+swingRandomizeTrigger\s*;/,match=>`${match}
    dsp::SchmittTrigger rackWebStepTriggers[64];
    dsp::SchmittTrigger rackWebMuteTriggers[8];`);
  return prependInlineMethodBody(source,/\bvoid\s+process\s*\(\s*const\s+ProcessArgs\s*&\s*\w+\s*\)\s*override\s*\{/,`
        for (int rackWebButton = 0; rackWebButton < 64; rackWebButton++) {
            if (!rackWebStepTriggers[rackWebButton].process(params[STEP_BUTTONS + rackWebButton].getValue())) continue;
            int row = rackWebButton / 8;
            int col = rackWebButton % 8;
            if (viewMode == VERTICAL) {
                if (row == 0 && col == 5) groupLoopEnabled = !groupLoopEnabled;
                else if (row == 0 && col == 6) setLoopEnabled = !setLoopEnabled;
                else if (row == 0 && col == 7) presetLoopEnabled = !presetLoopEnabled;
                else if (row == 1 && col == 5) { copyActive = true; pasteActive = false; clearArmed = false; copyType = NONE; copySourceIndex = -1; }
                else if (row == 1 && col == 6) { if (copyType != NONE && copySourceIndex >= 0) pasteActive = !pasteActive; copyActive = false; clearArmed = false; }
                else if (row == 1 && col == 7) { clearArmed = !clearArmed; copyActive = false; pasteActive = false; }
                else if (row == 2 && col == 5) randomArmed = !randomArmed;
                else if (setLoopEnabled && col == 0) groupLoopArray[row] = !groupLoopArray[row];
                else if (setLoopEnabled && col == 1) presetLoopArray[activeGroup][row] = !presetLoopArray[activeGroup][row];
                else if (copyActive && copyType == NONE && col == 0) { copyType = GROUP_COPY; copySourceIndex = row; copyGroup(row); copyActive = false; }
                else if (copyActive && copyType == NONE && col == 1) { copyType = PRESET_COPY; copySourceIndex = row; copyPreset(row); copyActive = false; }
                else if (copyActive && copyType == NONE && col == 3) { copyType = CHANNEL_COPY; copySourceIndex = row; copyChannel(row); copyActive = false; }
                else if (pasteActive && copyType == GROUP_COPY && col == 0) { pasteGroup(row); activeGroup = row; pasteActive = false; }
                else if (pasteActive && copyType == PRESET_COPY && col == 1) { pastePreset(row); activePreset = row; pasteActive = false; }
                else if (pasteActive && copyType == CHANNEL_COPY && col == 3) { pasteChannel(row); activeChannel = row; pasteActive = false; }
                else if (clearArmed && col == 0) { clearGroup(row); clearArmed = false; }
                else if (clearArmed && col == 1) { clearPreset(row); clearArmed = false; }
                else if (clearArmed && col == 3) { clearChannel(row); clearArmed = false; }
                else if (randomArmed && col == 0) { randomGroup(row); randomArmed = false; }
                else if (randomArmed && col == 1) { randomPreset(row); randomArmed = false; }
                else if (randomArmed && col == 3) { randomChannel(row); randomArmed = false; }
                else if (col == 0) activeGroup = row;
                else if (col == 1) { presetCascade = row == activePreset ? !presetCascade : false; activePreset = row; }
                else if (col == 2) { uint8_t& value = caveArray[activeGroup][activePreset][activeChannel][row]; if (presetCascade) cascadeStep(row); else value = value == 0 ? 1 : value == 1 ? 9 : 0; }
                else if (col == 3) activeChannel = row;
                else if (col == 4) muteChannel[row] = !muteChannel[row];
            }
            else {
                uint8_t* cell = viewMode == HORIZONTAL_8X8 ? &caveArray[activeGroup][activePreset][row][col] : &caveArray[activeGroup][row][activeChannel][col];
                *cell = *cell == 0 ? 1 : *cell == 1 ? 9 : 0;
            }
            markPatternModified();
        }
        for (int rackWebMute = 0; rackWebMute < 8; rackWebMute++) {
            if (rackWebMuteTriggers[rackWebMute].process(params[MUTE_BUTTONS + rackWebMute].getValue()))
                muteChannel[rackWebMute] = !muteChannel[rackWebMute];
        }
    `)
}
function removeFreeFunction(source,name){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),signature=new RegExp(`^(?:(?:inline|static)\\s+)*(?:void|bool|int|float|double|std::string)\\s+${escaped}\\s*\\(`),candidate=rustSourceFreeFunctionDefinitions(source).find(definition=>definition.name===name&&signature.test(definition.signature));return candidate?source.slice(0,candidate.start)+source.slice(candidate.end):source}
function removeQualifiedFreeFunction(source,name){const candidate=rustSourceFreeFunctionDefinitions(source).find(definition=>definition.name===name);return candidate?source.slice(0,candidate.start)+source.slice(candidate.end):source}
function adaptLintBuddyBrowserBody(source){
  let result=source.replace(/^\s*currentTest\s*=\s*std::make_unique<[^;]+;\s*$/m,"").replace(/^\s*std::unique_ptr<\s*LintBuddyTest\s*>\s+currentTest\s*;\s*$/m,"");
  result=replaceInlineMethodBody(result,/\bvoid\s+rerun\s*\(\s*\)\s*\{/,`
        updateCount++;
    `);
  result=replaceInlineMethodBody(result,/\bvoid\s+updateCurrentTarget\s*\(\s*Module\s*\*\s*\w+\s*\)\s*\{/,`
        currentTarget = nullptr;
        currentTargetName = "Browser patch";
        info.clear();
        warnings.clear();
        info.push_back("Native Rack patch inspection is unavailable in the browser host.");
        updateCount++;
    `);
  return replaceInlineMethodBody(result,/\bvoid\s+process\s*\(\s*const\s+ProcessArgs\s*&\s*\w+\s*\)\s*override\s*\{/,`
        wasOutConnected = outputs[THE_OUT_PROBE].isConnected();
        wasInConnected = inputs[THE_IN_PROBE].isConnected();
    `)
}
function stripLintBuddyBrowserPrelude(source){for(const name of ["LintBuddyTest","EverythingHasAName","ProbeBypass","JSONToInfo","WidgetPositions","GotAnyWhiteLists","MyPatch"])source=removeClassDefinition(source,name);return source}
function adaptDailyFortuneHost(source){
  source=source.replace(/^[ \t]*#\s*define[ \t]+(?:STRUCT_NAME|WIDGET_NAME|MODEL_NAME|MODULE_NAME)\b[^\n]*$/gm,"");
  if(!/\bbool\s+readTodaysFortune\s*\(\s*\)\s*\{/.test(source)||!/\btodaysFortuneDate\b/.test(source))return source;
  let result=removeFreeFunction(source,"downloadTodaysFortune");
  result=replaceInlineMethodBody(result,/\bbool\s+readTodaysFortune\s*\(\s*\)\s*\{/,`
        uint32_t seed = 2166136261u;
        for (unsigned char value : todaysFortuneDate) seed = (seed ^ value) * 16777619u;
        auto nextFortuneValue = [&seed]() {
            seed = seed * 1664525u + 1013904223u;
            return seed;
        };
        arcana = int(nextFortuneValue() % 22u);
        bpm = 60 + int(nextFortuneValue() % 121u);
        wish = int(nextFortuneValue() % 4u);
        for (size_t i = 0; i < patternB.size(); i++) {
            patternB[i] = (nextFortuneValue() & 1u) != 0u;
            patternC[i] = (nextFortuneValue() & 1u) != 0u;
            patternD[i] = (nextFortuneValue() & 1u) != 0u;
            patternE[i] = (nextFortuneValue() & 1u) != 0u;
        }
        size_t enabledNotes = 0;
        for (size_t i = 0; i < scale.size(); i++) {
            scale[i] = (nextFortuneValue() & 3u) != 0u;
            if (scale[i]) enabledNotes++;
        }
        if (enabledNotes == 0) scale[0] = true;
        size_t noteIndex = 0;
        for (size_t pitch = 0; pitch < scale.size() && noteIndex < notePattern.size(); pitch++) {
            if (scale[pitch]) notePattern[noteIndex++] = int(pitch);
        }
        while (noteIndex < notePattern.size()) {
            notePattern[noteIndex] = notePattern[noteIndex % std::max<size_t>(size_t(1), enabledNotes)];
            noteIndex++;
        }
        for (size_t i = 0; i < scale.size(); i++) lcdStatus.pianoDisplay[i] = scale[i];
        jsonParsed = true;
        return true;
    `);
  result=replaceInlineMethodBody(result,/\bvoid\s+onReset\s*\(\s*\)\s*override\s*\{/,`
        todaysFortuneDate = getCurrentFortuneDate();
        jsonParsed = readTodaysFortune();
    `);
  result=replaceInlineMethodBody(result,/(?:^|\n)[ \t]*ArcaneBase\s*\(\s*\)\s*\{/m,`
        readJsonDivider.setDivision(100000);
        refreshDivider.setDivision(128);
        expanderDivider.setDivision(512);
        if (!ariaSalvatriceArcaneSingletonOwned) {
            ariaSalvatriceArcaneSingletonOwned = true;
            owningSingleton = true;
        }
        jsonParsed = readTodaysFortune();
    `);
  return result
}
function dedupeDailyFortunePrelude(source,existing){if(!/\bariaSalvatriceArcaneSingletonOwned\b/.test(existing))return source;return removeFreeFunction(source.replace(/^[ \t]*static\s+bool\s+ariaSalvatriceArcaneSingletonOwned\s*=\s*false\s*;[ \t]*$/m,""),"getCurrentFortuneDate")}
function paramQuantityHelpers(source,targetBody){const found=[];for(const declaration of rustSourceDeclarations(source).typeDeclarations){const {name}=declaration;if(declaration.kind!=="struct"||!declaration.namespaceScope||declaration.bases.length!==1||baseTypeName(declaration.bases[0])!=="ParamQuantity"||!new RegExp(`\\b${name}\\b`).test(targetBody))continue;found.push({name,source:source.slice(declaration.declarationStart,declaration.declarationEnd)})}return found}
function modulePrelude(source,className,typeDeclaration=null){const name=baseTypeName(className),declaration=rustTypeBody(source,typeDeclaration)!==null?typeDeclaration:rustSourceTypeDeclaration(source,className);if(!declaration)return"";let prelude=withoutNonDefinePreprocessorDirectives(source.slice(0,declaration.declarationStart)).trim(),namespaces=declaration.namespace,combined=namespaces.join("::");if(combined)prelude=prelude.replace(new RegExp(`\\bnamespace\\s+${combined.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\$&")}\\s*\\{`),"");for(const namespaceName of namespaces)prelude=prelude.replace(new RegExp(`\\bnamespace\\s+${namespaceName}\\s*\\{`),"");const unclosedAnonymous=[];for(const namespaceMatch of prelude.matchAll(/\bnamespace\s*\{/g)){const open=prelude.indexOf("{",namespaceMatch.index);if(matchingBrace(prelude,open)<0)unclosedAnonymous.push([namespaceMatch.index,open+1])}for(const [start,end] of unclosedAnonymous.reverse())prelude=prelude.slice(0,start)+prelude.slice(end);let depth=0,quote="",lineComment=false,blockComment=false;for(let index=0;index<prelude.length;index++){const current=prelude[index],next=prelude[index+1];if(lineComment){if(current==="\n")lineComment=false;continue}if(blockComment){if(current==="*"&&next==="/"){blockComment=false;index++}continue}if(quote){if(current==="\\")index++;else if(current===quote)quote="";continue}if(current==="/"&&next==="/"){lineComment=true;index++;continue}if(current==="/"&&next==="*"){blockComment=true;index++;continue}if(current==='"'||current==="'"){quote=current;continue}if(current==="{")depth++;else if(current==="}"&&--depth<0)return""}if(depth!==0)return"";const adapted=adaptDailyFortuneHost(prelude);return name==="ArcaneBase"?dedupeDailyFortunePrelude(adapted,"ariaSalvatriceArcaneSingletonOwned getCurrentFortuneDate"):adapted}
function namespacedModulePrelude(source,className){
  const declaration=rustSourceTypeDeclaration(source,className);
  if(!declaration)return"";
  let prelude=withoutNonDefinePreprocessorDirectives(source.slice(0,declaration.declarationStart)).trim();
  const namespaceDepth=namespaceBraceDepthAt(prelude,prelude.length);
  if(namespaceDepth)prelude+=`\n${Array.from({length:namespaceDepth},()=>"}").join("\n")}`;
  return adaptDailyFortuneHost(prelude)
}
function resolvedRawIncludeTarget(sourceDir,importer,directive){if(directive.target)return directive.target;const root=path.resolve(sourceDir),prefix=`${root}${path.sep}`,normalized=directive.include.split(/[\\/]+/).join(path.sep);return[path.resolve(path.dirname(importer),normalized),path.resolve(root,normalized),path.resolve(root,"src",normalized)].find(candidate=>(candidate===root||candidate.startsWith(prefix))&&fs.existsSync(candidate)&&fs.statSync(candidate).isFile())}
function headerGuardNames(source){return new Set(rustSourceDeclarations(source).headerGuards.map(candidate=>candidate.name))}
function referencedDefines(sourceFiles,analysis,sourceDir=""){let searchable=sourceWithoutComments(analysis);const defined=new Set(rustMacroDefinitionBlocks(searchable).map(candidate=>candidate.name)),enumIdentifiers=new Set([...searchable.matchAll(/\benum(?:\s+(?:class|struct))?(?:\s+[A-Za-z_]\w*)?\s*\{([\s\S]*?)\}/g)].flatMap(match=>splitArguments(match[1]).map(entry=>/^\s*([A-Za-z_]\w*)/.exec(entry)?.[1]).filter(Boolean))),templateIdentifiers=new Set([...searchable.matchAll(/\btemplate\s*<([^<>{}]*)>/g)].flatMap(match=>splitArguments(match[1]).map(parameter=>{const value=parameter.replace(/=[\s\S]*$/,"").trim(),named=/(?:^|\s)(?:typename|class)\s*(?:\.\.\.)?\s*([A-Za-z_]\w*)\s*$/.exec(value)?.[1];return named??/([A-Za-z_]\w*)\s*(?:\.\.\.)?\s*$/.exec(value)?.[1]}).filter(Boolean))),found=new Map,reserved=new Set(["INFINITY","NAN","alignas","alignof","and","and_eq","asm","auto","bitand","bitor","bool","break","case","catch","char","class","compl","concept","const","consteval","constexpr","constinit","const_cast","continue","co_await","co_return","co_yield","decltype","default","delete","do","double","dynamic_cast","else","enum","explicit","export","extern","false","float","for","friend","goto","if","inline","int","long","mutable","namespace","new","noexcept","not","not_eq","nullptr","operator","or","or_eq","private","protected","public","register","reinterpret_cast","requires","return","short","signed","sizeof","static","static_assert","static_cast","struct","switch","template","this","thread_local","throw","true","try","typedef","typeid","typename","union","unsigned","using","virtual","void","volatile","wchar_t","while","xor","xor_eq"]),externalRoots=sourceDir?repositoryRoots(sourceDir).slice(1):[],candidates=new Map,includeGuards=new Set;for(const file of sourceFiles){if(file.includes(`${path.sep}lib${path.sep}`)||externalRoots.some(root=>file.startsWith(`${root}${path.sep}`)))continue;const rawSource=fs.readFileSync(file,"utf8");for(const name of headerGuardNames(rawSource))includeGuards.add(name);const source=preprocessMacroSource(rawSource,new Map,false).source;for(const candidate of rustMacroDefinitionBlocks(source))if(!reserved.has(candidate.name)&&!includeGuards.has(candidate.name)&&!enumIdentifiers.has(candidate.name)&&!templateIdentifiers.has(candidate.name)&&!defined.has(candidate.name)&&!candidates.has(candidate.name))candidates.set(candidate.name,candidate.definition)}for(let pass=0;pass<candidates.size;pass++){let changed=false;for(const [name,definition] of candidates){if(found.has(name)||!new RegExp(`\\b${name}\\b`).test(searchable))continue;found.set(name,definition);searchable+=`\n${definition}`;changed=true}if(!changed)break}if(process.env.RACK_WEB_DEBUG_DEFINES)console.error(JSON.stringify({defined:[...defined],enumIdentifiers:[...enumIdentifiers],templateIdentifiers:[...templateIdentifiers],includeGuards:[...includeGuards],candidates:[...candidates.keys()],found:[...found.keys()]},null,2));return[...found.values()].join("\n")}
function referencedPluginGlobalParts(sourceDir,analysis){
  const file=path.join(sourceDir,"src","plugin.hpp");if(!fs.existsSync(file))return{declarations:"",implementations:""};
  const source=fs.readFileSync(file,"utf8"),sourceDeclarations=rustSourceDeclarations(source),analysisDeclarations=rustSourceDeclarations(analysis),repositoryFiles=filesOutsideNestedRepositories(sourceDir),implementationFile=path.join(sourceDir,"src","plugin.cpp"),implementationSource=fs.existsSync(implementationFile)?fs.readFileSync(implementationFile,"utf8"):"",declarations=[],implementations=[],wrapNamespaces=(declaration,namespaces)=>namespaces.length?`${namespaces.map(namespace=>`namespace ${namespace} {`).join("\n")}\n${declaration}\n${namespaces.map(()=>"}").join("\n")}`:declaration;let typeReference=analysis;
  if(rustNamespaceUsingDirectives(file,source).some(candidate=>candidate.target==="std"))declarations.push("using namespace std;");
  const enumIdentifiers=declarations=>new Set(declarations.flatMap(declaration=>declaration.identifiers.map(identifier=>typeof identifier==="string"?identifier:identifier.base))),existingAliasNames=new Set(analysisDeclarations.typeAliases.map(candidate=>candidate.name)),existingTypeNames=new Set(analysisDeclarations.typeDeclarations.map(candidate=>candidate.name)),existingEnumTypes=new Set(analysisDeclarations.enumDeclarations.map(declaration=>declaration.name).filter(Boolean)),existingEnumIdentifiers=enumIdentifiers(analysisDeclarations.enumDeclarations),selectedAliasNames=new Set,
    supportCandidates=[
      ...sourceDeclarations.typeAliases.filter(candidate=>candidate.namespaceScope).map(candidate=>({...candidate,category:"alias",declaration:candidate.rawDefinition,wrapped:candidate.definition,order:candidate.declarationStart})),
      ...sourceDeclarations.typeDeclarations.filter(candidate=>candidate.namespaceScope&&["struct","class"].includes(candidate.kind)).map(candidate=>{const declaration=source.slice(candidate.declarationStart,candidate.declarationEnd).trim();return{...candidate,category:"type",declaration,wrapped:wrapNamespaces(declaration,candidate.namespace),order:candidate.declarationStart}}),
      ...sourceDeclarations.enumDeclarations.filter(candidate=>candidate.namespaceScope).map(candidate=>{const declaration=source.slice(candidate.start,candidate.end),names=candidate.identifiers.map(identifier=>typeof identifier==="string"?identifier:identifier.base);return{...candidate,category:"enum",declaration,wrapped:wrapNamespaces(declaration,candidate.namespace),names,order:candidate.start}}),
    ].sort((left,right)=>left.order-right.order),selectedSupport=new Set;
  for(let pass=0;pass<supportCandidates.length;pass++){
    let changed=false;
    for(const candidate of supportCandidates){
      const referenceNames=candidate.category==="enum"?[candidate.name,...candidate.names].filter(Boolean):[candidate.name];
      if(selectedSupport.has(candidate)||!referenceNames.some(name=>new RegExp(`\\b${name}\\b`).test(typeReference)))continue;
      if(candidate.category==="alias"&&(existingAliasNames.has(candidate.name)||selectedAliasNames.has(candidate.name)))continue;
      if(candidate.category==="type"&&(existingTypeNames.has(candidate.name)||rackUiPattern.test(candidate.declaration)))continue;
      const selectedSupportReferencesCandidate=candidate.category==="enum"&&[...selectedSupport].some(selected=>selected!==candidate&&referenceNames.some(name=>new RegExp(`\\b${name}\\b`).test(selected.declaration)));
      if(candidate.category==="enum"&&!selectedSupportReferencesCandidate&&((candidate.name&&existingEnumTypes.has(candidate.name))||candidate.names.some(name=>existingEnumIdentifiers.has(name))))continue;
      selectedSupport.add(candidate);if(candidate.category==="alias")selectedAliasNames.add(candidate.name);typeReference+=`\n${candidate.wrapped}`;changed=true
    }
    if(!changed)break
  }
  for(const candidate of supportCandidates.filter(candidate=>selectedSupport.has(candidate))){
    declarations.push(candidate.wrapped);
    if(candidate.category==="type")implementations.push(...rawOutOfLineDefinitions(implementationFile,implementationSource,candidate.name,true,candidate.namespace).filter(definition=>!rackUiPattern.test(definition)))
  }
  const constantSources=[file,...repositoryFiles.filter(candidate=>candidate!==file&&/\.(?:h|hh|hpp)$/.test(candidate))].map((constantFile,sourceOrder)=>{const constantSource=constantFile===file?source:fs.readFileSync(constantFile,"utf8");return{file:constantFile,source:constantSource,sourceOrder}}),repositoryMacroNames=new Set(constantSources.flatMap(candidate=>rustMacroDefinitionBlocks(candidate.source).map(definition=>definition.name))),constantCandidates=constantSources.flatMap(candidate=>(rustNamespaceConstantDeclarations(candidate.file,candidate.source)??rustSourceNamespaceConstantDeclarations(candidate.source)).map((declaration,candidateOrder)=>({...declaration,key:`${candidate.sourceOrder}:${candidateOrder}`,sourceOrder:candidate.sourceOrder,candidateOrder}))),existingConstantNames=new Set(analysisDeclarations.namespaceConstantDeclarations.map(candidate=>candidate.name)),emittedConstants=new Set;
  const collectConstants=reference=>{let constantReference=sourceWithoutCommentsAndLiterals(reference);const reachable=new Set;for(let pass=0;pass<constantCandidates.length;pass++){let changed=false;for(const candidate of constantCandidates){if(emittedConstants.has(candidate.key)||reachable.has(candidate.key)||existingConstantNames.has(candidate.name)||!new RegExp(`\\b${candidate.name}\\b`).test(constantReference))continue;const qualifiedReference=candidate.namespace.some((_,index)=>new RegExp(`\\b${candidate.namespace.slice(index).join("::")}::${candidate.name}\\b`).test(constantReference));if(repositoryMacroNames.has(candidate.name)&&!qualifiedReference)continue;reachable.add(candidate.key);constantReference+=`\n${candidate.rawDeclaration}`;changed=true}if(!changed)break}const ordered=[],visiting=new Set,visited=new Set,visit=candidate=>{if(visited.has(candidate.key)||emittedConstants.has(candidate.key)||!reachable.has(candidate.key))return;if(visiting.has(candidate.key))return;visiting.add(candidate.key);for(const dependency of constantCandidates)if(dependency.name!==candidate.name&&reachable.has(dependency.key)&&new RegExp(`\\b${dependency.name}\\b`).test(candidate.rawDeclaration))visit(dependency);visiting.delete(candidate.key);visited.add(candidate.key);ordered.push(candidate)};for(const candidate of constantCandidates)visit(candidate);for(const candidate of ordered){declarations.push(candidate.definition);emittedConstants.add(candidate.key)}};
  collectConstants(analysis);
  const defaults={madzineDefaultContrast:"255.f",madzineDefaultTheme:"-1"};
  const externSources=[{file,source},...repositoryFiles.filter(candidate=>candidate!==file).map(candidate=>({file:candidate,source:fs.readFileSync(candidate,"utf8")}))];
  for(const externSource of externSources)for(const candidate of rustNamespaceVariableDeclarations(externSource.file,externSource.source)){
    if(!candidate.externDeclaration)continue;
    const {typeSource:type,name,arrayExtent:extent,cLinkage}=candidate;
    if(!new RegExp(`\\b${name}\\b`).test(analysis)||/\b(?:Model|Plugin)\s*\*$/.test(type)||namespaceGlobalDefinitions(analysis,name))continue;
    const lockedDefinition=repositoryFiles.map(candidate=>namespaceGlobalDefinitions(fs.readFileSync(candidate,"utf8"),name,[],"",candidate)).find(Boolean),linkage=cLinkage?'extern "C" ':"",definition=extent?`${linkage}inline ${type} ${name}${extent}{};`:`${linkage}inline ${type} ${name} = ${defaults[name]??"{}"};`;
    declarations.push(lockedDefinition||wrapNamespaces(definition,candidate.namespace))
  }
  // plugin.hpp often carries small DSP helpers shared by every module. Pull in
  // only helpers reached from this module's DSP source, then follow helper-to-
  // helper calls to a fixed point. Keeping this selective avoids importing the
  // neighboring NanoVG/UI helpers that commonly live in the same header.
  const helperImplementationSource=/\bvoid\s+init\s*\(\s*(?:rack::)?Plugin\s*\*/.test(implementationSource)?removeFreeFunction(implementationSource,"init"):implementationSource,helperDefinitions=new Map,helperReferences=new Map,appendHelper=candidate=>{const {name,definition,references}=candidate;if(rackUiPattern.test(definition)||/\bNVG(?:color|context)\b|\bnvg[A-Z]\w*\s*\(/.test(definition)||/\bAPP\s*->\s*(?!engine\b)/.test(definition))return;const definitions=helperDefinitions.get(name)??[];definitions.push(definition);helperDefinitions.set(name,definitions);const known=helperReferences.get(name)??new Set;for(const reference of references)known.add(reference);helperReferences.set(name,known)};
  for(const candidate of rustSourceFreeFunctionDefinitions(source))appendHelper(candidate);
  for(const candidate of rustSourceFreeFunctionDefinitions(helperImplementationSource))appendHelper(candidate);
  const helperNames=[...helperDefinitions.keys()],selected=new Set,selectedDefinitions=new Map,structuredReferences=new Set,rootReference=sourceWithoutCommentsAndLiterals([analysis,...implementations].join("\n")),existingFreeFunctionNames=new Set(rustSourceFreeFunctionDefinitions([analysis,...implementations].join("\n")).map(candidate=>candidate.name));let expanded=[analysis,...implementations].join("\n");
  for(let pass=0;pass<helperNames.length;pass++){
    let changed=false;
    for(const name of helperNames){
      const referenced=structuredReferences.has(name)||new RegExp(`\\b${name}(?:\\s*<[^;{}]+>)?\\s*(?:\\(|(?=[,);}\\]]))`).test(rootReference);
      if(selected.has(name)||existingFreeFunctionNames.has(name)||!referenced)continue;
      const definitions=helperDefinitions.get(name)??[];
      selected.add(name);changed=true;const joined=definitions.join("\n\n");selectedDefinitions.set(name,joined);expanded+=`\n${joined}`;
      for(const reference of helperReferences.get(name)??[])structuredReferences.add(reference)
    }
    if(!changed)break
  }
  for(const candidate of rustFreeFunctionDeclarations(file,source)??rustSourceFreeFunctionDeclarations(source))if(selected.has(candidate.name))declarations.push(candidate.definition);
  collectConstants(expanded);
  for(const name of helperNames)if(selectedDefinitions.has(name))implementations.push(selectedDefinitions.get(name));
  return{declarations:[...new Set(declarations)].join("\n\n"),implementations:[...new Set(implementations)].join("\n\n")}
}
function referencedPluginGlobals(sourceDir,analysis){const parts=referencedPluginGlobalParts(sourceDir,analysis);return[parts.declarations,parts.implementations].filter(Boolean).join("\n\n")}
const referencedDefinesWithoutPluginGlobals=referencedDefines;
referencedDefines=(sourceFiles,analysis,sourceDir)=>[
  referencedDefinesWithoutPluginGlobals(sourceFiles,analysis,sourceDir),
  referencedPluginGlobals(sourceDir,analysis),
].filter(Boolean).join("\n\n");
function sourceWithoutIncludes(source){
  return withoutNonDefinePreprocessorDirectives(source).replace(/(?:inline\s+)?[\w:<>&*\s]+\([^;{}]*\)\s*\{(?=[^{}]*\bAPP\s*->\s*(?!engine\b)[A-Za-z_]\w*)[^{}]*\}/g,"").trim()
}
function withoutNonDefinePreprocessorDirectives(source){let result=source;const removals=rustSourceDeclarations(source).preprocessorDirectives.filter(candidate=>candidate.commented||candidate.kind!=="define");for(const {start,end} of [...removals].reverse())result=result.slice(0,start)+result.slice(end);return result}
function flattenExternCWrappers(source){const removals=[];for(const block of rustSourceDeclarations(source).conditionalBlocks){if(block.open.kind!=="ifdef"||block.open.simpleMacro!=="__cplusplus"||!block.close)continue;const open=completeSourceLineRange(source,block.openStart,block.openEnd),close=completeSourceLineRange(source,block.closeStart,block.closeEnd);if(!open||!close)continue;const body=source.slice(open.end,close.start).trim();if(/^extern\s+"C"\s*(?:\r?\n\s*)?\{$/.test(body)||body==="}")removals.push({start:open.start,end:close.end})}let result=source;for(const {start,end} of removals.reverse())result=result.slice(0,start)+result.slice(end);return result}
function companionImplementationFile(headerFile,sourceFiles){const stem=headerFile.replace(/\.(?:hpp|hh|h)$/,""),exact=sourceFiles.find(file=>file.replace(/\.(?:cpp|cc|cxx)$/,"")===stem);if(exact)return exact;const name=path.basename(stem),matches=sourceFiles.filter(file=>/\.(?:cpp|cc|cxx)$/.test(file)&&path.basename(file,path.extname(file))===name);return matches.length===1?matches[0]:undefined}
function isolateInternalCVMidiQueue(source){const definition=classDefinitionSource(source,"CVMidi");if(!definition)return source;const isolated=definition.replace(/\bmidi::InputQueue\s+msgQueue\s*;/,"midi::InputQueue msgQueue{false};");return source.replace(definition,isolated)}
function canonicalNamespaceKey(namespaces){return namespaces.flatMap(namespace=>namespace.split("::")).join("::")}
function dedupeRepeatedTopLevelTypes(source){const seen=new Set,removals=[];for(const candidate of rustSourceDeclarations(source).typeDeclarations){if(!candidate.namespaceScope)continue;const key=`${canonicalNamespaceKey(candidate.namespace)}:${candidate.name}`;if(seen.has(key))removals.push([candidate.declarationStart,candidate.declarationEnd]);else seen.add(key)}let result=source;for(const [start,end] of removals.reverse())result=result.slice(0,start)+result.slice(end);return result}
function dedupeRepeatedTopLevelEnums(source){const seen=new Set,removals=[];for(const candidate of rustSourceDeclarations(source).enumDeclarations){if(!candidate.namespaceScope||!candidate.name)continue;const declaration=source.slice(candidate.start,candidate.end).replace(/\s+/g," ").trim(),key=`${canonicalNamespaceKey(candidate.namespace)}:${candidate.name}:${declaration}`;if(seen.has(key))removals.push([candidate.start,candidate.end]);else seen.add(key)}let result=source;for(const [start,end] of removals.reverse())result=result.slice(0,start)+result.slice(end);return result}
function dedupeRepeatedNamespaceVariables(source){const seen=new Set,removals=[];for(const candidate of rustSourceDeclarations(source).namespaceVariableDeclarations){if(/^extern\b/.test(candidate.rawDeclaration))continue;const key=`${candidate.namespace.join("::")}:${candidate.name}`;if(seen.has(key))removals.push([candidate.start,candidate.end]);else seen.add(key)}let result=source;for(const [start,end] of removals.reverse())result=result.slice(0,start)+result.slice(end);return result}
function dedupeRepeatedNamespaceConstants(source){const seen=new Set,removals=[],pattern=/^(?:(?:inline|static)\s+)*(?:constexpr\s+|const\s+)[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*(?:\s*<[^;\n]+>)?\s+([A-Za-z_]\w*)\s*=\s*([^;\n]+);$/;for(const candidate of rustSourceDeclarations(source).namespaceVariableDeclarations){const match=pattern.exec(candidate.rawDeclaration);if(!match)continue;const declaration=candidate.rawDeclaration.replace(/\s+/g," ").trim(),key=`${candidate.namespace.join("::")}:${candidate.name}:${declaration}`;if(!seen.has(key)){seen.add(key);continue}removals.push([candidate.start,candidate.end])}let result=source;for(const [start,end] of removals.reverse())result=result.slice(0,start)+result.slice(end);return result}
function browserSafeMidiExpanderMessages(source){
  const messageArray=/\bstd::vector\s*<\s*smf::MidiMessage\s*>\s+msgs\s*\[\s*NUM_TRACKS\s*\]\s*;/;
  if(!messageArray.test(source))return source;
  const helper=`struct RackWebMidiExpanderMessage {
    uint8_t size = 0;
    uint8_t bytes[3]{};
    operator smf::MidiMessage() const {
      std::vector<int> values;
      values.reserve(size);
      for (uint8_t index = 0; index < size; ++index) values.push_back(bytes[index]);
      return smf::MidiMessage(values);
    }
  };
  struct RackWebMidiExpanderMessageList {
    uint32_t count = 0;
    RackWebMidiExpanderMessage entries[16]{};
    void reserve(size_t) {}
    void clear() { count = 0; }
    size_t size() const { return count; }
    void push_back(const smf::MidiMessage& message) {
      if (count >= 16) return;
      auto& target = entries[count++];
      target.size = static_cast<uint8_t>(std::min<size_t>(3, message.size()));
      for (uint8_t index = 0; index < target.size; ++index) target.bytes[index] = message[index];
    }
    RackWebMidiExpanderMessage* begin() { return entries; }
    RackWebMidiExpanderMessage* end() { return entries + count; }
    const RackWebMidiExpanderMessage* begin() const { return entries; }
    const RackWebMidiExpanderMessage* end() const { return entries + count; }
  };
  `;
  const insertion=/\bstruct\s+ExpanderToMasterMessage\s*\{/;
  if(!insertion.test(source))return source;
  return source.replace(insertion,`${helper}struct ExpanderToMasterMessage {`).replace(messageArray,"RackWebMidiExpanderMessageList msgs[NUM_TRACKS];")
}
function normalizeLegacyMidiOverrides(source){return browserSafeMidiExpanderMessages(dedupeRepeatedNamespaceVariables(dedupeRepeatedNamespaceConstants(dedupeRepeatedTopLevelEnums(dedupeRepeatedTopLevelTypes(isolateInternalCVMidiQueue(source.replace(/^[ \t]*(?:(?:const\s+extern|extern\s+const|const)\s+float)\s+_(?:H_|2_)?PI\s*(?:=\s*[^;]+)?;[ \t]*$/gm,"").replace(/\b[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*::ON_OFF_NAMES\b/g,'std::vector<std::string>{"Off", "On"}').replace(/(\bvoid\s+onMessage\s*\()\s*((?:rack::)?midi::Message)\s+([A-Za-z_]\w*)\s*(\)\s*override\b)/g,"$1const $2& $3$4").replace(/\bauto\s*\*\s*([A-Za-z_]\w*)\s*=\s*(?=(?:std::)?begin\s*\()/g,"auto $1 = ")))))))}
function namespaceUsingPrelude(source){
  const directives=rustSourceNamespaceUsingDirectives(source),importsRack=directives.some(candidate=>candidate.target==="rack"),
    names=[...new Set(directives
      .map(candidate=>importsRack&&candidate.target==="dsp"?"rack::dsp":candidate.target)
      .filter(name=>name==="std"||name==="rack::dsp"||!/^std(?:::|$)|^rack(?:::|$)/.test(name)))];
  return names.map(name=>name==="std"
    ?"using namespace std;"
    :name==="rack::dsp"
      ?"using namespace rack::dsp;"
      :name==="simd"
        ?"namespace simd = rack::simd;\nusing namespace rack::simd;"
        :`namespace ${name} {}\nusing namespace ${name};`).join("\n")
}
function namespaceSpecificUsingDeclarations(source,file=null){const declarations=[];for(const candidate of file?rustProjectedNamespaceUsingDeclarations(file,source):rustSourceDeclarations(source).namespaceUsingDeclarations){let declaration=candidate.rawDeclaration;if(candidate.namespace.length)declaration=`${candidate.namespace.map(namespace=>`namespace ${namespace} {`).join("\n")}\n${declaration}\n${candidate.namespace.map(()=>"}").join("\n")}`;declarations.push(declaration)}return[...new Set(declarations)]}
function devirtualizeConcreteMemberCalls(declarations,implementation){let result=implementation;for(const match of declarations.matchAll(/\b([A-Za-z_]\w*(?:::[A-Za-z_]\w*)*(?:\s*<[^;{}]+>)?)\s+([A-Za-z_]\w*)\s*\[[^\]]+\]\s*;/g)){const type=match[1].replace(/\s+/g,""),member=match[2],body=plainStructBody(declarations,baseTypeName(type));if(!body)continue;for(const method of body.matchAll(/\b([A-Za-z_]\w*)\s*\([^;{}]*\)\s*override\s*\{/g)){const call=new RegExp(`(\\b${member}\\s*\\[[^\\]]+\\])\\s*\\.\\s*${method[1]}\\s*\\(`,"g");result=result.replace(call,`$1.${type}::${method[1]}(`)}}return result}
function compiledConditionalImplementation(file){if(!file||!fs.existsSync(file)||!/\.(?:cpp|cc|cxx)$/.test(file))return false;const source=fs.readFileSync(file,"utf8"),appTargets=[...source.matchAll(/\bAPP\s*->\s*([A-Za-z_]\w*)/g)].map(match=>match[1]);return /^\s*#\s*(?:if|ifdef|ifndef)\b/m.test(source)&&!rackUiPattern.test(source)&&!(/\bcreateModel\s*</.test(source))&&!/\b(?:asset|system)::/.test(source)&&appTargets.every(name=>name==="engine")}
function declaredTypeNames(source){const declarations=rustSourceDeclarations(source);return[...new Set([...declarations.typeDeclarations.map(declaration=>declaration.name),...declarations.enumDeclarations.map(declaration=>declaration.name).filter(Boolean),...declarations.typeAliases.map(alias=>alias.name)])]}
function enumDeclarationSource(source,name){const declaration=rustSourceDeclarations(source).enumDeclarations.find(candidate=>candidate.name===name);return declaration?source.slice(declaration.start,declaration.end):""}
function referencedGlobalEnumDeclarations(sourceFiles,reference){
  const declarations=[];
  for(const file of sourceFiles){
    if(!/\.(?:h|hh|hpp)$/.test(file))continue;
    const source=fs.readFileSync(file,"utf8"),candidates=activeEnumDeclarationsByFile?.get(path.resolve(file))??rustSourceDeclarations(source).enumDeclarations;
    for(const candidate of candidates){
      if(candidate.name===null||candidate.owners.length||!candidate.complete)continue;
      const identifiers=candidate.identifiers.map(identifier=>typeof identifier==="string"?identifier:identifier.base);
      if(!identifiers.some(identifier=>new RegExp(`\\b${identifier.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`).test(reference)))continue;
      let declaration=source.slice(candidate.start,candidate.end);
      if(candidate.namespace.length)declaration=`${candidate.namespace.map(namespace=>`namespace ${namespace} {`).join("\n")}\n${declaration}\n${candidate.namespace.map(()=>"}").join("\n")}`;
      declarations.push(declaration);
    }
  }
  return[...new Set(declarations)]
}
function typeDeclarationSource(source,name){const declarations=rustSourceDeclarations(source),plain=declarations.typeDeclarations.find(candidate=>candidate.name===name),enumeration=declarations.enumDeclarations.find(candidate=>candidate.name===name),aliases=declarations.typeAliases.filter(candidate=>candidate.name===name);return[plain?source.slice(plain.declarationStart,plain.declarationEnd):"",enumeration?source.slice(enumeration.start,enumeration.end):"",...aliases.map(alias=>alias.rawDefinition)].filter(Boolean).join("\n")}
function dependencyDeclarationFacts(source){
  const declarations=rustSourceDeclarations(source),candidates=[
    ...declarations.typeDeclarations.filter(candidate=>candidate.namespaceScope).map(candidate=>({start:candidate.declarationStart,name:candidate.name,namespace:candidate.namespace,kind:"type"})),
    ...declarations.enumDeclarations.filter(candidate=>candidate.namespaceScope&&candidate.name!==null).map(candidate=>({start:candidate.start,name:candidate.name,namespace:candidate.namespace,kind:"type"})),
    ...declarations.typeAliases.filter(candidate=>candidate.namespaceScope).map(candidate=>({start:candidate.declarationStart,name:candidate.name,namespace:candidate.namespace,kind:"type"})),
    ...declarations.freeFunctionDeclarations.map(candidate=>({start:candidate.start,name:candidate.name,namespace:candidate.namespace,kind:"function"})),
    ...declarations.freeFunctionDefinitions.map(candidate=>({start:candidate.start,name:candidate.name,namespace:candidate.namespace,kind:"function"})),
    ...declarations.namespaceVariableDeclarations.map(candidate=>({start:candidate.start,name:candidate.name,namespace:candidate.namespace,kind:"variable"})),
  ].sort((left,right)=>left.start-right.start),qualifiedNames=new Map;
  for(const candidate of candidates){const identities=qualifiedNames.get(candidate.name)??[];for(const [index] of candidate.namespace.entries()){const identity=[...candidate.namespace.slice(index),candidate.name].join("::");if(!identities.includes(identity))identities.push(identity)}qualifiedNames.set(candidate.name,identities)}
  return{candidates,functionNames:[...new Set(candidates.filter(candidate=>candidate.kind==="function").map(candidate=>candidate.name))],namespaceNames:[...new Set(candidates.flatMap(candidate=>candidate.namespace))],qualifiedNames}
}
function declaredDependencyNames(source){
  const languageAndLibraryTypes=new Set([
    "bool","char","char8_t","char16_t","char32_t","double","float","int","long",
    "short","signed","unsigned","void","wchar_t",
    "int8_t","int16_t","int32_t","int64_t","uint8_t","uint16_t","uint32_t","uint64_t",
    "intptr_t","uintptr_t","ptrdiff_t","size_t","ssize_t",
  ]),{candidates}=dependencyDeclarationFacts(source);
  return[...new Set(candidates.map(candidate=>candidate.name))].filter(name=>!languageAndLibraryTypes.has(name))
}
function stripRepeatedDefaultArgumentsOnDefinitions(source){let result=source;for(const {start,end} of [...rustSourceDeclarations(source).repeatedDefaultArgumentRanges].reverse())result=result.slice(0,start)+result.slice(end);return result}
function functionDecorationMacroDefinitions(source){
  const definitions=new Map;
  for(const candidate of rustSourceDeclarations(source).macroDefinitions){
    if(candidate.commented||candidate.functionLike||/\\[ \t]*\r?\n/.test(candidate.rawDefinition))continue;
    const value=candidate.replacement;
    if(!/\b(?:inline|forceinline)\b|__attribute__|__declspec/.test(value))continue;
    const semantics=[
      /\bstatic\b/.test(value)?"static":"",
      /\b(?:inline|forceinline)\b/.test(value)?"inline":"",
    ].filter(Boolean).join(" ");
    const previous=definitions.get(candidate.name)??"";
    definitions.set(candidate.name,[...new Set(`${previous} ${semantics}`.trim().split(/\s+/).filter(Boolean))].join(" "))
  }
  return definitions
}
function normalizeFunctionDecorationMacros(signature,source){
  const definitions=functionDecorationMacroDefinitions(source);
  if(!definitions.size)return signature;
  for(const [name,replacement] of definitions){
    const pattern=new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\$&")}\\b\\s*`,"g");
    signature=signature.replace(pattern,replacement?`${replacement} `:"")
  }
  return signature
    .replace(/\bstatic(?:\s+static)+\b/g,"static")
    .replace(/\binline(?:\s+inline)+\b/g,"inline")
    .replace(/[ \t]{2,}/g," ")
    .trim()
}
function freeFunctionForwardDeclaration(candidate,signature=candidate?.signature){if(!signature)return"";let declaration=`${signature};`;if(candidate.namespace.length)declaration=`${candidate.namespace.map(namespace=>`namespace ${namespace} {`).join("\n")}\n${declaration}\n${candidate.namespace.map(()=>"}").join("\n")}`;return declaration}
function namespaceFunctionForwardDeclarations(source,macroSource=source){const declarations=[];for(const candidate of rustSourceFreeFunctionDefinitions(source)){const signature=normalizeFunctionDecorationMacros(candidate.declarationSignature,macroSource);if(!signature||rackUiPattern.test(signature)||/\btemplate\s*</.test(signature))continue;declarations.push(freeFunctionForwardDeclaration(candidate,signature))}return[...new Set(declarations)]}
function referencedVecDspHelpers(source,reference){const helpers=[];for(const candidate of rustSourceFreeFunctionDefinitions(source)){const escaped=candidate.name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),vecParameter=new RegExp(`\\b${escaped}(?:\\s*<[^;{}]+>)?\\s*\\([^;{}]*\\bVec\\b[^;{}]*\\)`).test(candidate.signature);if(vecParameter&&new RegExp(`\\b${escaped}\\s*\\(`).test(reference))helpers.push(candidate.rawDefinition)}return[...new Set(helpers)].join("\n\n")}
function deferFreeFunctionsReferencingTypes(source,typeNames){const ranges=[],definitions=[];for(const candidate of rustSourceFreeFunctionDefinitions(source)){const definition=candidate.rawDefinition;if(!typeNames.some(name=>new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`).test(definition)))continue;let wrapped=definition;if(candidate.namespace.length)wrapped=`${candidate.namespace.map(namespace=>`namespace ${namespace} {`).join("\n")}\n${wrapped}\n${candidate.namespace.map(()=>"}").join("\n")}`;definitions.push(wrapped);ranges.push([candidate.start,candidate.end])}let remaining=source;for(const [start,end] of ranges.reverse())remaining=remaining.slice(0,start)+remaining.slice(end);return{source:remaining.trim(),definitions:[...new Set(definitions)]}}
// Kept as a conservative fallback while the richer collector is exercised against more plugins.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function referencedDependencyBundle(sourceFiles,analysis,excludedFiles){const headers=sourceFiles.filter(file=>/\.(?:hpp|hh|h)$/.test(file)&&path.basename(file)!=="plugin.hpp"&&!excludedFiles.has(file)).map(file=>{const source=sourceWithoutIncludes(stripHeaderGuardOpen(fs.readFileSync(file,"utf8")));return{file,source,names:declaredTypeNames(source)}}),selected=[];let expanded=analysis;for(let pass=0;pass<12;pass++){const next=headers.find(header=>!selected.includes(header)&&header.names.some(name=>new RegExp(`\\b${name}\\b`).test(expanded)));if(!next)break;selected.push(next);expanded+=`\n${next.source}`}const chunks=[];for(const header of selected){chunks.push(header.source);const implementation=companionImplementationFile(header.file,sourceFiles);if(implementation)chunks.push(sourceWithoutIncludes(fs.readFileSync(implementation,"utf8")))}return{source:chunks.join("\n\n"),files:selected.map(header=>header.file)}}
function referencedDependencyBundleForAdapter(sourceFiles,analysis,excludedFiles,sourceDir){
  if(!sourceDir){const marker=`${path.sep}src${path.sep}`,sample=sourceFiles.find(file=>file.includes(marker));sourceDir=sample?sample.slice(0,sample.indexOf(marker)):path.dirname(sourceFiles[0]??process.cwd())}
  const directlyReachableMacroNames=[
    ...sourceFiles.flatMap(file=>fs.existsSync(file)?rustMacroDefinitionBlocks(fs.readFileSync(file,"utf8")).map(candidate=>candidate.name):[]),
    ...[...analysis.matchAll(/\benum(?:\s+(?:class|struct))?(?:\s+[A-Za-z_]\w*)?\s*\{([\s\S]*?)\}/g)].flatMap(match=>splitArguments(match[1]).map(entry=>/^\s*([A-Za-z_]\w*)/.exec(entry)?.[1]).filter(Boolean)),
  ];
  // Keep dependency selection scoped to the target's include graph. Searching
  // every sibling header in a plugin makes ordinary identifiers such as
  // `state`, `params`, or `mix` pull unrelated DSP families into the adapter,
  // which can also introduce same-named types from different namespaces.
  sourceFiles=[...new Set(sourceFiles)];
  const sourceManifestFile=path.join(sourceDir,"plugin.json"),sourcePlugin=fs.existsSync(sourceManifestFile)?JSON.parse(fs.readFileSync(sourceManifestFile,"utf8")).slug:"";
  if(sourcePlugin==="CosineKitty-Sapphire")sourceFiles=sourceFiles.filter(file=>path.basename(file)!=="sapphire_widget.hpp");
  const vendoredEigenFiles=sourceFiles.filter(file=>file.split(path.sep).includes("Eigen"));
  sourceFiles=sourceFiles.filter(file=>!vendoredEigenFiles.includes(file));
  const directAnalysis=analysis,referencedExterns=[],referencedExternTypes=[];for(const file of sourceFiles){const source=fs.readFileSync(file,"utf8");for(const candidate of rustNamespaceVariableDeclarations(file,source))if(candidate.externDeclaration&&new RegExp(`\\b${candidate.name}\\b`).test(analysis)){referencedExterns.push(candidate.rawDeclaration);referencedExternTypes.push({type:baseTypeName(candidate.typeSource),name:candidate.name})}}analysis=[analysis,...new Set(referencedExterns)].join("\n");
  const needsDependencyImplementation=type=>{const externs=referencedExternTypes.filter(entry=>entry.type===baseTypeName(type));if(!externs.length)return true;if(new RegExp(`\\b${baseTypeName(type)}\\s+[A-Za-z_]\\w*`).test(directAnalysis))return true;return externs.some(entry=>new RegExp(`\\b${entry.name}\\s*->\\s*[A-Za-z_]\\w*\\s*\\(`).test(directAnalysis))};
  const externalRoots=repositoryRoots(sourceDir).slice(1).map(root=>path.resolve(root)),externalRootFor=file=>externalRoots.find(root=>file.startsWith(`${root}${path.sep}`));
  const dependencyMacroDefinitions=new Map;for(const file of sourceFiles){if(!fs.existsSync(file)||!fs.statSync(file).isFile())continue;const raw=fs.readFileSync(file,"utf8"),guards=headerGuardNames(raw);for(const [name,value] of preprocessMacroSource(raw,new Map).definitions)if(!guards.has(name))dependencyMacroDefinitions.set(name,value)}const dependencyImplementationSource=file=>{let source=file?preprocessMacroSource(fs.readFileSync(file,"utf8"),dependencyMacroDefinitions).source:"";for(const type of new Set(referencedExternTypes.map(entry=>entry.type)))if(!needsDependencyImplementation(type))source=removeOutOfLineDefinitions(source,type);return stripConditionalBlocks(source,condition=>/\b(?:this\s*->\s*)?widget\b/.test(condition))};
  const headers=sourceFiles.filter(file=>{if(!/\.(?:hpp|hh|h)$/.test(file)||["plugin.hpp","skins.hpp"].includes(path.basename(file))||excludedFiles.has(file))return false;const raw=fs.readFileSync(file,"utf8"),source=stripRackUiBlocks(flattenExternCWrappers(sourceWithoutIncludes(stripHeaderGuardOpen(raw))));return source.trim()&&(!/^\s*extern\s+(?:(?:rack::)?plugin::)?Model\s*\*/m.test(raw)||declaredDependencyNames(source).length>0||referencedLocalFreeFunctionDefinitions(source,source).length>0)}).map(file=>{const source=stripRackUiBlocks(flattenExternCWrappers(sourceWithoutIncludes(stripHeaderGuardOpen(fs.readFileSync(file,"utf8"))))),names=declaredDependencyNames(source),{functionNames,namespaceNames,qualifiedNames}=dependencyDeclarationFacts(source);return{file,source,names,functionNames,namespaceNames,qualifiedNames}}),declarations=headers.map(header=>header.source).join("\n"),selected=[],defined=new Set([...declaredDependencyNames(analysis),...rustMacroDefinitionBlocks(analysis).map(candidate=>candidate.name),...directlyReachableMacroNames,"Module","ParamQuantity","Input","Output","Light","Skins","SkinChangeListener"]),nameReferenced=(header,name,reference)=>{const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),qualified=(header.qualifiedNames.get(name)??[]).some(identity=>new RegExp(`\\b${escaped(identity)}\\b`).test(reference)),unqualified=new RegExp(`(?:^|[^:\\w])${escaped(name)}\\b`).test(reference);return qualified||(!defined.has(name)&&unqualified)},functionReferenced=(header,name,reference)=>{const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),callSuffix=`${escaped}(?:\\s*<[^;{}]+>)?\\s*\\(`,qualified=(header.qualifiedNames.get(name)??[]).some(identity=>new RegExp(`\\b${identity.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?:\\s*<[^;{}]+>)?\\s*\\(`).test(reference)),unqualified=new RegExp(`(?:^|[^:\\w])${callSuffix}`).test(reference);return qualified||(!defined.has(name)&&unqualified)},namespaceReferenced=(header,reference)=>header.namespaceNames.some(name=>!defined.has(name)&&new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*::`).test(reference));
  let expanded=sourceWithoutCommentsAndLiterals(analysis);
  for(let pass=0;pass<64;pass++){
    expanded=sourceWithoutCommentsAndLiterals(expanded);
    for(const enumMatch of expanded.matchAll(/\benum(?:\s+(?:class|struct))?(?:\s+[A-Za-z_]\w*)?\s*\{([\s\S]*?)\}/g))for(const identifier of splitArguments(enumMatch[1]).map(entry=>/^\s*([A-Za-z_]\w*)/.exec(entry)?.[1]).filter(Boolean))defined.add(identifier);
    const next=headers.find(header=>!selected.includes(header)&&(header.names.some(name=>nameReferenced(header,name,expanded))||header.functionNames.some(name=>functionReferenced(header,name,expanded))||namespaceReferenced(header,expanded)));
    if(!next)break;
    if(process.env.RACK_WEB_DEBUG_DEPENDENCIES){
      const matches=next.names.filter(name=>nameReferenced(next,name,expanded)).map(name=>({name,context:expanded.slice(Math.max(0,expanded.search(new RegExp(`\\b${name}\\b`))-80),expanded.search(new RegExp(`\\b${name}\\b`))+160)}));
      console.error(JSON.stringify({selected:path.relative(sourceDir,next.file),matches},null,2));
    }
    next.implementationFile=companionImplementationFile(next.file,sourceFiles);const implementationSource=dependencyImplementationSource(next.implementationFile),required=new Set(next.names.filter(name=>nameReferenced(next,name,expanded)));for(let depth=0;depth<16;depth++){const before=required.size;for(const name of [...required]){const typeSource=[...declaredBases(next.source,name),typeDeclarationSource(next.source,name),...outOfLineDefinitions(implementationSource,name),...outOfLineFreeFunctionDefinitions(implementationSource,name),...outOfLineStaticDefinitions(implementationSource,name)].join("\n");for(const candidate of next.names)if(new RegExp(`\\b${candidate}\\b`).test(typeSource))required.add(candidate)}if(required.size===before)break}next.requiredNames=required;const pimplImplementation=next.names.some(name=>new RegExp(`\\bstruct\\s+${name.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\$&")}\\s*::\\s*Impl\\b`).test(implementationSource)),inlineConditionalImplementation=compiledConditionalImplementation(next.implementationFile)||pimplImplementation;next.inlineImplementation=inlineConditionalImplementation?devirtualizeConcreteMemberCalls(declarations,sourceWithoutIncludes(implementationSource)):"";next.implementation=inlineConditionalImplementation?"":[...new Set([...required].flatMap(name=>[...outOfLineStaticDefinitions(implementationSource,name,true,enclosingNamespaces(next.source,name)),...outOfLineDefinitions(implementationSource,name,true,enclosingNamespaces(next.source,name)),...outOfLineFreeFunctionDefinitions(implementationSource,name,true,enclosingNamespaces(next.source,name))]))].join("\n\n");next.implementationGlobals=inlineConditionalImplementation?"":namespaceGlobalDefinitions(implementationSource,`${expanded}\n${next.implementation}`);next.implementationSupport=inlineConditionalImplementation?"":implementationSupportDeclarations(implementationSource,`${next.implementationGlobals}\n${next.implementation}`);selected.push(next);for(const enumMatch of next.source.matchAll(/\benum(?:\s+(?:class|struct))?(?:\s+[A-Za-z_]\w*)?\s*\{([\s\S]*?)\}/g))for(const identifier of splitArguments(enumMatch[1]).map(entry=>/^\s*([A-Za-z_]\w*)/.exec(entry)?.[1]).filter(Boolean))defined.add(identifier);for(const name of [...next.names,...next.functionNames,...next.namespaceNames])defined.add(name);if(!externalRootFor(next.file))expanded+=`\n${next.source}\n${inlineConditionalImplementation?next.inlineImplementation:`${next.implementationSupport}\n${next.implementationGlobals}\n${next.implementation}`}`;
  }
  for(const header of selected){if(!header.implementationFile||header.inlineImplementation)continue;const implementationSource=dependencyImplementationSource(header.implementationFile),referenceSource=[analysis,...selected.filter(candidate=>candidate!==header).flatMap(candidate=>[candidate.source,candidate.implementationSupport,candidate.implementationGlobals,candidate.implementation,candidate.inlineImplementation].filter(Boolean))].join("\n"),required=new Set(header.names.filter(name=>new RegExp(`\\b${name}\\b`).test(referenceSource)));for(let depth=0;depth<16;depth++){const before=required.size;for(const name of [...required]){const typeSource=[...declaredBases(header.source,name),typeDeclarationSource(header.source,name),...outOfLineDefinitions(implementationSource,name),...outOfLineFreeFunctionDefinitions(implementationSource,name),...outOfLineStaticDefinitions(implementationSource,name)].join("\n");for(const candidate of header.names)if(new RegExp(`\\b${candidate}\\b`).test(typeSource))required.add(candidate)}if(required.size===before)break}header.requiredNames=required;if(process.env.RACK_WEB_DEBUG_DEPENDENCIES)console.error(JSON.stringify({dependencyRequired:path.relative(sourceDir,header.file),required:[...required]},null,2));header.implementation=[...new Set([...required].flatMap(name=>[...outOfLineStaticDefinitions(implementationSource,name,true,enclosingNamespaces(header.source,name)),...outOfLineDefinitions(implementationSource,name,true,enclosingNamespaces(header.source,name)),...outOfLineFreeFunctionDefinitions(implementationSource,name,true,enclosingNamespaces(header.source,name))]))].join("\n\n");header.implementationGlobals=namespaceGlobalDefinitions(implementationSource,`${referenceSource}\n${header.implementation}`);header.implementationSupport=implementationSupportDeclarations(implementationSource,`${header.implementationGlobals}\n${header.implementation}`)}
  for(const header of selected){
    if(!header.implementationFile||!header.names.includes("BufferSludger"))continue;
    const implementationSource=fs.readFileSync(header.implementationFile,"utf8");
    header.implementation=replaceOutOfLineMethod(header.implementation??"","BufferSludger","loadWavFile","void BufferSludger::loadWavFile() {}");
    const helpers=referencedLocalFreeFunctionDefinitions(implementationSource,header.implementation);
    const helperSource=helpers.join("\n\n"),simpleGlobals=[...implementationSource.matchAll(/^[ \t]*(?:static\s+)?const\s+[A-Za-z_]\w*(?:\s*[*&])?\s+([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*=\s*[^;]+;/gm)].filter(match=>new RegExp(`\\b${match[1]}\\b`).test(helperSource)).map(match=>match[0].trim());
    header.implementationGlobals=[header.implementationGlobals,namespaceGlobalDefinitions(implementationSource,helperSource),...simpleGlobals].filter(Boolean).join("\n\n");
    header.implementationSupport=[header.implementationSupport,...helpers].flat().filter(Boolean).join("\n\n")
  }
  const libraryRoot=path.join(sourceDir,"lib"),eigenRoot=path.join(libraryRoot,"Eigen"),isEigenHeader=file=>file.split(path.sep).includes("Eigen"),eigenHeaders=selected.filter(header=>isEigenHeader(header.file)),eigenHeaderFiles=new Set(sourceFiles.filter(isEigenHeader)),usesEigenHeaders=eigenHeaders.length>0||/\bEigen\s*::/.test([analysis,...selected.map(header=>header.source)].join("\n")),libraryHeaders=selected.filter(header=>header.file.startsWith(`${libraryRoot}${path.sep}`)&&!eigenHeaderFiles.has(header.file)),includedLibraryHeaders=new Set;for(const header of libraryHeaders){const headerSource=fs.readFileSync(header.file,"utf8");for(const include of rawIncludes(header.file,headerSource)){const dependency=[path.resolve(path.dirname(header.file),include),path.resolve(libraryRoot,include)].find(file=>libraryHeaders.some(candidate=>candidate.file===file));if(dependency)includedLibraryHeaders.add(dependency)}}
  for(const header of selected){if(!header.implementationFile)continue;const implementationSource=fs.readFileSync(header.implementationFile,"utf8");for(const include of rawIncludes(header.implementationFile,implementationSource)){const dependency=[path.resolve(path.dirname(header.implementationFile),include),path.resolve(libraryRoot,include)].find(file=>file.startsWith(`${libraryRoot}${path.sep}`)&&fs.existsSync(file)&&fs.statSync(file).isFile());if(dependency&&!dependency.startsWith(`${eigenRoot}${path.sep}`)&&!libraryHeaders.some(candidate=>candidate.file===dependency))libraryHeaders.push({file:dependency})}}
  // Keep submodule headers as real includes instead of flattening them into the
  // generated adapter. Their include guards and declaration order are part of
  // the dependency's public C++ contract (Gamma is a representative example).
  const externalHeaders=selected.filter(header=>externalRootFor(header.file));
  const localHeaders=selected.filter(header=>!header.file.startsWith(`${libraryRoot}${path.sep}`)&&!eigenHeaderFiles.has(header.file)&&!externalRootFor(header.file)),localByFile=new Map(localHeaders.map(header=>[path.resolve(header.file),header])),orderedLocalHeaders=[],visitedLocalHeaders=new Set,visitingLocalHeaders=new Set;function visitLocalHeader(header){if(visitedLocalHeaders.has(header.file)||visitingLocalHeaders.has(header.file))return;visitingLocalHeaders.add(header.file);for(const candidate of localHeaders){if(candidate===header)continue;const referenced=declaredDependencyNames(candidate.source).some(name=>new RegExp(`\\b${name}\\b`).test(header.source));if(referenced)visitLocalHeader(candidate)}for(const include of rawIncludes(header.file,fs.readFileSync(header.file,"utf8"))){const normalized=include.split(/[\\/]+/).join(path.sep),direct=[path.resolve(path.dirname(header.file),normalized),path.resolve(sourceDir,"src",normalized),path.resolve(sourceDir,normalized)].map(file=>localByFile.get(path.resolve(file))).find(Boolean),suffixMatches=direct?[]:localHeaders.filter(candidate=>candidate.file.endsWith(`${path.sep}${normalized}`)),dependency=direct??(suffixMatches.length===1?suffixMatches[0]:undefined);if(dependency)visitLocalHeader(dependency)}visitingLocalHeaders.delete(header.file);visitedLocalHeaders.add(header.file);orderedLocalHeaders.push(header)}for(const header of localHeaders)visitLocalHeader(header);
  const includeOrderedHeaders=[],includeVisitedHeaders=new Set,includeVisitingHeaders=new Set,headerForInclude=(header,include)=>{const normalized=include.split(/[\\/]+/).join(path.sep),direct=[path.resolve(path.dirname(header.file),normalized),path.resolve(sourceDir,"src",normalized),path.resolve(sourceDir,normalized)].map(file=>localByFile.get(path.resolve(file))).find(Boolean),suffixMatches=direct?[]:localHeaders.filter(candidate=>candidate.file.endsWith(`${path.sep}${normalized}`));return direct??(suffixMatches.length===1?suffixMatches[0]:undefined)};function visitIncludedHeader(header){if(includeVisitedHeaders.has(header.file)||includeVisitingHeaders.has(header.file))return;includeVisitingHeaders.add(header.file);for(const include of rawIncludes(header.file,fs.readFileSync(header.file,"utf8"))){const dependency=headerForInclude(header,include);if(dependency)visitIncludedHeader(dependency)}includeVisitingHeaders.delete(header.file);includeVisitedHeaders.add(header.file);includeOrderedHeaders.push(header)}const includedLocalHeaderFiles=new Set(localHeaders.flatMap(header=>rawIncludes(header.file,fs.readFileSync(header.file,"utf8")).map(include=>headerForInclude(header,include)?.file).filter(Boolean)));for(const header of orderedLocalHeaders)if(!includedLocalHeaderFiles.has(header.file))visitIncludedHeader(header);for(const header of orderedLocalHeaders)visitIncludedHeader(header);orderedLocalHeaders.splice(0,orderedLocalHeaders.length,...includeOrderedHeaders);
  const systemIncludes=[...new Set(localHeaders.flatMap(header=>[header.file,header.implementationFile].filter(Boolean).flatMap(file=>preprocessMacroSource(fs.readFileSync(file,"utf8"),new Map,false).includeDirectives.filter(candidate=>candidate.angle).map(candidate=>candidate.include))).filter(include=>/^[A-Za-z0-9_.]+$/.test(include)&&browserSafeSystemInclude(include)))],externalIncludes=externalHeaders.filter(header=>!/_Impl\.(?:h|hpp)$/.test(header.file)).map(header=>{const root=externalRootFor(header.file);return `#include "${path.relative(root,header.file).split(path.sep).join("/")}"`}),headerTypeNames=[...new Set(orderedLocalHeaders.flatMap(header=>[...declaredTypeNames(header.source),...header.names.filter(name=>Boolean(typeDeclarationSource(header.source,name)))]))],headerUsingDeclarations=[...new Set(orderedLocalHeaders.flatMap(header=>namespaceSpecificUsingDeclarations(header.source,header.file)))].filter(declaration=>{const target=/\busing\s+[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*::([A-Za-z_]\w*)\s*;/.exec(declaration)?.[1];return !target||!headerTypeNames.includes(target)}),headerMacroSource=orderedLocalHeaders.map(header=>header.source).join("\n"),headerFunctionDeclarations=[...new Set(orderedLocalHeaders.flatMap(header=>namespaceFunctionForwardDeclarations(header.source,headerMacroSource)))].filter(declaration=>!headerTypeNames.some(name=>new RegExp(`\\b${name}\\b`).test(declaration))),chunks=[...systemIncludes.map(include=>`#include <${include}>`),...(usesEigenHeaders?['#define EIGEN_DONT_VECTORIZE 1','#define EIGEN_DISABLE_UNALIGNED_ARRAY_ASSERT 1','#define EIGEN_HAS_STD_RESULT_OF 0','#include <Eigen/Dense>','#include <Eigen/Cholesky>']:[]),...libraryHeaders.filter(header=>!includedLibraryHeaders.has(header.file)).map(header=>`#include "${path.relative(libraryRoot,header.file).split(path.sep).join("/")}"`),...externalIncludes,...headerUsingDeclarations,...headerFunctionDeclarations,...orderedLocalHeaders.map(header=>header.source)];
  for(const include of systemIncludes){
    const normalized=include.split(/[\\/]+/).join(path.sep);
    if(!localHeaders.some(header=>header.file.endsWith(`${path.sep}${normalized}`)))continue;
    const index=chunks.indexOf(`#include <${include}>`);
    if(index>=0)chunks.splice(index,1);
  }
  const dependencyReference=chunks.join("\n"),dependencyEnums=[];
  for(const candidate of rustSourceDeclarations(analysis).enumDeclarations){
    if(!candidate.namespaceScope||candidate.name===null||!candidate.complete||!candidate.identifiers.some(identifier=>typeof identifier==="string"&&new RegExp(`\\b${identifier.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`).test(dependencyReference)))continue;
    const declaration=analysis.slice(candidate.start,candidate.end);let wrapped=declaration;
    if(candidate.namespace.length)wrapped=`${candidate.namespace.map(namespace=>`namespace ${namespace} {`).join("\n")}\n${wrapped}\n${candidate.namespace.map(()=>"}").join("\n")}`;
    if(!dependencyReference.includes(wrapped)&&!dependencyEnums.includes(wrapped))dependencyEnums.push(wrapped)
  }
  chunks.unshift(...dependencyEnums);
  const usingPrelude=namespaceUsingPrelude([analysis,...orderedLocalHeaders.map(header=>header.source)].join("\n"));if(usingPrelude)chunks.unshift(usingPrelude);const implementationStart=chunks.length;
  for(const header of selected){if(externalRootFor(header.file)||eigenHeaderFiles.has(header.file))continue;if(header.inlineImplementation)chunks.push(header.inlineImplementation);if(header.implementationGlobals)chunks.push(header.implementationGlobals);if(header.implementationSupport)chunks.push(header.implementationSupport);if(header.implementation)chunks.push(header.implementation)}
  const crossClassStart=chunks.length;let selectedCode=chunks.join("\n");const crossFileClassDefinitions=[];for(const header of selected){if(externalRootFor(header.file))continue;for(const file of sourceFiles.filter(candidate=>/\.(?:c|cc|cpp|cxx)$/.test(candidate)&&path.dirname(candidate)===path.dirname(header.file)&&!rackUiPattern.test(fs.readFileSync(candidate,"utf8")))){const source=fs.readFileSync(file,"utf8");for(const name of header.requiredNames??[]){if(!needsDependencyImplementation(name))continue;for(const rawDefinition of rawOutOfLineDefinitions(file,source,name,true,enclosingNamespaces(header.source,name))){const definition=stripConditionalBlocks(rawDefinition,condition=>/\b(?:this\s*->\s*)?widget\b/.test(condition));if(!selectedCode.includes(definition)){crossFileClassDefinitions.push(definition);selectedCode+=`\n${definition}`}}}}}chunks.push(...crossFileClassDefinitions);
  const supplementalStaticDefinitions=[];for(const header of selected){if(externalRootFor(header.file))continue;const referencedNames=header.names.filter(name=>new RegExp(`\\b${name}\\b`).test(selectedCode));for(const file of sourceFiles.filter(candidate=>/\.(?:c|cc|cpp|cxx)$/.test(candidate)&&path.dirname(candidate)===path.dirname(header.file)&&!rackUiPattern.test(fs.readFileSync(candidate,"utf8")))){const source=fs.readFileSync(file,"utf8");for(const name of referencedNames)for(const definition of outOfLineStaticDefinitions(source,name,true,enclosingNamespaces(header.source,name)))if(!selectedCode.includes(definition)){supplementalStaticDefinitions.push(definition);selectedCode+=`\n${definition}`}}}chunks.push(...supplementalStaticDefinitions);
  const supportDirectories=new Set(selected.map(header=>path.dirname(header.file))),supportFiles=sourceFiles.filter(file=>/\.(?:c|cc|cpp|cxx)$/.test(file)&&supportDirectories.has(path.dirname(file))&&!rackUiPattern.test(fs.readFileSync(file,"utf8"))),crossFileSupport=[],knownCrossFileSupport=new Set;let crossFileReference=chunks.join("\n");for(let pass=0;pass<16;pass++){let changed=false;for(const file of supportFiles){const source=fs.readFileSync(file,"utf8");for(const candidate of referencedLocalFreeFunctionDefinitionFacts(source,crossFileReference)){if(knownCrossFileSupport.has(candidate.definition))continue;knownCrossFileSupport.add(candidate.definition);crossFileSupport.push({source,...candidate});crossFileReference+=`\n${candidate.definition}`;changed=true}}if(!changed)break}if(crossFileSupport.length){const declarations=[...new Set(crossFileSupport.map(candidate=>freeFunctionForwardDeclaration(candidate)).filter(Boolean))],usingDirectives=[...new Set(crossFileSupport.flatMap(({source})=>namespaceUsingDirectiveDeclarations(source)))],globals=[...new Set(crossFileSupport.map(({source})=>namespaceGlobalDefinitions(source,crossFileSupport.map(item=>item.definition).join("\n"))).filter(Boolean))];chunks.splice(implementationStart,0,...declarations,...usingDirectives,...globals);chunks.push(...crossFileSupport.map(item=>item.definition))}
  const externalImplementationFiles=[...new Set(externalHeaders.flatMap(header=>{const root=externalRootFor(header.file),stem=path.basename(header.file,path.extname(header.file)),matches=files(root).filter(file=>/\.(?:c|cpp|cc|cxx)$/.test(file)&&path.basename(file,path.extname(file))===stem&&!path.relative(root,file).split(path.sep).some(part=>["test","tests","examples"].includes(part)));return matches.length===1?matches:[]}))].filter(file=>!rackUiPattern.test(fs.readFileSync(file,"utf8")));
  if(process.env.RACK_WEB_DEBUG_DEPENDENCIES)console.error(JSON.stringify(selected.map(header=>({
    file:path.relative(sourceDir,header.file),
    names:header.names,
    sourceLength:header.source.length,
    implementationSupportLength:header.implementationSupport?.length??0,
    implementationGlobalsLength:header.implementationGlobals?.length??0,
    implementationLength:header.implementation?.length??0,
  })),null,2));
  const directlyIncludedDeclaredNames=new Set(declaredDependencyNames(chunks.join("\n"))),directlyIncludedImplementations=[...excludedFiles]
    .filter(file=>fs.existsSync(file))
    .map(file=>directlyIncludedImplementationPrelude(file,sourceDir,directlyIncludedDeclaredNames))
    .filter(Boolean);
  chunks.splice(implementationStart,0,...directlyIncludedImplementations);
  const emittedImplementationDefines=new Set,dependencySource=[...new Set(chunks)].join("\n\n").replace(/^[ \t]*#[ \t]*define[ \t]+([A-Za-z_]\w*_IMPLEMENTATION)(?:[ \t]+[^\r\n]*)?[ \t]*$/gm,(definition,name)=>{
    if(emittedImplementationDefines.has(name))return"";
    emittedImplementationDefines.add(name);
    return definition.trim()
  });
  return{source:dependencySource,files:selected.map(header=>header.file),implementationFiles:externalImplementationFiles};
}
function moduleDefinition(sourceDir,sourceFiles,registration){
  const registrationSource=fs.readFileSync(registration.file,"utf8"),registrationDirectives=rawIncludeDirectives(registration.file,registrationSource).filter(candidate=>!candidate.angle),resolvedIncludes=registrationDirectives.map(candidate=>resolvedRawIncludeTarget(sourceDir,registration.file,candidate));
  const explicitNamespace=registration.moduleClass.split("<",1)[0].split("::").slice(0,-1).filter(Boolean),registrationNamespace=registration.registrationNamespace??[],expectedNamespaces=explicitNamespace.length?[registrationNamespace.concat(explicitNamespace),explicitNamespace]:[registrationNamespace],matchesExpectedNamespace=namespace=>expectedNamespaces.some(expected=>namespace.length===expected.length&&namespace.every((part,index)=>part===expected[index]));
  const preferred=new Set(resolvedIncludes.filter(Boolean));
  if(registration.definitionFile)preferred.add(registration.definitionFile);
  const stem=path.basename(registration.file,path.extname(registration.file));
  const candidates=[registration.definitionFile,...preferred,...sourceFiles.filter(file=>path.basename(file,path.extname(file))===stem),...sourceFiles].filter(Boolean);
  let best=null;
  for(const file of [...new Set(candidates)]){
    const transformedSource=file===registration.definitionFile&&Boolean(registration.definitionSource),rawSource=transformedSource?registration.definitionSource:fs.readFileSync(file,"utf8"),initialTypeDeclaration=transformedSource?rustSourceTypeDeclaration(rawSource,registration.moduleClass,expectedNamespaces):rustTypeDeclaration(file,registration.moduleClass,expectedNamespaces);let source=rawSource,typeDeclaration=initialTypeDeclaration,body=transformedSource?rustTypeBody(rawSource,initialTypeDeclaration):rawTypeBody(file,rawSource,initialTypeDeclaration,registration.moduleClass);
    if(body===null&&/^\s*#\s*(?:if|ifdef|ifndef)\b/m.test(rawSource)){const processed=preprocessMacroSource(rawSource,new Map()).source,processedTypeDeclaration=rustSourceTypeDeclaration(processed,registration.moduleClass,expectedNamespaces),processedBody=rustTypeBody(processed,processedTypeDeclaration);if(processedBody!==null){source=processed;typeDeclaration=processedTypeDeclaration;body=processedBody}}
    if(body===null)continue;
    const namespace=typeDeclaration?.namespace??enclosingNamespaces(source,registration.moduleClass);if(expectedNamespaces.some(expected=>expected.length)&&!matchesExpectedNamespace(namespace))continue;
    let score=0;if(preferred.has(file))score+=1000;if(path.basename(file,path.extname(file))===stem)score+=500;
    if(/enum\s+Params?Ids\b/.test(body))score+=200;if(/enum\s+Inputs?Ids\b/.test(body))score+=100;if(/enum\s+Outputs?Ids\b/.test(body))score+=100;if(/\bconfig\s*\(/.test(body))score+=100;if(/\bprocess\w*\s*\(/.test(body))score+=50;
    if(!best||score>best.score)best={file,source,body,score,namespace,typeDeclaration};
  }
  if(!best)fail(`Could not extract module class ${registration.moduleClass}`);
  const definitionIncludeIndex=resolvedIncludes.findIndex(file=>file===best.file),
    precedingHeaders=definitionIncludeIndex<0?[]:resolvedIncludes.slice(0,definitionIncludeIndex).filter(Boolean),
    registrationConstants=precedingHeaders.flatMap(file=>{
      const source=sourceWithoutIncludes(fs.readFileSync(file,"utf8"));
      const referencedTypes=declaredDependencyNames(source)
        .filter(name=>new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`).test(best.body))
        .map(name=>typeDeclarationSource(source,name))
        .filter(definition=>{
          if(!definition)return false;
          const header=definition.slice(0,definition.indexOf("{"));
          return!rackUiPattern.test(header.replace(/\b(?:struct|class)\s+[A-Za-z_]\w*/,""));
        });
      return[
        referencedDefinesWithoutPluginGlobals([file],best.body,sourceDir),
        namespaceGlobalDefinitions(source,best.body),
        ...referencedTypes,
      ].filter(Boolean)
    });
  if(registrationConstants.length)best.source=`${[...new Set(registrationConstants)].join("\n\n")}\n\n${best.source}`;
  return {...best,registrationSource};
}
function completeIncludeDirectiveLine(source,directive,allowTrailingComment=false){const lineStart=source.lastIndexOf("\n",directive.start-1)+1,lineEnd=source.indexOf("\n",directive.start),end=lineEnd<0?source.length:lineEnd,prefix=source.slice(lineStart,directive.start),suffix=source.slice(directive.start+directive.include.length,end),indent=(directive.angle?/^([ \t]*)#include[ \t]+<$/:/^([ \t]*)#include[ \t]+"$/).exec(prefix)?.[1],complete=directive.angle?(allowTrailingComment?/^>[ \t]*(?:\/\/[^\r\n]*)?\r?$/:/^>[ \t]*\r?$/):(allowTrailingComment?/^"[ \t]*(?:\/\/[^\r\n]*)?\r?$/:/^"[ \t]*\r?$/);return indent!==undefined&&complete.test(suffix)?{start:lineStart,end,indent}:null}
function withoutMatchingIncludeDirectiveLines(source,predicate){const removals=[];for(const directive of rustSourceDeclarations(source).includeDirectives){const line=completeIncludeDirectiveLine(source,directive);if(line&&predicate(directive))removals.push(line)}let result=source;for(const {start,end} of removals.reverse())result=result.slice(0,start)+result.slice(end);return result}
function includeDirectiveLine(source,directive){return directive.angle?null:completeIncludeDirectiveLine(source,directive,true)}
function resolvedClassBodyIncludeTarget(sourceDir,importer,directive){if(directive.target)return directive.target;const root=path.resolve(sourceDir),prefix=`${root}${path.sep}`,normalized=directive.include.split(/[\\/]+/).join(path.sep);return[path.resolve(path.dirname(importer),normalized),path.resolve(root,"src",normalized),path.resolve(root,normalized)].find(candidate=>(candidate===root||candidate.startsWith(prefix))&&fs.existsSync(candidate)&&fs.statSync(candidate).isFile())}
function expandClassBodyIncludes(body,file,sourceDir,macros=new Map,depth=0,directives=null){if(depth>=12)return body;let activeDefinitions=new Map(macros),cursor=0;const chunks=[];for(const directive of (directives??rustSourceDeclarations(body).includeDirectives).filter(candidate=>!candidate.angle)){const line=includeDirectiveLine(body,directive);if(!line||line.start<cursor)continue;const target=resolvedClassBodyIncludeTarget(sourceDir,file,directive);if(!target)continue;const expanded=preprocessMacroSource(stripHeaderGuardOpen(fs.readFileSync(target,"utf8")),activeDefinitions);activeDefinitions=expanded.definitions;const replacement=expandClassBodyIncludes(expanded.source,target,sourceDir,activeDefinitions,depth+1,expanded.includeDirectives).split("\n").map(value=>value?`${line.indent}${value}`:value).join("\n");chunks.push(body.slice(cursor,line.start),replacement);cursor=line.end}chunks.push(body.slice(cursor));return chunks.join("")}
function inheritedDefinitions(sourceFiles,source,className,rootTypeDeclaration=null){const found=[],visiting=new Set,definedNames=new Set,rawImplementations=(file,name)=>{const raw=fs.readFileSync(file,"utf8");return rawOutOfLineDefinitions(file,raw,name)};function visit(type){const resolvedType=resolveTypeAliases(sourceFiles,type);if(rackModuleBase(resolvedType))return;const name=baseTypeName(resolvedType),identity=resolvedType.replace(/\s/g,"");if(!name||visiting.has(identity)||definedNames.has(name))return;visiting.add(identity);let definition=null;for(const file of sourceFiles){const rawCandidateSource=fs.readFileSync(file,"utf8"),rawTypeDeclaration=rustTypeDeclaration(file,resolvedType),candidateSource=adaptDailyFortuneHost(rawCandidateSource),typeDeclaration=candidateSource===rawCandidateSource?rawTypeDeclaration:rustSourceTypeDeclaration(candidateSource,resolvedType),body=candidateSource===rawCandidateSource?rawTypeBody(file,rawCandidateSource,typeDeclaration,name):rustTypeBody(candidateSource,typeDeclaration);if(body!==null){const declared=typeDeclaration?.bases??[],template=templateContract(candidateSource,resolvedType,typeDeclaration),bindings=Object.fromEntries((template?.parameters??[]).map((parameter,index)=>[parameter,template.arguments[index]??parameter])),bases=declared.map(base=>substituteType(base,bindings)).map(base=>resolveTypeAliases(sourceFiles,base));definition={file,source:candidateSource,body,analysisBody:substituteType(body,bindings),name,namespace:typeDeclaration?.namespace??[],actualType:resolvedType,declaredBases:declared,bases,base:bases[0],templateDeclaration:template?.declaration??"",typeDeclaration};break}}if(!definition){found.push({name,missing:true});return}if(definition.base)visit(definition.base);definition.prelude=modulePrelude(definition.source,resolvedType,definition.typeDeclaration);definition.implementations=sourceFiles.flatMap(file=>rawImplementations(file,name));const availableSupportNames=declaredTypeNames(definition.prelude),supportNames=new Set,supportImplementations=[];let supportSource=[definition.body,...definition.declaredBases].join("\n");for(let depth=0;depth<16;depth++){const nextNames=availableSupportNames.filter(supportName=>!supportNames.has(supportName)&&new RegExp(`\\b${supportName}\\b`).test(supportSource));if(!nextNames.length)break;for(const supportName of nextNames){supportNames.add(supportName);const implementations=sourceFiles.flatMap(file=>rawImplementations(file,supportName));supportImplementations.push(...implementations);supportSource+=`\n${plainStructBody(definition.prelude,supportName)??""}\n${implementations.join("\n")}`}}definition.supportImplementations=[...new Set(supportImplementations)];definedNames.add(name);found.push(definition)}const template=templateContract(source,className,rootTypeDeclaration),bindings=Object.fromEntries((template?.parameters??[]).map((parameter,index)=>[parameter,template.arguments[index]??parameter])),declared=rootTypeDeclaration?.bases??declaredBases(source,className),base=substituteType(declared[0]??"",bindings);if(base&&!rackModuleBase(base))visit(base);return found}
function plainStructBody(source,className){const declaration=rustSourceTypeDeclaration(source,className);return declaration?rustTypeBody(source,declaration):null}
function secondaryBaseDefinitions(sourceFiles,bases){return bases.map(type=>{const name=baseTypeName(type);for(const file of sourceFiles){const source=fs.readFileSync(file,"utf8"),body=plainStructBody(source,name);if(body!==null){const namespaces=enclosingNamespaces(source,name),open=namespaces.map(namespace=>`namespace ${namespace} {`).join("\n"),close=namespaces.map(()=>"}").join("\n");return`${open}${open?"\n":""}struct ${name} {${body}\n};${close?`\n${close}`:""}`}}return""}).filter(Boolean).join("\n\n")}
function uiSecondaryBase(sourceFiles,type){const name=baseTypeName(type);if(rackUiPattern.test(type))return true;for(const file of sourceFiles){const source=fs.readFileSync(file,"utf8"),definition=classDefinitionSource(source,name);if(definition)return uiClassDefinition(definition,name)}return false}
function localPlainStructDefinitions(source,className,targetBody,excludedNames=new Set){
  const declarations=rustSourceDeclarations(source),target=matchingTypeDeclaration(declarations.typeDeclarations,className),limit=target?.declarationStart??source.length,found=[];
  for(const candidate of declarations.typeDeclarations){
    const name=candidate.name;
    if(candidate.declarationStart>=limit||!candidate.namespaceScope||!["struct","class"].includes(candidate.kind))continue;
    if(excludedNames.has(name)||!new RegExp(`\\b${name}\\b`).test(targetBody))continue;
    const definition=source.slice(candidate.declarationStart,candidate.declarationEnd).trim();
    if(uiClassDefinition(definition,name))continue;
    const safeDefinition=stripRackUiBlocks(definition);
    if(!new RegExp(`\\b(?:struct|class)\\s+${name}\\b`).test(safeDefinition))continue;
    const namespaceOpen=candidate.namespace.map(namespace=>`namespace ${namespace} {`).join("\n"),namespaceClose=candidate.namespace.map(()=>"}").reverse().join("\n");
    found.push(namespaceOpen?`${namespaceOpen}\n${safeDefinition}\n${namespaceClose}`:safeDefinition);
  }
  return[...new Set(found)].join("\n\n")
}
function parsedEnumInfo(name,value){
  const raw=value.replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/.*$/gm,"").trim(),
    active=preprocessMacroSource(raw,new Map()).source.trim(),identifiers=[],assignments={};
  for(const part of splitArguments(active)){
    const token=part.trim();
    if(!token)continue;
    const macro=/^(ENUMS|MULTIPLE|PER_CHANNEL|PER_STEP|ONE_PER_STEP|TWO_PER_STEP|PER_INPUT|TWO_OF)\s*\(([\s\S]*)\)$/.exec(token);
    if(macro){
      const args=splitArguments(macro[2]),base=args[0]?.trim(),count=args[1]?.trim();
      if(/^[A-Za-z_]\w*$/.test(base??"")){
        if(["ENUMS","MULTIPLE","PER_CHANNEL","PER_STEP","ONE_PER_STEP"].includes(macro[1])&&count)
          identifiers.push({base,count});
        else if(macro[1]==="TWO_PER_STEP"&&count)
          identifiers.push({base,count:`(${count}) * 2`});
        else if(macro[1]==="PER_INPUT")
          identifiers.push({base,count:"input_count"});
        else if(macro[1]==="TWO_OF")
          identifiers.push({base,count:"2"});
        continue;
      }
    }
    const id=/^([A-Za-z_]\w*)(?:\s*=\s*([\s\S]+))?$/.exec(token);
    if(id){identifiers.push(id[1]);if(id[2])assignments[id[1]]=id[2].trim()}
  }
  return{name,raw,identifiers,...(Object.keys(assignments).length?{assignments}:{})}
}
function rustEnumRecord(file,names,expectedScopes=[]){
  const declarations=activeEnumDeclarationsByFile?.get(path.resolve(file))??[],accepted=new Set(Array.isArray(names)?names:[names]),scope=declaration=>[...declaration.namespace,...declaration.owners.map(owner=>owner.name)],sameScope=(left,right)=>left.length===right.length&&left.every((part,index)=>part===right[index]),matches=declarations.filter(declaration=>declaration.complete&&declaration.name!==null&&accepted.has(declaration.name)),candidate=expectedScopes.length?matches.find(declaration=>expectedScopes.some(expected=>sameScope(scope(declaration),expected))):matches[0];
  if(!candidate)return null;
  const info={name:candidate.name,raw:candidate.raw,identifiers:candidate.identifiers.map(identifier=>typeof identifier==="string"?identifier:{...identifier}),...(Object.keys(candidate.assignments).length?{assignments:{...candidate.assignments}}:{}),scoped:candidate.scoped};
  return{info,declaration:fs.readFileSync(file,"utf8").slice(candidate.start,candidate.end)}
}
function rustEnumInfo(file,names,expectedScopes=[]){return rustEnumRecord(file,names,expectedScopes)?.info??null}
function enumInfo(body,names){
  const rust=rustSourceEnumInfo(body,names);if(rust)return rust;
  for(const name of Array.isArray(names)?names:[names]){
    const match=new RegExp(`enum\\s+(?:(class|struct)\\s+)?${name}(?:\\s*:\\s*[^\\{]+)?\\s*\\{([\\s\\S]*?)\\};`).exec(body||"");
    if(match)return{...parsedEnumInfo(name,match[2]),scoped:Boolean(match[1])}
  }
  return null
}
function enumRecordInNamespace(source,names,targetNamespace=[]){
  source=String(source??"");
  const accepted=new Set(Array.isArray(names)?names:[names]),candidate=rustSourceDeclarations(source).enumDeclarations.find(declaration=>declaration.complete&&declaration.name!==null&&accepted.has(declaration.name)&&declaration.owners.length===0&&declaration.namespace.length===targetNamespace.length&&declaration.namespace.every((namespace,index)=>namespace===targetNamespace[index]));
  return candidate?{info:rustEnumCandidateInfo(candidate),declaration:source.slice(candidate.start,candidate.end)}:null
}
export function enumInfoByTerminal(source,terminal){
  if(!/^[A-Za-z_]\w*$/.test(terminal??""))return null;
  for(const declaration of rustSourceDeclarations(String(source??"")).enumDeclarations){const last=[...declaration.identifiers].reverse().find(identifier=>typeof identifier==="string");if(declaration.complete&&last===terminal){const info=rustEnumCandidateInfo(declaration);if(!info.name)info.name=`__anonymous_${terminal}`;return info}}
  return null
}
function enumInfoByQualifiedAlias(source,qualified){const reference=/\b([A-Za-z_]\w*)::([A-Za-z_]\w*)\b/.exec(String(qualified??""));if(!reference)return null;const [,alias,terminal]=reference,declarations=rustSourceDeclarations(source||""),usingType=declarations.typeAliases.find(candidate=>candidate.name===alias)?.target,type=usingType??alias,name=baseTypeName(type),candidate=declarations.enumDeclarations.find(declaration=>declaration.complete&&declaration.owners.some(owner=>owner.name===name)&&[...declaration.identifiers].reverse().find(value=>typeof value==="string")===terminal);return candidate?{...rustEnumCandidateInfo(candidate),name}:null}
function rawStringEnd(source,start){if(source[start]!=="R"||source[start+1]!=='"')return-1;const open=source.indexOf("(",start+2);if(open<0||open-start>18)return-1;const delimiter=source.slice(start+2,open);if(!/^[^ ()\\\t\r\n]{0,16}$/.test(delimiter))return-1;const close=source.indexOf(`)${delimiter}"`,open+1);return close<0?source.length-1:close+delimiter.length+1}
function matchingBrace(source,open){let depth=0,quote="",lineComment=false,blockComment=false;for(let index=open;index<source.length;index++){const current=source[index],next=source[index+1];if(lineComment){if(current==="\n")lineComment=false;continue}if(blockComment){if(current==="*"&&next==="/"){blockComment=false;index++}continue}if(quote){if(current==="\\")index++;else if(current===quote)quote="";continue}const rawEnd=rawStringEnd(source,index);if(rawEnd>=0){index=rawEnd;continue}if(current==="/"&&next==="/"){lineComment=true;index++;continue}if(current==="/"&&next==="*"){blockComment=true;index++;continue}if(current==='"'||current==="'"){quote=current;continue}if(current==="{")depth++;else if(current==="}"&&--depth===0)return index}return -1}
const codePositionCache=new Map;
function codePositionIndex(source){
  const cached=codePositionCache.get(source);if(cached){codePositionCache.delete(source);codePositionCache.set(source,cached);return cached}
  const positions=new Uint8Array(source.length+1);let quote="",lineComment=false,blockComment=false;
  for(let index=0;index<source.length;index++){
    positions[index]=quote||lineComment||blockComment?0:1;
    const current=source[index],next=source[index+1];
    if(lineComment){if(current==="\n")lineComment=false;continue}
    if(blockComment){if(current==="*"&&next==="/"){blockComment=false;index++}continue}
    if(quote){if(current==="\\")index++;else if(current===quote)quote="";continue}
    const rawEnd=rawStringEnd(source,index);if(rawEnd>=0){index=rawEnd;continue}
    if(current==="/"&&next==="/"){lineComment=true;index++;continue}
    if(current==="/"&&next==="*"){blockComment=true;index++;continue}
    if(current==='"'||current==="'")quote=current
  }
  positions[source.length]=quote||lineComment||blockComment?0:1;
  if(codePositionCache.size>=16)codePositionCache.delete(codePositionCache.keys().next().value);
  codePositionCache.set(source,positions);return positions
}
function isCodePosition(source,position){const target=Math.max(0,Math.min(source.length,Number(position)||0));return Boolean(codePositionIndex(source)[target])}
function namespaceStackAt(source,position){const active=[],braces=[];let quote="",lineComment=false,blockComment=false;for(let index=0;index<position;index++){const current=source[index],next=source[index+1];if(lineComment){if(current==="\n")lineComment=false;continue}if(blockComment){if(current==="*"&&next==="/"){blockComment=false;index++}continue}if(quote){if(current==="\\")index++;else if(current===quote)quote="";continue}const rawEnd=rawStringEnd(source,index);if(rawEnd>=0){index=rawEnd;continue}if(current==="/"&&next==="/"){lineComment=true;index++;continue}if(current==="/"&&next==="*"){blockComment=true;index++;continue}if(current==='"'||current==="'"){quote=current;continue}if(current==="{"){const prefix=source.slice(Math.max(0,index-200),index),namespace=/(?:^|[;{}\n])\s*(?:inline\s+)?namespace\s+([A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)\s*$/.exec(prefix),names=namespace?namespace[1].split("::"):[];braces.push(names);active.push(...names)}else if(current==="}"){const names=braces.pop()??[];if(names.length)active.splice(-names.length)}}return active}
const scopeDepthCache=new Map;
function scopeDepthIndex(source){
  const cached=scopeDepthCache.get(source);if(cached)return cached;
  const positions=[0],braceDepths=[0],namespaceDepths=[0],braces=[];let braceDepth=0,namespaceDepth=0,quote="",lineComment=false,blockComment=false;
  for(let index=0;index<source.length;index++){
    const current=source[index],next=source[index+1];
    if(lineComment){if(current==="\n")lineComment=false;continue}
    if(blockComment){if(current==="*"&&next==="/"){blockComment=false;index++}continue}
    if(quote){if(current==="\\")index++;else if(current===quote)quote="";continue}
    const rawEnd=rawStringEnd(source,index);if(rawEnd>=0){index=rawEnd;continue}
    if(current==="/"&&next==="/"){lineComment=true;index++;continue}
    if(current==="/"&&next==="*"){blockComment=true;index++;continue}
    if(current==='"'||current==="'"){quote=current;continue}
    if(current==="{"){
      const prefix=source.slice(Math.max(0,index-200),index),namespace=/(?:^|[;{}\n])\s*(?:inline\s+)?namespace(?:\s+[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)?\s*$/.test(prefix);
      braces.push(namespace);braceDepth++;if(namespace)namespaceDepth++;
    }else if(current==="}"){
      const namespace=braces.pop();braceDepth=Math.max(0,braceDepth-1);if(namespace)namespaceDepth=Math.max(0,namespaceDepth-1);
    }else continue;
    positions.push(index+1);braceDepths.push(braceDepth);namespaceDepths.push(namespaceDepth);
  }
  const result={positions,braceDepths,namespaceDepths};if(scopeDepthCache.size>=64)scopeDepthCache.delete(scopeDepthCache.keys().next().value);scopeDepthCache.set(source,result);return result
}
function scopeDepthAt(source,position){const index=scopeDepthIndex(source),target=Math.max(0,Math.min(source.length,position));let low=0,high=index.positions.length;while(low<high){const middle=(low+high)>>1;if(index.positions[middle]<=target)low=middle+1;else high=middle}const resolved=Math.max(0,low-1);return{brace:index.braceDepths[resolved],namespace:index.namespaceDepths[resolved]}}
function namespaceBraceDepthAt(source,position){return scopeDepthAt(source,position).namespace}
function braceDepthAt(source,position){return scopeDepthAt(source,position).brace}
function isNamespaceScopeAt(source,position){const depth=scopeDepthAt(source,position);return depth.brace===depth.namespace}
function outOfLineDefinitions(source,className,preserveNamespace=false,fallbackNamespaces=[]){return rustSourceOutOfLineDefinitions(source,className,new Set(["function","defaulted"]),preserveNamespace,fallbackNamespaces)}
function outOfLineFreeFunctionDefinitions(source,functionName,preserveNamespace=false,fallbackNamespaces=[]){const name=baseTypeName(functionName).split("::").at(-1),report=rustSourceDeclarations(source),candidates=[...report.freeFunctionDefinitions.filter(candidate=>candidate.name===name).map(candidate=>({...candidate,qualified:false})),...report.outOfLineDefinitions.filter(candidate=>candidate.kind==="function"&&candidate.callableKind==="function"&&baseTypeName(candidate.member).split("::").at(-1)===name).map(candidate=>({...candidate,qualified:true}))].sort((left,right)=>left.start-right.start),found=[];for(const candidate of candidates){let definition=candidate.rawDefinition;if(preserveNamespace&&!candidate.qualified){const effectiveNamespaces=candidate.namespace.length?candidate.namespace:fallbackNamespaces;if(effectiveNamespaces.length)definition=`${effectiveNamespaces.map(namespace=>`namespace ${namespace} {`).join("\n")}\n${definition}\n${effectiveNamespaces.map(()=>"}").join("\n")}`}found.push(definition)}return[...new Set(found)]}
function outOfLineStaticDefinitions(source,className,preserveNamespace=false,fallbackNamespaces=[]){return rustSourceOutOfLineDefinitions(source,className,new Set(["static"]),preserveNamespace,fallbackNamespaces)}
function namespaceStatementEnd(source,start){
  let parentheses=0,brackets=0,braces=0,quote="",lineComment=false,blockComment=false;
  for(let index=start;index<source.length;index++){
    const current=source[index],next=source[index+1];
    if(lineComment){if(current==="\n")lineComment=false;continue}
    if(blockComment){if(current==="*"&&next==="/"){blockComment=false;index++}continue}
    if(quote){if(current==="\\")index++;else if(current===quote)quote="";continue}
    if(current==="/"&&next==="/"){lineComment=true;index++;continue}
    if(current==="/"&&next==="*"){blockComment=true;index++;continue}
    if(current==='"'||current==="'"){quote=current;continue}
    if(current==="(")parentheses++;
    else if(current===")")parentheses=Math.max(0,parentheses-1);
    else if(current==="[")brackets++;
    else if(current==="]")brackets=Math.max(0,brackets-1);
    else if(current==="{")braces++;
    else if(current==="}"){if(braces===0)return-1;braces--}
    else if(current===";"&&parentheses===0&&brackets===0&&braces===0)return index+1
  }
  return-1
}
function browserModelIdentityDefinition(definition){const match=/^([\s\S]*?\bModel\s*\*\s*[A-Za-z_]\w*)\s*=\s*create[A-Za-z0-9_]*Model\s*<[\s\S]+?>\s*\(\s*("(?:\\.|[^"\\])*")(?:\s*,[\s\S]*)?\)\s*;$/s.exec(definition.trim());return match?`${match[1]} = new Model{${match[2]}};`:definition}
function namespaceGlobalDefinitions(source,reference,relativeNamespace=[],existing="",file=null){const candidates=[];for(const candidate of file?rustNamespaceVariableDeclarations(file,source):rustSourceDeclarations(source).namespaceVariableDeclarations){if(candidate.externDeclaration)continue;let definition=browserModelIdentityDefinition(candidate.rawDeclaration);const namespaces=candidate.namespace,relative=relativeNamespace.length<=namespaces.length&&relativeNamespace.every((name,index)=>namespaces[index]===name)?namespaces.slice(relativeNamespace.length):namespaces;if(relative.length)definition=`${relative.map(namespace=>`namespace ${namespace} {`).join("\n")}\n${definition}\n${relative.map(()=>"}").join("\n")}`;candidates.push({name:candidate.name,definition})}const selected=new Set;let expanded=String(reference??"");for(let pass=0;pass<candidates.length;pass++){let changed=false;for(const candidate of candidates){if(selected.has(candidate)||!new RegExp(`\\b${candidate.name}\\b`).test(expanded))continue;selected.add(candidate);expanded+=`\n${candidate.definition}`;changed=true}if(!changed)break}return[...new Set(candidates.filter(candidate=>selected.has(candidate)&&!String(existing).includes(candidate.definition)).map(candidate=>candidate.definition))].join("\n")}
function referencedExternGlobalDefinitions(sourceFiles,reference,existing=""){
  const referenceSource=String(reference??""),
    names=[...new Set(rustSourceDeclarations(referenceSource).namespaceVariableDeclarations.filter(candidate=>candidate.externDeclaration).map(candidate=>candidate.name))];
  if(!names.length)return[];
  const nameReference=names.join("\n"),definitions=[],known=String(existing??"");
  for(const file of sourceFiles){
    if(!fs.existsSync(file)||!fs.statSync(file).isFile())continue;
    const source=stripRackUiBlocks(flattenExternCWrappers(sourceWithoutIncludes(stripHeaderGuardOpen(fs.readFileSync(file,"utf8"))))),
      selected=namespaceGlobalDefinitions(source,nameReference,[],`${known}\n${definitions.join("\n")}`);
    if(selected)definitions.push(selected);
  }
  return [...new Set(definitions)];
}
function exactNamespaceGlobalDefinitions(source,reference,targetNamespace=[]){
  const candidates=[];
  for(const candidate of rustSourceDeclarations(source).namespaceVariableDeclarations){
    if(/^extern\b/.test(candidate.rawDeclaration)||candidate.namespace.length!==targetNamespace.length||!candidate.namespace.every((name,index)=>name===targetNamespace[index]))continue;
    candidates.push({name:candidate.name,definition:browserModelIdentityDefinition(candidate.rawDeclaration)});
  }
  const selected=new Set;let expanded=String(reference??"");
  for(let pass=0;pass<candidates.length;pass++){let changed=false;for(const candidate of candidates){if(selected.has(candidate)||!new RegExp(`\\b${candidate.name}\\b`).test(expanded))continue;selected.add(candidate);expanded+=`\n${candidate.definition}`;changed=true}if(!changed)break}
  return[...new Set(candidates.filter(candidate=>selected.has(candidate)).map(candidate=>candidate.definition))];
}
function removeOutOfLineDefinitions(source,className){const name=baseTypeName(className).split("::").at(-1),ranges=rustSourceDeclarations(source).outOfLineDefinitions.filter(candidate=>candidate.kind==="function"&&candidate.ownerChain.includes(name)).map(candidate=>[candidate.start,candidate.end]);let result=source;for(const [start,end] of ranges.reverse())result=result.slice(0,start)+result.slice(end);return result}
function removeTemplatedOutOfLineDefinitions(source,className){
  const definitions=outOfLineDefinitions(source,className);
  for(const definition of definitions){
    const index=source.indexOf(definition);
    if(index>=0)source=source.slice(0,index)+source.slice(index+definition.length);
  }
  source=removeOutOfLineDefinitions(source,className);
  if(className==="GRULayer")source=removeOutOfLineDefinitions(source,"WeightSet");
  return source.replace(/^[ \t]*template\s*<[^>\n]+>[ \t]*\r?\n(?=[ \t\r\n]*})/gm,"")
}
function namespaceUsingDirectiveDeclarations(source){return rustSourceNamespaceUsingDirectives(source).map(candidate=>candidate.namespace.length?`${candidate.namespace.map(namespace=>`namespace ${namespace} {`).join("\n")}\n${candidate.rawDeclaration}\n${candidate.namespace.map(()=>"}").join("\n")}`:candidate.rawDeclaration)}
function implementationSupportDeclarations(source,implementation){
  const found=[],supportFunctions=[],known=new Set,aliases=rustSourceTypeAliases(source).filter(alias=>alias.owners.length===0),freeFunctions=rustSourceFreeFunctionDefinitions(source);let reference=String(implementation??"");
  for(let depth=0;depth<16;depth++){
    let changed=false;
    for(const alias of aliases){const {name,definition}=alias;if(known.has(definition)||!new RegExp(`\\b${name}\\b`).test(reference))continue;known.add(definition);found.push(definition);reference+=`\n${definition}`;changed=true}
    for(const candidate of freeFunctions){const {name,definition,rawDefinition}=candidate;if(!new RegExp(`\\b${name}(?:\\s*<[^;{}]+>)?\\s*\\(`).test(reference)||known.has(definition)||implementation.includes(definition)||implementation.includes(rawDefinition))continue;known.add(definition);found.push(definition);supportFunctions.push(candidate);reference+=`\n${definition}`;changed=true}
    if(!changed)break;
  }
  const usingDeclarations=found.length?namespaceUsingDirectiveDeclarations(source):[],functionDeclarations=supportFunctions.map(candidate=>freeFunctionForwardDeclaration(candidate));return[...new Set([...functionDeclarations,...usingDeclarations,...found].filter(Boolean))].join("\n")
}
function referencedLocalFreeFunctionDefinitionFacts(source,reference,file=null){
  const candidates=new Map,referencesByName=new Map,append=candidate=>{const {name,definition,references=[]}=candidate;if(hasRackUiReference(definition)||/\bNVG(?:color|context)\b|\bnvg[A-Z]\w*\s*\(/.test(definition)||/\bAPP\s*->\s*(?!engine\b)/.test(definition))return;if(!candidates.has(name))candidates.set(name,[]);candidates.get(name).push(candidate);const known=referencesByName.get(name)??new Set;for(const reference of references)known.add(reference);referencesByName.set(name,known)},rustCandidates=file?rustFreeFunctionDefinitions(file,source):rustSourceFreeFunctionDefinitions(source);
  for(const candidate of rustCandidates)append(candidate);
  const selected=[],seen=new Set,structuredReferences=new Set,rootReference=sourceWithoutCommentsAndLiterals(reference);let expanded=reference;
  for(let pass=0;pass<candidates.size;pass++){
    let changed=false;
    for(const [name,facts] of candidates){
      const referenced=structuredReferences.has(name)||new RegExp(`\\b${name}(?:\\s*<[^;{}]+>)?\\s*(?:\\(|(?=[,);}\\]]))`).test(rootReference);
      if(seen.has(name)||!referenced||outOfLineFreeFunctionDefinitions(expanded,name).length)continue;
      seen.add(name);changed=true;
      for(const candidate of facts){selected.push(candidate);expanded+=`\n${candidate.definition}`}
      for(const dependency of referencesByName.get(name)??[])structuredReferences.add(dependency)
    }
    if(!changed)break
  }
  return[...new Map(selected.map(candidate=>[candidate.definition,candidate])).values()]
}
function referencedLocalFreeFunctionDefinitions(source,reference,file=null){return referencedLocalFreeFunctionDefinitionFacts(source,reference,file).map(candidate=>candidate.definition)}
function explicitSpecializationForwardDeclarations(definitions){
  const declarations=[];
  for(const definition of definitions){
    const marker=/\btemplate\s*<\s*>/.exec(definition);
    if(!marker)continue;
    const open=definition.indexOf("{",marker.index);
    if(open<0)continue;
    const signature=definition.slice(marker.index,open).trim();
    if(!/::\s*(?:operator\s*(?:\[\]|\(\)|[+*/%<>=!&|^~-]+)|~?[A-Za-z_]\w*)\s*\(/.test(signature))continue;
    const namespaces=namespaceStackAt(definition,marker.index);
    const declaration=`${signature};`;
    declarations.push(namespaces.length?`${namespaces.map(namespace=>`namespace ${namespace} {`).join("\n")}\n${declaration}\n${namespaces.map(()=>"}").join("\n")}`:declaration)
  }
  return[...new Set(declarations)]
}
function insertExplicitSpecializationForwardDeclarations(source){
  const declarationsByOwner=new Map;
  for(const name of declaredTypeNames(source)){
    for(const declaration of explicitSpecializationForwardDeclarations(outOfLineDefinitions(source,name))){
      const owner=[...declaration.matchAll(/\b([A-Za-z_]\w*)\s*(?:<[^;{}\n]+>)?\s*::/g)].at(-1)?.[1];
      if(!owner||source.includes(`\n${declaration}\n`))continue;
      const declarations=declarationsByOwner.get(owner)??[];
      declarations.push(declaration);
      declarationsByOwner.set(owner,declarations)
    }
  }
  let result=source;
  for(const [owner,declarations] of declarationsByOwner){
    const definition=classDefinitionSource(result,owner);
    if(definition)result=result.replace(definition,`${definition}\n\n${[...new Set(declarations)].join("\n\n")}`)
  }
  return result
}
function dedupeFreeFunctionDefinitions(source){const seen=new Set,ranges=[];for(const candidate of rustSourceFreeFunctionDefinitions(source)){const key=JSON.stringify([candidate.namespace,candidate.signature,candidate.rawDefinition]);if(seen.has(key))ranges.push([candidate.start,candidate.end]);else seen.add(key)}let result=source;for(const [start,end] of ranges.reverse())result=result.slice(0,start)+result.slice(end);return result}
function classImplementations(sourceFiles,preferredFile,className){
  const collect=(source,file)=>{
    let definitions=[...rawOutOfLineStaticDefinitions(file,source,className),...rawOutOfLineDefinitions(file,source,className)];
    definitions=definitions.map(definition=>{
      if(!hostOnlyRuntimePattern.test(definition))return definition;
      const open=definition.indexOf("{");
      return open<0?definition:stubHostUiMethod(definition,definition.slice(0,open));
    });
    if(baseTypeName(className)==="BufferSludger")definitions=definitions.map(definition=>{
      definition=replaceOutOfLineMethod(definition,className,"loadWavFile",`void ${className}::loadWavFile() {}`);
      if(/\bBufferSludger::process\s*\(/.test(definition)){definition=definition.replace(/\n\s*BufferSludgerTransposer\s*\*\s*transposerExtendor[\s\S]*?\n\s*automationMode\s*=/,"\n\tautomationMode =");definition=stripConditionalBlocks(definition,condition=>/\btransposerExtendor\b/.test(condition))}
      return definition
    });
    const freeFunctions=referencedLocalFreeFunctionDefinitions(source,definitions.join("\n\n"),file),quantityHelpers=paramQuantityHelpers(source,[...freeFunctions,...definitions].join("\n\n")).map(helper=>helper.source),support=implementationSupportDeclarations(source,[...quantityHelpers,...freeFunctions,...definitions].join("\n\n")),globals=namespaceGlobalDefinitions(source,[support,...quantityHelpers,...freeFunctions,...definitions].join("\n\n"));
    return[...new Set([globals,support,...quantityHelpers,...freeFunctions,...definitions].filter(Boolean))]
  },preferred=collect(fs.readFileSync(preferredFile,"utf8"),preferredFile),remaining=sourceFiles.filter(file=>path.resolve(file)!==path.resolve(preferredFile)).flatMap(file=>collect(fs.readFileSync(file,"utf8"),file));
  return[...new Set([...preferred,...remaining])]
}
function preludeTypeImplementations(sourceFiles,prelude,reference,excludedType,preferredFile=null){
  const candidates=declaredDependencyNames(prelude).filter(name=>name!==baseTypeName(excludedType)),expandedTypes=new Set,selected=new Set,implementations=[],implementationFiles=new Set,sourceCache=new Map,sourceForFile=file=>{let source=sourceCache.get(file);if(source===undefined){source=fs.readFileSync(file,"utf8");sourceCache.set(file,source)}return source};let expanded=reference;
  for(let pass=0;pass<candidates.length*2;pass++){
    let changed=false,searchable=sourceWithoutCommentsAndLiterals(expanded);
    for(const name of candidates){
      const anyReference=new RegExp(`(?:\\b${name}\\b\\s*::\\s*[A-Za-z_]\\w*\\s*\\(|\\bnew\\s*(?:\\([^;{}]*\\)\\s*)?${name}\\b|\\b(?:class|struct)\\s+${name}\\b\\s*(?:[*&]\\s*)*[A-Za-z_]\\w*|\\b${name}\\b\\s*(?:[*&]\\s*)*[A-Za-z_]\\w*)`).test(searchable);
      if(anyReference&&!expandedTypes.has(name)){expandedTypes.add(name);expanded+=`\n${typeDeclarationSource(prelude,name)}`;searchable=sourceWithoutCommentsAndLiterals(expanded);changed=true}
      const implementationReference=new RegExp(`(?:\\b${name}\\b\\s*::\\s*[A-Za-z_]\\w*\\s*\\(|\\bnew\\s*(?:\\([^;{}]*\\)\\s*)?${name}\\b|\\b(?:class|struct)\\s+${name}\\b\\s*(?:[*&]\\s*)*[A-Za-z_]\\w*|\\b${name}\\b\\s*(?:[*&]\\s*)*[A-Za-z_]\\w*)`).test(searchable);
      if(selected.has(name)||!implementationReference)continue;
      if(process.env.RACK_WEB_DEBUG_DEPENDENCIES){const index=searchable.search(new RegExp(`\\b${name}\\b`));console.error(JSON.stringify({preludeImplementation:name,context:searchable.slice(Math.max(0,index-100),index+220)},null,2))}
      selected.add(name);changed=true;
      const definitionsByFile=sourceFiles.map(file=>{const source=sourceForFile(file),hasScopedDefinition=source.includes(`${name}::`)||source.includes(`${name}<`);return{file,definitions:hasScopedDefinition?rawOutOfLineDefinitions(file,source,name,true).filter(definition=>!rackUiPattern.test(definition.replace(/\b(?:rack::math::|math::)?Vec\b/g,""))):[]}}),preferredDefinitions=preferredFile?definitionsByFile.find(item=>path.resolve(item.file)===path.resolve(preferredFile)&&item.definitions.length):null,implementationDefinitions=preferredDefinitions?[preferredDefinitions]:definitionsByFile;
      for(const {file,definitions} of implementationDefinitions)for(const definition of definitions){
        if(implementations.includes(definition))continue;
        implementations.push(definition);implementationFiles.add(file);expanded+=`\n${definition}`;
      }
      searchable=sourceWithoutCommentsAndLiterals(expanded);
    }
    if(!changed)break;
  }
  const directories=new Set([...implementationFiles].map(file=>path.dirname(file))),supportFiles=sourceFiles.filter(file=>/\.(?:c|cc|cpp|cxx)$/.test(file)&&directories.has(path.dirname(file))),support=[],known=new Set;let supportReference=implementations.join("\n");for(let pass=0;pass<16;pass++){let changed=false;for(const file of supportFiles){const source=sourceForFile(file);for(const candidate of referencedLocalFreeFunctionDefinitionFacts(source,supportReference,file)){if(known.has(candidate.definition))continue;known.add(candidate.definition);support.push({source,...candidate});supportReference+=`\n${candidate.definition}`;changed=true}}if(!changed)break}const declarations=support.map(candidate=>freeFunctionForwardDeclaration(candidate)).filter(Boolean),usingDirectives=[...new Set(support.flatMap(({source})=>namespaceUsingDirectiveDeclarations(source)))],globals=[...new Set(support.map(({source})=>namespaceGlobalDefinitions(source,support.map(item=>item.definition).join("\n"))).filter(Boolean))];return[...new Set(declarations),...usingDirectives,...globals,...support.map(item=>item.definition),...implementations]
}
function specializeConstantBranches(source,constants){let result=source;for(let pass=0;pass<32;pass++){const guard=/\bif\s*\(\s*([A-Za-z_]\w*)\s*(==|!=)\s*(-?\d+)\s*\)\s*\{/g,match=[...result.matchAll(guard)].find(item=>Object.hasOwn(constants,item[1]));if(!match)break;const open=result.indexOf("{",match.index),close=matchingBrace(result,open);if(close<0)break;let end=close+1,alternative="",cursor=end;while(/\s/.test(result[cursor]??""))cursor++;if(result.slice(cursor,cursor+4)==="else"){cursor+=4;while(/\s/.test(result[cursor]??""))cursor++;if(result[cursor]==="{"){const alternativeClose=matchingBrace(result,cursor);if(alternativeClose>cursor){alternative=result.slice(cursor+1,alternativeClose);end=alternativeClose+1}}}const equal=Number(constants[match[1]])===Number(match[3]),active=(match[2]==="=="?equal:!equal)?result.slice(open+1,close):alternative;result=result.slice(0,match.index)+active+result.slice(end)}return result}
function matchingParenthesis(source,open){let depth=0,quote="",lineComment=false,blockComment=false;for(let index=open;index<source.length;index++){const current=source[index],next=source[index+1];if(lineComment){if(current==="\n")lineComment=false;continue}if(blockComment){if(current==="*"&&next==="/"){blockComment=false;index++}continue}if(quote){if(current==="\\")index++;else if(current===quote)quote="";continue}const rawEnd=rawStringEnd(source,index);if(rawEnd>=0){index=rawEnd;continue}if(current==="/"&&next==="/"){lineComment=true;index++;continue}if(current==="/"&&next==="*"){blockComment=true;index++;continue}if(current==='"'||current==="'"){quote=current;continue}if(current==="(")depth++;else if(current===")"&&--depth===0)return index}return-1}
function widgetTemplateType(source,start){let index=start;while(/\s/.test(source[index]??""))index++;if(source[index]!=="<")return"";let depth=0;for(let cursor=index;cursor<source.length;cursor++){if(source[cursor]==="<")depth++;else if(source[cursor]===">"){depth--;if(depth===0)return source.slice(index+1,cursor).trim()}}return""}
function replaceIdentifierOutsideStrings(source,name,value){const pattern=new RegExp(`\\b${name}\\b`,"g");return source.split(/("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')/).map((part,index)=>index%2?part:part.replace(pattern,String(value))).join("")}
function snapAssignmentArgument(source){
  const direct=/^\s*paramQuantities\s*\[\s*([^\]]+?)\s*\]\s*->\s*snapEnabled\s*=\s*true\s*;\s*$/.exec(source),getter=/^\s*(?:[A-Za-z_]\w*\s*->\s*)?getParamQuantity\s*\(\s*([^)]+?)\s*\)\s*->\s*snapEnabled\s*=\s*true\s*;\s*$/.exec(source);
  return(direct?.[1]??getter?.[1])?.trim()??null
}
function sourceWithoutComments(source){let result="",quote="",lineComment=false,blockComment=false;for(let index=0;index<source.length;index++){const current=source[index],next=source[index+1];if(lineComment){if(current==="\n"){lineComment=false;result+="\n"}else result+=" ";continue}if(blockComment){if(current==="*"&&next==="/"){blockComment=false;result+="  ";index++}else result+=current==="\n"?"\n":" ";continue}if(quote){result+=current;if(current==="\\"){result+=next??"";index++}else if(current===quote)quote="";continue}if(current==="/"&&next==="/"){lineComment=true;result+="  ";index++;continue}if(current==="/"&&next==="*"){blockComment=true;result+="  ";index++;continue}if(current==='"'||current==="'")quote=current;result+=current}return result}
function sourceWithoutCommentsAndLiterals(source){return sourceWithoutComments(source).replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,literal=>literal.replace(/[^\n]/g," "))}
function features(source){const code=sourceWithoutComments(source),checks=[["custom-state",/dataToJson|dataFromJson|saveToJson|loadFromJson/],["expanders",/\.\s*(?:left|right)Expander|Expander/],["simd",/\bsimd::|\bfloat_4\b/],["rack-dsp",/\bdsp::/],["assets",/\basset::|createPatchStorageDirectory|getPatchStorageDirectory/],["filesystem",/\bsystem::/],["network",/\b(?:OSCServer|MdnsServer)\b|(?:^|[^A-Za-z0-9_.>:])(?:::)?(?:socket|bind|connect|listen|accept|recvfrom|sendto|getaddrinfo|mdns_[A-Za-z0-9_]*)\s*\(|(?:^|[^A-Za-z0-9_.>:])(?:::)?(?:recv|send)\s*\([^();\n]*,[^();\n]*,[^();\n]*,/],["dynamic-linking",/\b(?:dlopen|dlsym|dlclose|LoadLibraryA|GetProcAddress|FreeLibrary)\s*\(/],["rack-app",/\bAPP->/],["json",/\bjson_/],["sample-rate-event",/onSampleRateChange|sampleRateChange/],["bypass-routes",/configBypass/]];return checks.filter(([,pattern])=>pattern.test(code)).map(([name])=>name)}
function browserAssetSamplerContract(source){
  const midiFilePlayer=[/\bstruct\s+MIDIFile\s*:\s*smf::MidiFile\b/,/\bMIDIFile\s+midiFile\b/,/\bvoid\s+processMessage\s*\(/,/\bfileLoaded\b/,/\bplayingEvent\b/];
  if(midiFilePlayer.every(pattern=>pattern.test(source)))return{type:"midi",maxSamples:4194304,maxSeconds:0,channels:1,mode:"midi-file"};
  const luaScriptModule=[/\blua_State\s*\*\s*L\b/,/\bcreateLuaState\s*\(/,/\bscriptLoaded\b/,/\bscriptSetVoltage\s*\(/,/\bSCRIPT_PORTS\b/];
  if(luaScriptModule.every(pattern=>pattern.test(source)))return{type:"script",maxSamples:262144,maxSeconds:0,channels:1,mode:"lua-script"};
  const octobirImpulsePair=[/\boctob::IRProcessor\b/,/\bloadImpulseResponse1\s*\(/,/\bloadImpulseResponse2\s*\(/,/\bgetCurrentInputLevelDb\s*\(/];
  if(octobirImpulsePair.every(pattern=>pattern.test(source)))return{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2,mode:"octobir-ir-pair",slots:2};
  const lomasAdvancedSampler=[/\bvector\s*<\s*AudioClip\s*>\s+clip_cache_\b/,/\bMAX_FILES\b/,/\bgetSamplePhase\s*\(/,/\bstartRec\s*\(/,/\bswitchRec\s*\(/];
  if(lomasAdvancedSampler.every(pattern=>pattern.test(source)))return{type:"audio",maxSamples:960000,maxSeconds:10,channels:2,mode:"lomas-advanced-sampler"};
  const resizableImageBlank=[/\bSLIDESHOW_ACTIVE\b/,/\bCROSSFADE_TIME\b/,/\bimageFitEnum\b/,/\bhidePanel\b/,/\bzoomX\b/];
  if(resizableImageBlank.every(pattern=>pattern.test(source)))return{type:"image",maxSamples:4194304,maxSeconds:0,channels:4,mode:"rgba-image"};
  const rgbaImage=[/\blodepng::decode\s*\(\s*image\s*,\s*width\s*,\s*height\b/,/\bvector\s*<\s*unsigned\s+char\s*>\s*image\b/,/\bPFFFT_Setup\s*\*/,/\bunsigned\s+width\b/,/\bunsigned\s+height\b/];
  if(rgbaImage.every(pattern=>pattern.test(source)))return{type:"image",maxSamples:4194304,maxSeconds:0,channels:4,mode:"rgba-image"};
  const rgbPointerImage=[/\bunsigned\s+char\s*\*\s*imageData\b/,/\bint\s+imageWidth\b/,/\bint\s+imageHeight\b/,/\breadPixelAtPlayhead\s*\(/,/\bcurrentRed\b/,/\bcurrentGreen\b/,/\bcurrentBlue\b/];
  if(rgbPointerImage.every(pattern=>pattern.test(source)))return{type:"image",maxSamples:4194304,maxSeconds:0,channels:4,mode:"rgba-image",storage:"rgb-pointer"};
  const earlevelWavetable=[/\bWavetable::Wavetable\s*\*\s*wavetable\b/,/\bcurrentTableName\b/,/\bvoid\s+loadWavetable\s*\(\s*std::string\s+path\s*,\s*int\s+cycleLength\s*\)/,/\bPOS_PARAM\b/,/\bLOADED_LIGHT\b/];
  if(earlevelWavetable.every(pattern=>pattern.test(source)))return{type:"audio",maxSamples:524288,maxSeconds:0,channels:2,mode:"earlevel-wavetable"};
  const fundamentalWavetableType=/\b(Wavetable|PhasorWavetableData)\s+wavetable\b/.exec(source)?.[1],
    fundamentalWavetable=[/\bwavetable\.waveLen\b/,/\bwavetable\.(?:interpolatedAt|at)\s*\(/,/\bwavetable\.reset\s*\(/];
  if(fundamentalWavetableType&&fundamentalWavetable.every(pattern=>pattern.test(source)))return{type:"audio",maxSamples:65536,maxSeconds:0,channels:2,mode:"fundamental-wavetable",structure:fundamentalWavetableType};
  const wavetable=[/\bwtTable\s+table\b/,/\bwtOscillator\s*</,/\btable\.loadSample\s*\(/,/\bRECWT_PARAM\b/,/\bRECFRAME_PARAM\b/];
  if(wavetable.every(pattern=>pattern.test(source)))return{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2,mode:"wavetable"};
  const urlAudio=[/\bDoubleRingBuffer\s*<\s*dsp::Frame<2>/,/\bdataAudioRingBuffer\b/,/\bstd::string\s+url\b/,/\bOUTL_OUTPUT\b/,/\bOUTR_OUTPUT\b/];
  if(urlAudio.every(pattern=>pattern.test(source)))return{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2,mode:"url-audio",url:true};
  const audioFileTape=[/\bAudioFile\s*<\s*float\s*>\s+audioFile\b/,/\bsizeAudioBuffer\b/,/\btrackCountParam\b/,/\btapeLengthParam\b/,/\baudioBufferPosition\b/,/\bcalcAudio\s*\(/];
  if(audioFileTape.every(pattern=>pattern.test(source)))return{type:"audio",maxSamples:1920000,maxSeconds:10,channels:4,mode:"audiofile-tape"};
  const bufferSludger=[/\bstd::array\s*<\s*std::vector\s*<\s*float\s*>\s*,\s*2\s*>\s+samples\b/,/\bvoid\s+loadWavFile\s*\(/,/\bfloat\s+masterLength\b/,/\bbool\s+isStereo\b/,/\bBPM_PARAM\b/];
  if(bufferSludger.every(pattern=>pattern.test(source)))return{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2,mode:"buffer-sludger"};
  const monoResampler=[/\bwaves::getMonoWav\s*\(/,/\btotalSampleCount\b/,/\bfloat\s*\*\s*sample\b/,/\bfloat\s*\*\s*rev_sample\b/,/\bmip_map\.init_sample\s*\(/,/\brev_mip_map\.init_sample\s*\(/,/\bvoices\s*\[/,/\brev_voices\s*\[/,/\binterp_pack\b/,/\bmylock\b/];
  if(monoResampler.every(pattern=>pattern.test(source)))return{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2,mode:"mono-resampler"};
  const monoSlots=[/\bwaves::getMonoWav\s*\(/,/\bchannel\s+channels\s*\[\s*16\s*\]/,/\bchannels\s*\[[^\]]+\]\.playBuffer\b/,/\bchannels\s*\[[^\]]+\]\.totalSampleCount\b/,/\bchannels\s*\[[^\]]+\]\.sampleChannels\b/,/\bchannels\s*\[[^\]]+\]\.sampleRate\b/,/\bmylock\b/];
  if(monoSlots.every(pattern=>pattern.test(source)))return{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2,mode:"mono-slots",slots:16};
  const monoBuffer=[/\bwaves::getMonoWav\s*\(/,/\bvector\s*<\s*dsp::Frame\s*<\s*1\s*>\s*>\s*playBuffer\b/,/\btotalSampleCount\b/,/\bsampleChannels\b/,/\bsampleRate\b/,/\bmylock\b/];
  if(monoBuffer.every(pattern=>pattern.test(source)))return{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2,mode:"mono-buffer"};
  const planarStereoBuffer=[/\bvector\s*<\s*vector\s*<\s*float\s*>\s*>\s+playBuffer\b/,/\btotalSample(?:C|Count)\b/,/\bsampleRate\b/,/\bchannels\b/,/\bsamplePos\b/,/\bvoid\s+loadSample\s*\(\s*std::string/];
  if(planarStereoBuffer.every(pattern=>pattern.test(source)))return{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2,mode:"planar-stereo-buffer",countField:/\btotalSampleCount\b/.test(source)?"totalSampleCount":"totalSampleC",planes:/\bplayBuffer\.resize\s*\(\s*1\s*\)/.test(source)?1:2,playField:/\brun\b/.test(source)?"run":/\bplay\b/.test(source)?"play":null,hasStartPos:/\bstartPos\b/.test(source),hasFileLoaded:/\bfileLoaded\b/.test(source),hasReload:/\breload\b/.test(source),hasLastPath:/\blastPath\b/.test(source)};
  const stereoBuffer=[/\bwaves::getStereoWav\s*\(/,/\bvector\s*<\s*dsp::Frame\s*<\s*2\s*>\s*>\s*playBuffer\b/,/\btotalSampleCount\b/,/\bsampleRate\b/,/\bchannels\b/,/\bmylock\b/];
  return stereoBuffer.every(pattern=>pattern.test(source))?{type:"audio",maxSamples:1920000,maxSeconds:10,channels:2,mode:"stereo-buffer",slices:/\b(?:std::)?vector\s*<\s*int\s*>\s*slices\b/.test(source)}:null
}
function browserAssetDependencyPrelude(source,contract){const sourceIncludes=rustSourceDeclarations(source).includeDirectives.filter(candidate=>completeIncludeDirectiveLine(source,candidate)).map(candidate=>candidate.include),includes=sourceIncludes.filter(value=>value.includes("dep/resampler/"));if(contract?.mode==="fundamental-wavetable")return browserFundamentalWavetablePrelude(contract.structure);if(contract?.mode==="rgba-image"&&contract?.storage!=="rgb-pointer")includes.push("dep/pffft/pffft.h");if(contract?.mode==="wavetable")includes.push("dep/osc/wtOsc.h");if(contract?.mode==="audiofile-tape")includes.push(...sourceIncludes.filter(value=>/(?:^|\/)AudioFile\.h$/.test(value)));if(contract?.mode==="buffer-sludger")return`#include "utils/MathUtils.hpp"\nconstexpr int BUFFER_DISPLAY_DRAW_MODE_DISABLE = 1;\nconstexpr int BUFFER_DISPLAY_DRAW_MODE_SAMPLES = 2;\nconstexpr int BUFFER_DISPLAY_DRAW_MODE_DISK = 3;`;if(contract?.mode==="planar-stereo-buffer")return"using drwav_uint64 = uint64_t;";return[...new Set(includes)].map(value=>`#include ${JSON.stringify(value)}`).join("\n")}
function browserAssetImplementationFiles(sourceDir,contract){
  if(contract?.mode==="mono-resampler")return["BaseVoiceState.cpp","Downsampler2Flt.cpp","InterpPack.cpp","MipMapFlt.cpp","ResamplerFlt.cpp"].map(file=>path.join(sourceDir,"src","dep","resampler",file)).filter(file=>fs.existsSync(file));
  if((contract?.mode==="rgba-image"&&contract?.storage!=="rgb-pointer")||contract?.mode==="wavetable")return[path.join(sourceDir,"src","dep","pffft","pffft.c")].filter(file=>fs.existsSync(file));
  if(contract?.mode==="lua-script"){
    const commit="98194db4295726069137d13b8d24fca8cbf892b6",
      root=path.join(sourceDir,".rack-web-dependencies","lua",commit);
    const browserExcluded=new Set(["lua.c","luac.c","linit.c","liolib.c","loslib.c","loadlib.c","ldblib.c","ltests.c"]);
    return fs.existsSync(root)?files(root).filter(file=>/\.c$/.test(file)&&!browserExcluded.has(path.basename(file))):[];
  }
  return[];
}
function embeddedJsonAssetFiles(sourceDir,source){if(!/\basset::plugin\s*\(/.test(source)||!/\bFILE\s*\*\s*\w+\s*=\s*fopen\s*\([^;]+,\s*"r"\s*\)/.test(source)||!/\bjson_loadf\s*\(/.test(source))return[];const root=path.join(sourceDir,"res","styles");if(!fs.existsSync(root))return[];return fs.readdirSync(root,{recursive:true}).map(file=>path.join(root,String(file))).filter(file=>fs.statSync(file).isFile()&&file.endsWith(".json")).sort()}
function adaptEmbeddedJsonAssetLoads(source,files){if(!files.length)return source;return source.replace(/([ \t]*)FILE\s*\*\s*(\w+)\s*=\s*fopen\s*\(([^;]+),\s*"r"\s*\);\s*\n[ \t]*if\s*\(\s*!\2\s*\)\s*return\s+false\s*;\s*\n\s*json_error_t\s+(\w+)\s*;\s*\n[ \t]*json_t\s*\*\s*(\w+)\s*=\s*json_loadf\s*\(\s*\2\s*,\s*0\s*,\s*&\4\s*\);\s*\n[ \t]*fclose\s*\(\s*\2\s*\)\s*;\s*\n[ \t]*if\s*\(\s*!\5\s*\)\s*return\s+false\s*;/,(_match,indent,_file,pathExpression,error,root)=>`${indent}const char* rackWebJson = rackWebEmbeddedJsonAsset(${pathExpression});\n${indent}if (!rackWebJson) return false;\n\n${indent}json_error_t ${error};\n${indent}json_t* ${root} = json_loads(rackWebJson, 0, &${error});\n${indent}if (!${root}) return false;`).replace(/\basset::plugin\s*\(\s*pluginInstance\s*,/g,"asset::plugin(nullptr,")}
function embeddedJsonAssetPrelude(sourceDir,files){if(!files.length)return"";const root=path.join(sourceDir,"res"),entries=files.map(file=>{const relative=path.relative(root,file).split(path.sep).join("/"),contents=fs.readFileSync(file,"utf8");return`  if (path.size() >= ${relative.length} && path.compare(path.size() - ${relative.length}, ${relative.length}, ${JSON.stringify(relative)}) == 0) return ${JSON.stringify(contents)};`});return`static const char* rackWebEmbeddedJsonAsset(const std::string& path) {\n${entries.join("\n")}\n  return nullptr;\n}`}
function embeddedMidiAssetFiles(sourceDir,source){if(!/\bMidiFile\b/.test(source)||!/\basset::plugin\s*\(/.test(source))return[];const root=path.join(sourceDir,"res","midi");if(!fs.existsSync(root))return[];return fs.readdirSync(root,{recursive:true}).map(file=>path.join(root,String(file))).filter(file=>fs.statSync(file).isFile()&&/\.mid$/i.test(file)).sort()}
function adaptEmbeddedMidiAssetLoads(source,files){if(!files.length)return source;return source.replace(/([ \t]*)([A-Za-z_]\w*)\.read\s*\(\s*rack::asset::plugin\s*\(\s*pluginInstance\s*,\s*([^;]+?)\s*\)\.c_str\s*\(\s*\)\s*\)\s*;/g,(_match,indent,reader,pathExpression)=>`${indent}auto rackWebMidiAsset = rackWebEmbeddedMidiAsset(${pathExpression});\n${indent}std::string rackWebMidiBytes(reinterpret_cast<const char*>(rackWebMidiAsset.data), rackWebMidiAsset.size);\n${indent}std::istringstream rackWebMidiStream(rackWebMidiBytes, std::ios::binary);\n${indent}${reader}.read(rackWebMidiStream);`)}
function embeddedMidiAssetPrelude(sourceDir,files){if(!files.length)return"";const root=path.join(sourceDir,"res"),arrays=[],entries=[];for(const [index,file] of files.entries()){const bytes=fs.readFileSync(file),relative=path.relative(root,file).split(path.sep).join("/"),name=`rackWebMidiData${index}`;arrays.push(`static const unsigned char ${name}[] = {${[...bytes].map(value=>`0x${value.toString(16).padStart(2,"0")}`).join(",")}};`);entries.push(`  if (path == ${JSON.stringify(`res/${relative}`)} || path == ${JSON.stringify(relative)}) return {${name}, sizeof(${name})};`)}return`${arrays.join("\n")}\nstruct RackWebEmbeddedMidiAsset { const unsigned char* data; std::size_t size; };\nstatic RackWebEmbeddedMidiAsset rackWebEmbeddedMidiAsset(const std::string& path) {\n${entries.join("\n")}\n  return {nullptr, 0};\n}`}
function embeddedBinaryAssetFiles(sourceDir,source){const files=[];for(const match of source.matchAll(/\bsystem::readFile\s*\(\s*asset::plugin\s*\(\s*pluginInstance\s*,\s*"([^"]+)"\s*\)\s*\)/g)){const file=path.resolve(sourceDir,match[1]);if(file.startsWith(`${path.resolve(sourceDir)}${path.sep}`)&&fs.existsSync(file)&&fs.statSync(file).isFile())files.push(file)}return[...new Set(files)]}
function adaptEmbeddedBinaryAssetLoads(source,files){if(!files.length)return source;return source.replace(/\bsystem::readFile\s*\(\s*asset::plugin\s*\(\s*pluginInstance\s*,\s*"([^"]+)"\s*\)\s*\)/g,(_match,relative)=>`rackWebEmbeddedBinaryAsset(${JSON.stringify(relative)})`)}
function embeddedBinaryAssetPrelude(sourceDir,files){if(!files.length)return"";const arrays=[],entries=[];for(const [index,file] of files.entries()){const relative=path.relative(sourceDir,file).split(path.sep).join("/"),base64=fs.readFileSync(file).toString("base64"),chunks=base64.match(/.{1,8192}/g)??[],name=`rackWebBinaryBase64${index}`;arrays.push(`static const char ${name}[] =\n${chunks.map(chunk=>`  ${JSON.stringify(chunk)}`).join("\n")};`);entries.push(`  if (path == ${JSON.stringify(relative)}) return rackWebDecodeBase64(${name});`)}return`static std::vector<uint8_t> rackWebDecodeBase64(const char* encoded) {\n  static constexpr unsigned char invalid = 0xff;\n  static const std::array<unsigned char, 256> table = [] { std::array<unsigned char, 256> result{}; result.fill(invalid); const char* alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"; for (unsigned value = 0; value < 64; ++value) result[static_cast<unsigned char>(alphabet[value])] = value; return result; }();\n  std::vector<uint8_t> output; unsigned accumulator = 0; int bits = -8;\n  for (const unsigned char* cursor = reinterpret_cast<const unsigned char*>(encoded); *cursor && *cursor != '='; ++cursor) { const unsigned char value = table[*cursor]; if (value == invalid) continue; accumulator = (accumulator << 6) | value; bits += 6; if (bits >= 0) { output.push_back(static_cast<uint8_t>((accumulator >> bits) & 0xff)); bits -= 8; } }\n  return output;\n}\n${arrays.join("\n")}\nstatic std::vector<uint8_t> rackWebEmbeddedBinaryAsset(const std::string& path) {\n${entries.join("\n")}\n  return {};\n}`}
function drumKitSampleContract(model){return{BassDrum9:{folder:"bd9",prefix:"bd9-",count:16},ClosedHiHat:{folder:"closedhh",prefix:"closedhh-",count:15},CR78:{folder:"cr78",prefix:"cr78-",count:7},DMX:{folder:"dmx",prefix:"dmx-",count:12},MarionetteBass:{folder:"kick",prefix:"kick",count:2,pitches:[55,60],moduleClass:"MarionetteModule"},OpenHiHat:{folder:"openhh",prefix:"openhh-",count:14},SnareDrumN:{folder:"snare",prefix:"snare-",count:16},Tomi:{folder:"tomi",prefix:"tomi-",count:14}}[model]}
function adaptDrumKitSampleAdapter(sourceDir,target,adapter){
  adapter=adapter.replace(/\bconfigParam\s*<\s*Blank\s*>/g,"configParam");
  const contract=drumKitSampleContract(target.model);
  if(!contract)return adapter;
  const files=Array.from({length:contract.count},(_,index)=>path.join(sourceDir,"res","samples",contract.folder,`${String(index+1).padStart(2,"0")}.raw`));if(files.some(file=>!fs.existsSync(file)))return adapter;
  const arrays=[],entries=[];for(const [index,file] of files.entries()){const base64=fs.readFileSync(file).toString("base64"),chunks=base64.match(/.{1,8192}/g)??[],name=`rackWebDrumSampleBase64${index}`,pitch=contract.pitches?.[index]??0;arrays.push(`static const char ${name}[] =\n${chunks.map(chunk=>`  ${JSON.stringify(chunk)}`).join("\n")};`);entries.push(`  { auto bytes = rackWebDecodeDrumSample(${name}); rackWebDrumSampleData.emplace_back(bytes.size() / sizeof(float)); auto& values = rackWebDrumSampleData.back(); std::memcpy(values.data(), bytes.data(), values.size() * sizeof(float)); sampleManager->addSample(new DrumKit::Sample(values.size(), ${JSON.stringify(`${contract.prefix}${String(index+1).padStart(2,"0")}`)}, values.data(), ${pitch})); }`)}
  const prelude=`${arrays.join("\n")}
static std::vector<uint8_t> rackWebDecodeDrumSample(const char* encoded) {
  auto valueOf = [](unsigned char value) -> int { if (value >= 'A' && value <= 'Z') return value - 'A'; if (value >= 'a' && value <= 'z') return value - 'a' + 26; if (value >= '0' && value <= '9') return value - '0' + 52; if (value == '+') return 62; if (value == '/') return 63; return -1; };
  std::vector<uint8_t> output; unsigned accumulator = 0; int bits = -8;
  for (const unsigned char* cursor = reinterpret_cast<const unsigned char*>(encoded); *cursor && *cursor != '='; ++cursor) { const int value = valueOf(*cursor); if (value < 0) continue; accumulator = (accumulator << 6) | static_cast<unsigned>(value); bits += 6; if (bits >= 0) { output.push_back(static_cast<uint8_t>((accumulator >> bits) & 0xff)); bits -= 8; } }
  return output;
}
DrumKit::SampleManager* sampleManager = DrumKit::SampleManager::getInstance();
static std::vector<std::vector<float>> rackWebDrumSampleData;
static const bool rackWebDrumSamplesReady = [] {
  rackWebDrumSampleData.reserve(${files.length});
${entries.join("\n")}
  return true;
}();
`;
  const insertion=contract.moduleClass?new RegExp(`\\nstruct ${contract.moduleClass}\\s*:\\s*Module\\b`):/\nstruct SampleController\s*:\s*Module\b/;
  return adapter.replace(insertion,match=>`\n${prelude}${match}`);
}
function adaptDanTSynthAocrBrowserSource(source){
  source=replaceInlineMethodBody(source,/\bjson_t\s*\*\s*dataToJson\s*\(\s*\)\s*override/," return json_object(); ");
  source=replaceInlineMethodBody(source,/\bvoid\s+dataFromJson\s*\(\s*json_t\s*\*\s*rootJ\s*\)\s*override/," (void)rootJ; ");
  for(const name of ["saveSettings","readSettings","saveUserSettings","loadUserSettings"])source=removeQualifiedFreeFunction(source,name);
  const constants=[["R_ZERO","0.0f"],["M_TEN","-10.0f"],["P_TEN","10.0f"],["M_FIVE","-5.0f"],["P_FIVE","5.0f"]].filter(([name])=>new RegExp(`\\b${name}\\b`).test(source)&&!new RegExp(`\\b${name}\\s*[({]`).test(source));
  if(constants.length){const declarations=`namespace DANT {\n${constants.map(([name,value])=>`static const rack::simd::float_4 ${name}{${value}};`).join("\n")}\n}`;const include=/^#include "rack_web_export\.hpp"\s*$/m;source=include.test(source)?source.replace(include,match=>`${match}\n${declarations}`):`${declarations}\n${source}`}
  return source;
}
function adaptFv1EmuBrowserSource(source,demoSpn){
  const demoDeclaration=`static const char rackWebFv1DemoSpn[] = ${JSON.stringify(demoSpn)};`,include=/^#include "rack_web_export\.hpp"\s*$/m;
  if(!source.includes("rackWebFv1DemoSpn"))source=include.test(source)?source.replace(include,match=>`${match}\n${demoDeclaration}`):`${demoDeclaration}\n${source}`;
  if(source.includes('#include "../fv1-emu/FV1emu.hpp"')){
    source=source.replace('#include "../fv1-emu/FV1emu.hpp"',`#pragma push_macro("TEST")
#undef TEST
#include "../fv1-emu/FV1emu.hpp"
#pragma pop_macro("TEST")`);
    source=source.replace(/^\s*#include "FV1emu\.hpp"\s*$/gm,"").replace(/^\s*#include "FV1\.hpp"\s*$/gm,"");
  }
  source=source.replace(/\bstd::string\s+programs_json\s*=\s*asset::plugin\s*\(\s*pluginInstance\s*,\s*"fx\/programs\.json"\s*\)\s*;/,'std::string programs_json = "builtin://programs.json";');
  source=source.replace(/\bloadFx\s*\(\s*asset::plugin\s*\(\s*pluginInstance\s*,\s*"fx\/demo\.spn"\s*\)\s*\)\s*;/,'loadFx("builtin://demo.spn");');
  source=replaceInlineMethodBody(source,/\bbool\s+loadPrograms\s*\(\s*const\s+std::string\s*&\s*programs_json\s*\)/,' this->programs_json = "builtin://programs.json"; categories.clear(); programs.clear(); return true; ');
  source=replaceInlineMethodBody(source,/\bvoid\s+loadFx\s*\(\s*const\s+std::string\s*&\s*file\s*,\s*bool\s+scanDir\s*=\s*true\s*\)/,' (void)file; (void)scanDir; selectedProgram = -1; lastPath = "builtin://demo.spn"; filesInPath = {lastPath}; const bool loaded = fx.loadFromSPN("demo.spn", rackWebFv1DemoSpn); display = std::string("0: ") + (loaded ? "" : "!!! ") + fx.getDisplay(); ');
  return source;
}
function adaptWrongPeopleMidiPlayerBrowserSource(source){
  for(const name of ["systemCreateDirectory","systemIsDirectory"])
    source=removeQualifiedFreeFunction(source,name);
  return source.replace(
    /^[ \t]*(?:void|bool)\s+(?:systemCreateDirectory|systemIsDirectory)\s*\([^;\n]*\)\s*;[ \t]*$/gm,
    "",
  );
}
function adaptWrongPeopleLuaBrowserSource(source,sourceDir){
  const libraryRoot=path.join(sourceDir,"res","lua","lib"),
    dspSource=fs.readFileSync(path.join(libraryRoot,"dsp.lua"),"utf8"),
    mathSource=fs.readFileSync(path.join(libraryRoot,"math.lua"),"utf8"),
    embeddedLibraries=`static const char rackWebLuaDsp[] = ${JSON.stringify(dspSource)};
static const char rackWebLuaMath[] = ${JSON.stringify(mathSource)};`;
  // The dependency scanner flattens a few LuaJIT compatibility macros before
  // lua.hpp. PUC Lua already provides the complete Lua 5.1 macro surface, and
  // the flattened continuation-only macros are invalid C/C++.
  source=source
    .replace(/^[ \t]*#define[ \t]+(?:LUA_[A-Z0-9_]+|lua_[A-Za-z0-9_]+|luaL_[A-Za-z0-9_]+)[^\n]*$/gm,"")
    .replace(/^#include "rack_web_export\.hpp"[ \t]*$/m,match=>`${match}\n${embeddedLibraries}`)
    .replace(/\bluaL_openlibs\s*\(\s*L\s*\)\s*;/,`for (const auto& library : {
        std::pair<const char*, lua_CFunction>{"", luaopen_base},
        std::pair<const char*, lua_CFunction>{LUA_TABLIBNAME, luaopen_table},
        std::pair<const char*, lua_CFunction>{LUA_STRLIBNAME, luaopen_string},
        std::pair<const char*, lua_CFunction>{LUA_MATHLIBNAME, luaopen_math}
    }) {
        lua_pushcfunction(L, library.second);
        lua_pushstring(L, library.first);
        lua_call(L, 1, 0);
    }`);
  source=replaceOutOfLineMethod(source,"Lua","loadScript",`void Lua::loadScript() {
    if (rackWebScriptSource.empty())
        return;

    unloadScript();
    if (!createLuaState())
        return;

    if (luaL_loadbuffer(L, rackWebScriptSource.data(), rackWebScriptSource.size(), "browser.lua")
        || lua_pcall(L, 0, LUA_MULTRET, 0)) {
        scriptError();
        return;
    }

    scriptLoaded = true;
    displayMessage = "script.lua";
    lights[RELOAD_LIGHT_GREEN].setBrightness(1);
    lights[RELOAD_LIGHT_RED].setBrightness(0);
}`);
  source=source.replace(
    /[ \t]*for\s*\(\s*auto\s+const\s*&\s*lib\s*:\s*scriptLibs\s*\)\s*\{[\s\S]*?\n[ \t]*\}\s*\n\s*lua_getglobal\s*\(\s*L\s*,\s*"package"\s*\)\s*;[\s\S]*?lua_pop\s*\(\s*L\s*,\s*1\s*\)\s*;/,
    `
    for (const auto& library : {
        std::pair<const char*, const char*>{rackWebLuaDsp, "dsp.lua"},
        std::pair<const char*, const char*>{rackWebLuaMath, "math.lua"}
    }) {
        if (luaL_loadbuffer(L, library.first, std::strlen(library.first), library.second)
            || lua_pcall(L, 0, LUA_MULTRET, 0)) {
            scriptError();
            return false;
        }
    }`,
  );
  source=source.replace(
    /[ \t]*lua_pushstring\s*\(\s*L\s*,\s*path\.c_str\s*\(\s*\)\s*\)\s*;\s*lua_setfield\s*\(\s*L\s*,\s*-2\s*,\s*"path"\s*\)\s*;\s*lua_pop\s*\(\s*L\s*,\s*1\s*\)\s*;/,
    "",
  );
  return source;
}
function adaptTnnGhostBrowserSource(source){
  const embeddedSamples=[
    ["ghostChh_f32","embedded/GhostChhData.hpp"],
    ["ghostOhh_f32","embedded/GhostOhhData.hpp"],
    ["ghostClap_f32","embedded/GhostClapData.hpp"],
    ["ghostRim_f32","embedded/GhostRimData.hpp"],
    ["ghostCrash_f32","embedded/GhostCrashData.hpp"],
    ["ghostRide_f32","embedded/GhostRideData.hpp"],
  ].filter(([symbol])=>source.includes(symbol)&&!new RegExp(`\\bstatic\\s+(?:const\\s+)?unsigned\\s+char\\s+${symbol}\\b`).test(source));
  if(embeddedSamples.length)source=source.replace(
    /^#include "rack_web_export\.hpp"[ \t]*$/m,
    match=>`${match}\n${embeddedSamples.map(([,header])=>`#include ${JSON.stringify(header)}`).join("\n")}`,
  );
  // Kck's helper is defined in the same anonymous namespace as its voice.
  // A synthesized global forward declaration creates a second overload.
  source=source.replace(
    /^[ \t]*static\s+inline\s+float\s+kckNormWithCV\s*\([^;\n]+\)\s*;[ \t]*$/m,
    "",
  );
  if(source.includes("kRimClapAccent")){
    source=source.replace(
      /^[ \t]*static\s+const\s+Ghost::AccentCharacter\s+kRimClapAccent\s*=\s*Ghost::Accent::driveOnly\s*\(\s*\)\s*;[ \t]*$/m,
      "",
    );
    source=source.replace(
      /(^[ \t]*static\s+const\s+std::vector<float>&\s+rimClapClapSource\s*\(\s*\)\s*\{)/m,
      `static const Ghost::AccentCharacter kRimClapAccent = Ghost::Accent::driveOnly();\n\n$1`,
    );
    for(const name of ["rimClapClapSource","rimClapRimSource"])source=source.replace(
      new RegExp(`^\\s*static\\s+const\\s+std::vector<float>&\\s+${name}\\s*\\(\\s*\\)\\s*;\\s*$`,"m"),
      "",
    );
  }
  if(/\bstruct\s+CrashRide\s*:/.test(source)){
    const moved=[];let cursor=0;
    while(cursor<source.length){
      const match=/\bnamespace\s+crashride_impl\s*\{/.exec(source.slice(cursor));
      if(!match)break;
      const start=cursor+match.index,open=source.indexOf("{",start),close=matchingBrace(source,open);
      if(close<0)break;
      const block=source.slice(start,close+1);
      if(/Ghost::(?:RomVoiceConfig|AccentCharacter)|inline\s+const\s+Ghost::RomAsset&|inline\s+const\s+std::vector<float>&/.test(block)){
        const priority=/inline\s+const\s+Ghost::RomAsset&/.test(block)?2:/inline\s+const\s+std::vector<float>&/.test(block)?1:0;
        moved.push({start,end:close+1,priority,source:block});
      }
      cursor=close+1;
    }
    for(const block of [...moved].sort((left,right)=>right.start-left.start))
      source=source.slice(0,block.start)+source.slice(block.end);
    if(moved.length)source=source.replace(
      /(\nstruct\s+CrashRide\s*:)/,
      `\n${moved.sort((left,right)=>left.priority-right.priority).map(item=>item.source).join("\n\n")}\n$1`,
    );
  }
  return source;
}
function adaptPortlandWeatherBrowserSource(source){
  // PortlandWeather exposes at most 99 seconds of delay. A 2^23-frame ring
  // still covers that entire range at the browser's 44.1/48 kHz sample rates,
  // while avoiding three permanently allocated 2^24 buffers (256 MiB total).
  return source
    .replace(/^[ \t]*#define[ \t]+DELAY_LINE_SIZE[ \t]+\(?[ \t]*1[ \t]*<<[ \t]*24[ \t]*\)?[ \t]*$/gm,"#define DELAY_LINE_SIZE (1 << 23)")
    .replace(/^[ \t]*#define[ \t]+HISTORY_SIZE[ \t]+\(?[ \t]*1[ \t]*<<[ \t]*24[ \t]*\)?[ \t]*$/gm,"#define HISTORY_SIZE (1 << 23)")
    // Rack updates APP->engine before constructing or notifying modules.
    // The browser ABI supplies the current rate in ProcessArgs instead.
    .replace(/(\bvoid\s+process\s*\(\s*const\s+ProcessArgs\s*&\s*args\s*\)\s*override\s*\{)(?!\s*sampleRate\s*=\s*args\.sampleRate)/,"$1\n\t\tsampleRate = args.sampleRate;");
}
const adaptFrozenWastelandPortlandWeatherBrowserSource=adaptPortlandWeatherBrowserSource;
function adaptStringTheoryBrowserSource(source){
  // StringTheory's own HISTORY_SIZE is 2^21, but the generic delay
  // implementation it includes defaults to 2^24. Eight copies of that
  // generic buffer require over 512 MiB. Use the module's intended history
  // size and clamp extreme negative V/Oct values before indexing the ring.
  return source
    .replace(/^[ \t]*#define[ \t]+DELAY_LINE_SIZE[ \t]+\(?[ \t]*1[ \t]*<<[ \t]*24[ \t]*\)?[ \t]*$/gm,"#define DELAY_LINE_SIZE (1 << 21)")
    .replace(/float\s+index\s*=\s*\(\s*delay\s*\*\s*sampleRate\s*\)\s*\+\s*sampleAdjust\s*;/,"float index = std::min((delay * sampleRate) + sampleAdjust, float(DELAY_LINE_SIZE - 4));");
}
function adaptGpRotaryBrowserSource(source){
  if(!/\bclass\s+MilliSampleDelayLine\b/.test(source)||!/\bN_SUBSAMPLE\b/.test(source))return source;
  const firLength=31000,cutoff=Math.fround(.45/1000),firHalf=Array.from({length:firLength/2},(_,index)=>{
    const factor=index-firLength/2,radian=Math.fround(Math.PI*2*cutoff*factor),sinc=Math.fround(Math.sin(radian)/radian),coefficient=Math.fround(Math.fround(Math.fround(2*cutoff)*sinc)*1000),proportion=index/(firLength-1),window=.35875-.48829*Math.cos(2*Math.PI*proportion)+.14128*Math.cos(4*Math.PI*proportion)-.01168*Math.cos(6*Math.PI*proportion);
    return Math.fround(coefficient*Math.fround(window));
  }),firSource=firHalf.map(value=>`${value.toExponential(9)}f`).join(",");
  source=source
    .replace(/\bfloat\s*\*\*\s*m_ppIRs\s*=\s*nullptr\s*;/,"float** m_ppIRs = nullptr;\n\tfloat* m_pIRStorage = nullptr;")
    .replace(/\bfloat\s*\*\*\s*m_ppTempIRs\s*=\s*nullptr\s*;/,"float** m_ppTempIRs = nullptr;\n\tfloat* m_pTempIRStorage = nullptr;")
    .replace(/^[ \t]*printf\s*\(\s*"Start ramp %d\\n"\s*,\s*p\.first\s*\)\s*;[ \t]*$/gm,"")
    .replace(/\bdelete\s+m_pDelayLine\s*;/g,"delete [] m_pDelayLine;");
  source=replaceOutOfLineMethod(source,"MilliSampleDelayLine","BuildIRs",`bool MilliSampleDelayLine::BuildIRs(float fCutoffFrequency) {
    (void)fCutoffFrequency;
    static const float rackWebRotaryFirHalf[N_SUBSAMPLE * N_TAPS / 2] = {${firSource}};
    DeleteTempIRs();
    m_ppTempIRs = new float*[N_SUBSAMPLE];
    m_pTempIRStorage = new float[N_SUBSAMPLE * N_TAPS];
    for (size_t nSub = 0; nSub < N_SUBSAMPLE; nSub++) {
        float* pTaps = m_pTempIRStorage + nSub * N_TAPS;
        for (size_t nTap = 0; nTap < N_TAPS; nTap++) {
            size_t index = nTap * N_SUBSAMPLE + nSub;
            if (index >= N_SUBSAMPLE * N_TAPS / 2)
                index = N_SUBSAMPLE * N_TAPS - 1 - index;
            pTaps[N_TAPS - 1 - nTap] = rackWebRotaryFirHalf[index];
        }
        m_ppTempIRs[N_SUBSAMPLE - 1 - nSub] = pTaps;
    }
    return true;
}`);
  source=replaceOutOfLineMethod(source,"MilliSampleDelayLine","DeleteTempIRs",`void MilliSampleDelayLine::DeleteTempIRs() {
    delete [] m_ppTempIRs;
    delete [] m_pTempIRStorage;
    m_ppTempIRs = nullptr;
    m_pTempIRStorage = nullptr;
}`);
  source=replaceOutOfLineMethod(source,"MilliSampleDelayLine","DeleteIRs",`void MilliSampleDelayLine::DeleteIRs() {
    delete [] m_ppIRs;
    delete [] m_pIRStorage;
    m_ppIRs = nullptr;
    m_pIRStorage = nullptr;
}`);
  source=replaceOutOfLineMethod(source,"MilliSampleDelayLine","UpdateIRs",`void MilliSampleDelayLine::UpdateIRs() {
    if (m_ppTempIRs == nullptr) return;
    DeleteIRs();
    m_ppIRs = m_ppTempIRs;
    m_pIRStorage = m_pTempIRStorage;
    m_ppTempIRs = nullptr;
    m_pTempIRStorage = nullptr;
}`);
  return replaceOutOfLineMethod(source,"MilliSampleDelayLine","DeleteOldIRs","void MilliSampleDelayLine::DeleteOldIRs() {}");
}
function adaptMidiRecorderBrowserBody(source){
  if(!/\bvoid\s+loadDrumMap\s*\(/.test(source)||!/\bvoid\s+CreateMidiFile\s*\(/.test(source))return source;
  let result=source
    .replace(/\bstd::ofstream\s+midiFile\s*;\s*/g,"")
    .replace(/\bstd::basic_string\s*<\s*uint8_t\s*>\s+bytes\s*;/g,"std::string bytes;")
    .replace(/\bbytes\.push_back\s*\(\s*static_cast\s*<\s*uint8_t\s*>\s*\(\s*byte\s*\)\s*\)\s*;/g,"bytes.push_back(static_cast<char>(byte));");
  result=replaceInlineMethodBody(result,/\bvoid\s+loadDrumMap\s*\(\s*std::string\s+[A-Za-z_]\w*\s*\)\s*\{/,`
        (void)path;
        useDrumMap = false;
    `);
  result=replaceInlineMethodBody(result,/\bvoid\s+CreateMidiFile\s*\(\s*std::string\s+[A-Za-z_]\w*\s*\)\s*\{/,`
        (void)fileName;
    `);
  const toJson=/\bjson_t\s*\*\s*dataToJson\s*\(\s*\)\s*override\s*\{/.exec(result);
  if(toJson){
    const open=result.indexOf("{",toJson.index),close=matchingBrace(result,open),body=result.slice(open+1,close);
    const adapted=body.replace(/\breturn\s+rootJ\s*;/,`
        json_t *eventsJ = json_array();
        for (const MidiEvent& event : midiEvents) {
            json_t *eventJ = json_object();
            json_object_set_new(eventJ, "timeStamp", json_integer(event.timeStamp));
            json_object_set_new(eventJ, "eventType", json_integer(event.eventType));
            json_object_set_new(eventJ, "value", json_integer(event.value));
            json_object_set_new(eventJ, "velocity", json_integer(event.velocity));
            json_array_append_new(eventsJ, eventJ);
        }
        json_object_set_new(rootJ, "midiEvents", eventsJ);
        return rootJ;`);
    result=result.slice(0,open+1)+adapted+result.slice(close)
  }
  const fromJson=/\bvoid\s+dataFromJson\s*\(\s*json_t\s*\*\s*[A-Za-z_]\w*\s*\)\s*override\s*\{/.exec(result);
  if(fromJson){
    const open=result.indexOf("{",fromJson.index),close=matchingBrace(result,open),body=result.slice(open+1,close);
    result=result.slice(0,open+1)+body+`
        json_t *eventsJ = json_object_get(rootJ, "midiEvents");
        if (json_is_array(eventsJ)) {
            midiEvents.clear();
            for (size_t index = 0; index < json_array_size(eventsJ); index++) {
                json_t *eventJ = json_array_get(eventsJ, index);
                if (!json_is_object(eventJ)) continue;
                MidiEvent event{};
                event.timeStamp = json_integer_value(json_object_get(eventJ, "timeStamp"));
                event.eventType = json_integer_value(json_object_get(eventJ, "eventType"));
                event.value = json_integer_value(json_object_get(eventJ, "value"));
                event.velocity = json_integer_value(json_object_get(eventJ, "velocity"));
                midiEvents.push_back(event);
            }
            eventCount = midiEvents.size();
        }
    `+result.slice(close)
  }
  return result
}
function adaptMidiRecorderBrowserPrelude(source){
  return source.replace(/^\s*using\s+namespace\s+tinyxml2\s*;\s*$/gm,"")
}
function adaptImpromptuProbKeyBrowserBody(source){
  return `std::string rackWebClipboard;\n${source}`
    .replace(
      /glfwSetClipboardString\s*\(\s*APP\s*->\s*window\s*->\s*win\s*,\s*probClip\s*\)\s*;/g,
      'rackWebClipboard = probClip ? probClip : "";',
    )
    .replace(
      /const\s+char\s*\*\s*probClip\s*=\s*glfwGetClipboardString\s*\(\s*APP\s*->\s*window\s*->\s*win\s*\)\s*;/g,
      'const char* probClip = rackWebClipboard.empty() ? nullptr : rackWebClipboard.c_str();',
    )
    .replace(
      /if\s*\(\s*pkInfo\.gate\s*&&\s*!pkInfo\.isRightClick\s*\)/g,
      "if (pkInfo.gate)",
    )
    .replace(
      /bool\s+withSymmetry\s*=\s*\(\s*APP\s*->\s*window\s*->\s*getMods\s*\(\s*\)\s*&\s*RACK_MOD_MASK\s*\)\s*==\s*GLFW_MOD_SHIFT\s*;/g,
      "bool withSymmetry = pkInfo.isRightClick;",
    );
}
function adaptInfrasonicWarpCoreBrowserSource(source){
  const firstSpecialization=source.search(/\btemplate\s*<\s*>\s*/);
  if(firstSpecialization<0)return source;
  const primaryTemplates=`namespace infrasonic {
template<typename T> inline T bend(T in, const T amt);
template<typename T> inline T formant(T in, const T amt);
template<typename T> inline T sync(T in, const T amt);
template<typename T> inline T fold(T in, const T amt);
}

`;
  const namespaceStart=source.lastIndexOf("namespace infrasonic {",firstSpecialization);
  const insertion=namespaceStart>=0?namespaceStart:firstSpecialization;
  return (source.slice(0,insertion)+primaryTemplates+source.slice(insertion))
    .replace(
      /json_object_set_new\s*\(\s*json\s*,\s*"alt_out_type"\s*,\s*json_integer\s*\(\s*patch\.alt_out_type\s*\)\s*\)\s*;/,
      '$&\n\t\tjson_object_set_new(json, "ratioMode", json_boolean(ratioMode));',
    )
    .replace(
      /(json_t\s*\*\s*altOutType\s*=\s*json_object_get\s*\(\s*rootJ\s*,\s*"alt_out_type"\s*\)\s*;\s*if\s*\(\s*altOutType\s*\)\s*setAltOutputType\s*\(\s*json_integer_value\s*\(\s*altOutType\s*\)\s*\)\s*;)/,
      '$1\n\n\t\tjson_t* ratioModeJ = json_object_get(rootJ, "ratioMode");\n\t\tif (ratioModeJ) ratioMode = json_boolean_value(ratioModeJ);',
    )
    .replace(
      /if\s*\(\s*onAlgoChanged\s*\)\s*onAlgoChanged\s*\(\s*\)\s*;/g,
      "ratioMode = false;\n\t\t\t\tif (onAlgoChanged) onAlgoChanged();",
    );
}
function adaptFundamentalWavetableBrowserBody(source){
  if(!/\b(?:Wavetable|PhasorWavetableData)\s+wavetable\s*;/.test(source)||!/\bwavetable\.(?:load|save)\s*\(/.test(source))return source;
  let result=replaceInlineMethodBody(source,/\bvoid\s+onAdd\s*\(\s*const\s+AddEvent\s*&\s*[A-Za-z_]\w*\s*\)\s*override\s*\{/,`
    // Browser assets are committed directly through the Rack Web asset ABI.
  `);
  result=replaceInlineMethodBody(result,/\bvoid\s+onSave\s*\(\s*const\s+SaveEvent\s*&\s*[A-Za-z_]\w*\s*\)\s*override\s*\{/,`
    // The current browser asset is retained in the module instance.
  `);
  return result
}
function adaptHetrickPhasorWavetableBrowserSource(source){
  let result=source
    .replace(/^\s*static\s+const\s+char\s+WAVETABLE_(?:LOAD|SAVE)_FILTERS\[\]\s*=\s*[^;]+;\s*$/gm,"")
    .replace(/^\s*static\s+std::string\s+wavetableDir\s*;\s*$/gm,"")
    .replace(/^\s*static\s+PhasorWavetableData\s+defaultPhasorWavetable\s*;\s*$/gm,"")
    .replace(/\bgam::sampleRate\s*\(\s*APP->engine->getSampleRate\s*\(\s*\)\s*\)\s*;/g,"");
  if(/\bscaleAndWrapPhasor\s*\(/.test(result)&&!/\bscaleAndWrapPhasor\s*\([^;{}]*\)\s*\{/.test(result))
    result=result.replace(/(#include\s+"rack_web_export\.hpp"\s*)/,`$1
static float scaleAndWrapPhasor(float input) {
  const float phase = input * .1f;
  return phase - std::floor(phase);
}
`);
  return result
}
function gpChainMixerDspPrelude(){
  return `
struct FaderGainQuantity : ParamQuantity {
  FaderGainQuantity();
  static float GainFactor(float value);
private:
  static float FaderParam2dB(float value);
};
struct PanBalQuantity : ParamQuantity {
  PanBalQuantity();
  static float GainFactorL(float value, bool balance);
  static float GainFactorR(float value, bool balance);
private:
  static int ParamToIndex(float value);
};
struct SendQuantity : ParamQuantity {
  SendQuantity();
  static float GainFactor(float value);
};
struct GPaudioFader {
  static float GainFactor(float value);
};
struct RackWebGpFaderCurvePoint { double threshold; double decibels; };
static RackWebGpFaderCurvePoint rackWebGpFaderCurve[] = {
  {0.0, -144.0}, {0.03008, -90.0}, {0.07519, -60.0}, {0.13534, -40.0},
  {0.18797, -30.0}, {0.27820, -20.0}, {0.38346, -15.0}, {0.50376, -10.0},
  {0.63158, -5.0}, {0.74788, -0.1}, {0.75588, 0.1}, {0.87970, 6.0}, {1.0, 12.0}
};
static float rackWebGpFaderFactors[769]{};
static bool rackWebGpFaderInitialized = false;
static float rackWebGpPanL[201]{}, rackWebGpPanR[201]{}, rackWebGpBalL[201]{}, rackWebGpBalR[201]{};
static bool rackWebGpPanInitialized = false;
static float rackWebGpSendFactors[257]{};
static bool rackWebGpSendInitialized = false;
float FaderGainQuantity::FaderParam2dB(float value) {
  if (value <= 0.f) return -144.f;
  if (value >= 768.f) return 12.f;
  for (int index = 1; index < 13; index++) {
    if (value > rackWebGpFaderCurve[index].threshold) continue;
    const double relative = (value - rackWebGpFaderCurve[index - 1].threshold) / (rackWebGpFaderCurve[index].threshold - rackWebGpFaderCurve[index - 1].threshold);
    double decibels = rackWebGpFaderCurve[index - 1].decibels + relative * (rackWebGpFaderCurve[index].decibels - rackWebGpFaderCurve[index - 1].decibels);
    decibels = decibels > 0. ? floor(decibels * 10. + .5) / 10. : ceil(decibels * 10. - .5) / 10.;
    return decibels > -.1 && decibels < .1 ? 0.f : static_cast<float>(decibels);
  }
  return 12.f;
}
FaderGainQuantity::FaderGainQuantity() {
  if (rackWebGpFaderInitialized) return;
  rackWebGpFaderInitialized = true;
  for (auto& point : rackWebGpFaderCurve) point.threshold *= 768.;
  for (int index = 0; index <= 768; index++) rackWebGpFaderFactors[index] = pow(10.f, FaderParam2dB(static_cast<float>(index)) / 20.f);
}
float FaderGainQuantity::GainFactor(float value) { if (!rackWebGpFaderInitialized) { FaderGainQuantity quantity; } return rackWebGpFaderFactors[static_cast<int>(value + .5f)]; }
float GPaudioFader::GainFactor(float value) { if (!rackWebGpFaderInitialized) { FaderGainQuantity quantity; } return rackWebGpFaderFactors[static_cast<int>(value + .5f)]; }
PanBalQuantity::PanBalQuantity() {
  snapEnabled = true;
  if (rackWebGpPanInitialized) return;
  rackWebGpPanInitialized = true;
  for (int index = 0; index <= 200; index++) {
    const float sine = sin(1.57079632679489661923f * static_cast<float>(index) / 200.f);
    rackWebGpPanR[index] = sine;
    rackWebGpPanL[200 - index] = sine;
  }
  for (int index = 0; index <= 100; index++) {
    rackWebGpBalL[index] = 1.f;
    rackWebGpBalR[200 - index] = 1.f;
  }
  for (int index = 100; index <= 200; index++) {
    rackWebGpBalL[index] = cos(static_cast<float>(index - 100) * 1.57079632679489661923f / 100.f);
    rackWebGpBalR[200 - index] = rackWebGpBalL[index];
  }
}
int PanBalQuantity::ParamToIndex(float value) {
  int parameter = static_cast<int>(value);
  if (parameter >= -1 && parameter <= 1) parameter = 0;
  return parameter + 100;
}
float PanBalQuantity::GainFactorL(float value, bool balance) { if (!rackWebGpPanInitialized) { PanBalQuantity quantity; } const int index = ParamToIndex(value); return balance ? rackWebGpBalL[index] : rackWebGpPanL[index]; }
float PanBalQuantity::GainFactorR(float value, bool balance) { if (!rackWebGpPanInitialized) { PanBalQuantity quantity; } const int index = ParamToIndex(value); return balance ? rackWebGpBalR[index] : rackWebGpPanR[index]; }
SendQuantity::SendQuantity() {
  if (rackWebGpSendInitialized) return;
  rackWebGpSendInitialized = true;
  for (int index = 1; index <= 256; index++) {
    const float factor = static_cast<float>(index) / 256.f;
    rackWebGpSendFactors[index] = factor * factor;
  }
}
float SendQuantity::GainFactor(float value) { if (!rackWebGpSendInitialized) { SendQuantity quantity; } return rackWebGpSendFactors[static_cast<int>(value + .5f)]; }
`.trim();
}
function browserFundamentalWavetablePrelude(structure="Wavetable"){
  return `struct ${structure} {
  std::vector<float> samples;
  size_t waveLen = 0;
  std::string filename;
  size_t quality = 0;
  size_t octaves = 0;
  std::vector<float> interpolatedSamples;
  bool loading = false;

  float& at(size_t waveIndex, size_t sampleIndex) {
    return samples[waveLen * waveIndex + sampleIndex];
  }
  float at(size_t waveIndex, size_t sampleIndex) const {
    return samples[waveLen * waveIndex + sampleIndex];
  }
  float interpolatedAt(size_t octave, size_t waveIndex, size_t sampleIndex) const {
    return interpolatedSamples[samples.size() * quality * octave + waveLen * quality * waveIndex + sampleIndex];
  }
  size_t getWaveCount() const {
    return waveLen == 0 ? 0 : samples.size() / waveLen;
  }
  void reset() {
    filename = "Basic.wav";
    waveLen = 1024;
    loading = true;
    samples.resize(waveLen * 4);
    for (size_t i = 0; i < waveLen; ++i) {
      const float p = static_cast<float>(i) / waveLen;
      at(0, i) = std::sin(2.f * static_cast<float>(M_PI) * p);
      at(1, i) = p < .25f ? 4.f * p : p < .75f ? 2.f - 4.f * p : 4.f * p - 4.f;
      at(2, i) = p < .5f ? 2.f * p : 2.f * p - 2.f;
      at(3, i) = p < .5f ? 1.f : -1.f;
    }
    interpolate();
    loading = false;
  }
  void setQuality(size_t nextQuality) {
    if (quality == nextQuality) return;
    quality = nextQuality;
    interpolate();
  }
  void setWaveLen(size_t nextWaveLen) {
    if (waveLen == nextWaveLen) return;
    waveLen = nextWaveLen;
    interpolate();
  }
  void interpolate() {
    if (quality == 0 || waveLen < 32 || waveLen % 32 != 0) return;
    const size_t waveCount = getWaveCount();
    if (waveCount == 0) return;
    octaves = static_cast<size_t>(std::log2(static_cast<double>(waveLen))) - 1;
    interpolatedSamples.assign(octaves * samples.size() * quality, 0.f);
    std::vector<float> in(waveLen);
    std::vector<float> inF(2 * waveLen);
    std::vector<float> outF(2 * waveLen * quality, 0.f);
    dsp::RealFFT inFFT(waveLen);
    dsp::RealFFT outFFT(waveLen * quality);
    for (size_t wave = 0; wave < waveCount; ++wave) {
      for (size_t sample = 0; sample < waveLen; ++sample)
        in[sample] = samples[waveLen * wave + sample] / waveLen;
      inFFT.rfft(in.data(), inF.data());
      for (size_t octave = 0; octave < octaves; ++octave) {
        const size_t bins = size_t(1) << octave;
        for (size_t bin = 0; bin < waveLen; ++bin) {
          outF[2 * bin] = bin <= bins ? inF[2 * bin] : 0.f;
          outF[2 * bin + 1] = bin <= bins ? inF[2 * bin + 1] : 0.f;
        }
        outFFT.irfft(outF.data(), &interpolatedSamples[samples.size() * quality * octave + waveLen * quality * wave]);
      }
    }
  }
  json_t* toJson() const {
    json_t* root = json_object();
    json_object_set_new(root, "waveLen", json_integer(waveLen));
    json_object_set_new(root, "filename", json_string(filename.c_str()));
    return root;
  }
  void fromJson(json_t* root) {
    if (json_t* value = json_object_get(root, "waveLen")) {
      const size_t candidate = static_cast<size_t>(json_integer_value(value));
      if (candidate >= 32 && candidate <= 16384 && (candidate & (candidate - 1)) == 0)
        setWaveLen(candidate);
    }
    if (json_t* value = json_object_get(root, "filename"))
      if (const char* text = json_string_value(value)) filename = text;
  }
};`
}
function adaptOctobirBrowserPrelude(source){
  const value=String(source??""),pattern=/^(\s*)#include\s+["<]([^">]*octobir-core\/IRProcessor\.hpp)[">]\s*$/m,match=pattern.exec(value);
  if(!match)fail("OctobIR browser adapter could not locate the locked core include");
  return value.replace(pattern,`${match[1]}#define private public
${match[1]}#include "${match[2]}"
${match[1]}#undef private
bool rackWebLoadOctobirSamples(octob::IRProcessor& processor, int slot, const octob::Sample* samples,
                               size_t frames, int channels, octob::SampleRate sampleRate,
                               std::string& errorMessage);`);
}
function octobirBrowserImplementations(){return`bool rackWebLoadOctobirSamples(octob::IRProcessor& processor, int slot,
                                      const octob::Sample* samples, size_t frames, int channels,
                                      octob::SampleRate sampleRate, std::string& errorMessage) {
  if (!samples || frames < 1 || channels < 1 || channels > 2 || sampleRate <= 0.0 ||
      frames > static_cast<size_t>(octob::MaxIrLengthSeconds * sampleRate) || slot < 0 || slot > 1) {
    errorMessage = "Invalid browser impulse response";
    return false;
  }
  auto stagingBuffer = std::make_unique<WDL_ImpulseBuffer>();
  auto stagingEngine = std::make_unique<WDL_ConvolutionEngine_Div>();
  auto stagingLoader = std::make_unique<octob::IRLoader>();
  stagingLoader->numSamples_ = frames;
  stagingLoader->numChannels_ = channels;
  stagingLoader->irSampleRate_ = sampleRate;
  stagingLoader->irBuffer_.assign(samples, samples + frames * static_cast<size_t>(channels));
  const float compensation = std::exp(octob::IrCompensationGainDb * octob::DbToLinearScalar);
  for (auto& sample : stagingLoader->irBuffer_) sample *= compensation;
  int fftSize = 32;
  while (fftSize < static_cast<int>(frames * 2)) fftSize <<= 1;
  if (channels == 1) {
    stagingLoader->convertToMinimumPhase(stagingLoader->irBuffer_, fftSize);
  } else {
    std::vector<octob::Sample> channel(frames);
    for (int channelIndex = 0; channelIndex < channels; ++channelIndex) {
      for (size_t frame = 0; frame < frames; ++frame)
        channel[frame] = stagingLoader->irBuffer_[frame * static_cast<size_t>(channels) + channelIndex];
      stagingLoader->convertToMinimumPhase(channel, fftSize);
      for (size_t frame = 0; frame < frames; ++frame)
        stagingLoader->irBuffer_[frame * static_cast<size_t>(channels) + channelIndex] = channel[frame];
    }
  }
  if (!stagingLoader->resampleAndInitialize(*stagingBuffer, processor.sampleRate_)) {
    errorMessage = "Failed to resample browser IR to engine rate";
    return false;
  }
  const int latency = stagingEngine->SetImpulse(stagingBuffer.get(), 64, 0, 0, 0);
  if (latency < 0) {
    errorMessage = "Failed to initialize browser convolution engine";
    return false;
  }
  if (slot == 0) {
    {
      std::lock_guard<std::mutex> lock(processor.pendingMutex1_);
      processor.stagingEngine1_ = std::move(stagingEngine);
      processor.stagingLoaded1_ = true;
      processor.stagingLatency1_ = latency;
      processor.ir1Pending_.store(true, std::memory_order_release);
    }
    processor.impulseBuffer1_ = std::move(stagingBuffer);
    processor.irLoader1_ = std::move(stagingLoader);
    processor.currentIR1Path_ = "browser://ir-a";
  } else {
    {
      std::lock_guard<std::mutex> lock(processor.pendingMutex2_);
      processor.stagingEngine2_ = std::move(stagingEngine);
      processor.stagingLoaded2_ = true;
      processor.stagingLatency2_ = latency;
      processor.ir2Pending_.store(true, std::memory_order_release);
    }
    processor.impulseBuffer2_ = std::move(stagingBuffer);
    processor.irLoader2_ = std::move(stagingLoader);
    processor.currentIR2Path_ = "browser://ir-b";
  }
  errorMessage.clear();
  return true;
}`}
function browserAssetSamplerMethods(contract){if(!contract)return"";if(contract.storage==="rgb-pointer")return`  static constexpr int rackWebAssetSampleCapacity = ${contract.maxSamples};
  float rackWebAssetSamples[rackWebAssetSampleCapacity]{};
  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples; }
  void commitAsset(int frames, int sourceChannels, float sourceWidth) override {
    const int channels = std::clamp(sourceChannels, 1, 4);
    const int width = std::clamp(static_cast<int>(sourceWidth), 1, 4096);
    const int pixels = std::clamp(frames, 0, rackWebAssetSampleCapacity / channels);
    const int height = pixels / width;
    std::lock_guard<std::mutex> lock(imageMutex);
    std::free(imageData); imageData = nullptr;
    if (height < 1) { imageWidth = imageHeight = 0; loadedImagePath.clear(); imageDirty = true; return; }
    imageData = static_cast<unsigned char*>(std::malloc(static_cast<size_t>(width) * height * 3));
    if (!imageData) { imageWidth = imageHeight = 0; loadedImagePath.clear(); imageDirty = true; return; }
    for (int pixel = 0; pixel < width * height; ++pixel) {
      const float red = rackWebAssetSamples[pixel * channels];
      const float green = channels > 1 ? rackWebAssetSamples[pixel * channels + 1] : red;
      const float blue = channels > 2 ? rackWebAssetSamples[pixel * channels + 2] : red;
      imageData[pixel * 3] = static_cast<unsigned char>(std::clamp(red, 0.f, 1.f) * 255.f + .5f);
      imageData[pixel * 3 + 1] = static_cast<unsigned char>(std::clamp(green, 0.f, 1.f) * 255.f + .5f);
      imageData[pixel * 3 + 2] = static_cast<unsigned char>(std::clamp(blue, 0.f, 1.f) * 255.f + .5f);
    }
    imageWidth = width; imageHeight = height; loadedImagePath = "browser://rgb";
    playheadX = playheadY = 0; currentRed = currentGreen = currentBlue = 0.f;
    imageDirty = true; requestLoadDialog = false;
  }`;
if(contract.mode==="lua-script")return`  static constexpr int rackWebAssetSampleCapacity = ${contract.maxSamples};
  float rackWebAssetSamples[rackWebAssetSampleCapacity]{};
  std::string rackWebScriptSource;
  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples; }
  void commitAsset(int frames, int, float) override {
    const int byteCount = std::clamp(frames, 0, rackWebAssetSampleCapacity);
    rackWebScriptSource.resize(static_cast<size_t>(byteCount));
    for (int index = 0; index < byteCount; ++index)
      rackWebScriptSource[static_cast<size_t>(index)] = static_cast<char>(std::clamp(static_cast<int>(std::lround(rackWebAssetSamples[index])), 0, 255));
    scriptPath = byteCount > 0 ? "browser://script.lua" : "";
    if (byteCount > 0) loadScript(); else unloadScript();
  }`;
if(contract.mode==="midi-file")return`  static constexpr int rackWebAssetSampleCapacity = ${contract.maxSamples};
  float rackWebAssetSamples[rackWebAssetSampleCapacity]{};
  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples; }
  void commitAsset(int frames, int, float) override {
    stop(); rewind(); fileLoaded = false; setTrackCount(0);
    const int byteCount = std::clamp(frames, 0, rackWebAssetSampleCapacity);
    if (byteCount < 14) { filePath.clear(); fileName.clear(); return; }
    auto byteAt = [this](int index) {
      return std::clamp(static_cast<int>(std::lround(rackWebAssetSamples[index])), 0, 255);
    };
    if (byteAt(0) != 'M' || byteAt(1) != 'T' || byteAt(2) != 'h' || byteAt(3) != 'd') {
      filePath.clear(); fileName.clear(); return;
    }
    std::string bytes(static_cast<size_t>(byteCount), '\\0');
    for (int index = 0; index < byteCount; ++index)
      bytes[static_cast<size_t>(index)] = static_cast<char>(byteAt(index));
    std::istringstream input(bytes, std::ios::binary);
    if (!midiFile.read(input)) { filePath.clear(); fileName.clear(); return; }
    setTrackCount(midiFile.getTrackCount());
    midiFile.doTimeAnalysis();
    midiFile.linkNotePairs();
    midiFile.joinTracks();
    filePath = "browser://midi";
    fileName = "Browser MIDI";
    fileDuration = static_cast<float>(midiFile.getFileDurationInSeconds());
    fileDurationStr = timeToString(fileDuration);
    fileLoaded = true;
  }`;
if(contract.mode==="octobir-ir-pair")return`  static constexpr int rackWebAssetSampleCapacity = ${contract.maxSamples};
  float rackWebAssetSamples[rackWebAssetSampleCapacity]{};
  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples; }
  int assetSlotCount() const override { return 2; }
  int assetCapacityForSlot(int slot) const override { return slot >= 0 && slot < 2 ? rackWebAssetSampleCapacity : 0; }
  float* assetBufferForSlot(int slot) override { return slot >= 0 && slot < 2 ? rackWebAssetSamples : nullptr; }
  void commitAsset(int frames, int sourceChannels, float sourceSampleRate) override { commitAssetForSlot(0, frames, sourceChannels, sourceSampleRate); }
  void commitAssetForSlot(int slot, int frames, int sourceChannels, float sourceSampleRate) override {
    if (slot < 0 || slot >= 2) return;
    const int channels = std::clamp(sourceChannels, 1, 2);
    const int sampleFrames = std::clamp(frames, 0, rackWebAssetSampleCapacity / channels);
    const float sampleRate = sourceSampleRate > 0.f ? sourceSampleRate : 48000.f;
    std::string error;
    if (!rackWebLoadOctobirSamples(irProcessor_, slot, rackWebAssetSamples, sampleFrames, channels, sampleRate, error)) {
      if (slot == 0) clearIR1(); else clearIR2();
      return;
    }
    std::lock_guard<std::mutex> lock(path_mutex_);
    if (slot == 0) loaded_file_path1_ = "browser://ir-a"; else loaded_file_path2_ = "browser://ir-b";
  }`;
if(contract.mode==="rgba-image")return`  static constexpr int rackWebAssetSampleCapacity = ${contract.maxSamples};
  float rackWebAssetSamples[rackWebAssetSampleCapacity]{};
  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples; }
  void commitAsset(int frames, int sourceChannels, float sourceWidth) override {
    const int nextWidth = std::clamp(static_cast<int>(sourceWidth), 1, 4096), nextChannels = std::clamp(sourceChannels, 1, 4), nextFrames = std::clamp(frames, 0, rackWebAssetSampleCapacity / nextChannels), nextHeight = nextFrames / nextWidth;
    if (nextHeight < 1) { image.clear(); width = height = 0; lastPath.clear(); loading = false; return; }
    width = nextWidth; height = nextHeight; image.resize(static_cast<size_t>(width) * height * 8);
    for (size_t pixel = 0; pixel < static_cast<size_t>(width) * height; ++pixel) for (int channel = 0; channel < 4; ++channel) { const float value = channel < nextChannels ? rackWebAssetSamples[pixel * nextChannels + channel] : 1.f; const unsigned sample = static_cast<unsigned>(std::clamp(value, 0.f, 1.f) * 65535.f + .5f); image[pixel * 8 + channel * 2] = static_cast<unsigned char>(sample >> 8); image[pixel * 8 + channel * 2 + 1] = static_cast<unsigned char>(sample & 255); }
    samplePos = 0; rIdx = 0; lastPath = "browser://rgba"; loading = false;
  }`;
if(contract.mode==="earlevel-wavetable")return`  static constexpr int rackWebAssetSampleCapacity = ${contract.maxSamples};
  float rackWebAssetSamples[rackWebAssetSampleCapacity]{};
  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples; }
  void commitAsset(int frames, int sourceChannels, float) override {
    if (!wavetable) return;
    const int channels = std::clamp(sourceChannels, 1, ${contract.channels});
    const int sourceFrames = std::clamp(frames, 0, rackWebAssetSampleCapacity / channels);
    if (sourceFrames < 2) return;
    int nextCycleLength = wavetable->cycleLength;
    if (nextCycleLength < 2 || nextCycleLength > 2048 || nextCycleLength > sourceFrames) {
      nextCycleLength = sourceFrames;
      for (int candidate : {2048, 1024, 512, 256}) if (candidate <= sourceFrames) { nextCycleLength = candidate; break; }
    }
    const int nextCycles = std::clamp(sourceFrames / nextCycleLength, 1, 256);
    const int copiedFrames = nextCycles * nextCycleLength;
    wavetable->loading = true;
    for (auto* oscillator : wavetable->wavetableOscillators) delete oscillator;
    wavetable->wavetableOscillators.clear();
    wavetable->cycleBuffers = {};
    wavetable->cycleLength = nextCycleLength;
    wavetable->numCycles = nextCycles;
    for (int frame = 0; frame < copiedFrames; ++frame) {
      float mono = 0.f;
      for (int channel = 0; channel < channels; ++channel) mono += rackWebAssetSamples[frame * channels + channel];
      const int cycle = frame / nextCycleLength, index = nextCycleLength - 1 - frame % nextCycleLength;
      wavetable->cycleBuffers[cycle][index] = mono / channels;
    }
    for (int cycle = 0; cycle < nextCycles; ++cycle)
      wavetable->wavetableOscillators.push_back(waveOsc(wavetable->cycleBuffers[cycle].data(), nextCycleLength));
    wavetable->lastPath = "browser://wavetable";
    wavetable->loaded = true;
    wavetable->loading = false;
    currentTableName = "Browser wavetable";
  }`;
if(contract.mode==="wavetable")return`  static constexpr int rackWebAssetSampleCapacity = ${contract.maxSamples};
  float rackWebAssetSamples[rackWebAssetSampleCapacity]{};
  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples; }
  void commitAsset(int frames, int sourceChannels, float) override {
    const int channels = std::clamp(sourceChannels, 1, ${contract.channels}), nextFrames = std::clamp(frames, 0, rackWebAssetSampleCapacity / channels);
    for (int frame = 0; frame < nextFrames; ++frame) { float mono = 0.f; for (int channel = 0; channel < channels; ++channel) mono += rackWebAssetSamples[frame * channels + channel]; rackWebAssetSamples[frame] = mono / channels; }
    if (nextFrames > 1) { table.loadSample(nextFrames, frameSize, true, rackWebAssetSamples); table.calcFFT(); morphType = -1; lastPath = "browser://audio"; dirty = true; }
  }`;
if(contract.mode==="fundamental-wavetable")return`  static constexpr int rackWebAssetSampleCapacity = ${contract.maxSamples};
  float rackWebAssetSamples[rackWebAssetSampleCapacity]{};
  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples; }
  void commitAsset(int frames, int sourceChannels, float sourceSampleRate) override {
    const int channels = std::clamp(sourceChannels, 1, ${contract.channels});
    const int sourceFrames = std::clamp(frames, 0, rackWebAssetSampleCapacity / channels);
    if (sourceFrames < 32) return;
    size_t nextWaveLen = wavetable.waveLen;
    const int encodedWaveLen = static_cast<int>(std::lround(sourceSampleRate));
    if (encodedWaveLen >= 32 && encodedWaveLen <= sourceFrames && (encodedWaveLen & (encodedWaveLen - 1)) == 0)
      nextWaveLen = static_cast<size_t>(encodedWaveLen);
    if (nextWaveLen < 32 || nextWaveLen > static_cast<size_t>(sourceFrames) || sourceFrames % nextWaveLen != 0) {
      nextWaveLen = 32;
      while (nextWaveLen * 2 <= static_cast<size_t>(sourceFrames) && nextWaveLen * 2 <= 16384)
        nextWaveLen *= 2;
    }
    const int copiedFrames = sourceFrames / static_cast<int>(nextWaveLen) * static_cast<int>(nextWaveLen);
    wavetable.loading = true;
    wavetable.samples.resize(static_cast<size_t>(copiedFrames));
    for (int frame = 0; frame < copiedFrames; ++frame) {
      float mono = 0.f;
      for (int channel = 0; channel < channels; ++channel)
        mono += rackWebAssetSamples[frame * channels + channel];
      wavetable.samples[frame] = mono / channels;
    }
    wavetable.waveLen = nextWaveLen;
    wavetable.filename = "browser://wavetable";
    wavetable.interpolate();
    wavetable.loading = false;
  }`;
if(contract.mode==="audiofile-tape")return`  static constexpr int rackWebAssetSampleCapacity = ${contract.maxSamples};
  float rackWebAssetSamples[rackWebAssetSampleCapacity]{};
  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples; }
  void commitAsset(int frames, int sourceChannels, float sourceSampleRate) override {
    const int channels = std::clamp(sourceChannels, 1, ${contract.channels});
    const int sourceFrames = std::clamp(frames, 0, rackWebAssetSampleCapacity / channels);
    if (sourceFrames < 1) { initTape(INIT_TAPE_ERASE); return; }
    constexpr float tapeSampleRate = 44100.f;
    const float inputSampleRate = sourceSampleRate > 0.f ? sourceSampleRate : tapeSampleRate;
    const int targetFrames = std::max(1, static_cast<int>(std::lround(sourceFrames * tapeSampleRate / inputSampleRate)));
    int nextTapeLength = NUM_TAPE_LENGTHS - 1;
    for (int index = 0; index < NUM_TAPE_LENGTHS; ++index) if (TAPE_LENGTHS[index].value >= targetFrames) { nextTapeLength = index; break; }
    audioFilePath.clear(); trackCountParam = channels; tapeLengthParam = nextTapeLength;
    audioFile.setNumSamplesPerChannel(static_cast<int>(TAPE_LENGTHS[tapeLengthParam].value));
    initTape(INIT_TAPE_TRACK_COUNT);
    audioFile.setSampleRate(static_cast<uint32_t>(tapeSampleRate));
    for (auto& channel : audioFile.samples) std::fill(channel.begin(), channel.end(), 0.f);
    const int copiedFrames = std::min(targetFrames, sizeAudioBuffer);
    for (int frame = 0; frame < copiedFrames; ++frame) {
      const float sourcePosition = frame * inputSampleRate / tapeSampleRate;
      const int left = std::clamp(static_cast<int>(std::floor(sourcePosition)), 0, sourceFrames - 1), right = std::min(left + 1, sourceFrames - 1);
      const float mix = sourcePosition - left;
      for (int channel = 0; channel < channels; ++channel) audioFile.samples[channel][frame] = crossfade(rackWebAssetSamples[left * channels + channel], rackWebAssetSamples[right * channels + channel], mix);
    }
  }`;
if(contract.mode==="buffer-sludger")return`  static constexpr int rackWebAssetSampleCapacity = ${contract.maxSamples};
  float rackWebAssetSamples[rackWebAssetSampleCapacity]{};
  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples; }
  void commitAsset(int frames, int sourceChannels, float sourceSampleRate) override {
    const int channels = std::clamp(sourceChannels, 1, ${contract.channels});
    const int nextFrames = std::clamp(frames, 0, static_cast<int>(rackWebAssetSampleCapacity / channels));
    samples[0].resize(nextFrames); samples[1].resize(nextFrames);
    for (int frame = 0; frame < nextFrames; ++frame) {
      const float left = rackWebAssetSamples[frame * channels];
      samples[0][frame] = left * 5.f;
      samples[1][frame] = channels > 1 ? rackWebAssetSamples[frame * channels + 1] * 5.f : left * 5.f;
    }
    const int assetSampleRate = sourceSampleRate > 0.f ? static_cast<int>(sourceSampleRate) : 48000;
    isStereo = channels > 1; masterLength = nextFrames > 0 ? static_cast<float>(nextFrames) / assetSampleRate : 0.f;
    lsampleRate = -1;
    reset(true); lastOutputIndex = -1; lmasterLength = masterLength; firstBeat = false;
  }`;
if(contract.mode==="mono-slots")return`  static constexpr int rackWebAssetSampleCapacity = ${contract.maxSamples};
  float rackWebAssetSamples[rackWebAssetSampleCapacity]{};
  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples; }
  int assetSlotCount() const override { return ${contract.slots}; }
  int assetCapacityForSlot(int slot) const override { return slot >= 0 && slot < ${contract.slots} ? rackWebAssetSampleCapacity : 0; }
  float* assetBufferForSlot(int slot) override { return slot >= 0 && slot < ${contract.slots} ? rackWebAssetSamples : nullptr; }
  void commitAsset(int frames, int sourceChannels, float sourceSampleRate) override { commitAssetForSlot(currentChannel, frames, sourceChannels, sourceSampleRate); }
  void commitAssetForSlot(int slot, int frames, int sourceChannels, float sourceSampleRate) override {
    if (slot < 0 || slot >= ${contract.slots}) return;
    std::lock_guard<std::mutex> guard(mylock);
    auto& target = channels[slot];
    target.sampleChannels = std::clamp(sourceChannels, 1, ${contract.channels}); target.totalSampleCount = std::clamp(frames, 0, rackWebAssetSampleCapacity / target.sampleChannels); target.sampleRate = sourceSampleRate > 0.f ? static_cast<int>(sourceSampleRate) : 48000;
    target.playBuffer.resize(target.totalSampleCount);
    for (int i = 0; i < target.totalSampleCount; ++i) { float mono = 0.f; for (int channel = 0; channel < target.sampleChannels; ++channel) mono += rackWebAssetSamples[i * target.sampleChannels + channel]; target.playBuffer[i].samples[0] = mono / target.sampleChannels; }
    target.head = 0.f; target.active = false; target.lastPath.clear(); loading = false;
  }`;
if(contract.mode==="mono-buffer")return`  static constexpr int rackWebAssetSampleCapacity = ${contract.maxSamples};
  float rackWebAssetSamples[rackWebAssetSampleCapacity]{};
  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples; }
  void commitAsset(int frames, int sourceChannels, float sourceSampleRate) override {
    std::lock_guard<std::mutex> guard(mylock);
    sampleChannels = std::clamp(sourceChannels, 1, ${contract.channels}); totalSampleCount = std::clamp(frames, 0, rackWebAssetSampleCapacity / sampleChannels); sampleRate = sourceSampleRate > 0.f ? static_cast<int>(sourceSampleRate) : 48000;
    playBuffer.resize(totalSampleCount);
    for (int i = 0; i < totalSampleCount; ++i) { float mono = 0.f; for (int channel = 0; channel < sampleChannels; ++channel) mono += rackWebAssetSamples[i * sampleChannels + channel]; playBuffer[i].samples[0] = mono / sampleChannels; }
    loading = false; lastPath.clear();
  }`;
if(contract.mode==="planar-stereo-buffer"){const countField=contract.countField??"totalSampleC",planes=contract.planes??2;return`  static constexpr int rackWebAssetSampleCapacity = ${contract.maxSamples};
  float rackWebAssetSamples[rackWebAssetSampleCapacity]{};
  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples; }
  void commitAsset(int frames, int sourceChannels, float sourceSampleRate) override {
    channels = std::clamp(sourceChannels, 1, ${contract.channels});
    const int nextFrames = std::clamp(frames, 0, static_cast<int>(rackWebAssetSampleCapacity / channels));
    ${countField} = static_cast<drwav_uint64>(nextFrames);
    sampleRate = sourceSampleRate > 0.f ? static_cast<unsigned int>(sourceSampleRate) : 48000u;
    playBuffer.resize(${planes}); playBuffer[0].resize(${countField});${planes>1?` playBuffer[1].resize(${countField});`:""}
    for (size_t frame = 0; frame < ${countField}; ++frame) {
      const float left = rackWebAssetSamples[frame * channels];
      playBuffer[0][frame] = left;
      ${planes>1?"playBuffer[1][frame] = channels > 1 ? rackWebAssetSamples[frame * channels + 1] : left;":""}
    }
    samplePos = 0.f;${contract.hasStartPos?" startPos = 0.f;":""}${contract.playField?` ${contract.playField} = false;`:""}${contract.hasFileLoaded?` fileLoaded = ${countField} > 0;`:""} loading = false;${contract.hasReload?" reload = false;":""}${contract.hasLastPath?" lastPath.clear();":""}
  }`}
if(contract.mode==="stereo-buffer")return`  static constexpr int rackWebAssetSampleCapacity = ${contract.maxSamples};
  float rackWebAssetSamples[rackWebAssetSampleCapacity]{};
  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples; }
  void commitAsset(int frames, int sourceChannels, float sourceSampleRate) override {
    std::lock_guard<std::mutex> guard(mylock);
    channels = std::clamp(sourceChannels, 1, ${contract.channels}); totalSampleCount = std::clamp(frames, 0, rackWebAssetSampleCapacity / channels); sampleRate = sourceSampleRate > 0.f ? static_cast<int>(sourceSampleRate) : 48000;
    playBuffer.resize(totalSampleCount);
    for (int i = 0; i < totalSampleCount; ++i) { const float left = rackWebAssetSamples[i * channels]; playBuffer[i].samples[0] = left; playBuffer[i].samples[1] = channels > 1 ? rackWebAssetSamples[i * channels + 1] : left; }
    samplePos = 0.f; play = false; loading = false; lastPath.clear(); ${contract.slices?"slices.clear(); slices.push_back(0);":""}
  }`;
return `  static constexpr int rackWebAssetSampleCapacity = ${contract.maxSamples};
  float rackWebAssetSamples[rackWebAssetSampleCapacity]{};
  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples; }
  void commitAsset(int frames, int sourceChannels, float sourceSampleRate) override {
    std::lock_guard<std::mutex> guard(mylock);
    const int nextChannels = std::clamp(sourceChannels, 1, ${contract.channels});
    const int nextFrames = std::clamp(frames, 0, rackWebAssetSampleCapacity / nextChannels);
    if (nextFrames < 2) { totalSampleCount = 0; loading = false; return; }
    std::free(sample); std::free(rev_sample);
    sample = static_cast<float*>(std::malloc(sizeof(float) * 2 * nextFrames));
    rev_sample = static_cast<float*>(std::malloc(sizeof(float) * 2 * nextFrames));
    if (!sample || !rev_sample) { std::free(sample); std::free(rev_sample); sample = nullptr; rev_sample = nullptr; totalSampleCount = 0; loading = false; return; }
    channels = nextChannels; sampleRate = sourceSampleRate > 0.f ? static_cast<int>(sourceSampleRate) : 48000; totalSampleCount = nextFrames;
    for (int i = 0; i < totalSampleCount; ++i) {
      float mono = 0.f; for (int channel = 0; channel < channels; ++channel) mono += rackWebAssetSamples[i * channels + channel]; mono /= channels;
      sample[i] = sample[i + totalSampleCount] = mono;
      rev_sample[i] = rev_sample[i + totalSampleCount] = rackWebAssetSamples[(totalSampleCount - i - 1) * channels];
    }
    mip_map.init_sample(2 * totalSampleCount, rspl::InterpPack::get_len_pre(), rspl::InterpPack::get_len_post(), 12, rspl::ResamplerFlt::_fir_mip_map_coef_arr, rspl::ResamplerFlt::MIP_MAP_FIR_LEN);
    mip_map.fill_sample(sample, 2 * totalSampleCount);
    rev_mip_map.init_sample(2 * totalSampleCount, rspl::InterpPack::get_len_pre(), rspl::InterpPack::get_len_post(), 12, rspl::ResamplerFlt::_fir_mip_map_coef_arr, rspl::ResamplerFlt::MIP_MAP_FIR_LEN);
    rev_mip_map.fill_sample(rev_sample, 2 * totalSampleCount);
    for (int i = 0; i < 16; ++i) { voices[i].set_sample(mip_map); voices[i].set_interp(interp_pack); voices[i].clear_buffers(); rev_voices[i].set_sample(rev_mip_map); rev_voices[i].set_interp(interp_pack); rev_voices[i].clear_buffers(); play[i] = false; rel[i] = false; gain[i] = 0.f; direction[i] = 1; }
    loadingBuffer.clear(); lastPath.clear(); loading = false;
  }`}
function adaptOpcOctobirBrowserSource(source,contract){
  const declaration=/\bstruct\s+OpcVcvIr\s+final\s*:\s*Module\s*\{/.exec(source);
  if(!declaration)fail("OctobIR browser adapter could not locate the generated module body");
  const open=source.indexOf("{",declaration.index),close=matchingBrace(source,open);
  if(close<0)fail("OctobIR browser adapter found an unterminated module body");
  return`${source.slice(0,close)}\npublic:\n${browserAssetSamplerMethods(contract)}
  float rackWebOctobirVisual[6]{-60.f, 0.f, 0.f, 0.f, -30.f, 20.f};
  int rackWebVisualCount() const override { return 6; }
  float* rackWebVisualBuffer() override {
    rackWebOctobirVisual[0] = getCurrentInputLevelDb();
    rackWebOctobirVisual[1] = getCurrentBlend();
    rackWebOctobirVisual[2] = getIRProcessor().isIR1Loaded() ? 1.f : 0.f;
    rackWebOctobirVisual[3] = getIRProcessor().isIR2Loaded() ? 1.f : 0.f;
    rackWebOctobirVisual[4] = getIRProcessor().getThreshold();
    rackWebOctobirVisual[5] = getIRProcessor().getRangeDb();
    return rackWebOctobirVisual;
  }
\n${source.slice(close)}`;
}
function adaptOhmerRkdBrowserSource(source){
  return source.replace(/RACK_WEB_EXPORTS\(([^)]+)\)\s*$/,`struct RackWebRkdModule : $1 {
  float rackWebDividerVisual[16]{};
  int rackWebVisualCount() const override { return 16; }
  float* rackWebVisualBuffer() override {
    const char* labels[8] = {dispDiv1, dispDiv2, dispDiv3, dispDiv4, dispDiv5, dispDiv6, dispDiv7, dispDiv8};
    for (int row = 0; row < 8; ++row) {
      rackWebDividerVisual[row * 2] = static_cast<unsigned char>(labels[row][0] ? labels[row][0] : ' ');
      rackWebDividerVisual[row * 2 + 1] = static_cast<unsigned char>(labels[row][1] ? labels[row][1] : ' ');
    }
    return rackWebDividerVisual;
  }
};

RACK_WEB_EXPORTS(RackWebRkdModule)`);
}
function browserUrlAudioAdapterSource(target,manifest,license,definitionFile,registrationFile,contract){return`// Browser streaming adapter for ${target.key}, preserving its Rack parameter and port indices.\n// Source: ${manifest.sourceUrl} (${definitionFile}; registered in ${registrationFile})\n// License: ${license}\n\n#include "rack_web_export.hpp"\n\nstruct RackWebUrlAudioModule : Module {\n  static constexpr int NUM_PARAMS = 3, NUM_INPUTS = 0, NUM_OUTPUTS = 2, NUM_LIGHTS = 3, rackWebAssetSampleCapacity = ${contract.maxSamples};\n  float rackWebAssetSamples[rackWebAssetSampleCapacity]{}; int frames = 0, channels = 0, head = 0; bool playing = false; std::string url; dsp::SchmittTrigger trigger;\n  RackWebUrlAudioModule() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configButton(1, "Trig"); configParam(2, 0.f, 3.f, 1.f, "Gain"); }\n  int assetCapacity() const override { return rackWebAssetSampleCapacity; } float* assetBuffer() override { return rackWebAssetSamples; }\n  void commitAsset(int nextFrames, int nextChannels, float) override { channels = std::clamp(nextChannels, 1, 2); frames = std::clamp(nextFrames, 0, rackWebAssetSampleCapacity / channels); head = 0; playing = false; }\n  json_t* dataToJson() override { auto* root = json_object(); json_object_set_new(root, "url", json_string(url.c_str())); return root; }\n  void dataFromJson(json_t* root) override { if (auto* value = json_object_get(root, "url")) url = json_string_value(value); }\n  void process(const ProcessArgs&) override { if (trigger.process(params[1].getValue())) playing = !playing; lights[0].setBrightness(playing ? 0.f : 1.f); lights[1].setBrightness(playing ? 1.f : 0.f); lights[2].setBrightness(playing ? 1.f : 0.f); if (!playing || frames < 1) return; const float gain = 5.f * params[2].getValue(), left = rackWebAssetSamples[head * channels], right = channels > 1 ? rackWebAssetSamples[head * channels + 1] : left; outputs[0].setVoltage(gain * left); outputs[1].setVoltage(gain * right); head = (head + 1) % frames; }\n};\n\nRACK_WEB_EXPORTS(RackWebUrlAudioModule)\n`}
function browserTapeInspectorAdapterSource(target,manifest,license,definitionFile,registrationFile){return`// Browser DSP adapter for ${target.key}; the native widget-only tape pointer is intentionally omitted.\n// Source: ${manifest.sourceUrl} (${definitionFile}; registered in ${registrationFile})\n// License: ${license}\n\n#include "rack_web_export.hpp"\n\nstruct RackWebTapeInspector : Module {\n  enum ParamIds { TIME_PARAM, AMPLITUDE_PARAM, NUM_PARAMS };\n  static constexpr int NUM_INPUTS = 0, NUM_OUTPUTS = 0, NUM_LIGHTS = 0;\n  float sampleTime = 1.f / 44100.f;\n  RackWebTapeInspector() { config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS); configParam(TIME_PARAM, .4f, 1.f, 1.f, "Time"); configParam(AMPLITUDE_PARAM, .5f, 1.5f, 1.f, "Amplitude"); }\n  void process(const ProcessArgs& args) override { sampleTime = args.sampleTime; }\n};\n\nRACK_WEB_EXPORTS(RackWebTapeInspector)\n`}
function browserComputerscareBlankAdapterSource(target,manifest,license,definitionFile,registrationFile){return`// Browser image adapter for ${target.key}; native file dialogs and Rack scene access are handled by the web host.
// Source: ${manifest.sourceUrl} (${definitionFile}; registered in ${registrationFile})
// License: ${license}

#include "rack_web_export.hpp"

struct RackWebComputerscareBlank : Module {
  enum ParamIds {
    ANIMATION_SPEED, ANIMATION_ENABLED, CONSTANT_FRAME_DELAY, ANIMATION_MODE,
    END_BEHAVIOR, SHUFFLE_SEED, NEXT_FILE_BEHAVIOR, SLIDESHOW_ACTIVE,
    SLIDESHOW_TIME, LIGHT_WIDGET_MODE, CROSSFADE_ENABLED, CROSSFADE_TIME,
    NUM_PARAMS
  };
  static constexpr int NUM_INPUTS = 0, NUM_OUTPUTS = 0, NUM_LIGHTS = 0;
  static constexpr int rackWebAssetSampleCapacity = 4194304;
  float rackWebAssetSamples[rackWebAssetSampleCapacity]{};
  int imageWidth = 0, imageHeight = 0, imageChannels = 0;
  float width = 120.f, zoomX = 1.f, zoomY = 1.f, xOffset = 0.f, yOffset = 0.f;
  int imageFitEnum = 0, rotation = 0;
  bool invertY = true, hidePanel = false;

  RackWebComputerscareBlank() {
    config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
    configParam(ANIMATION_SPEED, -1.f, 1.f, 0.f, "Animation Speed");
    configParam(ANIMATION_ENABLED, 0.f, 1.f, 1.f, "Animation Enabled");
    configParam(CONSTANT_FRAME_DELAY, 0.f, 1.f, 0.f, "Constant Frame Delay");
    configSwitch(ANIMATION_MODE, 0.f, 4.f, 0.f, "Animation Mode");
    configSwitch(END_BEHAVIOR, 0.f, 4.f, 0.f, "End Behavior");
    configParam(SHUFFLE_SEED, 0.f, 1.f, .5f, "Shuffle Seed");
    configSwitch(NEXT_FILE_BEHAVIOR, 0.f, 2.f, 0.f, "Next File Behavior");
    configParam(SLIDESHOW_ACTIVE, 0.f, 1.f, 0.f, "Slideshow Enabled");
    configParam(SLIDESHOW_TIME, 0.f, 1.f, .200948f, "Slideshow Time");
    configParam(LIGHT_WIDGET_MODE, 0.f, 1.f, 0.f, "Keep image opaque");
    configParam(CROSSFADE_ENABLED, 0.f, 1.f, 1.f, "Crossfade Enabled");
    configParam(CROSSFADE_TIME, 0.f, 1.f, .1f, "Crossfade Time");
  }
  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples; }
  void commitAsset(int frames, int sourceChannels, float sourceWidth) override {
    imageChannels = std::clamp(sourceChannels, 1, 4);
    imageWidth = std::clamp(static_cast<int>(sourceWidth), 1, 4096);
    const int pixels = std::clamp(frames, 0, rackWebAssetSampleCapacity / imageChannels);
    imageHeight = pixels / imageWidth;
    if (imageHeight < 1) imageWidth = imageChannels = 0;
  }
  json_t* dataToJson() override {
    auto* root = json_object();
    json_object_set_new(root, "width", json_real(width));
    json_object_set_new(root, "imageFitEnum", json_integer(imageFitEnum));
    json_object_set_new(root, "invertY", json_boolean(invertY));
    json_object_set_new(root, "zoomX", json_real(zoomX));
    json_object_set_new(root, "zoomY", json_real(zoomY));
    json_object_set_new(root, "xOffset", json_real(xOffset));
    json_object_set_new(root, "yOffset", json_real(yOffset));
    json_object_set_new(root, "rotation", json_integer(rotation));
    json_object_set_new(root, "hidePanel", json_boolean(hidePanel));
    return root;
  }
  void dataFromJson(json_t* root) override {
    if (auto* value = json_object_get(root, "width")) width = json_number_value(value);
    if (auto* value = json_object_get(root, "imageFitEnum")) imageFitEnum = json_integer_value(value);
    if (auto* value = json_object_get(root, "invertY")) invertY = json_is_true(value);
    if (auto* value = json_object_get(root, "zoomX")) zoomX = json_number_value(value);
    if (auto* value = json_object_get(root, "zoomY")) zoomY = json_number_value(value);
    if (auto* value = json_object_get(root, "xOffset")) xOffset = json_number_value(value);
    if (auto* value = json_object_get(root, "yOffset")) yOffset = json_number_value(value);
    if (auto* value = json_object_get(root, "rotation")) rotation = json_integer_value(value);
    if (auto* value = json_object_get(root, "hidePanel")) hidePanel = json_is_true(value);
  }
  void process(const ProcessArgs&) override {}
};

RACK_WEB_EXPORTS(RackWebComputerscareBlank)
`}
function stripWavetableFilesystemPrelude(source){for(const name of ["tSaveWaveTableAsWave","tSaveFrameAsWave","tSaveWaveTableAsPng","tLoadSample","tLoadFrame","tLoadPNG"])for(const definition of outOfLineFreeFunctionDefinitions(source,name))source=source.replace(definition,"");return source.replace(/^\s*static\s+const\s+char\s+(?:WAV|PNG)_FILTERS\s*\[[^\]]*\]\s*=\s*[^;]+;\s*$/gm,"")}
function adaptWavetableImplementations(implementations,className){return implementations.map(value=>{for(const method of ["loadFrame","loadPNG"])value=replaceOutOfLineMethod(value,className,method,`void ${className}::${method}() {}`);value=replaceOutOfLineMethod(value,className,"addFrame",`void ${className}::addFrame() { tAddFrame(table, params[INDEX_PARAM].getValue()); }`);return value})}
function adaptIggyTableBrowserSource(source){
  source=source.replace(/^[ \t]*#[ \t]*define[ \t]+DR_WAV_IMPLEMENTATION[ \t]*\r?\n[ \t]*#include[ \t]+"[^"]*dr_wav\.h"[ \t]*\r?\n?/gm,"");
  const wavetableDefinition=classDefinitionSource(source,"Wavetable");
  if(wavetableDefinition){
    const adapted=replaceInlineMethodBody(wavetableDefinition,/\bvoid\s+loadWavetable\s*\(\s*std::string\s+path\s*,\s*int\s+cl\s*\)\s*\{/,`
      (void)path;
      for (int candidate : cycleLengths) if (candidate == cl) cycleLength = candidate;
      loading = false;
    `);
    source=source.replace(wavetableDefinition,adapted)
  }
  const tableDefinition=classDefinitionSource(source,"Table");
  if(tableDefinition){
    let adapted=replaceInlineMethodBody(tableDefinition,/\bvoid\s+loadWavetable\s*\(\s*std::string\s+path\s*,\s*int\s+cycleLength\s*\)\s*\{/,`
      (void)path;
      if (wavetable) for (int candidate : Wavetable::cycleLengths) if (candidate == cycleLength) wavetable->cycleLength = candidate;
    `);
    adapted=replaceInlineMethodBody(adapted,/\bvoid\s+dataFromJson\s*\(\s*json_t\s*\*\s*rootJ\s*\)\s*override\s*\{/,`
      if (!wavetable) return;
      if (json_t* value = json_object_get(rootJ, "lastCycleLength")) {
        const int cycleLength = static_cast<int>(json_integer_value(value));
        for (int candidate : Wavetable::cycleLengths) if (candidate == cycleLength) wavetable->cycleLength = candidate;
      }
    `);
    source=source.replace(tableDefinition,adapted)
  }
  return source
}
function adaptAudioFileTapeImplementations(implementations,className,contract){
  if(contract?.mode!=="audiofile-tape")return implementations;
  const adapted=implementations.map(value=>{
    value=value.replace(/\bloaded\s*=\s*audioFile\.load\s*\([^;]*\)\s*;/g,"loaded = false;");
    value=replaceOutOfLineMethod(value,className,"onSave",`void ${className}::onSave(const SaveEvent&) {}`);
    value=replaceOutOfLineMethod(value,className,"getAudioFileDir",`std::string ${className}::getAudioFileDir() { return {}; }`);
    value=replaceOutOfLineMethod(value,className,"saveAudioFile",`void ${className}::saveAudioFile(std::string) {}`);
    value=replaceOutOfLineMethod(value,className,"loadAudioFile",`void ${className}::loadAudioFile(std::string path) { if (path.empty()) initTape(INIT_TAPE_ERASE); }`);
    return value;
  });
  const source=adapted.join("\n"),helpers=[];
  if(/\btoggleParamValue\s*\(/.test(source)&&!/\bvoid\s+toggleParamValue\s*\([^;{}]*\)\s*\{/.test(source))helpers.push("static void toggleParamValue(Param& param) { param.setValue(param.getValue() ? 0.f : 1.f); }");
  if(/\brescaleInput\s*\(/.test(source)&&!/\bfloat\s+rescaleInput\s*\([^;{}]*\)\s*\{/.test(source))helpers.push("static float rescaleInput(Input& port, int channel = 0) { return rescale(port.getVoltage(channel), .1f, 2.f, 0.f, 1.f); }");
  return[...helpers,...adapted];
}
function jsonStateType(name){return name==="boolean"||name==="boolean_value"||name==="is_true"?"boolean":name==="real"||name==="real_value"||name==="number_value"?"real":"integer"}
function loopCountBefore(source,position,indexName,constants={}){const prefix=source.slice(Math.max(0,position-2400),position),pattern=new RegExp(`for\\s*\\(\\s*int\\s+${indexName}\\s*=\\s*0\\s*;\\s*${indexName}\\s*<\\s*([^;]+)`,"g");let count=0;for(const match of prefix.matchAll(pattern))count=numberLiteral(match[1],0,{PORT_MAX_CHANNELS:16,...constants});return count}
function scalarJsonStateKeys(source,constants={}){
  const stringDefines=new Map(rustSourceDeclarations(source).macroDefinitions.filter(candidate=>!candidate.commented&&!candidate.functionLike&&/^"[^"]*"$/.test(candidate.replacement)).map(candidate=>[candidate.name,candidate.replacement.slice(1,-1)]));for(const [name,value] of stringDefines)source=source.replace(new RegExp(`\\b${name}\\b`,"g"),JSON.stringify(value));
  const arrays=new Map(),found=[],nestedObjects=new Set([...source.matchAll(/json_array_append_new\s*\(\s*[A-Za-z_]\w*\s*,\s*([A-Za-z_]\w*)\s*\)/g)].map(match=>match[1]));
  for(const match of source.matchAll(/json_array_insert_new\s*\(\s*([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)\s*,\s*json_(integer|real|boolean)\s*\(/g)){const count=loopCountBefore(source,match.index,match[2],constants);if(count>0&&count<=512)arrays.set(match[1],{count,type:jsonStateType(match[3])})}
  for(const match of source.matchAll(/json_array_append_new\s*\(\s*([A-Za-z_]\w*)\s*,\s*json_(integer|real|boolean)\s*\(/g)){const prefix=source.slice(Math.max(0,match.index-2400),match.index),loop=[...prefix.matchAll(/for\s*\(\s*int\s+([A-Za-z_]\w*)\s*=\s*0\s*;/g)].at(-1),count=loop?loopCountBefore(source,match.index,loop[1],constants):0;if(count>0&&count<=512)arrays.set(match[1],{count,type:jsonStateType(match[2])})}
  for(const match of source.matchAll(/json_array_insert_new\s*\(\s*([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)\s*\)/g)){const child=arrays.get(match[3]),count=loopCountBefore(source,match.index,match[2],constants);if(child&&count>0&&count<=32)arrays.set(match[1],{count,child})}
  for(const match of source.matchAll(/json_object_set(?:_new)?\s*\(\s*([A-Za-z_]\w*)\s*,\s*"([^"]+)"\s*,\s*json_(integer|real|boolean)\s*\(/g))if(!nestedObjects.has(match[1]))found.push({position:match.index,key:match[2],type:jsonStateType(match[3])});
  const stringStates=new Map();for(const match of source.matchAll(/json_object_set(?:_new)?\s*\(\s*([A-Za-z_]\w*)\s*,\s*"([^"]+)"\s*,\s*json_string\s*\(\s*"([^"]*)"\s*\)\s*\)/g)){if(nestedObjects.has(match[1]))continue;const state=stringStates.get(match[2])??{position:match.index,values:[]};if(!state.values.includes(match[3]))state.values.push(match[3]);stringStates.set(match[2],state)}for(const [key,state] of stringStates)found.push({position:state.position,key,type:"string-enum",values:state.values});
  function expandArray(array,key,position,path=[]){for(let index=0;index<array.count;index++){const next=[...path,index];if(array.child)expandArray(array.child,key,position,next);else found.push({position,path:next,key,type:array.type})}}
  for(const match of source.matchAll(/json_object_set(?:_new)?\s*\([^,]+,\s*"([^"]+)"\s*,\s*([A-Za-z_]\w*)\s*\)/g)){const array=arrays.get(match[2]);if(array)expandArray(array,match[1],match.index)}
  const objectArrays=new Map([...source.matchAll(/json_t\s*\*\s*([A-Za-z_]\w*)\s*=\s*json_object_get\s*\([^,]+,\s*"([^"]+)"\s*\)/g)].map(match=>[match[1],{key:match[2],position:match.index}]));
  for(const match of source.matchAll(/json_t\s*\*\s*([A-Za-z_]\w*)\s*=\s*json_array_get\s*\(\s*([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)\s*\)/g)){const object=objectArrays.get(match[2]),count=loopCountBefore(source,match.index,match[3],constants);if(!object||count<=0||count>512)continue;const tail=source.slice(match.index,match.index+500),valuePattern=new RegExp(`json_(boolean_value|is_true|integer_value|real_value|number_value)\\s*\\(\\s*${match[1]}\\s*\\)`),value=valuePattern.exec(tail);if(!value)continue;for(let index=0;index<count;index++)found.push({position:object.position,index,key:object.key,type:jsonStateType(value[1])})}
  const itemPath=item=>item.path??(item.index===undefined?[]:[item.index]),comparePath=(left,right)=>{const a=itemPath(left),b=itemPath(right);for(let index=0;index<Math.max(a.length,b.length);index++){if(a[index]===undefined)return-1;if(b[index]===undefined)return 1;if(a[index]!==b[index])return a[index]-b[index]}return 0};
  const unique=new Map();for(const item of found.sort((left,right)=>left.position-right.position||comparePath(left,right))){const path=itemPath(item),identity=`${item.key}:${path.length?path.join("."):"scalar"}`;if(!unique.has(identity))unique.set(identity,{...(path.length===1?{index:path[0]}:path.length>1?{path}:{}),key:item.key,type:item.type,...(item.values?{values:item.values}:{})})}return [...unique.values()]
}
function jsonObjectArrayStateKeys(source,constants={}){
  const objectFields=new Map();
  for(const match of source.matchAll(/json_object_set(?:_new)?\s*\(\s*([A-Za-z_]\w*)\s*,\s*"([^"]+)"\s*,\s*json_(integer|real|boolean)\s*\(/g)){const fields=objectFields.get(match[1])??[];fields.push({position:match.index,key:match[2],type:jsonStateType(match[3])});objectFields.set(match[1],fields)}
  const arrays=new Map();
  for(const match of source.matchAll(/json_array_append_new\s*\(\s*([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)\s*\)/g)){const fields=objectFields.get(match[2]),prefix=source.slice(Math.max(0,match.index-2400),match.index),loop=[...prefix.matchAll(/for\s*\(\s*int\s+([A-Za-z_]\w*)\s*=\s*0\s*;/g)].at(-1),count=loop?loopCountBefore(source,match.index,loop[1],constants):0;if(fields?.length&&count>0&&count<=256)arrays.set(match[1],{count,fields})}
  const found=[];
  for(const match of source.matchAll(/json_object_set(?:_new)?\s*\([^,]+,\s*"([^"]+)"\s*,\s*([A-Za-z_]\w*)\s*\)/g)){const array=arrays.get(match[2]);if(!array)continue;for(let index=0;index<array.count;index++)for(const field of array.fields)found.push({position:match.index,path:[index,field.key],key:match[1],type:field.type})}
  const unique=new Map();for(const item of found.sort((left,right)=>left.position-right.position||left.path[0]-right.path[0])){const identity=`${item.key}:${item.path.join(".")}`;if(!unique.has(identity))unique.set(identity,{path:item.path,key:item.key,type:item.type})}return [...unique.values()]
}
function jsonStateKeys(source,constants={}){
  const code=sourceWithoutComments(source);
  return [...scalarJsonStateKeys(code,constants),...jsonObjectArrayStateKeys(code,constants)]
}
const surgeSharedStateKeys=new Set(["streamingVersion","isCoupledToGlobalStyle","localStyle","localDisplayRegionColor","localModulationColor","localControlValueColor","localPowerButtonColor"]);
function runtimeStateKey(target,item){
  if(target.plugin!=="SurgeXTRack")return item;
  const path=item.path??(item.index===undefined?[]:[item.index]),key=surgeSharedStateKeys.has(item.key)?"xtshared":"modulespecific";
  return {key,path:[item.key,...path],type:item.type,...(item.values?{values:item.values}:{})};
}
function stripConditionalBlocks(source,predicate){
  let result=source;
  for(let pass=0;pass<128;pass++){
    let target=null;
    for(const match of result.matchAll(/\bif\s*\(/g)){
      const open=result.indexOf("(",match.index);let depth=0,quote="",close=-1;
      for(let index=open;index<result.length;index++){const current=result[index];if(quote){if(current==="\\")index++;else if(current===quote)quote="";continue}if(current==='"'||current==="'"){quote=current;continue}if(current==="(")depth++;else if(current===")"&&--depth===0){close=index;break}}
      if(close<0||!predicate(result.slice(open+1,close)))continue;
      let blockOpen=close+1;while(/\s/.test(result[blockOpen]??""))blockOpen++;
      let end;
      if(result[blockOpen]==="{"){const blockClose=matchingBrace(result,blockOpen);if(blockClose<0)continue;end=blockClose+1}
      else{const statementEnd=result.indexOf(";",blockOpen);if(statementEnd<blockOpen)continue;end=statementEnd+1}
      let cursor=end,replacement="";while(/\s/.test(result[cursor]??""))cursor++;
      if(result.slice(cursor,cursor+4)==="else"){cursor+=4;while(/\s/.test(result[cursor]??""))cursor++;if(result[cursor]==="{"){const alternativeClose=matchingBrace(result,cursor);if(alternativeClose>cursor){replacement=result.slice(cursor+1,alternativeClose);end=alternativeClose+1}}else{const statementEnd=result.indexOf(";",cursor);if(statementEnd>=cursor){replacement=result.slice(cursor,statementEnd+1);end=statementEnd+1}}}
      target={start:match.index,end,replacement};break
    }
    if(!target)break;result=result.slice(0,target.start)+target.replacement+result.slice(target.end)
  }
  return result
}
function isolateDisconnectedExpanders(body){
  return stripConditionalBlocks(body,condition=>/\b(?:left|right)Expander\b/.test(condition))
}
function stripEnclosingIfReferencing(source,name){let result=source;for(let pass=0;pass<32;pass++){let target=null;for(const occurrence of result.matchAll(new RegExp(`\\b${name}\\b`,"g"))){if(!isCodePosition(result,occurrence.index))continue;for(let open=occurrence.index;open>=0;open--){if(result[open]!=="{")continue;const close=matchingBrace(result,open);if(close<occurrence.index)continue;const prefix=result.slice(Math.max(0,open-500),open),ifMatch=/\bif\s*\([^{}]*\)\s*$/.exec(prefix);if(ifMatch){let end=close+1,cursor=end,replacement="";while(/\s/.test(result[cursor]??""))cursor++;if(result.slice(cursor,cursor+4)==="else"){cursor+=4;while(/\s/.test(result[cursor]??""))cursor++;if(result[cursor]==="{"){const alternativeClose=matchingBrace(result,cursor);if(alternativeClose>cursor){replacement=result.slice(cursor+1,alternativeClose);end=alternativeClose+1}}else{const statementEnd=result.indexOf(";",cursor);if(statementEnd>=cursor){replacement=result.slice(cursor,statementEnd+1);end=statementEnd+1}}}target={start:Math.max(0,open-500)+ifMatch.index,end,replacement};break}}if(target)break}if(!target)break;result=result.slice(0,target.start)+target.replacement+result.slice(target.end)}return result}
function nativeUiPointerMembers(body,typeSource=body){
  const uiTypes=uiClassClosure(sourceWithoutComments(typeSource));
  for(let pass=0;pass<64;pass++){
    const before=uiTypes.size;
    for(const name of declaredTypeNames(typeSource)){
      if(uiTypes.has(name))continue;
      const definition=classDefinitionSource(typeSource,name);
      if(definition&&[...uiTypes].some(uiType=>new RegExp(`\\b${uiType.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*\\*`).test(definition)))uiTypes.add(name);
    }
    if(uiTypes.size===before)break
  }
  const members=[
    ...[...body.matchAll(/\bstd::atomic\s*<\s*((?:[A-Z]\w*(?:Display|Widget|Label|Diagram|Graph|Knob|Port|Switch|Button|Light)|Display|Widget|Label|Diagram|Graph|Knob|Port|Switch|Button|Light))\s*\*\s*>\s*([A-Za-z_]\w*)[^;]*;/g)].filter(match=>!/[()]/.test(match[0])).map(match=>({declaration:match[0],name:match[2]})),
    ...[...body.matchAll(/\bstd::shared_ptr\s*<\s*(?:Image|[A-Z]\w*(?:Display|Widget|Label|Diagram|Graph|Knob|Port|Switch|Button|Light))\s*>\s*([A-Za-z_]\w*)[^;]*;/g)].filter(match=>!/[(){}]/.test(match[0])).map(match=>({declaration:match[0],name:match[1]})),
    ...[...body.matchAll(/\b(?:(?:struct|class)\s+)?((?:[A-Z]\w*(?:Display|Widget|Label|Diagram|Graph|Knob|Port|Switch|Button|Light)|Display|Widget|Label|Diagram|Graph|Knob|Port|Switch|Button|Light))\s*\*\s*([A-Za-z_]\w*)[^;]*;/g)].filter(match=>!/[(){}]/.test(match[0])).map(match=>({declaration:match[0],name:match[2]})),
  ];
  for(const match of body.matchAll(/\b(?:(?:struct|class)\s+)?((?:[A-Za-z_]\w*::)*[A-Za-z_]\w*)\s*\*\s*([A-Za-z_]\w*)[^;]*;/g))if(!/[(){}]/.test(match[0])&&uiTypes.has(baseTypeName(match[1])))members.push({declaration:match[0],name:match[2]});
  return[...new Map(members.map(member=>[`${member.name}\0${member.declaration}`,member])).values()]
}
function stripNativeUiReferencesByNames(source,names){
  let result=source;
  for(const name of new Set(names)){
    const linePattern=new RegExp(`^\\s*[^\\n;{}]*\\b${name}\\b[^\\n;{}]*;[^\\n]*$`,"gm");
    result=stripConditionalBlocks(result,condition=>new RegExp(`\\b${name}\\b`).test(condition));
    for(let pass=0;pass<32;pass++){
      const assignment=new RegExp(`^[ \\t]*${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*=(?!=)`,"m").exec(result);
      if(!assignment)break;
      const end=namespaceStatementEnd(result,assignment.index);
      if(end<0)break;
      result=result.slice(0,assignment.index)+result.slice(end)
    }
    result=result.replace(linePattern,"");
    result=stripEnclosingIfReferencing(result,name);
    result=result.replace(linePattern,"")
  }
  return result
}
function stripNativeUiPointerReferences(source,declarationSource=source,referenceSource=declarationSource){
  const members=nativeUiPointerMembers(declarationSource);
  let result=source;
  for(const match of declarationSource.matchAll(/\b(?:rack::math::|math::)?Vec\s+([A-Za-z_]\w*)\s*(?:=[^;]*)?;/g)){
    const name=match[1],escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),
      declarations=new RegExp(`\\b(?:rack::math::|math::)?Vec\\s+${escaped}\\s*(?:=[^;]*)?;`,"g"),
      references=sourceWithoutComments(referenceSource).replace(declarations,"");
    if(!new RegExp(`\\b${escaped}\\b`).test(references))result=result.replace(new RegExp(`\\b(?:rack::math::|math::)?Vec\\s+${escaped}\\s*(?:=[^;]*)?;`,"g"),"");
  }
  const names=[];
  for(const member of members){const aliases=[...declarationSource.matchAll(new RegExp(`\\bauto\\s*\\*\\s*([A-Za-z_]\\w*)\\s*=\\s*${member.name}\\s*\\.\\s*load\\s*\\(\\s*\\)`,"g"))].map(match=>match[1]);names.push(member.name,...aliases);result=result.replace(member.declaration,"")}
  return stripNativeUiReferencesByNames(result,names)
}
function stripNativeUiPointerBridges(body,referenceSource=body){
  return stripNativeUiPointerReferences(stripUiClassMembers(body),body,referenceSource)
}
function stripSingleControlStatementsReferencing(source,reference){
  let result=source;
  for(let pass=0;pass<64;pass++){
    let target=null;
    for(const match of result.matchAll(/\b(?:for|while)\s*\(/g)){
      const open=result.indexOf("(",match.index),close=matchingParenthesis(result,open);
      if(close<0)continue;
      let bodyStart=close+1;while(/\s/.test(result[bodyStart]??""))bodyStart++;
      if(result[bodyStart]==="{")continue;
      const bodyEnd=namespaceStatementEnd(result,bodyStart);
      if(bodyEnd<0||!reference.test(result.slice(bodyStart,bodyEnd)))continue;
      target=[match.index,bodyEnd];break
    }
    if(!target)break;
    result=result.slice(0,target[0])+result.slice(target[1])
  }
  return result
}
function stripNativeUiImplementationBridges(source,names){
  const localPointers=[...source.matchAll(/\b(?:[A-Z]\w*(?:Display|Widget|Label|Diagram)|Display|Widget|Label|Diagram)\s*\*\s*([A-Za-z_]\w*)\s*(?:=[^;]*)?;/g)].map(match=>({declaration:match[0],name:match[1]}));
  let result=source;const targets=new Set([
    ...names,
    ...localPointers.map(pointer=>pointer.name),
  ]);
  for(const pointer of localPointers)result=result.replace(pointer.declaration,"");
  for(const name of names)for(const match of source.matchAll(new RegExp(`\\bauto\\s*\\*\\s*([A-Za-z_]\\w*)\\s*=\\s*${name}\\s*(?:\\.\\s*load\\s*\\(\\s*\\))?\\s*;`,"g")))targets.add(match[1]);
  for(const name of targets){
    const reference=new RegExp(`\\b${name}\\b`),linePattern=new RegExp(`^[ \\t]*[^\\n;{}]*\\b${name}\\b[^\\n;{}]*;[^\\n]*$`,"gm");
    for(let pass=0;pass<32;pass++){const lambda=[...result.matchAll(/\bauto\s+([A-Za-z_]\w*)\s*=\s*\[[^\]]*\]\s*\([^{};]*\)\s*(?:->\s*[^{};]+)?\s*\{/g)].find(match=>{const open=result.indexOf("{",match.index),close=matchingBrace(result,open);return close>=0&&reference.test(result.slice(match.index,close+1))});if(!lambda)break;const open=result.indexOf("{",lambda.index),close=matchingBrace(result,open),semicolon=result.indexOf(";",close+1),end=semicolon>=close&&semicolon-close<8?semicolon+1:close+1;result=result.slice(0,lambda.index)+result.slice(end)}
    result=stripConditionalBlocks(result,condition=>reference.test(condition));
    result=stripSingleControlStatementsReferencing(result,reference);
    result=result.replace(linePattern,"");
    result=stripEnclosingIfReferencing(result,name);
    result=result.replace(linePattern,"");
  }
  return result.trim()
}
function objectExpanderMethods(detected){
  if(detected.expander?.role!=="base")return "";
  const type=detected.expander.family.split("::").at(-1),capacity=detected.expander.maxMembers??16;
  return `  ${type} rackWebExpanderModules[${capacity}]{};
  int rackWebExpanderCount = 0;
  int rackWebExpanderCapacity() const override { return ${capacity}; }
  void rackWebSetExpanderCount(int count) override {
    rackWebExpanderCount = std::clamp(count, 0, ${capacity});
    this->rightExpander = rackWebExpanderCount ? &rackWebExpanderModules[0] : nullptr;
    for (int index = 0; index < ${capacity}; index++) {
      auto& module = rackWebExpanderModules[index];
      module.leftExpander = index < rackWebExpanderCount ? (index ? &rackWebExpanderModules[index - 1] : this) : nullptr;
      module.rightExpander = index + 1 < rackWebExpanderCount ? &rackWebExpanderModules[index + 1] : nullptr;
    }
  }
  void rackWebSetExpanderType(int index, int typeId) override { if (index >= 0 && index < rackWebExpanderCount) rackWebExpanderModules[index].mixType = typeId; }
  void rackWebSetExpanderBypassed(int index, bool value) override { if (index >= 0 && index < rackWebExpanderCount) rackWebExpanderModules[index].bypassed = value; }
  void rackWebSetExpanderParam(int index, int id, float value) override { if (index >= 0 && index < rackWebExpanderCount && id >= 0 && id < rack::Module::rackWebMaxParams) rackWebExpanderModules[index].params[id].setValue(value); }
  void rackWebSetExpanderInputConnected(int index, int id, bool value) override { if (index >= 0 && index < rackWebExpanderCount && id >= 0 && id < 16) rackWebExpanderModules[index].inputs[id].connected = value; }
  void rackWebSetExpanderInputChannels(int index, int id, int channels) override { if (index >= 0 && index < rackWebExpanderCount && id >= 0 && id < 16) rackWebExpanderModules[index].inputs[id].setChannels(std::clamp(channels, 0, 16)); }
  void rackWebSyncExpanderFrame(int frame, const float* buffer, int blockSize) override {
    for (int index = 0; index < rackWebExpanderCount; index++) for (int port = 0; port < 16; port++) {
      auto& input = rackWebExpanderModules[index].inputs[port];
      for (int channel = 0; channel < input.getChannels(); channel++) input.setVoltage(buffer[(((index * 16 + port) * 16 + channel) * blockSize) + frame], channel);
    }
  }
  void rackWebCopyExpanderOutputFrame(int frame, float* buffer, int blockSize) override {
    for (int index = 0; index < rackWebExpanderCount; index++) for (int port = 0; port < 16; port++) {
      const auto& output = rackWebExpanderModules[index].outputs[port];
      for (int channel = 0; channel < 16; channel++) buffer[(((index * 16 + port) * 16 + channel) * blockSize) + frame] = channel < output.getChannels() ? output.getVoltage(channel) : 0.f;
    }
  }
  int rackWebExpanderOutputChannels(int index, int port) const override { return index >= 0 && index < rackWebExpanderCount && port >= 0 && port < 16 ? rackWebExpanderModules[index].outputs[port].getChannels() : 0; }
`;
}
function portableSurgeHostContract(body,inherited){return /\bsetupSurgeCommon\s*\([^,]+,\s*false\s*,\s*false\s*\)/.test(body)&&inherited.some(definition=>definition.name==="XTModule"&&/\bSurgeStorage\b/.test(definition.body))}
function portableSurgeHostForTarget(target,body,inherited){if(target.model==="SurgeXTLFO")return false;return portableSurgeHostContract(body,inherited)||target.model==="SurgeXTUnisonHelperCVExpander"}
function fullSurgeHostContract(target,body,inherited){return !portableSurgeHostForTarget(target,body,inherited)&&inherited.some(definition=>definition.name==="XTModule"&&/\bSurgeStorage\b/.test(definition.body))}
function adaptSurgeFxModuleBody(source){return stripConditionalBlocks(removeClassDefinition(source,"PresetChangeAction"),condition=>/\brecordHistory\b/.test(condition))}
function fullSurgeHostPrelude(){return `#ifndef INFO
#define INFO(...) ((void)0)
#endif
#ifndef WARN
#define WARN(...) ((void)0)
#endif

#include <list>
#include "TemposyncSupport.h"
#include "FxPresetAndClipboardManager.h"
#include "sst/rackhelpers/neighbor_connectable.h"
#include "version.h"

rack::Plugin* pluginInstance = nullptr;
const char* Surge::Build::GitHash = "rack-web";

// Rack's native style implementation is UI-only. The DSP/state layer uses
// these stable serialized enum values, so retain that public contract without
// importing NanoVG, fonts, SVGs, or desktop widgets into WebAssembly.
namespace sst::surgext_rack::style {
struct XTStyle {
  enum Style { DARK = 10001, MID, LIGHT };
  enum LightColor { ORANGE = 900001, YELLOW, GREEN, AQUA, BLUE, PURPLE, PINK, RED, WHITE };
};
}

// VCOConfig exposes panel-layout metadata in its public template even though
// the audio module never consumes it. Keep the type contract lightweight in
// the DSP build instead of importing Rack widgets and NanoVG.
namespace sst::surgext_rack::layout { struct LayoutItem { static LayoutItem createPresetLCDArea() { return {}; } }; }
namespace sst::surgext_rack::vco { template <int oscType> struct VCO; }
namespace sst::surgext_rack::fx {
template <int fxType> struct FX;
struct FXLayoutHelper {
  template <typename T> static void processExtend(T* module, int surgeParam, int rackParam) {
    auto& parameter = module->fxstorage->p[surgeParam];
    const bool enabled = module->params[rackParam].getValue() > .5f;
    if (parameter.extend_range != enabled) parameter.set_extend_range(enabled);
  }
  template <typename T> static void processDeactivate(T* module, int surgeParam, int rackParam) {
    auto& parameter = module->fxstorage->p[surgeParam];
    const bool enabled = module->params[rackParam].getValue() > .5f;
    if ((!parameter.deactivated) != enabled) parameter.deactivated = !enabled;
  }
};
}
`;}
function portableSurgeHostPrelude(prelude,body){
  const supportSource=[prelude,body].join("\n");
  const quantity=classDefinitionSource(prelude,"WaveshaperTypeParamQuanity"),modulation=classDefinitionSource(prelude,"ModulationAssistant"),monophonicModulation=classDefinitionSource(prelude,"MonophonicModulationAssistant"),clockProcessor=classDefinitionSource(prelude,"ClockProcessor"),calculatedName=classDefinitionSource(prelude,"CalculatedName"),modulateQuantity=classDefinitionSource(prelude,"ModulateFromToParamQuantity"),typeSwappingQuantity=classDefinitionSource(prelude,"TypeSwappingParameterQuantity"),ctEnvTimeQuantity=classDefinitionSource(prelude,"CTEnvTimeParamQuantity");
  const usesDelay=/\bSSESincDelayLine\b/.test(body);
  const usesTempo=/\btemposync_support::|\bfmt::format\b/.test(supportSource);
  const usesSimpleLfo=/\bbasic_blocks::modulators::SimpleLFO\b/.test(supportSource);
  const usesCorrelatedNoise=/\bbasic_blocks::dsp::correlated_noise_/i.test(supportSource);
  const usesEnvelopes=/\b(?:ADSR|DAHD|ADAR)Envelope\b/.test(supportSource);
  const usesPanLaws=/\bbasic_blocks::dsp::pan_laws\b/.test(supportSource);
  const usesUnisonHelpers=/\b(?:UnisonSetup|DriftLFO|CharacterFilter)\b/.test(supportSource);
  const usesIostream=/\bstd::(?:cout|cerr|clog)\b/.test(supportSource);
  const filterSupport=/\b(?:FilterCoefficientMaker|QuadFilterUnitState|GetQFPtrFilterUnit|num_filter_types)\b/.test(body)?`#ifndef FMT_HEADER_ONLY
#define FMT_HEADER_ONLY 1
#endif
#include <fmt/format.h>
#include <sst/filters.h>
`:"";
  const digitalRingSupport=/\b(?:CombinatorMode|cxor\d|HalfRateFilter|BLOCK_SIZE_OS)\b/.test(body)?`#include <sst/filters/HalfRateFilter.h>
#include <sst/basic-blocks/mechanics/block-ops.h>
#include "CXOR.h"

// This small public DSP enum normally lives beside SurgeStorage. Keeping it
// here lets DSP-only modules use the official CXOR algorithms without pulling
// the desktop patch database, skin, filesystem, and XML host into the browser.
enum CombinatorMode {
  cxm_ring = 0,
  cxm_cxor43_0,
  cxm_cxor43_1,
  cxm_cxor43_2,
  cxm_cxor43_3_legacy,
  cxm_cxor43_4_legacy,
  cxm_cxor43_3,
  cxm_cxor43_4,
  cxm_cxor93_0,
  cxm_cxor93_1,
  cxm_cxor93_2,
  cxm_cxor93_3,
  cxm_cxor93_4,
  n_cxm_modes,
};
inline constexpr const char* combinator_mode_names[n_cxm_modes] = {
  "Ring Modulation", "Continuous XOR", "Mode 1", "Mode 2", "Mode 3", "Mode 4",
  "Mode 5", "Mode 6", "Mode 1", "Mode 2", "Mode 3", "Mode 4", "Mode 5",
};
inline constexpr int BLOCK_SIZE_OS = SURGE_COMPILE_BLOCK_SIZE << 1;
`:"";
  const formattingSupport=usesTempo?`#ifndef FMT_HEADER_ONLY
#define FMT_HEADER_ONLY 1
#endif
#include <fmt/format.h>

namespace sst::surgext_rack::temposync_support {
inline float roundTemposync(float value) {
  float whole = 0.f;
  float fraction = std::modf(value, &whole);
  if (fraction < 0.f) { fraction += 1.f; whole -= 1.f; }
  const float ratio = std::pow(2.f, fraction);
  if (ratio > 1.41f) fraction = std::log2(1.5f);
  else if (ratio > 1.167f) fraction = std::log2(4.f / 3.f);
  else fraction = 0.f;
  return whole + fraction;
}
inline std::string temposyncLabel(float value, bool minus = false) {
  return fmt::format("{:.3f} beats", std::pow(2.f, (minus ? -1.f : 1.f) * roundTemposync(value)));
}
}
`:"";
  const delaySupport=usesDelay?`#include "dsp/utilities/SSESincDelayLine.h"

// These two public tuning constants normally arrive through Surge's desktop
// globals header. DSP-only delay modules only need the equal-tempered MIDI 0
// reference and the sinc interpolator's minimum readable delay.
namespace Tunings { inline constexpr float MIDI_0_FREQ = 8.175798915643707f; }
inline constexpr int FIRipol_N = sst::basic_blocks::tables::SurgeSincTableProvider::FIRipol_N;
`:"";
  const simpleLfoSupport=usesSimpleLfo?`#include <sst/basic-blocks/modulators/SimpleLFO.h>
`:"";
  const correlatedNoiseSupport=usesCorrelatedNoise?`#include <sst/basic-blocks/dsp/CorrelatedNoise.h>
`:"";
  const envelopeSupport=usesEnvelopes?`#include <sst/basic-blocks/modulators/ADSREnvelope.h>
#include <sst/basic-blocks/modulators/DAHDEnvelope.h>
#include <sst/basic-blocks/modulators/ADAREnvelope.h>
`:"";
  const panLawSupport=usesPanLaws?`#include <sst/basic-blocks/dsp/PanLaws.h>
`:"";
  const unisonSupport=usesUnisonHelpers?`#include <sst/basic-blocks/dsp/Lag.h>
#include "OscillatorCommonFunctions.h"
`:"";
  const iostreamSupport=usesIostream?`#include <iostream>
`:"";
  const delayStorage=usesDelay?`  sst::basic_blocks::tables::SurgeSincTableProvider sincProvider;
  const float* sinctable = sincProvider.sinctable;
`:"";
  return `#ifndef SURGE_COMPILE_BLOCK_SIZE
#define SURGE_COMPILE_BLOCK_SIZE 8
#endif
#define MAX_POLY 16
#define SURGE_TO_RACK_OSC_MUL 5
#define RACK_TO_SURGE_OSC_MUL 0.2f
#define RACK_TO_SURGE_CV_MUL 0.1f

#include <sst/waveshapers.h>
#include <sst/filters/TuningProvider.h>
${filterSupport}
#include "sst/rackhelpers/neighbor_connectable.h"
#include "sst/rackhelpers/json.h"
${digitalRingSupport}
${formattingSupport}
${delaySupport}
${simpleLfoSupport}
${correlatedNoiseSupport}
${envelopeSupport}
${panLawSupport}
${iostreamSupport}

inline constexpr int BLOCK_SIZE = SURGE_COMPILE_BLOCK_SIZE;
inline constexpr float BLOCK_SIZE_INV = 1.f / SURGE_COMPILE_BLOCK_SIZE;

struct SurgeWebStorage : sst::filters::detail::BasicTuningProvider {
${delayStorage}  
  float samplerate = 48000.f;
  float samplerate_inv = 1.f / 48000.f;
  double dsamplerate_inv = 1.0 / 48000.0;
  float temposyncratio = 1.f;
  float temposyncratio_inv = 1.f;
  uint32_t randomState = 0x9e3779b9u;
  void setSamplerate(float value) { samplerate = value; samplerate_inv = 1.f / value; dsamplerate_inv = 1.0 / value; }
  float db_to_linear(float value) const { return std::pow(10.f, value / 20.f); }
  float note_to_pitch_ignoring_tuning(float semitones) const { return std::pow(2.f, semitones / 12.f); }
  float envelope_rate_linear_nowrap(float value) const { return BLOCK_SIZE * samplerate_inv * std::pow(2.f, -value); }
  uint32_t rand_u32() { randomState ^= randomState << 13; randomState ^= randomState >> 17; randomState ^= randomState << 5; return randomState; }
  float rand_pm1() { return static_cast<float>(rand_u32()) * (2.f / 4294967295.f) - 1.f; }
};
using SurgeStorage = SurgeWebStorage;
class Parameter;
${unisonSupport}

class BiquadFilter {
  SurgeWebStorage* storage = nullptr;
  float alpha = 1.f, leftState = 0.f, rightState = 0.f;
  bool highpass = false;
 public:
  explicit BiquadFilter(SurgeWebStorage* value) : storage(value) {}
  void suspend() { leftState = rightState = 0.f; }
  float calc_omega(float octaves) const {
    const float frequency = 440.f * std::pow(2.f, octaves);
    return std::clamp(6.28318530718f * frequency / std::max(1.f, storage ? storage->samplerate : 48000.f), 0.000001f, 3.14159f);
  }
  void coeff_HP(float omega, float) { highpass = true; alpha = std::clamp(omega / (1.f + omega), 0.f, 1.f); }
  void coeff_LP2B(float omega, float) { highpass = false; alpha = std::clamp(omega / (1.f + omega), 0.f, 1.f); }
  void coeff_instantize() {}
  void process_sample(float left, float right, float& outLeft, float& outRight) {
    leftState += alpha * (left - leftState); rightState += alpha * (right - rightState);
    outLeft = highpass ? left - leftState : leftState; outRight = highpass ? right - rightState : rightState;
  }
};

namespace sst::surgext_rack::modules {
${calculatedName}
${modulateQuantity}
${typeSwappingQuantity}
${ctEnvTimeQuantity}
template <int centerOffset> struct MidiNoteParamQuantity : rack::engine::ParamQuantity {};
template <int centerOffset> struct VOctParamQuantity : rack::engine::ParamQuantity {};
struct DecibelParamQuantity : rack::engine::ParamQuantity {
  static float ampToLinear(float value) { value = std::max(0.f, value); return value * value * value; }
  static __m128 ampToLinearSSE(__m128 value) { auto x = _mm_max_ss(value, _mm_setzero_ps()); return _mm_mul_ps(x, _mm_mul_ps(x, x)); }
  static rack::simd::float_4 ampToLinearSSE(rack::simd::float_4 value) { for (int lane = 0; lane < 4; lane++) { const float x = std::max(0.f, value[lane]); value[lane] = x * x * x; } return value; }
  static rack::simd::float_4 ampToRackLinear(__m128 value) { alignas(16) float lanes[4]; _mm_store_ps(lanes, value); rack::simd::float_4 result; for (int lane = 0; lane < 4; lane++) { const float x = std::max(0.f, lanes[lane]); result[lane] = x * x * x; } return result; }
};
template <typename M> struct DecibelModulatorParamQuantity : rack::ParamQuantity {
  M* xtm() { return static_cast<M*>(module); }
  rack::ParamQuantity* under() { auto* owner = xtm(); if (!owner) return nullptr; const int id = owner->paramModulatedBy(paramId); return id >= 0 ? owner->paramQuantities[id] : nullptr; }
  std::string getLabel() override { auto* target = under(); return target ? rack::ParamQuantity::getLabel() + " to " + target->getLabel() : rack::ParamQuantity::getLabel(); }
};
${monophonicModulation}
${modulation}
${clockProcessor}
struct DCBlockerSIMD4 {
  __m128 fac = _mm_set1_ps(0.9995f), xN1 = _mm_setzero_ps(), yN1 = _mm_setzero_ps();
  void reset() { xN1 = yN1 = _mm_setzero_ps(); }
  __m128 filter(__m128 value) { auto delta = _mm_sub_ps(value, xN1); auto filtered = _mm_add_ps(delta, _mm_mul_ps(fac, yN1)); xN1 = value; yN1 = filtered; return filtered; }
};
struct XTModule : rack::Module {
  inline static std::mutex xtSurgeCreateMutex;
  std::unique_ptr<SurgeWebStorage> storage;
  XTModule() = default;
  virtual std::string getName() = 0;
  virtual void moduleSpecificSampleRateChange() {}
  virtual bool isBipolar(int) { return false; }
  virtual float modulationDisplayValue(int) { return 0.f; }
  virtual Parameter* surgeDisplayParameterForParamId(int) { return nullptr; }
  virtual json_t* makeModuleSpecificJson() { return nullptr; }
  virtual void readModuleSpecificJson(json_t*) {}
  void setupSurgeCommon(int, bool, bool) { storage = std::make_unique<SurgeWebStorage>(); onSampleRateChange(); }
  void onSampleRateChange() override { if (storage) { storage->setSamplerate(APP->engine->getSampleRate()); moduleSpecificSampleRateChange(); } }
  void snapCalculatedNames() {}
  template <typename T = rack::ParamQuantity, typename... Args> T* configParamNoRand(Args... args) { auto* result = configParam<T>(args...); result->randomizeEnabled = false; return result; }
  template <typename T = rack::SwitchQuantity> T* configOnOff(int id, float value, const std::string& name) { return configSwitch<T>(id, 0.f, 1.f, value, name, {"Off", "On"}); }
  json_t* dataToJson() override { auto* root = json_object(); if (auto* specific = makeModuleSpecificJson()) json_object_set_new(root, "modulespecific", specific); return root; }
  void dataFromJson(json_t* root) override { if (auto* specific = json_object_get(root, "modulespecific")) readModuleSpecificJson(specific); }
};
}

namespace sst::filters { struct QuadFilterUnitState; }
namespace sst::plugininfra::cpufeatures { struct FPUStateGuard {}; }

${quantity}`;
}
function concreteTemplateOwner(candidate,owner,argument){return candidate.kind==="function"&&candidate.callableKind==="function"&&candidate.owner===owner&&String(candidate.signature).replace(/\s+/g,"").includes(`${owner}<${String(argument).replace(/\s+/g,"")}>::`)}
function surgeVcoSpecializations(sourceFiles,moduleClass){const type=/\bVCO\s*<\s*([^>]+)>/.exec(moduleClass)?.[1]?.trim();if(!type)return"";const found=[],methods=new Set;for(const file of sourceFiles){const source=fs.readFileSync(file,"utf8");for(const candidate of rustSourceDeclarations(source).outOfLineDefinitions){if(!concreteTemplateOwner(candidate,"VCOConfig",type)||!/^template\s*<\s*>/.test(candidate.rawDefinition)||["getLayout","addMenuItems"].includes(candidate.member))continue;methods.add(candidate.member);found.push(candidate.rawDefinition)}}if(!methods.has("configureVCOSpecificParameters"))for(const file of sourceFiles){const source=fs.readFileSync(file,"utf8"),candidate=rustSourceDeclarations(source).outOfLineDefinitions.find(definition=>definition.kind==="function"&&definition.callableKind==="function"&&definition.owner==="VCOConfig"&&definition.member==="configureVCOSpecificParameters"&&/^template\s*<\s*int\s+oscType\s*>\s*inline\s+void\s+VCOConfig\s*<\s*oscType\s*>\s*::/.test(definition.rawDefinition));if(candidate){found.push(candidate.rawDefinition);break}}return[...new Set(found)].join("\n\n")}
function qualifyRegisteredTemplateType(type,scope,sourceFiles){const open=type.indexOf("<"),close=type.lastIndexOf(">");if(open<0||close<open||!scope.length)return type;const sources=sourceFiles.map(file=>fs.readFileSync(file,"utf8")),argumentsList=splitArguments(type.slice(open+1,close)).map(argument=>{const name=argument.trim();if(name.startsWith("::"))return name.slice(2);if(!/^[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*$/.test(name)||/^(?:rack|std)::/.test(name))return name;const parts=name.split("::"),terminal=parts.at(-1),qualifiers=parts.slice(0,-1),candidates=[];for(const source of sources){const definition=classDefinitionSource(source,terminal)||enumDeclarationSource(source,terminal);if(!definition)continue;const namespaces=enclosingNamespaces(source,terminal);if(qualifiers.length&&!qualifiers.every((part,index)=>namespaces[namespaces.length-qualifiers.length+index]===part))continue;candidates.push(namespaces)}const exact=candidates.find(namespaces=>namespaces.length===scope.length&&namespaces.every((part,index)=>part===scope[index])),selected=exact??(candidates.length===1?candidates[0]:null);return selected?.length?`${selected.join("::")}::${terminal}`:name});return`${type.slice(0,open)}<${argumentsList.join(", ")}>${type.slice(close+1)}`}
function adaptBisetTrackerBrowserImplementation(source){
  for(const name of ["load_save_file","compute_save_file","read_u8","read_u16","read_name"])for(const definition of outOfLineFreeFunctionDefinitions(source,name))source=source.replace(definition,"");
  source=replaceOutOfLineMethod(source,"Tracker","onAdd","void Tracker::onAdd(const AddEvent &e) { Module::onAdd(e); }");
  const hostStart=source.indexOf("module_ids = APP->engine->getModuleIds();"),hostEnd=source.indexOf("/// [3] SWAP SYNTH",hostStart);
  if(hostStart>=0&&hostEnd>hostStart)source=source.slice(0,hostStart)+source.slice(hostEnd);
  return source
    .replace(/^[ \t]*(?:TrackerSynth\s*\*\s*module_synth|TrackerDrum\s*\*\s*module_drum)\s*;\s*$/gm,"")
    .replace(/\bmods\s*=\s*APP\s*->\s*window\s*->\s*getMods\s*\(\s*\)\s*;/g,"mods = 0;")
    .replace(/\s*if\s*\(\s*APP\s*==\s*NULL\s*\|\|\s*APP\s*->\s*window\s*==\s*NULL\s*\)\s*return\s*;/g,"");
}
function adaptBisetTrackerAuxiliaryBrowserImplementation(source){
  return replaceOutOfLineMethod(adaptBisetTrackerBrowserImplementation(source),"Timeline","process","void Timeline::process(i64, float, float) {}");
}
function adaptBisetBlankBrowserImplementation(source){
  source=replaceOutOfLineMethod(source,"Blank","~Blank","Blank::~Blank() { if (this == g_blank) g_blank = nullptr; }");
  source=replaceOutOfLineMethod(source,"Blank","processBypass","void Blank::processBypass(const ProcessArgs&) {}");
  return replaceOutOfLineMethod(source,"Blank","process","void Blank::process(const ProcessArgs&) { if (g_blank == nullptr) g_blank = this; }");
}
function dedupeQualifiedClassDefinitions(source,names){
  for(const name of names){
    const code=sourceWithoutComments(source),escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),seen=new Set,ranges=[];
    for(const match of code.matchAll(new RegExp(`\\b(?:struct|class)\\s+${escaped}(?:\\s+final)?(?:\\s*:[^{]+)?\\s*\\{`,"g"))){
      if(/\benum\s*$/.test(code.slice(Math.max(0,match.index-80),match.index)))continue;
      const namespaces=namespaceStackAt(code,match.index);
      if(!isNamespaceScopeAt(code,match.index))continue;
      const open=code.indexOf("{",match.index),close=matchingBrace(code,open);
      if(close<0)continue;
      const key=`${namespaces.join("::")}::${name}`;
      if(seen.has(key)){let end=close+1;while(/[ \t]/.test(code[end]??""))end++;if(code[end]===";")end++;ranges.push([match.index,end])}
      else seen.add(key)
    }
    for(const [start,end] of ranges.reverse())source=source.slice(0,start)+source.slice(end)
  }
  return source
}
function moveNamespacedClassBeforeFirstUse(source,name,namespaceName){
  const definition=classDefinitionSource(source,name);
  if(!definition)return source;
  const definitionStart=source.indexOf(definition),definitionEnd=definitionStart+definition.length;
  let removalEnd=definitionEnd;
  while(/[ \t]/.test(source[removalEnd]??""))removalEnd++;
  if(source[removalEnd]===";")removalEnd++;
  let without=source.slice(0,definitionStart)+source.slice(removalEnd),use;
  const usePattern=new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`,"g");
  while((use=usePattern.exec(without))&&(!isCodePosition(without,use.index)||/\b(?:class|struct)\s*$/.test(without.slice(Math.max(0,use.index-20),use.index))));
  if(!use||use.index>=definitionStart)return source;
  let insertAt=use.index;
  for(const match of without.matchAll(/\bnamespace\s+[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*\s*\{/g)){
    if(match.index>=use.index)break;
    const open=without.indexOf("{",match.index),close=matchingBrace(without,open);
    if(close>=use.index)insertAt=Math.min(insertAt,match.index);
  }
  const wrapped=`namespace ${namespaceName} {\n${definition}${/;\s*$/.test(definition)?"":";"}\n}\n\n`;
  return without.slice(0,insertAt)+wrapped+without.slice(insertAt);
}
function moveClassDefinitionBeforeToken(source,name,token){
  const definition=classDefinitionSource(source,name);
  if(!definition)return source;
  const definitionStart=source.indexOf(definition),tokenIndex=source.indexOf(token);
  if(definitionStart<0||tokenIndex<0||definitionStart<tokenIndex)return source;
  let definitionEnd=definitionStart+definition.length;
  while(/[ \t]/.test(source[definitionEnd]??""))definitionEnd++;
  if(source[definitionEnd]===";")definitionEnd++;
  const without=source.slice(0,definitionStart)+source.slice(definitionEnd),nextTokenIndex=without.indexOf(token),insertAt=without.lastIndexOf("\n",nextTokenIndex)+1;
  return without.slice(0,insertAt)+`${definition}${/;\s*$/.test(definition)?"":";"}\n\n`+without.slice(insertAt);
}
function moveNamespacedGlobalBeforeType(source,globalName,typeName){
  const escapedGlobal=globalName.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),match=new RegExp(`^[ \\t]*(?!(?:extern|using|typedef)\\b)[^\\n;{}]*\\b${escapedGlobal}\\b\\s*(?:=|\\{)`,"m").exec(source);
  if(!match)return source;
  const open=source.indexOf("{",match.index),close=open>=0?matchingBrace(source,open):-1,end=close>=0?source.indexOf(";",close)+1:-1;
  if(end<=close)return source;
  const definition=source.slice(match.index,end).trim(),without=source.slice(0,match.index)+source.slice(end),typeMatch=new RegExp(`\\b(?:struct|class)\\s+${typeName.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b[^;{]*\\{`).exec(without);
  return typeMatch?without.slice(0,typeMatch.index)+`${definition}\n\n`+without.slice(typeMatch.index):source;
}
function restoreReferencedSourceAliases(source,sourceDir){
  const directory=sourceDir&&path.join(sourceDir,"src");
  if(!directory||!fs.existsSync(directory))return source;
  const aliases=[];
  for(const file of files(directory).filter(file=>/\.(?:cpp|cc|cxx|h|hh|hpp)$/.test(file))){
    const original=fs.readFileSync(file,"utf8");
    for(const match of original.matchAll(/\busing\s+([A-Za-z_]\w*)\s*=\s*[^;]+;/g))aliases.push({name:match[1],source:match[0].replace(/(?<![:\w])Sapphire::/g,"::Sapphire::")});
  }
  for(const alias of aliases){
    const escaped=alias.name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    if(new RegExp(`\\busing\\s+${escaped}\\s*=`).test(source)||!new RegExp(`\\b${escaped}\\s*(?:::|\\()`).test(source))continue;
    const use=source.search(new RegExp(`\\b${escaped}\\s*(?:::|\\()`));
    let insertAt=-1;
    for(const match of source.matchAll(/\b(?:struct|class)\s+[A-Za-z_]\w*(?:\s+final)?(?:\s*:[^{]+)?\s*\{/g)){
      if(match.index>=use)break;
      const open=source.indexOf("{",match.index),close=matchingBrace(source,open);
      if(close>=use)insertAt=match.index;
    }
    if(insertAt>=0)source=source.slice(0,insertAt)+`${alias.source}\n`+source.slice(insertAt);
  }
  return source;
}
function adaptSapphireGeneratedAdapter(source,sourceDir=""){
  const sourceDirArgument=process.argv.indexOf("--source-dir");
  if(!sourceDir&&sourceDirArgument>=0)sourceDir=path.resolve(process.argv[sourceDirArgument+1]);
  const uiOwners=new Set(["ToggleAllSensitivityAction","SliderAction","BoolToggleAction",...[...source.matchAll(/\b([A-Za-z_]\w*(?:Action|Widget|Display|Diagram|Knob|Button|MenuItem))::[A-Za-z_~]\w*\s*\(/g)].map(match=>match[1])]);
  for(const name of uiOwners)source=removeOutOfLineDefinitions(source,name);
  source=replaceOutOfLineMethod(source,"SapphireModule","setPolyphonicEnvelopeOutput","void SapphireModule::setPolyphonicEnvelopeOutput(bool state) { if (envelopeFollower.enabled) envelopeFollower.polyphonicOutput = state; }");
  source=replaceOutOfLineMethod(source,"SapphireModule","toggleEnvDuck","void SapphireModule::toggleEnvDuck() { if (envelopeFollower.enabled) envelopeFollower.duck = !envelopeFollower.duck; }");
  for(let definition=enumDeclarationSource(source,"ExpanderRole");definition;definition=enumDeclarationSource(source,"ExpanderRole"))source=source.replace(definition,"");
  for(let definition=classDefinitionSource(source,"ModelInfo");definition;definition=classDefinitionSource(source,"ModelInfo"))source=source.replace(definition,"");
  for(let previous="";previous!==source;){previous=source;source=removeQualifiedFreeFunction(source,"Both")}
  source=source
    .replace(/^\s*(?:const|inline\s+const)\s+ExpanderRole\s+(?:VectorSenderAndReceiver|ChaosModuleRoles)\s*=\s*Both\s*\([^;]+;[ \t]*$/gm,"")
    .replace(/^\s*ModelInfo\s*\*\s*ModelInfo::front\s*;[ \t]*$/gm,"")
    .replace(/\bstatic\s+std::vector\s*<\s*SapphireModule\s*\*>\s+All\s*;/,"inline static std::vector<SapphireModule*> All{};")
    .replace(/^\s*enum\s*;?\s*$/gm,"");
  source=preferNearestTargetEnums(source);
  source=dedupeQualifiedClassDefinitions(source,["VectorSender","VectorReceiver","ControlGroup"]);
  source=dedupeTypeDefinitions(source,new Set);
  source=moveNamespacedClassBeforeFirstUse(source,"ToggleGroup","Sapphire");
  source=moveClassDefinitionBeforeToken(source,"ChaoticOscillatorState","ChaosInitialStateTable");
  source=moveNamespacedGlobalBeforeType(source,"tubeUnitControls","TubeUnitModule");
  source=restoreReferencedSourceAliases(source,sourceDir);
  if(/\bvoid\s+randomizeChaos\s*\(\s*\)\s*\{/.test(source))source=replaceInlineMethodBody(source,/\bvoid\s+randomizeChaos\s*\(\s*\)\s*\{/,`
    EmpathModule* empathModule = this;
    do {
      empathModule->beginSeedChangeAntiClick(rack::random::u64());
      empathModule = dynamic_cast<EmpathModule*>(empathModule->rightExpander.module);
    }
    while (IsFilterReceiver(empathModule));
  `);
  const calcParserFile=sourceDir&&path.join(sourceDir,"src","sapphire_calcparser.cpp");
  if(/\bCalcParser\s+parser\s*\(/.test(source)&&!/\bclass\s+CalcParser\b/.test(source)&&calcParserFile&&fs.existsSync(calcParserFile)){
    const calcParser=classDefinitionSource(fs.readFileSync(calcParserFile,"utf8"),"CalcParser");
    const use=source.search(/\bcalc_expr_t\s+CalcParseNumericExpression\s*\(/);
    if(calcParser&&use>=0)source=source.slice(0,use)+`${calcParser}${/;\s*$/.test(calcParser)?"":";"}\n\n`+source.slice(use);
  }
  const nucleusResetFile=sourceDir&&path.join(sourceDir,"src","nucleus_reset.hpp");
  if(/\bNucleus::CrashChecker\b/.test(source)&&!/\bclass\s+CrashChecker\b/.test(source)&&nucleusResetFile&&fs.existsSync(nucleusResetFile)){
    const crashChecker=classDefinitionSource(sourceWithoutComments(fs.readFileSync(nucleusResetFile,"utf8")),"CrashChecker"),engine=classDefinitionSource(source,"NucleusEngine");
    if(crashChecker&&engine){
      let insertAt=source.indexOf(engine)+engine.length;
      while(/[ \t]/.test(source[insertAt]??""))insertAt++;
      if(source[insertAt]===";")insertAt++;
      source=source.slice(0,insertAt)+`\n\nnamespace Nucleus {\ninline void SetMinimumEnergy(NucleusEngine& engine);\n${crashChecker}${/;\s*$/.test(crashChecker)?"":";"}\n}\n`+source.slice(insertAt);
    }
  }
  source=source
    .replace(/\bInvokeAction\s*\(\s*new\s+BoolToggleAction\s*\(\s*([^,\n]+?)\s*,\s*[^)]*\)\s*\)\s*;/g,(_,value)=>`${value.trim()} = !(${value.trim()});`)
    .replace(/\bInvokeAction\s*\(\s*new\s+BumpEnumAction\s*<[^>]+>\s*\(\s*([^,\n]+?)\s*,\s*[^,)]*(?:,\s*([^)]*))?\)\s*\)\s*;/g,(_,smoother,direction)=>`${smoother.trim()}.beginBumpEnum(${direction?.trim()||"+1"});`);
  source=source.replace(/\busing\s+namespace\s+Sapphire::/g,"using namespace ::Sapphire::").replace(/(?<!namespace )(?<![:\w])Sapphire::/g,"::Sapphire::");
  const compatibility=`namespace Sapphire {
enum class ExpanderRole {
  None = 0,
  VectorSender = 0x01,
  VectorReceiver = 0x02,
  ChaosOpSender = 0x04,
  ChaosOpReceiver = 0x08,
};
inline constexpr ExpanderRole Both(ExpanderRole a, ExpanderRole b) {
  return static_cast<ExpanderRole>(static_cast<int>(a) | static_cast<int>(b));
}
inline constexpr ExpanderRole VectorSenderAndReceiver = Both(ExpanderRole::VectorSender, ExpanderRole::VectorReceiver);
inline constexpr ExpanderRole ChaosModuleRoles = Both(ExpanderRole::VectorSender, ExpanderRole::ChaosOpReceiver);
enum class PortLabelMode { Stereo = -2, Mono = -1, Poly = 0 };
struct ModelInfo {
  static void insert(Model*, ExpanderRole) {}
  static bool hasRole(const Module* module, ExpanderRole) { return module != nullptr; }
};
inline bool IsShiftKeyPressed() { return false; }
inline bool IsControlKeyPressed() { return false; }
namespace Tricorder {
struct Message;
inline bool IsVectorMessage(const Message*);
}
}
`;
  const include=/^#include "rack_web_export\.hpp"\s*$/m;
  return include.test(source)?source.replace(include,match=>`${match}\n${compatibility}`):`${compatibility}\n${source}`
}
function stripNamespaceBlockContaining(source,pattern){
  const candidates=[];
  for(const match of source.matchAll(/\bnamespace(?:\s+[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)?\s*\{/g)){const open=source.indexOf("{",match.index),close=matchingBrace(source,open);if(close>=0&&pattern.test(source.slice(open+1,close)))candidates.push({start:match.index,open,close})}
  const selected=candidates.sort((left,right)=>right.open-left.open)[0];
  return selected?`${source.slice(0,selected.start)}${source.slice(selected.close+1)}`:source;
}
function qualifyPluginGlobalHostHelperCalls(source,prelude){
  for(const name of ["loadDarkAsDefault"]){
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),declaration=[...prelude.matchAll(new RegExp(`^[ \\t]*(?:bool|int)\\s+(${escaped})\\s*\\([^;{}]*\\)\\s*;`,"gm"))].find(match=>isCodePosition(prelude,match.index)&&isNamespaceScopeAt(prelude,match.index)&&namespaceStackAt(prelude,match.index).length===0);
    if(declaration)source=source.replace(new RegExp(`(?<![:\\w])${escaped}\\s*\\(`,"g"),`::${name}(`);
  }
  return source
}
function adaptRackNesBrowserSource(source){
  const moduleStart=source.indexOf("struct CVButtonTrigger");
  const includeStart=source.indexOf('#include "rack_web_export.hpp"');
  if(includeStart<0||moduleStart<0||moduleStart<=includeStart)return source;
  const header=source.slice(0,includeStart);
  const moduleSource=source.slice(moduleStart).replace(/RACK_WEB_EXPORTS\(RackNES\)\s*$/,`struct RackWebRackNESModule : RackNES {
  static constexpr int rackWebRomCapacity = 4 * 1024 * 1024;
  std::vector<float> rackWebRomAsset = std::vector<float>(rackWebRomCapacity, 0.f);
  std::vector<float> rackWebScreen = std::vector<float>(NES::Emulator::SCREEN_BYTES, 0.f);

  int assetCapacity() const override { return rackWebRomCapacity; }
  float* assetBuffer() override { return rackWebRomAsset.data(); }
  void commitAsset(int bytes, int, float) override {
    bytes = std::clamp(bytes, 0, rackWebRomCapacity);
    rackWebRackNesRomSamples = rackWebRomAsset.data();
    rackWebRackNesRomBytes = bytes;
    if (bytes >= 16 && static_cast<unsigned>(rackWebRomAsset[0]) == 0x4e &&
        static_cast<unsigned>(rackWebRomAsset[1]) == 0x45 &&
        static_cast<unsigned>(rackWebRomAsset[2]) == 0x53 &&
        static_cast<unsigned>(rackWebRomAsset[3]) == 0x1a)
      rom_path_signal = "browser://game.nes";
    else {
      emulator.remove_game();
      initalizeScreen();
      rom_load_failed_signal = true;
    }
  }
  int rackWebVisualCount() const override { return NES::Emulator::SCREEN_BYTES; }
  float* rackWebVisualBuffer() override {
    for (int index = 0; index < NES::Emulator::SCREEN_BYTES; index++)
      rackWebScreen[index] = screen[index] / 255.f;
    return rackWebScreen.data();
  }
};

RACK_WEB_EXPORTS(RackWebRackNESModule)`);
  return`${header}#include "rack_web_export.hpp"
#include <fstream>

static const float* rackWebRackNesRomSamples = nullptr;
static int rackWebRackNesRomBytes = 0;

namespace std {
class RackWebMemoryIStream {
  std::streamsize offset = 0;
  bool open = false;
 public:
  RackWebMemoryIStream(const std::string& path, std::ios_base::openmode)
      : open(path == "browser://game.nes" && rackWebRackNesRomSamples && rackWebRackNesRomBytes > 0) {}
  bool is_open() const { return open; }
  RackWebMemoryIStream& read(char* target, std::streamsize count) {
    if (!open || !target || count <= 0) return *this;
    const std::streamsize available = std::max<std::streamsize>(0, rackWebRackNesRomBytes - offset);
    const std::streamsize copied = std::min(count, available);
    for (std::streamsize index = 0; index < copied; index++)
      target[index] = static_cast<unsigned char>(std::clamp(rackWebRackNesRomSamples[offset + index], 0.f, 255.f));
    if (copied < count) std::memset(target + copied, 0, static_cast<std::size_t>(count - copied));
    offset += copied;
    return *this;
  }
};
}

#define ifstream RackWebMemoryIStream
#include "nes/emulator.hpp"
#undef ifstream
#include "base64.h"

static rack::plugin::Model rackWebHostModel0;
static rack::plugin::Model* modelInputGenie = &rackWebHostModel0;

${moduleSource}`;
}
function adaptSpeckBrowserSource(source){
  return source.replace(/RACK_WEB_EXPORTS\(Speck\)\s*$/,`struct RackWebSpeckModule : Speck {
  static constexpr int rackWebSpectrumBins = sizeof(FFT1) / sizeof(float);
  float rackWebSpectrum[rackWebSpectrumBins * 2] = {};
  int rackWebVisualCount() const override { return rackWebSpectrumBins * 2; }
  float* rackWebVisualBuffer() override {
    std::memcpy(rackWebSpectrum, FFT1, sizeof(FFT1));
    std::memcpy(rackWebSpectrum + rackWebSpectrumBins, FFT2, sizeof(FFT2));
    return rackWebSpectrum;
  }
};

RACK_WEB_EXPORTS(RackWebSpeckModule)`);
}
function adaptMadzineNigoqBrowserSource(source){
  return source.replace(/RACK_WEB_EXPORTS\(NIGOQ\)\s*$/,`struct RackWebNigoqModule : NIGOQ {
  std::array<float, SCOPE_BUFFER_SIZE * 2> rackWebScope {};
  int rackWebVisualCount() const override { return static_cast<int>(rackWebScope.size()); }
  float* rackWebVisualBuffer() override {
    for (int index = 0; index < SCOPE_BUFFER_SIZE; ++index) {
      const float finalValue = finalBuffer[index].max;
      const float modValue = modBuffer[index].max;
      rackWebScope[index] = std::isfinite(finalValue) ? finalValue : 0.f;
      rackWebScope[SCOPE_BUFFER_SIZE + index] = std::isfinite(modValue) ? modValue : 0.f;
    }
    return rackWebScope.data();
  }
};

RACK_WEB_EXPORTS(RackWebNigoqModule)`);
}
function adaptMadzineWeiiiDocumentaBrowserSource(source){
  return source.replace(/RACK_WEB_EXPORTS\(WeiiiDocumenta\)\s*$/,`struct RackWebWeiiiDocumentaModule : WeiiiDocumenta {
  static constexpr int rackWebWavePoints = 170;
  static constexpr int rackWebMaxSlices = 64;
  static constexpr int rackWebMaxVoices = 8;
  std::array<float, 8 + rackWebWavePoints * 2 + rackWebMaxSlices + rackWebMaxVoices> rackWebWaveform {};

  int rackWebVisualCount() const override { return static_cast<int>(rackWebWaveform.size()); }
  float* rackWebVisualBuffer() override {
    const int recorded = clamp(layer.recordedLength, 0, static_cast<int>(layer.bufferL.size()));
    rackWebWaveform.fill(-1.f);
    rackWebWaveform[0] = static_cast<float>(recorded);
    rackWebWaveform[1] = static_cast<float>(layer.bufferL.size());
    rackWebWaveform[2] = (isRecording ? 1.f : 0.f) + (isPlaying ? 2.f : 0.f) + (isLooping ? 4.f : 0.f);
    rackWebWaveform[3] = clamp(params[LOOP_END_PARAM].getValue(), 0.f, 1.f);
    rackWebWaveform[4] = layer.bufferL.empty() ? 0.f : clamp(static_cast<float>(recordPosition) / layer.bufferL.size(), 0.f, 1.f);
    rackWebWaveform[5] = static_cast<float>(std::min(static_cast<int>(slices.size()), rackWebMaxSlices));
    rackWebWaveform[6] = static_cast<float>(clamp(numVoices, 1, rackWebMaxVoices));
    rackWebWaveform[7] = static_cast<float>(currentSliceIndex);
    for (int point = 0; point < rackWebWavePoints; ++point) {
      const int sample = recorded > 0 ? std::min(recorded - 1, point * recorded / rackWebWavePoints) : 0;
      const float left = recorded > 0 ? layer.bufferL[sample] : 0.f;
      const float right = recorded > 0 ? layer.bufferR[sample] : 0.f;
      rackWebWaveform[8 + point] = std::isfinite(left) ? left : 0.f;
      rackWebWaveform[8 + rackWebWavePoints + point] = std::isfinite(right) ? right : 0.f;
    }
    const int sliceOffset = 8 + rackWebWavePoints * 2;
    for (int index = 0; index < std::min(static_cast<int>(slices.size()), rackWebMaxSlices); ++index)
      if (slices[index].active && recorded > 0)
        rackWebWaveform[sliceOffset + index] = clamp(static_cast<float>(slices[index].startSample) / recorded, 0.f, 1.f);
    const int voiceOffset = sliceOffset + rackWebMaxSlices;
    if ((isPlaying || isLooping) && recorded > 0) {
      if (numVoices == 1 || voices.empty())
        rackWebWaveform[voiceOffset] = static_cast<float>((layer.playbackPosition % recorded + recorded) % recorded) / recorded;
      else
        for (int index = 0; index < std::min({numVoices, static_cast<int>(voices.size()), rackWebMaxVoices}); ++index)
          rackWebWaveform[voiceOffset + index] = static_cast<float>((voices[index].playbackPosition % recorded + recorded) % recorded) / recorded;
    }
    return rackWebWaveform.data();
  }
};

RACK_WEB_EXPORTS(RackWebWeiiiDocumentaModule)`);
}
function adaptMadzineUniversalRhythmBrowserSource(source){
  return source.replace(/RACK_WEB_EXPORTS\(UniversalRhythm\)\s*$/,`struct RackWebUniversalRhythmModule : UniversalRhythm {
  static constexpr int rackWebSteps = 32;
  std::array<float, 12 + 8 * rackWebSteps> rackWebPattern {};

  int rackWebVisualCount() const override { return static_cast<int>(rackWebPattern.size()); }
  float* rackWebVisualBuffer() override {
    rackWebPattern.fill(0.f);
    for (int role = 0; role < 4; ++role) {
      const int length = clamp(roleLengths[role], 1, rackWebSteps);
      rackWebPattern[role] = static_cast<float>(length);
      rackWebPattern[4 + role] = static_cast<float>(clamp(currentSteps[role], 0, length - 1));
      float style = params[TIMELINE_STYLE_PARAM + role * 5].getValue();
      if (inputs[TIMELINE_STYLE_CV_INPUT + role * 4].isConnected())
        style += inputs[TIMELINE_STYLE_CV_INPUT + role * 4].getVoltage();
      rackWebPattern[8 + role] = static_cast<float>(clamp(static_cast<int>(style), 0, 9));
    }
    for (int voice = 0; voice < 8; ++voice) {
      const auto& pattern = patterns.patterns[voice];
      const int length = std::min(rackWebSteps, static_cast<int>(pattern.length));
      for (int step = 0; step < length; ++step)
        rackWebPattern[12 + voice * rackWebSteps + step] = pattern.hasOnsetAt(step) ? clamp(pattern.getVelocity(step), 0.f, 1.f) : 0.f;
    }
    return rackWebPattern.data();
  }
};

RACK_WEB_EXPORTS(RackWebUniversalRhythmModule)`);
}
function adaptMadzineUniRhythmBrowserSource(source){
  return source.replace(/RACK_WEB_EXPORTS\(UniRhythm\)\s*$/,`struct RackWebUniRhythmModule : UniRhythm {
  static constexpr int rackWebSteps = 32;
  std::array<float, 12 + 8 * rackWebSteps> rackWebPattern {};

  int rackWebVisualCount() const override { return static_cast<int>(rackWebPattern.size()); }
  float* rackWebVisualBuffer() override {
    rackWebPattern.fill(0.f);
    for (int role = 0; role < 4; ++role) {
      const int length = clamp(roleLengths[role], 1, rackWebSteps);
      rackWebPattern[role] = static_cast<float>(length);
      rackWebPattern[4 + role] = static_cast<float>(clamp(currentSteps[role], 0, length - 1));
      float style = params[TIMELINE_STYLE_PARAM + role * 5].getValue();
      if (inputs[TIMELINE_STYLE_CV_INPUT + role * 4].isConnected())
        style += inputs[TIMELINE_STYLE_CV_INPUT + role * 4].getVoltage();
      rackWebPattern[8 + role] = static_cast<float>(clamp(static_cast<int>(style), 0, 9));
    }
    for (int voice = 0; voice < 8; ++voice) {
      const auto& pattern = patterns.patterns[voice];
      const int length = std::min(rackWebSteps, static_cast<int>(pattern.length));
      for (int step = 0; step < length; ++step)
        rackWebPattern[12 + voice * rackWebSteps + step] = pattern.hasOnsetAt(step) ? clamp(pattern.getVelocity(step), 0.f, 1.f) : 0.f;
    }
    return rackWebPattern.data();
  }
};

RACK_WEB_EXPORTS(RackWebUniRhythmModule)`);
}
function adaptMadzineLaunchpadBrowserSource(source){
  return source.replace(/RACK_WEB_EXPORTS\(Launchpad\)\s*$/,`struct RackWebLaunchpadModule : Launchpad {
  static constexpr int rackWebRows = 8;
  static constexpr int rackWebColumns = 8;
  static constexpr int rackWebCells = rackWebRows * rackWebColumns;
  static constexpr int rackWebWavePoints = 32;
  static constexpr int rackWebCellStride = 4;
  static constexpr int rackWebActionBase = 1000;
  std::array<float, rackWebCells * (rackWebCellStride + rackWebWavePoints)> rackWebGrid {};

  int rackWebVisualCount() const override { return static_cast<int>(rackWebGrid.size()); }
  float* rackWebVisualBuffer() override {
    rackWebGrid.fill(0.f);
    const int waveformOffset = rackWebCells * rackWebCellStride;
    for (int row = 0; row < rackWebRows; ++row) {
      for (int column = 0; column < rackWebColumns; ++column) {
        const int index = row * rackWebColumns + column;
        CellData& cell = cells[row][column];
        const int length = cell.state == CELL_RECORDING ? cell.recordPosition : cell.recordedLength;
        rackWebGrid[index * rackWebCellStride] = static_cast<float>(cell.state);
        rackWebGrid[index * rackWebCellStride + 1] = static_cast<float>(cell.loopClocks);
        rackWebGrid[index * rackWebCellStride + 2] = cell.state == CELL_RECORDING
          ? clamp(static_cast<float>(cell.recordPosition) / MAX_BUFFER_SIZE, 0.f, 1.f)
          : cell.recordedLength > 0 ? clamp(static_cast<float>(cell.playPosition) / cell.recordedLength, 0.f, 1.f) : 0.f;
        rackWebGrid[index * rackWebCellStride + 3] = std::isfinite(cell.playbackSpeed) ? cell.playbackSpeed : 1.f;
        if (length > 0) {
          cell.updateWaveformCache(rackWebWavePoints);
          for (int point = 0; point < rackWebWavePoints; ++point) {
            const float value = point < static_cast<int>(cell.waveformCache.size()) ? cell.waveformCache[point] : 0.f;
            rackWebGrid[waveformOffset + index * rackWebWavePoints + point] = std::isfinite(value) ? value : 0.f;
          }
        }
      }
    }
    return rackWebGrid.data();
  }

  void rackWebTriggerAction(int id, bool active) override {
    if (!active) return;
    if (id >= rackWebActionBase && id < rackWebActionBase + rackWebCells) {
      const int cell = id - rackWebActionBase;
      onCellClick(cell / rackWebColumns, cell % rackWebColumns);
      return;
    }
    if (id >= 1100 && id < 1100 + rackWebCells) {
      const int cell = id - 1100;
      onCellHold(cell / rackWebColumns, cell % rackWebColumns);
      return;
    }
    if (id >= 1200 && id < 1200 + rackWebCells * rackWebCells) {
      const int pair = id - 1200, source = pair / rackWebCells, destination = pair % rackWebCells;
      moveCell(source / rackWebColumns, source % rackWebColumns, destination / rackWebColumns, destination % rackWebColumns);
      return;
    }
    if (id >= 5300 && id < 5300 + rackWebCells * rackWebCells) {
      const int pair = id - 5300, source = pair / rackWebCells, destination = pair % rackWebCells;
      copyCell(source / rackWebColumns, source % rackWebColumns, destination / rackWebColumns, destination % rackWebColumns);
      return;
    }
    if (id >= 10000 && id < 10000 + rackWebCells * 1001) {
      const int encoded = id - 10000, cell = encoded / 1001, value = encoded % 1001;
      cells[cell / rackWebColumns][cell % rackWebColumns].playbackSpeed = knobToSpeed(value / 1000.f);
      cells[cell / rackWebColumns][cell % rackWebColumns].playbackPhase = 0.f;
    }
  }
};

RACK_WEB_EXPORTS(RackWebLaunchpadModule)`);
}
function adaptMadzineTheKickBrowserSource(source){
  return source.replace(/RACK_WEB_EXPORTS\(theKICK\)\s*$/,`struct RackWebTheKickModule : theKICK {
  static constexpr int rackWebAssetSampleCapacity = 48000 * 10 * 2;
  std::array<float, rackWebAssetSampleCapacity> rackWebAssetSamples {};

  int assetCapacity() const override { return rackWebAssetSampleCapacity; }
  float* assetBuffer() override { return rackWebAssetSamples.data(); }
  void commitAsset(int frames, int sourceChannels, float) override {
    const int channels = clamp(sourceChannels, 1, 2);
    const int sourceFrames = clamp(frames, 0, rackWebAssetSampleCapacity / channels);
    if (sourceFrames < 1) { clearSample(); return; }
    float peak = 0.0001f;
    for (int index = 0; index < TABLE_SIZE; ++index) {
      const float position = static_cast<float>(index) / (TABLE_SIZE - 1) * (sourceFrames - 1);
      const int left = static_cast<int>(position), right = std::min(left + 1, sourceFrames - 1);
      const float mix = position - left;
      float leftValue = 0.f, rightValue = 0.f;
      for (int channel = 0; channel < channels; ++channel) {
        leftValue += rackWebAssetSamples[left * channels + channel];
        rightValue += rackWebAssetSamples[right * channels + channel];
      }
      sampleTable[index] = crossfade(leftValue / channels, rightValue / channels, mix);
      peak = std::max(peak, std::fabs(sampleTable[index]));
    }
    for (float& value : sampleTable) value /= peak;
    hasSample = true;
    samplePath = "browser://sample.wav";
    samplePlayPos = 0.f;
  }

  void rackWebTriggerAction(int id, bool active) override {
    if (!active) return;
    if (id == MODE_PARAM && hasSample) {
      modeValue = (modeValue + 1) % 4;
      params[MODE_PARAM].setValue(static_cast<float>(modeValue));
    } else if (id == 1000) {
      clearSample();
    } else if (id >= 1010 && id < 1014 && hasSample) {
      modeValue = id - 1010;
      params[MODE_PARAM].setValue(static_cast<float>(modeValue));
    }
  }
};

RACK_WEB_EXPORTS(RackWebTheKickModule)`);
}
function decodeMadzineManualString(token){
  const decoded=JSON.parse(token);
  return decoded.replace(/\\u([0-9a-fA-F]{4})/g,(_,hex)=>String.fromCodePoint(Number.parseInt(hex,16)));
}
function madzineManualHelpData(sourceDir){
  const file=path.join(sourceDir,"src","ManualHelpData.hpp");
  if(!fs.existsSync(file))return {};
  const source=fs.readFileSync(file,"utf8"),token='"(?:\\\\.|[^"\\\\])*"',result={},
    blockPattern=new RegExp(`\\{\\s*ModuleHelpData\\s+m\\s*;([\\s\\S]*?)data\\[(${token})\\]\\s*=\\s*std::move\\(m\\)\\s*;\\s*\\}`,"g"),
    namePattern=new RegExp(`m\\.name\\s*=\\s*(${token})\\s*;`),
    descriptionPattern=new RegExp(`m\\.description\\s*=\\s*\\{\\s*(${token})\\s*,\\s*(${token})\\s*,\\s*(${token})\\s*\\}\\s*;`),
    entryPattern=new RegExp(`m\\.entries\\.push_back\\(\\s*\\{\\s*(${token})\\s*,\\s*\\{\\s*(${token})\\s*,\\s*(${token})\\s*,\\s*(${token})\\s*\\}\\s*\\}\\s*\\)\\s*;`,"g");
  for(const block of source.matchAll(blockPattern)){
    const body=block[1],name=namePattern.exec(body),description=descriptionPattern.exec(body);
    if(!name||!description)continue;
    const entries=[...body.matchAll(entryPattern)].map(entry=>({
      name:decodeMadzineManualString(entry[1]),
      text:{en:decodeMadzineManualString(entry[2]),zh:decodeMadzineManualString(entry[3]),ja:decodeMadzineManualString(entry[4])},
    }));
    result[decodeMadzineManualString(block[2])]={
      name:decodeMadzineManualString(name[1]),
      description:{en:decodeMadzineManualString(description[1]),zh:decodeMadzineManualString(description[2]),ja:decodeMadzineManualString(description[3])},
      entries,
    };
  }
  return result;
}
function adaptMadzineManualBrowserSource(source){
  if(/\b(?:inline|static)\s+std::map<std::string,\s*ModuleHelpData>\s+initHelpData\s*\(/.test(source))return source;
  return source.replace(/(?=static\s+std::map<std::string,\s*ModuleHelpData>&\s+getHelpData\s*\()/,
    "static std::map<std::string, ModuleHelpData> initHelpData() { return {}; }\n\n");
}
function adaptMlArpeggiatorBrowserSource(source){
  return source.replace(/RACK_WEB_EXPORTS\(Arpeggiator\)\s*$/,`struct RackWebMlArpeggiatorModule : Arpeggiator {
  static constexpr int rackWebChannels = PORT_MAX_CHANNELS;
  std::array<float, 1 + rackWebChannels * 3> rackWebDisplay {};

  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    rackWebDisplay[0] = static_cast<float>(clamp(channels_trigger, 1, rackWebChannels));
    for (int channel = 0; channel < rackWebChannels; ++channel) {
      rackWebDisplay[1 + channel * 3] = static_cast<float>(clamp(order_display[channel], 0, 1));
      rackWebDisplay[2 + channel * 3] = static_cast<float>(clamp(range_display[channel], 0, 3));
      rackWebDisplay[3 + channel * 3] = static_cast<float>(clamp(mode_display[channel], 0, NUM_MODES - 1));
    }
    return rackWebDisplay.data();
  }
};

RACK_WEB_EXPORTS(RackWebMlArpeggiatorModule)`);
}
function adaptMlTrigBufBrowserSource(source){
  return source
    .replace(/\s*defaults\.setModule\("TrigBuf"\)\s*;/,"")
    .replace(/\barmOnLoad\s*=\s*defaults\.getBool\("ArmOnLoad"\)\s*;/,"armOnLoad = false;")
    .replace(/\s*SettingsHandler\s+defaults\s*;/,"");
}
function adaptNoSuchDeviceCorrupterBrowserSource(source){
  return source.replace(/RACK_WEB_EXPORTS\(CorrupterModule\)\s*$/,`struct RackWebCorrupterModule : CorrupterModule {
  std::array<float, 5 + kWaveBins> rackWebDisplay {};

  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    rackWebDisplay[0] = static_cast<float>(wave_write_pos);
    rackWebDisplay[1] = static_cast<float>(clamp(current_algo, 0, 4));
    rackWebDisplay[2] = persistent.bend_enabled ? 1.f : 0.f;
    rackWebDisplay[3] = persistent.break_enabled ? 1.f : 0.f;
    rackWebDisplay[4] = persistent.freeze_enabled ? 1.f : 0.f;
    for (int bin = 0; bin < kWaveBins; ++bin)
      rackWebDisplay[5 + bin] = static_cast<float>(wave_peaks[bin]) / 8.f;
    return rackWebDisplay.data();
  }
};

RACK_WEB_EXPORTS(RackWebCorrupterModule)`);
}
function adaptTapestryBrowserSource(source){
  return source.replace(/RACK_WEB_EXPORTS\(Tapestry\)\s*$/,`struct RackWebTapestryModule : Tapestry {
  static constexpr int rackWebWaveBins = 90;
  static constexpr int rackWebMaxSplices = 300;
  static constexpr int rackWebHeaderValues = 5;
  static constexpr int rackWebSpliceOffset = rackWebHeaderValues;
  static constexpr int rackWebWaveOffset = rackWebSpliceOffset + rackWebMaxSplices;
  static constexpr int rackWebActionSteps = 1024;
  std::array<float, rackWebWaveOffset + rackWebWaveBins> rackWebDisplay {};

  int rackWebVisualCount() const override { return static_cast<int>(rackWebDisplay.size()); }
  float* rackWebVisualBuffer() override {
    const auto& buffer = dsp.getBuffer();
    const size_t usedFrames = buffer.getUsedFrames();
    rackWebDisplay.fill(0.f);
    rackWebDisplay[0] = usedFrames > 0 ? 1.f : 0.f;
    rackWebDisplay[1] = usedFrames > 0
      ? clamp(static_cast<float>(dsp.getGrainEngine().getPlayheadPosition() / usedFrames), 0.f, 1.f)
      : 0.f;
    const auto& spliceManager = dsp.getSpliceManager();
    rackWebDisplay[2] = static_cast<float>(spliceManager.getCurrentIndex());
    rackWebDisplay[3] = static_cast<float>(waveformColor);
    const auto& splices = spliceManager.getAllSplices();
    rackWebDisplay[4] = static_cast<float>(std::min<size_t>(splices.size(), rackWebMaxSplices));
    std::fill(rackWebDisplay.begin() + rackWebSpliceOffset,
      rackWebDisplay.begin() + rackWebWaveOffset, -1.f);
    if (usedFrames < 1) return rackWebDisplay.data();
    for (size_t index = 0; index < splices.size() && index < rackWebMaxSplices; ++index)
      rackWebDisplay[rackWebSpliceOffset + index] =
        clamp(static_cast<float>(splices[index].startFrame) / usedFrames, 0.f, 1.f);
    const float* samples = buffer.data();
    for (int bin = 0; bin < rackWebWaveBins; ++bin) {
      const size_t start = static_cast<size_t>(bin) * usedFrames / rackWebWaveBins;
      const size_t end = std::min(usedFrames,
        static_cast<size_t>(bin + 1) * usedFrames / rackWebWaveBins);
      float peak = 0.f;
      for (size_t frame = start; frame < end; ++frame)
        peak = std::max(peak,
          (std::fabs(samples[frame * 2]) + std::fabs(samples[frame * 2 + 1])) * .5f);
      rackWebDisplay[rackWebWaveOffset + bin] = peak;
    }
    return rackWebDisplay.data();
  }

  void rackWebTriggerAction(int id, bool active) override {
    if (!active) return;
    const bool remove = id >= 3000 && id < 3000 + rackWebActionSteps;
    const int encoded = remove ? id - 3000 : id - 1000;
    if (encoded < 0 || encoded >= rackWebActionSteps) return;
    const auto& buffer = dsp.getBuffer();
    const size_t usedFrames = buffer.getUsedFrames();
    if (usedFrames < 1) return;
    const float normalized = static_cast<float>(encoded) / (rackWebActionSteps - 1);
    auto& spliceManager = dsp.getSpliceManager();
    const auto& splices = spliceManager.getAllSplices();
    int hit = -1;
    for (size_t index = 0; index < splices.size(); ++index) {
      const float marker = static_cast<float>(splices[index].startFrame) / usedFrames;
      if (std::fabs(marker - normalized) <= 6.f / 315.f) { hit = static_cast<int>(index); break; }
    }
    if (remove) {
      if (hit > 0) {
        spliceManager.deleteMarkerAtIndex(hit);
        updateOrganizeParamRange();
      }
      return;
    }
    if (hit >= 0) spliceManager.setCurrentIndex(hit);
    else {
      dsp.onSpliceTrigger(static_cast<size_t>(normalized * usedFrames));
      updateOrganizeParamRange();
    }
  }
};

RACK_WEB_EXPORTS(RackWebTapestryModule)`);
}
function adaptIntegralFluxBrowserSource(source){
  return source.replace(/RACK_WEB_EXPORTS\(IntegralFluxImpl\)\s*$/,`struct RackWebIntegralFluxModule : IntegralFluxImpl {
  std::array<float, 18> rackWebPreview {};
  std::array<bool, 2> rackWebDotVisible {};

  int rackWebVisualCount() const override { return static_cast<int>(rackWebPreview.size()); }
  float* rackWebVisualBuffer() override {
    for (int index = 0; index < 2; ++index) {
      const int channel = index == 0 ? 1 : 4;
      float riseTime = 0.01f;
      float fallTime = 0.01f;
      float curveSigned = 0.f;
      float dotXNorm = 0.f;
      float dotYNorm = 0.f;
      bool engineDotVisible = false;
      FunctionShapeMode shapeMode = FUNCTION_SHAPE_MATHS;
      bool interactiveRecent = false;
      uint32_t version = 0;
      getPreviewState(channel, riseTime, fallTime, curveSigned, dotXNorm, dotYNorm,
        engineDotVisible, shapeMode, interactiveRecent, version);
      const float frequency = 1.f / std::max(riseTime + fallTime, 1e-6f);
      if (!engineDotVisible || frequency >= 2.4f) rackWebDotVisible[index] = false;
      else if (frequency <= 2.f) rackWebDotVisible[index] = true;
      const int offset = index * 9;
      rackWebPreview[offset + 0] = riseTime;
      rackWebPreview[offset + 1] = fallTime;
      rackWebPreview[offset + 2] = curveSigned;
      rackWebPreview[offset + 3] = dotXNorm;
      rackWebPreview[offset + 4] = dotYNorm;
      rackWebPreview[offset + 5] = rackWebDotVisible[index] ? 1.f : 0.f;
      rackWebPreview[offset + 6] = static_cast<float>(shapeMode);
      rackWebPreview[offset + 7] = interactiveRecent ? 1.f : 0.f;
      rackWebPreview[offset + 8] = static_cast<float>(version);
    }
    return rackWebPreview.data();
  }
};

RACK_WEB_EXPORTS(RackWebIntegralFluxModule)`);
}
function adaptProcBrowserSource(source){
  return source.replace(/RACK_WEB_EXPORTS\(Proc\)\s*$/,`struct RackWebProcModule : Proc {
  std::array<float, 9> rackWebPreview {};
  bool rackWebDotVisible = false;

  int rackWebVisualCount() const override { return static_cast<int>(rackWebPreview.size()); }
  float* rackWebVisualBuffer() override {
    float riseTime = 0.01f;
    float fallTime = 0.01f;
    float curveSigned = 0.f;
    float dotXNorm = 0.f;
    float dotYNorm = 0.f;
    bool engineDotVisible = false;
    bool interactiveRecent = false;
    uint32_t version = 0;
    getPreviewState(riseTime, fallTime, curveSigned, dotXNorm, dotYNorm,
      engineDotVisible, interactiveRecent, version);
    const float frequency = 1.f / std::max(riseTime + fallTime, 1e-6f);
    if (!engineDotVisible || frequency >= 2.4f) rackWebDotVisible = false;
    else if (frequency <= 2.f) rackWebDotVisible = true;
    rackWebPreview[0] = riseTime;
    rackWebPreview[1] = fallTime;
    rackWebPreview[2] = curveSigned;
    rackWebPreview[3] = dotXNorm;
    rackWebPreview[4] = dotYNorm;
    rackWebPreview[5] = rackWebDotVisible ? 1.f : 0.f;
    rackWebPreview[6] = 0.f;
    rackWebPreview[7] = interactiveRecent ? 1.f : 0.f;
    rackWebPreview[8] = static_cast<float>(version);
    return rackWebPreview.data();
  }
};

RACK_WEB_EXPORTS(RackWebProcModule)`);
}
function adaptLessMessBrowserSource(source){
  return replaceOutOfLineMethod(source,"LessMess","dataToJson",`json_t *LessMess::dataToJson() {
  json_t *rootJ = json_object();
  for (int index = 0; index < NUM_ROWS; index++)
    json_object_set_new(rootJ, ("label" + std::to_string(index)).c_str(), json_string(labels[index].c_str()));
  return rootJ;
}`);
}
function adaptLeviathanIntegralFluxBrowserBody(source){
  source=source
    .replace(/\bModuleTeardownTimer\s+teardownTimer\s*\{[^;]*\}\s*;/g,"")
    .replace(/\bisDragonKingDebugEnabled\s*\(\s*\)/g,"false")
    .replace(/\bisDragonKingPreviewWidgetOptionsEnabled\s*\(\s*\)/g,"false");
  return replaceInlineMethodBody(source,/~IntegralFluxImpl\s*\(\s*\)\s*override/,"");
}
function adaptLeviathanIntegralFluxBrowserPrelude(source){
  source=removeClassDefinition(source,"WavePreviewBufferedTracer");
  const tracerPrelude=`enum WavePreviewTracerCacheMode {
  WAVE_PREVIEW_TRACER_CURVE_CACHE = 0,
  WAVE_PREVIEW_TRACER_FRAME_CACHE = 1,
};
struct WavePreviewTracerCaptureStats {
  bool captured = false;
  size_t simplifiedPointCount = 0;
  size_t compactedPointCount = 0;
};`;
  return /\bWavePreviewTracerCaptureStats\b/.test(source)?source:`${tracerPrelude}\n${source}`;
}
function adaptLeviathanProcBrowserBody(source){
  source=source
    .replace(/\bModuleTeardownTimer\s+teardownTimer\s*\{[^;]*\}\s*;/g,"")
    .replace(/\bdebug_terminal::BaselineModuleMetrics\s+debugMetrics\s*;/g,"")
    .replace(/\bdebugMetrics\.assignInstanceId\s*\([^;]*\)\s*;/g,"")
    .replace(/\bconst\s+auto\s+processStart\s*=\s*debug_terminal::debugTimerStart\s*\([^;]*\)\s*;/g,"")
    .replace(/\bif\s*\(\s*measurePerf\s*\)\s*\{\s*debugMetrics\.recordProcess\s*\(\s*debug_terminal::elapsedNsSince\s*\(\s*processStart\s*\)\s*\)\s*;\s*\}/g,"")
    .replace(/\bisDragonKingDebugEnabled\s*\(\s*\)/g,"false")
    .replace(/\bisDragonKingPreviewWidgetOptionsEnabled\s*\(\s*\)/g,"false");
  source=replaceInlineMethodBody(source,/~Proc\s*\(\s*\)\s*override/,"");
  return `${source}
  std::array<float, 9> rackWebPreview {};
  bool rackWebDotVisible = false;
  int rackWebVisualCount() const override { return static_cast<int>(rackWebPreview.size()); }
  float* rackWebVisualBuffer() override {
    float riseTime = 0.01f, fallTime = 0.01f, curveSigned = 0.f;
    float dotXNorm = 0.f, dotYNorm = 0.f;
    bool engineDotVisible = false, interactiveRecent = false;
    uint32_t version = 0;
    getPreviewState(riseTime, fallTime, curveSigned, dotXNorm, dotYNorm,
      engineDotVisible, interactiveRecent, version);
    const float frequency = 1.f / std::max(riseTime + fallTime, 1e-6f);
    if (!engineDotVisible || frequency >= 2.4f) rackWebDotVisible = false;
    else if (frequency <= 2.f) rackWebDotVisible = true;
    rackWebPreview = {riseTime, fallTime, curveSigned, dotXNorm, dotYNorm,
      rackWebDotVisible ? 1.f : 0.f, 0.f, interactiveRecent ? 1.f : 0.f,
      static_cast<float>(version)};
    return rackWebPreview.data();
  }`;
}
function adaptLeviathanProcBrowserPrelude(source){
  return adaptLeviathanIntegralFluxBrowserPrelude(source);
}
function adaptLeviathanUndertowBrowserBody(source){
  source=source
    .replace(/\bModuleTeardownTimer\s+teardownTimer\s*\{[^;]*\}\s*;/g,"")
    .replace(/\bdebug_terminal::BaselineModuleMetrics\s+debugMetrics\s*;/g,"")
    .replace(/\bisDragonKingDebugEnabled\s*\(\s*\)/g,"false")
    .replace(/\bisDragonKingPreviewWidgetOptionsEnabled\s*\(\s*\)/g,"false");
  return `${source}
  static constexpr int NUM_PARAMS = PARAMS_LEN;
  static constexpr int NUM_INPUTS = INPUTS_LEN;
  static constexpr int NUM_OUTPUTS = OUTPUTS_LEN;
  static constexpr int NUM_LIGHTS = LIGHTS_LEN;
  void setState(int id, float value) override {
    switch (id) {
      case 0: shapeEntryAsymmetry.store(value != 0.f, std::memory_order_relaxed); break;
      case 1: shapeEntryAsymmetryOnRight.store(value != 0.f, std::memory_order_relaxed); break;
      case 2: analogCharacterEnabled.store(value != 0.f, std::memory_order_relaxed); break;
      case 3: previewTracerEnabled.store(value != 0.f, std::memory_order_relaxed); break;
      case 4: previewTracerCacheMode.store(value >= .5f ? 1 : 0, std::memory_order_relaxed); break;
      default: break;
    }
  }
  float rackWebPreview[264] {};
  int rackWebVisualCount() const override { return 264; }
  float* rackWebVisualBuffer() override {
    const float shape = displayShapeAmount.load(std::memory_order_relaxed);
    const float edgeHardness = params[EDGE_HARDNESS_PARAM].getValue();
    const bool asymmetry = shapeEntryAsymmetry.load(std::memory_order_relaxed);
    const bool asymmetryOnRight = shapeEntryAsymmetryOnRight.load(std::memory_order_relaxed);
    rackWebPreview[0] = displayFrequencyHz.load(std::memory_order_relaxed);
    if (!(rackWebPreview[0] > 0.f))
      rackWebPreview[0] = kUndertowMinHz * std::pow(
        kUndertowMaxHz / kUndertowMinHz, clamp(params[COARSE_PARAM].getValue(), 0.f, 1.f));
    rackWebPreview[1] = shape;
    rackWebPreview[2] = edgeHardness;
    rackWebPreview[3] = asymmetry ? 1.f : 0.f;
    rackWebPreview[4] = asymmetryOnRight ? 1.f : 0.f;
    rackWebPreview[5] = previewTracerEnabled.load(std::memory_order_relaxed) ? 1.f : 0.f;
    rackWebPreview[6] = static_cast<float>(previewTracerCacheMode.load(std::memory_order_relaxed));
    rackWebPreview[7] = analogCharacterEnabled.load(std::memory_order_relaxed) ? 1.f : 0.f;
    for (int index = 0; index < 256; index++) {
      const float phase = static_cast<float>(index) / 255.f;
      rackWebPreview[8 + index] = 5.f * undertow_shape::thresholdFold(
        phase, shape, asymmetry, edgeHardness, asymmetryOnRight);
    }
    return rackWebPreview;
  }`;
}
function adaptLeviathanUndertowBrowserPrelude(source){
  return adaptLeviathanIntegralFluxBrowserPrelude(source);
}
function adaptLeviathanUndertowBrowserImplementation(source){
  source=removeClassDefinition(source,"ModuleTeardownTimer");
  source=removeOutOfLineDefinitions(source,"ModuleTeardownTimer");
  source=removeClassDefinition(source,"UndertowFreqQuantity");
  source=source
    .replace(/\bconfigParam\s*<\s*UndertowFreqQuantity\s*>\s*\(/g,"configParam(")
    .replace(/^\s*bool\s+false\s*;\s*$/gm,"")
    .replace(/^\s*bool\s+false\s*\{[^{}]*\}\s*$/gm,"")
    .replace(/^\s*bool\s+isModuleTeardownLoggingEnabled\s*\(\s*\)\s*;\s*$/gm,"")
    .replace(/^\s*bool\s+isModuleTeardownLoggingEnabled\s*\(\s*\)\s*\{[^{}]*\}\s*$/gm,"")
    .replace(/^\s*std::atomic<uint32_t>\s+gUndertowDebugInstanceCounter\s*\{[^;]*\}\s*;\s*$/gm,"")
    .replace(/\bdebugMetrics\.assignInstanceId\s*\([^;]*\)\s*;/g,"")
    .replace(/\bconst\s+auto\s+processStart\s*=\s*debug_terminal::debugTimerStart\s*\([^;]*\)\s*;/g,"")
    .replace(/\bif\s*\(\s*measurePerf\s*\)\s*\{\s*debugMetrics\.recordProcess\s*\(\s*debug_terminal::elapsedNsSince\s*\(\s*processStart\s*\)\s*\)\s*;\s*\}/g,"")
    .replace(/\bisDragonKingDebugEnabled\s*\(\s*\)/g,"false")
    .replace(/\bisDragonKingPreviewWidgetOptionsEnabled\s*\(\s*\)/g,"false");
  source=source
    .replace(/^\s*bool\s+false\s*;\s*$/gm,"")
    .replace(/^\s*bool\s+false\s*\{[^{}]*\}\s*$/gm,"");
  const moduleDeclaration=rustSourceTypeDeclaration(source,"Undertow");
  if(moduleDeclaration){
    const body=rustTypeBody(source,moduleDeclaration);
    if(body!==null&&!body.includes("rackWebPreview"))source=source.slice(0,moduleDeclaration.bodyStart)+adaptLeviathanUndertowBrowserBody(body)+source.slice(moduleDeclaration.bodyEnd);
  }
  if(!/\binline\s+float\s+fastAtanApprox\s*\(\s*float\s+x\s*\)\s*;/.test(source)){
    const anchor=source.indexOf("inline float acCoupledLinFm");
    if(anchor>=0)source=source.slice(0,anchor)+"inline float fastAtanApprox(float x);\ninline float onePoleCoeff(float sampleTime, float tauSeconds);\n\n"+source.slice(anchor);
  }
  source=replaceOutOfLineMethod(source,"Undertow","~Undertow","Undertow::~Undertow() {}");
  return source;
}
function adaptLifeFormModularBrowserSource(source){
  // Vult headers use static definitions but emit ordinary forward
  // declarations. Flattening the headers into one browser translation unit
  // exposes that linkage mismatch, so normalize both sides to `inline`.
  return source
    .replace(/#ifdef\s+_MSC_VER\s*\n#define\s+static_inline\s+static\s+__inline\s*\n#else\s*\n#define\s+static_inline\s+static\s+inline\s*\n#endif/g, "")
    .replace(/\bstatic_inline\b/g, "inline");
}
function adaptPathSetIceTrayBrowserBody(source){
  source=replaceInlineMethodBody(source,/\bvoid\s+onAdd\s*\(\s*const\s+AddEvent\s*&\s*e\s*\)\s*override\s*\{/,`
    (void)e;
    updateCubeLights();
    updateRecordAndPlaybackLights();
  `);
  return replaceInlineMethodBody(source,/\bvoid\s+onSave\s*\(\s*const\s+SaveEvent\s*&\s*e\s*\)\s*override\s*\{/,`
    (void)e;
  `);
}
function adaptPathSetIceTrayBrowserPrelude(source){
  // IceTray's pitch shifter is header-only, but dependency flattening also
  // pulls in PathSet's native PFFFT header and implementation. The browser
  // runtime already exposes the same PFFFT API with a portable WebAssembly
  // implementation, so retain the DSP consumer and the one plugin helper
  // while dropping the duplicate platform-specific FFT translation unit.
  const pitchShifter=classDefinitionSource(source,"PitchShifter");
  if(!pitchShifter)fail("PathSet/IceTray is missing its PitchShifter dependency");
  return `using namespace std;

${pitchShifter}

inline json_t* json_bool(bool value) {
  return value ? json_true() : json_false();
}`;
}
function adaptPinkTromboneGeneratedAdapter(source){
  const moduleIndex=source.indexOf("struct PinkTrombone : Module");
  if(moduleIndex<0)fail("PinkTrombone generated adapter is missing its module class");
  const commentEnd=source.indexOf("\n\n");
  const header=commentEnd>=0?source.slice(0,commentEnd):"// PinkTrombone browser adapter";
  return `${header}

#include "rack_web_export.hpp"
#include "PinkTrombone/Glottis.hpp"
#include "PinkTrombone/Tract.hpp"
#include "PinkTrombone/WhiteNoise.hpp"
#include "PinkTrombone/Biquad.hpp"
#include "PinkTrombone/util.h"

${source.slice(moduleIndex)}`;
}
function adaptTriggerFishGeneratedAdapter(source){
  const contracts=[
    {
      module:"TfVDPO",
      includes:[
        '#include "models/VdpOscillator.hpp"',
        "#include <memory>",
        '#include "tfdsp/noise.hpp"',
        '#include "tfdsp/sampleRate.cpp"',
      ],
    },
    {
      module:"TfVCA",
      includes:[
        '#include "models/VCAcore.hpp"',
        "#include <memory>",
        '#include "tfdsp/filters.hpp"',
        '#include "tfdsp/sampleRate.cpp"',
      ],
    },
  ];
  const contract=contracts.find(({module})=>new RegExp(`\\bRACK_WEB_EXPORTS\\(${module}\\)`).test(source));
  if(!contract)return source;
  const moduleIndex=source.indexOf(`struct ${contract.module} : Module`);
  if(moduleIndex<0)fail(`${contract.module} generated adapter is missing its module class`);
  const commentEnd=source.indexOf("\n\n");
  const header=commentEnd>=0?source.slice(0,commentEnd):`// ${contract.module} browser adapter`;
  return `${header}

#include "rack_web_export.hpp"
${contract.includes.join("\n")}

${source.slice(moduleIndex)}`;
}
function adaptPitchGridMicroExquisBrowserSource(source){
  // The native module optionally publishes its tuning through the process-wide
  // MTS-ESP shared library. Browsers cannot load that desktop DLL/dylib, but
  // the module's own Exquis MIDI and voltage tuning paths remain fully usable.
  source=source
    .replace('#include "rack_web_export.hpp"','#include "rack_web_export.hpp"\n#include <cfloat>')
    .replace(/^\s*#include\s+<windows\.h>\s*$/gm,"")
    .replace(/^\s*#include\s+<dlfcn\.h>\s*$/gm,"");
  const tuningAnchor="exquis.tuning = &tuning;";
  if(!source.includes(tuningAnchor))fail("PitchGrid/MicroExquis is missing its Exquis tuning assignment");
  source=source.replace(tuningAnchor,`${tuningAnchor}
		exquis.showAllOctavesLayer();`);

  const mtsStart=source.indexOf("#if defined(WIN32)");
  const mtsEnd=mtsStart>=0?source.indexOf("\n\nint IntegerGCD(",mtsStart):-1;
  if(mtsStart<0||mtsEnd<0)fail("PitchGrid/MicroExquis is missing its native MTS-ESP loader");
  const mtsBrowserStubs=`// MTS-ESP is a desktop process-level service and has no browser ABI.
void MTS_RegisterMaster() {}
void MTS_DeregisterMaster() {}
bool MTS_CanRegisterMaster() { return false; }
bool MTS_HasIPC() { return false; }
void MTS_Reinitialize() {}
int MTS_GetNumClients() { return 0; }
void MTS_SetNoteTunings(const double*) {}
void MTS_SetNoteTuning(double, char) {}
void MTS_SetScaleName(const char*) {}
void MTS_FilterNote(bool, char, char) {}
void MTS_ClearNoteFilter() {}
void MTS_SetMultiChannel(bool, char) {}
void MTS_SetMultiChannelNoteTunings(const double*, char) {}
void MTS_SetMultiChannelNoteTuning(double, char, char) {}
void MTS_FilterNoteMultiChannel(bool, char, char) {}
void MTS_ClearNoteFilterMultiChannel(char) {}`;
  source=source.slice(0,mtsStart)+mtsBrowserStubs+source.slice(mtsEnd);

  const exquisYellow=/^\s*Color\s+XQ_COLOR_EXQUIS_YELLOW\s*=\s*\{\s*127\s*,\s*75\s*,\s*5\s*\}\s*;\s*$/gm;
  if(!exquisYellow.test(source))fail("PitchGrid/MicroExquis is missing its Exquis yellow color");
  source=source.replace(exquisYellow,"");
  const black="Color XQ_COLOR_BLACK = {0,0,0};";
  if(!source.includes(black))fail("PitchGrid/MicroExquis is missing the color declaration anchor");
  source=source.replace(black,`${black}
Color XQ_COLOR_EXQUIS_YELLOW = {127,75,5};`);

  // HSLuv's private C typedefs are not part of hsluv.h, so the dependency
  // flattener sees its functions and constants but not these two local types.
  const hsluvAnchor="void\nhsluv2rgb(";
  if(!source.includes(hsluvAnchor))fail("PitchGrid/MicroExquis is missing its HSLuv implementation");
  return source.replace(hsluvAnchor,`struct Triplet { double a; double b; double c; };
struct Bounds { double a; double b; };

${hsluvAnchor}`);
}
function pathSetCvRangeHostPrelude(){
  return `
struct CVRange {
  float cv_a = -1.f;
  float cv_b = 1.f;
  float range = 2.f;
  float min = -1.f;
  CVRange() = default;
  CVRange(float first, float second) : cv_a(first), cv_b(second) { updateInternal(); }
  void updateInternal() { range = std::abs(cv_a - cv_b); min = std::min(cv_a, cv_b); }
  float map(float value) { return range * value + min; }
  float invMap(float value) { return range == 0.f ? 0.f : (value - min) / range; }
  json_t* dataToJson() {
    json_t* root = json_object();
    json_object_set_new(root, "a", json_real(cv_a));
    json_object_set_new(root, "b", json_real(cv_b));
    return root;
  }
  void dataFromJson(json_t* root) {
    if (!root) return;
    if (json_is_object(root)) {
      cv_a = json_real_value(json_object_get(root, "a"));
      cv_b = json_real_value(json_object_get(root, "b"));
    }
    else if (json_is_integer(root)) {
      static constexpr float presets[12][2] = {
        {-10.f, 10.f}, {-5.f, 5.f}, {-3.f, 3.f}, {-1.f, 1.f},
        {0.f, 10.f}, {0.f, 5.f}, {0.f, 3.f}, {0.f, 1.f},
        {-4.f, 4.f}, {-2.f, 2.f}, {0.f, 4.f}, {0.f, 2.f}
      };
      const int index = std::clamp<int>(json_integer_value(root), 0, 11);
      cv_a = presets[index][0];
      cv_b = presets[index][1];
    }
    updateInternal();
  }
};
struct CVRangeParamQuantity : ParamQuantity {
  CVRange* range = nullptr;
  float getDisplayValue() override { return range ? range->map(getValue()) : getValue(); }
  void setDisplayValue(float value) override { setValue(range ? range->invMap(value) : value); }
};`;
}
function rackWebAbiSource(moduleType,counts){
  const report=runRustSource(["abi","wrapper","--format","json"],activeSourceTool,{moduleType,paramCount:counts.params,inputCount:counts.inputs,outputCount:counts.outputs,lightCount:counts.lights});
  if(typeof report.source!=="string"||!report.source.includes(`RACK_WEB_EXPORTS(${moduleType})`))fail("Rust ABI wrapper returned invalid source");
  return report.source;
}
function adapterSource(target,manifest,license,definitionFile,registrationFile,registration,prelude,body,implementations,inherited,detected,compileEligible,sourceDir,vcoSpecializations=""){
  if(target.key==="PathSet/IceTray")prelude=adaptPathSetIceTrayBrowserPrelude(prelude);
  if(target.key==="Edge/K_Rush"){
    prelude=adaptEdgeKRushBrowserSource(prelude,sourceDir);
    body=body.replace(/\bif\s*\(\s*d_pos\.first_alg\s*\)\s*d_pos\.first_alg\s*=\s*json_integer_value\s*\(\s*first_algJ\s*\)\s*;/,"if (first_algJ) d_pos.first_alg = json_integer_value(first_algJ);");
  }
  if(target.plugin==="LifeFormModular"){
    prelude=adaptLifeFormModularBrowserSource(prelude);
    body=adaptLifeFormModularBrowserSource(body);
    implementations=implementations.map(adaptLifeFormModularBrowserSource);
    for(const definition of inherited){
      definition.prelude=adaptLifeFormModularBrowserSource(definition.prelude);
      definition.body=adaptLifeFormModularBrowserSource(definition.body);
      definition.implementations=definition.implementations.map(adaptLifeFormModularBrowserSource);
    }
  }
  const directDmaHeader=(detected.sourceFiles??[]).find(file=>path.basename(file)==="DMA.hpp");
  if(directDmaHeader&&/\bDMA(?:Expander|Host)Module\s*</.test(`${detected.inheritance?.directBase??""}\n${body}`)){
    const directDmaSource=fs.readFileSync(directDmaHeader,"utf8"),directIncludes=new Set(rawIncludes(directDmaHeader,directDmaSource).map(file=>path.basename(file))),includedHeaders=(detected.sourceFiles??[]).filter(file=>directIncludes.has(path.basename(file)));
    for(const header of [directDmaHeader,...includedHeaders])for(const name of declaredTypeNames(fs.readFileSync(header,"utf8"))){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");prelude=stripNamespaceBlockContaining(prelude,new RegExp(`\\b(?:class|struct)\\s+${escaped}\\b`))}
    prelude=`#include "DMA.hpp"\n${prelude}`;inherited=[];
  }
  body=qualifyPluginGlobalHostHelperCalls(body,prelude);
  for(const definition of inherited)definition.body=qualifyPluginGlobalHostHelperCalls(definition.body,prelude);
  if(!vcoSpecializations){const configDirectory=path.join(sourceDir,"src","vcoconfig"),configFiles=fs.existsSync(configDirectory)?files(configDirectory):[];vcoSpecializations=surgeVcoSpecializations([...(detected.sourceFiles??[]),...configFiles],registration.moduleClass)}
  const fxSpecializations=surgeFxConfigSpecializations(detected.sourceFiles??[],registration.moduleClass);
  const untemplated=registration.moduleClass.split("<",1)[0],explicitParts=untemplated.split("::"),className=explicitParts.pop(),detectedParts=detected.namespace??[],parts=detectedParts.length?detectedParts:explicitParts,rawModuleLeafType=`${className}${registration.moduleClass.slice(untemplated.length)}`,moduleLeafType=qualifyRegisteredTemplateType(rawModuleLeafType,parts,detected.sourceFiles??[]),namespaceOpen=parts.map(name=>`namespace ${name} {`).join("\n"),namespaceClose=parts.map(()=>"}").reverse().join("\n"),webType=parts.length?`${parts.join("::")}::${moduleLeafType}`:moduleLeafType,templateDeclaration=detected.template?.declaration,templateExport=Boolean(templateDeclaration);
  const targetTypeReference=new RegExp(`\\b${className.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`),deferredPreludeImplementations=[];let familyDeferredPrelude="";
  for(const dependencyType of declaredTypeNames(prelude)){
    const dependencyDeclaration=typeDeclarationSource(prelude,dependencyType),dependsOnTarget=targetTypeReference.test(dependencyDeclaration);
    for(const definition of outOfLineDefinitions(prelude,dependencyType))if(dependsOnTarget||targetTypeReference.test(definition)){prelude=prelude.replace(definition,"");deferredPreludeImplementations.push(definition)}
  }
  implementations=[...new Set([...deferredPreludeImplementations,...implementations].filter(definition=>!prelude.includes(definition)))];
  implementations=implementations.filter(value=>!/\b(?:draw|drawLayer)\s*\([^;{}]*\b(?:widget::Widget::)?DrawArgs\b/.test(value));
  let rackWebExportInclude=/\b(?:class|struct)\s+RCFilter\b/.test(prelude)?`#define RCFilter RackWebHostRCFilter
#include "rack_web_export.hpp"
#undef RCFilter`:`#include "rack_web_export.hpp"`,fullSurgeHost=fullSurgeHostContract(target,body,inherited);let hostCompatibilityPrelude=fullSurgeHost?fullSurgeHostPrelude():"";if(target.plugin==="PathSet"&&/\bCVRange\b/.test(`${prelude}\n${body}`))hostCompatibilityPrelude+=pathSetCvRangeHostPrelude();if(fullSurgeHost){const oscillatorTarget=surgeOscillatorTarget(vcoSpecializations||registration.moduleClass);if(oscillatorTarget)hostCompatibilityPrelude+=`\n#include "${oscillatorTarget}.h"\n`}
  if(target.key==="Chinenual-VCV/MIDIRecorder")rackWebExportInclude+="\n#include <sstream>";
  const singleHeaderImplementations=(detected.includes??[]).includes("nanosvg.h")?`#define NANOSVG_IMPLEMENTATION
#include <nanosvg.h>
#include <iomanip>`:"";
  if(portableSurgeHostForTarget(target,body,inherited)){prelude=portableSurgeHostPrelude(prelude,body);inherited=[]}
  if(detected.browserAsset?.mode==="wavetable"){prelude=stripWavetableFilesystemPrelude(prelude);implementations=adaptWavetableImplementations(implementations,registration.moduleClass)}
  implementations=adaptAudioFileTapeImplementations(implementations,registration.moduleClass,detected.browserAsset);
  implementations=implementations.filter(value=>!/\b[A-Za-z_]\w*(?:Display|Widget|Label|Diagram)::/.test(value));
  const nativeUiMemberNames=[...new Set([...nativeUiPointerMembers(body).map(member=>member.name),...(detected.uiPointerNames??[])])];implementations=implementations.map(value=>stripNativeUiImplementationBridges(value,nativeUiMemberNames)).filter(Boolean);
  if(target.plugin==="GP"&&target.model.startsWith("ChainMixer")){
    familyDeferredPrelude=gpChainMixerDspPrelude();
    implementations=implementations
      .filter(value=>!["FaderGainQuantity","PanBalQuantity","SendQuantity","GPaudioFader"].some(type=>value.slice(0,value.indexOf("{")).includes(`${type}::`)))
      .map(value=>value.replace(/^\s*shared_ptr\s*<\s*Svg\s*>\s+pForceInitializationOfSingleton\s*=\s*NumberSvg\s*\(\s*1\s*\)\s*;\s*$/gm,""))
      .filter(Boolean);
  }
  if(target.plugin==="CosineKitty-Sapphire"){
    const qualifyString=value=>value.replace(/(?<![:\w])string::/g,"rack::string::");
    const rawInterpolatorStatics=outOfLineStaticDefinitions(prelude,"Interpolator"),wrappedInterpolatorStatics=outOfLineStaticDefinitions(prelude,"Interpolator",true);
    for(const definition of rawInterpolatorStatics)prelude=prelude.replace(definition,"");
    familyDeferredPrelude=wrappedInterpolatorStatics.join("\n\n");
    prelude=qualifyString(prelude);
    body=qualifyString(body);
    implementations=implementations.map(qualifyString).filter(value=>!/\b[A-Za-z_]\w*Action::[A-Za-z_]\w*\s*\(/.test(value));
    implementations=implementations.map(value=>replaceOutOfLineMethod(replaceOutOfLineMethod(value,"SapphireModule","setPolyphonicEnvelopeOutput","void SapphireModule::setPolyphonicEnvelopeOutput(bool state) { if (envelopeFollower.enabled) envelopeFollower.polyphonicOutput = state; }"),"SapphireModule","toggleEnvDuck","void SapphireModule::toggleEnvDuck() { if (envelopeFollower.enabled) envelopeFollower.duck = !envelopeFollower.duck; }"));
    for(const definition of inherited){
      definition.prelude=qualifyString(definition.prelude);
      definition.body=qualifyString(definition.body);
      definition.implementations=definition.implementations.map(qualifyString).filter(value=>!/\b[A-Za-z_]\w*Action::[A-Za-z_]\w*\s*\(/.test(value));
    }
  }
  if(target.key.startsWith("Biset/Biset-Tracker-")){
    prelude=adaptBisetTrackerAuxiliaryBrowserImplementation(prelude);
    implementations=implementations.map(adaptBisetTrackerAuxiliaryBrowserImplementation).filter(Boolean);
  }
  if(target.key==="Biset/Biset-Tracker"){
    prelude=adaptBisetTrackerBrowserImplementation(prelude);
    for(const type of ["TrackerControl","TrackerSynth","TrackerDrum"])prelude=removeOutOfLineDefinitions(prelude,type);
    implementations=implementations.map(adaptBisetTrackerBrowserImplementation).filter(Boolean);
    const itoawImplementations=(detected.rootSourceFiles??[]).flatMap(file=>outOfLineFreeFunctionDefinitions(fs.readFileSync(file,"utf8"),"itoaw"));
    implementations.unshift(...itoawImplementations);
    implementations.unshift("static void process_midi_message(midi::Message* msg);");
  }
  if(target.key==="Chinenual-VCV/MIDIRecorder"){
    prelude=replaceInlineMethodBody(prelude,/\bvoid\s+appendEvent\s*\(\s*const\s+int\s+track\s*,\s*smf::MidiEvent\s*&\s*event\s*\)/," midiFile.addEvent(track, event); ");
    prelude=replaceInlineMethodBody(prelude,/\bvoid\s+start\s*\(\s*\)/," workerBufferIndex = 0; bufferIndex = 0; running = true; ");
    prelude=replaceInlineMethodBody(prelude,/\bvoid\s+stop\s*\(\s*\)/," running = false; ");
  }
  if(target.key==="Biset/Biset-Blank"){
    prelude=adaptBisetBlankBrowserImplementation(prelude);
    for(const type of ["BlankWidget","BlankCables","BlankScope"])prelude=removeOutOfLineDefinitions(prelude,type);
    implementations=implementations.map(value=>{
      value=adaptBisetBlankBrowserImplementation(value);
      for(const type of ["BlankWidget","BlankCables","BlankScope"])value=removeOutOfLineDefinitions(value,type);
      return value;
    }).filter(Boolean);
  }
  for(const definition of inherited){
    const inheritedSupportReferences=[definition.body,...definition.implementations].join("\n");
    definition.supportImplementations=[
      ...preludeTypeImplementations(detected.rootSourceFiles??detected.sourceFiles??[],definition.prelude,inheritedSupportReferences,definition.name),
      ...(definition.supportImplementations??[]),
    ];
    for(const key of ["supportImplementations","implementations"]){
      const retained=[];
      for(const value of definition[key]??[]){
        if(targetTypeReference.test(value))implementations.push(value);
        else retained.push(value);
      }
      definition[key]=retained;
    }
  const inheritedUiMemberNames=nativeUiPointerMembers(definition.body).map(member=>member.name);
    if(process.env.RACK_WEB_DEBUG_UI_POINTERS&&inheritedUiMemberNames.length)console.error(JSON.stringify({type:definition.name,names:inheritedUiMemberNames}));
    if(!inheritedUiMemberNames.length)continue;
    definition.body=stripNativeUiPointerBridges(definition.body,[definition.body,...definition.implementations,...definition.supportImplementations].join("\n"));
    definition.implementations=definition.implementations.map(value=>stripNativeUiImplementationBridges(value,inheritedUiMemberNames)).filter(Boolean);
    definition.supportImplementations=(definition.supportImplementations??[]).map(value=>stripNativeUiImplementationBridges(value,inheritedUiMemberNames)).filter(Boolean);
  }
  const hostLookupModels=detected.expander?.models??[];
  prelude=adaptHostModelLookups(prelude,hostLookupModels);
  body=adaptHostModelLookups(body,hostLookupModels);
  implementations=implementations.map(value=>adaptHostModelLookups(value,hostLookupModels));
  for(const definition of inherited){definition.prelude=adaptHostModelLookups(definition.prelude,hostLookupModels);definition.body=adaptHostModelLookups(definition.body,hostLookupModels);definition.implementations=definition.implementations.map(value=>adaptHostModelLookups(value,hostLookupModels));definition.supportImplementations=(definition.supportImplementations??[]).map(value=>adaptHostModelLookups(value,hostLookupModels))}
  const modelReferenceSource=[prelude,body,...implementations,...inherited.flatMap(definition=>[definition.prelude,definition.body,...definition.implementations])].join("\n"),hostModelSymbols=[...new Set([...referencedHostModels(modelReferenceSource),...(detected.expander?.models??[]).map(model=>model.symbol).filter(Boolean)])],hostModelStubs=hostModelSymbols.map((symbol,index)=>`static rack::plugin::Model rackWebHostModel${index};\nstatic rack::plugin::Model* ${symbol} = &rackWebHostModel${index};`).join("\n");
  if(process.env.RACK_WEB_DEBUG_MODELS)console.error(JSON.stringify({hostModelSymbols,modelReferenceLines:modelReferenceSource.split("\n").filter(line=>/\bmodel[A-Z][A-Za-z0-9_]*\b/.test(line))},null,2));
  if(target.key==="Leviathan/TemporalDeck")return browserTemporalDeckAdapterSource(target,manifest,license,definitionFile,registrationFile);
  if(target.key==="Leviathan/TDScope")return browserTdScopeAdapterSource(target,manifest,license,definitionFile,registrationFile);
  if(target.key==="LomasModules/AdvancedSampler")return browserLomasAdvancedSamplerAdapterSource(target,manifest,license,definitionFile,registrationFile);
  if(!compileEligible)return `// Generated Rack Web adapter scaffold for ${target.key}.\n// Source: ${manifest.sourceUrl} (${definitionFile}; registered in ${registrationFile})\n// License: ${license}\n\n#include "rack_web_export.hpp"\n\n// TODO: translate the DSP-only ${registration.moduleClass} body and remove widget/native dependencies.\nstruct ${target.plugin.replace(/[^A-Za-z0-9]/g,"")}${target.model.replace(/[^A-Za-z0-9]/g,"")}Web : Module {\n  // Detected source contract is recorded in adapter.json.\n};\n\n// RACK_WEB_EXPORTS(...) is intentionally enabled only after the adapter passes ABI tests.\n`;
  if(target.key==="computerscare/computerscare-blank")return browserComputerscareBlankAdapterSource(target,manifest,license,definitionFile,registrationFile);
  if(target.key==="Ahornberg/TapeInspector")return browserTapeInspectorAdapterSource(target,manifest,license,definitionFile,registrationFile);
  if(detected.browserAsset?.mode==="url-audio")return browserUrlAudioAdapterSource(target,manifest,license,definitionFile,registrationFile,detected.browserAsset);
  const countConstants={...(detected.constants??{}),...(detected.template?.constants??{})},aliases=[["params","NUM_PARAMS"],["inputs","NUM_INPUTS"],["outputs","NUM_OUTPUTS"],["lights","NUM_LIGHTS"]].flatMap(([key,expected])=>{const bodyEnum=detected.enums[key]&&enumInfo(body,detected.enums[key].name),declarationSource=`${prelude}\n${body}`,alreadyDeclared=new RegExp(`\\b(?:(?:static|const|constexpr)\\s+)*int\\s+${expected}\\b`).test(declarationSource)||new RegExp(`^\\s*#\\s*define\\s+${expected}\\b`,"m").test(declarationSource)||(bodyEnum?.identifiers??[]).some(value=>value===expected);if(alreadyDeclared)return[];if(!detected.enums[key])return[`  static constexpr int ${expected} = ${detected.counts?.[key]??0};`];const identifiers=detected.enums[key]?.identifiers??[],terminal=[...identifiers].reverse().find(value=>typeof value==="string");return bodyEnum&&terminal&&terminal!==expected&&!bodyEnum.scoped?[`  static constexpr int ${expected} = ${terminal};`]:[`  static constexpr int ${expected} = ${detected.counts?.[key]??enumCount(detected.enums[key],countConstants)};`]}).join("\n");
  const stringStateValue=item=>{const values=item.values?.length?item.values:[""];if(values.length>64)return`[](float rackWebValue) { static constexpr const char* values[] = {${values.map(JSON.stringify).join(",")}}; int index = std::clamp(static_cast<int>(std::round(rackWebValue)), 0, ${values.length-1}); return values[index]; }(value)`;return values.slice(0,-1).map((value,index)=>`value < ${index+.5}f ? ${JSON.stringify(value)} : `).join("")+JSON.stringify(values.at(-1))},stateValue=item=>item.type==="boolean"?"json_boolean(value != 0.f)":item.type==="real"?"json_real(value)":item.type==="string-enum"?`json_string(${stringStateValue(item)})`:"json_integer(static_cast<long long>(value))";
  const stateCase=(sourceItem,index)=>{
    const item=runtimeStateKey(target,sourceItem),path=item.path??(item.index===undefined?[]:[item.index]);
    if(!path.length)return`      case ${index}: json_object_set_new(root, "${item.key}", ${stateValue(item)}); break;`;
    const firstContainer=typeof path[0]==="number"?"array":"object",statements=[`json_t* level0 = json_object_get(root, "${item.key}");`,`if (!json_is_${firstContainer}(level0)) { level0 = json_${firstContainer}(); json_object_set_new(root, "${item.key}", level0); }`];
    for(let level=0;level<path.length-1;level++){
      const segment=path[level],nextContainer=typeof path[level+1]==="number"?"array":"object",getter=typeof segment==="number"?`json_array_get(level${level}, ${segment})`:`json_object_get(level${level}, "${segment}")`,setter=typeof segment==="number"?`json_array_insert_new(level${level}, ${segment}, level${level+1});`:`json_object_set_new(level${level}, "${segment}", level${level+1});`;
      statements.push(`json_t* level${level+1} = ${getter};`,`if (!json_is_${nextContainer}(level${level+1})) { level${level+1} = json_${nextContainer}(); ${setter} }`);
    }
    const final=path.at(-1),setter=typeof final==="number"?`json_array_insert_new(level${path.length-1}, ${final}, ${stateValue(item)});`:`json_object_set_new(level${path.length-1}, "${final}", ${stateValue(item)});`;
    statements.push(setter);return`      case ${index}: { ${statements.join(" ")} break; }`;
  };
  const stateMethod=detected.stateKeys.length?`  void setState(int id, float value) override {\n    json_t* root = dataToJson();\n    if (!json_is_object(root)) { json_decref(root); root = json_object(); }\n    switch (id) {\n${detected.stateKeys.map(stateCase).join("\n")}\n      default: break;\n    }\n    dataFromJson(root);${target.key==="Airwin2Rack/Airwin2Rack"?'\n    if (id == 0) resetAirwinByName(selectedFX, true);':""}\n    json_decref(root);\n  }`:"";
  const actionMethod=target.key==="tapestry/Tapestry"?`  void rackWebTriggerAction(int id, bool active) override {
    static constexpr int rackWebActionSteps = 1024;
    if (!active) return;
    const bool remove = id >= 3000 && id < 3000 + rackWebActionSteps;
    const int encoded = remove ? id - 3000 : id - 1000;
    if (encoded < 0 || encoded >= rackWebActionSteps) return;
    const auto& buffer = dsp.getBuffer();
    const size_t usedFrames = buffer.getUsedFrames();
    if (usedFrames < 1) return;
    const float normalized = static_cast<float>(encoded) / (rackWebActionSteps - 1);
    auto& spliceManager = dsp.getSpliceManager();
    const auto& splices = spliceManager.getAllSplices();
    int hit = -1;
    for (size_t index = 0; index < splices.size(); ++index) {
      const float marker = static_cast<float>(splices[index].startFrame) / usedFrames;
      if (std::fabs(marker - normalized) <= 6.f / 315.f) {
        hit = static_cast<int>(index);
        break;
      }
    }
    if (remove) {
      if (hit > 0) {
        spliceManager.deleteMarkerAtIndex(hit);
        updateOrganizeParamRange();
      }
      return;
    }
    if (hit >= 0) spliceManager.setCurrentIndex(hit);
    else {
      dsp.onSpliceTrigger(static_cast<size_t>(normalized * usedFrames));
      updateOrganizeParamRange();
    }
  }`:target.key==="JW-Modules/XYPad"?`  void rackWebTriggerAction(int id, bool active) override {
    if (id != 1000) return;
    if (active) {
      setCurrentPos(params[X_POS_PARAM].getValue(), params[Y_POS_PARAM].getValue());
      setState(STATE_RECORDING);
    }
    else if (autoPlayOn && !inputs[PLAY_GATE_INPUT].isConnected()) setState(STATE_AUTO_PLAYING);
    else setState(STATE_IDLE);
  }`:target.key==="JW-Modules/BouncyBalls"?`  void rackWebTriggerAction(int id, bool active) override {
    if (id == 1000 && active) paddle.locked = !paddle.locked;
  }`:["KautenjaDSP-PotatoChips/106","KautenjaDSP-PotatoChips/GBS"].includes(target.key)?`  void rackWebTriggerAction(int id, bool active) override {
    static constexpr int rackWebWavetableActionBase = 1000;
    if (!active) return;
    const int encoded = id - rackWebWavetableActionBase;
    if (encoded < 0 || encoded >= NUM_WAVEFORMS * SAMPLES_PER_WAVETABLE * 16) return;
    const int value = encoded % 16;
    const int sample = (encoded / 16) % SAMPLES_PER_WAVETABLE;
    const int table = encoded / (16 * SAMPLES_PER_WAVETABLE);
    wavetable[table][sample] = static_cast<uint8_t>(value);
  }`:target.key==="FreeSurface/FreeSurface-WaterTable"?`  void rackWebTriggerAction(int id, bool active) override {
    if (!active) return;
    switch (id) {
      case MODEL_BUTTON_PARAM: waveChannel.setNextModel(); break;
      case MULTIPLICATIVE_BUTTON_L_PARAM: waveChannel.toggleAdditiveModeL(); break;
      case MULTIPLICATIVE_BUTTON_R_PARAM: if (!waveChannel.isModMode()) waveChannel.toggleAdditiveModeR(); break;
      case INPUT_PROBE_TYPE_BUTTON_L_PARAM: waveChannel.toggleInputProbeTypeL(); break;
      case INPUT_PROBE_TYPE_BUTTON_R_PARAM: if (!waveChannel.isModMode()) waveChannel.toggleInputProbeTypeR(); break;
      case OUTPUT_PROBE_TYPE_BUTTON_L_PARAM: waveChannel.toggleOutputProbeTypeL(); break;
      case OUTPUT_PROBE_TYPE_BUTTON_R_PARAM: waveChannel.toggleOutputProbeTypeR(); break;
      default: break;
    }
  }`:target.key==="ImpromptuModular/Prob-Key"?`  void rackWebTriggerAction(int id, bool active) override {
    static constexpr int rackWebPianoActionBase = 1000;
    static constexpr int rackWebVelocitySteps = 256;
    int encoded = id - rackWebPianoActionBase;
    if (encoded < 0 || encoded >= rackWebVelocitySteps * 12 * 2) return;
    pkInfo.isRightClick = encoded >= rackWebVelocitySteps * 12;
    encoded %= rackWebVelocitySteps * 12;
    pkInfo.key = encoded % 12;
    pkInfo.vel = static_cast<float>(encoded / 12) / static_cast<float>(rackWebVelocitySteps - 1);
    pkInfo.gate = active;
  }`:target.key==="ImpromptuModular/Chord-Key"?`  void rackWebTriggerAction(int id, bool active) override {
    static constexpr int rackWebPianoActionBase = 1000;
    int encoded = id - rackWebPianoActionBase;
    if (encoded < 0 || encoded >= 96) return;
    pkInfo.isRightClick = encoded >= 48;
    encoded %= 48;
    pkInfo.key = encoded % 12;
    pkInfo.vel = (static_cast<float>(encoded / 12) + 0.5f) / 4.f;
    pkInfo.gate = active;
  }`:target.key==="ImpromptuModular/Phrase-Seq-16"||target.key==="ImpromptuModular/Phrase-Seq-32"?`  void rackWebTriggerAction(int id, bool active) override {
    static constexpr int rackWebPianoActionBase = 1000;
    int encoded = id - rackWebPianoActionBase;
    if (encoded < 0 || encoded >= 24) return;
    pkInfo.key = encoded % 12;
    pkInfo.isRightClick = encoded >= 12;
    pkInfo.gate = active;
  }`:target.key==="ImpromptuModular/Hotkey"?`  void rackWebTriggerAction(int id, bool active) override {
    static constexpr int rackWebHotkeyActionBase = 0x20000000;
    if (!active || (id & 0xf0000000) != rackWebHotkeyActionBase) return;
    const int key = id & 0xffff;
    const int mods = (id >> 16) & 0xf;
    hotkeyPressed(key, mods);
  }`:/\bvoid\s+keyEnable\s*\(\s*int\s+\w+\s*\)/.test(body)&&/\bvoid\s+keyDisable\s*\(\s*int\s+\w+\s*\)/.test(body)?`  void rackWebTriggerAction(int id, bool active) override { if (id >= 0 && id < NUM_OUTPUTS) { if (active) keyEnable(id); else keyDisable(id); } }`:"",assetMethods=browserAssetSamplerMethods(detected.browserAsset),sourceNamespaceSource=(detected.sourceFiles??[]).map(file=>fs.readFileSync(file,"utf8")).join("\n"),sourceNamespaceReference=[prelude,body,...implementations,...inherited.flatMap(definition=>[definition.prelude,definition.body,...definition.implementations])].join("\n"),sourceNamespaceSpecificUsings=[...new Set(namespaceSpecificUsingDeclarations(sourceNamespaceSource))].filter(declaration=>{if(/\bnamespace\s/.test(declaration))return false;const targetName=/\busing\s+[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*::([A-Za-z_]\w*)\s*;/.exec(declaration)?.[1];return !targetName||new RegExp(`(^|[^:\\w])${targetName}\\b`).test(sourceNamespaceReference)}),sourceNamespacePrelude=[namespaceUsingPrelude(sourceNamespaceSource),...sourceNamespaceSpecificUsings].filter(Boolean).join("\n");if(process.env.RACK_WEB_DEBUG_DEPENDENCIES&&sourceNamespaceSpecificUsings.length)console.error(JSON.stringify({sourceNamespaceSpecificUsings},null,2));
  prelude=insertExplicitSpecializationForwardDeclarations(prelude);
  let withoutInherited=(value)=>inherited.reduce((result,definition)=>removeOutOfLineDefinitions(removeClassDefinition(result,definition.name),definition.name),value),quantityHelpers=paramQuantityHelpers(prelude,body),rawStrippedPreludeSource=withoutInherited(stripUiHeaderIncludes(prelude,detected.sourceFiles,sourceDir)),rawStrippedPreludeReference=[rawStrippedPreludeSource,body,...implementations].join("\n"),rawStrippedPrelude=stripNativeUiReferencesByNames(stripNativeUiPointerReferences(stripRackUiBlocks(rawStrippedPreludeSource),rawStrippedPreludeSource,rawStrippedPreludeReference),detected.uiPointerNames??[]),strippedPrelude=[referencedVecDspHelpers(prelude,body),rawStrippedPrelude].filter(Boolean).join("\n\n"),missingQuantityHelpers=quantityHelpers.filter(helper=>plainStructBody(strippedPrelude,helper.name)===null).map(helper=>helper.source).join("\n\n"),sanguineReferences=[strippedPrelude,body].join("\n"),rgbLightColorUsed=/\bRGBLightColor\b/.test(sanguineReferences),browserStrippedPrelude=rgbLightColorUsed?removeClassDefinition(strippedPrelude,"RGBLightColor"):strippedPrelude,missingSanguineColorHelpers=[/\brgbColorToInt\s*\(/.test(sanguineReferences)&&!/\brgbColorToInt\s*\([^;{}]*\)\s*\{/.test(browserStrippedPrelude)?"inline unsigned int rgbColorToInt(uint8_t red, uint8_t green, uint8_t blue, uint8_t alpha = 255) { return (unsigned(alpha) << 24) + (unsigned(blue) << 16) + (unsigned(green) << 8) + unsigned(red); }":"",rgbLightColorUsed?"struct RGBLightColor { float red; float green; float blue; };":""].filter(Boolean).join("\n"),safePrelude=dedupeFreeFunctionDefinitions(stripPluginInitFunctions(stripOrphanPreprocessorEnds([missingSanguineColorHelpers,browserStrippedPrelude,missingQuantityHelpers].filter(Boolean).join("\n\n")))),inheritedPreludeNames=new Set(qualifiedTypeDefinitionRecords(safePrelude).map(record=>record.key)),inheritedImplementationDefinitions=new Set(declaredTypeNames(safePrelude).flatMap(name=>outOfLineDefinitions(safePrelude,name))),inheritedSource=stripUiNamespaces(inherited.map(definition=>{const basePrelude=dedupeTypeDefinitions(stripRackUiBlocks(adaptDailyFortuneHost(stripHeaderGuardOpen(withoutInherited(definition.prelude)))),inheritedPreludeNames),baseBody=stripUiClassMembers(adaptDailyFortuneHost(definition.body)).replace(/=\s*getDefault(?:Dark)?Theme\s*\(\s*\)/g,"= 0").replace(/\bstorage\s*->\s*(?:add|remove)ErrorListener\s*\(\s*this\s*\)\s*;/g,"").replace(/\bstatic\s+std::mutex\s+xtSurgeCreateMutex\s*;/,"inline static std::mutex xtSurgeCreateMutex;"),baseImplementations=[...(definition.supportImplementations??[]),...definition.implementations].filter(value=>!rackUiPattern.test(value)&&!inheritedImplementationDefinitions.has(value)&&inheritedImplementationDefinitions.add(value)),declared=definition.templateDeclaration?definition.declaredBases:definition.bases,bases=(declared??[]).map(base=>rackModuleBase(base)?"Module":base),open=(definition.namespace??[]).map(name=>`namespace ${name} {`).join("\n"),close=(definition.namespace??[]).map(()=>"}").reverse().join("\n");return`${open}${open?"\n":""}${basePrelude}${basePrelude?"\n":""}${definition.templateDeclaration?`${definition.templateDeclaration}\n`:""}struct ${definition.name} : ${bases.join(", ")} {${baseBody}\n};\n${baseImplementations.join("\n\n")}${close?"\n":""}${close}`}).filter(Boolean).join("\n\n")),isolatedBody=stripNativeUiReferencesByNames(stripNativeUiPointerBridges(detected.features.includes("expanders")&&!detected.expander?isolateDisconnectedExpanders(body):body,[body,...implementations].join("\n")),detected.uiPointerNames??[]),quantitySource=[safePrelude,inheritedSource,isolatedBody].join("\n"),availableQuantities=new Set(declaredTypeNames(quantitySource).filter(name=>classDefinitionSource(quantitySource,name)||new RegExp(`\\b(?:using\\s+${name}\\s*=|typedef\\s+[^;]+\s+${name}\\s*;)`).test(quantitySource))),adaptQuantity=(match,method,type)=>availableQuantities.has(baseTypeName(type))?match:`${method}<${method==="configSwitch"?"SwitchQuantity":"ParamQuantity"}>`;inheritedSource=inheritedSource.replace(/\b(configParam|configSwitch)\s*<\s*([A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)\s*>/g,adaptQuantity);let adaptedBody=isolatedBody.replace(/\b(configParam|configSwitch)\s*<\s*([A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)\s*>/g,adaptQuantity).replace(/\bCONFIG_STYLE\s*\(\s*([^)]+)\)/g,'configParam($1, 0.f, 5.f, 0.f, "Text Style")').replace(/\breadDefaultIntegerValue\s*\([^;()]*\)/g,"0").replace(/\bu8"/g,'"');if(/rack::simd::float_4/.test(adaptedBody))adaptedBody=adaptedBody.replace(/DecibelParamQuantity::ampToLinearSSE/g,"DecibelParamQuantity::ampToRackLinear");
  adaptedBody=adaptNativeUiBackedExpressionFields(adaptedBody,detected.uiPointerNames);
  if(target.key==="tapestry/Tapestry")adaptedBody+=`
  static constexpr int rackWebWaveBins = 90;
  static constexpr int rackWebMaxSplices = 300;
  static constexpr int rackWebHeaderValues = 5;
  static constexpr int rackWebSpliceOffset = rackWebHeaderValues;
  static constexpr int rackWebWaveOffset = rackWebSpliceOffset + rackWebMaxSplices;
  std::array<float, rackWebWaveOffset + rackWebWaveBins> rackWebTapestryVisual{};

  int rackWebVisualCount() const override {
    return static_cast<int>(rackWebTapestryVisual.size());
  }
  float* rackWebVisualBuffer() override {
    const auto& buffer = dsp.getBuffer();
    const size_t usedFrames = buffer.getUsedFrames();
    rackWebTapestryVisual.fill(0.f);
    rackWebTapestryVisual[0] = usedFrames > 0 ? 1.f : 0.f;
    rackWebTapestryVisual[1] = usedFrames > 0
      ? clamp(static_cast<float>(dsp.getGrainEngine().getPlayheadPosition() / usedFrames), 0.f, 1.f)
      : 0.f;
    const auto& spliceManager = dsp.getSpliceManager();
    rackWebTapestryVisual[2] = static_cast<float>(spliceManager.getCurrentIndex());
    rackWebTapestryVisual[3] = static_cast<float>(waveformColor);
    const auto& splices = spliceManager.getAllSplices();
    rackWebTapestryVisual[4] = static_cast<float>(
      std::min<size_t>(splices.size(), static_cast<size_t>(rackWebMaxSplices)));
    std::fill(rackWebTapestryVisual.begin() + rackWebSpliceOffset,
      rackWebTapestryVisual.begin() + rackWebWaveOffset, -1.f);
    if (usedFrames < 1) return rackWebTapestryVisual.data();
    for (size_t index = 0; index < splices.size() && index < rackWebMaxSplices; ++index)
      rackWebTapestryVisual[rackWebSpliceOffset + index] =
        clamp(static_cast<float>(splices[index].startFrame) / usedFrames, 0.f, 1.f);
    const float* samples = buffer.data();
    for (int bin = 0; bin < rackWebWaveBins; ++bin) {
      const size_t start = static_cast<size_t>(bin) * usedFrames / rackWebWaveBins;
      const size_t end = std::min(usedFrames,
        static_cast<size_t>(bin + 1) * usedFrames / rackWebWaveBins);
      float peak = 0.f;
      for (size_t frame = start; frame < end; ++frame)
        peak = std::max(peak,
          (std::fabs(samples[frame * 2]) + std::fabs(samples[frame * 2 + 1])) * .5f);
      rackWebTapestryVisual[rackWebWaveOffset + bin] = peak;
    }
    return rackWebTapestryVisual.data();
  }`;
  if(target.key==="Ohmer/KlokSpid")adaptedBody+=`
  float rackWebDmdVisual[70]{};
  int rackWebVisualCount() const override { return 70; }
  float* rackWebVisualBuffer() override {
    const char* labels[6] = {dmdTextMain1, dmdTextMain2, dmdTextMainOut1, dmdTextMainOut2, dmdTextMainOut3, dmdTextMainOut4};
    const int starts[6] = {0, 24, 48, 52, 56, 60};
    const int lengths[6] = {24, 24, 4, 4, 4, 4};
    for (int label = 0; label < 6; ++label)
      for (int index = 0; index < lengths[label]; ++index)
        rackWebDmdVisual[starts[label] + index] = static_cast<unsigned char>(labels[label][index]);
    rackWebDmdVisual[64] = static_cast<float>(dmdOffsetTextMain2);
    rackWebDmdVisual[65] = static_cast<float>(dmdOffsetTextOut1);
    rackWebDmdVisual[66] = static_cast<float>(dmdOffsetTextOut2);
    rackWebDmdVisual[67] = static_cast<float>(dmdOffsetTextOut3);
    rackWebDmdVisual[68] = static_cast<float>(dmdOffsetTextOut4);
    rackWebDmdVisual[69] = static_cast<float>(Theme);
    return rackWebDmdVisual;
  }`;
  if(target.key==="Chinenual-VCV/Harp")adaptedBody=adaptedBody.replace(/configParam\s*\(\s*NOTE_RANGE_PARAM\s*,\s*2\.f\s*,\s*16\.f\s*,\s*48\.f\s*,/,"configParam(NOTE_RANGE_PARAM, 2.f, 48.f, 48.f,");
  if(target.plugin==="Chinenual-VCV")adaptedBody=adaptedBody.replace(/configParam\s*\(\s*([^,]+)\s*,\s*0\.f\s*,\s*5\.f\s*,\s*0\.f\s*,\s*"Text Style"\s*\)/g,'configParam($1, 0.f, 4.f, 0.f, "Text Style")');
  if(target.key==="LyraeModules/Vega")adaptedBody=adaptedBody.replace(/(\bvoid\s+process\s*\(\s*const\s+ProcessArgs\s*&\s*args\s*\)\s*override\s*\{)/,`$1
    Module* rackWebBd383238 = leftExpander.module;
    auto rackWebBd383238Voltage = [&](int id) {
      if (!rackWebBd383238 || rackWebBd383238->model != modelBD383238 || !rackWebBd383238->inputs[id].isConnected()) return 0.f;
      return rackWebBd383238->inputs[id].getVoltage() / 10.f;
    };
    attack_time_from_expander = rackWebBd383238Voltage(0);
    attack_curve_from_expander = rackWebBd383238Voltage(1);
    decay_time_from_expander = rackWebBd383238Voltage(2);
    decay_curve_from_expander = rackWebBd383238Voltage(3);
    sustain_level_from_expander = rackWebBd383238Voltage(4);
    release_time_from_expander = rackWebBd383238Voltage(5);
    release_curve_from_expander = rackWebBd383238Voltage(6);`);
  if(target.key==="LyraeModules/Sheliak")adaptedBody=adaptedBody
    .replace(/\bbool\s+clockShiftBuffer\s*\[\s*10\s*\]/,"bool clockShiftBuffer[11]")
    .replace(/\bstd::fill_n\s*\(\s*clockShiftBuffer\s*,\s*10\s*,/,"std::fill_n(clockShiftBuffer, 11,")
    .replace(/\bfor\s*\(\s*int\s+i\s*=\s*9\s*;\s*i\s*>\s*0\s*;/,"for (int i = 10; i > 0;");
  if(target.key==="JW-Modules/BouncyBalls"){
    adaptedBody=adaptedBody
      .replace(/float\s+displayWidth\s*=\s*0\s*,\s*displayHeight\s*=\s*0\s*;/,"float displayWidth = 448.f, displayHeight = 376.f;")
      .replace("lights[PAD_ON_LIGHT].value = 1.0;","lights[PAD_ON_LIGHT].value = 1.0;\n        resetBalls();");
    adaptedBody+=`
  std::array<float, 12> rackWebBouncyVisual{};
  int rackWebVisualCount() const override { return static_cast<int>(rackWebBouncyVisual.size()); }
  float* rackWebVisualBuffer() override {
    for (int index = 0; index < 4; index++) {
      Vec center = balls[index].box.getCenter();
      rackWebBouncyVisual[index * 2] = center.x;
      rackWebBouncyVisual[index * 2 + 1] = center.y;
    }
    rackWebBouncyVisual[8] = paddle.box.pos.x;
    rackWebBouncyVisual[9] = paddle.box.pos.y;
    rackWebBouncyVisual[10] = paddle.visible ? 1.f : 0.f;
    rackWebBouncyVisual[11] = paddle.locked ? 1.f : 0.f;
    return rackWebBouncyVisual.data();
  }`;
  }
  if(target.key==="JW-Modules/FullScope"){
    adaptedBody=adaptedBody
      .replace(/\bfloat\s+lights\s*\[\s*4\s*\]\s*=\s*\{\s*\}\s*;/,"float rackWebStatusLights[4] = {};")
      .replace(/configParam\s*\(\s*TIME_PARAM\s*,\s*-6\.0\s*,\s*-16\.0\s*,\s*-14\.0\s*,/,"configParam(TIME_PARAM, -16.0, -6.0, -14.0,");
    implementations=implementations.map(value=>value.replace(/\blights\s*\[/g,"rackWebStatusLights["));
    adaptedBody+=`
  std::array<float, 1031> rackWebFullScopeVisual{};
  int rackWebVisualCount() const override { return static_cast<int>(rackWebFullScopeVisual.size()); }
  float* rackWebVisualBuffer() override {
    const float gainX = std::pow(2.f, std::round(params[X_SCALE_PARAM].getValue()));
    const float gainY = std::pow(2.f, std::round(params[Y_SCALE_PARAM].getValue()));
    const float offsetX = params[X_POS_PARAM].getValue();
    const float offsetY = params[Y_POS_PARAM].getValue();
    for (int index = 0; index < BUFFER_SIZE; index++) {
      const int source = lissajous ? (index + bufferIndex) % BUFFER_SIZE : index;
      rackWebFullScopeVisual[index] = (bufferX[source] + offsetX) * gainX / 10.f;
      rackWebFullScopeVisual[BUFFER_SIZE + index] = (bufferY[source] + offsetY) * gainY / 10.f;
    }
    rackWebFullScopeVisual[1024] = lissajous ? 1.f : 0.f;
    rackWebFullScopeVisual[1025] = inputs[COLOR_INPUT].isConnected() ? 1.f : 0.f;
    rackWebFullScopeVisual[1026] = inputs[COLOR_INPUT].getVoltage() / 6.f;
    rackWebFullScopeVisual[1027] = external ? 1.f : 0.f;
    rackWebFullScopeVisual[1028] = (params[ROTATION_PARAM].getValue() + inputs[ROTATION_INPUT].getVoltage()) / 20.f;
    rackWebFullScopeVisual[1029] = inputs[X_INPUT].isConnected() ? 1.f : 0.f;
    rackWebFullScopeVisual[1030] = inputs[Y_INPUT].isConnected() ? 1.f : 0.f;
    return rackWebFullScopeVisual.data();
  }`;
  }
  if(target.key==="JW-Modules/XYPad"){
    adaptedBody=adaptedBody
      .replace(/float\s+displayWidth\s*=\s*0\s*,\s*displayHeight\s*=\s*0\s*;/,"float displayWidth = 356.f, displayHeight = 300.f;")
      .replace("config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);",`config(NUM_PARAMS, NUM_INPUTS, NUM_OUTPUTS, NUM_LIGHTS);
        configParam(X_POS_PARAM, 12.f, 344.f, 178.f, "X Position");
        configParam(Y_POS_PARAM, 12.f, 288.f, 150.f, "Y Position");
        configParam(GATE_PARAM, 0.f, 1.f, 0.f, "Gate");`)
      .replace("configOutput(GATE_OUTPUT, \"Gate\");",`configOutput(GATE_OUTPUT, "Gate");
        updateMinMax();
        defaultPos();`);
    adaptedBody+=`
  std::vector<float> rackWebXYVisual;
  int rackWebVisualCount() const override { return 6 + static_cast<int>(std::min<size_t>(points.size(), 5000)) * 2; }
  float* rackWebVisualBuffer() override {
    const size_t count = std::min<size_t>(points.size(), 5000);
    rackWebXYVisual.resize(6 + count * 2);
    rackWebXYVisual[0] = params[X_POS_PARAM].getValue();
    rackWebXYVisual[1] = params[Y_POS_PARAM].getValue();
    rackWebXYVisual[2] = params[GATE_PARAM].getValue();
    rackWebXYVisual[3] = static_cast<float>(state);
    rackWebXYVisual[4] = displayWidth;
    rackWebXYVisual[5] = displayHeight;
    const size_t start = points.size() - count;
    for (size_t index = 0; index < count; index++) {
      rackWebXYVisual[6 + index * 2] = points[start + index].x;
      rackWebXYVisual[7 + index * 2] = points[start + index].y;
    }
    return rackWebXYVisual.data();
  }`;
  }
  if(["KautenjaDSP-PotatoChips/106","KautenjaDSP-PotatoChips/GBS"].includes(target.key)){
    adaptedBody+=`
public:
  std::array<float, NUM_WAVEFORMS * SAMPLES_PER_WAVETABLE> rackWebWavetableVisual{};
  int rackWebVisualCount() const override { return static_cast<int>(rackWebWavetableVisual.size()); }
  float* rackWebVisualBuffer() override {
    for (int table = 0; table < NUM_WAVEFORMS; table++)
      for (int sample = 0; sample < SAMPLES_PER_WAVETABLE; sample++)
        rackWebWavetableVisual[table * SAMPLES_PER_WAVETABLE + sample] = wavetable[table][sample];
    return rackWebWavetableVisual.data();
  }`;
  }
  if(target.key==="Chinenual-VCV/MIDIRecorder"){
    adaptedBody=adaptedBody
      .replace(/\bbool\s+mwIs14bit\s*;/,"bool mwIs14bit;\n        static constexpr int rackWebMidiCaptureCapacity = 4 * 1024 * 1024;\n        float rackWebMidiCapture[rackWebMidiCaptureCapacity]{};\n        int rackWebMidiCaptureFrames = 0;")
      .replace(/if\s*\(\s*path\s*==\s*""\s*\)\s*\{\s*INFO\s*\(\s*"ERROR: No Path in startRecording"\s*\)\s*;\s*return\s*;\s*\}/,"if (path == \"\") setPath(\"/Untitled.mid\");")
      .replace(/\bif\s*\(\s*incrementPath\s*\)\s*\{/,"if (false) {")
      .replace(/\bmidiFile\.write\s*\(\s*newPath\s*\)\s*;/,`std::ostringstream rackWebMidiStream(std::ios::binary | std::ios::out);
            midiFile.write(rackWebMidiStream);
            std::string rackWebMidiBytes = rackWebMidiStream.str();
            rackWebMidiCaptureFrames = std::min((int)rackWebMidiBytes.size(), rackWebMidiCaptureCapacity);
            for (int rackWebIndex = 0; rackWebIndex < rackWebMidiCaptureFrames; rackWebIndex++)
                rackWebMidiCapture[rackWebIndex] = (unsigned char)rackWebMidiBytes[rackWebIndex];`)
      .replace(/\brunRequested\s*=\s*recClicked\s*;/,"runRequested = recClicked || params[RUN_PARAM].getValue() > 0.5f;")
      .replace(/\bsmf::MidiEvent\s+event\s*\(\s*clock\.tick\s*,\s*track\s*,\s*msg\s*\)\s*;/,"smf::MidiMessage rackWebMessage = msg;\n                            smf::MidiEvent event(clock.tick, track, rackWebMessage);")
      .replace(/\bif\s*\(\s*!wasRunning\s*\)\s*\{\s*startRecording\s*\(\s*args\s*\)\s*;/,"if (!wasRunning) { if (path == \"\") setPath(\"/Untitled.mid\"); startRecording(args);")
      .replace(/json_object_set_new\s*\(\s*rootJ\s*,\s*"alignToFirstNote"\s*,\s*json_boolean\s*\(\s*alignToFirstNote\s*\)\s*\)\s*;/,`json_object_set_new(rootJ, "alignToFirstNote", json_boolean(alignToFirstNote));
            json_object_set_new(rootJ, "cvConfigVel", json_integer(cvConfigVel));
            json_object_set_new(rootJ, "cvConfigAft", json_integer(cvConfigAft));
            json_object_set_new(rootJ, "cvConfigPw", json_integer(cvConfigPw));
            json_object_set_new(rootJ, "cvConfigMw", json_integer(cvConfigMw));
            json_object_set_new(rootJ, "mwIs14bit", json_boolean(mwIs14bit));`)
      .replace(/(\bjson_t\s*\*\s*alignToFirstNoteJ[\s\S]*?alignToFirstNote\s*=\s*json_boolean_value\s*\(\s*alignToFirstNoteJ\s*\)\s*;)/,`$1
            if (json_t* value = json_object_get(rootJ, "cvConfigVel")) cvConfigVel = (CVRangeIndex)json_integer_value(value);
            if (json_t* value = json_object_get(rootJ, "cvConfigAft")) cvConfigAft = (CVRangeIndex)json_integer_value(value);
            if (json_t* value = json_object_get(rootJ, "cvConfigPw")) cvConfigPw = (CVRangeIndex)json_integer_value(value);
            if (json_t* value = json_object_get(rootJ, "cvConfigMw")) cvConfigMw = (CVRangeIndex)json_integer_value(value);
            if (json_t* value = json_object_get(rootJ, "mwIs14bit")) mwIs14bit = json_boolean_value(value);`);
    adaptedBody+=`
  int rackWebCaptureCapacity() const override { return rackWebMidiCaptureCapacity; }
  float* rackWebCaptureBuffer() override { return rackWebMidiCapture; }
  int rackWebCaptureFrames() const override { return rackWebMidiCaptureFrames; }
  int rackWebCaptureChannels() const override { return 1; }
  bool rackWebCaptureActive() const override { return running || rackWebMidiCaptureFrames > 0; }
  void rackWebConsumeCapture(int frames) override { if (frames >= rackWebMidiCaptureFrames) rackWebMidiCaptureFrames = 0; }
  void rackWebSetCaptureEnabled(bool enabled) override {
    recClicked = enabled;
    params[RUN_PARAM].setValue(enabled ? 1.f : 0.f);
    if (enabled && path == "") setPath("/Untitled.mid");
    if (!enabled && running) { ProcessArgs args; stopRecording(args); }
  }`;
  }
  if(target.key==="HarmonicAnomalies/HexNut"||target.key==="HarmonicAnomalies/HexaGrain")adaptedBody+=`
  std::vector<float> rackWebHexVisual;
  int rackWebVisualCount() const override { return hex ? 2 + hex->length * 3 : 0; }
  float* rackWebVisualBuffer() override {
    const int count = rackWebVisualCount();
    rackWebHexVisual.resize(count);
    if (!hex || count < 2) return nullptr;
    rackWebHexVisual[0] = static_cast<float>(hex->writeCursor);
    rackWebHexVisual[1] = static_cast<float>(hex->readCursor);
    for (int index = 0; index < hex->length; index++) {
      const Tile& tile = hex->tiles[index];
      rackWebHexVisual[2 + index * 3] = tile.v;
      rackWebHexVisual[3 + index * 3] = tile.writ;
      rackWebHexVisual[4 + index * 3] = tile.read;
      hex->decayTile(index);
    }
    return rackWebHexVisual.data();
  }`;
  if(target.key==="HetrickCVGPL/PhasorWavetable")adaptedBody+=`
  std::array<float, 132> rackWebWavetableVisual{};
  int rackWebVisualCount() const override { return static_cast<int>(rackWebWavetableVisual.size()); }
  float* rackWebVisualBuffer() override {
    rackWebWavetableVisual.fill(0.f);
    const size_t waveCount = wavetable.getWaveCount();
    rackWebWavetableVisual[0] = wavetable.filename == "Basic.wav" ? 0.f : 1.f;
    rackWebWavetableVisual[1] = lastPos;
    rackWebWavetableVisual[2] = static_cast<float>(waveCount);
    if (wavetable.waveLen < 2 || waveCount < 1) return rackWebWavetableVisual.data();
    const float position = clamp(lastPos, 0.f, static_cast<float>(waveCount - 1));
    const size_t wave0 = static_cast<size_t>(std::floor(position));
    const size_t wave1 = std::min(wave0 + 1, waveCount - 1);
    const float mix = position - static_cast<float>(wave0);
    for (size_t point = 0; point <= 128; ++point) {
      const size_t sample = point == 128 ? 0 : point * wavetable.waveLen / 128;
      rackWebWavetableVisual[3 + point] = crossfade(wavetable.at(wave0, sample), wavetable.at(wave1, sample), mix);
    }
    return rackWebWavetableVisual.data();
  }`;
  if(target.key==="ImpromptuModular/Four-View")adaptedBody+=`
  std::array<float, 20> rackWebFourViewVisual{};
  int rackWebVisualCount() const override { return static_cast<int>(rackWebFourViewVisual.size()); }
  float* rackWebVisualBuffer() override {
    for (int index = 0; index < 4; index++) rackWebFourViewVisual[index] = displayValues[index];
    for (int index = 0; index < 16; index++) rackWebFourViewVisual[4 + index] = static_cast<unsigned char>(displayChord[index]);
    return rackWebFourViewVisual.data();
  }`;
  const inheritedDefineReferences=inherited.flatMap(definition=>[definition.body,...(definition.supportImplementations??[]),...definition.implementations]);
  const bodyDefineSource=referencedDefines(detected.sourceFiles??[],[body,...implementations,...inheritedDefineReferences].join("\n"),sourceDir),requiredBodyDefines=bodyDefineSource.split("\n").filter(line=>{const name=/^\s*#\s*define\s+([A-Za-z_]\w*)/.exec(line)?.[1];return name&&!new RegExp(`^\\s*#\s*define\\s+${name}\\b`,"m").test(safePrelude)}).join("\n");
  if(process.env.RACK_WEB_DEBUG_DEPENDENCIES)console.error(JSON.stringify({inherited:inherited.map(item=>item.name),preludeTypes:declaredTypeNames(prelude),strippedPreludeTypes:declaredTypeNames(strippedPrelude)},null,2));
  const rackWebCounts=Object.fromEntries(["params","inputs","outputs","lights"].map(key=>[key,detected.counts?.[key]??enumCount(detected.enums?.[key],countConstants)])),selfModelSymbol=(detected.expander?.models??[]).find(model=>model.key===target.key)?.symbol;
  adaptedBody+=`\npublic:\n  static constexpr int rackWebParamCount = ${rackWebCounts.params};\n  static constexpr int rackWebInputCount = ${rackWebCounts.inputs};\n  static constexpr int rackWebOutputCount = ${rackWebCounts.outputs};\n  static constexpr int rackWebLightCount = ${rackWebCounts.lights};${selfModelSymbol?`\n  rack::plugin::Model* rackWebSelfModel() override { return ${selfModelSymbol}; }`:""}`;
  const directTargetBases=[detected.inheritance?.directBase,...(detected.inheritance?.secondaryBases??[])].filter(Boolean),resolvedTargetBases=directTargetBases.map(base=>rackModuleBase(base)?(className==="Module"?"::Module":"Module"):resolveTypeAliases(detected.sourceFiles??[],base)),actualTargetBase=resolvedTargetBases[0]??(className==="Module"?"::Module":"Module"),secondaryBases=resolvedTargetBases.slice(1),inheritedTypeNames=[...new Set(inherited.map(definition=>definition.name))],safePreludeTypeNames=declaredTypeNames(safePrelude),delayedDefinition=name=>enumDeclarationSource(safePrelude,name)||classDefinitionSource(safePrelude,name),delayedTypeSet=new Set(inheritedTypeNames);for(let pass=0;pass<safePreludeTypeNames.length;pass++){const before=delayedTypeSet.size;for(const name of safePreludeTypeNames){const dependencySource=[...declaredBases(safePrelude,name),delayedDefinition(name),...outOfLineDefinitions(safePrelude,name)].join("\n");if([...delayedTypeSet].some(delayed=>new RegExp(`\\b${delayed}\\b`).test(dependencySource)))delayedTypeSet.add(name)}if(delayedTypeSet.size===before)break}const delayedTypeNames=safePreludeTypeNames.filter(name=>delayedTypeSet.has(name)&&!inheritedTypeNames.includes(name)),lateDefinitions=delayedTypeNames.map(delayedDefinition).filter(Boolean),lateImplementations=[...new Set(delayedTypeNames.flatMap(name=>outOfLineDefinitions(safePrelude,name)))],delayedBlocks=delayedTypeNames.map(name=>{const definition=delayedDefinition(name),implementation=outOfLineDefinitions(safePrelude,name).join("\n\n"),content=[definition,implementation].filter(Boolean).join("\n\n"),namespaces=enclosingNamespaces(safePrelude,name),open=namespaces.length?`namespace ${namespaces.join("::")} {\n`:"",close=namespaces.length?"\n}":"";return content?`${open}${content}${close}`:""}).filter(Boolean),targetAliasNames=directTargetBases.map(baseTypeName),aliasDeclarations=[...safePrelude.matchAll(/\btypedef\s+[^;]+\s+([A-Za-z_]\w*)\s*;|\busing\s+([A-Za-z_]\w*)\s*=\s*[^;]+;/g)].map(match=>({name:match[1]??match[2],source:match[0]})),lateAliases=aliasDeclarations.filter(alias=>!targetAliasNames.includes(alias.name)&&[...inheritedTypeNames,...delayedTypeNames].some(name=>new RegExp(`\\b${name}\\b`).test(alias.source))).map(alias=>alias.source),removedPreludeFragments=[...lateDefinitions,...lateImplementations,...lateAliases,...aliasDeclarations.filter(alias=>targetAliasNames.includes(alias.name)).map(alias=>alias.source)],unaliasedEarlyPreludeCandidate=stripUiNamespaces(removedPreludeFragments.reduce((value,fragment)=>value.replace(fragment,""),safePrelude)).replace(/\bnamespace\s+simd\s*\{\s*\}/g,"").replace(/^\s*(?:(?:inline|static)\s+)*(?:const\s+|constexpr\s+)(?:float|double)\s+_(?:PI|2_PI)\s*=[^;]+;\s*$/gm,"").trim(),deferredNamespaceAliases=[...unaliasedEarlyPreludeCandidate.matchAll(/^\s*namespace\s+[A-Za-z_]\w*\s*=\s*[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*\s*;\s*$/gm)].map(match=>match[0].trim()),earlyPreludeCandidate=deferredNamespaceAliases.reduce((value,alias)=>value.replace(alias,""),unaliasedEarlyPreludeCandidate).trim(),targetDeferredPrelude=deferFreeFunctionsReferencingTypes(earlyPreludeCandidate,[className]),deferredEarlyPrelude=deferFreeFunctionsReferencingTypes(targetDeferredPrelude.source,inheritedTypeNames),earlyPrelude=deferredEarlyPrelude.source,deferredEarlyDefinitions=deferredEarlyPrelude.definitions,targetDeferredDefinitions=targetDeferredPrelude.definitions;
  lateAliases.unshift(...(detected.targetGlobalEnumDeclarations??[]),...(detected.targetNamespaceGlobals??[]));
  const browserSecondaryBases=secondaryBases.filter((base,index)=>!uiSecondaryBase(detected.sourceFiles??[],directTargetBases[index+1]??base));
  secondaryBases.splice(0,secondaryBases.length,...browserSecondaryBases);
  const sourceNamespaceAliasReferences=[registration.moduleClass,body,...implementations,directTargetBases.join("\n")].join("\n"),sourceNamespaceAliases=[...new Set((detected.sourceFiles??[]).flatMap(file=>[...fs.readFileSync(file,"utf8").matchAll(/^\s*namespace\s+([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)\s*;\s*$/gm)].filter(match=>new RegExp(`\\b${match[1]}\\s*::`).test(sourceNamespaceAliasReferences)).map(match=>match[0].trim())))],allDeferredNamespaceAliases=[...new Set([...deferredNamespaceAliases,...sourceNamespaceAliases])];
  allDeferredNamespaceAliases.unshift(...(detected.targetSourceFreeFunctionSupport??[]));
  const finalSanguineReferences=[earlyPrelude,inheritedSource,...deferredEarlyDefinitions,...delayedBlocks,body].join("\n"),finalSanguineColorHelpers=[/\brgbColorToInt\s*\(/.test(finalSanguineReferences)&&!/\brgbColorToInt\s*\([^;{}]*\)\s*\{/.test(finalSanguineReferences)?"inline unsigned int rgbColorToInt(uint8_t red, uint8_t green, uint8_t blue, uint8_t alpha = 255) { return (unsigned(alpha) << 24) + (unsigned(blue) << 16) + (unsigned(green) << 8) + unsigned(red); }":"",/\bRGBLightColor\b/.test(body)&&plainStructBody(finalSanguineReferences,"RGBLightColor")===null?"struct RGBLightColor { float red; float green; float blue; };":""].filter(Boolean).join("\n"),pluginDspReferences=[finalSanguineReferences,...implementations].join("\n"),pluginDspHelpers=[/(^|[^:\w])vector\s*</m.test(pluginDspReferences)?"using std::vector;":"",/(^|[^:\w])list\s*</m.test(pluginDspReferences)?"using std::list;":"",/\bint32_4\b/.test(pluginDspReferences)?"using rack::simd::int32_4;":"",/(^|[^:\w])make_unique\s*</m.test(pluginDspReferences)?"using std::make_unique;":"",/\bpreset_version_key\b/.test(pluginDspReferences)&&!/\bpreset_version_key\s*=/.test(pluginDspReferences)?'static constexpr const char* preset_version_key = "preset_version";':"",/\bMOOG_PI\b/.test(pluginDspReferences)&&!/(?:#\s*define\s+MOOG_PI\b|\b(?:constexpr|const)\b[^;\n]*\bMOOG_PI\s*=)/.test(pluginDspReferences)?"inline constexpr double MOOG_PI = 3.14159265358979323846;":"",/\bexponentialBipolar80Pade_5_4\s*\(/.test(pluginDspReferences)&&!/\bexponentialBipolar80Pade_5_4\s*\([^;{}]*\)\s*\{/.test(pluginDspReferences)?`template <typename T> T exponentialBipolar80Pade_5_4(T x) { return (T(0.109568) * x + T(0.281588) * simd::pow(x, 3) + T(0.133841) * simd::pow(x, 5)) / (T(1.) - T(0.630374) * simd::pow(x, 2) + T(0.166271) * simd::pow(x, 4)); }`:"",/\bsin2pi_pade_05_5_4\s*\(/.test(pluginDspReferences)&&!/\bsin2pi_pade_05_5_4\s*\([^;{}]*\)\s*\{/.test(pluginDspReferences)?`template <typename T> T sin2pi_pade_05_5_4(T x) { x -= 0.5f; return (T(-6.283185307) * x + T(33.19863968) * simd::pow(x, 3) - T(32.44191367) * simd::pow(x, 5)) / (1 + T(1.296008659) * simd::pow(x, 2) + T(0.7028072946) * simd::pow(x, 4)); }`:"",/\bclip\s*\(/.test(body)&&!/\bclip\s*\([^;{}]*\)\s*\{/.test(pluginDspReferences)?`template <typename T> static T clip(T x) { const T limit = 1.16691853009184f; x = clamp(x * 0.1f, -limit, limit); return 10.0f * (x + 1.45833f * simd::pow(x, 13) + 0.559028f * simd::pow(x, 25) + 0.0427035f * simd::pow(x, 37)) / (1.0f + 1.54167f * simd::pow(x, 12) + 0.642361f * simd::pow(x, 24) + 0.0579909f * simd::pow(x, 36)); }`:"",/\bSaturator\s*</.test(body)&&plainStructBody(pluginDspReferences,"Saturator")===null?`template <class T> struct Saturator { static T process(T sample) { return simd::ifelse(sample < 0.f, -saturation(-sample), saturation(sample)); } private: static T saturation(T sample) { const float limit = 1.05f; const float y1 = 0.98765f; const float offset = 0.0062522f; T x = sample / limit; T x1 = (x + 1.0f) * 0.5f; return limit * (offset + x1 - simd::sqrt(x1 * x1 - y1 * x) * (1.0f / y1)); } };`:""].filter(Boolean).join("\n\n"),owlProgramHost=(detected.sourceFiles??[]).some(file=>path.basename(file)==="ProgramVector.h")?`#include "ProgramVector.h"\nextern "C" ProgramVector programVector{.hardware_version = OWL_RACK_HARDWARE, .audio_format = AUDIO_FORMAT_24B32_2X, .audio_blocksize = 32, .audio_samplingrate = 48000};\nextern "C" void doMidiSend(uint8_t, uint8_t, uint8_t, uint8_t) {}`:"",siblingExclusions=new Set([className,...inherited.map(definition=>definition.name),...safePreludeTypeNames.filter(name=>classDefinitionSource(safePrelude,name))]),siblingDefinitions=[...new Map([...referencedSiblingModuleDefinitions(detected.sourceFiles??[],[body,...implementations].join("\n"),siblingExclusions),...expanderSiblingModuleDefinitions(detected.rootSourceFiles??detected.sourceFiles??[],detected.expander?.models,siblingExclusions)].map(definition=>[definition.name,definition])).values()],adaptSiblingBody=value=>value.replace(/\b(configParam|configSwitch)\s*<\s*([A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)\s*>/g,adaptQuantity).replace(/^[^\n;]*\bNumberSvg\s*\([^;\n]*;[ \t]*(?:\n|$)/gm,""),siblingSource=siblingDefinitions.map(definition=>`struct ${definition.name} : ${definition.base} {${adaptSiblingBody(definition.body)}\n};`).join("\n\n"),exportType=templateExport?"RackWebModule":webType,countFor=key=>detected.counts?.[key]??enumCount(detected.enums?.[key],detected.constants);
  const abiSource=rackWebAbiSource(exportType,Object.fromEntries(["params","inputs","outputs","lights"].map(key=>[key,countFor(key)])));
  let emittedImplementationSource=[earlyPrelude,inheritedSource,...deferredEarlyDefinitions,...delayedBlocks].join("\n\n");const uniqueImplementations=[];for(const original of implementations){if(!original.trim()||emittedImplementationSource.includes(original))continue;let value=original;for(const definition of referencedLocalFreeFunctionDefinitions(original,original))if(emittedImplementationSource.includes(definition))value=value.replace(definition,"");if(!value.trim()||emittedImplementationSource.includes(value))continue;uniqueImplementations.push(value);emittedImplementationSource+=`\n\n${value}`}implementations=[...targetDeferredDefinitions,...uniqueImplementations];
  return `// Automatically isolated from the original Rack DSP module for ${target.key}.\n// Source: ${manifest.sourceUrl} (${definitionFile}; registered in ${registrationFile})\n// License: ${license}\n\n${rackWebExportInclude}\n${singleHeaderImplementations}${singleHeaderImplementations?"\n\n":""}${hostCompatibilityPrelude}${hostCompatibilityPrelude?"\n":""}${hostModelStubs}${hostModelStubs?"\n\n":""}${finalSanguineColorHelpers}${finalSanguineColorHelpers?"\n\n":""}${pluginDspHelpers}${pluginDspHelpers?"\n\n":""}${requiredBodyDefines}${requiredBodyDefines?"\n\n":""}${sourceNamespacePrelude}${sourceNamespacePrelude?"\n\n":""}${earlyPrelude}${earlyPrelude?"\n\n":""}${owlProgramHost}${owlProgramHost?"\n\n":""}${inheritedSource}${inheritedSource?"\n\n":""}${allDeferredNamespaceAliases.join("\n")}${allDeferredNamespaceAliases.length?"\n\n":""}${deferredEarlyDefinitions.join("\n\n")}${deferredEarlyDefinitions.length?"\n\n":""}${delayedBlocks.join("\n\n")}${delayedBlocks.length?"\n\n":""}${familyDeferredPrelude}${familyDeferredPrelude?"\n\n":""}${namespaceOpen}${namespaceOpen?"\n":""}${lateAliases.join("\n")}${lateAliases.length?"\n\n":""}${siblingSource}${siblingSource?"\n\n":""}${templateDeclaration?`${templateDeclaration}\n`:""}struct ${className} : ${[actualTargetBase,...secondaryBases].join(", ")} {${adaptedBody}\n${aliases}${aliases?"\n":""}${stateMethod}${stateMethod?"\n":""}${actionMethod}${actionMethod?"\n":""}${assetMethods}${assetMethods?"\n":""}${objectExpanderMethods(detected)}${neighborModelMethods(detected,siblingDefinitions,modelReferenceSource)}};\n${implementations.join("\n\n")}${implementations.length?"\n":""}${vcoSpecializations}${vcoSpecializations?"\n":""}${fxSpecializations}${fxSpecializations?"\n":""}${namespaceClose}${namespaceClose?"\n":""}\n${templateExport?`using RackWebModule = ${webType};\n`:""}${abiSource}\n`;
}
function replaceOutOfLineMethod(source,className,method,replacement){const owner=baseTypeName(className),candidate=rustSourceDeclarations(source).outOfLineDefinitions.find(definition=>definition.kind==="function"&&definition.owner===owner&&definition.member===method);return candidate?source.slice(0,candidate.start)+replacement+source.slice(candidate.end):source}
function adaptThreadedAnalyzers(source){for(const className of declaredTypeNames(source)){const body=plainStructBody(source,className);if(!body||!body.includes("std::thread")||!body.includes("_analyzer")||!body.includes("_currentOutBuf")||!body.includes("_averagedBins")||!body.includes("void step(float sample)"))continue;const escaped=className.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");source=source.replace(new RegExp(`,\\s*_worker\\s*\\(\\s*&${escaped}::work\\s*,\\s*this\\s*\\)`),"").replace(/\b_worker\.join\s*\(\s*\)\s*;/g,"if (_worker.joinable()) _worker.join();");source=replaceOutOfLineMethod(source,className,"step",`void ${className}::step(float sample) {\n\tif (!_analyzer.step(sample)) return;\n\t_analyzer.process();\n\t_analyzer.postProcess();\n\tfloat* bins = _currentBins == _bins0 ? _bins1 : _bins0;\n\tif (_averagedBins) {\n\t\tfloat* frame = _averagedBins->getInputFrame();\n\t\t_analyzer.getMagnitudes(frame, _binsN);\n\t\t_averagedBins->commitInputFrame();\n\t\tconst float* averages = _averagedBins->getAverages();\n\t\tstd::copy(averages, averages + _binsN, bins);\n\t}\n\telse {\n\t\t_analyzer.getMagnitudes(bins, _binsN);\n\t}\n\t_currentBins = bins;\n\t_currentOutBuf = _currentBins;\n}`)}return source}
function stripEmbeddedResourceDocumentation(source){
  source=source.replace(/^[ \t]*CMRC_DECLARE\s*\([^;\n]*\)\s*;[ \t]*$/gm,"");
  const replacements=[];
  for(const candidate of rustSourceDeclarations(source).outOfLineDefinitions){
    if(candidate.kind!=="function"||candidate.callableKind!=="function"||!/\bstd::string\s+[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*::/.test(candidate.signature))continue;
    const body=sourceWithoutCommentsAndLiterals(source.slice(candidate.bodyStart,candidate.bodyEnd));
    if(!/\bcmrc::[A-Za-z_]\w*::get_filesystem\s*\(/.test(body))continue;
    replacements.push([candidate.bodyStart-1,candidate.bodyEnd+1,"{ return \"\"; }"]);
  }
  for(const [start,end,replacement] of replacements.reverse())source=source.slice(0,start)+replacement+source.slice(end);
  return source;
}
function airwinRegistryEntries(sourceDir){
  const file=path.join(sourceDir,"src","ModuleAdd.h");
  if(!fs.existsSync(file))return[];
  const entries=[];
  for(const line of fs.readFileSync(file,"utf8").split("\n")){
    const match=/^\s*int\s+([A-Za-z_]\w*)\s*=\s*(AirwinRegistry::registerAirwindow\s*\(\s*\{\s*"([^"]+)"[\s\S]*\}\s*\))\s*;\s*$/.exec(line);
    if(!match)continue;
    const expression=match[2],open=expression.indexOf("{"),close=expression.lastIndexOf("}"),values=open>=0&&close>open?splitArguments(expression.slice(open+1,close)):[],parameterType=/airwinconsolidated::([A-Za-z_]\w*)::kNumParameters/.exec(values[5]??"")?.[1]??match[3],header=path.join(sourceDir,"src","autogen_airwin",`${parameterType}.h`),headerSource=fs.existsSync(header)?fs.readFileSync(header,"utf8"):"",nParams=numberLiteral(/\bkNumParameters\s*=\s*([^,\n}]+)/.exec(headerSource)?.[1],Number.POSITIVE_INFINITY),description=stringLiteral(values[4],"");
    entries.push({variable:match[1],expression,name:match[3],nParams,description,accepted:nParams<=10&&Boolean(description)});
  }
  return entries;
}
function singleGuardedIncludeMacro(source){const declarations=rustSourceDeclarations(source);for(const block of declarations.conditionalBlocks){if(block.open.kind!=="ifndef"||!block.open.simpleMacro||!block.close)continue;const open=completeSourceLineRange(source,block.openStart,block.openEnd),close=completeSourceLineRange(source,block.closeStart,block.closeEnd),includes=declarations.includeDirectives.filter(candidate=>!candidate.angle&&candidate.start>block.openEnd&&candidate.start<block.closeStart).map(candidate=>completeIncludeDirectiveLine(source,candidate)).filter(Boolean);if(!open||!close||includes.length!==1)continue;const include=includes[0];if(!source.slice(open.end,include.start).trim()&&!source.slice(include.end,close.start).trim())return block.open.simpleMacro}return null}
function airwinBrowserSuite(output,sourceDir,source){
  if(!/\bstruct\s+AW2RModule\s*:\s*/.test(source))return null;
  const directory=path.join(sourceDir,"src","autogen_airwin"),moduleAdd=path.join(sourceDir,"src","ModuleAdd.h"),entries=airwinRegistryEntries(sourceDir);
  if(!entries.length||!fs.existsSync(directory))return null;
  const inlined=new Set([...source.matchAll(/\bnamespace\s+airwinconsolidated::([A-Za-z_]\w*)/g)].map(match=>match[1]));
  const registered=new Set(entries.map(entry=>entry.name));
  const moduleAddSource=fs.readFileSync(moduleAdd,"utf8"),includes=rustSourceDeclarations(moduleAddSource).includeDirectives.filter(candidate=>!candidate.angle&&completeIncludeDirectiveLine(moduleAddSource,candidate)).map(candidate=>`#include ${JSON.stringify(path.resolve(path.dirname(moduleAdd),candidate.include))}`);
  const implementations=files(directory).filter(file=>{const basename=path.basename(file),effect=basename.replace(/Proc\.cpp$|\.cpp$/,""),processImplementation=/Proc\.cpp$/.test(basename);return/\.cpp$/.test(file)&&registered.has(effect)&&(!inlined.has(effect)||processImplementation)}).sort();
  const implementationIncludes=implementations.map(implementation=>{const source=fs.readFileSync(implementation,"utf8"),guard=singleGuardedIncludeMacro(source);return guard?[`#define ${guard} 1`,`#include ${JSON.stringify(implementation)}`,`#undef ${guard}`].join("\n"):`#include ${JSON.stringify(implementation)}`});
  const file=path.join(output,"airwin_suite_browser.cpp");
  fs.writeFileSync(file,[
    "// Browser unity build for the complete official Airwindows registry.",
    '#include "AirwinRegistry.h"',
    ...includes,
    "void rackWebEnsureAirwinRegistry() {",
    "  static const bool initialized = [] {",
    ...entries.map(entry=>`    (void)${entry.expression};`),
    "    AirwinRegistry::completeRegistry();",
    "    return true;",
    "  }();",
    "  (void)initialized;",
    "}",
    ...implementationIncludes,
    "",
  ].join("\n"));
  source=source.replace('#include "rack_web_export.hpp"','#include "rack_web_export.hpp"\n\nvoid rackWebEnsureAirwinRegistry();');
  source=source.replace(/(\bAW2RModule\s*\(\s*\)\s*\{)/,"$1\n        rackWebEnsureAirwinRegistry();");
  return{file,source,effectNames:entries.filter(entry=>entry.accepted).map(entry=>entry.name),inlined:[...inlined]};
}
function stubInlineVoidMethod(source,name){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),signature=new RegExp(`\\bvoid\\s+${escaped}\\s*\\([^)]*\\)(?:\\s+override)?$`),candidate=rustSourceDeclarations(source).inlineMemberDefinitions.find(definition=>definition.member===name&&signature.test(definition.signature));return candidate?source.slice(0,candidate.bodyStart)+source.slice(candidate.bodyEnd):source}
function stripSurgeRackCustomEditor(source){const candidate=rustSourceDeclarations(source).outOfLineDefinitions.find(definition=>definition.kind==="function"&&definition.callableKind==="function"&&definition.owner==="VCOConfig"&&definition.member==="createCustomEditorAt"&&/^template\s*<\s*>/.test(definition.rawDefinition)&&/\brack::Widget\s*\*/.test(definition.signature));return candidate?source.slice(0,candidate.start)+source.slice(candidate.end):source}
function adaptSurgeDynamicParameterNames(source){if(!/\bVCO\s*<\s*ot_twist\s*>/.test(source))return source;return source.replace("paramNames[i] = oscstorage->p[i].get_name();","paramNames[i] = oscstorage->p[i].dispname;").replaceAll("return par->get_name();","return par->dispname;").replace("modAssist.initialize(this);\n        snapCalculatedNames();","modAssist.initialize(this);\n        /* Browser metadata uses the stable catalog names. */")}
function adaptSurgeBuiltinWavetable(source,sourceDir){const target=surgeOscillatorTarget(source);if(!["WavetableOscillator","WindowOscillator"].includes(target))return source;const anchor="oscstorage_display = &(storage->getPatch().scene[0].osc[1]);";if(!source.includes(anchor))return source;if(target==="WindowOscillator"){const asset=relative=>Array.from(fs.readFileSync(path.join(sourceDir,relative))).join(","),wave=asset("surge/resources/data/wavetables/Generated/Sine Windowed.wt"),windows=asset("surge/resources/surge-shared/windows.wt");return source.replace(anchor,`${anchor}
        {
            static const unsigned char rackWebWindowWave[] = {${wave}};
            static const unsigned char rackWebWindowFunctions[] = {${windows}};
            storage->load_wt_wt_mem(reinterpret_cast<const char *>(rackWebWindowWave), sizeof(rackWebWindowWave), &oscstorage->wt);
            oscstorage_display->wt.Copy(&oscstorage->wt);
            storage->load_wt_wt_mem(reinterpret_cast<const char *>(rackWebWindowFunctions), sizeof(rackWebWindowFunctions), &storage->WindowWT);
            oscstorage->wt.current_id = 0;
            oscstorage_display->wt.current_id = 0;
            wavetableCount = oscstorage->wt.n_tables;
        }`)}return source.replace(anchor,`${anchor}
        {
            constexpr int rackWebTableSize = 2048;
            std::array<float, rackWebTableSize * 2> rackWebTableData{};
            for (int i = 0; i < rackWebTableSize; ++i)
            {
                rackWebTableData[i] = std::sin(2.f * 3.14159265358979323846f * i / rackWebTableSize);
                rackWebTableData[rackWebTableSize + i] = 2.f * i / rackWebTableSize - 1.f;
            }
            wt_header rackWebTableHeader{};
            rackWebTableHeader.tag[0] = 'v'; rackWebTableHeader.tag[1] = 'a';
            rackWebTableHeader.tag[2] = 'w'; rackWebTableHeader.tag[3] = 't';
            rackWebTableHeader.n_samples = rackWebTableSize;
            rackWebTableHeader.n_tables = 2;
            oscstorage->wt.BuildWT(rackWebTableData.data(), rackWebTableHeader, false);
            oscstorage_display->wt.Copy(&oscstorage->wt);
            oscstorage->wt.current_id = 0;
            oscstorage_display->wt.current_id = 0;
            wavetableCount = 2;
        }`)}
function makefileCompileDefinitions(sourceDir){return rustMakefileAnalysis(sourceDir).compileDefinitions}
function makefileIncludeDirectories(sourceDir){return rustMakefileAnalysis(sourceDir).includeDirectories}
function makefileImplementationSources(sourceDir){return rustMakefileAnalysis(sourceDir).implementationSources}
function chuckEmscriptenImplementationSources(sourceDir){
  return rustMakefileAnalysis(sourceDir,"chuck/src/makefile",["EMSCRIPTENSRCS"]).implementationSources
}
function browserRuntimeImplementationSources(sourceDir,sourceFiles,candidates){
  const usesChucK=sourceFiles.some(file=>path.basename(file)==="chuck_def.h"&&/\b__PLATFORM_EMSCRIPTEN__\b/.test(fs.readFileSync(file,"utf8")));
  if(!usesChucK)return candidates;
  const emscriptenSources=chuckEmscriptenImplementationSources(sourceDir),authoredSources=new Set(emscriptenSources.length?emscriptenSources:makefileImplementationSources(sourceDir));if(!authoredSources.size)return candidates;
  const runtimeRoot=path.join(path.resolve(sourceDir),"chuck","src","core"),runtimePrefix=`${runtimeRoot}${path.sep}`;
  for(let index=candidates.length-1;index>=0;index--){const resolved=path.resolve(candidates[index]);if((resolved===runtimeRoot||resolved.startsWith(runtimePrefix))&&!authoredSources.has(resolved))candidates.splice(index,1)}
  for(const file of authoredSources)if(file.startsWith(runtimePrefix)&&!candidates.includes(file))candidates.push(file);
  return candidates
}
function browserSafePinkTromboneSources(output,sources){
  const replacements=new Map;
  for(const original of sources){
    if(!original.split(path.sep).includes("PinkTrombone"))continue;
    const source=fs.readFileSync(original,"utf8");
    if(!/^\s*#include\s+"\.\.\/plugin\.hpp"\s*$/m.test(source))continue;
    const file=path.join(output,`pink_trombone_${path.basename(original)}`);
    fs.writeFileSync(file,source.replace(
      /^\s*#include\s+"\.\.\/plugin\.hpp"\s*$/m,
      '#include "rack_web.hpp"\nusing namespace rack;',
    ));
    replacements.set(original,file);
  }
  return replacements;
}
function cmakeCompileDefinitions(sourceDir){const definitions=[...rustCmakeAnalysis(sourceDir).compileDefinitions];if(fs.existsSync(path.join(sourceDir,"surge/libs/libsamplerate/src/src_sinc.c")))definitions.push("-DENABLE_SINC_FAST_CONVERTER=1");return[...new Set(definitions)]}
function surgeOscillatorTarget(source){const type=/\b(?:VCOConfig|VCO)\s*<\s*(ot_[A-Za-z0-9_]+)\s*>/.exec(source)?.[1],targets={ot_alias:"AliasOscillator",ot_audioinput:"AudioInputOscillator",ot_classic:"ClassicOscillator",ot_FM2:"FM2Oscillator",ot_FM3:"FM3Oscillator",ot_modern:"ModernOscillator",ot_shnoise:"SampleAndHoldOscillator",ot_sine:"SineOscillator",ot_string:"StringOscillator",ot_twist:"TwistOscillator",ot_wavetable:"WavetableOscillator",ot_window:"WindowOscillator"};return targets[type]??null}
function specializedSurgeOscillatorFactory(output,source,allowGeneric=false){const target=surgeOscillatorTarget(source)??(allowGeneric?"SineOscillator":null);if(!target)return null;const file=path.join(output,"surge_oscillator_factory.cpp");fs.writeFileSync(file,`// Browser-specialized form of Surge XT Oscillator.cpp.\n#include "Oscillator.h"\n#include "${target}.h"\n#include "FxPresetAndClipboardManager.h"\n#include "ModulatorPresetManager.h"\n\nOscillator* spawn_osc(int, SurgeStorage* storage, OscillatorStorage* oscdata, pdata* localcopy, unsigned char* onto) { return new (onto) ${target}(storage, oscdata, localcopy); }\nOscillator::Oscillator(SurgeStorage* storage, OscillatorStorage* oscdata, pdata* localcopy) : master_osc(0) { assert(oscdata); this->storage = storage; this->oscdata = oscdata; this->localcopy = localcopy; ticker = 0; }\nOscillator::~Oscillator() {}\nint ensemble_stage_count() { return 7; }\nint stringosc_excitations_count() { return 15; }\nint alias_waves_count() { return 18; }\nstd::string stringosc_excitation_name(int i) { return "Excitation " + std::to_string(i + 1); }\nstd::string twist_engine_name(int i) { static const char* names[] = {"Waveforms","Waveshaper","2-Operator FM","Formant/PD","Harmonic","Wavetable","Chords","Vowels/Speech","Granular Cloud","Filtered Noise","Particle Noise","Inharmonic String","Modal Resonator","Analog Kick","Analog Snare","Analog Hi-Hat"}; return i >= 0 && i < 16 ? names[i] : "Error"; }\nstd::string ensemble_stage_name(int i) { static const char* names[] = {"Digital Delay","BBD 128 Stages","BBD 256 Stages","BBD 512 Stages","BBD 1024 Stages","BBD 2048 Stages","BBD 4096 Stages"}; return i >= 0 && i < 7 ? names[i] : "Error"; }\nconst char* alias_wave_name[] = {"Sine","Ramp","Pulse","Noise","Alias Mem","Osc Mem","Scene Mem","DAW Chunk Mem","Step Seq Mem","Audio In","TX 2 Wave","TX 3 Wave","TX 4 Wave","TX 5 Wave","TX 6 Wave","TX 7 Wave","TX 8 Wave","Additive"};\nint strnatcasecmp(const char* left, const char* right) { return strcasecmp(left, right); }\nnamespace Surge::Debug { void stackTraceToStdout(int) {} }\nnamespace Surge::Storage { void FxUserPreset::doPresetRescan(SurgeStorage*, bool) { haveScannedPresets = true; } void ModulatorPreset::forcePresetRescan() { haveScanedPresets = true; } }\n`);return{file,target}}
function specializedSurgeEffectFactory(output,sourceDir,source){const type=/\bFX\s*<\s*(fxt_[A-Za-z0-9_]+)\s*>/.exec(source)?.[1],targets={fxt_reverb:["Reverb1Effect","Reverb1Effect.h"],fxt_phaser:["PhaserEffect","PhaserEffect.h"],fxt_rotaryspeaker:["RotarySpeakerEffect","RotarySpeakerEffect.h"],fxt_distortion:["DistortionEffect","DistortionEffect.h"],fxt_freqshift:["FrequencyShifterEffect","FrequencyShifterEffect.h"],fxt_chorus4:["ChorusEffect<4>","ChorusEffectImpl.h"],fxt_vocoder:["VocoderEffect","VocoderEffect.h"],fxt_reverb2:["Reverb2Effect","Reverb2Effect.h"],fxt_flanger:["FlangerEffect","FlangerEffect.h"],fxt_ringmod:["RingModulatorEffect","RingModulatorEffect.h"],fxt_neuron:["chowdsp::NeuronEffect","chowdsp/NeuronEffect.h"],fxt_resonator:["ResonatorEffect","ResonatorEffect.h"],fxt_chow:["chowdsp::CHOWEffect","chowdsp/CHOWEffect.h"],fxt_exciter:["chowdsp::ExciterEffect","chowdsp/ExciterEffect.h"],fxt_ensemble:["BBDEnsembleEffect","BBDEnsembleEffect.h"],fxt_combulator:["CombulatorEffect","CombulatorEffect.h"],fxt_spring_reverb:["chowdsp::SpringReverbEffect","chowdsp/SpringReverbEffect.h"],fxt_treemonster:["TreemonsterEffect","TreemonsterEffect.h"],fxt_bonsai:["BonsaiEffect","BonsaiEffect.h"],fxt_nimbus:["NimbusEffect","NimbusEffect.h"]},target=targets[type];if(!target)return null;const original=path.join(sourceDir,"surge/src/common/dsp/Effect.cpp");if(!fs.existsSync(original))return null;const originalSource=fs.readFileSync(original,"utf8"),tailStart=originalSource.indexOf("Effect::Effect(");if(tailStart<0)return null;const springBridge=type==="fxt_spring_reverb"?`\n// Emscripten 6 emits incompatible indirect-table entries for this JUCE-backed class.\n// Keep the official implementations, but enter them through statically typed calls.\n// Rack constructs its global module before JUCE's translation-unit globals, so prepare lazily\n// on the first audio block, after WebAssembly initialization has completed.\nstatic void *rack_web_spring_ready[17] = {};\nstatic bool rack_web_spring_is_ready(void *effect) {\n    for (auto *candidate : rack_web_spring_ready)\n        if (candidate == effect) return true;\n    return false;\n}\nstatic void rack_web_spring_mark_ready(void *effect) {\n    for (auto &candidate : rack_web_spring_ready)\n        if (!candidate) { candidate = effect; return; }\n}\nvoid rack_web_spring_init(void *effect) {\n    if (rack_web_spring_is_ready(effect))\n        static_cast<chowdsp::SpringReverbEffect *>(effect)->chowdsp::SpringReverbEffect::init();\n}\nvoid rack_web_spring_init_ctrltypes(void *effect) {\n    static_cast<chowdsp::SpringReverbEffect *>(effect)->chowdsp::SpringReverbEffect::init_ctrltypes();\n}\nvoid rack_web_spring_init_default_values(void *effect) {\n    static_cast<chowdsp::SpringReverbEffect *>(effect)->chowdsp::SpringReverbEffect::init_default_values();\n}\nvoid rack_web_spring_process(void *effect, float *left, float *right) {\n    auto *spring = static_cast<chowdsp::SpringReverbEffect *>(effect);\n    if (!rack_web_spring_is_ready(effect)) {\n        spring->chowdsp::SpringReverbEffect::init();\n        rack_web_spring_mark_ready(effect);\n    }\n    spring->chowdsp::SpringReverbEffect::process(left, right);\n}\n`:"",file=path.join(output,"surge_effect_factory.cpp");fs.writeFileSync(file,`// Browser-specialized form of Surge XT Effect.cpp.\n#include "Effect.h"\n#include "${target[1]}"\n\nEffect *spawn_effect(int, SurgeStorage *storage, FxStorage *fxdata, pdata *pd) { return new ${target[0]}(storage, fxdata, pd); }\n${springBridge}\n${originalSource.slice(tailStart)}`);return{file,type,className:target[0],original}}
function browserSafeSurgeOscillatorFallback(sources){const file=sources.find(source=>path.basename(source)==="surge_oscillator_factory.cpp");if(!file)return;let source=fs.readFileSync(file,"utf8");const target=/#include "(WavetableOscillator|WindowOscillator)\.h"/.exec(source)?.[1];if(!target)return;source=source.replace(`#include "${target}.h"`,`#include "${target}.h"\n#include "SineOscillator.h"`).replace(`Oscillator* spawn_osc(int, SurgeStorage* storage, OscillatorStorage* oscdata, pdata* localcopy, unsigned char* onto) { return new (onto) ${target}(storage, oscdata, localcopy); }`,`Oscillator* spawn_osc(int type, SurgeStorage* storage, OscillatorStorage* oscdata, pdata* localcopy, unsigned char* onto) { if (type == ot_sine) return new (onto) SineOscillator(storage, oscdata, localcopy); return new (onto) ${target}(storage, oscdata, localcopy); }`);fs.writeFileSync(file,source)}
function browserSafeSurgeStorage(output,sources){browserSafeSurgeOscillatorFallback(sources);const original=sources.find(file=>file.endsWith(`${path.sep}surge${path.sep}src${path.sep}common${path.sep}SurgeStorage.cpp`));if(!original)return null;const file=path.join(output,"surge_storage_browser.cpp"),source=fs.readFileSync(original,"utf8").replace("using namespace std;","using namespace std;\n\nstatic bool rackWebFilesystemExists(const fs::path &) { return false; }").replaceAll("fs::exists(","rackWebFilesystemExists(").replaceAll("fs::is_directory(","rackWebFilesystemExists(");fs.writeFileSync(file,source);return{original,file}}
function browserSafeSurgePresetManager(output,sources){const original=sources.find(file=>file.endsWith(`${path.sep}surge${path.sep}src${path.sep}common${path.sep}FxPresetAndClipboardManager.cpp`));if(!original)return null;const file=path.join(output,"fx_preset_manager_browser.cpp"),source=replaceOutOfLineMethod(fs.readFileSync(original,"utf8"),"FxUserPreset","doPresetRescan","void FxUserPreset::doPresetRescan(SurgeStorage *, bool) { haveScannedPresets = true; }");fs.writeFileSync(file,source);return{original,file}}
function browserSafeSurgeSpringRng(output,sources){const original=sources.find(file=>file.endsWith(`${path.sep}chowdsp${path.sep}spring_reverb${path.sep}SpringReverbProc.cpp`));if(!original)return null;const file=path.join(output,"spring_reverb_proc_browser.cpp"),browserHeader=path.join(output,"browser-headers","chowdsp","spring_reverb","SpringReverbProc.h"),header=fs.existsSync(browserHeader)?browserHeader:path.join(path.dirname(original),"SpringReverbProc.h"),source=replaceOutOfLineMethod(fs.readFileSync(original,"utf8"),"SpringReverbProc","SpringReverbProc","static float rackWebSpringRandom()\n{\n    static uint32_t state = 0x6d2b79f5u;\n    state ^= state << 13; state ^= state >> 17; state ^= state << 5;\n    return float(state & 0x00ffffffu) / float(0x01000000u);\n}\n\nSpringReverbProc::SpringReverbProc() {}").replaceAll("urng01()","rackWebSpringRandom()").replace('#include "SpringReverbProc.h"',`#include ${JSON.stringify(header)}`);fs.writeFileSync(file,source);return{original,file}}
function browserSafeSurgeSpringEffect(output,sources){const original=sources.find(file=>file.endsWith(`${path.sep}chowdsp${path.sep}SpringReverbEffect.cpp`));if(!original)return null;const browserHeader=path.join(output,"browser-headers","chowdsp","SpringReverbEffect.h");if(!fs.existsSync(browserHeader))return null;const file=path.join(output,"spring_reverb_effect_browser.cpp"),source=fs.readFileSync(original,"utf8").replace('#include "SpringReverbEffect.h"',`#include ${JSON.stringify(browserHeader)}`);fs.writeFileSync(file,source);return{original,file}}
function browserSafeQplfo(output,sources){const original=sources.find(file=>file.endsWith(`${path.sep}core${path.sep}qplfo${path.sep}qplfo.cc`));if(!original)return null;const source=fs.readFileSync(original,"utf8");if(!source.includes("std::max<uint32_t>(rise_time[chan], 0u)")||!source.includes("std::max<uint32_t>(fall_time[chan], 0u)"))return null;const file=path.join(output,"qplfo_browser.cc");fs.writeFileSync(file,source.replace("std::max<uint32_t>(rise_time[chan], 0u)","std::max<uint32_t>(rise_time[chan], 1u)").replace("std::max<uint32_t>(fall_time[chan], 0u)","std::max<uint32_t>(fall_time[chan], 1u)"));return{original,file}}
function stripNativeLuaJitHeaders(source){return source.replace(/^\s*#include\s+["<][^">]*LuaJit(?:Lib)?\/LuaJIT\/[^">]+[">]\s*$/gim,"/* Rack Web omits native LuaJIT; SURGE_SKIP_LUA supplies the browser-safe contract. */")}
function browserSafeSurgeHeaders(output,sourceFiles,portableHost){
  const original=sourceFiles.find(file=>file.endsWith(`${path.sep}sst${path.sep}plugininfra${path.sep}userdefaults.h`));
  if(!original)return null;
  const root=path.join(output,"browser-headers"),file=path.join(root,"sst","plugininfra","userdefaults.h");
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,fs.readFileSync(original,"utf8").replace("if (!fs::exists(defaultsFile))\n                return;","return;"));
  const surgeStorage=sourceFiles.find(file=>path.basename(file)==="SurgeStorage.h"),oscillatorDirectory=surgeStorage&&path.join(path.dirname(surgeStorage),"dsp","oscillators"),oscillatorCommon=portableHost?sourceFiles.find(file=>file.endsWith(`${path.sep}OscillatorCommonFunctions.h`)):oscillatorDirectory&&path.join(oscillatorDirectory,"OscillatorCommonFunctions.h");
  if(oscillatorCommon&&fs.existsSync(oscillatorCommon))fs.writeFileSync(path.join(root,"OscillatorCommonFunctions.h"),portableHost?fs.readFileSync(oscillatorCommon,"utf8").replace('#include "DSPUtils.h"','/* Rack Web uses the standard math helpers already in rack_web.hpp. */').replace('#include "SurgeStorage.h"','/* Rack Web supplies the browser-local SurgeStorage contract. */'):fs.readFileSync(oscillatorCommon,"utf8"));
  const sineOscillator=oscillatorDirectory&&path.join(oscillatorDirectory,"SineOscillator.h");
  if(!portableHost&&sineOscillator&&fs.existsSync(sineOscillator))fs.copyFileSync(sineOscillator,path.join(root,"SineOscillator.h"));
  const surgeBiquad=surgeStorage&&path.join(path.dirname(surgeStorage),"dsp","filters","BiquadFilter.h");
  if(!portableHost&&surgeBiquad&&fs.existsSync(surgeBiquad))fs.copyFileSync(surgeBiquad,path.join(root,"BiquadFilter.h"));
  const oscillatorBase=oscillatorDirectory&&path.join(oscillatorDirectory,"OscillatorBase.h");
  if(!portableHost&&oscillatorBase&&fs.existsSync(oscillatorBase))fs.copyFileSync(oscillatorBase,path.join(root,"OscillatorBase.h"));

  // Upstream uses a generic 2^18-sample safety ceiling for every Spring delay. The
  // thirty-two SIMD all-pass buffers alone exceed WebAssembly's 256 MiB module limit.
  // These capacities still cover every reachable delay through a 192 kHz sample rate:
  // 20,008 main, 55,680 reflection, and 644 all-pass samples.
  const effectsDirectory=surgeStorage&&path.join(path.dirname(surgeStorage),"dsp","effects"),springDirectory=effectsDirectory&&path.join(effectsDirectory,"chowdsp"),springHeader=springDirectory&&path.join(springDirectory,"SpringReverbEffect.h");
  if(!portableHost&&springHeader&&fs.existsSync(springHeader)){
    const browserSpringDirectory=path.join(root,"chowdsp"),browserProcDirectory=path.join(browserSpringDirectory,"spring_reverb"),originalProcDirectory=path.join(springDirectory,"spring_reverb"),originalSharedDirectory=path.join(springDirectory,"shared");
    fs.mkdirSync(browserProcDirectory,{recursive:true});
    fs.writeFileSync(path.join(browserSpringDirectory,"SpringReverbEffect.h"),fs.readFileSync(springHeader,"utf8"));
    fs.writeFileSync(path.join(browserProcDirectory,"SpringReverbProc.h"),fs.readFileSync(path.join(originalProcDirectory,"SpringReverbProc.h"),"utf8")
      .replace('#include "../shared/SmoothedValue.h"',`#include ${JSON.stringify(path.join(originalSharedDirectory,"SmoothedValue.h"))}`)
      .replace('#include "../shared/StateVariableFilter.h"',`#include ${JSON.stringify(path.join(originalSharedDirectory,"StateVariableFilter.h"))}`)
      .replace('#include "ReflectionNetwork.h"',`#include ${JSON.stringify(path.join(browserProcDirectory,"ReflectionNetwork.h"))}`)
      .replace('#include "SchroederAllpass.h"',`#include ${JSON.stringify(path.join(browserProcDirectory,"SchroederAllpass.h"))}`)
      .replace('delay{1 << 18}', 'delay{1 << 15}'));
    fs.writeFileSync(path.join(browserProcDirectory,"ReflectionNetwork.h"),fs.readFileSync(path.join(originalProcDirectory,"ReflectionNetwork.h"),"utf8")
      .replace('#include "../shared/chowdsp_DelayLine.h"',`#include ${JSON.stringify(path.join(originalSharedDirectory,"chowdsp_DelayLine.h"))}`)
      .replace('#include "../shared/Shelf.h"',`#include ${JSON.stringify(path.join(originalSharedDirectory,"Shelf.h"))}`)
      .replaceAll('ReflectionDelay{1 << 18}', 'ReflectionDelay{1 << 16}'));
    fs.writeFileSync(path.join(browserProcDirectory,"SchroederAllpass.h"),fs.readFileSync(path.join(originalProcDirectory,"SchroederAllpass.h"),"utf8")
      .replace('#include "../shared/chowdsp_DelayLine.h"',`#include ${JSON.stringify(path.join(originalSharedDirectory,"chowdsp_DelayLine.h"))}`)
      .replaceAll('delay{1 << 18}', 'delay{1 << 10}'));
  }
  return root;
}
function fullSurgeImplementationSources(sourceDir,sourceFiles,target){
  if(!sourceFiles.some(file=>path.basename(file)==="SurgeStorage.h"))return[];
  const oscillator=target?`surge/src/common/dsp/oscillators/${target}.cpp`:null;
  const support=[];
  if(target==="SineOscillator")support.push("surge/src/common/dsp/filters/BiquadFilter.cpp");
  if(["SampleAndHoldOscillator","WavetableOscillator","WindowOscillator"].includes(target))support.push("surge/src/common/dsp/oscillators/ClassicOscillator.cpp");
  if(["AliasOscillator","WavetableOscillator","WindowOscillator"].includes(target))support.push("surge/src/common/dsp/oscillators/SineOscillator.cpp");
  if(["WavetableOscillator","WindowOscillator"].includes(target))support.push("surge/src/common/WAVFileSupport.cpp");
  if(target==="TwistOscillator")support.push(
    "surge/libs/eurorack/eurorack/plaits/dsp/voice.cc",
    "surge/libs/eurorack/eurorack/plaits/dsp/speech/lpc_speech_synth_phonemes.cc",
    "surge/libs/eurorack/eurorack/plaits/dsp/speech/lpc_speech_synth_controller.cc",
    "surge/libs/eurorack/eurorack/plaits/dsp/speech/lpc_speech_synth.cc",
    "surge/libs/eurorack/eurorack/plaits/dsp/speech/naive_speech_synth.cc",
    "surge/libs/eurorack/eurorack/plaits/dsp/speech/lpc_speech_synth_words.cc",
    "surge/libs/eurorack/eurorack/plaits/dsp/speech/sam_speech_synth.cc",
    "surge/libs/eurorack/eurorack/plaits/dsp/physical_modelling/string.cc",
    "surge/libs/eurorack/eurorack/plaits/dsp/physical_modelling/resonator.cc",
    "surge/libs/eurorack/eurorack/plaits/dsp/physical_modelling/string_voice.cc",
    "surge/libs/eurorack/eurorack/plaits/dsp/physical_modelling/modal_voice.cc",
    ...["fm","swarm","wavetable","particle","noise","hi_hat","chord","waveshaping","string","modal","grain","bass_drum","speech","additive","virtual_analog","snare_drum"].map(name=>`surge/libs/eurorack/eurorack/plaits/dsp/engine/${name}_engine.cc`),
    "surge/libs/eurorack/eurorack/plaits/resources.cc",
    "surge/libs/eurorack/eurorack/stmlib/dsp/units.cc",
    "surge/libs/eurorack/eurorack/stmlib/dsp/atan.cc",
    "surge/libs/eurorack/eurorack/stmlib/utils/random.cc",
    "surge/libs/libsamplerate/src/samplerate.c",
    "surge/libs/libsamplerate/src/src_sinc.c",
    "surge/libs/libsamplerate/src/src_zoh.c",
    "surge/libs/libsamplerate/src/src_linear.c",
  );
  return[oscillator,...support,"surge/src/common/SurgePatch.cpp","surge/src/common/SkinModelImpl.cpp","surge/src/common/dsp/modulators/MSEGModulationHelper.cpp","surge/src/common/dsp/modulators/FormulaModulationHelper.cpp","surge/libs/fmt/src/format.cc","surge/libs/sqlite-3.23.3/sqlite3.c","surge/libs/sst/sst-plugininfra/libs/tinyxml/src/tinyxmlerror.cpp","surge/libs/sst/sst-plugininfra/libs/tinyxml/src/tinyxmlparser.cpp"].filter(Boolean).map(relative=>path.join(sourceDir,relative)).filter(file=>fs.existsSync(file));
}
function surgeEffectImplementationSources(sourceDir,effect){
  if(!effect)return[];
  const root="surge/src/common/dsp/effects",support={
    fxt_neuron:["chowdsp/NeuronEffect.cpp"],
    fxt_chow:["chowdsp/CHOWEffect.cpp",...['ChewProcessor','DegradeProcessor','HysteresisProcessing','HysteresisProcessor','LossFilter','ToneControl'].map(name=>`chowdsp/tape/${name}.cpp`)],
    fxt_exciter:["chowdsp/ExciterEffect.cpp","chowdsp/exciter/LevelDetector.cpp"],
    fxt_spring_reverb:["chowdsp/SpringReverbEffect.cpp","chowdsp/spring_reverb/SpringReverbProc.cpp","chowdsp/shared/StateVariableFilter.cpp"],
    fxt_nimbus:[
      "NimbusEffect.cpp",
      ...["correlator.cc","granular_processor.cc","mu_law.cc"].map(name=>`../../../../libs/eurorack/eurorack/clouds/dsp/${name}`),
      ...["frame_transformation.cc","phase_vocoder.cc","stft.cc"].map(name=>`../../../../libs/eurorack/eurorack/clouds/dsp/pvoc/${name}`),
      "../../../../libs/eurorack/eurorack/clouds/resources.cc",
      "../../../../libs/eurorack/eurorack/stmlib/dsp/units.cc",
      "../../../../libs/eurorack/eurorack/stmlib/dsp/atan.cc",
      "../../../../libs/eurorack/eurorack/stmlib/utils/random.cc",
      ...["samplerate.c","src_sinc.c","src_zoh.c","src_linear.c"].map(name=>`../../../../libs/libsamplerate/src/${name}`),
    ],
  }[effect.type]??[];
  if(!support.length){const header=effect.original?effect.className.replace(/.*::/,"").replace(/<.*>/,""):"";support.push(`${header}.cpp`)}
  return support.map(relative=>path.join(sourceDir,root,relative)).filter(file=>fs.existsSync(file));
}
function surgeJuceRuntime(output,sourceDir,effect){
  if(!effect?.className?.startsWith("chowdsp::"))return null;
  const modules=path.join(sourceDir,"surge/libs/JUCE/modules");
  if(!fs.existsSync(path.join(modules,"juce_dsp/juce_dsp.h")))return null;
  // Surge's Rack build links JUCE's module translation units, but these effects only use
  // header-defined buffer/process primitives. Avoid pulling native thread/filesystem code
  // into the standalone browser module.
  const sentinel=path.join(output,"juce_runtime_browser.cpp");
  fs.writeFileSync(sentinel,'#include <juce_core/juce_core.h>\nnamespace juce {\n#if JUCE_DEBUG\nthis_will_fail_to_link_if_some_of_your_compile_units_are_built_in_debug_mode::this_will_fail_to_link_if_some_of_your_compile_units_are_built_in_debug_mode() noexcept {}\n#else\nthis_will_fail_to_link_if_some_of_your_compile_units_are_built_in_release_mode::this_will_fail_to_link_if_some_of_your_compile_units_are_built_in_release_mode() noexcept {}\n#endif\n}\n');
  const sources=[sentinel,...["juce_audio_basics/juce_audio_basics.cpp"].map(relative=>path.join(modules,relative)).filter(file=>fs.existsSync(file))];
  const definitions=["JUCE_GLOBAL_MODULE_SETTINGS_INCLUDED=1","JUCE_MODULE_AVAILABLE_juce_dsp=1","JUCE_MODULE_AVAILABLE_juce_audio_basics=1","JUCE_MODULE_AVAILABLE_juce_core=1","JUCE_STANDALONE_APPLICATION=0","JUCE_USE_CURL=0","JUCE_WEB_BROWSER=0","JUCE_USE_FLAC=0","JUCE_USE_OGGVORBIS=0","JUCE_USE_WINDOWS_MEDIA_FORMAT=0"].map(value=>`-D${value}`);
  return{modules,sources,definitions};
}
function specializeSurgeSpringVirtualCalls(adapter,effect){
  if(effect?.type!=="fxt_spring_reverb")return;
  const source=fs.readFileSync(adapter,"utf8")
    .replace('#include "rack_web_export.hpp"','#include "rack_web_export.hpp"\n\nvoid rack_web_spring_init(void *effect);\nvoid rack_web_spring_init_ctrltypes(void *effect);\nvoid rack_web_spring_init_default_values(void *effect);\nvoid rack_web_spring_process(void *effect, float *left, float *right);')
    .replaceAll("if (FXConfig<fxType>::usesPresets())","if (false)")
    .replaceAll("dynamic_cast<modules::CalculatedName *>(u)","static_cast<modules::CalculatedName *>(nullptr)")
    .replaceAll("dynamic_cast<modules::CalculatedName *>(pq)","static_cast<modules::CalculatedName *>(nullptr)")
    .replace("        snapCalculatedNames();","        /* Rack Web already exports the exact source-derived parameter names. */")
    .replaceAll("surge_effect->init();","rack_web_spring_init(surge_effect.get());")
    .replace("surge_effect->init_ctrltypes();","rack_web_spring_init_ctrltypes(surge_effect.get());")
    .replace("surge_effect->init_default_values();","rack_web_spring_init_default_values(surge_effect.get());")
    .replace("s->init();","rack_web_spring_init(s.get());")
    .replaceAll("surge_effect_poly[c]->init();","rack_web_spring_init(surge_effect_poly[c].get());")
    .replaceAll("surge_effect_poly[i]->init();","rack_web_spring_init(surge_effect_poly[i].get());")
    .replace("surge_effect->process_ringout(processedL[0], processedR[0], true);","rack_web_spring_process(surge_effect.get(), processedL[0], processedR[0]);")
    .replace("surge_effect_poly[c]->process_ringout(processedL[c], processedR[c], true);","rack_web_spring_process(surge_effect_poly[c].get(), processedL[c], processedR[c]);");
  fs.writeFileSync(adapter,source);
}
function embedBinaryAssets(source,sourceDir){
  const symbols=[...new Set([...source.matchAll(/\bBINARY\s*\(\s*([A-Za-z_]\w*)\s*\)\s*;/g)].map(match=>match[1]))];
  if(!symbols.length)return source;
  const declarations=[];
  for(const symbol of symbols){
    const filename=symbol.replace(/^src_/,"").replace(/_bin$/,".bin"),asset=path.join(sourceDir,"src",filename);
    if(!fs.existsSync(asset))fail(`Embedded DSP asset ${filename} is missing from the locked source checkout`);
    const bytes=fs.readFileSync(asset),words=[];
    for(let offset=0;offset<bytes.length;offset+=4){let word=0;for(let byte=0;byte<4&&offset+byte<bytes.length;byte++)word|=bytes[offset+byte]<<(byte*8);words.push(`0x${(word>>>0).toString(16).padStart(8,"0")}u`)}
    const lines=[];for(let index=0;index<words.length;index+=16)lines.push(`  ${words.slice(index,index+16).join(", ")}`);
    declarations.push(`alignas(16) static const std::uint32_t rackWebBinary_${symbol}[] = {\n${lines.join(",\n")}\n};`);
  }
  source=source.replace(/^\s*#include\s+<common\.hpp>\s*$/gm,"").replace(/\bBINARY\s*\(\s*([A-Za-z_]\w*)\s*\)\s*;/g,"");
  source=source.replace(/\bBINARY_START\s*\(\s*([A-Za-z_]\w*)\s*\)/g,"rackWebBinary_$1");
  source=source.replace(/\bBINARY_END\s*\(\s*([A-Za-z_]\w*)\s*\)/g,"reinterpret_cast<const unsigned char*>(rackWebBinary_$1) + sizeof(rackWebBinary_$1)");
  source=source.replace(/\bBINARY_SIZE\s*\(\s*([A-Za-z_]\w*)\s*\)/g,"sizeof(rackWebBinary_$1)");
  return source.replace('#include "rack_web_export.hpp"',`#include "rack_web_export.hpp"\n\n${declarations.join("\n\n")}`);
}
function compileAdapter(adapter,output,initialMemory,sourceDir,sourceFiles,localConditionalSources=[],linkExternalSources=true){
  let optimizationFlags=process.env.RACK_WEB_DEBUG_WASM==="optimized"?["-O3","-g3"]:process.env.RACK_WEB_DEBUG_WASM?["-O0","-g3"]:["-O3"];
  let adaptedSource=adaptThreadedAnalyzers(fs.readFileSync(adapter,"utf8"));adaptedSource=stripEmbeddedResourceDocumentation(adaptedSource);adaptedSource=stubInlineVoidMethod(adaptedSource,"guaranteeRackUserWavetablesDir");adaptedSource=stripSurgeRackCustomEditor(adaptedSource);adaptedSource=adaptSurgeDynamicParameterNames(adaptedSource);adaptedSource=adaptSurgeBuiltinWavetable(adaptedSource,sourceDir);adaptedSource=stripNativeLuaJitHeaders(adaptedSource).replace(/\b__decay\b/g,"rackWebDecayVector");adaptedSource=adaptedSource.replace(/\btemplate\s*<[^;{}]+>(?=(?:\s|\/\/[^\n]*(?:\n|$))*(?:using\s+namespace\b|typedef\b|enum\b|#include\b))/g,"");adaptedSource=embedBinaryAssets(adaptedSource,sourceDir);const airwinSuite=airwinBrowserSuite(output,sourceDir,adaptedSource);if(airwinSuite)adaptedSource=airwinSuite.source;
  const usesWdlConvolution=/\b(?:WDL_ImpulseBuffer|WDL_ConvolutionEngine(?:_Div)?)\b/.test(adaptedSource);
  if(usesWdlConvolution&&!/[<"](?:WDL\/)?convoengine\.h[>"]/.test(adaptedSource))
    adaptedSource=adaptedSource.replace('#include "rack_web_export.hpp"','#include "rack_web_export.hpp"\n#include "WDL/convoengine.h"\n#include "WDL/resample.h"');
  const usesDrWav=/\b(?:drwav|drwav_[A-Za-z0-9_]+|DRWAV_[A-Za-z0-9_]+)\b/.test(adaptedSource);
  if(usesDrWav&&!/[<"][^">]*dr_wav\.h[>"]/.test(adaptedSource))
    adaptedSource=adaptedSource.replace('#include "rack_web_export.hpp"','#define DR_WAV_IMPLEMENTATION\n#include "third_party/dr_wav.h"\n#include "rack_web_export.hpp"');
  const usesPffft=/\b(?:PFFFT_[A-Za-z0-9_]+|pffft_[A-Za-z0-9_]+)\b/.test(adaptedSource);
  const sseReference=[adaptedSource,...sourceFiles.map(file=>fs.readFileSync(file,"utf8"))].join("\n"),requiresSseCompat=/\b(?:__m128d?|__m128i|__m64|_mm_[A-Za-z0-9_]+|sse_mathfun_[A-Za-z0-9_]+)\b/.test(sseReference)||(/\b(?:(?:rack::)?simd::)?float_4\b/.test(sseReference)&&/\.\s*v\b/.test(sseReference)),requiresSse3=/<pmmintrin\.h>|\b_mm_(?:addsub|hadd|hsub|movehdup|moveldup)_ps\b/.test(sseReference),requiresSseMathfun=/\bsse_mathfun_(?:log|exp|sin|cos)_ps\s*\(/.test(sseReference)&&!/\b(?:inline\s+)?__m128\s+sse_mathfun_(?:log|exp|sin|cos)_ps\s*\([^)]*\)\s*\{/.test(sseReference);
  if(/\bstruct\s+PulseGenerator_4\b/.test(adaptedSource))adaptedSource=adaptedSource.replace('#include "rack_web_export.hpp"','#define RACK_WEB_OMIT_PULSE_GENERATOR_4 1\n#include "rack_web_export.hpp"');
  if(/\bNeighborConnectable_V1\b/.test(adaptedSource)&&!/\bstruct(?:\s+__attribute__\s*\(\([^)]*\)\))?\s+NeighborConnectable_V1\b/.test(adaptedSource))adaptedSource=adaptedSource.replace('#include "rack_web_export.hpp"',`#include "rack_web_export.hpp"

namespace sst::rackhelpers::module_connector {
struct NeighborConnectable_V1 {
  virtual ~NeighborConnectable_V1() = default;
  using stereoPort_t = std::pair<int, int>;
  using labeledStereoPort_t = std::pair<std::string, stereoPort_t>;
  virtual std::optional<std::vector<labeledStereoPort_t>> getPrimaryInputs() { return std::nullopt; }
  virtual std::optional<std::vector<labeledStereoPort_t>> getPrimaryOutputs() { return std::nullopt; }
};
}`);
  if(requiresSseCompat&&!adaptedSource.includes("Rack Web SSE compatibility"))adaptedSource=adaptedSource.replace('#include "rack_web_export.hpp"',`#include <xmmintrin.h>
#include <emmintrin.h>
#include "rack_web_export.hpp"

// Rack Web SSE compatibility: Emscripten maps SSE/SSE2 to WebAssembly SIMD,
// but deliberately omits the four legacy MMX helpers used by older Rack DSP.
#ifdef __EMSCRIPTEN__
inline __m64 rackWebM64FromBits(std::uint64_t bits) { __m64 value; std::memcpy(&value, &bits, sizeof(value)); return value; }
inline std::uint64_t rackWebM64Bits(__m64 value) { std::uint64_t bits; std::memcpy(&bits, &value, sizeof(bits)); return bits; }
inline __m64 _mm_set1_pi16(short value) { const std::uint64_t lane = static_cast<std::uint16_t>(value); return rackWebM64FromBits(lane | lane << 16 | lane << 32 | lane << 48); }
inline __m64 _mm_and_si64(__m64 left, __m64 right) { return rackWebM64FromBits(rackWebM64Bits(left) & rackWebM64Bits(right)); }
inline __m64 _mm_andnot_si64(__m64 left, __m64 right) { return rackWebM64FromBits(~rackWebM64Bits(left) & rackWebM64Bits(right)); }
inline __m64 _mm_or_si64(__m64 left, __m64 right) { return rackWebM64FromBits(rackWebM64Bits(left) | rackWebM64Bits(right)); }
inline void _mm_setcsr(unsigned int) {}
inline void* aligned_alloc_16(std::size_t size) { const std::size_t aligned = (size + 15u) & ~std::size_t(15u); return std::aligned_alloc(16u, aligned); }
inline void aligned_free_16(void* pointer) { std::free(pointer); }
#endif
${requiresSseMathfun?`inline __m128 sse_mathfun_log_ps(__m128 value) { alignas(16) float lanes[4]; _mm_store_ps(lanes, value); for (float& lane : lanes) lane = std::log(lane); return _mm_load_ps(lanes); }
inline __m128 sse_mathfun_exp_ps(__m128 value) { alignas(16) float lanes[4]; _mm_store_ps(lanes, value); for (float& lane : lanes) lane = std::exp(lane); return _mm_load_ps(lanes); }
inline __m128 sse_mathfun_sin_ps(__m128 value) { alignas(16) float lanes[4]; _mm_store_ps(lanes, value); for (float& lane : lanes) lane = std::sin(lane); return _mm_load_ps(lanes); }
inline __m128 sse_mathfun_cos_ps(__m128 value) { alignas(16) float lanes[4]; _mm_store_ps(lanes, value); for (float& lane : lanes) lane = std::cos(lane); return _mm_load_ps(lanes); }`:""}`);
  const legacyOpen303Compat=/\b(?:UINT64|__debugbreak)\b|\b(?:cdft|rdft)\s*\(/.test(adaptedSource);
  if(legacyOpen303Compat)adaptedSource=adaptedSource.replace('#include "rack_web_export.hpp"',`#include "rack_web_export.hpp"
#include <cfloat>
using UINT64 = unsigned long long;
inline double dummyFunction(double value) { return value; }
#ifndef __debugbreak
#define __debugbreak() ((void)0)
#endif
extern "C" {
void cdft(int, int, double*, int*, double*);
void rdft(int, int, double*, int*, double*);
}`);
  fs.writeFileSync(adapter,adaptedSource);const browserHeaderRoot=browserSafeSurgeHeaders(output,sourceFiles,!linkExternalSources);
  const artifact=path.join(output,"module.wasm");
  const repositories=repositoryRoots(sourceDir),externalImplementationRoot=file=>repositories.slice(1).some(root=>path.dirname(file)===root),browserImplementationSource=file=>{if(!/\.(?:c|cpp|cc|cxx)$/.test(file))return false;const source=fs.readFileSync(file,"utf8");if(rackUiPattern.test(source))return false;const parts=path.relative(sourceDir,file).split(path.sep),base=path.basename(file),stem=path.basename(file,path.extname(file)),hardwareSource=parts.some((part,index)=>part==="third_party"&&parts[index+1]==="STM"),testGuardedCloudsProcessor=base==="granular_processor.cc"&&parts.includes("clouds")&&parts.includes("dsp"),hardwareDependency=!testGuardedCloudsProcessor&&(/^\s*#\s*include\s+["<](?:[^">]*\/)?(?:drivers|system)\/|^\s*#\s*include\s+["<](?:[^">]*\/)?(?:settings|factory_test)\.h[">]/m.test(source)),nativeLuaJitSource=parts.some(part=>/^luajit(?:lib)?$/i.test(part)),nativeLuaSupportSource=base==="LuaSupport.cpp";return !hardwareSource&&!hardwareDependency&&!nativeLuaJitSource&&!nativeLuaSupportSource&&!parts.some(part=>["bootloader","drivers","system","test","tests","CMSIS"].includes(part)||/^STM32.*StdPeriph_Driver$/.test(part))&&!/^(?:main|plugin|settings|themes?|ui|system_[A-Za-z0-9_]+)\.(?:c|cpp|cc|cxx)$/.test(base)&&(stem!==path.basename(path.dirname(file))||externalImplementationRoot(file)||base==="r8lib.cpp")};
  const externalRoots=repositories.slice(1),externalIncludeRoots=externalRoots.filter(root=>!externalRoots.some(other=>other!==root&&root.startsWith(`${other}${path.sep}`))),headerDirectories=[...new Set(sourceFiles.map(file=>path.dirname(file)))],nestedIncludeRoots=[...new Set(headerDirectories.flatMap(directory=>{const roots=[];let current=directory;while(current.startsWith(`${sourceDir}${path.sep}`)){if(path.basename(current)==="include")roots.push(current);const parent=path.dirname(current);if(parent===current)break;current=parent}return roots}))],angleTokens=[...new Set(sourceFiles.flatMap(file=>rawIncludeDirectives(file,fs.readFileSync(file,"utf8")).filter(candidate=>candidate.angle).map(candidate=>candidate.include)))],angleHeaderDirectories=[...new Set(angleTokens.filter(token=>token.includes("/")||/[A-Z]/.test(token)).flatMap(token=>{const normalized=token.split("/").join(path.sep),candidate=sourceFiles.find(file=>file.endsWith(`${path.sep}${normalized}`));return candidate?[candidate.slice(0,-normalized.length).replace(/[\\/]$/,"")]:[]}))],conventionalIncludeRoots=externalRoots.map(root=>path.join(root,"include")).filter(directory=>fs.existsSync(directory)),externalSources=linkExternalSources?[...new Set(sourceFiles.filter(file=>externalRoots.some(root=>file.startsWith(`${root}${path.sep}`))&&browserImplementationSource(file)))]:[],includeDirectories=[path.join(projectDir,"web-runtime","include"),path.join(sourceDir,"src"),...(fs.existsSync(path.join(sourceDir,"lib"))?[path.join(sourceDir,"lib")]:[]),...makefileIncludeDirectories(sourceDir),sourceDir,...nestedIncludeRoots.filter(root=>!externalRoots.some(external=>root===external||root.startsWith(`${external}${path.sep}`)))],afterDirectories=[...externalIncludeRoots,...conventionalIncludeRoots,...angleHeaderDirectories],quoteDirectories=[...externalRoots,...headerDirectories],includeArgs=[...new Set(includeDirectories)].map(directory=>`-I${directory}`).concat([...new Set(afterDirectories)].map(directory=>`-idirafter${directory}`),[...new Set(quoteDirectories)].map(directory=>`-iquote${directory}`));
  browserRuntimeImplementationSources(sourceDir,sourceFiles,externalSources);
  browserRuntimeImplementationSources(sourceDir,sourceFiles,localConditionalSources);
  const allSourceHeaders=files(sourceDir).filter(file=>/\.(?:h|hh|hpp)$/.test(file)&&!/(?:^|[\\/])(?:metamodule-)?plugin-libc(?:[\\/]|$)/.test(path.relative(sourceDir,file))),
    unresolvedIncludeTokens=[...new Set(sourceFiles.flatMap(file=>rawIncludes(file,fs.readFileSync(file,"utf8"))).filter(token=>token.includes("/")||/^lib[A-Z]/.test(token)))],
    inferredHeaderRootArgs=[...new Set(unresolvedIncludeTokens.flatMap(token=>{const normalized=token.split("/").join(path.sep),suffix=`${path.sep}${normalized}`,candidate=selectIncludeCandidate(allSourceHeaders.filter(file=>file.endsWith(suffix)),sourceDir);return candidate?[`-idirafter${candidate.slice(0,-normalized.length).replace(/[\\\/]$/,"")}`]:[]}))],
    implementationIncludeFiles=[...new Set([...sourceFiles,...externalSources])],
    quotedImplementationTokens=[...new Set(implementationIncludeFiles.flatMap(file=>rawIncludeDirectives(file,fs.readFileSync(file,"utf8")).filter(candidate=>!candidate.angle).map(candidate=>candidate.include)))],
    inferredQuoteRootArgs=[...new Set(quotedImplementationTokens.flatMap(token=>{const normalized=token.split("/").join(path.sep),suffix=`${path.sep}${normalized}`,candidate=selectIncludeCandidate(allSourceHeaders.filter(file=>file.endsWith(suffix)),sourceDir);return candidate?[`-iquote${candidate.slice(0,-normalized.length).replace(/[\\\/]$/,"")}`]:[]}))],
    quotePriority=argument=>{const directory=argument.slice("-iquote".length);return directory.startsWith(`${path.join(sourceDir,"surge","src")}${path.sep}`)?0:directory.startsWith(`${path.join(sourceDir,"src")}${path.sep}`)?1:directory.startsWith(`${sourceDir}${path.sep}`)?2:3},
    prioritizedIncludeArgs=[...new Set([...includeArgs.filter(argument=>!argument.startsWith("-iquote")),...(browserHeaderRoot?[`-iquote${browserHeaderRoot}`]:[]),...inferredHeaderRootArgs,...includeArgs.filter(argument=>argument.startsWith("-iquote")).sort((left,right)=>quotePriority(left)-quotePriority(right)||left.localeCompare(right)),...inferredQuoteRootArgs])];
  const headerDefinitions=new Set(sourceFiles.filter(file=>/\.(?:hpp|hh|h)$/.test(file)).flatMap(file=>outOfLineCallableKeys(fs.readFileSync(file,"utf8")))),
    wdlRoot=usesWdlConvolution?repositories.find(root=>path.basename(root)==="WDL"):null,
    drWavRoot=usesDrWav?repositories.find(root=>fs.existsSync(path.join(root,"third_party","dr_wav.h"))):null,
    pffftRoot=usesPffft?repositories.find(root=>path.basename(root)==="pffft"):null,
    wdlSources=wdlRoot?["WDL/convoengine.cpp","WDL/resample.cpp","WDL/fft.c"].map(relative=>path.join(wdlRoot,relative)).filter(file=>fs.existsSync(file)):[],
    pffftSources=pffftRoot?["src/pffft.c","src/pffft_common.c"].map(relative=>path.join(pffftRoot,relative)).filter(file=>fs.existsSync(file)):[];
  const externalPffft=Boolean(pffftRoot&&pffftSources.length);
  if(wdlRoot){
    const wdlHeaderArgument=`-idirafter${path.join(wdlRoot,"WDL")}`;
    if(!prioritizedIncludeArgs.includes(wdlHeaderArgument))prioritizedIncludeArgs.push(wdlHeaderArgument);
  }
  if(drWavRoot){
    const drWavHeaderArgument=`-iquote${path.join(drWavRoot,"third_party")}`;
    if(!prioritizedIncludeArgs.includes(drWavHeaderArgument))prioritizedIncludeArgs.push(drWavHeaderArgument);
  }
  if(pffftRoot){
    const pffftHeaderArgument=`-iquote${path.join(pffftRoot,"include","pffft")}`;
    if(!prioritizedIncludeArgs.includes(pffftHeaderArgument))prioritizedIncludeArgs.push(pffftHeaderArgument);
  }
  const specializedFactory=specializedSurgeOscillatorFactory(output,adaptedSource,linkExternalSources&&sourceFiles.some(file=>path.basename(file)==="SurgeStorage.h")),specializedEffect=specializedSurgeEffectFactory(output,sourceDir,adaptedSource),juceRuntime=surgeJuceRuntime(output,sourceDir,specializedEffect),originalFactory=path.join(sourceDir,"surge/src/common/dsp/Oscillator.cpp"),legacyFftSource=legacyOpen303Compat?files(sourceDir).find(file=>path.basename(file)==="fft4g.c"):null,rawImplementationSources=[...new Set([...localConditionalSources.filter(browserImplementationSource),...externalSources,...(linkExternalSources?fullSurgeImplementationSources(sourceDir,sourceFiles,specializedFactory?.target):[]),...surgeEffectImplementationSources(sourceDir,specializedEffect),...(specializedFactory?[specializedFactory.file]:[]),...(specializedEffect?[specializedEffect.file]:[]),...(juceRuntime?.sources??[]),...(airwinSuite?[airwinSuite.file]:[]),...(legacyFftSource?[legacyFftSource]:[])])].filter(file=>(!specializedFactory||file!==originalFactory)&&(!specializedEffect||file!==specializedEffect.original)&&(!externalSources.includes(file)||browserImplementationSource(file))&&path.basename(file)!=="LuaSupport.cpp"&&!file.split(path.sep).some(part=>/^luajit(?:lib)?$/i.test(part))),pinkTromboneSources=browserSafePinkTromboneSources(output,rawImplementationSources),safeSurgeStorage=browserSafeSurgeStorage(output,rawImplementationSources),safePresetManager=browserSafeSurgePresetManager(output,rawImplementationSources),safeSpringRng=browserSafeSurgeSpringRng(output,rawImplementationSources),safeSpringEffect=browserSafeSurgeSpringEffect(output,rawImplementationSources),safeQplfo=browserSafeQplfo(output,rawImplementationSources),allImplementationSources=rawImplementationSources.map(file=>pinkTromboneSources.get(file)??(file===safeSurgeStorage?.original?safeSurgeStorage.file:file===safePresetManager?.original?safePresetManager.file:file===safeSpringRng?.original?safeSpringRng.file:file===safeSpringEffect?.original?safeSpringEffect.file:file===safeQplfo?.original?safeQplfo.file:file)),cSources=allImplementationSources.filter(file=>/\.c$/.test(file)),cppSources=allImplementationSources.filter(file=>!/\.c$/.test(file)),usesEigen=sourceFiles.some(file=>file.split(path.sep).includes("Eigen"))||/<Eigen[\\/]/.test(adaptedSource),disableLto=sourceFiles.some(file=>path.basename(file)==="gru_eigen.h"),ltoArgs=disableLto?[]:["-flto"],sstSimdSetup=path.join(sourceDir,"sst-basic-blocks","include","sst","basic-blocks","simd","setup.h"),missingSstSimde=requiresSseCompat&&fs.existsSync(sstSimdSetup)&&!fs.existsSync(path.join(sourceDir,"simde","simde","x86","sse4.2.h"))&&!fs.existsSync(path.join(sourceDir,"sst-basic-blocks","include","simde","x86","sse4.2.h")),compileDefinitions=[...makefileCompileDefinitions(sourceDir),...cmakeCompileDefinitions(sourceDir),...(missingSstSimde?["-DSIMDE_UNAVAILABLE=1"]:[]),...(usesEigen?["-DEIGEN_DONT_VECTORIZE=1","-DEIGEN_DISABLE_UNALIGNED_ARRAY_ASSERT=1","-DEIGEN_HAS_STD_RESULT_OF=0"]:[]),...(juceRuntime?.definitions??[])],requiresCxx17=sourceFiles.some(file=>/Surge requires C\+\+17/.test(fs.readFileSync(file,"utf8"))),legacyStdArrayIterator=sourceFiles.some(file=>/\biterator\s*\(\s*Base::(?:begin|end)\s*\(\s*\)\s*\)/.test(fs.readFileSync(file,"utf8"))),usesAlpacaCrc=sourceFiles.some(file=>path.basename(file)==="crc32.h"&&file.includes(`${path.sep}alpaca${path.sep}`)),usesCustomSchmittTrigger=sourceFiles.some(file=>path.basename(file).toLowerCase()==="schmitttrigger.h"&&/\bclass\s+SchmittTrigger\b/.test(fs.readFileSync(file,"utf8"))),usesMathTools=sourceFiles.some(file=>/\bnamespace\s+MathTools\b/.test(fs.readFileSync(file,"utf8"))),usesVcvRackBranches=sourceFiles.some(file=>/\bVCVRACK\b/.test(fs.readFileSync(file,"utf8"))),usesChucKRuntime=sourceFiles.some(file=>path.basename(file)==="chuck_def.h"&&/\b__PLATFORM_EMSCRIPTEN__\b/.test(fs.readFileSync(file,"utf8"))),usesRackSimd=sourceFiles.some(file=>/\bRACK_SIMD\b/.test(fs.readFileSync(file,"utf8")))&&rustMakefileAnalysis(sourceDir).allCompileDefinitions.some(definition=>definition==="-DRACK_SIMD"||definition==="-DRACK_SIMD=1"),legacyStdArrayIteratorHeader=path.join(output,"rack_web_legacy_array_iterator.hpp"),platformDefinitions=[...(requiresCxx17?["-DTIXML_USE_STL=1","-DHAVE_STDBOOL_H=1","-DHAVE_UNISTD_H=1","-DPACKAGE=\"libsamplerate\"","-DVERSION=\"0.2.1\"","-include","surge_web_compat.h"]:[]),...(legacyStdArrayIterator?["-include",legacyStdArrayIteratorHeader]:[]),...(externalPffft?["-DRACK_WEB_EXTERNAL_PFFFT=1"]:[]),...(usesAlpacaCrc?["-DALPACA_NO_PREFETCH","-D__ALPACA_BYTE_ORDER=1234"]:[]),...(usesCustomSchmittTrigger?["-DRACK_WEB_NO_GLOBAL_STD_MIN_MAX"]:[]),...(usesMathTools?["-DRACK_WEB_NO_GLOBAL_STD_MIN_MAX"]:[]),...(usesVcvRackBranches?["-DVCVRACK"]:[]),...(usesChucKRuntime?["-D__PLATFORM_LINUX__","-DHAVE_LIBPTHREAD=1"]:[]),...(usesRackSimd?["-DRACK_SIMD=1"]:[])],cppStandard=requiresCxx17?"-std=c++17":"-std=c++20";
  const adapterDefinitions=new Set(outOfLineCallableKeys(adaptedSource)),linkedDefinitionKeys=new Set([...headerDefinitions,...adapterDefinitions]),hasPlatformOverrides=rawImplementationSources.some(file=>outOfLineCallableKeys(fs.readFileSync(file,"utf8")).some(symbol=>linkedDefinitionKeys.has(symbol))),linkerArgs=hasPlatformOverrides?["-Wl,--allow-multiple-definition"]:[];
  if(usesCustomSchmittTrigger&&!platformDefinitions.includes("-DRACK_WEB_NO_GLOBAL_SCHMITT_TRIGGER_ALIAS"))platformDefinitions.push("-DRACK_WEB_NO_GLOBAL_SCHMITT_TRIGGER_ALIAS");
  if(usesChucKRuntime)for(const definition of ["-D__DISABLE_NETWORK__","-D__DISABLE_ASYNCH_IO__","-D__DISABLE_THREADS__","-D__DISABLE_KBHIT__","-D__DISABLE_PROMPTER__","-D__CHUCK_USE_PLANAR_BUFFERS__","-D__OLDSCHOOL_RANDOM__"])if(!platformDefinitions.includes(definition))platformDefinitions.push(definition);
  if(usesChucKRuntime)ltoArgs.length=0;
  if(disableLto&&!process.env.RACK_WEB_DEBUG_WASM)optimizationFlags=["-O1"];
  for(const source of wdlSources){
    const targets=/\.c$/.test(source)?cSources:cppSources;
    if(!targets.includes(source))targets.push(source);
  }
  for(const source of pffftSources)if(!cSources.includes(source))cSources.push(source);
  for(const source of localConditionalSources)if(/(?:^|[\\/])deps[\\/]ebur128[\\/]ebur128\.c$/.test(source)&&!cSources.includes(source))cSources.push(source);
  if(legacyStdArrayIterator)fs.writeFileSync(legacyStdArrayIteratorHeader,"#pragma once\n#include <__configuration/abi.h>\n#undef _LIBCPP_ABI_USE_WRAP_ITER_IN_STD_ARRAY\n");
  const cPlatformDefinitions=[];
  for(let index=0;index<platformDefinitions.length;index+=1){
    if(platformDefinitions[index]==="-include"&&platformDefinitions[index+1]===legacyStdArrayIteratorHeader){
      index+=1;
      continue;
    }
    cPlatformDefinitions.push(platformDefinitions[index]);
  }
  specializeSurgeSpringVirtualCalls(adapter,specializedEffect);
  if(juceRuntime)prioritizedIncludeArgs.unshift(`-I${juceRuntime.modules}`);
  const emulateFunctionPointerCasts=specializedFactory?.target==="TwistOscillator"||usesChucKRuntime;
  const usesBrowserLua=localConditionalSources.some(file=>file.includes(`${path.sep}.rack-web-dependencies${path.sep}lua${path.sep}`));
  const pffftSimdArgs=externalPffft?["-DPFFFT_ENABLE_NEON=1","-msimd128"]:[];
  const cSimdArguments=pffftSimdArgs,cxxSimdArguments=requiresSseCompat?[requiresSse3?"-msse3":"-msse2","-msimd128"]:externalPffft?["-msimd128"]:[],linkedSources=usesChucKRuntime?[...cppSources,adapter]:[adapter,...cppSources];
  const report=runRustSource(["compile","wasm","--format","json"],activeSourceTool,{cCompiler:"emcc",cxxCompiler:"em++",artifact,cSources,linkedSources,includeArguments:prioritizedIncludeArgs,cStandard:"-std=gnu11",cxxStandard:cppStandard,optimizationArguments:optimizationFlags,compileDefinitions,cPlatformDefinitions,cxxPlatformDefinitions:platformDefinitions,cSimdArguments,cxxSimdArguments,linkerArguments:linkerArgs,lto:ltoArgs.includes("-flto"),supportLongjmp:usesBrowserLua,emulateFunctionPointerCasts,stackSize:specializedEffect?1048576:null,initialMemory,allowMemoryGrowth:Boolean(airwinSuite),maximumMemory:airwinSuite?268435456:null});
  const exportedFunctionCount=Number(report.exportedFunctionCount);
  if(path.resolve(String(report.artifact??""))!==artifact||Number(report.compiledCSources)!==cSources.length||Number(report.linkedSources)!==linkedSources.length||!Number.isSafeInteger(exportedFunctionCount)||exportedFunctionCount<=0)fail("Rust compiler returned an inconsistent WASM report");
  return artifact;
}
function numericConstants(source,initial={},owner=null){
  const report=runRustSource(["analyze","constants","--format","json"],activeSourceTool,{source,initial,owner});
  if(!report.constants||typeof report.constants!=="object"||Array.isArray(report.constants))fail("Rust numeric-constant analysis returned invalid values");
  return report.constants
}
function rackWebMemberArrayConstants(source,owner){const prefix=`${owner}::`,constants=numericConstants(source,{},owner);return Object.fromEntries(Object.entries(constants).filter(([name])=>name.startsWith(prefix)&&(/\.size\(\)$/.test(name)||/\]\.name$/.test(name))))}
function fxConfigSpecializationFiles(sourceFiles,moduleClass){const type=/\bFX\s*<\s*([^>]+)\s*>/.exec(moduleClass)?.[1]?.trim();if(!type)return[];const escaped=type.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),pattern=new RegExp(`\\bFXConfig\\s*<\\s*${escaped}\\s*>\\s*::`);return sourceFiles.filter(file=>pattern.test(fs.readFileSync(file,"utf8")))}
function fxConfigConstants(sourceFiles,moduleClass){const type=/\bFX\s*<\s*([^>]+)\s*>/.exec(moduleClass)?.[1]?.trim();if(!type)return{};const escaped=type.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),constants={},sources=sourceFiles.map(file=>fs.readFileSync(file,"utf8"));for(const source of sources){const global=/\bconst\s+int\s+n_fx_params\s*=\s*([^;]+);/.exec(source);if(global){const value=numberLiteral(global[1],Number.NaN,constants);if(Number.isSafeInteger(value))constants.n_fx_params=value}}for(const source of sources){const declaration=/template\s*<[^>]+>\s*struct\s+FXConfig\s*\{/.exec(source);if(!declaration)continue;const open=source.indexOf("{",declaration.index),close=matchingBrace(source,open);if(close<0)continue;const body=source.slice(open+1,close),pattern=/static\s+constexpr\s+(?:int|bool|float)\s+([A-Za-z_]\w*)\s*\(\s*\)\s*\{\s*return\s+([^;]+);/g;for(const match of body.matchAll(pattern)){const value=numberLiteral(match[2],Number.NaN,constants);if(Number.isFinite(value))constants[`FXConfig.${match[1]}`]=Number(value)}}for(const source of sources){const pattern=new RegExp(`template\\s*<>\\s*constexpr\\s+(?:int|bool|float)\\s+FXConfig\\s*<\\s*${escaped}\\s*>\\s*::\\s*([A-Za-z_]\\w*)\\s*\\(\\s*\\)\\s*\\{\\s*return\\s+([^;]+);`,`g`);for(const match of source.matchAll(pattern)){const value=numberLiteral(match[2],Number.NaN,constants);if(Number.isFinite(value))constants[`FXConfig.${match[1]}`]=Number(value)}}return constants}
function surgeFxConfigSpecializations(sourceFiles,moduleClass){const type=/\bFX\s*<\s*([^>]+)\s*>/.exec(moduleClass)?.[1]?.trim();if(!type)return"";const found=[];for(const file of sourceFiles){const source=fs.readFileSync(file,"utf8");for(const candidate of rustSourceDeclarations(source).outOfLineDefinitions){if(!concreteTemplateOwner(candidate,"FXConfig",type)||!/^template\s*<\s*>/.test(candidate.rawDefinition)||["getLayout","addFXSpecificMenuItems"].includes(candidate.member)||rackUiPattern.test(candidate.rawDefinition))continue;found.push(candidate.rawDefinition)}}return[...new Set(found)].join("\n\n")}
function surgeFxMetadataFiles(sourceFiles,moduleClass=""){const files=[...sourceFiles],type=/\bFX\s*<\s*(fxt_[A-Za-z0-9_]+)\s*>/.exec(moduleClass)?.[1],relative={fxt_reverb:"Reverb1Effect.h",fxt_phaser:"PhaserEffect.h",fxt_rotaryspeaker:"RotarySpeakerEffect.h",fxt_distortion:"DistortionEffect.h",fxt_freqshift:"FrequencyShifterEffect.h",fxt_chorus4:"ChorusEffect.h",fxt_vocoder:"VocoderEffect.h",fxt_reverb2:"Reverb2Effect.h",fxt_flanger:"FlangerEffect.h",fxt_ringmod:"RingModulatorEffect.h",fxt_neuron:"chowdsp/NeuronEffect.h",fxt_resonator:"ResonatorEffect.h",fxt_chow:"chowdsp/CHOWEffect.h",fxt_exciter:"chowdsp/ExciterEffect.h",fxt_ensemble:"BBDEnsembleEffect.h",fxt_combulator:"CombulatorEffect.h",fxt_spring_reverb:"chowdsp/SpringReverbEffect.h",fxt_treemonster:"TreemonsterEffect.h",fxt_bonsai:"BonsaiEffect.h",fxt_nimbus:"NimbusEffect.h"}[type],storage=sourceFiles.find(file=>path.basename(file)==="SurgeStorage.h"),root=storage&&path.join(path.dirname(storage),"dsp","effects"),header=root&&relative&&path.join(root,relative);if(header&&fs.existsSync(header)){files.push(header);const cpp=header.replace(/\.h$/,".cpp"),impl=header.replace(/Effect\.h$/,"EffectImpl.h");if(fs.existsSync(cpp))files.push(cpp);if(fs.existsSync(impl))files.push(impl)}for(const file of [...files]){if(!/Effect\.h$/.test(file))continue;const implementation=file.replace(/Effect\.h$/,"EffectImpl.h");if(fs.existsSync(implementation))files.push(implementation)}return[...new Set(files)]}
function surgeFxEnumIds(sourceFiles,constants,moduleClass=""){const ids=new Map;for(const file of surgeFxMetadataFiles(sourceFiles,moduleClass)){const source=fs.readFileSync(file,"utf8");for(const match of source.matchAll(/enum\s+([A-Za-z_]\w*)\s*\{[\s\S]*?\};/g)){const info=enumInfo(match[0],match[1]);for(const [name,id] of enumIds(info,constants))if(!ids.has(name))ids.set(name,id)}}return ids}
function surgeFxActiveParamIds(sourceFiles,constants,moduleClass=""){const ids=surgeFxEnumIds(sourceFiles,constants,moduleClass),active=new Set;for(const file of surgeFxMetadataFiles(sourceFiles,moduleClass)){const source=fs.readFileSync(file,"utf8");for(const match of source.matchAll(/\bfxdata\s*->\s*p\s*\[\s*((?:[A-Za-z_]\w*::)*[A-Za-z_]\w*)\s*\]\s*\.\s*set_type\s*\(/g)){const id=ids.get(match[1].split("::").at(-1));if(id!==undefined)active.add(id)}}return active}
function surgeFxParamNames(sourceFiles,constants,moduleClass=""){
  const expected=constants["FXConfig.numParams"]??constants.n_fx_params??0,metadataFiles=surgeFxMetadataFiles(sourceFiles,moduleClass),candidates=[];
  for(const file of metadataFiles){const source=fs.readFileSync(file,"utf8");if(!/\bParamMetaData\s+paramAt\s*\(/.test(source))continue;const cases=[...source.matchAll(/\bcase\s+[A-Za-z_]\w*\s*:/g)],names=[];for(let index=0;index<cases.length;index++){const segment=source.slice(cases[index].index,cases[index+1]?.index??source.indexOf("default:",cases[index].index));const name=/\.withName\s*\(\s*"([^"]+)"\s*\)/.exec(segment)?.[1];if(name)names.push(name)}if(names.length)candidates.push(names)}
  const enumIdsByName=surgeFxEnumIds(metadataFiles,constants,moduleClass),dynamicNames=[];
  for(const file of metadataFiles){const source=fs.readFileSync(file,"utf8");for(const assignment of source.matchAll(/\bfxdata\s*->\s*p\s*\[\s*((?:[A-Za-z_]\w*::)*[A-Za-z_]\w*)\s*\]\s*\.\s*dynamicName\s*=/g)){const identifier=assignment[1].split("::").at(-1),id=enumIdsByName.get(identifier);if(id===undefined||id<0||id>=expected)continue;for(const candidate of metadataFiles){const body=fs.readFileSync(candidate,"utf8"),caseMatch=new RegExp(`\\bcase\\s+${identifier}\\s*:`).exec(body);if(!caseMatch)continue;const contentStart=caseMatch.index+caseMatch[0].length,rest=body.slice(contentStart),boundary=rest.search(/\bcase\s+[A-Za-z_]\w*\s*:|\bdefault\s*:/),segment=rest.slice(0,boundary<0?undefined:boundary),names=[...segment.matchAll(/\b(?:res|name)\s*=\s*"([^"]+)"/g)].map(match=>match[1]);if(names.length){dynamicNames[id]=names.at(-1);break}}}}
  if(dynamicNames.filter(Boolean).length)candidates.push(dynamicNames);
  for(const file of metadataFiles){const source=fs.readFileSync(file,"utf8"),names=[];for(const match of source.matchAll(/\bfxdata\s*->\s*p\s*\[\s*((?:[A-Za-z_]\w*::)*[A-Za-z_]\w*)\s*\]\s*\.\s*set_name\s*\(\s*"([^"]+)"\s*\)/g)){const identifier=match[1].split("::").at(-1),id=enumIdsByName.get(identifier);if(id===undefined||id<0||id>=expected)continue;let name=match[2];if(/(?:^|_)preeq_/.test(identifier))name=`Pre EQ ${name}`;else if(/(?:^|_)posteq_/.test(identifier))name=`Post EQ ${name}`;else if(/(?:^|_)gain$/.test(identifier)&&name==="Gain")name="Output Gain";names[id]=name}if(names.filter(Boolean).length)candidates.push(names)}
  const merged=[];for(const names of candidates.sort((left,right)=>right.filter(Boolean).length-left.filter(Boolean).length))for(let id=0;id<expected;id++)if(!merged[id]&&names[id])merged[id]=names[id];return merged.slice(0,expected)
}
function surgeFxSpecificParamNames(sourceFiles,moduleClass,constants){const type=/\bFX\s*<\s*([^>]+)\s*>/.exec(moduleClass)?.[1]?.trim();if(!type)return[];const escaped=type.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),names=[];for(const file of sourceFiles){const source=fs.readFileSync(file,"utf8"),match=new RegExp(`FXConfig\\s*<\\s*${escaped}\\s*>\\s*::\\s*configSpecificParams\\s*\\(`).exec(source);if(!match)continue;const open=source.indexOf("{",match.index),close=matchingBrace(source,open);if(open<0||close<0)continue;const body=source.slice(open+1,close);for(const call of body.matchAll(/\b(configOnOff|configOnOffNoRand|configButton|configParam|configParamNoRand|configSwitch)\s*(?:<[^;(){}]+>)?\s*\(/g)){const paren=body.indexOf("(",call.index),end=matchingParenthesis(body,paren);if(end<0)continue;const values=splitArguments(body.slice(paren+1,end)),nameIndex=call[1]==="configButton"?1:call[1].startsWith("configOnOff")?2:4,name=stringLiteral(values[nameIndex],"",constants);if(name)names.push(name)}}return names}
function estimatedStaticMemory(source){
  let bytes=/\bSurgeStorage\b/.test(source)?16*1024*1024:0;
  const springTarget=process.argv.some(argument=>/SurgeXTFXSpringReverb/.test(argument));
  if(springTarget||/\b(?:fxt_spring_reverb|SpringReverbEffect)\b/.test(source))bytes+=96*1024*1024;
  // Polyphonic tape loops allocate one maximum-length delay buffer per active
  // channel on the audio thread. Reserve enough fixed WASM memory for all 16
  // Rack channels at 48 kHz instead of allowing the allocator to trap.
  if(/\bclass\s+TapeLoop\b/.test(source)&&/\bbuffer\.resize\s*\(\s*bufferLength\s*\)/.test(source))bytes=Math.max(bytes,64*1024*1024);
  // The browser adapter reduces PortlandWeather's three fixed rings to 2^23
  // frames. Reserve their 128 MiB payload plus allocator/runtime headroom so
  // compilation does not repeatedly relink at progressively larger memories.
  if(/\bMultiTapDelayLine\b/.test(source)&&/\bHISTORY_SIZE\b/.test(source)&&/\breverseHistoryBuffer\b/.test(source))bytes=Math.max(bytes,144*1024*1024);
  const constants=numericConstants(source);
  for(const match of source.matchAll(/\b(DoubleRingBuffer|RingBuffer)\s*<\s*(float|double|(?:simd::)?float_4)\s*,\s*([^>]+)>/g)){
    const count=numberLiteral(match[3],Number.NaN,constants);
    if(!Number.isSafeInteger(count)||count<0)continue;
    const width=match[2]==="double"?8:/float_4$/.test(match[2])?16:4;
    bytes+=count*width*(match[1]==="DoubleRingBuffer"?2:1)
  }
  return bytes
}
function pageAlignedMemory(bytes){const page=65536,minimum=4194304,maximum=268435456,value=Math.max(minimum,bytes+minimum);if(value>maximum)fail("Module static memory estimate exceeds the 256 MiB browser limit");return Math.ceil(value/page)*page}
function splitArguments(value){const result=[];let start=0,quote="";const stack=[],pairs={"(":")","{":"}","[":"]","<":">"};for(let index=0;index<value.length;index++){const current=value[index];if(quote){if(current==="\\")index++;else if(current===quote)quote="";continue}if(current==='"'||current==="'"){quote=current;continue}if(Object.hasOwn(pairs,current))stack.push(pairs[current]);else if(stack.at(-1)===current)stack.pop();else if(current===","&&!stack.length){result.push(value.slice(start,index).trim());start=index+1}}result.push(value.slice(start).trim());return result}
function enumCountIdentifier(value){return /^(?:NUM_|kNum[A-Z]|Num[A-Z]|num[A-Z]|.*_LEN$|Count$|COUNT$|.*_COUNT$)/.test(value)}
function enumIds(info,constants={}){const ids=new Map(),known={...constants};let index=0;for(const value of info?.identifiers??[]){if(typeof value==="string"){if(enumCountIdentifier(value))break;const assigned=info?.assignments?.[value];if(assigned!==undefined)index=numberLiteral(assigned,index,known);ids.set(value,index);known[value]=index;index++}else if(value&&typeof value==="object"){const count=Math.max(0,numberLiteral(value.count,0,known));for(let offset=0;offset<count;offset++){const synthetic=/_(?:INPUT|OUTPUT)$/.test(value.base)?value.base.replace(/_(INPUT|OUTPUT)$/,`_${offset+1}_$1`):`${value.base}_${offset+1}`;ids.set(synthetic,index+offset)}ids.set(value.base,index);known[value.base]=index;index+=count}}return ids}
function enumCount(info,constants={}){const known={...constants};let count=0;for(const value of info?.identifiers??[]){if(typeof value==="string"){const assigned=info?.assignments?.[value];if(enumCountIdentifier(value))return assigned===undefined?count:Math.max(0,numberLiteral(assigned,count,known));if(assigned!==undefined)count=numberLiteral(assigned,count,known);known[value]=count;count++}else if(value&&typeof value==="object"){known[value.base]=count;count+=Math.max(0,numberLiteral(value.count,0,known))}}return count}
function rackWebPortLayouts(enums,constants={}){
  const report=runRustSource(["abi","layout","--format","json"],activeSourceTool,{constants,enums});
  if(!report.layouts||typeof report.layouts!=="object")fail("Rust ABI layout omitted port layouts");
  for(const kind of ["params","inputs","outputs","lights"]){const layout=report.layouts[kind];if(layout!==null&&(!layout||!Number.isSafeInteger(layout.count)||!Array.isArray(layout.ids)||layout.ids.some(entry=>!/^[A-Za-z_]\w*$/.test(String(entry?.name??""))||!Number.isSafeInteger(entry?.id))))fail("Rust ABI layout returned invalid port data")}
  return report.layouts;
}
function rackWebIntegers(expressions,constants={}){
  const report=runRustSource(["abi","integers","--format","json"],activeSourceTool,{constants,expressions});
  if(!Array.isArray(report.values)||report.values.length!==expressions.length||report.values.some(value=>value!==null&&!Number.isSafeInteger(value)))fail("Rust integer evaluation returned invalid values");
  return report.values
}
function rackWebNumbers(expressions,constants={}){
  expressions=expressions.map(expression=>typeof expression==="string"?expression:String(expression??""));
  if(!expressions.length)return[];
  const report=runRustSource(["abi","numbers","--format","json"],activeSourceTool,{constants,expressions});
  if(!Array.isArray(report.values)||report.values.length!==expressions.length||report.values.some(value=>value!==null&&!Number.isFinite(value)))fail("Rust number evaluation returned invalid values");
  return report.values
}
function rackWebStrings(expressions,constants={}){
  expressions=expressions.map(expression=>typeof expression==="string"?expression:String(expression??""));
  if(!expressions.length)return[];
  const report=runRustSource(["abi","strings","--format","json"],activeSourceTool,{constants,expressions});
  if(!Array.isArray(report.values)||report.values.length!==expressions.length||report.values.some(value=>value!==null&&typeof value!=="string"))fail("Rust string evaluation returned invalid values");
  return report.values
}
const numericReferencePattern=/\b[A-Za-z_]\w*(?:(?:::[A-Za-z_]\w*)|(?:\.[A-Za-z_]\w*)|(?:\[\s*[^\[\]]+\s*\])|(?:\(\s*\)))+/g;
function numberLiteral(value,fallback,constants={}){
  if(typeof value==="number")return Number.isFinite(value)?value:fallback;
  const raw=String(value??"").trim(),direct=/^[+\-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:e[+\-]?\d+)?)(?:[fFlLuU]+)?$/i;
  if(direct.test(raw)){const result=Number(raw.replace(/[fFlLuU]+$/,""));return Number.isFinite(result)?result:fallback}
  let normalized=raw.replace(/\bstatic_cast\s*<\s*(?:float|double|int|unsigned|long|short|size_t)\s*>\s*\(\s*([^()]+?)\s*\)/g,"($1)").replace(/\(\s*(?:float|double|int|unsigned|long|short|size_t)\s*\)/g,"").replace(/\b((?:\d+(?:\.\d*)?|\.\d+)(?:e[+\-]?\d+)?)[f](?=\b)/gi,"$1").replace(/\b(\d+)[uUlL]+\b/g,"$1").replace(/'([^'\\]|\\.)'/g,(_,character)=>{const escapes={"\\n":"\n","\\r":"\r","\\t":"\t","\\0":"\0","\\\\":"\\","\\'":"'"};return String((escapes[character]??character).charCodeAt(0))});
  if(Object.hasOwn(constants,normalized)&&typeof constants[normalized]==="number")return constants[normalized];
  if(/[A-Za-z_]/.test(normalized)){
    normalized=normalized.replace(numericReferencePattern,reference=>Object.hasOwn(constants,reference)&&typeof constants[reference]==="number"?String(constants[reference]):reference);
    normalized=normalized.replace(/\bstd::log2\s*\(\s*([+\-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+\-]?\d+)?)\s*\)/gi,(_,literal)=>String(Math.log2(Number(literal)))).replace(/\bVCOConfig\s*<[^>]+>\s*::\s*additionalVCOParameterCount\s*\(\s*\)/g,"0").replace(/\bFXConfig\s*<[^>]+>\s*::\s*([A-Za-z_]\w*)\s*\(\s*\)/g,(call,name)=>Object.hasOwn(constants,`FXConfig.${name}`)?String(constants[`FXConfig.${name}`]):call).replace(/\b[A-Za-z_]\w*(?:::[A-Za-z_]\w*)+\.size\s*\(\s*\)/g,call=>Object.hasOwn(constants,call)?String(constants[call]):call);
    normalized=normalized.replace(/\b(?:[A-Za-z_]\w*::)+([A-Za-z_]\w*)\b/g,(qualified,name)=>Object.hasOwn(constants,name)&&typeof constants[name]==="number"?String(constants[name]):qualified).replace(/\b[A-Za-z_]\w*\b/g,name=>Object.hasOwn(constants,name)&&typeof constants[name]==="number"?String(constants[name]):name)
  }
  if(!/^[\d.eE\s()+\-*/%<>?:=]+$/.test(normalized)||/(?:<<<|>>>)/.test(normalized))return fallback;
  try{const result=Function(`"use strict";return (${normalized})`)();return typeof result==="boolean"?Number(result):typeof result==="number"&&Number.isFinite(result)?result:fallback}catch{return fallback}
}
function enumExpressionId(value,ids,constants={}){let expression=String(value??"").replace(/\b(?:(?:[A-Za-z_]\w*)(?:\s*<[^<>]+>)?\s*::)+(?=[A-Za-z_]\w*\b)/g,"").replace(/^\s*::\s*/,"");for(const [name,id] of [...ids].sort((left,right)=>right[0].length-left[0].length))expression=expression.replace(new RegExp(`\\b${name}\\b`,"g"),String(id));const result=numberLiteral(expression,Number.NaN,constants);return Number.isSafeInteger(result)&&result>=0?result:undefined}
function objectExpanderContract(source,body,directBase,namespaces){
  const base=baseTypeName(directBase);
  if(!["MixBaseModule","MixExpanderModule"].includes(base))return null;
  const info=enumInfo(source,"MixTypeId"),types=enumIds(info),token=/\bmixType\s*=\s*([A-Za-z_]\w*)\s*;/.exec(body||"")?.[1],type=types.get(token);
  if(!info||type===undefined)return null;
  return {family:[...(namespaces??[]),"MixModule"].join("::"),role:base==="MixBaseModule"?"base":"member",direction:"right",transport:"object-snapshot",type,maxMembers:16};
}
function adaptHostModelLookups(source,models=[]){let result=String(source??"");for(const model of models){const slash=String(model.key??"").indexOf("/"),plugin=slash>=0?model.key.slice(0,slash):"",slug=slash>=0?model.key.slice(slash+1):"",symbol=model.symbol;if(!plugin||!slug||!symbol)continue;const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");result=result.replace(new RegExp(`\\brack::plugin::getModel\\s*\\(\\s*(["'])${escaped(plugin)}\\1\\s*,\\s*(["'])${escaped(slug)}\\2\\s*\\)`,"g"),symbol)}return result}
function referencedHostModels(source){
  const code=sourceWithoutComments(String(source??"")),lines=code.split(/\r?\n/),candidates=[...new Set([...code.matchAll(/\b(model[A-Z][A-Za-z0-9_]*|the_p[A-Z][A-Za-z0-9_]*Model)\b/g)].map(match=>match[1]))];
  return candidates.filter(symbol=>{
    const escaped=symbol.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),reference=new RegExp(`\\b${escaped}\\b`),declaration=new RegExp(`^[ \\t]*(?:(?:static|inline|extern|constexpr|const|volatile|mutable|typename)[ \\t]+)*([^;=(){}]+?)[ \\t]+([*&][ \\t]*)?${escaped}[ \\t]*(?=[;=({,])`);let referenced=false;
    for(const line of lines){
      if(!reference.test(line))continue;
      const match=declaration.exec(line);if(!match){referenced=true;continue}
      const type=match[1].trim(),indirection=match[2]??"",declaredType=`${type}${indirection}`.replace(/^(?:(?:static|inline|extern|constexpr|const|volatile|mutable|typename)\s+)*/,"").replace(/\s+/g,"");
      if(/\b(?:return|case|if|else|for|while|switch|throw|new|delete)\b/.test(type))continue;
      if(/^(?:(?:rack::)?plugin::)?Model\*$/.test(declaredType))continue;
      return false;
    }
    return referenced;
  })
}
function hostModelCandidate(symbol){
  const rackStyle=/^model(.+)$/.exec(symbol);
  if(rackStyle)return rackStyle[1];
  const gpStyle=/^the_p(.+)Model$/.exec(symbol);
  return gpStyle?.[1]??symbol.replace(/Model$/,"");
}
function dmaTemplateTypes(base,kind){
  const match=new RegExp(`\\bDMA${kind}Module\\s*<([\\s\\S]+)>`).exec(String(base??""));
  return match?splitArguments(match[1]).map(type=>baseTypeName(type)).filter(Boolean):[];
}
function compatibleDmaModels(target,directBase,sourceFiles,manifest){
  if(target.plugin!=="Sparkette")return[];
  if(!directBase){
    const compatibility={
      Integrator:["RAM40964"],
      Accessor:["RAM40964","Microcosm"],
      DMAFX:["RAM40964","Microcosm"],
      RAM40964:["Integrator","Accessor","DMAFX"],
      Microcosm:["Accessor","DMAFX"],
    };
    const slugs=new Set((manifest.modules??[]).map(module=>module.slug));
    return (compatibility[target.model]??[]).filter(model=>slugs.has(model)).map(model=>({key:`${target.plugin}/${model}`,symbol:`model${model}`}));
  }
  const targetKind=/\bDMAExpanderModule\s*</.test(directBase)?"Expander":/\bDMAHostModule\s*</.test(directBase)?"Host":"";
  if(!targetKind)return[];
  const targetTypes=new Set(dmaTemplateTypes(directBase,targetKind)),wantedKind=targetKind==="Expander"?"Host":"Expander",slugs=new Set((manifest.modules??[]).map(module=>module.slug)),models=[];
  for(const file of sourceFiles){
    const source=fs.readFileSync(file,"utf8");
    for(const match of source.matchAll(/\bstruct\s+([A-Za-z_]\w*)\s*:\s*([^{]+)\{/g)){
      const name=match[1],base=declaredBases(source,name)[0],types=dmaTemplateTypes(base,wantedKind);
      if(name===target.model||!slugs.has(name)||!types.some(type=>targetTypes.has(type)))continue;
      models.push({key:`${target.plugin}/${name}`,symbol:`model${name}`});
    }
  }
  return [...new Map(models.map(model=>[model.key,model])).values()];
}
function usesMessageExpander(source){
  return /\b(?:left|right)Expander\s*\.\s*(?:producerMessage|consumerMessage|messageFlipRequested|module|moduleId|requestMessageFlip)\b|\bget(?:Left|Right)?Expander\s*\([^)]*\)\s*\.\s*(?:producerMessage|consumerMessage|messageFlipRequested|module|moduleId|requestMessageFlip)\b/.test(String(source??""));
}
function modelIdentityToken(value){return String(value??"").toLowerCase().replace(/[^a-z0-9]/g,"")}
function messageExpanderContract(source,target,manifest,directBase,sourceFiles=[]){
  const slugs=(manifest.modules??[]).map(module=>module.slug).sort((left,right)=>right.length-left.length);
  const explicit=referencedHostModels(source).map(symbol=>{const candidate=hostModelCandidate(symbol),candidateToken=modelIdentityToken(candidate),slug=slugs.find(value=>{const token=modelIdentityToken(value);return candidateToken===token||candidateToken.endsWith(token)||token.endsWith(candidateToken)})??candidate;return {key:`${target.plugin}/${slug}`,symbol}});
  const models=[...new Map([...explicit,...compatibleDmaModels(target,directBase,sourceFiles,manifest)].map(model=>[model.key,model])).values()].map((model,index)=>({...model,index}));
  return {transport:"message-buffer",direction:"both",capacity:16384,models};
}
function includedClassSource(file,body){
  const root=path.dirname(file),sources=[],directives=preprocessMacroSource(String(body??""),new Map,false).includeDirectives;
  for(const directive of directives){if(directive.angle)continue;const target=path.resolve(root,directive.include);if(target.startsWith(`${root}${path.sep}`)&&fs.existsSync(target))sources.push(fs.readFileSync(target,"utf8"))}
  return sources.join("\n");
}
function directlyIncludedImplementationPrelude(file,sourceDir,alreadyDeclaredNames=new Set){
  const root=path.resolve(sourceDir),parts=[],seen=new Set,resolve=(importer,include)=>{const normalized=include.split(/[\\/]+/).join(path.sep);return[path.resolve(path.dirname(importer),normalized),path.resolve(root,"src",normalized),path.resolve(root,normalized)].find(candidate=>(candidate===root||candidate.startsWith(`${root}${path.sep}`))&&fs.existsSync(candidate)&&fs.statSync(candidate).isFile())};
  const visit=importer=>{
    const source=fs.readFileSync(importer,"utf8"),directives=preprocessMacroSource(source,new Map,false).includeDirectives;
    for(const directive of directives){
      if(directive.angle||!/\.(?:cpp|cc|cxx)$/.test(directive.include))continue;
      const target=resolve(importer,directive.include);if(!target||seen.has(target))continue;
      seen.add(target);visit(target);
      const raw=fs.readFileSync(target,"utf8"),activeDirectives=preprocessMacroSource(raw,new Map,false).includeDirectives,
        systemIncludes=activeDirectives.filter(candidate=>candidate.angle).map(candidate=>candidate.include).filter(browserSafeSystemInclude).map(include=>`#include <${include}>`),
        implementationDefines=rustSourceDeclarations(raw).macroDefinitions.filter(candidate=>!candidate.commented&&candidate.name.endsWith("_IMPLEMENTATION")).map(candidate=>candidate.rawDefinition),
        localIncludes=activeDirectives.filter(candidate=>!candidate.angle).flatMap(candidate=>{const token=candidate.include,header=resolve(target,token);if(!header||!/\.(?:h|hh|hpp|inl)$/.test(header)||["plugin.hpp","rack.hpp"].includes(path.basename(header))||uiHeaderRequired(header,root))return[];const names=declaredDependencyNames(fs.readFileSync(header,"utf8"));return names.some(name=>alreadyDeclaredNames.has(name))?[]:[`#include "${token}"`]});
      const body=implementationDefines.reduce((value,definition)=>value.replace(definition,""),stripRackUiBlocks(sourceWithoutIncludes(raw)));
      parts.push([...new Set([...systemIncludes,...implementationDefines,...localIncludes]),body].filter(Boolean).join("\n"))
    }
  };
  visit(file);
  return[...new Set(parts.filter(Boolean))].join("\n\n")
}
function neighborModelMethods(detected,siblings=[],source=""){
  if(detected.expander?.transport!=="message-buffer")return "";const models=detected.expander.models??[];
  const factoryTypes=[...siblings,...declaredTypeNames(source).map(name=>({name}))],factoryCases=models.map(model=>{const slug=modelIdentityToken(model.key.split("/").at(-1)).replace(/module$/,""),sibling=factoryTypes.find(item=>{const name=modelIdentityToken(item.name).replace(/module$/,"");return name===slug||name.endsWith(slug)||slug.endsWith(name)});return sibling?`      case ${model.index}: return new ${sibling.name};`:""}).filter(Boolean),defaultFactory="new Module";
  return `  rack::plugin::Model* rackWebResolveNeighborModel(int index) override {\n    switch (index) {\n${models.map(model=>`      case ${model.index}: return ${model.symbol};`).join("\n")}\n      default: return nullptr;\n    }\n  }\n  Module* rackWebCreateNeighborModule(int index) override {\n    switch (index) {\n${factoryCases.join("\n")}\n      default: return ${defaultFactory};\n    }\n  }\n`;
}
function stringLiteral(value,fallback,constants={}){try{if(typeof value!=="string")return fallback;let normalized=value.trim();if(Object.hasOwn(constants,normalized)&&typeof constants[normalized]==="string")return constants[normalized]||fallback;normalized=normalized.replace(/\b([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]/g,(reference,name,index)=>{const resolved=numberLiteral(index,Number.NaN,constants),key=Number.isSafeInteger(resolved)?`${name}_${resolved}`:"";return key&&typeof constants[key]==="string"?JSON.stringify(constants[key]):reference}).replace(/\b[A-Za-z_]\w*(?:::[A-Za-z_]\w*)+\s*\[\s*(\d+)\s*\]\.name\b/g,reference=>Object.hasOwn(constants,reference)&&typeof constants[reference]==="string"?JSON.stringify(constants[reference]):reference).replace(/\b(?:std::)?string\s*(?:\{\s*("(?:\\.|[^"\\])*")\s*\}|\(\s*("(?:\\.|[^"\\])*")\s*\))/g,(_,braced,parenthesized)=>braced??parenthesized);const direct=/^"(?:\\.|[^"\\])*"$/.test(normalized);if(direct)return JSON.parse(normalized)||fallback;const concatenated=normalized.replace(/std::to_string\s*\(([^()]*)\)/g,(call,expression)=>{const number=numberLiteral(expression,Number.NaN,constants);return Number.isFinite(number)?JSON.stringify(String(number)):call}),strings=concatenated.match(/"(?:\\.|[^"\\])*"/g)??[],operators=concatenated.replace(/"(?:\\.|[^"\\])*"/g,"");if(strings.length&&/^\s*(?:\+\s*)*$/.test(operators))return strings.map(part=>JSON.parse(part)).join("")||fallback;const formatted=/^(?:rack::)?string::f\s*\((.*)\)$/.exec(normalized);if(!formatted)return fallback;const parts=splitArguments(formatted[1]),format=JSON.parse(parts.shift()),numbers=parts.map(part=>numberLiteral(part,Number.NaN,constants));if(numbers.some(number=>!Number.isFinite(number)))return fallback;let index=0;return format.replace(/%[dic]/g,token=>{const number=numbers[index++]??0;return token==="%c"?String.fromCharCode(number):String(number)})||fallback}catch{return fallback}}
function portKind(name){if(/number of triggers|trigger distribution|pulse width|\bcv\b|_CV(?:_|$)/i.test(name))return"cv";return /clock|gate|trig|reset|run|clear|hold|pulse|record|end of step|\b(?:eoc|eof|eostep|alteostep)\b|\bEND\d*_OUTPUT\b/i.test(name)?"gate":/audio|signal|noise|voice|left|right|mix|wet|dry|stereo|mono|\b(?:input|output|in|out)\s+(?:[lr]|\d+)\b/i.test(name)?"audio":"cv"}
function humanizeEnumIdentifier(identifier,direction){
  const suffix=direction==="IN"?/_INPUT$/:/_OUTPUT$/;
  const acronyms=new Set(["AC","AD","ADSR","AM","BPM","CV","DC","DSP","ENV","EOC","FM","LFO","MIDI","OSC","VCA","VCF","VCO"]),aliases=new Map([["ALTEOSTEP","Alternate end of step"],["ALTEOSTEPPROBA","Alternate end probability"],["ATTACKSLOPE","Attack slope"],["BPMFINE","BPM fine"],["BP","Bipolar"],["BOTHCV","Both CV"],["CVBRIDGE","CV bridge"],["CVSLICES","Slices CV"],["CVSPEED","Speed CV"],["CVSTACK","CV stack"],["DECAYSLOPE","Decay slope"],["DISTTRIGS","Trigger distribution"],["EOSTEP","End of step"],["FALLCV","Fall CV"],["GATEBRIDGE","Gate bridge"],["IN","Input"],["INL","Input L"],["INR","Input R"],["LOOPCROSSFADE","Loop crossfade"],["LOOPEND","Loop end"],["LOOPSTART","Loop start"],["NB","Number"],["NBSLICES","Number of slices"],["NOTELENGTH","Note length"],["NUMTRIGS","Number of triggers"],["OUT","Output"],["OUTL","Output L"],["OUTR","Output R"],["POS","Position"],["POSRESET","Position reset"],["RELEASECROSSFADE","Release crossfade"],["RELEASESLOPE","Release slope"],["RELEASESTART","Release start"],["RISECV","Rise CV"],["SAMPLEEND","Sample end"],["SAMPLESTART","Sample start"],["STEPLENGTH","Step length"],["STEPLENGTHFINE","Step length fine"],["STEPPROBA","Step probability"],["TRIG","Trigger"],["TRIGSTACK","Trigger stack"],["VOCT","V/Oct"]]),normalized=String(identifier??"").replace(suffix,""),whole=aliases.get(normalized.replaceAll("_",""));
  if(whole)return whole;return normalized.split("_").filter(Boolean).map(word=>{if(/^\d+$/.test(word))return word;const match=/^(.*?)(\d+)$/.exec(word),base=match?.[1]??word,number=match?.[2],label=aliases.get(base)??(acronyms.has(base)?base:base.charAt(0)+base.slice(1).toLowerCase());return number?`${label} ${number}`:label}).join(" ");
}
function enumIdentifierForId(ids,id){for(const [name,value] of ids)if(value===id)return name;return null}
function widgetNumberLiteral(value,fallback,constants={}){
  const pixelsPerMillimeter=75/25.4;let normalized=String(value??"").replace(/\bSizeTable\s*<\s*([^<>]+)\s*>\s*::\s*([XY])\b/g,(_,type,axis)=>`SizeTable_${baseTypeName(type)}_${axis}`).replace(/\bdiffY2c\s*<\s*([^,<>]+)\s*,\s*([^<>]+)\s*>\s*\(\s*\)/g,(call,left,right)=>{const a=constants[`SizeTable_${baseTypeName(left)}_Y`],b=constants[`SizeTable_${baseTypeName(right)}_Y`];return Number.isFinite(a)&&Number.isFinite(b)?String((a-b)/2):call}).replace(/\b[A-Za-z_]\w*\s*->\s*cx\s*\(\s*([^()]*)\s*\)/g,(_,width)=>width.trim()?`((box_size_x)-(${width}))/2`:"(box_size_x)/2").replace(/\b([A-Za-z_]\w*)\s*\[[^\]]+\]\s*->\s*box\.size\.([xy])\b/g,"$1_box_size_$2").replace(/\b([A-Za-z_]\w*)\s*->\s*box\.size\.([xy])\b/g,"$1_box_size_$2").replace(/\bbox\.size\.([xy])\b/g,"box_size_$1").replace(/\bthis\s*->\s*([A-Za-z_]\w*)\b/g,"$1").replace(/\b([A-Za-z_]\w*)\.([xy])\b/g,(original,name,axis)=>Object.hasOwn(constants,`${name}_${axis}`)?`${name}_${axis}`:original);
  for(let pass=0;pass<4;pass++)normalized=normalized.replace(/\b([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*\[\s*([^\]]+)\s*\]/g,(original,name,index)=>{const resolved=numberLiteral(index,Number.NaN,constants),key=Number.isSafeInteger(resolved)?`${name}_${resolved}`:"";return key&&(Object.hasOwn(constants,key)||Object.hasOwn(constants,`${key}_0`))?key:original});
  normalized=normalized.replace(/\b(?:rack::)?mm2px\s*\(\s*([^()]+?)\s*\)/g,(call,inner)=>{const resolved=numberLiteral(inner,Number.NaN,constants);return Number.isFinite(resolved)?String(resolved*pixelsPerMillimeter):call});
  return numberLiteral(normalized,fallback,constants)
}
function rackWidgetPosition(expression,constants={},centered=false,vectors=new Map){
  const source=String(expression??"").trim(),reference=vectors.get(source);if(reference)return{...reference,...(centered?{centered:true}:{})};
  let depth=0,quote="",operator=-1;
  for(let index=0;index<source.length;index++){
    const current=source[index];
    if(quote){if(current==="\\")index++;else if(current===quote)quote="";continue}
    if(current==='"'||current==="'"){quote=current;continue}
    if("([{".includes(current)){depth++;continue}
    if(")]}".includes(current)){depth=Math.max(0,depth-1);continue}
    if(depth||!"+-".includes(current))continue;
    let previous=index-1;while(previous>=0&&/\s/.test(source[previous]))previous--;
    if(previous<0||"([,{:+-*/".includes(source[previous]))continue;
    operator=index
  }
  if(operator>=0){
    const left=rackWidgetPosition(source.slice(0,operator),constants,false,vectors),right=rackWidgetPosition(source.slice(operator+1),constants,false,vectors);
    if(left&&right){const sign=source[operator]==="+"?1:-1;return{x:Number((left.x+sign*right.x).toFixed(3)),y:Number((left.y+sign*right.y).toFixed(3)),...(centered?{centered:true}:{})}}
  }
  const vector=/(?:math::)?Vec(?:Px)?\s*\(/.exec(source);if(!vector)return null;const open=source.indexOf("(",vector.index),close=matchingParenthesis(source,open),values=close<0?[]:splitArguments(source.slice(open+1,close));if(values.length!==2)return null;const scalar=value=>widgetNumberLiteral(String(value).replace(/\bbox\.size\.([xy])\b/g,"box_size_$1").replace(/\b([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]/g,(original,name,index)=>{const resolved=numberLiteral(index,Number.NaN,constants),key=Number.isSafeInteger(resolved)?`${name}_${resolved}`:"";return key&&Object.hasOwn(constants,key)?key:original}),Number.NaN,constants);let x=scalar(values[0]),y=scalar(values[1]);if(!Number.isFinite(x)||!Number.isFinite(y))return null;if(/\b(?:rack::)?mm2px\s*\(\s*(?:rack::)?(?:math::)?Vec(?:Px)?\b/.test(source)){const pixelsPerMillimeter=75/25.4;x*=pixelsPerMillimeter;y*=pixelsPerMillimeter}return{x:Number(x.toFixed(3)),y:Number(y.toFixed(3)),...(centered?{centered:true}:{})}
}
function widgetPositionHelpers(source){
  const text=String(source??""),helpers=new Map,pattern=/\b(?:rack::)?(?:math::)?Vec\s+([A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)\s*\(([^;{}]*)\)\s*(?:const\s*)?(?:noexcept\s*)?\{/g;
  for(const match of text.matchAll(pattern)){
    if(!isCodePosition(text,match.index))continue;
    const open=text.indexOf("{",match.index),close=matchingBrace(text,open);
    if(open<0||close<0)continue;
    const returned=/\breturn\s+([^;]+)\s*;/.exec(text.slice(open+1,close));
    if(!returned||!/(?:math::)?Vec\s*\(/.test(returned[1]))continue;
    const parameters=splitArguments(match[2]).map(value=>/([A-Za-z_]\w*)\s*(?:=\s*[\s\S]+)?$/.exec(value.trim())?.[1]);
    if(parameters.some(value=>!value))continue;
    const namespace=namespaceStackAt(text,match.index).join("::"),qualified=match[1].includes("::")?match[1]:[namespace,match[1]].filter(Boolean).join("::"),helper={parameters,expression:returned[1]};
    helpers.set(qualified,helper);
    if(!helpers.has(match[1]))helpers.set(match[1],helper);
    const base=baseTypeName(match[1]);if(!helpers.has(base))helpers.set(base,helper)
  }
  return helpers
}
function expandWidgetPositionHelper(expression,helpers){
  let result=String(expression??"").trim();
  for(let pass=0;pass<4;pass++){
    const call=/^([A-Za-z_]\w*(?:::[A-Za-z_]\w*)*)\s*\(([\s\S]*)\)$/.exec(result),helper=call&&(helpers.get(call[1])??helpers.get(baseTypeName(call[1])));
    if(!call||!helper)break;
    const actuals=splitArguments(call[2]);
    if(actuals.length!==helper.parameters.length)break;
    result=helper.expression;
    for(const [index,parameter] of helper.parameters.entries())result=replaceIdentifierOutsideStrings(result,parameter,`(${actuals[index]})`)
  }
  return result
}
function specializeWidgetModuloBranches(source,constants={}){
  let result=String(source??"");
  for(let pass=0;pass<32;pass++){const match=[...result.matchAll(/\bif\s*\(\s*([A-Za-z_]\w*)\s*%\s*([^)=]+)\s*==\s*([^)]+)\)\s*/g)].find(candidate=>Object.hasOwn(constants,candidate[1]));if(!match)break;let cursor=(match.index??0)+match[0].length,truth="",end=cursor;if(result[cursor]==="{"){const close=matchingBrace(result,cursor);if(close<0)break;truth=result.slice(cursor+1,close);end=close+1}else{const semicolon=result.indexOf(";",cursor);if(semicolon<0)break;truth=result.slice(cursor,semicolon+1);end=semicolon+1}while(/\s/.test(result[end]??""))end++;let alternative="";if(result.slice(end,end+4)==="else"){end+=4;while(/\s/.test(result[end]??""))end++;if(result[end]==="{"){const close=matchingBrace(result,end);if(close<0)break;alternative=result.slice(end+1,close);end=close+1}else{const semicolon=result.indexOf(";",end);if(semicolon<0)break;alternative=result.slice(end,semicolon+1);end=semicolon+1}}const divisor=widgetNumberLiteral(match[2],Number.NaN,constants),expected=widgetNumberLiteral(match[3],Number.NaN,constants),actual=constants[match[1]],selected=Number.isFinite(divisor)&&divisor!==0&&Number.isFinite(expected)&&Number.isFinite(actual)&&actual%divisor===expected?truth:alternative;result=result.slice(0,match.index)+selected+result.slice(end)}
  return result
}
function applyWidgetVectorMutations(source,name,point,constants,resolveMembers){
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),specialized=specializeWidgetModuloBranches(source,constants);
  for(const mutation of specialized.matchAll(new RegExp(`\\b${escaped}\\s*\\.\\s*([xy])\\s*(=|\\+=|-=)\\s*([^;]+)\\s*;`,"g"))){const amount=widgetNumberLiteral(resolveMembers(mutation[3],mutation.index??0),Number.NaN,{...constants,[`${name}_x`]:point.x,[`${name}_y`]:point.y});if(!Number.isFinite(amount))continue;const axis=mutation[1],operator=mutation[2];point[axis]=operator==="="?amount:point[axis]+(operator==="+="?amount:-amount)}
}
function applyCompletedWidgetVectorMutations(source,name,point,constants,resolveMembers){
  const text=String(source??""),loops=[];
  for(const match of text.matchAll(/\bfor\s*\(\s*(?:int|long|auto|unsigned(?:\s+(?:int|long))?|(?:std::)?size_t)\s+([A-Za-z_]\w*)\s*=\s*([^;]+)\s*;\s*\1\s*<\s*([^;]+)\s*;[^)]*\)\s*\{/g)){if(!isCodePosition(text,match.index))continue;const open=text.indexOf("{",match.index),close=matchingBrace(text,open),start=widgetNumberLiteral(match[2],Number.NaN,constants),end=widgetNumberLiteral(match[3],Number.NaN,constants);if(close<0||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<start||end-start>64)continue;loops.push({kind:"numeric",index:match.index,open,close,name:match[1],start,end})}
  for(const match of text.matchAll(/\bfor\s*\(\s*(?:const\s+)?(?:auto(?:\s*&)?|int|long|unsigned(?:\s+(?:int|long))?|(?:std::)?size_t)\s+([A-Za-z_]\w*)\s*:\s*(\{[^{};]+\}|[A-Za-z_]\w*)\s*\)\s*\{/g)){if(!isCodePosition(text,match.index))continue;const open=(match.index??0)+match[0].lastIndexOf("{"),close=matchingBrace(text,open),values=widgetRangeValues(text,match);if(close<0||values.length>64)continue;loops.push({kind:"range",index:match.index,open,close,name:match[1],values})}
  loops.sort((left,right)=>left.index-right.index);let cursor=0;for(const loop of loops){if(loop.index<cursor)continue;applyWidgetVectorMutations(text.slice(cursor,loop.index),name,point,constants,resolveMembers);const body=text.slice(loop.open+1,loop.close),count=loop.kind==="numeric"?loop.end-loop.start:loop.values.length;for(let iteration=0;iteration<count;iteration++){const loopValue=loop.kind==="numeric"?loop.start+iteration:numberLiteral(loop.values[iteration],iteration,constants);applyWidgetVectorMutations(body,name,point,{...constants,[loop.name]:loopValue},resolveMembers)}cursor=loop.close+1}applyWidgetVectorMutations(text.slice(cursor),name,point,constants,resolveMembers)
}
function rackWidgetPositionAt(source,expression,position,constants={},centered=false,vectors=new Map){
  const value=String(expression??"").trim(),resolveMembers=(candidate,at)=>candidate.replace(/(?<!\.)\b([A-Za-z_]\w*)\s*\.\s*([xy])\b/g,(original,name,axis)=>{if(name===value)return original;const point=rackWidgetPositionAt(source,name,at,constants,false,vectors);return point?String(point[axis]):original}),millimeter=/^(?:rack::)?mm2px\s*\(([\s\S]+)\)$/.exec(value),offset=/^([A-Za-z_]\w*)\s*\.\s*(plus|minus)\s*\(([\s\S]+)\)$/.exec(value);
  const indexedVector=/^([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]$/.exec(value);
  if(indexedVector){
    const index=numberLiteral(indexedVector[2],Number.NaN,constants),
      point=Number.isSafeInteger(index)?vectors.get(`${indexedVector[1]}[${index}]`):undefined;
    if(point)return{...point,...(centered?{centered:true}:{})};
  }
  const directVector=vectors.get(value);
  if(directVector)return{...directVector,...(centered?{centered:true}:{})};
  if(millimeter){const point=rackWidgetPositionAt(source,millimeter[1],position,constants,false,vectors);if(point){const pixelsPerMillimeter=75/25.4;return{x:Number((point.x*pixelsPerMillimeter).toFixed(3)),y:Number((point.y*pixelsPerMillimeter).toFixed(3)),...(centered?{centered:true}:{})}}}
  if(offset){const origin=rackWidgetPositionAt(source,offset[1],position,constants,false,vectors),delta=rackWidgetPosition(resolveMembers(offset[3],position),constants);if(origin&&delta){const sign=offset[2]==="plus"?1:-1;return{x:Number((origin.x+sign*delta.x).toFixed(3)),y:Number((origin.y+sign*delta.y).toFixed(3)),...(centered?{centered:true}:{})}}}
  if(/^[A-Za-z_]\w*$/.test(value)){
    const prefix=source.slice(0,position),escaped=value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),assignments=[...prefix.matchAll(new RegExp(`(?:\\b(?:const\\s+)?(?:rack::)?(?:math::)?Vec\\s+)?\\b${escaped}\\s*=\\s*((?:rack::)?(?:math::)?Vec\\s*\\([^;]+?\\))\\s*;`,"g"))].map(match=>({index:match.index,end:(match.index??0)+match[0].length,expression:match[1]}));
    for(const statement of prefix.matchAll(/\b(?:const\s+)?(?:rack::)?(?:math::)?Vec\s+([^;]+)\s*;/g))for(const declaration of splitArguments(statement[1])){const constructor=new RegExp(`^\\s*${escaped}\\s*\\(([\\s\\S]+)\\)\\s*$`).exec(declaration);if(constructor)assignments.push({index:statement.index,end:(statement.index??0)+statement[0].length,expression:`Vec(${constructor[1]})`})}
    assignments.sort((left,right)=>(left.index??0)-(right.index??0));const assignment=assignments.at(-1);
    if(assignment){
      const resolvedAssignment=resolveMembers(assignment.expression,assignment.index??position),base=rackWidgetPosition(resolvedAssignment,constants,false,vectors);
      if(base){
        const point={x:base.x,y:base.y},loops=[];
        for(const loop of source.matchAll(/\bfor\s*\(\s*(?:int|long|auto|unsigned(?:\s+(?:int|long))?|(?:std::)?size_t)\s+([A-Za-z_]\w*)\s*=\s*([^;]+)\s*;\s*\1\s*<\s*([^;]+)\s*;[^)]*\)\s*\{/g)){const open=source.indexOf("{",loop.index),close=matchingBrace(source,open);if(open>assignment.end&&open<position&&close>=position)loops.push({kind:"numeric",name:loop[1],start:loop[2],index:loop.index,open,close})}
        for(const range of source.matchAll(/\bfor\s*\(\s*(?:const\s+)?(?:auto(?:\s*&)?|int|long|unsigned(?:\s+(?:int|long))?|(?:std::)?size_t)\s+([A-Za-z_]\w*)\s*:\s*(\{[^{};]+\}|[A-Za-z_]\w*)\s*\)\s*\{/g)){const open=(range.index??0)+range[0].lastIndexOf("{"),close=matchingBrace(source,open);if(open<=assignment.end||open>=position||close<position)continue;const values=widgetRangeValues(source,range),current=constants[range[1]],resolved=values.map((expression,index)=>{const numeric=numberLiteral(expression,Number.NaN,constants);return Number.isFinite(numeric)?numeric:index}),iteration=resolved.findIndex(candidate=>candidate===current),body=source.slice(open+1,close),before=source.slice(0,range.index),counters=[];for(const increment of body.matchAll(/(?:\+\+\s*([A-Za-z_]\w*)|([A-Za-z_]\w*)\s*\+\+)/g)){const name=increment[1]??increment[2],assignments=[...before.matchAll(new RegExp(`\\b${name}\\s*=\\s*([^;]+)\\s*;`,"g"))].filter(candidate=>isCodePosition(before,candidate.index)),initial=assignments.at(-1)?.[1];if(initial!==undefined)counters.push({name,initial})}loops.push({kind:"range",name:range[1],index:range.index,open,close,values:resolved,iteration:iteration>=0?iteration:Number.isFinite(current)?Math.max(0,Math.trunc(current)):0,counters})}
        const loop=loops.sort((left,right)=>right.open-left.open)[0];
        if(loop){
          applyCompletedWidgetVectorMutations(source.slice(assignment.end,loop.index),value,point,constants,resolveMembers);
          const start=loop.kind==="numeric"?widgetNumberLiteral(loop.start,Number.NaN,constants):0,iterations=loop.kind==="numeric"&&Number.isFinite(start)&&Number.isFinite(constants[loop.name])?Math.max(0,Math.trunc(constants[loop.name]-start)):loop.kind==="range"?loop.iteration:0,body=source.slice(loop.open+1,loop.close);
          for(let iteration=0;iteration<iterations;iteration++){const iterationConstants={...constants,[loop.name]:loop.kind==="range"?(loop.values[iteration]??iteration):start+iteration};for(const counter of loop.counters??[]){const initial=numberLiteral(counter.initial,Number.NaN,constants);if(Number.isFinite(initial))iterationConstants[counter.name]=initial+iteration}applyWidgetVectorMutations(body,value,point,iterationConstants,resolveMembers)}
          applyWidgetVectorMutations(source.slice(loop.open+1,position),value,point,constants,resolveMembers)
        }else applyCompletedWidgetVectorMutations(prefix.slice(assignment.end),value,point,constants,resolveMembers);
        return{x:Number(point.x.toFixed(3)),y:Number(point.y.toFixed(3)),...(centered?{centered:true}:{})}
      }
    }
  }
  return rackWidgetPosition(resolveMembers(value,position),constants,centered,vectors)
}
function widgetNumericConstants(source,initial={}){
  const constants={...initial},text=String(source??"").replace(/\bbox\.size\.([xy])\b/g,"box_size_$1"),declarations=/\b(?:const\s+)?(bool|float|double|int|long|unsigned(?:\s+(?:int|long))?|size_t|auto)\s+([A-Za-z_]\w*)\s*=\s*([^;]+)\s*;/g,multipleDeclarations=/\b(?:const\s+)?(bool|float|double|int|long|unsigned(?:\s+(?:int|long))?|size_t|auto)\s+([^;]+)\s*;/g,assignments=/(?<![>.])\b([A-Za-z_]\w*)\s*=\s*([^;]+)\s*;/g,arrays=/\b(?:const\s+)?(?:float|double|int|long|unsigned(?:\s+(?:int|long))?|size_t)\s+([A-Za-z_]\w*)\s*\[\s*[^\]]*\s*\]\s*(?:=\s*)?\{([^{};]+)\}\s*;/g,genericArrays=/\b([A-Za-z_]\w*)\s*\[\s*[^\]]*\s*\]\s*(?:=\s*)?\{([^{};]+)\}/g,matrixArrays=/\b(?:const\s+)?(?:float|double|int|long|unsigned(?:\s+(?:int|long))?|size_t)\s+([A-Za-z_]\w*)\s*\[\s*[^\]]*\s*\]\s*\[\s*[^\]]*\s*\]\s*(?:=\s*)?\{([\s\S]*?)\}\s*;/g,declarationMatches=[...text.matchAll(declarations)].filter(match=>isCodePosition(text,match.index)),declarationTypes=new Map(declarationMatches.map(match=>[match[2],match[1]])),declarationSpans=declarationMatches.map(match=>[match.index,match.index+match[0].length]),typedValue=(name,value,type=declarationTypes.get(name))=>{if(type==="bool")return Number(Boolean(value));return /^(?:int|long|unsigned(?:\s+(?:int|long))?|size_t)$/.test(type??"")?Math.trunc(value):value};
  const vectorAliases=/\b(?:const\s+)?(?:auto|(?:rack::)?(?:math::)?Vec)\s+([A-Za-z_]\w*)\s*=\s*box\.size\s*;/g,vectorMutations=/\b([A-Za-z_]\w*)\s*\.\s*([xy])\s*(=|\+=|-=|\*=|\/=)\s*([^;]+)\s*;/g;
  for(const match of text.matchAll(matrixArrays)){if(!isCodePosition(text,match.index))continue;for(const [row,rowMatch] of [...match[2].matchAll(/\{([^{}]+)\}/g)].entries())for(const [column,item] of splitArguments(rowMatch[1]).entries()){const value=widgetNumberLiteral(item,Number.NaN,constants);if(Number.isFinite(value))constants[`${match[1]}_${row}_${column}`]=value}}
  for(const match of text.matchAll(arrays)){if(!isCodePosition(text,match.index))continue;for(const [index,item] of splitArguments(match[2]).entries()){const value=widgetNumberLiteral(item,Number.NaN,constants);if(Number.isFinite(value))constants[`${match[1]}_${index}`]=value}}
  for(const match of text.matchAll(genericArrays)){if(!isCodePosition(text,match.index))continue;for(const [index,item] of splitArguments(match[2]).entries()){const value=widgetNumberLiteral(item,Number.NaN,constants);if(Number.isFinite(value))constants[`${match[1]}_${index}`]=value}}
  const raw=String(source??""),vectorAliasNames=new Set;for(const alias of raw.matchAll(vectorAliases)){if(!isCodePosition(raw,alias.index))continue;vectorAliasNames.add(alias[1]);if(Number.isFinite(constants.box_size_x))constants[`${alias[1]}_x`]=constants.box_size_x;if(Number.isFinite(constants.box_size_y))constants[`${alias[1]}_y`]=constants.box_size_y;for(const mutation of raw.matchAll(vectorMutations)){if(mutation.index<alias.index||mutation[1]!==alias[1]||!isCodePosition(raw,mutation.index))continue;const key=`${mutation[1]}_${mutation[2]}`,current=constants[key],value=widgetNumberLiteral(mutation[4],Number.NaN,constants);if(!Number.isFinite(current)||!Number.isFinite(value))continue;constants[key]=mutation[3]==="="?value:mutation[3]==="+="?current+value:mutation[3]==="-="?current-value:mutation[3]==="*="?current*value:value===0?current:current/value}}
  for(const mutation of raw.matchAll(vectorMutations)){if(vectorAliasNames.has(mutation[1])||!isCodePosition(raw,mutation.index))continue;const key=`${mutation[1]}_${mutation[2]}`,current=constants[key],value=widgetNumberLiteral(mutation[4],Number.NaN,constants);if(!Number.isFinite(value))continue;if(mutation[3]==="=")constants[key]=value;else if(Number.isFinite(current))constants[key]=mutation[3]==="+="?current+value:mutation[3]==="-="?current-value:mutation[3]==="*="?current*value:value===0?current:current/value}
  for(let pass=0;pass<4;pass++){for(const match of text.matchAll(multipleDeclarations)){if(!isCodePosition(text,match.index))continue;for(const part of splitArguments(match[2])){const field=/^\s*([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/.exec(part);if(!field)continue;const value=widgetNumberLiteral(field[2],Number.NaN,constants);if(Number.isFinite(value)){declarationTypes.set(field[1],match[1]);constants[field[1]]=typedValue(field[1],value,match[1])}}}for(const match of declarationMatches){const value=widgetNumberLiteral(match[3],Number.NaN,constants);if(Number.isFinite(value))constants[match[2]]=typedValue(match[2],value)}for(const match of text.matchAll(assignments)){if(!isCodePosition(text,match.index)||declarationSpans.some(([start,end])=>match.index>=start&&match.index<end))continue;const value=widgetNumberLiteral(match[2],Number.NaN,constants);if(Number.isFinite(value))constants[match[1]]=typedValue(match[1],value)}}
  return constants
}
function widgetCompoundConstants(source,initial={}){
  const constants={...initial};
  const text=String(source??"");
  for(const match of text.matchAll(/\b([A-Za-z_]\w*)\s*\[[^\]]+\]\s*->\s*box\.size\s*=\s*((?:rack::)?(?:math::)?Vec\s*\([^;]+?\))\s*;/g)){if(!isCodePosition(text,match.index))continue;const position=rackWidgetPosition(match[2],constants);if(position){constants[`${match[1]}_box_size_x`]=position.x;constants[`${match[1]}_box_size_y`]=position.y}}
  for(const match of text.matchAll(/\b([A-Za-z_]\w*)\s*(\+=|-=)\s*([^;]+)\s*;/g)){if(!isCodePosition(text,match.index))continue;const current=widgetNumberLiteral(match[1],Number.NaN,constants),delta=widgetNumberLiteral(match[3],Number.NaN,constants);if(Number.isFinite(current)&&Number.isFinite(delta))constants[match[1]]=current+(match[2]==="+="?delta:-delta)}
  return constants
}
function widgetSourceConstants(sourceFiles=[]){
  const constants={RACK_GRID_WIDTH:15,RACK_GRID_HEIGHT:380};
  for(let pass=0;pass<4;pass++)for(const file of sourceFiles){const source=fs.readFileSync(file,"utf8"),scalars=/\b(?:static\s+)?(?:constexpr|const)\s+(?:float|double|int|long|unsigned(?:\s+(?:int|long))?|size_t)\s+([A-Za-z_]\w*)\s*(?:=\s*([^;{}]+)|\{\s*([^{};]+)\s*\})\s*;/g,globals=/\b(?:float|double|int|long|unsigned(?:\s+(?:int|long))?|size_t)\s+([A-Z][A-Z0-9_]*)\s*=\s*([^;{}]+)\s*;/g,arrays=/\b(?:static\s+)?constexpr\s+std::array\s*<\s*(?:float|double|int|long|unsigned(?:\s+(?:int|long))?|size_t)\s*,\s*\d+\s*>\s+([A-Za-z_]\w*)\s*(?:=\s*)?\{([^{};]+)\}\s*;/g,objects=/\b(?:inline\s+)?constexpr\s+[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*\s+([A-Za-z_]\w*)\s*\{/g,sizeTables=/\btemplate\s*<>\s*struct\s+SizeTable\s*<\s*([^<>]+)\s*>\s*\{/g;for(const candidate of rustSourceDeclarations(source).macroDefinitions){if(candidate.commented||candidate.functionLike)continue;const value=numberLiteral(candidate.replacement,Number.NaN,constants);if(Number.isFinite(value))constants[candidate.name]=value}for(const match of source.matchAll(scalars)){const value=numberLiteral(match[2]??match[3],Number.NaN,constants);if(Number.isFinite(value))constants[match[1]]=value}for(const match of source.matchAll(globals)){if(braceDepthAt(source,match.index)!==namespaceStackAt(source,match.index).length)continue;const value=numberLiteral(match[2],Number.NaN,constants);if(Number.isFinite(value))constants[match[1]]=value}for(const match of source.matchAll(arrays))for(const [index,item] of splitArguments(match[2]).entries()){const value=numberLiteral(item,Number.NaN,constants);if(Number.isFinite(value))constants[`${match[1]}_${index}`]=value}for(const match of source.matchAll(sizeTables)){const open=source.indexOf("{",match.index),close=matchingBrace(source,open);if(close<0)continue;for(const field of source.slice(open+1,close).matchAll(/\b(?:constexpr\s+)?(?:static\s+)?(?:const\s+)?(?:float|double|int)\s+([XY])\s*=\s*([^;]+)\s*;/g)){const value=numberLiteral(field[2],Number.NaN,constants);if(Number.isFinite(value))constants[`SizeTable_${baseTypeName(match[1])}_${field[1]}`]=value}}for(const match of source.matchAll(objects)){const open=source.indexOf("{",match.index),close=matchingBrace(source,open);if(close<0)continue;const body=source.slice(open+1,close);for(const field of body.matchAll(/\.([A-Za-z_]\w*)\s*=\s*\{([^{};]+)\}/g))for(const [index,item] of splitArguments(field[2]).entries()){const value=numberLiteral(item,Number.NaN,constants);if(Number.isFinite(value))constants[`${match[1]}.${field[1]}_${index}`]=value}for(const field of body.matchAll(/\.([A-Za-z_]\w*)\s*=\s*([^,}\n]+)/g)){const value=numberLiteral(field[2],Number.NaN,constants);if(Number.isFinite(value))constants[`${match[1]}.${field[1]}`]=value}}}
  return constants
}
function widgetInheritanceSource(sourceFiles,registeredWidgetClass){
  const queue=[registeredWidgetClass],seen=new Set,sources=[];
  while(queue.length){
    const type=queue.shift(),identity=String(type).replace(/\s/g,""),name=baseTypeName(type);
    if(!name||seen.has(identity)||["ModuleWidget","SchemeModuleWidget"].includes(name))continue;
    seen.add(identity);
    for(const file of sourceFiles){
      const source=fs.readFileSync(file,"utf8"),body=plainStructBody(source,name);
      if(body===null)continue;
      const contract=templateContract(source,type),bindings=Object.fromEntries((contract?.parameters??[]).map((parameter,index)=>[parameter,contract.arguments[index]??parameter])),specializedBody=substituteType(body,bindings),implementations=sourceFiles.flatMap(candidate=>{const candidateSource=fs.readFileSync(candidate,"utf8");return rawOutOfLineDefinitions(candidate,candidateSource,name)}).map(definition=>substituteType(definition,bindings));
      sources.push(specializedBody,...implementations);
      for(const base of declaredBases(source,name))queue.push(substituteType(base,bindings));
      break
    }
  }
  return sources.join("\n")
}
function widgetSupportFiles(sourceDir,root){
  const sourceRoot=path.resolve(sourceDir),localRoot=path.join(sourceRoot,"src"),queue=[{file:root,depth:0}],found=new Set;while(queue.length){const {file,depth}=queue.shift();if(!file||found.has(file)||!fs.existsSync(file)||!fs.statSync(file).isFile())continue;found.add(file);if(depth>=3)continue;const source=fs.readFileSync(file,"utf8");for(const include of rawIncludes(file,source)){const normalized=include.split(/[\\/]+/).join(path.sep),candidate=[path.resolve(path.dirname(file),normalized),path.resolve(localRoot,normalized),path.resolve(sourceRoot,normalized)].find(value=>(value===localRoot||value.startsWith(`${localRoot}${path.sep}`))&&fs.existsSync(value)&&fs.statSync(value).isFile());if(candidate&&!found.has(candidate))queue.push({file:candidate,depth:depth+1})}}return[...found]
}
function widgetCoordinateHelperSource(sourceFiles){
  return sourceFiles.map(file=>fs.readFileSync(file,"utf8")).filter(source=>/\b(?:rack::)?(?:math::)?Vec\s+[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*\s*\([^;{}]*\)\s*(?:const\s*)?(?:noexcept\s*)?\{[\s\S]*?\breturn\s+(?:rack::)?(?:math::)?Vec\s*\(/.test(source)).join("\n")
}
function widgetRangeValues(source,match){
  const expression=match[2].trim();
  if(expression.startsWith("{"))return splitArguments(expression.slice(1,-1));
  const escaped=expression.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),before=source.slice(0,match.index),initializers=[...before.matchAll(new RegExp(`\\b${escaped}\\s*(?:=\\s*)?\\{([^{};]+)\\}\\s*;`,"g"))].filter(candidate=>isCodePosition(before,candidate.index));
  return splitArguments(initializers.at(-1)?.[1]??"")
}
function completedCounterAdvance(source,name,constants={}){const increment=new RegExp(`(?:\\+\\+\\s*${name}\\b|\\b${name}\\s*\\+\\+)`),range=/\bfor\s*\(\s*(?:const\s+)?(?:auto(?:\s*&)?|int|long|unsigned(?:\s+(?:int|long))?|(?:std::)?size_t)\s+([A-Za-z_]\w*)\s*:\s*(\{[^{};]+\}|[A-Za-z_]\w*)\s*\)\s*\{/g,numeric=/\bfor\s*\(\s*(?:int|long|auto|unsigned(?:\s+(?:int|long))?|(?:std::)?size_t)\s+([A-Za-z_]\w*)\s*=\s*([^;]+)\s*;\s*\1\s*<\s*([^;]+)\s*;[^)]*\)\s*\{/g;let total=0;for(const match of source.matchAll(range)){if(!isCodePosition(source,match.index))continue;const open=match.index+match[0].lastIndexOf("{"),close=matchingBrace(source,open);if(close<0||!increment.test(source.slice(open+1,close)))continue;total+=widgetRangeValues(source,match).length}for(const match of source.matchAll(numeric)){if(!isCodePosition(source,match.index))continue;const open=source.indexOf("{",match.index),close=matchingBrace(source,open),start=numberLiteral(match[2],Number.NaN,constants),end=numberLiteral(match[3],Number.NaN,constants);if(close<0||!increment.test(source.slice(open+1,close))||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<start)continue;total+=end-start}return total}
function widgetLoopIterationConstants(source,initial={}){
  const constants={...initial},text=specializeWidgetModuloBranches(source,constants),operations=/\b([A-Za-z_]\w*)\s*(\+=|-=|=)\s*([^;]+)\s*;|(?:\+\+\s*([A-Za-z_]\w*)\b|\b([A-Za-z_]\w*)\s*\+\+)|(?:--\s*([A-Za-z_]\w*)\b|\b([A-Za-z_]\w*)\s*--)/g;
  for(const match of text.matchAll(operations)){if(!isCodePosition(text,match.index)||braceDepthAt(text,match.index)!==0)continue;const name=match[1]??match[4]??match[5]??match[6]??match[7];if(!Object.hasOwn(constants,name)||!Number.isFinite(constants[name]))continue;if(match[1]){const value=widgetNumberLiteral(match[3],Number.NaN,constants);if(!Number.isFinite(value))continue;constants[name]=match[2]==="="?value:constants[name]+(match[2]==="+="?value:-value)}else constants[name]+=match[4]||match[5]?1:-1}
  return constants
}
function widgetPlacementContexts(source,position,constants={}){
  const loops=[];
  for(const match of source.matchAll(/\bfor\s*\(\s*(?:(?:int|long|auto|unsigned(?:\s+(?:int|long))?|(?:std::)?size_t)\s+)?([A-Za-z_]\w*)\s*=\s*([^;]+)\s*;\s*\1\s*<\s*([^;]+)\s*;\s*(?:\+\+\s*\1|\1\s*\+\+)\s*\)\s*\{/g)){if(match.index>=position)break;if(!isCodePosition(source,match.index))continue;const open=source.indexOf("{",match.index),close=matchingBrace(source,open);if(open<0||close<position)continue;const start=widgetNumberLiteral(match[2],Number.NaN,constants),end=widgetNumberLiteral(match[3],Number.NaN,constants);if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<=start||end-start>64)continue;loops.push({kind:"numeric",name:match[1],start,end,open,close,index:match.index})}
  for(const match of source.matchAll(/\bfor\s*\(\s*(?:(?:int|long|auto|unsigned(?:\s+(?:int|long))?|(?:std::)?size_t)\s+)?([A-Za-z_]\w*)\s*=\s*([^;]+)\s*;\s*\1\s*<\s*([^;]+)\s*;\s*(?:\+\+\s*\1|\1\s*\+\+)\s*\)/g)){if(match.index>=position)break;if(!isCodePosition(source,match.index))continue;let statementStart=match.index+match[0].length;while(/\s/.test(source[statementStart]??""))statementStart++;if(source[statementStart]==="{")continue;const statementEnd=source.indexOf(";",statementStart);if(statementEnd<position)continue;const start=widgetNumberLiteral(match[2],Number.NaN,constants),end=widgetNumberLiteral(match[3],Number.NaN,constants);if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<=start||end-start>64)continue;loops.push({kind:"numeric",name:match[1],start,end,open:statementStart-1,close:statementEnd,index:match.index})}
  for(const match of source.matchAll(/\bfor\s*\(\s*(?:const\s+)?(?:auto(?:\s*&)?|int|long|unsigned(?:\s+(?:int|long))?|(?:std::)?size_t)\s+([A-Za-z_]\w*)\s*:\s*(\{[^{};]+\}|[A-Za-z_]\w*)\s*\)\s*\{/g)){if(match.index>=position)break;if(!isCodePosition(source,match.index))continue;const open=match.index+match[0].lastIndexOf("{"),close=matchingBrace(source,open);if(open<0||close<position)continue;const body=source.slice(open+1,close),before=source.slice(0,match.index),counters=[];for(const increment of body.matchAll(/(?:\+\+\s*([A-Za-z_]\w*)|([A-Za-z_]\w*)\s*\+\+)/g)){if(!isCodePosition(body,increment.index))continue;const name=increment[1]??increment[2],assignments=[...before.matchAll(new RegExp(`\\b${name}\\s*=\\s*([^;]+)\\s*;`,"g"))].filter(assignment=>isCodePosition(before,assignment.index)),assignment=assignments.at(-1),initial=assignment?.[1];if(initial!==undefined)counters.push({name,initial,advance:completedCounterAdvance(before.slice((assignment.index??0)+assignment[0].length),name,constants)})}loops.push({kind:"range",name:match[1],values:widgetRangeValues(source,match),counters,open,close,index:match.index})}
  loops.sort((left,right)=>left.index-right.index);let contexts=[{...constants}];for(const loop of loops){const expanded=[];for(const context of contexts){const body=source.slice(loop.open+1,loop.close);if(loop.kind==="numeric"){let running={...context};for(let value=loop.start;value<loop.end;value++){const next={...running,[loop.name]:value};expanded.push(next);running=widgetLoopIterationConstants(body,next)}}else{let running={...context};for(const [index,expression] of loop.values.entries()){const parsed=numberLiteral(expression,Number.NaN,running),next={...running,[loop.name]:Number.isFinite(parsed)?parsed:index};for(const counter of loop.counters){const initial=numberLiteral(counter.initial,Number.NaN,context);if(Number.isFinite(initial))next[counter.name]=initial+(counter.advance??0)+index}expanded.push(next);running=widgetLoopIterationConstants(body,next)}}}contexts=expanded}
  if(!contexts.length)contexts=[{...constants}];const localStart=loops.at(-1)?.open+1??Math.max(0,position-4000),prefix=source.slice(localStart,position);return contexts.map(context=>widgetCompoundConstants(prefix,widgetNumericConstants(prefix,context)))
}
function specializeWidgetConstexprBranches(source,constants){
  let result=String(source??"");
  for(let pass=0;pass<64;pass++){
    const match=[...result.matchAll(/\bif\s+constexpr\s*\(\s*(!?)\s*([A-Za-z_]\w*)\s*\)\s*\{/g)].find(candidate=>isCodePosition(result,candidate.index));
    if(!match||!Object.hasOwn(constants,match[2]))break;
    const open=result.indexOf("{",match.index),close=matchingBrace(result,open);
    if(close<0)break;
    let end=close+1,alternative="",cursor=end;
    while(/\s/.test(result[cursor]??""))cursor++;
    if(result.slice(cursor,cursor+4)==="else"){cursor+=4;while(/\s/.test(result[cursor]??""))cursor++;if(result[cursor]==="{"){const alternativeClose=matchingBrace(result,cursor);if(alternativeClose<0)break;alternative=result.slice(cursor+1,alternativeClose);end=alternativeClose+1}}
    const truthy=Boolean(constants[match[2]])!==Boolean(match[1]);
    result=result.slice(0,match.index)+(truthy?result.slice(open+1,close):alternative)+result.slice(end)
  }
  return result
}
function specializeWidgetBooleanBranches(source,constants){
  let result=String(source??"");
  for(let pass=0;pass<64;pass++){
    const match=[...result.matchAll(/\bif\s*\(\s*(!?)\s*(?:this\s*->\s*)?([A-Za-z_]\w*)\s*\)\s*\{/g)].find(candidate=>Object.hasOwn(constants,candidate[2]));
    if(!match)break;
    const open=result.indexOf("{",match.index),close=matchingBrace(result,open);
    if(close<0)break;
    let end=close+1,alternative="",cursor=end;
    while(/\s/.test(result[cursor]??""))cursor++;
    if(result.slice(cursor,cursor+4)==="else"){cursor+=4;while(/\s/.test(result[cursor]??""))cursor++;if(result[cursor]==="{"){const alternativeClose=matchingBrace(result,cursor);if(alternativeClose<0)break;alternative=result.slice(cursor+1,alternativeClose);end=alternativeClose+1}}
    const truthy=Boolean(constants[match[2]])!==Boolean(match[1]);
    result=result.slice(0,match.index)+(truthy?result.slice(open+1,close):alternative)+result.slice(end)
  }
  return result
}
function widgetConditionalContextActive(source,position,constants={}){
  const text=String(source??"");
  for(const match of text.matchAll(/\bif\s*\(\s*([^()]+?)\s*\)\s*\{/g)){
    if((match.index??0)>=position||!isCodePosition(text,match.index))break;
    const open=(match.index??0)+match[0].lastIndexOf("{"),close=matchingBrace(text,open);
    if(close<0)continue;
    const value=widgetNumberLiteral(match[1],Number.NaN,constants);
    if(!Number.isFinite(value))continue;
    if(position>open&&position<close){
      if(!value)return false;
      continue
    }
    let cursor=close+1;
    while(/\s/.test(text[cursor]??""))cursor++;
    if(text.slice(cursor,cursor+4)!=="else")continue;
    cursor+=4;
    while(/\s/.test(text[cursor]??""))cursor++;
    if(text[cursor]!=="{")continue;
    const alternativeClose=matchingBrace(text,cursor);
    if(position>cursor&&position<alternativeClose&&value)return false
  }
  return true
}
function rackWidgetPlacements(source,enums,constants={},supportSource="",depth=0){
  const panelConstants=depth===0&&!Number.isFinite(constants.box_size_y)?{...constants,box_size_y:380}:constants,rawText=String(source??""),booleanText=specializeWidgetBooleanBranches(rawText,panelConstants),supportConstants=widgetNumericConstants(supportSource,panelConstants),preliminaryConstants=widgetNumericConstants(booleanText,supportConstants),text=specializeWidgetConstexprBranches(booleanText,preliminaryConstants),widgetConstants=widgetNumericConstants(text,preliminaryConstants),coordinateText=`${supportSource}\n${text}`,positionHelpers=widgetPositionHelpers(`${supportSource}\n${rawText}`),expandPosition=value=>expandWidgetPositionHelper(value,positionHelpers);let panelSize=null;for(const match of text.matchAll(/(?<![>.])\bbox\.size\s*=\s*((?:rack::)?(?:math::)?Vec\s*\([^;]+?\))\s*;/g)){if(!isCodePosition(text,match.index))continue;const size=rackWidgetPosition(match[1],widgetConstants);if(size){panelSize=size;widgetConstants.box_size_x=size.x;widgetConstants.box_size_y=size.y;break}}Object.assign(widgetConstants,widgetNumericConstants(text,widgetConstants));const ids={params:enumIds(enums.params,widgetConstants),inputs:enumIds(enums.inputs,widgetConstants),outputs:enumIds(enums.outputs,widgetConstants),lights:enumIds(enums.lights,widgetConstants)},result={params:new Map,inputs:new Map,outputs:new Map,lights:new Map,panelSize},vectors=new Map,pattern=/\b(create(?:Light)?Param(?:Centered)?|createSnapParam(?:Centered)?|createLightKnob(?:Centered)?|createInput(?:Centered)?|createOutput(?:Centered)?|createLight(?:Centered)?|createDynamicParam(?:Centered)?|createDynamicSwitch(?:Centered)?|createDynamicPort(?:Centered)?|createThemedParam(?:Centered)?|createThemedPort(?:Centered)?)\b/g;
  for(const candidate of rustSourceDeclarations(coordinateText).macroDefinitions){if(candidate.commented||candidate.functionLike)continue;const position=rackWidgetPosition(candidate.replacement,widgetConstants);if(position&&!vectors.has(candidate.name))vectors.set(candidate.name,position)}
  for(const match of coordinateText.matchAll(/\b(?:const\s+)?(?:rack::)?(?:math::)?Vec\s+([A-Za-z_]\w*)\s*=\s*((?:mm2px\s*\(\s*)?(?:rack::)?(?:math::)?Vec\s*\([^;]+?\)\s*\)?)\s*;/g)){if(!isCodePosition(coordinateText,match.index))continue;const position=rackWidgetPosition(match[2],widgetConstants);if(position&&!vectors.has(match[1]))vectors.set(match[1],position)}
  for(const declaration of coordinateText.matchAll(/\b(?:static\s+)?const\s+(?:rack::)?(?:math::)?Vec\s+([A-Za-z_]\w*)\s*\[[^\]]*\]\s*=\s*\{/g)){if(!isCodePosition(coordinateText,declaration.index))continue;const open=coordinateText.indexOf("{",declaration.index),close=matchingBrace(coordinateText,open);if(open<0||close<0)continue;const initializer=coordinateText.slice(open+1,close),entries=[...initializer.matchAll(/(?:mm2px\s*\(\s*)?(?:rack::)?(?:math::)?Vec\s*\([^;{}]+?\)\s*\)?/g)];for(const [index,entry] of entries.entries()){const position=rackWidgetPosition(entry[0],widgetConstants);if(position)vectors.set(`${declaration[1]}[${index}]`,position)}}
  for(const declaration of text.matchAll(/\bstd::vector\s*<\s*(?:(?:rack::)?(?:math::)?)?Vec\s*>\s+([A-Za-z_]\w*)\s*=\s*\{/g)){if(!isCodePosition(text,declaration.index))continue;const open=text.indexOf("{",declaration.index),close=matchingBrace(text,open);if(open<0||close<0)continue;for(const [index,row] of [...text.slice(open+1,close).matchAll(/\{([^{}]+)\}/g)].entries()){const position=rackWidgetPosition(`Vec(${row[1]})`,widgetConstants);if(position)vectors.set(`${declaration[1]}[${index}]`,position)}}
  for(const match of text.matchAll(pattern)){if(!isCodePosition(text,match.index))continue;const widget=widgetTemplateType(text,match.index+match[0].length),open=text.indexOf("(",match.index+match[0].length),close=matchingParenthesis(text,open);if(open<0||close<0)continue;const values=splitArguments(text.slice(open+1,close)),themedPort=match[1].startsWith("createThemedPort"),dynamicPort=match[1].startsWith("createDynamicPort"),portFactory=dynamicPort||themedPort;if(values.length<(portFactory?4:3))continue;const group=portFactory?(/\btrue\b/.test(values[1])?"inputs":"outputs"):(match[1].includes("Param")||match[1].includes("Switch")||match[1].startsWith("createLightKnob"))?"params":match[1].includes("Input")?"inputs":match[1].includes("Output")?"outputs":"lights",placementConstants={...widgetConstants,...Object.fromEntries(ids[group])},idExpression=values[portFactory?3:2],centered=portFactory||match[1].startsWith("createDynamicParam")||match[1].startsWith("createDynamicSwitch")||match[1].endsWith("Centered"),assignment=/\b(?:auto|[A-Za-z_]\w*(?:::[A-Za-z_]\w*)*(?:\s*<[^;{}=]+>)?\s*\*?)\s+([A-Za-z_]\w*)\s*=\s*$/.exec(text.slice(Math.max(0,(match.index??0)-180),match.index??0)),alias=assignment?.[1],explicitlySnapped=Boolean(alias&&new RegExp(`\\b${alias}\\s*->\\s*snap\\s*=\\s*true\\b`).test(text));for(const context of widgetPlacementContexts(text,match.index,placementConstants)){if(!widgetConditionalContextActive(text,match.index,context))continue;const id=enumExpressionId(idExpression,ids[group],context),position=rackWidgetPositionAt(text,expandPosition(values[0]),match.index,context,centered,vectors);if(id===undefined||!position||result[group].has(id))continue;result[group].set(id,{...position,...((group==="params"||group==="lights"||portFactory)&&widget?{widget}:{}),...(group==="params"&&(match[1].startsWith("createSnapParam")||explicitlySnapped)?{snap:true}:{})})}}
  // Rack 0.6 used a single createPort() factory whose second argument selected
  // input or output. Preserve that legacy geometry exactly as well.
  for(const match of text.matchAll(/\bcreatePort\b/g)){
    if(!isCodePosition(text,match.index))continue;
    const widget=widgetTemplateType(text,match.index+match[0].length),open=text.indexOf("(",match.index+match[0].length),close=matchingParenthesis(text,open);
    if(open<0||close<0)continue;
    const values=splitArguments(text.slice(open+1,close));
    if(values.length<4)continue;
    const group=/\b(?:PortWidget::)?INPUT\b/.test(values[1])?"inputs":/\b(?:PortWidget::)?OUTPUT\b/.test(values[1])?"outputs":null;
    if(!group)continue;
    const placementConstants={...widgetConstants,...Object.fromEntries(ids[group])};
    for(const context of widgetPlacementContexts(text,match.index,placementConstants)){
      if(!widgetConditionalContextActive(text,match.index,context))continue;
      const id=enumExpressionId(values[3],ids[group],context),position=rackWidgetPositionAt(text,expandPosition(values[0]),match.index,context,false,vectors);
      if(id===undefined||!position||result[group].has(id))continue;
      result[group].set(id,{...position,...(widget?{widget}:{})});
    }
  }
  // Light params carry both a parameter id and a light id. The generic pass
  // above records their parameter placement; mirror the same source call into
  // the light map using the fourth argument, as Rack's createLightParam helpers do.
  for(const match of text.matchAll(/\bcreateLightParam(?:Centered)?\b/g)){if(!isCodePosition(text,match.index))continue;const widget=widgetTemplateType(text,match.index+match[0].length),open=text.indexOf("(",match.index+match[0].length),close=matchingParenthesis(text,open);if(open<0||close<0)continue;const values=splitArguments(text.slice(open+1,close));if(values.length<4)continue;const placementConstants={...widgetConstants,...Object.fromEntries(ids.lights),...Object.fromEntries(ids.params)};for(const context of widgetPlacementContexts(text,match.index,placementConstants)){if(!widgetConditionalContextActive(text,match.index,context))continue;const id=enumExpressionId(values[3],ids.lights,context),paramId=enumExpressionId(values[2],ids.params,context),position=rackWidgetPositionAt(text,expandPosition(values[0]),match.index,context,match[0].endsWith("Centered"),vectors);if(id===undefined||!position||result.lights.has(id))continue;result.lights.set(id,{...position,...(widget?{widget}:{}),...(paramId!==undefined?{paramId}:{})})}}
  const paramConstants={...widgetConstants,...Object.fromEntries(ids.params)},millimetersToPixels=value=>Number((value*75/25.4).toFixed(3));
  for(const match of text.matchAll(/\b(createVCFWSBigKnob|createVCOKnob)\s*\(/g)){if(!isCodePosition(text,match.index))continue;const open=text.indexOf("(",match.index+match[0].length-1),close=matchingParenthesis(text,open);if(open<0||close<0)continue;const values=splitArguments(text.slice(open+1,close)),id=enumExpressionId(values[0],ids.params,paramConstants);if(id===undefined||result.params.has(id))continue;let x,y;if(match[1]==="createVCFWSBigKnob"){x=widgetNumberLiteral("firstColumnCenter_MM + columnWidth_MM * 0.5",Number.NaN,paramConstants);y=widgetNumberLiteral("(vcoRowCenters_MM_0 + vcoRowCenters_MM_1) * 0.5",Number.NaN,paramConstants)}else{x=widgetNumberLiteral(`firstColumnCenter_MM + columnWidth_MM * (${values[3]})`,Number.NaN,paramConstants);const row=enumExpressionId(values[2],new Map(),paramConstants);y=Number.isSafeInteger(row)?paramConstants[`vcoRowCenters_MM_${row}`]:Number.NaN}if(Number.isFinite(x)&&Number.isFinite(y))result.params.set(id,{x:millimetersToPixels(x),y:millimetersToPixels(y),centered:true})}
  for(const match of text.matchAll(/\b[A-Za-z_]\w*::create\s*\(/g)){if(!isCodePosition(text,match.index))continue;const open=text.indexOf("(",match.index+match[0].length-1),close=matchingParenthesis(text,open);if(open<0||close<0)continue;const values=splitArguments(text.slice(open+1,close));if(values.length<4)continue;const id=enumExpressionId(values[3],ids.params,paramConstants),origin=rackWidgetPosition(values[0],paramConstants,false,vectors),size=rackWidgetPosition(values[1],paramConstants,false,vectors);if(id===undefined||!origin||!size||result.params.has(id))continue;result.params.set(id,{x:Number((origin.x+size.x*0.5).toFixed(3)),y:Number((origin.y+size.y*0.5).toFixed(3)),width:size.x,height:size.y,control:"selector",centered:true})}
  if(supportSource&&depth<2){const allIds=new Map([...ids.params,...ids.inputs,...ids.outputs]),helperConstants={...widgetConstants,...Object.fromEntries(allIds)};for(const call of text.matchAll(/\b(?:[A-Za-z_]\w*(?:\s*<[^;(){}]+>)?\s*::)+([A-Za-z_]\w*)\s*\(\s*this\s*,/g)){if(!isCodePosition(text,call.index))continue;const callOpen=text.indexOf("(",call.index),callClose=matchingParenthesis(text,callOpen);if(callOpen<0||callClose<0)continue;const actuals=splitArguments(text.slice(callOpen+1,callClose)).slice(1),definitionPattern=new RegExp(`\\b(?:static\\s+)?void\\s+${call[1]}\\s*\\(`,"g");for(const definition of supportSource.matchAll(definitionPattern)){if(!isCodePosition(supportSource,definition.index))continue;const definitionOpen=supportSource.indexOf("(",definition.index),definitionClose=matchingParenthesis(supportSource,definitionOpen),bodyOpen=supportSource.indexOf("{",definitionClose),bodyClose=matchingBrace(supportSource,bodyOpen);if(definitionOpen<0||definitionClose<0||bodyOpen<0||bodyClose<0)continue;const formals=splitArguments(supportSource.slice(definitionOpen+1,definitionClose)).slice(1).map(value=>{const match=/([A-Za-z_]\w*)\s*(?:=\s*([\s\S]+))?$/.exec(value.trim());return match?{name:match[1],initial:match[2]}:null}).filter(Boolean);if(!formals.length)continue;const bindings={...helperConstants};let missingBinding=false;for(const [index,formal] of formals.entries()){const expression=actuals[index]??formal.initial;if(expression===undefined){missingBinding=true;break}const value=enumExpressionId(expression,allIds,bindings)??widgetNumberLiteral(expression,Number.NaN,bindings);if(Number.isFinite(value))bindings[formal.name]=value;else{missingBinding=true;break}}if(missingBinding)continue;const helperSource=supportSource.slice(bodyOpen+1,bodyClose),helper=rackWidgetPlacements(helperSource,enums,bindings,"",depth+1);for(const group of ["params","inputs","outputs"])for(const [id,position] of helper[group])if(!result[group].has(id))result[group].set(id,position);break}}}
  return result
}
function widgetDisplayRect(source,className,constants={}){
  const text=String(source??""),escaped=className.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),declaration=new RegExp(`\\b${escaped}\\s*\\*\\s*([A-Za-z_]\\w*)\\s*=\\s*new\\s+${escaped}\\b`).exec(text);if(!declaration)return null;const name=declaration[1].replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),position=new RegExp(`\\b${name}\\s*->\\s*setPosition\\s*\\(([^;]+)\\)\\s*;`).exec(text),size=new RegExp(`\\b${name}\\s*->\\s*setSize\\s*\\(([^;]+)\\)\\s*;`).exec(text),origin=rackWidgetPosition(position?.[1],constants),dimensions=rackWidgetPosition(size?.[1],constants);return origin&&dimensions?{x:origin.x,y:origin.y,width:dimensions.x,height:dimensions.y}:null
}
function widgetLightMatrix(source,constants={}){
  const match=/\bcreateLightMatrix\s*</.exec(String(source??""));if(!match)return null;
  const widget=widgetTemplateType(source,match.index+match[0].length-1),open=source.indexOf("(",match.index),close=matchingParenthesis(source,open);if(open<0||close<0)return null;
  const values=splitArguments(source.slice(open+1,close));if(values.length<6)return null;
  const position=rackWidgetPosition(values[0],constants),size=rackWidgetPosition(values[1],constants),lightStart=numberLiteral(values[3],Number.NaN,constants),columns=numberLiteral(values[4],Number.NaN,constants),rows=numberLiteral(values[5],Number.NaN,constants),channels=/RGB/.test(widget)?3:/GreenRed|RedGreen|BlueRed|RedBlue/.test(widget)?2:1;
  return position&&size&&Number.isSafeInteger(lightStart)&&Number.isSafeInteger(columns)&&Number.isSafeInteger(rows)&&columns>0&&rows>0?{kind:"light-matrix",lightStart,columns,rows,channels,x:position.x,y:position.y,width:size.x,height:size.y}:null;
}
function sourceFileDefiningType(sourceFiles,type){
  const name=baseTypeName(type),pattern=new RegExp(`\\b(?:struct|class)\\s+${name}\\b`);
  return sourceFiles.find(file=>pattern.test(fs.readFileSync(file,"utf8")))
}
function fourMsCoreSupportSources(coreFile){
  const marker=`${path.sep}CoreModules${path.sep}4ms${path.sep}core${path.sep}`,index=coreFile.lastIndexOf(marker);
  if(index<0)return[];
  const root=path.join(coreFile.slice(0,index),"CoreModules","4ms"),cmake=path.join(root,"CMakeLists.txt");
  if(!fs.existsSync(cmake))return[];
  const source=fs.readFileSync(cmake,"utf8").replace(/#.*$/gm,""),found=[];
  for(const match of source.matchAll(/(?:^|\s)([A-Za-z0-9_./+-]+\.(?:c|cc|cpp|cxx))(?=\s|$)/g)){
    const candidate=path.resolve(root,match[1]);
    if(/Core\.(?:c|cc|cpp|cxx)$/.test(candidate)||candidate.includes(`${path.sep}hub${path.sep}`)||!fs.existsSync(candidate))continue;
    found.push(candidate);
  }
  return [...new Set(found)];
}
function metaModuleBrowserSupport(output,sourceFiles){
  const hasAsyncThread=sourceFiles.some(file=>file.endsWith(`${path.sep}CoreModules${path.sep}async_thread.hh`));
  if(!hasAsyncThread)return[];
  const support=path.join(output,"rack_web_metamodule_support.cpp");
  fs.writeFileSync(support,`#include "CoreModules/async_thread.hh"
#include <memory>
#include <string>
#include <string_view>
#include <utility>
namespace MetaModule {
std::string last_file_path;
struct AsyncThread::Internal { bool enabled = false; };
AsyncThread::AsyncThread(CoreProcessor*) : internal{std::make_unique<Internal>()} {}
AsyncThread::AsyncThread(CoreProcessor*, Callback&& newAction)
  : action{std::move(newAction)}, internal{std::make_unique<Internal>()} {}
void AsyncThread::start() { internal->enabled = true; }
void AsyncThread::start(Callback&& newAction) {
  action = std::move(newAction);
  start();
}
void AsyncThread::stop() { internal->enabled = false; }
void AsyncThread::run_once() { if (action) action(); }
bool AsyncThread::is_enabled() { return internal->enabled; }
AsyncThread::~AsyncThread() = default;
namespace Async {
void start_module_threads() {}
void kill_module_threads() {}
}
namespace Gui {
void notify_user(std::string_view, int) {}
}
namespace Patch {
void mark_patch_modified() {}
std::string get_dir() { return {}; }
}
namespace Filesystem {
std::string translate_path_to_local(std::string_view path, std::string_view, unsigned) {
  return std::string{path};
}
}
}
`);
  return[support]
}
function metaModuleElementContract(infoSource){
  const declaration=/\bstd::array\s*<\s*Element\s*,\s*\d+\s*>\s+Elements\s*\{\s*\{/.exec(infoSource);
  if(!declaration)fail("MetaModule info does not declare an Elements array");
  const outerOpen=infoSource.indexOf("{",declaration.index),innerOpen=infoSource.indexOf("{",outerOpen+1),innerClose=matchingBrace(infoSource,innerOpen);
  if(outerOpen<0||innerOpen<0||innerClose<0)fail("MetaModule Elements array is malformed");
  const entries=splitArguments(infoSource.slice(innerOpen+1,innerClose)).filter(Boolean),elements=[];
  let paramId=0,inputId=0,outputId=0,lightId=0;
  const decodedString=value=>{try{return JSON.parse(`"${value}"`)}catch{return value}},switchState=(value,positions)=>{const token=String(value??"");if(/CENTER/.test(token))return positions===3?.5:0;if(/(?:UP|RIGHT|DOWN)\b/.test(token))return /(?:UP|RIGHT)\b/.test(token)?1:0;const numeric=numberLiteral(token,Number.NaN);return Number.isFinite(numeric)&&positions>1?Math.max(0,Math.min(1,numeric/(positions-1))):0},lightWidget=type=>/RedGreenBlue|RGB/.test(type)?"MediumLight<RedGreenBlueLight>":/RedBlue/.test(type)?"MediumLight<RedBlueLight>":/Red/.test(type)?"MediumLight<RedLight>":/Green/.test(type)?"MediumLight<GreenLight>":/Blue/.test(type)?"MediumLight<BlueLight>":/Orange/.test(type)?"MediumLight<YellowLight>":"MediumLight<WhiteLight>";
  for(const entry of entries){
    const type=/^([A-Za-z_]\w*)\s*\{/.exec(entry)?.[1],coordinate=/to_mm\s*<\s*(\d+)\s*>\s*\(\s*([^()]+)\s*\)\s*,\s*to_mm\s*<\s*(\d+)\s*>\s*\(\s*([^()]+)\s*\)/.exec(entry),label=/\b(?:Center|TopLeft)\s*,\s*"((?:\\.|[^"\\])*)"\s*,\s*"((?:\\.|[^"\\])*)"/.exec(entry);
    if(!type||!coordinate||!label)continue;
    const xSource=numberLiteral(coordinate[2],Number.NaN),ySource=numberLiteral(coordinate[4],Number.NaN),xDpi=Number(coordinate[1]),yDpi=Number(coordinate[3]);
    if(!Number.isFinite(xSource)||!Number.isFinite(ySource)||!Number.isFinite(xDpi)||!Number.isFinite(yDpi))continue;
    const afterBase=entry.slice((label.index??0)+label[0].length),numericTail=[...afterBase.replace(/"(?:\\.|[^"\\])*"/g,"").matchAll(/(?<![\w.])[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?f?\b/g)].map(match=>numberLiteral(match[0],Number.NaN)).filter(Number.isFinite),name=decodedString(label[1]),position={x:Number((xSource*75/xDpi).toFixed(3)),y:Number((ySource*75/yDpi).toFixed(3)),centered:true},addLights=(count,widget=lightWidget(type),paramIdForLight)=>{const first=lightId;for(let index=0;index<count;index++)elements.push({kind:"light",id:lightId++,name,type,position,widget,...(paramIdForLight===undefined?{}:{paramId:paramIdForLight})});return first};
    if(/Knob/.test(type)){
      const snapped=/^(?:Knob_1_10|DivMultKnob|OctaveKnob)/.test(type);
      elements.push({kind:"param",id:paramId++,name,type,default:numericTail[0]??.5,...(snapped?{snap:true}:{}),position:{...position,widget:/^(?:Knob9mm|DivMultKnob|OctaveKnob)/.test(type)?"RoundBlackKnob":"Davies1900hWhiteKnob"}});
    }else if(/^Slider25mm(?:Horiz|Vert)LED$/.test(type)){
      const id=paramId++;
      elements.push({kind:"param",id,name,type,default:numericTail[0]??.5,position:{...position,control:"slider",widget:/Horiz/.test(type)?"HorizontalSlider":"LEDSlider"}});
      addLights(1,"MediumLight<WhiteLight>",id);
    }else if(/^(?:WhiteMomentary7mm|MomentaryRGB[57]mm|BlackMomentary7mm)$/.test(type)){
      const id=paramId++,count=/RGB/.test(type)?3:/White/.test(type)?1:0;
      elements.push({kind:"param",id,name,type,default:0,button:true,snap:true,position:{...position,widget:"VCVButton"}});
      if(count)addLights(count,lightWidget(type),id);
    }else if(/^OrangeButton$/.test(type)){
      const id=paramId++,defaultValue=/\bDOWN\b/.test(afterBase)?1:0;
      elements.push({kind:"param",id,name,type,default:defaultValue,snap:true,position:{...position,widget:"LEDButton"}});
      addLights(1,"MediumLight<YellowLight>",id);
    }else if(/^Toggle([23])pos(?:Horiz)?$/.test(type)){
      const positions=Number(/^Toggle([23])/.exec(type)?.[1]??2);
      elements.push({kind:"param",id:paramId++,name,type,default:switchState(afterBase,positions),snap:true,position:{...position,widget:positions===3?"CKSSThree":"CKSS"},frames:positions});
    }else if(/^AltParamContinuous$/.test(type)){
      const defaultValue=numericTail[0]??.5,min=numericTail[1]??0,max=numericTail[2]??1;
      elements.push({kind:"param",id:paramId++,name,type,default:max>min?(defaultValue-min)/(max-min):0,hidden:true,position});
    }else if(/^(?:AltParamChoice|AltParamChoiceLabeled)$/.test(type)){
      const positions=Math.max(2,Math.round(numericTail[0]??2)),defaultValue=numericTail[1]??0;
      elements.push({kind:"param",id:paramId++,name,type,default:Math.max(0,Math.min(1,defaultValue/(positions-1))),snap:true,hidden:true,frames:positions,position});
    }else if(/^(?:AltParamAction|WavFileBrowseAction)$/.test(type)){
      elements.push({kind:"param",id:paramId++,name,type,default:0,button:true,snap:true,hidden:true,position});
    }else if(/JackInput4ms$/.test(type)){
      elements.push({kind:"input",id:inputId++,name,type,portKind:/^Gate/.test(type)?"gate":/\baudio\b/i.test(name)?"audio":"cv",position});
    }else if(/JackOutput4ms$/.test(type)){
      elements.push({kind:"output",id:outputId++,name,type,portKind:/^Gate/.test(type)?"gate":/\b(?:audio|out)\b/i.test(name)?"audio":"cv",position});
    }else if(/^(?:Red|Blue|White|Green|Orange)Light$/.test(type)){
      addLights(1);
    }else if(/^RedBlueLight$/.test(type)){
      addLights(2);
    }else if(/^RedGreenBlueLight$/.test(type)){
      addLights(3);
    }else if(/^(?:TSPDisplay|GraphicDisplay)$/.test(type)){
      addLights(1);
    }
  }
  return {elements,counts:{params:paramId,inputs:inputId,outputs:outputId,lights:lightId}}
}
function metaModuleAdapterSource(registration,coreFile,contract){
  const sourceMarker=`${path.sep}src${path.sep}`,marker=coreFile.lastIndexOf(sourceMarker),relative=(marker>=0?coreFile.slice(marker+sourceMarker.length):path.basename(coreFile)).split(path.sep).join("/"),coreType=registration.metaModuleCore.includes("::")?registration.metaModuleCore:`MetaModule::${registration.metaModuleCore}`,infoType=registration.metaModuleInfo.includes("::")?registration.metaModuleInfo:`MetaModule::${registration.metaModuleInfo}`,params=contract.elements.filter(element=>element.kind==="param"),floatLiteral=value=>Number.isInteger(Number(value))?`${Number(value)}.0f`:`${Number(value)}f`,config=params.map(element=>`    configParam(${element.id}, 0.f, 1.f, ${floatLiteral(element.default)}, ${JSON.stringify(element.name)});`).join("\n");
  return `#include "rack_web_export.hpp"
#include "${relative}"
#include "CoreModules/elements/element_counter.hh"

struct RackWebMetaModule final : rack::Module {
  static constexpr auto rackWebCounts = ElementCount::count<${infoType}>();
  static constexpr int rackWebParamCount = static_cast<int>(rackWebCounts.num_params);
  static constexpr int rackWebInputCount = static_cast<int>(rackWebCounts.num_inputs);
  static constexpr int rackWebOutputCount = static_cast<int>(rackWebCounts.num_outputs);
  static constexpr int rackWebLightCount = static_cast<int>(rackWebCounts.num_lights);
  ${coreType} core;
  float sampleRate = 0.f;

  RackWebMetaModule() {
    config(rackWebParamCount, rackWebInputCount, rackWebOutputCount, rackWebLightCount);
${config}
    core.mark_all_inputs_unpatched();
    core.mark_all_outputs_unpatched();
  }

  void process(const ProcessArgs& args) override {
    for (int id = 0; id < rackWebParamCount; id++) core.set_param(id, params[id].getValue());
    for (int id = 0; id < rackWebInputCount; id++) {
      if (inputs[id].isConnected()) {
        core.mark_input_patched(id);
        core.set_input(id, inputs[id].getVoltage());
      } else {
        core.set_input(id, 0.f);
        core.mark_input_unpatched(id);
      }
    }
    if (sampleRate != args.sampleRate) {
      sampleRate = args.sampleRate;
      core.set_samplerate(sampleRate);
    }
    for (int id = 0; id < rackWebOutputCount; id++) {
      if (outputs[id].isConnected()) core.mark_output_patched(id);
      else core.mark_output_unpatched(id);
    }
    core.update();
    for (int id = 0; id < rackWebOutputCount; id++) outputs[id].setVoltage(core.get_output(id));
    for (int id = 0; id < rackWebLightCount; id++) lights[id].setBrightness(core.get_led_brightness(id));
  }
};

static_assert(RackWebMetaModule::rackWebParamCount == ${contract.counts.params});
static_assert(RackWebMetaModule::rackWebInputCount == ${contract.counts.inputs});
static_assert(RackWebMetaModule::rackWebOutputCount == ${contract.counts.outputs});
static_assert(RackWebMetaModule::rackWebLightCount == ${contract.counts.lights});
RACK_WEB_EXPORTS(RackWebMetaModule)
`
}
function metaModuleRuntimeDraft(target,manifest,moduleManifest,license,contract,infoSource,sourceDir){
  const declaredWidthHp=numberLiteral(/\bwidth_hp\s*=\s*([^;]+)/.exec(infoSource)?.[1],Number.NaN),coordinateWidth=Math.max(...contract.elements.map(element=>element.position?.x??0),15)*2,width=Number.isSafeInteger(declaredWidthHp)&&declaredWidthHp>=1&&declaredWidthHp<=40?declaredWidthHp*15:panelWidth(sourceDir,target.model)??Math.round(coordinateWidth/15)*15,params=contract.elements.filter(element=>element.kind==="param").map(({frames,type,kind,...param})=>param),inputs=contract.elements.filter(element=>element.kind==="input").map(({type,kind,portKind,...input})=>({...input,kind:portKind})),outputs=contract.elements.filter(element=>element.kind==="output").map(({type,kind,portKind,...output})=>({...output,kind:portKind})),lightWidgets=contract.elements.filter(element=>element.kind==="light").map(element=>({id:element.id,...(element.paramId===undefined?{}:{paramId:element.paramId}),widget:element.widget,position:element.position}));
  return {key:target.key,plugin:target.plugin,model:target.model,name:moduleManifest.name??target.model,brand:manifest.brand??manifest.name??target.plugin,version:manifest.version??"0.0.0",license,sourceUrl:manifest.sourceUrl,libraryUrl:target.url,screenshotUrl:`https://library.vcvrack.com/screenshots/400/${target.plugin}/${target.model}.webp`,wasmUrl:"./module.wasm",width,description:moduleManifest.description??`MetaModule DSP core adapted from ${target.key}`,params,inputs,outputs,lights:contract.counts.lights,...(lightWidgets.length?{lightWidgets}:{})}
}
function buildMetaModuleScaffold({options,target,manifest,moduleManifest,license,sourceDir,sourceCommit,temporary,registration,rootSourceFiles}){
  const output=path.resolve(options.output||path.join("web-runtime","scaffolds",`${target.plugin}-${target.model}`));fs.mkdirSync(output,{recursive:true});
  const metaModuleSourceFiles=[...new Set([...rootSourceFiles,...files(sourceDir)])],infoFile=sourceFileDefiningType(metaModuleSourceFiles,registration.metaModuleInfo);
  if(!infoFile)fail(`Could not locate MetaModule info type for ${target.key}`);
  let coreFile=registration.metaModuleCoreFile;
  if(registration.metaModuleExternal){
    coreFile=path.join(output,"rack_web_external_core.cc");
    const infoInclude=path.relative(sourceDir,infoFile).split(path.sep).join("/"),coreName=baseTypeName(registration.metaModuleCore);
    fs.writeFileSync(coreFile,`#include "CoreModules/CoreProcessor.hh"
#include "${infoInclude}"
#include <array>
namespace MetaModule {
class ${coreName} final : public CoreProcessor {
public:
  void update() final {}
  void set_samplerate(float) final {}
  void set_param(int, float) final {}
  void set_input(int id, float value) final {
    if (id >= 0 && id < static_cast<int>(values.size())) values[id] = value;
  }
  float get_output(int id) const final {
    return id >= 0 && id < static_cast<int>(values.size()) ? values[id] : 0.f;
  }
private:
  std::array<float, 16> values{};
};
}
`);
  }else coreFile=coreFile??sourceFileDefiningType(metaModuleSourceFiles,registration.metaModuleCore);
  if(!coreFile)fail(`Could not locate MetaModule core type for ${target.key}`);
  const infoSource=fs.readFileSync(infoFile,"utf8"),contract=metaModuleElementContract(infoSource),supportSources=fourMsCoreSupportSources(coreFile),dependencyFiles=[...new Set(includedDependencyFiles(sourceDir,[coreFile,infoFile,...supportSources]))],browserSupport=metaModuleBrowserSupport(output,dependencyFiles),sourceFiles=[...dependencyFiles,...browserSupport],excludedBrowserImplementations=new Set(dependencyFiles.filter(file=>/(?:^|[\\/])src[\\/]thread[\\/]async_thread(?:_control)?\.cc$|(?:^|[\\/])src[\\/]comm[\\/]comm_module\.cc$/.test(file))),implementationFiles=sourceFiles.filter(file=>file!==coreFile&&!excludedBrowserImplementations.has(file)&&/\.(?:c|cc|cpp|cxx)$/.test(file)&&!/^\/\/\s*STATIC TESTS:/m.test(fs.readFileSync(file,"utf8"))),adapter=path.join(output,"adapter.cpp"),draft=metaModuleRuntimeDraft(target,manifest,moduleManifest,license,contract,infoSource,sourceDir),report={schemaVersion:1,key:target.key,libraryUrl:target.url,manifest:{slug:manifest.slug,name:manifest.name,version:manifest.version,license,brand:manifest.brand,sourceUrl:manifest.sourceUrl,module:moduleManifest},source:{directory:sourceDir,commit:sourceCommit,file:path.relative(sourceDir,coreFile),registrationFile:path.relative(sourceDir,registration.file),moduleClass:registration.metaModuleCore,widgetClass:registration.widgetClass,infoFile:path.relative(sourceDir,infoFile)},detected:{architecture:"metamodule-generic-core",counts:contract.counts,panelWidth:draft.width,dependencyFiles:dependencyFiles.map(file=>path.relative(sourceDir,file))},assessment:{strategy:"metamodule-core-adapter",compileEligible:true,requiresReview:true,blockers:[]},runtimeDraft:draft};
  fs.writeFileSync(adapter,metaModuleAdapterSource(registration,coreFile,contract));fs.writeFileSync(path.join(output,"README.md"),`# ${target.key} Rack Web scaffold\n\nMetaModule core adapter generated from the locked open-source revision.\n`);let artifact;
  if(options.compile){
    const explicitInitialMemory=options["initial-memory"]!==undefined,maximumMemory=268435456,wasiHolder={exports:null},imports=wasiImports(wasiHolder),analysisSource=sourceFiles.map(file=>fs.readFileSync(file,"utf8")).join("\n");let initialMemory=Number(options["initial-memory"]??pageAlignedMemory(estimatedStaticMemory(analysisSource))),wasm;
    if(!Number.isSafeInteger(initialMemory)||initialMemory<1048576||initialMemory%65536!==0)fail("Initial memory must be a whole number of 64 KiB pages");
    while(true){try{artifact=compileAdapter(adapter,output,initialMemory,sourceDir,sourceFiles,implementationFiles,false);wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(artifact)),imports).exports;wasiHolder.exports=wasm;wasm._initialize();break}catch(error){const memoryFailure=/initial memory too small|(?:out of bounds memory access|memory access out of bounds)|cannot enlarge memory|failed to (?:grow|allocate) memory|memory allocation failed|unreachable[^\n]*(?:alloc|memory)|^\s*unreachable\s*$/im.test(error instanceof Error?error.message:String(error));if(explicitInitialMemory||!memoryFailure||initialMemory>=maximumMemory)throw error;initialMemory=Math.min(maximumMemory,initialMemory*2)}}
    const actual=[wasm.rack_web_param_count(),wasm.rack_web_input_count(),wasm.rack_web_output_count(),wasm.rack_web_light_count()],expected=[contract.counts.params,contract.counts.inputs,contract.counts.outputs,contract.counts.lights];if(actual.some((value,index)=>value!==expected[index]))fail(`${target.key} MetaModule ABI differs from parsed element metadata`);
    for(const param of draft.params){param.default=wasm.rack_web_get_param(param.id);param.min=wasm.rack_web_get_param_min(param.id);param.max=wasm.rack_web_get_param_max(param.id)}draft.runtime={initialMemory};
  }
  report.runtimeDraft=draft;fs.writeFileSync(path.join(output,"runtime.json"),JSON.stringify(draft,null,2)+"\n");fs.writeFileSync(path.join(output,"adapter.json"),JSON.stringify(report,null,2)+"\n");process.stdout.write(JSON.stringify({...report,output,artifact,temporarySource:temporary},null,2)+"\n")
}
function runtimeDraft(target,manifest,moduleManifest,license,detected,moduleClass="",sourceDir=""){
  const constants={...(detected.constants??{}),...(detected.template?.constants??{})},layoutFor=kind=>detected.portEnumLayouts?.[kind]??null,idsFor=kind=>layoutFor(kind)?new Map(layoutFor(kind).ids.map(({name,id})=>[name,id])):enumIds(detected.enums[kind],constants),paramIds=idsFor("params"),inputIds=idsFor("inputs"),outputIds=idsFor("outputs"),paramCount=detected.counts?.params??layoutFor("params")?.count??enumCount(detected.enums.params,constants),inputCount=detected.counts?.inputs??layoutFor("inputs")?.count??enumCount(detected.enums.inputs,constants),outputCount=detected.counts?.outputs??layoutFor("outputs")?.count??enumCount(detected.enums.outputs,constants),lightCount=detected.counts?.lights??layoutFor("lights")?.count??enumCount(detected.enums.lights,constants),params=[];
  const configuredParams=[...detected.config.params.map(call=>({call})),...detected.config.switches.map(call=>({call,snap:true})),...detected.config.buttons.map(call=>({call,snap:true,button:true}))].map(entry=>{const values=splitArguments(entry.call),id=enumExpressionId(values[0],paramIds,constants),base=/[A-Za-z_]\w*/.exec(values[0])?.[0],button=entry.button||detected.triggerParamBases?.includes(base),fallback=humanizeEnumIdentifier(String(values[0]??"").split("::").at(-1).replace(/_PARAM$/,""),"PARAM");return id===undefined||id<0||id>=paramCount?null:{entry,values,id,button,fallback,nameExpression:values[entry.button?1:4]}}).filter(Boolean),configuredParamNames=rackWebStrings(configuredParams.map(entry=>entry.nameExpression),constants),configuredParamNumbers=rackWebNumbers(configuredParams.flatMap(entry=>entry.button?[]:entry.values.slice(1,4)),constants);
  let configuredParamNumberIndex=0;for(const [index,configured] of configuredParams.entries()){const {entry,id,button,fallback}=configured,name=configuredParamNames[index]??fallback;if(button){params.push({id,name,min:0,max:1,default:0,snap:true,button:true});continue}const min=configuredParamNumbers[configuredParamNumberIndex++]??0,max=configuredParamNumbers[configuredParamNumberIndex++]??1,defaultValue=configuredParamNumbers[configuredParamNumberIndex++]??0;params.push({id,name,min,max,default:defaultValue,...(entry.snap?{snap:true}:{})})}
  if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTWaveshaper"){const targets=["Drive","Bias","Gain","Low Cut","High Cut"];for(const param of params)if(param.id>=5&&param.id<25)param.name=`Mod ${(param.id-5)%4+1} to ${targets[Math.floor((param.id-5)/4)]}`}
  if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTVCF"){const targets=["Frequency","Resonance","Pre-Filter Gain","Mix","Gain"];for(const param of params)if(param.id>=5&&param.id<25)param.name=`Mod ${(param.id-5)%4+1} to ${targets[Math.floor((param.id-5)/4)]}`}
  if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTDelay"){const targets=["Left Delay","Right Delay","Time Tweak","Feedback","CrossFeed","LoCut","HiCut","ModRate","ModDepth","Mix"];for(const param of params)if(param.id>=10&&param.id<50)param.name=`Mod ${(param.id-10)%4+1} to ${targets[Math.floor((param.id-10)/4)]}`}
  if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTDelayLineByFreqExpanded"){const targets=["V/Oct Center","Fine Left Tune","Fine Right Tune","Feedback Level","LP Cutoff to Pitch Offset","HP Cutoff to Pitch Offset","Signal/Filter Wet/Dry Mix"];for(const param of params){if(param.id===2)param.name="Fine Right Tune";else if(param.id>=11&&param.id<39)param.name=`Mod ${(param.id-11)%4+1} to ${targets[Math.floor((param.id-11)/4)]}`;else if(param.id===39)param.name="Clamp Behavior"}}
  if(detected.hostAdapter==="surge-dsp-only"&&["SurgeXTMixer","SurgeXTMixerSlider"].includes(target.model)){const targets=["Input 1","Input 2","Input 3","Noise","RingMod 1x2","RingMod 2x3"],modTargets=[...targets,"Noise Color","Gain"];for(const param of params){if(param.id<6)param.name=`${targets[param.id]} Level`;else if(param.id>=8&&param.id<14)param.name=`${targets[param.id-8]} Mute`;else if(param.id>=14&&param.id<20)param.name=`${targets[param.id-14]} Solo`;else if(param.id>=20&&param.id<52)param.name=`Mod ${(param.id-20)%4+1} to ${modTargets[Math.floor((param.id-20)/4)]}`}}
  if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTEGxVCA"){const targets=["Level","Pan","Linear/Exponential","Attack","Decay","Sustain","Release"];for(const param of params)if(param.id>=12&&param.id<40)param.name=`Mod ${(param.id-12)%4+1} to ${targets[Math.floor((param.id-12)/4)]}`}
  if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTQuadLFO"){for(const param of params){if(param.id<16){const group=["Rate","Deform","Shape","Bipolar"][Math.floor(param.id/4)];param.name=`LFO ${param.id%4+1} ${group}`}else if(param.id<48){const target=Math.floor((param.id-16)/4),targetName=target<4?`LFO ${target+1} Rate`:`LFO ${target-3} Deform`;param.name=`Mod ${(param.id-16)%4+1} to ${targetName}`}}}
  if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTModMatrix"){for(let id=0;id<8;id++)detected.config.params.push(`${id}, -10, 10, 0, "Target ${id+1}"`);detected.config.inputs=Array.from({length:4},(_,id)=>`${id}, "Modulator ${id+1}"`);detected.config.outputs=Array.from({length:8},(_,id)=>`${id}, "Modulated Target ${id+1}"`)}
  if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTQuadAD"){detected.config.inputs=[...Array.from({length:4},(_,id)=>`${id}, "Trigger/Gate ${id+1}"`),...Array.from({length:4},(_,id)=>`${id+4}, "Mod ${id+1}"`)];detected.config.outputs=Array.from({length:4},(_,id)=>`${id}, "Envelope ${id+1}"`)}
  if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTUnisonHelper"){detected.config.inputs=[`0, "V/Oct"`,...Array.from({length:4},(_,id)=>`${id+1}, "Audio from Sub VCO ${id+1}"`),...Array.from({length:4},(_,id)=>`${id+5}, "Mod ${id+1}"`)];detected.config.outputs=[`0, "Left"`,`1, "Right"`,...Array.from({length:4},(_,id)=>`${id+2}, "V/Oct to Sub VCO ${id+1}"`)]}
  const ports=(callsList,ids,count,direction)=>{const records=callsList.map(call=>{const values=splitArguments(call),id=enumExpressionId(values[0],ids,constants);return id===undefined?null:{values,id,fallback:values[0].replace(/_(?:INPUT|OUTPUT)$/,"")}}).filter(Boolean),names=rackWebStrings(records.map(record=>record.values[1]),constants),configured=records.map((record,index)=>{const {values,id,fallback}=record;let name=names[index]??fallback,kind=portKind(`${name} ${values[0]}`);if(detected.hostAdapter==="surge-dsp-only"&&["SurgeXTWaveshaper","SurgeXTVCF"].includes(target.model)&&direction==="IN"&&id>=2){name=`Modulation Signal ${id-1}`;kind="cv"}return{id,name,kind}}),explicitIds=new Set(configured.map(port=>port.id)),unconfiguredIds=Array.from({length:count},(_,id)=>id).filter(id=>!explicitIds.has(id)),byId=new Map;for(const original of configured){let port=original;if(byId.has(port.id)&&unconfiguredIds.length)port={...port,id:unconfiguredIds.shift()};byId.set(port.id,port)}for(let id=0;id<count;id++)if(!byId.has(id)){const identifier=enumIdentifierForId(ids,id),name=identifier?humanizeEnumIdentifier(identifier,direction):`${direction} ${id+1}`;byId.set(id,{id,name,kind:portKind(`${name} ${identifier??""}`)})}if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTDelay"&&direction==="IN")for(let id=3;id<count;id++)byId.set(id,{id,name:`Mod ${id-2}`,kind:"cv"});if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTDelayLineByFreqExpanded"&&direction==="IN")for(let id=6;id<count;id++)byId.set(id,{id,name:`Mod ${id-5}`,kind:"cv"});if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTMixer"&&direction==="IN")for(let id=0;id<count;id++)byId.set(id,{id,name:id<6?`Input ${Math.floor(id/2)+1} ${id%2?"Right":"Left"}`:`Modulator ${id-5}`,kind:id<6?"audio":"cv"});if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTEGxVCA"&&direction==="IN")for(let id=4;id<count;id++)byId.set(id,{id,name:`Mod Input ${id-3}`,kind:"cv"});if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTQuadLFO"){for(let id=0;id<count;id++)byId.set(id,{id,name:direction==="OUT"?`LFO ${id+1}`:id<4?`Trigger ${id+1}`:`Mod ${id-3}`,kind:id<4&&direction==="IN"?"gate":"cv"})}return [...byId.values()].sort((a,b)=>a.id-b.id)};
  const bypassRoutes=detected.config.bypass.map(call=>{const values=splitArguments(call),input=enumExpressionId(values[0],inputIds,constants),output=enumExpressionId(values[1],outputIds,constants);return input===undefined||output===undefined?null:[input,output]}).filter(Boolean);
  const paramsById=new Map(params.map(param=>[param.id,param]));for(let id=0;id<paramCount;id++)if(!paramsById.has(id)){const identifier=enumIdentifierForId(paramIds,id);paramsById.set(id,{id,name:identifier?humanizeEnumIdentifier(identifier.replace(/_PARAM$/,""),"PARAM"):`Param ${id+1}`,min:0,max:1,default:0})}
  for(const expression of detected.config.snaps??[]){const id=enumExpressionId(expression,paramIds,constants)??numberLiteral(expression,Number.NaN,constants);if(Number.isSafeInteger(id)&&paramsById.has(id))paramsById.get(id).snap=true}
  if(target.key==="FreeSurface/FreeSurface-WaterTable"){
    const names=["Model","Left Input Mode","Right Input Mode","Left Input Shape","Right Input Shape","Left Output Shape","Right Output Shape","Left Input Position CV","Right Input Position CV","Left Input Position","Right Input Position","Left Output Position CV","Right Output Position CV","Left Output Position","Right Output Position","Left Input Width","Right Input Width","Left Input Width CV","Right Input Width CV","Left Output Width","Left Output Width CV","Right Output Width","Right Output Width CV","Left Input Gain","Left Input Gain CV","Right Input Gain","Right Input Gain CV","Wet","Dry","Timestep","Low Cut","Damping","Decay","Feedback","Wet CV","Dry CV","Low Cut CV","Damping CV","Decay CV","Feedback CV"];
    for(const [id,name] of names.entries())paramsById.get(id).name=name;
    for(let id=0;id<7;id++)Object.assign(paramsById.get(id),{snap:true,button:true});
  }
  if(target.key==="ChowDSP/ChowTape")for(const [id,name] of ["Bias","Saturation","Drive"].entries())paramsById.get(id).name=name;
  if(target.key==="Dintree-Virtual/V102-Output_Mixer")paramsById.get(8).name="MASTER";
  if(target.key==="Dintree-Virtual/V103-Reverb_Delay")paramsById.get(4).name="REVERB TYPE";
  if(target.plugin==="DrumKit"&&drumKitSampleContract(target.model)&&!drumKitSampleContract(target.model).moduleClass){paramsById.get(0).name="Sample 1";paramsById.get(1).name="Sample 2";paramsById.get(16).name="Playback Speed 1";paramsById.get(17).name="Playback Speed 2"}
  if(target.key==="DrumKit/OpenHiHat"){paramsById.get(32).name="Choke Time 1";paramsById.get(33).name="Choke Time 2"}
  if(target.key==="DrumKit/Gnome")Object.assign(paramsById.get(2),{snap:true,button:true});
  if(target.key==="DrumKit/Sequencer"){for(let id=0;id<128;id++)paramsById.get(id).snap=true;for(const id of [128,129,130,...Array.from({length:19},(_,offset)=>132+offset)])Object.assign(paramsById.get(id),{snap:true,button:true})}
  if(target.key==="DrumKit/Baronial")for(const [id,name] of ["Attack Time","Decay Time","Sustain Time","Sustain Level","Release Time"].entries())paramsById.get(id).name=name;
  if(target.key==="DrumKit/MarionetteBass"){for(const [id,name] of ["Pitch Decay","Pitch Sustain","Pitch Release","Pitch Decay Direction","Amplitude Decay","Amplitude Sustain","Amplitude Release","Amplitude Decay Direction","Sample / Synth Blend","Tune","Sub Oscillator Mix","Sub Oscillator Wave","Sub Octave","Sample"].entries())paramsById.get(id).name=name;for(const id of [3,7,12,13])paramsById.get(id).snap=true}
  if(target.key==="DanTSynth/AOCR")paramsById.get(0).snap=true;
  if(target.key==="DelexanderVol1/Algomorph"){
    for(let operator=0;operator<4;operator++){
      paramsById.get(operator).name=`Operator ${operator+1}`;
      paramsById.get(4+operator).name=`Modulator ${operator+1}`;
    }
    for(let scene=0;scene<3;scene++)paramsById.get(8+scene).name=`Scene ${scene+1}`;
    const auxNames=["AUX Morph","Morph CV Attenuverter","Click Filter Strength","Double Morph","Triple Morph","Sum Outputs Gain","Mod Outputs Gain","Operator Inputs Gain","Unipolar Triple Morph","Endless Morph","Morph CV Double Ampliverter","Morph CV Triple Ampliverter","Wildcard Modulator Gain"];
    for(const [mode,name] of auxNames.entries())Object.assign(paramsById.get(14+mode),{name,visibleWhenState:{key:"Aux Knob Mode",equals:mode}});
    Object.assign(paramsById.get(12),{snap:true,button:true});
    Object.assign(paramsById.get(13),{snap:true,button:true});
    Object.assign(paramsById.get(23),{min:-1,max:1,unbounded:true});
  }
  if(target.key==="DelexanderVol1/AlgomorphSmall"){
    for(let operator=0;operator<4;operator++){
      paramsById.get(operator).name=`Operator ${operator+1}`;
      paramsById.get(4+operator).name=`Modulator ${operator+1}`;
    }
    for(let scene=0;scene<3;scene++)paramsById.get(8+scene).name=`Scene ${scene+1}`;
    Object.assign(paramsById.get(11),{name:"Morph",visibleWhenInputConnection:{ids:[5,6],mode:"all",connected:false}});
    Object.assign(paramsById.get(12),{name:"Morph CV Triple Ampliverter",visibleWhenInputConnection:{ids:[5,6],mode:"any",connected:true}});
    Object.assign(paramsById.get(13),{name:"Edit",snap:true,button:true});
    Object.assign(paramsById.get(14),{name:"Screen",snap:true,button:true});
  }
  if(target.key==="Edge/WCO_Osc"){
    const names=["Single / Dual","Rear Invert","LFO / Audio","Front Wave","Width","Rear Wave","Front CV Amount","Width CV Amount","Rear CV Amount","Coarse Pitch","Fine Pitch","FM Amount"];
    for(const [id,name] of names.entries())paramsById.get(id).name=name;
    Object.assign(paramsById.get(0),{snap:true,values:["Dual","Single"]});
    Object.assign(paramsById.get(1),{snap:true,values:["Normal","Invert"]});
    Object.assign(paramsById.get(2),{snap:true,values:["LFO","Audio"]});
  }
  if(target.key==="Edge/K_Rush"){
    const names=["Input Trim","Dry / Wet Mix","External Feedback","Drive Gain","Wavetable","Gain CV Attenuverter","Feedback CV Attenuator"];
    for(const [id,name] of names.entries())paramsById.get(id).name=name;
  }
  if(target.key==="HarmonicAnomalies/HexNut"||target.key==="HarmonicAnomalies/HexaGrain"){
    for(const id of [0,1])Object.assign(paramsById.get(id),{values:["Vector","Ring","Vortex"],snap:true});
    if(target.key==="HarmonicAnomalies/HexNut"){
      const grainSize=paramsById.get(4);
      Object.assign(grainSize,{name:"Unused HexaGrain size slot",hidden:true});
      delete grainSize.position;
    }
  }
  if(target.key==="HetrickCV/PhasorBurstGen"){
    Object.assign(paramsById.get(4),{snap:true});
    Object.assign(paramsById.get(6),{snap:true,values:["Slow","Fast"]});
    Object.assign(paramsById.get(7),{snap:true,values:["Always Reset","Pass While Bursting"]});
  }
  if(target.key==="HetrickCV/PhasorGen"){
    Object.assign(paramsById.get(6),{snap:true});
    Object.assign(paramsById.get(10),{snap:true,values:["Slow","Fast"]});
  }
  if(target.key==="EH_modules/FV-1emu"){
    const names=["POT 0","POT 1","POT 2","POT 0 CV Attenuverter","POT 1 CV Attenuverter","POT 2 CV Attenuverter","Previous Program","Next Program","Dry / Wet","Dry / Wet CV Attenuverter","Left Input Gain","Right Input Gain"];
    for(const [id,name] of names.entries())paramsById.get(id).name=name;
    for(const id of [6,7])Object.assign(paramsById.get(id),{snap:true,button:true});
  }
  if(target.key==="SignalFunctionSet/Cycle")for(let channel=0;channel<4;channel++){paramsById.get(4+channel).name=`${String.fromCharCode(65+channel)} shape`;paramsById.get(8+channel).name=`${String.fromCharCode(65+channel)} scale (bipolar)`}
  if(target.key==="computerscare/computerscare-blank"){const names=["Animation Speed","Animation Enabled","Constant Frame Delay","Animation Mode","End Behavior","Shuffle Seed","Next File Behavior","Slideshow Enabled","Slideshow Time","Keep image fully opaque when dimming room lights","Crossfade Enabled","Crossfade Time"];for(const [id,name] of names.entries())paramsById.get(id).name=name}
  if(target.key==="Airwin2Rack/Airwin2Rack"){const names=["Replace","Brightness","Detune","Bigness","Dry/Wet"];for(let id=0;id<10;id++){const name=names[id]??`Unused Effect Parameter ${id-4}`,param=paramsById.get(id),atten=paramsById.get(11+id);if(param)param.name=name;if(atten)atten.name=`${name} CV Scale`}}
  if(target.model==="SurgeXTLFO"){const targets=["Rate","Phase","Deform","Amplitude","Envelope Delay","Envelope Attack","Envelope Hold","Envelope Decay","Envelope Sustain","Envelope Release","Shape","Unipolar"];for(const param of paramsById.values()){if(param.id<12)param.name=targets[param.id];else if(param.id<52)param.name=`Mod ${(param.id-12)%4+1} to ${targets[Math.floor((param.id-12)/4)]}`;else if(param.id>=58&&param.id<74)param.name=`Step ${param.id-57}`;else if(param.id>=74&&param.id<90)param.name=`Step Trigger ${param.id-73}`;else if(param.id===93)param.name="Polyphony without connected trigger"}}
  const surgeVcoTargets={SurgeXTOSCAlias:["Shape","Wrap","Mask","Threshold","Bitcrush","Unison Detune","Unison Voices"],SurgeXTOSCClassic:["Shape","Width 1","Width 2","Sub Mix","Sync","Unison Detune","Unison Voices"],SurgeXTOSCFM2:["M1 Amount","M1 Ratio","M2 Amount","M2 Ratio","M1/2 Offset","M1/2 Phase","Feedback"],SurgeXTOSCFM3:["M1 Amount","M1 Frequency","M1 Ratio","M2 Amount","M2 Frequency","M2 Ratio","M3 Amount"],SurgeXTOSCModern:["Sawtooth","Pulse","Triangle","Width","Sync","Unison Detune","Unison Voices"],SurgeXTOSCSHNoise:["Correlation","Width","Low Cut","High Cut","Sync","Unison Detune","Unison Voices"],SurgeXTOSCSine:["Shape","Feedback","Behavior","Low Cut","High Cut","Unison Detune","Unison Voices"],SurgeXTOSCString:["Exciter","Exciter Level","String 1 Decay","String 2 Decay","String 2 Detune","String Balance","Stiffness"],SurgeXTOSCTwist:["Engine","Harmonics","Timbre","Morph","Aux Mix","LPG Response","LPG Decay"],SurgeXTOSCWavetable:["Morph","Skew Vertical","Saturate","Formant","Skew Horizontal","Unison Detune","Unison Voices"],SurgeXTOSCWindow:["Morph","Formant","Window","Low Cut","High Cut","Unison Detune","Unison Voices"]}[target.model];if(surgeVcoTargets){const targets=["Pitch",...surgeVcoTargets];for(const param of paramsById.values()){if(param.id>=1&&param.id<=7)param.name=targets[param.id];else if(param.id>=8&&param.id<40)param.name=`Mod ${(param.id-8)%4+1} to ${targets[Math.floor((param.id-8)/4)]}`}}if(target.model==="SurgeXTOSCModern"){const switches=["Shape","Sub","Sub Sync","Unused"];for(const param of paramsById.values())if(param.id>=41&&param.id<=44)param.name=switches[param.id-41]}
  if(detected.hostAdapter==="surge-dsp-only"&&["SurgeXTMixer","SurgeXTMixerSlider"].includes(target.model)){const targets=["Input 1","Input 2","Input 3","Noise","RingMod 1x2","RingMod 2x3"],modTargets=[...targets,"Noise Color","Gain"];for(const param of paramsById.values()){if(param.id<6)param.name=`${targets[param.id]} Level`;else if(param.id>=8&&param.id<14)param.name=`${targets[param.id-8]} Mute`;else if(param.id>=14&&param.id<20)param.name=`${targets[param.id-14]} Solo`;else if(param.id>=20&&param.id<52)param.name=`Mod ${(param.id-20)%4+1} to ${modTargets[Math.floor((param.id-20)/4)]}`}}
  if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTModMatrix")for(const param of paramsById.values()){param.name=param.id<8?`Target ${param.id+1}`:`Mod ${(param.id-8)%4+1} to Target ${Math.floor((param.id-8)/4)+1}`;param.min=param.id<8?-10:-1;param.max=param.id<8?10:1;param.default=0}
  if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTQuadAD"){const groups=["Attack","Decay","Mode","Attack Curve","Decay Curve","AD/AR","Link Trigger","Link Envelope"];for(const param of paramsById.values())param.name=param.id<32?`${groups[Math.floor(param.id/4)]} ${param.id%4+1}`:`Mod ${(param.id-32)%4+1} to ${param.id<48?"Attack":"Decay"} ${Math.floor((param.id-32)%16/4)+1}`}
  if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTUnisonHelper"){const targets=["Detune","Drift","Low Cut","High Cut"];for(const param of paramsById.values())if(param.id>=9)param.name=`Mod ${(param.id-9)%4+1} to ${targets[Math.floor((param.id-9)/4)]}`}
  if(target.model.startsWith("SurgeXTFX")){const slots=constants.n_fx_params??12,active=constants["FXConfig.numParams"]??slots,names=surgeFxParamNames(detected.sourceFiles??[],constants,moduleClass),activeIds=surgeFxActiveParamIds(detected.sourceFiles??[],constants,moduleClass),specific=surgeFxSpecificParamNames(detected.sourceFiles??[],moduleClass,constants),specificStart=slots+slots*4,unusedName=index=>activeIds.size&&!activeIds.has(index)?`Unused Effect Slot ${[...Array(index+1).keys()].filter(id=>!activeIds.has(id)).length}`:null,targetName=index=>index<active?(names[index]??unusedName(index)??`Effect Parameter ${index+1}`):`Unused Effect Slot ${index-active+1}`;for(const param of paramsById.values()){if(param.id<slots)param.name=targetName(param.id);else if(param.id<specificStart){const offset=param.id-slots,targetIndex=Math.floor(offset/4);param.name=`Mod ${offset%4+1} to ${targetName(targetIndex)}`}else param.name=specific[param.id-specificStart]??`Effect Switch ${param.id-specificStart+1}`}}
  if(target.model==="SurgeXTFXBonsai"){const names=["Input Gain","Bass Boost","Bass Distortion","Bias Filter","Saturation Type","Saturation Amount","Noise Sensitivity","Noise Gain","Dull","Output Gain","Mix","Unused Effect Slot 1"];for(const param of paramsById.values()){if(param.id<12)param.name=names[param.id];else if(param.id<60){const offset=param.id-12;param.name=`Mod ${offset%4+1} to ${names[Math.floor(offset/4)]}`}}}
  const runtimeInputs=ports(detected.config.inputs,inputIds,inputCount,"IN");
  if(target.key==="NonLinearInstruments/BallisticENV"){
    for(const [id,name] of ["Impulse CV","Angle CV","Gravity CV","Bounce CV"].entries())Object.assign(runtimeInputs[id],{name,kind:"cv"});
    Object.assign(runtimeInputs[4],{name:"Trigger",kind:"gate"});
  }
  if(target.key==="NonLinearInstruments/LuciCell")for(const id of [0,1,2,3,4])runtimeInputs[id].kind="gate";
  if(target.key==="HetrickCV/PhasorBurstGen")for(const id of [4,5,6,7,8])runtimeInputs[id].kind="gate";
  if(target.key==="HetrickCV/PhasorGen")for(const id of [6,7,8])runtimeInputs[id].kind="gate";
  if(surgeVcoTargets)for(const input of runtimeInputs)if(input.id>=2&&input.id<=5){input.name=`Modulation Signal ${input.id-1}`;input.kind="cv"}if(target.model==="SurgeXTLFO")for(const input of runtimeInputs)if(input.id>=4){input.name=`Modulation Signal ${input.id-3}`;input.kind="cv"}if(detected.hostAdapter==="surge-dsp-only"&&target.model==="SurgeXTMixerSlider")for(const input of runtimeInputs){input.name=input.id<6?`Input ${Math.floor(input.id/2)+1} ${input.id%2?"Right":"Left"}`:`Modulator ${input.id-5}`;input.kind=input.id<6?"audio":"cv"}if(target.key==="Dintree-Virtual/V218-SH-Clock-Noise")runtimeInputs[3].kind="cv";if(target.model==="SurgeXTUnisonHelperCVExpander")for(const input of runtimeInputs)input.name=`CV ${input.id+1}`;
  if(target.key==="DanTSynth/AOCR"){runtimeInputs[0].name="Signal";runtimeInputs[1].name="Attenuverter CV";runtimeInputs[2].name="Offset CV"}
  if(target.key==="Edge/WCO_Osc"){
    ["Linear FM","Sync","V/Oct","Front Wave CV","Width CV","Rear Wave CV"].forEach((name,id)=>runtimeInputs[id].name=name);
    runtimeInputs[1].kind="gate";
  }
  if(target.key==="Edge/K_Rush"){
    const names=["Wavetable CV","Gain CV","Audio Input","Feedback CV","External Feedback Input"];
    for(const [id,name] of names.entries())Object.assign(runtimeInputs[id],{name,kind:id===2||id===4?"audio":"cv"});
  }
  if(target.key==="DelexanderVol1/AlgomorphSmall"){
    ["Wildcard","Operator 1","Operator 2","Operator 3","Operator 4","Morph CV 1","Morph CV 2"].forEach((name,id)=>runtimeInputs[id].name=name);
  }
  if(target.key==="EH_modules/FV-1emu"){
    const names=["POT 0 CV","POT 1 CV","POT 2 CV","Left Audio","Right Audio","Dry / Wet CV"];
    for(const [id,name] of names.entries())Object.assign(runtimeInputs[id],{name,kind:[3,4].includes(id)?"audio":"cv"});
  }
  if(target.plugin==="DrumKit"&&drumKitSampleContract(target.model)&&!drumKitSampleContract(target.model).moduleClass){for(let voice=0;voice<2;voice++){Object.assign(runtimeInputs[voice],{name:`Sample ${voice+1} CV`,kind:"cv"});Object.assign(runtimeInputs[16+voice],{name:`Trigger ${voice+1}`,kind:"gate"});Object.assign(runtimeInputs[32+voice],{name:`Tune ${voice+1} CV`,kind:"cv"})}}
  if(target.key==="DrumKit/OpenHiHat")for(let voice=0;voice<2;voice++){Object.assign(runtimeInputs[48+voice],{name:`Choke Time ${voice+1} CV`,kind:"cv"});Object.assign(runtimeInputs[64+voice],{name:`Choke ${voice+1}`,kind:"gate"})}
  if(target.key==="DrumKit/Gnome")Object.assign(runtimeInputs[3],{name:"Run Toggle",kind:"gate"});
  if(target.key==="DrumKit/Sequencer"){Object.assign(runtimeInputs[1],{name:"Run Toggle",kind:"gate"});Object.assign(runtimeInputs[2],{name:"Cycle Toggle",kind:"gate"});for(let id=5;id<14;id++)runtimeInputs[id].kind="cv"}
  if(target.key==="DrumKit/MarionetteBass"){const names=["Trigger","Pitch Envelope","Pitch Decay CV","Pitch Sustain CV","Pitch Release CV","Amplitude Envelope","Amplitude Attack CV","Amplitude Decay CV","Amplitude Sustain CV","Amplitude Release CV","Blend CV","Tune CV","Sub Oscillator Mix CV","Sub Oscillator Wave CV"];for(const [id,name] of names.entries())Object.assign(runtimeInputs[id],{name,kind:id===0?"gate":"cv"})}
  if(target.key==="SignalFunctionSet/Cycle")for(let channel=0;channel<4;channel++){runtimeInputs[6+channel].name=`${String.fromCharCode(65+channel)} shape CV`;runtimeInputs[10+channel].name=`${String.fromCharCode(65+channel)} scale CV`}
  if(target.model.startsWith("SurgeXTFX")){const modulationEnd=5+(constants.n_mod_inputs??4);for(const input of runtimeInputs)if(input.id>=5&&input.id<modulationEnd){input.name=`Modulation Signal ${input.id-4}`;input.kind="cv"}}
  const runtimeOutputs=ports(detected.config.outputs,outputIds,outputCount,"OUT");if(target.key==="computerscare/computerscare-sloly-pit")for(const output of runtimeOutputs){const number=output.id+1,remainder=number%100,suffix=remainder>=11&&remainder<=13?"th":number%10===1?"st":number%10===2?"nd":number%10===3?"rd":"th";output.name=`${number}${suffix}`}if(detected.browserAsset&&runtimeOutputs.length===1)runtimeOutputs[0].kind="audio";const filterOutputs=runtimeOutputs.some(output=>/\b(?:lowpass|lp)\b/i.test(output.name))&&runtimeOutputs.some(output=>/\b(?:highpass|hp)\b/i.test(output.name));if(filterOutputs){if(runtimeInputs[0])runtimeInputs[0].kind="audio";for(const output of runtimeOutputs)output.kind="audio"}if(target.plugin==="Befaco"&&["Mixer","Mixer2"].includes(target.model)){for(const port of [...runtimeInputs,...runtimeOutputs])port.kind="audio"}if(target.key==="Befaco/NoisePlethora")for(const output of runtimeOutputs)output.kind="audio";if(target.key==="Befaco/SpringReverb"){for(const input of runtimeInputs)input.kind=[2,3].includes(input.id)?"audio":"cv";for(const output of runtimeOutputs)output.kind="audio"}if(target.key==="Befaco/Iroi"){for(const input of runtimeInputs)input.kind=input.id<2?"audio":"cv";for(const output of runtimeOutputs)output.kind="audio"}if(target.key==="repelzen/refold"){runtimeInputs[0].kind="audio";runtimeOutputs[0].kind="audio"}if(target.key==="WrongPeople/Tourette"){for(const id of [0,1])runtimeInputs[id].kind="audio";runtimeInputs[2].kind="gate";for(const output of runtimeOutputs)output.kind="audio"}if(target.key==="Dintree-Virtual/V107-Dual_Slew")for(const port of [...runtimeInputs,...runtimeOutputs])port.kind="cv";if(target.key==="Dintree-Virtual/V218-SH-Clock-Noise")runtimeOutputs[2].kind="cv";if(target.model==="SurgeXTUnisonHelperCVExpander")for(const output of runtimeOutputs)output.name=`CV ${Math.floor(output.id/4)+1} to Sub VCO ${output.id%4+1}`;
  if(target.key==="DanTSynth/AOCR")runtimeOutputs[0].name="Signal";
  if(target.key==="Edge/WCO_Osc")Object.assign(runtimeOutputs[0],{name:"Audio",kind:"audio"});
  if(target.key==="Edge/K_Rush"){
    Object.assign(runtimeOutputs[0],{name:"Audio Output",kind:"audio"});
    Object.assign(runtimeOutputs[1],{name:"Internal Feedback Send",kind:"audio"});
  }
  if(target.key==="DelexanderVol1/AlgomorphSmall"){
    ["Modulator 1","Modulator 2","Modulator 3","Modulator 4","Carrier Sum"].forEach((name,id)=>runtimeOutputs[id].name=name);
  }
  if(target.key==="EH_modules/FV-1emu"){Object.assign(runtimeOutputs[0],{name:"Left Audio",kind:"audio"});Object.assign(runtimeOutputs[1],{name:"Right Audio",kind:"audio"})}
  if(target.key==="NOI/Pruners")for(const output of runtimeOutputs)output.kind=output.id<5?"audio":"cv";
  if(target.key==="NonLinearInstruments/LuciCell")runtimeOutputs[0].kind="audio";
  if(target.plugin==="DrumKit"&&drumKitSampleContract(target.model)&&!drumKitSampleContract(target.model).moduleClass)for(let voice=0;voice<2;voice++)Object.assign(runtimeOutputs[voice],{name:`Audio ${voice+1}`,kind:"audio"});
  if(target.key==="DrumKit/Gnome"){const names=["Whole Note","Half Note","Quarter Note","Eighth Note","Sixteenth Note","Swing A","Swing B","Swing C","Swing D","Swing E","Swing F"];for(const [id,name] of names.entries())Object.assign(runtimeOutputs[id],{name,kind:"gate"})}
  if(target.key==="DrumKit/Sequencer")for(let id=0;id<8;id++)Object.assign(runtimeOutputs[id],{name:`Track ${id+1} Gate`,kind:"gate"});
  if(target.key==="DrumKit/Baronial")Object.assign(runtimeOutputs[0],{name:"Envelope",kind:"cv"});
  if(target.key==="DrumKit/MarionetteBass"){Object.assign(runtimeOutputs[0],{name:"Audio",kind:"audio"});Object.assign(runtimeOutputs[1],{name:"Envelope",kind:"cv"})}
  if(target.key==="FrozenWasteland/PortlandWeather")for(const id of [21,155,156])runtimeInputs[id].kind="cv";
  if(target.key==="FrozenWasteland/StringTheory"){for(const id of [7,9,14])runtimeInputs[id].kind="audio";runtimeInputs[8].kind="gate";runtimeInputs[13].kind="cv";for(const output of runtimeOutputs)output.kind="audio"}
  if(target.key==="FrozenWasteland/MidiRecorder")runtimeInputs[3].kind="gate";
  if(target.key==="HoyerHoppes/scanning_frequency_division_osc_poly"){
    Object.assign(paramsById.get(4),{name:"Window Depth"});
    Object.assign(paramsById.get(5),{name:"Window Enable",values:["Off","On"]});
    ["Scan CV","V/Oct","Wave Shape CV","FM","FM Depth CV","Sync",...Array.from({length:8},(_,index)=>`Divide by ${index+1}`)].forEach((name,id)=>runtimeInputs[id].name=name);
    for(let id=5;id<14;id++)runtimeInputs[id].kind="gate";
    ["Frequency","Scan","Reflected","Low"].forEach((name,id)=>Object.assign(runtimeOutputs[id],{name,kind:"audio"}));
    Object.assign(runtimeOutputs[4],{name:"Scan Change",kind:"gate"});
  }
  if([
    "ExpertSleepers-Encoders/ExpertSleepers-Encoders-ES5",
    "ExpertSleepers-Encoders/ExpertSleepers-Encoders-ES40",
  ].includes(target.key))for(const input of runtimeInputs)input.kind="cv";
  if(target.key==="ExpertSleepers-Encoders/ExpertSleepers-Encoders-Calibrator"){
    Object.assign(paramsById.get(0),{name:"Calibrate input",snap:true,button:true});
    Object.assign(paramsById.get(1),{name:"Calibrate output",snap:true,button:true});
    Object.assign(runtimeInputs[0],{name:"Calibration measurement / input",kind:"cv"});
    Object.assign(runtimeOutputs[0],{name:"Calibrated input",kind:"cv"});
    Object.assign(runtimeInputs[1],{name:"Output signal",kind:"cv"});
    Object.assign(runtimeOutputs[1],{name:"Calibrated output",kind:"cv"});
  }
  if(target.key==="ExpertSleepers-Encoders/ExpertSleepers-Encoders-SMUX"){
    Object.assign(paramsById.get(0),{name:"Flip left",snap:true,button:true});
    Object.assign(paramsById.get(1),{name:"Flip right",snap:true,button:true});
    ["Left A","Left B","Right A","Right B"].forEach((name,id)=>runtimeInputs[id].name=name);
    Object.assign(runtimeOutputs[0],{name:"Left multiplexed"});
    Object.assign(runtimeOutputs[1],{name:"Right multiplexed"});
  }
  if(target.key==="GP/AB4"){
    Object.assign(paramsById.get(0),{name:"A / B",snap:true,values:["A","B"]});
    Object.assign(runtimeInputs[8],{name:"A / B select",kind:"gate"});
    Object.assign(runtimeOutputs[4],{name:"B selected",kind:"gate"});
  }
  if(target.key==="GP/AB8"){
    Object.assign(paramsById.get(0),{name:"A / B",snap:true,values:["A","B"]});
    Object.assign(runtimeInputs[16],{name:"A / B select",kind:"gate"});
    Object.assign(runtimeOutputs[8],{name:"B selected",kind:"gate"});
  }
  if(target.key==="GP/ChainMixerChannel"){
    Object.assign(paramsById.get(2),{min:-100,max:100,snap:true});
    Object.assign(paramsById.get(3),{min:0,max:768,default:578,snap:true});
    Object.assign(paramsById.get(4),{snap:true,values:["Off","On"]});
    Object.assign(paramsById.get(5),{snap:true,values:["Off","On"]});
    for(const input of runtimeInputs)input.kind="audio";
  }
  if(target.key==="GP/ChainMixerMaster"){
    Object.assign(paramsById.get(0),{min:0,max:256,default:256});
    Object.assign(paramsById.get(1),{min:0,max:256,default:256});
    Object.assign(paramsById.get(2),{min:0,max:768,default:578,snap:true});
    Object.assign(paramsById.get(3),{min:0,max:1,default:0,snap:true,values:["Off","On"]});
    runtimeInputs.length=0;
    for(const output of runtimeOutputs)output.kind="audio";
  }
  if(target.key==="GP/ChainMixerAux"){
    for(const [id,name] of [[0,"Aux Return 1 Gain"],[1,"Aux Return 2 Gain"]])Object.assign(paramsById.get(id),{name,min:0,max:768,default:578,snap:true});
    for(const [id,name] of [[2,"Solo AUX 1"],[3,"Solo AUX 2"],[4,"Mute AUX 1"],[5,"Mute AUX 2"]])Object.assign(paramsById.get(id),{name,min:0,max:1,default:0,snap:true,values:["Off","On"]});
    for(const input of runtimeInputs)input.kind="audio";
    for(const output of runtimeOutputs)output.kind="audio";
  }
  if(target.key==="GP/StereoChorus"){
    Object.assign(paramsById.get(0),{min:-0.0001,max:1,default:.5});
    for(const id of [1,2,4,5,6,7,8])Object.assign(paramsById.get(id),{snap:true});
    Object.assign(paramsById.get(3),{snap:true,values:["1","2","3","4"]});
    for(const id of [0,1])runtimeInputs[id].kind="audio";
    for(const id of [2,3,4,5,6,7,8,9])runtimeInputs[id].kind="cv";
    for(const output of runtimeOutputs)output.kind="audio";
  }
  if(target.key==="GP/Rotary"){
    for(const id of [0,4,11,12])Object.assign(paramsById.get(id),{snap:true,values:["Off","On"]});
    for(const id of [2,3,6,7,9,10,14])paramsById.get(id).snap=true;
    runtimeInputs[0].kind="audio";
    runtimeInputs[1].kind="gate";
    runtimeInputs[2].kind="gate";
    runtimeInputs[3].kind="cv";
    runtimeInputs[4].kind="cv";
    for(const output of runtimeOutputs)output.kind="audio";
  }
  if(target.key==="SignalFunctionSet/Cycle")for(let channel=0;channel<4;channel++){runtimeOutputs[channel].name=`${String.fromCharCode(65+channel)} unipolar (0-5V)`;runtimeOutputs[4+channel].name=`${String.fromCharCode(65+channel)} bipolar (±5V)`}
  const targetWidgetConstants=target.key==="Biset/Biset-Regex-Condensed"?{condensed:1,exp_count:12}:target.key==="Biset/Biset-Regex"?{condensed:0,exp_count:8}:{},
    placementConstants={...(detected.widgetConstants??{}),...constants,...targetWidgetConstants,...(Number.isFinite(detected.panelWidth)?{box_size_x:detected.panelWidth}:{})},
    placements=rackWidgetPlacements(detected.widgetSource,detected.enums,placementConstants,detected.widgetSupportSource),
    svgHelperPlacements=rackSvgHelperPlacements(detected.widgetSource,detected.enums,sourceDir,placementConstants);
  if(svgHelperPlacements){
    placements.panelSize??=svgHelperPlacements.panelSize;
    for(const group of ["params","inputs","outputs","lights"])for(const [id,position] of svgHelperPlacements[group])if(!placements[group].has(id))placements[group].set(id,position)
  }
  if(target.key==="LomasModules/AdvancedSampler"){
    const mm=value=>Number((value*75/25.4).toFixed(3));
    detected.panelWidth=150;
    placements.panelSize={x:150,y:380};
    const paramPositions=[
      [0,9.562,48.49,"RoundGrayKnob"],[1,9.562,67.54,"RoundGrayKnob"],
      [2,25.475,67.54,"RoundGrayKnob"],[3,41.387,67.54,"RoundGrayKnob"],
      [4,25.475,48.49,"RoundGrayKnob"],[5,41.387,48.49,"RoundGrayKnob"],
      [6,6.64,15.47,"LoadButton"],[7,31.653,15.47,"RubberSmallButton"],
      [8,19.147,15.47,"RubberSmallButton"],[9,44.16,15.47,"RubberSmallButton"],
    ];
    for(const [id,x,y,widget] of paramPositions)placements.params.set(id,{x:mm(x),y:mm(y),centered:true,widget});
    for(const id of [6,7,8,9])Object.assign(paramsById.get(id),{snap:true,button:true});
    const inputPositions=[
      [0,7.76,84.089],[1,7.76,98.03],[2,19.52,98.03],[3,31.28,98.03],
      [4,19.52,84.07],[5,31.28,84.07],[6,43.04,98.03],[7,43.04,84.07],[8,13.64,111.99],
    ];
    for(const [id,x,y] of inputPositions)placements.inputs.set(id,{x:mm(x),y:mm(y),centered:true,widget:"PJ301MPort"});
    placements.outputs.set(0,{x:mm(37.16),y:mm(111.99),centered:true,widget:"PJ301MPort"});
    placements.outputs.set(1,{x:mm(25.4),y:mm(111.99),centered:true,widget:"PJ301MPort"});
    for(const input of runtimeInputs)input.kind=[7,8].includes(input.id)?"gate":input.id===6?"audio":"cv";
    runtimeOutputs[0].kind="gate";runtimeOutputs[1].kind="audio";
    placements.lights.set(0,{x:mm(19.147),y:mm(15.47),centered:true,widget:"RubberSmallButtonLed<BlueLight>",paramId:8});
    placements.lights.set(1,{x:mm(31.653),y:mm(15.47),centered:true,widget:"RubberSmallButtonLed<BlueLight>",paramId:7});
    placements.lights.set(2,{x:mm(44.16),y:mm(15.47),centered:true,widget:"RubberSmallButtonLed<RedLight>",paramId:9});
  }
  if(target.key==="HetrickCV/PhasorBurstGen"){
    const paramPositions=[
      [0,17.5,60,"HCVThemedRogan"],[1,24,118,"Trimpot"],[2,191.5,60,"HCVThemedRogan"],[3,198,118,"Trimpot"],
      [4,104.5,60,"HCVThemedRogan"],[5,111,118,"Trimpot"],[6,25,215,"CKSS"],[7,68,215,"CKSS"],
      [8,110,245,"TL1105"],[9,152,245,"TL1105"],[10,194,245,"TL1105"],
    ];
    for(const [id,x,y,widget] of paramPositions)placements.params.set(id,{x,y,widget});
    const inputPositions=[[0,21,168],[1,195,168],[2,108,168],[3,22,265],[4,64,265],[5,106,265],[6,148,265],[8,190,265]];
    for(const [id,x,y] of inputPositions)placements.inputs.set(id,{x,y,widget:"ThemedPJ301MPort"});
    for(const [id,x] of [[0,22],[1,78],[2,134],[3,190]])placements.outputs.set(id,{x,y:315,widget:"ThemedPJ301MPort"});
    for(const [id,x,y] of [[0,17,313],[1,73,313],[2,129,313],[3,185,313],[4,185,263]])placements.lights.set(id,{x,y,widget:"SmallLight<RedLight>"});
  }
  if(target.key==="HetrickCV/PhasorGen"){
    const paramPositions=[
      [0,17.5,60,"HCVThemedRogan"],[1,24,118,"Trimpot"],[2,72.5,60,"HCVThemedRogan"],[3,140,64,"Trimpot"],
      [4,72.5,110,"HCVThemedRogan"],[5,140,114,"Trimpot"],[6,72.5,160,"HCVThemedRogan"],[7,140,164,"Trimpot"],
      [8,72.5,210,"HCVThemedRogan"],[9,140,214,"Trimpot"],[10,25,215,"CKSS"],
    ];
    for(const [id,x,y,widget] of paramPositions)placements.params.set(id,{x,y,widget});
    const inputPositions=[[0,21,168],[1,200,63],[2,200,113],[3,200,163],[4,200,213],[5,22,265],[6,78,265],[7,134,265],[8,190,265]];
    for(const [id,x,y] of inputPositions)placements.inputs.set(id,{x,y,widget:"ThemedPJ301MPort"});
    for(const [id,x] of [[0,22],[1,78],[2,134],[3,190]])placements.outputs.set(id,{x,y:315,widget:"ThemedPJ301MPort"});
    for(const [id,x,y,widget] of [[0,17,313,"SmallLight<RedLight>"],[1,73,313,"SmallLight<RedLight>"],[2,129,313,"SmallLight<GreenRedLight>"],[4,185,313,"SmallLight<RedLight>"]])placements.lights.set(id,{x,y,widget});
  }
  if(target.key==="Leviathan/IntegralFlux"){
    const mm=value=>Number((value*75/25.4).toFixed(3));
    detected.panelWidth=300;
    placements.panelSize={x:300,y:380};
    for(const [id,x,y,widget] of [
      [0,25.494,86.446,"IntegralFluxEclipse2Knob"],
      [1,31.875,20.938,"LoopGoldButton"],
      [2,69.552,20.938,"LoopGoldButton"],
      [3,33.755,36.293,"IntegralFluxHalo2Knob"],
      [4,67.638,36.293,"IntegralFluxHalo2Knob"],
      [5,42.542,86.446,"IntegralFluxEclipse2Knob"],
      [6,42.007,53.079,"IntegralFluxHalo2Knob"],
      [7,59.185,53.079,"IntegralFluxHalo2Knob"],
      [8,59.585,86.446,"IntegralFluxEclipse2Knob"],
      [9,13.975,50.526,"IntegralFluxCurveHalo2Knob"],
      [10,91.716,50.526,"IntegralFluxCurveHalo2Knob"],
      [11,75.931,86.446,"IntegralFluxEclipse2Knob"],
      [12,13.975,36.8,"IntegralFluxPlasmaSwitch"],
      [13,91.716,36.8,"IntegralFluxPlasmaSwitch"],
    ])placements.params.set(id,{x:mm(x),y:mm(y),centered:true,widget});
    for(const [id,x,y] of [
      [0,9.947,15.354],[1,20.911,15.354],[2,42.543,76.377],[3,59.585,76.377],
      [4,80.217,15.354],[5,91.181,15.354],[6,21.683,36.416],[7,79.81,36.216],
      [8,26.633,50.27],[9,74.56,50.07],[10,32.704,63.263],[11,69.189,63.263],
      [12,40.049,20.838],[13,61.179,20.838],
    ])placements.inputs.set(id,{x:mm(x),y:mm(y),centered:true,widget:"Magitek2InputJack"});
    for(const [id,x,y] of [
      [0,25.295,96.915],[1,42.343,96.915],[2,59.486,96.915],[3,75.832,96.915],
      [4,10.037,96.946],[5,10.047,110.682],[6,33.652,110.882],[7,50.714,110.882],
      [8,67.975,110.882],[9,91.281,110.682],[10,91.281,96.915],
    ])placements.outputs.set(id,{x:mm(x),y:mm(y),centered:true,widget:"Magitek2OutputJack"});
    for(const [id,x,y,widget] of [
      [0,31.875,14.855,"SmallAperture<AmberApertureLight>"],
      [1,69.353,14.855,"SmallAperture<AmberApertureLight>"],
      [2,16.537,96.76,"SmallAperture<AmberApertureLight>"],
      [3,16.547,110.499,"SmallAperture<GreenApertureLight>"],
      [4,84.731,110.599,"SmallAperture<GreenApertureLight>"],
      [5,84.603,96.716,"SmallAperture<AmberApertureLight>"],
      [6,42.374,110.758,"SmallAperture<MagentaApertureLight>"],
      [7,59.554,110.758,"SmallAperture<GreenApertureLight>"],
    ])placements.lights.set(id,{x:mm(x),y:mm(y),centered:true,widget});
  }
  if(target.key==="Leviathan/Proc"){
    const mm=value=>Number((value*75/25.4).toFixed(3));
    detected.panelWidth=120;
    placements.panelSize={x:120,y:380};
    Object.assign(paramsById.get(0),{button:true,snap:true});
    for(const [id,x,y,widget] of [
      [0,33.075,20.138,"LoopGoldButton"],
      [1,32.907,36.293,"ProcEdgeHalo2Knob"],
      [2,32.907,53.079,"ProcEdgeHalo2Knob"],
      [3,11.775,57.926,"ProcCurveHalo2Knob"],
      [4,7.246,28.71,"TinyClockworkGearKnob"],
    ])placements.params.set(id,{x:mm(x),y:mm(y),centered:true,widget});
    for(const [id,x,y] of [
      [0,7.247,16.654],[1,19.943,16.654],[2,7.207,40.367],
      [3,19.943,32.416],[4,19.943,44.898],[5,23.604,63.263],
    ])placements.inputs.set(id,{x:mm(x),y:mm(y),centered:true,widget:"Magitek2InputJack"});
    for(const [id,x,y] of [
      [0,9.437,96.946],[1,26.595,96.915],[2,9.447,110.682],[3,26.552,110.882],
    ])placements.outputs.set(id,{x:mm(x),y:mm(y),centered:true,widget:"Magitek2OutputJack"});
    for(const [id,x,y,widget] of [
      [0,33.075,14.055,"SmallAperture<AmberApertureLight>"],
      [1,15.937,96.76,"SmallAperture<GreenApertureLight>"],
      [2,33.645,96.952,"SmallAperture<MagentaApertureLight>"],
      [3,15.947,110.758,"SmallAperture<GreenApertureLight>"],
      [4,33.579,110.941,"SmallAperture<MagentaApertureLight>"],
    ])placements.lights.set(id,{x:mm(x),y:mm(y),centered:true,widget});
  }
  if(target.key==="Leviathan/Undertow"){
    const mm=value=>Number((value*75/25.4).toFixed(3));
    detected.panelWidth=120;
    placements.panelSize={x:120,y:380};
    Object.assign(paramsById.get(4),{snap:true,values:["Continuous","Octave Stepped"]});
    for(const [id,x,y,widget] of [
      [0,9.199942,19.600001,"LeviathanHaloKnob2"],
      [1,20.083501,30.103955,"BipolarTinyClockworkGearKnob"],
      [2,8.6,76.200005,"Eclipse2Knob"],
      [3,31.367002,76.200005,"Eclipse2Knob"],
      [4,20.083501,47.9,"SmallGoldApertureButton"],
      [5,20.083501,76.200005,"TinyClockworkGearKnob"],
    ])placements.params.set(id,{x:mm(x),y:mm(y),centered:true,widget});
    for(const [id,x,y] of [
      [0,31.366833,19.600001],
      [1,20.083501,62.489004],
      [2,8.6,62.489004],
      [3,31.367002,62.489004],
      [4,8.6,42.5],
      [5,31.366833,42.5],
    ])placements.inputs.set(id,{x:mm(x),y:mm(y),centered:true,widget:"Magitek2InputJack"});
    for(const [id,x,y] of [
      [0,7.800163,112.80022],
      [1,32.800002,112.80022],
      [2,20.3,112.80022],
    ])placements.outputs.set(id,{x:mm(x),y:mm(y),centered:true,widget:"Magitek2OutputJack"});
    for(const [id,x,y,widget] of [
      [0,14.456001,42.5,"TinyAperture<WhiteApertureLight>"],
      [1,37.288567,42.5,"TinyAperture<WhiteApertureLight>"],
      [2,20.083501,47.9,"SmallGoldApertureLight"],
    ])placements.lights.set(id,{x:mm(x),y:mm(y),centered:true,widget,...(id===2?{paramId:4}:{})});
  }
  if(target.key==="Leviathan/TemporalDeck"){
    const mm=value=>Number((value*75/25.4).toFixed(3));
    detected.panelWidth=300;
    placements.panelSize={x:300,y:380};
    for(const [id,x,y,widget] of [
      [0,8.408,17.086,"Eclipse2Knob"],[1,20.889,99.226,"Eclipse2Knob"],
      [2,9.459,84.07,"Eclipse2Knob"],[3,70.982,98.872,"Eclipse2Knob"],
      [4,70.982,112.996,"Eclipse2Knob"],[5,57.5,101.1,"SmallGoldButton"],
      [6,45.6,101.1,"SmallGoldButton"],[7,33.2,101.1,"SmallGoldButton"],
      [8,83.84,82.03,"LEDButton"],[9,83.8,72,"TemporalDeckScopeSpawnButton"],
    ])placements.params.set(id,{x:mm(x),y:mm(y),centered:true,widget});
    for(const [id,x,y] of [[0,45.665,112.9],[1,20.905,112.9],[2,8.437,99.012],[3,8.478,112.9],[4,33.403,112.9],[5,57.5,112.9],[6,39.5,112.9]])placements.inputs.set(id,{x:mm(x),y:mm(y),centered:true,widget:"Magitek2InputJack"});
    for(const [id,x,y] of [[0,94.241,99.012],[1,83.037,99.135],[2,94.2,113.146],[3,82.996,113.269]])placements.outputs.set(id,{x:mm(x),y:mm(y),centered:true,widget:"Magitek2OutputJack"});
    for(const [id,x,y,widget] of [
      [0,57.5,95.3,"SmallAperture<RedApertureLight>"],[1,45.6,95.3,"SmallAperture<RedApertureLight>"],
      [2,30.8,95.3,"TinyAperture<RedApertureLight>"],[3,33.2,95.3,"TinyAperture<RedApertureLight>"],
      [4,35.6,95.3,"TinyAperture<RedApertureLight>"],[5,98.4,5.8,"SmallAperture<AmberGreenApertureLight>"],
    ])placements.lights.set(id,{x:mm(x),y:mm(y),centered:true,widget});
  }
  if(target.key==="Leviathan/TDScope"){
    const mm=value=>Number((value*75/25.4).toFixed(3));
    detected.panelWidth=120;
    placements.panelSize={x:120,y:380};
    placements.lights.set(0,{x:mm(3.2),y:mm(5.8),centered:true,widget:"SmallAperture<AmberGreenApertureLight>"});
  }
  if(target.key==="DanTSynth/AOCR"){detected.panelWidth=75;placements.panelSize={x:75,y:380}}
  if(target.key==="GP/AB4"){
    const mm=value=>Number((value*75/25.4).toFixed(3)),left=mm(5.5),right=Number((60-left).toFixed(3));
    placements.panelSize={x:60,y:380};
    placements.params.set(0,{x:right,y:mm(38),centered:true,widget:"VCVLatch"});
    placements.lights.set(0,{x:right,y:mm(38),centered:true,widget:"MediumLight<GreenLight>",paramId:0});
    placements.inputs.set(8,{x:right,y:mm(49),centered:true,widget:"ThemedPJ301MPort"});
    placements.outputs.set(4,{x:right,y:mm(60),centered:true,widget:"ThemedPJ301MPort"});
    for(let row=0;row<4;row++){
      placements.inputs.set(row,{x:left,y:mm(27+11*row),centered:true,widget:"ThemedPJ301MPort"});
      placements.inputs.set(4+row,{x:left,y:380+mm(-49+11*row),centered:true,widget:"ThemedPJ301MPort"});
      placements.outputs.set(row,{x:right,y:380+mm(-49+11*row),centered:true,widget:"ThemedPJ301MPort"});
    }
  }
  if(target.key==="GP/AB8"){
    const mm=value=>Number((value*75/25.4).toFixed(3)),left=mm(5.5),middle=mm(3*5.08),right=Number((90-left).toFixed(3));
    placements.panelSize={x:90,y:380};
    placements.params.set(0,{x:left,y:mm(16.5+10.16),centered:true,widget:"VCVLatch"});
    placements.lights.set(0,{x:left,y:mm(16.5+10.16),centered:true,widget:"MediumLight<GreenLight>",paramId:0});
    placements.inputs.set(16,{x:left,y:mm(16.5),centered:true,widget:"ThemedPJ301MPort"});
    placements.outputs.set(8,{x:right,y:mm(16.5+5.08),centered:true,widget:"ThemedPJ301MPort"});
    for(let row=0;row<8;row++){
      const y=Number((380+mm(-14-7*10.16+row*10.16)).toFixed(3));
      placements.inputs.set(row,{x:left,y,centered:true,widget:"ThemedPJ301MPort"});
      placements.inputs.set(8+row,{x:middle,y,centered:true,widget:"ThemedPJ301MPort"});
      placements.outputs.set(row,{x:right,y,centered:true,widget:"ThemedPJ301MPort"});
    }
  }
  if(target.key==="GP/ChainMixerChannel"){
    const mm=value=>Number((value*75/25.4).toFixed(3)),x=15;
    placements.panelSize={x:30,y:380};
    for(const [id,y,widget] of [[0,14.5,"PointyKnob10mm"],[1,24.5,"PointyKnob10mm"],[2,34.5,"PointyKnob10mm"],[3,62,"GPaudioSlider44mm"],[4,88.5,"VCVLatch"],[5,96.5,"VCVLatch"]])placements.params.set(id,{x,y:mm(y),centered:true,widget});
    placements.lights.set(0,{x,y:mm(88.5),centered:true,widget:"MediumLight<GreenLight>",paramId:4});
    placements.lights.set(1,{x,y:mm(96.5),centered:true,widget:"MediumLight<RedLight>",paramId:5});
    placements.inputs.set(0,{x,y:mm(105.5),centered:true,widget:"ThemedPJ301MPort"});
    placements.inputs.set(1,{x,y:mm(114.5),centered:true,widget:"ThemedPJ301MPort"});
  }
  if(target.key==="GP/ChainMixerMaster"){
    const mm=value=>Number((value*75/25.4).toFixed(3)),x=mm(13.5);
    detected.panelWidth=60;
    placements.panelSize={x:60,y:380};
    for(const [id,y,widget] of [[0,14.5,"PointyKnob10mm"],[1,24.5,"PointyKnob10mm"],[2,62,"GPaudioSlider44mm"],[3,96.5,"VCVLatch"]])placements.params.set(id,{x,y:mm(y),centered:true,widget});
    placements.lights.set(0,{x,y:mm(96.5),centered:true,widget:"MediumLight<RedLight>",paramId:3});
    placements.outputs.set(0,{x,y:mm(105.5),centered:true,widget:"ThemedPJ301MPort"});
    placements.outputs.set(1,{x,y:mm(114.5),centered:true,widget:"ThemedPJ301MPort"});
  }
  if(target.key==="GP/ChainMixerAux"){
    const mm=value=>Number((value*75/25.4).toFixed(3)),xs=[mm(5.08),mm(15.24)];
    detected.panelWidth=60;
    placements.panelSize={x:60,y:380};
    for(const [side,x] of xs.entries()){
      placements.params.set(side,{x,y:mm(35.75),centered:true,widget:"GPaudioSlider38mm"});
      placements.params.set(2+side,{x,y:mm(59.5),centered:true,widget:"VCVLatch"});
      placements.params.set(4+side,{x,y:mm(67.5),centered:true,widget:"VCVLatch"});
      placements.lights.set(side,{x,y:mm(59.5),centered:true,widget:"MediumLight<GreenLight>",paramId:2+side});
      placements.lights.set(2+side,{x,y:mm(67.5),centered:true,widget:"MediumLight<RedLight>",paramId:4+side});
      placements.inputs.set(2*side,{x,y:mm(81.5),centered:true,widget:"ThemedPJ301MPort"});
      placements.inputs.set(2*side+1,{x,y:mm(90.5),centered:true,widget:"ThemedPJ301MPort"});
      placements.outputs.set(2*side,{x,y:mm(105.5),centered:true,widget:"ThemedPJ301MPort"});
      placements.outputs.set(2*side+1,{x,y:mm(114.5),centered:true,widget:"ThemedPJ301MPort"});
    }
  }
  if(target.key==="GP/StereoChorus"){
    const mm=value=>Number((value*75/25.4).toFixed(3)),socketX=Array.from({length:4},(_,index)=>mm(6.08+index*((9*5.08-2*6.08)/3)));
    detected.panelWidth=135;
    placements.panelSize={x:135,y:380};
    for(const [id,x,y,widget] of [[0,mm(12.5),mm(19),"FilledKnob16mm"],[1,mm(9*5.08-12.5),mm(19),"FilledKnob16mm"],[2,mm(9),mm(54.5),"PointyKnob12mm"],[3,mm(4.5*5.08),mm(54.5),"PointyKnob12mm"],[4,mm(9*5.08-9),mm(54.5),"PointyKnob12mm"]])placements.params.set(id,{x,y,centered:true,widget});
    for(let id=5;id<=8;id++)placements.params.set(id,{x:socketX[id-5],y:mm(70.5),centered:true,widget:"PointyKnob8mm"});
    for(let voice=0;voice<4;voice++){
      const x=mm(4.5*5.08-1.5*8+voice*8);
      placements.lights.set(voice,{x,y:mm(38.6),centered:true,widget:"MediumLight<BlueLight>"});
      placements.lights.set(4+voice,{x,y:mm(35.6),centered:true,widget:"MediumLight<BlueLight>"});
      placements.lights.set(8+voice,{x,y:mm(41.6),centered:true,widget:"MediumLight<BlueLight>"});
    }
    for(const [id,x,y] of [[0,socketX[0],mm(105.5)],[1,socketX[0],mm(114.5)],[2,socketX[1],mm(105.5)],[3,socketX[2],mm(105.5)],[4,socketX[1],mm(114.5)],[5,socketX[2],mm(114.5)]])placements.inputs.set(id,{x,y,centered:true,widget:"ThemedPJ301MPort"});
    for(let id=6;id<=9;id++)placements.inputs.set(id,{x:socketX[id-6],y:mm(88.5),centered:true,widget:"ThemedPJ301MPort"});
    placements.outputs.set(0,{x:socketX[3],y:mm(105.5),centered:true,widget:"ThemedPJ301MPort"});
    placements.outputs.set(1,{x:socketX[3],y:mm(114.5),centered:true,widget:"ThemedPJ301MPort"});
  }
  if(target.key==="GP/Rotary"){
    const mm=value=>Number((value*75/25.4).toFixed(3)),fastX=31.8,rampX=11.58,slowX=54.52,switchX=63.02,slowSocketX=19.08,fastSocketX=30.08;
    detected.panelWidth=240;
    placements.panelSize={x:240,y:380};
    for(const [id,x,y,widget] of [
      [0,switchX,19,"VCVLatch"],[1,rampX,29,"PointyKnob12mm"],[2,fastX,19,"FilledKnob14mm"],[3,slowX,29,"FilledKnob14mm"],
      [4,switchX,46,"VCVLatch"],[5,rampX,56,"PointyKnob12mm"],[6,fastX,46,"FilledKnob14mm"],[7,slowX,56,"FilledKnob14mm"],
      [8,rampX,83,"PointyKnob12mm"],[9,fastX,73,"FilledKnob14mm"],[10,slowX,83,"FilledKnob14mm"],
      [11,slowSocketX,94.2,"VCVLatch"],[12,fastSocketX,94.2,"VCVLatch"],[13,73,69.5,"PointyKnob12mm"],[14,73,83.5,"PointyKnob12mm"],
    ])placements.params.set(id,{x:mm(x),y:mm(y),centered:true,widget});
    for(const [id,x,y,widget,paramId] of [
      [0,switchX,19,"MediumLight<BlueLight>",0],
      [1,fastX-2.5,29,"MediumLight<GreenLight>"],[2,fastX+2.5,29,"MediumLight<GreenLight>"],
      [3,fastX-2.5,33,"MediumLight<GreenLight>"],[4,fastX+2.5,33,"MediumLight<GreenLight>"],
      [5,switchX,46,"MediumLight<BlueLight>",4],
      [6,fastX-2.5,56,"MediumLight<GreenLight>"],[7,fastX+2.5,56,"MediumLight<GreenLight>"],
      [8,fastX-2.5,83,"MediumLight<GreenLight>"],[9,fastX+2.5,83,"MediumLight<GreenLight>"],
      [10,slowSocketX,94.2,"MediumLight<YellowLight>",11],[11,fastSocketX,94.2,"MediumLight<RedLight>",12],
      [12,slowSocketX,106,"LargeLight<YellowLight>"],[13,fastSocketX,106,"LargeLight<RedLight>"],
    ])placements.lights.set(id,{x:mm(x),y:mm(y),centered:true,widget,...(paramId===undefined?{}:{paramId})});
    for(const [id,x] of [[0,7.08],[1,slowSocketX],[2,fastSocketX],[3,52.08],[4,41.08]])placements.inputs.set(id,{x:mm(x),y:mm(114.5),centered:true,widget:"ThemedPJ301MPort"});
    placements.outputs.set(0,{x:mm(74.2),y:mm(105.5),centered:true,widget:"ThemedPJ301MPort"});
    placements.outputs.set(1,{x:mm(74.2),y:mm(114.5),centered:true,widget:"ThemedPJ301MPort"});
  }
  if(target.key==="Airwin2Rack/Airwin2Rack"){
    detected.panelWidth=150;placements.panelSize={x:150,y:380};
    for(let id=0;id<10;id++){const y=52.5+27*id;placements.params.set(id,{x:90,y,centered:true,widget:"PixelKnob<20>"});placements.params.set(11+id,{x:110,y,centered:true,widget:"PixelKnob<12, true>"});placements.inputs.set(2+id,{x:132,y,centered:true})}
    placements.inputs.set(0,{x:21,y:329,centered:true});placements.inputs.set(1,{x:54,y:329,centered:true});placements.outputs.set(0,{x:96,y:329,centered:true});placements.outputs.set(1,{x:129,y:329,centered:true});
    placements.params.set(22,{x:8,y:353,width:59,height:6,widget:"AttenSlider"});placements.params.set(23,{x:83,y:353,width:59,height:6,widget:"AttenSlider"});
  }
  if(target.key==="computerscare/computerscare-portaloof"){
    detected.panelWidth=300;placements.panelSize={x:300,y:380};
    const rows=[90,123,156,189,222,255,288,321,354,354],toggleIds=[2,5,8,11,14,17,20,23,26,29],knobIds=[3,6,9,12,15,18,21,24,27,30],attenIds=[4,7,10,13,16,19,22,25,28,31],gateIds=[0,1,2,3,4,5,6,14,15,16],cvIds=[7,8,9,10,11,12,13,17,18,19];
    for(let index=0;index<rows.length;index++){if(index===8)continue;const y=rows[index];placements.params.set(toggleIds[index],{x:2,y:y-14,widget:"SmallIsoButton"});placements.params.set(attenIds[index],{x:98,y:y-9,widget:"SmallKnob"});placements.params.set(knobIds[index],{x:120,y:y-13,widget:index===4?"PortaloofKaleidModeKnob":"SmoothKnob"});placements.inputs.set(gateIds[index],{x:30,y:y-17});placements.inputs.set(cvIds[index],{x:68,y:y-14})}
  }
  if(target.key==="SignalFunctionSet/Meter"){
    const mm=value=>Math.round(value*15/5.08*1000)/1000,subdivisionNames=["Bar","Quarter","Eighth","Sixteenth","Quarter Triplet","Eighth Triplet"];
    detected.panelWidth=270;placements.panelSize={x:270,y:380};
    for(let subdivision=0;subdivision<6;subdivision++){
      paramsById.get(5+subdivision).name=`${subdivisionNames[subdivision]} Swing`;
      runtimeInputs[5+subdivision].name=`${subdivisionNames[subdivision]} Swing CV`;
      runtimeInputs[5+subdivision].kind="cv";
    }
    paramsById.get(1).snap=true;
    placements.params.set(0,{x:mm(10.06),y:mm(50.79),centered:true,widget:"RoundBlackKnob"});
    placements.params.set(1,{x:mm(10.16),y:mm(88.89),centered:true,widget:"RoundBlackKnob"});
    placements.params.set(2,{x:mm(20.32),y:mm(88.89),centered:true,widget:"RoundBlackKnob"});
    placements.params.set(3,{x:mm(10.01),y:mm(121.92),centered:true,widget:"VCVLightLatch<MediumSimpleLight<GreenLight>>"});
    placements.params.set(4,{x:mm(50.79),y:mm(121.92),centered:true,widget:"VCVButton"});
    placements.inputs.set(0,{x:mm(20.22),y:mm(50.79),centered:true});
    placements.inputs.set(4,{x:mm(10.16),y:mm(71.11),centered:true});
    placements.inputs.set(1,{x:mm(10.16),y:mm(101.59),centered:true});
    placements.inputs.set(2,{x:mm(20.32),y:mm(101.59),centered:true});
    placements.inputs.set(3,{x:mm(20.32),y:mm(121.92),centered:true});
    placements.inputs.set(11,{x:mm(60.95),y:mm(121.92),centered:true});
    const rowYs=[60.95,71.11,81.27,91.43,101.59],subdivisionIds=[1,2,3,4,5],gridOutputIds=[7,8,9,10,11];
    for(let row=0;row<5;row++){
      const subdivision=subdivisionIds[row],y=mm(rowYs[row]);
      placements.params.set(5+subdivision,{x:mm(50.79),y,centered:true,widget:"Trimpot"});
      placements.inputs.set(5+subdivision,{x:mm(60.95),y,centered:true});
      placements.outputs.set(subdivision,{x:mm(71.11),y,centered:true});
      placements.outputs.set(gridOutputIds[row],{x:mm(81.27),y,centered:true});
    }
    placements.outputs.set(0,{x:mm(81.27),y:mm(111.75),centered:true});
    placements.outputs.set(6,{x:mm(81.27),y:mm(121.92),centered:true});
    for(const input of runtimeInputs)input.kind=[3,4,11].includes(input.id)?"gate":"cv";
    for(const output of runtimeOutputs)output.kind="gate";
    placements.lights.set(0,{x:mm(10.01),y:mm(121.92),centered:true,widget:"VCVLightLatch<MediumSimpleLight<GreenLight>>",paramId:3});
  }
  if(target.key==="SignalFunctionSet/MetaFugue"){
    const mm=value=>Math.round(value*15/5.08*1000)/1000,voiceYs=[99.63,108.42,117.22],voiceXYs=[45.72,60.96,76.2],letters=["A","B","C"];
    detected.panelWidth=660;placements.panelSize={x:660,y:380};
    paramsById.get(15).snap=true;paramsById.get(15).button=true;
    for(let voice=0;voice<3;voice++){
      const letter=letters[voice],y=mm(voiceYs[voice]),gridY=mm(voiceXYs[voice]);
      placements.params.set(12+voice,{x:mm(50.6),y,centered:true,widget:"WanderSlider"});
      placements.inputs.set(voice,{x:mm(10.16),y,centered:true});
      placements.inputs.set(8+voice,{x:mm(22.86),y,centered:true});
      placements.outputs.set(voice*2,{x:mm(89.6),y,centered:true});
      placements.outputs.set(voice*2+1,{x:mm(79.94),y,centered:true});
      for(let step=0;step<8;step++){const param=paramsById.get(16+voice*8+step);param.name=`Gate ${letter} Step ${step+1}`;param.snap=true}
      const controlNames=["Steps","Range","Sleep","Probability"],controlXs=[111.76,142.24,172.84,203.2],inputXs=[121.92,152.4,182.88,213.36];
      for(let control=0;control<4;control++){
        const paramId=42+voice*4+control,inputId=12+voice*4+control,param=paramsById.get(paramId);
        param.name=`${controlNames[control]} ${letter}`;if(control<3)param.snap=true;
        placements.params.set(paramId,{x:mm(controlXs[control]),y:gridY,centered:true,widget:"RoundSmallBlackKnob"});
        runtimeInputs[inputId].name=`${controlNames[control]} ${letter} CV`;
        placements.inputs.set(inputId,{x:mm(inputXs[control]),y:gridY,centered:true});
      }
      for(let step=0;step<8;step++){
        const outputId=9+voice*8+step;runtimeOutputs[outputId].name=`Gate ${letter} Step ${step+1}`;
        placements.outputs.set(outputId,{x:mm(111.76+step*10.16),y:mm([96.52,106.68,116.83][voice]),centered:true});
        const lightId=49+step*3+voice;placements.lights.set(lightId,{x:mm(172.72+step*5.08),y:mm([17.78,22.86,27.94][voice]),centered:true,widget:"SmallLight<RedLight>"});
      }
    }
  }
  if(target.key==="Skylights/SkAdrift"){
    paramsById.get(0).name="Turbulence";
    runtimeInputs[0].name="Trigger All";
    for(let channel=0;channel<6;channel++){
      const number=channel+1,param=paramsById.get(1+channel);
      param.name=`Bipolar Channel ${number}`;param.snap=true;
      runtimeInputs[1+channel].name=`Trigger Channel ${number}`;
      runtimeInputs[7+channel].name=`CV Channel ${number}`;
      runtimeOutputs[channel].name=`Output Channel ${number}`;
      runtimeOutputs[channel].kind="cv";
    }
  }
  if(target.key==="Skylights/SkTuringV2"){
    const names=["Write","Length","Mode","Bipolar","Scale"];
    for(const [id,name] of names.entries())paramsById.get(id).name=name;
    for(const id of [0,1,3])paramsById.get(id).snap=true;
    runtimeInputs[0].name="Clock";runtimeInputs[1].name="Mode";
    for(const [id,name] of ["Voltage","Expansion","Gate","Pulse"].entries())runtimeOutputs[id].name=name;
  }
  if(target.key==="Skylights/SkTuringPulse"){
    runtimeInputs[0].name="Expansion";runtimeInputs[1].name="Pulse";
    const outputNames=["Gate 1","Gate 2","Gate 3","Gate 4","Gate 5","Gate 6","Gate 7","Gate 1 + 2","Gate 2 + 4","Gate 4 + 7","Gate 1 + 2 + 4 + 7"];
    for(const [id,name] of outputNames.entries())runtimeOutputs[id].name=name;
  }
  if(target.key==="Skylights/SkTuringVolts"){
    for(let id=0;id<5;id++)paramsById.get(id).name=`Voltage ${id+1}`;
    runtimeInputs[0].name="Expansion";runtimeOutputs[0].name="Voltage";
  }
  if(target.key==="Skylights/SkTuringVactrol"||target.key==="Skylights/SkTuringVactrolAnalogue"){
    for(let id=0;id<4;id++)paramsById.get(id).name=`Level ${id+1}`;
    runtimeInputs[0].name="Expansion";
    for(let id=0;id<4;id++)runtimeInputs[1+id].name=`Input ${id+1}`;
    runtimeOutputs[0].name="Left";runtimeOutputs[1].name="Right";
    for(let row=0;row<4;row++)for(let side=0;side<2;side++)placements.lights.set(row*2+side,{x:63+side*15,y:65+row*50,widget:"MediumLight<BlueLight>"});
  }
  if(target.key==="Skylights/SkWhatnoteCV")runtimeInputs[0].name="CV";
  if(target.key==="Skylights/SkVactrolyzer")for(let id=0;id<2;id++){runtimeInputs[id].name=`Input ${id+1}`;runtimeOutputs[id].name=`Response ${id+1}`}
  if(target.key==="SonusModular/Bitter"){
    for(let id=0;id<8;id++){const param=paramsById.get(id);param.name=`Bit ${id+1}`;param.snap=true}
    runtimeInputs[0].kind="audio";runtimeOutputs[0].kind="audio";
  }
  if(target.key==="SonusModular/Ctrl")for(let id=0;id<8;id++){paramsById.get(id).name=`Control ${id+1}`;runtimeOutputs[id].name=`CV ${id+1}`}
  if(target.key==="SonusModular/Mrcheb"){
    for(let id=0;id<9;id++){paramsById.get(id).name=`Harmonic ${id+1} Level`;runtimeOutputs[id].name=`Harmonic ${id+1}`;runtimeOutputs[id].kind="audio"}
    paramsById.get(9).name="Range";paramsById.get(9).snap=true;
    runtimeInputs[0].kind="audio";runtimeOutputs[9].name="Mix";runtimeOutputs[9].kind="audio";
  }
  if(target.key==="Sparkette/Integrator"){
    for(const id of [3,8])paramsById.get(id).snap=true;
    for(const id of [4,9]){const param=paramsById.get(id);param.snap=true;param.button=true}
  }
  if(target.key==="Sparkette/RAM40964"){
    for(const id of [0,1])paramsById.get(id).snap=true;
    for(let plane=0;plane<4;plane++){const param=paramsById.get(13+plane);param.name=`Plane ${plane} write enable`;param.snap=true}
  }
  if(target.key==="Sparkette/Microcosm"){
    const px=value=>Number((value*75/25.4).toFixed(3)),clock=paramsById.get(0);clock.snap=true;delete clock.button;
    for(let cell=0;cell<25;cell++){
      const column=cell%5,row=Math.floor(cell/5),label=`${String.fromCharCode(65+column)}${row+1}`,gridX=11.43+20.32*column,gridY=10.91+20.32*row,param=paramsById.get(5+cell);
      param.name=`Cell ${label} toggle`;param.snap=true;param.button=true;placements.params.set(5+cell,{x:px(gridX+7.62),y:px(gridY+7.62),centered:true,widget:"VCVButton"});
      runtimeInputs[5+cell].name=`Cell ${label} toggle`;runtimeInputs[5+cell].kind="gate";placements.inputs.set(5+cell,{x:px(gridX+7.62),y:px(gridY),centered:true});
      runtimeOutputs[cell].name=`Cell ${label}`;runtimeOutputs[cell].kind="gate";placements.outputs.set(cell,{x:px(gridX),y:px(gridY+7.62),centered:true});
      placements.lights.set(1+cell,{x:px(gridX),y:px(gridY),centered:true,widget:"LargeLight<YellowLight>"});
    }
  }
  if(target.key==="Sparkette/DMAFX"){
    paramsById.get(1).snap=true;
    paramsById.get(7).snap=true;
    for(const input of runtimeInputs)input.kind=input.id===8?"cv":"gate";
  }
  if(target.key==="Sparkette/Accessor"){
    paramsById.get(0).snap=true;
    runtimeInputs[3].kind="gate";
  }
  if(target.key==="CVfunk/Strings"){
    for(const id of [0,1,4])paramsById.get(id).snap=true;
    for(const id of [2,3]){
      const param=paramsById.get(id);
      param.snap=true;
      param.button=true;
    }
    for(let index=0;index<28;index++){
      const row=Math.floor(index/7),column=index%7,param=paramsById.get(5+index);
      const position={x:70+25*column+12*row,y:110+36*row,centered:true,widget:"LEDButton"};
      param.name=`Chord ${index+1}`;
      param.snap=true;
      param.button=true;
      placements.params.set(5+index,position);
      placements.lights.set(7+index,{...position,widget:"SmallLight<RedLight>"});
    }
    for(let string=0;string<6;string++){
      runtimeInputs[5+string].name=`Pitch Bend ${string+1}`;
      runtimeInputs[5+string].kind="cv";
      runtimeOutputs[6+string].kind="gate";
    }
  }
  if(target.key==="CatroModulo/CatroModulo_CM-1"){
    const rowY=[35.5,74.3,113.1,151.9,190.7,229.5,268.2,307],groups=[
      {name:"Shape",paramBase:0,inputBase:0,paramX:29.9,paramYOffset:-15,inputX:3.7,paramWidget:"CM_Knob_small_def_half"},
      {name:"Rate",paramBase:8,inputBase:8,paramX:94.1,paramYOffset:7,inputX:64.8,paramWidget:"CM_Knob_small_def"},
      {name:"Pulse Width",paramBase:16,inputBase:16,paramX:155.1,paramYOffset:-15,inputX:126,paramWidget:"CM_Knob_small_def"},
      {name:"Phase",paramBase:24,inputBase:24,paramX:215.8,paramYOffset:-15,inputX:186.4,paramWidget:"CM_Knob_small_def"},
    ];
    for(let channel=0;channel<8;channel++){
      for(const group of groups){
        paramsById.get(group.paramBase+channel).name=`LFO ${channel+1} ${group.name}`;
        runtimeInputs[group.inputBase+channel].name=`LFO ${channel+1} ${group.name} CV`;
        placements.params.set(group.paramBase+channel,{x:group.paramX,y:rowY[channel]+group.paramYOffset,widget:group.paramWidget});
        placements.inputs.set(group.inputBase+channel,{x:group.inputX,y:rowY[channel]});
      }
      runtimeOutputs[channel].name=`LFO ${channel+1}`;
      placements.outputs.set(channel,{x:249.2,y:rowY[channel]});
    }
    for(const id of [32,35]){
      const param=paramsById.get(id);
      param.snap=true;
      param.button=true;
    }
    for(const id of [33,34])paramsById.get(id).snap=true;
    paramsById.get(32).name="Reset";
    paramsById.get(33).name="Offset +5 V";
    paramsById.get(34).name="BPM Rate Mode";
    paramsById.get(35).name="Pause";
    runtimeInputs[32].name="Reset";
    runtimeInputs[32].kind="gate";
    runtimeInputs[33].name="BPM";
    runtimeInputs[34].name="Pause";
    runtimeInputs[34].kind="gate";
  }
  if(target.key==="CatroModulo/CatroModulo_CM-3"){
    const recordButtons=[[178.8,89],[212.4,119.4],[242.7,152.9],[212.4,186.4],[178.8,216.7],[145.3,186.4],[115,152.9],[145.3,119.4]],recordInputs=[[185.5,127.3],[196.5,148.5],[217.4,159.5],[196.5,170.5],[185.5,191.8],[174.5,170.5],[153.2,159.5],[174.5,148.5]],eyes=[[54.9,94.4],[32.7,146.1],[54.9,197.9],[84.5,249.6],[290.7,94.4],[312.9,146.1],[290.7,197.9],[261.1,249.6]],eyeInputs=[[104.7,117],[84.1,158.8],[104.7,200.6],[130.7,242.9],[266,117],[287.1,158.8],[266,200.6],[240.3,242.9]],eyeOutputs=[[30.2,96.6],[6.4,158.3],[30.2,220],[63.6,280.9],[340,96.6],[363.5,158.3],[340,220],[304.5,280.9]];
    for(let slot=0;slot<8;slot++){
      const record=paramsById.get(slot);
      record.name=`Record Slot ${slot+1}`;
      record.snap=true;
      record.button=true;
      paramsById.get(8+slot).name=`Value ${slot+1}`;
      runtimeInputs[slot].name=`Record Slot ${slot+1}`;
      runtimeInputs[slot].kind="gate";
      runtimeInputs[8+slot].name=`Value ${slot+1} CV`;
      runtimeOutputs[slot].name=`Value ${slot+1}`;
      placements.params.set(slot,{x:recordButtons[slot][0],y:recordButtons[slot][1],widget:"CM_Recbutton"});
      placements.params.set(8+slot,{x:eyes[slot][0],y:eyes[slot][1],widget:"CM_Knob_bigeye"});
      placements.inputs.set(slot,{x:recordInputs[slot][0],y:recordInputs[slot][1]});
      placements.inputs.set(8+slot,{x:eyeInputs[slot][0],y:eyeInputs[slot][1]});
      placements.outputs.set(slot,{x:eyeOutputs[slot][0],y:eyeOutputs[slot][1]});
    }
    const names=["Pattern","Morph","Pattern Length","Randomize","Scan / Blend","Slot Select","Unused Q","Sequencer Enabled","Reset","Step"];
    for(let offset=0;offset<names.length;offset++)paramsById.get(16+offset).name=names[offset];
    for(const id of [16,18,20,23])paramsById.get(id).snap=true;
    for(const id of [19,24,25]){
      const param=paramsById.get(id);
      param.snap=true;
      param.button=true;
    }
    const inputNames=["Pattern CV","Step","Morph CV","Reset","Pattern Length CV","Slot Select CV","BPM","Randomize"];
    for(let offset=0;offset<inputNames.length;offset++)runtimeInputs[16+offset].name=inputNames[offset];
    for(const id of [17,19,23])runtimeInputs[id].kind="gate";
  }
  if(target.key==="CatroModulo/CatroModulo_CM-4"){
    paramsById.get(0).name="Tempo";
    paramsById.get(1).name="Reset";
    paramsById.get(1).snap=true;
    paramsById.get(1).button=true;
    paramsById.get(2).name="BPM Quantization";
    paramsById.get(2).snap=true;
    runtimeInputs[0].name="External Clock";
    runtimeInputs[0].kind="gate";
    runtimeInputs[1].name="BPM CV";
    runtimeInputs[2].name="Reset";
    runtimeInputs[2].kind="gate";
    const outputNames=["BPM","BPM + CV","BPM / 2","BPM × 2","Clock / 2","Clock","Clock × 2","Reset"];
    for(const [id,name] of outputNames.entries()){
      runtimeOutputs[id].name=name;
      if(id>=4)runtimeOutputs[id].kind="gate";
    }
  }
  if(target.key==="CatroModulo/CatroModulo_CM-5"){
    paramsById.get(0).name="Reset";
    paramsById.get(0).snap=true;
    paramsById.get(0).button=true;
    runtimeInputs[0].name="BPM";
    runtimeInputs[1].name="BPM Modulation";
    runtimeInputs[2].name="Reset";
    runtimeInputs[2].kind="gate";
    const multiples=[1,2,3,4,5,7,9];
    for(let index=0;index<multiples.length;index++){
      runtimeOutputs[index].name=`Clock × ${multiples[index]}`;
      runtimeOutputs[index].kind="gate";
      runtimeOutputs[7+index].name=`BPM × ${multiples[index]}`;
    }
  }
  if(target.key==="CatroModulo/CatroModulo_CM-7"){
    paramsById.get(0).name="Reset";
    paramsById.get(0).snap=true;
    paramsById.get(0).button=true;
    runtimeInputs[0].name="BPM";
    runtimeInputs[1].name="BPM Subtraction";
    runtimeInputs[2].name="Reset";
    runtimeInputs[2].kind="gate";
    const divisors=[1,2,3,4,5,7,9];
    for(let index=0;index<divisors.length;index++){
      runtimeOutputs[index].name=`Clock ÷ ${divisors[index]}`;
      runtimeOutputs[index].kind="gate";
      runtimeOutputs[7+index].name=`BPM ÷ ${divisors[index]}`;
    }
  }
  if(target.key==="CatroModulo/CatroModulo_CM-9"){
    paramsById.get(0).name="Selector";
    paramsById.get(0).snap=true;
    runtimeInputs[0].name="Selector CV";
    runtimeInputs[1].name="Clock";
    runtimeInputs[1].kind="gate";
    runtimeInputs[2].name="Reset";
    runtimeInputs[2].kind="gate";
    runtimeInputs[3].name="Common Input";
    for(let index=0;index<8;index++){
      runtimeInputs[4+index].name=`Input ${index+1}`;
      runtimeOutputs[index].name=`Output ${index+1}`;
    }
    runtimeOutputs[8].name="Selected Output";
  }
  if(target.key==="CavianSequencer/CavianSequencer"){
    const mm=value=>Math.round(value*75/25.4*100)/100;
    placements.params.set(1,{x:mm(110),y:mm(11),centered:true,widget:"RunStopDisplay"});
    placements.params.set(8,{x:mm(11),y:mm(121),centered:true,widget:"VerticalViewDisplay"});
    paramsById.get(1).name="Run / Stop";
    paramsById.get(8).name="View Mode";
    for(let cell=0;cell<64;cell++){
      const row=Math.floor(cell/8),column=cell%8,param=paramsById.get(9+cell);
      param.name=`Grid ${row+1}:${column+1}`;
      param.snap=true;
      param.button=true;
      placements.params.set(9+cell,{x:mm(10.5+column*11.5),y:mm(27.5+row*11.5),centered:true,widget:"CavianButton"});
    }
    for(let channel=0;channel<8;channel++){
      const mute=paramsById.get(73+channel);
      mute.name=`Channel ${channel+1} Mute`;
      mute.snap=true;
      mute.button=true;
    }
    runtimeInputs[0].kind="gate";
    runtimeInputs[1].kind="gate";
    for(const output of runtimeOutputs)output.kind="gate";
  }
  if(target.key==="Cella/CognitiveShift"){
    for(let output=3;output<=10;output++)runtimeOutputs[output].kind="gate";
  }
  if(target.key==="Cella/FrequencyAnalyzer"){
    for(const param of paramsById.values())param.hidden=true;
    placements.inputs.set(0,{x:23.417,y:364,centered:true,widget:"ThemedPJ301MPort"});
    placements.inputs.set(1,{x:64.25,y:364,centered:true,widget:"ThemedPJ301MPort"});
  }
  if(target.key==="InfrasonicAudio/WarpCore"){
    const stateDefaults={oversampling:4,pd_type_1:0,pd_type_2:1,pm_ratio:3,alt_out_type:0};
    for(const state of detected.stateKeys)
      if(Object.hasOwn(stateDefaults,state.key))state.default=stateDefaults[state.key];
    if(!detected.stateKeys.some(item=>item.key==="ratioMode"))
      detected.stateKeys.push({key:"ratioMode",type:"boolean",name:"Edit Internal PM Ratio",default:0,contextOnly:true});
    Object.assign(paramsById.get(1),{visibleWhenState:{key:"ratioMode",equals:0}});
    Object.assign(paramsById.get(10),{visibleWhenState:{key:"ratioMode",equals:1}});
  }
  if(target.key==="Interrobang/ScribbleStrip")
    detected.stateKeys=detected.stateKeys.map(item=>item.key==="writeTextFromTop"?{...item,name:"Flip text top-to-bottom",default:0,contextOnly:true}:item);
  if(target.key==="Chinenual-VCV/MIDIRecorderCC"){
    const mm=value=>Number((value*75/25.4).toFixed(3)),style=paramsById.get(0);
    if(style){style.name="Text Style";style.snap=true;style.hidden=true}
    for(let track=0;track<10;track++)for(let column=0;column<5;column++){
      const id=track*5+column,input=runtimeInputs[id];
      if(input)input.name=`Track ${track+1} CC#${column+1}`;
      placements.inputs.set(id,{x:mm(10+column*10),y:mm(20+track*10.5),centered:true,widget:"ThemedPJ301MPort"});
    }
  }
  if(target.key==="Chinenual-VCV/MIDIRecorder"){
    const mm=value=>Number((value*75/25.4).toFixed(3)),
      run=paramsById.get(0),style=paramsById.get(1),
      columns=["Note pitch (V/oct)","Note gate","Note velocity","Aftertouch","Pitchbend","Modwheel"];
    if(run)Object.assign(run,{name:"Start / Stop",snap:true,button:false});
    if(style)Object.assign(style,{name:"Text Style",min:0,max:4,default:0,snap:true,contextOnly:true,values:["Red","Yellow","Green","Aqua","White"]});
    placements.params.set(0,{x:mm(9),y:mm(36),centered:true,widget:"RecButton"});
    placements.inputs.set(0,{x:mm(9),y:mm(114.5),centered:true,widget:"PJ301MPort"});
    placements.inputs.set(1,{x:mm(9),y:mm(51.5),centered:true,widget:"PJ301MPort"});
    placements.outputs.set(0,{x:mm(9),y:mm(72.5),centered:true,widget:"PJ301MPort"});
    if(runtimeInputs[0])Object.assign(runtimeInputs[0],{name:"Tempo / BPM",kind:"cv"});
    if(runtimeInputs[1])Object.assign(runtimeInputs[1],{name:"Start / Stop Gate",kind:"gate"});
    if(runtimeOutputs[0])Object.assign(runtimeOutputs[0],{name:"Is Actively Recording Gate",kind:"gate"});
    for(let track=0;track<10;track++)for(let column=0;column<6;column++){
      const id=2+track*6+column,input=runtimeInputs[id];
      if(input)Object.assign(input,{name:`Track ${track+1} ${columns[column]}`,kind:column===1?"gate":"cv"});
      placements.inputs.set(id,{x:mm(20+column*10),y:mm(20+track*10.5),centered:true,widget:"PJ301MPort"});
    }
  }
  if(target.key==="Chinenual-VCV/DrumMap"){
    const mm=value=>Number((value*75/25.4).toFixed(3));
    for(let index=0;index<12;index++){
      const row=Math.floor(index/2),column=index%2,gate=runtimeInputs[index],velocity=runtimeInputs[12+index],y=mm(20+row*16);
      if(gate){gate.name=`Gate ${index}`;gate.kind="gate"}
      if(velocity){velocity.name=`Velocity ${index}`;velocity.kind="cv"}
      placements.inputs.set(index,{x:mm(6+column*20),y,centered:true,widget:"PJ301MPort"});
      placements.inputs.set(12+index,{x:mm(14.4+column*20),y,centered:true,widget:"PJ301MPort"});
    }
    const outputPositions=[[6.1,116],[20.2,116],[34.3,116]];
    for(let id=0;id<outputPositions.length;id++)placements.outputs.set(id,{x:mm(outputPositions[id][0]),y:mm(outputPositions[id][1]),centered:true,widget:"PJ301MPort"});
  }
  if(target.key==="Chinenual-VCV/Harp"){
    const noteRange=paramsById.get(0),cvRange=paramsById.get(1),accidental=paramsById.get(2),style=paramsById.get(3);
    if(noteRange)Object.assign(noteRange,{max:48,default:48,contextOnly:true,values:Array.from({length:47},(_,index)=>String(index+2))});
    if(cvRange)Object.assign(cvRange,{snap:true,contextOnly:true,values:["-10 to 10","0 to 10","-5 to 5","0 to 5","-3 to 3","0 to 3","-1 to 1","0 to 1"]});
    if(accidental)Object.assign(accidental,{snap:true,contextOnly:true,values:["Sharp","Flat"]});
    if(style)Object.assign(style,{name:"Text Style",min:0,max:4,default:0,snap:true,contextOnly:true,values:["Red","Yellow","Green","Aqua","White"]});
  }
  if(target.key==="Chinenual-VCV/Tint"){
    const mode=paramsById.get(0),octave=paramsById.get(1);
    if(mode)mode.values=["Up","Down","Up/Down","Up+1","Down-1","Up+1/Down-1","Quantize"];
    if(octave)octave.values=["-3","-2","-1","0","+1","+2","+3"];
    for(const output of runtimeOutputs)output.kind="cv";
  }
  if(target.key==="Chinenual-VCV/NoteMeter"){
    const accidental=paramsById.get(0),mode=paramsById.get(1),decimals=paramsById.get(2),style=paramsById.get(3),mm=value=>Number((value*75/25.4).toFixed(3));
    if(accidental)Object.assign(accidental,{snap:true,contextOnly:true,values:["Sharp","Flat"]});
    if(mode)Object.assign(mode,{snap:true,contextOnly:true,values:["Note Name","Voltage (V)","V/Oct as Frequency (Hz)"]});
    if(decimals)Object.assign(decimals,{snap:true,contextOnly:true,values:Array.from({length:9},(_,index)=>String(index))});
    if(style)Object.assign(style,{name:"Text Style",min:0,max:4,default:0,snap:true,contextOnly:true,values:["Red","Yellow","Green","Aqua","White"]});
    for(let id=0;id<16;id++){const input=runtimeInputs[id];if(input){input.name=`Pitch ${id+1}`;input.kind="cv"}placements.inputs.set(id,{x:mm(6),y:mm(12+id*7.125),centered:true,widget:"PJ301MPort"})}
  }
  if(target.key==="HetrickCVGPL/PhasorWavetable"){
    placements.params.set(0,{x:13.5,y:162,widget:"HCVThemedRogan"});
    placements.params.set(1,{x:20,y:220,widget:"Trimpot"});
    placements.params.set(2,{x:63,y:253,widget:"CKSS"});
    placements.params.set(3,{x:63,y:181,widget:"CKSS"});
    placements.inputs.set(1,{x:17,y:270,widget:"ThemedPJ301MPort"});
    const offset=paramsById.get(2),mode=paramsById.get(3);
    if(offset)offset.values=["Bipolar","Unipolar"];
    if(mode)mode.values=["LFO (no antialiasing)","VCO (antialiased)"];
  }
  if(target.key==="JW-Modules/BouncyBalls"){
    const colors=["Orange","Yellow","Purple","Blue"],portWidgets=colors.map(color=>`${color}_TinyPJ301MPort`);
    for(let group=0;group<5;group++)for(let color=0;color<4;color++){
      const id=group*4+color,input=runtimeInputs[id];
      input.name=`${["Reset","Trigger","Velocity X","Velocity Y","Multiplier"][group]} ${colors[color]}`;
      input.kind=group<2?"gate":"cv";
      placements.inputs.set(id,{x:40+color*55,y:13+group*34,widget:portWidgets[color]});
    }
    for(let color=0;color<4;color++){
      for(const [group,name,kind] of [[0,"X","cv"],[1,"Y","cv"],[2,"North","gate"],[3,"East","gate"],[4,"South","gate"],[5,"West","gate"],[6,"Edge","gate"],[7,"Paddle","gate"]]){
        const id=group*4+color,output=runtimeOutputs[id];
        output.name=`${name} ${colors[color]}`;
        output.kind=kind;
        placements.outputs.set(id,{x:100+color*25,y:179+group*25,widget:portWidgets[color]});
      }
      placements.params.set(color,{x:57+color*55,y:8,widget:"SmallButton"});
      placements.params.set(4+color,{x:57+color*55,y:42,widget:"SmallButton"});
      placements.params.set(8+color,{x:57+color*55,y:76,widget:"SmallWhiteKnob"});
      placements.params.set(12+color,{x:57+color*55,y:110,widget:"SmallWhiteKnob"});
      placements.params.set(16+color,{x:57+color*55,y:144,widget:"SmallWhiteKnob"});
    }
    Object.assign(runtimeInputs[20],{name:"Paddle X",kind:"cv"});
    Object.assign(runtimeInputs[21],{name:"Paddle Y",kind:"cv"});
    placements.inputs.set(20,{x:38,y:220,widget:"White_TinyPJ301MPort"});
    placements.inputs.set(21,{x:38,y:245,widget:"White_TinyPJ301MPort"});
    const stateDefaults={paddleX:174,paddleY:346,paddleVisible:1,gatePulseLenSec:.005},stateNames={paddleX:"Paddle X",paddleY:"Paddle Y",paddleVisible:"Show Paddle",gatePulseLenSec:"Gate Pulse Length"};
    detected.stateKeys=detected.stateKeys.map(item=>Object.hasOwn(stateDefaults,item.key)?{...item,name:stateNames[item.key],default:stateDefaults[item.key]}:item);
  }
  if(target.key==="JW-Modules/FullScope"){
    const inputLayout=[[0,5,5],[1,5,25],[3,5,45],[5,5,65],[4,5,85]];
    for(const [id,x,y] of inputLayout)placements.inputs.set(id,{x,y,widget:"TinyPJ301MPort"});
    const paramLayout=[[1,5,105],[3,5,125],[0,5,145],[2,5,165],[8,5,185],[4,5,205]];
    for(const [id,x,y] of paramLayout)placements.params.set(id,{x,y,widget:"JwTinyKnob"});
    detected.stateKeys=detected.stateKeys.map(item=>{
      if(item.key==="lissajous")return{...item,type:"boolean",name:"Lissajous Mode",default:1,contextOnly:true};
      if(item.key==="external")return{...item,type:"boolean",name:"External Trigger",default:0,contextOnly:true};
      if(item.key==="width")return{...item,name:"Module Width",default:255,contextOnly:true};
      return item;
    });
  }
  if(target.key==="JW-Modules/XYPad"){
    for(const input of runtimeInputs)if(placements.inputs.has(input.id))placements.inputs.set(input.id,{...placements.inputs.get(input.id),widget:"TinyPJ301MPort"});
    for(const output of runtimeOutputs)if(placements.outputs.has(output.id))placements.outputs.set(output.id,{...placements.outputs.get(output.id),widget:"TinyPJ301MPort"});
    const defaults={lastRandomShape:7,curPlayMode:0,autoPlayOn:0,xPos:178,yPos:150},
      names={lastRandomShape:"Random Shape",curPlayMode:"Play Mode",autoPlayOn:"Auto Play",xPos:"X Position",yPos:"Y Position"},
      values={lastRandomShape:["Sine","Square","Ramp","Line","Noise","Sine Mod","Spiral","Steps"],curPlayMode:["Forward Loop","Backward Loop","Forward One Shot","Backward One Shot","Forward / Backward","Backward / Forward"]};
    detected.stateKeys=detected.stateKeys.map(item=>Object.hasOwn(defaults,item.key)?{...item,name:names[item.key],default:defaults[item.key],...(values[item.key]?{values:values[item.key]}:{})}:item);
  }
  if(target.key==="LomasModules/GateSequencer"){
    const mm=value=>Number((value*75/25.4).toFixed(3)),
      pages=[[5.08,23.09],[15.24,23.09],[25.4,23.09],[35.56,23.09]],
      grid=Array.from({length:16},(_,index)=>[
        [5.08,15.24,25.4,35.56][index%4],
        [38.148,48.187,58.226,68.266][Math.floor(index/4)],
      ]),
      patterns=[[5.08,83.324],[15.24,83.324],[25.4,83.324],[35.56,83.324]];
    detected.panelWidth=120;
    placements.panelSize={x:120,y:380};
    for(const [index,[x,y]] of pages.entries()){
      const id=index;
      Object.assign(paramsById.get(id),{name:`Page ${index+1}`,snap:true,button:true});
      placements.params.set(id,{x:mm(x),y:mm(y),centered:true,widget:"RubberButton"});
      placements.lights.set(48+index*3,{x:mm(x),y:mm(y),centered:true,widget:"RubberButtonLed<RedGreenBlueLight>"});
    }
    for(const [index,[x,y]] of grid.entries()){
      const id=8+index;
      Object.assign(paramsById.get(id),{name:`Step ${index+1}`,snap:true,button:true});
      placements.params.set(id,{x:mm(x),y:mm(y),centered:true,widget:"RubberButton"});
      placements.lights.set(index*3,{x:mm(x),y:mm(y),centered:true,widget:"RubberButtonLed<RedGreenBlueLight>"});
    }
    for(const [index,[x,y]] of patterns.entries()){
      const id=24+index;
      Object.assign(paramsById.get(id),{name:`Pattern ${index+1}`,snap:true,button:true});
      placements.params.set(id,{x:mm(x),y:mm(y),centered:true,widget:"RubberButton"});
      placements.lights.set(60+index*3,{x:mm(x),y:mm(y),centered:true,widget:"RubberButtonLed<RedGreenBlueLight>"});
    }
    placements.inputs.set(0,{x:mm(7.62),y:mm(113.441),centered:true,widget:"PJ301MPort"});
    placements.inputs.set(1,{x:mm(20.32),y:mm(113.441),centered:true,widget:"PJ301MPort"});
    placements.outputs.set(0,{x:mm(33.02),y:mm(113.441),centered:true,widget:"PJ301MPort"});
  }
  if(target.key==="Minilab3/MiniLab"){
    detected.panelWidth=137;
    placements.panelSize={x:137,y:380};
    const columnX=[24.104,53.035,81.966,110.896],outputPositions=new Map([
      [0,[24.104,160.214]],
      [2,[67.5,160.361]],
      [3,[110.896,160.068]],
      ...columnX.map((x,index)=>[13+index,[x,223.135]]),
      ...columnX.map((x,index)=>[5+index,[x,286.568]]),
      ...columnX.map((x,index)=>[9+index,[x,327.484]]),
    ]);
    for(const [id,[x,y]] of outputPositions)placements.outputs.set(id,{x:Number(x.toFixed(3)),y,centered:true,widget:"OutputPort"});
    placements.lights.set(0,{x:18.698,y:16.649,centered:true,widget:"SmallLight<GreenLight>"});
    if(runtimeInputs[0])runtimeInputs[0].hidden=true;
    for(let id=0;id<runtimeOutputs.length;id++){
      runtimeOutputs[id].kind=id===0?"gate":"cv";
      runtimeOutputs[id].name=id===0?"Gate":id===1?"Velocity":id===2?"Pitch Bend":id===3?"Modulation":id===4?"Aftertouch":id<13?`Knob ${id-4}`:`Slider ${id-12}`;
    }
  }
  if(target.key==="Minilab3/MiniPad"){
    detected.panelWidth=92;
    placements.panelSize={x:92,y:380};
    const outputPositions=new Map([
      [0,[45.57,72.731]],
      [1,[66.449,125.579]],
      [2,[23.278,179.42]],
      [3,[66.449,179.567]],
      [4,[23.278,125.433]],
      [5,[23.335,237.247]],
      [6,[66.449,237.247]],
      [7,[23.335,273.382]],
      [8,[66.449,273.382]],
      [9,[23.335,309.517]],
      [10,[66.449,309.517]],
      [11,[23.335,345.652]],
      [12,[66.449,345.652]],
    ]);
    for(const [id,[x,y]] of outputPositions)placements.outputs.set(id,{x,y,centered:true,widget:"OutputPort"});
    placements.lights.set(0,{x:17.224,y:16.973,centered:true,widget:"SmallLight<GreenLight>"});
    if(runtimeInputs[0])runtimeInputs[0].hidden=true;
    for(let id=0;id<runtimeOutputs.length;id++){
      runtimeOutputs[id].kind=id===0?"gate":"cv";
      runtimeOutputs[id].name=id===0?"Gate":id===1?"Velocity":id===2?"Pitch Bend":id===3?"Modulation":id===4?"Aftertouch":id<13?`Knob ${id-4}`:`Slider ${id-12}`;
    }
  }
  const contextOnlyParams=placements.params.size===0&&runtimeInputs.length===0&&runtimeOutputs.length===0&&/\bappendContextMenu\s*\(/.test(detected.widgetSource??"");for(const param of paramsById.values()){if(placements.params.has(param.id)){const {snap,...position}=placements.params.get(param.id);param.position=position;if(snap||/(?:Snap|CKSS|NKK|Switch|Toggle)/i.test(param.position.widget??""))param.snap=true;if(/(?:^|<)(?:LEDButton|LEDBezel|LightBezel|VCVLightBezel|VCVButton|VCVLightButton|TL1105|BefacoPush|IM(?:Big)?PushButton)(?:>|$)|\bCKD6(?:_|$)|\b\w*Button(?:<|$)/i.test(param.position.widget??""))Object.assign(param,{snap:true,button:true})}else if(placements.params.size||contextOnlyParams)param.hidden=true}for(const input of runtimeInputs){if(placements.inputs.has(input.id))input.position=placements.inputs.get(input.id);else if(placements.inputs.size)input.hidden=true}for(const output of runtimeOutputs){if(placements.outputs.has(output.id))output.position=placements.outputs.get(output.id);else if(placements.outputs.size)output.hidden=true}
  if(target.key==="LyraeModules/Sulafat"){
    Object.assign(paramsById.get(0),{snap:true,values:["Bypass","Fold","Quant Fold","Tangent","Half Quant","Ring","S&H-Ish","Wut?"]});
    for(const id of [1,2,3,4]){const param=paramsById.get(id);delete param.hidden;param.contextOnly=true}
  }
  if(target.key==="LyraeModules/Vega"){
    for(const id of [22,25])paramsById.get(id).position.zIndex=2;
    for(const id of [35,36]){const param=paramsById.get(id);delete param.hidden;param.contextOnly=true;param.snap=true}
    for(const id of [7,8,9,10])paramsById.get(id).resetFrom={paramId:id-1,scale:1,offset:0};
    paramsById.get(20).resetFrom={paramId:13,scale:.5,offset:.5};
  }
  if(target.key==="LyraeModules/Sheliak")for(const output of runtimeOutputs)output.kind="gate";
  if(target.key==="MADZINE/NIGOQ"){
    Object.assign(paramsById.get(17).position,{width:66,height:38.5,zIndex:5});
    for(const output of runtimeOutputs)output.kind="audio";
  }
  if(target.key==="MADZINE/WeiiiDocumenta"){
    for(const id of [9,10])runtimeInputs[id].kind="audio";
    for(const id of [0,1,3,4])runtimeOutputs[id].kind="audio";
  }
  if(target.key==="MADZINE/UniversalRhythm"){
    for(const id of [0,2,5,7,10,12,15,17])paramsById.get(id).snap=true;
    runtimeInputs[2].kind="gate";
  }
  if(target.key==="MADZINE/UniRhythm"){
    for(const id of [0,2,5,7,10,12,15,17])paramsById.get(id).snap=true;
    runtimeInputs[2].kind="gate";
    for(const [id,x] of [[35,112.5],[36,207.5],[37,302.5],[38,394.36]]){
      const param=paramsById.get(id);delete param.hidden;
      param.position={x,y:355.5,centered:true,widget:"madzine::widgets::StandardBlackKnob"};
    }
  }
  if(target.key==="MADZINE/SongMode")runtimeOutputs[0].kind="audio";
  if(target.key==="OPC-OctobIR/OPC-OctobIR"){
    const mm=value=>Number((value*75/25.4).toFixed(3));
    Object.assign(paramsById.get(2),{hidden:false,button:false,snap:true,position:{x:mm(48),y:mm(7),width:mm(20),height:mm(6),widget:"OpcToggleButton"}});
    Object.assign(paramsById.get(3),{hidden:false,button:false,snap:true,position:{x:mm(149),y:mm(7),width:mm(20),height:mm(6),widget:"OpcToggleButton"}});
    Object.assign(paramsById.get(6),{button:false,snap:true,position:{x:mm(6),y:mm(27.5),width:mm(56),height:mm(7),widget:"OpcToggleButton"}});
    Object.assign(paramsById.get(7),{button:false,snap:true,position:{x:mm(142),y:mm(27.5),width:mm(56),height:mm(7),widget:"OpcToggleButton"}});
    Object.assign(paramsById.get(11),{button:false,snap:true,position:{x:mm(140),y:mm(93),width:mm(24),height:mm(8),widget:"OpcDetectModeButton"}});
  }
  if(target.key==="MADZINE/Launchpad"){
    for(const id of [11,12,13,14,15,16,17,18])runtimeInputs[id].kind="audio";
    for(const output of runtimeOutputs)output.kind="audio";
  }
  if(target.key==="MADZINE/theKICK")runtimeOutputs[0].kind="audio";
  if(target.key==="MosquitoLabs/PhaseCzar")for(const input of runtimeInputs)input.kind="cv";
  if(target.key==="HarmonicAnomalies/HexNut")delete paramsById.get(4).position;
  if(target.key==="IggyLabsModules/more-ideas")for(let id=0;id<6;id++)paramsById.get(id).snap=true;
  if(target.key==="ImpromptuModular/Phrase-Seq-16"){
    Object.assign(paramsById.get(4),{min:-1,max:1,unbounded:true});
    placements.params.set(4,{...placements.params.get(4),widget:"IMBigKnobInf"});
    paramsById.get(4).position=placements.params.get(4);
  }
  if(target.key==="ImpromptuModular/Phrase-Seq-32"){
    Object.assign(paramsById.get(4),{min:-1,max:1,unbounded:true});
    placements.params.set(4,{...placements.params.get(4),widget:"IMBigKnobInf"});
    paramsById.get(4).position=placements.params.get(4);
  }
  if(target.key==="Minilab3/MiniLog"){
    detected.panelWidth=122;
    placements.panelSize={x:122,y:380};
    placements.lights.set(0,{x:107.403,y:16.715,centered:true,widget:"SmallLight<GreenLight>"});
  }
  if(target.key==="ModularMooch/Wolfram")
    Object.assign(paramsById.get(0),{min:-1,max:1,unbounded:true});
  if(process.env.RACK_WEB_DEBUG_WIDGET)process.stderr.write(`${JSON.stringify({source:detected.widgetSource,constants:{...(detected.widgetConstants??{}),...constants},placements:Object.fromEntries(["params","inputs","outputs","lights"].map(group=>[group,[...placements[group]]]))},null,2)}\n`);
  const runtimeStateKeys=detected.stateKeys.map(item=>runtimeStateKey(target,item)),widgetSource=detected.widgetSource??"",multiMeterVisual=/\bMulti_MeterDisplay\b/.test(widgetSource)&&runtimeInputs.length>=3?[{kind:"multi-meter",inputs:[runtimeInputs[0].id,runtimeInputs[1].id,runtimeInputs[2].id],modeParam:0,channelsParam:1,x:29.173,y:39.862,width:271.654,height:248.031}]:undefined,spectrumRect=widgetDisplayRect(widgetSource,"SpectrumAnalyzerDisplay",constants),spectrumVisual=spectrumRect&&runtimeInputs.length?[{kind:"spectrum-analyzer",inputs:runtimeInputs.slice(0,4).map(input=>input.id),...spectrumRect}]:undefined,cellaFrequencyVisual=target.key==="Cella/FrequencyAnalyzer"?[{kind:"cella-frequency-analyzer",inputs:[0,1],x:0,y:26,width:496,height:320}]:undefined,spectrogramRect=widgetDisplayRect(widgetSource,"SpectralImageDisplay",constants),spectrogramVisual=spectrogramRect&&runtimeInputs.length?[{kind:"spectrogram",inputs:[runtimeInputs[0].id],...spectrogramRect}]:undefined,whatNoteVisual=target.key==="Skylights/SkWhatnoteCV"&&runtimeInputs.length?[{kind:"cv-note",inputs:[runtimeInputs[0].id],x:25,y:154,width:85,height:60}]:undefined,noteMeterVisual=target.key==="Chinenual-VCV/NoteMeter"?[{kind:"note-meter",inputs:Array.from({length:16},(_,index)=>index),accidentalParam:0,modeParam:1,decimalsParam:2,styleParam:3,x:32.48,y:19.193,width:78,height:337,rowHeight:21.038}]:undefined,bpmVisual=target.key==="Chinenual-VCV/MIDIRecorder"?[{kind:"bpm-display",inputs:[0],styleParam:1,x:38.386,y:279.035,width:30,height:10}]:undefined,paramNumericVisual=target.key==="GlueTheGiant/BusRoute"?[23.64,52.68,81.68].map((centerY,param)=>{const mm=value=>value*75/25.4,width=mm(6.519),height=mm(4);return {kind:"param-numeric-display",param,digits:3,x:mm(15.25)-width/2,y:mm(centerY)-height/2,width,height}}):undefined,noteEchoVisual=target.key==="ImpromptuModular/NoteEcho"?[0,1,2,3].map(tap=>({kind:"note-echo-display",tap,tapParam:tap,semiParam:4+tap,cv2Param:8+tap,probabilityParam:12+tap,randomSemiParam:22+tap,cv2ModeParam:17,polyParam:16,x:92.185,y:[209.646,162.402,115.157,67.913][tap],width:52,height:24})):undefined,scribbleVisual=target.key==="Interrobang/ScribbleStrip"?[{kind:"scribble-strip",dataKey:"labelText",defaultText:"Rt-click to edit",orientationState:0,x:7,y:8,width:31,height:325}]:undefined,lightMatrix=widgetLightMatrix(widgetSource,constants),lightMatrixVisual=lightMatrix?[lightMatrix]:undefined,scopeVisual=!multiMeterVisual&&!spectrumVisual&&!cellaFrequencyVisual&&!spectrogramVisual&&!whatNoteVisual&&!noteMeterVisual&&!bpmVisual&&!paramNumericVisual&&!noteEchoVisual&&!scribbleVisual&&!lightMatrixVisual&&/\bScopeDisplay\b/.test(widgetSource)&&runtimeInputs.length>=2?[{kind:"scope",inputs:[runtimeInputs[0].id,runtimeInputs[1].id],x:0,y:38.5,width:placements.panelSize?.x??detected.panelWidth??180,height:165}]:undefined,visuals=multiMeterVisual??spectrumVisual??cellaFrequencyVisual??spectrogramVisual??whatNoteVisual??noteMeterVisual??bpmVisual??paramNumericVisual??noteEchoVisual??scribbleVisual??lightMatrixVisual??scopeVisual,runtime={...(detected.browserAsset?{asset:{type:detected.browserAsset.type,maxSamples:detected.browserAsset.maxSamples,maxSeconds:detected.browserAsset.maxSeconds,channels:detected.browserAsset.channels,...(detected.browserAsset.slots?{slots:detected.browserAsset.slots}:{}),...(detected.browserAsset.url?{url:true}:{})}}:{}),...(detected.features.includes("expanders")?{expanderMode:detected.expander?.transport==="message-buffer"?"message-buffer":detected.expander?"host-snapshot":"disconnected",...(detected.expander?{expander:detected.expander}:{})}:{}),...(target.key==="AriaSalvatrice/Undular"?{hostControl:"rack-view"}:{}),...(target.key==="Chinenual-VCV/MIDIRecorder"?{capture:{format:"midi",channels:1,panelControlParam:0}}:{}),...(visuals?{visuals}:{})};
  const lightWidgets=[...placements.lights].filter(([id])=>Number.isSafeInteger(id)&&id>=0&&id<lightCount).map(([id,{widget,paramId,...position}])=>({id,widget,position,...(paramId!==undefined?{paramId}:{})})).filter(light=>light.widget);
  if(target.key==="OPC-OctobIR/OPC-OctobIR")
    runtime.visuals=[{kind:"octobir-display",offset:0,x:0,y:0,width:600,height:380}];
  if(target.key==="Ohmer/RKD"){
    runtime.visuals=[{kind:"rkd-dividers",offset:0,x:0,y:0,width:60,height:380}];
    for(const param of paramsById.values())param.contextOnly=true;
  }
  if(target.key==="Ohmer/KlokSpid"){
    Object.assign(paramsById.get(0),{min:-1,max:1,unbounded:true});
    runtime.visuals=[{kind:"klokspid-dmd",offset:0,x:0,y:0,width:120,height:380}];
  }
  if(target.key==="Minilab3/MiniLab"||target.key==="Minilab3/MiniPad")runtime.midi={input:true};
  if(target.key==="Minilab3/MiniLog"){
    runtime.midi={input:true};
    runtime.visuals=[{kind:"midi-log",rows:27,columns:128,x:4,y:34.5,width:112,height:338}];
  }
  if(target.key==="MosquitoLabs/PulseCzar"){
    const stateByKey=new Map(runtimeStateKeys.map(state=>[state.key,state]));
    if(stateByKey.has("wave_link_toggle"))stateByKey.get("wave_link_toggle").default=true;
    if(stateByKey.has("env_link_toggle"))stateByKey.get("env_link_toggle").default=true;
    if(stateByKey.has("interpolate_wave_toggle"))stateByKey.get("interpolate_wave_toggle").default=false;
    if(stateByKey.has("interpolate_env_toggle"))stateByKey.get("interpolate_env_toggle").default=false;
  }
  if(target.key==="MosquitoLabs/PhaseCzar"){
    const stateByKey=new Map(runtimeStateKeys.map(state=>[state.key,state]));
    if(stateByKey.has("p1toggle"))stateByKey.get("p1toggle").default=true;
    if(stateByKey.has("p2toggle"))stateByKey.get("p2toggle").default=true;
    if(stateByKey.has("p3toggle"))stateByKey.get("p3toggle").default=false;
    if(stateByKey.has("interpolatetoggle"))stateByKey.get("interpolatetoggle").default=false;
    if(stateByKey.has("boosttoggle"))stateByKey.get("boosttoggle").default=false;
  }
  if(target.key==="ModularMooch/Wolfram")
    runtime.visuals=[{kind:"wolfram-display",cells:8,x:42.755,y:29.941,width:94.49,height:94.49}];
  if(target.key==="MADZINE/NIGOQ")runtime.visuals=[{kind:"madzine-scope",points:256,tracks:2,range:1,colors:["#ff8585","#85c8ff"],x:40,y:335,width:66,height:38.5}];
  if(target.key==="MADZINE/WeiiiDocumenta")runtime.visuals=[{kind:"madzine-waveform",points:170,maxSlices:64,maxVoices:8,loopEndParam:4,x:5,y:38,width:170,height:47}];
  if(target.key==="MADZINE/UniversalRhythm")runtime.visuals=[{kind:"universal-rhythm",steps:32,displayX:15,displayY:42,displayWidth:570,displayHeight:50,roleStartX:76,roleSpacing:152,x:0,y:0,width:600,height:380}];
  if(target.key==="MADZINE/UniRhythm")runtime.visuals=[{kind:"universal-rhythm",steps:32,displayX:15,displayY:42,displayWidth:450,displayHeight:50,roleStartX:60.96,roleSpacing:121.92,x:0,y:0,width:480,height:380}];
  if(target.key==="MADZINE/SongMode")runtime.visuals=[{kind:"song-mode-sequence",dataKey:"sequenceText",defaultText:"12345678",x:5,y:66,width:110,height:14}];
  if(target.key==="MADZINE/Launchpad")runtime.visuals=[{kind:"madzine-launchpad",actionBase:1000,rows:8,columns:8,wavePoints:32,cellWidth:40,cellHeight:28,spacingX:44,spacingY:28,x:50,y:89,width:348,height:224}];
  if(target.key==="MADZINE/theKICK"){
    runtime.asset={type:"audio",maxSamples:48000*10*2,maxSeconds:10,channels:2};
    runtime.visuals=[{kind:"the-kick-sample",clearAction:1000,modeActionBase:1010,modeParam:8,loadX:67,loadY:53,loadWidth:46,loadHeight:18,labelX:60,labelY:107,labelWidth:60,labelHeight:68,modeX:82,modeY:78,modeWidth:16,modeHeight:16,x:0,y:0,width:120,height:380}];
  }
  if(target.key==="MADZINE/Manual"){
    runtime.manualHelp=madzineManualHelpData(sourceDir);
    runtime.visuals=[{kind:"madzine-manual",displayX:5,displayY:50,displayWidth:170,displayHeight:325,languageX:5,languageY:34,languageWidth:50,languageHeight:14,decreaseX:125.88,increaseX:150.88,fontY:34,fontWidth:22,fontHeight:14,x:0,y:0,width:180,height:380}];
    const stateByKey=new Map(runtimeStateKeys.map(state=>[state.key,state]));
    if(stateByKey.has("language"))Object.assign(stateByKey.get("language"),{name:"Language",default:1});
    if(stateByKey.has("fontSize"))Object.assign(stateByKey.get("fontSize"),{name:"Font size",default:20});
  }
  if(target.key==="ML_modules/Arpeggiator"){
    runtime.visuals=[{kind:"ml-arpeggiator",channels:16,rows:17,x:31,y:35,width:60,height:120}];
    Object.assign(runtimeOutputs[4],{name:"CV 3",kind:"cv"});
    Object.assign(runtimeOutputs[5],{name:"Number of notes",kind:"cv"});
  }
  if(target.key==="ML_modules/TrigBuf"&&runtimeStateKeys[0])Object.assign(runtimeStateKeys[0],{
    name:"Arm on load",
    type:"boolean",
    default:false,
  });
  if(target.key==="MSM/TreasureVCO"){
    if(runtimeOutputs[0])runtimeOutputs[0].kind="audio";
    const theme=runtimeStateKeys.find(state=>state.key==="Theme");
    if(theme)Object.assign(theme,{name:"Panel theme",default:0,values:["Classic","Night Mode","Espen's Treasure | Jedi","Omri's Treasure | Mushroom"]});
  }
  if(target.key==="MSM/Phaser"){
    Object.assign(paramsById.get(6),{snap:true,values:["Sine","Triangle","Saw","Square"]});
    if(runtimeInputs[3])runtimeInputs[3].kind="audio";
    if(runtimeOutputs[0])runtimeOutputs[0].kind="audio";
    const theme=runtimeStateKeys.find(state=>state.key==="Theme");
    if(theme)Object.assign(theme,{name:"Panel theme",default:0,values:["Classic","Night Mode"]});
  }
  if(target.key==="MSM/OSCiX"){
    Object.assign(paramsById.get(0),{values:["Digital","Analog"]});
    for(const id of [22,23])Object.assign(paramsById.get(id),{values:["LFO","VCO"]});
    for(const id of [24,25])Object.assign(paramsById.get(id),{values:["External sync","Cross sync"]});
    Object.assign(paramsById.get(30),{snap:true,values:["Standard waves","Alternate waves"]});
    if(runtimeInputs[3])runtimeInputs[3].kind="cv";
    for(const id of [10,11])if(runtimeInputs[id])runtimeInputs[id].kind="gate";
    if(runtimeInputs[12])runtimeInputs[12].kind="audio";
    for(const output of runtimeOutputs)output.kind="audio";
    const theme=runtimeStateKeys.find(state=>state.key==="Theme");
    if(theme)Object.assign(theme,{name:"Panel theme",default:0,values:["Classic","Night Mode"]});
  }
  if(target.key==="MSM/Rogue"){
    Object.assign(paramsById.get(4),{values:["Digital","Analog"]});
    Object.assign(paramsById.get(6),{values:["LFO","VCO"]});
    if(runtimeInputs[0])runtimeInputs[0].kind="gate";
    for(const output of runtimeOutputs)output.kind="audio";
    const theme=runtimeStateKeys.find(state=>state.key==="Theme");
    if(theme)Object.assign(theme,{name:"Panel theme",default:0,values:["Classic","Night Mode"]});
  }
  if(target.key==="MUS-X/Oscillators"){
    Object.assign(paramsById.get(7),{values:["Off","Sync oscillator 2 to oscillator 1"]});
    if(runtimeInputs[7])runtimeInputs[7].kind="gate";
    if(runtimeOutputs[0])runtimeOutputs[0].kind="audio";
    const stateByKey=new Map(runtimeStateKeys.map(state=>[state.key,state]));
    if(stateByKey.has("oversamplingRate"))Object.assign(stateByKey.get("oversamplingRate"),{name:"Oversampling rate",default:8});
    if(stateByKey.has("antiAliasing"))Object.assign(stateByKey.get("antiAliasing"),{name:"Anti-aliasing",default:true});
    if(stateByKey.has("dcBlock"))Object.assign(stateByKey.get("dcBlock"),{name:"DC blocker",default:true});
    if(stateByKey.has("saturate"))Object.assign(stateByKey.get("saturate"),{name:"Saturator",default:true});
    if(stateByKey.has("lfoMode"))Object.assign(stateByKey.get("lfoMode"),{name:"LFO mode",default:false});
  }
  if(target.key==="MUS-X/Drift"){
    if(runtimeOutputs[0])runtimeOutputs[0].kind="cv";
    runtimeStateKeys.forEach((state,index)=>Object.assign(state,{name:`Divergence voice ${index+1}`,default:0}));
  }
  if(target.key==="MUS-X/LFO"){
    Object.assign(paramsById.get(0),{values:["Sine","Triangle","Square","Pulse","Ramp","Saw","Sample & hold","Warped"]});
    if(runtimeInputs[2])runtimeInputs[2].kind="gate";
    if(runtimeOutputs[0])runtimeOutputs[0].kind="cv";
    const stateByKey=new Map(runtimeStateKeys.map(state=>[state.key,state]));
    if(stateByKey.has("sampleRateReduction"))Object.assign(stateByKey.get("sampleRateReduction"),{name:"Internal sample-rate reduction",default:1});
    if(stateByKey.has("bipolar"))Object.assign(stateByKey.get("bipolar"),{name:"Bipolar output",default:true});
  }
  if(target.key==="MUS-X/Filter"){
    Object.assign(paramsById.get(2),{values:[
      "1-pole lowpass, 6 dB/Oct (non-resonant)",
      "1-pole highpass, 6 dB/Oct (non-resonant)",
      "2-pole ladder lowpass, 12 dB/Oct",
      "2-pole ladder bandpass, 6 dB/Oct",
      "4-pole ladder lowpass, 6 dB/Oct",
      "4-pole ladder lowpass, 12 dB/Oct",
      "4-pole ladder lowpass, 18 dB/Oct",
      "4-pole ladder lowpass, 24 dB/Oct",
      "2-pole Sallen-Key lowpass, 12 dB/Oct",
      "2-pole Sallen-Key bandpass, 6 dB/Oct",
      "2-pole Sallen-Key highpass, 6 dB/Oct",
      "2-pole Sallen-Key highpass, 12 dB/Oct",
      "Comb Filter (positive feedback)",
      "Comb Filter (negative feedback)",
      "Diode Clipper (Symmetric)",
      "Diode Clipper (Asymmetric)",
      "Bypass",
      "Mute",
    ]});
    if(runtimeOutputs[0])runtimeOutputs[0].kind="audio";
    const stateByKey=new Map(runtimeStateKeys.map(state=>[state.key,state]));
    if(stateByKey.has("oversamplingRate"))Object.assign(stateByKey.get("oversamplingRate"),{name:"Oversampling rate",default:4});
    if(stateByKey.has("method"))Object.assign(stateByKey.get("method"),{name:"ODE solver",default:1,values:["1st order Euler (low CPU)","2nd order Runge-Kutta","4th order Runge-Kutta (best quality)"]});
    if(stateByKey.has("integratorType"))Object.assign(stateByKey.get("integratorType"),{name:"Integrator type",default:3,values:["Linear","OTA with tanh","OTA with alternate saturator","Transistor with tanh","Transistor with alternate saturator"]});
    if(stateByKey.has("saturate"))Object.assign(stateByKey.get("saturate"),{name:"Post-filter saturator",default:true});
  }
  if(target.key==="MUS-X/Synth"){
    const template=JSON.parse(fs.readFileSync(path.join(sourceDir,"presets","Synth","template.vcvm"),"utf8"));
    const baseDefaults=musxSynthBaseDefaults();
    for(const {id,value} of template.params)if(paramsById.has(id))Object.assign(paramsById.get(id),{default:baseDefaults[id],initial:value});
    for(let id=0;id<22;id++)Object.assign(paramsById.get(id),{snap:true,values:["Off","Active"]});
    const lfoShapes=["Sine","Triangle","Square","Pulse","Ramp","Saw","Sample & hold","Warped"],
      filterModes=[
        "1-pole lowpass, 6 dB/Oct (non-resonant)",
        "1-pole highpass, 6 dB/Oct (non-resonant)",
        "2-pole ladder lowpass, 12 dB/Oct",
        "2-pole ladder bandpass, 6 dB/Oct",
        "4-pole ladder lowpass, 6 dB/Oct",
        "4-pole ladder lowpass, 12 dB/Oct",
        "4-pole ladder lowpass, 18 dB/Oct",
        "4-pole ladder lowpass, 24 dB/Oct",
        "2-pole Sallen-Key lowpass, 12 dB/Oct",
        "2-pole Sallen-Key bandpass, 6 dB/Oct",
        "2-pole Sallen-Key highpass, 6 dB/Oct",
        "2-pole Sallen-Key highpass, 12 dB/Oct",
        "Comb Filter (positive feedback)",
        "Comb Filter (negative feedback)",
        "Diode Clipper (Symmetric)",
        "Diode Clipper (Asymmetric)",
        "Bypass",
        "Mute",
      ];
    Object.assign(paramsById.get(68),{values:lfoShapes});
    Object.assign(paramsById.get(69),{values:["Free running","Retrigger","Retrigger, single cycle"]});
    Object.assign(paramsById.get(70),{values:lfoShapes});
    Object.assign(paramsById.get(71),{values:["Free running","Retrigger","Retrigger, single cycle"]});
    Object.assign(paramsById.get(76),{values:["Off","On"]});
    Object.assign(paramsById.get(77),{values:["Off","Active"]});
    Object.assign(paramsById.get(78),{values:["Off","Sync oscillator 2 to oscillator 1"]});
    Object.assign(paramsById.get(79),{values:filterModes});
    Object.assign(paramsById.get(80),{values:["Individual","Offset","Space"]});
    Object.assign(paramsById.get(81),{values:filterModes});
    const stateByKey=new Map(runtimeStateKeys.map(state=>[state.key,state])),
      stateMetadata={
        oversamplingRate:{name:"Audio oversampling rate",default:8},
        modSampleRateReduction:{name:"Modulation sample-rate reduction",default:1},
        uiSampleRateReduction:{name:"UI sample-rate reduction",default:8},
        filterMethod:{name:"Filter ODE solver",default:1,values:["1st order Euler (low CPU)","2nd order Runge-Kutta","4th order Runge-Kutta (best quality)"]},
        lockQualitySettings:{name:"Lock quality settings",default:false},
        filterIntegratorType:{name:"Filter integrator type",default:3,values:["Linear","OTA with tanh","OTA with alternate saturator","Transistor with tanh","Transistor with alternate saturator"]},
      };
    for(const [key,metadata] of Object.entries(stateMetadata))if(stateByKey.has(key))Object.assign(stateByKey.get(key),metadata,{contextOnly:true});
  }
  if(target.key==="MindMeldModular/EqMaster"){
    for(const port of [...runtimeInputs,...runtimeOutputs])port.kind="audio";
    Object.assign(paramsById.get(0),{values:Array.from({length:24},(_,index)=>String(index+1))});
    for(const id of [1,3,4,5,6,19,20,21])paramsById.get(id).snap=true;
    Object.assign(paramsById.get(1),{values:["Off","Active"]});
    for(const id of [3,4,5,6])Object.assign(paramsById.get(id),{values:["Off","Active"]});
    Object.assign(paramsById.get(19),{values:["Low shelf","Peak"]});
    Object.assign(paramsById.get(20),{values:["High shelf","Peak"]});
    Object.assign(paramsById.get(21),{values:["Active","Bypassed"]});
  }
  if(target.key==="NoSuchDevice/Corrupter"){
    runtime.visuals=[{kind:"corrupter-display",bins:128,x:20.669,y:240.059,width:228.661,height:38.386}];
    const stateByKey=new Map(runtimeStateKeys.map(state=>[state.key,state]));
    if(stateByKey.has("corrupt_bank"))Object.assign(stateByKey.get("corrupt_bank"),{name:"Corrupt bank",default:0,values:["Legacy","Expanded"]});
    if(stateByKey.has("corrupt_algorithm"))Object.assign(stateByKey.get("corrupt_algorithm"),{name:"Corrupt algorithm",default:0,values:["Decimate","Dropout","Destroy","DJ Filter","Vinyl Sim"]});
    if(stateByKey.has("gate_mode_index"))Object.assign(stateByKey.get("gate_mode_index"),{name:"Gate mode",default:0,values:["Latching","Momentary"]});
    if(stateByKey.has("scale_index"))Object.assign(stateByKey.get("scale_index"),{name:"Bend quantize scale",default:0,values:["None (free)","Chromatic","Major","Minor","Pentatonic Major","Pentatonic Minor","Whole Tone","Octaves","Fifths"]});
    if(stateByKey.has("scale_root"))Object.assign(stateByKey.get("scale_root"),{name:"Bend quantize root",default:0,values:["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]});
  }
  if(target.key==="tapestry/Tapestry"){
    runtime.visuals=[{kind:"tapestry-display",bins:90,maxSplices:300,actionBase:1000,deleteActionBase:3000,actionSteps:1024,x:0,y:15,width:315,height:70}];
    const stateByKey=new Map(runtimeStateKeys.map(state=>[state.key,state]));
    if(stateByKey.has("reelIndex"))Object.assign(stateByKey.get("reelIndex"),{name:"Reel",default:0});
    if(stateByKey.has("autoLevelGain"))Object.assign(stateByKey.get("autoLevelGain"),{name:"Automatic level gain",default:1});
    if(stateByKey.has("currentSpliceIndex"))Object.assign(stateByKey.get("currentSpliceIndex"),{name:"Selected marker",default:0});
    if(stateByKey.has("spliceCountMode"))Object.assign(stateByKey.get("spliceCountMode"),{name:"Automatic marker count",default:0,values:["4","8","16"]});
    if(stateByKey.has("waveformColor"))Object.assign(stateByKey.get("waveformColor"),{name:"Waveform color",default:3,values:["Red","Amber","Green","Baby Blue","Peach","Pink","White"]});
  }
  if(target.key==="JW-Modules/BouncyBalls")runtime.visuals=[{kind:"bouncy-balls",actionBase:1000,paddleXState:0,paddleYState:1,displayWidth:448,displayHeight:376,x:270,y:2,width:448,height:376}];
  if(target.key==="JW-Modules/FullScope")runtime.visuals=[{kind:"full-scope",points:512,x:0,y:0,width:detected.panelWidth??255,height:380}];
  if(target.key==="JW-Modules/XYPad")runtime.visuals=[{kind:"xy-pad",actionBase:1000,xParam:0,yParam:1,displayWidth:356,displayHeight:300,x:2,y:40,width:356,height:300}];
  if(target.key==="KautenjaDSP-PotatoChips/106")runtime.visuals=[{kind:"wavetable-editor",actionBase:1000,tables:5,samples:32,bitDepth:15,x:10,y:26,width:135,height:60,gap:8,colors:["#ff0000","#00ff00","#0000ff","#ffff00","#ffffff"]}];
  if(target.key==="KautenjaDSP-PotatoChips/2A03"){
    const names=["Pulse 1 Frequency","Pulse 2 Frequency","Triangle Frequency","Noise Period","Pulse 1 FM","Pulse 2 FM","Triangle FM","Linear Feedback Shift Register","Pulse 1 Volume","Pulse 2 Volume","Triangle Volume","Noise Volume","Pulse 1 Duty Cycle","Pulse 2 Duty Cycle"];
    for(const [id,name] of names.entries())if(paramsById.has(id))paramsById.get(id).name=name;
    if(paramsById.has(3))paramsById.get(3).snap=true;
    if(paramsById.has(7)){paramsById.get(7).position={x:120,y:141,widget:"CKSS"};paramsById.get(7).snap=true}
    if(paramsById.has(10))paramsById.get(10).hidden=true;
    const inputNames=["Pulse 1 V/Oct","Pulse 2 V/Oct","Triangle V/Oct","Noise Period","Pulse 1 FM","Pulse 2 FM","Triangle FM","Noise LFSR","Pulse 1 Volume","Pulse 2 Volume","Triangle Volume","Noise Volume","Pulse 1 Width","Pulse 2 Width","Triangle Sync","Noise Sync"],inputKinds=["cv","cv","cv","cv","cv","cv","cv","gate","cv","cv","cv","cv","cv","cv","gate","gate"];
    for(const input of runtimeInputs){input.name=inputNames[input.id]??input.name;input.kind=inputKinds[input.id]??input.kind;if(input.id===10)input.hidden=true}
    for(const output of runtimeOutputs){output.name=`${["Pulse 1","Pulse 2","Triangle","Noise"][output.id]??`Voice ${output.id+1}`} Audio`;output.kind="audio"}
  }
  if(target.key==="KautenjaDSP-PotatoChips/AY_3_8910"){
    const voices=["Pulse A","Pulse B","Pulse C"],names=[...voices.map(name=>`${name} Frequency`),"Envelope Frequency",...voices.map(name=>`${name} FM`),"Envelope FM",...voices.map(name=>`${name} Level`),...voices.map(name=>`${name} Tone`),...voices.map(name=>`${name} Noise`),...voices.map(name=>`${name} Envelope`),"Noise Period","Envelope Mode"];
    for(const [id,name] of names.entries())if(paramsById.has(id))paramsById.get(id).name=name;
    const inputNames=[...voices.map(name=>`${name} V/Oct`),"Envelope V/Oct",...voices.map(name=>`${name} FM`),"Envelope FM",...voices.map(name=>`${name} Level`),...voices.map(name=>`${name} Tone`),...voices.map(name=>`${name} Noise`),...voices.map(name=>`${name} Envelope`),"Noise Period","Envelope Mode",...voices.map(name=>`${name} Sync`),"Envelope Reset"],gateInputs=new Set([11,12,13,14,15,16,17,18,19,21,22,23,24,25]);
    for(const input of runtimeInputs){input.name=inputNames[input.id]??input.name;input.kind=gateInputs.has(input.id)?"gate":"cv"}
    for(const output of runtimeOutputs){output.name=`${voices[output.id]??`Voice ${output.id+1}`} Audio`;output.kind="audio"}
    if(runtimeStateKeys[0])Object.assign(runtimeStateKeys[0],{name:"Envelope Mode",default:0,values:["/_____ (Attack)","\\_____ (Decay)","/----- (Attack & Max)","\\----- (Decay & Max)","////// (Attack LFO)","\\\\\\\\\\\\ (Decay LFO)","/\\/\\/\\ (Attack-Decay LFO)","\\/\\/\\/ (Decay-Attack LFO)"]});
  }
  if(target.key==="KautenjaDSP-PotatoChips/SN76489"){
    const paramNames=["Tone 1 Frequency","Tone 2 Frequency","Tone 3 Frequency","Noise Period","Tone 1 Fine Tune / FM Attenuverter","Tone 2 Fine Tune / FM Attenuverter","Tone 3 Fine Tune / FM Attenuverter","Linear Feedback Shift Register","Tone 1 Volume / Amplifier Attenuator","Tone 2 Volume / Amplifier Attenuator","Tone 3 Volume / Amplifier Attenuator","Noise Volume / Amplifier Attenuator"];
    for(const [id,name] of paramNames.entries())if(paramsById.has(id))paramsById.get(id).name=name;
    if(paramsById.has(3))paramsById.get(3).snap=true;
    if(paramsById.has(7)){paramsById.get(7).position={x:120,y:173,widget:"CKSS"};paramsById.get(7).snap=true}
    const inputNames=["Tone 1 V/Oct","Tone 2 V/Oct","Tone 3 V/Oct","Noise Period","Tone 1 FM","Tone 2 FM","Tone 3 FM","LFSR","Tone 1 Level","Tone 2 Level","Tone 3 Level","Noise Level"];
    for(const [id,name] of inputNames.entries())if(runtimeInputs[id])Object.assign(runtimeInputs[id],{name,kind:id===7?"gate":"cv"});
    for(const output of runtimeOutputs)Object.assign(output,{name:`${output.id<3?`Tone ${output.id+1}`:"Noise"} Audio`,kind:"audio"});
  }
  if(target.key==="KautenjaDSP-PotatoChips/VRC6"){
    if(paramsById.has(7))paramsById.get(7).name="Pulse 2 Duty Cycle";
    for(const input of runtimeInputs)input.kind=input.id===11?"gate":"cv";
    for(const output of runtimeOutputs)Object.assign(output,{name:`${output.id<2?`Pulse ${output.id+1}`:"Saw"} Audio`,kind:"audio"});
  }
  if(target.key==="KautenjaDSP-PotatoChips/GBS"){
    if(paramsById.has(3))paramsById.get(3).snap=true;
    if(paramsById.has(7)){paramsById.get(7).position={x:269,y:141,widget:"CKSS"};paramsById.get(7).snap=true}
    for(const id of [8,9])if(paramsById.has(id))paramsById.get(id).snap=true;
    for(const input of runtimeInputs)input.kind=input.id===7?"gate":"cv";
    for(const output of runtimeOutputs)output.kind="audio";
    runtime.visuals=[{kind:"wavetable-editor",actionBase:1000,tables:5,samples:32,bitDepth:15,x:11,y:26,width:136,height:60,gap:7,borderColor:"#333333",colors:["#ff0000","#00ff00","#0000ff","#ffff00","#ffffff"]}];
  }
  if(target.key==="KautenjaDSP-PotatoChips/POKEY"){
    // PotKeys deliberately leaves the two 16-bit register controls (IDs 19
    // and 20) unconfigured and skips their widgets. The remaining switches
    // are packed into the vacated rows with a mutable `offset`, which the
    // generic expression evaluator cannot infer from the loop alone.
    for(const id of [19,20]){
      const param=paramsById.get(id),input=runtimeInputs[id];
      if(param){param.hidden=true;delete param.position;delete param.snap}
      if(input){input.hidden=true;delete input.position}
    }
    for(const [row,id] of [16,17,18,21,22,23].entries()){
      const param=paramsById.get(id),input=runtimeInputs[id];
      if(param){param.position={x:152,y:45+56*row,widget:"CKSS"};param.snap=true}
      if(input){input.position={x:175,y:44+56*row};input.kind="gate"}
    }
    for(const input of runtimeInputs)if(input.id>=8&&input.id<16)input.kind="cv";
    for(const output of runtimeOutputs)output.kind="audio";
  }
  if(target.key==="KautenjaDSP-PotatoChips/SuperEcho"){
    for(const input of runtimeInputs)input.kind=input.id<2?"audio":"cv";
    for(const output of runtimeOutputs)output.kind="audio";
  }
  if(target.plugin==="TriggerFish-Elements"&&["TfVDPO","TfVCA"].includes(target.model))
    for(const output of runtimeOutputs)output.kind="audio";
  if(target.key==="KautenjaDSP-PotatoChips/SuperVCA"){
    for(const input of runtimeInputs)input.kind=[3,4].includes(input.id)?"audio":"cv";
    for(const output of runtimeOutputs)output.kind="audio";
    if(runtimeStateKeys[0])Object.assign(runtimeStateKeys[0],{name:"Filter Mode",default:0,values:["Loud","Weird","Quiet","Barely Audible"]});
  }
  if(target.key==="KautenjaDSP-PotatoChips/SuperSampler"){
    for(const input of runtimeInputs){
      const voice=input.id%8+1;
      if(input.id<8)Object.assign(input,{name:`Voice ${voice} V/Oct`,kind:"cv"});
      else if(input.id<16)Object.assign(input,{name:`Voice ${voice} FM`,kind:"cv"});
      else if(input.id<24)Object.assign(input,{name:`Voice ${voice} Phase Modulation Enable`,kind:"gate"});
      else if(input.id<32)Object.assign(input,{name:`Voice ${voice} Gate`,kind:"gate"});
      else if(input.id<40)Object.assign(input,{name:`Voice ${voice} Volume (Left) CV`,kind:"cv"});
      else Object.assign(input,{name:`Voice ${voice} Volume (Right) CV`,kind:"cv"});
    }
    for(const output of runtimeOutputs)Object.assign(output,{name:`Voice ${output.id%8+1} Audio (${output.id<8?"Left":"Right"})`,kind:"audio"});
  }
  if(target.key==="KautenjaDSP-PotatoChips/SuperSynth"){
    const lanes=[
      [0,8,"V/Oct","cv"],[8,16,"FM","cv"],[16,24,"Phase Modulation Enable","gate"],[24,32,"Noise Enable","gate"],
      [33,41,"Gate","gate"],[41,49,"Volume (Left) CV","cv"],[49,57,"Volume (Right) CV","cv"],
      [57,65,"Envelope Attack CV","cv"],[65,73,"Envelope Decay CV","cv"],[73,81,"Envelope Sustain Level CV","cv"],
      [81,89,"Envelope Sustain Rate CV","cv"],[89,97,"Echo Enable","gate"],
    ];
    for(const [start,end,label,kind] of lanes)for(let id=start;id<end;id++)if(runtimeInputs[id])Object.assign(runtimeInputs[id],{name:`Voice ${id-start+1} ${label}`,kind});
    for(const [id,name] of [[32,"Noise FM"],[97,"Echo Delay CV"],[98,"Echo Feedback CV"],[99,"Echo Volume (Left) CV"],[100,"Echo Volume (Right) CV"],[101,"Main Volume (Left) CV"],[102,"Main Volume (Right) CV"]])if(runtimeInputs[id])Object.assign(runtimeInputs[id],{name,kind:"cv"});
    for(let id=103;id<111;id++)if(runtimeInputs[id])Object.assign(runtimeInputs[id],{name:`FIR Coefficient ${id-102} CV`,kind:"cv"});
    for(const output of runtimeOutputs)Object.assign(output,{name:`Audio (${output.id?"Right":"Left"})`,kind:"audio"});
  }
  if(target.key==="KautenjaDSP-RackNES/RackNES"){
    for(const input of runtimeInputs)input.kind=input.id===16?"cv":"gate";
    for(const output of runtimeOutputs)output.kind=output.id===0?"gate":"audio";
    runtimeStateKeys.splice(0);
    runtime.asset={type:"binary",maxSamples:4*1024*1024,maxSeconds:0,channels:1};
    runtime.visuals=[{kind:"racknes-screen",bufferWidth:602,bufferHeight:240,x:157,y:18,width:256,height:240}];
  }
  if(target.key==="LomasModules/GateSequencer"&&runtime.expander?.transport==="message-buffer")
    runtime.expander.capacity=32768;
  if(target.key==="LomasModules/AdvancedSampler"){
    const mm=value=>Number((value*75/25.4).toFixed(3));
    runtime.asset={type:"audio",maxSamples:960000,maxSeconds:10,channels:2};
    runtime.visuals=[{kind:"lomas-sampler",offset:0,x:mm(3.81),y:mm(19.915),width:mm(43.18),height:mm(16.51)}];
    const stateOptions=[
      {name:"Loop",default:0},
      {name:"Envelope",default:0,values:["Attack / Decay","Hold / Decay"]},
      {name:"Playing",default:0,contextOnly:false},
      {name:"Read Position",default:0,contextOnly:false},
      {name:"Interpolation",default:2,values:["None","Linear","Hermite","B-Spline"]},
      {name:"Slice Mode",default:0},
    ];
    runtimeStateKeys.forEach((state,index)=>Object.assign(state,stateOptions[index]??{},{
      contextOnly:stateOptions[index]?.contextOnly??true,
    }));
  }
  if(target.key==="LOGinstruments/Speck")runtime.visuals=[{kind:"speck-spectrum",bins:1025,x:0,y:44,width:300,height:165}];
  if(target.key==="Leviathan/IntegralFlux"){
    const mm=value=>Number((value*75/25.4).toFixed(3));
    runtime.visuals=[
      {kind:"integral-flux-preview",channel:1,offset:0,x:mm(3.95998355),y:mm(69.16602539),width:mm(20.38393382),height:mm(10.84561948)},
      {kind:"integral-flux-preview",channel:4,offset:9,x:mm(77.725),y:mm(69.166001),width:mm(20.383933),height:mm(10.84562)},
    ];
  }
  if(target.key==="Leviathan/TemporalDeck"){
    const mm=value=>Number((value*75/25.4).toFixed(3));
    runtime.asset={type:"audio",maxSamples:960000,maxSeconds:10,channels:2};
    runtime.visuals=[{kind:"temporal-deck",offset:0,lightStart:7,redLightStart:38,x:mm(21.3),y:mm(42.5),width:mm(59),height:mm(59)}];
    if(runtime.expander?.transport==="message-buffer")runtime.expander.capacity=32768;
  }
  if(target.key==="Leviathan/TDScope"){
    runtime.expanderMode="message-buffer";
    runtime.expander={transport:"message-buffer",direction:"both",capacity:32768,models:[{key:"Leviathan/TemporalDeck",symbol:"modelTemporalDeck",index:0}]};
    runtime.visuals=[{kind:"td-scope",offset:0,x:3.291,y:27.728,width:113.843,height:327.666}];
    const options=[
      {name:"Scope Range",default:3,values:["±5V full width","±10V full width","±2.5V full width","Auto (window peak)"]},
      {name:"Inverted Vertical",default:0},
      {name:"Channel View",default:0,values:["Mono","Stereo (side-by-side)"]},
      {name:"Colors",default:0,values:["Default (Purple/Cyan)","Classic (Green/Red)","Monochrome (Gray/White)","Fire (Red/Yellow)","Retro Amber","Retro Green"]},
      {name:"Color Scheme Version",default:2,contextOnly:false},
      {name:"Brightness",default:.5},
      {name:"Use GL Shader Renderer",default:1,contextOnly:false},
      {name:"Framebuffer Cache",default:1,contextOnly:false},
      {name:"Debug Render Mode",default:7,contextOnly:false},
      {name:"Scope Publish Rate",default:0,values:["90 Hz","60 Hz","30 Hz"],contextOnly:false},
    ];
    runtimeStateKeys.forEach((state,index)=>Object.assign(state,options[index]??{},{
      contextOnly:options[index]?.contextOnly??true,
    }));
  }
  if(target.key==="Leviathan/Proc"){
    const mm=value=>Number((value*75/25.4).toFixed(3));
    runtime.visuals=[
      {kind:"proc-preview",offset:0,x:mm(3.95998355),y:mm(69.16602539),width:mm(20.38393382),height:mm(10.84561948)},
      {kind:"param-numeric-display",param:4,digits:3,x:mm(2.5),y:mm(32.15),width:mm(9.6),height:mm(2.6)},
    ];
  }
  if(target.key==="Leviathan/Undertow"){
    const mm=value=>Number((value*75/25.4).toFixed(3));
    runtime.visuals=[{
      kind:"undertow-preview",
      offset:0,
      x:mm(2.3790068),
      y:mm(86.331514),
      width:mm(35.881987),
      height:mm(16.086146),
    }];
    const options=[
      {name:"Enable Morph Asymmetry",default:0},
      {name:"Morph Asymmetry On Falling Edge",default:0},
      {name:"Analog Character",default:1},
      {name:"Preview Tracer",default:1},
      {name:"Preview Tracer Cache",default:0,values:["Curve","Frame"],contextOnly:false},
    ];
    runtimeStateKeys.forEach((state,index)=>Object.assign(state,options[index]??{},{
      contextOnly:options[index]?.contextOnly??true,
    }));
  }
  if(target.key==="LOGinstruments/LessMess")runtime.visuals=[{kind:"less-mess-labels",rows:9,dataKeyPrefix:"label",x:40,y:42,width:165,height:20,rowHeight:35}];
  if(target.key==="HarmonicAnomalies/HexNut"||target.key==="HarmonicAnomalies/HexaGrain")runtime.visuals=[{kind:"hex-looper",radius:target.model==="HexaGrain"?16:86,x:0,y:37,width:150,height:138}];
  if(target.key==="HetrickCVGPL/PhasorWavetable")runtime.visuals=[{kind:"wavetable-display",x:0,y:56.102,width:105,height:86.291}];
  if(target.key==="IggyLabsModules/more-ideas")runtime.visuals=[{kind:"elementary-ca",inputs:[2,3,6],ruleParam:0,seedParam:1,scaleParam:5,cells:64,scaleValues:["ionian","aeolian","dorian","phrygian","lydian","mixolydian","major pent","minor pent","shang","jiao","zhi","todi","purvi","marva","bhairav","ahirbhairav","chromatic"],x:10.4527559055,y:54.625984252,width:118.11023622,height:118.11023622,labelX:41.3385826772,labelY:285.413385827,labelWidth:118.11023622,labelHeight:53.1496062992}];
  if(target.key==="ImpromptuModular/Prob-Key")runtime.visuals=[{kind:"phrase-seq-display",digits:4,label:"ProbKey display",x:122.472,y:315.709,width:71,height:30},{kind:"piano-keyboard",actionBase:1000,keys:12,voices:4,lightStart:0,lightStride:12,lightVoiceStride:3,lightChannels:3,lightOrder:"bottom-up",actionSteps:256,fixedKeyOnDrag:true,modifierBank:"shift",x:19.114,y:34.715,width:292,height:155,layout:"big"}];
  if(target.key==="ImpromptuModular/Chord-Key")runtime.visuals=[{kind:"piano-keyboard",actionBase:1000,keys:12,voices:4,lightStart:0,x:11.498,y:34.715,width:292,height:155,layout:"big",rightClick:true}];
  if(target.key==="ImpromptuModular/Four-View")runtime.visuals=[{kind:"four-view-display",modeParam:0,sharpState:3,rows:4,x:54,y:51.5,width:52,height:29,spacingY:44}];
  if(target.key==="ImpromptuModular/NoteLoop")runtime.visuals=[{kind:"note-loop-display",param:1,x:10.551,y:52.961,width:35,height:24}];
  if(target.key==="ImpromptuModular/Phrase-Seq-16")runtime.visuals=[{kind:"phrase-seq-display",x:320.5,y:102,width:55,height:30},{kind:"piano-keyboard",actionBase:1000,keys:12,voices:1,lightStart:55,lightStride:2,x:53.805,y:98.336,width:195.736,height:80.431,layout:"small",rightClick:true}];
  if(target.key==="ImpromptuModular/Phrase-Seq-32")runtime.visuals=[{kind:"phrase-seq-display",x:350.5,y:102,width:55,height:30},{kind:"piano-keyboard",actionBase:1000,keys:12,voices:1,lightStart:103,lightStride:2,x:53.805,y:98.336,width:195.736,height:80.431,layout:"small",rightClick:true}];
  if(target.key==="ImpromptuModular/Hotkey"){
    runtime.hotkey={scope:"module-hover",actionBase:0x20000000,recordParam:0,keyState:2,modsState:3};
    if(runtimeStateKeys[2])runtimeStateKeys[2].default=32;
    if(runtimeStateKeys[3])runtimeStateKeys[3].default=0;
    if(runtimeStateKeys[4])runtimeStateKeys[4].default=1;
  }
  return {key:target.key,plugin:target.plugin,model:target.model,name:moduleManifest.name??target.model,brand:manifest.brand??manifest.name??target.plugin,version:manifest.version??"0.0.0",license,sourceUrl:manifest.sourceUrl,libraryUrl:target.url,screenshotUrl:`https://library.vcvrack.com/screenshots/400/${target.plugin}/${target.model}.webp`,wasmUrl:"./module.wasm",width:detected.panelWidth??placements.panelSize?.x??180,description:moduleManifest.description??`Automatically isolated from the ${target.key} Rack source`,params:[...paramsById.values()].sort((a,b)=>a.id-b.id),inputs:runtimeInputs,outputs:runtimeOutputs,lights:lightCount,...(lightWidgets.length?{lightWidgets}:{}),...(runtimeStateKeys.length?{stateKeys:runtimeStateKeys}:{}),...(bypassRoutes.length?{bypassRoutes}:{}),...(Object.keys(runtime).length?{runtime}:{})};
}

async function main(){
  const options=args(process.argv.slice(2)),target=libraryUrl(options.url),fixtureManifest=Boolean(options["manifest-file"]);
  let manifest,sourceCommit,sourceDir,temporary=false;
  if(fixtureManifest){
    manifest=JSON.parse(fs.readFileSync(path.resolve(options["manifest-file"]),"utf8"));
    sourceDir=options["source-dir"]&&path.resolve(options["source-dir"]);
    if(!sourceDir)fail("Fixture manifests require --source-dir");
    activeSourceTool=options["source-tool"]?path.resolve(options["source-tool"]):null;
  }else{
    const prepared=prepareOfficialSource(options);
    if(prepared.target?.key!==target.key)fail("Rust source preparer returned a different module target");
    manifest=prepared.manifest;
    sourceCommit=prepared.source?.commit;
    sourceDir=prepared.source?.directory&&path.resolve(prepared.source.directory);
    temporary=Boolean(prepared.source?.temporary);
    if(!/^[0-9a-f]{40}$/.test(sourceCommit??"")||!sourceDir)fail("Rust source preparer returned invalid provenance");
  }
  sourceDir=fs.realpathSync(sourceDir);
  if(manifest.slug!==target.plugin||!Array.isArray(manifest.modules))fail("Official manifest does not match the requested plugin");
  const moduleManifest=manifest.modules.find(module=>module.slug===target.model);
  if(!moduleManifest)fail(`${target.key} is not present in the official plugin manifest`);
  if(!manifest.sourceUrl)fail(`${target.plugin} does not publish sourceUrl metadata`);
  const license=String(manifest.license||"");
  if(!license||license==="proprietary"||/^https?:\/\//.test(license))fail(`${target.plugin} is not declared under an open-source SPDX license`);
  if(!fs.existsSync(path.join(sourceDir,"plugin.json")))fail("Checked-out source does not contain plugin.json");
  if(fixtureManifest){
    const selectedSubmodules=target.key==="ParableInstruments/Neil"?new Set(["parasites/stmlib"]):null;
    initializeSubmodules(sourceDir,0,selectedSubmodules);
  }
  const sourceManifest=JSON.parse(fs.readFileSync(path.join(sourceDir,"plugin.json"),"utf8"));
  if(sourceManifest.slug!==manifest.slug)fail("Source plugin.json slug differs from the official manifest");
  if(!fixtureManifest&&sourceManifest.version!==manifest.version)fail(`Source version ${sourceManifest.version} differs from Library version ${manifest.version}`);
  hydrateLockedFallbackDependencies(sourceDir);const browserLuaRuntime=hydrateWrongPeopleLuaRuntime(sourceDir,target);dependencyFileInventoryCache.clear();
  let rootSourceFiles=target.key==="ParableInstruments/Neil"?files(path.join(sourceDir,"src")):filesOutsideNestedRepositories(sourceDir),
    rustModelAnalysis=target.key!=="ParableInstruments/Neil"?rustModelCandidateStarts(sourceDir):null,
    rustCandidateStarts=rustModelAnalysis?.byFile??null,
    rustCustomModelCandidates=rustModelAnalysis?.customModelCandidatesByFile??null,
    rustMetaModuleCandidates=rustModelAnalysis?.metaModuleCandidatesByFile??null,
    rustAliasesByFile=rustModelAnalysis?.aliasesByFile??null,
    registrationConstants=rustModelAnalysis?.stringConstants??registrationStringConstants(rootSourceFiles),
    registrations=[];
  activeTypeDeclarationsByFile=rustModelAnalysis?.typeDeclarationsByFile??null;
  activeTypeAliasesByFile=rustModelAnalysis?.aliasesByFile??null;
  activeEnumDeclarationsByFile=rustModelAnalysis?.enumDeclarationsByFile??null;
  activeNamespaceConstantDeclarationsByFile=rustModelAnalysis?.namespaceConstantDeclarationsByFile??null;
  activeNamespaceVariableDeclarationsByFile=rustModelAnalysis?.namespaceVariableDeclarationsByFile??null;
  activeNamespaceUsingDeclarationsByFile=rustModelAnalysis?.namespaceUsingDeclarationsByFile??null;
  activeNamespaceUsingDirectivesByFile=rustModelAnalysis?.namespaceUsingDirectivesByFile??null;
  activeIncludeDirectivesByFile=rustModelAnalysis?.includeDirectivesByFile??null;
  activeOutOfLineDefinitionsByFile=rustModelAnalysis?.outOfLineDefinitionsByFile??null;
  activeFreeFunctionDeclarationsByFile=rustModelAnalysis?.freeFunctionDeclarationsByFile??null;
  activeFreeFunctionDefinitionsByFile=rustModelAnalysis?.freeFunctionDefinitionsByFile??null;
  for(const file of rootSourceFiles){const source=fs.readFileSync(file,"utf8"),resolved=path.resolve(file),candidateStarts=rustCandidateStarts?.get(resolved),customModelCandidates=rustCustomModelCandidates?.get(resolved),metaModuleCandidates=rustMetaModuleCandidates?.get(resolved);registrations.push(...macroConfiguredRegistrations(source,file,registrationConstants,candidateStarts,rustAliasesByFile,customModelCandidates,metaModuleCandidates))}
  if(!registrations.some(item=>item.slug===target.model)){
    // Some Library repositories are thin release wrappers whose actual Rack
    // module is a locked nested source repository. Search initialized nested
    // sources only after the root scan misses, while files() continues to
    // exclude third-party/development trees.
    const nestedSourceFiles=files(sourceDir);
    registrationConstants=registrationStringConstants(nestedSourceFiles);
    registrations=[];
    for(const file of nestedSourceFiles){const source=fs.readFileSync(file,"utf8");registrations.push(...macroConfiguredRegistrations(source,file,registrationConstants))}
    if(registrations.some(item=>item.slug===target.model)){rootSourceFiles=nestedSourceFiles;activeTypeAliasesByFile=null;activeTypeDeclarationsByFile=null;activeEnumDeclarationsByFile=null;activeNamespaceConstantDeclarationsByFile=null;activeNamespaceVariableDeclarationsByFile=null;activeNamespaceUsingDeclarationsByFile=null;activeNamespaceUsingDirectivesByFile=null;activeIncludeDirectivesByFile=null;activeOutOfLineDefinitionsByFile=null;activeFreeFunctionDeclarationsByFile=null;activeFreeFunctionDefinitionsByFile=null}
  }
  const activeRootSourceFiles=pruneInactiveConditionalDependencies(rootSourceFiles,sourceDir);
  let registration=registrations.find(item=>item.slug===target.model);
  if(!registration)fail(`Could not locate a Rack or MetaModule model registration for "${target.model}" in source`);
  if(target.plugin==="4msCompany"&&target.model==="HubMedium")registration={...registration,metaModuleGeneric:true,metaModuleCore:"MetaModule::HubMedium",metaModuleInfo:"MetaModule::HubMediumInfo",metaModuleCoreFile:path.join(sourceDir,"lib","CoreModules","hub","hub_medium.cc")};
  if(target.plugin==="4msCompany"&&target.model==="MMAudioExpander")registration={...registration,metaModuleGeneric:true,metaModuleExternal:true,metaModuleCore:"MetaModule::RackWebMMAudioExpanderCore",metaModuleInfo:"MetaModule::MMAudioExpanderInfo"};
  if(target.plugin==="4msCompany"&&target.model==="MMButtonExpander")registration={...registration,metaModuleGeneric:true,metaModuleExternal:true,metaModuleCore:"MetaModule::RackWebMMButtonExpanderCore",metaModuleInfo:"MetaModule::MMButtonExpanderInfo"};
  if(registration.metaModuleGeneric)return buildMetaModuleScaffold({options,target,manifest,moduleManifest,license,sourceDir,sourceCommit,temporary,registration,rootSourceFiles});
  if(rackModuleBase(registration.moduleClass)&&!registeredModuleDefinitionExists(sourceDir,registration)){const syntheticClass=`RackWeb${target.plugin.replace(/[^A-Za-z0-9]/g,"")}${target.model.replace(/[^A-Za-z0-9]/g,"")}Module`;registration={...registration,moduleClass:syntheticClass,definitionFile:registration.file,definitionSource:`struct ${syntheticClass} : Module { ${syntheticClass}() { config(0, 0, 0, 0); } };`}}
  const fxSpecializationRoots=fxConfigSpecializationFiles(rootSourceFiles,registration.moduleClass);
  let browserIsolatedLeviathan=new Set(["Leviathan/IntegralFlux","Leviathan/Proc","Leviathan/Undertow","Leviathan/TemporalDeck","Leviathan/TDScope"]),rootDefinition=moduleDefinition(sourceDir,rootSourceFiles,registration),sourceFiles=[...new Set(includedDependencyFiles(sourceDir,[rootDefinition.file,registration.file,...fxSpecializationRoots]))].filter(file=>target.key==="ParableInstruments/Neil"?!/[/\\]parasites[/\\](?:(?:edges[/\\]audio_buffer|braids[/\\]drivers[/\\]debug_pin)\.(?:h|cc)|clouds[/\\](?:resources|dsp[/\\](?:correlator|granular_processor|mu_law)|dsp[/\\]pvoc[/\\](?:frame_transformation|phase_vocoder|stft))\.cc)$/.test(file):target.key==="Leviathan/Proc"?(file===rootDefinition.file||path.basename(file)==="MathHelpers.hpp"):target.key==="Leviathan/Undertow"?(file===rootDefinition.file||path.basename(file)==="UndertowShape.hpp"):target.key==="Leviathan/TemporalDeck"?["TemporalDeck.hpp","TemporalDeckUI.cpp","TemporalDeckEngine.hpp","TemporalDeckExpanderProtocol.hpp","TemporalDeckTest.hpp"].includes(path.basename(file)):target.key==="Leviathan/TDScope"?["TDScope.hpp","TDScopeWidget.cpp","TemporalDeckExpanderProtocol.hpp","TDScopeShared.hpp"].includes(path.basename(file)):target.key!=="Leviathan/IntegralFlux"||!/[/\\](?:(?:DebugTerminalMetrics|DebugTerminalTransport|NvgGraphicsLifecycle)\.(?:hpp|cpp)|WavePreviewTracer\.hpp)$/.test(file)),definition=moduleDefinition(sourceDir,sourceFiles,registration),rawBody=expandClassBodyIncludes(definition.body,definition.file,sourceDir,registration.macros).replace(/\breadDefaultIntegerValue\s*\([^;()]*\)/g,"0"),browserHostBody=target.key==="ImpromptuModular/Prob-Key"?adaptImpromptuProbKeyBrowserBody(rawBody):rawBody,hostAdaptedBody=stubHostOnlyModuleMethods(stripHostHistoryStatements(browserHostBody)),
  targetAdaptedBody=target.key==="MUS-X/Synth"?adaptMusxSynthBrowserBody(hostAdaptedBody,sourceDir):target.key==="MindMeldModular/EqMaster"?adaptMindMeldEqMasterBrowserBody(hostAdaptedBody):target.key==="Minilab3/MiniLog"?adaptMinilabMiniLogBrowserBody(hostAdaptedBody):target.key==="ModularMooch/Wolfram"?adaptModularMoochWolframBrowserBody(hostAdaptedBody):target.key==="BaconMusic/LintBuddy"?adaptLintBuddyBrowserBody(hostAdaptedBody):target.key==="FrozenWasteland/MidiRecorder"?adaptMidiRecorderBrowserBody(hostAdaptedBody):target.key==="Edge/K_Rush"?adaptEdgeKRushBrowserSource(hostAdaptedBody,sourceDir):target.key==="HoyerHoppes/scanning_frequency_division_osc_poly"?adaptHoyerScanningDivisionBrowserBody(hostAdaptedBody):target.key==="Leviathan/IntegralFlux"?adaptLeviathanIntegralFluxBrowserBody(hostAdaptedBody):target.key==="Leviathan/Proc"?adaptLeviathanProcBrowserBody(hostAdaptedBody):target.key==="Leviathan/Undertow"?adaptLeviathanUndertowBrowserBody(hostAdaptedBody):target.key==="PathSet/IceTray"?adaptPathSetIceTrayBrowserBody(hostAdaptedBody):target.plugin==="Fundamental"||target.key==="HetrickCVGPL/PhasorWavetable"?adaptFundamentalWavetableBrowserBody(hostAdaptedBody):hostAdaptedBody,
  embeddedJsonAssets=embeddedJsonAssetFiles(sourceDir,definition.source),embeddedMidiAssets=embeddedMidiAssetFiles(sourceDir,definition.source),embeddedBinaryAssets=embeddedBinaryAssetFiles(sourceDir,definition.source),browserAdaptedBody=adaptEmbeddedBinaryAssetLoads(adaptEmbeddedMidiAssetLoads(adaptEmbeddedJsonAssetLoads(targetAdaptedBody,embeddedJsonAssets),embeddedMidiAssets),embeddedBinaryAssets),body=target.model.startsWith("SurgeXTFX")?adaptSurgeFxModuleBody(browserAdaptedBody):browserAdaptedBody,dependencyBody=stripUiClassMembers(body),rawModulePreludeBase=(value=>target.key==="HetrickCVGPL/PhasorWavetable"?removeClassDefinition(value,"PhasorWavetableData"):value)(adaptEmbeddedBinaryAssetLoads(adaptEmbeddedMidiAssetLoads(adaptEmbeddedJsonAssetLoads(stripHeaderGuardOpen(target.plugin==="CosineKitty-Sapphire"?namespacedModulePrelude(definition.source,registration.moduleClass):modulePrelude(definition.source,registration.moduleClass,definition.typeDeclaration)),embeddedJsonAssets),embeddedMidiAssets),embeddedBinaryAssets).replace(/^\s*#include\s+<pffft\.h>\s*$/gm,"")),
  rawModulePreludeSource=target.plugin==="Fundamental"&&["VCO2","LFO2"].includes(target.model)?"":target.key==="BaconMusic/LintBuddy"?stripLintBuddyBrowserPrelude(rawModulePreludeBase):target.key==="FrozenWasteland/MidiRecorder"?adaptMidiRecorderBrowserPrelude(rawModulePreludeBase):target.key==="Leviathan/IntegralFlux"?adaptLeviathanIntegralFluxBrowserPrelude(rawModulePreludeBase):target.key==="Leviathan/Proc"?adaptLeviathanProcBrowserPrelude(rawModulePreludeBase):target.key==="Leviathan/Undertow"?adaptLeviathanUndertowBrowserPrelude(rawModulePreludeBase):rawModulePreludeBase,
  modulePreludeSource=target.plugin==="CosineKitty-Sapphire"?rawModulePreludeSource:rawModulePreludeSource&&definition.namespace?.length?`namespace ${definition.namespace.join("::")} {\n${rawModulePreludeSource}\n}`:rawModulePreludeSource,preludeNames=new Set(declaredTypeNames(modulePreludeSource)),strippedAnalysisPrelude=stripRackUiBlocks(modulePreludeSource),analysisPrelude=[referencedVecDspHelpers(modulePreludeSource,dependencyBody),strippedAnalysisPrelude].filter(Boolean).join("\n\n"),template=templateContract(definition.source,registration.moduleClass,definition.typeDeclaration),directImplementations=classImplementations(activeRootSourceFiles,registration.file,registration.moduleClass),includedDeclarationSource=[rawModulePreludeSource,...sourceFiles.map(file=>fs.readFileSync(file,"utf8"))].join("\n"),rawImplementations=[...directImplementations,...preludeTypeImplementations(activeRootSourceFiles,includedDeclarationSource,[dependencyBody,...directImplementations].join("\n"),registration.moduleClass,definition.file)].map(stripHostHistoryStatements),browserAsset=browserAssetSamplerContract([body,...rawImplementations].join("\n")),browserLoadStub=browserAsset?.mode==="rgba-image"?`void ${registration.moduleClass}::loadSample(std::string) { loading = false; }`:browserAsset?.mode==="wavetable"?`void ${registration.moduleClass}::loadSample() {}`:`void ${registration.moduleClass}::loadSample() { loading = false; }`,implementations=browserAsset?rawImplementations.map(value=>replaceOutOfLineMethod(replaceOutOfLineMethod(value,registration.moduleClass,"loadSample",browserLoadStub),registration.moduleClass,"saveSample",`void ${registration.moduleClass}::saveSample() { save = false; }`)):rawImplementations,configCandidate=[body,...implementations].join("\n"),configSource=template?specializeConstantBranches(configCandidate,template.constants):configCandidate,inherited=inheritedDefinitions(rootSourceFiles,definition.source,registration.moduleClass,definition.typeDeclaration),allBases=definition.typeDeclaration?.bases??declaredBases(definition.source,registration.moduleClass),secondaryBases=allBases.slice(1),secondaryInterfaces=secondaryBaseDefinitions(rootSourceFiles,secondaryBases.filter(type=>!preludeNames.has(baseTypeName(type)))),localPlainStructs=localPlainStructDefinitions(definition.source,registration.moduleClass,dependencyBody,preludeNames),inheritedSource=inherited.filter(item=>!item.missing).flatMap(item=>[stripRackUiBlocks(item.prelude),stripRackUiBlocks(item.analysisBody??item.body),...item.implementations.filter(value=>!rackUiPattern.test(value)).map(stripHostHistoryStatements)]),rawAnalysisSource=[...inheritedSource,secondaryInterfaces,localPlainStructs,analysisPrelude,dependencyBody,...implementations].join("\n"),externalSourceRoots=repositoryRoots(sourceDir).slice(1).map(root=>path.resolve(root)),localSourceFiles=sourceFiles.filter(file=>!externalSourceRoots.some(root=>file.startsWith(`${root}${path.sep}`))),referencedHeaderGlobals=localSourceFiles.filter(file=>/\.(?:h|hh|hpp)$/.test(file)).map(file=>namespaceGlobalDefinitions(stripRackUiBlocks(flattenExternCWrappers(sourceWithoutIncludes(stripHeaderGuardOpen(fs.readFileSync(file,"utf8"))))),rawAnalysisSource)).filter(Boolean),globalEnumDeclarations=referencedGlobalEnumDeclarations(localSourceFiles,rawAnalysisSource),dependencyAnalysisSource=[...globalEnumDeclarations,...referencedHeaderGlobals,allBases.join("\n"),rawAnalysisSource,registration.moduleClass].join("\n"),vendoredDependencies=vendoredDependencyBundleForAdapter(sourceDir,definition.file,sourceFiles),dependencyBundle=browserAsset&&!["earlevel-wavetable","octobir-ir-pair","midi-file"].includes(browserAsset.mode)?{source:"",files:[],implementationFiles:browserAssetImplementationFiles(sourceDir,browserAsset)}:vendoredDependencies??referencedDependencyBundleForAdapter(sourceFiles,dependencyAnalysisSource,new Set([definition.file]),sourceDir),implementationGlobalReference=[dependencyBundle.source,rawAnalysisSource].join("\n"),referencedImplementationGlobals=localSourceFiles.filter(file=>/\.(?:c|cc|cpp|cxx)$/.test(file)&&file!==definition.file&&!(target.key==="PathSet/IceTray"&&path.basename(file)==="pffft.c")).map(file=>namespaceGlobalDefinitions(fs.readFileSync(file,"utf8"),implementationGlobalReference,[],implementationGlobalReference)).filter(Boolean),globalEnumPrelude=globalEnumDeclarations.filter(declaration=>!dependencyBundle.source.includes(declaration)).join("\n\n"),externalPrelude=[embeddedJsonAssetPrelude(sourceDir,embeddedJsonAssets),embeddedMidiAssetPrelude(sourceDir,embeddedMidiAssets),embeddedBinaryAssetPrelude(sourceDir,embeddedBinaryAssets),browserAssetDependencyPrelude(browserAsset?definition.source:"",browserAsset),externalDependencyPrelude(sourceDir,definition.source,sourceFiles),...standardDependencyIncludes(definition.registrationSource),...inherited.flatMap(item=>item.source?externalDependencyPrelude(sourceDir,item.source,sourceFiles):[])].filter(Boolean).join("\n"),rackDspUsingPrelude=sourceFiles.some(file=>{const source=fs.readFileSync(file,"utf8");return rustNamespaceUsingDirectives(file,source).some(candidate=>candidate.target==="rack::dsp")})?"using namespace rack::dsp;":"",pluginGlobals=referencedPluginGlobalParts(sourceDir,[dependencyBundle.source,globalEnumPrelude,rawAnalysisSource].join("\n")),macroDefines=referencedDefinesWithoutPluginGlobals(rootSourceFiles,[dependencyBundle.source,globalEnumPrelude,...referencedImplementationGlobals,...referencedHeaderGlobals,body,rawAnalysisSource,pluginGlobals.declarations,pluginGlobals.implementations].join("\n"),sourceDir),defines=[macroDefines,pluginGlobals.declarations].filter(Boolean).join("\n\n"),prelude=[defines,rackDspUsingPrelude,externalPrelude,...referencedImplementationGlobals,dependencyBundle.source,globalEnumPrelude,pluginGlobals.implementations,secondaryInterfaces,localPlainStructs,analysisPrelude].filter(Boolean).join("\n\n"),analysisSource=[defines,...referencedImplementationGlobals,dependencyBundle.source,globalEnumPrelude,pluginGlobals.implementations,rawAnalysisSource].filter(Boolean).join("\n"),jsonFunctions=[...analysisSource.matchAll(/\b(json_[A-Za-z0-9_]+)\s*\(/g)].filter(match=>isCodePosition(analysisSource,match.index)).map(match=>match[1]),directBase=allBases[0],targetMemberConstants=rackWebMemberArrayConstants(body,baseTypeName(registration.moduleClass)),constantOverrides={...targetMemberConstants,...fxConfigConstants(sourceFiles,registration.moduleClass),...(template?.constants??{})},globalConstants=numericConstants(analysisSource,constantOverrides),constants=numericConstants(body,{...globalConstants,...constantOverrides},baseTypeName(registration.moduleClass)),configuredSource=[configSource,...inheritedSource].join("\n"),directConfigCalls=name=>rustDirectConfigCalls(configuredSource,name,constants),configured=directConfigCalls("venomConfig")[0]??directConfigCalls("config")[0],configuredIds=configured?splitArguments(configured):[],configuredCountValues=rackWebIntegers([0,1,2,3].map(index=>configuredIds[index]??""),constants),configuredCounts=Object.fromEntries([["params",0],["inputs",1],["outputs",2],["lights",3]].flatMap(([key,index])=>{const value=configuredCountValues[index];return Number.isSafeInteger(value)&&value>=0?[[key,value]]:[]})),classIncludeSource=includedClassSource(definition.file,body),resolveEnum=(names,index)=>enumInfo(body,names)??enumInfo(classIncludeSource,names)??enumInfoByQualifiedAlias(analysisSource,configuredIds[index])??enumInfo(analysisSource,names)??enumInfoByTerminal(classIncludeSource,configuredIds[index])??enumInfoByTerminal(analysisSource,configuredIds[index]),objectExpander=objectExpanderContract(analysisSource,dependencyBody,directBase,definition.namespace),messageExpander=usesMessageExpander(rawAnalysisSource)?messageExpanderContract(rawAnalysisSource,target,manifest):null,runtimeFeatureSource=[dependencyBody,...implementations,...inherited.filter(item=>!item.missing).flatMap(item=>[item.analysisBody??item.body,...item.implementations]),secondaryInterfaces,localPlainStructs,...referencedImplementationGlobals,dependencyBundle.source,pluginGlobals.implementations].join("\n"),detectedFeatures=features(runtimeFeatureSource).filter(feature=>feature!=="expanders"||Boolean(objectExpander??messageExpander));if(process.env.RACK_WEB_DEBUG_DEPENDENCIES)console.error(JSON.stringify({rootSourceFiles:rootSourceFiles.map(file=>path.relative(sourceDir,file)),sourceFiles:sourceFiles.map(file=>path.relative(sourceDir,file))},null,2));
  if(target.key==="ParableInstruments/Neil"){
    const neilImplementationFiles=[
      "parasites/clouds/dsp/correlator.cc",
      "parasites/clouds/dsp/granular_processor.cc",
      "parasites/clouds/dsp/mu_law.cc",
      "parasites/clouds/dsp/pvoc/frame_transformation.cc",
      "parasites/clouds/dsp/pvoc/phase_vocoder.cc",
      "parasites/clouds/dsp/pvoc/stft.cc",
      "parasites/clouds/resources.cc",
    ].map(relative=>path.join(sourceDir,relative));
    dependencyBundle.files=[...new Set([...(dependencyBundle.files??[]),...neilImplementationFiles])];
    dependencyBundle.implementationFiles=[...new Set([...(dependencyBundle.implementationFiles??[]),...neilImplementationFiles])];
  }
  if(target.key==="PinkTrombone/PinkTrombone"){
    const pinkTromboneImplementationFiles=["Biquad.cpp","Glottis.cpp","Tract.cpp","WhiteNoise.cpp","noise.cpp"]
      .map(file=>path.join(sourceDir,"src","PinkTrombone",file));
    dependencyBundle.files=[...new Set([...(dependencyBundle.files??[]),...pinkTromboneImplementationFiles])];
    dependencyBundle.implementationFiles=[...new Set(pinkTromboneImplementationFiles)];
  }
  const directlyIncludedHeaderFiles=new Set(rustSourceDeclarations(prelude).includeDirectives.flatMap(candidate=>{const normalized=candidate.include.split(/[\\/]+/).join(path.sep),absolute=path.isAbsolute(normalized)?path.resolve(normalized):null,suffix=`${path.sep}${normalized}`;return localSourceFiles.filter(file=>(absolute!==null&&file===absolute)||file.endsWith(suffix)||(!normalized.includes(path.sep)&&path.basename(file)===normalized))}));
  const inlineHeaderFunctions=localSourceFiles
    .filter(file=>/\.(?:h|hh|hpp)$/.test(file)&&!directlyIncludedHeaderFiles.has(file))
    .flatMap(file=>referencedLocalFreeFunctionDefinitions(
      flattenExternCWrappers(sourceWithoutIncludes(stripHeaderGuardOpen(fs.readFileSync(file,"utf8")))),
      [prelude,body,...implementations,...inheritedSource].join("\n")
    ));
  if(process.env.RACK_WEB_DEBUG_DEPENDENCIES&&inlineHeaderFunctions.length)console.error(JSON.stringify({inlineHeaderFunctions:inlineHeaderFunctions.flatMap(value=>rustSourceFreeFunctionDefinitions(value).map(candidate=>freeFunctionForwardDeclaration(candidate)))},null,2));
  if(inlineHeaderFunctions.length){
    prelude=[...inlineHeaderFunctions,prelude].filter(Boolean).join("\n\n");
    analysisSource=[...inlineHeaderFunctions,analysisSource].filter(Boolean).join("\n\n");
    runtimeFeatureSource=[...inlineHeaderFunctions,runtimeFeatureSource].filter(Boolean).join("\n\n");
  }
  if(browserAsset?.mode==="octobir-ir-pair"){
    prelude=adaptOctobirBrowserPrelude(prelude);
    implementations.push(octobirBrowserImplementations());
  }
  const specializationDeclarations=explicitSpecializationForwardDeclarations(implementations);
  if(process.env.RACK_WEB_DEBUG_DEPENDENCIES&&specializationDeclarations.length)console.error(JSON.stringify({specializationDeclarations},null,2));
  if(specializationDeclarations.length){
    prelude=[prelude,...specializationDeclarations].filter(Boolean).join("\n\n");
    analysisSource=[...specializationDeclarations,analysisSource].filter(Boolean).join("\n\n");
  }
  const supplementalExternGlobals=referencedExternGlobalDefinitions(rootSourceFiles,`${rawAnalysisSource}\n${dependencyBundle.source}`,prelude);
  if(supplementalExternGlobals.length){
    prelude=[...supplementalExternGlobals,prelude].filter(Boolean).join("\n\n");
    analysisSource=[...supplementalExternGlobals,analysisSource].filter(Boolean).join("\n\n");
    runtimeFeatureSource=[...supplementalExternGlobals,runtimeFeatureSource].filter(Boolean).join("\n\n");
  }
  const fallbackDependencyBundle=lockedFallbackDependencyBundleForAdapter(sourceFiles,definition.source);
  if(fallbackDependencyBundle){
    dependencyBundle.files=[...new Set([...(dependencyBundle.files??[]),...fallbackDependencyBundle.files])];
    dependencyBundle.implementationFiles=[...new Set([...(dependencyBundle.implementationFiles??[]),...fallbackDependencyBundle.implementationFiles])];
  }
  if(target.key==="KautenjaDSP-RackNES/RackNES"){
    dependencyBundle.implementationFiles=files(path.join(sourceDir,"src","nes"))
      .filter(file=>/\.(?:c|cc|cpp|cxx)$/.test(file));
    const base64Implementation=path.join(sourceDir,"src","base64.cpp");
    if(fs.existsSync(base64Implementation))dependencyBundle.implementationFiles.push(base64Implementation);
  }
  if(browserIsolatedLeviathan.has(target.key)){
    dependencyBundle.implementationFiles=(dependencyBundle.implementationFiles??[]).filter(file=>!/[/\\](?:DebugTerminalTransport|NvgGraphicsLifecycle)\.cpp$/.test(file));
  }
  if(target.key==="Leviathan/Undertow"||target.key==="Leviathan/TemporalDeck"||target.key==="Leviathan/TDScope"){
    dependencyBundle.files=[];
    dependencyBundle.implementationFiles=[];
  }
  const executableFeatureSource=[dependencyBody,...implementations,...inherited.filter(item=>!item.missing).flatMap(item=>[item.analysisBody??item.body,...item.implementations]),secondaryInterfaces,localPlainStructs,pluginGlobals.implementations].join("\n");
  if(process.env.RACK_WEB_DEBUG_CONSTANTS)console.error(JSON.stringify({memberArrayConstants:Object.fromEntries(Object.entries(constants).filter(([name])=>/\.size\(\)|\]\.name$/.test(name))),constantOverrides,configuredCounts,inherited:inherited.map(item=>({name:item.name,actualType:item.actualType,analysisBody:item.analysisBody}))},null,2));
  detectedFeatures.splice(0,detectedFeatures.length,...features(executableFeatureSource).filter(feature=>feature!=="expanders"||Boolean(objectExpander??messageExpander)));
  const rawDefinitionSource=fs.readFileSync(definition.file,"utf8"),targetSourceFreeFunctions=referencedLocalFreeFunctionDefinitions(rawDefinitionSource,[body,...inheritedSource].join("\n"),definition.file).map(value=>adaptEmbeddedBinaryAssetLoads(adaptEmbeddedMidiAssetLoads(adaptEmbeddedJsonAssetLoads(value,embeddedJsonAssets),embeddedMidiAssets),embeddedBinaryAssets)),targetSourceFreeFunctionGlobals=namespaceGlobalDefinitions(rawDefinitionSource,targetSourceFreeFunctions.join("\n"),[],"",definition.file);
  let translationUnitGlobals=adaptEmbeddedBinaryAssetLoads(adaptEmbeddedMidiAssetLoads(adaptEmbeddedJsonAssetLoads(namespaceGlobalDefinitions(definition.source,[body,...implementations,...inheritedSource].join("\n"),definition.namespace??[]),embeddedJsonAssets),embeddedMidiAssets),embeddedBinaryAssets);
  const targetNamespaceGlobals=exactNamespaceGlobalDefinitions(definition.source,body,definition.namespace??[]);
  for(const definition of targetNamespaceGlobals)translationUnitGlobals=translationUnitGlobals.replace(definition,"");
  if(process.env.RACK_WEB_DEBUG_FEATURES)console.error(runtimeFeatureSource.split("\n").filter(line=>/\b(?:asset|system)::/.test(line)).join("\n"));
  for(const helper of paramQuantityHelpers(rawModulePreludeSource,body)){const preferredSource=fs.readFileSync(definition.file,"utf8"),preferredImplementations=rawOutOfLineDefinitions(definition.file,preferredSource,helper.name,true).filter(value=>!rackUiPattern.test(value)),implementationFiles=preferredImplementations.length?[definition.file]:activeRootSourceFiles;for(const file of implementationFiles)for(const implementation of(file===definition.file?preferredImplementations:rawOutOfLineDefinitions(file,fs.readFileSync(file,"utf8"),helper.name,true).filter(value=>!rackUiPattern.test(value))))if(!implementations.includes(implementation))implementations.push(implementation)}
  if(process.env.RACK_WEB_DEBUG_DEPENDENCIES&&translationUnitGlobals)console.error(JSON.stringify({translationUnitGlobals},null,2));
  for(const base of secondaryBases)for(const file of rootSourceFiles)for(const definition of rawOutOfLineDefinitions(file,fs.readFileSync(file,"utf8"),base).filter(value=>!rackUiPattern.test(value)))if(!implementations.includes(definition))implementations.push(definition);
  const portableSurgeHost=portableSurgeHostForTarget(target,body,inherited),fullSurgeHost=fullSurgeHostContract(target,body,inherited);if(portableSurgeHost)dependencyBundle.implementationFiles=[];
  const stateAnalysisSource=preprocessMacroSource(portableSurgeHost?body:analysisSource,registration.macros??new Map()).source,detectedStateKeys=jsonStateKeys(stateAnalysisSource,template?.constants);if(portableSurgeHost&&/\bclockProc\.toJson\s*\(/.test(body)&&!detectedStateKeys.some(item=>item.key==="clockStyle"))detectedStateKeys.push({key:"clockStyle",type:"integer"});if(target.plugin==="Minilab3")detectedStateKeys.length=0;
  const moduleSourceRoot=path.dirname(path.dirname(definition.file)),detectedPanelWidth=panelWidth(sourceDir,target.model,registration.widgetClass)??(moduleSourceRoot!==sourceDir?panelWidth(moduleSourceRoot,target.model,registration.widgetClass):null),detected={template,constants,counts:configuredCounts,panelWidth:detectedPanelWidth,namespace:definition.namespace,expander:objectExpander??messageExpander,browserAsset,prelude:Boolean(modulePreludeSource),defines:Boolean(defines),dependencyFiles:dependencyBundle.files.map(file=>path.relative(sourceDir,file)),outOfLineDefinitions:implementations.length,inheritance:{directBase:directBase??null,secondaryBases,chain:inherited.map(item=>({name:item.name,base:item.base??null,missing:Boolean(item.missing)}))},enums:{params:resolveEnum(["ParamIds","ParamsIds","ParamId"],0),inputs:resolveEnum(["InputIds","InputsIds","InputId"],1),outputs:resolveEnum(["OutputIds","OutputsIds","OutputId"],2),lights:resolveEnum(["LightIds","LightsIds","LightId"],3)},config:{params:[],switches:[],buttons:[],snaps:[],inputs:[],outputs:[],bypass:[]},features:detectedFeatures,stateKeys:detectedStateKeys,includes:[...new Set([...rustSourceDeclarations(definition.source).includeDirectives.map(candidate=>candidate.include),...rawIncludes(registration.file,definition.registrationSource)])],...(portableSurgeHost?{hostAdapter:"surge-dsp-only"}:{})};
  const normalizeMenuCall=call=>{const values=splitArguments(call);if(values.length>=5)return values.slice(0,5).join(", ");if(values.length<3)return call;const options=/^\s*\{([\s\S]*)\}\s*$/.exec(values[3]??""),maximum=options?Math.max(0,splitArguments(options[1]).length-1):1;return`${values[0]}, 0, ${maximum}, ${values[1]}, ${values[2]}`},directOnOff=[...directConfigCalls("configOnOff"),...directConfigCalls("configOnOffNoRand")].map(call=>{const values=splitArguments(call);return`${values[0]}, 0, 1, ${values[1]}, ${values[2]}`});
  detected.config.params=[...directConfigCalls("configParam"),...directConfigCalls("configParamNoRand"),...directConfigCalls("configMenuParam").map(normalizeMenuCall)];
  detected.config.switches=[...directConfigCalls("configSwitch"),...directOnOff];
  detected.config.buttons=directConfigCalls("configButton");
  detected.config.snaps=directConfigCalls("rackWebSnapParam");
  detected.config.inputs=directConfigCalls("configInput");
  detected.config.outputs=directConfigCalls("configOutput");
  detected.config.bypass=directConfigCalls("configBypass");
  const moduleEnumScope=[...(definition.typeDeclaration?.namespace??definition.namespace??[]),...(definition.typeDeclaration?.owners??[]).map(owner=>owner.name),baseTypeName(registration.moduleClass)];
  for(const [kind,names] of Object.entries({params:["ParamIds","ParamsIds","ParamId"],inputs:["InputIds","InputsIds","InputId"],outputs:["OutputIds","OutputsIds","OutputId"],lights:["LightIds","LightsIds","LightId"]})){
    const rustEnum=rustEnumInfo(definition.file,names,[moduleEnumScope]);if(!rustEnum)continue;
    detected.enums[kind]=rustEnum;
  }
  const explicitCountKinds=new Set(Object.keys(configuredCounts)),targetGlobalEnumDeclarations=[];
  for(const [kind,names] of Object.entries({params:["ParamIds","ParamsIds","ParamId"],inputs:["InputIds","InputsIds","InputId"],outputs:["OutputIds","OutputsIds","OutputId"],lights:["LightIds","LightsIds","LightId"]})){
    if(enumInfo(body,names))continue;
    const targetGlobalEnum=rustEnumRecord(definition.file,names,[definition.namespace??[]])??enumRecordInNamespace(definition.source,names,definition.namespace??[]);
    if(targetGlobalEnum){
      detected.enums[kind]=targetGlobalEnum.info;
      const declaration=targetGlobalEnum.declaration;
      if(declaration&&!targetGlobalEnumDeclarations.includes(declaration))targetGlobalEnumDeclarations.push(declaration);
    }
  }
  Object.defineProperty(detected,"targetGlobalEnumDeclarations",{value:targetGlobalEnumDeclarations});
  Object.defineProperty(detected,"targetNamespaceGlobals",{value:targetNamespaceGlobals});
  Object.defineProperty(detected,"targetSourceFreeFunctionSupport",{value:[targetSourceFreeFunctionGlobals,...targetSourceFreeFunctions].filter(Boolean)});
  for(const kind of ["params","inputs","outputs","lights"]){const count=enumCount(detected.enums[kind],constants);if(detected.counts[kind]===undefined&&detected.enums[kind]&&Number.isSafeInteger(count)&&count>=0)detected.counts[kind]=count}
  if(target.key==="ParableInstruments/Neil"){
    Object.assign(constants,{REVERSE_PARAM:11,NUM_PARAMS:12,REVERSE_LIGHT:1,NUM_LIGHTS:2});
    detected.counts.params=12;
    detected.counts.lights=2;
    explicitCountKinds.add("params");explicitCountKinds.add("lights");
    for(const [kind,identifier,numIdentifier] of [["params","REVERSE_PARAM","NUM_PARAMS"],["lights","REVERSE_LIGHT","NUM_LIGHTS"]]){
      const identifiers=detected.enums[kind]?.identifiers;
      if(!identifiers||identifiers.includes(identifier))continue;
      const numIndex=identifiers.indexOf(numIdentifier);
      identifiers.splice(numIndex<0?identifiers.length:numIndex,0,identifier);
    }
    if(!detected.config.params.some(call=>/\bREVERSE_PARAM\b/.test(call)))
      detected.config.params.push('Clouds::REVERSE_PARAM, 0.0, 1.0, 0.0, "Reverse"');
  }
  const restrictConfigToTargetEnum=(groups,enumKind,count)=>{if(!Number.isSafeInteger(count)||count<0)return;const identifiers=(detected.enums[enumKind]?.identifiers??[]).filter(identifier=>typeof identifier==="string"&&!/^NUM_/.test(identifier)),allowed=new Set(identifiers),seen=new Set,selected=Object.fromEntries(groups.map(group=>[group,[]]));for(const group of groups)for(const call of detected.config[group]??[]){const first=splitArguments(call)[0]?.trim()??"",identifier=/([A-Za-z_]\w*)\s*(?:\[[^\]]*\])?\s*$/.exec(first)?.[1];if(!identifier||!allowed.has(identifier)||seen.has(identifier))continue;seen.add(identifier);selected[group].push(call)}if(seen.size!==count)return;for(const group of groups)detected.config[group]=selected[group]};
  restrictConfigToTargetEnum(["params","switches","buttons"],"params",detected.counts.params);
  restrictConfigToTargetEnum(["inputs"],"inputs",detected.counts.inputs);
  restrictConfigToTargetEnum(["outputs"],"outputs",detected.counts.outputs);
  if(target.key==="LyraeModules/Vega"){
    detected.expander={
      transport:"message-buffer",
      direction:"both",
      capacity:16384,
      models:[{key:"LyraeModules/BD383238",symbol:"modelBD383238",index:0}],
    };
    if(!detected.features.includes("expanders"))detected.features.push("expanders");
  }
  if(target.key==="DelexanderVol1/Algomorph"){
    Object.assign(constants,{
      "AuxSourceModes::NUM_MODES":5,
      "AuxKnobModes::MORPH":0,
      "AuxKnobModes::MORPH_ATTEN":1,
      "AuxKnobModes::CLICK_FILTER":2,
      "AuxKnobModes::DOUBLE_MORPH":3,
      "AuxKnobModes::TRIPLE_MORPH":4,
      "AuxKnobModes::SUM_GAIN":5,
      "AuxKnobModes::MOD_GAIN":6,
      "AuxKnobModes::OP_GAIN":7,
      "AuxKnobModes::UNI_MORPH":8,
      "AuxKnobModes::ENDLESS_MORPH":9,
      "AuxKnobModes::DOUBLE_MORPH_ATTEN":10,
      "AuxKnobModes::TRIPLE_MORPH_ATTEN":11,
      "AuxKnobModes::WILDCARD_MOD_GAIN":12,
      "AuxKnobModes::NUM_MODES":13,
      NUM_PARAMS:27,
    });
    detected.counts.params=27;
    explicitCountKinds.add("params");
  }
  if(target.plugin==="DelexanderVol1"&&target.model.startsWith("Algomorph")){
    const stateDefaults={"Config Mode":-1,"Config Scene":1,"Current Scene":1,"Reset Scene":1,"CCW Scene Selection":1,"Click Filter Enabled":1,"VU Lights":1,"Aux Knob Mode":1,"Mod Gain":1,"Morph CV 1 Multiplier":1,"Morph CV 2 Multiplier":2};
    detected.stateKeys=detected.stateKeys.map(item=>Object.hasOwn(stateDefaults,item.key)?{...item,default:stateDefaults[item.key]}:item);
    for(const key of ["Algorithms: Algorithm IDs","Algorithms: Horizontal Marks","Algorithms: Forced Carriers"])for(let scene=0;scene<3;scene++)detected.stateKeys.push({key,path:[scene,`Algorithm ${scene}`],type:"integer",default:0});
  }
  if(target.key==="Edge/WCO_Osc")detected.stateKeys=detected.stateKeys.map(item=>item.key==="lfo_range"?{...item,name:"LFO Voltage Range",default:0,values:["Bipolar -5V to 5V","Unipolar 0V to 10V"]}:item);
  if(target.key==="Edge/K_Rush")detected.stateKeys=detected.stateKeys.map(item=>item.key==="first_alg"?{...item,name:"Algorithm",default:1,values:["Second","First"]}:item);
  if(target.plugin==="Sparkette"&&(detected.expander?.models??[]).length){
    const utilityImplementation=path.join(sourceDir,"src","Utility.cpp");
    const utilityAlreadyEmbedded=[prelude,body,...implementations].some(value=>/\bfillAddressArray\s*\([^;{}]*\)\s*\{/.test(value));
    if(!utilityAlreadyEmbedded&&fs.existsSync(utilityImplementation))dependencyBundle.implementationFiles=[...new Set([...(dependencyBundle.implementationFiles??[]),utilityImplementation])];
  }
  const r8libHeader=path.join(sourceDir,"lib","r8lib","r8lib.h"),r8libImplementation=path.join(sourceDir,"lib","r8lib","r8lib.cpp");
  if(dependencyBundle.files.some(file=>path.basename(file)==="matrix_exponential.h")&&fs.existsSync(r8libHeader)&&fs.existsSync(r8libImplementation)){
    dependencyBundle.source=(dependencyBundle.source??"").replace(
      '#include "r8lib/r8lib.h"',
      '#define string std::string\n#include "r8lib/r8lib.h"\n#undef string'
    );
    dependencyBundle.files=[...new Set([...(dependencyBundle.files??[]),r8libHeader,r8libImplementation])];
    dependencyBundle.implementationFiles=[...new Set([...(dependencyBundle.implementationFiles??[]),r8libImplementation])];
  }
  if(target.plugin==="Cella"&&["LoudnessMeter","Loud"].includes(target.model)){
    const eburDirectory=path.join(sourceDir,"deps","ebur128"),eburHeader=path.join(eburDirectory,"ebur128.h"),eburImplementation=path.join(eburDirectory,"ebur128.c"),queueHeader=path.join(eburDirectory,"queue","sys","queue.h");
    if(fs.existsSync(eburHeader)&&fs.existsSync(eburImplementation)&&fs.existsSync(queueHeader)){
      dependencyBundle.source=`#include "ebur128.h"
static rack::plugin::Model rackWebCellaLoudModel;
static rack::plugin::Model rackWebCellaLoudnessMeterModel;
static rack::plugin::Model* modelLoud = &rackWebCellaLoudModel;
static rack::plugin::Model* modelLoudnessMeter = &rackWebCellaLoudnessMeterModel;
${dependencyBundle.source??""}`;
      dependencyBundle.files=[...new Set([...(dependencyBundle.files??[]),eburHeader,eburImplementation,queueHeader])];
      dependencyBundle.implementationFiles=[...new Set([...(dependencyBundle.implementationFiles??[]),eburImplementation])];
    }
  }
  if(translationUnitGlobals)implementations.unshift(translationUnitGlobals);
  if(target.key.startsWith("Biset/Biset-Tracker"))detected.features=detected.features.filter(feature=>feature!=="assets"&&feature!=="filesystem");
  if(target.key==="Biset/Biset-Blank")detected.features=detected.features.filter(feature=>feature!=="assets"&&feature!=="rack-app");
  if(target.key==="Airwin2Rack/Airwin2Rack"){
    const effectNames=airwinRegistryEntries(sourceDir).filter(entry=>entry.accepted).map(entry=>entry.name);
    detected.stateKeys=[{key:"airwindowSelectedFX",type:"string-enum",values:effectNames},...detected.stateKeys.filter(item=>item.key!=="airwindowSelectedFX")];
  }
  if(target.key==="CatroModulo/CatroModulo_CM-3")detected.stateKeys=Array.from({length:64},(_,index)=>({index,key:"recorder",type:"real"}));
  if(target.key==="CatroModulo/CatroModulo_CM-9")detected.stateKeys=[{index:0,key:"opmode",type:"integer"}];
  if(target.key==="Cella/CognitiveShift")detected.stateKeys=[...Array.from({length:8},(_,index)=>({index,key:"values",type:"boolean"})),...detected.stateKeys.filter(item=>item.key!=="values")];
  if(target.key==="Chinenual-VCV/MIDIRecorderCC")detected.stateKeys=Array.from({length:5},(_,index)=>[
    {key:"ccConfig",path:[index,"cc"],type:"integer"},
    {key:"ccConfig",path:[index,"is14bit"],type:"boolean"},
    {key:"ccConfig",path:[index,"range"],type:"integer"},
  ]).flat();
  if(target.key==="Chinenual-VCV/MIDIRecorder"){
    detected.features=detected.features.filter(feature=>feature!=="filesystem");
    const ranges=["-10 to 10","0 to 10","-5 to 5","0 to 5","-3 to 3","0 to 3","-1 to 1","0 to 1"];
    detected.stateKeys=[
      {key:"incrementPath",type:"boolean",name:"Append -001, -002, etc.",default:1,contextOnly:true},
      {key:"alignToFirstNote",type:"boolean",name:"Start at first note gate",default:1,contextOnly:true},
      {key:"cvConfigVel",type:"integer",values:ranges,name:"VEL Input Range",default:1,contextOnly:true},
      {key:"cvConfigAft",type:"integer",values:ranges,name:"AFT Input Range",default:1,contextOnly:true},
      {key:"cvConfigPw",type:"integer",values:ranges,name:"PW Input Range",default:2,contextOnly:true},
      {key:"cvConfigMw",type:"integer",values:ranges,name:"MW Input Range",default:1,contextOnly:true},
      {key:"mwIs14bit",type:"boolean",name:"MW is 14-bit",default:0,contextOnly:true},
    ];
  }
  if(target.key==="Chinenual-VCV/DrumMap")detected.stateKeys=Array.from({length:12},(_,index)=>({index,key:"map",type:"integer"}));
  if(target.model.startsWith("SurgeXTFX")){
    const fxPortConfigSource=fxSpecializationRoots.map(file=>fs.readFileSync(file,"utf8")).join("\n");
    const fxConfigCalls=name=>rustSourceConfigCalls(fxPortConfigSource,name,constants);
    detected.config.inputs.push(...fxConfigCalls("configInput"));
    detected.config.outputs.push(...fxConfigCalls("configOutput"));
  }
  if(target.key==="DanTSynth/AOCR")detected.stateKeys=[];
  if(target.key==="Leviathan/Undertow")detected.stateKeys=detected.stateKeys.filter(state=>state.key!=="shapeEdgeHardness");
  if(target.key==="HoyerHoppes/scanning_frequency_division_osc_poly")detected.stateKeys=[];
  if(target.key==="HetrickCVGPL/PhasorWavetable")detected.panelWidth=105;
  detected.triggerParamBases=[...new Set([...analysisSource.matchAll(/\b[A-Za-z_]\w*(?:\s*\[[^\]]+\])?\.process(?:Event)?\s*\([^\n;]*?params\s*\[\s*([^\]]+)\]/g)].map(match=>/[A-Za-z_]\w*/.exec(match[1])?.[0]).filter(Boolean))];
  if(configuredIds.length===3&&!detected.enums.lights){detected.counts.lights=0;explicitCountKinds.add("lights")}
  const portEnumLayouts=rackWebPortLayouts(detected.enums,constants);
  Object.defineProperty(detected,"portEnumLayouts",{value:portEnumLayouts});
  for(const kind of ["params","inputs","outputs","lights"]){const layout=portEnumLayouts[kind];if(!explicitCountKinds.has(kind)&&layout&&Number.isSafeInteger(layout.count)&&layout.count>=0)detected.counts[kind]=layout.count}
  const widgetName=baseTypeName(registration.widgetClass),widgetConstructorPattern=new RegExp(`\\b${widgetName.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*::\\s*${widgetName.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*\\(`),widgetDirectory=path.dirname(registration.file),siblingWidgetFiles=rootSourceFiles.filter(file=>path.dirname(file)===widgetDirectory&&/Widget\.(?:cc|cpp|cxx)$/.test(path.basename(file))),widgetRoots=[registration.file,...siblingWidgetFiles,...rootSourceFiles.filter(file=>widgetConstructorPattern.test(fs.readFileSync(file,"utf8"))) ],widgetFiles=[...new Set(widgetRoots.flatMap(file=>widgetSupportFiles(sourceDir,file)))],widgetImplementationSource=widgetRoots.filter(file=>file!==registration.file).map(file=>fs.readFileSync(file,"utf8")).join("\n"),inheritedWidgetSource=widgetInheritanceSource(widgetFiles,registration.widgetClass);Object.defineProperty(detected,"sourceFiles",{value:sourceFiles});Object.defineProperty(detected,"widgetSource",{value:`${inheritedWidgetSource}\n${definition.source}\n${definition.registrationSource}\n${widgetImplementationSource}`});Object.defineProperty(detected,"widgetConstants",{value:widgetSourceConstants(widgetFiles)});Object.defineProperty(detected,"widgetSupportSource",{value:[widgetFiles.filter(file=>file!==registration.file).map(file=>fs.readFileSync(file,"utf8")).join("\n"),widgetCoordinateHelperSource(rootSourceFiles)].filter(Boolean).join("\n")});
  Object.defineProperty(detected,"rootSourceFiles",{value:rootSourceFiles});
  Object.defineProperty(detected,"uiPointerNames",{value:[...new Set(nativeUiPointerMembers(body,includedDeclarationSource).map(member=>member.name))]});
  const countFor=kind=>detected.counts?.[kind]??enumCount(detected.enums[kind],constants),visualOnly=["params","inputs","outputs"].every(kind=>countFor(kind)===0);
  const supportedJson=new Set(["json_object","json_object_set","json_object_set_new","json_object_get","json_object_update","json_object_foreach","json_array","json_array_insert_new","json_array_set_new","json_array_append_new","json_array_append","json_array_get","json_array_size","json_array_foreach","json_is_array","json_is_object","json_is_string","json_is_integer","json_is_real","json_is_number","json_is_boolean","json_is_null","json_integer","json_integer_value","json_real","json_real_value","json_number_value","json_boolean","json_boolean_value","json_bool_value","json_is_true","json_is_false","json_string","json_stringn","json_string_value","json_typeof","json_pack","json_unpack","json_loads","json_loadf","json_dumps","json_dumpf","json_null","json_true","json_false","json_bool","json_incref","json_decref","json_deep_copy"]),
    unsupportedJson=[...new Set(jsonFunctions.filter(name=>!supportedJson.has(name)&&outOfLineFreeFunctionDefinitions(analysisSource,name).length===0))],
    simdSymbols=[...new Set([...analysisSource.matchAll(/\bsimd::([A-Za-z0-9_]+)/g)].map(match=>match[1]).concat(/\bfloat_4\b/.test(analysisSource)?["float_4"]:[]))],
    supportedSimd=new Set(["float_4","int32_4","fmax","fmin","clamp","fabs","abs","arg","fmod","sqrt","pow","exp","log","log2","log10","sin","cos","tan","atan","atan2","round","floor","ceil","hypot","rcp","trunc","ifelse","sgn","crossfade","rescale","andnot","movemask","movemaskInverse"]),
    localSimdTypes=new Set(declaredTypeNames(analysisSource)),
    unsupportedSimd=simdSymbols.filter(name=>!supportedSimd.has(name)&&!localSimdTypes.has(name)),
    lightsCompatible=countFor("lights")!==undefined||!/\blights\s*\[/.test(analysisSource),
    appAnalysisSource=sourceWithoutComments(analysisSource),
    appTargets=[...new Set([...appAnalysisSource.matchAll(/\bAPP\s*->\s*([A-Za-z_]\w*)/g)].map(match=>match[1]))],
    windowCompatible=!/\bAPP\s*->\s*window\s*->\s*(?!getMods\s*\()/.test(appAnalysisSource),
    rackAppCompatible=appTargets.every(name=>name==="engine"||name==="history"||(name==="window"&&windowCompatible)),
    assetFreeSurgeOscillator=/\bVCOConfig\s*<\s*oscType\s*>\s*::\s*requiresWavetables\s*\(\s*\)/.test(body),
    dailyFortuneHost=/\bnextFortuneValue\b/.test(analysisSource),
    browserVisualExpander=target.key==="Ahornberg/TapeInspector",
    assetsCompatible=!detected.features.includes("assets")||portableSurgeHost||fullSurgeHost||assetFreeSurgeOscillator||target.model==="SurgeXTLFO"||target.key==="DanTSynth/AOCR"||target.key==="Edge/WCO_Osc"||target.key==="EH_modules/FV-1emu"||target.key==="Leviathan/Undertow"||target.key==="Leviathan/TemporalDeck"||target.key==="Leviathan/TDScope"||target.key==="ML_modules/TrigBuf"||Boolean(browserAsset)||Boolean(embeddedJsonAssets.length)||Boolean(embeddedMidiAssets.length)||Boolean(embeddedBinaryAssets.length)||browserVisualExpander||dailyFortuneHost,
    blockedFeatures=new Set(["filesystem","network","dynamic-linking"]),blockedUsed=detected.features.filter(feature=>blockedFeatures.has(feature)&&target.key!=="Leviathan/Undertow"&&target.key!=="Leviathan/TemporalDeck"&&target.key!=="Leviathan/TDScope"&&!(feature==="filesystem"&&(browserAsset||embeddedBinaryAssets.length||browserVisualExpander||dailyFortuneHost||target.key==="EH_modules/FV-1emu"))),
    expanderOnly=[directBase,...inherited.map(item=>item.name)].some(name=>/Expander/i.test(String(name))),
    expanderCompatible=!detected.features.includes("expanders")||Boolean(detected.expander)||visualOnly||(!expanderOnly&&countFor("outputs")>0),
    missingBase=inherited.find(item=>item.missing),rootBase=inherited.find(item=>!item.missing)?.base,
    inheritanceCompatible=rackModuleBase(directBase)||(inherited.length>0&&!missingBase&&rackModuleBase(rootBase)),blockers=[];
  if(!inheritanceCompatible)blockers.push({kind:"module-base",detail:missingBase?`Could not locate custom module base ${missingBase.name}`:`${registration.moduleClass} inheritance does not reach Rack Module`});
  for(const kind of ["params","inputs","outputs"])if(countFor(kind)===undefined)blockers.push({kind:"missing-enum",detail:`No ${kind} enum or config() count was found`});
  if(!lightsCompatible)blockers.push({kind:"lights",detail:"Module uses lights[] without a light enum or config() count"});
  if(unsupportedJson.length)blockers.push({kind:"json-api",symbols:unsupportedJson});
  if(unsupportedSimd.length)blockers.push({kind:"simd-api",symbols:unsupportedSimd});
  if(!rackAppCompatible&&target.key!=="Biset/Biset-Blank"&&target.key!=="computerscare/computerscare-blank"&&target.key!=="computerscare/computerscare-portaloof")blockers.push({kind:"host-feature",feature:"rack-app",symbols:appTargets});
  if(!expanderCompatible)blockers.push({kind:"host-feature",feature:"adjacent-expander-routing"});
  if(!assetsCompatible)blockers.push({kind:"host-feature",feature:"assets"});
  for(const feature of blockedUsed)blockers.push({kind:"host-feature",feature});
  const compileEligible=blockers.length===0;
  const siblingAnalysisDefinitions=referencedSiblingModuleDefinitions(sourceFiles,[body,...implementations].join("\n"),new Set([registration.moduleClass,...inherited.map(item=>item.name)]));
  const siblingAnalysisSource=siblingAnalysisDefinitions.flatMap(item=>[item.body,item.base]).join("\n");
  const siblingDependencyBundle=siblingAnalysisDefinitions.length
    ? referencedDependencyBundleForAdapter(sourceFiles,siblingAnalysisSource,new Set([definition.file,...(dependencyBundle.files??[])]),sourceDir)
    : {source:"",files:[],implementationFiles:[]};
  dependencyBundle.files=[...new Set([...(dependencyBundle.files??[]),...(siblingDependencyBundle.files??[])])];
  dependencyBundle.implementationFiles=[...new Set([...(dependencyBundle.implementationFiles??[]),...(siblingDependencyBundle.implementationFiles??[])])];
  const siblingDefines=siblingAnalysisDefinitions.length
    ? referencedDefinesWithoutPluginGlobals(rootSourceFiles,siblingAnalysisSource,sourceDir)
    : "";
  const registrationSource=fs.readFileSync(registration.file,"utf8"),registrationQuantityPrelude=paramQuantityHelpers(registrationSource,[body,...implementations].join("\n")).map(helper=>helper.source).join("\n\n"),registrationQuantitySupport=namespaceGlobalDefinitions(registrationSource,registrationQuantityPrelude,[],"",registration.file);
  let effectivePrelude=target.plugin==="Cella"&&["LoudnessMeter","Loud"].includes(target.model)?`#include "ebur128.h"
static rack::plugin::Model rackWebCellaLoudModel;
static rack::plugin::Model rackWebCellaLoudnessMeterModel;
static rack::plugin::Model* modelLoud = &rackWebCellaLoudModel;
static rack::plugin::Model* modelLoudnessMeter = &rackWebCellaLoudnessMeterModel;

${prelude}`:prelude;
  effectivePrelude=[siblingDefines,siblingDependencyBundle.source,effectivePrelude,registrationQuantitySupport,registrationQuantityPrelude].filter(Boolean).join("\n\n");
  const dependencyPreludeSource=[dependencyBundle.source,siblingDependencyBundle.source].filter(Boolean).join("\n\n");
  const inlinedLocalDependencyFiles=(dependencyBundle.files??[]).filter(file=>{
    const relative=path.relative(sourceDir,file);
    if(!relative||relative.startsWith("..")||relative.split(path.sep).some(part=>part==="lib"||part===".rack-web-dependencies"))return false;
    const inlined=stripRackUiBlocks(flattenExternCWrappers(sourceWithoutIncludes(stripHeaderGuardOpen(fs.readFileSync(file,"utf8"))))).trim();
    return Boolean(inlined&&dependencyPreludeSource.includes(inlined));
  });
  effectivePrelude=withoutMatchingIncludeDirectiveLines(effectivePrelude,directive=>{const normalized=directive.include.split(/[\\/]+/).join(path.sep);return inlinedLocalDependencyFiles.some(file=>file.endsWith(`${path.sep}${normalized}`))});
  effectivePrelude=[fallbackDependencyBundle?.source,effectivePrelude].filter(Boolean).join("\n\n");
  const referencedHeaderBinaryDeclarations=[...new Set(referencedHeaderGlobals.flatMap(source=>[...source.matchAll(/\bBINARY_(?:START|END|SIZE)\s*\(\s*([A-Za-z_]\w*)\s*\)/g)].map(match=>match[1])))].map(symbol=>`BINARY(${symbol});`).join("\n");
  effectivePrelude=[referencedHeaderBinaryDeclarations,...referencedHeaderGlobals,effectivePrelude].filter(Boolean).join("\n\n");
  if(effectivePrelude.includes('#include "r8lib/r8lib.h"')){
    effectivePrelude=effectivePrelude.replace(
      '#include "r8lib/r8lib.h"',
      '#define string std::string\n#include "r8lib/r8lib.h"\n#undef string'
    );
  }
  if(/\binline\s+float\s+getSampleRate\s*\(\s*\)/.test(effectivePrelude)){
    effectivePrelude=effectivePrelude.replace(/\bAPP\s*->\s*engine\s*->\s*getSampleRate\s*\(\s*\)/g,"APP->engine->sampleRate");
    effectivePrelude=`#define getSampleRate rackWebPluginGetSampleRate
inline float rackWebPluginGetSampleRate() noexcept;
${effectivePrelude}`;
  }
  const embeddedMidiBytes=embeddedMidiAssets.reduce((sum,file)=>sum+fs.statSync(file).size,0),embeddedBinaryBytes=embeddedBinaryAssets.reduce((sum,file)=>sum+fs.statSync(file).size,0),partitionedConvolverBytes=/\bRealTimeConvolver\b/.test(analysisSource)?12*1024*1024:0,
  targetMinimumMemory=target.key==="OPC-OctobIR/OPC-OctobIR"?128*1024*1024:target.key==="FrozenWasteland/StringTheory"||target.key==="KautenjaDSP-RackNES/RackNES"?72*1024*1024:target.key==="Fundamental/VCO2"||target.key==="HetrickCVGPL/PhasorWavetable"||target.key==="NoSuchDevice/Corrupter"?32*1024*1024:target.key==="Airwin2Rack/Airwin2Rack"||target.key==="Chinenual-VCV/MIDIRecorder"?16*1024*1024:target.plugin==="DrumKit"?16*1024*1024:target.key==="tnn1t1s-ghost/CrashRide"||target.plugin==="GP"&&(target.model.startsWith("ChainMixer")||target.model==="Rotary")?8*1024*1024:0,
  staticMemoryBytes=Math.max(estimatedStaticMemory(analysisSource)+embeddedMidiBytes+embeddedBinaryBytes*2+partitionedConvolverBytes,targetMinimumMemory),output=path.resolve(options.output||path.join("web-runtime","scaffolds",`${target.plugin}-${target.model}`));fs.mkdirSync(output,{recursive:true});const definitionFile=path.relative(sourceDir,definition.file),registrationFile=path.relative(sourceDir,registration.file),draft=compileEligible?runtimeDraft(target,manifest,moduleManifest,license,detected,registration.moduleClass,sourceDir):null,report={schemaVersion:1,key:target.key,libraryUrl:target.url,manifest:{slug:manifest.slug,name:manifest.name,version:manifest.version,license,brand:manifest.brand,sourceUrl:manifest.sourceUrl,module:moduleManifest},source:{directory:sourceDir,commit:sourceCommit,file:definitionFile,registrationFile:path.relative(sourceDir,registration.file),moduleClass:registration.moduleClass,widgetClass:registration.widgetClass},detected:{...detected,staticMemoryBytes},assessment:{strategy:compileEligible?"direct-rack-source-adapter":"manual-browser-adapter",compileEligible:Boolean(compileEligible),requiresReview:true,blockers},runtimeDraft:draft};const adapter=path.join(output,"adapter.cpp"),isolatedAdapter=adapterSource(target,manifest,license,definitionFile,registrationFile,registration,effectivePrelude,body,implementations,inherited.filter(item=>!item.missing),detected,Boolean(compileEligible),sourceDir);if(process.env.RACK_WEB_DEBUG_ADAPTER==="raw")process.stderr.write(`${isolatedAdapter}\n`);let normalizedAdapter=normalizeGeneratedImplementations(stripNamespaceScopeReturns(normalizeLegacyMidiOverrides(isolatedAdapter)));if(target.key==="PinkTrombone/PinkTrombone")normalizedAdapter=adaptPinkTromboneGeneratedAdapter(normalizedAdapter);if(target.key==="PitchGrid/MicroExquis")normalizedAdapter=adaptPitchGridMicroExquisBrowserSource(normalizedAdapter);if(target.key==="OPC-OctobIR/OPC-OctobIR")normalizedAdapter=adaptOpcOctobirBrowserSource(normalizedAdapter,detected.browserAsset);if(target.key==="Ohmer/RKD")normalizedAdapter=adaptOhmerRkdBrowserSource(normalizedAdapter);if(target.key==="KautenjaDSP-RackNES/RackNES")normalizedAdapter=adaptRackNesBrowserSource(normalizedAdapter);if(target.key==="LOGinstruments/Speck")normalizedAdapter=adaptSpeckBrowserSource(normalizedAdapter);if(target.key==="MADZINE/NIGOQ")normalizedAdapter=adaptMadzineNigoqBrowserSource(normalizedAdapter);if(target.key==="MADZINE/Manual")normalizedAdapter=adaptMadzineManualBrowserSource(normalizedAdapter);if(target.key==="ML_modules/Arpeggiator")normalizedAdapter=adaptMlArpeggiatorBrowserSource(normalizedAdapter);if(target.key==="ML_modules/TrigBuf")normalizedAdapter=adaptMlTrigBufBrowserSource(normalizedAdapter);if(target.key==="NoSuchDevice/Corrupter")normalizedAdapter=adaptNoSuchDeviceCorrupterBrowserSource(normalizedAdapter);if(target.key==="Leviathan/IntegralFlux")normalizedAdapter=adaptIntegralFluxBrowserSource(normalizedAdapter);if(target.key==="Leviathan/Undertow")normalizedAdapter=adaptLeviathanUndertowBrowserImplementation(normalizedAdapter);if(target.key==="LOGinstruments/LessMess")normalizedAdapter=adaptLessMessBrowserSource(normalizedAdapter);if(target.key==="Minilab3/MiniLog")normalizedAdapter=normalizedAdapter.replace("this->connected = connected;","connected = connected || rackWebDirectMidi;\n    this->connected = connected;");if(target.key==="JW-Modules/XYPad")normalizedAdapter=normalizedAdapter.replace(/\benum\s+PlayModes\s*\{[^}]+\}\s*;/,"");if(target.plugin==="CosineKitty-Sapphire")normalizedAdapter=adaptSapphireGeneratedAdapter(normalizedAdapter,sourceDir);if(target.plugin==="DrumKit")normalizedAdapter=adaptDrumKitSampleAdapter(sourceDir,target,normalizedAdapter);if(target.key==="DanTSynth/AOCR")normalizedAdapter=adaptDanTSynthAocrBrowserSource(normalizedAdapter);if(target.plugin==="DelexanderVol1"&&target.model.startsWith("Algomorph"))normalizedAdapter=adaptAlgomorphBrowserSource(normalizedAdapter,target.key==="DelexanderVol1/Algomorph");if(target.key==="Edge/WCO_Osc")normalizedAdapter=adaptEdgeWcoBrowserSource(normalizedAdapter,sourceDir);if(target.key==="IggyLabsModules/table")normalizedAdapter=adaptIggyTableBrowserSource(normalizedAdapter);if(target.key==="EH_modules/FV-1emu")normalizedAdapter=adaptFv1EmuBrowserSource(normalizedAdapter,fs.readFileSync(path.join(sourceDir,"fx","demo.spn"),"utf8"));if(target.key==="FrozenWasteland/PortlandWeather")normalizedAdapter=adaptFrozenWastelandPortlandWeatherBrowserSource(normalizedAdapter);if(target.key==="FrozenWasteland/StringTheory")normalizedAdapter=adaptStringTheoryBrowserSource(normalizedAdapter);if(target.key==="ChowDSP/ChowFDN")normalizedAdapter=normalizedAdapter.replace("HISTORY_SIZE = 1 << 21","HISTORY_SIZE = 1 << 17");if(target.key==="ChowDSP/ChowRNN")normalizedAdapter=removeTemplatedOutOfLineDefinitions(normalizedAdapter,"GRULayer");if(target.key==="Clonotribe/Clonotribe")normalizedAdapter=adaptClonotribeBrowserBody(normalizedAdapter).replace(/(\bClonotribe::Clonotribe\s*\(\s*\)\s*:\s*filterProcessor\s*\(\s*ms20Filter\s*\))\s*,\s*ribbonController\s*\(\s*this\s*\)/g,"$1");if(target.key==="InfrasonicAudio/WarpCore")normalizedAdapter=adaptInfrasonicWarpCoreBrowserSource(normalizedAdapter);if(target.key==="MUS-X/Synth")normalizedAdapter=normalizedAdapter.replace(/\bBipolarColorParamQuantity\b/g,"ParamQuantity");if(target.key==="ImpromptuModular/Prob-Key")normalizedAdapter=normalizedAdapter.replace(/RACK_WEB_EXPORTS\(([^)]+)\)\s*$/,`struct RackWebProbKeyModule : $1 {
  float rackWebProbDisplay[4] = {32.f, 32.f, 32.f, 49.f};
  int rackWebVisualCount() const override { return 4; }
  float* rackWebVisualBuffer() override {
    char text[5] = "   1";
    if (dispManager.getMode() == DisplayManager::DISP_NORMAL) {
      if (indexCvCap12 != 0) std::snprintf(text, sizeof(text), "*%3u", static_cast<unsigned>(getIndex() + 1));
      else std::snprintf(text, sizeof(text), "%4u", static_cast<unsigned>(getIndex() + 1));
    }
    else if (dispManager.getMode() == DisplayManager::DISP_LENGTH) std::snprintf(text, sizeof(text), " L%2u", static_cast<unsigned>(getLength()));
    else std::snprintf(text, sizeof(text), "%s", dispManager.getText());
    for (int index = 0; index < 4; index++) rackWebProbDisplay[index] = static_cast<unsigned char>(text[index] ? text[index] : ' ');
    return rackWebProbDisplay;
  }
};

RACK_WEB_EXPORTS(RackWebProbKeyModule)`);if(target.key==="ImpromptuModular/NoteEcho")normalizedAdapter=normalizedAdapter.replace(/RACK_WEB_EXPORTS\(([^)]+)\)\s*$/,`struct RackWebNoteEchoModule : $1 {
  void process(const ProcessArgs& args) override {
    $1::process(args);
    lights[$1::WET_LIGHT].setBrightness(wetOnly ? 1.f : 0.f);
  }
};

RACK_WEB_EXPORTS(RackWebNoteEchoModule)`);if(target.key==="ImpromptuModular/NoteLoop")normalizedAdapter=normalizedAdapter.replace(/RACK_WEB_EXPORTS\(([^)]+)\)\s*$/,`struct RackWebNoteLoopModule : $1 {
  void process(const ProcessArgs& args) override {
    $1::process(args);
    lights[$1::LOOP_LIGHT].setBrightness(loop ? 1.f : 0.f);
  }
};

RACK_WEB_EXPORTS(RackWebNoteLoopModule)`);if(target.key==="ImpromptuModular/Phrase-Seq-16")normalizedAdapter=normalizedAdapter.replace(/RACK_WEB_EXPORTS\(([^)]+)\)\s*$/,`struct RackWebPhraseSeq16Module : $1 {
  float rackWebPhraseDisplay[3] = {32.f, 32.f, 49.f};
  void rackWebResetParam(int id, float value) override {
    if (id == $1::SEQUENCE_PARAM) {
      if (editingPpqn != 0) pulsesPerStep = 1;
      else if (displayState == $1::DISP_MODE) {
        if (isEditingSequence()) {
          const bool expanderPresent = rightExpander.module && rightExpander.module->model == modelPhraseSeqExpander;
          const float* messagesFromExpander = static_cast<float*>(rightExpander.consumerMessage);
          if (!expanderPresent || std::isnan(messagesFromExpander[4])) sequences[seqIndexEdit].setRunMode(MODE_FWD);
        }
        else runModeSong = MODE_FWD;
      }
      else if (displayState == $1::DISP_LENGTH) {
        if (isEditingSequence()) sequences[seqIndexEdit].setLength(16);
        else phrases = 4;
      }
      else if (displayState == $1::DISP_NORMAL) {
        if (isEditingSequence()) {
          if (!inputs[$1::SEQCV_INPUT].isConnected()) seqIndexEdit = 0;
        }
        else phrase[phraseIndexEdit] = 0;
      }
    }
    $1::rackWebResetParam(id, value);
  }
  int rackWebVisualCount() const override { return 3; }
  float* rackWebVisualBuffer() override {
    char text[16] = "  1";
    const bool editingSequence = isEditingSequence();
    if (infoCopyPaste != 0l) {
      if (infoCopyPaste > 0l) std::snprintf(text, sizeof(text), "CPY");
      else {
        const float mode = params[$1::CPMODE_PARAM].getValue();
        if (editingSequence && !seqCopied) std::snprintf(text, sizeof(text), mode > 1.5f ? "TG1" : mode < 0.5f ? "RCV" : "RG1");
        else if (!editingSequence && seqCopied) std::snprintf(text, sizeof(text), mode > 1.5f ? "CLR" : mode < 0.5f ? "INC" : "RPH");
        else std::snprintf(text, sizeof(text), "PST");
      }
    }
    else if (editingPpqn != 0ul) std::snprintf(text, sizeof(text), "x%2u", static_cast<unsigned>(pulsesPerStep));
    else if (displayState == $1::DISP_MODE) {
      const int mode = editingSequence ? sequences[seqIndexEdit].getRunMode() : runModeSong;
      std::snprintf(text, sizeof(text), "%s", mode >= 0 && mode < NUM_MODES ? modeLabels[mode].c_str() : "");
    }
    else if (displayState == $1::DISP_LENGTH) std::snprintf(text, sizeof(text), "L%2u", static_cast<unsigned>(editingSequence ? sequences[seqIndexEdit].getLength() : phrases));
    else if (displayState == $1::DISP_TRANSPOSE) {
      const int value = sequences[seqIndexEdit].getTranspose();
      std::snprintf(text, sizeof(text), "%c%2u", value < 0 ? '-' : '+', static_cast<unsigned>(std::abs(value)));
    }
    else if (displayState == $1::DISP_ROTATE) {
      const int value = sequences[seqIndexEdit].getRotate();
      std::snprintf(text, sizeof(text), "%c%2u", value < 0 ? '(' : ')', static_cast<unsigned>(std::abs(value)));
    }
    else std::snprintf(text, sizeof(text), " %2u", static_cast<unsigned>((editingSequence ? seqIndexEdit : phrase[phraseIndexEdit]) + 1));
    for (int index = 0; index < 3; index++) rackWebPhraseDisplay[index] = static_cast<unsigned char>(text[index] ? text[index] : ' ');
    return rackWebPhraseDisplay;
  }
};

RACK_WEB_EXPORTS(RackWebPhraseSeq16Module)`);if(target.key==="ImpromptuModular/Phrase-Seq-32")normalizedAdapter=normalizedAdapter.replace(/RACK_WEB_EXPORTS\(([^)]+)\)\s*$/,`struct RackWebPhraseSeq32Module : $1 {
  float rackWebPhraseDisplay[3] = {32.f, 32.f, 49.f};
  void rackWebResetParam(int id, float value) override {
    if (id == $1::SEQUENCE_PARAM) {
      if (editingPpqn != 0) pulsesPerStep = 1;
      else if (displayState == $1::DISP_MODE) {
        if (isEditingSequence()) {
          const bool expanderPresent = rightExpander.module && rightExpander.module->model == modelPhraseSeqExpander;
          const float* messagesFromExpander = static_cast<float*>(rightExpander.consumerMessage);
          if (!expanderPresent || std::isnan(messagesFromExpander[4])) sequences[seqIndexEdit].setRunMode(MODE_FWD);
        }
        else runModeSong = MODE_FWD;
      }
      else if (displayState == $1::DISP_LENGTH) {
        if (isEditingSequence()) sequences[seqIndexEdit].setLength(16 * stepConfig);
        else phrases = 4;
      }
      else if (displayState == $1::DISP_NORMAL) {
        if (isEditingSequence()) {
          if (!inputs[$1::SEQCV_INPUT].isConnected()) seqIndexEdit = 0;
        }
        else phrase[phraseIndexEdit] = 0;
      }
    }
    $1::rackWebResetParam(id, value);
  }
  int rackWebVisualCount() const override { return 3; }
  float* rackWebVisualBuffer() override {
    char text[16] = "  1";
    const bool editingSequence = isEditingSequence();
    if (infoCopyPaste != 0l) {
      if (infoCopyPaste > 0l) std::snprintf(text, sizeof(text), "CPY");
      else {
        const float mode = params[$1::CPMODE_PARAM].getValue();
        if (editingSequence && !seqCopied) std::snprintf(text, sizeof(text), mode > 1.5f ? "TG1" : mode < 0.5f ? "RCV" : "RG1");
        else if (!editingSequence && seqCopied) std::snprintf(text, sizeof(text), mode > 1.5f ? "CLR" : mode < 0.5f ? "INC" : "RPH");
        else std::snprintf(text, sizeof(text), "PST");
      }
    }
    else if (editingPpqn != 0ul) std::snprintf(text, sizeof(text), "x%2u", static_cast<unsigned>(pulsesPerStep));
    else if (displayState == $1::DISP_MODE) {
      const int mode = editingSequence ? sequences[seqIndexEdit].getRunMode() : runModeSong;
      std::snprintf(text, sizeof(text), "%s", mode >= 0 && mode < NUM_MODES ? modeLabels[mode].c_str() : "");
    }
    else if (displayState == $1::DISP_LENGTH) std::snprintf(text, sizeof(text), "L%2u", static_cast<unsigned>(editingSequence ? sequences[seqIndexEdit].getLength() : phrases));
    else if (displayState == $1::DISP_TRANSPOSE) {
      const int value = sequences[seqIndexEdit].getTranspose();
      std::snprintf(text, sizeof(text), "%c%2u", value < 0 ? '-' : '+', static_cast<unsigned>(std::abs(value)));
    }
    else if (displayState == $1::DISP_ROTATE) {
      const int value = sequences[seqIndexEdit].getRotate();
      std::snprintf(text, sizeof(text), "%c%2u", value < 0 ? '(' : ')', static_cast<unsigned>(std::abs(value)));
    }
    else std::snprintf(text, sizeof(text), " %2u", static_cast<unsigned>((editingSequence ? seqIndexEdit : phrase[phraseIndexEdit]) + 1));
    for (int index = 0; index < 3; index++) rackWebPhraseDisplay[index] = static_cast<unsigned char>(text[index] ? text[index] : ' ');
    return rackWebPhraseDisplay;
  }
};

RACK_WEB_EXPORTS(RackWebPhraseSeq32Module)`);if(target.key==="Skylights/SkWhatnoteCV")normalizedAdapter=normalizedAdapter.replace(/RACK_WEB_EXPORTS\(([^)]+)\)\s*$/,`struct RackWebWhatNoteModule : $1 {
  json_t *dataToJson() override {
    json_t *root = json_object();
    json_object_set_new(root, "octave", json_integer(octave));
    json_object_set_new(root, "semitone", json_integer(semitone));
    json_object_set_new(root, "cents", json_integer(cents));
    json_object_set_new(root, "voltage", json_real(voltage));
    return root;
  }
};

RACK_WEB_EXPORTS(RackWebWhatNoteModule)`);if(target.key==="WrongPeople/MIDIPlayer")normalizedAdapter=adaptWrongPeopleMidiPlayerBrowserSource(normalizedAdapter);if(target.key==="WrongPeople/Lua")normalizedAdapter=adaptWrongPeopleLuaBrowserSource(normalizedAdapter,sourceDir);if(target.plugin==="tnn1t1s-ghost")normalizedAdapter=adaptTnnGhostBrowserSource(normalizedAdapter);if(process.env.RACK_WEB_DEBUG_ADAPTER&&process.env.RACK_WEB_DEBUG_ADAPTER!=="raw")process.stderr.write(`${normalizedAdapter}\n`);fs.writeFileSync(path.join(output,"adapter.json"),JSON.stringify(report,null,2)+"\n");fs.writeFileSync(adapter,normalizedAdapter);fs.writeFileSync(path.join(output,"README.md"),`# ${target.key} Rack Web scaffold\n\n- [ ] Review source license and dependencies\n- [ ] Preserve ordered Param/Input/Output/Light IDs from adapter.json\n- [ ] Translate DSP and state without native widget code\n- [ ] Add manifest and runtime catalog records\n- [ ] Add executable ABI regression tests\n\nAssessment: **${report.assessment.strategy}**\n`);let artifact;if(options.compile){if(!compileEligible)fail(`${target.key} requires a manual browser adapter: ${blockers.map(blocker=>blocker.symbols?.join(", ")??blocker.feature??blocker.detail).join("; ")}`);const explicitInitialMemory=options["initial-memory"]!==undefined,maximumMemory=268435456,wasiHolder={exports:null},imports=wasiImports(wasiHolder);let initialMemory=Number(options["initial-memory"]??pageAlignedMemory(staticMemoryBytes)),wasm;if(!Number.isSafeInteger(initialMemory)||initialMemory<1048576||initialMemory%65536!==0)fail("Initial memory must be a whole number of 64 KiB pages");while(true){try{artifact=compileAdapter(adapter,output,initialMemory,sourceDir,[...new Set([...sourceFiles,...dependencyBundle.files])],dependencyBundle.implementationFiles,!portableSurgeHost);wasm=new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(artifact)),imports).exports;wasiHolder.exports=wasm;wasm._initialize();if(browserAsset){const image=browserAsset.mode==="rgba-image",frames=image?1024:Math.min(4096,wasm.rack_web_asset_capacity()),channels=image?4:1,samples=new Float32Array(wasm.memory.buffer,wasm.rack_web_asset_buffer(),frames*channels);for(let index=0;index<samples.length;index++)samples[index]=image?(index%4===3?1:(index%256)/255):Math.sin(index*.1);wasm.rack_web_commit_asset(frames,channels,image?32:48000)}break}catch(error){const memoryFailure=/initial memory too small|(?:out of bounds memory access|memory access out of bounds)|cannot enlarge memory|failed to (?:grow|allocate) memory|memory allocation failed|unreachable[^\n]*(?:alloc|memory)|^\s*unreachable\s*$/im.test(error instanceof Error?error.message:String(error));if(explicitInitialMemory||!memoryFailure||initialMemory>=maximumMemory)throw error;initialMemory=Math.min(maximumMemory,initialMemory*2)}}for(const param of draft.params){param.default=wasm.rack_web_get_param(param.id);const minimum=wasm.rack_web_get_param_min(param.id),maximum=wasm.rack_web_get_param_max(param.id);if(Number.isFinite(minimum))param.min=minimum;if(Number.isFinite(maximum))param.max=maximum}draft.runtime={...(draft.runtime??{}),initialMemory}}if(draft)fs.writeFileSync(path.join(output,"runtime.json"),JSON.stringify(draft,null,2)+"\n");fs.writeFileSync(path.join(output,"adapter.json"),JSON.stringify(report,null,2)+"\n");process.stdout.write(JSON.stringify({...report,output,artifact,temporarySource:temporary},null,2)+"\n")}

if(import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{process.stderr.write(`${error instanceof Error?error.message:String(error)}\n`);process.exitCode=1});

export {
  adaptAlgomorphBrowserSource,
  adaptRackNesBrowserSource,
  adaptSpeckBrowserSource,
  adaptMadzineNigoqBrowserSource,
  adaptMadzineWeiiiDocumentaBrowserSource,
  adaptMadzineUniversalRhythmBrowserSource,
  adaptMadzineUniRhythmBrowserSource,
  adaptMadzineLaunchpadBrowserSource,
  adaptMadzineTheKickBrowserSource,
  adaptMadzineManualBrowserSource,
  madzineManualHelpData,
  adaptMlArpeggiatorBrowserSource,
  adaptMlTrigBufBrowserSource,
  adaptNoSuchDeviceCorrupterBrowserSource,
  adaptTapestryBrowserSource,
  adaptIntegralFluxBrowserSource,
  adaptProcBrowserSource,
  adaptLeviathanIntegralFluxBrowserBody,
  adaptLeviathanIntegralFluxBrowserPrelude,
  adaptLeviathanProcBrowserBody,
  adaptLeviathanProcBrowserPrelude,
  adaptLeviathanUndertowBrowserBody,
  adaptLeviathanUndertowBrowserPrelude,
  adaptLeviathanUndertowBrowserImplementation,
  adaptLessMessBrowserSource,
  adaptEdgeWcoBrowserSource,
  adaptEdgeKRushBrowserSource,
  adaptChrysalisBrowserBody,
  adaptClonotribeBrowserBody,
  adaptFundamentalWavetableBrowserBody,
  adaptHetrickPhasorWavetableBrowserSource,
  adaptNativeUiBackedExpressionFields,
  adaptStbImagePointerBrowserBody,
  adaptDrumKitSampleAdapter,
  adaptDanTSynthAocrBrowserSource,
  adaptFv1EmuBrowserSource,
  adaptGpRotaryBrowserSource,
  adaptHoyerScanningDivisionBrowserBody,
  adaptMidiRecorderBrowserBody,
  adaptMidiRecorderBrowserPrelude,
  adaptPortlandWeatherBrowserSource,
  adaptStringTheoryBrowserSource,
  appendInlineMethodStatement,
  browserAssetSamplerContract,
  browserAssetDependencyPrelude,
  airwinBrowserSuite,
  browserAssetSamplerMethods,
  browserFundamentalWavetablePrelude,
  browserComputerscareBlankAdapterSource,
  chuckEmscriptenImplementationSources,
  declaredDependencyNames,
  deferFreeFunctionsReferencingTypes,
  dedupeRepeatedTopLevelEnums,
  dedupeRepeatedTopLevelTypes,
  dedupeOutOfLineMethodDefinitions,
  filesOutsideNestedRepositories,
  estimatedStaticMemory,
  explicitSpecializationForwardDeclarations,
  insertExplicitSpecializationForwardDeclarations,
  features,
  includedDependencyFiles,
  isCodePosition,
  jsonStateKeys,
  localPlainStructDefinitions,
  normalizeConditionalTemplateImplementations,
  normalizeGeneratedImplementations,
  normalizeLegacyMidiOverrides,
  namespaceGlobalDefinitions,
  referencedExternGlobalDefinitions,
  namespaceFunctionForwardDeclarations,
  namespaceUsingPrelude,
  modelRegistrations,
  moduleDefinition,
  modulePrelude,
  nativeUiPointerMembers,
  numericConstants,
  outOfLineDefinitions,
  outOfLineCallableKeys,
  outOfLineFreeFunctionDefinitions,
  outOfLineStaticDefinitions,
  paramQuantityHelpers,
  prependInlineMethodBody,
  pruneInactiveConditionalDependencies,
  preferNearestTargetEnums,
  rackWidgetPlacements,
  referencedDependencyBundleForAdapter,
  referencedDefinesWithoutPluginGlobals,
  referencedHostModels,
  referencedLocalFreeFunctionDefinitions,
  referencedPluginGlobalParts,
  referencedVecDspHelpers,
  removeFreeFunction,
  removeOutOfLineDefinitions,
  removeQualifiedFreeFunction,
  replaceInlineMethodBody,
  replaceOutOfLineMethod,
  stubHostOnlyModuleMethods,
  stripHostHistoryStatements,
  stripEmbeddedResourceDocumentation,
  stripPluginInitFunctions,
  stripRackUiBlocks,
  stripRackUiResidue,
  sourceWithoutIncludes,
  stripSurgeRackCustomEditor,
  stripNativeUiPointerBridges,
  stripUiClassMembers,
  stripUiHeaderIncludes,
  stripNamespaceScopeReturns,
  stripSpecializedExplicitInstantiations,
  standardDependencyIncludes,
  stubInlineVoidMethod,
  surgeFxConfigSpecializations,
  surgeVcoSpecializations,
};
