import type { ReactNode } from 'react';
export const metadata = {title:'المصحح الآلي لاختبارات نافس',description:'إدارة وتصحيح الاختبارات وتحليل النتائج'};
export default function RootLayout({children}:{children:ReactNode}) {return <html lang="ar" dir="rtl"><body style={{fontFamily:'Tahoma,Arial,sans-serif',margin:0,background:'#f5f7fa'}}>{children}</body></html>}
