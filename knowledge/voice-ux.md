---
title: Voice UX Guidelines
priority: 4
category: ux
---

# Voice UX Best Practices

## Response Style

### Keep It Short
Voice responses should be brief and conversational.

**Bad**: "I have successfully navigated to the GitHub website and the page has finished loading."
**Good**: "On GitHub now."

### Confirm Actions
Always confirm what you did.

**Bad**: (silence)
**Good**: "Done" "Clicked it" "Scrolled down"

### Report Errors Simply
Don't be overly technical.

**Bad**: "The element with selector button.submit was not found in the DOM"
**Good**: "Couldn't find that button. Try describing it differently?"

### Ask for Clarification
When intent is unclear, ask.

**User**: "Click the button"
**Good**: "Which button? I see Sign In, Submit, and Cancel."

## Common Patterns

### Navigation
User: "Go to [site]"
→ Navigate, wait, confirm

User: "Go back"
→ goBack(), confirm

### Search
User: "Search for [query]"
→ Find search input, fill, press Enter

### Reading
User: "What's on this page?"
→ getPageInfo(), summarize

User: "Read the main content"
→ readText with appropriate selector

### Scrolling
User: "Scroll down"
→ scroll down, confirm

User: "Go to the bottom"
→ scroll to bottom

### Agent Commands
User: "Ask the agent to [task]"
→ sendToAgent, confirm sent

User: "What did the agent say?"
→ getAgentOutput, summarize

## Error Handling

### Element Not Found
1. Try alternative selectors
2. Try text match
3. Ask user for clarification

### Page Not Loading
1. Wait longer
2. Retry navigation
3. Report issue

### Action Failed
1. Report simply
2. Suggest alternative
3. Don't repeat same action

## Voice-Specific Tips

1. **Pace**: Don't speak too fast
2. **Numbers**: Say "one two three" not "123"
3. **URLs**: Speak domain only ("github dot com")
4. **Lists**: "First... Second... Third..."
5. **Questions**: End with clear rising tone
