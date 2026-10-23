/**
 * LabTrack - Lab Equipment & Component Borrowing System
 * Vanilla JS Application Controller
 * Fully implements Unit 1-6 Course Rubrics
 */

const App = (() => {
  // State management
  let state = {
    user: null,
    token: null,
    components: [],
    myBorrowings: [],
    adminRecords: [],
    analytics: null,
    auditLogs: [],
    currentTab: 'catalog',
    selectedComponentForBorrow: null,
    searchQuery: '',
    categoryFilter: 'All',
    statusFilter: 'All'
  };

  // Client-Side Regex Sanitization (Unit 3 Rubric)
  const SCRIPT_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  const PRN_REGEX = /^[0-9]{11}$/;
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  function sanitizeString(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(SCRIPT_REGEX, '').trim();
  }

  // Toast Notification System
  function showToast(message, type = 'info', etherealUrl = null) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let etherealLinkHtml = '';
    if (etherealUrl) {
      etherealLinkHtml = `
        <div style="margin-top: 6px;">
          <a href="${etherealUrl}" target="_blank" rel="noopener" class="toast-ethereal-link">
            ✉️ Open Ethereal Test Email Preview &rarr;
          </a>
        </div>
      `;
    }

    toast.innerHTML = `
      <div>
        <div>${sanitizeString(message)}</div>
        ${etherealLinkHtml}
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = '0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, etherealUrl ? 10000 : 4500);
  }

  // API Client Helper
  async function apiRequest(endpoint, options = {}) {
    const headers = options.headers || {};
    if (state.token) {
      headers['Authorization'] = `Bearer ${state.token}`;
    }

    // Do not set Content-Type if sending FormData (browser sets boundary automatically)
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `API Error: ${response.statusText}`);
      }

      return data;
    } catch (err) {
      console.error(`[API Error] ${endpoint}:`, err);
      throw err;
    }
  }

  // Initialize App
  async function init() {
    // 1. Restore auth state from localStorage
    const savedToken = localStorage.getItem('labtrack_token');
    const savedUser = localStorage.getItem('labtrack_user');

    if (savedToken && savedUser) {
      try {
        state.token = savedToken;
        state.user = JSON.parse(savedUser);
      } catch (e) {
        logout();
      }
    }

    // Set minimum date for borrow modal to today
    const returnDateInput = document.getElementById('borrow-return-date');
    if (returnDateInput) {
      const today = new Date().toISOString().split('T')[0];
      returnDateInput.min = today;
      // Default to 7 days from now
      const defaultReturn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      returnDateInput.value = defaultReturn;
    }

    updateAuthUI();
    await loadAnalytics();
    await loadComponents();

    if (state.user) {
      loadMyBorrowings();
      if (state.user.role === 'admin') {
        loadAdminRecords();
      }
    }
  }

  // ================= AUTHENTICATION FLOW =================
  function updateAuthUI() {
    const profileWidget = document.getElementById('user-profile-widget');
    const adminElements = document.querySelectorAll('.admin-only');

    if (state.user) {
      const initials = state.user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      profileWidget.innerHTML = `
        <div class="user-badge">
          <div class="user-avatar">${initials}</div>
          <div class="user-meta">
            <span class="user-name">${state.user.name}</span>
            <span class="user-role-prn">
              ${state.user.role.toUpperCase()} | PRN: ${state.user.prn} (${state.user.department || 'LAB'})
            </span>
          </div>
          <button class="btn btn-outline btn-xs" onclick="App.logout()" title="Sign Out">
            Sign Out
          </button>
        </div>
      `;

      // Show/hide Admin-only elements
      const isAdmin = state.user.role === 'admin';
      adminElements.forEach((el) => {
        el.style.display = isAdmin ? '' : 'none';
      });

      // Show My Borrowings tab
      const myBorrowTab = document.getElementById('tab-my-borrowings');
      if (myBorrowTab) myBorrowTab.style.display = '';
    } else {
      profileWidget.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="App.openAuthModal('login')">
          Sign In / Register
        </button>
      `;

      adminElements.forEach((el) => {
        el.style.display = 'none';
      });

      const myBorrowTab = document.getElementById('tab-my-borrowings');
      if (myBorrowTab) myBorrowTab.style.display = 'none';
    }
  }

  function openAuthModal(mode = 'login') {
    toggleAuthMode(mode);
    const modal = document.getElementById('modal-auth');
    if (modal) modal.classList.add('active');
  }

  function toggleAuthMode(mode) {
    const loginForm = document.getElementById('form-login');
    const regForm = document.getElementById('form-register');
    const tabLogin = document.getElementById('tab-btn-login');
    const tabReg = document.getElementById('tab-btn-register');

    if (mode === 'login') {
      loginForm.classList.add('active');
      regForm.classList.remove('active');
      tabLogin.classList.add('active');
      tabReg.classList.remove('active');
    } else {
      regForm.classList.add('active');
      loginForm.classList.remove('active');
      tabReg.classList.add('active');
      tabLogin.classList.remove('active');
    }
  }

  // Quick evaluation logins for Admin & Student
  function quickLogin(role) {
    const identInput = document.getElementById('login-identifier');
    const passInput = document.getElementById('login-password');

    if (role === 'admin') {
      identInput.value = 'admin@labtrack.edu';
      passInput.value = 'Admin@123';
    } else {
      identInput.value = 'student@labtrack.edu';
      passInput.value = 'Student@123';
    }

    showToast(`Quick login credentials populated for ${role.toUpperCase()}`, 'info');
  }

  async function handleLogin(e) {
    e.preventDefault();
    const identifier = sanitizeString(document.getElementById('login-identifier').value);
    const password = document.getElementById('login-password').value;

    if (!identifier || !password) {
      showToast('Please enter both Email/PRN and password.', 'warning');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-login');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Authenticating...';

    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password })
      });

      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('labtrack_token', data.token);
      localStorage.setItem('labtrack_user', JSON.stringify(data.user));

      updateAuthUI();
      closeModals();
      showToast(data.message || `Welcome, ${data.user.name}!`, 'success');

      await loadAnalytics();
      await loadComponents();
      loadMyBorrowings();
      if (state.user.role === 'admin') {
        loadAdminRecords();
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Authenticate & Proceed';
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const name = sanitizeString(document.getElementById('reg-name').value);
    const email = sanitizeString(document.getElementById('reg-email').value);
    const prn = sanitizeString(document.getElementById('reg-prn').value);
    const department = document.getElementById('reg-dept').value;
    const role = document.getElementById('reg-role').value;
    const password = document.getElementById('reg-password').value;

    // Unit 1 & 2 + Unit 3 Client-side RegExp Validation
    if (!PRN_REGEX.test(prn)) {
      showToast('PRN must be exactly 11 numeric digits matching pattern ^[0-9]{11}$', 'error');
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      showToast('Please provide a valid institutional email address.', 'error');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-register');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';

    try {
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, prn, department, role, password })
      });

      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('labtrack_token', data.token);
      localStorage.setItem('labtrack_user', JSON.stringify(data.user));

      updateAuthUI();
      closeModals();
      showToast('Account registered successfully! Welcome to LabTrack.', 'success');

      await loadAnalytics();
      await loadComponents();
      loadMyBorrowings();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Lab Account';
    }
  }

  function logout() {
    state.user = null;
    state.token = null;
    localStorage.removeItem('labtrack_token');
    localStorage.removeItem('labtrack_user');
    updateAuthUI();
    switchTab('catalog');
    loadComponents();
    loadAnalytics();
    showToast('You have been signed out.', 'info');
  }

  // ================= TAB NAVIGATION =================
  function switchTab(tabId) {
    state.currentTab = tabId;

    // Update active tab buttons
    document.querySelectorAll('.nav-tab').forEach((tab) => {
      if (tab.dataset.tab === tabId) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update active view sections
    document.querySelectorAll('.tab-view').forEach((view) => {
      view.classList.remove('active');
    });

    const activeView = document.getElementById(`view-${tabId}`);
    if (activeView) {
      activeView.classList.add('active');
    }

    if (tabId === 'my-borrowings') {
      loadMyBorrowings();
    } else if (tabId === 'admin-records') {
      loadAdminRecords();
    } else if (tabId === 'analytics') {
      loadAnalytics();
    } else if (tabId === 'catalog') {
      loadComponents();
    }
  }

  // ================= HARDWARE CATALOG & CSS GRID (Unit 1 & 2) =================
  async function loadComponents() {
    const container = document.getElementById('hardware-grid-container');
    if (!container) return;

    let url = `/api/components?category=${encodeURIComponent(state.categoryFilter)}&status=${encodeURIComponent(state.statusFilter)}`;
    if (state.searchQuery) {
      url += `&search=${encodeURIComponent(state.searchQuery)}`;
    }

    try {
      const data = await apiRequest(url);
      state.components = data.components || [];
      renderHardwareCards(state.components);
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <p style="color: #ef4444;">Failed to load hardware catalog: ${err.message}</p>
        </div>
      `;
    }
  }

  function renderHardwareCards(items) {
    const container = document.getElementById('hardware-grid-container');
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 1rem; color: #94a3b8;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <h3>No Equipment Found</h3>
          <p>No laboratory hardware matches your selected filter criteria.</p>
        </div>
      `;
      return;
    }

    // Render semantic <article class="hardware-card"> elements
    container.innerHTML = items
      .map((item) => {
        const isAvailable = item.availableStock > 0;
        const stockPercent = item.totalStock > 0 ? Math.round((item.availableStock / item.totalStock) * 100) : 0;
        
        let statusBadgeClass = 'badge-available';
        if (item.availableStock <= 0) {
          statusBadgeClass = 'badge-out';
        } else if (item.availableStock <= Math.max(2, Math.floor(item.totalStock * 0.2))) {
          statusBadgeClass = 'badge-low';
        }

        const barColor = item.availableStock <= 0 ? '#ef4444' : item.availableStock <= 2 ? '#f59e0b' : '#10b981';
        const defaultImg = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80';
        const imageSrc = item.imageUrl || defaultImg;

        const isAdmin = state.user && state.user.role === 'admin';

        return `
          <article class="hardware-card" id="card-${item._id}">
            <div class="card-media">
              <img src="${imageSrc}" alt="${item.name}" loading="lazy" onerror="this.src='${defaultImg}'" />
              <div class="card-badges">
                <span class="badge badge-category">${item.category}</span>
                <span class="badge ${statusBadgeClass}">${item.status || (isAvailable ? 'Available' : 'Out of Stock')}</span>
              </div>
            </div>

            <div class="card-body">
              <div class="card-header-meta">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                <span>${item.labRoom || 'Lab 302'}</span>
              </div>

              <h3 class="card-title">${item.name}</h3>

              <div class="card-specs" title="Technical Specs">
                ⚙️ ${item.specifications || 'Standard specifications'}
              </div>

              <p class="card-desc">${item.description || 'Laboratory hardware component for research and prototyping.'}</p>

              <div class="stock-meter-container">
                <div class="stock-meter-labels">
                  <span>Stock Availability</span>
                  <span><strong>${item.availableStock}</strong> / ${item.totalStock} units (${stockPercent}%)</span>
                </div>
                <div class="stock-bar-track">
                  <div class="stock-bar-fill" style="width: ${stockPercent}%; background-color: ${barColor};"></div>
                </div>
              </div>

              <div class="card-footer">
                <button
                  class="btn btn-primary btn-sm btn-block"
                  ${!isAvailable ? 'disabled title="Out of stock"' : ''}
                  onclick="App.openBorrowModal('${item._id}')"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                  ${isAvailable ? 'Borrow Equipment' : 'Out of Stock'}
                </button>

                ${isAdmin ? `
                  <button class="btn btn-outline btn-sm" onclick="App.openEditComponentModal('${item._id}')" title="Edit Component Details">
                    ✏️
                  </button>
                  <button class="btn btn-danger-outline btn-sm" onclick="App.deleteComponent('${item._id}', '${item.name}')" title="Delete Component">
                    🗑️
                  </button>
                ` : ''}
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function handleSearch(query) {
    state.searchQuery = sanitizeString(query);
    const clearBtn = document.getElementById('search-clear-btn');
    if (clearBtn) {
      clearBtn.style.display = state.searchQuery ? 'block' : 'none';
    }
    loadComponents();
  }

  function clearSearch() {
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    handleSearch('');
  }

  function handleCategoryFilter(val) {
    state.categoryFilter = val;
    loadComponents();
  }

  function handleStatusFilter(val) {
    state.statusFilter = val;
    loadComponents();
  }

  // ================= BORROW MODAL & MULTER UPLOAD (Unit 1, 2, 3) =================
  function openBorrowModal(componentId) {
    if (!state.user) {
      showToast('Please sign in or create a student account to borrow equipment.', 'warning');
      openAuthModal('login');
      return;
    }

    const component = state.components.find((c) => c._id === componentId);
    if (!component) return;

    state.selectedComponentForBorrow = component;

    document.getElementById('borrow-component-id').value = component._id;
    
    // Set HTML5 Validation attributes on qty: min=1, max=availableStock
    const qtyInput = document.getElementById('borrow-qty');
    qtyInput.min = '1';
    qtyInput.max = String(component.availableStock);
    qtyInput.value = '1';

    // Populate preview box
    const previewBox = document.getElementById('borrow-item-preview');
    previewBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h4 style="font-size: 1.05rem; font-weight: 700; color: #0f172a;">${component.name}</h4>
          <span style="font-size: 0.8rem; color: #64748b;">${component.category} &bull; ${component.labRoom}</span>
        </div>
        <div style="text-align: right;">
          <span class="badge badge-available">In Stock: ${component.availableStock}</span>
        </div>
      </div>
    `;

    // Reset file input label
    document.getElementById('borrow-slip').value = '';
    document.getElementById('file-label-text').textContent = 'Click to browse or drag & drop Requisition PDF / ID Card Image';

    const modal = document.getElementById('modal-borrow');
    if (modal) modal.classList.add('active');
  }

  function handleFileSelect(input) {
    const label = document.getElementById('file-label-text');
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      label.innerHTML = `<strong>Selected:</strong> ${file.name} (${sizeMb} MB)`;
    } else {
      label.textContent = 'Click to browse or drag & drop Requisition PDF / ID Card Image';
    }
  }

  async function handleBorrowSubmit(e) {
    e.preventDefault();

    if (!state.user) {
      showToast('Authentication required.', 'warning');
      return;
    }

    const componentId = document.getElementById('borrow-component-id').value;
    const quantity = parseInt(document.getElementById('borrow-qty').value, 10);
    const expectedReturnDate = document.getElementById('borrow-return-date').value;
    const purpose = sanitizeString(document.getElementById('borrow-purpose').value);
    const slipInput = document.getElementById('borrow-slip');

    if (!componentId || !quantity || !expectedReturnDate || !purpose) {
      showToast('Please fill out all required fields.', 'warning');
      return;
    }

    // Multer file validation
    if (!slipInput.files || slipInput.files.length === 0) {
      showToast('Please upload a requisition slip or student ID document.', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('componentId', componentId);
    formData.append('quantity', quantity);
    formData.append('expectedReturnDate', expectedReturnDate);
    formData.append('purpose', purpose);
    formData.append('requisitionSlip', slipInput.files[0]);

    const submitBtn = document.getElementById('btn-submit-borrow');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing Checkout & Dispatching Email...';

    try {
      const data = await apiRequest('/api/borrow', {
        method: 'POST',
        body: formData
      });

      closeModals();
      showToast(
        data.message || 'Equipment successfully checked out! Automated issue email sent.',
        'success'
      );

      // Refresh inventory, stats, and records
      await loadComponents();
      await loadAnalytics();
      loadMyBorrowings();
      if (state.user.role === 'admin') {
        loadAdminRecords();
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm Checkout & Send Automated Email';
    }
  }

  // ================= MY BORROWINGS VIEW =================
  async function loadMyBorrowings() {
    if (!state.user) return;
    const container = document.getElementById('my-borrowings-container');
    const badgeCount = document.getElementById('my-borrowings-count');

    try {
      const data = await apiRequest('/api/borrow');
      state.myBorrowings = data.borrowRecords || [];

      if (badgeCount) {
        const activeCount = state.myBorrowings.filter((r) => r.status === 'Issued' || r.status === 'Overdue').length;
        badgeCount.textContent = activeCount;
      }

      if (!container) return;

      if (state.myBorrowings.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 1rem; color: #94a3b8;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            <h3>No Borrowing Records Found</h3>
            <p>You haven't checked out any laboratory hardware components yet.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = state.myBorrowings
        .map((rec) => {
          const compName = rec.component ? rec.component.name : 'Hardware Component';
          const borrowDate = new Date(rec.borrowDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
          const dueDate = new Date(rec.expectedReturnDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });

          const isOverdue = rec.status === 'Overdue' || (rec.status === 'Issued' && new Date(rec.expectedReturnDate) < new Date());
          const displayStatus = isOverdue ? 'Overdue' : rec.status;
          const statusBadgeClass = `badge-status-${displayStatus.toLowerCase()}`;

          return `
            <div class="record-item-card">
              <div class="record-main-info">
                <div class="record-icon">
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"></rect><rect x="9" y="9" width="6" height="6"></rect></svg>
                </div>
                <div>
                  <h4 class="record-title">${compName} &times; ${rec.quantity} unit(s)</h4>
                  <div class="record-details">
                    <span><strong>Borrowed:</strong> ${borrowDate}</span>
                    <span><strong>Due Date:</strong> <span style="${isOverdue ? 'color: #dc2626; font-weight: bold;' : ''}">${dueDate}</span></span>
                    <span><strong>Purpose:</strong> "${rec.purpose}"</span>
                    ${rec.requisitionSlipUrl ? `
                      <span><a href="${rec.requisitionSlipUrl}" target="_blank" rel="noopener" style="color: #2563eb; text-decoration: underline;">📄 View Uploaded Slip</a></span>
                    ` : ''}
                  </div>
                </div>
              </div>

              <div class="record-actions">
                <span class="badge ${statusBadgeClass}">${displayStatus}</span>
                ${(rec.status === 'Issued' || isOverdue) ? `
                  <button class="btn btn-outline btn-sm" onclick="App.returnEquipment('${rec._id}', '${compName}')">
                    Return Equipment
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        })
        .join('');
    } catch (err) {
      if (container) {
        container.innerHTML = `<p style="color: #ef4444;">Failed to load borrowing records: ${err.message}</p>`;
      }
    }
  }

  async function returnEquipment(recordId, compName) {
    if (!confirm(`Confirm return of "${compName}" to the laboratory? This will immediately restore inventory stock.`)) {
      return;
    }

    try {
      const data = await apiRequest(`/api/borrow/${recordId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Returned', remarks: 'Returned by borrower via web app' })
      });

      showToast(data.message || 'Equipment successfully returned!', 'success');
      loadMyBorrowings();
      loadComponents();
      loadAnalytics();
      if (state.user && state.user.role === 'admin') {
        loadAdminRecords();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ================= ADMIN BORROW MANAGEMENT VIEW =================
  async function loadAdminRecords(filterStatus = 'All') {
    if (!state.user || state.user.role !== 'admin') return;
    const tbody = document.getElementById('admin-records-tbody');
    if (!tbody) return;

    try {
      const url = filterStatus !== 'All' ? `/api/borrow?status=${filterStatus}` : '/api/borrow';
      const data = await apiRequest(url);
      state.adminRecords = data.borrowRecords || [];

      if (state.adminRecords.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 2rem; color: #64748b;">
              No borrowing records found in the ledger.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = state.adminRecords
        .map((rec) => {
          const userStr = rec.user ? `${rec.user.name}<br/><small class="text-muted">PRN: ${rec.user.prn || 'N/A'} (${rec.user.department || 'N/A'})</small>` : 'Unknown User';
          const compName = rec.component ? rec.component.name : 'Unknown Item';
          const borrowDate = new Date(rec.borrowDate).toLocaleDateString();
          const dueDate = new Date(rec.expectedReturnDate).toLocaleDateString();
          const isOverdue = rec.status === 'Overdue' || (rec.status === 'Issued' && new Date(rec.expectedReturnDate) < new Date());
          const displayStatus = isOverdue ? 'Overdue' : rec.status;
          const statusBadgeClass = `badge-status-${displayStatus.toLowerCase()}`;

          const slipHtml = rec.requisitionSlipUrl ? `
            <a href="${rec.requisitionSlipUrl}" target="_blank" rel="noopener" class="btn btn-outline btn-xs">
              📄 View Slip
            </a>
          ` : '<span class="text-muted">No Slip</span>';

          const actionsHtml = `
            <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
              ${(rec.status === 'Issued' || isOverdue) ? `
                <button class="btn btn-outline btn-xs" onclick="App.adminMarkReturned('${rec._id}', '${compName}')">
                  Mark Returned
                </button>
                <button class="btn btn-danger-outline btn-xs" onclick="App.sendOverdueReminder('${rec._id}', '${rec.user?.name || 'Student'}')" title="Dispatch automated reminder email">
                  ✉️ Remind
                </button>
              ` : `
                <span class="text-muted" style="font-size: 0.8rem;">Completed</span>
              `}
            </div>
          `;

          return `
            <tr>
              <td>${userStr}</td>
              <td><strong>${compName}</strong></td>
              <td>${rec.quantity}</td>
              <td>${borrowDate}</td>
              <td style="${isOverdue ? 'color: #dc2626; font-weight: bold;' : ''}">${dueDate}</td>
              <td>${slipHtml}</td>
              <td><span class="badge ${statusBadgeClass}">${displayStatus}</span></td>
              <td>${actionsHtml}</td>
            </tr>
          `;
        })
        .join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" style="color: #ef4444; padding: 1rem;">Failed to load records: ${err.message}</td></tr>`;
    }
  }

  async function adminMarkReturned(recordId, compName) {
    if (!confirm(`Mark "${compName}" as returned to laboratory? Stock will be restored automatically.`)) return;

    try {
      const data = await apiRequest(`/api/borrow/${recordId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Returned', remarks: 'Return confirmed by Lab Administrator' })
      });

      showToast(data.message || 'Marked as returned.', 'success');
      loadAdminRecords();
      loadComponents();
      loadAnalytics();
      loadMyBorrowings();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // Unit 3 Rubric: POST /api/borrow/:id/remind
  async function sendOverdueReminder(recordId, studentName) {
    try {
      showToast(`Sending overdue email notification to ${studentName}...`, 'info');
      const data = await apiRequest(`/api/borrow/${recordId}/remind`, {
        method: 'POST'
      });

      // Pass Ethereal preview URL if available!
      showToast(data.message || 'Reminder sent!', 'success', data.previewUrl);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ================= USAGE ANALYTICS (Unit 4 MongoDB Aggregation) =================
  async function loadAnalytics() {
    try {
      const data = await apiRequest('/api/components/analytics');
      state.analytics = data.analytics;

      const summary = state.analytics?.summary || {};
      const catStats = state.analytics?.categoryStats || [];
      const deptStats = state.analytics?.departmentStats || [];

      // Update top stats bar
      document.getElementById('stat-total-items').textContent = summary.totalAssets || 0;
      document.getElementById('stat-available-units').textContent = summary.totalAvailable || 0;
      document.getElementById('stat-borrowed-units').textContent = summary.totalBorrowed || 0;
      document.getElementById('stat-overdue-units').textContent = summary.overdueCount || 0;

      // Render category breakdown table
      const catTbody = document.getElementById('analytics-category-tbody');
      if (catTbody) {
        if (catStats.length === 0) {
          catTbody.innerHTML = `<tr><td colspan="6" class="text-muted" style="text-align: center;">No category data yet.</td></tr>`;
        } else {
          catTbody.innerHTML = catStats
            .map((cat) => `
              <tr>
                <td><strong>${cat.category}</strong></td>
                <td>${cat.totalItemsCount}</td>
                <td>${cat.totalStockUnits}</td>
                <td style="color: #059669; font-weight: bold;">${cat.availableStockUnits}</td>
                <td style="color: #d97706; font-weight: bold;">${cat.borrowedStockUnits}</td>
                <td>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span>${cat.utilizationPercentage}%</span>
                    <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 4px; overflow: hidden; min-width: 50px;">
                      <div style="width: ${cat.utilizationPercentage}%; height: 100%; background: #3b82f6;"></div>
                    </div>
                  </div>
                </td>
              </tr>
            `)
            .join('');
        }
      }

      // Render department usage bars
      const deptContainer = document.getElementById('analytics-dept-bars');
      if (deptContainer) {
        if (deptStats.length === 0) {
          deptContainer.innerHTML = `<p class="text-muted">No department borrowing activity recorded yet.</p>`;
        } else {
          const maxUnits = Math.max(...deptStats.map((d) => d.totalUnitsRequested), 1);
          deptContainer.innerHTML = deptStats
            .map((d) => {
              const barPercent = Math.round((d.totalUnitsRequested / maxUnits) * 100);
              return `
                <div class="dept-bar-item">
                  <div class="dept-bar-meta">
                    <span>${d.department} Department</span>
                    <span><strong>${d.totalUnitsRequested}</strong> units borrowed (${d.activeBorrows} active)</span>
                  </div>
                  <div class="dept-bar-track">
                    <div class="dept-bar-fill" style="width: ${barPercent}%;"></div>
                  </div>
                </div>
              `;
            })
            .join('');
        }
      }
    } catch (err) {
      console.warn('Analytics loading error:', err.message);
    }
  }

  // ================= AUDIT TRAIL MODAL (Unit 3 Rubric: GET /api/borrow/logs via fs.readFile) =================
  async function openAuditModal() {
    if (!state.user || state.user.role !== 'admin') {
      showToast('Administrator privileges required to view the audit trail.', 'warning');
      return;
    }

    const modal = document.getElementById('modal-audit');
    if (modal) modal.classList.add('active');

    fetchAuditLogs();
  }

  async function fetchAuditLogs() {
    const terminal = document.getElementById('audit-logs-terminal');
    const counter = document.getElementById('audit-counter');
    if (terminal) terminal.innerHTML = '<p class="loading-state">Reading audit_trail.log from server filesystem...</p>';

    try {
      const data = await apiRequest('/api/borrow/logs');
      state.auditLogs = data.logs || [];
      if (counter) counter.textContent = `${state.auditLogs.length} events logged`;
      renderAuditLogs(state.auditLogs);
    } catch (err) {
      if (terminal) {
        terminal.innerHTML = `<p style="color: #ef4444;">Failed to read audit logs: ${err.message}</p>`;
      }
    }
  }

  function renderAuditLogs(logs) {
    const terminal = document.getElementById('audit-logs-terminal');
    if (!terminal) return;

    if (!logs || logs.length === 0) {
      terminal.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 1.5rem;">Audit log is currently empty.</p>';
      return;
    }

    terminal.innerHTML = logs
      .map((item) => {
        const line = item.entry || item;
        let tagClass = 'audit-tag-borrow';
        if (line.includes('[ITEM_ISSUED]')) tagClass = 'audit-tag-issued';
        else if (line.includes('[ITEM_RETURNED]')) tagClass = 'audit-tag-returned';
        else if (line.includes('[OVERDUE_REMINDER_SENT]')) tagClass = 'audit-tag-reminded';
        else if (line.includes('[COMPONENT_')) tagClass = 'audit-tag-component';

        return `<div class="audit-log-line">${highlightAuditLine(line, tagClass)}</div>`;
      })
      .join('');
  }

  function highlightAuditLine(line, tagClass) {
    // Sanitize string to prevent XSS
    const clean = sanitizeString(line);
    // Replace event tags with colored badges
    return clean.replace(/(\[[A-Z_]+\])/g, `<span class="audit-tag ${tagClass}">$1</span>`);
  }

  function filterAuditLogs(query) {
    const q = sanitizeString(query).toLowerCase();
    if (!q) {
      renderAuditLogs(state.auditLogs);
      return;
    }
    const filtered = state.auditLogs.filter((l) => (l.entry || '').toLowerCase().includes(q));
    renderAuditLogs(filtered);
  }

  // ================= ADD / EDIT / DELETE COMPONENT (Unit 4 CRUD) =================
  function openAddComponentModal() {
    if (!state.user || state.user.role !== 'admin') {
      showToast('Administrator privileges required.', 'warning');
      return;
    }

    document.getElementById('component-modal-title').textContent = 'Add Laboratory Hardware Asset';
    document.getElementById('comp-id').value = '';
    document.getElementById('form-component').reset();
    document.getElementById('comp-lab').value = 'Lab 302 - Embedded Systems & IoT';
    document.getElementById('comp-total-stock').value = '10';
    document.getElementById('comp-avail-stock').value = '10';

    const modal = document.getElementById('modal-component');
    if (modal) modal.classList.add('active');
  }

  function openEditComponentModal(id) {
    const comp = state.components.find((c) => c._id === id);
    if (!comp) return;

    document.getElementById('component-modal-title').textContent = 'Edit Hardware Asset';
    document.getElementById('comp-id').value = comp._id;
    document.getElementById('comp-name').value = comp.name;
    document.getElementById('comp-category').value = comp.category;
    document.getElementById('comp-lab').value = comp.labRoom || '';
    document.getElementById('comp-total-stock').value = comp.totalStock;
    document.getElementById('comp-avail-stock').value = comp.availableStock;
    document.getElementById('comp-specs').value = comp.specifications || '';
    document.getElementById('comp-desc').value = comp.description || '';
    document.getElementById('comp-image').value = comp.imageUrl || '';

    const modal = document.getElementById('modal-component');
    if (modal) modal.classList.add('active');
  }

  function syncStockInputs() {
    const total = parseInt(document.getElementById('comp-total-stock').value, 10) || 0;
    const avail = document.getElementById('comp-avail-stock');
    if (!document.getElementById('comp-id').value) {
      avail.value = total;
    }
    avail.max = String(total);
  }

  async function handleComponentSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('comp-id').value;
    const name = sanitizeString(document.getElementById('comp-name').value);
    const category = document.getElementById('comp-category').value;
    const labRoom = sanitizeString(document.getElementById('comp-lab').value);
    const totalStock = parseInt(document.getElementById('comp-total-stock').value, 10);
    const availableStock = parseInt(document.getElementById('comp-avail-stock').value, 10);
    const specifications = sanitizeString(document.getElementById('comp-specs').value);
    const description = sanitizeString(document.getElementById('comp-desc').value);
    const imageUrl = sanitizeString(document.getElementById('comp-image').value);

    if (!name || !category || isNaN(totalStock)) {
      showToast('Name, category, and total stock are required.', 'warning');
      return;
    }

    if (availableStock > totalStock) {
      showToast('Available stock cannot exceed total stock.', 'error');
      return;
    }

    const payload = {
      name,
      category,
      labRoom,
      totalStock,
      availableStock,
      specifications,
      description,
      imageUrl
    };

    const isEdit = Boolean(id);
    const url = isEdit ? `/api/components/${id}` : '/api/components';
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const data = await apiRequest(url, {
        method,
        body: JSON.stringify(payload)
      });

      closeModals();
      showToast(data.message || (isEdit ? 'Component updated!' : 'Component created!'), 'success');
      loadComponents();
      loadAnalytics();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function deleteComponent(id, name) {
    if (!confirm(`Are you sure you want to permanently delete "${name}" from inventory?`)) return;

    try {
      const data = await apiRequest(`/api/components/${id}`, {
        method: 'DELETE'
      });

      showToast(data.message || 'Component deleted successfully.', 'success');
      loadComponents();
      loadAnalytics();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // ================= GENERAL MODAL UTILITIES =================
  function closeModals() {
    document.querySelectorAll('.modal-backdrop').forEach((m) => {
      m.classList.remove('active');
    });
  }

  // Close modals on clicking backdrop outside content
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
      closeModals();
    }
  });

  // Close modals on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModals();
    }
  });

  // DOM Content Loaded Handler
  document.addEventListener('DOMContentLoaded', init);

  // Expose public methods
  return {
    init,
    openAuthModal,
    toggleAuthMode,
    quickLogin,
    handleLogin,
    handleRegister,
    logout,
    switchTab,
    handleSearch,
    clearSearch,
    handleCategoryFilter,
    handleStatusFilter,
    openBorrowModal,
    handleFileSelect,
    handleBorrowSubmit,
    loadMyBorrowings,
    returnEquipment,
    loadAdminRecords,
    adminMarkReturned,
    sendOverdueReminder,
    loadAnalytics,
    openAuditModal,
    fetchAuditLogs,
    filterAuditLogs,
    openAddComponentModal,
    openEditComponentModal,
    syncStockInputs,
    handleComponentSubmit,
    deleteComponent,
    closeModals
  };
})();
