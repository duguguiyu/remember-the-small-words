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

生产用 Cloud SQL Postgres + Cloud Run。脚本会读写本地配置 `scripts/gcp/.env.gcp`（已 gitignore）。

低用量默认（控费）：
- Cloud SQL：`ENTERPRISE` + `db-f1-micro`、单区、10GB 磁盘、不自动扩容、保留 1 份备份（主要固定费用）
- Cloud Run：`min-instances=0`（空闲不计费）、最多 2 实例、512Mi

第一次直接跑即可，没有配置时会交互询问并保存：

```bash
./scripts/gcp/setup.sh      # 建资源 + 写 .env.gcp
./scripts/gcp/deploy.sh     # 构建并发布
./scripts/gcp/seed.sh       # 导入词库和管理员
```

之后再跑会跳过询问，直接用已保存的配置。需要改配置：

```bash
./scripts/gcp/setup.sh --reconfigure
```

也可先抄一份示例再编辑：

```bash
cp scripts/gcp/.env.gcp.example scripts/gcp/.env.gcp
```

可选：`docker compose` 仅在你想本地对照 Postgres 时使用，不是日常开发依赖。

## 词库 CSV

后台上传的 CSV 与原来一致（v2，6 列，可无表头）：

```
english,chinese,phonetic,exampleEn,exampleCn,explanation
```

仓库 `datasets/` 会在 seed / `local-deploy` 时批量导入。
