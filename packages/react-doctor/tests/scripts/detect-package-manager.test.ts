import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import {
  detectPackageManager,
  hasReactDoctorInstalled,
} from "../../../../scripts/detect-package-manager.mjs";

describe("detect-package-manager", () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "detect-pm-test-"));
  });

  afterEach(() => {
    fs.rmSync(projectDirectory, { recursive: true, force: true });
  });

  describe("detectPackageManager", () => {
    it("detects pnpm from packageManager field", () => {
      fs.writeFileSync(
        path.join(projectDirectory, "package.json"),
        JSON.stringify({ packageManager: "pnpm@10.0.0" }),
      );
      expect(detectPackageManager(projectDirectory)).toBe("pnpm");
    });

    it("detects yarn from packageManager field", () => {
      fs.writeFileSync(
        path.join(projectDirectory, "package.json"),
        JSON.stringify({ packageManager: "yarn@4.0.0" }),
      );
      expect(detectPackageManager(projectDirectory)).toBe("yarn");
    });

    it("detects bun from packageManager field", () => {
      fs.writeFileSync(
        path.join(projectDirectory, "package.json"),
        JSON.stringify({ packageManager: "bun@1.0.0" }),
      );
      expect(detectPackageManager(projectDirectory)).toBe("bun");
    });

    it("detects npm from packageManager field", () => {
      fs.writeFileSync(
        path.join(projectDirectory, "package.json"),
        JSON.stringify({ packageManager: "npm@10.0.0" }),
      );
      expect(detectPackageManager(projectDirectory)).toBe("npm");
    });

    it("detects pnpm from pnpm-lock.yaml", () => {
      fs.writeFileSync(path.join(projectDirectory, "package.json"), JSON.stringify({}));
      fs.writeFileSync(path.join(projectDirectory, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
      expect(detectPackageManager(projectDirectory)).toBe("pnpm");
    });

    it("detects yarn from yarn.lock", () => {
      fs.writeFileSync(path.join(projectDirectory, "package.json"), JSON.stringify({}));
      fs.writeFileSync(path.join(projectDirectory, "yarn.lock"), "# yarn lockfile v1\n");
      expect(detectPackageManager(projectDirectory)).toBe("yarn");
    });

    it("detects bun from bun.lockb", () => {
      fs.writeFileSync(path.join(projectDirectory, "package.json"), JSON.stringify({}));
      fs.writeFileSync(path.join(projectDirectory, "bun.lockb"), "");
      expect(detectPackageManager(projectDirectory)).toBe("bun");
    });

    it("detects npm from package-lock.json", () => {
      fs.writeFileSync(path.join(projectDirectory, "package.json"), JSON.stringify({}));
      fs.writeFileSync(path.join(projectDirectory, "package-lock.json"), "{}");
      expect(detectPackageManager(projectDirectory)).toBe("npm");
    });

    it("defaults to npm when no package manager is detected", () => {
      fs.writeFileSync(path.join(projectDirectory, "package.json"), JSON.stringify({}));
      expect(detectPackageManager(projectDirectory)).toBe("npm");
    });

    it("prefers packageManager field over lockfile", () => {
      fs.writeFileSync(
        path.join(projectDirectory, "package.json"),
        JSON.stringify({ packageManager: "pnpm@10.0.0" }),
      );
      fs.writeFileSync(path.join(projectDirectory, "yarn.lock"), "# yarn lockfile v1\n");
      expect(detectPackageManager(projectDirectory)).toBe("pnpm");
    });

    it("searches parent directories for packageManager field", () => {
      const packageDirectory = path.join(projectDirectory, "packages", "app");
      fs.mkdirSync(packageDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(projectDirectory, "package.json"),
        JSON.stringify({ packageManager: "pnpm@10.0.0" }),
      );
      fs.writeFileSync(path.join(packageDirectory, "package.json"), JSON.stringify({}));
      expect(detectPackageManager(packageDirectory)).toBe("pnpm");
    });

    it("searches parent directories for lockfiles", () => {
      const packageDirectory = path.join(projectDirectory, "packages", "app");
      fs.mkdirSync(packageDirectory, { recursive: true });
      fs.writeFileSync(path.join(projectDirectory, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
      fs.writeFileSync(path.join(packageDirectory, "package.json"), JSON.stringify({}));
      expect(detectPackageManager(packageDirectory)).toBe("pnpm");
    });
  });

  it("writes detector outputs to GITHUB_OUTPUT without relying on stdout", () => {
    fs.writeFileSync(
      path.join(projectDirectory, "package.json"),
      JSON.stringify({ packageManager: "pnpm@10.0.0" }),
    );
    const outputPath = path.join(projectDirectory, "action-outputs");
    const scriptPath = path.resolve(
      import.meta.dirname,
      "../../../../scripts/detect-package-manager.mjs",
    );
    const output = execFileSync(process.execPath, [scriptPath, projectDirectory], {
      env: { ...process.env, GITHUB_OUTPUT: outputPath },
      encoding: "utf8",
    });
    expect(output).toBe("");
    expect(fs.readFileSync(outputPath, "utf8")).toBe("package-manager=pnpm\nhas-installed=false\n");
  });

  it("reads the devEngines package manager policy", () => {
    fs.writeFileSync(
      path.join(projectDirectory, "package.json"),
      JSON.stringify({ devEngines: { packageManager: { name: "pnpm", onFail: "error" } } }),
    );
    expect(detectPackageManager(projectDirectory)).toBe("pnpm");
  });

  it("ignores malformed packageManager fields", () => {
    fs.writeFileSync(
      path.join(projectDirectory, "package.json"),
      JSON.stringify({ packageManager: {} }),
    );
    fs.writeFileSync(path.join(projectDirectory, "bun.lock"), "");
    expect(detectPackageManager(projectDirectory)).toBe("bun");
  });

  it("does not inherit a package manager across a repository boundary", () => {
    fs.writeFileSync(
      path.join(projectDirectory, "package.json"),
      JSON.stringify({ packageManager: "pnpm@10.0.0" }),
    );
    const repositoryDirectory = path.join(projectDirectory, "other-repository");
    fs.mkdirSync(path.join(repositoryDirectory, ".git"), { recursive: true });
    expect(detectPackageManager(repositoryDirectory)).toBe("npm");
  });

  describe("hasReactDoctorInstalled", () => {
    beforeEach(() => {
      fs.mkdirSync(path.join(projectDirectory, "node_modules", ".bin"), { recursive: true });
      fs.writeFileSync(path.join(projectDirectory, "node_modules", ".bin", "react-doctor"), "");
    });

    it("does not treat an uninstalled dependency as an installed CLI", () => {
      fs.writeFileSync(
        path.join(projectDirectory, "package.json"),
        JSON.stringify({ devDependencies: { "react-doctor": "latest" } }),
      );
      fs.unlinkSync(path.join(projectDirectory, "node_modules", ".bin", "react-doctor"));
      expect(hasReactDoctorInstalled(projectDirectory)).toBe(false);
    });

    it("finds a hoisted workspace installation from a nested package", () => {
      fs.writeFileSync(
        path.join(projectDirectory, "package.json"),
        JSON.stringify({ devDependencies: { "react-doctor": "latest" } }),
      );
      const packageDirectory = path.join(projectDirectory, "apps", "website");
      fs.mkdirSync(packageDirectory, { recursive: true });
      expect(hasReactDoctorInstalled(packageDirectory)).toBe(true);
    });

    it("returns true when react-doctor is in dependencies", () => {
      fs.writeFileSync(
        path.join(projectDirectory, "package.json"),
        JSON.stringify({ dependencies: { "react-doctor": "^2.0.0" } }),
      );
      expect(hasReactDoctorInstalled(projectDirectory)).toBe(true);
    });

    it("returns true when react-doctor is in devDependencies", () => {
      fs.writeFileSync(
        path.join(projectDirectory, "package.json"),
        JSON.stringify({ devDependencies: { "react-doctor": "^2.0.0" } }),
      );
      expect(hasReactDoctorInstalled(projectDirectory)).toBe(true);
    });

    it("returns false when react-doctor is not installed", () => {
      fs.writeFileSync(
        path.join(projectDirectory, "package.json"),
        JSON.stringify({ dependencies: {} }),
      );
      expect(hasReactDoctorInstalled(projectDirectory)).toBe(false);
    });

    it("returns false when package.json is missing", () => {
      expect(hasReactDoctorInstalled(projectDirectory)).toBe(false);
    });

    it("returns false when package.json is malformed", () => {
      fs.writeFileSync(path.join(projectDirectory, "package.json"), "not valid json");
      expect(hasReactDoctorInstalled(projectDirectory)).toBe(false);
    });
  });
});
