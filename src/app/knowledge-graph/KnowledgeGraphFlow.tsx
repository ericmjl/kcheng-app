"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getLayoutedElements } from "./useKnowledgeGraphLayout";
import { nodeTypes } from "./GraphNodes";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 72;

type ApiGraph = {
  nodes: { id: string; type: string; label: string; [k: string]: unknown }[];
  edges: { from: string; to: string; type: string }[];
};

function FlowInner({
  initialNodes,
  initialEdges,
}: {
  initialNodes: Node[];
  initialEdges: Edge[];
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const { getNodes, setCenter } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const list = getNodes();
      if (list.length === 0) return;
      const sorted = [...list].sort(
        (a, b) =>
          a.position.y - b.position.y || a.position.x - b.position.x
      );
      const selectedIndex = sorted.findIndex((n) => n.selected);
      const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
      const nextIndex =
        e.key === "ArrowDown"
          ? Math.min(currentIndex + 1, sorted.length - 1)
          : Math.max(currentIndex - 1, 0);
      const next = sorted[nextIndex];
      if (!next) return;
      setNodes((prev) =>
        prev.map((n) => ({
          ...n,
          selected: n.id === next.id,
        }))
      );
      setCenter(
        next.position.x + NODE_WIDTH / 2,
        next.position.y + NODE_HEIGHT / 2,
        { duration: 200 }
      );
    },
    [getNodes, setNodes, setCenter]
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="h-[70vh] w-full rounded-2xl border border-[var(--mint-soft)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--mint-soft)]"
      style={{ minHeight: 400 }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={1.5}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        defaultEdgeOptions={{ type: "smoothstep" }}
        proOptions={{ hideAttribution: true }}
      />
    </div>
  );
}

export function KnowledgeGraphFlow({ graph }: { graph: ApiGraph }) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => getLayoutedElements(graph.nodes, graph.edges),
    [graph.nodes, graph.edges]
  );

  if (graph.nodes.length === 0) {
    return null;
  }

  return (
    <ReactFlowProvider
      initialNodes={initialNodes}
      initialEdges={initialEdges}
      initialWidth={800}
      initialHeight={500}
    >
      <FlowInner
        initialNodes={initialNodes}
        initialEdges={initialEdges}
      />
    </ReactFlowProvider>
  );
}
