import React from "react";

/**
 * Regex özel karakterlerini kaçış karakteriyle çevreler
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Metin veya ReactNode düğümleri içindeki arama terimi eşleşmelerini
 * sarı arka plan (#fef08a) ile işaretler (vurgular).
 */
export function highlightText(content: React.ReactNode, searchTerm?: string | null): React.ReactNode {
  if (!searchTerm || !searchTerm.trim() || content === null || content === undefined) {
    return content;
  }

  const term = searchTerm.trim();
  if (typeof content === "string" || typeof content === "number") {
    const text = String(content);
    if (!text) return content;

    const escaped = escapeRegExp(term);
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(regex);

    if (parts.length <= 1) return content;

    return parts.map((part, i) => {
      if (regex.test(part)) {
        return (
          <mark
            key={i}
            style={{
              backgroundColor: "#fef08a",
              color: "#713f12",
              padding: "0 2px",
              margin: "0 1px",
              borderRadius: "3px",
              fontWeight: 700,
              boxShadow: "0 0 0 1px #eab308",
            }}
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  }

  if (React.isValidElement(content)) {
    const el = content as React.ReactElement<any>;
    const children = el.props?.children;
    if (children !== undefined && children !== null) {
      if (Array.isArray(children)) {
        return React.cloneElement(el, {
          ...el.props,
          children: children.map((child, idx) => (
            <React.Fragment key={idx}>{highlightText(child, term)}</React.Fragment>
          )),
        });
      }
      return React.cloneElement(el, {
        ...el.props,
        children: highlightText(children, term),
      });
    }
  }

  return content;
}

export const HighlightText: React.FC<{ text: React.ReactNode; search?: string | null }> = ({ text, search }) => {
  return <>{highlightText(text, search)}</>;
};

export default HighlightText;
