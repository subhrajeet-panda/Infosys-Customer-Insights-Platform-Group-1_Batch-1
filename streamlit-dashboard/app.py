import datetime
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from core.db import fetch_df, test_connection

st.set_page_config(
    page_title="ShopSense Executive BI Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    html, body, [class*="css"] { font-family: 'Inter', sans-serif; }

    /* Main container background */
    .main { background-color: #f8fafc; }

    /* Dashboard card container */
    .dashboard-card {
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 1.25rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        margin-bottom: 1rem;
    }
</style>
""", unsafe_allow_html=True)

def fmt_inr(val: float) -> str:
    val = float(val or 0)
    if val >= 1_00_00_000:
        return f"₹{val / 1_00_00_000:.2f} Cr"
    if val >= 1_00_000:
        return f"₹{val / 1_00_000:.2f} L"
    if val >= 1_000:
        return f"₹{val / 1_000:.1f} K"
    return f"₹{val:,.2f}"

def fmt_num(val: float) -> str:
    val = float(val or 0)
    if val >= 1_000_000:
        return f"{val / 1_000_000:.1f}M"
    if val >= 1_000:
        return f"{val / 1_000:.1f}K"
    return f"{int(val):,}"

def render_kpi_card(title: str, value: str, subtitle: str = None, accent_color: str = "#6366f1"):
                                                                                    
    st.markdown(f"""
    <div style="
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-top: 4px solid {accent_color};
        border-radius: 12px;
        padding: 1.1rem 1.25rem;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
        margin-bottom: 0.5rem;
    ">
        <div style="color: #475569; font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.3rem;">
            {title}
        </div>
        <div style="color: #0f172a; font-size: 1.75rem; font-weight: 800; line-height: 1.2;">
            {value}
        </div>
        {f'<div style="color: #64748b; font-size: 0.78rem; margin-top: 0.35rem;">{subtitle}</div>' if subtitle else ''}
    </div>
    """, unsafe_allow_html=True)

COLOR_PALETTE = ["#6366f1", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#f97316"]
CHART_LAYOUT = dict(
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    font=dict(family="Inter, sans-serif", size=12, color="#334155"),
    margin=dict(l=20, r=20, t=40, b=20),
)

with st.sidebar:
    st.image("https://cdn-icons-png.flaticon.com/512/3135/3135715.png", width=48)
    st.title("ShopSense BI")
    st.caption("Executive Dashboard & Real-Time Analytics")
    st.divider()

    db_ok, db_msg = test_connection()
    if db_ok:
        st.success(f"🟢 Database Connected\n\n`{db_msg}`")
    else:
        st.error(f"🔴 DB Disconnected\n\n`{db_msg}`")
        st.stop()

    st.divider()
    st.subheader("⚙️ Global Filters")

    time_preset = st.selectbox(
        "📅 Time Horizon",
        ["Last 30 Days", "Last 90 Days", "Last 180 Days", "All Time"]
    )

    today = datetime.date.today()
    if time_preset == "Last 30 Days":
        start_date = today - datetime.timedelta(days=30)
    elif time_preset == "Last 90 Days":
        start_date = today - datetime.timedelta(days=90)
    elif time_preset == "Last 180 Days":
        start_date = today - datetime.timedelta(days=180)
    else:
        start_date = datetime.date(2020, 1, 1)
    end_date = today

    try:
        cats_df = fetch_df("SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY 1")
        all_categories = ["All Categories"] + (cats_df["category"].tolist() if not cats_df.empty else [])
    except Exception:
        all_categories = ["All Categories"]

    selected_category = st.selectbox("🏷️ Product Category", all_categories)

    st.divider()
    st.caption("ShopSense Executive BI v2.5")

st.markdown("# 📊 Executive Business Intelligence Dashboard")
st.markdown("Real-time aggregated sales insights, category revenue share, product rankings, and vendor performance.")
st.divider()

params = {"start": start_date, "end": end_date}

try:
    if selected_category == "All Categories":
        kpi_sql = """
        SELECT
            COALESCE(SUM(total_amount), 0)            AS total_gmv,
            COALESCE(SUM(commission_amount), 0)       AS total_commission,
            COUNT(DISTINCT id)                        AS total_orders,
            COUNT(DISTINCT customer_id)               AS unique_customers,
            COUNT(DISTINCT vendor_id)                 AS total_vendors,
            COALESCE(ROUND(AVG(total_amount)::NUMERIC, 2), 0) AS avg_order_value
        FROM orders
        WHERE status != 'cancelled'
          AND created_at BETWEEN %(start)s AND %(end)s;
        """
        kpi_data = fetch_df(kpi_sql, params).iloc[0]
    else:
        kpi_sql = """
        SELECT
            COALESCE(SUM(o.total_amount), 0)            AS total_gmv,
            COALESCE(SUM(o.commission_amount), 0)       AS total_commission,
            COUNT(DISTINCT o.id)                        AS total_orders,
            COUNT(DISTINCT o.customer_id)               AS unique_customers,
            COUNT(DISTINCT o.vendor_id)                 AS total_vendors,
            COALESCE(ROUND(AVG(o.total_amount)::NUMERIC, 2), 0) AS avg_order_value
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.status != 'cancelled'
          AND o.created_at BETWEEN %(start)s AND %(end)s
          AND oi.category = %(cat)s;
        """
        kpi_data = fetch_df(kpi_sql, {**params, "cat": selected_category}).iloc[0]
except Exception:
    kpi_data = {"total_gmv": 0, "total_commission": 0, "total_orders": 0, "unique_customers": 0, "total_vendors": 0, "avg_order_value": 0}

try:
    if selected_category == "All Categories":
        trend_sql = """
        SELECT
            DATE_TRUNC('day', created_at)              AS day,
            SUM(total_amount)                          AS gmv,
            SUM(commission_amount)                     AS commission,
            COUNT(DISTINCT id)                         AS orders
        FROM orders
        WHERE status != 'cancelled'
          AND created_at BETWEEN %(start)s AND %(end)s
        GROUP BY 1
        ORDER BY 1;
        """
        trend_df = fetch_df(trend_sql, params)
    else:
        trend_sql = """
        SELECT
            DATE_TRUNC('day', o.created_at)              AS day,
            SUM(o.total_amount)                          AS gmv,
            SUM(o.commission_amount)                     AS commission,
            COUNT(DISTINCT o.id)                         AS orders
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.status != 'cancelled'
          AND o.created_at BETWEEN %(start)s AND %(end)s
          AND oi.category = %(cat)s
        GROUP BY 1
        ORDER BY 1;
        """
        trend_df = fetch_df(trend_sql, {**params, "cat": selected_category})
except Exception:
    trend_df = pd.DataFrame()

try:
    if selected_category == "All Categories":
        cat_dist_sql = """
        SELECT
            COALESCE(oi.category, 'Uncategorized') AS category,
            SUM(oi.subtotal)                       AS revenue,
            SUM(oi.quantity)                       AS units_sold,
            COUNT(DISTINCT o.id)                   AS order_count
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status != 'cancelled'
          AND o.created_at BETWEEN %(start)s AND %(end)s
        GROUP BY 1
        ORDER BY revenue DESC;
        """
        cat_dist_df = fetch_df(cat_dist_sql, params)
    else:
        cat_dist_sql = """
        SELECT
            COALESCE(oi.category, 'Uncategorized') AS category,
            SUM(oi.subtotal)                       AS revenue,
            SUM(oi.quantity)                       AS units_sold,
            COUNT(DISTINCT o.id)                   AS order_count
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status != 'cancelled'
          AND o.created_at BETWEEN %(start)s AND %(end)s
          AND oi.category = %(cat)s
        GROUP BY 1
        ORDER BY revenue DESC;
        """
        cat_dist_df = fetch_df(cat_dist_sql, {**params, "cat": selected_category})
except Exception:
    cat_dist_df = pd.DataFrame()

try:
    if selected_category == "All Categories":
        top_prod_sql = """
        SELECT
            oi.product_name,
            COALESCE(oi.category, 'General')       AS category,
            SUM(oi.subtotal)                       AS revenue,
            SUM(oi.quantity)                       AS units_sold,
            COUNT(DISTINCT o.id)                   AS order_count
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status != 'cancelled'
          AND o.created_at BETWEEN %(start)s AND %(end)s
        GROUP BY 1, 2
        ORDER BY revenue DESC
        LIMIT 10;
        """
        top_prod_df = fetch_df(top_prod_sql, params)
    else:
        top_prod_sql = """
        SELECT
            oi.product_name,
            COALESCE(oi.category, 'General')       AS category,
            SUM(oi.subtotal)                       AS revenue,
            SUM(oi.quantity)                       AS units_sold,
            COUNT(DISTINCT o.id)                   AS order_count
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE o.status != 'cancelled'
          AND o.created_at BETWEEN %(start)s AND %(end)s
          AND oi.category = %(cat)s
        GROUP BY 1, 2
        ORDER BY revenue DESC
        LIMIT 10;
        """
        top_prod_df = fetch_df(top_prod_sql, {**params, "cat": selected_category})
except Exception:
    top_prod_df = pd.DataFrame()

try:
    top_vendor_sql = """
    SELECT
        v.business_name,
        COUNT(DISTINCT o.id)              AS orders,
        SUM(o.total_amount)               AS total_gmv,
        SUM(o.commission_amount)          AS commission_paid
    FROM orders o
    JOIN vendors v ON v.id = o.vendor_id
    WHERE o.status != 'cancelled'
      AND o.created_at BETWEEN %(start)s AND %(end)s
    GROUP BY 1
    ORDER BY total_gmv DESC
    LIMIT 8;
    """
    top_vendor_df = fetch_df(top_vendor_sql, params)
except Exception:
    top_vendor_df = pd.DataFrame()

try:
    if selected_category == "All Categories":
        recent_orders_sql = """
        SELECT
            o.id                               AS order_id,
            o.created_at::TIMESTAMP(0)         AS date,
            COALESCE(u.name, 'Customer')       AS customer,
            COALESCE(v.business_name, 'Vendor') AS vendor,
            o.total_amount                     AS amount,
            o.commission_amount                AS commission
        FROM orders o
        LEFT JOIN users u ON u.id = o.customer_id
        LEFT JOIN vendors v ON v.id = o.vendor_id
        WHERE o.created_at BETWEEN %(start)s AND %(end)s
        ORDER BY o.created_at DESC
        LIMIT 50;
        """
        recent_orders_df = fetch_df(recent_orders_sql, params)
    else:
        recent_orders_sql = """
        SELECT
            o.id                               AS order_id,
            o.created_at::TIMESTAMP(0)         AS date,
            COALESCE(u.name, 'Customer')       AS customer,
            COALESCE(v.business_name, 'Vendor') AS vendor,
            o.total_amount                     AS amount,
            o.commission_amount                AS commission
        FROM orders o
        LEFT JOIN users u ON u.id = o.customer_id
        LEFT JOIN vendors v ON v.id = o.vendor_id
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.created_at BETWEEN %(start)s AND %(end)s
          AND oi.category = %(cat)s
        GROUP BY o.id, o.created_at, u.name, v.business_name, o.total_amount, o.commission_amount
        ORDER BY o.created_at DESC
        LIMIT 50;
        """
        recent_orders_df = fetch_df(recent_orders_sql, {**params, "cat": selected_category})
except Exception:
    recent_orders_df = pd.DataFrame()

c1, c2, c3, c4, c5, c6 = st.columns(6)

with c1:
    render_kpi_card("💰 Gross Revenue (GMV)", fmt_inr(kpi_data["total_gmv"]), "Total Completed Sales", "#6366f1")
with c2:
    render_kpi_card("🏦 Platform Commission", fmt_inr(kpi_data["total_commission"]), "ShopSense Net Share", "#10b981")
with c3:
    render_kpi_card("📦 Total Orders", fmt_num(kpi_data["total_orders"]), "Completed Order Count", "#8b5cf6")
with c4:
    render_kpi_card("👥 Active Customers", fmt_num(kpi_data["unique_customers"]), "Unique Buyers", "#06b6d4")
with c5:
    render_kpi_card("🏪 Total Vendors", fmt_num(kpi_data["total_vendors"]), "Active Merchants", "#ec4899")
with c6:
    render_kpi_card("🛒 Avg Order Value", fmt_inr(kpi_data["avg_order_value"]), "Per-Order Revenue", "#f59e0b")

st.markdown("<br>", unsafe_allow_html=True)

row2_col1, row2_col2 = st.columns([2, 1])

with row2_col1:
    st.markdown("### 📈 Revenue & Order Volume Trend")
    if not trend_df.empty:
        trend_df["day_str"] = pd.to_datetime(trend_df["day"]).dt.strftime("%d %b %Y")

        fig_line = go.Figure()
        fig_line.add_trace(go.Scatter(
            x=trend_df["day_str"], y=trend_df["gmv"],
            mode="lines+markers", name="GMV (₹)",
            line=dict(color="#6366f1", width=3),
            hovertemplate="Date: %{x}<br>GMV: ₹%{y:,.2f}<extra></extra>"
        ))
        fig_line.add_trace(go.Scatter(
            x=trend_df["day_str"], y=trend_df["commission"],
            mode="lines", name="Commission (₹)",
            line=dict(color="#10b981", width=2, dash="dash"),
            hovertemplate="Date: %{x}<br>Commission: ₹%{y:,.2f}<extra></extra>"
        ))
        fig_line.update_layout(
            title="Daily Revenue vs Platform Commission",
            xaxis=dict(showgrid=False),
            yaxis=dict(gridcolor="#f1f5f9", title="Amount (₹)"),
            **CHART_LAYOUT
        )
        st.plotly_chart(fig_line, use_container_width=True)
    else:
        st.info("No order trend data available for the selected timeframe.")

with row2_col2:
    st.markdown("### 🥧 Revenue Shared by Category")
    if not cat_dist_df.empty:
        fig_pie = px.pie(
            cat_dist_df, values="revenue", names="category",
            hole=0.52, color_discrete_sequence=COLOR_PALETTE,
            custom_data=["revenue", "units_sold", "order_count"]
        )
        fig_pie.update_traces(
            textposition="inside",
            textinfo="percent+label",
            hovertemplate="<b>%{label}</b><br>Revenue: ₹%{value:,.2f}<br>Share: %{percent}<extra></extra>"
        )
        fig_pie.update_layout(
            title="Aggregated Revenue Share by Category",
            showlegend=False,
            **CHART_LAYOUT
        )
        st.plotly_chart(fig_pie, use_container_width=True)
    else:
        st.info("No category sales data available.")

st.divider()

row3_col1, row3_col2 = st.columns(2)

with row3_col1:
    st.markdown("### 🏆 Top Selling Products (Aggregated Revenue)")
    if not top_prod_df.empty:
        top_prod_df = top_prod_df.sort_values(by="revenue", ascending=True)
        top_prod_df["rev_label"] = top_prod_df["revenue"].apply(fmt_inr)

        fig_bar_prod = px.bar(
            top_prod_df,
            x="revenue",
            y="product_name",
            orientation="h",
            text="rev_label",
            color="category",
            color_discrete_sequence=COLOR_PALETTE,
            custom_data=["units_sold", "order_count"]
        )
        fig_bar_prod.update_traces(
            textposition="outside",
            hovertemplate="<b>%{y}</b> (%{customdata[1]} orders)<br>Total Revenue: ₹%{x:,.2f}<br>Units Sold: %{customdata[0]}<extra></extra>"
        )
        fig_bar_prod.update_layout(
            title="Top 10 Products Ranked by Total Revenue",
            xaxis=dict(title="Revenue Generated (₹)", gridcolor="#f1f5f9"),
            yaxis=dict(title=""),
            **CHART_LAYOUT
        )
        st.plotly_chart(fig_bar_prod, use_container_width=True)
    else:
        st.info("No top product sales data available.")

with row3_col2:
    st.markdown("### 🏪 Top Vendor Performance")
    if not top_vendor_df.empty:
        fig_bar_vendor = go.Figure()
        fig_bar_vendor.add_trace(go.Bar(
            x=top_vendor_df["business_name"], y=top_vendor_df["total_gmv"],
            name="Gross Sales (GMV)", marker_color="#6366f1"
        ))
        fig_bar_vendor.add_trace(go.Bar(
            x=top_vendor_df["business_name"], y=top_vendor_df["commission_paid"],
            name="Commission Earned", marker_color="#8b5cf6"
        ))
        fig_bar_vendor.update_layout(
            title="Top Vendors: GMV vs Platform Commission",
            barmode="group",
            xaxis=dict(gridcolor="#f1f5f9"),
            yaxis=dict(gridcolor="#f1f5f9", title="Amount (₹)"),
            **CHART_LAYOUT
        )
        st.plotly_chart(fig_bar_vendor, use_container_width=True)
    else:
        st.info("No vendor performance data available.")

st.divider()

st.markdown("### 📋 Recent Transactions & Order Explorer")

if not recent_orders_df.empty:
    recent_orders_df["amount"] = recent_orders_df["amount"].apply(lambda x: f"₹{float(x):,.2f}")
    recent_orders_df["commission"] = recent_orders_df["commission"].apply(lambda x: f"₹{float(x):,.2f}")

    st.dataframe(
        recent_orders_df,
        use_container_width=True,
        hide_index=True,
        column_config={
            "order_id": st.column_config.TextColumn("Order ID"),
            "date": st.column_config.DatetimeColumn("Order Date", format="DD MMM YYYY, HH:mm"),
            "customer": st.column_config.TextColumn("Customer Name"),
            "vendor": st.column_config.TextColumn("Vendor Name"),
            "amount": st.column_config.TextColumn("Total Amount"),
            "commission": st.column_config.TextColumn("Commission Amount"),
        }
    )

    csv_data = recent_orders_df.to_csv(index=False).encode('utf-8')
    st.download_button(
        label="📥 Download Transactions CSV",
        data=csv_data,
        file_name=f"shopsense_orders_{today}.csv",
        mime="text/csv"
    )
else:
    st.info("No transactions found for the specified filters.")
