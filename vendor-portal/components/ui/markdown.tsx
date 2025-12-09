"use client";

import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';

interface MarkdownProps {
  children: string;
  className?: string;
  theme?: 'dark' | 'light' | 'auto';
}

export function Markdown({ children, className, theme = 'auto' }: MarkdownProps) {
  const isDark = theme === 'dark' || (theme === 'auto' && 
    typeof window !== 'undefined' && 
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  const components: Components = {
    // Headings
    h1: ({ children, ...props }) => (
      <h1 className="text-2xl font-bold mt-6 mb-4 text-text-primary" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-xl font-semibold mt-5 mb-3 text-text-primary" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="text-lg font-semibold mt-4 mb-2 text-text-primary" {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, ...props }) => (
      <h4 className="text-base font-semibold mt-3 mb-2 text-text-primary" {...props}>
        {children}
      </h4>
    ),
    h5: ({ children, ...props }) => (
      <h5 className="text-sm font-semibold mt-2 mb-1 text-text-primary" {...props}>
        {children}
      </h5>
    ),
    h6: ({ children, ...props }) => (
      <h6 className="text-xs font-semibold mt-2 mb-1 text-text-secondary" {...props}>
        {children}
      </h6>
    ),

    // Paragraph
    p: ({ children, ...props }) => (
      <p className="my-2 text-text-primary leading-relaxed" {...props}>
        {children}
      </p>
    ),

    // Links
    a: ({ href, children, ...props }) => (
      <a
        href={href}
        className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline underline-offset-2 transition-colors"
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        {...props}
      >
        {children}
      </a>
    ),

    // Lists
    ul: ({ children, ...props }) => (
      <ul className="my-3 ml-6 list-disc space-y-1 text-text-primary" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="my-3 ml-6 list-decimal space-y-1 text-text-primary" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="leading-relaxed" {...props}>
        {children}
      </li>
    ),

    // Blockquote
    blockquote: ({ children, ...props }) => (
      <blockquote 
        className="my-3 pl-4 border-l-4 border-primary-500 bg-primary-50 dark:bg-primary-900/20 py-2 pr-4 text-text-secondary italic"
        {...props}
      >
        {children}
      </blockquote>
    ),

    // Code
    code: ({ inline, className, children, ...props }) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';

      return !inline && language ? (
        <SyntaxHighlighter
          style={isDark ? oneDark : oneLight}
          language={language}
          PreTag="div"
          className="my-3 rounded-lg overflow-hidden text-sm"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code
          className={cn(
            "px-1.5 py-0.5 rounded bg-surface-overlay text-primary-600 dark:text-primary-400 font-mono text-sm",
            className
          )}
          {...props}
        >
          {children}
        </code>
      );
    },

    // Pre (for code blocks without language)
    pre: ({ children, ...props }) => (
      <pre 
        className="my-3 p-4 rounded-lg bg-surface-overlay overflow-x-auto text-sm font-mono"
        {...props}
      >
        {children}
      </pre>
    ),

    // Table
    table: ({ children, ...props }) => (
      <div className="my-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-border-default" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }) => (
      <thead className="bg-surface-overlay" {...props}>
        {children}
      </thead>
    ),
    tbody: ({ children, ...props }) => (
      <tbody className="divide-y divide-border-default bg-surface-elevated" {...props}>
        {children}
      </tbody>
    ),
    tr: ({ children, ...props }) => (
      <tr {...props}>
        {children}
      </tr>
    ),
    th: ({ children, ...props }) => (
      <th 
        className="px-4 py-2 text-left text-xs font-semibold text-text-primary uppercase tracking-wider"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="px-4 py-2 text-sm text-text-primary" {...props}>
        {children}
      </td>
    ),

    // Horizontal rule
    hr: ({ ...props }) => (
      <hr className="my-6 border-border-default" {...props} />
    ),

    // Strong/Bold
    strong: ({ children, ...props }) => (
      <strong className="font-semibold text-text-primary" {...props}>
        {children}
      </strong>
    ),

    // Emphasis/Italic
    em: ({ children, ...props }) => (
      <em className="italic text-text-secondary" {...props}>
        {children}
      </em>
    ),

    // Delete/Strikethrough
    del: ({ children, ...props }) => (
      <del className="line-through text-text-muted" {...props}>
        {children}
      </del>
    ),

    // Input (checkbox)
    input: ({ type, checked, ...props }) => {
      if (type === 'checkbox') {
        return (
          <input
            type="checkbox"
            checked={checked}
            disabled
            className="mr-2 rounded border-border-default"
            {...props}
          />
        );
      }
      return <input type={type} {...props} />;
    },
  };

  return (
    <div className={cn("markdown-content", className)}>
      <ReactMarkdown
        components={components}
        remarkPlugins={[remarkGfm, remarkBreaks]}
        skipHtml={true} // Security: Don't render HTML
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
