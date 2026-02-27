import React from 'react';
import { GitHubLoadModal } from './GitHubLoadModal';
import { getPat, clearPatIfNotPersisted } from '../utils/patStorage';
import type { GitHubAction, GitHubDomain } from '../types';
import { GitHubApiClient } from '../githubApi';
import type { GitHubMetadata } from '../types';

export interface GitHubLoadModalWrapperProps {
  domain: GitHubDomain;
  onFileSelect: (content: string, metadata: GitHubMetadata) => void;
  onBack: () => void;
  onError: (error: string) => void;
  requirePat: (action: GitHubAction) => Promise<GitHubApiClient | null>;
}

/**
 * Wrapper component for GitHub file browser that handles PAT requirement.
 * Checks for an existing PAT, requests one if needed, then renders GitHubLoadModal.
 */
export function GitHubLoadModalWrapper({
  domain,
  onFileSelect,
  onBack,
  onError,
  requirePat,
}: GitHubLoadModalWrapperProps) {
  const [token, setToken] = React.useState<string | null>(null);
  const [activeDomain, setActiveDomain] = React.useState<GitHubDomain>(domain);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    
    // First, check if we already have a PAT for the requested domain
    const existingPat = getPat(domain);
    if (existingPat) {
      setToken(existingPat);
      setActiveDomain(domain);
      setIsLoading(false);
      setIsModalOpen(true);
      return;
    }
    
    // If not, request one - this may change the domain
    requirePat('load').then((client) => {
      if (cancelled) return;
      
      if (client) {
        // PAT was provided, check which domain it was stored for
        // The user might have changed the domain in the modal
        const storedDomain = client.getDomain();
        const pat = getPat(storedDomain);
        if (pat) {
          setToken(pat);
          setActiveDomain(storedDomain);
          setIsLoading(false);
          setIsModalOpen(true);
        } else {
          onError('Failed to retrieve PAT after authentication');
          onBack();
        }
      } else {
        // User cancelled PAT modal - clean up temporary PAT
        clearPatIfNotPersisted();
        onBack();
      }
    }).catch((err) => {
      if (!cancelled) {
        onError(`GitHub authentication failed: ${err.message || 'Unknown error'}`);
        // Clean up temporary PAT on error
        clearPatIfNotPersisted();
        onBack();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [domain, requirePat, onBack, onError]);

  const handleClose = () => {
    setIsModalOpen(false);
    // Clean up temporary PAT when closing the load modal
    clearPatIfNotPersisted();
    onBack();
  };

  if (isLoading || !token) {
    return (
      <div style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ 
          color: 'var(--text-primary)',
          background: 'var(--bg-primary)',
          padding: '2rem',
          borderRadius: '0.5rem',
          border: '1px solid var(--border-color)',
        }}>
          Authenticating with GitHub...
        </div>
      </div>
    );
  }

  return (
    <GitHubLoadModal
      isOpen={isModalOpen}
      token={token}
      domain={activeDomain}
      onFileSelect={onFileSelect}
      onClose={handleClose}
      onError={onError}
    />
  );
}
