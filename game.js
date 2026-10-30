/* রাস্তা কি তোর বাপের? 😤
   A satirical Dhaka CNG-rickshaw endless runner.
   Pure canvas + Web Audio. No dependencies, no mercy. */

(() => {
  "use strict";

  // ---------------- setup ----------------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height; // logical size 480x720

  // scale canvas for crisp rendering on any display
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  const ROAD_L = 90, ROAD_R = 390, LANES = 3;
  const LANE_W = (ROAD_R - ROAD_L) / LANES; // 100
  const laneX = (i) => ROAD_L + LANE_W / 2 + i * LANE_W;
  const PLAYER_Y = H - 150;

  const MENU = document.getElementById("menu");
  const OVER = document.getElementById("over");
  const HUD = document.getElementById("hud");
  const CMT = document.getElementById("commentary");
  const els = {
    meters: document.getElementById("hud-mouthful"),
    taka: document.getElementById("hud-taka"),
    near: document.getElementById("hud-nearmiss"),
    best: document.getElementById("hud-score"),
    overQuote: document.getElementById("over-quote"),
    overQuoteEn: document.getElementById("over-quote-en"),
    overMeters: document.getElementById("over-meters"),
    overTaka: document.getElementById("over-taka"),
    overNear: document.getElementById("over-near"),
    newBest: document.getElementById("over-newbest"),
  };

  const bn = (n) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

  // ---------------- state ----------------
  const STATE = { m: 0, taka: 0, near: 0, speed: 250 };
  let mode = "menu"; // menu | run | dying | over
  let best = +(localStorage.getItem("baper-rasta") || 0);
  let obstacles = [], pickups = [], parts = [];
  let spawnT = 0, pickupT = 0, roadOffset = 0, sideT = 0, sideItems = [];
  let shake = 0, honkCd = 0; let dying = null;
  let survivedSeconds = 0;

  // ---------------- audio ----------------
  let ac = null;
  const audio = () => (ac || (ac = new (window.AudioContext || window.webkitAudioContext)()));

  function sndHorn() {
    try {
      const a = audio(), t = a.currentTime;
      [880, 1108, 1318].forEach((f, i) => {
        const o = a.createOscillator(), g = a.createGain();
        o.type = "sawtooth"; o.frequency.value = f;
        g.gain.setValueAtTime(0.08 - i * 0.015, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.3);
      });
    } catch (e) {}
  }

  function sndCoin() {
    try {
      const a = audio(), t = a.currentTime;
      [1320, 1760].forEach((f, i) => {
        const o = a.createOscillator(), g = a.createGain();
        o.type = "square"; o.frequency.value = f;
        g.gain.setValueAtTime(0.06, t + i * 0.07);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.09);
        o.connect(g).connect(a.destination); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.1);
      });
    } catch (e) {}
  }

  function sndCrash() {
    try {
      const a = audio(), t = a.currentTime;
      const o = a.createOscillator(), g = a.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(300, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.7);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.85);
      // flesh-crushing percussion to add realism
      const len = a.sampleRate * 0.25, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
      const n = a.createBufferSource(), ng = a.createGain();
      ng.gain.value = 0.25; n.buffer = buf; n.connect(ng).connect(a.destination); n.start(t);
    } catch (e) {}
  }

  function sndPothole() { sndCrash(); /* Dhaka certified */ }

  // ---------------- content: funny bits ----------------
  const NEAR_MISS_LINES = [
    ["!! মাটি কামড়ালো !!", "close one, bhai"],
    ["সিগন্যাল? পরে দেখবো।", "signal? later. maybe."],
    ["প্রায় মারা যেতে যে 😇", "almost became a statistic"],
    ["ওই CNG টা কিন্তু গা ছমছম করে", "that CNG gave me goosebumps"],
  ];
  const HORN_SCARE_LINES = [
    ["হর্নেই আসল শক্তি 💪", "the horn is the real power"],
    ["গাড়ি ভয়ে পালিয়েছে 🏃💨", "car fled in fear"],
    ["রাস্তা খালি করে দিলো, কৃতজ্ঞতা", "road cleared instantly. thanks."],
    ["Horn OK Please 📢", "Horn OK Please"],
  ];
  const DEATH_LINES = [
    ["মামা, বাসটা দেখি নাই 👀", "'Mama, I didn't see the bus.'"],
    ["রাস্তা ছিল, ভাগ্য ছিল না", "the road was there. luck wasn't."],
    ["সিগন্যাল? সেটা কি খাওয়ার জিনিস?", "signal? is that edible?"],
    ["বাপের রাস্তায় এমনই হয় ✋", "stuff happens on father's road"],
    ["গরুটা আগেই ছিল 🐄", "the cow was there first"],
    ["মামলা হবে মামার বাড়িতে 🫂", "the case settles at mama's house"],
    ["হর্ন দিলে কি বাঁচতেন? 📢", "would a honk have saved you? 📢"],
    ["ভিডিও আপলোড হলো: 'SHOCKING'", "uploaded to YouTube: 'SHOCKING'"],
  ];

  const FLAT_MILESTONES = [
    [300, "৩০০ মিটার — সাহসী", "brave start"],
    [700, "৭০০ মিটার — 'চালানো'? — না", "this isn't driving, it's vibing"],
    [1000, "১০০০ মিটার — পুলিশ মামা এখন তোমাকে চেনে 🚨", "police mama knows you now"],
    [1500, "১৫০০ মিটার — মামা মনিপুরে দাওয়াত দিবে", "mama will invite you to dinner"],
    [2000, "২০০০ মিটার 🏆 ইউটিউবে ভাইরাল: 'SHOCKING CNG'", "you're a viral legend"],
    [3000, "৩০০০ মিটার 😳 রাস্তা সত্যিই তোর", "the road truly is your father's"],
  ];

  // emoji art assets
  const ART = {
    player: "🛺", bus: "🚌", truck: "🚚", car: "🚗", bike: "🏍️",
    cow: "🐄", hole: "🕳️", taka: "🪙", bigTaka: "💵", tree: "🌳", building: "🏬", mosque: "🕌", post: "🚏",
  };

  // ---------------- helpers ----------------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function say(text, en) {
    const div = document.createElement("div");
    div.className = "say";
    div.textContent = text;
    CMT.appendChild(div);
    setTimeout(() => div.remove(), 2100);
    if (en) {
      const e = document.createElement("div");
      e.className = "say en-say";
      e.textContent = en;
      CMT.appendChild(e);
      setTimeout(() => e.remove(), 2100);
    }
  }

  function burst(x, y, emoji, n = 12) {
    for (let i = 0; i < n; i++) {
      parts.push({
        x, y,
        vx: rnd(-140, 140), vy: rnd(-260, -60),
        life: 1, emoji, size: rnd(16, 30), rot: rnd(0, Math.PI), vr: rnd(-4, 4),
      });
    }
  }

  // ---------------- spawning ----------------
  const OB_TYPES = [
    { k: "car", emoji: ART.car, deadly: true, w: 0.30, vMul: 1 },
    { k: "bike", emoji: ART.bike, deadly: true, w: 0.18, vMul: 1.25 },
    { k: "bus", emoji: ART.bus, deadly: true, w: 0.24, vMul: 0.9 },
    { k: "truck", emoji: ART.truck, deadly: true, w: 0.12, vMul: 0.85 },
    { k: "cow", emoji: ART.cow, deadly: true, w: 0.10, vMul: 0.45 },
    { k: "hole", emoji: ART.hole, deadly: false, w: 0.06, vMul: 1 },
  ];
  const totalW = OB_TYPES.reduce((s, t) => s + t.w, 0);
  function rollType() {
    let r = Math.random() * totalW;
    for (const t of OB_TYPES) { r -= t.w; if (r <= 0) return t; }
    return OB_TYPES[0];
  }

  function spawnWave() {
    const difficulty = Math.min(1, survivedSeconds / 90);
    const nBlock = Math.random() < 0.25 + difficulty * 0.3 ? 2 : 1;
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, nBlock);
    const freeLanes = [0, 1, 2].filter((i) => !lanes.includes(i));
    for (const lane of lanes) {
      const t = rollType();
      obstacles.push({
        lane, x: laneX(lane), y: -60,
        type: t, wob: rnd(0, Math.PI * 2),
        dead: false, honked: false,
        speedMul: rnd(0.9, 1.1) * t.vMul,
      });
    }
    // leftover coins spawn on free lane often — baper's generosity
    if (Math.random() < 0.55) {
      const lane = pick(freeLanes);
      const n = 2 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++) {
        pickups.push({ lane, x: laneX(lane), y: -40 - i * 46, big: Math.random() < 0.15 });
      }
    }
  }

  function spawnSide() {
    const side = Math.random() < 0.5;
    sideItems.push({
      x: side ? rnd(18, 70) : rnd(W - 70, W - 18),
      y: -40,
      emoji: pick([ART.tree, ART.building, ART.mosque, ART.post, ART.tree]),
      scale: rnd(0.8, 1.4),
    });
  }

  // ---------------- game flow ----------------
  function reset() {
    STATE.m = 0; STATE.taka = 0; STATE.near = 0;
    STATE.speed = 250; survivedSeconds = 0;
    obstacles = []; pickups = []; parts = []; sideItems = [];
    player.lane = 1; player.x = laneX(1); player.spin = 0; player.potholeT = 0;
    spawnT = 0.6; pickupT = 0; roadOffset = 0; sideT = 0; shake = 0;
    lastMilestone = -1;
  }

  const player = { lane: 1, x: laneX(1), spin: 0, potholeT: 0 };
  let lastMilestone = -1;

  function startGame() {
    audio(); // unlock
    reset();
    MENU.classList.add("hidden");
    OVER.classList.add("hidden");
    HUD.classList.remove("hidden");
    mode = "run";
    say("তোর বাপের রাস্তা 🛺💨", "your father's road");
  }

  function die(type) {
    mode = "dying";
    dying = { t: 0, spins: 0 };
    shake = 1;
    player.spin = 0.02;
    sndCrash();
    burst(player.x, PLAYER_Y, pick(["💥", "🔥", "💢"]), 16);
    if (navigator.vibrate) navigator.vibrate([60, 50, 90]);
    // store
    if (STATE.m > best) {
      best = STATE.m;
      localStorage.setItem("baper-rasta", String(Math.floor(best)));
      els.newBest.classList.remove("hidden");
    } else {
      els.newBest.classList.add("hidden");
    }
    // fill over panel after brief dramatic pause
    setTimeout(showOver, 900);
  }

  function showOver() {
    const [bnLine, enLine] = pick(DEATH_LINES);
    els.overQuote.textContent = bnLine;
    els.overQuoteEn.textContent = enLine;
    els.overMeters.textContent = bn(Math.floor(STATE.m));
    els.overTaka.textContent = bn(STATE.taka);
    els.overNear.textContent = bn(STATE.near);
    OVER.classList.remove("hidden");
    HUD.classList.add("hidden");
    mode = "over";
  }

  function updateHUD() {
    els.meters.textContent = `${bn(Math.floor(STATE.m))} মিটার বাপের রাস্তা 🏁`;
    els.taka.textContent = `🪙 ${bn(STATE.taka)} টাকার ব্যাগ`;
    els.near.textContent = `👻 কাছাকাছি পাশ: ${bn(STATE.near)}`;
    els.best.textContent = `🥇 সেরা: ${bn(Math.floor(best))} মিটার`;
  }

  // ---------------- input ----------------
  function moveLane(dir) {
    if (mode !== "run") return;
    const nl = player.lane + dir;
    if (nl < 0 || nl > 2) { say("⬅️ রাস্তাই শেষ?", "the road ends, bhai"); return; }
    player.lane = nl;
  }

  function honk() {
    if (mode !== "run" || honkCd > 0) return;
    honkCd = 0.45;
    sndHorn();
    // scare cars ahead into other lanes
    let scared = 0;
    for (const o of obstacles) {
      if (o.dead || o.honked) continue;
      const dy = o.y - PLAYER_Y;
      if (dy < -10 && dy > -300 && Math.random() < 0.5) {
        // flee to any adjacent lane EXCEPT the one the player is in (we're rude, not suicidal)
        const opts = [o.lane - 1, o.lane + 1].filter((l) => l >= 0 && l <= 2 && l !== player.lane);
        if (opts.length) {
          o.lane = pick(opts);
          o.x = laneX(o.lane);
          o.honked = true;
          o.flee = 1; // visual
          scared++;
        }
      }
    }
    if (scared) {
      say(pick(HORN_SCARE_LINES)[0] + " ×" + scared, pick(HORN_SCARE_LINES)[1]);
      STATE.m += 10 * scared; // honk-based road conquest bonus
    }
  }

  window.addEventListener("keydown", (e) => {
    if (["ArrowLeft", "a", "A"].includes(e.key)) { moveLane(-1); e.preventDefault(); }
    else if (["ArrowRight", "d", "D"].includes(e.key)) { moveLane(1); e.preventDefault(); }
    else if (e.code === "Space") {
      e.preventDefault();
      if (mode === "menu") startGame();
      else if (mode === "over") startGame();
      else honk();
    } else if (e.key === "Enter" && mode === "over") startGame();
  });

  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    if (mode === "menu" || mode === "over") startGame();
    else if (px < W * 0.33) moveLane(-1);
    else if (px > W * 0.66) moveLane(1);
    else honk();
  });

  document.getElementById("btn-start").addEventListener("click", startGame);
  document.getElementById("btn-retry").addEventListener("click", startGame);
  // tap anywhere on the overlays also (re)starts
  MENU.addEventListener("click", startGame);
  OVER.addEventListener("click", startGame);

  // ---------------- collision helpers ----------------
  function hitPlayer(o) {
    const dx = Math.abs(o.x - player.x);
    const dy = Math.abs(o.y - PLAYER_Y);
    return dx < 34 && dy < 30;
  }

  // ---------------- update ----------------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    honkCd = Math.max(0, honkCd - dt);
    shake = Math.max(0, shake - dt * 2.5);

    // confusing: decorations move on menu too, so it looks alive
    roadOffset = (roadOffset + 240 * dt) % 64;
    sideT += dt;
    if (sideT > 0.9) { sideT = 0; spawnSide(); }

    for (const s of sideItems) s.y += 240 * dt;
    sideItems = sideItems.filter((s) => s.y < H + 60);

    for (const p of parts) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 500 * dt; p.rot += p.vr * dt; p.life -= dt * 1.4;
    }
    parts = parts.filter((p) => p.life > 0);

    if (mode === "dying") {
      dying.t += dt; player.spin += dt * 9; player.x += Math.sin(dying.t * 12) * 30 * dt;
      for (const o of obstacles) o.y += STATE.speed * 0.25 * dt;
      if (dying.t > 1) dying.t = 1;
      return;
    }
    if (mode !== "run") return;

    survivedSeconds += dt;
    const speedT = 250 + Math.min(330, survivedSeconds * 6); // ramps to 580
    STATE.speed = speedT * (player.potholeT > 0 ? 0.55 : 1);
    STATE.m += STATE.speed * dt / 12; // meters of conquest
    player.potholeT = Math.max(0, player.potholeT - dt);

    // smooth lane change
    const targetX = laneX(player.lane);
    player.x += (targetX - player.x) * Math.min(1, dt * 12);

    // spawn
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnWave();
      const base = 1.15 - Math.min(0.65, survivedSeconds * 0.011);
      spawnT = rnd(base * 0.8, base * 1.2);
    }

    // obstacles
    for (const o of obstacles) {
      o.y += STATE.speed * o.speedMul * dt;
      if (o.type.k === "bike") o.x += Math.sin((o.y + o.wob * 40) * 0.05) * 30 * dt;
      if (o.type.k === "cow") o.x += Math.sin(o.wob += dt) * 18 * dt * 3;

      // honk visual pulse fade
      if (o.flee) o.flee = Math.max(0, o.flee - dt * 2);

      if (o.dead) continue;

      if (!o.type.deadly && hitPlayer(o)) {
        // pothole: not death, just Ishwardi-grade suspension damage
        o.dead = true;
        shake = 1;
        player.potholeT = 0.8;
        sndPothole();
        burst(o.x, o.y, "🕳️", 8);
        say("ধক! 🕳️ গর্ত খেয়ে ফেলছি", "just ate a pothole");
        continue;
      }

      if (o.type.deadly && hitPlayer(o)) {
        o.dead = true;
        if (o.type.k === "cow") say("গরু প্রথমেই ছিল 🐄🛺", "the cow was here FIRST");
        die(o.type.k);
        return;
      }

      // near miss: passed beside
      if (!o.passed && o.y > PLAYER_Y + 26) {
        o.passed = true;
        const laneDiff = Math.abs(o.lane - player.lane);
        if (laneDiff === 1) {
          STATE.near++;
          STATE.m += 6;
          if (Math.random() < 0.45) {
            const [bnL, enL] = pick(NEAR_MISS_LINES);
            say(bnL, enL);
          }
        }
      }
    }
    obstacles = obstacles.filter((o) => o.y < H + 80);

    // pickups
    for (const c of pickups) {
      c.y += STATE.speed * dt;
      if (Math.abs(c.x - player.x) < 30 && Math.abs(c.y - PLAYER_Y) < 30) {
        c.dead = true;
        STATE.taka += c.big ? 20 : 5;
        STATE.m += 3;
        sndCoin();
        burst(c.x, c.y, c.big ? "💵" : "🪙", 6);
      }
    }
    pickups = pickups.filter((c) => !c.dead && c.y < H + 40);

    // milestones
    for (let i = 0; i < FLAT_MILESTONES.length; i++) {
      if (STATE.m >= FLAT_MILESTONES[i][0] && lastMilestone < i) {
        lastMilestone = i;
        say(FLAT_MILESTONES[i][1], FLAT_MILESTONES[i][2]);
      }
    }

    updateHUD();
  }

  // ---------------- draw ----------------
  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate(rnd(-6, 6) * shake, rnd(-6, 6) * shake);

    // dirt/grass sides
    ctx.fillStyle = "#20301f";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#2a2622"; // roadside dust
    ctx.fillRect(ROAD_L - 14, 0, ROAD_R - ROAD_L + 28, H);

    // road
    ctx.fillStyle = "#3a3f47";
    ctx.fillRect(ROAD_L - 10, 0, ROAD_R - ROAD_L + 20, H);

    // lane dashes
    ctx.fillStyle = "rgba(255, 233, 120, 0.55)";
    for (let l = 1; l < LANES; l++) {
      const x = ROAD_L + l * LANE_W - 3;
      for (let y = -64 + roadOffset; y < H; y += 64) {
        ctx.fillRect(x, y, 6, 34);
      }
    }
    // road edges
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(ROAD_L - 12, 0, 4, H);
    ctx.fillRect(ROAD_R + 8, 0, 4, H);

    // road texture: patches (Dhaka grade surface)
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    for (let y = -80 + roadOffset * 0.6; y < H; y += 180) {
      const x = ROAD_L + ((y * 13) % 260);
      ctx.beginPath();
      ctx.ellipse(x + 30 % 90, y, 26, 10, 0.4, 0, 7);
      ctx.fill();
    }

    // roadside decorations
    for (const s of sideItems) {
      drawEmoji(s.emoji, s.x, s.y, 34 * s.scale);
    }

    // pickups
    for (const c of pickups) {
      drawEmoji(c.big ? ART.bigTaka : ART.taka, c.x, c.y, c.big ? 34 : 26);
    }

    // obstacles
    for (const o of obstacles) {
      const pulse = o.flee ? 1 + o.flee * 0.25 : 1;
      drawEmoji(o.type.emoji, o.x, o.y, 52 * pulse);
      if (o.type.k === "cow") drawEmoji("💨", o.x - 26, o.y + 18, 18);
    }

    // player
    ctx.save();
    if (player.potholeT > 0) ctx.translate(0, Math.sin(player.potholeT * 40) * 3);
    ctx.translate(player.x, PLAYER_Y);
    ctx.rotate(mode === "dying" ? player.spin : Math.sin(performance.now() / 160) * 0.03);
    drawEmoji(mode === "dying" ? "😵" : ART.player, 0, 0, 56);
    // baper license plate
    ctx.restore();

    // pothole warning "hole" is a trap: show speed lines
    if (player.potholeT > 0) {
      ctx.fillStyle = "rgba(255,211,42,0.8)";
      ctx.font = '700 14px "Hind Siliguri", sans-serif';
      ctx.fillText("ধক! গর্ত খেয়েছি 🕳️", player.x - 46, PLAYER_Y + 46);
    }

    // particles
    for (const p of parts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.font = `${p.size}px serif`;
      ctx.textAlign = "center";
      ctx.fillText(p.emoji, 0, 0);
      ctx.restore();
    }

    // speed streaks
    if (mode === "run" && STATE.speed > 420) {
      ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.35, (STATE.speed - 420) / 400)})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const y = ((performance.now() * 0.9 + i * 130) % (H + 100)) - 40;
        ctx.beginPath();
        ctx.moveTo(ROAD_L + 20 + (i * 47) % (ROAD_R - ROAD_L - 40), y);
        ctx.lineTo(ROAD_L + 20 + (i * 47) % (ROAD_R - ROAD_L - 40), y + 26);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawEmoji(emoji, x, y, size) {
    ctx.save();
    ctx.font = `${size}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, x, y);
    ctx.restore();
  }

  // menu backdrop: idle decor
  reset();
  updateHUD();
  requestAnimationFrame(loop);
})();
