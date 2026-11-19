/**
 * TaskFlow — Modern To-Do List Application
 * Comprehensive JavaScript application managing state, persistence, UI rendering,
 * animations, filters, audio synthesizer feedback, and import/export capabilities.
 */

// --- Application State ---
const State = {
  tasks: [],
  filter: 'all',          // 'all' | 'pending' | 'completed' | 'today'
  categoryFilter: 'all',  // 'all' | specific category
  searchQuery: '',
  sortBy: 'created-desc',
  soundEnabled: true,
  lastDeletedTask: null,
  undoTimeout: null
};

// --- Web Audio Synthesizer (Zero external audio files needed) ---
const SoundFX = {
  audioCtx: null,

  init() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      console.warn('Web Audio not supported');
    }
  },

  playSuccess() {
    if (!State.soundEnabled || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    const now = this.audioCtx.currentTime;

    // Pleasant upbeat two-tone chime
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  },

  playAdd() {
    if (!State.soundEnabled || !this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    const now = this.audioCtx.currentTime;

    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08); // E5

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }
};

// --- DOM Element References ---
const Elements = {
  html: document.documentElement,
  greetingText: document.getElementById('greetingText'),
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  themeIcon: document.getElementById('themeIcon'),
  soundToggleBtn: document.getElementById('soundToggleBtn'),
  soundIcon: document.getElementById('soundIcon'),
  dataMenuBtn: document.getElementById('dataMenuBtn'),
  dataDropdown: document.getElementById('dataDropdown'),
  exportBtn: document.getElementById('exportBtn'),
  importFileInput: document.getElementById('importFileInput'),
  clearCompletedBtn: document.getElementById('clearCompletedBtn'),
  clearAllBtn: document.getElementById('clearAllBtn'),

  // Form Elements
  taskForm: document.getElementById('taskForm'),
  taskInput: document.getElementById('taskInput'),
  prioritySelect: document.getElementById('prioritySelect'),
  categorySelect: document.getElementById('categorySelect'),
  dueDateInput: document.getElementById('dueDateInput'),

  // Metrics
  progressPercent: document.getElementById('progressPercent'),
  taskCountSummary: document.getElementById('taskCountSummary'),
  totalTasksCount: document.getElementById('totalTasksCount'),
  completedTasksCount: document.getElementById('completedTasksCount'),
  pendingTasksCount: document.getElementById('pendingTasksCount'),
  progressBar: document.getElementById('progressBar'),

  // Filters & Search
  searchInput: document.getElementById('searchInput'),
  clearSearchBtn: document.getElementById('clearSearchBtn'),
  sortSelect: document.getElementById('sortSelect'),
  categoryFilter: document.getElementById('categoryFilter'),
  filterButtons: document.querySelectorAll('.filter-btn'),
  filterCountAll: document.getElementById('filterCountAll'),
  filterCountPending: document.getElementById('filterCountPending'),
  filterCountCompleted: document.getElementById('filterCountCompleted'),
  filterCountToday: document.getElementById('filterCountToday'),

  // Lists & Modals
  taskList: document.getElementById('taskList'),
  emptyState: document.getElementById('emptyState'),
  emptyStateTitle: document.getElementById('emptyStateTitle'),
  emptyStateText: document.getElementById('emptyStateText'),
  toastContainer: document.getElementById('toastContainer'),

  // Edit Modal
  editModal: document.getElementById('editModal'),
  editTaskForm: document.getElementById('editTaskForm'),
  editTaskId: document.getElementById('editTaskId'),
  editTaskInput: document.getElementById('editTaskInput'),
  editPrioritySelect: document.getElementById('editPrioritySelect'),
  editCategorySelect: document.getElementById('editCategorySelect'),
  editDueDateInput: document.getElementById('editDueDateInput'),
  closeEditModalBtn: document.getElementById('closeEditModalBtn'),
  cancelEditBtn: document.getElementById('cancelEditBtn')
};

// --- Initialization ---
function initApp() {
  SoundFX.init();
  loadSettings();
  loadTasks();
  setupDynamicGreeting();
  setupEventListeners();
  renderApp();
}

// --- Dynamic Greeting & Current Date ---
function setupDynamicGreeting() {
  const now = new Date();
  const hour = now.getHours();
  let timeOfDay = 'morning';

  if (hour >= 12 && hour < 17) {
    timeOfDay = 'afternoon';
  } else if (hour >= 17 || hour < 4) {
    timeOfDay = 'evening';
  }

  const dateStr = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  Elements.greetingText.textContent = `Good ${timeOfDay}! It's ${dateStr}`;

  // Default due date to today in form
  const todayIso = now.toISOString().split('T')[0];
  Elements.dueDateInput.value = todayIso;
}

// --- Persistence Helpers (LocalStorage) ---
function loadSettings() {
  // Theme
  const savedTheme = localStorage.getItem('taskflow_theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(savedTheme);

  // Sound
  const savedSound = localStorage.getItem('taskflow_sound');
  State.soundEnabled = savedSound !== null ? savedSound === 'true' : true;
  updateSoundIcon();
}

function applyTheme(theme) {
  if (theme === 'dark') {
    Elements.html.classList.add('dark');
    Elements.html.classList.remove('light');
    Elements.themeIcon.setAttribute('data-lucide', 'sun');
  } else {
    Elements.html.classList.remove('dark');
    Elements.html.classList.add('light');
    Elements.themeIcon.setAttribute('data-lucide', 'moon');
  }
  localStorage.setItem('taskflow_theme', theme);
  if (window.lucide) lucide.createIcons();
}

function toggleTheme() {
  const isDark = Elements.html.classList.contains('dark');
  applyTheme(isDark ? 'light' : 'dark');
}

function updateSoundIcon() {
  Elements.soundIcon.setAttribute('data-lucide', State.soundEnabled ? 'volume-2' : 'volume-x');
  if (window.lucide) lucide.createIcons();
}

function toggleSound() {
  State.soundEnabled = !State.soundEnabled;
  localStorage.setItem('taskflow_sound', State.soundEnabled);
  updateSoundIcon();
  showToast(State.soundEnabled ? 'Audio feedback enabled' : 'Audio feedback muted', 'info');
}

function loadTasks() {
  try {
    const raw = localStorage.getItem('taskflow_tasks');
    if (raw) {
      State.tasks = JSON.parse(raw);
    } else {
      // Starter demo tasks for a welcoming experience
      State.tasks = [
        {
          id: 'task-1',
          title: 'Review project requirements and setup workspace',
          completed: true,
          priority: 'high',
          category: 'Work',
          dueDate: new Date().toISOString().split('T')[0],
          createdAt: Date.now() - 3600000
        },
        {
          id: 'task-2',
          title: 'Organize week schedule and plan priorities',
          completed: false,
          priority: 'medium',
          category: 'Personal',
          dueDate: new Date().toISOString().split('T')[0],
          createdAt: Date.now() - 1800000
        },
        {
          id: 'task-3',
          title: 'Explore Tailwind CSS components and animations',
          completed: false,
          priority: 'low',
          category: 'Study',
          dueDate: '',
          createdAt: Date.now()
        }
      ];
      saveTasks();
    }
  } catch (e) {
    console.error('Error loading tasks:', e);
    State.tasks = [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem('taskflow_tasks', JSON.stringify(State.tasks));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
    showToast('Failed to save tasks to local storage', 'error');
  }
}

// --- Task Operations ---
function addTask(title, priority, category, dueDate) {
  const newTask = {
    id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    title: title.trim(),
    completed: false,
    priority: priority || 'medium',
    category: category || 'General',
    dueDate: dueDate || '',
    createdAt: Date.now()
  };

  State.tasks.unshift(newTask);
  saveTasks();
  SoundFX.playAdd();
  renderApp();
  showToast('Task added successfully', 'success');
}

function toggleTaskStatus(id) {
  const task = State.tasks.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;
  saveTasks();

  if (task.completed) {
    SoundFX.playSuccess();

    // Check if all tasks are completed for celebration!
    const total = State.tasks.length;
    const completed = State.tasks.filter(t => t.completed).length;
    if (total > 0 && total === completed) {
      triggerConfetti();
      showToast('All tasks completed! Fantastic job! 🚀', 'success');
    }
  }

  renderApp();
}

function deleteTask(id) {
  const index = State.tasks.findIndex(t => t.id === id);
  if (index === -1) return;

  State.lastDeletedTask = {
    task: State.tasks[index],
    index: index
  };

  State.tasks.splice(index, 1);
  saveTasks();
  renderApp();

  showToast('Task removed', 'undo', () => undoDelete());
}

function undoDelete() {
  if (!State.lastDeletedTask) return;
  const { task, index } = State.lastDeletedTask;
  State.tasks.splice(index, 0, task);
  State.lastDeletedTask = null;
  saveTasks();
  renderApp();
  showToast('Task restored', 'success');
}

function openEditModal(id) {
  const task = State.tasks.find(t => t.id === id);
  if (!task) return;

  Elements.editTaskId.value = task.id;
  Elements.editTaskInput.value = task.title;
  Elements.editPrioritySelect.value = task.priority;
  Elements.editCategorySelect.value = task.category;
  Elements.editDueDateInput.value = task.dueDate || '';

  Elements.editModal.classList.remove('hidden');
  Elements.editTaskInput.focus();
}

function closeEditModal() {
  Elements.editModal.classList.add('hidden');
}

function saveEditedTask() {
  const id = Elements.editTaskId.value;
  const task = State.tasks.find(t => t.id === id);
  if (!task) return;

  const newTitle = Elements.editTaskInput.value.trim();
  if (!newTitle) return;

  task.title = newTitle;
  task.priority = Elements.editPrioritySelect.value;
  task.category = Elements.editCategorySelect.value;
  task.dueDate = Elements.editDueDateInput.value;

  saveTasks();
  closeEditModal();
  renderApp();
  showToast('Task updated', 'success');
}

// --- Confetti Celebration ---
function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.65 }
    });
  }
}

// --- Filtering, Sorting & Query Logic ---
function getFilteredAndSortedTasks() {
  const todayStr = new Date().toISOString().split('T')[0];

  return State.tasks
    .filter(task => {
      // Status filter
      if (State.filter === 'pending' && task.completed) return false;
      if (State.filter === 'completed' && !task.completed) return false;
      if (State.filter === 'today' && task.dueDate !== todayStr) return false;

      // Category filter
      if (State.categoryFilter !== 'all' && task.category !== State.categoryFilter) return false;

      // Search query
      if (State.searchQuery) {
        const query = State.searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesCat = task.category.toLowerCase().includes(query);
        if (!matchesTitle && !matchesCat) return false;
      }

      return true;
    })
    .sort((a, b) => {
      switch (State.sortBy) {
        case 'created-asc':
          return (a.createdAt || 0) - (b.createdAt || 0);
        case 'created-desc':
          return (b.createdAt || 0) - (a.createdAt || 0);
        case 'due-asc':
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
        case 'priority-desc': {
          const rank = { high: 3, medium: 2, low: 1 };
          return (rank[b.priority] || 0) - (rank[a.priority] || 0);
        }
        case 'alpha-asc':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
}

// --- UI Rendering ---
function renderApp() {
  renderMetrics();
  renderTaskList();
  updateFilterBadges();
  if (window.lucide) lucide.createIcons();
}

function renderMetrics() {
  const total = State.tasks.length;
  const completed = State.tasks.filter(t => t.completed).length;
  const pending = total - completed;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  Elements.totalTasksCount.textContent = total;
  Elements.completedTasksCount.textContent = completed;
  Elements.pendingTasksCount.textContent = pending;
  Elements.progressPercent.textContent = `${percent}%`;
  Elements.taskCountSummary.textContent = `${completed} of ${total} tasks done`;
  Elements.progressBar.style.width = `${percent}%`;
}

function updateFilterBadges() {
  const todayStr = new Date().toISOString().split('T')[0];

  const total = State.tasks.length;
  const pending = State.tasks.filter(t => !t.completed).length;
  const completed = State.tasks.filter(t => t.completed).length;
  const today = State.tasks.filter(t => t.dueDate === todayStr).length;

  Elements.filterCountAll.textContent = total;
  Elements.filterCountPending.textContent = pending;
  Elements.filterCountCompleted.textContent = completed;
  Elements.filterCountToday.textContent = today;
}

function renderTaskList() {
  const filteredTasks = getFilteredAndSortedTasks();
  Elements.taskList.innerHTML = '';

  if (filteredTasks.length === 0) {
    Elements.emptyState.classList.remove('hidden');

    if (State.searchQuery) {
      Elements.emptyStateTitle.textContent = 'No matching tasks';
      Elements.emptyStateText.textContent = `No tasks matched your search "${State.searchQuery}". Try a different keyword.`;
    } else if (State.filter === 'completed') {
      Elements.emptyStateTitle.textContent = 'No completed tasks';
      Elements.emptyStateText.textContent = 'Complete some of your active tasks to view them here!';
    } else if (State.filter === 'today') {
      Elements.emptyStateTitle.textContent = 'No tasks due today';
      Elements.emptyStateText.textContent = 'You have no tasks scheduled for today. Great job or schedule new ones!';
    } else {
      Elements.emptyStateTitle.textContent = 'Your task list is empty';
      Elements.emptyStateText.textContent = 'Add your first task above to start tracking your goals!';
    }
    return;
  }

  Elements.emptyState.classList.add('hidden');

  const todayStr = new Date().toISOString().split('T')[0];

  filteredTasks.forEach(task => {
    const li = document.createElement('li');
    li.className = `group glass-panel border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-3.5 sm:p-4 transition-all duration-200 hover:shadow-md animate-fade-in ${
      task.completed ? 'bg-slate-50/60 dark:bg-slate-900/40 opacity-75' : 'bg-white dark:bg-slate-900'
    }`;

    // Priority formatting
    const priorityLabels = {
      high: { label: 'High', class: 'priority-high' },
      medium: { label: 'Medium', class: 'priority-medium' },
      low: { label: 'Low', class: 'priority-low' }
    };
    const pInfo = priorityLabels[task.priority] || priorityLabels.medium;

    // Due Date info & Overdue calculation
    let dateBadgeHtml = '';
    if (task.dueDate) {
      const isOverdue = !task.completed && task.dueDate < todayStr;
      const isToday = task.dueDate === todayStr;

      let badgeClass = 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800';
      let iconColor = 'text-slate-400';
      let text = formatDate(task.dueDate);

      if (isOverdue) {
        badgeClass = 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/50 dark:border-rose-800/40';
        iconColor = 'text-rose-500';
        text = `Overdue: ${formatDate(task.dueDate)}`;
      } else if (isToday) {
        badgeClass = 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-800/40';
        iconColor = 'text-indigo-500';
        text = 'Due Today';
      }

      dateBadgeHtml = `
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold ${badgeClass}">
          <i data-lucide="clock" class="w-3 h-3 ${iconColor}"></i>
          ${text}
        </span>
      `;
    }

    // Category Color Badges
    const categoryColors = {
      Work: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200/50 dark:border-blue-800/40',
      Personal: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200/50 dark:border-purple-800/40',
      Study: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/40',
      Health: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400 border-teal-200/50 dark:border-teal-800/40',
      Finance: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/50 dark:border-amber-800/40',
      General: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
    };
    const catClass = categoryColors[task.category] || categoryColors.General;

    li.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <!-- Checkbox + Content -->
        <div class="flex items-start gap-3 flex-1 min-w-0">
          <button 
            type="button" 
            onclick="toggleTaskStatus('${task.id}')"
            class="mt-0.5 shrink-0 w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
              task.completed 
                ? 'bg-brand-600 border-brand-600 text-white shadow-sm shadow-brand-500/20' 
                : 'border-slate-300 dark:border-slate-600 hover:border-brand-500 dark:hover:border-brand-400 bg-white dark:bg-slate-800'
            }"
            aria-label="${task.completed ? 'Mark incomplete' : 'Mark completed'}"
          >
            ${task.completed ? '<i data-lucide="check" class="w-3.5 h-3.5 stroke-[3]"></i>' : ''}
          </button>

          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-slate-800 dark:text-slate-100 break-words leading-snug cursor-pointer select-none ${
              task.completed ? 'task-done-title line-through text-slate-400 dark:text-slate-500' : ''
            }" onclick="toggleTaskStatus('${task.id}')">
              ${escapeHtml(task.title)}
            </p>

            <!-- Metadata Badges -->
            <div class="flex flex-wrap items-center gap-1.5 mt-2">
              <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${catClass}">
                ${task.category}
              </span>
              <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${pInfo.class}">
                ${pInfo.label}
              </span>
              ${dateBadgeHtml}
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            type="button" 
            onclick="openEditModal('${task.id}')"
            class="p-1.5 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition" 
            title="Edit task"
          >
            <i data-lucide="pencil" class="w-4 h-4"></i>
          </button>
          <button 
            type="button" 
            onclick="deleteTask('${task.id}')"
            class="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition" 
            title="Delete task"
          >
            <i data-lucide="trash" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;

    Elements.taskList.appendChild(li);
  });
}

// --- Date Formatter ---
function formatDate(dateString) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric'
  });
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// --- Toast Notifications ---
function showToast(message, type = 'info', actionCallback = null) {
  const toast = document.createElement('div');
  toast.className = 'pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-semibold rounded-2xl shadow-xl backdrop-blur-md border border-slate-700/60 animate-slide-down';

  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle-2';
  if (type === 'error') iconName = 'alert-triangle';

  toast.innerHTML = `
    <div class="flex items-center gap-2">
      <i data-lucide="${iconName}" class="w-4 h-4 text-brand-400"></i>
      <span>${escapeHtml(message)}</span>
    </div>
    ${
      actionCallback
        ? `<button id="toastActionBtn" class="ml-2 px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-bold transition">Undo</button>`
        : ''
    }
  `;

  Elements.toastContainer.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  if (actionCallback) {
    const btn = toast.querySelector('#toastActionBtn');
    btn.addEventListener('click', () => {
      actionCallback();
      toast.remove();
    });
  }

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// --- Import / Export Handlers ---
function exportTasks() {
  const dataStr = JSON.stringify(State.tasks, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tasks-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Tasks exported to JSON', 'success');
}

function importTasks(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = event => {
    try {
      const imported = JSON.parse(event.target.result);
      if (Array.isArray(imported)) {
        State.tasks = imported;
        saveTasks();
        renderApp();
        showToast(`Successfully imported ${imported.length} tasks`, 'success');
      } else {
        showToast('Invalid JSON task file format', 'error');
      }
    } catch (err) {
      showToast('Error parsing JSON file', 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // Reset input
}

function clearCompletedTasks() {
  const completedCount = State.tasks.filter(t => t.completed).length;
  if (completedCount === 0) {
    showToast('No completed tasks to clear', 'info');
    return;
  }

  State.tasks = State.tasks.filter(t => !t.completed);
  saveTasks();
  renderApp();
  showToast(`Cleared ${completedCount} completed tasks`, 'success');
}

function clearAllTasks() {
  if (State.tasks.length === 0) return;
  if (confirm('Are you sure you want to clear all tasks? This action cannot be undone.')) {
    State.tasks = [];
    saveTasks();
    renderApp();
    showToast('All tasks cleared', 'info');
  }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Theme & Sound
  Elements.themeToggleBtn.addEventListener('click', toggleTheme);
  Elements.soundToggleBtn.addEventListener('click', toggleSound);

  // Data Dropdown Toggle
  Elements.dataMenuBtn.addEventListener('click', e => {
    e.stopPropagation();
    Elements.dataDropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    Elements.dataDropdown.classList.add('hidden');
  });

  Elements.exportBtn.addEventListener('click', () => {
    Elements.dataDropdown.classList.add('hidden');
    exportTasks();
  });

  Elements.importFileInput.addEventListener('change', importTasks);

  Elements.clearCompletedBtn.addEventListener('click', () => {
    Elements.dataDropdown.classList.add('hidden');
    clearCompletedTasks();
  });

  Elements.clearAllBtn.addEventListener('click', () => {
    Elements.dataDropdown.classList.add('hidden');
    clearAllTasks();
  });

  // Task Submission Form
  Elements.taskForm.addEventListener('submit', e => {
    e.preventDefault();
    const title = Elements.taskInput.value;
    const priority = Elements.prioritySelect.value;
    const category = Elements.categorySelect.value;
    const dueDate = Elements.dueDateInput.value;

    if (!title.trim()) return;

    addTask(title, priority, category, dueDate);
    Elements.taskInput.value = '';
    Elements.taskInput.focus();
  });

  // Filter Buttons
  Elements.filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      Elements.filterButtons.forEach(b => {
        b.classList.remove('bg-brand-600', 'text-white', 'shadow-sm', 'active-filter');
        b.classList.add('bg-white', 'dark:bg-slate-900', 'text-slate-600', 'dark:text-slate-300', 'border', 'border-slate-200', 'dark:border-slate-800');
        const badge = b.querySelector('.filter-count-badge');
        if (badge) {
          badge.className = 'filter-count-badge text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded-full';
        }
      });

      btn.classList.remove('bg-white', 'dark:bg-slate-900', 'text-slate-600', 'dark:text-slate-300', 'border');
      btn.classList.add('bg-brand-600', 'text-white', 'shadow-sm', 'active-filter');
      const activeBadge = btn.querySelector('.filter-count-badge');
      if (activeBadge) {
        activeBadge.className = 'filter-count-badge opacity-80 text-[10px] bg-black/20 dark:bg-white/20 px-1.5 py-0.2 rounded-full';
      }

      State.filter = btn.getAttribute('data-filter');
      renderTaskList();
      if (window.lucide) lucide.createIcons();
    });
  });

  // Category Filter
  Elements.categoryFilter.addEventListener('change', e => {
    State.categoryFilter = e.target.value;
    renderTaskList();
    if (window.lucide) lucide.createIcons();
  });

  // Sort Selection
  Elements.sortSelect.addEventListener('change', e => {
    State.sortBy = e.target.value;
    renderTaskList();
    if (window.lucide) lucide.createIcons();
  });

  // Search Input
  Elements.searchInput.addEventListener('input', e => {
    State.searchQuery = e.target.value.trim();
    if (State.searchQuery) {
      Elements.clearSearchBtn.classList.remove('hidden');
    } else {
      Elements.clearSearchBtn.classList.add('hidden');
    }
    renderTaskList();
    if (window.lucide) lucide.createIcons();
  });

  Elements.clearSearchBtn.addEventListener('click', () => {
    Elements.searchInput.value = '';
    State.searchQuery = '';
    Elements.clearSearchBtn.classList.add('hidden');
    renderTaskList();
    if (window.lucide) lucide.createIcons();
  });

  // Edit Modal Event Handlers
  Elements.closeEditModalBtn.addEventListener('click', closeEditModal);
  Elements.cancelEditBtn.addEventListener('click', closeEditModal);

  Elements.editTaskForm.addEventListener('submit', e => {
    e.preventDefault();
    saveEditedTask();
  });

  // Modal Backdrop click
  Elements.editModal.addEventListener('click', e => {
    if (e.target === Elements.editModal) {
      closeEditModal();
    }
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', e => {
    // Focus search with '/' key
    if (e.key === '/' && document.activeElement !== Elements.taskInput && document.activeElement !== Elements.searchInput && document.activeElement !== Elements.editTaskInput) {
      e.preventDefault();
      Elements.searchInput.focus();
    }

    // Close modal or dropdowns with 'Escape'
    if (e.key === 'Escape') {
      if (!Elements.editModal.classList.contains('hidden')) {
        closeEditModal();
      }
      Elements.dataDropdown.classList.add('hidden');
    }
  });
}

// Global exposure for inline HTML event handlers
window.toggleTaskStatus = toggleTaskStatus;
window.deleteTask = deleteTask;
window.openEditModal = openEditModal;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initApp);
