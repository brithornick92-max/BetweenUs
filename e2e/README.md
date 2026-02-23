# Between Us — E2E Tests (Maestro)

End-to-end UI tests using [Maestro](https://maestro.mobile.dev/).

## Setup

```bash
# Install Maestro CLI
curl -Ls "https://get.maestro.mobile.dev" | bash

# Verify installation
maestro --version
```

## Running Tests

```bash
# Run all flows
maestro test e2e/

# Run a specific flow
maestro test e2e/auth-flow.yaml

# Run with studio (visual debugger)
maestro studio
```

## Test Flows

| Flow | File | Description |
|------|------|-------------|
| Auth | `auth-flow.yaml` | Sign up → verify → sign in |
| Onboarding | `onboarding-flow.yaml` | Complete 4-step onboarding |
| Core Loop | `core-loop.yaml` | View prompt → answer → check journal |
| Date Night | `date-night-flow.yaml` | Browse dates → filter → like |
| Premium | `premium-flow.yaml` | Hit paywall → verify gating |

## Writing New Tests

Maestro uses YAML-based flows. Key commands:
- `tapOn: "text"` — tap a visible text element
- `assertVisible: "text"` — verify text is on screen
- `swipe` — directional swipes
- `inputText: "value"` — type into focused field
- `scroll` — scroll the screen
- `waitForAnimationToEnd` — wait for transitions

See [Maestro docs](https://maestro.mobile.dev/reference/commands) for full reference.
