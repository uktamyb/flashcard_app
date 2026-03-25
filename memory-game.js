// ════════════════════════════════════════════════
//  MEMORY MATCHING GAME  —  Duolingo Style
//  Integratsiya: app.js → import { MemoryGame }
// ════════════════════════════════════════════════
import { t } from './i18n.js';

const EMOJIS = [
  '🌟','🎯','🦁','🐬','🦋','🌈','🔥','⚡','🎸','🍀',
  '🚀','🎨','🎭','🦊','🐉','🌊','🎪','🏆','💎','🎲',
  '🦄','🌺','🦅','🐠','🍄','🌙','⭐','🎵','🔮','🎡'
];

const COLORS = [
  '#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#F7B731',
  '#DD88CF','#FF8C42','#6BCB77','#4D96FF','#FF6392',
  '#A55EEA','#FD9644','#26DE81','#2BCBBA','#FC5C65'
];

export class MemoryGame {
  constructor(container, words, deckId) {
    this.container = container;
    this.allWords  = (words || []).filter(w => w.front && w.back);
    this.deckId    = String(deckId || 'default');

    // State
    this.level   = 1;
    this.score   = 0;
    this.xp      = 0;
    this.hearts  = 5;
    this.flipped = [];   // currently flipped card elements (max 2)
    this.matched = [];   // matched card IDs
    this.locked  = false;
    this.isDailyChallenge = false;

    // Current level data
    this.currentWords = [];
    this.cardData     = [];

    // Persistence
    this.errorMap = this._loadErrors();
  }

  /* ── PUBLIC ─────────────────────────── */

  start(isDailyChallenge = false) {
    this.isDailyChallenge = isDailyChallenge;
    this.level  = 1;
    this.score  = 0;
    this.xp     = 0;
    this.hearts = 5;
    this._startLevel();
  }

  close() {
    this.container.innerHTML = '';
    this.container.style.display = 'none';
    window.__memoryGame = null;
  }

  /* ── PERSISTENCE ────────────────────── */

  _loadErrors() {
    try { return JSON.parse(localStorage.getItem(`mg_err_${this.deckId}`) || '{}'); }
    catch { return {}; }
  }

  _saveErrors() {
    try { localStorage.setItem(`mg_err_${this.deckId}`, JSON.stringify(this.errorMap)); }
    catch {}
  }

  /* ── WORD SELECTION ─────────────────── */

  _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Weight: words with more errors appear more often
  _selectWords(count) {
    count = Math.min(count, this.allWords.length);
    if (!count) return [];

    const sorted = [...this.allWords].sort((a, b) =>
      (this.errorMap[b.id] || 0) - (this.errorMap[a.id] || 0)
    );

    const errCount = Math.ceil(count * 0.4);
    const errWords = sorted.slice(0, Math.min(errCount, sorted.length));
    const rest     = this._shuffle(sorted.slice(errCount));
    return this._shuffle([...errWords, ...rest].slice(0, count));
  }

  _getDailyWords() {
    const today = new Date().toDateString();
    const key   = `mg_daily_${this.deckId}`;
    try {
      const s = JSON.parse(localStorage.getItem(key) || '{}');
      if (s.date === today && Array.isArray(s.ids)) {
        const found = s.ids
          .map(id => this.allWords.find(w => String(w.id) === String(id)))
          .filter(Boolean);
        if (found.length >= 2) return found;
      }
    } catch {}

    // Pick 6 hardest: most errors + worst SRS status
    const sOrder = { new: 3, learning: 2, known: 1, mastered: 0 };
    const sorted = [...this.allWords].sort((a, b) => {
      const de = (this.errorMap[b.id] || 0) - (this.errorMap[a.id] || 0);
      if (de) return de;
      return (sOrder[b.status] || 3) - (sOrder[a.status] || 3);
    });

    const daily = sorted.slice(0, Math.min(6, sorted.length));
    try {
      localStorage.setItem(key, JSON.stringify({ date: today, ids: daily.map(w => w.id) }));
    } catch {}
    return daily;
  }

  /* ── LEVEL ──────────────────────────── */

  _startLevel() {
    this.flipped = [];
    this.matched = [];
    this.locked  = false;

    if (this.allWords.length < 2) { this._renderEmpty(); return; }

    // Level N = N pairs, max 8 pairs per level (infinite levels after that)
    const maxPairs = Math.min(this.allWords.length, 8);
    const pairCount = Math.min(this.level, maxPairs);

    if (this.isDailyChallenge) {
      const daily = this._getDailyWords();
      this.currentWords = daily.slice(0, Math.min(pairCount, daily.length));
    } else {
      this.currentWords = this._selectWords(pairCount);
    }

    if (!this.currentWords.length) { this._renderEmpty(); return; }

    this._buildCards();
    this._renderUI();
  }

  _buildCards() {
    const colors = this._shuffle(COLORS);
    const emojis = this._shuffle(EMOJIS);
    const cards  = [];

    this.currentWords.forEach((word, i) => {
      const color = colors[i % colors.length];
      const emoji = emojis[i % emojis.length];
      const pair  = String(i);
      cards.push({ id: `${word.id}-f`, wordId: String(word.id), text: word.front, pair, color, emoji });
      cards.push({ id: `${word.id}-b`, wordId: String(word.id), text: word.back,  pair, color, emoji });
    });

    this.cardData = this._shuffle(cards);
  }

  /* ── RENDER ─────────────────────────── */

  _esc(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  _heartsHTML() {
    return [0,1,2,3,4].map(i =>
      `<span class="mg-heart ${i < this.hearts ? 'active' : 'lost'}">❤️</span>`
    ).join('');
  }

  _renderUI() {
    const pairs  = this.currentWords.length;
    const total  = pairs * 2;
    const cols   = total <= 4 ? 2 : total <= 6 ? 3 : 4;

    this.container.innerHTML = `
      <div class="mg-wrapper">

        <div class="mg-header">
          <div class="mg-header-left">
            <button class="mg-back-btn" id="mgBack">⬅</button>
            <div class="mg-level-badge">⚡ Level ${this.level}</div>
          </div>
          <div class="mg-header-center">
            <div class="mg-hearts" id="mgHearts">${this._heartsHTML()}</div>
          </div>
          <div class="mg-header-right">
            <div class="mg-xp-badge" id="mgXP">⭐ ${this.xp} XP</div>
            ${this.isDailyChallenge
              ? `<div class="mg-daily-active">${t('mgLaunchDaily')}</div>`
              : `<button class="mg-daily-btn" id="mgDaily">${t('mgLaunchDaily')}</button>`
            }
          </div>
        </div>

        <div class="mg-progress-wrap">
          <div class="mg-progress-bar">
            <div class="mg-progress-fill" id="mgFill" style="width:0%"></div>
          </div>
          <span class="mg-progress-text" id="mgPText">${t('mgPairs', 0, pairs)}</span>
        </div>

        <div class="mg-board mg-cols-${cols}" id="mgBoard">
          ${this.cardData.map(c => `
            <div class="mg-card" data-id="${c.id}" data-pair="${c.pair}" data-word-id="${c.wordId}">
              <div class="mg-card-inner">
                <div class="mg-card-hidden">
                  <span class="mg-card-emoji">${c.emoji}</span>
                </div>
                <div class="mg-card-shown" style="--card-color:${c.color}">
                  <span class="mg-card-text">${this._esc(c.text)}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <p class="mg-tip">${t('mgTip')}</p>

        <div id="mgErrors"></div>

      </div>
    `;

    this.container.querySelector('#mgBack')
      .addEventListener('click', () => this.close());
    this.container.querySelector('#mgDaily')
      ?.addEventListener('click', () => this.start(true));
    this.container.querySelectorAll('.mg-card')
      .forEach(el => el.addEventListener('click', () => this._clickCard(el)));

    this._renderErrors();
  }

  _renderErrors() {
    const el = this.container.querySelector('#mgErrors');
    if (!el) return;

    const list = Object.entries(this.errorMap)
      .map(([id, n]) => ({ w: this.allWords.find(x => String(x.id) === id), n }))
      .filter(e => e.w && e.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);

    if (!list.length) return;

    el.innerHTML = `
      <div class="mg-error-words">
        <div class="mg-error-title">${t('mgErrors')}</div>
        ${list.map(e =>
          `<span class="mg-error-tag">${this._esc(e.w.front)} <small>${e.n}✗</small></span>`
        ).join('')}
      </div>
    `;
  }

  _renderEmpty() {
    this.container.innerHTML = `
      <div class="mg-wrapper">
        <div class="mg-header">
          <button class="mg-back-btn" id="mgBack">⬅</button>
        </div>
        <div class="mg-empty">
          <span class="mg-empty-icon">📚</span>
          <h2 class="mg-empty-title">${t('mgNotEnough')}</h2>
          <p class="mg-empty-sub">${t('mgNotEnoughSub')}</p>
        </div>
      </div>
    `;
    this.container.querySelector('#mgBack')
      .addEventListener('click', () => this.close());
  }

  /* ── GAMEPLAY ───────────────────────── */

  _clickCard(el) {
    if (this.locked) return;
    if (el.classList.contains('flipped') || el.classList.contains('matched')) return;
    if (this.flipped.length >= 2) return;

    el.classList.add('flipped');
    this.flipped.push(el);

    if (this.flipped.length === 2) {
      this.locked = true;
      setTimeout(() => this._checkMatch(), 1100);
    }
  }

  _checkMatch() {
    const [c1, c2] = this.flipped;
    const ok = c1.dataset.pair === c2.dataset.pair
            && c1.dataset.id   !== c2.dataset.id;

    if (ok) {
      // ✅ Match
      c1.classList.add('matched', 'correct-flash');
      c2.classList.add('matched', 'correct-flash');
      this.matched.push(c1.dataset.id, c2.dataset.id);
      this.score += 10;
      this.xp    += 5;
      this._sound('correct');
      this._updateProgress();

      setTimeout(() => {
        c1.classList.remove('correct-flash');
        c2.classList.remove('correct-flash');
      }, 450);

      this.flipped = [];
      this.locked  = false;

      if (this.matched.length === this.currentWords.length * 2) {
        setTimeout(() => this._levelComplete(), 700);
      }

    } else {
      // ❌ Mismatch
      const wid = c1.dataset.wordId;
      this.errorMap[wid] = (this.errorMap[wid] || 0) + 1;
      this._saveErrors();

      this.hearts = Math.max(0, this.hearts - 1);
      c1.classList.add('wrong-shake');
      c2.classList.add('wrong-shake');
      this._sound('wrong');

      const heartsEl = this.container.querySelector('#mgHearts');
      if (heartsEl) heartsEl.innerHTML = this._heartsHTML();

      setTimeout(() => {
        c1.classList.remove('flipped', 'wrong-shake');
        c2.classList.remove('flipped', 'wrong-shake');
        this.flipped = [];
        this.locked  = false;
        if (this.hearts === 0) setTimeout(() => this._gameOver(), 300);
      }, 1400);
    }
  }

  _updateProgress() {
    const pairs = this.currentWords.length;
    const done  = this.matched.length / 2;
    const pct   = pairs > 0 ? (done / pairs) * 100 : 0;

    const fill = this.container.querySelector('#mgFill');
    if (fill) fill.style.width = pct + '%';

    const txt = this.container.querySelector('#mgPText');
    if (txt) txt.textContent = t('mgPairs', done, pairs);

    const xpEl = this.container.querySelector('#mgXP');
    if (xpEl) xpEl.textContent = `⭐ ${this.xp} XP`;
  }

  /* ── LEVEL COMPLETE / GAME OVER ─────── */

  _levelComplete() {
    this._sound('levelup');
    this.xp += 20;

    const stars = this.hearts >= 5 ? '⭐⭐⭐' : this.hearts >= 3 ? '⭐⭐' : '⭐';

    // Streak bonuses every 5 levels
    const isStreakBonus = this.level % 5 === 0;
    const bonusXP = isStreakBonus ? 50 : 20;
    this.xp += isStreakBonus ? 30 : 0; // extra XP already added above

    const board = this.container.querySelector('#mgBoard');
    if (!board) return;

    board.className = 'mg-level-complete';
    board.id = 'mgBoard';
    board.innerHTML = `
      <span class="mg-complete-icon">${isStreakBonus ? '🏆' : '🎉'}</span>
      <h2 class="mg-complete-title">${isStreakBonus ? '🔥 ' : ''}${t('mgLevelDone', this.level)}</h2>
      <p class="mg-complete-score">+${bonusXP} XP &nbsp;·&nbsp; ${t('mgTotalScore', this.score)}</p>
      <div class="mg-stars">${stars}</div>
      <button class="mg-next-btn" id="mgNext">${t('mgNextLevel')}</button>
    `;

    const xpEl = this.container.querySelector('#mgXP');
    if (xpEl) xpEl.textContent = `⭐ ${this.xp} XP`;

    board.querySelector('#mgNext').addEventListener('click', () => {
      this.level++;
      this.hearts = Math.min(5, this.hearts + 1); // restore 1 heart as reward
      this._startLevel();
    });
  }

  _gameOver() {
    const board = this.container.querySelector('#mgBoard');
    if (!board) return;

    board.className = 'mg-game-over';
    board.id = 'mgBoard';
    board.innerHTML = `
      <span class="mg-over-icon">💔</span>
      <h2 class="mg-over-title">${t('mgGameOver')}</h2>
      <p class="mg-over-score">${t('mgScoreLabel', this.score)} &nbsp;·&nbsp; ⭐ ${this.xp} XP</p>
      <button class="mg-retry-btn" id="mgRetry">${t('mgRetry')}</button>
    `;

    board.querySelector('#mgRetry').addEventListener('click', () =>
      this.start(this.isDailyChallenge)
    );
  }

  /* ── SOUND (Web Audio API) ───────────── */

  _sound(type) {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);

      if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(); osc.stop(ctx.currentTime + 0.5);

      } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.setValueAtTime(110, ctx.currentTime + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(); osc.stop(ctx.currentTime + 0.4);

      } else if (type === 'levelup') {
        osc.type = 'sine';
        [523, 659, 784, 1047].forEach((f, i) =>
          osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.12)
        );
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
        osc.start(); osc.stop(ctx.currentTime + 0.7);
      }
    } catch (_) { /* audio not supported */ }
  }
}
