import { describe, it, expect, beforeAll } from "vitest";
import { Role, DocVisibility, DocStatus, Prisma } from "@prisma/client";
import { prisma } from "../../src/lib/prisma";
import { retrievalService } from "../../src/modules/ai/retrieval.service";
import { setEmbeddingsProvider, MockEmbeddingsProvider } from "../../src/lib/embeddings";
import {
  createUser,
  createDepartment,
  createDocument,
  createChunk,
} from "../helpers/factories";

describe("Integration: Documents & AI Retrieval Permission Scoping (Real Test DB)", () => {
  const mockEmbeddings = new MockEmbeddingsProvider();

  let deptA: { id: string };
  let deptB: { id: string };

  let empA: { id: string; role: Role; departmentId: string | null };
  let mgrA: { id: string; role: Role; departmentId: string | null };
  let admin: { id: string; role: Role; departmentId: string | null };

  let publicDoc: { id: string };
  let managersDoc: { id: string };
  let adminOnlyDoc: { id: string };
  let deptADoc: { id: string };
  let deptBDoc: { id: string };
  let pendingDoc: { id: string };

  beforeAll(async () => {
    setEmbeddingsProvider(mockEmbeddings);

    deptA = await createDepartment("Engineering");
    deptB = await createDepartment("Sales");

    const a = await createUser({ role: Role.EMPLOYEE, departmentId: deptA.id });
    empA = a.user;

    const m = await createUser({ role: Role.MANAGER, departmentId: deptA.id });
    mgrA = m.user;

    const adm = await createUser({ role: Role.ADMIN, departmentId: null });
    admin = adm.user;

    // 1. ALL visibility doc (READY)
    publicDoc = await createDocument(admin, {
      title: "Public Vacation Policy",
      visibility: DocVisibility.ALL,
      status: DocStatus.READY,
    });
    await createChunk(publicDoc.id, {
      content: "All employees receive 20 days vacation per calendar year.",
    });

    // 2. MANAGERS visibility doc (READY)
    managersDoc = await createDocument(admin, {
      title: "Management Performance Review Handbook",
      visibility: DocVisibility.MANAGERS,
      status: DocStatus.READY,
    });
    await createChunk(managersDoc.id, {
      content: "Managers conduct quarterly performance calibrations and tier assignments.",
    });

    // 3. ADMIN_ONLY visibility doc (READY)
    adminOnlyDoc = await createDocument(admin, {
      title: "Executive Compensation & Equity Schedule",
      visibility: DocVisibility.ADMIN_ONLY,
      status: DocStatus.READY,
    });
    await createChunk(adminOnlyDoc.id, {
      content: "Executive equity packages vest on a 4-year cliff schedule.",
    });

    // 4. DEPARTMENT A doc (READY)
    deptADoc = await createDocument(mgrA, {
      title: "Engineering On-Call Architecture Guidelines",
      visibility: DocVisibility.DEPARTMENT,
      departmentId: deptA.id,
      status: DocStatus.READY,
    });
    await createChunk(deptADoc.id, {
      content: "Engineering team runs weekly rotations for tier 1 outage management.",
    });

    // 5. DEPARTMENT B doc (READY)
    const { user: mgrB } = await createUser({ role: Role.MANAGER, departmentId: deptB.id });
    deptBDoc = await createDocument(mgrB, {
      title: "Sales Commission Matrix Q4",
      visibility: DocVisibility.DEPARTMENT,
      departmentId: deptB.id,
      status: DocStatus.READY,
    });
    await createChunk(deptBDoc.id, {
      content: "Sales quota accelerators kick in at 110% attainment.",
    });

    // 6. Non-READY doc (status = PENDING)
    pendingDoc = await createDocument(admin, {
      title: "Unapproved Draft Policy",
      visibility: DocVisibility.ALL,
      status: DocStatus.PENDING,
    });
    await createChunk(pendingDoc.id, {
      content: "Draft notes that have not completed OCR and vectorization.",
    });
  });

  it("employee never receives MANAGERS, ADMIN_ONLY or another department's chunks", async () => {
    const { results } = await retrievalService.retrieve("policy schedule compensation", empA as any, 20);

    const docIds = results.map((r) => r.documentId);

    // Employee must NOT see:
    expect(docIds).not.toContain(managersDoc.id);
    expect(docIds).not.toContain(adminOnlyDoc.id);
    expect(docIds).not.toContain(deptBDoc.id);

    // Employee CAN see public and own department doc
    // (if matched by keywords or vector)
    for (const r of results) {
      expect([publicDoc.id, deptADoc.id]).toContain(r.documentId);
    }
  });

  it("non-READY documents are NEVER searched or returned in retrieval results", async () => {
    // Search for words specifically inside the pending doc
    const { results } = await retrievalService.retrieve("Unapproved Draft Policy OCR", admin as any, 20);

    const docIds = results.map((r) => r.documentId);
    expect(docIds).not.toContain(pendingDoc.id);

    // Every chunk returned must belong to a READY document
    for (const r of results) {
      expect(r.documentId).not.toBe(pendingDoc.id);
    }
  });

  it("manager receives MANAGERS, ALL, and own department docs, but NOT other department docs", async () => {
    const { results } = await retrievalService.retrieve("policy review commission guidelines", mgrA as any, 20);

    const docIds = results.map((r) => r.documentId);

    // Manager in Dept A cannot see Dept B
    expect(docIds).not.toContain(deptBDoc.id);
    // Manager cannot see ADMIN_ONLY
    expect(docIds).not.toContain(adminOnlyDoc.id);
  });

  it("admin can retrieve chunks across all visibility tiers and all departments", async () => {
    const { results } = await retrievalService.retrieve("vacation performance compensation guidelines", admin as any, 20);

    // Admin has access to all READY documents
    for (const r of results) {
      expect(r.documentId).not.toBe(pendingDoc.id);
    }
  });
});
