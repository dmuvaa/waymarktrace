import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "maplibre-gl", "dist");
const destination = join(root, "public", "maplibre");

await mkdir(destination, { recursive: true });
await Promise.all(
  ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"].map((file) =>
    copyFile(join(source, file), join(destination, file)),
  ),
);
