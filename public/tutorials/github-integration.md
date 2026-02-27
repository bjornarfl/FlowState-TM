# GitHub Integration

Learn how to use FlowState TM's GitHub integration for version control and team collaboration.

## What You'll Learn

- Setting up GitHub Personal Access Tokens
- Understanding the `.threat-models` folder convention
- Committing threat models to GitHub
- Loading threat models from GitHub
- Using extra files (diagrams and markdown)
- Alternative: Using standard git commands

## Why Use GitHub Integration?

GitHub integration provides:

- **Version Control:** Track all changes over time
- **Team Collaboration:** Share models with your team
- **Backup:** Your models are safely stored in the cloud
- **Review Process:** Use pull requests to review changes
- **Automation:** Integrate with CI/CD pipelines

## Setup

### Creating a Personal Access Token

FlowState requires a [Personal Access Token (PAT)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) to access your GitHub repositories.

**Fine-grained token (recommended):**

1. Go to your GitHub Developer Settings → Personal Access Tokens → Fine-grained tokens
2. Click **Generate new token**
3. Configure:
   - **Name:** FlowState TM
   - **Expiration:** Choose your preference (90 days recommended)
   - **Repository access:** Select specific repositories
   - **Permissions:** Grant **Contents** read and write access
4. Click **Generate token**
5. Copy the token immediately (you won't see it again)

**Classic token (alternative):**

1. Go to GitHub Developer Settings → Personal Access Tokens → Tokens (classic)
2. Click **Generate new token (classic)**
3. Select scopes:
   - `repo` (for private repositories)
   - or `public_repo` (for public repositories only)
4. Generate and copy the token

### Entering Your Token in FlowState

When prompted in FlowState:

1. Paste your PAT
2. Choose whether to persist it:
   - **Persist for session:** Token saved for the current browser session (cleared when you close the browser)
   - **Don't persist:** Token not saved; you'll need to re-enter it for each action

> **Security:** Your PAT is never permanently stored. At most, it's kept for the current browser session only. This minimizes risks related to PAT theft via XSS attacks. FlowState communicates directly with GitHub's API from your browser—tokens are never sent to FlowState servers.

## The `.threat-models` Folder Convention

FlowState uses a **`.threat-models`** folder convention in your repositories:

### Why This Matters

- **Commits:** When you commit via FlowState, files are stored in `.threat-models/` or its subfolders
- **Loading:** When loading from GitHub, only files in `.threat-models/` are shown
- **Manual commits:** If you commit files using git CLI, place them in `.threat-models/` to make them accessible via the integration

### Folder Structure Examples

```
your-repo/
├── .threat-models/
│   ├── web-app.yaml
│   ├── api-gateway.yaml
│   ├── backend/
│   │   ├── auth-service.yaml
│   │   └── payment-service.yaml
│   └── prod/
│       └── infrastructure.yaml
├── src/
└── README.md
```

**Valid paths:**
- `.threat-models/web-app.yaml`
- `.threat-models/backend/api-gateway.yaml`
- `.threat-models/prod/payment-service.yaml`

> **Tip:** Organize threat models by environment, component, or team using subfolders within `.threat-models/`.

## Committing Threat Models to GitHub

### First Commit

1. Create or work on your threat model in FlowState
2. Click **Save** (💾) or press **⌘S** / **Ctrl+S**
3. The commit modal opens
4. Fill in the details:
   - **Repository:** Select owner/repo from the dropdown
   - **Branch:** Choose the target branch
   - **Path:** Specify the file path starting with `.threat-models/`
     - Example: `.threat-models/api-gateway.yaml`
   - **Commit message:** Write a descriptive message
     - Good: "Add authentication threats to API gateway"
     - Avoid: "Update"
5. (Optional) Check **Include diagram PNG** or **Include markdown file**
6. Click **Commit**

Your file is committed! The navbar shows a 🔗 icon with the repository name.

### Subsequent Commits

Once you've committed a file:

1. Make changes to your threat model
2. Press **⌘S** / **Ctrl+S** or click **Save**
3. The commit modal opens with settings pre-filled
4. Update the commit message
5. Click **Commit**

FlowState remembers your repository, branch, and path for quick commits.

### Extra Files

When committing, you can include additional files:

**Diagram PNG:**
- Exports the data flow diagram as a high-resolution image
- Stored alongside your YAML file (e.g., `api-gateway.png`)
- Perfect for documentation and presentations

**Markdown file:**
- Generates a complete markdown report with:
  - Threat model metadata
  - Component and asset tables
  - Threat and control tables
  - Embedded diagram
- Stored alongside your YAML file (e.g., `api-gateway.md`)
- Great for GitHub README or wiki pages

**Example commit:**
```
.threat-models/
  ├── api-gateway.yaml      # The threat model
  ├── api-gateway.png       # Diagram image
  └── api-gateway.md        # Markdown report
```

## Loading Threat Models from GitHub

Once threat models exist in your repository:

1. Click **New** (+) → **Load from GitHub**
2. If prompted, enter your PAT
3. Browse your repositories:
   - Select the repository
   - Select the branch
4. Choose a threat model from the `.threat-models` folder
5. Click to load it

The threat model loads with GitHub as the active save source. Any saves will commit back to the same file.

### Switching Repositories or Branches

To work on a different repository or branch:

1. Click **New** (+) → **Load from GitHub**
2. Select a different repository or branch
3. Load the desired threat model

## GitHub Settings

Access GitHub settings from the navbar:

1. Click the **Settings** (⚙️) icon
2. Navigate to **GitHub Integration**

Options:
- **Change domain:** Switch between GitHub.com and GitHub Enterprise
- **Manage PAT:** Update or clear your token
- **View connected repo:** See current repository details

## Using Standard Git Commands

You don't need the GitHub integration to version control threat models:

### Workflow

1. **Save locally:** Use **Save to File** to save your threat model in a git-controlled folder
2. **Commit with git:**
   ```bash
   # Add the file
   git add .threat-models/my-threat-model.yaml
   
   # Commit with a message
   git commit -m "Add authentication threats"
   
   # Push to remote
   git push origin main
   ```

3. **Works with any platform:**
   - GitHub
   - GitLab
   - Bitbucket
   - Azure DevOps
   - Self-hosted git servers

### Benefits

- More control over commits
- Works with any git hosting platform
- Supports advanced git workflows (rebase, squash, etc.)
- No PAT required

### Recommendation

Place files in `.threat-models/` if you might want to use the GitHub integration later:

```bash
git add .threat-models/my-threat-model.yaml
```

## Best Practices

### Commit Messages

Write clear, descriptive commit messages:

✅ **Good:**
- "Add data encryption threats for customer database"
- "Update authentication controls with MFA requirements"
- "Initial threat model for payment processing service"
- "Fix typo in threat description"

❌ **Avoid:**
- "Update"
- "Changes"
- "wip"
- "asdf"

### Branch Strategy

**For teams:**
- Create feature branches for new threat models
- Use pull requests for review
- Merge to `main` after approval

**For solo work:**
- Commit directly to `main` for quick iterations
- Create branches for major revisions

### File Organization

Organize threat models logically:

**By component:**
```
.threat-models/
  ├── frontend/
  ├── backend/
  └── infrastructure/
```

**By team:**
```
.threat-models/
  ├── platform-team/
  ├── product-team/
  └── security-team/
```

## Troubleshooting

### "Authentication failed"
- **Cause:** Invalid, expired, or insufficient permissions on PAT
- **Fix:** Generate a new PAT with correct scopes (Contents read/write)

### "Repository not found"
- **Cause:** PAT doesn't have access to the repository
- **Fix:** For fine-grained tokens, ensure repository is selected in token settings

### "Cannot commit to branch"
- **Cause:** Branch is protected or PAT lacks write permissions
- **Fix:** Use a different branch and create a pull request

### "File not found" when loading
- **Cause:** File is not in `.threat-models/` folder
- **Fix:** Move the file to `.threat-models/` in your repository

### Lost connection
- **Cause:** PAT was cleared from browser storage
- **Fix:** Re-enter your PAT when prompted
