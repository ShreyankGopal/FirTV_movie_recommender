import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Sector,
  Legend,
} from "recharts";

// Advanced holographic color palette with gradients
const ADVANCED_COLORS = [
  { base: "#00F5FF", glow: "#00F5FF", gradient: "linear-gradient(135deg, #00F5FF 0%, #0080FF 100%)" },
  { base: "#FF0080", glow: "#FF0080", gradient: "linear-gradient(135deg, #FF0080 0%, #FF4080 100%)" },
  { base: "#80FF00", glow: "#80FF00", gradient: "linear-gradient(135deg, #80FF00 0%, #40FF80 100%)" },
  { base: "#FF8000", glow: "#FF8000", gradient: "linear-gradient(135deg, #FF8000 0%, #FFB040 100%)" },
  { base: "#8000FF", glow: "#8000FF", gradient: "linear-gradient(135deg, #8000FF 0%, #B040FF 100%)" },
  { base: "#FF4040", glow: "#FF4040", gradient: "linear-gradient(135deg, #FF4040 0%, #FF8080 100%)" },
  { base: "#40FF40", glow: "#40FF40", gradient: "linear-gradient(135deg, #40FF40 0%, #80FF80 100%)" },
  { base: "#4040FF", glow: "#4040FF", gradient: "linear-gradient(135deg, #4040FF 0%, #8080FF 100%)" },
  { base: "#FFFF40", glow: "#FFFF40", gradient: "linear-gradient(135deg, #FFFF40 0%, #FFFF80 100%)" },
  { base: "#FF40FF", glow: "#FF40FF", gradient: "linear-gradient(135deg, #FF40FF 0%, #FF80FF 100%)" },
];

// Advanced active shape with 3D effect and animations
const renderAdvancedActiveShape = (props) => {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent, index
  } = props;

  const colorData = ADVANCED_COLORS[index % ADVANCED_COLORS.length];
  
  return (
    <g>
      {/* Outer glow effect */}
      {/* <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 5}
        outerRadius={outerRadius + 25}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={colorData.glow}
        fillOpacity={0.1}
        stroke={colorData.glow}
        strokeWidth={2}
        strokeOpacity={0.3}
      /> */}
      
      {/* Main elevated sector */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 15}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke={colorData.glow}
        strokeWidth={3}
        filter="drop-shadow(0 8px 16px rgba(0,0,0,0.4))"
      />
      
      {/* Inner highlight for 3D effect */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={innerRadius + 20}
        startAngle={startAngle}
        endAngle={endAngle}
        fill="rgba(255,255,255,0.2)"
      />

      
      <text
        x={cx}
        y={cy+5}
        textAnchor="middle"
        fill={colorData.glow}
        className="text-lg font-bold"
        style={{ filter: `drop-shadow(0 0 8px ${colorData.glow})` }}
      >
        {payload.name}
      </text>
      
      {/* <text
        x={cx}
        y={cy}
        textAnchor="middle"
        fill="#ffffff"
        className="text-2xl font-bold"
      >
        {(percent * 100).toFixed(1)}%
      </text> */}
      
      {/* <text
        x={cx}
        y={cy + 20}
        textAnchor="middle"
        fill="#aaaaaa"
        className="text-xs"
      >
        {payload.description}
      </text> */}
    </g>
  );
};

// Custom tooltip with glassmorphism effect
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  
  const data = payload[0];
  const colorData = ADVANCED_COLORS[payload[0].payload.index % ADVANCED_COLORS.length];
  
  return (
    <div 
      className="p-4 rounded-xl backdrop-blur-md border border-opacity-30"
      style={{
        background: 'rgba(0, 0, 0, 0.85)',
        borderColor: colorData.glow,
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)`,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div 
          className="w-3 h-3 rounded-full"
          style={{ 
            backgroundColor: colorData.base,
            boxShadow: `0 0 8px ${colorData.glow}`
          }}
        />
        <span className="text-white font-semibold">{data.name}</span>
      </div>
      {/* <div className="text-sm text-gray-300 mb-1">
        Value: <span className="text-white font-mono">{data.value}%</span>
      </div> */}
      <div className="text-sm italic text-gray-300 whitespace-pre-wrap break-words max-w-[15rem]">
  {data.payload.description}
</div>

    </div>
  );
};

// Animated legend component
const AnimatedLegend = ({ data, activeIndex, onLegendClick }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-2 gap-3 mt-6">
      {data.map((entry, index) => {
        const colorData = ADVANCED_COLORS[index % ADVANCED_COLORS.length];
        const isActive = activeIndex === index;
        
        return (
          <div
            key={entry.name}
            className={`p-3 rounded-lg border cursor-pointer transition-all duration-300 ${
              isActive ? 'scale-105 shadow-lg' : 'hover:scale-102'
            }`}
            style={{
              background: isActive 
                ? `linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 100%)`
                : 'rgba(0,0,0,0.6)',
              borderColor: isActive ? colorData.glow : 'rgba(255,255,255,0.1)',
              boxShadow: isActive 
                ? `0 0 20px ${colorData.glow}40`
                : '0 2px 8px rgba(0,0,0,0.3)',
            }}
            onClick={() => onLegendClick(index)}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-3 h-3 rounded-full animate-pulse"
                style={{
                  backgroundColor: colorData.base,
                  boxShadow: `0 0 ${isActive ? '12px' : '6px'} ${colorData.glow}`,
                }}
              />
              <span className="text-white text-sm font-medium">
                {entry.name}
              </span>
            </div>
            <div className="text-xs text-gray-400 ml-5">
              {entry.value}%
            </div>
          </div>
        );
      })}
    </div>
  );
};

function GenreChart({ data }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Auto-rotation effect
  useEffect(() => {
    if (!isAnimating) return;
    
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % data.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [isAnimating, data.length]);

  const onPieEnter = (_, index) => {
    setActiveIndex(index);
    setIsAnimating(false);
  };

  const onPieLeave = () => {
    setIsAnimating(true);
  };

  const onLegendClick = (index) => {
    setActiveIndex(index);
    setIsAnimating(false);
  };

  // Enhanced data with index for color mapping
  const enhancedData = data.map((item, index) => ({
    ...item,
    index,
    fill: ADVANCED_COLORS[index % ADVANCED_COLORS.length].base,
  }));

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gradient-to-br from-gray-900 to-black rounded-xl">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-cyan-400 text-lg">No emotion data available</p>
        </div>
      </div>
    );
  }

  const bubbles = useMemo(() => {
    const safeMargin = 3000; // Max radius offset in px
  
    return Array.from({ length: 20 }).map((_, i) => {
      const width = Math.random() * 100 + 50;
      const height = Math.random() * 100 + 50;
  
      return {
        width,
        height,
        left: `calc(${Math.random() * 100}% - ${width / 2}px)`,  // center-aligned safely
        top: `calc(${Math.random() * 100}% - ${height / 2}px)`,
        gradient: ADVANCED_COLORS[i % ADVANCED_COLORS.length].gradient,
        duration: `${3 + Math.random() * 4}s`,
        delay: `${Math.random() * 2}s`,
      };
    });
  }, []);
  
  

  return (
    <div
      ref={containerRef}
      className="relative w-screen min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 p-6"
      style={{
        background: `
          radial-gradient(circle at center, 
            #111 20%
          )
        `
      }}
    >
      {/* Animated background bubbles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {bubbles.map((bubble, i) => (
          <div
            key={i}
            className="absolute rounded-full opacity-10"
            style={{
              width: bubble.width,
              height: bubble.height,
              left: bubble.left,
              top: bubble.top,
              background: bubble.gradient,
              animation: `float ${bubble.duration} ease-in-out infinite`,
              animationDelay: bubble.delay,
            }}
          />
        ))}
      </div>
  
      {/* Flex container for left + right layout */}
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between max-w-8xl mx-auto">
  
        {/* Left side: Text */}
        <div className="md:w-1/2 w-full text-left space-y-6">
          <h2 className="text-3xl md:text-4xl font-semibold text-white">
            We listened to how you're feeling — and picked these just for you.
          </h2>
          <p className="text-lg text-gray-300">
            Your mood matters. So we took a moment to understand it — and in return, we’ve gathered a thoughtful lineup of films we believe you’ll connect with.
            <br className="hidden md:block" />
            <br />
            Enjoy a cinematic experience that’s personal and made for this moment.
          </p>
        </div>
          
        {/* Right side: Chart */}
        <div className="md:w-1/2 w-full pr-6 md:pr-20">
          {/* Header inside chart section */}
          {/* <div className="text-center mb-6">
            <h6 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              TOP GENRES
            </h6>
          </div> */}
  
          {/* Chart + legend */}
          <div
            style={{
              transform: `perspective(1000px) rotateX(${mousePosition.y * 2}deg) rotateY(${mousePosition.x * 2}deg)`,
            }}
          >
            <div className="md:h-[500px] relative">
              <ResponsiveContainer>
                <PieChart>
                  <defs>
                    {ADVANCED_COLORS.map((color, index) => (
                      <linearGradient key={index} id={`gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={color.base} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={color.base} stopOpacity={0.6} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    activeIndex={activeIndex}
                    activeShape={renderAdvancedActiveShape}
                    data={enhancedData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={180}
                    dataKey="value"
                    onMouseEnter={onPieEnter}
                    onMouseLeave={onPieLeave}
                    animationBegin={0}
                    animationDuration={800}
                    animationEasing="ease-out"
                  >
                    {enhancedData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={`url(#gradient-${index})`}
                        stroke={ADVANCED_COLORS[index % ADVANCED_COLORS.length].glow}
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
  
          {/* Interactive legend */}
          <AnimatedLegend 
            data={enhancedData} 
            activeIndex={activeIndex}
            onLegendClick={onLegendClick}
          />
        </div>
      </div>
  
      {/* Float animation keyframes */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
      `}</style>
    </div>
  );
  
};

export default GenreChart;