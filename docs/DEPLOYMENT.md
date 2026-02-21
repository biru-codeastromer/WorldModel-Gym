# Deployment

## Fly.io

This repo supports one-command Fly deployment for both API and web services.

```bash
make deploy-fly
```

Default app names:
- API: `worldmodel-gym-api-biru`
- Web: `worldmodel-gym-web-biru`

Override names/region if needed:

```bash
API_APP=my-api-name WEB_APP=my-web-name REGION=iad make deploy-fly
```

What the script does:
- creates Fly apps if missing
- creates a persistent volume (`data`) for API sqlite storage
- sets a random `WMG_UPLOAD_TOKEN` secret on API app
- deploys API using `docker/server.Dockerfile`
- deploys web using `docker/web.fly.Dockerfile`

After deploy, it prints:
- API URL
- Web URL
- upload token (store securely)
