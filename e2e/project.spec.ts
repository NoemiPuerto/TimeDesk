import { expect, test } from "@playwright/test";
import { createProject, signUp, uniqueEmail } from "./helpers";

test("creating a project shows the default kanban columns", async ({ page }) => {
  const email = uniqueEmail("project");
  await signUp(page, email, "E2E Project");
  await createProject(page, "E2E Test Project");

  await expect(page.getByRole("heading", { name: /To Do/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /In Progress/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Done/ })).toBeVisible();
});
