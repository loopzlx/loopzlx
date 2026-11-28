window.CyberAudioPlayer = (function () {
    // 🎵 在这里添加你的歌单和音频直链（支持 MP3/FLAC/M4A）
    /* 歌单：group 可以直接有 tracks，也可以再分一层 folders（文件夹） */
    const playlists = [
        {
            name: "SONGS",
            folders: [
                {
                    name: "FOLDER1",
                    tracks: [
                        { title: "月摇", artist: "초록물꼬기 / Narae", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iND4z4gqy15c&pwd=376t", alt: "https://pdf3.webgetstore.com/b695c48d708224efa5c288b0edaa9c4a/6b01b7b8/2026/11/20/4757e66a91e9913349c1c92c3e060494.mp3", duration: "02:56" },
                        { title: "r-906-まにまに 随之任之(feat. 初音ミク)", artist: "Kaozaki", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/ieHAx4hiae5e&pwd=4bc3" },
                        { title: "ノンブレス・オブリージュ", artist: "十五少女", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iLkmI4hifqhi&pwd=2e3x" },
                        { title: "One Last Kiss", artist: "Sawako碎花", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iGZN64hkwzod&pwd=c3ry" },
                        { title: "群青(Remix)", artist: "DJ Agos、Ayase", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/isXGD4hkwz6f&pwd=5g2z" }
                    ]
                }
            ]
        },
        {
            name: "GAME MUSIC",
            folders: [
                {
                    name: "MINECRAFT",
                    tracks: [
                        { title: "Alpha", artist: "C418", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/i3gdZ4hkqpwf&pwd=5wua" },
                        { title: "Moog City", artist: "C418", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/i2HlF4hkqryj&pwd=3sex" }
                    ]
                },
                {
                    name: "CELESTE OST",
                    tracks: [
                        { title: "Prologue", artist: "Lena RaineLena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iU7vi4hkthzi&pwd=42jw" },
                        { title: "First Steps", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/i0auq4hktjyj&pwd=ec4s" },
                        { title: "Resurrections", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/ih8GJ4hktmng&pwd=7ct9" },
                        { title: "Awake", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/idm604hktn1a&pwd=59b9" },
                        { title: "Postcard from Celeste Mountain", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iuQy34hktn7g&pwd=2uze" },
                        { title: "Checking In", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/irnrm4hktopa&pwd=6rmo" },
                        { title: "Spirit of Hospitality", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/ih3RU4hktpef&pwd=epfx" },
                        { title: "Scattered and Lost", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/ifNlM4hktqyb&pwd=bhez" },
                        { title: "Golden", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/irJjf4hktt0f&pwd=2yk7" },
                        { title: "Anxiety", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iyPRH4hkttid&pwd=cxcb" },
                        { title: "Quiet and Falling", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iGs1t4hktuhi&pwd=84i9" },
                        { title: "In the Mirror", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iHTf74hktvif&pwd=1zz4" },
                        { title: "Madeline and Theo", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iM0R34hktvwj&pwd=3o61" },
                        { title: "Starjump", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iftHh4hktw3g&pwd=23ru" },
                        { title: "Reflection", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iKITM4hktwng&pwd=fuh1" },
                        { title: "Confronting Myself", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iRGlA4hktxih&pwd=h6v3" },
                        { title: "Little Goth", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iQSgk4hkty2h&pwd=hi68" },
                        { title: "Reach for the Summit", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iKdpS4hku0cj&pwd=97xr" },
                        { title: "Exhale", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iHz0U4hku0jg&pwd=akx6" },
                        { title: "Heart of the Mountain", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/ip2Xx4hku13g&pwd=grw3" },
                        { title: "My Dearest Friends", artist: "Lena Raine", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iWpUm4hku1cf&pwd=2hee" }
                    ]
                },
                {
                    name: "STRAWBERRY JAM",
                    tracks: [
                        { title: "Starfruit Supernova (Pillars of Creation Mix)", artist: "Celeste Strawberry", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/i3eC74hkui0f&pwd=d0n3" },
                        { title: "Passionfruit Pantheon (Apotheosis Mix)", artist: "Celeste Strawberry", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/izBjC4hkujpg&pwd=hou3" },
                        { title: "Starfruit Supernova", artist: "Celeste Strawberry", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iTYGD4hkug1e&pwd=bt09" },
                        { title: "Passionfruit Pantheon", artist: "Celeste Strawberry", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iOyRZ4hkufeb&pwd=49ts" },
                        { title: "A Walk Down Strawberry Lane", artist: "Celeste Strawberry", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iWpUm4hku1cf&pwd=2hee" }
                    ]
                }
            ]
        },
        {
            name: "PHONK",
            tracks: [
                { title: "Eyes In This Feeling", artist: "", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/i8byd4gvqevi&pwd=btan", alt: "https://pdf3.webgetstore.com/5f131a8410bf79bbea17c2c30d0bc38d/6b0184b3/2026/11/21/52e92962f9aa03a0869bb7c44e534b24.mp3", duration: "03:24" },
                { title: "In Your Heart", artist: "", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/ibkAe4gv3hif&pwd=fbwf", alt: "https://pdf3.webgetstore.com/33710d196c190c8a5442c39fc76a04b7/6b018512/2026/11/21/bbc2c49a8e4618d6920511496b375bc0.flac", duration: "02:50" }
            ]
        },
        {
            name: "IDK",
            tracks: [
                { title: "Next to You", artist: "Øneheart", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/ikWJl4hifrfc&pwd=fm1u" }
            ]
        },
        {
            name: "SYNTHWAVE",
            tracks: [
                { title: "Locke", artist: "Pylot", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/idilD4gvs09e&pwd=f6oi", alt: "https://pdf3.webgetstore.com/4f579d7cef90004c5753e805e038f1c5/6b0188a3/2026/11/21/03b5b6a221c03b4c524637f0ae39001c.mp3", duration: "05:26" },
                { title: "Moments in Time", artist: "Timecop1983", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iDHag4gvs0ni&pwd=5dy7", alt: "https://pdf3.webgetstore.com/0fb9482510569dfb93c4c0c9a69e6cf0/6b018908/2026/11/21/6ac7658e9b3b399a8115c1cc69cf17c9.mp3", duration: "04:18" },
                { title: "New Retrowave", artist: "Gerard Requena", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/io2aK4gvs16h&pwd=8rm0", alt: "https://pdf3.webgetstore.com/20c0873de9f960a7ed80d59a184d4adc/6b01896a/2026/11/21/0a4690c10c6386740d787502b7f6c6bf.mp3", duration: "05:15" },
                { title: "Signals", artist: "Lazer Boomerang", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/iRTBM4gvs1fg&pwd=77kk", alt: "https://pdf3.webgetstore.com/1fc3bd1cad9817e61d805b49889807da/6b0189c4/2026/11/21/549354b3885d1e68f1125c78f9e07b55.mp3", duration: "04:27" },
                { title: "SimpsonWave1995", artist: "Tax Evader & Resonance Hub & FrankJavCee", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/irKX64gvs1vc&pwd=1tfm", alt: "https://pdf3.webgetstore.com/1dc00c581b12f2f93a2c692e35574415/6b018a1b/2026/11/21/a54b5e41d605a55768cde48e4a70fb62.flac", duration: "02:21" },
                { title: "Synthwave Cassette (1985)", artist: "FrankJavCee", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/ihe254gvs25c&pwd=1tyk", alt: "https://pdf3.webgetstore.com/3fd3ec8d0341dd7e29e916cec26dd523/6b018a3a/2026/11/21/f76a31a398a4922028044de77a8b92e4.mp3", duration: "03:37" },
                { title: "Teenage Dreams", artist: "Lazer Boomerang", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/i5KFu4gvs2ob&pwd=8bzs", alt: "https://pdf3.webgetstore.com/fd5b63efe5762a1e6029451f98051af0/6b018ab0/2026/11/21/0264f4ee4d143c5d02b6903fb2352101.mp3", duration: "05:43" },
                { title: "Time to Pretend", artist: "Lazer Boomerang", src: "https://lz.qaiu.top/parser?url=https://wwatu.lanzouv.com/inF3C4gvs3oh&pwd=h6tp", alt: "https://pdf3.webgetstore.com/77b158eded4b28cdfebb98a91642218c/6b018b08/2026/11/21/eac270709206ca29d604fd01748a7369.mp3", duration: "05:15" }
            ]
        }
    ];

    /* 一个 group 下的全部曲目（有 folders 就拼起来），播放索引按这个顺序展平 */
    function groupTracks(group) {
        if (!group.folders) return group.tracks || [];
        return group.folders.reduce((acc, f) => acc.concat(f.tracks || []), []);
    }
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

            allTracks = playlists.reduce((acc, g) => acc.concat(groupTracks(g)), []);
            if (allTracks.length === 0) return;

            // 渲染歌单（group → 可选 folders → tracks）
            if (trackCount) trackCount.textContent = allTracks.length;
            if (playlistList) {
                var itemHtml = function (idx, track) {
                    return '<li class="playlist-item ' + (idx === 0 ? 'active' : '') + '" data-index="' + idx + '">' +
                        '<div><div style="font-size:12px;">' + track.title + '</div>' +
                        '<div style="font-size:9px; opacity:0.5; margin-top:2px;">' + track.artist + '</div></div>' +
                        '<span class="track-duration">' + (track.duration || '--:--') + '</span></li>';
                };

                var base = 0;
                playlistList.innerHTML = playlists.map(function (group, gi) {
                    var startIdx = base;
                    var total = groupTracks(group).length;
                    base += total;
                    var isFirst = gi === 0;
                    var inner = '';

                    if (group.folders) {
                        var fBase = startIdx;
                        inner = group.folders.map(function (folder, fi) {
                            var fStart = fBase;
                            fBase += folder.tracks.length;
                            var openF = isFirst && fi === 0;
                            var lis = folder.tracks.map(function (track, ti) {
                                return itemHtml(fStart + ti, track);
                            }).join('');
                            return '<div class="playlist-folder">' +
                                '<div class="playlist-folder-title ' + (openF ? 'open' : '') + '" data-folder="' + gi + '-' + fi + '">' +
                                  '<i class="fas fa-folder"></i><span>' + folder.name + '</span>' +
                                  '<span class="group-badge">' + folder.tracks.length + '</span>' +
                                  '<i class="fas fa-chevron-right chev"></i>' +
                                '</div>' +
                                '<ul class="playlist-tracks ' + (openF ? 'open' : '') + '">' + lis + '</ul>' +
                              '</div>';
                        }).join('');
                    } else {
                        /* 无文件夹的组：ul 常带 open，显隐完全由父级 .playlist-group-body 控制，
                           否则非首个组展开后 body 是 open 但 ul 还是 display:none → 一片空白 */
                        inner = '<ul class="playlist-tracks open">' +
                            group.tracks.map(function (track, ti) { return itemHtml(startIdx + ti, track); }).join('') +
                            '</ul>';
                    }

                    return '<div class="playlist-group">' +
                        '<div class="playlist-group-title ' + (isFirst ? 'open active-group' : '') + '" data-group="' + gi + '">' +
                          '<span>' + group.name + '</span>' +
                          '<span class="group-badge">' + total + '</span>' +
                          '<i class="fas fa-chevron-right"></i>' +
                        '</div>' +
                        '<div class="playlist-group-body ' + (isFirst ? 'open' : '') + '" id="group-tracks-' + gi + '">' + inner + '</div>' +
                      '</div>';
                }).join('');
            }

            // 折叠交互：一级 group 手风琴，二级 folder 同组内手风琴
            function paintFolder(el, on) {
                var ic = el.querySelector('i.fa-folder, i.fa-folder-open');
                if (ic) ic.className = 'fas ' + (on ? 'fa-folder-open' : 'fa-folder');
            }
            if (playlistList) {
                playlistList.addEventListener('click', function (e) {
                    var folderTitle = e.target.closest('.playlist-folder-title');
                    if (folderTitle) {
                        var willOpen = !folderTitle.classList.contains('open');
                        var body = folderTitle.closest('.playlist-group-body');
                        if (body) {
                            body.querySelectorAll('.playlist-folder-title').forEach(function (t) {
                                t.classList.remove('open');
                                paintFolder(t, false);
                            });
                            body.querySelectorAll('.playlist-tracks').forEach(function (t) { t.classList.remove('open'); });
                        }
                        if (willOpen) {
                            folderTitle.classList.add('open');
                            paintFolder(folderTitle, true);
                            var ul = folderTitle.nextElementSibling;
                            if (ul) ul.classList.add('open');
                        }
                        return;
                    }

                    var groupTitle = e.target.closest('.playlist-group-title');
                    if (groupTitle) {
                        var gIndex = groupTitle.dataset.group;
                        var willOpenG = !groupTitle.classList.contains('open');
                        document.querySelectorAll('.playlist-group-title').forEach(function (t) { t.classList.remove('open'); });
                        document.querySelectorAll('.playlist-group-body').forEach(function (t) { t.classList.remove('open'); });
                        document.querySelectorAll('.playlist-folder-title').forEach(function (t) {
                            t.classList.remove('open');
                            paintFolder(t, false);
                        });
                        if (willOpenG) {
                            groupTitle.classList.add('open');
                            var gBody = document.getElementById('group-tracks-' + gIndex);
                            if (gBody) {
                                gBody.classList.add('open');
                                gBody.querySelectorAll('ul.playlist-tracks').forEach(function (u) { u.classList.add('open'); });
                                /* 组里有文件夹时，展开组顺手打开第一个文件夹 */
                                var firstFolder = gBody.querySelector('.playlist-folder-title');
                                if (firstFolder) {
                                    firstFolder.classList.add('open');
                                    paintFolder(firstFolder, true);
                                    if (firstFolder.nextElementSibling) firstFolder.nextElementSibling.classList.add('open');
                                }
                            }
                        }
                    }
                });
            }

            // 报错处理：单曲失效自动顺延下一首，避免停在 FAILED 上没声音
            /* 音源失效就地标记，不再自动跳到下一首（要跳由用户自己选） */
            let altTried = -1;
            const markOffline = () => {
                /* 先试一次备用直链（蓝奏云解析偶尔抽风，直链还能用） */
                const t = allTracks[currentTrackIndex];
                if (t && t.alt && altTried !== currentTrackIndex) {
                    altTried = currentTrackIndex;
                    logFunc('Audio: parser failed, falling back to direct link');
                    audio.src = t.alt;
                    audio.play().catch(() => { });
                    return;
                }
                if (cont) cont.classList.add('no-signal');
                if (cont) cont.classList.remove('playing');
                logFunc('Warning: Audio source offline — playback stopped');
                if (trackNameLabel) trackNameLabel.textContent = 'OFFLINE';
                if (playIcon) playIcon.className = 'fas fa-exclamation-triangle';
            };

            audio.addEventListener('error', markOffline);

            // 切换歌曲
            function loadTrack(index, autoPlay = true) {
                if (index < 0 || index >= allTracks.length) return;
                currentTrackIndex = index;
                altTried = -1;
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
                        setTimeout(() => {
                            if (!playlistList) return;
                            const top = el.offsetTop - playlistList.clientHeight * 0.25;
                            playlistList.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
                        }, 100);
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
                    loadTrack(currentTrackIndex, true);
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

            /* ---- v5.0 播放控制：随机 / 循环 / 上一首下一首 / 音量 ---- */
            let shuffleOn = false;
            let repeatMode = 0; // 0 off / 1 all / 2 one

            function stepIndex(dir) {
                if (shuffleOn && allTracks.length > 1) {
                    let r = currentTrackIndex;
                    while (r === currentTrackIndex) r = Math.floor(Math.random() * allTracks.length);
                    return r;
                }
                return (currentTrackIndex + dir + allTracks.length) % allTracks.length;
            }

            audio.addEventListener('ended', () => {
                if (repeatMode === 2) {
                    audio.currentTime = 0;
                    audio.play().catch(() => markOffline());
                    return;
                }
                if (repeatMode === 0 && !shuffleOn && currentTrackIndex === allTracks.length - 1) {
                    if (playIcon) playIcon.className = 'fas fa-play';
                    if (cont) cont.classList.remove('playing');
                    logFunc('Playback: end of playlist');
                    return;
                }
                loadTrack(stepIndex(1), true);
            });

            const prevBtn = document.getElementById('prev-btn');
            const nextBtn = document.getElementById('next-btn');
            const shufBtn = document.getElementById('shuffle-btn');
            const repBtn = document.getElementById('repeat-btn');
            const volBtn = document.getElementById('vol-btn');
            const volPop = document.getElementById('vol-pop');
            const volRange = document.getElementById('vol-range');

            if (prevBtn) prevBtn.addEventListener('click', () => loadTrack(stepIndex(-1), true));
            if (nextBtn) nextBtn.addEventListener('click', () => loadTrack(stepIndex(1), true));
            if (shufBtn) shufBtn.addEventListener('click', () => {
                shuffleOn = !shuffleOn;
                shufBtn.classList.toggle('on', shuffleOn);
                logFunc('Playback: shuffle ' + (shuffleOn ? 'on' : 'off'));
            });
            if (repBtn) repBtn.addEventListener('click', () => {
                repeatMode = (repeatMode + 1) % 3;
                const names = ['off', 'all', 'one'];
                repBtn.classList.toggle('on', repeatMode !== 0);
                repBtn.title = ['循环：关', '循环：全部', '循环：单曲'][repeatMode];
                logFunc('Playback: repeat ' + names[repeatMode]);
            });
            if (volBtn && volPop) {
                volBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    volPop.classList.toggle('show');
                });
                volPop.addEventListener('click', (e) => e.stopPropagation());
                document.addEventListener('click', () => volPop.classList.remove('show'));
            }
            if (volRange) {
                audio.volume = parseFloat(volRange.value) || 1;
                volRange.addEventListener('input', () => {
                    audio.volume = Math.max(0, Math.min(1, parseFloat(volRange.value) || 0));
                    if (volBtn) {
                        const ic = volBtn.querySelector('i');
                        if (ic) ic.className = 'fas ' + (audio.volume === 0 ? 'fa-volume-xmark' : audio.volume < 0.5 ? 'fa-volume-low' : 'fa-volume-high');
                    }
                });
            }

            /* 对外 API：终端/外部可控制播放 */
            const api = this;
            api.next = () => loadTrack(stepIndex(1), true);
            api.prev = () => loadTrack(stepIndex(-1), true);
            api.toggleShuffle = () => { if (shufBtn) shufBtn.click(); return shuffleOn; };
            api.cycleRepeat = () => { if (repBtn) repBtn.click(); return repeatMode; };
            api.setVolume = (v) => {
                audio.volume = Math.max(0, Math.min(1, typeof v === 'number' ? v : 0));
                if (volRange) volRange.value = String(audio.volume);
            };
            api.playIndex = (i) => loadTrack(i, true);
            api.getAudio = () => audio;
            api.state = () => ({
                index: currentTrackIndex,
                title: (allTracks[currentTrackIndex] || {}).title,
                paused: audio.paused,
                shuffle: shuffleOn,
                repeat: repeatMode
            });
            api.tracks = () => allTracks.map((t) => t.title);

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