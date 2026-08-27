from __future__ import annotations
import re
from datetime import datetime, time

# Uurnotaties in de bronbestanden lopen sterk uiteen. In het videobezoek-bestand
# alleen al vond ik 39 varianten: '13u00', '16U30' (hoofdletter U), '9u30',
# '15u' (zonder minuten), '1300' (zonder scheidingsteken), ' 13u00' (spatie
# ervoor) en soms een echte tijd-cel. Het intern-bezoekbestand schrijft '16h15'.
# De oude lezer in dispatch.py kent alleen 'u' en ':' in kleine letters en liet
# daardoor afspraken wegvallen.

_SEP  = re.compile(r"(?<!\d)(\d{1,2})\s*[uUhH:.]\s*(\d{2})(?!\d)")
_HOUR = re.compile(r"^\s*(\d{1,2})\s*[uUhH]\s*$")
_HHMM = re.compile(r"^\s*(\d{3,4})\s*$")


def parse_time_loose(value) -> time | None:
    """Leest een uur uit vrijwel elke notatie. None als er niets bruikbaars staat."""
    if value is None:
        return None
    if isinstance(value, time):
        return value
    if isinstance(value, datetime):
        return value.time()

    s = str(value).strip()
    if not s:
        return None

    m = _SEP.search(s)
    if m:
        h, mn = int(m.group(1)), int(m.group(2))
    else:
        m = _HOUR.match(s)
        if m:
            h, mn = int(m.group(1)), 0
        else:
            m = _HHMM.match(s)
            if not m:
                return None
            digits = m.group(1)
            h, mn = int(digits[:-2]), int(digits[-2:])

    return time(h, mn) if 0 <= h <= 23 and 0 <= mn <= 59 else None
