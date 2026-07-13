import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export const FloatingOctopus: React.FC = () => {
  const [frameIndex, setFrameIndex] = useState(0);
  const frames = ['/sitelogo1.png', '/sitelogo2.png', '/sitelogo3.png', '/sitelogo2.png'];

  // İlk hedefi ve açıyı bileşen dışında veya ilk renderda hesapla
  const [targetPos, setTargetPos] = useState(() => ({
    x: Math.random() * 98 + 1,
    y: Math.random() * 98 + 1
  }));

  const [rotation, setRotation] = useState(() => {
    const dx = targetPos.x - 50;
    const dy = targetPos.y - 50;
    return Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  });

  useEffect(() => {
    // Kare geçişi (yürüme/yüzme döngüsü: 1-2-3-2)
    const frameInterval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % 4);
    }, 200);
    return () => clearInterval(frameInterval);
  }, []);

  useEffect(() => {
    const moveRandomly = () => {
      const nextX = Math.random() * 98 + 1;
      const nextY = Math.random() * 98 + 1;

      setTargetPos(prev => {
        const dx = nextX - prev.x;
        const dy = nextY - prev.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        setRotation(angle);
        return { x: nextX, y: nextY };
      });
    };

    // İlk hareket zaten state initialization'da kuruldu, 
    // bu yüzden hemen moveRandomly çağırmaya gerek yok, interval yeterli.
    const moveInterval = setInterval(moveRandomly, 11000); 
    return () => clearInterval(moveInterval);
  }, [targetPos.x, targetPos.y]);


  return (
    <motion.div
      initial={{
        x: '50vw',
        y: '50vh',
        rotate: rotation
      }}
      style={{
        position: 'fixed',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 1.0, 
        left: 0,
        top: 0,
        width: 'max-content',
        height: 'max-content'
      }}
      animate={{
        x: `${targetPos.x}vw`,
        y: `${targetPos.y}vh`,
        rotate: rotation,
      }}
      transition={{
        x: { duration: 11, ease: "linear" },
        y: { duration: 11, ease: "linear" },
        rotate: { duration: 0.8, ease: "easeInOut" } // Dönüş hızı hızlandırıldı
      }}

    >
      <div className="relative w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32">
        {frames.map((src, index) => (
          <img
            key={index}
            src={src}
            alt="Floating Octopus"
            className={`absolute inset-0 w-full h-full object-contain filter drop-shadow-[0_0_40px_rgba(176,38,255,0.2)] transition-opacity duration-100 ${
              index === frameIndex ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ pointerEvents: 'none' }}
          />
        ))}
      </div>
    </motion.div>

  );
};
