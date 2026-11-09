"""Shared base entity."""

from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity import Entity

from .const import DOMAIN
from .timer import DeviceTimer


class DeviceTimerEntity(Entity):
    """An entity that belongs to one DeviceTimer and refreshes when it changes."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, timer: DeviceTimer, key: str) -> None:
        self.timer = timer
        self._attr_translation_key = key
        self._attr_unique_id = f"{timer.subentry_id}_{key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, timer.subentry_id)},
            name=f"{timer.name} timer",
            manufacturer="Device Timers",
            model=timer.target,
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self.timer.async_add_listener(self.async_write_ha_state))
