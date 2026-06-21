export const meta = {
  name: 'spec-roast',
  description: 'Архитектурная прожарка спецификаций ДО написания кода — прагматик + консерватор + инноватор',
  phases: [
    { title: 'Collect', detail: 'Сбор всех spec-файлов' },
    { title: 'Judge', detail: 'Три архитектора судят независимо' },
    { title: 'Synthesize', detail: 'Объединение и фиксы' },
    { title: 'Apply', detail: 'Правка spec-файлов' },
  ],
}

const CHANGE_DIR = args?.changeDir || ''
const SPEC_DIR = args?.specDir || (CHANGE_DIR ? `${CHANGE_DIR}/specs` : '')

if (!CHANGE_DIR && !args?.proposal && !args?.design && !args?.specs) {
  log('Укажи changeDir, или proposal + design + specs по отдельности.')
  log('Workflow({ name: "spec-roast", args: { changeDir: "/home/.../openspec/changes/my-change" } })')
  throw new Error('No input specified')
}

phase('Collect')
log('Собираю артефакты для прожарки...')

let proposal = args?.proposal || ''
let design = args?.design || ''
let specs = args?.specs || ''

if (CHANGE_DIR) {
  const files = await agent(`Прочитай proposal и design из ${CHANGE_DIR}.
Также прочитай все файлы из ${CHANGE_DIR}/specs/.

Верни:
---PROPOSAL---
[содержимое proposal.md]
---DESIGN---
[содержимое design.md]
---SPECS---
[для каждого spec-файла: название + содержимое]`, {
    label: 'Collect specs',
    phase: 'Collect',
  })

  // Разделяем секции
  const propMatch = files?.match(/---PROPOSAL---\n([\s\S]*?)\n---DESIGN---/)
  const desMatch = files?.match(/---DESIGN---\n([\s\S]*?)\n---SPECS---/)
  const specMatch = files?.match(/---SPECS---\n([\s\S]*?)$/)

  if (propMatch) proposal = propMatch[1].trim()
  if (desMatch) design = desMatch[1].trim()
  if (specMatch) specs = specMatch[1].trim()
}

if (!proposal || !design || !specs) {
  log('Не удалось прочитать все артефакты. Убедись что proposal, design и specs доступны.')
  throw new Error('Missing artifacts')
}

log('Артефакты собраны. Запускаю тройную прожарку...')

phase('Judge')

const PRAGMATIST_PROMPT = `Ты — архитектор-прагматик. Твоя задача — критически прожарить спецификации проекта ДО начала реализации.

## Proposal
${proposal}

## Design
${design}

## Specs
${specs}

Найди:
1. Скрытые риски — что не учтено и выстрелит в реализации
2. Противоречия — между спецификациями, между design и spec
3. Непрактичные решения — избыточные или недо-спроектированные
4. Пробелы — чего не хватает

Ранжируй по: BLOCKER / WARNING / ADVICE.
Будь конкретен. Ссылайся на разделы.`

const CONSERVATIVE_PROMPT = `Ты — архитектор-консерватор. Хранитель стабильности. Твоя задача — найти риски и нестабильные решения.

## Proposal
${proposal}

## Design
${design}

## Specs
${specs}

Что тебя беспокоит?
1. Зависимости от внешних сервисов (нет fallback?)
2. Оверхед архитектуры (не избыточно ли?)
3. Сложность поддержки (сможет ли новый разработчик разобраться?)
4. Совместимость и версионирование
5. Надёжность при ошибках

Ранжируй по: BLOCKER / WARNING / ADVICE.`

const INNOVATOR_PROMPT = `Ты — архитектор-инноватор. Смотришь на 2-3 шага вперёд.

## Proposal
${proposal}

## Design
${design}

## Specs
${specs}

Что можно сделать лучше?
1. Какие технологии/подходы упущены?
2. Что можно упростить за счёт более современных решений?
3. Что будет, когда проект вырастет в 10 раз?
4. Какие решения сейчас хороши, но через год станут проблемой?
5. Что можно переиспользовать из экосистемы вместо написания своего?

Ранжируй по: BLOCKER / WARNING / ADVICE.`

const pragmatist = await agent(PRAGMATIST_PROMPT, { label: 'Прагматик', phase: 'Judge' })
const conservative = await agent(CONSERVATIVE_PROMPT, { label: 'Консерватор', phase: 'Judge' })
const innovator = await agent(INNOVATOR_PROMPT, { label: 'Инноватор', phase: 'Judge' })

const allReviews = [pragmatist, conservative, innovator].filter(Boolean)

phase('Synthesize')
log('Объединяю результаты прожарки...')

// Считаем блокеры
const fullText = allReviews.join(' ').toLowerCase()
const blockerCount = (fullText.match(/blocker/g) || []).length
const warningCount = (fullText.match(/\bwarning\b/g) || []).length
const adviceCount = (fullText.match(/\badvice\b/g) || []).length

log(`Найдено: ${blockerCount} BLOCKER, ${warningCount} WARNING, ${adviceCount} ADVICE`)

const synthesis = await agent(`У нас есть результаты архитектурной прожарки от трёх архитекторов.

## Прагматик
${pragmatist || '(ничего)'}

## Консерватор
${conservative || '(ничего)'}

## Инноватор
${innovator || '(ничего)'}

Синтезируй единый отчёт:
1. Удали дубли (если несколько архитекторов нашли одно и то же)
2. Сгруппируй по BLOCKER / WARNING / ADVICE
3. Каждому finding-у дай рекомендацию по исправлению
4. Добавь tag: [PRAGMATIST], [CONSERVATIVE], [INNOVATOR] — кто нашёл

Формат:
## BLOCKER
- [PRAGMATIST] описание → рекомендация
## WARNING
...

Не смягчай формулировки. Если это BLOCKER — пиши BLOCKER.`, {
  label: 'Синтезатор',
  phase: 'Synthesize',
})

phase('Apply')

const applyChanges = args?.apply || false

if (!applyChanges) {
  log('Прожарка завершена. Чтобы применить изменения, запусти с apply: true')
  log('Workflow({ name: "spec-roast", args: { changeDir: "...", apply: true } })')
} else {
  log('Применяю изменения в spec-файлы...')

  for (const review of allReviews) {
    if (review && (review.toLowerCase().includes('blocker') || review.toLowerCase().includes('warning'))) {
      await agent(`На основе этой прожарки:

${review}

Обнови spec-файлы в ${SPEC_DIR || CHANGE_DIR}.
Исправь все BLOCKER и WARNING.

Контекст:
${synthesis}

Пиши исправленные версии spec-файлов. Не оставляй TODO и комментарии "нужно исправить" — исправляй сразу.`, {
        label: 'Apply fixes',
        phase: 'Apply',
      })
    }
  }

  log('Spec-файлы обновлены.')
}

return {
  summary: `Прожарка завершена. Найдено: ${blockerCount} BLOCKER, ${warningCount} WARNING.`,
  blockerCount,
  warningCount,
  adviceCount,
  synthesis,
}

