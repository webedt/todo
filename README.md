# Todo App

A beautiful, themed todo application with SQLite storage and fading effects for aging todos.

## Features

- 📝 Add, complete, and delete todos
- 🎨 6 Beautiful themes:
  - 🌙 Dark (default)
  - ☀️ Light
  - 👾 Retro (pixelated font)
  - 🍌 Banana
  - ❄️ Ice
  - 🌲 Forest
- 📉 Todos fade as they age (get lighter and less bold over days)
- ✅ Completed items are collapsed by default (expandable)
- 🔍 Search functionality
- 🔄 Sort by newest, oldest, or alphabetically
- 💾 SQLite database for persistent storage

## Installation

```bash
npm install
```

## Usage

### Development mode:
```bash
npm run dev
```

### Build and run:
```bash
npm run build
npm start
```

The app will be available at [http://localhost:3000](http://localhost:3000)

## How it works

- Todos are stored in a SQLite database (`todos.db`)
- Uncompleted todos are shown by default, with bold styling that fades over time
- The older a todo gets, the lighter and less bold it becomes (encouraging you to complete it!)
- Completed todos can be viewed by clicking the "Completed Todos" header
- Search works across all todos (both completed and uncompleted)
- Theme preference is saved to the database

## Tech Stack

- TypeScript
- Express.js
- SQLite (sql.js)
- Vanilla JavaScript (no frontend framework)
- CSS with theme system

## Deployment

This application automatically deploys to Dokploy via GitHub Actions on every push.

### Deployment URLs

- **GitHub Repository**: https://github.com/webedt/todo
- **Live Site**: https://github.etdofresh.com/webedt/todo/main/

### Docker Deployment

```bash
# Build the Docker image
docker build -t todo-app .

# Run the container
docker run -p 3000:3000 todo-app
```

### Dokploy Configuration

The app deploys with path-based routing:
- URL pattern: `github.etdofresh.com/{owner}/{repo}/{branch}/`
- Strip Prefix enabled - path is removed before forwarding to app
- Each branch gets its own path on shared domain
- Container exposes port 3000
- Automatic cleanup when branches are deleted
