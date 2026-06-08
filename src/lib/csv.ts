import Papa from 'papaparse'
import type { Word } from './types'

export function parseWordsCSV(csvText: string): Word[] {
  const result = Papa.parse(csvText, { skipEmptyLines: true })
  const rows = result.data as string[][]
  if (rows.length === 0) return []

  const fmt = detectFormat(rows)
  const words: Word[] = []
  const headerWords = ['英文', 'english', 'word', '单词']

  for (const row of rows) {
    if (row.length < 2) continue
    const first = (row[0] || '').trim().toLowerCase()
    if (!first || headerWords.includes(first)) continue
    words.push(parseRow(row, fmt))
  }

  return words
}

function detectFormat(rows: string[][]): 'v1' | 'v2' {
  const headerWords = ['英文', 'english', 'word', '单词']
  for (const r of rows) {
    if (r.length < 2) continue
    const f = (r[0] || '').trim().toLowerCase()
    if (!f || headerWords.includes(f)) continue
    return r.length >= 6 ? 'v2' : 'v1'
  }
  return 'v1'
}

function parseRow(r: string[], fmt: 'v1' | 'v2'): Word {
  if (fmt === 'v2') {
    return {
      english: (r[0] || '').trim(),
      chinese: (r[1] || '').trim(),
      phonetic: (r[2] || '').trim(),
      exampleEn: (r[3] || '').trim(),
      exampleCn: (r[4] || '').trim(),
      explanation: r.slice(5).join(',').trim(),
    }
  }
  return {
    english: (r[0] || '').trim(),
    chinese: (r[1] || '').trim(),
    phonetic: (r[2] || '').trim(),
    exampleEn: '',
    exampleCn: '',
    explanation: r.slice(3).join(',').trim(),
  }
}

export interface IndexEntry {
  id: string
  name: string
  category: string
  categoryName: string
  fileMd5: string
}

export function parseIndexCSV(csvText: string): IndexEntry[] {
  const result = Papa.parse(csvText, { skipEmptyLines: true })
  const rows = result.data as string[][]
  if (rows.length < 2) return []

  const entries: IndexEntry[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    if (r.length < 5) continue
    entries.push({
      id: (r[0] || '').trim(),
      name: (r[1] || '').trim(),
      category: (r[2] || '').trim(),
      categoryName: (r[3] || '').trim(),
      fileMd5: (r[4] || '').trim(),
    })
  }
  return entries
}
