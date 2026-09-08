import Topography from './Topography';
import ScrollFloat from './ScrollFloat';
import SpecularButton from './SpecularButton';
import BorderGlow from './BorderGlow';
import ScanWorkspace from './ScanWorkspace';
import { useRef, useState } from 'react';

/*
  Vulnora — landing page
*/

const tokens = {
  void: '#0A0E14',
  panel: '#121826',
  panelRaised: '#1B2430',
  hairline: '#263140',
  textMuted: '#8B98A9',
  textFaint: '#57657A',
  accent: '#7C6FFF',
  crit: '#FF5C5C',
  high: '#F5A623',
  low: '#5EEAD4',
};

function Nav({ onOpenScan }) {
  return (
    <header className="fixed top-5 inset-x-0 z-50 max-w-3xl mx-auto px-4 pointer-events-auto">
      <div
        className="px-6 h-13 flex items-center justify-between rounded-full backdrop-blur-xl shadow-2xl transition-all"
        style={{
          background: 'rgba(18, 24, 38, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.28)',
          boxShadow: '0 0 25px rgba(124, 111, 255, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.5), 0 12px 36px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-[18px] tracking-wide" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Vulnora</span>
        </div>
        <nav className="hidden md:flex items-center gap-7 text-[13.5px]" style={{ color: tokens.textMuted }}>
          <a href="#pipeline" className="hover:text-white transition-colors">How it works</a>
          <a href="#checks" className="hover:text-white transition-colors">Checks</a>
          <a href="#remediation" className="hover:text-white transition-colors">AI Remediation</a>
        </nav>
        <button
          onClick={onOpenScan}
          className="text-[13px] font-semibold px-4 py-1.5 rounded-full transition-transform active:scale-95 shadow-md hover:brightness-110 cursor-pointer"
          style={{ background: tokens.accent, color: tokens.void }}
        >
          Run a scan
        </button>
      </div>
    </header>
  );
}

function Hero({ onOpenScan }) {
  return (
    <section className="relative overflow-hidden min-h-screen flex flex-col justify-center pt-28 pb-16">
      {/* Topography shader background, hero only — covers 100% of top edge */}
      <div className="absolute inset-0 top-0 left-0 w-full h-full">
        <Topography
          lowColor="#5227FF"
          midColor="#A855F7"
          highColor="#FF9FFC"
          speed={0.25}
          morphAmount={1.6}
          morphSpeed={0.03}
          bands={0.7}
          thickness={0.008}
          scale={0.85}
          pixelSize={1.0}
          glow={0.35}
          colorMode="elevation"
          contrast={2.2}
          brightness={0.85}
          fillBands={false}
          opacity={0.85}
          grain={true}
          grainIntensity={0.03}
          mouseInteraction={true}
          mouseRadius={0.35}
          mouseStrength={0.3}
        />
      </div>

      {/* Scrim overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, rgba(10,14,20,0) 0%, rgba(10,14,20,0) 40%, rgba(10,14,20,0.18) 65%, rgba(10,14,20,0.5) 85%, ${tokens.void} 100%)`,
        }}
      />

      <div className="max-w-6xl mx-auto px-6 py-16 text-center relative z-10 flex flex-col items-center justify-center w-full">
        {/* MVP Main Text — Occupies 75% of Screen Middle */}
        <h1
          className="text-[44px] sm:text-[58px] md:text-[72px] lg:text-[84px] font-extrabold leading-[1.05] mb-10 tracking-tight text-center w-[85%] md:w-[75%] max-w-[1100px] mx-auto"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            color: '#F8F5FF',
            textShadow: '0 10px 40px rgba(0,0,0,0.6)',
          }}
        >
          Point it at a URL.<br />
          Get a security score<br />
          <span style={{ color: tokens.accent }}>you can act on.</span>
        </h1>

        {/* Centered SpecularButton CTA */}
        <div className="flex justify-center w-full">
          <SpecularButton
            size="lg"
            radius={24}
            tint="#161E2E"
            tintOpacity={0.9}
            blur={16}
            textColor="#FFFFFF"
            lineColor="#C084FC"
            baseColor="#7C6FFF"
            intensity={1.8}
            shineSize={18}
            shineFade={45}
            thickness={1.5}
            speed={0.4}
            followMouse
            proximity={320}
            autoAnimate={true}
            onClick={onOpenScan}
            className="shadow-[0_0_40px_rgba(124,111,255,0.3)] font-bold tracking-wide"
          >
            Get Started
          </SpecularButton>
        </div>
      </div>
    </section>
  );
}

function Pipeline() {
  const steps = [
    {
      n: '01',
      title: 'Scan',
      icon: (
        <svg className="w-7 h-7 text-[#7C6FFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      ),
      body: 'We probe headers, cookies, redirects and common exposed paths — nothing destructive.',
    },
    {
      n: '02',
      title: 'Score',
      icon: (
        <svg className="w-7 h-7 text-[#C084FC]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20V10" />
          <path d="M18 20V4" />
          <path d="M6 20v-4" />
        </svg>
      ),
      body: 'Findings roll up into a single 0–100 Security Health Score, weighted by severity.',
    },
    {
      n: '03',
      title: 'Explain',
      icon: (
        <svg className="w-7 h-7 text-[#A78BFA]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm1-5.5a1 1 0 0 0-1-1 2 2 0 0 1 2-2 2 2 0 0 0-4 0" />
        </svg>
      ),
      body: 'Each issue is sent to an AI model that explains what it means and why it matters.',
    },
    {
      n: '04',
      title: 'Fix',
      icon: (
        <svg className="w-7 h-7 text-[#818CF8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      ),
      body: 'Get remediation code for your stack — copy it straight into your config.',
    },
    {
      n: '05',
      title: 'Verify',
      icon: (
        <svg className="w-7 h-7 text-[#5EEAD4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
      body: 'Re-run the scan and watch your score move — before and after, side by side.',
    },
  ];

  const trackRef = useRef(null);
  const [active, setActive] = useState(0);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const onMouseDown = (e) => {
    isDragging.current = true;
    startX.current = e.pageX - trackRef.current.offsetLeft;
    scrollLeft.current = trackRef.current.scrollLeft;
    trackRef.current.style.cursor = 'grabbing';
  };
  const onMouseLeave = () => { isDragging.current = false; trackRef.current.style.cursor = 'grab'; };
  const onMouseUp = () => { isDragging.current = false; trackRef.current.style.cursor = 'grab'; };
  const onMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - trackRef.current.offsetLeft;
    trackRef.current.scrollLeft = scrollLeft.current - (x - startX.current);
  };

  const scrollTo = (idx) => {
    setActive(idx);
    const track = trackRef.current;
    const card = track.children[idx];
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft - 32, behavior: 'smooth' });
  };

  // Per-card glow accent palettes matching Vulnora tone
  const palettes = [
    { glow: '262 100 77', colors: ['#7c6fff', '#a78bfa', '#5eead4'] },
    { glow: '280 100 70', colors: ['#c084fc', '#818cf8', '#7c6fff'] },
    { glow: '258 90 72', colors: ['#a78bfa', '#f472b6', '#7c6fff'] },
    { glow: '245 80 68', colors: ['#818cf8', '#38bdf8', '#a78bfa'] },
    { glow: '270 90 75', colors: ['#c084fc', '#7c6fff', '#5eead4'] },
  ];

  return (
    <section id="pipeline" className="py-20" style={{ background: tokens.void }}>
      <div className="max-w-7xl mx-auto px-6 mb-12">
        <p className="text-[12px] mb-2 tracking-widest uppercase font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace", color: tokens.accent }}>HOW IT WORKS</p>
        <h2 className="text-[34px] font-bold text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Five steps, one loop</h2>
        <p className="text-[15px] mt-1.5 font-normal" style={{ color: tokens.textMuted }}>Every finding runs the same path — from detection to a verified fix.</p>
      </div>

      {/* Carousel track */}
      <div
        ref={trackRef}
        className="flex gap-6 overflow-x-auto pb-6 select-none"
        style={{
          paddingLeft: '5vw',
          paddingRight: '5vw',
          scrollbarWidth: 'none',
          cursor: 'grab',
        }}
        onMouseDown={onMouseDown}
        onMouseLeave={onMouseLeave}
        onMouseUp={onMouseUp}
        onMouseMove={onMouseMove}
        onScroll={() => {
          const track = trackRef.current;
          if (!track) return;
          const cards = track.children;
          let closest = 0;
          let minDist = Infinity;
          for (let i = 0; i < cards.length; i++) {
            const dist = Math.abs(cards[i].offsetLeft - track.scrollLeft - track.offsetLeft - 32);
            if (dist < minDist) { minDist = dist; closest = i; }
          }
          setActive(closest);
        }}
      >
        {steps.map((s, i) => (
          <div key={s.n} className="flex-none" style={{ width: '320px' }}>
            <BorderGlow
              edgeSensitivity={25}
              glowColor={palettes[i].glow}
              backgroundColor={tokens.panel}
              borderRadius={22}
              glowRadius={40}
              glowIntensity={1.1}
              coneSpread={24}
              colors={palettes[i].colors}
              fillOpacity={0.45}
              animated
            >
              <div className="p-8 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[12px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-md" style={{ fontFamily: "'IBM Plex Mono', monospace", background: 'rgba(124, 111, 255, 0.15)', color: tokens.accent }}>
                      STEP {s.n}
                    </span>
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                      {s.icon}
                    </div>
                  </div>
                  <h3 className="text-[22px] font-bold text-white mb-3 tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {s.title}
                  </h3>
                  <p className="text-[14.5px] leading-relaxed font-normal" style={{ color: tokens.textMuted }}>
                    {s.body}
                  </p>
                </div>
              </div>
            </BorderGlow>
          </div>
        ))}
      </div>

      {/* Dot navigation */}
      <div className="flex justify-center gap-2 mt-6">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollTo(i)}
            className="rounded-full transition-all"
            style={{
              width: active === i ? '20px' : '7px',
              height: '7px',
              background: active === i ? tokens.accent : tokens.hairline,
            }}
          />
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [view, setView] = useState('landing');

  if (view === 'scan') {
    return <ScanWorkspace onBack={() => setView('landing')} />;
  }

  return (
    <div style={{ background: tokens.void, color: 'white', minHeight: '100vh' }}>
      <Nav onOpenScan={() => setView('scan')} />
      <Hero onOpenScan={() => setView('scan')} />

      {/* ScrollFloat transition heading between hero and pipeline */}
      <div
        className="w-full flex justify-center py-48 my-10 min-h-[60vh] items-center overflow-hidden"
        style={{ background: tokens.void }}
      >
        <ScrollFloat
          animationDuration={1.6}
          ease="back.inOut(2)"
          scrollStart="top bottom-=20%"
          scrollEnd="bottom top+=20%"
          stagger={0.04}
          containerClassName="text-center w-full max-w-5xl px-6"
          textClassName="text-white font-extrabold"
        >
          HOW DOES VULNORA WORK?
        </ScrollFloat>
      </div>

      <Pipeline />
    </div>
  );
}