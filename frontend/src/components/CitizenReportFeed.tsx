import React from 'react';
import { Users, AlertTriangle, Clock, MapPin, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { CitizenReport } from '../types';

interface CitizenReportFeedProps {
  reports: CitizenReport[];
}

export const CitizenReportFeed: React.FC<CitizenReportFeedProps> = ({ reports }) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            Live Community Field Reports
          </h3>
          <p className="text-xs text-slate-400">Crowdsourced embankment fissures and toe-seepage feed</p>
        </div>
        <span className="text-xs font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300">
          {reports.length} Total Reports
        </span>
      </div>

      <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
        {reports.map((r) => {
          const isHigh = r.crack_severity === 'HIGH' || r.crack_severity === 'CATASTROPHIC';
          return (
            <div
              key={r.id}
              className={`p-4 rounded-xl border transition-all ${
                isHigh
                  ? 'bg-rose-950/20 border-rose-600/40'
                  : 'bg-slate-950/60 border-slate-800/80'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono text-cyan-400 font-semibold uppercase">
                    {r.id} • {r.embankment_zone}
                  </span>
                  <h4 className="text-sm font-bold text-slate-200 mt-0.5">
                    Reported by {r.reporter_name}
                  </h4>
                </div>

                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  isHigh
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {r.crack_severity} SEVERITY
                </span>
              </div>

              <p className="text-xs text-slate-300 my-2 leading-relaxed">
                "{r.description}"
              </p>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/60 font-mono">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{r.latitude.toFixed(4)}° N, {r.longitude.toFixed(4)}° E</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
