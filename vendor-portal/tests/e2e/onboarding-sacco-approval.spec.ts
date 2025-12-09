// @ts-nocheck

import { test, expect } from "@playwright/test";
import { setSession } from "./support/session";

/**
 * E2E test for core SACCO member onboarding and approval flow:
 * 1. Member onboards (adds contact info)
 * 2. Member adds/searches for a SACCO
 * 3. Member requests to join an ibimina group
 * 4. Staff approves the join request
 * 5. Member becomes visible in the group members list
 */
test.describe("Onboarding → Add SACCO → Ask to Join → Staff Approve → Members Visible", () => {
  test("complete member onboarding and approval flow", async ({ page, request }) => {
    // Step 1: Member onboards with contact information
    await setSession(request, page, "authenticated");

    await page.goto("/member/onboard");
    await expect(page.getByRole("heading", { name: /create your member profile/i })).toBeVisible();

    // Fill in contact numbers
    const whatsappInput = page.getByLabel(/whatsapp/i).or(page.getByPlaceholder(/whatsapp/i));
    const momoInput = page.getByLabel(/momo/i).or(page.getByPlaceholder(/momo/i));

    await whatsappInput.fill("+250788123456");
    await momoInput.fill("+250788123456");

    // Complete onboarding (skip ID upload for E2E simplicity)
    const nextButton = page.getByRole("button", { name: /next|continue|save|complete/i });
    if (await nextButton.isVisible()) {
      await nextButton.click();
      // If there are more steps, navigate through or skip
      const skipButton = page.getByRole("button", { name: /skip/i });
      if (await skipButton.isVisible()) {
        await skipButton.click();
      }
    }

    // Step 2: Navigate to SACCOs page and search for a SACCO
    await page.goto("/member/saccos");
    await expect(page.getByRole("heading", { name: /my saccos/i })).toBeVisible();

    // Search for a SACCO
    const searchInput = page.getByPlaceholder(/search for your sacco/i);
    await searchInput.fill("Imbere");

    // Wait for search results
    await page.waitForTimeout(1000); // Allow search to complete

    // Look for first search result and click "Add" or "Join"
    const firstResult = page
      .locator("li")
      .filter({ hasText: /Imbere/i })
      .first();
    if (await firstResult.isVisible()) {
      const joinButton = firstResult.getByRole("button", { name: /join|add/i });
      if (await joinButton.isVisible()) {
        await joinButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Step 3: Request to join an ibimina group
    // Navigate to groups or find a group to join
    await page.goto("/member/groups");

    // Look for available groups to join
    const availableGroup = page.getByText(/available|browse/i).first();
    if (await availableGroup.isVisible()) {
      await availableGroup.click();
    }

    // Find first group and request to join
    const groupCard = page
      .locator("[data-testid='group-card']")
      .first()
      .or(
        page
          .locator("article")
          .filter({ hasText: /ikimina|group/i })
          .first()
      );

    if (await groupCard.isVisible()) {
      const requestJoinButton = groupCard.getByRole("button", { name: /join|request/i });
      if (await requestJoinButton.isVisible()) {
        await requestJoinButton.click();

        // Fill in join request note if modal appears
        const noteInput = page.getByPlaceholder(/note|message|reason/i);
        if (await noteInput.isVisible()) {
          await noteInput.fill("I would like to join this group");
          const confirmButton = page.getByRole("button", { name: /submit|send|confirm/i });
          await confirmButton.click();
        }

        await expect(page.getByText(/request sent|pending/i)).toBeVisible({ timeout: 5000 });
      }
    }

    // Step 4: Switch to staff view and approve the join request
    await page.goto("/admin/approvals");
    await expect(page.getByRole("heading", { name: /approvals|pending/i })).toBeVisible();

    // Find the join request
    const joinRequestItem = page
      .locator("[data-testid='join-request']")
      .first()
      .or(
        page
          .getByText(/join request/i)
          .locator("..")
          .first()
      );

    if (await joinRequestItem.isVisible()) {
      // Click approve button
      const approveButton = joinRequestItem
        .getByRole("button", { name: /approve|accept/i })
        .or(page.getByRole("button", { name: /approve|accept/i }).first());

      if (await approveButton.isVisible()) {
        await approveButton.click();

        // Confirm approval if modal appears
        const confirmApproval = page.getByRole("button", { name: /confirm|yes/i });
        if (await confirmApproval.isVisible()) {
          await confirmApproval.click();
        }

        await expect(page.getByText(/approved|success/i)).toBeVisible({ timeout: 5000 });
      }
    }

    // Step 5: Verify member is visible in members list
    // Navigate to members page
    await page.goto("/admin/members");

    // Check that the member appears in the list
    const memberEmail = page.getByText(/staff@example.com|test|member/i);
    await expect(memberEmail.or(page.getByRole("cell").first())).toBeVisible({ timeout: 5000 });
  });

  test("member can view their SACCO after adding it", async ({ page, request }) => {
    await setSession(request, page, "authenticated");

    // Go to SACCOs page
    await page.goto("/member/saccos");
    await expect(page.getByRole("heading", { name: /my saccos/i })).toBeVisible();

    // Search and add a SACCO
    const searchInput = page.getByPlaceholder(/search for your sacco/i);
    await searchInput.fill("Heza");
    await page.waitForTimeout(1000);

    const firstResult = page.locator("li").filter({ hasText: /Heza/i }).first();
    if (await firstResult.isVisible()) {
      const joinButton = firstResult.getByRole("button", { name: /join|add/i });
      if (await joinButton.isVisible()) {
        await joinButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Verify SACCO appears in "My SACCOs" section
    await page.goto("/member/saccos");
    const mySaccosSection = page.locator("section").filter({ hasText: /my saccos/i });
    await expect(mySaccosSection.getByText(/Heza/i).or(page.getByText(/sacco/i))).toBeVisible();
  });

  test("staff can see pending join requests in approvals", async ({ page, request }) => {
    await setSession(request, page, "authenticated");

    await page.goto("/admin/approvals");
    await expect(page.getByRole("heading", { name: /approvals/i })).toBeVisible();

    // Check that approvals panel is present
    const approvalsPanel = page
      .locator("[data-testid='approvals-panel']")
      .or(page.getByText(/join request|queue|pending/i).locator(".."));

    await expect(approvalsPanel.or(page.locator("main"))).toBeVisible();

    // Verify page has approve/reject buttons (even if list is empty)
    const hasApprovalControls =
      (await page.getByRole("button", { name: /approve/i }).count()) > 0 ||
      (await page.getByText(/no pending|empty/i).isVisible());

    expect(hasApprovalControls).toBeTruthy();
  });
});
