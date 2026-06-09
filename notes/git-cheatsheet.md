# Git & GitHub Cheatsheet

Organised by *what you're trying to do*, not alphabetically.
Commands shown for Windows PowerShell; Git/GitHub commands are identical on all OSes.

---

## 1. Starting a brand-new project

```powershell
mkdir my-project              # create the project folder
cd my-project                 # move into it
git init                      # turn it into a Git repo

# Create .gitignore BEFORE your first commit (so secrets never enter history)
# (add: .env, .venv/, __pycache__/, *.log, etc.)

git add .                     # stage everything Git is allowed to see
git commit -m "Initial commit"

# Create the GitHub remote and push, in one command (needs GitHub CLI):
gh repo create my-project --private --source=. --remote=origin --push

# Verify the trunk is set correctly (avoids the default-branch trap):
gh repo view --json defaultBranchRef     # should show "main"
```

> One-time global setup (per machine, not per project):
> ```powershell
> git config --global user.name "Your Name"
> git config --global user.email "you@example.com"
> git config --global init.defaultBranch main
> git config --global pull.rebase true
> ```

---

## 2. The daily workflow loop (memorise this rhythm)

```powershell
# START every piece of work from an up-to-date trunk
git checkout main
git pull

# BRANCH for the specific task
git checkout -b feature/short-description

# ... do the work, then ...
git status                    # ALWAYS inspect before staging
git add path/to/files         # stage deliberately
git commit -m "Imperative summary of what this does"

# PUSH the branch up
git push -u origin feature/short-description

# OPEN a pull request, review the diff, then MERGE
gh pr create --fill
gh pr merge --squash --delete-branch

# RETURN to a clean trunk
git checkout main
git pull
```

The loop: **branch → work → commit → push → PR → review → merge → return to main.**

---

## 3. Checking where you are / what's going on

```powershell
git status                    # what's changed, staged, untracked
git branch                    # list local branches (* = current)
git branch -a                 # list ALL branches incl. remote
git log --oneline             # compact history
git log --oneline -10         # last 10 commits only
git remote -v                 # where 'origin' points (push & fetch URLs)
git diff                      # unstaged changes vs last commit
git diff --staged             # staged changes about to be committed
```

---

## 4. Staging & committing

```powershell
git add file.py               # stage one file
git add app/                  # stage a folder
git add .                     # stage everything allowed (respects .gitignore)
git restore --staged file.py  # UNSTAGE a file (keeps your edits)
git commit -m "Message"       # commit staged changes
git commit --amend            # fix the LAST commit (only if NOT pushed)
```

Good commit messages are imperative: "Add health endpoint", "Fix score validation" —
they complete the sentence "If applied, this commit will ___."

---

## 5. Branches

```powershell
git checkout -b feature/x     # create AND switch to new branch
git checkout main             # switch to an existing branch
git switch main               # newer equivalent of checkout for switching
git branch -d feature/x       # delete a merged branch (safe)
git branch -D feature/x       # force-delete an unmerged branch (careful)
```

---

## 6. Syncing with GitHub

```powershell
git pull                      # bring remote changes down into current branch
git push                      # send your commits up (after -u is set once)
git push -u origin branch     # first push of a new branch (sets upstream)
git fetch origin              # update your knowledge of the remote WITHOUT merging
```

---

## 7. Undoing things (from safest to most drastic)

```powershell
git restore file.py           # discard unstaged edits to a file (CANNOT undo)
git restore --staged file.py  # unstage but keep edits
git checkout main             # abandon a branch's work by just leaving it
git revert <commit>           # make a NEW commit that undoes an old one (safe, shareable)
git reset --soft HEAD~1       # undo last commit, KEEP changes staged
git reset --hard HEAD~1       # undo last commit AND discard changes (DANGER: unrecoverable)
```

> Rule of thumb: prefer `revert` for anything already pushed/shared.
> `reset --hard` only on local, un-pushed work you're certain about.

---

## 8. Fixing the problems you actually hit

```powershell
# "no tracking information for the current branch"
git fetch origin
git branch --set-upstream-to=origin/main main

# Remote is on SSH but you authenticated with HTTPS (Permission denied publickey)
git remote set-url origin https://github.com/USERNAME/REPO.git

# Default branch on GitHub is wrong (PR base = head error)
git push -u origin main                    # ensure main exists on remote first
gh repo edit --default-branch main

# GitHub CLI not authenticated / wrong account
gh auth login
gh auth status                             # check who you're logged in as
```

---

## 9. GitHub CLI quick reference

```powershell
gh auth login                 # authenticate this machine
gh repo create NAME --private --source=. --remote=origin --push
gh repo view --json defaultBranchRef       # check the default branch
gh repo view --web            # open the repo in your browser
gh pr create --fill           # open a PR, auto-filled from commits
gh pr merge --squash --delete-branch       # merge & clean up
gh pr list                    # list open PRs
gh pr view --web              # open current branch's PR in browser
```

---

## 10. The non-negotiable habits

1. **`.gitignore` before first commit** — secrets must never enter history.
2. **Never commit directly to `main`** — always branch, always PR.
3. **`git status` before every `git add`** — know what you're staging.
4. **Read the PR diff before merging** — catch mistakes while they're cheap.
5. **Imperative commit messages** — they're documentation, not notes-to-self.
6. **Observe before acting** when something breaks — `git status`, `git remote -v`,
   `git branch -a` tell you the real state. Diagnose, then fix.
