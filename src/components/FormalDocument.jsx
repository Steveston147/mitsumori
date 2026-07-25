import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { yen } from "../lib/format.js";

const STORAGE_KEY = "mitsumori.formalDocument";
const PROGRAM_INFO_KEY = "mitsumori.programBasicInfo";
const SERVICE_FEE = 5000;

const BANK_DEFAULT_REMARKS =
  "Please transfer the total amount to the above bank account by the payment due date. Kindly ensure that all bank charges are borne by the remitter and that the program title is clearly indicated in the payment purpose.";
const CONVERA_DEFAULT_REMARKS =
  "Payment will be made through Convera. Please access the payment URL below to complete the payment.";

const DEFAULT_FORM = {
  documentType: "QUOTATION",
  documentNumber: "",
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  programFee: "",
  paymentMethod: "pending",
  bankDetails: "",
  converaUrl: "",
  bankRemarks: BANK_DEFAULT_REMARKS,
  converaRemarks: CONVERA_DEFAULT_REMARKS,
};

function loadJson(key, fallback) {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? { ...fallback, ...JSON.parse(saved) } : fallback;
  } catch {
    return fallback;
  }
}

function parseYen(text) {
  if (!text || text.trim() === "-") return null;
  const value = Number(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(value) ? value : null;
}

function isVisible(element) {
  return Boolean(element) && !element.closest("[hidden]");
}

function readCalculatedProgramFee() {
  const activeMode = document.querySelector('.mode-tab[aria-pressed="true"]')?.textContent.trim();
  if (activeMode === "積み上げ方式") {
    const value = document.querySelector("[data-build-up-summary] .visit-card-header strong");
    const parsed = parseYen(value?.textContent ?? "");
    if (parsed !== null) return parsed;
  }

  const titles = Array.from(document.querySelectorAll(".kpi .title"));
  const totalTitle = titles.find(
    (element) => element.textContent.trim() === "全体合計（人数分）" && isVisible(element)
  );
  const parsed = parseYen(totalTitle?.parentElement?.querySelector(".value")?.textContent ?? "");
  if (parsed !== null) return parsed;

  const fallback = document.querySelector("[data-build-up-summary] .visit-card-header strong");
  return parseYen(fallback?.textContent ?? "");
}

function formatEnglishDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatProgramPeriod(startDate, endDate) {
  if (!startDate && !endDate) return "";
  if (!startDate || !endDate) return formatEnglishDate(startDate || endDate);
  return `${formatEnglishDate(startDate)} – ${formatEnglishDate(endDate)}`;
}

function parseBankRows(text, programName) {
  const aliases = {
    "bank name": "Bank Name",
    "branch name": "Branch Name",
    branch: "Branch Name",
    "account type": "Account Type",
    "account number": "Account Number",
    "account name": "Account Name",
    "swift code": "SWIFT Code",
    "swift/bic": "SWIFT Code",
    purpose: "Purpose",
  };

  const rows = [];
  String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(/^([^:：]+)\s*[:：]\s*(.+)$/);
      if (!match) return;
      const rawLabel = match[1].trim();
      const label = aliases[rawLabel.toLowerCase()] || rawLabel;
      rows.push([label, match[2].trim()]);
    });

  if (!rows.some(([label]) => label === "Purpose")) {
    rows.push(["Purpose", programName || "—"]);
  }
  return rows;
}

function Seal() {
  return (
    <div className="formal-seal" aria-label="Ritsumeikan University seal">
      <span>立</span><span>命</span><span>館</span>
      <span>大</span><span>学</span><span>国</span>
      <span>際</span><span>部</span><span>印</span>
    </div>
  );
}

function FormalDocumentForm() {
  const [form, setForm] = useState(() => loadJson(STORAGE_KEY, DEFAULT_FORM));
  const [programInfo, setProgramInfo] = useState(() => loadJson(PROGRAM_INFO_KEY, {}));

  const programFee = Math.max(0, Number(form.programFee) || 0);
  const totalAmount = programFee + SERVICE_FEE;
  const isInvoice = form.documentType === "INVOICE";
  const paymentReady = !isInvoice
    || (form.paymentMethod === "bank" && form.bankDetails.trim())
    || (form.paymentMethod === "convera" && form.converaUrl.trim());
  const documentReady = Boolean(
    form.documentNumber.trim()
      && programInfo.universityName?.trim()
      && programFee > 0
      && paymentReady
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    function refreshProgramInfo(event) {
      setProgramInfo(event?.detail || loadJson(PROGRAM_INFO_KEY, {}));
    }
    window.addEventListener("program-basic-info-change", refreshProgramInfo);
    return () => window.removeEventListener("program-basic-info-change", refreshProgramInfo);
  }, []);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function importProgramFee() {
    const value = readCalculatedProgramFee();
    if (value !== null) update("programFee", String(Math.round(value)));
  }

  function printFormalDocument() {
    document.body.classList.add("formal-document-printing");
    const cleanup = () => {
      document.body.classList.remove("formal-document-printing");
      if (form.paymentMethod === "convera") {
        setForm((current) => ({ ...current, converaUrl: "" }));
      }
    };
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
  }

  const bankRows = parseBankRows(form.bankDetails, programInfo.programName);

  return (
    <>
      <section className="formal-document-panel no-print">
        <div className="formal-panel-heading">
          <div>
            <span className="formal-eyebrow">OFFICIAL DOCUMENT</span>
            <h2>English Quotation / Invoice</h2>
            <p>
              The official PDF shows only Program Fee, Service Fee, and Total Amount.
              Internal costs, allocations, and profit figures are excluded.
            </p>
          </div>
          <div className="formal-total-preview">
            <span>Total Amount</span>
            <strong>{yen(Math.round(totalAmount))}</strong>
          </div>
        </div>

        <div className="formal-document-grid">
          <div className="formal-field">
            <label>Document Type</label>
            <select value={form.documentType} onChange={(e) => update("documentType", e.target.value)}>
              <option value="QUOTATION">QUOTATION</option>
              <option value="INVOICE">INVOICE</option>
            </select>
          </div>
          <div className="formal-field formal-field-wide">
            <label>公文書番号 / Document No.</label>
            <input value={form.documentNumber} onChange={(e) => update("documentNumber", e.target.value)} />
          </div>
          <div className="formal-field">
            <label>Issue Date</label>
            <input type="date" value={form.issueDate} onChange={(e) => update("issueDate", e.target.value)} />
          </div>
          {isInvoice && (
            <div className="formal-field">
              <label>Payment Due Date</label>
              <input type="date" min={form.issueDate || undefined} value={form.dueDate} onChange={(e) => update("dueDate", e.target.value)} />
            </div>
          )}
          <div className="formal-field formal-field-wide">
            <label>Recipient Organization</label>
            <input value={programInfo.universityName || ""} readOnly />
          </div>
          <div className="formal-field formal-field-wide">
            <label>Program Fee</label>
            <div className="formal-program-fee-row">
              <input type="number" min="0" step="1000" value={form.programFee} onChange={(e) => update("programFee", e.target.value)} />
              <button className="btn secondary" type="button" onClick={importProgramFee}>Import Current Estimate</button>
            </div>
          </div>
          <div className="formal-field">
            <label>Service Fee</label>
            <input value="JPY 5,000" readOnly />
          </div>
        </div>

        {isInvoice && (
          <div className="formal-payment-editor">
            <div className="formal-payment-title">
              <div><span className="formal-eyebrow">INVOICE ONLY</span><h3>Payment Information</h3></div>
            </div>
            <div className="formal-document-grid">
              <div className="formal-field">
                <label>Payment Method</label>
                <select value={form.paymentMethod} onChange={(e) => update("paymentMethod", e.target.value)}>
                  <option value="pending">Not selected</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="convera">Convera</option>
                </select>
              </div>
              <div className="formal-field formal-field-full">
                <label>Bank Account Information</label>
                <textarea value={form.bankDetails} onChange={(e) => update("bankDetails", e.target.value)} placeholder="Bank Name: ...\nBranch Name: ...\nAccount Type: ...\nAccount Number: ...\nAccount Name: ...\nSWIFT Code: ..." />
              </div>
              <div className="formal-field formal-field-full">
                <label>Convera Payment URL</label>
                <input type="url" value={form.converaUrl} onChange={(e) => update("converaUrl", e.target.value)} autoComplete="off" />
              </div>
              <div className="formal-field formal-field-full">
                <label>Remarks for Bank Transfer</label>
                <textarea value={form.bankRemarks} onChange={(e) => update("bankRemarks", e.target.value)} />
              </div>
              <div className="formal-field formal-field-full">
                <label>Remarks for Convera</label>
                <textarea value={form.converaRemarks} onChange={(e) => update("converaRemarks", e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {!documentReady && (
          <div className="formal-validation-note">
            Enter the document number, recipient organization, and Program Fee. For an invoice, also select and complete a payment method.
          </div>
        )}

        <button className="btn formal-print-button" type="button" disabled={!documentReady} onClick={printFormalDocument}>
          Create {form.documentType} PDF
        </button>
      </section>

      <article className={`print-summary formal-document-sheet ${isInvoice ? "is-invoice" : "is-quotation"}`} aria-hidden="true">
        <header className="formal-letterhead">
          <div>
            <div className="formal-brand-name">RITSUMEIKAN UNIVERSITY</div>
            <div className="formal-brand-unit">International Center</div>
          </div>
          <div className="formal-document-meta">
            <div><span>Document No.</span><strong>{form.documentNumber}</strong></div>
            <div><span>Issue Date</span><strong>{formatEnglishDate(form.issueDate)}</strong></div>
            {isInvoice && form.dueDate && <div><span>Payment Due Date</span><strong>{formatEnglishDate(form.dueDate)}</strong></div>}
          </div>
        </header>

        <div className="formal-title-row"><span /><h1>{form.documentType}</h1><span /></div>

        <section className="formal-recipient">
          <span>To:</span>
          <strong>{programInfo.universityName || "—"}</strong>
        </section>

        <section className="formal-program-summary">
          <div><span>Program Title</span><b>:</b><strong>{programInfo.programName || "—"}</strong></div>
          <div><span>Program Period</span><b>:</b><strong>{formatProgramPeriod(programInfo.startDate, programInfo.endDate) || "—"}</strong></div>
          <div><span>Number of Students</span><b>:</b><strong>{programInfo.studentCount || "—"}</strong></div>
          <div><span>Number of Faculty/Staff</span><b>:</b><strong>{programInfo.escortCount || "0"}</strong></div>
          <div><span>Host Campus</span><b>:</b><strong>{programInfo.campus || "—"}</strong></div>
          <div><span>Accommodation</span><b>:</b><strong>{programInfo.accommodationName || "—"}</strong></div>
        </section>

        <table className="formal-amount-table">
          <thead><tr><th>Description</th><th>Amount (JPY)</th></tr></thead>
          <tbody>
            <tr><td>Program Fee</td><td>{yen(Math.round(programFee))}</td></tr>
            <tr><td>Service Fee</td><td>{yen(SERVICE_FEE)}</td></tr>
            <tr className="formal-grand-total"><td>Total Amount</td><td>{yen(Math.round(totalAmount))}</td></tr>
          </tbody>
        </table>

        {isInvoice && (
          <section className="formal-invoice-lower-grid">
            <div className="formal-payment-block">
              <h3>PAYMENT INSTRUCTIONS</h3>
              <h4>■&nbsp; Bank Transfer</h4>
              <div className="formal-bank-rows">
                {bankRows.map(([label, value]) => <div key={`${label}-${value}`}><span>{label}</span><b>:</b><strong>{value}</strong></div>)}
              </div>
              <p className="formal-charge-note">All bank transfer charges shall be borne by the remitter.</p>
            </div>
            <div className="formal-remarks-block">
              <h3>REMARKS</h3>
              <h4>■&nbsp; For Bank Transfer</h4>
              <p>{form.bankRemarks || BANK_DEFAULT_REMARKS}</p>
              <hr />
              <h4>■&nbsp; For Convera Payment</h4>
              <p>{form.converaRemarks || CONVERA_DEFAULT_REMARKS}</p>
              <a href={form.converaUrl || "#"}>{form.converaUrl || "—"}</a>
              <p>If the above link does not work,<br />please contact us for a new payment link.</p>
            </div>
          </section>
        )}

        <section className="formal-notes">
          <strong>Notes:</strong>
          <ol>
            <li>This invoice is issued based on the program details above.</li>
            <li>The program will be confirmed only after the agreement is executed and full payment is received.</li>
            <li>Accommodation, airfare, meals, and local transportation are not included unless otherwise stated.</li>
            <li>Any bank transfer fees shall be borne by the remitting institution.</li>
          </ol>
        </section>

        <footer className="formal-issuer-area">
          <div className="formal-issuer">
            <div>Issued by:</div>
            <strong>Ritsumeikan University</strong>
            <div>International Center</div>
            <div>56-1 Toji-in Kitamachi, Kita-ku</div>
            <div>Kyoto 603-8577, Japan</div>
            <div>TEL: +81-75-465-3009&nbsp;&nbsp;&nbsp; Email: <span>rsjprwjp@st.ritsumei.ac.jp</span></div>
          </div>
          {isInvoice && <Seal />}
        </footer>
      </article>
    </>
  );
}

export default function FormalDocument() {
  const [target, setTarget] = useState(null);
  useEffect(() => {
    const container = document.querySelector(".container");
    if (!container) return;
    const mount = document.createElement("div");
    mount.setAttribute("data-formal-document-mount", "");
    container.appendChild(mount);
    setTarget(mount);
    return () => mount.remove();
  }, []);
  return target ? createPortal(<FormalDocumentForm />, target) : null;
}
