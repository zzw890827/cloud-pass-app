"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Components } from "react-markdown";

interface MarkdownRendererProps {
  content: string;
  /** Compact mode for option text — renders inline without wrapping <p> */
  compact?: boolean;
}

const sharedComponents: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || "");
    const codeString = String(children).replace(/\n$/, "");

    if (match) {
      return (
        <SyntaxHighlighter
          style={oneLight}
          language={match[1]}
          PreTag="div"
          customStyle={{ fontSize: "0.8rem", borderRadius: "0.5rem" }}
        >
          {codeString}
        </SyntaxHighlighter>
      );
    }

    return (
      <code className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
        {children}
      </code>
    );
  },
  img({ src, alt }) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt || ""}
        className="max-w-full h-auto rounded-lg my-2"
        loading="lazy"
      />
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full text-sm border-collapse border border-gray-300">
          {children}
        </table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-gray-300 bg-gray-100 px-3 py-1.5 text-left font-semibold">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border border-gray-300 px-3 py-1.5">
        {children}
      </td>
    );
  },
};

/** Compact mode: unwrap <p> into <span> to keep inline layout */
const compactComponents: Components = {
  ...sharedComponents,
  p({ children }) {
    return <span>{children}</span>;
  },
};

const fullComponents: Components = {
  ...sharedComponents,
  p({ children }) {
    return <p className="mb-2 last:mb-0">{children}</p>;
  },
  ul({ children }) {
    return <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-4 border-gray-300 pl-3 my-2 text-gray-600 italic">
        {children}
      </blockquote>
    );
  },
};

export default function MarkdownRenderer({ content, compact = false }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={compact ? compactComponents : fullComponents}
    >
      {content}
    </ReactMarkdown>
  );
}
