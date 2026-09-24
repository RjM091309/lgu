import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react';

interface OrgNode {
  id: string;
  name: string;
  role: string;
  abbr?: string;
  image?: string;
  children?: OrgNode[];
}

// Positions only: officials and staff are intentionally not named.
const orgData: OrgNode = {
  id: 'vm',
  name: 'Municipal Vice Mayor',
  role: 'Presiding Officer',
  abbr: 'VM',
  children: [
    {
      id: 'sb-members',
      name: 'Sangguniang Bayan Members',
      role: 'Legislative Body',
      abbr: 'SB',
      children: [
        { id: 'mc1', name: 'Municipal Councilor (1st)', role: 'SB Member', abbr: 'MC1' },
        { id: 'mc2', name: 'Municipal Councilor (2nd)', role: 'SB Member', abbr: 'MC2' },
        { id: 'mc3', name: 'Municipal Councilor (3rd)', role: 'SB Member', abbr: 'MC3' },
        { id: 'mc4', name: 'Municipal Councilor (4th)', role: 'SB Member', abbr: 'MC4' },
        { id: 'mc5', name: 'Municipal Councilor (5th)', role: 'SB Member', abbr: 'MC5' },
        { id: 'mc6', name: 'Municipal Councilor (6th)', role: 'SB Member', abbr: 'MC6' },
        { id: 'mc7', name: 'Municipal Councilor (7th)', role: 'SB Member', abbr: 'MC7' },
        { id: 'mc8', name: 'Municipal Councilor (8th)', role: 'SB Member', abbr: 'MC8' },
        { id: 'ipmr', name: 'IPMR Representative', role: 'Ex-officio SB Member', abbr: 'IP' },
        { id: 'abc', name: 'ABC President', role: 'Ex-officio SB Member', abbr: 'ABC' },
        { id: 'skf', name: 'SK Federation President', role: 'Ex-officio SB Member', abbr: 'SK' },
      ],
    },
    {
      id: 'sec-sanggunian',
      name: 'Secretary to the Sanggunian',
      role: 'SB Secretariat',
      abbr: 'SEC',
      children: [
        {
          id: 'legislative-services',
          name: 'Legislative Services',
          role: 'Section',
          abbr: 'LS',
          children: [
            { id: 'legislative-staff', name: 'Legislative Staff', role: 'Legislative Services', abbr: 'LS' },
            { id: 'records-officer', name: 'Records Officer', role: 'Legislative Services', abbr: 'RO' },
          ],
        },
        {
          id: 'admin-services',
          name: 'Administrative Services',
          role: 'Section',
          abbr: 'AS',
          children: [
            { id: 'admin-officer', name: 'Administrative Officer', role: 'Administrative Services', abbr: 'AO' },
            { id: 'admin-aide', name: 'Administrative Aide', role: 'Administrative Services', abbr: 'AA' },
          ],
        },
      ],
    },
  ],
};

const NODE_WIDTH = 190;
const NODE_HEIGHT = 258;
const HORIZONTAL_SPACING = 240;
const VERTICAL_SPACING = 320;

export function LegislativeOrgChart() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const svgSelectionRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const initialTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (!containerRef.current) return;
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);
    updateDimensions();

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('class', 'chart-content');
    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
        setZoomLevel(event.transform.k);
      });

    svg.call(zoomBehavior);
    svgSelectionRef.current = svg;
    zoomBehaviorRef.current = zoomBehavior;

    const root = d3.hierarchy<OrgNode>(orgData);
    const treeLayout = d3.tree<OrgNode>().nodeSize([HORIZONTAL_SPACING, VERTICAL_SPACING]);
    treeLayout(root);

    const nodes = root.descendants();
    const minX = d3.min(nodes, (d) => d.x - NODE_WIDTH / 2) ?? 0;
    const maxX = d3.max(nodes, (d) => d.x + NODE_WIDTH / 2) ?? 0;
    const minY = d3.min(nodes, (d) => d.y - NODE_HEIGHT / 2) ?? 0;
    const maxY = d3.max(nodes, (d) => d.y + NODE_HEIGHT / 2) ?? 0;

    const chartWidth = maxX - minX;
    const chartHeight = maxY - minY;
    const DEFAULT_SCALE = 0.3;
    const scale = DEFAULT_SCALE;

    const initialTransform = d3.zoomIdentity
      .translate(
        dimensions.width / 2 - (minX + chartWidth / 2) * scale,
        dimensions.height / 2 - (minY + chartHeight / 2) * scale,
      )
      .scale(scale);

    initialTransformRef.current = initialTransform;
    svg.call(zoomBehavior.transform, initialTransform);

    g.selectAll('.link')
      .data(root.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('d', (d) => {
        const sourceX = d.source.x;
        const sourceY = d.source.y + NODE_HEIGHT / 2;
        const targetX = d.target.x;
        const targetY = d.target.y - NODE_HEIGHT / 2;
        const midY = sourceY + (targetY - sourceY) * 0.45;
        return `M${sourceX},${sourceY} C${sourceX},${midY} ${targetX},${midY} ${targetX},${targetY}`;
      })
      .attr('fill', 'none')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1.6)
      .attr('stroke-linecap', 'round')
      .attr('stroke-dasharray', '4 4')
      .attr('opacity', 0.8);

    const node = g
      .selectAll('.node')
      .data(root.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.x - NODE_WIDTH / 2},${d.y - NODE_HEIGHT / 2})`);

    node
      .append('rect')
      .attr('width', NODE_WIDTH)
      .attr('height', NODE_HEIGHT)
      .attr('rx', 20)
      .attr('fill', 'white')
      .attr('stroke', '#dbe4ef')
      .attr('stroke-width', 1)
      .style('filter', 'drop-shadow(0 12px 20px rgba(15, 23, 42, 0.12))');

    const IMAGE_HEIGHT = 186;
    node.each(function (d) {
      const nodeG = d3.select(this);
      const clipId = `clip-top-${d.data.id}`;

      nodeG
        .append('clipPath')
        .attr('id', clipId)
        .append('path')
        .attr(
          'd',
          `M 0,16 Q 0,0 16,0 H ${NODE_WIDTH - 16} Q ${NODE_WIDTH},0 ${NODE_WIDTH},16 V ${IMAGE_HEIGHT} H 0 Z`,
        );

      if (d.data.image) {
        nodeG
          .append('image')
          .attr('href', d.data.image)
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', NODE_WIDTH)
          .attr('height', IMAGE_HEIGHT)
          .attr('preserveAspectRatio', 'xMidYMin slice')
          .attr('clip-path', `url(#${clipId})`);
      } else {
        nodeG
          .append('rect')
          .attr('width', NODE_WIDTH)
          .attr('height', IMAGE_HEIGHT)
          .attr('fill', '#f1f5f9')
          .attr('clip-path', `url(#${clipId})`);

        nodeG
          .append('text')
          .attr('x', NODE_WIDTH / 2)
          .attr('y', IMAGE_HEIGHT / 2 + 10)
          .attr('text-anchor', 'middle')
          .attr('fill', '#94a3b8')
          .style('font-size', '32px')
          .style('font-weight', 'bold')
          .text(d.data.abbr ?? d.data.name.charAt(0));
      }

      nodeG
        .append('rect')
        .attr('x', 0)
        .attr('y', IMAGE_HEIGHT)
        .attr('width', NODE_WIDTH)
        .attr('height', NODE_HEIGHT - IMAGE_HEIGHT)
        .attr('fill', '#f8fafc');

      nodeG
        .append('line')
        .attr('x1', 16)
        .attr('x2', NODE_WIDTH - 16)
        .attr('y1', IMAGE_HEIGHT)
        .attr('y2', IMAGE_HEIGHT)
        .attr('stroke', '#e2e8f0')
        .attr('stroke-width', 1);
    });

    const textGroup = node.append('g').attr('transform', `translate(${NODE_WIDTH / 2}, ${IMAGE_HEIGHT + 24})`);

    textGroup
      .append('text')
      .attr('class', 'name-text')
      .attr('fill', '#0f172a')
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('font-weight', '700')
      .style('font-family', '"Inter", sans-serif')
      .each(function (d) {
        const words = d.data.name.split(/\s+/);
        const el = d3.select(this);
        if (words.length > 3) {
          el.text(words.slice(0, 2).join(' '));
          el.append('tspan').attr('x', 0).attr('dy', '1.2em').text(words.slice(2).join(' '));
        } else {
          el.text(d.data.name);
        }
      });

    textGroup
      .append('text')
      .attr('class', 'role-text')
      .attr('dy', (d) => (d.data.name.split(/\s+/).length > 3 ? '2.6em' : '1.6em'))
      .attr('fill', '#475569')
      .attr('text-anchor', 'middle')
      .style('font-size', '10.5px')
      .style('font-weight', '600')
      .style('font-family', '"Inter", sans-serif')
      .text((d) => d.data.role);

    node
      .on('mouseover', function () {
        d3.select(this)
          .raise()
          .select('rect')
          .transition()
          .duration(180)
          .attr('stroke', '#1d4ed8')
          .attr('stroke-width', 2)
          .style('filter', 'drop-shadow(0 18px 28px rgba(30, 64, 175, 0.2))');
      })
      .on('mouseout', function () {
        d3.select(this)
          .select('rect')
          .transition()
          .duration(180)
          .attr('stroke', '#dbe4ef')
          .attr('stroke-width', 1)
          .style('filter', 'drop-shadow(0 12px 20px rgba(15, 23, 42, 0.12))');
      });
  }, [dimensions]);

  const zoomIn = () => {
    if (!svgSelectionRef.current || !zoomBehaviorRef.current) return;
    svgSelectionRef.current.transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 1.2);
  };

  const zoomOut = () => {
    if (!svgSelectionRef.current || !zoomBehaviorRef.current) return;
    svgSelectionRef.current.transition().duration(300).call(zoomBehaviorRef.current.scaleBy, 0.8);
  };

  const resetZoom = () => {
    if (!svgSelectionRef.current || !zoomBehaviorRef.current) return;
    svgSelectionRef.current
      .transition()
      .duration(750)
      .call(zoomBehaviorRef.current.transform, initialTransformRef.current);
  };

  return (
    <div
      className="relative h-[560px] w-full overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-white/95 via-white/85 to-blue-50/60 shadow-[0_30px_65px_-32px_rgba(15,23,42,0.65)] backdrop-blur-sm md:h-[620px]"
      ref={containerRef}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.20),transparent_50%)]" />
      <svg ref={svgRef} width="100%" height="100%" className="relative z-10 cursor-grab active:cursor-grabbing" />

      <div className="absolute right-5 top-5 z-20 flex flex-row gap-2 rounded-xl border border-slate-200/80 bg-white/90 p-2 shadow-lg backdrop-blur">
        <button
          onClick={zoomIn}
          className="rounded-lg border border-slate-200 bg-white p-2.5 transition-all hover:border-blue-200 hover:bg-blue-50 active:scale-95"
          title="Zoom In"
        >
          <ZoomIn className="h-4.5 w-4.5 text-slate-700" />
        </button>
        <button
          onClick={zoomOut}
          className="rounded-lg border border-slate-200 bg-white p-2.5 transition-all hover:border-blue-200 hover:bg-blue-50 active:scale-95"
          title="Zoom Out"
        >
          <ZoomOut className="h-4.5 w-4.5 text-slate-700" />
        </button>
        <button
          onClick={resetZoom}
          className="rounded-lg border border-slate-200 bg-white p-2.5 transition-all hover:border-blue-200 hover:bg-blue-50 active:scale-95"
          title="Reset View"
        >
          <Maximize className="h-4.5 w-4.5 text-slate-700" />
        </button>
      </div>

      <div className="absolute bottom-5 left-5 z-20 rounded-lg border border-slate-200/70 bg-white/85 px-3 py-2 backdrop-blur">
        <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
          Zoom: {Math.round(zoomLevel * 100)}% | Drag to pan
        </p>
      </div>
    </div>
  );
}
