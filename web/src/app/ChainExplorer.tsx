import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { chainApi, ApiError } from "../lib/api";
import { LandingTopbar } from "../components/LandingTopbar";
import { LandingFooter } from "../components/LandingFooter";
import { ChainPublicInfoReadonly } from "../components/ChainPublicInfoReadonly";
import { ChainIdVerifyModal } from "../components/ChainIdVerifyModal";
import { Skeleton } from "../components/Skeleton";
import type { ChainPublicInfo } from "../lib/types";
import { FALLBACK_LANDING_TABS, VERIFY_PATH } from "./landingShared";
import type { LandingPayload } from "../lib/types";

const FALLBACK: LandingPayload = {
  title: "青山在",
  tagline: "",
  brand: { name: "青山在" },
  cta: { login: "/login", app: "/app/courses" },
  tabs: FALLBACK_LANDING_TABS,
  hero_video: null,
};

function ChainHome() {
  const nav = useNavigate();
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [blocks, setBlocks] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, b] = await Promise.all([chainApi.stats(), chainApi.blocks(15, 0)]);
        setStats(s);
        setBlocks(b.items || []);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    if (/^\d+$/.test(q)) {
      nav(`/chain/block/${q}`);
      return;
    }
    if (q.startsWith("FDE-")) {
      nav(`/chain/cert/${encodeURIComponent(q)}`);
      return;
    }
    if (q.length === 64 && /^[a-f0-9]+$/i.test(q)) {
      nav(`/chain/tx/${q}`);
      return;
    }
    nav(`/chain/cert/${encodeURIComponent(q)}`);
  };

  if (loading) return <Skeleton rows={10} />;
  if (error) return <p className="verify-result verify-result--error">{error}</p>;

  const integrity = stats?.integrity as { valid?: boolean } | undefined;

  return (
    <>
      <div className="chain-stats-grid">
        <div className="chain-stat-card">
          <span className="muted">网络</span>
          <strong>{String(stats?.network || "FDE-Cert-Chain")}</strong>
        </div>
        <div className="chain-stat-card">
          <span className="muted">区块高度</span>
          <strong>{String(stats?.tip_height ?? "—")}</strong>
        </div>
        <div className="chain-stat-card">
          <span className="muted">交易总数</span>
          <strong>{String(stats?.tx_count ?? "—")}</strong>
        </div>
        <div className="chain-stat-card">
          <span className="muted">链完整性</span>
          <strong className={integrity?.valid ? "chain-ok" : "chain-warn"}>
            {integrity?.valid ? "校验通过" : "待校验"}
          </strong>
        </div>
      </div>

      <form className="chain-search" onSubmit={onSearch}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索：区块高度 · 证书 FDE-… · 64 位交易哈希"
          className="mono chain-search__input"
        />
        <button type="submit" className="app-btn app-btn--primary chain-search__btn">
          搜索
        </button>
      </form>

      <p className="muted chain-algo-note">
        身份证上链：SHA256(去空格并大写后的证件号)。详见{" "}
        <Link to="/chain/algorithms">公开算法</Link>。
      </p>

      <h2 className="chain-section-title">最新区块</h2>
      <div className="chain-table-wrap">
        <table className="chain-table">
          <thead>
            <tr>
              <th className="chain-col-height">高度</th>
              <th className="chain-col-hash">区块哈希</th>
              <th className="chain-col-count">交易</th>
              <th className="chain-col-time">出块时间</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => (
              <tr key={String(b.height)}>
                <td>
                  <Link to={`/chain/block/${b.height}`} className="chain-link-strong">
                    #{String(b.height)}
                  </Link>
                </td>
                <td className="mono chain-hash-cell" title={String(b.block_hash || "")}>
                  <Link to={`/chain/block/${b.height}`}>{String(b.block_hash || "—")}</Link>
                </td>
                <td>{String(b.tx_count ?? 0)}</td>
                <td className="chain-time-cell">{b.mined_at ? new Date(String(b.mined_at)).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ChainBlockDetail() {
  const { height } = useParams();
  const [block, setBlock] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!height) return;
    (async () => {
      try {
        const res = await chainApi.block(Number(height));
        setBlock(res.block);
      } finally {
        setLoading(false);
      }
    })();
  }, [height]);

  if (loading) return <Skeleton rows={8} />;
  if (!block) return <p>区块不存在</p>;
  const txs = (block.transactions as Record<string, unknown>[]) || [];

  return (
    <div className="chain-detail">
      <h2 className="chain-detail__title">区块 #{String(block.height)}</h2>
      <dl className="chain-dl chain-dl--wide">
        <dt>区块哈希</dt>
        <dd className="mono chain-hash-full">{String(block.block_hash)}</dd>
        <dt>前一区块</dt>
        <dd className="mono">
          {Number(block.height) > 0 ? (
            <Link to={`/chain/block/${Number(block.height) - 1}`}>{String(block.prev_hash)}</Link>
          ) : (
            String(block.prev_hash)
          )}
        </dd>
        <dt>Merkle Root</dt>
        <dd className="mono chain-hash-full">{String(block.merkle_root)}</dd>
        <dt>出块时间</dt>
        <dd>{block.mined_at ? new Date(String(block.mined_at)).toLocaleString() : "—"}</dd>
      </dl>
      <h3 className="chain-section-title">交易 ({txs.length})</h3>
      <div className="chain-table-wrap">
        <table className="chain-table">
          <thead>
            <tr>
              <th>交易哈希</th>
              <th>类型</th>
              <th>证书</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((tx) => (
              <tr key={String(tx.tx_hash)}>
                <td className="mono chain-hash-cell">
                  <Link to={`/chain/tx/${tx.tx_hash}`}>{String(tx.tx_hash)}</Link>
                </td>
                <td>{String(tx.tx_type)}</td>
                <td className="mono">{String(tx.cert_id || "—")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChainTxDetail() {
  const { txHash } = useParams();
  const [tx, setTx] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyOpen, setVerifyOpen] = useState(false);

  useEffect(() => {
    if (!txHash) return;
    (async () => {
      try {
        const res = await chainApi.tx(txHash);
        setTx(res.transaction);
      } finally {
        setLoading(false);
      }
    })();
  }, [txHash]);

  if (loading) return <Skeleton rows={8} />;
  if (!tx) return <p>交易不存在</p>;
  const payload = tx.payload as Record<string, unknown> | undefined;
  const chainHash = String(payload?.id_number_sha256 || "").trim();
  const chainPublic: ChainPublicInfo = {
    holder_name: payload?.holder_name as string | null,
    course_title: payload?.course_title as string | null,
    issued_at: payload?.issued_at as string | null,
    id_number_sha256: payload?.id_number_sha256 as string | null,
    id_hash_algorithm: payload?.id_hash_algorithm as string | null,
    id_hash_normalization: payload?.id_hash_normalization as string | null,
    tx_hash: tx.tx_hash as string | null,
    block_height: tx.block_height as number | null,
  };

  return (
    <div className="chain-detail">
      <div className="chain-detail__head-row">
        <h2 className="chain-detail__title">链上证书详情</h2>
        {chainHash ? (
          <button type="button" className="app-btn app-btn--primary app-btn--sm" onClick={() => setVerifyOpen(true)}>
            证书核验
          </button>
        ) : null}
      </div>
      <p className="muted chain-detail__lead">
        <Link to={VERIFY_PATH}>返回证书查询</Link>
        {tx.cert_id ? (
          <>
            {" · "}
            <span className="mono">{String(tx.cert_id)}</span>
          </>
        ) : null}
      </p>
      <dl className="chain-dl chain-dl--wide">
        <dt>交易哈希</dt>
        <dd className="mono chain-hash-full">{String(tx.tx_hash)}</dd>
        <dt>区块</dt>
        <dd>
          <Link to={`/chain/block/${tx.block_height}`}>#{String(tx.block_height)}</Link>
        </dd>
        <dt>类型</dt>
        <dd>{String(tx.tx_type)}</dd>
        <dt>证书编号</dt>
        <dd>
          {tx.cert_id ? (
            <Link to={`/chain/cert/${encodeURIComponent(String(tx.cert_id))}`}>{String(tx.cert_id)}</Link>
          ) : (
            "—"
          )}
        </dd>
      </dl>
      {payload && (
        <>
          <h3 className="chain-section-title">链上公开数据</h3>
          <div className="chain-public-readonly panel">
            <ChainPublicInfoReadonly
              chainPublic={chainPublic}
              certId={tx.cert_id ? String(tx.cert_id) : undefined}
            />
          </div>
        </>
      )}
      {chainHash ? (
        <ChainIdVerifyModal open={verifyOpen} chainHash={chainHash} onClose={() => setVerifyOpen(false)} />
      ) : null}
    </div>
  );
}

function ChainCertDetail() {
  const { certId } = useParams();
  const [txs, setTxs] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!certId) return;
    (async () => {
      try {
        const res = await chainApi.cert(certId);
        setTxs(res.transactions || []);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "未找到");
      } finally {
        setLoading(false);
      }
    })();
  }, [certId]);

  if (loading) return <Skeleton rows={6} />;
  if (error) return <p className="verify-result verify-result--error">{error}</p>;

  return (
    <div className="chain-detail">
      <h2>证书 {certId}</h2>
      <p className="muted">
        <Link to={`${VERIFY_PATH}/${encodeURIComponent(certId || "")}`}>证书查询</Link>
      </p>
      {txs.map((tx) => {
        const p = tx.payload as Record<string, unknown> | undefined;
        return (
          <article key={String(tx.tx_hash)} className="chain-cert-tx panel">
            <p>
              <strong>{String(tx.tx_type)}</strong> · 区块{" "}
              <Link to={`/chain/block/${tx.block_height}`}>#{String(tx.block_height)}</Link>
            </p>
            <p className="mono chain-hash-full">
              <Link to={`/chain/tx/${tx.tx_hash}`}>{String(tx.tx_hash)}</Link>
            </p>
            {p && (
              <dl className="chain-dl">
                <dt>姓名（公开）</dt>
                <dd>{String(p.holder_name || "—")}</dd>
                <dt>课程</dt>
                <dd>{String(p.course_title || "—")}</dd>
                <dt>身份证 SHA256</dt>
                <dd className="mono">{String(p.id_number_sha256 || "—")}</dd>
              </dl>
            )}
          </article>
        );
      })}
    </div>
  );
}

function ChainAlgorithms() {
  const [doc, setDoc] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void chainApi.algorithms().then(setDoc).catch(() => setDoc(null));
  }, []);

  if (!doc) return <Skeleton rows={6} />;

  const steps = (doc.id_hash_steps as string[]) || [];

  return (
    <div className="chain-detail">
      <h2>公开哈希算法</h2>
      <p className="muted">任何人可独立复算并比对链上 id_number_sha256 字段，平台不存储原始身份证号。</p>
      <dl className="chain-dl">
        <dt>网络</dt>
        <dd>{String(doc.network)}</dd>
        <dt>身份证哈希</dt>
        <dd>{String(doc.id_hash_algorithm)}</dd>
        <dt>规范化</dt>
        <dd>{String(doc.id_hash_normalization)}</dd>
      </dl>
      <ol>
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <pre className="chain-code">{JSON.stringify(doc.id_hash_example, null, 2)}</pre>
    </div>
  );
}

export function ChainExplorer() {
  const { height, txHash, certId } = useParams();
  const location = useLocation();
  const pathname = location.pathname.replace(/\/$/, "") || "/";
  const [site] = useState<LandingPayload>(FALLBACK);

  const isAlgorithms = pathname === "/chain/algorithms";
  const isHome = pathname === "/chain";

  let body: React.ReactNode;
  if (txHash) body = <ChainTxDetail />;
  else if (certId) body = <ChainCertDetail />;
  else if (isAlgorithms) body = <ChainAlgorithms />;
  else if (height) body = <ChainBlockDetail />;
  else body = <ChainHome />;

  return (
    <div className="landing landing-page-chain">
      <LandingTopbar
        activeTab="verify"
        headerSolid
        brandName={site.brand?.name || "青山在"}
        loginHref="/login"
        appHref="/app/courses"
        user={null}
        tabs={site.tabs}
      />
      <main className="chain-explorer-main">
        <div className="chain-explorer-shell">
          <header className="chain-explorer-header">
            <div className="chain-explorer-header__text">
              <p className="verify-page-eyebrow">FDE Cert Chain</p>
              <h1>证书链浏览器</h1>
              <p className="muted chain-explorer-lead">
                极简不可篡改账本 · 姓名与证书信息公开 · 身份证 SHA256 公开
              </p>
            </div>
            <nav className="chain-nav" aria-label="链浏览器导航">
              <Link to="/chain" className={isHome ? "is-active" : undefined}>
                最新区块
              </Link>
              <Link to="/chain/algorithms" className={isAlgorithms ? "is-active" : undefined}>
                算法说明
              </Link>
              <Link to={VERIFY_PATH}>证书核验</Link>
            </nav>
          </header>
          <div className="chain-explorer-body panel">{body}</div>
        </div>
      </main>
      <LandingFooter brandName={site.brand?.name || "青山在"} appHref="/app/courses" />
    </div>
  );
}
