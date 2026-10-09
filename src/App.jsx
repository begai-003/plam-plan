import { useCallback, useEffect, useRef, useState } from "react";
import { configured, auth } from "./services/firebase";
import { watchAuth, login, logout } from "./services/authService";
import { kitRepository, paintRepository } from "./services/repository";
import { pendingCleanup, retryCleanup } from "./services/imageRepository";
import {
  Button,
  Empty,
  KitImage,
  Message,
  Modal,
  dateLabel,
} from "./components/common";
import { KitDetail } from "./components/Detail";
import { RecordEditor } from "./components/RecordEditor";
import { hasStock, matchesPaint, clone } from "./domain";
import { PaintFields } from "./components/forms";
export function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);
  const [route, setRoute] = useState(() => location.hash.slice(1) || "/");
  const routeRef = useRef(route);
  const [dirty, setDirtyState] = useState(false);
  const dirtyRef = useRef(false);
  const setDirty = useCallback((value) => {
    dirtyRef.current = value;
    setDirtyState(value);
  }, []);
  const [online, setOnline] = useState(navigator.onLine);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!configured) {
      setAuthReady(true);
      return;
    }
    return watchAuth(
      (value) => {
        setUser(value);
        if (value) setAuthError("");
        setAuthReady(true);
      },
      (e) => setAuthError(e.message),
    );
  }, []);
  const navigate = useCallback(
    (next, force = false) => {
      if (
        !force &&
        dirtyRef.current &&
        !window.confirm("未保存の入力を破棄して移動しますか？")
      )
        return;
      setDirty(false);
      routeRef.current = next;
      setRoute(next);
      location.hash = next;
    },
    [setDirty],
  );
  useEffect(() => {
    if (!configured || !authReady) return;
    const isLogin = route.split("?")[0] === "/login";
    if (!user && !isLogin)
      navigate(`/login?returnTo=${encodeURIComponent(route)}`, true);
    if (user && isLogin) {
      const target = new URLSearchParams(route.split("?")[1] || "").get(
        "returnTo",
      );
      navigate(
        target?.startsWith("/") &&
          !target.startsWith("//") &&
          !target.startsWith("/login")
          ? target
          : "/",
        true,
      );
    }
  }, [authReady, user, route, navigate]);
  useEffect(() => {
    const hash = () => {
      const next = location.hash.slice(1) || "/";
      if (next === routeRef.current) return;
      if (
        dirtyRef.current &&
        !window.confirm("未保存の入力を破棄して移動しますか？")
      ) {
        location.hash = routeRef.current;
        return;
      }
      setDirty(false);
      routeRef.current = next;
      setRoute(next);
    };
    const unload = (e) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const connection = () => setOnline(navigator.onLine);
    window.addEventListener("hashchange", hash);
    window.addEventListener("beforeunload", unload);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
  }, [setDirty]);
  const signIn = async () => {
    setBusy(true);
    setAuthError("");
    try {
      await login();
      if (route === "/login") navigate("/", true);
    } catch (e) {
      setAuthError(
        e.message === "このアカウントでは利用できません"
          ? e.message
          : e.code === "auth/popup-closed-by-user"
            ? "ログインがキャンセルされました"
            : e.code === "auth/popup-blocked"
              ? "ポップアップを許可して再試行してください"
              : "ログインに失敗しました。通信とGoogleアカウントを確認して再試行してください",
      );
    } finally {
      setBusy(false);
    }
  };
  const signOut = async () => {
    if (
      dirtyRef.current &&
      !window.confirm("未保存の入力を破棄してログアウトしますか？")
    )
      return;
    setBusy(true);
    setAuthError("");
    try {
      await logout();
      setDirty(false);
      setNotice("");
      navigate("/login", true);
    } catch {
      setAuthError("ログアウトに失敗しました。再試行してください");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" onClick={() => navigate("/")}>
            <span className="brand-icon" aria-hidden="true">
              ▧
            </span>
            plam-plan<span className="brand-sub">PAINTING NOTEBOOK</span>
          </button>
          {user && (
            <nav aria-label="メインメニュー">
              <Button
                aria-current={route === "/" ? "page" : undefined}
                onClick={() => navigate("/")}
              >
                キット一覧
              </Button>
              <Button
                aria-current={route.startsWith("/paints") ? "page" : undefined}
                onClick={() => navigate("/paints")}
              >
                保有塗料
              </Button>
              <Button disabled={busy} onClick={signOut}>
                {busy ? "処理中…" : "ログアウト"}
              </Button>
            </nav>
          )}
        </div>
      </header>
      <main>
        {!online && (
          <Message error>
            オフラインです。保存・削除は通信回復後に行ってください。
          </Message>
        )}
        <Message error>{authError}</Message>
        {!authReady ? (
          <Message>認証状態を確認中…</Message>
        ) : !configured ? (
          <section className="login panel">
            <span className="eyebrow">WELCOME TO PLAM-PLAN</span>
            <h1>
              塗装計画を、
              <br />
              ひとつのノートに。
            </h1>
            <p>
              キットごとの色、工程、マスキングをまとめて、
              <br />
              塗装の時間をもっとスムーズに。
            </p>
            <Message>Firebase の接続設定が必要です。</Message>
            <p>
              開発者は README のセットアップ手順に従って、Firebase Web
              設定と許可UIDを設定してください。
            </p>
          </section>
        ) : !user ? (
          <section className="login panel">
            <span className="eyebrow">YOUR PAINTING NOTEBOOK</span>
            <h1>
              塗装計画を、
              <br />
              ひとつのノートに。
            </h1>
            <p>
              ランナーから最後のトップコートまで。
              <br />
              自分だけの塗装計画を、いつでも確認。
            </p>
            <Button tone="primary" disabled={busy || !online} onClick={signIn}>
              {busy ? "ログイン中…" : "Googleでログイン"}
            </Button>
            <p className="muted">
              事前に許可された本人のアカウントのみ利用できます。
            </p>
          </section>
        ) : (
          <Workspace
            key={user.uid}
            route={route}
            navigate={navigate}
            online={online}
            setDirty={setDirty}
            notice={notice}
            onNotice={setNotice}
            dirty={dirty}
          />
        )}
      </main>
      <footer>
        plam-plan <span>MAKE YOUR NEXT COLOR.</span>
      </footer>
    </>
  );
}
function Workspace({ route, navigate, online, setDirty, notice, onNotice }) {
  const [kits, setKits] = useState(null);
  const [paints, setPaints] = useState(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setError("");
    setKits(null);
    setPaints(null);
    const fail = (e) =>
      setError(
        e.code === "permission-denied"
          ? "データへのアクセスが拒否されました。許可UIDとSecurity Rulesを確認してください。"
          : "データの取得に失敗しました。通信を確認して再試行してください。",
      );
    const stopKits = kitRepository.watch(setKits, fail);
    const stopPaints = paintRepository.watch(setPaints, fail);
    return () => {
      stopKits();
      stopPaints();
    };
  }, [retry]);
  const cleanup = async () => {
    try {
      await retryCleanup();
      onNotice("旧画像の削除が完了しました");
    } catch (e) {
      onNotice(e.message);
    }
  };
  if (error)
    return (
      <>
        <Message error>{error}</Message>
        <Button onClick={() => setRetry((x) => x + 1)}>再試行</Button>
      </>
    );
  if (!kits || !paints) return <Message>データを読み込み中…</Message>;
  const sortedKits = [...kits].sort(
    (a, b) =>
      (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0),
  );
  const sortedPaints = [...paints].sort((a, b) =>
    a.name.localeCompare(b.name, "ja"),
  );
  const detail = route.match(/^\/kits\/([^/]+)(\/edit)?$/);
  const paintEdit = route.match(/^\/paints\/([^/]+)\/edit$/);
  let page;
  if (route === "/" || route === "/login")
    page = <KitList kits={sortedKits} navigate={navigate} />;
  else if (route === "/kits/new")
    page = (
      <RecordEditor
        key="new-kit"
        kind="kit"
        paints={paints}
        navigate={navigate}
        setDirty={setDirty}
        online={online}
        onNotice={onNotice}
      />
    );
  else if (route === "/paints/new")
    page = (
      <RecordEditor
        key="new-paint"
        kind="paint"
        paints={paints}
        navigate={navigate}
        setDirty={setDirty}
        online={online}
        onNotice={onNotice}
      />
    );
  else if (route === "/paints")
    page = (
      <PaintList
        setDirty={setDirty}
        paints={sortedPaints}
        navigate={navigate}
        online={online}
        onNotice={onNotice}
      />
    );
  else if (paintEdit) {
    const paint = paints.find((p) => p.id === paintEdit[1]);
    page = paint ? (
      <RecordEditor
        key={`paint-${paint.id}`}
        kind="paint"
        record={paint}
        paints={paints}
        navigate={navigate}
        setDirty={setDirty}
        online={online}
        onNotice={onNotice}
      />
    ) : (
      <NotFound navigate={navigate} />
    );
  } else if (detail) {
    const kit = kits.find((k) => k.id === detail[1]);
    page = !kit ? (
      <NotFound navigate={navigate} />
    ) : detail[2] && kit.status !== "deleting" ? (
      <RecordEditor
        key={`kit-edit-${kit.id}`}
        kind="kit"
        record={kit}
        paints={paints}
        navigate={navigate}
        setDirty={setDirty}
        online={online}
        onNotice={onNotice}
      />
    ) : (
      <KitDetail
        key={kit.id}
        kit={kit}
        paints={paints}
        navigate={navigate}
        setDirty={setDirty}
        online={online}
        onNotice={onNotice}
      />
    );
  } else page = <NotFound navigate={navigate} />;
  return (
    <>
      <Message>{notice}</Message>
      {pendingCleanup().length > 0 && (
        <Message>
          旧画像の削除が未完了です。
          <Button disabled={!online} onClick={cleanup}>
            画像の削除を再試行
          </Button>
        </Message>
      )}
      {page}
    </>
  );
}
function NotFound({ navigate }) {
  return (
    <>
      <h1>見つかりません</h1>
      <p>削除されたか、URLが正しくない可能性があります。</p>
      <Button onClick={() => navigate("/")}>キット一覧へ</Button>
    </>
  );
}
function KitList({ kits, navigate }) {
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem("plam-plan-view") === "list"
        ? "list"
        : "cards";
    } catch {
      return "cards";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("plam-plan-view", view);
    } catch {
      /* Display preferences are optional. */
    }
  }, [view]);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR WORKBENCH</span>
          <h1>
            キット一覧 <span className="count">{kits.length}</span>
          </h1>
          <p className="muted">次の一色を、ここから。</p>
        </div>
        <Button tone="primary" onClick={() => navigate("/kits/new")}>
          ＋ キット登録
        </Button>
      </div>
      <div className="view-switch" aria-label="表示形式">
        <Button
          aria-pressed={view === "cards"}
          onClick={() => setView("cards")}
        >
          カード表示
        </Button>
        <Button aria-pressed={view === "list"} onClick={() => setView("list")}>
          リスト表示
        </Button>
      </div>
      {!kits.length ? (
        <Empty>
          まだキットがありません。「キット登録」から塗装計画を始めましょう。
        </Empty>
      ) : (
        <div className={`kit-grid ${view}`}>
          {kits.map((kit) => (
            <article className="kit-card" key={kit.id}>
              <KitImage path={kit.imagePath} name={kit.name} />
              <div className="kit-card-body">
                <span className="eyebrow">{kit.series || "KIT"}</span>
                <h2>{kit.name}</h2>
                <p className="muted">更新日 {dateLabel(kit.updatedAt)}</p>
                {kit.status === "deleting" && <Message>削除処理中</Message>}
                <Button onClick={() => navigate(`/kits/${kit.id}`)}>
                  {kit.status === "deleting" ? "削除を再試行" : "詳細を見る →"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
function PaintList({ paints, navigate, online, onNotice, setDirty }) {
  const [search, setSearch] = useState("");
  const [criteria, setCriteria] = useState({
    manufacturer: "",
    color: "",
    type: "",
  });
  const [editing, setEditing] = useState(null);
  const [archived, setArchived] = useState(false);
  const [stock, setStock] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const subset = paints.filter((p) => p.archived === archived);
  const result = subset.filter((p) =>
    matchesPaint(p, { name: search, ...criteria, stock }),
  );
  const toggle = async (p) => {
    if (
      !window.confirm(
        p.archived
          ? `「${p.name}」を台帳に復元しますか？`
          : `「${p.name}」を台帳から削除しますか？既存工程の参照は保持されます。`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await paintRepository.save(
        p.id,
        { ...p, archived: !p.archived },
        p.revision,
      );
      onNotice(
        p.archived ? "塗料を復元しました" : "塗料を台帳から削除しました",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">PAINT LIBRARY</span>
          <h1>
            保有塗料 <span className="count">{subset.length}</span>
          </h1>
          <p className="muted">手元の塗料を、瓶ごとに管理。</p>
        </div>
        <Button tone="primary" onClick={() => navigate("/paints/new")}>
          ＋ 塗料登録
        </Button>
      </div>
      <div className="filters">
        <label className="field">
          <span>塗料検索</span>
          <input
            type="search"
            placeholder="塗料名を検索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {[
          ["manufacturer", "メーカー"],
          ["color", "色"],
          ["type", "種類"],
        ].map(([key, label]) => (
          <label className="field" key={key}>
            <span>{label}</span>
            <select
              aria-label={label}
              value={criteria[key]}
              onChange={(e) =>
                setCriteria({ ...criteria, [key]: e.target.value })
              }
            >
              <option value="">すべて</option>
              {[...new Set(subset.map((p) => p[key]).filter(Boolean))]
                .sort()
                .map((value) => (
                  <option key={value}>{value}</option>
                ))}
            </select>
          </label>
        ))}
        <label className="field">
          <span>在庫</span>
          <select
            aria-label="在庫"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          >
            <option value="all">すべて</option>
            <option value="yes">在庫あり</option>
            <option value="no">在庫なし</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />
          削除済みを表示
        </label>
      </div>
      <Message error>{error}</Message>
      {!result.length && (
        <Empty>
          {!subset.length
            ? archived
              ? "削除済みの塗料はありません。"
              : "保有塗料を登録して、塗装工程で選択できるようにしましょう。"
            : "検索条件に一致する塗料はありません。"}
        </Empty>
      )}
      <div className="paint-grid">
        {result.map((p) => (
          <article className="panel" key={p.id}>
            <span className="eyebrow">{p.manufacturer}</span>
            <h2>{p.name}</h2>
            <div className="chips">
              <span className="chip">{p.color}</span>
              {p.type && <span className="chip">{p.type}</span>}
              <span className={`badge ${hasStock(p) ? "" : "neutral"}`}>
                {hasStock(p) ? "在庫あり" : "在庫なし"}
              </span>
            </div>
            <div className="inventory">
              <strong>原液 {p.bottles.length}本</strong>
              <strong>希釈済み {p.dilutedBottleCount}本</strong>
            </div>
            {p.bottles.map((b) => (
              <div className="bottle" key={b.id}>
                <span>{b.label}</span>
                <span>
                  {b.remainingPercent === null
                    ? "残量未設定"
                    : `残量 ${b.remainingPercent}%`}
                </span>
                {b.remainingPercent !== null && (
                  <meter
                    aria-label={`${b.label}の残量`}
                    min={0}
                    max={100}
                    value={b.remainingPercent}
                  />
                )}
              </div>
            ))}
            <p className="pre">{p.memo}</p>
            <div className="actions">
              <Button
                disabled={busy || !online}
                onClick={() => setEditing(clone(p))}
              >
                編集
              </Button>
              <Button
                disabled={busy || !online}
                tone={p.archived ? "" : "danger"}
                onClick={() => toggle(p)}
              >
                {p.archived ? "復元" : "台帳から削除"}
              </Button>
            </div>
          </article>
        ))}
      </div>
      {editing && (
        <PaintModal
          paint={editing}
          paints={paints}
          onClose={() => setEditing(null)}
          setDirty={setDirty}
          online={online}
          onNotice={onNotice}
        />
      )}
    </>
  );
}

function PaintModal({ paint, paints, onClose, setDirty, online, onNotice }) {
  const [draft, setDraft] = useState(() => clone(paint));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(paint);
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await paintRepository.save(paint.id, draft, paint.revision);
      onNotice("塗料を保存しました");
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="保有塗料 編集" onClose={onClose} busy={busy} dirty={dirty}>
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <PaintFields draft={draft} setDraft={setDraft} paints={paints} />
        </fieldset>
        <Message error>{error}</Message>
        <div className="actions">
          <Button
            disabled={busy}
            onClick={() => {
              if (!dirty || window.confirm("未保存の入力を破棄しますか？"))
                onClose();
            }}
          >
            キャンセル
          </Button>
          <Button type="submit" tone="primary" disabled={busy || !online}>
            {busy ? "保存中…" : "保存"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
