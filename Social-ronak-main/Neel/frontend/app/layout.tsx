import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Social Pivot',
    description: 'AI-Powered Social Media Management',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={inter.className + " bg-background text-white"}>
                {children}
                <Toaster position="bottom-right" toastOptions={{
                    style: {
                        background: '#333',
                        color: '#fff',
                    }
                }} />
            </body>
        </html>
    );
}
