"""Core timer logic: one DeviceTimer per configured device."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta
import logging
import math
from typing import Any

from homeassistant.config_entries import ConfigEntry, ConfigSubentry
from homeassistant.const import (
    ATTR_ENTITY_ID,
    STATE_OFF,
    STATE_UNAVAILABLE,
    STATE_UNKNOWN,
)
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, State, callback
from homeassistant.helpers.event import (
    async_track_point_in_utc_time,
    async_track_state_change_event,
    async_track_time_interval,
)
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import (
    CONF_DEFAULT_MINUTES,
    CONF_EXTEND_MINUTES,
    CONF_TARGET,
    DEFAULT_EXTEND_MINUTES,
    DEFAULT_MINUTES,
    DOMAIN,
    TICK_SECONDS,
)

_LOGGER = logging.getLogger(__name__)

STORAGE_VERSION = 1
NOT_ON_STATES = {STATE_OFF, STATE_UNAVAILABLE, STATE_UNKNOWN}
UNAVAILABLE_STATES = {STATE_UNAVAILABLE, STATE_UNKNOWN}


def storage_for(hass: HomeAssistant, subentry_id: str) -> Store[dict[str, Any]]:
    return Store(hass, STORAGE_VERSION, f"{DOMAIN}.{subentry_id}")


def _is_on(state: State | None) -> bool:
    return state is not None and state.state not in NOT_ON_STATES


class DeviceTimer:
    """Turns a device off a set time after it was turned on."""

    def __init__(
        self, hass: HomeAssistant, entry: ConfigEntry, subentry: ConfigSubentry
    ) -> None:
        self.hass = hass
        self.entry = entry
        self.subentry_id = subentry.subentry_id
        self.name = subentry.title
        self.target: str = subentry.data[CONF_TARGET]

        # Settings come from the integration configuration (Reconfigure).
        self.default_minutes: int = int(
            subentry.data.get(CONF_DEFAULT_MINUTES, DEFAULT_MINUTES)
        )
        self.extend_minutes: int = int(
            subentry.data.get(CONF_EXTEND_MINUTES, DEFAULT_EXTEND_MINUTES)
        )
        # Runtime toggle (switch entity), persisted.
        self.auto_off: bool = True

        # Runtime state (persisted so timers survive a restart).
        self.ends_at: datetime | None = None
        self.total_minutes: int = 0

        self._store: Store[dict[str, Any]] = storage_for(hass, self.subentry_id)
        self._listeners: set[Callable[[], None]] = set()
        self._unsubs: list[Callable[[], None]] = []
        self._unsub_expire: Callable[[], None] | None = None
        self._unsub_tick: Callable[[], None] | None = None

    # ------------------------------------------------------------------ setup

    async def async_setup(self) -> None:
        data = await self._store.async_load() or {}
        self.auto_off = bool(data.get("auto_off", True))
        self.total_minutes = int(data.get("total_minutes", 0))
        if ends_at := data.get("ends_at"):
            self.ends_at = dt_util.parse_datetime(ends_at)

        self._unsubs.append(
            async_track_state_change_event(
                self.hass, [self.target], self._async_target_changed
            )
        )
        self._unsubs.append(async_at_started(self.hass, self._async_reconcile))

    async def async_unload(self) -> None:
        for unsub in self._unsubs:
            unsub()
        self._unsubs.clear()
        self._cancel_callbacks()
        # Write now so a reload (e.g. after Reconfigure) picks the timer back up.
        await self._store.async_save(self._data())

    @callback
    def _async_reconcile(self, _hass: HomeAssistant | None = None) -> None:
        """After startup, bring the timer in line with the device's real state."""
        state = self.hass.states.get(self.target)
        if self.ends_at is not None:
            if state is not None and state.state == STATE_OFF:
                self._clear()
            elif self.ends_at <= dt_util.utcnow():
                self._async_expire()
            else:
                self._schedule()
        elif _is_on(state) and self.auto_off:
            # Device was left on with no timer (e.g. turned on while HA was down).
            self.start()
        self._notify()

    # -------------------------------------------------------------- properties

    @property
    def active(self) -> bool:
        return self.ends_at is not None

    @property
    def remaining_seconds(self) -> float:
        if self.ends_at is None:
            return 0
        return max(0.0, (self.ends_at - dt_util.utcnow()).total_seconds())

    @property
    def remaining_minutes(self) -> int:
        return math.ceil(self.remaining_seconds / 60)

    @property
    def target_is_on(self) -> bool:
        return _is_on(self.hass.states.get(self.target))

    # ----------------------------------------------------------------- actions

    @callback
    def start(self, minutes: int | None = None) -> None:
        """Start (or restart) the countdown from now."""
        minutes = int(minutes or self.default_minutes)
        self.total_minutes = minutes
        self.ends_at = dt_util.utcnow() + timedelta(minutes=minutes)
        self._schedule()
        self._save()
        self._notify()

    @callback
    def extend(self, minutes: int | None = None) -> bool:
        """Add time to a running timer. Starts one if the device is on without a timer."""
        minutes = int(minutes or self.extend_minutes)
        if self.ends_at is None:
            if not self.target_is_on:
                return False
            self.start(minutes)
            return True
        self.ends_at += timedelta(minutes=minutes)
        # Keep the ring's 100% mark meaningful: total = elapsed + new remaining.
        self.total_minutes = max(
            self.total_minutes + minutes, self.remaining_minutes
        )
        self._schedule()
        self._save()
        self._notify()
        return True

    @callback
    def cancel(self) -> None:
        """Stop the countdown but leave the device as it is."""
        self._clear()
        self._notify()

    @callback
    def set_auto_off(self, enabled: bool) -> None:
        self.auto_off = enabled
        if not enabled:
            self._clear()
        elif self.target_is_on and not self.active:
            self.start()
        self._save()
        self._notify()

    # --------------------------------------------------------------- listeners

    @callback
    def async_add_listener(self, update: Callable[[], None]) -> Callable[[], None]:
        self._listeners.add(update)
        return lambda: self._listeners.discard(update)

    @callback
    def _notify(self) -> None:
        for update in list(self._listeners):
            update()

    # ---------------------------------------------------------------- internal

    @callback
    def _async_target_changed(self, event: Event[EventStateChangedData]) -> None:
        old: State | None = event.data["old_state"]
        new: State | None = event.data["new_state"]

        if new is None or new.state == STATE_OFF:
            # Turned off manually (or removed): stop the countdown.
            if self.active:
                self._clear()
            self._notify()
            return

        if new.state in UNAVAILABLE_STATES:
            # Device dropped off the network; keep counting.
            self._notify()
            return

        if not _is_on(old) and not self.active and self.auto_off:
            self.start()
        else:
            self._notify()

    @callback
    def _schedule(self) -> None:
        self._cancel_callbacks()
        if self.ends_at is None:
            return
        self._unsub_expire = async_track_point_in_utc_time(
            self.hass, self._async_expire, self.ends_at
        )
        self._unsub_tick = async_track_time_interval(
            self.hass, self._async_tick, timedelta(seconds=TICK_SECONDS)
        )

    @callback
    def _async_tick(self, _now: datetime) -> None:
        self._notify()

    @callback
    def _async_expire(self, _now: datetime | None = None) -> None:
        _LOGGER.debug("Timer for %s finished, turning it off", self.target)
        self._clear()
        self._notify()
        self.hass.async_create_task(self._async_turn_off())

    async def _async_turn_off(self) -> None:
        try:
            await self.hass.services.async_call(
                "homeassistant",
                "turn_off",
                {ATTR_ENTITY_ID: self.target},
                blocking=True,
            )
        except Exception:  # noqa: BLE001 - log and carry on, never crash the loop
            _LOGGER.exception("Device Timers could not turn off %s", self.target)

    @callback
    def _clear(self) -> None:
        self._cancel_callbacks()
        self.ends_at = None
        self.total_minutes = 0
        self._save()

    @callback
    def _cancel_callbacks(self) -> None:
        if self._unsub_expire:
            self._unsub_expire()
            self._unsub_expire = None
        if self._unsub_tick:
            self._unsub_tick()
            self._unsub_tick = None

    @callback
    def _save(self) -> None:
        self._store.async_delay_save(self._data, 1)

    @callback
    def _data(self) -> dict[str, Any]:
        return {
            "auto_off": self.auto_off,
            "total_minutes": self.total_minutes,
            "ends_at": self.ends_at.isoformat() if self.ends_at else None,
        }
