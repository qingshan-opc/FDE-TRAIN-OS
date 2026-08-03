# 818cloud K8s 部署 — FDE Learning OS

目标环境：

| 项 | 值 |
|---|---|
| 命名空间 | `fde-study` |
| 访问地址 | http://fde.818cloud.com/ |
| 镜像仓库（公网） | `registry.cn-zhangjiakou.aliyuncs.com/818cloud/fde` |
| 镜像仓库（VPC） | `registry-vpc.cn-zhangjiakou.aliyuncs.com/818cloud/fde` |
| Helm values | `deploy/helm/fde-platform/values-818cloud.yaml` |

## 1. 构建并推送镜像

```bash
cd digital-fde-platform
chmod +x scripts/push_k8s_images_818cloud.sh scripts/deploy_k8s_818cloud.sh

REGISTRY_USER='你的ACR账号' REGISTRY_PASS='你的ACR密码' \
  TAG=v0.7.0-20260803 \
  ./scripts/push_k8s_images_818cloud.sh
```

产出：

- `registry.cn-zhangjiakou.aliyuncs.com/818cloud/fde:api-<TAG>`
- `registry.cn-zhangjiakou.aliyuncs.com/818cloud/fde:web-<TAG>`

## 2. 创建拉取密钥（一次性）

```bash
kubectl -n fde-study create secret docker-registry aliyun-registry \
  --docker-server=registry.cn-zhangjiakou.aliyuncs.com \
  --docker-username='ACR账号' \
  --docker-password='ACR密码' \
  --dry-run=client -o yaml | kubectl apply -f -
```

## 3. 创建应用 Secret（不入 git）

```bash
cp deploy/k8s/818cloud/secret.example.env deploy/k8s/818cloud/.env
# 编辑 deploy/k8s/818cloud/.env（DATABASE_URL、MinIO root 密码、微信支付等）

./scripts/apply_k8s_secrets_818cloud.sh
```

或手动创建（见下方微信支付 PEM 说明）。

MinIO 使用集群 `base-service` 命名空间（与灵知共用）：

- Endpoint：`http://minio.base-service.svc.cluster.local:9000`（已在 values-818cloud.yaml）
- `S3_ACCESS_KEY` / `S3_SECRET_KEY` 填 MinIO 的 `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`

微信支付 PEM 默认从 `llm-cli/anycode/deploy/account-service/secrets/` 读取；也可设置 `WECHAT_CERT_DIR`。

```bash
kubectl -n fde-study create secret generic fde-platform-secrets \
  --from-literal=JWT_SECRET='...' \
  --from-literal=DATABASE_URL='postgresql://...' \
  --from-literal=S3_ACCESS_KEY='...' \
  --from-literal=S3_SECRET_KEY='...' \
  --from-literal=WECHAT_PAY_MCH_ID='...' \
  --from-literal=WECHAT_PAY_APP_ID='...' \
  --from-literal=WECHAT_PAY_SERIAL_NO='...' \
  --from-literal=WECHAT_PAY_API_V3_KEY='32字符' \
  --from-file=WECHAT_PAY_PRIVATE_KEY=./apiclient_key.pem \
  --from-file=WECHAT_PAY_PLATFORM_CERT=./wechatpay_platform.pem \
  --from-literal=DEEPSEEK_API_KEY='...' \
  --dry-run=client -o yaml | kubectl apply -f -
```

**微信支付回调 URL**（已在商户平台配置时对齐）：

```
http://fde.818cloud.com/api/v1/billing/wechat/notify
```

上 HTTPS 后把 `FDE_PUBLIC_BASE_URL` / 商户回调改为 `https://fde.818cloud.com`（values 或 ConfigMap）。

## 4. 调整 MinIO / 数据库地址

编辑 `values-818cloud.yaml` 中 `config.S3_ENDPOINT`：

- 集群内 MinIO：`http://<minio-service>.<namespace>.svc:9000`
- 阿里云 OSS：`https://oss-cn-zhangjiakou.aliyuncs.com`（需对应 access key 与 bucket 策略）

`DATABASE_URL` 只放在 Secret，格式：

```
postgresql://USER:PASS@HOST:5432/fde
```

## 5. Helm 发布

```bash
kubectl config use-context <818cloud-context>
TAG=v0.7.0-20260803 ./scripts/deploy_k8s_818cloud.sh
```

Hook 顺序：

1. `migration` Job — SQL 迁移
2. Deployments 滚动
3. `bootstrap` Job — 课包 seed + MinIO bucket 初始化

## 6. 验证

```bash
curl -sf http://fde.818cloud.com/livez
curl -sf http://fde.818cloud.com/readyz
curl -sf http://fde.818cloud.com/healthz
```

浏览器：

- 学员台 http://fde.818cloud.com/app/
- 教研台 http://fde.818cloud.com/author/

支付冒烟：后台配置测试套餐 → 学员端 `/app/shop` 下单 → 微信 Native 扫码 → 回调 `/api/v1/billing/wechat/notify`。

## 7. Ingress / DNS

将 `fde.818cloud.com` A 记录指到集群 Ingress LB。当前 **无 TLS**（`ssl-redirect: false`）；你自行上证书后：

1. 创建 TLS Secret
2. 在 `values-818cloud.yaml` 的 `ingress.tls` 填入 host
3. `FDE_COOKIE_SECURE=1`、`FDE_PUBLIC_BASE_URL=https://fde.818cloud.com`

## 8. 回滚

```bash
helm -n fde-study rollback fde
```
