import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";
import { Position } from "@xyflow/react";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 72;

type ApiNode = { id: string; type: string; label: string; [k: string]: unknown };
type ApiEdge = { from: string; to: string; type: string };

/**
 * Convert API graph to React Flow nodes/edges and run dagre layout (TB = top to bottom).
 */
export function getLayoutedElements(
  apiNodes: ApiNode[],
  apiEdges: ApiEdge[]
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "TB", ranksep: 40, nodesep: 30 });

  const nodes: Node[] = apiNodes.map((n) => ({
    id: n.id,
    type: n.type as "contact" | "event" | "todo" | "note",
    position: { x: 0, y: 0 },
    data: {
      label: n.label,
      entityType: n.type,
      href:
        n.type === "contact"
          ? `/contacts/${n.id}`
          : n.type === "event"
            ? `/events/${n.id}`
            : n.type === "todo"
              ? "/todos"
              : undefined,
    },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
  }));

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  if (apiEdges.length > 0) {
    apiEdges.forEach((e) => {
      dagreGraph.setEdge(e.from, e.to);
    });
    dagre.layout(dagreGraph);
    nodes.forEach((node) => {
      const pos = dagreGraph.node(node.id);
      node.position = {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      };
    });
  } else {
    // No edges: place nodes in a simple grid so they're all visible
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const gap = 40;
    nodes.forEach((node, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      node.position = {
        x: col * (NODE_WIDTH + gap),
        y: row * (NODE_HEIGHT + gap),
      };
    });
  }

  const edges: Edge[] = apiEdges.map((e, i) => ({
    id: `edge-${e.from}-${e.to}-${i}`,
    source: e.from,
    target: e.to,
    type: "smoothstep",
    data: { label: e.type },
    style: { stroke: "var(--mint)", strokeWidth: 2 },
  }));

  return { nodes, edges };
}
