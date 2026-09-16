# DirectRef Push

Commit and push all pending changes across both DirectRef repos: `vouch-frontend` and `vouch-backend`.

## Steps

1. Run `git status` in both `/Users/anat.atar/vouch-frontend` and `/Users/anat.atar/vouch-backend` to see what's changed.

2. Show the user a summary of what will be committed in each repo and ask for a commit message, OR generate a descriptive one from the diff if the changes are clear.

3. In each repo that has changes:
   - `git add -A`
   - `git commit -m "<message>\n\nCo-Authored-By: Claude <noreply@anthropic.com>"`
   - `git push`

4. Report the result — which repos were pushed, which had nothing to commit.

## Rules
- Never commit `node_modules`, `.env`, or secret files.
- If a repo has no changes, skip it and say so.
- Always end commit messages with the Co-Authored-By trailer.
