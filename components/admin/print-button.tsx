"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPrint } from "@fortawesome/free-solid-svg-icons";
import type { DocumentLanguage } from "@/lib/i18n/document-language";

export function PrintButton({language="th"}:{language?:DocumentLanguage}) {
  const changeLanguage=(next:DocumentLanguage)=>{
    const url=new URL(window.location.href);
    url.searchParams.set("lang",next);
    window.location.assign(url.toString());
  };
  return <div className="print-toolbar-actions no-print">
    <div className="print-document-language" role="group" aria-label="Document language">
      <button type="button" className={language==="th"?"active":""} onClick={()=>changeLanguage("th")}>ไทย</button>
      <button type="button" className={language==="en"?"active":""} onClick={()=>changeLanguage("en")}>English</button>
    </div>
    <button className="button primary" onClick={()=>window.print()}><FontAwesomeIcon icon={faPrint}/> {language==="en"?"Print document":"พิมพ์เอกสาร"}</button>
  </div>;
}
