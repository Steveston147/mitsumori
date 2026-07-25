import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const FORM_KEY = "mitsumori.formalDocument";

function loadForm() {
  try {
    return JSON.parse(window.localStorage.getItem(FORM_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveForm(next) {
  window.localStorage.setItem(FORM_KEY, JSON.stringify(next));
}

function FormalDocumentTestPanel() {
  const [message, setMessage] = useState("");

  function loadTestBankDetails() {
    const current = loadForm();
    saveForm({
      ...current,
      documentType: "INVOICE",
      documentNumber: current.documentNumber || "TEST-国際部-001",
      paymentMethod: "bank",
      bankDetails:
        "TEST VERSION ONLY — Official bank account information will be inserted after internal confirmation.\nBank Name: [TO BE PROVIDED]\nBranch: [TO BE PROVIDED]\nAccount Name: [TO BE PROVIDED]\nAccount Number: [TO BE PROVIDED]\nSWIFT/BIC: [TO BE PROVIDED]",
    });
    setMessage("テスト用の銀行振込情報を設定しました。画面を再読み込みします。");
    window.setTimeout(() => window.location.reload(), 500);
  }

  function loadTestConveraDetails() {
    const current = loadForm();
    saveForm({
      ...current,
      documentType: "INVOICE",
      documentNumber: current.documentNumber || "TEST-国際部-001",
      paymentMethod: "convera",
      converaUrl: "https://example.invalid/convera-payment-link-to-be-provided",
    });
    setMessage("テスト用のConvera URLを設定しました。画面を再読み込みします。");
    window.setTimeout(() => window.location.reload(), 500);
  }

  function restoreQuotation() {
    const current = loadForm();
    saveForm({ ...current, documentType: "QUOTATION", paymentMethod: "pending" });
    setMessage("Quotationのテスト状態へ戻しました。画面を再読み込みします。");
    window.setTimeout(() => window.location.reload(), 500);
  }

  return (
    <section className="formal-test-panel no-print">
      <div className="formal-test-heading">
        <div>
          <span className="formal-test-badge">TEST VERSION</span>
          <h3>正式文書発行・準備中設定</h3>
        </div>
        <p>
          現在はレターヘッド、正式な銀行口座、Convera URLの提供前です。PDFにはテスト版の透かしを表示し、対外送付用として誤使用しにくい状態にしています。
        </p>
      </div>

      <div className="formal-test-status-grid">
        <div><span>レターヘッド</span><strong>後日差し替え</strong></div>
        <div><span>銀行口座情報</span><strong>後日登録</strong></div>
        <div><span>Convera URL</span><strong>請求時に登録</strong></div>
        <div><span>現在の用途</span><strong>UI・PDFテスト</strong></div>
      </div>

      <div className="formal-test-actions">
        <button type="button" className="btn secondary" onClick={restoreQuotation}>
          Quotationをテスト
        </button>
        <button type="button" className="btn secondary" onClick={loadTestBankDetails}>
          Bank Invoiceを仮設定
        </button>
        <button type="button" className="btn secondary" onClick={loadTestConveraDetails}>
          Convera Invoiceを仮設定
        </button>
      </div>

      {message && <div className="formal-test-message">{message}</div>}
      <div className="formal-test-warning">
        テスト用の銀行情報およびURLは実際の支払には使用できません。正式情報を受領後、固定レターヘッドと支払情報を差し替えます。
      </div>
    </section>
  );
}

export default function FormalDocumentTestSupport() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const container = document.querySelector(".container");
    if (!container) return;
    const mount = document.createElement("div");
    mount.setAttribute("data-formal-test-support-mount", "");
    container.appendChild(mount);
    setTarget(mount);
    return () => mount.remove();
  }, []);

  return target ? createPortal(<FormalDocumentTestPanel />, target) : null;
}
