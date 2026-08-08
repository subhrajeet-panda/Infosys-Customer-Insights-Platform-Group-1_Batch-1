# 📊 ShopSense Single-Page Executive BI Dashboard

A clean, interactive, single-page Business Intelligence dashboard for ShopSense built with **Streamlit**, **Plotly**, and **Pandas**.

---

## 🚀 Quick Start

### 1. Ensure Postgres is Running
```bash
# In project root:
docker compose up -d postgres
```

### 2. Install & Run
```bash
cd streamlit-dashboard
pip install -r requirements.txt
streamlit run app.py
```

Open **http://localhost:8501** in your browser.

---

## 📈 Dashboard Features

- 💰 **6 Executive KPI Cards**: Gross Revenue (GMV), Platform Commission, Total Orders, Active Customers, Total Vendors, Avg Order Value (AOV).
- 📈 **Interactive Line Chart**: Daily Revenue vs. Platform Commission over time with hover inspect.
- 🥧 **Donut / Pie Chart**: Sales Revenue distribution by Product Category.
- 🏆 **Horizontal Bar Chart**: Top 10 Best Selling Products by revenue & category breakdown.
- 🏪 **Grouped Bar Chart**: Top Vendor performance (GMV vs Commission).
- 📋 **Transaction Explorer Table**: Filterable recent orders table with 1-click CSV export button.
- ⚙️ **Global Filters**: Date horizon presets (30d, 90d, 180d, All time) & Product Category filtering.
