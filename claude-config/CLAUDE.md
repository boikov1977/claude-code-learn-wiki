# Глобальные инструкции для Андрея

## О пользователе

Меня зовут Андрей. Я русскоязычный разработчик, предпочитаю живое, неформальное общение без церемоний. Можно использовать эмодзи и живой язык.

**Стиль работы:**
- Экспериментатор — люблю разбираться с новыми технологиями (MCP, OpenSpec, кастомные субагенты)
- Прямолинейный — лучше поищи информацию, чем выдумывай
- Сначала обсуждаем подход, потом реализуем
- Если очевидно — делай, не спрашивай на каждом шагу

## Инструменты

### Поиск (CRITICAL)
- Встроенные WebSearch/WebFetch **не работают** — провайдер DeepSeek выдаёт ошибку схемы
- Для любого поиска используй ТОЛЬКО `search_web` из `poisk-mcp`
- `poisk-mcp` подключён глобально, виден в моих инструментах

### Модель
- Нет подписки на Claude Pro/Team
- Модели Haiku и Sonnet недоступны
- Основная модель: `claude-go-deepseek-v4-flash` (через OpenCode-прокси)
- Субагенты могут иметь свою модель, указанную в frontmatter:
  - `writer-agent` → `claude-go-mimo-v2.5`
  - Остальные → `model: inherit` (наследуют основную)
- Прокси просто передаёт model ID в OpenCode Go — сам не решает, какую модель использовать

## Глобальная конфигурация

**Агенты** — `~/.claude/agents/`:
- `openspec-manager` — spec-driven разработка
- `writer-agent` — документация (`claude-go-mimo-v2.5`)
- `explorer` — быстрый поиск по коду
- `statusline-setup` — настройка статус-лайн
- `innovator` — архитектор-инноватор (`claude-go-minimax-m3`)
- `pragmatist` — архитектор-прагматик (`claude-go-deepseek-v4-pro`)
- `conservative` — архитектор-консерватор (`claude-go-deepseek-v4-flash`)
- `py-backend-coder` — Python и backend (`claude-go-deepseek-v4-flash`)
- `frontend-coder` — React/TS/Vue (`claude-go-deepseek-v4-flash`)
- `code-reviewer` — ревью кода, read-only (`claude-go-deepseek-v4-pro`)
- `tester-agent` — тесты (`claude-go-mimo-v2.5`)
- `editor-agent` — редактура текстов, read-only (`claude-go-deepseek-v4-flash`)
- `android-coder` — Android/Kotlin/Compose (`claude-go-deepseek-v4-flash`)

**Скиллы** — `~/.claude/skills/`:
- Все OpenSpec-скиллы (propose, apply, sync, archive, explore, ff, new, continue, verify, bulk-archive, onboard)
- Android CLI skill — установлен через `android init`

**Android CLI** — `~/.local/bin/android` (путь ~/.local/bin уже в $PATH)

**Хуки** — `~/.claude/settings.local.json`:
- PreToolUse на Write|Edit — бэкап JSON/YAML в `/tmp/claude-backups/`
- PostToolUse на Write|Edit — автоформатирование через prettier

**MCP-серверы:**
- `poisk-mcp` — через `~/.claude.json` (добавлен через `claude mcp add`)

## Пермишены

Желаемый режим — `auto`. Если я блокируюсь на чём-то разумном — пользователь подтверждает. Для совсем очевидных вещей действую без лишних вопросов.
