"use client";

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import Link from "next/link";

export type GraphNodeData = {
  label: string;
  entityType: string;
  href?: string;
};

const cardBase =
  "rounded-xl border-2 px-3 py-2 text-sm shadow-sm transition-shadow min-w-[160px] max-w-[220px] ";

/** Entity-specific background and border (unselected). */
const entityStyles: Record<string, { bg: string; border: string }> = {
  contact: { bg: "var(--mint-soft)", border: "var(--mint)" },
  event: { bg: "var(--sky-soft)", border: "var(--sky)" },
  todo: { bg: "var(--coral-soft)", border: "var(--coral)" },
  note: { bg: "var(--cream)", border: "var(--sky-soft)" },
};

function CardWrapper({
  selected,
  entityType,
  children,
}: {
  selected: boolean;
  entityType: keyof typeof entityStyles;
  children: React.ReactNode;
}) {
  const style = entityStyles[entityType] ?? entityStyles.note;
  return (
    <div
      className={cardBase + (selected ? " shadow-md ring-2 ring-[var(--mint)] " : " ")}
      style={{
        backgroundColor: style.bg,
        borderColor: selected ? "var(--mint)" : style.border,
      }}
    >
      {children}
    </div>
  );
}

export function ContactNode({ data, selected }: NodeProps) {
  const d = data as GraphNodeData;
  return (
    <>
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-2 !border-[var(--mint)] !bg-[var(--cream)]" />
      <CardWrapper selected={!!selected} entityType="contact">
        <span className="text-xs font-medium uppercase text-[var(--text-muted)]">Contact</span>
        <div className="mt-0.5 font-medium text-[var(--text)]">
          {d.href ? (
            <Link href={d.href} className="hover:underline" onClick={(e) => e.stopPropagation()}>
              {d.label}
            </Link>
          ) : (
            d.label
          )}
        </div>
      </CardWrapper>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-2 !border-[var(--mint)] !bg-[var(--cream)]" />
    </>
  );
}

export function EventNode({ data, selected }: NodeProps) {
  const d = data as GraphNodeData;
  return (
    <>
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-2 !border-[var(--mint)] !bg-[var(--cream)]" />
      <CardWrapper selected={!!selected} entityType="event">
        <span className="text-xs font-medium uppercase text-[var(--text-muted)]">Event</span>
        <div className="mt-0.5 font-medium text-[var(--text)]">
          {d.href ? (
            <Link href={d.href} className="hover:underline" onClick={(e) => e.stopPropagation()}>
              {d.label}
            </Link>
          ) : (
            d.label
          )}
        </div>
      </CardWrapper>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-2 !border-[var(--mint)] !bg-[var(--cream)]" />
    </>
  );
}

export function TodoNode({ data, selected }: NodeProps) {
  const d = data as GraphNodeData;
  return (
    <>
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-2 !border-[var(--mint)] !bg-[var(--cream)]" />
      <CardWrapper selected={!!selected} entityType="todo">
        <span className="text-xs font-medium uppercase text-[var(--text-muted)]">Todo</span>
        <div className="mt-0.5 font-medium text-[var(--text)]">
          {d.href ? (
            <Link href={d.href} className="hover:underline" onClick={(e) => e.stopPropagation()}>
              {d.label}
            </Link>
          ) : (
            d.label
          )}
        </div>
      </CardWrapper>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-2 !border-[var(--mint)] !bg-[var(--cream)]" />
    </>
  );
}

export function NoteNode({ data, selected }: NodeProps) {
  const d = data as GraphNodeData;
  return (
    <>
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-2 !border-[var(--mint)] !bg-[var(--cream)]" />
      <CardWrapper selected={!!selected} entityType="note">
        <span className="text-xs font-medium uppercase text-[var(--text-muted)]">Note</span>
        <div className="mt-0.5 truncate text-[var(--text)]">{d.label}</div>
      </CardWrapper>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-2 !border-[var(--mint)] !bg-[var(--cream)]" />
    </>
  );
}

export const nodeTypes = {
  contact: ContactNode,
  event: EventNode,
  todo: TodoNode,
  note: NoteNode,
};
