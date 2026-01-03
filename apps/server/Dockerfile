FROM node:18-alpine

WORKDIR /app

# 复制依赖定义
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 构建项目
RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动生产版本
CMD ["npm", "run", "start:prod"]

