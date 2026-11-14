from datetime import datetime, timezone

from app.extensions import db


class FacultyProfile(db.Model):
    __tablename__ = "faculty_profiles"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    employee_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    department_id = db.Column(
        db.Integer, db.ForeignKey("departments.id"), nullable=False, index=True
    )
    designation = db.Column(db.String(100), nullable=False)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    date_of_birth = db.Column(db.Date, nullable=True)
    gender = db.Column(db.String(20), nullable=True)
    blood_group = db.Column(db.String(10), nullable=True)
    date_of_joining = db.Column(db.Date, nullable=False)
    contact_number = db.Column(db.String(20), nullable=False)
    alternate_email = db.Column(db.String(120), nullable=True)
    address = db.Column(db.Text, nullable=True)
    research_interests = db.Column(db.Text, nullable=True)
    professional_memberships = db.Column(db.Text, nullable=True)
    subjects_handled = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = db.relationship("User", back_populates="faculty_profile")
    department = db.relationship("Department", back_populates="faculty_profiles")
    qualifications = db.relationship(
        "Qualification",
        back_populates="faculty_profile",
        cascade="all, delete-orphan",
        order_by="Qualification.year_of_passing.desc()",
    )
    work_experiences = db.relationship(
        "WorkExperience",
        back_populates="faculty_profile",
        cascade="all, delete-orphan",
        order_by="WorkExperience.from_date.desc()",
    )

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def calculate_experience_breakdown(self):
        from datetime import date
        today = date.today()
        totals = {"teaching": 0.0, "research": 0.0, "industry": 0.0, "previous": 0.0}
        for exp in self.work_experiences:
            start = exp.from_date
            end = today if exp.is_current or not exp.to_date else exp.to_date
            if start and end and end >= start:
                days = (end - start).days
                years = round(days / 365.25, 2)
                t = (exp.experience_type or "").lower()
                if t in totals:
                    totals[t] += years
        totals["total"] = round(sum(totals.values()), 2)
        return totals

    def to_dict(self, include_relations=True):
        exp_stats = self.calculate_experience_breakdown()
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "username": self.user.username if self.user else None,
            "email": self.user.email if self.user else None,
            "employee_id": self.employee_id,
            "full_name": self.full_name,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "department_id": self.department_id,
            "department_name": self.department.name if self.department else None,
            "department_code": self.department.code if self.department else None,
            "designation": self.designation,
            "date_of_birth": self.date_of_birth.isoformat()
            if self.date_of_birth
            else None,
            "gender": self.gender,
            "blood_group": self.blood_group,
            "date_of_joining": self.date_of_joining.isoformat()
            if self.date_of_joining
            else None,
            "contact_number": self.contact_number,
            "alternate_email": self.alternate_email,
            "address": self.address,
            "research_interests": self.research_interests,
            "professional_memberships": self.professional_memberships,
            "subjects_handled": self.subjects_handled,
            "experience_summary": {
                "total_experience_years": exp_stats["total"],
                "teaching_experience_years": round(exp_stats["teaching"], 2),
                "research_experience_years": round(exp_stats["research"], 2),
                "industry_experience_years": round(exp_stats["industry"], 2),
                "previous_experience_years": round(exp_stats["previous"], 2),
            },
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            # Frontend contract compatibility
            "personalInfo": {
                "userId": self.user_id,
                "fullName": self.full_name,
                "employeeId": self.employee_id,
                "email": self.user.email if self.user else None,
                "phone": self.contact_number,
                "alternateEmail": self.alternate_email,
                "department": self.department.name if self.department else None,
                "departmentId": self.department_id,
                "designation": self.designation,
                "dateOfJoining": self.date_of_joining.isoformat()
                if self.date_of_joining
                else None,
                "dateOfBirth": self.date_of_birth.isoformat()
                if self.date_of_birth
                else None,
                "gender": self.gender,
                "bloodGroup": self.blood_group,
                "address": self.address,
                "researchInterests": self.research_interests,
                "teachingInterests": self.subjects_handled,
                "subjectsHandled": self.subjects_handled,
                "professionalMemberships": self.professional_memberships,
            },
        }
        if include_relations:
            data["qualifications"] = [q.to_dict() for q in self.qualifications]
            data["work_experiences"] = [w.to_dict() for w in self.work_experiences]
            data["experience"] = data["work_experiences"]
        return data


class Qualification(db.Model):
    __tablename__ = "qualifications"
    __table_args__ = (
        db.CheckConstraint(
            "year_of_passing BETWEEN 1900 AND 2100",
            name="ck_qualification_year",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    faculty_profile_id = db.Column(
        db.Integer,
        db.ForeignKey("faculty_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    degree = db.Column(db.String(100), nullable=False)
    specialization = db.Column(db.String(150), nullable=True)
    institution = db.Column(db.String(200), nullable=False)
    board_university = db.Column(db.String(200), nullable=False)
    year_of_passing = db.Column(db.Integer, nullable=False)
    percentage_or_cgpa = db.Column(db.String(30), nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    faculty_profile = db.relationship("FacultyProfile", back_populates="qualifications")

    def to_dict(self):
        return {
            "id": self.id,
            "faculty_profile_id": self.faculty_profile_id,
            "degree": self.degree,
            "specialization": self.specialization,
            "institution": self.institution,
            "board_university": self.board_university,
            "university": self.board_university,
            "year_of_passing": self.year_of_passing,
            "yearOfPassing": str(self.year_of_passing),
            "percentage_or_cgpa": self.percentage_or_cgpa,
            "percentageOrCgpa": self.percentage_or_cgpa,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class WorkExperience(db.Model):
    __tablename__ = "work_experiences"
    __table_args__ = (
        db.CheckConstraint(
            "experience_type IN ('teaching', 'research', 'industry', 'previous')",
            name="ck_work_experience_type",
        ),
        db.CheckConstraint(
            "to_date IS NULL OR from_date <= to_date",
            name="ck_work_experience_dates",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    faculty_profile_id = db.Column(
        db.Integer,
        db.ForeignKey("faculty_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    organization = db.Column(db.String(200), nullable=False)
    designation = db.Column(db.String(100), nullable=False)
    experience_type = db.Column(db.String(30), nullable=False)
    from_date = db.Column(db.Date, nullable=False)
    to_date = db.Column(db.Date, nullable=True)
    is_current = db.Column(db.Boolean, default=False, nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    faculty_profile = db.relationship("FacultyProfile", back_populates="work_experiences")

    def to_dict(self):
        return {
            "id": self.id,
            "faculty_profile_id": self.faculty_profile_id,
            "organization": self.organization,
            "institution": self.organization,
            "designation": self.designation,
            "experience_type": self.experience_type,
            "employmentType": self.experience_type,
            "from_date": self.from_date.isoformat() if self.from_date else None,
            "startDate": self.from_date.isoformat() if self.from_date else None,
            "to_date": self.to_date.isoformat() if self.to_date else None,
            "endDate": self.to_date.isoformat() if self.to_date else "",
            "is_current": self.is_current,
            "isCurrent": self.is_current,
            "description": self.description,
            "totalExperience": self.description or "",
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
