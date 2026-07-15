# VS Code Insert/Use Manual Checklist

Use this checklist when validating that the VS Code extension reports `skill:use` correctly for insert-at-cursor actions.

## Preconditions

- `conductor-app` is running locally
- the VS Code extension is built and loaded
- `skillsLibrary.skillsPath` points to this repo's `skills/` folder
- `skillsLibrary.conductorUrl` points to the local conductor app
- `skillsLibrary.userId` and `skillsLibrary.eventToken` are configured
- the referenced user already exists in the conductor database and is `ACTIVE`

## Validation Steps

1. Open a normal editable file in VS Code.
2. Place the cursor where skill content should be inserted.
3. Open the Skills Library sidebar.
4. Choose a skill and run `Insert at Cursor`.
5. Confirm the skill content is inserted into the active editor.
6. Check the conductor app audit log for a new `skill:use` event.
7. Confirm the event metadata includes:
   - `skillName`
   - `source: vscode-extension`
   - `targetFile`
8. Confirm an admin notification is created.
9. If SMTP is configured, confirm email delivery state updates as expected.
10. Repeat quickly a second time and verify the insert still works normally.

## Failure Checks

- If content inserts but no event appears, inspect the VS Code `Skills Library` output channel.
- If the event is rejected, verify `SKILL_EVENTS_TOKEN`, `x-user-id`, and user approval state.
- If audit logs exist but notifications do not, inspect conductor notification and email logs.
