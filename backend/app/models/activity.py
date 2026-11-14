import json
from datetime import datetime, timezone

from app.extensions import db


class AcademicActivity(db.Model):
    __tablename__ = "academic_activities"
    __table_args__ = (
        db.CheckConstraint(
            "status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')",
            name="ck_activity_status",
        ),
        db.CheckConstraint("duration_or_units > 0", name="ck_activity_units"),
        db.Index("ix_activity_faculty_year", "faculty_id", "academic_year_id"),
        db.Index("ix_activity_status_year", "status", "academic_year_id"),
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
    category_id = db.Column(
        db.Integer,
        db.ForeignKey("activity_categories.id"),
        nullable=False,
        index=True,
    )
    activity_type = db.Column(db.String(100), nullable=False, index=True)

    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    activity_date = db.Column(db.Date, nullable=False)
    duration_or_units = db.Column(db.Float, default=1.0, nullable=False)
    co_author_role = db.Column(db.String(50), nullable=True)
    additional_data = db.Column(db.Text, nullable=True)

    status = db.Column(
        db.String(20), default="DRAFT", nullable=False, index=True
    )
    hod_remarks = db.Column(db.Text, nullable=True)
    submitted_at = db.Column(db.DateTime, nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)

    # Snapshot of the most recent calculation for convenient display.  The
    # immutable source of truth remains APICalculationHistory/APIScoreDetail.
    raw_score = db.Column(db.Float, default=0.0, nullable=False)
    eligible_score = db.Column(db.Float, default=0.0, nullable=False)
    final_score = db.Column(db.Float, default=0.0, nullable=False)
    category_limit_applied = db.Column(db.Float, nullable=True)
    score_updated_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    faculty = db.relationship("User", back_populates="activities")
    academic_year = db.relationship("AcademicYear", back_populates="activities")
    category = db.relationship("ActivityCategory", back_populates="activities")
    documents = db.relationship(
        "SupportingDocument", back_populates="activity", cascade="all, delete-orphan"
    )
    approvals = db.relationship(
        "HODApproval",
        back_populates="activity",
        cascade="all, delete-orphan",
        order_by="HODApproval.created_at.desc()",
    )
    score_details = db.relationship(
        "APIScoreDetail", back_populates="activity", cascade="all, delete-orphan"
    )

    def get_parsed_additional_data(self):
        if not self.additional_data:
            return {}
        try:
            return json.loads(self.additional_data)
        except (TypeError, ValueError):
            return {"raw": self.additional_data}

    def set_parsed_additional_data(self, data):
        if isinstance(data, (dict, list)):
            self.additional_data = json.dumps(data)
        else:
            self.additional_data = str(data) if data is not None else None

    def to_dict(self, include_documents=True):
        profile = self.faculty.faculty_profile if self.faculty else None
        category_key = (
            "cat1"
            if self.category
            and "I" in self.category.category_code
            and "II" not in self.category.category_code
            and "III" not in self.category.category_code
            else (
                "cat2"
                if self.category and "II" in self.category.category_code and "III" not in self.category.category_code
                else ("cat3" if self.category and "III" in self.category.category_code else "cat1")
            )
        )
        return {
            "id": self.id,
            "faculty_id": self.faculty_id,
            "facultyId": self.faculty_id,
            "faculty_name": profile.full_name if profile else (
                self.faculty.username if self.faculty else None
            ),
            "facultyName": profile.full_name if profile else (
                self.faculty.username if self.faculty else None
            ),
            "employee_id": profile.employee_id if profile else None,
            "employeeId": profile.employee_id if profile else None,
            "department_id": self.faculty.department_id if self.faculty else None,
            "department": self.faculty.department.name if self.faculty and self.faculty.department else None,
            "academic_year_id": self.academic_year_id,
            "academic_year": self.academic_year.year_label
            if self.academic_year
            else None,
            "academicYear": self.academic_year.year_label
            if self.academic_year
            else None,
            "category_id": self.category_id,
            "category_code": self.category.category_code if self.category else None,
            "category_name": self.category.name if self.category else None,
            "category": self.category.name if self.category else None,
            "categoryKey": category_key,
            "activity_type": self.activity_type,
            "activityType": self.activity_type,
            "title": self.title,
            "description": self.description,
            "details": self.description,
            "activity_date": self.activity_date.isoformat()
            if self.activity_date
            else None,
            "activityDate": self.activity_date.isoformat()
            if self.activity_date
            else None,
            "duration_or_units": self.duration_or_units,
            "co_author_role": self.co_author_role,
            "additional_data": self.get_parsed_additional_data(),
            "status": self.status,
            "verification_status": self.status,
            "hod_remarks": self.hod_remarks,
            "remarks": self.hod_remarks or "",
            "submitted_at": self.submitted_at.isoformat()
            if self.submitted_at
            else None,
            "submissionDate": self.submitted_at.isoformat()
            if self.submitted_at
            else None,
            "verified_at": self.verified_at.isoformat() if self.verified_at else None,
            "verifiedBy": self.approvals[0].hod_user.display_name if self.approvals and self.approvals[0].hod_user else None,
            "documentId": self.documents[0].id if self.documents else None,
            "documentName": self.documents[0].original_filename if self.documents else None,
            "raw_score": self.raw_score,
            "eligible_score": self.eligible_score,
            "final_score": self.final_score,
            "category_limit_applied": self.category_limit_applied,
            "score_updated_at": self.score_updated_at.isoformat()
            if self.score_updated_at
            else None,
            "documents": [d.to_dict() for d in self.documents]
            if include_documents
            else [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
