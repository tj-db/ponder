/* Copyright and author note:
   Written and created by Thomas John-Michael de Beer
   (contact: tjdebeer@gmail.com) */

let player = {
  element: document.getElementById('player'),
  positionX: 1000,
  positionY: 1000,
  velocityX: 0,
  velocityY: 0,
  friction: 0.85,
  maxVelocity: 6,
  acceleration: 0.65,
  spriteIndex: 1,
  idleFrameTime: 0,
  movingKeys: {}
};

const remotePlayers = {};
const monsters = {};
const gameMap = document.getElementById('game-map');
const playerElement = document.getElementById('player');

function updatePlayerZIndex() {
  const allPlayers = [];
  allPlayers.push({ element: playerElement, y: player.positionY, id: 'local' });
  for (const id in remotePlayers) {
    const rp = remotePlayers[id];
    if (rp && rp.element) allPlayers.push({ element: rp.element, y: rp.yPercent, id });
  }
  allPlayers.sort((a, b) => a.y - b.y);
  allPlayers.forEach((p, i) => { p.element.style.zIndex = i + 1; });
}

function checkPlayerCollisions() {
  const playerRadius = 30;
  for (const id in remotePlayers) {
    const remotePlayer = remotePlayers[id];
    if (!remotePlayer || !remotePlayer.element) continue;
    const dx = player.positionX - remotePlayer.xPercent;
    const dy = player.positionY - remotePlayer.yPercent;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < playerRadius * 2) {
      handlePlayerCollision(dx, dy, distance, playerRadius * 2);
    }
  }
}

function handlePlayerCollision(dx, dy, distance, minDistance) {
  if (distance === 0) return;
  const normalX = dx / distance;
  const normalY = dy / distance;
  const overlap = minDistance - distance;
  const separation = overlap * 0.5;
  player.positionX += normalX * separation;
  player.positionY += normalY * separation;
  const relVx = player.velocityX;
  const relVy = player.velocityY;
  const velAlong = relVx * normalX + relVy * normalY;
  if (velAlong > 0) return;
  const restitution = 0.3;
  const impulse = -(1 + restitution) * velAlong;
  player.velocityX += impulse * normalX;
  player.velocityY += impulse * normalY;
}

function checkCollision() {
  const playerX = player.positionX + playerElement.offsetWidth / 2;
  const playerY = player.positionY + playerElement.offsetHeight / 2;
  const playerRadius = 30;
  const obstaclePath = document.getElementById('obstacle-path');
  if (!obstaclePath) return;
  const pathLength = obstaclePath.getTotalLength();
  let isIntersecting = false;
  let closestPoint = null;
  let closestDistance = Infinity;
  for (let i = 0; i < pathLength; i++) {
    const point = obstaclePath.getPointAtLength(i);
    const dist = Math.hypot(point.x - playerX, point.y - playerY);
    if (dist <= playerRadius) {
      isIntersecting = true;
      if (dist < closestDistance) { closestDistance = dist; closestPoint = point; }
    }
  }
  if (isIntersecting && closestPoint) handleCollision(closestPoint);
}

function handleCollision(closestPoint) {
  const playerX = player.positionX + playerElement.offsetWidth / 2;
  const playerY = player.positionY + playerElement.offsetHeight / 2;
  const dx = closestPoint.x - playerX;
  const dy = closestPoint.y - playerY;
  const mag = Math.sqrt(dx * dx + dy * dy);
  if (mag === 0) return;
  const ux = dx / mag;
  const uy = dy / mag;
  const dot = player.velocityX * ux + player.velocityY * uy;
  if (dot > 0) {
    const reflectFactor = 6.0;
    player.velocityX -= dot * ux * reflectFactor;
    player.velocityY -= dot * uy * reflectFactor;
  }
}

window.addEventListener("gamepadconnected", (e) => { inputController.gamepadIndex = e.gamepad.index; console.log("Gamepad connected:", e.gamepad.id); });
window.addEventListener("gamepaddisconnected", () => { inputController.gamepadIndex = null; console.log("Gamepad disconnected"); });

const inputController = {
  gamepadIndex: null,
  keys: { w: false, a: false, s: false, d: false },
  updateVelocity: () => {
    if (inputController.keys.w || player.movingKeys['ArrowUp']) player.velocityY -= player.acceleration;
    if (inputController.keys.s || player.movingKeys['ArrowDown']) player.velocityY += player.acceleration;
    if (inputController.keys.a || player.movingKeys['ArrowLeft']) player.velocityX -= player.acceleration;
    if (inputController.keys.d || player.movingKeys['ArrowRight']) player.velocityX += player.acceleration;
    if (inputController.gamepadIndex !== null) {
      const gp = navigator.getGamepads()[inputController.gamepadIndex];
      if (gp) {
        const ax = gp.axes[0];
        const ay = gp.axes[1];
        if (Math.abs(ax) > 0.1) player.velocityX += ax * player.acceleration;
        if (Math.abs(ay) > 0.1) player.velocityY += ay * player.acceleration;
      }
    }
  }
};

const spriteController = {
  updateSprite: (character) => {
    const { velocityX = 0, velocityY = 0 } = character;
    const direction = getDirection(velocityX, velocityY);
    character.idleFrameTime = (character.idleFrameTime || 0) + 1;
    if (character.idleFrameTime > 10) {
      const frame = character.spriteIndex || 1;
      if (character.element) character.element.className = `${direction}${frame}`;
      character.spriteIndex = frame === 3 ? 1 : frame + 1;
      character.idleFrameTime = 0;
    }
  }
};

function getDirection(vx, vy) {
  if (vx === 0 && vy === 0) return 'idle';
  const angle = Math.atan2(-vy, vx) * (180 / Math.PI);
  const normalized = (angle + 360) % 360;
  const directions = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
  const idx = Math.floor((normalized + 22.5) / 45) % 8;
  return directions[idx];
}

document.addEventListener('keydown', (ev) => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(ev.key)) player.movingKeys[ev.key] = true;
  if (['w','a','s','d'].includes(ev.key)) inputController.keys[ev.key] = true;
  if (ev.code === 'Space') performAttack();
});

document.addEventListener('keyup', (ev) => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(ev.key)) player.movingKeys[ev.key] = false;
  if (['w','a','s','d'].includes(ev.key)) inputController.keys[ev.key] = false;
});

function performAttack() {
  const attackRadius = 244;
  const playerCenterX = player.positionX + playerElement.offsetWidth / 2;
  const playerCenterY = player.positionY + playerElement.offsetHeight / 2;
  let direction = (player.velocityX === 0 && player.velocityY === 0) ? Math.PI / 2 : Math.atan2(player.velocityY, player.velocityX);
  const dashStrength = 1111;
  player.velocityX += Math.cos(direction) * dashStrength;
  player.velocityY += Math.sin(direction) * dashStrength;
  player.friction = 1.0;
  setTimeout(() => { player.friction = 0.85; }, 111);

  const visualizer = document.getElementById('attack-visualizer');
  if (visualizer) {
    visualizer.innerHTML = '';
    const arcPath = describeArc(playerCenterX, playerCenterY, attackRadius, direction - Math.PI / 6, direction + Math.PI / 6);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", arcPath);
    path.setAttribute("fill", "rgba(255,0,0,0.3)");
    path.setAttribute("stroke", "red");
    path.setAttribute("stroke-width", "2");
    visualizer.appendChild(path);
    setTimeout(() => { visualizer.innerHTML = ''; }, 300);
  }

  for (const id in remotePlayers) {
    const remote = remotePlayers[id];
    if (!remote || !remote.element) continue;
    const remoteX = remote.xPercent + 50;
    const remoteY = remote.yPercent + 50;
    const dx = remoteX - playerCenterX;
    const dy = remoteY - playerCenterY;
    const distance = Math.hypot(dx, dy);
    if (distance <= attackRadius) {
      const angleToRemote = Math.atan2(dy, dx);
      let angleDiff = angleToRemote - direction;
      angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
      if (Math.abs(angleDiff) <= Math.PI / 2) {
        const conn = connections.get(id);
        if (conn) {
          try { conn.send({ type: 'hit', from: peer.id, attackerX: player.positionX, attackerY: player.positionY }); } catch (e) {}
        }
      }
    }
  }
}

function polarToCartesian(cx, cy, r, angleRad) {
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}
function describeArc(cx, cy, r, startAngleRad, endAngleRad) {
  const start = polarToCartesian(cx, cy, r, endAngleRad);
  const end = polarToCartesian(cx, cy, r, startAngleRad);
  const largeArcFlag = endAngleRad - startAngleRad <= Math.PI ? "0" : "1";
  return ["M " + cx + " " + cy, "L " + start.x + " " + start.y, "A " + r + " " + r + " 0 " + largeArcFlag + " 0 " + end.x + " " + end.y, "Z"].join(" ");
}

function createPlayer(id, isLocal) {
  const playerDiv = document.createElement('div');
  playerDiv.className = 'remotePlayer';
  playerDiv.style.position = 'absolute';
  playerDiv.style.width = '100px';
  playerDiv.style.height = '100px';
  playerDiv.style.left = '0px';
  playerDiv.style.top = '0px';
  playerDiv.style.backgroundImage = 'url("spritesheet.png")';
  gameMap.appendChild(playerDiv);
  return { id, element: playerDiv, positionX: 0, positionY: 0, targetX: 0, targetY: 0, xPercent: 0, yPercent: 0, spriteIndex: 1, idleFrameTime: 0, velocityX: 0, velocityY: 0 };
}

function updateRemotePlayerPositionOnScreen(remotePlayer) {
  if (remotePlayer && remotePlayer.element) {
    remotePlayer.element.style.left = `${remotePlayer.xPercent}px`;
    remotePlayer.element.style.top = `${remotePlayer.yPercent}px`;
  }
}

function updateRemotePlayerSprite(remotePlayer, vx, vy) {
  if (!remotePlayer) return;
  if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) { remotePlayer.velocityX = 0; remotePlayer.velocityY = 0; } else { remotePlayer.velocityX = vx; remotePlayer.velocityY = vy; }
  spriteController.updateSprite(remotePlayer);
}

function interpolatePosition(remotePlayer, targetXPercent, targetYPercent) {
  const f = 0.8;
  const dx = targetXPercent - remotePlayer.xPercent;
  const dy = targetYPercent - remotePlayer.yPercent;
  remotePlayer.xPercent += dx * f;
  remotePlayer.yPercent += dy * f;
  const vx = dx * f;
  const vy = dy * f;
  updateRemotePlayerPositionOnScreen(remotePlayer);
  updateRemotePlayerSprite(remotePlayer, vx, vy);
}

function updateRemotePlayerPosition(data) {
  if (!data || !data.id) return;
  if (!remotePlayers[data.id]) remotePlayers[data.id] = createPlayer(data.id, false);
  const rp = remotePlayers[data.id];
  rp.targetXPercent = data.x;
  rp.targetYPercent = data.y;
  interpolatePosition(rp, rp.targetXPercent, rp.targetYPercent);
  const vx = (rp.targetXPercent || rp.xPercent) - rp.xPercent;
  const vy = (rp.targetYPercent || rp.yPercent) - rp.yPercent;
  updateRemotePlayerSprite(rp, vx, vy);
}


/* ============================
   Peer initialization and connection handling
   ============================ */

let peer = null;
let peeridno = 0;
const maxConnections = 3;
const connections = new Map();
let isConnected = false;
const pendingConnections = new Set();
const knownPeers = new Set();

let lastBroadcastTime = 0;
const broadcastInterval = 69;

let inGroup = false;
let currentGroupId = null;
const groupMembers = new Set();

let sweepIntervalId = null;
const SWEEP_MAX_ATTEMPTS = 50;
const SWEEP_DELAY_MS = 200;
const TARGET_RETRY_BASE_MS = 2000;
const TARGET_RETRY_MAX_MS = 60000;
const PENDING_CAP = 3;
const failedTargets = new Map();

function shouldKeepConnection(localId, remoteId) {
  return localId < remoteId;
}

function recordFailedTarget(targetId) {
  const entry = failedTargets.get(targetId) || { attempts: 0, last: 0 };
  entry.attempts = Math.min(10, entry.attempts + 1);
  entry.last = Date.now();
  failedTargets.set(targetId, entry);
}
function clearFailedTarget(targetId) {
  failedTargets.delete(targetId);
}
function canAttemptTarget(targetId) {
  const entry = failedTargets.get(targetId);
  if (!entry) return true;
  const backoff = Math.min(TARGET_RETRY_MAX_MS, TARGET_RETRY_BASE_MS * Math.pow(2, Math.max(0, entry.attempts - 1)));
  return (Date.now() - entry.last) > backoff;
}

function onConnectionOpened(peerId) {
  try { markPeerAlive(peerId); } catch (e) {}
  try { sendPositionImmediate(); } catch (e) {}
  if (!inGroup) {
    inGroup = true;
    currentGroupId = `g:${peer.id}|${peerId}`;
    groupMembers.clear();
    groupMembers.add(peer.id);
    groupMembers.add(peerId);
    stopSweep();
  }
}

function stopSweep() {
  if (!sweepIntervalId) return;
  clearInterval(sweepIntervalId);
  sweepIntervalId = null;
}

function startSweep() {
  if (!peer) return;
  if (inGroup) return;
  if (sweepIntervalId) return;
  let attemptIndex = 0;
  sweepIntervalId = setInterval(() => {
    if (!peer) { stopSweep(); return; }
    if (inGroup || connections.size >= maxConnections || attemptIndex > SWEEP_MAX_ATTEMPTS) { stopSweep(); return; }
    const target = `ponderstatichost${attemptIndex}`;
    if (target !== peer.id && !connections.has(target) && !pendingConnections.has(target) && canAttemptTarget(target)) {
      if (pendingConnections.size < PENDING_CAP) {
        if (shouldKeepConnection(peer.id, target)) {
          connectToPeerOnce(target);
        } else {
          setTimeout(() => {
            if (!connections.has(target) && !pendingConnections.has(target) && canAttemptTarget(target)) connectToPeerOnce(target);
          }, 200 + Math.floor(Math.random() * 400));
        }
      }
    }
    attemptIndex++;
  }, SWEEP_DELAY_MS);
}

function sendPositionImmediate(targetConn) {
  if (!peer) return;
  const pos = { type: 'position', id: peer.id, x: player.positionX, y: player.positionY, ts: Date.now() };
  if (targetConn) {
    try { targetConn.send(pos); } catch (e) {}
  } else {
    connections.forEach(conn => { try { conn.send(pos); } catch (e) {} });
  }
  lastBroadcastTime = Date.now();
}

function sendImpulse(vx, vy, targetConn) {
  if (!peer) return;
  const msg = { type: 'impulse', from: peer.id, vx, vy, ts: Date.now() };
  if (targetConn) {
    try { targetConn.send(msg); } catch (e) {}
  } else {
    connections.forEach(conn => { try { conn.send(msg); } catch (e) {} });
  }
}

function connectToPeerOnce(targetPeerId) {
  if (!peer || !targetPeerId) return;
  if (targetPeerId === peer.id) return;
  if (connections.has(targetPeerId) || pendingConnections.has(targetPeerId)) return;
  if (!canAttemptTarget(targetPeerId)) return;
  if (inGroup) return;
  if (pendingConnections.size >= PENDING_CAP) return;

  pendingConnections.add(targetPeerId);
  const conn = peer.connect(targetPeerId);

  conn.on('open', () => {
    pendingConnections.delete(targetPeerId);
    clearFailedTarget(targetPeerId);

    if (!connections.has(targetPeerId)) {
      connections.set(targetPeerId, conn);
      knownPeers.add(targetPeerId);
      isConnected = true;
      onConnectionOpened(targetPeerId);
      try { conn.send({ type: 'peers-snapshot', from: peer.id, peers: Array.from(knownPeers).concat(peer.id), groupId: inGroup ? currentGroupId : null }); } catch (e) {}
      propagateConnections();
    } else {
      if (!shouldKeepConnection(peer.id, targetPeerId)) {
        try { conn.close(); } catch (e) {}
        return;
      } else {
        const old = connections.get(targetPeerId);
        try { if (old && old !== conn) old.close(); } catch (e) {}
        connections.set(targetPeerId, conn);
        knownPeers.add(targetPeerId);
        onConnectionOpened(targetPeerId);
        try { conn.send({ type: 'peers-snapshot', from: peer.id, peers: Array.from(knownPeers).concat(peer.id), groupId: inGroup ? currentGroupId : null }); } catch (e) {}
        propagateConnections();
      }
    }

    if (connections.size > 0 && !inGroup) {
      inGroup = true;
      currentGroupId = `g:${peer.id}|${targetPeerId}`;
      groupMembers.clear();
      groupMembers.add(peer.id);
      groupMembers.add(targetPeerId);
      stopSweep();
    }

    sendPositionImmediate(conn);
    sendPositionImmediate();
  });

  conn.on('data', (data) => handleIncomingData(data, conn));

  conn.on('close', () => {
    pendingConnections.delete(targetPeerId);
    connections.delete(targetPeerId);
    knownPeers.delete(targetPeerId);
    try { dropRemotePlayer(targetPeerId); } catch (e) {}
    try { propagateConnections(); } catch (e) {}
    try { pruneMissingRemotePlayers(); } catch (e) {}
    if (!inGroup && connections.size < maxConnections) startSweep();
  });

  conn.on('error', () => {
    pendingConnections.delete(targetPeerId);
    connections.delete(targetPeerId);
    knownPeers.delete(targetPeerId);
    try { dropRemotePlayer(targetPeerId); } catch (e) {}
    try { propagateConnections(); } catch (e) {}
    try { pruneMissingRemotePlayers(); } catch (e) {}
    recordFailedTarget(targetPeerId);
    if (!inGroup && connections.size < maxConnections) startSweep();
  });

  return conn;
}

function propagateConnections() {
  const snapshot = Array.from(new Set([ ...Array.from(connections.keys()), ...knownPeers, peer.id ]));
  connections.forEach(conn => {
    try { conn.send({ type: 'peers-snapshot', from: peer.id, peers: snapshot, groupId: inGroup ? currentGroupId : null }); } catch (e) {}
  });
  try { pruneMissingRemotePlayers(); } catch (e) {}
}

function handleIncomingData(data, conn) {
  if (!data || !data.type) return;

  if (typeof data.groupId === 'string' && data.groupId) {
    inGroup = true;
    currentGroupId = data.groupId;
    if (Array.isArray(data.members)) {
      groupMembers.clear();
      data.members.forEach(m => groupMembers.add(m));
    } else {
      const sender = data.from || (conn && conn.peer);
      if (sender) groupMembers.add(sender);
    }
    stopSweep();
  }

  if (data.type === 'peers-snapshot') {
    const sender = data.from || (conn && conn.peer);
    if (sender) {
      knownPeers.add(sender);
      if (!connections.has(sender)) {
        if (conn && conn.peer === sender) {
          connections.set(sender, conn);
          knownPeers.add(sender);
          isConnected = true;
          onConnectionOpened(sender);
        }
      }
    }

    if (Array.isArray(data.peers)) {
      data.peers.forEach(pId => {
        if (!pId || pId === peer.id) return;
        knownPeers.add(pId);
        if (connections.has(pId) || pendingConnections.has(pId)) return;
        if (!canAttemptTarget(pId)) return;
        if (inGroup) return;
        if (shouldKeepConnection(peer.id, pId)) {
          connectToPeerOnce(pId);
        } else {
          setTimeout(() => {
            if (!connections.has(pId) && !pendingConnections.has(pId) && canAttemptTarget(pId) && !inGroup) connectToPeerOnce(pId);
          }, 800 + Math.floor(Math.random() * 400));
        }
      });
    }

    try { conn.send({ type: 'peers-snapshot', from: peer.id, peers: Array.from(new Set([ ...Array.from(connections.keys()), ...knownPeers, peer.id ])), groupId: inGroup ? currentGroupId : null }); } catch (e) {}
    try { pruneMissingRemotePlayers(); } catch (e) {}

  } else if (data.type === 'initial-connections' || data.type === 'connect-to-others') {
    const arr = data.data || data.peers;
    if (Array.isArray(arr)) {
      arr.forEach(pId => {
        if (!pId || pId === peer.id) return;
        knownPeers.add(pId);
        if (!connections.has(pId) && !pendingConnections.has(pId) && canAttemptTarget(pId) && !inGroup) {
          if (shouldKeepConnection(peer.id, pId)) {
            connectToPeerOnce(pId);
          } else {
            setTimeout(() => {
              if (!connections.has(pId) && !pendingConnections.has(pId) && canAttemptTarget(pId) && !inGroup) connectToPeerOnce(pId);
            }, 800 + Math.floor(Math.random() * 400));
          }
        }
      });
    }

  } else if (data.type === 'group-formed') {
    if (Array.isArray(data.members) && data.groupId) {
      inGroup = true;
      currentGroupId = data.groupId;
      groupMembers.clear();
      data.members.forEach(id => groupMembers.add(id));
      stopSweep();
    }

  } else if (data.type === 'position') {
    try { updateRemotePlayerPosition(data); } catch (e) {}
  } else if (data.type === 'impulse') {
    const from = data.from;
    const vx = data.vx || 0;
    const vy = data.vy || 0;
    if (from && remotePlayers[from]) {
      const rp = remotePlayers[from];
      rp.velocityX = (rp.velocityX || 0) + vx;
      rp.velocityY = (rp.velocityY || 0) + vy;
      try { updateRemotePlayerSprite(rp, rp.velocityX, rp.velocityY); } catch (e) {}
    } else if (from && from === peer.id) {
      player.velocityX += vx;
      player.velocityY += vy;
      player.forceBroadcast = true;
    }
  } else if (data.type === 'ping') {
    const sender = data.from || (conn && conn.peer);
    if (sender) markPeerAlive(sender);
    if (conn) safeSendPong(conn);
  } else if (data.type === 'pong') {
    const sender = data.from || (conn && conn.peer);
    if (sender) markPeerAlive(sender);
  } else if (data.type === 'hit') {
    if (typeof data.attackerX === 'number' && typeof data.attackerY === 'number') {
      const dx = player.positionX - data.attackerX;
      const dy = player.positionY - data.attackerY;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        const kb = 8;
        const nx = dx / dist;
        const ny = dy / dist;
        player.velocityX += nx * kb;
        player.velocityY += ny * kb;
        player.forceBroadcast = true;
        sendImpulse(nx * kb, ny * kb);
      }
    }
  }
}

function broadcastPosition() {
  const now = Date.now();
  if (!peer) return;
  if (isConnected && (now - lastBroadcastTime > broadcastInterval)) {
    const pos = { type: 'position', id: peer.id, x: player.positionX, y: player.positionY, ts: Date.now() };
    connections.forEach(conn => { try { conn.send(pos); } catch (e) {} });
    lastBroadcastTime = now;
  }
}

function initializePeer() {
  const peerId = `ponderstatichost${peeridno}`;
  peer = new Peer(peerId, { debug: 2 });

  peer.on('open', () => {
    startSweep();
  });

  peer.on('connection', (conn) => {
    if (conn.peer === peer.id || connections.size >= maxConnections) {
      try { conn.close(); } catch (e) {}
      return;
    }

    conn.on('open', () => {
      if (connections.has(conn.peer)) {
        if (!shouldKeepConnection(peer.id, conn.peer)) {
          const existing = connections.get(conn.peer);
          try { if (existing && existing !== conn) existing.close(); } catch (e) {}
          connections.set(conn.peer, conn);
        } else {
          try { conn.close(); } catch (e) {}
          return;
        }
      } else {
        connections.set(conn.peer, conn);
      }

      knownPeers.add(conn.peer);
      isConnected = true;
      onConnectionOpened(conn.peer);

      if (connections.size >= maxConnections) stopSweep();

      try { conn.send({ type: 'peers-snapshot', from: peer.id, peers: Array.from(new Set([ ...Array.from(connections.keys()), ...knownPeers, peer.id ])), groupId: inGroup ? currentGroupId : null }); } catch (e) {}
      propagateConnections();

      sendPositionImmediate(conn);
      sendPositionImmediate();
    });

    conn.on('data', (data) => handleIncomingData(data, conn));
    conn.on('close', () => {
      connections.delete(conn.peer);
      knownPeers.delete(conn.peer);
      try { dropRemotePlayer(conn.peer); } catch (e) {}
      try { propagateConnections(); } catch (e) {}
      try { pruneMissingRemotePlayers(); } catch (e) {}
      if (!inGroup && connections.size < maxConnections) startSweep();
    });
    conn.on('error', () => {
      connections.delete(conn.peer);
      knownPeers.delete(conn.peer);
      try { dropRemotePlayer(conn.peer); } catch (e) {}
      try { propagateConnections(); } catch (e) {}
      try { pruneMissingRemotePlayers(); } catch (e) {}
      if (!inGroup && connections.size < maxConnections) startSweep();
    });
  });

  peer.on('error', (err) => {
    if (err && err.type === 'unavailable-id') {
      peeridno++;
      setTimeout(() => initializePeer(), 50 + Math.floor(Math.random() * 200));
    } else {
      console.error('Peer error', err);
    }
  });
}

initializePeer();




function updateGame() {
  inputController.updateVelocity();
  player.velocityX *= player.friction;
  player.velocityY *= player.friction;
  if (Math.abs(player.velocityX) < 0.2) player.velocityX = 0;
  if (Math.abs(player.velocityY) < 0.2) player.velocityY = 0;
  const mag = Math.hypot(player.velocityX, player.velocityY);
  if (mag > player.maxVelocity) {
    player.velocityX = (player.velocityX / mag) * player.maxVelocity;
    player.velocityY = (player.velocityY / mag) * player.maxVelocity;
  }
  player.positionX += player.velocityX;
  player.positionY += player.velocityY;
  checkCollision();
  checkPlayerCollisions();
  playerElement.style.left = `${player.positionX}px`;
  playerElement.style.top = `${player.positionY}px`;
  gameMap.style.left = `-${player.positionX - window.innerWidth / 2}px`;
  gameMap.style.top = `-${player.positionY - window.innerHeight / 2}px`;
  spriteController.updateSprite(player);
  for (const id in remotePlayers) {
    const rp = remotePlayers[id];
    if (rp) {
      const vx = (rp.targetXPercent || rp.xPercent) - rp.xPercent;
      const vy = (rp.targetYPercent || rp.yPercent) - rp.yPercent;
      updateRemotePlayerSprite(rp, vx, vy);
    }
  }
  updatePlayerZIndex();
  const currentTime = performance.now();
  if (Math.abs(player.velocityX) > 0.2 || Math.abs(player.velocityY) > 0.2 || currentTime - lastBroadcastTime >= 1000) {
    broadcastPosition();
    lastBroadcastTime = currentTime;
  }
  requestAnimationFrame(updateGame);
}

updateGame();
