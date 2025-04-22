"use client";

import Dashboard from './components/Dashboard';

const Home = () => {
  return (
    <div className="min-h-screen bg-[#EDEDED]">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-gotham-bold text-[#001A30]">
              Forecast
            </h1>
            <p className="font-gotham-light text-[#0074CF] mt-1">
              Sistema Inteligente de Planeación de la Demanda
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-[#EDEDED] p-6">
          <Dashboard />
        </div>
      </div>
    </div>
  );
};

export default Home;