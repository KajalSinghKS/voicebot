import React, { useState, useEffect, useRef, useCallback } from 'react';

function VoiceBot() {
  const [isRecording, setIsRecording] = useState(false);
  const [latestMessage, setLatestMessage] = useState('');

  const recognitionRef = useRef(null);
  const socketRef = useRef(null);
  const voicesRef = useRef([]);
  const isSpeakingRef = useRef(false);
  const isRecognizingRef = useRef(false);
  const transcriptRef = useRef('');

  const micStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const micMonitorIntervalRef = useRef(null);

  const speechStartTimeRef = useRef(null);
  const volumeHistoryRef = useRef([]);

  const sanitizeText = (text) =>
    text.replace(/[^a-zA-Z0-9\u0900-\u097F .,?!]/g, '');

  const speakText = useCallback((text) => {
    if (!text) return;

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    const cleanText = sanitizeText(text);
    const isHindi = /[\u0900-\u097F]/.test(cleanText);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = isHindi ? 'hi-IN' : 'en-US';

    const voices = voicesRef.current;
    const matchingVoice = voices.find(v =>
      isHindi
        ? v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi')
        : v.lang.startsWith('en') || v.name.toLowerCase().includes('english')
    );
    utterance.voice = matchingVoice || voices[0];

    utterance.onstart = () => { isSpeakingRef.current = true; };
    utterance.onend = () => { isSpeakingRef.current = false; };

    window.speechSynthesis.speak(utterance);
  }, []);

  const initRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not supported in this browser.');
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      console.log('Speech recognition started');
      isRecognizingRef.current = true;
    };
    recognitionRef.current.onerror = (e) => {
      console.error('Speech recognition error:', e);
      setTimeout(restartRecognition, 300);
    };
    recognitionRef.current.onend = () => {
      console.log('Speech recognition ended');
      isRecognizingRef.current = false;
      setTimeout(restartRecognition, 300);
    };

    recognitionRef.current.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          transcriptRef.current += result[0].transcript;
          const cleanInput = sanitizeText(transcriptRef.current.trim());

          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ text: cleanInput }));
          }

          transcriptRef.current = '';
        } else {
          interimTranscript += result[0].transcript;
        }
      }
    };
  }, []);

  const restartRecognition = () => {
    if (recognitionRef.current && !isRecognizingRef.current) {
      try {
        recognitionRef.current.abort();
        recognitionRef.current.start();
      } catch (err) {
        console.error('Restart error:', err);
      }
    }
  };

const startMicMonitor = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micStreamRef.current = stream;

    audioContextRef.current = new AudioContext();
    const source = audioContextRef.current.createMediaStreamSource(stream);
    analyserRef.current = audioContextRef.current.createAnalyser();
    source.connect(analyserRef.current);
    analyserRef.current.fftSize = 512;

    const bufferLength = analyserRef.current.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength);

    let cooldown = false;
    micMonitorIntervalRef.current = setInterval(() => {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      const rms = Math.sqrt(
        dataArrayRef.current.reduce((sum, val) => sum + val * val, 0) / bufferLength
      );

      if (rms < 8) return; // 🧱 Ignore very soft ambient noise

      const smoothedVolume = Math.max(0, Math.log10(rms + 1) * 20);

      if (smoothedVolume > 42 && !speechStartTimeRef.current) {
        speechStartTimeRef.current = Date.now();
      }

      if (smoothedVolume > 48 && isSpeakingRef.current && !cooldown) {
        window.speechSynthesis.cancel();
        isSpeakingRef.current = false;
        cooldown = true;
        setTimeout(() => { cooldown = false; }, 1500);
        speechStartTimeRef.current = null;
        return;
      }

      const history = volumeHistoryRef.current;
      history.push(smoothedVolume);
      if (history.length > 30) history.shift();

      const avgVolume = history.reduce((a, b) => a + b, 0) / history.length;
      const speakingDuration = Date.now() - (speechStartTimeRef.current || 0);

      if (
        avgVolume > 35 &&
        speakingDuration > 1000 &&
        isSpeakingRef.current &&
        !cooldown
      ) {
        window.speechSynthesis.cancel();
        isSpeakingRef.current = false;
        cooldown = true;
        setTimeout(() => { cooldown = false; }, 1500);
        speechStartTimeRef.current = null;
      }

      // Reset timer if user stops speaking
      if (avgVolume < 20 && speechStartTimeRef.current) {
        speechStartTimeRef.current = null;
      }
    }, 100);
  } catch (err) {
    console.error('Mic monitor error:', err);
  }
};

  const stopMicMonitor = () => {
    if (micMonitorIntervalRef.current) clearInterval(micMonitorIntervalRef.current);
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach(track => track.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    micStreamRef.current = null;
    audioContextRef.current = null;
    micMonitorIntervalRef.current = null;
  };

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length) voicesRef.current = voices;
      else setTimeout(loadVoices, 100);
    };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  useEffect(() => {
    initRecognition();

    if (isRecording) {
      startMicMonitor();

      socketRef.current = new WebSocket('ws://localhost:8080');

      socketRef.current.onopen = () => {
        socketRef.current.send(JSON.stringify({ action: 'start' }));
        socketRef.current.onmessage = (event) => {
          const reply = sanitizeText(event.data);
          setLatestMessage(`🤖 ${reply}`);
          speakText(reply);
        };
      };

      recognitionRef.current.start();
    } else {
      stopMicMonitor();
      window.speechSynthesis.cancel();
      if (socketRef.current) {
        socketRef.current.send(JSON.stringify({ action: 'stop' }));
        socketRef.current.close();
        socketRef.current = null;
      }
      if (recognitionRef.current) recognitionRef.current.stop();
    }

    return () => {
      stopMicMonitor();
      window.speechSynthesis.cancel();
      if (socketRef.current) socketRef.current.close();
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [isRecording, initRecognition, speakText]);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <button
        onClick={() => setIsRecording(prev => !prev)}
        style={{ padding: '10px 20px', fontSize: '16px' }}
      >
        {isRecording ? '🛑 Stop Recording' : '🎙️ Start Recording'}
      </button>

      <div style={{ marginTop: '30px' }}>
        <h3>Latest Message:</h3>
        <p style={{ fontSize: '18px' }}>{latestMessage}</p>
      </div>
    </div>
  );
}

export default VoiceBot;