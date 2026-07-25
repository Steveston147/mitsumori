# Ritsumeikan Custom Program Common Data Format

## Purpose

This format is the shared data contract for moving custom-program estimate data between applications and for restoring backups.

Current schema identifier:

`mitsumori-estimate-v1`

## Transport

The data is stored in the `TransferData` worksheet of the exported `.xlsx` file.

Because an Excel cell has a text-length limit, the JSON payload is divided into ordered rows:

- `payloadJson_1`
- `payloadJson_2`
- `payloadJson_3`
- ...

Applications must join the chunks in numeric order before parsing the JSON.

## Top-level fields

| Field | Purpose |
|---|---|
| `schemaVersion` | Data-format compatibility identifier |
| `exportedAt` | ISO 8601 export timestamp |
| `programBasicInfo` | Shared program and partner information |
| `inputs` | User-entered calculation fields |
| `summary` | Main calculated totals |
| `tables` | Calculation and comparison tables |
| `storage` | Application-owned saved data used for restoration |

## Compatibility rules

1. Importers must reject an unknown `schemaVersion` rather than guessing.
2. Existing fields must not silently change meaning within the same schema version.
3. New optional fields may be added without changing the version.
4. Breaking changes require a new schema identifier.
5. Other applications should primarily consume `programBasicInfo`, `summary`, and `tables`.
6. The `storage` field is application-specific and should only be restored by a compatible application.

## Privacy

The format is intended for operational program data and estimates. Personal information such as student names, personal email addresses, passport data, and medical information must not be stored in this file.
