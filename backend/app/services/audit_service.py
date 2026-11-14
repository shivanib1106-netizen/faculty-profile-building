from flask import has_request_context, request

from app.extensions import db
from app.models.audit_log import AuditLog


class AuditService:
    @staticmethod
    def _client_ip():
        if not has_request_context():
            return "system"
        forwarded = request.headers.get("X-Forwarded-For", "")
        if forwarded:
            return forwarded.split(",")[0].strip()[:50]
        return (request.remote_addr or "unknown")[:50]

    @staticmethod
    def log_action(user_id, action, target_entity=None, target_id=None, details=None):
        """Persist an audit event.

        Callers normally commit their business transaction first.  Audit
        failures never replace the original API response with a 500.
        """
        try:
            entry = AuditLog(
                user_id=user_id,
                action=str(action)[:100],
                target_entity=str(target_entity)[:50] if target_entity else None,
                target_id=str(target_id)[:50] if target_id is not None else None,
                details=details,
                ip_address=AuditService._client_ip(),
            )
            db.session.add(entry)
            db.session.commit()
            return entry
        except Exception:
            db.session.rollback()
            return None
