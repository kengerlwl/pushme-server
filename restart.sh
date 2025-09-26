#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 容器和镜像名称
CONTAINER_NAME="pushme-server"
IMAGE_NAME="pushme-server"
IMAGE_TAG="local"

echo -e "${BLUE}=== PushMe Server 重启脚本 ===${NC}"

# 1. 停止并删除现有容器
echo -e "${YELLOW}1. 检查并停止现有容器...${NC}"
if docker ps -a --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${YELLOW}   发现容器 ${CONTAINER_NAME}，正在停止...${NC}"
    docker stop ${CONTAINER_NAME}

    echo -e "${YELLOW}   正在删除容器 ${CONTAINER_NAME}...${NC}"
    docker rm ${CONTAINER_NAME}
    echo -e "${GREEN}   ✓ 容器已删除${NC}"
else
    echo -e "${GREEN}   ✓ 未发现运行中的容器${NC}"
fi

# 2. 删除旧镜像（可选）
echo -e "${YELLOW}2. 检查并删除旧镜像...${NC}"
if docker images --format "table {{.Repository}}:{{.Tag}}" | grep -q "^${IMAGE_NAME}:${IMAGE_TAG}$"; then
    echo -e "${YELLOW}   发现镜像 ${IMAGE_NAME}:${IMAGE_TAG}，正在删除...${NC}"
    docker rmi ${IMAGE_NAME}:${IMAGE_TAG}
    echo -e "${GREEN}   ✓ 旧镜像已删除${NC}"
else
    echo -e "${GREEN}   ✓ 未发现旧镜像${NC}"
fi

# 3. 构建新镜像
echo -e "${YELLOW}3. 构建新镜像...${NC}"
echo -e "${BLUE}   docker build -f docker/Dockerfile -t ${IMAGE_NAME}:${IMAGE_TAG} .${NC}"
if docker build -f docker/Dockerfile -t ${IMAGE_NAME}:${IMAGE_TAG} .; then
    echo -e "${GREEN}   ✓ 镜像构建成功${NC}"
else
    echo -e "${RED}   ✗ 镜像构建失败${NC}"
    exit 1
fi

# 4. 创建配置目录（如果不存在）
echo -e "${YELLOW}4. 准备配置目录...${NC}"
CONFIG_DIR="$PWD/pushme-server/config"
if [ ! -d "$CONFIG_DIR" ]; then
    echo -e "${YELLOW}   创建配置目录: $CONFIG_DIR${NC}"
    mkdir -p "$CONFIG_DIR"
fi
echo -e "${GREEN}   ✓ 配置目录准备完成${NC}"

# 5. 运行新容器
echo -e "${YELLOW}5. 启动新容器...${NC}"
DOCKER_CMD="docker run -dit \
  -p 3010:3010 \
  -p 3100:3100 \
  -e TZ=Asia/Shanghai \
  -v $CONFIG_DIR:/pushme-server/config \
  --name ${CONTAINER_NAME} \
  --restart unless-stopped \
  ${IMAGE_NAME}:${IMAGE_TAG}"

echo -e "${BLUE}   执行命令: ${DOCKER_CMD}${NC}"

if eval $DOCKER_CMD; then
    echo -e "${GREEN}   ✓ 容器启动成功${NC}"
else
    echo -e "${RED}   ✗ 容器启动失败${NC}"
    exit 1
fi

# 6. 检查容器状态
echo -e "${YELLOW}6. 检查容器状态...${NC}"
sleep 3
if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep ${CONTAINER_NAME}; then
    echo -e "${GREEN}   ✓ 容器运行正常${NC}"
else
    echo -e "${RED}   ✗ 容器可能启动失败，请检查日志${NC}"
    echo -e "${YELLOW}   查看日志命令: docker logs ${CONTAINER_NAME}${NC}"
    exit 1
fi

# 7. 显示访问信息
echo -e "${GREEN}"
echo "=== 部署完成 ==="
echo "Web管理界面: http://localhost:3010"
echo "消息服务端口: 3100"
echo "配置文件目录: $CONFIG_DIR"
echo ""
echo "常用命令:"
echo "  查看日志: docker logs -f ${CONTAINER_NAME}"
echo "  停止容器: docker stop ${CONTAINER_NAME}"
echo "  进入容器: docker exec -it ${CONTAINER_NAME} sh"
echo -e "${NC}"

echo -e "${GREEN}🎉 PushMe Server 重启完成！${NC}"

