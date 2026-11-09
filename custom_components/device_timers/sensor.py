"""Remaining-time and end-time sensors."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.const import UnitOfTime
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import DeviceTimersConfigEntry
from .const import DOMAIN
from .entity import DeviceTimerEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: DeviceTimersConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    for subentry_id, timer in entry.runtime_data.items():
        async_add_entities(
            [RemainingSensor(timer), EndsAtSensor(timer)],
            config_subentry_id=subentry_id,
        )


class RemainingSensor(DeviceTimerEntity, SensorEntity):
    """Minutes left before the device is turned off. 0 when no timer is running.

    Use this entity in the gauge / ring-tile cards.
    """

    _attr_native_unit_of_measurement = UnitOfTime.MINUTES
    _attr_suggested_display_precision = 0
    _attr_icon = "mdi:timer-outline"

    def __init__(self, timer) -> None:
        super().__init__(timer, "remaining")

    @property
    def native_value(self) -> int:
        return self.timer.remaining_minutes

    @property
    def icon(self) -> str:
        return "mdi:timer-sand" if self.timer.active else "mdi:timer-off-outline"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        t = self.timer
        remaining = t.remaining_minutes
        total = t.total_minutes or t.default_minutes
        return {
            "active": t.active,
            "device": t.target,
            "timer_name": t.name,
            "auto_off": t.auto_off,
            "auto_off_entity": self._sibling("switch", "auto_off"),
            "total_minutes": t.total_minutes,
            "default_minutes": t.default_minutes,
            "extend_minutes": t.extend_minutes,
            "percent": round(100 * remaining / total) if t.active and total else 0,
            "ends_at": t.ends_at.isoformat() if t.ends_at else None,
        }


    def _sibling(self, domain: str, key: str) -> str | None:
        registry = er.async_get(self.hass)
        return registry.async_get_entity_id(domain, DOMAIN, f"{self.timer.subentry_id}_{key}")


class EndsAtSensor(DeviceTimerEntity, SensorEntity):
    """When the device will be turned off (shows as 'in 42 minutes' in the UI)."""

    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_icon = "mdi:clock-end"

    def __init__(self, timer) -> None:
        super().__init__(timer, "ends_at")

    @property
    def native_value(self) -> datetime | None:
        return self.timer.ends_at
