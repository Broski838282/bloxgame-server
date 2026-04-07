// ═══════════════════════════════════════════════════════════════
// BLOXGAME TOWERS ENGINE — 8-Level Tower Predictor
// Structure: 8 rows × 3 columns, 1 mine per row (easy)
// towerLevels[row] = [1,0,0] means col 0 is the mine
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// COLUMN FREQUENCY TRACKER
// Tracks which column has been the mine for each level
// ─────────────────────────────────────────

function buildColumnStats(games) {
  // stats[level][col] = number of times col was the mine at that level
  const stats = [];
  for (let lvl = 0; lvl < 8; lvl++) {
    stats[lvl] = [0, 0, 0];
  }
  let counted = 0;

  for (const g of games) {
    if (!g.towerLevels || g.towerLevels.length < 8) continue;
    counted++;
    for (let lvl = 0; lvl < 8; lvl++) {
      const row = g.towerLevels[lvl];
      for (let c = 0; c < 3; c++) {
        if (row[c] === 1) stats[lvl][c]++;
      }
    }
  }

  return { stats, counted };
}

// ─────────────────────────────────────────
// ENSEMBLE ALGORITHMS
// ─────────────────────────────────────────

// 1. Frequency: safest column per level
function algoFrequency(stats, counted) {
  const result = [];
  for (let lvl = 0; lvl < 8; lvl++) {
    const cols = stats[lvl];
    const scores = cols.map(c => counted > 0 ? 1 - (c / counted) : 0.67);
    result.push(scores);
  }
  return result;
}

// 2. Recency Weighted
function algoRecency(games) {
  const result = [];
  for (let lvl = 0; lvl < 8; lvl++) {
    const colScores = [0, 0, 0];
    let totalWeight = 0;
    const n = games.length;
    for (let i = 0; i < n; i++) {
      if (!games[i].towerLevels || games[i].towerLevels.length < 8) continue;
      const w = (i + 1) / n;
      totalWeight += w;
      const row = games[i].towerLevels[lvl];
      for (let c = 0; c < 3; c++) {
        if (row[c] === 1) colScores[c] += w;
      }
    }
    const scores = colScores.map(s => totalWeight > 0 ? 1 - (s / totalWeight) : 0.67);
    result.push(scores);
  }
  return result;
}

// 3. Streak Analysis
function algoStreak(games) {
  const result = [];
  for (let lvl = 0; lvl < 8; lvl++) {
    const colStreaks = [0, 0, 0];
    for (let i = games.length - 1; i >= 0; i--) {
      if (!games[i].towerLevels || games[i].towerLevels.length < 8) continue;
      const row = games[i].towerLevels[lvl];
      let foundMine = -1;
      for (let c = 0; c < 3; c++) {
        if (row[c] === 1) foundMine = c;
      }
      if (foundMine >= 0) colStreaks[foundMine]++;
      break; // Only check last game for streak start
    }
    // Penalize the column that was recently mined
    const scores = [0.67, 0.67, 0.67];
    for (let c = 0; c < 3; c++) {
      scores[c] = Math.max(0.1, 0.67 - colStreaks[c] * 0.2);
    }
    result.push(scores);
  }
  return result;
}

// 4. Cross-Level Pattern
function algoCrossLevel(games) {
  const result = [];
  for (let lvl = 0; lvl < 8; lvl++) {
    const scores = [0.5, 0.5, 0.5];
    if (games.length < 3) { result.push(scores); continue; }

    // Check if there's a pattern where mines at level N correlate with level N+1
    const prevLvl = lvl > 0 ? lvl - 1 : 7;
    let transitions = { '0->0': 0, '0->1': 0, '0->2': 0, '1->0': 0, '1->1': 0, '1->2': 0, '2->0': 0, '2->1': 0, '2->2': 0 };
    let total = 0;

    for (const g of games) {
      if (!g.towerLevels || g.towerLevels.length < 8) continue;
      const prevRow = g.towerLevels[prevLvl];
      const currRow = g.towerLevels[lvl];
      let prevMine = -1, currMine = -1;
      for (let c = 0; c < 3; c++) {
        if (prevRow[c] === 1) prevMine = c;
        if (currRow[c] === 1) currMine = c;
      }
      if (prevMine >= 0 && currMine >= 0) {
        transitions[prevMine + '->' + currMine]++;
        total++;
      }
    }

    // Given where the mine was on the previous level in the last game
    if (games.length > 0 && games[games.length - 1].towerLevels) {
      const lastPrevRow = games[games.length - 1].towerLevels[prevLvl];
      let lastPrevMine = 0;
      for (let c = 0; c < 3; c++) {
        if (lastPrevRow[c] === 1) lastPrevMine = c;
      }
      for (let c = 0; c < 3; c++) {
        const key = lastPrevMine + '->' + c;
        const prob = total > 0 ? transitions[key] / total : 0.33;
        scores[c] = 1 - prob;
      }
    }

    result.push(scores);
  }
  return result;
}

// 5. Monte Carlo Tower Simulation
function algoMonteCarlo(games) {
  const SIMS = 300;
  const result = [];

  // Build per-level column probabilities from history
  const probs = [];
  for (let lvl = 0; lvl < 8; lvl++) {
    const colCounts = [0, 0, 0];
    let total = 0;
    for (const g of games) {
      if (!g.towerLevels || g.towerLevels.length < 8) continue;
      total++;
      const row = g.towerLevels[lvl];
      for (let c = 0; c < 3; c++) {
        if (row[c] === 1) colCounts[c]++;
      }
    }
    probs.push(colCounts.map(c => total > 0 ? c / total : 0.33));
  }

  for (let lvl = 0; lvl < 8; lvl++) {
    const safeCounts = [0, 0, 0];
    for (let s = 0; s < SIMS; s++) {
      // Weighted random mine placement
      const r = Math.random();
      let mineCol = 0;
      let cumulative = 0;
      for (let c = 0; c < 3; c++) {
        cumulative += probs[lvl][c];
        if (r <= cumulative) { mineCol = c; break; }
      }
      // Safe columns get +1
      for (let c = 0; c < 3; c++) {
        if (c !== mineCol) safeCounts[c]++;
      }
    }
    result.push(safeCounts.map(s => s / SIMS));
  }
  return result;
}

// ─────────────────────────────────────────
// MASTER TOWER PREDICTION
// ─────────────────────────────────────────

function predictTowers(games, completedLevels, difficulty) {
  const { stats, counted } = buildColumnStats(games);

  const weights = {
    frequency: 2.0,
    recency: 1.8,
    streak: 1.3,
    crossLevel: 1.5,
    montecarlo: 2.5
  };

  const freqResult = algoFrequency(stats, counted);
  const recencyResult = algoRecency(games);
  const streakResult = algoStreak(games);
  const crossResult = algoCrossLevel(games);
  const mcResult = algoMonteCarlo(games);

  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  // Build predictions for each level
  const predictions = [];
  for (let lvl = 0; lvl < 8; lvl++) {
    const colScores = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      colScores[c] += freqResult[lvl][c] * weights.frequency;
      colScores[c] += recencyResult[lvl][c] * weights.recency;
      colScores[c] += streakResult[lvl][c] * weights.streak;
      colScores[c] += crossResult[lvl][c] * weights.crossLevel;
      colScores[c] += mcResult[lvl][c] * weights.montecarlo;
      colScores[c] /= totalWeight;
    }

    // Pick safest column
    let bestCol = 0, bestScore = -1;
    for (let c = 0; c < 3; c++) {
      if (colScores[c] > bestScore) {
        bestScore = colScores[c];
        bestCol = c;
      }
    }

    const alreadyCompleted = completedLevels && completedLevels.includes(lvl);

    predictions.push({
      level: lvl,
      safestCol: bestCol,
      colScores: colScores.map(s => parseFloat(s.toFixed(4))),
      confidence: Math.round(bestScore * 100),
      completed: !!alreadyCompleted
    });
  }

  // Overall confidence
  const nextLevel = (completedLevels || []).length;
  const nextPred = predictions[nextLevel] || predictions[0];
  const overallConfidence = Math.round(
    predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length
  );

  return {
    predictions,
    nextLevel,
    nextPick: nextPred.safestCol,
    confidence: overallConfidence,
    algorithm: 'bg-towers-ensemble-v1',
    difficulty: difficulty || 'easy'
  };
}

module.exports = { predictTowers };
