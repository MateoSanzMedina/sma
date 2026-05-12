# Antigravity Kit - Activation & Usage Guide

This plan outlines how you can interact with the **Antigravity Kit** to ensure I am utilizing all 20 agents, 36 skills, and 11 workflows effectively.

## 🚀 How to Trigger Implementation

The Antigravity Kit is already **fully active** in this session because I have read the `GEMINI.md` and [ARCHITECTURE.md](file:///c:/Users/ssanz/OneDrive/Documentos/ChainPointAI/LawbitTauri/.agent/ARCHITECTURE.md) files. To make me "implement" specific parts, follow these triggers:

### 1. Slash Commands (Workflows)
You can directly invoke structured procedures using slash commands:
- `/plan`: If you want a detailed breakdown of a task without writing code yet.
- `/create`: If you want to start building a new feature or app module.
- `/debug`: If you have an error and want a systematic investigation.
- `/orchestrate`: If you want multiple expert agents to review or analyze a complex problem.
- `/test`: To generate or run tests for your current code.
- `/ui-ux-pro-max`: To design high-end UI using the 50+ built-in styles.

### 2. Keyword-Based Routing
I automatically detect your intent and switch to the relevant specialist agent. For example:
- "Fix this login error" → Switches to `debugger` + `systematic-debugging`.
- "Design a new dashboard" → Switches to `frontend-specialist` + `frontend-design`.
- "Analyze this database schema" → Switches to `database-architect` + `database-design`.

### 3. The Socratic Gate
For any task classified as **COMPLEX**, I will stop and ask you at least 3 strategic questions. This ensures we don't start coding without a clear direction.

## 🛠️ Verification Plan

To verify that I am correctly implementing the kit, I will:

### Automated Checks
- Run `python .agent/scripts/checklist.py .` before finalizing any code change.
- Use `python .agent/scripts/verify_all.py .` for major deployments or refactors.

### Manual Verification
- I will ask you to confirm if the "Applying knowledge of @agent..." announcements are appearing and if the structured approach meets your expectations.

> [!IMPORTANT]
> You don't need to do anything extra. Just state your objective, and I will handle the "Read -> Understand -> Apply" protocol automatically.
