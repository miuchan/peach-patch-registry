#!/usr/bin/env node
import fs from "node:fs";
import {
  parseLibraryModuleHtml,
  parseLibraryModuleUrl,
} from "../lib/vcv-library.ts";
import { clearMissingScreenshot } from "./refresh-screenshot-status.mjs";
import {
  hasCompleteUiGeometry,
  mergeUiGeometry,
  uiGeometryIssueCount,
} from "./refresh-ui-geometry.mjs";
import {
  mergePanelWidth,
  rackPanelWidth,
  svgPanelWidthFromText,
  webpDimensions,
} from "./refresh-panel-widths.mjs";

const request = JSON.parse(fs.readFileSync(0, "utf8"));

function dispatch(value) {
  switch (value.operation) {
    case "parse-library-url":
      return parseLibraryModuleUrl(value.url);
    case "parse-library-html":
      return parseLibraryModuleHtml(
        value.html,
        value.plugin,
        value.model,
        value.fallbackVersion,
      );
    case "clear-missing-screenshot":
      return clearMissingScreenshot(value.module, value.status);
    case "inspect-ui-geometry":
      return {
        complete: hasCompleteUiGeometry(value.module),
        issueCount: uiGeometryIssueCount(value.module),
      };
    case "merge-ui-geometry":
      return mergeUiGeometry(value.current, value.refreshed);
    case "inspect-panel-screenshot": {
      const dimensions = webpDimensions(Buffer.from(value.bytes, "base64"));
      return { dimensions, width: rackPanelWidth(dimensions) };
    }
    case "inspect-panel-svg":
      return { width: svgPanelWidthFromText(value.svg) };
    case "merge-panel-width":
      return mergePanelWidth(value.module, value.width);
    default:
      throw new Error(
        `Unsupported registry maintenance operation: ${value.operation}`,
      );
  }
}

try {
  process.stdout.write(`${JSON.stringify(dispatch(request))}\n`);
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
