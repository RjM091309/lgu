import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Maximize, ZoomIn, ZoomOut } from 'lucide-react';

interface OrgNode {
  id: string;
  name: string;
  role: string;
  image?: string;
  children?: OrgNode[];
}

const orgData: OrgNode = {
  id: '1',
  name: 'Ramil M. Pulvera',
  role: 'Municipal Vice Mayor',
  image: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200&h=200&auto=format&fit=crop',
  children: [
    {
      id: 'sb-members',
      name: 'Sangguniang Bayan',
      role: 'SB Members',
      children: [
        {
          id: '2',
          name: 'Vinzsimon L. Ruila',
          role: 'SB Member',
          image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=150&h=150&auto=format&fit=crop',
        },
        {
          id: '3',
          name: 'Doreen Pahile P. Sandig',
          role: 'SB Member',
          image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=150&h=150&auto=format&fit=crop',
        },
        {
          id: '4',
          name: 'Arlyn Ryan F. Palabriga',
          role: 'SB Member',
          image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150&h=150&auto=format&fit=crop',
        },
        {
          id: '5',
          name: 'Rosary A. Balagtas',
          role: 'SB Member',
          image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&h=150&auto=format&fit=crop',
        },
        {
          id: '6',
          name: 'Eddie G. De Asis, Jr.',
          role: 'SB Member',
          image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150&h=150&auto=format&fit=crop',
        },
        {
          id: '7',
          name: 'John Ed Lindam D. Parrilla',
          role: 'SB Member',
          image: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=150&h=150&auto=format&fit=crop',
        },
        {
          id: '8',
          name: 'Filomeno P. Cadiz',
          role: 'SB Member',
          image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=150&h=150&auto=format&fit=crop',
        },
        {
          id: '9',
          name: 'Jessie S. Beldad',
          role: 'SB Member',
          image: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?q=80&w=150&h=150&auto=format&fit=crop',
        },
      ],
    },
    {
      id: 'sb-staff',
      name: 'SB Staff Support',
      role: 'Administrative Staff',
      children: [
        {
          id: '10',
          name: 'Edelyn M. Tadeo',
          role: 'SB Staff',
          image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=150&h=150&auto=format&fit=crop',
        },
        {
          id: '11',
          name: 'Inee Grace M. Nakila',
          role: 'SB Staff',
          image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=150&h=150&auto=format&fit=crop',
        },
        {
          id: '12',
          name: 'Jemarc P. Gementiza',
          role: 'SB Staff',
          image: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?q=80&w=150&h=150&auto=format&fit=crop',
        },
        {
          id: '13',
          name: 'Jocelyn C. Tianero',
          role: 'SB Staff',
          image: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?q=80&w=150&h=150&auto=format&fit=crop',
        },
      ],
    },
    {
      id: 'sec-sanggunian',
      name: 'Ian Loure V. Bajade',
      role: 'Secretary to the Sangguniang',
      image: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?q=80&w=150&h=150&auto=format&fit=crop',
      children: [
        {
          id: 'admin-ops',
          name: 'Administrative Operations',
          role: 'Section',
          children: [
            {
              id: '14',
              name: 'Robelyn L. Barrios',
              role: 'Admin Officer I',
              image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=150&h=150&auto=format&fit=crop',
            },
            {
              id: '15',
              name: 'Runitto D. Chan',
              role: 'Process Server',
              image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=150&h=150&auto=format&fit=crop',
            },
            {
              id: '16',
              name: 'Josephine S. Dela Peña',
              role: 'Admin Aide I',
              image: 'https://images.unsplash.com/photo-1619895862022-09114b41f16f?q=80&w=150&h=150&auto=format&fit=crop',
            },
          ],
        },
        {
          id: 'legislative-sec',
          name: 'Legislative Services',
          role: 'Section',
          children: [
            {
              id: '17',
              name: 'Rendil B. Delos Santos',
              role: 'Senior Admin Asst II',
              image: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?q=80&w=150&h=150&auto=format&fit=crop',
            },
            {
              id: '18',
              name: 'James D. Dulagson',
              role: 'Admin Asst II',
              image: 'https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?q=80&w=150&h=150&auto=format&fit=crop',
            },
            {
              id: '19',
              name: 'Duenadel M. Belceria',
              role: 'Board Secretary II',
              image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150&h=150&auto=format&fit=crop',
            },
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
          .text(d.data.name.charAt(0));
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
