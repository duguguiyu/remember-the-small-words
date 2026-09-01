import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'
import { prisma } from './db'
import { hashPassword } from './auth'
import { parseWordsCSV } from './csv'

function findDatasetsDir(): string {
  if (process.env.DATASETS_DIR) {
    return path.resolve(process.env.DATASETS_DIR)
  }
  const candidates = [
    path.resolve(process.cwd(), 'datasets'),
    path.resolve(process.cwd(), '../datasets'),
    path.resolve(__dirname, '../../datasets'),
    path.resolve(__dirname, '../datasets'),
  ]
  const found = candidates.find((p) => fs.existsSync(path.join(p, 'index.yaml')))
  if (!found) {
    throw new Error(`datasets/index.yaml not found. Tried: ${candidates.join(', ')}`)
  }
  return found
}

interface IndexEntry {
  id: string
  name: string
  category: string
  category_name: string
  file: string
}

export async function seedWordbooks(datasetsDir: string): Promise<number> {
  const indexPath = path.join(datasetsDir, 'index.yaml')
  const raw = fs.readFileSync(indexPath, 'utf8')
  const data = parse(raw) as { wordbooks: IndexEntry[] }
  const entries = data.wordbooks || []
  let count = 0

  for (const entry of entries) {
    const csvPath = path.join(datasetsDir, entry.file)
    if (!fs.existsSync(csvPath)) {
      console.warn(`Skip missing file: ${csvPath}`)
      continue
    }
    const words = parseWordsCSV(fs.readFileSync(csvPath, 'utf8'))
    await prisma.wordbook.upsert({
      where: { id: entry.id },
      create: {
        id: entry.id,
        name: entry.name,
        category: entry.category,
        categoryName: entry.category_name,
      },
      update: {
        name: entry.name,
        category: entry.category,
        categoryName: entry.category_name,
      },
    })
    await prisma.word.deleteMany({ where: { wordbookId: entry.id } })
    if (words.length) {
      await prisma.word.createMany({
        data: words.map((w, i) => ({
          wordbookId: entry.id,
          english: w.english,
          chinese: w.chinese,
          phonetic: w.phonetic,
          exampleEn: w.exampleEn,
          exampleCn: w.exampleCn,
          explanation: w.explanation,
          sortOrder: i,
        })),
      })
    }
    count++
    console.log(`Seeded wordbook ${entry.id} (${words.length} words)`)
  }

  return count
}

export async function seedAdmin(): Promise<void> {
  const username = process.env.BOOTSTRAP_ADMIN_USER
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD
  if (!username || !password) {
    console.log('BOOTSTRAP_ADMIN_USER/PASSWORD not set, skip admin seed')
    return
  }
  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    console.log(`Admin user "${username}" already exists`)
    return
  }
  await prisma.user.create({
    data: {
      username,
      passwordHash: hashPassword(password),
      role: 'admin',
    },
  })
  console.log(`Created admin user "${username}"`)
}

async function main() {
  loadEnv()
  const datasetsDir = findDatasetsDir()
  console.log(`Datasets dir: ${datasetsDir}`)
  await seedAdmin()
  const n = await seedWordbooks(datasetsDir)
  console.log(`Done. ${n} wordbooks seeded.`)
}

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

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
