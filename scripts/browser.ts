import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright-core";

async function pathIfExists(path: string) {
  try {
    await access(path);
    return path;
  } catch {
    return undefined;
  }
}

export async function launchBrowser(): Promise<Browser> {
  const localLibs = fileURLToPath(
    new URL("../.browser-libs/root/usr/lib/x86_64-linux-gnu", import.meta.url),
  );
  const localFonts = fileURLToPath(
    new URL("../.browser-libs/fonts.conf", import.meta.url),
  );

  const libraryPath = [await pathIfExists(localLibs), process.env.LD_LIBRARY_PATH]
    .filter(Boolean)
    .join(":");
  const fontConfig = await pathIfExists(localFonts);

  return chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    env: {
      ...process.env,
      ...(libraryPath ? { LD_LIBRARY_PATH: libraryPath } : {}),
      ...(fontConfig ? { FONTCONFIG_FILE: fontConfig } : {}),
    },
  });
}
