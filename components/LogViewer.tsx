
import React, { useState } from 'react';
import { LogEntry } from '../types';
import { Icon } from './Icon';

interface LogViewerProps {
  logs: LogEntry[];
  onClear: () => void;
}

const LogIcon = () => (
    <Icon path="M3.75 4.5A.75.75 0 003 5.25v13.5c0 .414.336.75.75.75h16.5a.75.75 0 00.75-.75V5.25a.75.75 0 00-.75-.75H3.75zM17.25 6H6.75v1.5h10.5V6zm0 3H6.75v1.5h10.5V9zm0 3H6.75v1.5h10.5v-1.5z" className="w-5 h-5 mr-2" />
)

const TrashIcon = () => (
    <Icon path="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" className="w-5 h-5 mr-2" />
)

export const LogViewer: React.FC<LogViewerProps> = ({ logs, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full mt-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <LogIcon />
        {isOpen ? 'ログを閉じる' : '再生ログを表示'}
      </button>

      {isOpen && (
        <div className="mt-2 p-4 bg-white dark:bg-gray-800 rounded-md shadow-lg max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">再生ログ</h3>
            <button
                onClick={onClear}
                className="flex items-center px-3 py-1 text-sm text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/50 rounded-md hover:bg-red-200 dark:hover:bg-red-900"
            >
                <TrashIcon/>
                クリア
            </button>
          </div>
          {logs.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">ログはありません。</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {logs.map((log, index) => (
                <li key={index} className="py-2 text-sm">
                  <span className={`font-mono ${log.status === 'error' ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                    [{log.status.toUpperCase()}]
                  </span>
                  <span className="ml-2 font-mono text-gray-500 dark:text-gray-400">{log.timestamp}</span>
                  <p className="text-gray-700 dark:text-gray-300">{log.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
