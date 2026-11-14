# Phase 8: Automated API Calculation Engine

## 1. Overview & Objectives
Phase 8 develops a modular, **pure deterministic Python scoring engine** for API (Academic Performance Indicator) score calculation.

### Architectural Constraint
> **No AI or Machine Learning**: The engine contains no neural networks, LLMs, or heuristic approximations. Every score is mathematically deterministic and computed strictly from administrator-configured, versioned rules.

---

## 2. Engine Architecture & Decoupling

The scoring logic is partitioned into two distinct layers:

1. **`DeterministicScoringEngine` (`app/services/scoring_engine.py`)**:
   - A pure Python module that has **zero imports** from Flask, SQLAlchemy, database connections, or HTTP requests.
   - Takes immutable domain objects (`RuleInput`, `CategoryInput`, `ActivityInput`) and produces an immutable `CalculationResult`.
   - Highly auditable and independently testable without database or web dependencies.
2. **`APICalculationEngine` (`app/services/api_calculation.py`)**:
   - The database-aware orchestrator.
   - Loads configured `APIScoringRule` records and `ActivityCategory` caps from MySQL.
   - Converts ORM objects to engine domain dataclasses.
   - Invokes `DeterministicScoringEngine`.
   - Persists snapshot records in `APICalculationHistory` and itemized rows in `APIScoreDetail`.

---

## 3. Mathematical Rules & Step-by-Step Scoring

For each academic activity:
1. **Raw Score Computation**:
   - If `scoring_unit == "fixed"`, `raw = base_score`.
   - Otherwise, `raw = base_score × duration_or_units`.
2. **Author Role Multipliers**:
   - If `co_author_role` is specified, the engine looks up the configured percentage in `author_role_weights` (e.g. `first author: 0.7`, `co-author: 0.3`).
   - `raw = raw × weight`.
3. **Per-Activity Cap**:
   - If the rule defines `max_score_per_activity`, `raw = min(raw, max_score_per_activity)`.
4. **Eligibility Check**:
   - In `VERIFIED_ONLY` mode (official calculation), an activity is only eligible if `status == "APPROVED"`.
   - In `ALL_ACTIVITIES` mode (provisional calculation), all non-rejected activities (`DRAFT`, `SUBMITTED`, `APPROVED`) are eligible.
   - Non-eligible activities receive `eligible_score = 0`.
5. **Category Cap & Proportional Scaling**:
   - The engine computes the category sum of eligible scores: $S_{cat} = \sum \text{eligible\_score}$.
   - If the category has a configured `max_score_limit` and $S_{cat} > \text{max\_score\_limit}$:
     - The category final score is capped at `max_score_limit`.
     - Each activity in that category is proportionally scaled:
       $$\text{final\_score} = \text{round}\left(\text{eligible\_score} \times \frac{\text{max\_score\_limit}}{S_{cat}}, 2\right)$$
       using Decimal `ROUND_HALF_UP` to prevent floating-point drift.
   - If $S_{cat} \le \text{max\_score\_limit}$, then $\text{final\_score} = \text{eligible\_score}$.
6. **Overall Totals**:
   - Total Raw Score = $\sum \text{cat\_raw}$
   - Total Eligible Score = $\sum \text{cat\_eligible}$
   - Total Final Score = $\sum \text{cat\_final}$

---

## 4. History Tracking & Version Snapshots

- **`rule_version` Traceability**:
  Every rule has a `rule_version` string (e.g. `INSTITUTION-2025-V1`). The calculation snapshot stores the distinct versions used. If a rule is later updated by an admin, existing official score records remain immutable.
- **Superseding Logic**:
  When a new official calculation is committed for an academic year, existing records for that year and faculty member are marked `status = "SUPERSEDED"` with `superseded_at` timestamped.

---

## 5. Endpoints Implemented

| Method | Endpoint | Allowed Roles | Description |
| :---: | :--- | :---: | :--- |
| `POST` | `/api/calculations/calculate` | Any authenticated | Compute and persist score (`academic_year_id`, `calculation_type`). Faculty can run own; HOD for department; Admin for any. |
| `GET` | `/api/calculations/summary` | Any authenticated | Live score calculation without persisting snapshot. |
| `GET` | `/api/calculations/category-scores` | Any authenticated | View category breakdown (Category I, II, III totals and caps). |
| `GET` | `/api/calculations/overall-score` | Any authenticated | View high-level overall API score. |
| `GET` | `/api/calculations/latest` | Any authenticated | Fetch most recent `OFFICIAL` score and details. |
| `GET` | `/api/calculations/history` | Any authenticated | View list of past calculations (filter by year, type, status). |
| `GET` | `/api/calculations/history/<id>` | Any authenticated | View single historical calculation record with per-activity breakdown. |
| `POST` | `/api/calculations/recalculate-all` | `admin` | Recalculate official scores for all faculty across an academic year. |
