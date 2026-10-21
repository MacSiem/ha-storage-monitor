// Localized presentation; raw values remain available to callers for details/export.
function createFormatUi(language = 'en', timeZone = 'UTC', preferences = {}) {
  const hourCycle = preferences.hourCycle || 'h23';
  const dateLanguage = preferences.dateLanguage || language;
  const clockLanguage = preferences.clockLanguage || language;
  const stamp = value => typeof value === 'number' ? (Number.isFinite(value) ? value : NaN) : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) ? Date.parse(value) : NaN;
  const localized = (value, options, locale = language) => {
    const time = stamp(value);
    if (!Number.isFinite(time)) return null;
    try { return new Intl.DateTimeFormat(locale, {timeZone, ...options}).format(time); } catch (_) { return null; }
  };
  const clock = (value, withOffset = false) => localized(value, {hour:'2-digit', minute:'2-digit', hourCycle, ...(withOffset ? {timeZoneName:'shortOffset'} : {})}, clockLanguage);
  const date = (value, short = false) => localized(value, {day:'numeric', month:'short', ...(short ? {} : {year:'numeric'})}, dateLanguage);
  // A calendar date has no instant or display zone. Use the selected date
  // locale but preserve its literal day, including historical tariff validity.
  const calendarDate = (value, short = false) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const instant = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(instant.getTime()) || instant.toISOString().slice(0, 10) !== value) return null;
    try { return new Intl.DateTimeFormat(dateLanguage, {timeZone:'UTC', day:'numeric', month:'short', ...(short ? {} : {year:'numeric'})}).format(instant); }
    catch (_) { return null; }
  };
  const pointLabel = value => localized(value, {year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hourCycle, timeZoneName:'shortOffset'}, dateLanguage);
  const chartLabels = (values, resolution = 'hour') => {
    const showDate = resolution === 'day' || values.length > 1 && stamp(values.at(-1)) - stamp(values[0]) >= 86400000;
    const labels = values.map(value => resolution === 'day' ? date(value, true) : `${showDate ? date(value, true) + ' ' : ''}${clock(value)}`);
    const counts = new Map();
    for (const label of labels) counts.set(label, (counts.get(label) || 0) + 1);
    return labels.map((label, index) => counts.get(label) < 2 ? label : resolution === 'day' ? pointLabel(values[index])
      : `${showDate ? date(values[index], true) + ' ' : ''}${clock(values[index], true)}`);
  };
  // Compact 24-hour axis notation follows the display zone; full point labels
  // keep the user's clock/date preferences. Never move or discard measurements.
  const chartTicks = (values, resolution = 'hour') => {
    const labels = chartLabels(values, resolution);
    const shortHourly = resolution === 'hour' && values.length > 1 && stamp(values.at(-1)) - stamp(values[0]) <= 26 * 3600000;
    if (!shortHourly) return [...new Set([0, Math.floor((values.length-1)/2), values.length-1])]
      .filter(index => index >= 0 && index < values.length).map(index => ({index, label:labels[index]}));
    const parts = new Intl.DateTimeFormat('en-GB-u-nu-latn', {timeZone, hour:'2-digit', minute:'2-digit', hourCycle:'h23'});
    const ticks = [];
    values.forEach((value, index) => {
      const time = stamp(value);
      if (!Number.isFinite(time)) return;
      const fields = Object.fromEntries(parts.formatToParts(time).map(part => [part.type, part.value]));
      if (Number(fields.hour) % 3 !== 0) return;
      const label = localized(value, {hour:'2-digit', ...(fields.minute === '00' ? {} : {minute:'2-digit'}), hourCycle:'h23'});
      ticks.push({index, label});
    });
    if (!ticks.length) return values.length ? [{index:0, label:labels[0]}] : [];
    const counts = new Map();
    for (const tick of ticks) counts.set(tick.label, (counts.get(tick.label) || 0) + 1);
    return ticks.map(tick => counts.get(tick.label) === 1 ? tick : {...tick, label:clock(values[tick.index], true)});
  };
  const key = JSON.stringify([language, timeZone, hourCycle, dateLanguage, clockLanguage]);
  const numbers = new Intl.NumberFormat(language);
  // Producer Decimal strings carry exact measurement/pricing precision. Keep
  // that precision in Data/details instead of Intl's default three places.
  // Explicit display options and older numeric projections retain their rules.
  const decimals = new Intl.NumberFormat(language, {maximumFractionDigits:100});
  const plurals = new Intl.PluralRules(language);
  const count = (value, forms) => `${numbers.format(value)} ${forms[plurals.select(value)] || forms.other}`;
  // Build1 R12 display roles. The ordinary number() remains exact for Data/history.
  const reportNumber=(value,places=1,signed=false)=>{
    if (typeof value==='boolean' || value===null || !['string','number'].includes(typeof value) || typeof value==='string'&&!value.trim() || !Number.isInteger(places) || places<0 || places>6) return null;
    const parsed=Number(value);if(!Number.isFinite(parsed))return null;
    const normalized=Number(parsed.toFixed(6)),n=Object.is(normalized,-0)?0:normalized;
    const text=new Intl.NumberFormat(language,{minimumFractionDigits:places,maximumFractionDigits:places,roundingMode:'halfExpand',useGrouping:'always'}).format(Math.abs(n));
    const zero=new Intl.NumberFormat(language,{minimumFractionDigits:places,maximumFractionDigits:places,useGrouping:'always'}).format(0);
    return (text===zero?signed?'±':'':n<0?'−':signed?'+':'')+text;
  };
  const reportUnknown=()=>String(language).startsWith('pl')?'Brak danych':'No data';
  const reportEnergy=(value,{role='tile',period='day'}={})=>{const n=reportNumber(value,role==='table'&&period==='day'?2:1);return n===null?reportUnknown():n+' kWh';};
  const reportMoney=(value,currency)=>{const n=reportNumber(value,2),unit=String(language).startsWith('pl')&&currency==='PLN'?'zł':currency;return n===null||typeof unit!=='string'||!unit?reportUnknown():n+' '+unit;};
  const reportRate=(value,currency)=>{const n=reportMoney(value,currency);return n===reportUnknown()?n:n+'/kWh';};
  const reportPercent=(value,{role='share'}={})=>{const n=reportNumber(value,role==='change'?1:0,role==='change');return n===null?reportUnknown():n+'%';};
  const reportPlural=(value,forms)=>{const n=Math.abs(Number(value)),key=String(language).startsWith('pl')&&Number.isFinite(n)&&!Number.isInteger(n)?'few':plurals.select(n);return forms[key]||forms.other||forms.many;};
  const dateTime = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return null;
    const time = Date.parse(value);
    if (!Number.isFinite(time)) return null;
    try { return new Intl.DateTimeFormat(dateLanguage, {timeZone, dateStyle:'medium', timeStyle:'short', hourCycle}).format(new Date(time)); }
    catch (_) { return null; }
  };
  const range = (from, to) => {
    const first = Date.parse(from), last = Date.parse(to);
    if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return null;
    try {
      const day = new Intl.DateTimeFormat(dateLanguage, {timeZone, dateStyle:'medium'});
      const clock = new Intl.DateTimeFormat(clockLanguage, {timeZone, hour:'2-digit', minute:'2-digit', hourCycle});
      return day.format(first) === day.format(last)
        ? `${day.format(first)} (${clock.format(first)}–${clock.format(last)})`
        : `${dateTime(from)} – ${dateTime(to)}`;
    } catch (_) { return null; }
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const periodMarkup = ({start, end, label, source, measured, expected, unit, details = '', sourceTimeZone = ''}) => {
    const local = range(start, end);
    if (!local) return '';
    const coverage = typeof measured === 'number' && Number.isFinite(measured) && typeof expected === 'number' && Number.isFinite(expected)
      ? `${numbers.format(measured)}/${numbers.format(expected)} ${unit}` : '';
    const pl = String(language).startsWith('pl');
    return `<div class="energy-period-v4" style="overflow-wrap:anywhere"><p data-energy-period-summary>${[source, label, local, coverage, timeZone].filter(Boolean).map(escape).join(' · ')}</p><details data-energy-period-details data-energy-period-key="${escape(start + '|' + end)}"><summary style="min-height:44px;box-sizing:border-box;padding:12px 0;display:list-item;list-style-position:inside;cursor:pointer">${pl ? 'Źródło i szczegóły czasu' : 'Source and time details'}</summary><p>${escape(details)}</p>${sourceTimeZone && sourceTimeZone !== timeZone ? `<p>${escape(pl ? 'Strefa pomiarów i granic okresu' : 'Measurement calendar time zone')}: ${escape(sourceTimeZone)}</p>` : ''}<p>UTC: ${escape(start)} — ${escape(end)}</p></details></div>`;
  };
  const capturePeriods = (root, previous, current) => {
    if (!previous || ['epoch','connection','user'].some(key => previous[key] !== current[key])) return [];
    return [...root.querySelectorAll('[data-energy-period-key]')].map(element => ({
      key:element.dataset.energyPeriodKey, open:element.open, focused:root.activeElement === element.querySelector('summary')
    }));
  };
  const restorePeriods = (root, records) => {
    for (const element of root.querySelectorAll('[data-energy-period-key]')) {
      const record = records.find(row => row.key === element.dataset.energyPeriodKey);
      if (!record) continue;
      element.open = record.open;
      if (record.focused) element.querySelector('summary')?.focus({preventScroll:true});
    }
  };
  return {reportNumber, reportEnergy, reportMoney, reportRate, reportPercent, reportPlural, language, dateLanguage, clockLanguage, hourCycle, timeZone, key, clock, date, calendarDate, pointLabel, chartLabels, chartTicks, number:(value, options)=>options ? new Intl.NumberFormat(language, options).format(value) : (typeof value === 'string' ? decimals : numbers).format(value), count, dateTime, range, periodMarkup, capturePeriods, restorePeriods};
}
// Presentation follows the HA profile; measurement and tariff calendars remain separate.
createFormatUi.forHass = hass => {
  const locale = hass?.locale || {};
  const systemLanguage = typeof navigator !== 'undefined' ? navigator.language : undefined;
  const language = locale.language || hass?.language || systemLanguage || 'en';
  const validZone = value => {
    if (typeof value !== 'string' || !(value === 'UTC' || value.includes('/')) || /^[+-]/.test(value)) return null;
    try { new Intl.DateTimeFormat('en', {timeZone:value}).format(0); return value; } catch (_) { return null; }
  };
  let systemZone, systemLocale;
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    systemZone = validZone(resolved.timeZone);
    // Device region can differ from navigator's preferred content language.
    systemLocale = resolved.locale;
  } catch (_) {}
  const systemRegion = systemLocale || systemLanguage || language;
  const serverZone = validZone(hass?.config?.time_zone);
  const timeZone = (locale.time_zone === 'server' ? serverZone : systemZone) || serverZone || 'UTC';
  const clockLanguage = locale.time_format === 'system' ? systemRegion : language;
  const hourCycle = locale.time_format === '12' ? 'h12' : locale.time_format === '24' ? 'h23'
    : new Intl.DateTimeFormat(clockLanguage, {hour:'numeric'}).resolvedOptions().hourCycle;
  return createFormatUi(language, timeZone, {hourCycle, clockLanguage, dateLanguage:locale.date_format === 'system' ? systemRegion : language});
};
// Node tests use the canonical factory; vendored cards keep it local.
if (typeof module !== 'undefined') module.exports = {createFormatUi};
