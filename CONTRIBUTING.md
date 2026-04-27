# Contributing to BudgetBuddy

Thank you for contributing to BudgetBuddy.

## Workflow

1. Create a branch from the current `main` branch.
2. Implement the change.
3. Open a pull request.
4. Request review.
5. Merge after approval.

## Coding Standards

- Use descriptive variable names.
- Keep functions small and focused.
- Write clear commit messages.
- Follow the project structure.

## Testing

- Add tests that match the part of the app you changed.
- Frontend screens, components, and browser-facing helpers should be tested under `nextjs/__tests__/frontend/`.
- Frontend render and interaction tests should follow the existing Jest + React Testing Library pattern already used in that folder.
- In `nextjs/__tests__/frontend/`, name files to match the screen or module under test when obvious (e.g. `dashboard-view.test.js` for `dashboard-view.js`, `insights-view.test.js` for `insights-view.js`, `insights-lib.test.js` for `lib/insights.js`). Some focused helper tests still use `*.unit.test.js` or `*.integration.test.js`.
- Shared helpers and route-adjacent logic outside the frontend test area should usually be tested in `nextjs/__tests__/`, following the existing feature-based files there.
- API routes should usually get integration tests in `nextjs/__tests__/` using the current `next-test-api-route-handler` pattern.
- If component logic is split into helpers, test the helper directly and keep the rendered component test focused on visible behavior.
- Keep test file names and locations consistent with the patterns already in this repo.

## Pull Requests

Keep pull requests focused and easy to review.

- Use the pull request template that auto-loads.
- Write a clear, relevant PR title that matches the actual work.
- Explain the change clearly.
- Reference the related issue.
- Include tests when possible.
- Keep the PR limited to files and changes related to that issue or task.
- Do not mix unrelated work, unrelated files, or extra cleanup into the same PR.

Using the template helps keep PRs consistent, makes the purpose of the change clear, and lets reviewers understand the work quickly at a familiar glance.

## Branch Hygiene

- Create new branches from this repository's current `main` branch.
- Use meaningful branch names tied to the work.
- Prefer descriptive names such as `feat/...`, `fix/...`, or a clear issue-based name.
- Keep branch history clean and relevant to the issue being addressed.
- Avoid unrelated commits or changes that make the diff harder to review.

## Code Review

Every pull request should be reviewed by at least one team member before merging.

## Review Workflow

When you receive review comments:

- Read all comments carefully.
- Reply to every comment.
- If you fixed the issue, say what you changed.
- If you disagree, respond respectfully and explain why.
- Do not silently ignore comments.

After you reply and address the point, resolve the conversation. Do not resolve a conversation without replying first.

This helps reviewers track what changed, makes follow-up review easier, and reduces confusion.
