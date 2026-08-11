# dis-cloud · 818cloud K8s · 单镜像部署（前后端合一）
#
# 目标 Deployment: dis-cloud/dis-cloud
# 镜像: registry.cn-zhangjiakou.aliyuncs.com/818cloud/fde:dis-cloud-<TAG>
#
# 构建：仅本地 Mac Docker Desktop（linux/amd64），禁止在 k3s 节点上 docker build。
# 推送：scripts/push_dis_cloud_image.sh 使用 buildx --load + 经典 docker push
# （Docker Schema2 manifest；避免 OCI index 导致 ACR 显示大小为 "-"）。
#
# 1. 本地构建推送
#    TAG=v0.7.2-20260803 ./scripts/push_dis_cloud_image.sh
#    （默认体积门禁 MAX_IMAGE_MB=300，防止 class 视频再次打进镜像）
#    清理历史胖 tag：./scripts/cleanup_dis_cloud_fat_images.sh
#
# 2. SSH 隧道 + 配置 Secret
#    cp deploy/k8s/dis-cloud/secret.example.env deploy/k8s/dis-cloud/.env
#    # 需填 WECHAT_* 与 WECHAT_APP_SECRET（与支付 AppID 相同，用于机构扫码绑定分账 openid）
#    NS=dis-cloud ./scripts/apply_k8s_secrets_dis_cloud.sh
#
# 3. 部署（含 migration/bootstrap + 更新 Deployment）
#    TAG=v0.7.2-20260803 ./scripts/deploy_dis_cloud.sh
#
# 分账：ConfigMap WECHAT_PAY_PROFIT_SHARING=1；机构 Partner 后台扫码绑定 PERSONAL_OPENID。
# 公众号后台需配置网页授权域名 = FDE_PUBLIC_BASE_URL 的 host（如 fde.818cloud.com）。
#
# 扫码关注登录（服务器配置）：
#   URL:   https://fde.818cloud.com/api/v1/wechat/mp
#   Token: 与 Secret WECHAT_MP_TOKEN 一致（当前 FdeMpTok8a3kQ2mN）
#   EncodingAESKey: Secret WECHAT_MP_AES_KEY
#   消息加解密：兼容模式或安全模式（服务端均支持）；明文也可
#   路径：mp.weixin.qq.com → 设置与开发 → 基本配置 → 服务器配置 → 提交并启用
#
# 公众号菜单「我的课程」：
#   类型：跳转网页
#   URL： https://fde.818cloud.com/api/v1/auth/wechat/mp-entry?next=/app/courses
#   需已配置网页授权域名 = fde.818cloud.com
#   （设置与开发 → 公众号设置 → 功能设置 → 网页授权域名）
