'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Opportunity, UserPatch, View } from '../../../packages/domain/index';
import { expired, viewOf } from '../../../packages/domain/index';
import { auth, isDemo, request, token, signIn, signOut } from '../lib/client';
type Listing = {
  shortlist: Opportunity[];
  items: Opportunity[];
  total: number;
  nextCursor: string | null;
};
type Health = {
  mode: string;
  lastRun: { status: string; completedAt?: string; startedAt: string } | null;
  lastSuccessfulRun: { completedAt?: string } | null;
};
const names: Record<View, string> = {
  recommended: 'Recommended',
  pursuing: 'Pursuing',
  filtered: 'Filtered out',
};
const date = (v: string | null) =>
  v
    ? new Date(v + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'Date unconfirmed';
const reasons = [
  'Staffing / BPO only',
  'Incidental scope',
  'Platform restriction',
  'Eligibility',
  'Deadline',
  'No capacity',
  'Duplicate',
  'Other',
];
export default function SignalApp() {
  const [access, setAccess] = useState<string | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState('');
  const [view, setView] = useState<View>('recommended'),
    [query, setQuery] = useState(''),
    [completed, setCompleted] = useState(false),
    [onlyNew, setOnlyNew] = useState(false);
  const [listing, setListing] = useState<Listing>({
      shortlist: [],
      items: [],
      total: 0,
      nextCursor: null,
    }),
    [health, setHealth] = useState<Health | null>(null),
    [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Opportunity | null>(null),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState('');
  const [passTarget, setPassTarget] = useState<Opportunity | null>(null),
    [reason, setReason] = useState(''),
    [reasonFilter, setReasonFilter] = useState('');
  const [undo, setUndo] = useState<{ o: Opportunity; version: number } | null>(null);
  const since = useRef('');
  const loadGeneration = useRef(0);
  useEffect(() => {
    since.current = localStorage.getItem('grs-last-visit') || '';
    localStorage.setItem('grs-last-visit', new Date().toISOString());
    token()
      .then(setAccess)
      .catch((e) => setError(e.message))
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (isDemo || !access) return;
    const expired = () => setAccess(null);
    auth().events.addAccessTokenExpired(expired);
    auth().events.addSilentRenewError(expired);
    return () => {
      auth().events.removeAccessTokenExpired(expired);
      auth().events.removeSilentRenewError(expired);
    };
  }, [access]);
  const load = useCallback(async () => {
    if (!access) return;
    const generation = ++loadGeneration.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ view, q: query, completed: String(completed) });
      if (onlyNew && since.current) params.set('since', since.current);
      if (reasonFilter) params.set('reason', reasonFilter);
      const [data, h] = await Promise.all([
        request<Listing>('/opportunities?' + params, access),
        request<Health>('/health', access),
      ]);
      if (generation !== loadGeneration.current) return;
      setListing(data);
      setHealth(h);
      setError('');
    } catch (e) {
      if (generation === loadGeneration.current) setError((e as Error).message);
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [access, view, query, completed, onlyNew, reasonFilter]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 180);
    return () => {
      clearTimeout(t);
      loadGeneration.current++;
    };
  }, [load]);
  useEffect(() => {
    if (!access) return;
    const openFromUrl = () => {
      const id = new URLSearchParams(location.search).get('opportunity');
      if (id)
        request<Opportunity>('/opportunities/' + encodeURIComponent(id), access)
          .then(setSelected)
          .catch((e) => setError(e.message));
      else setSelected(null);
    };
    openFromUrl();
    window.addEventListener('popstate', openFromUrl);
    return () => window.removeEventListener('popstate', openFromUrl);
  }, [access]);
  function open(o: Opportunity) {
    setSelected(o);
    const u = new URL(location.href);
    u.searchParams.set('opportunity', o.id);
    history.pushState({}, '', u);
  }
  function close() {
    setSelected(null);
    const u = new URL(location.href);
    u.searchParams.delete('opportunity');
    history.replaceState({}, '', u);
  }
  async function patch(o: Opportunity, p: Omit<UserPatch, 'version'>) {
    if (!access) return;
    setBusy(true);
    try {
      const updated = await request<Opportunity>('/opportunities/' + o.id, access, {
        method: 'PATCH',
        body: JSON.stringify({ ...p, version: o.version }),
      });
      if (selected?.id === o.id) setSelected(updated);
      if (p.status === 'pursue') setUndo({ o, version: updated.version });
      else setUndo(null);
      setToast(
        p.restore ? 'Restored to review' : p.status ? `Moved to ${p.status}` : 'Changes saved',
      );
      setPassTarget(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
      if (selected)
        request<Opportunity>('/opportunities/' + selected.id, access)
          .then(setSelected)
          .catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  const actions = {
    open,
    pursue: (o: Opportunity) => void patch(o, { status: 'pursue' }),
    pass: (o: Opportunity) => {
      setReason('');
      setPassTarget(o);
    },
    restore: (o: Opportunity) => void patch(o, { restore: true }),
  };
  if (!ready)
    return (
      <main className="auth">
        <Brand />
        <p>Opening your workspace…</p>
      </main>
    );
  if (!access)
    return (
      <main className="auth">
        <Brand />
        <h1>
          The opportunities
          <br />
          worth your attention.
        </h1>
        <p>Public-sector procurement intelligence for Guided Reach Solutions.</p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary" onClick={() => signIn().catch((e) => setError(e.message))}>
          Sign in to your workspace →
        </button>
      </main>
    );
  const latest = health?.lastRun,
    stale =
      !health?.lastSuccessfulRun?.completedAt ||
      Date.now() - new Date(health.lastSuccessfulRun.completedAt).getTime() > 36 * 3600000;
  return (
    <div className="app">
      <aside className="sidebar" aria-label="Workspace navigation">
        <Brand />
        <div className="sidebar-label">Workspace</div>
        <nav aria-label="Opportunity views">
          {(Object.keys(names) as View[]).map((v) => (
            <button
              key={v}
              aria-current={v === view ? 'page' : undefined}
              className={v === view ? 'tab active' : 'tab'}
              onClick={() => {
                setView(v);
                setReasonFilter('');
                setOnlyNew(false);
              }}
            >
              <Icon name={v} />
              <span>{names[v]}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="workspace-avatar" aria-hidden="true">
            GRS
          </span>
          <span>
            Guided Reach Solutions<small>Procurement intelligence</small>
          </span>
          {!isDemo && (
            <button
              className="signout"
              title="Sign out"
              aria-label="Sign out"
              onClick={() => void signOut().catch((e) => setError(e.message))}
            >
              <Icon name="exit" />
            </button>
          )}
        </div>
      </aside>
      <main className="content">
        <div className="page-heading">
          <div className="breadcrumb">
            <span>Opportunities</span>
            <span className="slash">/</span>
            <h1>{names[view]}</h1>
            {isDemo && (
              <span
                className="preview-label"
                title="Fictional opportunities. Simulated research. No API spend."
              >
                Demo data
              </span>
            )}
          </div>
          <div
            className="freshness"
            title="Search-based discovery covers accessible public sources, not every procurement portal."
          >
            <span className={stale ? 'status-dot warning' : 'status-dot'} />
            {latest?.status === 'running'
              ? 'Research in progress'
              : latest?.completedAt
                ? `Checked ${new Date(latest.completedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                : 'Awaiting research'}
            <small>
              {latest?.status === 'partial'
                ? 'Partial run · previous findings retained'
                : latest?.status === 'budget_deferred'
                  ? 'Research deferred · budget limit'
                  : stale
                    ? 'Results need a fresh check'
                    : 'Daily research · public sources'}
            </small>
          </div>
        </div>
        <div className="toolbar">
          <label className="search">
            <Icon name="search" />
            <input
              aria-label="Search opportunities"
              placeholder="Search opportunities…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        {error && (
          <div role="alert" className="error">
            {error}
            <button onClick={() => void load()}>Retry</button>
          </div>
        )}
        <div className="section-heading">
          <div>
            <span className="section-label">
              {view === 'recommended'
                ? 'Priority shortlist'
                : view === 'pursuing'
                  ? 'Active pursuits'
                  : 'Review history'}
            </span>
            <span className="result-count">
              {view === 'recommended' ? String(listing.shortlist.length) : String(listing.total)}
            </span>
          </div>
          {view === 'recommended' ? (
            <label className="toggle">
              <input
                type="checkbox"
                checked={onlyNew}
                onChange={(e) => setOnlyNew(e.target.checked)}
              />{' '}
              New since last visit
            </label>
          ) : view === 'pursuing' ? (
            <label className="toggle">
              <input
                type="checkbox"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
              />{' '}
              Include completed
            </label>
          ) : (
            <select
              aria-label="Filter by reason"
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
            >
              <option value="">All reasons</option>
              {[
                ...new Set([
                  ...reasons,
                  ...listing.items.map(
                    (o) => o.passReason || o.facts.excludedReason || o.disposition,
                  ),
                ]),
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          )}
        </div>
        <div className="list-columns" aria-hidden="true">
          <span>Agency / opportunity</span>
          <span>Due date</span>
          <span>Fit</span>
        </div>
        {loading ? (
          <div className="empty">Loading opportunities…</div>
        ) : (
          <>
            {view === 'recommended' &&
              listing.shortlist.map((o, i) => (
                <Card key={o.id} o={o} index={i + 1} {...actions} busy={busy} />
              ))}
            {view === 'recommended' && listing.shortlist.length === 0 && (
              <div className="empty">
                <span className="empty-icon">◎</span>
                <h2>No strong matches to surface.</h2>
                <p>
                  {latest?.status === 'completed'
                    ? 'The latest research found no opportunities that meet the shortlist criteria.'
                    : 'Research is incomplete or pending. Previous findings remain below.'}
                </p>
              </div>
            )}
            {view !== 'recommended' &&
              listing.items.map((o) => <Card key={o.id} o={o} {...actions} busy={busy} compact />)}
            {view !== 'recommended' && listing.items.length === 0 && (
              <div className="empty">
                <h2>
                  {view === 'pursuing'
                    ? 'Your next pursuit starts here.'
                    : 'Nothing filtered out yet.'}
                </h2>
                <p>
                  {view === 'pursuing'
                    ? 'Choose Pursue on an opportunity to keep it in focus.'
                    : 'Assessed exclusions and passed opportunities will appear here.'}
                </p>
              </div>
            )}
            {view === 'recommended' && listing.items.length > 0 && (
              <section className="more">
                <button className="more-toggle" aria-expanded={more} onClick={() => setMore(!more)}>
                  <span>
                    <Icon name={more ? 'down' : 'right'} /> More matches{' '}
                    <b>{listing.items.length}</b>
                  </span>
                  <span>Lower fit or needs verification</span>
                </button>
                {more &&
                  listing.items.map((o) => (
                    <Card key={o.id} o={o} {...actions} busy={busy} compact />
                  ))}
              </section>
            )}
            {listing.nextCursor && (view !== 'recommended' || more) && (
              <button
                className="load-more"
                disabled={busy}
                onClick={async () => {
                  const generation = loadGeneration.current;
                  setBusy(true);
                  try {
                    const params = new URLSearchParams({
                      view,
                      q: query,
                      completed: String(completed),
                      cursor: listing.nextCursor!,
                    });
                    if (onlyNew && since.current) params.set('since', since.current);
                    if (reasonFilter) params.set('reason', reasonFilter);
                    const data = await request<Listing>('/opportunities?' + params, access);
                    if (generation === loadGeneration.current)
                      setListing({ ...data, items: [...listing.items, ...data.items] });
                  } catch (e) {
                    if (generation === loadGeneration.current) setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Load more
              </button>
            )}
          </>
        )}
        <footer>
          {isDemo
            ? 'Demo workspace · Fictional opportunities · No API spend'
            : 'Official sources remain the procurement record.'}
        </footer>
      </main>
      {selected && (
        <Detail
          o={selected}
          close={close}
          busy={busy}
          save={(p) => patch(selected, p)}
          pass={() => actions.pass(selected)}
          restore={() => actions.restore(selected)}
        />
      )}
      {passTarget && (
        <Modal title="Pass on this opportunity" close={() => setPassTarget(null)}>
          <p className="muted">{passTarget.title}</p>
          <label className="field">
            Reason
            <select autoFocus value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choose a reason</option>
              {reasons.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <p className="hint">Your decision is preserved when research updates this opportunity.</p>
          <button
            className="primary"
            disabled={!reason || busy}
            onClick={() => void patch(passTarget, { status: 'pass', passReason: reason })}
          >
            Confirm pass
          </button>
        </Modal>
      )}
      {toast && (
        <div role="status" className="toast">
          {toast}
          {undo && (
            <button
              onClick={() =>
                void patch({ ...undo.o, version: undo.version }, { status: undo.o.status })
              }
            >
              Undo
            </button>
          )}
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
type IconName = 'recommended' | 'pursuing' | 'filtered' | 'search' | 'right' | 'down' | 'exit';
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    recommended: (
      <>
        <path d="M4 4h12v12H4z" />
        <path d="M4 11h3l2 2h2l2-2h3" />
      </>
    ),
    pursuing: (
      <>
        <circle cx="10" cy="10" r="6.5" />
        <path d="m8 7 5 3-5 3z" />
      </>
    ),
    filtered: (
      <>
        <path d="M4 6h12v10H4zM3 3h14v3H3zM8 10h4" />
      </>
    ),
    search: (
      <>
        <circle cx="8.5" cy="8.5" r="5" />
        <path d="m12 12 4.5 4.5" />
      </>
    ),
    right: <path d="m8 5 5 5-5 5" />,
    down: <path d="m5 8 5 5 5-5" />,
    exit: (
      <>
        <path d="M8 4H4v12h4M9 10h8m-3-3 3 3-3 3" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
function Brand() {
  return (
    <div className="brand">
      <img className="brand-mark" src="/guided-reach-mark.png" width="30" height="30" alt="" />
      <span className="brand-wordmark">
        <strong>GRS Signal</strong>
        <small>by Guided Reach</small>
      </span>
    </div>
  );
}
function Card({
  o,
  open,
  index,
}: {
  o: Opportunity;
  open: (o: Opportunity) => void;
  index?: number;
  busy: boolean;
  compact?: boolean;
}) {
  const filtered = viewOf(o) === 'filtered';
  const attention = filtered
    ? o.passReason || o.facts.excludedReason || 'Low fit'
    : o.procurementState !== 'open'
      ? o.procurementState
      : expired(o, new Date())
        ? 'Deadline passed'
        : o.confirmedBlocker
          ? 'Pursuit blocker'
          : o.confidence !== 'supported'
            ? 'Needs verification'
            : !o.verifiedAt || Date.now() - Date.parse(o.verifiedAt) > 72 * 3600000
              ? 'Fresh check needed'
              : null;
  return (
    <button
      className={'opportunity ' + (index ? 'priority' : '')}
      onClick={() => open(o)}
      aria-label={o.agency + ', ' + o.state + ' — ' + o.title}
      aria-haspopup="dialog"
    >
      <span
        className={'row-status status-' + o.status}
        title={o.status}
        aria-label={'Status: ' + o.status}
      />
      <span className="row-main">
        <span className="row-agency">
          <strong>{isDemo ? o.agency.replace(/ \(fictional\)$/, '') : o.agency}</strong>
          <span className="row-state">{o.state}</span>
        </span>
        <span className="row-title">{o.title}</span>
        {attention && <span className="row-attention">{attention}</span>}
      </span>
      <span className="row-due">
        {o.dueDate ? date(o.dueDate) : o.ongoing ? 'Ongoing' : 'Unconfirmed'}
      </span>
      <span
        className={'row-score ' + (index ? 'high' : '')}
        title={o.score + '/100 GRS fit · ' + o.confidence}
      >
        {o.score}
      </span>
    </button>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, close);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <button className="close" aria-label="Close dialog" onClick={close}>
          ×
        </button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
function useDialog(ref: React.RefObject<HTMLDivElement | null>, close: () => void) {
  const onClose = useRef(close);
  onClose.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const listener = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs[dialogs.length - 1] !== ref.current) return;
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onClose.current();
      }
      if (e.key === 'Tab') {
        const list = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]',
        );
        if (!list?.length) return;
        const first = list[0]!,
          last = list[list.length - 1]!;
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener('keydown', listener);
      previous?.focus();
    };
  }, [ref]);
}
function Detail({
  o,
  close,
  save,
  pass,
  restore,
  busy,
}: {
  o: Opportunity;
  close: () => void;
  save: (p: Omit<UserPatch, 'version'>) => Promise<void>;
  pass: () => void;
  restore: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, close);
  const [notes, setNotes] = useState(o.notes),
    [next, setNext] = useState(o.userNextAction),
    [nextDate, setNextDate] = useState(o.userNextDate || '');
  useEffect(() => {
    setNotes(o.notes);
    setNext(o.userNextAction);
    setNextDate(o.userNextDate || '');
  }, [o.id, o.notes, o.userNextAction, o.userNextDate]);
  return (
    <div
      className="overlay drawer-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="drawer"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Opportunity details"
        tabIndex={-1}
      >
        <div className="drawer-top">
          <span className="eyebrow">Opportunity brief</span>
          <button className="close" aria-label="Close details" onClick={close}>
            ×
          </button>
        </div>
        <p className="agency">
          {o.agency} · {o.state}
        </p>
        <h1>{o.title}</h1>
        <div className="drawer-badges">
          <b>{o.score} / 100 GRS fit</b>
          <span>
            {o.confidence === 'supported'
              ? 'Source-supported'
              : o.confidence === 'conflicting'
                ? 'Conflicting evidence'
                : 'Evidence incomplete'}
          </span>
          <span>{o.readiness.replaceAll('_', ' ')}</span>
        </div>
        <div className="drawer-actions">
          {viewOf(o) === 'filtered' ? (
            <button className="primary" disabled={busy} onClick={restore}>
              Restore to review
            </button>
          ) : (
            !['pursue', 'submitted', 'won', 'lost'].includes(o.status) && (
              <button
                className="primary"
                disabled={busy}
                onClick={() => void save({ status: 'pursue' })}
              >
                Pursue
              </button>
            )
          )}
          {o.status !== 'pass' && (
            <button disabled={busy} onClick={pass}>
              Pass
            </button>
          )}
          <select
            aria-label="Workflow status"
            value={o.status}
            disabled={busy}
            onChange={(e) => {
              if (e.target.value === 'pass') pass();
              else void save({ status: e.target.value as Opportunity['status'] });
            }}
          >
            {['new', 'reviewing', 'pursue', 'pass', 'submitted', 'won', 'lost'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {o.officialUrl && (
            <a className="source-link" href={o.officialUrl} target="_blank" rel="noreferrer">
              Official source ↗
            </a>
          )}
        </div>
        {o.status === 'pass' && <p className="decision-note">Passed: {o.passReason}</p>}
        <section>
          <h3>Why GRS should care</h3>
          <p>{o.whyFits}</p>
          <div className="next-box">
            <span>Recommended next step</span>
            <p>{o.nextAction}</p>
          </div>
        </section>
        <section>
          <h3>Modernization scope</h3>
          <p>{o.scope}</p>
          <dl>
            <dt>Current platform</dt>
            <dd>{o.legacyPlatform || 'Unknown'}</dd>
            <dt>Target platform</dt>
            <dd>{o.targetPlatform || 'Unknown'}</dd>
            <dt>Likely role</dt>
            <dd>{o.role}</dd>
          </dl>
        </section>
        <section>
          <h3>Procurement facts</h3>
          <dl>
            <dt>Solicitation</dt>
            <dd>{o.solicitationNumber || 'Unknown'}</dd>
            <dt>Type</dt>
            <dd>{o.procurementType}</dd>
            <dt>Published</dt>
            <dd>{date(o.publicationDate)}</dd>
            <dt>Due</dt>
            <dd>
              {date(o.dueDate)}
              {o.dueAt ? ` · ${new Date(o.dueAt).toLocaleTimeString()}` : ' · Time unverified'}
            </dd>
            <dt>Procurement state</dt>
            <dd>{o.procurementState}</dd>
            {o.actionDates.map((d) => (
              <div className="dl-row" key={d.label}>
                <dt>{d.label}</dt>
                <dd>{date(d.date)}</dd>
              </div>
            ))}
          </dl>
        </section>
        {(o.blockers.length > 0 || o.unresolvedFields.length > 0) && (
          <section>
            <h3>Blockers & unknowns</h3>
            <ul>
              {[...o.blockers, ...o.unresolvedFields].map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>
        )}
        <section>
          <h3>Supporting evidence</h3>
          {o.evidence.map((e, i) => (
            <blockquote key={i}>
              <p>{e.excerpt}</p>
              <a href={e.url} target="_blank" rel="noreferrer">
                {e.official ? 'Official evidence' : 'Discovery source'}
                {e.locator ? ` · ${e.locator}` : ''} ↗
              </a>
            </blockquote>
          ))}
          <details>
            <summary>Score breakdown · rubric {o.ruleVersion}</summary>
            <dl>
              {Object.entries(o.breakdown).map(([k, v]) => (
                <div className="dl-row" key={k}>
                  <dt>{k}</dt>
                  <dd>{v} points</dd>
                </div>
              ))}
            </dl>
          </details>
        </section>
        <section>
          <h3>Your next move</h3>
          <label className="field">
            Next action
            <input
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="Optional"
              maxLength={1500}
            />
          </label>
          <label className="field">
            Action date
            <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </label>
          <label className="field">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Capture qualification notes…"
              rows={4}
              maxLength={5000}
            />
          </label>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void save({ notes, userNextAction: next, userNextDate: nextDate || null })
            }
          >
            Save changes
          </button>
        </section>
        <section>
          <h3>Activity</h3>
          <p className="hint">
            First found {new Date(o.firstFoundAt).toLocaleDateString()} · Last verified{' '}
            {o.verifiedAt ? new Date(o.verifiedAt).toLocaleString() : 'Not verified'}
          </p>
          {[...o.history].reverse().map((h, i) => (
            <div className="history" key={i}>
              <span />
              <div>
                <p>{h.message}</p>
                <small>
                  {new Date(h.at).toLocaleString()} · {h.actor}
                </small>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
