from datetime import datetime, timezone

from app.extensions import db


class SystemSetting(db.Model):
    """Simple key/value configuration surface for administrators.

    Environment variables remain the source of truth for deployment secrets and
    infrastructure settings.  This table is intended for non-secret operational
    flags that administrators may change at runtime.
    """

    __tablename__ = "system_settings"

    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.Text, nullable=True)
    description = db.Column(db.String(255), nullable=True)
    updated_by_user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_by = db.relationship("User")

    def to_dict(self):
        return {
            "key": self.key,
            "value": self.value,
            "description": self.description,
            "updated_by_user_id": self.updated_by_user_id,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
