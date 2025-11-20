import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';

export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  cleared: boolean;
  createdAt: string;
  completedAt: string | null;
  userName: string;
}

export interface User {
  userId: string;
  displayName: string;
  createdAt: string;
}

export interface Settings {
  theme: string;
}

export type Theme = 'dark' | 'light' | 'retro' | 'banana' | 'ice' | 'forest';

class TodoDatabase {
  private db: Database | null = null;
  private dbPath: string;

  constructor(dbPath: string = './todos.db') {
    this.dbPath = dbPath;
  }

  async initialize() {
    const SQL = await initSqlJs();

    // Load existing database or create new one
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    // Create users table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create todos table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        completed BOOLEAN DEFAULT 0,
        cleared BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT,
        user_name TEXT NOT NULL DEFAULT 'Guest'
      )
    `);

    // Create settings table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Set default theme if not exists
    const result = this.db.exec('SELECT * FROM settings WHERE key = ?', ['theme']);
    if (result.length === 0 || result[0].values.length === 0) {
      this.db.run('INSERT INTO settings (key, value) VALUES (?, ?)', ['theme', 'dark']);
    }

    this.save();
  }

  private save(): void {
    if (!this.db) return;
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, data);
  }

  // Todo operations
  getAllTodos(userName?: string): Todo[] {
    if (!this.db) return [];
    if (userName) {
      const result = this.db.exec('SELECT * FROM todos WHERE user_name = ? ORDER BY created_at DESC', [userName]);
      return this.parseResults(result);
    }
    const result = this.db.exec('SELECT * FROM todos ORDER BY created_at DESC');
    return this.parseResults(result);
  }

  getUncompletedTodos(userName?: string): Todo[] {
    if (!this.db) return [];
    if (userName) {
      const result = this.db.exec('SELECT * FROM todos WHERE completed = 0 AND user_name = ? ORDER BY created_at DESC', [userName]);
      return this.parseResults(result);
    }
    const result = this.db.exec('SELECT * FROM todos WHERE completed = 0 ORDER BY created_at DESC');
    return this.parseResults(result);
  }

  getCompletedTodos(userName?: string): Todo[] {
    if (!this.db) return [];
    if (userName) {
      const result = this.db.exec('SELECT * FROM todos WHERE completed = 1 AND cleared = 0 AND user_name = ? ORDER BY completed_at DESC', [userName]);
      return this.parseResults(result);
    }
    const result = this.db.exec('SELECT * FROM todos WHERE completed = 1 AND cleared = 0 ORDER BY completed_at DESC');
    return this.parseResults(result);
  }

  addTodo(title: string, userName: string): Todo {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    this.db.run('INSERT INTO todos (title, created_at, user_name) VALUES (?, ?, ?)', [title, now, userName]);
    this.save();

    const result = this.db.exec('SELECT * FROM todos ORDER BY id DESC LIMIT 1');
    return this.parseResults(result)[0];
  }

  getTodoById(id: number): Todo | undefined {
    if (!this.db) return undefined;
    const result = this.db.exec('SELECT * FROM todos WHERE id = ?', [id]);
    const todos = this.parseResults(result);
    return todos[0];
  }

  updateTodo(id: number, title: string): void {
    if (!this.db) return;
    this.db.run('UPDATE todos SET title = ? WHERE id = ?', [title, id]);
    this.save();
  }

  toggleTodo(id: number): void {
    if (!this.db) return;

    const todo = this.getTodoById(id);
    if (!todo) return;

    if (todo.completed) {
      this.db.run('UPDATE todos SET completed = 0, completed_at = NULL WHERE id = ?', [id]);
    } else {
      const now = new Date().toISOString();
      this.db.run('UPDATE todos SET completed = 1, completed_at = ? WHERE id = ?', [now, id]);
    }
    this.save();
  }

  deleteTodo(id: number): void {
    if (!this.db) return;
    this.db.run('DELETE FROM todos WHERE id = ?', [id]);
    this.save();
  }

  searchTodos(query: string, userName?: string): Todo[] {
    if (!this.db) return [];
    if (userName) {
      const result = this.db.exec('SELECT * FROM todos WHERE title LIKE ? AND user_name = ? ORDER BY created_at DESC', [`%${query}%`, userName]);
      return this.parseResults(result);
    }
    const result = this.db.exec('SELECT * FROM todos WHERE title LIKE ? ORDER BY created_at DESC', [`%${query}%`]);
    return this.parseResults(result);
  }

  clearCompletedTodos(): void {
    if (!this.db) return;
    this.db.run('UPDATE todos SET cleared = 1 WHERE completed = 1 AND cleared = 0');
    this.save();
  }

  // User operations
  generateUserId(displayName: string): string {
    // Sanitize the display name for URL use
    const sanitized = displayName.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Generate 32 random characters (alphanumeric)
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let randomSuffix = '';
    for (let i = 0; i < 32; i++) {
      randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return `${sanitized}-${randomSuffix}`;
  }

  createUser(displayName: string): User {
    if (!this.db) throw new Error('Database not initialized');

    const userId = this.generateUserId(displayName);
    const now = new Date().toISOString();

    this.db.run('INSERT INTO users (user_id, display_name, created_at) VALUES (?, ?, ?)',
      [userId, displayName, now]);
    this.save();

    return {
      userId,
      displayName,
      createdAt: now
    };
  }

  getUserById(userId: string): User | undefined {
    if (!this.db) return undefined;
    const result = this.db.exec('SELECT * FROM users WHERE user_id = ?', [userId]);
    if (result.length === 0 || result[0].values.length === 0) return undefined;

    const row = result[0].values[0];
    const columns = result[0].columns;
    const obj: any = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });

    return {
      userId: obj.user_id,
      displayName: obj.display_name,
      createdAt: obj.created_at
    };
  }

  // Settings operations
  getTheme(): Theme {
    if (!this.db) return 'dark';
    const result = this.db.exec('SELECT value FROM settings WHERE key = ?', ['theme']);
    if (result.length > 0 && result[0].values.length > 0) {
      return result[0].values[0][0] as Theme;
    }
    return 'dark';
  }

  setTheme(theme: Theme): void {
    if (!this.db) return;
    this.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['theme', theme]);
    this.save();
  }

  private parseResults(result: any[]): Todo[] {
    if (result.length === 0) return [];

    const columns = result[0].columns;
    const values = result[0].values;

    return values.map((row: any[]) => {
      const obj: any = {};
      columns.forEach((col: string, i: number) => {
        obj[col] = row[i];
      });
      return this.mapTodo(obj);
    });
  }

  private mapTodo(row: any): Todo {
    return {
      id: row.id,
      title: row.title,
      completed: Boolean(row.completed),
      cleared: Boolean(row.cleared),
      createdAt: row.created_at,
      completedAt: row.completed_at,
      userName: row.user_name || 'Guest'
    };
  }

  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
    }
  }
}

export default TodoDatabase;
