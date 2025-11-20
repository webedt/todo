// API helper functions
const API = {
    async getTodos() {
        const res = await fetch('./api/todos');
        return res.json();
    },

    async getUncompletedTodos() {
        const res = await fetch('./api/todos/uncompleted');
        return res.json();
    },

    async getCompletedTodos() {
        const res = await fetch('./api/todos/completed');
        return res.json();
    },

    async addTodo(title) {
        const res = await fetch('./api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        return res.json();
    },

    async toggleTodo(id) {
        const res = await fetch(`./api/todos/${id}/toggle`, {
            method: 'PUT'
        });
        return res.json();
    },

    async updateTodo(id, title) {
        const res = await fetch(`./api/todos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        return res.json();
    },

    async deleteTodo(id) {
        await fetch(`./api/todos/${id}`, {
            method: 'DELETE'
        });
    },

    async searchTodos(query) {
        const res = await fetch(`./api/todos/search?q=${encodeURIComponent(query)}`);
        return res.json();
    },

    async getTheme() {
        const res = await fetch('./api/theme');
        return res.json();
    },

    async setTheme(theme) {
        const res = await fetch('./api/theme', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme })
        });
        return res.json();
    },

    async clearCompletedTodos() {
        const res = await fetch('./api/todos/clear-completed', {
            method: 'POST'
        });
        return res.json();
    }
};

// Calculate days since creation
function getDaysOld(createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now - created);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// Get age category for styling
function getAgeCategory(days) {
    if (days >= 10) return '10-plus';
    return days.toString();
}

// Create todo item element
function createTodoElement(todo) {
    const li = document.createElement('li');
    li.className = 'todo-item';
    li.dataset.id = todo.id;
    li.dataset.createdAt = todo.createdAt;

    if (!todo.completed) {
        const daysOld = getDaysOld(todo.createdAt);
        li.dataset.age = getAgeCategory(daysOld);
    }

    if (todo.completed) {
        li.classList.add('completed');
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', async () => {
        await API.toggleTodo(todo.id);
        await loadTodos();
    });

    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.title;

    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'todo-edit-input';
    editInput.value = todo.title;
    editInput.style.display = 'none';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.className = 'edit-btn';
    editBtn.addEventListener('click', () => {
        text.style.display = 'none';
        editInput.style.display = 'block';
        editBtn.style.display = 'none';
        deleteBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'inline-block';
        editInput.focus();
        editInput.select();
    });

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'save-btn';
    saveBtn.style.display = 'none';
    saveBtn.addEventListener('click', async () => {
        const newTitle = editInput.value.trim();
        if (newTitle && newTitle !== todo.title) {
            await API.updateTodo(todo.id, newTitle);
            await loadTodos();
        } else {
            // Cancel if empty or unchanged
            text.style.display = 'block';
            editInput.style.display = 'none';
            editBtn.style.display = 'inline-block';
            deleteBtn.style.display = 'inline-block';
            saveBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
        }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'cancel-btn';
    cancelBtn.style.display = 'none';
    cancelBtn.addEventListener('click', () => {
        editInput.value = todo.title;
        text.style.display = 'block';
        editInput.style.display = 'none';
        editBtn.style.display = 'inline-block';
        deleteBtn.style.display = 'inline-block';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'delete-btn';
    deleteBtn.addEventListener('click', async () => {
        await API.deleteTodo(todo.id);
        await loadTodos();
    });

    // Handle Enter key in edit input
    editInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveBtn.click();
        }
    });

    // Handle Escape key in edit input
    editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cancelBtn.click();
        }
    });

    buttonContainer.appendChild(editBtn);
    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(deleteBtn);

    li.appendChild(checkbox);
    li.appendChild(text);
    li.appendChild(editInput);
    li.appendChild(buttonContainer);

    return li;
}

// Sort todos
function sortTodos(todos, sortBy) {
    const sorted = [...todos];

    switch(sortBy) {
        case 'newest':
            sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            break;
        case 'oldest':
            sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            break;
        case 'title':
            sorted.sort((a, b) => a.title.localeCompare(b.title));
            break;
    }

    return sorted;
}

// Load and display todos
async function loadTodos() {
    const searchQuery = document.getElementById('search').value;
    const sortBy = document.getElementById('sort-select').value;

    let uncompletedTodos, completedTodos;

    if (searchQuery) {
        const allTodos = await API.searchTodos(searchQuery);
        uncompletedTodos = allTodos.filter(t => !t.completed);
        completedTodos = allTodos.filter(t => t.completed);
    } else {
        uncompletedTodos = await API.getUncompletedTodos();
        completedTodos = await API.getCompletedTodos();
    }

    // Sort todos
    uncompletedTodos = sortTodos(uncompletedTodos, sortBy);
    completedTodos = sortTodos(completedTodos, sortBy);

    // Render uncompleted todos
    const uncompletedList = document.getElementById('uncompleted-list');
    uncompletedList.innerHTML = '';

    if (uncompletedTodos.length === 0) {
        const emptyMsg = document.createElement('li');
        emptyMsg.textContent = searchQuery ? 'No matching uncompleted todos' : 'No uncompleted todos! 🎉';
        emptyMsg.style.opacity = '0.6';
        emptyMsg.style.padding = '20px';
        uncompletedList.appendChild(emptyMsg);
    } else {
        uncompletedTodos.forEach(todo => {
            uncompletedList.appendChild(createTodoElement(todo));
        });
    }

    // Render completed todos
    const completedList = document.getElementById('completed-list');
    completedList.innerHTML = '';

    document.getElementById('completed-count').textContent = `(${completedTodos.length})`;

    if (completedTodos.length === 0) {
        const emptyMsg = document.createElement('li');
        emptyMsg.textContent = 'No completed todos yet';
        emptyMsg.style.opacity = '0.6';
        emptyMsg.style.padding = '20px';
        completedList.appendChild(emptyMsg);
    } else {
        completedTodos.forEach(todo => {
            completedList.appendChild(createTodoElement(todo));
        });
    }
}

// Setup Server-Sent Events for real-time updates
function setupSSE() {
    let eventSource;

    function connect() {
        eventSource = new EventSource('./api/events');

        eventSource.onopen = () => {
            console.log('✓ Real-time sync connected');
        };

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);

            // Handle different event types
            switch(data.type) {
                case 'connected':
                    console.log('✓ SSE connection established');
                    break;
                case 'todo-added':
                case 'todo-updated':
                case 'todo-toggled':
                case 'todo-deleted':
                    // Reload todos when any change occurs
                    loadTodos();
                    break;
            }
        };

        eventSource.onerror = (error) => {
            console.log('✗ SSE connection lost, reconnecting...');
            eventSource.close();
            // Reconnect after 3 seconds
            setTimeout(connect, 3000);
        };
    }

    connect();

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (eventSource) {
            eventSource.close();
        }
    });
}

// Initialize app
async function init() {
    // Load theme
    const { theme } = await API.getTheme();
    document.body.dataset.theme = theme;
    document.getElementById('theme-select').value = theme;

    // Load todos
    await loadTodos();

    // Setup real-time sync
    setupSSE();

    // Add todo event
    const addBtn = document.getElementById('add-btn');
    const newTodoInput = document.getElementById('new-todo');

    const addTodo = async () => {
        const title = newTodoInput.value.trim();
        if (title) {
            await API.addTodo(title);
            newTodoInput.value = '';
            await loadTodos();
        }
    };

    addBtn.addEventListener('click', addTodo);
    newTodoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addTodo();
        }
    });

    // Theme change event
    document.getElementById('theme-select').addEventListener('change', async (e) => {
        const theme = e.target.value;
        await API.setTheme(theme);
        document.body.dataset.theme = theme;
    });

    // Search event
    document.getElementById('search').addEventListener('input', async () => {
        await loadTodos();
    });

    // Sort event
    document.getElementById('sort-select').addEventListener('change', async () => {
        await loadTodos();
    });

    // Completed section toggle
    const completedHeader = document.getElementById('completed-header');
    const completedList = document.getElementById('completed-list');

    completedHeader.addEventListener('click', () => {
        completedList.classList.toggle('collapsed');
        completedHeader.classList.toggle('collapsed');
    });

    // Clear completed todos
    const clearCompletedBtn = document.getElementById('clear-completed-btn');
    clearCompletedBtn.addEventListener('click', async () => {
        const completedTodos = await API.getCompletedTodos();
        if (completedTodos.length === 0) {
            return;
        }
        if (confirm(`Clear ${completedTodos.length} completed todo(s)? They will remain in the database but won't be visible.`)) {
            await API.clearCompletedTodos();
            await loadTodos();
        }
    });
}

// Start the app
init();
