import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseLibraryModuleHtml, parseLibraryModuleUrl } from "../lib/vcv-library.ts";
import { checkoutLockedRepository, legacyLibrarySourceLock, officialLibrarySubmodule, sourceRepository, sourceRevisionFromRemote } from "../scripts/scaffold-library-module.mjs";

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

test("official source locking follows the Library path when its submodule label differs from the plugin slug",()=>{
  const modules='[submodule "repos/Other"]\n\tpath = repos/Other\n\turl = https://github.com/example/Other.git\n[submodule "repos/ValleyFree"]\n\tpath = repos/Valley\n\turl = https://github.com/ValleyAudio/ValleyRackFree.git\n';
  assert.deepEqual(officialLibrarySubmodule(modules,"Valley","https://github.com/ValleyAudio/ValleyRackFree"),{name:"repos/ValleyFree",path:"repos/Valley",url:"https://github.com/ValleyAudio/ValleyRackFree.git"});
  assert.throws(()=>officialLibrarySubmodule(modules,"Valley","https://github.com/attacker/Different"),/differs/);
  assert.deepEqual(officialLibrarySubmodule(modules,"Valley","https://github.com/attacker/Different",true),{name:"repos/ValleyFree",path:"repos/Valley",url:"https://github.com/ValleyAudio/ValleyRackFree.git"});
});

test("source checkout allows only approved HTTPS Git hosts and safe repository paths",()=>{
  assert.equal(sourceRepository("https://github.com/VCVRack/Fundamental"),"https://github.com/VCVRack/Fundamental.git");
  assert.equal(sourceRepository("http://github.com/Miserlou/RJModules"),"https://github.com/Miserlou/RJModules.git");
  assert.equal(sourceRepository("https://gitlab.com/sonusdept/sonusmodular.git"),"https://gitlab.com/sonusdept/sonusmodular.git");
  assert.throws(()=>sourceRepository("http://gitlab.com/sonusdept/sonusmodular"),/HTTPS/);
  assert.equal(sourceRepository("https://codeberg.org/alteredstatemachines/alteredstatemachines-vcv"),"https://codeberg.org/alteredstatemachines/alteredstatemachines-vcv.git");
  assert.equal(sourceRepository("https://git.s-ol.nu/vcvmods"),"https://git.s-ol.nu/vcvmods.git");
  assert.equal(sourceRepository("https://github.com/TheDrude/ChordChemist/tree/main/src"),"https://github.com/TheDrude/ChordChemist.git");
  assert.equal(sourceRepository("https://github.com/CoffeeVCV/CoffeeVCV/blob/master/README.md"),"https://github.com/CoffeeVCV/CoffeeVCV.git");
  for(const value of ["https://evil.example/a/b","https://user@github.com/a/b","https://github.com/a/../b","https://github.com/a/b?ref=main"])assert.throws(()=>sourceRepository(value));
});

test("legacy Library versions retain their immutable official gitlink",()=>{
  assert.deepEqual(legacyLibrarySourceLock("RJModules","1.7.2"),{repository:"https://github.com/Miserlou/RJModules.git",commit:"7db2aadc1c2521365bf200a3c42ed0f90bbd841a"});
  assert.deepEqual(legacyLibrarySourceLock("TheXOR","1.1.1"),{repository:"https://github.com/spectromas/RackPlugins.git",commit:"168a32e1331f7eb355b1522ae0550186bebba45a"});
  assert.deepEqual(legacyLibrarySourceLock("luckyxxl","1.0.0"),{repository:"https://github.com/eriser/vcv_luckyxxl.git",commit:"13b76875e980503c1d123edded34a310cb2588a6"});
  assert.deepEqual(legacyLibrarySourceLock("RacketScience","1.1.0"),{repository:"https://github.com/ContemporaryInsanity/RacketScience.git",commit:"04caab44e47d60b3af2a9fae0108e9cc241f31ac"});
  assert.equal(legacyLibrarySourceLock("RJModules","2.0.0"),undefined);
});

test("an exact revision at the remote default HEAD still receives a populated worktree",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-head-checkout-")),repository=path.join(temporary,"repository"),target=path.join(temporary,"cache","source"),environment={...process.env,GIT_AUTHOR_NAME:"Rack Web",GIT_AUTHOR_EMAIL:"rack-web@example.invalid",GIT_COMMITTER_NAME:"Rack Web",GIT_COMMITTER_EMAIL:"rack-web@example.invalid"};
  try{execFileSync("git",["init",repository],{env:environment,stdio:"ignore"});fs.writeFileSync(path.join(repository,"plugin.json"),'{"slug":"Fixture"}\n');execFileSync("git",["-C",repository,"add","plugin.json"],{env:environment});execFileSync("git",["-C",repository,"commit","-m","fixture"],{env:environment,stdio:"ignore"});const commit=execFileSync("git",["-C",repository,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),staging=checkoutLockedRepository(repository,commit,target);assert.equal(fs.readFileSync(path.join(staging,"plugin.json"),"utf8"),'{"slug":"Fixture"}\n');assert.equal(execFileSync("git",["-C",staging,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),commit)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});

test("source revisions prefer immutable plain and VCV-prefixed tags before HEAD",()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"rack-web-source-revision-")),repository=path.join(temporary,"repository"),environment={...process.env,GIT_AUTHOR_NAME:"Rack Web",GIT_AUTHOR_EMAIL:"rack-web@example.invalid",GIT_COMMITTER_NAME:"Rack Web",GIT_COMMITTER_EMAIL:"rack-web@example.invalid"};
  try{execFileSync("git",["init",repository],{env:environment,stdio:"ignore"});fs.writeFileSync(path.join(repository,"plugin.json"),'{"slug":"Fixture","version":"2.0.0"}\n');execFileSync("git",["-C",repository,"add","plugin.json"],{env:environment});execFileSync("git",["-C",repository,"commit","-m","tagged"],{env:environment,stdio:"ignore"});const tagged=execFileSync("git",["-C",repository,"rev-parse","HEAD"],{encoding:"utf8"}).trim();execFileSync("git",["-C",repository,"tag","v2.0.0"],{env:environment});execFileSync("git",["-C",repository,"tag","vcv-v2.0.1"],{env:environment});fs.writeFileSync(path.join(repository,"README.md"),"new head\n");execFileSync("git",["-C",repository,"add","README.md"],{env:environment});execFileSync("git",["-C",repository,"commit","-m","head"],{env:environment,stdio:"ignore"});const head=execFileSync("git",["-C",repository,"rev-parse","HEAD"],{encoding:"utf8"}).trim();assert.equal(sourceRevisionFromRemote(repository,"2.0.0"),tagged);assert.equal(sourceRevisionFromRemote(repository,"2.0.1"),tagged);assert.equal(sourceRevisionFromRemote(repository,"9.9.9"),head)}finally{fs.rmSync(temporary,{recursive:true,force:true})}
});
