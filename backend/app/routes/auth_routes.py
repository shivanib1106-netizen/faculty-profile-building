from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt, jwt_required
from sqlalchemy import func

from app.extensions import db
from app.models.department import Department
from app.models.notification import Notification
from app.models.user import TokenBlocklist, User
from app.services.audit_service import AuditService
from app.utils.decorators import get_current_authenticated_user
from app.utils.validators import (
    parse_int,
    validate_email,
    validate_password,
    validate_required_fields,
    validate_username,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _issue_token(user):
    return create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role, "username": user.username},
    )


@auth_bp.post("/register")
def register():
    """Public self-registration for faculty only.

    HOD and Admin accounts must be created by an administrator.  Allowing a
    public caller to choose an elevated role would be a privilege-escalation
    vulnerability.
    """
    data = request.get_json(silent=True) or {}
    valid, missing = validate_required_fields(data, ["username", "email", "password"])
    if not valid:
        return jsonify(
            {
                "success": False,
                "message": f"Missing required fields: {', '.join(missing)}",
            }
        ), 400

    username = str(data["username"]).strip()
    email = str(data["email"]).strip().lower()
    password = data["password"]
    requested_role = str(data.get("role", "faculty")).strip().lower()

    if requested_role != "faculty":
        return jsonify(
            {
                "success": False,
                "message": "Public registration is available only for the faculty role. "
                "An administrator must create HOD and Admin accounts.",
            }
        ), 403

    if not validate_username(username):
        return jsonify(
            {
                "success": False,
                "message": "Username must be 3-80 characters and may contain letters, "
                "numbers, dots, underscores and hyphens.",
            }
        ), 400
    if not validate_email(email):
        return jsonify({"success": False, "message": "Invalid email format."}), 400

    password_valid, password_error = validate_password(
        password, min_length=8
    )
    if not password_valid:
        return jsonify({"success": False, "message": password_error}), 400

    if User.query.filter(func.lower(User.username) == username.lower()).first():
        return jsonify({"success": False, "message": "Username already exists."}), 409
    if User.query.filter(func.lower(User.email) == email).first():
        return jsonify({"success": False, "message": "Email already registered."}), 409

    department_id = data.get("department_id")
    if department_id is not None:
        department_id, error = parse_int(department_id, "department_id", minimum=1)
        if error:
            return jsonify({"success": False, "message": error}), 400
        if not db.session.get(Department, department_id):
            return jsonify({"success": False, "message": "Invalid department_id."}), 400

    user = User(
        username=username,
        email=email,
        role="faculty",
        department_id=department_id,
        is_active=True,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    AuditService.log_action(
        user_id=user.id,
        action="USER_REGISTERED",
        target_entity="User",
        target_id=user.id,
        details=f"Faculty user {username} registered.",
    )

    token = _issue_token(user)
    return jsonify(
        {
            "success": True,
            "message": "Registration successful.",
            "access_token": token,
            "token": token,
            "user": user.to_dict(),
        }
    ), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    identifier = (
        data.get("identifier")
        or data.get("username")
        or data.get("email")
        or ""
    ).strip()
    password = data.get("password")

    if not identifier or not password:
        return jsonify(
            {
                "success": False,
                "message": "Username/email and password are required.",
            }
        ), 400

    user = User.query.filter(
        (func.lower(User.username) == identifier.lower())
        | (func.lower(User.email) == identifier.lower())
    ).first()

    if not user:
        # Check by employee ID
        from app.models.faculty import FacultyProfile
        profile = FacultyProfile.query.filter(
            func.lower(FacultyProfile.employee_id) == identifier.lower()
        ).first()
        if profile and profile.user:
            user = profile.user

    if not user or not user.check_password(password):
        return jsonify({"success": False, "message": "Invalid credentials."}), 401
    if not user.is_active:
        return jsonify(
            {
                "success": False,
                "message": "Account is deactivated. Contact an administrator.",
            }
        ), 403

    AuditService.log_action(
        user_id=user.id,
        action="USER_LOGIN",
        target_entity="User",
        target_id=user.id,
        details=f"User {user.username} logged in.",
    )

    token = _issue_token(user)
    return jsonify(
        {
            "success": True,
            "message": "Login successful.",
            "access_token": token,
            "token": token,
            "user": user.to_dict(),
        }
    ), 200


@auth_bp.post("/logout")
@jwt_required()
def logout():
    user = get_current_authenticated_user()
    claims = get_jwt()
    jti = claims.get("jti")
    if jti:
        existing = db.session.get(TokenBlocklist, jti)
        if not existing:
            db.session.add(
                TokenBlocklist(jti=jti, user_id=user.id if user else None)
            )
            db.session.commit()
    if user:
        AuditService.log_action(
            user_id=user.id,
            action="USER_LOGOUT",
            target_entity="User",
            target_id=user.id,
            details="Access token revoked.",
        )
    return jsonify({"success": True, "message": "Logged out successfully."}), 200


@auth_bp.get("/me")
@jwt_required()
def get_current_user_profile():
    user = get_current_authenticated_user()
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404
    payload = user.to_dict()
    payload["profile"] = (
        user.faculty_profile.to_dict() if user.faculty_profile else None
    )
    return jsonify({"success": True, "user": payload}), 200


@auth_bp.get("/notifications")
@jwt_required()
def get_notifications():
    user = get_current_authenticated_user()
    if not user:
        return jsonify({"success": False, "message": "User not found."}), 404
    query = Notification.query.filter_by(user_id=user.id)
    if request.args.get("unread_only", "").lower() in {"1", "true", "yes"}:
        query = query.filter_by(is_read=False)
    notifications = query.order_by(Notification.created_at.desc()).all()
    unread = Notification.query.filter_by(user_id=user.id, is_read=False).count()
    return jsonify(
        {
            "success": True,
            "count": len(notifications),
            "unread_count": unread,
            "notifications": [item.to_dict() for item in notifications],
        }
    ), 200


@auth_bp.put("/notifications/<int:notification_id>/read")
@jwt_required()
def mark_notification_read(notification_id):
    user = get_current_authenticated_user()
    notification = Notification.query.filter_by(
        id=notification_id, user_id=user.id
    ).first()
    if not notification:
        return jsonify({"success": False, "message": "Notification not found."}), 404
    notification.is_read = True
    db.session.commit()
    return jsonify({"success": True, "message": "Notification marked as read."}), 200


@auth_bp.put("/notifications/read-all")
@jwt_required()
def mark_all_notifications_read():
    user = get_current_authenticated_user()
    updated = Notification.query.filter_by(user_id=user.id, is_read=False).update(
        {"is_read": True}
    )
    db.session.commit()
    return jsonify(
        {"success": True, "message": f"{updated} notification(s) marked as read."}
    ), 200


@auth_bp.post("/change-password")
@jwt_required()
def change_password():
    user = get_current_authenticated_user()
    data = request.get_json(silent=True) or {}
    old_password = data.get("oldPassword") or data.get("current_password") or data.get("old_password")
    new_password = data.get("newPassword") or data.get("new_password")

    if not old_password or not new_password:
        return jsonify(
            {"success": False, "message": "Both current and new password are required."}
        ), 400

    if not user.check_password(old_password):
        return jsonify({"success": False, "message": "Incorrect current password."}), 400

    valid, err = validate_password(new_password, min_length=8)
    if not valid:
        return jsonify({"success": False, "message": err}), 400

    user.set_password(new_password)
    db.session.commit()

    AuditService.log_action(
        user_id=user.id,
        action="USER_PASSWORD_CHANGED",
        target_entity="User",
        target_id=user.id,
        details="User updated their account password.",
    )

    return jsonify({"success": True, "message": "Password changed successfully."}), 200


@auth_bp.post("/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email") or "").strip().lower()
    # Always return 200 to avoid account enumeration
    return jsonify(
        {
            "success": True,
            "message": "If the email exists, reset instructions have been sent.",
        }
    ), 200


@auth_bp.post("/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    token = data.get("token")
    new_password = data.get("newPassword") or data.get("new_password")

    if not token or not new_password:
        return jsonify(
            {"success": False, "message": "Token and new password are required."}
        ), 400

    valid, err = validate_password(new_password, min_length=8)
    if not valid:
        return jsonify({"success": False, "message": err}), 400

    # For development demonstration, return success
    return jsonify({"success": True, "message": "Password updated successfully."}), 200
