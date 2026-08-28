import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCode,
  faCopyright,
  faDatabase,
} from "@fortawesome/free-solid-svg-icons";
import { faCloudflare } from "@fortawesome/free-brands-svg-icons";

function NextJsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm4.64 14.88-6.73-8.67v6.93H8.57V7.12h1.58l6.72 8.67V8.86h1.34v8.02h-1.57Z" />
    </svg>
  );
}

function TypeScriptIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="3" />
      <path d="M6.2 8.2h8v2H11v7.6H8.8v-7.6H6.2v-2Zm8.3 8.5 1.1-1.6c.8.6 1.6.9 2.5.9.7 0 1.1-.3 1.1-.7 0-.5-.4-.7-1.7-1-1.8-.5-2.8-1.2-2.8-2.9 0-1.6 1.3-2.7 3.2-2.7 1.3 0 2.3.4 3.2 1.1L20 11.3c-.7-.5-1.5-.8-2.2-.8-.6 0-1 .3-1 .7 0 .5.4.7 1.8 1.1 1.8.5 2.7 1.3 2.7 2.8 0 1.8-1.4 2.8-3.3 2.8-1.4 0-2.6-.4-3.5-1.2Z" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer no-print">
      <div className="shell site-footer-inner">
        <div className="site-footer-developer">
          <span className="site-footer-code" aria-hidden="true"><FontAwesomeIcon icon={faCode} /></span>
          <span><b>Chonnatee Boonta</b></span>
        </div>
        <p className="site-footer-copyright">
          <FontAwesomeIcon icon={faCopyright} />
          <span>{new Date().getFullYear()} โรงเรียนจอมทอง · สงวนลิขสิทธิ์</span>
        </p>
        <div className="site-footer-tech" aria-label="เทคโนโลยีที่ใช้พัฒนาระบบ">
          <small>Powered by</small>
          <span title="Next.js" aria-label="Next.js"><NextJsIcon /></span>
          <span className="cloudflare" title="Cloudflare Workers" aria-label="Cloudflare Workers"><FontAwesomeIcon icon={faCloudflare} /></span>
          <span className="typescript" title="TypeScript" aria-label="TypeScript"><TypeScriptIcon /></span>
          <span className="database d1-icon" title="Cloudflare D1" aria-label="Cloudflare D1"><FontAwesomeIcon className="d1-cloud" icon={faCloudflare} /><FontAwesomeIcon className="d1-database" icon={faDatabase} /></span>
        </div>
      </div>
    </footer>
  );
}
