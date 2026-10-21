// HA Tools v3: vendored inside each consumer's own closure, never a window API.
function createUiV3({ language = 'en' } = {}) {
  const pl = String(language).startsWith('pl');
  const states = {
    success: ['Success', 'Sukces', '✓'],
    partial: ['Partial', 'Częściowo', '½'],
    unconfirmed: ['Unconfirmed', 'Niepotwierdzony', '?'],
    error: ['Error', 'Błąd', '✕'],
    not_checked: ['Not checked', 'Nie sprawdzono', '–'],
    no_data: ['No data', 'Brak danych', '∅'],
  };
  const status = (value) => {
    const code = typeof value === 'string' && Object.hasOwn(states, value) ? value : 'not_checked';
    const row = states[code];
    return { code, label: row[pl ? 1 : 0], icon: row[2], countsAsSuccess: code === 'success' };
  };
  const statusHtml = (value) => {
    const result = status(value);
    return `<span class="ht-result-state ht-result-state--${result.code}" data-result-state="${result.code}"><span aria-hidden="true">${result.icon}</span> ${result.label}</span>`;
  };
  const parseColor = value => {
    const text = typeof value === 'string' ? value.trim() : '';
    const hex = /^#([a-f0-9]{3}|[a-f0-9]{6})$/i.exec(text);
    if (hex) return (hex[1].length === 3 ? [...hex[1]].map(c=>c+c).join('') : hex[1]).match(/../g).map(c=>parseInt(c,16));
    const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*1(?:\.0+)?)?\s*\)$/i.exec(text);
    return rgb ? rgb.slice(1,4).map(c=>Math.min(255,Math.round(Number(c)))) : null;
  };
  const hexColor = rgb => '#' + rgb.map(c=>c.toString(16).padStart(2,'0')).join('');
  const luminance = rgb => rgb.map(c=>c/255).map(c=>c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4)
    .reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
  const ratio = (a,b) => (Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  const primaryColors = (value, {dark = false} = {}) => {
    const original = parseColor(value) || parseColor(dark ? '#818cf8' : '#2563eb');
    const white = [255,255,255], ink = [15,23,42];
    const foreground = ratio(original,white) >= ratio(original,ink) ? white : ink;
    const target = foreground === white ? 0 : 255;
    let fill = original;
    // The nearest 5% step keeps a supplied theme color when it is readable.
    for (let step=1; ratio(fill,foreground)<4.5 && step<=20; step++)
      fill = original.map(c=>Math.round(c+(target-c)*step*.05));
    return {fill:hexColor(fill),foreground:hexColor(foreground),contrast:ratio(fill,foreground)};
  };
  const applyTheme = host => {
    const view = host?.ownerDocument?.defaultView;
    if (!host?.isConnected || !view?.getComputedStyle) return null;
    const raw = view.getComputedStyle(host).getPropertyValue('--primary-color').trim();
    let resolved = raw;
    // Resolve ordinary named colors through the browser without a persistent node.
    if (raw && !parseColor(raw) && !raw.includes('var(') && raw !== 'transparent' && view.CSS?.supports?.('color',raw)) {
      const probe = host.ownerDocument.createElement('span');
      probe.style.display = 'none'; probe.style.color = raw;
      host.append(probe);
      try { resolved = view.getComputedStyle(probe).color; } finally { probe.remove(); }
    }
    const result = primaryColors(resolved,{dark:host.classList.contains('bento-dark') || host.classList.contains('hat-dark')});
    for (const [key,value] of [['--hat-primary-fill-computed',result.fill],['--hat-on-primary-computed',result.foreground]])
      if (host.style.getPropertyValue(key) !== value) host.style.setProperty(key,value);
    return result;
  };
  // v5.3: public tokens stay inheritable; private defaults follow the HA dark flag.
  const css = `
:host, .hat {
  color-scheme: light;
  /* powierzchnie i tekst — z motywu HA, w nawiasie wartość domyślna */
  --_hat-bg:       var(--primary-background-color, #f3f4f6);
  --_hat-card:     var(--ha-card-background, var(--card-background-color, #ffffff));
  --_hat-chip:     var(--secondary-background-color, #f3f4f6);
  --_hat-border:   var(--ha-card-border-color, var(--divider-color, #e5e7eb));
  --_hat-text:     var(--primary-text-color, #111827);
  --_hat-text-2:   var(--secondary-text-color, #4b5563);
  --_hat-text-3:   var(--hat-text-3-theme, #6b7280);   /* tylko na tle karty; ≥ 12 px */
  --_hat-grid:     color-mix(in srgb, var(--hat-text, var(--_hat-text)) 6%, var(--hat-card, var(--_hat-card)));
  --_hat-radius:   var(--ha-card-border-radius, 12px);

  /* Computed values supplied by the host when available; literals are explicit fallback colors, not dynamic contrast. */
  --_hat-primary:      var(--primary-color, #2563eb);
  --_hat-primary-fill: var(--hat-primary-fill-computed, #2563eb);
  --_hat-on-primary:   var(--hat-on-primary-computed, #ffffff);

  /* stany: wypełnienie (≥ 3:1) i tekst (≥ 4,5:1) */
  --_hat-good: #0ca30c;  --_hat-good-text: #15803d;
  --_hat-warn: #fab219;  --_hat-warn-text: #a16207;  --_hat-warn-readout: #9a5b05;
  --_hat-crit: #d03b3b;  --_hat-crit-text: #b91c1c;

  /* serie (W23) */
  --_hat-s1: #2a78d6; --_hat-s2: #eb6834; --_hat-s3: #1baf7a; --_hat-s4: #eda100; --_hat-s5: #e87ba4;
  --_hat-zone-cheap: #1baf7a; --_hat-zone-exp: #2a78d6;
  --_hat-d1: #eb6834; --_hat-d2: #6250d6; --_hat-d3: #e87ba4; --_hat-d4: #eda100;
  --_hat-unmeasured: #9ca3af;

  /* typografia (W16: treść ≥ 14, metadane ≥ 12, wersaliki ≥ 11) */
  --_hat-font: var(--ha-font-family-body, Roboto, Inter, system-ui, sans-serif);
  --_hat-fs-display: 28px;  --_hat-fs-number2: 20px;  --_hat-fs-title: 16px;
  --_hat-fs-body: 14px;     --_hat-fs-meta: 12px;     --_hat-fs-caps: 11px;
  --_hat-fw-regular: 400;   --_hat-fw-medium: 500;    --_hat-fw-bold: 600;

  /* odstępy (siatka 4 px) i rozmiary */
  --_hat-space-1: 4px; --_hat-space-2: 8px; --_hat-space-3: 12px; --_hat-space-4: 16px; --_hat-space-5: 24px;
  --_hat-icon-lg: 36px; --_hat-icon-lg-glyph: 20px;   /* nagłówek, kafelek */
  --_hat-icon-md: 28px; --_hat-icon-md-glyph: 16px;   /* wiersz, launcher */
  --_hat-icon-sm: 24px; --_hat-icon-sm-glyph: 14px;   /* odznaka */
  --_hat-tint: 18%;                                   /* tło ikony = akcent 18 % */
  --_hat-pill-h: 32px;  --_hat-pill-h-mini: 28px;  --_hat-target: 44px;
  --_hat-row-h: 56px;   --_hat-gap: 8px;           /* siatka Sections HA */
  --_hat-motion: 150ms ease;
  font-family: var(--hat-font, var(--_hat-font));
  color: var(--hat-text, var(--_hat-text));
}

/* ---------- 2. Tokeny: ciemny (hass.themes.darkMode → klasa .hat-dark) ---------- */
:host(.hat-dark), :host(.bento-dark), .hat.hat-dark {
  --_hat-bg:     var(--primary-background-color, #111214);
  --_hat-card:   var(--ha-card-background, var(--card-background-color, #1c1c1e));
  --_hat-chip:   var(--secondary-background-color, #26272b);
  --_hat-border: var(--ha-card-border-color, var(--divider-color, #2e2f33));
  --_hat-text:   var(--primary-text-color, #e5e7eb);
  --_hat-text-2: var(--secondary-text-color, #a1a1aa);
  --_hat-text-3: var(--hat-text-3-theme, #8b8b93);
  --_hat-primary-fill: var(--hat-primary-fill-computed, #818cf8);
  --_hat-on-primary:   var(--hat-on-primary-computed, #0f172a);
  --_hat-good: #22c55e;  --_hat-good-text: #22c55e;
  --_hat-warn: #fab219;  --_hat-warn-text: #fab219;  --_hat-warn-readout: #fab219;
  --_hat-crit: #e05252;  --_hat-crit-text: #f87171;
  --_hat-s1: #3987e5; --_hat-s2: #d95926; --_hat-s3: #199e70; --_hat-s4: #c98500; --_hat-s5: #d55181;
  --_hat-zone-cheap: #199e70; --_hat-zone-exp: #3987e5;
  --_hat-d1: #d95926; --_hat-d2: #9085e9; --_hat-d3: #d55181; --_hat-d4: #c98500;
  --_hat-unmeasured: #6b7280;
  color-scheme: dark;
}



.ht-result-state { display:inline-flex;align-items:center;gap:var(--hat-space-1,4px);min-height:24px;padding:0 10px;border:1px solid currentColor;border-radius:999px;font-size:var(--hat-fs-meta,12px);font-weight:600;line-height:16px;white-space:normal;background:transparent; }
.ht-result-state--success { color:var(--hat-good-text, var(--_hat-good-text)); }
.ht-result-state--partial,.ht-result-state--unconfirmed { color:var(--hat-warn-text, var(--_hat-warn-text)); }
.ht-result-state--error { color:var(--hat-crit-text, var(--_hat-crit-text)); }
.ht-result-state--not_checked,.ht-result-state--no_data { color:var(--hat-text-2, var(--_hat-text-2)); }
.ht-result-state--no_data { border-style:dashed; }
`;
  return { status, statusHtml, css, primaryColors, applyTheme };
}
// Node tests use the canonical factory; this line is excluded from runtime copies.
if (typeof module !== 'undefined' && module.exports) module.exports = { createUiV3 };
