'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// Dynamically import html5-qrcode to avoid SSR errors
let Html5QrcodeScanner;

function ScanContent() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get('token');

  const [matricNumber, setMatricNumber] = useState('');
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [capturedToken, setCapturedToken] = useState(tokenFromUrl || '');
  const [scannerReady, setScannerReady] = useState(false);
  const [scannerStarted, setScannerStarted] = useState(false);
  const [error, setError] = useState('');

  // Load html5-qrcode dynamically
  useEffect(() => {
    import('html5-qrcode').then((mod) => {
      Html5QrcodeScanner = mod.Html5QrcodeScanner;
      setScannerReady(true);
    });
  }, []);

  // Start camera scanner only if no token in URL
  useEffect(() => {
    if (tokenFromUrl || !scannerReady || scannerStarted) return;

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(
      (decodedText) => {
        try {
          // decodedText = "http://localhost:3000/scan?token=uuid"
          const url = new URL(decodedText);
          const token = url.searchParams.get('token');
          if (token) {
            scanner.clear().catch(() => {});
            setCapturedToken(token);
            toast.success('QR code scanned! Enter your matric number.');
          } else {
            toast.error('Invalid QR code. Use the official attendance QR.');
          }
        } catch {
          toast.error('Could not read QR code. Try again.');
        }
      },
      () => {} // ignore per-frame errors silently
    );

    setScannerStarted(true);

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [tokenFromUrl, scannerReady, scannerStarted]);

  const submitAttendance = async () => {
    if (!matricNumber.trim()) {
      toast.error('Enter your matric number');
      return;
    }
    if (!capturedToken) {
      toast.error('No QR token. Scan the QR code first.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/attendance/scan', {
        qrToken: capturedToken,
        matricNumber: matricNumber.trim().toUpperCase(),
      });
      setResult(data.data);
      setScanned(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Scan failed. Try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // SUCCESS SCREEN
  if (scanned && result) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, background: '#10B981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 36 }}>
            ✓
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', margin: '0 0 8px' }}>Attendance Recorded!</h1>
          <p style={{ color: '#64748B', fontSize: 14, margin: '0 0 28px' }}>
            {result.status === 'late' ? '⚠️ Marked as Late' : '✅ Marked as Present'}
          </p>

          <div style={{ background: '#111827', border: '1px solid #1E2D45', borderRadius: 12, padding: 20, textAlign: 'left' }}>
            {[
              { label: 'Student', value: result.studentName },
              { label: 'Matric No.', value: result.studentMatric },
              { label: 'Course', value: `${result.courseCode} — ${result.courseTitle}` },
              { label: 'Location', value: result.location || 'Not specified' },
              { label: 'Status', value: result.status.toUpperCase(), color: result.status === 'late' ? '#F59E0B' : '#10B981' },
              { label: 'Time', value: new Date(result.scannedAt).toLocaleTimeString('en-NG') },
            ].map((row) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1E2D45' }}>
                <span style={{ color: '#64748B', fontSize: 13 }}>{row.label}</span>
                <span style={{ color: row.color || '#F1F5F9', fontSize: 13, fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}
          </div>

          <p style={{ color: '#334155', fontSize: 12, margin: '20px 0 0' }}>You can close this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', padding: 16 }}>
      <div style={{ maxWidth: 420, margin: '0 auto', paddingTop: 32 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📱</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#F1F5F9', margin: 0 }}>Mark Attendance</h1>
          <p style={{ color: '#64748B', fontSize: 13, margin: '6px 0 0' }}>Gateway ICT Polytechnic</p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: capturedToken ? '#3B82F6' : '#1E2D45' }} />
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: matricNumber ? '#3B82F6' : '#1E2D45' }} />
          <div style={{ flex: 1, height: 3, borderRadius: 2, background: scanned ? '#10B981' : '#1E2D45' }} />
        </div>

        {/* STEP 1: Camera scanner (only if no token from URL) */}
        {!capturedToken && (
          <div style={{ background: '#111827', border: '1px solid #1E2D45', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <p style={{ color: '#64748B', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px' }}>
              Step 1 — Scan QR Code
            </p>
            <div id="qr-reader" style={{ width: '100%' }} />
            <p style={{ color: '#334155', fontSize: 12, margin: '12px 0 0', textAlign: 'center' }}>
              Point your camera at the QR code displayed by your lecturer
            </p>
          </div>
        )}

        {/* Token captured indicator */}
        {capturedToken && (
          <div style={{ background: '#064E3B', border: '1px solid #10B981', borderRadius: 10, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#10B981', fontSize: 18 }}>✓</span>
            <span style={{ color: '#10B981', fontSize: 13, fontWeight: 600 }}>QR code captured successfully</span>
          </div>
        )}

        {/* STEP 2: Matric number input */}
        <div style={{ background: '#111827', border: '1px solid #1E2D45', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {capturedToken ? 'Step 2 — Enter Your Matric Number' : 'Your Matric Number'}
          </label>
          <input
            type="text"
            value={matricNumber}
            onChange={(e) => setMatricNumber(e.target.value.toUpperCase())}
            placeholder="e.g. GIP/ND2/CSC/001"
            style={{ width: '100%', background: '#1A2236', border: '1px solid #1E2D45', borderRadius: 8, padding: '12px', color: '#F1F5F9', fontSize: 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }}
          />
        </div>

        {/* Error message */}
        {error && (
          <div style={{ background: '#450A0A', border: '1px solid #EF4444', borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>⚠️ {error}</p>
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={submitAttendance}
          disabled={loading || !capturedToken || !matricNumber.trim()}
          style={{
            width: '100%',
            background: (!capturedToken || !matricNumber.trim()) ? '#1E2D45' : loading ? '#1E40AF' : '#3B82F6',
            border: 'none',
            borderRadius: 10,
            padding: '14px',
            color: (!capturedToken || !matricNumber.trim()) ? '#64748B' : 'white',
            fontSize: 16,
            fontWeight: 700,
            cursor: (!capturedToken || !matricNumber.trim() || loading) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {loading ? (
            <>
              <div style={{ width: 18, height: 18, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Recording...
            </>
          ) : '✓ Mark My Attendance'}
        </button>

        <p style={{ color: '#334155', fontSize: 12, textAlign: 'center', margin: '16px 0 0' }}>
          Your attendance is recorded against your matric number
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #3B82F6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#64748B', fontSize: 14 }}>Loading scanner...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <ScanContent />
    </Suspense>
  );
}
