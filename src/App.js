import React, { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================
// CONFIGURATION & ARE.NA CHANNEL SLUGS
// ============================================================
const ARCHIVE_CHANNEL = 'archive-4kwdmkcfu_y';
const PUBS_CHANNEL = 'publications-hoc7ciafzuq';
const FILM_CHANNEL = 'film-0iexlngxoz0';
const CHAPBOOK_CHANNEL = 'chapbook-ix8m-yr100a'; 

const SPORE_COUNT = 20; 

// ============================================================
// GEOMETRY & MATH ENGINE
// ============================================================
function generateFloorplanTargets(width, height, numPoints) {
  const targets = [];
  const w = Math.min(width, height) * 0.5; 
  const h = w * 0.7;     
  const cx = width / 2;
  const cy = height / 2;

  const segments = [
    [-w/2, -h/2, w/2, -h/2],   
    [w/2, -h/2, w/2, h/2],     
    [w/2, h/2, -w/2, h/2],     
    [-w/2, -h/2, -w/2, -h/6],  
    [-w/2, h/6, -w/2, h/2],    

    [-w/8, -w/8, w/8, -w/8],   
    [w/8, -w/8, w/8, w/8],     
    [w/8, w/8, -w/8, w/8],     
    [-w/8, w/8, -w/8, -w/8],   

    [-w/2 - w/6, -h/6, -w/2, -h/6],      
    [-w/2 - w/6, -h/6, -w/2 - w/6, h/6], 
    [-w/2 - w/6, h/6, -w/2, h/6]         
  ];

  let totalLength = 0;
  segments.forEach(seg => {
    seg.segLength = Math.hypot(seg[2] - seg[0], seg[3] - seg[1]);
    totalLength += seg.segLength;
  });

  segments.forEach(seg => {
    const pointsOnSegment = Math.floor((seg.segLength / totalLength) * numPoints);
    for (let i = 0; i < pointsOnSegment; i++) {
      const t = i / pointsOnSegment;
      targets.push({
        x: cx + seg[0] + (seg[2] - seg[0]) * t,
        y: cy + seg[1] + (seg[3] - seg[1]) * t
      });
    }
  });

 while (targets.length < numPoints) {
    const randomSeg = segments[Math.floor(Math.random() * segments.length)];
    const t = Math.random(); // random position along that line
    targets.push({
      x: cx + randomSeg[0] + (randomSeg[2] - randomSeg[0]) * t,
      y: cy + randomSeg[1] + (randomSeg[3] - randomSeg[1]) * t
    });
  }

  return targets.slice(0, numPoints);
}

// ============================================================
// CALM OSCILLATING SPORE VECTOR CLASS
// ============================================================
class Spore {
  constructor(x, y, blockData) {
    this.x = x;
    this.y = y;
    this.size = 50; 
    this.target = null;
    this.isHovered = false;
    this.blockData = blockData || null;

    // Fluid orbital coordinates for slow concentric loops
    this.angle = Math.random() * Math.PI * 2;
    this.angleSpeed = 0.003 + Math.random() * 0.006; 
    this.radiusX = 40 + Math.random() * 40;         
    this.radiusY = 30 + Math.random() * 30;
    
    // Smooth moving structural anchor
    this.anchorX = x;
    this.anchorY = y;
    this.vx = (Math.random() - 0.5) * 0.3;
    this.vy = (Math.random() - 0.5) * 0.3;
  }

  update(alignmentStrength, width, height) {
    if (this.isHovered) return; 

    this.angle += this.angleSpeed;

    // Lazily drift the core anchor frames
    this.anchorX += this.vx;
    this.anchorY += this.vy;

    const margin = 140;
    if (this.anchorX < margin) this.vx += 0.002;
    if (this.anchorX > width - margin) this.vx -= 0.002;
    if (this.anchorY < margin) this.vy += 0.002;
    if (this.anchorY > height - margin) this.vy -= 0.002;

    this.vx *= 0.99;
    this.vy *= 0.99;

    // Compute active floating position path
    const freeX = this.anchorX + Math.cos(this.angle) * this.radiusX;
    const freeY = this.anchorY + Math.sin(this.angle) * this.radiusY;

    if (this.target) {
      // Linearly interpolate coordinates directly inside the sine modulation flow
      const currentTargetX = freeX + (this.target.x - freeX) * alignmentStrength;
      const currentTargetY = freeY + (this.target.y - freeY) * alignmentStrength;

      const followEase = 0.0012; 
      this.x += (currentTargetX - this.x) * followEase;
      this.y += (currentTargetY - this.y) * followEase;
    } else {
      this.x += (freeX - this.x) * 0.03;
      this.y += (freeY - this.y) * 0.03;
    }
  }

  draw(ctx, img) {
    if (img && img.complete) {
      ctx.drawImage(
        img,
        this.x - this.size / 2,
        this.y - this.size / 2,
        this.size,
        this.size
      );
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#D9D9D9';
      ctx.fill();
    }
  }
}

// ============================================================
// MAIN APPLICATION MODULE
// ============================================================
const BoxText = ({ item, isScrolling = true }) => {
  const text = [item?.title, item?.description].filter(Boolean).join(' — ') || 'Untitled Record';
  return (
    <div className={`item-text-container ${isScrolling ? 'scrollable' : ''}`}>
      <span className="item-text-content">{text}</span>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState('home');
  const [archiveItems, setArchiveItems] = useState([]);
  const [pubItems, setPubItems] = useState([]);
  const [filmItems, setFilmItems] = useState([]);
  const [chapbookItems, setChapbookItems] = useState([]); 
  const [loading, setLoading] = useState(true);

  const [hoveredBlock, setHoveredBlock] = useState(null);
  const [activeLightboxIndex, setActiveLightboxIndex] = useState(-1);
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);
  const [isBioOpen, setIsBioOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileStatementExpanded, setMobileStatementExpanded] = useState(false);

  const [activeLightboxType, setActiveLightboxType] = useState(null); // Tracks 'pubs' or 'chapbooks'

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 600);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const sporeCanvasRef = useRef(null);
  const sporesRef = useRef([]);
  const sporeImgRef = useRef(null);

  useEffect(() => {
    const svgMarkup = `
    <svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="14.6984" cy="14.6984" r="14.6984" fill="url(#paint0_radial_1902_4183)"/>
    <defs>
    <radialGradient id="paint0_radial_1902_4183" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(14.6984 14.6984) rotate(90) scale(14.6984)">
    <stop stop-color="#D9D9D9"/>
    <stop offset="1" stop-color="#D9D9D9" stop-opacity="0"/>
    </radialGradient>
    </defs>
    </svg>
    `;

    const img = new Image();
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svgMarkup)}`;
    sporeImgRef.current = img;

    const fetchChannel = (id) => 
      fetch(`https://api.are.na/v2/channels/${id}/contents?per=50`)
        .then(res => res.json())
        .then(data => data.contents || []);

    Promise.all([
      fetchChannel(ARCHIVE_CHANNEL), 
      fetchChannel(PUBS_CHANNEL),
      fetchChannel(FILM_CHANNEL),
      fetchChannel(CHAPBOOK_CHANNEL)
    ])
      .then(([archive, pubs, film, chapbooks]) => {
        setArchiveItems(archive);
        setPubItems(pubs);
        setFilmItems(film);
        setChapbookItems(chapbooks);
        setLoading(false);
      })
      .catch(err => {
        console.error("Are.na pull failed:", err);
        setLoading(false);
      });
  }, []);

  const getLightboxItems = useCallback(() => {
    if (view === 'archive') return archiveItems;
    if (view === 'publications') {
      return activeLightboxType === 'chapbooks' ? chapbookItems : pubItems;
    }
    if (view === 'film') return filmItems;
    return [];
  }, [view, archiveItems, pubItems, chapbookItems, filmItems, activeLightboxType]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeLightboxIndex === -1) return;
      const currentItems = getLightboxItems();
      if (!currentItems.length) return;

      if (e.key === 'ArrowRight') {
        setActiveLightboxIndex((prev) => (prev + 1) % currentItems.length);
      } else if (e.key === 'ArrowLeft') {
        setActiveLightboxIndex((prev) => (prev - 1 + currentItems.length) % currentItems.length);
      } else if (e.key === 'Escape') {
        setActiveLightboxIndex(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLightboxIndex, getLightboxItems]);

  useEffect(() => {
    setHoveredBlock(null);
  }, [view]);

  // ============================================================
  // SEAMLESS TIMELINE OSCILLATOR PIPELINE
  // ============================================================
  useEffect(() => {
    if (view !== 'home' || loading || !sporeCanvasRef.current || isBioOpen) return;

    const canvas = sporeCanvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      const targets = generateFloorplanTargets(canvas.width, canvas.height, SPORE_COUNT);
      
      sporesRef.current = Array.from({ length: SPORE_COUNT }).map((_, i) => {
        const spore = new Spore(
          Math.random() * canvas.width, 
          Math.random() * canvas.height,
          archiveItems[i] || null
        );
        spore.target = targets[i];
        return spore;
      });
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const renderLoop = (timestamp) => {
      // Continuous waveform cycle mapping (~30s intervals)
      const wave = Math.cos(timestamp / 4500); 
      const alignmentStrength = (wave + 1) / 2; 

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      sporesRef.current.forEach((spore) => {
        spore.update(alignmentStrength, canvas.width, canvas.height);
        spore.draw(ctx, sporeImgRef.current);
      });

      animationFrameId = requestAnimationFrame(renderLoop);
    };
    animationFrameId = requestAnimationFrame(renderLoop);

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let matchFound = null;

      sporesRef.current.forEach((spore) => {
        const dist = Math.hypot(spore.x - mx, spore.y - my);
        
        // Increased from 25 to 55 to add a ~30px invisible hover buffer
        if (dist < 55) { 
          spore.isHovered = true;
          matchFound = spore.blockData;
        } else {
          spore.isHovered = false;
        }
      });
      setHoveredBlock(matchFound);
    };

    const handleMouseLeave = () => {
      sporesRef.current.forEach(s => s.isHovered = false);
      setHoveredBlock(null);
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [view, loading, archiveItems, isBioOpen]);

  const launchVideoTarget = (item) => {
    const rawUrl = item.source?.url || item.attachment?.url;
    if (!rawUrl) return;

    if (rawUrl.includes('youtube.com/watch')) {
      const urlObj = new URL(rawUrl);
      const vParam = urlObj.searchParams.get('v');
      if (vParam) {
        setActiveVideoUrl(`https://www.youtube.com/embed/${vParam}?autoplay=1`);
        return;
      }
    }
    if (rawUrl.includes('youtu.be/')) {
      const id = rawUrl.split('youtu.be/')[1]?.split(/[?#]/)[0];
      if (id) {
        setActiveVideoUrl(`https://www.youtube.com/embed/${id}?autoplay=1`);
        return;
      }
    }
    if (rawUrl.includes('vimeo.com/')) {
      const id = rawUrl.split('vimeo.com/')[1]?.split(/[?#]/)[0];
      if (id) {
        setActiveVideoUrl(`https://player.vimeo.com/video/${id}?autoplay=1`);
        return;
      }
    }
    setActiveVideoUrl(rawUrl);
  };

  const getActiveLightboxItem = () => {
    if (activeLightboxIndex === -1) return null;
    const items = getLightboxItems();
    return items[activeLightboxIndex] ?? null;
  };

  if (loading) return <div className="loading-screen italic"><i>9413 sophia ave</i></div>;

  return (
    <div className="app-container" style={{
      backgroundImage: (view === 'home' && hoveredBlock?.image?.display?.url && !isBioOpen) ? `url(${hoveredBlock.image.display.url})` : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      minHeight: '100vh'
    }}>
      
      <nav className="nav">
        <div className="nav-sentence">
          <i>9413 Sophia Ave</i> is a choreographed deconstruction of the built environment{' '}
          <span className="info-read-toggle" onClick={() => { setView('home'); setIsBioOpen(!isBioOpen); }}>
            {isBioOpen ? '(Read Less)' : '(Read More)'}
          </span>
        </div>

        <button className="nav-arrow" onClick={() => {
          const routes = ['home', 'film', 'publications', 'archive'];
          const nextIdx = (routes.indexOf(view) + 1) % routes.length;
          setView(routes[nextIdx]);
          setIsBioOpen(false);
        }}>
          <span>See {view === 'home' ? 'Film' : view === 'film' ? 'Publications' : view === 'publications' ? 'Archive' : 'Home'}</span>
          <svg width="65" height="30" viewBox="0 0 65 30" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 14.6485H63.8286M49.5336 28.9435L63.8286 14.6485L49.5336 0.353516" stroke="black"/>
          </svg>
        </button>
      </nav>

      <main className="page">
        {isBioOpen && (
          <div className="info-overlay-panel">
            <div className="info-page">
              <div className="info-col-left">
                <div className="info-section">
                  <h2 className="info-heading"><img src="/bro.svg" alt="*" className="heading-svg" /> Visiting</h2>
                  <p><LiveWeather />. The site is open to the public 24/7. The full address is 9413 Sophia Ave, Cleveland, OH 44104. <a href="https://www.google.com/maps/place/9413+Sophia+Ave,+Cleveland,+OH+44104/@41.4789004,-81.6206986,31m/data=!3m1!1e3!4m6!3m5!1s0x8830fb6be83f1231:0x9156bee96b04d52f!8m2!3d41.4790367!4d-81.6207346!16s%2Fg%2F11c2bq42wh?entry=ttu&g_ep=EgoyMDI2MDYxMC4wIKXMDSoASAFQAw%3D%3D">Get directions</a>.</p>
                </div>

                <div className="info-section">
                  <h2 className="info-heading"><img src="/bro.svg" alt="*" className="heading-svg" /> Statement</h2>
                  <div className={`statement-text ${isMobile && !mobileStatementExpanded ? 'collapsed' : ''}`}>
                    <p>9413 Sophia Ave is both an address and the title of a durational, in situ performance which took place from September 2024 - September 2025.</p>
                    <p>Driven by an interest in the life cycle of structures, 9413 Sophia Ave operated as a case study with the aim to enact collective maintenance and intentional turnover of a structure through an active exchange with peoples' interest in their own neighborhood.</p>
                    <p>This social practice work took interest in the relationship between several local environmental justice organizations with focuses on varied aspects of the built environment, seeking to emphasize the group's existing working dynamic and engage the broader community through workshops and onsite gatherings.</p>
                    <p>The year-long performance involved the choreographed deconstruction and the subsequent recycling and biocycling of a home which was condemned by the Cuyahoga Land Bank – this resulted in a participatorily designed installation on the site. By using the concept of biocycling as an artistic medium, the life cycle of a built structure could be considered from myriad perspectives – the material as well as the cultural.</p>
                    <p>Biocycling refers to a process of using a waste product – in this case, demolition waste – as a substrate to be bound together by mycelium. The resultant substance can be used as an alternative building material for sculptural or, potentially, structural purposes. The material treatment within 9413 Sophia Ave is situated in a post-industrial and post-recycling cultural landscape – it aimed to recycle in an active, rather than passive, sense.</p>
                    <p>In addition to the physical performance, this work resulted in two publications in collaboration with Colin Martinez, and a forthcoming documentary film by Jacob Koestler and Michael McDermit of Blurry Pictures.</p>
                    <p>This work was made possible through the support of the City of Cleveland and Cleveland City Council's Transformative Arts Fund, a portion of American Rescue Plan Act funds allotted for public art.</p>
                  </div>
                  {isMobile && !mobileStatementExpanded && (
                    <button className="read-more-btn" onClick={() => setMobileStatementExpanded(true)}>Read More</button>
                  )}
                </div>

                <div className="info-section">
                  <h2 className="info-heading"><img src="/bro.svg" alt="*" className="heading-svg" /> Thanks to our project team</h2>
                  <div className="info-team-list">
                    <a href="https://malenagrigoli.com/" style={{textDecoration: 'none', color: 'inherit'}}><div className="info-team-row"><span>Malena Grigoli</span><span>Project Lead</span></div></a>
                    <a href="https://colinmartinez.xyz/" style={{textDecoration: 'none', color: 'inherit'}}><div className="info-team-row"><span>Colin Martinez</span><span>Photographer</span></div></a>
                    <a href="https://cjcontractorsco.com/" style={{textDecoration: 'none', color: 'inherit'}}><div className="info-team-row"><span>C&J Contractors</span><span>Demolition</span></div></a>
                    <a href="https://www.redhousearchitecture.org/design" style={{textDecoration: 'none', color: 'inherit'}}><div className="info-team-row"><span>redhouse studio</span><span>Institutional Partner</span></div></a>
                    <a href="https://blurry-pictures.com/" style={{textDecoration: 'none', color: 'inherit'}}><div className="info-team-row"><span>Blurry Pictures</span><span>Videography</span></div></a>
                    <a href="https://www.linkedin.com/in/robin-brown-3033555a/" style={{textDecoration: 'none', color: 'inherit'}}><div className="info-team-row"><span>Robin Brown</span><span>Lead Contamination Consulting</span></div></a>
                    <a href="https://www.linkedin.com/in/jenniferlumpkin/" style={{textDecoration: 'none', color: 'inherit'}}><div className="info-team-row"><span>Jennifer Lumpkin</span><span>Lead Field Agronomist</span></div></a>
                    <a href="https://www.linkedin.com/in/indigobishop" style={{textDecoration: 'none', color: 'inherit'}}><div className="info-team-row"><span>Indigo Bishop</span><span>Community Organizing</span></div></a>
                    <div className="info-team-row"><span>Cuyahoga Land Bank</span><span>Project Partner</span></div>
                    <div className="info-team-row"><span>Transformative Arts Fund</span><span>Funding</span></div>
                    <a href="https://www.harperdaniel.com/" style={{textDecoration: 'none', color: 'inherit'}}><div className="info-team-row"><span>Harper Daniel</span><span>Website</span></div></a>
                  </div>
                </div>
              </div>

              <div className="info-col-right">
                {isMobile && <h2 className="info-heading mobile-contact-heading"><img src="/bro.svg" alt="*" className="heading-svg" /> Contact</h2>}
                <a href="mailto:malenagrigoli@gmail.com" className="contact-link-block">
                  <div className="hover-contact-ui"><img src="/bro.svg" alt="*" className="heading-svg" /> Contact</div>
                  <h3>Interested in scheduling a talk?</h3>
                  <img src="/contact-1.png" alt="Interior Details" /> 
                </a>
                <a href="mailto:malenagrigoli@gmail.com" className="contact-link-block">
                  <div className="hover-contact-ui"><img src="/bro.svg" alt="*" className="heading-svg" /> Contact</div>
                  <h3>Interested in showing the film?</h3>
                  <img src="/contact-2.jpg" alt="Aerial Demolition" />
                </a>
                <a href="mailto:malenagrigoli@gmail.com" className="contact-link-block">
                  <div className="hover-contact-ui"><img src="/bro.svg" alt="*" className="heading-svg" /> Contact</div>
                  <h3>Interested in carrying the book?</h3>
                  <img src="/contact-3.jpg" alt="Book spread" />
                </a>
              </div>
            </div>
          </div>
        )}

        {view === 'home' && !isBioOpen && (
          <div className="home-wrap">
            <canvas ref={sporeCanvasRef} className="spore-canvas" />
          </div>
        )}

       {view === 'film' && !isBioOpen && (
          <div className="film-container">
            {filmItems.map((item) => {
              // Extract the text logic here so we don't need the BoxText component
              const text = [item?.title, item?.description].filter(Boolean).join(' — ') || 'Untitled Record';

              return (
                <div 
                  key={item.id} 
                  onMouseEnter={() => setHoveredBlock(item)}
                  onMouseLeave={() => setHoveredBlock(null)}
                  className="film-blocks"
                  style={{ display: 'flex', flexDirection: 'column' }}
                >
                  <div className="film-block-img-wrap" onClick={() => launchVideoTarget(item)}>
                    {item.image?.large?.url && <img src={item.image.large.url} alt="" />}
                    {(item.source?.url || item.attachment?.url) && (
                      <div className="film-block-play">[PLAY VIDEO]</div>
                    )}
                    {text}
                  </div>
                  
                 
                </div> 
              );
            })}
          </div>
        )}

       {view === 'publications' && !isBioOpen && (
          <div 
            className="publications-wrapper" 
            style={{ display: 'flex', flexDirection: 'row' }}
          >
            
            {/* LEFT COLUMN: CHAPBOOKS */}
            <div className="pub-column" style={{ flex: 1 }}>
              {chapbookItems.map((pub, index) => (
                <div 
                  key={pub.id} 
                  className="pub-block"
                  onClick={() => {
                    setActiveLightboxIndex(index);
                    setActiveLightboxType('chapbooks');
                  }}
                  onMouseEnter={() => setHoveredBlock(pub)}
                  onMouseLeave={() => setHoveredBlock(null)}
                >
                  {pub.image?.large?.url && <img src={pub.image.large.url} alt={pub.title} />}
                  {index === 0 && <BoxText item={pub} />}
                </div>
              ))}
            </div>

            {/* RIGHT COLUMN: PUBLICATIONS */}
            <div className="pub-column" style={{ flex: 1 }}>
              {pubItems.map((pub, index) => (
                <div 
                  key={pub.id} 
                  className="pub-block"
                  onClick={() => {
                    setActiveLightboxIndex(index);
                    setActiveLightboxType('pubs');
                  }}
                  onMouseEnter={() => setHoveredBlock(pub)}
                  onMouseLeave={() => setHoveredBlock(null)}
                >
                  {pub.image?.large?.url && <img src={pub.image.large.url} alt={pub.title} />}
                  {index === 0 && <BoxText item={pub} />}
                </div>
              ))}
            </div>

          </div>
        )}

        {view === 'archive' && !isBioOpen && (
          <div className="archive-col">
            {archiveItems.map((item, index) => (
              <div 
                key={item.id} 
                className="archive-block" 
                onClick={() => setActiveLightboxIndex(index)}
                onMouseEnter={() => setHoveredBlock(item)}
                onMouseLeave={() => setHoveredBlock(null)}
                style={{ marginBottom: `${(index % 3) * 16}px` }}
              >
                {item.image?.display?.url && <img src={item.image.display.url} alt={item.title} />}
                <BoxText item={item} />
              </div>
            ))}
          </div>
        )}
      </main>

      {activeLightboxIndex !== -1 && (
        <div className="lightbox" onClick={() => setActiveLightboxIndex(-1)}>
          <div className="lightbox-top-left">
             {getActiveLightboxItem() && <BoxText item={getActiveLightboxItem()} isScrolling={false} />}
          </div>
          <span className="lightbox-close">(close)</span>
          <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
            <div className="lightbox-img-wrap">
              <img 
                src={getActiveLightboxItem()?.image?.large?.url} 
                alt="" 
              />
            </div>
          </div>
        </div>
      )}

      {activeVideoUrl && (
        <div className="video-modal" onClick={() => setActiveVideoUrl(null)}>
          <div className="video-modal-inner" onClick={e => e.stopPropagation()}>
            <span className="video-modal-close">(close)</span>
            <div className="video-embed-wrapper">
              <iframe 
                src={activeVideoUrl} 
                title="Video Embed" 
                allowFullScreen 
                allow="autoplay; fullscreen"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// HYPERLOCAL COORDINATE OPEN-METEO WEATHER ENGINE
// ============================================================
function LiveWeather() {
  const [weather, setWeather] = useState({ temp: '--°F', condition: 'loading' });

  useEffect(() => {
    const lat = 41.4820;
    const lon = -81.6521;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        if (data?.current) {
          const currentTemp = Math.round(data.current.temperature_2m);
          const code = data.current.weather_code;
          
          let condStr = 'clear';
          if (code >= 1 && code <= 3) condStr = 'partly cloudy';
          if (code >= 45 && code <= 48) condStr = 'foggy';
          if (code >= 51 && code <= 67) condStr = 'raining';
          if (code >= 71 && code <= 77) condStr = 'snowing';
          if (code >= 80) condStr = 'stormy';

          setWeather({ temp: `${currentTemp}°F`, condition: condStr });
        }
      })
      .catch(() => {
        setWeather({ temp: '64°F', condition: 'overcast' }); 
      });
  }, []);

  return (
    <span className="inline-weather">The weather is {weather.condition} and {weather.temp}</span>
  );
}
