import { Pool, PoolClient } from 'pg';

export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  cleared: boolean;
  createdAt: string;
  completedAt: string | null;
  userName: string;
  orderIndex: number;
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
  private pool: Pool | null = null;

  constructor() {
    // DATABASE_URL is read from environment variable
  }

  async initialize() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    this.pool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    // Test connection
    const client = await this.pool.connect();
    try {
      // Create users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          user_id TEXT PRIMARY KEY,
          display_name TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create todos table
      await client.query(`
        CREATE TABLE IF NOT EXISTS todos (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          completed BOOLEAN DEFAULT FALSE,
          cleared BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMPTZ,
          user_name TEXT NOT NULL DEFAULT 'Guest',
          order_index INTEGER DEFAULT 0
        )
      `);

      // Add order_index column if it doesn't exist (migration)
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'todos' AND column_name = 'order_index'
          ) THEN
            ALTER TABLE todos ADD COLUMN order_index INTEGER DEFAULT 0;
          END IF;
        END $$;
      `);

      // Create settings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);

      // Set default theme if not exists
      const result = await client.query('SELECT * FROM settings WHERE key = $1', ['theme']);
      if (result.rows.length === 0) {
        await client.query('INSERT INTO settings (key, value) VALUES ($1, $2)', ['theme', 'dark']);
      }
    } finally {
      client.release();
    }
  }

  // Todo operations
  async getAllTodos(userName?: string): Promise<Todo[]> {
    if (!this.pool) return [];
    if (userName) {
      const result = await this.pool.query(
        'SELECT * FROM todos WHERE user_name = $1 ORDER BY created_at DESC',
        [userName]
      );
      return result.rows.map(this.mapTodo);
    }
    const result = await this.pool.query('SELECT * FROM todos ORDER BY created_at DESC');
    return result.rows.map(this.mapTodo);
  }

  async getUncompletedTodos(userName?: string): Promise<Todo[]> {
    if (!this.pool) return [];
    if (userName) {
      const result = await this.pool.query(
        'SELECT * FROM todos WHERE completed = FALSE AND user_name = $1 ORDER BY order_index ASC, created_at DESC',
        [userName]
      );
      return result.rows.map(this.mapTodo);
    }
    const result = await this.pool.query(
      'SELECT * FROM todos WHERE completed = FALSE ORDER BY order_index ASC, created_at DESC'
    );
    return result.rows.map(this.mapTodo);
  }

  async getCompletedTodos(userName?: string): Promise<Todo[]> {
    if (!this.pool) return [];
    if (userName) {
      const result = await this.pool.query(
        'SELECT * FROM todos WHERE completed = TRUE AND cleared = FALSE AND user_name = $1 ORDER BY completed_at DESC',
        [userName]
      );
      return result.rows.map(this.mapTodo);
    }
    const result = await this.pool.query(
      'SELECT * FROM todos WHERE completed = TRUE AND cleared = FALSE ORDER BY completed_at DESC'
    );
    return result.rows.map(this.mapTodo);
  }

  async addTodo(title: string, userName: string): Promise<Todo> {
    if (!this.pool) throw new Error('Database not initialized');

    const now = new Date().toISOString();
    const result = await this.pool.query(
      'INSERT INTO todos (title, created_at, user_name) VALUES ($1, $2, $3) RETURNING *',
      [title, now, userName]
    );
    return this.mapTodo(result.rows[0]);
  }

  async getTodoById(id: number): Promise<Todo | undefined> {
    if (!this.pool) return undefined;
    const result = await this.pool.query('SELECT * FROM todos WHERE id = $1', [id]);
    if (result.rows.length === 0) return undefined;
    return this.mapTodo(result.rows[0]);
  }

  async updateTodo(id: number, title: string): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('UPDATE todos SET title = $1 WHERE id = $2', [title, id]);
  }

  async toggleTodo(id: number): Promise<void> {
    if (!this.pool) return;

    const todo = await this.getTodoById(id);
    if (!todo) return;

    if (todo.completed) {
      await this.pool.query(
        'UPDATE todos SET completed = FALSE, completed_at = NULL WHERE id = $1',
        [id]
      );
    } else {
      const now = new Date().toISOString();
      await this.pool.query(
        'UPDATE todos SET completed = TRUE, completed_at = $1 WHERE id = $2',
        [now, id]
      );
    }
  }

  async deleteTodo(id: number): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('DELETE FROM todos WHERE id = $1', [id]);
  }

  async searchTodos(query: string, userName?: string): Promise<Todo[]> {
    if (!this.pool) return [];
    if (userName) {
      const result = await this.pool.query(
        'SELECT * FROM todos WHERE title ILIKE $1 AND user_name = $2 ORDER BY created_at DESC',
        [`%${query}%`, userName]
      );
      return result.rows.map(this.mapTodo);
    }
    const result = await this.pool.query(
      'SELECT * FROM todos WHERE title ILIKE $1 ORDER BY created_at DESC',
      [`%${query}%`]
    );
    return result.rows.map(this.mapTodo);
  }

  async clearCompletedTodos(): Promise<void> {
    if (!this.pool) return;
    await this.pool.query('UPDATE todos SET cleared = TRUE WHERE completed = TRUE AND cleared = FALSE');
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

  async createUser(displayName: string): Promise<User> {
    if (!this.pool) throw new Error('Database not initialized');

    const userId = this.generateUserId(displayName);
    const now = new Date().toISOString();

    await this.pool.query(
      'INSERT INTO users (user_id, display_name, created_at) VALUES ($1, $2, $3)',
      [userId, displayName, now]
    );

    return {
      userId,
      displayName,
      createdAt: now
    };
  }

  async getUserById(userId: string): Promise<User | undefined> {
    if (!this.pool) return undefined;
    const result = await this.pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    if (result.rows.length === 0) return undefined;

    const row = result.rows[0];
    return {
      userId: row.user_id,
      displayName: row.display_name,
      createdAt: row.created_at
    };
  }

  // Settings operations
  async getTheme(): Promise<Theme> {
    if (!this.pool) return 'dark';
    const result = await this.pool.query('SELECT value FROM settings WHERE key = $1', ['theme']);
    if (result.rows.length > 0) {
      return result.rows[0].value as Theme;
    }
    return 'dark';
  }

  async setTheme(theme: Theme): Promise<void> {
    if (!this.pool) return;
    await this.pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      ['theme', theme]
    );
  }

  async reorderTodos(todoIds: number[]): Promise<void> {
    if (!this.pool) return;

    // Update order_index for each todo based on its position in the array
    for (let i = 0; i < todoIds.length; i++) {
      await this.pool.query(
        'UPDATE todos SET order_index = $1 WHERE id = $2',
        [i, todoIds[i]]
      );
    }
  }

  private mapTodo(row: any): Todo {
    return {
      id: row.id,
      title: row.title,
      completed: Boolean(row.completed),
      cleared: Boolean(row.cleared),
      createdAt: row.created_at,
      completedAt: row.completed_at,
      userName: row.user_name || 'Guest',
      orderIndex: row.order_index || 0
    };
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

export default TodoDatabase;
