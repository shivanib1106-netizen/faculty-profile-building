from datetime import datetime, timezone

from flask import current_app

from app.extensions import db
from app.models.activity import AcademicActivity
from app.models.approval import HODApproval
from app.models.notification import Notification
from app.models.user import User
from app.services.api_calculation import APICalculationEngine
from app.services.audit_service import AuditService


class ApprovalService:
    @staticmethod
    def submit_activity(activity_id, faculty_user):
        activity = db.session.get(AcademicActivity, int(activity_id))
        if not activity:
            return None, "Activity not found."
        if activity.faculty_id != faculty_user.id:
            return None, "Unauthorized: you can only submit your own activities."
        if activity.status == "SUBMITTED":
            return None, "Activity is already submitted for verification."
        if activity.status == "APPROVED":
            return None, "Activity is already approved."
        if activity.status not in {"DRAFT", "REJECTED"}:
            return None, "Only DRAFT or REJECTED activities can be submitted."
        if (
            current_app.config.get("REQUIRE_ACTIVITY_DOCUMENT_FOR_SUBMISSION")
            and not activity.documents
        ):
            return None, "Upload at least one supporting document before submitting."

        activity.status = "SUBMITTED"
        activity.hod_remarks = None
        activity.submitted_at = datetime.now(timezone.utc)
        activity.verified_at = None

        # Reset document status for resubmissions
        for doc in activity.documents:
            if doc.verification_status == "REJECTED":
                doc.verification_status = "PENDING"
                doc.remarks = None
                doc.verified_by_user_id = None
                doc.verified_at = None

        if faculty_user.department_id:
            hods = User.query.filter_by(
                department_id=faculty_user.department_id,
                role="hod",
                is_active=True,
            ).all()
            for hod in hods:
                db.session.add(
                    Notification(
                        user_id=hod.id,
                        title="New Academic Activity Submitted",
                        message=(
                            f"{faculty_user.display_name} submitted '{activity.title}' "
                            "for verification."
                        ),
                    )
                )

        db.session.commit()
        AuditService.log_action(
            user_id=faculty_user.id,
            action="ACTIVITY_SUBMITTED",
            target_entity="AcademicActivity",
            target_id=activity.id,
            details=f"Activity '{activity.title}' submitted for verification.",
        )
        return activity, None

    @staticmethod
    def review_activity(activity_id, reviewer_user, action, remarks=None):
        action = str(action or "").strip().upper()
        if action not in {"APPROVED", "REJECTED"}:
            return None, "Action must be either APPROVED or REJECTED."
        remarks = (remarks or "").strip() or None
        if action == "REJECTED" and not remarks:
            return None, "Remarks are mandatory when rejecting an activity."

        activity = db.session.get(AcademicActivity, int(activity_id))
        if not activity:
            return None, "Activity not found."
        if activity.status != "SUBMITTED":
            return None, "Only activities in SUBMITTED status can be verified."

        if reviewer_user.role == "hod":
            faculty = activity.faculty
            if not faculty or faculty.department_id != reviewer_user.department_id:
                return None, "Forbidden: HOD can only review activities in their department."
        elif reviewer_user.role != "admin":
            return None, "Forbidden: only HOD or Admin can review activities."

        if activity.faculty_id == reviewer_user.id:
            return None, "You cannot verify your own activity."

        now = datetime.now(timezone.utc)
        approval = HODApproval(
            activity_id=activity.id,
            hod_user_id=reviewer_user.id,
            action=action,
            remarks=remarks,
        )
        db.session.add(approval)

        activity.status = action
        activity.hod_remarks = remarks
        activity.verified_at = now

        for document in activity.documents:
            document.verification_status = (
                "VERIFIED" if action == "APPROVED" else "REJECTED"
            )
            document.remarks = remarks
            document.verified_by_user_id = reviewer_user.id
            document.verified_at = now

        db.session.add(
            Notification(
                user_id=activity.faculty_id,
                title=f"Activity {action.capitalize()}",
                message=(
                    f"Your submission '{activity.title}' was {action.lower()} by "
                    f"{reviewer_user.display_name}. Remarks: {remarks or 'None'}"
                ),
            )
        )
        db.session.commit()

        # Recalculation is deliberately deterministic and performed after the
        # review transaction.  A failed recalculation does not erase the HOD's
        # decision and is reported through the server log.
        calculation = None
        calculation_error = None
        try:
            calculation = APICalculationEngine.calculate_faculty_api(
                faculty_id=activity.faculty_id,
                academic_year_id=activity.academic_year_id,
                calculation_type="VERIFIED_ONLY",
                user_id=reviewer_user.id,
                save_history=True,
            )
        except Exception as exc:  # pragma: no cover - defensive logging
            db.session.rollback()
            current_app.logger.exception("Automatic recalculation failed")
            calculation_error = str(exc)

        AuditService.log_action(
            user_id=reviewer_user.id,
            action=f"ACTIVITY_{action}",
            target_entity="AcademicActivity",
            target_id=activity.id,
            details=(
                f"Activity '{activity.title}' {action.lower()} by "
                f"{reviewer_user.username}. Remarks: {remarks or 'None'}"
            ),
        )
        if calculation_error:
            current_app.logger.warning(
                "Approval saved but recalculation failed for activity %s: %s",
                activity.id,
                calculation_error,
            )
        return activity, None

    @staticmethod
    def add_activity_remarks(activity_id, reviewer_user, remarks):
        remarks = (remarks or "").strip()
        if not remarks:
            return None, "Remarks cannot be empty."
        activity = db.session.get(AcademicActivity, int(activity_id))
        if not activity:
            return None, "Activity not found."

        if reviewer_user.role == "hod":
            faculty = activity.faculty
            target_dept = faculty.department_id if faculty else None
            if not target_dept and faculty and faculty.faculty_profile:
                target_dept = faculty.faculty_profile.department_id
            if not target_dept or target_dept != reviewer_user.department_id:
                return None, "Forbidden: HOD can only review activities in their department."
        elif reviewer_user.role != "admin":
            return None, "Forbidden: only HOD or Admin can add remarks."

        activity.hod_remarks = remarks
        db.session.commit()

        AuditService.log_action(
            user_id=reviewer_user.id,
            action="ACTIVITY_REMARKS_ADDED",
            target_entity="AcademicActivity",
            target_id=activity.id,
            details=f"Remarks added for activity '{activity.title}': {remarks[:100]}",
        )
        return activity, None
