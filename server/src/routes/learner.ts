import type { FastifyInstance } from 'fastify'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { requireAuth } from '../auth'

function serializePlan(p: {
  id: string
  name: string
  wordbookIds: Prisma.JsonValue
  englishToChineseCount: number
  chineseToEnglishCount: number
  fillBlankCount: number
  color: string
  createdAt: Date
}) {
  return {
    id: p.id,
    name: p.name,
    wordbookIds: p.wordbookIds as string[],
    englishToChineseCount: p.englishToChineseCount,
    chineseToEnglishCount: p.chineseToEnglishCount,
    fillBlankCount: p.fillBlankCount,
    color: p.color,
    createdAt: p.createdAt.getTime(),
  }
}

function serializeSession(s: {
  id: string
  type: string
  date: string
  planId: string | null
  planName: string
  planColor: string
  startTime: string
  endTime: string | null
  words: Prisma.JsonValue
  rounds: Prisma.JsonValue
  totalRounds: number
  score: number | null
  status: string
}) {
  return {
    id: s.id,
    type: s.type,
    date: s.date,
    planId: s.planId,
    planName: s.planName,
    planColor: s.planColor,
    startTime: s.startTime,
    endTime: s.endTime,
    words: s.words as string[],
    rounds: s.rounds,
    totalRounds: s.totalRounds,
    score: s.score,
    status: s.status,
  }
}

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export async function registerLearnerRoutes(app: FastifyInstance) {
  app.get('/api/wordbooks', { preHandler: requireAuth }, async () => {
    const books = await prisma.wordbook.findMany({
      include: { words: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })
    return books.map((b) => ({
      id: b.id,
      name: b.name,
      category: b.category,
      categoryName: b.categoryName,
      words: b.words.map((w) => ({
        id: w.id,
        english: w.english,
        chinese: w.chinese,
        phonetic: w.phonetic,
        exampleEn: w.exampleEn,
        exampleCn: w.exampleCn,
        explanation: w.explanation,
      })),
    }))
  })

  app.get('/api/plans', { preHandler: requireAuth }, async (req) => {
    const plans = await prisma.learningPlan.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'asc' },
    })
    return plans.map(serializePlan)
  })

  app.post('/api/plans', { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as {
      id?: string
      name?: string
      wordbookIds?: string[]
      englishToChineseCount?: number
      chineseToEnglishCount?: number
      fillBlankCount?: number
      color?: string
      createdAt?: number
    }
    if (!body.name?.trim() || !body.wordbookIds?.length) {
      return reply.code(400).send({ error: '请填写计划名称并选择词库' })
    }
    const plan = await prisma.learningPlan.create({
      data: {
        id: body.id || newId(),
        userId: req.user!.id,
        name: body.name.trim(),
        wordbookIds: body.wordbookIds,
        englishToChineseCount: body.englishToChineseCount ?? 10,
        chineseToEnglishCount: body.chineseToEnglishCount ?? 10,
        fillBlankCount: body.fillBlankCount ?? 5,
        color: body.color || '#4285F4',
        createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
      },
    })
    return serializePlan(plan)
  })

  app.put('/api/plans/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const existing = await prisma.learningPlan.findFirst({
      where: { id, userId: req.user!.id },
    })
    if (!existing) return reply.code(404).send({ error: '计划不存在' })
    const body = req.body as Partial<{
      name: string
      wordbookIds: string[]
      englishToChineseCount: number
      chineseToEnglishCount: number
      fillBlankCount: number
      color: string
    }>
    const plan = await prisma.learningPlan.update({
      where: { id },
      data: {
        name: body.name?.trim() ?? existing.name,
        wordbookIds: (body.wordbookIds ?? existing.wordbookIds) as Prisma.InputJsonValue,
        englishToChineseCount: body.englishToChineseCount ?? existing.englishToChineseCount,
        chineseToEnglishCount: body.chineseToEnglishCount ?? existing.chineseToEnglishCount,
        fillBlankCount: body.fillBlankCount ?? existing.fillBlankCount,
        color: body.color ?? existing.color,
      },
    })
    return serializePlan(plan)
  })

  app.delete('/api/plans/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const existing = await prisma.learningPlan.findFirst({
      where: { id, userId: req.user!.id },
    })
    if (!existing) return reply.code(404).send({ error: '计划不存在' })
    await prisma.learningPlan.delete({ where: { id } })
    return { ok: true }
  })

  app.get('/api/sessions', { preHandler: requireAuth }, async (req) => {
    const sessions = await prisma.sessionRecord.findMany({
      where: { userId: req.user!.id },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    })
    return sessions.map(serializeSession)
  })

  app.post('/api/sessions', { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as {
      id?: string
      type?: string
      date?: string
      planId?: string | null
      planName?: string
      planColor?: string
      startTime?: string
      endTime?: string | null
      words?: string[]
      rounds?: unknown
      totalRounds?: number
      score?: number | null
      status?: string
    }
    if (!body.type || !body.date) {
      return reply.code(400).send({ error: '缺少学习记录字段' })
    }
    const session = await prisma.sessionRecord.create({
      data: {
        id: body.id || newId(),
        userId: req.user!.id,
        type: body.type,
        date: body.date,
        planId: body.planId ?? null,
        planName: body.planName || '',
        planColor: body.planColor || '#4285F4',
        startTime: body.startTime || new Date().toISOString(),
        endTime: body.endTime ?? null,
        words: body.words ?? [],
        rounds: (body.rounds ?? []) as Prisma.InputJsonValue,
        totalRounds: body.totalRounds ?? 0,
        score: body.score ?? null,
        status: body.status || 'completed',
      },
    })
    return serializeSession(session)
  })

  app.get('/api/word-stats', { preHandler: requireAuth }, async (req) => {
    const rows = await prisma.wordStat.findMany({ where: { userId: req.user!.id } })
    const map: Record<string, unknown> = {}
    for (const r of rows) {
      map[r.english] = {
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
    return map
  })

  app.put('/api/word-stats', { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as {
      english?: string
      reviewCount?: number
      correctCount?: number
      wrongCount?: number
      lastReviewTime?: string | null
      nextReviewTime?: string | null
      easeFactor?: number
      interval?: number
    }
    if (!body.english) return reply.code(400).send({ error: '缺少单词' })
    const row = await prisma.wordStat.upsert({
      where: { userId_english: { userId: req.user!.id, english: body.english } },
      create: {
        userId: req.user!.id,
        english: body.english,
        reviewCount: body.reviewCount ?? 0,
        correctCount: body.correctCount ?? 0,
        wrongCount: body.wrongCount ?? 0,
        lastReviewTime: body.lastReviewTime ?? null,
        nextReviewTime: body.nextReviewTime ?? null,
        easeFactor: body.easeFactor ?? 2.5,
        interval: body.interval ?? 0,
      },
      update: {
        reviewCount: body.reviewCount ?? 0,
        correctCount: body.correctCount ?? 0,
        wrongCount: body.wrongCount ?? 0,
        lastReviewTime: body.lastReviewTime ?? null,
        nextReviewTime: body.nextReviewTime ?? null,
        easeFactor: body.easeFactor ?? 2.5,
        interval: body.interval ?? 0,
      },
    })
    return {
      english: row.english,
      reviewCount: row.reviewCount,
      correctCount: row.correctCount,
      wrongCount: row.wrongCount,
      lastReviewTime: row.lastReviewTime,
      nextReviewTime: row.nextReviewTime,
      easeFactor: row.easeFactor,
      interval: row.interval,
    }
  })

  app.get('/api/progress', { preHandler: requireAuth }, async (req) => {
    const row = await prisma.inProgress.findUnique({ where: { userId: req.user!.id } })
    return row ? row.state : null
  })

  app.put('/api/progress', { preHandler: requireAuth }, async (req) => {
    const state = req.body as Prisma.InputJsonValue
    await prisma.inProgress.upsert({
      where: { userId: req.user!.id },
      create: { userId: req.user!.id, state },
      update: { state },
    })
    return { ok: true }
  })

  app.delete('/api/progress', { preHandler: requireAuth }, async (req) => {
    await prisma.inProgress.deleteMany({ where: { userId: req.user!.id } })
    return { ok: true }
  })

  app.get('/api/streak', { preHandler: requireAuth }, async (req) => {
    const row = await prisma.streak.findUnique({ where: { userId: req.user!.id } })
    return row ? { count: row.count, lastDay: row.lastDay } : { count: 0, lastDay: '' }
  })

  app.put('/api/streak', { preHandler: requireAuth }, async (req) => {
    const body = req.body as { count?: number; lastDay?: string }
    const row = await prisma.streak.upsert({
      where: { userId: req.user!.id },
      create: {
        userId: req.user!.id,
        count: body.count ?? 0,
        lastDay: body.lastDay ?? '',
      },
      update: {
        count: body.count ?? 0,
        lastDay: body.lastDay ?? '',
      },
    })
    return { count: row.count, lastDay: row.lastDay }
  })

  app.get('/api/settings', { preHandler: requireAuth }, async (req) => {
    const row = await prisma.settings.findUnique({ where: { userId: req.user!.id } })
    return row
      ? { ttsEnabled: row.ttsEnabled, soundEnabled: row.soundEnabled }
      : { ttsEnabled: true, soundEnabled: true }
  })

  app.put('/api/settings', { preHandler: requireAuth }, async (req) => {
    const body = req.body as { ttsEnabled?: boolean; soundEnabled?: boolean }
    const row = await prisma.settings.upsert({
      where: { userId: req.user!.id },
      create: {
        userId: req.user!.id,
        ttsEnabled: body.ttsEnabled ?? true,
        soundEnabled: body.soundEnabled ?? true,
      },
      update: {
        ttsEnabled: body.ttsEnabled ?? true,
        soundEnabled: body.soundEnabled ?? true,
      },
    })
    return { ttsEnabled: row.ttsEnabled, soundEnabled: row.soundEnabled }
  })
}

export { serializePlan, serializeSession }
