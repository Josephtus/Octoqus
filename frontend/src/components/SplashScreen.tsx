import React from 'react';
import { motion } from 'framer-motion';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 overflow-hidden"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.8, delay: 3.5, ease: "easeInOut" }}
      onAnimationComplete={onComplete}
    >
      <div className="relative w-40 h-40 md:w-56 md:h-56 mb-8 flex items-center justify-center">
        {/* Glow arkaplan efekti */}
        <motion.div
          className="absolute inset-0 rounded-full bg-[#b026ff] opacity-0 blur-3xl"
          animate={{ opacity: [0, 0.2, 0.4, 0.2] }}
          transition={{ duration: 2, delay: 1, repeat: Infinity }}
        />

        <svg
          viewBox="0 0 100 100"
          className="w-full h-full drop-shadow-glow-purple z-10"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Ahtapot (Octopus) line drawing */}
          <motion.path
            d="
              M 25 45 C 25 20, 75 20, 75 45 
              M 25 45 C 10 50, 10 70, 15 85
              M 35 45 C 25 60, 25 80, 30 95
              M 45 45 C 40 60, 45 80, 45 95
              M 55 45 C 60 60, 55 80, 55 95
              M 65 45 C 75 60, 75 80, 70 95
              M 75 45 C 90 50, 90 70, 85 85
            "
            fill="transparent"
            stroke="#b026ff"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 2.5, ease: "easeInOut" }}
          />

          {/* Gözler */}
          <motion.circle
            cx="40"
            cy="35"
            r="3"
            fill="#00f0ff"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.8, type: "spring", stiffness: 200 }}
            className="drop-shadow-glow-blue"
          />
          <motion.circle
            cx="60"
            cy="35"
            r="3"
            fill="#00f0ff"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 2.0, type: "spring", stiffness: 200 }}
            className="drop-shadow-glow-blue"
          />
        </svg>
      </div>

      <motion.h1
        className="text-4xl md:text-5xl font-extrabold tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-[#b026ff] to-[#00f0ff] drop-shadow-glow-blue"
        initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ delay: 2.2, duration: 0.8, ease: "easeOut" }}
      >
        OCTOQUS
      </motion.h1>

      <motion.div
        className="mt-6 w-48 h-1 rounded-full bg-slate-800 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
      >
        <motion.div
          className="h-full bg-gradient-to-r from-[#b026ff] to-[#00f0ff]"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ delay: 2.5, duration: 1, ease: "easeInOut" }}
        />
      </motion.div>
    </motion.div>
  );
};
