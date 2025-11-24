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
app.post('/api/users', async (req: Request, res: Response) => {
    const { displayName } = req.body;

    if (!displayName || typeof displayName !== 'string') {
        return res.status(400).json({ error: 'Display name is required' });
    }

    try {
        const user = await db.createUser(displayName);
        res.json(user);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Get user by ID
app.get('/api/users/:userId', async (req: Request, res: Response) => {
    const userId = req.params.userId;

    try {
        const user = await db.getUserById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error getting user:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
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
app.get('/api/todos', async (req: Request, res: Response) => {
    const userName = req.query.userName as string;
    try {
        const todos = await db.getAllTodos(userName);
        res.json(todos);
    } catch (error) {
        console.error('Error getting todos:', error);
        res.status(500).json({ error: 'Failed to get todos' });
    }
});

// Get uncompleted todos
app.get('/api/todos/uncompleted', async (req: Request, res: Response) => {
    const userName = req.query.userName as string;
    try {
        const todos = await db.getUncompletedTodos(userName);
        res.json(todos);
    } catch (error) {
        console.error('Error getting uncompleted todos:', error);
        res.status(500).json({ error: 'Failed to get todos' });
    }
});

// Get completed todos
app.get('/api/todos/completed', async (req: Request, res: Response) => {
    const userName = req.query.userName as string;
    try {
        const todos = await db.getCompletedTodos(userName);
        res.json(todos);
    } catch (error) {
        console.error('Error getting completed todos:', error);
        res.status(500).json({ error: 'Failed to get todos' });
    }
});

// Search todos
app.get('/api/todos/search', async (req: Request, res: Response) => {
    const query = req.query.q as string || '';
    const userName = req.query.userName as string;
    try {
        const todos = await db.searchTodos(query, userName);
        res.json(todos);
    } catch (error) {
        console.error('Error searching todos:', error);
        res.status(500).json({ error: 'Failed to search todos' });
    }
});

// Add a new todo
app.post('/api/todos', async (req: Request, res: Response) => {
    const { title, userName } = req.body;

    if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Title is required' });
    }

    if (!userName || typeof userName !== 'string') {
        return res.status(400).json({ error: 'User name is required' });
    }

    try {
        const todo = await db.addTodo(title, userName);
        broadcastUpdate('todo-added', todo);
        res.json(todo);
    } catch (error) {
        console.error('Error adding todo:', error);
        res.status(500).json({ error: 'Failed to add todo' });
    }
});

// Update a todo's title
app.put('/api/todos/:id', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const { title } = req.body;

    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
    }

    if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Title is required' });
    }

    try {
        await db.updateTodo(id, title);
        const todo = await db.getTodoById(id);
        broadcastUpdate('todo-updated', todo);
        res.json(todo);
    } catch (error) {
        console.error('Error updating todo:', error);
        res.status(500).json({ error: 'Failed to update todo' });
    }
});

// Toggle todo completion
app.put('/api/todos/:id/toggle', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
    }

    try {
        await db.toggleTodo(id);
        const todo = await db.getTodoById(id);
        broadcastUpdate('todo-toggled', todo);
        res.json(todo);
    } catch (error) {
        console.error('Error toggling todo:', error);
        res.status(500).json({ error: 'Failed to toggle todo' });
    }
});

// Delete a todo
app.delete('/api/todos/:id', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
    }

    try {
        await db.deleteTodo(id);
        broadcastUpdate('todo-deleted', { id });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting todo:', error);
        res.status(500).json({ error: 'Failed to delete todo' });
    }
});

// Clear all completed todos
app.post('/api/todos/clear-completed', async (req: Request, res: Response) => {
    try {
        await db.clearCompletedTodos();
        res.json({ success: true });
    } catch (error) {
        console.error('Error clearing completed todos:', error);
        res.status(500).json({ error: 'Failed to clear todos' });
    }
});

// Reorder todos
app.post('/api/todos/reorder', async (req: Request, res: Response) => {
    const { todoIds } = req.body;

    if (!Array.isArray(todoIds) || todoIds.some(id => typeof id !== 'number')) {
        return res.status(400).json({ error: 'Invalid todo IDs array' });
    }

    try {
        await db.reorderTodos(todoIds);
        broadcastUpdate('todos-reordered');
        res.json({ success: true });
    } catch (error) {
        console.error('Error reordering todos:', error);
        res.status(500).json({ error: 'Failed to reorder todos' });
    }
});

// Complete all uncompleted todos
app.post('/api/todos/complete-all', async (req: Request, res: Response) => {
    const userName = req.query.userName as string;

    try {
        await db.completeAllTodos(userName);
        broadcastUpdate('todos-completed-all');
        res.json({ success: true });
    } catch (error) {
        console.error('Error completing all todos:', error);
        res.status(500).json({ error: 'Failed to complete all todos' });
    }
});

// Delete all uncompleted todos
app.post('/api/todos/delete-all-uncompleted', async (req: Request, res: Response) => {
    const userName = req.query.userName as string;

    try {
        await db.deleteAllUncompletedTodos(userName);
        broadcastUpdate('todos-deleted-all-uncompleted');
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting all uncompleted todos:', error);
        res.status(500).json({ error: 'Failed to delete all uncompleted todos' });
    }
});

// Get theme
app.get('/api/theme', async (req: Request, res: Response) => {
    try {
        const theme = await db.getTheme();
        res.json({ theme });
    } catch (error) {
        console.error('Error getting theme:', error);
        res.status(500).json({ error: 'Failed to get theme' });
    }
});

// Set theme
app.put('/api/theme', async (req: Request, res: Response) => {
    const { theme } = req.body;

    const validThemes: Theme[] = ['dark', 'light', 'retro', 'banana', 'ice', 'forest'];

    if (!theme || !validThemes.includes(theme)) {
        return res.status(400).json({ error: 'Invalid theme' });
    }

    try {
        await db.setTheme(theme);
        res.json({ theme });
    } catch (error) {
        console.error('Error setting theme:', error);
        res.status(500).json({ error: 'Failed to set theme' });
    }
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
    console.log(`Todo app running at http://localhost:${PORT}`);
    console.log(`Database initialized with PostgreSQL`);
  });
}

// Start the application
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await db.close();
  process.exit(0);
});
