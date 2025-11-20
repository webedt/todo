# Claude Instructions for Todo App

## Deployment URLs

After completing any task involving code changes, commits, or pushes, you must always display clickable links to both the GitHub repository branch and the deployment site.

### Required Format

GitHub Branch: https://github.com/ETdoFresh/todo/tree/{branch-name}
Live Site: https://github.etdofresh.com/etdofresh/todo/{branch-name}/

### URL Construction

**GitHub Link:** Append the branch name to the repository URL path.

**Deployment URL:** Format is `https://github.etdofresh.com/{owner}/{repo}/{branch}/`
- Owner: etdofresh (lowercase)
- Repo: todo (lowercase)
- Branch: current branch name with slashes replaced by hyphens

### Example

For branch `main`:
- GitHub Branch: https://github.com/ETdoFresh/todo/tree/main
- Live Site: https://github.etdofresh.com/etdofresh/todo/main/

For branch `feature/edit-todos`:
- GitHub Branch: https://github.com/ETdoFresh/todo/tree/feature/edit-todos
- Live Site: https://github.etdofresh.com/etdofresh/todo/feature-edit-todos/

## Deployment Configuration

The application deploys to Dokploy with the following configuration:

### Domain Setup in Dokploy

1. **Path-based routing**: `github.etdofresh.com/{owner}/{repo}/{branch}`
2. **Strip Prefix**: Enable "Strip Path" middleware to remove the path prefix before forwarding to the application
3. **Internal Path**: Not needed since the app serves from root

### GitHub Actions

The `.github/workflows/deploy.yml` file automatically:
1. Builds a Docker image on every push to any branch
2. Pushes the image to GitHub Container Registry (ghcr.io)
3. Displays the deployment URLs in the workflow summary

### Docker Configuration

- **Port**: 3000
- **Database**: SQLite file stored in container (persistent volume recommended)
- **Build**: Multi-stage build for optimized image size

## Important Notes

- ALWAYS show the deployment links at the end of your response when completing a task
- The Strip Path middleware in Dokploy removes the `/etdofresh/todo/{branch}` prefix before requests reach the app
- Ensure the application can handle being deployed at a subpath if needed
