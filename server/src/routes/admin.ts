import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { hashPassword, requireAdmin } from '../auth'
import { parseWordsCSV } from '../csv'
import { serializePlan, serializeSession } from './learner'

const USERNAME_RE = /^[a-zA-Z0-9_\-]{2,32}$/
const WORDBOOK_ID_RE = /^[a-zA-Z0-9_\-]{1,64}$/

function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return base || `book_${Date.now().toString(36)}`
}

function serializeWord(w: {
  id: string
  english: string
  chinese: string
  phonetic: string
  exampleEn: string
  exampleCn: string
  explanation: string
  sortOrder: number
}) {
  return {
    id: w.id,
    english: w.english,
    chinese: w.chinese,
    phonetic: w.phonetic,
    exampleEn: w.exampleEn,
    exampleCn: w.exampleCn,
    explanation: w.explanation,
    sortOrder: w.sortOrder,
  }
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get('/api/admin/users', { preHandler: requireAdmin }, async () => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        streak: true,
        sessions: { select: { date: true }, orderBy: { date: 'desc' }, take: 1 },
        _count: { select: { sessions: true } },
      },
    })
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      disabled: u.disabled,
      createdAt: u.createdAt.toISOString(),
      streakCount: u.streak?.count ?? 0,
      lastStudyDate: u.sessions[0]?.date ?? null,
      sessionCount: u._count.sessions,
    }))
  })

  app.post('/api/admin/users', { preHandler: requireAdmin }, async (req, reply) => {
    const body = req.body as { username?: string; password?: string; role?: string }
    const username = (body.username || '').trim()
    const password = body.password || ''
    const role = body.role === 'admin' ? 'admin' : 'learner'
    if (!USERNAME_RE.test(username)) {
      return reply.code(400).send({ error: '用户名为 2–32 位字母、数字、下划线或短横线' })
    }
    if (password.length < 6) {
      return reply.code(400).send({ error: '密码至少 6 位' })
    }
    const exists = await prisma.user.findUnique({ where: { username } })
    if (exists) return reply.code(409).send({ error: '用户名已存在' })
    const user = await prisma.user.create({
      data: { username, passwordHash: hashPassword(password), role },
    })
    return { id: user.id, username: user.username, role: user.role, disabled: user.disabled }
  })

  app.patch('/api/admin/users/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as { disabled?: boolean }
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return reply.code(404).send({ error: '用户不存在' })
    if (user.id === req.user!.id && body.disabled) {
      return reply.code(400).send({ error: '不能停用当前登录的管理员' })
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { disabled: body.disabled ?? user.disabled },
    })
    return {
      id: updated.id,
      username: updated.username,
      role: updated.role,
      disabled: updated.disabled,
    }
  })

  app.post('/api/admin/users/:id/reset-password', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as { password?: string }
    if (!body.password || body.password.length < 6) {
      return reply.code(400).send({ error: '密码至少 6 位' })
    }
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return reply.code(404).send({ error: '用户不存在' })
    await prisma.user.update({
      where: { id },
      data: { passwordHash: hashPassword(body.password) },
    })
    return { ok: true }
  })

  app.get('/api/admin/users/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        streak: true,
        plans: { orderBy: { createdAt: 'asc' } },
        sessions: { orderBy: [{ date: 'desc' }, { startTime: 'desc' }] },
        wordStats: true,
        inProgress: true,
      },
    })
    if (!user) return reply.code(404).send({ error: '用户不存在' })
    const wordStats: Record<string, unknown> = {}
    for (const r of user.wordStats) {
      wordStats[r.english] = {
        english: r.english,
        reviewCount: r.reviewCount,
        correctCount: r.correctCount,
        wrongCount: r.wrongCount,
        lastReviewTime: r.lastReviewTime,
        nextReviewTime: r.nextReviewTime,
        easeFactor: r.easeFactor,
        interval: r.interval,
      }
    }
    return {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        disabled: user.disabled,
        createdAt: user.createdAt.toISOString(),
      },
      streak: user.streak
        ? { count: user.streak.count, lastDay: user.streak.lastDay }
        : { count: 0, lastDay: '' },
      plans: user.plans.map(serializePlan),
      sessions: user.sessions.map(serializeSession),
      wordStats,
      hasInProgress: Boolean(user.inProgress),
    }
  })

  app.post('/api/admin/users/:id/import-backup', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) return reply.code(404).send({ error: '用户不存在' })
    const data = req.body as {
      version?: number
      wordStats?: Record<string, {
        english: string
        reviewCount: number
        correctCount: number
        wrongCount: number
        lastReviewTime: string | null
        nextReviewTime: string | null
        easeFactor: number
        interval: number
      }>
      sessions?: Array<{
        id: string
        type: string
        date: string
        planId: string | null
        planName: string
        planColor: string
        startTime: string
        endTime: string | null
        words: string[]
        rounds: Prisma.InputJsonValue
        totalRounds: number
        score: number | null
        status: string
      }>
      plans?: Array<{
        id: string
        name: string
        wordbookIds: string[]
        englishToChineseCount: number
        chineseToEnglishCount: number
        fillBlankCount: number
        color: string
        createdAt: number
      }>
      streak?: { count: number; lastDay: string }
    }
    if (data.version !== 2) {
      return reply.code(400).send({ error: '备份文件版本不兼容，需要 version 2' })
    }

    await prisma.$transaction(async (tx) => {
      await tx.learningPlan.deleteMany({ where: { userId: id } })
      await tx.sessionRecord.deleteMany({ where: { userId: id } })
      await tx.wordStat.deleteMany({ where: { userId: id } })
      await tx.streak.deleteMany({ where: { userId: id } })

      const plans = data.plans || []
      if (plans.length) {
        await tx.learningPlan.createMany({
          data: plans.map((p) => ({
            id: `${id}:${p.id}`,
            userId: id,
            name: p.name,
            wordbookIds: p.wordbookIds,
            englishToChineseCount: p.englishToChineseCount,
            chineseToEnglishCount: p.chineseToEnglishCount,
            fillBlankCount: p.fillBlankCount,
            color: p.color,
            createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
          })),
        })
      }

      const sessions = data.sessions || []
      if (sessions.length) {
        await tx.sessionRecord.createMany({
          data: sessions.map((s) => ({
            id: `${id}:${s.id}`,
            userId: id,
            type: s.type,
            date: s.date,
            planId: s.planId ? `${id}:${s.planId}` : null,
            planName: s.planName,
            planColor: s.planColor,
            startTime: s.startTime,
            endTime: s.endTime ?? null,
            words: s.words ?? [],
            rounds: s.rounds ?? [],
            totalRounds: s.totalRounds ?? 0,
            score: s.score ?? null,
            status: s.status || 'completed',
          })),
        })
      }

      const statsEntries = Object.entries(data.wordStats || {})
      if (statsEntries.length) {
        await tx.wordStat.createMany({
          data: statsEntries.map(([english, s]) => ({
            userId: id,
            english: s.english || english,
            reviewCount: s.reviewCount ?? 0,
            correctCount: s.correctCount ?? 0,
            wrongCount: s.wrongCount ?? 0,
            lastReviewTime: s.lastReviewTime ?? null,
            nextReviewTime: s.nextReviewTime ?? null,
            easeFactor: s.easeFactor ?? 2.5,
            interval: s.interval ?? 0,
          })),
        })
      }

      if (data.streak) {
        await tx.streak.create({
          data: {
            userId: id,
            count: data.streak.count ?? 0,
            lastDay: data.streak.lastDay ?? '',
          },
        })
      }
    })

    return { ok: true }
  })

  app.get('/api/admin/wordbooks', { preHandler: requireAdmin }, async () => {
    const books = await prisma.wordbook.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { words: true } } },
    })
    return books.map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      categoryName: b.categoryName,
      wordCount: b._count.words,
      updatedAt: b.updatedAt.toISOString(),
    }))
  })

  app.get('/api/admin/wordbooks/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const book = await prisma.wordbook.findUnique({
      where: { id },
      include: { words: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!book) return reply.code(404).send({ error: '词库不存在' })
    return {
      id: book.id,
      name: book.name,
      category: book.category,
      categoryName: book.categoryName,
      words: book.words.map(serializeWord),
    }
  })

  app.post('/api/admin/wordbooks', { preHandler: requireAdmin }, async (req, reply) => {
    const body = req.body as {
      id?: string
      name?: string
      category?: string
      categoryName?: string
    }
    const name = (body.name || '').trim()
    const category = (body.category || '').trim()
    const categoryName = (body.categoryName || '').trim()
    if (!name || !category || !categoryName) {
      return reply.code(400).send({ error: '请填写名称、分类和分类显示名' })
    }
    let id = (body.id || slugify(name)).trim()
    if (!WORDBOOK_ID_RE.test(id)) {
      return reply.code(400).send({ error: '词库 ID 仅允许字母、数字、下划线和短横线' })
    }
    const exists = await prisma.wordbook.findUnique({ where: { id } })
    if (exists) return reply.code(409).send({ error: '词库 ID 已存在' })
    const book = await prisma.wordbook.create({
      data: { id, name, category, categoryName },
    })
    return { id: book.id, name: book.name, category: book.category, categoryName: book.categoryName, words: [] }
  })

  app.put('/api/admin/wordbooks/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const existing = await prisma.wordbook.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ error: '词库不存在' })
    const body = req.body as { name?: string; category?: string; categoryName?: string }
    const book = await prisma.wordbook.update({
      where: { id },
      data: {
        name: body.name?.trim() || existing.name,
        category: body.category?.trim() || existing.category,
        categoryName: body.categoryName?.trim() || existing.categoryName,
      },
    })
    return { id: book.id, name: book.name, category: book.category, categoryName: book.categoryName }
  })

  app.delete('/api/admin/wordbooks/:id', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const existing = await prisma.wordbook.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ error: '词库不存在' })
    await prisma.wordbook.delete({ where: { id } })
    return { ok: true }
  })

  app.post('/api/admin/wordbooks/:id/upload', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const existing = await prisma.wordbook.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ error: '词库不存在' })
    const file = await req.file()
    if (!file) return reply.code(400).send({ error: '请上传 CSV 文件' })
    const buf = await file.toBuffer()
    const words = parseWordsCSV(buf.toString('utf8'))
    if (words.length === 0) return reply.code(400).send({ error: 'CSV 中没有有效词条' })

    await prisma.$transaction(async (tx) => {
      await tx.word.deleteMany({ where: { wordbookId: id } })
      await tx.word.createMany({
        data: words.map((w, i) => ({
          wordbookId: id,
          english: w.english,
          chinese: w.chinese,
          phonetic: w.phonetic,
          exampleEn: w.exampleEn,
          exampleCn: w.exampleCn,
          explanation: w.explanation,
          sortOrder: i,
        })),
      })
    })

    const book = await prisma.wordbook.findUnique({
      where: { id },
      include: { words: { orderBy: { sortOrder: 'asc' } } },
    })
    return {
      id: book!.id,
      name: book!.name,
      category: book!.category,
      categoryName: book!.categoryName,
      words: book!.words.map(serializeWord),
    }
  })

  app.post('/api/admin/wordbooks/:id/words', { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const existing = await prisma.wordbook.findUnique({ where: { id } })
    if (!existing) return reply.code(404).send({ error: '词库不存在' })
    const body = req.body as {
      english?: string
      chinese?: string
      phonetic?: string
      exampleEn?: string
      exampleCn?: string
      explanation?: string
    }
    if (!body.english?.trim() || !body.chinese?.trim()) {
      return reply.code(400).send({ error: '请填写英文和中文' })
    }
    const max = await prisma.word.aggregate({
      where: { wordbookId: id },
      _max: { sortOrder: true },
    })
    const word = await prisma.word.create({
      data: {
        wordbookId: id,
        english: body.english.trim(),
        chinese: body.chinese.trim(),
        phonetic: (body.phonetic || '').trim(),
        exampleEn: (body.exampleEn || '').trim(),
        exampleCn: (body.exampleCn || '').trim(),
        explanation: (body.explanation || '').trim(),
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    })
    return serializeWord(word)
  })

  app.put('/api/admin/wordbooks/:id/words/:wordId', { preHandler: requireAdmin }, async (req, reply) => {
    const { id, wordId } = req.params as { id: string; wordId: string }
    const word = await prisma.word.findFirst({ where: { id: wordId, wordbookId: id } })
    if (!word) return reply.code(404).send({ error: '词条不存在' })
    const body = req.body as Partial<{
      english: string
      chinese: string
      phonetic: string
      exampleEn: string
      exampleCn: string
      explanation: string
    }>
    const updated = await prisma.word.update({
      where: { id: wordId },
      data: {
        english: body.english?.trim() ?? word.english,
        chinese: body.chinese?.trim() ?? word.chinese,
        phonetic: body.phonetic?.trim() ?? word.phonetic,
        exampleEn: body.exampleEn?.trim() ?? word.exampleEn,
        exampleCn: body.exampleCn?.trim() ?? word.exampleCn,
        explanation: body.explanation?.trim() ?? word.explanation,
      },
    })
    return serializeWord(updated)
  })

  app.delete('/api/admin/wordbooks/:id/words/:wordId', { preHandler: requireAdmin }, async (req, reply) => {
    const { id, wordId } = req.params as { id: string; wordId: string }
    const word = await prisma.word.findFirst({ where: { id: wordId, wordbookId: id } })
    if (!word) return reply.code(404).send({ error: '词条不存在' })
    await prisma.word.delete({ where: { id: wordId } })
    return { ok: true }
  })
}
