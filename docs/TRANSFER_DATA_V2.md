# TransferData v2 integration contract

## Purpose

`mitsumori` is the calculation authority. Document-generation applications must read calculated values from this transfer payload and must not independently recalculate totals.

Data flow:

1. `mitsumori` calculates an estimate.
2. `mitsumori` exports an `.xlsx` workbook.
3. A document application reads the `TransferData` worksheet.
4. The document application creates quotations, agreements, invoices, or other documents.

## Backward compatibility

The workbook continues to contain the existing backup payload:

- `schemaVersion`: `mitsumori-estimate-v1`
- chunks: `payloadJson_1`, `payloadJson_2`, ...

This payload is used by `mitsumori` itself to restore React state.

The workbook additionally contains the interoperable payload:

- `transferSchemaVersion`: `mitsumori-transfer-v2`
- chunks: `transferV2Json_1`, `transferV2Json_2`, ...

Readers must sort chunk suffixes numerically, concatenate column B values, and parse the result as JSON.

## Main structure

```json
{
  "schemaVersion": "mitsumori-transfer-v2",
  "compatibility": {
    "minimumReaderVersion": "1.0",
    "calculationAuthority": "mitsumori"
  },
  "source": {
    "application": "mitsumori",
    "exportFormat": "xlsx-transfer-data",
    "exportedAt": "ISO-8601"
  },
  "project": {
    "projectId": "stable project identifier",
    "programName": "program name",
    "clientName": "client or university",
    "startDate": "date or empty string",
    "endDate": "date or empty string",
    "participants": 20,
    "basicInfo": {}
  },
  "estimate": {
    "method": "factor | build-up | unknown",
    "currency": "JPY",
    "totalAmount": 0,
    "perPersonAmount": 0,
    "participants": 20
  },
  "costSections": [
    {
      "sectionId": "local state section id",
      "data": {}
    }
  ],
  "presentation": {
    "summary": [],
    "inputs": [],
    "tables": []
  },
  "metadata": {
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601"
  }
}
```

## Rules for connected applications

- Treat `schemaVersion` as mandatory.
- Reject unsupported major schemas instead of guessing.
- Use `project.projectId` to associate records across applications.
- Use `estimate` values as calculated authoritative values.
- Preserve unknown fields to allow forward-compatible round trips.
- Do not depend on worksheet order except for locating `TransferData`.
- Do not use the backup `storage` object as a public integration API.
- Prefer `project`, `estimate`, and `costSections`; use `presentation` only for display fallbacks.

## Existing and future applications

When developing or revising quotation, agreement, invoice, program-management, or other related applications, add a reader for `mitsumori-transfer-v2` and use this contract as the shared integration boundary.
