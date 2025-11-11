# Microcopy Style Guide

This guide establishes shared language and tone for the admin workspace so that
operators, designers, and engineers ship consistent copy across views and
components.

## Terminology

Use the preferred vocabulary below in UI labels, documentation, and release
notes. Avoid synonyms unless the alternate term is part of a third-party brand
name.

| Concept | Use | Avoid | Notes |
| --- | --- | --- | --- |
| Platform | **workspace**, admin workspace | back office, console | Reinforces collaborative context instead of tooling jargon. |
| Automated assistants | **agent**, Easymo agent | bot, robot | “Agent” keeps parity with product marketing and analytics dashboards. |
| Agent-specific landing view | **agent overview** | agent home, agent HQ | For `/agents/overview` route titles and breadcrumb copy. |
| Monitoring for agent metrics | **agent dashboard** | agents dashboard, bots dashboard | Singular noun keeps voice aligned with other sections. |
| Knowledge content | **playbook** | manual, script | Describes reusable instructions without implying rigidity. |
| Conversations | **live conversations** | chats, threads | Applies to human-in-the-loop handoffs. |
| Operations queue | **tasks and workflows** | pipelines, flows | Use when referencing `/tasks` navigation and related cards. |
| External vendors | **vendors** | suppliers, partners | Keeps terminology consistent across marketplace, insurance, and mobility. |
| Customers | **customer** (singular) | client, user | Distinguish from signed-in operators. |
| Data fetch states | **loading**, **ready**, **problem loading** | fetching, error, fail | Provides actionable and human-centered phrasing. |
| Primary action button | **Save changes** or **Submit request** | Save, Confirm | Use “Submit” when a request is sent to another team/service. |
| Secondary action button | **Cancel** | Close, Dismiss | Only use “Close” for dialogs that never persisted input. |

### Formatting conventions

- **Sentence case** for buttons, menus, and section headings (`Agent overview`).
- **Plain-language connectors** — write out “and” instead of ampersands except
  in official names (e.g., “RRA”).
- Use **Unicode ellipsis (…​)** when indicating a pending operation.
- Prefer **concise labels** under 28 characters for navigation items.

## Tone & Voice

- Lead with **direct, supportive language**. Imagine you are pairing with an
  operator resolving live work.
- Default to **present tense** and describe what happens now (“Save changes”)
  instead of what will happen.
- **Acknowledge success** without hype (“Updates saved.”) and be specific about
  next steps when work is required.
- **We-voice** for system messaging (“We couldn’t load the agent configuration.”)
  keeps accountability on the product and not the user.

## Error Messaging

Every error state should cover three elements:

1. **What happened** in plain language.
2. **What the system attempted** (if relevant).
3. **What to do next** or where to seek help.

Example template: “We couldn’t sync vendor quotes. Try again in a few minutes or
reach support if the issue continues.”

When space is limited (button-level toasts), shorten to a single actionable
sentence while keeping the we-voice.

## Localization & Accessibility

- Write copy that can expand by **30–40 %** without breaking layouts. Favor
  flexible containers over fixed widths.
- Avoid cultural idioms or references that do not translate literally.
- Store dates, times, and numbers as structured data. Let formatters convert to
  locale-specific display (e.g., `Intl.NumberFormat`).
- Provide translation keys where feasible and avoid embedding markup inside
  strings so translators can work safely.
- Ensure aria labels and alt text follow the same vocabulary so assistive
  technology mirrors what appears on screen.

## Governance

- Add new terms to the table above before introducing them in the UI.
- Link PRs updating copy to this guide and request a microcopy review from the
  design system team.
- When product marketing publishes a vocabulary change, update the guide and
  highlight affected surfaces in release notes.
