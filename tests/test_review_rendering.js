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
