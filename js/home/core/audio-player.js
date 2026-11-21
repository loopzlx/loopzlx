window.CyberAudioPlayer = (function () {
    // 🎵 在这里添加你的歌单和音频直链（支持 MP3/FLAC/M4A）
    const playlists = [
        {
            name: 'SONGS',
            tracks: [
                { title: '月揺(Tsukiyura)', artist: '초록물꼬기 / Narae', src: 'https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iND4z4gqy15c&pwd=376t', duration: '02:56' },
                { title: 'Neon Pulse', artist: 'Kernel', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', duration: '06:12' },
                { title: 'Digital Rain', artist: 'Matrix', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', duration: '05:30' }
            ]
        },
        {
            name: 'CHILL_FLOW (随波逐流)',
            tracks: [
                { title: '月揺 (Tsukiyura)', artist: '초록물꼬기 / Narae', src: 'https://你的真实音频直链.flac', duration: '02:56' }
            ]
        }
    ];
    
    let currentTrackIndex = 0;
    let allTracks = [];
    let logFunc = console.log;
    
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    return {
        init: function (addLogFn) {
            if (addLogFn) logFunc = addLogFn;

            const playBtn = document.getElementById('play-btn');
            const playlistBtn = document.getElementById('playlist-btn');
            const playlistPanel = document.getElementById('playlist-panel');
            const closePlaylistBtn = document.getElementById('close-playlist');
            const playlistList = document.getElementById('playlist-list');
            const trackCount = document.getElementById('track-count');
            const trackNameLabel = document.getElementById('current-track-name');
            const audio = document.getElementById('bg-audio');
            const cont = document.getElementById('audio-container');
            
            const progressBg = document.getElementById('progress-bg');
            const progressFill = document.getElementById('progress-fill');
            const progressHandle = document.getElementById('progress-handle');
            const currentTimeEl = document.getElementById('current-time');
            const totalTimeEl = document.getElementById('total-time');
            const playIcon = document.getElementById('play-icon');
            
            if (!playBtn || !audio) return;

            allTracks = playlists.flatMap(p => p.tracks);
            if (allTracks.length === 0) return;

            // 渲染歌单
            if (trackCount) trackCount.textContent = allTracks.length;
            if (playlistList) {
                playlistList.innerHTML = playlists.map((group, groupIndex) => {
                    const tracksHtml = group.tracks.map((track, trackIndex) => {
                        let globalIndex = 0;
                        for(let i=0; i<groupIndex; i++) globalIndex += playlists[i].tracks.length;
                        globalIndex += trackIndex;
                        return `
                            <li class="playlist-item ${globalIndex === 0 ? 'active' : ''}" data-index="${globalIndex}">
                                <div>
                                    <div style="font-size:12px;">${track.title}</div>
                                    <div style="font-size:9px; opacity:0.5; margin-top:2px;">${track.artist}</div>
                                </div>
                                <span class="track-duration">${track.duration || '--:--'}</span>
                            </li>
                        `;
                    }).join('');
                    const isFirst = groupIndex === 0;
                    return `
                        <div class="playlist-group">
                            <div class="playlist-group-title ${isFirst ? 'open active-group' : ''}" data-group="${groupIndex}">
                                <span>${group.name}</span>
                                <i class="fas fa-chevron-right"></i>
                            </div>
                            <ul class="playlist-tracks ${isFirst ? 'open' : ''}" id="group-tracks-${groupIndex}">
                                ${tracksHtml}
                            </ul>
                        </div>
                    `;
                }).join('');
            }

            // 折叠交互
            if (playlistList) {
                playlistList.addEventListener('click', (e) => {
                    const groupTitle = e.target.closest('.playlist-group-title');
                    if (groupTitle) {
                        const groupIndex = groupTitle.dataset.group;
                        const tracksContainer = document.getElementById(`group-tracks-${groupIndex}`);
                        groupTitle.classList.toggle('open');
                        if (tracksContainer) tracksContainer.classList.toggle('open');
                    }
                });
            }

            // 报错处理：只改样式，不锁死交互
            const markOffline = () => {
                if (cont) cont.classList.add('no-signal');
                if (trackNameLabel) trackNameLabel.textContent = 'OFFLINE';
                if (playIcon) playIcon.className = 'fas fa-exclamation-triangle';
                if (cont) cont.classList.remove('playing');
                logFunc('Warning: Audio source offline or invalid');
            };

            audio.addEventListener('error', markOffline);

            // 切换歌曲
            function loadTrack(index, autoPlay = true) {
                if (index < 0 || index >= allTracks.length) return;
                currentTrackIndex = index;
                const track = allTracks[index];
                
                // 清除错误状态
                if (cont) cont.classList.remove('no-signal');
                if (playIcon) playIcon.className = 'fas fa-play';
                
                audio.src = track.src;
                if (trackNameLabel) trackNameLabel.textContent = track.title; 
                
                if(progressFill) progressFill.style.width = '0%';
                if(progressHandle) progressHandle.style.left = '0%';
                if(currentTimeEl) currentTimeEl.textContent = '00:00';
                if(totalTimeEl) totalTimeEl.textContent = '--:--';
                
                document.querySelectorAll('.playlist-item').forEach((el) => {
                    if(parseInt(el.dataset.index) === index) {
                        el.classList.add('active');
                        setTimeout(() => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 100);
                    } else {
                        el.classList.remove('active');
                    }
                });

                if (autoPlay) {
                    audio.play().then(() => {
                        if (playIcon) playIcon.className = 'fas fa-pause';
                        if (cont) cont.classList.add('playing'); 
                    }).catch(() => markOffline());
                }
            }

            loadTrack(0, false);

            // 播放暂停
            playBtn.addEventListener('click', () => {
                if (cont && cont.classList.contains('no-signal')) {
                    loadTrack((currentTrackIndex + 1) % allTracks.length, true);
                    return;
                }
                
                if (audio.paused) {
                    audio.play().then(() => {
                        if (playIcon) playIcon.className = 'fas fa-pause';
                        if (cont) cont.classList.add('playing');
                    }).catch(() => markOffline());
                } else {
                    audio.pause();
                    if (playIcon) playIcon.className = 'fas fa-play';
                    if (cont) cont.classList.remove('playing');
                }
            });

            // 列表点击
            if (playlistList) {
                playlistList.addEventListener('click', (e) => {
                    const item = e.target.closest('.playlist-item');
                    if (item) {
                        const index = parseInt(item.dataset.index, 10);
                        if (index !== currentTrackIndex) {
                            loadTrack(index, true);
                        }
                    }
                });
            }

            audio.addEventListener('ended', () => loadTrack((currentTrackIndex + 1) % allTracks.length, true));

            // 进度条逻辑
            audio.addEventListener('loadedmetadata', () => {
                if (totalTimeEl) totalTimeEl.textContent = formatTime(audio.duration);
            });

            audio.addEventListener('timeupdate', () => {
                if (progressBg && progressBg.classList.contains('dragging')) return; 
                
                const percent = (audio.currentTime / audio.duration) * 100;
                if (progressFill) progressFill.style.width = `${percent}%`;
                if (progressHandle) progressHandle.style.left = `${percent}%`;
                if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
            });

            let isDragging = false;

            function updateSeek(e) {
                if (!isDragging || !progressBg) return;
                const rect = progressBg.getBoundingClientRect();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                let percent = (clientX - rect.left) / rect.width;
                percent = Math.max(0, Math.min(1, percent)); 

                if (progressFill) progressFill.style.width = `${percent * 100}%`;
                if (progressHandle) progressHandle.style.left = `${percent * 100}%`;
                if (currentTimeEl && audio.duration) currentTimeEl.textContent = formatTime(percent * audio.duration);
            }

            if (progressBg) {
                const startDrag = (e) => {
                    isDragging = true;
                    progressBg.classList.add('dragging');
                    updateSeek(e);
                };
                const onDrag = (e) => {
                    if (isDragging) { e.preventDefault(); updateSeek(e); }
                };
                const endDrag = (e) => {
                    if (!isDragging) return;
                    isDragging = false;
                    progressBg.classList.remove('dragging');
                    const rect = progressBg.getBoundingClientRect();
                    const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
                    let percent = (clientX - rect.left) / rect.width;
                    percent = Math.max(0, Math.min(1, percent));
                    if (audio.duration && !isNaN(audio.duration)) {
                        audio.currentTime = percent * audio.duration;
                    }
                };
                progressBg.addEventListener('mousedown', startDrag);
                document.addEventListener('mousemove', onDrag);
                document.addEventListener('mouseup', endDrag);
                progressBg.addEventListener('touchstart', startDrag, { passive: false });
                document.addEventListener('touchmove', onDrag, { passive: false });
                document.addEventListener('touchend', endDrag);
            }

            // 面板控制
            function togglePlaylist() {
                if (playlistPanel) playlistPanel.classList.toggle('show');
            }
            if (playlistBtn) playlistBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlaylist(); });
            if (trackNameLabel) trackNameLabel.addEventListener('click', togglePlaylist);
            if (closePlaylistBtn) closePlaylistBtn.addEventListener('click', () => { if (playlistPanel) playlistPanel.classList.remove('show'); });

            document.addEventListener('click', (e) => {
                const wrapper = document.getElementById('audio-wrapper');
                if (playlistPanel && playlistPanel.classList.contains('show') && wrapper && !wrapper.contains(e.target)) {
                    playlistPanel.classList.remove('show');
                }
            });
        }
    };
})();