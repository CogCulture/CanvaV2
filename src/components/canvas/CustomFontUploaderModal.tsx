import React, { useState, useRef } from 'react';
import { X, Upload, Code, CheckCircle, AlertCircle } from 'lucide-react';
import JSZip from 'jszip';

interface CustomFontUploaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCustomFont: (fontName: string) => void;
}

export function CustomFontUploaderModal({ isOpen, onClose, onAddCustomFont }: CustomFontUploaderModalProps) {
  const [activeTab, setActiveTab] = useState<'embed' | 'upload'>('embed');
  const [embedCode, setEmbedCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleEmbedSubmit = () => {
    setError(null);
    setSuccess(null);
    
    try {
      // Find the URL in the embed code
      // Example: <link href="https://fonts.googleapis.com/css2?family=Playwrite+ID:wght@100..400&display=swap" rel="stylesheet">
      const match = embedCode.match(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/);
      if (!match) {
        throw new Error("Could not find a valid Google Fonts css2 URL in the embed code.");
      }
      const url = match[1];
      
      // Extract font family name from URL
      const familyMatch = url.match(/family=([^&:]+)/);
      if (!familyMatch) {
        throw new Error("Could not find a font family name in the Google Fonts URL.");
      }
      
      // Handle multiple fonts if they pasted a link with multiple families, but we just take the first for simplicity, 
      // or we can parse all of them. Let's parse all `family=` instances if possible, but Google Fonts combines them 
      // like family=Font+One&family=Font+Two
      const urlObj = new URL(url.replace(/&amp;/g, '&'));
      const families = urlObj.searchParams.getAll('family');
      
      if (families.length === 0) {
         throw new Error("Could not parse font family from URL.");
      }

      // Inject the stylesheet
      const link = document.createElement('link');
      link.href = url;
      link.rel = 'stylesheet';
      document.head.appendChild(link);

      // Add each parsed font to custom fonts
      let addedFonts = [];
      for (const fam of families) {
        // Strip out weight variants like "Playwrite ID:wght@100..400" -> "Playwrite ID"
        const cleanName = fam.split(':')[0].replace(/\+/g, ' ');
        onAddCustomFont(cleanName);
        addedFonts.push(cleanName);
      }

      setSuccess(`Successfully imported: ${addedFonts.join(', ')}`);
      setEmbedCode('');
      setTimeout(() => {
        onClose();
        setSuccess(null);
      }, 1500);

    } catch (err: any) {
      setError(err.message || "Failed to parse embed code. Make sure it's a valid Google Fonts <link> tag.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setSuccess(null);
    const file = files[0];

    try {
      if (file.name.endsWith('.zip')) {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        
        let loadedCount = 0;
        let loadedNames = [];

        for (const relativePath in zipContent.files) {
          if (relativePath.match(/\.(ttf|otf|woff|woff2)$/i)) {
            const fontFile = zipContent.files[relativePath];
            const arrayBuffer = await fontFile.async('arraybuffer');
            
            // Extract a reasonable name from the filename
            // e.g. "PlaywriteID-VariableFont_wght.ttf" -> "PlaywriteID-VariableFont_wght"
            const filename = relativePath.split('/').pop() || 'UnknownFont';
            const fontName = filename.replace(/\.[^/.]+$/, "").replace(/-/g, ' ');

            const fontFace = new FontFace(fontName, arrayBuffer);
            const loadedFace = await fontFace.load();
            document.fonts.add(loadedFace);
            onAddCustomFont(fontName);
            
            loadedCount++;
            loadedNames.push(fontName);
          }
        }

        if (loadedCount === 0) {
          throw new Error("No valid font files (.ttf, .otf, .woff) found in the ZIP archive.");
        }

        setSuccess(`Successfully loaded ${loadedCount} font(s) from ZIP!`);
        setTimeout(() => {
          onClose();
          setSuccess(null);
        }, 1500);

      } else if (file.name.match(/\.(ttf|otf|woff|woff2)$/i)) {
        // Direct file upload
        const arrayBuffer = await file.arrayBuffer();
        const fontName = file.name.replace(/\.[^/.]+$/, "").replace(/-/g, ' ');
        
        const fontFace = new FontFace(fontName, arrayBuffer);
        const loadedFace = await fontFace.load();
        document.fonts.add(loadedFace);
        onAddCustomFont(fontName);

        setSuccess(`Successfully loaded font: ${fontName}`);
        setTimeout(() => {
          onClose();
          setSuccess(null);
        }, 1500);
      } else {
        throw new Error("Invalid file type. Please upload a .zip, .ttf, .otf, or .woff file.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load the font file.");
    }
    
    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="bg-[#1c1c1e] border border-[rgba(255,255,255,0.1)] rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[rgba(255,255,255,0.05)]">
          <h2 className="text-white font-medium">Upload Custom Font</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-[rgba(255,255,255,0.05)]">
          <button 
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'embed' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-white/50 hover:text-white/80'}`}
            onClick={() => setActiveTab('embed')}
          >
            <Code size={14} className="inline mr-2 -mt-0.5" />
            Embed Code
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'upload' ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5' : 'text-white/50 hover:text-white/80'}`}
            onClick={() => setActiveTab('upload')}
          >
            <Upload size={14} className="inline mr-2 -mt-0.5" />
            Upload File
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start text-red-400 text-sm">
              <AlertCircle size={16} className="shrink-0 mr-2 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start text-green-400 text-sm">
              <CheckCircle size={16} className="shrink-0 mr-2 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {activeTab === 'embed' && (
            <div className="space-y-4">
              <p className="text-white/60 text-sm">
                Paste the <code>&lt;link&gt;</code> embed code directly from Google Fonts.
              </p>
              <textarea
                value={embedCode}
                onChange={(e) => setEmbedCode(e.target.value)}
                placeholder='<link href="https://fonts.googleapis.com/css2?family=Playwrite+ID..." rel="stylesheet">'
                className="w-full h-32 bg-[#2c2c2e] border border-[rgba(255,255,255,0.1)] rounded-lg p-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono placeholder-white/20"
              />
              <button 
                onClick={handleEmbedSubmit}
                disabled={!embedCode.trim()}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
              >
                Import Font
              </button>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <p className="text-white/60 text-sm">
                Upload a downloaded <b>.zip</b> from Google Fonts, or select individual <b>.ttf / .otf</b> files.
              </p>
              
              <div 
                className="border-2 border-dashed border-[rgba(255,255,255,0.1)] hover:border-blue-500/50 hover:bg-blue-500/5 rounded-xl p-8 transition-all flex flex-col items-center justify-center cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={32} className="text-white/30 group-hover:text-blue-400 mb-3 transition-colors" />
                <p className="text-white font-medium mb-1 group-hover:text-blue-400 transition-colors">Click to upload file</p>
                <p className="text-white/40 text-xs">Supports .zip, .ttf, .otf, .woff</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".zip,.ttf,.otf,.woff,.woff2"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
