import { describe, expect, test } from "vite-plus/test";
import reactDoctorPlugin from "../src/index.js";

describe("issue #1862 - ESLint adapter respects requires gates", () => {
  test("rules with requires are skipped when capabilities are not declared", () => {
    const rule = reactDoctorPlugin.rules["react-router-v8-no-react-router-dom-import"];
    const context = {
      report: () => {},
      filename: "src/example.tsx",
      settings: {
        "react-doctor": {
          capabilities: ["react"],
        },
      },
    };

    const visitors = rule.create(context);

    expect(Object.keys(visitors)).toEqual([]);
  });

  test("rules with requires are enabled when required capabilities are present", () => {
    const rule = reactDoctorPlugin.rules["react-router-v8-no-react-router-dom-import"];
    const context = {
      report: () => {},
      filename: "src/example.tsx",
      settings: {
        "react-doctor": {
          capabilities: ["react", "react-router:8"],
        },
      },
    };

    const visitors = rule.create(context);

    expect(visitors.ImportDeclaration).toBeDefined();
    expect(visitors.ExportNamedDeclaration).toBeDefined();
  });

  test("ssr rules are skipped when ssr capability is not declared", () => {
    const rule = reactDoctorPlugin.rules["no-unguarded-browser-global-at-module-scope"];
    const context = {
      report: () => {},
      filename: "src/example.tsx",
      settings: {
        "react-doctor": {
          capabilities: ["react", "vite"],
        },
      },
    };

    const visitors = rule.create(context);

    expect(Object.keys(visitors)).toEqual([]);
  });

  test("ssr rules are enabled when ssr capability is present", () => {
    const rule = reactDoctorPlugin.rules["no-unguarded-browser-global-at-module-scope"];
    const context = {
      report: () => {},
      filename: "src/example.tsx",
      settings: {
        "react-doctor": {
          capabilities: ["react", "ssr", "nextjs"],
        },
      },
    };

    const visitors = rule.create(context);

    expect(visitors.Program).toBeDefined();
  });

  test("rules with requires are enabled when capabilities are unspecified", () => {
    const rule = reactDoctorPlugin.rules["no-unguarded-browser-global-at-module-scope"];
    const context = {
      report: () => {},
      filename: "src/example.tsx",
      settings: {},
    };

    const visitors = rule.create(context);

    expect(visitors.Program).toBeDefined();
  });

  test("rules with requires are enabled when settings bag is missing", () => {
    const rule = reactDoctorPlugin.rules["react-router-v8-no-react-router-dom-import"];
    const context = {
      report: () => {},
      filename: "src/example.tsx",
    };

    const visitors = rule.create(context);

    expect(visitors.ImportDeclaration).toBeDefined();
    expect(visitors.ExportNamedDeclaration).toBeDefined();
  });

  test("rules with disabledWhen still work correctly", () => {
    const rule = reactDoctorPlugin.rules["context-provider-value-from-unmemoized-local-literal"];
    const contextWithoutCompiler = {
      report: () => {},
      filename: "src/example.tsx",
      settings: {
        "react-doctor": {
          capabilities: ["react"],
        },
      },
    };

    const visitorsEnabled = rule.create(contextWithoutCompiler);
    expect(visitorsEnabled.Program).toBeDefined();

    const contextWithCompiler = {
      report: () => {},
      filename: "src/example.tsx",
      settings: {
        "react-doctor": {
          capabilities: ["react", "react-compiler"],
        },
      },
    };

    const visitorsDisabled = rule.create(contextWithCompiler);
    expect(Object.keys(visitorsDisabled)).toEqual([]);
  });

  test("rules with both requires and disabledWhen gate correctly", () => {
    const rule = reactDoctorPlugin.rules["no-unguarded-browser-global-in-render-or-hook-init"];
    const contextMissingRequires = {
      report: () => {},
      filename: "src/example.tsx",
      settings: {
        "react-doctor": {
          capabilities: ["nextjs"],
        },
      },
    };

    const visitorsMissingRequires = rule.create(contextMissingRequires);
    expect(Object.keys(visitorsMissingRequires)).toEqual([]);

    const contextWithRequires = {
      report: () => {},
      filename: "src/example.tsx",
      settings: {
        "react-doctor": {
          capabilities: ["react", "ssr"],
        },
      },
    };

    const visitorsEnabled = rule.create(contextWithRequires);
    expect(visitorsEnabled.Program).toBeDefined();
  });
});
