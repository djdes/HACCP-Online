import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decidePartnerHint, type PartnerHintInput } from "./partner-hint";

const NONE: PartnerHintInput = {
  hasActivePartnerClient: false,
  isPartnerMember: false,
  hasWhiteLabelLogo: false,
  isPlatformOrg: false,
};

describe("decidePartnerHint", () => {
  it("shows the hint for an ordinary organization", () => {
    assert.equal(decidePartnerHint(NONE), true);
  });

  it("hides the hint when the organization came through a partner link", () => {
    assert.equal(decidePartnerHint({ ...NONE, hasActivePartnerClient: true }), false);
  });

  it("hides the hint for a partner member (they already have the cabinet)", () => {
    assert.equal(decidePartnerHint({ ...NONE, isPartnerMember: true }), false);
  });

  it("hides the hint under a white-label logo", () => {
    assert.equal(decidePartnerHint({ ...NONE, hasWhiteLabelLogo: true }), false);
  });

  it("hides the hint in the platform organization", () => {
    assert.equal(decidePartnerHint({ ...NONE, isPlatformOrg: true }), false);
  });
});
