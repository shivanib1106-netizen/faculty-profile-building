from app.routes.auth_routes import auth_bp
from app.routes.faculty_routes import faculty_bp
from app.routes.activity_routes import activity_bp
from app.routes.document_routes import document_bp
from app.routes.hod_routes import hod_bp
from app.routes.admin_routes import admin_bp
from app.routes.api_calculation_routes import calculation_bp
from app.routes.compat_routes import compat_bp

__all__ = [
    'auth_bp',
    'faculty_bp',
    'activity_bp',
    'document_bp',
    'hod_bp',
    'admin_bp',
    'calculation_bp',
    'compat_bp',
]
