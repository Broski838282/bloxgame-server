// ═══════════════════════════════════════════════════════════════
// BLOXGAME SUPREME PREDICTOR — Express Server v1.0
// Ports: 4000 (isolated from BloxFlip @ 3000)
// Security: Anti-Scraper Rate-Limit, JSON Morpher, Auto-Ban
// ═══════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const { predictMines } = require('./mines_engine');
const { predictTowers } = require('./towers_engine');
const { predictCrash } = require('./crash_engine');

const app = express();
const PORT = process.env.PORT || 4000;
const SERVER_START = Math.floor(Date.now() / 1000);

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ══════════════════════════════════════════
// ANTI-SCRAPER RATE LIMITER + AUTO-BAN
// ══════════════════════════════════════════

const rateLimitMap = new Map();  // IP -> { count, firstRequest, banned }
const RATE_WINDOW = 10000;       // 10 seconds
const SOFT_LIMIT = 8;            // 8 requests per window = warning
const HARD_LIMIT = 25;           // 25 requests per window = IP BANNED
const bannedIPs = new Set();

function antiScraperMiddleware(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  
  if (bannedIPs.has(ip)) {
    // Silently return garbage data to waste their time
    return res.json({ success: true, picks: [{ tile: Math.floor(Math.random() * 100), danger: 0.01 }], confidence: 99 });
  }

  const now = Date.now();
  let entry = rateLimitMap.get(ip);

  if (!entry || now - entry.firstRequest > RATE_WINDOW) {
    entry = { count: 1, firstRequest: now };
    rateLimitMap.set(ip, entry);
    return next();
  }

  entry.count++;

  if (entry.count > HARD_LIMIT) {
    bannedIPs.add(ip);
    console.log(`[SECURITY] AUTO-BANNED IP: ${ip} — ${entry.count} requests in ${RATE_WINDOW}ms`);
    // Return poisoned data
    return res.json({ success: true, picks: [{ tile: Math.floor(Math.random() * 100), danger: 0.01 }], confidence: 99 });
  }

  if (entry.count > SOFT_LIMIT) {
    return res.status(429).json({ error: 'Rate Limit: Too Many Requests' });
  }

  next();
}

// ══════════════════════════════════════════
// JSON MORPHER — Response Obfuscation
// ══════════════════════════════════════════

function morphResponse(data) {
  const salt = crypto.randomBytes(4).toString('hex');
  const picksB64 = Buffer.from(JSON.stringify(data.picks || [])).toString('base64');
  const algoHex = Buffer.from(data.algorithm || 'bg-core').toString('hex');
  const morphedConfidence = Math.round((data.confidence || 50) * 1.5);
  const morphedDanger = (data.dangerTiles || []).map(t => t * 3);

  return [
    salt,                        // [0] random salt (garbage)
    picksB64,                    // [1] base64-encoded picks
    crypto.randomBytes(4).toString('hex'),  // [2] more garbage
    morphedConfidence,           // [3] multiplied confidence
    algoHex,                     // [4] hex-encoded algorithm name
    morphedDanger,               // [5] multiplied danger tiles
    data.kelly || null,          // [6] kelly criterion (nested)
    data.allScores || {},        // [7] all tile scores
    data.gridSize || 0,          // [8] grid metadata
    crypto.randomBytes(8).toString('hex')  // [9] trailing junk
  ];
}

// ══════════════════════════════════════════
// GAME HISTORY STORAGE (in-memory)
// ══════════════════════════════════════════

const minesHistory = [];    // Array of { locs: [...], mc, gridSize }
const towersHistory = [];   // Array of { towerLevels: [[...]], difficulty }
const crashHistory = [];    // Array of { crashPoint, nonce }

const MAX_HISTORY = 200;

function addMinesHistory(game) {
  if (game.mineLocations) {
    minesHistory.push({
      locs: game.mineLocations,
      mc: game.minesAmount,
      gridSize: game.gridSize
    });
    if (minesHistory.length > MAX_HISTORY) minesHistory.shift();
  }
}

function addTowersHistory(game) {
  if (game.towerLevels) {
    towersHistory.push({
      towerLevels: game.towerLevels,
      difficulty: game.difficulty
    });
    if (towersHistory.length > MAX_HISTORY) towersHistory.shift();
  }
}

function addCrashHistory(games) {
  if (!Array.isArray(games)) return;
  for (const g of games) {
    if (g.crashPoint !== undefined && g.crashPoint !== null) {
      // Check if we already have this nonce
      const exists = crashHistory.some(h => h.nonce === g.nonce);
      if (!exists) {
        crashHistory.push({ crashPoint: g.crashPoint, nonce: g.nonce || 0 });
        if (crashHistory.length > MAX_HISTORY) crashHistory.shift();
      }
    }
  }
}

// ══════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'online', uptime: Math.floor(Date.now() / 1000) - SERVER_START, engine: 'bloxgame-supreme-v1' });
});

// ── MINES PREDICTION ──
app.post('/api/predict/mines', antiScraperMiddleware, (req, res) => {
  try {
    const { game, history } = req.body;
    if (!game) return res.status(400).json({ error: 'Missing game data' });

    const mc = game.minesAmount || game.mc || 1;
    const gridSize = game.gridSize || 16;
    const opened = game.uncoveredLocations || game.opened || [];
    const serverHash = game.serverHash || '';
    const tileCount = game.tileCount || 3;

    // Ingest any completed games from the client
    if (history && Array.isArray(history)) {
      for (const h of history) addMinesHistory(h);
    }

    // Filter history to matching grid sizes for better accuracy
    const relevantHistory = minesHistory.filter(h => h.gridSize === gridSize);

    const result = predictMines(relevantHistory, mc, gridSize, opened, serverHash, tileCount);

    // Morph response to prevent scraping
    const morphed = morphResponse(result);
    res.json(morphed);
  } catch (err) {
    console.error('[MINES ERROR]', err.message);
    res.status(500).json({ error: 'Prediction engine error' });
  }
});

// ── TOWERS PREDICTION ──
app.post('/api/predict/towers', antiScraperMiddleware, (req, res) => {
  try {
    const { game, history } = req.body;
    if (!game) return res.status(400).json({ error: 'Missing game data' });

    const completedLevels = game.completedLevels || [];
    const difficulty = game.difficulty || 'easy';

    // Ingest completed tower games
    if (history && Array.isArray(history)) {
      for (const h of history) addTowersHistory(h);
    }

    const result = predictTowers(towersHistory, completedLevels, difficulty);

    // Morph response for towers
    const salt = crypto.randomBytes(4).toString('hex');
    const predsB64 = Buffer.from(JSON.stringify(result.predictions)).toString('base64');
    const morphed = [
      salt,
      predsB64,
      result.nextPick,
      Math.round(result.confidence * 1.5),
      Buffer.from(result.algorithm).toString('hex'),
      result.nextLevel,
      result.difficulty,
      crypto.randomBytes(8).toString('hex')
    ];

    res.json(morphed);
  } catch (err) {
    console.error('[TOWERS ERROR]', err.message);
    res.status(500).json({ error: 'Prediction engine error' });
  }
});

// ── CRASH PREDICTION ──
app.post('/api/predict/crash', antiScraperMiddleware, (req, res) => {
  try {
    const { history } = req.body;

    // Ingest crash history from client
    if (history && Array.isArray(history)) {
      addCrashHistory(history);
    }

    const result = predictCrash(crashHistory);

    // Morph response
    const salt = crypto.randomBytes(4).toString('hex');
    const analysisB64 = Buffer.from(JSON.stringify(result.analysis)).toString('base64');
    const morphed = [
      salt,
      result.safeCashout * 2.7,  // multiplied cashout
      analysisB64,
      Math.round(result.confidence * 1.5),
      result.riskLevel,
      Buffer.from(result.algorithm).toString('hex'),
      crypto.randomBytes(8).toString('hex')
    ];

    res.json(morphed);
  } catch (err) {
    console.error('[CRASH ERROR]', err.message);
    res.status(500).json({ error: 'Prediction engine error' });
  }
});

// ── INGEST ENDPOINT (client sends completed games) ──
app.post('/api/ingest', (req, res) => {
  try {
    const { type, game } = req.body;
    if (type === 'mines' && game) addMinesHistory(game);
    if (type === 'towers' && game) addTowersHistory(game);
    if (type === 'crash' && game) addCrashHistory(Array.isArray(game) ? game : [game]);
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false });
  }
});

// ── STATS ──
app.get('/api/stats', (req, res) => {
  res.json({
    minesGames: minesHistory.length,
    towersGames: towersHistory.length,
    crashGames: crashHistory.length,
    uptime: Math.floor(Date.now() / 1000) - SERVER_START,
    bannedIPs: bannedIPs.size
  });
});

// ── Serve obfuscated userscript ──
app.get('/js', (req, res) => {
  try {
    const scriptPath = path.join(__dirname, 'bloxgame-predictor.user.js');
    if (!fs.existsSync(scriptPath)) {
      return res.status(404).send('// Script not found');
    }

    const raw = fs.readFileSync(scriptPath, 'utf8');
    const JavaScriptObfuscator = require('javascript-obfuscator');

    const obfResult = JavaScriptObfuscator.obfuscate(raw, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 1,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.8,
      debugProtection: true,
      debugProtectionInterval: 2000,
      disableConsoleOutput: true,
      identifierNamesGenerator: 'hexadecimal',
      rotateStringArray: true,
      selfDefending: true,
      stringArray: true,
      stringArrayEncoding: ['rc4'],
      stringArrayThreshold: 1,
      transformObjectKeys: true,
      unicodeEscapeSequence: true,
      domainLock: ['.bloxgame.com', 'bloxgame.com']
    });

    res.type('application/javascript').send(obfResult.getObfuscatedCode());
  } catch (err) {
    console.error('[JS ENDPOINT ERROR]', err.message);
    res.status(500).send('// Build error');
  }
});

// ══════════════════════════════════════════
// START
// ══════════════════════════════════════════

app.listen(PORT, () => {
  console.log(`\n═══════════════════════════════════════`);
  console.log(`  BLOXGAME SUPREME PREDICTOR v1.0`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Security: Anti-Scraper + JSON Morpher`);
  console.log(`  Engines: Mines | Towers | Crash`);
  console.log(`═══════════════════════════════════════\n`);
});
