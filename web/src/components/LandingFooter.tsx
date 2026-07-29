import { Link } from "react-router-dom";
import {
  ABOUT_PATH,
  LANDING_FOOTER_BUSINESS_EMAIL,
  LANDING_FOOTER_COMPANY,
  LANDING_FOOTER_OFFICE,
  LANDING_FOOTER_TAGLINE,
  LANDING_FOOTER_TRAINING_EMAIL,
  OPEN_COURSES_PATH,
  VERIFY_PATH,
} from "../app/landingShared";

export function LandingFooter({
  brandName = "青山在",
  appHref = "/app/courses",
  contactEmail = LANDING_FOOTER_TRAINING_EMAIL,
  footerText,
}: {
  brandName?: string;
  appHref?: string;
  contactEmail?: string;
  /** 站点信息里配置的页脚文案；缺省则用品牌名 + 年份 */
  footerText?: string | null;
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="landing-site-footer" aria-label="页脚">
      <div className="landing-site-footer__inner">
        <div className="landing-site-footer__grid">
          <div className="landing-site-footer__col">
            <h3 className="landing-site-footer__heading">产品</h3>
            <ul className="landing-site-footer__links">
              <li>
                <Link to={appHref}>{brandName} · 学习平台</Link>
              </li>
              <li>
                <Link to="/#enterprise">企业培训</Link>
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

          <div className="landing-site-footer__col">
            <h3 className="landing-site-footer__heading">公司</h3>
            <ul className="landing-site-footer__links">
              <li>
                <Link to={ABOUT_PATH}>关于我们</Link>
              </li>
              <li>
                <Link to="/#enterprise">企业与机构培训</Link>
              </li>
              <li>
                <Link to="/#partners">合作伙伴</Link>
              </li>
            </ul>
          </div>

          <div className="landing-site-footer__col">
            <h3 className="landing-site-footer__heading">支持</h3>
            <ul className="landing-site-footer__links">
              <li>
                <a href={`mailto:${contactEmail}`}>培训咨询</a>
              </li>
              <li>
                <a href={`mailto:${LANDING_FOOTER_BUSINESS_EMAIL}?subject=${encodeURIComponent("商务合作")}`}>
                  商务合作
                </a>
              </li>
              <li>
                <a href={`mailto:${LANDING_FOOTER_BUSINESS_EMAIL}?subject=${encodeURIComponent("私有化部署")}`}>
                  私有化部署
                </a>
              </li>
            </ul>
          </div>

          <div className="landing-site-footer__col">
            <h3 className="landing-site-footer__heading">联系</h3>
            <ul className="landing-site-footer__links">
              <li>
                <a href={`mailto:${LANDING_FOOTER_BUSINESS_EMAIL}`}>{LANDING_FOOTER_BUSINESS_EMAIL}</a>
              </li>
              <li>
                <a href={`mailto:${contactEmail}?subject=${encodeURIComponent("留言咨询")}`}>留言咨询</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="landing-site-footer__meta">
          <p>
            <span className="landing-site-footer__meta-label">邮箱</span>
            <a href={`mailto:${LANDING_FOOTER_BUSINESS_EMAIL}`}>{LANDING_FOOTER_BUSINESS_EMAIL}</a>
          </p>
          <p>{LANDING_FOOTER_OFFICE}</p>
        </div>

        <div className="landing-site-footer__bottom">
          <p className="landing-site-footer__quick">
            <Link to={appHref}>进入学习</Link>
            <span aria-hidden="true">·</span>
            <Link to="/#enterprise">企业培训</Link>
            <span aria-hidden="true">·</span>
            <Link to={OPEN_COURSES_PATH}>公开课</Link>
            <span aria-hidden="true">·</span>
            <Link to={VERIFY_PATH}>证书核验</Link>
            <span aria-hidden="true">·</span>
            <a href={`mailto:${LANDING_FOOTER_BUSINESS_EMAIL}?subject=${encodeURIComponent("商务合作")}`}>商务合作</a>
          </p>
          <p className="landing-site-footer__copy">
            {footerText?.trim()
              ? footerText
              : `© 2024-${year} ${LANDING_FOOTER_COMPANY} 版权所有`}
          </p>
          <p className="landing-site-footer__tagline">{LANDING_FOOTER_TAGLINE}</p>
        </div>
      </div>
    </footer>
  );
}
