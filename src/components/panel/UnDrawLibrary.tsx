import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  Download,
  Loader2,
  ImageIcon,
  Palette,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import Button from '../ui/Button';
import Text from '../ui/Text';
import { TextColors, TextVariants, TextWeights } from '../../types/typography';

interface UnDrawIllustration {
  _id: string;
  title: string;
  media: string;
  newSlug: string;
}


interface UnDrawLibraryProps {
  onBackToLibrary: () => void;
}

const BASE_CDN_URL = 'https://cdn.undraw.co/illustration/';
const BASE_PAGE_URL = 'https://undraw.co/illustrations';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
    },
  },
  exit: { opacity: 0 },
};

const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, scale: 0.95 },
};

// Curated list of 120+ well-known unDraw illustration slugs
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
  { _id: '38', title: 'Camera Photo', media: BASE_CDN_URL + 'camera-photo_v_di.svg', newSlug: 'camera-photo_v_di' },
  { _id: '39', title: 'City Photo', media: BASE_CDN_URL + 'city-photo_d9sh.svg', newSlug: 'city-photo_d9sh' },
  { _id: '40', title: 'Coffee Break', media: BASE_CDN_URL + 'coffee-break_mlcl.svg', newSlug: 'coffee-break_mlcl' },
  { _id: '41', title: 'Collaborating', media: BASE_CDN_URL + 'collaborating_npua.svg', newSlug: 'collaborating_npua' },
  { _id: '42', title: 'Creative Process', media: BASE_CDN_URL + 'creative-process_wuq9.svg', newSlug: 'creative-process_wuq9' },
  { _id: '43', title: 'Dark Mode', media: BASE_CDN_URL + 'dark-mode_kp05.svg', newSlug: 'dark-mode_kp05' },
  { _id: '44', title: 'Design Process', media: BASE_CDN_URL + 'design-process_fwzh.svg', newSlug: 'design-process_fwzh' },
  { _id: '45', title: 'Edit Photo', media: BASE_CDN_URL + 'edit-photo_vdmb.svg', newSlug: 'edit-photo_vdmb' },
  { _id: '46', title: 'Empty', media: BASE_CDN_URL + 'empty_re_opql.svg', newSlug: 'empty_re_opql' },
  { _id: '47', title: 'Error 404', media: BASE_CDN_URL + 'page-not-found_6dnf.svg', newSlug: 'page-not-found_6dnf' },
  { _id: '48', title: 'File Sync', media: BASE_CDN_URL + 'file-sync_m5gn.svg', newSlug: 'file-sync_m5gn' },
  { _id: '49', title: 'Fitness Tracker', media: BASE_CDN_URL + 'fitness-tracker_hy6w.svg', newSlug: 'fitness-tracker_hy6w' },
  { _id: '50', title: 'Folder Files', media: BASE_CDN_URL + 'folder-files_re_3l21.svg', newSlug: 'folder-files_re_3l21' },
  { _id: '51', title: 'Happy News', media: BASE_CDN_URL + 'happy-news_mge9.svg', newSlug: 'happy-news_mge9' },
  { _id: '52', title: 'Hello', media: BASE_CDN_URL + 'hello_re_3evm.svg', newSlug: 'hello_re_3evm' },
  { _id: '53', title: 'Image Folder', media: BASE_CDN_URL + 'image-folder_re_h9os.svg', newSlug: 'image-folder_re_h9os' },
  { _id: '54', title: 'Landscape Photography', media: BASE_CDN_URL + 'landscape-photographer_c6mc.svg', newSlug: 'landscape-photographer_c6mc' },
  { _id: '55', title: 'Live Photo', media: BASE_CDN_URL + 'live-photo_at_fq.svg', newSlug: 'live-photo_at_fq' },
  { _id: '56', title: 'Mobile Photos', media: BASE_CDN_URL + 'mobile-photos_m4_vh.svg', newSlug: 'mobile-photos_m4_vh' },
  { _id: '57', title: 'Nature On Screen', media: BASE_CDN_URL + 'nature-on-screen_xpj4.svg', newSlug: 'nature-on-screen_xpj4' },
  { _id: '58', title: 'No Data', media: BASE_CDN_URL + 'no-data_re_kwbl.svg', newSlug: 'no-data_re_kwbl' },
  { _id: '59', title: 'Note List', media: BASE_CDN_URL + 'note-list_ck1t.svg', newSlug: 'note-list_ck1t' },
  { _id: '60', title: 'Notifications', media: BASE_CDN_URL + 'notifications_re_0p6o.svg', newSlug: 'notifications_re_0p6o' },
  { _id: '61', title: 'Online Gallery', media: BASE_CDN_URL + 'online-gallery_re_y9z2.svg', newSlug: 'online-gallery_re_y9z2' },
  { _id: '62', title: 'Photo Album', media: BASE_CDN_URL + 'photo-album_re_cl7i.svg', newSlug: 'photo-album_re_cl7i' },
  { _id: '63', title: 'Photo Sharing', media: BASE_CDN_URL + 'photo-sharing_re_8cer.svg', newSlug: 'photo-sharing_re_8cer' },
  { _id: '64', title: 'Photography', media: BASE_CDN_URL + 'photography_re_y82j.svg', newSlug: 'photography_re_y82j' },
  { _id: '65', title: 'Photos', media: BASE_CDN_URL + 'photos_re_5beu.svg', newSlug: 'photos_re_5beu' },
  { _id: '66', title: 'Picture', media: BASE_CDN_URL + 'picture_re_bvol.svg', newSlug: 'picture_re_bvol' },
  { _id: '67', title: 'Profile Data', media: BASE_CDN_URL + 'profile-data_re_g41h.svg', newSlug: 'profile-data_re_g41h' },
  { _id: '68', title: 'Project Completed', media: BASE_CDN_URL + 'project-completed_re_pqqq.svg', newSlug: 'project-completed_re_pqqq' },
  { _id: '69', title: 'Save to Bookmarks', media: BASE_CDN_URL + 'save-to-bookmarks_re_8ejx.svg', newSlug: 'save-to-bookmarks_re_8ejx' },
  { _id: '70', title: 'Science', media: BASE_CDN_URL + 'science_re_mfre.svg', newSlug: 'science_re_mfre' },
  { _id: '71', title: 'Share the Love', media: BASE_CDN_URL + 'share-the-love_re_dzx1.svg', newSlug: 'share-the-love_re_dzx1' },
  { _id: '72', title: 'Social Influence', media: BASE_CDN_URL + 'social-influence_89sn.svg', newSlug: 'social-influence_89sn' },
  { _id: '73', title: 'Social Media', media: BASE_CDN_URL + 'social-media_re_sulg.svg', newSlug: 'social-media_re_sulg' },
  { _id: '74', title: 'Software Engineer', media: BASE_CDN_URL + 'software-engineer_lvl5.svg', newSlug: 'software-engineer_lvl5' },
  { _id: '75', title: 'Success', media: BASE_CDN_URL + 'success_0ide.svg', newSlug: 'success_0ide' },
  { _id: '76', title: 'Sunset', media: BASE_CDN_URL + 'sunset_re_uzjn.svg', newSlug: 'sunset_re_uzjn' },
  { _id: '77', title: 'Team Collaboration', media: BASE_CDN_URL + 'team-collaboration_re_ow29.svg', newSlug: 'team-collaboration_re_ow29' },
  { _id: '78', title: 'To the Stars', media: BASE_CDN_URL + 'to-the-stars_re_gxbg.svg', newSlug: 'to-the-stars_re_gxbg' },
  { _id: '79', title: 'Upload', media: BASE_CDN_URL + 'upload_re_pafy.svg', newSlug: 'upload_re_pafy' },
  { _id: '80', title: 'Video Files', media: BASE_CDN_URL + 'video-files_hu5t.svg', newSlug: 'video-files_hu5t' },
  { _id: '81', title: 'Walk in the City', media: BASE_CDN_URL + 'walk-in-the-city_1ma9.svg', newSlug: 'walk-in-the-city_1ma9' },
  { _id: '82', title: 'Work In Progress', media: BASE_CDN_URL + 'work-in-progress_uhmv.svg', newSlug: 'work-in-progress_uhmv' },
  { _id: '83', title: 'Working From Anywhere', media: BASE_CDN_URL + 'working-from-anywhere_re_ts8h.svg', newSlug: 'working-from-anywhere_re_ts8h' },
  { _id: '84', title: 'World', media: BASE_CDN_URL + 'world_re_768g.svg', newSlug: 'world_re_768g' },
  { _id: '85', title: 'Zip Files', media: BASE_CDN_URL + 'zip-files_re_6bre.svg', newSlug: 'zip-files_re_6bre' },
  { _id: '86', title: 'Accept Request', media: BASE_CDN_URL + 'accept-request_vdsd.svg', newSlug: 'accept-request_vdsd' },
  { _id: '87', title: 'Add Content', media: BASE_CDN_URL + 'add-content_re_vgqa.svg', newSlug: 'add-content_re_vgqa' },
  { _id: '88', title: 'Analytics', media: BASE_CDN_URL + 'analytics_re_dkf8.svg', newSlug: 'analytics_re_dkf8' },
  { _id: '89', title: 'Astronaut', media: BASE_CDN_URL + 'astronaut_re_8c33.svg', newSlug: 'astronaut_re_8c33' },
  { _id: '90', title: 'Back Home', media: BASE_CDN_URL + 'back-home_re_fd0x.svg', newSlug: 'back-home_re_fd0x' },
  { _id: '91', title: 'Celebration', media: BASE_CDN_URL + 'celebration_re_kc9k.svg', newSlug: 'celebration_re_kc9k' },
  { _id: '92', title: 'Cloud Hosting', media: BASE_CDN_URL + 'cloud-hosting_aodd.svg', newSlug: 'cloud-hosting_aodd' },
  { _id: '93', title: 'Community', media: BASE_CDN_URL + 'community_re_cyrm.svg', newSlug: 'community_re_cyrm' },
  { _id: '94', title: 'Dashboard', media: BASE_CDN_URL + 'dashboard_re_3b76.svg', newSlug: 'dashboard_re_3b76' },
  { _id: '95', title: 'Data Report', media: BASE_CDN_URL + 'data-report_re_p4so.svg', newSlug: 'data-report_re_p4so' },
  { _id: '96', title: 'Done Checking', media: BASE_CDN_URL + 'done-checking_re_7vqv.svg', newSlug: 'done-checking_re_7vqv' },
  { _id: '97', title: 'Email Campaign', media: BASE_CDN_URL + 'email-campaign_re_m6cd.svg', newSlug: 'email-campaign_re_m6cd' },
  { _id: '98', title: 'Finance', media: BASE_CDN_URL + 'finance_re_gntt.svg', newSlug: 'finance_re_gntt' },
  { _id: '99', title: 'Games', media: BASE_CDN_URL + 'games_re_j7sp.svg', newSlug: 'games_re_j7sp' },
  { _id: '100', title: 'Gradient', media: BASE_CDN_URL + 'gradient_re_rz0b.svg', newSlug: 'gradient_re_rz0b' },
  { _id: '101', title: 'Healthcare', media: BASE_CDN_URL + 'healthcare_p_re_abql.svg', newSlug: 'healthcare_p_re_abql' },
  { _id: '102', title: 'In Progress', media: BASE_CDN_URL + 'in-progress_ql26.svg', newSlug: 'in-progress_ql26' },
  { _id: '103', title: 'Investment Data', media: BASE_CDN_URL + 'investment-data_re_sh9x.svg', newSlug: 'investment-data_re_sh9x' },
  { _id: '104', title: 'Login', media: BASE_CDN_URL + 'login_re_4vu2.svg', newSlug: 'login_re_4vu2' },
  { _id: '105', title: 'Media Player', media: BASE_CDN_URL + 'media-player_re_qd4t.svg', newSlug: 'media-player_re_qd4t' },
  { _id: '106', title: 'Music', media: BASE_CDN_URL + 'music_re_a2qh.svg', newSlug: 'music_re_a2qh' },
  { _id: '107', title: 'My App', media: BASE_CDN_URL + 'my-app_c9nd.svg', newSlug: 'my-app_c9nd' },
  { _id: '108', title: 'Online Art', media: BASE_CDN_URL + 'online-art_re_cxyz.svg', newSlug: 'online-art_re_cxyz' },
  { _id: '109', title: 'Online Friends', media: BASE_CDN_URL + 'online-friends_x6rb.svg', newSlug: 'online-friends_x6rb' },
  { _id: '110', title: 'Open Source', media: BASE_CDN_URL + 'open-source_-405d.svg', newSlug: 'open-source_-405d' },
  { _id: '111', title: 'Password Re-enter', media: BASE_CDN_URL + 'password-re-enter_yi38.svg', newSlug: 'password-re-enter_yi38' },
  { _id: '112', title: 'Podcast', media: BASE_CDN_URL + 'podcast_re_h80i.svg', newSlug: 'podcast_re_h80i' },
  { _id: '113', title: 'Positive Attitude', media: BASE_CDN_URL + 'positive-attitude_xf9n.svg', newSlug: 'positive-attitude_xf9n' },
  { _id: '114', title: 'Product Photography', media: BASE_CDN_URL + 'product-photography_re_mgab.svg', newSlug: 'product-photography_re_mgab' },
  { _id: '115', title: 'Reading Book', media: BASE_CDN_URL + 'reading-book_re_kqpk.svg', newSlug: 'reading-book_re_kqpk' },
  { _id: '116', title: 'Remote Team', media: BASE_CDN_URL + 'remote-team_re_ck1y.svg', newSlug: 'remote-team_re_ck1y' },
  { _id: '117', title: 'Revenue', media: BASE_CDN_URL + 'revenue_re_2k85.svg', newSlug: 'revenue_re_2k85' },
  { _id: '118', title: 'Segment Analysis', media: BASE_CDN_URL + 'segment-analysis_re_f2gg.svg', newSlug: 'segment-analysis_re_f2gg' },
  { _id: '119', title: 'Server Down', media: BASE_CDN_URL + 'server-down_s4lk.svg', newSlug: 'server-down_s4lk' },
  { _id: '120', title: 'Startup Life', media: BASE_CDN_URL + 'startup-life_re_8ow9.svg', newSlug: 'startup-life_re_8ow9' },
];

const PRESET_COLORS = [
  { name: 'Violet', hex: '#6c63ff' },
  { name: 'Blue', hex: '#4285f4' },
  { name: 'Teal', hex: '#00adb5' },
  { name: 'Green', hex: '#2ecc71' },
  { name: 'Orange', hex: '#f39c12' },
  { name: 'Red', hex: '#e74c3c' },
  { name: 'Pink', hex: '#e91e63' },
  { name: 'Purple', hex: '#9c27b0' },
  { name: 'Cyan', hex: '#00bcd4' },
  { name: 'Lime', hex: '#8bc34a' },
];

function getColorizedSvgUrl(svgUrl: string, color: string): string {
  // unDraw's CDN supports color parameter via query
  const colorHex = color.replace('#', '');
  return `${svgUrl}?color=${colorHex}`;
}

function IllustrationCard({
  illustration,
  accentColor,
  onUse,
}: {
  illustration: UnDrawIllustration;
  accentColor: string;
  onUse: (illustration: UnDrawIllustration) => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const colorizedUrl = getColorizedSvgUrl(illustration.media, accentColor);

  const handleCopyUrl = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(colorizedUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  return (
    <motion.div
      layout
      variants={itemVariants}
      className="bg-surface rounded-xl overflow-hidden group border border-border-color/40 hover:border-accent/40 flex flex-col cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-accent/5"
      onClick={() => onUse(illustration)}
    >
      <div className="relative w-full aspect-[4/3] bg-bg-primary flex items-center justify-center overflow-hidden p-4">
        {!isLoaded && !hasError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-text-secondary" />
          </div>
        )}
        {hasError ? (
          <div className="flex flex-col items-center gap-2 text-text-secondary">
            <ImageIcon size={24} />
            <span className="text-xs">Failed to load</span>
          </div>
        ) : (
          <img
            src={colorizedUrl}
            alt={illustration.title}
            className={`w-full h-full object-contain transition-all duration-300 group-hover:scale-105 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setIsLoaded(true)}
            onError={() => {
              setHasError(true);
              setIsLoaded(true);
            }}
            crossOrigin="anonymous"
          />
        )}

        <div className="absolute inset-0 bg-bg-primary/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="shadow-md text-xs"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              onUse(illustration);
            }}
          >
            <Download size={12} className="mr-1" />
            Use
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="shadow-md bg-surface text-xs"
            onClick={handleCopyUrl}
          >
            {isCopied ? <Check size={12} className="mr-1 text-green-500" /> : <Copy size={12} className="mr-1" />}
            {isCopied ? 'Copied!' : 'URL'}
          </Button>
        </div>
      </div>

      <div className="px-3 py-2.5 text-center">
        <Text variant={TextVariants.small} className="font-medium truncate">
          {illustration.title}
        </Text>
      </div>
    </motion.div>
  );
}

interface UseIllustrationModalProps {
  illustration: UnDrawIllustration | null;
  accentColor: string;
  onClose: () => void;
}

function UseIllustrationModal({ illustration, accentColor, onClose }: UseIllustrationModalProps) {
  const [isCopied, setIsCopied] = useState<string | null>(null);
  if (!illustration) return null;

  const colorizedUrl = getColorizedSvgUrl(illustration.media, accentColor);
  const directUrl = colorizedUrl;

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(key);
      setTimeout(() => setIsCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadSvg = async () => {
    try {
      const response = await fetch(colorizedUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${illustration.newSlug}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      // Fallback: open in new tab
      window.open(colorizedUrl, '_blank');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="bg-bg-secondary rounded-2xl border border-border-color shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-color">
            <div>
              <Text variant={TextVariants.heading} weight={TextWeights.bold}>{illustration.title}</Text>
              <Text variant={TextVariants.small} color={TextColors.secondary}>unDraw Illustration</Text>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X size={18} />
            </Button>
          </div>

          {/* Preview */}
          <div className="bg-bg-primary p-6 flex items-center justify-center" style={{ height: 200 }}>
            <img
              src={colorizedUrl}
              alt={illustration.title}
              className="max-w-full max-h-full object-contain"
              crossOrigin="anonymous"
            />
          </div>

          {/* Actions */}
          <div className="p-5 space-y-3">
            <div className="flex gap-2">
              <Button className="flex-1" onClick={downloadSvg}>
                <Download size={14} className="mr-2" />
                Download SVG
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => window.open(`https://undraw.co/illustrations/${illustration.newSlug}`, '_blank')}
              >
                <ExternalLink size={14} className="mr-2" />
                View on unDraw
              </Button>
            </div>

            <div className="space-y-2">
              <Text variant={TextVariants.small} color={TextColors.secondary} weight={TextWeights.bold} className="uppercase tracking-wider text-xs">
                SVG Direct URL
              </Text>
              <div className="flex items-center gap-2 bg-bg-primary rounded-lg p-2.5 border border-border-color">
                <code className="text-xs flex-1 truncate text-text-secondary font-mono">{directUrl}</code>
                <button
                  className="shrink-0 p-1 rounded hover:bg-surface transition-colors"
                  onClick={() => copyToClipboard(directUrl, 'url')}
                >
                  {isCopied === 'url' ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-text-secondary" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Text variant={TextVariants.small} color={TextColors.secondary} weight={TextWeights.bold} className="uppercase tracking-wider text-xs">
                HTML Embed
              </Text>
              <div className="flex items-center gap-2 bg-bg-primary rounded-lg p-2.5 border border-border-color">
                <code className="text-xs flex-1 truncate text-text-secondary font-mono">{`<img src="${directUrl}" alt="${illustration.title}" />`}</code>
                <button
                  className="shrink-0 p-1 rounded hover:bg-surface transition-colors"
                  onClick={() => copyToClipboard(`<img src="${directUrl}" alt="${illustration.title}" />`, 'html')}
                >
                  {isCopied === 'html' ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-text-secondary" />}
                </button>
              </div>
            </div>

            <Text variant={TextVariants.small} color={TextColors.secondary} className="text-center pt-1">
              Free to use under the{' '}
              <a
                href="https://undraw.co/license"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                unDraw License
              </a>
            </Text>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function UnDrawLibrary({ onBackToLibrary }: UnDrawLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [accentColor, setAccentColor] = useState('#6c63ff');
  const [customColor, setCustomColor] = useState('#6c63ff');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIllustration, setSelectedIllustration] = useState<UnDrawIllustration | null>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const itemsPerPage = 24;

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
  };

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-bg-secondary rounded-lg overflow-hidden">
      {/* Header */}
      <header className="shrink-0 px-5 py-4 border-b border-border-color flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button
            className="hover:bg-surface text-text-primary rounded-full"
            onClick={onBackToLibrary}
            size="icon"
            variant="ghost"
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Text variant={TextVariants.headline} weight={TextWeights.bold}>
                unDraw Illustrations
              </Text>
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium border border-accent/25">
                Free & Open-Source
              </span>
            </div>
            <Text variant={TextVariants.small} color={TextColors.secondary}>
              Browse {CURATED_ILLUSTRATIONS.length}+ curated illustrations · Customize color · Download SVG
            </Text>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={BASE_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-accent transition-colors"
          >
            <ExternalLink size={12} />
            undraw.co
          </a>
        </div>
      </header>

      {/* Toolbar */}
      <div className="shrink-0 px-5 py-3 flex items-center gap-3 flex-wrap border-b border-border-color/50">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search illustrations..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-border-color rounded-lg focus:outline-none focus:border-accent text-text-primary placeholder-text-secondary transition-colors"
          />
        </div>

        {/* Color Customizer */}
        <div className="flex items-center gap-2">
          <Palette size={14} className="text-text-secondary" />
          <Text variant={TextVariants.small} color={TextColors.secondary}>Color:</Text>
          <div className="flex items-center gap-1.5">
            {PRESET_COLORS.map((color) => (
              <button
                key={color.hex}
                className={`w-5 h-5 rounded-full border-2 transition-all duration-150 ${accentColor === color.hex ? 'border-white scale-110 shadow-md' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
                onClick={() => handleColorChange(color.hex)}
              />
            ))}
            <div className="relative ml-1">
              <button
                className={`w-6 h-6 rounded-full border-2 transition-all ${isColorPickerOpen ? 'border-accent' : 'border-border-color'} overflow-hidden`}
                title="Custom color"
                onClick={() => setIsColorPickerOpen((v) => !v)}
                style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}
              />
              {isColorPickerOpen && (
                <div className="absolute top-8 left-0 z-20 bg-bg-secondary border border-border-color rounded-lg p-3 shadow-xl">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      setAccentColor(e.target.value);
                    }}
                    className="w-32 h-8 cursor-pointer rounded"
                  />
                </div>
              )}
            </div>
          </div>
          <div
            className="w-6 h-6 rounded-full border-2 border-border-color ml-1"
            style={{ backgroundColor: accentColor }}
          />
        </div>
      </div>

      {/* Grid */}
      <div
        className="flex-1 overflow-y-auto custom-scrollbar p-5"
        onClick={() => setIsColorPickerOpen(false)}
      >
        {pagedIllustrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-text-secondary">
            <Search size={40} />
            <Text variant={TextVariants.heading} color={TextColors.secondary}>No illustrations found</Text>
            <Text variant={TextVariants.small} color={TextColors.secondary}>Try a different search term</Text>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${searchTerm}-${currentPage}`}
              className="grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
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
                  onUse={setSelectedIllustration}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="shrink-0 px-5 py-3 border-t border-border-color flex items-center justify-between">
          <Text variant={TextVariants.small} color={TextColors.secondary}>
            {filteredIllustrations.length} illustrations · Page {currentPage} of {totalPages}
          </Text>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <button
                    key={page}
                    className={`w-7 h-7 rounded text-xs font-medium transition-colors ${currentPage === page ? 'bg-accent text-button-text' : 'text-text-secondary hover:bg-surface'}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* Attribution footer */}
      <div className="shrink-0 px-5 py-2 border-t border-border-color/30 flex items-center justify-center">
        <Text variant={TextVariants.small} color={TextColors.secondary}>
          Illustrations by{' '}
          <a href="https://undraw.co" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            unDraw
          </a>{' '}
          · Created by Katerina Limpitsouni · Free for any use
        </Text>
      </div>

      {/* Modal */}
      {selectedIllustration && (
        <UseIllustrationModal
          illustration={selectedIllustration}
          accentColor={accentColor}
          onClose={() => setSelectedIllustration(null)}
        />
      )}
    </div>
  );
}
