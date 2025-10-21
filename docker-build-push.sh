#!/bin/bash

# Docker镜像构建和推送脚本
# 使用方法: ./docker-build-push.sh <docker-username>

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查参数
if [ -z "$1" ]; then
    echo -e "${RED}错误: 请提供Docker Hub用户名${NC}"
    echo -e "使用方法: $0 <docker-username>"
    echo -e "示例: $0 yourusername"
    exit 1
fi

DOCKER_USERNAME=$1

# 读取版本号
if [ -f "VERSION.txt" ]; then
    VERSION=$(cat VERSION.txt | tr -d '[:space:]')
else
    VERSION="latest"
fi

# 项目名称
PROJECT_NAME="lunatv"

# 镜像标签
IMAGE_NAME="${DOCKER_USERNAME}/${PROJECT_NAME}"
IMAGE_TAG_VERSION="${IMAGE_NAME}:${VERSION}"
IMAGE_TAG_LATEST="${IMAGE_NAME}:latest"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Docker 镜像构建和推送${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "项目名称: ${YELLOW}${PROJECT_NAME}${NC}"
echo -e "版本号: ${YELLOW}${VERSION}${NC}"
echo -e "Docker用户: ${YELLOW}${DOCKER_USERNAME}${NC}"
echo -e "镜像标签: ${YELLOW}${IMAGE_TAG_VERSION}${NC}"
echo -e "         ${YELLOW}${IMAGE_TAG_LATEST}${NC}"
echo -e "支持平台: ${YELLOW}linux/amd64, linux/arm64${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查是否已登录
echo -e "${YELLOW}[1/2]${NC} 检查Docker登录状态..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}错误: Docker未运行，请先启动Docker${NC}"
    exit 1
fi

# 构建镜像（多平台支持）
echo -e "${YELLOW}[2/2]${NC} 开始构建Docker镜像（支持 linux/amd64 和 linux/arm64）..."

# 创建并使用 buildx 构建器
docker buildx create --name multiarch --use 2>/dev/null || docker buildx use multiarch

# 构建多平台镜像
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ${IMAGE_TAG_VERSION} \
  -t ${IMAGE_TAG_LATEST} \
  --push \
  .

if [ $? -ne 0 ]; then
    echo -e "${RED}构建失败！${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 镜像构建成功${NC}"
echo ""

# 多平台构建已自动推送到仓库
echo -e "${GREEN}✓ 多平台镜像已构建并推送成功${NC}"
echo ""

# 完成
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✓ 所有操作完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "您的镜像已成功推送到Docker Hub:"
echo -e "${GREEN}  docker pull ${IMAGE_TAG_VERSION}${NC}"
echo -e "${GREEN}  docker pull ${IMAGE_TAG_LATEST}${NC}"
echo ""
echo -e "运行镜像:"
echo -e "${GREEN}  docker run -d -p 3000:3000 ${IMAGE_TAG_LATEST}${NC}"
echo ""

