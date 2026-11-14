from datetime import datetime, timezone

from app.extensions import db


class ActivityCategory(db.Model):
    __tablename__ = "activity_categories"

    id = db.Column(db.Integer, primary_key=True)
    category_code = db.Column(db.String(30), unique=True, nullable=False)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    max_score_limit = db.Column(db.Float, nullable=True)
    min_score_required = db.Column(db.Float, nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    scoring_rules = db.relationship(
        "APIScoringRule", back_populates="category", cascade="all, delete-orphan"
    )
    activities = db.relationship("AcademicActivity", back_populates="category")

    def to_dict(self):
        category_key = (
            "cat1"
            if "I" in self.category_code
            and "II" not in self.category_code
            and "III" not in self.category_code
            else (
                "cat2"
                if "II" in self.category_code and "III" not in self.category_code
                else ("cat3" if "III" in self.category_code else self.category_code.lower())
            )
        )
        return {
            "id": self.id,
            "category_code": self.category_code,
            "categoryKey": category_key,
            "key": category_key,
            "name": self.name,
            "description": self.description,
            "max_score_limit": self.max_score_limit,
            "maxScore": self.max_score_limit,
            "min_score_required": self.min_score_required,
            "minScore": self.min_score_required,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class APIScoringRule(db.Model):
    """An institution-configured, versioned scoring rule.

    The application ships with *sample* configuration points only.  Numeric
    values must be reviewed and replaced by the institution's approved API
    guidelines before official use.
    """

    __tablename__ = "api_scoring_rules"
    __table_args__ = (
        db.UniqueConstraint(
            "category_id",
            "activity_type",
            "rule_version",
            name="uq_rule_category_type_version",
        ),
        db.CheckConstraint("base_score >= 0", name="ck_rule_base_score"),
        db.CheckConstraint(
            "max_score_per_activity IS NULL OR max_score_per_activity >= 0",
            name="ck_rule_activity_cap",
        ),
        db.CheckConstraint(
            "scoring_unit IN ('fixed', 'per_unit', 'per_hour', 'per_paper', "
            "'per_book', 'per_chapter', 'per_patent', 'per_project')",
            name="ck_rule_scoring_unit",
        ),
    )

    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(
        db.Integer, db.ForeignKey("activity_categories.id"), nullable=False, index=True
    )
    activity_type = db.Column(db.String(100), nullable=False, index=True)
    rule_code = db.Column(db.String(50), unique=True, nullable=False, index=True)
    description = db.Column(db.Text, nullable=False)
    base_score = db.Column(db.Float, nullable=False)
    max_score_per_activity = db.Column(db.Float, nullable=True)
    scoring_unit = db.Column(db.String(50), nullable=False, default="fixed")
    # Optional institution-defined role multipliers, e.g.
    # {"sole author": 1.0, "first author": 0.7, "co-author": 0.3}.
    author_role_weights = db.Column(db.JSON, nullable=True)
    rule_version = db.Column(db.String(50), nullable=False, default="INSTITUTION-V1")
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

    category = db.relationship("ActivityCategory", back_populates="scoring_rules")

    def to_dict(self):
        return {
            "id": self.id,
            "category_id": self.category_id,
            "category_code": self.category.category_code if self.category else None,
            "category_name": self.category.name if self.category else None,
            "activity_type": self.activity_type,
            "rule_code": self.rule_code,
            "description": self.description,
            "base_score": self.base_score,
            "max_score_per_activity": self.max_score_per_activity,
            "scoring_unit": self.scoring_unit,
            "author_role_weights": self.author_role_weights,
            "rule_version": self.rule_version,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
