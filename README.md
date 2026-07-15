# ShadowVoice PWA - 3D Spatial Voice Board with Secret Whisper Channels

![ShadowVoice Banner](/icons/icon-512.png)

**ShadowVoice** هو تطبيق ويب تقدمي (Progressive Web App - PWA) احترافي للاتصال الصوتي المباشر ثنائي الأبعاد (2D Voice Board) بنظام الصوت المحيطي ثلاثي الأبعاد (3D Proximity Audio) وقنوات الهمس السرية المشفرة (Secret Whisper Channels).

---

## 🌟 المميزات الرئيسية (Features)

1. **تصميم Cyberpunk Dark Theme متجاوب:**
   - شاشة ترحيب أنيقة ومظلمة لاختيار الاسم ولون الـ Avatar.
   - زر تثبيت التطبيق كـ PWA على الهاتف عند توفره.
   - إطار تفاعلي مضيء متكامل يعرض مستوى الصوت وعلامة التحدث النشط (Active Speaking Indicator).

2. **هندسة الصوت المحيطي (3D Spatial Audio & WebRTC):**
   - اتصال P2P صوتي مباشر فائق السرعة وبأقل زمن تأخير بفضل WebRTC و PeerJS.
   - تقنية Web Audio API (`AudioContext`, `PannerNode`, `Listener`) لحساب المسافة والاتجاهات بين الـ Avatars على اللوحة.
   - معالجة سلسة لتخفيض حجم الصوت تدريجياً وبنعومة لمنع أي تقطيع أو تشويش أو انقطاع مفاجئ عند الابتعاد.

3. **لوحة تحكم تفاعلية (2D Voice Board):**
   - إمكانية تحريك الـ Avatar الخاص بك باللمس أو بالسحب والإفلات (Drag & Drop) على الهاتف والحاسوب.
   - تزامن لحظي لمواقع جميع المتصلين (Real-time synchronization).
   - حلقة مرئية تظهر النطاق الصوتي حول المستخدم.

4. **غرفة الهمس السرية (Secret Whisper Channels):**
   - إمكانية طلب همس سرّي مع أي شخص بالنقر على الـ Avatar الخاص به.
   - نظام إشعارات منبثق للقبول أو الرفض.
   - في حال القبول: يتم عزل الصوتين عن الغرفة العامة وفتح قناة مشفرة وخاصة.
   - يظهر رمزي قفل 🔒 فوق المستخدِمَين على الخريطة للجميع.
   - إمكانية إنهاء الهمس بنقرة زر والعودة للغرفة العامة.

5. **توثيق وخصوصية:**
   - عدم حفظ أي تسجيلات صوتية على أي خادم.
   - عبارة التوثيق الرسمية في تذييل التطبيق: **"تم الانشاء بواسطه Youssef Mahmoud"**.

---

## 📁 بنية المجلدات (Project Directory Structure)

```
ShadowVoice/
├── package.json               # إعدادات الاعتماديات
├── server.js                 # سيرفر Node.js + Express + Socket.IO + PeerJS
├── README.md                  # دليل التشغيل والتطوير
└── public/
    ├── index.html             # واجهة التطبيق الرئيسية والـ DOM
    ├── manifest.json          # إعدادات PWA (Standalone, Icons, Theme)
    ├── sw.js                  # Service Worker للتخزين المؤقت والعمل بدون إنترنت
    ├── css/
    │   └── style.css          # تنسيقات Cyberpunk Glassmorphic الداكنة
    ├── js/
    │   ├── app.js             # الملف الرئيسي لربط الوظائف
    │   ├── ui.js              # إدارة الواجهة والإشعارات و PWA Install
    │   ├── canvas-board.js    # محرك الرسم واللمس والسحب والإفلات وتأثيرات الحركة
    │   ├── spatial-audio.js   # محرك الصوت ثلاثي الأبعاد معالج التقطيع والغمور
    │   └── webrtc-manager.js  # إدارة الاتصالات الصوتية P2P عبر PeerJS
    └── icons/
        ├── icon-192.png       # أيقونة PWA قياس 192x192
        └── icon-512.png       # أيقونة PWA قياس 512x512
```

---

## 🚀 طريقة التشغيل والتركيب (Getting Started)

### 1. المتطلبات الأساسية
- Node.js (الإصدار 18 أو أحدث)
- متصفح يدعم WebRTC و Web Audio API (Chrome, Safari, Firefox, Edge)

### 2. تثبيت الاعتماديات
افتح المجلد في الموجه (Terminal) وقم بتنفيذ:
```bash
npm install
```

### 3. تشغيل السيرفر المحلي
```bash
npm start
```
سيعمل التطبيق مباشرة على العنوان:
`http://localhost:3000`

---

## 🌐 النشر والرفوع المباشر (Deployment)

يمكنك رفع المجلد كاملاً أو ضغطه كملف `ZIP` ورفعه مباشرة على أي منصة استضافة تدعم Node.js مثل:
- **Render.com**
- **Railway.app**
- **Vercel / Heroku / Glitch**

---

### 📝 حقوق الملكية والتوثيق
**تم الانشاء بواسطه Youssef Mahmoud**
