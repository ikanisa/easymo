-- Legacy entrypoint retained for local workflows.
-- The pgTAP suites now emit TAP output individually; this file simply
-- communicates that there are no standalone assertions here.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(0);
SELECT * FROM finish();
