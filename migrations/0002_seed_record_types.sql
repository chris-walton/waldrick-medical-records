-- Seed the built-in record types. Idempotent via INSERT OR IGNORE on the unique `key`.
-- schema_json is an optional JSON array of { key, label, type } extra-field descriptors
-- used to render dynamic inputs in the record dialog.

INSERT OR IGNORE INTO record_types (id, key, label, icon, schema_json, is_system, sort_order) VALUES
  ('rt_immunization', 'immunization', 'Immunization', 'vaccines',
   '[{"key":"dose","label":"Dose #","type":"text"},{"key":"lot","label":"Lot number","type":"text"},{"key":"manufacturer","label":"Manufacturer","type":"text"}]',
   1, 1),
  ('rt_medication', 'medication', 'Medication', 'medication',
   '[{"key":"dosage","label":"Dosage","type":"text"},{"key":"frequency","label":"Frequency","type":"text"}]',
   1, 2),
  ('rt_allergy', 'allergy', 'Allergy', 'warning_amber',
   '[{"key":"reaction","label":"Reaction","type":"text"},{"key":"severity","label":"Severity","type":"text"}]',
   1, 3),
  ('rt_condition', 'condition', 'Condition', 'monitor_heart',
   '[]',
   1, 4),
  ('rt_lab_result', 'lab_result', 'Lab result', 'science',
   '[{"key":"result","label":"Result","type":"text"},{"key":"reference_range","label":"Reference range","type":"text"}]',
   1, 5),
  ('rt_visit', 'visit', 'Visit', 'local_hospital',
   '[{"key":"reason","label":"Reason","type":"text"}]',
   1, 6),
  ('rt_vitals', 'vitals', 'Vitals', 'favorite',
   '[{"key":"height","label":"Height","type":"text"},{"key":"weight","label":"Weight","type":"text"},{"key":"bp","label":"Blood pressure","type":"text"}]',
   1, 7);
