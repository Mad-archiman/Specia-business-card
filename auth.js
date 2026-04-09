function $(id) {
  return document.getElementById(id);
}

function setMsg(el, text, kind) {
  if (!el) return;
  el.textContent = text || '';
  el.classList.remove('is-error', 'is-ok');
  if (kind) el.classList.add(kind);
}

function safeJson(res) {
  return res.json().catch(() => ({}));
}

function setLoginLabelFromToken() {
  const link = document.querySelector('.navbar-login');
  if (!link) return;
  try {
    const token = localStorage.getItem('specia_token');
    const name = localStorage.getItem('specia_name');
    if (token && name) link.textContent = `${name}님`;
    else link.textContent = '로그인';
  } catch (_) {}
}

function openModal() {
  const modal = $('auth-modal');
  if (!modal) return;
  modal.classList.add('is-open');
}

function closeModal() {
  const modal = $('auth-modal');
  if (!modal) return;
  modal.classList.remove('is-open');
}

function setTab(tab) {
  const tabLogin = $('auth-tab-login');
  const tabSignup = $('auth-tab-signup');
  const formLogin = $('auth-form-login');
  const formSignup = $('auth-form-signup');
  const title = $('auth-title');

  const isLogin = tab === 'login';
  if (tabLogin) tabLogin.classList.toggle('is-active', isLogin);
  if (tabSignup) tabSignup.classList.toggle('is-active', !isLogin);
  if (tabLogin) tabLogin.setAttribute('aria-selected', String(isLogin));
  if (tabSignup) tabSignup.setAttribute('aria-selected', String(!isLogin));

  if (formLogin) formLogin.style.display = isLogin ? '' : 'none';
  if (formSignup) formSignup.style.display = isLogin ? 'none' : '';
  if (title) title.textContent = isLogin ? '로그인' : '회원가입';
}

async function onLoginSubmit(e) {
  e.preventDefault();
  const email = $('auth-login-email')?.value || '';
  const password = $('auth-login-password')?.value || '';
  const msg = $('auth-msg-login');
  const btn = $('auth-login-submit');

  setMsg(msg, '');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await safeJson(res);
    if (!res.ok || !data.ok) {
      setMsg(msg, data.error || '로그인에 실패했습니다.', 'is-error');
      return;
    }
    try {
      localStorage.setItem('specia_token', data.token);
      localStorage.setItem('specia_role', data.role || '');
      localStorage.setItem('specia_name', data.name || '');
    } catch (_) {}
    setLoginLabelFromToken();
    window.dispatchEvent(new Event('specia:auth-changed'));
    setMsg(msg, '로그인되었습니다.', 'is-ok');
    setTimeout(closeModal, 400);
  } catch (err) {
    setMsg(msg, '네트워크 오류가 발생했습니다.', 'is-error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function onSignupSubmit(e) {
  e.preventDefault();
  const name = $('auth-signup-name')?.value || '';
  const phone = $('auth-signup-phone')?.value || '';
  const email = $('auth-signup-email')?.value || '';
  const password = $('auth-signup-password')?.value || '';
  const msg = $('auth-msg-signup');
  const btn = $('auth-signup-submit');

  setMsg(msg, '');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, password }),
    });
    const data = await safeJson(res);
    if (!res.ok || !data.ok) {
      setMsg(msg, data.error || '회원가입에 실패했습니다.', 'is-error');
      return;
    }
    setMsg(msg, '회원가입이 완료되었습니다. 로그인 탭에서 로그인해주세요.', 'is-ok');
    setTab('login');
  } catch (err) {
    setMsg(msg, '네트워크 오류가 발생했습니다.', 'is-error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function bind() {
  const loginLink = document.querySelector('.navbar-login');
  if (loginLink) {
    loginLink.addEventListener('click', (e) => {
      e.preventDefault();
      // PC에서만 노출되도록 CSS로 처리되어 있지만, 혹시라도 눌리면 모달 띄움
      openModal();
    });
  }

  $('auth-tab-login')?.addEventListener('click', () => setTab('login'));
  $('auth-tab-signup')?.addEventListener('click', () => setTab('signup'));
  $('auth-cancel')?.addEventListener('click', closeModal);
  $('auth-cancel-2')?.addEventListener('click', closeModal);

  $('auth-form-login')?.addEventListener('submit', onLoginSubmit);
  $('auth-form-signup')?.addEventListener('submit', onSignupSubmit);

  const modal = $('auth-modal');
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  setLoginLabelFromToken();
}

bind();

