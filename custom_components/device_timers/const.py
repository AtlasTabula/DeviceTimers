"""Constants for Device Timers."""

from homeassistant.const import Platform

DOMAIN = "device_timers"
VERSION = "2.0.1"

# Each controlled device is a config subentry of this type.
SUBENTRY_DEVICE = "device"

CONF_TARGET = "target_entity"
CONF_DEFAULT_MINUTES = "default_minutes"
CONF_EXTEND_MINUTES = "extend_minutes"

DEFAULT_MINUTES = 60
DEFAULT_EXTEND_MINUTES = 30
MAX_MINUTES = 1440

# Entity domains that can be controlled with homeassistant.turn_on / turn_off.
SUPPORTED_DOMAINS = [
    "switch",
    "light",
    "fan",
    "input_boolean",
    "climate",
    "humidifier",
    "water_heater",
]

PLATFORMS = [Platform.SENSOR, Platform.SWITCH, Platform.BUTTON]

SERVICE_EXTEND = "extend"
SERVICE_CANCEL = "cancel"
ATTR_MINUTES = "minutes"

# How often the remaining-time sensor is refreshed while a timer is running.
TICK_SECONDS = 10

# Dashboard card, served by the integration itself.
CARD_FILENAME = "device-timers-card.js"
CARD_URL = f"/{DOMAIN}/{CARD_FILENAME}"
