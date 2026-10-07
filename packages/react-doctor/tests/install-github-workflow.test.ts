import { tmpdir } from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import {
  getReactDoctorWorkflowPath,
  installReactDoctorWorkflow,
  isReactDoctorWorkflowInstalled,
  readReactDoctorWorkflow,
  upgradeReactDoctorWorkflowInPlace,
} from "../src/cli/utils/install-github-workflow.js";

const installInTempDir = (
  defaultBranch?: string,
): { readonly content: string; readonly cleanup: () => void } => {
  const projectRoot = fs.mkdtempSync(path.join(tmpdir(), "react-doctor-workflow-install-"));
  fs.mkdirSync(path.join(projectRoot, ".git"));
  const result = installReactDoctorWorkflow(projectRoot, defaultBranch);
  expect(result.status).toBe("created");
  return {
    content: fs.readFileSync(getReactDoctorWorkflowPath(projectRoot), "utf8"),
    cleanup: () => fs.rmSync(projectRoot, { recursive: true, force: true }),
  };
};

describe("installReactDoctorWorkflow push trigger", () => {
  it("scans the repo's default branch on push, not a hardcoded main", () => {
    const { content, cleanup } = installInTempDir("develop");
    try {
      expect(content).toContain('branches: ["develop"]');
      expect(content).toContain("Scans `develop` on every push");
      expect(content).not.toContain("[main]");
    } finally {
      cleanup();
    }
  });

  it("falls back to main when the default branch is unknown", () => {
    const { content, cleanup } = installInTempDir();
    try {
      expect(content).toContain('branches: ["main"]');
    } finally {
      cleanup();
    }
  });

  it("checks out full git history so PR runs can find the merge base", () => {
    const { content, cleanup } = installInTempDir();
    try {
      // Without fetch-depth: 0 a shallow checkout has no merge base, so the
      // compare-mode scan degrades to reporting every pre-existing issue.
      expect(content).toContain("- uses: actions/checkout@v5");
      expect(content).toContain("fetch-depth: 0");
    } finally {
      cleanup();
    }
  });
});

describe("installReactDoctorWorkflow git root placement", () => {
  it("installs workflow at the git root when called from a subdirectory", () => {
    const repositoryRoot = fs.mkdtempSync(path.join(tmpdir(), "react-doctor-git-root-"));
    const packageDirectory = path.join(repositoryRoot, "apps", "website");

    try {
      fs.mkdirSync(path.join(repositoryRoot, ".git"));
      fs.mkdirSync(packageDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(packageDirectory, "package.json"),
        JSON.stringify({ name: "website" }),
      );

      const result = installReactDoctorWorkflow(packageDirectory, "main");

      expect(result.status).toBe("created");
      expect(result.workflowPath).toBe(
        path.join(repositoryRoot, ".github", "workflows", "react-doctor.yml"),
      );
      expect(fs.existsSync(result.workflowPath)).toBe(true);
      expect(
        fs.existsSync(path.join(packageDirectory, ".github", "workflows", "react-doctor.yml")),
      ).toBe(false);
    } finally {
      fs.rmSync(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("uses a linked worktree root for installation, detection, and upgrades", () => {
    const repositoryRoot = fs.mkdtempSync(path.join(tmpdir(), "react-doctor-worktree-"));
    const packageDirectory = path.join(repositoryRoot, "apps", "website");
    try {
      fs.writeFileSync(
        path.join(repositoryRoot, ".git"),
        "gitdir: /repository/.git/worktrees/linked\n",
      );
      fs.mkdirSync(packageDirectory, { recursive: true });
      const result = installReactDoctorWorkflow(packageDirectory);
      expect(result.status).toBe("created");
      expect(result.workflowPath).toBe(
        path.join(repositoryRoot, ".github/workflows/react-doctor.yml"),
      );
      expect(isReactDoctorWorkflowInstalled(packageDirectory)).toBe(true);
      fs.writeFileSync(result.workflowPath, "custom: preserve\nuses: millionco/react-doctor@v1\n");
      expect(installReactDoctorWorkflow(packageDirectory).status).toBe("exists");
      expect(readReactDoctorWorkflow(packageDirectory)?.content).toContain("custom: preserve");
      expect(upgradeReactDoctorWorkflowInPlace(packageDirectory).status).toBe("upgraded");
      expect(fs.readFileSync(result.workflowPath, "utf8")).toBe(
        "custom: preserve\nuses: millionco/react-doctor@v2\n",
      );
      expect(fs.existsSync(path.join(packageDirectory, ".github"))).toBe(false);
    } finally {
      fs.rmSync(repositoryRoot, { recursive: true, force: true });
    }
  });

  it("warns when there is no git repository", () => {
    const directoryWithoutRepository = fs.mkdtempSync(path.join(tmpdir(), "react-doctor-no-git-"));

    try {
      const result = installReactDoctorWorkflow(directoryWithoutRepository, "main");

      expect(result.status).toBe("failed");
      expect(result.error).toBe("no-git-root");
    } finally {
      fs.rmSync(directoryWithoutRepository, { recursive: true, force: true });
    }
  });
});
