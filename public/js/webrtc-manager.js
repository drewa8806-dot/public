/**
 * WebRTC Manager - PeerJS low-latency Mesh connection handler
 */

export class WebRTCManager {
  constructor(spatialAudio) {
    this.spatialAudio = spatialAudio;
    this.peer = null;
    this.peerId = null;
    this.activeCalls = new Map(); // peerId -> mediaCall
    this.connectedPeerIds = new Set();
  }

  // Initialize PeerJS client targeting our local integrated PeerJS server
  initPeer() {
    return new Promise((resolve, reject) => {
      const port = location.port ? Number(location.port) : (location.protocol === 'https:' ? 443 : 80);
      
      this.peer = new Peer(undefined, {
        host: location.hostname,
        port: port,
        path: '/peerjs',
        secure: location.protocol === 'https:',
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        this.peerId = id;
        console.log(`[WebRTC] Peer initialized with ID: ${id}`);
        resolve(id);
      });

      this.peer.on('call', (call) => {
        console.log(`[WebRTC] Incoming call from peer: ${call.peer}`);
        // Answer incoming call with local microphone stream
        const localStream = this.spatialAudio.localStream;
        call.answer(localStream);
        this.handleCallStream(call);
      });

      this.peer.on('error', (err) => {
        console.error('[WebRTC] Peer error:', err);
      });

      this.peer.on('disconnected', () => {
        console.warn('[WebRTC] Peer disconnected. Attempting reconnect...');
        this.peer.reconnect();
      });
    });
  }

  // Connect / Call a remote user by their PeerJS ID
  connectToPeer(targetPeerId, userPos) {
    if (!targetPeerId || targetPeerId === this.peerId) return;
    if (this.activeCalls.has(targetPeerId)) return;

    console.log(`[WebRTC] Calling target peer: ${targetPeerId}`);
    const localStream = this.spatialAudio.localStream;
    const call = this.peer.call(targetPeerId, localStream);

    if (call) {
      call.userPos = userPos;
      this.handleCallStream(call);
    }
  }

  // Handle incoming media stream on a media call
  handleCallStream(call) {
    const remotePeerId = call.peer;
    this.activeCalls.set(remotePeerId, call);

    call.on('stream', (remoteStream) => {
      console.log(`[WebRTC] Received remote audio stream from peer: ${remotePeerId}`);
      this.spatialAudio.attachPeerAudio(remotePeerId, remoteStream, call.userPos || { x: 300, y: 300 });
    });

    call.on('close', () => {
      console.log(`[WebRTC] Media call closed with peer: ${remotePeerId}`);
      this.spatialAudio.detachPeerAudio(remotePeerId);
      this.activeCalls.delete(remotePeerId);
    });

    call.on('error', (err) => {
      console.error(`[WebRTC] Call error with ${remotePeerId}:`, err);
      this.spatialAudio.detachPeerAudio(remotePeerId);
      this.activeCalls.delete(remotePeerId);
    });
  }

  // Disconnect a specific peer
  closeCall(peerId) {
    const call = this.activeCalls.get(peerId);
    if (call) {
      call.close();
      this.activeCalls.delete(peerId);
    }
    this.spatialAudio.detachPeerAudio(peerId);
  }

  // Destroy peer on app exit
  destroy() {
    if (this.peer) {
      this.peer.destroy();
    }
  }
}
