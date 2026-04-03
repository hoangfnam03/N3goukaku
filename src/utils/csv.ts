import type { VocabEntry } from '../types'

function removeVietnameseDiacritics(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

function normalizeHeader(input: string) {
  return removeVietnameseDiacritics(input).toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(cell.trim())
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1
      }
      row.push(cell.trim())
      if (row.some((value) => value.length > 0)) {
        rows.push(row)
      }
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim())
    if (row.some((value) => value.length > 0)) {
      rows.push(row)
    }
  }

  return rows
}

function getColumnIndex(headers: string[], candidates: string[]) {
  for (const candidate of candidates) {
    const index = headers.findIndex((header) => header === candidate)
    if (index !== -1) {
      return index
    }
  }
  return -1
}

export function csvToVocabEntries(csvText: string, sourceId: string) {
  const rows = parseCsv(csvText)
  if (rows.length < 2) {
    return [] as VocabEntry[]
  }

  const headerRow = rows[0].map((item) => normalizeHeader(item))

  const kanjiIndex = getColumnIndex(headerRow, ['kanji'])
  const hanVietIndex = getColumnIndex(headerRow, ['amhanviet', 'hanviet'])
  const kanaIndex = getColumnIndex(headerRow, ['hiraganakatakana', 'hiragana', 'katakana', 'kana'])
  const meaningIndex = getColumnIndex(headerRow, ['nghia', 'meaning'])

  if (kanaIndex === -1 || meaningIndex === -1) {
    throw new Error('Sheet phải có cột Hiragana/Katakana (hoặc kana) và Nghĩa (hoặc meaning).')
  }

  return rows.slice(1).flatMap((columns, rowIndex) => {
    const kana = columns[kanaIndex]?.trim() ?? ''
    const meaning = columns[meaningIndex]?.trim() ?? ''
    if (!kana || !meaning) {
      return []
    }

    return [
      {
        id: `${sourceId}-${rowIndex + 1}-${kana}`,
        sourceId,
        kanji: kanjiIndex >= 0 ? (columns[kanjiIndex] ?? '').trim() : '',
        hanViet: hanVietIndex >= 0 ? (columns[hanVietIndex] ?? '').trim() : '',
        kana,
        meaning,
      },
    ]
  })
}