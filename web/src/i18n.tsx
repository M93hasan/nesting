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
E('Rotate by, degrees','Döndürme açısı, derece','زاوية الدوران، درجة','زاویه چرخش، درجه'),
E('Rotate','Döndür','تدوير','چرخاندن'),
E('Aspect ratio locked','En-boy oranı kilitli','نسبة الأبعاد مقفلة','نسبت ابعاد قفل است'),
E('Resizing and rotation change every copy of this shape; aspect ratio is locked.','Boyutlandırma ve döndürme bu şeklin tüm kopyalarını değiştirir; en-boy oranı kilitlidir.','تغيير الحجم والدوران يؤثران في كل نسخ هذا الشكل؛ نسبة الأبعاد مقفلة.','تغییر اندازه و چرخش روی همه کپی‌های این شکل اعمال می‌شود؛ نسبت ابعاد قفل است.'),
E('Hold Alt to bypass. Numeric fields stay exact.','Geçici olarak kapatmak için Alt tuşunu basılı tutun. Sayısal alanlar tam değerini korur.','اضغط Alt لتجاوز الالتقاط مؤقتاً. الحقول الرقمية تبقى دقيقة.','برای عبور موقت Alt را نگه دارید. فیلدهای عددی دقیق می‌مانند.'),
E('Live search · overlapping areas shown in red.','Canlı arama · çakışan alanlar kırmızı gösterilir.','بحث مباشر · مناطق التداخل تظهر بالأحمر.','جستجوی زنده · نواحی همپوشان قرمز نمایش داده می‌شوند.'),
E('Geometry checked.','Geometri doğrulandı.','تم التحقق من الهندسة.','هندسه بررسی شد.'),
E('Preparing search…','Arama hazırlanıyor…','جارٍ تجهيز البحث…','در حال آماده‌سازی جستجو…'),
E('Select a copy to adjust it. Drag to arrange.','Düzenlemek için bir kopya seçin. Yerleştirmek için sürükleyin.','اختر نسخة لتعديلها واسحبها للترتيب.','برای تنظیم یک کپی را انتخاب و برای چیدمان بکشید.'),
E('Live search','Canlı arama','بحث مباشر','جستجوی زنده'),
E('Best valid length','En iyi geçerli uzunluk','أفضل طول صالح','بهترین طول معتبر'),
E('Checking inputs','Girdiler kontrol ediliyor','جارٍ فحص المدخلات','در حال بررسی ورودی‌ها'),
E('Loading example…','Örnek yükleniyor…','جارٍ تحميل المثال…','در حال بارگذاری نمونه…'),
E('Skip to compression','Sıkıştırmaya geç','الانتقال إلى الضغط','رفتن به فشرده‌سازی'),
E('End exploration and refine the best layout.','Keşfi bitir ve en iyi yerleşimi sıkıştır.','إنهاء الاستكشاف وتحسين أفضل ترتيب.','کاوش را پایان دهید و بهترین چیدمان را فشرده کنید.'),
E('Enter a whole number from 0 to 500.','0 ile 500 arasında bir tam sayı girin.','أدخل عدداً صحيحاً من 0 إلى 500.','یک عدد صحیح بین ۰ تا ۵۰۰ وارد کنید.'),
E('This drawing exceeds the 500-copy limit. Reduce quantities to continue.','Bu çizim 500 kopya sınırını aşıyor. Devam etmek için adetleri azaltın.','هذا الرسم يتجاوز حد 500 نسخة. قلل الكميات للمتابعة.','این طرح از محدودیت ۵۰۰ کپی بیشتر است. برای ادامه تعداد را کاهش دهید.'),
E('Enter zero or a positive clearance smaller than the material width.','Sıfır veya malzeme genişliğinden küçük pozitif bir parça aralığı girin.','أدخل صفراً أو مسافة موجبة أصغر من عرض المادة.','صفر یا فاصله مثبت کوچکتر از عرض ماده وارد کنید.'),
E('Good layouts sooner. A greedier search that may miss the best final layout.','İyi yerleşimleri daha hızlı bulur; en iyi nihai yerleşimi kaçırabilir.','يعثر على ترتيبات جيدة أسرع وقد يفوّت أفضل ترتيب نهائي.','چیدمان‌های خوب را سریع‌تر پیدا می‌کند اما ممکن است بهترین نتیجه نهایی را از دست بدهد.'),
E('A more thorough search for the best final layout.','En iyi nihai yerleşim için daha kapsamlı arama yapar.','بحث أعمق للوصول إلى أفضل ترتيب نهائي.','جستجوی دقیق‌تر برای بهترین چیدمان نهایی.'),
E('Project files restore a complete job. Drawing files can be added as shapes.','Proje dosyaları tüm işi geri yükler. Çizim dosyaları şekil olarak eklenebilir.','ملفات المشروع تستعيد العمل كاملاً ويمكن إضافة ملفات الرسم كأشكال.','فایل پروژه کل کار را بازیابی می‌کند و فایل‌های رسم را می‌توان به عنوان شکل افزود.'),
E('SVG, DXF and instance JSON add shapes. A saved project restores a complete job.','SVG, DXF ve instance JSON şekil ekler. Kaydedilmiş proje tüm işi geri yükler.','تضيف ملفات SVG وDXF وJSON أشكالاً؛ المشروع المحفوظ يستعيد العمل كاملاً.','SVG، DXF و JSON نمونه شکل اضافه می‌کنند؛ پروژه ذخیره‌شده کل کار را بازیابی می‌کند.'),
E('Physical SVG dimensions and recognized DXF units are honored. Instance JSON and drawings without units use the selected scale.','Fiziksel SVG ölçüleri ve tanınan DXF birimleri korunur. Birimsiz çizimler seçilen ölçeği kullanır.','تُحترم أبعاد SVG ووحدات DXF المعروفة؛ الرسومات بلا وحدات تستخدم المقياس المحدد.','ابعاد واقعی SVG و واحدهای شناخته‌شده DXF حفظ می‌شوند؛ طرح‌های بدون واحد از مقیاس انتخابی استفاده می‌کنند.'),
E('Preview outdated.','Önizleme güncel değil.','المعاينة قديمة.','پیش‌نمایش قدیمی است.'),
E('These contours cannot be imported:','Bu konturlar içe aktarılamaz:','لا يمكن استيراد هذه المسارات:','این کانتورها قابل ورود نیستند:'),
E('Exclude the listed invalid contours','Listelenen geçersiz konturları hariç tut','استبعاد المسارات غير الصالحة المدرجة','کانتورهای نامعتبر فهرست‌شده را حذف کن'),
E('Open as new project','Yeni proje olarak aç','فتح كمشروع جديد','باز کردن به عنوان پروژه جدید'),
E('Click each vertex in the canvas. Enter closes the polygon; Escape cancels. The contour is checked before it is added.','Tuvalde her köşeye tıklayın. Enter çokgeni kapatır; Escape iptal eder. Kontur eklenmeden önce kontrol edilir.','انقر كل رأس على اللوحة. Enter يغلق المضلع وEscape يلغي. يتم فحص المسار قبل إضافته.','روی هر رأس در بوم کلیک کنید. Enter چندضلعی را می‌بندد و Escape لغو می‌کند. کانتور پیش از افزودن بررسی می‌شود.'),
E('Start drawing','Çizime başla','ابدأ الرسم','شروع رسم')
];

const reverse=new Map<string,Entry>();
for(const entry of catalog)for(const value of Object.values(entry))reverse.set(value,entry);

function dynamic(text:string,locale:Locale){
  let m=text.match(/^Up to (\d+) seconds$/);
  if(m){const n=m[1];return locale==='tr'?'En fazla '+n+' saniye':locale==='en'?text:locale==='ar'?'حتى '+n+' ثانية':'حداکثر '+n+' ثانیه';}
  m=text.match(/^Up to (\d+) minutes?$/);
  if(m){const n=m[1];return locale==='tr'?'En fazla '+n+' dakika':locale==='en'?text:locale==='ar'?'حتى '+n+' دقيقة':'حداکثر '+n+' دقیقه';}
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
