# NexusOps AI - Data Dictionary

This document provides a comprehensive data dictionary for all tables in the NexusOps AI PostgreSQL database.

---

## 1. Department
Stores organizational departments (e.g., IT, HR, Finance).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique identifier for the department |
| `name` | TEXT | UNIQUE, NOT NULL | Department name (e.g., IT, HR, Finance) |

### Relationships
- Has many `User` records (`departmentId`)
- Has many `Document` records (`departmentId`)

---

## 2. User
Stores user accounts, authentication credentials, organizational roles, and hierarchy.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique identifier for the user |
| `name` | TEXT | NOT NULL | User's full name |
| `email` | TEXT | UNIQUE, NOT NULL | User's email address for authentication |
| `passwordHash` | TEXT | NOT NULL | Bcrypt password hash |
| `role` | Role ENUM | NOT NULL, DEFAULT 'EMPLOYEE' | Role (`EMPLOYEE`, `MANAGER`, `ADMIN`) |
| `isActive` | BOOLEAN | NOT NULL, DEFAULT true | Account status flag |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Account creation timestamp |
| `updatedAt` | TIMESTAMP(3) | NOT NULL | Last update timestamp |
| `departmentId` | TEXT | FOREIGN KEY, NULLABLE | Reference to `Department(id)` |
| `managerId` | TEXT | FOREIGN KEY, NULLABLE | Reference to parent `User(id)` |

### Indexes
- Unique index on `email`

### Relationships
- Belongs to `Department` (optional)
- Reports to `User` (manager, optional)
- Has many direct report `User` records
- Has many `RefreshToken`, `WorkRequest`, `Task`, `ApprovalStep`, `Document`, `ChatSession`, `Notification`, `Comment`, and `AuditLog` records

---

## 3. RefreshToken
Stores hashed refresh tokens for session management and token rotation.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique identifier for token record |
| `userId` | TEXT | FOREIGN KEY, NOT NULL | Reference to `User(id)` (ON DELETE CASCADE) |
| `tokenHash` | TEXT | NOT NULL | Hash of the refresh token |
| `expiresAt` | TIMESTAMP(3) | NOT NULL | Token expiration timestamp |
| `revoked` | BOOLEAN | NOT NULL, DEFAULT false | Whether the token has been invalidated |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Token creation timestamp |

### Indexes
- Index on `userId`

---

## 4. WorkRequest
Stores operational requests submitted by employees across categories.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique identifier for the request |
| `title` | TEXT | NOT NULL | Short summary of the work request |
| `description` | TEXT | NOT NULL | Detailed description of the request |
| `category` | RequestCategory ENUM | NOT NULL | Category (`IT`, `HR`, `FINANCE`, `FACILITIES`, `OTHER`) |
| `priority` | Priority ENUM | NOT NULL, DEFAULT 'MEDIUM' | Priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) |
| `status` | RequestStatus ENUM | NOT NULL, DEFAULT 'DRAFT' | Status (`DRAFT`, `SUBMITTED`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`) |
| `amount` | DECIMAL(12, 2) | NULLABLE | Financial expense amount associated with request |
| `dueDate` | TIMESTAMP(3) | NULLABLE | Expected completion deadline |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Creation timestamp |
| `updatedAt` | TIMESTAMP(3) | NOT NULL | Last modification timestamp |
| `requesterId` | TEXT | FOREIGN KEY, NOT NULL | Reference to `User(id)` who initiated request |

### Indexes
- Index on `status`
- Index on `requesterId`
- Index on `createdAt`

### Relationships
- Belongs to `User` (requester)
- Has many `RequestAttachment`, `Task`, and `ApprovalStep` records

---

## 5. RequestAttachment
Stores metadata and filesystem paths for files attached to work requests.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique attachment identifier |
| `requestId` | TEXT | FOREIGN KEY, NOT NULL | Reference to `WorkRequest(id)` (ON DELETE CASCADE) |
| `fileName` | TEXT | NOT NULL | Original upload file name |
| `filePath` | TEXT | NOT NULL | Storage file path |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Upload timestamp |

---

## 6. Task
Stores actionable work items, either standalone or associated with a work request.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique task identifier |
| `title` | TEXT | NOT NULL | Task title / summary |
| `description` | TEXT | NULLABLE | Detailed task instructions |
| `status` | TaskStatus ENUM | NOT NULL, DEFAULT 'TODO' | Status (`TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`) |
| `priority` | Priority ENUM | NOT NULL, DEFAULT 'MEDIUM' | Priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) |
| `dueDate` | TIMESTAMP(3) | NULLABLE | Task deadline |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Creation timestamp |
| `updatedAt` | TIMESTAMP(3) | NOT NULL | Last update timestamp |
| `requestId` | TEXT | FOREIGN KEY, NULLABLE | Reference to parent `WorkRequest(id)` |
| `assigneeId` | TEXT | FOREIGN KEY, NULLABLE | Reference to assigned `User(id)` |
| `assignedById`| TEXT | FOREIGN KEY, NULLABLE | Reference to creator `User(id)` |

### Indexes
- Index on `status`
- Index on `assigneeId`

---

## 7. Comment
Stores polymorphic discussion comments on requests, tasks, and documents.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique comment identifier |
| `entityType` | TEXT | NOT NULL | Target entity type (e.g. 'WorkRequest', 'Task') |
| `entityId` | TEXT | NOT NULL | ID of target entity |
| `body` | TEXT | NOT NULL | Markdown comment text |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Timestamp when posted |
| `userId` | TEXT | FOREIGN KEY, NOT NULL | Author `User(id)` |

### Indexes
- Composite index on `(entityType, entityId)`

---

## 8. ApprovalFlow
Defines category-based templates for multi-step approval workflows.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique approval flow identifier |
| `name` | TEXT | NOT NULL | Flow name (e.g. 'IT request', 'Finance / purchase') |
| `category` | RequestCategory ENUM | NOT NULL | Request category matching this workflow |
| `minAmount` | DECIMAL(12, 2) | NULLABLE | Optional threshold amount required to trigger flow |

### Relationships
- Has many `ApprovalFlowStep` records

---

## 9. ApprovalFlowStep
Defines each sequential role approval required in an `ApprovalFlow`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique step identifier |
| `flowId` | TEXT | FOREIGN KEY, NOT NULL | Reference to parent `ApprovalFlow(id)` (ON DELETE CASCADE) |
| `stepOrder` | INTEGER | NOT NULL | Sequence order (1, 2, ...) |
| `approverRole` | Role ENUM | NOT NULL | Role authorized to approve (`MANAGER`, `ADMIN`) |

### Constraints & Indexes
- Unique constraint on `(flowId, stepOrder)`

---

## 10. ApprovalStep
Tracks the concrete execution and decision state of an approval step for a specific work request.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique approval step execution ID |
| `requestId` | TEXT | FOREIGN KEY, NOT NULL | Reference to `WorkRequest(id)` (ON DELETE CASCADE) |
| `stepOrder` | INTEGER | NOT NULL | Sequence index of the step |
| `approverRole` | Role ENUM | NOT NULL | Required approver role |
| `approverId` | TEXT | FOREIGN KEY, NULLABLE | Reference to `User(id)` who decided the step |
| `status` | ApprovalStatus ENUM | NOT NULL, DEFAULT 'PENDING' | Status (`PENDING`, `APPROVED`, `REJECTED`, `SKIPPED`) |
| `comment` | TEXT | NULLABLE | Reason or feedback entered by approver |
| `decidedAt` | TIMESTAMP(3) | NULLABLE | Decision timestamp |

### Constraints & Indexes
- Unique constraint on `(requestId, stepOrder)`
- Index on `status`

---

## 11. Document
Stores document metadata, processing status, and RBAC visibility for RAG knowledge base.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique document ID |
| `title` | TEXT | NOT NULL | Display title of document |
| `fileName` | TEXT | NOT NULL | Original file name on disk |
| `filePath` | TEXT | NOT NULL | Relative/absolute storage path |
| `mimeType` | TEXT | NOT NULL | MIME type (e.g. 'application/pdf') |
| `sizeBytes` | INTEGER | NOT NULL | File size in bytes |
| `category` | TEXT | NULLABLE | Business category or tag |
| `visibility` | DocVisibility ENUM | NOT NULL, DEFAULT 'ALL' | RBAC visibility (`ALL`, `DEPARTMENT`, `MANAGERS`, `ADMIN_ONLY`) |
| `status` | DocStatus ENUM | NOT NULL, DEFAULT 'UPLOADED' | Processing status (`UPLOADED`, `PROCESSING`, `READY`, `FAILED`) |
| `errorMessage`| TEXT | NULLABLE | Failure error details if ingestion fails |
| `version` | INTEGER | NOT NULL, DEFAULT 1 | Document revision counter |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Upload timestamp |
| `departmentId`| TEXT | FOREIGN KEY, NULLABLE | Owning department (for DEPARTMENT visibility) |
| `uploadedById`| TEXT | FOREIGN KEY, NOT NULL | Reference to uploader `User(id)` |

### Indexes
- Index on `status`

### Relationships
- Has many `DocumentChunk` records

---

## 12. DocumentChunk
Stores parsed text chunks and vector embeddings for semantic search and retrieval.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique chunk ID |
| `documentId` | TEXT | FOREIGN KEY, NOT NULL | Reference to parent `Document(id)` (ON DELETE CASCADE) |
| `chunkIndex` | INTEGER | NOT NULL | Sequence index within the document |
| `pageNumber` | INTEGER | NULLABLE | Originating page in source document |
| `content` | TEXT | NOT NULL | Text content of the chunk |
| `tokenCount` | INTEGER | NULLABLE | Calculated token count |
| `embedding` | vector(1536) | NOT NULL | Vector embedding for cosine similarity |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Chunk extraction timestamp |

### Indexes
- Index on `documentId`
- Index on `createdAt`
- HNSW index `DocumentChunk_embedding_hnsw_idx` using `hnsw (embedding vector_cosine_ops)`
- GIN full-text search index `DocumentChunk_content_fts_idx` on `to_tsvector('english', content)`

---

## 13. ChatSession
Stores user conversation threads with the AI assistant.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique session identifier |
| `userId` | TEXT | FOREIGN KEY, NOT NULL | Reference to owner `User(id)` (ON DELETE CASCADE) |
| `title` | TEXT | NULLABLE | Conversation title summary |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Session creation timestamp |

### Relationships
- Has many `ChatMessage` records

---

## 14. ChatMessage
Stores individual messages, citations, token metrics, and user feedback within a chat session.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique message identifier |
| `sessionId` | TEXT | FOREIGN KEY, NOT NULL | Reference to parent `ChatSession(id)` (ON DELETE CASCADE) |
| `role` | ChatRole ENUM | NOT NULL | Message role (`USER`, `ASSISTANT`) |
| `content` | TEXT | NOT NULL | Message text |
| `citations` | JSONB | NULLABLE | Structured array of source document citations |
| `tokensUsed` | INTEGER | NULLABLE | Total LLM tokens used for response |
| `latencyMs` | INTEGER | NULLABLE | Model inference latency in milliseconds |
| `feedback` | INTEGER | NULLABLE | User rating (+1 / -1) |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Message creation timestamp |

### Indexes
- Index on `sessionId`

---

## 15. Notification
Stores user notifications for approval requests, task assignments, and status updates.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique notification ID |
| `userId` | TEXT | FOREIGN KEY, NOT NULL | Recipient `User(id)` (ON DELETE CASCADE) |
| `type` | TEXT | NOT NULL | Event classification (e.g. 'REQUEST_APPROVED') |
| `message` | TEXT | NOT NULL | Human-readable notification message |
| `link` | TEXT | NULLABLE | App route link to relevant entity |
| `isRead` | BOOLEAN | NOT NULL, DEFAULT false | Read/unread flag |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Notification timestamp |

### Indexes
- Composite index on `(userId, isRead)`

---

## 16. AuditLog
Stores immutable security and operational audit trail records.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique audit log ID |
| `actorId` | TEXT | FOREIGN KEY, NULLABLE | Reference to actor `User(id)` (SET NULL on delete) |
| `action` | TEXT | NOT NULL | Action name (e.g. 'USER_LOGIN', 'REQUEST_STATUS_CHANGE') |
| `entityType` | TEXT | NOT NULL | Affected entity type |
| `entityId` | TEXT | NULLABLE | Affected entity ID |
| `metadata` | JSONB | NULLABLE | Contextual JSON payload with event details |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Event timestamp |

### Indexes
- Composite index on `(entityType, entityId)`
- Index on `createdAt`
