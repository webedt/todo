# Claude Instructions for Todo App

## Deployment URLs

After completing any task involving code changes, commits, or pushes, you must always display clickable links to both the GitHub repository branch and the deployment site.

### Required Format

GitHub Branch: https://github.com/webedt/todo/tree/{branch-name}
Live Site: https://github.etdofresh.com/{owner}/{repo}/{branch}/

### URL Construction

**GitHub Link:** Append the branch name to the repository URL path.

**Deployment URL:** Path-based routing format:
- Pattern: `github.etdofresh.com/{owner}/{repo}/{branch}/`
- Owner: `webedt` (lowercase)
- Repo: `todo` (lowercase)
- Branch: branch name with slashes replaced by hyphens

### Example

For branch `main`:
- GitHub Branch: https://github.com/webedt/todo/tree/main
- Live Site: https://github.etdofresh.com/webedt/todo/main/

For branch `feature/edit-todos`:
- GitHub Branch: https://github.com/webedt/todo/tree/feature/edit-todos
- Live Site: https://github.etdofresh.com/webedt/todo/feature-edit-todos/

## Deployment Configuration

The application deploys to Dokploy with the following configuration:

### Domain Setup in Dokploy

1. **Path-based routing**: `github.etdofresh.com/{owner}/{repo}/{branch}/`
2. **Strip Prefix**: Enabled - removes path before forwarding to app
3. **Port**: 3000
4. **HTTPS**: Let's Encrypt certificates automatically provisioned

### Critical Path Requirements

**IMPORTANT**: All static assets and API calls MUST use relative paths (starting with `./`) to work correctly with Strip Path:

**Static Assets in HTML:**
- ✅ Correct: `<link rel="stylesheet" href="./styles.css">`
- ❌ Wrong: `<link rel="stylesheet" href="/styles.css">`
- ✅ Correct: `<script src="./app.js"></script>`
- ❌ Wrong: `<script src="/app.js"></script>`

**API Calls in JavaScript:**
- ✅ Correct: `fetch('./api/todos')`
- ❌ Wrong: `fetch('/api/todos')`
- ✅ Correct: `fetch('./api/theme')`
- ❌ Wrong: `fetch('/api/theme')`

**Why Relative Paths Are Required:**

When deployed at `https://github.etdofresh.com/webedt/todo/main/`:
- Relative path `./api/theme` → `https://github.etdofresh.com/webedt/todo/main/api/theme`
- Traefik matches path prefix `/webedt/todo/main/`
- Strip Path removes `/webedt/todo/main/`
- Express receives `/api/theme` ✓

If using absolute paths:
- Absolute path `/api/theme` → `https://github.etdofresh.com/api/theme`
- No path prefix → Traefik doesn't route to container
- Returns 404 ❌

**DO NOT use `<base>` tag:** The `<base href>` tag affects ALL URL resolution including absolute paths, which breaks the routing

### GitHub Actions

The `.github/workflows/deploy-dokploy.yml` file automatically:
1. Creates or updates the Dokploy application on push
2. Configures GitHub provider to build from Dockerfile
3. Sets up domain with Let's Encrypt SSL
4. Triggers deployment for new applications
5. Displays deployment URLs in workflow summary

The `.github/workflows/cleanup-dokploy.yml` file automatically:
1. Detects branch deletions
2. Finds the associated Dokploy application
3. Deletes the application and all resources

### Docker Configuration

- **Port**: 3000
- **Database**: SQLite file (in-memory for now, can add volume mount)
- **Build**: Multi-stage build for optimized image size
- **Base Image**: node:20-alpine

## Important Notes

- ALWAYS show the deployment links at the end of your response when completing a task
- Each branch gets its own path on the shared domain
- Strip Prefix removes the path before requests reach the app
- Workflow requires organization/repository variables and secrets to be configured
- Runs on self-hosted runner
