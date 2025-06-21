# weatherDetector.py

import requests
from datetime import datetime, timezone, timedelta

# weatherDetector.py

weather_time_to_genres = {
    # ── CLEAR ──────────────────────────────────────────────────────────
    ("Clear", "morning"):   [("Happy",       0.6), ("Uplifting",   0.3), ("Adventurous", 0.1)],
    ("Clear", "afternoon"): [("Adventurous", 0.5), ("Uplifting",   0.4), ("Reflective",  0.1)],
    ("Clear", "evening"):   [("Romantic",    0.5), ("Reflective",  0.3), ("Light-hearted",0.2)],
    ("Clear", "night"):     [("Reflective",  0.4), ("Suspense",    0.3), ("Emotional",    0.3)],

    # ── CLOUDS ─────────────────────────────────────────────────────────
    ("Clouds", "morning"):   [("Reflective",  0.5), ("Emotional",   0.3), ("Light-hearted",0.2)],
    ("Clouds", "afternoon"): [("Reflective",  0.4), ("Uplifting",   0.4), ("Emotional",    0.2)],
    ("Clouds", "evening"):   [("Emotional",   0.6), ("Reflective",  0.3), ("Sad",          0.1)],
    ("Clouds", "night"):     [("Sad",         0.5), ("Suspense",    0.3), ("Dark",         0.2)],

    # ── RAIN ───────────────────────────────────────────────────────────
    ("Rain", "morning"):     [("Sad",         0.5), ("Reflective",  0.3), ("Suspense",     0.2)],
    ("Rain", "afternoon"):   [("Reflective",  0.4), ("Emotional",   0.3), ("Sad",          0.3)],
    ("Rain", "evening"):     [("Suspense",    0.5), ("Tense",       0.3), ("Dark",         0.2)],
    ("Rain", "night"):       [("Tense",       0.5), ("Suspense",    0.3), ("Dark",         0.2)],

    # ── SNOW ───────────────────────────────────────────────────────────
    ("Snow", "morning"):     [("Uplifting",   0.5), ("Reflective",  0.3), ("Emotional",    0.2)],
    ("Snow", "afternoon"):   [("Light-hearted",0.4),("Uplifting",   0.3), ("Reflective",   0.3)],
    ("Snow", "evening"):     [("Emotional",   0.5), ("Reflective",  0.3), ("Sad",          0.2)],
    ("Snow", "night"):       [("Reflective",  0.4), ("Sad",         0.3), ("Emotional",    0.3)],
}


def get_weather_and_slot(lat: float, lon: float, api_key: str):
    """
    Calls OpenWeatherMap to fetch current weather & timezone,
    then determines local time slot (morning/afternoon/evening/night).
    Returns: (condition:str, slot:str)
    """
    print("Here inside get_weather:",lat,lon)
    resp = requests.get(
      f"https://api.openweathermap.org/data/2.5/weather"
      f"?lat={lat}&lon={lon}&appid={api_key}"
    )
    resp.raise_for_status()
    data = resp.json()

    # 1️⃣ Grab the condition
    condition = data["weather"][0]["main"]  # e.g. "Clouds", "Rain"
    
    # 2️⃣ Compute local time via dt + timezone
    timestamp = data.get("dt")            # seconds since epoch for this reading
    tz_offset = data.get("timezone", 0)   # offset in seconds from UTC

    # Build a timezone object for the offset
    loc_tz = timezone(timedelta(seconds=tz_offset))
    # Convert the reading's timestamp into that local timezone
    local_dt = datetime.fromtimestamp(timestamp, tz=loc_tz)
    hour = local_dt.hour
    print("Hour:",hour)
    # 3️⃣ Bucket into time slots
    if 6 <= hour < 12:
        slot = "morning"
    elif 12 <= hour < 18:
        slot = "afternoon"
    elif 18 <= hour < 22:
        slot = "evening"
    else:
        slot = "night"
    print("Condition:",condition)
    print("Slot: ",slot)
    # 4️⃣ Return
    return condition, slot

