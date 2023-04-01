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
		ctx: ExecutionContext
	): Promise<Response> {
		const upgradeHeader = request.headers.get('Upgrade');
		if (!upgradeHeader || upgradeHeader !== 'websocket') {
			return new Response('Expected Upgrade: websocket', { status: 426 });
		}

		const webSocketPair = new WebSocketPair();
		const client = webSocketPair[0]
		const server = webSocketPair[1];

		server.accept();
		server.addEventListener('message', async event => {
			const id = env.ROOM.idFromName("room")
			const obj = env.ROOM.get(id)

			const resp = await obj.fetch(new Request(request.url))
			const txt = await resp.text()

			console.log(event.data);
			server.send("Hello from Cloudflare Workers! You said: " + event.data + ":" + txt)
		});

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	},
};


export class Room {
	state: DurableObjectState
	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
	}

	async fetch(request: Request) {
		// Apply requested action.
		let url = new URL(request.url);

		// Durable Object storage is automatically cached in-memory, so reading the
		// same key every request is fast. (That said, you could also store the
		// value in a class member if you prefer.)
		let value: number = await this.state.storage?.get("value") || 0;
		switch (url.pathname) {
			case "/increment":
				++value;
				break;
			case "/decrement":
				--value;
				break;
			case "/":
				// Just serve the current value. No storage calls needed!
				break;
			default:
				return new Response("Not found", { status: 404 });
		}

		// We don't have to worry about a concurrent request having modified the
		// value in storage because "input gates" will automatically protect against
		// unwanted concurrency. So, read-modify-write is safe. For more details,
		// see: https://blog.cloudflare.com/durable-objects-easy-fast-correct-choose-three/
		await this.state.storage?.put("value", value);

		return new Response(value.toString());
	}
}