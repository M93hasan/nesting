import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';

export type Locale='tr'|'en'|'ar'|'fa';
type Entry={tr:string;en:string;ar:string;fa:string};
const E=(tr:string,en:string,ar:string,fa:string):Entry=>({tr,en,ar,fa});

const catalog:Entry[]=[
E('Akıllı DXF yerleştirme ve malzeme optimizasyonu','Smart DXF nesting and material optimization','ترتيب DXF ذكي وتحسين استخدام المواد','چیدمان هوشمند DXF و بهینه‌سازی مصرف مواد'),
E('Yeni proje','New project','مشروع جديد','پروژه جدید'),
E('Proje aç','Open project','فتح مشروع','باز کردن پروژه'),
E('Projeyi yeniden adlandır','Rename project','إعادة تسمية المشروع','تغییر نام پروژه'),
E('Geçmiş','History','السجل','تاریخچه'),
E('Parçalar & ayarlar','Parts & settings','الأجزاء والإعدادات','قطعات و تنظیمات'),
E('Hakkında','About','حول','درباره'),
E('İletişim','Contact','اتصال','تماس'),
E('Parçalar','Parts','الأجزاء','قطعات'),
E('Yardım','Help','مساعدة','راهنما'),
E('Adedi sıfır olan parçaları kaldır','Remove parts with zero quantity','إزالة الأجزاء ذات الكمية صفر','حذف قطعات با تعداد صفر'),
E('Şekil çiz','Draw shape','رسم شكل','رسم شکل'),
E('DXF İçe Aktar','Import DXF','استيراد DXF','ورود DXF'),
E('SVG, DXF veya PLT dosyası içe aktar','Import an SVG, DXF or PLT file','استيراد ملف SVG أو DXF أو PLT','ورود فایل SVG، DXF یا PLT'),
E('Geri al','Undo','تراجع','واگرد'),
E('Yinele','Redo','إعادة','از نو'),
E('Tümünü sil','Delete all','حذف الكل','حذف همه'),
E('Parça özellikleri','Part properties','خصائص الجزء','ویژگی‌های قطعه'),
E('Ad','Name','الاسم','نام'),
E('Tam plaka','Fill sheet','ملء اللوح','پر کردن ورق'),
E('Tam plaka iptal','Cancel fill sheet','إلغاء ملء اللوح','لغو پر کردن ورق'),
E('Projeniz boş','Your project is empty','مشروعك فارغ','پروژه شما خالی است'),
E('Bir şekil çizin, ( DXF ) içe aktarın veya kütüphaneden şekil ekleyin.','Draw a shape, import a DXF, or add a shape from the library.','ارسم شكلاً أو استورد DXF أو أضف شكلاً من المكتبة.','یک شکل رسم کنید، DXF وارد کنید یا از کتابخانه شکل اضافه کنید.'),
E('Çokgeni tamamla','Finish polygon','إنهاء المضلع','تکمیل چندضلعی'),
E('Çokgeni iptal et','Cancel polygon','إلغاء المضلع','لغو چندضلعی'),
E('En iyi geçerli yerleşim','Best valid layout','أفضل ترتيب صالح','بهترین چیدمان معتبر'),
E('Çakışmalar kırmızı','Overlaps are red','التداخلات باللون الأحمر','همپوشانی‌ها قرمز هستند'),
E('Ara yerleşimlerde geçici çakışmalar olabilir.','Temporary overlaps may appear in intermediate layouts.','قد تظهر تداخلات مؤقتة في الترتيبات الوسيطة.','ممکن است در چیدمان‌های میانی همپوشانی موقت دیده شود.'),
E('Malzeme ve Yerleşim','Material & Nesting','المادة والترتيب','مواد و چیدمان'),
E('İzin verilen dönüşler','Allowed rotations','الدورانات المسموحة','چرخش‌های مجاز'),
E('İzin verilen dönüşler zorunludur.','Allowed rotations are required.','الدورانات المسموحة مطلوبة.','انتخاب چرخش مجاز الزامی است.'),
E('Her yöne','Any direction','كل الاتجاهات','همه جهت‌ها'),
E('Malzeme tipi','Material type','نوع المادة','نوع ماده'),
E('Rulo','Roll','لفة','رول'),
E('Plaka','Sheet','لوح','ورق'),
E('Malzeme genişliği','Material width','عرض المادة','عرض ماده'),
E('Geçerli bir malzeme genişliği girin.','Enter a valid material width.','أدخل عرض مادة صالحاً.','عرض معتبر ماده را وارد کنید.'),
E('Plaka uzunluğu','Sheet length','طول اللوح','طول ورق'),
E('Geçerli bir plaka uzunluğu girin.','Enter a valid sheet length.','أدخل طول لوح صالحاً.','طول معتبر ورق را وارد کنید.'),
E('Parça aralığı','Part spacing','المسافة بين الأجزاء','فاصله قطعات'),
E('Başlangıç yönü','Start direction','اتجاه البداية','جهت شروع'),
E('Sağ alt ↘','Bottom right ↘','أسفل اليمين ↘','پایین راست ↘'),
E('Sağ üst ↗','Top right ↗','أعلى اليمين ↗','بالا راست ↗'),
E('Parça aralığı yalnızca parçalar arasında uygulanır; malzeme kenarında ek pay oluşturmaz. Bu kesim kerfi değildir.','Part spacing is applied only between parts; it does not add an edge margin. This is not cutting kerf.','تُطبق المسافة بين الأجزاء فقط ولا تضيف هامشاً عند حافة المادة. هذه ليست سماحية القطع.','فاصله فقط بین قطعات اعمال می‌شود و به لبه ماده حاشیه اضافه نمی‌کند. این مقدار کرِف برش نیست.'),
E('Durdurma koşulu','Stop condition','شرط الإيقاف','شرط توقف'),
E('Otomatik · en fazla 59 sn','Automatic · up to 59 sec','تلقائي · حتى 59 ثانية','خودکار · حداکثر ۵۹ ثانیه'),
E('Yerleştirme seçenekleri','Nesting options','خيارات الترتيب','گزینه‌های چیدمان'),
E('Arama modu','Search mode','وضع البحث','حالت جستجو'),
E('Standart','Standard','قياسي','استاندارد'),
E('Hızlı','Fast','سريع','سریع'),
E('İşlemci iş parçacıkları','CPU threads','خيوط المعالج','رشته‌های پردازنده'),
E('Otomatik','Automatic','تلقائي','خودکار'),
E('Arama ilerlemediğinde otomatik durur. İstediğiniz zaman durdurabilirsiniz.','Stops automatically when the search stops improving. You can stop it at any time.','يتوقف تلقائياً عندما لا يتحسن البحث. يمكنك إيقافه في أي وقت.','وقتی جستجو بهتر نشود خودکار متوقف می‌شود. هر زمان بخواهید می‌توانید آن را متوقف کنید.'),
E('Sıkıştırmaya geç','Skip to compression','الانتقال إلى الضغط','رفتن به فشرده‌سازی'),
E('Keşfi bitir ve en iyi yerleşimi sıkıştır.','End exploration and refine the best layout.','إنهاء الاستكشاف وتحسين أفضل ترتيب.','کاوش را پایان دهید و بهترین چیدمان را فشرده کنید.'),
E('Durdur','Stop','إيقاف','توقف'),
E('Parçaları yerleştir','Nest parts','ترتيب الأجزاء','چیدمان قطعات'),
E('Yeniden yerleştir','Nest again','إعادة الترتيب','چیدمان دوباره'),
E('Malzeme verimliliği','Material utilization','كفاءة استخدام المادة','بهره‌وری ماده'),
E('Fire','Waste','هدر','پرت'),
E('İyileştirme keşfet / sıkıştır','Improvement explore / compress','تحسين الاستكشاف / الضغط','بهبود کاوش / فشرده‌سازی'),
E('DXF İndir','Download DXF','تنزيل DXF','دانلود DXF'),
E('İçe aktarmayı gözden geçir','Review import','مراجعة الاستيراد','بررسی ورود'),
E('Bir çizim birimi','One drawing unit','وحدة رسم واحدة','یک واحد رسم'),
E('DXF katmanları','DXF layers','طبقات DXF','لایه‌های DXF'),
E('Önizlemeyi güncelle','Update preview','تحديث المعاينة','به‌روزرسانی پیش‌نمایش'),
E('İçe aktarmayı önizle','Preview import','معاينة الاستيراد','پیش‌نمایش ورود'),
E('İptal','Cancel','إلغاء','لغو'),
E('Şekil','Shape','الشكل','شکل'),
E('Dikdörtgen','Rectangle','مستطيل','مستطیل'),
E('Daire','Circle','دائرة','دایره'),
E('Çokgen çiz','Draw polygon','رسم مضلع','رسم چندضلعی'),
E('Şekil ekle','Add shape','إضافة شكل','افزودن شکل'),
E('Test DXF Dosyaları','Test DXF Files','ملفات DXF التجريبية','فایل‌های آزمایشی DXF'),
E('Bir dosya seçin; DXF doğrudan çalışma alanına yüklenir.','Choose a file; the DXF loads directly into the workspace.','اختر ملفاً؛ سيتم تحميل DXF مباشرة إلى مساحة العمل.','یک فایل انتخاب کنید؛ DXF مستقیماً در محیط کار بارگذاری می‌شود.'),
E('Test DXF klasöründe dosya bulunamadı.','No files were found in the Test DXF folder.','لم يتم العثور على ملفات في مجلد DXF التجريبي.','فایلی در پوشه آزمایشی DXF پیدا نشد.'),
E('Proje adı','Project name','اسم المشروع','نام پروژه'),
E('Proje oluştur','Create project','إنشاء مشروع','ایجاد پروژه'),
E('Yeniden adlandır','Rename','إعادة تسمية','تغییر نام'),
E('Projeyi değiştir','Switch project','تبديل المشروع','تغییر پروژه'),
E('İsterseniz mevcut yerleşimi önce DXF olarak indirin.','You can download the current layout as DXF first.','يمكنك أولاً تنزيل الترتيب الحالي بصيغة DXF.','در صورت تمایل ابتدا چیدمان فعلی را به صورت DXF دانلود کنید.'),
E('DXF indirmeden önce çizimi tamamlayın veya iptal edin.','Finish or cancel the drawing before downloading DXF.','أكمل الرسم أو ألغِه قبل تنزيل DXF.','پیش از دانلود DXF رسم را کامل یا لغو کنید.'),
E('DXF indir ve geç','Download DXF and continue','تنزيل DXF والمتابعة','دانلود DXF و ادامه'),
E('İndirmeden geç','Continue without downloading','المتابعة بدون تنزيل','ادامه بدون دانلود'),
E('Kapat','Close','إغلاق','بستن'),
E('Admin Paneli','Admin Panel','لوحة الإدارة','پنل مدیریت'),
E('Kısayollar ve formatlar','Shortcuts & formats','الاختصارات والصيغ','میانبرها و قالب‌ها'),
E('Görüntü birimleri','Display units','وحدات العرض','واحدهای نمایش'),
E('Milimetre','Millimeter','مليمتر','میلی‌متر'),
E('İnç','Inch','بوصة','اینچ'),
E('Görünüm','Appearance','المظهر','ظاهر'),
E('Sistem','System','النظام','سیستم'),
E('Açık','Light','فاتح','روشن'),
E('Koyu','Dark','داكن','تیره'),
E('Dil','Language','اللغة','زبان'),
E('Varsayılan dil','Default language','اللغة الافتراضية','زبان پیش‌فرض'),
E('PC Sürümü','PC Version','إصدار الكمبيوتر','نسخه کامپیوتر'),
E('Geliştirici:','Developer:','المطور:','توسعه‌دهنده:'),
E('Canlı destek','Live support','الدعم المباشر','پشتیبانی زنده'),
E('Destek','Support','الدعم','پشتیبانی'),
E('Mesajınızı yazın…','Write your message…','اكتب رسالتك…','پیام خود را بنویسید…'),
E('Yenile','Refresh','تحديث','تازه‌سازی'),
E('Bulut kayıtları','Cloud records','السجلات السحابية','سوابق ابری'),
E('Geçmiş yükleniyor…','Loading history…','جارٍ تحميل السجل…','در حال بارگذاری تاریخچه…'),
E('Proje indir','Download project','تنزيل المشروع','دانلود پروژه'),
E('Henüz kayıt yok','No records yet','لا توجد سجلات بعد','هنوز سابقه‌ای نیست'),
E('DXF indir','Download DXF','تنزيل DXF','دانلود DXF'),
E('Sil','Delete','حذف','حذف'),
E('Şekil kütüphanesi','Shape library','مكتبة الأشكال','کتابخانه اشکال'),
E('Serbest dönüş','Free rotation','دوران حر','چرخش آزاد'),
E('Giriş yap','Sign in','تسجيل الدخول','ورود'),
E('Çıkış yap','Sign out','تسجيل الخروج','خروج'),
E('Kayıt ol','Register','إنشاء حساب','ثبت‌نام'),
E('Yeni parola belirle','Set a new password','تعيين كلمة مرور جديدة','تعیین رمز عبور جدید'),
E('Adınız','Your name','اسمك','نام شما'),
E('E-posta','Email','البريد الإلكتروني','ایمیل'),
E('Parola','Password','كلمة المرور','رمز عبور'),
E('Google ile devam et','Continue with Google','المتابعة باستخدام Google','ادامه با Google'),
E('Şimdilik kapat','Close for now','إغلاق الآن','فعلاً بستن'),
E('Bitir','End','إنهاء','پایان'),
E('Reddet','Decline','رفض','رد'),
E('Onayla ve ekranı paylaş','Approve and share screen','الموافقة ومشاركة الشاشة','تأیید و اشتراک صفحه'),
E('Hesap oluştur','Create account','إنشاء حساب','ایجاد حساب'),
E('Parolayı değiştir','Change password','تغيير كلمة المرور','تغییر رمز عبور'),
E('Admin girişi','Admin sign in','تسجيل دخول الإدارة','ورود مدیر'),
E('Serula Yönetim','Serula Administration','إدارة Serula','مدیریت Serula'),
E('Yönetim Paneli','Administration Panel','لوحة الإدارة','پنل مدیریت'),
E('Çalışma alanına dön','Back to workspace','العودة إلى مساحة العمل','بازگشت به محیط کار'),
E('Kullanıcı Yönetimi','User Management','إدارة المستخدمين','مدیریت کاربران'),
E('Kullanıcı','User','المستخدم','کاربر'),
E('Rol / Giriş','Role / Sign-in','الدور / تسجيل الدخول','نقش / ورود'),
E('Nesting hakkı','Nesting credits','رصيد الترتيب','اعتبار چیدمان'),
E('Lisans','License','الترخيص','مجوز'),
E('İşlemler','Actions','الإجراءات','عملیات'),
E('Kotasız / Sınırsız','Unlimited','غير محدود','نامحدود'),
E('Hak','Credits','الرصيد','اعتبار'),
E('Süre ver…','Set duration…','تحديد المدة…','تعیین مدت…'),
E('Süresiz','Unlimited time','بدون مدة','بدون محدودیت زمانی'),
E('Ayarlar','Settings','الإعدادات','تنظیمات'),
E('Mesajlar','Messages','الرسائل','پیام‌ها'),
E('Ekrana bağlan','Connect to screen','الاتصال بالشاشة','اتصال به صفحه'),
E('Şifre sıfırla','Reset password','إعادة تعيين كلمة المرور','بازنشانی رمز عبور'),
E('Kullanıcıyı sil','Delete user','حذف المستخدم','حذف کاربر'),
E('Canlı Destek Mesajları','Live Support Messages','رسائل الدعم المباشر','پیام‌های پشتیبانی زنده'),
E('Konuşmalar','Conversations','المحادثات','گفتگوها'),
E('Cevapla','Reply','رد','پاسخ'),
E('Tam erişim','Full access','وصول كامل','دسترسی کامل'),
E('Sınırlı','Limited','محدود','محدود'),
E('Sistem Varsayılanları','System Defaults','إعدادات النظام الافتراضية','پیش‌فرض‌های سیستم'),
E('Kaydet','Save','حفظ','ذخیره'),
E('İşlem Geçmişi','Activity History','سجل العمليات','تاریخچه عملیات'),
E('Sistem Logları','System Logs','سجلات النظام','گزارش‌های سیستم'),
E('Güvenlik','Security','الأمان','امنیت'),
E('Kontrol et','Check','تحقق','بررسی'),
E('Sürüm','Version','الإصدار','نسخه'),
E('Dışa aktar','Export','تصدير','خروجی گرفتن'),
E('Döndürme açısı, derece','Rotate by, degrees','زاوية الدوران، درجة','زاویه چرخش، درجه'),
E('Döndür','Rotate','تدوير','چرخاندن'),
E('En-boy oranı kilitli','Aspect ratio locked','نسبة الأبعاد مقفلة','نسبت ابعاد قفل است'),
E('Boyutlandırma ve döndürme bu şeklin tüm kopyalarını değiştirir; en-boy oranı kilitlidir.','Resizing and rotation change every copy of this shape; aspect ratio is locked.','تغيير الحجم والدوران يؤثران في كل نسخ هذا الشكل؛ نسبة الأبعاد مقفلة.','تغییر اندازه و چرخش روی همه کپی‌های این شکل اعمال می‌شود؛ نسبت ابعاد قفل است.'),
E('Geçici olarak kapatmak için Alt tuşunu basılı tutun. Sayısal alanlar tam değerini korur.','Hold Alt to bypass. Numeric fields stay exact.','اضغط Alt لتجاوز الالتقاط مؤقتاً. الحقول الرقمية تبقى دقيقة.','برای عبور موقت Alt را نگه دارید. فیلدهای عددی دقیق می‌مانند.'),
E('Canlı arama · çakışan alanlar kırmızı gösterilir.','Live search · overlapping areas shown in red.','بحث مباشر · مناطق التداخل تظهر بالأحمر.','جستجوی زنده · نواحی همپوشان قرمز نمایش داده می‌شوند.'),
E('Geometri doğrulandı.','Geometry checked.','تم التحقق من الهندسة.','هندسه بررسی شد.'),
E('Arama hazırlanıyor…','Preparing search…','جارٍ تجهيز البحث…','در حال آماده‌سازی جستجو…'),
E('Düzenlemek için bir kopya seçin. Yerleştirmek için sürükleyin.','Select a copy to adjust it. Drag to arrange.','اختر نسخة لتعديلها واسحبها للترتيب.','برای تنظیم یک کپی را انتخاب و برای چیدمان بکشید.'),
E('Canlı arama','Live search','بحث مباشر','جستجوی زنده'),
E('En iyi geçerli uzunluk','Best valid length','أفضل طول صالح','بهترین طول معتبر'),
E('Girdiler kontrol ediliyor','Checking inputs','جارٍ فحص المدخلات','در حال بررسی ورودی‌ها'),
E('Örnek yükleniyor…','Loading example…','جارٍ تحميل المثال…','در حال بارگذاری نمونه…'),
E('Sıkıştırmaya geç','Skip to compression','الانتقال إلى الضغط','رفتن به فشرده‌سازی'),
E('Keşfi bitir ve en iyi yerleşimi sıkıştır.','End exploration and refine the best layout.','إنهاء الاستكشاف وتحسين أفضل ترتيب.','کاوش را پایان دهید و بهترین چیدمان را فشرده کنید.'),
E('0 ile 500 arasında bir tam sayı girin.','Enter a whole number from 0 to 500.','أدخل عدداً صحيحاً من 0 إلى 500.','یک عدد صحیح بین ۰ تا ۵۰۰ وارد کنید.'),
E('Bu çizim 500 kopya sınırını aşıyor. Devam etmek için adetleri azaltın.','This drawing exceeds the 500-copy limit. Reduce quantities to continue.','هذا الرسم يتجاوز حد 500 نسخة. قلل الكميات للمتابعة.','این طرح از محدودیت ۵۰۰ کپی بیشتر است. برای ادامه تعداد را کاهش دهید.'),
E('Sıfır veya malzeme genişliğinden küçük pozitif bir parça aralığı girin.','Enter zero or a positive clearance smaller than the material width.','أدخل صفراً أو مسافة موجبة أصغر من عرض المادة.','صفر یا فاصله مثبت کوچکتر از عرض ماده وارد کنید.'),
E('İyi yerleşimleri daha hızlı bulur; en iyi nihai yerleşimi kaçırabilir.','Good layouts sooner. A greedier search that may miss the best final layout.','يعثر على ترتيبات جيدة أسرع وقد يفوّت أفضل ترتيب نهائي.','چیدمان‌های خوب را سریع‌تر پیدا می‌کند اما ممکن است بهترین نتیجه نهایی را از دست بدهد.'),
E('En iyi nihai yerleşim için daha kapsamlı arama yapar.','A more thorough search for the best final layout.','بحث أعمق للوصول إلى أفضل ترتيب نهائي.','جستجوی دقیق‌تر برای بهترین چیدمان نهایی.'),
E('Proje dosyaları tüm işi geri yükler. Çizim dosyaları şekil olarak eklenebilir.','Project files restore a complete job. Drawing files can be added as shapes.','ملفات المشروع تستعيد العمل كاملاً ويمكن إضافة ملفات الرسم كأشكال.','فایل پروژه کل کار را بازیابی می‌کند و فایل‌های رسم را می‌توان به عنوان شکل افزود.'),
E('SVG, DXF ve instance JSON şekil ekler. Kaydedilmiş proje tüm işi geri yükler.','SVG, DXF and instance JSON add shapes. A saved project restores a complete job.','تضيف ملفات SVG وDXF وJSON أشكالاً؛ المشروع المحفوظ يستعيد العمل كاملاً.','SVG، DXF و JSON نمونه شکل اضافه می‌کنند؛ پروژه ذخیره‌شده کل کار را بازیابی می‌کند.'),
E('Fiziksel SVG ölçüleri ve tanınan DXF birimleri korunur. Birimsiz çizimler seçilen ölçeği kullanır.','Physical SVG dimensions and recognized DXF units are honored. Instance JSON and drawings without units use the selected scale.','تُحترم أبعاد SVG ووحدات DXF المعروفة؛ الرسومات بلا وحدات تستخدم المقياس المحدد.','ابعاد واقعی SVG و واحدهای شناخته‌شده DXF حفظ می‌شوند؛ طرح‌های بدون واحد از مقیاس انتخابی استفاده می‌کنند.'),
E('Önizleme güncel değil.','Preview outdated.','المعاينة قديمة.','پیش‌نمایش قدیمی است.'),
E('Bu konturlar içe aktarılamaz:','These contours cannot be imported:','لا يمكن استيراد هذه المسارات:','این کانتورها قابل ورود نیستند:'),
E('Listelenen geçersiz konturları hariç tut','Exclude the listed invalid contours','استبعاد المسارات غير الصالحة المدرجة','کانتورهای نامعتبر فهرست‌شده را حذف کن'),
E('Yeni proje olarak aç','Open as new project','فتح كمشروع جديد','باز کردن به عنوان پروژه جدید'),
E('Tuvalde her köşeye tıklayın. Enter çokgeni kapatır; Escape iptal eder. Kontur eklenmeden önce kontrol edilir.','Click each vertex in the canvas. Enter closes the polygon; Escape cancels. The contour is checked before it is added.','انقر كل رأس على اللوحة. Enter يغلق المضلع وEscape يلغي. يتم فحص المسار قبل إضافته.','روی هر رأس در بوم کلیک کنید. Enter چندضلعی را می‌بندد و Escape لغو می‌کند. کانتور پیش از افزودن بررسی می‌شود.'),
E('Çizime başla','Start drawing','ابدأ الرسم','شروع رسم'),
E('Başlatılıyor','Initializing','جارٍ البدء','در حال شروع'),
E('Çalışıyor','Running','قيد التشغيل','در حال اجرا'),
E('Tamamlandı','Complete','اكتمل','کامل شد'),
E('Durduruldu','Stopped','تم الإيقاف','متوقف شد'),
E('Keşif','Exploration','استكشاف','کاوش'),
E('Sıkıştırma','Compression','ضغط','فشرده‌سازی'),
E('Geçiliyor…','Switching…','جارٍ التبديل…','در حال تغییر…'),
E('Canlı önizleme kullanılamıyor:','Live preview unavailable:','المعاينة المباشرة غير متاحة:','پیش‌نمایش زنده در دسترس نیست:'),
E('Kopya seçilmedi. Bu parçayı taşımak veya boyutlandırmak için adet alanından bir kopya ekleyin.','No copy selected. Add a copy using its quantity to move or resize this part.','لم يتم تحديد نسخة. أضف نسخة من حقل الكمية لتحريك هذا الجزء أو تغيير حجمه.','هیچ کپی انتخاب نشده است. برای جابه‌جایی یا تغییر اندازه این قطعه از تعداد، یک کپی اضافه کنید.'),
E('Açık/koyu görünümü değiştir','Toggle light/dark mode','تبديل المظهر الفاتح/الداكن','تغییر حالت روشن/تیره'),
E('Genişlik','Width','العرض','عرض'),
E('Yükseklik','Height','الارتفاع','ارتفاع'),
E('Konum seçili kopyaları etkiler.','Position affects selected copies.','الموضع يؤثر في النسخ المحددة.','موقعیت روی کپی‌های انتخاب‌شده اثر می‌گذارد.'),
E('DXF ölçüleri kilitlidir; genişlik ve yükseklik değiştirilemez.','DXF dimensions are locked; width and height cannot be changed.','أبعاد DXF مقفلة؛ لا يمكن تغيير العرض والارتفاع.','ابعاد DXF قفل است؛ عرض و ارتفاع قابل تغییر نیست.'),
E('Yakalamayı etkinleştir','Enable snapping','تفعيل الالتقاط','فعال‌سازی چسبیدن'),
E('Izgara','Grid','الشبكة','شبکه'),
E('Açı adımı','Angle step','خطوة الزاوية','گام زاویه'),
E('Kontur modu','Outline mode','وضع الحدود','حالت کانتور'),
E('Soluk dolgulu konturları göster','Show faint filled outlines','إظهار حدود بتعبئة خافتة','نمایش کانتور با پرشدگی کم‌رنگ'),
E('Sığdır','Fit','ملاءمة','جا دادن'),
E('Uzaklaştır','Zoom out','تصغير','کوچک‌نمایی'),
E('Yakınlaştır','Zoom in','تكبير','بزرگ‌نمایی'),
E('Malzeme ölçüsü','Material size','مقاس المادة','اندازه ماده'),
E('Koordinat cetvelleri','Coordinate rulers','مساطر الإحداثيات','خط‌کش‌های مختصات'),
E('Köşelere tıklayın · Bitirmek için Enter · İptal için Escape','Click vertices · Enter to finish · Escape to cancel','انقر الرؤوس · Enter للإنهاء · Escape للإلغاء','روی رأس‌ها کلیک کنید · Enter برای پایان · Escape برای لغو'),
E('Geometri doğrulandı. Düzenlemek için bir kopya seçin.','Geometry checked. Select a copy to adjust it.','تم التحقق من الهندسة. اختر نسخة لتعديلها.','هندسه بررسی شد. یک کپی برای تنظیم انتخاب کنید.'),
E('sonraki dönüş','next rotation','الدوران التالي','چرخش بعدی'),
E('kopya','copy','نسخة','کپی'),
E('Seçime eklemek için ⌘/Ctrl-tıkla veya sürükle','⌘/Ctrl-click or drag to add selection','انقر ⌘/Ctrl أو اسحب للإضافة إلى التحديد','برای افزودن به انتخاب ⌘/Ctrl-کلیک یا درگ کنید'),
E('arka planı sürükleyerek kaydır · tekerlek veya sıkıştırma ile yakınlaştır','drag background to pan · scroll or pinch to zoom','اسحب الخلفية للتحريك · مرر أو اقرص للتكبير','پس‌زمینه را برای جابه‌جایی بکشید · با اسکرول یا نیشگون زوم کنید'),
E('Atölye örneği','Workshop example','مثال الورشة','نمونه کارگاه'),
E('Veri seti','Dataset','مجموعة البيانات','مجموعه داده'),
E('Bir örnek deneyin','Try an example','جرّب مثالاً','یک نمونه را امتحان کنید'),
E('Örneği aç','Open example','فتح المثال','باز کردن نمونه'),
E('Aç ve yerleştir','Open and nest','فتح وترتيب','باز کردن و چیدمان'),
E('Şekiller yükleniyor…','Loading shapes…','جارٍ تحميل الأشكال…','در حال بارگذاری شکل‌ها…'),
E('Kaynak dosyalar','Source files','ملفات المصدر','فایل‌های منبع'),
E('Koleksiyon','Collection','المجموعة','مجموعه'),
E('Şekillerim','My shapes','أشكالي','شکل‌های من'),
E('Şekiller','Shapes','الأشكال','شکل‌ها'),
E('Şekil seçici','Shape selector','محدد الأشكال','انتخابگر شکل'),
E('Kütüphane şekilleri','Library shapes','أشكال المكتبة','شکل‌های کتابخانه'),
E('Şekli projeye ekle','Add shape to project','إضافة الشكل إلى المشروع','افزودن شکل به پروژه'),
E('Yeni kişisel şekil olarak kaydet','Save as new personal shape','حفظ كشكل شخصي جديد','ذخیره به‌عنوان شکل شخصی جدید'),
E('Kaydedilmiş şekli kaldır','Remove saved shape','إزالة الشكل المحفوظ','حذف شکل ذخیره‌شده'),
E('Bitti','Done','تم','تمام'),
E('Serula projesi','Serula project','مشروع Serula','پروژه Serula'),
E('otomatik bulut kaydı','automatic cloud save','حفظ سحابي تلقائي','ذخیره خودکار ابری'),
E('Çalışma değiştikçe son temiz proje durumu otomatik kaydedilir; DXF exportları ayrıca geçmişte tutulur.','The latest clean project state is saved automatically as you work; DXF exports are also kept in history.','يتم حفظ آخر حالة نظيفة للمشروع تلقائياً أثناء العمل؛ وتُحفظ صادرات DXF أيضاً في السجل.','آخرین وضعیت تمیز پروژه هنگام کار به‌صورت خودکار ذخیره می‌شود؛ خروجی‌های DXF نیز در تاریخچه نگهداری می‌شوند.'),
E('Giriş yaptıktan sonra proje değişiklikleri otomatik olarak burada saklanır.','After signing in, project changes are stored here automatically.','بعد تسجيل الدخول تُحفظ تغييرات المشروع هنا تلقائياً.','پس از ورود، تغییرات پروژه به‌صورت خودکار اینجا ذخیره می‌شوند.'),
E('Aç','Open','فتح','باز کردن'),
E('Bekleyin…','Please wait…','يرجى الانتظار…','لطفاً صبر کنید…'),
E('Mesajlar hesabınıza bağlı olarak saklanır.','Messages are stored with your account.','تُحفظ الرسائل مع حسابك.','پیام‌ها به حساب شما متصل و ذخیره می‌شوند.'),
E('Mesajlar yükleniyor…','Loading messages…','جارٍ تحميل الرسائل…','در حال بارگذاری پیام‌ها…'),
E('Henüz mesaj yok. Buradan admin ile doğrudan yazışabilirsiniz.','No messages yet. You can message the admin directly here.','لا توجد رسائل بعد. يمكنك مراسلة المشرف مباشرة من هنا.','هنوز پیامی نیست. می‌توانید از اینجا مستقیماً با مدیر پیام دهید.'),
E('Siz','You','أنت','شما'),
E('Serula Destek','Serula Support','دعم Serula','پشتیبانی Serula'),
E('Destek mesajı','Support message','رسالة دعم','پیام پشتیبانی'),
E('Gönderiliyor…','Sending…','جارٍ الإرسال…','در حال ارسال…'),
E('Hesap menüsü','Account menu','قائمة الحساب','منوی حساب'),
E('Sınırsız kullanım','Unlimited usage','استخدام غير محدود','استفاده نامحدود'),
E('Lisans süresi doldu','License expired','انتهت مدة الترخيص','مجوز منقضی شده'),
E('Lisans: süresiz','License: unlimited','الترخيص: بلا مدة','مجوز: بدون محدودیت'),
E('Ekran paylaşımı canlı','Screen sharing live','مشاركة الشاشة مباشرة','اشتراک صفحه زنده'),
E('Ekran paylaşımı canlı · yedek bağlantı','Screen sharing live · fallback connection','مشاركة الشاشة مباشرة · اتصال احتياطي','اشتراک صفحه زنده · اتصال پشتیبان'),
E('Ekran bağlantısı kurulamadı','Screen connection failed','تعذر اتصال الشاشة','اتصال صفحه برقرار نشد'),
E('Ekran bağlantısı kuruluyor…','Connecting to screen…','جارٍ الاتصال بالشاشة…','در حال اتصال به صفحه…'),
E('Uzaktan destek aktif','Remote support active','الدعم عن بعد نشط','پشتیبانی از راه دور فعال'),
E('Ekran paylaşımı isteği','Screen sharing request','طلب مشاركة الشاشة','درخواست اشتراک صفحه'),
E('Uzaktan destek isteği','Remote support request','طلب دعم عن بعد','درخواست پشتیبانی از راه دور'),
E('Onayla','Approve','موافقة','تأیید'),
E('Bağlanıyor…','Connecting…','جارٍ الاتصال…','در حال اتصال…'),
E('DXF indirmek için giriş yapın. Dosya içe aktarma ve yerleştirme giriş yapmadan kullanılabilir.','Sign in to download DXF. Import and nesting can be used without signing in.','سجل الدخول لتنزيل DXF. يمكن استخدام الاستيراد والترتيب دون تسجيل الدخول.','برای دانلود DXF وارد شوید. ورود فایل و چیدمان بدون ورود هم قابل استفاده است.'),
E('Yeni normal kullanıcılar 5 indirme/nesting hakkıyla başlar.','New standard users start with 5 download/nesting credits.','يبدأ المستخدمون العاديون الجدد بـ 5 أرصدة تنزيل/ترتيب.','کاربران عادی جدید با ۵ اعتبار دانلود/چیدمان شروع می‌کنند.'),
E('Admin oturumu kontrol ediliyor…','Checking admin session…','جارٍ التحقق من جلسة المشرف…','در حال بررسی نشست مدیر…'),
E('Admin e-posta ve parolanızı girin.','Enter your admin email and password.','أدخل بريد المشرف وكلمة المرور.','ایمیل و رمز عبور مدیر را وارد کنید.'),
E('Genel Bakış','Overview','نظرة عامة','نمای کلی'),
E('Canlı Destek','Live Support','الدعم المباشر','پشتیبانی زنده'),
E('Roller ve Yetkiler','Roles & Permissions','الأدوار والصلاحيات','نقش‌ها و مجوزها'),
E('Kullanıcı Ayarları','User Settings','إعدادات المستخدم','تنظیمات کاربر'),
E('Sistem Bilgisi','System Information','معلومات النظام','اطلاعات سیستم'),
E('Hızlı Durum','Quick Status','حالة سريعة','وضعیت سریع'),
E('İstemci','Client','العميل','کلاینت'),
E('Uygulama','Application','التطبيق','برنامه'),
E('Çalışıyor','Running','يعمل','در حال اجرا'),
E('Admin rotası','Admin route','مسار المشرف','مسیر مدیریت'),
E('Kimlik doğrulama','Authentication','المصادقة','احراز هویت'),
E('Kalıcı veritabanı','Persistent database','قاعدة بيانات دائمة','پایگاه داده پایدار'),
E('D1 bağlı','D1 connected','D1 متصل','D1 متصل'),
E('Son İşlemler','Recent Actions','آخر الإجراءات','عملیات اخیر'),
E('Toplam kullanıcı','Total users','إجمالي المستخدمين','کل کاربران'),
E('Çevrim içi','Online','متصل','آنلاین'),
E('Destek konuşması','Support conversations','محادثات الدعم','گفتگوهای پشتیبانی'),
E('Kullanıcılar alınamadı.','Could not load users.','تعذر تحميل المستخدمين.','کاربران بارگذاری نشدند.'),
E('Tümü','All','الكل','همه'),
E('Operatör','Operator','مشغل','اپراتور'),
E('Kullanıcı bilgileri D1 veritabanından alınıyor.','Loading user information from D1.','جارٍ تحميل معلومات المستخدم من D1.','در حال دریافت اطلاعات کاربر از D1.'),
E('Özel gün','Custom days','أيام مخصصة','روز دلخواه'),
E('Kullanıcı bulunamadı','User not found','المستخدم غير موجود','کاربر پیدا نشد'),
E('Filtreye uyan kullanıcı yok.','No users match the filter.','لا يوجد مستخدم يطابق المرشح.','کاربری مطابق فیلتر نیست.'),
E('Kullanıcıların İletişim bölümünden yazdığı mesajlar kalıcı olarak burada tutulur.','Messages users send from Contact are stored here permanently.','تُحفظ رسائل المستخدمين من قسم الاتصال هنا بشكل دائم.','پیام‌های کاربران از بخش تماس به‌صورت پایدار اینجا ذخیره می‌شوند.'),
E('Konuşma seçin','Select a conversation','اختر محادثة','یک گفتگو انتخاب کنید'),
E('Cevabınızı yazın…','Write your reply…','اكتب ردك…','پاسخ خود را بنویسید…'),
E('Kullanıcıya Özel Varsayılanlar','User-specific Defaults','إعدادات مستخدم افتراضية','پیش‌فرض‌های اختصاصی کاربر'),
E('Kullanıcı seç…','Select user…','اختر مستخدماً…','انتخاب کاربر…'),
E('Sistem varsayılanlarına dön','Restore system defaults','العودة لإعدادات النظام','بازگشت به پیش‌فرض سیستم'),
E('Kullanıcı ayarlarını kaydet','Save user settings','حفظ إعدادات المستخدم','ذخیره تنظیمات کاربر'),
E('Yeni kullanıcı ve projeler için başlangıç ayarları. Ana uygulamadaki gerçek kullanıcı seçenekleriyle senkron çalışır.','Starting settings for new users and projects. Synchronized with the actual options in the main app.','إعدادات البداية للمستخدمين والمشاريع الجديدة ومتزامنة مع خيارات التطبيق الرئيسي.','تنظیمات آغازین کاربران و پروژه‌های جدید که با گزینه‌های برنامه اصلی همگام است.'),
E('Aktif','Active','نشط','فعال'),
E('Son 30 gün','Last 30 days','آخر 30 يوماً','۳۰ روز گذشته'),
E('Henüz sistem logu yok.','No system logs yet.','لا توجد سجلات نظام بعد.','هنوز گزارش سیستمی وجود ندارد.'),
E('Ürün','Product','المنتج','محصول'),
E('Yönetim yolu','Admin path','مسار الإدارة','مسیر مدیریت'),
E('Dağıtım','Deployment','النشر','استقرار'),
E('Kalıcı kullanıcı deposu','Persistent user store','مخزن مستخدم دائم','ذخیره‌گاه پایدار کاربر'),
E('Başarılı','Success','ناجح','موفق'),
E('Hata','Error','خطأ','خطا'),
E('Hazır','Ready','جاهز','آماده'),
E('Önizleme güncel değil. Ayarlarınızı uygulamak için önizlemeyi güncelleyin.','Preview is outdated. Update the preview to apply your settings.','المعاينة قديمة. حدّث المعاينة لتطبيق إعداداتك.','پیش‌نمایش قدیمی است. برای اعمال تنظیمات، پیش‌نمایش را به‌روزرسانی کنید.'),
E('Bu kaydedilmiş bir projedir. İçe aktarmak adını, malzemeyi, şekilleri ve doğrulanmış sonucu geri yükler.','This is a saved project. Importing it restores its name, material, shapes and checked result.','هذا مشروع محفوظ. استيراده يعيد الاسم والمادة والأشكال والنتيجة المتحققة.','این یک پروژه ذخیره‌شده است. ورود آن نام، ماده، شکل‌ها و نتیجه بررسی‌شده را بازیابی می‌کند.'),
E('Bu projeyi açmak adını, malzeme genişliğini ve şekilleri geri yükler.','Opening this project restores its name, material width and shapes.','فتح هذا المشروع يعيد اسمه وعرض المادة والأشكال.','باز کردن این پروژه نام، عرض ماده و شکل‌ها را بازیابی می‌کند.'),
E('Sistem durumu','System status','حالة النظام','وضعیت سیستم'),
E('Proje:','Project:','المشروع:','پروژه:'),
E('Parça türü:','Part types:','أنواع الأجزاء:','نوع قطعه:'),
E('Toplam parça:','Total parts:','إجمالي الأجزاء:','کل قطعات:'),
E('Malzeme:','Material:','المادة:','ماده:'),
E('Etkin yerleşim ayarları','Active nesting settings','إعدادات الترتيب النشطة','تنظیمات فعال چیدمان'),
E('Genişlik:','Width:','العرض:','عرض:'),
E('Plaka uzunluğu:','Sheet length:','طول اللوح:','طول ورق:'),
E('Parça aralığı:','Part spacing:','المسافة بين الأجزاء:','فاصله قطعات:'),
E('Kullanıcı/rol yetkilendirmesi için sunucu tarafı kimlik doğrulama ve kalıcı kullanıcı veritabanı gerekir. Bu statik istemcide güvenli kullanıcı yetkisi taklit edilmez.','User and role authorization requires server-side authentication and a persistent user database. Secure permissions are not simulated in the static client.','يتطلب تفويض المستخدمين والأدوار مصادقة من جهة الخادم وقاعدة بيانات مستخدمين دائمة. لا تتم محاكاة الصلاحيات الآمنة في العميل الثابت.','مجوزدهی کاربر و نقش به احراز هویت سمت سرور و پایگاه داده پایدار کاربر نیاز دارد. مجوز امن در کلاینت ایستا شبیه‌سازی نمی‌شود.'),
E('Özellikle ayakkabı üretimi, suni deri, tekstil, lazer kesim ve CNC işlemlerinde malzeme kaybını azaltmaya yardımcı olmak amacıyla geliştirilmektedir. İçe aktarılan DXF parçalarının gerçek ölçüleri korunur; parçaların ebatları otomatik olarak değiştirilmez.','It is developed to help reduce material waste in footwear, synthetic leather, textile, laser cutting and CNC workflows. Imported DXF parts keep their real dimensions; part sizes are not changed automatically.','تم تطويره للمساعدة في تقليل هدر المواد في الأحذية والجلد الصناعي والمنسوجات والقطع بالليزر وعمليات CNC. تُحفظ أبعاد أجزاء DXF الحقيقية ولا تتغير أحجامها تلقائياً.','برای کاهش پرت مواد در تولید کفش، چرم مصنوعی، نساجی، برش لیزر و CNC توسعه یافته است. ابعاد واقعی قطعات DXF حفظ می‌شود و اندازه قطعات خودکار تغییر نمی‌کند.'),
E('Yerleştirme motoru düzensiz şekilleri değerlendirerek kullanılabilir alanı daha verimli kullanmaya çalışır. Proje aktif olarak geliştirilmektedir.','The nesting engine evaluates irregular shapes to use available space more efficiently. The project is actively developed.','يقيّم محرك الترتيب الأشكال غير المنتظمة لاستخدام المساحة المتاحة بكفاءة أكبر. المشروع قيد التطوير النشط.','موتور چیدمان شکل‌های نامنظم را بررسی می‌کند تا از فضای موجود بهتر استفاده شود. پروژه به‌طور فعال در حال توسعه است.'),
E('İndirme bağlantısı:','Download link:','رابط التنزيل:','لینک دانلود:'),
E('Hazırlık kısayolları','Preparation shortcuts','اختصارات التحضير','میانبرهای آماده‌سازی'),
E('izin verilen yönler arasında geçiş yapar.','cycles through allowed orientations.','يتنقل بين الاتجاهات المسموحة.','بین جهت‌های مجاز جابه‌جا می‌شود.'),
E('seçimin bir kopyasını ekler.','adds a copy of the selection.','يضيف نسخة من التحديد.','یک کپی از انتخاب اضافه می‌کند.'),
E('seçili kopyayı kaldırır.','removes the selected copy.','يزيل النسخة المحددة.','کپی انتخاب‌شده را حذف می‌کند.'),
E('veya','or','أو','یا'),
E('adedi artırır;','increases quantity;','يزيد الكمية؛','تعداد را افزایش می‌دهد؛'),
E('azaltır.','decreases it.','يقللها.','کاهش می‌دهد.'),
E('Kısayollar çalışma alanı veya düzenlenebilir olmayan bir kontrol odaktayken çalışır. Adet değişiklikleri 500 kopyalık proje sınırı içinde tutulur.','Shortcuts work when the workspace or a non-editable control has focus. Quantity changes stay within the 500-copy project limit.','تعمل الاختصارات عندما تكون مساحة العمل أو عنصر غير قابل للتحرير في التركيز. تبقى تغييرات الكمية ضمن حد 500 نسخة للمشروع.','میانبرها وقتی محیط کار یا کنترل غیرقابل‌ویرایش فوکوس دارد فعال‌اند. تغییر تعداد در محدودیت ۵۰۰ کپی پروژه باقی می‌ماند.'),
E('İç boşluklar korunur. Parça aralığı parçalar arasındaki boşluktur; kesim kerfi değildir.','Inner holes are preserved. Part spacing is the gap between parts; it is not cutting kerf.','تُحفظ الفتحات الداخلية. تباعد الأجزاء هو الفراغ بين الأجزاء وليس عرض القطع.','حفره‌های داخلی حفظ می‌شوند. فاصله قطعات فضای بین قطعات است و کرِف برش نیست.'),
E('Bütün proje için seri adedi','Series quantity for the whole project','كمية السلسلة للمشروع بالكامل','تعداد سری برای کل پروژه'),
E('Proje seri adedi','Project series quantity','كمية سلسلة المشروع','تعداد سری پروژه'),
E('Sonuç görünümü','Result view','عرض النتيجة','نمای نتیجه'),
E('Keşif: ilk geçerli uzunluktan azalma. Sıkıştırma: en iyi keşif uzunluğundan ek azalma.','Exploration: reduction from the first valid length. Compression: further reduction from the best exploration length.','الاستكشاف: تقليل من أول طول صالح. الضغط: تقليل إضافي من أفضل طول في الاستكشاف.','کاوش: کاهش نسبت به اولین طول معتبر. فشرده‌سازی: کاهش بیشتر نسبت به بهترین طول کاوش.'),
E('İçe aktarılan şekiller','Imported shapes','الأشكال المستوردة','شکل‌های واردشده'),
E('Başka hesapla giriş yap','Sign in with another account','تسجيل الدخول بحساب آخر','ورود با حساب دیگر'),
E('Yerel test','Local test','اختبار محلي','آزمایش محلی'),
E('Güvenli yönetim','Secure administration','إدارة آمنة','مدیریت امن'),
E('Kullanıcı ve yetki değişiklikleri sunucu kimlik doğrulaması olmadan uygulanmaz.','User and permission changes are not applied without server authentication.','لا تُطبق تغييرات المستخدم والصلاحيات دون مصادقة الخادم.','تغییرات کاربر و مجوز بدون احراز هویت سرور اعمال نمی‌شود.'),
E('Yönetim','Administration','الإدارة','مدیریت'),
E('Kalıcı işlem geçmişi bağlandığında burada kullanıcı, proje, nesting ve dışa aktarma kayıtları gösterilecek.','When persistent activity history is connected, user, project, nesting and export records will appear here.','عند ربط سجل العمليات الدائم ستظهر هنا سجلات المستخدم والمشروع والترتيب والتصدير.','با اتصال تاریخچه پایدار، سوابق کاربر، پروژه، چیدمان و خروجی اینجا نمایش داده می‌شود.'),
E('E-posta veya Google ile giriş yapan kullanıcıların hesap, kota ve lisans sürelerini yönetin.','Manage accounts, quotas and license durations for users who sign in with email or Google.','إدارة الحسابات والحصص ومدد التراخيص للمستخدمين الذين يسجلون الدخول بالبريد أو Google.','حساب، سهمیه و مدت مجوز کاربران واردشده با ایمیل یا Google را مدیریت کنید.'),
E('↻ Yenile','↻ Refresh','↻ تحديث','↻ تازه‌سازی'),
E('Admin','Admin','المشرف','مدیر'),
E('7 gün','7 days','7 أيام','۷ روز'),
E('30 gün','30 days','30 يوماً','۳۰ روز'),
E('90 gün','90 days','90 يوماً','۹۰ روز'),
E('180 gün','180 days','180 يوماً','۱۸۰ روز'),
E('1 yıl','1 year','سنة واحدة','۱ سال'),
E('çevrim içi','online','متصل','آنلاین'),
E('Kullanıcı mesaj gönderdiğinde burada görünecek.','It will appear here when a user sends a message.','سيظهر هنا عندما يرسل المستخدم رسالة.','وقتی کاربر پیام بفرستد اینجا نمایش داده می‌شود.'),
E('Bu kullanıcıyla henüz mesaj yok.','No messages with this user yet.','لا توجد رسائل مع هذا المستخدم بعد.','هنوز پیامی با این کاربر وجود ندارد.'),
E('Soldaki listeden bir kullanıcı seçin.','Select a user from the list on the left.','اختر مستخدماً من القائمة على اليسار.','یک کاربر از فهرست سمت چپ انتخاب کنید.'),
E('✓ Kullanıcı yönetimi','✓ User management','✓ إدارة المستخدمين','✓ مدیریت کاربران'),
E('✓ Sistem varsayılanları','✓ System defaults','✓ إعدادات النظام الافتراضية','✓ پیش‌فرض‌های سیستم'),
E('✓ Log ve geçmiş','✓ Logs and history','✓ السجلات والتاريخ','✓ گزارش و تاریخچه'),
E('✓ Kullanıcı ayarlarını kilitleme','✓ Lock user settings','✓ قفل إعدادات المستخدم','✓ قفل تنظیمات کاربر'),
E('✓ DXF içe aktarma','✓ DXF import','✓ استيراد DXF','✓ ورود DXF'),
E('✓ Nesting çalıştırma','✓ Run nesting','✓ تشغيل الترتيب','✓ اجرای چیدمان'),
E('✓ DXF dışa aktarma','✓ DXF export','✓ تصدير DXF','✓ خروجی DXF'),
E('— Admin erişimi yok','— No admin access','— لا وصول للمشرف','— بدون دسترسی مدیر'),
E('Yetki değişiklikleri istemci tarafında taklit edilmeyecek; güvenli API bağlandığında bu bölüm aktif olacak.','Permission changes are not simulated client-side; this section will activate when the secure API is connected.','لا تتم محاكاة تغييرات الصلاحيات في العميل؛ سيتفعّل هذا القسم عند ربط API الآمن.','تغییر مجوز در سمت کلاینت شبیه‌سازی نمی‌شود؛ با اتصال API امن این بخش فعال خواهد شد.'),
E('Seçilen kullanıcı için sistem varsayılanlarının üzerine uygulanır.','Applied on top of system defaults for the selected user.','تُطبق فوق إعدادات النظام الافتراضية للمستخدم المحدد.','برای کاربر انتخاب‌شده روی پیش‌فرض‌های سیستم اعمال می‌شود.'),
E('Desteği bitir','End support','إنهاء الدعم','پایان پشتیبانی'),
E('Canlı ekran','Live screen','الشاشة المباشرة','صفحه زنده'),
E('Tam ekran','Full screen','ملء الشاشة','تمام‌صفحه'),
E('Malzeme genişliği (mm)','Material width (mm)','عرض المادة (مم)','عرض ماده (میلی‌متر)'),
E('Parça aralığı (mm)','Part spacing (mm)','تباعد الأجزاء (مم)','فاصله قطعات (میلی‌متر)'),
E('Rotasyon','Rotation','الدوران','چرخش'),
E('Solver profili','Solver profile','ملف المحلل','پروفایل حل‌گر'),
E('Yukarıdaki listeden bir kullanıcı seçerek ona özel varsayılanları düzenleyebilirsiniz.','Select a user above to edit user-specific defaults.','اختر مستخدماً من القائمة أعلاه لتعديل إعداداته الافتراضية الخاصة.','با انتخاب کاربر از فهرست بالا، پیش‌فرض‌های اختصاصی او را ویرایش کنید.'),
E('Varsayılan malzeme genişliği (mm)','Default material width (mm)','عرض المادة الافتراضي (مم)','عرض پیش‌فرض ماده (میلی‌متر)'),
E('Varsayılan rotasyon','Default rotation','الدوران الافتراضي','چرخش پیش‌فرض'),
E('Varsayılan malzeme','Default material','المادة الافتراضية','ماده پیش‌فرض'),
E('Kullanıcıya özel ayar yoksa bu değerler kullanılır.','These values are used when there are no user-specific settings.','تُستخدم هذه القيم عند عدم وجود إعدادات خاصة بالمستخدم.','اگر تنظیمات اختصاصی کاربر وجود نداشته باشد از این مقادیر استفاده می‌شود.'),
E('Nesting, proje ve dışa aktarma kayıtları.','Nesting, project and export records.','سجلات الترتيب والمشروع والتصدير.','سوابق چیدمان، پروژه و خروجی.'),
E('Sunucu kayıt altyapısı bağlandığında işlem süresi, malzeme kullanımı, plaka sayısı ve kullanıcı bilgisi burada görünecek.','When server history is connected, processing time, material use, sheet count and user information will appear here.','عند ربط سجل الخادم سيظهر هنا وقت المعالجة واستخدام المادة وعدد الألواح ومعلومات المستخدم.','با اتصال تاریخچه سرور، زمان پردازش، مصرف ماده، تعداد ورق و اطلاعات کاربر اینجا نمایش داده می‌شود.'),
E('Giriş, nesting, dışa aktarma ve yönetim işlemleri.','Sign-in, nesting, export and administration actions.','عمليات تسجيل الدخول والترتيب والتصدير والإدارة.','عملیات ورود، چیدمان، خروجی و مدیریت.'),
E('Yönetim menüsü','Administration menu','قائمة الإدارة','منوی مدیریت'),
E('Henüz veri yok','No data yet','لا توجد بيانات بعد','هنوز داده‌ای نیست'),
E('Kullanıcı ara…','Search users…','بحث عن مستخدم…','جستجوی کاربر…'),
E('Kullanıcı ara','Search users','بحث عن مستخدم','جستجوی کاربر'),
E('Yükleniyor','Loading','جارٍ التحميل','در حال بارگذاری'),
E('Destek konuşmaları','Support conversations','محادثات الدعم','گفتگوهای پشتیبانی'),
E('Henüz konuşma yok','No conversations yet','لا توجد محادثات بعد','هنوز گفتگویی نیست'),
E('Rol düzenleme sunucu bağlantısı gerektiriyor','Role editing requires a server connection','تعديل الأدوار يتطلب اتصالاً بالخادم','ویرایش نقش به اتصال سرور نیاز دارد'),
E('Kullanıcı seç','Select user','اختر مستخدماً','انتخاب کاربر'),
E('Kullanıcı seçin','Select a user','اختر مستخدماً','یک کاربر انتخاب کنید'),
E('Proje veya kullanıcı ara…','Search project or user…','بحث عن مشروع أو مستخدم…','جستجوی پروژه یا کاربر…'),
E('Geçmiş kaydı yok','No history records','لا توجد سجلات تاريخ','سابقه‌ای وجود ندارد'),
E('Seçimi döndür','Rotate selection','تدوير التحديد','چرخاندن انتخاب'),
E('Çakışan alanlar','Overlapping areas','مناطق التداخل','نواحی همپوشان'),
E('Admin ile kalıcı mesajlaşmak için giriş yapın.','Sign in to keep a persistent conversation with the admin.','سجل الدخول للمراسلة الدائمة مع المشرف.','برای گفتگوی پایدار با مدیر وارد شوید.'),
E('Canlı destek mesajlaşma','Live support messaging','مراسلة الدعم المباشر','پیام‌رسانی پشتیبانی زنده'),
E('Geçerli projeye eklemek için tekrar kullanılabilir şekilleri seçin. Örnek projeler “Örneği aç” bölümünde kalır.','Choose reusable shapes to add to the current project. Sample projects remain available under “Open example”.','اختر أشكالاً قابلة لإعادة الاستخدام لإضافتها إلى المشروع الحالي. تبقى المشاريع النموذجية ضمن “فتح المثال”.','شکل‌های قابل استفاده مجدد را برای افزودن به پروژه فعلی انتخاب کنید. پروژه‌های نمونه در بخش «باز کردن نمونه» باقی می‌مانند.'),
E('Seçmek için tıklayın. ⌘/Ctrl-tıklama seçimi değiştirir; Shift-tıklama aralık seçer.','Click to select. ⌘/Ctrl-click toggles selection; Shift-click selects a range.','انقر للتحديد. ⌘/Ctrl يبدّل التحديد وShift يحدد نطاقاً.','برای انتخاب کلیک کنید. ⌘/Ctrl انتخاب را تغییر می‌دهد و Shift یک بازه را انتخاب می‌کند.'),
E('Şekil kütüphanesi kaynakları ve seçim','Shape library sources and selection','مصادر مكتبة الأشكال والتحديد','منابع کتابخانه شکل و انتخاب'),
E('Seçili kütüphane şekilleri','Selected library shapes','أشكال المكتبة المحددة','شکل‌های انتخاب‌شده کتابخانه')
];

const reverse=new Map<string,Entry>();
for(const entry of catalog)for(const value of Object.values(entry))reverse.set(value,entry);

export function localeTag(locale:Locale){return locale==='tr'?'tr-TR':locale==='en'?'en-US':locale==='ar'?'ar': 'fa-IR'}
function dynamic(text:string,locale:Locale){
  let m=text.match(/^(?:Up to|En fazla|حتى|حداکثر) (\d+) (?:seconds?|saniye|ثانية|ثوان|ثانیه)$/);
  if(m){const n=m[1];return locale==='tr'?'En fazla '+n+' saniye':locale==='en'?'Up to '+n+' seconds':locale==='ar'?'حتى '+n+' ثانية':'حداکثر '+n+' ثانیه';}
  m=text.match(/^(?:Up to|En fazla|حتى|حداکثر) (\d+) (?:minutes?|dakika|دقيقة|دقائق|دقیقه)$/);
  if(m){const n=m[1];return locale==='tr'?'En fazla '+n+' dakika':locale==='en'?'Up to '+n+' minute'+(n==='1'?'':'s'):locale==='ar'?'حتى '+n+' دقيقة':'حداکثر '+n+' دقیقه';}
  m=text.match(/^(\d+) (?:açı|angles?|زوايا|زاویه)$/);
  if(m){const n=m[1];return locale==='tr'?n+' açı':locale==='en'?n+' angle'+(n==='1'?'':'s'):locale==='ar'?n+' زوايا':n+' زاویه';}
  m=text.match(/^(\d+) (?:parça seçildi|parts? selected|جزء محدد|أجزاء محددة|قطعه انتخاب شد)$/);
  if(m){const n=m[1];return locale==='tr'?n+' parça seçildi':locale==='en'?n+' part'+(n==='1'?'':'s')+' selected':locale==='ar'?n+' أجزاء محددة':n+' قطعه انتخاب شد';}
  m=text.match(/^(\d+) (?:köşe|vertices|رؤوس|رأس|رأس)$/);
  if(m){const n=m[1];return locale==='tr'?n+' köşe':locale==='en'?n+' vertices':locale==='ar'?n+' رؤوس':n+' رأس';}
  m=text.match(/^(\d+) (?:hak kaldı|credits? left|رصيد متبق|اعتبار باقی مانده)$/);
  if(m){const n=m[1];return locale==='tr'?n+' hak kaldı':locale==='en'?n+' credits left':locale==='ar'?n+' رصيد متبق':n+' اعتبار باقی مانده';}
  m=text.match(/^(?:Lisans:|License:|الترخيص:|مجوز:)\s*(.+)$/);
  if(m){const v=m[1];return locale==='tr'?'Lisans: '+v:locale==='en'?'License: '+v:locale==='ar'?'الترخيص: '+v:'مجوز: '+v;}
  m=text.match(/^(?:Son giriş:|Last sign-in:|آخر تسجيل دخول:|آخرین ورود:)\s*(.+)$/);
  if(m){const v=m[1];return locale==='tr'?'Son giriş: '+v:locale==='en'?'Last sign-in: '+v:locale==='ar'?'آخر تسجيل دخول: '+v:'آخرین ورود: '+v;}
  m=text.match(/^(?:Başlangıç:|Start:|البداية:|شروع:)\s*(.+)$/);
  if(m){const v=m[1];return locale==='tr'?'Başlangıç: '+v:locale==='en'?'Start: '+v:locale==='ar'?'البداية: '+v:'شروع: '+v;}
  m=text.match(/^(?:Bitiş|Expires|الانتهاء|پایان)\s*·\s*(.+)$/);
  if(m){const v=m[1];return locale==='tr'?'Bitiş · '+v:locale==='en'?'Expires · '+v:locale==='ar'?'الانتهاء · '+v:'پایان · '+v;}
  m=text.match(/^(?:Süresi doldu|Expired|منتهي|منقضی)\s*·\s*(.+)$/);
  if(m){const v=m[1];return locale==='tr'?'Süresi doldu · '+v:locale==='en'?'Expired · '+v:locale==='ar'?'منتهي · '+v:'منقضی · '+v;}
  m=text.match(/^(\d+) (?:çevrim içi|online|متصل|آنلاین)$/);
  if(m){const n=m[1];return locale==='tr'?n+' çevrim içi':locale==='en'?n+' online':locale==='ar'?n+' متصل':n+' آنلاین';}
  m=text.match(/^(\d+) (?:şekil seçildi|shapes? selected|أشكال محددة|شکل انتخاب شد)$/);
  if(m){const n=m[1];return locale==='tr'?n+' şekil seçildi':locale==='en'?n+' shape'+(n==='1'?'':'s')+' selected':locale==='ar'?n+' أشكال محددة':n+' شکل انتخاب شد';}
  m=text.match(/^(\d+) (?:kayıtlı|saved|محفوظ|ذخیره‌شده)$/);
  if(m){const n=m[1];return locale==='tr'?n+' kayıtlı':locale==='en'?n+' saved':locale==='ar'?n+' محفوظ':n+' ذخیره‌شده';}
  m=text.match(/^(\d+) (?:delik|holes?|فتحات|حفره)$/);
  if(m){const n=m[1];return locale==='tr'?n+' delik':locale==='en'?n+' hole'+(n==='1'?'':'s'):locale==='ar'?n+' فتحات':n+' حفره';}
  return text;
}
export function translate(locale:Locale,text:string){
  const entry=reverse.get(text);
  return entry?entry[locale]:dynamic(text,locale);
}
type Ctx={locale:Locale;setLocale:(locale:Locale)=>void;t:(text:string)=>string};
const I18nContext=createContext<Ctx>({locale:'tr',setLocale:()=>{},t:text=>text});

export function I18nProvider({children}:{children:ReactNode}){
  const [locale,setLocaleState]=useState<Locale>(()=>{try{const v=localStorage.getItem('serula-locale');return v==='en'||v==='ar'||v==='fa'||v==='tr'?v:'tr'}catch{return'tr'}});
  const apply=useCallback((next:Locale,persist=true)=>{
    setLocaleState(next);
    document.documentElement.lang=next==='fa'?'fa-IR':next;
    document.documentElement.dir=next==='ar'||next==='fa'?'rtl':'ltr';
    try{localStorage.setItem('serula-locale',next)}catch{}
    if(persist)void fetch('/api/preferences',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({locale:next})}).catch(()=>{});
  },[]);
  useEffect(()=>{apply(locale,false)},[]);
  useEffect(()=>{
    let cancelled=false;
    const load=async()=>{try{const r=await fetch('/api/preferences',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;const d=await r.json();const v=d?.locale;if(!cancelled&&(v==='tr'||v==='en'||v==='ar'||v==='fa'))apply(v,false)}catch{}};
    void load();const changed=()=>void load();window.addEventListener('serula-auth-updated',changed);return()=>{cancelled=true;window.removeEventListener('serula-auth-updated',changed)};
  },[apply]);
  const t=useCallback((text:string)=>translate(locale,text),[locale]);
  const value=useMemo(()=>({locale,setLocale:apply,t}),[locale,apply,t]);
  return <I18nContext.Provider value={value}><AutoTranslate locale={locale}/>{children}</I18nContext.Provider>;
}
function AutoTranslate({locale}:{locale:Locale}){
  useEffect(()=>{
    const translateNode=(node:Node)=>{
      if(node.nodeType===Node.TEXT_NODE){
        const raw=node.nodeValue??'',trim=raw.trim();if(!trim)return;
        const out=translate(locale,trim);if(out!==trim)node.nodeValue=raw.replace(trim,out);
        return;
      }
      if(!(node instanceof Element))return;
      if(node.matches('script,style,code,pre,[data-no-i18n]'))return;
      for(const attr of ['title','aria-label','placeholder']){
        const value=node.getAttribute(attr);if(value){const out=translate(locale,value);if(out!==value)node.setAttribute(attr,out);}
      }
      node.childNodes.forEach(translateNode);
    };
    translateNode(document.body);
    const observer=new MutationObserver(records=>records.forEach(record=>{
      if(record.type==='characterData')translateNode(record.target);
      else if(record.type==='attributes')translateNode(record.target);
      else record.addedNodes.forEach(translateNode);
    }));
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});
    return()=>observer.disconnect();
  },[locale]);
  return null;
}
export function useI18n(){return useContext(I18nContext)}
export function LanguageSelect({compact=false}:{compact?:boolean}){
  const {locale,setLocale,t}=useI18n();
  return <label className={'language-select'+(compact?' compact':'')}><span>{compact?'🌐':t('Dil')}</span><select aria-label={t('Varsayılan dil')} value={locale} onChange={e=>setLocale(e.target.value as Locale)}>
    <option value="tr">TR · Türkçe</option><option value="en">EN · English</option><option value="ar">AR · العربية</option><option value="fa">FA · فارسی (ایران)</option>
  </select></label>;
}
