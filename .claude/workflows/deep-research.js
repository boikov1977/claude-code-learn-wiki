export const meta = {
  name: 'deep-research',
  description: 'Глубокое исследование темы: веерный поиск → чтение → верификация → синтез отчёта',
  phases: [
    { title: 'Scout', detail: 'Веерный поиск по теме' },
    { title: 'Deep Read', detail: 'Параллельное чтение источников' },
    { title: 'Verify', detail: 'Верификация ключевых фактов' },
    { title: 'Synthesize', detail: 'Синтез финального отчёта' },
  ],
}

// ──────────────────────────────────────────────
// Принимает тему исследования через args (строка)
// ──────────────────────────────────────────────

const topic = String(args || '').trim()
if (!topic) {
  log('❌ Укажи тему исследования, например: /workflow deep-research "MCP-серверы 2026"')
  return { error: 'No topic provided' }
}

log(`🔬 Исследование: "${topic}"`)

// ──────────────────────────────────────────────
// Фаза 1 — Scout: веерный поиск с разных углов
// ──────────────────────────────────────────────

phase('Scout')

const ANGLES = [
  `Что такое ${topic} — обзор и основные концепции`,
  `${topic} — лучшие практики и примеры использования`,
  `${topic} — сравнение альтернатив и спорные моменты`,
  `${topic} — свежие новости и тренды 2026`,
  `${topic} — типичные проблемы и их решения`,
]

const scoutResults = await parallel(ANGLES.map((q, i) => () =>
  agent(`Выполни поиск по запросу: "${q}".
Верни ТОЛЬКО JSON-массив с найденными результатами.
Каждый элемент: { title, url, snippet, relevance (1-10) }.
Не добавляй пояснений — только JSON.`, {
    label: `search:${i + 1}`,
    phase: 'Scout',
    schema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              url: { type: 'string' },
              snippet: { type: 'string' },
              relevance: { type: 'integer' },
            },
            required: ['title', 'url', 'snippet'],
          },
        },
      },
      required: ['results'],
    },
  })
))

// Собираем и дедуплицируем URL
const allResults = scoutResults.filter(Boolean).flatMap(r => r.results || [])
const seen = new Set()
const unique = allResults.filter(r => {
  const key = r.url || r.title
  if (seen.has(key)) return false
  seen.add(key)
  return true
})
const topSources = unique.sort((a, b) => (b.relevance || 0) - (a.relevance || 0)).slice(0, 6)

log(`📊 Найдено ${allResults.length} результатов, отобрано ${topSources.length} лучших источников`)

// ──────────────────────────────────────────────
// Фаза 2 — Deep Read: параллельное чтение
// ──────────────────────────────────────────────

phase('Deep Read')

const readings = await parallel(topSources.map((src, i) => () =>
  agent(`Прочитай и проанализируй источник №${i + 1}.

URL: ${src.url || 'не указан'}
Контекст: ${src.snippet || src.title}

Верни JSON с:
- source: название/URL источника
- summary: краткое содержание (3-5 предложений)
- keyPoints: массив ключевых тезисов (макс 7)
- confidence: оценка надёжности источника (high/medium/low)
- quotes: массив важных цитат или цифр (макс 3), каждая с контекстом`, {
    label: `read:${i + 1}`,
    phase: 'Deep Read',
    schema: {
      type: 'object',
      properties: {
        source: { type: 'string' },
        summary: { type: 'string' },
        keyPoints: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        quotes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              context: { type: 'string' },
            },
          },
        },
      },
      required: ['source', 'summary', 'keyPoints', 'confidence'],
    },
  })
))

log(`📖 Прочитано ${readings.filter(Boolean).length} источников`)

// ──────────────────────────────────────────────
// Фаза 3 — Verify: проверка фактов
// ──────────────────────────────────────────────

phase('Verify')

// Собираем все ключевые тезисы для верификации
const allClaims = readings.filter(Boolean).flatMap(r => (r.keyPoints || []).slice(0, 3)).slice(0, 8)

const verifications = allClaims.length > 0
  ? await parallel(allClaims.map((claim, i) => () =>
      agent(`Проверь утверждение: "${claim}"

Найди подтверждение или опровержение в других источниках.
Верни JSON:
- claim: проверяемое утверждение
- verdict: confirmed / refuted / unverifiable / mixed
- confidence: high / medium / low
- reasoning: почему такой вердикт (1-2 предложения)`, {
        label: `verify:${i + 1}`,
        phase: 'Verify',
        schema: {
          type: 'object',
          properties: {
            claim: { type: 'string' },
            verdict: { type: 'string', enum: ['confirmed', 'refuted', 'unverifiable', 'mixed'] },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            reasoning: { type: 'string' },
          },
          required: ['claim', 'verdict', 'confidence', 'reasoning'],
        },
      })
    ))
  : []

const confirmed = verifications.filter(Boolean).filter(v => v.verdict === 'confirmed').length
const refuted = verifications.filter(Boolean).filter(v => v.verdict === 'refuted').length
log(`✅ Подтверждено: ${confirmed}, ❌ Опровергнуто: ${refuted}, из ${verifications.length} проверок`)

// ──────────────────────────────────────────────
// Фаза 4 — Synthesize: финальный отчёт
// ──────────────────────────────────────────────

phase('Synthesize')

const report = await agent(`Ты — исследователь. Напиши отчёт по теме "${topic}".

У тебя есть:
1. Источники (прочитанные страницы с summary и keyPoints)
${readings.filter(Boolean).map((r, i) => `   Источник ${i + 1}: "${r.source}" — ${r.summary}`).join('\n')}

2. Верификация утверждений:
${verifications.filter(Boolean).map(v => `   "${v.claim}" → ${v.verdict} (${v.confidence}): ${v.reasoning}`).join('\n')}

Напиши отчёт в формате Markdown с разделами:

# Исследование: ${topic}

## Executive Summary
2-3 абзаца ключевых выводов

## Основные находки
Список сгруппированных тезисов, каждый с указанием источника

## Подтверждённые факты (confidence: high/medium)
То, что подтвердилось в нескольких источниках

## Спорные / Неподтверждённые (confidence: low)
То, что требует дополнительной проверки

## Выводы и рекомендации

**Формат:** Markdown, русский язык, факты — с указанием источников. Без воды.`, {
  label: 'synthesize',
  phase: 'Synthesize',
})

log('📄 Отчёт готов!')
log(report)

return {
  topic,
  sourcesScanned: allResults.length,
  sourcesRead: readings.filter(Boolean).length,
  claimsVerified: verifications.filter(Boolean).length,
  claimsConfirmed: confirmed,
  claimsRefuted: refuted,
  report,
}
