jest.mock('../../../common/env', () => ({
  env: {
    openaiApiKey: 'sk-test',
    realtimeModel: 'gpt-test',
  },
}));

const fetchMock = jest.fn();
jest.mock('undici', () => ({ fetch: (...args: unknown[]) => fetchMock(...args) }));

const pcInstances: any[] = [];
class MockRTCPeerConnection {
  public localDescription: any = null;
  public remoteDescription: any = null;
  public configuration: any = null;
  public ontrack: ((event: any) => void) | null = null;
  public transceivers: any[] = [];

  constructor() {
    pcInstances.push(this);
  }

  createOffer() {
    return Promise.resolve({ sdp: 'offer-sdp' });
  }

  setLocalDescription(desc: any) {
    this.localDescription = desc;
    return Promise.resolve();
  }

  setRemoteDescription(desc: any) {
    this.remoteDescription = desc;
    return Promise.resolve();
  }

  addTrack(): any {
    return {};
  }

  addTransceiver(): any {
    const transceiver = {
      sender: {
        track: null,
        setStreams: jest.fn(),
        replaceTrack: jest.fn(async (track: any) => {
          transceiver.sender.track = track;
        }),
      },
    };
    this.transceivers.push(transceiver);
    return transceiver;
  }

  close() {
    /*noop*/
  }

  setConfiguration(config: any) {
    this.configuration = config;
  }
}

jest.mock('wrtc', () => ({ RTCPeerConnection: MockRTCPeerConnection }));

const { createRealtimePeer } = require('./openai-realtime-webrtc') as typeof import('./openai-realtime-webrtc');

describe('createRealtimePeer', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    pcInstances.splice(0, pcInstances.length);
  });

  it('creates peer connection, exchanges SDP and configures ICE servers', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ sdp: 'answer-sdp', iceServers: [{ urls: ['stun:test'] }] }),
    });

    const peer = await createRealtimePeer({ callId: 'CALL123', onRemoteTrack: jest.fn() });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [[url, options]] = fetchMock.mock.calls as [[string, { method: string; body: string }]];
    expect(url).toBe('https://api.openai.com/v1/realtime/sdp');
    const payload = JSON.parse(options.body);
    expect(payload.model).toBe('gpt-test');
    expect(payload.sdp).toBe('offer-sdp');
    expect(pcInstances[0].remoteDescription).toEqual({ type: 'answer', sdp: 'answer-sdp' });
    expect(pcInstances[0].configuration).toEqual({ iceServers: [{ urls: ['stun:test'] }] });
    expect(peer.pc).toBe(pcInstances[0]);
  });

  it('throws when OpenAI response is not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' });

    await expect(createRealtimePeer({ callId: 'CALLERR' })).rejects.toThrow('Realtime SDP exchange failed: 500');
  });
});
