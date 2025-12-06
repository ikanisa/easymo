declare module 'wrtc' {
  export class RTCPeerConnection {
    constructor(config?: RTCConfiguration);
    onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null;
    ontrack: ((event: RTCTrackEvent) => void) | null;
    onconnectionstatechange: (() => void) | null;
    connectionState: RTCPeerConnectionState;
    createOffer(): Promise<RTCSessionDescriptionInit>;
    createAnswer(): Promise<RTCSessionDescriptionInit>;
    setLocalDescription(description: RTCSessionDescriptionInit): Promise<void>;
    setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void>;
    addTrack(track: MediaStreamTrack, stream: MediaStream): RTCRtpSender;
    close(): void;
    localDescription: RTCSessionDescription | null;
    remoteDescription: RTCSessionDescription | null;
  }

  export type RTCPeerConnectionState = 
    | 'new'
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'failed'
    | 'closed';

  export class RTCSessionDescription {
    constructor(description: RTCSessionDescriptionInit);
    type: RTCSdpType;
    sdp: string;
  }

  export class MediaStream {
    constructor();
    getTracks(): MediaStreamTrack[];
    addTrack(track: MediaStreamTrack): void;
  }

  export interface MediaStreamTrack {
    kind: string;
    id: string;
    enabled: boolean;
  }

  export interface RTCConfiguration {
    iceServers?: RTCIceServer[];
  }

  export interface RTCIceServer {
    urls: string | string[];
    username?: string;
    credential?: string;
  }

  export interface RTCSessionDescriptionInit {
    type: RTCSdpType;
    sdp?: string;
  }

  export type RTCSdpType = 'offer' | 'answer' | 'pranswer' | 'rollback';

  export interface RTCPeerConnectionIceEvent {
    candidate: RTCIceCandidate | null;
  }

  export interface RTCIceCandidate {
    candidate: string;
    sdpMid: string | null;
    sdpMLineIndex: number | null;
  }

  export interface RTCTrackEvent {
    track: MediaStreamTrack;
    streams: MediaStream[];
  }

  export interface RTCRtpSender {
    track: MediaStreamTrack | null;
  }
}
