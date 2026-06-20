#!/usr/bin/env bash
# consistency-check.sh — проверка терминологии
# Использование: ./scripts/consistency-check.sh
set -euo pipefail

WIKI_DIR="wiki"
TOTAL=0
HITS=""

check_raw() {
    local label="$1" pattern="$2"
    local matches

    matches=$(grep -rPn "$pattern" "$WIKI_DIR" --include='*.html' \
        | grep -vP '<code[>\s]|</code>|<pre[>\s]|</pre>|mermaid' \
        || true)

    if [[ -n "$matches" ]]; then
        count=$(echo "$matches" | wc -l)
        echo "🔍 $label → $count"
        echo "$matches" | while IFS= read -r line; do
            file=$(echo "$line" | cut -d: -f1)
            num=$(echo "$line" | cut -d: -f2)
            text=$(echo "$line" | cut -d: -f3- | sed 's/<[^>]*>//g' | tr -s ' ' | head -c 120)
            echo "  ⚠️  $file ⟶$num  $text"
        done
        echo ""
        TOTAL=$((TOTAL + count))
    fi
}

main() {
    echo ""
    echo "════════════════════════════════════════"
    echo "  Консистентность терминологии"
    echo "  $(date '+%Y-%m-%d %H:%M')"
    echo "  Файлов: $(find "$WIKI_DIR" -name '*.html' | wc -l)"
    echo "════════════════════════════════════════"
    echo ""

    check_raw "сабагент вместо субагент"               "сабагент"
    check_raw "context\.7 вместо context7"              'context\.7'
    check_raw "permission\.mode вместо permissionMode"  'permission\.mode'
    check_raw "disallowed\.tools вместо disallowedTools" 'disallowed\.tools'
    check_raw "writer\.agent вместо writer-agent"       'writer\.agent'
    check_raw "editor\.agent вместо editor-agent"       'editor\.agent'
    check_raw "tester\.agent вместо tester-agent"       'tester\.agent'
    check_raw "code\.reviewer вместо code-reviewer"     'code\.reviewer'
    check_raw "consistency_скрипт"                      'consistency_скрипт|консистенси-скрипт'
    check_raw "Raунд (лат. R)"                          'Raунд'
    # model ID без префикса claude-go- не проверяем —
    # editor-agent отслеживает это в каждой статье

    echo "════════════════════════════════════════"
    if [[ $TOTAL -eq 0 ]]; then echo "  ✅ ВСЁ ЧИСТО"
    else echo "  ⚠️  Нарушений: $TOTAL"; fi
    echo "════════════════════════════════════════"
    exit $(( TOTAL > 0 ? 1 : 0 ))
}

main "$@"
