import { cn } from "./cn";

/**
 * Themeable table primitives. Compose them like native table elements:
 *
 *   <TableContainer>
 *     <Table>
 *       <THead sticky><TR><TH>Rank</TH>…</TR></THead>
 *       <TBody>
 *         <TR interactive><TD>…</TD></TR>
 *       </TBody>
 *     </Table>
 *   </TableContainer>
 */

export function TableContainer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-lg border border-border bg-surface",
        className
      )}
      {...props}
    />
  );
}

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full border-collapse text-left", className)}
      {...props}
    />
  );
}

export function THead({
  sticky = false,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement> & { sticky?: boolean }) {
  return (
    <thead
      className={cn(
        "bg-surface-2 [&_th]:border-b [&_th]:border-border",
        sticky && "sticky top-0 z-10 backdrop-blur",
        className
      )}
      {...props}
    />
  );
}

export function TBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn("divide-y divide-border", className)}
      {...props}
    />
  );
}

export function TR({
  interactive = false,
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        interactive && "transition-colors hover:bg-surface-2",
        className
      )}
      {...props}
    />
  );
}

export function TH({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={props.scope ?? "col"}
      className={cn(
        "px-4 py-3 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-fg-subtle",
        className
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-4 py-3 align-middle text-sm text-fg", className)}
      {...props}
    />
  );
}
