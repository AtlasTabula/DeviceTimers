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

const CARD_VERSION = "2.0.1";
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
    const signature = JSON.stringify([this._config, items, this._hass.themes?.darkMode]);
    if (signature === this._signature) return;
    this._signature = signature;

    const cfg = this._config;
    const quick = [...new Set((cfg.quick_extend || []).map(Number).filter((n) => n > 0))];

    let body;
    if (!items.length) {
      const anyTimers = Object.keys(findTimers(this._hass)).length > 0;
      body = `<div class="empty">${
        cfg.only_active && anyTimers
          ? "No timers running"
          : "No device timers found. Add devices under Settings → Devices &amp; services → Device Timers."
      }</div>`;
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
        <div class="sub">Not set up in Device Timers</div></div></div>`;
    }
    const state = it.unavailable ? "unavailable" : it.active ? "active" : it.on ? "on" : "off";
    const steps = [...new Set([it.extendMinutes, ...quick].filter((n) => n > 0))].sort((a, b) => a - b);
    const t = esc(it.target);

    const extendButtons = it.on
      ? steps
          .map(
            (m) => `<button class="chip" data-action="extend" data-target="${t}" data-minutes="${m}"
              title="Add ${m} minutes">+${m >= 60 && m % 60 === 0 ? `${m / 60}h` : `${m}m`}</button>`
          )
          .join("")
      : "";
    const cancelButton = it.active
      ? `<button class="chip icon" data-action="cancel" data-target="${t}" title="Stop timer, keep on">
           <ha-icon icon="mdi:timer-off-outline"></ha-icon></button>`
      : "";

    return `
      <div class="item ${state}" data-target="${t}" data-ends="${it.endsAt ? it.endsAt.getTime() : ""}"
           data-total="${it.totalMinutes * 60}">
        <button class="ring" data-action="toggle" data-target="${t}"
                title="${it.on ? "Turn off" : `Turn on for ${it.defaultMinutes} min`}"
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

  _centerText(it) {
    if (it.unavailable) return "N/A";
    if (it.active) return ""; // filled in by the countdown
    return it.on ? "On" : "Off";
  }

  _subText(it) {
    if (it.unavailable) return "Unavailable";
    if (it.active && it.endsAt) return `Off at ${esc(formatClock(this._hass, it.endsAt))}`;
    if (it.on) return it.autoOff ? "No timer" : "Auto-off disabled";
    return `${it.defaultMinutes} min timer`;
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
                  { value: "grid", label: "Grid (large rings)" },
                  { value: "list", label: "List (compact rows)" },
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
            options: ["5", "10", "15", "30", "45", "60", "90", "120"].map((v) => ({ value: v, label: `+${v} min` })),
          },
        },
      },
    ];
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) =>
        ({
          title: "Title",
          devices: "Devices (leave empty to show all)",
          layout: "Layout",
          only_active: "Only show running timers",
          quick_extend: "Extra extend buttons (each device's own Extend step is always shown)",
        })[s.name] ?? s.name;
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
    description: "Turn devices on, see the time left on their auto-off timers, and extend them.",
    preview: true,
  });
  console.info(`%c DEVICE-TIMERS-CARD %c v${CARD_VERSION} `, "color:white;background:#03a9f4;font-weight:700", "");
}
