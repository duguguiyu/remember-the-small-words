import fs from 'node:fs'
import path from 'node:path'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { registerAuthRoutes } from './routes/auth'
import { registerLearnerRoutes } from './routes/learner'
import { registerAdminRoutes } from './routes/admin'
import { prisma } from './db'

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(__dirname, '../../.env'),
  ]
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue
    const text = fs.readFileSync(file, 'utf8')
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      if (!process.env[key]) process.env[key] = value
    }
  }
}

async function main() {
  loadEnv()

  const app = Fastify({
    logger: true,
    bodyLimit: 12 * 1024 * 1024,
  })

  await app.register(cookie)
  await app.register(multipart, { limits: { fileSize: 8 * 1024 * 1024 } })

  app.get('/api/health', async () => ({ ok: true }))

  await registerAuthRoutes(app)
  await registerLearnerRoutes(app)
  await registerAdminRoutes(app)

  const publicDir = process.env.PUBLIC_DIR
    || path.resolve(__dirname, '../public')
  if (fs.existsSync(publicDir)) {
    await app.register(fastifyStatic, {
      root: publicDir,
      wildcard: false,
    })
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api')) {
        return reply.code(404).send({ error: 'Not found' })
      }
      return reply.sendFile('index.html')
    })
  }

  const port = Number(process.env.PORT || 3000)
  await app.listen({ port, host: '0.0.0.0' })
}

main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
