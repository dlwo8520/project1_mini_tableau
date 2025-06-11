import React from 'react';
import './index.css';
import UploadChart from './components/UploadChart';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow p-4 text-center font-bold text-xl">
        Mini Tableau
      </header>
      <main className="p-4">
        <UploadChart />
      </main>
    </div>
  );
}

export default App;
