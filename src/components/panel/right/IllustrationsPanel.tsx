import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Loader2,
  ImageIcon,
  Palette,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Button from '../../ui/Button';
import Text from '../../ui/Text';
import { TextColors, TextVariants, TextWeights } from '../../../types/typography';
import { invoke } from '../../../utils/tauri-mocks';
import { Invokes } from '../../ui/AppProperties';

interface UnDrawIllustration {
  _id: string;
  title: string;
  media: string;
  newSlug: string;
}

const BASE_CDN_URL = 'https://cdn.undraw.co/illustration/';
const BASE_PAGE_URL = 'https://undraw.co/illustrations';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
  exit: { opacity: 0 },
};

const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, scale: 0.95 },
};

const CURATED_ILLUSTRATIONS: UnDrawIllustration[] = [
  { _id: '1', title: 'Teacher', media: BASE_CDN_URL + 'teacher_n0ow.svg', newSlug: 'teacher_n0ow' },
  { _id: '2', title: 'Searching', media: BASE_CDN_URL + 'searching_pqji.svg', newSlug: 'searching_pqji' },
  { _id: '3', title: 'Growth Analytics', media: BASE_CDN_URL + 'growth-analytics_vzjz.svg', newSlug: 'growth-analytics_vzjz' },
  { _id: '4', title: 'Wind Turbines', media: BASE_CDN_URL + 'wind-turbines_sq2c.svg', newSlug: 'wind-turbines_sq2c' },
  { _id: '5', title: 'Biometric Login', media: BASE_CDN_URL + 'biometric-login_v832.svg', newSlug: 'biometric-login_v832' },
  { _id: '6', title: 'Tech Keynote', media: BASE_CDN_URL + 'tech-keynote_ytf3.svg', newSlug: 'tech-keynote_ytf3' },
  { _id: '7', title: 'Motion Alert', media: BASE_CDN_URL + 'motion-alert_pr1a.svg', newSlug: 'motion-alert_pr1a' },
  { _id: '8', title: 'Share Results', media: BASE_CDN_URL + 'share-results_lfh5.svg', newSlug: 'share-results_lfh5' },
  { _id: '9', title: 'Contract Signed', media: BASE_CDN_URL + 'contract-signed_vutk.svg', newSlug: 'contract-signed_vutk' },
  { _id: '10', title: 'Online Party', media: BASE_CDN_URL + 'online-party_uybk.svg', newSlug: 'online-party_uybk' },
  { _id: '11', title: 'Goal', media: BASE_CDN_URL + 'goal_v712.svg', newSlug: 'goal_v712' },
  { _id: '12', title: 'Travel Mode', media: BASE_CDN_URL + 'travel-mode_103y.svg', newSlug: 'travel-mode_103y' },
  { _id: '13', title: 'Comment Sent', media: BASE_CDN_URL + 'comment-sent_8c4r.svg', newSlug: 'comment-sent_8c4r' },
  { _id: '14', title: 'Select Character', media: BASE_CDN_URL + 'select-character_kdsh.svg', newSlug: 'select-character_kdsh' },
  { _id: '15', title: 'Content Team', media: BASE_CDN_URL + 'content-team_1p7b.svg', newSlug: 'content-team_1p7b' },
  { _id: '16', title: 'Open Book', media: BASE_CDN_URL + 'open-book_pet1.svg', newSlug: 'open-book_pet1' },
  { _id: '17', title: 'Web Developer', media: BASE_CDN_URL + 'web-developer_gxaa.svg', newSlug: 'web-developer_gxaa' },
  { _id: '18', title: 'Reviews', media: BASE_CDN_URL + 'reviews_bmgj.svg', newSlug: 'reviews_bmgj' },
  { _id: '19', title: 'Order Status', media: BASE_CDN_URL + 'order-status_swsl.svg', newSlug: 'order-status_swsl' },
  { _id: '20', title: 'Road to Knowledge', media: BASE_CDN_URL + 'road-to-knowledge_ufma.svg', newSlug: 'road-to-knowledge_ufma' },
  { _id: '21', title: 'Exploring', media: BASE_CDN_URL + 'exploring_d1vd.svg', newSlug: 'exploring_d1vd' },
  { _id: '22', title: 'Charts', media: BASE_CDN_URL + 'charts_31si.svg', newSlug: 'charts_31si' },
  { _id: '23', title: 'AI Data Extraction', media: BASE_CDN_URL + 'ai-data-extraction_soxc.svg', newSlug: 'ai-data-extraction_soxc' },
  { _id: '24', title: 'Budgeting', media: BASE_CDN_URL + 'budgeting_klon.svg', newSlug: 'budgeting_klon' },
  { _id: '25', title: 'Digital Signature', media: BASE_CDN_URL + 'digital-signature_ttti.svg', newSlug: 'digital-signature_ttti' },
  { _id: '26', title: 'Finding the Way', media: BASE_CDN_URL + 'finding-the-way_qp1z.svg', newSlug: 'finding-the-way_qp1z' },
  { _id: '27', title: 'Conference Call', media: BASE_CDN_URL + 'conference-call_jgi5.svg', newSlug: 'conference-call_jgi5' },
  { _id: '28', title: 'Build Mode', media: BASE_CDN_URL + 'build-mode_aa78.svg', newSlug: 'build-mode_aa78' },
  { _id: '29', title: 'Delete Files', media: BASE_CDN_URL + 'delete-files_ozzz.svg', newSlug: 'delete-files_ozzz' },
  { _id: '30', title: 'Meet the Team', media: BASE_CDN_URL + 'meet-the-team_fau8.svg', newSlug: 'meet-the-team_fau8' },
  { _id: '31', title: 'Team Work', media: BASE_CDN_URL + 'team-work_ig4r.svg', newSlug: 'team-work_ig4r' },
  { _id: '32', title: 'Setup Wizard', media: BASE_CDN_URL + 'setup-wizard_xzmo.svg', newSlug: 'setup-wizard_xzmo' },
  { _id: '33', title: 'Code Review', media: BASE_CDN_URL + 'code-review_mtjz.svg', newSlug: 'code-review_mtjz' },
  { _id: '34', title: 'Developer Activity', media: BASE_CDN_URL + 'developer-activity_5kut.svg', newSlug: 'developer-activity_5kut' },
  { _id: '35', title: 'Mobile Login', media: BASE_CDN_URL + 'mobile-login_cywn.svg', newSlug: 'mobile-login_cywn' },
  { _id: '36', title: 'Artificial Intelligence', media: BASE_CDN_URL + 'artificial-intelligence_mzu4.svg', newSlug: 'artificial-intelligence_mzu4' },
  { _id: '37', title: 'Business Plan', media: BASE_CDN_URL + 'business-plan_2i3z.svg', newSlug: 'business-plan_2i3z' },
];

const PRESET_COLORS = [
  { name: 'Violet', hex: '#6c63ff' },
  { name: 'Blue', hex: '#4285f4' },
  { name: 'Green', hex: '#2ecc71' },
  { name: 'Orange', hex: '#f39c12' },
  { name: 'Red', hex: '#e74c3c' },
];

// Global drag payload store - avoids DataTransfer size limits and Framer Motion conflicts
export const dragPayloadStore = new Map<string, { title: string; svgText: string; slug: string }>();

function IllustrationCard({
  illustration,
  accentColor,
}: {
  illustration: UnDrawIllustration;
  accentColor: string;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [svgText, setSvgText] = useState<string | null>(null);
  const [svgDataUrl, setSvgDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchSvg = async () => {
      try {
        const text: string = await invoke(Invokes.FetchSvgContent, { url: illustration.media });
        const coloredText = text.replace(/#6c63ff/gi, accentColor);
        if (active) {
          setSvgText(coloredText);
          const blob = new Blob([coloredText], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          setSvgDataUrl(url);
          setIsLoaded(true);
          setHasError(false);
        }
      } catch (err) {
        if (active) {
          setHasError(true);
          setIsLoaded(true);
        }
      }
    };
    fetchSvg();
    return () => {
      active = false;
      // Note: Since we don't have access to the created URL easily in the cleanup, 
      // we'll manage the URL reference by storing it in a ref or just revoking the state
    };
  }, [illustration.media, accentColor]);

  useEffect(() => {
    return () => {
      if (svgDataUrl && svgDataUrl.startsWith('blob:')) {
        URL.revokeObjectURL(svgDataUrl);
      }
    };
  }, [svgDataUrl]);

  if (hasError) return null;

  const handleNativeDragStart = (e: React.DragEvent) => {
    if (!svgText) { e.preventDefault(); return; }
    const id = illustration._id;
    dragPayloadStore.set(id, { title: illustration.title, svgText, slug: illustration.newSlug });
    e.dataTransfer.setData('application/x-rapidraw-undraw', id);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      draggable={!!svgText}
      onDragStart={handleNativeDragStart}
      className="cursor-grab active:cursor-grabbing"
    >
      <motion.div
        layout
        variants={itemVariants}
        className="bg-surface rounded-xl overflow-hidden group border border-border-color/40 hover:border-accent/40 flex flex-col transition-all duration-200 hover:shadow-lg hover:shadow-accent/5"
      >
        <div className="relative w-full aspect-[4/3] bg-bg-primary flex items-center justify-center overflow-hidden p-4">
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
            </div>
          )}
          {svgDataUrl && (
            <img
              src={svgDataUrl}
              alt={illustration.title}
              className={`w-full h-full object-contain transition-all duration-300 group-hover:scale-105 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
              draggable={false}
            />
          )}
          <div className="absolute inset-0 bg-bg-primary/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center pointer-events-none">
            <Text variant={TextVariants.small} weight={TextWeights.semibold} className="text-white drop-shadow-md">
              Drag to image
            </Text>
          </div>
        </div>
        <div className="px-3 py-2 text-center border-t border-border-color/30 bg-bg-secondary">
          <Text variant={TextVariants.small} className="font-medium truncate text-xs">
            {illustration.title}
          </Text>
        </div>
      </motion.div>
    </div>
  );
}

export default function IllustrationsPanel() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [accentColor, setAccentColor] = useState('#6c63ff');
  const [customColor, setCustomColor] = useState('#6c63ff');
  const [currentPage, setCurrentPage] = useState(1);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const itemsPerPage = 12;

  const filteredIllustrations = useMemo(() => {
    if (!searchTerm.trim()) return CURATED_ILLUSTRATIONS;
    const lower = searchTerm.toLowerCase();
    return CURATED_ILLUSTRATIONS.filter((ill) =>
      ill.title.toLowerCase().includes(lower)
    );
  }, [searchTerm]);

  const totalPages = Math.ceil(filteredIllustrations.length / itemsPerPage);
  const pagedIllustrations = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredIllustrations.slice(start, start + itemsPerPage);
  }, [filteredIllustrations, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleColorChange = (hex: string) => {
    setAccentColor(hex);
    setCustomColor(hex);
    setIsColorPickerOpen(false);
  };

  return (
    <div className="flex flex-col h-full bg-bg-secondary">
      <div className="p-4 flex justify-between items-center shrink-0 border-b border-surface">
        <Text variant={TextVariants.title}>Illustrations</Text>
        <a
          href={BASE_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-tertiary hover:text-accent transition-colors"
          title="Open unDraw.co"
        >
          <ExternalLink size={16} />
        </a>
      </div>

      <div className="shrink-0 p-4 border-b border-surface flex flex-col gap-3 bg-bg-primary/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search illustrations..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-surface border border-border-color rounded-lg focus:outline-none focus:border-accent text-text-primary placeholder-text-secondary transition-colors"
          />
        </div>

        <div className="flex items-center justify-between">
          <Text variant={TextVariants.small} color={TextColors.secondary}>Color</Text>
          <div className="flex items-center gap-1.5 relative">
            {PRESET_COLORS.map((color) => (
              <button
                key={color.hex}
                className={`w-4 h-4 rounded-full border transition-all duration-150 ${accentColor === color.hex ? 'border-white scale-110 shadow-sm' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
                onClick={() => handleColorChange(color.hex)}
              />
            ))}
            <div className="relative ml-1">
              <button
                className={`w-5 h-5 rounded-full border transition-all ${isColorPickerOpen ? 'border-accent' : 'border-border-color'} overflow-hidden`}
                title="Custom color"
                onClick={() => setIsColorPickerOpen((v) => !v)}
                style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}
              />
              {isColorPickerOpen && (
                <div className="absolute top-7 right-0 z-20 bg-bg-secondary border border-border-color rounded-lg p-2 shadow-xl flex items-center gap-2">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      setAccentColor(e.target.value);
                    }}
                    className="w-8 h-8 cursor-pointer rounded overflow-hidden"
                  />
                  <Text variant={TextVariants.small} className="font-mono text-[10px]">{customColor}</Text>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className="grow overflow-y-auto custom-scrollbar p-4"
        onClick={() => setIsColorPickerOpen(false)}
      >
        {pagedIllustrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-text-secondary">
            <Search size={32} className="opacity-50" />
            <Text variant={TextVariants.small} color={TextColors.secondary}>No illustrations found</Text>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${searchTerm}-${currentPage}`}
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {pagedIllustrations.map((ill) => (
                <IllustrationCard
                  key={ill._id}
                  illustration={ill}
                  accentColor={accentColor}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {totalPages > 1 && (
        <div className="shrink-0 p-3 border-t border-surface flex items-center justify-between bg-bg-primary/30">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="h-7 w-7 p-0"
          >
            <ChevronLeft size={16} />
          </Button>
          <Text variant={TextVariants.small} color={TextColors.secondary} className="text-[10px]">
            {currentPage} / {totalPages}
          </Text>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="h-7 w-7 p-0"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}
