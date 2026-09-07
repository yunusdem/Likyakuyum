import { useContext, ReactNode } from "react";
import { AccordionContext, useAccordionButton, Nav } from "react-bootstrap";

interface CustomToggleProps {
  children: ReactNode;
  eventKey: string;
  className?: string;
  href?: string;
  dataBsTarget?: string;
  ariaControls?: string;
  icon?: ReactNode;
  callback?: (eventKey: string) => void;
}

export default function CustomToggle({
  children,
  eventKey,
  icon,
  callback,
}: CustomToggleProps) {
  const { activeEventKey } = useContext(AccordionContext);
  const decoratedOnClick = useAccordionButton(
    eventKey,
    () => callback && callback(eventKey)
  );

  const isCurrentEventKey = activeEventKey === eventKey;
  return (
    <Nav.Item as="li" className="dropdown">
      <Nav.Link
        href="#"
        onClick={(e) => {
          e.preventDefault();
          decoratedOnClick(e);
        }}
        data-bs-toggle="dropdown"
        aria-expanded={isCurrentEventKey ? true : false}
        className="dropdown-toggle d-flex align-items-center"
      >
        {icon && (
          <span className="nav-icon me-2 d-inline-flex align-items-center justify-content-center">
            {icon}
          </span>
        )}
        <span className="text">{children}</span>
      </Nav.Link>

    </Nav.Item>
  );
}

export function CustomToggleLevel2({
  children,
  eventKey,
  className = "nav-link py-1 px-3 d-flex align-items-center justify-content-between",
  href = "#",
  dataBsTarget = "",
  ariaControls = "",
}: CustomToggleProps) {
  const { activeEventKey } = useContext(AccordionContext);
  const decoratedOnClick = useAccordionButton(eventKey);
  const isCurrentEventKey = activeEventKey === eventKey;

  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        decoratedOnClick(e);
      }}
      data-bs-toggle="collapse"
      data-bs-target={dataBsTarget}
      aria-expanded={isCurrentEventKey}
      aria-controls={ariaControls}
      style={{ cursor: "pointer", textDecoration: "none" }}
    >
      <span className="text">{children}</span>
      <span className="dropdown-arrow ms-auto d-inline-flex align-items-center opacity-75">
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isCurrentEventKey ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease-in-out",
          }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
    </a>
  );
}
