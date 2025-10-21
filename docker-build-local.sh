#!/bin/bash

# 本地 Docker 镜像构建脚本（不推送到远程仓库）
# 使用方法: ./docker-build-local.sh

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 读取版本号
if [ -f "VERSION.txt" ]; then
    VERSION=$(cat VERSION.txt | tr -d '[:space:]')
else
    VERSION="latest"
fi

# 项目名称
PROJECT_NAME="lunatv"

# 本地镜像标签
IMAGE_TAG_VERSION="${PROJECT_NAME}:${VERSION}"
IMAGE_TAG_LATEST="${PROJECT_NAME}:latest"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Docker 本地镜像构建${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "项目名称: ${YELLOW}${PROJECT_NAME}${NC}"
echo -e "版本号: ${YELLOW}${VERSION}${NC}"
echo -e "镜像标签: ${YELLOW}${IMAGE_TAG_VERSION}${NC}"
echo -e "         ${YELLOW}${IMAGE_TAG_LATEST}${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查 Docker 是否运行
echo -e "${YELLOW}[1/2]${NC} 检查 Docker 运行状态..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}错误: Docker 未运行，请先启动 Docker${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker 运行正常${NC}"
echo ""

# 构建镜像
echo -e "${YELLOW}[2/2]${NC} 开始构建 Docker 镜像（当前平台）..."
docker build -t ${IMAGE_TAG_VERSION} -t ${IMAGE_TAG_LATEST} .

if [ $? -ne 0 ]; then
    echo -e "${RED}构建失败！${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 镜像构建成功${NC}"
echo ""

# 显示镜像信息
echo -e "镜像信息:"
docker images | grep -E "REPOSITORY|${PROJECT_NAME}"
echo ""

# 完成
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✓ 构建完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "运行镜像:"
echo -e "${GREEN}  docker run -d -p 3000:3000 ${IMAGE_TAG_LATEST}${NC}"
echo ""
echo -e "或使用 docker-compose:"
echo -e "${GREEN}  # 编辑 docker-compose.yml，将 image 改为: ${IMAGE_TAG_LATEST}${NC}"
echo -e "${GREEN}  docker-compose up -d${NC}"
echo ""

