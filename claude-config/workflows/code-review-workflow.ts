export const meta = {
  name: 'code-review-workflow',
  description: 'Многоагентный code review — Bug Hunter + Security Auditor + Code Quality + adversarial verify',
  phases: [
    { title: 'Find', detail: 'Три параллельных агента с разными фокусами' },
    { title: 'Verify', detail: 'Adversarial проверка каждой находки' },
    { title: 'Synthesize', detail: 'Формирование итогового отчёта' },
  ],
}

// --- JSON Schemas для structured output ---

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          category: { type: 'string', enum: ['bug', 'security', 'quality', 'performance', 'style'] },
          file: { type: 'string' },
          line: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          suggestion: { type: 'string' },
        },
        required: ['severity', 'category', 'file', 'title', 'description', 'confidence', 'suggestion'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    isReal: { type: 'boolean' },
    severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
    reason: { type: 'string' },
    exploitability: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'none'] },
  },
  required: ['isReal', 'severity', 'reason', 'exploitability'],
}

// --- Базовые промпты для агентов ---

const FILE_LIST_PROMPT = (files) =>
  `Файлы для ревью:\n${files.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\nПрочитай каждый файл перед анализом.`

function bugHunterPrompt(files, context) {
  return `## Bug Hunter

Ты эксперт по поиску багов и логических ошибок.

${FILE_LIST_PROMPT(files)}

Ищи:
- Логические ошибки и гонки
- Null-pointer / undefined dereference
- Off-by-one и edge cases
- Ошибки в асинхронности (не-awaited корутины, забытые таски)
- Утечки ресурсов (незакрытые файлы/соединения)
- Ошибки в обработке ошибок (игнор исключений, пустые catch)
- Race conditions и state corruption
- Deadlocks или зависания

${context ? `\nКонтекст проекта:\n${context}` : ''}

Верни findings в JSON.`
}

function securityAuditorPrompt(files, context) {
  return `## Security Auditor

Ты эксперт по безопасности кода.

${FILE_LIST_PROMPT(files)}

Ищи:
- Hardcoded secrets / API keys / tokens
- SQL / NoSQL injection
- Path traversal
- Валидация входных данных (XSS, injection)
- Insecure defaults и debug режим в продакшене
- Утечка информации (stack traces, debug info)
- Небезопасные вызовы (eval, exec, shell=True)
- Проблемы аутентификации/авторизации

${context ? `\nКонтекст проекта:\n${context}` : ''}

Верни findings в JSON.`
}

function qualityPrompt(files, context) {
  return `## Code Quality

Ты эксперт по качеству кода и best practices.

${FILE_LIST_PROMPT(files)}

Ищи:
- Duplicate code / copy-paste
- Слишком сложные функции (цикломатическая сложность)
- Нарушение конвенций (naming, структура, форматирование)
- Отсутствие обработки ошибок
- Магические числа и строки
- Неиспользуемые переменные/зависимости
- Отсутствие type hints / docstrings
- God classes / слишком длинные функции
- Проблемы с архитектурой (tight coupling, god objects)

${context ? `\nКонтекст проекта:\n${context}` : ''}

Верни findings в JSON.`
}

function skepticPrompt(finding) {
  return `## Adversarial Verifier

Ты скептик. Твоя задача — оспорить следующую находку code review.

Если это false positive — скажи об этом. Если это реальная проблема — подтверди.

**Находка:**
- Серьёзность: ${finding.severity}
- Категория: ${finding.category}
- Файл: ${finding.file}
- Описание: ${finding.description}
- Рекомендация: ${finding.suggestion}

Проанализируй:
1. Реальна ли эта проблема? Или это false positive?
2. Какова реальная эксплуатируемость (если security)?
3. Каков правильный приоритет: P0-P3?
4. Почему? Обоснуй.

${finding.line ? `\nКонкретная строка: ${finding.line}` : ''}

Вердикт — в JSON.`
}

function synthesizerPrompt(findings) {
  return `## Синтезатор отчёта

Ты составляешь итоговый отчёт code review из подтверждённых findings.

**Правила:**
1. Сгруппируй по приоритету (P0 → P1 → P2 → P3)
2. Удали дубликаты (если два агента нашли одно и то же)
3. Добавь рекомендации по приоритету исправления
4. Сделай отчёт читаемым — Markdown

**Входные findings:**
${JSON.stringify(findings, null, 2)}

На выходе — Markdown отчёт с секциями:
- ## P0 — Critical
- ## P1 — High
- ## P2 — Medium
- ## P3 — Low
- ## False Positives (отброшено)

Для каждого finding: [severity] file:line — title
  - Описание: ...
  - Рекомендация: ...
  - Агент: Bug Hunter / Security / Quality`
}

// --- Workflow script ---

const files = args?.files || []
const context = args?.context || ''

if (!files.length) {
  log('Укажи файлы для ревью: Workflow({ args: { files: ["path/to/file.py", ...] } })')
  throw new Error('No files specified')
}

phase('Find')
log(`Запускаю параллельное ревью ${files.length} файлов`)

const bugHunter = agent(bugHunterPrompt(files, context), {
  label: 'Bug Hunter',
  phase: 'Find',
  schema: FINDINGS_SCHEMA,
})

const securityAuditor = agent(securityAuditorPrompt(files, context), {
  label: 'Security Auditor',
  phase: 'Find',
  schema: FINDINGS_SCHEMA,
})

const qualityReviewer = agent(qualityPrompt(files, context), {
  label: 'Code Quality',
  phase: 'Find',
  schema: FINDINGS_SCHEMA,
})

const allResults = [bugHunter, securityAuditor, qualityReviewer].filter(Boolean)

const allFindings = []
for (const r of allResults) {
  if (r.findings) {
    for (const f of r.findings) {
      allFindings.push(f)
    }
  }
}

log(`Найдено ${allFindings.length} findings: ${allResults.map((r, i) => r?.findings?.length || 0).join(' + ')}`)

if (!allFindings.length) {
  log('Находок нет — пропускаю verify и синтез.')
  return { findings: [], report: 'Находок не обнаружено.' }
}

phase('Verify')
log(`Проверяю ${allFindings.length} findings через adversarial скептика`)

const verifiedResults = await pipeline(
  allFindings,
  (finding) =>
    agent(skepticPrompt(finding), {
      label: `↳ ${finding.title?.substring(0, 50)}`,
      phase: 'Verify',
      schema: VERDICT_SCHEMA,
    }),
  (verdict, original) => ({
    ...original,
    verdict,
  }),
)

const confirmed = verifiedResults.filter((v) => v?.verdict?.isReal)
const rejected = verifiedResults.filter((v) => v && !v.verdict?.isReal)

log(`Подтверждено: ${confirmed.length}, отклонено: ${rejected.length}`)

if (!confirmed.length) {
  log('Все findings — false positives.')
  return {
    findings: [],
    report: 'Все находки оказались false positives после проверки скептиком.',
    rejected,
  }
}

phase('Synthesize')
log('Формирую итоговый отчёт')

const report = await agent(synthesizerPrompt(confirmed), {
  label: 'Синтезатор',
  phase: 'Synthesize',
})

return { findings: confirmed, report, rejected }
