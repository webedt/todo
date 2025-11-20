import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';

export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  cleared: boolean;
  createdAt: string;
  completedAt: string | null;
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

    // Create todos table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        completed BOOLEAN DEFAULT 0,
        cleared BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        completed_at TEXT
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
  getAllTodos(): Todo[] {
    if (!this.db) return [];
    const result = this.db.exec('SELECT * FROM todos ORDER BY created_at DESC');
    return this.parseResults(result);
  }

  getUncompletedTodos(): Todo[] {
    if (!this.db) return [];
    const result = this.db.exec('SELECT * FROM todos WHERE completed = 0 ORDER BY created_at DESC');
    return this.parseResults(result);
  }

  getCompletedTodos(): Todo[] {
    if (!this.db) return [];
    const result = this.db.exec('SELECT * FROM todos WHERE completed = 1 AND cleared = 0 ORDER BY completed_at DESC');
    return this.parseResults(result);
  }

  addTodo(title: string): Todo {
    if (!this.db) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    this.db.run('INSERT INTO todos (title, created_at) VALUES (?, ?)', [title, now]);
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

  searchTodos(query: string): Todo[] {
    if (!this.db) return [];
    const result = this.db.exec('SELECT * FROM todos WHERE title LIKE ? ORDER BY created_at DESC', [`%${query}%`]);
    return this.parseResults(result);
  }

  clearCompletedTodos(): void {
    if (!this.db) return;
    this.db.run('UPDATE todos SET cleared = 1 WHERE completed = 1 AND cleared = 0');
    this.save();
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
      completedAt: row.completed_at
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
