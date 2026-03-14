---
description: Create implementation plan with risk assessment
agent: planner
subtask: true
---

# Plan Command

Create a detailed implementation plan for: $ARGUMENTS

## Your Task

### **Restate Requirements**

**Goals:**: Clarify what needs to be built

1. use `Question` tool to clarify ambiguities in the user request up front
2. Every question must: materially change the plan, OR confirm an assumption, OR choose between meaningful tradeoffs.
3. Offer only meaningful choices; don't include filler options that are obviously wrong.

### **Identify Risks**

**Goals:** Surface potential issues, blockers, and dependencies

### **Create Step Plan**

**Goals:** Break down implementation into phases

### **Wait for Confirmation**

**Goals:** MUST receive user approval before proceeding

1. use `Question` tool to ask for confirmation [yes/no/modify] on the plan before any code is written

## Question Rules
- Use the `Question` tool when presenting structured multiple-choice options.
- Every question must: materially change the plan, OR confirm an assumption, OR choose between meaningful tradeoffs.
- Offer only meaningful choices; don't include filler options that are obviously wrong.

## Output Format

### Requirements Restatement
[Clear, concise restatement of what will be built]

### Implementation Phases
[Phase 1: Description]
- Step 1.1
- Step 1.2
...

[Phase 2: Description]
- Step 2.1
- Step 2.2
...

### Dependencies
[List external dependencies, APIs, services needed]

### Risks
- HIGH: [Critical risks that could block implementation]
- MEDIUM: [Moderate risks to address]
- LOW: [Minor concerns]

### Estimated Complexity
[HIGH/MEDIUM/LOW with time estimates]

**WAITING FOR CONFIRMATION**: Proceed with this plan? (yes/no/modify)

---

**CRITICAL**: Do NOT write any code until the user explicitly confirms with "yes", "proceed", or similar affirmative response.
