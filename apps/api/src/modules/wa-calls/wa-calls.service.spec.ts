import type { RTCIceCandidateInit } from 'wrtc';
import type { CallRef } from './call-registry.service';

describe('WaCallsService', () => {
  const registry = {
    register: jest.fn(),
    get: jest.fn(),
    remove: jest.fn(),
  } as unknown as {
    register: jest.Mock;
    get: jest.Mock<CallRef | null, [string]>;
    remove: jest.Mock;
  };
  const graph = {
    acceptCall: jest.fn(),
    sendIce: jest.fn(),
  };
  const iceStore = {
    pushIce: jest.fn(),
  };

  jest.mock('../../common/env', () => ({
    env: {
      waVerifyToken: 'verify-token',
      turnServers: [],
      turnUsername: '',
      turnPassword: '',
      waPhoneId: 'PHONE123',
      waToken: 'TOKEN',
      waGraphApiBaseUrl: 'https://graph.example.com',
      openaiApiKey: 'sk-test',
      realtimeModel: 'gpt-test',
      redisUrl: '',
    },
  }));

  const realtimePeer = {
    addInboundTrack: jest.fn(),
    close: jest.fn(),
  };

  jest.mock('./media/openai-realtime-webrtc', () => ({
    createRealtimePeer: jest.fn(async (args: {
      callId: string;
      onRemoteTrack?: (track: any, streams: any[]) => void;
    }) => {
      args.onRemoteTrack?.({ kind: 'audio' }, [{}]);
      return realtimePeer;
    }),
  }));

  const waPeer = {
    localDescription: { sdp: 'answer-sdp' },
    setOutboundTrack: jest.fn(),
    setRemoteDescription: jest.fn(),
    addRemoteIce: jest.fn(),
    close: jest.fn(),
  };

  jest.mock('./media/bridge-whatsapp-webrtc', () => ({
    createWaPeer: jest.fn(async () => waPeer),
  }));

  const { createRealtimePeer } = jest.requireMock('./media/openai-realtime-webrtc') as {
    createRealtimePeer: jest.Mock;
  };
  const { createWaPeer } = jest.requireMock('./media/bridge-whatsapp-webrtc') as {
    createWaPeer: jest.Mock;
  };

  // Lazy import service after mocks
  const { WaCallsService } = require('./calls.service') as typeof import('./calls.service');
  let service: InstanceType<typeof WaCallsService>;

  beforeEach(() => {
    jest.clearAllMocks();
    registry.get.mockReturnValue(null);
    service = new WaCallsService(graph as any, iceStore as any, registry as any);
  });

  it('verifies webhook challenge', () => {
    const challenge = service.verifyWebhook({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-token', 'hub.challenge': '12345' });
    expect(challenge).toBe('12345');

    const mismatch = service.verifyWebhook({ 'hub.mode': 'subscribe', 'hub.verify_token': 'bad' });
    expect(mismatch).toBe('token mismatch');
  });

  it('handles call offers by wiring peers and registering call', async () => {
    await (service as any).handleOffer('CALL123', 'remote-offer');

    expect(createRealtimePeer).toHaveBeenCalledWith(expect.objectContaining({ callId: 'CALL123' }));
    expect(createWaPeer).toHaveBeenCalledWith(expect.objectContaining({ callId: 'CALL123', remoteOfferSdp: 'remote-offer' }));
    expect(waPeer.setOutboundTrack).toHaveBeenCalledWith(expect.objectContaining({ kind: 'audio' }), expect.any(Object));
    expect(graph.acceptCall).toHaveBeenCalledWith('CALL123', 'answer-sdp');
    expect(registry.register).toHaveBeenCalledWith('CALL123', expect.objectContaining({ rt: realtimePeer, wa: waPeer }));
  });

  it('handles call updates by forwarding ICE and SDP to peers', async () => {
    registry.get.mockReturnValue({ wa: waPeer, rt: realtimePeer } as unknown as CallRef);
    const candidate: RTCIceCandidateInit = { candidate: 'ICE', sdpMid: '0', sdpMLineIndex: 0 };

    await (service as any).handleUpdate('CALL999', 'new-sdp', candidate);

    expect(iceStore.pushIce).toHaveBeenCalledWith('CALL999', candidate);
    expect(waPeer.addRemoteIce).toHaveBeenCalledWith(candidate);
    expect(waPeer.setRemoteDescription).toHaveBeenCalledWith('new-sdp');
  });

  it('handles call end by closing peers and clearing registry', async () => {
    registry.get.mockReturnValue({ wa: waPeer, rt: realtimePeer } as unknown as CallRef);

    await (service as any).handleEnd('CALL777');

    expect(waPeer.close).toHaveBeenCalled();
    expect(realtimePeer.close).toHaveBeenCalled();
    expect(registry.remove).toHaveBeenCalledWith('CALL777');
  });
});
