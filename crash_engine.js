// ═══════════════════════════════════════════════════════════════
// BLOXGAME CRASH ENGINE — Historical Crash Point Analyzer
// Detects patterns in crash point history to predict safe exits
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// STATISTICAL CORE
// ─────────────────────────────────────────

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length || 1));
}

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ─────────────────────────────────────────
// PATTERN ANALYSIS
// ─────────────────────────────────────────

// 1. Streak Detection: Count consecutive low/high crashes
function analyzeStreaks(history) {
  const crashes = history.map(h => h.crashPoint);
  let lowStreak = 0;  // consecutive below 2x
  let highStreak = 0; // consecutive above 2x

  for (let i = crashes.length - 1; i >= 0; i--) {
    if (crashes[i] < 2.0) {
      if (highStreak > 0) break;
      lowStreak++;
    } else {
      if (lowStreak > 0) break;
      highStreak++;
    }
  }

  return { lowStreak, highStreak };
}

// 2. Distribution Buckets
function buildDistribution(history) {
  const crashes = history.map(h => h.crashPoint);
  const buckets = {
    instant: 0,   // 1.00 - 1.05
    low: 0,       // 1.05 - 1.50
    medium: 0,    // 1.50 - 3.00
    high: 0,      // 3.00 - 10.00
    moon: 0       // 10.00+
  };

  for (const c of crashes) {
    if (c <= 1.05) buckets.instant++;
    else if (c <= 1.50) buckets.low++;
    else if (c <= 3.00) buckets.medium++;
    else if (c <= 10.00) buckets.high++;
    else buckets.moon++;
  }

  const n = crashes.length || 1;
  return {
    instant: buckets.instant / n,
    low: buckets.low / n,
    medium: buckets.medium / n,
    high: buckets.high / n,
    moon: buckets.moon / n
  };
}

// 3. Moving Average Analysis
function movingAverage(crashes, window) {
  if (crashes.length < window) return crashes.length > 0 ? mean(crashes) : 2.0;
  return mean(crashes.slice(-window));
}

// 4. Volatility Index
function volatilityIndex(history) {
  const crashes = history.map(h => h.crashPoint);
  if (crashes.length < 5) return 0.5;

  const sd = stddev(crashes.slice(-20));
  const m = mean(crashes.slice(-20));
  return m > 0 ? sd / m : 0.5; // Coefficient of variation
}

// ─────────────────────────────────────────
// MASTER CRASH PREDICTION
// ─────────────────────────────────────────

function predictCrash(history) {
  if (!history || history.length < 5) {
    return {
      safeCashout: 1.5,
      riskLevel: 'unknown',
      confidence: 30,
      analysis: { message: 'Not enough history for prediction' },
      algorithm: 'bg-crash-v1'
    };
  }

  const crashes = history.map(h => h.crashPoint);
  const recentCrashes = crashes.slice(-10);
  const { lowStreak, highStreak } = analyzeStreaks(history);
  const dist = buildDistribution(history);
  const vol = volatilityIndex(history);

  // Moving averages
  const ma5 = movingAverage(crashes, 5);
  const ma10 = movingAverage(crashes, 10);
  const ma20 = movingAverage(crashes, 20);

  // Statistical metrics
  const recentMean = mean(recentCrashes);
  const recentMedian = median(recentCrashes);
  const globalMean = mean(crashes);
  const globalMedian = median(crashes);

  // ─── Decision Logic ───

  let safeCashout = 1.5;
  let riskLevel = 'medium';
  let confidence = 50;

  // After multiple low crashes, odds of a higher one increase (gambler's regression)
  if (lowStreak >= 4) {
    safeCashout = 2.0;
    riskLevel = 'moderate';
    confidence = 65;
  }
  if (lowStreak >= 6) {
    safeCashout = 2.5;
    riskLevel = 'favorable';
    confidence = 72;
  }

  // After multiple high crashes, risk of a low one increases
  if (highStreak >= 3) {
    safeCashout = 1.3;
    riskLevel = 'caution';
    confidence = 55;
  }
  if (highStreak >= 5) {
    safeCashout = 1.15;
    riskLevel = 'danger';
    confidence = 40;
  }

  // Moving average crossover: short MA < long MA = bearish
  if (ma5 < ma20 * 0.8) {
    safeCashout = Math.min(safeCashout, 1.4);
    riskLevel = 'bearish';
    confidence = Math.max(confidence - 10, 30);
  }

  // High volatility = reduce target
  if (vol > 1.5) {
    safeCashout *= 0.85;
    confidence = Math.max(confidence - 15, 25);
  }

  // If instant crashes dominate (>25%), be very cautious
  if (dist.instant > 0.25) {
    safeCashout = Math.min(safeCashout, 1.2);
    riskLevel = 'critical';
    confidence = 35;
  }

  // Moon opportunity detection
  if (dist.moon > 0.1 && lowStreak >= 3) {
    // There's a pattern of moon shots after low sequences
    riskLevel = 'moon-window';
    confidence = Math.min(confidence + 10, 80);
  }

  safeCashout = parseFloat(Math.max(1.1, safeCashout).toFixed(2));

  return {
    safeCashout,
    riskLevel,
    confidence,
    analysis: {
      recentMean: parseFloat(recentMean.toFixed(2)),
      recentMedian: parseFloat(recentMedian.toFixed(2)),
      globalMean: parseFloat(globalMean.toFixed(2)),
      globalMedian: parseFloat(globalMedian.toFixed(2)),
      ma5: parseFloat(ma5.toFixed(2)),
      ma10: parseFloat(ma10.toFixed(2)),
      ma20: parseFloat(ma20.toFixed(2)),
      volatility: parseFloat(vol.toFixed(3)),
      distribution: dist,
      lowStreak,
      highStreak,
      totalGames: crashes.length
    },
    algorithm: 'bg-crash-ensemble-v1'
  };
}

module.exports = { predictCrash };
