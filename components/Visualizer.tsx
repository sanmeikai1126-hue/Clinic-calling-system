import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ stream, isRecording }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!stream || !isRecording) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Init Audio Context
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass();
    }
    
    const audioCtx = audioContextRef.current!;
    
    // Close previous context if state got messy, but usually we reuse
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    analyserRef.current = audioCtx.createAnalyser();
    analyserRef.current.fftSize = 256;
    
    sourceRef.current = audioCtx.createMediaStreamSource(stream);
    sourceRef.current.connect(analyserRef.current!);

    const bufferLength = analyserRef.current!.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecording) return;
      
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current!.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;

        const r = barHeight + 25 * (i / bufferLength);
        const g = 250 * (i / bufferLength);
        const b = 50;

        // Teal-ish color scheme for medical vibe
        ctx.fillStyle = `rgb(13, 148, 136)`; // Tailwind teal-600
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (sourceRef.current) sourceRef.current.disconnect();
      // Do not close AudioContext here to allow reuse, or manage strictly
    };
  }, [stream, isRecording]);

  return (
    <canvas 
      ref={canvasRef} 
      width={300} 
      height={60} 
      className="w-full h-16 rounded bg-gray-100 border border-gray-200"
    />
  );
};

export default Visualizer;