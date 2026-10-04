import type { Capability } from "./capability.js";
import { hasCapability, hasCapabilityOrUnspecified } from "./get-react-doctor-setting.js";
import type { RuleContext } from "./rule-context.js";

export const shouldCreateRuleVisitors = (
  settings: RuleContext["settings"],
  requires: ReadonlyArray<Capability> | undefined,
  disabledWhen: ReadonlyArray<Capability> | undefined,
): boolean => {
  if (requires) {
    for (const capability of requires) {
      if (!hasCapabilityOrUnspecified(settings, capability)) return false;
    }
  }
  if (disabledWhen) {
    for (const capability of disabledWhen) {
      if (hasCapability(settings, capability)) return false;
    }
  }
  return true;
};
