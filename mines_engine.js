// ═══════════════════════════════════════════════════════════════
// BLOXGAME MINES ENGINE — Variable Grid ML Predictor
// Supports grids from 2x2 (4 tiles) to 10x10 (100 tiles)
// ═══════════════════════════════════════════════════════════════

const crypto = require('crypto');

// ─────────────────────────────────────────
// FEATURE EXTRACTION (Dynamic Grid)
// ─────────────────────────────────────────

function extractFeatures(games, tileIndex, gridSize) {
  const side = Math.sqrt(gridSize);
  const n = games.length;
  if (n < 3) return null;

  const row = Math.floor(tileIndex / side);
  const col = tileIndex % side;
  const center = (side - 1) / 2;

  // Frequency: how often this tile was a mine
  let hitCount = 0;
  for (let i = 0; i < n; i++) {
    if (games[i].locs && games[i].locs.includes(tileIndex)) hitCount++;
  }
  const hitRate = hitCount / n;

  // Rolling windows
  const rollingRates = [5, 10, 25].map(w => {
    const slice = games.slice(-Math.min(w, n));
    let hits = 0;
    for (const g of slice) if (g.locs && g.locs.includes(tileIndex)) hits++;
    return slice.length > 0 ? hits / slice.length : 0.5;
  });

  // Momentum
  const recent3 = games.slice(-3);
  const older3 = games.slice(-6, -3);
  let rH = 0, oH = 0;
  for (const g of recent3) if (g.locs && g.locs.includes(tileIndex)) rH++;
  for (const g of older3) if (g.locs && g.locs.includes(tileIndex)) oH++;
  const momentum = (recent3.length > 0 ? rH / recent3.length : 0) -
                    (older3.length > 0 ? oH / older3.length : 0);

  // Streak
  let streak = 0;
  for (let i = n - 1; i >= 0; i--) {
    if (games[i].locs && games[i].locs.includes(tileIndex)) streak++;
    else break;
  }

  // Spatial
  const isEdge = (row === 0 || row === side - 1 || col === 0 || col === side - 1) ? 1 : 0;
  const isCorner = ((row === 0 || row === side - 1) && (col === 0 || col === side - 1)) ? 1 : 0;
  const distFromCenter = Math.sqrt((row - center) ** 2 + (col - center) ** 2) / (center || 1);

  // Neighbor density (adaptive to grid size)
  let neighborHitRate = 0, nCount = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr, nc = col + dc;
      if (nr >= 0 && nr < side && nc >= 0 && nc < side) {
        const ni = nr * side + nc;
        let nH = 0;
        for (const g of games) if (g.locs && g.locs.includes(ni)) nH++;
        neighborHitRate += nH / n;
        nCount++;
      }
    }
  }
  neighborHitRate = nCount > 0 ? neighborHitRate / nCount : 0.5;

  return [
    hitRate,
    rollingRates[0], rollingRates[1], rollingRates[2],
    momentum,
    streak / 10,
    isEdge, isCorner,
    distFromCenter,
    neighborHitRate,
    gridSize / 100,  // Normalized grid size feature
    side / 10        // Normalized side length
  ];
}

// ─────────────────────────────────────────
// GRADIENT BOOSTED TREE (Lightweight XGBoost)
// Adapted for variable grid sizes
// ─────────────────────────────────────────

class MiniForest {
  constructor() {
    this.trees = [];
    this.learningRate = 0.15;
  }

  // Each tree is a simple depth-2 decision stump
  buildTree(X, residuals) {
    let bestSplit = { feat: 0, thresh: 0.5, leftVal: 0, rightVal: 0, gain: -Infinity };

    for (let f = 0; f < X[0].length; f++) {
      // Try 5 threshold splits
      for (let q = 0.2; q <= 0.8; q += 0.15) {
        let leftSum = 0, leftN = 0, rightSum = 0, rightN = 0;
        for (let i = 0; i < X.length; i++) {
          if (X[i][f] <= q) { leftSum += residuals[i]; leftN++; }
          else { rightSum += residuals[i]; rightN++; }
        }
        if (leftN === 0 || rightN === 0) continue;
        const leftMean = leftSum / leftN;
        const rightMean = rightSum / rightN;
        const gain = leftN * leftMean * leftMean + rightN * rightMean * rightMean;
        if (gain > bestSplit.gain) {
          bestSplit = { feat: f, thresh: q, leftVal: leftMean, rightVal: rightMean, gain };
        }
      }
    }
    return bestSplit;
  }

  train(X, y, nTrees = 30) {
    this.trees = [];
    const preds = new Array(X.length).fill(0.5);
    const residuals = y.map((yi, i) => yi - preds[i]);

    for (let t = 0; t < nTrees; t++) {
      const tree = this.buildTree(X, residuals);
      this.trees.push(tree);
      for (let i = 0; i < X.length; i++) {
        const pred = X[i][tree.feat] <= tree.thresh ? tree.leftVal : tree.rightVal;
        preds[i] += this.learningRate * pred;
        residuals[i] = y[i] - preds[i];
      }
    }
  }

  predict(x) {
    let pred = 0.5;
    for (const tree of this.trees) {
      pred += this.learningRate * (x[tree.feat] <= tree.thresh ? tree.leftVal : tree.rightVal);
    }
    return Math.max(0, Math.min(1, pred));
  }
}

// ─────────────────────────────────────────
// ENSEMBLE ALGORITHMS (10+ methods)
// ─────────────────────────────────────────

// 1. Frequency Analysis
function algoFrequency(games, gridSize) {
  const scores = new Array(gridSize).fill(0);
  if (games.length === 0) return scores;
  for (let t = 0; t < gridSize; t++) {
    let hits = 0;
    for (const g of games) if (g.locs && g.locs.includes(t)) hits++;
    scores[t] = 1 - (hits / games.length); // Higher = safer
  }
  return scores;
}

// 2. Recency Weighted
function algoRecency(games, gridSize) {
  const scores = new Array(gridSize).fill(0.5);
  if (games.length === 0) return scores;
  const n = games.length;
  for (let t = 0; t < gridSize; t++) {
    let weightedHits = 0, totalWeight = 0;
    for (let i = 0; i < n; i++) {
      const w = (i + 1) / n; // More recent = higher weight
      if (games[i].locs && games[i].locs.includes(t)) weightedHits += w;
      totalWeight += w;
    }
    scores[t] = 1 - (weightedHits / totalWeight);
  }
  return scores;
}

// 3. Hot-Cold Streak Detector
function algoHotCold(games, gridSize) {
  const scores = new Array(gridSize).fill(0.5);
  if (games.length < 3) return scores;
  for (let t = 0; t < gridSize; t++) {
    let streak = 0;
    for (let i = games.length - 1; i >= 0; i--) {
      if (games[i].locs && games[i].locs.includes(t)) streak++;
      else break;
    }
    // If tile has been a mine repeatedly, it's "hot" (dangerous)
    scores[t] = Math.max(0, 1 - streak * 0.2);
  }
  return scores;
}

// 4. Spatial Clustering
function algoSpatial(games, gridSize) {
  const side = Math.sqrt(gridSize);
  const scores = new Array(gridSize).fill(0.5);
  if (games.length === 0) return scores;
  const lastGame = games[games.length - 1];
  if (!lastGame.locs) return scores;

  for (let t = 0; t < gridSize; t++) {
    const row = Math.floor(t / side), col = t % side;
    let proximity = 0;
    for (const mineLoc of lastGame.locs) {
      const mr = Math.floor(mineLoc / side), mc = mineLoc % side;
      const dist = Math.sqrt((row - mr) ** 2 + (col - mc) ** 2);
      proximity += 1 / (dist + 1);
    }
    scores[t] = Math.max(0, 1 - proximity * 0.15);
  }
  return scores;
}

// 5. Bayesian Prior
function algoBayesian(games, gridSize, mineCount) {
  const scores = new Array(gridSize).fill(0);
  const prior = mineCount / gridSize; // base danger probability
  const n = games.length;

  for (let t = 0; t < gridSize; t++) {
    let hits = 0;
    for (const g of games) if (g.locs && g.locs.includes(t)) hits++;
    // Bayesian update: posterior = (hits + prior*alpha) / (n + alpha)
    const alpha = 5;
    const posterior = (hits + prior * alpha) / (n + alpha);
    scores[t] = 1 - posterior;
  }
  return scores;
}

// 6. NGram Pattern (2-gram)
function algoNGram(games, gridSize) {
  const scores = new Array(gridSize).fill(0.5);
  if (games.length < 2) return scores;
  const lastLocs = new Set(games[games.length - 1].locs || []);

  // Count: given last round's mines, which tiles tend to be mines next?
  const transition = new Array(gridSize).fill(0);
  const tranTotal = new Array(gridSize).fill(0);

  for (let i = 1; i < games.length; i++) {
    const prevMines = new Set(games[i - 1].locs || []);
    const currMines = new Set(games[i].locs || []);
    for (let t = 0; t < gridSize; t++) {
      tranTotal[t]++;
      if (currMines.has(t)) transition[t]++;
    }
  }

  for (let t = 0; t < gridSize; t++) {
    const rate = tranTotal[t] > 0 ? transition[t] / tranTotal[t] : 0.5;
    scores[t] = 1 - rate;
  }
  return scores;
}

// 7. Entropy Analysis
function algoEntropy(games, gridSize) {
  const scores = new Array(gridSize).fill(0.5);
  if (games.length < 5) return scores;

  for (let t = 0; t < gridSize; t++) {
    // Calculate hit probability over sliding windows
    const windows = [5, 10, 20];
    let entropySum = 0;
    for (const w of windows) {
      const slice = games.slice(-Math.min(w, games.length));
      let hits = 0;
      for (const g of slice) if (g.locs && g.locs.includes(t)) hits++;
      const p = hits / slice.length;
      if (p > 0 && p < 1) {
        entropySum += -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p));
      }
    }
    // High entropy = unpredictable = slightly penalize
    // Low entropy with low hit rate = very safe
    const avgEntropy = entropySum / windows.length;
    const hitRate = games.reduce((acc, g) => acc + (g.locs && g.locs.includes(t) ? 1 : 0), 0) / games.length;
    scores[t] = (1 - hitRate) * (1 - avgEntropy * 0.3);
  }
  return scores;
}

// 8. Monte Carlo Simulation
function algoMonteCarlo(games, gridSize, mineCount) {
  const scores = new Array(gridSize).fill(0);
  const SIMS = 500;

  // Build probability distribution from history
  const hitProbs = new Array(gridSize).fill(0);
  for (let t = 0; t < gridSize; t++) {
    let hits = 0;
    for (const g of games) if (g.locs && g.locs.includes(t)) hits++;
    hitProbs[t] = games.length > 0 ? hits / games.length : mineCount / gridSize;
  }

  // Run simulations
  for (let s = 0; s < SIMS; s++) {
    // Place mines probabilistically
    const placed = new Set();
    const candidates = Array.from({ length: gridSize }, (_, i) => i);
    // Weighted random selection
    for (let m = 0; m < mineCount && candidates.length > 0; m++) {
      let totalW = 0;
      for (const c of candidates) totalW += hitProbs[c] + 0.01;
      let r = Math.random() * totalW;
      for (let ci = 0; ci < candidates.length; ci++) {
        r -= hitProbs[candidates[ci]] + 0.01;
        if (r <= 0) {
          placed.add(candidates[ci]);
          candidates.splice(ci, 1);
          break;
        }
      }
    }
    // Score: tiles NOT in placed set get +1
    for (let t = 0; t < gridSize; t++) {
      if (!placed.has(t)) scores[t]++;
    }
  }

  // Normalize
  for (let t = 0; t < gridSize; t++) scores[t] /= SIMS;
  return scores;
}

// 9. Anti-Cluster (mines tend to spread)
function algoAntiCluster(games, gridSize) {
  const side = Math.sqrt(gridSize);
  const scores = new Array(gridSize).fill(0.5);
  if (games.length === 0) return scores;

  // Calculate mine density per region (quadrants)
  const quadSize = Math.ceil(side / 2);
  const regionDensity = {};

  for (const g of games) {
    if (!g.locs) continue;
    for (const loc of g.locs) {
      const qr = Math.floor(Math.floor(loc / side) / quadSize);
      const qc = Math.floor((loc % side) / quadSize);
      const key = qr + ',' + qc;
      regionDensity[key] = (regionDensity[key] || 0) + 1;
    }
  }

  for (let t = 0; t < gridSize; t++) {
    const row = Math.floor(t / side), col = t % side;
    const qr = Math.floor(row / quadSize), qc = Math.floor(col / quadSize);
    const key = qr + ',' + qc;
    const density = regionDensity[key] || 0;
    const maxDensity = Object.values(regionDensity).reduce((a, b) => Math.max(a, b), 1);
    scores[t] = 1 - (density / maxDensity) * 0.5;
  }
  return scores;
}

// 10. Hash Entropy Analysis
function algoHashEntropy(serverHash, gridSize) {
  const scores = new Array(gridSize).fill(0.5);
  if (!serverHash) return scores;

  // Extract entropy from serverhash bytes for tile bias hints
  for (let t = 0; t < gridSize; t++) {
    const byteIdx = t % (serverHash.length / 2);
    const byteVal = parseInt(serverHash.substr(byteIdx * 2, 2), 16);
    scores[t] = 0.3 + (byteVal / 255) * 0.4; // Slight bias from hash entropy
  }
  return scores;
}

// ─────────────────────────────────────────
// MASTER ENSEMBLE PREDICTION
// ─────────────────────────────────────────

const forest = new MiniForest();
let forestTrained = false;

function trainForest(games, gridSize) {
  if (games.length < 10) return;
  const X = [], y = [];
  for (let i = 5; i < games.length; i++) {
    const history = games.slice(0, i);
    const mineSet = new Set(games[i].locs || []);
    for (let t = 0; t < gridSize; t++) {
      const feat = extractFeatures(history, t, gridSize);
      if (!feat) continue;
      X.push(feat);
      y.push(mineSet.has(t) ? 1 : 0);
    }
  }
  if (X.length > 50) {
    forest.train(X, y, 25);
    forestTrained = true;
  }
}

function predictMines(games, mineCount, gridSize, opened, serverHash, tileCount) {
  const side = Math.sqrt(gridSize);
  const openedSet = new Set(opened || []);

  // Train forest if we have enough data
  if (games.length >= 10 && !forestTrained) {
    trainForest(games, gridSize);
  }

  // Run all ensemble algorithms
  const algoWeights = [
    { name: 'frequency',    fn: () => algoFrequency(games, gridSize),               w: 2.0 },
    { name: 'recency',      fn: () => algoRecency(games, gridSize),                 w: 1.8 },
    { name: 'hotcold',      fn: () => algoHotCold(games, gridSize),                 w: 1.5 },
    { name: 'spatial',      fn: () => algoSpatial(games, gridSize),                 w: 1.3 },
    { name: 'bayesian',     fn: () => algoBayesian(games, gridSize, mineCount),      w: 2.2 },
    { name: 'ngram',        fn: () => algoNGram(games, gridSize),                   w: 1.6 },
    { name: 'entropy',      fn: () => algoEntropy(games, gridSize),                 w: 1.4 },
    { name: 'montecarlo',   fn: () => algoMonteCarlo(games, gridSize, mineCount),    w: 2.5 },
    { name: 'anticluster',  fn: () => algoAntiCluster(games, gridSize),             w: 1.2 },
    { name: 'hashentropy',  fn: () => algoHashEntropy(serverHash, gridSize),         w: 0.8 },
  ];

  // Aggregate scores
  const finalScores = new Array(gridSize).fill(0);
  let totalWeight = 0;

  for (const algo of algoWeights) {
    const scores = algo.fn();
    for (let t = 0; t < gridSize; t++) {
      finalScores[t] += scores[t] * algo.w;
    }
    totalWeight += algo.w;
  }

  // XGBoost overlay
  if (forestTrained && games.length >= 5) {
    const xgbWeight = 3.0;
    for (let t = 0; t < gridSize; t++) {
      const feat = extractFeatures(games, t, gridSize);
      if (feat) {
        const dangerProb = forest.predict(feat);
        finalScores[t] += (1 - dangerProb) * xgbWeight;
      }
    }
    totalWeight += xgbWeight;
  }

  // Normalize
  for (let t = 0; t < gridSize; t++) {
    finalScores[t] /= totalWeight;
  }

  // Zero out opened tiles so they are never picked
  for (const o of openedSet) {
    finalScores[o] = -1;
  }

  // Select top N safest tiles
  const candidates = [];
  for (let t = 0; t < gridSize; t++) {
    if (finalScores[t] < 0) continue;
    candidates.push({ tile: t, safety: finalScores[t] });
  }
  candidates.sort((a, b) => b.safety - a.safety);

  const picks = candidates.slice(0, tileCount || 3).map(c => ({
    tile: c.tile,
    row: Math.floor(c.tile / side),
    col: c.tile % side,
    danger: parseFloat((1 - c.safety).toFixed(4)),
    safety: parseFloat(c.safety.toFixed(4))
  }));

  // Identify danger tiles (bottom 25% by safety)
  const dangerThreshold = candidates.length > 4
    ? candidates[Math.floor(candidates.length * 0.75)].safety
    : 0.3;
  const dangerTiles = candidates
    .filter(c => c.safety <= dangerThreshold)
    .map(c => c.tile);

  // Build allScores map
  const allScores = {};
  for (let t = 0; t < gridSize; t++) {
    allScores[t] = Math.max(0, finalScores[t]);
  }

  // Confidence calculation
  const avgSafety = picks.reduce((s, p) => s + p.safety, 0) / (picks.length || 1);
  const confidence = Math.round(Math.min(98, Math.max(35, avgSafety * 100 + games.length * 0.3)));

  // Kelly Criterion
  const p = avgSafety;
  const q = 1 - p;
  const b = (gridSize - mineCount) / mineCount; // approximate odds
  const kellyFrac = (b * p - q) / b;
  const kelly = kellyFrac > 0.02
    ? { action: 'BET', pct: (kellyFrac * 100).toFixed(1) + '%' }
    : { action: 'SKIP', pct: '0%' };

  return {
    picks,
    dangerTiles,
    allScores,
    confidence,
    kelly,
    algorithm: 'bg-mines-ensemble-v1',
    gridSize,
    mineCount
  };
}

module.exports = { predictMines, trainForest };
