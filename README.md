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
