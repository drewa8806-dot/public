/**
 * ShadowVoice - Main Client Application Orchestrator
 */

import { SpatialAudioEngine } from './spatial-audio.js';
import { WebRTCManager } from './webrtc-manager.js';
import { CanvasBoard } from './canvas-board.js';
import { UIManager } from './ui.js';

class ShadowVoiceApp {
  constructor() {
    this.socket = null;
    this.spatialAudio = new SpatialAudioEngine();
    this.webrtc = new WebRTCManager(this.spatialAudio);
    this.ui = new UIManager();
    this.canvasBoard = null;

    this.isMuted = false;
    this.activeWhisperPartnerSocketId = null;

    this.registerServiceWorker();
    this.bindWelcomeEvents();
  }

  // Register PWA Service Worker
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(reg => console.log('[PWA] Service Worker registered:', reg.scope))
          .catch(err => console.error('[PWA] Service Worker registration failed:', err));
      });
    }
  }

  // Bind Join Room Form Events
  bindWelcomeEvents() {
    const joinForm = document.getElementById('join-form');
    joinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('username-input');
      const name = usernameInput.value.trim() || 'المستخدم';
      const color = this.ui.selectedColor;

      try {
        await this.startSession(name, color);
      } catch (err) {
        alert('تعذر الوصول إلى المايكروفون. يرجى السماح بالصوت للدخول إلى الغرفة.');
        console.error('[App] Start session failed:', err);
      }
    });
  }

  // Start Voice Session
  async startSession(name, color) {
    // 1. Setup Audio Engine & Capture Mic
    await this.spatialAudio.captureLocalMicrophone(
      (isSpeaking) => {
        if (this.socket) {
          this.socket.emit('speaking_state', { isSpeaking });
          this.canvasBoard.setSpeakingState(this.socket.id, isSpeaking);
        }
      },
      (volumePercent) => {
        this.ui.updateVolumeMeter(volumePercent);
      }
    );

    // 2. Initialize PeerJS WebRTC
    const peerId = await this.webrtc.initPeer();

    // 3. Connect Socket.IO
    this.socket = io();

    // Set initial canvas board
    const initialPos = {
      x: Math.random() * (window.innerWidth * 0.6) + (window.innerWidth * 0.2),
      y: Math.random() * (window.innerHeight * 0.5) + (window.innerHeight * 0.2)
    };

    const canvasElem = document.getElementById('voice-board-canvas');
    this.canvasBoard = new CanvasBoard(
      canvasElem,
      (x, y) => {
        // Dragging Callback
        this.spatialAudio.setListenerPosition(x, y);
        this.socket.emit('update_position', { x, y });
      },
      (targetUser) => {
        // Click Remote User Avatar
        this.ui.showUserActionModal(targetUser, (targetSocketId) => {
          this.socket.emit('whisper_request', { targetId: targetSocketId });
        });
      }
    );

    this.canvasBoard.setLocalUser({
      name,
      color,
      x: initialPos.x,
      y: initialPos.y
    });

    this.spatialAudio.setListenerPosition(initialPos.x, initialPos.y);

    // 4. Register Socket Handlers
    this.setupSocketEvents(name, color, initialPos, peerId);

    // 5. Setup Action Buttons (Mic Toggle, Center Me, Leave Whisper)
    this.bindControlDeck();

    // Switch UI Screen
    this.ui.setProfileBadge(name, color);
    this.ui.switchScreen('board-screen');
  }

  // Socket Signal Handlers
  setupSocketEvents(name, color, initialPos, peerId) {
    // Emit join signal
    this.socket.emit('join_room', {
      name,
      color,
      position: initialPos,
      peerId
    });

    // 1. Initial Existing Users
    this.socket.on('existing_users', (userList) => {
      this.canvasBoard.localUser.id = this.socket.id;
      this.canvasBoard.updateRemoteUsers(userList, this.socket.id);
      this.ui.updateOnlineCount(userList.length);

      // Connect WebRTC calls to all existing peers
      userList.forEach(user => {
        if (user.id !== this.socket.id && user.peerId) {
          this.webrtc.connectToPeer(user.peerId, { x: user.x, y: user.y });
        }
      });
    });

    // 2. New User Joined
    this.socket.on('user_joined', (user) => {
      console.log(`[App] New user joined: ${user.name}`);
      this.canvasBoard.updateRemoteUsers([user], this.socket.id);
      this.ui.updateOnlineCount(this.canvasBoard.remoteUsers.size + 1);

      if (user.peerId) {
        this.webrtc.connectToPeer(user.peerId, { x: user.x, y: user.y });
      }
    });

    // 3. Remote Position Updates
    this.socket.on('position_updated', (data) => {
      this.canvasBoard.setUserPosition(data.id, data.x, data.y);

      // Lookup peer ID for this socket ID to update Web Audio Panner
      const remoteUser = this.canvasBoard.remoteUsers.get(data.id);
      if (remoteUser && remoteUser.peerId) {
        this.spatialAudio.updatePeerAudioPosition(remoteUser.peerId, data.x, data.y);
      }
    });

    // 4. Speaking State Updates
    this.socket.on('speaking_state_changed', (data) => {
      this.canvasBoard.setSpeakingState(data.id, data.isSpeaking);
    });

    // 5. Incoming Secret Whisper Invitation Request
    this.socket.on('incoming_whisper_request', (data) => {
      this.ui.showWhisperInviteModal(
        data.requesterName,
        () => {
          // Accepted
          this.socket.emit('whisper_response', {
            requesterId: data.requesterId,
            accepted: true
          });
        },
        () => {
          // Declined
          this.socket.emit('whisper_response', {
            requesterId: data.requesterId,
            accepted: false
          });
        }
      );
    });

    // 6. Whisper Started Signal
    this.socket.on('whisper_started', ({ user1, user2 }) => {
      this.canvasBoard.setWhisperState(user1, user2, true);

      const isMyWhisper = (user1 === this.socket.id || user2 === this.socket.id);
      if (isMyWhisper) {
        const partnerSocketId = (user1 === this.socket.id) ? user2 : user1;
        this.activeWhisperPartnerSocketId = partnerSocketId;

        const partnerUser = this.canvasBoard.remoteUsers.get(partnerSocketId);
        const partnerName = partnerUser ? partnerUser.name : 'مستخدم';

        // Enable Whisper mode in Web Audio API (Ducks all general room users, isolates whisper partner)
        if (partnerUser && partnerUser.peerId) {
          this.spatialAudio.setWhisperMode(true, partnerUser.peerId);
        }

        this.ui.setWhisperBanner(true, partnerName);
      }
    });

    // 7. Whisper Ended Signal
    this.socket.on('whisper_ended', ({ user1, user2 }) => {
      this.canvasBoard.setWhisperState(user1, user2, false);

      const wasMyWhisper = (user1 === this.socket.id || user2 === this.socket.id);
      if (wasMyWhisper) {
        this.activeWhisperPartnerSocketId = null;
        this.spatialAudio.setWhisperMode(false, null);
        this.ui.setWhisperBanner(false);
      }
    });

    // 8. Whisper Declined Notification
    this.socket.on('whisper_declined', ({ targetName }) => {
      alert(`عذراً، ${targetName} غير متاح للهمس حالياً أو رفض الطلب.`);
    });

    // 9. User Left Cleanup
    this.socket.on('user_left', (data) => {
      const remoteUser = this.canvasBoard.remoteUsers.get(data.id);
      if (remoteUser && remoteUser.peerId) {
        this.webrtc.closeCall(remoteUser.peerId);
      }
      this.canvasBoard.remoteUsers.delete(data.id);
      this.ui.updateOnlineCount(this.canvasBoard.remoteUsers.size + 1);
    });
  }

  // Control Deck Event Listeners
  bindControlDeck() {
    // Mic Mute Button
    const micBtn = document.getElementById('mic-toggle-btn');
    micBtn.addEventListener('click', () => {
      this.isMuted = !this.isMuted;
      this.spatialAudio.setMute(this.isMuted);
      this.ui.setMicButtonState(this.isMuted);
    });

    // Center Me Button
    const centerBtn = document.getElementById('center-me-btn');
    centerBtn.addEventListener('click', () => {
      const viewport = document.getElementById('canvas-viewport');
      const centerX = viewport.clientWidth / 2;
      const centerY = viewport.clientHeight / 2;

      this.canvasBoard.setLocalUser({ x: centerX, y: centerY });
      this.spatialAudio.setListenerPosition(centerX, centerY);
      if (this.socket) {
        this.socket.emit('update_position', { x: centerX, y: centerY });
      }
    });

    // End Whisper Button
    const leaveWhisperBtn = document.getElementById('leave-whisper-btn');
    leaveWhisperBtn.addEventListener('click', () => {
      if (this.socket) {
        this.socket.emit('whisper_end');
      }
    });
  }
}

// Initialize application on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.shadowVoiceApp = new ShadowVoiceApp();
});
