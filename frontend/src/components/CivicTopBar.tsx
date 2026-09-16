import React, { useState, useEffect } from 'react';
import { Landmark, Radio } from 'lucide-react';

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
    <div className="w-full bg-[#f1f3f4] border-b border-gray-200 text-[#3c4043] text-xs font-sans select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Official Authority Emblem & Tag */}
        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-2 text-[#202124] font-medium text-xs">
            <Landmark className="w-4 h-4 text-blue-600" />
            <span>Govt. of Assam • Water Resources Department</span>
          </div>
          <span className="text-gray-300 hidden sm:inline">|</span>
          <span className="text-gray-600 hidden md:inline text-xs">
            Central Water Commission (CWC) &amp; ISRO-Bhuvan Telemetry Link
          </span>
        </div>

        {/* Right: Live Stream & Precision Clock */}
        <div className="flex items-center space-x-4 text-xs">
          {/* Live Stream Indicator */}
          <div className="flex items-center space-x-2 bg-white border border-gray-200 px-3 py-1 rounded-full shadow-2xs">
            <span
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                connected
                  ? 'bg-[#1e8e3e] shadow-[0_0_6px_rgba(30,142,62,0.6)]'
                  : 'bg-[#d93025] animate-pulse'
              }`}
            />
            <span className={connected ? 'text-[#137333] font-medium' : 'text-[#c5221f] font-medium'}>
              {connected ? 'LIVE STREAM' : 'RECONNECTING'}
            </span>
          </div>

          {/* Precision Clock */}
          <div className="hidden xs:flex items-center space-x-1.5 text-gray-700 bg-white border border-gray-200 px-3 py-1 rounded-full shadow-2xs font-mono text-xs">
            <span className="text-gray-400 font-sans text-[11px]">TIME:</span>
            <span className="font-semibold">{timeStr || 'SYNCING...'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
