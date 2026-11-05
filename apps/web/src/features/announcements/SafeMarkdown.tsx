import React from "react";
import ReactMarkdown from "react-markdown";

interface SafeMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Validates URLs to strictly allow safe web protocols (http, https, mailto, relative)
 * and prevent dangerous schemes such as javascript:, data:, or vbscript:.
 */
function safeUrlTransform(url: string): string {
  const trimmed = url.trim();
  if (
    /^(https?|mailto|tel):/i.test(trimmed) ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  return "";
}

export const SafeMarkdown: React.FC<SafeMarkdownProps> = ({ content, className = "" }) => {
  if (!content) return null;

  return (
    <div
      className={`prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed break-words ${className}`}
    >
      <ReactMarkdown
        urlTransform={safeUrlTransform}
        components={{
          // Safe Anchor
          a: ({ href, children, ...props }) => {
            const isExternal = href?.startsWith("http");
            return (
              <a
                href={href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="text-indigo-600 dark:text-indigo-400 font-semibold underline underline-offset-2 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500 rounded-xs"
                {...props}
              >
                {children}
              </a>
            );
          },

          // Paragraph
          p: ({ children }) => (
            <p className="mb-3 last:mb-0 leading-relaxed text-slate-700 dark:text-slate-300">
              {children}
            </p>
          ),

          // Headings
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-5 mb-2.5 first:mt-0 tracking-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-4 mb-2 first:mt-0 tracking-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-3 mb-1.5 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-2.5 mb-1 first:mt-0">
              {children}
            </h4>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="list-disc pl-5 my-2.5 space-y-1.5 text-slate-700 dark:text-slate-300">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 my-2.5 space-y-1.5 text-slate-700 dark:text-slate-300">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,

          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-indigo-500/80 dark:border-indigo-400 pl-4 py-1.5 my-3 italic text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 rounded-r-lg">
              {children}
            </blockquote>
          ),

          // Code
          code: ({ className, children, ...props }) => {
            const isInline = !className && typeof children === "string" && !children.includes("\n");
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded text-xs font-mono bg-slate-100 dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-slate-700/60"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre className="p-3.5 my-3 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto border border-slate-800 leading-normal">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          },

          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-850 font-semibold text-slate-900 dark:text-slate-100 text-left border-b border-slate-200 dark:border-slate-800">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2 border-t border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              {children}
            </td>
          ),

          // Horizontal rule
          hr: () => <hr className="my-4 border-slate-200 dark:border-slate-800" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
