'use client';

export default function GuiaDesarrollador() {
  return (
    <div className="min-h-screen bg-white text-[#001A30] p-6 space-y-6">
      <h1 className="text-2xl font-bold">📗 Guía del Desarrollador</h1>

      <embed
        src="/guia_desarrollador.pdf"
        type="application/pdf"
        width="100%"
        height="800px"
        className="border border-gray-300 rounded-xl shadow"
      />

      <div className="flex gap-4">
        <a href="/guia_desarrollador.pdf" download>
          <button className="bg-[#0074CF] hover:bg-[#005fa3] text-white px-6 py-2 rounded-lg shadow transition-all">
            Descargar Guía
          </button>
        </a>

        <a href="/">
          <button className="bg-gray-200 hover:bg-gray-300 text-[#001A30] px-6 py-2 rounded-lg shadow transition-all">
            ← Volver al Inicio
          </button>
        </a>
      </div>
    </div>
  );
}
