import "../styles.css";
import "../storybook.tailwind.css";

import type { Decorator, Preview } from "@storybook/react";
import { useEffect } from "react";

const withUiTokens: Decorator = (Story) => {
  useEffect(() => {
    document.body.setAttribute("data-ui-theme", "dark");
    document.documentElement.classList.add("dark");
    return () => {
      document.documentElement.classList.remove("dark");
      document.body.removeAttribute("data-ui-theme");
    };
  }, []);

  return (
    <div className="min-h-screen bg-[color:var(--ui-color-background)] p-6 text-[color:var(--ui-color-foreground)]">
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withUiTokens],
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: {
      default: "UI Background",
      values: [
        {
          name: "UI Background",
          value: "#070B1A",
        },
        {
          name: "Surface",
          value: "#0F172A",
        },
      ],
    },
    a11y: {
      element: "#storybook-root",
      config: {},
    },
  },
};

export default preview;
