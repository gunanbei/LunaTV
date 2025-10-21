# Docker 故障排查指南

## 问题：exec format error

### 错误现象
```
moontv-core-redis | exec /usr/local/bin/docker-entrypoint.sh: exec format error
moontv-core-redis exited with code 1
```

### 问题原因
这个错误通常是由于 **Docker 镜像的 CPU 架构与运行环境不匹配** 导致的：

- 在 AMD64 (x86_64) 系统上运行了 ARM64 架构的镜像
- 或在 ARM64 系统上运行了 AMD64 架构的镜像

### 解决方案

#### 方案 1：明确指定平台（临时解决）

在 `docker-compose.yml` 中为 `moontv-core-redis` 服务添加 `platform` 字段：

```yaml
services:
  moontv-core-redis:
    image: docker.lhpac.top/linghuajian1/lunatv:latest
    platform: linux/amd64  # 明确指定平台
    # 其他配置...
```

**如何选择平台：**
- **Windows (Intel/AMD)**: 使用 `linux/amd64`
- **Mac (Intel 芯片)**: 使用 `linux/amd64`
- **Mac (M1/M2/M3 芯片)**: 使用 `linux/arm64`
- **Linux (x86_64)**: 使用 `linux/amd64`
- **Linux (ARM)**: 使用 `linux/arm64`

#### 方案 2：重新构建多平台镜像（推荐）

如果您是镜像的维护者，应该构建支持多平台的镜像：

1. **确保 Docker Buildx 可用：**
   ```bash
   docker buildx version
   ```

2. **使用更新后的构建脚本：**
   ```bash
   ./docker-build-push.sh <your-docker-username>
   ```

   新脚本会自动构建支持 `linux/amd64` 和 `linux/arm64` 的镜像。

3. **手动构建多平台镜像：**
   ```bash
   # 创建 buildx 构建器
   docker buildx create --name multiarch --use
   
   # 构建并推送多平台镜像
   docker buildx build \
     --platform linux/amd64,linux/arm64 \
     -t docker.lhpac.top/linghuajian1/lunatv:latest \
     --push \
     .
   ```

#### 方案 3：检查当前系统架构

确认您的系统架构：

```bash
# Linux/Mac
uname -m

# Windows PowerShell
systeminfo | findstr /C:"System Type"

# Docker 系统信息
docker info | grep Architecture
```

常见输出：
- `x86_64` 或 `AMD64` = 使用 `linux/amd64`
- `aarch64` 或 `ARM64` = 使用 `linux/arm64`

### 验证镜像架构

检查镜像支持的平台：

```bash
docker buildx imagetools inspect docker.lhpac.top/linghuajian1/lunatv:latest
```

正确的多平台镜像应该显示类似：
```
MediaType: application/vnd.docker.distribution.manifest.list.v2+json
Manifests:
  Name:      docker.lhpac.top/linghuajian1/lunatv:latest@sha256:xxxxx
  MediaType: application/vnd.docker.distribution.manifest.v2+json
  Platform:  linux/amd64

  Name:      docker.lhpac.top/linghuajian1/lunatv:latest@sha256:xxxxx
  MediaType: application/vnd.docker.distribution.manifest.v2+json
  Platform:  linux/arm64
```

### 快速修复命令

1. **停止并删除现有容器：**
   ```bash
   docker-compose down
   ```

2. **修改 `docker-compose.yml` 添加 platform 字段**

3. **重新启动：**
   ```bash
   docker-compose up -d
   ```

### 其他可能的原因

如果添加 `platform` 后仍然出错，检查：

1. **文件行尾符问题（Windows 用户）：**
   如果您在 Windows 上编辑了 `start.js` 或其他脚本文件，可能存在 CRLF vs LF 的问题。
   
   解决方法：
   ```bash
   # 在 Git Bash 中
   dos2unix start.js
   
   # 或在构建前设置 Git
   git config --global core.autocrlf input
   ```

2. **Docker 守护进程问题：**
   ```bash
   # 重启 Docker
   # Windows: 从任务栏重启 Docker Desktop
   # Linux: sudo systemctl restart docker
   ```

3. **镜像损坏：**
   ```bash
   # 删除本地镜像并重新拉取
   docker rmi docker.lhpac.top/linghuajian1/lunatv:latest
   docker pull docker.lhpac.top/linghuajian1/lunatv:latest
   ```

## 预防措施

1. **始终构建多平台镜像**：现代应用应该支持多种架构
2. **在 README 中明确说明支持的平台**
3. **在 CI/CD 中使用 `docker buildx`**
4. **提供示例 docker-compose 文件，包含 platform 字段**

## 相关资源

- [Docker Buildx 文档](https://docs.docker.com/buildx/working-with-buildx/)
- [多平台镜像构建指南](https://docs.docker.com/build/building/multi-platform/)
- [Docker Platform 参数说明](https://docs.docker.com/compose/compose-file/compose-file-v3/#platform)

