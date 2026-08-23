import fs from "fs";
import path from "path";

function findRouteFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return findRouteFiles(fullPath);
    }

    return entry.isFile() && entry.name === "route.ts"
      ? [fullPath]
      : [];
  });
}

describe("admin API authorization boundary", () => {
  it("requires withRole(admin) on every admin route", () => {
    const adminRoot = path.join(
      process.cwd(),
      "src",
      "app",
      "api",
      "admin",
    );

    const routes = findRouteFiles(adminRoot);

    expect(routes.length).toBeGreaterThan(0);

    for (const route of routes) {
      const source = fs.readFileSync(route, "utf8");

      expect({
        route: path.relative(process.cwd(), route),
        protected: /withRole\s*\(\s*["']admin["']\s*\)/.test(source),
      }).toEqual({
        route: path.relative(process.cwd(), route),
        protected: true,
      });
    }
  });
});
