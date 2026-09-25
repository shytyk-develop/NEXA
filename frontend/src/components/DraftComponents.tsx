// --- Component ---
'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { type FC } from 'react';
import { cn } from "@/lib/utils";

export type ThemeConfig = {
  bg: string;
  button: string;
  dot: string;
  progress: string;
};

interface CarouselNavigatorProps {
  totalSlides?: number;
  autoDelay?: number;
  themes?: ThemeConfig[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

const DEFAULT_TOTAL_SLIDES = 4;
const DEFAULT_AUTO_DELAY = 5000;

const DEFAULT_THEMES: ThemeConfig[] = [
  { bg: 'bg-zinc-100', button: 'bg-zinc-900', dot: 'bg-zinc-300', progress: 'bg-zinc-300' },
  { bg: 'bg-blue-100', button: 'bg-blue-600', dot: 'bg-blue-300', progress: 'bg-blue-300' },
  { bg: 'bg-green-100', button: 'bg-green-600', dot: 'bg-green-400', progress: 'bg-green-400' },
  { bg: 'bg-yellow-100', button: 'bg-yellow-400', dot: 'bg-yellow-300', progress: 'bg-yellow-300' },
];

export const CarouselNavigator: FC<CarouselNavigatorProps> = ({
  totalSlides = DEFAULT_TOTAL_SLIDES,
  autoDelay = DEFAULT_AUTO_DELAY,
  themes = DEFAULT_THEMES,
  currentIndex,
  onIndexChange,
}) => {
  const theme = themes[currentIndex] || themes[0];

  const goPrev = () => onIndexChange((currentIndex - 1 + totalSlides) % totalSlides);
  const goNext = () => onIndexChange((currentIndex + 1) % totalSlides);

 
  const getMotionBg = (bgClass: string) => {
    if (bgClass.includes('[')) return bgClass.split('[')[1].replace(']', '');
    return undefined;
  };

  return (
    <motion.div
      animate={{ backgroundColor: getMotionBg(theme.bg) }}
      className={cn(
        "flex items-center justify-center gap-1 rounded-full px-4 py-3 transition-colors duration-300",
        !theme.bg.includes('[') && theme.bg
      )}
    >
      <ArrowButton onClick={goPrev} themeColor={theme.button} disabled={currentIndex === 0}>
        <ChevronLeft size={24} strokeWidth={3} />
      </ArrowButton>

      <div className="flex items-center gap-2 px-2">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <Indicator
            key={i}
            isActive={i === currentIndex}
            theme={theme}
            autoDelay={autoDelay}
            onClick={() => onIndexChange(i)}
          />
        ))}
      </div>

      <ArrowButton onClick={goNext} themeColor={theme.button}>
        <ChevronRight size={24} strokeWidth={3} />
      </ArrowButton>
    </motion.div>
  );
};

const ArrowButton = ({ children, onClick, themeColor, disabled }: any) => (
  <motion.button
    onClick={onClick}
    disabled={disabled}
    whileTap={!disabled ? { scale: 0.9 } : {}}
    className={cn(
      "flex h-12 w-12 items-center justify-center rounded-full text-white shadow-sm transition-colors duration-300",
      disabled ? "bg-gray-300 opacity-50 cursor-not-allowed" : `${themeColor} cursor-pointer`
    )}
  >
    {children}
  </motion.button>
);

const Indicator = ({ isActive, theme, autoDelay, onClick }: any) => (
  <motion.button
    type="button"
    onClick={onClick}
    layout
    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    style={{ borderRadius: 24 }}
    className={cn(
      "relative h-3 cursor-pointer focus:outline-none transition-all duration-300",
      isActive ? `w-12 ${theme.progress}` : `w-3 ${theme.dot}`
    )}
  >
    {isActive && (
      <motion.div
        initial={{ width: '0%' }}
        animate={{ width: '100%' }}
        transition={{ duration: autoDelay / 1000, ease: 'linear' }}
        className="absolute inset-0 rounded-full bg-white/40 shadow-[0_0_8px_rgba(255,255,255,0.5)]"
      />
    )}
  </motion.button>
);

export default CarouselNavigator;

// --- Demo ---
'use client';

import CarouselNavigator from "@/components/ui/carousel-navigator";
import { useState, useEffect } from "react";

export default function CarouselNavigatorDemo() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const totalSlides = 4;
  const autoDelay = 4000;


  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalSlides);
    }, autoDelay);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-6 bg-background p-10">

      {/* Carousel Navigator */}
      <CarouselNavigator
        totalSlides={totalSlides}
        autoDelay={autoDelay}
        currentIndex={currentIndex}
        onIndexChange={setCurrentIndex}
      />
      
    </div>
  );
}