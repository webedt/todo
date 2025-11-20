# Deployment Guide for Dokploy

This guide explains how to deploy the Todo app to Dokploy with path-based routing.

## Prerequisites

- Dokploy instance running
- Domain `github.etdofresh.com` pointing to your Dokploy server
- GitHub Container Registry access configured

## Dokploy Configuration

### 1. Create Application

1. Log in to your Dokploy dashboard
2. Create a new application
3. Set the following:
   - **Name**: `todo-main` (or `todo-{branch-name}`)
   - **Source**: Docker Image
   - **Image**: `ghcr.io/etdofresh/todo:main`

### 2. Configure Domain

1. Go to the application's Domain settings
2. Add domain: `github.etdofresh.com`
3. **Path**: `/etdofresh/todo/main`
4. **Enable Strip Path**: ✅ YES (This is crucial!)

#### Why Strip Path?

The Strip Path middleware removes `/etdofresh/todo/main` from incoming requests before forwarding to your application.

**Example:**
- Request: `https://github.etdofresh.com/etdofresh/todo/main/api/todos`
- After Strip Path: `/api/todos` → forwarded to your app on port 3000

Without Strip Path, your app would receive `/etdofresh/todo/main/api/todos` and return 404 since it doesn't have routes with that prefix.

### 3. Environment Variables

No environment variables are required for basic setup. The app uses SQLite for storage.

### 4. Persistent Storage (Optional)

For data persistence across deployments:

1. Go to **Volumes** section
2. Add volume mount:
   - **Host Path**: `/var/lib/dokploy/data/todo-main`
   - **Container Path**: `/app`
   - This persists the `todos.db` file

### 5. Port Configuration

- **Container Port**: 3000
- **Protocol**: HTTP

## Multi-Branch Deployment

For deploying multiple branches:

### Branch: `feature/new-feature`

1. **Application Name**: `todo-feature-new-feature`
2. **Image**: `ghcr.io/etdofresh/todo:feature-new-feature`
3. **Domain Path**: `/etdofresh/todo/feature-new-feature`
4. **Strip Path**: ✅ Enabled
5. **Live URL**: `https://github.etdofresh.com/etdofresh/todo/feature-new-feature/`

### Automation with GitHub Actions

The `.github/workflows/deploy.yml` file automatically:
1. Builds Docker images for every branch
2. Tags images as `ghcr.io/etdofresh/todo:{branch-name}`
3. Pushes to GitHub Container Registry

You need to manually create the Dokploy application for each branch you want to deploy.

## Traefik Configuration (Advanced)

Dokploy uses Traefik for routing. The Strip Path middleware is configured automatically when you enable it in the Dokploy UI.

If you need manual configuration, the Traefik middleware would look like:

```yaml
http:
  middlewares:
    strip-todo-main:
      stripPrefix:
        prefixes:
          - "/etdofresh/todo/main"
```

## Troubleshooting

### Issue: 404 errors on all routes

**Solution**: Ensure Strip Path is enabled in Dokploy domain settings.

### Issue: Static files not loading

**Solution**: The app serves static files from `/dist/public`. Ensure your Docker build includes these files.

### Issue: Database resets on redeploy

**Solution**: Configure a persistent volume as described above.

### Issue: GitHub Actions fails to push image

**Solution**: Ensure the repository has `packages: write` permission enabled in GitHub settings.

## Monitoring

View logs in Dokploy:
1. Go to your application
2. Click on **Logs** tab
3. Watch for startup message: `🚀 Todo app running at http://localhost:3000`

## URLs After Deployment

After deploying to the `main` branch:

- **GitHub Branch**: https://github.com/ETdoFresh/todo/tree/main
- **Live Site**: https://github.etdofresh.com/etdofresh/todo/main/
