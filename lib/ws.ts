import type { GridSchema, PotentialSchema } from "./api/schemas";

const DEFAULT_WS_URL = "wss://api.physense.tampipo.fr";

function getWsBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_WS_URL;
  return (fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_WS_URL).replace(
    /\/+$/,
    "",
  );
}

// ── WS message contracts (not in OpenAPI) ───────────────────────────────────
// Source of truth: physense-api src/physense_api/schemas/qm.py

export interface Wavepacket {
  x0: number;
  k0: number;
  sigma: number;
}

export interface EvolveRequest {
  grid?: GridSchema;
  potential: PotentialSchema;
  wavepacket?: Wavepacket;
  t_max?: number;
  dt?: number;
  n_frames?: number;
}

export interface EvolveMetadataMessage {
  type: "metadata";
  x: number[];
  potential: number[];
  t_max: number;
  n_frames: number;
}

export interface EvolveFrameMessage {
  type: "frame";
  frame: number;
  t: number;
  probability_density: number[];
  norm: number;
}

export interface EvolveDoneMessage {
  type: "done";
}

export type EvolveMessage =
  | EvolveMetadataMessage
  | EvolveFrameMessage
  | EvolveDoneMessage;

export interface EvolveHandlers {
  onMetadata?: (msg: EvolveMetadataMessage) => void;
  onFrame?: (msg: EvolveFrameMessage) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

export interface EvolveSession {
  close(): void;
}

export function evolveWs(
  request: EvolveRequest,
  handlers: EvolveHandlers,
): EvolveSession {
  const url = `${getWsBaseUrl()}/qm/evolve`;
  const ws = new WebSocket(url);
  let closedByUs = false;
  let finished = false;

  ws.addEventListener("open", () => {
    ws.send(JSON.stringify(request));
  });

  ws.addEventListener("message", (ev) => {
    let msg: EvolveMessage;
    try {
      msg = JSON.parse(ev.data as string) as EvolveMessage;
    } catch (e) {
      handlers.onError?.(
        e instanceof Error ? e : new Error("Failed to parse WS message"),
      );
      return;
    }

    switch (msg.type) {
      case "metadata":
        handlers.onMetadata?.(msg);
        break;
      case "frame":
        handlers.onFrame?.(msg);
        break;
      case "done":
        finished = true;
        handlers.onDone?.();
        closedByUs = true;
        ws.close(1000);
        break;
    }
  });

  ws.addEventListener("error", () => {
    if (closedByUs) return;
    handlers.onError?.(new Error("WebSocket error"));
  });

  ws.addEventListener("close", (ev) => {
    if (closedByUs || finished) return;
    if (!ev.wasClean && ev.code !== 1000) {
      handlers.onError?.(
        new Error(`WebSocket closed unexpectedly (code ${ev.code})`),
      );
    }
  });

  return {
    close: () => {
      closedByUs = true;
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close(1000);
      }
    },
  };
}
