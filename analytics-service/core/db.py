import math
import uuid
import datetime
import numpy as np
import psycopg2
import psycopg2.extras

from core.config import settings

def _ssl_required() -> bool:
                                                                   
    return "render.com" in settings.PGHOST

def get_connection():
    kwargs = dict(
        host=settings.PGHOST, port=settings.PGPORT, user=settings.PGUSER,
        password=settings.PGPASSWORD, dbname=settings.PGDATABASE,
    )
    if _ssl_required():
        kwargs["sslmode"] = "require"
    conn = psycopg2.connect(**kwargs)
    psycopg2.extras.register_uuid(conn_or_curs=conn)
    return conn

def fetch_df(query, params=None):
    import pandas as pd
    conn = get_connection()
    try:
        return pd.read_sql_query(query, conn, params=params)
    finally:
        conn.close()

def execute(query, params=None, fetch=False):
                                                                            
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(query, params or ())
        result = cur.fetchall() if fetch else None
        conn.commit()
        return result
    finally:
        conn.close()

def sanitize(obj):
   
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
        return [sanitize(x) for x in obj.tolist()]
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, (datetime.date, datetime.datetime)):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {str(k): sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [sanitize(x) for x in obj]
    try:
        import pandas as pd
        if obj is pd.NaT or (np.isscalar(obj) and pd.isna(obj)):
            return None
    except Exception:
        pass
    return obj
