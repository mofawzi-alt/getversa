import type { AppLanguage } from '@/lib/pollText';
import arHome from '@/lib/i18n/ar.home';
import arProfile from '@/lib/i18n/ar.profile';
import arAuth from '@/lib/i18n/ar.auth';
import arSocial from '@/lib/i18n/ar.social';
import arDiscover from '@/lib/i18n/ar.discover';
import arPlay from '@/lib/i18n/ar.play';
import arTaste from '@/lib/i18n/ar.taste';

/**
 * Lightweight UI translation layer.
 *
 * Keys are the English source strings, so any un-translated string simply
 * renders in English. Add Arabic entries to `AR` below.
 *
 * Usage:
 *   const { t } = useT();
 *   <span>{t('Continue')}</span>
 *   <span>{t('{n} votes', { n: 12 })}</span>
 */

const BASE_AR: Record<string, string> = {
  // ---- Navigation / tabs ----
  'Home': 'الرئيسية',
  'Categories': 'الأقسام',
  'Live Ask': 'اسأل مباشر',
  'Inbox': 'الرسائل',
  'Profile': 'حسابي',
  'Explore': 'استكشف',
  'Browse': 'تصفح',
  'Shorts': 'شورتس',
  'Search': 'بحث',
  'Back': 'رجوع',
  'Close': 'إغلاق',
  'Done': 'تم',
  'Next': 'التالي',
  'Skip': 'تخطي',
  'Save': 'حفظ',
  'Cancel': 'إلغاء',
  'Delete': 'حذف',
  'Edit': 'تعديل',
  'Share': 'مشاركة',
  'Send': 'إرسال',
  'Continue': 'متابعة',
  'Retry': 'إعادة المحاولة',
  'Loading...': 'جارٍ التحميل...',
  'See all': 'عرض الكل',
  'View all': 'عرض الكل',
  'All': 'الكل',
  'For you': 'مخصص لك',

  // ---- Auth / onboarding ----
  'Sign in': 'تسجيل الدخول',
  'Sign In': 'تسجيل الدخول',
  'Log in': 'تسجيل الدخول',
  'Sign up': 'إنشاء حساب',
  'Sign Up': 'إنشاء حساب',
  'Join': 'انضم',
  'Sign out': 'تسجيل الخروج',
  'Log out': 'تسجيل الخروج',
  'Email': 'البريد الإلكتروني',
  'Password': 'كلمة المرور',
  'Confirm password': 'تأكيد كلمة المرور',
  'Forgot password?': 'نسيت كلمة المرور؟',
  'Reset password': 'إعادة تعيين كلمة المرور',
  'Continue with Google': 'المتابعة باستخدام جوجل',
  'Continue with Apple': 'المتابعة باستخدام أبل',
  'Username': 'اسم المستخدم',
  'Full name': 'الاسم الكامل',
  'Name': 'الاسم',
  'Age': 'العمر',
  'Gender': 'الجنس',
  'Male': 'ذكر',
  'Female': 'أنثى',
  'City': 'المدينة',
  'Continue as guest': 'المتابعة كزائر',
  'Welcome back': 'أهلاً بعودتك',
  'Create your account': 'أنشئ حسابك',

  // ---- Voting / polls ----
  'Vote': 'صوّت',
  'Voted': 'تم التصويت',
  'You voted': 'لقد صوّت',
  'votes': 'صوت',
  'vote': 'صوت',
  'Votes': 'الأصوات',
  'Results': 'النتائج',
  'Winner': 'الفائز',
  'You chose': 'اخترت',
  'Swipe to vote': 'اسحب للتصويت',
  'Swipe up to skip': 'اسحب لأعلى للتخطي',
  'Tap to see results': 'اضغط لرؤية النتائج',
  'Live': 'مباشر',
  'Trending': 'الأكثر تداولاً',
  'Top now': 'الأكثر الآن',
  'New': 'جديد',
  'Closing soon': 'ينتهي قريباً',
  'Weekly': 'الأسبوعي',
  'Weekly top voted': 'الأكثر تصويتاً هذا الأسبوع',
  'Morning recap': 'ملخص الصباح',
  'Egypt today': 'مصر اليوم',
  'Friends': 'الأصدقاء',
  'Predictions': 'التوقعات',
  'Breakdown': 'التحليل',
  'New this week': 'جديد هذا الأسبوع',
  'Cairo now': 'القاهرة الآن',
  'Updates': 'التحديثات',
  'No polls right now': 'لا توجد تصويتات حالياً',
  'Come back later': 'عد لاحقاً',
  "You're all caught up": 'لقد أنهيت كل التصويتات',
  'Next drop in': 'التصويتات الجديدة بعد',

  // ---- Profile ----
  'Language': 'اللغة',
  'English': 'English',
  'Arabic': 'العربية',
  'Settings': 'الإعدادات',
  'Edit profile': 'تعديل الملف الشخصي',
  'Notifications': 'الإشعارات',
  'Privacy': 'الخصوصية',
  'Privacy Policy': 'سياسة الخصوصية',
  'Terms': 'الشروط',
  'Support': 'الدعم',
  'Rewards': 'المكافآت',
  'Badges': 'الشارات',
  'Leaderboard': 'المتصدرون',
  'My votes': 'تصويتاتي',
  'Vote history': 'سجل التصويت',
  'History': 'السجل',
  'Followers': 'المتابعون',
  'Following': 'أتابع',
  'Follow': 'متابعة',
  'Unfollow': 'إلغاء المتابعة',
  'Streak': 'التتابع',
  'Points': 'النقاط',
  'Your week': 'أسبوعك',
  'Taste profile': 'ذوقك',
  'Personality type': 'نوع الشخصية',
  'Voting insights': 'رؤى التصويت',
  'Your dimensions': 'أبعادك',
  'Compare': 'قارن',

  // ---- Messages ----
  'Messages': 'الرسائل',
  'New message': 'رسالة جديدة',
  'Type a message': 'اكتب رسالة',
  'No messages yet': 'لا توجد رسائل بعد',
  'Share a poll': 'شارك تصويتاً',

  // ---- Ask ----
  'Ask Versa': 'اسأل فيرسا',
  'Ask a question': 'اسأل سؤالاً',
  'Ask': 'اسأل',
  'Your question': 'سؤالك',
  'Option A': 'الخيار أ',
  'Option B': 'الخيار ب',
  'Post': 'نشر',

  // ---- Categories (labels) ----
  'Relationships': 'العلاقات',
  'Money': 'المال',
  'Education': 'التعليم',
  'Digital Life': 'الحياة الرقمية',
  'Food': 'الأكل',
  'Entertainment': 'الترفيه',
  'Lifestyle': 'نمط الحياة',
  'Egypt': 'مصر',

  // ---- Misc ----
  'Something went wrong': 'حدث خطأ ما',
  'Try again': 'حاول مرة أخرى',
  'Copied': 'تم النسخ',
  'Copy link': 'نسخ الرابط',
  'Today': 'اليوم',
  'Yesterday': 'أمس',
  'This week': 'هذا الأسبوع',
  'people': 'شخص',
  'Gen Z': 'الجيل زد',
  '25+': '+25',
};

export const AR: Record<string, string> = {
  ...arHome,
  ...arProfile,
  ...arAuth,
  ...arSocial,
  ...arDiscover,
  ...arPlay,
  ...arTaste,
  ...BASE_AR,
};

export function translate(
  key: string,
  lang: AppLanguage,
  vars?: Record<string, string | number>,
): string {
  let out = lang === 'ar' ? (AR[key] ?? key) : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return out;
}
