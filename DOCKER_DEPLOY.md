# 🐋 Docker镜像构建和部署指南

## 📦 快速开始

### 方法一：使用自动化脚本（推荐）

```bash
# 1. 登录Docker Hub
docker login

# 2. 运行构建推送脚本（替换 yourusername 为你的Docker Hub用户名）
./docker-build-push.sh yourusername
```

就这么简单！脚本会自动完成所有步骤。

---

## 📝 方法二：手动操作步骤

### 1. 登录Docker Hub

```bash
docker login
# 输入用户名和密码
```

### 2. 构建镜像

```bash
# 基础构建（只打latest标签）
docker build -t yourusername/lunatv:latest .

# 构建并打上版本标签
docker build -t yourusername/lunatv:100.0.1 -t yourusername/lunatv:latest .
```

### 3. 查看构建的镜像

```bash
docker images | grep lunatv
```

### 4. 推送到Docker Hub

```bash
# 推送版本标签
docker push yourusername/lunatv:100.0.1

# 推送latest标签
docker push yourusername/lunatv:latest
```

---

## 🚀 运行镜像

### 基础运行

```bash
docker run -d \
  -p 3000:3000 \
  --name lunatv \
  yourusername/lunatv:latest
```

### 带环境变量运行

```bash
docker run -d \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_API_URL=https://your-api.com \
  --name lunatv \
  yourusername/lunatv:latest
```

### 挂载配置文件运行

```bash
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/config:/app/config \
  --name lunatv \
  yourusername/lunatv:latest
```

---

## 🔧 Docker Compose 部署

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  lunatv:
    image: yourusername/lunatv:latest
    container_name: lunatv
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - HOSTNAME=0.0.0.0
      - PORT=3000
    restart: unless-stopped
    volumes:
      - ./config:/app/config
      - ./data:/app/data
```

启动服务：

```bash
docker-compose up -d
```

---

## 📊 镜像信息

- **基础镜像**: node:20-alpine
- **暴露端口**: 3000
- **工作目录**: /app
- **运行用户**: nextjs (非root)
- **架构支持**: amd64, arm64

---

## 🏷️ 版本标签说明

| 标签 | 说明 |
|------|------|
| `latest` | 最新稳定版本 |
| `100.0.1` | 特定版本号 |
| `100.0.x` | 小版本更新 |

---

## 🔍 常用Docker命令

### 查看运行中的容器

```bash
docker ps
```

### 查看容器日志

```bash
docker logs lunatv

# 实时查看日志
docker logs -f lunatv
```

### 停止容器

```bash
docker stop lunatv
```

### 重启容器

```bash
docker restart lunatv
```

### 删除容器

```bash
docker rm lunatv
```

### 删除镜像

```bash
docker rmi yourusername/lunatv:latest
```

### 进入容器

```bash
docker exec -it lunatv sh
```

---

## 🌐 多架构构建（高级）

如果需要支持多架构（amd64 和 arm64）：

### 1. 创建并使用buildx构建器

```bash
# 创建构建器
docker buildx create --name multiarch --use

# 启动构建器
docker buildx inspect --bootstrap
```

### 2. 构建并推送多架构镜像

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t yourusername/lunatv:100.0.1 \
  -t yourusername/lunatv:latest \
  --push \
  .
```

---

## ⚡ 性能优化建议

### 1. 使用多阶段构建（已实现）
当前Dockerfile已使用3阶段构建：
- deps: 安装依赖
- builder: 构建应用
- runner: 运行时镜像（最小化）

### 2. 优化.dockerignore
已配置排除不必要的文件，加快构建速度。

### 3. 使用构建缓存

```bash
# 使用缓存加速构建
docker build --cache-from yourusername/lunatv:latest -t yourusername/lunatv:latest .
```

---

## 🔐 安全建议

1. ✅ 使用非root用户运行（已实现）
2. ✅ 使用alpine基础镜像（体积小，安全）
3. 🔒 定期更新依赖
4. 🔒 使用secrets管理敏感信息

---

## 🆘 故障排查

### 构建失败

```bash
# 清理缓存重新构建
docker build --no-cache -t yourusername/lunatv:latest .
```

### 推送失败

```bash
# 重新登录
docker logout
docker login

# 检查网络
ping hub.docker.com
```

### 容器无法启动

```bash
# 查看详细日志
docker logs lunatv

# 检查端口占用
lsof -i :3000
```

---

## 📚 相关资源

- [Docker Hub](https://hub.docker.com/)
- [Docker官方文档](https://docs.docker.com/)
- [Next.js Docker部署](https://nextjs.org/docs/deployment#docker-image)

---

## 🎯 自动化CI/CD

如果使用GitHub Actions，可以参考：

```yaml
name: Docker Build and Push

on:
  push:
    tags:
      - 'v*'

jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
      
      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}
      
      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: |
            yourusername/lunatv:latest
            yourusername/lunatv:${{ github.ref_name }}
```

---

**祝您部署顺利！** 🎉

