import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { resolvePath } from '../../config';
import './MarkdownRenderer.css';

interface MarkdownRendererProps {
  content: string;
  onTutorialLink?: (filename: string) => void;
}

export default function MarkdownRenderer({ content, onTutorialLink }: MarkdownRendererProps): React.JSX.Element {
  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

  return (
    <div className="markdown-renderer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const inline = !props['data-inline'] && !match;
            return !inline && match ? (
              <SyntaxHighlighter
                style={isDarkMode ? (oneDark as any) : (oneLight as any)}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          a({ node, children, href, ...props }: any) {
            const isDownloadLink = href?.startsWith('/download/');
            const isExternal = href?.startsWith('http');
            const isTutorialLink = href?.endsWith('.md') && !isExternal && !isDownloadLink;
            
            if (isDownloadLink) {
              const filePath = resolvePath(href.replace('/download/', 'downloads/'));
              return (
                <button
                  type="button"
                  className="download-link"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                      const response = await fetch(filePath);
                      if (!response.ok) throw new Error('Download failed');
                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = filePath.split('/').pop() || 'download';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(url);
                    } catch (err) {
                      console.error('Failed to download file:', err);
                      alert('Failed to download file. Please try again.');
                    }
                  }}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    padding: 0, 
                    color: 'inherit',
                    font: 'inherit',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  {children}
                </button>
              );
            }
            
            if (isTutorialLink && onTutorialLink) {
              return (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onTutorialLink(href);
                  }}
                  {...props}
                >
                  {children}
                </a>
              );
            }
            
            return (
              <a
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                {...props}
              >
                {children}
              </a>
            );
          },
          img({ node, src, alt, ...props }: any) {
            // Transform relative image paths to work with Vite's public directory
            let imageSrc = src;
            if (src && !src.startsWith('http') && !src.startsWith('/')) {
              imageSrc = resolvePath(`tutorials/${src}`);
            }
            return <img src={imageSrc} alt={alt} {...props} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
