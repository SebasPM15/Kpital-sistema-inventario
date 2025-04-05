"use client";

import Dashboard from './components/Dashboard';

const Home = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-bold text-slate-800 mb-8">
          Sistema de Predicción de Inventario
        </h1>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <Dashboard />
        </div>
      </div>
    </div>
  );
};

export default Home;