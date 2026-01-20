import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabaseClient';
import {
  Activity,
  Power,
  Settings,
  Cpu,
  Wifi,
  WifiOff,
  AlertCircle,
  Thermometer,
  Droplets,
  Lock,
  Unlock,
  Zap,
  RotateCcw,
  Camera,
  CameraOff,
  Link
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

/**
 * Main Application Component for the Robotic Gripper Dashboard
 */
function App() {
  // --- STATE MANAGEMENT ---
  const [isConnected, setIsConnected] = useState(false); // ESP32 link status
  const [isGripped, setIsGripped] = useState(false);     // Current physical state (Grip/Release)
  const [telemetry, setTelemetry] = useState([]);        // Time-series data for the chart
  const [cameraIp, setCameraIp] = useState('');          // ESP32-CAM IP address
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stats, setStats] = useState({                   // Latest sensor readings
    temperature: 0,
    humidity: 0,
    motorCurrent: 0,
    fsrValue: 0,
    battery: 100
  });
  const [logs, setLogs] = useState([]);                  // System activity logs

  // --- REAL-TIME DATA & CONNECTIVITY ---
  useEffect(() => {
    let heartbeatTimer;

    /**
     * Checks if the ESP32 is still online based on the last telemetry timestamp
     */
    const checkConnection = async () => {
      const { data, error } = await supabase
        .from('telemetry')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const lastSeen = new Date(data[0].created_at).getTime();
        const now = new Date().getTime();
        // Marked as "STABLE" if data received in the last 15 seconds
        setIsConnected(now - lastSeen < 15000);
      } else {
        setIsConnected(false);
      }
    };

    checkConnection();
    // Run the connection check every 5 seconds
    const interval = setInterval(checkConnection, 5000);

    //  TELEMETRY SUBSCRIPTION: Listens for new sensor data from ESP32
    const telemetryChannel = supabase
      .channel('telemetry-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'telemetry' },
        (payload) => {
          setIsConnected(true); // Data just arrived, system is obviously online
          const newData = payload.new;

          // Update the numeric stats
          setStats({
            temperature: newData.temperature || 0,
            humidity: newData.humidity || 0,
            motorCurrent: newData.motor_current || 0,
            fsrValue: newData.fsr_value || 0,
            battery: newData.battery_pct || 100
          });

          // Add to the live chart data (keeping last 20 points)
          setTelemetry(prev => [...prev.slice(-19), {
            time: new Date().toLocaleTimeString(),
            fsr: newData.fsr_value,
            current: newData.motor_current
          }]);

          addLog(`Telemetry Update: FSR=${newData.fsr_value}% Current=${newData.motor_current}A`);
        }
      )
      .subscribe();

    // 🤖 COMMAND STATUS SUBSCRIPTION: Listens for when ESP32 acknowledges a command
    const commandsChannel = supabase
      .channel('command-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'commands' },
        (payload) => {
          if (payload.new.status === 'EXECUTED') {
            addLog(` Command [${payload.new.type}] executed by Gripper`);
          }
        }
      )
      .subscribe();

    // Cleanup function when the app closes
    return () => {
      clearInterval(interval);
      supabase.removeChannel(telemetryChannel);
      supabase.removeChannel(commandsChannel);
    };
  }, []);

  // --- HELPER FUNCTIONS ---

  /**
   * Adds a new event to the on-screen log terminal
   */
  const addLog = (message) => {
    setLogs(prev => [{ time: new Date().toLocaleTimeString(), message }, ...prev.slice(0, 9)]);
  };

  /**
   * Sends a control signal to the Supabase 'commands' table for the ESP32 to fetch
   */
  const sendCommand = async (type, value = null) => {
    addLog(`Sending command: ${type}...`);
    const { error } = await supabase
      .from('commands')
      .insert([{ type, value, status: 'PENDING' }]);

    if (error) {
      addLog(`Error: ${error.message}`);
    } else {
      // Optimistically update UI state
      if (type === 'GRIP') setIsGripped(true);
      if (type === 'RELEASE') setIsGripped(false);
      addLog(`Command ${type} sent successfully.`);
    }
  };

  // --- USER INTERFACE (JSX) ---
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">

      {/* HEADER SECTION: Logo, Title, and Connection Status */}
      <header className="flex flex-col md:flex-row justify-between items-center glass-card p-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 rounded-xl neon-border">
            <Cpu className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold glow-text tracking-tight uppercase">Robotic Gripper</h1>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Activity className="w-3 h-3 text-green-500" /> SYSTEM ONLINE | HEXA UNIT
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase text-slate-500 font-bold mb-1 tracking-widest">ESP32 STATUS</span>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${isConnected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              {isConnected ? 'STABLE' : 'DISCONNECTED'}
            </div>
          </div>
          <button className="btn btn-circle btn-ghost btn-sm text-slate-400">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT COLUMN: Manual Controls for the Gripper */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-card p-6 border-t-4 border-blue-500/50">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Actuation Engine</h2>

            <div className="grid grid-cols-1 gap-4">
              {/* Main Engage/Release Toggle */}
              <button
                onClick={() => sendCommand(isGripped ? 'RELEASE' : 'GRIP')}
                className={`btn btn-xl h-24 text-lg gap-3 ${isGripped ? 'btn-error' : 'btn-primary'} transition-all hover:scale-[1.02] shadow-xl`}
              >
                {isGripped ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                {isGripped ? 'FULL RELEASE' : 'FULL ENGAGE'}
              </button>

              {/* Incremental (+/-) Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => sendCommand('STEP_RELEASE')}
                  className="btn btn-lg flex-1 btn-outline btn-info border-2 hover:bg-info/10"
                  title="Loosen step"
                >
                  <div className="flex flex-col items-center leading-none">
                    <span className="text-3xl font-bold">−</span>
                    <span className="text-[10px] font-bold mb-2">LOOSEN</span>
                  </div>
                </button>
                <button
                  onClick={() => sendCommand('STEP_GRIP')}
                  className="btn btn-lg flex-1 btn-outline btn-primary border-2 hover:bg-primary/10"
                  title="Tighten step"
                >
                  <div className="flex flex-col items-center leading-none">
                    <span className="text-3xl font-bold">+</span>
                    <span className="text-[10px] font-bold mb-2">TIGHTEN</span>
                  </div>
                </button>
              </div>

              {/* Reset and Emergency Buttons */}
              <div className="grid grid-cols-2 gap-4 mt-2">
                <button
                  onClick={() => sendCommand('RESET')}
                  className="btn btn-outline btn-sm text-slate-400 border-slate-700 hover:bg-slate-800"
                >
                  <RotateCcw className="w-4 h-4 mr-2" /> RECALIBRATE
                </button>
                <button className="btn btn-outline btn-sm btn-error opacity-50 cursor-not-allowed">
                  <Power className="w-4 h-4 mr-2" /> EMERGENCY
                </button>
              </div>
            </div>

            {/* Hardware Sliders (Speed/Torque) */}
            <div className="mt-8 space-y-6">
              <div>
                <div className="flex justify-between text-xs mb-2 text-slate-400 uppercase tracking-wider font-bold">
                  <span>Target Torque</span>
                  <span className="text-blue-400">75%</span>
                </div>
                <input type="range" min="0" max="100" defaultValue="75" className="range range-xs range-primary" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-2 text-slate-400 uppercase tracking-wider font-bold">
                  <span>Movement Speed</span>
                  <span className="text-blue-400">40%</span>
                </div>
                <input type="range" min="0" max="100" defaultValue="40" className="range range-xs range-accent" />
              </div>
            </div>
          </div>

          {/* Environmental Sensor Display (Temp/Humidity) */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Environment</h2>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800/50">
                <Thermometer className="w-5 h-5 text-orange-400 mx-auto mb-2" />
                <div className="text-xl font-bold">{stats.temperature}°C</div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Temperature</div>
              </div>
              <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800/50">
                <Droplets className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                <div className="text-xl font-bold">{stats.humidity}%</div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Humidity</div>
              </div>
            </div>
          </div>
        </div>

        {/*  CENTER COLUMN: Real-Time Telemetry and Data Logging */}
        <div className="lg:col-span-8 space-y-6">

          {/* Live Graph: Motor Load vs Grip Pressure */}
          {/* 📹 VISUAL MONITORING: Live ESP32-CAM Stream */}
          <div className="glass-card p-6 overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Visual Monitoring</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-red-500 pulse-led' : 'bg-slate-600'}`}></div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase">{isCameraActive ? 'LIVE FEED ACTIVE' : 'CAMERA STANDBY'}</span>
                </div>
              </div>

              <div className="flex w-full md:w-auto gap-2">
                <div className="relative flex-1">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Camera Stream URL (e.g. 192.168.1.50:81/stream)"
                    className="input input-sm input-bordered w-full pl-8 bg-black/20 text-xs border-slate-800"
                    value={cameraIp}
                    onChange={(e) => setCameraIp(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => setIsCameraActive(!isCameraActive)}
                  className={`btn btn-sm ${isCameraActive ? 'btn-error' : 'btn-primary'}`}
                >
                  {isCameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                  {isCameraActive ? 'STOP' : 'START'}
                </button>
              </div>
            </div>

            <div className="relative aspect-video bg-black/40 rounded-xl border border-slate-800 overflow-hidden group">
              {isCameraActive && cameraIp ? (
                <img
                  src={`http://${cameraIp}`}
                  alt="ESP32-CAM Stream"
                  className="w-full h-full object-cover"
                  onError={() => {
                    setIsCameraActive(false);
                    addLog("Error: Failed to connect to Camera. Check IP address.");
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                  <CameraOff className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-xs font-bold tracking-widest opacity-40">NO SIGNAL DETECTED</p>
                </div>
              )}

              {isCameraActive && (
                <div className="absolute top-4 right-4 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-mono text-red-500 font-bold border border-red-500/30">
                  REC ●
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-6 h-[400px]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Live Force-Sense Telemetry</h2>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Grip Force</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Motor Load</span>
                </div>
              </div>
            </div>

            <div className="h-full w-full -ml-4">
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={telemetry}>
                  <defs>
                    <linearGradient id="colorFsr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                  <XAxis dataKey="time" stroke="#4a5568" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#4a5568" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #2d3748', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Area type="monotone" dataKey="fsr" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorFsr)" />
                  <Area type="monotone" dataKey="current" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCurrent)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Stats: Current, Pressure, and Battery level */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-4 space-y-4">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Motor Current</h3>
              <div className="flex items-center justify-between">
                <Zap className="w-8 h-8 text-emerald-400" />
                <span className="text-3xl font-black text-emerald-400">{stats.motorCurrent}A</span>
              </div>
              <progress className="progress progress-emerald w-full" value={stats.motorCurrent * 10} max="100"></progress>
            </div>

            <div className="glass-card p-4 space-y-4">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Grip Pressure</h3>
              <div className="flex items-center justify-between">
                <Activity className="w-8 h-8 text-blue-400" />
                <span className="text-3xl font-black text-blue-400">{stats.fsrValue}%</span>
              </div>
              <progress className="progress progress-primary w-full" value={stats.fsrValue} max="100"></progress>
            </div>

            <div className="glass-card p-4 space-y-4">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Power</h3>
              <div className="flex items-center justify-between">
                <Power className={`w-8 h-8 ${stats.battery > 20 ? 'text-green-400' : 'text-red-400'}`} />
                <span className="text-3xl font-black">{stats.battery}%</span>
              </div>
              <progress className={`progress w-full ${stats.battery > 20 ? 'progress-success' : 'progress-error'}`} value={stats.battery} max="100"></progress>
            </div>
          </div>

          {/* Activity Terminal: Shows history of commands and status */}
          <div className="glass-card p-6">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Command Logs</h2>
            <div className="bg-black/40 rounded-lg p-4 font-mono text-xs h-32 overflow-y-auto border border-slate-800 space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-4">
                  <span className="text-slate-600">[{log.time}]</span>
                  <span className={log.message.includes('Error') ? 'text-red-400' : 'text-blue-300'}>{log.message}</span>
                </div>
              ))}
              {logs.length === 0 && <div className="text-slate-700 italic">No activity logged yet...</div>}
            </div>
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="text-center py-6 text-slate-500 text-xs font-bold tracking-widest">
        &copy; 2026 HEXA UNIT ROBOTICS | EMERGENCY ASSISTANCE SYSTEM
      </footer>
    </div>
  );
}

export default App;
