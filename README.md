# 豆豆 / Josh 背单词

Vue 3 学员端 + Fastify API。本地用 **SQLite**（不需要 Docker）；GCP 生产用 Cloud SQL Postgres。

## 本地开发（无 Docker）

需要 Node.js。

```bash
cp .env.example .env
cp .env.example server/.env
npm install
npm install --prefix server
./scripts/test.sh
```

或分步：

```bash
npm run local:prepare   # 生成 Prisma client + SQLite + 导入词库/管理员
npm run seed            # 如需重新导入
npm run dev
```

- 学员 / 管理端：http://localhost:5173
- API：http://localhost:3000
- 默认管理员：`admin` / `changeme`
- 数据库文件：`server/data/local.db`

## 本地生产形态测试（仍无 Docker）

构建前端，由 Fastify 同端口托管，并做冒烟：

```bash
./scripts/local-deploy.sh
```

打开 http://localhost:8080 ，账号 `admin` / `changeme`。

```bash
./scripts/local-deploy.sh smoke
./scripts/local-deploy.sh down
```

## 构建

```bash
npm run build
```

前端产物在 `dist/`。生产环境由 Fastify 同时提供 API 和静态页面。

## 发布到 GCP

生产镜像仍使用 Postgres（Cloud SQL）。一次性创建资源：

```bash
export GCP_PROJECT=your-project
export GCP_REGION=asia-east1
export BOOTSTRAP_ADMIN_PASSWORD='a-strong-password'
./scripts/gcp/setup.sh
```

```bash
GCP_PROJECT=your-project ./scripts/gcp/deploy.sh
GCP_PROJECT=your-project ./scripts/gcp/seed.sh
```

可选：`docker compose` 仅在你想本地对照 Postgres 时使用，不是日常开发依赖。

## 词库 CSV

后台上传的 CSV 与原来一致（v2，6 列，可无表头）：

```
english,chinese,phonetic,exampleEn,exampleCn,explanation
```

仓库 `datasets/` 会在 seed / `local-deploy` 时批量导入。
