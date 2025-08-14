import React from 'react';
import { Platform } from 'react-native';

// Web-compatible icons from react-icons
import {
  IoHome,
  IoPerson,
  IoSettings,
  IoHeart,
  IoSearch,
  IoWallet,
  IoPeople,
  IoNotifications,
  IoAdd,
  IoChevronBack,
  IoChevronForward,
  IoClose,
  IoCheckmark,
  IoWarning,
  IoInformationCircle,
  IoRefresh,
  IoDownload,
  IoShare,
  IoCamera,
  IoImage,
  IoDocument,
  IoCalendar,
  IoTime,
  IoLocation,
  IoMail,
  IoCall,
  IoLockClosed,
  IoEye,
  IoEyeOff,
  IoMenu,
  IoEllipsisVertical,
  IoTrash,
  IoCreate,
  IoCopy,
  IoLogOut,
  IoAnalytics,
  IoTrendingUp,
  IoCard,
  IoCash,
  IoReceiptOutline,
  IoStatsChart,
  IoFilter,
  IoSwapHorizontal,
  IoSend,
  IoArrowUp,
  IoArrowDown,
  IoPlay,
  IoPause,
  IoStop,
  IoVolumeHigh,
  IoVolumeOff,
  IoBrush,
  IoColorPalette,
  IoGift,
  IoHappy,
  IoSad,
  IoThumbsUp,
  IoThumbsDown,
  IoStar,
  IoStarOutline,
  IoBookmark,
  IoBookmarkOutline,
  IoFlag,
  IoShield,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoAlertCircle,
  IoHelpCircle,
  IoQrCode,
  IoFingerPrint,
  IoGlobe,
  IoWifi,
  IoCloudUpload,
  IoCloudDownload,
  IoSync,
  IoApps,
  IoGridOutline,
  IoListOutline,
  IoReorderThree,
  IoReorderFour,
  IoExpand,
  IoContract,
  IoResize,
  IoMove,
  IoLayersOutline,
  IoConstruct,
  IoHammer,
  IoCog,
  IoExtensionPuzzle,
  IoRocket,
  IoFlash,
  IoLeaf,
  IoSunny,
  IoMoon,
  IoPartlySunny,
  IoRainy,
  IoThunderstorm,
  IoUmbrella,
  IoSpeedometer,
  IoBatteryFull,
  IoBatteryHalf,
  IoBatteryDead,
  IoPhonePortrait,
  IoPhoneLandscape,
  IoTabletPortrait,
  IoTabletLandscape,
  IoDesktop,
  IoTv,
  IoWatch,
  IoHeadset,
  IoGameController,
  IoMusicalNotes,
  IoMicOutline,
  IoVolumeHighOutline,
  IoRadio,
  IoVideocam,
  IoVideocamOff,
  IoChatbubble,
  IoChatbubbles,
  IoNewspaper,
  IoLibrary,
  IoSchool,
  IoMedical,
  IoFitness,
  IoNutrition,
  IoRestaurant,
  IoCafe,
  IoWine,
  IoBeer,
  IoPizza,
  IoIceCream,
  IoCar,
  IoBicycle,
  IoWalk,
  IoAirplane,
  IoTrain,
  IoBus,
  IoBoat,
  IoMap,
  IoCompass,
  IoNavigate,
  IoFlag as IoFlagFilled,
  IoPin,
  IoNavigateCircle,
  IoSpeedometerOutline,
  IoBusinessOutline,
  IoStorefront,
  IoBasket,
  IoCart,
  IoCard as IoCardOutline,
  IoPricetag,
  IoPricetags,
  IoTicket,
  IoBarcode,
  IoCalculator,
  IoReceipt,
  IoArchive,
  IoFolderOpen,
  IoFolder,
  IoDocuments,
  IoClipboard,
  IoContract as IoContractOutline,
  IoNewspaperOutline,
  IoJournal,
  IoBookOutline,
  IoLibraryOutline,
  IoAlbums,
  IoDisc,
  IoPlayCircle,
  IoPauseCircle,
  IoStopCircle,
  IoPlaySkipBack,
  IoPlaySkipForward,
  IoPlayBack,
  IoPlayForward,
  IoRepeat,
  IoShuffle,
  IoVolumeOff as IoVolumeMute,
  IoVolumeHigh as IoVolumeMax,
  IoRadioButtonOn,
  IoRadioButtonOff,
  IoCheckbox,
  IoCheckboxOutline,
  IoSquare,
  IoSquareOutline,
  IoTriangle,
  IoTriangleOutline,
  IoEllipse,
  IoEllipseOutline,
  IoRibbon,
  IoMedal,
  IoTrophy,
  IoDiamond,
  IoFlower,
  IoHeart as IoHeartFilled,
  IoHeartOutline,
  IoHeartHalf,
  IoStar as IoStarFilled,
  IoStarHalf,
  IoThumbsUpOutline,
  IoThumbsDownOutline,
  IoHappyOutline,
  IoSadOutline,
  IoEyeOutline,
  IoEyeOffOutline,
  IoFingerPrintOutline,
  IoShieldOutline,
  IoLockClosedOutline,
  IoLockOpenOutline,
  IoKeyOutline
} from 'react-icons/io5';

// React Native icons (will be used on mobile)
let Ionicons: any;
if (Platform.OS !== 'web') {
  Ionicons = require('@expo/vector-icons').Ionicons;
}

// Icon mapping for consistent naming
export const IconMap = {
  // Navigation & UI
  home: Platform.OS === 'web' ? IoHome : 'home',
  person: Platform.OS === 'web' ? IoPerson : 'person',
  settings: Platform.OS === 'web' ? IoSettings : 'settings',
  search: Platform.OS === 'web' ? IoSearch : 'search',
  menu: Platform.OS === 'web' ? IoMenu : 'menu',
  close: Platform.OS === 'web' ? IoClose : 'close',
  back: Platform.OS === 'web' ? IoChevronBack : 'chevron-back',
  forward: Platform.OS === 'web' ? IoChevronForward : 'chevron-forward',
  add: Platform.OS === 'web' ? IoAdd : 'add',
  remove: Platform.OS === 'web' ? IoClose : 'remove',
  checkmark: Platform.OS === 'web' ? IoCheckmark : 'checkmark',
  
  // Money & Finance
  wallet: Platform.OS === 'web' ? IoWallet : 'wallet',
  card: Platform.OS === 'web' ? IoCard : 'card',
  cash: Platform.OS === 'web' ? IoCash : 'cash',
  receipt: Platform.OS === 'web' ? IoReceiptOutline : 'receipt-outline',
  analytics: Platform.OS === 'web' ? IoAnalytics : 'analytics',
  trending: Platform.OS === 'web' ? IoTrendingUp : 'trending-up',
  stats: Platform.OS === 'web' ? IoStatsChart : 'stats-chart',
  calculator: Platform.OS === 'web' ? IoCalculator : 'calculator',
  
  // Social & Communication
  people: Platform.OS === 'web' ? IoPeople : 'people',
  heart: Platform.OS === 'web' ? IoHeart : 'heart',
  notifications: Platform.OS === 'web' ? IoNotifications : 'notifications',
  mail: Platform.OS === 'web' ? IoMail : 'mail',
  call: Platform.OS === 'web' ? IoCall : 'call',
  share: Platform.OS === 'web' ? IoShare : 'share',
  send: Platform.OS === 'web' ? IoSend : 'send',
  
  // Actions
  refresh: Platform.OS === 'web' ? IoRefresh : 'refresh',
  download: Platform.OS === 'web' ? IoDownload : 'download',
  camera: Platform.OS === 'web' ? IoCamera : 'camera',
  image: Platform.OS === 'web' ? IoImage : 'image',
  document: Platform.OS === 'web' ? IoDocument : 'document',
  copy: Platform.OS === 'web' ? IoCopy : 'copy',
  trash: Platform.OS === 'web' ? IoTrash : 'trash',
  edit: Platform.OS === 'web' ? IoCreate : 'create',
  
  // Status & Feedback
  warning: Platform.OS === 'web' ? IoWarning : 'warning',
  information: Platform.OS === 'web' ? IoInformationCircle : 'information-circle',
  success: Platform.OS === 'web' ? IoCheckmarkCircle : 'checkmark-circle',
  error: Platform.OS === 'web' ? IoCloseCircle : 'close-circle',
  alert: Platform.OS === 'web' ? IoAlertCircle : 'alert-circle',
  help: Platform.OS === 'web' ? IoHelpCircle : 'help-circle',
  
  // Utility
  calendar: Platform.OS === 'web' ? IoCalendar : 'calendar',
  time: Platform.OS === 'web' ? IoTime : 'time',
  location: Platform.OS === 'web' ? IoLocation : 'location',
  qrCode: Platform.OS === 'web' ? IoQrCode : 'qr-code',
  filter: Platform.OS === 'web' ? IoFilter : 'filter',
  sync: Platform.OS === 'web' ? IoSync : 'sync',
  
  // Security
  lock: Platform.OS === 'web' ? IoLockClosed : 'lock-closed',
  eye: Platform.OS === 'web' ? IoEye : 'eye',
  eyeOff: Platform.OS === 'web' ? IoEyeOff : 'eye-off',
  fingerprint: Platform.OS === 'web' ? IoFingerPrint : 'finger-print',
  shield: Platform.OS === 'web' ? IoShield : 'shield',
  
  // Navigation arrows
  arrowUp: Platform.OS === 'web' ? IoArrowUp : 'arrow-up',
  arrowDown: Platform.OS === 'web' ? IoArrowDown : 'arrow-down',
  
  // Media
  play: Platform.OS === 'web' ? IoPlay : 'play',
  pause: Platform.OS === 'web' ? IoPause : 'pause',
  stop: Platform.OS === 'web' ? IoStop : 'stop',
  
  // Misc
  star: Platform.OS === 'web' ? IoStar : 'star',
  starOutline: Platform.OS === 'web' ? IoStarOutline : 'star-outline',
  bookmark: Platform.OS === 'web' ? IoBookmark : 'bookmark',
  gift: Platform.OS === 'web' ? IoGift : 'gift',
  logout: Platform.OS === 'web' ? IoLogOut : 'log-out'
};

// Universal Icon Component
interface IconProps {
  name: keyof typeof IconMap;
  size?: number;
  color?: string;
  style?: any;
}

export const Icon: React.FC<IconProps> = ({ name, size = 24, color = '#000', style, ...props }) => {
  if (Platform.OS === 'web') {
    // Use react-icons on web - render the component directly
    switch (name) {
      case 'home': return <IoHome size={size} color={color} style={style} {...props} />;
      case 'person': return <IoPerson size={size} color={color} style={style} {...props} />;
      case 'settings': return <IoSettings size={size} color={color} style={style} {...props} />;
      case 'heart': return <IoHeart size={size} color={color} style={style} {...props} />;
      case 'search': return <IoSearch size={size} color={color} style={style} {...props} />;
      case 'wallet': return <IoWallet size={size} color={color} style={style} {...props} />;
      case 'people': return <IoPeople size={size} color={color} style={style} {...props} />;
      case 'notifications': return <IoNotifications size={size} color={color} style={style} {...props} />;
      case 'add': return <IoAdd size={size} color={color} style={style} {...props} />;
      case 'back': return <IoChevronBack size={size} color={color} style={style} {...props} />;
      case 'forward': return <IoChevronForward size={size} color={color} style={style} {...props} />;
      case 'close': return <IoClose size={size} color={color} style={style} {...props} />;
      case 'checkmark': return <IoCheckmark size={size} color={color} style={style} {...props} />;
      case 'warning': return <IoWarning size={size} color={color} style={style} {...props} />;
      case 'information': return <IoInformationCircle size={size} color={color} style={style} {...props} />;
      case 'refresh': return <IoRefresh size={size} color={color} style={style} {...props} />;
      case 'download': return <IoDownload size={size} color={color} style={style} {...props} />;
      case 'share': return <IoShare size={size} color={color} style={style} {...props} />;
      case 'camera': return <IoCamera size={size} color={color} style={style} {...props} />;
      case 'image': return <IoImage size={size} color={color} style={style} {...props} />;
      case 'document': return <IoDocument size={size} color={color} style={style} {...props} />;
      case 'calendar': return <IoCalendar size={size} color={color} style={style} {...props} />;
      case 'time': return <IoTime size={size} color={color} style={style} {...props} />;
      case 'location': return <IoLocation size={size} color={color} style={style} {...props} />;
      case 'mail': return <IoMail size={size} color={color} style={style} {...props} />;
      case 'call': return <IoCall size={size} color={color} style={style} {...props} />;
      case 'lock': return <IoLockClosed size={size} color={color} style={style} {...props} />;
      case 'eye': return <IoEye size={size} color={color} style={style} {...props} />;
      case 'eyeOff': return <IoEyeOff size={size} color={color} style={style} {...props} />;
      case 'menu': return <IoMenu size={size} color={color} style={style} {...props} />;
      case 'trash': return <IoTrash size={size} color={color} style={style} {...props} />;
      case 'edit': return <IoCreate size={size} color={color} style={style} {...props} />;
      case 'copy': return <IoCopy size={size} color={color} style={style} {...props} />;
      case 'logout': return <IoLogOut size={size} color={color} style={style} {...props} />;
      case 'analytics': return <IoAnalytics size={size} color={color} style={style} {...props} />;
      case 'trending': return <IoTrendingUp size={size} color={color} style={style} {...props} />;
      case 'card': return <IoCard size={size} color={color} style={style} {...props} />;
      case 'cash': return <IoCash size={size} color={color} style={style} {...props} />;
      case 'receipt': return <IoReceiptOutline size={size} color={color} style={style} {...props} />;
      case 'stats': return <IoStatsChart size={size} color={color} style={style} {...props} />;
      case 'filter': return <IoFilter size={size} color={color} style={style} {...props} />;
      case 'send': return <IoSend size={size} color={color} style={style} {...props} />;
      case 'arrowUp': return <IoArrowUp size={size} color={color} style={style} {...props} />;
      case 'arrowDown': return <IoArrowDown size={size} color={color} style={style} {...props} />;
      case 'play': return <IoPlay size={size} color={color} style={style} {...props} />;
      case 'pause': return <IoPause size={size} color={color} style={style} {...props} />;
      case 'stop': return <IoStop size={size} color={color} style={style} {...props} />;
      case 'star': return <IoStar size={size} color={color} style={style} {...props} />;
      case 'starOutline': return <IoStarOutline size={size} color={color} style={style} {...props} />;
      case 'bookmark': return <IoBookmark size={size} color={color} style={style} {...props} />;
      case 'gift': return <IoGift size={size} color={color} style={style} {...props} />;
      case 'success': return <IoCheckmarkCircle size={size} color={color} style={style} {...props} />;
      case 'error': return <IoCloseCircle size={size} color={color} style={style} {...props} />;
      case 'alert': return <IoAlertCircle size={size} color={color} style={style} {...props} />;
      case 'help': return <IoHelpCircle size={size} color={color} style={style} {...props} />;
      case 'qrCode': return <IoQrCode size={size} color={color} style={style} {...props} />;
      case 'fingerprint': return <IoFingerPrint size={size} color={color} style={style} {...props} />;
      case 'shield': return <IoShield size={size} color={color} style={style} {...props} />;
      case 'sync': return <IoSync size={size} color={color} style={style} {...props} />;
      case 'calculator': return <IoCalculator size={size} color={color} style={style} {...props} />;
      case 'remove': return <IoClose size={size} color={color} style={style} {...props} />;
      default: 
        console.warn(`Icon '${name}' not found for web platform`);
        return <IoHelpCircle size={size} color={color} style={style} {...props} />;
    }
  } else {
    // Use Ionicons on mobile - use the mapping
    const iconName = IconMap[name] as string;
    return (
      <Ionicons 
        name={iconName} 
        size={size} 
        color={color} 
        style={style}
        {...props} 
      />
    );
  }
};

// Export individual icons for direct use if needed
export {
  // Web icons (react-icons)
  IoHome,
  IoPerson,
  IoSettings,
  IoHeart,
  IoSearch,
  IoWallet,
  IoPeople,
  IoNotifications,
  IoAdd,
  IoChevronBack,
  IoChevronForward,
  IoClose,
  IoCheckmark,
  IoWarning,
  IoInformationCircle,
  IoRefresh,
  IoDownload,
  IoShare,
  IoCamera,
  IoImage,
  IoDocument,
  IoCalendar,
  IoTime,
  IoLocation,
  IoMail,
  IoCall,
  IoLockClosed,
  IoEye,
  IoEyeOff,
  IoMenu,
  IoEllipsisVertical,
  IoTrash,
  IoCreate,
  IoCopy,
  IoLogOut,
  IoAnalytics,
  IoTrendingUp,
  IoCard,
  IoCash,
  IoReceiptOutline,
  IoStatsChart,
  IoFilter,
  IoSwapHorizontal,
  IoSend,
  IoArrowUp,
  IoArrowDown,
  IoPlay,
  IoPause,
  IoStop,
  IoVolumeHigh,
  IoVolumeOff,
  IoBrush,
  IoColorPalette,
  IoGift,
  IoHappy,
  IoSad,
  IoThumbsUp,
  IoThumbsDown,
  IoStar,
  IoStarOutline,
  IoBookmark,
  IoBookmarkOutline,
  IoFlag,
  IoShield,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoAlertCircle,
  IoHelpCircle,
  IoQrCode,
  IoFingerPrint,
  IoGlobe,
  IoWifi,
  IoCloudUpload,
  IoCloudDownload,
  IoSync
};

// Backward compatibility - export Ionicons for existing code
export { Ionicons };

export default Icon;
