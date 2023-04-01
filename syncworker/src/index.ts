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
		const id = env.ROOM.idFromName("room")
		const obj = env.ROOM.get(id)

		return obj.fetch(request)
	},
};



export class Room {
	state: DurableObjectState
	sessions: WebSocket[] = []
	env: Env

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
	}

	async fetch(request: Request): Promise<Response> {
		const upgradeHeader = request.headers.get('Upgrade');
		if (!upgradeHeader || upgradeHeader !== 'websocket') {
			return new Response('Expected Upgrade: websocket', { status: 426 });
		}

		const webSocketPair = new WebSocketPair();
		const { 0: client, 1: server } = webSocketPair


		server.accept();
		this.sessions.push(server)

		server.addEventListener('message', async event => {
			try {
				let value: number = await this.state.storage?.get("value") || 0
				value++
				await this.state.storage?.put("value", value);

				console.log(event.data);
				const mst = "Hello from Cloudflare Workers! You said: " + event.data + ":" + value
				this.sessions.forEach(s => s.send(mst))
			} catch (error) {
				console.log(error)
			}
		});

		server.addEventListener('close', async event => {
			console.log(`close:${event}`)
		});

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}
}