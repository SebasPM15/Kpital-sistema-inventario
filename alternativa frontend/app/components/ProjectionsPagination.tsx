import React, { useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

interface ProjectionsPaginationProps {
    currentPage: number;
    totalPages: number;
    setCurrentPage: (page: number) => void;
}

const ProjectionsPagination: React.FC<ProjectionsPaginationProps> = ({
    currentPage,
    totalPages,
    setCurrentPage,
}) => {
    const [jumpPage, setJumpPage] = useState<string>('');

    const handleJumpPage = () => {
        const pageNum = parseInt(jumpPage, 10);
        if (pageNum >= 1 && pageNum <= totalPages && !isNaN(pageNum)) {
            setCurrentPage(pageNum);
            setJumpPage('');
        }
    };

    return (
        <div className="flex items-center justify-center gap-4 mt-4">
            {/* Previous Button */}
            <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-700 disabled:bg-slate-100 disabled:text-slate-400 transition-colors shadow-sm"
            >
                <FaChevronLeft className="w-4 h-4" />
            </button>

            {/* Page Info */}
            <div className="flex items-center gap-2 bg-sky-50 px-6 py-2 rounded-full">
                <span className="text-sm font-medium text-sky-700 whitespace-nowrap">
                    Página <span className="text-sky-800 font-bold">{currentPage}</span> de {totalPages}
                </span>
            </div>

            {/* Jump to Page Input */}
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    value={jumpPage}
                    onChange={(e) => setJumpPage(e.target.value)}
                    placeholder="Ir a"
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                    onClick={handleJumpPage}
                    disabled={!jumpPage || isNaN(parseInt(jumpPage)) || parseInt(jumpPage) < 1 || parseInt(jumpPage) > totalPages}
                    className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs disabled:opacity-50"
                >
                    Ir
                </button>
            </div>

            {/* Next Button */}
            <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-700 disabled:bg-slate-100 disabled:text-slate-400 transition-colors shadow-sm"
            >
                <FaChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
};

export default ProjectionsPagination;