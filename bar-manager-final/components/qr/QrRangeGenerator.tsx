'use client';

import { useState } from 'react';

interface QrRangeGeneratorProps {
  onGenerate: (labels: string) => void;
}

export function QrRangeGenerator({ onGenerate }: QrRangeGeneratorProps) {
  const [prefix, setPrefix] = useState('Table');
  const [startNum, setStartNum] = useState(1);
  const [endNum, setEndNum] = useState(30);

  const handleGenerate = () => {
    if (startNum > endNum) {
      alert('Start number must be less than or equal to end number');
      return;
    }

    if (endNum - startNum > 99) {
      alert('Maximum 100 tables can be generated at once');
      return;
    }

    const labels: string[] = [];
    for (let i = startNum; i <= endNum; i++) {
      labels.push(`${prefix} ${i}`);
    }

    onGenerate(labels.join(', '));
  };

  const previewCount = Math.max(0, endNum - startNum + 1);

  return (
    <div className="space-y-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h4 className="text-sm font-semibold text-gray-700">Generate Table Range</h4>
      
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Prefix
          </label>
          <input
            type="text"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="Table"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Start Number
          </label>
          <input
            type="number"
            min="1"
            max="999"
            value={startNum}
            onChange={(e) => setStartNum(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            End Number
          </label>
          <input
            type="number"
            min="1"
            max="999"
            value={endNum}
            onChange={(e) => setEndNum(parseInt(e.target.value) || 30)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Will generate {previewCount} table{previewCount !== 1 ? 's' : ''}
          {previewCount > 0 && (
            <span className="ml-1 text-gray-600">
              ({prefix} {startNum} - {prefix} {endNum})
            </span>
          )}
        </p>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={previewCount === 0}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          Generate
        </button>
      </div>

      {previewCount > 50 && (
        <p className="text-xs text-amber-600">
          ⚠️ Generating {previewCount} tables may take a few moments
        </p>
      )}
    </div>
  );
}
