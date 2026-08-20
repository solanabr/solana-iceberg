import { useEffect, useState } from "react";

interface ShootingStar {
  id: number;
  startX: number;
  startY: number;
  angle: number;
  duration: number;
  length: number;
}

const ShootingStars = () => {
  const [stars, setStars] = useState<ShootingStar[]>([]);

  useEffect(() => {
    let counter = 0;
    const spawn = () => {
      const star: ShootingStar = {
        id: counter++,
        startX: Math.random() * 80 + 10,
        startY: Math.random() * 40,
        angle: 20 + Math.random() * 30,
        duration: 0.6 + Math.random() * 0.6,
        length: 80 + Math.random() * 120,
      };
      setStars((prev) => [...prev.slice(-3), star]);
    };

    const interval = setInterval(spawn, 12000 + Math.random() * 18000);
    const timeout = setTimeout(spawn, 5000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute"
          style={{
            left: `${s.startX}%`,
            top: `${s.startY}%`,
            width: `${s.length}px`,
            height: "2px",
            background: `linear-gradient(90deg, white, rgba(200, 220, 255, 0.8), transparent)`,
            borderRadius: "1px",
            transform: `rotate(${s.angle}deg)`,
            animation: `shooting-star ${s.duration}s linear forwards`,
            boxShadow: "0 0 6px rgba(200, 220, 255, 0.6)",
          }}
        />
      ))}
    </div>
  );
};

export default ShootingStars;
