import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BadgeIndianRupee,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Cloud,
  FileBadge,
  FileCheck2,
  FileKey2,
  FileText,
  Fingerprint,
  Gauge,
  Info,
  KeyRound,
  Landmark,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Network,
  RefreshCw,
  ScanFace,
  Server,
  ShieldCheck,
  ShieldEllipsis,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  type DocumentKind,
  type HealthResponse,
  type VerificationEnvelope,
  getHealth,
  submitVerification,
} from '@/services/api';

const queryClient = new QueryClient();
const SESSION_KEY = 'ssb-officer-session';
const RESULT_KEY = 'ssb-last-verification';

interface OfficerSession {
  officerId: string;
  displayName: string;
  authenticated: boolean;
}

interface UploadRecord {
  kind: 'passport' | 'identity_document' | 'fingerprint';
  file: File | null;
  fileName: string;
  size: number;
  type: string;
  status: 'empty' | 'ready' | 'error';
  error?: string;
}

const emptyUpload = (kind: UploadRecord['kind']): UploadRecord => ({
  kind,
  file: null,
  fileName: '',
  size: 0,
  type: '',
  status: 'empty',
});

function formatBytes(bytes: number) {
  if (!bytes) return 'No file selected';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getInitialSession(): OfficerSession {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return JSON.parse(stored) as OfficerSession;
  } catch {
    // Session storage is optional in restricted browser contexts.
  }
  return { officerId: '', displayName: '', authenticated: false };
}

function getStoredResult(): VerificationEnvelope | null {
  try {
    const stored = sessionStorage.getItem(RESULT_KEY);
    return stored ? JSON.parse(stored) as VerificationEnvelope : null;
  } catch {
    return null;
  }
}

function LogoMark({ compact = false, onLight = false }: { compact?: boolean; onLight?: boolean }) {
  return (
    <div className="flex items-center gap-3" data-testid="brand-ssb">
      <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] shadow-sm">
        <ShieldCheck size={22} strokeWidth={2.2} />
        <span className="absolute bottom-[5px] h-[2px] w-4 bg-[hsl(var(--primary))]" />
      </div>
      {!compact && (
        <div className="leading-none">
          <div className={`font-display text-[15px] font-extrabold tracking-[.14em] ${onLight ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--sidebar-foreground))]'}`}>SSB</div>
          <div className={`mt-1 text-[9px] font-semibold uppercase tracking-[.16em] ${onLight ? 'text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--sidebar-foreground)/.58)]'}`}>Identity Desk</div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ tone, children }: { tone: 'neutral' | 'success' | 'warning' | 'danger'; children: ReactNode }) {
  const toneClass = {
    neutral: 'border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-800',
  }[tone];
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.08em] ${toneClass}`}>{children}</span>;
}

function Topbar({ session, onLogout, onMenu }: { session: OfficerSession; onLogout: () => void; onMenu: () => void }) {
  const [location] = useLocation();
  const pageTitle = location.includes('/verification/new') ? 'New verification' : location.includes('/verification/result') ? 'Verification result' : 'Operations overview';
  return (
    <header className="flex min-h-[76px] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card)/.82)] px-5 backdrop-blur md:px-8">
      <div className="flex items-center gap-3">
        <button className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] md:hidden" onClick={onMenu} aria-label="Open navigation" data-testid="button-open-navigation">
          <Menu size={20} />
        </button>
        <div>
          <div className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">SSB / Identity operations</div>
          <h1 className="mt-1 font-display text-xl font-bold tracking-tight text-[hsl(var(--foreground))]" data-testid="text-page-title">{pageTitle}</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 border-r border-[hsl(var(--border))] pr-4 sm:flex">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-[hsl(var(--primary))] text-xs font-bold text-[hsl(var(--primary-foreground))]">
            {(session.displayName || session.officerId || 'O').slice(0, 1).toUpperCase()}
          </div>
          <div className="leading-tight">
            <div className="text-xs font-bold text-[hsl(var(--foreground))]" data-testid="text-officer-name">{session.displayName || 'Officer session'}</div>
            <div className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]" data-testid="text-officer-id">{session.officerId || 'ID unavailable'}</div>
          </div>
        </div>
        <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-xs font-bold text-[hsl(var(--muted-foreground))] transition hover:border-[hsl(var(--destructive)/.4)] hover:text-[hsl(var(--destructive))]" data-testid="button-logout">
          <LogOut size={14} /> <span className="hidden sm:inline">End session</span>
        </button>
      </div>
    </header>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [location] = useLocation();
  const navItems = [
    { href: '/dashboard', label: 'Operations overview', icon: Gauge },
    { href: '/verification/new', label: 'New verification', icon: ClipboardCheck },
    { href: '/verification/result', label: 'Last result', icon: FileCheck2 },
  ];
  return (
    <>
      {open && <button className="fixed inset-0 z-30 bg-[hsl(var(--foreground)/.38)] md:hidden" onClick={onClose} aria-label="Close navigation" data-testid="button-close-navigation" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[hsl(var(--sidebar))] px-4 py-5 text-[hsl(var(--sidebar-foreground))] transition-transform md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-2">
          <LogoMark />
          <button className="rounded-lg p-2 text-[hsl(var(--sidebar-foreground)/.65)] hover:bg-[hsl(var(--sidebar-accent))] md:hidden" onClick={onClose} aria-label="Close navigation" data-testid="button-close-navigation-inner"><X size={18} /></button>
        </div>
        <div className="mt-10 px-2 font-mono-ui text-[10px] uppercase tracking-[.17em] text-[hsl(var(--sidebar-foreground)/.45)]">Workspace</div>
        <nav className="mt-3 space-y-1" aria-label="Primary navigation">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link href={href} onClick={onClose} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-accent-foreground))]' : 'text-[hsl(var(--sidebar-foreground)/.66)] hover:bg-[hsl(var(--sidebar-accent)/.72)] hover:text-[hsl(var(--sidebar-foreground))]'}`} data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`}>
                <Icon size={17} className={active ? 'text-[hsl(var(--accent))]' : 'text-[hsl(var(--sidebar-foreground)/.5)]'} />
                <span>{label}</span>
                {active && <ChevronRight size={14} className="ml-auto text-[hsl(var(--accent))]" />}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent)/.5)] p-4">
          <div className="flex items-center gap-2 text-[hsl(var(--accent))]"><LockKeyhole size={15} /><span className="font-mono-ui text-[10px] font-medium uppercase tracking-[.14em]">Protected workspace</span></div>
          <p className="mt-3 text-xs leading-5 text-[hsl(var(--sidebar-foreground)/.58)]">Uploads are sent only when you submit a verification. Biometric files are never previewed here.</p>
        </div>
        <div className="mt-4 px-2 font-mono-ui text-[9px] uppercase tracking-[.15em] text-[hsl(var(--sidebar-foreground)/.35)]">Sashastra Seema Bal · internal use</div>
      </aside>
    </>
  );
}

function Workspace({ session, onLogout, children }: { session: OfficerSession; onLogout: () => void; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="portal-noise min-h-[100dvh] bg-[hsl(var(--background))]">
      <div className="flex min-h-[100dvh]">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="min-w-0 flex-1">
          <Topbar session={session} onLogout={onLogout} onMenu={() => setMenuOpen(true)} />
          <main className="portal-grid min-h-[calc(100dvh-76px)] p-4 md:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

function Login({ onEnter }: { onEnter: (session: OfficerSession) => void }) {
  const [officerId, setOfficerId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [notice, setNotice] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!officerId.trim() || !displayName.trim()) {
      setNotice('Enter your officer ID and display name to continue.');
      return;
    }
    onEnter({ officerId: officerId.trim(), displayName: displayName.trim(), authenticated: true });
  };
  return (
    <div className="portal-noise min-h-[100dvh] bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
      <div className="grid min-h-[100dvh] lg:grid-cols-[minmax(340px,43%)_1fr]">
        <section className="relative hidden overflow-hidden border-r border-[hsl(var(--sidebar-border))] px-10 py-12 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-28 top-24 h-64 w-64 rounded-full border border-[hsl(var(--accent)/.2)]" />
          <div className="absolute -right-16 top-36 h-40 w-40 rounded-full border border-[hsl(var(--accent)/.18)]" />
          <LogoMark />
          <div className="relative max-w-sm">
            <div className="mb-7 flex items-center gap-3 text-[hsl(var(--accent))]"><span className="h-px w-10 bg-[hsl(var(--accent))]" /><span className="font-mono-ui text-[10px] uppercase tracking-[.2em]">Evidence chain / 01</span></div>
            <h1 className="font-display text-5xl font-extrabold leading-[1.06] tracking-[-.045em]">Identity, verified with discipline.</h1>
            <p className="mt-6 max-w-xs text-sm leading-6 text-[hsl(var(--sidebar-foreground)/.6)]">A controlled workspace for SSB personnel to submit documents and review backend verification evidence without losing the audit trail.</p>
          </div>
          <div className="flex items-center gap-3 text-[hsl(var(--sidebar-foreground)/.46)]">
            <Landmark size={17} />
            <span className="font-mono-ui text-[10px] uppercase tracking-[.14em]">Sashastra Seema Bal · secure operations</span>
          </div>
        </section>
        <section className="login-panel flex items-center justify-center bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
          <div className="login-inner fade-in">
            <div className="mb-12 lg:hidden"><LogoMark compact={false} onLight /></div>
            <div className="mb-9">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))]"><KeyRound size={20} /></div>
              <div className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Officer access</div>
              <h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-.03em]">Open the identity desk</h2>
              <p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Authentication is isolated here so it can be connected to the SSB identity provider when available.</p>
            </div>
            <form onSubmit={submit} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[.08em] text-[hsl(var(--foreground))]">Officer ID</span>
                <div className="relative"><UserRound className="absolute left-3 top-3.5 text-[hsl(var(--muted-foreground))]" size={17} /><input value={officerId} onChange={(event) => setOfficerId(event.target.value)} className="h-12 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-10 pr-3 text-sm outline-none transition placeholder:text-[hsl(var(--muted-foreground)/.65)] focus:border-[hsl(var(--primary))] focus:ring-4 focus:ring-[hsl(var(--primary)/.1)]" placeholder="Enter assigned officer ID" data-testid="input-officer-id" /></div>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[.08em] text-[hsl(var(--foreground))]">Display name</span>
                <div className="relative"><BadgeCheck className="absolute left-3 top-3.5 text-[hsl(var(--muted-foreground))]" size={17} /><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="h-12 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] pl-10 pr-3 text-sm outline-none transition placeholder:text-[hsl(var(--muted-foreground)/.65)] focus:border-[hsl(var(--primary))] focus:ring-4 focus:ring-[hsl(var(--primary)/.1)]" placeholder="How your name should appear" data-testid="input-display-name" /></div>
              </label>
              {notice && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900" data-testid="status-login-error"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{notice}</div>}
              <button type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:brightness-110 active:translate-y-px" data-testid="button-enter-workspace">Continue to workspace <ArrowRight size={16} /></button>
            </form>
            <div className="mt-8 flex items-start gap-3 border-t border-[hsl(var(--border))] pt-5 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><Info size={15} className="mt-0.5 shrink-0 text-[hsl(var(--accent-border))]" /><span>No credentials are stored by this frontend. Connect the submit action to an authentication endpoint before production deployment.</span></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ConnectionCard() {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState('');
  const check = async () => {
    setState('loading');
    setError('');
    try {
      const response = await getHealth();
      setHealth(response);
      setState('success');
    } catch (caught) {
      setState('error');
      setError(caught instanceof Error ? caught.message : 'The health endpoint could not be reached.');
    }
  };
  useEffect(() => { void check(); }, []);
  return (
    <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.9)] p-5 shadow-[0_12px_35px_hsl(var(--foreground)/.04)] md:p-6" data-testid="card-system-connection">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]"><Network size={19} /></div>
          <div><div className="font-display text-lg font-bold">Verification service</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Live connection check against the configured backend.</p></div>
        </div>
        <button onClick={() => void check()} className="rounded-lg border border-[hsl(var(--border))] p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" aria-label="Refresh connection status" data-testid="button-refresh-health"><RefreshCw size={15} className={state === 'loading' ? 'animate-spin' : ''} /></button>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[hsl(var(--border))] pt-4">
        {state === 'loading' && <><LoaderCircle size={17} className="animate-spin text-[hsl(var(--accent-border))]" /><span className="text-sm font-semibold">Checking service availability…</span></>}
        {state === 'idle' && <><Server size={17} className="text-[hsl(var(--muted-foreground))]" /><span className="text-sm font-semibold">Not checked</span></>}
        {state === 'success' && <><StatusPill tone="success"><CheckCircle2 size={13} /> Connected</StatusPill><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]" data-testid="status-health-response">{health?.status ? `status: ${health.status}` : 'Health response received'}</span></>}
        {state === 'error' && <><StatusPill tone="danger"><AlertTriangle size={13} /> Unavailable</StatusPill><span className="min-w-0 text-xs text-[hsl(var(--destructive))]" data-testid="status-health-error">{error}</span></>}
      </div>
    </section>
  );
}

function Dashboard() {
  return (
    <div className="mx-auto max-w-6xl slide-up">
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent-border))]"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" /> Operational console</div>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-extrabold tracking-[-.04em] md:text-4xl">A clear start for every evidence review.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">Submit one controlled verification at a time. Results shown here come from the configured Flask service only.</p>
        </div>
        <Link href="/verification/new" className="inline-flex w-fit items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-sm transition hover:brightness-110" data-testid="link-start-verification">Start verification <ArrowRight size={16} /></Link>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <ConnectionCard />
        <section className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/.55)] p-6" data-testid="card-no-activity">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><FileText size={18} /></div><div><div className="font-display text-lg font-bold">No activity loaded</div><div className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Honest by default</div></div></div>
          <p className="mt-5 text-sm leading-6 text-[hsl(var(--muted-foreground))]">This portal does not create history or metrics in the browser. The last result view is populated only after a successful backend response in this session.</p>
          <Link href="/verification/result" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--primary))] hover:underline" data-testid="link-view-last-result">View last result <ChevronRight size={14} /></Link>
        </section>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {[
          { icon: FileBadge, label: 'Passport', copy: 'Primary identity document' },
          { icon: ScanFace, label: 'Identity document', copy: 'Aadhaar or driving licence' },
          { icon: Fingerprint, label: 'Fingerprint file', copy: 'Backend-readable .firpiv' },
        ].map(({ icon: Icon, label, copy }) => <div key={label} className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.55)] p-4"><Icon size={18} className="text-[hsl(var(--accent-border))]" /><div><div className="text-sm font-bold">{label}</div><div className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">{copy}</div></div></div>)}
      </div>
    </div>
  );
}

function FileDrop({ record, label, helper, accept, icon: Icon, onFile }: { record: UploadRecord; label: string; helper: string; accept: string; icon: typeof FileText; onFile: (file: File | undefined) => void }) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onFile(event.target.files?.[0]);
  const [dragging, setDragging] = useState(false);
  return (
    <div className={`rounded-2xl border bg-[hsl(var(--card)/.82)] p-4 transition ${dragging ? 'border-[hsl(var(--accent-border))] bg-[hsl(var(--accent)/.06)]' : 'border-[hsl(var(--border))]'}`} data-testid={`upload-card-${record.kind}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3"><div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${record.status === 'ready' ? 'bg-emerald-50 text-emerald-700' : 'bg-[hsl(var(--muted))] text-[hsl(var(--primary))]'}`}><Icon size={19} /></div><div className="min-w-0"><div className="text-sm font-bold">{label}</div><div className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{helper}</div></div></div>
        {record.status === 'ready' && <StatusPill tone="success"><Check size={12} /> Ready</StatusPill>}
      </div>
      <label onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); onFile(event.dataTransfer.files[0]); }} className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-[hsl(var(--input))] bg-[hsl(var(--background)/.65)] px-3 py-3 transition hover:border-[hsl(var(--primary)/.55)] hover:bg-[hsl(var(--muted)/.6)]">
        <div className="min-w-0"><div className="truncate text-xs font-semibold text-[hsl(var(--foreground))]" data-testid={`text-file-name-${record.kind}`}>{record.fileName || 'Choose a file or drop it here'}</div><div className="mt-1 font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{record.fileName ? `${formatBytes(record.size)} · ${record.type || 'type unavailable'}` : accept.replaceAll(',', ' · ')}</div></div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))]"><Upload size={14} /> Browse</span>
        <input type="file" accept={accept} onChange={handleChange} className="sr-only" data-testid={`input-file-${record.kind}`} />
      </label>
      {record.error && <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-[hsl(var(--destructive))]" data-testid={`status-upload-error-${record.kind}`}><AlertTriangle size={14} className="mt-0.5 shrink-0" />{record.error}</div>}
    </div>
  );
}

function Readiness({ uploads, documentKind }: { uploads: UploadRecord[]; documentKind: DocumentKind }) {
  const checks = [
    { label: 'Passport file selected', ready: uploads[0].status === 'ready' },
    { label: `${documentKind === 'aadhaar' ? 'Aadhaar' : 'Driving Licence'} selected`, ready: uploads[1].status === 'ready' },
    { label: 'Fingerprint file selected', ready: uploads[2].status === 'ready' },
  ];
  const readyCount = checks.filter((check) => check.ready).length;
  return (
    <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.9)] p-5 md:p-6" data-testid="card-readiness">
      <div className="flex items-center justify-between gap-4"><div><div className="font-display text-lg font-bold">Readiness summary</div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">All three files are required before submission.</p></div><div className="font-mono-ui text-xs font-medium text-[hsl(var(--muted-foreground))]" data-testid="text-readiness-count">{readyCount}/3 ready</div></div>
      <div className="mt-5 space-y-3">
        {checks.map((check) => <div key={check.label} className="flex items-center gap-3 text-sm"><span className={`grid h-5 w-5 place-items-center rounded-full border ${check.ready ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-[hsl(var(--input))] text-transparent'}`}>{check.ready && <Check size={12} strokeWidth={3} />}</span><span className={check.ready ? 'font-semibold' : 'text-[hsl(var(--muted-foreground))]'}>{check.label}</span>{check.ready && <span className="ml-auto font-mono-ui text-[10px] uppercase tracking-[.1em] text-emerald-700">present</span>}</div>)}
      </div>
    </section>
  );
}

function ProgressPanel({ phase, error }: { phase: 'idle' | 'uploading' | 'verifying' | 'complete' | 'error'; error?: string }) {
  const steps = [
    { key: 'uploading', label: 'Secure upload', copy: 'Sending selected files to the service' },
    { key: 'verifying', label: 'Backend verification', copy: 'Waiting for layered checks to complete' },
    { key: 'complete', label: 'Response received', copy: 'Ready to review returned evidence' },
  ];
  const rank = { idle: 0, uploading: 1, verifying: 2, complete: 3, error: 0 }[phase];
  return (
    <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.9)] p-5 md:p-6" data-testid="card-verification-progress">
      <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--accent)/.14)] text-[hsl(var(--accent-border))]"><Cloud size={19} /></div><div><div className="font-display text-lg font-bold">Verification progress</div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{phase === 'idle' ? 'No request has been submitted.' : phase === 'error' ? 'The request could not be completed.' : phase === 'complete' ? 'The backend response is available.' : 'Keep this window open while the service responds.'}</p></div></div>
      <div className="mt-6 space-y-4">
        {steps.map((step, index) => {
          const stepRank = index + 1;
          const done = rank >= stepRank;
          const active = rank === stepRank && phase !== 'complete';
          return <div key={step.key} className="flex gap-3"><div className={`relative grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold ${done ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--input))] text-[hsl(var(--muted-foreground))]'}`}>{active ? <LoaderCircle size={14} className="animate-spin" /> : done ? <Check size={14} /> : stepRank}</div><div className="pt-0.5"><div className={`text-sm font-bold ${active ? 'text-[hsl(var(--primary))]' : ''}`}>{step.label}</div><div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{step.copy}</div></div></div>;
        })}
      </div>
      {error && <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800" data-testid="status-verification-error"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{error}</div>}
    </section>
  );
}

function VerificationNew({ onResult }: { onResult: (response: VerificationEnvelope) => void }) {
  const [documentKind, setDocumentKind] = useState<DocumentKind>('aadhaar');
  const [uploads, setUploads] = useState<UploadRecord[]>([emptyUpload('passport'), emptyUpload('identity_document'), emptyUpload('fingerprint')]);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'verifying' | 'complete' | 'error'>('idle');
  const [error, setError] = useState('');
  const ready = uploads.every((upload) => upload.status === 'ready');
  const setFile = (index: number, file?: File) => {
    if (!file) return;
    const expected = index === 2 ? '.firpiv' : '';
    const invalid = index === 2 && !file.name.toLowerCase().endsWith(expected);
    setUploads((current) => current.map((record, itemIndex) => itemIndex === index ? {
      ...record,
      file: invalid ? null : file,
      fileName: invalid ? file.name : file.name,
      size: file.size,
      type: file.type,
      status: invalid ? 'error' : 'ready',
      error: invalid ? 'Fingerprint uploads must use the .firpiv file format.' : undefined,
    } : record));
  };
  const submit = async () => {
    if (!ready || !uploads[0].file || !uploads[1].file || !uploads[2].file) {
      setError('Select a valid passport, identity document, and .firpiv fingerprint file before submitting.');
      return;
    }
    setPhase('uploading');
    setError('');
    await new Promise((resolve) => window.setTimeout(resolve, 300));
    setPhase('verifying');
    try {
      const response = await submitVerification({ passport: uploads[0].file, identityDocument: uploads[1].file, fingerprint: uploads[2].file });
      setPhase('complete');
      onResult(response);
    } catch (caught) {
      setPhase('error');
      setError(caught instanceof Error ? caught.message : 'The verification service returned an unknown error.');
    }
  };
  return (
    <div className="mx-auto max-w-6xl slide-up">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><div className="flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent-border))]"><ClipboardCheck size={14} /> Controlled submission</div><h2 className="mt-3 font-display text-3xl font-extrabold tracking-[-.04em] md:text-4xl">Start a new verification</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">Provide the source files exactly as issued. The configured backend performs identity, document, fingerprint, face, liveness, and integrity checks.</p></div>
        <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.75)] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))]"><LockKeyhole size={14} className="text-[hsl(var(--accent-border))]" /> Files remain local until submit</div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.9)] p-5 md:p-6" data-testid="card-document-selection">
            <div className="flex items-start justify-between gap-4"><div><div className="font-display text-lg font-bold">Identity document</div><p className="mt-1 text-xs leading-5 text-[hsl(var(--muted-foreground))]">Select the secondary document you are attaching.</p></div><FileKey2 size={19} className="text-[hsl(var(--muted-foreground))]" /></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {([['aadhaar', 'Aadhaar', 'Government identity card'], ['driving_licence', 'Driving Licence', 'Issued driving document']] as const).map(([value, label, copy]) => <button key={value} onClick={() => setDocumentKind(value)} className={`rounded-xl border p-4 text-left transition ${documentKind === value ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.06)] ring-2 ring-[hsl(var(--primary)/.1)]' : 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/.4)]'}`} data-testid={`button-document-${value}`}><div className="flex items-center justify-between"><span className="text-sm font-bold">{label}</span><span className={`grid h-5 w-5 place-items-center rounded-full border ${documentKind === value ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--input))] text-transparent'}`}><Check size={12} /></span></div><div className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{copy}</div></button>)}
            </div>
          </section>
          <FileDrop record={uploads[0]} label="Passport" helper="Primary document · PDF, JPG, or PNG" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" icon={FileBadge} onFile={(file) => setFile(0, file)} />
          <FileDrop record={uploads[1]} label={documentKind === 'aadhaar' ? 'Aadhaar' : 'Driving Licence'} helper="One secondary identity document · PDF, JPG, or PNG" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" icon={FileText} onFile={(file) => setFile(1, file)} />
          <FileDrop record={uploads[2]} label="Fingerprint file" helper="Biometric source · .firpiv only · contents are never previewed" accept=".firpiv" icon={Fingerprint} onFile={(file) => setFile(2, file)} />
          {error && phase === 'idle' && <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900" data-testid="status-submit-validation"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{error}</div>}
          <button onClick={() => void submit()} disabled={phase === 'uploading' || phase === 'verifying'} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] text-sm font-bold text-[hsl(var(--primary-foreground))] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-submit-verification">{phase === 'uploading' || phase === 'verifying' ? <><LoaderCircle size={17} className="animate-spin" /> {phase === 'uploading' ? 'Uploading evidence…' : 'Waiting for verification…'}</> : <><ShieldEllipsis size={17} /> Submit for verification</>}</button>
        </div>
        <div className="space-y-5">
          <Readiness uploads={uploads} documentKind={documentKind} />
          <ProgressPanel phase={phase} error={phase === 'error' ? error : undefined} />
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--primary)/.045)] p-5 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><div className="flex items-center gap-2 font-bold text-[hsl(var(--foreground))]"><CircleHelp size={15} className="text-[hsl(var(--accent-border))]" /> Before you submit</div><ul className="mt-3 list-disc space-y-2 pl-4"><li>Check that each file belongs to the same subject.</li><li>Do not rename or open the fingerprint file to inspect its contents.</li><li>A result is not shown until the backend returns a response.</li></ul></div>
        </div>
      </div>
    </div>
  );
}

function returnedValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return 'Not returned';
  if (typeof value === 'boolean') return value ? 'Passed' : 'Not passed';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  return 'Returned';
}

function ResultStatus({ value }: { value: unknown }) {
  if (value === undefined || value === null) return <StatusPill tone="neutral">Not returned</StatusPill>;
  if (value === true) return <StatusPill tone="success"><CheckCircle2 size={13} /> Passed</StatusPill>;
  if (value === false) return <StatusPill tone="danger"><X size={13} /> Not passed</StatusPill>;
  return <StatusPill tone="neutral">{String(value)}</StatusPill>;
}

function SafeIdentity({ identity }: { identity: Record<string, unknown> | null | undefined }) {
  if (!identity || Object.keys(identity).length === 0) return <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-4 text-xs text-[hsl(var(--muted-foreground))]" data-testid="text-identity-not-returned">No identity fields returned by the backend.</div>;
  const allowed = Object.entries(identity).filter(([key]) => ['name', 'full_name', 'display_name', 'gender', 'date_of_birth', 'nationality'].includes(key.toLowerCase()));
  if (!allowed.length) return <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-4 text-xs text-[hsl(var(--muted-foreground))]" data-testid="text-identity-masked">Identity fields returned but withheld from display for safety.</div>;
  return <div className="grid gap-3 sm:grid-cols-2">{allowed.map(([key, value]) => <div key={key} className="rounded-xl bg-[hsl(var(--muted)/.7)] p-3"><div className="font-mono-ui text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{key.replaceAll('_', ' ')}</div><div className="mt-1 text-sm font-bold" data-testid={`text-identity-${key}`}>{String(value)}</div></div>)}</div>;
}

function ResultPage({ response }: { response: VerificationEnvelope | null }) {
  const verification = response?.verification;
  const stages = [
    ['Identity found', verification?.identity_found, UserRound],
    ['Document verification', verification?.document_verification, FileCheck2],
    ['Fingerprint match', verification?.fingerprint_match, Fingerprint],
    ['Face match', verification?.face_match, ScanFace],
    ['Liveness passed', verification?.liveness_passed, ShieldCheck],
    ['Hash match', verification?.hash_match, FileKey2],
  ] as const;
  if (!response) return <div className="mx-auto max-w-3xl py-10 slide-up"><section className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/.75)] p-8 text-center md:p-14" data-testid="empty-last-result"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"><FileCheck2 size={24} /></div><h2 className="mt-5 font-display text-2xl font-extrabold">No verification response yet</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[hsl(var(--muted-foreground))]">Submit a verification first. This view never invents or retains results outside the current browser session.</p><Link href="/verification/new" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-bold text-[hsl(var(--primary-foreground))]" data-testid="link-create-first-verification">Create verification <ArrowRight size={16} /></Link></section></div>;
  return (
    <div className="mx-auto max-w-6xl slide-up">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="flex items-center gap-2 font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--accent-border))]"><FileCheck2 size={14} /> Backend response</div><h2 className="mt-3 font-display text-3xl font-extrabold tracking-[-.04em] md:text-4xl">Layered result review</h2><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Only values returned by the latest verification request are shown below.</p></div><Link href="/verification/new" className="inline-flex w-fit items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-sm font-bold hover:bg-[hsl(var(--muted))]" data-testid="link-new-verification-from-result">New verification <ArrowRight size={16} /></Link></div>
      <section className="mb-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.9)] p-5 md:p-6" data-testid="card-final-status">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><div className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Final status</div><div className="mt-2 flex items-center gap-3"><h3 className="font-display text-2xl font-extrabold">{verification?.final_status ? String(verification.final_status) : 'Not returned'}</h3><ResultStatus value={verification?.final_status} /></div></div><div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/.55)] px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]"><div className="flex items-center gap-2 font-bold text-[hsl(var(--foreground))]"><Info size={14} /> Response envelope</div><div className="mt-1 font-mono-ui text-[10px]" data-testid="text-response-success">{response.success === undefined ? 'success not returned' : `success: ${String(response.success)}`}</div></div></div>
      </section>
      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.9)] p-5 md:p-6" data-testid="card-layered-checks"><div className="flex items-center justify-between"><div><div className="font-display text-lg font-bold">Verification layers</div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">A missing field remains explicitly unreported.</p></div><ShieldCheck size={19} className="text-[hsl(var(--accent-border))]" /></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{stages.map(([label, value, Icon]) => <div key={label} className="flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] p-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--primary))]"><Icon size={16} /></div><div className="min-w-0"><div className="text-xs font-bold">{label}</div><div className="mt-1"><ResultStatus value={value} /></div></div></div>)}</div></section>
        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.9)] p-5 md:p-6" data-testid="card-returned-measures"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--muted))] text-[hsl(var(--primary))]"><FileCheck2 size={19} /></div><div><div className="font-display text-lg font-bold">Returned measures</div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">No client-side interpretation applied.</p></div></div><div className="mt-6 space-y-3">{[['Fingerprint score', response.fingerprint_score ?? (response.fingerprint && typeof response.fingerprint === 'object' ? (response.fingerprint as Record<string, unknown>).score : undefined)], ['Face score', response.face_score], ['Liveness', response.liveness], ['Integrity', response.integrity]].map(([label, value]) => <div key={label as string} className="flex items-center justify-between gap-3 rounded-xl bg-[hsl(var(--muted)/.65)] px-3 py-3"><span className="text-xs font-semibold">{label as string}</span><span className="font-mono-ui text-xs font-medium text-[hsl(var(--muted-foreground))]" data-testid={`text-measure-${String(label).toLowerCase().replaceAll(' ', '-')}`}>{returnedValue(value)}</span></div>)}</div></section>
      </div>
      <section className="mt-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card)/.9)] p-5 md:p-6" data-testid="card-returned-identity"><div className="mb-5 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--muted))] text-[hsl(var(--primary))]"><UserRound size={19} /></div><div><div className="font-display text-lg font-bold">Returned identity</div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Only low-risk descriptive fields are displayed. Sensitive identifiers are withheld.</p></div></div><SafeIdentity identity={response.identity} /></section>
    </div>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Router({ session, onEnter, onLogout, onResult, result }: { session: OfficerSession; onEnter: (session: OfficerSession) => void; onLogout: () => void; onResult: (response: VerificationEnvelope) => void; result: VerificationEnvelope | null }) {
  const [location] = useLocation();
  if (!session.authenticated && location !== '/') return <Login onEnter={onEnter} />;
  if (!session.authenticated) return <Switch><Route path="/" component={() => <Login onEnter={onEnter} />} /><Route component={() => <Login onEnter={onEnter} />} /></Switch>;
  return <Workspace session={session} onLogout={onLogout}><RoutedErrorBoundary><Switch><Route path="/dashboard" component={Dashboard} /><Route path="/verification/new" component={() => <VerificationNew onResult={onResult} />} /><Route path="/verification/result" component={() => <ResultPage response={result} />} /><Route path="/" component={Dashboard} /><Route component={Dashboard} /></Switch></RoutedErrorBoundary></Workspace>;
}

function App() {
  const [session, setSession] = useState<OfficerSession>(getInitialSession);
  const [result, setResult] = useState<VerificationEnvelope | null>(getStoredResult);
  useEffect(() => {
    if (session.authenticated) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  }, [session]);
  const enter = (next: OfficerSession) => setSession(next);
  const logout = () => { setSession({ officerId: '', displayName: '', authenticated: false }); setResult(null); sessionStorage.removeItem(RESULT_KEY); };
  const saveResult = (response: VerificationEnvelope) => { setResult(response); sessionStorage.setItem(RESULT_KEY, JSON.stringify(response)); window.history.pushState({}, '', '/verification/result'); window.dispatchEvent(new PopStateEvent('popstate')); };
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router session={session} onEnter={enter} onLogout={logout} onResult={saveResult} result={result} /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;