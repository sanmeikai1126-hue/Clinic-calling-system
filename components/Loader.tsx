import React from 'react';

const Loader: React.FC<{ text?: string }> = ({ text = "Processing..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="relative w-16 h-16">
        <div className="absolute top-0 left-0 w-full h-full border-4 border-teal-200 rounded-full opacity-25"></div>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-teal-600 rounded-full border-t-transparent animate-spin"></div>
      </div>
      <p className="text-gray-600 font-medium animate-pulse">{text}</p>
    </div>
  );
};

export default Loader;