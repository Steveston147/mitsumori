import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { yen } from "../lib/format.js";

const STORAGE_KEY = "mitsumori.formalDocument";
const PROGRAM_INFO_KEY = "mitsumori.programBasicInfo";
const SERVICE_FEE = 5000;

const BANK_DEFAULT_REMARKS =
  "TEST VERSION — The official bank transfer remarks will be inserted after internal confirmation.";
const CONVERA_DEFAULT_REMARKS =
  "Please use the Convera payment link shown on this invoice. The payment link is issued specifically for this invoice.";

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

  const buildUpFallback = document.querySelector("[data-build-up-summary] .visit-card-header strong");
  return parseYen(buildUpFallback?.textContent ?? "");
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

function FormalDocumentForm() {
  const [form, setForm] = useState(() => loadJson(STORAGE_KEY, DEFAULT_FORM));
  const [programInfo, setProgramInfo] = useState(() => loadJson(PROGRAM_INFO_KEY, {}));

  const programFee = Math.max(0, Number(form.programFee) || 0);
  const totalAmount = programFee + SERVICE_FEE;
  const isInvoice = form.documentType === "INVOICE";
  const isBank = isInvoice && form.paymentMethod === "bank";
  const isConvera = isInvoice && form.paymentMethod === "convera";
  const activeRemarks = isBank ? form.bankRemarks : isConvera ? form.converaRemarks : "";

  const paymentReady = !isInvoice
    || (isBank && form.bankDetails.trim())
    || (isConvera && form.converaUrl.trim());

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
      if (event?.detail) {
        setProgramInfo(event.detail);
      } else {
        setProgramInfo(loadJson(PROGRAM_INFO_KEY, {}));
      }
    }

    window.addEventListener("program-basic-info-change", refreshProgramInfo);
    return () => window.removeEventListener("program-basic-info-change", refreshProgramInfo);
  }, []);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changePaymentMethod(value) {
    setForm((current) => ({
      ...current,
      paymentMethod: value,
      bankRemarks: current.bankRemarks || BANK_DEFAULT_REMARKS,
      converaRemarks: current.converaRemarks || CONVERA_DEFAULT_REMARKS,
      converaUrl: value === "convera" ? "" : current.converaUrl,
    }));
  }

  function updateRemarks(value) {
    update(isBank ? "bankRemarks" : "converaRemarks", value);
  }

  function resetRemarks() {
    update(
      isBank ? "bankRemarks" : "converaRemarks",
      isBank ? BANK_DEFAULT_REMARKS : CONVERA_DEFAULT_REMARKS
    );
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

  const paymentSection = useMemo(() => {
    if (!isInvoice) return null;

    if (isBank) {
      return (
        <section className="formal-payment-block">
          <h3>Payment Instructions</h3>
          <div className="formal-preline">{form.bankDetails}</div>
          <div className="formal-purpose">
            <span>Purpose</span>
            <strong>{programInfo.programName || "—"}</strong>
          </div>
        </section>
      );
    }

    if (isConvera) {
      return (
        <section className="formal-payment-block">
          <h3>Payment via Convera</h3>
          <p>Please complete the payment using the following secure payment link:</p>
          <div className="formal-url">{form.converaUrl}</div>
        </section>
      );
    }

    return null;
  }, [
    form.bankDetails,
    form.converaUrl,
    isBank,
    isConvera,
    isInvoice,
    programInfo.programName,
  ]);

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
            <select
              value={form.documentType}
              onChange={(event) => update("documentType", event.target.value)}
            >
              <option value="QUOTATION">QUOTATION</option>
              <option value="INVOICE">INVOICE</option>
            </select>
          </div>

          <div className="formal-field formal-field-wide">
            <label>公文書番号 / Document No.</label>
            <input
              value={form.documentNumber}
              onChange={(event) => update("documentNumber", event.target.value)}
              placeholder="例：国際課第2027-01号 / RSJP-2027-見積01"
            />
          </div>

          <div className="formal-field">
            <label>Issue Date</label>
            <input
              type="date"
              value={form.issueDate}
              onChange={(event) => update("issueDate", event.target.value)}
            />
          </div>

          {isInvoice && (
            <div className="formal-field">
              <label>Payment Due Date（任意）</label>
              <input
                type="date"
                min={form.issueDate || undefined}
                value={form.dueDate}
                onChange={(event) => update("dueDate", event.target.value)}
              />
            </div>
          )}

          <div className="formal-field formal-field-wide">
            <label>Recipient Organization</label>
            <input value={programInfo.universityName || ""} readOnly />
            <div className="small">The organization name comes from the shared program information.</div>
          </div>

          <div className="formal-field formal-field-wide">
            <label>Program Fee</label>
            <div className="formal-program-fee-row">
              <input
                type="number"
                min="0"
                step="1000"
                value={form.programFee}
                onChange={(event) => update("programFee", event.target.value)}
                placeholder="Final agreed program amount"
              />
              <button className="btn secondary" type="button" onClick={importProgramFee}>
                Import Current Estimate
              </button>
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
              <div>
                <span className="formal-eyebrow">INVOICE ONLY</span>
                <h3>Payment Method</h3>
              </div>
              <div className="small">Select after the client confirms the preferred payment method.</div>
            </div>

            <div className="formal-document-grid">
              <div className="formal-field">
                <label>Payment Method</label>
                <select
                  value={form.paymentMethod}
                  onChange={(event) => changePaymentMethod(event.target.value)}
                >
                  <option value="pending">Not selected</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="convera">Convera</option>
                </select>
              </div>

              {isBank && (
                <>
                  <div className="formal-field formal-field-wide">
                    <label>Purpose（プログラム名称から自動転記）</label>
                    <input value={programInfo.programName || ""} readOnly />
                  </div>
                  <div className="formal-field formal-field-full">
                    <label>Bank Account Information</label>
                    <textarea
                      value={form.bankDetails}
                      onChange={(event) => update("bankDetails", event.target.value)}
                      placeholder="Bank name, branch, account name, account number, SWIFT/BIC, payment reference, and any remittance instructions"
                    />
                  </div>
                </>
              )}

              {isConvera && (
                <div className="formal-field formal-field-full">
                  <label>Convera Payment URL（請求書発行ごとに入力）</label>
                  <input
                    type="url"
                    value={form.converaUrl}
                    onChange={(event) => update("converaUrl", event.target.value)}
                    placeholder="https://..."
                    autoComplete="off"
                  />
                  <div className="small">
                    This URL is cleared after printing so that the next invoice requires a new link.
                  </div>
                </div>
              )}

              {(isBank || isConvera) && (
                <div className="formal-field formal-field-full">
                  <div className="formal-remarks-heading">
                    <label>Remarks</label>
                    <button type="button" className="formal-text-button" onClick={resetRemarks}>
                      固定文言に戻す
                    </button>
                  </div>
                  <textarea
                    value={activeRemarks}
                    onChange={(event) => updateRemarks(event.target.value)}
                    placeholder="Remarks shown on the invoice"
                  />
                  <div className="small">
                    A payment-method-specific standard text is inserted initially. You may add to or revise it before issuing the invoice.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!documentReady && (
          <div className="formal-validation-note">
            Enter the document number, recipient organization, and Program Fee.
            For an invoice, also select and complete a payment method.
          </div>
        )}

        <button
          className="btn formal-print-button"
          type="button"
          disabled={!documentReady}
          onClick={printFormalDocument}
        >
          Create {form.documentType} PDF
        </button>
      </section>

      <article className="print-summary formal-document-sheet" aria-hidden="true">
        <header className="formal-letterhead">
          <div className="formal-letterhead-placeholder">
            <div className="formal-brand-name">RITSUMEIKAN UNIVERSITY</div>
            <div className="formal-brand-unit">International Center</div>
            <div className="formal-letterhead-note">
              Fixed placeholder letterhead — replace with the official PDF letterhead later.
            </div>
          </div>
          <div className="formal-document-meta">
            <div><span>Document No.</span><strong>{form.documentNumber}</strong></div>
            <div><span>Issue Date</span><strong>{formatEnglishDate(form.issueDate)}</strong></div>
            {isInvoice && form.dueDate && (
              <div><span>Payment Due</span><strong>{formatEnglishDate(form.dueDate)}</strong></div>
            )}
          </div>
        </header>

        <h1 className="formal-document-title">{form.documentType}</h1>

        {isInvoice && (
          <div className="formal-seal" aria-label="Temporary test seal">
            <span>TEST</span>
            <strong>RITSUMEIKAN</strong>
          </div>
        )}

        <section className="formal-recipient">
          <span>To:</span>
          <strong>{programInfo.universityName || "—"}</strong>
        </section>

        <section className="formal-program-summary">
          <div>
            <span>Program Title</span>
            <strong>{programInfo.programName || "—"}</strong>
          </div>
          <div>
            <span>Program Period</span>
            <strong>{formatProgramPeriod(programInfo.startDate, programInfo.endDate) || "—"}</strong>
          </div>
          <div>
            <span>Number of Students</span>
            <strong>{programInfo.studentCount ? `${programInfo.studentCount}` : "—"}</strong>
          </div>
        </section>

        <table className="formal-amount-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Program Fee</td>
              <td>{yen(Math.round(programFee))}</td>
            </tr>
            <tr>
              <td>Service Fee</td>
              <td>{yen(SERVICE_FEE)}</td>
            </tr>
            <tr className="formal-grand-total">
              <td>Total Amount</td>
              <td>{yen(Math.round(totalAmount))}</td>
            </tr>
          </tbody>
        </table>

        {isInvoice ? (
          <div className="formal-invoice-lower-grid">
            {paymentSection}
            <section className="formal-remarks-block">
              <h3>Remarks</h3>
              <div className="formal-preline">{activeRemarks || "—"}</div>
            </section>
          </div>
        ) : null}

        <footer className="formal-issuer">
          <div className="formal-issuer-label">Issued by</div>
          <strong>Ritsumeikan University</strong>
          <div>International Center</div>
          <div>56-1 Toji-in Kitamachi, Kita-ku</div>
          <div>Kyoto 603-8577, Japan</div>
          <div className="formal-issuer-email">Email: rsjprwjp@st.ritsumei.ac.jp</div>
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
