import type { CrawledQuizQuestion, QuizSource, VocabEntry, VocabSource } from '../types'
import { csvToVocabEntries } from '../utils/csv'

function toGoogleCsvUrl(inputUrl: string) {
  const url = new URL(inputUrl)
  const raw = url.toString()

  if (raw.includes('output=csv') || raw.includes('format=csv')) {
    return raw
  }

  if (raw.includes('/pubhtml')) {
    return raw.replace('/pubhtml', '/pub?output=csv')
  }

  const publishedIdMatch = raw.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/)
  if (publishedIdMatch) {
    return `https://docs.google.com/spreadsheets/d/e/${publishedIdMatch[1]}/pub?output=csv`
  }

  const sheetIdMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!sheetIdMatch) {
    return raw
  }

  const gid = url.searchParams.get('gid') ?? '0'
  return `https://docs.google.com/spreadsheets/d/${sheetIdMatch[1]}/export?format=csv&gid=${gid}`
}

export async function fetchVocabFromSource(source: VocabSource) {
  const csvUrl = toGoogleCsvUrl(source.url)
  const response = await fetch(csvUrl)
  if (!response.ok) {
    throw new Error(`Không tải được sheet: ${source.name}`)
  }
  const text = await response.text()
  return csvToVocabEntries(text, source.id)
}

export async function fetchAllVocab(sources: VocabSource[]) {
  const enabledSources = sources.filter((item) => item.enabled)
  const result = await Promise.all(enabledSources.map((item) => fetchVocabFromSource(item)))
  return result.flat()
}

type UnknownJson = Record<string, unknown>

function normalizeQuestion(item: UnknownJson, sourceId: string, index: number): CrawledQuizQuestion | null {
  const question = String(item.question ?? item.prompt ?? '').trim()
  const optionsRaw = item.options
  const answer = String(item.answer ?? item.correctAnswer ?? '').trim()
  const explanation = String(item.explanation ?? item.reason ?? '').trim()

  if (!question || !answer || !Array.isArray(optionsRaw)) {
    return null
  }

  const options = optionsRaw.map((value) => String(value).trim()).filter(Boolean)
  if (options.length < 2) {
    return null
  }

  return {
    id: `${sourceId}-${index + 1}`,
    sourceId,
    question,
    options,
    answer,
    explanation: explanation || undefined,
  }
}

function extractQuestionArray(parsed: unknown) {
  if (Array.isArray(parsed)) {
    return parsed
  }
  if (parsed && typeof parsed === 'object') {
    const record = parsed as UnknownJson
    const candidates = [record.questions, record.items, record.data]
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate
      }
    }
  }
  return []
}

export function parseQuizJson(raw: string, sourceId: string) {
  const parsed = JSON.parse(raw)
  const array = extractQuestionArray(parsed)
  return array
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null
      }
      return normalizeQuestion(item as UnknownJson, sourceId, index)
    })
    .filter((item): item is CrawledQuizQuestion => Boolean(item))
}

export async function fetchQuizFromSource(source: QuizSource) {
  const response = await fetch(source.url)
  if (!response.ok) {
    throw new Error(`Không tải được JSON: ${source.name}`)
  }
  const text = await response.text()
  return parseQuizJson(text, source.id)
}

export async function fetchAllQuiz(sources: QuizSource[]) {
  const enabledSources = sources.filter((item) => item.enabled)
  const result = await Promise.all(enabledSources.map((item) => fetchQuizFromSource(item)))
  return result.flat()
}

export function pickRandom<T>(items: T[], count: number) {
  const copied = [...items]
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copied[i], copied[j]] = [copied[j], copied[i]]
  }
  return copied.slice(0, Math.max(0, Math.min(count, copied.length)))
}

export function toHiragana(input: string) {
  return input.replace(/[\u30A1-\u30F6]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60),
  )
}

export function normalizeKana(input: string) {
  return toHiragana(input).replace(/\s/g, '').trim()
}

export function formatVocabLine(item: VocabEntry) {
  const base = item.kanji || item.kana
  const hv = item.hanViet ? ` (${item.hanViet})` : ''
  return `${base}${hv} - ${item.kana}: ${item.meaning}`
}