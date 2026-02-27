import React, { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import ThreatModelEditor from '../../components/ThreatModelEditor';
import { PatModal } from './modals/PatModal';
import { useGitHubIntegration } from './hooks/useGitHubIntegration';
import type { GitHubMetadata } from './types';
import { parseYaml } from '../../utils/yamlParser';
import { GitHubApiClient } from './githubApi';
import { clearPatIfNotPersisted } from './utils/patStorage';
import { useToast } from '../../contexts/ToastContext';

/**
 * GitHubFileLoader component
 * 
 * Handles loading threat model files from GitHub via URL parameters.
 * URL format: /github/:owner/:repo/:filename?branch=<branch>
 */

interface GitHubFileLoaderContentProps {
  owner: string;
  repo: string;
  filename: string;
  branch?: string;
}

function GitHubFileLoaderContent({
  owner,
  repo,
  filename,
  branch,
}: GitHubFileLoaderContentProps): React.JSX.Element {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const {
    domain,
    setDomain,
    isValidatingPat,
    patError,
    submitPat,
    closePatModal,
  } = useGitHubIntegration();
  
  const [loadedContent, setLoadedContent] = useState<string | null>(null);
  const [loadedMetadata, setLoadedMetadata] = useState<GitHubMetadata | null>(null);
  const [showModal, setShowModal] = useState(true);

  // If file is loaded, render ThreatModelEditor
  if (loadedContent && loadedMetadata) {
    return (
      <ThreatModelEditor
        initialContent={loadedContent}
        initialGitHubMetadata={loadedMetadata}
      />
    );
  }

  const handlePatSubmit = async (token: string, persistInSession: boolean) => {
    // Use the submitPat from the hook which handles validation and error states
    const success = await submitPat(token, persistInSession);
    
    if (!success) {
      // submitPat already set the error state, just return false to keep modal open
      return false;
    }

    // Close modal
    setShowModal(false);

    // Create client and load the file
    const client = new GitHubApiClient(token, domain);
    await loadFileWithPat(client);
    
    return true;
  };

  const loadFileWithPat = async (client: GitHubApiClient) => {
    try {
      const clientDomain = client.getDomain();
      
      // Get branch or fetch default branch from repository
      let finalBranch = branch;
      
      if (!finalBranch) {
        try {
          const repoData = await client.getRepository(owner, repo);
          finalBranch = repoData.default_branch;
        } catch (error) {
          if (error instanceof Error) {
            throw new Error(`Failed to fetch repository: ${error.message}`);
          }
          throw new Error('Failed to fetch repository');
        }
      }

      // Construct path to threat model file
      const filePath = `.threat-models/${filename}.yaml`;

      // Fetch file content
      let content: string;
      let sha: string;
      
      try {
        const fileData = await client.getFileContent(owner, repo, filePath, finalBranch);
        content = fileData.content;
        sha = fileData.sha;
      } catch (error: any) {
        if (error.status === 404) {
          throw new Error(`File not found: ${filePath} in ${owner}/${repo} (branch: ${finalBranch})`);
        } else if (error.status === 401 || error.status === 403) {
          throw new Error('GitHub authentication failed. Please check your PAT has the required scopes (repo or public_repo)');
        }
        throw new Error(`Failed to load file: ${error.message || 'Unknown error'}`);
      }

      // Validate YAML
      try {
        parseYaml(content);
      } catch (error) {
        throw new Error('File is not valid YAML');
      }

      // Create GitHub metadata
      const metadata: GitHubMetadata = {
        domain: clientDomain,
        owner,
        repository: repo,
        branch: finalBranch,
        path: filePath,
        sha,
        loadedAt: Date.now(),
      };

      // Set loaded content and metadata
      setLoadedContent(content);
      setLoadedMetadata(metadata);
      
      // Clean up PAT after successful GitHub action completion
      clearPatIfNotPersisted();
    } catch (error) {
      // Show error toast and navigate to home
      const errorMessage = error instanceof Error ? error.message : 'Failed to load GitHub file';
      showToast(errorMessage, 'error');
      navigate('/');
    }
  };

  // Show PAT modal while loading
  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: '1.2rem',
        gap: '1rem',
        flexDirection: 'column'
      }}>
        <div className="spinner" style={{
          width: '40px',
          height: '40px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3498db',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div>Loading GitHub file...</div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      {showModal && (
        <PatModal
          action="load"
          domain={domain}
          onSubmit={handlePatSubmit}
          onCancel={closePatModal}
          onChangeDomain={setDomain}
          isValidating={isValidatingPat}
          error={patError || undefined}
        />
      )}
    </>
  );
}

// Main component that parses URL params
export default function GitHubFileLoader(): React.JSX.Element {
  const { owner, repo, filename } = useParams<{
    owner: string;
    repo: string;
    filename: string;
  }>();
  const [searchParams] = useSearchParams();

  if (!owner || !repo || !filename) {
    return <div>Invalid GitHub URL</div>;
  }

  const branch = searchParams.get('branch') || undefined;

  return (
    <GitHubFileLoaderContent
      owner={owner}
      repo={repo}
      filename={filename}
      branch={branch}
    />
  );
}
