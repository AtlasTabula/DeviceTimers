/*
 * Device Timers card
 * Served and loaded automatically by the Device Timers integration.
 *
 *   type: custom:device-timers-card
 *   title: Device Timers          # optional
 *   devices:                      # optional - leave out to show every device timer
 *     - switch.living_room_radiator
 *     - light.bathroom_heat_lamp
 *   layout: grid                  # grid | list
 *   only_active: false            # true = only show devices with a running timer
 *   quick_extend: [15, 60]        # extra "+N min" buttons (the device's own Extend step is always shown)
 */

const CARD_VERSION = "2.0.2";
const DOMAIN = "device_timers";
const RING_R = 42;
const RING_C = 2 * Math.PI * RING_R;
const WARN_SECONDS = 5 * 60;

const DOMAIN_ICONS = {
  climate: "mdi:radiator",
  fan: "mdi:fan",
  light: "mdi:lightbulb",
  humidifier: "mdi:air-humidifier",
  water_heater: "mdi:water-boiler",
  input_boolean: "mdi:toggle-switch-outline",
  switch: "mdi:power-socket-uk",
};

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const pad = (n) => String(n).padStart(2, "0");

function formatRemaining(secs) {
  secs = Math.max(0, Math.ceil(secs));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatClock(hass, date) {
  const locale = hass?.locale?.language || undefined;
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

// ------------------------------------------------------------ translations
// The card follows the language set in the user's Home Assistant profile.
// To add a language, copy the "en" block, translate the values and keep the
// {placeholders} unchanged.

const STRINGS = {
  en: {
    no_running: "No timers running",
    none_found: "No device timers found. Add devices under {path}.",
    path: "Settings → Devices & services → Device Timers",
    not_set_up: "Not set up in Device Timers",
    turn_off: "Turn off",
    turn_on_for: "Turn on for {minutes} min",
    add_minutes: "Add {minutes} minutes",
    stop_keep_on: "Stop timer, keep on",
    na: "N/A",
    on: "On",
    off: "Off",
    unavailable: "Unavailable",
    off_at: "Off at {time}",
    no_timer: "No timer",
    auto_off_disabled: "Auto-off disabled",
    min_timer: "{minutes} min timer",
    chip_m: "+{n}m",
    chip_h: "+{n}h",
    ed_title: "Title",
    ed_devices: "Devices (leave empty to show all)",
    ed_layout: "Layout",
    ed_only_active: "Only show running timers",
    ed_quick: "Extra extend buttons (each device's own Extend step is always shown)",
    ed_grid: "Grid (large rings)",
    ed_list: "List (compact rows)",
    ed_plus_min: "+{minutes} min",
    description: "Turn devices on, see the time left on their auto-off timers, and extend them.",
  },
  pl: {
    no_running: "Brak działających timerów",
    none_found: "Nie znaleziono timerów urządzeń. Dodaj urządzenia w: {path}.",
    path: "Ustawienia → Urządzenia oraz usługi → Device Timers",
    not_set_up: "Nie skonfigurowano w Device Timers",
    turn_off: "Wyłącz",
    turn_on_for: "Włącz na {minutes} min",
    add_minutes: "Dodaj {minutes} min",
    stop_keep_on: "Zatrzymaj timer, pozostaw włączone",
    na: "B/D",
    on: "Wł.",
    off: "Wył.",
    unavailable: "Niedostępne",
    off_at: "Wyłączenie o {time}",
    no_timer: "Bez timera",
    auto_off_disabled: "Automatyczne wyłączanie nieaktywne",
    min_timer: "Timer {minutes} min",
    chip_m: "+{n} min",
    chip_h: "+{n} h",
    ed_title: "Tytuł",
    ed_devices: "Urządzenia (pozostaw puste, aby pokazać wszystkie)",
    ed_layout: "Układ",
    ed_only_active: "Pokazuj tylko działające timery",
    ed_quick: "Dodatkowe przyciski przedłużenia (przycisk Przedłuż każdego urządzenia jest zawsze widoczny)",
    ed_grid: "Siatka (duże pierścienie)",
    ed_list: "Lista (kompaktowe wiersze)",
    ed_plus_min: "+{minutes} min",
    description: "Włączaj urządzenia, sprawdzaj czas pozostały do automatycznego wyłączenia i przedłużaj go.",
  },
  bg: {
    no_running: "Няма работещи таймери",
    none_found: "Не са намерени таймери за устройства. Добавете устройства от {path}.",
    path: "Настройки → Устройства и услуги → Device Timers",
    not_set_up: "Не е настроено в Device Timers",
    turn_off: "Изключване",
    turn_on_for: "Включване за {minutes} мин",
    add_minutes: "Добавяне на {minutes} мин",
    stop_keep_on: "Спиране на таймера, устройството остава включено",
    na: "Н/Д",
    on: "Вкл.",
    off: "Изкл.",
    unavailable: "Недостъпно",
    off_at: "Изключване в {time}",
    no_timer: "Без таймер",
    auto_off_disabled: "Автоматичното изключване е спряно",
    min_timer: "Таймер {minutes} мин",
    chip_m: "+{n} мин",
    chip_h: "+{n} ч",
    ed_title: "Заглавие",
    ed_devices: "Устройства (оставете празно, за да се показват всички)",
    ed_layout: "Изглед",
    ed_only_active: "Показване само на работещите таймери",
    ed_quick: "Допълнителни бутони за удължаване (бутонът „Удължи“ на всяко устройство се показва винаги)",
    ed_grid: "Мрежа (големи пръстени)",
    ed_list: "Списък (компактни редове)",
    ed_plus_min: "+{minutes} мин",
    description: "Включвайте устройства, вижте оставащото време до автоматичното им изключване и го удължавайте.",
  },
  fr: {
    no_running: "Aucun minuteur en cours",
    none_found: "Aucun minuteur d'appareil trouvé. Ajoutez des appareils dans {path}.",
    path: "Paramètres → Appareils et services → Device Timers",
    not_set_up: "Non configuré dans Device Timers",
    turn_off: "Éteindre",
    turn_on_for: "Allumer pour {minutes} min",
    add_minutes: "Ajouter {minutes} minutes",
    stop_keep_on: "Arrêter le minuteur, laisser allumé",
    na: "N/D",
    on: "Allumé",
    off: "Éteint",
    unavailable: "Indisponible",
    off_at: "Arrêt à {time}",
    no_timer: "Sans minuteur",
    auto_off_disabled: "Arrêt automatique désactivé",
    min_timer: "Minuteur de {minutes} min",
    chip_m: "+{n} min",
    chip_h: "+{n} h",
    ed_title: "Titre",
    ed_devices: "Appareils (laisser vide pour tout afficher)",
    ed_layout: "Disposition",
    ed_only_active: "Afficher uniquement les minuteurs en cours",
    ed_quick: "Boutons de prolongation supplémentaires (le bouton Prolonger de chaque appareil est toujours affiché)",
    ed_grid: "Grille (grands anneaux)",
    ed_list: "Liste (lignes compactes)",
    ed_plus_min: "+{minutes} min",
    description: "Allumez des appareils, voyez le temps restant avant leur arrêt automatique et prolongez-le.",
  },
  de: {
    no_running: "Keine laufenden Timer",
    none_found: "Keine Geräte-Timer gefunden. Füge Geräte unter {path} hinzu.",
    path: "Einstellungen → Geräte & Dienste → Device Timers",
    not_set_up: "Nicht in Device Timers eingerichtet",
    turn_off: "Ausschalten",
    turn_on_for: "Für {minutes} min einschalten",
    add_minutes: "{minutes} Minuten hinzufügen",
    stop_keep_on: "Timer stoppen, eingeschaltet lassen",
    na: "k. A.",
    on: "An",
    off: "Aus",
    unavailable: "Nicht verfügbar",
    off_at: "Aus um {time}",
    no_timer: "Kein Timer",
    auto_off_disabled: "Automatisches Ausschalten deaktiviert",
    min_timer: "{minutes}-min-Timer",
    chip_m: "+{n} min",
    chip_h: "+{n} h",
    ed_title: "Titel",
    ed_devices: "Geräte (leer lassen, um alle anzuzeigen)",
    ed_layout: "Layout",
    ed_only_active: "Nur laufende Timer anzeigen",
    ed_quick: "Zusätzliche Verlängern-Tasten (die eigene Verlängern-Taste jedes Geräts wird immer angezeigt)",
    ed_grid: "Raster (große Ringe)",
    ed_list: "Liste (kompakte Zeilen)",
    ed_plus_min: "+{minutes} min",
    description: "Schalte Geräte ein, sieh die Restzeit bis zum automatischen Ausschalten und verlängere sie.",
  },
};

/** "pt-BR" -> "pt-br" if translated, else "pt", else "en". */
function resolveLanguage(language) {
  const lang = String(language || "en").toLowerCase();
  if (STRINGS[lang]) return lang;
  const base = lang.split(/[-_]/)[0];
  return STRINGS[base] ? base : "en";
}

function languageOf(hass) {
  return resolveLanguage(hass?.locale?.language || hass?.language || document.documentElement.lang);
}

/** Translated string with {placeholders} filled in (plain text - escape before inserting as HTML). */
function localize(hass, key, vars = {}) {
  const text = STRINGS[languageOf(hass)][key] ?? STRINGS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
}

/** All Device Timers "Time remaining" sensors, keyed by the controlled device entity_id. */
function findTimers(hass) {
  const timers = {};
  if (!hass) return timers;
  for (const [entityId, stateObj] of Object.entries(hass.states)) {
    if (!entityId.startsWith("sensor.")) continue;
    const reg = hass.entities?.[entityId];
    if (reg && reg.platform !== DOMAIN) continue;
    const a = stateObj.attributes;
    if (a.device === undefined || a.total_minutes === undefined || a.extend_minutes === undefined) continue;
    if (!reg && !("auto_off_entity" in a)) continue; // no registry info: require our attribute set
    timers[a.device] = entityId;
  }
  return timers;
}

class DeviceTimersCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("device-timers-card-editor");
  }

  static getStubConfig() {
    return { title: "Device Timers", devices: [], layout: "grid" };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._signature = "";
    this._tick = null;
    this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    if (config.devices && !Array.isArray(config.devices)) {
      throw new Error("'devices' must be a list of entity IDs");
    }
    this._config = {
      title: "Device Timers",
      devices: [],
      layout: "grid",
      only_active: false,
      quick_extend: [],
      ...config,
    };
    this._signature = "";
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  connectedCallback() {
    this._tick = window.setInterval(() => this._updateCountdowns(), 1000);
  }

  disconnectedCallback() {
    window.clearInterval(this._tick);
    this._tick = null;
  }

  getCardSize() {
    const n = this._items().length || 1;
    return this._config?.layout === "list" ? 1 + n : 1 + Math.ceil(n / 2) * 3;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 4 };
  }

  // ------------------------------------------------------------------ data

  _items() {
    const hass = this._hass;
    if (!hass || !this._config) return [];
    const timers = findTimers(hass);
    const wanted = this._config.devices?.length ? this._config.devices : Object.keys(timers).sort();
    const items = [];
    for (const target of wanted) {
      const sensorId = timers[target];
      const device = hass.states[target];
      const sensor = sensorId ? hass.states[sensorId] : undefined;
      const a = sensor?.attributes || {};
      const item = {
        target,
        sensorId,
        missing: !sensor,
        name: a.timer_name || device?.attributes.friendly_name || target,
        icon: device?.attributes.icon || DOMAIN_ICONS[target.split(".")[0]] || "mdi:power",
        unavailable: !device || ["unavailable", "unknown"].includes(device.state),
        on: !!device && !["off", "unavailable", "unknown"].includes(device.state),
        active: !!a.active,
        endsAt: a.ends_at ? new Date(a.ends_at) : null,
        totalMinutes: Number(a.total_minutes) || 0,
        defaultMinutes: Number(a.default_minutes) || 0,
        extendMinutes: Number(a.extend_minutes) || 0,
        autoOff: a.auto_off !== false,
      };
      if (this._config.only_active && !item.active) continue;
      items.push(item);
    }
    return items;
  }

  // ---------------------------------------------------------------- render

  _render() {
    if (!this._config || !this._hass) return;
    const items = this._items();
    const signature = JSON.stringify([this._config, items, this._hass.themes?.darkMode, languageOf(this._hass)]);
    if (signature === this._signature) return;
    this._signature = signature;

    const cfg = this._config;
    const quick = [...new Set((cfg.quick_extend || []).map(Number).filter((n) => n > 0))];

    let body;
    if (!items.length) {
      const anyTimers = Object.keys(findTimers(this._hass)).length > 0;
      body = `<div class="empty">${esc(
        cfg.only_active && anyTimers
          ? this._t("no_running")
          : this._t("none_found", { path: this._t("path") })
      )}</div>`;
    } else {
      body = `<div class="items ${cfg.layout === "list" ? "list" : "grid"}">${items
        .map((it) => this._renderItem(it, quick))
        .join("")}</div>`;
    }

    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <ha-card>
        ${cfg.title ? `<h1 class="card-header">${esc(cfg.title)}</h1>` : ""}
        <div class="content">${body}</div>
      </ha-card>`;
    this._updateCountdowns();
  }

  _renderItem(it, quick) {
    if (it.missing) {
      return `<div class="item missing"><ha-icon icon="mdi:timer-alert-outline"></ha-icon>
        <div class="text"><div class="name">${esc(it.target)}</div>
        <div class="sub">${esc(this._t("not_set_up"))}</div></div></div>`;
    }
    const state = it.unavailable ? "unavailable" : it.active ? "active" : it.on ? "on" : "off";
    const steps = [...new Set([it.extendMinutes, ...quick].filter((n) => n > 0))].sort((a, b) => a - b);
    const t = esc(it.target);

    const extendButtons = it.on
      ? steps
          .map(
            (m) => `<button class="chip" data-action="extend" data-target="${t}" data-minutes="${m}"
              title="${esc(this._t("add_minutes", { minutes: m }))}">${esc(
                m >= 60 && m % 60 === 0 ? this._t("chip_h", { n: m / 60 }) : this._t("chip_m", { n: m })
              )}</button>`
          )
          .join("")
      : "";
    const cancelButton = it.active
      ? `<button class="chip icon" data-action="cancel" data-target="${t}" title="${esc(this._t("stop_keep_on"))}">
           <ha-icon icon="mdi:timer-off-outline"></ha-icon></button>`
      : "";

    return `
      <div class="item ${state}" data-target="${t}" data-ends="${it.endsAt ? it.endsAt.getTime() : ""}"
           data-total="${it.totalMinutes * 60}">
        <button class="ring" data-action="toggle" data-target="${t}"
                title="${esc(it.on ? this._t("turn_off") : this._t("turn_on_for", { minutes: it.defaultMinutes }))}"
                ${it.unavailable ? "disabled" : ""}>
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle class="track" cx="50" cy="50" r="${RING_R}"></circle>
            <circle class="bar" cx="50" cy="50" r="${RING_R}" transform="rotate(-90 50 50)"
                    stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="${RING_C.toFixed(2)}"></circle>
          </svg>
          <span class="center">
            <ha-icon icon="${esc(it.icon)}"></ha-icon>
            <span class="time">${this._centerText(it)}</span>
          </span>
        </button>
        <div class="text">
          <div class="name" data-action="more-info" data-entity="${esc(it.sensorId)}">${esc(it.name)}</div>
          <div class="sub">${this._subText(it)}</div>
        </div>
        <div class="actions">${extendButtons}${cancelButton}</div>
      </div>`;
  }

  _t(key, vars) {
    return localize(this._hass, key, vars);
  }

  _centerText(it) {
    if (it.unavailable) return esc(this._t("na"));
    if (it.active) return ""; // filled in by the countdown
    return esc(this._t(it.on ? "on" : "off"));
  }

  _subText(it) {
    let text;
    if (it.unavailable) text = this._t("unavailable");
    else if (it.active && it.endsAt) text = this._t("off_at", { time: formatClock(this._hass, it.endsAt) });
    else if (it.on) text = this._t(it.autoOff ? "no_timer" : "auto_off_disabled");
    else text = this._t("min_timer", { minutes: it.defaultMinutes });
    return esc(text);
  }

  /** Runs every second: smooth countdown text and ring without re-rendering. */
  _updateCountdowns() {
    const now = Date.now();
    for (const el of this.shadowRoot.querySelectorAll(".item[data-target]")) {
      const bar = el.querySelector(".bar");
      if (!bar) continue;
      const ends = Number(el.dataset.ends);
      const total = Number(el.dataset.total);
      let fraction = 0;
      if (ends) {
        const remaining = Math.max(0, (ends - now) / 1000);
        fraction = total > 0 ? Math.min(1, remaining / total) : 0;
        el.querySelector(".time").textContent = formatRemaining(remaining);
        el.classList.toggle("warn", remaining <= WARN_SECONDS);
      } else if (el.classList.contains("on")) {
        fraction = 1;
      }
      bar.setAttribute("stroke-dashoffset", (RING_C * (1 - fraction)).toFixed(2));
    }
  }

  // --------------------------------------------------------------- actions

  _onClick(ev) {
    const el = ev.composedPath().find((n) => n instanceof HTMLElement && n.dataset?.action);
    if (!el || !this._hass) return;
    const { action, target } = el.dataset;
    switch (action) {
      case "toggle":
        this._hass.callService("homeassistant", "toggle", { entity_id: target });
        break;
      case "extend":
        this._hass.callService(DOMAIN, "extend", { entity_id: target, minutes: Number(el.dataset.minutes) });
        break;
      case "cancel":
        this._hass.callService(DOMAIN, "cancel", { entity_id: target });
        break;
      case "more-info":
        if (el.dataset.entity) {
          this.dispatchEvent(
            new CustomEvent("hass-more-info", { detail: { entityId: el.dataset.entity }, bubbles: true, composed: true })
          );
        }
        break;
    }
  }
}

const STYLES = `
  :host { display: block; }
  ha-card { height: 100%; overflow: hidden; }
  .card-header { margin: 0; padding: 16px 16px 0; font-size: 1.25em; font-weight: 500;
    color: var(--ha-card-header-color, var(--primary-text-color)); }
  .content { padding: 12px 16px 16px; }
  .empty { color: var(--secondary-text-color); padding: 8px 0; }

  .items.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
  .items.list { display: flex; flex-direction: column; gap: 8px; }

  .item { --ring-color: var(--disabled-color, #bdbdbd); position: relative;
    display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center;
    padding: 12px 8px; border-radius: var(--ha-card-border-radius, 12px);
    background: var(--secondary-background-color, rgba(127,127,127,0.08)); }
  .item.active { --ring-color: var(--state-active-color, var(--primary-color)); }
  .item.active.warn { --ring-color: var(--warning-color, #ff9800); }
  .item.on { --ring-color: var(--secondary-text-color); }
  .item.missing, .item.unavailable { opacity: 0.6; }

  .ring { all: unset; position: relative; width: 104px; height: 104px; cursor: pointer;
    border-radius: 50%; -webkit-tap-highlight-color: transparent; }
  .ring:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  .ring[disabled] { cursor: default; }
  .ring svg { width: 100%; height: 100%; display: block; }
  .track { fill: none; stroke: var(--divider-color, rgba(127,127,127,0.25)); stroke-width: 7; }
  .bar { fill: none; stroke: var(--ring-color); stroke-width: 7; stroke-linecap: round;
    transition: stroke-dashoffset 0.9s linear, stroke 0.3s; }
  .item.on .bar { stroke-dasharray: 3 6; stroke-linecap: butt; }
  .center { position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 2px; }
  .center ha-icon { --mdc-icon-size: 26px; color: var(--ring-color); }
  .item.off .center ha-icon { color: var(--secondary-text-color); }
  .time { font-size: 1.05em; font-weight: 600; font-variant-numeric: tabular-nums;
    color: var(--primary-text-color); }

  .text { min-width: 0; width: 100%; }
  .name { font-weight: 500; color: var(--primary-text-color); cursor: pointer;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: 0.85em; color: var(--secondary-text-color); margin-top: 2px; }

  .actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; min-height: 32px; }
  .chip { all: unset; box-sizing: border-box; height: 32px; min-width: 40px; padding: 0 10px;
    display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
    border-radius: 16px; font-size: 0.9em; font-weight: 500;
    color: var(--primary-color); background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.12); }
  .chip:hover { background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.2); }
  .chip:focus-visible { outline: 2px solid var(--primary-color); }
  .chip.icon { padding: 0 8px; color: var(--secondary-text-color);
    background: var(--divider-color, rgba(127,127,127,0.15)); }
  .chip ha-icon { --mdc-icon-size: 18px; }

  /* list layout: ring on the left, buttons on the right */
  .items.list .item { flex-direction: row; flex-wrap: wrap; text-align: left; padding: 8px 12px; gap: 8px 12px; }
  .items.list .ring { width: 64px; height: 64px; flex: none; }
  .items.list .center ha-icon { --mdc-icon-size: 0; display: none; }
  .items.list .time { font-size: 0.85em; }
  .items.list .text { flex: 1 1 120px; }
  .items.list .actions { flex: 0 1 auto; margin-left: auto; justify-content: flex-end; min-height: 0; }
  .items.list .item.missing { flex-direction: row; }
`;

// ------------------------------------------------------------------ editor

class DeviceTimersCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (this._form) this._form.hass = hass;
    if (first) this._render();
  }

  _schema() {
    const targets = Object.keys(findTimers(this._hass)).sort();
    return [
      { name: "title", selector: { text: {} } },
      { name: "devices", selector: { entity: { multiple: true, include_entities: targets } } },
      {
        type: "grid",
        name: "",
        schema: [
          {
            name: "layout",
            selector: {
              select: {
                mode: "dropdown",
                options: [
                  { value: "grid", label: localize(this._hass, "ed_grid") },
                  { value: "list", label: localize(this._hass, "ed_list") },
                ],
              },
            },
          },
          { name: "only_active", selector: { boolean: {} } },
        ],
      },
      {
        name: "quick_extend",
        selector: {
          select: {
            multiple: true,
            custom_value: true,
            mode: "list",
            options: ["5", "10", "15", "30", "45", "60", "90", "120"].map((v) => ({
              value: v,
              label: localize(this._hass, "ed_plus_min", { minutes: v }),
            })),
          },
        },
      },
    ];
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      const labelKeys = {
        title: "ed_title",
        devices: "ed_devices",
        layout: "ed_layout",
        only_active: "ed_only_active",
        quick_extend: "ed_quick",
      };
      this._form.computeLabel = (s) => (labelKeys[s.name] ? localize(this._hass, labelKeys[s.name]) : s.name);
      this._form.addEventListener("value-changed", (ev) => {
        const value = { ...ev.detail.value };
        if (Array.isArray(value.quick_extend)) {
          value.quick_extend = value.quick_extend.map(Number).filter((n) => n > 0);
        }
        this._config = value;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: value }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = this._schema();
    this._form.data = {
      layout: "grid",
      only_active: false,
      ...this._config,
      quick_extend: (this._config.quick_extend || []).map(String),
    };
  }
}

if (!customElements.get("device-timers-card")) {
  customElements.define("device-timers-card", DeviceTimersCard);
  customElements.define("device-timers-card-editor", DeviceTimersCardEditor);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "device-timers-card",
    name: "Device Timers",
    description: STRINGS[resolveLanguage(document.documentElement.lang)].description,
    preview: true,
  });
  console.info(`%c DEVICE-TIMERS-CARD %c v${CARD_VERSION} `, "color:white;background:#03a9f4;font-weight:700", "");
}
