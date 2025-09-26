import { logRpcNotImplemented } from "../observe/logging.ts";
export async function listBars(): Promise<unknown[]> {
  await logRpcNotImplemented("rpc.dinein.listBars");
  return [];
}
