"""Auto-off on/off switch per device."""

from __future__ import annotations

from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import DeviceTimersConfigEntry
from .entity import DeviceTimerEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: DeviceTimersConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    for subentry_id, timer in entry.runtime_data.items():
        async_add_entities([AutoOffSwitch(timer)], config_subentry_id=subentry_id)


class AutoOffSwitch(DeviceTimerEntity, SwitchEntity):
    """When off, the device can be turned on without a timer starting."""

    _attr_entity_category = EntityCategory.CONFIG
    _attr_icon = "mdi:timer-check-outline"

    def __init__(self, timer) -> None:
        super().__init__(timer, "auto_off")

    @property
    def is_on(self) -> bool:
        return self.timer.auto_off

    async def async_turn_on(self, **kwargs: Any) -> None:
        self.timer.set_auto_off(True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        self.timer.set_auto_off(False)
