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
    getAudioTracks(): MediaStreamTrack[];
    getVideoTracks(): MediaStreamTrack[];
    addTrack(track: MediaStreamTrack): void;
  }

  export class MediaStreamTrack {
    kind: string;
    id: string;
    enabled: boolean;
    stop(): void;
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

  // Nonstandard APIs
  export const nonstandard: {
    RTCAudioSink: typeof RTCAudioSink;
    RTCAudioSource: typeof RTCAudioSource;
    RTCVideoSink: any;
    RTCVideoSource: any;
    i420ToRgba: any;
    rgbaToI420: any;
  };

  export interface AudioFrame {
    samples: Int16Array;
    sampleRate: number;
  }

  export class RTCAudioSink {
    constructor(track: MediaStreamTrack);
    ondata: ((frame: AudioFrame) => void) | null;
    stop(): void;
  }

  export class RTCAudioSource {
    constructor();
    createTrack(): MediaStreamTrack;
    onData(frame: AudioFrame): void;
  }
}
