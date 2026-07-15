/**
 * UI Manager - Controls Modals, Cyberpunk Screen Transitions, Mute controls, and PWA Installation
 */

export class UIManager {
  constructor() {
    this.deferredInstallPrompt = null;
    this.selectedColor = '#00f0ff';

    this.bindColorPicker();
    this.bindPWAInstall();
  }

  // Handle color swatch selections on Welcome Screen
  bindColorPicker() {
    const colorBtns = document.querySelectorAll('.color-btn');
    colorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        colorBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedColor = btn.dataset.color || '#00f0ff';
      });
    });
  }

  // Bind PWA Installation Prompt
  bindPWAInstall() {
    const installBtn = document.getElementById('pwa-install-btn');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;
      if (installBtn) {
        installBtn.classList.remove('hidden');
      }
    });

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (!this.deferredInstallPrompt) return;
        this.deferredInstallPrompt.prompt();
        const { outcome } = await this.deferredInstallPrompt.userChoice;
        console.log(`[PWA] Install prompt outcome: ${outcome}`);
        this.deferredInstallPrompt = null;
        installBtn.classList.add('hidden');
      });
    }
  }

  // Screen Switcher
  switchScreen(screenId) {
    document.querySelectorAll('.screen-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
    }
  }

  // Set Local Profile Info Header
  setProfileBadge(name, color) {
    const miniAvatar = document.getElementById('my-mini-avatar');
    const nameDisplay = document.getElementById('my-name-display');

    if (miniAvatar) {
      miniAvatar.style.backgroundColor = color;
      miniAvatar.style.boxShadow = `0 0 10px ${color}`;
    }
    if (nameDisplay) {
      nameDisplay.textContent = name;
    }
  }

  // Update Online User Counter
  updateOnlineCount(count) {
    const counter = document.getElementById('online-count');
    if (counter) counter.textContent = count;
  }

  // Toggle Mic Button State
  setMicButtonState(isMuted) {
    const micBtn = document.getElementById('mic-toggle-btn');
    const label = document.getElementById('mic-btn-label');
    const micOn = micBtn.querySelector('.mic-on-icon');
    const micOff = micBtn.querySelector('.mic-off-icon');

    if (isMuted) {
      micBtn.classList.remove('active');
      micBtn.classList.add('muted');
      if (label) label.textContent = 'المايك مكتوم';
      if (micOn) micOn.classList.add('hidden');
      if (micOff) micOff.classList.remove('hidden');
    } else {
      micBtn.classList.remove('muted');
      micBtn.classList.add('active');
      if (label) label.textContent = 'المايك مفعّل';
      if (micOn) micOn.classList.remove('hidden');
      if (micOff) micOff.classList.add('hidden');
    }
  }

  // Update Volume Meter Indicator
  updateVolumeMeter(volumePercent) {
    const meter = document.getElementById('my-volume-meter');
    if (meter) {
      meter.style.width = `${volumePercent}%`;
    }
  }

  // Show Avatar Action Modal (Clicking another user)
  showUserActionModal(targetUser, onRequestWhisper) {
    const modal = document.getElementById('user-action-modal');
    const targetName = document.getElementById('action-target-name');
    const targetAvatar = document.getElementById('action-target-avatar');
    const reqBtn = document.getElementById('send-whisper-req-btn');
    const cancelBtn = document.getElementById('close-action-modal-btn');

    if (targetName) targetName.textContent = targetUser.name;
    if (targetAvatar) {
      targetAvatar.style.backgroundColor = targetUser.color || '#00f0ff';
      targetAvatar.style.boxShadow = `0 0 10px ${targetUser.color || '#00f0ff'}`;
    }

    modal.classList.remove('hidden');

    const handleReq = () => {
      cleanup();
      modal.classList.add('hidden');
      if (onRequestWhisper) onRequestWhisper(targetUser.id);
    };

    const handleCancel = () => {
      cleanup();
      modal.classList.add('hidden');
    };

    const cleanup = () => {
      reqBtn.removeEventListener('click', handleReq);
      cancelBtn.removeEventListener('click', handleCancel);
    };

    reqBtn.addEventListener('click', handleReq);
    cancelBtn.addEventListener('click', handleCancel);
  }

  // Show Incoming Whisper Request Modal
  showWhisperInviteModal(requesterName, onAccept, onDecline) {
    const modal = document.getElementById('whisper-invite-modal');
    const inviterName = document.getElementById('whisper-inviter-name');
    const acceptBtn = document.getElementById('accept-whisper-btn');
    const declineBtn = document.getElementById('decline-whisper-btn');

    if (inviterName) inviterName.textContent = requesterName;

    modal.classList.remove('hidden');

    const handleAccept = () => {
      cleanup();
      modal.classList.add('hidden');
      if (onAccept) onAccept();
    };

    const handleDecline = () => {
      cleanup();
      modal.classList.add('hidden');
      if (onDecline) onDecline();
    };

    const cleanup = () => {
      acceptBtn.removeEventListener('click', handleAccept);
      declineBtn.removeEventListener('click', handleDecline);
    };

    acceptBtn.addEventListener('click', handleAccept);
    declineBtn.addEventListener('click', handleDecline);
  }

  // Toggle Floating Active Whisper Header Banner
  setWhisperBanner(active, partnerName = '') {
    const banner = document.getElementById('whisper-active-bar');
    const nameSpan = document.getElementById('whisper-partner-name');

    if (active) {
      if (nameSpan) nameSpan.textContent = partnerName;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }
}
