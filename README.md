# 🛍️ ShopSense — Multi-Vendor E-Commerce Analytics Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Node.js](https://img.shields.io/badge/Node.js-v18+-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white)](https://reactjs.org)
[![Streamlit](https://img.shields.io/badge/Streamlit-1.35+-FF4B4B?logo=streamlit&logoColor=white)](https://streamlit.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)

> **ShopSense** is an end-to-end, multi-vendor e-commerce analytics and business intelligence platform designed for real-time sales insight generation, customer behavior analytics, ML-driven demand forecasting, and vendor performance benchmarking.

---

## 📌 Executive Summary & Features

- 📊 **Executive BI Dashboard (Streamlit & Plotly)**:
  - **6 Core Executive KPI Cards**: Gross Revenue (GMV), Platform Commission, Total Orders, Active Customers, **Total Vendors**, and Avg Order Value (AOV).
  - Dynamic Time Horizon & Category filtering (30d, 90d, 180d, All Time).
  - Interactive daily revenue vs. commission trend graphs.
  - Category revenue distribution pie chart & top 10 products revenue ranking.
  - Top vendor sales performance comparative bar chart.
  - Filterable transaction explorer with 1-click CSV report export.

- 🤖 **Analytics & Machine Learning Pipelines (FastAPI & Pandas)**:
  - Demand and inventory forecasting pipelines.
  - Customer spending & RFM segmentation analysis.
  - ML recommendation engine for personalized product suggestions.
  - Multi-vendor revenue benchmarking against market standards.

- 🛒 **Multi-Vendor E-Commerce Application (Node.js & React)**:
  - Modern web application built with React, Vite, and TailwindCSS.
  - Vendor product catalog management & customer order workflows.
  - Express.js API backend connected to PostgreSQL database.

---

## 🏗️ System Architecture

```text
Infosys-Customer-Insights-Platform/
├── backend/             # Node.js / Express API Backend & Database Migrations
├── frontend/            # React / Vite / TailwindCSS Web Application
├── analytics-service/   # Python / FastAPI ML Analytics Pipelines
├── streamlit-dashboard/ # Streamlit Executive BI Dashboard
└── docker-compose.yml   # Docker Orchestration Configuration
```

---

## 💻 Prerequisites

Ensure you have the following installed locally before proceeding:

- [Git](https://git-scm.com/) (v2.30+)
- [Node.js](https://nodejs.org/) (v18+) & `npm`
- [Python](https://www.python.org/) (v3.10+) & `pip`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) *(Optional, recommended for automated setup)*
- [PostgreSQL](https://www.postgresql.org/) (v14+) *(If running database natively without Docker)*

---

## 🚀 Quick Start — Local Setup Guide

### Option A: Running with Docker Compose (Recommended)

To launch the entire platform stack (PostgreSQL, Express Backend, FastAPI Analytics) in Docker:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/subhrajeet-panda/Infosys-Customer-Insights-Platform-Group-1_Batch-1.git
   cd Infosys-Customer-Insights-Platform-Group-1_Batch-1
   ```

2. **Configure Environment Variables**:
   Copy the example `.env` files for each service:
   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp analytics-service/.env.example analytics-service/.env
   cp streamlit-dashboard/.env.example streamlit-dashboard/.env
   ```

3. **Start Docker Containers**:
   ```bash
   docker compose up --build -d
   ```

---

### Option B: Manual Local Setup (Step-by-Step)

#### 1. Database Setup (PostgreSQL)
Ensure PostgreSQL is running locally on port `5432` with a database named `shopsense`.

#### 2. Backend Service (Node.js & Express)
```bash
cd backend
npm install
npm run migrate
npm run seed     # Seeds test vendors, products, and customer orders
npm run dev
```
*Backend server runs on `http://localhost:5000`*

#### 3. Analytics Service (Python & FastAPI)
```bash
cd ../analytics-service
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
*Analytics API runs on `http://localhost:8000`*

#### 4. Streamlit Executive BI Dashboard
```bash
cd ../streamlit-dashboard
pip install -r requirements.txt
streamlit run app.py
```
*Streamlit Dashboard opens automatically at `http://localhost:8501`*

#### 5. Frontend Web Application (React & Vite)
```bash
cd ../frontend
npm install
npm run dev
```
*Web App runs on `http://localhost:5173`*

---

## 📊 Streamlit Dashboard Features & Metrics

The executive BI dashboard provides high-level business oversight:

| Metric | Description | Query Source |
| :--- | :--- | :--- |
| **💰 Gross Revenue (GMV)** | Total completed order revenue | `SUM(total_amount)` |
| **🏦 Platform Commission** | Platform net commission share | `SUM(commission_amount)` |
| **📦 Total Orders** | Total completed order volume | `COUNT(DISTINCT order_id)` |
| **👥 Active Customers** | Unique active customer accounts | `COUNT(DISTINCT customer_id)` |
| **🏪 Total Vendors** | Unique active vendor accounts | `COUNT(DISTINCT vendor_id)` |
| **🛒 Avg Order Value** | Average transaction size | `AVG(total_amount)` |

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TailwindCSS, Recharts, Lucide Icons
- **Dashboard**: Streamlit, Plotly Express & Graph Objects, Pandas
- **Backend API**: Node.js, Express.js, PostgreSQL (`pg`), JWT Auth
- **Analytics & ML**: FastAPI, Pandas, NumPy, Scikit-learn, Pytest
- **DevOps**: Docker, Docker Compose, PostgreSQL 16 Alpine

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.
