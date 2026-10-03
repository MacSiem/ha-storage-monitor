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

const renderedSurfaces = [
  card._renderOverview(data),
  card._renderAddonsAndIntegrations(data),
  card._renderBackups(data),
  card._renderIntegrations(data),
  card._renderTopConsumers(data),
  card._renderCleanup(data),
];
for (const html of renderedSurfaces) {
  assert.equal(html.includes(hostile), false, html);
}
assert.equal(renderedSurfaces.slice(0, 5).every(html => html.includes(escaped)), true);

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

// Native panel_custom gives hass directly without calling Lovelace setConfig.
const defaultPanel = new Card();
defaultPanel._hass = { user: { is_admin: false } };
defaultPanel.shadowRoot.querySelector = () => null;
defaultPanel.shadowRoot.querySelectorAll = () => [];
defaultPanel.shadowRoot.getElementById = () => ({ addEventListener() {} });
defaultPanel._render();
assert.match(defaultPanel.shadowRoot.innerHTML, /<h2>Storage Monitor<\/h2>/);

async function verifyMeasuredStorageOnly() {
  card._updateContent = () => {};
  card._hass = {
    user: { id: 'qa-admin', is_admin: true },
    callWS: async message => {
      if (message.type === 'config_entries/get') return [
        { domain: 'test', source: 'user', state: 'loaded' },
        { domain: 'other', source: 'import', state: 'loaded' },
      ];
      if (message.type === 'recorder/info') return { recording: true };
      if (message.endpoint === '/host/info') return { disk_total: 100, disk_used: 10, disk_free: 80 };
      if (message.endpoint === '/os/info') return { version: 'test' };
      if (message.endpoint === '/addons') return { addons: [{ slug: 'sample', name: 'Sample', state: 'started' }] };
      if (message.endpoint === '/addons/sample/info') return { disk_usage: 50 * 1024 * 1024 };
      if (message.endpoint === '/backups') return { backups: [
        { slug: 'measured', name: 'Measured', size_bytes: 100 * 1024 * 1024 },
        { slug: 'unmeasured', name: 'Unmeasured', size: 10 },
      ] };
      throw new Error(`unexpected ${message.type}`);
    },
  };
  await card._loadStorageData();
  const byName = Object.fromEntries(card._storageData.categories.map(row => [row.name, row]));
  assert.equal(byName['Backups'].size, 100);
  assert.equal(byName['Backups'].partial, true);
  assert.equal(byName['Add-ons'].size, 50);
  assert.equal(byName['Database (Recorder)'].measured, false);
  assert.equal(byName['Integrations'].measured, false);
  assert.equal(card._storageData.intCount, 2);
  const integrations = card._renderAddonsAndIntegrations(card._storageData);
  assert.match(integrations, /Config entries: 2/);
  assert.match(integrations, />user</);
  assert.doesNotMatch(integrations, /HACS: 0|Core: 2/);
  assert.equal(byName['System & Other'].measured, false);
  assert.equal(card._storageData.diskUsed, 10);
  const files = card._renderFiles(card._storageData);
  assert.match(files, /N\/A/);
  assert.doesNotMatch(files, /512\.0 MB|204\.8 MB|estimated breakdown/i);
  const cleanup = card._renderCleanup({
    ...card._storageData,
    backups: Array.from({ length: 6 }, (_, index) => ({ name: `Backup ${index}`, size: 1, measured: true })),
  });
  assert.match(cleanup, /Review backup retention/);
  assert.doesNotMatch(cleanup, /can be removed|Potential savings/);

  const availableCall = card._hass.callWS;
  card._hass.callWS = message => message.type === 'config_entries/get'
    ? Promise.reject({ code: 'unauthorized' }) : availableCall(message);
  await card._loadStorageData();
  assert.equal(card._storageData.intCount, null);
  assert.equal(card._storageData.integrationsAvailable, false);
  assert.match(card._renderAddonsAndIntegrations(card._storageData), /Config entries: N\/A/);
  assert.match(card._renderIntegrations(card._storageData), /Integration list unavailable/);
  // Match the production failure: every installed add-on lacks disk_usage.
  card._hass.callWS = message => message.endpoint === '/addons/sample/info'
    ? Promise.resolve({}) : availableCall(message);
  await card._loadStorageData();
  let addonsCategory = card._storageData.categories.find(row => row.name === 'Add-ons');
  assert.equal(addonsCategory.measured, false, 'No measured add-on sizes must be unavailable');
  assert.match(card._renderOverview(card._storageData), /N\/A/);
  assert.doesNotMatch(card._renderOverview(card._storageData), /0 KB \(partial/);

  // A measured zero is valid, including when reported by an empty installation.
  card._hass.callWS = message => message.endpoint === '/addons/sample/info'
    ? Promise.resolve({ disk_usage: 0 }) : availableCall(message);
  await card._loadStorageData();
  addonsCategory = card._storageData.categories.find(row => row.name === 'Add-ons');
  assert.equal(addonsCategory.measured, true, 'An explicit zero is a measurement');
  assert.equal(card._storageData.addons[0].measured, true);
  assert.equal(addonsCategory.partial, false);

  // Unavailable inventory must not masquerade as an empty measured category.
  card._hass.callWS = message => ['/addons', '/backups'].includes(message.endpoint)
    ? Promise.reject({ code: 'unauthorized' }) : availableCall(message);
  await card._loadStorageData();
  assert.equal(card._storageData.categories.find(row => row.name === 'Add-ons').measured, false);
  assert.equal(card._storageData.categories.find(row => row.name === 'Backups').measured, false);

}

verifyMeasuredStorageOnly().catch(error => { console.error(error); process.exitCode = 1; });
