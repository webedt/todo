// User session management
let currentUserId = null;
let currentUserDisplayName = null;

// Calculate base path once on script load
// Find where app.js is loaded from to determine the deployment path
let cachedBasePath = null;

function calculateBasePath() {
    // Try to find the app.js script tag
    const scripts = document.getElementsByTagName('script');
    for (let script of scripts) {
        if (script.src && script.src.includes('app.js')) {
            const url = new URL(script.src);
            let pathname = url.pathname;
            // Remove /app.js to get the directory
            pathname = pathname.substring(0, pathname.lastIndexOf('/'));
            return pathname.endsWith('/') ? pathname : pathname + '/';
        }
    }

    // Fallback: use current pathname and remove potential user ID
    const currentPath = window.location.pathname;
    const segments = currentPath.split('/').filter(s => s.length > 0);

    // User IDs will be long (name + hyphen + 32 random chars, min ~34 chars)
    // Remove the last segment if it looks like a user ID
    if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        if (lastSegment.includes('-') && lastSegment.length >= 33) {
            segments.pop();
        }
    }

    const basePath = '/' + segments.join('/');
    return basePath.endsWith('/') ? basePath : basePath + '/';
}

// Get the base path for the deployment (e.g., /webedt/todo/branch/)
function getBasePath() {
    if (!cachedBasePath) {
        cachedBasePath = calculateBasePath();
    }
    return cachedBasePath;
}

function getUserIdFromUrl() {
    const pathname = window.location.pathname;
    const basePath = getBasePath();

    // Get the part after the base path
    const relativePath = pathname.startsWith(basePath)
        ? pathname.substring(basePath.length)
        : pathname;

    // Remove leading/trailing slashes
    const userPart = relativePath.replace(/^\/+|\/+$/g, '');

    // Check if it looks like a user ID (contains hyphen, min ~34 chars: name + hyphen + 32 random)
    if (userPart && userPart.includes('-') && userPart.length >= 33 && !userPart.includes('/')) {
        return userPart;
    }

    return null;
}

function setUrlWithUserId(userId) {
    const basePath = getBasePath();
    const newPath = basePath + userId;
    window.history.pushState({userId}, '', newPath);
}

// Helper to get API URL with correct base path
function getApiUrl(endpoint) {
    const basePath = getBasePath();
    // Remove leading slash from endpoint if present
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    // Combine base path with api endpoint
    return basePath + cleanEndpoint;
}

async function loadUserById(userId) {
    if (!userId) return null;

    try {
        const res = await fetch(getApiUrl(`api/users/${userId}`));
        if (res.ok) {
            const user = await res.json();
            currentUserId = user.userId;
            currentUserDisplayName = user.displayName;

            // Always remember the user when loading from URL
            localStorage.setItem('todoAppUserId', user.userId);

            return user;
        } else {
            console.error('Failed to load user:', res.status, res.statusText);
        }
    } catch (error) {
        console.error('Failed to load user:', error);
    }
    return null;
}

async function loadUserFromUrl() {
    const userId = getUserIdFromUrl();
    return await loadUserById(userId);
}

async function createUserAndRedirect(displayName) {
    try {
        const res = await fetch(getApiUrl('api/users'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName })
        });

        if (res.ok) {
            const user = await res.json();
            currentUserId = user.userId;
            currentUserDisplayName = user.displayName;

            // Always remember the user
            localStorage.setItem('todoAppUserId', user.userId);

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

    // Navigate back to base path, removing the user ID
    const basePath = getBasePath();
    window.history.pushState({}, '', basePath);
}

function updateProfileName() {
    const profileName = document.getElementById('profile-name');
    if (currentUserDisplayName) {
        profileName.textContent = currentUserDisplayName;
    } else {
        profileName.textContent = 'Guest';
    }
}

// API helper functions
const API = {
    async getTodos() {
        const res = await fetch(getApiUrl(`api/todos?userName=${encodeURIComponent(currentUserId)}`));
        return res.json();
    },

    async getUncompletedTodos() {
        const res = await fetch(getApiUrl(`api/todos/uncompleted?userName=${encodeURIComponent(currentUserId)}`));
        return res.json();
    },

    async getCompletedTodos() {
        const res = await fetch(getApiUrl(`api/todos/completed?userName=${encodeURIComponent(currentUserId)}`));
        return res.json();
    },

    async addTodo(title) {
        const res = await fetch(getApiUrl('api/todos'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, userName: currentUserId })
        });
        return res.json();
    },

    async toggleTodo(id) {
        const res = await fetch(getApiUrl(`api/todos/${id}/toggle`), {
            method: 'PUT'
        });
        return res.json();
    },

    async updateTodo(id, title) {
        const res = await fetch(getApiUrl(`api/todos/${id}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });
        return res.json();
    },

    async deleteTodo(id) {
        await fetch(getApiUrl(`api/todos/${id}`), {
            method: 'DELETE'
        });
    },

    async searchTodos(query) {
        const res = await fetch(getApiUrl(`api/todos/search?q=${encodeURIComponent(query)}&userName=${encodeURIComponent(currentUserId)}`));
        return res.json();
    },

    async getTheme() {
        const res = await fetch(getApiUrl('api/theme'));
        return res.json();
    },

    async setTheme(theme) {
        const res = await fetch(getApiUrl('api/theme'), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme })
        });
        return res.json();
    },

    async clearCompletedTodos() {
        const res = await fetch(getApiUrl('api/todos/clear-completed'), {
            method: 'POST'
        });
        return res.json();
    },

    async reorderTodos(todoIds) {
        const res = await fetch(getApiUrl('api/todos/reorder'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ todoIds })
        });
        return res.json();
    },

    async completeAllTodos() {
        const res = await fetch(getApiUrl(`api/todos/complete-all?userName=${encodeURIComponent(currentUserId)}`), {
            method: 'POST'
        });
        return res.json();
    },

    async deleteAllUncompletedTodos() {
        const res = await fetch(getApiUrl(`api/todos/delete-all-uncompleted?userName=${encodeURIComponent(currentUserId)}`), {
            method: 'POST'
        });
        return res.json();
    }
};

// Parse markdown to HTML
function parseMarkdown(text) {
    // Escape HTML to prevent XSS
    const escapeHtml = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    // Extract and temporarily replace links to protect them during processing
    const links = [];
    let processed = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
        links.push({ text: linkText, url: url });
        return `<<<LINK${links.length - 1}>>>`;
    });

    // Escape remaining HTML
    processed = escapeHtml(processed);

    // Process bold (**text** or __text__)
    processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Process italic (*text* or _text_)
    processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>');
    processed = processed.replace(/_(.+?)_/g, '<em>$1</em>');

    // Restore links (escaped as &lt;&lt;&lt;LINKN&gt;&gt;&gt; after escapeHtml)
    processed = processed.replace(/&lt;&lt;&lt;LINK(\d+)&gt;&gt;&gt;/g, (match, index) => {
        const link = links[parseInt(index)];
        if (!link) {
            return match;
        }
        return `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.text)}</a>`;
    });

    return processed;
}

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
    li.draggable = false; // Disable default dragging

    if (!todo.completed) {
        const daysOld = getDaysOld(todo.createdAt);
        li.dataset.age = getAgeCategory(daysOld);
    }

    if (todo.completed) {
        li.classList.add('completed');
    }

    // Drag handle
    const dragHandle = document.createElement('span');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '&#9776;'; // Hamburger icon
    dragHandle.title = 'Drag to reorder';
    dragHandle.draggable = true; // Only the handle is draggable

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', async () => {
        await API.toggleTodo(todo.id);
        await loadTodos();
    });

    const text = document.createElement('span');
    text.className = 'todo-text';
    text.innerHTML = parseMarkdown(todo.title);

    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'todo-edit-input';
    editInput.name = `todo-edit-${todo.id}`;
    editInput.value = todo.title;
    editInput.style.display = 'none';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    const editBtn = document.createElement('button');
    editBtn.innerHTML = '&#9998;'; // Pencil icon
    editBtn.className = 'edit-btn';
    editBtn.title = 'Edit';
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
    deleteBtn.innerHTML = '&#128465;'; // Trash can icon
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = 'Delete';
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

    li.appendChild(dragHandle);
    li.appendChild(checkbox);
    li.appendChild(text);
    li.appendChild(editInput);
    li.appendChild(buttonContainer);

    // Drag events - only on the drag handle
    dragHandle.addEventListener('dragstart', handleDragStart);
    dragHandle.addEventListener('dragend', handleDragEnd);

    // Touch events for mobile support
    dragHandle.addEventListener('touchstart', handleTouchStart, { passive: false });
    dragHandle.addEventListener('touchmove', handleTouchMove, { passive: false });
    dragHandle.addEventListener('touchend', handleTouchEnd);

    return li;
}

// Drag and drop state
let draggedElement = null;
let touchStartY = 0;
let touchStartX = 0;
let touchElement = null;
let touchPlaceholder = null;
let isLocalReordering = false; // Flag to prevent SSE reload during local drag

function handleDragStart(e) {
    // 'this' is the drag handle, we need to get the parent li
    const todoItem = this.closest('.todo-item');
    draggedElement = todoItem;
    todoItem.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', todoItem.dataset.id);
}

async function handleDragEnd(e) {
    // 'this' is the drag handle, we need to get the parent li
    const todoItem = this.closest('.todo-item');
    if (!todoItem) return;

    todoItem.classList.remove('dragging');

    // Get the new order of todos
    const list = todoItem.parentNode;
    if (!list) return;

    const todoIds = Array.from(list.children)
        .filter(li => li.classList.contains('todo-item'))
        .map(li => parseInt(li.dataset.id))
        .filter(id => !isNaN(id));

    // Only save if we have valid IDs
    if (todoIds.length > 0) {
        try {
            isLocalReordering = true;
            await API.reorderTodos(todoIds);
            console.log('Reordered todos:', todoIds);
            // Switch to custom order mode to preserve the drag order
            document.getElementById('sort-select').value = 'custom';
            // Clear the flag after a delay to allow SSE message to arrive and be ignored
            setTimeout(() => {
                isLocalReordering = false;
            }, 1000);
        } catch (error) {
            console.error('Failed to reorder todos:', error);
            isLocalReordering = false;
            // Reload todos to restore order
            await loadTodos();
        }
    }

    draggedElement = null;
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.todo-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Touch event handlers for mobile support
function handleTouchStart(e) {
    const todoItem = this.closest('.todo-item');
    const touch = e.touches[0];

    touchStartY = touch.clientY;
    touchStartX = touch.clientX;
    touchElement = todoItem;

    // Add a small delay to distinguish between tap and drag
    setTimeout(() => {
        if (touchElement) {
            touchElement.classList.add('dragging');

            // Create a placeholder
            touchPlaceholder = document.createElement('li');
            touchPlaceholder.className = 'todo-item touch-placeholder';
            touchPlaceholder.style.height = touchElement.offsetHeight + 'px';
            touchElement.parentNode.insertBefore(touchPlaceholder, touchElement);

            // Make the element fixed position for smooth dragging
            touchElement.style.position = 'fixed';
            touchElement.style.zIndex = '1000';
            touchElement.style.width = touchElement.offsetWidth + 'px';
            touchElement.style.left = touchElement.getBoundingClientRect().left + 'px';
            touchElement.style.top = touch.clientY - 30 + 'px';
            touchElement.style.pointerEvents = 'none';
        }
    }, 100);
}

function handleTouchMove(e) {
    if (!touchElement || !touchElement.classList.contains('dragging')) return;

    e.preventDefault();
    const touch = e.touches[0];

    // Move the element with the touch
    touchElement.style.top = touch.clientY - 30 + 'px';

    // Find the element we're hovering over
    const list = touchPlaceholder.parentNode;
    const afterElement = getDragAfterElement(list, touch.clientY);

    if (afterElement == null) {
        list.appendChild(touchPlaceholder);
    } else {
        list.insertBefore(touchPlaceholder, afterElement);
    }
}

async function handleTouchEnd(e) {
    if (!touchElement) return;

    // If dragging was initiated
    if (touchElement.classList.contains('dragging')) {
        touchElement.classList.remove('dragging');

        // Reset element styles
        touchElement.style.position = '';
        touchElement.style.zIndex = '';
        touchElement.style.width = '';
        touchElement.style.left = '';
        touchElement.style.top = '';
        touchElement.style.pointerEvents = '';

        // Replace placeholder with the actual element
        if (touchPlaceholder && touchPlaceholder.parentNode) {
            touchPlaceholder.parentNode.insertBefore(touchElement, touchPlaceholder);
            touchPlaceholder.remove();
        }

        // Save the new order
        const list = touchElement.parentNode;
        const todoIds = Array.from(list.children)
            .filter(li => li.classList.contains('todo-item'))
            .map(li => parseInt(li.dataset.id))
            .filter(id => !isNaN(id));

        if (todoIds.length > 0) {
            try {
                isLocalReordering = true;
                await API.reorderTodos(todoIds);
                console.log('Reordered todos:', todoIds);
                // Switch to custom order mode to preserve the drag order
                document.getElementById('sort-select').value = 'custom';
                // Clear the flag after a delay to allow SSE message to arrive and be ignored
                setTimeout(() => {
                    isLocalReordering = false;
                }, 1000);
            } catch (error) {
                console.error('Failed to reorder todos:', error);
                isLocalReordering = false;
                await loadTodos();
            }
        }
    }

    touchElement = null;
    touchPlaceholder = null;
    touchStartY = 0;
    touchStartX = 0;
}

// Setup drag handlers on the list container
function setupListDragHandlers(listElement) {
    listElement.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedElement) return;

        const afterElement = getDragAfterElement(listElement, e.clientY);
        if (afterElement == null) {
            listElement.appendChild(draggedElement);
        } else {
            listElement.insertBefore(draggedElement, afterElement);
        }
    });

    listElement.addEventListener('drop', (e) => {
        e.preventDefault();
    });
}

// Sort todos
function sortTodos(todos, sortBy) {
    const sorted = [...todos];

    switch(sortBy) {
        case 'custom':
            // Sort by order_index (custom drag-and-drop order)
            sorted.sort((a, b) => a.orderIndex - b.orderIndex);
            break;
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

    // Add drag and drop handlers to the list
    setupListDragHandlers(uncompletedList);

    if (uncompletedTodos.length === 0) {
        const emptyMsg = document.createElement('li');
        emptyMsg.textContent = searchQuery ? 'No matching uncompleted todos' : 'No uncompleted todos! 🎉';
        emptyMsg.style.opacity = '0.6';
        emptyMsg.style.padding = '20px';
        emptyMsg.style.listStyle = 'none';
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
    const displayName = nameInput.value.trim();

    if (displayName) {
        const user = await createUserAndRedirect(displayName);
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

// Track if UI event listeners have been set up
let uiEventListenersSetup = false;
let currentSSE = null;

// Setup app functionality after user login
async function setupAppAfterLogin() {
    updateProfileName();

    // Load todos
    await loadTodos();

    // Close existing SSE connection if any
    if (currentSSE) {
        currentSSE.close();
    }

    // Setup real-time sync
    currentSSE = setupSSE();

    // Only set up UI event listeners once
    if (uiEventListenersSetup) {
        return;
    }
    uiEventListenersSetup = true;

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

    // Complete all uncompleted todos
    const completeAllBtn = document.getElementById('complete-all-btn');
    completeAllBtn.addEventListener('click', async () => {
        const uncompletedTodos = await API.getUncompletedTodos();
        if (uncompletedTodos.length === 0) {
            return;
        }
        if (confirm(`Mark ${uncompletedTodos.length} todo(s) as completed?`)) {
            await API.completeAllTodos();
            await loadTodos();
        }
    });

    // Clear/Delete all uncompleted todos
    const clearAllBtn = document.getElementById('clear-all-btn');
    clearAllBtn.addEventListener('click', async () => {
        const uncompletedTodos = await API.getUncompletedTodos();
        if (uncompletedTodos.length === 0) {
            return;
        }
        if (confirm(`Delete ${uncompletedTodos.length} uncompleted todo(s)? This action cannot be undone.`)) {
            await API.deleteAllUncompletedTodos();
            await loadTodos();
        }
    });
}

// Setup Server-Sent Events for real-time updates
function setupSSE() {
    let eventSource;

    function connect() {
        eventSource = new EventSource(getApiUrl('api/events'));

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
                case 'todos-reordered':
                    // Skip reload if this was a local reorder operation
                    if (!isLocalReordering) {
                        // Wait a couple frames for the database transaction to fully commit
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                loadTodos();
                            });
                        });
                    }
                    break;
                case 'todo-added':
                case 'todo-updated':
                case 'todo-toggled':
                case 'todo-deleted':
                case 'todos-completed-all':
                case 'todos-deleted-all-uncompleted':
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

    // Return an object with a close method
    return {
        close: () => {
            if (eventSource) {
                eventSource.close();
            }
        }
    };
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

// View mode management
function getViewMode() {
    // Check URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const urlView = urlParams.get('view');

    // Valid view modes
    const validModes = ['minimal', 'standard', 'advanced'];

    // If URL has a valid view parameter, use it
    if (urlView && validModes.includes(urlView)) {
        return urlView;
    }

    // Otherwise fall back to localStorage or default
    return localStorage.getItem('viewMode') || 'minimal';
}

function setViewMode(mode) {
    localStorage.setItem('viewMode', mode);
    document.body.dataset.viewMode = mode;
    updateViewModeText(mode);
}

function updateViewModeText(mode) {
    const viewModeText = document.getElementById('view-mode-text');
    const modeLabels = {
        'minimal': 'Minimal',
        'standard': 'Standard',
        'advanced': 'Advanced'
    };
    viewModeText.textContent = modeLabels[mode] || 'Advanced';
}

function cycleViewMode() {
    const currentMode = getViewMode();
    const modes = ['minimal', 'standard', 'advanced'];
    const currentIndex = modes.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];
    setViewMode(nextMode);
}

// Scale management
function getScale() {
    // Check URL parameters first
    const urlParams = new URLSearchParams(window.location.search);
    const urlScale = urlParams.get('scale');

    // Valid scale values
    const validScales = ['0.5', '1', '1.5'];

    // If URL has a valid scale parameter, use it
    if (urlScale && validScales.includes(urlScale)) {
        return urlScale;
    }

    // Otherwise fall back to localStorage or default
    return localStorage.getItem('scale') || '1';
}

function setScale(scale) {
    const scaleNum = parseFloat(scale);
    const container = document.querySelector('.container');

    if (scaleNum === 1) {
        // For 1x, remove only the specific properties we set for scaling
        localStorage.removeItem('scale');
        document.body.style.removeProperty('transform');
        document.body.style.removeProperty('transform-origin');
        document.body.style.removeProperty('width');
        document.body.style.removeProperty('min-width');
        document.body.style.removeProperty('padding');
        container.style.removeProperty('max-width');
        container.style.removeProperty('margin');
        document.documentElement.style.removeProperty('overflow-x');
    } else {
        // Save non-1x scales to localStorage
        localStorage.setItem('scale', scale);

        if (scaleNum < 1) {
            // For scales smaller than 1x, inverse scale the width to maintain same width as 1x
            document.body.style.transform = `scale(${scale})`;
            document.body.style.transformOrigin = 'top left';
            document.body.style.width = `${100 / scaleNum}vw`;
            document.body.style.removeProperty('min-width');
            document.body.style.removeProperty('padding');
            // Inverse scale the container max-width to maintain visual width
            container.style.maxWidth = `${800 / scaleNum}px`;
            container.style.removeProperty('margin'); // Keep default centered margins
            // Prevent horizontal scrolling
            document.documentElement.style.overflowX = 'hidden';
        } else {
            // For scales larger than 1x, set body width so after scaling it equals viewport
            // This allows the container to center properly within the scaled body
            document.body.style.transform = `scale(${scale})`;
            document.body.style.transformOrigin = 'top left';
            document.body.style.width = `${100 / scaleNum}vw`;
            document.body.style.removeProperty('min-width');
            document.body.style.removeProperty('padding');
            container.style.removeProperty('max-width');
            container.style.removeProperty('margin');
            document.documentElement.style.overflowX = 'hidden';
        }
    }

    updateScaleText(scale);
}

function updateScaleText(scale) {
    document.getElementById('scale-text').textContent = `${scale}x`;
}

function cycleScale() {
    const currentScale = getScale();
    const scales = ['0.5', '1', '1.5'];
    const currentIndex = scales.indexOf(currentScale);
    const nextIndex = (currentIndex + 1) % scales.length;
    const nextScale = scales[nextIndex];
    setScale(nextScale);
}

// Initialize app
async function init() {
    // Handle info notice dismissal
    const infoNotice = document.getElementById('info-notice');
    const infoCloseBtn = document.getElementById('info-close');

    // Check if notice was previously dismissed
    if (localStorage.getItem('infoNoticeDismissed') === 'true') {
        infoNotice.classList.add('hidden');
    }

    // Handle dismiss button click
    infoCloseBtn.addEventListener('click', () => {
        infoNotice.classList.add('hidden');
        localStorage.setItem('infoNoticeDismissed', 'true');
    });

    // Load theme
    const { theme } = await API.getTheme();
    document.body.dataset.theme = theme;
    document.getElementById('theme-select').value = theme;
    updateThemeEmoji(theme);

    // Load and apply view mode
    const viewMode = getViewMode();
    setViewMode(viewMode);

    // Set up view toggle button
    document.getElementById('view-toggle').addEventListener('click', () => {
        cycleViewMode();
    });

    // Load and apply scale
    const scale = getScale();
    if (scale === '1') {
        // At 1x on init, don't touch any styles - just update the text
        updateScaleText(scale);
    } else {
        setScale(scale);
    }

    // Set up scale toggle button
    document.getElementById('scale-toggle').addEventListener('click', () => {
        cycleScale();
    });

    // Set up profile dropdown
    const profileToggle = document.getElementById('profile-toggle');
    const profileMenu = document.getElementById('profile-menu');
    const profileLogoff = document.getElementById('profile-logoff');

    profileToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        profileMenu.classList.toggle('show');
    });

    profileLogoff.addEventListener('click', () => {
        clearCurrentUser();
        showNameModal();
        profileMenu.classList.remove('show');
    });

    // Close profile menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!profileToggle.contains(e.target) && !profileMenu.contains(e.target)) {
            profileMenu.classList.remove('show');
        }
    });

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

    // Handle URL path changes (when user navigates back/forward)
    window.addEventListener('popstate', async () => {
        const userId = getUserIdFromUrl();
        if (userId && userId !== currentUserId) {
            const user = await loadUserFromUrl();
            if (user) {
                hideNameModal();
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

    // Handle URL changes when user manually changes URL or clicks links
    // Check when window regains focus or becomes visible
    let lastCheckedUrl = window.location.pathname;

    async function checkUrlChange() {
        const currentUrl = window.location.pathname;
        if (currentUrl !== lastCheckedUrl) {
            lastCheckedUrl = currentUrl;

            const userId = getUserIdFromUrl();
            if (userId && userId !== currentUserId) {
                const user = await loadUserFromUrl();
                if (user) {
                    hideNameModal();
                    await setupAppAfterLogin();
                } else {
                    showNameModal();
                }
            } else if (!userId && currentUserId) {
                clearCurrentUser();
                showNameModal();
            }
        }
    }

    window.addEventListener('focus', checkUrlChange);
    window.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            checkUrlChange();
        }
    });

    // Check if user ID is in URL
    let user = await loadUserFromUrl();

    // If not in URL, check if user is remembered
    if (!user) {
        const rememberedUserId = localStorage.getItem('todoAppUserId');
        if (rememberedUserId) {
            // Try to load the remembered user
            user = await loadUserById(rememberedUserId);

            if (user) {
                // User exists, update URL to show their ID
                setUrlWithUserId(rememberedUserId);
            } else {
                // User no longer exists in database, clear localStorage
                console.log('Remembered user not found, clearing localStorage');
                localStorage.removeItem('todoAppUserId');
            }
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
