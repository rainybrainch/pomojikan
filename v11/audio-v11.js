/* audio-v11.js ── ぽもじかん v11 音響エンジン（Web Audio API）
   外部ファイル不要・オフライン動作・PWA対応
   ユーザーのタップ後に AudioContext を初期化（ブラウザ自動再生ポリシー対応）
*/

'use strict';

(function () {
  let _ctx = null;

  function ctx() {
    if (!_ctx) {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // iOS Safari: suspended 状態をタップで解除
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  // ── 基本オシレーター ──────────────────────────
  function osc(freq, type, startTime, duration, gainPeak, ac) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, startTime);
    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(gainPeak, startTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    o.connect(g);
    g.connect(ac.destination);
    o.start(startTime);
    o.stop(startTime + duration + 0.05);
  }

  // ── tier別チャイム ──────────────────────────

  // tier 1-4: 水滴（sine, 短い）
  function playDrop(ac, t) {
    osc(880, 'sine', t, 0.18, 0.25, ac);
  }

  // tier 5-8: 木魚・柔チャイム
  function playChime(ac, t) {
    osc(1047, 'sine',     t, 0.5, 0.3, ac);
    osc(1568, 'sine',     t, 0.4, 0.1, ac);
  }

  // tier 9-12: 鈴（鐘の倍音）
  function playBell(ac, t) {
    osc(880,  'sine',     t, 1.0, 0.4, ac);
    osc(1320, 'sine',     t, 0.9, 0.2, ac);
    osc(2200, 'sine',     t, 0.6, 0.08, ac);
  }

  // tier 13-16: 神域チャイム（荘厳・長め）
  function playDivine(ac, t) {
    osc(523,  'sine',     t, 2.0, 0.35, ac);
    osc(659,  'sine',     t, 1.8, 0.25, ac);
    osc(784,  'sine',     t, 1.5, 0.15, ac);
    osc(1047, 'sine',     t, 1.2, 0.10, ac);
    // 低音サブ
    osc(261,  'sine',     t, 1.0, 0.15, ac);
  }

  // ── タイマーサウンド ──────────────────────────
  // 集中開始: 落ち着いた低音
  function playWorkStart(ac, t) {
    osc(330, 'sine', t, 0.6, 0.3, ac);
    osc(440, 'sine', t + 0.15, 0.5, 0.2, ac);
  }

  // 休憩開始: 明るい上昇音
  function playRestStart(ac, t) {
    osc(523, 'sine', t, 0.4, 0.3, ac);
    osc(659, 'sine', t + 0.12, 0.4, 0.25, ac);
    osc(784, 'sine', t + 0.24, 0.5, 0.2, ac);
  }

  // ── レベルアップ（通常）: 軽やかな3音 ──────────────
  function playLevelUp(ac, t) {
    osc(523, 'sine', t,        0.35, 0.22, ac);
    osc(659, 'sine', t + 0.10, 0.30, 0.18, ac);
    osc(784, 'sine', t + 0.20, 0.40, 0.20, ac);
  }

  // ── クエスト達成: 小ファンファーレ ──────────────
  function playQuestComplete(ac, t) {
    osc(523,  'sine', t,        0.22, 0.28, ac);
    osc(659,  'sine', t + 0.08, 0.22, 0.24, ac);
    osc(784,  'sine', t + 0.16, 0.22, 0.20, ac);
    osc(1047, 'sine', t + 0.28, 0.55, 0.26, ac);
    osc(1319, 'sine', t + 0.28, 0.45, 0.13, ac);
  }

  // ── 文章モード: 筆タップ音（字配置時）──────────────
  function playKeyTap(ac, t) {
    osc(440, 'sine',     t, 0.10, 0.08, ac);
    osc(880, 'triangle', t, 0.06, 0.04, ac);
  }

  // ── 文章モード: 保存確認音（2音・封印の印）──────────────
  function playFileSave(ac, t) {
    osc(523, 'sine', t,        0.40, 0.22, ac); // C5
    osc(784, 'sine', t + 0.12, 0.50, 0.20, ac); // G5
  }

  // ── サイクルマイルストーン: 勝利ファンファーレ ──────────────
  function playMilestone(ac, t) {
    // 付点8分音符のリズムで3音上昇 → 高音で締める
    osc(523,  'sine', t,        0.22, 0.30, ac);
    osc(659,  'sine', t + 0.14, 0.22, 0.28, ac);
    osc(784,  'sine', t + 0.28, 0.22, 0.26, ac);
    osc(1047, 'sine', t + 0.42, 0.55, 0.32, ac);
    osc(1319, 'sine', t + 0.42, 0.45, 0.16, ac);
    osc(1568, 'sine', t + 0.54, 0.60, 0.20, ac);
    // 低音支え
    osc(330,  'sine', t + 0.42, 0.60, 0.12, ac);
  }

  // ── 書体進化（昇格）チャイム ──────────────
  function playEvolution(ac, t) {
    // 上昇アルペジオ → 長め残響
    const freqs = [523, 659, 784, 1047, 1319];
    freqs.forEach((f, i) => {
      osc(f, 'sine', t + i * 0.10, 1.4 - i * 0.15, 0.28 - i * 0.03, ac);
    });
    // 深みを出す低音
    osc(262, 'sine', t, 1.8, 0.18, ac);
  }

  // ── 公開 API ──────────────────────────────
  window.PomojikanAudio = {
    /**
     * 字を拾った時の音
     * @param {number} tier 1-16
     */
    playCatch(tier) {
      try {
        const ac = ctx();
        const t = ac.currentTime + 0.01;
        if (tier >= 13)     playDivine(ac, t);
        else if (tier >= 9) playBell(ac, t);
        else if (tier >= 5) playChime(ac, t);
        else                playDrop(ac, t);
      } catch (_) {}
    },

    playWorkStart() {
      try { playWorkStart(ctx(), ctx().currentTime + 0.01); } catch (_) {}
    },

    playRestStart() {
      try { playRestStart(ctx(), ctx().currentTime + 0.01); } catch (_) {}
    },

    playEvolution() {
      try { playEvolution(ctx(), ctx().currentTime + 0.01); } catch (_) {}
    },

    playMilestone() {
      try { playMilestone(ctx(), ctx().currentTime + 0.01); } catch (_) {}
    },

    playLevelUp() {
      try { playLevelUp(ctx(), ctx().currentTime + 0.01); } catch (_) {}
    },

    playQuestComplete() {
      try { playQuestComplete(ctx(), ctx().currentTime + 0.01); } catch (_) {}
    },

    playKeyTap() {
      try { playKeyTap(ctx(), ctx().currentTime + 0.005); } catch (_) {}
    },

    playFileSave() {
      try { playFileSave(ctx(), ctx().currentTime + 0.005); } catch (_) {}
    },

    /** AudioContext を明示的に起動（最初のタップ時に呼ぶ） */
    unlock() {
      try { ctx(); } catch (_) {}
    },
  };
})();
