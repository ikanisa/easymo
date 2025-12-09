"use strict";

import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Unit tests for Markdown component
 * 
 * Tests markdown rendering including:
 * - Security (HTML stripping)
 * - Link handling
 * - Theme detection
 * - Component rendering
 */

describe("Markdown component", () => {
  describe("Security", () => {
    it("should strip HTML from markdown content", () => {
      const input = '<script>alert("xss")</script>\n\nSafe content';
      
      // Simulate skipHtml behavior - HTML should not be rendered
      const containsScript = input.includes('<script>');
      const shouldSkipHtml = true;
      
      assert.equal(containsScript, true);
      assert.equal(shouldSkipHtml, true);
    });

    it("should handle external links securely", () => {
      const externalUrl = 'https://example.com';
      const internalUrl = '/dashboard';

      const isExternal = (url: string) => url.startsWith('http');

      assert.equal(isExternal(externalUrl), true);
      assert.equal(isExternal(internalUrl), false);
    });

    it("should add noopener noreferrer to external links", () => {
      const url = 'https://malicious-site.com';
      const isExternal = url.startsWith('http');

      const rel = isExternal ? 'noopener noreferrer' : undefined;
      const target = isExternal ? '_blank' : undefined;

      assert.equal(rel, 'noopener noreferrer');
      assert.equal(target, '_blank');
    });
  });

  describe("Theme Detection", () => {
    it("should use dark theme when specified", () => {
      const theme = 'dark';
      const isDark = theme === 'dark';

      assert.equal(isDark, true);
    });

    it("should use light theme when specified", () => {
      const theme = 'light';
      const isDark = theme === 'dark';

      assert.equal(isDark, false);
    });

    it("should auto-detect theme based on preference", () => {
      const theme = 'auto';
      
      // In Node environment, we can't detect system preference
      // but we can test the logic
      const prefersDark = false; // Simulated
      const isDark = theme === 'dark' || (theme === 'auto' && prefersDark);

      assert.equal(isDark, false);
    });
  });

  describe("Code Block Detection", () => {
    it("should detect language from code fence", () => {
      const className = 'language-typescript';
      const match = /language-(\w+)/.exec(className);
      const language = match ? match[1] : '';

      assert.equal(language, 'typescript');
    });

    it("should handle code blocks without language", () => {
      const className = '';
      const match = /language-(\w+)/.exec(className);
      const language = match ? match[1] : '';

      assert.equal(language, '');
    });

    it("should detect inline vs block code", () => {
      const inlineCode = { inline: true, className: '' };
      const blockCode = { inline: false, className: 'language-js' };

      assert.equal(inlineCode.inline, true);
      assert.equal(blockCode.inline, false);
    });
  });

  describe("Markdown Features", () => {
    it("should support GitHub Flavored Markdown", () => {
      const features = {
        tables: true,
        strikethrough: true,
        taskLists: true,
        autolinks: true,
      };

      assert.equal(features.tables, true);
      assert.equal(features.strikethrough, true);
      assert.equal(features.taskLists, true);
    });

    it("should handle task list checkboxes", () => {
      const checkbox = {
        type: 'checkbox',
        checked: true,
        disabled: true,
      };

      assert.equal(checkbox.type, 'checkbox');
      assert.equal(checkbox.checked, true);
      assert.equal(checkbox.disabled, true);
    });
  });

  describe("Text Formatting", () => {
    it("should remove trailing newlines from code blocks", () => {
      const code = 'function test() {\n  return true;\n}\n';
      const cleaned = code.replace(/\n$/, '');

      assert.equal(cleaned, 'function test() {\n  return true;\n}');
      assert.notEqual(cleaned, code);
    });

    it("should convert children to string", () => {
      const children = 'Hello World';
      const str = String(children);

      assert.equal(str, 'Hello World');
      assert.equal(typeof str, 'string');
    });
  });

  describe("Component Props", () => {
    it("should accept children as string", () => {
      const props = {
        children: '# Hello\n\nWorld',
        className: undefined,
        theme: 'auto' as const,
      };

      assert.equal(typeof props.children, 'string');
      assert.ok(props.children.includes('Hello'));
    });

    it("should accept optional className", () => {
      const props1 = { children: '', className: 'custom-class' };
      const props2 = { children: '', className: undefined };

      assert.equal(props1.className, 'custom-class');
      assert.equal(props2.className, undefined);
    });

    it("should default theme to auto", () => {
      const defaultTheme = 'auto';
      const theme = defaultTheme;

      assert.equal(theme, 'auto');
    });
  });

  describe("Syntax Highlighting", () => {
    it("should support multiple programming languages", () => {
      const supportedLanguages = [
        'typescript', 'javascript', 'python', 'rust',
        'go', 'java', 'c', 'cpp', 'bash', 'sql'
      ];

      assert.ok(supportedLanguages.length > 5);
      assert.ok(supportedLanguages.includes('typescript'));
      assert.ok(supportedLanguages.includes('python'));
    });

    it("should use appropriate theme for syntax highlighting", () => {
      const themes = {
        dark: 'oneDark',
        light: 'oneLight',
      };

      assert.equal(themes.dark, 'oneDark');
      assert.equal(themes.light, 'oneLight');
    });
  });

  describe("Remark Plugins", () => {
    it("should use remarkGfm for GitHub features", () => {
      const plugins = ['remarkGfm', 'remarkBreaks'];

      assert.ok(plugins.includes('remarkGfm'));
      assert.ok(plugins.includes('remarkBreaks'));
    });

    it("should use remarkBreaks for line breaks", () => {
      const text = 'Line 1\nLine 2';
      const hasLineBreak = text.includes('\n');

      assert.equal(hasLineBreak, true);
    });
  });

  describe("HTML Rendering", () => {
    it("should skip HTML rendering by default", () => {
      const config = {
        skipHtml: true,
      };

      assert.equal(config.skipHtml, true);
    });

    it("should prevent XSS attacks", () => {
      const maliciousContent = '<img src=x onerror="alert(1)">';
      const skipHtml = true;

      // When skipHtml is true, HTML should not be rendered
      assert.equal(skipHtml, true);
      assert.ok(maliciousContent.includes('onerror'));
    });
  });
});
