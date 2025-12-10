#!/bin/zsh
# Load knowledge files and generate system prompt for ElevenLabs agent
# Source this from .zshrc or run directly

KNOWLEDGE_DIR="${KNOWLEDGE_DIR:-$HOME/elevenlabs-voice-app/knowledge}"
OUTPUT_FILE="${OUTPUT_FILE:-/tmp/mahana-agent-prompt.txt}"

# Parse frontmatter and extract priority
parse_frontmatter() {
  local file="$1"
  # Extract priority from frontmatter (default 99)
  local priority=$(head -20 "$file" | grep -E '^priority:' | head -1 | cut -d':' -f2 | tr -d ' ')
  echo "${priority:-99}"
}

# Extract content after frontmatter
extract_content() {
  local file="$1"
  awk 'BEGIN{in_fm=0} /^---$/{in_fm++; next} in_fm>=2{print}' "$file"
}

# Main function
generate_prompt() {
  local prompt=""
  local tmpfile=$(mktemp)

  # Collect files with priorities
  for file in "$KNOWLEDGE_DIR"/*.md; do
    if [[ -f "$file" ]]; then
      local priority=$(parse_frontmatter "$file")
      echo "$priority:$file" >> "$tmpfile"
    fi
  done

  # Sort by priority and concatenate content
  sort -t: -k1 -n "$tmpfile" | while IFS=: read -r priority filepath; do
    local content=$(extract_content "$filepath")
    echo "$content"
    echo ""
    echo "---"
    echo ""
  done

  rm -f "$tmpfile"
}

# Export as environment variable
export_prompt() {
  export ELEVENLABS_SYSTEM_PROMPT="$(generate_prompt)"
  echo "[Knowledge] Loaded ${#ELEVENLABS_SYSTEM_PROMPT} chars into ELEVENLABS_SYSTEM_PROMPT"
}

# Save to file
save_prompt() {
  generate_prompt > "$OUTPUT_FILE"
  echo "[Knowledge] Saved to $OUTPUT_FILE ($(wc -c < "$OUTPUT_FILE" | tr -d ' ') bytes)"
}

# Print summary
print_summary() {
  echo "=== Mahana Voice Agent Knowledge ==="
  echo ""
  for file in "$KNOWLEDGE_DIR"/*.md; do
    if [[ -f "$file" ]]; then
      local title=$(head -20 "$file" | grep -E '^title:' | head -1 | cut -d':' -f2- | xargs)
      local priority=$(parse_frontmatter "$file")
      local lines=$(wc -l < "$file" | tr -d ' ')
      printf "  [%s] %-30s (%s lines)\n" "$priority" "${title:-$(basename "$file")}" "$lines"
    fi
  done | sort -t'[' -k2 -n
  echo ""
}

# Run based on args
case "${1:-export}" in
  export)
    export_prompt
    ;;
  save)
    save_prompt
    ;;
  print)
    generate_prompt
    ;;
  summary)
    print_summary
    ;;
  *)
    echo "Usage: $0 [export|save|print|summary]"
    echo "  export  - Set ELEVENLABS_SYSTEM_PROMPT env var (default)"
    echo "  save    - Save to $OUTPUT_FILE"
    echo "  print   - Print to stdout"
    echo "  summary - Show knowledge files"
    ;;
esac
