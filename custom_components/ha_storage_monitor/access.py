"""Current active administrator checks, repeated around asynchronous reads."""
from __future__ import annotations


def _matches(user, expected):
    return (bool(expected) and getattr(user, "id", None) == expected
            and getattr(user, "is_admin", False) is True
            and getattr(user, "is_active", False) is True)


async def async_current_admin(hass, connection, expected_user_id):
    """Do not trust a captured connection.user object after a user/role change."""
    if getattr(connection, "closed", False) or not _matches(connection.user, expected_user_id):
        return False
    try:
        current = await hass.auth.async_get_user(expected_user_id)
    except Exception:
        return False
    return (not getattr(connection, "closed", False)
            and _matches(connection.user, expected_user_id)
            and _matches(current, expected_user_id))
