import express, { Request, Response } from 'express';
import path from 'path';
import TodoDatabase, { Theme } from './database';

const app = express();
const PORT = 3000;

// Initialize database
const db = new TodoDatabase();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize and start server
async function startServer() {
  await db.initialize();

// API Routes

// Get all todos
app.get('/api/todos', (req: Request, res: Response) => {
    const todos = db.getAllTodos();
    res.json(todos);
});

// Get uncompleted todos
app.get('/api/todos/uncompleted', (req: Request, res: Response) => {
    const todos = db.getUncompletedTodos();
    res.json(todos);
});

// Get completed todos
app.get('/api/todos/completed', (req: Request, res: Response) => {
    const todos = db.getCompletedTodos();
    res.json(todos);
});

// Search todos
app.get('/api/todos/search', (req: Request, res: Response) => {
    const query = req.query.q as string || '';
    const todos = db.searchTodos(query);
    res.json(todos);
});

// Add a new todo
app.post('/api/todos', (req: Request, res: Response) => {
    const { title } = req.body;

    if (!title || typeof title !== 'string') {
        return res.status(400).json({ error: 'Title is required' });
    }

    const todo = db.addTodo(title);
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
    res.json(todo);
});

// Delete a todo
app.delete('/api/todos/:id', (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid ID' });
    }

    db.deleteTodo(id);
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

// Serve the main page
app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
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
