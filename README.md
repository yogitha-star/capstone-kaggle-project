# ROBO-OS: Multi-Agent Robotics Console 🤖

> **Kaggle 5-Day AI Agents Capstone | Freestyle Track**

A multi-agent AI system that helps users design, build, and troubleshoot robotics projects — powered by Google Gemini, connected via MCP, and governed by human-in-the-loop approval.

---

## 🎯 Problem Statement

Beginner and intermediate robotics enthusiasts face a fragmented learning experience — scattered documentation, unclear component lists, and no structured debugging help. **ROBO-OS** solves this with a single intelligent console that routes every question to the right specialist AI agent.

## 🧠 Architecture

```
User Query
    │
    ▼
[Security Guardrail] ──blocked──► Security Alert Modal
    │ valid
    ▼
[Orchestrator Agent] ──────────── Gemini API
    │ routes to
    ▼
┌─────────────────────────────────────┐
│  Idea Agent  │  Components Agent    │
│  Build Agent │  Troubleshooting Agent│
└─────────────────────────────────────┘
    │
    ▼
[MCP Server] ── google-developer-docs
    │
    ▼
[Human-in-the-Loop Approval Modal]
    │ approved
    ▼
[Workspace Output]
```

## ✅ Course Concepts Demonstrated

| Concept | Implementation |
|---|---|
| **Multi-agent system (ADK)** | 4 specialist agents + orchestrator routing |
| **MCP Server** | google-developer-docs MCP integration |
| **Antigravity** | Built and iterated using Antigravity IDE |
| **Security features** | Input guardrails, blocked topics, length validation |
| **Human-in-the-loop** | Approval modal before every workspace save |
| **Agent Skills** | Agents use MCP tools: search_docs, get_pinout, get_library_docs |

## 🤖 Agents

| Agent | Responsibility |
|---|---|
| **Orchestrator** | Classifies user query and routes to correct agent |
| **Idea Agent** | Suggests robotics projects by difficulty, cost, controller |
| **Components Agent** | Generates Bill of Materials with pricing and alternatives |
| **Build Agent** | Provides wiring guides, step-by-step instructions, and code |
| **Troubleshooting Agent** | Diagnoses failures with root cause analysis and fix checklists |

## 🔒 Security Features

- **Topic guardrails**: Blocks weapons, hacking, illegal queries
- **Domain validation**: Only robotics/electronics queries allowed
- **Length limits**: Min 3 / Max 500 characters
- **No API key in code**: Keys stored in localStorage only
- **HTML escaping**: All output sanitized to prevent XSS

## 🔗 MCP Integration

Connected to `google-developer-docs` MCP server providing:
- `search_docs` — Search official Google hardware documentation
- `get_pinout` — Get official microcontroller pinout specs
- `get_library_docs` — Get official library documentation

## 👤 Human-in-the-Loop

Every agent response goes through a **review modal** before being saved to the workspace. The user can:
- ✅ **Approve** — saves response to workspace
- 🔄 **Regenerate** — calls the agent again for a new response

## 🚀 Setup Instructions

### Prerequisites
- A modern web browser (Chrome, Firefox, Edge)


### Run Locally

```bash
git clone https://github.com/yogitha-star/robo-os
cd robo-os
# Option 1: Open index.html directly in browser
# Option 2: Run a local server
npx http-server -p 3000
# Open: http://localhost:3000
```

### Configure API Key
1. Open the app in browser
2. Click "Enter Gemini API Key..." in the top-right header
3. Paste your key and click **Connect**
4. System status changes to **Gemini Live** ✅

### Sandbox Mode
No API key? The app runs in **Sandbox Mode** with pre-built responses for all 4 agents — great for testing the UI and routing flow.

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla CSS, Vanilla JavaScript
- **AI**: Google Gemini 2.5 Flash API
- **Agent Framework**: Multi-agent orchestration pattern
- **MCP**: google-developer-docs server
- **Build Tool**: Antigravity IDE (vibe coding)
- **Deployment**: Static hosting (GitHub Pages / Netlify)

## 📁 Project Structure

```
robo-os/
├── index.html    # App shell, modals, layout
├── styles.css    # Dark navy glassmorphism design system
├── app.js        # Orchestration, agents, MCP, HITL, security
├── data.js       # MCP config, security rules, agent prompts, sandbox data
├── package.json  # Project metadata
└── README.md     # This file
```

## 👩‍💻 Author

**Yogitha** — B.Tech Cybersecurity, GCET Hyderabad  
GitHub: [github.com/yogitha-star](https://github.com/yogitha-star)

---

*Built for Kaggle's 5-Day AI Agents: Intensive Vibe Coding Course with Google*
