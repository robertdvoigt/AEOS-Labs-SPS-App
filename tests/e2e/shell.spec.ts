import { expect, test } from "@playwright/test";

test("application shell renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Software & Product Specialization/i })).toBeVisible();
  await expect(page.getByText(/Increment 0/i)).toBeVisible();
});
