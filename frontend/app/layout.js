import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata = {
  title: 'QR Attendance System — Gateway ICT Polytechnic',
  description: 'Attendance Management System Using QR Code',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1A2236',
              color: '#F1F5F9',
              border: '1px solid #1E2D45',
              borderRadius: '8px',
            },
            success: { iconTheme: { primary: '#10B981', secondary: '#F1F5F9' } },
            error: { iconTheme: { primary: '#EF4444', secondary: '#F1F5F9' } },
          }}
        />
      </body>
    </html>
  );
}
