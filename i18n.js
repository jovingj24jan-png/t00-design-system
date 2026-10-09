/* Central translations: NexoraI18n.t(key, vars), .locale(), .setLocale(code), .languages.
   Every string on the sign-in page lives here; pages never branch on language themselves.
   The chosen language is kept in localStorage ('nexora-locale') — it is a preference, not personal data. */
(() => {
  'use strict';

  const KEY = 'nexora-locale';

  // `flag` names a flag drawing in signin.js; the language name is always shown next to it.
  const languages = [
    { code: 'en', name: 'English', dir: 'ltr', flag: 'gb' },
    { code: 'ta', name: 'தமிழ்', dir: 'ltr', flag: 'in' },
    { code: 'ar', name: 'العربية', dir: 'rtl', flag: 'ae' }
  ];

  const translations = {
    en: {
      pageTitle: 'Sign in',
      taglineStart: 'Every child, every day, ',
      taglineAccent: 'in one place.',
      welcomeBack: 'Welcome back',
      signInTo: 'Sign in to {school}',
      emailOrPhone: 'Email or phone',
      emailOrPhonePlaceholder: 'name@school.org or phone number',
      password: 'Password',
      passwordPlaceholder: 'Enter your password',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      rememberMe: 'Remember me',
      forgotPassword: 'Forgot password?',
      signIn: 'Sign in',
      signingIn: 'Signing in…',
      or: 'or',
      signInWithSso: 'Sign in with SSO',
      incorrectCredentials: 'Email or password is incorrect',
      tooManyAttempts: 'Too many attempts. Try again in 15 minutes.',
      tryAgainIn: 'Time left: {time}',
      lockoutOver: 'You can try signing in again.',
      schoolPaused: 'This school account is paused. Contact your administrator.',
      ssoNotConnected: 'Single sign-on isn’t connected for this school yet. Contact your administrator.',
      requiredIdentifier: 'Enter your email or phone number.',
      requiredPassword: 'Enter your password.',
      signInFailed: 'We couldn’t sign you in right now. Please try again.',
      language: 'Language',
      privacy: 'Privacy',
      help: 'Help',
      demoTitle: 'Demo accounts (prototype)',
      demoNote: 'Prototype sign-in: checked in this browser only, not by a server.',
      placeholderLabel: 'Placeholder page',
      backToSignIn: 'Back to sign in',
      forgotTitle: 'Reset your password',
      forgotText: 'Password recovery isn’t available in this prototype yet. Ask your school administrator to reset your password.',
      privacyTitle: 'Privacy',
      privacyText: 'The privacy notice hasn’t been published in this prototype yet.',
      helpTitle: 'Help',
      helpText: 'Help content isn’t available in this prototype yet. For help signing in, contact your school administrator.',
      firstTitle: 'Welcome, {name}',
      firstText: 'This is your first sign-in. The first-time setup steps (S03) haven’t been designed yet, so this page is a placeholder.',
      firstContinue: 'Continue to dashboard',
      skipToForm: 'Skip to sign-in form',
      supportLinks: 'Support'
    },
    ta: {
      pageTitle: 'உள்நுழைவு',
      taglineStart: 'ஒவ்வொரு குழந்தையும், ஒவ்வொரு நாளும், ',
      taglineAccent: 'ஒரே இடத்தில்.',
      welcomeBack: 'மீண்டும் வருக',
      signInTo: '{school} கணக்கில் உள்நுழையுங்கள்',
      emailOrPhone: 'மின்னஞ்சல் அல்லது கைப்பேசி எண்',
      emailOrPhonePlaceholder: 'name@school.org / கைப்பேசி',
      password: 'கடவுச்சொல்',
      passwordPlaceholder: 'கடவுச்சொல்லை உள்ளிடுக',
      showPassword: 'கடவுச்சொல்லைக் காட்டு',
      hidePassword: 'கடவுச்சொல்லை மறை',
      rememberMe: 'என்னை நினைவில் வை',
      forgotPassword: 'கடவுச்சொல் மறந்துவிட்டதா?',
      signIn: 'உள்நுழை',
      signingIn: 'உள்நுழைகிறது…',
      or: 'அல்லது',
      signInWithSso: 'SSO மூலம் உள்நுழை',
      incorrectCredentials: 'மின்னஞ்சல் அல்லது கடவுச்சொல் தவறானது',
      tooManyAttempts: 'பல முறை முயற்சித்துவிட்டீர்கள். 15 நிமிடங்களில் மீண்டும் முயற்சிக்கவும்.',
      tryAgainIn: 'மீதமுள்ள நேரம்: {time}',
      lockoutOver: 'இப்போது மீண்டும் உள்நுழைய முயற்சிக்கலாம்.',
      schoolPaused: 'இந்தப் பள்ளிக் கணக்கு இடைநிறுத்தப்பட்டுள்ளது. உங்கள் நிர்வாகியைத் தொடர்புகொள்ளவும்.',
      ssoNotConnected: 'இந்தப் பள்ளிக்கு ஒற்றை உள்நுழைவு (SSO) இன்னும் இணைக்கப்படவில்லை. உங்கள் நிர்வாகியைத் தொடர்புகொள்ளவும்.',
      requiredIdentifier: 'உங்கள் மின்னஞ்சல் அல்லது கைப்பேசி எண்ணை உள்ளிடுங்கள்.',
      requiredPassword: 'உங்கள் கடவுச்சொல்லை உள்ளிடுங்கள்.',
      signInFailed: 'இப்போது உங்களை உள்நுழைய வைக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
      language: 'மொழி',
      privacy: 'தனியுரிமை',
      help: 'உதவி',
      demoTitle: 'மாதிரிக் கணக்குகள் (முன்மாதிரி)',
      demoNote: 'முன்மாதிரி உள்நுழைவு: இந்த உலாவியில் மட்டுமே சரிபார்க்கப்படுகிறது, சேவையகத்தில் அல்ல.',
      placeholderLabel: 'தற்காலிகப் பக்கம்',
      backToSignIn: 'உள்நுழைவுக்குத் திரும்பு',
      forgotTitle: 'உங்கள் கடவுச்சொல்லை மீட்டமைக்கவும்',
      forgotText: 'இந்த முன்மாதிரியில் கடவுச்சொல் மீட்பு இன்னும் கிடைக்கவில்லை. உங்கள் கடவுச்சொல்லை மீட்டமைக்க பள்ளி நிர்வாகியைக் கேளுங்கள்.',
      privacyTitle: 'தனியுரிமை',
      privacyText: 'தனியுரிமை அறிவிப்பு இந்த முன்மாதிரியில் இன்னும் வெளியிடப்படவில்லை.',
      helpTitle: 'உதவி',
      helpText: 'உதவிப் பக்கங்கள் இந்த முன்மாதிரியில் இன்னும் இல்லை. உள்நுழைவதில் உதவிக்கு உங்கள் பள்ளி நிர்வாகியைத் தொடர்புகொள்ளவும்.',
      firstTitle: 'வருக, {name}',
      firstText: 'இது உங்கள் முதல் உள்நுழைவு. முதல்முறை அமைப்புப் படிகள் (S03) இன்னும் வடிவமைக்கப்படவில்லை, எனவே இது ஒரு தற்காலிகப் பக்கம்.',
      firstContinue: 'முகப்புப் பலகைக்குத் தொடரவும்',
      skipToForm: 'உள்நுழைவுப் படிவத்துக்குச் செல்',
      supportLinks: 'உதவி இணைப்புகள்'
    },
    ar: {
      pageTitle: 'تسجيل الدخول',
      taglineStart: 'كل طفل، كل يوم، ',
      taglineAccent: 'في مكان واحد.',
      welcomeBack: 'مرحبًا بعودتك',
      signInTo: 'سجّل الدخول إلى {school}',
      emailOrPhone: 'البريد الإلكتروني أو رقم الهاتف',
      emailOrPhonePlaceholder: 'name@school.org أو رقم الهاتف',
      password: 'كلمة المرور',
      passwordPlaceholder: 'أدخل كلمة المرور',
      showPassword: 'إظهار كلمة المرور',
      hidePassword: 'إخفاء كلمة المرور',
      rememberMe: 'تذكّرني',
      forgotPassword: 'هل نسيت كلمة المرور؟',
      signIn: 'تسجيل الدخول',
      signingIn: 'جارٍ تسجيل الدخول…',
      or: 'أو',
      signInWithSso: 'تسجيل الدخول عبر SSO',
      incorrectCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
      tooManyAttempts: 'محاولات كثيرة جدًا. حاول مرة أخرى بعد 15 دقيقة.',
      tryAgainIn: 'الوقت المتبقي: {time}',
      lockoutOver: 'يمكنك محاولة تسجيل الدخول مرة أخرى.',
      schoolPaused: 'حساب هذه المدرسة متوقف مؤقتًا. تواصل مع المسؤول.',
      ssoNotConnected: 'لم يتم ربط تسجيل الدخول الموحّد (SSO) لهذه المدرسة بعد. تواصل مع المسؤول.',
      requiredIdentifier: 'أدخل بريدك الإلكتروني أو رقم هاتفك.',
      requiredPassword: 'أدخل كلمة المرور.',
      signInFailed: 'تعذّر تسجيل دخولك الآن. حاول مرة أخرى.',
      language: 'اللغة',
      privacy: 'الخصوصية',
      help: 'المساعدة',
      demoTitle: 'حسابات تجريبية (نموذج أولي)',
      demoNote: 'تسجيل دخول تجريبي: يتم التحقق منه في هذا المتصفح فقط، وليس على خادم.',
      placeholderLabel: 'صفحة مؤقتة',
      backToSignIn: 'العودة إلى تسجيل الدخول',
      forgotTitle: 'إعادة تعيين كلمة المرور',
      forgotText: 'استعادة كلمة المرور غير متاحة في هذا النموذج الأولي بعد. اطلب من مسؤول مدرستك إعادة تعيين كلمة المرور.',
      privacyTitle: 'الخصوصية',
      privacyText: 'لم يُنشر إشعار الخصوصية في هذا النموذج الأولي بعد.',
      helpTitle: 'المساعدة',
      helpText: 'محتوى المساعدة غير متاح في هذا النموذج الأولي بعد. للمساعدة في تسجيل الدخول، تواصل مع مسؤول مدرستك.',
      firstTitle: 'مرحبًا، {name}',
      firstText: 'هذا أول تسجيل دخول لك. لم يتم تصميم خطوات الإعداد الأولى (S03) بعد، لذا هذه صفحة مؤقتة.',
      firstContinue: 'المتابعة إلى لوحة التحكم',
      skipToForm: 'انتقل إلى نموذج تسجيل الدخول',
      supportLinks: 'روابط الدعم'
    }
  };

  const byCode = code => languages.find(l => l.code === code) || null;

  function locale() {
    let code = null;
    try { code = localStorage.getItem(KEY); } catch { /* storage blocked */ }
    return byCode(code) ? code : 'en';
  }

  function setLocale(code) {
    if (!byCode(code)) return;
    try { localStorage.setItem(KEY, code); } catch { /* preference simply isn't kept */ }
    document.documentElement.lang = code;
    document.documentElement.dir = byCode(code).dir;
  }

  // Falls back to English for a missing key, so a gap shows English rather than a raw key.
  function t(key, vars = {}, code = locale()) {
    const s = translations[code]?.[key] ?? translations.en[key] ?? key;
    return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
  }

  window.NexoraI18n = { languages, translations, locale, setLocale, t, language: byCode };
})();
