import type { Capability } from "./capability.js";
import { hasCapability, hasCapabilityOrUnspecified } from "./get-react-doctor-setting.js";
import type { RuleContext } from "./rule-context.js";

export const shouldCreateRuleVisitors = (
  settings: RuleContext["settings"],
  requires: ReadonlyArray<Capability> | undefined,
  disabledWhen: ReadonlyArray<Capability> | undefined,
): boolean =>
  !requires?.some((capability) => !hasCapabilityOrUnspecified(settings, capability)) &&
  !disabledWhen?.some((capability) => hasCapability(settings, capability));
