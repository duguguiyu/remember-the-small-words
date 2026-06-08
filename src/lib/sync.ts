import { parseIndexCSV, parseWordsCSV } from './csv'
import type { Wordbook } from './types'
import type { IndexEntry } from './csv'

const CDN_BASE = 'https://statics01.readland.cn/remember_words/dataset'
const isDev = import.meta.env.DEV

export async function fetchIndex(): Promise<IndexEntry[]> {
  if (isDev) {
    return fetchLocalIndex()
  }
  const url = `${CDN_BASE}/index.csv?t=${Date.now()}_${Math.random().toString(36).slice(2)}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Failed to fetch index.csv: ${resp.status}`)
  const text = await resp.text()
  return parseIndexCSV(text)
}

async function fetchLocalIndex(): Promise<IndexEntry[]> {
  const resp = await fetch('/datasets/index.json')
  if (!resp.ok) throw new Error(`Failed to fetch local index.json: ${resp.status}`)
  const entries: Array<{ id: string; name: string; category: string; category_name: string; file: string }> = await resp.json()
  return entries.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    categoryName: e.category_name,
    fileMd5: e.file,
  }))
}

export async function fetchWordbook(entry: IndexEntry): Promise<Wordbook> {
  const url = isDev
    ? `/datasets/${entry.fileMd5}`
    : `${CDN_BASE}/${entry.fileMd5}.csv`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Failed to fetch wordbook ${entry.id}: ${resp.status}`)
  const text = await resp.text()
  const words = parseWordsCSV(text)
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    categoryName: entry.categoryName,
    md5: entry.fileMd5,
    words,
  }
}

export async function syncWordbooks(
  localBooks: Wordbook[],
  onProgress?: (msg: string) => void
): Promise<Wordbook[]> {
  onProgress?.('正在获取词库列表...')
  const entries = await fetchIndex()

  const localMap = new Map(localBooks.map((b) => [b.id, b]))
  const updatedBooks: Wordbook[] = []

  for (const entry of entries) {
    const local = localMap.get(entry.id)
    if (!isDev && local && local.md5 === entry.fileMd5) {
      updatedBooks.push({
        ...local,
        name: entry.name,
        category: entry.category,
        categoryName: entry.categoryName,
      })
    } else {
      onProgress?.(`正在下载: ${entry.categoryName} - ${entry.name}`)
      try {
        const book = await fetchWordbook(entry)
        updatedBooks.push(book)
      } catch (e) {
        if (local) {
          updatedBooks.push(local)
        }
        console.error(`Failed to sync wordbook ${entry.id}:`, e)
      }
    }
  }

  return updatedBooks
}
