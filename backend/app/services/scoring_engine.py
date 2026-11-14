"""Pure deterministic API scoring engine.

This module deliberately has no dependency on Flask, SQLAlchemy, sessions or
HTTP requests.  The caller supplies plain immutable inputs and receives plain
immutable results.  That separation makes the official calculation auditable
and unit-testable in isolation.

No scoring value is hard-coded here.  Every number comes from the supplied
``RuleInput`` objects (configured by an administrator) and the activity units.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from typing import Dict, Iterable, Mapping, Optional, Tuple

TWO_PLACES = Decimal("0.01")
SCORING_UNITS = {
    "fixed",
    "per_unit",
    "per_hour",
    "per_paper",
    "per_book",
    "per_chapter",
    "per_patent",
    "per_project",
}
VALID_STATUSES = {"DRAFT", "SUBMITTED", "APPROVED", "REJECTED"}
CALCULATION_TYPES = {"VERIFIED_ONLY", "ALL_ACTIVITIES"}


def _decimal(value, field_name="value") -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be numeric.") from exc


def quantize(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def normalize_role(value: Optional[str]) -> str:
    if not value:
        return ""
    return " ".join(str(value).strip().lower().replace("-", " ").replace("_", " ").split())


@dataclass(frozen=True)
class RuleInput:
    rule_code: str
    rule_version: str
    base_score: Decimal
    scoring_unit: str = "fixed"
    max_score_per_activity: Optional[Decimal] = None
    author_role_weights: Mapping[str, Decimal] = field(default_factory=dict)

    def __post_init__(self):
        if self.scoring_unit not in SCORING_UNITS:
            raise ValueError(f"Unsupported scoring unit: {self.scoring_unit}")
        if self.base_score < 0:
            raise ValueError("base_score cannot be negative.")

    @classmethod
    def from_mapping(cls, payload: Mapping) -> "RuleInput":
        weights = {
            normalize_role(key): _decimal(value, f"author weight for {key}")
            for key, value in (payload.get("author_role_weights") or {}).items()
        }
        cap = payload.get("max_score_per_activity")
        return cls(
            rule_code=str(payload["rule_code"]),
            rule_version=str(payload.get("rule_version") or "UNVERSIONED"),
            base_score=_decimal(payload["base_score"], "base_score"),
            scoring_unit=str(payload.get("scoring_unit") or "fixed"),
            max_score_per_activity=_decimal(cap, "max_score_per_activity")
            if cap is not None
            else None,
            author_role_weights=weights,
        )


@dataclass(frozen=True)
class CategoryInput:
    category_code: str
    name: str
    max_score_limit: Optional[Decimal] = None
    min_score_required: Optional[Decimal] = None


@dataclass(frozen=True)
class ActivityInput:
    activity_id: int
    category_code: str
    status: str
    duration_or_units: Decimal = Decimal("1")
    co_author_role: Optional[str] = None
    rule: Optional[RuleInput] = None

    def __post_init__(self):
        if self.status not in VALID_STATUSES:
            raise ValueError(f"Unsupported activity status: {self.status}")
        if self.duration_or_units <= 0:
            raise ValueError("duration_or_units must be greater than zero.")


@dataclass(frozen=True)
class ActivityScore:
    activity_id: int
    category_code: str
    status: str
    rule_code: Optional[str]
    rule_version: Optional[str]
    raw_score: Decimal
    eligible_score: Decimal
    final_score: Decimal
    category_limit_applied: Optional[Decimal]
    rule_missing: bool = False
    warnings: Tuple[str, ...] = ()


@dataclass(frozen=True)
class CategoryScore:
    category_code: str
    name: str
    raw_score: Decimal
    eligible_score: Decimal
    final_score: Decimal
    cap_applied: Optional[Decimal]
    min_score_required: Optional[Decimal]
    activity_count: int
    approved_count: int
    items: Tuple[ActivityScore, ...] = ()


@dataclass(frozen=True)
class CalculationResult:
    calculation_type: str
    categories: Tuple[CategoryScore, ...]
    total_raw_score: Decimal
    total_eligible_score: Decimal
    total_final_score: Decimal
    rule_versions: Tuple[str, ...]
    warnings: Tuple[str, ...] = ()
    activity_scores: Tuple[ActivityScore, ...] = ()

    def category(self, code: str) -> Optional[CategoryScore]:
        normalized = str(code).upper()
        for category in self.categories:
            if category.category_code.upper() == normalized:
                return category
        return None

    def category_at(self, index: int) -> Optional[CategoryScore]:
        return self.categories[index] if 0 <= index < len(self.categories) else None

    def to_dict(self) -> dict:
        def category_dict(category: Optional[CategoryScore]):
            if category is None:
                return {
                    "raw": 0.0,
                    "eligible": 0.0,
                    "final": 0.0,
                    "cap_applied": None,
                    "min_required": None,
                    "count": 0,
                    "approved_count": 0,
                }
            return {
                "raw": float(category.raw_score),
                "eligible": float(category.eligible_score),
                "final": float(category.final_score),
                "cap_applied": float(category.cap_applied)
                if category.cap_applied is not None
                else None,
                "min_required": float(category.min_score_required)
                if category.min_score_required is not None
                else None,
                "count": category.activity_count,
                "approved_count": category.approved_count,
            }

        c1 = self.category("CATEGORY_I") or self.category_at(0)
        c2 = self.category("CATEGORY_II") or self.category_at(1)
        c3 = self.category("CATEGORY_III") or self.category_at(2)

        return {
            "calculation_type": self.calculation_type,
            "rule_version": " | ".join(self.rule_versions) if self.rule_versions else "UNCONFIGURED",
            "rule_versions": list(self.rule_versions),
            "total_raw_score": float(self.total_raw_score),
            "total_eligible_score": float(self.total_eligible_score),
            "total_final_score": float(self.total_final_score),
            "categories": {
                "category_1": category_dict(c1),
                "category_2": category_dict(c2),
                "category_3": category_dict(c3),
            },
            "category_breakdown": [
                {
                    "category_code": category.category_code,
                    "name": category.name,
                    "raw": float(category.raw_score),
                    "eligible": float(category.eligible_score),
                    "final": float(category.final_score),
                    "cap_applied": float(category.cap_applied)
                    if category.cap_applied is not None
                    else None,
                    "min_required": float(category.min_score_required)
                    if category.min_score_required is not None
                    else None,
                    "activity_count": category.activity_count,
                    "approved_count": category.approved_count,
                }
                for category in self.categories
            ],
            "activities_breakdown": [
                {
                    "activity_id": score.activity_id,
                    "category_code": score.category_code,
                    "status": score.status,
                    "verification_status": score.status,
                    "rule_code": score.rule_code,
                    "rule_version": score.rule_version,
                    "raw_score": float(score.raw_score),
                    "eligible_score": float(score.eligible_score),
                    "final_score": float(score.final_score),
                    "category_limit_applied": float(score.category_limit_applied)
                    if score.category_limit_applied is not None
                    else None,
                    "rule_missing": score.rule_missing,
                    "warnings": list(score.warnings),
                }
                for score in self.activity_scores
            ],
            "warnings": list(self.warnings),
        }


class DeterministicScoringEngine:
    """Applies configured rules, activity caps and category caps in order."""

    @staticmethod
    def calculate_activity_raw_score(activity: ActivityInput) -> Tuple[Decimal, Optional[str]]:
        """Return (raw_score, warning)."""
        if activity.rule is None:
            return Decimal("0.00"), "No active scoring rule is configured for this activity type/category."
        rule = activity.rule

        units = activity.duration_or_units
        if rule.scoring_unit == "fixed":
            score = rule.base_score
        else:
            score = rule.base_score * units

        role = normalize_role(activity.co_author_role)
        warning = None
        if role and rule.author_role_weights:
            weights: Dict[str, Decimal] = dict(rule.author_role_weights)
            weight = weights.get(role)
            if weight is None and "default" in weights:
                weight = weights["default"]
            if weight is None:
                warning = (
                    f"No configured author-role weight for '{activity.co_author_role}'; "
                    "multiplier 1.0 was applied."
                )
            else:
                if weight < 0:
                    raise ValueError("Author-role weights cannot be negative.")
                score = score * weight

        if rule.max_score_per_activity is not None:
            score = min(score, rule.max_score_per_activity)

        if score < 0:
            score = Decimal("0")
        return quantize(score), warning

    @classmethod
    def calculate(
        cls,
        activities: Iterable[ActivityInput],
        categories: Iterable[CategoryInput],
        calculation_type: str = "VERIFIED_ONLY",
    ) -> CalculationResult:
        calculation_type = str(calculation_type).upper()
        if calculation_type not in CALCULATION_TYPES:
            raise ValueError(
                "calculation_type must be VERIFIED_ONLY or ALL_ACTIVITIES."
            )

        category_inputs = list(categories)
        category_order = {cat.category_code: index for index, cat in enumerate(category_inputs)}
        activity_inputs = list(activities)
        global_warnings = []
        versions = set()

        grouped: Dict[str, list] = {cat.category_code: [] for cat in category_inputs}
        for activity in activity_inputs:
            if activity.category_code not in grouped:
                global_warnings.append(
                    f"Activity {activity.activity_id} references unknown category "
                    f"{activity.category_code}; it was excluded."
                )
                continue
            grouped[activity.category_code].append(activity)
            if activity.rule is not None:
                versions.add(activity.rule.rule_version)

        category_scores = []
        all_activity_scores = []

        for category in category_inputs:
            items = grouped.get(category.category_code, [])
            raw_total = Decimal("0")
            eligible_total = Decimal("0")
            scored_items = []

            for activity in items:
                raw, warning = cls.calculate_activity_raw_score(activity)
                warnings = (warning,) if warning else ()
                if calculation_type == "VERIFIED_ONLY":
                    is_eligible = activity.status == "APPROVED"
                else:
                    is_eligible = activity.status != "REJECTED"
                eligible = raw if is_eligible else Decimal("0.00")
                raw_total += raw
                eligible_total += eligible

                scored_items.append(
                    {
                        "activity": activity,
                        "raw": raw,
                        "eligible": eligible,
                        "warnings": warnings,
                    }
                )

            raw_total = quantize(raw_total)
            eligible_total = quantize(eligible_total)
            cap = category.max_score_limit
            if cap is not None and cap >= 0 and eligible_total > cap:
                final_total = quantize(cap)
                cap_applied = quantize(cap)
            else:
                final_total = eligible_total
                cap_applied = None

            ratio = (
                final_total / eligible_total
                if eligible_total > 0 and final_total != eligible_total
                else Decimal("1")
            )

            final_items = []
            for item in scored_items:
                final_activity = quantize(item["eligible"] * ratio)
                activity_score = ActivityScore(
                    activity_id=item["activity"].activity_id,
                    category_code=category.category_code,
                    status=item["activity"].status,
                    rule_code=item["activity"].rule.rule_code
                    if item["activity"].rule
                    else None,
                    rule_version=item["activity"].rule.rule_version
                    if item["activity"].rule
                    else None,
                    raw_score=item["raw"],
                    eligible_score=item["eligible"],
                    final_score=final_activity,
                    category_limit_applied=cap_applied,
                    rule_missing=item["activity"].rule is None,
                    warnings=item["warnings"],
                )
                final_items.append(activity_score)
                all_activity_scores.append(activity_score)

            approved_count = sum(1 for item in scored_items if item["activity"].status == "APPROVED")
            category_scores.append(
                CategoryScore(
                    category_code=category.category_code,
                    name=category.name,
                    raw_score=raw_total,
                    eligible_score=eligible_total,
                    final_score=final_total,
                    cap_applied=cap_applied,
                    min_score_required=category.min_score_required,
                    activity_count=len(scored_items),
                    approved_count=approved_count,
                    items=tuple(final_items),
                )
            )

        category_scores.sort(
            key=lambda item: category_order.get(item.category_code, 999)
        )
        total_raw = quantize(sum((item.raw_score for item in category_scores), Decimal("0")))
        total_eligible = quantize(
            sum((item.eligible_score for item in category_scores), Decimal("0"))
        )
        total_final = quantize(
            sum((item.final_score for item in category_scores), Decimal("0"))
        )

        return CalculationResult(
            calculation_type=calculation_type,
            categories=tuple(category_scores),
            total_raw_score=total_raw,
            total_eligible_score=total_eligible,
            total_final_score=total_final,
            rule_versions=tuple(sorted(versions)),
            warnings=tuple(global_warnings),
            activity_scores=tuple(all_activity_scores),
        )
