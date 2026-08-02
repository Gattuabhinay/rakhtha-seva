import { Link, type LinkProps } from "react-router-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variantClass: Record<Variant, string> = {
  primary: "btn btn-primary",
  secondary: "btn btn-secondary",
  ghost: "btn btn-ghost",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${variantClass[variant]} ${className}`.trim()} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className = "",
  children,
  ...props
}: LinkProps & { variant?: Variant; children: ReactNode }) {
  return (
    <Link className={`${variantClass[variant]} ${className}`.trim()} {...props}>
      {children}
    </Link>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`panel ${className}`.trim()}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <>
      <p className="eyebrow">{eyebrow}</p>
      <h1
        style={{
          margin: "0 0 0.35rem",
          fontSize: "clamp(1.9rem,4vw,2.7rem)",
          fontFamily: "var(--display)",
          color: "var(--ink)",
        }}
      >
        {title}
      </h1>
      {lede ? <p className="section-lede">{lede}</p> : null}
    </>
  );
}
