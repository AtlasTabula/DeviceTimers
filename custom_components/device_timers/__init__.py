"""Device Timers: auto-off timers for any switchable device."""

from __future__ import annotations

import logging
from pathlib import Path

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import ATTR_ENTITY_ID
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv, entity_registry as er
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.typing import ConfigType

from .const import (
    ATTR_MINUTES,
    CARD_FILENAME,
    CARD_URL,
    DOMAIN,
    MAX_MINUTES,
    PLATFORMS,
    SERVICE_CANCEL,
    SERVICE_EXTEND,
    SUBENTRY_DEVICE,
    VERSION,
)
from .timer import DeviceTimer, storage_for

_LOGGER = logging.getLogger(__name__)

# runtime_data maps subentry_id -> DeviceTimer
type DeviceTimersConfigEntry = ConfigEntry[dict[str, DeviceTimer]]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

EXTEND_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_ENTITY_ID): cv.entity_ids,
        vol.Optional(ATTR_MINUTES): vol.All(vol.Coerce(int), vol.Range(min=1, max=MAX_MINUTES)),
    }
)
CANCEL_SCHEMA = vol.Schema({vol.Required(ATTR_ENTITY_ID): cv.entity_ids})


def _all_timers(hass: HomeAssistant) -> list[DeviceTimer]:
    entries: list[DeviceTimersConfigEntry] = hass.config_entries.async_loaded_entries(DOMAIN)
    return [timer for entry in entries for timer in entry.runtime_data.values()]


def _timers_for(hass: HomeAssistant, entity_ids: list[str]) -> list[DeviceTimer]:
    """Find timers by the controlled device OR by any of the timer's own entities."""
    registry = er.async_get(hass)
    found: list[DeviceTimer] = []
    for entity_id in entity_ids:
        reg = registry.async_get(entity_id)
        for timer in _all_timers(hass):
            if timer.target == entity_id or (
                reg is not None and reg.config_subentry_id == timer.subentry_id
            ):
                if timer not in found:
                    found.append(timer)
    if not found:
        raise ServiceValidationError(f"No device timer found for {', '.join(entity_ids)}")
    return found


async def _async_register_card(hass: HomeAssistant) -> None:
    """Serve the dashboard card and load it on every dashboard automatically."""
    path = Path(__file__).parent / "frontend" / CARD_FILENAME
    if not await hass.async_add_executor_job(path.is_file):
        _LOGGER.error(
            "Device Timers dashboard card file is missing (%s). Copy the whole "
            "custom_components/device_timers folder, including its 'frontend' "
            "folder, then restart Home Assistant",
            path,
        )
        return
    if getattr(hass, "http", None) is None:  # e.g. in tests without the web server
        return

    from homeassistant.components.http import StaticPathConfig

    try:
        await hass.http.async_register_static_paths(
            [StaticPathConfig(CARD_URL, str(path), False)]
        )
    except RuntimeError:
        pass  # already registered (integration reloaded without a restart)
    except Exception:  # noqa: BLE001 - the timers must work even if the card can't load
        _LOGGER.exception("Could not serve the Device Timers dashboard card")
        return

    url = f"{CARD_URL}?v={VERSION}"

    @callback
    def _add_to_dashboards(_hass: HomeAssistant | None = None) -> None:
        from homeassistant.components.frontend import add_extra_js_url

        try:
            add_extra_js_url(hass, url)
        except Exception:  # noqa: BLE001
            _LOGGER.exception(
                "Could not add the Device Timers card to dashboards automatically. "
                "Add %s as a JavaScript module under Settings > Dashboards > "
                "⋮ > Resources instead",
                url,
            )
            return
        _LOGGER.info("Device Timers dashboard card loaded from %s", url)

    # The frontend must be running before extra scripts can be added to it.
    if "frontend" in hass.config.components:
        _add_to_dashboards()
    else:
        async_at_started(hass, _add_to_dashboards)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    async def handle_extend(call: ServiceCall) -> None:
        for timer in _timers_for(hass, call.data[ATTR_ENTITY_ID]):
            timer.extend(call.data.get(ATTR_MINUTES))

    async def handle_cancel(call: ServiceCall) -> None:
        for timer in _timers_for(hass, call.data[ATTR_ENTITY_ID]):
            timer.cancel()

    hass.services.async_register(DOMAIN, SERVICE_EXTEND, handle_extend, schema=EXTEND_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_CANCEL, handle_cancel, schema=CANCEL_SCHEMA)
    await _async_register_card(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: DeviceTimersConfigEntry) -> bool:
    timers: dict[str, DeviceTimer] = {}
    for subentry_id, subentry in entry.subentries.items():
        if subentry.subentry_type != SUBENTRY_DEVICE:
            continue
        timer = DeviceTimer(hass, entry, subentry)
        await timer.async_setup()
        timers[subentry_id] = timer
    entry.runtime_data = timers

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_entry_updated))
    return True


async def _async_entry_updated(hass: HomeAssistant, entry: DeviceTimersConfigEntry) -> None:
    """A device was added, removed or reconfigured: reload to apply it."""
    removed = set(entry.runtime_data) - set(entry.subentries)
    await hass.config_entries.async_reload(entry.entry_id)
    for subentry_id in removed:
        await storage_for(hass, subentry_id).async_remove()


async def async_unload_entry(hass: HomeAssistant, entry: DeviceTimersConfigEntry) -> bool:
    if unloaded := await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        for timer in entry.runtime_data.values():
            await timer.async_unload()
    return unloaded


async def async_remove_entry(hass: HomeAssistant, entry: DeviceTimersConfigEntry) -> None:
    for subentry_id in entry.subentries:
        await storage_for(hass, subentry_id).async_remove()
