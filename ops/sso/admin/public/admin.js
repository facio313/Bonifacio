const state = {
  csrfToken: '',
  actor: null,
  users: [],
  revision: '',
  authorization: { roles: [], applications: [], chiefAdminRole: 'chief-admin' },
};
const actor = document.querySelector('#actor');
const message = document.querySelector('#message');
const usersRoot = document.querySelector('#users');
const createForm = document.querySelector('#create-form');
const createSubmit = document.querySelector('#create-submit');
const passwordForm = document.querySelector('#password-form');
const passwordSubmit = document.querySelector('#password-submit');
const credentialDialog = document.querySelector('#credential-dialog');
const credentialUsername = document.querySelector('#credential-username');
const credentialPassword = document.querySelector('#credential-password');
const createAuthorizationRoot = document.querySelector('#create-authorization');
const ROLE_LABELS = {
  user: '일반 사용자 · 지정된 앱만 이용',
  admin: '권한 관리자 · 일반 사용자 계정 및 앱 권한 관리',
  'chief-admin': '최고 관리자 · 모든 앱과 관리자 계정 관리',
};

function showMessage(text, tone = 'success') {
  message.textContent = text;
  message.dataset.tone = tone;
  message.hidden = false;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (options.method && options.method !== 'GET') {
    headers.set('X-CSRF-Token', state.csrfToken);
    headers.set('If-Match', state.revision);
  }
  const response = await fetch(`/sso/admin/api${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `요청 실패 (${response.status})`);
  return payload;
}

function input(labelText, value, type = 'text') {
  const label = document.createElement('label');
  label.textContent = labelText;
  const field = document.createElement('input');
  field.type = type;
  field.value = value;
  field.required = true;
  label.append(field);
  return { label, field };
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

  const roleLabel = document.createElement('label');
  roleLabel.className = 'role-select-label';
  roleLabel.append(document.createTextNode('중앙 역할'));
  const roleSelect = document.createElement('select');
  roleSelect.className = 'role-select';
  for (const role of state.authorization.roles) {
    const option = document.createElement('option');
    option.value = role;
    option.textContent = ROLE_LABELS[role] ?? role;
    option.selected = role === selectedRole;
    if (role !== 'user' && !isChiefAdmin()) option.disabled = true;
    roleSelect.append(option);
  }
  roleSelect.disabled = lockRole || lockAll;
  roleLabel.append(roleSelect);

  const applicationsFieldset = document.createElement('fieldset');
  applicationsFieldset.className = 'application-fieldset';
  const legend = document.createElement('legend');
  legend.textContent = '앱 접근 권한';
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
    label.className = 'check-row app-check-row';
    const field = document.createElement('input');
    field.type = 'checkbox';
    field.value = application.id;
    field.checked = selectedApplications.includes(application.id);
    field.defaultChecked = field.checked;
    label.append(field, document.createTextNode(` ${application.label}`));
    applicationInputs.set(application.id, field);
    field.addEventListener('change', () => {
      if (field.checked) rememberedApplications.add(application.id);
      else rememberedApplications.delete(application.id);
    });
    applicationGrid.append(label);
  }

  const synchronize = () => {
    const chief = roleSelect.value === state.authorization.chiefAdminRole;
    hint.textContent = chief
      ? '최고 관리자는 모든 앱에 자동으로 접근합니다.'
      : '체크한 앱만 로그인 후 접근할 수 있습니다.';
    for (const field of applicationInputs.values()) {
      field.disabled = chief || lockAll;
      field.checked = chief || rememberedApplications.has(field.value);
    }
  };
  roleSelect.addEventListener('change', synchronize);
  synchronize();

  applicationsFieldset.append(legend, hint, applicationGrid);
  wrapper.append(roleLabel, applicationsFieldset);
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
      for (const field of applicationInputs.values()) {
        field.checked = false;
        field.defaultChecked = false;
      }
      rememberedApplications.clear();
      synchronize();
    },
  };
}

let createAssignmentControls;

function showCredential(username, password) {
  credentialUsername.textContent = username;
  credentialPassword.textContent = password;
  credentialDialog.showModal();
}

function renderUsers() {
  usersRoot.replaceChildren();
  for (const user of state.users) {
    const card = document.createElement('article');
    card.className = 'user-card';

    const heading = document.createElement('div');
    heading.className = 'user-heading';
    const identity = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = user.username;
    const badge = document.createElement('span');
    badge.className = `badge ${user.disabled ? 'disabled' : 'active'}`;
    badge.textContent = user.disabled ? '비활성' : '활성';
    identity.append(title, badge);
    const authorizationSummary = document.createElement('small');
    const roleLabel = ROLE_LABELS[user.role]?.split(' · ')[0] ?? user.role;
    authorizationSummary.textContent = user.role === state.authorization.chiefAdminRole
      ? `${roleLabel} · 모든 앱`
      : `${roleLabel} · ${user.applications.length > 0
        ? user.applications.map((id) => (
          state.authorization.applications.find((application) => application.id === id)?.label ?? id
        )).join(', ')
        : '앱 권한 없음'}`;
    heading.append(identity, authorizationSummary);

    const form = document.createElement('form');
    form.className = 'user-form';
    const displayName = input('표시 이름', user.displayName);
    const email = input('이메일 (변경하려면 새 계정을 발급하세요)', user.email, 'email');
    email.field.disabled = true;
    const actorIsSelf = user.username === state.actor.username;
    const privilegedTargetLocked = !isChiefAdmin() && user.role !== 'user';
    const assignment = assignmentControls(user.role, user.applications, {
      lockAll: actorIsSelf || privilegedTargetLocked,
    });
    const disabledLabel = document.createElement('label');
    disabledLabel.className = 'check-row';
    const disabledInput = document.createElement('input');
    disabledInput.type = 'checkbox';
    disabledInput.checked = user.disabled;
    disabledInput.disabled = actorIsSelf || privilegedTargetLocked;
    disabledLabel.append(disabledInput, document.createTextNode(' 로그인 비활성화'));

    const actions = document.createElement('div');
    actions.className = 'actions';
    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = '변경 저장';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'secondary';
    reset.textContent = '임시 비밀번호 재발급';
    actions.append(save, reset);
    if (privilegedTargetLocked) {
      displayName.field.disabled = true;
      save.disabled = true;
      reset.disabled = true;
    }
    form.append(displayName.label, email.label, assignment.element, disabledLabel, actions);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      save.disabled = true;
      try {
        const nextAssignment = assignment.value();
        await request(`/users/${encodeURIComponent(user.username)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            displayName: displayName.field.value,
            role: nextAssignment.role,
            applications: nextAssignment.applications,
            disabled: disabledInput.checked,
          }),
        });
        showMessage(`${user.username} 계정을 변경했습니다.`);
        await loadUsers();
      } catch (error) {
        showMessage(error.message, 'error');
      } finally {
        save.disabled = false;
      }
    });

    reset.addEventListener('click', async () => {
      if (!window.confirm(`${user.username} 사용자의 기존 비밀번호를 무효화할까요?`)) return;
      reset.disabled = true;
      try {
        const payload = await request(`/users/${encodeURIComponent(user.username)}/reset-password`, {
          method: 'POST',
          body: '{}',
        });
        showCredential(user.username, payload.temporaryPassword);
        showMessage(`${user.username} 사용자의 임시 비밀번호를 발급했습니다.`);
        await loadUsers();
      } catch (error) {
        showMessage(error.message, 'error');
      } finally {
        reset.disabled = false;
      }
    });

    card.append(heading, form);
    usersRoot.append(card);
  }
}

async function loadUsers() {
  const payload = await request('/users');
  state.users = payload.users;
  state.revision = payload.revision;
  passwordSubmit.disabled = false;
  renderUsers();
}

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(passwordForm);
  const currentPassword = data.get('currentPassword');
  const newPassword = data.get('newPassword');
  const confirmPassword = data.get('confirmPassword');
  if (newPassword !== confirmPassword) {
    showMessage('새 비밀번호 확인이 일치하지 않습니다.', 'error');
    return;
  }
  passwordSubmit.disabled = true;
  try {
    const payload = await request('/account/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    state.revision = payload.revision;
    passwordForm.reset();
    window.location.assign(payload.logoutUrl);
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    passwordSubmit.disabled = false;
  }
});

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = createForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const data = new FormData(createForm);
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
    showCredential(payload.user.username, payload.temporaryPassword);
    showMessage(`${payload.user.username} 계정을 만들었습니다.`);
    createForm.reset();
    createAssignmentControls.reset();
    await loadUsers();
  } catch (error) {
    showMessage(error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#refresh').addEventListener('click', () => {
  loadUsers().catch((error) => showMessage(error.message, 'error'));
});

document.querySelector('#copy-password').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(credentialPassword.textContent);
    showMessage('임시 비밀번호를 클립보드에 복사했습니다.');
  } catch {
    showMessage('클립보드에 복사하지 못했습니다. 표시된 값을 직접 복사하세요.', 'error');
  }
});

credentialDialog.addEventListener('close', () => {
  credentialUsername.textContent = '';
  credentialPassword.textContent = '';
});

async function boot() {
  try {
    const session = await request('/session');
    state.csrfToken = session.csrfToken;
    state.actor = session.actor;
    state.authorization = session.authorization;
    actor.textContent = `${session.actor.displayName || session.actor.username} (${session.actor.username})`;
    createAssignmentControls = assignmentControls();
    createAuthorizationRoot.replaceChildren(createAssignmentControls.element);
    createSubmit.disabled = false;
    await loadUsers();
  } catch (error) {
    actor.textContent = '접근할 수 없음';
    showMessage(error.message, 'error');
  }
}

void boot();
