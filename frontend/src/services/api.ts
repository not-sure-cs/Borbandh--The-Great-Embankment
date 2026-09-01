import { 
  NodeTelemetry, 
  EmbankmentNode, 
  ContractorLedger, 
  CitizenReport, 
  AlertLog, 
  SystemStats,
  GeoJSONData 
} from '../types';

const API_BASE = '/api/v1';

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  async getStats(): Promise<SystemStats> {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  async getNodes(): Promise<EmbankmentNode[]> {
    const res = await fetch(`${API_BASE}/telemetry/nodes`);
    if (!res.ok) throw new Error('Failed to fetch nodes');
    return res.json();
  },

  async getTelemetryHistory(nodeId?: string, limit: number = 100): Promise<NodeTelemetry[]> {
    const url = new URL(`${window.location.origin}${API_BASE}/telemetry/history`);
    if (nodeId) url.searchParams.set('node_id', nodeId);
    url.searchParams.set('limit', limit.toString());
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('Failed to fetch telemetry history');
    return res.json();
  },

  async ingestTelemetry(payload: {
    node_id: string;
    zone_name?: string;
    soil_moisture: number;
    tilt_angle: number;
    audio_rms: number;
  }): Promise<NodeTelemetry> {
    const res = await fetch(`${API_BASE}/telemetry/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to ingest telemetry');
    return res.json();
  },

  async getLedger(): Promise<ContractorLedger[]> {
    const res = await fetch(`${API_BASE}/ledger`);
    if (!res.ok) throw new Error('Failed to fetch ledger');
    return res.json();
  },

  async addLedgerEntry(entry: Partial<ContractorLedger>): Promise<ContractorLedger> {
    const res = await fetch(`${API_BASE}/ledger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    if (!res.ok) throw new Error('Failed to create ledger record');
    return res.json();
  },

  async getCitizenReports(): Promise<CitizenReport[]> {
    const res = await fetch(`${API_BASE}/reports`);
    if (!res.ok) throw new Error('Failed to fetch reports');
    return res.json();
  },

  async submitCitizenReport(report: Partial<CitizenReport>): Promise<CitizenReport> {
    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });
    if (!res.ok) throw new Error('Failed to submit citizen report');
    return res.json();
  },

  async getAlerts(limit: number = 50): Promise<AlertLog[]> {
    const res = await fetch(`${API_BASE}/alerts?limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch alerts');
    return res.json();
  },

  async triggerScenario(scenario: string, nodeId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/simulator/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario, node_id: nodeId })
    });
    if (!res.ok) throw new Error('Failed to trigger scenario');
    return res.json();
  },

  async toggleSimulator(action: 'start' | 'stop'): Promise<any> {
    const res = await fetch(`${API_BASE}/simulator/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    if (!res.ok) throw new Error('Failed to toggle simulator');
    return res.json();
  },

  async getGeoJSON(): Promise<GeoJSONData> {
    const res = await fetch(`${API_BASE}/geo/embankments`);
    if (!res.ok) throw new Error('Failed to fetch GeoJSON data');
    return res.json();
  }
};

export class SSEClient {
  private eventSource: EventSource | null = null;
  private listeners: { [event: string]: ((data: any) => void)[] } = {};
  private statusListeners: ((connected: boolean) => void)[] = [];

  connect() {
    if (this.eventSource) return;

    this.eventSource = new EventSource(`${API_BASE}/stream`);

    this.eventSource.onopen = () => {
      this.notifyStatus(true);
    };

    this.eventSource.onerror = () => {
      this.notifyStatus(false);
    };

    // Register event listeners
    const eventTypes = ['telemetry', 'alert', 'ledger', 'report', 'connected'];
    eventTypes.forEach(type => {
      this.eventSource?.addEventListener(type, (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          this.emit(type, parsed);
        } catch (err) {
          console.error(`Error parsing SSE ${type} event:`, err);
        }
      });
    });
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.notifyStatus(false);
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  onStatusChange(callback: (connected: boolean) => void) {
    this.statusListeners.push(callback);
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }

  private emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  private notifyStatus(connected: boolean) {
    this.statusListeners.forEach(cb => cb(connected));
  }
}

export const sseClient = new SSEClient();
