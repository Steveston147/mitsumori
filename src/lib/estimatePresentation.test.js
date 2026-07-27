import test from "node:test";
import assert from "node:assert/strict";

import { calculatePerPersonEstimate } from "./estimatePresentation.js";

test("302,100円を15名で割ると20,140円になる", () => {
  assert.deepEqual(calculatePerPersonEstimate("￥302,100", "15名"), {
    amount: 20140,
    display: "20,140円",
    available: true,
  });
});

test("人数が0名の場合は算出できない", () => {
  assert.deepEqual(calculatePerPersonEstimate("￥302,100", "0名"), {
    amount: null,
    display: "算出できません",
    available: false,
  });
});

test("人数が未入力の場合は算出できない", () => {
  assert.deepEqual(calculatePerPersonEstimate("￥302,100", ""), {
    amount: null,
    display: "算出できません",
    available: false,
  });
});

test("総額が0円の場合は0円を表示する", () => {
  assert.deepEqual(calculatePerPersonEstimate("￥0", "15名"), {
    amount: 0,
    display: "0円",
    available: true,
  });
});

test("端数は1円単位で四捨五入する", () => {
  assert.deepEqual(calculatePerPersonEstimate("100,000円", "3名"), {
    amount: 33333,
    display: "33,333円",
    available: true,
  });
});
