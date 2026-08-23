export const SUPPORTED_LOCALES = ["en", "my"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "ai-study-assistant-locale";
export const LOCALE_COOKIE_NAME = "app_locale";

const en = {
  "common.brand": "AI Study Assistant",
  "common.language": "Language",
  "common.english": "English",
  "common.myanmar": "မြန်မာ",
  "common.or": "OR",
  "common.email": "Email",
  "common.password": "Password",
  "common.name": "Name",
  "common.loading": "Loading…",
  "common.showPassword": "Show password",
  "common.hidePassword": "Hide password",

  "auth.hero.title": "Turn confusion into clarity—in one click.",
  "auth.hero.description":
    "Upload your notes and let AI create summaries, flashcards, quizzes, and clear explanations in seconds.",
  "auth.feature.summaries": "Smart summaries",
  "auth.feature.flashcards": "Instant flashcards",
  "auth.feature.quizzes": "Practice quizzes",
  "auth.feature.explanations": "Clear explanations",
  "auth.feature.chat": "AI chat",
  "auth.google.continue": "Continue with Google",
  "auth.google.signup": "Sign up with Google",

  "login.title": "Welcome back",
  "login.subtitle": "Continue your learning journey.",
  "login.remember": "Remember me",
  "login.forgot": "Forgot password?",
  "login.submit": "Log in",
  "login.submitting": "Logging in…",
  "login.noAccount": "Don’t have an account?",
  "login.signup": "Sign up",
  "login.invalidCredentials": "Invalid email or password.",
  "login.oauth.accessDenied": "Google sign-in was cancelled.",
  "login.oauth.accountLinkRequired":
    "This email already uses password sign-in. Log in with your password.",
  "login.oauth.invalidState": "Google sign-in expired. Please try again.",
  "login.oauth.notConfigured": "Google sign-in is not configured yet.",
  "login.oauth.rateLimited":
    "Too many sign-in attempts. Please wait and try again.",
  "login.oauth.failed":
    "Google sign-in could not be completed. Please try again.",

  "register.title": "Create your account",
  "register.subtitle": "Start studying smarter.",
  "register.namePlaceholder": "Your name",
  "register.confirmPassword": "Confirm password",
  "register.passwordHelp":
    "At least 8 characters, with uppercase, lowercase, a number, and a special character.",
  "register.passwordMismatch": "Passwords don’t match",
  "register.failed": "Registration failed",
  "register.submit": "Create account",
  "register.submitting": "Creating account…",
  "register.hasAccount": "Already have an account?",
  "register.login": "Log in",
  "register.checkEmail": "Check your email",
  "register.backToLogin": "Back to log in",

  "forgot.title": "Reset password",
  "forgot.subtitle":
    "Enter your email and we’ll send you a link to reset your password.",
  "forgot.failed": "Something went wrong. Please try again.",
  "forgot.submit": "Send reset link",
  "forgot.submitting": "Sending…",
  "forgot.checkInbox": "Check your inbox",
  "forgot.sent": "We’ve sent a password reset link to {email}.",
  "forgot.backToLogin": "Back to login",

  "reset.missingToken":
    "This reset link is missing its token — check the URL from your email.",
  "reset.passwordMismatch": "Passwords do not match.",
  "reset.failed": "Failed to reset password.",
  "reset.title": "Set a new password",
  "reset.subtitle": "Choose something you haven’t used before.",
  "reset.newPassword": "New password",
  "reset.confirmPassword": "Confirm new password",
  "reset.submit": "Reset password",
  "reset.submitting": "Resetting…",

  "verify.confirming": "We’re confirming your email address.",
  "verify.missingToken": "This verification link is missing its token.",
  "verify.success": "Your email address has been verified.",
  "verify.invalid": "The verification link is invalid or has expired.",
  "verify.title.verifying": "Verifying your email",
  "verify.title.verified": "Email verified",
  "verify.title.failed": "Verification failed",
  "verify.continue": "Continue to login",
  "logout.progress": "Logging out…",

  "nav.dashboard": "Dashboard",
  "nav.notes": "Notes",
  "nav.summary": "Summary",
  "nav.quiz": "Quiz",
  "nav.flashcards": "Flashcards",
  "nav.chat": "Chat",
  "nav.overview": "Overview",
  "nav.users": "Users",
  "nav.content": "Content",
  "nav.aiUsage": "AI Usage",
  "nav.health": "Health",
  "nav.originalText": "Original text",
  "sidebar.closeMenu": "Close menu",
  "sidebar.openMenu": "Open menu",
  "sidebar.expand": "Expand sidebar",
  "sidebar.collapse": "Collapse sidebar",
  "sidebar.logout": "Log out",
  "sidebar.streakTitle": "{days}-day streak",
  "sidebar.streak": "Review 2 more flashcard decks today to keep it going.",
} as const;

export type TranslationKey = keyof typeof en;
export type TranslationValues = Record<string, string | number>;

const my: Record<TranslationKey, string> = {
  "common.brand": "AI Study Assistant",
  "common.language": "ဘာသာစကား",
  "common.english": "English",
  "common.myanmar": "မြန်မာ",
  "common.or": "သို့မဟုတ်",
  "common.email": "အီးမေးလ်",
  "common.password": "စကားဝှက်",
  "common.name": "အမည်",
  "common.loading": "ဖွင့်နေသည်…",
  "common.showPassword": "စကားဝှက်ပြရန်",
  "common.hidePassword": "စကားဝှက်ဖျောက်ရန်",

  "auth.hero.title": "မရှင်းလင်းမှုကို တစ်ချက်နှိပ်ရုံဖြင့် နားလည်မှုအဖြစ် ပြောင်းလဲပါ။",
  "auth.hero.description":
    "သင်ခန်းစာမှတ်စုများကို တင်ပြီး AI ဖြင့် အနှစ်ချုပ်၊ ကတ်များ၊ မေးခွန်းများနှင့် ရှင်းလင်းချက်များကို စက္ကန့်ပိုင်းအတွင်း ဖန်တီးပါ။",
  "auth.feature.summaries": "စမတ်အနှစ်ချုပ်များ",
  "auth.feature.flashcards": "ချက်ချင်း လေ့လာရေးကတ်များ",
  "auth.feature.quizzes": "လေ့ကျင့်ခန်းမေးခွန်းများ",
  "auth.feature.explanations": "ရှင်းလင်းသော အဖြေများ",
  "auth.feature.chat": "AI စကားပြောခန်း",
  "auth.google.continue": "Google ဖြင့် ဆက်လက်ဝင်ရောက်ရန်",
  "auth.google.signup": "Google ဖြင့် စာရင်းသွင်းရန်",

  "login.title": "ပြန်လည်ကြိုဆိုပါသည်",
  "login.subtitle": "သင်၏ လေ့လာရေးခရီးကို ဆက်လက်လုပ်ဆောင်ပါ။",
  "login.remember": "မှတ်ထားရန်",
  "login.forgot": "စကားဝှက်မေ့နေပါသလား။",
  "login.submit": "ဝင်ရောက်ရန်",
  "login.submitting": "ဝင်ရောက်နေသည်…",
  "login.noAccount": "အကောင့်မရှိသေးပါသလား။",
  "login.signup": "စာရင်းသွင်းရန်",
  "login.invalidCredentials": "အီးမေးလ် သို့မဟုတ် စကားဝှက် မမှန်ပါ။",
  "login.oauth.accessDenied": "Google ဝင်ရောက်မှုကို ပယ်ဖျက်ခဲ့သည်။",
  "login.oauth.accountLinkRequired":
    "ဤအီးမေးလ်သည် စကားဝှက်ဖြင့် ဝင်ရောက်ထားပြီးဖြစ်သည်။ စကားဝှက်ဖြင့် ဝင်ပါ။",
  "login.oauth.invalidState": "Google ဝင်ရောက်မှု သက်တမ်းကုန်သွားပါပြီ။ ထပ်မံကြိုးစားပါ။",
  "login.oauth.notConfigured": "Google ဝင်ရောက်မှုကို မသတ်မှတ်ရသေးပါ။",
  "login.oauth.rateLimited": "ဝင်ရောက်ရန် အကြိမ်များလွန်းသည်။ ခဏစောင့်ပြီး ထပ်မံကြိုးစားပါ။",
  "login.oauth.failed": "Google ဖြင့် ဝင်ရောက်မှု မပြီးမြောက်ပါ။ ထပ်မံကြိုးစားပါ။",

  "register.title": "သင့်အကောင့်ကို ဖန်တီးပါ",
  "register.subtitle": "ပိုမိုထိရောက်စွာ စတင်လေ့လာပါ။",
  "register.namePlaceholder": "သင့်အမည်",
  "register.confirmPassword": "စကားဝှက် အတည်ပြုရန်",
  "register.passwordHelp":
    "စာလုံးအနည်းဆုံး ၈ လုံး၊ အကြီးစာလုံး၊ အသေးစာလုံး၊ ဂဏန်းနှင့် အထူးသင်္ကေတတစ်ခု ပါရမည်။",
  "register.passwordMismatch": "စကားဝှက်များ မတူညီပါ",
  "register.failed": "စာရင်းသွင်းမှု မအောင်မြင်ပါ",
  "register.submit": "အကောင့်ဖန်တီးရန်",
  "register.submitting": "အကောင့်ဖန်တီးနေသည်…",
  "register.hasAccount": "အကောင့်ရှိပြီးသားလား။",
  "register.login": "ဝင်ရောက်ရန်",
  "register.checkEmail": "သင့်အီးမေးလ်ကို စစ်ဆေးပါ",
  "register.backToLogin": "ဝင်ရောက်ရန် ပြန်သွားရန်",

  "forgot.title": "စကားဝှက် ပြန်လည်သတ်မှတ်ရန်",
  "forgot.subtitle":
    "သင့်အီးမေးလ်ကို ထည့်ပါ။ စကားဝှက်ပြန်လည်သတ်မှတ်ရန် လင့်ခ်ပို့ပေးပါမည်။",
  "forgot.failed": "အမှားတစ်ခု ဖြစ်ပွားခဲ့သည်။ ထပ်မံကြိုးစားပါ။",
  "forgot.submit": "ပြန်လည်သတ်မှတ်ရန် လင့်ခ်ပို့ရန်",
  "forgot.submitting": "ပို့နေသည်…",
  "forgot.checkInbox": "သင့်အီးမေးလ်ကို စစ်ဆေးပါ",
  "forgot.sent": "စကားဝှက်ပြန်လည်သတ်မှတ်ရန် လင့်ခ်ကို {email} သို့ ပို့ပြီးပါပြီ။",
  "forgot.backToLogin": "ဝင်ရောက်ရန် ပြန်သွားရန်",

  "reset.missingToken": "ပြန်လည်သတ်မှတ်သည့် လင့်ခ်တွင် token မပါပါ။ အီးမေးလ်ရှိ လင့်ခ်ကို စစ်ဆေးပါ။",
  "reset.passwordMismatch": "စကားဝှက်များ မတူညီပါ။",
  "reset.failed": "စကားဝှက် ပြန်လည်သတ်မှတ်၍ မရပါ။",
  "reset.title": "စကားဝှက်အသစ် သတ်မှတ်ပါ",
  "reset.subtitle": "ယခင်က မသုံးဖူးသော စကားဝှက်ကို ရွေးချယ်ပါ။",
  "reset.newPassword": "စကားဝှက်အသစ်",
  "reset.confirmPassword": "စကားဝှက်အသစ် အတည်ပြုရန်",
  "reset.submit": "စကားဝှက် ပြန်လည်သတ်မှတ်ရန်",
  "reset.submitting": "ပြန်လည်သတ်မှတ်နေသည်…",

  "verify.confirming": "သင့်အီးမေးလ်လိပ်စာကို အတည်ပြုနေပါသည်။",
  "verify.missingToken": "ဤအတည်ပြုလင့်ခ်တွင် token မပါပါ။",
  "verify.success": "သင့်အီးမေးလ်လိပ်စာကို အတည်ပြုပြီးပါပြီ။",
  "verify.invalid": "အတည်ပြုလင့်ခ် မမှန်ပါ သို့မဟုတ် သက်တမ်းကုန်သွားပါပြီ။",
  "verify.title.verifying": "အီးမေးလ် အတည်ပြုနေသည်",
  "verify.title.verified": "အီးမေးလ် အတည်ပြုပြီးပါပြီ",
  "verify.title.failed": "အတည်ပြုမှု မအောင်မြင်ပါ",
  "verify.continue": "ဝင်ရောက်ရန် ဆက်သွားရန်",
  "logout.progress": "ထွက်နေသည်…",

  "nav.dashboard": "ပင်မစာမျက်နှာ",
  "nav.notes": "မှတ်စုများ",
  "nav.summary": "အနှစ်ချုပ်",
  "nav.quiz": "မေးခွန်းများ",
  "nav.flashcards": "လေ့လာရေးကတ်များ",
  "nav.chat": "စကားပြောခန်း",
  "nav.overview": "ခြုံငုံကြည့်ရှုရန်",
  "nav.users": "အသုံးပြုသူများ",
  "nav.content": "အကြောင်းအရာ",
  "nav.aiUsage": "AI အသုံးပြုမှု",
  "nav.health": "စနစ်အခြေအနေ",
  "nav.originalText": "မူရင်းစာသား",
  "sidebar.closeMenu": "မီနူးပိတ်ရန်",
  "sidebar.openMenu": "မီနူးဖွင့်ရန်",
  "sidebar.expand": "ဘေးဘားဖြန့်ရန်",
  "sidebar.collapse": "ဘေးဘားချုံ့ရန်",
  "sidebar.logout": "ထွက်ရန်",
  "sidebar.streakTitle": "{days} ရက်ဆက်တိုက်",
  "sidebar.streak": "ယနေ့ လေ့လာရေးကတ် ၂ စုံ ထပ်မံလေ့လာပြီး ဆက်တိုက်မှတ်တမ်းကို ထိန်းပါ။",
};

const dictionaries: Record<Locale, Record<TranslationKey, string>> = {
  en,
  my,
};

export function isLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  values: TranslationValues = {},
): string {
  const template = dictionaries[locale][key] ?? en[key];

  return Object.entries(values).reduce(
    (message, [name, value]) =>
      message.replaceAll(`{${name}}`, String(value)),
    template,
  );
}
