import React, { useState } from 'react';
import { Smartphone, Download, Share2, Check, X, Chrome, Apple, Monitor, ExternalLink } from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNativeInstall?: () => Promise<void> | void;
  hasNativePrompt?: boolean;
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({
  isOpen,
  onClose,
  onNativeInstall,
  hasNativePrompt = false,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isIframe = typeof window !== 'undefined' && window.self !== window.top;
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const handleCopyLink = () => {
    let url = window.location.href;
    if (url.includes('ais-dev-')) {
      url = url.replace('ais-dev-', 'ais-pre-');
    }
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#FAF7F2] dark:bg-[#1A1714] border border-[#E8E3DA] dark:border-[#2D2823] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl relative text-[#1F1B16] dark:text-[#EDE8E1]"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-10 w-10 flex items-center justify-center text-[#78716C] hover:text-[#1F1B16] dark:hover:text-[#EDE8E1] rounded-full transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#4E785E]/15 text-[#4E785E] flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight">
              Enjoy Envelope Offline
            </h2>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
              Install the app for a smoother offline and home-screen experience
            </p>
          </div>
        </div>

        {hasNativePrompt && onNativeInstall ? (
          <div className="mb-4 p-4 rounded-xl bg-[#4E785E]/10 border border-[#4E785E]/20 text-center space-y-2.5">
            <p className="text-xs text-[#2C523B] dark:text-[#A8D1B7] font-medium">
              Your browser supports 1-click home screen installation!
            </p>
            <button
              type="button"
              onClick={onNativeInstall}
              id="native-install-prompt-btn"
              className="w-full py-2.5 px-4 rounded-xl bg-[#4E785E] hover:bg-[#436851] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Install to Home Screen Now</span>
            </button>
          </div>
        ) : null}

        {isIframe && (
          <div className="mb-4 p-3 rounded-xl bg-[#EFEAE1]/70 dark:bg-[#28221D]/70 border border-[#E8E3DA] dark:border-[#2D2823] space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#B85D43]">
              <span>Viewing inside AI Studio Preview Frame</span>
            </div>
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
              Browsers require opening the direct app URL to install PWAs to the home screen.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 py-1.5 px-3 rounded-lg bg-white dark:bg-[#1A1714] border border-[#DCD5C9] dark:border-[#3D362F] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs hover:bg-[#FAF7F2]"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#4E785E]" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copied ? 'Link Copied!' : 'Copy Direct URL'}</span>
              </button>
              <a
                href={window.location.href}
                target="_blank"
                rel="noreferrer"
                className="py-1.5 px-3 rounded-lg bg-[#1F1B16] text-[#FAF7F2] dark:bg-[#EDE8E1] dark:text-[#1A1714] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Open in Tab</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        <div className="space-y-3 text-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#78716C] dark:text-[#A8A29E] block">
            How to Install on Your Device:
          </span>

          {isIOS ? (
            <div className="p-3 rounded-xl border border-[#E8E3DA] dark:border-[#2D2823] bg-white/50 dark:bg-black/20 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
                <Apple className="w-4 h-4 text-[#78716C]" />
                <span>iPhone & iPad (Safari)</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
                <li>Tap the <strong>Share</strong> button (square with arrow up) at the bottom.</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                <li>Tap <strong>Add</strong> at top right. Done!</li>
              </ol>
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-[#E8E3DA] dark:border-[#2D2823] bg-white/50 dark:bg-black/20 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-[#1F1B16] dark:text-[#EDE8E1]">
                <Chrome className="w-4 h-4 text-[#486B88]" />
                <span>Android & Desktop (Chrome / Edge)</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
                <li>Tap the browser menu <strong>(⋮ or ⋯)</strong> at the top right.</li>
                <li>Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                <li>Confirm by tapping <strong>Install</strong>.</li>
              </ol>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 text-[11px] text-[#78716C] dark:text-[#A8A29E]">
            <Monitor className="w-3.5 h-3.5 text-[#4E785E]" />
            <span>Works seamlessly offline with full real-time cloud sync when connected.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
