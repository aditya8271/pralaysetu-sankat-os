"""Fetch and normalize current weather conditions for Puri, Odisha."""

from datetime import datetime, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import json


PROVIDER = "Open-Meteo"
API_URL = "https://api.open-meteo.com/v1/forecast"
PURI_LATITUDE = 19.8135
PURI_LONGITUDE = 85.8312
FRESHNESS_LIMIT_SECONDS = 2 * 60 * 60


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _parse_provider_time(value) -> datetime:
    """Parse Open-Meteo timestamps without relying on the host timezone."""
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    if not isinstance(value, str):
        raise ValueError("Open-Meteo did not return a current timestamp")

    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    # The request asks Open-Meteo for UTC. ISO timestamps may omit the
    # offset, so attach UTC explicitly instead of using the server's locale.
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _weather_description(code):
    if code is None:
        return None
    try:
        code = int(code)
    except (TypeError, ValueError):
        return None

    descriptions = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Slight snowfall",
        73: "Moderate snowfall",
        75: "Heavy snowfall",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail",
    }
    return descriptions.get(code, f"Weather code {code}")


def fetch_current_weather() -> dict:
    """Return fresh provider data, or a safe unavailable/stale result."""
    params = urlencode({
        "latitude": PURI_LATITUDE,
        "longitude": PURI_LONGITUDE,
        "current": ",".join((
            "temperature_2m",
            "precipitation",
            "rain",
            "wind_speed_10m",
            "wind_direction_10m",
            "weather_code",
        )),
        "timezone": "UTC",
        "timeformat": "unixtime",
        "wind_speed_unit": "kmh",
    })
    request = Request(
        f"{API_URL}?{params}",
        headers={"Accept": "application/json", "User-Agent": "PralaySetu/1.0"},
    )
    fetched_at = _utc_now()

    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))

        current = payload.get("current") or {}
        units = payload.get("current_units") or {}
        provider_time = current.get("time")
        try:
            observed_at = _parse_provider_time(provider_time)
            age_seconds = (_utc_now() - observed_at).total_seconds()
        except (TypeError, ValueError, OverflowError, OSError):
            observed_at = None
            age_seconds = None

        stale = age_seconds is None or age_seconds < -15 * 60 or age_seconds > FRESHNESS_LIMIT_SECONDS
        precip = current.get("precipitation")

        return {
            "status": "stale" if stale else "available",
            "mode": "LIVE",
            "data_type": "current_conditions",
            "provider": PROVIDER,
            "source": "Open-Meteo Forecast API (model-based current conditions)",
            "area": "Puri, Odisha",
            "latitude": payload.get("latitude", PURI_LATITUDE),
            "longitude": payload.get("longitude", PURI_LONGITUDE),
            "fetched_at": _iso_utc(fetched_at),
            "observation_time": None,
            "provider_time": _iso_utc(observed_at) if observed_at else None,
            "forecast_time": None,
            "freshness": "STALE" if stale else "FRESH",
            "stale": stale,
            "temperature_c": current.get("temperature_2m"),
            "precipitation_mm": precip,
            "rain_mm": current.get("rain"),
            "wind_speed_kmh": current.get("wind_speed_10m"),
            "wind_direction_degrees": current.get("wind_direction_10m"),
            "weather_code": current.get("weather_code"),
            "weather_status": _weather_description(current.get("weather_code")),
            "warning_status": None,
            "warning_source": None,
            "units": {
                "temperature": units.get("temperature_2m", "°C"),
                "precipitation": units.get("precipitation", "mm"),
                "rain": units.get("rain", "mm"),
                "wind_speed": units.get("wind_speed_10m", "km/h"),
                "wind_direction": units.get("wind_direction_10m", "°"),
            },
            "message": "Current conditions are model-based weather estimates; this provider response does not supply official warnings.",
        }
    except Exception as error:
        return {
            "status": "unavailable",
            "mode": "UNAVAILABLE",
            "data_type": "current_conditions",
            "provider": PROVIDER,
            "source": API_URL,
            "area": "Puri, Odisha",
            "fetched_at": _iso_utc(fetched_at),
            "observation_time": None,
            "provider_time": None,
            "forecast_time": None,
            "freshness": "UNAVAILABLE",
            "stale": False,
            "temperature_c": None,
            "precipitation_mm": None,
            "rain_mm": None,
            "wind_speed_kmh": None,
            "wind_direction_degrees": None,
            "weather_code": None,
            "weather_status": None,
            "warning_status": None,
            "warning_source": None,
            "error": f"Weather provider request failed: {error}",
        }
