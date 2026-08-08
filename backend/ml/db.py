import os
import json
import math
import uuid
import datetime
from pathlib import Path

import numpy as np
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)

def get_connection():
    conn = psycopg2.connect(
        host=os.getenv("PGHOST", "localhost"),
        port=os.getenv("PGPORT", "5432"),
        user=os.getenv("PGUSER", "postgres"),
        password=os.getenv("PGPASSWORD", ""),
        dbname=os.getenv("PGDATABASE", "shopsense"),
    )
                                                                               
    psycopg2.extras.register_uuid(conn_or_curs=conn)
    return conn

def fetch_df(query, params=None):
                                                    
    import pandas as pd
    conn = get_connection()
    try:
        df = pd.read_sql_query(query, conn, params=params)
        return df
    finally:
        conn.close()

def _sanitize(obj):
      
    if obj is None:
        return None
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        val = float(obj)
        return None if (math.isnan(val) or math.isinf(val)) else val
    if isinstance(obj, np.ndarray):
        return [_sanitize(x) for x in obj.tolist()]
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, (datetime.date, datetime.datetime)):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {str(k): _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [_sanitize(x) for x in obj]
                                              
    try:
        import pandas as pd
        if obj is pd.NaT or (np.isscalar(obj) and pd.isna(obj)):
            return None
    except Exception:
        pass
    return obj

def save_result(model_type: str, payload: dict):
                                                                                            
    clean_payload = _sanitize(payload)
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO ml_results (model_type, payload, generated_at)
            VALUES (%s, %s, now())
            ON CONFLICT (model_type)
            DO UPDATE SET payload = EXCLUDED.payload, generated_at = now()
            """,
            (model_type, json.dumps(clean_payload)),
        )
        conn.commit()
    finally:
        conn.close()
    print(json.dumps({"model_type": model_type, "status": "ok"}))
