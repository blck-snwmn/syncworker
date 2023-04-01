export interface Env {
  // Example binding to KV. Learn more at https://developers.cloudflare.com/workers/runtime-apis/kv/
  // MY_KV_NAMESPACE: KVNamespace;
  //
  // Example binding to Durable Object. Learn more at https://developers.cloudflare.com/workers/runtime-apis/durable-objects/
  // MY_DURABLE_OBJECT: DurableObjectNamespace;
  //
  // Example binding to R2. Learn more at https://developers.cloudflare.com/workers/runtime-apis/r2/
  // MY_BUCKET: R2Bucket;
  //
  // Example binding to a Service. Learn more at https://developers.cloudflare.com/workers/runtime-apis/service-bindings/
  // MY_SERVICE: Fetcher;
  ROOM: DurableObjectNamespace
}

export default {
  async fetch(
    request: Request,
    env: Env,
    // ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const ps = url.pathname.split("/");
    if (ps.length !== 4 || ps[1] !== "room") {
      return new Response("Expected /room/:id", { status: 400 });
    }
    const roomID = ps[2];
    const id = env.ROOM.idFromName(roomID);
    const obj = env.ROOM.get(id);

    return obj.fetch(request);
  },
};

interface Position {
  type: "position";
  x: number
  y: number
}

interface Chat {
  type: "chat";
  msg: string
}

type Message = Position | Chat;

interface Session {
  uid: string
  ws: WebSocket
}

export class Room {
  state: DurableObjectState;

  sessions: Session[] = [];

  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const url = new URL(request.url);
    const uid = url.searchParams.get("id");
    if (uid === null) {
      return new Response("Expected ?id=xxx", { status: 400 });
    }

    const webSocketPair = new WebSocketPair();
    const { 0: client, 1: server } = webSocketPair;

    server.accept();
    this.sessions.push({ uid, ws: server });

    server.addEventListener("message", (event) => {
      try {
        this.broadcast(uid, event.data as string);
      } catch (error) {
        console.log(error);
      }
    });

    server.addEventListener("close", () => {
      console.log("close");
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  broadcast(uid: string, message: string) {
    const obj = JSON.parse(message) as Message;
    const resp = { uid, ...obj };

    // if (obj.type === 'chat') {
    // } else if (obj.type === 'position') {

    // }
    console.log(message);
    this.sessions.filter((s) => s.uid !== uid).forEach((s) => s.ws.send(JSON.stringify(resp)));
  }
}
