import { useEffect, useMemo, useState } from "react";

import type { RedeemRequest, RedeemResponse } from "@station/api/types";
import { useStationSession } from "@station/contexts/StationSessionContext";
import type { RedeemQueueEntry } from "@station/offline/RedeemQueue";
import { RedeemQueue } from "@station/offline/RedeemQueue";

export const useRedeemQueue = () => {
  const { session, client } = useStationSession();
  const [entries, setEntries] = useState<RedeemQueueEntry[]>([]);
  const [lastResult, setLastResult] = useState<RedeemResponse | null>(null);

  const queue = useMemo(() => {
    if (!session) {
      return null;
    }

    return new RedeemQueue({
      stationId: session.stationId,
      client,
      onComplete: (entry, response) => {
        setLastResult(response);
        setEntries((current) => current.filter((item) => item.id !== entry.id));
      },
      onError: (entry, response) => {
        setLastResult(response);
        setEntries((current) =>
          current.map((item) => (item.id === entry.id ? { ...item, lastError: response.message } : item)),
        );
      },
    });
  }, [client, session]);

  useEffect(() => {
    if (!queue) {
      setEntries([]);
      setLastResult(null);
      return;
    }
    setEntries(queue.list());
    setLastResult(null);
  }, [queue]);

  const redeem = async (request: RedeemRequest) => {
    if (!queue) {
      throw new Error("redeem_queue_unavailable");
    }
    setLastResult(null);
    const entry = queue.enqueue(request);
    setEntries(queue.list());
    await queue.flush();
    setEntries(queue.list());
    return entry;
  };

  return {
    queue,
    entries,
    lastResult,
    redeem,
  } as const;
};
