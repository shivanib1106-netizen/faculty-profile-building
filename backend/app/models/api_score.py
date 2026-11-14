from datetime import datetime, timezone

from app.extensions import db


class APICalculationHistory(db.Model):
    __tablename__ = "api_calculation_history"
    __table_args__ = (
        db.CheckConstraint(
            "calculation_type IN ('VERIFIED_ONLY', 'ALL_ACTIVITIES')",
            name="ck_calculation_type",
        ),
        db.CheckConstraint(
            "status IN ('OFFICIAL', 'PROVISIONAL', 'SUPERSEDED')",
            name="ck_calculation_status",
        ),
        db.Index("ix_calc_faculty_year", "faculty_id", "academic_year_id"),
    )

    id = db.Column(db.Integer, primary_key=True)
    faculty_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    academic_year_id = db.Column(
        db.Integer,
        db.ForeignKey("academic_years.id"),
        nullable=False,
        index=True,
    )
    rule_version = db.Column(db.String(255), nullable=False, default="UNCONFIGURED")

    cat1_raw_score = db.Column(db.Float, default=0.0, nullable=False)
    cat1_eligible_score = db.Column(db.Float, default=0.0, nullable=False)
    cat1_final_score = db.Column(db.Float, default=0.0, nullable=False)
    cat1_cap_applied = db.Column(db.Float, nullable=True)

    cat2_raw_score = db.Column(db.Float, default=0.0, nullable=False)
    cat2_eligible_score = db.Column(db.Float, default=0.0, nullable=False)
    cat2_final_score = db.Column(db.Float, default=0.0, nullable=False)
    cat2_cap_applied = db.Column(db.Float, nullable=True)

    cat3_raw_score = db.Column(db.Float, default=0.0, nullable=False)
    cat3_eligible_score = db.Column(db.Float, default=0.0, nullable=False)
    cat3_final_score = db.Column(db.Float, default=0.0, nullable=False)
    cat3_cap_applied = db.Column(db.Float, nullable=True)

    total_raw_score = db.Column(db.Float, default=0.0, nullable=False)
    total_eligible_score = db.Column(db.Float, default=0.0, nullable=False)
    total_final_score = db.Column(db.Float, default=0.0, nullable=False)

    calculated_by_user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    calculation_date = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    calculation_type = db.Column(
        db.String(30), default="VERIFIED_ONLY", nullable=False
    )
    status = db.Column(db.String(30), default="OFFICIAL", nullable=False, index=True)
    superseded_at = db.Column(db.DateTime, nullable=True)

    faculty = db.relationship("User", foreign_keys=[faculty_id])
    calculated_by = db.relationship("User", foreign_keys=[calculated_by_user_id])
    academic_year = db.relationship("AcademicYear", back_populates="calculation_histories")
    details = db.relationship(
        "APIScoreDetail",
        back_populates="calculation_history",
        cascade="all, delete-orphan",
        order_by="APIScoreDetail.id.asc()",
    )

    def to_dict(self, include_details=False):
        profile = self.faculty.faculty_profile if self.faculty else None
        data = {
            "id": self.id,
            "faculty_id": self.faculty_id,
            "faculty_name": profile.full_name if profile else None,
            "academic_year_id": self.academic_year_id,
            "academic_year": self.academic_year.year_label
            if self.academic_year
            else None,
            "rule_version": self.rule_version,
            "category_1": {
                "raw": self.cat1_raw_score,
                "eligible": self.cat1_eligible_score,
                "final": self.cat1_final_score,
                "cap_applied": self.cat1_cap_applied,
            },
            "category_2": {
                "raw": self.cat2_raw_score,
                "eligible": self.cat2_eligible_score,
                "final": self.cat2_final_score,
                "cap_applied": self.cat2_cap_applied,
            },
            "category_3": {
                "raw": self.cat3_raw_score,
                "eligible": self.cat3_eligible_score,
                "final": self.cat3_final_score,
                "cap_applied": self.cat3_cap_applied,
            },
            "total_raw_score": self.total_raw_score,
            "total_eligible_score": self.total_eligible_score,
            "total_final_score": self.total_final_score,
            "calculation_type": self.calculation_type,
            "status": self.status,
            "calculation_date": self.calculation_date.isoformat()
            if self.calculation_date
            else None,
            "superseded_at": self.superseded_at.isoformat()
            if self.superseded_at
            else None,
            "calculated_by_user_id": self.calculated_by_user_id,
        }
        if include_details:
            data["activity_details"] = [detail.to_dict() for detail in self.details]
        return data


class APIScoreDetail(db.Model):
    __tablename__ = "api_score_details"

    id = db.Column(db.Integer, primary_key=True)
    calculation_history_id = db.Column(
        db.Integer,
        db.ForeignKey("api_calculation_history.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    activity_id = db.Column(
        db.Integer,
        db.ForeignKey("academic_activities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    raw_score = db.Column(db.Float, default=0.0, nullable=False)
    eligible_score = db.Column(db.Float, default=0.0, nullable=False)
    final_score = db.Column(db.Float, default=0.0, nullable=False)
    category_limit_applied = db.Column(db.Float, nullable=True)
    verification_status = db.Column(db.String(20), nullable=False)
    rule_code = db.Column(db.String(50), nullable=True)
    rule_version = db.Column(db.String(50), nullable=True)

    calculation_history = db.relationship(
        "APICalculationHistory", back_populates="details"
    )
    activity = db.relationship("AcademicActivity", back_populates="score_details")

    def to_dict(self):
        return {
            "id": self.id,
            "calculation_history_id": self.calculation_history_id,
            "activity_id": self.activity_id,
            "activity_title": self.activity.title if self.activity else None,
            "activity_type": self.activity.activity_type if self.activity else None,
            "category_code": self.activity.category.category_code
            if self.activity and self.activity.category
            else None,
            "raw_score": self.raw_score,
            "eligible_score": self.eligible_score,
            "final_score": self.final_score,
            "category_limit_applied": self.category_limit_applied,
            "verification_status": self.verification_status,
            "rule_code": self.rule_code,
            "rule_version": self.rule_version,
        }
