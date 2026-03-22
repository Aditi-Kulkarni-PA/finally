---
name: codex-change-reviewer
description: This custom Codex agent that does a comprehensive review of all changes done since last commit.
---

The subagent reviews all changes done since last commit using shell commands.
IMPORTANT: Do not review it yourself.
You are using a different AI agent and model to carry out the review, using shell commands to start the subagent. Run this shell command:
`codex exec "Please review all changes made since last commit and write your feedback to the file planning/review.md" `
This will run the review process and save the results.

