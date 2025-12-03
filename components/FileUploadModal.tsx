import React, { useState, useRef } from 'react';
import { Upload, X, FileAudio, AlertCircle } from 'lucide-react';

interface FileUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onFileSelected: (file: File) => void;
}

const FileUploadModal: React.FC<FileUploadModalProps> = ({ isOpen, onClose, onFileSelected }) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    const ALLOWED_TYPES = ['audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/webm', 'audio/m4a', 'video/mp4'];
    const ALLOWED_EXTENSIONS = ['.mp3', '.mp4', '.webm', '.m4a'];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);

        // Check file extension
        const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
        if (!ALLOWED_EXTENSIONS.includes(extension)) {
            setError(`対応していないファイル形式です。mp3, mp4, webm, m4a のいずれかを選択してください。`);
            setSelectedFile(null);
            return;
        }

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            setError(`ファイルサイズが大きすぎます（最大100MB）。現在のサイズ: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
            setSelectedFile(null);
            return;
        }

        setSelectedFile(file);
    };

    const handleConfirm = () => {
        if (selectedFile) {
            onFileSelected(selectedFile);
            handleClose();
        }
    };

    const handleClose = () => {
        setSelectedFile(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Upload size={20} />
                        音声ファイルをアップロード
                    </h3>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-600 transition"
                    >
                        <X size={20} />
                    </button>
                </div>

                <p className="text-sm text-gray-500 mb-4">
                    診察の録音ファイルをアップロードして文字起こしできます。
                </p>

                <div className="space-y-4">
                    {/* File Input */}
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition"
                    >
                        <FileAudio size={48} className="mx-auto mb-3 text-gray-400" />
                        <p className="text-sm font-medium text-gray-700">
                            クリックしてファイルを選択
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            mp3, mp4, webm, m4a (最大100MB)
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".mp3,.mp4,.webm,.m4a,audio/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>

                    {/* Selected File Info */}
                    {selectedFile && (
                        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-teal-900">選択されたファイル:</p>
                            <p className="text-sm text-teal-700 truncate">{selectedFile.name}</p>
                            <p className="text-xs text-teal-600 mt-1">
                                サイズ: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                            <AlertCircle size={16} className="text-red-600 mt-0.5" />
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={handleClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedFile}
                            className={`flex-1 px-4 py-2 rounded-lg font-bold transition ${selectedFile
                                ? 'bg-teal-600 text-white hover:bg-teal-700'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            文字起こし開始
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FileUploadModal;
