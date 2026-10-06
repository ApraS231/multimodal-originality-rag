import { useEffect, useState, useRef } from 'react';

interface EmoticonInstance {
  id: number;
  char: string;
  x: number; // Persentase lebar viewport (0-100)
  y: number; // Posisi piksel awal di kanvas vertical
  speed: number; // Kecepatan parallax scroll
  size: number; // Ukuran font dalam rem
  opacity: number;
}

export default function FloatingEmoticons() {
  const [emoticons, setEmoticons] = useState<EmoticonInstance[]>([]);
  const scrollYRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const icons = ['📚', '💻', '🔍', '✏️', '🛡️', '✨', '📝', '🎓'];
    const instances: EmoticonInstance[] = [];

    // Buat 20 emoticon melayang acak yang tersebar di kanvas scrolling (mulai di bawah hero hingga sebelum CTA)
    for (let i = 0; i < 20; i++) {
      instances.push({
        id: i,
        char: icons[Math.floor(Math.random() * icons.length)],
        x: Math.random() * 84 + 8, // Hindari pinggir layar ekstrem
        y: Math.random() * 2200 + 750, // Mulai di bawah hero fold (750px) sampai 2950px
        speed: Math.random() * 0.25 + 0.1, // Faktor pergerakan paralaks
        size: Math.random() * 1.3 + 1.0, // 1.0rem - 2.3rem
        opacity: Math.random() * 0.3 + 0.12, // Opacity lembut agar tidak mendominasi konten
      });
    }
    setEmoticons(instances);

    const handleScroll = () => {
      scrollYRef.current = window.scrollY;
      
      // Update posisi menggunakan requestAnimationFrame + translate3d untuk performa 60FPS
      if (containerRef.current) {
        const children = containerRef.current.children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i] as HTMLElement;
          const speed = parseFloat(child.getAttribute('data-speed') || '0.2');
          // Hitung translasi berdasarkan scroll
          const translateVal = scrollYRef.current * speed;
          child.style.transform = `translate3d(0, ${-translateVal}px, 0)`;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Pemicu inisialisasi awal
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden"
    >
      {emoticons.map((emo) => (
        <div
          key={emo.id}
          data-speed={emo.speed}
          data-initial-y={emo.y}
          className="absolute transition-transform duration-100 ease-out select-none"
          style={{
            left: `${emo.x}%`,
            top: `${emo.y}px`,
            fontSize: `${emo.size}rem`,
            opacity: emo.opacity,
            willChange: 'transform',
          }}
        >
          {emo.char}
        </div>
      ))}
    </div>
  );
}
