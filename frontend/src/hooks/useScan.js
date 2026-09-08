import { useState, useRef, useCallback } from 'react';
import { startScan, getScan } from '../api/client';

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 60;

export function useScan() {
  const [scanId, setScanId]       = useState(null);
  const [status, setStatus]       = useState('idle'); // idle | starting | running | completed | failed
  const [progress, setProgress]   = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [result, setResult]       = useState(null);
  const [error, setError]         = useState(null);
  const pollRef  = useRef(null);
  const pollCount = useRef(0);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const poll = useCallback(async (id) => {
    pollCount.current += 1;
    if (pollCount.current > MAX_POLLS) {
      stopPolling();
      setStatus('failed');
      setError('Scan timed out. Please try again.');
      return;
    }

    // Update progress message
    const p = pollCount.current;
    if (p < 3)  { setProgress(20); setProgressMsg('Running reconnaissance…'); }
    if (p >= 3) { setProgress(45); setProgressMsg('Running vulnerability scanners…'); }
    if (p >= 6) { setProgress(75); setProgressMsg('Generating AI remediations…'); }

    try {
      const data = await getScan(id);
      if (data.status === 'completed') {
        stopPolling();
        setProgress(100);
        setProgressMsg('Scan complete!');
        setStatus('completed');
        setResult(data);
      } else if (data.status === 'failed') {
        stopPolling();
        setStatus('failed');
        setError(data.error || 'Scan failed.');
      }
    } catch (err) {
      // Network blip — keep polling
    }
  }, []);

  const runScan = useCallback(async (url) => {
    setError(null);
    setResult(null);
    setScanId(null);
    setStatus('starting');
    setProgress(5);
    setProgressMsg('Connecting to target…');
    pollCount.current = 0;

    try {
      const { scanId: id } = await startScan(url);
      setScanId(id);
      setStatus('running');
      setProgress(15);
      setProgressMsg('Fetching target…');
      pollRef.current = setInterval(() => poll(id), POLL_INTERVAL_MS);
    } catch (err) {
      setStatus('failed');
      setError(err.message);
    }
  }, [poll]);

  const reset = useCallback(() => {
    stopPolling();
    setScanId(null);
    setStatus('idle');
    setProgress(0);
    setProgressMsg('');
    setResult(null);
    setError(null);
    pollCount.current = 0;
  }, []);

  return { scanId, status, progress, progressMsg, result, error, runScan, reset };
}
