# Deployment Guide for Dokploy

This guide explains how to deploy the Todo app to Dokploy with subdomain-based routing.

## Prerequisites

- Dokploy instance running
- Wildcard DNS `*.etdofresh.com` pointing to your Dokploy server
- GitHub organization variables and secrets configured
- Self-hosted GitHub Actions runner

## Automated Deployment

The deployment is **fully automated** via GitHub Actions. No manual Dokploy configuration is needed!

### How It Works

1. Push code to any branch
2. GitHub Actions workflow (`deploy-dokploy.yml`) runs
3. Workflow creates/updates Dokploy application automatically
4. Application is configured with:
   - GitHub provider (builds from Dockerfile)
   - Subdomain: `{owner}-{repo}-{branch}.etdofresh.com`
   - Let's Encrypt SSL certificate
   - Port 3000
5. Deployment is triggered (for new apps only)

### Required Variables & Secrets

**Organization/Repository Variables:**
- `DOKPLOY_URL` - Your Dokploy instance URL
- `DOKPLOY_PROJECT_ID` - Target project ID
- `DOKPLOY_ENVIRONMENT_ID` - Target environment ID
- `DOKPLOY_GITHUB_ID` - GitHub integration ID in Dokploy
- `DOKPLOY_SERVER_ID` - Server ID in Dokploy

**Secrets:**
- `DOKPLOY_API_KEY` - API key for Dokploy

## Manual Configuration (If Needed)

You should not need manual configuration, but if you want to create an application manually:

### Persistent Storage (Optional)

For data persistence across deployments:

1. Go to **Volumes** section
2. Add volume mount:
   - **Host Path**: `/var/lib/dokploy/data/todo-main`
   - **Container Path**: `/app`
   - This persists the `todos.db` file

## Multi-Branch Deployment

Deploying multiple branches is automatic! Each push to a branch creates a new application:

### Example: Branch `feature/new-feature`

1. Push code to `feature/new-feature`
2. Workflow automatically creates: `webedt-todo-feature-new-feature`
3. **Live URL**: `https://webedt-todo-feature-new-feature.etdofresh.com`
4. When branch is deleted, the application is automatically cleaned up

### Domain Naming Strategy

The workflow uses a progressive fallback to fit within DNS's 63-character subdomain limit:

1. Try `{owner}-{repo}-{branch}` (preferred)
2. Fall back to `{repo}-{branch}` if too long
3. Further strategies if still too long (see workflow for details)

## Cleanup on Branch Delete

The `cleanup-dokploy.yml` workflow automatically:
1. Detects branch deletions
2. Finds the matching Dokploy application
3. Deletes the application and all resources

## Troubleshooting

### Issue: Workflow fails with "Application creation failed"

**Solution**: Check that all required variables and secrets are configured in GitHub settings.

### Issue: Domain not accessible after deployment

**Solution**:
- Verify wildcard DNS `*.etdofresh.com` is configured correctly
- Check Dokploy logs for SSL certificate provisioning status
- Let's Encrypt may take a few minutes to provision

### Issue: Database resets on redeploy

**Solution**: Configure a persistent volume in Dokploy (see Persistent Storage section above).

### Issue: Deployment only happens once

**Solution**: This is by design! The workflow only triggers deployment on first creation. Subsequent pushes update the configuration but Dokploy handles the actual rebuild via GitHub webhooks.

## Monitoring

View logs in Dokploy:
1. Go to your application
2. Click on **Logs** tab
3. Watch for startup message: `🚀 Todo app running at http://localhost:3000`

## URLs After Deployment

After deploying to the `main` branch:

- **GitHub Branch**: https://github.com/webedt/todo/tree/main
- **Live Site**: https://webedt-todo-main.etdofresh.com
