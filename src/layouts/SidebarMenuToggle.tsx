import React, { useContext, ReactNode } from "react";
import { AccordionContext, useAccordionButton, Nav } from "react-bootstrap";
import useMenu from "hooks/useMenu";
import { IconChevronDown } from "@tabler/icons-react";

interface CustomToggleProps {
  children: ReactNode;
  eventKey: string;
  className?: string;
  href?: string;
  dataBsTarget?: string;
  ariaControls?: string;
  icon?: ReactNode;
  theme?: { bg: string; color: string; borderColor?: string };
  callback?: (eventKey: string) => void;
}

export default function CustomToggle({
  children,
  eventKey,
  icon,
  theme,
  callback,
}: CustomToggleProps) {
  const { activeEventKey } = useContext(AccordionContext);
  const { collapsed, handleCollapsed } = useMenu();
  const decoratedOnClick = useAccordionButton(
    eventKey,
    () => callback && callback(eventKey)
  );

  const isCurrentEventKey = activeEventKey === eventKey;

  return (
    <Nav.Item as="li" className={`dropdown sidebar-parent-item ${isCurrentEventKey ? "is-open" : ""}`}>
      <Nav.Link
        href="#"
        onClick={(e) => {
          e.preventDefault();
          if (collapsed === "collapsed") {
            handleCollapsed("expanded");
          }
          decoratedOnClick(e);
        }}
        data-bs-toggle="dropdown"
        aria-expanded={isCurrentEventKey}
        className={`sidebar-menu-btn d-flex align-items-center w-100 ${isCurrentEventKey ? "menu-open" : ""}`}
      >
        {icon && (
          <span
            className="sidebar-icon-pill d-inline-flex align-items-center justify-content-center flex-shrink-0"
            style={{
              backgroundColor: theme?.bg || "#f1f5f9",
              color: theme?.color || "#475569",
              border: `1px solid ${theme?.borderColor || "transparent"}`,
            }}
          >
            {icon}
          </span>
        )}
        <span className="sidebar-menu-title text flex-grow-1 text-truncate">{children}</span>
        <span
          className="sidebar-chevron ms-auto d-inline-flex align-items-center justify-content-center"
          style={{
            transform: isCurrentEventKey ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
            color: isCurrentEventKey ? "#334155" : "#94a3b8",
          }}
        >
          <IconChevronDown size={16} strokeWidth={2.2} />
        </span>
      </Nav.Link>
    </Nav.Item>
  );
}

export function CustomToggleLevel2({
  children,
  eventKey,
  className = "sidebar-level2-btn py-1.5 px-2.5 d-flex align-items-center justify-content-between text-decoration-none",
  href = "#",
  dataBsTarget = "",
  ariaControls = "",
}: CustomToggleProps) {
  const { activeEventKey } = useContext(AccordionContext);
  const { collapsed, handleCollapsed } = useMenu();
  const decoratedOnClick = useAccordionButton(eventKey);
  const isCurrentEventKey = activeEventKey === eventKey;

  return (
    <a
      href={href}
      className={`${className} ${isCurrentEventKey ? "level2-open" : ""}`}
      onClick={(e) => {
        e.preventDefault();
        if (collapsed === "collapsed") {
          handleCollapsed("expanded");
        }
        decoratedOnClick(e);
      }}
      data-bs-toggle="collapse"
      data-bs-target={dataBsTarget}
      aria-expanded={isCurrentEventKey}
      aria-controls={ariaControls}
      style={{ cursor: "pointer", textDecoration: "none" }}
    >
      <span className="text text-truncate">{children}</span>
      <span
        className="dropdown-arrow ms-auto d-inline-flex align-items-center opacity-75"
        style={{
          transform: isCurrentEventKey ? "rotate(90deg)" : "rotate(0deg)",
          transition: "transform 0.2s ease-in-out",
        }}
      >
        <IconChevronDown size={14} strokeWidth={2.2} />
      </span>
    </a>
  );
}
