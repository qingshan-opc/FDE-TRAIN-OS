import { Link } from "react-router-dom";
import type { ChainPublicInfo } from "../lib/types";

export function ChainPublicInfoReadonly({
  chainPublic,
  certId,
  dbCourseTitle,
  dbIssuedAt,
}: {
  chainPublic: ChainPublicInfo;
  certId?: string;
  dbCourseTitle?: string | null;
  dbIssuedAt?: string | null;
}) {
  const chainName = chainPublic.holder_name?.trim() || "";
  const chainHash = chainPublic.id_number_sha256?.trim() || "";

  return (
    <div className="chain-public-readonly">
      <dl className="chain-verify-fields">
        <div className="chain-verify-field">
          <dt>持证人姓名</dt>
          <dd>
            <strong>{chainName || "—"}</strong>
          </dd>
        </div>
        <div className="chain-verify-field">
          <dt>课程</dt>
          <dd>{chainPublic.course_title || dbCourseTitle || "—"}</dd>
        </div>
        <div className="chain-verify-field">
          <dt>颁发时间</dt>
          <dd>
            {chainPublic.issued_at
              ? new Date(chainPublic.issued_at).toLocaleString()
              : dbIssuedAt
                ? new Date(dbIssuedAt).toLocaleString()
                : "—"}
          </dd>
        </div>
        <div className="chain-verify-field chain-verify-field--hash">
          <dt>身份证 SHA256</dt>
          <dd>
            <p className="mono chain-hash-full">{chainHash || "—"}</p>
            <p className="muted chain-verify-algo">
              算法：{chainPublic.id_hash_algorithm || "SHA-256"} · 规范化：
              {chainPublic.id_hash_normalization || "去除首尾空格、去除内部空格、字母大写"}
              {" · "}
              <Link to="/chain/algorithms">算法说明</Link>
            </p>
          </dd>
        </div>
      </dl>
      {(chainPublic.block_height != null || chainPublic.tx_hash || certId) && (
        <div className="chain-public-verify__links">
          {chainPublic.block_height != null && (
            <Link to={`/chain/block/${chainPublic.block_height}`}>区块 #{chainPublic.block_height}</Link>
          )}
          {chainPublic.tx_hash && (
            <Link to={`/chain/tx/${chainPublic.tx_hash}`} className="mono">
              交易 {chainPublic.tx_hash.slice(0, 16)}…
            </Link>
          )}
          {certId && <Link to={`/chain/cert/${encodeURIComponent(certId)}`}>证书链记录</Link>}
        </div>
      )}
    </div>
  );
}
