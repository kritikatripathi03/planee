/**
 * Planee — Developer Task & Category Store
 * Handles Firestore cloud sync with automatic local-storage fallback for guest/offline sessions.
 *
 * Data Model:
 *   /users/{uid}/tasks/{taskId}
 *   /users/{uid}/categories/{catId}
 */

class PlaneeStore {
  constructor() {
    this.db                 = window.firestoreDb;
    this.uid                = null;
    this.categories         = [];
    this.tasks              = [];
    this._changeListeners   = [];
    this._unsubscribeTasks  = null;
    this._unsubscribeCats   = null;
  }

  /* -------------------------------------------------------------------------
   * Collection References
   * ---------------------------------------------------------------------- */
  _tasksRef()      { return this.db.collection('users').doc(this.uid).collection('tasks'); }
  _categoriesRef() { return this.db.collection('users').doc(this.uid).collection('categories'); }

  /* -------------------------------------------------------------------------
   * Initialisation
   * ---------------------------------------------------------------------- */
  async init(uid) {
    this.uid = uid;

    this._unsubscribeTasks?.();
    this._unsubscribeCats?.();

    if (this.uid === 'guest_pilot') {
      this._loadGuestData();
      return;
    }

    try {
      await this._seedDefaultCategories();
      await this._setupListeners();
    } catch (err) {
      console.warn('Firestore initialization failed, falling back to local storage:', err);
      this._loadGuestData();
    }
  }

  onDataChange(fn) { this._changeListeners.push(fn); }
  _notifyListeners() { this._changeListeners.forEach(fn => fn()); }

  /* -------------------------------------------------------------------------
   * Real-time listeners
   * ---------------------------------------------------------------------- */
  async _setupListeners() {
    return new Promise((resolve) => {
      let catsReady = false, tasksReady = false;
      const checkReady = () => { if (catsReady && tasksReady) resolve(); };

      // Categories
      this._unsubscribeCats = this._categoriesRef()
        .orderBy('isDefault', 'desc')
        .onSnapshot(snap => {
          this.categories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          if (!catsReady) { catsReady = true; checkReady(); }
          else             this._notifyListeners();
        }, err => {
          console.warn('Categories listener error, using fallback:', err);
          this._loadGuestData();
          resolve();
        });

      // Tasks
      this._unsubscribeTasks = this._tasksRef()
        .orderBy('createdAt', 'desc')
        .onSnapshot(snap => {
          this.tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          if (!tasksReady) { tasksReady = true; checkReady(); }
          else              this._notifyListeners();
        }, err => {
          console.warn('Tasks listener error, using fallback:', err);
          this._loadGuestData();
          resolve();
        });
    });
  }

  /* -------------------------------------------------------------------------
   * Local Guest / Offline Storage Engine
   * ---------------------------------------------------------------------- */
  _loadGuestData() {
    // Categories
    const localCats = localStorage.getItem('planee_categories_v3');
    if (localCats) {
      this.categories = JSON.parse(localCats);
    } else {
      this.categories = [
        { id: 'office',   name: 'Office Work',       icon: '💼', color: '#58a6ff', isDefault: true  },
        { id: 'personal', name: 'Personal',           icon: '🏠', color: '#2ea043', isDefault: true  },
        { id: 'study',    name: 'Learning & Docs',    icon: '📚', color: '#d29922', isDefault: false },
        { id: 'devops',   name: 'Infra & DevOps',     icon: '🔧', color: '#38bdf8', isDefault: false },
        { id: 'errands',  name: 'Errands',            icon: '🛒', color: '#8b949e', isDefault: false },
      ];
      localStorage.setItem('planee_categories_v3', JSON.stringify(this.categories));
    }

    // Tasks
    const localTasks = localStorage.getItem('planee_tasks_v3');
    if (localTasks) {
      this.tasks = JSON.parse(localTasks);
    } else {
      this._seedLocalDemoData();
    }

    this._notifyListeners();
  }

  _seedLocalDemoData() {
    const today     = this.getDateOffset(0);
    const yesterday = this.getDateOffset(-1);
    const tomorrow  = this.getDateOffset(1);
    const dayAfter  = this.getDateOffset(3);
    const nextWeek  = this.getDateOffset(7);

    this.tasks = [
      { id: 'task_1', title: 'Prepare Q3 Architecture & RFC Migration Spec', categoryId: 'office', priority: 'urgent', dueDate: today, dueTime: '15:00', description: 'Review schema changes with infra team and verify zero-downtime replication strategy.', subtasks: [{ id: 'st1', title: 'Run DB benchmark', completed: true }, { id: 'st2', title: 'Review pull request with team lead', completed: false }], tags: ['architecture', 'rfc'], status: 'in_progress', completed: false, completedAt: null, createdAt: new Date().toISOString() },
      { id: 'task_2', title: 'Audit monthly AWS cloud spend & license renewals', categoryId: 'office', priority: 'high', dueDate: yesterday, dueTime: '17:00', description: 'Verify EC2 reserved instances and delete unused EBS volumes before billing cycle closes.', subtasks: [], tags: ['finance', 'aws'], status: 'todo', completed: false, completedAt: null, createdAt: new Date().toISOString() },
      { id: 'task_3', title: 'Team 1:1 engineering sprint planning sync', categoryId: 'office', priority: 'medium', dueDate: tomorrow, dueTime: '11:00', description: 'Discuss Q3 deliverables, bug triaging priorities, and roadmap timeline.', subtasks: [], tags: ['sync', 'sprint'], status: 'todo', completed: false, completedAt: null, createdAt: new Date().toISOString() },
      { id: 'task_4', title: 'Review OAuth 2.0 PKCE authentication flow PR', categoryId: 'office', priority: 'medium', dueDate: dayAfter, dueTime: '16:00', description: 'Validate token refresh lifecycle, rate limiting headers, and automated integration tests.', subtasks: [], tags: ['security', 'code-review'], status: 'todo', completed: false, completedAt: null, createdAt: new Date().toISOString() },
      { id: 'task_5', title: 'Schedule annual health and dental checkup', categoryId: 'personal', priority: 'high', dueDate: today, dueTime: '18:30', description: 'Call medical clinic to schedule routine appointment and update insurance records.', subtasks: [], tags: ['health'], status: 'todo', completed: false, completedAt: null, createdAt: new Date().toISOString() },
      { id: 'task_6', title: 'Weekend grocery run & weekly meal prep', categoryId: 'personal', priority: 'medium', dueDate: tomorrow, dueTime: '10:00', description: 'Buy organic greens, almond milk, coffee beans, and sourdough bread.', subtasks: [{ id: 'st3', title: 'Coffee beans & milk', completed: true }, { id: 'st4', title: 'Vegetables & fruit', completed: false }], tags: ['groceries'], status: 'todo', completed: false, completedAt: null, createdAt: new Date().toISOString() },
      { id: 'task_7', title: 'Replace HVAC air filters and smoke detector battery', categoryId: 'personal', priority: 'low', dueDate: nextWeek, dueTime: '', description: 'Filter size 20x25x1. Check test button on detectors.', subtasks: [], tags: ['maintenance'], status: 'todo', completed: false, completedAt: null, createdAt: new Date().toISOString() },
      { id: 'task_8', title: 'Configure automated weekly DB snapshot backup cron', categoryId: 'office', priority: 'high', dueDate: yesterday, dueTime: '12:00', description: 'Tested automated snapshot retention policy and Slack notification hook.', subtasks: [{ id: 'st5', title: 'Run restore drill', completed: true }], tags: ['devops'], status: 'completed', completed: true, completedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
    ];
    localStorage.setItem('planee_tasks_v3', JSON.stringify(this.tasks));
  }

  /* -------------------------------------------------------------------------
   * Seed Default Categories in Cloud
   * ---------------------------------------------------------------------- */
  async _seedDefaultCategories() {
    const snap = await this._categoriesRef().limit(1).get();
    if (!snap.empty) return;

    const defaults = [
      { id: 'office',   name: 'Office Work',       icon: '💼', color: '#58a6ff', isDefault: true  },
      { id: 'personal', name: 'Personal',           icon: '🏠', color: '#2ea043', isDefault: true  },
      { id: 'study',    name: 'Learning & Docs',    icon: '📚', color: '#d29922', isDefault: false },
      { id: 'devops',   name: 'Infra & DevOps',     icon: '🔧', color: '#38bdf8', isDefault: false },
      { id: 'errands',  name: 'Errands',            icon: '🛒', color: '#8b949e', isDefault: false },
    ];

    const batch = this.db.batch();
    defaults.forEach(c => {
      const ref = this._categoriesRef().doc(c.id);
      batch.set(ref, { name: c.name, icon: c.icon, color: c.color, isDefault: c.isDefault });
    });
    await batch.commit();
  }

  /* -------------------------------------------------------------------------
   * Date utility
   * ---------------------------------------------------------------------- */
  getDateOffset(daysOffset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().slice(0, 10);
  }

  /* -------------------------------------------------------------------------
   * Categories CRUD
   * ---------------------------------------------------------------------- */
  getCategories()    { return this.categories; }
  getCategoryById(id) {
    return this.categories.find(c => c.id === id) ||
           { id: 'other', name: 'General', icon: '📌', color: '#58a6ff' };
  }

  async addCategory(name, icon = '📁', color = '#58a6ff') {
    if (this.uid === 'guest_pilot') {
      const newCat = {
        id: 'cat_' + Date.now(),
        name: name.trim(),
        icon,
        color,
        isDefault: false
      };
      this.categories.push(newCat);
      localStorage.setItem('planee_categories_v3', JSON.stringify(this.categories));
      this._notifyListeners();
      return newCat;
    }

    const ref = await this._categoriesRef().add({
      name: name.trim(), icon, color, isDefault: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { id: ref.id, name, icon, color, isDefault: false };
  }

  async deleteCategory(id) {
    const cat = this.categories.find(c => c.id === id);
    if (cat?.isDefault) throw new Error('Cannot delete a built-in category');

    if (this.uid === 'guest_pilot') {
      this.tasks.forEach(t => {
        if (t.categoryId === id) t.categoryId = 'personal';
      });
      this.categories = this.categories.filter(c => c.id !== id);
      localStorage.setItem('planee_categories_v3', JSON.stringify(this.categories));
      localStorage.setItem('planee_tasks_v3', JSON.stringify(this.tasks));
      this._notifyListeners();
      return;
    }

    const snap  = await this._tasksRef().where('categoryId', '==', id).get();
    const batch = this.db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { categoryId: 'personal' }));
    batch.delete(this._categoriesRef().doc(id));
    await batch.commit();
  }

  /* -------------------------------------------------------------------------
   * Tasks CRUD
   * ---------------------------------------------------------------------- */
  getTasks()       { return this.tasks; }
  getTaskById(id)  { return this.tasks.find(t => t.id === id); }

  async addTask({
    title, categoryId = 'office', priority = 'medium',
    dueDate, dueTime = '', description = '', subtasks = [], tags = []
  }) {
    const data = {
      title: title.trim(), categoryId, priority,
      dueDate:     dueDate || this.getDateOffset(0),
      dueTime:     dueTime || '',
      description: description.trim(),
      subtasks:    Array.isArray(subtasks) ? subtasks : [],
      tags:        Array.isArray(tags)     ? tags     : [],
      status:      'todo',
      completed:   false,
      completedAt: null,
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
    };

    if (this.uid === 'guest_pilot') {
      const newTask = { id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5), ...data };
      this.tasks.unshift(newTask);
      localStorage.setItem('planee_tasks_v3', JSON.stringify(this.tasks));
      this._notifyListeners();
      return newTask;
    }

    const ref = await this._tasksRef().add({
      ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return { id: ref.id, ...data };
  }

  async updateTask(id, updates) {
    const task = this.getTaskById(id);
    if (!task) return null;

    const payload = { ...updates, updatedAt: new Date().toISOString() };

    if (updates.completed !== undefined) {
      if (updates.completed) {
        payload.status      = 'completed';
        payload.completedAt = new Date().toISOString();
      } else {
        payload.status      = task.status === 'completed' ? 'todo' : task.status;
        payload.completedAt = null;
      }
    }
    if (updates.status !== undefined) {
      if (updates.status === 'completed') {
        payload.completed   = true;
        payload.completedAt = payload.completedAt || new Date().toISOString();
      } else {
        payload.completed   = false;
        payload.completedAt = null;
      }
    }

    const updatedTask = { ...task, ...payload };

    if (this.uid === 'guest_pilot') {
      const idx = this.tasks.findIndex(t => t.id === id);
      if (idx !== -1) this.tasks[idx] = updatedTask;
      localStorage.setItem('planee_tasks_v3', JSON.stringify(this.tasks));
      this._notifyListeners();
      return updatedTask;
    }

    await this._tasksRef().doc(id).update({
      ...payload,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return updatedTask;
  }

  async toggleTaskComplete(id) {
    const task = this.getTaskById(id);
    if (!task) return null;
    const willBeCompleted = !task.completed;
    const updated = await this.updateTask(id, { completed: willBeCompleted });
    return { updated };
  }

  async deleteTask(id) {
    if (this.uid === 'guest_pilot') {
      this.tasks = this.tasks.filter(t => t.id !== id);
      localStorage.setItem('planee_tasks_v3', JSON.stringify(this.tasks));
      this._notifyListeners();
      return;
    }
    await this._tasksRef().doc(id).delete();
  }

  async clearCompleted() {
    if (this.uid === 'guest_pilot') {
      const count = this.tasks.filter(t => t.completed).length;
      this.tasks = this.tasks.filter(t => !t.completed);
      localStorage.setItem('planee_tasks_v3', JSON.stringify(this.tasks));
      this._notifyListeners();
      return count;
    }

    const snap  = await this._tasksRef().where('completed', '==', true).get();
    const batch = this.db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return snap.size;
  }

  /* -------------------------------------------------------------------------
   * Filtering & Sorting
   * ---------------------------------------------------------------------- */
  getFilteredTasks({
    view = 'all', category = 'all', status = 'all',
    priority = 'all', search = '', sort = 'dueDateAsc'
  } = {}) {
    const today  = this.getDateOffset(0);
    let result   = [...this.tasks];

    if      (view === 'today')     result = result.filter(t => t.dueDate === today);
    else if (view === 'upcoming')  result = result.filter(t => t.dueDate > today  && !t.completed);
    else if (view === 'overdue')   result = result.filter(t => t.dueDate < today  && !t.completed);
    else if (view === 'completed') result = result.filter(t => t.completed);

    if (category !== 'all') result = result.filter(t => t.categoryId === category);
    if (status === 'active')    result = result.filter(t => !t.completed);
    if (status === 'completed') result = result.filter(t =>  t.completed);
    if (priority !== 'all')  result = result.filter(t => t.priority === priority);

    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(t => {
        const cat = this.getCategoryById(t.categoryId);
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          cat.name.toLowerCase().includes(q) ||
          (t.tags || []).some(tag => tag.toLowerCase().includes(q))
        );
      });
    }

    const pw = { urgent: 4, high: 3, medium: 2, low: 1 };
    result.sort((a, b) => {
      if (a.completed !== b.completed && view !== 'completed') return a.completed ? 1 : -1;
      switch (sort) {
        case 'dueDateAsc':   return (a.dueDate || '').localeCompare(b.dueDate || '');
        case 'dueDateDesc':  return (b.dueDate || '').localeCompare(a.dueDate || '');
        case 'priorityDesc': return (pw[b.priority] || 0) - (pw[a.priority] || 0) || (a.dueDate || '').localeCompare(b.dueDate || '');
        case 'createdDesc': {
          const ta = a.createdAt?.toDate?.().toISOString() ?? (a.createdAt || '');
          const tb = b.createdAt?.toDate?.().toISOString() ?? (b.createdAt || '');
          return tb.localeCompare(ta);
        }
        case 'titleAsc': return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
        default: return 0;
      }
    });

    return result;
  }

  /* -------------------------------------------------------------------------
   * Statistics
   * ---------------------------------------------------------------------- */
  getStatistics() {
    const today     = this.getDateOffset(0);
    const total     = this.tasks.length;
    const completed = this.tasks.filter(t =>  t.completed).length;
    const dueToday  = this.tasks.filter(t =>  t.dueDate === today && !t.completed).length;
    const overdue   = this.tasks.filter(t =>  t.dueDate <  today && !t.completed).length;
    const upcoming  = this.tasks.filter(t =>  t.dueDate >  today && !t.completed).length;

    const categoryCounts = {};
    this.categories.forEach(c => {
      categoryCounts[c.id] = this.tasks.filter(t => t.categoryId === c.id && !t.completed).length;
    });

    return {
      total, completed,
      active:   total - completed,
      dueToday, overdue, upcoming,
      rate:     total > 0 ? Math.round((completed / total) * 100) : 0,
      categoryCounts
    };
  }

  /* -------------------------------------------------------------------------
   * Demo Data
   * ---------------------------------------------------------------------- */
  async loadDemoData() {
    if (this.uid === 'guest_pilot') {
      this._seedLocalDemoData();
      this._notifyListeners();
      return;
    }

    const today     = this.getDateOffset(0);
    const yesterday = this.getDateOffset(-1);
    const tomorrow  = this.getDateOffset(1);
    const dayAfter  = this.getDateOffset(3);
    const nextWeek  = this.getDateOffset(7);

    const demos = [
      { title: 'Prepare Q3 Architecture & RFC Migration Spec', categoryId: 'office', priority: 'urgent', dueDate: today, dueTime: '15:00', description: 'Review schema changes with infra team and verify zero-downtime replication strategy.', subtasks: [{ id: 'st1', title: 'Run DB benchmark', completed: true }, { id: 'st2', title: 'Review pull request with team lead', completed: false }], tags: ['architecture', 'rfc'], status: 'in_progress', completed: false, completedAt: null },
      { title: 'Audit monthly AWS cloud spend & license renewals', categoryId: 'office', priority: 'high', dueDate: yesterday, dueTime: '17:00', description: 'Verify EC2 reserved instances and delete unused EBS volumes before billing cycle closes.', subtasks: [], tags: ['finance', 'aws'], status: 'todo', completed: false, completedAt: null },
      { title: 'Team 1:1 engineering sprint planning sync', categoryId: 'office', priority: 'medium', dueDate: tomorrow, dueTime: '11:00', description: 'Discuss Q3 deliverables, bug triaging priorities, and roadmap timeline.', subtasks: [], tags: ['sync', 'sprint'], status: 'todo', completed: false, completedAt: null },
      { title: 'Review OAuth 2.0 PKCE authentication flow PR', categoryId: 'office', priority: 'medium', dueDate: dayAfter, dueTime: '16:00', description: 'Validate token refresh lifecycle, rate limiting headers, and automated integration tests.', subtasks: [], tags: ['security', 'code-review'], status: 'todo', completed: false, completedAt: null },
      { title: 'Schedule annual health and dental checkup', categoryId: 'personal', priority: 'high', dueDate: today, dueTime: '18:30', description: 'Call medical clinic to schedule routine appointment and update insurance records.', subtasks: [], tags: ['health'], status: 'todo', completed: false, completedAt: null },
      { title: 'Weekend grocery run & weekly meal prep', categoryId: 'personal', priority: 'medium', dueDate: tomorrow, dueTime: '10:00', description: 'Buy organic greens, almond milk, coffee beans, and sourdough bread.', subtasks: [{ id: 'st3', title: 'Coffee beans & milk', completed: true }, { id: 'st4', title: 'Vegetables & fruit', completed: false }], tags: ['groceries'], status: 'todo', completed: false, completedAt: null },
      { title: 'Replace HVAC air filters and smoke detector battery', categoryId: 'personal', priority: 'low', dueDate: nextWeek, dueTime: '', description: 'Filter size 20x25x1. Check test button on detectors.', subtasks: [], tags: ['maintenance'], status: 'todo', completed: false, completedAt: null },
      { title: 'Configure automated weekly DB snapshot backup cron', categoryId: 'office', priority: 'high', dueDate: yesterday, dueTime: '12:00', description: 'Tested automated snapshot retention policy and Slack notification hook.', subtasks: [{ id: 'st5', title: 'Run restore drill', completed: true }], tags: ['devops'], status: 'completed', completed: true, completedAt: new Date().toISOString() },
    ];

    const batch = this.db.batch();
    demos.forEach(task => {
      const ref = this._tasksRef().doc();
      batch.set(ref, {
        ...task,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  /* -------------------------------------------------------------------------
   * JSON Export
   * ---------------------------------------------------------------------- */
  exportJSON() {
    const toISO = (v) => v?.toDate?.().toISOString() ?? v;
    const payload = {
      version: '4.0-developer-cli',
      exportedAt: new Date().toISOString(),
      uid:  this.uid,
      categories: this.categories,
      tasks: this.tasks.map(t => ({ ...t, createdAt: toISO(t.createdAt), updatedAt: toISO(t.updatedAt) }))
    };
    const a   = document.createElement('a');
    a.href    = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    a.download = `planee-export-${this.getDateOffset(0)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }
}

window.store = new PlaneeStore();
