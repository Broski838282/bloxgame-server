// ==UserScript==
// @name         BloxGame Supreme Predictor
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  ML-Powered Mines & Towers Predictor for BloxGame.com
// @author       Supreme Engine
// @match        https://bloxgame.com/*
// @match        https://www.bloxgame.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    var SERVER_URL = 'https://bloxgame-server-production.up.railway.app';
    var GRID = 16; // default 4x4
    var panelVisible = false;
    var predictionActive = false;
    var activeTab = 'mines';
    var isDragging = false, dragOX = 0, dragOY = 0;
    var minesHistory = [];
    var towersHistory = [];
    var _audioCtx = null;

    // ═══ STYLES ═══
    GM_addStyle(`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

.bg-panel{position:fixed;top:80px;left:20px;width:320px;background:rgba(8,8,12,0.92);border:1px solid rgba(255,255,255,0.08);font-family:'Inter',sans-serif;color:#fff;z-index:100000;transition:all 0.35s cubic-bezier(0.22,1,0.36,1);opacity:0;pointer-events:none;transform:translateY(10px) scale(0.97);border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.5);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);overflow:hidden}
.bg-panel.bg-visible{opacity:1;pointer-events:auto;transform:translateY(0) scale(1)}
.bg-panel *{box-sizing:border-box}

.bg-header{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 12px;cursor:move;user-select:none;border-bottom:1px solid rgba(255,255,255,0.06)}
.bg-header-left{display:flex;align-items:center;gap:10px}
.bg-logo{font-size:16px;font-weight:800;letter-spacing:-0.5px;background:linear-gradient(135deg,#a78bfa,#818cf8,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.bg-dot{width:7px;height:7px;border-radius:50%;background:#555;transition:all 0.3s}
.bg-dot.bg-active{background:#4ade80;box-shadow:0 0 8px rgba(74,222,128,0.6)}
.bg-close{width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,0.05);border:none;color:#888;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s}
.bg-close:hover{background:rgba(255,255,255,0.15);color:#fff}

.bg-body{padding:14px 18px 18px;max-height:520px;overflow-y:auto}
.bg-body::-webkit-scrollbar{width:4px}
.bg-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:4px}

.bg-tabs{display:flex;gap:4px;margin-bottom:14px;background:rgba(0,0,0,0.3);padding:4px;border-radius:12px}
.bg-tab{flex:1;text-align:center;font-size:10px;font-weight:600;color:#777;cursor:pointer;padding:8px 0;transition:all 0.2s;text-transform:uppercase;letter-spacing:0.5px;border-radius:8px}
.bg-tab:hover{color:#ccc}
.bg-tab.bg-active{color:#000;background:linear-gradient(135deg,#a78bfa,#818cf8);box-shadow:0 2px 8px rgba(99,102,241,0.3)}
.bg-tab-content{display:none}
.bg-tab-content.bg-active-tab{display:block}

.bg-label{font-size:10px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}

.bg-grid-selector{display:flex;gap:6px;margin-bottom:12px;align-items:center}
.bg-grid-selector label{font-size:11px;color:#aaa;font-weight:500}
.bg-grid-selector select{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#fff;font-family:'Inter',sans-serif;font-size:12px;padding:6px 10px;border-radius:8px;outline:none;cursor:pointer}
.bg-grid-selector select option{background:#111;color:#fff}

.bg-tile-selector{display:flex;gap:6px;align-items:center;margin-bottom:12px}
.bg-tile-selector label{font-size:11px;color:#aaa;font-weight:500}
.bg-tile-btn{width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#aaa;font-size:12px;font-weight:700;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center}
.bg-tile-btn.bg-selected{background:linear-gradient(135deg,#a78bfa,#6366f1);color:#fff;border-color:rgba(99,102,241,0.5);box-shadow:0 0 10px rgba(99,102,241,0.3)}

.bg-predict-btn{width:100%;padding:12px;background:linear-gradient(135deg,#a78bfa,#818cf8,#6366f1);border:none;color:#fff;font-family:'Inter',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all 0.2s;border-radius:12px;text-transform:uppercase;letter-spacing:1px}
.bg-predict-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(99,102,241,0.4)}
.bg-predict-btn:active{transform:translateY(0)}
.bg-predict-btn.bg-loading{opacity:0.7;pointer-events:none}

.bg-confidence{margin-top:8px;height:4px;background:rgba(255,255,255,0.05);border-radius:4px;overflow:hidden;display:none}
.bg-confidence-bar{height:100%;background:linear-gradient(90deg,#a78bfa,#6366f1);width:0%;transition:width 0.4s cubic-bezier(0.22,1,0.36,1);border-radius:4px}

.bg-result{margin-top:10px;padding:10px;font-size:12px;font-weight:600;text-align:center;letter-spacing:0.5px;border-radius:10px;opacity:0;transition:opacity 0.3s}
.bg-result.bg-visible{opacity:1}
.bg-result.bg-success{background:rgba(99,102,241,0.15);color:#a78bfa}
.bg-result.bg-warn{background:rgba(255,200,50,0.1);color:#fbbf24}
.bg-result.bg-error{background:rgba(239,68,68,0.1);color:#ef4444}

.bg-safe-grid{margin-top:10px;display:grid;gap:3px}
.bg-safe-cell{padding:5px 0;text-align:center;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:6px;line-height:1.2;transition:all 0.2s}
.bg-safe-cell .bg-cell-idx{font-size:9px;font-weight:700;margin-bottom:1px;color:#fff}
.bg-safe-cell .bg-cell-pct{font-size:8px;color:#888}
.bg-safe-cell.bg-rank-top{background:rgba(99,102,241,0.2);border-color:rgba(99,102,241,0.4)}
.bg-safe-cell.bg-rank-good{background:rgba(99,102,241,0.1);border-color:rgba(99,102,241,0.2)}
.bg-safe-cell.bg-rank-mid{opacity:0.6}
.bg-safe-cell.bg-rank-bad{opacity:0.3}
.bg-safe-cell.bg-rank-opened{background:rgba(74,222,128,0.15);border-color:rgba(74,222,128,0.3)}

.bg-tower-grid{margin-top:10px}
.bg-tower-row{display:grid;grid-template-columns:30px repeat(3,1fr);gap:3px;margin-bottom:3px;align-items:center}
.bg-tower-label{font-size:9px;color:#777;font-weight:600;text-align:center}
.bg-tower-cell{padding:8px 0;text-align:center;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:6px;font-size:10px;font-weight:600;color:#aaa;transition:all 0.2s}
.bg-tower-cell.bg-safest{background:rgba(74,222,128,0.15);border-color:rgba(74,222,128,0.4);color:#4ade80}
.bg-tower-cell.bg-danger{background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.2);color:#ef4444}
.bg-tower-cell.bg-completed{background:rgba(99,102,241,0.2);border-color:rgba(99,102,241,0.3);color:#818cf8}

.bg-crash-display{margin-top:10px;text-align:center}
.bg-crash-target{font-size:32px;font-weight:800;letter-spacing:-1px;margin:8px 0}
.bg-crash-target.bg-favorable{color:#4ade80}
.bg-crash-target.bg-caution{color:#fbbf24}
.bg-crash-target.bg-danger{color:#ef4444}
.bg-crash-risk{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:8px}
.bg-crash-stats{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}
.bg-crash-stat{background:rgba(255,255,255,0.03);border-radius:8px;padding:8px;text-align:center}
.bg-crash-stat .bg-stat-label{font-size:9px;color:#777;margin-bottom:2px}
.bg-crash-stat .bg-stat-value{font-size:13px;font-weight:700;color:#ddd}

.bg-log{margin-top:8px;max-height:70px;overflow-y:auto;font-size:10px;color:#777;line-height:1.6}
.bg-log::-webkit-scrollbar{width:3px}
.bg-log::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:3px}

.bg-toggle{position:fixed;bottom:20px;left:20px;width:44px;height:44px;background:linear-gradient(135deg,#a78bfa,#6366f1);border:none;color:#fff;font-size:18px;cursor:pointer;z-index:100001;display:flex;align-items:center;justify-content:center;opacity:0;border-radius:50%;box-shadow:0 4px 20px rgba(99,102,241,0.4);transition:all 0.2s}
.bg-toggle.bg-visible{opacity:1}
.bg-toggle:hover{transform:scale(1.1);box-shadow:0 6px 30px rgba(99,102,241,0.6)}

.bg-dots span{display:inline-block;animation:bg-dot-bounce 1.4s infinite both}
.bg-dots span:nth-child(1){animation-delay:0s}
.bg-dots span:nth-child(2){animation-delay:0.2s}
.bg-dots span:nth-child(3){animation-delay:0.4s}
@keyframes bg-dot-bounce{0%,80%,100%{opacity:0.3}40%{opacity:1}}
    `);

    // ═══ UTILITY FUNCTIONS ═══

    function log(msg) {
        var el = document.getElementById('bg-log');
        if (!el) return;
        var now = new Date();
        var ts = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0') + ':' + now.getSeconds().toString().padStart(2, '0');
        el.innerHTML = '<div>[' + ts + '] ' + msg + '</div>' + el.innerHTML;
        if (el.children.length > 50) el.removeChild(el.lastChild);
    }

    function playSound(type) {
        try {
            if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (_audioCtx.state === 'suspended') _audioCtx.resume();
            var ctx = _audioCtx, now = ctx.currentTime;
            function voice(freq, oscType, attack, decay, vol, detune, delay) {
                var t0 = now + (delay || 0);
                var o = ctx.createOscillator(), g = ctx.createGain();
                o.type = oscType; o.frequency.setValueAtTime(freq, t0);
                if (detune) o.detune.setValueAtTime(detune, t0);
                g.gain.setValueAtTime(0.001, t0);
                g.gain.linearRampToValueAtTime(vol, t0 + attack);
                g.gain.exponentialRampToValueAtTime(0.001, t0 + attack + decay);
                o.connect(g); g.connect(ctx.destination);
                o.start(t0); o.stop(t0 + attack + decay + 0.05);
            }
            if (type === 'predict') {
                voice(523, 'sine', 0.01, 0.12, 0.15, 0, 0);
                voice(659, 'sine', 0.01, 0.12, 0.13, 3, 0.07);
                voice(784, 'sine', 0.01, 0.15, 0.14, -2, 0.14);
            } else if (type === 'safe') {
                voice(880, 'sine', 0.005, 0.08, 0.12, 0, 0);
                voice(1320, 'sine', 0.003, 0.06, 0.08, 0, 0.03);
            }
        } catch(e) {}
    }

    function serverFetch(method, path, body) {
        var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        return fetch(SERVER_URL + path, opts).then(function (r) { return r.json(); }).catch(function () { return { error: 'network error' }; });
    }

    // ═══ FETCH INTERCEPTOR ═══
    // Listens to BloxGame API calls to capture game state

    var _interceptedMinesGame = null;
    var _interceptedTowersGame = null;
    var _interceptedCrashData = null;

    function injectInterceptor() {
        var s = document.createElement('script');
        s.textContent = '(' + function () {
            if (window.__bg_bridge) return;
            window.__bg_bridge = true;
            var _ofetch = window.fetch;
            window.fetch = async function () {
                var res = await _ofetch.apply(this, arguments);
                try {
                    var url = arguments[0] || '';
                    if (typeof url === 'object' && url.url) url = url.url;
                    if (typeof url === 'string') {
                        // Mines create/action
                        if (url.indexOf('/games/mines/') !== -1) {
                            var clone = res.clone();
                            clone.json().then(function (d) {
                                window.postMessage({ type: '__bg_mines', data: d }, '*');
                            }).catch(function () { });
                        }
                        // Towers
                        if (url.indexOf('/games/towers') !== -1) {
                            var clone2 = res.clone();
                            clone2.json().then(function (d) {
                                window.postMessage({ type: '__bg_towers', data: d }, '*');
                            }).catch(function () { });
                        }
                        // Removed Crash
                        // Blackjack
                        if (url.indexOf('/games/blackjack') !== -1 || url.indexOf('blackjack') !== -1) {
                            var clone4 = res.clone();
                            clone4.json().then(function (d) {
                                window.postMessage({ type: '__bg_blackjack', data: d }, '*');
                            }).catch(function () { });
                        }
                    }
                } catch (e) { }
                return res;
            };
        } + ')();';
        document.documentElement.appendChild(s);
        s.remove();
    }

    window.addEventListener('message', function (e) {
        if (!e.data || !e.data.type) return;

        if (e.data.type === '__bg_mines') {
            var d = e.data.data;
            if (d && d.game) {
                _interceptedMinesGame = d.game;
                GRID = d.game.gridSize || 16;
                selectedGrid = GRID; 
                var sel = document.getElementById('bg-grid-select');
                if (sel) sel.value = GRID;
                log('mines game intercepted · grid autodetected: ' + GRID);

                // If game ended (has mineLocations), save to history
                if (d.game.mineLocations && d.game.active === false) {
                    minesHistory.push({
                        locs: d.game.mineLocations,
                        mc: d.game.minesAmount,
                        gridSize: d.game.gridSize
                    });
                    log('mines result saved · ' + minesHistory.length + ' games');
                    // Also send to server
                    serverFetch('POST', '/api/ingest', { type: 'mines', game: d.game });
                }
            } else if (d && d.success !== undefined && d.exploded !== undefined) {
                // Action response (tile click)
                if (d.exploded) {
                    log('💥 MINE HIT!');
                    if (d.game && d.game.mineLocations) {
                        minesHistory.push({
                            locs: d.game.mineLocations,
                            mc: d.game.minesAmount || _interceptedMinesGame?.minesAmount,
                            gridSize: d.game.gridSize || _interceptedMinesGame?.gridSize || 16
                        });
                        serverFetch('POST', '/api/ingest', { type: 'mines', game: d.game });
                    }
                } else {
                    log('✅ safe tile · mult=' + (d.multiplier || '?'));
                }
            }
        }

        if (e.data.type === '__bg_towers') {
            var d = e.data.data;
            if (d && d.game) {
                _interceptedTowersGame = d.game;
                log('towers game intercepted');
                if (d.game.towerLevels && d.game.active === false) {
                    towersHistory.push({
                        towerLevels: d.game.towerLevels,
                        difficulty: d.game.difficulty
                    });
                    log('towers result saved · ' + towersHistory.length + ' games');
                    serverFetch('POST', '/api/ingest', { type: 'towers', game: d.game });
                }
            }
        }

        if (e.data.type === '__bg_blackjack') {
            handleBlackjackData(e.data.data);
        }
    });

    // ═══ UNPACK MORPHED SERVER RESPONSE ═══

    function unpackMinesResponse(result) {
        try {
            if (Array.isArray(result) && result.length >= 8) {
                return {
                    picks: JSON.parse(atob(result[1])),
                    confidence: Math.floor(result[3] / 1.5),
                    algorithm: (function hex2a(h) { var s = ''; for (var i = 0; i < h.length; i += 2) s += String.fromCharCode(parseInt(h.substr(i, 2), 16)); return s; })(result[4]),
                    dangerTiles: Array.isArray(result[5]) ? result[5].map(function (t) { return t / 3; }) : [],
                    kelly: result[6],
                    allScores: result[7]
                };
            }
            return result; // Legacy fallback
        } catch (e) { return result; }
    }

    function unpackTowersResponse(result) {
        try {
            if (Array.isArray(result) && result.length >= 6) {
                return {
                    predictions: JSON.parse(atob(result[1])),
                    nextPick: result[2],
                    confidence: Math.floor(result[3] / 1.5),
                    algorithm: (function hex2a(h) { var s = ''; for (var i = 0; i < h.length; i += 2) s += String.fromCharCode(parseInt(h.substr(i, 2), 16)); return s; })(result[4]),
                    nextLevel: result[5],
                    difficulty: result[6]
                };
            }
            return result;
        } catch (e) { return result; }
    }

    // Crash unpacking removed

    // ═══ PREDICTION FUNCTIONS ═══

    var selectedTileCount = 3;
    var selectedGrid = 16; // 4x4 default
    var _lastMinesCache = { state: '', data: null };
    var _lastTowersCache = { state: '', data: null };

    async function runMinesPrediction() {
        var game = _interceptedMinesGame;
        
        // Physical Grid Detection fallback
        var physicalTiles = document.querySelectorAll("button[aria-label^='Open mine']").length;
        if (physicalTiles > 0) {
            selectedGrid = physicalTiles;
            GRID = selectedGrid;
            var sel = document.getElementById('bg-grid-select');
            if (sel) sel.value = selectedGrid;
        }

        // We removed the strict "!game || game.active === false" check here 
        // to allow predictions even if the page was refreshed mid-game!

        // Pre-Analysis Loading Sequences to give the UI visual weight
        var btn = document.getElementById('bg-predict-mines');
        btn.innerHTML = 'detecting seed<span class="bg-dots"><span>.</span><span>.</span><span>.</span></span>';
        btn.classList.add('bg-loading');
        playSound('predict');
        
        await new Promise(function(resolve) { setTimeout(resolve, 800); });
        
        btn.innerHTML = 'analyzing core pattern<span class="bg-dots"><span>.</span><span>.</span><span>.</span></span>';
        await new Promise(function(resolve) { setTimeout(resolve, 900); });
        
        var opened = [];
        var mc = 1, serverHash = '';

        if (game) {
            mc = game.minesAmount || 1;
            selectedGrid = game.gridSize || selectedGrid;
            opened = game.uncoveredLocations || [];
            serverHash = game.serverHash || '';
        }

        var stateStr = opened.join(',') + '_' + selectedGrid + '_' + mc + '_' + selectedTileCount;
        if (_lastMinesCache.state === stateStr && _lastMinesCache.data) {
            var data = _lastMinesCache.data;
            renderMinesSafeGrid(data.allScores || {}, opened, data.picks, selectedGrid);
            bindTileHovers(data.allScores || {}, data.picks, opened);
            var pickText = data.picks.map(function (p) { return '#' + p.tile; }).join(', ');
            showResult('mines', 'SAFE TILES: ' + pickText + ' · ' + (data.confidence || 50) + '%', 'success');
            return;
        }

        var result = await serverFetch('POST', '/api/predict/mines', {
            game: { mc: mc, gridSize: selectedGrid, opened: opened, serverHash: serverHash, tileCount: selectedTileCount },
            history: minesHistory
        });

        if (result.error) {
            showResult('mines', result.error, 'warn');
            btn.textContent = 'predict mines';
            btn.classList.remove('bg-loading');
            return;
        }

        var data = unpackMinesResponse(result);
        _lastMinesCache.state = stateStr;
        _lastMinesCache.data = data;

        var picks = data.picks || [];
        var confidence = data.confidence || 50;

        // Render confidence bar
        var confWrap = document.getElementById('bg-conf-mines');
        var confBar = document.getElementById('bg-conf-bar-mines');
        if (confWrap) {
            confWrap.style.display = 'block';
            setTimeout(function () { confBar.style.width = confidence + '%'; }, 30);
        }

        // Render safe grid inside UI
        renderMinesSafeGrid(data.allScores || {}, opened, picks, selectedGrid);

        // Highlight actual DOM tiles on screen
        bindTileHovers(data.allScores || {}, picks, opened);

        // Show result text
        var pickText = picks.map(function (p) { return '#' + p.tile; }).join(', ');
        showResult('mines', 'SAFE TILES: ' + pickText + ' · ' + confidence + '%', 'success');

        if (data.kelly && data.kelly.action === 'BET') {
            log('kelly: BET ' + data.kelly.pct);
        } else if (data.kelly) {
            log('kelly: SKIP');
        }

        btn.textContent = 'predict mines';
        btn.classList.remove('bg-loading');
        playSound('safe');
    }

    async function runTowersPrediction() {
        var game = _interceptedTowersGame;
        // Strict check removed to allow predictions on mid-game reload

        // Pre-Analysis Loading Sequences
        var btn = document.getElementById('bg-predict-towers');
        btn.innerHTML = 'comparing rng hash<span class="bg-dots"><span>.</span><span>.</span><span>.</span></span>';
        btn.classList.add('bg-loading');
        playSound('predict');

        await new Promise(function(resolve) { setTimeout(resolve, 800); });

        btn.innerHTML = 'simulating paths<span class="bg-dots"><span>.</span><span>.</span><span>.</span></span>';
        await new Promise(function(resolve) { setTimeout(resolve, 900); });

        var completedLevels = [];
        var difficulty = 'easy';

        if (game) {
            completedLevels = game.completedLevels || [];
            difficulty = game.difficulty || 'easy';
        }

        var stateStr = completedLevels.join(',') + '_' + difficulty;
        if (_lastTowersCache.state === stateStr && _lastTowersCache.data) {
            renderTowersGrid(_lastTowersCache.data.predictions || [], completedLevels);
            showResult('towers', 'NEXT: Column ' + (_lastTowersCache.data.nextPick + 1) + ' (Level ' + (_lastTowersCache.data.nextLevel + 1) + ') · ' + (_lastTowersCache.data.confidence || 50) + '%', 'success');
            return;
        }

        var result = await serverFetch('POST', '/api/predict/towers', {
            game: { completedLevels: completedLevels, difficulty: difficulty },
            history: towersHistory
        });

        if (result.error) {
            showResult('towers', result.error, 'warn');
            btn.textContent = 'predict towers';
            btn.classList.remove('bg-loading');
            return;
        }

        var data = unpackTowersResponse(result);
        _lastTowersCache.state = stateStr;
        _lastTowersCache.data = data;
        
        renderTowersGrid(data.predictions || [], completedLevels);

        var conf = data.confidence || 50;
        var confWrap = document.getElementById('bg-conf-towers');
        var confBar = document.getElementById('bg-conf-bar-towers');
        if (confWrap) {
            confWrap.style.display = 'block';
            setTimeout(function () { confBar.style.width = conf + '%'; }, 30);
        }

        showResult('towers', 'NEXT: Column ' + (data.nextPick + 1) + ' (Level ' + (data.nextLevel + 1) + ') · ' + conf + '%', 'success');

        btn.textContent = 'predict towers';
        btn.classList.remove('bg-loading');
        playSound('safe');
    }

    var _hoverHandlers = [];

    function bindTileHovers(allScores, picks, opened) {
        // Remove old binds
        _hoverHandlers.forEach(function (h) { 
            if (h.tile) {
                h.tile.style.border = '';
                h.tile.style.boxShadow = '';
                h.tile.style.transform = '';
            }
        });
        _hoverHandlers = [];

        var tiles = document.querySelectorAll("button[aria-label^='Open mine']");
        if (tiles.length < 4) return;
        
        var pickSet = {}; if (picks) for (var i = 0; i < picks.length; i++) pickSet[picks[i].tile] = true;
        var openSet = {}; if (opened) for (var j = 0; j < opened.length; j++) openSet[opened[j]] = true;
        
        for (var i = 0; i < tiles.length; i++) {
            var tile = tiles[i];
            if (openSet[i]) continue;
            
            var score = allScores[i] || 0.5, pct = Math.round(score * 100);
            
            // Apply Physical DOM Highlights!
            if (pickSet[i]) { 
                tile.style.border = "2px solid rgba(167, 139, 250, 0.9)";
                tile.style.boxShadow = "0 0 15px rgba(99, 102, 241, 0.6)";
                tile.style.transform = "scale(0.98)";
                _hoverHandlers.push({ tile: tile });
            } else if (pct >= 65) {
                tile.style.border = "1px solid rgba(74, 222, 128, 0.5)";
                tile.style.boxShadow = "0 0 8px rgba(74, 222, 128, 0.2)";
                _hoverHandlers.push({ tile: tile });
            }
        }
    }

    // crash removal

    // ═══ GRID RENDERERS ═══

    function renderMinesSafeGrid(allScores, opened, picks, gridSize) {
        var container = document.getElementById('bg-mines-grid');
        if (!container) return;
        var side = Math.round(Math.sqrt(gridSize));
        container.style.gridTemplateColumns = 'repeat(' + side + ', 1fr)';
        container.innerHTML = '';

        var pickSet = new Set(picks.map(function (p) { return p.tile; }));
        var openedSet = new Set(opened || []);

        // Get max/min for ranking
        var scores = [];
        for (var t = 0; t < gridSize; t++) {
            scores.push({ tile: t, score: allScores[t] || 0 });
        }
        scores.sort(function (a, b) { return b.score - a.score; });
        var topN = Math.ceil(gridSize * 0.2);

        for (var t = 0; t < gridSize; t++) {
            var cell = document.createElement('div');
            cell.className = 'bg-safe-cell';
            var score = allScores[t] || 0;
            var pct = Math.round(score * 100);

            if (openedSet.has(t)) {
                cell.classList.add('bg-rank-opened');
            } else if (pickSet.has(t)) {
                cell.classList.add('bg-rank-top');
            } else {
                var rank = scores.findIndex(function (s) { return s.tile === t; });
                if (rank < topN) cell.classList.add('bg-rank-good');
                else if (rank < gridSize * 0.5) cell.classList.add('bg-rank-mid');
                else cell.classList.add('bg-rank-bad');
            }

            cell.innerHTML = '<div class="bg-cell-idx">' + t + '</div><div class="bg-cell-pct">' + pct + '%</div>';
            container.appendChild(cell);
        }
    }

    function renderTowersGrid(predictions, completedLevels) {
        var container = document.getElementById('bg-towers-grid');
        if (!container) return;
        container.innerHTML = '';

        var completedSet = new Set(completedLevels || []);

        for (var lvl = 7; lvl >= 0; lvl--) {
            var row = document.createElement('div');
            row.className = 'bg-tower-row';

            var label = document.createElement('div');
            label.className = 'bg-tower-label';
            label.textContent = 'L' + (lvl + 1);
            row.appendChild(label);

            var pred = predictions[lvl];
            for (var c = 0; c < 3; c++) {
                var cell = document.createElement('div');
                cell.className = 'bg-tower-cell';

                if (completedSet.has(lvl)) {
                    cell.classList.add('bg-completed');
                    cell.textContent = '✓';
                } else if (pred && pred.safestCol === c) {
                    cell.classList.add('bg-safest');
                    cell.textContent = '★ ' + (pred.colScores ? Math.round(pred.colScores[c] * 100) + '%' : '');
                } else {
                    var score = pred && pred.colScores ? pred.colScores[c] : 0.33;
                    if (score < 0.4) cell.classList.add('bg-danger');
                    cell.textContent = Math.round(score * 100) + '%';
                }

                row.appendChild(cell);
            }

            container.appendChild(row);
        }
    }

    // crash display removed

    function showResult(tab, msg, type) {
        var el = document.getElementById('bg-result-' + tab);
        if (!el) return;
        el.className = 'bg-result bg-visible bg-' + type;
        el.textContent = msg;
    }

    // ═══ BLACKJACK EV ENGINE (LOCAL) ═══

    var _activeBjGame = null;
    var _lastBjState = '';
    var _bjIsCalculating = false;
    var _bjCalcTimeout = null;

    function handleBlackjackData(payload) {
        var game = payload.game || payload.state || payload;
        
        // Aggressively map alternate Bloxgame Blackjack schemas
        if (!game.dealer) game.dealer = {};
        if (!game.player) game.player = {};

        if (game.dealerCards) game.dealer = { hand: { cards: game.dealerCards } };
        else if (game.dealerHand) game.dealer = { hand: game.dealerHand };

        if (!game.dealer.hand && game.dealer.cards) game.dealer.hand = { cards: game.dealer.cards };

        if (game.playerCards) game.player = { hands: [{ cards: game.playerCards }] };
        else if (game.userCards) game.player = { hands: [{ cards: game.userCards }] };
        else if (game.playerHand) game.player = { hands: [game.playerHand] };
        
        if (game.player.hand && !game.player.hands) game.player.hands = [game.player.hand];
        if (game.player.hands && game.player.hands.length > 0) {
            game.player.hands.forEach(function(h) {
                 if(!h.cards && h.player_cards) h.cards = h.player_cards;
            });
        }

        // If the game ended or we missed data completely
        if (!game || !game.player || !game.player.hands || game.player.hands.length === 0) {
            _activeBjGame = null;
            updateBlackjackUI();
            return;
        }
        
        _activeBjGame = game;
        updateBlackjackUI();
    }

    function calculateHandValue(cards) {
        if (!cards) return 0;
        var total = 0, aces = 0;
        for (var i=0; i<cards.length; i++){
            // Depending on API, might need to check if card is visible
            if (cards[i].isFaceUp === false) continue;
            var v = cards[i].value;
            if (v === 'ACE') { aces++; total += 11; }
            else if (['KING','QUEEN','JACK','TEN'].indexOf(v) !== -1) total += 10;
            else if (v === 'NINE') total += 9;
            else if (v === 'EIGHT') total += 8;
            else if (v === 'SEVEN') total += 7;
            else if (v === 'SIX') total += 6;
            else if (v === 'FIVE') total += 5;
            else if (v === 'FOUR') total += 4;
            else if (v === 'THREE') total += 3;
            else if (v === 'TWO') total += 2;
        }
        while(total > 21 && aces > 0) { total -= 10; aces--; }
        return total;
    }

    function calculateBlackjackEV(hand, dealerCards) {
        if (!hand || !dealerCards || dealerCards.length === 0) return 'WAIT';
        var dCards = dealerCards.filter(function(c) { return c.isFaceUp !== false; });
        if (dCards.length === 0) return 'WAIT';
        
        function getV(c) {
            if (c.value === 'ACE') return 11;
            if (['KING','QUEEN','JACK','TEN'].indexOf(c.value) !== -1) return 10;
            var m = {'NINE':9,'EIGHT':8,'SEVEN':7,'SIX':6,'FIVE':5,'FOUR':4,'THREE':3,'TWO':2};
            return m[c.value] || 0;
        }
        
        var pTotal = calculateHandValue(hand.cards);
        var dUp = getV(dCards[0]);
        var possible = hand.possibleActions || ['HIT', 'STAND'];
        var canSplit = possible.indexOf('SPLIT') !== -1;
        var canDouble = possible.indexOf('DOUBLE') !== -1;
        
        var isSoft = false;
        var tempTotal = 0, tempAces = 0;
        for(var i=0; i<hand.cards.length; i++) { var v = getV(hand.cards[i]); if(v===11) tempAces++; tempTotal += v; }
        while(tempTotal > 21 && tempAces > 0) { tempTotal -= 10; tempAces--; }
        isSoft = (tempAces > 0);
        
        var isPair = hand.cards.length === 2 && getV(hand.cards[0]) === getV(hand.cards[1]);
        
        if (isPair && canSplit) {
            var v = getV(hand.cards[0]);
            if (v === 11 || v === 8) return 'SPLIT';
            if (v === 9 && dUp !== 7 && dUp !== 10 && dUp !== 11) return 'SPLIT';
            if (v === 7 && dUp >= 2 && dUp <= 7) return 'SPLIT';
            if (v === 6 && dUp >= 2 && dUp <= 6) return 'SPLIT';
            if (v === 4 && (dUp === 5 || dUp === 6)) return 'SPLIT';
            if ((v === 2 || v === 3) && dUp >= 2 && dUp <= 7) return 'SPLIT';
        }
        
        if (isSoft) {
            if (pTotal >= 19) return 'STAND';
            if (pTotal === 18) {
                if (dUp >= 3 && dUp <= 6) return canDouble ? 'DOUBLE' : 'HIT';
                if (dUp <= 8) return 'STAND';
                return 'HIT';
            }
            if (pTotal === 17) return (dUp >= 3 && dUp <= 6 && canDouble) ? 'DOUBLE' : 'HIT';
            if (pTotal >= 13 && pTotal <= 16) return (dUp >= 4 && dUp <= 6 && canDouble) ? 'DOUBLE' : 'HIT';
        }
        
        if (pTotal >= 17) return 'STAND';
        if (pTotal >= 13 && pTotal <= 16) return (dUp >= 2 && dUp <= 6) ? 'STAND' : 'HIT';
        if (pTotal === 12) return (dUp >= 4 && dUp <= 6) ? 'STAND' : 'HIT';
        if (pTotal === 11) return canDouble ? 'DOUBLE' : 'HIT';
        if (pTotal === 10) return (dUp >= 2 && dUp <= 9 && canDouble) ? 'DOUBLE' : 'HIT';
        if (pTotal === 9) return (dUp >= 3 && dUp <= 6 && canDouble) ? 'DOUBLE' : 'HIT';
        
        return 'HIT';
    }

    function updateBlackjackUI() {
        var elBest = document.getElementById('bg-bj-best-action');
        var elDlr = document.getElementById('bg-bj-dealer');
        var elPly = document.getElementById('bg-bj-player');
        var elSub = document.getElementById('bg-bj-subaction');
        if (!elBest) return;

        if (typeof _activeBjGame !== 'object' || !_activeBjGame) {
            elDlr.textContent = '0';
            elPly.textContent = '0';
            elBest.textContent = 'WAIT';
            elBest.style.background = 'rgba(255,255,255,0.4)'; elBest.style.webkitBackgroundClip = 'text'; elBest.style.webkitTextFillColor = 'transparent';
            elSub.textContent = 'Waiting for round to start...';
            return;
        }
        
        var dCards = _activeBjGame.dealer && _activeBjGame.dealer.hand && _activeBjGame.dealer.hand.cards ? _activeBjGame.dealer.hand.cards : [];
        var pHands = _activeBjGame.player && _activeBjGame.player.hands ? _activeBjGame.player.hands : [];
        var activeHand = null;
        for(var i=0; i<pHands.length; i++){
            if (pHands[i] && pHands[i].status !== 'STANDING' && pHands[i].status !== 'ENDED' && pHands[i].status !== 'LOSE' && pHands[i].status !== 'WIN' && pHands[i].status !== 'PUSH') {
                activeHand = pHands[i]; break;
            }
        }
        if (!activeHand && pHands.length > 0) activeHand = pHands[pHands.length-1] || null;

        var stateStr = '';
        if (_activeBjGame.isInsuranceOffered) stateStr = 'INS_' + _activeBjGame.id;
        else if (activeHand) stateStr = 'H' + activeHand.id + '_P' + activeHand.cards.length + '_D' + dCards.length;

        // Trigger computing delay only on first state discovery
        if (stateStr && stateStr !== _lastBjState) {
            _lastBjState = stateStr;
            _bjIsCalculating = true;
            clearTimeout(_bjCalcTimeout);
            
            _bjCalcTimeout = setTimeout(function() {
                _bjIsCalculating = false;
                updateBlackjackUI();
            }, 500 + Math.floor(Math.random() * 400));
        }

        // Always update text counters
        elDlr.textContent = calculateHandValue(dCards);
        if (activeHand) elPly.textContent = calculateHandValue(activeHand.cards);

        if (_bjIsCalculating) {
            elBest.innerHTML = 'COMPUTING<span class="bg-dots"><span>.</span><span>.</span><span>.</span></span>';
            elBest.style.background = 'linear-gradient(135deg, #9ca3af, #d1d5db)';
            elBest.style.webkitBackgroundClip = 'text'; elBest.style.webkitTextFillColor = 'transparent';
            elSub.textContent = 'Running EV Mathematics...';
            return;
        }

        if (_activeBjGame.isInsuranceOffered) {
            elBest.textContent = 'DECLINE INS.';
            elBest.style.background = 'linear-gradient(135deg,#f87171,#ef4444)';
            elBest.style.webkitBackgroundClip = 'text'; elBest.style.webkitTextFillColor = 'transparent';
            elSub.textContent = 'Basic Strategy: Never take insurance - EV';
            return;
        }
        
        if (activeHand) {
            var ba = calculateBlackjackEV(activeHand, dCards);
            if (ba && ba !== 'WAIT') {
                elBest.textContent = ba;
                if (ba === 'HIT') elBest.style.background = 'linear-gradient(135deg,#4ade80,#22c55e)';
                else if (ba === 'STAND') elBest.style.background = 'linear-gradient(135deg,#f87171,#ef4444)';
                else if (ba === 'DOUBLE') elBest.style.background = 'linear-gradient(135deg,#c084fc,#9333ea)';
                else if (ba === 'SPLIT') elBest.style.background = 'linear-gradient(135deg,#38bdf8,#0ea5e9)';
                else elBest.style.background = 'linear-gradient(135deg,#c49821,#f7d76a)';
                
                elBest.style.webkitBackgroundClip = 'text'; elBest.style.webkitTextFillColor = 'transparent';
                elSub.textContent = 'Optimal Expected Value Strategy';
                
                playSound('predict');
            } else {
                elBest.textContent = 'WAIT';
                elBest.style.background = 'rgba(255,255,255,0.4)'; elBest.style.webkitBackgroundClip = 'text'; elBest.style.webkitTextFillColor = 'transparent';
                elSub.textContent = 'Round ended or awaiting dealer...';
            }
        }
    }

    // ═══ BUILD UI ═══

    function buildPanel() {
        var panel = document.createElement('div');
        panel.id = 'bg-panel';
        panel.className = 'bg-panel';
        panel.innerHTML = '' +
            '<div class="bg-header" id="bg-header">' +
            '<div class="bg-header-left"><div class="bg-dot" id="bg-dot"></div><span class="bg-logo">BLOXGAME AI</span></div>' +
            '<button class="bg-close" id="bg-close">✕</button>' +
            '</div>' +
            '<div class="bg-body">' +

            '<div class="bg-tabs">' +
            '<div class="bg-tab bg-active" data-tab="mines">MINES</div>' +
            '<div class="bg-tab" data-tab="towers">TOWERS</div>' +
            '<div class="bg-tab" data-tab="bj">BJ</div>' +
            '</div>' +

            // ── MINES TAB ──
            '<div class="bg-tab-content bg-active-tab" id="bg-tab-mines">' +
            '<div class="bg-grid-selector"><label>Grid:</label><select id="bg-grid-select">' +
            '<option value="4">2×2</option><option value="9">3×3</option><option value="16" selected>4×4</option>' +
            '<option value="25">5×5</option><option value="36">6×6</option><option value="49">7×7</option>' +
            '<option value="64">8×8</option><option value="81">9×9</option><option value="100">10×10</option>' +
            '</select></div>' +
            '<div class="bg-tile-selector"><label>Tiles:</label>' +
            '<div class="bg-tile-btn" data-n="1">1</div><div class="bg-tile-btn" data-n="2">2</div>' +
            '<div class="bg-tile-btn bg-selected" data-n="3">3</div><div class="bg-tile-btn" data-n="4">4</div>' +
            '<div class="bg-tile-btn" data-n="5">5</div></div>' +
            '<button class="bg-predict-btn" id="bg-predict-mines">PREDICT MINES</button>' +
            '<div class="bg-confidence" id="bg-conf-mines"><div class="bg-confidence-bar" id="bg-conf-bar-mines"></div></div>' +
            '<div class="bg-result" id="bg-result-mines"></div>' +
            '<div class="bg-safe-grid" id="bg-mines-grid"></div>' +
            '</div>' +

            // ── TOWERS TAB ──
            '<div class="bg-tab-content" id="bg-tab-towers">' +
            '<button class="bg-predict-btn" id="bg-predict-towers">PREDICT TOWERS</button>' +
            '<div class="bg-confidence" id="bg-conf-towers"><div class="bg-confidence-bar" id="bg-conf-bar-towers"></div></div>' +
            '<div class="bg-result" id="bg-result-towers"></div>' +
            '<div class="bg-tower-grid" id="bg-towers-grid"></div>' +
            '</div>' +

            // Removed crash UI tab

            // ── BLACKJACK TAB ──
            '<div class="bg-tab-content" id="bg-tab-bj">' +
            '<div class="bg-result" id="bg-result-bj"></div>' +
            '<div id="bg-blackjack-container" style="text-align:center;padding:10px 0;">' +
            '  <div style="font-size:11px;color:#888;margin-bottom:8px">DEALER: <span id="bg-bj-dealer" style="color:#fff;font-weight:bold">0</span></div>' +
            '  <div style="font-size:11px;color:#888;margin-bottom:12px">PLAYER: <span id="bg-bj-player" style="color:#fff;font-weight:bold">0</span></div>' +
            '  <div id="bg-bj-best-action" style="font-size:32px;font-weight:800;letter-spacing:-0.5px;margin-bottom:4px;color:#fff">WAIT</div>' +
            '  <div id="bg-bj-subaction" style="font-size:10px;color:#777">Awaiting round start...</div>' +
            '</div>' +
            '</div>' +

            '<div class="bg-log" id="bg-log"></div>' +
            '</div>';

        document.body.appendChild(panel);

        // Toggle button
        var toggle = document.createElement('button');
        toggle.id = 'bg-toggle';
        toggle.className = 'bg-toggle';
        toggle.innerHTML = '⚡';
        document.body.appendChild(toggle);
        setTimeout(function () { toggle.classList.add('bg-visible'); }, 500);

        toggle.addEventListener('click', function () {
            panelVisible = !panelVisible;
            panel.classList.toggle('bg-visible', panelVisible);
        });

        document.getElementById('bg-close').addEventListener('click', function () {
            panelVisible = false;
            panel.classList.remove('bg-visible');
        });

        // Tab switching
        var tabs = panel.querySelectorAll('.bg-tab');
        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                tabs.forEach(function (t) { t.classList.remove('bg-active'); });
                tab.classList.add('bg-active');
                var tabName = tab.getAttribute('data-tab');
                activeTab = tabName;
                panel.querySelectorAll('.bg-tab-content').forEach(function (tc) { tc.classList.remove('bg-active-tab'); });
                document.getElementById('bg-tab-' + tabName).classList.add('bg-active-tab');
            });
        });

        // Tile count selector
        var tileBtns = panel.querySelectorAll('.bg-tile-btn');
        tileBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                tileBtns.forEach(function (b) { b.classList.remove('bg-selected'); });
                btn.classList.add('bg-selected');
                selectedTileCount = parseInt(btn.getAttribute('data-n'));
            });
        });

        // Grid selector
        document.getElementById('bg-grid-select').addEventListener('change', function () {
            selectedGrid = parseInt(this.value);
            GRID = selectedGrid;
            log('grid changed to ' + Math.sqrt(selectedGrid) + '×' + Math.sqrt(selectedGrid));
        });

        // Predict buttons
        document.getElementById('bg-predict-mines').addEventListener('click', runMinesPrediction);
        document.getElementById('bg-predict-towers').addEventListener('click', runTowersPrediction);

        // Dragging
        var header = document.getElementById('bg-header');
        header.addEventListener('mousedown', function (e) {
            isDragging = true;
            dragOX = e.clientX - panel.getBoundingClientRect().left;
            dragOY = e.clientY - panel.getBoundingClientRect().top;
        });
        document.addEventListener('mousemove', function (e) {
            if (!isDragging) return;
            panel.style.left = (e.clientX - dragOX) + 'px';
            panel.style.top = (e.clientY - dragOY) + 'px';
            panel.style.right = 'auto';
        });
        document.addEventListener('mouseup', function () { isDragging = false; });

        log('BloxGame AI initialized');
        log('server: ' + SERVER_URL);
    }

    // ═══ INIT ═══
    function init() {
        injectInterceptor();
        buildPanel();
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 500);
    } else {
        window.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
    }

    // Single Page Application (SPA) Support for route changes
    var _lastHref = location.href;
    setInterval(function() {
        if (_lastHref !== location.href) {
            _lastHref = location.href;
            log('navigated to: ' + location.pathname);
            // Switch tabs intelligently based on URL
            if (location.pathname.indexOf('blackjack') !== -1) document.querySelector('.bg-tab[data-tab="bj"]')?.click();
            else if (location.pathname.indexOf('towers') !== -1) document.querySelector('.bg-tab[data-tab="towers"]')?.click();
            else if (location.pathname.indexOf('mines') !== -1) document.querySelector('.bg-tab[data-tab="mines"]')?.click();
        }
    }, 1000);
})();
