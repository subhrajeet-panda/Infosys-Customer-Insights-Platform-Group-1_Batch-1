import io
import pandas as pd

def to_csv_bytes(df: pd.DataFrame) -> bytes:
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return buf.getvalue().encode("utf-8")

def to_excel_bytes(df: pd.DataFrame, sheet_name: str = "Report") -> bytes:
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name=sheet_name[:31])
        worksheet = writer.sheets[sheet_name[:31]]

        def safe_len(value) -> int:
            if value is None or (isinstance(value, float) and pd.isna(value)):
                return 3                            
            return len(str(value))

        for i, col in enumerate(df.columns):
            col_max = max((safe_len(v) for v in df[col]), default=0) if len(df) else 0
            max_len = max(col_max, len(str(col))) + 2
            worksheet.column_dimensions[chr(65 + i) if i < 26 else "A"].width = min(max_len, 40)
    return buf.getvalue()

def to_pdf_bytes(df: pd.DataFrame, title: str = "ShopSense Report") -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import landscape, A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.units import cm

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=1.5 * cm, rightMargin=1.5 * cm)
    styles = getSampleStyleSheet()

    elements = [Paragraph(title, styles["Title"]), Spacer(1, 12)]

    display_df = df.copy()
    if len(display_df.columns) > 10:
        display_df = display_df.iloc[:, :10]
    if len(display_df) > 200:
        display_df = display_df.iloc[:200]

    data = [list(display_df.columns)] + display_df.astype(str).values.tolist()
    table = Table(data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f1225")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 7),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f6fa")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(table)
    doc.build(elements)
    return buf.getvalue()

CONTENT_TYPES = {
    "csv": "text/csv",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}

def export_df(df: pd.DataFrame, fmt: str, title: str = "ShopSense Report") -> tuple[bytes, str]:
    if fmt == "csv":
        return to_csv_bytes(df), CONTENT_TYPES["csv"]
    if fmt == "xlsx":
        return to_excel_bytes(df, sheet_name=title[:31]), CONTENT_TYPES["xlsx"]
    if fmt == "pdf":
        return to_pdf_bytes(df, title=title), CONTENT_TYPES["pdf"]
    raise ValueError(f"Unsupported export format: {fmt}")
