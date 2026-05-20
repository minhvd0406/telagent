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

The user must use Telegram Reply on a specific agent message. Plain Telegram messages are orphans. Telagent reacts 💔 and sends a `[SYSTEM]` hint. Orphans are not passed to the agent.

## Local Reality

Telegram cannot answer local permission prompts. The machine must stay awake while waiting for replies.
