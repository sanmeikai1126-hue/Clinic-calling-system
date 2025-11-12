
import React from 'react';
import { Icon } from './Icon';

interface NumpadProps {
  onKeyPress: (key: string) => void;
}

const BackspaceIcon = () => (
    <Icon path="M12 15.586l-4.293-4.293a1 1 0 011.414-1.414L12 12.758l3.879-3.879a1 1 0 111.414 1.414L13.414 14l3.879 3.879a1 1 0 01-1.414 1.414L12 15.414l-3.879 3.879a1 1 0 01-1.414-1.414L10.586 14 6.707 10.121a1 1 0 011.414-1.414L12 12.586z" className="w-8 h-8"/>
)

const NumpadButton: React.FC<{
    onClick: () => void;
    children: React.ReactNode;
    className?: string;
}> = ({ onClick, children, className = '' }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-center text-3xl font-bold rounded-lg shadow-md transition-all duration-150 h-16
      bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 
      hover:bg-gray-200 dark:hover:bg-gray-600 
      active:bg-blue-200 dark:active:bg-blue-800 active:shadow-inner active:scale-95
      ${className}`}
  >
    {children}
  </button>
);

export const Numpad: React.FC<NumpadProps> = ({ onKeyPress }) => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0'];

  return (
    <div className="grid grid-cols-3 gap-2 p-2 bg-gray-200 dark:bg-gray-800 rounded-lg shadow-inner">
      {keys.map((key) => (
        <NumpadButton key={key} onClick={() => onKeyPress(key)}>
          {key}
        </NumpadButton>
      ))}
      <NumpadButton onClick={() => onKeyPress('Backspace')}>
        <BackspaceIcon/>
      </NumpadButton>
    </div>
  );
};
