"""Database orchestration around the pure scoring engine.

The mathematically meaningful work happens in :mod:`app.services.scoring_engine`.
This module only loads configured rules, converts ORM objects to immutable
domain inputs, persists calculation snapshots and returns a JSON-ready result.
"""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.extensions import db
from app.models.academic_year import AcademicYear
from app.models.activity import AcademicActivity
from app.models.api_score import APICalculationHistory, APIScoreDetail
from app.models.scoring_rule import ActivityCategory, APIScoringRule
from app.models.user import User
from app.services.scoring_engine import (
    ActivityInput,
    CalculationResult,
    CategoryInput,
    DeterministicScoringEngine,
    RuleInput,
    quantize,
)


class APICalculationEngine:
    """Facade used by routes, approval workflow and report generation."""

    @staticmethod
    def _rule_domain(rule: APIScoringRule) -> RuleInput:
        return RuleInput.from_mapping(
            {
                "rule_code": rule.rule_code,
                "rule_version": rule.rule_version,
                "base_score": rule.base_score,
                "scoring_unit": rule.scoring_unit,
                "max_score_per_activity": rule.max_score_per_activity,
                "author_role_weights": rule.author_role_weights or {},
            }
        )

    @classmethod
    def calculate_activity_raw_score(cls, activity, rule):
        """Compatibility helper for previewing a single activity score."""
        category_code = activity.category.category_code if activity.category else "UNKNOWN"
        domain_activity = ActivityInput(
            activity_id=activity.id or 0,
            category_code=category_code,
            status=activity.status or "DRAFT",
            duration_or_units=Decimal(str(activity.duration_or_units or 1)),
            co_author_role=activity.co_author_role,
            rule=cls._rule_domain(rule) if rule else None,
        )
        score, _warning = DeterministicScoringEngine.calculate_activity_raw_score(
            domain_activity
        )
        return float(score)

    @classmethod
    def _active_rule_index(cls):
        """Return (rule map, duplicate warnings).

        Multiple active versions for one category/type are a configuration
        smell.  The most recently updated rule wins deterministically.
        """
        rules = (
            APIScoringRule.query.filter_by(is_active=True)
            .order_by(APIScoringRule.updated_at.asc(), APIScoringRule.id.asc())
            .all()
        )
        index = {}
        warnings = []
        for rule in rules:
            key = (rule.category_id, rule.activity_type)
            if key in index:
                previous = index[key]
                warnings.append(
                    f"Multiple active rules exist for category {rule.category_id}, "
                    f"activity type {rule.activity_type}; rule {previous.rule_code} "
                    f"was replaced by {rule.rule_code}."
                )
            index[key] = rule
        return index, warnings

    @classmethod
    def calculate_faculty_api(
        cls,
        faculty_id,
        academic_year_id,
        calculation_type="VERIFIED_ONLY",
        user_id=None,
        save_history=True,
    ):
        calculation_type = str(calculation_type).upper()
        if calculation_type not in {"VERIFIED_ONLY", "ALL_ACTIVITIES"}:
            raise ValueError(
                "calculation_type must be VERIFIED_ONLY or ALL_ACTIVITIES."
            )

        faculty = db.session.get(User, int(faculty_id))
        if not faculty:
            raise ValueError("Faculty user not found.")
        academic_year = db.session.get(AcademicYear, int(academic_year_id))
        if not academic_year:
            raise ValueError("Academic year not found.")

        categories = ActivityCategory.query.order_by(ActivityCategory.category_code.asc()).all()
        category_inputs = [
            CategoryInput(
                category_code=category.category_code,
                name=category.name,
                max_score_limit=Decimal(str(category.max_score_limit))
                if category.max_score_limit is not None
                else None,
                min_score_required=Decimal(str(category.min_score_required))
                if category.min_score_required is not None
                else None,
            )
            for category in categories
        ]

        rule_index, config_warnings = cls._active_rule_index()
        activities = (
            AcademicActivity.query.filter_by(
                faculty_id=faculty.id,
                academic_year_id=academic_year.id,
            )
            .order_by(AcademicActivity.activity_date.asc(), AcademicActivity.id.asc())
            .all()
        )

        domain_activities = []
        for activity in activities:
            rule = rule_index.get((activity.category_id, activity.activity_type))
            domain_activities.append(
                ActivityInput(
                    activity_id=activity.id,
                    category_code=activity.category.category_code
                    if activity.category
                    else "UNKNOWN",
                    status=activity.status,
                    duration_or_units=Decimal(str(activity.duration_or_units or 1)),
                    co_author_role=activity.co_author_role,
                    rule=cls._rule_domain(rule) if rule else None,
                )
            )

        result = DeterministicScoringEngine.calculate(
            activities=domain_activities,
            categories=category_inputs,
            calculation_type=calculation_type,
        )
        if config_warnings:
            result = CalculationResult(
                calculation_type=result.calculation_type,
                categories=result.categories,
                total_raw_score=result.total_raw_score,
                total_eligible_score=result.total_eligible_score,
                total_final_score=result.total_final_score,
                rule_versions=result.rule_versions,
                warnings=tuple(config_warnings) + result.warnings,
                activity_scores=result.activity_scores,
            )

        history_record = None
        if save_history:
            history_record = cls._persist_calculation(
                result=result,
                faculty=faculty,
                academic_year=academic_year,
                calculation_type=calculation_type,
                user_id=user_id,
                activities=activities,
            )

        payload = result.to_dict()
        payload.update(
            {
                "calculation_history_id": history_record.id if history_record else None,
                "faculty_id": faculty.id,
                "faculty_name": faculty.display_name,
                "academic_year_id": academic_year.id,
                "academic_year": academic_year.year_label,
                "calculation_type": calculation_type,
                "rule_version": " | ".join(result.rule_versions)
                if result.rule_versions
                else "UNCONFIGURED",
                "rule_versions": list(result.rule_versions),
                "persisted": bool(history_record),
                "calculation_date": datetime.now(timezone.utc).isoformat(),
            }
        )
        return payload

    @classmethod
    def _persist_calculation(
        cls,
        result,
        faculty,
        academic_year,
        calculation_type,
        user_id,
        activities,
    ):
        try:
            now = datetime.now(timezone.utc)
            new_status = "OFFICIAL" if calculation_type == "VERIFIED_ONLY" else "PROVISIONAL"

            if new_status == "OFFICIAL":
                previous = APICalculationHistory.query.filter_by(
                    faculty_id=faculty.id,
                    academic_year_id=academic_year.id,
                    status="OFFICIAL",
                ).all()
                for old_record in previous:
                    old_record.status = "SUPERSEDED"
                    old_record.superseded_at = now

            scores_by_activity = {
                item.activity_id: item for item in result.activity_scores
            }

            # Update the current activity snapshots.  DRAFT/SUBMITTED items can
            # still have a raw score, but their eligible/final values are zero
            # in an official (VERIFIED_ONLY) calculation.
            for activity in activities:
                item = scores_by_activity.get(activity.id)
                if item is None:
                    activity.raw_score = 0.0
                    activity.eligible_score = 0.0
                    activity.final_score = 0.0
                    activity.category_limit_applied = None
                else:
                    activity.raw_score = float(item.raw_score)
                    activity.eligible_score = float(item.eligible_score)
                    activity.final_score = float(item.final_score)
                    activity.category_limit_applied = (
                        float(item.category_limit_applied)
                        if item.category_limit_applied is not None
                        else None
                    )
                activity.score_updated_at = now

            category_by_code = {
                category.category_code.upper(): category for category in result.categories
            }
            cat1 = category_by_code.get("CATEGORY_I")
            cat2 = category_by_code.get("CATEGORY_II")
            cat3 = category_by_code.get("CATEGORY_III")

            history = APICalculationHistory(
                faculty_id=faculty.id,
                academic_year_id=academic_year.id,
                rule_version=" | ".join(result.rule_versions)
                if result.rule_versions
                else "UNCONFIGURED",
                cat1_raw_score=float(cat1.raw_score) if cat1 else 0.0,
                cat1_eligible_score=float(cat1.eligible_score) if cat1 else 0.0,
                cat1_final_score=float(cat1.final_score) if cat1 else 0.0,
                cat1_cap_applied=float(cat1.cap_applied)
                if cat1 and cat1.cap_applied is not None
                else None,
                cat2_raw_score=float(cat2.raw_score) if cat2 else 0.0,
                cat2_eligible_score=float(cat2.eligible_score) if cat2 else 0.0,
                cat2_final_score=float(cat2.final_score) if cat2 else 0.0,
                cat2_cap_applied=float(cat2.cap_applied)
                if cat2 and cat2.cap_applied is not None
                else None,
                cat3_raw_score=float(cat3.raw_score) if cat3 else 0.0,
                cat3_eligible_score=float(cat3.eligible_score) if cat3 else 0.0,
                cat3_final_score=float(cat3.final_score) if cat3 else 0.0,
                cat3_cap_applied=float(cat3.cap_applied)
                if cat3 and cat3.cap_applied is not None
                else None,
                total_raw_score=float(result.total_raw_score),
                total_eligible_score=float(result.total_eligible_score),
                total_final_score=float(result.total_final_score),
                calculated_by_user_id=user_id or faculty.id,
                calculation_type=calculation_type,
                status=new_status,
                calculation_date=now,
            )
            db.session.add(history)
            db.session.flush()

            for item in result.activity_scores:
                db.session.add(
                    APIScoreDetail(
                        calculation_history_id=history.id,
                        activity_id=item.activity_id,
                        raw_score=float(item.raw_score),
                        eligible_score=float(item.eligible_score),
                        final_score=float(item.final_score),
                        category_limit_applied=float(item.category_limit_applied)
                        if item.category_limit_applied is not None
                        else None,
                        verification_status=item.status,
                        rule_code=item.rule_code,
                        rule_version=item.rule_version,
                    )
                )

            db.session.commit()
            return history
        except Exception:
            db.session.rollback()
            raise

    @classmethod
    def recalculate_academic_year(cls, academic_year_id, user_id=None):
        faculty_ids = [
            row[0]
            for row in db.session.query(AcademicActivity.faculty_id)
            .filter_by(academic_year_id=academic_year_id)
            .distinct()
            .all()
        ]
        results = []
        for faculty_id in faculty_ids:
            result = cls.calculate_faculty_api(
                faculty_id=faculty_id,
                academic_year_id=academic_year_id,
                calculation_type="VERIFIED_ONLY",
                user_id=user_id,
                save_history=True,
            )
            results.append(
                {
                    "faculty_id": faculty_id,
                    "faculty_name": result["faculty_name"],
                    "total_final_score": result["total_final_score"],
                    "history_id": result["calculation_history_id"],
                }
            )
        return results

    @staticmethod
    def get_latest_official(faculty_id, academic_year_id):
        return (
            APICalculationHistory.query.filter_by(
                faculty_id=int(faculty_id),
                academic_year_id=int(academic_year_id),
                status="OFFICIAL",
            )
            .order_by(APICalculationHistory.calculation_date.desc())
            .first()
        )
