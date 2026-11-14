from datetime import datetime, timezone

from app.extensions import db


class SupportingDocument(db.Model):
    __tablename__ = "supporting_documents"
    __table_args__ = (
        db.CheckConstraint(
            "verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')",
            name="ck_document_verification_status",
        ),
        db.CheckConstraint("file_size > 0", name="ck_document_file_size"),
    )

    id = db.Column(db.Integer, primary_key=True)
    faculty_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    activity_id = db.Column(
        db.Integer,
        db.ForeignKey("academic_activities.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    document_type = db.Column(db.String(80), nullable=False, default="general")
    original_filename = db.Column(db.String(255), nullable=False)
    stored_filename = db.Column(db.String(255), unique=True, nullable=False)
    file_path = db.Column(db.String(500), nullable=False)
    file_type = db.Column(db.String(100), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    checksum_sha256 = db.Column(db.String(64), nullable=True)

    verification_status = db.Column(
        db.String(20), default="PENDING", nullable=False, index=True
    )
    remarks = db.Column(db.Text, nullable=True)
    verified_by_user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    verified_at = db.Column(db.DateTime, nullable=True)
    upload_date = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    activity = db.relationship("AcademicActivity", back_populates="documents")
    faculty = db.relationship("User", foreign_keys=[faculty_id])
    verified_by = db.relationship("User", foreign_keys=[verified_by_user_id])

    def to_dict(self):
        return {
            "id": self.id,
            "faculty_id": self.faculty_id,
            "activity_id": self.activity_id,
            "document_type": self.document_type,
            "category": self.document_type,
            "original_filename": self.original_filename,
            "fileName": self.original_filename,
            "title": self.original_filename,
            "stored_filename": self.stored_filename,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "checksum_sha256": self.checksum_sha256,
            "verification_status": self.verification_status,
            "status": self.verification_status,
            "remarks": self.remarks,
            "verified_by_user_id": self.verified_by_user_id,
            "verified_at": self.verified_at.isoformat()
            if self.verified_at
            else None,
            "upload_date": self.upload_date.isoformat()
            if self.upload_date
            else None,
            "uploadedAt": self.upload_date.isoformat()
            if self.upload_date
            else None,
        }
