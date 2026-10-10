import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // playground-*.mongodb.js files are MongoDB VS Code scratch files, not app code.
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "playground-*.mongodb.js"] },
];

export default eslintConfig;
