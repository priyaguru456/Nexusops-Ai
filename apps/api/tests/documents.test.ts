import { describe, it, expect, vi, beforeEach } from "vitest";
import { Role, DocVisibility, DocStatus } from "@prisma/client";
import {
  canUserAccessDocument,
  buildVisibilityFilter,
  validateMimeAndExtension,
} from "../src/modules/documents/document.service";
import { LocalStorageService } from "../src/lib/storage";
import fs from "fs";
import path from "path";

describe("Documents Module Unit Tests", () => {
  describe("validateMimeAndExtension()", () => {
    it("accepts valid PDF file and mime type", () => {
      const ext = validateMimeAndExtension("report.pdf", "application/pdf");
      expect(ext).toBe(".pdf");
    });

    it("accepts valid DOCX file", () => {
      const ext = validateMimeAndExtension(
        "guidelines.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      expect(ext).toBe(".docx");
    });

    it("accepts valid TXT file", () => {
      const ext = validateMimeAndExtension("notes.txt", "text/plain");
      expect(ext).toBe(".txt");
    });

    it("accepts valid MD file", () => {
      const ext = validateMimeAndExtension("README.md", "text/markdown");
      expect(ext).toBe(".md");
    });

    it("rejects unauthorized file extensions (e.g. .exe, .sh, .js)", () => {
      expect(() =>
        validateMimeAndExtension("malicious.exe", "application/octet-stream")
      ).toThrow(/Invalid file extension/);
      expect(() =>
        validateMimeAndExtension("script.js", "text/javascript")
      ).toThrow(/Invalid file extension/);
    });

    it("rejects mismatched mime and extension for PDF", () => {
      expect(() =>
        validateMimeAndExtension("spoofed.pdf", "text/plain")
      ).toThrow(/MIME type "text\/plain" does not match file extension/);
    });
  });

  describe("canUserAccessDocument() RBAC & Visibility Matrix", () => {
    const adminUser = {
      id: "admin-1",
      role: Role.ADMIN,
      departmentId: "dept-1",
    };

    const managerDept1 = {
      id: "mgr-1",
      role: Role.MANAGER,
      departmentId: "dept-1",
    };

    const managerDept2 = {
      id: "mgr-2",
      role: Role.MANAGER,
      departmentId: "dept-2",
    };

    const employeeDept1 = {
      id: "emp-1",
      role: Role.EMPLOYEE,
      departmentId: "dept-1",
    };

    const employeeDept2 = {
      id: "emp-2",
      role: Role.EMPLOYEE,
      departmentId: "dept-2",
    };

    it("allows ADMIN to access any document regardless of visibility or department", () => {
      expect(
        canUserAccessDocument(adminUser as any, {
          visibility: DocVisibility.ADMIN_ONLY,
          departmentId: "dept-99",
          uploadedById: "other",
        })
      ).toBe(true);
      expect(
        canUserAccessDocument(adminUser as any, {
          visibility: DocVisibility.DEPARTMENT,
          departmentId: "dept-99",
          uploadedById: "other",
        })
      ).toBe(true);
    });

    it("allows any authenticated user to access DocVisibility.ALL", () => {
      const doc = {
        visibility: DocVisibility.ALL,
        departmentId: null,
        uploadedById: "admin-1",
      };
      expect(canUserAccessDocument(employeeDept1 as any, doc)).toBe(true);
      expect(canUserAccessDocument(employeeDept2 as any, doc)).toBe(true);
      expect(canUserAccessDocument(managerDept1 as any, doc)).toBe(true);
    });

    it("enforces DocVisibility.MANAGERS: accessible to Managers and Admins, blocked for Employees", () => {
      const doc = {
        visibility: DocVisibility.MANAGERS,
        departmentId: null,
        uploadedById: "admin-1",
      };
      expect(canUserAccessDocument(managerDept1 as any, doc)).toBe(true);
      expect(canUserAccessDocument(managerDept2 as any, doc)).toBe(true);
      expect(canUserAccessDocument(adminUser as any, doc)).toBe(true);
      expect(canUserAccessDocument(employeeDept1 as any, doc)).toBe(false);
    });

    it("enforces DocVisibility.DEPARTMENT: only accessible within matching department", () => {
      const dept1Doc = {
        visibility: DocVisibility.DEPARTMENT,
        departmentId: "dept-1",
        uploadedById: "other-user",
      };
      expect(canUserAccessDocument(employeeDept1 as any, dept1Doc)).toBe(true);
      expect(canUserAccessDocument(managerDept1 as any, dept1Doc)).toBe(true);
      expect(canUserAccessDocument(employeeDept2 as any, dept1Doc)).toBe(false);
      expect(canUserAccessDocument(managerDept2 as any, dept1Doc)).toBe(false);
    });

    it("enforces DocVisibility.ADMIN_ONLY: only accessible to Admins", () => {
      const doc = {
        visibility: DocVisibility.ADMIN_ONLY,
        departmentId: "dept-1",
        uploadedById: "admin-1",
      };
      expect(canUserAccessDocument(adminUser as any, doc)).toBe(true);
      expect(canUserAccessDocument(managerDept1 as any, doc)).toBe(false);
      expect(canUserAccessDocument(employeeDept1 as any, doc)).toBe(false);
    });

    it("allows the document uploader to access their own document even if restrictive", () => {
      const docUploadedByEmp1 = {
        visibility: DocVisibility.ADMIN_ONLY,
        departmentId: "dept-99",
        uploadedById: "emp-1",
      };
      expect(canUserAccessDocument(employeeDept1 as any, docUploadedByEmp1)).toBe(true);
    });
  });

  describe("LocalStorageService", () => {
    const testDir = path.resolve(__dirname, "test-uploads");
    let storage: LocalStorageService;

    beforeEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
      storage = new LocalStorageService(testDir);
    });

    it("generates UUID filenames and never uses the original filename as path", async () => {
      const buffer = Buffer.from("Hello world document content");
      const originalName = "Quarterly Financials.pdf";

      const result = await storage.save(buffer, originalName);

      expect(result.sizeBytes).toBe(buffer.length);
      expect(result.relativePath).toMatch(/^[0-9a-f-]{36}\.pdf$/i);
      expect(result.relativePath).not.toContain("Quarterly");
      expect(result.fullPath).toContain(result.relativePath);

      // Verify file exists on disk
      expect(await storage.exists(result.relativePath)).toBe(true);

      // Verify file read
      const readBuffer = await storage.read(result.relativePath);
      expect(readBuffer.toString()).toBe("Hello world document content");

      // Verify delete
      await storage.delete(result.relativePath);
      expect(await storage.exists(result.relativePath)).toBe(false);

      // Cleanup
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });
  });
});
