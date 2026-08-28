const areas = [
  { range: [1, 10], name: "🏚️ Die alte Stadt", difficulty: "★" },
  { range: [11, 20], name: "🌲 Der schwarze Wald", difficulty: "★★" },
  { range: [21, 30], name: "🏰 Das verlassene Schloss", difficulty: "★★★" },
  { range: [31, 40], name: "🌫️ Die Nebellande", difficulty: "★★★★" },
  { range: [41, 49], name: "🔥 Die Unterwelt", difficulty: "★★★★★" },
  { range: [50, 50], name: "👹 Das letzte Reich", difficulty: "☠️" }
];

const characterData = {
  youth: { name: "🎧 Jugendlicher", hp: 110, atk: 13, speed: 4 },
  puma: { name: "🐆 Puma mit Helm", hp: 120, atk: 12, speed: 5 },
  werewolf: { name: "🐺 Werwolf", hp: 100, atk: 10, speed: 3 }
};

const state = {
  level: 1,
  checkpoint: 1,
  player: null,
  enemy: null
};

const els = {
  startScreen: document.getElementById("start-screen"),
  gameScreen: document.getElementById("game-screen"),
  startBtn: document.getElementById("start-game"),
  cards: [...document.querySelectorAll(".character-card")],
  hudCharacter: document.getElementById("hud-character"),
  hudLevel: document.getElementById("hud-level"),
  hudArea: document.getElementById("hud-area"),
  hudHp: document.getElementById("hud-hp"),
  enemyName: document.getElementById("enemy-name"),
  enemyDesc: document.getElementById("enemy-desc"),
  enemyStats: document.getElementById("enemy-stats"),
  attackBtn: document.getElementById("attack-btn"),
  skillBtn: document.getElementById("skill-btn"),
  healBtn: document.getElementById("heal-btn"),
  log: document.getElementById("log")
};

function getArea(level) {
  return areas.find(a => level >= a.range[0] && level <= a.range[1]);
}

function createEnemy(level) {
  const power = Math.floor(level * 1.7);
  const hp = 45 + power * 4;
  const atk = 6 + Math.floor(power / 2);
  let type = "Kreatur";
  if (level >= 10) type = "Schnelles Monster";
  if (level >= 20) type = "Fähigkeiten-Monster";
  if (level >= 30) type = "Elite-Monster";
  if (level >= 40) type = "Riesenkreatur";
  if (level >= 49) type = "Apokalypse-Bestie";
  if (level === 50) type = "Endgegner";
  return { name: `${type} L${level}`, hp, maxHp: hp, atk };
}

function log(text) {
  const p = document.createElement("p");
  p.textContent = text;
  els.log.prepend(p);
}

function save() {
  localStorage.setItem("ndb-save", JSON.stringify({
    level: state.level,
    checkpoint: state.checkpoint,
    player: state.player
  }));
}

function loadSave() {
  const raw = localStorage.getItem("ndb-save");
  if (!raw) return;
  const data = JSON.parse(raw);
  if (data?.player) {
    state.level = data.level || 1;
    state.checkpoint = data.checkpoint || 1;
    state.player = data.player;
    startGame(true);
  }
}

function updateHud() {
  const area = getArea(state.level);
  els.hudCharacter.textContent = state.player.name;
  els.hudLevel.textContent = `Level ${state.level}/50`;
  els.hudArea.textContent = `${area.name} ${area.difficulty}`;
  els.hudHp.textContent = `HP: ${state.player.hp}/${state.player.maxHp}`;
}

function spawnLevel() {
  state.enemy = createEnemy(state.level);
  els.enemyName.textContent = state.enemy.name;
  els.enemyDesc.textContent = `Feindliche Präsenz in ${getArea(state.level).name}`;
  els.enemyStats.textContent = `HP ${state.enemy.hp} | Angriff ${state.enemy.atk}`;
  updateHud();
  save();
}

function applyCharacterScaling() {
  const zone = Math.floor((state.level - 1) / 10);
  if (state.player.key === "werewolf") {
    state.player.atk = 10 + zone * 3;
    state.player.maxHp = 100 + zone * 16;
  } else if (state.player.key === "youth") {
    state.player.atk = 13 + zone * 2;
    state.player.maxHp = 110 + zone * 10;
  } else {
    state.player.atk = 12 + zone * 2;
    state.player.maxHp = 120 + zone * 12;
  }
  state.player.hp = Math.min(state.player.hp, state.player.maxHp);
}

function enemyTurn() {
  if (state.enemy.hp <= 0) return;
  state.player.hp -= state.enemy.atk;
  if (state.player.hp <= 0) {
    state.player.hp = 0;
    updateHud();
    log("Du wurdest besiegt. Du kehrst zum letzten Speicherpunkt zurück.");
    state.level = state.checkpoint;
    state.player.hp = state.player.maxHp;
    applyCharacterScaling();
    spawnLevel();
    return;
  }
  updateHud();
}

function checkVictory() {
  if (state.enemy.hp > 0) return false;
  log(`Du hast ${state.enemy.name} besiegt.`);
  if (state.level % 5 === 0 && state.level < 50) {
    state.checkpoint = state.level + 1;
    log(`Speicherpunkt erreicht: Level ${state.checkpoint}`);
  }
  if (state.level === 50) {
    log("👑 Sieg! Du hast Nacht der Bestien abgeschlossen.");
    localStorage.removeItem("ndb-save");
    els.attackBtn.disabled = true;
    els.skillBtn.disabled = true;
    els.healBtn.disabled = true;
    return true;
  }
  state.level += 1;
  applyCharacterScaling();
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + 12);
  spawnLevel();
  return true;
}

els.cards.forEach(card => {
  card.addEventListener("click", () => {
    els.cards.forEach(c => c.classList.remove("selected"));
    card.classList.add("selected");
    const key = card.dataset.character;
    state.player = {
      key,
      ...characterData[key],
      maxHp: characterData[key].hp
    };
    els.startBtn.disabled = false;
  });
});

function startGame(fromSave = false) {
  els.startScreen.classList.add("hidden");
  els.gameScreen.classList.remove("hidden");
  els.attackBtn.disabled = false;
  els.skillBtn.disabled = false;
  els.healBtn.disabled = false;
  if (!fromSave) {
    state.level = 1;
    state.checkpoint = 1;
    state.player.hp = state.player.maxHp;
  }
  applyCharacterScaling();
  spawnLevel();
  log("Die Jagd beginnt.");
}

els.startBtn.addEventListener("click", () => startGame(false));

els.attackBtn.addEventListener("click", () => {
  const dmg = state.player.atk + Math.floor(Math.random() * 6);
  state.enemy.hp -= dmg;
  log(`Du verursachst ${dmg} Schaden.`);
  if (checkVictory()) return;
  enemyTurn();
});

els.skillBtn.addEventListener("click", () => {
  let dmg = state.player.atk;
  if (state.player.key === "youth") {
    dmg += 14;
    log("Du nutzt Geräuschortung für einen präzisen Treffer.");
  } else if (state.player.key === "puma") {
    dmg += 16;
    log("Du springst mit Helmstoß auf den Gegner.");
  } else {
    dmg += 10;
    if (state.level >= 31) {
      const drain = 10;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + drain);
      log(`Lebensraub aktiviert: +${drain} HP.`);
    }
    log("Du entfesselst wilde Werwolfkraft.");
  }
  state.enemy.hp -= dmg;
  log(`Spezialangriff verursacht ${dmg} Schaden.`);
  if (checkVictory()) return;
  enemyTurn();
});

els.healBtn.addEventListener("click", () => {
  const heal = 12 + Math.floor(state.level / 5);
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);
  log(`Du sammelst Fokus und regenerierst ${heal} HP.`);
  updateHud();
  enemyTurn();
});

loadSave();
