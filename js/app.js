/**
 * Planee — Main App Controller (Developer & Terminal Edition)
 * Controls user sessions, task events, filters, modals, shortcuts, and Dark/Light theme switching.
 */

document.addEventListener('DOMContentLoaded', () => {

  /* =========================================================================
   * Auth State Lifecycle
   * ====================================================================== */
  const isFileProtocol = window.location.protocol === 'file:';
  const fileWarning = document.getElementById('file-protocol-warning');
  if (isFileProtocol && fileWarning) {
    fileWarning.style.display = 'flex';
  }

  const isGuestActive = localStorage.getItem('planee_guest_active') === 'true';

  window.firebaseAuth.onAuthStateChanged(async (user) => {
    if (user) {
      localStorage.removeItem('planee_guest_active');
      await bootApp(user);
    } else if (isGuestActive) {
      await bootApp(getGuestUser());
    } else {
      showLoginScreen();
    }
  });

  function getGuestUser() {
    return {
      uid: 'guest_pilot',
      displayName: 'dev_local',
      email: 'dev@planee.local',
      photoURL: 'https://ui-avatars.com/api/?name=Dev&background=2ea043&color=fff'
    };
  }

  /* =========================================================================
   * Login / Session Screen
   * ====================================================================== */
  function showLoginScreen() {
    document.getElementById('login-screen').style.display  = 'flex';
    document.getElementById('app-screen').style.display    = 'none';
  }

  function hideLoginScreen() {
    document.getElementById('login-screen').style.display  = 'none';
    document.getElementById('app-screen').style.display    = 'flex';
  }

  document.getElementById('guest-signin-btn').addEventListener('click', async () => {
    localStorage.setItem('planee_guest_active', 'true');
    await bootApp(getGuestUser());
  });

  document.getElementById('google-signin-btn').addEventListener('click', async () => {
    const btn = document.getElementById('google-signin-btn');
    const errEl = document.getElementById('login-error');

    if (window.location.protocol === 'file:') {
      errEl.innerHTML = '⚠️ Google OAuth cannot run under <code>file://</code>. Run <b>npm start</b> in terminal, then open <b>http://localhost:8080</b> — or click <b>./launch-guest-session.sh</b> for instant access!';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span>authenticating...</span>`;
    try {
      await window.firebaseAuth.signInWithPopup(window.googleProvider);
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" class="google-icon" alt="Google"> <span>Authenticate with Google</span>`;
      errEl.textContent = 'Sign-in failed: ' + err.message;
    }
  });

  /* =========================================================================
   * Boot Application Workspace
   * ====================================================================== */
  async function bootApp(user) {
    hideLoginScreen();

    // User Avatar & Info
    const avatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'developer');
    if (avatar) avatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2ea043&color=fff`;
    if (userName) userName.textContent = displayName;
    if (userEmail) userEmail.textContent = user.email || (user.isGuest ? 'guest@planee.local' : 'developer@planee.local');

    // Loading overlay
    const overlay  = document.getElementById('loading-overlay');
    const mainContent = document.getElementById('main-content');
    overlay.style.display    = 'flex';
    mainContent.style.display = 'none';

    setSyncState('syncing');
    try {
      await window.store.init(user.uid);
    } catch (err) {
      overlay.innerHTML = `
        <div style="text-align:center; color:var(--accent-red); padding:20px; font-family:var(--font-mono);">
          <p style="font-size:14px; font-weight:700;">! ERROR: database connection failed</p>
          <p style="margin-top:6px; color:var(--text-secondary); font-size:12px;">${err.message}</p>
          <button onclick="window.firebaseAuth.signOut()" class="btn btn-outline btn-sm btn-mono" style="margin-top:14px;">exit_session()</button>
        </div>`;
      return;
    }

    setSyncState('idle');
    overlay.style.display    = 'none';
    mainContent.style.display = 'flex';

    // Real-time listener
    window.store.onDataChange(() => refreshView());

    // Initialize environment
    document.getElementById('quick-add-date').value = window.store.getDateOffset(0);
    setupTheme();
    setupEventListeners();
    refreshView();
  }

  /* =========================================================================
   * Sign Out
   * ====================================================================== */
  document.getElementById('signout-btn').addEventListener('click', async () => {
    document.getElementById('user-dropdown')?.classList.remove('open');
    document.getElementById('user-avatar-btn')?.classList.remove('active');
    document.getElementById('user-avatar-btn')?.setAttribute('aria-expanded', 'false');
    localStorage.removeItem('planee_guest_active');
    window.store._unsubscribeTasks?.();
    window.store._unsubscribeCats?.();
    window.store.tasks      = [];
    window.store.categories = [];
    window.store._changeListeners = [];
    try {
      await window.firebaseAuth.signOut();
    } catch (e) {
      // ignore
    }
    showLoginScreen();
  });

  /* =========================================================================
   * Application Filter State
   * ====================================================================== */
  const state = {
    view: 'all', category: 'all', status: 'all',
    priority: 'all', sort: 'dueDateAsc', search: '', displayMode: 'list',
    modalSubtasks: []
  };

  /* =========================================================================
   * Storage Sync Status Indicator
   * ====================================================================== */
  function setSyncState(s) {
    const ind   = document.getElementById('sync-indicator');
    const label = document.getElementById('sync-label');
    if (!ind) return;
    ind.className = `sync-indicator sync-${s}`;
    label.textContent = s === 'syncing' ? 'SYNCING...' : s === 'error' ? 'ERR_OFFLINE' : 'SYNCED';
  }

  async function withSync(fn) {
    setSyncState('syncing');
    try {
      await fn();
      setSyncState('idle');
    } catch (err) {
      setSyncState('error');
      window.ui.showToast('sync error: ' + err.message, 'error', '!');
      console.error(err);
    }
  }

  /* =========================================================================
   * View Rendering Controller
   * ====================================================================== */
  function refreshView() {
    const stats = window.store.getStatistics();
    window.ui.renderProductivityWidget(stats);
    window.ui.populateCategorySelects(state.category !== 'all' ? state.category : 'office');
    window.ui.renderCategoryList(state.category, (catId) => {
      state.category = state.category === catId ? 'all' : catId;
      updateHeaderTitles();
      refreshView();
    });

    const tasks = window.store.getFilteredTasks({
      view: state.view, category: state.category, status: state.status,
      priority: state.priority, search: state.search, sort: state.sort
    });

    const viewList   = document.getElementById('view-list');
    const viewKanban = document.getElementById('view-kanban');
    const viewAgenda = document.getElementById('view-agenda');
    const emptyState = document.getElementById('empty-state');

    if (tasks.length === 0) {
      emptyState.style.display = 'flex';
      viewList.style.display = viewKanban.style.display = viewAgenda.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      viewList.style.display   = state.displayMode === 'list'   ? 'block' : 'none';
      viewKanban.style.display = state.displayMode === 'kanban' ? 'block' : 'none';
      viewAgenda.style.display = state.displayMode === 'agenda' ? 'block' : 'none';
      if      (state.displayMode === 'list')   window.ui.renderListView(tasks, state.view);
      else if (state.displayMode === 'kanban') window.ui.renderKanbanView(tasks);
      else                                     window.ui.renderAgendaView(tasks);
    }
  }

  function updateHeaderTitles() {
    const titleEl = document.getElementById('current-view-title');
    const subEl   = document.getElementById('current-view-subtitle');
    if (!titleEl) return;
    if (state.category !== 'all') {
      const cat = window.store.getCategoryById(state.category);
      titleEl.innerHTML = `${cat.icon} ${window.ui.escapeHTML(cat.name)}`;
      subEl.textContent = `filter: category == "${cat.id}"`;
      return;
    }
    const map = {
      all:       ['all_tasks',     'Complete listing of active and scheduled tasks'],
      today:     ['due_today',     'Items scheduled with deadline for today'],
      upcoming:  ['upcoming',      'Items scheduled for upcoming days/weeks'],
      overdue:   ['overdue',       'Items past deadline requiring immediate resolution'],
      completed: ['completed',     'Historical archive of closed task records'],
    };
    const [title, sub] = map[state.view] || map.all;
    titleEl.textContent = title;
    subEl.textContent   = sub;
  }

  /* =========================================================================
   * Event Listeners Registration
   * ====================================================================== */
  function setupEventListeners() {

    // Quick Add Form
    document.getElementById('quick-add-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('quick-add-input').value.trim();
      if (!title) return;
      await withSync(async () => {
        const catId = document.getElementById('quick-add-category').value || 'office';
        await window.store.addTask({
          title, categoryId: catId,
          priority: document.getElementById('quick-add-priority').value || 'medium',
          dueDate:  document.getElementById('quick-add-date').value || window.store.getDateOffset(0)
        });
        document.getElementById('quick-add-input').value = '';
        window.ui.showToast(`created task in [${window.store.getCategoryById(catId).name}]`, 'info', '+');
      });
    });

    // Global Search
    let searchTimer;
    document.getElementById('global-search').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = e.target.value;
        document.getElementById('clear-search-btn').style.display = state.search ? 'flex' : 'none';
        refreshView();
      }, 120);
    });
    document.getElementById('clear-search-btn').addEventListener('click', () => {
      const gs = document.getElementById('global-search');
      gs.value = ''; state.search = '';
      document.getElementById('clear-search-btn').style.display = 'none';
      refreshView(); gs.focus();
    });

    // Sidebar Navigation
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        state.view = item.getAttribute('data-view');
        state.category = 'all';
        updateHeaderTitles();
        refreshView();
        if (window.innerWidth <= 900) document.getElementById('app-sidebar').classList.remove('open');
      });
    });

    // Status Filter Pills
    document.getElementById('status-filters').addEventListener('click', (e) => {
      const pill = e.target.closest('.pill');
      if (!pill) return;
      document.querySelectorAll('#status-filters .pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.status = pill.getAttribute('data-status');
      refreshView();
    });

    // Priority & Sort Dropdowns
    document.getElementById('priority-filter-select').addEventListener('change', (e) => {
      state.priority = e.target.value;
      refreshView();
    });
    document.getElementById('sort-select').addEventListener('change', (e) => {
      state.sort = e.target.value;
      refreshView();
    });

    // View Switcher (list, board, timeline)
    document.querySelectorAll('.view-switch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-switch-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        state.displayMode = btn.getAttribute('data-display-mode');
        refreshView();
      });
    });

    // Task Card Actions
    document.addEventListener('click', async (e) => {
      // Toggle task complete / closed
      const checkBtn = e.target.closest('.task-checkbox-btn');
      if (checkBtn) {
        e.stopPropagation();
        const card = checkBtn.closest('.task-card');
        const taskId = card?.getAttribute('data-task-id');
        if (!taskId) return;
        await withSync(async () => {
          const result = await window.store.toggleTaskComplete(taskId);
          if (result?.updated?.completed) {
            window.ui.showToast('task marked as closed', 'info', '✓');
          } else {
            window.ui.showToast('task marked as open', 'info', '○');
          }
        });
        return;
      }

      // Quick Delete
      const delBtn = e.target.closest('.task-action-btn.btn-delete');
      if (delBtn) {
        e.stopPropagation();
        const taskId = delBtn.closest('.task-card')?.getAttribute('data-task-id');
        if (taskId && confirm('Delete this task record?')) {
          await withSync(() => window.store.deleteTask(taskId));
          window.ui.showToast('task record deleted', 'info', 'x');
        }
        return;
      }

      // Open Edit Modal
      const editBtn  = e.target.closest('.task-action-btn.btn-edit');
      const cardMain = e.target.closest('.task-main-info');
      const kanCard  = e.target.closest('.kanban-card');
      if (editBtn || cardMain || (kanCard && !e.target.closest('.kanban-status-select'))) {
        const card   = editBtn ? editBtn.closest('.task-card') : (cardMain ? cardMain.closest('.task-card') : kanCard);
        const taskId = card?.getAttribute('data-task-id');
        if (taskId) openTaskModal(taskId);
        return;
      }
    });

    // Kanban Status Select
    document.addEventListener('change', async (e) => {
      if (!e.target.classList.contains('kanban-status-select')) return;
      const taskId = e.target.getAttribute('data-task-id');
      const newStatus = e.target.value;
      await withSync(async () => {
        await window.store.updateTask(taskId, { status: newStatus });
        window.ui.showToast(`status -> ${newStatus}`, 'info', '>');
      });
    });

    // New Task Buttons
    document.getElementById('new-task-btn').addEventListener('click', () => openTaskModal(null));
    document.getElementById('empty-add-btn').addEventListener('click', () => openTaskModal(null));
    document.getElementById('empty-clear-filter-btn').addEventListener('click', resetFilters);

    // Task Modal Handlers
    document.getElementById('close-task-modal-btn').addEventListener('click',  closeTaskModal);
    document.getElementById('cancel-task-modal-btn').addEventListener('click', closeTaskModal);
    document.getElementById('task-modal').addEventListener('click', (e) => {
      if (e.target.id === 'task-modal') closeTaskModal();
    });

    document.getElementById('task-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveTaskModal();
    });

    document.getElementById('delete-task-btn').addEventListener('click', async () => {
      const id = document.getElementById('task-form-id').value;
      if (!id || !confirm('Permanently delete this task record?')) return;
      await withSync(() => window.store.deleteTask(id));
      window.ui.showToast('task deleted', 'info', 'x');
      closeTaskModal();
    });

    // Subtasks
    document.getElementById('add-subtask-btn').addEventListener('click', addSubtaskItem);
    document.getElementById('new-subtask-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addSubtaskItem(); }
    });

    // Category Modal
    document.getElementById('add-category-btn').addEventListener('click', () => {
      document.getElementById('cat-name-input').value = '';
      document.getElementById('category-modal').style.display = 'flex';
      document.getElementById('cat-name-input').focus();
    });
    ['close-category-modal-btn', 'cancel-category-btn'].forEach(id => {
      document.getElementById(id).addEventListener('click', () => document.getElementById('category-modal').style.display = 'none');
    });
    document.getElementById('category-modal').addEventListener('click', (e) => {
      if (e.target.id === 'category-modal') document.getElementById('category-modal').style.display = 'none';
    });

    document.getElementById('emoji-picker').addEventListener('click', (e) => {
      const btn = e.target.closest('.emoji-btn');
      if (!btn) return;
      document.querySelectorAll('#emoji-picker .emoji-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    document.getElementById('color-picker').addEventListener('click', (e) => {
      const sw = e.target.closest('.color-swatch');
      if (!sw) return;
      document.querySelectorAll('#color-picker .color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
    });

    document.getElementById('category-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name  = document.getElementById('cat-name-input').value.trim();
      if (!name) return;
      const icon  = document.querySelector('#emoji-picker .emoji-btn.active')?.getAttribute('data-emoji')   || '📁';
      const color = document.querySelector('#color-picker .color-swatch.active')?.getAttribute('data-color') || '#58a6ff';
      await withSync(async () => {
        const cat = await window.store.addCategory(name, icon, color);
        document.getElementById('category-modal').style.display = 'none';
        window.ui.showToast(`category [${cat.name}] created`, 'info', '+');
      });
    });

    // Data Export Modal
    document.getElementById('data-manager-btn').addEventListener('click', () => {
      document.getElementById('data-modal').style.display = 'flex';
    });
    document.getElementById('close-data-modal-btn').addEventListener('click', () => {
      document.getElementById('data-modal').style.display = 'none';
    });
    document.getElementById('data-modal').addEventListener('click', (e) => {
      if (e.target.id === 'data-modal') document.getElementById('data-modal').style.display = 'none';
    });

    document.getElementById('export-json-btn').addEventListener('click', () => {
      window.store.exportJSON();
      window.ui.showToast('snapshot downloaded', 'info', 'v');
    });

    document.getElementById('clear-completed-btn').addEventListener('click', async () => {
      if (!confirm('Permanently delete all closed tasks?')) return;
      await withSync(async () => {
        const n = await window.store.clearCompleted();
        window.ui.showToast(`pruned ${n} completed tasks`, 'info', 'x');
        document.getElementById('data-modal').style.display = 'none';
      });
    });

    // Seed Demo Data
    document.getElementById('load-demo-btn').addEventListener('click', async () => {
      if (!confirm('Populate workspace with sample Office and Personal task records?')) return;
      await withSync(async () => {
        await window.store.loadDemoData();
        window.ui.showToast('sample records seeded', 'info', '*');
      });
    });

    // Theme Toggle Button
    document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);

    // User Profile Dropdown Toggle
    const userAvatarBtn = document.getElementById('user-avatar-btn');
    const userDropdown = document.getElementById('user-dropdown');
    if (userAvatarBtn && userDropdown) {
      userAvatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = userDropdown.classList.toggle('open');
        userAvatarBtn.classList.toggle('active', isOpen);
        userAvatarBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      });

      // Prevent clicks inside the dropdown from closing it prematurely
      userDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      // Close dropdown when clicking anywhere outside
      document.addEventListener('click', () => {
        userDropdown.classList.remove('open');
        userAvatarBtn.classList.remove('active');
        userAvatarBtn.setAttribute('aria-expanded', 'false');
      });
    }

    // Sidebar Toggle (Desktop Collapse & Mobile Drawer)
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebar = document.getElementById('app-sidebar');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');

    if (sidebarToggleBtn && sidebar) {
      sidebarToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isMobile = window.innerWidth <= 900;
        if (isMobile) {
          const isOpen = sidebar.classList.toggle('open');
          if (sidebarBackdrop) sidebarBackdrop.classList.toggle('active', isOpen);
        } else {
          const isCollapsed = sidebar.classList.toggle('collapsed');
          sidebarToggleBtn.classList.toggle('active', isCollapsed);
        }
      });

      if (sidebarBackdrop) {
        sidebarBackdrop.addEventListener('click', () => {
          sidebar.classList.remove('open');
          sidebarBackdrop.classList.remove('active');
        });
      }

      // Close mobile drawer when clicking a navigation link or category
      sidebar.addEventListener('click', (e) => {
        if (window.innerWidth <= 900 && (e.target.closest('.nav-item') || e.target.closest('.category-item'))) {
          sidebar.classList.remove('open');
          if (sidebarBackdrop) sidebarBackdrop.classList.remove('active');
        }
      });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
      if (e.key === '/' && !inInput)                   { e.preventDefault(); document.getElementById('global-search').focus(); }
      if (e.key === 'Escape') {
        closeTaskModal();
        document.getElementById('category-modal').style.display = 'none';
        document.getElementById('data-modal').style.display = 'none';
        userDropdown?.classList.remove('open');
        userAvatarBtn?.classList.remove('active');
        userAvatarBtn?.setAttribute('aria-expanded', 'false');
        if (sidebar && window.innerWidth <= 900) {
          sidebar.classList.remove('open');
          sidebarBackdrop?.classList.remove('active');
        }
      }
      if ((e.key === 'n' || e.key === 'N') && !inInput) { e.preventDefault(); openTaskModal(null); }
    });
  }

  /* =========================================================================
   * Subtask Management Helpers
   * ====================================================================== */
  function addSubtaskItem() {
    const input = document.getElementById('new-subtask-input');
    const title = input.value.trim();
    if (!title) return;
    state.modalSubtasks.push({ id: 'st_' + Date.now(), title, completed: false });
    input.value = '';
    renderModalSubtasks();
    input.focus();
  }

  function renderModalSubtasks() {
    const listEl = document.getElementById('subtask-list');
    if (!listEl) return;
    listEl.innerHTML = state.modalSubtasks.map((st, idx) => `
      <div class="subtask-item ${st.completed ? 'completed' : ''}">
        <input type="checkbox" data-subtask-idx="${idx}" ${st.completed ? 'checked' : ''}>
        <span class="subtask-item-title">${window.ui.escapeHTML(st.title)}</span>
        <button type="button" class="subtask-delete-btn" data-delete-idx="${idx}">&times;</button>
      </div>`).join('');

    const done = state.modalSubtasks.filter(s => s.completed).length;
    const countEl = document.getElementById('subtask-completion-count');
    if (countEl) countEl.textContent = `${done}/${state.modalSubtasks.length}`;

    listEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        state.modalSubtasks[+e.target.getAttribute('data-subtask-idx')].completed = e.target.checked;
        renderModalSubtasks();
      });
    });
    listEl.querySelectorAll('.subtask-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.modalSubtasks.splice(+btn.getAttribute('data-delete-idx'), 1);
        renderModalSubtasks();
      });
    });
  }

  /* =========================================================================
   * Task Modal Form Handlers
   * ====================================================================== */
  function openTaskModal(taskId) {
    window.ui.populateCategorySelects(state.category !== 'all' ? state.category : 'office');
    const delBtn = document.getElementById('delete-task-btn');

    if (taskId) {
      const task = window.store.getTaskById(taskId);
      if (!task) return;
      document.getElementById('modal-task-title').textContent          = `task_details: #${task.id.slice(-6)}`;
      document.getElementById('task-form-id').value                    = task.id;
      document.getElementById('task-form-title').value                 = task.title;
      document.getElementById('task-form-category').value              = task.categoryId;
      document.getElementById('task-form-priority').value              = task.priority;
      document.getElementById('task-form-due-date').value              = task.dueDate || window.store.getDateOffset(0);
      document.getElementById('task-form-due-time').value              = task.dueTime || '';
      document.getElementById('task-form-description').value           = task.description || '';
      document.getElementById('task-form-tags').value                  = (task.tags || []).join(', ');
      state.modalSubtasks = JSON.parse(JSON.stringify(task.subtasks || []));
      delBtn.style.display = 'inline-flex';
    } else {
      document.getElementById('modal-task-title').textContent          = 'new_task';
      document.getElementById('task-form-id').value                    = '';
      document.getElementById('task-form-title').value                 = '';
      document.getElementById('task-form-category').value              = state.category !== 'all' ? state.category : 'office';
      document.getElementById('task-form-priority').value              = 'medium';
      document.getElementById('task-form-due-date').value              = window.store.getDateOffset(0);
      document.getElementById('task-form-due-time').value              = '';
      document.getElementById('task-form-description').value           = '';
      document.getElementById('task-form-tags').value                  = '';
      state.modalSubtasks = [];
      delBtn.style.display = 'none';
    }

    renderModalSubtasks();
    document.getElementById('task-modal').style.display = 'flex';
    document.getElementById('task-form-title').focus();
  }

  function closeTaskModal() {
    document.getElementById('task-modal').style.display = 'none';
  }

  async function saveTaskModal() {
    const id          = document.getElementById('task-form-id').value;
    const title       = document.getElementById('task-form-title').value.trim();
    const categoryId  = document.getElementById('task-form-category').value;
    const priority    = document.getElementById('task-form-priority').value;
    const dueDate     = document.getElementById('task-form-due-date').value;
    const dueTime     = document.getElementById('task-form-due-time').value;
    const description = document.getElementById('task-form-description').value.trim();
    const tags        = document.getElementById('task-form-tags').value.split(',').map(t => t.trim()).filter(Boolean);
    if (!title) return;

    const saveBtn = document.getElementById('save-task-btn');
    saveBtn.disabled = true;
    await withSync(async () => {
      if (id) {
        await window.store.updateTask(id, { title, categoryId, priority, dueDate, dueTime, description, subtasks: state.modalSubtasks, tags });
        window.ui.showToast('task updated', 'info', '✓');
      } else {
        await window.store.addTask({ title, categoryId, priority, dueDate, dueTime, description, subtasks: state.modalSubtasks, tags });
        window.ui.showToast('new task created', 'info', '+');
      }
    });
    saveBtn.disabled = false;
    closeTaskModal();
  }

  /* =========================================================================
   * Reset Filters
   * ====================================================================== */
  function resetFilters() {
    state.view = 'all'; state.category = 'all'; state.status = 'all'; state.priority = 'all'; state.search = '';
    document.getElementById('global-search').value = '';
    document.getElementById('clear-search-btn').style.display = 'none';
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(i => i.classList.toggle('active', i.getAttribute('data-view') === 'all'));
    document.querySelectorAll('#status-filters .pill').forEach(p => p.classList.toggle('active', p.getAttribute('data-status') === 'all'));
    document.getElementById('priority-filter-select').value = 'all';
    updateHeaderTitles();
    refreshView();
  }

  /* =========================================================================
   * Developer Theme Controller (Dark & Light Mode)
   * ====================================================================== */
  function setupTheme() {
    const saved = localStorage.getItem('planee_theme') || 'dark';
    applyTheme(saved);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('planee_theme', next);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('theme-label-icon');
    const text = document.getElementById('theme-label-text');
    if (icon && text) {
      if (theme === 'dark') {
        icon.textContent = '☀️';
        text.textContent = 'LIGHT';
      } else {
        icon.textContent = '🌙';
        text.textContent = 'DARK';
      }
    }
  }

});
