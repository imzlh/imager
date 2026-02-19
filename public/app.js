const { createApp, ref, onMounted, onUnmounted, nextTick } = Vue;

createApp({
    setup() {
        const tab = ref('home');
        const images = ref([]);
        const slider = ref(null);
        const toast = ref({ show: false, msg: '' });
        const animatingId = ref(null);
        const uiHidden = ref(false);
        const isRefreshing = ref(false);
        const isSwitching = ref(false);

        // 标签页数据缓存 - 使用 Map 存储更完整的状态
        const tabCache = ref(new Map([
            ['home', { images: [], page: 1, scrollTop: 0, hasMore: true }],
            ['cached', { images: [], page: 1, scrollTop: 0, hasMore: true, total: 0 }]
        ]));

        let loading = false;
        let clickTimer = null;
        let clickCount = 0;
        let scrollHandler = null;

        // 触摸滑动相关
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let isHorizontalSwipe = false;

        const showToast = (msg) => {
            toast.value = { show: true, msg };
            setTimeout(() => toast.value.show = false, 1500);
        };

        const getCurrentCache = () => tabCache.value.get(tab.value);

        const fetchImages = async (isRefresh = false) => {
            if (loading) return;
            loading = true;

            const cache = getCurrentCache();
            try {
                const currentPage = isRefresh ? 1 : cache.page;
                const res = await fetch(`/api/images?page=${currentPage}&limit=5`);
                const data = await res.json();

                if (isRefresh || currentPage === 1) {
                    images.value = data.images;
                } else {
                    images.value.push(...data.images);
                }

                // 限制缓存数量
                if (images.value.length > 100) {
                    images.value = images.value.slice(-100);
                }

                cache.page = currentPage + 1;
                cache.images = [...images.value];
                cache.hasMore = data.hasMore;
            } catch (e) {
                console.error(e);
                showToast('获取失败');
            }

            loading = false;
            isRefreshing.value = false;
        };

        const fetchCached = async (isRefresh = false) => {
            if (loading) return;
            loading = true;

            const cache = getCurrentCache();
            try {
                const currentPage = isRefresh ? 1 : cache.page;
                const res = await fetch(`/api/cached?page=${currentPage}&limit=10`);
                const data = await res.json();

                if (isRefresh || currentPage === 1) {
                    images.value = data.images;
                } else {
                    images.value.push(...data.images);
                }

                cache.page = currentPage + 1;
                cache.images = [...images.value];
                cache.hasMore = data.hasMore;
                cache.total = data.total;
            } catch (e) {
                console.error(e);
                showToast('获取缓存失败');
            }

            loading = false;
        };

        const refresh = async () => {
            if (isRefreshing.value) return;
            isRefreshing.value = true;
            showToast('刷新中...');

            const cache = getCurrentCache();
            cache.page = 1;
            cache.images = [];

            if (tab.value === 'home') {
                await fetchImages(true);
            } else {
                await fetchCached(true);
            }

            showToast('已刷新');
        };

        const toggleLike = async (img) => {
            try {
                const res = await fetch(`/api/images/${img.id}/cache`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageData: img })
                });
                const data = await res.json();
                img.isCached = data.isCached;
                img.likes = data.likes;
                showToast(data.isCached ? '已收藏' : '取消收藏');

                if (tab.value === 'cached' && !data.isCached) {
                    images.value = images.value.filter(i => i.id !== img.id);
                    const cache = getCurrentCache();
                    cache.images = [...images.value];
                }
            } catch (e) {
                console.error(e);
            }
        };

        const handleClick = (img) => {
            clickCount++;

            if (clickCount === 1) {
                clickTimer = setTimeout(() => {
                    if (clickCount === 1) {
                        uiHidden.value = !uiHidden.value;
                    }
                    clickCount = 0;
                    clickTimer = null;
                }, 300);
            } else if (clickCount === 2) {
                clearTimeout(clickTimer);
                clickCount = 0;
                clickTimer = null;

                if (!img.isCached) {
                    animatingId.value = img.id;
                    setTimeout(() => animatingId.value = null, 600);
                    toggleLike(img);
                }
            }
        };

        const share = async (img) => {
            if (navigator.share) {
                try {
                    await navigator.share({ title: img.title, url: img.url });
                } catch (e) { }
            } else {
                await navigator.clipboard.writeText(img.url);
                showToast('链接已复制');
            }
        };

        // 切换标签 - 保留完整状态
        const switchTab = async (t) => {
            if (tab.value === t || isSwitching.value) return;
            isSwitching.value = true;

            // 保存当前状态
            const currentCache = getCurrentCache();
            if (slider.value) {
                currentCache.scrollTop = slider.value.scrollTop;
                currentCache.images = [...images.value];
            }

            // 切换标签
            tab.value = t;

            // 获取新标签的缓存数据
            const newCache = getCurrentCache();
            images.value = [...newCache.images];

            // 如果没有数据则加载
            if (images.value.length === 0) {
                if (t === 'home') await fetchImages();
                else await fetchCached();
            }

            // 恢复滚动位置
            await nextTick();
            if (slider.value) {
                slider.value.scrollTop = newCache.scrollTop || 0;
            }

            uiHidden.value = false;
            isSwitching.value = false;
        };

        // 触摸事件处理 - 左右滑动切换标签
        const onTouchStart = (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isHorizontalSwipe = false;
        };

        const onTouchMove = (e) => {
            if (!touchStartX || !touchStartY) return;

            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const diffX = touchStartX - currentX;
            const diffY = touchStartY - currentY;

            // 判断滑动方向
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
                isHorizontalSwipe = true;
            }
        };

        const onTouchEnd = (e) => {
            if (!isHorizontalSwipe) return;

            touchEndX = e.changedTouches[0].clientX;
            const diff = touchStartX - touchEndX;
            const threshold = 80; // 滑动阈值

            if (Math.abs(diff) > threshold) {
                if (diff > 0) {
                    // 左滑 - 切换到下一个标签
                    switchTab(tab.value === 'home' ? 'cached' : 'home');
                } else {
                    // 右滑 - 切换到上一个标签
                    switchTab(tab.value === 'cached' ? 'home' : 'cached');
                }
            }

            touchStartX = 0;
            touchStartY = 0;
            isHorizontalSwipe = false;
        };

        // 滚动处理
        const onScroll = () => {
            if (!slider.value || isSwitching.value) return;
            if (scrollHandler) return;

            scrollHandler = requestAnimationFrame(() => {
                const { scrollTop, scrollHeight, clientHeight } = slider.value;
                const cache = getCurrentCache();

                cache.scrollTop = scrollTop;

                if (cache.hasMore && scrollTop + clientHeight > scrollHeight - 300) {
                    if (tab.value === 'home') fetchImages();
                    else fetchCached();
                }

                scrollHandler = null;
            });
        };

        const formatNum = (n) => {
            if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
            if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
            return n;
        };

        const handleKeydown = (e) => {
            if (e.key === 'r' || e.key === 'R') refresh();
            if (e.key === 'ArrowLeft') switchTab('home');
            if (e.key === 'ArrowRight') switchTab('cached');
        };

        onMounted(() => {
            fetchImages();
            window.addEventListener('keydown', handleKeydown);
        });

        onUnmounted(() => {
            window.removeEventListener('keydown', handleKeydown);
            if (scrollHandler) cancelAnimationFrame(scrollHandler);
        });

        return {
            tab, images, slider, toast, animatingId, uiHidden, isRefreshing, isSwitching,
            toggleLike, handleClick, share, switchTab, onScroll,
            onTouchStart, onTouchMove, onTouchEnd,
            formatNum, refresh
        };
    }
}).mount('#app');
