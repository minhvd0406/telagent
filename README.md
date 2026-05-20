# Telagent

Lightweight Telegram bridge CLI for AI coding agents.

Install once on your machine, then run `telagent init` inside any project. Projects use your global Telegram config by default. If a project has its own `.telagent/.env`, that project config overrides global config.

## Install

Fastest from GitHub with npm:

```bash
npm install -g github:minhvd0406/telagent
```

Then configure Telegram once:

```bash
telagent setup \
  --token "123456:bot-token" \
  --chat-id "123456789" \
  --install all \
  --test
```

Interactive setup also works:

```bash
telagent setup
```

This writes global config to:

```text
~/.config/telagent/.env
```

Homebrew is also possible once you publish a tap:

```bash
brew tap minhvd0406/tap
brew install telagent
```

A starter formula lives in `Formula/telagent.rb`.

## Use In A Project

Go to any project:

```bash
cd ~/Projects/my-app
telagent init --all
```

That installs local agent rule files:

```text
CLAUDE.md
AGENTS.md
GEMINI.md
```

The rules tell agents to use the global `telagent` command.

## Project-specific Telegram Config

Most projects should use global config. For a separate bot or chat in one project:

```bash
cd ~/Projects/my-app
telagent setup --project \
  --token "123456:project-bot-token" \
  --chat-id "-1001234567890" \
  --install all \
  --test
```

This writes:

```text
.telagent/.env
```

Config priority:

```text
environment variables > ./.telagent/.env > ~/.config/telagent/.env
```

## Daily Usage

Tell your agent:

```text
Ping me on Telegram when done.
Report via Telegram and wait for instructions.
Tele me when finished.
```

Commands agents use:

```bash
telagent send "Task finished"
telagent send "Need your decision" --wait-reply
telagent send --file ./report.md "Report attached"
telagent listen --reply-to 5821
```

## CLI

```bash
telagent setup
telagent setup --project
telagent init --all
telagent doctor
telagent test
telagent guide
telagent send "message"
telagent send "message" --wait-reply
telagent send --reply-to 5821 "Got it"
telagent send --react 5821
telagent listen --reply-to 123
telagent cleanup --dry-run
```

## Runtime

Runtime state is stored outside the code checkout:

```text
~/.local/state/telagent/reply/
```

It contains sent-message records, update cache, offsets, lock files, prompt JSON files, and listener registry files.

## Requirements

- Node.js 20+
- Telegram bot token from [@BotFather](https://t.me/BotFather)
- Telegram chat ID for yourself or a group

## Troubleshooting

```bash
telagent doctor
telagent test
```

## Limits

- Telegram replies must use Reply on the agent message.
- The machine must stay awake.
- Telegram cannot answer local agent permission prompts.
- Telagent writes Telegram text to prompt JSON; it does not execute it.
- Telagent is not a full remote terminal.
# telagent
