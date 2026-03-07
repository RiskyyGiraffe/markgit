import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

// Get the true filesystem casing for the monorepo root so webpack
// doesn't treat "Projects" and "projects" as different modules on Windows.
const webDir = fs.realpathSync.native(process.cwd());
const monoRoot = fs.realpathSync.native(path.resolve(webDir, "../.."));

const nextConfig: NextConfig = {
  transpilePackages: ["@tolty/sdk", "@tolty/api"],
  webpack: (config, { isServer }) => {
    // Resolve .js imports to .ts files in workspace packages (ESM TypeScript)
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };

    // Fix Windows path-casing: normalise every resolved module path so
    // "C:\Users\Ryan-CCG\Projects\tolty" and "C:\Users\Ryan-CCG\projects\tolty"
    // collapse to the single real-cased path.
    class WinCaseNormalizePlugin {
      apply(resolver: any) {
        resolver.hooks.result.tap("WinCaseNormalizePlugin", (result: any) => {
          if (result?.path && typeof result.path === "string") {
            // Replace any casing variant of the monorepo root with the real one
            const lower = result.path.toLowerCase();
            const rootLower = monoRoot.toLowerCase();
            if (lower.startsWith(rootLower)) {
              result.path = monoRoot + result.path.slice(monoRoot.length);
            }
          }
          return result;
        });
      }
    }

    config.resolve.plugins = config.resolve.plugins || [];
    config.resolve.plugins.push(new WinCaseNormalizePlugin());

    return config;
  },
};

export default nextConfig;
