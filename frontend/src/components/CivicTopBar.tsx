import React, { useState, useEffect } from 'react';
import { ShieldCheck, Radio, Landmark } from 'lucide-react';

interface CivicTopBarProps {
  connected: boolean;
}

export const CivicTopBar: React.FC<CivicTopBarProps> = ({ connected }) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-IN', {
          hour12: false,
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' IST'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-slate-950 border-b border-slate-800 text-slate-400 text-[11px] font-mono tracking-tight select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex flex-wrap items-center justify-between gap-2">
        {/* Left: Official Authority Emblem & Tag */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 text-slate-300 font-semibold uppercase tracking-wider text-[10px]">
            <Landmark className="w-3.5 h-3.5 text-cyan-400" />
            <span>Govt. of Assam • Water Resources Department</span>
          </div>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-slate-400 hidden md:inline text-[10px]">
            Central Water Commission (CWC) &amp; ISRO-Bhuvan Telemetry Link
          </span>
        </div>

        {/* Right: Real-time Telemetry Status & Clock */}
        <div className="flex items-center space-x-3 text-[11px]">
          {/* Live Stream Indicator */}
          <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[10px]">
            <span
              className={`w-2 h-2 rounded-full transition-all ${
                connected
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  : 'bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-pulse'
              }`}
            />
            <span className={connected ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
              {connected ? 'LIVE STREAM' : 'RECONNECTING'}
            </span>
          </div>

          {/* Precision Clock */}
          <div className="hidden xs:flex items-center space-x-1 text-slate-300 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[10px]">
            <span className="text-slate-500">TIME:</span>
            <span className="font-semibold text-slate-200">{timeStr || 'SYNCING...'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
