import io
from datetime import datetime, timezone
from xml.sax.saxutils import escape

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.extensions import db
from app.models.academic_year import AcademicYear
from app.models.activity import AcademicActivity
from app.models.user import User
from app.services.api_calculation import APICalculationEngine


class ReportService:
    @staticmethod
    def _p(text, style, raw=False):
        """Escape user-controlled text unless the caller supplies safe markup."""
        value = str(text if text is not None else "")
        return Paragraph(value if raw else escape(value), style)

    @classmethod
    def generate_api_report_pdf(
        cls, faculty_id, academic_year_id, calculation_type="VERIFIED_ONLY"
    ):
        user = db.session.get(User, int(faculty_id))
        if not user:
            raise ValueError("Faculty user not found.")
        academic_year = db.session.get(AcademicYear, int(academic_year_id))
        if not academic_year:
            raise ValueError("Academic year not found.")

        calculation = APICalculationEngine.calculate_faculty_api(
            faculty_id=user.id,
            academic_year_id=academic_year.id,
            calculation_type=calculation_type,
            user_id=user.id,
            save_history=False,
        )
        profile = user.faculty_profile
        activities = AcademicActivity.query.filter_by(
            faculty_id=user.id, academic_year_id=academic_year.id
        ).all()
        activity_by_id = {activity.id: activity for activity in activities}

        records = []
        for score in calculation["activities_breakdown"]:
            activity = activity_by_id.get(score["activity_id"])
            records.append(
                {
                    "activity_id": score["activity_id"],
                    "category_code": score["category_code"],
                    "title": activity.title if activity else f"Activity {score['activity_id']}",
                    "activity_type": (activity.activity_type if activity else "").replace(
                        "_", " "
                    ).title(),
                    "date": activity.activity_date.isoformat()
                    if activity and activity.activity_date
                    else "-",
                    "units": activity.duration_or_units if activity else 0,
                    "status": score["verification_status"],
                    "remarks": activity.hod_remarks if activity and activity.hod_remarks else "",
                    "raw_score": score["raw_score"],
                    "eligible_score": score["eligible_score"],
                    "final_score": score["final_score"],
                    "category_limit": score["category_limit_applied"],
                    "rule_version": score["rule_version"] or "Unconfigured",
                }
            )
        frame = pd.DataFrame(records)

        buffer = io.BytesIO()
        document = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36,
            title=f"API Report - {user.display_name}",
            author="Faculty Profile Builder",
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "ReportTitle",
            parent=styles["Heading1"],
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#1A365D"),
            alignment=1,
            spaceAfter=4,
        )
        subtitle_style = ParagraphStyle(
            "ReportSubtitle",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#4A5568"),
            alignment=1,
            spaceAfter=14,
        )
        heading = ParagraphStyle(
            "SectionHeading",
            parent=styles["Heading2"],
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#2B6CB0"),
            spaceBefore=10,
            spaceAfter=6,
        )
        cell = ParagraphStyle(
            "Cell",
            parent=styles["Normal"],
            fontSize=7.5,
            leading=9.5,
            textColor=colors.HexColor("#2D3748"),
        )
        head_cell = ParagraphStyle(
            "HeadCell",
            parent=styles["Normal"],
            fontSize=7.5,
            leading=9.5,
            textColor=colors.white,
            fontName="Helvetica-Bold",
        )
        note = ParagraphStyle(
            "Note",
            parent=styles["Normal"],
            fontSize=7.5,
            leading=10,
            textColor=colors.HexColor("#4A5568"),
            spaceBefore=5,
            spaceAfter=5,
        )

        elements = []
        elements.append(Paragraph("FACULTY PROFILE & API PERFORMANCE REPORT", title_style))
        elements.append(
            Paragraph(
                f"Academic Year {escape(academic_year.year_label)} &bull; "
                f"{escape(calculation_type.replace('_', ' ').title())}",
                subtitle_style,
            )
        )

        dept = profile.department.name if profile and profile.department else "N/A"
        designation = profile.designation if profile else "N/A"
        employee_id = profile.employee_id if profile else "N/A"
        joining = (
            profile.date_of_joining.isoformat()
            if profile and profile.date_of_joining
            else "N/A"
        )
        report_date = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        profile_rows = [
            [
                cls._p("Faculty Name", cell),
                cls._p(user.display_name, cell),
                cls._p("Employee ID", cell),
                cls._p(employee_id, cell),
            ],
            [
                cls._p("Department", cell),
                cls._p(dept, cell),
                cls._p("Designation", cell),
                cls._p(designation, cell),
            ],
            [
                cls._p("Email", cell),
                cls._p(user.email, cell),
                cls._p("Date of Joining", cell),
                cls._p(joining, cell),
            ],
            [
                cls._p("Rule Version(s)", cell),
                cls._p(calculation.get("rule_version", "Unconfigured"), cell),
                cls._p("Report Generated", cell),
                cls._p(report_date, cell),
            ],
        ]
        profile_table = Table(profile_rows, colWidths=[80, 190, 90, 180])
        profile_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#EDF2F7")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E0")),
                    ("PADDING", (0, 0), (-1, -1), 5),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        elements.append(profile_table)
        elements.append(Spacer(1, 10))

        if calculation_type == "VERIFIED_ONLY":
            elements.append(
                Paragraph(
                    "<b>Official score:</b> only activities approved by the HOD are "
                    "eligible. Draft, submitted and rejected activities contribute zero.",
                    note,
                )
            )
        else:
            elements.append(
                Paragraph(
                    "<b>Provisional score:</b> this report includes unverified activities "
                    "and must not be treated as the official verified API score.",
                    note,
                )
            )

        elements.append(Paragraph("I. Category-wise API Score Summary", heading))
        category_rows = [
            [
                cls._p("Category", head_cell),
                cls._p("Activities", head_cell),
                cls._p("Approved", head_cell),
                cls._p("Raw", head_cell),
                cls._p("Eligible", head_cell),
                cls._p("Category Cap", head_cell),
                cls._p("Final", head_cell),
                cls._p("Minimum", head_cell),
            ]
        ]
        for category in calculation["category_breakdown"]:
            category_rows.append(
                [
                    cls._p(category["category_code"], cell),
                    cls._p(category["activity_count"], cell),
                    cls._p(category["approved_count"], cell),
                    cls._p(f"{category['raw']:.2f}", cell),
                    cls._p(f"{category['eligible']:.2f}", cell),
                    cls._p(
                        "-"
                        if category["cap_applied"] is None
                        else f"{category['cap_applied']:.2f}",
                        cell,
                    ),
                    cls._p(f"<b>{category['final']:.2f}</b>", cell, raw=True),
                    cls._p(
                        "-"
                        if category.get("min_required") is None
                        else f"{category['min_required']:.2f}",
                        cell,
                    ),
                ]
            )
        category_rows.append(
            [
                cls._p("<b>Overall</b>", cell, raw=True),
                cls._p(sum(c["activity_count"] for c in calculation["category_breakdown"]), cell),
                cls._p(sum(c["approved_count"] for c in calculation["category_breakdown"]), cell),
                cls._p(f"<b>{calculation['total_raw_score']:.2f}</b>", cell, raw=True),
                cls._p(f"<b>{calculation['total_eligible_score']:.2f}</b>", cell, raw=True),
                cls._p("-", cell),
                cls._p(f"<b>{calculation['total_final_score']:.2f}</b>", cell, raw=True),
                cls._p("-", cell),
            ]
        )
        category_table = Table(
            category_rows,
            colWidths=[65, 55, 55, 55, 60, 65, 60, 55],
            repeatRows=1,
        )
        category_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2B6CB0")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E0")),
                    ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#E2E8F0")),
                    ("PADDING", (0, 0), (-1, -1), 4),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        elements.append(category_table)
        elements.append(Spacer(1, 10))

        elements.append(Paragraph("II. Detailed Activity Breakdown", heading))
        category_titles = {
            "CATEGORY_I": "Category I: Teaching, Learning and Evaluation",
            "CATEGORY_II": "Category II: Co-curricular, Extension and Professional Development",
            "CATEGORY_III": "Category III: Research and Academic Contributions",
        }
        for category_code, category_title in category_titles.items():
            elements.append(
                Paragraph(
                    f"<b>{escape(category_title)}</b>",
                    ParagraphStyle(
                        "SubCat",
                        parent=styles["Normal"],
                        fontSize=8.5,
                        leading=11,
                        textColor=colors.HexColor("#2C5282"),
                        spaceBefore=6,
                        spaceAfter=3,
                    ),
                )
            )
            subset = (
                frame[frame["category_code"] == category_code]
                if not frame.empty
                else pd.DataFrame()
            )
            if subset.empty:
                elements.append(
                    Paragraph(
                        "<i>No activities recorded in this category for this academic year.</i>",
                        note,
                    )
                )
                continue

            rows = [
                [
                    cls._p("Title", head_cell),
                    cls._p("Type", head_cell),
                    cls._p("Date", head_cell),
                    cls._p("Units", head_cell),
                    cls._p("Status", head_cell),
                    cls._p("Raw", head_cell),
                    cls._p("Eligible", head_cell),
                    cls._p("Final", head_cell),
                ]
            ]
            for _, row in subset.iterrows():
                status_color = {
                    "APPROVED": "#276749",
                    "REJECTED": "#9B2C2C",
                    "SUBMITTED": "#B7791F",
                    "DRAFT": "#4A5568",
                }.get(row["status"], "#4A5568")
                title_markup = escape(str(row["title"])[:80])
                if row.get("remarks"):
                    title_markup += f"<br/><font color='#718096' size='6.5'>HOD Remarks: {escape(str(row['remarks']))}</font>"
                rows.append(
                    [
                        cls._p(title_markup, cell, raw=True),
                        cls._p(str(row["activity_type"])[:32], cell),
                        cls._p(row["date"], cell),
                        cls._p(row["units"], cell),
                        cls._p(
                            f"<font color='{status_color}'><b>{escape(str(row['status']))}</b></font>",
                            cell,
                            raw=True,
                        ),
                        cls._p(f"{row['raw_score']:.2f}", cell),
                        cls._p(f"{row['eligible_score']:.2f}", cell),
                        cls._p(f"<b>{row['final_score']:.2f}</b>", cell, raw=True),
                    ]
                )
            detail_table = Table(
                rows,
                colWidths=[175, 100, 55, 35, 60, 40, 40, 35],
                repeatRows=1,
            )
            detail_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4A5568")),
                        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E2E8F0")),
                        ("PADDING", (0, 0), (-1, -1), 3),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ]
                )
            )
            elements.append(detail_table)
            elements.append(Spacer(1, 4))

        warnings = calculation.get("warnings") or []
        if warnings:
            elements.append(Paragraph("III. Calculation Notes", heading))
            for warning in warnings:
                elements.append(Paragraph(f"&bull; {escape(warning)}", note))

        elements.append(Spacer(1, 14))
        signature_data = [
            [
                cls._p("__________________________<br/><b>Faculty Signature</b>", cell, raw=True),
                cls._p("__________________________<br/><b>Head of Department</b>", cell, raw=True),
                cls._p("__________________________<br/><b>Principal / Director</b>", cell, raw=True),
            ]
        ]
        signature_table = Table(signature_data, colWidths=[180, 180, 180])
        signature_table.setStyle(
            TableStyle(
                [
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        elements.append(KeepTogether(signature_table))

        document.build(elements)
        buffer.seek(0)
        return buffer
