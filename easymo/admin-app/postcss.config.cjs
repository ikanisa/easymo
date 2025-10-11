const tailwindcss = require("tailwindcss");
const postcssFlexbugsFixes = require(
  "next/dist/compiled/postcss-flexbugs-fixes",
);
const postcssPresetEnv = require("next/dist/compiled/postcss-preset-env");

module.exports = {
  // Mirror Next.js' default PostCSS pipeline to keep CSS module support without custom config warnings.
  plugins: [
    tailwindcss,
    postcssFlexbugsFixes,
    postcssPresetEnv({
      autoprefixer: { flexbox: "no-2009" },
      stage: 3,
      features: {
        "custom-properties": false,
      },
    }),
  ],
};
