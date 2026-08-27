import type { Page } from "@playwright/test";

export const TEST_PASSWORD = "E2E-TimeDesk-Test-2026!";

export function uniqueEmail(prefix: string): string {
  return `noemipuertor+e2e-${prefix}-${Date.now()}@gmail.com`;
}

export async function signUp(page: Page, email: string, displayName: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "¿No tienes cuenta? Regístrate" }).click();
  await page.getByLabel("Nombre").fill(displayName);
  await page.getByLabel("Email").fill(email);
  // exact: true — si no, "Contraseña" también matchea "Confirmar contraseña".
  await page.getByLabel("Contraseña", { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel("Confirmar contraseña").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
}

export async function createProject(page: Page, name: string) {
  await page.getByRole("button", { name: "Selector de proyecto" }).click();
  await page.getByRole("button", { name: "+ Nuevo proyecto" }).click();
  await page.getByPlaceholder("Nombre del proyecto").fill(name);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
}

export async function addTask(page: Page, title: string) {
  await page.getByPlaceholder(/Añadir tarea a/).fill(title);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
}
