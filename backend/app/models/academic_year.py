from datetime import datetime, timezone

from app.extensions import db


class AcademicYear(db.Model):
    __tablename__ = "academic_years"
    __table_args__ = (
        db.CheckConstraint("start_date < end_date", name="ck_academic_year_dates"),
    )

    id = db.Column(db.Integer, primary_key=True)
    year_label = db.Column(db.String(20), unique=True, nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    activities = db.relationship("AcademicActivity", back_populates="academic_year")
    calculation_histories = db.relationship(
        "APICalculationHistory", back_populates="academic_year"
    )

    def contains(self, value):
        return self.start_date <= value <= self.end_date

    def to_dict(self):
        return {
            "id": self.id,
            "year_label": self.year_label,
            "year": self.year_label,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "startDate": self.start_date.isoformat() if self.start_date else None,
            "endDate": self.end_date.isoformat() if self.end_date else None,
            "is_active": self.is_active,
            "status": "Active" if self.is_active else "Inactive",
            "is_current": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
