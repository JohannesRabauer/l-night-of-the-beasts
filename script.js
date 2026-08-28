(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const SAVE_KEY = "nacht-der-bestien-vran-1";

  const AREAS = [
    { id: "city", range: [1, 10], name: "Die alte Stadt", icon: "🏚️", stars: "★",
      floor: ["#2a2420", "#1c1814"], wall: "#3a3330", accent: "#c45c28", fog: 0 },
    { id: "forest", range: [11, 20], name: "Der schwarze Wald", icon: "🌲", stars: "★★",
      floor: ["#142016", "#0c160e"], wall: "#1a2c1c", accent: "#2f6b38", fog: 0.15 },
    { id: "castle", range: [21, 30], name: "Das verlassene Schloss", icon: "🏰", stars: "★★★",
      floor: ["#1c1624", "#120e18"], wall: "#2c2438", accent: "#7a4ac8", fog: 0.1 },
    { id: "mist", range: [31, 40], name: "Die Nebellande", icon: "🌫️", stars: "★★★★",
      floor: ["#1a2228", "#10161c"], wall: "#2a3840", accent: "#8cb4c8", fog: 0.55 },
    { id: "hell", range: [41, 49], name: "Die Unterwelt", icon: "🔥", stars: "★★★★★",
      floor: ["#240c0c", "#140606"], wall: "#3a1010", accent: "#e25822", fog: 0.2 },
    { id: "final", range: [50, 50], name: "Das letzte Reich", icon: "👹", stars: "☠️",
      floor: ["#1a1208", "#0c0804"], wall: "#3a2a10", accent: "#e2c075", fog: 0.25 }
  ];

  const HELMETS = ["Eisenhelm", "Knochenhelm", "Nachtstahl", "Dämonenhelm", "Götterhelm"];
  const WOLF_TITLES = ["Jungwolf", "Waldjäger", "Schloss-Alpha", "Blutfürst", "Mondkönig", "Bestienkönig"];

  const CHARS = {
    youth: {
      name: "Jugendlicher", icon: "🎧",
      hp: 110, speed: 5.5, atk: 13, range: 4.4, radius: 0.28, color: "#7ec8ff"
    },
    puma: {
      name: "Puma mit Helm", icon: "🐆",
      hp: 125, speed: 6.3, atk: 12, range: 1.45, radius: 0.3, color: "#e8a54b"
    },
    werewolf: {
      name: "Werwolf", icon: "🐺",
      hp: 88, speed: 4.5, atk: 9, range: 1.7, radius: 0.34, color: "#c45cff"
    }
  };

  let W = innerWidth, H = innerHeight;
  let worldScale = 1, TILE_X = 36, TILE_Y = 18, TILE_Z = 22;
  const keys = {};
  const mouse = { x: 0, y: 0, down: false, right: false, fromCanvas: false };
  const stick = { active: false, id: null, x: 0, y: 0 };
  let attackHeld = false;
  let useTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  let state = "menu";
  let selected = null;
  let level = 1;
  let checkpoint = 1;
  let maxReached = 1;
  let player = null;
  let map = null;
  let enemies = [];
  let projectiles = [];
  let particles = [];
  let floats = [];
  let portal = null;
  let camera = { x: 0, y: 0, shake: 0 };
  let last = performance.now();
  let hintTimer = 8;

  const els = {
    menu: document.getElementById("menu"),
    hud: document.getElementById("hud"),
    hint: document.getElementById("hint"),
    pause: document.getElementById("pause"),
    dead: document.getElementById("dead"),
    win: document.getElementById("win"),
    start: document.getElementById("start-game"),
    cont: document.getElementById("continue-game"),
    name: document.getElementById("hud-name"),
    level: document.getElementById("hud-level"),
    area: document.getElementById("hud-area"),
    check: document.getElementById("hud-check"),
    hp: document.getElementById("hp-fill"),
    od: document.getElementById("od-fill"),
    skill: document.getElementById("skill-chip"),
    dash: document.getElementById("dash-chip"),
    ult: document.getElementById("ult-chip"),
    deadText: document.getElementById("dead-text"),
    cards: [...document.querySelectorAll(".character-card")],
    touch: document.getElementById("touch"),
    stick: document.getElementById("stick"),
    knob: document.getElementById("stick-knob"),
    btnAtk: document.getElementById("btn-atk"),
    btnDash: document.getElementById("btn-dash"),
    btnSkill: document.getElementById("btn-skill"),
    btnUlt: document.getElementById("btn-ult"),
    btnJump: document.getElementById("btn-jump"),
    pauseBtn: document.getElementById("pause-btn")
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function ang(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
  function zoneOf(lv) { return Math.min(5, Math.floor((lv - 1) / 10)); }
  function getArea(lv) { return AREAS.find(a => lv >= a.range[0] && lv <= a.range[1]); }

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = Math.imul(s ^ (s >>> 15), 0x85ebca6b);
      s ^= s >>> 13;
      return ((s >>> 0) % 100000) / 100000;
    };
  }

  function viewportSize() {
    const vv = window.visualViewport;
    if (vv) return { w: vv.width, h: vv.height, x: vv.offsetLeft || 0, y: vv.offsetTop || 0 };
    return { w: innerWidth, h: innerHeight, x: 0, y: 0 };
  }

  function updateWorldScale() {
    const portrait = H > W;
    const shortest = Math.min(W, H);
    const target = portrait ? shortest / 430 : shortest / 640;
    worldScale = clamp(target, 0.55, 1.65);
    TILE_X = 36 * worldScale;
    TILE_Y = 18 * worldScale;
    TILE_Z = 22 * worldScale;
  }

  function resize() {
    const vv = viewportSize();
    W = Math.max(1, vv.w);
    H = Math.max(1, vv.h);
    const mobile = useTouch || W < 900;
    const dpr = Math.min(devicePixelRatio || 1, mobile ? 1.75 : 2);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.style.transform = vv.x || vv.y ? `translate(${vv.x}px, ${vv.y}px)` : "";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    updateWorldScale();
  }

  function toScreen(x, y, z = 0) {
    return {
      x: (x - y) * TILE_X - camera.x + W / 2,
      y: (x + y) * TILE_Y - z * TILE_Z - camera.y + H / 2 + 40 * worldScale
    };
  }

  function toWorld(sx, sy) {
    const rx = sx + camera.x - W / 2;
    const ry = sy + camera.y - H / 2 - 40 * worldScale;
    return { x: rx / (2 * TILE_X) + ry / (2 * TILE_Y), y: ry / (2 * TILE_Y) - rx / (2 * TILE_X) };
  }

  function aimWorld() {
    if (attackHeld || (useTouch && !mouse.fromCanvas)) {
      let best = null, bestD = 1e9;
      for (const e of enemies) {
        if (e.hp <= 0) continue;
        const d = dist(player, e);
        if (d < bestD) { bestD = d; best = e; }
      }
      if (best) return { x: best.x, y: best.y };
      return { x: player.x + Math.cos(player.facing), y: player.y + Math.sin(player.facing) };
    }
    return toWorld(mouse.x, mouse.y);
  }

  function isoFromScreenStick(sx, sy) {
    const mag = clamp(Math.hypot(sx, sy), 0, 1);
    if (mag < 0.12) return { x: 0, y: 0, mag: 0 };
    const vx = sx * 0.5 + sy * 0.5;
    const vy = -sx * 0.5 + sy * 0.5;
    const len = Math.hypot(vx, vy) || 1;
    return { x: (vx / len) * mag, y: (vy / len) * mag, mag };
  }

  function save() {
    if (!player) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      level, checkpoint, maxReached,
      key: player.key,
      helmet: player.helmet
    }));
  }

  function loadMeta() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); }
    catch { return null; }
  }

  function scaledStats(key, lv) {
    const base = CHARS[key];
    const z = zoneOf(lv);
    if (key === "werewolf") {
      return {
        maxHp: base.hp + z * 30,
        atk: base.atk + z * 4.2,
        speed: base.speed + z * 0.28
      };
    }
    if (key === "youth") {
      return { maxHp: base.hp + z * 12, atk: base.atk + z * 2.2, speed: base.speed + z * 0.08 };
    }
    return {
      maxHp: base.hp + z * 16,
      atk: base.atk + z * 2.1,
      speed: base.speed + z * 0.1
    };
  }

  function makePlayer(key) {
    const b = CHARS[key];
    const s = scaledStats(key, level);
    return {
      key, name: b.name, icon: b.icon, color: b.color,
      x: 3.5, y: 3.5, z: 0, vx: 0, vy: 0,
      radius: b.radius, range: b.range,
      hp: s.maxHp, maxHp: s.maxHp, atk: s.atk, speed: s.speed,
      facing: 0, invuln: 0, atkCd: 0, skillCd: 0, dashCd: 0, ultCd: 0,
      overdrive: 0, jumping: 0, dashT: 0, dashA: 0,
      helmet: Math.min(HELMETS.length - 1, zoneOf(Math.max(maxReached, level))),
      armor: key === "puma" && zoneOf(level) >= 3
    };
  }

  function refreshPlayerCombat() {
    const s = scaledStats(player.key, level);
    const ratio = player.hp / player.maxHp;
    player.maxHp = s.maxHp;
    player.atk = s.atk;
    player.speed = s.speed;
    player.hp = clamp(ratio * player.maxHp, 1, player.maxHp);
    player.armor = player.key === "puma" && zoneOf(level) >= 3;
    player.helmet = Math.min(HELMETS.length - 1, zoneOf(Math.max(maxReached, level)));
  }

  function canLifesteal() {
    return player.key === "werewolf" && zoneOf(level) >= 3;
  }

  function skillName() {
    if (player.key === "youth") {
      if (level >= 41) return "Frequenzbruch";
      if (level >= 21) return "Echo-Schrei";
      return "Schallstoß";
    }
    if (player.key === "puma") return player.armor ? "Rüstungssprung" : "Helmstoß";
    if (level >= 41) return "Mondraserei";
    if (canLifesteal()) return "Aderlass";
    if (level >= 21) return "Heuljagd";
    return "Klauenhieb";
  }

  function tileAt(x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (!map || ty < 0 || tx < 0 || ty >= map.size || tx >= map.size) return 1;
    return map.tiles[ty][tx];
  }

  function blocked(x, y, ent, air) {
    const r = ent.radius || 0.25;
    for (const [ox, oy] of [[-r, 0], [r, 0], [0, -r], [0, r], [0, 0]]) {
      const t = tileAt(x + ox, y + oy);
      if (t === 1) return true;
      if (t === 2 && !air) {
        if (ent === player && player.key === "puma") continue;
        return true;
      }
    }
    return false;
  }

  function tryMove(ent, nx, ny, air) {
    if (!blocked(nx, ent.y, ent, air)) ent.x = nx;
    if (!blocked(ent.x, ny, ent, air)) ent.y = ny;
  }

  function spawnFx(x, y, color, n = 8, z = 0.4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 3;
      particles.push({
        x, y, z, vz: Math.random() * 2,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.4, max: 0.7, color, size: 2 + Math.random() * 3
      });
    }
  }

  function floatText(x, y, text, color) {
    floats.push({ x, y, z: 0.8, text, color, life: 0.8 });
  }

  function enemyBlueprint(lv, rand) {
    let kind = "grunt";
    if (lv >= 10 && rand() < 0.45) kind = "runner";
    if (lv >= 20 && rand() < 0.35) kind = "caster";
    if (lv >= 30 && rand() < 0.22) kind = "elite";
    if (lv >= 40 && rand() < 0.18) kind = "giant";
    if (lv >= 49) kind = rand() < 0.5 ? "apex" : (rand() < 0.5 ? "giant" : "elite");
    const scale = 1 + lv * 0.045;
    const table = {
      grunt: { name: "Gassenbestie", hp: 28 * scale, atk: 6 + lv * 0.35, speed: 2.2, r: 0.28, color: "#8a5a48" },
      runner: { name: "Hetzer", hp: 22 * scale, atk: 7 + lv * 0.4, speed: 3.6, r: 0.24, color: "#c07040" },
      caster: { name: "Fluchrufer", hp: 26 * scale, atk: 8 + lv * 0.42, speed: 1.8, r: 0.27, color: "#6a80d0" },
      elite: { name: "Elitewächter", hp: 70 * scale, atk: 11 + lv * 0.5, speed: 2.4, r: 0.38, color: "#a03040" },
      giant: { name: "Knochenriese", hp: 140 * scale, atk: 16 + lv * 0.55, speed: 1.45, r: 0.62, color: "#6a4030" },
      apex: { name: "Apokalypse-Bestie", hp: 120 * scale, atk: 14 + lv * 0.62, speed: 2.8, r: 0.42, color: "#d02030" }
    };
    const t = table[kind];
    const area = getArea(lv);
    if (area.id === "forest" && kind === "grunt") t.name = "Waldschrecken";
    if (area.id === "castle" && kind === "caster") t.name = "Schlossgeist";
    if (area.id === "mist") t.name = "Nebelwicht";
    if (area.id === "hell" && kind !== "giant") t.name = "Höllenhund";
    return { kind, ...t };
  }

  function placeEnemy(bp, x, y) {
    return {
      ...bp, x, y, z: 0, hp: bp.hp, maxHp: bp.hp, facing: 0,
      cd: 0.4 + Math.random(), special: 1 + Math.random() * 2,
      telegraph: 0, stun: 0, radius: bp.r
    };
  }

  function buildLevel() {
    const area = getArea(level);
    const rand = rng(level * 92821 + 17);
    const size = level === 50 ? 26 : 16 + Math.min(10, Math.floor(level / 4));
    const tiles = [];
    for (let y = 0; y < size; y++) {
      tiles[y] = [];
      for (let x = 0; x < size; x++) {
        let t = 0;
        if (x === 0 || y === 0 || x === size - 1 || y === size - 1) t = 1;
        else if (rand() < 0.09 && (x > 5 || y < size - 6) && (x < size - 4 || y > 4)) {
          t = rand() < 0.55 ? 1 : 2;
        }
        tiles[y][x] = t;
      }
    }
    map = { size, tiles, area };
    player.x = 3.2;
    player.y = size - 3.2;
    player.z = 0;
    player.invuln = 0.6;
    camera.x = (player.x - player.y) * TILE_X;
    camera.y = (player.x + player.y) * TILE_Y;
    camera.shake = 0;
    refreshPlayerCombat();
    player.hp = player.maxHp;
    enemies = [];
    projectiles = [];
    particles = [];
    floats = [];
    portal = null;

    if (level === 50) {
      enemies.push(placeEnemy({
        kind: "boss", name: "Herr der Bestien", hp: 2200, maxHp: 2200,
        atk: 22, speed: 1.7, r: 0.85, color: "#7a1020"
      }, size / 2, size / 2 - 2));
      enemies[0].hp = enemies[0].maxHp;
      for (let i = 0; i < 4; i++) {
        const bp = enemyBlueprint(40, rand);
        enemies.push(placeEnemy(bp, 6 + rand() * (size - 12), 5 + rand() * 6));
      }
    } else {
      let n = 3 + Math.floor(level * 0.42);
      if (level >= 10) n += 2;
      if (level >= 40) n += 5;
      if (level >= 49) n += 4;
      n = Math.min(n, 22);
      let guard = 0;
      while (enemies.length < n && guard++ < 200) {
        const x = 4 + rand() * (size - 8);
        const y = 2 + rand() * (size * 0.62);
        if (blocked(x, y, { radius: 0.3 }, false)) continue;
        if (Math.hypot(x - player.x, y - player.y) < 6) continue;
        enemies.push(placeEnemy(enemyBlueprint(level, rand), x, y));
      }
      if (level >= 40 && level < 50) {
        const waves = 1 + (level >= 45 ? 1 : 0);
        for (let w = 0; w < waves; w++) {
          for (let i = 0; i < 4; i++) {
            const bp = enemyBlueprint(Math.max(10, level - 8), rand);
            bp.name = "Rudeltier";
            enemies.push(placeEnemy(bp, size - 5 - rand() * 6, 4 + rand() * 8));
          }
        }
      }
    }
    save();
    updateHud();
  }

  function openPortal() {
    if (portal) return;
    portal = { x: map.size / 2, y: 2.6, pulse: 0 };
    floatText(portal.x, portal.y, "Portal geöffnet", "#e2c075");
  }

  function hurtPlayer(dmg, src) {
    if (player.invuln > 0 || player.hp <= 0) return;
    if (player.armor) dmg *= 0.72;
    if (player.dashT > 0) dmg *= 0.15;
    dmg = Math.max(1, Math.round(dmg));
    player.hp -= dmg;
    player.invuln = 0.35;
    camera.shake = Math.min(14, camera.shake + 5);
    player.overdrive = clamp(player.overdrive + dmg * 0.35, 0, 100);
    floatText(player.x, player.y, `-${dmg}`, "#ff6677");
    spawnFx(player.x, player.y, "#c41e3a", 10);
    if (src) {
      const a = ang(src, player);
      tryMove(player, player.x + Math.cos(a) * 0.15, player.y + Math.sin(a) * 0.15, player.z > 0.1);
    }
    if (player.hp <= 0) {
      player.hp = 0;
      die();
    }
    updateHud();
  }

  function hurtEnemy(e, dmg, lifesteal) {
    if (e.hp <= 0) return;
    dmg = Math.max(1, Math.round(dmg));
    e.hp -= dmg;
    player.overdrive = clamp(player.overdrive + dmg * 0.12, 0, 100);
    floatText(e.x, e.y, `-${dmg}`, "#ffe8a0");
    spawnFx(e.x, e.y, e.color, 6);
    if (lifesteal && canLifesteal()) {
      const heal = Math.round(dmg * 0.22);
      player.hp = Math.min(player.maxHp, player.hp + heal);
      floatText(player.x, player.y, `+${heal}`, "#7dff9a");
    }
    if (e.hp <= 0) {
      spawnFx(e.x, e.y, "#501018", 18, 0.6);
      camera.shake = Math.min(16, camera.shake + 3);
      if (Math.random() < 0.25) {
        const h = 8 + Math.floor(level / 4);
        player.hp = Math.min(player.maxHp, player.hp + h);
        floatText(e.x, e.y, `+${h} HP`, "#7dff9a");
      }
    }
    updateHud();
  }

  function die() {
    attackHeld = false;
    resetStick();
    state = "dead";
    els.deadText.textContent = `Speicherpunkt: Level ${checkpoint} · ${getArea(checkpoint).name}`;
    els.dead.classList.remove("hidden");
    const keep = level;
    level = checkpoint;
    save();
    level = keep;
  }

  function respawn() {
    level = checkpoint;
    els.dead.classList.add("hidden");
    state = "play";
    player = makePlayer(player.key);
    player.helmet = Math.min(HELMETS.length - 1, zoneOf(maxReached));
    buildLevel();
  }

  function nextLevel() {
    if (level === 50) {
      state = "win";
      els.win.classList.remove("hidden");
      localStorage.removeItem(SAVE_KEY);
      return;
    }
    if (level % 5 === 0) {
      checkpoint = level + 1;
      floatText(player.x, player.y, `Speicherpunkt ${checkpoint}`, "#e2c075");
    }
    level += 1;
    maxReached = Math.max(maxReached, level);
    buildLevel();
  }

  function shoot(from, angle, speed, dmg, color, hostile, life = 1.2, r = 0.12) {
    projectiles.push({
      x: from.x, y: from.y, z: 0.45,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      dmg, color, hostile, life, r
    });
  }

  function playerAttack() {
    if (player.atkCd > 0 || player.hp <= 0) return;
    player.atkCd = player.key === "youth" ? 0.28 : 0.38;
    const aim = aimWorld();
    player.facing = ang(player, aim);
    if (player.key === "youth") {
      shoot(player, player.facing, 11, player.atk, "#7ec8ff", false, 0.7, 0.1);
      spawnFx(player.x, player.y, "#7ec8ff", 4);
      return;
    }
    const reach = player.range;
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const d = dist(player, e);
      if (d > reach + e.radius) continue;
      const da = Math.abs(Math.atan2(e.y - player.y, e.x - player.x) - player.facing);
      const wrap = Math.min(da, Math.PI * 2 - da);
      if (wrap < 0.9) hurtEnemy(e, player.atk + Math.random() * 6, true);
    }
    spawnFx(player.x + Math.cos(player.facing) * 0.5, player.y + Math.sin(player.facing) * 0.5, player.color, 7);
  }

  function playerSkill() {
    if (player.skillCd > 0 || player.hp <= 0) return;
    player.skillCd = 5.5;
    const aim = aimWorld();
    player.facing = ang(player, aim);
    if (player.key === "youth") {
      const power = level >= 41 ? 2.2 : level >= 21 ? 1.6 : 1;
      for (let i = 0; i < (level >= 21 ? 12 : 8); i++) {
        const a = player.facing + (i - 5) * 0.16 * (level >= 21 ? 1.4 : 1);
        shoot(player, a, 9, player.atk * 0.7 * power, "#9ae0ff", false, 0.55);
      }
      spawnFx(player.x, player.y, "#9ae0ff", 16);
      if (level >= 41) {
        for (const e of enemies) {
          if (dist(player, e) < 3.2) {
            e.stun = 1.1;
            hurtEnemy(e, player.atk * 1.4, false);
          }
        }
      }
    } else if (player.key === "puma") {
      player.dashT = 0.28;
      player.dashA = player.facing;
      player.invuln = Math.max(player.invuln, 0.28);
      player.z = 0.7;
      player.jumping = 0.28;
      for (const e of enemies) {
        if (dist(player, e) < 2.2) hurtEnemy(e, player.atk * 1.8, false);
      }
    } else {
      for (const e of enemies) {
        if (dist(player, e) < 2.4) {
          hurtEnemy(e, player.atk * 1.6, true);
          e.stun = 0.4;
        }
      }
      if (level >= 21) player.overdrive = clamp(player.overdrive + 18, 0, 100);
      spawnFx(player.x, player.y, "#c45cff", 20);
    }
    updateHud();
  }

  function playerUlt() {
    if (player.overdrive < 100 || player.ultCd > 0) return;
    player.overdrive = 0;
    player.ultCd = 2;
    camera.shake = 12;
    if (player.key === "youth") {
      for (let i = 0; i < 24; i++) shoot(player, (i / 24) * Math.PI * 2, 8, player.atk, "#d0f0ff", false, 0.8);
    } else if (player.key === "puma") {
      player.invuln = 1.1;
      player.dashT = 0.5;
      player.dashA = player.facing;
      for (const e of enemies) if (dist(player, e) < 3) hurtEnemy(e, player.atk * 2.4, false);
    } else {
      for (const e of enemies) {
        if (dist(player, e) < 3.4) {
          hurtEnemy(e, player.atk * 2.2, true);
          if (canLifesteal()) player.hp = Math.min(player.maxHp, player.hp + 6);
        }
      }
      player.hp = Math.min(player.maxHp, player.hp + 16);
    }
    spawnFx(player.x, player.y, player.color, 28, 1);
    updateHud();
  }

  function playerDash() {
    if (player.dashCd > 0 || player.dashT > 0) return;
    player.dashCd = 0.85;
    player.dashT = 0.18;
    player.invuln = Math.max(player.invuln, 0.18);
    const aim = aimWorld();
    let a = player.facing;
    const iso = isoFromScreenStick(stick.x, stick.y);
    const mx = iso.mag ? iso.x : (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
    const my = iso.mag ? iso.y : (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
    if (mx || my) a = Math.atan2(my, mx);
    else if (dist(player, aim) > 0.2) a = ang(player, aim);
    player.dashA = a;
    spawnFx(player.x, player.y, "#ddd", 8);
  }

  function playerJump() {
    if (player.key !== "puma" || player.jumping > 0) return;
    player.jumping = 0.42;
    player.z = 0.05;
  }

  function updatePlayer(dt) {
    if (player.hp <= 0) return;
    player.atkCd = Math.max(0, player.atkCd - dt);
    player.skillCd = Math.max(0, player.skillCd - dt);
    player.dashCd = Math.max(0, player.dashCd - dt);
    player.ultCd = Math.max(0, player.ultCd - dt);
    player.invuln = Math.max(0, player.invuln - dt);

    if (player.jumping > 0) {
      player.jumping -= dt;
      player.z = Math.sin((1 - player.jumping / 0.42) * Math.PI) * 1.15;
      if (player.jumping <= 0) player.z = 0;
    }

    if (player.dashT > 0) {
      player.dashT -= dt;
      const sp = (player.key === "puma" ? 18 : 14) * dt;
      tryMove(player, player.x + Math.cos(player.dashA) * sp, player.y + Math.sin(player.dashA) * sp, player.z > 0.15);
    } else {
      const iso = isoFromScreenStick(stick.x, stick.y);
      let mx = iso.mag ? iso.x : (keys.d || keys.arrowright ? 1 : 0) - (keys.a || keys.arrowleft ? 1 : 0);
      let my = iso.mag ? iso.y : (keys.s || keys.arrowdown ? 1 : 0) - (keys.w || keys.arrowup ? 1 : 0);
      const len = Math.hypot(mx, my) || 1;
      mx /= len; my /= len;
      const sp = player.speed * dt * (player.key === "puma" && player.z > 0.2 ? 1.15 : 1);
      if (mx || my) {
        player.facing = Math.atan2(my, mx);
        tryMove(player, player.x + mx * sp, player.y + my * sp, player.z > 0.2);
      }
    }

    if (mouse.down || attackHeld) playerAttack();
    if (portal && dist(player, portal) < 0.85) nextLevel();
  }

  function updateEnemies(dt) {
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      e.cd = Math.max(0, e.cd - dt);
      e.special = Math.max(0, e.special - dt);
      e.stun = Math.max(0, e.stun - dt);
      e.telegraph = Math.max(0, e.telegraph - dt);
      if (e.stun > 0) continue;

      const d = dist(e, player);
      const a = ang(e, player);
      e.facing = a;

      if (e.kind === "caster" && d < 8) {
        if (d < 3.2) tryMove(e, e.x - Math.cos(a) * e.speed * dt, e.y - Math.sin(a) * e.speed * dt, false);
        else if (e.cd <= 0) {
          e.cd = 1.6;
          shoot(e, a, 6.5, e.atk, "#8090ff", true, 1.4, 0.11);
        }
      } else if (e.kind === "boss") {
        if (e.special <= 0) {
          e.special = 3.2;
          const phase = e.hp < e.maxHp * 0.4 ? 2 : 1;
          if (phase === 2) {
            for (let i = 0; i < 16; i++) shoot(e, i / 16 * Math.PI * 2, 5, e.atk * 0.7, "#ff4466", true, 1.6, 0.14);
            if (enemies.filter(x => x.hp > 0 && x.kind !== "boss").length < 3) {
              const bp = enemyBlueprint(40, rng(Date.now()));
              enemies.push(placeEnemy(bp, e.x + 2, e.y));
            }
          } else {
            e.telegraph = 0.45;
          }
        }
        if (e.telegraph <= 0 && d < 1.6 && e.cd <= 0) {
          e.cd = 0.9;
          hurtPlayer(e.atk, e);
        } else {
          tryMove(e, e.x + Math.cos(a) * e.speed * dt, e.y + Math.sin(a) * e.speed * dt, false);
        }
        if (e.telegraph > 0 && e.telegraph < 0.05 && d < 2.4) {
          hurtPlayer(e.atk * 1.6, e);
          camera.shake = 10;
        }
      } else {
        const stop = e.radius + player.radius + 0.15;
        if (d > stop) {
          const jitter = e.kind === "runner" ? 1.15 : 1;
          tryMove(e, e.x + Math.cos(a) * e.speed * jitter * dt, e.y + Math.sin(a) * e.speed * jitter * dt, false);
        }
        if (d < stop + 0.25 && e.cd <= 0) {
          e.cd = e.kind === "elite" ? 0.7 : 0.95;
          hurtPlayer(e.atk, e);
        }
        if ((e.kind === "elite" || e.kind === "apex") && e.special <= 0 && d < 6) {
          e.special = 3.5;
          e.telegraph = 0.35;
        }
        if (e.telegraph > 0 && e.telegraph < 0.06) {
          const dash = 1.1;
          tryMove(e, e.x + Math.cos(a) * dash, e.y + Math.sin(a) * dash, false);
          if (dist(e, player) < 1.4) hurtPlayer(e.atk * 1.3, e);
        }
      }
    }
    enemies = enemies.filter(e => e.hp > 0);
    if (enemies.length === 0) openPortal();
  }

  function updateProjectiles(dt) {
    for (const p of projectiles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (tileAt(p.x, p.y) === 1) { p.life = 0; continue; }
      if (p.hostile) {
        if (dist(p, player) < player.radius + p.r + 0.05) {
          hurtPlayer(p.dmg, p);
          p.life = 0;
        }
      } else {
        for (const e of enemies) {
          if (e.hp <= 0) continue;
          if (dist(p, e) < e.radius + p.r) {
            hurtEnemy(e, p.dmg, player.key === "werewolf");
            p.life = 0;
            break;
          }
        }
      }
    }
    projectiles = projectiles.filter(p => p.life > 0);
  }

  function updateFx(dt) {
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt * 0.35;
      p.y += p.vy * dt * 0.35;
      p.z += p.vz * dt;
      p.vz -= 6 * dt;
    }
    particles = particles.filter(p => p.life > 0).slice(-360);
    for (const f of floats) { f.life -= dt; f.z += dt * 1.2; }
    floats = floats.filter(f => f.life > 0);
  }

  function visionRange() {
    if (map.area.id !== "mist") return 99;
    return player.key === "youth" ? 12 : 5.4;
  }

  function drawDiamond(x, y, w, h, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x - w, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function drawMap() {
    const s = map.size;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const t = map.tiles[y][x];
        const p = toScreen(x + 0.5, y + 0.5);
        const col = (x + y) % 2 === 0 ? map.area.floor[0] : map.area.floor[1];
        drawDiamond(p.x, p.y, TILE_X, TILE_Y, col, "rgba(0,0,0,.25)");
        if (t === 1) {
          const wallH = 28 * worldScale;
          ctx.beginPath();
          ctx.moveTo(p.x - TILE_X, p.y);
          ctx.lineTo(p.x, p.y - TILE_Y);
          ctx.lineTo(p.x, p.y - TILE_Y - wallH);
          ctx.lineTo(p.x - TILE_X, p.y - wallH);
          ctx.closePath();
          ctx.fillStyle = map.area.wall;
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(p.x + TILE_X, p.y);
          ctx.lineTo(p.x, p.y - TILE_Y);
          ctx.lineTo(p.x, p.y - TILE_Y - wallH);
          ctx.lineTo(p.x + TILE_X, p.y - wallH);
          ctx.closePath();
          ctx.fillStyle = "#00000044";
          ctx.fill();
          drawDiamond(p.x, p.y - wallH, TILE_X, TILE_Y, map.area.accent + "55");
        } else if (t === 2) {
          drawDiamond(p.x, p.y - 8 * worldScale, TILE_X * 0.5, TILE_Y * 0.5, "#5a4030", "#000");
        }
      }
    }
  }

  function drawShadow(x, y, r) {
    const p = toScreen(x, y);
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 6 * worldScale, r * 28 * worldScale, r * 14 * worldScale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPawn(ent, opts) {
    const p = toScreen(ent.x, ent.y, ent.z || 0);
    drawShadow(ent.x, ent.y, ent.radius);
    const body = opts.color;
    ctx.fillStyle = body;
    ctx.beginPath();
    const s = worldScale;
    ctx.ellipse(p.x, p.y - 10 * s, ent.radius * 26 * s, ent.radius * 34 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    const fx = Math.cos(ent.facing) * 6 * s;
    const fy = Math.sin(ent.facing) * 3 * s;
    ctx.beginPath();
    ctx.arc(p.x - 4 * s + fx, p.y - 16 * s + fy, 2.2 * s, 0, Math.PI * 2);
    ctx.arc(p.x + 4 * s + fx, p.y - 16 * s + fy, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();
    if (opts.kind === "youth") {
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 18 * s, 10 * s, Math.PI * 0.15, Math.PI - 0.15);
      ctx.stroke();
      ctx.fillStyle = "#111";
      ctx.fillRect(p.x - 14 * s, p.y - 22 * s, 6 * s, 8 * s);
      ctx.fillRect(p.x + 8 * s, p.y - 22 * s, 6 * s, 8 * s);
    }
    if (opts.kind === "puma") {
      ctx.fillStyle = ["#8a8a8a", "#d8d0c4", "#2a3640", "#6a2020", "#e2c075"][player.helmet] || "#888";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 24 * s, 11 * s, 7 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (opts.kind === "werewolf") {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(p.x - 10 * s, p.y - 22 * s);
      ctx.lineTo(p.x - 6 * s, p.y - 34 * s);
      ctx.lineTo(p.x - 2 * s, p.y - 22 * s);
      ctx.moveTo(p.x + 10 * s, p.y - 22 * s);
      ctx.lineTo(p.x + 6 * s, p.y - 34 * s);
      ctx.lineTo(p.x + 2 * s, p.y - 22 * s);
      ctx.fill();
    }
    if (ent.maxHp && ent.hp < ent.maxHp) {
      ctx.fillStyle = "#200";
      ctx.fillRect(p.x - 16 * s, p.y - 40 * s, 32 * s, 4 * s);
      ctx.fillStyle = "#c41e3a";
      ctx.fillRect(p.x - 16 * s, p.y - 40 * s, 32 * s * (ent.hp / ent.maxHp), 4 * s);
    }
    if (ent.telegraph > 0) {
      ctx.strokeStyle = "rgba(255,60,60,.7)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22 * s, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawRadar() {
    if (player.key !== "youth") return;
    const p = toScreen(player.x, player.y);
    ctx.strokeStyle = "rgba(126,200,255,.25)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, (40 + (performance.now() / 8 % 80)) * worldScale, 0, Math.PI * 2);
    ctx.stroke();
    for (const e of enemies) {
      const s = toScreen(e.x, e.y);
      ctx.fillStyle = "rgba(255,80,80,.7)";
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    }
  }

  function drawScene() {
    ctx.fillStyle = "#070405";
    ctx.fillRect(0, 0, W, H);
    if (!map || !player) return;

    camera.x = lerp(camera.x, (player.x - player.y) * TILE_X + (Math.random() - 0.5) * camera.shake, 0.12);
    camera.y = lerp(camera.y, (player.x + player.y) * TILE_Y + (Math.random() - 0.5) * camera.shake, 0.12);
    camera.shake *= 0.88;
    const pc = toScreen(player.x, player.y);

    drawMap();

    if (portal) {
      const p = toScreen(portal.x, portal.y, 0.2);
      const pulse = (16 + Math.sin(performance.now() / 180) * 5) * worldScale;
      ctx.fillStyle = "#e2c07555";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, pulse, pulse * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e2c075";
      ctx.stroke();
    }

    const sprites = [
      ...enemies.map(e => ({ z: e.x + e.y, draw: () => drawPawn(e, { color: e.color, kind: e.kind }) })),
      { z: player.x + player.y, draw: () => {
        if (player.invuln > 0 && Math.sin(performance.now() / 40) > 0) return;
        drawPawn(player, { color: player.color, kind: player.key });
      } }
    ];
    sprites.sort((a, b) => a.z - b.z);
    for (const s of sprites) s.draw();

    for (const p of projectiles) {
      const s = toScreen(p.x, p.y, p.z);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5 * worldScale, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of particles) {
      const s = toScreen(p.x, p.y, Math.max(0, p.z));
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(s.x, s.y, p.size * worldScale, p.size * worldScale);
      ctx.globalAlpha = 1;
    }
    for (const f of floats) {
      const s = toScreen(f.x, f.y, f.z);
      ctx.globalAlpha = clamp(f.life / 0.8, 0, 1);
      ctx.fillStyle = f.color;
      ctx.font = `700 ${Math.round(14 * worldScale)}px Source Sans 3, sans-serif`;
      ctx.fillText(f.text, s.x - 10, s.y);
      ctx.globalAlpha = 1;
    }

    drawRadar();

    const vis = visionRange();
    if (vis < 90) {
      const g = ctx.createRadialGradient(pc.x, pc.y, vis * 12 * worldScale, pc.x, pc.y, vis * 28 * worldScale);
      g.addColorStop(0, "rgba(8,12,16,0)");
      g.addColorStop(1, "rgba(8,12,16,0.82)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    } else if (map.area.fog > 0) {
      ctx.fillStyle = `rgba(10,8,12,${map.area.fog * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.fillStyle = "#e2c075";
    ctx.font = "12px Source Sans 3, sans-serif";
    const infoY = useTouch ? 72 : H - 28;
    ctx.fillText(`${enemies.length} Bestien`, 16, infoY);
    if (player.key === "puma") ctx.fillText(HELMETS[player.helmet] + (player.armor ? " · Dämonenrüstung" : ""), 16, infoY + 16);
    if (player.key === "werewolf") ctx.fillText(WOLF_TITLES[zoneOf(level)] + (canLifesteal() ? " · Lebenskraft" : " · noch kein Raub"), 16, infoY + 16);
  }

  function updateHud() {
    if (!player) return;
    const area = getArea(level);
    els.name.textContent = `${player.icon} ${player.name}`;
    els.level.textContent = `Level ${level}/50`;
    els.area.textContent = `${area.icon} ${area.name} ${area.stars}`;
    els.check.textContent = `Speicherpunkt ${checkpoint}`;
    els.hp.style.transform = `scaleX(${clamp(player.hp / player.maxHp, 0, 1)})`;
    els.od.style.transform = `scaleX(${clamp(player.overdrive / 100, 0, 1)})`;
    els.skill.textContent = `Q ${skillName()}${player.skillCd > 0 ? ` ${player.skillCd.toFixed(1)}s` : ""}`;
    els.skill.className = "skill" + (player.skillCd > 0 ? " cd" : " ready");
    els.dash.textContent = player.dashCd > 0 ? `Ausweichen ${player.dashCd.toFixed(1)}s` : "Ausweichen bereit";
    els.dash.className = "skill" + (player.dashCd > 0 ? " cd" : " ready");
    els.ult.textContent = player.overdrive >= 100 ? "F Overdrive BEREIT" : `F Overdrive ${Math.floor(player.overdrive)}%`;
    els.ult.className = "skill" + (player.overdrive >= 100 ? " ready" : " cd");
    els.btnSkill.textContent = player.skillCd > 0 ? skillName().slice(0, 6) : "Skill";
    els.btnUlt.textContent = player.overdrive >= 100 ? "Ult" : `${Math.floor(player.overdrive)}%`;
    els.btnDash.classList.toggle("gold", player.dashCd <= 0);
    els.btnJump.classList.toggle("hidden", player.key !== "puma");
  }

  function showPlayUi(on) {
    els.hud.classList.toggle("hidden", !on);
    els.hint.classList.toggle("hidden", !on);
    els.menu.classList.toggle("hidden", on);
    const touchOn = on && (useTouch || W < 900);
    els.touch.classList.toggle("hidden", !touchOn);
    els.touch.classList.toggle("desktop-hide", !useTouch && W >= 900);
    els.hint.textContent = touchOn
      ? "Stick bewegen · Angriff halten · Dash / Skill / Ult rechts · Pause oben"
      : "WASD bewegen · Klick Angriff · Shift ausweichen · Q Fähigkeit · F Overdrive · Leertaste Sprung (Puma)";
  }

  function startRun(fromSave, key) {
    const meta = loadMeta();
    if (fromSave && meta) {
      level = meta.level || 1;
      checkpoint = meta.checkpoint || 1;
      maxReached = meta.maxReached || level;
      selected = meta.key;
    } else {
      level = 1;
      checkpoint = 1;
      maxReached = 1;
      selected = key;
    }
    player = makePlayer(selected);
    if (fromSave && meta) player.helmet = meta.helmet || 0;
    state = "play";
    hintTimer = 8;
    showPlayUi(true);
    els.pause.classList.add("hidden");
    els.dead.classList.add("hidden");
    els.win.classList.add("hidden");
    buildLevel();
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    if (state === "play") {
      updatePlayer(dt);
      updateEnemies(dt);
      updateProjectiles(dt);
      updateFx(dt);
      hintTimer -= dt;
      if (hintTimer <= 0) els.hint.classList.add("hidden");
      updateHud();
    }
    drawScene();
    requestAnimationFrame(loop);
  }

  els.cards.forEach(card => {
    card.addEventListener("click", () => {
      els.cards.forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      selected = card.dataset.character;
      els.start.disabled = false;
    });
  });

  els.start.addEventListener("click", () => startRun(false, selected));
  els.cont.addEventListener("click", () => startRun(true));
  document.getElementById("resume-btn").addEventListener("click", () => {
    els.pause.classList.add("hidden");
    state = "play";
  });
  document.getElementById("to-menu").addEventListener("click", () => {
    save();
    state = "menu";
    showPlayUi(false);
    els.pause.classList.add("hidden");
    refreshContinue();
  });
  document.getElementById("respawn-btn").addEventListener("click", respawn);
  document.getElementById("win-menu").addEventListener("click", () => {
    state = "menu";
    showPlayUi(false);
    els.win.classList.add("hidden");
    refreshContinue();
  });

  function togglePause() {
    if (state === "play") {
      attackHeld = false;
      resetStick();
      state = "pause";
      els.pause.classList.remove("hidden");
    } else if (state === "pause") {
      state = "play";
      els.pause.classList.add("hidden");
    }
  }

  function clientPoint(e) {
    const vv = window.visualViewport;
    return {
      x: e.clientX - (vv ? vv.offsetLeft : 0),
      y: e.clientY - (vv ? vv.offsetTop : 0)
    };
  }

  function setStickFromEvent(e) {
    const rect = els.stick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const nx = (e.clientX - cx) / (rect.width * 0.42);
    const ny = (e.clientY - cy) / (rect.height * 0.42);
    const mag = Math.hypot(nx, ny);
    const cap = mag > 1 ? 1 / mag : 1;
    stick.x = nx * cap;
    stick.y = ny * cap;
    els.knob.style.transform = `translate(calc(-50% + ${stick.x * 36}%), calc(-50% + ${stick.y * 36}%))`;
  }

  function resetStick() {
    stick.active = false;
    stick.id = null;
    stick.x = 0;
    stick.y = 0;
    els.knob.style.transform = "translate(-50%, -50%)";
  }

  els.stick.addEventListener("pointerdown", e => {
    e.preventDefault();
    useTouch = true;
    stick.active = true;
    stick.id = e.pointerId;
    els.stick.setPointerCapture(e.pointerId);
    setStickFromEvent(e);
  });
  els.stick.addEventListener("pointermove", e => {
    if (!stick.active || e.pointerId !== stick.id) return;
    setStickFromEvent(e);
  });
  function endStick(e) {
    if (e.pointerId !== stick.id) return;
    resetStick();
  }
  els.stick.addEventListener("pointerup", endStick);
  els.stick.addEventListener("pointercancel", endStick);

  function bindHold(btn, on, off) {
    const down = e => { e.preventDefault(); e.stopPropagation(); on(e); };
    const up = e => { e.preventDefault(); e.stopPropagation(); off(e); };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", e => { if (e.buttons) up(e); });
  }

  bindHold(els.btnAtk, () => { attackHeld = true; }, () => { attackHeld = false; });
  els.btnDash.addEventListener("pointerdown", e => { e.preventDefault(); if (state === "play") playerDash(); });
  els.btnSkill.addEventListener("pointerdown", e => { e.preventDefault(); if (state === "play") playerSkill(); });
  els.btnUlt.addEventListener("pointerdown", e => { e.preventDefault(); if (state === "play") playerUlt(); });
  els.btnJump.addEventListener("pointerdown", e => { e.preventDefault(); if (state === "play") playerJump(); });
  els.pauseBtn.addEventListener("click", e => { e.stopPropagation(); togglePause(); });

  addEventListener("keydown", e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === "Escape") togglePause();
    if (state !== "play") return;
    if (e.key.toLowerCase() === "q") playerSkill();
    if (e.key.toLowerCase() === "f") playerUlt();
    if (e.key === " ") { e.preventDefault(); playerJump(); }
    if (e.key === "Shift") playerDash();
  });
  addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });
  addEventListener("mousemove", e => {
    const p = clientPoint(e);
    mouse.x = p.x; mouse.y = p.y;
  });
  canvas.addEventListener("pointerdown", e => {
    if (e.button !== 0 && e.pointerType !== "touch") return;
    const p = clientPoint(e);
    mouse.x = p.x; mouse.y = p.y;
    mouse.down = true;
    mouse.fromCanvas = true;
    if (e.pointerType === "touch") useTouch = true;
  });
  addEventListener("pointerup", e => {
    if (e.button === 0 || e.pointerType === "touch") {
      mouse.down = false;
      mouse.fromCanvas = false;
    }
  });
  addEventListener("mousedown", e => {
    if (e.button === 2) { mouse.right = true; if (state === "play") playerDash(); }
  });
  addEventListener("mouseup", e => {
    if (e.button === 2) mouse.right = false;
  });
  addEventListener("contextmenu", e => e.preventDefault());
  addEventListener("resize", resize);
  if (visualViewport) {
    visualViewport.addEventListener("resize", resize);
    visualViewport.addEventListener("scroll", resize);
  }
  addEventListener("orientationchange", () => setTimeout(resize, 80));
  addEventListener("touchmove", e => {
    if (state === "play" || e.target === canvas) e.preventDefault();
  }, { passive: false });

  function refreshContinue() {
    const meta = loadMeta();
    els.cont.classList.toggle("hidden", !meta);
  }

  resize();
  refreshContinue();
  requestAnimationFrame(t => { last = t; loop(t); });
})();
