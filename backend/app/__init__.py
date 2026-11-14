import os

from flask import Flask, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import HTTPException

from app.config import config_by_name
from app.extensions import cors, db, jwt, migrate
from app.routes import (
    activity_bp,
    admin_bp,
    auth_bp,
    calculation_bp,
    compat_bp,
    document_bp,
    faculty_bp,
    hod_bp,
)


def create_app(config_name=None):
    """Application factory.

    The factory keeps every extension bound to a single app instance, which
    makes the application straightforward to test and deploy.
    """
    if config_name is None:
        config_name = os.getenv("FLASK_ENV", "development")

    app = Flask(__name__)
    config_class = config_by_name.get(config_name, config_by_name["default"])
    app.config.from_object(config_class)
    app.json.sort_keys = False

    if not app.config.get("SQLALCHEMY_DATABASE_URI"):
        raise RuntimeError(
            "Database configuration is missing. Set DATABASE_URL, or set "
            "DB_USER, DB_PASSWORD, DB_HOST, DB_PORT and DB_NAME in .env."
        )

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    origins = app.config.get("CORS_ORIGINS", "*")
    if isinstance(origins, str) and "," in origins:
        origins = [o.strip() for o in origins.split(",") if o.strip()]
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": origins}},
        allow_headers=["Authorization", "Content-Type", "Accept"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    # Importing models registers all tables with SQLAlchemy metadata.
    from app import models  # noqa: F401
    from app.models.user import TokenBlocklist, User

    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        identity = jwt_data.get("sub")
        try:
            return db.session.get(User, int(identity))
        except (TypeError, ValueError):
            return None

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(_jwt_header, jwt_payload):
        """Reject revoked tokens and tokens belonging to inactive users."""
        jti = jwt_payload.get("jti")
        try:
            if jti and db.session.get(TokenBlocklist, jti):
                return True
            user = db.session.get(User, int(jwt_payload.get("sub")))
            return not user or not user.is_active
        except (TypeError, ValueError):
            return True
        except Exception:
            # During ``flask db upgrade`` no request token is involved.  If
            # the blocklist table is temporarily unavailable, fail closed.
            db.session.rollback()
            return True

    @jwt.unauthorized_loader
    def unauthorized_callback(_reason):
        return jsonify(
            {
                "success": False,
                "message": "Authentication required. Include a Bearer access token.",
            }
        ), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(_reason):
        return jsonify(
            {"success": False, "message": "Invalid access token."}
        ), 401

    @jwt.expired_token_loader
    def expired_token_callback(_jwt_header, _jwt_payload):
        return jsonify(
            {"success": False, "message": "Access token has expired. Please log in again."}
        ), 401

    @jwt.revoked_token_loader
    def revoked_token_callback(_jwt_header, _jwt_payload):
        return jsonify(
            {"success": False, "message": "Access token has been revoked. Please log in again."}
        ), 401

    @app.errorhandler(400)
    def bad_request(_error):
        return jsonify({"success": False, "message": "Bad request."}), 400

    @app.errorhandler(404)
    def not_found(_error):
        return jsonify({"success": False, "message": "Resource not found."}), 404

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return jsonify(
            {"success": False, "message": "HTTP method not allowed for this endpoint."}
        ), 405

    @app.errorhandler(413)
    def request_entity_too_large(_error):
        max_mb = app.config.get("MAX_CONTENT_LENGTH", 16 * 1024 * 1024) // (1024 * 1024)
        return jsonify(
            {"success": False, "message": f"File exceeds the maximum size of {max_mb} MB."}
        ), 413

    @app.errorhandler(415)
    def unsupported_media_type(_error):
        return jsonify(
            {
                "success": False,
                "message": "Unsupported media type. JSON or multipart/form-data is required.",
            }
        ), 415

    @app.errorhandler(IntegrityError)
    def handle_integrity_error(error):
        db.session.rollback()
        app.logger.warning("Database integrity error: %s", error)
        return jsonify(
            {
                "success": False,
                "message": "The request conflicts with existing or referenced data.",
            }
        ), 409

    @app.errorhandler(HTTPException)
    def handle_http_exception(error):
        return jsonify(
            {"success": False, "message": error.description or "HTTP error."}
        ), error.code

    @app.errorhandler(Exception)
    def handle_unexpected_exception(error):
        db.session.rollback()
        app.logger.exception("Unhandled application error on %s", request.path)
        return jsonify(
            {"success": False, "message": "An internal server error occurred."}
        ), 500

    @app.after_request
    def add_security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response

    # Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(faculty_bp)
    app.register_blueprint(activity_bp)
    app.register_blueprint(document_bp)
    app.register_blueprint(hod_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(calculation_bp)
    app.register_blueprint(compat_bp)

    @app.get("/")
    def root():
        return jsonify(
            {
                "success": True,
                "system": "Faculty Profile Builder with Automated API Calculation System",
                "version": "1.0.0",
                "status": "operational",
                "documentation": "/api/docs",
            }
        ), 200

    @app.get("/health")
    def health_check():
        try:
            db.session.execute(text("SELECT 1"))
            return jsonify({"status": "healthy", "database": "connected"}), 200
        except Exception:
            db.session.rollback()
            return jsonify({"status": "unhealthy", "database": "disconnected"}), 503

    @app.get("/api/docs")
    def api_documentation():
        """Small machine-readable endpoint catalogue.

        The complete hands-on documentation is in README.md.
        """
        endpoints = []
        for rule in sorted(app.url_map.iter_rules(), key=lambda item: item.rule):
            if rule.endpoint == "static" or rule.rule.startswith("/static"):
                continue
            methods = sorted(
                method for method in rule.methods if method not in {"HEAD", "OPTIONS"}
            )
            endpoints.append({"path": rule.rule, "methods": methods})
        return jsonify(
            {
                "success": True,
                "authentication": "JWT Bearer token in the Authorization header.",
                "endpoints": endpoints,
                "readme": "README.md",
            }
        ), 200

    @app.shell_context_processor
    def shell_context():
        from app import models as model_module

        context = {"db": db}
        for name in model_module.__all__:
            context[name] = getattr(model_module, name)
        return context

    return app
