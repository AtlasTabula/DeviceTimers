"""UI setup for Device Timers.

Settings > Devices & services > Add integration > Device Timers creates the
integration once. Devices are then added with the "Add device" button on the
integration page, and each device's timings are changed with Reconfigure.
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    ConfigSubentryFlow,
    SubentryFlowResult,
)
from homeassistant.const import CONF_NAME
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    EntitySelector,
    EntitySelectorConfig,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    TextSelector,
)

from .const import (
    CONF_DEFAULT_MINUTES,
    CONF_EXTEND_MINUTES,
    CONF_TARGET,
    DEFAULT_EXTEND_MINUTES,
    DEFAULT_MINUTES,
    DOMAIN,
    MAX_MINUTES,
    SUBENTRY_DEVICE,
    SUPPORTED_DOMAINS,
)


def _minutes() -> NumberSelector:
    return NumberSelector(
        NumberSelectorConfig(
            min=1,
            max=MAX_MINUTES,
            step=1,
            unit_of_measurement="min",
            mode=NumberSelectorMode.BOX,
        )
    )


TIMING_SCHEMA = {
    vol.Optional(CONF_NAME): TextSelector(),
    vol.Required(CONF_DEFAULT_MINUTES, default=DEFAULT_MINUTES): _minutes(),
    vol.Required(CONF_EXTEND_MINUTES, default=DEFAULT_EXTEND_MINUTES): _minutes(),
}

ADD_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_TARGET): EntitySelector(
            EntitySelectorConfig(domain=SUPPORTED_DOMAINS)
        ),
        **TIMING_SCHEMA,
    }
)
RECONFIGURE_SCHEMA = vol.Schema(TIMING_SCHEMA)


class DeviceTimersConfigFlow(ConfigFlow, domain=DOMAIN):
    """Create the (single) Device Timers integration entry."""

    VERSION = 2

    @classmethod
    @callback
    def async_get_supported_subentry_types(
        cls, config_entry: ConfigEntry
    ) -> dict[str, type[ConfigSubentryFlow]]:
        return {SUBENTRY_DEVICE: DeviceSubentryFlow}

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title="Device Timers", data={})
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))


class DeviceSubentryFlow(ConfigSubentryFlow):
    """Add a device to Device Timers, or change its timings."""

    def _timings(self, user_input: dict[str, Any]) -> dict[str, int]:
        return {
            CONF_DEFAULT_MINUTES: int(user_input[CONF_DEFAULT_MINUTES]),
            CONF_EXTEND_MINUTES: int(user_input[CONF_EXTEND_MINUTES]),
        }

    def _title(self, user_input: dict[str, Any], target: str) -> str:
        if name := (user_input.get(CONF_NAME) or "").strip():
            return name
        state = self.hass.states.get(target)
        return state.name if state else target

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            target = user_input[CONF_TARGET]
            entry = self._get_entry()
            if any(
                sub.data.get(CONF_TARGET) == target for sub in entry.subentries.values()
            ):
                errors[CONF_TARGET] = "already_configured"
            else:
                return self.async_create_entry(
                    title=self._title(user_input, target),
                    data={CONF_TARGET: target, **self._timings(user_input)},
                    unique_id=target,
                )

        return self.async_show_form(
            step_id="user",
            data_schema=self.add_suggested_values_to_schema(ADD_SCHEMA, user_input or {}),
            errors=errors,
        )

    async def async_step_reconfigure(
        self, user_input: dict[str, Any] | None = None
    ) -> SubentryFlowResult:
        entry = self._get_entry()
        subentry = self._get_reconfigure_subentry()
        target = subentry.data[CONF_TARGET]

        if user_input is not None:
            return self.async_update_and_abort(
                entry,
                subentry,
                title=self._title(user_input, target),
                data={CONF_TARGET: target, **self._timings(user_input)},
            )

        return self.async_show_form(
            step_id="reconfigure",
            data_schema=self.add_suggested_values_to_schema(
                RECONFIGURE_SCHEMA, {CONF_NAME: subentry.title, **subentry.data}
            ),
            description_placeholders={"device": target},
        )
