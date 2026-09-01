"use strict";

const assert = require("node:assert/strict");

global.window = global;
global.window.addEventListener = () => {};
global.document = { body: {}, querySelectorAll: () => [] };
Object.defineProperty(global, "navigator", {
  configurable: true,
  value: { language: "en-US" },
});
global.setTimeout = () => 0;
global.setInterval = () => 0;
global.clearInterval = () => {};
global.HTMLElement = class {
  constructor() {
    this.tagName = "HA-STORAGE-MONITOR";
  }

  attachShadow() {
    this.shadowRoot = {};
  }
};

const definitions = new Map();
global.customElements = {
  define: (name, constructor) => definitions.set(name, constructor),
  get: (name) => definitions.get(name),
};

require("../ha-storage-monitor.js");

const Card = customElements.get("ha-storage-monitor");
const card = new Card();
const hostile = '<img src=x onerror="alert(1)">';
const escaped = "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;";
const hostileArray = [hostile];
const data = {
  diskTotal: 10,
  diskUsed: 5,
  diskFree: 5,
  usedPercent: 50,
  hostname: hostile,
  osVersion: hostile,
  categories: [{ name: hostile, size: 1, color: "#000", icon: "x" }],
  addons: [{ name: hostile, slug: hostile, size: 12, state: hostile, version: hostile }],
  backups: [{ name: hostile, slug: hostile, size: 1, type: hostile }],
  integrations: [{ title: hostile, domain: hostile, state: hostile, source: hostile }],
  dbSizeMB: 0,
};

for (const html of [
  card._renderOverview(data),
  card._renderAddonsAndIntegrations(data),
  card._renderBackups(data),
  card._renderIntegrations(data),
  card._renderTopConsumers(data),
  card._renderCleanup(data),
]) {
  assert.equal(html.includes(hostile), false, html);
  assert.equal(html.includes(escaped), true, html);
}

const hostileArrayData = {
  ...data,
  hostname: hostileArray,
  osVersion: hostileArray,
  categories: [{ name: hostileArray, size: 1, color: "#000", icon: "x" }],
};
const arrayHtml = card._renderOverview(hostileArrayData);
assert.equal(arrayHtml.includes(hostile), false, arrayHtml);
assert.equal(arrayHtml.includes(escaped), true, arrayHtml);

const unavailableHtml = card._renderOverview({
  ...data,
  diskTotal: null,
  diskUsed: null,
  diskFree: null,
  usedPercent: null,
  categories: [
    { name: "Database (Recorder)", size: 0, color: "#000", icon: "x", measured: false },
  ],
});
assert.equal(unavailableHtml.includes("32.0 GB"), false, unavailableHtml);
assert.equal(unavailableHtml.includes("10.0 GB"), false, unavailableHtml);
assert.equal(unavailableHtml.includes("N/A"), true, unavailableHtml);

const tinyMeasuredAddonHtml = card._renderTopConsumers({
  backups: [],
  addons: [
    { name: "Tiny measured add-on", size: 0.25, measured: true },
    { name: "Unavailable add-on", size: 0, measured: false },
  ],
  dbSizeMB: 0,
});
assert.equal(tinyMeasuredAddonHtml.includes("Tiny measured add-on"), true, tinyMeasuredAddonHtml);
assert.equal(tinyMeasuredAddonHtml.includes("Unavailable add-on"), false, tinyMeasuredAddonHtml);

const partialCategoryHtml = card._renderOverview({
  ...data,
  categories: [
    {
      name: "Add-ons",
      size: 0.25,
      color: "#000",
      icon: "x",
      partial: true,
    },
  ],
});
assert.equal(partialCategoryHtml.includes("partial — some unavailable"), true, partialCategoryHtml);
