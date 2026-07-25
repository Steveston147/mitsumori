import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { yen } from "../lib/format.js";

const FORM_KEY = "mitsumori.formalDocument";
const PROGRAM_KEY = "mitsumori.programBasicInfo";
const SERVICE_FEE = 5000;

const DEFAULT_FORM = {
  documentType: "QUOTATION",
  documentNumber: "",
  issueDate: "",
  dueDate: "",
  programFee: "",
  bankDetails: "",
  converaUrl: "",
  bankRemarks: "",
  converaRemarks: "",
};

function readJson(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? { ...fallback, ...JSON.parse(value) } : fallback;
  } catch {
    return fallback;
  }
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatPeriod(startDate, endDate) {
  if (!startDate && !endDate) return "—";
  if (!startDate || !endDate) return formatDate(startDate || endDate);
  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function parseBankDetails(text, programName) {
  const labels = [
    ["Bank Name", ["bank name"]],
    ["Branch Name", ["branch name", "branch"]],
    ["Account Type", ["account type"]],
    ["Account Number", ["account number"]],
    ["Account Name", ["account name"]],
    ["SWIFT Code", ["swift code", "swift/bic", "swift"]],
  ];
  const values = new Map();

  String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(/^([^:：]+)\s*[:：]\s*(.*)$/);
      if (!match) return;
      values.set(match[1].trim().toLowerCase(), match[2].trim());
    });

  const rows = labels.map(([label, aliases]) => {
    const value = aliases.map((alias) => values.get(alias)).find(Boolean) || "—";
    return [label, value];
  });
  rows.push(["Purpose", programName || "—"]);
  return rows;
}

function Seal() {
  return (
    <div className="pro-seal" aria-label="Ritsumeikan University seal">
      <span>立</span><span>命</span><span>館</span>
      <span>大</span><span>学</span><span>国</span>
      <span>際</span><span>部</span><span>印</span>
    </div>
  );
}

function ProfessionalDocumentSheet({ form, program }) {
  const isInvoice = form.documentType === "INVOICE";
  const programFee = Math.max(0, Number(form.programFee) || 0);
  const totalAmount = programFee + SERVICE_FEE;
  const bankRows = useMemo(
    () => parseBankDetails(form.bankDetails, program.programName),
    [form.bankDetails, program.programName]
  );

  const bankRemarks = form.bankRemarks
    || "Please transfer the total amount to the bank account shown, by the payment due date. Kindly ensure that all bank charges are borne by the remitter and that the program title is clearly stated in the payment purpose.";
  const converaRemarks = form.converaRemarks
    || "Payment may also be made through Convera. Please use the payment link below to complete the payment.";

  return (
    <article className={`pro-document-sheet ${isInvoice ? "pro-invoice" : "pro-quotation"}`} aria-hidden="true">
      <header className="pro-header">
        <div className="pro-brand">
          <div>RITSUMEIKAN UNIVERSITY</div>
          <span>International Center</span>
        </div>
        <dl className="pro-meta">
          <div><dt>Document No.</dt><dd>{form.documentNumber || "—"}</dd></div>
          <div><dt>Issue Date</dt><dd>{formatDate(form.issueDate)}</dd></div>
          {isInvoice && <div><dt>Payment Due Date</dt><dd>{formatDate(form.dueDate)}</dd></div>}
        </dl>
      </header>

      <div className="pro-title-row"><span /><h1>{form.documentType}</h1><span /></div>

      <section className="pro-recipient">
        <span>To:</span>
        <strong>{program.universityName || "—"}</strong>
      </section>

      <section className="pro-program-details">
        <div><span>Program Title</span><b>:</b><strong>{program.programName || "—"}</strong></div>
        <div><span>Program Period</span><b>:</b><strong>{formatPeriod(program.startDate, program.endDate)}</strong></div>
        <div><span>Number of Students</span><b>:</b><strong>{program.studentCount || "—"}</strong></div>
        <div><span>Number of Faculty/Staff</span><b>:</b><strong>{program.escortCount || "0"}</strong></div>
        <div><span>Host Campus</span><b>:</b><strong>{program.campus || "—"}</strong></div>
        <div><span>Accommodation</span><b>:</b><strong>{program.accommodationName || "—"}</strong></div>
      </section>

      <table className="pro-amount-table">
        <thead><tr><th>Description</th><th>Amount (JPY)</th></tr></thead>
        <tbody>
          <tr><td>Program Fee</td><td>{yen(Math.round(programFee))}</td></tr>
          <tr><td>Service Fee</td><td>{yen(SERVICE_FEE)}</td></tr>
          <tr className="pro-total"><td>Total Amount</td><td>{yen(Math.round(totalAmount))}</td></tr>
        </tbody>
      </table>

      {isInvoice && (
        <section className="pro-payment-grid">
          <div className="pro-payment-column">
            <h2>PAYMENT INSTRUCTIONS</h2>
            <h3>■&nbsp; Bank Transfer</h3>
            <div className="pro-bank-list">
              {bankRows.map(([label, value]) => (
                <div key={label}><span>{label}</span><b>:</b><strong>{value}</strong></div>
              ))}
            </div>
            <p className="pro-charge-note">All bank transfer charges shall be borne by the remitter.</p>
          </div>
          <div className="pro-remarks-column">
            <h2>REMARKS</h2>
            <h3>■&nbsp; For Bank Transfer</h3>
            <p>{bankRemarks}</p>
            <hr />
            <h3>■&nbsp; For Convera Payment</h3>
            <p>{converaRemarks}</p>
            <div className="pro-payment-url">{form.converaUrl || "Payment link will be provided separately."}</div>
            <p>If the payment link does not work, please contact us for a new link.</p>
          </div>
        </section>
      )}

      <div className="pro-bottom">
        <section className="pro-notes">
          <strong>Notes:</strong>
          <ol>
            <li>This {isInvoice ? "invoice" : "quotation"} is issued based on the program details above.</li>
            <li>The program will be confirmed only after the agreement is executed and full payment is received.</li>
            <li>Accommodation, airfare, meals, and local transportation are not included unless otherwise stated.</li>
            <li>Any bank transfer fees shall be borne by the remitting institution.</li>
          </ol>
        </section>

        <footer className="pro-issued-row">
          <div className="pro-issued-by">
            <div>Issued by:</div>
            <strong>Ritsumeikan University</strong>
            <span>International Center</span>
            <span>56-1 Toji-in Kitamachi, Kita-ku</span>
            <span>Kyoto 603-8577, Japan</span>
            <span>TEL: +81-75-465-3009&nbsp;&nbsp;&nbsp; Email: <em>rsjprwjp@st.ritsumei.ac.jp</em></span>
          </div>
          {isInvoice && <Seal />}
        </footer>
      </div>
    </article>
  );
}

export default function ProfessionalDocumentPrint() {
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState(() => readJson(FORM_KEY, DEFAULT_FORM));
  const [program, setProgram] = useState(() => readJson(PROGRAM_KEY, {}));

  useEffect(() => {
    const mount = document.createElement("div");
    mount.setAttribute("data-professional-print-mount", "");
    document.body.appendChild(mount);
    setTarget(mount);
    return () => mount.remove();
  }, []);

  useEffect(() => {
    const refresh = () => {
      setForm(readJson(FORM_KEY, DEFAULT_FORM));
      setProgram(readJson(PROGRAM_KEY, {}));
    };
    const timer = window.setInterval(refresh, 200);
    window.addEventListener("program-basic-info-change", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("program-basic-info-change", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return target ? createPortal(<ProfessionalDocumentSheet form={form} program={program} />, target) : null;
}
