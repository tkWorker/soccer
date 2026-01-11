// =============================
//  変数定義
// =============================
const c = document.getElementById("c");
const ctx = c.getContext("2d");

let mode = "move";

let drawing = false;
let dragging = false;
let selecting = false;
let panning = false;

let startPos = null;
let selectionRect = null;

let panStartX = 0;
let panStartY = 0;

// ズーム・パン
let scale = 1;
let offsetX = 0;
let offsetY = 0;

// サイズ（UIで変更可能）
let PLAYER_R = 16;
let BALL_R = 12;
let HIT_R = 20;

// データ
let paths = [];
let players = [];
let enemies = [];
let ball = { x: 600, y: 350 };

let selected = [];


// =============================
//  UIイベント
// =============================
document.getElementById("playerSize").oninput = e => {
  PLAYER_R = Number(e.target.value);
  draw();
};
document.getElementById("ballSize").oninput = e => {
  BALL_R = Number(e.target.value);
  draw();
};


// =============================
//  色を白くする
// =============================
function lightenColor(base) {
  if (base === "blue") return "#aaddff";
  if (base === "red") return "#ffbbbb";
  if (base === "black") return "#888888";
  return base;
}


// =============================
//  座標変換（画面 → 論理座標）
// =============================
function screenToWorld(clientX, clientY) {
  const rect = c.getBoundingClientRect();
  const xCanvas = clientX - rect.left;
  const yCanvas = clientY - rect.top;
  return {
    x: (xCanvas - offsetX) / scale,
    y: (yCanvas - offsetY) / scale
  };
}
// =============================
//  フォーメーション
// =============================
function set4213() {
  const base = [
    { x: 120, y: 350 },
    { x: 260, y: 150 }, { x: 260, y: 280 }, { x: 260, y: 420 }, { x: 260, y: 550 },
    { x: 480, y: 280 }, { x: 480, y: 420 },
    { x: 650, y: 300 },
    { x: 820, y: 200 }, { x: 920, y: 350 }, { x: 820, y: 500 }
  ];

  players = base.map(p => ({ x: 1200 - p.x, y: p.y }));
  enemies = base.map(p => ({ x: p.x - 40, y: p.y }));

  draw();
}

function resetAll() {
  paths = [];
  set4213();
}


// =============================
//  描画
// =============================
function drawField() {
  ctx.strokeRect(50, 50, 1100, 600);

  ctx.beginPath();
  ctx.moveTo(600, 50);
  ctx.lineTo(600, 650);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(600, 350, 80, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeRect(50, 300, 25, 100);
  ctx.strokeRect(1125, 300, 25, 100);
}

function drawCircle(o, r, col) {
  if (selected.includes(o)) col = lightenColor(col);

  ctx.beginPath();
  ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.stroke();
}

function draw() {
  ctx.clearRect(0, 0, c.width, c.height);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  drawField();

  paths.forEach(pa => {
    ctx.beginPath();
    pa.points.forEach((pt, i) =>
      i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)
    );
    ctx.stroke();
  });

  players.forEach(p => drawCircle(p, PLAYER_R, "blue"));
  enemies.forEach(p => drawCircle(p, PLAYER_R, "red"));
  drawCircle(ball, BALL_R, "black");

  if (selectionRect) {
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
    ctx.setLineDash([]);
  }

  ctx.restore();
}


// =============================
//  当たり判定
// =============================
function hit(o, p) {
  return Math.hypot(o.x - p.x, o.y - p.y) < HIT_R;
}

function hitPath(pa, p) {
  return pa.points.some(pt => Math.hypot(pt.x - p.x, pt.y - p.y) < 10);
}


// =============================
//  Z順選択
// =============================
function pickObject(p) {
  if (hit(ball, p)) return ball;

  for (let i = enemies.length - 1; i >= 0; i--)
    if (hit(enemies[i], p)) return enemies[i];

  for (let i = players.length - 1; i >= 0; i--)
    if (hit(players[i], p)) return players[i];

  return null;
}


// =============================
//  bring-to-front
// =============================
function bringToFront(o) {
  if (o === ball) return;

  if (players.includes(o)) {
    players = players.filter(x => x !== o);
    players.push(o);
  }

  if (enemies.includes(o)) {
    enemies = enemies.filter(x => x !== o);
    enemies.push(o);
  }
}
// =============================
//  pointerdown
// =============================
c.onpointerdown = e => {
  const world = screenToWorld(e.clientX, e.clientY);
  startPos = { x: world.x, y: world.y };

  const rect = c.getBoundingClientRect();
  const xCanvas = e.clientX - rect.left;
  const yCanvas = e.clientY - rect.top;

  // 中クリックパン
  if (e.button === 1) {
    panning = true;
    panStartX = xCanvas - offsetX;
    panStartY = yCanvas - offsetY;
    return;
  }

  // ペン
  if (mode === "pen") {
    drawing = true;
    paths.push({ points: [world] });
    return;
  }

  // 消しゴム
  if (mode === "eraser") {
    paths = paths.filter(pa => !hitPath(pa, world));
    draw();
    return;
  }

  // 右クリック → 範囲選択
  if (e.button === 2) {
    selecting = true;
    selected = [];  // ← 右クリック時は解除してOK
    selectionRect = {
      x: world.x,
      y: world.y,
      w: 0,
      h: 0
    };
    return;
  }

  // 左クリック → オブジェ選択
  const obj = pickObject(world);

  if (obj) {
    // ★ すでに選択されている場合は解除しない
    if (!selected.includes(obj)) {
      selected = [obj];
    }
    bringToFront(obj);
    dragging = true;
  } else {
    // ★ 何もない場所をクリックした時だけ解除
    selected = [];
  }

  draw();
};



// =============================
//  pointermove
// =============================
c.onpointermove = e => {
  const world = screenToWorld(e.clientX, e.clientY);
  const rect = c.getBoundingClientRect();
  const xCanvas = e.clientX - rect.left;
  const yCanvas = e.clientY - rect.top;

  // パン
  if (panning) {
    offsetX = xCanvas - panStartX;
    offsetY = yCanvas - panStartY;
    draw();
    return;
  }

  // ペン
  if (drawing) {
    paths.at(-1).points.push(world);
    draw();
    return;
  }

  // 範囲選択
  if (selecting) {
    selectionRect = {
      x: Math.min(startPos.x, world.x),
      y: Math.min(startPos.y, world.y),
      w: Math.abs(world.x - startPos.x),
      h: Math.abs(world.y - startPos.y)
    };

    selected = [];
    [...players, ...enemies, ball].forEach(o => {
      if (o.x > selectionRect.x &&
          o.x < selectionRect.x + selectionRect.w &&
          o.y > selectionRect.y &&
          o.y < selectionRect.y + selectionRect.h) {
        selected.push(o);
      }
    });

    draw();
    return;
  }

  // ドラッグ移動
  if (dragging) {
    const dx = world.x - startPos.x;
    const dy = world.y - startPos.y;

    selected.forEach(o => {
      o.x += dx;
      o.y += dy;
    });

    startPos = { x: world.x, y: world.y };
    draw();
    return;
  }
};


// =============================
//  pointerup（範囲選択保持版）
// =============================
c.onpointerup = e => {
  drawing = false;
  dragging = false;

  // パン終了
  if (panning) {
    panning = false;
    return;
  }

  // 範囲選択終了（選択は維持）
  if (selecting) {
    selecting = false;
    selectionRect = null;
    draw();
    return;
  }

  // ★ 選択がある場合は維持する
  if (selected.length > 0) {
    draw();
    return;
  }

  // ★ 何も選択していない時だけ解除
  selected = [];
  draw();
};


c.oncontextmenu = e => e.preventDefault();


// =============================
//  ホイールズーム（ズレなし）
// =============================
c.onwheel = e => {
  e.preventDefault();

  const rect = c.getBoundingClientRect();
  const xCanvas = e.clientX - rect.left;
  const yCanvas = e.clientY - rect.top;

  const worldBefore = screenToWorld(e.clientX, e.clientY);

  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  scale *= delta;

  offsetX = xCanvas - worldBefore.x * scale;
  offsetY = yCanvas - worldBefore.y * scale;

  draw();
};


// =============================
//  localStorage 保存
// =============================
function saveLocal() {
  localStorage.setItem("tactics",
    JSON.stringify({ players, enemies, ball, paths, PLAYER_R, BALL_R })
  );
  alert("保存しました");
}

function loadLocal() {
  const d = localStorage.getItem("tactics");
  if (d) {
    const data = JSON.parse(d);
    players = data.players;
    enemies = data.enemies;
    ball = data.ball;
    paths = data.paths;
    PLAYER_R = data.PLAYER_R;
    BALL_R = data.BALL_R;

    document.getElementById("playerSize").value = PLAYER_R;
    document.getElementById("ballSize").value = BALL_R;

    draw();
  }
}


// =============================
//  JSON保存
// =============================
function saveJSON() {
  const data = { players, enemies, ball, paths, PLAYER_R, BALL_R };
  const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "tactics.json";
  a.click();

  URL.revokeObjectURL(url);
}


// =============================
//  JSON読込
// =============================
document.getElementById("jsonFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const data = JSON.parse(reader.result);

    players = data.players;
    enemies = data.enemies;
    ball = data.ball;
    paths = data.paths;
    PLAYER_R = data.PLAYER_R;
    BALL_R = data.BALL_R;

    document.getElementById("playerSize").value = PLAYER_R;
    document.getElementById("ballSize").value = BALL_R;

    draw();
  };
  reader.readAsText(file);
});


// =============================
//  初期化
// =============================
set4213();
draw();
