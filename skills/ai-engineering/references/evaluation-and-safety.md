# Evaluation and safety

Use this file when deciding whether an AI feature is trustworthy enough to ship.

## Evaluation areas

- task completion quality
- factual grounding
- consistency of output format
- latency and cost
- failure recovery
- refusal or safe-completion behavior

## Safety checks

- prompt injection exposure
- unauthorized data leakage
- unsafe tool invocation
- overconfident but wrong answers
- missing auditability for high-risk actions

## Practical rule

If the team cannot describe how the AI feature fails and how those failures will be detected, the feature is not ready.
