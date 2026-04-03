import type { QuizSource, VocabSource } from '../types'

const VOCAB_SOURCES_KEY = 'n3goukaku.vocabSources'
const QUIZ_SOURCES_KEY = 'n3goukaku.quizSources'

function loadArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function saveArray<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function loadVocabSources() {
  return loadArray<VocabSource>(VOCAB_SOURCES_KEY)
}

export function saveVocabSources(value: VocabSource[]) {
  saveArray(VOCAB_SOURCES_KEY, value)
}

export function loadQuizSources() {
  return loadArray<QuizSource>(QUIZ_SOURCES_KEY)
}

export function saveQuizSources(value: QuizSource[]) {
  saveArray(QUIZ_SOURCES_KEY, value)
}