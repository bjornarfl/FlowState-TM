import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import ThreatModelEditor from './components/ThreatModelEditor';
import GitHubFileLoader from './components/integrations/github/GitHubFileLoader';
import { ToastProvider } from './contexts/ToastContext';
import { SaveStateProvider } from './contexts/SaveStateContext';
import ToastContainer from './components/toast/ToastContainer';
import { migrateFromLocalStorage } from './utils/browserStorage';
import './App.css';

export default function App(): React.JSX.Element {
  const [isDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [migrationComplete, setMigrationComplete] = useState(false);

  // Migrate localStorage data on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Migrate existing localStorage data to IndexedDB
        const migratedCount = await migrateFromLocalStorage();
        if (migratedCount > 0) {
          console.log(`Migrated ${migratedCount} models from localStorage to IndexedDB`);
        }
      } catch (error) {
        console.error('Failed to migrate data:', error);
      } finally {
        setMigrationComplete(true);
      }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  // Don't render until migration is complete
  if (!migrationComplete) {
    return (
      <div className="app-loading">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <SaveStateProvider>
        <ToastContainer />
        <Routes>
          <Route path="/" element={<ThreatModelEditor />} />
          <Route path="/github/:owner/:repo/:filename" element={<GitHubFileLoader />} />
        </Routes>
      </SaveStateProvider>
    </ToastProvider>
  );
}
