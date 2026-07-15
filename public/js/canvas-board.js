/**
 * Interactive 2D Voice Board Canvas Engine
 * Handles Grid, Drag & Drop, Touch Controls, Active Voice Indicators, Whisper Lock Overlays, and Smooth Interpolation
 */

export class CanvasBoard {
  constructor(canvasElement, onPositionChange, onUserClick) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.onPositionChange = onPositionChange;
    this.onUserClick = onUserClick;

    this.localUser = { id: null, name: '', color: '#00f0ff', x: 300, y: 300, isSpeaking: false, whisperWith: null };
    this.remoteUsers = new Map(); // socketId -> { id, name, color, x, y, targetX, targetY, isSpeaking, whisperWith, peerId }

    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.avatarRadius = 26;
    this.hearingRadius = 450; // Visual spatial audio border

    this.animationFrameId = null;
    this.pulsePhase = 0;

    this.initCanvasResize();
    this.bindInputEvents();
    this.startRenderLoop();
  }

  // Auto-resize canvas to fill viewport
  initCanvasResize() {
    const resize = () => {
      const container = this.canvas.parentElement;
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
    };
    window.addEventListener('resize', resize);
    resize();
  }

  // Update or set Local User state
  setLocalUser(user) {
    this.localUser = { ...this.localUser, ...user };
  }

  // Update remote users state from socket signals
  updateRemoteUsers(userList, mySocketId) {
    const currentIds = new Set();

    userList.forEach(u => {
      if (u.id === mySocketId) return;
      currentIds.add(u.id);

      if (this.remoteUsers.has(u.id)) {
        const existing = this.remoteUsers.get(u.id);
        existing.name = u.name;
        existing.color = u.color;
        existing.targetX = u.x;
        existing.targetY = u.y;
        existing.isSpeaking = u.isSpeaking;
        existing.whisperWith = u.whisperWith;
        existing.peerId = u.peerId;
      } else {
        this.remoteUsers.set(u.id, {
          id: u.id,
          name: u.name,
          color: u.color,
          x: u.x,
          y: u.y,
          targetX: u.x,
          targetY: u.y,
          isSpeaking: u.isSpeaking,
          whisperWith: u.whisperWith,
          peerId: u.peerId
        });
      }
    });

    // Remove users who disconnected
    this.remoteUsers.forEach((user, id) => {
      if (!currentIds.has(id)) {
        this.remoteUsers.delete(id);
      }
    });
  }

  // Update specific user position
  setUserPosition(id, x, y) {
    if (id === this.localUser.id) {
      this.localUser.x = x;
      this.localUser.y = y;
    } else if (this.remoteUsers.has(id)) {
      const u = this.remoteUsers.get(id);
      u.targetX = x;
      u.targetY = y;
    }
  }

  // Update user speaking state
  setSpeakingState(id, isSpeaking) {
    if (id === this.localUser.id) {
      this.localUser.isSpeaking = isSpeaking;
    } else if (this.remoteUsers.has(id)) {
      const u = this.remoteUsers.get(id);
      u.isSpeaking = isSpeaking;
    }
  }

  // Update user whisper state
  setWhisperState(user1, user2, active) {
    [user1, user2].forEach(id => {
      const partnerId = id === user1 ? user2 : user1;
      if (id === this.localUser.id) {
        this.localUser.whisperWith = active ? partnerId : null;
      } else if (this.remoteUsers.has(id)) {
        const u = this.remoteUsers.get(id);
        u.whisperWith = active ? partnerId : null;
      }
    });
  }

  // Bind Mouse & Touch dragging and clicking
  bindInputEvents() {
    const getCoords = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const startDrag = (coords) => {
      // Check if local avatar clicked
      const dx = coords.x - this.localUser.x;
      const dy = coords.y - this.localUser.y;
      const distToLocal = Math.sqrt(dx * dx + dy * dy);

      if (distToLocal <= this.avatarRadius + 12) {
        this.isDragging = true;
        this.dragOffset = { x: dx, y: dy };
        return;
      }

      // Check if remote user avatar clicked
      let clickedRemote = null;
      this.remoteUsers.forEach((remote) => {
        const rdx = coords.x - remote.x;
        const rdy = coords.y - remote.y;
        const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
        if (rdist <= this.avatarRadius + 12) {
          clickedRemote = remote;
        }
      });

      if (clickedRemote && this.onUserClick) {
        this.onUserClick(clickedRemote);
      }
    };

    const moveDrag = (coords) => {
      if (!this.isDragging) return;

      // Constrain position within canvas viewport
      let newX = coords.x - this.dragOffset.x;
      let newY = coords.y - this.dragOffset.y;

      const pad = this.avatarRadius + 5;
      newX = Math.max(pad, Math.min(this.canvas.width - pad, newX));
      newY = Math.max(pad, Math.min(this.canvas.height - pad, newY));

      this.localUser.x = newX;
      this.localUser.y = newY;

      if (this.onPositionChange) {
        this.onPositionChange(newX, newY);
      }
    };

    const stopDrag = () => {
      this.isDragging = false;
    };

    // Mouse Listeners
    this.canvas.addEventListener('mousedown', (e) => startDrag(getCoords(e)));
    window.addEventListener('mousemove', (e) => moveDrag(getCoords(e)));
    window.addEventListener('mouseup', stopDrag);

    // Touch Listeners for Mobile Devices
    this.canvas.addEventListener('touchstart', (e) => {
      startDrag(getCoords(e));
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (this.isDragging) {
        moveDrag(getCoords(e));
      }
    }, { passive: true });

    window.addEventListener('touchend', stopDrag);
  }

  // Canvas Render Loop
  startRenderLoop() {
    const render = () => {
      this.pulsePhase += 0.05;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.drawGridBackground();
      this.drawHearingBoundary();

      // Lerp and render remote users
      this.remoteUsers.forEach((remote) => {
        // Smooth position linear interpolation (Lerp)
        remote.x += (remote.targetX - remote.x) * 0.2;
        remote.y += (remote.targetY - remote.y) * 0.2;

        this.drawAvatar(remote, false);
      });

      // Render local user on top
      this.drawAvatar(this.localUser, true);

      this.animationFrameId = requestAnimationFrame(render);
    };
    render();
  }

  // Draw Cyberpunk Grid background
  drawGridBackground() {
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.03)';
    this.ctx.lineWidth = 1;

    const gridSize = 50;
    for (let x = 0; x < this.canvas.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.canvas.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  // Draw 3D Proximity Spatial Radius Ring
  drawHearingBoundary() {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(this.localUser.x, this.localUser.y, this.hearingRadius, 0, Math.PI * 2);
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([8, 8]);
    this.ctx.stroke();
    this.ctx.restore();
  }

  // Draw individual Avatar Node
  drawAvatar(user, isLocal) {
    const { x, y, name, color, isSpeaking, whisperWith } = user;
    const r = this.avatarRadius;

    this.ctx.save();

    // 1. Active Speaking Wave Rings (Pulsing Green)
    if (isSpeaking) {
      const waveRadius = r + 8 + Math.sin(this.pulsePhase * 3) * 6;
      this.ctx.beginPath();
      this.ctx.arc(x, y, waveRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = '#10b981';
      this.ctx.lineWidth = 3;
      this.ctx.shadowColor = '#10b981';
      this.ctx.shadowBlur = 15;
      this.ctx.stroke();
    }

    // 2. Outer Glowing Avatar Ring
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);
    this.ctx.fillStyle = color || '#00f0ff';
    this.ctx.shadowColor = color || '#00f0ff';
    this.ctx.shadowBlur = isLocal ? 20 : 12;
    this.ctx.fill();

    // Inner Core Disc
    this.ctx.beginPath();
    this.ctx.arc(x, y, r - 4, 0, Math.PI * 2);
    this.ctx.fillStyle = '#0f172a';
    this.ctx.shadowBlur = 0;
    this.ctx.fill();

    // Initials letter inside avatar
    this.ctx.font = '700 15px Cairo, sans-serif';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    const initial = name ? name.trim().charAt(0).toUpperCase() : 'U';
    this.ctx.fillText(initial, x, y + 1);

    // 3. Secret Whisper Lock Overlay 🔒
    if (whisperWith) {
      this.ctx.font = '16px sans-serif';
      this.ctx.fillText('🔒', x + r - 2, y - r + 2);
    }

    // 4. Local User Indicator Badge "أنت"
    if (isLocal) {
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.font = '600 11px Cairo, sans-serif';
      this.ctx.fillText('(أنت)', x, y - r - 22);
    }

    // 5. User Name Label below avatar
    this.ctx.font = '600 13px Cairo, sans-serif';
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.shadowColor = 'rgba(0,0,0,0.8)';
    this.ctx.shadowBlur = 6;
    this.ctx.fillText(name || 'مستخدم', x, y + r + 16);

    this.ctx.restore();
  }
}
