# LiveSet Redesign — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the design system foundation — CSS custom property tokens, fonts, and a complete library of reusable UI primitives — without changing any existing page visually yet.

**Architecture:** A new `src/ui/` directory holds tokens, fonts, and primitive components. Each primitive is a small, focused React component that consumes tokens via CSS variables. Existing pages remain untouched in this phase; they will adopt primitives in later phases. Tests use Jest + React Testing Library (already in `package.json`).

**Tech Stack:** React 18, CRA (react-scripts 5), Jest, @testing-library/react, @fontsource (new), CSS custom properties (no preprocessor).

---

## Source Spec

`docs/superpowers/specs/2026-04-28-liveset-redesign-design.md` — Phase 1 (Foundation), Section 3 (Tokens), Section 4 (Primitives).

## File Structure

```
src/ui/
├── tokens.css                 # All CSS custom properties (color, type, spacing, radius, motion)
├── fonts.css                  # @fontsource imports + global body font
├── index.js                   # Barrel export of all primitives
├── Button.js  / Button.css
├── IconButton.js / IconButton.css
├── Input.js / Input.css                # Input + Textarea + Select share styles
├── Card.js / Card.css
├── Modal.js / Modal.css
├── Sheet.js / Sheet.css
├── Tabs.js / Tabs.css
├── Chip.js / Chip.css
├── Avatar.js / Avatar.css
├── Toast.js / Toast.css                # Includes ToastProvider context
├── EmptyState.js / EmptyState.css
├── SectionHeader.js / SectionHeader.css
└── __tests__/
    ├── Button.test.js
    ├── Modal.test.js
    ├── Sheet.test.js
    ├── Tabs.test.js
    ├── Toast.test.js
    └── (others as called out per task)
```

`src/index.css` is modified once at the start to import `ui/tokens.css` and `ui/fonts.css`.

`App.js` is modified once at the end of Phase 1 to wrap the tree in `<ToastProvider>` and to replace `alert()` calls with `useToast()`.

---

## Task 1: Install fonts and create tokens.css

**Files:**
- Create: `src/ui/tokens.css`
- Create: `src/ui/fonts.css`
- Modify: `src/index.css` (add two imports at top)
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install font packages**

Run from repo root:

```bash
npm install @fontsource/inter @fontsource/jetbrains-mono
```

Expected: packages added to `dependencies` in `package.json`.

- [ ] **Step 2: Create `src/ui/fonts.css`**

```css
@import "@fontsource/inter/400.css";
@import "@fontsource/inter/500.css";
@import "@fontsource/inter/600.css";
@import "@fontsource/jetbrains-mono/500.css";
```

- [ ] **Step 3: Create `src/ui/tokens.css`**

```css
:root {
  /* Color */
  --bg: #0A0908;
  --surface-1: #141210;
  --surface-2: #1C1916;
  --border: #2A2622;
  --border-strong: #3A342E;
  --text: #F5EFE3;
  --text-muted: #A89F90;
  --text-dim: #6B6358;
  --accent: #D9C2A0;
  --accent-strong: #C9A77C;
  --danger: #C8553D;
  --success: #8FA66E;

  /* Typography */
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

  --fs-mono-micro: 0.6875rem;
  --fs-sm: 0.8125rem;
  --fs-body: 0.9375rem;
  --fs-lg: 1.0625rem;
  --fs-xl: 1.375rem;
  --fs-2xl: 1.875rem;
  --fs-display: 2.5rem;

  --lh-body: 1.5;
  --lh-heading: 1.2;
  --lh-mono: 1;

  --tracking-mono: 0.06em;

  /* Spacing (4px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 48px;
  --space-9: 64px;
  --space-10: 96px;

  /* Radius */
  --radius-xs: 2px;
  --radius-sm: 6px;
  --radius-md: 10px;

  /* Elevation */
  --elev-1: 0 1px 0 rgba(0, 0, 0, 0.4);

  /* Motion */
  --dur-micro: 120ms;
  --dur-std: 200ms;
  --dur-screen: 320ms;
  --ease-screen: cubic-bezier(0.2, 0.8, 0.2, 1);
}

/* Utility class for mono uppercase labels */
.mono-label {
  font-family: var(--font-mono);
  font-size: var(--fs-mono-micro);
  text-transform: uppercase;
  letter-spacing: var(--tracking-mono);
  line-height: var(--lh-mono);
  font-weight: 500;
}
```

- [ ] **Step 4: Update `src/index.css`**

Add these two lines at the very top of the file (above any existing content):

```css
@import "./ui/fonts.css";
@import "./ui/tokens.css";
```

Then update the existing `body` rule (or add one if absent) so it uses tokens — replace any existing `font-family` on `body` with:

```css
body {
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  color: var(--text);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}
```

Leave the rest of `index.css` intact for now — we are not removing existing styles in this phase.

- [ ] **Step 5: Verify dev server runs**

Run:

```bash
npm start
```

Expected: dev server starts, no compile errors, fonts load (check Network tab for `inter-latin-400-normal.woff2` etc.).

Stop the server with Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/ui/tokens.css src/ui/fonts.css src/index.css
git commit -m "feat(ui): add design tokens and font foundation"
```

---

## Task 2: Button primitive

**Files:**
- Create: `src/ui/Button.js`
- Create: `src/ui/Button.css`
- Test: `src/ui/__tests__/Button.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/Button.test.js`:

```js
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Button from "../Button";

describe("Button", () => {
  test("renders children", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  test("applies variant class", () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole("button")).toHaveClass("ui-btn--danger");
  });

  test("applies size class", () => {
    render(<Button size="sm">x</Button>);
    expect(screen.getByRole("button")).toHaveClass("ui-btn--sm");
  });

  test("calls onClick when clicked", async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("does not call onClick when disabled", async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick} disabled>Go</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  test("shows loading spinner and disables when loading", () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveClass("ui-btn--loading");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --watchAll=false src/ui/__tests__/Button.test.js
```

Expected: FAIL — "Cannot find module '../Button'".

- [ ] **Step 3: Implement Button**

Create `src/ui/Button.js`:

```js
import React from "react";
import "./Button.css";

const Button = React.forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    iconOnly = false,
    type = "button",
    className = "",
    children,
    ...rest
  },
  ref
) {
  const classes = [
    "ui-btn",
    `ui-btn--${variant}`,
    `ui-btn--${size}`,
    iconOnly ? "ui-btn--icon-only" : "",
    loading ? "ui-btn--loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="ui-btn__spinner" aria-hidden="true" />}
      <span className="ui-btn__label">{children}</span>
    </button>
  );
});

export default Button;
```

Create `src/ui/Button.css`:

```css
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-sans);
  font-weight: 500;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background var(--dur-micro), border-color var(--dur-micro),
    color var(--dur-micro), opacity var(--dur-micro);
  white-space: nowrap;
  user-select: none;
}

.ui-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ui-btn:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 2px;
}

/* Sizes */
.ui-btn--sm {
  height: 28px;
  padding: 0 var(--space-3);
  font-size: var(--fs-sm);
}
.ui-btn--md {
  height: 36px;
  padding: 0 var(--space-4);
  font-size: var(--fs-body);
}
.ui-btn--lg {
  height: 44px;
  padding: 0 var(--space-5);
  font-size: var(--fs-lg);
}

.ui-btn--icon-only {
  padding: 0;
  width: 36px;
}
.ui-btn--icon-only.ui-btn--sm {
  width: 28px;
}
.ui-btn--icon-only.ui-btn--lg {
  width: 44px;
}

/* Variants */
.ui-btn--primary {
  background: var(--text);
  color: var(--bg);
  border-color: var(--text);
}
.ui-btn--primary:hover:not(:disabled) {
  background: var(--accent);
  border-color: var(--accent);
}

.ui-btn--secondary {
  background: transparent;
  color: var(--text);
  border-color: var(--border-strong);
}
.ui-btn--secondary:hover:not(:disabled) {
  background: var(--surface-1);
  border-color: var(--accent);
}

.ui-btn--ghost {
  background: transparent;
  color: var(--text);
  border-color: transparent;
}
.ui-btn--ghost:hover:not(:disabled) {
  background: var(--surface-1);
}

.ui-btn--danger {
  background: transparent;
  color: var(--danger);
  border-color: var(--danger);
}
.ui-btn--danger:hover:not(:disabled) {
  background: var(--danger);
  color: var(--text);
}

/* Loading spinner */
.ui-btn__spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: ui-btn-spin 700ms linear infinite;
}
@keyframes ui-btn-spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --watchAll=false src/ui/__tests__/Button.test.js
```

Expected: PASS, 6/6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Button.js src/ui/Button.css src/ui/__tests__/Button.test.js
git commit -m "feat(ui): add Button primitive with variants, sizes, loading"
```

---

## Task 3: IconButton primitive

**Files:**
- Create: `src/ui/IconButton.js`

**Note:** IconButton is a thin wrapper around Button with `iconOnly` and `variant="ghost"` defaulted. No new CSS needed.

- [ ] **Step 1: Write the failing test**

Append to `src/ui/__tests__/Button.test.js` (or create `src/ui/__tests__/IconButton.test.js` if preferred):

```js
import IconButton from "../IconButton";

describe("IconButton", () => {
  test("renders with aria-label", () => {
    render(<IconButton aria-label="Close"><span>×</span></IconButton>);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  test("applies icon-only class by default", () => {
    render(<IconButton aria-label="x"><span>×</span></IconButton>);
    expect(screen.getByRole("button")).toHaveClass("ui-btn--icon-only");
  });

  test("defaults to ghost variant", () => {
    render(<IconButton aria-label="x"><span>×</span></IconButton>);
    expect(screen.getByRole("button")).toHaveClass("ui-btn--ghost");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --watchAll=false src/ui/__tests__/Button.test.js
```

Expected: FAIL — "Cannot find module '../IconButton'".

- [ ] **Step 3: Implement IconButton**

Create `src/ui/IconButton.js`:

```js
import React from "react";
import Button from "./Button";

const IconButton = React.forwardRef(function IconButton(
  { variant = "ghost", ...rest },
  ref
) {
  return <Button ref={ref} variant={variant} iconOnly {...rest} />;
});

export default IconButton;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --watchAll=false src/ui/__tests__/Button.test.js
```

Expected: PASS, 9/9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/IconButton.js src/ui/__tests__/Button.test.js
git commit -m "feat(ui): add IconButton wrapper around Button"
```

---

## Task 4: Input / Textarea / Select primitives

**Files:**
- Create: `src/ui/Input.js`
- Create: `src/ui/Input.css`
- Test: `src/ui/__tests__/Input.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/Input.test.js`:

```js
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input, Textarea, Select } from "../Input";

describe("Input", () => {
  test("renders label and input", () => {
    render(<Input label="Display Name" name="displayName" />);
    expect(screen.getByLabelText("Display Name")).toBeInTheDocument();
  });

  test("shows error text in danger color", () => {
    render(<Input label="Email" error="Invalid" />);
    expect(screen.getByText("Invalid")).toHaveClass("ui-input__error");
  });

  test("shows help text when no error", () => {
    render(<Input label="Email" help="We never share this" />);
    expect(screen.getByText("We never share this")).toHaveClass("ui-input__help");
  });

  test("typing fires onChange", async () => {
    const onChange = jest.fn();
    render(<Input label="X" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("X"), "abc");
    expect(onChange).toHaveBeenCalled();
  });
});

describe("Textarea", () => {
  test("renders multi-line input", () => {
    render(<Textarea label="Bio" name="bio" />);
    const el = screen.getByLabelText("Bio");
    expect(el.tagName).toBe("TEXTAREA");
  });
});

describe("Select", () => {
  test("renders options", () => {
    render(
      <Select label="Type" name="type">
        <option value="dj">DJ</option>
        <option value="prod">Producer</option>
      </Select>
    );
    expect(screen.getByLabelText("Type")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "DJ" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --watchAll=false src/ui/__tests__/Input.test.js
```

Expected: FAIL — "Cannot find module '../Input'".

- [ ] **Step 3: Implement Input/Textarea/Select**

Create `src/ui/Input.js`:

```js
import React, { useId } from "react";
import "./Input.css";

function Field({ label, error, help, htmlFor, children }) {
  return (
    <label className="ui-input" htmlFor={htmlFor}>
      {label && <span className="ui-input__label mono-label">{label}</span>}
      {children}
      {error ? (
        <span className="ui-input__error">{error}</span>
      ) : help ? (
        <span className="ui-input__help">{help}</span>
      ) : null}
    </label>
  );
}

export const Input = React.forwardRef(function Input(
  { label, error, help, id, className = "", ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <Field label={label} error={error} help={help} htmlFor={inputId}>
      <input
        ref={ref}
        id={inputId}
        className={`ui-input__control ${error ? "ui-input__control--error" : ""} ${className}`}
        {...rest}
      />
    </Field>
  );
});

export const Textarea = React.forwardRef(function Textarea(
  { label, error, help, id, className = "", rows = 4, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <Field label={label} error={error} help={help} htmlFor={inputId}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={`ui-input__control ui-input__control--textarea ${error ? "ui-input__control--error" : ""} ${className}`}
        {...rest}
      />
    </Field>
  );
});

export const Select = React.forwardRef(function Select(
  { label, error, help, id, className = "", children, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  return (
    <Field label={label} error={error} help={help} htmlFor={inputId}>
      <select
        ref={ref}
        id={inputId}
        className={`ui-input__control ui-input__control--select ${error ? "ui-input__control--error" : ""} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </Field>
  );
});

export default Input;
```

Create `src/ui/Input.css`:

```css
.ui-input {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.ui-input__label {
  color: var(--text-muted);
}

.ui-input__control {
  font-family: var(--font-sans);
  font-size: var(--fs-body);
  color: var(--text);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  padding: var(--space-2) var(--space-3);
  height: 36px;
  outline: none;
  transition: border-color var(--dur-micro), box-shadow var(--dur-micro);
}

.ui-input__control--textarea {
  height: auto;
  resize: vertical;
  min-height: 80px;
}

.ui-input__control--select {
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--text-muted) 50%),
    linear-gradient(135deg, var(--text-muted) 50%, transparent 50%);
  background-position: calc(100% - 16px) center, calc(100% - 11px) center;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: var(--space-7);
}

.ui-input__control:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.ui-input__control--error {
  border-color: var(--danger);
}
.ui-input__control--error:focus {
  box-shadow: 0 0 0 1px var(--danger);
}

.ui-input__control::placeholder {
  color: var(--text-dim);
}

.ui-input__help {
  font-size: var(--fs-sm);
  color: var(--text-dim);
}

.ui-input__error {
  font-size: var(--fs-sm);
  color: var(--danger);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --watchAll=false src/ui/__tests__/Input.test.js
```

Expected: PASS, 6/6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Input.js src/ui/Input.css src/ui/__tests__/Input.test.js
git commit -m "feat(ui): add Input, Textarea, Select primitives"
```

---

## Task 5: Card primitive

**Files:**
- Create: `src/ui/Card.js`
- Create: `src/ui/Card.css`
- Test: `src/ui/__tests__/Card.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/Card.test.js`:

```js
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Card from "../Card";

describe("Card", () => {
  test("renders children inside card class", () => {
    render(<Card>hello</Card>);
    const node = screen.getByText("hello").closest(".ui-card");
    expect(node).toBeInTheDocument();
  });

  test("clickable variant calls onClick", async () => {
    const onClick = jest.fn();
    render(<Card onClick={onClick}>x</Card>);
    await userEvent.click(screen.getByText("x"));
    expect(onClick).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --watchAll=false src/ui/__tests__/Card.test.js
```

Expected: FAIL — "Cannot find module '../Card'".

- [ ] **Step 3: Implement Card**

Create `src/ui/Card.js`:

```js
import React from "react";
import "./Card.css";

function Card({ as: Tag = "div", padding = "md", className = "", onClick, children, ...rest }) {
  const isClickable = !!onClick;
  const classes = [
    "ui-card",
    `ui-card--p-${padding}`,
    isClickable ? "ui-card--clickable" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (isClickable) {
    return (
      <Tag
        className={classes}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick(e);
          }
        }}
        {...rest}
      >
        {children}
      </Tag>
    );
  }

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}

export default Card;
```

Create `src/ui/Card.css`:

```css
.ui-card {
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--elev-1);
  transition: border-color var(--dur-micro);
}

.ui-card--p-sm { padding: var(--space-3); }
.ui-card--p-md { padding: var(--space-4); }
.ui-card--p-lg { padding: var(--space-6); }

.ui-card--clickable {
  cursor: pointer;
}
.ui-card--clickable:hover,
.ui-card--clickable:focus-visible {
  border-color: var(--border-strong);
  outline: none;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --watchAll=false src/ui/__tests__/Card.test.js
```

Expected: PASS, 2/2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Card.js src/ui/Card.css src/ui/__tests__/Card.test.js
git commit -m "feat(ui): add Card primitive"
```

---

## Task 6: Modal primitive (centered dialog)

**Files:**
- Create: `src/ui/Modal.js`
- Create: `src/ui/Modal.css`
- Test: `src/ui/__tests__/Modal.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/Modal.test.js`:

```js
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "../Modal";

describe("Modal", () => {
  test("does not render when closed", () => {
    render(<Modal open={false} onClose={() => {}} title="X">body</Modal>);
    expect(screen.queryByText("body")).not.toBeInTheDocument();
  });

  test("renders title and body when open", () => {
    render(<Modal open onClose={() => {}} title="Confirm">body</Modal>);
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  test("Escape key closes the modal", async () => {
    const onClose = jest.fn();
    render(<Modal open onClose={onClose} title="X">body</Modal>);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  test("backdrop click closes the modal", async () => {
    const onClose = jest.fn();
    render(<Modal open onClose={onClose} title="X">body</Modal>);
    await userEvent.click(screen.getByTestId("ui-modal-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  test("close button calls onClose", async () => {
    const onClose = jest.fn();
    render(<Modal open onClose={onClose} title="X">body</Modal>);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --watchAll=false src/ui/__tests__/Modal.test.js
```

Expected: FAIL — "Cannot find module '../Modal'".

- [ ] **Step 3: Implement Modal**

Create `src/ui/Modal.js`:

```js
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import IconButton from "./IconButton";
import "./Modal.css";

function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="ui-modal-root" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="ui-modal-backdrop"
        data-testid="ui-modal-backdrop"
        onClick={onClose}
      />
      <div className="ui-modal" role="document">
        <header className="ui-modal__header">
          <h2 className="ui-modal__title">{title}</h2>
          <IconButton aria-label="Close" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </IconButton>
        </header>
        <div className="ui-modal__body">{children}</div>
        {footer && <footer className="ui-modal__footer">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

export default Modal;
```

Create `src/ui/Modal.css`:

```css
.ui-modal-root {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ui-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  animation: ui-modal-fade var(--dur-std) ease;
}

.ui-modal {
  position: relative;
  width: min(480px, calc(100vw - var(--space-7)));
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  animation: ui-modal-pop var(--dur-std) var(--ease-screen);
}

.ui-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border);
}

.ui-modal__title {
  margin: 0;
  font-size: var(--fs-lg);
  font-weight: 600;
  color: var(--text);
}

.ui-modal__body {
  padding: var(--space-5);
  color: var(--text);
}

.ui-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border);
}

@keyframes ui-modal-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes ui-modal-pop {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --watchAll=false src/ui/__tests__/Modal.test.js
```

Expected: PASS, 5/5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Modal.js src/ui/Modal.css src/ui/__tests__/Modal.test.js
git commit -m "feat(ui): add Modal primitive with esc/backdrop close"
```

---

## Task 7: Sheet primitive (full-screen takeover)

**Files:**
- Create: `src/ui/Sheet.js`
- Create: `src/ui/Sheet.css`
- Test: `src/ui/__tests__/Sheet.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/Sheet.test.js`:

```js
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Sheet from "../Sheet";

describe("Sheet", () => {
  test("does not render when closed", () => {
    render(<Sheet open={false} onClose={() => {}} title="X">body</Sheet>);
    expect(screen.queryByText("body")).not.toBeInTheDocument();
  });

  test("renders title, body, and primary action", () => {
    render(
      <Sheet open onClose={() => {}} title="Post Set" primaryAction={<button>Save</button>}>
        body
      </Sheet>
    );
    expect(screen.getByText("Post Set")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  test("close button calls onClose", async () => {
    const onClose = jest.fn();
    render(<Sheet open onClose={onClose} title="X">body</Sheet>);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  test("Escape key closes the sheet", async () => {
    const onClose = jest.fn();
    render(<Sheet open onClose={onClose} title="X">body</Sheet>);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --watchAll=false src/ui/__tests__/Sheet.test.js
```

Expected: FAIL — "Cannot find module '../Sheet'".

- [ ] **Step 3: Implement Sheet**

Create `src/ui/Sheet.js`:

```js
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import IconButton from "./IconButton";
import "./Sheet.css";

function Sheet({ open, onClose, title, primaryAction, side = "bottom", children }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={`ui-sheet-root ui-sheet-root--${side}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="ui-sheet-backdrop" onClick={onClose} />
      <div className="ui-sheet" role="document">
        <header className="ui-sheet__header">
          <IconButton aria-label="Close" onClick={onClose}>
            <span aria-hidden="true">×</span>
          </IconButton>
          <h2 className="ui-sheet__title">{title}</h2>
          <div className="ui-sheet__primary">{primaryAction}</div>
        </header>
        <div className="ui-sheet__body">{children}</div>
      </div>
    </div>,
    document.body
  );
}

export default Sheet;
```

Create `src/ui/Sheet.css`:

```css
.ui-sheet-root {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
}

.ui-sheet-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  animation: ui-sheet-fade var(--dur-std) ease;
}

.ui-sheet {
  position: relative;
  background: var(--surface-1);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}

/* Bottom (default) — full-screen on mobile, large centered on desktop */
.ui-sheet-root--bottom {
  align-items: stretch;
  justify-content: center;
}
.ui-sheet-root--bottom .ui-sheet {
  width: 100vw;
  height: 100vh;
  animation: ui-sheet-rise var(--dur-screen) var(--ease-screen);
}
@media (min-width: 768px) {
  .ui-sheet-root--bottom {
    align-items: center;
    padding: var(--space-7);
  }
  .ui-sheet-root--bottom .ui-sheet {
    width: 100%;
    max-width: 1080px;
    height: calc(100vh - var(--space-8));
    border-radius: var(--radius-md);
  }
}

/* Right side variant — used by builder add-device sheet later */
.ui-sheet-root--right {
  justify-content: flex-end;
}
.ui-sheet-root--right .ui-sheet {
  width: min(480px, 100vw);
  height: 100vh;
  animation: ui-sheet-slide-right var(--dur-screen) var(--ease-screen);
}

.ui-sheet__header {
  display: grid;
  grid-template-columns: 44px 1fr auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border);
}

.ui-sheet__title {
  margin: 0;
  text-align: center;
  font-size: var(--fs-lg);
  font-weight: 600;
}

.ui-sheet__primary {
  justify-self: end;
}

.ui-sheet__body {
  flex: 1;
  overflow: auto;
  padding: var(--space-5);
}

@keyframes ui-sheet-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes ui-sheet-rise {
  from { transform: translateY(24px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@keyframes ui-sheet-slide-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --watchAll=false src/ui/__tests__/Sheet.test.js
```

Expected: PASS, 4/4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Sheet.js src/ui/Sheet.css src/ui/__tests__/Sheet.test.js
git commit -m "feat(ui): add Sheet primitive with bottom/right variants"
```

---

## Task 8: Tabs primitive

**Files:**
- Create: `src/ui/Tabs.js`
- Create: `src/ui/Tabs.css`
- Test: `src/ui/__tests__/Tabs.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/Tabs.test.js`:

```js
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Tabs from "../Tabs";

describe("Tabs", () => {
  const items = [
    { value: "sets", label: "SETS" },
    { value: "setups", label: "SETUPS" },
    { value: "liked", label: "LIKED" },
  ];

  test("renders all tab labels", () => {
    render(<Tabs items={items} value="sets" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "SETS" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "SETUPS" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "LIKED" })).toBeInTheDocument();
  });

  test("marks active tab with aria-selected", () => {
    render(<Tabs items={items} value="setups" onChange={() => {}} />);
    expect(screen.getByRole("tab", { name: "SETUPS" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "SETS" })).toHaveAttribute("aria-selected", "false");
  });

  test("clicking a tab fires onChange with its value", async () => {
    const onChange = jest.fn();
    render(<Tabs items={items} value="sets" onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: "LIKED" }));
    expect(onChange).toHaveBeenCalledWith("liked");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --watchAll=false src/ui/__tests__/Tabs.test.js
```

Expected: FAIL — "Cannot find module '../Tabs'".

- [ ] **Step 3: Implement Tabs**

Create `src/ui/Tabs.js`:

```js
import React from "react";
import "./Tabs.css";

function Tabs({ items, value, onChange, className = "" }) {
  return (
    <div role="tablist" className={`ui-tabs ${className}`}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            className={`ui-tabs__tab mono-label ${active ? "ui-tabs__tab--active" : ""}`}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
```

Create `src/ui/Tabs.css`:

```css
.ui-tabs {
  display: flex;
  gap: var(--space-5);
  border-bottom: 1px solid var(--border);
}

.ui-tabs__tab {
  background: none;
  border: none;
  color: var(--text-muted);
  padding: var(--space-3) 0;
  cursor: pointer;
  position: relative;
  transition: color var(--dur-micro);
}

.ui-tabs__tab:hover {
  color: var(--text);
}

.ui-tabs__tab--active {
  color: var(--text);
}

.ui-tabs__tab--active::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--accent);
}

.ui-tabs__tab:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 4px;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --watchAll=false src/ui/__tests__/Tabs.test.js
```

Expected: PASS, 3/3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Tabs.js src/ui/Tabs.css src/ui/__tests__/Tabs.test.js
git commit -m "feat(ui): add Tabs primitive"
```

---

## Task 9: Chip primitive

**Files:**
- Create: `src/ui/Chip.js`
- Create: `src/ui/Chip.css`
- Test: `src/ui/__tests__/Chip.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/Chip.test.js`:

```js
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Chip from "../Chip";

describe("Chip", () => {
  test("renders as span when not clickable", () => {
    render(<Chip>BPM 128</Chip>);
    const node = screen.getByText("BPM 128");
    expect(node.tagName).toBe("SPAN");
  });

  test("renders as button when onClick provided", async () => {
    const onClick = jest.fn();
    render(<Chip onClick={onClick}>CDJ-3000</Chip>);
    const btn = screen.getByRole("button", { name: "CDJ-3000" });
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --watchAll=false src/ui/__tests__/Chip.test.js
```

Expected: FAIL — "Cannot find module '../Chip'".

- [ ] **Step 3: Implement Chip**

Create `src/ui/Chip.js`:

```js
import React from "react";
import "./Chip.css";

function Chip({ onClick, className = "", children, ...rest }) {
  const classes = `ui-chip mono-label ${onClick ? "ui-chip--clickable" : ""} ${className}`;
  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} {...rest}>
        {children}
      </button>
    );
  }
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
}

export default Chip;
```

Create `src/ui/Chip.css`:

```css
.ui-chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 var(--space-2);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  color: var(--text-muted);
  white-space: nowrap;
}

.ui-chip--clickable {
  cursor: pointer;
  transition: border-color var(--dur-micro), color var(--dur-micro);
}
.ui-chip--clickable:hover {
  border-color: var(--accent);
  color: var(--text);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --watchAll=false src/ui/__tests__/Chip.test.js
```

Expected: PASS, 2/2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Chip.js src/ui/Chip.css src/ui/__tests__/Chip.test.js
git commit -m "feat(ui): add Chip primitive"
```

---

## Task 10: Avatar primitive

**Files:**
- Create: `src/ui/Avatar.js`
- Create: `src/ui/Avatar.css`
- Test: `src/ui/__tests__/Avatar.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/Avatar.test.js`:

```js
import React from "react";
import { render, screen } from "@testing-library/react";
import Avatar from "../Avatar";

describe("Avatar", () => {
  test("renders image when src provided", () => {
    render(<Avatar src="https://x/y.jpg" name="Jane Doe" />);
    expect(screen.getByRole("img", { name: "Jane Doe" })).toHaveAttribute("src", "https://x/y.jpg");
  });

  test("renders initials when no src", () => {
    render(<Avatar name="Jane Doe" />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  test("size class applied", () => {
    const { container } = render(<Avatar name="X Y" size={48} />);
    expect(container.firstChild).toHaveClass("ui-avatar--48");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --watchAll=false src/ui/__tests__/Avatar.test.js
```

Expected: FAIL — "Cannot find module '../Avatar'".

- [ ] **Step 3: Implement Avatar**

Create `src/ui/Avatar.js`:

```js
import React from "react";
import "./Avatar.css";

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ src, name = "", size = 32, className = "" }) {
  const classes = `ui-avatar ui-avatar--${size} ${className}`;
  if (src) {
    return <img className={classes} src={src} alt={name} />;
  }
  return (
    <span className={classes} aria-label={name}>
      <span className="ui-avatar__initials mono-label">{getInitials(name)}</span>
    </span>
  );
}

export default Avatar;
```

Create `src/ui/Avatar.css`:

```css
.ui-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  border-radius: 50%;
  color: var(--text-muted);
  overflow: hidden;
  flex-shrink: 0;
}

img.ui-avatar { object-fit: cover; }

.ui-avatar--24 { width: 24px; height: 24px; }
.ui-avatar--32 { width: 32px; height: 32px; }
.ui-avatar--48 { width: 48px; height: 48px; }
.ui-avatar--64 { width: 64px; height: 64px; }
.ui-avatar--96 { width: 96px; height: 96px; }

.ui-avatar__initials {
  font-size: 0.7em;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --watchAll=false src/ui/__tests__/Avatar.test.js
```

Expected: PASS, 3/3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Avatar.js src/ui/Avatar.css src/ui/__tests__/Avatar.test.js
git commit -m "feat(ui): add Avatar primitive with image/initials fallback"
```

---

## Task 11: Toast + ToastProvider

**Files:**
- Create: `src/ui/Toast.js`
- Create: `src/ui/Toast.css`
- Test: `src/ui/__tests__/Toast.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/Toast.test.js`:

```js
import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "../Toast";

function Trigger({ kind = "success", message = "saved" }) {
  const toast = useToast();
  return <button onClick={() => toast[kind](message)}>fire</button>;
}

describe("Toast", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => { jest.runOnlyPendingTimers(); });
    jest.useRealTimers();
  });

  test("shows a success toast when fired", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    await user.click(screen.getByText("fire"));
    expect(screen.getByText("saved")).toBeInTheDocument();
  });

  test("auto-dismisses after 3 seconds", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    await user.click(screen.getByText("fire"));
    expect(screen.getByText("saved")).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(3100); });
    expect(screen.queryByText("saved")).not.toBeInTheDocument();
  });

  test("error toast applies error class", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <Trigger kind="error" message="oops" />
      </ToastProvider>
    );
    await user.click(screen.getByText("fire"));
    expect(screen.getByText("oops").closest(".ui-toast")).toHaveClass("ui-toast--error");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --watchAll=false src/ui/__tests__/Toast.test.js
```

Expected: FAIL — "Cannot find module '../Toast'".

- [ ] **Step 3: Implement Toast + ToastProvider**

Create `src/ui/Toast.js`:

```js
import React, { createContext, useCallback, useContext, useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "./Toast.css";

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback((kind, message) => {
    const id = nextId++;
    setToasts((list) => [...list, { id, kind, message }]);
    const handle = setTimeout(() => dismiss(id), 3000);
    timers.current.set(id, handle);
    return id;
  }, [dismiss]);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);

  const api = useMemo(() => ({
    success: (msg) => push("success", msg),
    error: (msg) => push("error", msg),
    info: (msg) => push("info", msg),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="ui-toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className={`ui-toast ui-toast--${t.kind}`} role="status">
              {t.message}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
```

Create `src/ui/Toast.css`:

```css
.ui-toast-stack {
  position: fixed;
  bottom: var(--space-6);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  z-index: 1100;
  pointer-events: none;
}

.ui-toast {
  pointer-events: auto;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  padding: var(--space-3) var(--space-4);
  font-size: var(--fs-sm);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  animation: ui-toast-in var(--dur-std) var(--ease-screen);
}

.ui-toast--success { border-color: var(--accent); }
.ui-toast--error { border-color: var(--danger); color: var(--danger); }
.ui-toast--info { border-color: var(--border-strong); }

@keyframes ui-toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --watchAll=false src/ui/__tests__/Toast.test.js
```

Expected: PASS, 3/3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/Toast.js src/ui/Toast.css src/ui/__tests__/Toast.test.js
git commit -m "feat(ui): add Toast + ToastProvider with auto-dismiss"
```

---

## Task 12: EmptyState primitive

**Files:**
- Create: `src/ui/EmptyState.js`
- Create: `src/ui/EmptyState.css`
- Test: `src/ui/__tests__/EmptyState.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/EmptyState.test.js`:

```js
import React from "react";
import { render, screen } from "@testing-library/react";
import EmptyState from "../EmptyState";

describe("EmptyState", () => {
  test("renders eyebrow, title, body, and action", () => {
    render(
      <EmptyState
        eyebrow="NO SETUPS"
        title="Build your first setup"
        body="Pick a setup type to begin."
        action={<button>New Setup</button>}
      />
    );
    expect(screen.getByText("NO SETUPS")).toBeInTheDocument();
    expect(screen.getByText("Build your first setup")).toBeInTheDocument();
    expect(screen.getByText("Pick a setup type to begin.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Setup" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --watchAll=false src/ui/__tests__/EmptyState.test.js
```

Expected: FAIL — "Cannot find module '../EmptyState'".

- [ ] **Step 3: Implement EmptyState**

Create `src/ui/EmptyState.js`:

```js
import React from "react";
import "./EmptyState.css";

function EmptyState({ eyebrow, title, body, action, className = "" }) {
  return (
    <div className={`ui-empty ${className}`}>
      {eyebrow && <span className="ui-empty__eyebrow mono-label">{eyebrow}</span>}
      {title && <h3 className="ui-empty__title">{title}</h3>}
      {body && <p className="ui-empty__body">{body}</p>}
      {action && <div className="ui-empty__action">{action}</div>}
    </div>
  );
}

export default EmptyState;
```

Create `src/ui/EmptyState.css`:

```css
.ui-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-5);
  color: var(--text-muted);
}

.ui-empty__eyebrow { color: var(--text-dim); }

.ui-empty__title {
  margin: 0;
  font-size: var(--fs-xl);
  font-weight: 600;
  color: var(--text);
}

.ui-empty__body {
  margin: 0;
  max-width: 40ch;
  color: var(--text-muted);
}

.ui-empty__action {
  margin-top: var(--space-3);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --watchAll=false src/ui/__tests__/EmptyState.test.js
```

Expected: PASS, 1/1 test.

- [ ] **Step 5: Commit**

```bash
git add src/ui/EmptyState.js src/ui/EmptyState.css src/ui/__tests__/EmptyState.test.js
git commit -m "feat(ui): add EmptyState primitive"
```

---

## Task 13: SectionHeader primitive

**Files:**
- Create: `src/ui/SectionHeader.js`
- Create: `src/ui/SectionHeader.css`
- Test: `src/ui/__tests__/SectionHeader.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/ui/__tests__/SectionHeader.test.js`:

```js
import React from "react";
import { render, screen } from "@testing-library/react";
import SectionHeader from "../SectionHeader";

describe("SectionHeader", () => {
  test("renders eyebrow + title + action", () => {
    render(
      <SectionHeader
        eyebrow="RECENT FROM YOUR FOLLOWS"
        title="What's new"
        action={<a href="#x">View all</a>}
      />
    );
    expect(screen.getByText("RECENT FROM YOUR FOLLOWS")).toBeInTheDocument();
    expect(screen.getByText("What's new")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all" })).toBeInTheDocument();
  });

  test("eyebrow alone renders without title", () => {
    render(<SectionHeader eyebrow="YOUR SETUPS" />);
    expect(screen.getByText("YOUR SETUPS")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --watchAll=false src/ui/__tests__/SectionHeader.test.js
```

Expected: FAIL — "Cannot find module '../SectionHeader'".

- [ ] **Step 3: Implement SectionHeader**

Create `src/ui/SectionHeader.js`:

```js
import React from "react";
import "./SectionHeader.css";

function SectionHeader({ eyebrow, title, action, className = "" }) {
  return (
    <div className={`ui-section-header ${className}`}>
      <div className="ui-section-header__text">
        {eyebrow && <span className="ui-section-header__eyebrow mono-label">{eyebrow}</span>}
        {title && <h2 className="ui-section-header__title">{title}</h2>}
      </div>
      {action && <div className="ui-section-header__action">{action}</div>}
    </div>
  );
}

export default SectionHeader;
```

Create `src/ui/SectionHeader.css`:

```css
.ui-section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.ui-section-header__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.ui-section-header__eyebrow { color: var(--text-dim); }

.ui-section-header__title {
  margin: 0;
  font-size: var(--fs-xl);
  font-weight: 600;
  color: var(--text);
}

.ui-section-header__action a,
.ui-section-header__action button {
  font-size: var(--fs-sm);
  color: var(--text-muted);
  text-decoration: none;
  transition: color var(--dur-micro);
}
.ui-section-header__action a:hover,
.ui-section-header__action button:hover {
  color: var(--accent);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --watchAll=false src/ui/__tests__/SectionHeader.test.js
```

Expected: PASS, 2/2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/SectionHeader.js src/ui/SectionHeader.css src/ui/__tests__/SectionHeader.test.js
git commit -m "feat(ui): add SectionHeader primitive"
```

---

## Task 14: Barrel export

**Files:**
- Create: `src/ui/index.js`

- [ ] **Step 1: Create barrel**

Create `src/ui/index.js`:

```js
export { default as Button } from "./Button";
export { default as IconButton } from "./IconButton";
export { Input, Textarea, Select } from "./Input";
export { default as Card } from "./Card";
export { default as Modal } from "./Modal";
export { default as Sheet } from "./Sheet";
export { default as Tabs } from "./Tabs";
export { default as Chip } from "./Chip";
export { default as Avatar } from "./Avatar";
export { ToastProvider, useToast } from "./Toast";
export { default as EmptyState } from "./EmptyState";
export { default as SectionHeader } from "./SectionHeader";
```

- [ ] **Step 2: Verify barrel resolves**

Run:

```bash
node -e "require('./src/ui/index.js')" 2>&1 | head -5 || true
```

(This will likely fail because Node can't resolve JSX/CSS — that's fine. The import is exercised by tests instead.)

Run all UI tests in one shot to confirm nothing regressed:

```bash
npm test -- --watchAll=false src/ui/
```

Expected: all primitive tests still pass.

- [ ] **Step 3: Commit**

```bash
git add src/ui/index.js
git commit -m "feat(ui): add barrel export for ui primitives"
```

---

## Task 15: Wire ToastProvider into App + replace `alert()` calls

**Files:**
- Modify: `src/App.js`
- Modify: any file in `src/` that calls `alert(`

- [ ] **Step 1: Inventory `alert()` call sites**

Run from repo root:

```bash
grep -rn "alert(" src --include="*.js" | grep -v "node_modules" | grep -v "//.*alert("
```

Record the list. Each call site will be replaced.

- [ ] **Step 2: Wrap App in ToastProvider**

Open `src/App.js`. Find the top-level return (the outermost JSX element rendered by the `App` component) and wrap its contents in `<ToastProvider>`. Add the import at the top of the file:

```js
import { ToastProvider } from "./ui";
```

Then change the outermost return JSX so it looks like:

```jsx
return (
  <ToastProvider>
    {/* existing top-level content */}
  </ToastProvider>
);
```

- [ ] **Step 3: Replace `alert()` calls**

For each file from Step 1:

1. Add at the top of the file: `import { useToast } from "./ui";` (adjust relative path: from `src/components/Foo.js` it is `"../ui"`).
2. Inside the function component, add: `const toast = useToast();`
3. Replace each `alert("message")` with one of:
   - `toast.error("message")` — for error/failure messages (any "Error:", "Failed", "could not", etc.)
   - `toast.success("message")` — for success confirmations ("Saved!", "Posted!", etc.)
   - `toast.info("message")` — for neutral notifications

For files that are NOT React components (utilities, services), leave the `alert()` call alone for now and add a `// TODO(redesign): replace with toast` comment immediately above. (We will revisit during Phase 6 sweep.)

If a confirmation dialog uses `window.confirm(...)`, **leave it untouched** — `Modal` will replace those in later phases when we redesign the affected screens. Do not introduce a confirm-modal pattern yet.

- [ ] **Step 4: Manually verify in dev**

Run:

```bash
npm start
```

Open the app, trigger any flow that previously fired an `alert()` (e.g., delete a setup, save a profile name). Confirm the toast appears bottom-center and auto-dismisses after ~3s. Stop the server.

- [ ] **Step 5: Run lint and tests**

```bash
npm run lint
npm test -- --watchAll=false
```

Expected: lint passes (or only pre-existing warnings); all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/App.js $(git diff --name-only -- 'src/**/*.js')
git commit -m "feat(ui): wrap app in ToastProvider, replace alert() with toast"
```

---

## Task 16: Phase 1 verification

**Files:** none modified.

- [ ] **Step 1: Run full test suite**

```bash
npm test -- --watchAll=false
```

Expected: all tests pass. Note any pre-existing failures unrelated to Phase 1 — those are out of scope.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no new errors introduced by Phase 1 files.

- [ ] **Step 3: Build production bundle**

```bash
npm run build
```

Expected: build succeeds. CSS bundle should include the new tokens. No new runtime warnings.

- [ ] **Step 4: Visual smoke test**

```bash
npm start
```

Walk through:
- App loads with the new font (Inter visible in body text — compare against the previous default).
- Background reads as warm true black, not blue-gray.
- Trigger one flow that produces a toast (delete or save) — confirms the provider is wired.
- All existing pages still render; no layout breaks.

Stop the server.

- [ ] **Step 5: Tag the phase**

```bash
git tag redesign-phase-1
```

(Optional — skip if you don't tag.)

Phase 1 complete. The kit is ready for Phase 2 (navigation + routing) to consume.

---

## Self-Review Notes

- **Spec coverage:** Every primitive in Section 4 of the spec has a task (Tasks 2–13). Tokens from Section 3 → Task 1. ToastProvider wiring + alert replacement → Task 15. Verification → Task 16.
- **Type consistency:** Component prop names match across tasks (`open`, `onClose`, `title`, `primaryAction`, `value`/`onChange` on Tabs, `eyebrow`/`title`/`action` on EmptyState/SectionHeader). `useToast()` returns `{ success, error, info, dismiss }` consistently.
- **Placeholders:** None — every step has the actual code or command. The one TODO comment intentionally added in Task 15 Step 3 is for non-component utility files and is explicitly scoped to Phase 6.
- **Out of scope (deferred to later phases):** Routing, AppShell/Sidebar/BottomTabBar (Phase 2), page redesigns (Phases 3–5), legacy file cleanup (Phase 6).
