"""Application configuration.

Database credentials and secrets are read from environment variables.  The
application intentionally targets MySQL for normal operation.  The test suite
overrides the URI with an in-memory SQLite database so tests do not depend on a
live MySQL server.
"""
import os
from datetime import timedelta
from urllib.parse import quote_plus

from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
load_dotenv(os.path.join(basedir, ".env"))


def _env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _mysql_uri():
    """Build a SQLAlchemy MySQL URI from individual DB_* variables."""
    user = os.getenv("DB_USER")
    name = os.getenv("DB_NAME")
    if not user or not name:
        return None
    password = os.getenv("DB_PASSWORD", "")
    host = os.getenv("DB_HOST", "127.0.0.1")
    port = os.getenv("DB_PORT", "3306")
    return (
        f"mysql+pymysql://{quote_plus(user)}:{quote_plus(password)}"
        f"@{host}:{port}/{name}?charset=utf8mb4"
    )


def _database_uri():
    explicit = os.getenv("DATABASE_URL")
    if explicit:
        return explicit
    return _mysql_uri()


class Config:
    """Base configuration shared by all environments."""

    SECRET_KEY = os.getenv("SECRET_KEY", "change-this-development-secret-key")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-development-jwt-secret-key")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        seconds=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES", "86400"))
    )
    JWT_ERROR_MESSAGE_KEY = "message"
    JWT_BLOCKLIST_ENABLED = True

    SQLALCHEMY_DATABASE_URI = _database_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 280,
    }

    # File upload settings
    UPLOAD_FOLDER = os.path.abspath(
        os.getenv("UPLOAD_FOLDER", os.path.join(basedir, "uploads"))
    )
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", str(16 * 1024 * 1024)))
    ALLOWED_EXTENSIONS = {
        item.strip().lower()
        for item in os.getenv("ALLOWED_EXTENSIONS", "pdf,png,jpg,jpeg,doc,docx").split(",")
        if item.strip()
    }
    ALLOWED_DOCUMENT_TYPES = {
        "general",
        "certificate",
        "publication_proof",
        "appointment_order",
        "experience_certificate",
        "workshop_certificate",
        "conference_certificate",
        "research_project_document",
        "other",
    }

    # CORS: comma separated origins.  "*" is convenient for local development.
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "*").split(",")
        if origin.strip()
    ]

    PASSWORD_MIN_LENGTH = int(os.getenv("PASSWORD_MIN_LENGTH", "8"))
    REQUIRE_ACTIVITY_DOCUMENT_FOR_SUBMISSION = _env_bool(
        "REQUIRE_ACTIVITY_DOCUMENT_FOR_SUBMISSION", False
    )


class DevelopmentConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    TESTING = True
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}
    UPLOAD_FOLDER = os.path.join(basedir, "tests", "test_uploads")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=3600)
    REQUIRE_ACTIVITY_DOCUMENT_FOR_SUBMISSION = False


class ProductionConfig(Config):
    DEBUG = False
    TESTING = False


config_by_name = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}
