/**
 * Spatial Audio Engine - Web Audio API 3D Proximity Panning
 * Handles AudioContext, PannerNodes, Gain ducking, Voice Activity Detection, and Whisper Isolation
 */

export class SpatialAudioEngine {
  constructor() {
    this.audioCtx = null;
    this.localStream = null;
    this.analyser = null;
    this.peerAudioNodes = new Map(); // peerId -> { source, panner, gain, audioElement }
    this.localPos = { x: 300, y: 300 };
    this.isWhispering = false;
    this.whisperPartnerId = null;
    this.vadInterval = null;
  }

  // Initialize or unlock AudioContext on user interaction
  async initAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  // Capture local microphone stream and setup Volume Analyser (VAD)
  async captureLocalMicrophone(onSpeakingChange, onVolumeMeter) {
    await this.initAudioContext();

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      // Setup VAD Analyser
      const source = this.audioCtx.createMediaStreamSource(this.localStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);

      this.startVAD(onSpeakingChange, onVolumeMeter);
      return this.localStream;
    } catch (err) {
      console.error('[AudioEngine] Microphone access error:', err);
      throw err;
    }
  }

  // Voice Activity Detection loop
  startVAD(onSpeakingChange, onVolumeMeter) {
    let lastSpeakingState = false;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    if (this.vadInterval) clearInterval(this.vadInterval);

    this.vadInterval = setInterval(() => {
      if (!this.analyser) return;

      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const normalizedVolume = Math.min(100, Math.round((average / 128) * 100));

      if (onVolumeMeter) onVolumeMeter(normalizedVolume);

      // Speaking threshold (RMS value)
      const isSpeaking = normalizedVolume > 12;
      if (isSpeaking !== lastSpeakingState) {
        lastSpeakingState = isSpeaking;
        if (onSpeakingChange) onSpeakingChange(isSpeaking);
      }
    }, 100);
  }

  // Set local listener position
  setListenerPosition(x, y) {
    this.localPos = { x, y };
    if (!this.audioCtx) return;

    const listener = this.audioCtx.listener;
    if (listener.positionX) {
      listener.positionX.setTargetAtTime(x, this.audioCtx.currentTime, 0.05);
      listener.positionY.setTargetAtTime(y, this.audioCtx.currentTime, 0.05);
      listener.positionZ.setTargetAtTime(0, this.audioCtx.currentTime, 0.05);
    } else {
      // Fallback for older browsers
      listener.setPosition(x, y, 0);
    }

    // Update spatial audio for all connected remote peers
    this.peerAudioNodes.forEach((node, peerId) => {
      this.updatePeerAudioPosition(peerId, node.pos?.x || x, node.pos?.y || y);
    });
  }

  // Attach dynamic Web Audio nodes for remote user media stream
  attachPeerAudio(peerId, stream, pos = { x: 300, y: 300 }) {
    this.initAudioContext();

    // Clean old nodes if re-attaching
    this.detachPeerAudio(peerId);

    // Hidden audio element to keep browser stream active
    const audioElement = new Audio();
    audioElement.srcObject = stream;
    audioElement.autoplay = true;
    audioElement.muted = true; // Audio routed through Web Audio API context

    const source = this.audioCtx.createMediaStreamSource(stream);
    const panner = this.audioCtx.createPanner();
    const gain = this.audioCtx.createGain();

    // Configure Spatial Panner Node
    panner.panningModel = 'HRTF'; // Realistic 3D directional audio
    panner.distanceModel = 'inverse'; // Smooth, natural distance roll-off
    panner.refDistance = 60; // Distance at which sound is 100% volume
    panner.maxDistance = 1200; // Max attenuation distance
    panner.rolloffFactor = 1.2;
    panner.coneInnerAngle = 360;

    // Initial node position
    panner.setPosition(pos.x, pos.y, 0);

    // Audio Graph routing: Source -> Panner -> Gain -> Destination (Speakers)
    source.connect(panner);
    panner.connect(gain);
    gain.connect(this.audioCtx.destination);

    this.peerAudioNodes.set(peerId, {
      source,
      panner,
      gain,
      audioElement,
      pos
    });

    this.updatePeerAudioPosition(peerId, pos.x, pos.y);
  }

  // Update a peer's 3D position in Web Audio Graph smoothly without clicks
  updatePeerAudioPosition(peerId, x, y) {
    const node = this.peerAudioNodes.get(peerId);
    if (!node) return;

    node.pos = { x, y };

    if (node.panner.positionX) {
      node.panner.positionX.setTargetAtTime(x, this.audioCtx.currentTime, 0.05);
      node.panner.positionY.setTargetAtTime(y, this.audioCtx.currentTime, 0.05);
      node.panner.positionZ.setTargetAtTime(0, this.audioCtx.currentTime, 0.05);
    } else {
      node.panner.setPosition(x, y, 0);
    }

    // Handle Volume ducking depending on distance and Whisper state
    const dx = x - this.localPos.x;
    const dy = y - this.localPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let targetGain = 1.0;

    if (this.isWhispering) {
      // If currently in a Secret Whisper:
      // Direct whisper partner gets crisp 100% audio with no distance decay.
      // All other public room participants are ducked to near silence (0.01).
      if (peerId === this.whisperPartnerId) {
        targetGain = 1.0;
      } else {
        targetGain = 0.001; // Silent / ducked
      }
    } else {
      // General Room Mode: Smooth distance attenuation algorithm to prevent clipping/choppiness
      const MAX_HEARING_DIST = 900;
      if (distance > MAX_HEARING_DIST) {
        targetGain = 0.0;
      } else {
        targetGain = Math.max(0, 1 - (distance / MAX_HEARING_DIST));
        targetGain = Math.pow(targetGain, 1.5); // Smooth logarithmic fade
      }
    }

    // Ramp gain value exponentially to eliminate clicks/pops
    node.gain.gain.setTargetAtTime(targetGain, this.audioCtx.currentTime, 0.05);
  }

  // Set Whisper Mode
  setWhisperMode(active, partnerPeerId = null) {
    this.isWhispering = active;
    this.whisperPartnerId = partnerPeerId;

    // Refresh audio gain for all connected peers
    this.peerAudioNodes.forEach((node, peerId) => {
      this.updatePeerAudioPosition(peerId, node.pos.x, node.pos.y);
    });
  }

  // Mute / Unmute Local Mic
  setMute(isMuted) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }

  // Remove peer audio node on disconnect
  detachPeerAudio(peerId) {
    const node = this.peerAudioNodes.get(peerId);
    if (node) {
      try {
        node.source.disconnect();
        node.panner.disconnect();
        node.gain.disconnect();
        if (node.audioElement) {
          node.audioElement.pause();
          node.audioElement.srcObject = null;
        }
      } catch (e) {
        console.warn('[AudioEngine] Cleanup warning:', e);
      }
      this.peerAudioNodes.delete(peerId);
    }
  }
}
