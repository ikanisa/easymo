import type { Preview } from "@storybook/react";
import "../tokens/styles.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "surface",
      values: [
        { name: "surface", value: "rgb(248, 250, 252)" },
        { name: "midnight", value: "rgb(15, 23, 42)" },
      ],
    },
    controls: { expanded: true },
    a11y: {
      config: {
        rules: [{ id: "color-contrast", enabled: true }],
      },
    },
  },
};

export default preview;
