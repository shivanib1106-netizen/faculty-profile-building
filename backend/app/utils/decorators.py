from functools import wraps

from flask import g, jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from app.extensions import db
from app.models.user import User


def get_current_authenticated_user():
    """Return the active authenticated user, or None.

    Routes should still use ``@jwt_required()``/``@role_required(...)``.  This
    helper centralises identity conversion and supports caching in ``g``.
    """
    identity = get_jwt_identity()
    # ``g`` normally belongs to a single request, but an enclosing application
    # context (common in tests and CLI helpers) can be reused by several
    # requests.  Cache together with the identity so a stale user can never be
    # returned for a different token.
    if getattr(g, "current_user_identity", None) == identity and hasattr(
        g, "current_user"
    ):
        return g.current_user
    try:
        user = db.session.get(User, int(identity)) if identity is not None else None
    except (TypeError, ValueError):
        user = None
    g.current_user = user
    g.current_user_identity = identity
    return user


def role_required(*allowed_roles):
    """Require a valid JWT belonging to one of the supplied roles."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user = get_current_authenticated_user()
            if not user or not user.is_active:
                return jsonify(
                    {
                        "success": False,
                        "message": "Account is inactive or does not exist.",
                    }
                ), 401
            if user.role not in allowed_roles:
                return jsonify(
                    {
                        "success": False,
                        "message": "Access forbidden for this role.",
                        "required_roles": list(allowed_roles),
                    }
                ), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def admin_or_owner(get_owner_id):
    """Decorator helper for resource ownership checks.

    ``get_owner_id`` receives the view arguments and returns the owner's user
    id.  Administrators bypass the check.
    """

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user = get_current_authenticated_user()
            if not user or not user.is_active:
                return jsonify({"success": False, "message": "Unauthorized."}), 401
            owner_id = get_owner_id(*args, **kwargs)
            if user.role != "admin" and user.id != owner_id:
                return jsonify({"success": False, "message": "Forbidden."}), 403
            return fn(*args, **kwargs)

        return wrapper

    return decorator
