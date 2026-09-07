import React, { Fragment } from "react";
import { Link } from "react-router-dom";
import { Dropdown } from "react-bootstrap";

interface CustomToggleProps {
  children: React.ReactNode;
  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

interface ActionMenuProps {
  toggleButton: React.ReactNode;
  className?: string;
  align?: "start" | "end";
  drop?: "up" | "up-centered" | "start" | "end" | "down" | "down-centered";
  menuItems?: Array<{ link: string; menuItem: string; icon?: React.ReactNode }>;
  itemClass?: string;
  children?: React.ReactNode;
  size?: "sm" | "lg" | undefined;
  variant?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

const ActionMenu: React.FC<ActionMenuProps> = ({
  toggleButton,
  className,
  align = "end",
  drop = "start",
  menuItems = [],
  itemClass,
  children,
  size,
  variant,
  onClick,
}) => {
  const CustomToggle = React.forwardRef<HTMLAnchorElement, CustomToggleProps>(
    ({ children, onClick }, ref) => (
      <a
        ref={ref}
        href="#action"
        onClick={(e) => {
          e.preventDefault();
          onClick(e);
        }}
        className={className}
      >
        {children}
      </a>
    )
  );

  CustomToggle.displayName = "CustomToggle";

  return (
    <Dropdown drop={drop}>
      <Dropdown.Toggle variant={variant} size={size} as={CustomToggle}>
        {toggleButton}
      </Dropdown.Toggle>
      <Dropdown.Menu align={align}>
        {menuItems.length > 0 ? (
          menuItems.map((item, index) => (
            <Dropdown.Item
              key={index}
              as={Link}
              to={item.link}
              className={itemClass}
              onClick={onClick}
            >
              {item.icon ? item.icon : ""}
              {item.menuItem}
            </Dropdown.Item>
          ))
        ) : (
          <Fragment>{children}</Fragment>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default ActionMenu;
