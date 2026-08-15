import { expect, test } from "@playwright/test";
import { createProject, signUp, uniqueEmail } from "./helpers";

test("starting and stopping a task timer works", async ({ page }) => {
  const email = uniqueEmail("timer");
  await signUp(page, email, "E2E Timer");
  await createProject(page, "E2E Timer Project");

  await page.getByPlaceholder("Añadir tarea...").first().fill("E2E task");
  await page.getByRole("button", { name: "Añadir tarea" }).first().click();

  await page.getByRole("button", { name: "Iniciar timer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pausar", exact: true })).toBeVisible();
  await expect(page.getByText("Corriendo")).toBeVisible();

  await page.getByRole("button", { name: "Detener", exact: true }).click();
  await expect(page.getByText("Sin iniciar")).toBeVisible();
});
