import React, { useState, useEffect } from 'react';
import { MedicalRecord } from '../types';
import { getRecords, searchRecords, deleteRecord } from '../services/storageService';
import { Search, Trash2, User, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HistoryPage: React.FC = () => {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setRecords(getRecords());
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setRecords(getRecords());
    } else {
      setRecords(searchRecords(searchQuery));
    }
  }, [searchQuery]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('本当にこの記録を削除しますか？')) {
      deleteRecord(id);
      setRecords(prev => prev.filter(r => r.id !== id));
    }
  };

  const openRecord = (record: MedicalRecord) => {
    navigate('/result', { 
      state: { 
        result: record.data, 
        patientInfo: record.patient 
      } 
    });
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">診療履歴</h1>

      {/* Search Bar */}
      <div className="relative mb-8">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm shadow-sm"
          placeholder="氏名、ID、主訴で検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="bg-white shadow overflow-hidden rounded-md border border-gray-200">
        <ul className="divide-y divide-gray-200">
          {records.length === 0 ? (
            <li className="px-6 py-12 text-center text-gray-500">
              記録が見つかりません。
            </li>
          ) : (
            records.map((record) => (
              <li key={record.id} className="hover:bg-gray-50 transition cursor-pointer" onClick={() => openRecord(record)}>
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center text-sm font-medium text-teal-600 truncate gap-2">
                        <User size={16} />
                        {record.patient.name || '未登録患者'} 
                        <span className="text-gray-400 font-normal text-xs ml-1">ID: {record.patient.id || 'N/A'}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-500 gap-1">
                        <Calendar size={14} />
                        {new Date(record.date).toLocaleString('ja-JP')}
                      </div>
                    </div>
                    <div className="mt-2">
                        <p className="text-sm text-gray-600 line-clamp-2">
                            <span className="font-bold text-gray-800 mr-2">(S)</span>
                            {record.data.soap.s || "記録なし"}
                        </p>
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <button 
                        onClick={(e) => handleDelete(e, record.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition rounded-full hover:bg-red-50"
                        title="削除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};

export default HistoryPage;