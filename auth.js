// LVX Academy authentication, enrollment gate, and PayPal return support.
(() => {
  const SUPABASE_URL = 'https://khnhhppjggnuahaipzme.supabase.co';
  // Keep this identical to the verified publishable key used by the existing academy.
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_V55KI5c564HwzTZ-60-J2A_E1MAeaxE';
  const SITE_URL = 'https://fiatlvxcorp38.github.io/LVX-Exam-Leadership-Academy/';

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const $ = (id) => document.getElementById(id);
  let mode = 'signin';
  let academyLoaded = false;
  let checkingSession = false;

  function authMessage(text, isError = false) {
    const el = $('authMessage');
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? '#ffaaa3' : '#e5c77f';
  }

  function checkoutMessage(text, isError = false) {
    const el = $('lvxPayPalMessage');
    if (el) {
      el.textContent = text;
      el.style.color = isError ? '#ffaaa3' : '#e5c77f';
    } else {
      authMessage(text, isError);
    }
  }

  function setMode(next) {
    mode = next;
    const signup = mode === 'signup';
    $('authTitle').textContent = signup ? 'Create Student Account' : 'Student Sign In';
    $('authIntro').textContent = signup
      ? 'Create your student account. After confirming your email, sign in to choose a course and access period.'
      : 'Sign in to continue to your enrolled courses or purchase course access.';
    $('authName').required = signup;
    $('authName').style.display = signup ? 'block' : 'none';
    $('authName').parentElement.style.display = signup ? 'grid' : 'none';
    $('authPassword').autocomplete = signup ? 'new-password' : 'current-password';
    $('authSubmit').textContent = signup ? 'Create Account' : 'Sign In';
    $('authToggle').textContent = signup ? 'Back to sign in' : 'Create student account';
    authMessage('');
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${src}`));
      document.body.appendChild(script);
    });
  }

  function showPublicCheckout(user, text) {
    $('academyShell')?.classList.add('hidden');
    $('authGate')?.classList.add('hidden');
    $('publicHome')?.classList.remove('hidden');

    const pricing = $('lvx-pricing');
    if (pricing) {
      checkoutMessage(text || 'Choose a course and access period below. Sign-in is required before PayPal checkout.');
      pricing.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      authMessage('Your account is signed in. The course purchase section is not installed on this page yet.', true);
      $('authGate')?.classList.remove('hidden');
    }
  }

  async function showAcademy(courses, user) {
    $('authGate')?.classList.add('hidden');
    $('publicHome')?.classList.add('hidden');
    $('academyShell')?.classList.remove('hidden');

    const label = $('streak');
    if (label) label.textContent = user.email || 'SIGNED IN';
    window.LVX_ENROLLED_COURSES = courses.map(course => course.course_code);

    if (!academyLoaded) {
      try {
        await loadScript('data.js');
        await loadScript('app.js');
        academyLoaded = true;
      } catch (error) {
        console.error('Academy loading failed:', error);
        $('academyShell')?.classList.add('hidden');
        $('authGate')?.classList.remove('hidden');
        authMessage('The academy could not load. Please refresh or contact LVX support.', true);
      }
    }
  }

  async function verifyAndEnter(user, options = {}) {
    if (!user) return;
    if (options.showChecking) authMessage('Checking your course access…');

    const { data: enrollments, error } = await client
      .from('enrollments')
      .select('status, expiration_date, courses(course_code, course_name, description)')
      .eq('student_id', user.id)
      .eq('status', 'active')
      .gt('expiration_date', new Date().toISOString());

    if (error) {
      console.error('Enrollment verification failed:', error);
      if (options.fromLogin) authMessage('We could not verify your course access. Please try again.', true);
      else checkoutMessage('We could not refresh your course access. Please refresh the page or contact LVX support.', true);
      return;
    }

    const courses = (enrollments || [])
      .filter(row => row.courses)
      .map(row => row.courses);

    if (courses.length === 0) {
      showPublicCheckout(user, 'Your account is signed in. Select your correctional course and access period below to continue.');
      return;
    }

    await showAcademy(courses, user);
  }

  // Called after the PayPal capture endpoint confirms payment.
  window.lvxRefreshEnrollment = async () => {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) throw new Error('Your sign-in session expired. Sign in again to view your course.');
    await verifyAndEnter(data.session.user);
  };

  $('authForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    $('authSubmit').disabled = true;

    try {
      if (mode === 'signup') {
        const fullName = $('authName').value.trim();
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: SITE_URL
          }
        });
        if (error) throw error;

        if (!data.session) {
          authMessage('Account created. Check your email to confirm your address. Then return here and sign in to purchase course access.');
        } else {
          await verifyAndEnter(data.user, { fromLogin: true });
        }
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await verifyAndEnter(data.user, { fromLogin: true, showChecking: true });
      }
    } catch (error) {
      authMessage(error.message || 'Authentication failed.', true);
    } finally {
      $('authSubmit').disabled = false;
    }
  });

  $('authToggle').addEventListener('click', () => setMode(mode === 'signin' ? 'signup' : 'signin'));
  $('authBack').addEventListener('click', () => window.returnHome());

  window.lvxSignOut = async () => {
    await client.auth.signOut();
    academyLoaded = false;
    window.LVX_ENROLLED_COURSES = [];
    window.returnHome();
  };

  window.lvxSupabase = client;
  setMode('signin');

  // Restore an existing login when the student returns from PayPal or reloads the site.
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      academyLoaded = false;
      window.LVX_ENROLLED_COURSES = [];
    }
  });

  async function restoreSession() {
    if (checkingSession) return;
    checkingSession = true;
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (data.session?.user) {
        await verifyAndEnter(data.session.user);
      }
    } catch (error) {
      console.error('Session restore failed:', error);
    } finally {
      checkingSession = false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreSession, { once: true });
  } else {
    restoreSession();
  }
})();
