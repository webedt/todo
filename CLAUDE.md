# Claude Instructions for Todo App

## Deployment URLs

After completing any task involving code changes, commits, or pushes, you must always display clickable links to both the GitHub repository branch and the deployment site.

### Required Format

GitHub Branch: https://github.com/webedt/todo/tree/{branch-name}
Live Site: https://{domain-name}.etdofresh.com

### URL Construction

**GitHub Link:** Append the branch name to the repository URL path.

**Deployment URL:** Uses the domain naming strategy from the workflow:
- Strategy 1 (preferred): `{owner}-{repo}-{branch}.etdofresh.com`
- Falls back to shorter versions if DNS 63-char limit exceeded

### Example

For branch `main`:
- GitHub Branch: https://github.com/webedt/todo/tree/main
- Live Site: https://webedt-todo-main.etdofresh.com

For branch `feature/edit-todos`:
- GitHub Branch: https://github.com/webedt/todo/tree/feature/edit-todos
- Live Site: https://webedt-todo-feature-edit-todos.etdofresh.com (or shorter if needed)

## Deployment Configuration

The application deploys to Dokploy with the following configuration:

### Domain Setup in Dokploy

1. **Subdomain-based routing**: `{domain-name}.etdofresh.com`
2. **Port**: 3000
3. **HTTPS**: Let's Encrypt certificates automatically provisioned
4. **No path prefix** - each branch gets its own subdomain

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
- Each branch gets its own subdomain
- Workflow requires organization/repository variables and secrets to be configured
- Runs on self-hosted runner
