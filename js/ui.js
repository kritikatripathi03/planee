/**
 * Planee — UI Rendering & View Engine (Developer / Terminal Edition)
 * Manages DOM updates, task cards, kanban pipeline, timeline agenda,
 * category lists, and developer notifications.
 */

class PlaneeUI {
  constructor() {
    this.toastContainer = document.getElementById('toast-container');
  }

  // Helper: Format Date for Terminal Display
  formatDueDateBadge(dueDate, dueTime) {
    if (!dueDate) return { text: 'due: unassigned', className: 'no-date', isOverdue: false };

    const todayStr = window.store.getDateOffset(0);
    const tomorrowStr = window.store.getDateOffset(1);
    const yesterdayStr = window.store.getDateOffset(-1);

    let label = '';
    let className = 'upcoming';
    let isOverdue = false;

    if (dueDate === todayStr) {
      label = 'due: today';
      className = 'today';
    } else if (dueDate === tomorrowStr) {
      label = 'due: tomorrow';
      className = 'upcoming';
    } else if (dueDate === yesterdayStr) {
      label = 'overdue: -1d';
      className = 'overdue';
      isOverdue = true;
    } else if (dueDate < todayStr) {
      const diffMs = new Date(todayStr).getTime() - new Date(dueDate).getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      label = `overdue: -${diffDays}d`;
      className = 'overdue';
      isOverdue = true;
    } else {
      label = `due: ${dueDate}`;
      className = 'upcoming';
    }

    if (dueTime) {
      label += ` @ ${dueTime}`;
    }

    return { text: label, className, isOverdue };
  }

  formatPriority(priority) {
    switch (priority) {
      case 'urgent': return { label: '!CRIT', class: 'urgent' };
      case 'high':   return { label: '!HIGH', class: 'high' };
      case 'medium': return { label: '!MED',  class: 'medium' };
      case 'low':
      default:       return { label: '!LOW',  class: 'low' };
    }
  }

  // --- Render Categories in Sidebar ---
  renderCategoryList(activeCategoryId, onSelectCategory) {
    const listEl = document.getElementById('category-list');
    if (!listEl) return;

    const categories = window.store.getCategories();
    const stats = window.store.getStatistics();

    listEl.innerHTML = categories.map(cat => {
      const isActive = activeCategoryId === cat.id;
      const count = stats.categoryCounts[cat.id] || 0;
      return `
        <button class="cat-item ${isActive ? 'active' : ''}" data-cat-id="${cat.id}" style="--cat-accent: ${cat.color}">
          <span class="cat-icon-badge">${cat.icon}</span>
          <span class="cat-name">${this.escapeHTML(cat.name)}</span>
          <span class="cat-count">${count}</span>
        </button>
      `;
    }).join('');

    listEl.querySelectorAll('.cat-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.getAttribute('data-cat-id');
        onSelectCategory(catId);
      });
    });
  }

  // --- Render Category Select Dropdowns ---
  populateCategorySelects(selectedId = 'office') {
    const selects = [
      document.getElementById('quick-add-category'),
      document.getElementById('task-form-category')
    ];

    const categories = window.store.getCategories();

    selects.forEach(sel => {
      if (!sel) return;
      sel.innerHTML = categories.map(c => `
        <option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>
          ${c.icon} ${this.escapeHTML(c.name)}
        </option>
      `).join('');
    });
  }

  // --- Render Developer Task Card ---
  createTaskCardHTML(task) {
    const category = window.store.getCategoryById(task.categoryId);
    const dateBadge = this.formatDueDateBadge(task.dueDate, task.dueTime);
    const completedSubtasks = (task.subtasks || []).filter(st => st.completed).length;
    const totalSubtasks = (task.subtasks || []).length;
    const pri = this.formatPriority(task.priority);

    const isOverdue = !task.completed && dateBadge.isOverdue;

    return `
      <div class="task-card ${task.completed ? 'is-completed' : ''} ${isOverdue ? 'is-overdue' : ''} priority-${task.priority}" data-task-id="${task.id}">
        <!-- Checkbox -->
        <div class="task-checkbox-container">
          <button class="task-checkbox-btn" title="${task.completed ? 'Mark Open' : 'Mark Closed'}" aria-label="Toggle task status">
            <svg viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
        </div>

        <!-- Task Info -->
        <div class="task-main-info" title="Click to view details and edit">
          <div class="task-title-line">
            <span class="task-hash-id">#${this.escapeHTML(String(task.id).slice(-4).toUpperCase())}</span>
            <span class="task-title">${this.escapeHTML(task.title)}</span>
            <span class="priority-tag ${pri.class}">${pri.label}</span>
          </div>

          <div class="task-meta-line">
            <!-- Category Tag -->
            <span class="category-pill" style="--cat-bg: ${this.hexToRgba(category.color, 0.12)}; --cat-color: ${category.color}">
              <span class="category-pill-icon">${category.icon}</span>
              <span>${this.escapeHTML(category.name)}</span>
            </span>

            <!-- Due Date Badge -->
            <span class="due-badge ${dateBadge.className}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 15"/></svg>
              <span>${dateBadge.text}</span>
            </span>

            <!-- Subtasks Count if any -->
            ${totalSubtasks > 0 ? `
              <span class="subtask-badge" title="${completedSubtasks} of ${totalSubtasks} subtasks completed">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
                <span>[${completedSubtasks}/${totalSubtasks}]</span>
              </span>
            ` : ''}

            <!-- Tags -->
            ${(task.tags || []).map(t => `<span class="nav-count">#${this.escapeHTML(t)}</span>`).join('')}
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="task-actions">
          <button class="task-action-btn btn-edit" title="Edit Task" aria-label="Edit task">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="task-action-btn btn-delete" title="Delete Task" aria-label="Delete task">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
  }

  // --- Render List View ---
  renderListView(tasks, viewFilter) {
    const container = document.getElementById('task-groups-container');
    if (!container) return;

    if (tasks.length === 0) {
      container.innerHTML = '';
      return;
    }

    const todayStr = window.store.getDateOffset(0);

    if (viewFilter === 'today' || viewFilter === 'overdue' || viewFilter === 'completed') {
      container.innerHTML = `
        <div class="task-list">
          ${tasks.map(t => this.createTaskCardHTML(t)).join('')}
        </div>
      `;
      return;
    }

    const overdueTasks = tasks.filter(t => !t.completed && t.dueDate < todayStr);
    const todayTasks = tasks.filter(t => !t.completed && t.dueDate === todayStr);
    const upcomingTasks = tasks.filter(t => !t.completed && t.dueDate > todayStr);
    const completedTasks = tasks.filter(t => t.completed);

    let html = '';

    if (overdueTasks.length > 0) {
      html += `
        <div class="task-group">
          <div class="task-group-header">
            <span class="task-group-title text-danger">! overdue_records</span>
            <span class="task-group-badge badge-red">${overdueTasks.length}</span>
          </div>
          <div class="task-list">
            ${overdueTasks.map(t => this.createTaskCardHTML(t)).join('')}
          </div>
        </div>
      `;
    }

    if (todayTasks.length > 0) {
      html += `
        <div class="task-group">
          <div class="task-group-header">
            <span class="task-group-title text-amber">* due_today</span>
            <span class="task-group-badge badge-amber">${todayTasks.length}</span>
          </div>
          <div class="task-list">
            ${todayTasks.map(t => this.createTaskCardHTML(t)).join('')}
          </div>
        </div>
      `;
    }

    if (upcomingTasks.length > 0) {
      html += `
        <div class="task-group">
          <div class="task-group-header">
            <span class="task-group-title">&gt; upcoming_schedule</span>
            <span class="task-group-badge">${upcomingTasks.length}</span>
          </div>
          <div class="task-list">
            ${upcomingTasks.map(t => this.createTaskCardHTML(t)).join('')}
          </div>
        </div>
      `;
    }

    if (completedTasks.length > 0) {
      html += `
        <div class="task-group">
          <div class="task-group-header">
            <span class="task-group-title text-green"># closed_records</span>
            <span class="task-group-badge">${completedTasks.length}</span>
          </div>
          <div class="task-list">
            ${completedTasks.map(t => this.createTaskCardHTML(t)).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  // --- Render Kanban Board View ---
  renderKanbanView(tasks) {
    const todoCards = document.getElementById('kanban-cards-todo');
    const inProgCards = document.getElementById('kanban-cards-in_progress');
    const completedCards = document.getElementById('kanban-cards-completed');

    if (!todoCards || !inProgCards || !completedCards) return;

    const todoTasks = tasks.filter(t => !t.completed && (t.status === 'todo' || !t.status));
    const inProgressTasks = tasks.filter(t => !t.completed && t.status === 'in_progress');
    const doneTasks = tasks.filter(t => t.completed || t.status === 'completed');

    document.getElementById('kanban-count-todo').textContent = todoTasks.length;
    document.getElementById('kanban-count-in_progress').textContent = inProgressTasks.length;
    document.getElementById('kanban-count-completed').textContent = doneTasks.length;

    const renderCard = (t) => {
      const cat = window.store.getCategoryById(t.categoryId);
      const dateBadge = this.formatDueDateBadge(t.dueDate, t.dueTime);
      const pri = this.formatPriority(t.priority);
      return `
        <div class="kanban-card priority-${t.priority}" data-task-id="${t.id}">
          <div class="kanban-card-top">
            <span class="category-pill" style="--cat-bg: ${this.hexToRgba(cat.color, 0.12)}; --cat-color: ${cat.color}">
              <span>${cat.icon}</span>
              <span>${this.escapeHTML(cat.name)}</span>
            </span>
            <span class="priority-tag ${pri.class}">${pri.label}</span>
          </div>
          <div class="kanban-card-title">${this.escapeHTML(t.title)}</div>
          <div class="kanban-card-footer">
            <span class="due-badge ${dateBadge.className}">
              ${dateBadge.text}
            </span>
            <select class="kanban-status-select" data-task-id="${t.id}" title="Move status">
              <option value="todo" ${(!t.completed && (t.status === 'todo' || !t.status)) ? 'selected' : ''}>to_do</option>
              <option value="in_progress" ${(!t.completed && t.status === 'in_progress') ? 'selected' : ''}>in_progress</option>
              <option value="completed" ${t.completed ? 'selected' : ''}>completed</option>
            </select>
          </div>
        </div>
      `;
    };

    todoCards.innerHTML = todoTasks.map(renderCard).join('');
    inProgCards.innerHTML = inProgressTasks.map(renderCard).join('');
    completedCards.innerHTML = doneTasks.map(renderCard).join('');
  }

  // --- Render Schedule / Timeline View ---
  renderAgendaView(tasks) {
    const container = document.getElementById('agenda-container');
    if (!container) return;

    if (tasks.length === 0) {
      container.innerHTML = '';
      return;
    }

    const dateGroups = {};
    tasks.forEach(t => {
      const dateKey = t.dueDate || 'Unassigned';
      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = [];
      }
      dateGroups[dateKey].push(t);
    });

    const sortedDates = Object.keys(dateGroups).sort();
    const todayStr = window.store.getDateOffset(0);

    let html = '';
    sortedDates.forEach(date => {
      let dateTitle = date;
      let badgeStyle = '';
      if (date === todayStr) {
        dateTitle = `* today (${date})`;
        badgeStyle = 'badge-amber';
      } else if (date < todayStr && date !== 'Unassigned') {
        dateTitle = `! overdue (${date})`;
        badgeStyle = 'badge-red';
      } else if (date !== 'Unassigned') {
        dateTitle = `> ${date}`;
      }

      html += `
        <div class="agenda-day-block">
          <div class="agenda-day-header">
            <h3 class="agenda-day-title">${dateTitle}</h3>
            <span class="nav-count ${badgeStyle}">${dateGroups[date].length} items</span>
          </div>
          <div class="task-list">
            ${dateGroups[date].map(t => this.createTaskCardHTML(t)).join('')}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  // --- Render Productivity Summary Widget ---
  renderProductivityWidget(stats) {
    const fill = document.getElementById('widget-progress-fill');
    const pct = document.getElementById('widget-progress-pct');
    const done = document.getElementById('widget-stat-done');
    const pending = document.getElementById('widget-stat-pending');
    const overdue = document.getElementById('widget-stat-overdue');

    if (fill) fill.style.width = `${stats.rate}%`;
    if (pct) pct.textContent = `${stats.rate}%`;
    if (done) done.textContent = stats.completed;
    if (pending) pending.textContent = stats.active;
    if (overdue) overdue.textContent = stats.overdue;

    // Sidebar badge counters
    const countAll = document.getElementById('count-all');
    const countToday = document.getElementById('count-today');
    const countUpcoming = document.getElementById('count-upcoming');
    const countOverdue = document.getElementById('count-overdue');
    const countCompleted = document.getElementById('count-completed');

    if (countAll) countAll.textContent = stats.total;
    if (countToday) countToday.textContent = stats.dueToday;
    if (countUpcoming) countUpcoming.textContent = stats.upcoming;
    if (countOverdue) countOverdue.textContent = stats.overdue;
    if (countCompleted) countCompleted.textContent = stats.completed;

    // Terminal Telemetry Grid
    const telTotal = document.getElementById('telemetry-total');
    const telActive = document.getElementById('telemetry-active');
    const telToday = document.getElementById('telemetry-today');
    const telRate = document.getElementById('telemetry-rate');
    const telAscii = document.getElementById('telemetry-ascii-rate');

    if (telTotal) telTotal.textContent = stats.total;
    if (telActive) telActive.textContent = stats.active;
    if (telToday) telToday.textContent = stats.dueToday;
    if (telRate) telRate.textContent = `${stats.rate}%`;
    if (telAscii) {
      const filled = Math.min(10, Math.max(0, Math.round(stats.rate / 10)));
      telAscii.textContent = `[${'▓'.repeat(filled)}${'░'.repeat(10 - filled)}]`;
    }
  }

  // --- Toast Notifications ---
  showToast(message, type = 'info', icon = '>') {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon mono-font">${icon}</span>
      <span class="toast-message">${this.escapeHTML(message)}</span>
    `;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  // --- Utilities ---
  hexToRgba(hex, alpha = 1) {
    if (!hex) return `rgba(88, 166, 255, ${alpha})`;
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  }

  escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

window.ui = new PlaneeUI();
