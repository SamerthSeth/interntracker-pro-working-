const storage = {
  authKey: 'interntrack_auth',
  internshipKey: 'interntrack_internships',
  vaultDBName: 'interntrack_vault',
  vaultStore: 'files',
};

const navItems = [
  { route: '/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { route: '/documents', icon: 'folder_shared', label: 'Document Vault' },
  { route: '/internships', icon: 'assignment', label: 'Internship Tracker' },
  { route: '/eligibility', icon: 'verified', label: 'Eligibility Checker' },
  { route: '/settings', icon: 'settings', label: 'Settings' },
];

let currentSearch = '';
let currentRoute = '/login';
let pendingUploadFiles = [];

function parseRoute() {
  const hash = window.location.hash || '#/login';
  const route = hash.replace('#', '');
  if (!route || route === '/') return '/login';
  return route;
}

function isAuthenticated() {
  return Boolean(localStorage.getItem(storage.authKey));
}

function getAuth() {
  return JSON.parse(localStorage.getItem(storage.authKey) || 'null');
}

function saveAuth(email) {
  localStorage.setItem(storage.authKey, JSON.stringify({ email, token: crypto.randomUUID(), createdAt: Date.now() }));
}

function clearAuth() {
  localStorage.removeItem(storage.authKey);
}

function getInternships() {
  return JSON.parse(localStorage.getItem(storage.internshipKey) || '[]');
}

function saveInternships(data) {
  localStorage.setItem(storage.internshipKey, JSON.stringify(data));
}

function openVaultDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(storage.vaultDBName, 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storage.vaultStore)) {
        db.createObjectStore(storage.vaultStore, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withVaultStore(mode, callback) {
  const db = await openVaultDB();
  const tx = db.transaction(storage.vaultStore, mode);
  const store = tx.objectStore(storage.vaultStore);
  const result = await callback(store);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function saveVaultFile(file) {
  const id = crypto.randomUUID();
  const item = {
    id,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    createdAt: Date.now(),
    blob: file,
  };
  return withVaultStore('readwrite', (store) => store.add(item)).then(() => item);
}

async function fetchVaultFiles() {
  return withVaultStore('readonly', (store) => {
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  });
}

async function deleteVaultFile(id) {
  return withVaultStore('readwrite', (store) => {
    const request = store.delete(id);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  });
}

async function getVaultFileUrl(id) {
  return withVaultStore('readonly', (store) => {
    const request = store.get(id);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        if (!request.result) return resolve(null);
        resolve(URL.createObjectURL(request.result.blob));
      };
      request.onerror = () => reject(request.error);
    });
  });
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function filterText(value) {
  if (!currentSearch) return true;
  return value.toLowerCase().includes(currentSearch.toLowerCase());
}

function setRoute(route) {
  if (currentRoute === route) return;
  currentRoute = route;
  window.location.hash = `#${route}`;
}

function renderApp() {
  const root = document.getElementById('root');
  currentRoute = parseRoute();
  if (!isAuthenticated() && currentRoute !== '/login') {
    window.location.hash = '#/login';
    return;
  }
  if (isAuthenticated() && currentRoute === '/login') {
    window.location.hash = '#/dashboard';
    return;
  }
  if (currentRoute === '/login') {
    renderLogin(root);
    return;
  }
  renderShell(root, currentRoute);
}

function renderLogin(root) {
  const stored = getAuth();
  root.innerHTML = `
    <div class="min-h-screen flex items-center justify-center px-4 py-10">
      <div class="w-full max-w-xl rounded-[32px] border border-[#414754] bg-[#10131b] p-8 shadow-2xl">
        <div class="mb-8 text-center">
          <div class="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#aec6ff] text-[#0b1220]">
            <span class="material-symbols-outlined text-4xl">lock</span>
          </div>
          <h1 class="text-4xl font-bold">InternTrack Pro</h1>
          <p class="mt-3 text-sm text-[#c1c6d7]">Secure access to your internship dashboard, document vault, and progress reports.</p>
        </div>
        <form id="loginForm" class="space-y-6">
          <div>
            <label class="mb-2 block text-sm font-semibold text-[#e0e2ed]">Email</label>
            <input id="loginEmail" type="email" placeholder="you@example.com" required class="w-full rounded-3xl border border-[#414754] bg-[#121721] px-5 py-4 text-sm text-[#e0e2ed] focus:border-[#aec6ff] focus:ring-2 focus:ring-[#aec6ff]/30" />
          </div>
          <div>
            <label class="mb-2 block text-sm font-semibold text-[#e0e2ed]">Password</label>
            <input id="loginPassword" type="password" placeholder="Enter your password" required class="w-full rounded-3xl border border-[#414754] bg-[#121721] px-5 py-4 text-sm text-[#e0e2ed] focus:border-[#aec6ff] focus:ring-2 focus:ring-[#aec6ff]/30" />
          </div>
          <div id="loginError" class="min-h-[1.25rem] text-sm text-[#ffb4ab]"></div>
          <button type="submit" class="w-full rounded-3xl bg-[#aec6ff] px-6 py-4 text-sm font-semibold text-[#0b1220] hover:opacity-95">Sign in</button>
        </form>
        <div class="mt-8 rounded-3xl border border-[#414754] bg-[#121721] p-5 text-sm text-[#c1c6d7]">
          <p class="font-semibold">Demo credentials</p>
          <p>use any valid email and password of 6+ characters.</p>
        </div>
      </div>
    </div>
  `;
  const loginForm = document.getElementById('loginForm');
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const loginError = document.getElementById('loginError');
    loginError.textContent = '';
    if (!email || !password) {
      loginError.textContent = 'Please enter email and password.';
      return;
    }
    if (password.length < 6) {
      loginError.textContent = 'Password must be at least 6 characters.';
      return;
    }
    saveAuth(email);
    window.location.hash = '#/dashboard';
  });
}

function renderShell(root, route) {
  const auth = getAuth();
  root.innerHTML = `
    <div class="flex min-h-screen bg-[#0f1218]">
      <aside class="hidden md:flex w-[280px] flex-col border-r border-[#414754] bg-[#10131b] p-6">
        <div class="mb-10">
          <h2 class="text-2xl font-bold text-[#aec6ff]">InternTrack Pro</h2>
          <p class="mt-2 text-sm text-[#c1c6d7]">Management suite for internships, files, and progress.</p>
        </div>
        <nav class="flex flex-col gap-2" id="sidebarNav"></nav>
        <div class="mt-auto rounded-3xl border border-[#414754] bg-[#121721] p-5 text-sm text-[#c1c6d7]">
          <p class="font-semibold text-[#e0e2ed]">Signed in as</p>
          <p class="truncate">${auth?.email || 'Unknown user'}</p>
          <button id="logoutButton" class="mt-4 w-full rounded-3xl bg-[#aec6ff] px-4 py-3 text-sm font-semibold text-[#0b1220] hover:opacity-95">Logout</button>
        </div>
      </aside>
      <main class="flex-1">
        <header class="sticky top-0 z-20 border-b border-[#414754] bg-[#10131b]/95 px-6 py-4 backdrop-blur-xl">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 class="text-3xl font-bold text-[#e0e2ed]">${route === '/dashboard' ? 'Dashboard' : route === '/documents' ? 'Document Vault' : route === '/internships' ? 'Internship Tracker' : route === '/eligibility' ? 'Eligibility Checker' : 'Settings'}</h1>
              <p class="mt-2 text-sm text-[#c1c6d7]">Manage your internship workflow from one connected interface.</p>
            </div>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div class="relative w-full max-w-[320px]">
                <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#c1c6d7]">search</span>
                <input id="globalSearch" type="search" placeholder="Search files, internships, tasks..." value="${currentSearch}" class="w-full rounded-full border border-[#414754] bg-[#121721] py-3 pl-12 pr-4 text-sm text-[#e0e2ed] focus:border-[#aec6ff] focus:ring-2 focus:ring-[#aec6ff]/30" />
              </div>
              <button id="mobileMenuButton" class="inline-flex items-center justify-center rounded-3xl border border-[#414754] bg-[#121721] px-5 py-3 text-sm text-[#e0e2ed] hover:border-[#aec6ff] lg:hidden">
                <span class="material-symbols-outlined">menu</span>
              </button>
            </div>
          </div>
        </header>
        <div class="flex flex-col lg:flex-row">
          <section class="lg:hidden border-b border-[#414754] bg-[#10131b]/95 px-6 py-4">
            <div class="flex gap-3 overflow-x-auto pb-2" id="mobileNav"></div>
          </section>
          <section class="flex-1 p-6" id="pageContent"></section>
        </div>
      </main>
    </div>
  `;

  renderSidebar(route);
  bindShellEvents(route);
  renderPageContent(route);
}

function renderSidebar(route) {
  const sidebarNav = document.getElementById('sidebarNav');
  const mobileNav = document.getElementById('mobileNav');
  sidebarNav.innerHTML = navItems.map(item => `
    <a href="#${item.route}" class="page-link flex items-center gap-3 rounded-3xl px-4 py-3 text-sm text-[#c1c6d7] ${item.route === route ? 'active-link bg-[#17202a]' : 'hover:bg-[#17202a]'}">
      <span class="material-symbols-outlined">${item.icon}</span>
      <span>${item.label}</span>
    </a>
  `).join('');
  mobileNav.innerHTML = navItems.map(item => `
    <a href="#${item.route}" class="page-link inline-flex items-center gap-2 rounded-3xl border border-[#414754] bg-[#121721] px-4 py-3 text-sm text-[#c1c6d7] ${item.route === route ? 'active-link border-[#aec6ff]' : 'hover:border-[#aec6ff]' }">${item.label}</a>
  `).join('');
}

function bindShellEvents(route) {
  document.getElementById('logoutButton').addEventListener('click', () => {
    clearAuth();
    window.location.hash = '#/login';
  });

  const mobileMenuButton = document.getElementById('mobileMenuButton');
  if (mobileMenuButton) {
    mobileMenuButton.addEventListener('click', () => {
      const sidebar = document.querySelector('aside');
      sidebar.classList.toggle('hidden');
    });
  }

  const globalSearch = document.getElementById('globalSearch');
  if (globalSearch) {
    globalSearch.addEventListener('input', (event) => {
      currentSearch = event.target.value;
      renderPageContent(route);
    });
  }
}

function renderPageContent(route) {
  const pageContent = document.getElementById('pageContent');
  if (!pageContent) return;
  if (route === '/dashboard') return renderDashboard(pageContent);
  if (route === '/documents') return renderDocumentVault(pageContent);
  if (route === '/internships') return renderInternshipTracker(pageContent);
  if (route === '/eligibility') return renderEligibility(pageContent);
  if (route === '/settings') return renderSettings(pageContent);
  pageContent.innerHTML = '<div class="rounded-3xl border border-[#414754] bg-[#121721] p-8 text-center text-[#c1c6d7]">Page not found.</div>';
}

function renderDashboard(container) {
  container.innerHTML = `
    <div class="grid gap-6 lg:grid-cols-3">
      <div id="dashboardSummary" class="lg:col-span-3"></div>
      <div class="lg:col-span-2">
        <div class="rounded-3xl border border-[#414754] bg-[#121721] p-6">
          <h2 class="mb-4 text-xl font-semibold text-[#e0e2ed]">Monthly activity</h2>
          <div id="dashboardChart" class="space-y-4"></div>
        </div>
      </div>
      <div>
        <div class="rounded-3xl border border-[#414754] bg-[#121721] p-6">
          <h2 class="mb-4 text-xl font-semibold text-[#e0e2ed]">Quick actions</h2>
          <div class="space-y-3">
            <a href="#/documents" class="block rounded-3xl border border-[#414754] bg-[#10131b] px-4 py-4 text-sm font-semibold text-[#aec6ff] hover:bg-[#17202a]">Upload documents</a>
            <a href="#/internships" class="block rounded-3xl border border-[#414754] bg-[#10131b] px-4 py-4 text-sm font-semibold text-[#aec6ff] hover:bg-[#17202a]">Update internship status</a>
            <a href="#/eligibility" class="block rounded-3xl border border-[#414754] bg-[#10131b] px-4 py-4 text-sm font-semibold text-[#aec6ff] hover:bg-[#17202a]">Check eligibility</a>
          </div>
        </div>
      </div>
    </div>
  `;
  fetchVaultFiles().then((files) => {
    const internships = getInternships();
    const activeInternships = internships.filter((item) => ['Interviewing', 'Offer', 'Ongoing'].includes(item.status)).length;
    const upcomingCount = internships.filter((item) => {
      if (!item.end_date || item.is_ongoing) return false;
      const deadline = new Date(item.end_date);
      const now = new Date();
      const diff = (deadline - now) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 30;
    }).length;
    const totalDocs = files.length;
    const completedCount = internships.filter((item) => item.status === 'Offer').length;
    const categories = files.reduce((acc, file) => {
      const type = file.type.split('/')[0] || 'other';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    const chartData = internships.slice(-6).map((item) => ({ title: item.company || 'Untitled', value: 1 }));
    const chartHtml = chartData.length === 0 ? '<p class="text-sm text-[#c1c6d7]">No internship activity yet. Add entries in Internship Tracker.</p>' : `<div class="space-y-4">${chartData.map((item) => `
      <div class="space-y-2">
        <div class="flex items-center justify-between text-sm text-[#c1c6d7]"><span>${item.title}</span><span>${item.value}</span></div>
        <div class="h-3 overflow-hidden rounded-full bg-[#17202a]">
          <div class="h-full rounded-full bg-[#aec6ff]" style="width: ${Math.min(100, item.value * 16)}%"></div>
        </div>
      </div>
    `).join('')}</div>`;
    document.getElementById('dashboardSummary').innerHTML = `
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        ${[{
          title: 'Certificates', value: totalDocs,
          note: 'Uploaded files', icon: 'workspace_premium', color: '#aec6ff'
        }, {
          title: 'Active internships', value: activeInternships,
          note: 'Interviewing / ongoing', icon: 'business_center', color: '#dbb8ff'
        }, {
          title: 'Upcoming deadlines', value: upcomingCount,
          note: 'Next 30 days', icon: 'event_busy', color: '#ffb596'
        }, {
          title: 'Offers received', value: completedCount,
          note: 'Successful outcomes', icon: 'verified', color: '#0070f3'
        }].map(card => `
          <article class="rounded-3xl border border-[#414754] bg-[#121721] p-6">
            <div class="mb-5 flex items-center justify-between">
              <span class="inline-flex h-12 w-12 items-center justify-center rounded-3xl" style="background:${card.color}22;color:${card.color};">
                <span class="material-symbols-outlined">${card.icon}</span>
              </span>
              <span class="text-xs uppercase tracking-[0.22em] text-[#c1c6d7]">${card.note}</span>
            </div>
            <div>
              <p class="text-5xl font-bold text-[#e0e2ed]">${card.value}</p>
              <p class="mt-3 text-sm text-[#c1c6d7]">${card.title}</p>
            </div>
          </article>
        `).join('')}
      </div>
    `;
    document.getElementById('dashboardChart').innerHTML = chartHtml;
  }).catch((error) => {
    document.getElementById('dashboardSummary').innerHTML = `<div class="rounded-3xl border border-[#ffb4ab] bg-[#3f1d1c] p-6 text-sm text-[#ffb4ab]">Unable to load dashboard data: ${error?.message || 'unknown error'}</div>`;
    document.getElementById('dashboardChart').innerHTML = '';
  });
}

function renderDocumentVault(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <section class="rounded-3xl border border-[#414754] bg-[#121721] p-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="text-2xl font-semibold text-[#e0e2ed]">Document Vault</h2>
            <p class="mt-2 text-sm text-[#c1c6d7]">Upload, preview, and manage internship-related documents securely in your browser.</p>
          </div>
          <button id="browseFilesButton" class="inline-flex items-center gap-2 rounded-3xl bg-[#aec6ff] px-5 py-3 text-sm font-semibold text-[#0b1220] hover:opacity-95">
            <span class="material-symbols-outlined">folder_open</span> Browse Files
          </button>
        </div>
        <input id="vaultBrowseInput" type="file" multiple accept="application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" class="hidden" />
      </section>
      <section class="rounded-3xl border border-[#414754] bg-[#121721] p-6">
        <div id="dropZone" class="rounded-3xl border-2 border-dashed border-[#414754] bg-[#10131b] p-10 text-center transition-all duration-200 hover:border-[#aec6ff] hover:bg-[#17202a]">
          <div class="mx-auto mb-4 inline-flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#aec6ff]/20 text-[#aec6ff]">
            <span class="material-symbols-outlined text-4xl">cloud_upload</span>
          </div>
          <h3 class="text-xl font-semibold text-[#e0e2ed]">Drag and drop files here</h3>
          <p class="mt-2 text-sm text-[#c1c6d7]">Supports PDF, images, DOC, DOCX, and certificates up to 25MB.</p>
          <p class="mt-4 text-sm text-[#c1c6d7]">Selected: <span id="selectedCount">0</span> file(s)</p>
          <button id="uploadSelected" class="mt-6 inline-flex items-center gap-2 rounded-3xl bg-[#0070f3] px-6 py-3 text-sm font-semibold text-white hover:opacity-95" disabled>
            <span class="material-symbols-outlined">upload</span> Upload Selected Files
          </button>
        </div>
        <div id="uploadQueue" class="mt-6 grid gap-4"></div>
      </section>
      <section class="rounded-3xl border border-[#414754] bg-[#121721] p-6">
        <div class="flex items-center justify-between gap-4 pb-4">
          <div>
            <h2 class="text-2xl font-semibold text-[#e0e2ed]">Uploaded files</h2>
            <p class="mt-1 text-sm text-[#c1c6d7]">Your vault shows documents persisted in the browser.</p>
          </div>
          <button id="refreshVaultButton" class="rounded-3xl border border-[#414754] px-4 py-3 text-sm text-[#aec6ff] hover:border-[#aec6ff]">Refresh</button>
        </div>
        <div id="vaultFileList" class="space-y-4"></div>
      </section>
    </div>
  `;

  const dropZone = document.getElementById('dropZone');
  const browseInput = document.getElementById('vaultBrowseInput');
  const browseButton = document.getElementById('browseFilesButton');
  const uploadButton = document.getElementById('uploadSelected');
  const selectedCount = document.getElementById('selectedCount');

  function updateQueue(files) {
    pendingUploadFiles = Array.from(files).filter((file) => file.size <= 25 * 1024 * 1024);
    selectedCount.textContent = pendingUploadFiles.length;
    uploadButton.disabled = pendingUploadFiles.length === 0;
    const queue = document.getElementById('uploadQueue');
    if (!queue) return;
    queue.innerHTML = pendingUploadFiles.map((file) => `
      <div class="rounded-3xl border border-[#414754] bg-[#10131b] p-4 flex items-center justify-between gap-4">
        <div>
          <p class="font-semibold text-[#e0e2ed]">${file.name}</p>
          <p class="text-sm text-[#c1c6d7]">${formatBytes(file.size)} • ${file.type || 'unknown'}</p>
        </div>
        <button data-name="${encodeURIComponent(file.name)}" class="removeFile inline-flex items-center rounded-full border border-[#414754] px-4 py-2 text-sm text-[#aec6ff] hover:border-[#ffb4ab]">Remove</button>
      </div>
    `).join('');
    queue.querySelectorAll('.removeFile').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        const name = decodeURIComponent(event.currentTarget.dataset.name);
        pendingUploadFiles = pendingUploadFiles.filter((file) => file.name !== name);
        updateQueue(pendingUploadFiles);
      });
    });
  }

  browseButton.addEventListener('click', () => browseInput.click());
  browseInput.addEventListener('change', (event) => updateQueue(event.target.files));
  dropZone.addEventListener('dragover', (event) => { event.preventDefault(); dropZone.classList.add('border-[#aec6ff]', 'bg-[#17202a]'); });
  dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('border-[#aec6ff]', 'bg-[#17202a]'); });
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('border-[#aec6ff]', 'bg-[#17202a]');
    updateQueue(event.dataTransfer.files);
  });

  uploadButton.addEventListener('click', async () => {
    if (!pendingUploadFiles.length) return;
    uploadButton.disabled = true;
    uploadButton.textContent = 'Uploading...';
    try {
      for (const file of pendingUploadFiles) {
        await saveVaultFile(file);
      }
      pendingUploadFiles = [];
      updateQueue([]);
      renderVaultList();
    } catch (error) {
      alert('Unable to upload files: ' + (error?.message || 'Unknown error'));
    } finally {
      uploadButton.textContent = 'Upload Selected Files';
      uploadButton.disabled = false;
    }
  });

  document.getElementById('refreshVaultButton').addEventListener('click', () => renderVaultList());
  renderVaultList();
}

async function renderVaultList() {
  const list = document.getElementById('vaultFileList');
  if (!list) return;
  list.innerHTML = '<div class="rounded-3xl border border-[#414754] bg-[#10131b] p-6 text-sm text-[#c1c6d7]">Loading files…</div>';
  try {
    const files = await fetchVaultFiles();
    const filtered = files.filter((file) => filterText(file.name + ' ' + (file.type || '')));
    if (!filtered.length) {
      list.innerHTML = `
        <div class="rounded-3xl border border-dashed border-[#414754] bg-[#10131b] p-6 text-center text-[#c1c6d7]">
          <p class="font-semibold text-[#e0e2ed]">No matching documents found</p>
          <p class="mt-2 text-sm">Upload files from the section above or clear search.</p>
        </div>
      `;
      return;
    }
    list.innerHTML = filtered.map((file) => `
      <div class="grid gap-4 rounded-3xl border border-[#414754] bg-[#10131b] p-5 md:grid-cols-[1.5fr_0.8fr_0.8fr_0.8fr_0.7fr] md:items-center">
        <div>
          <p class="text-base font-semibold text-[#e0e2ed]">${file.name}</p>
          <p class="mt-1 text-sm text-[#c1c6d7]">${file.type || 'Unknown type'}</p>
        </div>
        <div>
          <p class="font-semibold text-[#e0e2ed]">${formatBytes(file.size)}</p>
        </div>
        <div>
          <p class="font-semibold text-[#e0e2ed]">${formatDate(file.createdAt)}</p>
        </div>
        <div>
          <button data-id="${file.id}" class="previewFile inline-flex w-full items-center justify-center rounded-3xl border border-[#414754] bg-[#17202a] px-4 py-3 text-sm text-[#aec6ff] hover:border-[#aec6ff]">Preview</button>
        </div>
        <div>
          <button data-id="${file.id}" class="deleteFile inline-flex w-full items-center justify-center rounded-3xl border border-[#ffb4ab] bg-[#3f1d1c] px-4 py-3 text-sm text-[#ffb4ab] hover:bg-[#4d1f1d]">Delete</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.previewFile').forEach((button) => {
      button.addEventListener('click', async (event) => {
        const id = event.currentTarget.dataset.id;
        const url = await getVaultFileUrl(id);
        if (!url) return alert('Unable to open file preview.');
        const fileItem = (await fetchVaultFiles()).find((file) => file.id === id);
        if (!fileItem) return;
        if (fileItem.type.startsWith('image/') || fileItem.type === 'application/pdf') {
          window.open(url, '_blank');
        } else {
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = fileItem.name;
          anchor.click();
          URL.revokeObjectURL(url);
        }
      });
    });

    list.querySelectorAll('.deleteFile').forEach((button) => {
      button.addEventListener('click', async (event) => {
        if (!confirm('Delete this document permanently?')) return;
        const id = event.currentTarget.dataset.id;
        await deleteVaultFile(id);
        renderVaultList();
      });
    });
  } catch (error) {
    list.innerHTML = `<div class="rounded-3xl border border-[#ffb4ab] bg-[#3f1d1c] p-6 text-sm text-[#ffb4ab]">Unable to load files: ${error?.message || 'unknown'}.</div>`;
  }
}

function renderInternshipTracker(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 class="text-2xl font-semibold text-[#e0e2ed]">Internship Tracker</h2>
          <p class="mt-2 text-sm text-[#c1c6d7]">Create, edit, and organize internship records with persistence in your browser.</p>
        </div>
        <button id="addInternshipButton" class="inline-flex items-center gap-2 rounded-3xl bg-[#aec6ff] px-5 py-3 text-sm font-semibold text-[#0b1220] hover:opacity-95">
          <span class="material-symbols-outlined">add</span> Add internship
        </button>
      </div>
      <section id="internshipSummary" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"></section>
      <section class="rounded-3xl border border-[#414754] bg-[#121721] p-6">
        <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 class="text-xl font-semibold text-[#e0e2ed]">Active records</h3>
            <p class="mt-1 text-sm text-[#c1c6d7]">Search matches by company, role, or status.</p>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row">
            <select id="statusFilter" class="rounded-3xl border border-[#414754] bg-[#10131b] px-4 py-3 text-sm text-[#e0e2ed]">
              <option value="all">All statuses</option>
              <option value="Applied">Applied</option>
              <option value="Interviewing">Interviewing</option>
              <option value="Offer">Offer</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
            </select>
            <button id="clearSearchButton" class="inline-flex items-center justify-center rounded-3xl border border-[#414754] px-4 py-3 text-sm text-[#aec6ff] hover:border-[#aec6ff]">Clear search</button>
          </div>
        </div>
        <div id="internshipTable" class="overflow-x-auto"></div>
      </section>
    </div>
  `;

  document.getElementById('addInternshipButton').addEventListener('click', () => showInternshipModal());
  document.getElementById('statusFilter').addEventListener('change', () => renderInternshipTable());
  document.getElementById('clearSearchButton').addEventListener('click', () => {
    currentSearch = '';
    renderApp();
  });
  renderInternshipSummary();
  renderInternshipTable();
}

function renderInternshipSummary() {
  const summary = document.getElementById('internshipSummary');
  const internships = getInternships();
  const applied = internships.filter((item) => item.status === 'Applied').length;
  const ongoing = internships.filter((item) => item.status === 'Ongoing').length;
  const completed = internships.filter((item) => item.status === 'Completed').length;
  const offers = internships.filter((item) => item.status === 'Offer').length;
  const upcoming = internships.filter((item) => {
    if (!item.end_date || item.is_ongoing) return false;
    const diff = (new Date(item.end_date) - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }).length;
  summary.innerHTML = [
    { title: 'Applied', value: applied },
    { title: 'Ongoing', value: ongoing },
    { title: 'Completed', value: completed },
    { title: 'Offers', value: offers },
    { title: 'Upcoming deadlines', value: upcoming },
  ].map((item) => `
    <div class="rounded-3xl border border-[#414754] bg-[#10131b] p-5">
      <p class="text-xs uppercase tracking-[0.24em] text-[#c1c6d7]">${item.title}</p>
      <p class="mt-4 text-4xl font-bold text-[#e0e2ed]">${item.value}</p>
    </div>
  `).join('');
}

function renderInternshipTable() {
  const container = document.getElementById('internshipTable');
  if (!container) return;
  const allInternships = getInternships();
  const statusFilter = document.getElementById('statusFilter').value;
  const filtered = allInternships.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    const search = currentSearch.toLowerCase();
    if (!search) return true;
    return [item.company, item.role, item.status, item.start_date, item.end_date].some((value) => String(value || '').toLowerCase().includes(search));
  });
  if (!filtered.length) {
    container.innerHTML = `<div class="rounded-3xl border border-dashed border-[#414754] bg-[#10131b] p-8 text-center text-[#c1c6d7]">No internships match the filter or search term.</div>`;
    return;
  }
  container.innerHTML = `
    <table class="min-w-full border-collapse text-left text-sm">
      <thead>
        <tr class="border-b border-[#414754] text-[#c1c6d7]">
          <th class="px-4 py-3">Company</th>
          <th class="px-4 py-3">Role</th>
          <th class="px-4 py-3">Period</th>
          <th class="px-4 py-3">Status</th>
          <th class="px-4 py-3">Actions</th>
        </tr>
      </thead>
      <tbody>${filtered.map((item) => `
        <tr class="border-b border-[#1d2430] hover:bg-[#121721]">
          <td class="px-4 py-4 text-[#e0e2ed]">${item.company}</td>
          <td class="px-4 py-4 text-[#c1c6d7]">${item.role}</td>
          <td class="px-4 py-4 text-[#c1c6d7]">${item.start_date || '—'} → ${item.is_ongoing ? 'Ongoing' : item.end_date || '—'}</td>
          <td class="px-4 py-4 text-[#c1c6d7]">${renderBadge(item.status)}</td>
          <td class="px-4 py-4 text-right">
            <div class="inline-flex items-center gap-2">
              <button data-id="${item.id}" class="editInternship rounded-3xl border border-[#aec6ff] px-4 py-2 text-xs text-[#aec6ff] hover:bg-[#1e2955]">Edit</button>
              <button data-id="${item.id}" class="deleteInternship rounded-3xl border border-[#ffb4ab] px-4 py-2 text-xs text-[#ffb4ab] hover:bg-[#4d1f1d]">Delete</button>
            </div>
          </td>
        </tr>
      `).join('')}</tbody>
    </table>
  `;
  container.querySelectorAll('.editInternship').forEach((button) => button.addEventListener('click', () => showInternshipModal(button.dataset.id)));
  container.querySelectorAll('.deleteInternship').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('Remove this internship entry?')) return;
    const id = button.dataset.id;
    saveInternships(getInternships().filter((item) => item.id !== id));
    renderInternshipSummary();
    renderInternshipTable();
  }));
}

function showInternshipModal(id) {
  const internships = getInternships();
  const existing = internships.find((item) => item.id === id) || {
    company: '', role: '', start_date: '', end_date: '', status: 'Applied', is_ongoing: false, id: crypto.randomUUID(), notes: '',
  };
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4';
  overlay.innerHTML = `
    <div class="w-full max-w-3xl overflow-hidden rounded-[32px] border border-[#414754] bg-[#10131b] shadow-2xl">
      <div class="flex items-center justify-between border-b border-[#414754] px-6 py-5">
        <div>
          <h2 class="text-2xl font-semibold text-[#e0e2ed]">${id ? 'Edit internship' : 'Add internship'}</h2>
          <p class="mt-1 text-sm text-[#c1c6d7]">Track company, role, status, and deadlines.</p>
        </div>
        <button id="closeModalButton" class="rounded-full border border-[#414754] px-3 py-2 text-[#c1c6d7] hover:bg-[#17202a]">✕</button>
      </div>
      <form id="internshipForm" class="space-y-5 px-6 py-6">
        <div class="grid gap-4 md:grid-cols-2">
          <label class="block text-sm text-[#c1c6d7]">Company
            <input id="companyInput" type="text" value="${existing.company}" class="mt-2 w-full rounded-3xl border border-[#414754] bg-[#121721] px-4 py-3 text-sm text-[#e0e2ed]" required />
          </label>
          <label class="block text-sm text-[#c1c6d7]">Role
            <input id="roleInput" type="text" value="${existing.role}" class="mt-2 w-full rounded-3xl border border-[#414754] bg-[#121721] px-4 py-3 text-sm text-[#e0e2ed]" required />
          </label>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="block text-sm text-[#c1c6d7]">Start date
            <input id="startDateInput" type="date" value="${existing.start_date}" class="mt-2 w-full rounded-3xl border border-[#414754] bg-[#121721] px-4 py-3 text-sm text-[#e0e2ed]" required />
          </label>
          <label class="block text-sm text-[#c1c6d7]">End date
            <input id="endDateInput" type="date" value="${existing.end_date}" class="mt-2 w-full rounded-3xl border border-[#414754] bg-[#121721] px-4 py-3 text-sm text-[#e0e2ed]" ${existing.is_ongoing ? 'disabled' : ''} />
          </label>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <label class="block text-sm text-[#c1c6d7]">Status
            <select id="statusInput" class="mt-2 w-full rounded-3xl border border-[#414754] bg-[#121721] px-4 py-3 text-sm text-[#e0e2ed]">
              <option value="Applied">Applied</option>
              <option value="Interviewing">Interviewing</option>
              <option value="Offer">Offer</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </label>
          <label class="flex items-center gap-3 rounded-3xl border border-[#414754] bg-[#121721] px-4 py-4 text-sm text-[#c1c6d7]">
            <input id="ongoingInput" type="checkbox" ${existing.is_ongoing ? 'checked' : ''} class="h-5 w-5 rounded border-[#414754] bg-[#10131b] text-[#aec6ff]" />
            Mark as ongoing (no end date)
          </label>
        </div>
        <label class="block text-sm text-[#c1c6d7]">Notes
          <textarea id="notesInput" rows="4" class="mt-2 w-full rounded-3xl border border-[#414754] bg-[#121721] px-4 py-3 text-sm text-[#e0e2ed]">${existing.notes || ''}</textarea>
        </label>
        <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" id="modalCancelButton" class="rounded-3xl border border-[#414754] px-6 py-3 text-sm text-[#aec6ff] hover:bg-[#17202a]">Cancel</button>
          <button type="submit" class="rounded-3xl bg-[#aec6ff] px-6 py-3 text-sm font-semibold text-[#0b1220]">Save</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  const closeModal = () => overlay.remove();
  overlay.querySelector('#closeModalButton').addEventListener('click', closeModal);
  overlay.querySelector('#modalCancelButton').addEventListener('click', closeModal);
  const ongoingInput = overlay.querySelector('#ongoingInput');
  const endDateInput = overlay.querySelector('#endDateInput');
  ongoingInput.addEventListener('change', () => {
    endDateInput.disabled = ongoingInput.checked;
    if (ongoingInput.checked) endDateInput.value = '';
  });
  const statusInput = overlay.querySelector('#statusInput');
  statusInput.value = existing.status;
  overlay.querySelector('#internshipForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const company = overlay.querySelector('#companyInput').value.trim();
    const role = overlay.querySelector('#roleInput').value.trim();
    const start_date = overlay.querySelector('#startDateInput').value;
    const end_date = ongoingInput.checked ? '' : overlay.querySelector('#endDateInput').value;
    const status = statusInput.value;
    const notes = overlay.querySelector('#notesInput').value.trim();
    if (!company || !role || !start_date) return;
    const record = {
      id: existing.id,
      company,
      role,
      start_date,
      end_date,
      status,
      notes,
      is_ongoing: ongoingInput.checked,
    };
    const internships = getInternships().filter((item) => item.id !== existing.id);
    internships.unshift(record);
    saveInternships(internships);
    closeModal();
    renderInternshipSummary();
    renderInternshipTable();
  });
}

function renderBadge(status) {
  const tone = {
    Applied: 'bg-[#17202a] text-[#aec6ff]',
    Interviewing: 'bg-[#1c1326] text-[#dbb8ff]',
    Offer: 'bg-[#1f1609] text-[#ffb596]',
    Ongoing: 'bg-[#0a1828] text-[#9cd3ff]',
    Completed: 'bg-[#13351e] text-[#8ef0a5]',
    Rejected: 'bg-[#2f1413] text-[#ffb4ab]',
  }[status] || 'bg-[#17202a] text-[#c1c6d7]';
  return `<span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}">${status || 'Unknown'}</span>`;
}

function renderEligibility(container) {
  const internships = getInternships();
  awaitFetchVaultFilesSync().then((files) => {
    const hasOffer = internships.some((item) => item.status === 'Offer');
    const hasDocuments = files.length > 0;
    const score = Math.min(100, Math.round((internships.length * 10) + (hasDocuments ? 20 : 0) + (hasOffer ? 20 : 0)));
    container.innerHTML = `
      <div class="grid gap-6 lg:grid-cols-3">
        <div class="lg:col-span-2 rounded-3xl border border-[#414754] bg-[#121721] p-6">
          <h2 class="text-2xl font-semibold text-[#e0e2ed]">Eligibility overview</h2>
          <p class="mt-3 text-sm text-[#c1c6d7]">A quick readiness score based on internships and documents.</p>
          <div class="mt-8 rounded-3xl border border-[#414754] bg-[#10131b] p-6">
            <p class="text-sm uppercase tracking-[0.22em] text-[#c1c6d7]">Ready score</p>
            <p class="mt-4 text-5xl font-bold text-[#e0e2ed]">${score}%</p>
            <div class="mt-6 h-4 rounded-full bg-[#17202a]">
              <div class="h-full rounded-full bg-[#aec6ff]" style="width: ${score}%"></div>
            </div>
          </div>
          <div class="mt-8 grid gap-4 sm:grid-cols-2">
            <div class="rounded-3xl border border-[#414754] bg-[#10131b] p-5">
              <p class="text-sm text-[#c1c6d7]">Internship records</p>
              <p class="mt-3 text-3xl font-semibold text-[#e0e2ed]">${internships.length}</p>
            </div>
            <div class="rounded-3xl border border-[#414754] bg-[#10131b] p-5">
              <p class="text-sm text-[#c1c6d7]">Uploaded documents</p>
              <p class="mt-3 text-3xl font-semibold text-[#e0e2ed]">${files.length}</p>
            </div>
          </div>
        </div>
        <div class="rounded-3xl border border-[#414754] bg-[#121721] p-6">
          <h3 class="text-xl font-semibold text-[#e0e2ed]">How to improve</h3>
          <ul class="mt-5 space-y-4 text-sm text-[#c1c6d7]">
            <li><span class="font-semibold text-[#aec6ff]">Add more internships</span> to increase your track record and readiness.</li>
            <li><span class="font-semibold text-[#aec6ff]">Upload certificates</span> and offer letters for stronger verification.</li>
            <li><span class="font-semibold text-[#aec6ff]">Complete ongoing internships</span> and update status to improve your profile.</li>
          </ul>
        </div>
      </div>
    `;
  }).catch(() => {
    container.innerHTML = `<div class="rounded-3xl border border-[#ffb4ab] bg-[#3f1d1c] p-6 text-sm text-[#ffb4ab]">Unable to compute eligibility score.</div>`;
  });
}

async function awaitFetchVaultFilesSync() {
  try {
    return await fetchVaultFiles();
  } catch (error) {
    return [];
  }
}

function renderSettings(container) {
  const auth = getAuth();
  container.innerHTML = `
    <div class="space-y-6">
      <div class="rounded-3xl border border-[#414754] bg-[#121721] p-6">
        <h2 class="text-2xl font-semibold text-[#e0e2ed]">Profile settings</h2>
        <p class="mt-2 text-sm text-[#c1c6d7]">Your authenticated session is stored locally for offline use.</p>
        <div class="mt-6 space-y-4 text-sm text-[#c1c6d7]">
          <div class="rounded-3xl border border-[#414754] bg-[#10131b] p-5">
            <p class="text-xs uppercase tracking-[0.22em] text-[#aec6ff]">Email</p>
            <p class="mt-2 text-base font-semibold text-[#e0e2ed]">${auth?.email || 'N/A'}</p>
          </div>
          <div class="rounded-3xl border border-[#414754] bg-[#10131b] p-5">
            <p class="text-xs uppercase tracking-[0.22em] text-[#aec6ff]">Storage</p>
            <p class="mt-2 text-base font-semibold text-[#e0e2ed]">Browser local storage & IndexedDB</p>
            <p class="mt-2 text-sm text-[#c1c6d7]">This site stores documents and internship data entirely on your device.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

window.addEventListener('hashchange', renderApp);
window.addEventListener('DOMContentLoaded', renderApp);
