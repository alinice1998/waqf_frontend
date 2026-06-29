/**
 * Miqat - Cloud-Only Frontend Application Logic
 * No local server required.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const surahSelect = document.getElementById('surah-select');
    const recitationSelect = document.getElementById('recitation-select');
    const methodSelect = document.getElementById('method-select');
    const ayahIdInput = document.getElementById('ayah-id');
    const apiUrlInput = document.getElementById('api-url');
    const waqfThresholdInput = document.getElementById('waqf-threshold');
    const realSilenceThresholdInput = document.getElementById('real-silence-threshold');
    const silenceSensitivityInput = document.getElementById('silence-sensitivity');
    const silenceSensitivityVal = document.getElementById('silence-sensitivity-val');
    const silenceEngineSelect = document.getElementById('silence-engine-select');
    const silenceSensitivityContainer = document.getElementById('silence-sensitivity-container');
    const uploadZone = document.getElementById('upload-zone');
    const audioUpload = document.getElementById('audio-upload');
    const processBtn = document.getElementById('process-btn');
    const syncFileBtn = document.getElementById('sync-file-btn');
    const syncFileUpload = document.getElementById('sync-file-upload');
    const quranContent = document.getElementById('quran-content');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingTitle = document.getElementById('loading-title');
    const loadingDesc = document.getElementById('loading-desc');
    const audioPlayerContainer = document.getElementById('audio-player-container');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const currentTimeEl = document.getElementById('current-time');
    const durationEl = document.getElementById('duration');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const topPlayPauseBtn = document.getElementById('top-play-pause-btn');
    const wordActionMenu = document.getElementById('word-action-menu');
    const wamWordText = document.getElementById('wam-word-text');
    const wamClose = document.getElementById('wam-close');
    const wamPlayWord = document.getElementById('wam-play-word');
    const wamShowWordTime = document.getElementById('wam-show-word-time');
    const wamWordTimeVal = document.getElementById('wam-word-time-val');
    const wamPlayAyah = document.getElementById('wam-play-ayah');
    const wamShowAyahTime = document.getElementById('wam-show-ayah-time');
    const wamAyahTimeVal = document.getElementById('wam-ayah-time-val');
    const wamEditTiming = document.getElementById('wam-edit-timing');

    // Editor UI Elements
    const timingEditorBar = document.getElementById('timing-editor-bar');
    const editorTypeLabel = document.getElementById('editor-type-label');
    const editorText = document.getElementById('editor-text');
    const editorStartTime = document.getElementById('editor-start-time');
    const editorEndTime = document.getElementById('editor-end-time');
    const editorPlayBtn = document.getElementById('editor-play-btn');
    const editorSaveBtn = document.getElementById('editor-save-btn');
    const editorCloseBtn = document.getElementById('editor-close-btn');
    const editorNextBtn = document.getElementById('editor-next-btn');
    const editorPrevBtn = document.getElementById('editor-prev-btn');

    // Export UI Elements
    const exportContainer = document.getElementById('export-container');
    const exportJsonBtn = document.getElementById('export-json');
    const exportSrtBtn = document.getElementById('export-srt');
    const exportVttBtn = document.getElementById('export-vtt');

    let editorModeAyah = false;
    let editorCurrentIndex = -1;

    const playerProgressBar = document.getElementById('player-progress');

    let wavesurfer;
    let alignments = [];
    let originalAlignments = [];
    let audioSilences = [];
    let surahData = [];
    let quranData = { hafsh: null, warsh: null };
    let customReferenceText = null;
    let selectedFile = null;
    let currentSelectedWordIdx = -1;
    let currentSelectedWordElement = null;
    let preciseAudioCtx = null;
    let preciseSourceNode = null;

    // --- Initialization ---
    initSurahs();

    // --- Zoom Logic ---
    let currentFontSize = window.innerWidth >= 768 ? 48 : 36;
    if (zoomInBtn && zoomOutBtn) {
        zoomInBtn.onclick = () => {
            currentFontSize += 4;
            if (currentFontSize > 80) currentFontSize = 80;
            quranContent.style.fontSize = `${currentFontSize}px`;
        };
        zoomOutBtn.onclick = () => {
            currentFontSize -= 4;
            if (currentFontSize < 20) currentFontSize = 20;
            quranContent.style.fontSize = `${currentFontSize}px`;
        };
    }

    // --- Wavesurfer Initialization ---
    const initWavesurfer = (url) => {
        if (wavesurfer) wavesurfer.destroy();

        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: 'rgba(255, 255, 255, 0.1)',
            progressColor: '#f59e0b',
            cursorColor: '#f59e0b',
            barWidth: 2,
            barGap: 3,
            barRadius: 4,
            height: 50,
            normalize: true,
        });

        wavesurfer.load(url);

        wavesurfer.on('ready', () => {
            durationEl.textContent = formatTime(wavesurfer.getDuration());
            audioPlayerContainer.classList.remove('hidden');
            if (topPlayPauseBtn) topPlayPauseBtn.classList.remove('hidden');
        });

        playPauseBtn.onclick = () => wavesurfer.playPause();
        if (topPlayPauseBtn) topPlayPauseBtn.onclick = () => wavesurfer.playPause();
        
        wavesurfer.on('play', () => { 
            updatePlayIcon(true);
            startSyncLoop();
        });
        wavesurfer.on('pause', () => { 
            updatePlayIcon(false);
            stopSyncLoop();
        });
        wavesurfer.on('finish', () => {
            stopSyncLoop();
            updatePlayIcon(false);
            const wordElements = document.querySelectorAll('.quran-word');
            wordElements.forEach(el => el.classList.remove('active'));
            lastHighlightedIdx = -1;
            playerProgressBar.style.width = '0%';
        });

        wavesurfer.on('timeupdate', (time) => {
            const duration = wavesurfer.getDuration();
            const percent = (time / duration) * 100;
            playerProgressBar.style.width = `${percent}%`;
            currentTimeEl.textContent = formatTime(time);
        });
    };

    function updatePlayIcon(isPlaying) {
        const icon = document.getElementById('play-icon');
        const topIcon = document.getElementById('top-play-icon');
        
        if (isPlaying) {
            if (icon) icon.setAttribute('data-lucide', 'pause');
            if (topIcon) topIcon.setAttribute('data-lucide', 'pause');
        } else {
            if (icon) icon.setAttribute('data-lucide', 'play');
            if (topIcon) topIcon.setAttribute('data-lucide', 'play');
        }
        lucide.createIcons();
    }

    // --- Data Loading ---
    async function initSurahs() {
        try {
            const response = await fetch('data/surahs.json');
            surahData = await response.json();
            
            surahSelect.innerHTML = '<option value="">اختر السورة...</option>';
            surahData.forEach(surah => {
                const option = document.createElement('option');
                option.value = surah.number;
                option.textContent = `${surah.number}. ${surah.nameArabic} (${surah.nameEnglish})`;
                surahSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading surahs:', error);
            surahSelect.innerHTML = '<option value="">خطأ في تحميل البيانات</option>';
        }
    }

    async function ensureQuranData(recitation) {
        if (quranData[recitation]) return true;
        
        try {
            const response = await fetch(`data/quran_${recitation}.json`);
            quranData[recitation] = await response.json();
            
            return true;
        } catch (error) {
            console.error(`Error loading ${recitation} data:`, error);
            alert('فشل في تحميل نص القرآن. تأكد من وجود ملفات JSON في مجلد data.');
            return false;
        }
    }

    surahSelect.addEventListener('change', async () => {
        if (surahSelect.value) {
            loadSurahContent(surahSelect.value, recitationSelect.value);
        }
    });

    recitationSelect.addEventListener('change', () => {
        if (surahSelect.value) {
            loadSurahContent(surahSelect.value, recitationSelect.value);
        }
    });

    if (waqfThresholdInput) {
        waqfThresholdInput.addEventListener('change', () => {
            if (alignments && alignments.length > 0) {
                regroupByWaqf();
            }
        });
    }

    const silenceDetectionMethod = document.getElementById('silence-detection-method');
    if (silenceDetectionMethod) {
        silenceDetectionMethod.addEventListener('change', () => {
            if (alignments && alignments.length > 0) {
                regroupByWaqf();
            }
        });
    }

    const whisperTimingSource = document.getElementById('whisper-timing-source');
    if (whisperTimingSource) {
        whisperTimingSource.addEventListener('change', () => {
            if (alignments && alignments.length > 0) {
                regroupByWaqf();
            }
        });
    }

    const realSilenceThreshold = document.getElementById('real-silence-threshold');
    if (realSilenceThreshold) {
        realSilenceThreshold.addEventListener('change', () => {
            if (alignments && alignments.length > 0) {
                regroupByWaqf();
            }
        });
    }

    if (silenceSensitivityInput && silenceSensitivityVal) {
        silenceSensitivityInput.addEventListener('input', (e) => {
            silenceSensitivityVal.textContent = e.target.value + '%';
        });
    }

    if (silenceEngineSelect && silenceSensitivityContainer) {
        silenceEngineSelect.addEventListener('change', () => {
            if (silenceEngineSelect.value === 'silero') {
                silenceSensitivityContainer.classList.add('hidden');
            } else {
                silenceSensitivityContainer.classList.remove('hidden');
            }
        });
    }

    async function loadSurahContent(surahId, recitation) {
        customReferenceText = null; // Reset custom text on surah change
        if (!await ensureQuranData(recitation)) return;
        
        const ayahsText = quranData[recitation][surahId];
        if (!ayahsText) {
            console.error('Surah data not found for id:', surahId);
            return;
        }

        const ayahs = ayahsText.map((text, idx) => ({ id: idx + 1, text }));
        renderQuranText(ayahs);
    }

    function renderQuranText(ayahs) {
        quranContent.innerHTML = '';
        let absoluteWordIndex = 0;
        ayahs.forEach(ayah => {
            const ayahSpan = document.createElement('span');
            ayahSpan.className = 'quran-ayah block mb-12 animate-fade-in';
            ayahSpan.dataset.ayahId = ayah.id;

            const words = ayah.text.split(' ').filter(w => w.trim() !== '');
            words.forEach((word, idx) => {
                const wordSpan = document.createElement('span');
                const hasLetters = /[\u0621-\u064A\u0671\u0670]/.test(word);
                
                if (hasLetters) {
                    wordSpan.className = 'quran-word';
                    wordSpan.textContent = word;
                    wordSpan.dataset.wordIndex = `${ayah.id}-${idx}`;
                    wordSpan.dataset.absoluteIndex = absoluteWordIndex++;
                } else {
                    wordSpan.className = 'quran-symbol inline-block mx-1 opacity-70';
                    wordSpan.textContent = word;
                }
                ayahSpan.appendChild(wordSpan);
                ayahSpan.appendChild(document.createTextNode(' '));
            });

            const ayahNum = document.createElement('span');
            ayahNum.className = 'text-amber-500/60 font-Tajawal text-lg align-middle mx-4 select-none';
            ayahNum.innerHTML = `&nbsp;﴿${ayah.id}﴾&nbsp;`;
            ayahSpan.appendChild(ayahNum);

            quranContent.appendChild(ayahSpan);
        });
        // Initial scroll to top
        quranContent.parentElement.scrollTop = 0;
    }

    // --- Audio Management ---
    uploadZone.onclick = () => audioUpload.click();
    
    audioUpload.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFile = file;
            const url = URL.createObjectURL(file);
            initWavesurfer(url);
            uploadZone.querySelector('p').textContent = file.name;
            uploadZone.classList.add('border-amber-500/50', 'bg-amber-500/5');
            
            calculateOptimalSensitivity(file);
        }
    };

    async function calculateOptimalSensitivity(file) {
        if (!silenceSensitivityInput || !silenceSensitivityVal) return;
        
        const originalText = silenceSensitivityVal.textContent;
        silenceSensitivityVal.textContent = 'جاري الحساب...';
        silenceSensitivityVal.classList.add('animate-pulse');
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            
            const channelData = audioBuffer.getChannelData(0);
            
            // Use 50ms frames for accurate speech/pause resolution
            const frameSize = Math.floor(audioBuffer.sampleRate * 0.05); 
            let dbValues = [];
            
            for (let i = 0; i < channelData.length; i += frameSize) {
                let sum = 0;
                let actualChunkSize = Math.min(frameSize, channelData.length - i);
                for (let j = 0; j < actualChunkSize; j++) {
                    sum += channelData[i + j] * channelData[i + j];
                }
                const rms = Math.sqrt(sum / actualChunkSize);
                // Convert to dB, avoiding -Infinity
                dbValues.push(rms > 1e-6 ? 20 * Math.log10(rms) : -120);
            }
            
            if (dbValues.length > 0) {
                const peakDb = Math.max(...dbValues);
                
                // 1. Trim absolute leading and trailing silence (e.g. 60dB below peak)
                // so it doesn't skew our pause ratio calculation.
                let startIdx = 0;
                while (startIdx < dbValues.length && dbValues[startIdx] < peakDb - 60) {
                    startIdx++;
                }
                
                let endIdx = dbValues.length - 1;
                while (endIdx >= 0 && dbValues[endIdx] < peakDb - 60) {
                    endIdx--;
                }
                
                if (startIdx > endIdx) {
                    startIdx = 0;
                    endIdx = dbValues.length - 1;
                }
                
                const activeDbValues = dbValues.slice(startIdx, endIdx + 1);
                
                // 2. Target Silence Ratio (TSR) Algorithm
                // In natural Quran recitation, structural pauses (between ayahs/words) 
                // typically make up about 20% to 25% of the active reading time.
                // We find the top_db that yields exactly this ratio of silence!
                const targetSilenceRatio = 0.22; // 22% pauses
                
                let optimalTopDb = 15;
                let bestDiff = Infinity;
                
                // Test top_db values from 5 (very strict) to 60 (very loose)
                for (let testDb = 5; testDb <= 60; testDb++) {
                    let threshold = peakDb - testDb;
                    let silenceCount = 0;
                    
                    for (let i = 0; i < activeDbValues.length; i++) {
                        if (activeDbValues[i] < threshold) {
                            silenceCount++;
                        }
                    }
                    
                    let ratio = silenceCount / activeDbValues.length;
                    let diff = Math.abs(ratio - targetSilenceRatio);
                    
                    if (diff < bestDiff) {
                        bestDiff = diff;
                        optimalTopDb = testDb;
                    }
                }
                
                let optimal = optimalTopDb + 8; // إضافة 8 بناءً على ملاحظة أن الأفضل عادة أكبر بحوالي 8
                
                silenceSensitivityInput.value = optimal;
                silenceSensitivityVal.textContent = optimal + '% (تلقائي)';
                
                if (silenceSensitivityContainer) {
                    silenceSensitivityContainer.classList.add('ring-2', 'ring-amber-500', 'p-2', 'rounded-lg', 'transition-all', 'duration-500');
                    setTimeout(() => {
                        silenceSensitivityContainer.classList.remove('ring-2', 'ring-amber-500', 'p-2', 'rounded-lg');
                    }, 3000);
                }
            } else {
                silenceSensitivityVal.textContent = originalText;
            }
        } catch (e) {
            console.error("Error calculating sensitivity:", e);
            silenceSensitivityVal.textContent = originalText;
        } finally {
            silenceSensitivityVal.classList.remove('animate-pulse');
        }
    }

    // --- Processing ---
    processBtn.onclick = async () => {
        const file = selectedFile;
        const surahId = surahSelect.value;
        const apiUrl = apiUrlInput.value.trim().replace(/\/$/, '');
        const method = methodSelect ? methodSelect.value : 'waqf_backend';
        const recitation = recitationSelect.value;
        
        if (!file || !surahId) {
            alert('يرجى اختيار السورة ورفع الملف الصوتي أولاً');
            return;
        }
        if (!apiUrl) {
            alert('يرجى إدخال رابط خادم كولاب أولاً');
            return;
        }

        if (apiUrl.toLowerCase() === 'demo') {
            loadingTitle.textContent = 'جاري تشغيل وضع المحاكاة...';
            setTimeout(() => {
                const wordElements = document.querySelectorAll('.quran-word');
                if (!wordElements.length) {
                    alert('يرجى اختيار سورة أولاً');
                    loadingOverlay.classList.add('hidden');
                    return;
                }
                
                const totalDuration = wavesurfer.getDuration();
                const wordCount = wordElements.length;
                const timePerWord = totalDuration / wordCount;
                
                let demoAlignments = [];
                for (let i = 0; i < wordCount; i++) {
                    demoAlignments.push({
                        start: i * timePerWord,
                        end: (i + 1) * timePerWord,
                        element: wordElements[i]
                    });
                }
                
                alignments = demoAlignments;
                wavesurfer.play();
                loadingOverlay.classList.add('hidden');
            }, 2000);
            return;
        }

        loadingOverlay.classList.remove('hidden');

        try {
            if (method === 'waqf_backend') {
                loadingTitle.textContent = 'جاري التقسيم عبر خادم وقف...';
                loadingDesc.textContent = 'يتم الآن تحليل الآيات على الخادم السحابي...';

                const formData = new FormData();
                formData.append('file', file);
                formData.append('riwaya', recitation);
                formData.append('silence_sensitivity', silenceSensitivityInput.value);
                if (silenceEngineSelect) {
                    formData.append('silence_engine', silenceEngineSelect.value);
                }

                const response = await fetch(`${apiUrl}/align/${surahId}`, {
                    method: 'POST',
                    headers: { 'Bypass-Tunnel-Reminder': 'true' },
                    body: formData
                });

                if (!response.ok) throw new Error(`خطأ من الخادم: ${response.status}`);
                const result = await response.json();
                
                if (result.status === 'success') {
                    // In case it finishes immediately
                    if (result.data) {
                        originalAlignments = JSON.parse(JSON.stringify(result.data));
                    }
                    handleWaqfBackendSuccess(result);
                } else if (result.status === 'queued' || result.status === 'processing') {
                    // Start polling
                    pollWaqfBackendStatus(result.job_id, apiUrl, surahId);
                } else {
                    // Fallback to old synchronous behavior if status is not present
                    if (result.data) {
                        originalAlignments = JSON.parse(JSON.stringify(result.data));
                    }
                    handleWaqfBackendSuccess(result);
                }

            } else {
                // CTC or Whisper Cloud
                loadingTitle.textContent = 'جاري الرفع إلى كولاب...';
                loadingDesc.textContent = 'يتم الآن إرسال الملف والنص المرجعي للتقسيم...';

                // Get raw text from local JSON or custom edited text
                let rawWords = [];
                if (customReferenceText) {
                    rawWords = customReferenceText.replace(/[﴿﴾\d]/g, '').split(' ').filter(w => w.trim() !== '');
                } else {
                    rawWords = quranData[recitation][surahId].join(' ').split(' ').filter(w => w.trim() !== '');
                }
                
                // Clean the text: only keep words that have Arabic letters, and strip all diacritics/symbols
                const serverWords = rawWords
                    .filter(w => /[\u0621-\u064A\u0671\u0670]/.test(w))
                    .map(w => {
                        let clean = w.replace(/\u0670/g, 'ا').replace(/ٱ/g, 'ا');
                        return clean.replace(/[^\u0621-\u064A]/g, '');
                    });
                
                const referenceText = serverWords.join(' ');

                const formData = new FormData();
                formData.append('file', file);
                formData.append('reference_text', referenceText);
                formData.append('method', method.replace('_cloud', ''));
                formData.append('silence_sensitivity', silenceSensitivityInput.value);

                const response = await fetch(`${apiUrl}/align/cloud`, {
                    method: 'POST',
                    headers: { 'Bypass-Tunnel-Reminder': 'true' },
                    body: formData
                });

                if (!response.ok) throw new Error(`خطأ من كولاب: ${response.status}`);
                const result = await response.json();

                // Store original for cloud processing if successful
                if (result.status === 'success' && result.alignments) {
                    originalAlignments = JSON.parse(JSON.stringify(result.alignments));
                }

                if (result.status === 'success') {
                    handleAlignmentSuccess(result);
                } else if (result.status === 'queued' || result.status === 'processing') {
                    pollCloudStatus(result.job_id, apiUrl);
                } else {
                    throw new Error(result.message || 'فشل في بدء المهمة');
                }
            }
        } catch (error) {
            console.error('Error:', error);
            const isNetworkError = error.message === 'Failed to fetch' || error.name === 'TypeError';
            const msg = isNetworkError
                ? '❌ تعذّر الوصول إلى الخادم.\n\nالأسباب الشائعة:\n• انتهت صلاحية رابط Cloudflare Tunnel (تنتهي كل بضع ساعات)\n• الخادم توقف في كولاب\n\nالحل: أعد تشغيل خلية كولاب للحصول على رابط جديد.'
                : 'حدث خطأ: ' + error.message;
            alert(msg);
            loadingOverlay.classList.add('hidden');
        }
    };

    // --- File Sync Feature ---
    if (syncFileBtn && syncFileUpload) {
        syncFileBtn.onclick = () => {
            if (!selectedFile || !surahSelect.value) {
                alert('يرجى اختيار السورة ورفع الملف الصوتي أولاً');
                return;
            }
            syncFileUpload.click();
        };

        syncFileUpload.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    let json;
                    if (file.name.toLowerCase().endsWith('.srt')) {
                        // Parse SRT to JSON format
                        const srtContent = e.target.result;
                        const blocks = srtContent.trim().split(/\n\s*\n/);
                        const alignments = [];
                        
                        function parseTime(timeStr) {
                            const parts = timeStr.trim().split(/[:,]/);
                            if (parts.length >= 4) {
                                return parseInt(parts[0], 10) * 3600 + 
                                       parseInt(parts[1], 10) * 60 + 
                                       parseInt(parts[2], 10) + 
                                       parseInt(parts[3], 10) / 1000;
                            }
                            return 0;
                        }

                        for (let block of blocks) {
                            const lines = block.split('\n');
                            if (lines.length >= 3) {
                                const timeLine = lines[1];
                                const times = timeLine.split(' --> ');
                                if (times.length === 2) {
                                    const start = parseTime(times[0]);
                                    const end = parseTime(times[1]);
                                    const text = lines.slice(2).join(' ').trim();
                                    alignments.push({ start, end, text });
                                }
                            }
                        }
                        json = { alignments };
                    } else {
                        json = JSON.parse(e.target.result);
                    }

                    if (json.alignments) {
                        const numWords = document.querySelectorAll('.quran-word').length;
                        const numAyahs = document.querySelectorAll('.quran-ayah').length;
                        
                        // Heuristic: is it closer to number of ayahs or number of words?
                        const isAyahLevel = Math.abs(json.alignments.length - numAyahs) < Math.abs(json.alignments.length - numWords);
                        
                        if (isAyahLevel) {
                            let newAlignments = [];
                            const ayahsEl = Array.from(document.querySelectorAll('.quran-ayah'));
                            
                            json.alignments.forEach((item, idx) => {
                                if (ayahsEl[idx]) {
                                    newAlignments.push({
                                        start: item.start,
                                        end: item.end,
                                        element: ayahsEl[idx]
                                    });
                                }
                            });
                            
                            originalAlignments = json.alignments.map((a, idx) => ({
                                ayah_number: idx + 1,
                                start_time: a.start,
                                end_time: a.end
                            }));
                            
                            alignments = newAlignments;
                            if (wavesurfer) {
                                document.getElementById('audio-player-container').classList.remove('hidden');
                                try {
                                    const playPromise = wavesurfer.play();
                                    if (playPromise !== undefined) {
                                        playPromise.catch(e => console.warn("Autoplay blocked", e));
                                    }
                                } catch(e) {
                                    console.warn("Autoplay error", e);
                                }
                            }
                            exportContainer.classList.remove('hidden');
                        } else {
                            const alignmentsData = json.alignments.map(a => ({
                                word: a.word || a.text,
                                start: a.start,
                                end: a.end
                            }));
                            
                            originalAlignments = JSON.parse(JSON.stringify(alignmentsData));
                            handleAlignmentSuccess({ alignments: alignmentsData });
                        }
                    } else {
                        alert('تنسيق الملف غير صالح');
                    }
                } catch (err) {
                    console.error(err);
                    alert('حدث خطأ أثناء قراءة الملف: ' + err.message);
                }
            };
            reader.readAsText(file);
            syncFileUpload.value = ''; // Reset input
        };
    }

    function handleAlignmentSuccess(result) {
        const wordElements = Array.from(document.querySelectorAll('.quran-word'));
        
        const norm = (s) => {
            let clean = s.replace(/\u0670/g, 'ا').replace(/ٱ/g, 'ا');
            return clean.replace(/[^\u0621-\u064A]/g, '');
        };

        const arr1 = wordElements.map(el => norm(el.textContent));
        const arr2 = result.alignments.map(a => norm(a.word));

        const dp = Array(arr1.length + 1).fill(null).map(() => Array(arr2.length + 1).fill(0));
        
        for (let i = 1; i <= arr1.length; i++) {
            for (let j = 1; j <= arr2.length; j++) {
                if (arr1[i - 1] === arr2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        let mapping = [];
        let i = arr1.length, j = arr2.length;
        while (i > 0 && j > 0) {
            if (arr1[i - 1] === arr2[j - 1]) {
                mapping[i - 1] = j - 1;
                i--; j--;
            } else if (dp[i - 1][j] > dp[i][j - 1]) {
                i--;
            } else {
                j--;
            }
        }

        let newAlignments = [];
        for (let k = 0; k < wordElements.length; k++) {
            const mappedIdx = mapping[k];
            if (mappedIdx !== undefined) {
                newAlignments.push({
                    start: result.alignments[mappedIdx].start,
                    end: result.alignments[mappedIdx].end,
                    original_start: result.alignments[mappedIdx].original_start,
                    original_end: result.alignments[mappedIdx].original_end,
                    element: wordElements[k]
                });
            }
        }

        // Interpolate unmapped words
        for (let k = 0; k < wordElements.length; k++) {
            if (!newAlignments.find(a => a.element === wordElements[k])) {
                let prevEnd = 0;
                for(let m=k-1; m>=0; m--) {
                    let prev = newAlignments.find(a => a.element === wordElements[m]);
                    if(prev) { prevEnd = prev.end; break; }
                }
                let nextStart = prevEnd + 0.1;
                for(let m=k+1; m<wordElements.length; m++) {
                    let next = newAlignments.find(a => a.element === wordElements[m]);
                    if(next) { nextStart = next.start; break; }
                }
                newAlignments.push({
                    start: prevEnd,
                    end: Math.max(prevEnd, nextStart),
                    original_start: prevEnd,
                    original_end: Math.max(prevEnd, nextStart),
                    element: wordElements[k]
                });
            }
        }

        newAlignments.sort((a, b) => parseInt(a.element.dataset.absoluteIndex) - parseInt(b.element.dataset.absoluteIndex));
        alignments = newAlignments;

        if (wavesurfer) {
            document.getElementById('audio-player-container').classList.remove('hidden');
            try {
                const playPromise = wavesurfer.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => console.warn("Autoplay blocked", e));
                }
            } catch(e) {
                console.warn("Autoplay error", e);
            }
        }
        loadingOverlay.classList.add('hidden');
        exportContainer.classList.remove('hidden');
        
        // Group by Waqf instead of Ayahs
        regroupByWaqf();
    }

    function handleWaqfBackendSuccess(result) {
        if (result.silences) {
            audioSilences = result.silences;
        } else {
            audioSilences = [];
        }

        // Check if words exist
        const hasWords = result.data.some(d => d.words && d.words.length > 0);
        
        if (hasWords) {
            let flatAlignments = [];
            result.data.forEach(ayahData => {
                if (ayahData.words) {
                    ayahData.words.forEach(w => {
                        flatAlignments.push({ word: w.word, start: w.start, end: w.end, original_start: w.original_start, original_end: w.original_end });
                    });
                }
            });
            originalAlignments = JSON.parse(JSON.stringify(flatAlignments));
            handleAlignmentSuccess({ alignments: flatAlignments });
            return;
        }

        let newAlignments = [];
        const ayahsEl = Array.from(document.querySelectorAll('.quran-ayah'));
        
        ayahsEl.forEach(ayahEl => {
            const ayahIdNum = parseInt(ayahEl.dataset.ayahId);
            const ayahData = result.data.find(d => d.ayah_number === ayahIdNum);
            if (ayahData) {
                newAlignments.push({
                    start: ayahData.start_time,
                    end: ayahData.end_time,
                    element: ayahEl
                });
            }
        });

        alignments = newAlignments;
        if (wavesurfer) {
            document.getElementById('audio-player-container').classList.remove('hidden');
            try {
                const playPromise = wavesurfer.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => console.warn("Autoplay blocked", e));
                }
            } catch(e) {
                console.warn("Autoplay error", e);
            }
        }
        loadingOverlay.classList.add('hidden');
        exportContainer.classList.remove('hidden');
    }

    async function pollCloudStatus(jobId, apiUrl, startTime = Date.now()) {
        try {
            const response = await fetch(`${apiUrl}/align/status/${jobId}`, {
                headers: { 'Bypass-Tunnel-Reminder': 'true' }
            });
            const result = await response.json();
            
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            
            if (result.status === 'success') {
                if (result.alignments) {
                    originalAlignments = JSON.parse(JSON.stringify(result.alignments));
                }
                handleAlignmentSuccess(result);
            } else if (result.status === 'error') {
                alert('خطأ في المعالجة: ' + result.message);
                loadingOverlay.classList.add('hidden');
            } else {
                loadingTitle.textContent = 'جاري المعالجة سحابياً...';
                loadingDesc.textContent = `تم استلام المهمة بنجاح، يرجى الانتظار... (${elapsed} ثانية)`;
                setTimeout(() => pollCloudStatus(jobId, apiUrl, startTime), 3000);
            }
        } catch (error) {
            console.warn('Polling error (retrying...):', error);
            setTimeout(() => pollCloudStatus(jobId, apiUrl, startTime), 5000);
        }
    }

    async function pollWaqfBackendStatus(jobId, apiUrl, surahId, startTime = Date.now()) {
        try {
            const response = await fetch(`${apiUrl}/align/status/${jobId}`, {
                headers: { 'Bypass-Tunnel-Reminder': 'true' }
            });
            const result = await response.json();
            
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            
            if (result.status === 'success') {
                // Waqf Backend returns the result in "data" instead of "alignments"
                if (result.data) {
                    originalAlignments = JSON.parse(JSON.stringify(result.data));
                }
                handleWaqfBackendSuccess(result);
            } else if (result.status === 'error') {
                alert('خطأ في معالجة وقف للأنفاس: ' + result.message);
                loadingOverlay.classList.add('hidden');
            } else {
                loadingTitle.textContent = 'جاري المزامنة عبر وقف للأنفاس...';
                loadingDesc.textContent = `المهمة قيد التنفيذ، يرجى الانتظار... (${elapsed} ثانية)`;
                setTimeout(() => pollWaqfBackendStatus(jobId, apiUrl, surahId, startTime), 3000);
            }
        } catch (error) {
            console.warn('Polling error (retrying...):', error);
            setTimeout(() => pollWaqfBackendStatus(jobId, apiUrl, surahId, startTime), 5000);
        }
    }

    function regroupByWaqf() {
        const thresholdInput = document.getElementById('waqf-threshold');
        const threshold = thresholdInput ? parseFloat(thresholdInput.value) || 0.5 : 0.5;
        
        const quranContent = document.getElementById('quran-content');
        quranContent.innerHTML = '';
        
        if (!alignments || alignments.length === 0) return;
        
        let currentWaqfSpan = document.createElement('span');
        currentWaqfSpan.className = 'waqf-segment block mb-10 animate-fade-in text-center bg-white/5 p-4 rounded-2xl border border-white/5';
        
        for (let i = 0; i < alignments.length; i++) {
            const align = alignments[i];
            const el = align.element;
            const currentAyahId = el.dataset.wordIndex.split('-')[0];
            const nextAlign = alignments[i+1];
            const nextAyahId = nextAlign ? nextAlign.element.dataset.wordIndex.split('-')[0] : null;
            
            // 1. تقييم قرار القطع (النفس)
            let isBreath = false;
            let gap = 0;
            
            if (nextAlign) {
                const whisperSource = document.getElementById('whisper-timing-source')?.value || 'original';
                const useOriginal = whisperSource === 'original';
                
                const start2 = useOriginal 
                    ? Number(nextAlign.original_start ?? nextAlign.start)
                    : Number(nextAlign.start);
                    
                const end1 = useOriginal 
                    ? Number(align.original_end ?? align.end)
                    : Number(align.end);
                    
                gap = start2 - end1;
                
                // فحص الأنفاس الحقيقية باستخدام Librosa
                let hasRealSilence = false;
                const silenceMethod = document.getElementById('silence-detection-method')?.value || 'or';
                const realSilenceThreshInput = document.getElementById('real-silence-threshold');
                const rsThreshold = realSilenceThreshInput ? parseFloat(realSilenceThreshInput.value) || 0.15 : 0.15;

                // لا نقوم بفحص مكتبة الصمت إلا إذا كانت الطريقة تتطلبها
                if (silenceMethod !== 'whisper_only' && audioSilences && audioSilences.length > 0) {
                    const A = end1 - 0.2;
                    const B = start2 + 0.2;
                    for (const [sStartStr, sEndStr] of audioSilences) {
                        const C = Number(sStartStr);
                        const D = Number(sEndStr);
                        const overlapStart = Math.max(A, C);
                        const overlapEnd = Math.min(B, D);
                        
                        // صمت يتلامس مع الفجوة ومدته أكبر من الحد المسموح
                        if (overlapStart <= overlapEnd && (D - C >= rsThreshold)) {
                            hasRealSilence = true;
                            break;
                        }
                    }
                }
                
                // نقطع المقطع بناءً على الطريقة المختارة
                const whisperCondition = gap >= threshold;
                const librosaCondition = hasRealSilence;

                if (silenceMethod === 'or') {
                    isBreath = librosaCondition || whisperCondition;
                } else if (silenceMethod === 'and') {
                    isBreath = librosaCondition && whisperCondition;
                } else if (silenceMethod === 'librosa_only') {
                    isBreath = librosaCondition;
                } else if (silenceMethod === 'whisper_only') {
                    isBreath = whisperCondition;
                }
            }
            
            const shouldSplit = nextAlign && isBreath;
            
            // 2. إضافة الكلمة
            currentWaqfSpan.appendChild(el);
            currentWaqfSpan.appendChild(document.createTextNode(' '));
            
            // 3. إضافة رقم الآية وتوضيح حالة الوصل البصري
            if (currentAyahId !== nextAyahId) {
                const ayahNum = document.createElement('span');
                
                if (!shouldSplit && nextAlign) {
                    // الآية موصولة بما بعدها في نفس واحد
                    ayahNum.className = 'font-Tajawal text-xl align-middle mx-2 select-none text-amber-500/90 font-bold';
                    ayahNum.innerHTML = `&nbsp;﴿${currentAyahId}﴾ <span class="text-xs text-amber-500/80 bg-amber-500/10 px-2 py-0.5 rounded-full ml-1 border border-amber-500/20" title="تمت القراءة موصولة في نفس واحد">موصولة</span>&nbsp;`;
                } else {
                    // الآية مقطوعة طبيعياً
                    ayahNum.className = 'font-Tajawal text-xl align-middle mx-2 select-none text-amber-500/60';
                    ayahNum.innerHTML = `&nbsp;﴿${currentAyahId}﴾&nbsp;`;
                }
                
                currentWaqfSpan.appendChild(ayahNum);
                currentWaqfSpan.appendChild(document.createTextNode(' '));
            }
            
            // 4. تطبيق القطع إذا لزم الأمر
            if (shouldSplit) {
                quranContent.appendChild(currentWaqfSpan);
                currentWaqfSpan = document.createElement('span');
                currentWaqfSpan.className = 'waqf-segment block mb-10 animate-fade-in text-center bg-white/5 p-4 rounded-2xl border border-white/5';
            }
        }
        
        quranContent.appendChild(currentWaqfSpan);
    }

    // --- Synchronization ---
    let lastHighlightedIdx = -1;
    let animFrameId = null;

    function startSyncLoop() {
        if (animFrameId) cancelAnimationFrame(animFrameId);
        function tick() {
            if (wavesurfer && wavesurfer.isPlaying()) {
                const currentTime = wavesurfer.getCurrentTime();
                currentTimeEl.textContent = formatTime(currentTime);
                updateHighlighting(currentTime);
            }
            animFrameId = requestAnimationFrame(tick);
        }
        animFrameId = requestAnimationFrame(tick);
    }

    function stopSyncLoop() {
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
    }

    function updateHighlighting(currentTime) {
        if (!alignments.length) return;

        let wordIdx = -1;
        if (currentTime < alignments[0].start) wordIdx = -1;
        else if (currentTime >= alignments[alignments.length - 1].end) wordIdx = -1;
        else {
            let lo = 0, hi = alignments.length - 1;
            while (lo <= hi) {
                const mid = Math.floor((lo + hi) / 2);
                if (currentTime >= alignments[mid].start && currentTime < alignments[mid].end) {
                    wordIdx = mid;
                    break;
                } else if (currentTime < alignments[mid].start) hi = mid - 1;
                else lo = mid + 1;
            }
            if (wordIdx === -1 && lo > 0) wordIdx = lo - 1;
        }

        if (wordIdx !== lastHighlightedIdx) {
            if (lastHighlightedIdx >= 0) alignments[lastHighlightedIdx].element?.classList.remove('active');
            if (wordIdx >= 0) {
                const el = alignments[wordIdx].element;
                el?.classList.add('active');
                if (!isElementInViewport(el)) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            lastHighlightedIdx = wordIdx;
        }
    }

    // --- Context Menu & Utils ---
    quranContent.addEventListener('click', (e) => {
        if (e.target.classList.contains('quran-word')) {
            if (!alignments.length) return;

            currentSelectedWordIdx = parseInt(e.target.dataset.absoluteIndex);
            currentSelectedWordElement = e.target;
            
            const isAyahMode = alignments[0]?.element?.classList.contains('quran-ayah');
            
            if (isAyahMode) {
                wamPlayWord.style.display = 'none';
                wamWordText.textContent = `الآية ${e.target.closest('.quran-ayah').dataset.ayahId}`;
            } else {
                wamPlayWord.style.display = 'flex';
                wamWordText.textContent = e.target.textContent;
            }
            
            const rect = e.target.getBoundingClientRect();
            wordActionMenu.classList.remove('hidden');
            const menuWidth = wordActionMenu.offsetWidth || 200;
            
            wordActionMenu.style.left = `${Math.max(10, Math.min(window.innerWidth - menuWidth - 20, rect.left + window.scrollX - menuWidth/2 + rect.width/2))}px`;
            wordActionMenu.style.top = `${rect.bottom + window.scrollY + 10}px`;
            
            if (wamWordTimeVal) wamWordTimeVal.classList.add('hidden');
            if (wamAyahTimeVal) wamAyahTimeVal.classList.add('hidden');
        }
    });

    wamClose.onclick = () => wordActionMenu.classList.add('hidden');

    function playSegment(start, end) {
        if (!wavesurfer) return;
        const buffer = wavesurfer.getDecodedData ? wavesurfer.getDecodedData() : null;
        if (buffer) {
            if (!preciseAudioCtx) preciseAudioCtx = new AudioContext();
            if (preciseSourceNode) { try { preciseSourceNode.stop(); } catch(e){} preciseSourceNode.disconnect(); }
            if (wavesurfer.isPlaying()) wavesurfer.pause();

            preciseSourceNode = preciseAudioCtx.createBufferSource();
            preciseSourceNode.buffer = buffer;
            preciseSourceNode.connect(preciseAudioCtx.destination);
            preciseSourceNode.start(0, start, end - start);
            wavesurfer.setTime(start);
        } else {
            wavesurfer.setTime(start);
            wavesurfer.play();
        }
    }

    wamPlayWord.onclick = () => {
        const a = alignments[currentSelectedWordIdx];
        if (a) playSegment(a.start, a.end);
        wordActionMenu.classList.add('hidden');
    };

    wamPlayAyah.onclick = () => {
        const times = getAyahTimestamps();
        if (times) playSegment(times.start, times.end);
        wordActionMenu.classList.add('hidden');
    };

    function getAyahTimestamps() {
        if (!currentSelectedWordElement) return null;
        const ayahSpan = currentSelectedWordElement.closest('.quran-ayah');
        if (!ayahSpan) return null;
        
        // Handle Waqf Backend mode where elements ARE ayahs
        const isAyahMode = alignments[0]?.element?.classList.contains('quran-ayah');
        if (isAyahMode) return alignments.find(a => a.element === ayahSpan);

        const ayahWords = ayahSpan.querySelectorAll('.quran-word');
        const firstIdx = parseInt(ayahWords[0].dataset.absoluteIndex);
        const lastIdx = parseInt(ayahWords[ayahWords.length - 1].dataset.absoluteIndex);
        return { start: alignments[firstIdx].start, end: alignments[lastIdx].end };
    }

    function formatTime(s) {
        return `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`;
    }

    function isElementInViewport(el) {
        const r = el.getBoundingClientRect();
        return (r.top >= 0 && r.bottom <= window.innerHeight);
    }

    // --- Editor Logic ---
    wamEditTiming.onclick = () => {
        wordActionMenu.classList.add('hidden');
        if (!alignments.length || currentSelectedWordIdx === -1) return;

        editorModeAyah = alignments[0]?.element?.classList.contains('quran-ayah');
        
        let targetIndex = -1;
        if (editorModeAyah) {
            // Find the index of the ayah in alignments
            const ayahSpan = currentSelectedWordElement.closest('.quran-ayah');
            targetIndex = alignments.findIndex(a => a.element === ayahSpan);
        } else {
            targetIndex = currentSelectedWordIdx;
        }

        if (targetIndex !== -1) {
            openEditor(targetIndex);
        }
    };

    function openEditor(index) {
        if (index < 0 || index >= alignments.length) return;
        editorCurrentIndex = index;
        const a = alignments[index];
        
        editorTypeLabel.textContent = editorModeAyah ? 'تعديل توقيت الآية' : 'تعديل توقيت الكلمة';
        editorText.textContent = editorModeAyah 
            ? `الآية ${a.element.dataset.ayahId}` 
            : a.element.textContent;

        editorStartTime.value = a.start.toFixed(2);
        editorEndTime.value = a.end.toFixed(2);

        timingEditorBar.classList.remove('hidden');
        // Small timeout to allow display:block before translating
        setTimeout(() => {
            timingEditorBar.classList.remove('translate-y-full');
        }, 10);

        // Highlight element
        const wordElements = document.querySelectorAll('.quran-word, .quran-ayah');
        wordElements.forEach(el => el.classList.remove('active', 'border-b-2', 'border-amber-500'));
        a.element.classList.add('active', 'border-b-2', 'border-amber-500');
        if (!isElementInViewport(a.element)) a.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function closeEditor() {
        timingEditorBar.classList.add('translate-y-full');
        setTimeout(() => {
            timingEditorBar.classList.add('hidden');
            const wordElements = document.querySelectorAll('.quran-word, .quran-ayah');
            wordElements.forEach(el => el.classList.remove('border-b-2', 'border-amber-500'));
        }, 300);
    }

    editorCloseBtn.onclick = closeEditor;

    window.adjustEditorTime = (type, amount) => {
        const input = type === 'start' ? editorStartTime : editorEndTime;
        let val = parseFloat(input.value) || 0;
        val += amount;
        if (val < 0) val = 0;
        input.value = val.toFixed(2);
    };

    document.getElementById('editor-start-dec').onclick = () => window.adjustEditorTime('start', -0.1);
    document.getElementById('editor-start-inc').onclick = () => window.adjustEditorTime('start', 0.1);
    document.getElementById('editor-end-dec').onclick = () => window.adjustEditorTime('end', -0.1);
    document.getElementById('editor-end-inc').onclick = () => window.adjustEditorTime('end', 0.1);

    editorPlayBtn.onclick = () => {
        const start = parseFloat(editorStartTime.value) || 0;
        const end = parseFloat(editorEndTime.value) || 0;
        if (start < end) playSegment(start, end);
    };

    const editorResetBtn = document.getElementById('editor-reset-btn');
    if (editorResetBtn) {
        editorResetBtn.onclick = () => {
            if (editorCurrentIndex === -1 || !originalAlignments.length) return;
            
            // For CTC/Whisper, originalAlignments is an array of objects {start, end, word}
            // For Waqf Backend, originalAlignments is an array of objects {ayah_number, start_time, end_time}
            
            let originalStart = 0;
            let originalEnd = 0;
            
            if (editorModeAyah) {
                const ayahSpan = alignments[editorCurrentIndex].element;
                const ayahIdNum = parseInt(ayahSpan.dataset.ayahId);
                const ayahData = originalAlignments.find(d => d.ayah_number === ayahIdNum);
                if (ayahData) {
                    originalStart = ayahData.start_time || ayahData.start;
                    originalEnd = ayahData.end_time || ayahData.end;
                }
            } else {
                if (originalAlignments[editorCurrentIndex]) {
                    originalStart = originalAlignments[editorCurrentIndex].start;
                    originalEnd = originalAlignments[editorCurrentIndex].end;
                }
            }
            
            if (originalStart !== undefined && originalEnd !== undefined) {
                editorStartTime.value = originalStart.toFixed(2);
                editorEndTime.value = originalEnd.toFixed(2);
                editorSaveBtn.click(); // Auto-save the reset
            }
        };
    }

    const resetAllBtn = document.getElementById('reset-all-btn');
    if (resetAllBtn) {
        resetAllBtn.onclick = () => {
            if (!originalAlignments.length) return;
            
            if (confirm('هل أنت متأكد من رغبتك في استعادة جميع التوقيتات إلى حالتها الأصلية ومسح جميع تعديلاتك؟')) {
                if (editorModeAyah || alignments[0]?.element?.classList.contains('quran-ayah')) {
                    alignments.forEach(a => {
                        const ayahIdNum = parseInt(a.element.dataset.ayahId);
                        const ayahData = originalAlignments.find(d => d.ayah_number === ayahIdNum);
                        if (ayahData) {
                            a.start = ayahData.start_time || ayahData.start;
                            a.end = ayahData.end_time || ayahData.end;
                        }
                    });
                } else {
                    alignments.forEach((a, idx) => {
                        if (originalAlignments[idx]) {
                            a.start = originalAlignments[idx].start;
                            a.end = originalAlignments[idx].end;
                        }
                    });
                }
                
                // Refresh editor if open
                if (editorCurrentIndex !== -1 && !timingEditorBar.classList.contains('hidden')) {
                    openEditor(editorCurrentIndex);
                }
                
                alert('تمت استعادة جميع التوقيتات الأصلية بنجاح.');
            }
        };
    }

    editorSaveBtn.onclick = () => {
        if (editorCurrentIndex === -1) return;
        const start = parseFloat(editorStartTime.value) || 0;
        const end = parseFloat(editorEndTime.value) || 0;
        
        if (start >= end) {
            alert('يجب أن يكون وقت النهاية أكبر من وقت البداية');
            return;
        }

        alignments[editorCurrentIndex].start = start;
        alignments[editorCurrentIndex].end = end;
        
        // Visual feedback
        const originalText = editorSaveBtn.textContent;
        editorSaveBtn.textContent = 'تم الحفظ!';
        editorSaveBtn.classList.add('bg-emerald-600');
        setTimeout(() => {
            editorSaveBtn.textContent = originalText;
            editorSaveBtn.classList.remove('bg-emerald-600');
        }, 1000);
    };

    editorNextBtn.onclick = () => {
        if (editorCurrentIndex < alignments.length - 1) {
            editorSaveBtn.click(); // Auto-save on next
            openEditor(editorCurrentIndex + 1);
            editorPlayBtn.click(); // Auto-play
        }
    };

    editorPrevBtn.onclick = () => {
        if (editorCurrentIndex > 0) {
            editorSaveBtn.click(); // Auto-save on prev
            openEditor(editorCurrentIndex - 1);
            editorPlayBtn.click(); // Auto-play
        }
    };

    // Keyboard shortcuts for Editor
    document.addEventListener('keydown', (e) => {
        if (!timingEditorBar.classList.contains('hidden')) {
            if (e.code === 'Space') {
                e.preventDefault(); // Prevent page scroll
                editorNextBtn.click();
            } else if (e.code === 'ArrowRight') {
                // Next word (Left arrow intuitively moves to previous word in RTL, but let's stick to Right Arrow = Next for now or maybe Left = Next)
                // Actually Arabic reads right-to-left, so the next word is physically to the left.
                e.preventDefault();
                editorPrevBtn.click(); 
            } else if (e.code === 'ArrowLeft') {
                e.preventDefault();
                editorNextBtn.click(); 
            }
        }
    });

    // --- Export Logic ---
    function formatTimeSRT(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    }

    function formatTimeVTT(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }

    function downloadFile(content, filename, type) {
        const blob = new Blob([content], { type: type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function getExportData() {
        const segments = document.querySelectorAll('.waqf-segment');
        if (segments.length > 0) {
            return Array.from(segments).map(seg => {
                const words = Array.from(seg.querySelectorAll('.quran-word'));
                const text = seg.textContent.replace(/\s+/g, ' ').trim();
                let start = 999999, end = 0;
                words.forEach(w => {
                    const align = alignments.find(a => a.element === w);
                    if (align) {
                        if (align.start < start) start = align.start;
                        if (align.end > end) end = align.end;
                    }
                });
                if (start === 999999) start = 0;
                return { start, end, text };
            }).filter(item => item.end > 0);
        }
        
        return alignments.map(a => {
            let text = '';
            if (a.element.classList.contains('quran-ayah')) {
                // Waqf Backend mode: element is an ayah. Get all word texts inside.
                const words = a.element.querySelectorAll('.quran-word');
                text = Array.from(words).map(w => w.textContent).join(' ');
            } else {
                // Word mode
                text = a.element.textContent;
            }
            return { start: a.start, end: a.end, text: text };
        });
    }

    exportJsonBtn.onclick = () => {
        if (!alignments.length) return;
        const data = getExportData();
        const json = JSON.stringify({ alignments: data }, null, 2);
        downloadFile(json, 'miqat_alignments.json', 'application/json');
    };

    exportSrtBtn.onclick = () => {
        if (!alignments.length) return;
        const data = getExportData();
        let srt = '';
        data.forEach((item, index) => {
            srt += `${index + 1}\n`;
            srt += `${formatTimeSRT(item.start)} --> ${formatTimeSRT(item.end)}\n`;
            srt += `${item.text}\n\n`;
        });
        downloadFile(srt, 'miqat_alignments.srt', 'text/plain');
    };

    exportVttBtn.onclick = () => {
        if (!alignments.length) return;
        const data = getExportData();
        let vtt = 'WEBVTT\n\n';
        data.forEach((item, index) => {
            vtt += `${index + 1}\n`;
            vtt += `${formatTimeVTT(item.start)} --> ${formatTimeVTT(item.end)}\n`;
            vtt += `${item.text}\n\n`;
        });
        downloadFile(vtt, 'miqat_alignments.vtt', 'text/plain');
    };

    // --- Edit Text Modal Logic ---
    const editTextBtn = document.getElementById('edit-text-btn');
    const editTextModal = document.getElementById('edit-text-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const saveEditBtn = document.getElementById('save-edit-btn');
    const refTextEditor = document.getElementById('ref-text-editor');

    if (editTextBtn) {
        editTextBtn.onclick = () => {
            const surahId = surahSelect.value;
            const recitation = recitationSelect.value;
            if (!surahId || !quranData[recitation] || !quranData[recitation][surahId]) {
                alert('يرجى اختيار السورة أولاً لتعديل نصها');
                return;
            }

            let textToEdit = '';
            if (customReferenceText !== null) {
                textToEdit = customReferenceText;
            } else {
                textToEdit = quranData[recitation][surahId].map((text, idx) => `${text} ﴿${idx + 1}﴾`).join(' ');
            }

            refTextEditor.value = textToEdit;
            editTextModal.classList.remove('hidden');
        };

        const closeEditModal = () => {
            editTextModal.classList.add('hidden');
        };

        closeModalBtn.onclick = closeEditModal;
        cancelEditBtn.onclick = closeEditModal;

        saveEditBtn.onclick = () => {
            customReferenceText = refTextEditor.value;
            closeEditModal();
            // We do NOT update the UI (renderQuranText) here. 
            // The UI stays the same, but the text sent to the AI will be this edited text.
        };
    }

    // --- Colab Codes & How it works Modal Logic ---
    // --- Colab Codes & How it works Modal Logic ---
    const howItWorksBtn = document.getElementById('how-it-works-btn');
    const howItWorksModal = document.getElementById('how-it-works-modal');
    const closeHowBtn = document.getElementById('close-how-btn');
    const closeHowBtnBottom = document.getElementById('close-how-btn-bottom');
    
    const showColabCodeBtn = document.getElementById('show-colab-code-btn');
    const colabCodeModal = document.getElementById('colab-code-modal');
    const closeColabModalBtn = document.getElementById('close-colab-modal-btn');
    
    const colabCellsContainer = document.getElementById('colab-cells-container');

    if (howItWorksBtn && howItWorksModal) {
        howItWorksBtn.onclick = () => howItWorksModal.classList.remove('hidden');
        closeHowBtn.onclick = () => howItWorksModal.classList.add('hidden');
        closeHowBtnBottom.onclick = () => howItWorksModal.classList.add('hidden');
    }

    if (showColabCodeBtn && colabCodeModal) {
        showColabCodeBtn.onclick = () => colabCodeModal.classList.remove('hidden');
        closeColabModalBtn.onclick = () => colabCodeModal.classList.add('hidden');
    }

    const colabCodes = {
        waqf_backend: [
            `# الخلية الأولى: إعداد البيئة وتثبيت المكتبات\n# 1. تحميل المشروع من جديد\n!rm -rf waqf_backend\n!git clone https://github.com/alinice1998/waqf_backend.git\n\n# 2. الدخول للمجلد الجذر للمشروع\n%cd /content/waqf_backend\n\n# 3. التثبيت\n!apt-get install -y ffmpeg\n!pip uninstall -y numpy ctc-segmentation\n!pip install git+https://github.com/m-bain/whisperx.git\n!pip install -e .\n!pip install -r server/requirements.txt\n!pip install --no-cache-dir rapidfuzz ctc-segmentation\n!pip install "numpy<2" --force-reinstall`,
            `# الخلية الثانية: تشغيل الخادم والحصول على الرابط عبر Cloudflare\nimport subprocess, threading, time, re, os\n\nos.chdir("/content/waqf_backend")\n\n# تحميل أداة cloudflared\nif not os.path.exists("cloudflared"):\n    subprocess.run([\n        "curl", "-sL",\n        "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64",\n        "-o", "cloudflared"\n    ], check=True)\n    subprocess.run(["chmod", "+x", "cloudflared"], check=True)\n\n# تشغيل خادم uvicorn في الخلفية (يعمل على server/app.py)\nuvicorn_proc = subprocess.Popen(\n    ["uvicorn", "server.app:app", "--host", "0.0.0.0", "--port", "8000"],\n    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True\n)\nprint("⏳ جاري تشغيل خادم Uvicorn (يرجى الانتظار 10 ثوانٍ)...")\ntime.sleep(10)  # مهلة لضمان بدء الخادم\n\n# تشغيل cloudflared والتقاط الرابط\ncf_proc = subprocess.Popen(\n    ["./cloudflared", "tunnel", "--url", "http://localhost:8000"],\n    stderr=subprocess.PIPE, text=True\n)\n\nprint("⏳ جاري الاتصال بـ Cloudflare Tunnel...")\nurl = None\nfor line in cf_proc.stderr:\n    match = re.search(r'https://[a-z0-9\\-]+\\.trycloudflare\\.com', line)\n    if match:\n        url = match.group(0)\n        print(f"\\n✅ الرابط العام جاهز:\\n🌐 {url}\\n")\n        print("📌 انسخ هذا الرابط واستخدمه في التطبيق الخاص بك")\n        print("⚠️  لا توجد كلمة مرور - فقط انسخ الرابط مباشرة")\n        break\n\n# إبقاء الخلية تعمل وعرض التحديثات لمنع توقف كولاب\nprint("\\n🔥 الخادم يعمل الآن. سيتم عرض التحديثات أدناه...\\n")\nfor line in uvicorn_proc.stdout:\n    print(line, end="")`
        ],
        hybrid: [
            `# 1. إعداد المشروع وتشغيل خادم المزامنة الهجينة (Hybrid)\n!rm -rf colabwis\n!git clone https://github.com/alinice1998/colabwis.git\n%cd colabwis\n\n!apt-get install -y ffmpeg\n!pip uninstall -y numpy ctc-segmentation\n!pip install git+https://github.com/m-bain/whisperx.git\n!pip install -r requirements.txt\n!pip install --no-cache-dir rapidfuzz ctc-segmentation\n!pip install "numpy<2" --force-reinstall\n!python model_downloader.py\n\nimport subprocess, threading, time, re, os\n\n# تحميل cloudflared\nif not os.path.exists("cloudflared"):\n    subprocess.run(["curl", "-sL", "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64", "-o", "cloudflared"], check=True)\n    subprocess.run(["chmod", "+x", "cloudflared"], check=True)\n\n# تشغيل الخادم\nuvicorn_proc = subprocess.Popen(["uvicorn", "colab_server:app", "--host", "0.0.0.0", "--port", "8000"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)\nprint("⏳ جاري تشغيل الخادم (قد يستغرق تحميل النماذج 15-20 ثانية)...")\ntime.sleep(15)\n\n# تشغيل النفق والتقاط الرابط\ncf_proc = subprocess.Popen(["./cloudflared", "tunnel", "--url", "http://localhost:8000"], stderr=subprocess.PIPE, text=True)\n\nfor line in cf_proc.stderr:\n    match = re.search(r'https://[a-z0-9\\-]+\\.trycloudflare\\.com', line)\n    if match:\n        print(f"\\n✅ الرابط العام جاهز:\\n🌐 {match.group(0)}\\n")\n        break\n\nfor line in uvicorn_proc.stdout: print(line, end="")`
        ],
        ctc_cloud: [
            `# 1. إعداد المشروع وتشغيل خادم CTC\n!rm -rf colabwis\n!git clone https://github.com/alinice1998/colabwis.git\n%cd colabwis\n\n!apt-get install -y ffmpeg\n!pip uninstall -y numpy ctc-segmentation\n!pip install rapidfuzz ctc-segmentation\n!pip install -r requirements.txt\n!pip install git+https://github.com/m-bain/whisperx.git\n!pip install "numpy<2" --force-reinstall\n!python model_downloader.py\n\nimport subprocess, threading, time, re, os\n\n# تحميل cloudflared\nif not os.path.exists("cloudflared"):\n    subprocess.run(["curl", "-sL", "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64", "-o", "cloudflared"], check=True)\n    subprocess.run(["chmod", "+x", "cloudflared"], check=True)\n\n# تشغيل الخادم\nuvicorn_proc = subprocess.Popen(["uvicorn", "colab_server:app", "--host", "0.0.0.0", "--port", "8000"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)\nprint("⏳ جاري تشغيل الخادم...")\ntime.sleep(15)\n\n# تشغيل النفق\ncf_proc = subprocess.Popen(["./cloudflared", "tunnel", "--url", "http://localhost:8000"], stderr=subprocess.PIPE, text=True)\n\nfor line in cf_proc.stderr:\n    match = re.search(r'https://[a-z0-9\\-]+\\.trycloudflare\\.com', line)\n    if match:\n        print(f"\\n✅ الرابط العام جاهز:\\n🌐 {match.group(0)}\\n")\n        break\n\nfor line in uvicorn_proc.stdout: print(line, end="")`
        ],
        whisperx: []
    };
    colabCodes.whisperx = colabCodes.hybrid; // WhisperX also uses the hybrid script as it contains WhisperX functionality


    function renderColabCells() {
        if (!colabCellsContainer) return;
        const method = methodSelect ? methodSelect.value : 'waqf_backend';
        const cells = colabCodes[method] || colabCodes.waqf_backend;
        
        colabCellsContainer.innerHTML = '';
        
        cells.forEach((cellText, idx) => {
            const cellDiv = document.createElement('div');
            cellDiv.className = "bg-slate-900 border border-white/5 rounded-xl overflow-hidden relative group";
            
            const headerDiv = document.createElement('div');
            headerDiv.className = "flex justify-between items-center px-4 py-2 bg-white/5 border-b border-white/5";
            
            const titleSpan = document.createElement('span');
            titleSpan.className = "text-xs font-bold text-slate-400";
            titleSpan.textContent = `الخلية ${idx + 1}`;
            
            const copyBtn = document.createElement('button');
            copyBtn.className = "text-xs flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer";
            copyBtn.innerHTML = `<i data-lucide="copy" class="w-3 h-3"></i> نسخ الكود`;
            
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(cellText).then(() => {
                    const originalHTML = copyBtn.innerHTML;
                    copyBtn.innerHTML = `<i data-lucide="check" class="w-3 h-3"></i> تم النسخ`;
                    copyBtn.classList.replace('text-emerald-400', 'text-emerald-500');
                    lucide.createIcons();
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHTML;
                        copyBtn.classList.replace('text-emerald-500', 'text-emerald-400');
                        lucide.createIcons();
                    }, 2000);
                });
            };
            
            headerDiv.appendChild(titleSpan);
            headerDiv.appendChild(copyBtn);
            
            const preContainer = document.createElement('div');
            preContainer.className = "p-4 overflow-x-auto custom-scrollbar";
            
            const preElement = document.createElement('pre');
            preElement.className = "text-[10px] sm:text-xs font-mono text-slate-300 leading-relaxed text-left";
            preElement.dir = "ltr";
            preElement.textContent = cellText;
            
            preContainer.appendChild(preElement);
            
            cellDiv.appendChild(headerDiv);
            cellDiv.appendChild(preContainer);
            
            colabCellsContainer.appendChild(cellDiv);
        });
        
        lucide.createIcons();
    }

    if (methodSelect) {
        methodSelect.addEventListener('change', renderColabCells);
    }
    // Initial render
    renderColabCells();
});
