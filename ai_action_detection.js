async function detectActionItem(transcriptText) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.CLAUDE_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1000,
  messages: [
    {
      role: "user",
      content: "Here is a meeting transcript. Does it contain an action item that should become a ticket? If yes, reply with JSON containing 'title' and 'description'. If no, reply with null.\n\n" + transcriptText
    }
  ]
        })
    })
    const data = await response.json()
    const text = data.content[0].text
    return JSON.parse(text)
}
