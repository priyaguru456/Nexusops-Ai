# NexusOps AI - Database Documentation & Schema

This directory contains database documentation, full SQL DDL scripts, indexes, entity relationship diagrams, and the data dictionary for NexusOps AI.

## Directory Structure

```
database/
├── README.md        # This guide on database files and operations
├── schema.sql       # Complete PostgreSQL DDL (enums, tables, constraints, foreign keys, indexes)
├── indexes.sql      # Additional performance and full-text search indexes
├── erd.md           # Mermaid Entity Relationship Diagram
└── tables.md        # Comprehensive data dictionary for all database tables
```

---

## How to Use These Files

### 1. Prisma Migrations (Recommended for Development)
The canonical schema is managed via Prisma in `apps/api/prisma/schema.prisma`.

To validate, create, and apply migrations:
```powershell
# From apps/api directory:
npx prisma validate
npx prisma migrate dev
```

To run the database seed (departments, default users, approval flows):
```powershell
npx prisma db seed
```

### 2. Direct PostgreSQL Execution (Using `psql`)
If setting up a database directly without Prisma migrations:
```powershell
# Apply the base schema
psql -d nexusops_ai -f database/schema.sql

# Apply the full-text search index
psql -d nexusops_ai -f database/indexes.sql
```

### 3. Visualizing Schema
- Open `erd.md` in GitHub, VS Code, or any Markdown viewer with Mermaid support to view the full graphical entity-relationship diagram.
- Refer to `tables.md` for column definitions, constraints, default values, indexes, and relationships.
