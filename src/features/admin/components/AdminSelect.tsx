import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  /** Placeholder shown as the first, unselectable option. Only rendered
   * when there is no default `value`/`defaultValue` (or the value is
   * empty string). Prevents the ugly "— selecione —" first entry. */
  placeholder?: string;
};

/**
 * Native <select> with consistent admin styling: white background,
 * scriba hairline border, small height. Wraps children as options and
 * optionally injects an unselectable placeholder option that vanishes
 * once the user picks a real value.
 */
export const AdminSelect = forwardRef<HTMLSelectElement, Props>(function AdminSelect(
  { className, placeholder, children, ...props },
  ref
) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-9 rounded-md border bg-white px-3 text-sm text-[color:var(--scriba-ink)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--scriba-blue)]/40",
        "invalid:text-[color:var(--scriba-ink-mute)]",
        className
      )}
      style={{ borderColor: "var(--scriba-hairline)" }}
      {...props}
    >
      {placeholder ? (
        <option value="" disabled hidden>
          {placeholder}
        </option>
      ) : null}
      {children}
    </select>
  );
});
