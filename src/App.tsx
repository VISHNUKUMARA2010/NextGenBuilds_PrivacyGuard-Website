import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  ArrowRight,
  Bell,
  BellRing,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleUserRound,
  Clipboard,
  ClipboardCheck,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Monitor,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { isSupabaseConfigured, License, Notification, supabase, AuthUser } from "./lib/supabase";

const features = [
  {
    icon: ShieldCheck,
    title: "Private by design",
    text: "Keep sensitive activity local with protection built into the places you work every day.",
  },
  {
    icon: Monitor,
    title: "Quiet protection",
    text: "A lightweight desktop experience that works in the background without slowing you down.",
  },
  {
    icon: KeyRound,
    title: "One secure account",
    text: "Manage your devices, licences, and account preferences from one clear portal.",
  },
];

function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const recoveryUrl = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery"
      || new URLSearchParams(window.location.search).get("type") === "recovery";
    if (recoveryUrl) setRecoveryMode(true);
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      },
    );
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  return { user, loading, recoveryMode, clearRecoveryMode: () => setRecoveryMode(false) };
}

export default function App() {
  const auth = useAuth();
  return (
    <AuthContext.Provider value={auth}>
      <Routes>
        <Route path="*" element={<AppRoutes />} />
      </Routes>
    </AuthContext.Provider>
  );
}

import { createContext, useContext } from "react";
const AuthContext = createContext<{
  user: AuthUser | null;
  loading: boolean;
  recoveryMode: boolean;
  clearRecoveryMode: () => void;
}>({
  user: null,
  loading: true,
  recoveryMode: false,
  clearRecoveryMode: () => undefined,
});
const useAuthContext = () => useContext(AuthContext);

function useNotifications() {
  const { user } = useAuthContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    if (!supabase || !user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const result = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
    if (result.error) {
      const message = result.error.message.toLowerCase();
      const tableMissing = result.error.code === "PGRST205" || message.includes("could not find the table");
      if (tableMissing) setNotifications([]);
      else setError(result.error.message);
    } else setNotifications((result.data as Notification[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    if (!supabase || !user) return;
    const channel = supabase.channel(`notifications:${user.id}:${Math.random().toString(36).slice(2)}`);
    channel.on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => void load());
    channel.subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [user?.id]);

  const markRead = async (id: string) => {
    if (!supabase || !user) return;
    const now = new Date().toISOString();
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, read_at: now } : item));
    await supabase.from("notifications").update({ read_at: now }).eq("id", id).eq("user_id", user.id);
  };
  const markAllRead = async () => {
    if (!supabase || !user) return;
    const now = new Date().toISOString();
    setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at || now })));
    await supabase.from("notifications").update({ read_at: now }).eq("user_id", user.id).is("read_at", null);
  };
  const clearAll = async () => {
    setNotifications([]);
    if (!supabase || !user) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  };
  return { notifications, loading, error, load, markRead, markAllRead, clearAll };
}

function AppRoutes() {
  const { user, loading, recoveryMode } = useAuthContext();
  const location = useLocation();
  if (loading)
    return (
      <div className="loading-screen">
        <div className="mark small">
          <ShieldCheck size={18} />
        </div>
        <span>Loading your secure space...</span>
      </div>
    );
  if (recoveryMode && location.pathname !== "/reset-password")
    return <Navigate to="/reset-password" replace />;
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
        <Route path="/reset-password" element={<AuthPage mode="reset" />} />
        <Route path="/privacy" element={<LegalPage title="Privacy policy" />} />
        <Route path="/terms" element={<LegalPage title="Terms of service" />} />
      </Route>
      <Route element={<ProtectedLayout />}>
        <Route path="/account" element={<Account />} />
        <Route path="/license" element={<LicensePage />} />
      </Route>
      <Route
        path="*"
        element={<Navigate to={user ? "/account" : "/"} replace />}
      />
    </Routes>
  );
}

function PublicLayout() {
  return (
    <>
      <Header />
      <main>
        <RoutesOutlet />
      </main>
      <Footer />
    </>
  );
}
function ProtectedLayout() {
  const { user } = useAuthContext();
  return user ? (
    <>
      <Header privateNav />
      <main>
        <RoutesOutlet />
      </main>
    </>
  ) : (
    <Navigate to="/login" replace />
  );
}
function RoutesOutlet() {
  return <Outlet />;
}
import { Outlet } from "react-router-dom";

function Header({ privateNav = false }: { privateNav?: boolean }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuthContext();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const notificationState = useNotifications();
  const unreadCount = notificationState.notifications.filter((item) => !item.read_at).length;
  useEffect(() => {
    if (!notificationsOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [notificationsOpen]);
  return (
    <header className="site-header">
      <div className="container nav-wrap">
        <Link to="/" className="brand">
          <span className="mark">
            <ShieldCheck size={19} />
          </span>
          <span>
            NextGenBuilds <b>PrivacyGuard</b>
          </span>
        </Link>
        <button
          className="menu-button"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav className={open ? "nav-links open" : "nav-links"}>
          <Link to="/">Product</Link>
          {privateNav || user ? (
            <>
              <Link to="/account">Account</Link>
              <Link to="/license">Licence</Link>
            </>
          ) : (
            <a href="/#features">Features</a>
          )}
          <a href="/#faq">FAQ</a>
          {user ? (
            <span className="nav-actions">
              <div className="notification-wrap" ref={notificationRef}>
                <button className="notification-button" aria-label="Notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}>
                  {unreadCount > 0 ? <BellRing size={17} /> : <Bell size={17} />}
                  {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
                </button>
                {notificationsOpen && <NotificationPanel state={notificationState} />}
              </div>
              <SignOut />
            </span>
          ) : (
            <span className="nav-actions">
              <Link className="button button-ghost" to="/login">
                Log in
              </Link>
              <Link className="button button-blue" to="/register">
                Create account <ArrowRight size={15} />
              </Link>
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}

function NotificationPanel({ state }: { state: ReturnType<typeof useNotifications> }) {
  return (
    <div className="notification-panel">
      <div className="notification-panel-head"><div><strong>Notifications</strong><span>{state.notifications.length} recent</span></div>{state.notifications.length > 0 && <button onClick={() => void state.clearAll()}>Clear all</button>}</div>
      {state.loading ? <div className="notification-state">Loading updates...</div> : state.error ? <div className="notification-state"><span>Notifications are unavailable right now.</span><button onClick={() => void state.load()}>Retry</button></div> : state.notifications.length === 0 ? <div className="notification-state">You are all caught up.</div> : <div className="notification-list">{state.notifications.map((item) => <button className={item.read_at ? "notification-item read" : "notification-item"} key={item.id} onClick={() => void state.markRead(item.id)}><span className="notification-icon"><Bell size={14} /></span><span><strong>{item.title}</strong><small>{item.message}</small><time>{new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></span></button>)}</div>}
      <Link className="notification-footer" to="/account#activity">View account activity <ArrowRight size={14} /></Link>
    </div>
  );
}
function SignOut() {
  const navigate = useNavigate();
  return (
    <button
      className="button button-ghost"
      onClick={async () => {
        await supabase?.auth.signOut();
        navigate("/");
      }}
    >
      <LogOut size={15} /> Sign out
    </button>
  );
}

function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy reveal">
            <div className="eyebrow">
              <span className="pulse" /> Built for the moments privacy matters
            </div>
            <h1>
              Your privacy,
              <br />
              <em>under your control.</em>
            </h1>
            <p>
              PrivacyGuard gives your desktop a quieter, safer place to work.
              Own your data, keep your focus, and stay one step ahead.
            </p>
            <div className="hero-actions">
              <Link className="button button-blue button-large" to="/register">
                Get started <ArrowRight size={17} />
              </Link>
              <a className="text-link" href="#features">
                Explore protection <ArrowRight size={15} />
              </a>
            </div>
            <div className="trust-row">
              <span>
                <Check size={14} /> Secure account setup
              </span>
              <span>
                <Check size={14} /> Privacy-first by design
              </span>
            </div>
          </div>
          <div className="hero-visual reveal delay-1">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="shield-art">
              <ShieldCheck size={92} strokeWidth={1.2} />
            </div>
            <div className="status-float top">
              <span className="status-dot" /> Protection active{" "}
              <small>Just now</small>
            </div>
            <div className="status-float bottom">
              <LockKeyhole size={16} />
              <span>
                Local-first security<small>Your data stays yours</small>
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="logo-strip">
        <div className="container">
          <span>TRUSTED FOR EVERYDAY PRIVACY</span>
          <div>
            <b>DEVICE</b>
            <b>WORKSPACE</b>
            <b>PERSONAL</b>
            <b>FOCUS</b>
          </div>
        </div>
      </section>
      <section className="section" id="features">
        <div className="container">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Why PrivacyGuard</div>
              <h2>
                Protection that <em>respects</em> you.
              </h2>
            </div>
            <p>
              Security should give you confidence, not another dashboard to
              babysit.
            </p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, text }) => (
              <article className="glass-card feature-card" key={title}>
                <div className="icon-tile">
                  <Icon size={20} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <ArrowRight className="feature-arrow" size={18} />
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section showcase">
        <div className="container showcase-grid">
          <div className="showcase-panel">
            <div className="panel-top">
              <span className="window-dots">
                <i />
                <i />
                <i />
              </span>
              <span>PrivacyGuard / Overview</span>
              <span className="live">
                <span className="status-dot" /> LIVE
              </span>
            </div>
            <div className="panel-body">
              <div className="protection-score">
                <span>Protection score</span>
                <strong>
                  98<span>/100</span>
                </strong>
                <div className="score-line">
                  <i />
                </div>
                <small>Excellent · all systems clear</small>
              </div>
              <div className="activity">
                <span className="mini-label">RECENT ACTIVITY</span>
                <p>
                  <CheckCircle2 size={16} /> Privacy scan completed{" "}
                  <small>2m ago</small>
                </p>
                <p>
                  <LockKeyhole size={16} /> Browser shield enabled{" "}
                  <small>Today</small>
                </p>
              </div>
            </div>
          </div>
          <div className="showcase-copy">
            <div className="eyebrow">See the difference</div>
            <h2>
              A safer baseline for your <em>digital life.</em>
            </h2>
            <p>
              From private browsing to device health, PrivacyGuard brings your
              essentials together in one calm, considered experience.
            </p>
            <Link className="text-link" to="/register">
              Create your account <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>
      <section className="section faq" id="faq">
        <div className="container faq-grid">
          <div>
            <div className="eyebrow">Questions, answered</div>
            <h2>Good to know.</h2>
            <p>
              Still curious? Reach out and we’ll help you find your way around.
            </p>
          </div>
          <div>
            {[
              "What is PrivacyGuard?",
              "How do I activate my licence?",
              "Where does PrivacyGuard store my data?",
              "Can I use my licence on multiple devices?",
            ].map((q, i) => (
              <details key={q} open={i === 0}>
                <summary>
                  {q}
                  <ChevronDown size={18} />
                </summary>
                <p>
                  {i === 0
                    ? "PrivacyGuard is a desktop privacy companion that helps keep your activity private and your device protected."
                    : i === 1
                      ? "Your account is ready to connect to an active PrivacyGuard licence."
                      : i === 2
                        ? "Your account data is secured by Supabase. PrivacyGuard itself is designed around local-first protection."
                        : "Your licence details are available in the secure portal, where you can manage activations."}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function AuthPage({
  mode,
}: {
  mode: "login" | "register" | "forgot" | "reset";
}) {
  const navigate = useNavigate();
  const { user, clearRecoveryMode } = useAuthContext();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });
  if (user && mode === "login") return <Navigate to="/account" replace />;
  const title =
    mode === "login"
      ? "Welcome back."
      : mode === "register"
        ? "Start with privacy."
        : mode === "forgot"
          ? "Reset your password."
          : "Choose a new password.";
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (mode === "register" && form.password !== form.confirm)
      return setError("Passwords do not match.");
    if (mode === "reset" && form.password !== form.confirm)
      return setError("Passwords do not match.");
    if (!supabase) {
      setError(
        "Connect your Supabase environment variables to enable account actions.",
      );
      return;
    }
    setBusy(true);
    let result;
    if (mode === "login") {
      result = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
    } else if (mode === "register")
      result = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.name },
          emailRedirectTo: `${window.location.origin}/account`,
        },
      });
    else if (mode === "forgot")
      result = await supabase.auth.resetPasswordForEmail(form.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    else result = await supabase.auth.updateUser({ password: form.password });
    setBusy(false);
    if (result.error) {
      const message = result.error.message.toLowerCase().includes("rate limit")
        ? "Too many reset emails were requested. Please wait a while before trying again, then check your spam folder."
        : result.error.message;
      setError(message);
    }
    else if (mode === "login") navigate("/account");
    else {
      if (mode === "reset") clearRecoveryMode();
      setDone(true);
    }
  };
  if (done)
    return (
      <section className="auth-section">
        <div className="auth-card glass-card success-card">
          <div className="success-icon">
            <Check size={25} />
          </div>
          <div className="eyebrow">You’re all set</div>
          <h1>
            {mode === "register"
              ? "Check your inbox."
              : mode === "forgot"
                ? "Email sent."
                : "Password updated."}
          </h1>
          <p>
            {mode === "register"
              ? "We sent a verification link to your email. Confirm it to finish creating your account."
              : mode === "forgot"
                ? "If an account exists for that address, a secure reset link is on its way."
                : "Your password is now up to date. You can sign in with your new details."}
          </p>
          <Link
            className="button button-blue button-full"
            to={mode === "reset" ? "/login" : "/"}
          >
            {mode === "reset" ? "Return to login" : "Back to home"}
          </Link>
        </div>
      </section>
    );
  return (
    <section className="auth-section">
      <div className="auth-card glass-card">
        <Link to="/" className="auth-mark mark">
          <ShieldCheck size={20} />
        </Link>
        <div className="eyebrow">
          {mode === "login" ? "Secure portal" : "PrivacyGuard account"}
        </div>
        <h1>{title}</h1>
        <p className="auth-sub">
          {mode === "login"
            ? "Sign in to manage your account and licence."
            : mode === "register"
              ? "Your secure account starts here."
              : mode === "forgot"
                ? "We’ll send a secure link to your inbox."
                : "Make it strong, memorable, and yours."}
        </p>
        <form onSubmit={submit}>
          {mode === "register" && (
            <Field
              label="Full name"
              icon={<CircleUserRound size={17} />}
              type="text"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              required
            />
          )}
          <Field
            label="Email address"
            icon={<Mail size={17} />}
            type="email"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            required
          />
          {mode !== "forgot" && (
            <>
              <Field
                label="Password"
                icon={<LockKeyhole size={17} />}
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(v) => setForm({ ...form, password: v })}
                required
                end={
                  <button
                    type="button"
                    className="field-action"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                }
              />
              {(mode === "register" || mode === "reset") && (
                <PasswordStrength password={form.password} />
              )}{" "}
              {(mode === "register" || mode === "reset") && (
                <Field
                  label="Confirm password"
                  icon={<LockKeyhole size={17} />}
                  type="password"
                  value={form.confirm}
                  onChange={(v) => setForm({ ...form, confirm: v })}
                  required
                />
              )}
            </>
          )}
          {error && <div className="form-error">{error}</div>}
          <div className="form-row">
            <span />
            {mode === "login" && (
              <Link to="/forgot-password">Forgot password?</Link>
            )}
          </div>
          <button className="button button-blue button-full" disabled={busy}>
            {busy
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : mode === "register"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Update password"}{" "}
            <ArrowRight size={16} />
          </button>
        </form>
        <p className="auth-switch">
          {mode === "login" ? (
            <>
              New to PrivacyGuard? <Link to="/register">Create an account</Link>
            </>
          ) : (
            <>
              Already have an account? <Link to="/login">Sign in</Link>
            </>
          )}
        </p>
      </div>
    </section>
  );
}
function Field({
  label,
  icon,
  type,
  value,
  onChange,
  required,
  end,
}: {
  label: string;
  icon: ReactNode;
  type: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  end?: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        {icon}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
        {end}
      </div>
    </label>
  );
}
function PasswordStrength({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  return (
    <div className="strength">
      <div>
        {[1, 2, 3, 4].map((n) => (
          <i className={n <= score ? "active" : ""} key={n} />
        ))}
      </div>
      <span>
        {score < 2
          ? "Use 8+ characters"
          : score < 4
            ? "Could be stronger"
            : "Strong password"}
      </span>
    </div>
  );
}

function Account() {
  const { user } = useAuthContext();
  const notificationState = useNotifications();
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const name =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
  const [license, setLicense] = useState<License | null>(null);
  const [licenseLoading, setLicenseLoading] = useState(true);
  const [licenseError, setLicenseError] = useState("");
  useEffect(() => {
    if (!supabase || !user) {
      setLicenseLoading(false);
      return;
    }
    setLicenseLoading(true);
    supabase.from("licenses").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).then(({ data, error }) => {
      if (error) setLicenseError(error.message);
      else setLicense((data as License[])?.[0] || null);
      setLicenseLoading(false);
    });
  }, [user?.id]);
  const expiry = license?.expiry_date ? new Date(license.expiry_date) : null;
  const days = expiry ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000)) : null;
  const changePassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password.length < 8) return setMessage("Use at least 8 characters.");
    if (!supabase) return setMessage("Supabase is not configured.");
    const { error } = await supabase!.auth.updateUser({ password });
    setMessage(error ? error.message : "Password changed successfully.");
    if (!error) setPassword("");
  };
  return (
    <section className="dashboard section">
      <div className="container">
        <div className="dash-head">
          <div>
            <div className="eyebrow">Your account</div>
            <h1>
              Good to see you, <em>{name}.</em>
            </h1>
            <p>Everything important, in one secure place.</p>
          </div>
          <Link className="button button-blue" to="/license">
            View licence <ArrowRight size={16} />
          </Link>
        </div>
        <div className="dashboard-grid">
          <div className="glass-card profile-card">
            <div className="avatar">{name.charAt(0).toUpperCase()}</div>
            <h2>{name}</h2>
            <p>{user?.email}</p>
            <div className="verified">
              <CheckCircle2 size={15} />{" "}
              {user?.email_confirmed_at
                ? "Email verified"
                : "Email verification pending"}
            </div>
            <dl>
              <div>
                <dt>Member since</dt>
                <dd>
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        year: "numeric",
                      })
                    : "Today"}
                </dd>
              </div>
              <div>
                <dt>Account ID</dt>
                <dd>{user?.id || "Preview"}</dd>
              </div>
            </dl>
          </div>
          <div className="glass-card password-card">
            <div className="card-title">
              <div className="icon-tile">
                <LockKeyhole size={19} />
              </div>
              <div>
                <h2>Change password</h2>
                <p>Keep your account protected.</p>
              </div>
            </div>
            <form onSubmit={changePassword}>
              <Field
                label="New password"
                icon={<LockKeyhole size={17} />}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={setPassword}
                required
                end={
                  <button
                    type="button"
                    className="field-action"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                }
              />
              <button className="button button-outline">
                Update password <ArrowRight size={15} />
              </button>
              {message && <div className="form-message">{message}</div>}
            </form>
          </div>
          <div className="glass-card account-overview-card">
            <div className="card-title"><div className="icon-tile"><ShieldCheck size={19} /></div><div><h2>Licence overview</h2><p>Your current protection status.</p></div></div>
            {licenseLoading ? <div className="inline-state">Loading licence...</div> : licenseError ? <div className="inline-state error-state">Licence details unavailable. <button onClick={() => window.location.reload()}>Retry</button></div> : license ? <div className="overview-grid"><div><span>Status</span><strong className={license.status === "active" ? "text-success" : "text-warning"}>{license.status}</strong></div><div><span>Days remaining</span><strong>{days ?? "No expiry"}</strong></div><div><span>Expires</span><strong>{expiry ? expiry.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "No expiry"}</strong></div></div> : <div className="inline-state">No licence is linked to this account yet.</div>}
            <Link className="button button-outline" to="/license">Manage licence <ArrowRight size={15} /></Link>
          </div>
        </div>
        <div className="account-callout">
          <Sparkles size={20} />
          <div>
            <strong>PrivacyGuard is working quietly in the background.</strong>
            <span>Open your licence portal to manage your protection.</span>
          </div>
          <Link to="/license">
            <ArrowRight size={18} />
          </Link>
        </div>
        <section className="activity-section" id="activity">
          <div className="section-heading"><div><div className="eyebrow">Security timeline</div><h2>Recent activity</h2></div><button className="button button-ghost" onClick={() => void notificationState.load()}>Refresh</button></div>
          {notificationState.loading ? <div className="glass-card empty-state">Loading recent activity...</div> : notificationState.error ? <div className="glass-card empty-state"><p>Activity is unavailable right now.</p><button className="button button-outline" onClick={() => void notificationState.load()}>Retry</button></div> : notificationState.notifications.length === 0 ? <div className="glass-card empty-state">No account or licence activity yet.</div> : <div className="activity-list">{notificationState.notifications.slice(0, 6).map((item) => <div className="glass-card activity-row" key={item.id}><span className="notification-icon"><Bell size={14} /></span><div><strong>{item.title}</strong><p>{item.message}</p></div><time>{new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></div>)}</div>}
        </section>
      </div>
    </section>
  );
}

function LicensePage() {
  const { user } = useAuthContext();
  const [license, setLicense] = useState<License | null>(null);
  const [licenseHistory, setLicenseHistory] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  useEffect(() => {
    if (!supabase || !user) {
      setLoading(false);
      return;
    }
    supabase
      .from("licenses")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error) {
          const licenses = (data as License[]) || [];
          setLicenseHistory(licenses);
          setLicense(licenses[0] ?? null);
        }
        setLoading(false);
      });
  }, [user]);
  const expiry = license?.expiry_date ? new Date(license.expiry_date) : null;
  const days = expiry
    ? Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86400000))
    : null;
  return (
    <section className="dashboard section">
      <div className="container">
        <div className="dash-head">
          <div>
            <div className="eyebrow">Licence portal</div>
            <h1>
              Your <em>protection.</em>
            </h1>
            <p>
              Manage your PrivacyGuard licence and keep your devices covered.
            </p>
          </div>
          <button className="button button-blue" onClick={() => setContactOpen(true)}>
            <KeyRound size={16} /> Redeem licence
          </button>
        </div>
        {loading ? (
          <div className="glass-card empty-state">Loading your licence...</div>
        ) : license ? (
          <>
            <div className="license-hero glass-card">
              <div className="license-info">
                <span className="mini-label">LICENCE KEY</span>
                <div className="license-key-row">
                  <h2>{license.license_key}</h2>
                  <button
                    className="copy-license-button"
                    type="button"
                    aria-label={copied ? "Licence key copied" : "Copy licence key"}
                    title={copied ? "Copied" : "Copy licence key"}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(license.license_key);
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1800);
                      } catch {
                        setCopied(false);
                      }
                    }}
                  >
                    {copied ? <ClipboardCheck size={16} /> : <Clipboard size={16} />}
                  </button>
                </div>
                <span className={"license-status " + license.status}>
                  <span className="status-dot" /> {license.status}
                </span>
              </div>
              <div className="license-days">
                <strong>{days ?? "—"}</strong>
                <span>days remaining</span>
              </div>
            </div>
            <div className="license-details">
              <div className="glass-card detail-item">
                <span>Expiry date</span>
                <strong>
                  {expiry?.toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }) || "No expiry"}
                </strong>
              </div>
              <div className="glass-card detail-item">
                <span>Plan</span>
                <strong>PrivacyGuard Pro</strong>
              </div>
              <div className="glass-card detail-item">
                <span>Renewal</span>
                <strong>Manual renewal</strong>
              </div>
            </div>
          </>
        ) : (
          <div className="glass-card empty-state">
            <div className="success-icon">
              <KeyRound size={22} />
            </div>
            <h2>No active licence yet.</h2>
            <p>Redeem a licence key to start protecting your devices.</p>
            <button className="button button-blue" onClick={() => setContactOpen(true)}>
              Redeem licence <ArrowRight size={15} />
            </button>
          </div>
        )}
        {contactOpen && (
          <div className="contact-overlay" role="dialog" aria-modal="true" aria-labelledby="contact-title">
            <div className="contact-modal glass-card">
              <button
                className="modal-close"
                type="button"
                aria-label="Close contact options"
                onClick={() => setContactOpen(false)}
              >
                <X size={18} />
              </button>
              <div className="success-icon"><KeyRound size={22} /></div>
              <div className="eyebrow">Get your licence</div>
              <h2 id="contact-title">Contact us to redeem</h2>
              <p>Choose Telegram or Discord and message us to get your PrivacyGuard licence.</p>
              <div className="contact-actions">
                <a className="button button-blue" href="https://t.me/+ahmMTKOYJsllNDZl" target="_blank" rel="noreferrer">
                  Contact on Telegram <ArrowRight size={15} />
                </a>
                <a className="button button-outline" href="https://discord.gg/9CAgggFt" target="_blank" rel="noreferrer">
                  Contact on Discord <ArrowRight size={15} />
                </a>
              </div>
            </div>
          </div>
        )}
        <div className="history">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Account history</div>
              <h2>Renewal history</h2>
            </div>
          </div>
          {licenseHistory.length > 0 ? (
            licenseHistory.map((historyLicense) => (
              <div className="glass-card history-row" key={historyLicense.id}>
                <span>
                  {historyLicense.license_key}
                  <small>
                    Issued {new Date(historyLicense.created_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </small>
                </span>
                <small>
                  {historyLicense.status} · Expires {historyLicense.expiry_date
                    ? new Date(historyLicense.expiry_date).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "never"}
                </small>
              </div>
            ))
          ) : (
            <div className="glass-card history-row">
              <span>No renewal activity yet</span>
              <small>Your future renewals will appear here.</small>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
function LegalPage({ title }: { title: string }) {
  return (
    <section className="legal section">
      <div className="container narrow">
        <div className="eyebrow">NextGenBuilds PrivacyGuard</div>
        <h1>{title}</h1>
        <p className="lead">Last updated September 2026.</p>
        <h2>Our commitment</h2>
        <p>
          We build PrivacyGuard to help you keep control of your digital life.
          This page is a placeholder for the final legal policy connected to
          your business and existing Supabase project.
        </p>
        <h2>Questions</h2>
        <p>
          For questions about this document or your account, contact the
          NextGenBuilds support team.
        </p>
      </div>
    </section>
  );
}
function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-row">
        <Link to="/" className="brand">
          <span className="mark">
            <ShieldCheck size={16} />
          </span>
          <span>
            NextGenBuilds <b>PrivacyGuard</b>
          </span>
        </Link>
        <div>
          <Link to="/privacy">Privacy policy</Link>
          <Link to="/terms">Terms</Link>
          <span>© 2026 NextGenBuilds</span>
        </div>
      </div>
    </footer>
  );
}
