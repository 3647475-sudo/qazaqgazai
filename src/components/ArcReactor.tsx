import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Sparkles } from 'lucide-react';

interface ArcReactorProps {
  isListening: boolean;
  isPlayingVoice: boolean;
  onToggleMic: () => void;
  lang: string;
}

export default function ArcReactor({
  isListening,
  isPlayingVoice,
  onToggleMic,
  lang
}: ArcReactorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [pulseScale, setPulseScale] = useState(1);

  // Micro-interactions and Canvas wave animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width;
    let height = canvas.height;
    let phase = 0;

    // Set up real browser microphone feedback if listening
    if (isListening && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        try {
          streamRef.current = stream;
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioContextClass();
          audioCtxRef.current = audioCtx;
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyserRef.current = analyser;

          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
        } catch (e) {
          console.log("AudioContext microphone visualization failed:", e);
        }
      }).catch((err) => {
        console.log("Mic access denied or unavailable for visualizer:", err);
      });
    } else {
      // Clean up audio context
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
      analyserRef.current = null;
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      phase += 0.08;

      // Pulse reactor scale based on audio state
      let modifier = 1;
      let dataArray = new Uint8Array(0);

      if (analyserRef.current) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        modifier = 1 + (sum / bufferLength / 255) * 0.4;
      } else if (isPlayingVoice) {
        // Mock glowing pulse for voice playing
        modifier = 1.05 + Math.sin(phase * 1.5) * 0.05;
      } else {
        modifier = 1 + Math.sin(phase * 0.5) * 0.02;
      }

      setPulseScale(modifier);

      // Centered Arc Reactor visual design
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = 70 * modifier;

      // Radial glowing background gradient
      const radialGlow = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, baseRadius * 1.8);
      radialGlow.addColorStop(0, isListening ? 'rgba(0, 242, 255, 0.4)' : isPlayingVoice ? 'rgba(255, 90, 0, 0.3)' : 'rgba(0, 242, 255, 0.15)');
      radialGlow.addColorStop(0.5, 'rgba(0, 242, 255, 0.05)');
      radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = radialGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Outer sci-fi compass ticks
      ctx.strokeStyle = isListening ? 'rgba(0, 242, 255, 0.3)' : 'rgba(0, 242, 255, 0.15)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 36; i += 1) {
        const angle = (i * 10 * Math.PI) / 180 + phase * 0.05;
        const startR = baseRadius * 1.35;
        const endR = baseRadius * (i % 3 === 0 ? 1.45 : 1.4);
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * startR, centerY + Math.sin(angle) * startR);
        ctx.lineTo(centerX + Math.cos(angle) * endR, centerY + Math.sin(angle) * endR);
        ctx.stroke();
      }

      // Drawing active holographic waveform rings
      const points = 60;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = isListening 
        ? 'rgba(0, 242, 255, 0.85)' 
        : isPlayingVoice 
          ? 'rgba(255, 107, 0, 0.85)' 
          : 'rgba(0, 242, 255, 0.5)';
      
      ctx.shadowBlur = 12;
      ctx.shadowColor = isListening ? '#00f2ff' : isPlayingVoice ? '#ff6b00' : '#00f2ff';

      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        let offset = 0;
        
        if (dataArray.length > 0) {
          const index = Math.floor((i / points) * dataArray.length / 2);
          offset = (dataArray[index] / 255) * 18;
        } else if (isPlayingVoice) {
          offset = Math.sin(angle * 8 + phase * 2) * 5;
        } else {
          offset = Math.sin(angle * 12 + phase * 1.5) * 2;
        }

        const r = baseRadius + offset;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset shadow

      // Draw secondary inner target ring rotating backwards
      ctx.strokeStyle = 'rgba(0, 242, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.78, 0, Math.PI * 2);
      ctx.stroke();

      // Mini triangles on the inner ring to mimic QazaqGas UI tech
      ctx.fillStyle = 'rgba(0, 242, 255, 0.6)';
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI / 2) - phase * 0.8;
        ctx.beginPath();
        const tx = centerX + Math.cos(angle) * baseRadius * 0.78;
        const ty = centerY + Math.sin(angle) * baseRadius * 0.78;
        ctx.arc(tx, ty, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw central core sphere
      const coreRadius = baseRadius * 0.5;
      const coreGrad = ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, coreRadius);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.4, isListening ? '#00f2ff' : isPlayingVoice ? '#ff6d00' : '#00f2ff');
      coreGrad.addColorStop(1, 'rgba(10, 25, 47, 0.9)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core details (crosshair line indicators)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(centerX - coreRadius * 0.6, centerY);
      ctx.lineTo(centerX + coreRadius * 0.6, centerY);
      ctx.moveTo(centerX, centerY - coreRadius * 0.6);
      ctx.lineTo(centerX, centerY + coreRadius * 0.6);
      ctx.stroke();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    };
  }, [isListening, isPlayingVoice]);

  return (
    <div id="arc-reactor" className="flex flex-col items-center justify-center p-6 bg-[#121417] rounded-2xl border border-[#00f2ff]/20 shadow-[0_0_20px_rgba(0,242,255,0.05)] relative overflow-hidden h-[340px]">
      {/* Background visual elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-grid-pattern opacity-25 pointer-events-none"></div>
      
      {/* Glassmorphism gradient rings */}
      <div className="absolute top-3 right-4 flex items-center gap-1.5 px-3 py-1 bg-black/40 border border-[#00f2ff]/20 rounded-full text-[9px] text-[#00f2ff] font-mono tracking-widest uppercase">
        <Sparkles className="w-3 h-3 animate-spin-slow text-[#00f2ff]" />
        NEURAL REACTOR v4.2
      </div>

      <div className="relative w-[210px] h-[210px] flex items-center justify-center">
        {/* Canvas for active voice mapping */}
        <canvas
          ref={canvasRef}
          width={210}
          height={210}
          className="absolute inset-0 z-0 pointer-events-none"
        />

        {/* Central mic trigger button */}
        <button
          id="btn-voice-trigger"
          onClick={onToggleMic}
          style={{ transform: `scale(${pulseScale})` }}
          className={`z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shadow-lg group ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 text-white border-2 border-red-300 animate-pulse'
              : isPlayingVoice
                ? 'bg-orange-500 hover:bg-orange-600 text-white border-2 border-orange-300'
                : 'bg-[#00f2ff] hover:bg-[#00f2ff]/90 text-black shadow-[0_0_20px_rgba(0,242,255,0.45)]'
          }`}
          title={isListening ? "Тілін өшіру / Stop Listening" : "Дауыспен басқару / Toggle Voice Assist"}
        >
          {isListening ? (
            <MicOff className="w-9 h-9 animate-bounce" />
          ) : (
            <Mic className="w-9 h-9 group-hover:scale-110 transition-transform" />
          )}
        </button>
      </div>

      {/* Language / Recognition status sub-tags */}
      <div className="mt-4 flex flex-col items-center gap-1 font-mono text-xs text-center z-10 w-full">
        {isListening ? (
          <span className="text-red-400 flex items-center gap-1.5 animate-pulse font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block animate-ping"></span>
            ТЫҢДАУДА ({lang === 'kk-KZ' ? 'Қазақ тілі' : lang === 'ru-RU' ? 'Русский' : 'English'})
          </span>
        ) : isPlayingVoice ? (
          <span className="text-orange-400 flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 animate-bounce" />
            JARVIS ЖАУАП БЕРУДЕ...
          </span>
        ) : (
          <span className="text-[#00f2ff] flex items-center gap-1.5">
            <VolumeX className="w-4 h-4 text-[#00f2ff]" />
            КҮТУ РЕЖИМІ // CORE_STANDBY
          </span>
        )}
        <p className="text-[10px] text-gray-500 mt-1 max-w-[280px]">
          {isListening 
            ? "«Қоңырау сағат 8-ге қой» немесе «кітап оқуды ескерт» деп айтыңыз"
            : lang === 'kk-KZ' 
              ? "Микрофонды басып, тапсырмалар айтыңыз" 
              : "Click the mic core and speak your triggers"}
        </p>
      </div>
    </div>
  );
}
