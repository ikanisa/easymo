import type { Config } from "tailwindcss";
import { tailwindPreset } from "./src/tokens/tailwind";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./storybook.tailwind.css"],
  presets: [tailwindPreset],
};

export default config;
