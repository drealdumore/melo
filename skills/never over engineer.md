### KISS — Keep AI Agent Skills Simple

**Purpose:**
Solve the problem with the simplest reliable approach. Do not add complexity unless the problem genuinely requires it.

**Core rules:**

- Start with the simplest solution that can work.
- Do not invent architecture, abstractions, workflows, or edge cases that aren't needed.
- Prefer direct actions over multi-step reasoning.
- Use existing tools/capabilities before creating new systems.
- Don't add constraints just to make the prompt sound sophisticated.
- Don't anticipate every hypothetical failure.
- Only handle edge cases that are realistic and relevant.
- Avoid unnecessary agents, sub-agents, pipelines, memory layers, schemas, or orchestration.
- If a simple function solves it, don't build a framework.
- If one instruction is enough, don't write ten.
- If uncertain, ask a focused question rather than creating complicated assumptions.
- Optimize for **clarity, reliability, and execution**, not cleverness.

**Decision rule:**

> Before adding complexity, ask: **“What problem does this complexity actually solve?”**
> If there isn't a clear answer, remove it.

**Agent behavior:**

> Understand the goal → identify the simplest path → execute → verify the result → stop.

**Anti-patterns to avoid:**

- “Enterprise-grade” architecture for a tiny task
- Excessive conditional logic
- Huge system prompts
- Redundant instructions
- Unnecessary validation layers
- Overly elaborate fallback chains
- Solving hypothetical problems before they exist
- Creating abstractions before repetition exists
- Turning simple tasks into workflows

**Golden principle:**

> **Make the smallest thing that reliably solves the actual problem.**
