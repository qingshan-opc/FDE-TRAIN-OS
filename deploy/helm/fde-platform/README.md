# fde-platform Helm chart

## Quick start

```bash
kubectl create ns fde
kubectl -n fde create secret generic fde-platform-secrets \
  --from-literal=JWT_SECRET='change-me' \
  --from-literal=DATABASE_URL='postgresql://fde:fde@postgres:5432/fde' \
  --from-literal=S3_ACCESS_KEY='fdeadmin' \
  --from-literal=S3_SECRET_KEY='fdeadmin123'

helm upgrade --install fde . -n fde -f values-e2e.yaml --wait
```

## Values

| File | Use |
|------|-----|
| `values.yaml` | defaults |
| `values-e2e.yaml` | k3d / CI — single-replica deps |
| `values-prod.yaml` | CNPG 3-replica + MinIO Operator Tenant |
| `values-818cloud.yaml` | 818cloud `fde-study` · http://fde.818cloud.com · 微信支付 |

## Images

```bash
docker build -f ../../docker/Dockerfile.api -t fde-api:0.1.0 ../../..
docker build -f ../../docker/Dockerfile.web -t fde-web:0.1.0 ../../..
```

See `deploy/runbooks/rollout.md`.
