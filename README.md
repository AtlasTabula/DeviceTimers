# Device Timers for Home Assistant

Auto-off timers for any device you can switch on and off: radiators, heaters, towel rails, fans, lights, dehumidifiers…

- Turn a device on and its timer starts by itself. It doesn't matter how it's turned on: the dashboard, a wall switch, voice or an automation.
- When the time is up, the device is turned off.
- Extend the timer from the dashboard card, or turn the device off by hand at any time.
- Each device's default duration and extend step are set in the integration's configuration.
- Includes its own dashboard card with a live countdown ring. The integration loads the card itself, so you don't need to add any resources.
- Running timers survive restarts and reconfiguration.

## Install

1. Copy `custom_components/device_timers` into your Home Assistant `config/custom_components/` folder, so you have `config/custom_components/device_timers/manifest.json`.
   (Or add this folder as a custom repository in HACS, category *Integration*.)
2. Restart Home Assistant.
3. **Settings → Devices & services → + Add integration → Device Timers → Submit.**
4. Refresh your browser once (Ctrl+F5) so the dashboard card loads.

Requires Home Assistant 2025.6 or newer.

## Add and configure devices

Open **Settings → Devices & services → Device Timers**.

- **Add a device:** click **Add device**, pick the entity, then set:
  - **Default duration:** how long it stays on each time (e.g. 60 min)
  - **Extend adds:** what the Extend button adds (e.g. 30 min)
  - **Name:** optional; defaults to the device's own name
- **Change a device's timings:** click **⋮ → Reconfigure** next to it. A timer that's already running carries on, and the new default applies from the next time the device is turned on.
- **Remove a device:** click **⋮ → Delete**. Its timer entities are removed too.

Supported entity types: `switch`, `light`, `fan`, `input_boolean`, `climate`, `humidifier`, `water_heater`.

## Dashboard card

**Edit dashboard → + Add card → search "Device Timers".** In the visual editor:

| Option | What it does |
|---|---|
| Title | Card heading (clear it to hide the heading) |
| Devices | Which devices to show. Leave empty to show every device timer, including ones you add later. |
| Layout | **Grid**: large rings. **List**: compact rows. |
| Only show running timers | Hides devices with no countdown running |
| Extra extend buttons | Additional buttons such as +15 min or +60 min. Each device's own Extend step is always shown. |

On the card:
- **Tap the ring** to turn the device on (its timer starts) or off.
- **+30m** (etc.) adds time. **⏹** stops the timer and leaves the device on.
- **Tap the name** to open the timer's details.
- Ring colours: coloured means counting down, red means under 5 minutes left, dashed grey means on with no timer, and empty means off.

You can also paste YAML into a Manual card. There are examples in [dashboards/device-timers-card.yaml](dashboards/device-timers-card.yaml):

```yaml
type: custom:device-timers-card
title: Heating
layout: list            # grid | list
devices:                # leave out to show all
  - climate.living_room_radiator
  - switch.towel_rail
only_active: false
quick_extend: [15, 60]
```

## Entities per device

For a device named **Living Room Radiator**, you get a device called "Living Room Radiator timer" with these entities:

| Entity | What it does |
|---|---|
| `sensor.living_room_radiator_timer_time_remaining` | Minutes left (0 when idle). Its attributes include `ends_at`, `total_minutes`, `percent`, `default_minutes` and `extend_minutes`. |
| `sensor.living_room_radiator_timer_turns_off_at` | When the device will turn off |
| `switch.living_room_radiator_timer_auto_off` | Turn off to run the device with no timer |
| `button.living_room_radiator_timer_extend` | Adds the "Extend adds" time |
| `button.living_room_radiator_timer_cancel_timer` | Stops the countdown and leaves the device on |

## Actions (for automations and scripts)

```yaml
action: device_timers.extend
data:
  entity_id: switch.living_room_radiator   # the device, or any of its timer entities
  minutes: 45                              # optional; defaults to its "Extend adds" setting

action: device_timers.cancel
data:
  entity_id: switch.living_room_radiator
```

## Behaviour details

- The timer starts when the device goes from *off* (or unavailable) to any *on* state. For a `climate` device, any mode other than `off` counts as on.
- If the device briefly drops offline, the countdown keeps running.
- Pressing Extend while the device is on with no timer starts a timer for the extend amount.
- Devices are turned off with `homeassistant.turn_off`.

## Troubleshooting: "Custom element not found: device-timers-card"

1. Make sure `config/custom_components/device_timers/frontend/device-timers-card.js` exists. The `frontend` folder is easy to miss when copying.
2. Restart Home Assistant. Reloading the integration isn't enough after you replace its files.
3. Open `http://<your-ha-address>:8123/device_timers/device-timers-card.js` in your browser. You should see JavaScript code.
   If you get a 404, check **Settings → System → Logs** for lines mentioning "Device Timers".
4. Hard-refresh the dashboard (Ctrl+F5).
   In the Companion app, go to **Settings → Companion app → Debugging → Reset frontend cache** and reopen the app.
5. If it still won't load: go to **Settings → Dashboards → ⋮ → Resources → Add resource**, enter `/device_timers/device-timers-card.js?v=2.0.2` and set the type to **JavaScript module**.

## Languages

The integration's setup screens, entity names and actions, and the dashboard card, are available in:

English · Polish (Polski) · Bulgarian (Български) · French (Français) · German (Deutsch)

Home Assistant uses the language from each user's profile, and falls back to English for any other language.
Entity names are set when a device is added, so existing entities keep the name they were created with.

**Adding a language:**
1. Copy `custom_components/device_timers/translations/en.json` to `<code>.json` (e.g. `es.json`) and translate the values.
2. In `custom_components/device_timers/frontend/device-timers-card.js`, copy the `en` block in `STRINGS` to a new `<code>` block and translate it.
3. Leave `{placeholders}` such as `{device}`, `{minutes}` and `{time}` unchanged, and keep "Device Timers" as it is.

## Upgrading from version 1 (helpers)

Version 1 added each device as a separate helper. Before installing version 2, delete those under **Settings → Devices & services → Helpers**. Then set up the integration and add the devices again as described above. Version 2 doesn't create the default-duration and extend-by number entities any more: those settings now live in **Reconfigure**.
