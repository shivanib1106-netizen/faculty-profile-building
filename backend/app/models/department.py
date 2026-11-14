from datetime import datetime, timezone

from app.extensions import db


class Department(db.Model):
    __tablename__ = "departments"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), unique=True, nullable=False)
    code = db.Column(db.String(20), unique=True, nullable=False, index=True)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    users = db.relationship("User", back_populates="department")
    faculty_profiles = db.relationship("FacultyProfile", back_populates="department")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "description": self.description,
            "faculty_count": len(self.faculty_profiles) if self.faculty_profiles else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
