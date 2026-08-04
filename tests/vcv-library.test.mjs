import assert from "node:assert/strict";
import test from "node:test";
import { parseLibraryModuleHtml, parseLibraryModuleUrl } from "../lib/vcv-library.ts";
import { clearMissingScreenshot } from "../scripts/refresh-screenshot-status.mjs";
import { hasCompleteUiGeometry, mergeUiGeometry, uiGeometryIssueCount } from "../scripts/refresh-ui-geometry.mjs";

test("UI geometry refresh preserves runtime artifacts while repairing widget positions",()=>{
  const current={
    key:"Fixture/Panel",width:45,wasmUrl:"packages/Fixture/Panel/1.0.0/module.wasm",artifact:{sha256:"a".repeat(64),size:8},
    params:[{id:0,name:"Visible",min:0,max:1,default:0},{id:1,name:"Context",min:0,max:1,default:0,contextOnly:true}],
    inputs:[{id:0,name:"In",kind:"cv"}],outputs:[{id:0,name:"Out",kind:"cv"}],
  },refreshed={
    width:60,
    params:[{id:0,position:{x:15,y:40,centered:true,widget:"RoundBlackKnob"}},{id:1}],
    inputs:[{id:0,position:{x:15,y:330,centered:true}}],outputs:[{id:0,position:{x:45,y:330,centered:true}}],
  };
  assert.equal(hasCompleteUiGeometry(current),false);
  const merged=mergeUiGeometry(current,refreshed);
  assert.equal(hasCompleteUiGeometry(merged),true);
  assert.equal(merged.width,60);
  assert.deepEqual(merged.params[0].position,refreshed.params[0].position);
  assert.equal(merged.params[1].position,undefined);
  assert.equal(merged.wasmUrl,current.wasmUrl);
  assert.deepEqual(merged.artifact,current.artifact);
});

test("UI geometry refresh rejects collapsed coordinates and does not regress good positions",()=>{
  const current={
    width:60,
    params:[{id:0,name:"A",position:{x:15,y:40}},{id:1,name:"B",position:{x:45,y:40}}],
    inputs:[],outputs:[],
  },collapsed={
    width:60,
    params:[{id:0,position:{x:22,y:33}},{id:1,position:{x:22,y:33}}],
    inputs:[],outputs:[],
  };
  assert.equal(uiGeometryIssueCount(current),0);
  assert.equal(hasCompleteUiGeometry(collapsed),false);
  assert.deepEqual(mergeUiGeometry(current,collapsed).params,current.params);
});

test("screenshot refresh clears confirmed 404s but preserves transient failures",()=>{
  const module={screenshotUrl:"https://library.vcvrack.com/screenshots/400/Fixture/Panel.webp"};
  assert.equal(clearMissingScreenshot(module,404).screenshotUrl,"");
  assert.equal(clearMissingScreenshot(module,500),module);
});

test("official Library module URLs are canonicalized narrowly",()=>{
  assert.deepEqual(parseLibraryModuleUrl("https://library.vcvrack.com/Bogaudio/Bogaudio-ADSR"),{plugin:"Bogaudio",model:"Bogaudio-ADSR",key:"Bogaudio/Bogaudio-ADSR",url:"https://library.vcvrack.com/Bogaudio/Bogaudio-ADSR"});
  for(const value of ["http://library.vcvrack.com/A/B","https://evil.example/A/B","https://user@library.vcvrack.com/A/B","https://library.vcvrack.com:444/A/B","https://library.vcvrack.com/A/B/C","https://library.vcvrack.com/A/%2f","https://library.vcvrack.com/A/B?x=1","https://library.vcvrack.com/A/B#x"])assert.throws(()=>parseLibraryModuleUrl(value));
});

test("Library HTML metadata exposes only safe HTTPS assets and source links",()=>{
  const html='<meta property="og:title" content="Bogaudio &amp; ADSR"><meta name="description" content="Envelope"><meta property="og:image" content="https://library.vcvrack.com/a.webp"><span title="Current version distributed">2.6.47</span><a href="https://github.com/bogaudio/BogaudioModules">Source code</a>License: <a>GPL-3.0-or-later</a>';
  assert.deepEqual(parseLibraryModuleHtml(html,"Bogaudio","Bogaudio-ADSR"),{title:"Bogaudio & ADSR",description:"Envelope",screenshotUrl:"https://library.vcvrack.com/a.webp",sourceUrl:"https://github.com/bogaudio/BogaudioModules",license:"GPL-3.0-or-later",version:"2.6.47"});
  const unsafe='<meta property="og:image" content="http://example.com/x"><a href="https://user:secret@github.com/repo">Source code</a>';
  const parsed=parseLibraryModuleHtml(unsafe,"A","B","2.0.0");assert.equal(parsed.screenshotUrl,"");assert.equal(parsed.sourceUrl,undefined);assert.equal(parsed.version,"2.0.0");
});
