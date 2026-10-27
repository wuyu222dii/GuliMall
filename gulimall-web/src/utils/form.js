// Compare only editable fields; IDs, lookup metadata and numeric input types are not user changes.
export const formSignature = (form, fields) => JSON.stringify(fields.map(key => String(form?.[key] ?? '')))
