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
	ROOM: DurableObjectNamespace;
}

export default {
	async fetch(
		request: Request,
		env: Env,
		// ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);
		const ps = url.pathname.split("/");
		if (ps.length !== 3 || ps[1] !== "room") {
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
	x: number;
	y: number;
}

interface Chat {
	type: "chat";
	msg: string;
}

type Message = Position | Chat;

export class Room {
	state: DurableObjectState;

	positions: Record<string, Position> = {};

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
		const session = { uid, ws: server, closed: false };

		server.addEventListener("message", (event) => {
			if (typeof event.data !== "string") {
				return;
			}
			const obj = JSON.parse(event.data) as Message;
			if (obj.type === "position") {
				this.storePosition(uid, obj);
			}
		});

		const iid = setInterval(() => {
			try {
				if (Object.keys(this.positions).length > 1) {
					server.send(JSON.stringify(this.positions));
				}
			} catch (error) {
				console.log(error);
			}
		}, 1000 / 10);

		const f = () => {
			console.log("close");
			session.closed = true;
			delete this.positions[uid];
			clearInterval(iid);
		};

		server.addEventListener("close", f);
		server.addEventListener("error", f);

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	storePosition(uid: string, position: Position) {
		this.positions[uid] = position;
	}
}
