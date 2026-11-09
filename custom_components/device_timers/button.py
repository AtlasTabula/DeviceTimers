"""Extend / cancel buttons."""

from __future__ import annotations

from homeassistant.components.button import ButtonEntity
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
        async_add_entities(
            [ExtendButton(timer), CancelButton(timer)], config_subentry_id=subentry_id
        )


class ExtendButton(DeviceTimerEntity, ButtonEntity):
    """Add the configured extend step to the running timer."""

    _attr_icon = "mdi:timer-plus"

    def __init__(self, timer) -> None:
        super().__init__(timer, "extend")

    @property
    def available(self) -> bool:
        return self.timer.target_is_on

    async def async_press(self) -> None:
        self.timer.extend()


class CancelButton(DeviceTimerEntity, ButtonEntity):
    """Stop the countdown and keep the device on."""

    _attr_icon = "mdi:timer-cancel-outline"

    def __init__(self, timer) -> None:
        super().__init__(timer, "cancel")

    @property
    def available(self) -> bool:
        return self.timer.active

    async def async_press(self) -> None:
        self.timer.cancel()
