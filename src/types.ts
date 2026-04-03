export type VocabSource = {
  id: string
  name: string
  url: string
  enabled: boolean
}

export type QuizSource = {
  id: string
  name: string
  url: string
  enabled: boolean
}

export type VocabEntry = {
  id: string
  sourceId: string
  kanji: string
  hanViet: string
  kana: string
  meaning: string
}

export type AIJLPTQuestion = {
  question: string
  options: string[]
  answer: string
  explanation: string
}

export type CrawledQuizQuestion = {
  id: string
  sourceId: string
  question: string
  options: string[]
  answer: string
  explanation?: string
}