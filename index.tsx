import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';

// --- CONSTANTS ---
const BIRTHS_PER_SECOND = 4.3; // Global average approx.
const ROTATION_SPEED = 0.015;
const FLASH_DURATION = 3500;
const GEO_URL = 'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson';

const MAJOR_COUNTRIES: Record<string, number> = {
  'IND': 140, 'CHN': 120, 'NGA': 90, 'PAK': 80, 'IDN': 70, 'BRA': 60, 'ETH': 55,
  'BGD': 55, 'USA': 50, 'COD': 50, 'MEX': 45, 'PHL': 45, 'EGY': 40, 'VNM': 40
};

const COLORS = {
  LAND: '#121008',
  BORDER: '#2a2205',
  GOLD: '#ffd700',
  BG: '#020202'
};

// --- COMPONENTS ---

const Globe = ({ flashes }: { flashes: Map<string, number> }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const geoData = useRef<any>(null);
  const rotation = useRef(0);

  useEffect(() => {
    d3.json(GEO_URL).then(data => { geoData.current = data; });

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    let rafId: number;
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas || !geoData.current) {
        rafId = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext('2d')!;
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const radius = Math.min(width, height) * 0.46;
      const centerX = width > 768 ? width * 0.75 : width / 2;
      const centerY = height / 2;

      const projection = d3.geoOrthographic()
        .scale(radius)
        .translate([centerX, centerY])
        .rotate([rotation.current, -15]);

      const path = d3.geoPath(projection, ctx);

      // Sphere Base
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = COLORS.BG;
      ctx.fill();

      // Draw Geography
      geoData.current.features.forEach((feature: any) => {
        const id = feature.id || feature.properties.ISO_A3 || feature.properties.name;
        const lastFlash = flashes.get(id);
        const isActive = lastFlash && (Date.now() - lastFlash < FLASH_DURATION);

        ctx.beginPath();
        path(feature);

        if (isActive && lastFlash) {
          const t = 1 - ((Date.now() - lastFlash) / FLASH_DURATION);
          ctx.fillStyle = d3.interpolateRgb(COLORS.LAND, COLORS.GOLD)(t);
          ctx.shadowBlur = 30 * t;
          ctx.shadowColor = COLORS.GOLD;
        } else {
          ctx.fillStyle = COLORS.LAND;
          ctx.shadowBlur = 0;
        }

        ctx.fill();
        ctx.strokeStyle = isActive ? COLORS.GOLD : COLORS.BORDER;
        ctx.lineWidth = isActive ? 1.2 : 0.5;
        ctx.stroke();
      });

      rotation.current += ROTATION_SPEED;
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
    };
  }, [flashes]);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />;
};

const App = () => {
  const [totalBirths, setTotalBirths] = useState(0);
  const [flashes, setFlashes] = useState<Map<string, number>>(new Map());
  const [log, setLog] = useState<{id: number, name: string, time: string}[]>([]);
  const [currentTime, setCurrentTime] = useState('');
  const worldData = useRef<any>(null);

  useEffect(() => {
    // Initial data load
    d3.json(GEO_URL).then(data => { worldData.current = data; });

    // Counter Logic
    const initStats = () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
      const elapsed = (now.getTime() - start) / 1000;
      setTotalBirths(Math.floor(elapsed * BIRTHS_PER_SECOND));
      setCurrentTime(now.toLocaleTimeString('en-GB', { hour12: false }));
    };
    initStats();
    const timer = setInterval(initStats, 1000);

    // Birth Spawner
    const spawnBirth = () => {
      const wait = (1000 / BIRTHS_PER_SECOND) * (0.8 + Math.random() * 0.4);
      setTimeout(() => {
        if (worldData.current) {
          const countries = worldData.current.features;
          let selected;
          
          // Weighted random
          if (Math.random() > 0.35) {
            const keys = Object.keys(MAJOR_COUNTRIES);
            const k = keys[Math.floor(Math.random() * keys.length)];
            selected = countries.find((f: any) => (f.id === k || f.properties.ISO_A3 === k));
          }
          if (!selected) selected = countries[Math.floor(Math.random() * countries.length)];

          const countryId = selected.id || selected.properties.ISO_A3 || selected.properties.name;
          const countryName = selected.properties.name || "Unknown Area";

          setFlashes(prev => {
            const next = new Map(prev);
            next.set(countryId, Date.now());
            // Keep map small
            if (next.size > 20) next.delete(next.keys().next().value);
            return next;
          });

          setLog(prev => [{
            id: Date.now(),
            name: countryName,
            time: new Date().toLocaleTimeString('en-GB', { hour12: false })
          }, ...prev].slice(0, 8));
        }
        spawnBirth();
      }, wait);
    };
    spawnBirth();

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full h-screen bg-[#020202] overflow-hidden">
      <Globe flashes={flashes} />
      <div className="vignette" />
      
      {/* HUD Overlay */}
      <div className="relative z-10 w-full h-full p-8 md:p-16 flex flex-col justify-between pointer-events-none">
        
        {/* TOP BAR */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_10px_#ffd700]" />
            <h2 className="text-[10px] font-black tracking-[1em] text-yellow-500/60 uppercase font-mono">
              Live_Population_Telemetery
            </h2>
          </div>
          <div className="h-[1px] w-48 bg-yellow-500/20" />
        </div>

        {/* MIDDLE SECTION */}
        <div className="flex flex-col md:flex-row items-end justify-between w-full gap-12">
          
          {/* Main Counter */}
          <div className="flex flex-col items-start">
            <p className="text-[10px] font-bold tracking-[0.4em] text-yellow-500/30 uppercase mb-4 italic">Estimated Births Today</p>
            <h1 className="gold-glow text-[6rem] md:text-[10rem] font-black tracking-tighter text-yellow-400 leading-none tabular-nums">
              {totalBirths.toLocaleString('en-GB')}
            </h1>
            <div className="mt-10 flex items-center gap-6 px-6 py-2 glass rounded-full border border-yellow-500/10">
              <span className="text-xl font-mono font-bold text-yellow-400">{currentTime}</span>
              <span className="text-[9px] text-yellow-500/40 uppercase tracking-widest font-black">Local_Node</span>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="w-full md:w-72 p-8 glass rounded-[2rem] pointer-events-auto">
            <div className="flex justify-between items-center mb-6 pb-2 border-b border-yellow-500/10">
              <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500/50">Recent_Spawns</span>
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-yellow-500 rounded-full animate-bounce [animation-delay:0s]" />
                <div className="w-1 h-1 bg-yellow-500 rounded-full animate-bounce [animation-delay:0.1s]" />
              </div>
            </div>
            <div className="space-y-5">
              {log.length === 0 && <div className="text-[10px] text-yellow-500/10 uppercase italic">Scanning frequencies...</div>}
              {log.map((entry, i) => (
                <div key={entry.id} className="flex flex-col animate-in fade-in slide-in-from-left duration-700" style={{ opacity: 1 - i * 0.12 }}>
                  <span className="text-[8px] font-bold text-yellow-500/30 uppercase mb-0.5 tracking-tighter">Event @ {entry.time}</span>
                  <span className="text-lg font-black text-white/90 uppercase tracking-wide truncate">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-between items-end text-[9px] font-mono font-bold text-yellow-500/20 uppercase tracking-[0.5em]">
          <div className="flex flex-col gap-1">
            <span>Lat: 0.00 | Lon: 0.00</span>
            <span>Auth: Alpha_Protocol</span>
          </div>
          <span>© 2026 Precision Demographics</span>
        </div>

      </div>
    </div>
  );
};

// --- RENDER ---
const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
