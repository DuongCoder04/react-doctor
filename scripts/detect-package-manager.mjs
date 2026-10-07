import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const PACKAGE_MANAGER_LOCKFILES = [
  { name: "pnpm", lockfile: "pnpm-lock.yaml" },
  { name: "yarn", lockfile: "yarn.lock" },
  { name: "bun", lockfile: "bun.lockb" },
  { name: "bun", lockfile: "bun.lock" },
  { name: "npm", lockfile: "package-lock.json" },
];

const readPackageJson = (directory) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"));
  } catch {
    return null;
  }
};

const getProjectDirectories = (projectDirectory) => {
  const directories = [];
  let directory = path.resolve(projectDirectory);
  while (true) {
    directories.push(directory);
    const parentDirectory = path.dirname(directory);
    if (parentDirectory === directory || fs.existsSync(path.join(directory, ".git"))) break;
    directory = parentDirectory;
  }
  return directories;
};

export const detectPackageManager = (projectDirectory) => {
  const directories = getProjectDirectories(projectDirectory);
  for (const directory of directories) {
    const packageJson = readPackageJson(directory);
    const declaredManager = packageJson?.packageManager;
    const managerName =
      typeof declaredManager === "string"
        ? declaredManager.split("@")[0]
        : packageJson?.devEngines?.packageManager?.name;
    if (PACKAGE_MANAGER_LOCKFILES.some((manager) => manager.name === managerName))
      return managerName;
  }
  for (const directory of directories) {
    const manager = PACKAGE_MANAGER_LOCKFILES.find(({ lockfile }) =>
      fs.existsSync(path.join(directory, lockfile)),
    );
    if (manager) return manager.name;
  }
  return "npm";
};

export const hasReactDoctorInstalled = (projectDirectory) => {
  const directories = getProjectDirectories(projectDirectory);
  const hasDependency = directories.some((directory) => {
    const packageJson = readPackageJson(directory);
    return Boolean(
      packageJson?.dependencies?.["react-doctor"] || packageJson?.devDependencies?.["react-doctor"],
    );
  });
  return (
    hasDependency &&
    directories.some(
      (directory) =>
        fs.existsSync(path.join(directory, "node_modules", ".bin", "react-doctor")) ||
        fs.existsSync(path.join(directory, "node_modules", ".bin", "react-doctor.cmd")) ||
        fs.existsSync(path.join(directory, ".pnp.cjs")),
    )
  );
};

const main = () => {
  const projectDirectory = process.argv[2] || ".";
  const outputs = {
    "package-manager": detectPackageManager(projectDirectory),
    "has-installed": String(hasReactDoctorInstalled(projectDirectory)),
  };
  const rendered =
    Object.entries(outputs)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n") + "\n";
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, rendered);
  else process.stdout.write(rendered);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
