import React, { useState } from 'react';
import { Camera, MapPin, Send, AlertTriangle, CheckCircle2, UploadCloud } from 'lucide-react';
import { api } from '../services/api';

interface CitizenReportFormProps {
  onSuccess: () => void;
}

export const CitizenReportForm: React.FC<CitizenReportFormProps> = ({ onSuccess }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [zone, setZone] = useState('Majuli Island - Kamalabari');
  const [severity, setSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CATASTROPHIC'>('MEDIUM');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState('26.9460');
  const [lng, setLng] = useState('94.1880');
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchGPS = () => {
    if ('geolocation' in navigator) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude.toFixed(4));
          setLng(pos.coords.longitude.toFixed(4));
          setLocating(false);
        },
        () => {
          setLocating(false);
        }
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !description) return;

    setSubmitting(true);
    try {
      await api.submitCitizenReport({
        reporter_name: name,
        phone: phone || '+91 90000 00000',
        embankment_zone: zone,
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        crack_severity: severity,
        description,
        status: 'PENDING_INSPECTION',
      });
      setSuccess(true);
      setName('');
      setPhone('');
      setDescription('');
      onSuccess();
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      console.error('Error submitting citizen report:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="border-b border-slate-800/80 pb-4">
        <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
          <Camera className="w-5 h-5 text-cyan-400" />
          Crowdsource Embankment Fissure / Seepage Report
        </h3>
        <p className="text-xs text-slate-400">
          Upload real-time visual observations to assist Water Resources Dept field response teams
        </p>
      </div>

      {success && (
        <div className="bg-emerald-950/40 border border-emerald-600/50 text-emerald-300 p-3 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Report successfully logged into emergency dispatch queue! Inspection team notified.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Your Name / Local Village Representative</label>
            <input
              type="text"
              required
              placeholder="e.g. Ranjit Bora"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Mobile Number (For verification)</label>
            <input
              type="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Embankment Location / Reach</label>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="Majuli Island - Kamalabari">Majuli Island - Kamalabari Dyke</option>
              <option value="Dibrugarh Protection Dyke">Dibrugarh Town Protection Dyke</option>
              <option value="Tezpur Bhomoraguri">Tezpur Bhomoraguri Reach</option>
              <option value="Guwahati Saraighat">Guwahati Saraighat Berm</option>
              <option value="Silchar Barak Reach">Silchar Bethukandi Sluice</option>
              <option value="Other Rural Reach">Other Rural Assam Embankment</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">Observed Hazard Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="LOW">Low (Superficial surface cracks &lt; 5mm)</option>
              <option value="MEDIUM">Medium (Longitudinal fissure 1-3cm, moist soil)</option>
              <option value="HIGH">High (Active sand boil / piping with bubbling water)</option>
              <option value="CATASTROPHIC">Catastrophic (Crest subsidence &gt; 50cm or active breach)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-slate-400 mb-1 font-medium">Visual Observation Details</label>
          <textarea
            required
            rows={3}
            placeholder="Describe the crack length, depth, water bubbling / piping signs, or sudden ground depression..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* GPS Coordinate Capture */}
        <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="flex items-center space-x-2 text-slate-300 font-mono text-xs">
            <MapPin className="w-4 h-4 text-rose-400" />
            <span>GPS: {lat}° N, {lng}° E</span>
          </div>

          <button
            type="button"
            onClick={fetchGPS}
            disabled={locating}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-all"
          >
            {locating ? 'Locating...' : 'Get Current GPS'}
          </button>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
        >
          <Send className="w-4 h-4" />
          <span>{submitting ? 'Transmitting Field Evidence...' : 'Submit Crowdsourced Evidence'}</span>
        </button>
      </form>
    </div>
  );
};
