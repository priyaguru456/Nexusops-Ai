import React from "react";
import ReactMarkdown from "react-markdown";
import { CitationChip } from "./CitationChip";
import type { Citation } from "../../types/ai";

interface MarkdownRendererProps {
  content: string;
  citations?: Citation[] | null;
  onSelectCitation?: (citation: Citation, index: number) => void;
}

/**
 * Pre-processes markdown text by converting valid [n] citation markers into
 * special citation links [__CITATION_n__](#citation-n).
 * Markers that do not exist in the citations array are preserved as plain text.
 * Code blocks and inline code are protected so markers inside code are unaffected.
 */
function preprocessMarkdownCitations(content: string, citations?: Citation[] | null): string {
  if (!content || !citations || citations.length === 0) {
    return content || "";
  }

  // Split on code fences and inline backticks
  const tokens = content.split(/(```[\s\S]*?```|`[^`\n]+`)/g);

  return tokens
    .map((token) => {
      // Don't modify code blocks or inline code
      if (token.startsWith("```") || (token.startsWith("`") && token.endsWith("`"))) {
        return token;
      }

      // Replace [n] only when a corresponding citation exists in the array (1-indexed)
      return token.replace(/\[(\d+)\]/g, (match, numStr) => {
        const n = parseInt(numStr, 10);
        if (n >= 1 && n <= citations.length && citations[n - 1]) {
          return `[__CITATION_${n}__](#citation-${n})`;
        }
        return match;
      });
    })
    .join("");
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  citations = [],
  onSelectCitation,
}) => {
  const processedContent = preprocessMarkdownCitations(content, citations);

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed break-words space-y-2">
      <ReactMarkdown
        components={{
          // Intercept citation links to render custom CitationChip
          a: ({ href, children, ...props }) => {
            if (href?.startsWith("#citation-") && onSelectCitation && citations) {
              const numStr = href.replace("#citation-", "");
              const n = parseInt(numStr, 10);
              const citation = citations[n - 1];
              if (citation) {
                return (
                  <CitationChip
                    citationNumber={n}
                    citation={citation}
                    onClick={() => onSelectCitation(citation, n - 1)}
                  />
                );
              }
            }

            // Normal markdown links
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 dark:text-indigo-400 font-medium underline underline-offset-2 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
                {...props}
              >
                {children}
              </a>
            );
          },

          // Paragraph styling
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,

          // Headings
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-4 mb-2 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-3 mb-1.5 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-2 mb-1 first:mt-0">
              {children}
            </h3>
          ),

          // Lists
          ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,

          // Blockquote
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-indigo-500 pl-3 my-2 italic text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 py-1 rounded-r">
              {children}
            </blockquote>
          ),

          // Code blocks & inline code
          code: ({ className, children, ...props }) => {
            const isInline = !className && typeof children === "string" && !children.includes("\n");
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre className="p-3 my-2 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto border border-slate-800 leading-normal">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          },

          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 font-semibold text-slate-900 dark:text-slate-100 text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              {children}
            </td>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};
