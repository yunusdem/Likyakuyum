import React from "react";
import { Form, InputGroup, Button, FormControlProps } from "react-bootstrap";
import { IconBinoculars } from "@tabler/icons-react";

export interface CodeLookupInputProps extends FormControlProps {
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLookupClick?: () => void;
  canLookup?: boolean;
  lookupTitle?: string;
  name?: string;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  isInvalid?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
}

export const CodeLookupInput: React.FC<CodeLookupInputProps> = ({
  value,
  onChange,
  onLookupClick,
  canLookup = true,
  lookupTitle = "Kayıt Seçimi / Kod Arama",
  name,
  id,
  placeholder,
  disabled = false,
  required = false,
  isInvalid = false,
  autoFocus = false,
  maxLength,
  ...props
}) => {
  return (
    <InputGroup className="w-100">
      <Form.Control
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        isInvalid={isInvalid}
        autoFocus={autoFocus}
        maxLength={maxLength}
        className="font-monospace"
        {...props}
      />
      {canLookup && onLookupClick && (
        <Button
          variant="outline-secondary"
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onLookupClick();
          }}
          title={lookupTitle}
          aria-label={lookupTitle}
          className="d-flex align-items-center justify-content-center px-2.5 bg-light border-start-0"
          style={{ borderColor: "#ced4da" }}
        >
          {/* Oklu Dürbün İkonu */}
          <span className="d-inline-flex align-items-center gap-1 text-primary">
            <IconBinoculars size={18} strokeWidth={2} />
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        </Button>
      )}
    </InputGroup>
  );
};

export default CodeLookupInput;
