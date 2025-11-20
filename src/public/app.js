// User session management
let currentUserId = null;
let currentUserDisplayName = null;

function getUserIdFromUrl() {
    const pathname = window.location.pathname;
    // Remove leading/trailing slashes and get the last segment
    const segments = pathname.split('/').filter(s => s.length > 0);

    // The user ID should be the last segment (after any deployment path)
    if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        // Check if it looks like a user ID (contains a hyphen and is reasonably long)
        if (lastSegment.includes('-') && lastSegment.length > 10) {
            return lastSegment;
        }
    }
    return null;
}

function setUrlWithUserId(userId) {
    // Get the base path (everything before the user ID)
    const pathname = window.location.pathname;
    let basePath = pathname.endsWith('/') ? pathname : pathname + '/';

    // If there's already a user ID, remove it
    const currentUserId = getUserIdFromUrl();
    if (currentUserId && basePath.includes(currentUserId)) {
        basePath = basePath.replace(currentUserId + '/', '').replace(currentUserId, '');
    }

    const newPath = basePath + userId;
    window.history.pushState({userId}, '', newPath);
}

async function loadUserFromUrl() {
    const userId = getUserIdFromUrl();
    if (!userId) return null;

    try {
        const res = await fetch(`./api/users/${userId}`);
        if (res.ok) {
            const user = await res.json();
            currentUserId = user.userId;
            currentUserDisplayName = user.displayName;
            return user;
        }
    } catch (error) {
        console.error('Failed to load user:', error);
    }
    return null;
}

async function createUserAndRedirect(displayName, rememberMe = false) {
    try {
        const res = await fetch('./api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName })
        });

        if (res.ok) {
            const user = await res.json();
            currentUserId = user.userId;
            currentUserDisplayName = user.displayName;

            if (rememberMe) {
                localStorage.setItem('todoAppUserId', user.userId);
            }

            setUrlWithUserId(user.userId);
            return user;
        }
    } catch (error) {
        console.error('Failed to create user:', error);
    }
    return null;
}

function clearCurrentUser() {
    currentUserId = null;
    currentUserDisplayName = null;
    localStorage.removeItem('todoAppUserId');

    // Navigate back to root path, removing the user ID
    const pathname = window.location.pathname;
    const userId = getUserIdFromUrl();
    if (userId && pathname.includes(userId)) {
        const basePath = pathname.replace('/' + userId, '').replace(userId, '') || '/';
        window.history.pushState({}, '', basePath);
    }
}

function updateTitle() {
    const title = document.getElementById('app-title');
    if (currentUserDisplayName) {
        title.textContent = `📝 ${currentUserDisplayName}'s Todos`;
    } else {
        title.textContent = '📝 Todo App';
    }
}

// API helper functions
const API = {
    async getTodos() {
        const res = await fetch(`./api/todos?userName=${encodeURIComponent(currentUserId)}`);
        return res.json();
    },

    async getUncompletedTodos() {
        const res = await fetch(`./api/todos/uncompleted?userName=${encodeURIComponent(currentUserId)}`);
        return res.json();
    },

    async getCompletedTodos() {
        const res = await fetch(`./api/todos/completed?userName=${encodeURIComponent(currentUserId)}`);
        return res.json();
    },

    async addTodo(title) {
        const res = await fetch('./api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, userName: currentUserId })
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
        const res = await fetch(`./api/todos/search?q=${encodeURIComponent(query)}&userName=${encodeURIComponent(currentUserId)}`);
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

// Show name modal
function showNameModal() {
    const modal = document.getElementById('name-modal');
    modal.classList.add('show');
    const nameInput = document.getElementById('name-input');
    nameInput.value = '';
    document.getElementById('remember-me').checked = false;
    nameInput.focus();
}

// Hide name modal
function hideNameModal() {
    const modal = document.getElementById('name-modal');
    modal.classList.remove('show');
}

// Handle name submission
async function handleNameSubmit() {
    const nameInput = document.getElementById('name-input');
    const rememberMe = document.getElementById('remember-me').checked;
    const displayName = nameInput.value.trim();

    if (displayName) {
        const user = await createUserAndRedirect(displayName, rememberMe);
        if (user) {
            hideNameModal();
            await setupAppAfterLogin();
        } else {
            alert('Failed to create user. Please try again.');
        }
    } else {
        nameInput.focus();
    }
}

// Setup app functionality after user login
async function setupAppAfterLogin() {
    updateTitle();

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
        updateThemeEmoji(theme);
        // Collapse the theme selector
        document.querySelector('.theme-selector').classList.remove('expanded');
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

// Get theme emoji
function getThemeEmoji(theme) {
    const themeEmojis = {
        'dark': '🌙',
        'light': '☀️',
        'retro': '👾',
        'banana': '🍌',
        'ice': '❄️',
        'forest': '🌲'
    };
    return themeEmojis[theme] || '🌙';
}

// Update theme emoji display
function updateThemeEmoji(theme) {
    document.getElementById('theme-emoji').textContent = getThemeEmoji(theme);
}

// Initialize app
async function init() {
    // Load theme
    const { theme } = await API.getTheme();
    document.body.dataset.theme = theme;
    document.getElementById('theme-select').value = theme;
    updateThemeEmoji(theme);

    // Set up theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    const themeSelector = document.querySelector('.theme-selector');
    const themeSelect = document.getElementById('theme-select');

    themeToggle.addEventListener('click', () => {
        themeSelector.classList.add('expanded');
        // Small delay to ensure the dropdown is visible before opening it
        setTimeout(() => {
            themeSelect.focus();
            // Trigger the dropdown to open
            if (themeSelect.showPicker) {
                themeSelect.showPicker();
            } else {
                // Fallback for browsers that don't support showPicker
                themeSelect.click();
            }
        }, 10);
    });

    // Collapse when clicking outside
    document.addEventListener('click', (e) => {
        if (!themeSelector.contains(e.target)) {
            themeSelector.classList.remove('expanded');
        }
    });

    // Set up name modal event listeners (must be set up before checking user)
    document.getElementById('name-submit').addEventListener('click', handleNameSubmit);
    document.getElementById('name-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleNameSubmit();
        }
    });

    // Switch user button
    document.getElementById('switch-user').addEventListener('click', () => {
        clearCurrentUser();
        showNameModal();
    });

    // Handle URL path changes (when user navigates back/forward)
    window.addEventListener('popstate', async () => {
        const userId = getUserIdFromUrl();
        if (userId && userId !== currentUserId) {
            const user = await loadUserFromUrl();
            if (user) {
                await setupAppAfterLogin();
            } else {
                showNameModal();
            }
        } else if (!userId && currentUserId) {
            // User navigated back to home, clear current user
            clearCurrentUser();
            showNameModal();
        }
    });

    // Check if user ID is in URL
    let user = await loadUserFromUrl();

    // If not in URL, check if user is remembered
    if (!user) {
        const rememberedUserId = localStorage.getItem('todoAppUserId');
        if (rememberedUserId) {
            setUrlWithUserId(rememberedUserId);
            user = await loadUserFromUrl();
        }
    }

    if (!user) {
        showNameModal();
        return; // Don't load todos until user enters name
    }

    // User is logged in, set up the app
    await setupAppAfterLogin();
}

// Start the app
init();
