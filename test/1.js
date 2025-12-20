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

let peer = null;
const maxConnections = 3;
const connections = new Map();
let isConnected = false;
const pendingConnections = new Set();
const knownPeers = new Set();
const GROUP_SIZE = 4;
const lobbyChannel = new BroadcastChannel("ponder-lobby");
const assignedGroupOf = new Map();
let inGroup = false;
let currentGroupId = null;
const groupMembers = new Set();
function shouldKeepConnection(localId, remoteId) { return localId < remoteId; }

function dropRemotePlayer(id) {
  if (!id) return;
  const rp = remotePlayers[id];
  if (rp) {
    try { if (rp.element && rp.element.parentNode) rp.element.parentNode.removeChild(rp.element); } catch (e) {}
    delete remotePlayers[id];
  }
  try { connections.delete(id); } catch (e) {}
  try { knownPeers.delete(id); } catch (e) {}
  try { lastPongAt.delete(id); } catch (e) {}
  updatePlayerZIndex();
}

function pruneMissingRemotePlayers() {
  const activeIds = new Set([...Array.from(connections.keys()), ...knownPeers]);
  for (const id in remotePlayers) {
    if (!activeIds.has(id) && id !== (peer && peer.id)) dropRemotePlayer(id);
  }
}

function announceToLobby() {
  const payload = { type: 'announce', id: peer.id, groupId: inGroup ? currentGroupId : null };
  try { lobbyChannel.postMessage(payload); } catch (e) {}
}

function broadcastGroupFormed(members, groupId) {
  try { lobbyChannel.postMessage({ type: 'group-formed', groupId, members }); } catch (e) {}
}

lobbyChannel.onmessage = (ev) => {
  const msg = ev.data;
  if (!msg || typeof msg.type !== 'string') return;
  if (msg.type === 'announce') {
    if (typeof msg.id === 'string') {
      if (msg.groupId) assignedGroupOf.set(msg.id, msg.groupId); else if (!assignedGroupOf.has(msg.id)) assignedGroupOf.set(msg.id, null);
      if (!inGroup) attemptFormGroup();
      if (!inGroup && (!assignedGroupOf.get(msg.id))) {
        if (!connections.has(msg.id) && !pendingConnections.has(msg.id)) connectToPeerOnce(msg.id);
      }
    }
  } else if (msg.type === 'group-formed') {
    if (!Array.isArray(msg.members) || !msg.groupId) return;
    msg.members.forEach(id => assignedGroupOf.set(id, msg.groupId));
    if (msg.members.includes(peer.id)) activateGroup(msg.members.slice(), msg.groupId);
  }
};

function makeGroupId(sortedArray) { return 'g:' + sortedArray.join('|'); }

function connectToPeerOnce(targetPeerId) {
  if (!peer || !targetPeerId || targetPeerId === peer.id) return;
  const assigned = assignedGroupOf.get(targetPeerId);
  if (assigned && (!inGroup || assigned !== currentGroupId)) return;
  if (connections.has(targetPeerId) || pendingConnections.has(targetPeerId)) return;
  pendingConnections.add(targetPeerId);
  const conn = peer.connect(targetPeerId);
  conn.on('open', () => {
    pendingConnections.delete(targetPeerId);
    const nowAssigned = assignedGroupOf.get(targetPeerId);
    if (nowAssigned && (!inGroup || nowAssigned !== currentGroupId)) {
      try { conn.close(); } catch (e) {}
      return;
    }
    connections.set(targetPeerId, conn);
    knownPeers.add(targetPeerId);
    isConnected = true;
    onConnectionOpened(targetPeerId);
    propagateConnections();
  });
  conn.on('data', (data) => handleIncomingData(data, conn));
  conn.on('close', () => handleDisconnect(targetPeerId));
  conn.on('error', () => handleDisconnect(targetPeerId));
}

function handleDisconnect(peerId) {
  pendingConnections.delete(peerId);
  connections.delete(peerId);
  knownPeers.delete(peerId);
  groupMembers.delete(peerId);
  dropRemotePlayer(peerId);
  propagateConnections();
  pruneMissingRemotePlayers();
}

function attemptFormGroup() {
  if (inGroup) return;
  const candidates = new Set();
  assignedGroupOf.forEach((g, id) => { if (!g) candidates.add(id); });
  knownPeers.forEach(id => { if (!assignedGroupOf.get(id)) candidates.add(id); });
  connections.forEach((_, id) => { if (!assignedGroupOf.get(id)) candidates.add(id); });
  if (!assignedGroupOf.has(peer.id) || assignedGroupOf.get(peer.id) === null) candidates.add(peer.id);
  const sorted = Array.from(candidates).sort();
  if (sorted.length < GROUP_SIZE) return;
  for (let i = 0; i <= sorted.length - GROUP_SIZE; i += GROUP_SIZE) {
    const slice = sorted.slice(i, i + GROUP_SIZE);
    if (!slice.includes(peer.id)) continue;
    let anyAssigned = false;
    for (const id of slice) {
      const g = assignedGroupOf.get(id);
      if (g && g !== null) { anyAssigned = true; break; }
    }
    if (anyAssigned) continue;
    const groupId = makeGroupId(slice.slice().sort());
    slice.forEach(id => assignedGroupOf.set(id, groupId));
    broadcastGroupFormed(slice, groupId);
    activateGroup(slice, groupId);
    return;
  }
}

function handleGroupFormedMessage(msg) {
  const members = Array.isArray(msg.members) ? msg.members : [];
  if (members.length !== GROUP_SIZE) return;
  if (!members.includes(peer.id)) return;
  const groupId = msg.groupId || makeGroupId(members.slice().sort());
  activateGroup(members, groupId);
}

function activateGroup(memberArray, groupId) {
  inGroup = true;
  currentGroupId = groupId;
  groupMembers.clear();
  memberArray.forEach(id => groupMembers.add(id));
  memberArray.forEach(id => assignedGroupOf.set(id, groupId));
  announceToLobby();
  connections.forEach((conn, id) => {
    if (!groupMembers.has(id)) {
      try { conn.close(); } catch (e) {}
      connections.delete(id);
    }
  });
  memberArray.forEach(id => {
    if (id === peer.id) return;
    if (!connections.has(id) && !pendingConnections.has(id)) connectToPeerOnce(id);
  });
  propagateConnections();
}

function acceptIncomingConnection(conn) {
  const remote = conn.peer;
  if (inGroup && !groupMembers.has(remote)) { try { conn.close(); } catch (e) {} return false; }
  const remoteAssigned = assignedGroupOf.get(remote);
  if (remoteAssigned && remoteAssigned !== currentGroupId) { try { conn.close(); } catch (e) {} return false; }
  return true;
}

function propagateConnections() {
  const snapshot = Array.from(new Set([ ...connections.keys(), ...knownPeers, peer.id ]));
  connections.forEach(conn => {
    try { conn.send({ type: 'peers-snapshot', from: peer.id, peers: snapshot, groupId: inGroup ? currentGroupId : null }); } catch (e) {}
  });
  pruneMissingRemotePlayers();
}

function handleIncomingData(data, conn) {
  if (!data || !data.type) return;
  if (data.type === 'peers-snapshot') {
    const sender = data.from || (conn && conn.peer);
    if (sender && typeof data.groupId === 'string') assignedGroupOf.set(sender, data.groupId);
    if (Array.isArray(data.peers)) {
      data.peers.forEach(pId => {
        if (!pId || pId === peer.id) return;
        if (!assignedGroupOf.has(pId)) assignedGroupOf.set(pId, null);
        const assigned = assignedGroupOf.get(pId);
        if (assigned && (!inGroup || assigned !== currentGroupId)) return;
        if (!connections.has(pId) && !pendingConnections.has(pId)) connectToPeerOnce(pId);
      });
    }
    if (sender && !knownPeers.has(sender)) knownPeers.add(sender);
    if (!inGroup) attemptFormGroup();
  } else if (data.type === 'position') {
    updateRemotePlayerPosition(data);
  } else if (data.type === 'ping') {
    const sender = data.from || (conn && conn.peer);
    if (sender) markPeerAlive(sender);
    if (conn) safeSendPong(conn);
  } else if (data.type === 'pong') {
    const sender = data.from || (conn && conn.peer);
    if (sender) markPeerAlive(sender);
  } else if (data.type === 'group-formed') {
    if (Array.isArray(data.members) && data.groupId) {
      data.members.forEach(id => assignedGroupOf.set(id, data.groupId));
      if (data.members.includes(peer.id)) activateGroup(data.members.slice(), data.groupId);
    }
  } else if (data.type === 'hit') {
    console.log(`You've been hit by ${data.from}!`);
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
      }
    }
  }
}

let lastBroadcastTime = 0;
const broadcastInterval = 69;
function broadcastPosition() {
  const now = Date.now();
  if (isConnected && (now - lastBroadcastTime > broadcastInterval)) {
    const pos = { type: 'position', id: peer.id, x: player.positionX, y: player.positionY };
    connections.forEach(conn => { try { conn.send(pos); } catch (e) {} });
    lastBroadcastTime = now;
  }
}

const lastPongAt = new Map();
const PING_INTERVAL_MS = 3000;
const PRUNE_THRESHOLD_MS = 3000;
function safeSendPing(conn) { try { conn.send({ type: 'ping', from: peer.id, ts: Date.now() }); } catch (e) {} }
function safeSendPong(conn) { try { conn.send({ type: 'pong', from: peer.id, ts: Date.now() }); } catch (e) {} }
function markPeerAlive(peerId) { lastPongAt.set(peerId, Date.now()); }
function onConnectionOpened(peerId) { markPeerAlive(peerId); }

const keepaliveInterval = setInterval(() => {
  const now = Date.now();
  connections.forEach((conn, id) => {
    if (!conn) return;
    try { if (typeof conn.open === 'boolean' ? conn.open : true) { safeSendPing(conn); } } catch (e) {}
  });
  for (const [peerId, tp] of lastPongAt.entries()) {
    if (!connections.has(peerId)) { lastPongAt.delete(peerId); continue; }
    if (now - tp > PRUNE_THRESHOLD_MS) {
      try { const conn = connections.get(peerId); if (conn) try { conn.close(); } catch (e) {} } catch (e) {}
      try { connections.delete(peerId); } catch (e) {}
      try { knownPeers.delete(peerId); } catch (e) {}
      dropRemotePlayer(peerId);
      lastPongAt.delete(peerId);
      propagateConnections();
      pruneMissingRemotePlayers();
    }
  }
}, PING_INTERVAL_MS);

window.addEventListener('beforeunload', () => { try { clearInterval(keepaliveInterval); } catch (e) {} });

function updateRemotePlayerSprite(remotePlayer, vx, vy) {
  if (!remotePlayer) return;
  if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) { remotePlayer.velocityX = 0; remotePlayer.velocityY = 0; } else { remotePlayer.velocityX = vx; remotePlayer.velocityY = vy; }
  spriteController.updateSprite(remotePlayer);
}

function initializePeer() {
  peer = new Peer(undefined, { debug: 2 });
  peer.on('open', (id) => { console.log(`Peer started with ID: ${id}`); announceToLobby(); });
  peer.on('connection', (conn) => {
    if (conn.peer === peer.id || connections.has(conn.peer)) return;
    if (!acceptIncomingConnection(conn)) return;
    conn.on('open', () => {
      if (!acceptIncomingConnection(conn)) return;
      connections.set(conn.peer, conn);
      knownPeers.add(conn.peer);
      isConnected = true;
      onConnectionOpened(conn.peer);
      propagateConnections();
    });
    conn.on('data', (data) => handleIncomingData(data, conn));
    conn.on('close', () => handleDisconnect(conn.peer));
    conn.on('error', () => handleDisconnect(conn.peer));
  });
  peer.on('error', (err) => { console.error('Peer error:', err); });
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