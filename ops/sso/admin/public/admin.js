import {
  PAGE_SIZE,
  ROLE_DESCRIPTIONS,
  applicationSummary,
  filterUsers,
  paginateUsers,
  roleLabel,
  userMetrics,
} from './ui-model.js';

const state = {
  csrfToken: '',
  actor: null,
  users: [],
  revision: '',
  authorization: { roles: [], applications: [], chiefAdminRole: 'chief-admin' },
  filters: { query: '', role: 'all', status: 'all', application: 'all' },
  page: 1,
  selectedUsername: null,
};

const elements = {
  actor: document.querySelector('#actor'),
  message: document.querySelector('#message'),
  users: document.querySelector('#users'),
  emptyState: document.querySelector('#empty-state'),
  resultCount: document.querySelector('#result-count'),
  pageStatus: document.querySelector('#page-status'),
  previousPage: document.querySelector('#previous-page'),
  nextPage: document.querySelector('#next-page'),
  search: document.querySelector('#search'),
  roleFilter: document.querySelector('#role-filter'),
  statusFilter: document.querySelector('#status-filter'),
  applicationFilter: document.querySelector('#application-filter'),
  refresh: document.querySelector('#refresh'),
  openCreate: document.querySelector('#open-create'),
  createDialog: document.querySelector('#create-dialog'),
  createForm: document.querySelector('#create-form'),
  createSubmit: document.querySelector('#create-submit'),
  createAuthorization: document.querySelector('#create-authorization'),
  userDialog: document.querySelector('#user-dialog'),
  userForm: document.querySelector('#user-form'),
  selectedDisplayName: document.querySelector('#selected-display-name'),
  selectedUsername: document.querySelector('#selected-username'),
  editDisplayName: document.querySelector('#edit-display-name'),
  editEmail: document.querySelector('#edit-email'),
  editAuthorization: document.querySelector('#edit-authorization'),
  editDisabled: document.querySelector('#edit-disabled'),
  editLockNote: document.querySelector('#edit-lock-note'),
  saveUser: document.querySelector('#save-user'),
  resetPassword: document.querySelector('#reset-password'),
  dangerZone: document.querySelector('.danger-zone'),
  credentialDialog: document.querySelector('#credential-dialog'),
  credentialUsername: document.querySelector('#credential-username'),
  credentialPassword: document.querySelector('#credential-password'),
  copyPassword: document.querySelector('#copy-password'),
  metrics: {
    total: document.querySelector('#metric-total'),
    active: document.querySelector('#metric-active'),
    administrators: document.querySelector('#metric-administrators'),
    disabled: document.querySelector('#metric-disabled'),
  },
};

let createAssignmentControls;
let editAssignmentControls;
let messageTimer;
const dialogTriggers = new WeakMap();

function showMessage(text, tone = 'success') {
  window.clearTimeout(messageTimer);
  elements.message.textContent = text;
  elements.message.dataset.tone = tone;
  elements.message.hidden = false;
  messageTimer = window.setTimeout(() => {
    elements.message.hidden = true;
  }, tone === 'error' ? 9000 : 6000);
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body) headers.set('Content-Type', 'application/json');
  if (options.method && options.method !== 'GET') {
    headers.set('X-CSRF-Token', state.csrfToken);
    headers.set('If-Match', state.revision);
  }
  const response = await fetch(`/sso/admin/api${path}`, {
    cache: 'no-store',
    credentials: 'same-origin',
    ...options,
    headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `요청 실패 (${response.status})`);
    error.status = response.status;
    error.code = payload.error;
    throw error;
  }
  return payload;
}

function isChiefAdmin() {
  return state.actor?.role === state.authorization.chiefAdminRole;
}

function assignmentControls(
  selectedRole = 'user',
  selectedApplications = [],
  { lockRole = false, lockAll = false } = {},
) {
  const wrapper = document.createElement('div');
  wrapper.className = 'authorization-fields';

  const roleLabelElement = document.createElement('label');
  roleLabelElement.className = 'role-select-label';
  roleLabelElement.append(document.createTextNode('역할'));
  const roleSelect = document.createElement('select');
  roleSelect.className = 'role-select';
  const availableRoles = isChiefAdmin()
    ? state.authorization.roles
    : state.authorization.roles.filter((role) => role === 'user' || role === selectedRole);
  for (const role of availableRoles) {
    const option = document.createElement('option');
    option.value = role;
    option.textContent = roleLabel(role);
    option.selected = role === selectedRole;
    roleSelect.append(option);
  }
  roleSelect.disabled = lockRole || lockAll;
  const roleDescription = document.createElement('p');
  roleDescription.className = 'role-description';
  roleLabelElement.append(roleSelect, roleDescription);

  const applicationsFieldset = document.createElement('fieldset');
  applicationsFieldset.className = 'application-fieldset';
  const legend = document.createElement('legend');
  legend.textContent = '서비스 접근';
  const hint = document.createElement('p');
  hint.className = 'field-hint';
  const applicationGrid = document.createElement('div');
  applicationGrid.className = 'application-grid';
  const applicationInputs = new Map();
  const rememberedApplications = new Set(
    selectedRole === state.authorization.chiefAdminRole ? [] : selectedApplications,
  );

  for (const application of state.authorization.applications) {
    const label = document.createElement('label');
    label.className = 'check-row';
    const field = document.createElement('input');
    field.type = 'checkbox';
    field.value = application.id;
    field.checked = selectedApplications.includes(application.id);
    label.append(field, document.createTextNode(application.label));
    applicationInputs.set(application.id, field);
    field.addEventListener('change', () => {
      if (field.checked) rememberedApplications.add(application.id);
      else rememberedApplications.delete(application.id);
    });
    applicationGrid.append(label);
  }

  const synchronize = () => {
    const role = roleSelect.value;
    const chief = role === state.authorization.chiefAdminRole;
    roleDescription.textContent = ROLE_DESCRIPTIONS[role] ?? '';
    hint.textContent = chief ? '모든 서비스가 자동으로 허용됩니다.' : '허용할 서비스만 선택하세요.';
    for (const field of applicationInputs.values()) {
      field.disabled = chief || lockAll;
      field.checked = chief || rememberedApplications.has(field.value);
    }
  };
  roleSelect.addEventListener('change', synchronize);
  synchronize();

  applicationsFieldset.append(legend, hint, applicationGrid);
  wrapper.append(roleLabelElement, applicationsFieldset);
  return {
    element: wrapper,
    value: () => ({
      role: roleSelect.value,
      applications: roleSelect.value === state.authorization.chiefAdminRole
        ? []
        : state.authorization.applications
          .map((application) => application.id)
          .filter((id) => applicationInputs.get(id).checked),
    }),
    reset: () => {
      roleSelect.value = 'user';
      rememberedApplications.clear();
      for (const field of applicationInputs.values()) field.checked = false;
      synchronize();
    },
  };
}

function openDialog(dialog, trigger) {
  dialogTriggers.set(dialog, trigger ?? document.activeElement);
  dialog.showModal();
  window.requestAnimationFrame(() => {
    const focusTarget = dialog.querySelector('[autofocus]:not(:disabled)')
      ?? dialog.querySelector('input:not(:disabled), select:not(:disabled), button:not(:disabled)');
    focusTarget?.focus();
  });
}

function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}

for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('close', () => {
    dialogTriggers.get(dialog)?.focus?.();
    dialogTriggers.delete(dialog);
    if (dialog === elements.userDialog) {
      state.selectedUsername = null;
      for (const row of elements.users.querySelectorAll('.user-row')) row.setAttribute('aria-selected', 'false');
    }
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog(dialog);
  });
}

for (const button of document.querySelectorAll('[data-close-dialog]')) {
  button.addEventListener('click', () => closeDialog(button.closest('dialog')));
}

function showCredential(username, password, trigger = document.activeElement) {
  elements.credentialUsername.textContent = username;
  elements.credentialPassword.textContent = password;
  openDialog(elements.credentialDialog, trigger);
}

function updateMetrics() {
  const metrics = userMetrics(state.users);
  for (const [key, value] of Object.entries(metrics)) elements.metrics[key].textContent = String(value);
}

function userRow(user, tabStop) {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'user-row';
  row.dataset.username = user.username;
  row.tabIndex = tabStop ? 0 : -1;
  row.setAttribute('role', 'option');
  row.setAttribute('aria-selected', String(user.username === state.selectedUsername));

  const identity = document.createElement('span');
  identity.className = 'user-identity';
  const name = document.createElement('strong');
  name.textContent = user.displayName || user.username;
  const detail = document.createElement('span');
  detail.textContent = `@${user.username} · ${user.email}`;
  identity.append(name, detail);

  const role = document.createElement('span');
  role.className = 'role-badge';
  role.textContent = roleLabel(user.role);

  const services = document.createElement('span');
  services.className = 'service-summary';
  const summary = applicationSummary(user, state.authorization.applications);
  if (summary.labels.length === 0) {
    const chip = document.createElement('span');
    chip.className = 'service-chip';
    chip.textContent = '권한 없음';
    services.append(chip);
  } else {
    for (const label of summary.labels) {
      const chip = document.createElement('span');
      chip.className = 'service-chip';
      chip.textContent = label;
      services.append(chip);
    }
  }
  if (summary.overflow > 0) {
    const more = document.createElement('span');
    more.className = 'more-chip';
    more.textContent = `+${summary.overflow}`;
    more.setAttribute('aria-label', `추가 서비스 ${summary.overflow}개`);
    services.append(more);
  }

  const status = document.createElement('span');
  status.className = `status-badge ${user.disabled ? 'disabled' : 'active'}`;
  status.textContent = user.disabled ? '비활성' : '활성';
  const action = document.createElement('span');
  action.className = 'row-action';
  action.textContent = '편집';

  row.append(identity, role, services, status, action);
  row.addEventListener('click', () => openUserEditor(user.username, row));
  return row;
}

function renderUsers() {
  const filtered = filterUsers(state.users, state.filters);
  const page = paginateUsers(filtered, state.page, PAGE_SIZE);
  state.page = page.page;
  const selectedVisible = page.users.some((user) => user.username === state.selectedUsername);
  elements.users.replaceChildren(...page.users.map((user, index) => (
    userRow(user, selectedVisible ? user.username === state.selectedUsername : index === 0)
  )));
  elements.emptyState.hidden = filtered.length !== 0;
  const range = filtered.length === 0 ? '0명' : `${page.start + 1}–${page.end}명`;
  elements.resultCount.textContent = `전체 ${state.users.length}명 중 ${filtered.length}명 · ${range} 표시`;
  elements.pageStatus.textContent = `${page.page} / ${page.pageCount}`;
  elements.previousPage.disabled = page.page <= 1;
  elements.nextPage.disabled = page.page >= page.pageCount;
}

function populateApplicationFilter() {
  const options = state.authorization.applications.map((application) => {
    const option = document.createElement('option');
    option.value = application.id;
    option.textContent = application.label;
    return option;
  });
  elements.applicationFilter.append(...options);
}

async function loadUsers() {
  const payload = await request('/users');
  state.users = payload.users;
  state.revision = payload.revision;
  updateMetrics();
  renderUsers();
}

function openUserEditor(username, trigger) {
  const user = state.users.find((candidate) => candidate.username === username);
  if (!user) return;
  state.selectedUsername = username;
  for (const row of elements.users.querySelectorAll('.user-row')) {
    row.setAttribute('aria-selected', String(row === trigger));
    row.tabIndex = row === trigger ? 0 : -1;
  }

  const actorIsSelf = user.username === state.actor.username;
  const privilegedTargetLocked = !isChiefAdmin() && user.role !== 'user';
  const fullyLocked = privilegedTargetLocked;
  elements.selectedDisplayName.textContent = user.displayName || user.username;
  elements.selectedUsername.textContent = `@${user.username}`;
  elements.editDisplayName.value = user.displayName;
  elements.editDisplayName.disabled = fullyLocked;
  elements.editEmail.value = user.email;
  elements.editDisabled.checked = user.disabled;
  elements.editDisabled.disabled = actorIsSelf || fullyLocked;
  elements.editAuthorization.replaceChildren();
  editAssignmentControls = assignmentControls(user.role, user.applications, {
    lockRole: actorIsSelf,
    lockAll: actorIsSelf || fullyLocked,
  });
  elements.editAuthorization.append(editAssignmentControls.element);
  elements.saveUser.disabled = fullyLocked;
  elements.dangerZone.hidden = actorIsSelf || fullyLocked;
  elements.resetPassword.disabled = actorIsSelf || fullyLocked;
  elements.editLockNote.hidden = !(actorIsSelf || fullyLocked);
  if (actorIsSelf) {
    elements.editLockNote.textContent = '내 역할·서비스·상태는 여기서 바꿀 수 없습니다. 비밀번호는 내 정보 화면에서 변경하세요.';
  } else if (fullyLocked) {
    elements.editLockNote.textContent = '관리자 계정은 최고 관리자만 변경할 수 있습니다.';
  }
  openDialog(elements.userDialog, trigger);
}

function resetFilters() {
  state.page = 1;
  state.filters = {
    query: elements.search.value,
    role: elements.roleFilter.value,
    status: elements.statusFilter.value,
    application: elements.applicationFilter.value,
  };
  renderUsers();
}

for (const field of [elements.search, elements.roleFilter, elements.statusFilter, elements.applicationFilter]) {
  field.addEventListener('input', resetFilters);
  field.addEventListener('change', resetFilters);
}

elements.users.addEventListener('keydown', (event) => {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  const rows = [...elements.users.querySelectorAll('.user-row')];
  if (rows.length === 0) return;
  const current = Math.max(0, rows.indexOf(document.activeElement));
  const next = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? rows.length - 1
      : event.key === 'ArrowDown'
        ? Math.min(rows.length - 1, current + 1)
        : Math.max(0, current - 1);
  event.preventDefault();
  for (const row of rows) row.tabIndex = row === rows[next] ? 0 : -1;
  rows[next].focus();
});

elements.previousPage.addEventListener('click', () => {
  state.page -= 1;
  renderUsers();
  elements.users.querySelector('.user-row')?.focus();
});
elements.nextPage.addEventListener('click', () => {
  state.page += 1;
  renderUsers();
  elements.users.querySelector('.user-row')?.focus();
});

elements.refresh.addEventListener('click', async () => {
  elements.refresh.disabled = true;
  try {
    await loadUsers();
    showMessage('최신 사용자 목록을 불러왔습니다.');
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    elements.refresh.disabled = false;
  }
});

elements.openCreate.addEventListener('click', () => {
  elements.createForm.reset();
  createAssignmentControls.reset();
  openDialog(elements.createDialog, elements.openCreate);
});

elements.createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  elements.createSubmit.disabled = true;
  try {
    const data = new FormData(elements.createForm);
    const assignment = createAssignmentControls.value();
    const payload = await request('/users', {
      method: 'POST',
      body: JSON.stringify({
        username: data.get('username'),
        displayName: data.get('displayName'),
        email: data.get('email'),
        role: assignment.role,
        applications: assignment.applications,
      }),
    });
    state.revision = payload.revision;
    closeDialog(elements.createDialog);
    showCredential(payload.user.username, payload.temporaryPassword, elements.openCreate);
    showMessage(`${payload.user.username} 계정을 만들었습니다.`);
    await loadUsers();
  } catch (error) {
    showMessage(error.message, 'error');
    if (error.code === 'stale_revision' || error.code === 'database_changed') {
      await loadUsers().catch(() => undefined);
    }
  } finally {
    elements.createSubmit.disabled = false;
  }
});

elements.userForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const user = state.users.find((candidate) => candidate.username === state.selectedUsername);
  if (!user || !editAssignmentControls) return;
  elements.saveUser.disabled = true;
  try {
    const assignment = editAssignmentControls.value();
    await request(`/users/${encodeURIComponent(user.username)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        displayName: elements.editDisplayName.value,
        role: assignment.role,
        applications: assignment.applications,
        disabled: elements.editDisabled.checked,
      }),
    });
    closeDialog(elements.userDialog);
    showMessage(`${user.username} 계정을 변경했습니다.`);
    await loadUsers();
    const updatedRow = [...elements.users.querySelectorAll('.user-row')]
      .find((row) => row.dataset.username === user.username);
    (updatedRow ?? elements.refresh).focus();
  } catch (error) {
    if (error.code === 'stale_revision' || error.code === 'database_changed') {
      await loadUsers().catch(() => undefined);
      dialogTriggers.set(elements.userDialog, elements.refresh);
      closeDialog(elements.userDialog);
      showMessage('다른 관리자의 변경을 반영했습니다. 목록에서 계정을 다시 선택해 주세요.', 'error');
    } else {
      showMessage(error.message, 'error');
    }
  } finally {
    elements.saveUser.disabled = false;
  }
});

elements.resetPassword.addEventListener('click', async () => {
  const user = state.users.find((candidate) => candidate.username === state.selectedUsername);
  if (!user || !window.confirm(`${user.username} 계정의 기존 비밀번호를 무효화하고 임시 비밀번호를 발급할까요?`)) return;
  elements.resetPassword.disabled = true;
  try {
    const payload = await request(`/users/${encodeURIComponent(user.username)}/reset-password`, {
      method: 'POST',
      body: '{}',
    });
    closeDialog(elements.userDialog);
    showCredential(user.username, payload.temporaryPassword, elements.refresh);
    showMessage(`${user.username} 계정의 임시 비밀번호를 발급했습니다.`);
    await loadUsers();
  } catch (error) {
    if (error.code === 'stale_revision' || error.code === 'database_changed') {
      await loadUsers().catch(() => undefined);
      dialogTriggers.set(elements.userDialog, elements.refresh);
      closeDialog(elements.userDialog);
      showMessage('다른 관리자의 변경을 반영했습니다. 목록에서 계정을 다시 선택해 주세요.', 'error');
    } else {
      showMessage(error.message, 'error');
    }
  } finally {
    elements.resetPassword.disabled = false;
  }
});

elements.copyPassword.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(elements.credentialPassword.textContent);
    showMessage('임시 비밀번호를 클립보드에 복사했습니다.');
  } catch {
    showMessage('복사하지 못했습니다. 표시된 값을 직접 복사하세요.', 'error');
  }
});

elements.credentialDialog.addEventListener('close', () => {
  elements.credentialUsername.textContent = '';
  elements.credentialPassword.textContent = '';
});

async function boot() {
  try {
    const session = await request('/session');
    state.csrfToken = session.csrfToken;
    state.actor = session.actor;
    state.authorization = session.authorization;
    elements.actor.textContent = `${session.actor.displayName || session.actor.username} · ${roleLabel(session.actor.role)}`;
    populateApplicationFilter();
    createAssignmentControls = assignmentControls();
    elements.createAuthorization.replaceChildren(createAssignmentControls.element);
    await loadUsers();
    elements.createSubmit.disabled = false;
    elements.openCreate.disabled = false;
  } catch (error) {
    elements.actor.textContent = '접근할 수 없음';
    showMessage(error.message, 'error');
  }
}

void boot();
