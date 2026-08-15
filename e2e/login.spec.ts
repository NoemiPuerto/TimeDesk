import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

test("signup reaches the empty project dashboard", async ({ page }) => {
  const email = uniqueEmail("login");
  await signUp(page, email, "E2E Login");

  await expect(page.getByText("Crea tu primer proyecto")).toBeVisible();
  await expect(page.getByRole("button", { name: "Selector de proyecto" })).toBeVisible();
});
