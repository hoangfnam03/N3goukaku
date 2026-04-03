import { useEffect, useMemo, useState } from 'react'
import {
  explainAnswerWithGemini,
  generateJlptQuestionsWithGemini,
} from './services/gemini'
import {
  fetchAllQuiz,
  fetchAllVocab,
  formatVocabLine,
  normalizeKana,
  parseQuizJson,
  pickRandom,
} from './services/sources'
import type {
  AIJLPTQuestion,
  CrawledQuizQuestion,
  QuizSource,
  VocabEntry,
  VocabSource,
} from './types'
import {
  loadQuizSources,
  loadVocabSources,
  saveQuizSources,
  saveVocabSources,
} from './utils/storage'

type TabKey = 'sources' | 'jlpt-ai' | 'crawl-quiz' | 'typing'

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('sources')
  const [status, setStatus] = useState('Sẵn sàng học.')

  const [vocabSources, setVocabSources] = useState<VocabSource[]>([])
  const [quizSources, setQuizSources] = useState<QuizSource[]>([])

  const [newVocabSource, setNewVocabSource] = useState({ name: '', url: '' })
  const [newQuizSource, setNewQuizSource] = useState({ name: '', url: '' })

  const [vocabEntries, setVocabEntries] = useState<VocabEntry[]>([])
  const [quizQuestions, setQuizQuestions] = useState<CrawledQuizQuestion[]>([])
  const [rawJsonInput, setRawJsonInput] = useState('')

  const [jlptCount, setJlptCount] = useState(10)
  const [jlptSourceId, setJlptSourceId] = useState('all')
  const [jlptQuestions, setJlptQuestions] = useState<AIJLPTQuestion[]>([])
  const [isGeneratingJlpt, setIsGeneratingJlpt] = useState(false)

  const [quizIndex, setQuizIndex] = useState(0)
  const [quizAnswer, setQuizAnswer] = useState('')
  const [quizResult, setQuizResult] = useState<null | boolean>(null)
  const [quizAiFeedback, setQuizAiFeedback] = useState('')
  const [isLoadingQuizFeedback, setIsLoadingQuizFeedback] = useState(false)

  const [typingSourceId, setTypingSourceId] = useState('all')
  const [typingCount, setTypingCount] = useState(15)
  const [typingQueue, setTypingQueue] = useState<VocabEntry[]>([])
  const [typingIndex, setTypingIndex] = useState(0)
  const [typingInput, setTypingInput] = useState('')
  const [typingScore, setTypingScore] = useState(0)
  const [typingMessage, setTypingMessage] = useState('')

  useEffect(() => {
    setVocabSources(loadVocabSources())
    setQuizSources(loadQuizSources())
  }, [])

  useEffect(() => {
    saveVocabSources(vocabSources)
  }, [vocabSources])

  useEffect(() => {
    saveQuizSources(quizSources)
  }, [quizSources])

  const availableTypingItem = typingQueue[typingIndex]
  const availableQuizQuestion = quizQuestions[quizIndex]

  const selectedJlptVocab = useMemo(() => {
    if (jlptSourceId === 'all') {
      return vocabEntries
    }
    return vocabEntries.filter((item) => item.sourceId === jlptSourceId)
  }, [jlptSourceId, vocabEntries])

  const selectedTypingVocab = useMemo(() => {
    if (typingSourceId === 'all') {
      return vocabEntries
    }
    return vocabEntries.filter((item) => item.sourceId === typingSourceId)
  }, [typingSourceId, vocabEntries])

  const addVocabSource = () => {
    const name = newVocabSource.name.trim()
    const url = newVocabSource.url.trim()
    if (!name || !url) {
      setStatus('Nguồn từ vựng cần có tên và URL.')
      return
    }

    const item: VocabSource = {
      id: crypto.randomUUID(),
      name,
      url,
      enabled: true,
    }

    setVocabSources((prev) => [item, ...prev])
    setNewVocabSource({ name: '', url: '' })
    setStatus(`Đã thêm nguồn từ vựng: ${name}`)
  }

  const addQuizSource = () => {
    const name = newQuizSource.name.trim()
    const url = newQuizSource.url.trim()
    if (!name || !url) {
      setStatus('Nguồn JSON cần có tên và URL.')
      return
    }

    const item: QuizSource = {
      id: crypto.randomUUID(),
      name,
      url,
      enabled: true,
    }

    setQuizSources((prev) => [item, ...prev])
    setNewQuizSource({ name: '', url: '' })
    setStatus(`Đã thêm nguồn quiz: ${name}`)
  }

  const loadVocab = async () => {
    try {
      setStatus('Đang tải từ vựng từ Google Sheet...')
      const loaded = await fetchAllVocab(vocabSources)
      setVocabEntries(loaded)
      setStatus(`Đã tải ${loaded.length} từ vựng.`)
    } catch (error) {
      setStatus((error as Error).message)
    }
  }

  const loadQuiz = async () => {
    try {
      setStatus('Đang tải bộ câu hỏi JSON...')
      const loaded = await fetchAllQuiz(quizSources)
      setQuizQuestions(loaded)
      setQuizIndex(0)
      setQuizAnswer('')
      setQuizResult(null)
      setQuizAiFeedback('')
      setStatus(`Đã tải ${loaded.length} câu hỏi crawl.`)
    } catch (error) {
      setStatus((error as Error).message)
    }
  }

  const importRawQuizJson = () => {
    try {
      const sourceId = `manual-${Date.now()}`
      const parsed = parseQuizJson(rawJsonInput, sourceId)
      setQuizQuestions((prev) => [...parsed, ...prev])
      setRawJsonInput('')
      setStatus(`Đã import trực tiếp ${parsed.length} câu hỏi JSON.`)
    } catch {
      setStatus('JSON không hợp lệ hoặc không đúng schema.')
    }
  }

  const generateJlpt = async () => {
    if (!GEMINI_KEY) {
      setStatus('Thiếu VITE_GEMINI_API_KEY trong file .env')
      return
    }

    if (selectedJlptVocab.length < 4) {
      setStatus('Cần ít nhất 4 từ vựng để tạo đề AI.')
      return
    }

    setIsGeneratingJlpt(true)
    setJlptQuestions([])
    setStatus('Gemini đang tạo đề JLPT...')

    try {
      const sampled = pickRandom(selectedJlptVocab, Math.max(jlptCount * 2, 20))
      const lines = sampled.map((item) => formatVocabLine(item))
      const generated = await generateJlptQuestionsWithGemini(lines, jlptCount, GEMINI_KEY)
      setJlptQuestions(generated)
      setStatus(`Đã tạo ${generated.length} câu hỏi AI.`)
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setIsGeneratingJlpt(false)
    }
  }

  const submitQuizAnswer = () => {
    if (!availableQuizQuestion || !quizAnswer) {
      return
    }
    const isCorrect = quizAnswer === availableQuizQuestion.answer
    setQuizResult(isCorrect)
  }

  const nextQuiz = () => {
    setQuizIndex((prev) => (prev + 1 < quizQuestions.length ? prev + 1 : 0))
    setQuizAnswer('')
    setQuizResult(null)
    setQuizAiFeedback('')
  }

  const askAiToExplainQuiz = async () => {
    if (!GEMINI_KEY) {
      setStatus('Thiếu VITE_GEMINI_API_KEY trong file .env')
      return
    }
    if (!availableQuizQuestion || !quizAnswer) {
      return
    }

    setIsLoadingQuizFeedback(true)
    setQuizAiFeedback('')

    try {
      const feedback = await explainAnswerWithGemini(
        availableQuizQuestion.question,
        availableQuizQuestion.options,
        quizAnswer,
        availableQuizQuestion.answer,
        GEMINI_KEY,
        availableQuizQuestion.explanation,
      )
      setQuizAiFeedback(feedback)
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setIsLoadingQuizFeedback(false)
    }
  }

  const startTypingPractice = () => {
    if (selectedTypingVocab.length === 0) {
      setStatus('Chưa có dữ liệu từ vựng để luyện gõ.')
      return
    }

    const queue = pickRandom(selectedTypingVocab, typingCount)
    setTypingQueue(queue)
    setTypingIndex(0)
    setTypingInput('')
    setTypingScore(0)
    setTypingMessage('Bắt đầu! Hãy gõ đúng hiragana cho từng từ.')
  }

  const submitTyping = () => {
    if (!availableTypingItem) {
      return
    }

    const user = normalizeKana(typingInput)
    const expected = normalizeKana(availableTypingItem.kana)
    const isCorrect = user === expected

    if (isCorrect) {
      setTypingScore((prev) => prev + 1)
      setTypingMessage('Đúng!')
    } else {
      setTypingMessage(`Sai. Đáp án đúng: ${availableTypingItem.kana}`)
    }

    const next = typingIndex + 1
    setTypingInput('')

    if (next >= typingQueue.length) {
      setTypingIndex(next)
      return
    }

    setTypingIndex(next)
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="badge">N3/N2 Vocabulary Lab</p>
        <h1>Ôn từ vựng Nhật từ Google Sheet và JSON crawl</h1>
        <p className="subtitle">
          1 nền tảng, 3 chế độ học: tạo đề JLPT bằng AI, làm bài từ nguồn crawl có chữa,
          và luyện gõ hiragana.
        </p>
      </header>

      <nav className="tabs">
        <button
          className={activeTab === 'sources' ? 'active' : ''}
          onClick={() => setActiveTab('sources')}
        >
          Nguồn dữ liệu
        </button>
        <button
          className={activeTab === 'jlpt-ai' ? 'active' : ''}
          onClick={() => setActiveTab('jlpt-ai')}
        >
          AI đề JLPT
        </button>
        <button
          className={activeTab === 'crawl-quiz' ? 'active' : ''}
          onClick={() => setActiveTab('crawl-quiz')}
        >
          Quiz từ crawl
        </button>
        <button
          className={activeTab === 'typing' ? 'active' : ''}
          onClick={() => setActiveTab('typing')}
        >
          Luyện gõ Hiragana
        </button>
      </nav>

      <main>
        {activeTab === 'sources' && (
          <section className="panel">
            <h2>Quản lý nguồn học</h2>
            <p className="muted">
              Gợi ý: với Google Sheet, hãy dùng link CSV từ Publish to web để tải ổn định.
            </p>

            <div className="grid two">
              <div className="card">
                <h3>Nguồn từ vựng (Google Sheet)</h3>
                <input
                  value={newVocabSource.name}
                  onChange={(event) =>
                    setNewVocabSource((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Tên nguồn, ví dụ: Mimikara N3"
                />
                <input
                  value={newVocabSource.url}
                  onChange={(event) =>
                    setNewVocabSource((prev) => ({ ...prev, url: event.target.value }))
                  }
                  placeholder="Link Google Sheet CSV"
                />
                <button onClick={addVocabSource}>Thêm nguồn từ vựng</button>
                <button className="secondary" onClick={loadVocab}>
                  Tải toàn bộ từ vựng
                </button>
                <ul className="list">
                  {vocabSources.map((item) => (
                    <li key={item.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(event) =>
                            setVocabSources((prev) =>
                              prev.map((source) =>
                                source.id === item.id
                                  ? { ...source, enabled: event.target.checked }
                                  : source,
                              ),
                            )
                          }
                        />
                        {item.name}
                      </label>
                      <button
                        className="danger"
                        onClick={() =>
                          setVocabSources((prev) => prev.filter((source) => source.id !== item.id))
                        }
                      >
                        Xóa
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card">
                <h3>Nguồn quiz crawl (JSON)</h3>
                <input
                  value={newQuizSource.name}
                  onChange={(event) =>
                    setNewQuizSource((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Tên nguồn JSON"
                />
                <input
                  value={newQuizSource.url}
                  onChange={(event) =>
                    setNewQuizSource((prev) => ({ ...prev, url: event.target.value }))
                  }
                  placeholder="Link JSON public"
                />
                <button onClick={addQuizSource}>Thêm nguồn quiz</button>
                <button className="secondary" onClick={loadQuiz}>
                  Tải toàn bộ quiz
                </button>

                <textarea
                  value={rawJsonInput}
                  onChange={(event) => setRawJsonInput(event.target.value)}
                  placeholder='Hoặc dán JSON trực tiếp. Schema: [{"question":"...","options":[...],"answer":"..."}]'
                  rows={6}
                />
                <button className="secondary" onClick={importRawQuizJson}>
                  Import JSON đã dán
                </button>

                <ul className="list">
                  {quizSources.map((item) => (
                    <li key={item.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={item.enabled}
                          onChange={(event) =>
                            setQuizSources((prev) =>
                              prev.map((source) =>
                                source.id === item.id
                                  ? { ...source, enabled: event.target.checked }
                                  : source,
                              ),
                            )
                          }
                        />
                        {item.name}
                      </label>
                      <button
                        className="danger"
                        onClick={() =>
                          setQuizSources((prev) => prev.filter((source) => source.id !== item.id))
                        }
                      >
                        Xóa
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="summary-grid">
              <article>
                <strong>{vocabEntries.length}</strong>
                <span>Từ vựng đã tải</span>
              </article>
              <article>
                <strong>{quizQuestions.length}</strong>
                <span>Câu hỏi crawl đã tải</span>
              </article>
              <article>
                <strong>{vocabSources.filter((item) => item.enabled).length}</strong>
                <span>Nguồn từ vựng đang bật</span>
              </article>
            </div>
          </section>
        )}

        {activeTab === 'jlpt-ai' && (
          <section className="panel">
            <h2>AI tạo đề JLPT</h2>
            <div className="controls">
              <label>
                Chọn nguồn từ vựng
                <select
                  value={jlptSourceId}
                  onChange={(event) => setJlptSourceId(event.target.value)}
                >
                  <option value="all">Tất cả nguồn</option>
                  {vocabSources.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Số câu hỏi
                <input
                  type="number"
                  min={5}
                  max={40}
                  value={jlptCount}
                  onChange={(event) => setJlptCount(Number(event.target.value))}
                />
              </label>
              <button onClick={generateJlpt} disabled={isGeneratingJlpt}>
                {isGeneratingJlpt ? 'Đang tạo đề...' : 'Tạo đề JLPT bằng Gemini'}
              </button>
            </div>

            {!GEMINI_KEY && (
              <p className="warning">
                Chưa có API key. Thêm VITE_GEMINI_API_KEY trong file .env để bật AI.
              </p>
            )}

            <div className="question-list">
              {jlptQuestions.map((item, index) => (
                <article key={`${item.question}-${index}`} className="question-card">
                  <h3>
                    Câu {index + 1}. {item.question}
                  </h3>
                  <ol type="A">
                    {item.options.map((option) => (
                      <li key={option}>{option}</li>
                    ))}
                  </ol>
                  <p>
                    <strong>Đáp án:</strong> {item.answer}
                  </p>
                  <p>
                    <strong>Giải thích:</strong> {item.explanation}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'crawl-quiz' && (
          <section className="panel">
            <h2>Ôn tập từ nguồn crawl</h2>
            {!availableQuizQuestion && <p>Chưa có câu hỏi. Hãy tải hoặc import JSON ở tab Nguồn dữ liệu.</p>}

            {availableQuizQuestion && (
              <article className="question-card">
                <h3>{availableQuizQuestion.question}</h3>
                <div className="options">
                  {availableQuizQuestion.options.map((option) => (
                    <label key={option} className="option">
                      <input
                        type="radio"
                        name="crawl-answer"
                        value={option}
                        checked={quizAnswer === option}
                        onChange={(event) => setQuizAnswer(event.target.value)}
                      />
                      {option}
                    </label>
                  ))}
                </div>

                <div className="actions">
                  <button onClick={submitQuizAnswer}>Nộp đáp án</button>
                  <button className="secondary" onClick={nextQuiz}>
                    Câu tiếp
                  </button>
                </div>

                {quizResult !== null && (
                  <p className={quizResult ? 'success' : 'error'}>
                    {quizResult ? 'Chính xác.' : `Chưa đúng. Đáp án: ${availableQuizQuestion.answer}`}
                  </p>
                )}

                {quizResult !== null && (
                  <button
                    className="secondary"
                    onClick={askAiToExplainQuiz}
                    disabled={isLoadingQuizFeedback}
                  >
                    {isLoadingQuizFeedback ? 'AI đang chữa...' : 'Nhờ AI chữa chi tiết'}
                  </button>
                )}

                {quizAiFeedback && <p className="ai-feedback">{quizAiFeedback}</p>}
                {availableQuizQuestion.explanation && (
                  <p className="muted">Gợi ý nguồn crawl: {availableQuizQuestion.explanation}</p>
                )}
              </article>
            )}
          </section>
        )}

        {activeTab === 'typing' && (
          <section className="panel">
            <h2>Luyện gõ Hiragana</h2>
            <div className="controls">
              <label>
                Chọn nguồn
                <select
                  value={typingSourceId}
                  onChange={(event) => setTypingSourceId(event.target.value)}
                >
                  <option value="all">Tất cả nguồn</option>
                  {vocabSources.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Số từ/lượt
                <input
                  type="number"
                  min={5}
                  max={60}
                  value={typingCount}
                  onChange={(event) => setTypingCount(Number(event.target.value))}
                />
              </label>
              <button onClick={startTypingPractice}>Bắt đầu luyện gõ</button>
            </div>

            {availableTypingItem && (
              <article className="typing-box">
                <p>
                  <strong>Từ {typingIndex + 1}</strong> / {typingQueue.length}
                </p>
                <p className="typing-prompt">
                  {availableTypingItem.kanji || '(không có kanji)'} - {availableTypingItem.meaning}
                </p>
                <input
                  value={typingInput}
                  onChange={(event) => setTypingInput(event.target.value)}
                  placeholder="Nhập hiragana"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      submitTyping()
                    }
                  }}
                />
                <button onClick={submitTyping}>Xác nhận</button>
              </article>
            )}

            {typingQueue.length > 0 && typingIndex >= typingQueue.length && (
              <p className="success">
                Hoàn thành. Điểm của bạn: {typingScore}/{typingQueue.length}
              </p>
            )}

            {typingMessage && <p className="muted">{typingMessage}</p>}
          </section>
        )}
      </main>

      <footer className="status">{status}</footer>
    </div>
  )
}

export default App
