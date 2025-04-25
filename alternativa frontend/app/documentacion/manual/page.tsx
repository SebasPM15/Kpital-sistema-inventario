'use client';

export default function ManualUsuario() {
  return (
    <div className="min-h-screen bg-white text-[#001A30] p-6 space-y-6">
      <h1 className="text-2xl font-bold">📘 Manual de Usuario</h1>

      <embed
        src="/manual_usuario.pdf"
        type="application/pdf"
        width="100%"
        height="800px"
        className="border border-gray-300 rounded-xl shadow"
      />

      <div className="flex gap-4">
        <a href="/manual_usuario.pdf" download>
          <button className="bg-[#0074CF] hover:bg-[#005fa3] text-white px-6 py-2 rounded-lg shadow transition-all">
            Descargar Manual
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
