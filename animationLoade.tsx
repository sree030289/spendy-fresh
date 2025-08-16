import React from 'react';

const ColorChangingSpinner = ({ size = 'md' }) => {
  const [currentColorIndex, setCurrentColorIndex] = React.useState(0);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  const colors = [
    { name: 'blue', border: 'border-blue-500', bg: 'bg-blue-500', text: 'text-blue-500' },
    { name: 'purple', border: 'border-purple-500', bg: 'bg-purple-500', text: 'text-purple-500' },
    { name: 'green', border: 'border-green-500', bg: 'bg-green-500', text: 'text-green-500' },
    { name: 'pink', border: 'border-pink-500', bg: 'bg-pink-500', text: 'text-pink-500' },
    { name: 'orange', border: 'border-orange-500', bg: 'bg-orange-500', text: 'text-orange-500' },
    { name: 'red', border: 'border-red-500', bg: 'bg-red-500', text: 'text-red-500' },
    { name: 'yellow', border: 'border-yellow-500', bg: 'bg-yellow-500', text: 'text-yellow-500' },
    { name: 'indigo', border: 'border-indigo-500', bg: 'bg-indigo-500', text: 'text-indigo-500' },
    { name: 'teal', border: 'border-teal-500', bg: 'bg-teal-500', text: 'text-teal-500' },
    { name: 'cyan', border: 'border-cyan-500', bg: 'bg-cyan-500', text: 'text-cyan-500' }
  ];

  const currentColor = colors[currentColorIndex];

  // Change color every loading cycle (3 seconds)
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentColorIndex((prev) => (prev + 1) % colors.length);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="text-center">
        {/* Main Spinner */}
        <div className="relative inline-block mb-8">
          {/* Outer ring */}
          <div 
            className={`${sizeClasses[size]} border-4 border-gray-200 rounded-full animate-spin ${currentColor.border}`}
            style={{
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite'
            }}
          ></div>
          
          {/* Inner ring */}
          <div 
            className={`absolute top-2 left-2 ${size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-20 h-20'} border-2 border-gray-300 rounded-full animate-pulse`}
            style={{
              animation: 'pulse 1.5s ease-in-out infinite alternate'
            }}
          ></div>
          
          {/* Center dot */}
          <div 
            className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-6 h-6'} ${currentColor.bg} rounded-full animate-ping`}
          ></div>
        </div>

        {/* Loading text with animated dots */}
        <div className="text-gray-600 text-lg font-medium">
          Loading
          <span className="inline-flex ml-1">
            <span 
              className="animate-bounce"
              style={{ animationDelay: '0ms' }}
            >.</span>
            <span 
              className="animate-bounce"
              style={{ animationDelay: '150ms' }}
            >.</span>
            <span 
              className="animate-bounce"
              style={{ animationDelay: '300ms' }}
            >.</span>
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-6 w-64 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${currentColor.bg} rounded-full`}
            style={{
              width: '100%',
              animation: 'progress 2s ease-in-out infinite'
            }}
          ></div>
        </div>

        {/* Color indicator */}
        <div className="mt-4 text-sm text-gray-500">
          <span className="capitalize">{currentColor.name}</span> theme • Changes every 3 seconds
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0.3; transform: scale(0.8); }
        }
        
        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

// Demo component with controls
const ColorChangingSpinnerDemo = () => {
  const [currentSize, setCurrentSize] = React.useState('md');
  const [isAutoChanging, setIsAutoChanging] = React.useState(true);

  const sizes = ['sm', 'md', 'lg', 'xl'];

  return (
    <div className="relative">
      <ColorChangingSpinner size={currentSize} />
      
      {/* Controls */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4">
        <h3 className="font-semibold mb-3 text-gray-800">Spinner Controls</h3>
        
        {/* Size Controls */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Size</label>
          <div className="flex gap-2">
            {sizes.map((size) => (
              <button
                key={size}
                onClick={() => setCurrentSize(size)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  currentSize === size
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {size.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-change toggle */}
        <div className="mb-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={isAutoChanging}
              onChange={(e) => setIsAutoChanging(e.target.checked)}
              className="rounded"
            />
            <span className="ml-2 text-sm text-gray-700">Auto color change</span>
          </label>
        </div>
        
        <div className="text-xs text-gray-500">
          {isAutoChanging ? 'Colors change automatically' : 'Color changes paused'}
        </div>
      </div>

      {/* Color History */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs">
        <h3 className="font-semibold mb-2 text-gray-800">Color Sequence</h3>
        <div className="text-xs text-gray-600 mb-2">
          Cycles through 10 beautiful colors:
        </div>
        <div className="flex flex-wrap gap-1">
          {['blue', 'purple', 'green', 'pink', 'orange', 'red', 'yellow', 'indigo', 'teal', 'cyan'].map((color) => (
            <div
              key={color}
              className="w-4 h-4 rounded-full border border-gray-300"
              style={{
                backgroundColor: color === 'blue' ? '#3b82f6' :
                               color === 'purple' ? '#a855f7' :
                               color === 'green' ? '#22c55e' :
                               color === 'pink' ? '#ec4899' :
                               color === 'orange' ? '#f97316' :
                               color === 'red' ? '#ef4444' :
                               color === 'yellow' ? '#eab308' :
                               color === 'indigo' ? '#6366f1' :
                               color === 'teal' ? '#14b8a6' : '#06b6d4'
              }}
              title={color}
            />
          ))}
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Each loading cycle uses a different color
        </div>
      </div>
    </div>
  );
};

export default ColorChangingSpinnerDemo;