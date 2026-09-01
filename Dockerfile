FROM node:22-bookworm-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json tsconfig.node.json env.d.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:22-bookworm-slim AS api
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/prisma ./prisma
COPY server/src ./src
COPY server/tsconfig.json ./
RUN npx prisma generate \
  && test -f node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=api /app/server/node_modules ./server/node_modules
COPY --from=api /app/server/dist ./server/dist
COPY --from=api /app/server/prisma ./server/prisma
COPY --from=api /app/server/package.json ./server/package.json
COPY --from=web /app/dist ./server/public
COPY datasets ./datasets
COPY scripts/gcp/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENV DATASETS_DIR=/app/datasets
ENV PUBLIC_DIR=/app/server/public
WORKDIR /app/server
EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
