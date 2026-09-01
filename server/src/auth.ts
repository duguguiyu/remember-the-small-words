import type { FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export const COOKIE_NAME = 'rtsw_token'

export interface AuthUser {
  id: string
  username: string
  role: 'admin' | 'learner'
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return secret
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10)
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash)
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    jwtSecret(),
    { expiresIn: '30d' },
  )
}

export function readToken(token: string): AuthUser {
  const payload = jwt.verify(token, jwtSecret()) as {
    sub: string
    username: string
    role: 'admin' | 'learner'
  }
  return { id: payload.sub, username: payload.username, role: payload.role }
}

export function cookieOptions() {
  const secure =
    process.env.COOKIE_SECURE === 'true' ||
    (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false')
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = req.cookies[COOKIE_NAME]
  if (!token) {
    await reply.code(401).send({ error: '未登录' })
    return
  }
  try {
    req.user = readToken(token)
  } catch {
    await reply.code(401).send({ error: '登录已过期' })
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(req, reply)
  if (reply.sent) return
  if (req.user?.role !== 'admin') {
    await reply.code(403).send({ error: '需要管理员权限' })
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser
  }
}
