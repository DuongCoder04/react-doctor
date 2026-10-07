import { describe, expect, test } from "vite-plus/test";
import { shouldCreateRuleVisitors } from "../src/plugin/utils/should-create-rule-visitors.js";

describe("shouldCreateRuleVisitors", () => {
  describe("requires checking", () => {
    test("returns true when requires is undefined", () => {
      expect(shouldCreateRuleVisitors({}, undefined, undefined)).toBe(true);
    });

    test("returns true when requires is empty array", () => {
      expect(shouldCreateRuleVisitors({}, [], undefined)).toBe(true);
    });

    test("returns true when capabilities are unspecified", () => {
      expect(shouldCreateRuleVisitors({}, ["ssr"], undefined)).toBe(true);
    });

    test("returns true when settings bag is missing", () => {
      expect(shouldCreateRuleVisitors(undefined, ["ssr"], undefined)).toBe(true);
    });

    test("returns true when all required capabilities are present", () => {
      const settings = {
        "react-doctor": {
          capabilities: ["react", "ssr", "nextjs"],
        },
      };
      expect(shouldCreateRuleVisitors(settings, ["ssr"], undefined)).toBe(true);
      expect(shouldCreateRuleVisitors(settings, ["react", "ssr"], undefined)).toBe(true);
    });

    test("returns false when capabilities are specified but required capability is missing", () => {
      const settings = {
        "react-doctor": {
          capabilities: ["react", "nextjs"],
        },
      };
      expect(shouldCreateRuleVisitors(settings, ["ssr"], undefined)).toBe(false);
    });

    test("returns false when any required capability is missing", () => {
      const settings = {
        "react-doctor": {
          capabilities: ["react", "ssr"],
        },
      };
      expect(shouldCreateRuleVisitors(settings, ["react", "ssr", "nextjs"], undefined)).toBe(false);
    });

    test("returns false when react-router:8 is required but not present", () => {
      const settings = {
        "react-doctor": {
          capabilities: ["react", "react-router"],
        },
      };
      expect(shouldCreateRuleVisitors(settings, ["react-router:8"], undefined)).toBe(false);
    });

    test("returns true when react-router:8 is required and present", () => {
      const settings = {
        "react-doctor": {
          capabilities: ["react", "react-router:8"],
        },
      };
      expect(shouldCreateRuleVisitors(settings, ["react-router:8"], undefined)).toBe(true);
    });
  });

  describe("disabledWhen checking", () => {
    test("returns true when disabledWhen is undefined", () => {
      const settings = {
        "react-doctor": {
          capabilities: ["react-compiler"],
        },
      };
      expect(shouldCreateRuleVisitors(settings, undefined, undefined)).toBe(true);
    });

    test("returns true when disabledWhen is empty array", () => {
      const settings = {
        "react-doctor": {
          capabilities: ["react-compiler"],
        },
      };
      expect(shouldCreateRuleVisitors(settings, undefined, [])).toBe(true);
    });

    test("returns true when none of the disabling capabilities are present", () => {
      const settings = {
        "react-doctor": {
          capabilities: ["react", "nextjs"],
        },
      };
      expect(shouldCreateRuleVisitors(settings, undefined, ["react-compiler"])).toBe(true);
    });

    test("returns false when a disabling capability is present", () => {
      const settings = {
        "react-doctor": {
          capabilities: ["react", "react-compiler"],
        },
      };
      expect(shouldCreateRuleVisitors(settings, undefined, ["react-compiler"])).toBe(false);
    });

    test("returns false when any disabling capability is present", () => {
      const settings = {
        "react-doctor": {
          capabilities: ["react", "nextjs"],
        },
      };
      expect(shouldCreateRuleVisitors(settings, undefined, ["react-compiler", "nextjs"])).toBe(
        false,
      );
    });
  });

  describe("combined requires and disabledWhen", () => {
    test("returns true when requires met and disabledWhen not triggered", () => {
      const settings = {
        "react-doctor": {
          capabilities: ["react", "ssr"],
        },
      };
      expect(shouldCreateRuleVisitors(settings, ["ssr"], ["react-compiler"])).toBe(true);
    });

    test("returns false when requires met but disabledWhen triggered", () => {
      const settings = {
        "react-doctor": {
          capabilities: ["react", "ssr", "react-compiler"],
        },
      };
      expect(shouldCreateRuleVisitors(settings, ["ssr"], ["react-compiler"])).toBe(false);
    });

    test("returns false when requires not met even if disabledWhen not triggered", () => {
      const settings = {
        "react-doctor": {
          capabilities: ["react", "nextjs"],
        },
      };
      expect(shouldCreateRuleVisitors(settings, ["ssr"], ["react-compiler"])).toBe(false);
    });

    test("returns false when both requires not met and disabledWhen triggered", () => {
      const settings = {
        "react-doctor": {
          capabilities: ["react", "react-compiler"],
        },
      };
      expect(shouldCreateRuleVisitors(settings, ["ssr"], ["react-compiler"])).toBe(false);
    });
  });

  describe("issue #1862 regression scenarios", () => {
    test("skips react-router:8 rules when only react-router (no version) is present", () => {
      const settings = {
        "react-doctor": {
          capabilities: ["react", "react-router"],
        },
      };
      expect(shouldCreateRuleVisitors(settings, ["react-router:8"], undefined)).toBe(false);
    });

    test("skips ssr rules when ssr capability is not declared", () => {
      const settings = {
        "react-doctor": {
          capabilities: ["react", "vite"],
        },
      };
      expect(shouldCreateRuleVisitors(settings, ["ssr"], undefined)).toBe(false);
      expect(shouldCreateRuleVisitors(settings, ["react", "ssr"], undefined)).toBe(false);
    });

    test("enables ssr rules when ssr capability is declared", () => {
      const settings = {
        "react-doctor": {
          capabilities: ["react", "ssr", "nextjs"],
        },
      };
      expect(shouldCreateRuleVisitors(settings, ["ssr"], undefined)).toBe(true);
      expect(shouldCreateRuleVisitors(settings, ["react", "ssr"], undefined)).toBe(true);
    });
  });
});
