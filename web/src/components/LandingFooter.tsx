import { Link } from "react-router-dom";
import {
  ABOUT_PATH,
  ENTERPRISE_PATH,
  LANDING_FOOTER_BUSINESS_EMAIL,
  LANDING_FOOTER_COMPANY,
  LANDING_FOOTER_OFFICE,
  LANDING_FOOTER_TAGLINE,
  OPEN_COURSES_PATH,
  VERIFY_PATH,
} from "../app/landingShared";

export function LandingFooter({
  brandName = "青山在",
  appHref = "/app/courses",
  footerText,
}: {
  brandName?: string;
  appHref?: string;
  /** 站点信息里配置的页脚文案；缺省则用品牌名 + 年份 */
  footerText?: string | null;
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="ink-footer" aria-label="页脚">
      <div className="ink-wrap">
        <div className="ink-foot-grid">
          <div className="ink-foot-brand">
            <div className="ink-logo-name">{brandName}</div>
            <p>
              专注于培养前沿部署工程师人才，打通AI与业务的最后一公里。
            </p>
          </div>

          <div>
            <h4>产品</h4>
            <ul>
              <li>
                <Link to="/">首页</Link>
              </li>
              <li>
                <Link to={ENTERPRISE_PATH}>企业培训</Link>
              </li>
              <li>
                <Link to={OPEN_COURSES_PATH}>公开课</Link>
              </li>
              <li>
                <Link to={VERIFY_PATH}>证书核验</Link>
              </li>
              <li>
                <Link to={appHref}>进入学习</Link>
              </li>
            </ul>
          </div>

          <div>
            <h4>公司</h4>
            <ul>
              <li>
                <Link to={ABOUT_PATH}>关于我们</Link>
              </li>
              <li>
                <Link to={ENTERPRISE_PATH}>企业与机构培训</Link>
              </li>
              <li>
                <a href={`mailto:${LANDING_FOOTER_BUSINESS_EMAIL}?subject=${encodeURIComponent("商务合作")}`}>
                  商务合作
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4>联系</h4>
            <ul>
              <li>
                <a href={`mailto:${LANDING_FOOTER_BUSINESS_EMAIL}`}>{LANDING_FOOTER_BUSINESS_EMAIL}</a>
              </li>
              <li>
                <a href={`mailto:${LANDING_FOOTER_BUSINESS_EMAIL}?subject=${encodeURIComponent("培训咨询")}`}>
                  培训咨询
                </a>
              </li>
              <li>{LANDING_FOOTER_OFFICE}</li>
            </ul>
          </div>
        </div>

        <div className="ink-foot-bottom">
          <span>
            {footerText?.trim()
              ? footerText
              : `© 2024-${year} ${LANDING_FOOTER_COMPANY} 版权所有`}
          </span>
          <span className="ink-tagline">{LANDING_FOOTER_TAGLINE}</span>
        </div>
      </div>
    </footer>
  );
}
