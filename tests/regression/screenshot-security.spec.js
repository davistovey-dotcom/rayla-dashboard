import { expect, test } from "@playwright/test";
import { PARSE_SCREENSHOT_URL } from "./helpers.js";

test("parse-screenshot rejects no-auth and invalid bearer requests before parser budget is used", async ({ request }) => {
  const noAuth = await request.post(PARSE_SCREENSHOT_URL, {
    data: { imageBase64: "not-a-real-image", mimeType: "image/png" },
  });
  expect(noAuth.status()).toBe(401);
  await expect(noAuth.json()).resolves.toMatchObject({
    message: expect.stringMatching(/authorization|auth/i),
  });

  const invalidBearer = await request.post(PARSE_SCREENSHOT_URL, {
    headers: { Authorization: "Bearer invalid-token" },
    data: { imageBase64: "not-a-real-image", mimeType: "image/png" },
  });
  expect(invalidBearer.status()).toBe(401);
  await expect(invalidBearer.json()).resolves.toMatchObject({
    message: expect.stringMatching(/jwt|authorization|auth/i),
  });
});
