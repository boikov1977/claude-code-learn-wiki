export const meta = {
  name: 'code-and-review',
  description: 'Агент пишет код → code-review → если P1 — фикс → повтор до чистоты',
  phases: [
    { title: 'Code', detail: 'Агент пишет код по задаче' },
    { title: 'Review', detail: 'Ревью находит проблемы' },
    { title: 'Fix', detail: 'Исправление найденных P1' },
  ],
}

const MAX_ITERATIONS = 3
const agentType = args?.agentType || 'general-purpose'
const task = args?.task || ''
const files = args?.files || []

if (!task) {
  log('Нет задачи. Укажи args: { task: "...", files: [...], agentType: "..." }')
  throw new Error('No task specified')
}

phase('Code')
log(`Агент: ${agentType} | Задача: ${task.slice(0, 80)}...`)

const codeResult = await agent(task, { label: agentType, phase: 'Code', agentType })

for (let i = 1; i <= MAX_ITERATIONS; i++) {
  phase('Review')
  log(`Ревью #${i}`)

  const fileList = files.length ? files.map(f => `  - ${f}`).join('\n') : '(файлы не указаны)'

  const review = await agent(`Code review для задачи: ${task}

Файлы:
${fileList}

Найди P0/P1 проблемы. Для каждой: файл, строка, серьёзность, описание, точное исправление.
Ищи: баги, утечки, безопасность, lifecycle, сборку.`, {
    label: `Review #${i}`,
    phase: 'Review',
  })

  if (!review || !/(p0|p1|критич|blocker)/i.test(review)) {
    log('✅ Критических проблем нет')
    break
  }

  if (i >= MAX_ITERATIONS) {
    log('⚠️ Достигнут лимит итераций, остались проблемы')
    return { status: 'partial', review }
  }

  phase('Fix')
  log(`Найдены P1. Исправляю...`)

  await agent(`Почини P0/P1 проблемы из ревью:

${review}

Файлы:
${fileList}

Контекст: ${task}

Исправь ВСЕ критические проблемы. Пиши исправленный код.`, {
    label: `Fix #${i}`,
    phase: 'Fix',
    agentType,
  })
}

return { status: 'ok' }