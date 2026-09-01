import type { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import {
  COOKIE_NAME,
  cookieOptions,
  hashPassword,
  requireAuth,
  signToken,
  verifyPassword,
} from '../auth'

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (req, reply) => {
    const body = req.body as { username?: string; password?: string }
    const username = (body.username || '').trim()
    const password = body.password || ''
    if (!username || !password) {
      return reply.code(400).send({ error: '请输入用户名和密码' })
    }

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return reply.code(401).send({ error: '用户名或密码错误' })
    }
    if (user.disabled) {
      return reply.code(403).send({ error: '账号已停用' })
    }

    const token = signToken({
      id: user.id,
      username: user.username,
      role: user.role as 'admin' | 'learner',
    })
    reply.setCookie(COOKIE_NAME, token, cookieOptions())
    return { id: user.id, username: user.username, role: user.role }
  })

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' })
    return { ok: true }
  })

  app.get('/api/auth/me', { preHandler: requireAuth }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, username: true, role: true, disabled: true },
    })
    if (!user || user.disabled) {
      return reply.code(401).send({ error: '未登录' })
    }
    return { id: user.id, username: user.username, role: user.role }
  })
}

export { hashPassword }
