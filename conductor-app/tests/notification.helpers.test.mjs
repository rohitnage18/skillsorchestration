import test from "node:test";
import assert from "node:assert/strict";

import {
  getActionLabel,
  getInitialEmailStatus,
  getNotificationTitle,
  mapActionToNotificationType,
  parseEmailConfigFromEnv,
  shouldSkipEmail,
} from "../features/logging/notification.helpers.js";

test("parseEmailConfigFromEnv returns null when required SMTP values are missing", () => {
  const result = parseEmailConfigFromEnv({
    SMTP_HOST: "smtp.example.com",
    SMTP_USER: "",
    SMTP_PASSWORD: "secret",
    FROM_EMAIL: "admin@example.com",
  });

  assert.equal(result, null);
});

test("parseEmailConfigFromEnv parses SMTP values when configured", () => {
  const result = parseEmailConfigFromEnv({
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: "2525",
    SMTP_SECURE: "true",
    SMTP_USER: "mailer",
    SMTP_PASSWORD: "secret",
    FROM_EMAIL: "admin@example.com",
  });

  assert.deepEqual(result, {
    smtpHost: "smtp.example.com",
    smtpPort: 2525,
    smtpSecure: true,
    smtpUser: "mailer",
    smtpPassword: "secret",
    fromEmail: "admin@example.com",
  });
});

test("getInitialEmailStatus honors skipped and missing-config states", () => {
  assert.equal(getInitialEmailStatus("skill:list", null), "SKIPPED");
  assert.equal(getInitialEmailStatus("skill:import", null), "NOT_CONFIGURED");
  assert.equal(
    getInitialEmailStatus("skill:import", {
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: "mailer",
      smtpPassword: "secret",
      fromEmail: "admin@example.com",
    }),
    "PENDING"
  );
});

test("notification mapping covers conductor and registry events", () => {
  assert.equal(mapActionToNotificationType("skill:create"), "SKILL_CREATED");
  assert.equal(mapActionToNotificationType("skill:file:update"), "USER_ACTION");
  assert.equal(mapActionToNotificationType("skill:execute"), "USER_ACTION");
  assert.equal(mapActionToNotificationType("context:update"), "USER_ACTION");
});

test("notification titles and labels cover tracked skill and context actions", () => {
  assert.equal(getNotificationTitle("skill:import"), "Skill Imported");
  assert.equal(getNotificationTitle("skill:file:restore"), "Skill File Restored");
  assert.equal(getNotificationTitle("context:update"), "Context File Updated");
  assert.equal(getActionLabel("skill:use"), "Skill used");
  assert.equal(getActionLabel("context:update"), "Context file updated");
});

test("shouldSkipEmail remains limited to intentionally noisy actions", () => {
  assert.equal(shouldSkipEmail("skill:list"), true);
  assert.equal(shouldSkipEmail("skill:preview"), false);
  assert.equal(shouldSkipEmail("skill:import"), false);
});
