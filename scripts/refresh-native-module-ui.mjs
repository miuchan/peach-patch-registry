#!/usr/bin/env node
import { execFile, execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import { webpDimensions } from "./refresh-panel-widths.mjs";
import { applyModuleUiOverrides } from "../lib/module-ui-overrides.mjs";

const execute = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = path.join(root, ".build", "native-module-ui");
const exactSourceRoot = path.join(buildRoot, "sources");
const preparedSourceRoot = path.join(root, ".build", "ui-geometry", "sources");
const sourceRoots = [
  exactSourceRoot,
  preparedSourceRoot,
  path.join(root, ".build", "panel-widths", "sources"),
];
const rack1 = {
  abi: 1,
  sdkArchive: "Rack-SDK-1.1.6.zip",
  sdkUrl: "https://vcvrack.com/downloads/Rack-SDK-1.1.6.zip",
  sdkSha256: "361f3dfb6c319ff64eef937a6bb6cd55d45b36911612a83254c305f8830f201b",
  runtimeArchive: "Rack-1.1.6-mac.zip",
  runtimeUrl: "https://vcvrack.com/downloads/Rack-1.1.6-mac.zip",
  runtimeSha256:
    "79078ca77dff41beab2247cadf22d1a9d4112b3981f8a4084923b75519664a50",
};
const rack2Arm64 = {
  abi: 2,
  sdkArchive: "Rack-SDK-2.6.6-mac-arm64.zip",
  sdkUrl: "https://vcvrack.com/downloads/Rack-SDK-2.6.6-mac-arm64.zip",
  sdkSha256: "29414e52417992cbafa47e30f947c3c0c7a34e5c424bb83c5a0af8c24840481f",
};
const rack2X64 = {
  abi: 2,
  sdkArchive: "Rack-SDK-2.6.6-mac-x64.zip",
  sdkUrl: "https://vcvrack.com/downloads/Rack-SDK-2.6.6-mac-x64.zip",
  sdkSha256: "9b8b0d7582ca25fac879f8f64de40f2481df2fd903b65f3abb5d6801689060ec",
};
const nativeArchitectureByPlugin = new Map([["RPJ", "x86_64"]]);
const nativeBuildFlagsByPlugin = new Map([
  // These locked sources rely on optimization to fold pre-C++17 static
  // constexpr members, as their official release builds do. The probe's
  // default -O0 otherwise leaves unresolved ODR-use symbols at load time.
  ["Bogaudio", ["-O2"]],
  ["CVfunk", ["-O2"]],
  ["Coalescent", ["-O2"]],
  ["SanguineMonsters", ["-O2"]],
  ["SeasideModular", ["-include", "stddef.h"]],
]);
const captainsSoundsMoog = {
  archive: "MoogLadders-995014c66d94afc49545aeb2a9d6c7afba841238.zip",
  directory: "MoogLadders-995014c66d94afc49545aeb2a9d6c7afba841238",
  url: "https://github.com/ddiakopoulos/MoogLadders/archive/995014c66d94afc49545aeb2a9d6c7afba841238.zip",
  sha256: "36a96d43f703c1dd30d6b56fc5f0792da214756f9c47874dcff71ff205ef6c28",
};

function option(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function safeSegment(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(value))
    throw new Error(`Unsafe ${label}: ${value}`);
  return value;
}

function nativeBuildConfiguration(plugin, abi) {
  return {
    architecture:
      abi === 1
        ? "x86_64"
        : (nativeArchitectureByPlugin.get(plugin) ?? "arm64"),
    extraFlags: nativeBuildFlagsByPlugin.get(plugin) ?? [],
  };
}

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

function atomicJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.building-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function ensureOpusPkgConfigShim() {
  const toolDirectory = path.join(buildRoot, "tools");
  const tool = path.join(toolDirectory, "pkg-config-opus");
  fs.mkdirSync(toolDirectory, { recursive: true });
  fs.writeFileSync(
    tool,
    `#!/usr/bin/env node
import path from "node:path";

const args = process.argv.slice(2);
if (args.includes("--version")) {
  console.log("0.29.2");
  process.exit(0);
}
const searchPath = (process.env.PKG_CONFIG_PATH ?? "").split(path.delimiter)[0];
if (!searchPath || !args.some((arg) => arg === "opus")) process.exit(1);
const prefix = path.resolve(searchPath, "..", "..");
if (args.includes("--modversion")) console.log("1.3.1");
else if (args.includes("--cflags")) console.log(\`-I\${prefix}/include/opus\`);
else if (args.includes("--libs")) console.log(\`-L\${prefix}/lib -lopus\`);
else if (args.includes("--variable=prefix")) console.log(prefix);
`,
  );
  fs.chmodSync(tool, 0o755);
  return tool;
}

async function download(url, target, digest) {
  if (fs.existsSync(target) && sha256(target) === digest) return;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.building-${process.pid}`;
  await execute("curl", ["-fL", "--retry", "3", "-o", temporary, url], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (sha256(temporary) !== digest) {
    fs.rmSync(temporary, { force: true });
    throw new Error(
      `Downloaded Rack archive failed SHA-256 verification: ${url}`,
    );
  }
  fs.renameSync(temporary, target);
}

async function extractArchive(archive, directory, marker) {
  if (fs.existsSync(path.join(directory, marker))) return;
  const temporary = `${directory}.building-${process.pid}`;
  fs.rmSync(temporary, { recursive: true, force: true });
  fs.mkdirSync(temporary, { recursive: true });
  await execute("unzip", ["-q", "-o", archive, "-d", temporary], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  fs.rmSync(directory, { recursive: true, force: true });
  fs.renameSync(temporary, directory);
}

function rack1ProbeSource() {
  return String.raw`
static std::string peachRackUiTypeName(const std::type_info& info) {
  int status = 0;
  char* demangled = abi::__cxa_demangle(info.name(), NULL, NULL, &status);
  std::string value = status == 0 && demangled ? demangled : info.name();
  std::free(demangled);
  return value;
}

static bool peachRackUiRealModule(const std::string& model) {
  const char* configured = std::getenv("PEACH_RACK_UI_REAL_MODULES");
  if (!configured || !*configured) return false;
  const std::string list = std::string(",") + configured + ",";
  return list.find(std::string(",") + model + ",") != std::string::npos;
}

static void peachRackUiLine(const std::string& model, const char* group, int id,
    widget::Widget* widget) {
  const char* output = std::getenv("PEACH_RACK_UI_GEOMETRY");
  if (!output || !*output || !widget) return;
  FILE* file = std::fopen(output, "a");
  if (!file) return;
  const std::string type = peachRackUiTypeName(typeid(*widget));
  const math::Vec center = widget->getAbsoluteOffset(
    math::Vec(widget->box.size.x / 2.f, widget->box.size.y / 2.f));
  const float x = center.x;
  const float y = center.y;
  std::fprintf(file, "%s\t%s\t%d\t%.9g\t%.9g\t%.9g\t%.9g\t%s\n",
    model.c_str(), group, id, x, y, widget->box.size.x, widget->box.size.y, type.c_str());
  std::fclose(file);
}

static int peachRackUiParamId(app::ParamWidget* param, engine::Module* module) {
  if (param->peachRackUiParamId >= 0 &&
      (!module || static_cast<size_t>(param->peachRackUiParamId) < module->paramQuantities.size()))
    return param->peachRackUiParamId;
  if (!module || !param->paramQuantity) return -1;
  for (size_t paramId = 0; paramId < module->paramQuantities.size(); paramId++) {
    if (module->paramQuantities[paramId] == param->paramQuantity) return static_cast<int>(paramId);
  }
  return -1;
}

static void peachRackUiWidgets(const std::string& model, widget::Widget* node,
    engine::Module* module) {
  if (!node) return;
  app::ParamWidget* param = dynamic_cast<app::ParamWidget*>(node);
  if (param) {
    const int paramId = peachRackUiParamId(param, module);
    if (paramId >= 0) peachRackUiLine(model, "params", paramId, param);
  }
  app::PortWidget* port = dynamic_cast<app::PortWidget*>(node);
  if (port)
    peachRackUiLine(model, port->type == app::PortWidget::INPUT ? "inputs" : "outputs",
      port->portId, port);
  app::ModuleLightWidget* light = dynamic_cast<app::ModuleLightWidget*>(node);
  if (light) peachRackUiLine(model, "lights", light->firstLightId, light);
  for (widget::Widget* child : node->children) peachRackUiWidgets(model, child, module);
}

static void peachRackUiDump(const std::string& model, app::ModuleWidget* moduleWidget,
    engine::Module* module) {
  const char* output = std::getenv("PEACH_RACK_UI_GEOMETRY");
  if (!output || !*output || !moduleWidget) return;
  FILE* file = std::fopen(output, "a");
  if (file) {
    std::fprintf(file, "%s\tpanel\t-1\t%.9g\t%.9g\t%.9g\t%.9g\tModuleWidget\n",
      model.c_str(), moduleWidget->box.size.x / 2.f, moduleWidget->box.size.y / 2.f,
      moduleWidget->box.size.x, moduleWidget->box.size.y);
    std::fclose(file);
  }
  peachRackUiWidgets(model, moduleWidget, module);
}
`;
}

function rack2ProbeSource() {
  return String.raw`
static std::string peachRackUiTypeName(const std::type_info& info) {
  int status = 0;
  char* demangled = abi::__cxa_demangle(info.name(), NULL, NULL, &status);
  std::string value = status == 0 && demangled ? demangled : info.name();
  std::free(demangled);
  return value;
}

static bool peachRackUiRealModule(const std::string& model) {
  const char* configured = std::getenv("PEACH_RACK_UI_REAL_MODULES");
  if (!configured || !*configured) return false;
  const std::string list = std::string(",") + configured + ",";
  return list.find(std::string(",") + model + ",") != std::string::npos;
}

static void peachRackUiLine(const std::string& model, const char* group, int id,
    widget::Widget* widget) {
  const char* output = std::getenv("PEACH_RACK_UI_GEOMETRY");
  if (!output || !*output || !widget) return;
  FILE* file = std::fopen(output, "a");
  if (!file) return;
  const std::string type = peachRackUiTypeName(typeid(*widget));
  const math::Vec center = widget->getAbsoluteOffset(
    math::Vec(widget->box.size.x / 2.f, widget->box.size.y / 2.f));
  const float x = center.x;
  const float y = center.y;
  std::fprintf(file, "%s\t%s\t%d\t%.9g\t%.9g\t%.9g\t%.9g\t%s\n",
    model.c_str(), group, id, x, y, widget->box.size.x, widget->box.size.y, type.c_str());
  std::fclose(file);
}

static void peachRackUiWidgets(const std::string& model, widget::Widget* node) {
  if (!node) return;
  app::ParamWidget* param = dynamic_cast<app::ParamWidget*>(node);
  if (param && param->paramId >= 0)
    peachRackUiLine(model, "params", param->paramId, param);
  app::PortWidget* port = dynamic_cast<app::PortWidget*>(node);
  if (port && port->portId >= 0)
    peachRackUiLine(model, port->type == engine::Port::INPUT ? "inputs" : "outputs",
      port->portId, port);
  app::ModuleLightWidget* light = dynamic_cast<app::ModuleLightWidget*>(node);
  if (light) peachRackUiLine(model, "lights", light->firstLightId, light);
  for (widget::Widget* child : node->children) peachRackUiWidgets(model, child);
}

static void peachRackUiDump(const std::string& model, app::ModuleWidget* moduleWidget) {
  const char* output = std::getenv("PEACH_RACK_UI_GEOMETRY");
  if (!output || !*output || !moduleWidget) return;
  FILE* file = std::fopen(output, "a");
  if (file) {
    std::fprintf(file, "%s\tpanel\t-1\t%.9g\t%.9g\t%.9g\t%.9g\tModuleWidget\n",
      model.c_str(), moduleWidget->box.size.x / 2.f, moduleWidget->box.size.y / 2.f,
      moduleWidget->box.size.x, moduleWidget->box.size.y);
    std::fclose(file);
  }
  peachRackUiWidgets(model, moduleWidget);
}
`;
}

function instrumentSdk(sdk, abi) {
  const helper = path.join(sdk, "include", "helpers.hpp");
  const rack1ParamWidget = path.join(sdk, "include", "app", "ParamWidget.hpp");
  let source = fs.readFileSync(helper, "utf8");
  const rack1ParamWidgetReady =
    abi === 2 ||
    fs.readFileSync(rack1ParamWidget, "utf8").includes("peachRackUiParamId");
  if (source.includes("peachRackUiDump"))
    return (
      source.includes("peachRackUiWidgets") &&
      source.includes("widget->getAbsoluteOffset") &&
      source.includes("widget::Widget* widget)") &&
      !source.includes("const widget::Widget* widget") &&
      source.includes("#include <app/ModuleLightWidget.hpp>") &&
      (abi === 1 || source.includes("#include <engine/Engine.hpp>")) &&
      source.includes("peachRackUiRealModule") &&
      (abi === 2
        ? source.includes("APP->engine->addModule(m)")
        : source.includes("peachRackUiParamId") &&
          source.includes("static_cast<size_t>(param->peachRackUiParamId)") &&
          rack1ParamWidgetReady)
    );
  source = source.replace(
    "#include <functional>",
    `#include <functional>\n#include <app/ModuleLightWidget.hpp>${abi === 2 ? "\n#include <engine/Engine.hpp>" : ""}\n#include <cstdio>\n#include <cstdlib>\n#include <cxxabi.h>\n#include <map>\n#include <typeinfo>`,
  );
  if (abi === 1 && !source.includes("#include <functional>")) {
    source = source.replace(
      "#include <window.hpp>",
      "#include <window.hpp>\n#include <app/ModuleLightWidget.hpp>\n#include <cstdio>\n#include <cstdlib>\n#include <cxxabi.h>\n#include <map>\n#include <typeinfo>",
    );
  }
  source = source.replace(
    "namespace rack {\n",
    `namespace rack {\n${abi === 1 ? rack1ProbeSource() : rack2ProbeSource()}\n`,
  );
  if (abi === 1) {
    let paramWidgetSource = fs.readFileSync(rack1ParamWidget, "utf8");
    paramWidgetSource = paramWidgetSource.replace(
      "\tui::Tooltip* tooltip = NULL;",
      "\tui::Tooltip* tooltip = NULL;\n\t// Native UI extraction metadata appended after Rack's existing fields.\n\tint peachRackUiParamId = -1;",
    );
    if (!paramWidgetSource.includes("peachRackUiParamId"))
      throw new Error("Unable to instrument Rack 1 ParamWidget IDs");
    fs.writeFileSync(rack1ParamWidget, paramWidgetSource);
    source = source.replace(
      "\t\tapp::ModuleWidget* createModuleWidget() override {\n\t\t\tTModule* m = new TModule;\n\t\t\tm->engine::Module::model = this;\n\t\t\tapp::ModuleWidget* mw = new TModuleWidget(m);\n\t\t\tmw->model = this;\n\t\t\treturn mw;\n\t\t}",
      "\t\tapp::ModuleWidget* createModuleWidget() override {\n\t\t\tTModule* m = new TModule;\n\t\t\tm->engine::Module::model = this;\n\t\t\tapp::ModuleWidget* mw = new TModuleWidget(m);\n\t\t\tmw->model = this;\n\t\t\tpeachRackUiDump(this->slug, mw, m);\n\t\t\treturn mw;\n\t\t}",
    );
    source = source.replace(
      "\t\tapp::ModuleWidget* createModuleWidgetNull() override {\n\t\t\tapp::ModuleWidget* mw = new TModuleWidget(NULL);\n\t\t\tmw->model = this;\n\t\t\treturn mw;\n\t\t}",
      "\t\tapp::ModuleWidget* createModuleWidgetNull() override {\n\t\t\tTModule* m = NULL;\n\t\t\tif (peachRackUiRealModule(this->slug)) {\n\t\t\t\tm = new TModule;\n\t\t\t\tm->engine::Module::model = this;\n\t\t\t}\n\t\t\tapp::ModuleWidget* mw = new TModuleWidget(m);\n\t\t\tmw->model = this;\n\t\t\tpeachRackUiDump(this->slug, mw, m);\n\t\t\treturn mw;\n\t\t}",
    );
    source = source.replace(
      "\tif (module) {\n\t\to->paramQuantity = module->paramQuantities[paramId];\n\t}\n\treturn o;",
      "\tif (module) {\n\t\to->paramQuantity = module->paramQuantities[paramId];\n\t}\n\to->peachRackUiParamId = paramId;\n\treturn o;",
    );
    if (!source.includes("o->peachRackUiParamId = paramId"))
      throw new Error("Unable to instrument Rack 1 parameter IDs");
  } else {
    source = source.replace(
      "\t\tapp::ModuleWidget* createModuleWidget(engine::Module* m) override {\n\t\t\tTModule* tm = NULL;",
      "\t\tapp::ModuleWidget* createModuleWidget(engine::Module* m) override {\n\t\t\tif (!m && peachRackUiRealModule(this->slug)) {\n\t\t\t\tm = this->createModule();\n\t\t\t\tAPP->engine->addModule(m);\n\t\t\t}\n\t\t\tTModule* tm = NULL;",
    );
    source = source.replace(
      "\t\t\tmw->setModel(this);\n\t\t\treturn mw;",
      "\t\t\tmw->setModel(this);\n\t\t\tpeachRackUiDump(this->slug, mw);\n\t\t\treturn mw;",
    );
  }
  if (
    !source.includes(
      abi === 1
        ? "peachRackUiDump(this->slug, mw, m)"
        : "peachRackUiDump(this->slug, mw)",
    ) ||
    (abi === 2 && !source.includes("APP->engine->addModule(m)"))
  )
    throw new Error(`Unable to instrument Rack ${abi} SDK helpers`);
  fs.writeFileSync(helper, source);
  return true;
}

async function ensureRackTools(abi, architecture) {
  if (process.platform !== "darwin")
    throw new Error("Native Rack UI refresh currently requires macOS");
  const profile =
    abi === 1 ? rack1 : architecture === "x86_64" ? rack2X64 : rack2Arm64;
  const toolKey = abi === 1 ? "rack1" : `rack2-${architecture}`;
  const downloads = path.join(buildRoot, toolKey, "downloads");
  const sdkRoot = path.join(buildRoot, toolKey, "sdk");
  const sdkArchive = path.join(downloads, profile.sdkArchive);
  await download(profile.sdkUrl, sdkArchive, profile.sdkSha256);
  await extractArchive(sdkArchive, sdkRoot, "Rack-SDK/include/helpers.hpp");
  let sdk = path.join(sdkRoot, "Rack-SDK");
  if (!instrumentSdk(sdk, abi)) {
    fs.rmSync(sdkRoot, { recursive: true, force: true });
    await extractArchive(sdkArchive, sdkRoot, "Rack-SDK/include/helpers.hpp");
    sdk = path.join(sdkRoot, "Rack-SDK");
    if (!instrumentSdk(sdk, abi))
      throw new Error(`Unable to update Rack ${abi} SDK probe`);
  }
  if (abi === 2) {
    const runtime = "/Applications/VCV Rack 2 Free.app/Contents/MacOS/Rack";
    if (!fs.existsSync(runtime))
      throw new Error(`Rack 2 runtime not found at ${runtime}`);
    return {
      sdk,
      runtime,
      runtimeArgs: architecture === "x86_64" ? ["-x86_64"] : [],
      architecture,
      toolKey,
    };
  }
  const runtimeRoot = path.join(buildRoot, "rack1", "runtime");
  const runtimeArchive = path.join(downloads, profile.runtimeArchive);
  await download(profile.runtimeUrl, runtimeArchive, profile.runtimeSha256);
  await extractArchive(
    runtimeArchive,
    runtimeRoot,
    "Rack.app/Contents/MacOS/Rack",
  );
  return {
    sdk,
    runtime: path.join(runtimeRoot, "Rack.app", "Contents", "MacOS", "Rack"),
    runtimeArgs: ["-x86_64"],
    architecture: "x86_64",
    toolKey,
  };
}

async function sourceDirectory(module) {
  if (!module.sourceCommit)
    throw new Error(`${module.key} has no locked source commit`);
  for (const sourceRoot of sourceRoots) {
    const candidate = path.join(sourceRoot, module.plugin, module.sourceCommit);
    if (!fs.existsSync(path.join(candidate, "plugin.json"))) continue;
    try {
      const commit = execFileSync(
        "git",
        ["-C", candidate, "rev-parse", "HEAD"],
        {
          cwd: root,
          encoding: "utf8",
        },
      ).trim();
      if (commit === module.sourceCommit) return candidate;
    } catch {
      // A directory named after a commit is not sufficient provenance.
    }
  }
  const tool = path.join(root, "target", "debug", "peach-registry");
  const libraryIndex = path.join(preparedSourceRoot, "library-index");
  if (fs.existsSync(tool) && fs.existsSync(path.join(libraryIndex, ".git"))) {
    try {
      const { stdout } = await execute(
        tool,
        [
          "source",
          "prepare",
          "--url",
          module.libraryUrl,
          "--source-cache",
          preparedSourceRoot,
          "--library-index",
          libraryIndex,
          "--format",
          "json",
        ],
        {
          cwd: root,
          encoding: "utf8",
          timeout: 300_000,
          maxBuffer: 16 * 1024 * 1024,
        },
      );
      const prepared = JSON.parse(stdout);
      if (prepared.source?.commit === module.sourceCommit) {
        const directory = path.resolve(prepared.source.directory);
        if (fs.existsSync(path.join(directory, "plugin.json")))
          return directory;
      }
    } catch {
      // Registry entries remain locked to their published source revision even
      // when the live Library index or its current checkout is unavailable.
    }
  }
  return checkoutExactSource(module);
}

async function checkoutExactSource(module) {
  const plugin = safeSegment(module.plugin, "plugin slug");
  const commit = safeSegment(module.sourceCommit, "source commit");
  const sourceUrl = new URL(module.sourceUrl);
  if (!["http:", "https:"].includes(sourceUrl.protocol))
    throw new Error(`Unsupported source URL protocol for ${module.key}`);
  sourceUrl.protocol = "https:";
  const checkout = path.join(exactSourceRoot, plugin, commit);
  fs.rmSync(checkout, { recursive: true, force: true });
  fs.mkdirSync(checkout, { recursive: true });
  await execute("git", ["init", "--quiet", checkout], { cwd: root });
  await execute(
    "git",
    ["-C", checkout, "remote", "add", "origin", sourceUrl.href],
    {
      cwd: root,
    },
  );
  const fetchOptions = {
    cwd: root,
    timeout: 180_000,
    maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  };
  try {
    await execute(
      "git",
      [
        "-C",
        checkout,
        "fetch",
        "--quiet",
        "--depth=1",
        "--filter=blob:none",
        "origin",
        commit,
      ],
      fetchOptions,
    );
  } catch {
    await execute(
      "git",
      [
        "-C",
        checkout,
        "fetch",
        "--quiet",
        "origin",
        "+refs/heads/*:refs/remotes/origin/*",
        "+refs/tags/*:refs/tags/*",
      ],
      fetchOptions,
    );
  }
  await execute(
    "git",
    ["-C", checkout, "checkout", "--quiet", "--detach", commit],
    {
      cwd: root,
      timeout: 30_000,
    },
  );
  const { stdout } = await execute(
    "git",
    ["-C", checkout, "rev-parse", "HEAD"],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  if (stdout.trim() !== commit)
    throw new Error(`Exact source checkout drifted for ${module.key}`);
  if (!fs.existsSync(path.join(checkout, "plugin.json")))
    throw new Error(`Exact source is incomplete for ${module.key}`);
  return checkout;
}

async function prepareSource(module, source) {
  const { stdout } = await execute("git", ["-C", source, "rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  });
  if (stdout.trim() !== module.sourceCommit)
    throw new Error(`Source checkout changed for ${module.key}`);
  if (!fs.existsSync(path.join(source, ".gitmodules"))) return;
  await execute("git", ["-C", source, "submodule", "sync", "--recursive"], {
    cwd: root,
    timeout: 60_000,
  });
  await execute(
    "git",
    ["-C", source, "submodule", "update", "--init", "--recursive"],
    {
      cwd: root,
      timeout: 300_000,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    },
  );
}

function copySource(source, target) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  execFileSync(
    "rsync",
    [
      "-a",
      "--exclude",
      ".git",
      "--exclude",
      "build",
      "--exclude",
      "dist",
      `${source}/`,
      `${target}/`,
    ],
    { cwd: root, stdio: "inherit" },
  );
}

function rewriteNativeInspectionSource(file, pattern, replacement, label) {
  const source = fs.readFileSync(file, "utf8");
  const rewritten = source.replace(pattern, replacement);
  if (rewritten === source)
    throw new Error(`Native compatibility rewrite did not match ${label}`);
  fs.writeFileSync(file, rewritten);
}

function applyNativeBuildCompatibility(plugin, work) {
  if (plugin === "SurgeXTRack") {
    // Old bundled fmt declared a user-defined literal with whitespace that
    // current Clang promotes to an error under Surge's own -Werror policy.
    rewriteNativeInspectionSource(
      path.join(work, "surge", "libs", "fmt", "include", "fmt", "format.h"),
      /operator"" _a/g,
      'operator""_a',
      "SurgeXTRack fmt literal",
    );
    // New Clang diagnoses clearing this non-trivial DSP struct under Surge's
    // own -Werror policy. The explicit void pointer preserves the locked
    // source's byte-for-byte initialization in this disposable probe build.
    rewriteNativeInspectionSource(
      path.join(
        work,
        "surge",
        "src",
        "common",
        "dsp",
        "effects",
        "NimbusEffect.cpp",
      ),
      /memset\(processor, 0, sizeof\(\*processor\)\);/g,
      "memset((void*)processor, 0, sizeof(*processor));",
      "SurgeXTRack Nimbus processor initialization",
    );
    // These containers are not dependent names. Older Clang accepted the
    // redundant disambiguator, while current Clang correctly rejects it.
    rewriteNativeInspectionSource(
      path.join(work, "src", "VCO.cpp"),
      /\.template emplace_back\(/g,
      ".emplace_back(",
      "SurgeXTRack VCO container insertion",
    );
  }
  if (plugin === "MindMeldModular") {
    // libc++ no longer accepts an explicit template argument on std::abs.
    // Removing it preserves overload selection for the already typed operand.
    rewriteNativeInspectionSource(
      path.join(work, "src", "ShapeMaster", "Shape.hpp"),
      /std::abs<T>\(/g,
      "std::abs(",
      "MindMeldModular std::abs",
    );
  }
  if (plugin === "SubmarineFree") {
    // Rack added componentlibrary::LightButton after this locked source was
    // released. Rename only the plugin's private symbol in the disposable copy.
    let replacements = 0;
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (entry.isFile() && /\.(?:cpp|hpp|h)$/.test(entry.name)) {
          const source = fs.readFileSync(file, "utf8");
          const rewritten = source.replace(/\bLightButton\b/g, () => {
            replacements += 1;
            return "SubmarineLightButton";
          });
          if (rewritten !== source) fs.writeFileSync(file, rewritten);
        }
      }
    };
    visit(path.join(work, "src"));
    if (!replacements)
      throw new Error(
        "Native compatibility rewrite did not match SubmarineFree LightButton",
      );
  }
  if (plugin === "VCV-Recorder") {
    // This locked FFmpeg configure script ignores the PKG_CONFIG environment
    // variable while probing the executable. Pass the deterministic probe
    // explicitly so clean macOS hosts do not need a system package install.
    rewriteNativeInspectionSource(
      path.join(work, "Makefile"),
      /\t\t--prefix="\$\(DEP_PATH\)"/,
      '\t\t--pkg-config="$(PKG_CONFIG)" \\\n\t\t--prefix="$(DEP_PATH)"',
      "VCV-Recorder FFmpeg pkg-config path",
    );
  }
}

async function prepareLegacyDependencies(plugin, work) {
  if (plugin !== "CaptainsSounds") return;
  // The package's historical fork disappeared and its unpinned master.zip URL
  // now returns 404. Use the canonical upstream revision contemporary with the
  // locked plugin source, verified before it enters the disposable build tree.
  const dependencies = path.join(buildRoot, "dependencies");
  const archive = path.join(dependencies, captainsSoundsMoog.archive);
  const extracted = path.join(dependencies, "captains-sounds-moog");
  await download(captainsSoundsMoog.url, archive, captainsSoundsMoog.sha256);
  await extractArchive(
    archive,
    extracted,
    path.join(captainsSoundsMoog.directory, "src", "util.h"),
  );
  const target = path.join(work, "dep", "MoogLadders-master");
  fs.cpSync(path.join(extracted, captainsSoundsMoog.directory), target, {
    recursive: true,
  });
}

async function buildPlugin(plugin, source, tools) {
  const abi = Number(
    JSON.parse(
      fs.readFileSync(path.join(source, "plugin.json"), "utf8"),
    ).version.split(".")[0],
  );
  const work = path.join(
    buildRoot,
    tools.toolKey,
    "build",
    safeSegment(plugin, "plugin slug"),
  );
  copySource(source, work);
  applyNativeBuildCompatibility(plugin, work);
  const pluginManifestPath = path.join(work, "plugin.json");
  const pluginManifest = JSON.parse(
    fs.readFileSync(pluginManifestPath, "utf8"),
  );
  // The official Library may retain disabled modules for patch compatibility.
  // Rack intentionally omits those from `--screenshot`, so enable them only in
  // this disposable native-inspection copy.
  pluginManifest.modules = (pluginManifest.modules ?? []).map((module) => ({
    ...module,
    ...(module.disabled ? { disabled: false } : {}),
  }));
  atomicJson(pluginManifestPath, pluginManifest);
  await prepareLegacyDependencies(plugin, work);
  const pluginBuildFlags = nativeBuildConfiguration(plugin, abi).extraFlags;
  // Recorder's locked FFmpeg uses pkg-config only to locate the already
  // checksum-verified Opus dependency. Keep this build reproducible on clean
  // macOS hosts where the optional system pkg-config executable is absent.
  const pkgConfigShim =
    plugin === "VCV-Recorder" ? ensureOpusPkgConfigShim() : null;
  const makeArgs = [
    `-j${Math.max(1, Math.min(os.cpus().length, 6))}`,
    `RACK_DIR=${tools.sdk}`,
    ...(pkgConfigShim ? [`PKG_CONFIG=${pkgConfigShim}`] : []),
    ...(abi === 1
      ? [
          "EXTRA_FLAGS=-arch x86_64 -O0",
          "EXTRA_LDFLAGS=-arch x86_64",
          "DEP_FLAGS=-arch x86_64 -O0 -fPIC",
          "DEP_LDFLAGS=-arch x86_64",
          "LUA_CFLAGS=-arch x86_64 -O2 -fPIC -fno-stack-protector",
          `QUICKJS_MAKE_FLAGS=prefix="${path.join(work, "dep")}" CONFIG_DARWIN=y LDFLAGS="-arch x86_64"`,
        ]
      : tools.architecture === "x86_64"
        ? [
            `EXTRA_FLAGS=-arch x86_64 -O0 ${pluginBuildFlags.join(" ")}`.trim(),
            "EXTRA_LDFLAGS=-arch x86_64",
            "DEP_FLAGS=-arch x86_64 -O0 -fPIC",
            "DEP_LDFLAGS=-arch x86_64",
          ]
        : [`EXTRA_FLAGS=-O0 ${pluginBuildFlags.join(" ")}`.trim()]),
  ];
  const makeOptions = {
    cwd: work,
    encoding: "utf8",
    env:
      abi === 1
        ? {
            ...process.env,
            CFLAGS: "-arch x86_64",
            CXXFLAGS: "-arch x86_64",
            LDFLAGS: "-arch x86_64",
          }
        : process.env,
    maxBuffer: 64 * 1024 * 1024,
  };
  const makeCommand =
    abi === 2 && tools.architecture === "x86_64" ? "arch" : "make";
  const makePrefix = makeCommand === "arch" ? ["-x86_64", "make"] : [];
  // Dependency targets must finish before parallel compilation. Several Rack 1
  // packages otherwise race their own downloaded headers and static libraries.
  await execute(makeCommand, [...makePrefix, ...makeArgs, "dep"], makeOptions);
  // Build the real distribution tree so screenshots run with every declared
  // runtime asset, not merely the conventional res/ directory.
  await execute(makeCommand, [...makePrefix, ...makeArgs, "dist"], makeOptions);
  const binary = path.join(work, "plugin.dylib");
  if (!fs.existsSync(binary))
    throw new Error(`Native build did not produce ${binary}`);
  const distribution = path.join(
    work,
    "dist",
    safeSegment(pluginManifest.slug, "manifest slug"),
  );
  if (!fs.existsSync(path.join(distribution, "plugin.dylib")))
    throw new Error(`Native distribution did not produce ${distribution}`);
  return { abi, work, binary, distribution, architecture: tools.architecture };
}

function parseGeometry(file) {
  const modules = new Map();
  if (!fs.existsSync(file)) return modules;
  for (const line of fs
    .readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)) {
    const [model, group, idText, xText, yText, widthText, heightText, widget] =
      line.split("\t");
    const values = [xText, yText, widthText, heightText].map(Number);
    if (
      !model ||
      !group ||
      !widget ||
      values.some((value) => !Number.isFinite(value))
    )
      continue;
    if (!modules.has(model))
      modules.set(model, {
        panel: null,
        params: {},
        inputs: {},
        outputs: {},
        lights: {},
      });
    const target = modules.get(model);
    const position = {
      x: Number(values[0].toFixed(3)),
      y: Number(values[1].toFixed(3)),
      width: Number(values[2].toFixed(3)),
      height: Number(values[3].toFixed(3)),
      centered: true,
      widget,
    };
    if (group === "panel")
      target.panel = { width: position.width, height: position.height };
    else if (["params", "inputs", "outputs", "lights"].includes(group))
      target[group][Number(idText)] = position;
  }
  return modules;
}

async function capturePlugin(plugin, built, tools, realModuleModels = []) {
  const session = path.join(
    buildRoot,
    `rack${built.abi}`,
    "session",
    safeSegment(plugin, "plugin slug"),
  );
  fs.rmSync(session, { recursive: true, force: true });
  const pluginFolder =
    built.abi === 1
      ? "plugins-v1"
      : built.architecture === "x86_64"
        ? "plugins-mac-x64"
        : "plugins-mac-arm64";
  const installed = path.join(session, pluginFolder, plugin);
  fs.cpSync(built.distribution, installed, { recursive: true });
  const geometryFile = path.join(session, "geometry.tsv");
  const command = tools.runtimeArgs.length ? "arch" : tools.runtime;
  const commandArgs = [
    ...(tools.runtimeArgs.length ? [...tools.runtimeArgs, tools.runtime] : []),
    "-u",
    session,
    "-t",
    "1",
  ];
  await execute(command, commandArgs, {
    cwd: root,
    env: {
      ...process.env,
      PEACH_RACK_UI_GEOMETRY: geometryFile,
      ...(realModuleModels.length
        ? { PEACH_RACK_UI_REAL_MODULES: realModuleModels.join(",") }
        : {}),
    },
    encoding: "utf8",
    timeout: 300_000,
    killSignal: "SIGKILL",
    maxBuffer: 32 * 1024 * 1024,
  });
  return {
    geometry: parseGeometry(geometryFile),
    screenshots: path.join(session, "screenshots", plugin),
  };
}

function visibleItems(module) {
  return [
    ...module.params.filter((item) => !item.hidden && !item.contextOnly),
    ...module.inputs.filter((item) => !item.hidden),
    ...module.outputs.filter((item) => !item.hidden),
  ];
}

function mergeNativeGeometry(module, geometry) {
  if (!geometry) return module;
  const merge = (items, group) =>
    items.map((item) => {
      const position = geometry[group][item.id];
      if (position) {
        const { hidden: _staleHidden, ...visibleItem } = item;
        return { ...visibleItem, position };
      }
      // A live Rack ModuleWidget tree is authoritative. A parameter that does
      // not own a ParamWidget is controlled by a custom display/action and
      // must not retain a regex-derived fake control position.
      const { position: _stalePosition, ...withoutPosition } = item;
      // Ports absent from the live ModuleWidget cannot be patched in Rack, so
      // shared enum members that a model variant does not expose are hidden.
      // The same rule applies to parameters: configured DSP state without a
      // ParamWidget belongs to a custom display, a context action, an unused
      // effect slot, or a shared enum member. Rendering a generic knob for it
      // invents UI that the native module does not have.
      return { ...withoutPosition, hidden: true };
    });
  const existingLights = new Map(
    (module.lightWidgets ?? []).map((light) => [light.id, light]),
  );
  const lightWidgets = Object.entries(geometry.lights ?? {})
    .map(([id, position]) => {
      const numericId = Number(id);
      const existing = existingLights.get(numericId);
      const { widget, ...lightPosition } = position;
      return {
        id: numericId,
        widget,
        position: lightPosition,
        ...(existing?.paramId === undefined
          ? {}
          : { paramId: existing.paramId }),
      };
    })
    .sort((left, right) => left.id - right.id);
  return {
    ...module,
    ...(Number.isFinite(geometry.panel?.width) && geometry.panel.width > 0
      ? { width: geometry.panel.width }
      : {}),
    params: merge(module.params, "params"),
    inputs: merge(module.inputs, "inputs"),
    outputs: merge(module.outputs, "outputs"),
    ...(lightWidgets.length ? { lightWidgets } : {}),
  };
}

function pngDimensions(bytes) {
  if (
    bytes.length < 24 ||
    bytes
      .subarray(0, 8)
      .compare(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) !== 0
  )
    throw new Error("Rack screenshot is not a PNG file");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

async function stageArtwork(module, screenshots, write) {
  const png = path.join(
    screenshots,
    `${safeSegment(module.model, "model slug")}.png`,
  );
  if (!fs.existsSync(png))
    throw new Error(`Rack did not generate artwork for ${module.key}`);
  const dimensions = pngDimensions(fs.readFileSync(png));
  if (dimensions.width < module.width || dimensions.height !== 380)
    throw new Error(
      `${module.key} Rack screenshot is ${dimensions.width}x${dimensions.height}, smaller than its ${module.width}x380 ModuleWidget`,
    );
  const relative = path.posix.join(
    path.posix.dirname(module.manifestUrl),
    "panel.webp",
  );
  if (!write) return relative;
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.building-${process.pid}`;
  const crop =
    dimensions.width === module.width
      ? []
      : ["-crop", "0", "0", String(module.width), "380"];
  await execute(
    "cwebp",
    ["-quiet", ...crop, "-lossless", "-z", "6", png, "-o", temporary],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  const encoded = webpDimensions(fs.readFileSync(temporary));
  if (encoded.width !== module.width || encoded.height !== 380) {
    fs.rmSync(temporary, { force: true });
    throw new Error(
      `${module.key} encoded panel dimensions changed unexpectedly`,
    );
  }
  fs.renameSync(temporary, target);
  return relative;
}

function validPosition(position) {
  return Boolean(
    position && Number.isFinite(position.x) && Number.isFinite(position.y),
  );
}

function positionInsidePanel(panelWidth, position) {
  if (!validPosition(position)) return false;
  const width = Number.isFinite(position.width) ? position.width : 0;
  const height = Number.isFinite(position.height) ? position.height : 0;
  const left = position.centered ? position.x - width / 2 : position.x;
  const right = position.centered ? position.x + width / 2 : position.x + width;
  const top = position.centered ? position.y - height / 2 : position.y;
  const bottom = position.centered
    ? position.y + height / 2
    : position.y + height;
  return right >= 0 && left <= panelWidth && bottom >= 0 && top <= 380;
}

function buildErrorText(error) {
  const message = error instanceof Error ? error.message : String(error);
  const stderr = Buffer.isBuffer(error?.stderr)
    ? error.stderr.toString("utf8")
    : typeof error?.stderr === "string"
      ? error.stderr
      : "";
  const interesting = stderr
    .split("\n")
    .filter((line) =>
      /(?:fatal )?error:|undefined symbols|symbol\(s\) not found|not found|screenshot is/i.test(
        line,
      ),
    );
  return [...new Set([message, ...interesting.slice(-40)])]
    .join("\n")
    .slice(-12_000);
}

async function main() {
  const indexPath = path.join(root, "index.json");
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const pluginOption = option("--plugin");
  const keyOption = option("--key");
  const abiOption = Number(option("--abi", "0"));
  if (abiOption && ![1, 2].includes(abiOption))
    throw new Error("--abi must be 1 or 2");
  const write = process.argv.includes("--write");
  const force = process.argv.includes("--force");
  const realModuleWidgets = process.argv.includes("--real-module-widgets");
  const overridesOnly = process.argv.includes("--overrides-only");
  const previousStatePath = path.join(buildRoot, "state.json");
  const retryPlugins =
    process.argv.includes("--retry-failed") && fs.existsSync(previousStatePath)
      ? new Set(
          JSON.parse(fs.readFileSync(previousStatePath, "utf8"))
            .results.filter((result) => result.status === "failed")
            .map((result) => result.plugin),
        )
      : null;
  const candidates = index.packages.filter(
    (module) =>
      (!pluginOption || module.plugin === pluginOption) &&
      (!retryPlugins || retryPlugins.has(module.plugin)) &&
      (!keyOption || module.key === keyOption) &&
      (!abiOption || Number(module.version.split(".")[0]) === abiOption) &&
      (force ||
        !module.screenshotUrl ||
        visibleItems(module).some(
          (item) => !positionInsidePanel(module.width, item.position),
        )),
  );
  const groups = [
    ...Map.groupBy(candidates, (module) => module.plugin).entries(),
  ];
  if (!groups.length)
    throw new Error("No native UI refresh candidates matched");
  const byKey = new Map(index.packages.map((module) => [module.key, module]));
  const toolsByRuntime = new Map();
  const results = [];
  for (const [plugin, modules] of groups) {
    const versions = new Set(
      modules.map((module) => Number(module.version.split(".")[0])),
    );
    if (versions.size !== 1 || ![1, 2].includes([...versions][0]))
      throw new Error(`${plugin} does not have one supported Rack ABI`);
    const abi = [...versions][0];
    if (overridesOnly) {
      for (const module of modules)
        byKey.set(module.key, applyModuleUiOverrides(module));
      results.push({
        plugin,
        abi,
        status: "overrides-complete",
        modules: modules.length,
      });
      continue;
    }
    const { architecture } = nativeBuildConfiguration(plugin, abi);
    const runtimeKey = `${abi}-${architecture}`;
    if (!toolsByRuntime.has(runtimeKey))
      toolsByRuntime.set(runtimeKey, await ensureRackTools(abi, architecture));
    const tools = toolsByRuntime.get(runtimeKey);
    process.stderr.write(
      `[${results.length + 1}/${groups.length}] ${plugin} (Rack ${abi})\n`,
    );
    try {
      const source = await sourceDirectory(modules[0]);
      await prepareSource(modules[0], source);
      const built = await buildPlugin(plugin, source, tools);
      const captured = await capturePlugin(
        plugin,
        built,
        tools,
        realModuleWidgets ? modules.map((module) => module.model) : [],
      );
      const missingModels = modules
        .filter((module) => !captured.geometry.has(module.model))
        .map((module) => module.model);
      if (missingModels.length)
        throw new Error(
          `${plugin} loaded without native geometry for: ${missingModels.join(", ")}`,
        );
      for (const module of modules) {
        let refreshed = applyModuleUiOverrides(
          mergeNativeGeometry(module, captured.geometry.get(module.model)),
        );
        if (!module.screenshotUrl) {
          const artwork = await stageArtwork(
            refreshed,
            captured.screenshots,
            write,
          );
          refreshed = { ...refreshed, screenshotUrl: artwork };
        }
        byKey.set(module.key, refreshed);
      }
      results.push({
        plugin,
        abi,
        status: "complete",
        modules: modules.length,
      });
    } catch (error) {
      results.push({
        plugin,
        abi,
        status: "failed",
        modules: modules.length,
        error: buildErrorText(error),
      });
    }
    atomicJson(path.join(buildRoot, "state.json"), {
      schemaVersion: 1,
      results,
    });
  }
  const failed = results.filter((result) => result.status === "failed");
  if (write) {
    const packages = index.packages.map(
      (module) => byKey.get(module.key) ?? module,
    );
    atomicJson(indexPath, {
      ...index,
      generatedAt: new Date().toISOString(),
      packages,
    });
    for (const module of candidates) {
      const refreshed = byKey.get(module.key);
      if (!refreshed || refreshed === module) continue;
      const manifestPath = path.join(root, refreshed.manifestUrl);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      atomicJson(manifestPath, { ...manifest, module: refreshed });
    }
  }
  process.stdout.write(
    `${JSON.stringify({ candidates: candidates.length, plugins: groups.length, failed: failed.length, write, results }, null, 2)}\n`,
  );
  if (failed.length) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
    );
    process.exitCode = 1;
  });

export {
  mergeNativeGeometry,
  nativeBuildConfiguration,
  parseGeometry,
  positionInsidePanel,
};
