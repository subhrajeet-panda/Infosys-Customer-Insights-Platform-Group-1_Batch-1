const { execFile } = require('child_process');
const path = require('path');
const pool = require('../config/db');

const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';
const ML_DIR = path.join(__dirname, '..', '..', 'ml');
const REQUIRED_MODULES = ['pandas', 'numpy', 'sklearn', 'psycopg2', 'dotenv'];

const SCRIPTS = {
  inventory_forecast: 'inventory_forecast.py',
  customer_segmentation: 'customer_segmentation.py',
  recommendations: 'recommendations.py',
  churn_analysis: 'churn_analysis.py',
  validation: 'validate_models.py',
};

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    execFile(PYTHON_BIN, [path.join(ML_DIR, scriptName)], { cwd: ML_DIR, timeout: 120000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

function checkPythonEnv() {
  return new Promise((resolve) => {
    const probe = `import sys, importlib.util
missing = [m for m in ${JSON.stringify(REQUIRED_MODULES)} if importlib.util.find_spec(m) is None]
print("MISSING:" + ",".join(missing) if missing else "OK")
print("PYTHON_EXE:" + sys.executable)`;

    execFile(PYTHON_BIN, ['-c', probe], { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        return resolve({
          ok: false,
          message: `Could not run the Python interpreter "${PYTHON_BIN}". Is Python installed and on your PATH? ` +
            `(${stderr || err.message})`.slice(0, 500),
        });
      }
      const missingLine = stdout.split('\n').find((l) => l.startsWith('MISSING:'));
      const exeLine = stdout.split('\n').find((l) => l.startsWith('PYTHON_EXE:'));
      const pythonExe = exeLine ? exeLine.replace('PYTHON_EXE:', '').trim() : PYTHON_BIN;
      if (missingLine) {
        const missing = missingLine.replace('MISSING:', '').split(',').filter(Boolean);
        return resolve({
          ok: false,
          message: `The Python interpreter at "${pythonExe}" is missing required packages: ${missing.join(', ')}. ` +
            `This usually means PYTHON_BIN in backend/.env points to a different Python than the one you ran ` +
            `"pip install -r backend/ml/requirements.txt" with. Fix: run ` +
            `"cd backend/ml && pip install -r requirements.txt" using that exact interpreter, or set ` +
            `PYTHON_BIN in backend/.env to your virtualenv's python path, e.g. ` +
            `PYTHON_BIN=/absolute/path/to/backend/ml/venv/bin/python3 (Windows: ...\\venv\\Scripts\\python.exe), ` +
            `then restart the backend.`,
        });
      }
      resolve({ ok: true, pythonExe });
    });
  });
}

async function runModel(req, res) {
  const model = req.params.model;
  const script = SCRIPTS[model];
  if (!script) return res.status(400).json({ error: 'Unknown model' });

  const envCheck = await checkPythonEnv();
  if (!envCheck.ok) {
    return res.status(500).json({ error: 'Python environment problem', detail: envCheck.message });
  }

  try {
    await runScript(script);
    const { rows } = await pool.query('SELECT * FROM ml_results WHERE model_type = $1', [model]);
    res.json({ result: rows[0] || null });
  } catch (err) {
    console.error(`ML script failed (${model}):`, err.message);
    res.status(500).json({
      error: `The ${model} model failed to run.`,
      detail: err.message,
    });
  }
}

async function runAll(req, res) {
  const envCheck = await checkPythonEnv();
  if (!envCheck.ok) {
    return res.status(500).json({ error: 'Python environment problem', detail: envCheck.message });
  }

  const results = {};
  for (const [model, script] of Object.entries(SCRIPTS)) {
    try {
      await runScript(script);
      results[model] = 'ok';
    } catch (err) {
      results[model] = `failed: ${err.message.slice(0, 300)}`;
    }
  }
  res.json({ results, pythonExe: envCheck.pythonExe });
}

async function getResult(req, res) {
  const model = req.params.model;
  if (!SCRIPTS[model]) return res.status(400).json({ error: 'Unknown model' });
  try {
    const { rows } = await pool.query('SELECT * FROM ml_results WHERE model_type = $1', [model]);
    if (!rows.length) return res.status(404).json({ error: 'No results yet — run the model first via POST /api/ml/run/' + model });
    res.json({ result: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch ML result' });
  }
}

async function getMyRecommendations(req, res) {
  try {
    const { rows } = await pool.query(`SELECT * FROM ml_results WHERE model_type = 'recommendations'`);
    if (rows.length) {
      const list = rows[0].payload?.customer_recommendations || [];
      const mine = list.find((c) => c.customer_id === req.user.id);
      if (mine && mine.recommendations?.length) {
        return res.json({
          source: 'model',
          generatedAt: rows[0].generated_at,
          method: rows[0].payload?.method,
          recommendations: mine.recommendations,
        });
      }
    }

    const fallback = await pool.query(`
      SELECT p.id AS product_id, p.name, p.category, p.price, v.business_name AS vendor_name,
             COALESCE(SUM(oi.quantity), 0)::int AS units_sold
      FROM products p
      JOIN vendors v ON v.id = p.vendor_id
      LEFT JOIN order_items oi ON oi.product_id = p.id
      LEFT JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
      WHERE p.status = 'active' AND v.status = 'approved'
      GROUP BY p.id, p.name, p.category, p.price, v.business_name
      ORDER BY units_sold DESC, p.created_at DESC
      LIMIT 8
    `);
    res.json({
      source: 'trending_fallback',
      generatedAt: null,
      method: 'Trending products (bestsellers) — shown until enough of your own activity exists for personalized picks.',
      recommendations: fallback.rows.map((r) => ({ ...r, score: null })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
}

module.exports = { runModel, runAll, getResult, getMyRecommendations };
