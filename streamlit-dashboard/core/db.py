import os
import psycopg2
import pandas as pd
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

def _get_conn_kwargs() -> dict:
    host = os.environ.get("PGHOST", "localhost")
    kwargs = dict(
        host=host,
        port=int(os.environ.get("PGPORT", 5432)),
        user=os.environ.get("PGUSER", "postgres"),
        password=os.environ.get("PGPASSWORD", ""),
        dbname=os.environ.get("PGDATABASE", "shopsense"),
    )
    if "render.com" in host:
        kwargs["sslmode"] = "require"
    return kwargs

def get_connection():
    return psycopg2.connect(**_get_conn_kwargs())

@st.cache_data(ttl=30, show_spinner=False)
def fetch_df(query: str, params=None) -> pd.DataFrame:
                                                                         
    conn = get_connection()
    try:
        return pd.read_sql_query(query, conn, params=params)
    finally:
        conn.close()

def test_connection() -> tuple[bool, str]:
                                      
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT version();")
        ver = cur.fetchone()[0].split(" ")[1]
        conn.close()
        return True, f"PostgreSQL {ver}"
    except Exception as e:
        return False, str(e)
