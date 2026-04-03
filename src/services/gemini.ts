import type { AIJLPTQuestion } from '../types'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent'

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

function extractJsonBlock(raw: string) {
  const match = raw.match(/\[[\s\S]*\]|\{[\s\S]*\}/)
  if (!match) {
    throw new Error('AI trả về định dạng không hợp lệ.')
  }
  return match[0]
}

async function callGemini(prompt: string, apiKey: string) {
  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(
      `Không gọi được Gemini API (${response.status}). Kiểm tra API key/quota/rate limit. Chi tiết: ${detail.slice(0, 240)}`,
    )
  }

  const data = (await response.json()) as GeminiResponse
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('Gemini không trả về nội dung.')
  }

  return text
}

export async function generateJlptQuestionsWithGemini(
  vocabLines: string[],
  count: number,
  apiKey: string,
) {
  const prompt = `Bạn là giáo viên tiếng Nhật JLPT.
Hãy tạo ${count} câu hỏi dạng gần giống JLPT N3/N2 từ danh sách từ vựng dưới đây.
Yêu cầu:
- Mỗi câu có 4 lựa chọn.
- Câu hỏi và lựa chọn bằng tiếng Nhật.
- Giải thích ngắn gọn bằng tiếng Việt.
- Trả về duy nhất JSON array, không markdown.
- Mỗi phần tử có đúng schema:
  {"question":"...","options":["...","...","...","..."],"answer":"...","explanation":"..."}

Danh sách từ:
${vocabLines.join('\n')}`

  const raw = await callGemini(prompt, apiKey)
  const parsed = JSON.parse(extractJsonBlock(raw))
  if (!Array.isArray(parsed)) {
    throw new Error('AI không trả về mảng câu hỏi.')
  }

  return parsed
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const question = String((item as Record<string, unknown>).question ?? '').trim()
      const answer = String((item as Record<string, unknown>).answer ?? '').trim()
      const explanation = String((item as Record<string, unknown>).explanation ?? '').trim()
      const optionsRaw = (item as Record<string, unknown>).options

      if (!question || !answer || !explanation || !Array.isArray(optionsRaw)) {
        return null
      }

      const options = optionsRaw.map((value) => String(value).trim()).filter(Boolean)
      if (options.length !== 4) {
        return null
      }

      return {
        question,
        options,
        answer,
        explanation,
      } satisfies AIJLPTQuestion
    })
    .filter((item): item is AIJLPTQuestion => Boolean(item))
}

export async function explainAnswerWithGemini(
  question: string,
  options: string[],
  userAnswer: string,
  correctAnswer: string,
  apiKey: string,
  originalExplanation?: string,
) {
  const prompt = `Bạn là giáo viên JLPT.
Hãy chữa bài ngắn gọn bằng tiếng Việt cho học viên.

Câu hỏi: ${question}
Lựa chọn: ${options.join(' | ')}
Đáp án học viên: ${userAnswer}
Đáp án đúng: ${correctAnswer}
Gợi ý có sẵn: ${originalExplanation ?? 'Không có'}

Trả về đoạn văn 4-6 câu, nêu vì sao đúng/sai và mẹo tránh nhầm.`

  return callGemini(prompt, apiKey)
}