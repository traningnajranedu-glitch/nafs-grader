# المصحح الآلي لاختبار نافس

Next.js + Supabase. مشروع قاعدة البيانات: `erqsricplegkowugkgwk`.

## طريقة العمل
1. أنشئ الاختبار في حساب مدير النظام واختر «جميع المواد» لإنشاء اختبار موحد للمواد الثلاث. الاسم المعتمد لمادة القراءة هو «لغتي».
2. افتح «نموذج الإجابة الصحيحة»، واختر الإجابات مباشرة بالضغط على دوائر عمود المادة. يظلّل النظام الخيارات تلقائيًا. بعد مراجعة الأسئلة المختارة لكل مادة، اضغط «حفظ واعتماد الإجابات الصحيحة». يتاح تنزيل النموذج المظلل PDF، كما يبقى استيراد PDF أو Excel خيارًا بديلًا.
3. تطبع المدرسة أوراق الطلاب من صفحة الطباعة. الأوراق الجديدة تحمل QR يتضمن الاسم والسجل والمدرسة والجنس والمرحلة والصف ومواضع دوائر الإجابة.
4. افتح «تصحيح الاختبار» وارفع PDF واحدًا لجميع طلاب المدرسة. تُقرأ جميع الصفحات تلقائيًا، ويُختار الاختبار تلقائيًا عند وجود اختبار معتمد واحد مطابق.
5. راجع الحالات المعلقة، ثم اعتمد الأوراق الجاهزة وصدّر النتائج.

المادة الواحدة تدعم 20 سؤالًا. الاستيراد حتى 250 صفحة وحجم 50 ميجابايت. لا تُحفظ صور الأوراق على الخادم؛ تُحفظ النتائج وبيانات المراجعة. المعالجة داخل المتصفح، وOCR للأوراق السابقة يحتاج تنزيل ملفات لغة عربية وإنجليزية عند الاستخدام الأول.

قراءة الأوراق السابقة تستخدم الباركود وOCR والتعرف على الدوائر؛ بياناتها تستلزم تأكيدًا يدويًا. الغموض وتعدد التظليل يوقفان اعتماد الورقة، والسؤال الفارغ يُحسب بصفر. لا يسمح بتكرار نتيجة الطالب والاختبار.

## التحقق
`npm test` يغطي عتبات التظليل، QR عربي، المحاذاة، ميل الورقة، اكتشاف دوائر النموذج السابق، وPDF من صفحتين باستخدام صور مصطنعة. `npm run build` يتحقق من البناء والأنواع. يلزم تقييم عينات فعلية قبل اعتماد دقة المحرك.

لا تضع مفاتيح سرية أو بيانات طلاب حقيقية في المستودع.

في الاختبار الموحد يظهر نموذج واحد بثلاثة أعمدة، والتحديد مباشرة داخل الدوائر. الأرقام الداخلية للمفتاح: 1–20 لغتي، 21–40 الرياضيات، 41–60 العلوم؛ الواجهة تعرض 1–20 داخل كل مادة. يمكن اعتماد أي عدد من الأسئلة المختارة لكل مادة. الضغط الثاني يلغي التظليل، والخانات غير المحددة لا تُحفظ في المفتاح ولا تدخل في التصحيح. يظهر تقرير للمراجعة والتأكيد والطباعة قبل الاعتماد وبعده.

### Student online answer sheet

- Public student entry: `/student`, using a registered 10-digit civil ID.
- Admin: **الإجابة الإلكترونية** → select an approved global exam → import the school roster → open online answering. Roster import creates students only, with no submissions.
- Students see only approved question numbers; correct options and scores remain on the server. Click a bubble again to clear it. Confirmation explicitly counts unanswered questions before final submission.
- The Supabase `student-exam` Edge Function authenticates civil-ID entry, then uses an expiring random session capability for reading and submitting. Only the function's service role can call `student_exam_gateway`; student tables and answer keys remain protected by existing RLS.
- Answers are graded atomically, cannot be submitted twice, and appear in the admin results under `source=online`. Disable `online_enabled`, close, or delete the exam to stop access.
- Civil-ID-only entry is the requested identification method; it does not establish possession of the student's identity.
- Database setup: `database/student-online.sql`. Edge deployment: `supabase/functions/student-exam/index.ts` and `deno.json`, JWT verification disabled because this endpoint implements its own entry/session validation. No server key is shipped to the browser.

### Automatic enrollment from school imports

`/sheets` now saves each valid school Excel roster through the insert-only `school-roster` Edge Function immediately after import. PDF issuance is optional and remains separately logged. Existing identities are never overwritten or moved by the public workflow; discrepancies require the system admin. Online answer sheets are generated on entry from the approved, enabled exam.

Historical print logs saved only school metadata and sheet counts, not student names/IDs or source Excel files. Schools must reimport their original roster once to enroll those students. The admin online page shows live school roster coverage; it does not claim complete recovery from print totals. Database: `database/school-roster.sql`; rollback integration checks: `tests/school-roster.sql`.


## البلاغات والدعم الفني

- أيقونة الخدمة أعلى `/sheets`؛ يتطلب رفع البلاغ اختيار المدرسة والجنس والمرحلة من القوائم.
- يدخل رافع البلاغ اسمه ورقم واتساب وعنوان البلاغ وتفاصيله، مع مرفق PNG/JPG/PDF اختياري حتى 5 ميجابايت.
- تُحفظ رموز متابعة البلاغات في المتصفح، ويمكن استعادة البلاغ من جهاز آخر باستخدام رمزه الخاص. اختيار المدرسة وحده لا يمنح الاطلاع على بلاغاتها.
- تعرض صفحة مدير النظام `/workspace?tab=support` الحالات والأولويات والردود والملاحظات الداخلية والحلول والتقييمات، مع فلاتر وتحديث دوري.
- زر واتساب يفتح رسالة قابلة للمراجعة في `wa.me`؛ الإرسال يدوي من واتساب.
- قاعدة البيانات: `database/school-support.sql`، وواجهة الخادم: `supabase/functions/school-support`. لا يملك المتصفح وصولًا مباشرًا إلى جداول البلاغات أو المرفقات الخاصة.
- التحقق: `npm run test:support` لاختبارات المرفقات وخصوصية الردود، و`tests/support.sql` لاختبار دورة البلاغ داخل معاملة تُلغى في نهايتها.


## إعدادات تصحيح نافس - ثالث ابتدائي (اعتماد 2026-10-23)

- ملفات المصدر: Google Drive folder `1cotd9Fm4nvLR9RBqwHSVou6gqgNNcaiC` (المستهدف 150 PDF / 8008 صفحات).
- وجهة النتائج: `نتائج ثالث ابتدائي` Google Drive folder `16hQnpG5q1sBlO03Qj3X0MkNogwSQ-fXR`، ملف Excel مستقل لكل مدرسة.
- نموذج الإجابة المعتمد هو PDF المرفق في محادثة 2026-10-23؛ **لغتي** الأسئلة 1-10 و**الرياضيات** الأسئلة 1-10 فقط. العلوم مستبعدة. الدرجة القصوى 20 (10 لكل مادة). يجب إدخال المفتاح والتحقق منه من الأصل قبل بدء التصحيح، وعدم استنتاج إجابات للأسئلة 11-20.
- الجنس من **بيانات المدرسة فقط**، ولا يستنتج من اسم الطالب. إذا لم يتأكد من بيانات المدرسة يظل `غير معروفة`.
- لا تعتمد الدرجات غير المؤكدة، وتُراجع جودة قراءة التظليل على عينة فعلية قبل تشغيل دفعة الـ8008 ورقة. لا تخلط النتائج مع سادس ابتدائي.
- هذا توثيق للإعدادات المعتمدة، **وليس** إثباتًا بأن المعالجة أو تصدير النتائج قد تم.


### معايير إضافية معتمدة لتصحيح ثالث ابتدائي (2026-10-23)

- إجابة واحدة واضحة فقط تُقبل إذا طابقت المفتاح.
- أي اختيارين أو أكثر للسؤال الواحد = خطأ (صفر) حتى لو كان أحدهما صحيحًا.
- التظليل الخفيف = خطأ (صفر)، وكذلك السؤال غير المظلل.
- تختلف تصاميم ومقاييس أوراق المدارس عن نموذج مفتاح الإجابة؛ لا تستخدم إحداثيات ثابتة مستمدة من المفتاح. اكتشف مناطق الإجابة لكل تخطيط، صحح الميل والمنظور، وعاير أحجام/مراكز الدوائر والعتبات حسب نموذج الورقة، مع التحقق من دقة تعيين رقم السؤال والمادة.
- إذا تعذر تحديد هندسة الورقة أو مواضع الأسئلة بثقة، تُعلّق الورقة للمراجعة ولا تُختلق درجات.
- يجب اختبار هذه القواعد على أوراق فعلية متنوعة قبل اعتماد نتائج الدفعة. تُطبّق قراءة الشبكة المتغيرة وكشف التظليل المتعدد في المحرك المحدّث. تبقى الحالات غير المؤكدة للمراجعة، ولا تعني قراءة الشبكة اعتماد النتيجة.


## تحديث محرك الشبكة المطبوعة (2026-10-25)

- اكتشاف حجم الدوائر من الصورة نفسها، وتجميع 12 عمودًا و20 صفًا مع مراعاة الفواصل بعد كل خمسة أسئلة.
- تقدير الميل بتصويت الجيران، ثم ملاءمة خطوط الصفوف والأعمدة. استعادة الدائرة التي اندمجت مع التظليل مشروطة بوجود حبر محيطها في الصورة، وليست اعتمادًا على إحداثيات ثابتة.
- معايرة أثر حروف الخيارات لكل مادة، وتشديد كشف الاختيار الثاني وآثار المحو. تبقى الحالات الملتبسة `uncertain` أو `multiple` ولا تتجاوز شرط مراجعة الاعتماد.
- مقارنة محلية على 30 صفحة فعلية من ثلاثة ملفات: اكتشاف الشبكة 3/30 قبل الإصلاح و27/30 بعده. هذه نسبة نجاح تحديد الهندسة وليست نسبة دقة الدرجات. الصفحات الثلاث المرفوضة تبقى للمراجعة.
- تدقيق بصري لـ190 موضع سؤال فعّال في ثماني صفحات: 177 قراءة واضحة مطابقة، و12 حالة محالة للمراجعة، وسؤال فارغ. لم تُعتمد بقية الدفعة بهذا الاختبار.
- `tests/adaptive-grid.test.cjs` يغطي المقاسات، الميل، الشبكات ذات الفواصل، الورقة الفارغة، رفض صف مفقود، والتظليل الثانوي. لا تُضمّن أوراق الطلاب أو بياناتهم في المستودع.

