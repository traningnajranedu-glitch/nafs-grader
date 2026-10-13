import type { ReactNode } from 'react';
import './globals.css';
export const metadata={title:'المصحح الآلي لاختبارات نافس',description:'إدارة الاختبارات والتصحيح وتحليل النتائج'};
export default function RootLayout({children}:{children:ReactNode}){return <html lang="ar" dir="rtl"><body>{children}</body></html>}
