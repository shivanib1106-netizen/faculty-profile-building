from datetime import datetime, timezone

from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db


class User(db.Model):
    __tablename__ = "users"
    __table_args__ = (
        db.CheckConstraint(
            "role IN ('faculty', 'hod', 'admin')", name="ck_users_role"
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="faculty", index=True)
    department_id = db.Column(
        db.Integer, db.ForeignKey("departments.id", ondelete="SET NULL"), nullable=True
    )
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    department = db.relationship("Department", back_populates="users")
    faculty_profile = db.relationship(
        "FacultyProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    activities = db.relationship(
        "AcademicActivity", back_populates="faculty", cascade="all, delete-orphan"
    )
    approvals_given = db.relationship("HODApproval", back_populates="hod_user")
    audit_logs = db.relationship("AuditLog", back_populates="user")
    notifications = db.relationship(
        "Notification", back_populates="user", cascade="all, delete-orphan"
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def display_name(self):
        if self.faculty_profile:
            return self.faculty_profile.full_name
        return self.username

    def to_dict(self):
        profile = self.faculty_profile
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "department_id": self.department_id,
            "department_name": self.department.name if self.department else None,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            # Frontend contract compatibility keys
            "name": self.display_name,
            "employeeId": profile.employee_id if profile else None,
            "departmentId": self.department_id,
            "department": self.department.name if self.department else None,
            "designation": profile.designation if profile else None,
            "phone": profile.contact_number if profile else None,
            "status": "active" if self.is_active else "inactive",
        }


class TokenBlocklist(db.Model):
    """Revoked JWT identifiers; enables server-side logout."""

    __tablename__ = "token_blocklist"

    jti = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    user = db.relationship("User")
