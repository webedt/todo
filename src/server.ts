import express, { Request, Response } from 'express';
import path from 'path';
import { EventEmitter } from 'events';
import TodoDatabase, { Theme } from './database';

const app = express();
const PORT = 3000;

// Initialize database
const db = new TodoDatabase();

// Event emitter for broadcasting changes
const todoEvents = new EventEmitter();

// Store connected SSE clients
const sseClients: Response[] = [];

// Middleware
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Initialize and start server
async function startServer() {
  await db.initialize();

// API Routes

// Create a new user
app.post('/api/users', (req: Request, res: Response) => {
    const { displayName } = req.body;

    if (!displayName || typeof displayName !== 'string') {
        return res.status(400).json({ error: 'Display name is required' });
    }

    const user = db.createUser(displayName);
    res.json(user);
});

// Get user by ID
app.get('/api/users/:userId', (req: Request, res: Response) => {
    const userId = req.params.userId;
    const user = db.getUserById(userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
});

// Server-Sent Events endpoint for real-time updates
app.get('/api/events', (req: Request, res: Response) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Add this client to the list
    sseClients.push(res);

    // Send initial connection message
    res.write('data: {"type":"connected"}\n\n');

    // Remove client when connection closes
    req.on('close', () => {
        const index = sseClients.indexOf(res);
        if (index !== -1) {
            sseClients.splice(index, 1);
        }
    });
});

// Broadcast function to send updates to all connected clients
function broadcastUpdate(type: string, data?: any) {
    const message = `data: ${JSON.stringify({ type, data })}\n\n`;
    sseClients.forEach(client => {
        try {
            client.write(message);
        } catch (error) {
            console.error('Error sending SSE message:', error);
        }
    });
}


// Get all todos
app.get('/api/todos', (req: Request, res: Response) => {
    const userName = req.query.userName as string;
    const todos = db.getAllTodos(userName);
    res.json(todos);
});

// Get uncompleted todos
app.get('/api/todos/uncompleted', (req: Request, res: Response) => {
    const userName = req.query.userName as string;
    const todos = db.getUncompletedTodos(userName);
    res.json(todos);
});

// Get completed todos
app.get('/api/todos/completed', (req: Request, res: Response) => {
    const userName = req.query.userName as string;
    const todos = db.getCompletedTodos(userName);
    res.json(todos);
});

// Search todos
app.get('/api/todos/search', (req: Request, res: Response) => {
    const query = req.query.q as string || '';
    const userName = req.query.userName as string;
    const todos = db.searchTodos(query, userName);
    res.json(todos);
});

// Add a new todo
app.post('/api/todos', (req: Request, res: Response) => {
    const { title, userName } = req.body;

    if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Title is required' });
    }

    if (!userName || typeof userName !== 'string') {
        return res.status(400).json({ error: 'User name is required' });
    }

    const todo = db.addTodo(title, userName);
    broadcastUpdate('todo-added', todo);
    res.json(todo);
});

// Update a todo's title
app.put('/api/todos/:id', (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const { title } = req.body;

    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
    }

    if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Title is required' });
    }

    db.updateTodo(id, title);
    const todo = db.getTodoById(id);
    broadcastUpdate('todo-updated', todo);
    res.json(todo);
});

// Toggle todo completion
app.put('/api/todos/:id/toggle', (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
    }

    db.toggleTodo(id);
    const todo = db.getTodoById(id);
    broadcastUpdate('todo-toggled', todo);
    res.json(todo);
});

// Delete a todo
app.delete('/api/todos/:id', (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
    }

    db.deleteTodo(id);
    broadcastUpdate('todo-deleted', { id });
    res.json({ success: true });
});

// Clear all completed todos
app.post('/api/todos/clear-completed', (req: Request, res: Response) => {
    db.clearCompletedTodos();
    res.json({ success: true });
});

// Get theme
app.get('/api/theme', (req: Request, res: Response) => {
    const theme = db.getTheme();
    res.json({ theme });
});

// Set theme
app.put('/api/theme', (req: Request, res: Response) => {
    const { theme } = req.body;

    const validThemes: Theme[] = ['dark', 'light', 'retro', 'banana', 'ice', 'forest'];

    if (!theme || !validThemes.includes(theme)) {
        return res.status(400).json({ error: 'Invalid theme' });
    }

    db.setTheme(theme);
    res.json({ theme });
});

// Serve static files (after API routes to prevent conflicts)
app.use(express.static(path.join(__dirname, 'public')));

// Serve the main page
app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all route for user paths (SPA routing)
// This serves index.html for any path that looks like a user ID
app.get('*', (req: Request, res: Response) => {
    // Only serve index.html for non-API routes
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.status(404).json({ error: 'Not found' });
    }
});

  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 Todo app running at http://localhost:${PORT}`);
    console.log(`📝 Database initialized`);
  });
}

// Start the application
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  db.close();
  process.exit(0);
});
