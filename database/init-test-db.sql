-- Automatically executed by PostgreSQL container entrypoint
SELECT 'CREATE DATABASE nexusops_ai_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nexusops_ai_test')\gexec

\c nexusops_ai_test;
CREATE EXTENSION IF NOT EXISTS vector;
