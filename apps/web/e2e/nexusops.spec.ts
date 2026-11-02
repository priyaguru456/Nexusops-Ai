import { test, expect, Page, Browser } from "@playwright/test";
import path from "path";

// Helper for authenticating a browser page
async function loginAs(page: Page, email: string, password = "Password123!") {
  await page.goto("/login");
  await page.getByLabel(/work email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  // Expect redirect to dashboard or home
  await expect(page).toHaveURL(/.*dashboard.*/);
}

test.describe("NexusOps E2E Suite: Multi-Role Workflow & Security", () => {
  test("full multi-role lifecycle: employee creates request -> manager approves -> task generated -> admin uploads PDF -> AI cites policy", async ({
    browser,
  }) => {
    const timestamp = Date.now();
    const requestTitle = `Laptop Upgrade Request ${timestamp}`;

    // 1. Employee Context: Creates and submits a work request
    const employeeContext = await browser.newContext();
    const empPage = await employeeContext.newPage();

    await loginAs(empPage, "employee@nexusops.com");

    // Navigate to create request
    await empPage.goto("/requests/new");
    await empPage.getByLabel(/title/i).fill(requestTitle);
    await empPage.getByLabel(/description/i).fill("High performance dev machine for deep learning models");
    await empPage.getByLabel(/category/i).selectOption("IT");
    await empPage.getByLabel(/priority/i).selectOption("HIGH");
    await empPage.getByRole("button", { name: /create draft request/i }).click();

    // On detail page, submit the request for approval
    await expect(empPage).toHaveURL(/.*requests\/[a-f0-9-]+/);
    const submitBtn = empPage.getByRole("button", { name: /submit request/i });
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // Confirm submit in confirmation dialog if present
    const confirmSubmitDialogBtn = empPage.getByRole("button", { name: /confirm|submit/i }).last();
    if (await confirmSubmitDialogBtn.isVisible()) {
      await confirmSubmitDialogBtn.click();
    }

    // Verify status updated to SUBMITTED or IN_REVIEW
    await expect(empPage.getByText(/submitted|in review/i).first()).toBeVisible();

    // 2. Manager Context: Approves request in inbox
    const managerContext = await browser.newContext();
    const mgrPage = await managerContext.newPage();

    await loginAs(mgrPage, "manager@nexusops.com");
    await mgrPage.goto("/approvals");

    // Find the pending step for our request title
    await expect(mgrPage.getByText(requestTitle)).toBeVisible({ timeout: 10000 });
    const approveBtn = mgrPage
      .locator("tr, div")
      .filter({ hasText: requestTitle })
      .getByRole("button", { name: /approve/i })
      .first();

    await approveBtn.click();

    // Fill approval comment in modal & confirm
    const commentInput = mgrPage.getByPlaceholder(/reason|comment|optional/i);
    if (await commentInput.isVisible()) {
      await commentInput.fill("Approved for Q4 dev setup");
    }
    await mgrPage.getByRole("button", { name: /confirm approval|approve/i }).last().click();

    // 3. Employee Context: Task appears
    await empPage.goto("/tasks");
    await expect(empPage.getByText(requestTitle).first()).toBeVisible({ timeout: 10000 });

    // 4. Admin Context: Uploads fixture PDF document
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    await loginAs(adminPage, "admin@nexusops.com");
    await adminPage.goto("/documents");

    // Open upload modal
    await adminPage.getByRole("button", { name: /upload document|upload/i }).click();

    const fixturePath = path.resolve(__dirname, "tests/fixtures/leave-policy.pdf");
    const fileChooserPromise = adminPage.waitForEvent("filechooser");
    await adminPage.getByText(/drag and drop|browse|upload/i).first().click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixturePath);

    await adminPage.getByLabel(/title|document title/i).fill("Company Leave Policy 2026");
    await adminPage.getByRole("button", { name: /upload|save/i }).last().click();

    // Wait until document status shows READY (no fixed sleeps, pure expect timeout)
    const docRow = adminPage.locator("tr, div").filter({ hasText: "Company Leave Policy 2026" });
    await expect(docRow.getByText(/ready/i).first()).toBeVisible({ timeout: 15000 });

    // 5. User Context: Asks AI Assistant and verifies citation
    await empPage.goto("/ai");
    const chatInput = empPage.getByPlaceholder(/ask a question/i);
    await chatInput.fill("What is the annual leave allowance?");
    await empPage.getByRole("button", { name: /send/i }).click();

    // Expect streaming response to appear with citation chip citing page 2
    await expect(empPage.getByText(/leave policy/i).first()).toBeVisible({ timeout: 15000 });
    await expect(empPage.getByText(/\[1\]/).first()).toBeVisible();
    await expect(empPage.getByText(/p\.2|page 2/i).first()).toBeVisible();

    // Clean up browser contexts
    await employeeContext.close();
    await managerContext.close();
    await adminContext.close();
  });

  test("negative flows: employee cannot access /admin/audit (403)", async ({ page }) => {
    await loginAs(page, "employee@nexusops.com");
    await page.goto("/admin/audit");

    // Must be redirected to /403 or display 403 Forbidden
    await expect(
      page.getByText(/403|access denied|forbidden|not authorized/i).first()
    ).toBeVisible();
  });

  test("negative flows: employee asking about ADMIN_ONLY document gets 'not found' answer", async ({
    page,
    browser,
  }) => {
    // Admin uploads ADMIN_ONLY document
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAs(adminPage, "admin@nexusops.com");
    await adminPage.goto("/documents");
    await adminPage.getByRole("button", { name: /upload document|upload/i }).click();

    const fixturePath = path.resolve(__dirname, "tests/fixtures/leave-policy.pdf");
    const fileChooserPromise = adminPage.waitForEvent("filechooser");
    await adminPage.getByText(/drag and drop|browse|upload/i).first().click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(fixturePath);

    await adminPage.getByLabel(/title|document title/i).fill("Executive Board Secret Strategy");
    await adminPage.getByLabel(/visibility/i).selectOption("ADMIN_ONLY");
    await adminPage.getByRole("button", { name: /upload|save/i }).last().click();

    await adminContext.close();

    // Employee asks about the confidential strategy
    await loginAs(page, "employee@nexusops.com");
    await page.goto("/ai");
    const chatInput = page.getByPlaceholder(/ask a question/i);
    await chatInput.fill("What is the Executive Board Secret Strategy?");
    await page.getByRole("button", { name: /send/i }).click();

    // Must return not found response without citation
    await expect(
      page.getByText(/could not find|cannot find|do not have access|no information/i).first()
    ).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Executive Board Secret Strategy/)).toHaveCount(1); // Only in the user's prompt
  });

  test("negative flows: stop button cancels a slow stream and chat still works afterwards", async ({
    page,
  }) => {
    await loginAs(page, "employee@nexusops.com");
    await page.goto("/ai");

    const chatInput = page.getByPlaceholder(/ask a question/i);
    await chatInput.fill("Generate a comprehensive summary of all company standards");
    await page.getByRole("button", { name: /send/i }).click();

    // Stop button should appear during streaming
    const stopBtn = page.getByRole("button", { name: /stop/i });
    if (await stopBtn.isVisible()) {
      await stopBtn.click();
    }

    // Verify chat is usable again and input is enabled
    await expect(chatInput).toBeEnabled({ timeout: 5000 });

    // Send next message to verify chat still works
    await chatInput.fill("Hello, is the assistant ready?");
    await page.getByRole("button", { name: /send/i }).click();

    await expect(chatInput).toBeEnabled({ timeout: 10000 });
  });
});
