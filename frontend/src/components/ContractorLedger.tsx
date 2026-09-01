import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  ShieldCheck, 
  Search, 
  Plus, 
  Hash, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  Calendar
} from 'lucide-react';
import { ContractorLedger as LedgerType } from '../types';
import { api } from '../services/api';

interface ContractorLedgerProps {
  ledger: LedgerType[];
  onRefresh: () => void;
}

export const ContractorLedger: React.FC<ContractorLedgerProps> = ({
  ledger,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [constituency, setConstituency] = useState('Majuli');
  const [contractorName, setContractorName] = useState('');
  const [budget, setBudget] = useState('');
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().split('T')[0]);
  const [sector, setSector] = useState('');
  const [integrityScore, setIntegrityScore] = useState('95.0');

  const filtered = ledger.filter((l) =>
    l.constituency.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.contractor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.embankment_sector.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalBudget = ledger.reduce((acc, curr) => acc + curr.allocated_budget, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractorName || !budget || !sector) return;

    setSubmitting(true);
    try {
      await api.addLedgerEntry({
        constituency,
        contractor_name: contractorName,
        allocated_budget: parseFloat(budget),
        completion_date: completionDate,
        embankment_sector: sector,
        integrity_score: parseFloat(integrityScore),
        status: 'VERIFIED',
      });
      setShowModal(false);
      setContractorName('');
      setBudget('');
      setSector('');
      onRefresh();
    } catch (err) {
      console.error('Error adding ledger entry:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      
      {/* Top Banner & Audit Ledger Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Immutable Contractor Accountability Ledger
              </h3>
              <p className="text-xs text-slate-400">
                Public procurement and structural integrity verification with SHA-256 cryptographic chaining
              </p>
            </div>
          </div>
        </div>

        {/* Ledger Summary Stats */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800 text-center">
            <span className="text-slate-400 block text-[10px] uppercase font-mono">Total Works Budget</span>
            <span className="text-sm font-bold text-cyan-400 font-mono">
              ₹ {totalBudget.toFixed(2)} Lakhs
            </span>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Work Record</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search constituency, contractor, or sector..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Showing {filtered.length} of {ledger.length} verified records
        </div>
      </div>

      {/* Ledger Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/90 text-slate-400 font-semibold border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Block / ID</th>
              <th className="py-3 px-4">Constituency</th>
              <th className="py-3 px-4">Contractor Name</th>
              <th className="py-3 px-4">Sector Reach</th>
              <th className="py-3 px-4">Allocated Budget</th>
              <th className="py-3 px-4">Completion</th>
              <th className="py-3 px-4">Integrity</th>
              <th className="py-3 px-4">SHA-256 Hash</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
            {filtered.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4 font-mono text-cyan-400 font-semibold">
                  #{entry.index} <span className="text-[10px] text-slate-500 block">{entry.id}</span>
                </td>
                <td className="py-3 px-4 font-medium text-slate-200">
                  {entry.constituency}
                </td>
                <td className="py-3 px-4 text-slate-300 flex items-center gap-1.5 pt-3.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>{entry.contractor_name}</span>
                </td>
                <td className="py-3 px-4 text-slate-400 font-mono">
                  {entry.embankment_sector}
                </td>
                <td className="py-3 px-4 font-mono font-bold text-slate-200">
                  ₹ {entry.allocated_budget.toFixed(2)} L
                </td>
                <td className="py-3 px-4 text-slate-400 font-mono">
                  {entry.completion_date}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    entry.status === 'VERIFIED'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  }`}>
                    {entry.integrity_score.toFixed(1)}% {entry.status}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-[10px] text-slate-500 max-w-[120px] truncate" title={entry.hash_signature}>
                  {entry.hash_signature.substring(0, 14)}...
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Record Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                Register New Embankment Work Block
              </h4>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Constituency</label>
                <select
                  value={constituency}
                  onChange={(e) => setConstituency(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                >
                  <option value="Majuli">Majuli (Kamalabari)</option>
                  <option value="Dibrugarh West">Dibrugarh West</option>
                  <option value="Tezpur">Tezpur (Bhomoraguri)</option>
                  <option value="Jalukbari">Jalukbari (Guwahati Saraighat)</option>
                  <option value="Silchar">Silchar (Barak Reach)</option>
                  <option value="Dhemaji">Dhemaji (Subansiri Reach)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Contractor Firm Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Brahmaputra Infrastructure Projects Pvt Ltd"
                  value={contractorName}
                  onChange={(e) => setContractorName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 placeholder-slate-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Allocated Budget (₹ Lakhs)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="450.00"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Completion Date</label>
                  <input
                    type="date"
                    required
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Embankment Sector / Reach Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kamalabari dyke spur 12 to 18 boulder pitching"
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 placeholder-slate-600"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Integrity Score (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={integrityScore}
                  onChange={(e) => setIntegrityScore(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-all"
                >
                  {submitting ? 'Hashing & Chaining...' : 'Submit & Chain Block'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
