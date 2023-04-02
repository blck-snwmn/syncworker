# syncworker
A sample for synchronizing location information using Cloudflare Workers and Durable Objects.

## Run
worker
```bash
cd syncworker
wrangler dev --local
```

random move client
```bash
cd client
go run main.go 
```


viewer
```bash
cd view
npx http-server -p 8090
```

