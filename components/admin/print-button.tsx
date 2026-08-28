"use client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPrint } from "@fortawesome/free-solid-svg-icons";
export function PrintButton(){return <button className="button primary no-print" onClick={()=>window.print()}><FontAwesomeIcon icon={faPrint}/> พิมพ์เอกสาร</button>}
