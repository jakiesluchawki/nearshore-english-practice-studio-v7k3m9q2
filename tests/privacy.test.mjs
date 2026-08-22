import assert from "node:assert/strict";
import test from "node:test";
import { containsPersonalContact, withoutPersonalContacts } from "../src/data/privacy.js";

test("blocks real email addresses and phone numbers in practice answers", () => {
  for (const value of [
    "Please contact john.smith@example.com.",
    "Call me at 123456789.",
    "My number is 123 456 789.",
    "You can reach me on +48 123 456 789.",
    "Please call +48 (22) 123-45-67.",
  ]) {
    assert.equal(containsPersonalContact(value), true, `A real contact detail must be blocked: ${value}`);
  }
});

test("does not mistake normal recruitment dates, rates or salary ranges for phone numbers", () => {
  for (const value of [
    "I could start on 2026-10-01.",
    "I can join on 22.08.2026.",
    "The salary range is 20 000 - 25 000 PLN per month.",
    "The salary range is 20 000 - 25 000 zł per month.",
    "The salary range is 20 000 to 25 000 EUR.",
    "The range is USD 120000 - 150000.",
    "The hourly rate is 190 PLN and the notice period is 30 days.",
  ]) {
    assert.equal(containsPersonalContact(value), false, `A legitimate recruitment detail must remain usable: ${value}`);
  }
});

test("removes unsafe saved phrases while preserving useful rate and availability language", () => {
  assert.deepEqual(withoutPersonalContacts([
    "Could you start on 2026-10-01?",
    "The budget is 20 000 - 25 000 PLN.",
    "Contact jane@example.com.",
    "Please call 123456789.",
    null,
  ]), [
    "Could you start on 2026-10-01?",
    "The budget is 20 000 - 25 000 PLN.",
  ]);
});
