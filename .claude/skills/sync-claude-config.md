---
name: sync-claude-config
description: Синхронизировать конфиги из claude-config/ в ~/.claude/ — агенты, скиллы, workflow, настройки, CLAUDE.md
model: inherit
---

# sync-claude-config

Синхронизирует эталонные конфиги из `claude-config/` (в корне проекта) с `~/.claude/` и `~/CLAUDE.md`.

## Что делает

1. Определяет ОС и домашнюю директорию
2. Для каждого файла в `claude-config/agents/*.md` — читает, заменяет `__HOME__` на `$HOME`, записывает в `~/.claude/agents/`
3. Для каждой директории в `claude-config/skills/*` — копирует рекурсивно в `~/.claude/skills/`
4. Для `claude-config/workflows/*.ts` — копирует в `~/.claude/workflows/`
5. Читает `claude-config/settings.json`, заменяет `__HOME__`, записывает в `~/.claude/settings.json`
6. Читает `claude-config/settings.local.json`, заменяет `__HOME__`, записывает в `~/.claude/settings.local.json`
7. Копирует `claude-config/CLAUDE.md` в `~/CLAUDE.md`
8. Копирует себя (`.claude/skills/sync-claude-config.md`) в `~/.claude/skills/sync-claude-config.md` — чтобы стал глобально доступен

## Особенности

- В файлах конфигов пути к poisk-mcp, OpenCode и другие машинно-зависимые пути зашаблонизированы как `__HOME__/...`
- `__HOME__` заменяется на актуальную домашнюю директорию (`$HOME` на Linux/Mac, `%USERPROFILE%` на Windows)
- Существующие файлы перезаписываются — перед этим создаётся бэкап `~/.claude/backup-{timestamp}/`
- Все операций требуют подтверждения разрешений (allow/deny/ask) — в режиме auto подтвердятся сами

## Порядок

1. Создать бэкап текущих конфигов: `~/.claude/backup-{timestamp}/`
2. Определить `$HOME` (Linux/Mac) или `%USERPROFILE%` (Windows)
3. Последовательно скопировать все категории файлов
4. Сообщить результат: сколько скопировано, были ли ошибки
