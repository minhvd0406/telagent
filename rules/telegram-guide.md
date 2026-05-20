# Telagent Guide For AI Agents

Use Telagent for short Telegram reports and short follow-up instructions. Do not use it as a remote terminal mirror.

## Send Only

Use send-only when the user says:

- "Ping me when done."
- "Tele me when finished."
- "Send a Telegram report."

```bash
telagent send "<short report>"
```

## Send And Wait

Only wait when the user explicitly asks for Telegram follow-up instructions:

- "Report via Telegram and wait for instructions."
- "Ask me on Telegram before continuing."

```bash
telagent send "<short report>" --wait-reply
```

Telagent prints the prompt JSON path when a valid reply arrives.

## Telegram Inbox

Use inbox when the user wants to send instructions from Telegram without replying to a specific agent message:

```bash
telagent inbox
```

If a message is available, Telagent prints a prompt JSON path. Read that JSON and follow its `text` as the latest user instruction.

For a long-running terminal watcher:

```bash
telagent inbox --watch
```

To have Telegram messages launch Codex work automatically in a project:

```bash
telagent codex --watch --cd /path/to/project
```

This runs `codex exec` for each Telegram inbox message. The agent output appears in the terminal running the watcher.

## Read Prompt JSON

Prompt files are written under the Telagent runtime directory, usually:

```text
~/.local/state/telagent/reply/
```

Shape:

```json
{
  "text": "admin reply text",
  "messageId": 6001,
  "chatId": "123456789",
  "fromUserId": "123456789",
  "replyToMessageId": 5821,
  "timestamp": 1710000000
}
```

Read the JSON, follow the instruction, then respond if useful:

```bash
telagent send --reply-to 6001 "Got it, I will continue."
```

## Reports

Keep reports short:

```text
Status: done

Done:
- fixed ...
- tested ...

Need you:
- reply with ...
```

For long details:

```bash
telagent send --file ./report.md "Report attached"
```

## Orphans

Without `telagent inbox`, the user must use Telegram Reply on a specific agent message while `send --wait-reply` or `listen` is running. With `telagent inbox`, plain admin messages are accepted as inbox prompts.

## Local Reality

Telegram cannot answer local permission prompts. The machine must stay awake while waiting for replies. Telagent writes Telegram text to prompt JSON; an agent process must read that JSON before it can act on the instruction.
