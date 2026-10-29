FROM node:22-slim AS build
WORKDIR /app
# 国内服务器可传 --build-arg NPM_REGISTRY=https://registry.npmmirror.com 加速
ARG NPM_REGISTRY=https://registry.npmjs.org
COPY package.json package-lock.json ./
RUN npm ci --registry=$NPM_REGISTRY --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=39015 DATA_DIR=/data
COPY --from=build /app /app
VOLUME /data
EXPOSE 39015
CMD ["node", "server/index.js"]
