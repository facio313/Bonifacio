const state = {
  csrfToken: '',
  revision: '',
};

const profileRoot = document.querySelector('#user-profile');
const profileName = document.querySelector('#profile-name');
const profileUsername = document.querySelector('#profile-username');
const profileEmail = document.querySelector('#profile-email');
const roleBadge = document.querySelector('#role-badge');
const roleDescription = document.querySelector('#role-description');
const serviceList = document.querySelector('#service-list');
const adminLink = document.querySelector('#admin-link');
const message = document.querySelector('#message');
const passwordForm = document.querySelector('#password-form');
const passwordSubmit = document.querySelector('#password-submit');

const ROLE_DETAILS = {
  user: {
    label: '일반 사용자',
    description: '내게 허용된 서비스만 이용할 수 있는 계정입니다.',
  },
  admin: {
    label: '관리자',
    description: '일반 사용자 계정과 서비스 접근 권한을 관리할 수 있는 계정입니다.',
  },
  'chief-admin': {
    label: '최고 관리자',
    description: '모든 서비스와 관리자 계정을 관리할 수 있는 계정입니다.',
  },
};

function showMessage(text, tone = 'success') {
  message.textContent = text;
  message.dataset.tone = tone;
  message.hidden = false;
  message.focus({ preventScroll: true });
}

async function readPayload(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return {};
  return response.json().catch(() => ({}));
}

async function loadSession() {
  const response = await fetch('/sso/user/api/session', {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const payload = await readPayload(response);
  if (!response.ok) {
    throw new Error(payload.message || `계정 정보를 불러오지 못했습니다. (${response.status})`);
  }
  if (!payload.profile || typeof payload.profile !== 'object') {
    throw new Error('계정 정보 응답을 확인할 수 없습니다. 다시 로그인해 주세요.');
  }
  return payload;
}

function renderServices(profile, applications) {
  const permittedIds = new Set(Array.isArray(profile.applications) ? profile.applications : []);
  const catalog = Array.isArray(applications) ? applications : [];
  serviceList.replaceChildren();

  const permittedApplications = catalog.filter((application) => (
    application
    && typeof application.id === 'string'
    && typeof application.label === 'string'
    && permittedIds.has(application.id)
  ));

  if (permittedApplications.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'service-placeholder';
    empty.textContent = '현재 이용하도록 지정된 서비스가 없습니다.';
    serviceList.append(empty);
    return;
  }

  for (const application of permittedApplications) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `/${encodeURIComponent(application.id)}/`;
    link.textContent = application.label;
    link.setAttribute('aria-label', `${application.label} 서비스로 이동`);
    item.append(link);
    serviceList.append(item);
  }
}

function renderProfile(payload) {
  const { profile } = payload;
  const role = ROLE_DETAILS[profile.role] || {
    label: '사용자',
    description: '서비스 이용 범위는 계정에 지정된 권한을 따릅니다.',
  };

  profileName.textContent = profile.displayName || profile.username;
  profileUsername.textContent = profile.username;
  profileEmail.textContent = profile.email;
  roleBadge.textContent = role.label;
  roleDescription.textContent = role.description;
  renderServices(profile, payload.applications);

  adminLink.hidden = payload.canManageUsers !== true;
  profileRoot.setAttribute('aria-busy', 'false');
}

async function changePassword(currentPassword, newPassword, confirmPassword) {
  const response = await fetch('/sso/user/api/account/password', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': state.csrfToken,
      'If-Match': state.revision,
    },
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  });
  const payload = await readPayload(response);
  if (!response.ok) {
    const error = new Error(payload.message || `비밀번호를 변경하지 못했습니다. (${response.status})`);
    error.status = response.status;
    error.code = payload.error;
    throw error;
  }
  if (typeof payload.logoutUrl !== 'string' || typeof payload.revision !== 'string') {
    throw new Error('비밀번호는 변경됐을 수 있지만 로그아웃 응답을 확인하지 못했습니다. 다시 로그인해 주세요.');
  }
  return payload;
}

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(passwordForm);
  const currentPassword = String(data.get('currentPassword') || '');
  const newPassword = String(data.get('newPassword') || '');
  const confirmPassword = String(data.get('confirmPassword') || '');

  if (newPassword !== confirmPassword) {
    showMessage('새 비밀번호와 확인 입력이 일치하지 않습니다.', 'error');
    document.querySelector('#confirm-password').focus();
    return;
  }
  if (currentPassword === newPassword) {
    showMessage('현재 비밀번호와 다른 새 비밀번호를 입력하세요.', 'error');
    document.querySelector('#new-password').focus();
    return;
  }
  if (
    Array.from(newPassword).length < 14
    || !/[A-Z]/.test(newPassword)
    || !/[a-z]/.test(newPassword)
    || !/[0-9]/.test(newPassword)
    || !/[\p{P}\p{S}]/u.test(newPassword)
  ) {
    showMessage('새 비밀번호는 14자 이상이며 영문 대문자·소문자, 숫자, 특수문자를 모두 포함해야 합니다.', 'error');
    document.querySelector('#new-password').focus();
    return;
  }

  passwordSubmit.disabled = true;
  try {
    const payload = await changePassword(currentPassword, newPassword, confirmPassword);
    state.revision = payload.revision;
    passwordForm.reset();
    window.location.assign(payload.logoutUrl);
  } catch (error) {
    if (error.code === 'stale_revision' || error.code === 'database_changed') {
      try {
        const payload = await loadSession();
        state.csrfToken = payload.csrfToken;
        state.revision = payload.revision;
        renderProfile(payload);
        passwordForm.reset();
        showMessage('계정 변경 사항을 반영했습니다. 비밀번호를 다시 입력해 주세요.', 'error');
      } catch (refreshError) {
        showMessage(refreshError.message, 'error');
      }
    } else {
      showMessage(error.message, 'error');
    }
  } finally {
    passwordSubmit.disabled = false;
  }
});

async function boot() {
  try {
    const payload = await loadSession();
    state.csrfToken = payload.csrfToken;
    state.revision = payload.revision;
    renderProfile(payload);
    passwordSubmit.disabled = false;
  } catch (error) {
    profileRoot.setAttribute('aria-busy', 'false');
    roleBadge.textContent = '확인 실패';
    showMessage(error.message, 'error');
  }
}

boot();
