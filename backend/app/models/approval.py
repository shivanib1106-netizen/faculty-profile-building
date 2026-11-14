from datetime import datetime, timezone

from app.extensions import db


class HODApproval(db.Model):
    __tablename__ = "hod_approvals"
    __table_args__ = (
        db.CheckConstraint(
            "action IN ('APPROVED', 'REJECTED')", name="ck_approval_action"
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    activity_id = db.Column(
        db.Integer,
        db.ForeignKey("academic_activities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    hod_user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action = db.Column(db.String(20), nullable=False)
    remarks = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    activity = db.relationship("AcademicActivity", back_populates="approvals")
    hod_user = db.relationship("User", back_populates="approvals_given")

    def to_dict(self):
        return {
            "id": self.id,
            "activity_id": self.activity_id,
            "hod_user_id": self.hod_user_id,
            "hod_name": self.hod_user.display_name if self.hod_user else None,
            "action": self.action,
            "remarks": self.remarks,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
