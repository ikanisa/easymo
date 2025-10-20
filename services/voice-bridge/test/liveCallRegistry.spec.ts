import { liveCallRegistry } from "../src/liveCallRegistry";

describe("liveCallRegistry", () => {
  beforeEach(() => {
    liveCallRegistry.reset();
  });

  it("tracks start, media, and teardown lifecycle", () => {
    liveCallRegistry.startSession("CA123", "outbound", "+250780010001", "Lead", "rw-kigali");
    let snapshot = liveCallRegistry.snapshot();
    expect(snapshot.calls).toHaveLength(1);
    expect(snapshot.calls[0].status).toBe("active");

    liveCallRegistry.updateMedia("CA123", 1280);
    snapshot = liveCallRegistry.snapshot();
    expect(snapshot.calls[0].lastMediaAt).not.toBeNull();

    liveCallRegistry.endSession("CA123");
    snapshot = liveCallRegistry.snapshot();
    expect(snapshot.calls[0].status).toBe("ended");
  });

  it("marks opt-out transcripts", () => {
    liveCallRegistry.startSession("CA321", "inbound", "+250780099999");
    liveCallRegistry.registerOptOut("CA321", "STOP sending me messages");
    const snapshot = liveCallRegistry.snapshot();
    expect(snapshot.calls[0].optOutDetected).toBe(true);
    expect(snapshot.calls[0].transcriptPreview).toContain("STOP");
  });
});
