
import React from 'react';

interface StatusDisplayProps {
  announcement: string | null;
  error: string | null;
  currentTime: number;
  duration: number;
}

export const StatusDisplay: React.FC<StatusDisplayProps> = ({ announcement, error, currentTime, duration }) => {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remainingTime = duration - currentTime;

  return (
    <div className="w-full bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md h-28 flex flex-col justify-center">
      {error ? (
        <div className="text-center">
          <p className="text-xl font-bold text-red-500">エラー</p>
          <p className="text-gray-600 dark:text-gray-300 mt-1">{error}</p>
        </div>
      ) : announcement ? (
        <div>
          <p className="text-center text-lg md:text-2xl font-semibold text-gray-800 dark:text-gray-100 truncate">
            {announcement}
          </p>
          <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-100"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-1">
            残り時間: {remainingTime > 0 ? remainingTime.toFixed(1) : '0.0'} 秒
          </p>
        </div>
      ) : (
        <p className="text-center text-xl text-gray-500 dark:text-gray-400">待機中...</p>
      )}
    </div>
  );
};
