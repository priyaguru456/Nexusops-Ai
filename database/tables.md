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
Tracks the concrete execution and decision state of an approval step for work requests or other entity types (Leave, Expenses).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique approval step execution ID |
| `entityType` | TEXT | NOT NULL, DEFAULT 'REQUEST' | Entity type (`REQUEST`, `LEAVE`, `EXPENSE`) |
| `entityId` | TEXT | NOT NULL | Target entity identifier |
| `requestId` | TEXT | FOREIGN KEY, NULLABLE | Reference to `WorkRequest(id)` for REQUEST entities (ON DELETE CASCADE) |
| `stepOrder` | INTEGER | NOT NULL | Sequence index of the step |
| `approverRole` | Role ENUM | NOT NULL | Required approver role |
| `approverId` | TEXT | FOREIGN KEY, NULLABLE | Reference to `User(id)` who decided the step |
| `status` | ApprovalStatus ENUM | NOT NULL, DEFAULT 'PENDING' | Status (`PENDING`, `APPROVED`, `REJECTED`, `SKIPPED`) |
| `comment` | TEXT | NULLABLE | Reason or feedback entered by approver |
| `decidedAt` | TIMESTAMP(3) | NULLABLE | Decision timestamp |
| `activatedAt` | TIMESTAMP(3) | NULLABLE | When step became active in the sequence |
| `escalatedAt` | TIMESTAMP(3) | NULLABLE | When step was escalated to next level |

### Constraints & Indexes
- Unique constraint on `(entityType, entityId, stepOrder)`
- Unique constraint on `(requestId, stepOrder)` (backward compatibility)
- Index on `(entityType, entityId)`
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
| `summary` | TEXT | NULLABLE | Human-readable event summary |
| `metadata` | JSONB | NULLABLE | Contextual JSON payload with event details (passwords/tokens/secrets stripped) |
| `ipAddress` | TEXT | NULLABLE | Origin IP address |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Event timestamp |

### Indexes
- Composite index on `(entityType, entityId)`
- Index on `createdAt`
- Index on `actorId`
- Index on `action`

---

## 15. Announcement

Stores company-wide and department-targeted operational announcements.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique announcement ID |
| `title` | TEXT | NOT NULL | Announcement title |
| `content` | TEXT | NOT NULL | Announcement content formatted as Markdown |
| `priority` | ENUM (`NORMAL`, `URGENT`) | NOT NULL, DEFAULT `NORMAL` | Priority flag (URGENT dispatches system notifications) |
| `targetDepartmentId` | TEXT | FOREIGN KEY, NULLABLE | Reference to `Department(id)` (NULL for company-wide) |
| `authorId` | TEXT | FOREIGN KEY, NOT NULL | Reference to author `User(id)` |
| `isPinned` | BOOLEAN | NOT NULL, DEFAULT `false` | Pin priority in feed |
| `expiresAt` | TIMESTAMP(3) | NULLABLE | Optional expiration timestamp |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Creation timestamp |
| `updatedAt` | TIMESTAMP(3) | NOT NULL | Last update timestamp |

### Indexes
- Composite index on `(isPinned, createdAt)`
- Index on `targetDepartmentId`
- Index on `authorId`
- Index on `priority`
- Index on `expiresAt`

---

## 16. AnnouncementRead

Tracks per-user read confirmations for announcements.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique read record ID |
| `announcementId` | TEXT | FOREIGN KEY, NOT NULL | Reference to `Announcement(id)` (CASCADE on delete) |
| `userId` | TEXT | FOREIGN KEY, NOT NULL | Reference to `User(id)` (CASCADE on delete) |
| `readAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Timestamp when user opened the announcement |

### Indexes & Constraints
- Unique composite index on `(announcementId, userId)`
- Index on `userId`
- Index on `announcementId`

---

## 17. Asset

Stores physical hardware and software assets managed by IT administrators.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique asset ID |
| `name` | TEXT | NOT NULL | Asset display name (e.g. MacBook Pro M3) |
| `type` | ENUM (`LAPTOP`, `MONITOR`, `PHONE`, `LICENSE`, `ACCESSORY`) | NOT NULL | Hardware / license category |
| `serialNumber` | TEXT | UNIQUE, NULLABLE | Hardware serial number or license key (unique when present) |
| `status` | ENUM (`AVAILABLE`, `ASSIGNED`, `IN_REPAIR`, `RETIRED`) | NOT NULL, DEFAULT `AVAILABLE` | Current lifecycle state |
| `purchaseDate` | TIMESTAMP(3) | NULLABLE | Purchase date in UTC |
| `warrantyExpiresAt` | TIMESTAMP(3) | NULLABLE | Warranty expiration date in UTC |
| `notes` | TEXT | NULLABLE | Optional maintenance / asset notes |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Creation timestamp |
| `updatedAt` | TIMESTAMP(3) | NOT NULL | Last update timestamp |

### Indexes & Constraints
- Unique index on `serialNumber`
- Index on `status`
- Index on `type`
- Index on `createdAt`
- Index on `warrantyExpiresAt`

---

## 18. AssetAssignment

Historical assignment log tracking past and active asset assignments to employees.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique assignment record ID |
| `assetId` | TEXT | FOREIGN KEY, NOT NULL | Reference to `Asset(id)` (CASCADE on delete) |
| `userId` | TEXT | FOREIGN KEY, NOT NULL | Reference to assignee `User(id)` (CASCADE on delete) |
| `assignedAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Assignment timestamp |
| `returnedAt` | TIMESTAMP(3) | NULLABLE | Return timestamp (NULL indicates active assignment) |
| `assignedById` | TEXT | FOREIGN KEY, NOT NULL | Reference to assigner `User(id)` (IT Staff / Admin) |
| `requestId` | TEXT | FOREIGN KEY, NULLABLE | Optional reference to linked `WorkRequest(id)` |
| `notes` | TEXT | NULLABLE | Assignment notes or condition details |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Creation timestamp |
| `updatedAt` | TIMESTAMP(3) | NOT NULL | Last update timestamp |

### Indexes & Constraints
- Index on `assetId`
- Index on `userId`
- Index on `requestId`
- Index on `assignedById`
- Index on `returnedAt`
- Index on `assignedAt`

---

## 19. Acknowledgement

Compliance acknowledgement records tracking policy acceptance per user, per document, and per version.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique acknowledgement record ID |
| `documentId` | TEXT | FOREIGN KEY, NOT NULL | Reference to `Document(id)` (CASCADE on delete) |
| `userId` | TEXT | FOREIGN KEY, NOT NULL | Reference to `User(id)` (CASCADE on delete) |
| `version` | INTEGER | NOT NULL | Exact policy document version acknowledged |
| `acknowledgedAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | UTC timestamp when policy version was acknowledged |

### Indexes & Constraints
- Unique composite constraint on `(documentId, userId, version)`
- Index on `documentId`
- Index on `userId`
- Index on `(documentId, version)`

---

## 20. LeaveBalance

Stores annualized leave balances and allowances per employee.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique leave balance ID |
| `userId` | TEXT | FOREIGN KEY, NOT NULL | Reference to `User(id)` (CASCADE on delete) |
| `year` | INTEGER | NOT NULL | Calendar year (e.g. 2026) |
| `casualDays` | INTEGER | NOT NULL, DEFAULT 12 | Total allocated casual leave days |
| `sickDays` | INTEGER | NOT NULL, DEFAULT 12 | Total allocated sick leave days |
| `annualDays` | INTEGER | NOT NULL, DEFAULT 15 | Total allocated annual leave days |
| `usedCasual` | INTEGER | NOT NULL, DEFAULT 0 | Consumed casual leave days |
| `usedSick` | INTEGER | NOT NULL, DEFAULT 0 | Consumed sick leave days |
| `usedAnnual` | INTEGER | NOT NULL, DEFAULT 0 | Consumed annual leave days |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Creation timestamp |
| `updatedAt` | TIMESTAMP(3) | NOT NULL | Last update timestamp |

### Indexes & Constraints
- Unique composite constraint on `(userId, year)`
- Index on `userId`
- Index on `year`

---

## 21. LeaveRequest

Stores employee leave applications, lifecycle states, dates, and approvals.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique leave request ID |
| `userId` | TEXT | FOREIGN KEY, NOT NULL | Reference to employee `User(id)` (CASCADE on delete) |
| `type` | ENUM (`CASUAL`, `SICK`, `ANNUAL`, `UNPAID`) | NOT NULL | Type of leave requested |
| `startDate` | TIMESTAMP(3) | NOT NULL | Inclusive start date in UTC |
| `endDate` | TIMESTAMP(3) | NOT NULL | Inclusive end date in UTC |
| `daysCount` | INTEGER | NOT NULL | Calculated working days (excluding weekends & holidays) |
| `reason` | TEXT | NOT NULL | Employee explanation for leave request |
| `status` | ENUM (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`) | NOT NULL, DEFAULT `PENDING` | Request state |
| `approverId` | TEXT | FOREIGN KEY, NULLABLE | Reference to deciding `User(id)` (Manager or Admin) |
| `decidedAt` | TIMESTAMP(3) | NULLABLE | Decision timestamp in UTC |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Creation timestamp |
| `updatedAt` | TIMESTAMP(3) | NOT NULL | Last update timestamp |

### Indexes & Constraints
- Index on `userId`
- Index on `status`
- Index on `(startDate, endDate)`
- Index on `createdAt`

---

## 22. Holiday

Stores official organizational holidays excluded from working day counts.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT / UUID | PRIMARY KEY | Unique holiday record ID |
| `name` | TEXT | NOT NULL | Official holiday name (e.g. Republic Day, Diwali) |
| `date` | TIMESTAMP(3) | UNIQUE, NOT NULL | Holiday date in UTC |
| `createdAt` | TIMESTAMP(3) | NOT NULL, DEFAULT now() | Creation timestamp |
| `updatedAt` | TIMESTAMP(3) | NOT NULL | Last update timestamp |

### Indexes & Constraints
- Unique constraint on `date`
- Index on `date`


